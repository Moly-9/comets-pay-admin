import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildPaymentProjectRows } from './pages/PaymentWorkbenchPage';
import { TransactionsPage } from './pages/OperationalPages';
import {
  applyPaymentBatchPrototypeScenario,
  PAYMENT_BATCH_PARTIAL_FAILURE_DEMO,
  PAYMENT_BATCH_RETRY_DEMO,
  paymentBatchPrototypePayoutStatus,
  paymentProjectPrototypeStatusFor,
} from './paymentBatchPrototypeScenario';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from './requestProjectPrototypeResources';
import { prototypeFundingAccountOpeningBalance } from './prototypePaymentResults';
import { createInitialPaymentBatches } from './paymentBatches';
import { createTransactionRecords } from './transactionRecords';

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

  it('shows the retried, processing, and three-item partial-failure projects', () => {
    const input = {
      payouts: scenario.payouts,
      requests: scenario.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    };

    expect(buildPaymentProjectRows({ ...input, tab: 'review' })).toHaveLength(2);
    expect(buildPaymentProjectRows({ ...input, tab: 'payment' })).toHaveLength(2);
    expect(buildPaymentProjectRows({ ...input, tab: 'paid' })).toHaveLength(5);
    expect(buildPaymentProjectRows({ ...input, tab: 'returned' })).toHaveLength(1);

    const paidRows = buildPaymentProjectRows({ ...input, tab: 'paid' });
    expect(paidRows.filter((row) => row.status === '付款处理中')).toHaveLength(1);
    expect(paidRows.filter((row) => row.status === '已付款')).toHaveLength(3);
    expect(paidRows.filter((row) => row.status === '部分失败')).toHaveLength(1);
    expect(paidRows.find((row) => row.status === '付款处理中')?.actionLabel).toBe('查看进度');
    expect(paidRows.find((row) => row.requestCode === PAYMENT_BATCH_RETRY_DEMO.requestCode)?.status).toBe('已付款');
    expect(paidRows.find((row) => row.requestCode === PAYMENT_BATCH_PARTIAL_FAILURE_DEMO.requestCode))
      .toMatchObject({ status: '部分失败', actionLabel: '处理失败' });
    expect(paidRows.find((row) => row.requestCode === PAYMENT_BATCH_PARTIAL_FAILURE_DEMO.requestCode)?.payouts)
      .toHaveLength(3);

    const partialFailureRequest = scenario.requests.find((request) => (
      request.requestCode === PAYMENT_BATCH_PARTIAL_FAILURE_DEMO.requestCode
    ))!;
    const partialFailurePayouts = payoutsForRequest(partialFailureRequest);
    expect(partialFailurePayouts.map((payout) => payout.id)).toEqual(
      PAYMENT_BATCH_PARTIAL_FAILURE_DEMO.payoutIds,
    );
    expect(partialFailurePayouts.filter((payout) => payout.status === '已付款')).toHaveLength(2);
    expect(partialFailurePayouts.filter((payout) => payout.status === '付款失败')).toEqual([
      expect.objectContaining({
        id: PAYMENT_BATCH_PARTIAL_FAILURE_DEMO.failedPayoutId,
        paymentFailure: expect.objectContaining({ errorCode: 'BENEFICIARY_UNAVAILABLE' }),
      }),
    ]);
  });

  it('keeps request, payment-list, and payout states aligned by request', () => {
    scenario.requests.forEach((request) => {
      const batchStatus = paymentProjectPrototypeStatusFor(request);
      if (!batchStatus) return;

      expect(request.lifecycle).toBe(batchStatus === '已付款' ? 'COMPLETED' : 'APPROVED');
      expect(request.status).toBe(batchStatus === '已付款' ? '已付款' : '待打款');

      const requestLists = scenario.paymentLists.filter((list) => (
        list.paymentRequestProjectId === request.paymentRequestProjectId
      ));
      expect(requestLists.length).toBeGreaterThan(0);
      expect(requestLists.every((list) => (
        list.status === (batchStatus === '已付款' ? 'paid' : 'approved')
      ))).toBe(true);

      const requestPayouts = payoutsForRequest(request);
      expect(requestPayouts.length).toBeGreaterThan(0);
      if (batchStatus === '付款处理中') {
        expect(requestPayouts.every((payout) => payout.status === '付款处理中')).toBe(true);
      } else if (batchStatus === '已付款') {
        expect(requestPayouts.every((payout) => payout.status === '已付款')).toBe(true);
      } else {
        expect(requestPayouts.some((payout) => payout.status === '付款失败')).toBe(true);
        expect(requestPayouts.some((payout) => payout.status === '已付款')).toBe(true);
      }
    });
  });

  it('links the retried payout to the new successful batch attempt', () => {
    const retriedRequest = scenario.requests.find((request) => (
      request.requestCode === PAYMENT_BATCH_RETRY_DEMO.requestCode
    ))!;
    const retriedPayout = payoutsForRequest(retriedRequest).find((payout) => payout.currentPaymentAttempt);
    const originalPaymentOrderCode = retriedPayout
      ? INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists.find((list) => (
          INITIAL_COMPLETE_REQUEST_RESOURCES.invoices.some((invoice) => (
            invoice.sourcePayoutId === retriedPayout.id
            && list.items.some((item) => item.invoiceId === invoice.invoiceId)
          ))
        ))?.paymentListCode
      : undefined;

    expect(retriedPayout).toMatchObject({
      status: '已付款',
      currentPaymentAttempt: {
        paymentBatchCode: PAYMENT_BATCH_RETRY_DEMO.retryBatchCode,
        paymentCode: PAYMENT_BATCH_RETRY_DEMO.retryPaymentCode,
        paymentOrderCode: PAYMENT_BATCH_RETRY_DEMO.retryPaymentOrderCode,
        sourcePaymentOrderCode: originalPaymentOrderCode,
        attemptNumber: 2,
      },
      paymentFailureRecovery: {
        status: 'RETRY_SUCCEEDED',
        retryBatchCode: PAYMENT_BATCH_RETRY_DEMO.retryBatchCode,
        previousFailure: {
          errorCode: 'BENEFICIARY_UNAVAILABLE',
          occurredAt: '2026-08-05T16:05',
        },
      },
    });
    expect(originalPaymentOrderCode).toBeTruthy();
    expect(retriedPayout?.currentPaymentAttempt?.paymentOrderCode).not.toBe(originalPaymentOrderCode);
    expect(retriedPayout?.paymentAttempts).toEqual([
      expect.objectContaining({
        paymentBatchCode: PAYMENT_BATCH_RETRY_DEMO.originalBatchCode,
        paymentCode: expect.not.stringMatching(PAYMENT_BATCH_RETRY_DEMO.retryPaymentCode),
        attemptNumber: 1,
        status: '付款失败',
        actualPaidAmount: 30.58,
        transferFeeAmount: 30.58,
        errorCode: 'BENEFICIARY_UNAVAILABLE',
      }),
      expect.objectContaining({
        paymentBatchCode: PAYMENT_BATCH_RETRY_DEMO.retryBatchCode,
        paymentCode: PAYMENT_BATCH_RETRY_DEMO.retryPaymentCode,
        attemptNumber: 2,
        status: '已付款',
        actualPaidAmount: 15_318.58,
        transferFeeAmount: 30.58,
      }),
    ]);
    expect(retriedPayout?.paymentFailure).toBeUndefined();
  });

  it('stores a decreasing post-transaction funding balance only on successful payments', () => {
    const balances = new Map<string, number>();

    scenario.payouts.forEach((payout) => {
      if (payout.status !== '已付款') {
        expect(payout.postTransactionBalance).toBeUndefined();
        expect(payout.postTransactionBalanceCurrency).toBeUndefined();
        return;
      }
      const key = `${payout.provider}:${payout.currency}`;
      const before = balances.get(key) ?? prototypeFundingAccountOpeningBalance(payout);
      const expected = Math.round((before - (payout.actualPaidAmount ?? 0) + Number.EPSILON) * 100) / 100;

      expect(payout.postTransactionBalance).toBe(expected);
      expect(payout.postTransactionBalanceCurrency).toBe(payout.currency);
      balances.set(key, expected);
    });
  });

  it('keeps transaction records on linked batch attempts after retry success', () => {
    const paymentBatches = createInitialPaymentBatches({
      payouts: scenario.payouts,
      requests: scenario.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
      paymentLists: scenario.paymentLists,
      contracts: INITIAL_COMPLETE_REQUEST_RESOURCES.contracts,
    });
    const transactions = createTransactionRecords(scenario.payouts, paymentBatches);
    const paid = transactions.filter((record) => record.status === '已付款');
    const failed = transactions.filter((record) => record.status === '付款失败');
    const settled = paid.length + failed.length;
    const successRate = `${((paid.length / settled) * 100).toFixed(1)}%`;
    const html = renderToStaticMarkup(
      <TransactionsPage payouts={scenario.payouts} paymentBatches={paymentBatches} />,
    );

    expect(html).toContain('role="tablist" aria-label="交易状态"');
    expect(html).toMatch(/aria-selected="true">全部<span>\d+<\/span>/);
    expect(html).toMatch(/aria-selected="false">已付款<span>\d+<\/span>/);
    expect(html).toMatch(/aria-selected="false">付款失败<span>\d+<\/span>/);
    expect(html).not.toContain('aria-label="付款状态"');
    expect(html).toContain(`>${successRate}</strong>`);
    expect(failed.length).toBeGreaterThan(
      scenario.payouts.filter((payout) => payout.status === '付款失败').length,
    );
    expect(html).toContain(`全部渠道成功率 · ${failed.length} 笔失败`);
  });
});
