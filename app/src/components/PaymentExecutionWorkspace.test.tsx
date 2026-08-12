import { readFileSync } from 'node:fs';
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
  it('uses a 7:3 task-first layout with two stacked cards on the right', () => {
    const source = readFileSync(new URL('./PaymentExecutionWorkspace.css', import.meta.url), 'utf8');

    expect(source).toContain('.payment-execution-shell.is-execution');
    expect(source).toContain('grid-template-columns: minmax(0, 7fr) minmax(320px, 3fr);');
    expect(source).toContain('.payment-execution-board-card');
    expect(source).not.toContain('clamp(380px, 30vw, 520px)');
  });

  it('shows a compact project hero, payout table, vertical approval steps, resources, and the payment action', () => {
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
        generatedInvoices={INITIAL_COMPLETE_REQUEST_RESOURCES.invoices}
        contracts={INITIAL_COMPLETE_REQUEST_RESOURCES.contracts}
        canExecute
        onExecute={vi.fn(() => true)}
        onReturn={vi.fn(() => true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain(`${project.requestCode} · 执行打款`);
    expect(html).toContain('请款项目信息');
    expect(html).toContain('请款总金额');
    expect(html).toContain('付款单号');
    expect(html).toContain('达人付款信息');
    expect(html).toContain('aria-label="请款项目与达人请款信息"');
    expect(html.match(/payment-execution-board-card/g)).toHaveLength(3);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain(`付款明细</span><strong>${project.payouts.length} 笔`);
    expect(html).toContain('class="payment-execution-table"');
    expect(html).toContain('<th>达人名称</th><th>收款账户</th><th>支付币种</th><th>金额</th><th>校验状态</th><th>关联凭证</th>');
    expect(html).toContain(project.payouts[0].creator);
    expect(html).toContain(project.payouts[0].invoice);
    expect(html).toContain(`${project.payouts.length} 笔付款信息均已校验，可执行打款`);
    expect(html).toContain('收款账户、Invoice 与付款资料已通过执行前核对');
    expect(html).toContain('当前审批流');
    expect(html).toContain('payment-execution-vertical-steps');
    expect(html).toContain('展开全部 6 个节点');
    expect(html).toContain('关联资料');
    expect(html).toContain(`合同 · ${project.contracts} 份`);
    expect(html).toContain(`Invoice · ${project.invoices} 份`);
    expect(html).toContain('收款账户校验结果');
    expect(html).toContain('已通过');
    expect(html).toContain('>查看全部</button>');
    expect(html).toContain('aria-label="打包下载全部合同"');
    expect(html).toContain('aria-label="打包下载全部 Invoice"');
    expect(html).toContain('第 1 轮 · 财务审批已完成');
    expect(html).toContain('>待打款</span>');
    expect(html).toContain('>退回媒介修改</span>');
    expect(html).toContain('>执行打款</span>');
    expect(html).toMatch(/class="button button-primary payment-execution-submit-action"(?![^>]*disabled)/);
  });

  it('shows pending validation risk and disables payment execution', () => {
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
          payouts: project.payouts.map((payout, index) => index === 0 ? {
            ...payout,
            paymentListRequiresRevalidation: true,
          } : payout),
        }}
        generatedInvoices={INITIAL_COMPLETE_REQUEST_RESOURCES.invoices}
        contracts={INITIAL_COMPLETE_REQUEST_RESOURCES.contracts}
        canExecute
        onExecute={vi.fn(() => true)}
        onReturn={vi.fn(() => true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('还有 1 笔付款信息需要处理');
    expect(html).toContain('仅看待处理');
    expect(html).toContain('payment-execution-table-status is-pending');
    expect(html).toMatch(/class="button button-primary payment-execution-submit-action"[^>]*disabled=""/);
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
        generatedInvoices={INITIAL_COMPLETE_REQUEST_RESOURCES.invoices}
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
      payouts: project.payouts.map((payout, index) => index === 0 ? {
        ...payout,
        status: '已退回' as const,
        returnReason: reason,
        issue: `付款执行前退回：${reason}`,
      } : payout),
    };
    expect(project.payouts.length).toBeGreaterThan(1);
    const html = renderToStaticMarkup(
      <PaymentExecutionWorkspace
        request={returnedRequest}
        project={returnedProject}
        generatedInvoices={INITIAL_COMPLETE_REQUEST_RESOURCES.invoices}
        variant="returned"
        canExecute
        onExecute={vi.fn(() => true)}
        onReturn={vi.fn(() => true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain(`${project.requestCode} · 已退回详情`);
    expect(html).toContain('payment-execution-failure-card payment-execution-content-card');
    expect(html).toContain('class="payment-execution-failure-summary" role="alert"');
    expect(html).toContain('失败原因');
    expect(html).toContain(reason);
    expect(html).toContain('财务审核 · 财务测试员 · 第 1 轮');
    expect(html).toContain('payment-execution-payee-status is-error');
    expect(html).toContain('payment-execution-account-note is-error');
    expect(html).toContain('请款信息已退回');
    expect(html).toContain('已通过审核');
    expect(html).toContain('该达人请款信息已通过审核，无需修改');
    expect(html.match(/payment-execution-payee-status is-error/g)).toHaveLength(1);
    expect(html.match(/payment-execution-payee is-passed/g)).toHaveLength(project.payouts.length - 1);
    expect(html.match(/payment-execution-content-card/g)).toHaveLength(3);
    expect(html).toContain('class="payment-execution-approval-return-note"');
    expect(html).toContain('>返回列表</span>');
    expect(html).not.toContain('payment-execution-return-action');
    expect(html).not.toContain('payment-execution-submit-action');
  });

  it('marks only scoped finance-return details as rejected and keeps the rest green', () => {
    const project = buildPaymentProjectRows({
      tab: 'payment',
      payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
      requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    })[0];
    const request = INITIAL_COMPLETE_REQUEST_RESOURCES.requests.find((candidate) => (
      candidate.id === project.requestId
    ))!;
    const targetPayout = project.payouts[0];
    const targetInvoice = INITIAL_COMPLETE_REQUEST_RESOURCES.invoices.find((invoice) => (
      invoice.sourcePayoutId === targetPayout.id
    ))!;
    const reason = '付款清单收款账户需修正。';
    const approval = returnApprovedRequestToMediaReview(
      request.approval!,
      { account: 'finance.test', name: '财务测试员', role: '财务账号' },
      reason,
      '2026-08-10T04:30:00.000Z',
    );
    const returnItems = [{
      pageKey: `invoice:${targetInvoice.invoiceId}`,
      invoiceId: targetInvoice.invoiceId,
      invoiceNumber: targetInvoice.id,
      issueType: 'PAYMENT_LIST' as const,
      reason,
      paymentItems: [],
    }];
    const returnedRequest = {
      ...request,
      lifecycle: 'RETURNED' as const,
      approval: {
        ...approval,
        returnItems,
        history: approval.history.map((event, index) => (
          index === approval.history.length - 1 ? { ...event, returnItems } : event
        )),
      },
    };
    const html = renderToStaticMarkup(
      <PaymentExecutionWorkspace
        request={returnedRequest}
        project={{ ...project, status: '已退回', actionLabel: '查看原因' }}
        generatedInvoices={INITIAL_COMPLETE_REQUEST_RESOURCES.invoices}
        variant="returned"
        canExecute
        onExecute={vi.fn(() => true)}
        onReturn={vi.fn(() => true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('付款清单已退回');
    expect(html).toContain(`<b>退回原因：</b>${reason}`);
    expect(html).toContain('该达人请款信息已通过审核，无需修改');
    expect(html).toContain('payment-execution-payee is-passed');
    expect(html.match(/payment-execution-payee-status is-error/g)).toHaveLength(1);
    expect(html).toContain('payment-execution-failure-card payment-execution-content-card');
    expect(html).toContain('付款清单收款账户需修正。');
  });
});
