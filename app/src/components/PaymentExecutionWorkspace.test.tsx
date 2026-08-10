import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';
import { buildPaymentProjectRows } from '../pages/PaymentWorkbenchPage';
import { returnApprovedRequestToMediaReview } from '../requestApprovalWorkflow';
import { PaymentExecutionWorkspace } from './PaymentExecutionWorkspace';

vi.mock('react-dom', () => ({
  createPortal: (children: ReactNode) => children,
}));
vi.stubGlobal('document', { body: {} });

describe('PaymentExecutionWorkspace', () => {
  it('shows project information, creator payment summaries, approval flow, and the payment action', () => {
    const project = buildPaymentProjectRows({
      tab: 'payment',
      payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
      requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    })[0];
    const request = INITIAL_COMPLETE_REQUEST_RESOURCES.requests.find((candidate) => (
      candidate.id === project.requestId
    ));

    expect(request).toBeTruthy();
    const html = renderToStaticMarkup(
      <PaymentExecutionWorkspace
        request={request!}
        project={project}
        canExecute
        onExecute={vi.fn(() => true)}
        onReturn={vi.fn(() => true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain(`${project.requestCode} · 执行打款`);
    expect(html).toContain('请款项目信息');
    expect(html).toContain('达人请款信息概览');
    expect(html).toContain('aria-label="请款项目与达人请款信息"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain(`共 ${project.payouts.length} 位达人`);
    expect(html).toContain(project.payouts[0].creator);
    expect(html).toContain(project.payouts[0].invoice);
    expect(html).toContain('付款信息校验成功');
    expect(html).toContain('付款信息校验成功，收款账户与付款资料均已通过审核');
    expect(html).toContain('当前审批流');
    expect(html).toContain('财务审批已完成，等待执行付款');
    expect(html).toContain('状态回写');
    expect(html).toContain('<span>待打款</span>');
    expect(html).toContain('>退回媒介修改</span>');
    expect(html).toContain('>执行打款</span>');
    expect(html).toMatch(/class="button button-primary payment-execution-submit-action"(?![^>]*disabled)/);
  });

  it('prevents returning the whole request after any payout has started', () => {
    const project = buildPaymentProjectRows({
      tab: 'payment',
      payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
      requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    })[0];
    const request = INITIAL_COMPLETE_REQUEST_RESOURCES.requests.find((candidate) => (
      candidate.id === project.requestId
    ));
    const html = renderToStaticMarkup(
      <PaymentExecutionWorkspace
        request={request!}
        project={{
          ...project,
          payouts: project.payouts.map((payout, index) => (
            index === 0 ? { ...payout, status: '付款处理中' } : payout
          )),
        }}
        canExecute
        onExecute={vi.fn(() => true)}
        onReturn={vi.fn(() => true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toMatch(/class="button button-danger payment-execution-return-action"[^>]*disabled=""/);
  });

  it('renders a returned request as a read-only failure detail workspace', () => {
    const project = buildPaymentProjectRows({
      tab: 'payment',
      payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
      requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    })[0];
    const request = INITIAL_COMPLETE_REQUEST_RESOURCES.requests.find((candidate) => (
      candidate.id === project.requestId
    ));
    const reason = '收款账户名与 Invoice 不一致，请修正付款资料后重新提交。';

    expect(request?.approval?.status).toBe('APPROVED');
    const returnedRequest = {
      ...request!,
      lifecycle: 'RETURNED' as const,
      approval: returnApprovedRequestToMediaReview(
        request!.approval!,
        { account: 'finance.test', name: '财务测试员', role: '财务账号' },
        reason,
        '2026-08-10T04:30:00.000Z',
      ),
    };
    const returnedProject = {
      ...project,
      status: '已退回',
      actionLabel: '查看原因',
      payouts: project.payouts.map((payout) => ({
        ...payout,
        status: '已退回' as const,
        returnReason: reason,
        issue: `付款执行前退回：${reason}`,
      })),
    };
    const html = renderToStaticMarkup(
      <PaymentExecutionWorkspace
        request={returnedRequest}
        project={returnedProject}
        variant="returned"
        canExecute
        onExecute={vi.fn(() => true)}
        onReturn={vi.fn(() => true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain(`${project.requestCode} · 已退回详情`);
    expect(html).toContain('class="payment-execution-failure-summary" role="alert"');
    expect(html).toContain('失败原因');
    expect(html).toContain(reason);
    expect(html).toContain('财务审核 · 财务测试员 · 第 1 轮');
    expect(html).toContain('payment-execution-payee-status is-error');
    expect(html).toContain('payment-execution-account-note is-error');
    expect(html).toContain('请款信息已退回');
    expect(html).toContain('class="payment-execution-approval-return-note"');
    expect(html).toContain('>返回列表</span>');
    expect(html).not.toContain('payment-execution-return-action');
    expect(html).not.toContain('payment-execution-submit-action');
  });
});
