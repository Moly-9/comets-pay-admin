import type { SystemUser } from './data';
import type {
  RequestApprovalEvent,
  RequestApprovalStage,
  RequestApprovalState,
  RequestApprovalStatus,
} from './businessWorkflow';

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

export const createRequestApprovalState = (
  occurredAt = new Date().toISOString(),
  previous?: RequestApprovalState,
): RequestApprovalState => ({
  status: 'PENDING_PM',
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
    occurredAt,
  };
  return {
    status: toStatus,
    round: state.round,
    history: [...state.history, event],
    submittedAt: state.submittedAt,
    returnedFromStage: action === 'RETURN' ? stage : undefined,
    returnReason: action === 'RETURN' ? normalizedReason : undefined,
    updatedAt: occurredAt,
  };
};
