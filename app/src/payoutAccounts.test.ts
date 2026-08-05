import { describe, expect, it } from 'vitest';
import {
  clonePayoutAccounts,
  createEmptyAirwallexAccount,
  createEmptyPayMaxAccount,
  createEmptyPayPalAccount,
  getPayoutAccountForProvider,
  normalizePayMaxStatus,
  payoutAccountToInvoicePayment,
  prepareCreatorPayoutAccountsForSave,
  shouldSynchronizeAirwallexAccount,
} from './payoutAccounts';
import { setAirwallexFormValue } from './airwallexFormSchema';

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
});
