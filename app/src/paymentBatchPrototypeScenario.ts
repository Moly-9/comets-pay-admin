import type { PaymentBatchId, PaymentListRecord } from './businessWorkflow';
import type { RequestProjectSummary } from './pages/RequestProjectDetailPage';
import {
  prototypeFundingAccountOpeningBalance,
  prototypePaymentResultFor,
} from './prototypePaymentResults';
import type { GeneratedInvoiceRecord, InvoiceCurrency, Payout } from './types';
import type { PaymentAggregateStatus } from './paymentStatusFilters';

export type PaymentBatchPrototypeStatus = PaymentAggregateStatus;

export const PAYMENT_BATCH_PROTOTYPE_STATUS_BY_REQUEST_CODE: Readonly<Record<string, PaymentBatchPrototypeStatus>> = {
  'REQ-202607-000011': '部分失败',
  'REQ-202607-000012': '付款处理中',
  'REQ-202607-000013': '已付款',
  'REQ-202607-000014': '已付款',
  'REQ-202607-000015': '部分失败',
};

export const PAYMENT_PROJECT_PROTOTYPE_STATUS_BY_REQUEST_CODE: Readonly<Record<string, PaymentBatchPrototypeStatus>> = {
  ...PAYMENT_BATCH_PROTOTYPE_STATUS_BY_REQUEST_CODE,
  'REQ-202607-000011': '已付款',
};

export const PAYMENT_BATCH_RETRY_DEMO = {
  requestCode: 'REQ-202607-000011',
  originalBatchId: 'payment_batch_fixture_paid_008',
  originalBatchCode: 'BAT-20260805-008',
  originalFailedAt: '2026-08-05T16:05',
  retryBatchId: 'payment_batch_fixture_retry_001',
  retryBatchCode: 'BAT-20260806-001',
  retryPaymentOrderCode: 'PAY-2608060001',
  retryPaymentCode: 'PMT-2608060901',
  submittedAt: '2026-08-06T10:15',
  payer: '奚文慧',
} as const;

export const PAYMENT_BATCH_PARTIAL_FAILURE_DEMO = {
  requestCode: 'REQ-202607-000015',
  payoutIds: [
    'payout_fixture_15_01',
    'payout_fixture_15_02',
    'payout_fixture_15_03',
  ],
  failedPayoutId: 'payout_fixture_15_01',
} as const;

export const paymentBatchPrototypeStatusFor = (
  request: Pick<RequestProjectSummary, 'id' | 'requestCode'>,
) => PAYMENT_BATCH_PROTOTYPE_STATUS_BY_REQUEST_CODE[request.requestCode ?? request.id];

export const paymentProjectPrototypeStatusFor = (
  request: Pick<RequestProjectSummary, 'id' | 'requestCode'>,
) => PAYMENT_PROJECT_PROTOTYPE_STATUS_BY_REQUEST_CODE[request.requestCode ?? request.id];

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
  perspective = 'project-current',
}: {
  payouts: readonly Payout[];
  requests: readonly RequestProjectSummary[];
  generatedInvoices: readonly GeneratedInvoiceRecord[];
  paymentLists: readonly PaymentListRecord[];
  perspective?: 'project-current' | 'historical-batch';
}) => {
  const statusFor = perspective === 'historical-batch'
    ? paymentBatchPrototypeStatusFor
    : paymentProjectPrototypeStatusFor;
  const batchedRequestIds = new Set(requests.flatMap((request) => {
    const status = statusFor(request);
    return request.paymentRequestProjectId && status
      ? [request.paymentRequestProjectId]
      : [];
  }));
  const payoutScenario = new Map<string, {
    batchStatus: PaymentBatchPrototypeStatus;
    providerItemIndex: number;
    requestCode: string;
  }>();

  requests.forEach((request) => {
    const batchStatus = statusFor(request);
    if (!batchStatus) return;
    const requestCode = request.requestCode ?? request.id;
    const invoiceIds = requestInvoiceIds(request);
    const sourcePayoutIds = new Set(generatedInvoices
      .filter((invoice) => invoiceIds.has(invoice.invoiceId))
      .map((invoice) => invoice.sourcePayoutId));
    const providerIndexes = new Map<Payout['provider'], number>();
    payouts.forEach((payout) => {
      if (!sourcePayoutIds.has(payout.id)) return;
      const providerItemIndex = providerIndexes.get(payout.provider) ?? 0;
      payoutScenario.set(payout.id, { batchStatus, providerItemIndex, requestCode });
      providerIndexes.set(payout.provider, providerItemIndex + 1);
    });
  });

  const runningBalances = new Map<string, number>();

  return {
    requests: requests.map((request): RequestProjectSummary => {
      const batchStatus = statusFor(request);
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
      const status = scenario.requestCode === PAYMENT_BATCH_PARTIAL_FAILURE_DEMO.requestCode
        ? payout.id === PAYMENT_BATCH_PARTIAL_FAILURE_DEMO.failedPayoutId
          ? '付款失败'
          : '已付款'
        : paymentBatchPrototypePayoutStatus(
            scenario.batchStatus,
            scenario.providerItemIndex,
          );
      const failed = status === '付款失败';
      const isRetrySuccess = perspective === 'project-current'
        && scenario.requestCode === PAYMENT_BATCH_RETRY_DEMO.requestCode
        && scenario.providerItemIndex === 0;
      const linkedInvoice = generatedInvoices.find((invoice) => invoice.sourcePayoutId === payout.id);
      const sourcePaymentOrderCode = paymentLists.find((list) => (
        linkedInvoice && list.items.some((item) => item.invoiceId === linkedInvoice.invoiceId)
      ))?.paymentListCode;
      const receiveCurrency = (
        linkedInvoice?.snapshot.payment.accountCurrency || payout.currency
      ) as InvoiceCurrency;
      const prototypePaymentResult = prototypePaymentResultFor({ ...payout, receiveCurrency });
      const paymentResult = status === '已付款' ? prototypePaymentResult : undefined;
      const failedPaymentResult = failed ? {
        transferFeeAmount: prototypePaymentResult.transferFeeAmount,
        transferFeeCurrency: prototypePaymentResult.transferFeeCurrency,
        actualPaidAmount: prototypePaymentResult.transferFeeAmount,
        actualPaidCurrency: prototypePaymentResult.transferFeeCurrency,
        recipientReceivedAmount: 0,
        recipientReceivedCurrency: receiveCurrency,
      } : undefined;
      const retryPaymentAttempts = isRetrySuccess && paymentResult?.transferFeeAmount !== undefined
        ? [
            {
              paymentBatchId: PAYMENT_BATCH_RETRY_DEMO.originalBatchId as PaymentBatchId,
              paymentBatchCode: PAYMENT_BATCH_RETRY_DEMO.originalBatchCode,
              paymentCode: payout.paymentCode,
              attemptNumber: 1,
              status: '付款失败' as const,
              occurredAt: PAYMENT_BATCH_RETRY_DEMO.originalFailedAt,
              principalAmount: payout.amount,
              principalCurrency: payout.currency,
              transferFeeAmount: paymentResult.transferFeeAmount,
              transferFeeCurrency: payout.currency,
              actualPaidAmount: paymentResult.transferFeeAmount,
              actualPaidCurrency: payout.currency,
              recipientReceivedAmount: 0,
              recipientReceivedCurrency: receiveCurrency,
              errorCode: 'BENEFICIARY_UNAVAILABLE',
              providerResponse: 'The beneficiary is temporarily unavailable.',
              returnReason: '收款账户暂不可用，已完成资料修复和重新付款。',
            },
            {
              paymentBatchId: PAYMENT_BATCH_RETRY_DEMO.retryBatchId as PaymentBatchId,
              paymentBatchCode: PAYMENT_BATCH_RETRY_DEMO.retryBatchCode,
              paymentCode: PAYMENT_BATCH_RETRY_DEMO.retryPaymentCode,
              attemptNumber: 2,
              status: '已付款' as const,
              occurredAt: PAYMENT_BATCH_RETRY_DEMO.submittedAt,
              principalAmount: payout.amount,
              principalCurrency: payout.currency,
              transferFeeAmount: paymentResult.transferFeeAmount,
              transferFeeCurrency: paymentResult.transferFeeCurrency,
              actualPaidAmount: paymentResult.actualPaidAmount,
              actualPaidCurrency: paymentResult.actualPaidCurrency,
              recipientReceivedAmount: paymentResult.recipientReceivedAmount,
              recipientReceivedCurrency: paymentResult.recipientReceivedCurrency,
            },
          ]
        : payout.paymentAttempts;
      const balanceKey = `${payout.provider}:${payout.currency}`;
      const previousBalance = runningBalances.get(balanceKey)
        ?? prototypeFundingAccountOpeningBalance(payout);
      const postTransactionBalance = paymentResult?.actualPaidAmount === undefined
        ? undefined
        : Math.round((previousBalance - paymentResult.actualPaidAmount + Number.EPSILON) * 100) / 100;
      if (postTransactionBalance !== undefined) runningBalances.set(balanceKey, postTransactionBalance);
      return {
        ...payout,
        paymentCode: isRetrySuccess ? PAYMENT_BATCH_RETRY_DEMO.retryPaymentCode : payout.paymentCode,
        status,
        paidAt: status === '已付款'
          ? (isRetrySuccess ? PAYMENT_BATCH_RETRY_DEMO.submittedAt : payout.paidAt ?? '2026-08-05 16:00')
          : undefined,
        ...(status === '已付款' ? {
          ...paymentResult,
          postTransactionBalance,
          postTransactionBalanceCurrency: payout.currency,
        } : {
          ...failedPaymentResult,
          postTransactionBalance: undefined,
          postTransactionBalanceCurrency: undefined,
        }),
        issue: failed ? '渠道返回收款账户暂不可用，等待财务处理' : undefined,
        returnReason: isRetrySuccess ? undefined : payout.returnReason,
        paymentFailureReturn: isRetrySuccess ? undefined : payout.paymentFailureReturn,
        currentPaymentAttempt: isRetrySuccess ? {
          paymentBatchId: PAYMENT_BATCH_RETRY_DEMO.retryBatchId as PaymentBatchId,
          paymentBatchCode: PAYMENT_BATCH_RETRY_DEMO.retryBatchCode,
          paymentCode: PAYMENT_BATCH_RETRY_DEMO.retryPaymentCode,
          submittedAt: PAYMENT_BATCH_RETRY_DEMO.submittedAt,
          paymentOrderCode: PAYMENT_BATCH_RETRY_DEMO.retryPaymentOrderCode,
          sourcePaymentOrderCode,
          attemptNumber: 2,
        } : payout.currentPaymentAttempt,
        paymentAttempts: retryPaymentAttempts,
        paymentFailureRecovery: isRetrySuccess ? {
          status: 'RETRY_SUCCEEDED',
          notifications: [],
          previousFailure: {
            provider: payout.provider,
            errorCode: 'BENEFICIARY_UNAVAILABLE',
            providerResponse: 'The beneficiary is temporarily unavailable.',
            occurredAt: PAYMENT_BATCH_RETRY_DEMO.originalFailedAt,
          },
          failureCode: 'BENEFICIARY_UNAVAILABLE',
          returnReason: '收款账户暂不可用，已完成资料修复和重新付款。',
          retryBatchId: PAYMENT_BATCH_RETRY_DEMO.retryBatchId,
          retryBatchCode: PAYMENT_BATCH_RETRY_DEMO.retryBatchCode,
          retrySucceededAt: PAYMENT_BATCH_RETRY_DEMO.submittedAt,
        } : payout.paymentFailureRecovery,
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
      const batchStatus = request ? statusFor(request) : undefined;
      return {
        ...paymentList,
        status: batchStatus === '已付款' ? 'paid' : 'approved',
      };
    }),
  };
};
