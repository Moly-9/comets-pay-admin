import { describe, expect, it } from 'vitest';
import {
  matchesRequestProjectStatusFilter,
  requestProjectStatusesForFilter,
} from './requestProjectStatusFilters';

describe('request project dashboard status filters', () => {
  it('expands each dashboard filter into the confirmed project statuses', () => {
    expect(requestProjectStatusesForFilter('all')).toEqual([]);
    expect(requestProjectStatusesForFilter('approving')).toEqual([
      '待审批',
      '请款提交',
      'PM 审批中',
      'PM审批中',
      'PM审批通过',
      '项目负责人审批中',
      '项目负责人审批通过',
      '老板审批中',
      '老板审批通过',
      '财务审批中',
    ]);
    expect(requestProjectStatusesForFilter('approved')).toEqual([
      '财务审批通过',
      '待打款',
      '已付款',
      '已完成',
    ]);
    expect(requestProjectStatusesForFilter('paid')).toEqual(['已付款', '已完成']);
  });

  it('matches both current approval labels and retained legacy labels', () => {
    expect(matchesRequestProjectStatusFilter('请款提交', 'approving')).toBe(true);
    expect(matchesRequestProjectStatusFilter('老板审批通过', 'approving')).toBe(true);
    expect(matchesRequestProjectStatusFilter('财务审批通过', 'approved')).toBe(true);
    expect(matchesRequestProjectStatusFilter('已付款', 'approved')).toBe(true);
    expect(matchesRequestProjectStatusFilter('已付款', 'paid')).toBe(true);
    expect(matchesRequestProjectStatusFilter('财务审批通过', 'paid')).toBe(false);
    expect(matchesRequestProjectStatusFilter('任意状态', 'all')).toBe(true);
  });
});
