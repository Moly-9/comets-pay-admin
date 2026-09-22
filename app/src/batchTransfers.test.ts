import { describe, expect, it } from 'vitest';
import {
  airwallexFeeOptions,
  createMockBatchSubmission,
  executeMockBatchSubmission,
  resolvePaymentFailureSourceBatch,
  retryExecutionAccountFor,
  selectBatchWizardPayouts,
  validatePayoutForBatch,
  validateRetryExecutionAccount,
} from './batchTransfers';
import type { PaymentBatchId } from './businessWorkflow';
import type { PaymentBatchRecord } from './paymentBatches';
import type { PayPalPayoutAccount, Payout } from './types';

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

const retrySubmissionSource = {
  sourcePaymentBatchId: 'payment-batch-source' as PaymentBatchId,
  sourcePaymentBatchCode: 'BAT-20260918-001',
  sourcePaymentOrderCode: 'PAY-2609180001',
  paymentAttemptNumber: 2,
};

describe('batch transfer contract', () => {
  it('validates the target creator account and freezes a different retry provider', () => {
    const paypal: PayPalPayoutAccount = {
      id: 'paypal-creator-1', creatorId: 'creator-1', provider: 'PayPal',
      nickname: 'PayPal 演示账户', isDefault: false, status: 'VERIFIED',
      paypalUsername: 'synthetic.creator', paypalEmail: 'creator@example.test',
      payoutAccountId: 'paypal-creator-1', payoutAccountVersion: 'v2',
      accountFingerprint: 'fp_paypal_v2',
    };
    expect(validateRetryExecutionAccount(paypal, 'creator-1', 'PayPal')).toBe('');
    expect(validateRetryExecutionAccount(paypal, 'creator-2', 'PayPal')).toContain('不属于');
    expect(validateRetryExecutionAccount(paypal, 'creator-1', 'Airwallex')).toContain('不一致');
    expect(validateRetryExecutionAccount({ ...paypal, status: 'INVALID' }, 'creator-1', 'PayPal')).toContain('尚未验证');
    expect(validateRetryExecutionAccount({ ...paypal, paypalEmail: '' }, 'creator-1', 'PayPal')).toContain('不完整');
    const source = payout({ paymentRequestProjectId: 'request-1' as Payout['paymentRequestProjectId'] });
    const submission = createMockBatchSubmission({
      payouts: [source], provider: 'PayPal', fundingAccountId: 'mock-paypal-balance',
      sourceCurrency: 'USD', ...retrySubmissionSource,
      executionAccountsByPayoutId: { [source.id]: retryExecutionAccountFor(paypal, 'creator-1') },
    });
    expect(submission.items[0]).toMatchObject({
      provider: 'PayPal', payoutAccountId: 'paypal-creator-1',
      accountFingerprint: 'fp_paypal_v2', paypalEmail: 'creator@example.test',
      transferMethod: 'PAYPAL', accountSummary: 'creator@example.test',
    });
    expect(source.provider).toBe('Airwallex');
    expect(source.invoiceSnapshot?.payoutProvider).toBe('Airwallex');
    const incompleteNewAccount = {
      ...retryExecutionAccountFor(paypal, 'creator-1').snapshot,
      payoutProvider: 'Airwallex' as const,
      transferMethod: 'LOCAL' as const,
      externalBeneficiaryId: undefined,
      localClearingSystem: undefined,
    };
    expect(validatePayoutForBatch(source, 'Airwallex', source.feeBearer, incompleteNewAccount))
      .toContain('缺少 Airwallex beneficiary_id');
    expect(validatePayoutForBatch(source, 'Airwallex', source.feeBearer, incompleteNewAccount))
      .toContain('LOCAL 付款缺少本地清算方式');
  });
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
      ...retrySubmissionSource,
    });
    const execution = executeMockBatchSubmission(submission);

    expect(submission.items[0]).toMatchObject({
      transferAmount: 300,
      transferCurrency: 'USD',
      feeBearer: 'ADVERTISER',
      feePaidBy: 'PAYER',
      localClearingSystem: 'ACH',
    });
    expect(submission.items[0]).not.toHaveProperty('swiftChargeOption');
    expect(submission.sourceCurrency).toBe('EUR');
    expect(submission).toMatchObject(retrySubmissionSource);
    expect(execution.lifecycle).toEqual(['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED']);
    expect(execution.simulated).toBe(true);
  });

  it('lists only real unfinished payment failures without fabricating demo states', () => {
    const awaitingUpdate = payout({
      id: 'awaiting-update',
      status: '已退回',
      paymentFailureReturn: {
        issueType: 'PAYMENT_LIST',
        reason: '请确认收款账户',
        actorAccount: 'finance',
        actorName: '财务',
        occurredAt: '2026-09-18T10:00:00.000Z',
        restartStage: 'PAYMENT_LIST_RESUBMISSION',
      },
      paymentFailureRecovery: { status: 'AWAITING_CREATOR_UPDATE', notifications: [] },
    });
    const retrySucceeded = payout({
      id: 'retry-succeeded',
      status: '已付款',
      paymentFailureRecovery: { status: 'RETRY_SUCCEEDED', notifications: [] },
    });
    const returnedWithoutRecovery = payout({
      ...awaitingUpdate,
      id: 'legacy-returned',
      paymentFailureRecovery: undefined,
    });

    const selected = selectBatchWizardPayouts([
      payout({ id: 'normal' }),
      payout({ id: 'raw-failure', status: '付款失败' }),
      awaitingUpdate,
      returnedWithoutRecovery,
      retrySucceeded,
    ]);

    expect(selected.map((item) => item.id)).toEqual(['raw-failure', 'awaiting-update', 'legacy-returned']);
    expect(selected[0].paymentFailureRecovery).toBeUndefined();
  });

  it('resolves a stable failed source batch and rejects ambiguous matches', () => {
    const failed = payout({ id: 'failed', status: '付款失败' });
    const source = {
      paymentBatchId: 'payment-batch-source' as PaymentBatchId,
      paymentBatchCode: 'BAT-20260918-001',
      purpose: 'NORMAL',
      paymentAttemptNumber: 1,
      items: [{ payoutId: failed.id, paymentStatus: '付款失败' }],
    } as unknown as PaymentBatchRecord;
    const duplicate = {
      ...source,
      paymentBatchId: 'payment-batch-duplicate' as PaymentBatchId,
      paymentBatchCode: 'BAT-20260918-002',
    };

    expect(resolvePaymentFailureSourceBatch(failed, [source])).toEqual({ batch: source });
    expect(resolvePaymentFailureSourceBatch(failed, [source, duplicate])).toEqual({
      issue: '原付款批次无法唯一确认',
    });

    const retryFailed = payout({
      id: failed.id,
      status: '付款失败',
      currentPaymentAttempt: {
        paymentBatchId: 'payment-batch-retry' as PaymentBatchId,
        paymentBatchCode: 'BAT-20260919-001',
        submittedAt: '2026-09-19T10:00:00.000Z',
        attemptNumber: 2,
      },
    });
    const retrySource = {
      ...source,
      paymentBatchId: retryFailed.currentPaymentAttempt!.paymentBatchId,
      paymentBatchCode: retryFailed.currentPaymentAttempt!.paymentBatchCode,
      paymentAttemptNumber: 2,
      purpose: 'RETRY' as const,
    };
    expect(resolvePaymentFailureSourceBatch(retryFailed, [source, retrySource])).toEqual({
      batch: retrySource,
    });
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
      ...retrySubmissionSource,
    })).toThrow('INV-002');

    expect(() => createMockBatchSubmission({
      payouts: [payout({ feeBearer: '' })],
      provider: 'Airwallex',
      fundingAccountId: 'mock-funding',
      sourceCurrency: 'USD',
      ...retrySubmissionSource,
    })).toThrow('手续费承担方');
  });

  it('uses a batch-only fee bearer override without mutating the source payout', () => {
    const source = payout({ feeBearer: '' });
    const submission = createMockBatchSubmission({
      payouts: [source],
      provider: 'Airwallex',
      fundingAccountId: 'mock-funding',
      sourceCurrency: 'USD',
      ...retrySubmissionSource,
      feeBearerByPayoutId: { [source.id]: 'PUBLISHER' },
    });

    expect(submission.items[0]).toMatchObject({
      feeBearer: 'PUBLISHER',
      feePaidBy: 'PAYER',
    });
    expect(source.feeBearer).toBe('');
  });

  it('rejects payouts from different request projects before submission', () => {
    expect(() => createMockBatchSubmission({
      payouts: [
        payout({ paymentRequestProjectId: 'request-1' as Payout['paymentRequestProjectId'] }),
        payout({ id: 'payout-2', paymentRequestProjectId: 'request-2' as Payout['paymentRequestProjectId'] }),
      ],
      provider: 'Airwallex',
      fundingAccountId: 'mock-funding',
      sourceCurrency: 'USD',
      ...retrySubmissionSource,
    })).toThrow('一个付款批次只能关联一个请款项目');
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
      ...retrySubmissionSource,
    });

    expect(submission.items[0]).toMatchObject({
      provider: 'PayPal',
      paypalEmail: 'creator@example.invalid',
      transferNote: 'Campaign IO-001',
    });
    expect(submission.items[0]).not.toHaveProperty('feePaidBy');
  });
});
