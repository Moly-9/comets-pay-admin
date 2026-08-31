import { isInvoiceApprovedForPayment } from './invoice/invoiceReviewWorkflow';
import { accountDisplayValue } from './accountPresentation';
import { formatCreatorHandle } from './creatorSearchOptions';
import {
  HISTORICAL_PAYMENT_BATCH_SEEDS,
  type HistoricalPaymentBatchSeed,
} from './historicalPaymentBatchFixtures';
import {
  type PaymentBatchContractSnapshot,
  type PaymentBatchInvoiceSnapshot,
  type PaymentBatchItemSnapshot,
  type PaymentBatchRecord,
} from './paymentBatches';
import type { InvoiceCurrency, Payout } from './types';
import { prototypeRecipientReceivedAmountFor } from './prototypePaymentResults';
import {
  ALL_PAYMENT_STATUSES,
  aggregatePaymentStatus,
  matchesPaymentStatus,
  type PaymentAggregateStatus,
  type PaymentStatusFilter,
} from './paymentStatusFilters';

export type TransactionTab = 'all' | 'paid' | 'failed';
export type TransactionProvider = 'all' | Payout['provider'];

export type TransactionRecordFilters = {
  tab?: TransactionTab;
  status?: PaymentStatusFilter;
  search: string;
  provider: TransactionProvider;
  startDate: string;
  endDate: string;
};

export type TransactionBatchContext = Readonly<{
  batch: PaymentBatchRecord;
  item: PaymentBatchItemSnapshot;
}>;

export type TransactionRecordStatus = Extract<
  Payout['status'],
  '付款处理中' | '已付款' | '付款失败'
>;

export type TransactionRecord = Readonly<{
  key: string;
  paymentBatchId: PaymentBatchRecord['paymentBatchId'];
  payout: Payout;
  context: TransactionBatchContext | null;
  status: TransactionRecordStatus;
  occurredAt: string;
  provider: Payout['provider'];
  paymentAmount: number;
  paymentCurrency: InvoiceCurrency;
  transferFeeAmount?: number;
  transferFeeCurrency?: InvoiceCurrency;
  recipientReceivedAmount?: number;
  recipientReceivedCurrency: InvoiceCurrency;
}>;

type TransactionContractDetails = Omit<PaymentBatchContractSnapshot, 'contractId'> & Readonly<{
  contractId?: PaymentBatchContractSnapshot['contractId'];
}>;

type TransactionInvoiceDetails = Omit<PaymentBatchInvoiceSnapshot, 'invoiceId'> & Readonly<{
  invoiceId?: PaymentBatchInvoiceSnapshot['invoiceId'];
}>;

export type TransactionRecordDetails = Readonly<{
  source: 'batch' | 'historical' | 'incomplete';
  payer: string;
  paymentTime: string;
  paymentBatchCode: string;
  requestCode: string;
  requestStatus: string;
  requestReason: string;
  cooperationProjectCode: string;
  cooperationProjectName: string;
  batchStatus: string;
  receiveCurrency: string;
  transferMethod: string;
  accountSummary: string;
  feeBearer: string;
  transactionReference: string;
  paymentListCode: string;
  paymentListStatus: string;
  paymentListVersion?: number;
  contracts: readonly TransactionContractDetails[];
  invoice?: TransactionInvoiceDetails;
  failure?: PaymentBatchItemSnapshot['failure'];
}>;

export const findTransactionBatchContext = (
  payout: Pick<Payout, 'id' | 'currentPaymentAttempt' | 'paymentFailureRecovery'>,
  batches: readonly PaymentBatchRecord[],
): TransactionBatchContext | null => {
  const currentBatchId = payout.currentPaymentAttempt?.paymentBatchId
    ?? payout.paymentFailureRecovery?.retryBatchId;
  if (currentBatchId) {
    const batch = batches.find((candidate) => candidate.paymentBatchId === currentBatchId);
    const item = batch?.items.find((candidate) => candidate.payoutId === payout.id);
    return batch && item ? { batch, item } : null;
  }
  for (const batch of batches) {
    const item = batch.items.find((candidate) => candidate.payoutId === payout.id);
    if (item) return { batch, item };
  }
  return null;
};

export const transactionOccurredAt = (payout: Payout) => (
  payout.status === '已付款'
    ? payout.paidAt ?? ''
    : payout.status === '付款失败'
      ? payout.paymentFailure?.occurredAt ?? ''
      : ''
);

const normalizedTransactionStatus = (
  status: Payout['status'],
): TransactionRecordStatus | null => {
  if (status === '已退回') return '付款失败';
  if (status === '付款处理中' || status === '已付款' || status === '付款失败') return status;
  return null;
};

const batchItemPayoutSnapshot = (
  batch: PaymentBatchRecord,
  item: PaymentBatchItemSnapshot,
  status: TransactionRecordStatus,
): Payout => ({
  id: item.payoutId,
  paymentRequestProjectId: batch.request.paymentRequestProjectId,
  creator: item.creatorName,
  handle: item.creatorHandle,
  creatorSocialAccountId: item.creatorSocialAccountId,
  creatorPlatform: item.creatorPlatform,
  initials: item.creatorName.trim().slice(0, 2).toLocaleUpperCase() || '—',
  projectId: batch.request.cooperationProjectCode,
  project: batch.request.cooperationProjectName,
  deliverable: item.deliverable,
  contract: item.contracts[0]?.contractCode ?? item.legacyContractReference ?? '',
  invoice: item.invoice?.invoiceNumber ?? item.legacyInvoiceReference ?? '',
  provider: item.provider,
  currency: item.currency,
  amount: item.amount,
  account: item.accountSummary,
  payoutAccountId: item.payoutAccountId,
  payoutAccountVersion: item.payoutAccountVersion,
  transferFeeAmount: item.transferFeeAmount,
  transferFeeCurrency: item.transferFeeCurrency,
  actualPaidAmount: item.actualPaidAmount,
  actualPaidCurrency: item.actualPaidCurrency,
  recipientReceivedAmount: item.recipientReceivedAmount,
  recipientReceivedCurrency: item.recipientReceivedCurrency,
  postTransactionBalance: item.postTransactionBalance,
  postTransactionBalanceCurrency: item.postTransactionBalanceCurrency,
  status,
  invoiceReviewStatus: '已通过',
  paymentFailure: status === '付款失败' && item.failure ? {
    provider: item.provider,
    errorCode: item.failure.code,
    providerResponse: item.failure.response,
    occurredAt: item.failure.occurredAt,
  } : undefined,
  accent: '#64748b',
  paidAt: status === '已付款' ? item.paidAt : undefined,
});

const transactionRecordFromBatchItem = (
  batch: PaymentBatchRecord,
  item: PaymentBatchItemSnapshot,
  livePayout?: Payout,
): TransactionRecord | null => {
  const attempt = item.paymentAttempts?.find((candidate) => (
    candidate.paymentBatchId === batch.paymentBatchId
    || (
      !candidate.paymentBatchId
      && candidate.attemptNumber === batch.paymentAttemptNumber
    )
  ));
  const resolvedItem: PaymentBatchItemSnapshot = attempt ? {
    ...item,
    paymentStatus: attempt.status,
    paidAt: attempt.occurredAt ?? item.paidAt,
    transferFeeAmount: attempt.transferFeeAmount ?? item.transferFeeAmount,
    transferFeeCurrency: attempt.transferFeeCurrency ?? item.transferFeeCurrency,
    actualPaidAmount: attempt.actualPaidAmount ?? item.actualPaidAmount,
    actualPaidCurrency: attempt.actualPaidCurrency ?? item.actualPaidCurrency,
    recipientReceivedAmount: attempt.recipientReceivedAmount ?? item.recipientReceivedAmount,
    recipientReceivedCurrency: attempt.recipientReceivedCurrency ?? item.recipientReceivedCurrency,
    failure: attempt.status === '付款失败' && (attempt.errorCode || attempt.providerResponse)
      ? {
          code: attempt.errorCode || '未记录',
          response: attempt.providerResponse || '未记录',
          occurredAt: attempt.occurredAt || item.failure?.occurredAt || '未记录',
        }
      : item.failure,
  } : item;
  const status = normalizedTransactionStatus(resolvedItem.paymentStatus);
  if (!status) return null;
  const payout = livePayout
    ? {
        ...livePayout,
        status,
        paidAt: status === '已付款' ? resolvedItem.paidAt : undefined,
        paymentFailure: status === '付款失败' && resolvedItem.failure ? {
          provider: resolvedItem.provider,
          errorCode: resolvedItem.failure.code,
          providerResponse: resolvedItem.failure.response,
          occurredAt: resolvedItem.failure.occurredAt,
        } : undefined,
      }
    : batchItemPayoutSnapshot(batch, resolvedItem, status);
  const recipientCurrency = resolvedItem.receiveCurrency;
  const explicitReceived = resolvedItem.recipientReceivedAmount;
  const explicitReceivedMatchesCurrency = explicitReceived !== undefined
    && resolvedItem.recipientReceivedCurrency === recipientCurrency;
  const derivedReceived = status === '已付款'
    ? prototypeRecipientReceivedAmountFor({
        amount: resolvedItem.amount,
        currency: resolvedItem.currency,
        receiveCurrency: recipientCurrency,
        feeBearer: resolvedItem.feeBearer,
        transferFeeAmount: resolvedItem.transferFeeAmount,
        transferFeeCurrency: resolvedItem.transferFeeCurrency,
      })
    : undefined;

  return {
    key: `batch:${batch.paymentBatchId}:payout:${resolvedItem.payoutId}`,
    paymentBatchId: batch.paymentBatchId,
    payout,
    context: { batch, item: resolvedItem },
    status,
    occurredAt: resolvedItem.failure?.occurredAt ?? resolvedItem.paidAt ?? batch.paidAt,
    provider: resolvedItem.provider,
    paymentAmount: resolvedItem.amount,
    paymentCurrency: resolvedItem.currency,
    transferFeeAmount: resolvedItem.transferFeeAmount,
    transferFeeCurrency: resolvedItem.transferFeeCurrency,
    recipientReceivedAmount: status === '付款失败'
      ? 0
      : status === '已付款'
        ? explicitReceivedMatchesCurrency ? explicitReceived : derivedReceived
        : undefined,
    recipientReceivedCurrency: recipientCurrency,
  };
};

export const createTransactionRecords = (
  payouts: readonly Payout[],
  batches: readonly PaymentBatchRecord[],
): TransactionRecord[] => {
  const payoutsById = new Map(payouts.map((payout) => [payout.id, payout]));
  const batchRecords = batches.flatMap((batch) => batch.items.flatMap((item) => {
    const record = transactionRecordFromBatchItem(batch, item, payoutsById.get(item.payoutId));
    return record ? [record] : [];
  }));

  return batchRecords.sort((left, right) => (
    right.occurredAt.localeCompare(left.occurredAt)
  ));
};

const historicalTransactionDetails = (
  payout: Payout,
  seed: HistoricalPaymentBatchSeed,
): TransactionRecordDetails => {
  const failed = payout.status === '付款失败';
  const paymentTime = transactionOccurredAt(payout);
  const requestReason = `${payout.deliverable ?? '达人合作内容'}已验收，申请支付本期合作款。`;
  const contracts: readonly TransactionContractDetails[] = [{
    contractCode: payout.contract,
    name: `${payout.creator} · ${payout.project}合作协议`,
    currency: payout.currency,
    amount: payout.amount,
    status: '已生效',
    signed: true,
    updatedAt: seed.invoiceDate,
  }];
  const invoice: TransactionInvoiceDetails = {
    invoiceNumber: payout.invoice,
    invoiceDate: seed.invoiceDate,
    currency: payout.currency,
    amount: payout.amount,
    version: payout.invoiceVersion ?? 1,
    reviewStatus: payout.invoiceReviewStatus,
    validationStatus: 'valid',
  };

  return {
    source: 'historical',
    payer: seed.payer,
    paymentTime,
    paymentBatchCode: seed.paymentBatchCode,
    requestCode: seed.requestCode,
    requestStatus: payout.status,
    requestReason,
    cooperationProjectCode: payout.projectId,
    cooperationProjectName: payout.project,
    batchStatus: failed ? '部分失败' : '已付款',
    receiveCurrency: payout.currency,
    transferMethod: seed.transferMethod,
    accountSummary: accountDisplayValue(payout.account),
    feeBearer: '广告主承担',
    transactionReference: `${seed.requestCode}-01`,
    paymentListCode: seed.paymentListCode,
    paymentListStatus: failed ? 'failed' : 'paid',
    paymentListVersion: payout.paymentListVersion ?? 1,
    contracts,
    invoice,
    failure: payout.paymentFailure ? {
      code: payout.paymentFailure.errorCode,
      response: payout.paymentFailure.providerResponse,
      occurredAt: payout.paymentFailure.occurredAt,
    } : undefined,
  };
};

export const transactionRecordDetails = (
  payout: Payout,
  context: TransactionBatchContext | null,
): TransactionRecordDetails => {
  if (context) {
    return {
      source: 'batch',
      payer: context.batch.payer,
      paymentTime: context.item.failure?.occurredAt
        ?? context.item.paidAt
        ?? context.batch.paidAt
        ?? transactionOccurredAt(payout),
      paymentBatchCode: context.batch.paymentBatchCode,
      requestCode: context.batch.request.requestCode,
      requestStatus: context.batch.request.requestStatus,
      requestReason: context.batch.request.reason || context.item.paymentReason || '未单独填写',
      cooperationProjectCode: context.batch.request.cooperationProjectCode,
      cooperationProjectName: context.batch.request.cooperationProjectName,
      batchStatus: context.batch.status,
      receiveCurrency: context.item.receiveCurrency,
      transferMethod: context.item.transferMethod,
      accountSummary: context.item.accountSummary,
      feeBearer: context.item.feeBearer,
      transactionReference: context.item.transactionReference,
      paymentListCode: context.item.paymentListCode,
      paymentListStatus: context.item.paymentListStatus,
      paymentListVersion: context.item.paymentListVersion,
      contracts: context.item.contracts,
      invoice: context.item.invoice,
      failure: context.item.failure,
    };
  }

  const historicalSeed = HISTORICAL_PAYMENT_BATCH_SEEDS[payout.id];
  if (historicalSeed) return historicalTransactionDetails(payout, historicalSeed);

  return {
    source: 'incomplete',
    payer: '历史数据待补全',
    paymentTime: transactionOccurredAt(payout),
    paymentBatchCode: '历史数据待补全',
    requestCode: '历史数据待补全',
    requestStatus: payout.status,
    requestReason: '历史数据待补全',
    cooperationProjectCode: payout.projectId,
    cooperationProjectName: payout.project,
    batchStatus: payout.status,
    receiveCurrency: payout.currency,
    transferMethod: payout.provider,
    accountSummary: accountDisplayValue(payout.account),
    feeBearer: '历史数据待补全',
    transactionReference: '历史数据待补全',
    paymentListCode: '历史数据待补全',
    paymentListStatus: '历史数据待补全',
    contracts: [],
  };
};

export const transactionDateKey = (payout: Payout) => (
  transactionOccurredAt(payout).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? ''
);

export const transactionRecordDateKey = (record: TransactionRecord) => (
  record.occurredAt.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? ''
);

export const isFinalTransaction = (payout: Payout) => (
  isInvoiceApprovedForPayment(payout)
  && (payout.status === '已付款' || payout.status === '付款失败')
);

export const isPaymentTransactionRecord = (payout: Payout) => (
  isInvoiceApprovedForPayment(payout)
  && ['付款处理中', '已付款', '付款失败'].includes(payout.status)
);

export const transactionPaymentStatus = (
  payout: Payout,
  _payouts: readonly Payout[],
  batches: readonly PaymentBatchRecord[] = [],
): PaymentAggregateStatus => {
  const context = findTransactionBatchContext(payout, batches);
  if (!context) return aggregatePaymentStatus([payout.status]);
  return context.batch.status;
};

const matchesTransactionSearch = (record: TransactionRecord, search: string) => {
  const term = search.trim().toLocaleLowerCase();
  if (!term) return true;
  const { payout, context } = record;
  const details = transactionRecordDetails(payout, context);
  return [
    payout.creator,
    payout.handle,
    payout.project,
    payout.projectId,
    payout.invoice,
    payout.contract,
    record.provider,
    record.paymentCurrency,
    record.status,
    details.paymentBatchCode,
    details.requestCode,
    details.cooperationProjectCode,
    details.cooperationProjectName,
    details.payer,
    details.paymentListCode,
    details.transactionReference,
  ].some((value) => value?.toLocaleLowerCase().includes(term));
};

export const filterTransactionRecords = (
  records: readonly TransactionRecord[],
  filters: TransactionRecordFilters,
) => records.filter((record) => {
  if (filters.tab === 'paid' && !['已付款', '付款处理中'].includes(record.status)) return false;
  if (filters.tab === 'failed' && record.status !== '付款失败') return false;
  const paymentStatus = filters.status ?? ALL_PAYMENT_STATUSES;
  if (paymentStatus === '已付款' || paymentStatus === '付款处理中') {
    if (record.status !== paymentStatus) return false;
  } else if (!matchesPaymentStatus(
    record.context?.batch.status ?? aggregatePaymentStatus([record.status]),
    paymentStatus,
  )) return false;
  if (filters.provider !== 'all' && record.provider !== filters.provider) return false;
  if (!matchesTransactionSearch(record, filters.search)) return false;

  const date = transactionRecordDateKey(record);
  if (filters.startDate && (!date || date < filters.startDate)) return false;
  if (filters.endDate && (!date || date > filters.endDate)) return false;
  return true;
});

export const transactionCreatorLabel = (payout: Payout) => {
  const creator = payout.creator.trim();
  const handle = payout.handle.trim();
  if (!handle) return creator;
  const account = formatCreatorHandle(handle, payout.creatorPlatform);
  if (handle.toLocaleLowerCase() === creator.toLocaleLowerCase()) return account;
  return `${creator} (${account})`;
};
