import type { ContractRecord } from './contracts';
import {
  paymentListEffectiveAccount,
  paymentListItemValue,
  type ContractId,
  type CooperationProjectId,
  type InvoiceId,
  type PaymentBatchId,
  type PaymentListId,
  type PaymentListRecord,
  type PaymentRequestProjectId,
} from './businessWorkflow';
import type { RequestProjectSummary } from './pages/RequestProjectDetailPage';
import type {
  GeneratedInvoiceRecord,
  InvoiceCurrency,
  Payout,
  PayoutAccountVersion,
  Provider,
} from './types';

export type PaymentBatchContractSnapshot = Readonly<{
  contractId: ContractId;
  contractCode: string;
  name: string;
  currency: string;
  amount: number | null;
  status: string;
  signed: boolean;
  updatedAt: string;
}>;

export type PaymentBatchInvoiceSnapshot = Readonly<{
  invoiceId: InvoiceId;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  amount: number;
  version: number;
  reviewStatus: string;
  validationStatus: GeneratedInvoiceRecord['validationStatus'];
}>;

export type PaymentBatchItemSnapshot = Readonly<{
  payoutId: string;
  creatorId?: string;
  creatorName: string;
  creatorHandle: string;
  deliverable: string;
  paymentListId?: PaymentListId;
  paymentListCode: string;
  paymentListStatus: string;
  paymentListVersion?: number;
  contracts: readonly PaymentBatchContractSnapshot[];
  invoice?: PaymentBatchInvoiceSnapshot;
  legacyContractReference?: string;
  legacyInvoiceReference?: string;
  provider: Exclude<Provider, '手动打款'>;
  amount: number;
  currency: InvoiceCurrency;
  receiveCurrency: string;
  transferMethod: string;
  accountSummary: string;
  payoutAccountId?: string;
  payoutAccountVersion: PayoutAccountVersion;
  feeBearer: string;
  paymentReason: string;
  transactionReference: string;
  description: string;
  paymentStatus: Payout['status'];
  paidAt?: string;
  failure?: Readonly<{
    code: string;
    response: string;
    occurredAt: string;
  }>;
  associationIssues: readonly string[];
}>;

export type PaymentBatchRequestSnapshot = Readonly<{
  paymentRequestProjectId: PaymentRequestProjectId;
  requestCode: string;
  requestStatus: string;
  lifecycle: string;
  amount: string;
  reason: string;
  expectedPaymentDate: string;
  cooperationProjectId: CooperationProjectId;
  cooperationProjectCode: string;
  cooperationProjectName: string;
  brand: string;
  media: string;
  pm: string;
}>;

export type PaymentBatchRecord = Readonly<{
  paymentBatchId: PaymentBatchId;
  paymentBatchCode: string;
  request: PaymentBatchRequestSnapshot;
  provider: Exclude<Provider, '手动打款'>;
  fundingAccountId: string;
  sourceCurrency: InvoiceCurrency;
  payer: string;
  paidAt: string;
  status: string;
  lifecycle: readonly string[];
  items: readonly PaymentBatchItemSnapshot[];
}>;

type PaymentBatchSourceData = Readonly<{
  payouts: readonly Payout[];
  requests: readonly RequestProjectSummary[];
  generatedInvoices: readonly GeneratedInvoiceRecord[];
  paymentLists: readonly PaymentListRecord[];
  contracts: readonly ContractRecord[];
}>;

type CreatePaymentBatchRecordInput = PaymentBatchSourceData & Readonly<{
  paymentBatchId: PaymentBatchId;
  paymentBatchCode: string;
  provider: Exclude<Provider, '手动打款'>;
  fundingAccountId: string;
  sourceCurrency: InvoiceCurrency;
  payer: string;
  paidAt: string;
  status: string;
  lifecycle: readonly string[];
  itemStatus?: Payout['status'];
}>;

const requestInvoiceIds = (request: RequestProjectSummary) => new Set([
  ...(request.invoiceIds ?? []),
  ...(request.creatorLinks ?? []).flatMap((link) => link.invoiceIds),
]);

const requestProjectId = (request: RequestProjectSummary) => (
  request.cooperationProjectId ?? request.projectId
);

const invoiceAmount = (invoice: GeneratedInvoiceRecord) => invoice.snapshot.items.reduce(
  (total, item) => total + item.lineTotal,
  0,
);

const feeBearerLabel = (value: unknown) => {
  if (value === 'ADVERTISER') return '广告主承担';
  if (value === 'PUBLISHER') return '收款人承担';
  if (value === 'SHARED') return '共同承担';
  return '未记录';
};

const transferMethodLabel = (value: unknown, provider: PaymentBatchItemSnapshot['provider']) => {
  if (provider === 'PayPal' || value === 'PAYPAL') return 'PayPal';
  if (value === 'SWIFT') return 'SWIFT';
  if (value === 'LOCAL') return '本地转账';
  return provider;
};

export const maskPaymentAccount = (value: string) => {
  const normalized = value.trim();
  if (!normalized || normalized === '待补充') return '待补充';
  if (normalized.includes('•')) return normalized;
  if (normalized.includes('@')) {
    const [local, domain] = normalized.split('@');
    if (!domain) return '已脱敏';
    return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
  }
  const compact = normalized.replace(/\s/g, '');
  return compact.length > 4 ? `•••• ${compact.slice(-4)}` : '已脱敏';
};

const requestForPayout = (
  payout: Payout,
  requests: readonly RequestProjectSummary[],
  generatedInvoices: readonly GeneratedInvoiceRecord[],
) => {
  const invoice = generatedInvoices.find((candidate) => candidate.sourcePayoutId === payout.id);
  if (invoice) {
    const invoiceMatches = requests.filter((request) => requestInvoiceIds(request).has(invoice.invoiceId));
    if (invoiceMatches.length === 1) return invoiceMatches[0];
    if (invoiceMatches.length > 1) return null;
  }
  const stableProjectId = invoice
    ? invoice.snapshot.cooperationProjectId ?? invoice.snapshot.projectId
    : payout.projectId;
  const projectMatches = requests.filter((request) => requestProjectId(request) === stableProjectId);
  return projectMatches.length === 1 ? projectMatches[0] : null;
};

const snapshotRequest = (request: RequestProjectSummary): PaymentBatchRequestSnapshot => {
  const paymentRequestProjectId = request.paymentRequestProjectId;
  const cooperationProjectId = requestProjectId(request);
  if (!paymentRequestProjectId || !cooperationProjectId) {
    throw new Error('请款项目缺少稳定的请款项目 ID 或所属项目 ID');
  }
  return {
    paymentRequestProjectId,
    requestCode: request.requestCode ?? request.id,
    requestStatus: request.status,
    lifecycle: request.lifecycle ?? '未记录',
    amount: request.amount,
    reason: request.generatedDetail?.reason || '未单独填写',
    expectedPaymentDate: request.expectedPaymentDate || '未设置',
    cooperationProjectId,
    cooperationProjectCode: request.cooperationProjectCode ?? String(cooperationProjectId),
    cooperationProjectName: request.cooperationProjectName ?? request.project,
    brand: request.brand,
    media: request.media,
    pm: request.pm,
  };
};

const snapshotContract = (contract: ContractRecord): PaymentBatchContractSnapshot => ({
  contractId: contract.contractId as ContractId,
  contractCode: contract.id,
  name: contract.name,
  currency: contract.currency || '未记录',
  amount: contract.totalFee,
  status: contract.status,
  signed: contract.signed,
  updatedAt: contract.updated,
});

const snapshotItem = ({
  payout,
  request,
  generatedInvoices,
  paymentLists,
  contracts,
  itemStatus,
  batchPaidAt,
}: {
  payout: Payout;
  request: RequestProjectSummary;
  generatedInvoices: readonly GeneratedInvoiceRecord[];
  paymentLists: readonly PaymentListRecord[];
  contracts: readonly ContractRecord[];
  itemStatus?: Payout['status'];
  batchPaidAt: string;
}): PaymentBatchItemSnapshot => {
  const invoice = generatedInvoices.find((candidate) => candidate.sourcePayoutId === payout.id);
  const invoiceId = invoice?.invoiceId;
  const paymentList = invoiceId ? paymentLists.find((list) => (
    list.paymentRequestProjectId === request.paymentRequestProjectId
    && list.items.some((item) => item.invoiceId === invoiceId)
  )) : undefined;
  const paymentListItem = invoiceId
    ? paymentList?.items.find((item) => item.invoiceId === invoiceId)
    : undefined;
  const effectiveAccount = paymentListItem ? paymentListEffectiveAccount(paymentListItem) : undefined;
  const contractIds = new Set<ContractId>([
    ...(invoice?.snapshot.contractIds ?? []),
    ...(request.creatorLinks ?? [])
      .filter((link) => !invoice?.snapshot.creatorId || link.creatorId === invoice.snapshot.creatorId)
      .flatMap((link) => link.contractIds),
  ]);
  const contractSnapshots = [...contractIds].flatMap((contractId) => {
    const contract = contracts.find((candidate) => candidate.contractId === contractId);
    return contract?.contractId ? [snapshotContract(contract)] : [];
  });
  const associationIssues = [
    !invoice ? `Invoice ${payout.invoice} 缺少稳定内部关联` : '',
    invoice && !paymentListItem ? `Invoice ${invoice.id} 未在该请款的付款清单中找到` : '',
    ...[...contractIds]
      .filter((contractId) => !contracts.some((contract) => contract.contractId === contractId))
      .map((contractId) => `合同 ${contractId} 关联记录缺失`),
  ].filter(Boolean);
  const documentPayment = invoice?.snapshot.payment;
  const rawAccountSummary = effectiveAccount?.accountSummary
    || documentPayment?.accountName
    || payout.account;
  const receiveCurrency = String(
    paymentListItem ? paymentListItemValue(paymentListItem, 'receiveCurrency') : '',
  ) || documentPayment?.accountCurrency || payout.currency;
  const feeBearer = paymentListItem
    ? paymentListItemValue(paymentListItem, 'feeBearer')
    : payout.feeBearer;

  return {
    payoutId: payout.id,
    creatorId: payout.creatorId ?? invoice?.snapshot.creatorId,
    creatorName: invoice?.snapshot.creatorName ?? payout.creator,
    creatorHandle: invoice?.snapshot.creatorHandle ?? payout.handle,
    deliverable: payout.deliverable || invoice?.snapshot.items[0]?.description || '未记录',
    paymentListId: paymentList?.paymentListId,
    paymentListCode: paymentList?.paymentListCode ?? '关联资料缺失',
    paymentListStatus: paymentList?.status ?? '未关联',
    paymentListVersion: paymentList?.version,
    contracts: contractSnapshots,
    invoice: invoice ? {
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.id,
      invoiceDate: invoice.snapshot.invoiceDate,
      currency: invoice.snapshot.currency,
      amount: invoiceAmount(invoice),
      version: invoice.version ?? payout.invoiceVersion ?? 1,
      reviewStatus: invoice.status,
      validationStatus: invoice.validationStatus,
    } : undefined,
    legacyContractReference: contractSnapshots.length ? undefined : payout.contract,
    legacyInvoiceReference: invoice ? undefined : payout.invoice,
    provider: payout.provider,
    amount: payout.amount,
    currency: payout.currency,
    receiveCurrency,
    transferMethod: transferMethodLabel(
      effectiveAccount?.transferMethod ?? payout.transferMethod ?? documentPayment?.transferMethod,
      payout.provider,
    ),
    accountSummary: maskPaymentAccount(rawAccountSummary),
    payoutAccountId: effectiveAccount?.payoutAccountId
      ?? payout.payoutAccountId
      ?? invoice?.snapshot.payoutAccountId,
    payoutAccountVersion: effectiveAccount?.payoutAccountVersion
      ?? payout.payoutAccountVersion
      ?? invoice?.snapshot.payoutAccountVersion
      ?? 'legacy-v1',
    feeBearer: feeBearerLabel(feeBearer),
    paymentReason: String(paymentListItem ? paymentListItemValue(paymentListItem, 'paymentReason') : '') || '未记录',
    transactionReference: String(paymentListItem ? paymentListItemValue(paymentListItem, 'transactionReference') : '') || '未记录',
    description: String(paymentListItem ? paymentListItemValue(paymentListItem, 'description') : '') || payout.deliverable || '未记录',
    paymentStatus: itemStatus ?? payout.status,
    paidAt: payout.paidAt ?? batchPaidAt,
    failure: payout.paymentFailure ? {
      code: payout.paymentFailure.errorCode,
      response: payout.paymentFailure.providerResponse,
      occurredAt: payout.paymentFailure.occurredAt,
    } : undefined,
    associationIssues,
  };
};

export const createPaymentBatchRecord = ({
  payouts,
  requests,
  generatedInvoices,
  paymentLists,
  contracts,
  itemStatus,
  ...batch
}: CreatePaymentBatchRecordInput): PaymentBatchRecord => {
  if (!payouts.length) throw new Error('付款批次至少需要一笔付款明细');
  if (payouts.some((payout) => payout.provider !== batch.provider)) {
    throw new Error('一个付款批次只能包含同一付款渠道的付款明细');
  }
  const matchedRequests = payouts.map((payout) => requestForPayout(payout, requests, generatedInvoices));
  if (matchedRequests.some((request) => !request)) {
    throw new Error('所选付款中存在无法通过稳定 ID 关联请款项目的记录');
  }
  const uniqueRequestIds = new Set(matchedRequests.map((request) => request!.paymentRequestProjectId));
  if (uniqueRequestIds.size !== 1) {
    throw new Error('一个付款批次只能关联一个请款项目');
  }
  const request = matchedRequests[0]!;
  return {
    ...batch,
    request: snapshotRequest(request),
    items: payouts.map((payout) => snapshotItem({
      payout,
      request,
      generatedInvoices,
      paymentLists,
      contracts,
      itemStatus,
      batchPaidAt: batch.paidAt,
    })),
  };
};

export const paymentBatchAmountLabel = (batch: Pick<PaymentBatchRecord, 'items'>) => {
  const totals = batch.items.reduce<Record<string, number>>((result, item) => ({
    ...result,
    [item.currency]: (result[item.currency] ?? 0) + item.amount,
  }), {});
  return Object.entries(totals)
    .map(([currency, amount]) => `${currency} ${amount.toLocaleString('en-US')}`)
    .join(' + ');
};

export const paymentBatchStatusCounts = (batch: Pick<PaymentBatchRecord, 'items'>) => batch.items.reduce(
  (counts, item) => {
    if (item.paymentStatus === '已付款') counts.succeeded += 1;
    else if (item.paymentStatus === '付款失败' || item.paymentStatus === '已退回') counts.failed += 1;
    else counts.processing += 1;
    return counts;
  },
  { succeeded: 0, failed: 0, processing: 0 },
);

export const createInitialPaymentBatches = ({
  payouts,
  requests,
  generatedInvoices,
  paymentLists,
  contracts,
}: PaymentBatchSourceData): PaymentBatchRecord[] => {
  const financeAirwallex = payouts.find((payout) => (
    payout.id.startsWith('payout_fixture_association_301164') && payout.provider === 'Airwallex'
  ));
  const financePayPal = payouts.find((payout) => (
    payout.id.startsWith('payout_fixture_association_301164') && payout.provider === 'PayPal'
  ));
  const returnedPayPal = payouts.find((payout) => payout.id === 'pay-020');
  const shared = { requests, generatedInvoices, paymentLists, contracts };
  const seeds = [
    {
      payout: financeAirwallex,
      paymentBatchId: 'payment_batch_fixture_001' as PaymentBatchId,
      paymentBatchCode: 'BAT-20260716-007',
      provider: 'Airwallex' as const,
      fundingAccountId: 'mock-awx-operating',
      payer: '奚文慧',
      paidAt: '2026-07-16T16:42',
      status: '已完成',
      lifecycle: ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED', 'COMPLETED'] as const,
      itemStatus: '已付款' as const,
    },
    {
      payout: financePayPal,
      paymentBatchId: 'payment_batch_fixture_002' as PaymentBatchId,
      paymentBatchCode: 'BAT-20260715-006',
      provider: 'PayPal' as const,
      fundingAccountId: 'mock-paypal-balance',
      payer: '李梦',
      paidAt: '2026-07-15T11:20',
      status: '已完成',
      lifecycle: ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED', 'COMPLETED'] as const,
      itemStatus: '已付款' as const,
    },
    {
      payout: returnedPayPal,
      paymentBatchId: 'payment_batch_fixture_003' as PaymentBatchId,
      paymentBatchCode: 'BAT-20260712-005',
      provider: 'PayPal' as const,
      fundingAccountId: 'mock-paypal-balance',
      payer: '吴雪霓',
      paidAt: '2026-07-12T09:05',
      status: '部分失败',
      lifecycle: ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED', 'PARTIALLY_FAILED'] as const,
      itemStatus: '付款失败' as const,
    },
  ];

  return seeds.flatMap(({ payout, ...seed }) => {
    if (!payout) return [];
    try {
      return [createPaymentBatchRecord({
        ...shared,
        ...seed,
        payouts: [payout],
        sourceCurrency: payout.currency,
      })];
    } catch {
      // Partial demo fixtures must not prevent the rest of the prototype from opening.
      return [];
    }
  });
};
