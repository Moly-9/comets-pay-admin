import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';
import { buildPaymentProjectRows } from '../pages/PaymentWorkbenchPage';
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
    expect(html).toContain('当前审批流');
    expect(html).toContain('财务审批已完成，等待执行付款');
    expect(html).toContain('状态回写');
    expect(html).toContain('<span>待打款</span>');
    expect(html).toContain('>执行打款</span>');
  });
});
