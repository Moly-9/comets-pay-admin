import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_INVOICE_ENTITY, INITIAL_PAYOUTS } from '../data';
import { InvoicePage, INITIAL_CREATORS } from './OperationalPages';

describe('InvoicePage approval states', () => {
  it('shows pending finance approval inside the in-progress approval tab', () => {
    const financePayout = INITIAL_PAYOUTS.find((payout) => (
      payout.invoiceReviewStatus === '待财务审核'
    ));
    expect(financePayout).toBeDefined();

    const html = renderToStaticMarkup(
      <InvoicePage
        payouts={[financePayout!]}
        creators={INITIAL_CREATORS}
        invoiceEntity={INITIAL_INVOICE_ENTITY}
        generatedInvoices={[]}
        tab="approval"
        onTabChange={vi.fn()}
        onCreateInvoice={vi.fn()}
        onCreateBatchInvoice={vi.fn()}
        canCreateInvoice={false}
        canManageInvoice={false}
        canReviewMedia={false}
        canReviewFinance={true}
        focusedInvoiceId={null}
        onFocusCleared={vi.fn()}
        onMarkSigned={vi.fn()}
        onReviewAction={vi.fn()}
        onReplyFeedback={vi.fn()}
        onSendSignatureReminder={vi.fn(() => true)}
        onEditInvoice={vi.fn()}
        onOpenProject={vi.fn()}
        onOpenRequest={vi.fn()}
        onOpenPayment={vi.fn()}
        canExecutePayout={false}
        notify={vi.fn()}
      />,
    );

    expect(html).toContain('审批中 <span>1</span>');
    expect(html).toContain('待财务审批');
    expect(html).toContain('INV-240806');
  });
});
