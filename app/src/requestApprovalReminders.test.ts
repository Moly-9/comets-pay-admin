import { describe, expect, it } from 'vitest';
import type { RequestApprovalState } from './businessWorkflow';
import type { SystemUser } from './data';
import {
  requestApprovalReminderFor,
  type RequestApprovalReminderCandidate,
} from './requestApprovalReminders';

const approval = (status: RequestApprovalState['status']): RequestApprovalState => ({
  status,
  round: 1,
  history: [],
  submittedAt: '2026-08-09T00:00:00.000Z',
  updatedAt: '2026-08-09T00:00:00.000Z',
});

const requests: RequestApprovalReminderCandidate[] = [
  { id: 'pm-one', pm: '张咏诗', lifecycle: 'SUBMITTED', approval: approval('PENDING_PM') },
  { id: 'pm-other', pm: '霍舜华', lifecycle: 'SUBMITTED', approval: approval('PENDING_PM') },
  { id: 'project-one', pm: '张咏诗', lifecycle: 'SUBMITTED', approval: approval('PENDING_PROJECT_OWNER') },
  { id: 'owner-one', pm: '张咏诗', lifecycle: 'SUBMITTED', approval: approval('PENDING_OWNER') },
  { id: 'finance-one', pm: '张咏诗', lifecycle: 'SUBMITTED', approval: approval('PENDING_FINANCE') },
  { id: 'approved', pm: '张咏诗', lifecycle: 'APPROVED', approval: approval('APPROVED') },
  { id: 'draft', pm: '张咏诗', lifecycle: 'DRAFT', approval: approval('PENDING_PM') },
  { id: 'cancelled', pm: '张咏诗', lifecycle: 'CANCELLED', approval: approval('PENDING_FINANCE') },
];

const user = (
  roleKey: SystemUser['roleKey'],
  name: string,
  scopeName?: string,
): Pick<SystemUser, 'roleKey' | 'name' | 'scopeName'> => ({ roleKey, name, scopeName });

describe('request approval reminders', () => {
  it('counts only PM-stage projects assigned to the signed-in PM', () => {
    expect(requestApprovalReminderFor(user('pm', 'PM 体验账号', '张咏诗'), requests)).toEqual({
      count: 1,
      requestIds: ['pm-one'],
      stageSummary: 'PM 审批 1 个',
    });
  });

  it('counts the current approval node for project and finance reviewers', () => {
    expect(requestApprovalReminderFor(user('project', '媒介负责人'), requests)).toMatchObject({
      count: 1,
      requestIds: ['project-one'],
      stageSummary: '媒介负责人审批 1 个',
    });
    expect(requestApprovalReminderFor(user('finance', '财务'), requests)).toMatchObject({
      count: 1,
      requestIds: ['finance-one'],
      stageSummary: '财务审批 1 个',
    });
  });

  it('follows the existing owner override and reports a stage breakdown', () => {
    expect(requestApprovalReminderFor(user('owner', '老板'), requests)).toEqual({
      count: 5,
      requestIds: ['pm-one', 'pm-other', 'project-one', 'owner-one', 'finance-one'],
      stageSummary: 'PM 审批 2 个、媒介负责人审批 1 个、老板审批 1 个、财务审批 1 个',
    });
  });

  it('does not show approval reminders to a media account', () => {
    expect(requestApprovalReminderFor(user('media', '媒介'), requests)).toEqual({
      count: 0,
      requestIds: [],
      stageSummary: '',
    });
  });

  it('routes an unassigned request only to the media owner reminder', () => {
    const unassigned: RequestApprovalReminderCandidate[] = [{
      id: 'project-unassigned',
      pm: '',
      lifecycle: 'SUBMITTED',
      approval: approval('PENDING_PROJECT_OWNER'),
    }];

    expect(requestApprovalReminderFor(user('pm', 'PM 体验账号', '张咏诗'), unassigned).count).toBe(0);
    expect(requestApprovalReminderFor(user('project', '媒介负责人'), unassigned)).toMatchObject({
      count: 1,
      requestIds: ['project-unassigned'],
      stageSummary: '媒介负责人审批 1 个',
    });
  });
});
