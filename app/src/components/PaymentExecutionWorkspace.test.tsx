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
  it('uses a right-side project overview before expanding to the 7:3 payment-list layout', () => {
    const source = readFileSync(new URL('./PaymentExecutionWorkspace.css', import.meta.url), 'utf8');

    expect(source).toContain('.modal-panel.payment-execution-workspace.is-overview');
    expect(source).toContain('width: min(520px, 100vw);');
    expect(source).toContain('.payment-execution-shell.is-overview');
    expect(source).toContain('.payment-execution-shell.is-execution');
    expect(source).toContain('grid-template-columns: minmax(0, 7fr) minmax(320px, 3fr);');
    expect(source).toContain('.payment-execution-board-card');
  });

  it('opens with the request project overview above approval and resources', () => {
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
        paymentLists={INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists}
        contracts={INITIAL_COMPLETE_REQUEST_RESOURCES.contracts}
        canExecute
        onExecute={vi.fn(() => true)}
        onReturn={vi.fn(() => true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain(`${project.requestCode} · 执行打款`);
    expect(html).toContain('已打开请款项目概览');
    expect(html).toContain('is-execution is-overview');
    expect(html).toContain('请款项目信息');
    expect(html).toContain('项目编号');
    expect(html).toContain('关联项目');
    expect(html).toContain('当前审批流');
    expect(html).toContain('关联资料');
    expect(html.indexOf('请款项目信息')).toBeLessThan(html.indexOf('当前审批流'));
    expect(html).toContain('付款信息已完成校验，可直接执行打款；也可先查看付款清单逐笔确认。');
    expect(html).toContain('>查看付款清单</span>');
    expect(html).toContain('>执行打款</span>');
    expect(html).toContain('>关闭</span>');
    expect(html).not.toContain('class="payment-execution-table"');
    expect(html).not.toContain('payment-execution-return-action');
    expect(html).toMatch(/class="button button-primary payment-execution-overview-submit-action"(?![^>]*disabled)/);
  });

  it('shows five summary cards, the nine-column payout table, approval steps, and actions after entering the payment list', () => {
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
        paymentLists={INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists}
        contracts={INITIAL_COMPLETE_REQUEST_RESOURCES.contracts}
        initialStage="payment-list"
        canExecute
        onExecute={vi.fn(() => true)}
        onReturn={vi.fn(() => true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('已进入付款清单核对');
    expect(html).toContain('is-execution is-payment-list');
    expect(html).toContain('付款总金额');
    expect(html).toContain('付款单号');
    expect(html).toContain('付款渠道');
    expect(html).toContain('支付币种');
    expect(html).toContain('预计付款时间');
    expect(html.match(/payment-execution-hero-summary/g)).toHaveLength(1);
    expect(html).toContain('达人付款信息');
    expect(html).toContain('aria-label="请款项目与达人请款信息"');
    expect(html.match(/payment-execution-board-card/g)).toHaveLength(2);
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('class="payment-execution-table"');
    expect(html).toContain('<th>达人名称</th><th>收款账户</th><th>支付币种</th><th>收款方币种</th><th>金额</th><th>手续费承担方</th><th>付款原因</th><th>交易附言</th><th>校验状态</th>');
    expect(html).toContain(project.payouts[0].creator);
    expect(html).toContain('REQ-202607-000006-01');
    expect(html).toContain('>EUR</span>');
    expect(html).toContain('影音服务');
    expect(html).not.toContain('付款信息筛选');
    expect(html).not.toContain('仅看待处理');
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
    expect(html).toContain('>返回项目</span>');
    expect(html).toContain('>退回媒介修改</span>');
    expect(html).toContain('>执行打款</span>');
    expect(html).toMatch(/class="button button-primary payment-execution-submit-action"(?![^>]*disabled)/);
  });

  it('treats every waiting-payment item as validated and blocks items outside that state', () => {
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
          payouts: project.payouts.map((payout, index) => index === 0
            ? { ...payout, status: '信息异常' as const }
            : payout),
        }}
        generatedInvoices={INITIAL_COMPLETE_REQUEST_RESOURCES.invoices}
        paymentLists={INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists}
        contracts={INITIAL_COMPLETE_REQUEST_RESOURCES.contracts}
        initialStage="payment-list"
        canExecute
        onExecute={vi.fn(() => true)}
        onReturn={vi.fn(() => true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('还有 1 笔付款信息需要处理');
    expect(html).not.toContain('付款信息筛选');
    expect(html).toContain('payment-execution-table-status is-pending');
    expect(html).toMatch(/class="button button-primary payment-execution-submit-action"[^>]*disabled=""/);
  });

  it('also blocks direct execution from the overview when a payout is not ready', () => {
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
          payouts: project.payouts.map((payout, index) => index === 0
            ? { ...payout, status: '信息异常' as const }
            : payout),
        }}
        generatedInvoices={INITIAL_COMPLETE_REQUEST_RESOURCES.invoices}
        paymentLists={INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists}
        contracts={INITIAL_COMPLETE_REQUEST_RESOURCES.contracts}
        canExecute
        onExecute={vi.fn(() => true)}
        onReturn={vi.fn(() => true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('>执行打款</span>');
    expect(html).toMatch(/class="button button-primary payment-execution-overview-submit-action"[^>]*disabled=""/);
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
        initialStage="payment-list"
        canExecute
        onExecute={vi.fn(() => true)}
        onReturn={vi.fn(() => true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toMatch(/class="button button-danger payment-execution-return-action"[^>]*disabled=""/);
  });

  it('opens a returned request in a read-only overview with its return reason', () => {
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
      actionLabel: '查看详情',
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
    expect(html).toContain('is-overview is-returned');
    expect(html).toContain('已打开退回项目概览');
    expect(html).toContain('payment-execution-failure-card payment-execution-overview-return-card');
    expect(html).toContain('class="payment-execution-failure-summary" role="alert"');
    expect(html).toContain('退回原因');
    expect(html).toContain(reason);
    expect(html.indexOf('退回原因')).toBeLessThan(html.indexOf('请款项目信息'));
    expect(html).toContain('财务审核 · 财务测试员 · 第 1 轮');
    expect(html).toContain('审核未通过');
    expect(html).toContain('该项目审核未通过，可展开付款清单查看具体明细和退回原因。');
    expect(html).toContain('>查看付款清单</span>');
    expect(html).toContain('>关闭</span>');
    expect(html).not.toContain('payment-execution-payee-list');
    expect(html).not.toContain('payment-execution-return-action');
    expect(html).not.toContain('payment-execution-submit-action');
    expect(html).not.toContain('payment-execution-overview-submit-action');
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
        project={{ ...project, status: '已退回', actionLabel: '查看详情' }}
        generatedInvoices={INITIAL_COMPLETE_REQUEST_RESOURCES.invoices}
        variant="returned"
        initialStage="payment-list"
        canExecute
        onExecute={vi.fn(() => true)}
        onReturn={vi.fn(() => true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('已展开退回付款清单详情');
    expect(html).toContain('审核未通过');
    expect(html).toContain(`<b>具体退回原因：</b>${reason}`);
    expect(html).toContain('该达人请款信息已通过审核，无需修改');
    expect(html).toContain('payment-execution-payee is-passed');
    expect(html.match(/payment-execution-payee-status is-error/g)).toHaveLength(1);
    expect(html).toContain('payment-execution-failure-card payment-execution-content-card');
    expect(html).toContain('付款清单收款账户需修正。');
    expect(html).toContain('>返回项目</span>');
  });
});
