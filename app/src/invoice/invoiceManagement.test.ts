import { describe, expect, it } from 'vitest';
import type { RequestApprovalState } from '../businessWorkflow';
import type { PaymentRequestProjectLike } from '../paymentRequestProjects';
import type { Payout } from '../types';
import {
  filterInvoiceManagementRows,
  getInvoiceManagementReturnContext,
  getInvoiceManagementView,
  type InvoiceManagementRow,
} from './invoiceManagement';

const payout = (invoiceReviewStatus: Payout['invoiceReviewStatus'], status: Payout['status'] = '未进入付款') => ({
  invoiceReviewStatus,
  status,
});

const request = (
  status: RequestApprovalState['status'],
  lifecycle: PaymentRequestProjectLike['lifecycle'] = 'SUBMITTED',
): PaymentRequestProjectLike => ({
  id: 'request-test',
  lifecycle,
  approval: {
    status,
    round: 1,
    history: [],
    submittedAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
  },
});

const fullPayout = (overrides: Partial<Payout> = {}): Payout => ({
  id: 'payout-test',
  creator: 'Test Creator',
  handle: '@test',
  initials: 'TC',
  projectId: 'project-test',
  project: 'Test Project',
  contract: 'CON-TEST',
  invoice: 'INV-TEST',
  provider: 'Airwallex',
  currency: 'USD',
  amount: 100,
  account: '****0000',
  status: '未进入付款',
  invoiceReviewStatus: '已通过',
  accent: '#64748b',
  ...overrides,
});

const managementRow = (overrides: Partial<InvoiceManagementRow> = {}): InvoiceManagementRow => ({
  rowId: 'payout:payout-test',
  invoiceId: 'invoice-test',
  invoiceType: 'INTERNAL',
  creatorName: 'Test Creator',
  channelId: '@test',
  issuerName: 'Test Creator Limited',
  initials: 'TC',
  accent: '#64748b',
  projectKey: 'project-test',
  projectName: 'Test Project',
  invoiceNumber: 'INV-TEST',
  provider: 'Airwallex',
  status: '已通过',
  currency: 'USD',
  amount: 100,
  actionLabel: '查看详情',
  source: { kind: 'payout', payout: fullPayout() },
  ...overrides,
});

const returnedRequest = (issueType?: 'INVOICE_CONTENT' | 'PAYMENT_LIST'): PaymentRequestProjectLike => {
  const base = request('RETURNED_TO_MEDIA_REVIEW', 'RETURNED');
  if (!issueType || !base.approval) return base;
  const returnItems = [{
    pageKey: 'invoice:invoice-test',
    invoiceId: 'invoice-test' as never,
    invoiceNumber: 'INV-TEST',
    issueType,
    reason: issueType === 'INVOICE_CONTENT' ? 'Invoice 金额错误' : '付款账户需要更新',
    paymentItems: [],
  }];
  return {
    ...base,
    approval: {
      ...base.approval,
      returnedFromStage: 'FINANCE',
      resumeStatus: 'PENDING_FINANCE',
      returnItems,
      history: [{
        round: 1,
        stage: 'FINANCE',
        action: 'RETURN',
        actorAccount: 'finance',
        actorName: '财务审核人',
        actorRole: '财务',
        fromStatus: 'PENDING_FINANCE',
        toStatus: 'RETURNED_TO_MEDIA_REVIEW',
        reason: returnItems[0].reason,
        returnItems,
        occurredAt: '2026-08-09T01:00:00.000Z',
      }],
    },
  };
};

describe('Invoice management presentation', () => {
  it('combines project, provider, status and Invoice type filters', () => {
    const rows = [
      managementRow(),
      managementRow({
        rowId: 'payout:payout-paypal',
        invoiceId: 'invoice-paypal',
        invoiceType: 'EXTERNAL',
        projectKey: 'project-other',
        projectName: 'Other Project',
        invoiceNumber: 'INV-PAYPAL',
        provider: 'PayPal',
        status: '付款中',
      }),
      managementRow({
        rowId: 'payout:payout-paymax',
        invoiceId: 'invoice-paymax',
        projectKey: 'project-test',
        invoiceNumber: 'INV-PAYMAX',
        provider: 'PayMax',
        status: '已付款',
      }),
    ];

    expect(filterInvoiceManagementRows(rows, {
      search: '',
      projectKeys: ['project-other'],
      provider: 'PayPal',
      status: '付款中',
      invoiceType: 'EXTERNAL',
    }).map((row) => row.invoiceId)).toEqual(['invoice-paypal']);

    expect(filterInvoiceManagementRows(rows, {
      search: 'paymax',
      projectKeys: ['project-test', 'project-other'],
      provider: 'all',
      status: 'all',
      invoiceType: 'all',
    }).map((row) => row.invoiceId)).toEqual(['invoice-paymax']);
  });

  it('uses the expected management groups without an approval tab', () => {
    expect(getInvoiceManagementView(payout('草稿'))).toMatchObject({ tab: 'signature', status: '草稿' });
    expect(getInvoiceManagementView(payout('待签署'))).toMatchObject({ tab: 'signature', status: '待签署' });
    expect(getInvoiceManagementView(payout('待媒介审核'))).toMatchObject({ tab: 'review', status: '待审核' });
    expect(getInvoiceManagementView(payout('已通过'))).toMatchObject({ tab: 'approved', status: '已通过' });
    expect(getInvoiceManagementView(payout('已退回'))).toMatchObject({ tab: 'approved', status: '已通过' });
  });

  it.each(['PENDING_PM', 'PENDING_PROJECT_OWNER', 'PENDING_OWNER', 'PENDING_FINANCE'] as const)(
    'presents %s as OA approval in the approved tab',
    (status) => {
      expect(getInvoiceManagementView(payout('已通过'), request(status))).toMatchObject({
        tab: 'approved',
        status: 'OA审批中',
      });
    },
  );

  it('presents payment and paid states after project approval', () => {
    expect(getInvoiceManagementView(payout('已通过', '等待付款'), request('APPROVED', 'APPROVED')).status).toBe('付款中');
    expect(getInvoiceManagementView(payout('已通过', '已付款'), request('APPROVED', 'COMPLETED')).status).toBe('已付款');
  });

  it('keeps an Invoice approved when only the request project was returned', () => {
    expect(getInvoiceManagementView(
      payout('已通过'),
      request('RETURNED_TO_MEDIA_REVIEW', 'RETURNED'),
    )).toMatchObject({ tab: 'approved', status: '已通过' });
  });

  it('returns only a finance-scoped Invoice-content detail', () => {
    const targetPayout = fullPayout();
    const targetRequest = returnedRequest('INVOICE_CONTENT');
    const returnContext = getInvoiceManagementReturnContext(
      targetPayout,
      'invoice-test' as never,
      targetRequest,
    );

    expect(returnContext).toEqual({
      source: 'APPROVAL_INVOICE',
      sourceLabel: '财务退回 · Invoice',
      reason: 'Invoice 金额错误',
      actorName: '财务审核人',
      occurredAt: '2026-08-09T01:00:00.000Z',
    });
    expect(getInvoiceManagementView(targetPayout, targetRequest, returnContext))
      .toMatchObject({ tab: 'returned', status: '已退回' });
    expect(getInvoiceManagementReturnContext(
      targetPayout,
      'another-invoice' as never,
      targetRequest,
    )).toBeNull();

    const correctedPayout = fullPayout({
      invoiceReviewStatus: '待签署',
      invoiceReviewHistory: [{
        stage: 'SIGNATURE',
        action: '修改 Invoice',
        actorAccount: 'media',
        actorName: '媒介',
        actorRole: '媒介',
        fromStatus: '已通过',
        toStatus: '待签署',
        occurredAt: '2026-08-09T02:00:00.000Z',
      }],
    });
    expect(getInvoiceManagementReturnContext(
      correctedPayout,
      'invoice-test' as never,
      targetRequest,
    )).toBeNull();
    expect(getInvoiceManagementView(correctedPayout, targetRequest)).toMatchObject({
      tab: 'signature',
      status: '待签署',
    });
  });

  it('keeps payment-list returns and unclassified failures in payment', () => {
    const paymentListReturn = returnedRequest('PAYMENT_LIST');
    const accountFailure = fullPayout({
      status: '已退回',
      paymentFailureReturn: {
        issueType: 'PAYMENT_LIST',
        reason: '付款账户需要更新',
        actorAccount: 'finance',
        actorName: '财务审核人',
        occurredAt: '2026-08-09T01:00:00.000Z',
        restartStage: 'PAYMENT_LIST_RESUBMISSION',
      },
      paymentFailureRecovery: { status: 'AWAITING_CREATOR_UPDATE', notifications: [] },
    });
    const unclassifiedFailure = fullPayout({ status: '付款失败' });

    expect(getInvoiceManagementReturnContext(accountFailure, 'invoice-test' as never, paymentListReturn)).toBeNull();
    expect(getInvoiceManagementView(accountFailure, paymentListReturn)).toMatchObject({
      tab: 'approved',
      status: '付款中',
    });
    expect(getInvoiceManagementView(unclassifiedFailure)).toMatchObject({
      tab: 'approved',
      status: '付款中',
    });
  });

  it('returns only the failed payment selected as an Invoice issue', () => {
    const targetPayout = fullPayout({
      status: '已退回',
      invoiceReviewStatus: '已退回',
      paymentFailureReturn: {
        issueType: 'INVOICE_CONTENT',
        reason: 'Invoice 内容错误',
        actorAccount: 'finance',
        actorName: '财务审核人',
        occurredAt: '2026-08-09T01:00:00.000Z',
        restartStage: 'SIGNATURE',
      },
    });
    const returnContext = getInvoiceManagementReturnContext(targetPayout, 'invoice-test' as never);

    expect(returnContext?.source).toBe('PAYMENT_FAILURE_INVOICE');
    expect(getInvoiceManagementView(targetPayout, undefined, returnContext)).toMatchObject({
      tab: 'returned',
      status: '已退回',
    });
    expect(getInvoiceManagementView(fullPayout({ status: '已付款' }))).toMatchObject({
      tab: 'approved',
      status: '已付款',
    });
  });

  it('shows a changed returned-project Invoice in its new signature workflow', () => {
    expect(getInvoiceManagementView(
      payout('待签署'),
      request('RETURNED_TO_MEDIA_REVIEW', 'RETURNED'),
    )).toMatchObject({ tab: 'signature', status: '待签署' });
  });
});
