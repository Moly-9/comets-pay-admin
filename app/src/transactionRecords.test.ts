import { describe, expect, it } from 'vitest';
import { INITIAL_PAYOUTS } from './data';
import type { PaymentBatchRecord } from './paymentBatches';
import type { Payout } from './types';
import {
  findTransactionBatchContext,
  filterTransactionRecords,
  isFinalTransaction,
  transactionCreatorLabel,
  transactionDateKey,
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
  }],
} as unknown as PaymentBatchRecord;

describe('transaction records', () => {
  it('keeps only approved final transactions for the selected tab', () => {
    const records = [
      payout(),
      payout({ id: 'failed', status: '付款失败', paidAt: undefined, paymentFailure: {
        provider: 'PayPal',
        errorCode: 'FAILED',
        providerResponse: 'failed',
        occurredAt: '2026-08-06T08:10:00.000Z',
      } }),
      payout({ id: 'processing', status: '付款处理中' }),
      payout({ id: 'unapproved', invoiceReviewStatus: '待发起请款' }),
    ];

    expect(filterTransactionRecords(records, filters()).map((record) => record.id)).toEqual(['pay-test', 'failed']);
    expect(filterTransactionRecords(records, filters({ tab: 'paid' })).map((record) => record.id)).toEqual(['pay-test']);
    expect(filterTransactionRecords(records, filters({ tab: 'failed' })).map((record) => record.id)).toEqual(['failed']);
  });

  it('combines search, provider, and inclusive date filters', () => {
    const records = [
      payout(),
      payout({ id: 'paypal', creator: 'Yuki Tanaka', handle: '@yuki.tokyo', provider: 'PayPal', paidAt: '2026-08-07 09:20' }),
    ];

    expect(filterTransactionRecords(records, filters({
      search: 'mina',
      provider: 'Airwallex',
      startDate: '2026-08-05',
      endDate: '2026-08-05',
    })).map((record) => record.id)).toEqual(['pay-test']);
    expect(filterTransactionRecords(records, filters({ search: 'paypal' })).map((record) => record.id)).toEqual(['paypal']);
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
    expect(transactionCreatorLabel(failed)).toBe('Mina Kato (@MinaKato)');
    expect(transactionCreatorLabel(payout({ creator: '@MinaKato' }))).toBe('@MinaKato');
  });

  it('matches stable batch context and searches request, batch, payer, and payment-list data', () => {
    expect(findTransactionBatchContext(payout(), [batch])?.batch.paymentBatchCode).toBe('PAY-20260810-TEST');
    expect(findTransactionBatchContext(payout({ id: 'other' }), [batch])).toBeNull();

    ['REQ-20260810-TEST', 'PAY-20260810-TEST', '财务测试员', 'PL-20260810-TEST'].forEach((search) => {
      expect(filterTransactionRecords([payout()], filters({ search }), [batch])).toHaveLength(1);
    });
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
