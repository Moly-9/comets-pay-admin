import type { PaymentListRecord } from './businessWorkflow';
import type { RequestProjectSummary } from './pages/RequestProjectDetailPage';
import type { GeneratedInvoiceRecord, Payout } from './types';
import type { PaymentAggregateStatus } from './paymentStatusFilters';

export type PaymentBatchPrototypeStatus = PaymentAggregateStatus;

export const PAYMENT_BATCH_PROTOTYPE_STATUS_BY_REQUEST_CODE: Readonly<Record<string, PaymentBatchPrototypeStatus>> = {
  'REQ-202607-000011': '部分失败',
  'REQ-202607-000012': '付款处理中',
  'REQ-202607-000013': '已付款',
  'REQ-202607-000014': '已付款',
};

export const paymentBatchPrototypeStatusFor = (
  request: Pick<RequestProjectSummary, 'id' | 'requestCode'>,
) => PAYMENT_BATCH_PROTOTYPE_STATUS_BY_REQUEST_CODE[request.requestCode ?? request.id];

export const paymentBatchPrototypePayoutStatus = (
  batchStatus: PaymentBatchPrototypeStatus,
  providerItemIndex: number,
): Payout['status'] => {
  if (batchStatus === '付款处理中') return '付款处理中';
  if (batchStatus === '全部失败') return '付款失败';
  if (batchStatus === '部分失败' && providerItemIndex % 5 === 0) return '付款失败';
  return '已付款';
};

const requestInvoiceIds = (request: RequestProjectSummary) => new Set([
  ...(request.invoiceIds ?? []),
  ...(request.creatorLinks ?? []).flatMap((link) => link.invoiceIds),
]);

export const applyPaymentBatchPrototypeScenario = ({
  payouts,
  requests,
  generatedInvoices,
  paymentLists,
}: {
  payouts: readonly Payout[];
  requests: readonly RequestProjectSummary[];
  generatedInvoices: readonly GeneratedInvoiceRecord[];
  paymentLists: readonly PaymentListRecord[];
}) => {
  const batchedRequestIds = new Set(requests.flatMap((request) => {
    const status = paymentBatchPrototypeStatusFor(request);
    return request.paymentRequestProjectId && status
      ? [request.paymentRequestProjectId]
      : [];
  }));
  const payoutScenario = new Map<string, {
    batchStatus: PaymentBatchPrototypeStatus;
    providerItemIndex: number;
  }>();

  requests.forEach((request) => {
    const batchStatus = paymentBatchPrototypeStatusFor(request);
    if (!batchStatus) return;
    const invoiceIds = requestInvoiceIds(request);
    const sourcePayoutIds = new Set(generatedInvoices
      .filter((invoice) => invoiceIds.has(invoice.invoiceId))
      .map((invoice) => invoice.sourcePayoutId));
    const providerIndexes = new Map<Payout['provider'], number>();
    payouts.forEach((payout) => {
      if (!sourcePayoutIds.has(payout.id)) return;
      const providerItemIndex = providerIndexes.get(payout.provider) ?? 0;
      payoutScenario.set(payout.id, { batchStatus, providerItemIndex });
      providerIndexes.set(payout.provider, providerItemIndex + 1);
    });
  });

  return {
    requests: requests.map((request): RequestProjectSummary => {
      const batchStatus = paymentBatchPrototypeStatusFor(request);
      if (!batchStatus) return request;
      if (batchStatus !== '已付款') {
        return {
          ...request,
          lifecycle: 'APPROVED',
          status: '待打款',
          filter: 'pending',
        };
      }
      return {
        ...request,
        lifecycle: 'COMPLETED',
        status: '已付款',
        filter: 'processed',
        generatedDetail: request.generatedDetail ? {
          ...request.generatedDetail,
          paymentListStatus: '已付款',
        } : request.generatedDetail,
      };
    }),
    payouts: payouts.map((payout): Payout => {
      const scenario = payoutScenario.get(payout.id);
      if (!scenario) return payout;
      const status = paymentBatchPrototypePayoutStatus(
        scenario.batchStatus,
        scenario.providerItemIndex,
      );
      const failed = status === '付款失败';
      return {
        ...payout,
        status,
        paidAt: status === '已付款' ? (payout.paidAt ?? '2026-08-05 16:00') : undefined,
        issue: failed ? '渠道返回收款账户暂不可用，等待财务处理' : undefined,
        paymentFailure: failed ? {
          provider: payout.provider,
          errorCode: 'BENEFICIARY_UNAVAILABLE',
          providerResponse: 'The beneficiary is temporarily unavailable.',
          occurredAt: '2026-08-05T16:05',
        } : undefined,
      };
    }),
    paymentLists: paymentLists.map((paymentList): PaymentListRecord => {
      if (!paymentList.paymentRequestProjectId
        || !batchedRequestIds.has(paymentList.paymentRequestProjectId)) return paymentList;
      const request = requests.find((candidate) => (
        candidate.paymentRequestProjectId === paymentList.paymentRequestProjectId
      ));
      const batchStatus = request ? paymentBatchPrototypeStatusFor(request) : undefined;
      return {
        ...paymentList,
        status: batchStatus === '已付款' ? 'paid' : 'approved',
      };
    }),
  };
};
