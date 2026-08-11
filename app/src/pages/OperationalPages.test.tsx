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
  provider: Payout['provider'] = 'Airwallex',
): Payout => ({
  id: `transaction-${index}`,
  creator: `Creator ${index}`,
  handle: `@creator-${index}`,
  initials: 'CR',
  projectId: `project-${index}`,
  project: `Project ${index}`,
  contract: `CON-${index}`,
  invoice: `INV-${index}`,
  provider,
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
        paymentBatches={[]}
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

  it('shows the overall success rate above each provider success rate and failure count', () => {
    const html = renderToStaticMarkup(
      <TransactionsPage
        payouts={[
          transactionPayout('USD', 100, 1, '已付款', 'Airwallex'),
          transactionPayout('USD', 100, 2, '已付款', 'Airwallex'),
          transactionPayout('USD', 100, 3, '付款失败', 'Airwallex'),
          transactionPayout('USD', 100, 4, '已付款', 'PayPal'),
          transactionPayout('USD', 100, 5, '付款失败', 'PayPal'),
          transactionPayout('USD', 100, 6, '已付款', 'PayMax'),
          transactionPayout('USD', 100, 7, '已付款', 'PayMax'),
          transactionPayout('USD', 100, 8, '已付款', 'PayMax'),
        ]}
        paymentBatches={[]}
      />,
    );

    expect(html).toContain('aria-label="渠道付款成功率"');
    expect(html).toContain('<strong>75.0%</strong><span>全部渠道成功率 · 2 笔失败</span>');
    expect(html).toContain('<span>Airwallex</span><span>66.7%</span><small>1 笔失败</small>');
    expect(html).toContain('<span>PayPal</span><span>50.0%</span><small>1 笔失败</small>');
    expect(html).toContain('<span>PayMax</span><span>100.0%</span><small>0 笔失败</small>');
    expect(html.indexOf('全部渠道成功率')).toBeLessThan(html.indexOf('各渠道付款成功率'));
  });

  it('shows final transactions in all, paid, and failed tabs without processing records', () => {
    const html = renderToStaticMarkup(
      <TransactionsPage
        payouts={[
          transactionPayout('USD', 100, 11, '已付款'),
          transactionPayout('USD', 100, 12, '付款失败'),
          transactionPayout('USD', 100, 13, '付款处理中'),
          transactionPayout('USD', 100, 14, '等待付款'),
        ]}
        paymentBatches={[]}
      />,
    );

    expect(html).toContain('role="tablist" aria-label="交易状态"');
    expect(html).toContain('<span>全部</span>');
    expect(html).toContain('<span>已付款</span>');
    expect(html).toContain('<span>付款失败</span>');
    expect(html).not.toContain('<span>全部</span><small>');
    expect(html).not.toContain('aria-label="付款状态"');
    expect(html).toContain('INV-11');
    expect(html).toContain('INV-12');
    expect(html).not.toContain('INV-13');
    expect(html).not.toContain('INV-14');
    expect(html).not.toContain('付款处理中');
    expect(html).not.toContain('等待付款');
  });

  it('renders workbench-style search, date, provider, and export controls', () => {
    const html = renderToStaticMarkup(
      <TransactionsPage
        payouts={[transactionPayout('USD', 100, 21)]}
        paymentBatches={[]}
      />,
    );

    expect(html).toContain('type="search" aria-label="搜索交易记录"');
    expect(html.match(/type="date"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="付款渠道"');
    expect(html).not.toContain('aria-label="付款状态"');
    expect(html).toContain('>全部付款渠道</span>');
    expect(html).toContain('当前显示 1 条记录');
    expect(html).toContain('<span>导出已选（0）</span>');
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-label="选择 Creator 21 的交易"');
    expect(html).toContain('>达人 / 付款项目</th>');
    expect(html).toContain('>Invoice</th>');
    expect(html).toContain('>渠道</th>');
    expect(html).toContain('>状态</th>');
    expect(html).toContain('>金额</th>');
    expect(html).toContain('>时间</th>');
    expect(html).toContain('>付款人 / 付款时间</th>');
    expect(html).toContain('>操作</th>');
    expect(html).not.toContain('transaction-field-icon');
    expect(html).toContain('INV-21');
    expect(html).toContain('USD 100');
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
