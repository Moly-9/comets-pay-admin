import type { SystemUser } from './data';
import type {
  RequestApprovalState,
  RequestApprovalStatus,
} from './businessWorkflow';
import {
  canReviewRequestApproval,
  requestApprovalStage,
} from './requestApprovalWorkflow';

export type RequestApprovalReminderCandidate = {
  id: string;
  pm: string;
  approval?: RequestApprovalState;
  lifecycle?: string;
};

export type RequestApprovalReminderSummary = {
  count: number;
  requestIds: string[];
  stageSummary: string;
};

const STAGE_LABELS: Partial<Record<RequestApprovalStatus, string>> = {
  PENDING_PM: 'PM 审批',
  PENDING_PROJECT_OWNER: '项目负责人审批',
  PENDING_OWNER: '老板审批',
  PENDING_FINANCE: '财务审批',
};

const STAGE_ORDER: RequestApprovalStatus[] = [
  'PENDING_PM',
  'PENDING_PROJECT_OWNER',
  'PENDING_OWNER',
  'PENDING_FINANCE',
];

export const requestApprovalReminderFor = (
  user: Pick<SystemUser, 'roleKey' | 'name' | 'scopeName'>,
  requests: RequestApprovalReminderCandidate[],
): RequestApprovalReminderSummary => {
  const reviewable = requests.filter((request) => (
    request.lifecycle !== 'DRAFT'
    && request.lifecycle !== 'CANCELLED'
    && Boolean(request.approval)
    && canReviewRequestApproval(user, request.approval!, request.pm)
  ));
  const stageCounts = reviewable.reduce<Partial<Record<RequestApprovalStatus, number>>>((counts, request) => {
    const status = request.approval?.status;
    if (!status || !requestApprovalStage(status)) return counts;
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const stageSummary = STAGE_ORDER.flatMap((status) => {
    const count = stageCounts[status] ?? 0;
    return count ? [`${STAGE_LABELS[status]} ${count} 个`] : [];
  }).join('、');

  return {
    count: reviewable.length,
    requestIds: reviewable.map((request) => request.id),
    stageSummary,
  };
};
