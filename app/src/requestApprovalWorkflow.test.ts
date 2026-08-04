import { describe, expect, it } from 'vitest';
import { DEMO_SYSTEM_USERS } from './data';
import {
  applyRequestApprovalAction,
  canReviewRequestApproval,
  createRequestApprovalState,
} from './requestApprovalWorkflow';

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

    state = applyRequestApprovalAction(state, 'APPROVE', pm, undefined, '2026-08-04T02:00:00.000Z');
    expect(state.status).toBe('PENDING_PROJECT_OWNER');
    expect(state.submittedAt).toBe('2026-08-04T01:00:00.000Z');
    expect(state.updatedAt).toBe('2026-08-04T02:00:00.000Z');
    state = applyRequestApprovalAction(state, 'APPROVE', projectOwner);
    expect(state.status).toBe('PENDING_OWNER');
    state = applyRequestApprovalAction(state, 'APPROVE', owner);
    expect(state.status).toBe('PENDING_FINANCE');
    state = applyRequestApprovalAction(state, 'APPROVE', finance);
    expect(state.status).toBe('APPROVED');
    expect(state.history.map((event) => event.stage)).toEqual([
      'PM',
      'PROJECT_OWNER',
      'OWNER',
      'FINANCE',
    ]);
  });

  it('returns any active approval node to media recheck and starts a new round at PM', () => {
    const pm = userFor('pm');
    const state = createRequestApprovalState();
    const returned = applyRequestApprovalAction(state, 'RETURN', pm, '金额需要复核');
    expect(returned.status).toBe('RETURNED_TO_MEDIA_REVIEW');
    expect(returned.returnReason).toBe('金额需要复核');

    const nextRound = createRequestApprovalState('2026-08-05T01:00:00.000Z', returned);
    expect(nextRound.status).toBe('PENDING_PM');
    expect(nextRound.round).toBe(2);
    expect(nextRound.history).toHaveLength(1);
    expect(nextRound.submittedAt).toBe('2026-08-05T01:00:00.000Z');
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
