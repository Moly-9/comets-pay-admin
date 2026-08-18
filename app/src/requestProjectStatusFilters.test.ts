import { describe, expect, it } from 'vitest';
import {
  matchesRequestProjectStatusFilter,
  requestProjectStatusesForFilter,
} from './requestProjectStatusFilters';

describe('request project dashboard status filters', () => {
  it('expands each dashboard filter into the confirmed project statuses', () => {
    expect(requestProjectStatusesForFilter('all')).toEqual([]);
    expect(requestProjectStatusesForFilter('approving')).toEqual([
      'PM审批中',
      '项目负责人审批中',
      '老板审批中',
      '财务审批中',
    ]);
    expect(requestProjectStatusesForFilter('approved')).toEqual([
      '正在付款',
      '付款处理中',
      '已付款',
    ]);
    expect(requestProjectStatusesForFilter('paid')).toEqual(['已付款']);
  });

  it('matches the current approval and payment lifecycle labels', () => {
    expect(matchesRequestProjectStatusFilter('PM审批中', 'approving')).toBe(true);
    expect(matchesRequestProjectStatusFilter('老板审批中', 'approving')).toBe(true);
    expect(matchesRequestProjectStatusFilter('正在付款', 'approved')).toBe(true);
    expect(matchesRequestProjectStatusFilter('付款处理中', 'approved')).toBe(true);
    expect(matchesRequestProjectStatusFilter('已付款', 'approved')).toBe(true);
    expect(matchesRequestProjectStatusFilter('已付款', 'paid')).toBe(true);
    expect(matchesRequestProjectStatusFilter('正在付款', 'paid')).toBe(false);
    expect(matchesRequestProjectStatusFilter('任意状态', 'all')).toBe(true);
  });
});
