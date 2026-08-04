import type {
  GeneratedInvoiceRecord,
  InvoiceReviewEvent,
  InvoiceReviewStage,
  InvoiceReviewStatus,
  Payout,
} from '../types';

export type InvoiceReviewAction =
  | 'MARK_SIGNED'
  | 'APPROVE_MEDIA'
  | 'RETURN_MEDIA'
  | 'APPROVE_FINANCE'
  | 'RETURN_FINANCE'
  | 'RESUBMIT';

export type InvoiceReviewActor = {
  account: string;
  name: string;
  role: string;
};

export type InvoiceReviewCapabilities = {
  manage: boolean;
  mediaReview: boolean;
  financeReview: boolean;
};

export const INVOICE_REVIEW_STATUS_META: Record<
  InvoiceReviewStatus,
  { label: string; color: string }
> = {
  待签署: { label: '待签署', color: '#8b5cf6' },
  待媒介审核: { label: '待媒介审核', color: '#f59e0b' },
  待财务审核: { label: '待财务审核', color: '#3b82f6' },
  待修改: { label: '待修改', color: '#e8792e' },
  已通过: { label: '已通过', color: '#22c55e' },
  已退回: { label: '已退回', color: '#ef4444' },
};

const TRANSITIONS: Record<
  InvoiceReviewAction,
  {
    from: InvoiceReviewStatus[];
    to: InvoiceReviewStatus;
    stage: InvoiceReviewStage;
    label: InvoiceReviewEvent['action'];
  }
> = {
  MARK_SIGNED: {
    from: ['待签署'],
    to: '待媒介审核',
    stage: 'SIGNATURE',
    label: '签署完成',
  },
  APPROVE_MEDIA: {
    from: ['待媒介审核'],
    to: '待财务审核',
    stage: 'MEDIA',
    label: '审核通过',
  },
  RETURN_MEDIA: {
    from: ['待媒介审核'],
    to: '待修改',
    stage: 'MEDIA',
    label: '退回',
  },
  APPROVE_FINANCE: {
    from: ['待财务审核'],
    to: '已通过',
    stage: 'FINANCE',
    label: '审核通过',
  },
  RETURN_FINANCE: {
    from: ['待财务审核'],
    to: '已退回',
    stage: 'FINANCE',
    label: '退回',
  },
  RESUBMIT: {
    from: ['待修改', '已退回'],
    to: '待媒介审核',
    stage: 'MEDIA',
    label: '重新提交',
  },
};

export const getAvailableInvoiceReviewActions = (
  status: InvoiceReviewStatus,
  capabilities: InvoiceReviewCapabilities,
): InvoiceReviewAction[] => {
  if (status === '待签署') return capabilities.manage ? ['MARK_SIGNED'] : [];
  if (status === '待媒介审核') {
    return capabilities.mediaReview ? ['APPROVE_MEDIA', 'RETURN_MEDIA'] : [];
  }
  if (status === '待财务审核') {
    return capabilities.financeReview ? ['APPROVE_FINANCE', 'RETURN_FINANCE'] : [];
  }
  if (status === '待修改' || status === '已退回') {
    return capabilities.manage ? ['RESUBMIT'] : [];
  }
  return [];
};

export const createInvoiceReviewEvent = (
  currentStatus: InvoiceReviewStatus,
  action: InvoiceReviewAction,
  actor: InvoiceReviewActor,
  reason?: string,
  occurredAt = new Date().toISOString(),
): InvoiceReviewEvent => {
  const transition = TRANSITIONS[action];
  if (!transition.from.includes(currentStatus)) {
    throw new Error(`Invoice 状态“${currentStatus}”不能执行该操作。`);
  }
  const normalizedReason = reason?.trim();
  if ((action === 'RETURN_MEDIA' || action === 'RETURN_FINANCE') && !normalizedReason) {
    throw new Error('退回 Invoice 时必须填写原因。');
  }

  return {
    stage: transition.stage,
    action: transition.label,
    actorAccount: actor.account,
    actorName: actor.name,
    actorRole: actor.role,
    fromStatus: currentStatus,
    toStatus: transition.to,
    reason: normalizedReason,
    occurredAt,
  };
};

export const applyInvoiceReviewAction = (
  payout: Payout,
  action: Exclude<InvoiceReviewAction, 'MARK_SIGNED'>,
  actor: InvoiceReviewActor,
  reason?: string,
  occurredAt = new Date().toISOString(),
): Payout => {
  const event = createInvoiceReviewEvent(
    payout.invoiceReviewStatus,
    action,
    actor,
    reason,
    occurredAt,
  );
  const isReturn = action === 'RETURN_MEDIA' || action === 'RETURN_FINANCE';
  const isResubmission = action === 'RESUBMIT';

  return {
    ...payout,
    status: event.toStatus === '已通过' ? '等待付款' : '未进入付款',
    invoiceReviewStatus: event.toStatus,
    invoiceReviewHistory: [...(payout.invoiceReviewHistory ?? []), event],
    invoiceReviewReturn: isReturn
      ? {
          stage: event.stage as Exclude<InvoiceReviewStage, 'SIGNATURE'>,
          reason: event.reason ?? '',
          actorName: actor.name,
          occurredAt,
        }
      : isResubmission
        ? undefined
        : payout.invoiceReviewReturn,
    issue: isReturn
      ? `${event.stage === 'MEDIA' ? '媒介审核' : '财务审核'}退回：${event.reason}`
      : undefined,
    returnReason: isReturn ? event.reason : isResubmission ? undefined : payout.returnReason,
  };
};

export const markGeneratedInvoiceSigned = (
  payout: Payout,
  record: GeneratedInvoiceRecord,
  actor: InvoiceReviewActor,
  occurredAt = new Date().toISOString(),
): Payout => {
  if (record.sourcePayoutId !== payout.id) {
    throw new Error('生成记录与付款记录的稳定关联不一致。');
  }
  const event = createInvoiceReviewEvent(
    record.status,
    'MARK_SIGNED',
    actor,
    undefined,
    occurredAt,
  );
  return {
    ...payout,
    invoice: record.id,
    invoiceSnapshot: record.snapshot,
    status: '未进入付款',
    invoiceReviewStatus: event.toStatus,
    invoiceReviewHistory: [...(payout.invoiceReviewHistory ?? []), event],
    invoiceReviewReturn: undefined,
    issue: undefined,
    returnReason: undefined,
  };
};

export const isInvoiceApprovedForPayment = (
  payout: Pick<Payout, 'invoiceReviewStatus'>,
) => payout.invoiceReviewStatus === '已通过';

export const isPayoutEligibleForBatch = (
  payout: Pick<Payout, 'invoiceReviewStatus' | 'status'>,
) => isInvoiceApprovedForPayment(payout) && payout.status === '等待付款';
