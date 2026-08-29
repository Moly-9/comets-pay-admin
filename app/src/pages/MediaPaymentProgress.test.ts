import { describe, expect, it } from 'vitest';
import type {
  CreatorId,
  EngagementId,
  InvoiceId,
  PaymentRequestProjectId,
  RequestApprovalState,
} from '../businessWorkflow';
import type { Payout, PayoutStatus } from '../types';
import {
  buildMyProjectRequestProgress,
  type MyProjectRequestProgressStep,
} from './MediaPaymentProjectsPage';
import type { RequestProjectSummary } from './RequestProjectDetailPage';

const requestProjectId = 'request-progress-internal' as PaymentRequestProjectId;
const invoiceId = 'invoice-progress' as InvoiceId;

const approval = (
  status: RequestApprovalState['status'],
  overrides: Partial<RequestApprovalState> = {},
): RequestApprovalState => ({
  status,
  round: 2,
  history: [],
  submittedAt: '2026-08-10T02:00:00.000Z',
  updatedAt: '2026-08-10T04:00:00.000Z',
  ...overrides,
});

const baseRequest = (overrides: Partial<RequestProjectSummary> = {}): RequestProjectSummary => ({
  id: 'request-progress',
  paymentRequestProjectId: requestProjectId,
  requestCode: 'REQ-PROGRESS-01',
  lifecycle: 'DRAFT',
  creatorLinks: [{
    creatorId: 'creator-progress' as CreatorId,
    engagementId: 'engagement-progress' as EngagementId,
    contractIds: [],
    invoiceIds: [invoiceId],
  }],
  project: '进度测试项目',
  brand: '测试品牌',
  media: '测试媒介',
  pm: '测试 PM',
  paymentChannel: 'Airwallex',
  expectedPaymentDate: '2026-08-20',
  amount: 'USD 1,200',
  contracts: 0,
  invoices: 1,
  paymentOrder: '待生成',
  status: '草稿',
  filter: 'pending',
  createdAt: '2026-08-09T02:00:00.000Z',
  generatedDetail: {
    brand: '测试品牌',
    reason: '进度规则测试',
    contractId: '未关联',
    contractName: '合同选填，当前未关联',
    contractAmount: 'USD 0',
    contractStatus: '未关联',
    invoiceId: 'INV-PROGRESS-01',
    invoiceAmount: 'USD 1,200',
    invoiceStatus: '待提交',
    paymentListId: 'PAY-PROGRESS-01',
    paymentListStatus: '已生成',
    payee: '测试达人',
    provider: 'Airwallex',
    beneficiaryId: 'prototype-beneficiary',
    feePolicy: 'SHA',
  },
  ...overrides,
});

const payout = (status: PayoutStatus, overrides: Partial<Payout> = {}): Payout => ({
  id: `payout-${status}`,
  paymentRequestProjectId: requestProjectId,
  creator: '测试达人',
  handle: '@progress',
  initials: 'PT',
  projectId: 'project-progress',
  project: '进度测试项目',
  contract: '未关联',
  invoice: 'INV-PROGRESS-01',
  provider: 'Airwallex',
  currency: 'USD',
  amount: 1200,
  account: 'prototype-account',
  status,
  invoiceReviewStatus: '已通过',
  accent: '#64748b',
  ...overrides,
});

const progressFor = (
  request: RequestProjectSummary,
  payouts: Payout[] = [],
  submissionIssues: string[] = [],
) => buildMyProjectRequestProgress({ request, invoices: [], payouts, submissionIssues });

const stepFor = (progress: MyProjectRequestProgressStep[], label: string) => {
  const step = progress.find((candidate) => candidate.label === label);
  if (!step) throw new Error(`Missing progress step: ${label}`);
  return step;
};

describe('My Projects payment request progress', () => {
  it('keeps incomplete draft resources at the Invoice stage', () => {
    const request = baseRequest({
      creatorLinks: [{
        creatorId: 'creator-progress' as CreatorId,
        engagementId: 'engagement-progress' as EngagementId,
        contractIds: [],
        invoiceIds: [],
      }],
      invoices: 0,
    });
    const progress = progressFor(request, [], ['缺少 Invoice']);

    expect(progress.map((step) => step.label)).toEqual([
      '项目创建',
      '补充合同',
      '关联 Invoice',
      '提交审核',
      'PM 审批',
      '项目负责人审批',
      '老板审批',
      '财务审批',
      '渠道打款',
    ]);
    expect(stepFor(progress, '补充合同')).toMatchObject({ state: 'complete', time: '已跳过' });
    expect(stepFor(progress, '关联 Invoice')).toMatchObject({ state: 'current' });
    expect(stepFor(progress, '提交审核')).toMatchObject({ state: 'pending' });
  });

  it('moves a complete draft to the submit stage', () => {
    const progress = progressFor(baseRequest());

    expect(stepFor(progress, '关联 Invoice')).toMatchObject({ state: 'complete' });
    expect(stepFor(progress, '提交审核')).toMatchObject({
      state: 'current',
      description: '资料完整，可以提交审核',
    });
    expect(stepFor(progress, '渠道打款')).toMatchObject({ state: 'pending' });
  });

  it('shows the live approval node and round after submission', () => {
    const request = baseRequest({
      lifecycle: 'SUBMITTED',
      status: '财务审批中',
      approval: approval('PENDING_FINANCE'),
    });
    const progress = progressFor(request);

    expect(stepFor(progress, '提交审核')).toMatchObject({
      state: 'complete',
      description: '第 2 轮 · 已提交审批',
    });
    expect(stepFor(progress, '财务审批')).toMatchObject({
      state: 'current',
      description: '第 2 轮 · 等待财务审批',
    });
    expect(stepFor(progress, 'PM 审批')).toMatchObject({ state: 'complete' });
    expect(stepFor(progress, '项目负责人审批')).toMatchObject({ state: 'complete' });
    expect(stepFor(progress, '老板审批')).toMatchObject({ state: 'complete' });
    expect(stepFor(progress, '渠道打款')).toMatchObject({ state: 'pending' });
  });

  it.each([
    ['PENDING_PM', 'PM 审批'],
    ['PENDING_PROJECT_OWNER', '项目负责人审批'],
    ['PENDING_OWNER', '老板审批'],
    ['PENDING_FINANCE', '财务审批'],
  ] as const)('marks %s as the only active approval stage', (status, label) => {
    const progress = progressFor(baseRequest({
      lifecycle: 'SUBMITTED',
      approval: approval(status),
    }));

    expect(stepFor(progress, label)).toMatchObject({ state: 'current' });
    expect(progress.filter((step) => step.state === 'current')).toHaveLength(1);
  });

  it('unlocks channel payment only after finance approval', () => {
    const request = baseRequest({
      lifecycle: 'APPROVED',
      status: '待打款',
      approval: approval('APPROVED'),
    });
    const progress = progressFor(request, [payout('等待付款')]);

    expect(stepFor(progress, '提交审核')).toMatchObject({ state: 'complete' });
    ['PM 审批', '项目负责人审批', '老板审批', '财务审批'].forEach((label) => {
      expect(stepFor(progress, label)).toMatchObject({ state: 'complete' });
    });
    expect(stepFor(progress, '渠道打款')).toMatchObject({
      state: 'current',
      description: '1 笔付款等待执行',
    });
  });

  it('keeps processing and partial results at the payment stage', () => {
    const request = baseRequest({
      lifecycle: 'APPROVED',
      status: '待打款',
      approval: approval('APPROVED'),
    });
    const progress = progressFor(request, [
      payout('已付款', { id: 'payout-paid' }),
      payout('付款处理中', { id: 'payout-processing' }),
    ]);

    expect(stepFor(progress, '渠道打款')).toMatchObject({
      state: 'current',
      description: '1 笔付款处理中',
      time: '已付款 1 / 2 笔',
    });
  });

  it('completes channel payment only after every linked payout is paid', () => {
    const request = baseRequest({
      lifecycle: 'APPROVED',
      status: '待打款',
      approval: approval('APPROVED'),
    });
    const progress = progressFor(request, [
      payout('已付款', { id: 'payout-paid-1' }),
      payout('已付款', { id: 'payout-paid-2', paidAt: '2026-08-11T05:00:00.000Z' }),
    ]);

    expect(stepFor(progress, '渠道打款')).toMatchObject({
      state: 'complete',
      description: '2 笔付款均已完成',
    });
  });

  it('ignores payouts that belong to another request project', () => {
    const request = baseRequest({
      lifecycle: 'APPROVED',
      status: '待打款',
      approval: approval('APPROVED'),
    });
    const progress = progressFor(request, [
      payout('已付款', { id: 'payout-current-request' }),
      payout('等待付款', {
        id: 'payout-other-request',
        paymentRequestProjectId: 'request-progress-other' as PaymentRequestProjectId,
      }),
    ]);

    expect(stepFor(progress, '渠道打款')).toMatchObject({
      state: 'complete',
      description: '1 笔付款均已完成',
    });
  });

  it('returns ordinary approval issues to the submit stage', () => {
    const returnedApproval = approval('RETURNED_TO_MEDIA_REVIEW', {
      returnedFromStage: 'FINANCE',
      resumeStatus: 'PENDING_FINANCE',
      returnReason: '付款资料需要修改',
      history: [{
        round: 2,
        stage: 'FINANCE',
        action: 'RETURN',
        actorAccount: 'finance.progress',
        actorName: '测试财务',
        actorRole: '财务账号',
        fromStatus: 'PENDING_FINANCE',
        toStatus: 'RETURNED_TO_MEDIA_REVIEW',
        reason: '付款资料需要修改',
        occurredAt: '2026-08-10T04:00:00.000Z',
      }],
    });
    const progress = progressFor(baseRequest({
      lifecycle: 'RETURNED',
      status: '已退回',
      approval: returnedApproval,
    }));

    expect(stepFor(progress, '提交审核')).toMatchObject({
      state: 'current',
      description: '财务审核已退回，待修改后重新提交',
    });
    expect(stepFor(progress, '财务审批')).toMatchObject({
      state: 'returned',
      description: '测试财务已退回：付款资料需要修改',
    });
    expect(stepFor(progress, 'PM 审批')).toMatchObject({ state: 'complete' });
    expect(stepFor(progress, '项目负责人审批')).toMatchObject({ state: 'complete' });
    expect(stepFor(progress, '老板审批')).toMatchObject({ state: 'complete' });
    expect(stepFor(progress, '渠道打款')).toMatchObject({ state: 'pending' });
  });

  it('resumes a new round at the returned stage without resetting earlier approvals', () => {
    const progress = progressFor(baseRequest({
      lifecycle: 'SUBMITTED',
      status: '财务审批中',
      approval: approval('PENDING_FINANCE', {
        round: 3,
        submittedAt: '2026-08-12T02:00:00.000Z',
        updatedAt: '2026-08-12T02:00:00.000Z',
        history: [{
          round: 2,
          stage: 'PM',
          action: 'APPROVE',
          actorAccount: 'pm.progress',
          actorName: '测试 PM',
          actorRole: 'PM',
          fromStatus: 'PENDING_PM',
          toStatus: 'PENDING_PROJECT_OWNER',
          occurredAt: '2026-08-10T02:30:00.000Z',
        }],
      }),
    }));

    expect(stepFor(progress, '提交审核')).toMatchObject({
      state: 'complete',
      description: '第 3 轮 · 已提交审批',
    });
    expect(stepFor(progress, 'PM 审批')).toMatchObject({
      state: 'complete',
      description: '测试 PM 已审批通过',
    });
    expect(stepFor(progress, '项目负责人审批')).toMatchObject({ state: 'complete' });
    expect(stepFor(progress, '老板审批')).toMatchObject({ state: 'complete' });
    expect(stepFor(progress, '财务审批')).toMatchObject({ state: 'current' });
  });

  it('terminates submission and payment while leaving approval stages pending after cancellation', () => {
    const progress = progressFor(baseRequest({
      lifecycle: 'CANCELLED',
      status: '已取消',
      cancelReason: '项目终止',
      cancelledAt: '2026-08-12T03:00:00.000Z',
    }));

    expect(stepFor(progress, '提交审核')).toMatchObject({
      state: 'current',
      description: '请款已取消：项目终止',
    });
    ['PM 审批', '项目负责人审批', '老板审批', '财务审批'].forEach((label) => {
      expect(stepFor(progress, label)).toMatchObject({ state: 'pending' });
    });
    expect(stepFor(progress, '渠道打款')).toMatchObject({ state: 'pending', time: '已终止' });
  });

  it('keeps payment-failure recovery at the payment stage', () => {
    const request = baseRequest({
      lifecycle: 'RETURNED',
      status: '部分打款失败',
      approval: approval('RETURNED_TO_MEDIA_REVIEW', {
        returnedFromStage: 'FINANCE',
        resumeStatus: 'PENDING_FINANCE',
      }),
    });
    const progress = progressFor(request, [payout('已退回', {
      paymentFailureRecovery: {
        status: 'AWAITING_CREATOR_UPDATE',
        notifications: [],
      },
    })]);

    expect(stepFor(progress, '提交审核')).toMatchObject({ state: 'complete' });
    expect(stepFor(progress, '财务审批')).toMatchObject({ state: 'complete' });
    expect(stepFor(progress, '渠道打款')).toMatchObject({
      state: 'current',
      description: '1 笔付款异常，待修正后重新发起',
    });
  });
});
