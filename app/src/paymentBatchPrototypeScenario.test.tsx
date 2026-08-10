import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { buildPaymentProjectRows } from './pages/PaymentWorkbenchPage';
import { TransactionsPage } from './pages/OperationalPages';
import {
  applyPaymentBatchPrototypeScenario,
  PAYMENT_BATCH_PROTOTYPE_STATUS_BY_REQUEST_CODE,
} from './paymentBatchPrototypeScenario';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from './requestProjectPrototypeResources';

const scenario = applyPaymentBatchPrototypeScenario({
  payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
  requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
  generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
  paymentLists: INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists,
});

const requestInvoiceIds = (request: (typeof scenario.requests)[number]) => new Set([
  ...(request.invoiceIds ?? []),
  ...(request.creatorLinks ?? []).flatMap((link) => link.invoiceIds),
]);

const payoutsForRequest = (request: (typeof scenario.requests)[number]) => {
  const invoiceIds = requestInvoiceIds(request);
  const payoutIds = new Set(INITIAL_COMPLETE_REQUEST_RESOURCES.invoices
    .filter((invoice) => invoiceIds.has(invoice.invoiceId))
    .map((invoice) => invoice.sourcePayoutId));
  return scenario.payouts.filter((payout) => payoutIds.has(payout.id));
};

describe('payment batch prototype scenario', () => {
  it('routes request projects into workbench tabs and exposes both active batch states', () => {
    const input = {
      payouts: scenario.payouts,
      requests: scenario.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    };

    expect(buildPaymentProjectRows({ ...input, tab: 'review' })).toHaveLength(10);
    expect(buildPaymentProjectRows({ ...input, tab: 'payment' })).toHaveLength(7);
    expect(buildPaymentProjectRows({ ...input, tab: 'paid' })).toHaveLength(2);

    const paymentRows = buildPaymentProjectRows({ ...input, tab: 'payment' });
    expect(paymentRows.filter((row) => row.status === '付款处理中')).toHaveLength(2);
    expect(paymentRows.filter((row) => row.status === '部分失败')).toHaveLength(2);
    expect(paymentRows.find((row) => row.status === '付款处理中')?.actionLabel).toBe('查看进度');
    expect(paymentRows.find((row) => row.status === '部分失败')?.actionLabel).toBe('处理失败');
  });

  it('keeps request, payment-list, and payout states aligned by request', () => {
    scenario.requests.forEach((request) => {
      const batchStatus = PAYMENT_BATCH_PROTOTYPE_STATUS_BY_REQUEST_CODE[request.requestCode ?? request.id];
      if (!batchStatus) return;

      const expectedPaid = batchStatus === '已付款';
      expect(request.lifecycle).toBe(expectedPaid ? 'COMPLETED' : 'APPROVED');
      expect(request.status).toBe(expectedPaid ? '已付款' : '待打款');

      const requestLists = scenario.paymentLists.filter((list) => (
        list.paymentRequestProjectId === request.paymentRequestProjectId
      ));
      expect(requestLists.length).toBeGreaterThan(0);
      expect(requestLists.every((list) => list.status === (expectedPaid ? 'paid' : 'approved'))).toBe(true);

      const requestPayouts = payoutsForRequest(request);
      expect(requestPayouts.length).toBeGreaterThan(0);
      if (batchStatus === '付款处理中') {
        expect(requestPayouts.every((payout) => payout.status === '付款处理中')).toBe(true);
      } else if (batchStatus === '已付款') {
        expect(requestPayouts.every((payout) => payout.status === '已付款')).toBe(true);
      } else {
        expect(requestPayouts.some((payout) => payout.status === '付款失败')).toBe(true);
        expect(requestPayouts.some((payout) => payout.status === '已付款')).toBe(true);
        expect(requestPayouts.every((payout) => ['已付款', '付款失败'].includes(payout.status))).toBe(true);
      }
    });
  });

  it('surfaces failed payments and calculated results in transaction records', () => {
    const paid = scenario.payouts.filter((payout) => payout.status === '已付款');
    const failed = scenario.payouts.filter((payout) => payout.status === '付款失败');
    const settled = paid.length + failed.length;
    const successRate = `${((paid.length / settled) * 100).toFixed(1)}%`;
    const html = renderToStaticMarkup(
      <TransactionsPage payouts={scenario.payouts} onSelectPayout={vi.fn()} />,
    );

    expect(html).toContain('>付款失败</button>');
    expect(html).toContain(`>${successRate}</strong>`);
    expect(html).toContain(`渠道付款成功率 · ${failed.length} 笔失败`);
  });
});
