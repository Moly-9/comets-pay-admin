import { describe, expect, it } from 'vitest';
import {
  aggregatePayoutCurrencies,
  getPaymentCurrencyOverviews,
  sortPaymentCurrencyItems,
} from './paymentCurrencyOverview';
import type { Payout } from './types';

type OverviewPayout = Pick<
  Payout,
  'amount' | 'currency' | 'invoiceReviewStatus' | 'paidAt' | 'status'
>;

const payout = (overrides: Partial<OverviewPayout> = {}): OverviewPayout => ({
  amount: 100,
  currency: 'USD',
  invoiceReviewStatus: '已通过',
  status: '等待付款',
  ...overrides,
});

describe('payment currency overview', () => {
  it('aggregates amounts and counts by currency', () => {
    expect(aggregatePayoutCurrencies([
      payout({ amount: 120 }),
      payout({ amount: 80 }),
      payout({ amount: 240, currency: 'EUR' }),
    ])).toEqual([
      { currency: 'USD', amount: 200, count: 2 },
      { currency: 'EUR', amount: 240, count: 1 },
    ]);
  });

  it('filters pending and current-month paid payouts by approval and status', () => {
    const overview = getPaymentCurrencyOverviews([
      payout({ amount: 120, status: '等待付款' }),
      payout({ amount: 80, status: '付款处理中' }),
      payout({ amount: 500, currency: 'EUR', invoiceReviewStatus: '待媒介审核' }),
      payout({ amount: 300, currency: 'GBP', status: '已付款', paidAt: '2026-08-08 12:30' }),
      payout({ amount: 400, currency: 'HKD', status: '已付款', paidAt: '2026-07-31 23:59' }),
      payout({ amount: 200, currency: 'SGD', status: '付款失败', paidAt: '2026-08-08 12:30' }),
    ], new Date('2026-08-09T00:00:00.000Z'));

    expect(overview.pending).toEqual([
      { currency: 'USD', amount: 200, count: 2 },
    ]);
    expect(overview.paid).toEqual([
      { currency: 'USD', amount: 0, count: 0 },
      { currency: 'GBP', amount: 300, count: 1 },
    ]);
  });

  it('uses Asia/Shanghai month boundaries for timestamps with explicit zones', () => {
    const overview = getPaymentCurrencyOverviews([
      payout({ status: '已付款', paidAt: '2026-07-31T16:00:00.000Z' }),
      payout({ currency: 'EUR', status: '已付款', paidAt: '2026-08-31T16:00:00.000Z' }),
    ], new Date('2026-08-09T00:00:00.000Z'));

    expect(overview.paid).toEqual([
      { currency: 'USD', amount: 100, count: 1 },
    ]);
  });

  it('sorts supported currencies first and future currencies alphabetically', () => {
    const items = ['JPY', 'SGD', 'GBP', 'AUD', 'USD', 'HKD', 'EUR'].map((currency) => ({
      currency,
      amount: 1,
      count: 1,
    }));

    expect(sortPaymentCurrencyItems(items).map((item) => item.currency)).toEqual([
      'USD', 'EUR', 'GBP', 'HKD', 'SGD', 'AUD', 'JPY',
    ]);
  });

  it('adds a zero-value USD primary item when no USD payout exists', () => {
    const overview = getPaymentCurrencyOverviews([
      payout({ currency: 'EUR', amount: 260 }),
    ], new Date('2026-08-09T00:00:00.000Z'));

    expect(overview.pending[0]).toEqual({ currency: 'USD', amount: 0, count: 0 });
    expect(overview.pending[1]).toEqual({ currency: 'EUR', amount: 260, count: 1 });
  });
});
