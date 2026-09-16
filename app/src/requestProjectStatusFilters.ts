import type { RequestProjectStatusFilter } from './types';

const REQUEST_PROJECT_STATUSES_BY_FILTER = {
  all: [],
  approving: [
    'PM审批中',
    '媒介负责人审批中',
    '老板审批中',
    '财务审批中',
  ],
  approved: ['正在付款', '付款处理中', '部分失败', '全部失败', '已付款'],
  'awaiting-payment': ['正在付款'],
  processing: ['付款处理中'],
  paid: ['已付款'],
  failed: ['部分失败', '全部失败'],
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
