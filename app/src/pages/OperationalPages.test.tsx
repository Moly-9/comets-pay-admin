import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_INVOICE_ENTITY, INITIAL_PAYOUTS } from '../data';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';
import type { GeneratedInvoiceRecord, InvoiceCurrency, Payout } from '../types';
import { InvoicePage, INITIAL_CREATORS, TransactionsPage } from './OperationalPages';

const transactionPayout = (
  currency: InvoiceCurrency,
  amount: number,
  index: number,
  status: Payout['status'] = '已付款',
): Payout => ({
  id: `transaction-${index}`,
  creator: `Creator ${index}`,
  handle: `@creator-${index}`,
  initials: 'CR',
  projectId: `project-${index}`,
  project: `Project ${index}`,
  contract: `CON-${index}`,
  invoice: `INV-${index}`,
  provider: 'Airwallex',
  currency,
  amount,
  account: `0000000${index}`,
  status,
  invoiceReviewStatus: '已通过',
  accent: '#8b5cf6',
});

describe('TransactionsPage currency overview', () => {
  it('uses USD as the primary paid total and lists secondary currencies below it', () => {
    const html = renderToStaticMarkup(
      <TransactionsPage
        payouts={[
          transactionPayout('USD', 100, 1),
          transactionPayout('USD', 200, 2),
          transactionPayout('EUR', 300, 3),
          transactionPayout('GBP', 400, 4),
          transactionPayout('HKD', 500, 5),
          transactionPayout('SGD', 600, 6),
          transactionPayout('USD', 700, 7, '付款失败'),
        ]}
        onSelectPayout={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="已付款总额"');
    expect(html).toContain('summary-card summary-card-peach payment-workbench-summary-card has-details');
    expect(html).toContain('<strong>USD 300</strong><span>已付款总额 · 6 笔</span>');
    expect(html).toContain('aria-label="已付款总额其他币种"');
    expect(html).toContain('aria-label="查看已付款币种详情"');
    expect(html).toContain('>EUR<');
    expect(html).toContain('>GBP<');
    expect(html).toContain('>HKD<');
    expect(html).toContain('>SGD<');
    expect(html.indexOf('USD 300')).toBeLessThan(html.indexOf('已付款总额其他币种'));
  });
});

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
