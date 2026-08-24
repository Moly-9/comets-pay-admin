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
  getPayoutAccountSelectPresentation,
  isPayoutAccountDocumentReady,
  normalizePayMaxStatus,
  payoutAccountToInvoicePayment,
  prepareCreatorPayoutAccountsForSave,
  shouldSynchronizeAirwallexAccount,
} from './payoutAccounts';
import { setAirwallexFormValue } from './airwallexFormSchema';
import type { CreatorProfile } from './types';

describe('creator payout channels', () => {
  it('presents complete Airwallex payment details and account identifiers', () => {
    const account = {
      ...createEmptyAirwallexAccount('Mina Kato', 'mina@example.com', 'creator-select-airwallex'),
      nickname: '日本 JPY 主账户',
      isDefault: true,
      status: 'VERIFIED' as const,
      beneficiaryId: 'beneficiary-12345678',
      transferMethod: 'LOCAL' as const,
      bankDetails: {
        ...createEmptyAirwallexAccount().bankDetails,
        accountName: 'Mina Kato',
        accountNumber: '9876543210',
        accountCurrency: 'JPY',
        bankCountryCode: 'JP',
        bankCountryName: '日本',
        bankName: 'MUFG Bank',
        bankAccountCategory: 'SAVING',
        localClearingSystem: 'ZENGIN',
        swiftCode: 'BOTKJPJT',
      },
    };

    const presentation = getPayoutAccountSelectPresentation(account);
    expect(presentation.label).toBe('日本 JPY 主账户');
    expect(presentation.description).toBe('Airwallex · 9876543210');
    expect(presentation.badges.map((badge) => badge.label)).toEqual(['默认账户', '账户已验证']);
    expect(presentation.details).toEqual(expect.arrayContaining([
      { label: '账户主体', value: 'Mina Kato' },
      { label: '账户币种', value: 'JPY' },
      { label: '付款方式', value: '本地转账' },
      { label: '开户地区', value: '日本' },
      { label: '银行', value: 'MUFG Bank' },
      { label: '清算系统', value: 'ZENGIN' },
      { label: 'SWIFT', value: 'BOTKJPJT' },
      { label: 'Beneficiary', value: 'beneficiary-12345678' },
    ]));
    expect(JSON.stringify(presentation)).toContain('9876543210');
    expect(JSON.stringify(presentation)).toContain('beneficiary-12345678');
  });

  it('presents PayPal and PayerMax details with complete email and account values', () => {
    const paypal = {
      ...createEmptyPayPalAccount('Mina Kato', 'mina.kato@example.com', 'creator-select-paypal'),
      nickname: 'PayPal 主账户',
      paypalUsername: 'mina.paypal',
      paypalEmail: 'mina.kato@example.com',
      transferNote: 'Campaign payment',
      status: 'VALIDATED' as const,
    };
    const payermax = {
      ...createEmptyPayMaxAccount('Mina Kato', 'mina.kato@example.com', 'creator-select-payermax'),
      nickname: 'PayerMax 美元账户',
      beneficiaryName: 'Mina Kato',
      payermaxAccountId: 'payermax-87654321',
      countryCode: 'JP',
      currency: 'USD',
      email: 'mina.kato@example.com',
      status: 'VALIDATED' as const,
    };

    const presentations = [
      getPayoutAccountSelectPresentation(paypal),
      getPayoutAccountSelectPresentation(payermax),
    ];
    const serialized = JSON.stringify(presentations);
    expect(presentations[0].details).toEqual(expect.arrayContaining([
      { label: 'PayPal 用户名', value: 'mina.paypal' },
      { label: '收款邮箱', value: 'mina.kato@example.com' },
      { label: '转账备注', value: 'Campaign payment' },
    ]));
    expect(presentations[1].details).toEqual(expect.arrayContaining([
      { label: '收款人', value: 'Mina Kato' },
      { label: '收款币种', value: 'USD' },
      { label: '国家 / 地区', value: 'JP' },
      { label: '收款账号', value: 'payermax-87654321' },
      { label: '联系邮箱', value: 'mina.kato@example.com' },
    ]));
    expect(serialized).toContain('mina.kato@example.com');
    expect(serialized).toContain('payermax-87654321');
  });

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
    expect(payoutAccountToInvoicePayment(account).schemaFields)
      ?.toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'beneficiary.bank_details.account_number', required: true }),
      ]));
    expect(payoutAccountToInvoicePayment(account).schemaValues?.['beneficiary.bank_details.account_number'])
      .toBe(account.bankDetails.accountNumber);

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
