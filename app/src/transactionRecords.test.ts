import { describe, expect, it } from 'vitest';
import { INITIAL_PAYOUTS } from './data';
import type { PaymentBatchRecord } from './paymentBatches';
import type { Payout } from './types';
import {
  createTransactionRecords,
  findTransactionBatchContext,
  filterTransactionRecords,
  isFinalTransaction,
  isPaymentTransactionRecord,
  transactionCreatorLabel,
  transactionDateKey,
  transactionPaymentStatus,
  transactionRecordDetails,
  type TransactionRecordFilters,
} from './transactionRecords';

const payout = (overrides: Partial<Payout> = {}): Payout => ({
  id: 'pay-test',
  creator: 'Mina Kato',
  handle: '@MinaKato',
  initials: 'MK',
  projectId: 'PRJ-20260801-TEST01',
  project: '夏季新品推广',
  contract: 'CON-20260801-TEST01',
  invoice: 'INV-20260801-TEST01',
  provider: 'Airwallex',
  currency: 'USD',
  amount: 1980,
  account: 'test-account',
  status: '已付款',
  invoiceReviewStatus: '已通过',
  accent: '#000000',
  paidAt: '2026-08-05 16:00',
  ...overrides,
});

const filters = (overrides: Partial<TransactionRecordFilters> = {}): TransactionRecordFilters => ({
  tab: 'all',
  search: '',
  provider: 'all',
  startDate: '',
  endDate: '',
  ...overrides,
});

const recordIds = (records: ReturnType<typeof createTransactionRecords>) => (
  records.map((record) => record.payout.id)
);

const batch = {
  paymentBatchId: 'payment-batch-test',
  paymentBatchCode: 'PAY-20260810-TEST',
  request: {
    paymentRequestProjectId: 'request-test',
    requestCode: 'REQ-20260810-TEST',
    requestStatus: '已付款',
    lifecycle: 'PAID',
    amount: 'USD 1,980',
    reason: '达人合作款',
    expectedPaymentDate: '2026-08-05',
    cooperationProjectId: 'project-test',
    cooperationProjectCode: 'PRJ-20260801-TEST01',
    cooperationProjectName: '夏季新品推广',
    brand: 'COMETS',
    media: 'Mina',
    pm: 'PM',
  },
  provider: 'Airwallex',
  fundingAccountId: 'mock-awx-operating',
  sourceCurrency: 'USD',
  payer: '财务测试员',
  paidAt: '2026-08-05 16:00',
  status: '已付款',
  lifecycle: ['COMPLETED'],
  items: [{
    payoutId: 'pay-test',
    paymentListCode: 'PL-20260810-TEST',
    provider: 'Airwallex',
    amount: 1980,
    currency: 'USD',
    receiveCurrency: 'USD',
    feeBearer: '广告主承担',
    paymentStatus: '已付款',
    paidAt: '2026-08-05 16:00',
  }],
} as unknown as PaymentBatchRecord;

describe('transaction records', () => {
  it('groups processing payments with the paid tab and supports its row-status filters', () => {
    const records = [
      payout(),
      payout({ id: 'failed', status: '付款失败', paidAt: undefined, paymentFailure: {
        provider: 'PayPal',
        errorCode: 'FAILED',
        providerResponse: 'failed',
        occurredAt: '2026-08-06T08:10:00.000Z',
      } }),
      payout({ id: 'processing', status: '付款处理中' }),
      payout({ id: 'unapproved', invoiceReviewStatus: '待媒介审核' }),
    ];

    const transactions = createTransactionRecords(records, []);
    expect(recordIds(filterTransactionRecords(transactions, filters()))).toEqual(['failed', 'pay-test', 'processing']);
    expect(recordIds(filterTransactionRecords(transactions, filters({ tab: 'paid' })))).toEqual(['pay-test', 'processing']);
    expect(recordIds(filterTransactionRecords(transactions, filters({ tab: 'paid', status: '已付款' })))).toEqual(['pay-test']);
    expect(recordIds(filterTransactionRecords(transactions, filters({ tab: 'paid', status: '付款处理中' })))).toEqual(['processing']);
    expect(recordIds(filterTransactionRecords(transactions, filters({ tab: 'failed' })))).toEqual(['failed']);
    expect(recordIds(filterTransactionRecords(transactions, filters({ tab: undefined, status: '付款处理中' })))).toEqual(['processing']);
    expect(recordIds(filterTransactionRecords(transactions, filters({ tab: undefined, status: '全部失败' })))).toEqual(['failed']);
    expect(records.filter(isPaymentTransactionRecord).map((record) => record.id)).toEqual(['pay-test', 'failed', 'processing']);
  });

  it('filters every transaction by its containing batch failure scope', () => {
    const failed = payout({ id: 'failed', status: '付款失败' });
    const partialBatch = {
      ...batch,
      status: '部分失败',
      items: [
        { ...batch.items[0], payoutId: 'pay-test', paymentStatus: '已付款' },
        { ...batch.items[0], payoutId: 'failed', paymentStatus: '付款失败' },
      ],
    } as unknown as PaymentBatchRecord;

    expect(recordIds(filterTransactionRecords(
      createTransactionRecords([payout(), failed], [partialBatch]),
      filters({ status: '部分失败' }),
    ))).toEqual(['pay-test', 'failed']);
  });

  it('combines search, provider, and inclusive date filters', () => {
    const records = [
      payout(),
      payout({ id: 'paypal', creator: 'Yuki Tanaka', handle: '@yuki.tokyo', provider: 'PayPal', paidAt: '2026-08-07 09:20' }),
    ];

    const transactions = createTransactionRecords(records, []);
    expect(recordIds(filterTransactionRecords(transactions, filters({
      search: 'mina',
      provider: 'Airwallex',
      startDate: '2026-08-05',
      endDate: '2026-08-05',
    })))).toEqual(['pay-test']);
    expect(recordIds(filterTransactionRecords(transactions, filters({ search: 'paypal' })))).toEqual(['paypal']);
  });

  it('uses the failure occurrence date and formats distinct creator handles', () => {
    const failed = payout({
      status: '付款失败',
      paidAt: undefined,
      paymentFailure: {
        provider: 'Airwallex',
        errorCode: 'FAILED',
        providerResponse: 'failed',
        occurredAt: '2026-08-04T08:10:00.000Z',
      },
    });

    expect(transactionDateKey(failed)).toBe('2026-08-04');
    expect(transactionCreatorLabel(failed)).toBe('Mina Kato (@MinaKato · 社媒平台待补充)');
    expect(transactionCreatorLabel(payout({ creator: '@MinaKato', creatorPlatform: 'Instagram' }))).toBe('@MinaKato · Instagram');
  });

  it('matches stable batch context and searches request, batch, payer, and payment-list data', () => {
    expect(findTransactionBatchContext(payout(), [batch])?.batch.paymentBatchCode).toBe('PAY-20260810-TEST');
    expect(findTransactionBatchContext(payout({ id: 'other' }), [batch])).toBeNull();

    ['REQ-20260810-TEST', 'PAY-20260810-TEST', '财务测试员', 'PL-20260810-TEST'].forEach((search) => {
      expect(filterTransactionRecords(
        createTransactionRecords([payout()], [batch]),
        filters({ search }),
      )).toHaveLength(1);
    });
  });

  it('uses the current payment attempt instead of an older failed batch', () => {
    const failedBatch = {
      ...batch,
      paymentBatchId: 'payment-batch-failed',
      paymentBatchCode: 'BAT-FAILED-001',
      status: '全部失败',
      items: [{ ...batch.items[0], paymentStatus: '付款失败' }],
    } as unknown as PaymentBatchRecord;
    const retryBatch = {
      ...batch,
      paymentBatchId: 'payment-batch-retry',
      paymentBatchCode: 'BAT-RETRY-002',
      status: '已付款',
      items: [{ ...batch.items[0], paymentStatus: '已付款' }],
    } as unknown as PaymentBatchRecord;
    const currentPayout = payout({
      currentPaymentAttempt: {
        paymentBatchId: retryBatch.paymentBatchId,
        paymentBatchCode: retryBatch.paymentBatchCode,
        submittedAt: retryBatch.paidAt,
      },
    });

    expect(findTransactionBatchContext(currentPayout, [failedBatch, retryBatch])?.batch.paymentBatchCode)
      .toBe('BAT-RETRY-002');
    expect(transactionRecordDetails(
      currentPayout,
      findTransactionBatchContext(currentPayout, [failedBatch, retryBatch]),
    ).paymentBatchCode).toBe('BAT-RETRY-002');
    expect(transactionPaymentStatus(currentPayout, [currentPayout], [failedBatch, retryBatch]))
      .toBe('已付款');
  });

  it('keeps a failed batch item and its successful retry as separate transaction rows', () => {
    const failedBatch = {
      ...batch,
      paymentBatchId: 'payment-batch-failed',
      paymentBatchCode: 'BAT-FAILED-001',
      paidAt: '2026-08-05T15:00:00.000Z',
      status: '全部失败',
      items: [{
        ...batch.items[0],
        paymentStatus: '付款失败',
        paidAt: '2026-08-05T15:05:00.000Z',
        transferFeeAmount: 6,
        transferFeeCurrency: 'USD',
        recipientReceivedAmount: 0,
        recipientReceivedCurrency: 'USD',
        failure: {
          code: 'BENEFICIARY_UNAVAILABLE',
          response: 'Beneficiary unavailable',
          occurredAt: '2026-08-05T15:05:00.000Z',
        },
      }],
    } as unknown as PaymentBatchRecord;
    const retryBatch = {
      ...batch,
      paymentBatchId: 'payment-batch-retry',
      paymentBatchCode: 'BAT-RETRY-002',
      paidAt: '2026-08-06T10:00:00.000Z',
      items: [{
        ...batch.items[0],
        paidAt: '2026-08-06T10:05:00.000Z',
        transferFeeAmount: 6,
        transferFeeCurrency: 'USD',
        recipientReceivedAmount: 1980,
        recipientReceivedCurrency: 'USD',
      }],
    } as unknown as PaymentBatchRecord;

    const records = createTransactionRecords([payout()], [failedBatch, retryBatch]);

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.context?.batch.paymentBatchCode)).toEqual([
      'BAT-RETRY-002',
      'BAT-FAILED-001',
    ]);
    expect(records.map((record) => record.status)).toEqual(['已付款', '付款失败']);
    expect(records.map((record) => record.recipientReceivedAmount)).toEqual([1980, 0]);
    expect(new Set(records.map((record) => record.key)).size).toBe(2);
  });

  it('derives successful recipient amounts from each fee-bearer snapshot', () => {
    const feePayouts = [
      payout({ id: 'advertiser' }),
      payout({ id: 'publisher' }),
      payout({ id: 'shared' }),
    ];
    const feeBatch = {
      ...batch,
      items: [
        { ...batch.items[0], payoutId: 'advertiser', amount: 100, transferFeeAmount: 10, transferFeeCurrency: 'USD', feeBearer: '广告主承担' },
        { ...batch.items[0], payoutId: 'publisher', amount: 100, transferFeeAmount: 10, transferFeeCurrency: 'USD', feeBearer: '收款人承担' },
        { ...batch.items[0], payoutId: 'shared', amount: 100, transferFeeAmount: 10, transferFeeCurrency: 'USD', feeBearer: '共同承担' },
      ],
    } as unknown as PaymentBatchRecord;

    expect(createTransactionRecords(feePayouts, [feeBatch]).map((record) => (
      record.recipientReceivedAmount
    ))).toEqual([100, 90, 95]);
  });

  it('provides complete historical snapshots for every current legacy transaction', () => {
    const historicalTransactions = INITIAL_PAYOUTS.filter(isFinalTransaction);

    expect(historicalTransactions).toHaveLength(10);
    historicalTransactions.forEach((record) => {
      const details = transactionRecordDetails(record, null);
      const requiredValues = [
        details.payer,
        details.paymentTime,
        details.paymentBatchCode,
        details.requestCode,
        details.requestReason,
        details.transferMethod,
        details.accountSummary,
        details.feeBearer,
        details.transactionReference,
        details.paymentListCode,
      ];

      expect(details.source).toBe('historical');
      expect(requiredValues.every((value) => value && !/未记录|未关联|待补全/.test(value))).toBe(true);
      expect(details.contracts).toHaveLength(1);
      expect(details.invoice?.invoiceNumber).toBe(record.invoice);
    });
  });
});
