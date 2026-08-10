import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_PAYOUTS } from '../data';
import type { InvoiceCurrency, Payout } from '../types';
import type { RequestProjectSummary } from './RequestProjectDetailPage';
import { CURRENCY_FLAG_PATHS, buildPaymentProjectRows, PaymentWorkbenchPage } from './PaymentWorkbenchPage';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';

const renderWorkbench = (payouts: Payout[], requests: RequestProjectSummary[] = []) => renderToStaticMarkup(
  <PaymentWorkbenchPage
    payouts={payouts}
    requests={requests}
    generatedInvoices={[]}
    onNewBatch={vi.fn()}
    onSelectPayout={vi.fn()}
    onSelectPaidProject={vi.fn()}
    onReviewRequest={vi.fn()}
    onExecuteRequest={vi.fn(() => true)}
    onReturnRequest={vi.fn(() => true)}
    canCreateBatch
    currentDate={new Date('2026-08-09T00:00:00.000Z')}
  />,
);

const payout = (currency: InvoiceCurrency, index: number): Payout => ({
  id: `test-payout-${index}`,
  creator: `Creator ${index}`,
  handle: `@creator-${index}`,
  initials: 'CR',
  projectId: `test-project-${index}`,
  project: `Project ${index}`,
  contract: `CON-TEST-${index}`,
  invoice: `INV-TEST-${index}`,
  provider: 'Airwallex',
  currency,
  amount: index * 100,
  account: `00000000${index}`,
  status: '等待付款',
  invoiceReviewStatus: '已通过',
  accent: '#8b5cf6',
});

describe('PaymentWorkbenchPage currency overview', () => {
  it('places secondary currencies below the primary amount and renders icon detail actions', () => {
    const html = renderWorkbench(INITIAL_PAYOUTS);

    expect(html).toContain('summary-surface payment-workbench-summary');
    expect(html).toContain('summary-card summary-card-peach');
    expect(html).toContain('summary-card summary-card-lilac');
    expect(html).not.toContain('payment-currency-card');
    expect(html).toContain('USD 7,840');
    expect(html).toContain('待付款总额 · 3 笔');
    expect(html).toContain('USD 4,860');
    expect(html).toContain('本月已付款 · 1 笔');
    const secondaryRows = Array.from(
      html.matchAll(/<div class="payment-summary-secondary-row">([\s\S]*?)<\/div>/g),
      (match) => match[1],
    );
    expect(secondaryRows).toHaveLength(8);
    expect(html).toContain('>EUR<');
    expect(html).toContain('>GBP<');
    expect(html).toContain('>HKD<');
    expect(html).toContain('>SGD<');
    expect(secondaryRows.every((row) => !row.includes('<strong>'))).toBe(true);
    expect(html.match(/class="payment-summary-content"/g)).toHaveLength(2);
    const detailButtons = html.match(/<button class="payment-summary-details-button"[\s\S]*?<\/button>/g) ?? [];
    expect(detailButtons).toHaveLength(2);
    expect(detailButtons.every((button) => button.includes('lucide-chevron-right'))).toBe(true);
    expect(detailButtons.every((button) => !button.includes('查看详情'))).toBe(true);
    expect(html).toContain('aria-label="查看待付款币种详情"');
    expect(html).toContain('aria-label="查看本月已付款币种详情"');
  });

  it('maps every supported currency to a flag asset for the detail list', () => {
    expect(CURRENCY_FLAG_PATHS).toEqual({
      USD: '/currency-flags/us.svg',
      EUR: '/currency-flags/eu.svg',
      GBP: '/currency-flags/gb.svg',
      HKD: '/currency-flags/hk.svg',
      SGD: '/currency-flags/sg.svg',
    });
  });

  it('hides the detail action when a card has no more than four currencies', () => {
    const html = renderWorkbench(['USD', 'EUR', 'GBP', 'HKD'].map((currency, index) => (
      payout(currency as InvoiceCurrency, index + 1)
    )));

    expect(html).not.toContain('查看详情');
    expect(html).toContain('>EUR<');
    expect(html).toContain('>GBP<');
    expect(html).toContain('>HKD<');
  });

  it('renders the USD zero-value fallback when no USD payout exists', () => {
    const html = renderWorkbench([payout('EUR', 1)]);

    expect(html).toContain('USD 0');
    expect(html).toContain('待付款总额 · 0 笔');
  });

  it('uses finance-stage requests as the pending review source', () => {
    const html = renderWorkbench([], [{
      id: 'request-finance-review',
      requestCode: 'REQ-FINANCE-001',
      lifecycle: 'SUBMITTED',
      approval: {
        status: 'PENDING_FINANCE',
        round: 1,
        history: [],
        submittedAt: '2026-08-09T00:00:00.000Z',
        updatedAt: '2026-08-09T00:00:00.000Z',
      },
      cooperationProjectCode: 'PRJ-FINANCE-001',
      cooperationProjectName: 'Finance Review Project',
      project: 'Finance Review Project',
      brand: 'Test Brand',
      media: 'Media',
      pm: 'PM',
      amount: 'USD 100',
      contracts: 1,
      invoices: 1,
      paymentOrder: 'PAY-TEST',
      status: '财务审批中',
      filter: 'pending',
    }]);

    expect(html).toContain('待审核<span>1</span>');
    expect(html).toContain('<th>项目编号</th><th>关联项目</th>');
    expect(html).toContain('REQ-FINANCE-001');
    expect(html).toContain('PRJ-FINANCE-001');
    expect(html).toContain('Finance Review Project');
    expect(html).toContain('待财务审核');
    expect(html).toContain('<span>审核</span>');
  });

  it('routes all complete request fixtures into workbench tabs by request lifecycle', () => {
    const input = {
      payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
      requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    };

    expect(buildPaymentProjectRows({ ...input, tab: 'review' })).toHaveLength(10);
    expect(buildPaymentProjectRows({ ...input, tab: 'payment' })).toHaveLength(3);
    expect(buildPaymentProjectRows({ ...input, tab: 'paid' })).toHaveLength(6);
    expect(buildPaymentProjectRows({ ...input, tab: 'returned' })).toHaveLength(0);

    const reviewRow = buildPaymentProjectRows({ ...input, tab: 'review' })[0];
    expect(reviewRow).toMatchObject({
      requestCode: expect.stringMatching(/^REQ-/),
      cooperationProjectCode: expect.stringMatching(/^PRJ-/),
      status: '待财务审核',
      actionLabel: '审核',
    });
    expect(reviewRow.requestId).toBeTruthy();
    expect(reviewRow.paymentOrder).toMatch(/^PAY-/);
    expect(reviewRow.paymentOrder).not.toMatch(/、|-(?:AWX|PP)$/);
    expect(reviewRow.paymentChannels).toHaveLength(1);
    expect(reviewRow.payouts.every((item) => (
      item.paymentRequestProjectId === INITIAL_COMPLETE_REQUEST_RESOURCES.requests.find((request) => (
        request.id === reviewRow.requestId
      ))?.paymentRequestProjectId
    ))).toBe(true);
  });

  it('moves an approved request out of pending payment after all payouts start processing', () => {
    const input = {
      payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
      requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    };
    const waitingRow = buildPaymentProjectRows({ ...input, tab: 'payment' })[0];
    const processingIds = new Set(waitingRow.payouts.map((item) => item.id));
    const processingPayouts = input.payouts.map((item) => (
      processingIds.has(item.id) ? { ...item, status: '付款处理中' as const } : item
    ));

    expect(buildPaymentProjectRows({ ...input, payouts: processingPayouts, tab: 'payment' }))
      .not.toContainEqual(expect.objectContaining({ id: waitingRow.id }));
    expect(buildPaymentProjectRows({ ...input, payouts: processingPayouts, tab: 'paid' }))
      .toContainEqual(expect.objectContaining({
        id: waitingRow.id,
        status: '付款处理中',
        actionLabel: '查看进度',
      }));
  });
});
