import { describe, expect, it } from 'vitest';
import { DEMO_SYSTEM_USERS } from './data';
import {
  applyRequestApprovalAction,
  canReturnRequestApproval,
  canReviewRequestApproval,
  createRequestApprovalState,
  requestApprovalReturnDetails,
  returnApprovedRequestToMediaReview,
} from './requestApprovalWorkflow';
import { myProjectStatusFor, requestProjectStatusFor } from './paymentRequestProjects';

const userFor = (role: 'media' | 'pm' | 'finance' | 'admin' | 'owner' | 'project') => {
  const user = DEMO_SYSTEM_USERS.find((candidate) => candidate.roleKey === role);
  if (!user) throw new Error(`Missing ${role} demo user`);
  return user;
};

describe('request approval workflow', () => {
  it('advances strictly through PM, project owner, owner and finance', () => {
    const pm = userFor('pm');
    const projectOwner = userFor('project');
    const owner = userFor('owner');
    const finance = userFor('finance');
    let state = createRequestApprovalState('2026-08-04T01:00:00.000Z');
    expect(myProjectStatusFor({ lifecycle: 'SUBMITTED', approval: state })).toBe('PM审批中');
    expect(requestProjectStatusFor({ lifecycle: 'SUBMITTED', approval: state })).toBe('请款提交');

    state = applyRequestApprovalAction(state, 'APPROVE', pm, undefined, '2026-08-04T02:00:00.000Z');
    expect(state.status).toBe('PENDING_PROJECT_OWNER');
    expect(myProjectStatusFor({ lifecycle: 'SUBMITTED', approval: state })).toBe('项目负责人审批中');
    expect(requestProjectStatusFor({ lifecycle: 'SUBMITTED', approval: state })).toBe('PM审批通过');
    expect(state.submittedAt).toBe('2026-08-04T01:00:00.000Z');
    expect(state.updatedAt).toBe('2026-08-04T02:00:00.000Z');
    state = applyRequestApprovalAction(state, 'APPROVE', projectOwner);
    expect(state.status).toBe('PENDING_OWNER');
    expect(myProjectStatusFor({ lifecycle: 'SUBMITTED', approval: state })).toBe('老板审批中');
    expect(requestProjectStatusFor({ lifecycle: 'SUBMITTED', approval: state })).toBe('项目负责人审批通过');
    state = applyRequestApprovalAction(state, 'APPROVE', owner);
    expect(state.status).toBe('PENDING_FINANCE');
    expect(myProjectStatusFor({ lifecycle: 'SUBMITTED', approval: state })).toBe('财务审批中');
    expect(requestProjectStatusFor({ lifecycle: 'SUBMITTED', approval: state })).toBe('老板审批通过');
    state = applyRequestApprovalAction(state, 'APPROVE', finance);
    expect(state.status).toBe('APPROVED');
    expect(myProjectStatusFor({ lifecycle: 'APPROVED', approval: state })).toBe('待打款');
    expect(requestProjectStatusFor({ lifecycle: 'APPROVED', approval: state })).toBe('财务审批通过');
    expect(state.history.map((event) => event.stage)).toEqual([
      'PM',
      'PROJECT_OWNER',
      'OWNER',
      'FINANCE',
    ]);
  });

  it('returns any active approval node and starts a new round at the intercepted node', () => {
    const pm = userFor('pm');
    const state = createRequestApprovalState();
    const returned = applyRequestApprovalAction(state, 'RETURN', pm, '金额需要复核');
    expect(returned.status).toBe('RETURNED_TO_MEDIA_REVIEW');
    expect(returned.returnReason).toBe('金额需要复核');
    expect(returned.resumeStatus).toBe('PENDING_PM');
    expect(myProjectStatusFor({ lifecycle: 'RETURNED', approval: returned })).toBe('已退回');
    expect(requestProjectStatusFor({ lifecycle: 'RETURNED', approval: returned })).toBe('已退回');

    const nextRound = createRequestApprovalState('2026-08-05T01:00:00.000Z', returned);
    expect(nextRound.status).toBe('PENDING_PM');
    expect(nextRound.round).toBe(2);
    expect(nextRound.history).toHaveLength(1);
    expect(nextRound.submittedAt).toBe('2026-08-05T01:00:00.000Z');
    expect(myProjectStatusFor({ lifecycle: 'SUBMITTED', approval: nextRound })).toBe('PM审批中');
    expect(requestProjectStatusFor({ lifecycle: 'SUBMITTED', approval: nextRound })).toBe('请款提交');
  });

  it('restores a returned project-owner request to the project-owner node', () => {
    const projectOwner = userFor('project');
    const state = { ...createRequestApprovalState(), status: 'PENDING_PROJECT_OWNER' as const };
    const returned = applyRequestApprovalAction(state, 'RETURN', projectOwner, '付款清单需要修正');
    const nextRound = createRequestApprovalState('2026-08-05T01:00:00.000Z', returned);
    expect(nextRound.status).toBe('PENDING_PROJECT_OWNER');
    expect(nextRound.round).toBe(2);
  });

  it('exposes the current-round finance return reason for the media project detail', () => {
    const finance = userFor('finance');
    const state = {
      ...createRequestApprovalState('2026-08-04T01:00:00.000Z'),
      status: 'PENDING_FINANCE' as const,
    };
    const returned = applyRequestApprovalAction(
      state,
      'RETURN',
      finance,
      '收款账户名与 Invoice 不一致',
      '2026-08-10T04:30:00.000Z',
    );

    expect(requestApprovalReturnDetails(returned)).toEqual({
      stage: 'FINANCE',
      stageLabel: '财务审核',
      reason: '收款账户名与 Invoice 不一致',
      actorName: finance.name,
      actorRole: finance.role,
      occurredAt: '2026-08-10T04:30:00.000Z',
      round: 1,
    });
    const resubmitted = createRequestApprovalState('2026-08-10T05:00:00.000Z', returned);
    expect(resubmitted.status).toBe('PENDING_FINANCE');
    expect(resubmitted.round).toBe(2);
    expect(requestApprovalReturnDetails(resubmitted)).toBeNull();
  });

  it('returns an approved unpaid request from payment execution back to finance review', () => {
    const finance = userFor('finance');
    const approved = {
      ...createRequestApprovalState('2026-08-04T01:00:00.000Z'),
      status: 'APPROVED' as const,
    };
    const returned = returnApprovedRequestToMediaReview(
      approved,
      finance,
      '收款账户需要媒介重新确认',
      '2026-08-10T06:00:00.000Z',
    );

    expect(returned.status).toBe('RETURNED_TO_MEDIA_REVIEW');
    expect(returned.resumeStatus).toBe('PENDING_FINANCE');
    expect(requestApprovalReturnDetails(returned)).toMatchObject({
      stage: 'FINANCE',
      reason: '收款账户需要媒介重新确认',
    });
    expect(createRequestApprovalState('2026-08-10T07:00:00.000Z', returned)).toMatchObject({
      status: 'PENDING_FINANCE',
      round: 2,
    });
  });

  it('allows finance to return any active OA stage without approving it', () => {
    const finance = userFor('finance');
    const pm = userFor('pm');
    const state = createRequestApprovalState();
    expect(canReviewRequestApproval(finance, state, pm.scopeName ?? pm.name)).toBe(false);
    expect(canReturnRequestApproval(finance, state, pm.scopeName ?? pm.name)).toBe(true);
  });

  it('enforces role ownership while allowing admin and owner to substitute only current node', () => {
    const media = userFor('media');
    const pm = userFor('pm');
    const projectOwner = userFor('project');
    const finance = userFor('finance');
    const admin = userFor('admin');
    const owner = userFor('owner');
    const pmState = createRequestApprovalState();
    const assignedPmName = pm.scopeName ?? pm.name;

    expect(canReviewRequestApproval(media, pmState, assignedPmName)).toBe(false);
    expect(canReviewRequestApproval(pm, pmState, assignedPmName)).toBe(true);
    expect(canReviewRequestApproval(projectOwner, pmState, assignedPmName)).toBe(false);
    expect(canReviewRequestApproval(finance, pmState, assignedPmName)).toBe(false);

    const projectOwnerState = { ...pmState, status: 'PENDING_PROJECT_OWNER' as const };
    expect(canReviewRequestApproval(pm, projectOwnerState, assignedPmName)).toBe(false);
    expect(canReviewRequestApproval(projectOwner, projectOwnerState, assignedPmName)).toBe(true);

    const ownerState = { ...pmState, status: 'PENDING_OWNER' as const };
    expect(canReviewRequestApproval(projectOwner, ownerState, assignedPmName)).toBe(false);
    expect(canReviewRequestApproval(owner, ownerState, assignedPmName)).toBe(true);

    const financeState = { ...pmState, status: 'PENDING_FINANCE' as const };
    expect(canReviewRequestApproval(finance, financeState, assignedPmName)).toBe(true);
    expect(canReviewRequestApproval(pm, financeState, assignedPmName)).toBe(false);
    expect(canReviewRequestApproval(admin, financeState, assignedPmName)).toBe(true);
    expect(canReviewRequestApproval(owner, financeState, assignedPmName)).toBe(true);
  });

  it('rejects empty return reasons and terminal-state actions', () => {
    const pm = userFor('pm');
    const state = createRequestApprovalState();
    expect(() => applyRequestApprovalAction(state, 'RETURN', pm, '  ')).toThrow();
    const approved = {
      ...state,
      status: 'APPROVED' as const,
    };
    expect(() => applyRequestApprovalAction(approved, 'APPROVE', pm)).toThrow();
  });
});
