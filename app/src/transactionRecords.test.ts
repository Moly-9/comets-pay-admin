import { describe, expect, it } from 'vitest';
import type { Payout } from './types';
import {
  filterTransactionRecords,
  transactionCreatorLabel,
  transactionDateKey,
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
});
