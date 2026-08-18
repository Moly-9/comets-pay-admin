import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_PAYOUTS } from '../data';
import type { InvoiceCurrency, Payout } from '../types';
import type { RequestProjectSummary } from './RequestProjectDetailPage';
import {
  CURRENCY_FLAG_PATHS,
  buildPaymentProjectRows,
  filterPaymentProjectRows,
  PaymentWorkbenchPage,
  type WorkbenchTab,
} from './PaymentWorkbenchPage';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';

const renderWorkbench = (
  payouts: Payout[],
  requests: RequestProjectSummary[] = [],
  initialTab: WorkbenchTab = 'review',
) => renderToStaticMarkup(
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
    initialTab={initialTab}
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
    const currencySpace = '\u00a0';

    expect(html).toContain('summary-surface payment-workbench-summary');
    expect(html).toContain('summary-card summary-card-peach');
    expect(html).toContain('summary-card summary-card-lilac');
    expect(html).not.toContain('payment-currency-card');
    expect(html).toContain(`USD${currencySpace}7,840`);
    expect(html).toContain('待付款总额 · 3 笔');
    expect(html).toContain(`USD${currencySpace}4,860`);
    expect(html).toContain('本月已付款 · 1 笔');
    const secondaryRows = Array.from(
      html.matchAll(/<div class="payment-summary-secondary-row">([\s\S]*?)<\/div>/g),
      (match) => match[1],
    );
    expect(secondaryRows).toHaveLength(8);
    expect(html).toMatch(new RegExp(`>EUR${currencySpace}[\\d,]+<`));
    expect(html).toMatch(new RegExp(`>GBP${currencySpace}[\\d,]+<`));
    expect(html).toMatch(new RegExp(`>HKD${currencySpace}[\\d,]+<`));
    expect(html).toMatch(new RegExp(`>SGD${currencySpace}[\\d,]+<`));
    expect(html).not.toMatch(/\b(?:USD|EUR|GBP|HKD|SGD)\d/);
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
    expect(html).toContain('>EUR\u00a0200<');
    expect(html).toContain('>GBP\u00a0300<');
    expect(html).toContain('>HKD\u00a0400<');
  });

  it('renders the USD zero-value fallback when no USD payout exists', () => {
    const html = renderWorkbench([payout('EUR', 1)]);

    expect(html).toContain('USD\u00a00');
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

    expect(buildPaymentProjectRows({ ...input, tab: 'review' })).toHaveLength(2);
    expect(buildPaymentProjectRows({ ...input, tab: 'payment' })).toHaveLength(2);
    expect(buildPaymentProjectRows({ ...input, tab: 'paid' })).toHaveLength(4);
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

  it('uses the detail action for returned payment projects', () => {
    const input = {
      payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
      requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    };
    const waitingRow = buildPaymentProjectRows({ ...input, tab: 'payment' })[0];
    const returnedRequests = input.requests.map((request) => request.id === waitingRow.requestId
      ? { ...request, lifecycle: 'RETURNED' as const }
      : request);

    expect(buildPaymentProjectRows({ ...input, requests: returnedRequests, tab: 'returned' }))
      .toContainEqual(expect.objectContaining({
        id: waitingRow.id,
        status: '已退回',
        actionLabel: '查看详情',
      }));
  });

  it('shows the complete status filter only on the paid tab and filters aggregate project states', () => {
    const input = {
      payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
      requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    };
    const paidRows = buildPaymentProjectRows({ ...input, tab: 'paid' });
    const target = paidRows[0];
    const failedPayoutIds = new Set(target.payouts.map((item) => item.id));
    const allFailedRows = buildPaymentProjectRows({
      ...input,
      tab: 'paid',
      payouts: input.payouts.map((item) => (
        failedPayoutIds.has(item.id) ? { ...item, status: '付款失败' as const } : item
      )),
    });

    expect(allFailedRows.find((row) => row.id === target.id)?.status).toBe('全部失败');
    expect(filterPaymentProjectRows(allFailedRows, {
      provider: '全部付款渠道',
      search: '',
      status: '全部失败',
    }).map((row) => row.id)).toContain(target.id);

    const paidHtml = renderWorkbench(input.payouts, input.requests, 'paid');
    const reviewHtml = renderWorkbench(input.payouts, input.requests, 'review');
    expect(paidHtml).toContain('class="custom-select custom-select-toolbar payment-status-select"');
    expect(paidHtml).toContain('>全部付款状态</span>');
    expect(reviewHtml).not.toContain('class="custom-select custom-select-toolbar payment-status-select"');
  });
});
