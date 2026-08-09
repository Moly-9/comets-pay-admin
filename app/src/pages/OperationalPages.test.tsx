import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_INVOICE_ENTITY, INITIAL_PAYOUTS } from '../data';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';
import type { GeneratedInvoiceRecord } from '../types';
import { InvoicePage, INITIAL_CREATORS } from './OperationalPages';

describe('InvoicePage OA states', () => {
  it('derives OA presentation from the linked request without an approval tab', () => {
    const financePayout = INITIAL_PAYOUTS.find((payout) => payout.id === 'pay-022');
    expect(financePayout).toBeDefined();
    const invoice = {
      invoiceId: 'invoice-finance-review',
      sourcePayoutId: financePayout!.id,
    } as GeneratedInvoiceRecord;
    const request = {
      id: 'request-finance-review',
      lifecycle: 'SUBMITTED' as const,
      invoiceIds: [invoice.invoiceId],
      project: financePayout!.project,
      brand: 'Test Brand',
      media: 'Media',
      pm: 'PM',
      amount: 'USD 2,480',
      contracts: 1,
      invoices: 1,
      paymentOrder: 'PAY-TEST',
      status: '财务审批中',
      filter: 'pending' as const,
      approval: {
        status: 'PENDING_FINANCE' as const,
        round: 1,
        history: [],
        submittedAt: '2026-08-09T00:00:00.000Z',
        updatedAt: '2026-08-09T00:00:00.000Z',
      },
    };

    const html = renderToStaticMarkup(
      <InvoicePage
        payouts={[financePayout!]}
        creators={INITIAL_CREATORS}
        invoiceEntity={INITIAL_INVOICE_ENTITY}
        generatedInvoices={[invoice]}
        requests={[request]}
        tab="approved"
        onTabChange={vi.fn()}
        onCreateInvoice={vi.fn()}
        onCreateBatchInvoice={vi.fn()}
        canCreateInvoice={false}
        canManageInvoice={false}
        canReviewMedia={false}
        canReviewFinance={true}
        canEditProjectResourceInvoice={() => false}
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

    expect(html).not.toContain('>审批中 <span>');
    expect(html).toContain('OA审批中');
    expect(html).toContain('已通过 <span>1</span>');
    expect(html).toContain('INV-240806');
  });
});

describe('request project fixtures', () => {
  it('provides the agreed finance-review, payment, paid, and draft distribution', () => {
    const requests = INITIAL_COMPLETE_REQUEST_RESOURCES.requests;
    expect(requests.filter((request) => (
      request.lifecycle === 'SUBMITTED' && request.approval?.status === 'PENDING_FINANCE'
    ))).toHaveLength(10);
    expect(requests.filter((request) => request.lifecycle === 'APPROVED')).toHaveLength(3);
    expect(requests.filter((request) => request.lifecycle === 'COMPLETED')).toHaveLength(6);
    expect(requests.filter((request) => request.lifecycle === 'DRAFT')).toHaveLength(1);
    expect(requests.some((request) => request.lifecycle === 'RETURNED')).toBe(false);
  });
});
