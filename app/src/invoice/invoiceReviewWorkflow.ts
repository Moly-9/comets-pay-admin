import type {
  GeneratedInvoiceRecord,
  InvoiceReviewEvent,
  InvoiceReviewStage,
  InvoiceReviewStatus,
  PaymentFailureIssueType,
  Payout,
  PayoutStatus,
} from '../types';

export type InvoiceReviewAction =
  | 'MARK_SIGNED'
  | 'RECORD_CREATOR_FEEDBACK'
  | 'RESEND_FOR_SIGNATURE'
  | 'APPROVE_MEDIA'
  | 'RETURN_TO_CREATOR'
  | 'RESTART_AFTER_PAYMENT_FAILURE';

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

export type InvoicePageTab = 'signature' | 'media-review' | 'approval' | 'approved' | 'returned';
export type InvoiceDetailNavigationTarget = 'PROJECT' | 'REQUEST' | 'PAYMENT';
export type ApprovedInvoicePaymentStatus = Extract<
  PayoutStatus,
  '等待付款' | '付款处理中' | '已付款' | '付款失败'
>;

export const APPROVED_INVOICE_PAYMENT_STATUS_LABEL: Record<
  ApprovedInvoicePaymentStatus,
  string
> = {
  等待付款: '等待付款',
  付款处理中: '付款处理中',
  已付款: '已付款',
  付款失败: '付款失败待财务处理',
};

export const INVOICE_REVIEW_STATUS_META: Record<
  InvoiceReviewStatus,
  { label: string; color: string }
> = {
  待签署: { label: '待签署', color: '#8b5cf6' },
  达人反馈: { label: '达人反馈', color: '#e8792e' },
  待媒介审核: { label: '待媒介审核', color: '#f59e0b' },
  待媒介复核: { label: '待媒介复核', color: '#f97316' },
  待发起请款: { label: '待发起请款', color: '#0f766e' },
  待PM审核: { label: '待 PM 审批', color: '#2563eb' },
  待项目负责人审核: { label: '待项目负责人审批', color: '#2563eb' },
  待老板审核: { label: '待老板审批', color: '#7c3aed' },
  待财务审核: { label: '待财务审批', color: '#3b82f6' },
  已通过: { label: '已通过', color: '#22c55e' },
  已退回: { label: '已退回', color: '#ef4444' },
};

type Transition = {
  from: InvoiceReviewStatus[];
  to: InvoiceReviewStatus;
  stage: InvoiceReviewStage;
  label: InvoiceReviewEvent['action'];
  reasonRequired?: boolean;
};

const STATIC_TRANSITIONS: Partial<Record<InvoiceReviewAction, Transition>> = {
  MARK_SIGNED: {
    from: ['待签署'],
    to: '待媒介审核',
    stage: 'SIGNATURE',
    label: '签署完成',
  },
  RECORD_CREATOR_FEEDBACK: {
    from: ['待签署'],
    to: '达人反馈',
    stage: 'SIGNATURE',
    label: '达人反馈',
    reasonRequired: true,
  },
  RESEND_FOR_SIGNATURE: {
    from: ['达人反馈'],
    to: '待签署',
    stage: 'SIGNATURE',
    label: '重新发送',
  },
  APPROVE_MEDIA: {
    from: ['待媒介审核', '待媒介复核'],
    to: '待发起请款',
    stage: 'MEDIA',
    label: '审核通过',
  },
  RETURN_TO_CREATOR: {
    from: ['待媒介审核', '待媒介复核'],
    to: '待签署',
    stage: 'MEDIA',
    label: '退回',
    reasonRequired: true,
  },
};

export const getInvoicePageTab = (status: InvoiceReviewStatus): InvoicePageTab => {
  if (status === '待签署') return 'signature';
  if (status === '达人反馈' || status === '待媒介审核' || status === '待媒介复核') {
    return 'media-review';
  }
  if (
    status === '待发起请款'
    || status === '待PM审核'
    || status === '待项目负责人审核'
    || status === '待老板审核'
    || status === '待财务审核'
  ) {
    return 'approval';
  }
  if (status === '已退回') return 'returned';
  return 'approved';
};

export const getInvoiceDetailNavigationTarget = (
  status: InvoiceReviewStatus,
): InvoiceDetailNavigationTarget | null => {
  if (status === '待发起请款') return 'PROJECT';
  if (
    status === '待PM审核'
    || status === '待项目负责人审核'
    || status === '待老板审核'
    || status === '待财务审核'
  ) {
    return 'REQUEST';
  }
  if (status === '已通过') return 'PAYMENT';
  return null;
};

export const getApprovedInvoicePaymentStatus = (
  payout: Pick<Payout, 'status'>,
): ApprovedInvoicePaymentStatus => {
  if (
    payout.status === '付款处理中'
    || payout.status === '已付款'
    || payout.status === '付款失败'
  ) {
    return payout.status;
  }
  return '等待付款';
};

export const getInvoiceRowStatus = (payout: Pick<Payout, 'invoiceReviewStatus' | 'status'>) => {
  if (payout.invoiceReviewStatus === '待签署') return '待签署';
  if (payout.invoiceReviewStatus === '达人反馈') return '达人反馈';
  if (payout.invoiceReviewStatus === '待媒介审核') return '待审核';
  if (payout.invoiceReviewStatus === '待媒介复核') return '待复核';
  if (payout.invoiceReviewStatus === '已通过') {
    return APPROVED_INVOICE_PAYMENT_STATUS_LABEL[getApprovedInvoicePaymentStatus(payout)];
  }
  return INVOICE_REVIEW_STATUS_META[payout.invoiceReviewStatus].label;
};

export const getAvailableInvoiceReviewActions = (
  status: InvoiceReviewStatus,
  capabilities: InvoiceReviewCapabilities,
): InvoiceReviewAction[] => {
  if (status === '待签署') {
    return capabilities.manage ? ['MARK_SIGNED', 'RECORD_CREATOR_FEEDBACK'] : [];
  }
  if (status === '达人反馈') {
    return capabilities.manage ? ['RESEND_FOR_SIGNATURE'] : [];
  }
  if (status === '待媒介审核' || status === '待媒介复核') {
    return capabilities.mediaReview ? ['APPROVE_MEDIA', 'RETURN_TO_CREATOR'] : [];
  }
  if (status === '已退回') {
    return capabilities.manage ? ['RESTART_AFTER_PAYMENT_FAILURE'] : [];
  }
  return [];
};

export const getInvoiceDetailReviewActions = (
  status: InvoiceReviewStatus,
  capabilities: InvoiceReviewCapabilities,
) => (
  status === '待签署'
    ? []
    : getAvailableInvoiceReviewActions(status, capabilities)
);

const resolveTransition = (
  payout: Pick<Payout, 'invoiceReviewStatus' | 'paymentFailureReturn'>,
  action: InvoiceReviewAction,
): Transition => {
  if (action !== 'RESTART_AFTER_PAYMENT_FAILURE') {
    const transition = STATIC_TRANSITIONS[action];
    if (!transition) throw new Error('当前 Invoice 操作未配置。');
    return transition;
  }
  const issueType = payout.paymentFailureReturn?.issueType;
  if (!issueType) throw new Error('付款失败尚未由财务分类，不能重新发起流程。');
  return {
    from: ['已退回'],
    to: issueType === 'INVOICE_CONTENT' ? '待签署' : '待媒介复核',
    stage: 'PAYMENT',
    label: '重新提交',
  };
};

export const createInvoiceReviewEvent = (
  payout: Pick<Payout, 'invoiceReviewStatus' | 'paymentFailureReturn'>,
  action: InvoiceReviewAction,
  actor: InvoiceReviewActor,
  reason?: string,
  occurredAt = new Date().toISOString(),
): InvoiceReviewEvent => {
  const transition = resolveTransition(payout, action);
  if (!transition.from.includes(payout.invoiceReviewStatus)) {
    throw new Error(`Invoice 状态“${payout.invoiceReviewStatus}”不能执行该操作。`);
  }
  const normalizedReason = reason?.trim();
  if (transition.reasonRequired && !normalizedReason) {
    throw new Error(action === 'RECORD_CREATOR_FEEDBACK'
      ? '记录达人反馈时必须填写反馈内容。'
      : '退回达人修改时必须填写原因。');
  }

  return {
    stage: transition.stage,
    action: action === 'APPROVE_MEDIA' && payout.invoiceReviewStatus === '待媒介复核'
      ? '复核通过并重新提交'
      : transition.label,
    actorAccount: actor.account,
    actorName: actor.name,
    actorRole: actor.role,
    fromStatus: payout.invoiceReviewStatus,
    toStatus: transition.to,
    reason: normalizedReason,
    occurredAt,
  };
};

export const applyInvoiceReviewAction = (
  payout: Payout,
  action: InvoiceReviewAction,
  actor: InvoiceReviewActor,
  reason?: string,
  occurredAt = new Date().toISOString(),
): Payout => {
  const eventReason = action === 'RESEND_FOR_SIGNATURE' && payout.creatorFeedback
    ? `已处理达人反馈：${payout.creatorFeedback.reason}`
    : reason;
  const event = createInvoiceReviewEvent(payout, action, actor, eventReason, occurredAt);
  const isCreatorFeedback = action === 'RECORD_CREATOR_FEEDBACK';
  const isSigned = action === 'MARK_SIGNED';
  const invalidatesSignature = action === 'RETURN_TO_CREATOR'
    || (
      action === 'RESTART_AFTER_PAYMENT_FAILURE'
      && payout.paymentFailureReturn?.issueType === 'INVOICE_CONTENT'
    );
  const isResend = action === 'RESEND_FOR_SIGNATURE';
  const clearsPaymentFailure = action === 'RESTART_AFTER_PAYMENT_FAILURE';

  return {
    ...payout,
    status: '未进入付款',
    invoiceReviewStatus: event.toStatus,
    invoiceReviewHistory: [...(payout.invoiceReviewHistory ?? []), event],
    invoiceVersion: isResend || invalidatesSignature
      ? (payout.invoiceVersion ?? 1) + 1
      : payout.invoiceVersion ?? 1,
    invoiceSignatureRound: isSigned
      ? (payout.invoiceSignatureRound ?? 0) + 1
      : payout.invoiceSignatureRound,
    invoiceSignedAt: isSigned ? occurredAt : invalidatesSignature ? undefined : payout.invoiceSignedAt,
    creatorFeedback: isCreatorFeedback
      ? { reason: event.reason ?? '', actorName: actor.name, occurredAt }
      : isResend
        ? undefined
        : payout.creatorFeedback,
    invoiceReviewReturn: action === 'RETURN_TO_CREATOR'
      ? {
          stage: 'MEDIA',
          reason: event.reason ?? '',
          actorName: actor.name,
          occurredAt,
        }
      : isResend || clearsPaymentFailure
        ? undefined
        : payout.invoiceReviewReturn,
    issue: isCreatorFeedback
      ? `达人反馈：${event.reason}`
      : action === 'RETURN_TO_CREATOR'
        ? `媒介退回达人修改：${event.reason}`
        : undefined,
    returnReason: action === 'RETURN_TO_CREATOR' ? event.reason : undefined,
    paymentFailureReturn: clearsPaymentFailure ? undefined : payout.paymentFailureReturn,
    paymentFailure: clearsPaymentFailure ? undefined : payout.paymentFailure,
  };
};

export const replyToCreatorFeedback = (
  payout: Payout,
  actor: InvoiceReviewActor,
  message: string,
  occurredAt = new Date().toISOString(),
): Payout => {
  if (payout.invoiceReviewStatus !== '达人反馈' || !payout.creatorFeedback) {
    throw new Error('当前 Invoice 没有可回复的达人反馈。');
  }
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    throw new Error('回复内容不能为空。');
  }
  const event: InvoiceReviewEvent = {
    stage: 'SIGNATURE',
    action: '回复达人反馈',
    actorAccount: actor.account,
    actorName: actor.name,
    actorRole: actor.role,
    fromStatus: '达人反馈',
    toStatus: '达人反馈',
    reason: normalizedMessage,
    occurredAt,
  };
  return {
    ...payout,
    creatorFeedback: {
      ...payout.creatorFeedback,
      replies: [
        ...(payout.creatorFeedback.replies ?? []),
        {
          message: normalizedMessage,
          actorAccount: actor.account,
          actorName: actor.name,
          actorRole: actor.role,
          occurredAt,
        },
      ],
    },
    invoiceReviewHistory: [...(payout.invoiceReviewHistory ?? []), event],
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
  const event = createInvoiceReviewEvent(payout, 'MARK_SIGNED', actor, undefined, occurredAt);
  return {
    ...payout,
    invoice: record.id,
    invoiceSnapshot: record.snapshot,
    status: '未进入付款',
    invoiceReviewStatus: event.toStatus,
    invoiceReviewHistory: [...(payout.invoiceReviewHistory ?? []), event],
    invoiceVersion: record.version ?? payout.invoiceVersion ?? 1,
    invoiceSignatureRound: (payout.invoiceSignatureRound ?? 0) + 1,
    invoiceSignedAt: occurredAt,
    creatorFeedback: undefined,
    invoiceReviewReturn: undefined,
    issue: undefined,
    returnReason: undefined,
  };
};

export const invalidateSignedInvoice = (
  payout: Payout,
  actor: InvoiceReviewActor,
  occurredAt = new Date().toISOString(),
): Payout => {
  if (payout.invoiceReviewStatus !== '待媒介复核') return payout;
  const event: InvoiceReviewEvent = {
    stage: 'SIGNATURE',
    action: '签署失效',
    actorAccount: actor.account,
    actorName: actor.name,
    actorRole: actor.role,
    fromStatus: '待媒介复核',
    toStatus: '待签署',
    reason: '复核期间修改了影响签署效力的 Invoice 字段。',
    occurredAt,
  };
  return {
    ...payout,
    status: '未进入付款',
    invoiceReviewStatus: '待签署',
    invoiceReviewHistory: [...(payout.invoiceReviewHistory ?? []), event],
    invoiceVersion: (payout.invoiceVersion ?? 1) + 1,
    invoiceSignedAt: undefined,
    issue: event.reason,
  };
};

export const sensitiveInvoiceSnapshotChanged = (
  previous: GeneratedInvoiceRecord,
  next: GeneratedInvoiceRecord,
) => {
  const project = (record: GeneratedInvoiceRecord) => ({
    billTo: record.snapshot.billTo,
    from: record.snapshot.from,
    currency: record.snapshot.currency,
    items: record.snapshot.items,
    paymentMethod: record.snapshot.paymentMethod,
    payment: record.snapshot.payment,
    contractIds: record.snapshot.contractIds,
  });
  return JSON.stringify(project(previous)) !== JSON.stringify(project(next));
};

export const invoiceStatusForRequestApproval = (
  status: 'PENDING_PM' | 'PENDING_PROJECT_OWNER' | 'PENDING_OWNER' | 'PENDING_FINANCE' | 'APPROVED',
): InvoiceReviewStatus => ({
  PENDING_PM: '待PM审核',
  PENDING_PROJECT_OWNER: '待项目负责人审核',
  PENDING_OWNER: '待老板审核',
  PENDING_FINANCE: '待财务审核',
  APPROVED: '已通过',
})[status] as InvoiceReviewStatus;

export const isInvoiceApprovedForPayment = (
  payout: Pick<Payout, 'invoiceReviewStatus'>,
) => payout.invoiceReviewStatus === '已通过';

export const isPayoutEligibleForBatch = (
  payout: Pick<Payout, 'invoiceReviewStatus' | 'status'>,
) => isInvoiceApprovedForPayment(payout) && payout.status === '等待付款';

export const paymentFailureRestartStage = (issueType: PaymentFailureIssueType) => (
  issueType === 'INVOICE_CONTENT' ? 'SIGNATURE' : 'MEDIA_RECHECK'
);
