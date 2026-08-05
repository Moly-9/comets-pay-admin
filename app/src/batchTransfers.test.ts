import { describe, expect, it } from 'vitest';
import {
  airwallexFeeOptions,
  createMockBatchSubmission,
  executeMockBatchSubmission,
} from './batchTransfers';
import type { Payout } from './types';

const payment = {
  bankCountry: 'United States',
  accountName: 'Synthetic Creator',
  accountType: 'Checking',
  swiftCode: 'SYNTHUS1',
  accountNumber: '0000000001',
  iban: '',
  beneficiaryType: 'PERSONAL',
  bankName: 'Synthetic Bank',
  bankStreetAddress: '1 Test Street',
  bankCity: 'Test City',
  bankState: 'CA',
  bankPostalCode: '00000',
  intermediaryBankCountry: '',
  intermediaryBankCode: '',
  transferRemarks: '',
  paypalUsername: '',
  paypalEmail: '',
  creatorId: 'creator-1',
  payoutAccountId: 'account-1',
  payoutAccountVersion: 'v1' as const,
  payoutProvider: 'Airwallex' as const,
  providerAccountScope: 'mock:default',
  externalBeneficiaryId: 'beneficiary-1',
  accountFingerprint: 'fp_account_1',
  transferMethod: 'LOCAL' as const,
  localClearingSystem: 'ACH',
  accountCurrency: 'USD',
  schemaKey: 'BANK_ACCOUNT:US:USD:PERSONAL:LOCAL:ACH',
  validationStatus: 'VERIFIED' as const,
};

const payout = (overrides: Partial<Payout> = {}): Payout => ({
  id: 'payout-1',
  creator: 'Synthetic Creator',
  creatorId: 'creator-1' as Payout['creatorId'],
  handle: '@synthetic',
  initials: 'SC',
  projectId: 'project-1',
  project: 'Synthetic Project',
  contract: 'CON-001',
  invoice: 'INV-001',
  provider: 'Airwallex',
  currency: 'USD',
  amount: 300,
  account: '•••• 0001',
  payoutAccountId: 'account-1',
  payoutAccountVersion: 'v1',
  payoutAccountFingerprint: 'fp_account_1',
  externalBeneficiaryId: 'beneficiary-1',
  transferMethod: 'LOCAL',
  localClearingSystem: 'ACH',
  feeBearer: 'ADVERTISER',
  status: '等待付款',
  invoiceReviewStatus: '已通过',
  invoiceSnapshot: {
    invoiceNumber: 'INV-001',
    invoiceDate: '2026-08-05',
    billTo: { name: 'Advertiser', address: 'Test Address' },
    creatorHandle: '@synthetic',
    creatorName: 'Synthetic Creator',
    creatorId: 'creator-1' as NonNullable<Payout['creatorId']>,
    projectId: 'project-1' as NonNullable<Payout['invoiceSnapshot']>['projectId'],
    projectName: 'Synthetic Project',
    from: {
      legalName: 'Synthetic Creator',
      address: 'Creator Address',
      phone: '+0 000',
      email: 'creator@example.invalid',
    },
    currency: 'USD',
    items: [{
      id: 'line-1',
      description: 'Service fee',
      unitPrice: 300,
      quantity: 1,
      lineTotal: 300,
    }],
    payoutAccountId: 'account-1',
    payoutAccountVersion: 'v1',
    payoutProvider: 'Airwallex',
    payoutAccountFingerprint: 'fp_account_1',
    paymentMethod: 'bank',
    payment,
  },
  accent: '#64748b',
  ...overrides,
});

describe('batch transfer contract', () => {
  it('maps LOCAL and SWIFT fee rules exactly', () => {
    expect(airwallexFeeOptions('LOCAL', 'PUBLISHER')).toEqual({ feePaidBy: 'PAYER' });
    expect(airwallexFeeOptions('SWIFT', 'ADVERTISER')).toEqual({
      feePaidBy: 'PAYER',
      swiftChargeOption: 'PAYER',
    });
    expect(airwallexFeeOptions('SWIFT', 'PUBLISHER')).toEqual({
      feePaidBy: 'BENEFICIARY',
      swiftChargeOption: 'SHARED',
    });
    expect(airwallexFeeOptions('SWIFT', 'SHARED')).toEqual({
      feePaidBy: 'PAYER',
      swiftChargeOption: 'SHARED',
    });
  });

  it('uses Invoice amount as transfer_amount and runs the mock lifecycle', () => {
    const submission = createMockBatchSubmission({
      payouts: [payout()],
      provider: 'Airwallex',
      fundingAccountId: 'mock-funding',
      sourceCurrency: 'EUR',
    });
    const execution = executeMockBatchSubmission(submission);

    expect(submission.items[0]).toMatchObject({
      transferAmount: 300,
      transferCurrency: 'USD',
      feePaidBy: 'PAYER',
      localClearingSystem: 'ACH',
    });
    expect(submission.items[0]).not.toHaveProperty('swiftChargeOption');
    expect(submission.sourceCurrency).toBe('EUR');
    expect(execution.lifecycle).toEqual(['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED']);
    expect(execution.simulated).toBe(true);
  });

  it('blocks the whole batch when providers are mixed or fee data is missing', () => {
    const paypalInvoice = payout({
      id: 'payout-2',
      provider: 'PayPal',
      invoice: 'INV-002',
    });
    paypalInvoice.invoiceSnapshot = {
      ...paypalInvoice.invoiceSnapshot!,
      payoutProvider: 'PayPal',
      paymentMethod: 'paypal',
      payment: {
        ...paypalInvoice.invoiceSnapshot!.payment,
        payoutProvider: 'PayPal',
        transferMethod: 'PAYPAL',
        paypalUsername: 'synthetic.creator',
        paypalEmail: 'creator@example.invalid',
      },
    };
    expect(() => createMockBatchSubmission({
      payouts: [payout(), paypalInvoice],
      provider: 'Airwallex',
      fundingAccountId: 'mock-funding',
      sourceCurrency: 'USD',
    })).toThrow('INV-002');

    expect(() => createMockBatchSubmission({
      payouts: [payout({ feeBearer: '' })],
      provider: 'Airwallex',
      fundingAccountId: 'mock-funding',
      sourceCurrency: 'USD',
    })).toThrow('手续费承担方');
  });

  it('keeps PayPal Transfer Note in a separate PayPal batch', () => {
    const paypalPayment = {
      ...payment,
      payoutProvider: 'PayPal' as const,
      transferMethod: 'PAYPAL' as const,
      externalBeneficiaryId: undefined,
      paypalUsername: 'synthetic.creator',
      paypalEmail: 'creator@example.invalid',
      transferRemarks: 'Campaign IO-001',
    };
    const paypalPayout = payout({
      provider: 'PayPal',
      transferMethod: 'PAYPAL',
      externalBeneficiaryId: undefined,
      invoiceSnapshot: {
        ...payout().invoiceSnapshot!,
        payoutProvider: 'PayPal',
        paymentMethod: 'paypal',
        payment: paypalPayment,
      },
    });
    const submission = createMockBatchSubmission({
      payouts: [paypalPayout],
      provider: 'PayPal',
      fundingAccountId: 'mock-paypal',
      sourceCurrency: 'USD',
    });

    expect(submission.items[0]).toMatchObject({
      provider: 'PayPal',
      paypalEmail: 'creator@example.invalid',
      transferNote: 'Campaign IO-001',
    });
    expect(submission.items[0]).not.toHaveProperty('feePaidBy');
  });
});
