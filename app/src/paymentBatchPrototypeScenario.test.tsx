import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildPaymentProjectRows } from './pages/PaymentWorkbenchPage';
import { TransactionsPage } from './pages/OperationalPages';
import {
  applyPaymentBatchPrototypeScenario,
  PAYMENT_BATCH_PROTOTYPE_STATUS_BY_REQUEST_CODE,
  paymentBatchPrototypePayoutStatus,
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
  it('maps a completely failed batch to failed payment items', () => {
    expect(paymentBatchPrototypePayoutStatus('全部失败', 0)).toBe('付款失败');
    expect(paymentBatchPrototypePayoutStatus('全部失败', 3)).toBe('付款失败');
  });

  it('routes every batched project to the paid tab while preserving batch execution states', () => {
    const input = {
      payouts: scenario.payouts,
      requests: scenario.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    };

    expect(buildPaymentProjectRows({ ...input, tab: 'review' })).toHaveLength(10);
    expect(buildPaymentProjectRows({ ...input, tab: 'payment' })).toHaveLength(3);
    expect(buildPaymentProjectRows({ ...input, tab: 'paid' })).toHaveLength(6);

    const paidRows = buildPaymentProjectRows({ ...input, tab: 'paid' });
    expect(paidRows.filter((row) => row.status === '付款处理中')).toHaveLength(2);
    expect(paidRows.filter((row) => row.status === '已付款')).toHaveLength(2);
    expect(paidRows.filter((row) => row.status === '部分失败')).toHaveLength(2);
    expect(paidRows.find((row) => row.status === '付款处理中')?.actionLabel).toBe('查看进度');
    expect(paidRows.find((row) => row.status === '部分失败')?.actionLabel).toBe('处理失败');
  });

  it('keeps request, payment-list, and payout states aligned by request', () => {
    scenario.requests.forEach((request) => {
      const batchStatus = PAYMENT_BATCH_PROTOTYPE_STATUS_BY_REQUEST_CODE[request.requestCode ?? request.id];
      if (!batchStatus) return;

      expect(request.lifecycle).toBe('COMPLETED');
      expect(request.status).toBe('已付款');

      const requestLists = scenario.paymentLists.filter((list) => (
        list.paymentRequestProjectId === request.paymentRequestProjectId
      ));
      expect(requestLists.length).toBeGreaterThan(0);
      expect(requestLists.every((list) => list.status === 'paid')).toBe(true);

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
      <TransactionsPage payouts={scenario.payouts} paymentBatches={[]} />,
    );

    expect(html).toContain('role="tablist" aria-label="交易状态"');
    expect(html).toContain('<span>全部</span>');
    expect(html).toContain('<span>已付款</span>');
    expect(html).toContain('<span>付款失败</span>');
    expect(html).not.toContain('aria-label="付款状态"');
    expect(html).toContain(`>${successRate}</strong>`);
    expect(html).toContain(`全部渠道成功率 · ${failed.length} 笔失败`);
  });
});
