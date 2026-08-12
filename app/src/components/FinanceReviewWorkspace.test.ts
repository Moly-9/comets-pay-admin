import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PaymentListRecord } from '../businessWorkflow';
import type { RequestProjectSummary } from '../pages/RequestProjectDetailPage';
import {
  ApprovalTimeline,
  FINANCE_RETURN_ISSUE_OPTIONS,
  projectPaymentListsForFinanceReview,
} from './FinanceReviewWorkspace';

describe('FinanceReviewWorkspace return issue types', () => {
  it('requires finance to choose the exact resource that media may modify', () => {
    expect(FINANCE_RETURN_ISSUE_OPTIONS).toEqual([
      {
        value: 'INVOICE_CONTENT',
        label: 'Invoice 原因',
        description: '仅开放该份 Invoice 修改权限',
      },
      {
        value: 'PAYMENT_LIST',
        label: '付款清单原因',
        description: '仅开放对应付款明细修改权限',
      },
    ]);
  });
});

describe('FinanceReviewWorkspace project payment-list export', () => {
  it('collects every unique payment list linked to the current request', () => {
    const lists = [
      { paymentListId: 'list-airwallex', paymentRequestProjectId: 'request-one' },
      { paymentListId: 'list-paypal', paymentRequestProjectId: 'request-one' },
      { paymentListId: 'list-airwallex', paymentRequestProjectId: 'request-one' },
      { paymentListId: 'list-explicit', paymentRequestProjectId: 'request-other' },
      { paymentListId: 'list-unrelated', paymentRequestProjectId: 'request-other' },
    ] as unknown as PaymentListRecord[];

    const result = projectPaymentListsForFinanceReview({
      paymentRequestProjectId: 'request-one' as RequestProjectSummary['paymentRequestProjectId'],
      paymentListIds: ['list-explicit'] as RequestProjectSummary['paymentListIds'],
    }, lists);

    expect(result.map((list) => list.paymentListId)).toEqual([
      'list-airwallex',
      'list-paypal',
      'list-explicit',
    ]);
  });
});

describe('FinanceReviewWorkspace approval timeline', () => {
  it('renders a compact two-column curved flow with only stage and account content', () => {
    const request = {
      media: 'media.demo',
      pm: 'pm.demo',
      approval: {
        status: 'PENDING_FINANCE',
        round: 1,
        submittedAt: '2026-08-10T08:00:00.000Z',
        updatedAt: '2026-08-10T09:00:00.000Z',
        history: [{
          round: 1,
          stage: 'PM',
          action: 'APPROVE',
          actorAccount: 'fixture-pm',
          actorName: '测试 PM',
          actorRole: 'PM 账号',
          fromStatus: 'PENDING_PM',
          toStatus: 'PENDING_PROJECT_OWNER',
          occurredAt: '2026-08-10T08:10:00.000Z',
        }],
      },
    } as unknown as RequestProjectSummary;

    const html = renderToStaticMarkup(createElement(ApprovalTimeline, { request, compact: true }));

    expect(html).toContain('请款提交');
    expect(html).toContain('@media.demo');
    expect(html).toContain('PM 审批');
    expect(html).toContain('@fixture-pm');
    expect(html).toContain('class="finance-approval-curve"');
    expect(html).toContain('class="lucide lucide-send finance-approval-stage-icon"');
    expect(html).toContain('class="lucide lucide-clipboard-check finance-approval-stage-icon"');
    expect(html).toContain('class="lucide lucide-landmark finance-approval-stage-icon"');
    expect(html).toContain('class="lucide lucide-credit-card finance-approval-stage-icon"');
    expect(html).toContain('class="lucide lucide-refresh-cw finance-approval-stage-icon"');
    expect(html).toContain('class="finance-approval-state-mark"');
    expect(html).toContain('class="finance-approval-curve-progress"');
    expect(html).toContain('<mask id="finance-approval-curve-mask-');
    expect(html).toContain('maskUnits="userSpaceOnUse"');
    expect(html).toContain('r="19"');
    expect(html).toContain('<g mask="url(#finance-approval-curve-mask-');
    expect(html).toContain('财务审批，账号 finance，当前节点');
    expect(html).toContain('grid-column:1;grid-row:1');
    expect(html).toContain('grid-column:2;grid-row:1');
    expect(html).toContain('grid-column:2;grid-row:2');
    expect(html).not.toContain('lucide-git-branch');
    expect(html).not.toContain('当前轮次已审批通过');
    expect(html).not.toContain('第 1 轮审批已提交');
    expect(html).not.toContain('finance-approval-actor');
    expect(html).not.toContain('<time');
  });
});
