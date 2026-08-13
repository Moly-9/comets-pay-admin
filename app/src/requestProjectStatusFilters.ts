import type { RequestProjectStatusFilter } from './types';

const REQUEST_PROJECT_STATUSES_BY_FILTER = {
  all: [],
  approving: [
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
  ],
  approved: ['财务审批通过', '待打款', '已付款', '已完成'],
  paid: ['已付款', '已完成'],
} as const satisfies Record<RequestProjectStatusFilter, readonly string[]>;

export const requestProjectStatusesForFilter = (
  filter: RequestProjectStatusFilter,
): string[] => [...REQUEST_PROJECT_STATUSES_BY_FILTER[filter]];

export const matchesRequestProjectStatusFilter = (
  status: string,
  filter: RequestProjectStatusFilter,
) => {
  const statuses = REQUEST_PROJECT_STATUSES_BY_FILTER[filter];
  return filter === 'all' || statuses.some((candidate) => candidate === status);
};
