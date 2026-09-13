import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  beginPaymentFailureAccountRecovery,
  recordPaymentFailureNotification,
  simulateCreatorAccountUpdated,
} from '../paymentFailureRecovery';
import type { Payout } from '../types';
import {
  BatchWizardPage,
  batchWizardSelectionScopeIssue,
  buildBatchWizardRows,
  filterBatchWizardRows,
  type BatchWizardRequestProject,
} from './BatchWizardPage';

const retryPayout = (): Payout => ({
  id: 'retry-payout',
  paymentRequestProjectId: 'request-1' as NonNullable<Payout['paymentRequestProjectId']>,
  creator: 'Retry Creator',
  creatorId: 'creator-1' as NonNullable<Payout['creatorId']>,
  handle: '@retry',
  initials: 'RC',
  projectId: 'project-1',
  project: 'Retry Project',
  contract: 'CON-1',
  invoice: 'INV-RETRY-1',
  provider: 'Airwallex',
  currency: 'USD',
  amount: 1800,
  account: 'prototype account',
  payoutAccountId: 'account-1',
  payoutAccountVersion: 'v1',
  payoutAccountFingerprint: 'fp-v1',
  externalBeneficiaryId: 'beneficiary-v1',
  transferMethod: 'LOCAL',
  localClearingSystem: 'ACH',
  feeBearer: 'ADVERTISER',
  status: '付款失败',
  invoiceReviewStatus: '已通过',
  accent: '#64748b',
  paymentFailure: {
    provider: 'Airwallex',
    errorCode: 'BENEFICIARY_DISABLED',
    providerResponse: 'Beneficiary disabled',
    occurredAt: '2026-08-10T10:00:00.000Z',
  },
  paymentFailureReturn: {
    issueType: 'PAYMENT_LIST',
    reason: '请更新收款账户',
    actorAccount: 'finance',
    actorName: '财务人员',
    occurredAt: '2026-08-10T10:05:00.000Z',
    restartStage: 'PAYMENT_LIST_RESUBMISSION',
  },
});

const requestProject = (overrides: Partial<BatchWizardRequestProject> = {}): BatchWizardRequestProject => ({
  id: 'request-summary-1',
  paymentRequestProjectId: 'request-1' as NonNullable<Payout['paymentRequestProjectId']>,
  requestCode: 'REQ-202609-000001',
  cooperationProjectId: 'project-1' as NonNullable<BatchWizardRequestProject['cooperationProjectId']>,
  cooperationProjectCode: 'PRJ-260901-01',
  cooperationProjectName: '合作项目一',
  projectId: 'project-1' as NonNullable<BatchWizardRequestProject['projectId']>,
  project: '合作项目一',
  ...overrides,
});

describe('BatchWizardPage payment failure retries', () => {
  it('shows an awaiting retry immediately, unchecked and disabled', () => {
    const payout = beginPaymentFailureAccountRecovery(retryPayout());
    const html = renderToStaticMarkup(
      <BatchWizardPage payouts={[payout]} onCancel={vi.fn()} onSubmit={vi.fn()} onDraft={vi.fn()} />,
    );

    expect(html).toContain('Retry Creator');
    expect(html).toContain('失败重试');
    expect(html).toContain('尚未更新');
    expect(html).toContain('aria-label="选择 Retry Creator" type="checkbox" disabled=""');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" checked=""');
  });

  it('makes a creator-side validated update immediately retryable', () => {
    const started = beginPaymentFailureAccountRecovery(retryPayout());
    const notified = recordPaymentFailureNotification(
      started,
      { account: 'media', name: '项目媒介' },
      '请更新收款账户',
      'creator@example.com',
    );
    const ready = simulateCreatorAccountUpdated(notified);
    const html = renderToStaticMarkup(
      <BatchWizardPage payouts={[ready]} onCancel={vi.fn()} onSubmit={vi.fn()} onDraft={vi.fn()} />,
    );

    expect(html).toContain('达人已更新 · 可重试');
    expect(html).toContain('aria-label="选择 Retry Creator" type="checkbox"');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" disabled=""');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" checked=""');
  });

  it('keeps legacy validated update states retryable without finance confirmation', () => {
    const started = beginPaymentFailureAccountRecovery(retryPayout());
    const notified = recordPaymentFailureNotification(
      started,
      { account: 'media', name: '项目媒介' },
      '请更新收款账户',
      'creator@example.com',
    );
    const current = simulateCreatorAccountUpdated(notified);
    const ready = {
      ...current,
      paymentFailureRecovery: current.paymentFailureRecovery ? {
        ...current.paymentFailureRecovery,
        status: 'PENDING_FINANCE_CONFIRMATION' as const,
        readyReason: undefined,
      } : undefined,
    };
    const html = renderToStaticMarkup(
      <BatchWizardPage payouts={[ready]} onCancel={vi.fn()} onSubmit={vi.fn()} onDraft={vi.fn()} />,
    );

    expect(html).toContain('达人已更新 · 可重试');
    expect(html).toContain('aria-label="选择 Retry Creator" type="checkbox"');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" disabled=""');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" checked=""');
  });

  it('refreshes the validation status as soon as the creator account update is recorded', () => {
    const notified = recordPaymentFailureNotification(
      beginPaymentFailureAccountRecovery(retryPayout()),
      { account: 'media', name: '项目媒介' },
      '请更新收款账户',
      'creator@example.com',
    );
    const updated = simulateCreatorAccountUpdated(notified);
    const html = renderToStaticMarkup(
      <BatchWizardPage payouts={[updated]} onCancel={vi.fn()} onSubmit={vi.fn()} onDraft={vi.fn()} />,
    );

    expect(html).toContain('达人已更新 · 可重试');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" disabled=""');
  });

  it('makes an unchanged account selectable immediately after the failure notice', () => {
    const ready = recordPaymentFailureNotification(
      beginPaymentFailureAccountRecovery(retryPayout()),
      { account: 'media', name: '项目媒介' },
      '付款失败，请确认原账户是否仍可使用',
      'creator@example.com',
    );
    const html = renderToStaticMarkup(
      <BatchWizardPage payouts={[ready]} onCancel={vi.fn()} onSubmit={vi.fn()} onDraft={vi.fn()} />,
    );

    expect(html).toContain('原账户未变 · 可重试');
    expect(html).toContain('aria-label="选择 Retry Creator" type="checkbox"');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" disabled=""');
  });

  it('renders the requested toolbar order and exact payment columns without Invoice content', () => {
    const html = renderToStaticMarkup(
      <BatchWizardPage
        payouts={[retryPayout()]}
        requests={[requestProject()]}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        onDraft={vi.fn()}
      />,
    );

    expect(html.indexOf('aria-label="搜索付款"')).toBeLessThan(html.indexOf('aria-label="按合作项目筛选付款"'));
    expect(html.indexOf('aria-label="按合作项目筛选付款"')).toBeLessThan(html.indexOf('已选择的付款'));
    expect(html).toContain('<th class="batch-wizard-col-creator">达人</th>');
    expect(html).toContain('<th class="batch-wizard-col-request">请款编号</th>');
    expect(html).toContain('<th class="batch-wizard-col-project">合作项目</th>');
    expect(html).toContain('<th class="batch-wizard-col-account">银行账号</th>');
    expect(html).toContain('<th class="batch-wizard-col-validation">账户校验</th>');
    expect(html).toContain('REQ-202609-000001');
    expect(html).toContain('合作项目一');
    expect(html).not.toContain('INV-RETRY-1');
  });

  it('combines creator/request search with stable cooperation-project filtering', () => {
    const secondPayout = {
      ...retryPayout(),
      id: 'retry-payout-2',
      paymentRequestProjectId: 'request-2' as NonNullable<Payout['paymentRequestProjectId']>,
      creator: 'Second Creator',
      projectId: 'project-2',
      project: '合作项目二',
      invoice: 'INV-ONLY-SEARCH',
    };
    const rows = buildBatchWizardRows({
      payouts: [retryPayout(), secondPayout],
      requests: [
        requestProject(),
        requestProject({
          id: 'request-summary-2',
          paymentRequestProjectId: 'request-2' as NonNullable<Payout['paymentRequestProjectId']>,
          requestCode: 'REQ-202609-000002',
          cooperationProjectId: 'project-2' as NonNullable<BatchWizardRequestProject['cooperationProjectId']>,
          cooperationProjectCode: 'PRJ-260901-02',
          cooperationProjectName: '合作项目二',
          projectId: 'project-2' as NonNullable<BatchWizardRequestProject['projectId']>,
          project: '合作项目二',
        }),
      ],
      generatedInvoices: [],
      paymentLists: [],
      creators: [],
    });

    expect(filterBatchWizardRows(rows, 'REQ-202609-000002', 'all').map((row) => row.payout.id)).toEqual(['retry-payout-2']);
    expect(filterBatchWizardRows(rows, 'Second Creator', 'project-2').map((row) => row.payout.id)).toEqual(['retry-payout-2']);
    expect(filterBatchWizardRows(rows, 'Second Creator', 'project-1')).toEqual([]);
    expect(filterBatchWizardRows(rows, 'INV-ONLY-SEARCH', 'all')).toEqual([]);
  });

  it('locks batch selection to one request, provider, payment type, and original order', () => {
    const readyRetry = recordPaymentFailureNotification(
      beginPaymentFailureAccountRecovery(retryPayout()),
      { account: 'media', name: '项目媒介' },
      '原账户未变，可重试',
      'creator@example.com',
    );
    const baseRows = buildBatchWizardRows({
      payouts: [readyRetry, { ...readyRetry, id: 'other' }],
      requests: [requestProject()],
      generatedInvoices: [],
      paymentLists: [],
      creators: [],
    });
    const selectedRow = { ...baseRows[0], sourcePaymentOrderKey: 'PAY-2609010001' };

    expect(batchWizardSelectionScopeIssue({
      ...baseRows[1],
      requestKey: 'request-2',
    }, selectedRow)).toBe('一个付款批次只能关联一个请款项目');
    expect(batchWizardSelectionScopeIssue({
      ...baseRows[1],
      payout: { ...baseRows[1].payout, provider: 'PayPal' },
    }, selectedRow)).toBe('一个付款批次只能使用同一付款渠道');
    expect(batchWizardSelectionScopeIssue({
      ...baseRows[1],
      payout: { ...baseRows[1].payout, paymentFailureRecovery: undefined },
    }, selectedRow)).toBe('首次付款和重新付款需要分别创建付款批次');
    expect(batchWizardSelectionScopeIssue({
      ...baseRows[1],
      sourcePaymentOrderKey: 'PAY-2609010002',
    }, selectedRow)).toBe('重新付款只能选择同一张原付款单的失败明细');
    expect(batchWizardSelectionScopeIssue({
      ...baseRows[1],
      sourcePaymentOrderKey: selectedRow.sourcePaymentOrderKey,
    }, selectedRow)).toBe('');
  });
});
