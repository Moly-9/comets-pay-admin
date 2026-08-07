import { describe, expect, it } from 'vitest';
import {
  assertDocumentPayoutSnapshotReady,
  clonePayoutAccounts,
  canDeletePayoutAccount,
  createEmptyAirwallexAccount,
  createEmptyPayMaxAccount,
  createEmptyPayPalAccount,
  deletePayoutAccount,
  eligibleInvoicePayoutAccounts,
  getPayoutAccountDocumentIssues,
  getPayoutAccountForProvider,
  isPayoutAccountDocumentReady,
  normalizePayMaxStatus,
  payoutAccountToInvoicePayment,
  prepareCreatorPayoutAccountsForSave,
  shouldSynchronizeAirwallexAccount,
} from './payoutAccounts';
import { setAirwallexFormValue } from './airwallexFormSchema';
import type { CreatorProfile } from './types';

describe('creator payout channels', () => {
  it('creates independent Airwallex, PayPal and PayerMax account models', () => {
    const airwallex = createEmptyAirwallexAccount('Mina Kato', 'mina@example.com');
    const paypal = createEmptyPayPalAccount('Mina Kato', 'mina@example.com');
    const payermax = createEmptyPayMaxAccount('Mina Kato', 'mina@example.com');

    expect([airwallex.provider, paypal.provider, payermax.provider]).toEqual([
      'Airwallex',
      'PayPal',
      'PayMax',
    ]);
    expect(paypal).not.toHaveProperty('bankDetails');
    expect(payermax).not.toHaveProperty('bankDetails');
  });

  it('marks a complete PayerMax account ready without Airwallex synchronization', () => {
    const payermax = normalizePayMaxStatus({
      ...createEmptyPayMaxAccount(),
      beneficiaryName: 'Mina Kato',
      payermaxAccountId: 'pmx_10001',
      countryCode: 'JP',
      currency: 'JPY',
    });
    const paypal = createEmptyPayPalAccount('Mina Kato', 'mina@example.com');

    expect(payermax.status).toBe('READY_FOR_VALIDATION');
    expect(shouldSynchronizeAirwallexAccount(payermax)).toBe(false);
    expect(shouldSynchronizeAirwallexAccount(paypal)).toBe(false);
  });

  it('selects and clones channel-specific accounts without sharing nested Airwallex data', () => {
    const airwallex = createEmptyAirwallexAccount();
    const payermax = {
      ...createEmptyPayMaxAccount(),
      isDefault: true,
    };
    const accounts = [airwallex, payermax];
    const cloned = clonePayoutAccounts(accounts);

    expect(getPayoutAccountForProvider(accounts, 'PayMax')?.id).toBe(payermax.id);
    expect(cloned).not.toBe(accounts);
    expect(cloned[0]).not.toBe(airwallex);
    if (cloned[0].provider === 'Airwallex') {
      expect(cloned[0].bankDetails).not.toBe(airwallex.bankDetails);
    }
  });

  it('carries a supplemental bank address into the Invoice payment snapshot', () => {
    const account = setAirwallexFormValue(
      createEmptyAirwallexAccount(),
      'profile_supplement.beneficiary_bank_address',
      '1 Finance Street, Hong Kong',
    );

    expect(payoutAccountToInvoicePayment(account).bankStreetAddress)
      .toBe('1 Finance Street, Hong Kong');

    const schemaAliasAccount = setAirwallexFormValue(
      createEmptyAirwallexAccount(),
      'beneficiary.bank_details.bank_address',
      '2 Schema Street, Singapore',
    );
    expect(payoutAccountToInvoicePayment(schemaAliasAccount).bankStreetAddress)
      .toBe('2 Schema Street, Singapore');
  });

  it('creates a new version when verified account fields change and archives the old version', () => {
    const previous = {
      ...createEmptyAirwallexAccount('Mina Kato', 'mina@example.com', 'creator-1'),
      status: 'VERIFIED' as const,
      beneficiaryId: 'beneficiary_mock_1',
      bankDetails: {
        ...createEmptyAirwallexAccount().bankDetails,
        accountName: 'Mina Kato',
        accountNumber: '0000000001',
        bankName: 'Sample Bank',
      },
    };
    const candidate = {
      ...previous,
      status: 'READY_FOR_VALIDATION' as const,
      bankDetails: { ...previous.bankDetails, accountNumber: '0000000002' },
    };

    const result = prepareCreatorPayoutAccountsForSave('creator-1', [previous], [candidate]);

    expect(result.accounts[0]).toMatchObject({
      creatorId: 'creator-1',
      payoutAccountId: previous.id,
      payoutAccountVersion: 'v2',
    });
    expect(result.archived[0]).toMatchObject({
      payoutAccountId: previous.id,
      payoutAccountVersion: 'v1',
      beneficiaryId: 'beneficiary_mock_1',
    });
    expect(result.accounts[0]?.accountFingerprint).not.toBe(result.archived[0]?.accountFingerprint);
  });

  it('keeps draft edits in the same account version', () => {
    const previous = createEmptyPayPalAccount('Mina Kato', 'mina@example.com', 'creator-1');
    const candidate = { ...previous, transferNote: 'Invoice 2026-08' };
    const result = prepareCreatorPayoutAccountsForSave('creator-1', [previous], [candidate]);

    expect(result.accounts[0]?.payoutAccountVersion).toBe('v1');
    expect(result.archived).toEqual([]);
  });

  it('deletes an unlinked draft account and promotes a verified account as default', () => {
    const draft = {
      ...createEmptyAirwallexAccount('', '', 'creator-1'),
      id: 'draft-account',
      payoutAccountId: 'draft-account',
      isDefault: true,
    };
    const ready = {
      ...createEmptyPayPalAccount('Mina Kato', 'mina@example.com', 'creator-1'),
      id: 'verified-account',
      payoutAccountId: 'verified-account',
      status: 'VERIFIED' as const,
      isDefault: false,
    };

    const result = deletePayoutAccount([draft, ready], draft.id);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: ready.id, isDefault: true });
  });

  it('keeps accounts that have history or an active payment', () => {
    const withHistory = {
      ...createEmptyAirwallexAccount('', '', 'creator-1'),
      linkedProjectIds: ['project-1'],
    };
    const processing = {
      ...createEmptyPayPalAccount('', '', 'creator-1'),
      activePaymentId: 'payment-1',
    };
    const accounts = [withHistory, processing];

    expect(canDeletePayoutAccount(withHistory)).toBe(false);
    expect(canDeletePayoutAccount(processing)).toBe(false);
    expect(deletePayoutAccount(accounts, withHistory.id)).toBe(accounts);
    expect(deletePayoutAccount(accounts, processing.id)).toBe(accounts);
  });

  it('maps PayPal Transfer Note and account identity into the unified document snapshot', () => {
    const paypal = {
      ...createEmptyPayPalAccount('Mina Kato', 'mina@example.com', 'creator-1'),
      status: 'VERIFIED' as const,
      transferNote: 'Campaign IO-001',
    };

    expect(payoutAccountToInvoicePayment(paypal, 'creator-1')).toMatchObject({
      creatorId: 'creator-1',
      payoutAccountId: paypal.id,
      payoutAccountVersion: 'v1',
      payoutProvider: 'PayPal',
      transferMethod: 'PAYPAL',
      transferRemarks: 'Campaign IO-001',
      paypalEmail: 'mina@example.com',
    });
  });

  it('requires document bank fields while keeping LOCAL-only SWIFT and IBAN conditional', () => {
    const local = {
      ...createEmptyAirwallexAccount('Mina Kato', 'mina@example.com', 'creator-1'),
      status: 'VERIFIED' as const,
      bankDetails: {
        ...createEmptyAirwallexAccount().bankDetails,
        bankCountryCode: 'US',
        accountCurrency: 'USD',
        accountName: 'Mina Kato',
        accountNumber: '0000000001',
        bankName: 'Sample Bank',
        bankStreetAddress: '1 Finance Street',
      },
    };

    expect(getPayoutAccountDocumentIssues(local)).toEqual([]);
    expect(isPayoutAccountDocumentReady(local)).toBe(true);

    const missingAddress = {
      ...local,
      bankDetails: { ...local.bankDetails, bankStreetAddress: '' },
    };
    expect(getPayoutAccountDocumentIssues(missingAddress)).toEqual([
      expect.objectContaining({ fieldKey: 'bankAddress' }),
    ]);
    expect(eligibleInvoicePayoutAccounts({
      payoutAccounts: [
        { ...missingAddress, id: 'incomplete-bank', payoutAccountId: 'incomplete-bank' },
        { ...local, id: 'ready-bank', payoutAccountId: 'ready-bank' },
      ],
    } as CreatorProfile).map((account) => account.id)).toEqual(['ready-bank']);

    const swift = {
      ...local,
      transferMethod: 'SWIFT' as const,
      bankDetails: { ...local.bankDetails, swiftCode: '' },
    };
    expect(getPayoutAccountDocumentIssues(swift)).toEqual([
      expect.objectContaining({ fieldKey: 'swiftCode' }),
    ]);
  });

  it('requires IBAN for an IBAN-based LOCAL corridor', () => {
    const account = {
      ...createEmptyAirwallexAccount('Alex Ruiz', 'alex@example.com', 'creator-2'),
      transferMethod: 'LOCAL' as const,
      bankDetails: {
        ...createEmptyAirwallexAccount().bankDetails,
        bankCountryCode: 'ES',
        accountCurrency: 'EUR',
        accountName: 'Alex Ruiz',
        accountNumber: '0000000002',
        bankName: 'Sample Bank',
        bankStreetAddress: '2 Finance Street',
        iban: '',
      },
    };

    expect(getPayoutAccountDocumentIssues(account)).toContainEqual(
      expect.objectContaining({ fieldKey: 'iban' }),
    );
  });

  it('requires PayPal identity fields but keeps Transfer Note optional', () => {
    const paypal = createEmptyPayPalAccount('', '', 'creator-3');
    expect(getPayoutAccountDocumentIssues(paypal).map((issue) => issue.fieldKey)).toEqual([
      'paypalUsername',
      'paypalEmail',
    ]);

    const complete = {
      ...paypal,
      paypalUsername: 'creator.paypal',
      paypalEmail: 'creator@example.com',
      transferNote: '',
    };
    expect(getPayoutAccountDocumentIssues(complete)).toEqual([]);
    expect(() => assertDocumentPayoutSnapshotReady(
      payoutAccountToInvoicePayment(complete),
      'PayPal',
    )).not.toThrow();
  });
});
