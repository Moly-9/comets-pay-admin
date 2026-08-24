import { isInvoiceApprovedForPayment } from './invoice/invoiceReviewWorkflow';
import { accountDisplayValue } from './accountPresentation';
import {
  type PaymentBatchContractSnapshot,
  type PaymentBatchInvoiceSnapshot,
  type PaymentBatchItemSnapshot,
  type PaymentBatchRecord,
} from './paymentBatches';
import type { Payout } from './types';
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

type HistoricalTransactionSeed = Readonly<{
  payer: string;
  paymentBatchCode: string;
  requestCode: string;
  paymentListCode: string;
  invoiceDate: string;
  transferMethod: string;
}>;

const HISTORICAL_TRANSACTION_SEEDS: Readonly<Record<string, HistoricalTransactionSeed>> = {
  'pay-005': {
    payer: '奚文慧',
    paymentBatchCode: 'BAT-20260716-001',
    requestCode: 'REQ-20260716-000005',
    paymentListCode: 'PAY-20260716-001',
    invoiceDate: '2026-07-12',
    transferMethod: '本地转账',
  },
  'pay-006': {
    payer: '李梦',
    paymentBatchCode: 'BAT-20260715-001',
    requestCode: 'REQ-20260715-000006',
    paymentListCode: 'PAY-20260715-001',
    invoiceDate: '2026-07-11',
    transferMethod: '本地转账',
  },
  'pay-017': {
    payer: '吴雪霓',
    paymentBatchCode: 'BAT-20260804-001',
    requestCode: 'REQ-20260804-000017',
    paymentListCode: 'PAY-20260804-001',
    invoiceDate: '2026-08-02',
    transferMethod: '本地转账',
  },
  'pay-018': {
    payer: '奚文慧',
    paymentBatchCode: 'BAT-20260725-001',
    requestCode: 'REQ-20260725-000018',
    paymentListCode: 'PAY-20260725-001',
    invoiceDate: '2026-07-22',
    transferMethod: '本地转账',
  },
  'pay-019': {
    payer: '李梦',
    paymentBatchCode: 'BAT-20260726-001',
    requestCode: 'REQ-20260726-000019',
    paymentListCode: 'PAY-20260726-001',
    invoiceDate: '2026-07-23',
    transferMethod: 'PayPal',
  },
  'pay-026': {
    payer: '吴雪霓',
    paymentBatchCode: 'BAT-20260804-002',
    requestCode: 'REQ-20260804-000026',
    paymentListCode: 'PAY-20260804-002',
    invoiceDate: '2026-08-01',
    transferMethod: '本地转账',
  },
  'pay-027': {
    payer: '奚文慧',
    paymentBatchCode: 'BAT-20260805-001',
    requestCode: 'REQ-20260805-000027',
    paymentListCode: 'PAY-20260805-001',
    invoiceDate: '2026-08-02',
    transferMethod: '本地转账',
  },
  'pay-028': {
    payer: '李梦',
    paymentBatchCode: 'BAT-20260806-001',
    requestCode: 'REQ-20260806-000028',
    paymentListCode: 'PAY-20260806-001',
    invoiceDate: '2026-08-03',
    transferMethod: 'SWIFT',
  },
  'pay-029': {
    payer: '吴雪霓',
    paymentBatchCode: 'BAT-20260807-001',
    requestCode: 'REQ-20260807-000029',
    paymentListCode: 'PAY-20260807-001',
    invoiceDate: '2026-08-04',
    transferMethod: '本地转账',
  },
  'pay-030': {
    payer: '奚文慧',
    paymentBatchCode: 'BAT-20260808-001',
    requestCode: 'REQ-20260808-000030',
    paymentListCode: 'PAY-20260808-001',
    invoiceDate: '2026-08-05',
    transferMethod: '本地转账',
  },
};

export const findTransactionBatchContext = (
  payout: Pick<Payout, 'id'>,
  batches: readonly PaymentBatchRecord[],
): TransactionBatchContext | null => {
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

const historicalTransactionDetails = (
  payout: Payout,
  seed: HistoricalTransactionSeed,
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
      paymentTime: context.item.paidAt ?? context.batch.paidAt ?? transactionOccurredAt(payout),
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

  const historicalSeed = HISTORICAL_TRANSACTION_SEEDS[payout.id];
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
  payouts: readonly Payout[],
  batches: readonly PaymentBatchRecord[] = [],
): PaymentAggregateStatus => {
  const context = findTransactionBatchContext(payout, batches);
  if (!context) return aggregatePaymentStatus([payout.status]);
  const payoutById = new Map(payouts.map((item) => [item.id, item]));
  const statuses = context.batch.items.map((item) => (
    payoutById.get(item.payoutId)?.status ?? item.paymentStatus
  ));
  return aggregatePaymentStatus(statuses, context.batch.status);
};

const matchesTransactionSearch = (
  payout: Payout,
  search: string,
  batchContext: TransactionBatchContext | null,
) => {
  const term = search.trim().toLocaleLowerCase();
  if (!term) return true;
  const details = transactionRecordDetails(payout, batchContext);
  return [
    payout.creator,
    payout.handle,
    payout.project,
    payout.projectId,
    payout.invoice,
    payout.contract,
    payout.provider,
    payout.currency,
    payout.status,
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
  payouts: Payout[],
  filters: TransactionRecordFilters,
  batches: readonly PaymentBatchRecord[] = [],
) => payouts.filter((payout) => {
  if (!isPaymentTransactionRecord(payout)) return false;
  if (filters.tab === 'paid' && !['已付款', '付款处理中'].includes(payout.status)) return false;
  if (filters.tab === 'failed' && payout.status !== '付款失败') return false;
  const paymentStatus = filters.status ?? ALL_PAYMENT_STATUSES;
  if (paymentStatus === '已付款' || paymentStatus === '付款处理中') {
    if (payout.status !== paymentStatus) return false;
  } else if (!matchesPaymentStatus(
    transactionPaymentStatus(payout, payouts, batches),
    paymentStatus,
  )) return false;
  if (filters.provider !== 'all' && payout.provider !== filters.provider) return false;
  if (!matchesTransactionSearch(payout, filters.search, findTransactionBatchContext(payout, batches))) return false;

  const date = transactionDateKey(payout);
  if (filters.startDate && (!date || date < filters.startDate)) return false;
  if (filters.endDate && (!date || date > filters.endDate)) return false;
  return true;
});

export const transactionCreatorLabel = (payout: Payout) => {
  const creator = payout.creator.trim();
  const handle = payout.handle.trim();
  if (!handle || handle.toLocaleLowerCase() === creator.toLocaleLowerCase()) return creator;
  return `${creator} (${handle})`;
};
