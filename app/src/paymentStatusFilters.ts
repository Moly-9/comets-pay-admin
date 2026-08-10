export const ALL_PAYMENT_STATUSES = '全部付款状态' as const;

export type PaymentAggregateStatus = '付款处理中' | '已付款' | '部分失败' | '全部失败';
export type PaymentStatusFilter = typeof ALL_PAYMENT_STATUSES | PaymentAggregateStatus;

export const PAYMENT_STATUS_FILTER_OPTIONS = [
  { value: ALL_PAYMENT_STATUSES, label: ALL_PAYMENT_STATUSES },
  { value: '付款处理中', label: '付款处理中' },
  { value: '已付款', label: '已付款' },
  { value: '部分失败', label: '部分失败' },
  { value: '全部失败', label: '全部失败' },
] as const satisfies ReadonlyArray<{ value: PaymentStatusFilter; label: string }>;

const isFailedStatus = (status: string) => (
  status === '付款失败'
  || status === '已退回'
  || status === '全部失败'
);

export const aggregatePaymentStatus = (
  statuses: readonly string[],
  fallback: PaymentAggregateStatus = '付款处理中',
): PaymentAggregateStatus => {
  if (!statuses.length) return fallback;
  if (statuses.some((status) => status === '部分失败')) return '部分失败';

  const failedCount = statuses.filter(isFailedStatus).length;
  if (failedCount === statuses.length) return '全部失败';
  if (failedCount > 0) return '部分失败';
  if (statuses.every((status) => status === '已付款')) return '已付款';
  return '付款处理中';
};

export const matchesPaymentStatus = (
  status: PaymentAggregateStatus,
  filter: PaymentStatusFilter,
) => filter === ALL_PAYMENT_STATUSES || status === filter;
