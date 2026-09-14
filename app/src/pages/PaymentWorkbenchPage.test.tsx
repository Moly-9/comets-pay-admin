import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Payout } from '../types';
import { getPaymentCurrencyOverviews } from '../paymentCurrencyOverview';
import type { RequestProjectSummary } from './RequestProjectDetailPage';
import {
  ALL_REVIEW_STATUSES,
  CURRENCY_FLAG_PATHS,
  REVIEW_STATUS_FILTER_OPTIONS,
  buildPaymentProjectRows,
  filterPaymentProjectRows,
  PaymentWorkbenchPage,
  summarizePaymentProjectRows,
  type WorkbenchTab,
} from './PaymentWorkbenchPage';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';
import { applyPaymentBatchPrototypeScenario } from '../paymentBatchPrototypeScenario';

const renderWorkbench = (
  payouts: Payout[],
  requests: RequestProjectSummary[] = [],
  initialTab: WorkbenchTab = 'review',
  generatedInvoices = INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
) => renderToStaticMarkup(
  <PaymentWorkbenchPage
    payouts={payouts}
    requests={requests}
    generatedInvoices={generatedInvoices}
    onNewBatch={vi.fn()}
    onSelectPayout={vi.fn()}
    onSelectPaidProject={vi.fn()}
    onOpenRequest={vi.fn()}
    onReviewRequest={vi.fn()}
    onExecuteRequest={vi.fn(() => true)}
    onReturnRequest={vi.fn(() => true)}
    canCreateBatch
    initialTab={initialTab}
    currentDate={new Date('2026-08-09T00:00:00.000Z')}
  />,
);

describe('PaymentWorkbenchPage currency overview', () => {
  it('places secondary currencies below the primary amount and renders icon detail actions', () => {
    const scenario = applyPaymentBatchPrototypeScenario({
      payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
      requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
      paymentLists: INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists,
    });
    const reviewRows = buildPaymentProjectRows({
      tab: 'review',
      payouts: scenario.payouts,
      requests: scenario.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    });
    const reviewSummary = summarizePaymentProjectRows(reviewRows);
    const html = renderWorkbench(
      scenario.payouts,
      scenario.requests,
      'review',
      INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    );
    const currencySpace = '\u00a0';
    const usdPending = reviewSummary.amounts.find((item) => item.currency === 'USD');
    const paidOverview = getPaymentCurrencyOverviews(
      scenario.payouts,
      new Date('2026-08-09T00:00:00.000Z'),
    ).paid;
    const usdPaid = paidOverview.find((item) => item.currency === 'USD');

    expect(html).toContain('summary-surface payment-workbench-summary');
    expect(html).toContain('summary-card summary-card-peach');
    expect(html).toContain('summary-card summary-card-lilac');
    expect(html).not.toContain('payment-currency-card');
    expect(usdPending).toBeTruthy();
    expect(html).toContain(`USD${currencySpace}${usdPending!.amount.toLocaleString('en-US')}`);
    expect(html).toContain(`待付款总额 · ${reviewSummary.invoices} 笔`);
    expect(usdPaid).toBeTruthy();
    expect(html).toContain(`USD${currencySpace}${usdPaid!.amount.toLocaleString('en-US')}`);
    expect(html).toContain(`本月已付款 · ${usdPaid!.count} 笔`);
    const secondaryRows = Array.from(
      html.matchAll(/<div class="payment-summary-secondary-row">([\s\S]*?)<\/div>/g),
      (match) => match[1],
    );
    const visibleSecondaryCount = [reviewSummary.amounts, paidOverview]
      .reduce((total, items) => total + Math.min(4, items.filter((item) => item.currency !== 'USD').length), 0);
    expect(secondaryRows).toHaveLength(visibleSecondaryCount);
    expect(html).toMatch(new RegExp(`>EUR${currencySpace}[\\d,]+<`));
    expect(html).toMatch(new RegExp(`>GBP${currencySpace}[\\d,]+<`));
    expect(html).toMatch(new RegExp(`>HKD${currencySpace}[\\d,]+<`));
    expect(html).toMatch(new RegExp(`>SGD${currencySpace}[\\d,]+<`));
    expect(html).not.toMatch(/\b(?:USD|EUR|GBP|HKD|SGD)\d/);
    expect(secondaryRows.every((row) => !row.includes('<strong>'))).toBe(true);
    expect(html.match(/class="payment-summary-content"/g)).toHaveLength(2);
    const detailButtons = html.match(/<button class="payment-summary-details-button"[\s\S]*?<\/button>/g) ?? [];
    const detailCardCount = [reviewSummary.amounts, paidOverview]
      .filter((items) => items.length > 4).length;
    expect(detailButtons).toHaveLength(detailCardCount);
    expect(detailButtons.every((button) => button.includes('lucide-chevron-right'))).toBe(true);
    expect(detailButtons.every((button) => !button.includes('查看详情'))).toBe(true);
    expect(html).toContain('aria-label="查看待付款币种详情"');
    expect(html.includes('aria-label="查看本月已付款币种详情"')).toBe(paidOverview.length > 4);
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
    const requests = ['USD', 'EUR', 'GBP', 'HKD'].map((currency, index): RequestProjectSummary => ({
      id: `review-${currency}`,
      requestCode: `REQ-${currency}`,
      lifecycle: 'SUBMITTED',
      approval: {
        status: 'PENDING_PM',
        round: 1,
        history: [],
        submittedAt: '2026-08-09T00:00:00.000Z',
        updatedAt: '2026-08-09T00:00:00.000Z',
      },
      project: `${currency} Review`,
      brand: 'Test Brand',
      media: 'Media',
      pm: 'PM',
      amount: `${currency} ${(index + 1) * 100}`,
      contracts: 1,
      invoices: 1,
      paymentOrder: '待生成',
      status: 'PM审批中',
      filter: 'pending',
    }));
    const html = renderWorkbench([], requests, 'review', []);

    expect(html).not.toContain('aria-label="查看待付款币种详情"');
    expect(html).not.toContain('aria-label="查看本月已付款币种详情"');
    expect(html).toContain('>EUR\u00a0200<');
    expect(html).toContain('>GBP\u00a0300<');
    expect(html).toContain('>HKD\u00a0400<');
  });

  it('renders the USD zero-value fallback when no review request exists', () => {
    const html = renderWorkbench([]);

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
      paymentEntity: 'novacomets',
      projectCostAttribution: '香港公司（comets）',
      amount: 'USD 100',
      contracts: 1,
      invoices: 1,
      paymentOrder: 'PAY-TEST',
      status: '财务审批中',
      filter: 'pending',
    }]);

    expect(html).toContain('待审核<span>1</span>');
    const headings = ['项目编号', '付款渠道', '付款主体', '关联项目', '请款金额及币种', '转账手续费及币种', '实际付款金额及币种', '实际付款日期', '发起人', '项目状态', '操作'];
    expect(headings.every((heading) => html.includes(`>${heading}</th>`))).toBe(true);
    expect(headings.map((heading) => html.indexOf(`>${heading}</th>`))).toEqual(
      [...headings.map((heading) => html.indexOf(`>${heading}</th>`))].sort((left, right) => left - right),
    );
    expect(html).toContain('REQ-FINANCE-001');
    expect(html).toContain('PRJ-FINANCE-001');
    expect(html).toContain('Finance Review Project');
    expect(html).toContain('title="novacomets">novacomets</td>');
    expect(html).toContain('待财务审核');
    expect(html).toContain('<span>审核</span>');
  });

  it('does not route a cancelled request into any payment workbench tab', () => {
    const cancelled = {
      ...INITIAL_COMPLETE_REQUEST_RESOURCES.requests[0],
      id: 'request-cancelled-test',
      lifecycle: 'CANCELLED' as const,
      status: '已取消',
    };
    const input = {
      payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
      requests: [cancelled],
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    };

    (['review', 'payment', 'paid', 'returned'] as const).forEach((tab) => {
      expect(buildPaymentProjectRows({ ...input, tab })).toEqual([]);
    });
  });

  it('routes all complete request fixtures into workbench tabs by request lifecycle', () => {
    const scenario = applyPaymentBatchPrototypeScenario({
      payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
      requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
      paymentLists: INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists,
    });
    const input = {
      payouts: scenario.payouts,
      requests: scenario.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    };

    expect(buildPaymentProjectRows({ ...input, tab: 'review' })).toHaveLength(8);
    expect(buildPaymentProjectRows({ ...input, tab: 'payment' })).toHaveLength(2);
    expect(buildPaymentProjectRows({ ...input, tab: 'paid' })).toHaveLength(5);
    expect(buildPaymentProjectRows({ ...input, tab: 'returned' })).toHaveLength(3);

    expect(buildPaymentProjectRows({ ...input, tab: 'paid' })).toContainEqual(expect.objectContaining({
      requestCode: 'REQ-202607-000015',
      status: '部分失败',
      actionLabel: '处理失败',
      payouts: expect.arrayContaining([
        expect.objectContaining({ id: 'payout_fixture_15_01', status: '付款失败' }),
        expect.objectContaining({ id: 'payout_fixture_15_02', status: '已付款' }),
        expect.objectContaining({ id: 'payout_fixture_15_03', status: '已付款' }),
      ]),
    }));
    expect(buildPaymentProjectRows({ ...input, tab: 'returned' })).toContainEqual(expect.objectContaining({
      requestCode: 'REQ-202607-000016',
      status: '已退回',
      actionLabel: '查看详情',
      payouts: expect.arrayContaining([
        expect.objectContaining({ id: 'payout_fixture_16_01', status: '未进入付款' }),
        expect.objectContaining({ id: 'payout_fixture_16_02', status: '未进入付款' }),
      ]),
    }));
    expect(buildPaymentProjectRows({ ...input, tab: 'returned' }).map((row) => row.requestCode))
      .not.toContain('REQ-202607-000019');

    const reviewRows = buildPaymentProjectRows({ ...input, tab: 'review' });
    expect(reviewRows.map((row) => row.approvalStatus)).toEqual([
      'PENDING_PM',
      'PENDING_PM',
      'PENDING_PROJECT_OWNER',
      'PENDING_PROJECT_OWNER',
      'PENDING_OWNER',
      'PENDING_OWNER',
      'PENDING_FINANCE',
      'PENDING_FINANCE',
    ]);
    expect(reviewRows.filter((row) => row.actionLabel === '查看详情')).toHaveLength(6);
    expect(reviewRows.filter((row) => row.actionLabel === '审核')).toHaveLength(2);
    expect(reviewRows.map((row) => row.status)).toEqual([
      '待PM审核',
      '待PM审核',
      '待媒介负责人审核',
      '待媒介负责人审核',
      '待老板审核',
      '待老板审核',
      '待财务审核',
      '待财务审核',
    ]);
    const reviewRow = reviewRows[0];
    expect(reviewRow).toMatchObject({
      requestCode: expect.stringMatching(/^REQ-/),
      cooperationProjectCode: expect.stringMatching(/^PRJ-/),
    });
    expect(reviewRow.requestId).toBeTruthy();
    expect(reviewRow.paymentOrder).toMatch(/^PAY-/);
    expect(reviewRow.paymentOrder).not.toMatch(/、|-(?:AWX|PP)$/);
    expect(reviewRow.paymentChannels).toHaveLength(1);
    expect(reviewRow.payouts.every((item) => (
      item.paymentRequestProjectId === input.requests.find((request) => (
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
    const financeReturnApproval = input.requests.find((request) => (
      request.requestCode === 'REQ-202607-000016'
    ))?.approval;
    const returnedRequests = input.requests.map((request) => request.id === waitingRow.requestId
      ? { ...request, lifecycle: 'RETURNED' as const, approval: financeReturnApproval }
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
    expect(reviewHtml).toContain('class="custom-select custom-select-toolbar payment-review-status-select"');
    expect(reviewHtml).toContain('aria-label="项目状态"');
    expect(reviewHtml).toContain('>全部项目状态</span>');
    expect(paidHtml).not.toContain('payment-review-status-select');
    expect(REVIEW_STATUS_FILTER_OPTIONS.map((option) => option.label)).toEqual([
      ALL_REVIEW_STATUSES,
      '待PM审核',
      '待媒介负责人审核',
      '待老板审核',
      '待财务审核',
    ]);
  });

  it('filters review rows by approval state while keeping request amounts and invoice counts', () => {
    const input = {
      payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
      requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    };
    const reviewRows = buildPaymentProjectRows({ ...input, tab: 'review' });
    const ownerRows = filterPaymentProjectRows(reviewRows, {
      provider: '全部付款渠道',
      search: '',
      reviewStatus: 'PENDING_OWNER',
    });

    expect(ownerRows).toHaveLength(2);
    expect(ownerRows.every((row) => row.status === '待老板审核')).toBe(true);
    reviewRows.forEach((row) => {
      const request = input.requests.find((candidate) => candidate.id === row.requestId);
      expect(row.amount).toBe(request?.amount);
    });

    const reviewSummary = summarizePaymentProjectRows(reviewRows);
    const uniqueInvoiceIds = new Set(reviewRows.flatMap((row) => row.invoiceIds));
    expect(reviewSummary.invoices).toBe(uniqueInvoiceIds.size);
  });
});
