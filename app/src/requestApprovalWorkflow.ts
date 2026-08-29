import type { SystemUser } from './data';
import type {
  RequestApprovalEvent,
  RequestApprovalReturnItem,
  RequestApprovalReturnIssueType,
  RequestApprovalStage,
  RequestApprovalState,
  RequestApprovalStatus,
  RequestApprovalReturnAccountUpdate,
} from './businessWorkflow';
import type { PaymentNotification } from './types';

export type RequestApprovalAction = 'APPROVE' | 'RETURN';

const STATUS_STAGE: Partial<Record<RequestApprovalStatus, RequestApprovalStage>> = {
  PENDING_PM: 'PM',
  PENDING_PROJECT_OWNER: 'PROJECT_OWNER',
  PENDING_OWNER: 'OWNER',
  PENDING_FINANCE: 'FINANCE',
};

const NEXT_STATUS: Record<Exclude<RequestApprovalStatus, 'APPROVED' | 'RETURNED_TO_MEDIA_REVIEW'>, RequestApprovalStatus> = {
  PENDING_PM: 'PENDING_PROJECT_OWNER',
  PENDING_PROJECT_OWNER: 'PENDING_OWNER',
  PENDING_OWNER: 'PENDING_FINANCE',
  PENDING_FINANCE: 'APPROVED',
};

export const REQUEST_APPROVAL_STATUS_LABEL: Record<RequestApprovalStatus, string> = {
  PENDING_PM: '待 PM 审批',
  PENDING_PROJECT_OWNER: '待项目负责人审批',
  PENDING_OWNER: '待老板审批',
  PENDING_FINANCE: '待财务审批',
  APPROVED: '已通过',
  RETURNED_TO_MEDIA_REVIEW: '待媒介复核',
};

export const REQUEST_APPROVAL_STAGE_LABEL: Record<RequestApprovalStage, string> = {
  PM: 'PM 审批',
  PROJECT_OWNER: '项目负责人审批',
  OWNER: '老板审批',
  FINANCE: '财务审核',
};

export type RequestApprovalReturnDetails = {
  stage: RequestApprovalStage;
  stageLabel: string;
  reason: string;
  actorName: string;
  actorRole: string;
  occurredAt: string;
  round: number;
  items: RequestApprovalReturnItem[];
};

export const requestApprovalReturnDetails = (
  state?: RequestApprovalState,
): RequestApprovalReturnDetails | null => {
  if (!state || state.status !== 'RETURNED_TO_MEDIA_REVIEW') return null;
  const returnEvent = [...state.history].reverse().find((event) => (
    event.action === 'RETURN' && event.round === state.round
  ));
  const stage = state.returnedFromStage ?? returnEvent?.stage;
  if (!stage) return null;
  return {
    stage,
    stageLabel: REQUEST_APPROVAL_STAGE_LABEL[stage],
    reason: state.returnReason?.trim() || returnEvent?.reason?.trim() || '未记录退回原因',
    actorName: returnEvent?.actorName || '审批人',
    actorRole: returnEvent?.actorRole || REQUEST_APPROVAL_STAGE_LABEL[stage],
    occurredAt: returnEvent?.occurredAt || state.updatedAt,
    round: returnEvent?.round ?? state.round,
    items: state.returnItems ?? returnEvent?.returnItems ?? [],
  };
};

export const requestApprovalHasScopedReturnItems = (
  state?: RequestApprovalState,
) => Boolean(
  state?.status === 'RETURNED_TO_MEDIA_REVIEW'
  && state.returnItems?.length,
);

export const requestApprovalReturnItemForInvoice = (
  state: RequestApprovalState | undefined,
  invoiceId: RequestApprovalReturnItem['invoiceId'],
  issueType?: RequestApprovalReturnIssueType,
) => state?.returnItems?.find((item) => (
  item.invoiceId === invoiceId
  && (!issueType || item.issueType === issueType)
));

export const requestApprovalReturnItemForInvoiceEdit = (
  state: RequestApprovalState | undefined,
  invoiceId: RequestApprovalReturnItem['invoiceId'],
) => state?.returnItems?.find((item) => (
  item.invoiceId === invoiceId
  && ['INVOICE_CONTENT', 'FULL_ITEM'].includes(item.issueType)
));

export const requestApprovalReturnItemForPaymentListEdit = (
  state: RequestApprovalState | undefined,
  invoiceId: RequestApprovalReturnItem['invoiceId'],
) => state?.returnItems?.find((item) => (
  item.invoiceId === invoiceId
  && ['PAYMENT_LIST', 'FULL_ITEM'].includes(item.issueType)
));

export const requestApprovalReturnItemForContract = (
  state: RequestApprovalState | undefined,
  contractId: string,
) => state?.returnItems?.find((item) => (
  ['CONTRACT_CONTENT', 'FULL_ITEM'].includes(item.issueType)
  && item.contractIds?.some((candidate) => String(candidate) === contractId)
));

export const requestApprovalAllowsInvoicePayoutOverride = (
  state: RequestApprovalState | undefined,
  invoiceId: RequestApprovalReturnItem['invoiceId'],
) => state?.status === 'RETURNED_TO_MEDIA_REVIEW' && Boolean(
  requestApprovalReturnItemForInvoiceEdit(state, invoiceId),
);

export const appendRequestApprovalReturnNotification = (
  state: RequestApprovalState | undefined,
  invoiceId: RequestApprovalReturnItem['invoiceId'],
  notification: PaymentNotification,
): RequestApprovalState => {
  if (!state || state.status !== 'RETURNED_TO_MEDIA_REVIEW') {
    throw new Error('当前请款项目不在媒介修改状态。');
  }
  const returnEvent = [...state.history].reverse().find((event) => (
    event.action === 'RETURN' && event.round === state.round
  ));
  const sourceItems = state.returnItems ?? returnEvent?.returnItems ?? [];
  let matched = false;
  const returnItems = sourceItems.map((item) => {
    if (item.invoiceId !== invoiceId || item.issueType !== 'PAYMENT_LIST') return item;
    matched = true;
    return {
      ...item,
      notifications: [...(item.notifications ?? []), notification],
    };
  });
  if (!matched) throw new Error('未找到可通知的付款清单退回明细。');
  return {
    ...state,
    returnItems,
    updatedAt: notification.occurredAt,
  };
};

export const recordRequestApprovalReturnAccountUpdate = (
  state: RequestApprovalState | undefined,
  invoiceId: RequestApprovalReturnItem['invoiceId'],
  accountUpdate: RequestApprovalReturnAccountUpdate,
): RequestApprovalState => {
  if (!state || state.status !== 'RETURNED_TO_MEDIA_REVIEW') {
    throw new Error('当前请款项目不在媒介修改状态。');
  }
  const returnEvent = [...state.history].reverse().find((event) => (
    event.action === 'RETURN' && event.round === state.round
  ));
  const sourceItems = state.returnItems ?? returnEvent?.returnItems ?? [];
  let matched = false;
  const returnItems = sourceItems.map((item) => {
    if (item.invoiceId !== invoiceId || item.issueType !== 'PAYMENT_LIST') return item;
    matched = true;
    return {
      ...item,
      accountUpdate,
    };
  });
  if (!matched) throw new Error('未找到可更新账户的付款清单退回明细。');
  return {
    ...state,
    returnItems,
    updatedAt: accountUpdate.occurredAt,
  };
};

export const requestApprovalStage = (
  status: RequestApprovalStatus,
) => STATUS_STAGE[status] ?? null;

export const canReviewRequestApproval = (
  user: Pick<SystemUser, 'roleKey' | 'name' | 'scopeName'>,
  state: RequestApprovalState,
  assignedPmName: string,
) => {
  const stage = requestApprovalStage(state.status);
  if (!stage) return false;
  if (user.roleKey === 'admin' || user.roleKey === 'owner') return true;
  if (stage === 'PM') {
    return user.roleKey === 'pm' && (user.scopeName ?? user.name) === assignedPmName;
  }
  if (stage === 'PROJECT_OWNER') return user.roleKey === 'project';
  if (stage === 'FINANCE') return user.roleKey === 'finance';
  return false;
};

export const canReturnRequestApproval = (
  user: Pick<SystemUser, 'roleKey' | 'name' | 'scopeName'>,
  state: RequestApprovalState,
  assignedPmName: string,
) => Boolean(requestApprovalStage(state.status)) && (
  user.roleKey === 'finance'
  || canReviewRequestApproval(user, state, assignedPmName)
);

export const createRequestApprovalState = (
  occurredAt = new Date().toISOString(),
  previous?: RequestApprovalState,
): RequestApprovalState => ({
  status: previous?.status === 'RETURNED_TO_MEDIA_REVIEW' && previous.resumeStatus
    ? previous.resumeStatus
    : 'PENDING_PM',
  round: (previous?.round ?? 0) + 1,
  history: previous?.history ?? [],
  submittedAt: occurredAt,
  updatedAt: occurredAt,
});

export const applyRequestApprovalAction = (
  state: RequestApprovalState,
  action: RequestApprovalAction,
  actor: Pick<SystemUser, 'account' | 'name' | 'role'>,
  reason?: string,
  occurredAt = new Date().toISOString(),
  returnItems?: RequestApprovalReturnItem[],
): RequestApprovalState => {
  const stage = requestApprovalStage(state.status);
  if (!stage) throw new Error('当前请款状态不能执行审批操作。');
  const normalizedReason = reason?.trim();
  if (action === 'RETURN' && !normalizedReason) {
    throw new Error('退回项目请款时必须填写原因。');
  }
  if (!(state.status in NEXT_STATUS)) {
    throw new Error('当前请款状态不能推进到下一审批节点。');
  }
  const toStatus: RequestApprovalStatus = action === 'APPROVE'
    ? NEXT_STATUS[state.status as keyof typeof NEXT_STATUS]
    : 'RETURNED_TO_MEDIA_REVIEW';
  const event: RequestApprovalEvent = {
    round: state.round,
    stage,
    action,
    actorAccount: actor.account,
    actorName: actor.name,
    actorRole: actor.role,
    fromStatus: state.status,
    toStatus,
    reason: normalizedReason,
    returnItems: action === 'RETURN' && returnItems?.length ? returnItems : undefined,
    occurredAt,
  };
  return {
    status: toStatus,
    round: state.round,
    history: [...state.history, event],
    submittedAt: state.submittedAt,
    returnedFromStage: action === 'RETURN' ? stage : undefined,
    resumeStatus: action === 'RETURN'
      ? state.status as Exclude<RequestApprovalStatus, 'APPROVED' | 'RETURNED_TO_MEDIA_REVIEW'>
      : undefined,
    returnReason: action === 'RETURN' ? normalizedReason : undefined,
    returnItems: action === 'RETURN' && returnItems?.length ? returnItems : undefined,
    updatedAt: occurredAt,
  };
};

export const returnApprovedRequestToMediaReview = (
  state: RequestApprovalState,
  actor: Pick<SystemUser, 'account' | 'name' | 'role'>,
  reason: string,
  occurredAt = new Date().toISOString(),
  returnItems?: RequestApprovalReturnItem[],
): RequestApprovalState => {
  if (state.status !== 'APPROVED') {
    throw new Error('只有已完成财务审批且尚未付款的请款可以从付款执行页退回。');
  }
  const normalizedReason = reason.trim();
  if (!normalizedReason) throw new Error('退回项目请款时必须填写原因。');

  const event: RequestApprovalEvent = {
    round: state.round,
    stage: 'FINANCE',
    action: 'RETURN',
    actorAccount: actor.account,
    actorName: actor.name,
    actorRole: actor.role,
    fromStatus: state.status,
    toStatus: 'RETURNED_TO_MEDIA_REVIEW',
    reason: normalizedReason,
    returnItems: returnItems?.length ? returnItems : undefined,
    occurredAt,
  };
  return {
    status: 'RETURNED_TO_MEDIA_REVIEW',
    round: state.round,
    history: [...state.history, event],
    submittedAt: state.submittedAt,
    returnedFromStage: 'FINANCE',
    resumeStatus: 'PENDING_FINANCE',
    returnReason: normalizedReason,
    returnItems: returnItems?.length ? returnItems : undefined,
    updatedAt: occurredAt,
  };
};
