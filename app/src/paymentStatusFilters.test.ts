import { describe, expect, it } from 'vitest';
import {
  ALL_PAYMENT_STATUSES,
  PAYMENT_STATUS_FILTER_OPTIONS,
  aggregatePaymentStatus,
  matchesPaymentStatus,
} from './paymentStatusFilters';

describe('payment status filters', () => {
  it('exposes the complete payment-status filter in the agreed order', () => {
    expect(PAYMENT_STATUS_FILTER_OPTIONS.map((option) => option.value)).toEqual([
      '全部付款状态',
      '付款处理中',
      '已付款',
      '部分失败',
      '全部失败',
    ]);
  });

  it('distinguishes processing, paid, partial failure, and complete failure', () => {
    expect(aggregatePaymentStatus(['付款处理中', '已付款'])).toBe('付款处理中');
    expect(aggregatePaymentStatus(['已付款', '已付款'])).toBe('已付款');
    expect(aggregatePaymentStatus(['已付款', '付款失败'])).toBe('部分失败');
    expect(aggregatePaymentStatus(['付款失败', '已退回'])).toBe('全部失败');
  });

  it('matches all statuses by default and exact statuses when selected', () => {
    expect(matchesPaymentStatus('部分失败', ALL_PAYMENT_STATUSES)).toBe(true);
    expect(matchesPaymentStatus('部分失败', '部分失败')).toBe(true);
    expect(matchesPaymentStatus('部分失败', '全部失败')).toBe(false);
  });
});
