import type { ContractRecord } from './contracts';
import { SYSTEM_USERS } from './data';
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
  DocumentPayoutSnapshot,
  GeneratedInvoiceRecord,
  InvoiceCurrency,
  PaymentAttemptSnapshot,
  Payout,
  PayoutAccountVersion,
  Provider,
} from './types';
import { accountDisplayValue } from './accountPresentation';
import {
  HISTORICAL_PAYMENT_BATCH_SEEDS,
  type HistoricalPaymentBatchSeed,
} from './historicalPaymentBatchFixtures';
import {
  applyPaymentBatchPrototypeScenario,
  PAYMENT_BATCH_PARTIAL_FAILURE_DEMO,
  PAYMENT_BATCH_RETRY_DEMO,
  paymentBatchPrototypeStatusFor,
  type PaymentBatchPrototypeStatus,
} from './paymentBatchPrototypeScenario';
import { aggregatePaymentStatus } from './paymentStatusFilters';
import { prototypeRecipientReceivedAmountFor } from './prototypePaymentResults';
import { nextPaymentBusinessCode } from './paymentNumbering';

export type PaymentBatchStatus = PaymentBatchPrototypeStatus;

export type PaymentBatchContractSnapshot = Readonly<{
  contractId: ContractId;
  contractCode: string;
  name: string;
  currency: string;
  amount: number | null;
  signer?: string;
  paymentAccount?: string;
  /** @deprecated Historical snapshot only. */
  status?: string;
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
  /** 冻结的单笔业务付款编号；旧快照可能缺失。 */
  paymentCode?: string;
  creatorId?: string;
  creatorName: string;
  creatorHandle: string;
  creatorSocialAccountId?: string;
  creatorPlatform?: string;
  deliverable: string;
  paymentListId?: PaymentListId;
  paymentListCode: string;
  paymentListStatus: string;
  paymentListVersion?: number;
  paymentOrderCode?: string;
  sourcePaymentOrderCode?: string;
  paymentAttemptNumber?: number;
  paymentAttempts?: readonly PaymentAttemptSnapshot[];
  contracts: readonly PaymentBatchContractSnapshot[];
  invoice?: PaymentBatchInvoiceSnapshot;
  legacyContractReference?: string;
  legacyInvoiceReference?: string;
  provider: Exclude<Provider, '手动打款'>;
  amount: number;
  currency: InvoiceCurrency;
  receiveCurrency: InvoiceCurrency;
  transferMethod: string;
  localClearingSystem?: string;
  recipientCountry?: string;
  accountSummary: string;
  accountName?: string;
  accountIdentifier?: string;
  accountIdentifierLabel?: 'Account Number' | 'IBAN' | 'PayPal 邮箱' | 'PayPal 账户' | 'PayMax 账户 ID' | '历史收款标识';
  payoutAccountId?: string;
  payoutAccountVersion: PayoutAccountVersion;
  feeBearer: string;
  paymentReason: string;
  transactionReference: string;
  description: string;
  paymentStatus: Payout['status'];
  paidAt?: string;
  transferFeeAmount?: number;
  transferFeeCurrency?: InvoiceCurrency;
  actualPaidAmount?: number;
  actualPaidCurrency?: InvoiceCurrency;
  recipientReceivedAmount?: number;
  recipientReceivedCurrency?: InvoiceCurrency;
  postTransactionBalance?: number;
  postTransactionBalanceCurrency?: InvoiceCurrency;
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
  paymentEntity?: string;
  projectCostAttribution?: string;
  expectedPaymentDate: string;
  costType?: string;
  costTypeDetail?: string;
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
  paymentOrderCode: string;
  sourcePaymentOrderCode?: string;
  paymentAttemptNumber: number;
  request: PaymentBatchRequestSnapshot;
  provider: Exclude<Provider, '手动打款'>;
  fundingAccountId: string;
  sourceCurrency: InvoiceCurrency;
  payer: string;
  paidAt: string;
  status: PaymentBatchStatus;
  lifecycle: readonly string[];
  items: readonly PaymentBatchItemSnapshot[];
}>;

export type PaymentProjectPaymentStatus = PaymentBatchStatus | '已退回';

export type PaymentProjectPaymentRecord = Readonly<{
  request: PaymentBatchRequestSnapshot;
  paymentOrderCodes: readonly string[];
  providers: readonly PaymentBatchRecord['provider'][];
  status: PaymentProjectPaymentStatus;
  lastActivityAt?: string;
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
  status: PaymentBatchStatus;
  lifecycle: readonly string[];
  itemStatus?: Payout['status'];
  paymentOrderCode?: string;
  sourcePaymentOrderCode?: string;
  paymentAttemptNumber?: number;
}>;

type CreatePaymentExecutionBatchRecordInput = PaymentBatchSourceData & Readonly<{
  existingBatches: readonly PaymentBatchRecord[];
  paymentBatchId: PaymentBatchId;
  paymentBatchCode: string;
  payer: string;
  submittedAt: string;
}>;

const PAYMENT_EXECUTION_FUNDING_ACCOUNTS: Record<PaymentBatchRecord['provider'], string> = {
  Airwallex: 'mock-awx-operating',
  PayPal: 'mock-paypal-balance',
  PayMax: 'mock-paymax-operating',
};

const historicalPaymentBatchTime = (payout: Payout) => (
  payout.status === '付款失败'
    ? payout.paymentFailure?.occurredAt ?? payout.paidAt ?? '历史时间待补全'
    : payout.paidAt ?? '历史时间待补全'
);

const historicalPaymentBatchRecord = (
  payout: Payout,
  seed: HistoricalPaymentBatchSeed,
): PaymentBatchRecord => {
  const paidAt = historicalPaymentBatchTime(payout);
  const failed = payout.status === '付款失败' || payout.status === '已退回';
  const status = aggregatePaymentStatus([payout.status]);
  const accountSummary = accountDisplayValue(payout.account);
  const feeBearer = feeBearerLabel(payout.feeBearer);
  const paymentStatus = failed ? '付款失败' : '已付款';
  const receiveCurrency = payout.recipientReceivedCurrency ?? payout.currency;
  const recipientResult = recipientResultSnapshot({
    status: paymentStatus,
    amount: payout.amount,
    currency: payout.currency,
    receiveCurrency,
    feeBearer,
    transferFeeAmount: payout.transferFeeAmount,
    transferFeeCurrency: payout.transferFeeCurrency,
    recipientReceivedAmount: payout.recipientReceivedAmount,
    recipientReceivedCurrency: payout.recipientReceivedCurrency,
  });
  const paymentReason = `${payout.deliverable ?? '达人合作内容'}已验收，申请支付本期合作款。`;
  const paymentBatchId = `payment_batch_legacy_${payout.id}` as PaymentBatchId;
  const paymentRequestProjectId = `payment_request_legacy_${payout.id}` as PaymentRequestProjectId;
  const cooperationProjectId = `cooperation_project_legacy_${payout.projectId}` as CooperationProjectId;
  const paymentListId = `payment_list_legacy_${payout.id}` as PaymentListId;
  const contractId = `contract_legacy_${payout.id}` as ContractId;
  const invoiceId = `invoice_legacy_${payout.id}` as InvoiceId;

  return {
    paymentBatchId,
    paymentBatchCode: seed.paymentBatchCode,
    paymentOrderCode: seed.paymentListCode,
    paymentAttemptNumber: 1,
    request: {
      paymentRequestProjectId,
      requestCode: seed.requestCode,
      requestStatus: paymentStatus,
      lifecycle: failed ? 'PAYMENT_FAILED' : 'PAID',
      amount: `${payout.currency} ${payout.amount.toLocaleString('en-US')}`,
      reason: paymentReason,
      expectedPaymentDate: paidAt.slice(0, 10),
      cooperationProjectId,
      cooperationProjectCode: payout.projectId,
      cooperationProjectName: payout.project,
      brand: 'COMETS',
      media: payout.creator,
      pm: '历史付款资料',
    },
    provider: payout.provider,
    fundingAccountId: PAYMENT_EXECUTION_FUNDING_ACCOUNTS[payout.provider],
    sourceCurrency: payout.currency,
    payer: seed.payer,
    paidAt,
    status,
    lifecycle: failed
      ? ['CREATED', 'ITEMS_ADDED', 'SUBMITTED', 'FAILED']
      : ['CREATED', 'ITEMS_ADDED', 'SUBMITTED', 'COMPLETED'],
    items: [{
      payoutId: payout.id,
      paymentCode: payout.paymentCode,
      creatorId: payout.creatorId,
      creatorName: payout.creator,
      creatorHandle: payout.handle,
      creatorSocialAccountId: payout.creatorSocialAccountId,
      creatorPlatform: payout.creatorPlatform,
      deliverable: payout.deliverable ?? '达人合作内容',
      paymentListId,
      paymentListCode: seed.paymentListCode,
      paymentListStatus: failed ? 'failed' : 'paid',
      paymentListVersion: payout.paymentListVersion ?? 1,
      paymentOrderCode: seed.paymentListCode,
      sourcePaymentOrderCode: seed.paymentListCode,
      paymentAttemptNumber: 1,
      paymentAttempts: payout.paymentAttempts
        ?.map((attempt) => normalizePaymentAttemptRecipient(attempt, receiveCurrency, feeBearer)),
      contracts: [{
        contractId,
        contractCode: payout.contract,
        name: `${payout.creator} · ${payout.project}合作协议`,
        currency: payout.currency,
        amount: payout.amount,
        status: '已生效',
        signed: true,
        updatedAt: seed.invoiceDate,
      }],
      invoice: {
        invoiceId,
        invoiceNumber: payout.invoice,
        invoiceDate: seed.invoiceDate,
        currency: payout.currency,
        amount: payout.amount,
        version: payout.invoiceVersion ?? 1,
        reviewStatus: payout.invoiceReviewStatus,
        validationStatus: 'valid',
      },
      provider: payout.provider,
      amount: payout.amount,
      currency: payout.currency,
      receiveCurrency,
      transferMethod: seed.transferMethod,
      localClearingSystem: payout.localClearingSystem,
      recipientCountry: payout.recipientCountry,
      accountSummary,
      accountIdentifier: accountSummary,
      accountIdentifierLabel: '历史收款标识',
      payoutAccountId: payout.payoutAccountId,
      payoutAccountVersion: payout.payoutAccountVersion ?? 'legacy-v1',
      feeBearer: feeBearer === '未记录' ? '广告主承担' : feeBearer,
      paymentReason,
      transactionReference: `${seed.requestCode}-01`,
      description: payout.deliverable ?? '达人合作内容',
      paymentStatus,
      paidAt,
      transferFeeAmount: payout.transferFeeAmount,
      transferFeeCurrency: payout.transferFeeCurrency,
      actualPaidAmount: payout.actualPaidAmount,
      actualPaidCurrency: payout.actualPaidCurrency,
      recipientReceivedAmount: recipientResult.recipientReceivedAmount,
      recipientReceivedCurrency: recipientResult.recipientReceivedCurrency,
      postTransactionBalance: failed ? undefined : payout.postTransactionBalance,
      postTransactionBalanceCurrency: failed ? undefined : payout.postTransactionBalanceCurrency,
      failure: failed && payout.paymentFailure ? {
        code: payout.paymentFailure.errorCode,
        response: payout.paymentFailure.providerResponse,
        occurredAt: payout.paymentFailure.occurredAt,
      } : undefined,
      associationIssues: [],
    }],
  };
};

const createHistoricalPaymentBatchRecords = (
  payouts: readonly Payout[],
  existingBatches: readonly PaymentBatchRecord[],
) => {
  const batchedPayoutIds = new Set(existingBatches.flatMap((batch) => (
    batch.items.map((item) => item.payoutId)
  )));
  return payouts.flatMap((payout) => {
    const seed = HISTORICAL_PAYMENT_BATCH_SEEDS[payout.id];
    if (!seed || batchedPayoutIds.has(payout.id)) return [];
    return [historicalPaymentBatchRecord(payout, seed)];
  });
};

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

const INVOICE_CURRENCIES = new Set<InvoiceCurrency>(['USD', 'EUR', 'GBP', 'HKD', 'SGD']);

const invoiceCurrency = (value: unknown, fallback: InvoiceCurrency): InvoiceCurrency => {
  const normalized = String(value ?? '').trim() as InvoiceCurrency;
  return INVOICE_CURRENCIES.has(normalized) ? normalized : fallback;
};

const recipientResultSnapshot = ({
  status,
  amount,
  currency,
  receiveCurrency,
  feeBearer,
  transferFeeAmount,
  transferFeeCurrency,
  recipientReceivedAmount,
  recipientReceivedCurrency,
}: {
  status: Payout['status'];
  amount: number;
  currency: InvoiceCurrency;
  receiveCurrency: InvoiceCurrency;
  feeBearer?: string;
  transferFeeAmount?: number;
  transferFeeCurrency?: InvoiceCurrency;
  recipientReceivedAmount?: number;
  recipientReceivedCurrency?: InvoiceCurrency;
}) => {
  if (status === '付款失败' || status === '已退回') {
    return { recipientReceivedAmount: 0, recipientReceivedCurrency: receiveCurrency };
  }
  if (status !== '已付款') {
    return { recipientReceivedAmount: undefined, recipientReceivedCurrency: undefined };
  }
  return {
    recipientReceivedAmount: recipientReceivedAmount !== undefined
      && recipientReceivedCurrency === receiveCurrency
      ? recipientReceivedAmount
      : prototypeRecipientReceivedAmountFor({
          amount,
          currency,
          receiveCurrency,
          feeBearer,
          transferFeeAmount,
          transferFeeCurrency,
        }),
    recipientReceivedCurrency: receiveCurrency,
  };
};

const normalizePaymentAttemptRecipient = (
  attempt: PaymentAttemptSnapshot,
  receiveCurrency: InvoiceCurrency,
  feeBearer?: string,
): PaymentAttemptSnapshot => ({
  ...attempt,
  ...recipientResultSnapshot({
    status: attempt.status,
    amount: attempt.principalAmount,
    currency: attempt.principalCurrency,
    receiveCurrency,
    feeBearer,
    transferFeeAmount: attempt.transferFeeAmount,
    transferFeeCurrency: attempt.transferFeeCurrency,
    recipientReceivedAmount: attempt.recipientReceivedAmount,
    recipientReceivedCurrency: attempt.recipientReceivedCurrency,
  }),
});

const transferMethodLabel = (value: unknown, provider: PaymentBatchItemSnapshot['provider']) => {
  if (provider === 'PayPal' || value === 'PAYPAL') return 'PayPal';
  if (value === 'SWIFT') return 'SWIFT';
  if (value === 'LOCAL') return '本地转账';
  return provider;
};

const normalizedSnapshotValue = (value: unknown) => String(value ?? '').trim();

const paymentRecipientSnapshot = ({
  provider,
  payment,
  accountSummary,
}: {
  provider: PaymentBatchItemSnapshot['provider'];
  payment?: DocumentPayoutSnapshot;
  accountSummary: string;
}): Pick<PaymentBatchItemSnapshot, 'accountName' | 'accountIdentifier' | 'accountIdentifierLabel'> => {
  const accountName = normalizedSnapshotValue(payment?.accountName) || undefined;
  if (provider === 'PayPal') {
    const email = normalizedSnapshotValue(payment?.paypalEmail);
    const username = normalizedSnapshotValue(payment?.paypalUsername);
    return {
      accountName,
      accountIdentifier: email || username || accountSummary || undefined,
      accountIdentifierLabel: email ? 'PayPal 邮箱' : username ? 'PayPal 账户' : '历史收款标识',
    };
  }
  if (provider === 'PayMax') {
    return {
      accountName,
      accountIdentifier: accountSummary || normalizedSnapshotValue(payment?.accountNumber) || undefined,
      accountIdentifierLabel: accountSummary || payment?.accountNumber ? 'PayMax 账户 ID' : undefined,
    };
  }
  const accountNumber = normalizedSnapshotValue(payment?.accountNumber);
  const iban = normalizedSnapshotValue(payment?.iban);
  return {
    accountName,
    accountIdentifier: accountNumber || iban || accountSummary || undefined,
    accountIdentifierLabel: accountNumber ? 'Account Number' : iban ? 'IBAN' : accountSummary ? '历史收款标识' : undefined,
  };
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
    paymentEntity: request.paymentEntity,
    projectCostAttribution: request.projectCostAttribution,
    expectedPaymentDate: request.expectedPaymentDate || '未设置',
    costType: request.costType,
    costTypeDetail: request.costTypeDetail,
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
  signer: contract.publisher || contract.advertiser || undefined,
  paymentAccount: contract.accountName
    || contract.paymentSnapshot?.accountName
    || contract.paymentSnapshot?.paypalEmail
    || undefined,
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
  paymentOrderCode,
  paymentAttemptNumber,
}: {
  payout: Payout;
  request: RequestProjectSummary;
  generatedInvoices: readonly GeneratedInvoiceRecord[];
  paymentLists: readonly PaymentListRecord[];
  contracts: readonly ContractRecord[];
  itemStatus?: Payout['status'];
  batchPaidAt: string;
  paymentOrderCode?: string;
  paymentAttemptNumber?: number;
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
  const receiveCurrency = invoiceCurrency(
    paymentListItem ? paymentListItemValue(paymentListItem, 'receiveCurrency') : documentPayment?.accountCurrency,
    payout.currency,
  );
  const feeBearer = paymentListItem
    ? paymentListItemValue(paymentListItem, 'feeBearer')
    : payout.feeBearer;
  const feeBearerSnapshot = feeBearerLabel(feeBearer);
  const effectivePaymentDetails = effectiveAccount?.paymentDetails ?? documentPayment;
  const accountRecipient = paymentRecipientSnapshot({
    provider: payout.provider,
    payment: effectivePaymentDetails,
    accountSummary: accountDisplayValue(rawAccountSummary, ''),
  });
  const paymentStatus = itemStatus ?? payout.status;
  const hasSuccessfulResult = paymentStatus === '已付款';
  const hasFailedResult = paymentStatus === '付款失败' || paymentStatus === '已退回';
  const hasFinalizedResult = hasSuccessfulResult || hasFailedResult;
  const sourcePaymentOrderCode = paymentList?.paymentListCode ?? '关联资料缺失';
  const resolvedPaymentOrderCode = paymentOrderCode
    ?? payout.currentPaymentAttempt?.paymentOrderCode
    ?? sourcePaymentOrderCode;
  const resolvedAttemptNumber = paymentAttemptNumber
    ?? payout.currentPaymentAttempt?.attemptNumber
    ?? (resolvedPaymentOrderCode !== sourcePaymentOrderCode ? 2 : 1);
  const recipientResult = recipientResultSnapshot({
    status: paymentStatus,
    amount: payout.amount,
    currency: payout.currency,
    receiveCurrency,
    feeBearer: feeBearerSnapshot,
    transferFeeAmount: payout.transferFeeAmount,
    transferFeeCurrency: payout.transferFeeCurrency,
    recipientReceivedAmount: payout.recipientReceivedAmount,
    recipientReceivedCurrency: payout.recipientReceivedCurrency,
  });

  return {
    payoutId: payout.id,
    paymentCode: payout.paymentCode,
    creatorId: payout.creatorId ?? invoice?.snapshot.creatorId,
    creatorName: invoice?.snapshot.creatorName ?? payout.creator,
    creatorHandle: invoice?.snapshot.creatorHandle ?? payout.handle,
    creatorSocialAccountId: invoice?.snapshot.creatorSocialAccountId ?? payout.creatorSocialAccountId,
    creatorPlatform: invoice?.snapshot.creatorPlatform ?? payout.creatorPlatform,
    deliverable: payout.deliverable || invoice?.snapshot.items[0]?.description || '未记录',
    paymentListId: paymentList?.paymentListId,
    paymentListCode: paymentList?.paymentListCode ?? '关联资料缺失',
    paymentListStatus: paymentList?.status ?? '未关联',
    paymentListVersion: paymentList?.version,
    paymentOrderCode: resolvedPaymentOrderCode,
    sourcePaymentOrderCode,
    paymentAttemptNumber: resolvedAttemptNumber,
    paymentAttempts: payout.paymentAttempts
      ?.filter((attempt) => attempt.attemptNumber <= resolvedAttemptNumber)
      .map((attempt) => normalizePaymentAttemptRecipient(attempt, receiveCurrency, feeBearerSnapshot)),
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
    localClearingSystem: effectivePaymentDetails?.localClearingSystem
      || payout.localClearingSystem
      || undefined,
    recipientCountry: effectivePaymentDetails?.bankCountry
      || payout.recipientCountry
      || undefined,
    accountSummary: accountDisplayValue(rawAccountSummary),
    ...accountRecipient,
    payoutAccountId: effectiveAccount?.payoutAccountId
      ?? payout.payoutAccountId
      ?? invoice?.snapshot.payoutAccountId,
    payoutAccountVersion: effectiveAccount?.payoutAccountVersion
      ?? payout.payoutAccountVersion
      ?? invoice?.snapshot.payoutAccountVersion
      ?? 'legacy-v1',
    feeBearer: feeBearerSnapshot,
    paymentReason: String(paymentListItem ? paymentListItemValue(paymentListItem, 'paymentReason') : '') || '未记录',
    transactionReference: String(paymentListItem ? paymentListItemValue(paymentListItem, 'transactionReference') : '') || '未记录',
    description: String(paymentListItem ? paymentListItemValue(paymentListItem, 'description') : '') || payout.deliverable || '未记录',
    paymentStatus,
    paidAt: payout.paidAt ?? batchPaidAt,
    transferFeeAmount: hasFinalizedResult ? payout.transferFeeAmount : undefined,
    transferFeeCurrency: hasFinalizedResult ? payout.transferFeeCurrency : undefined,
    actualPaidAmount: hasFinalizedResult ? payout.actualPaidAmount : undefined,
    actualPaidCurrency: hasFinalizedResult ? payout.actualPaidCurrency : undefined,
    recipientReceivedAmount: hasFinalizedResult ? recipientResult.recipientReceivedAmount : undefined,
    recipientReceivedCurrency: hasFinalizedResult ? recipientResult.recipientReceivedCurrency : undefined,
    postTransactionBalance: hasSuccessfulResult ? payout.postTransactionBalance : undefined,
    postTransactionBalanceCurrency: hasSuccessfulResult ? payout.postTransactionBalanceCurrency : undefined,
    failure: hasFailedResult && payout.paymentFailure ? {
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
  paymentOrderCode,
  sourcePaymentOrderCode,
  paymentAttemptNumber,
  ...batch
}: CreatePaymentBatchRecordInput): PaymentBatchRecord => {
  if (!payouts.length) throw new Error('付款批次至少需要一笔付款明细');
  if (new Set(payouts.map((payout) => payout.id)).size !== payouts.length) {
    throw new Error('同一个付款批次不能重复包含同一笔付款明细');
  }
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
  const sourceItems = payouts.map((payout) => snapshotItem({
    payout,
    request,
    generatedInvoices,
    paymentLists,
    contracts,
    itemStatus,
    batchPaidAt: batch.paidAt,
    paymentOrderCode: '',
    paymentAttemptNumber: 1,
  }));
  const sourceOrderCodes = new Set(sourceItems.map((item) => item.sourcePaymentOrderCode));
  if (sourceOrderCodes.size !== 1) {
    throw new Error('一个付款批次只能关联一张原付款单');
  }
  const resolvedSourcePaymentOrderCode = sourcePaymentOrderCode
    ?? sourceItems[0].sourcePaymentOrderCode
    ?? '关联资料缺失';
  const resolvedPaymentOrderCode = paymentOrderCode || resolvedSourcePaymentOrderCode;
  const resolvedPaymentAttemptNumber = Math.max(
    1,
    paymentAttemptNumber ?? (resolvedPaymentOrderCode === resolvedSourcePaymentOrderCode ? 1 : 2),
  );
  return {
    ...batch,
    paymentOrderCode: resolvedPaymentOrderCode,
    sourcePaymentOrderCode: resolvedPaymentAttemptNumber > 1
      ? resolvedSourcePaymentOrderCode
      : undefined,
    paymentAttemptNumber: resolvedPaymentAttemptNumber,
    request: snapshotRequest(request),
    items: payouts.map((payout) => snapshotItem({
      payout,
      request,
      generatedInvoices,
      paymentLists,
      contracts,
      itemStatus,
      batchPaidAt: batch.paidAt,
      paymentOrderCode: resolvedPaymentOrderCode,
      paymentAttemptNumber: resolvedPaymentAttemptNumber,
    })),
  };
};

export const paymentBatchItemOrderCode = (item: PaymentBatchItemSnapshot) => (
  item.paymentOrderCode || item.paymentListCode || '关联资料缺失'
);

export const paymentBatchItemSourceOrderCode = (item: PaymentBatchItemSnapshot) => (
  item.sourcePaymentOrderCode || item.paymentListCode || '关联资料缺失'
);

export const paymentBatchItemAttemptNumber = (item: PaymentBatchItemSnapshot) => (
  Math.max(1, item.paymentAttemptNumber ?? 1)
);

export const paymentBatchItemAttemptLabel = (item: PaymentBatchItemSnapshot) => {
  const attemptNumber = paymentBatchItemAttemptNumber(item);
  if (attemptNumber === 1) return '首次付款';
  if (attemptNumber === 2) return '二次付款';
  return `第 ${attemptNumber} 次付款`;
};

export const createPaymentExecutionBatchRecord = ({
  payouts,
  requests,
  generatedInvoices,
  paymentLists,
  contracts,
  existingBatches,
  paymentBatchId,
  paymentBatchCode,
  payer,
  submittedAt,
}: CreatePaymentExecutionBatchRecordInput): PaymentBatchRecord => {
  if (!payouts.length) throw new Error('当前请款项目没有待打款明细');
  if (payouts.some((payout) => payout.status !== '等待付款')) {
    throw new Error('请款项目的全部付款明细必须处于等待付款状态');
  }
  const providers = new Set(payouts.map((payout) => payout.provider));
  if (providers.size !== 1) {
    throw new Error('一个请款项目只能使用一个付款渠道');
  }

  const provider = payouts[0].provider;
  const record = createPaymentBatchRecord({
    payouts,
    requests,
    generatedInvoices,
    paymentLists,
    contracts,
    paymentBatchId,
    paymentBatchCode,
    provider,
    fundingAccountId: PAYMENT_EXECUTION_FUNDING_ACCOUNTS[provider],
    sourceCurrency: payouts[0].currency,
    payer,
    paidAt: submittedAt,
    status: '付款处理中',
    lifecycle: ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED'],
    itemStatus: '付款处理中',
  });
  const selectedPayoutIds = new Set(payouts.map((payout) => payout.id));
  if (existingBatches.some((batch) => batch.items.some((item) => (
    selectedPayoutIds.has(item.payoutId) && item.paymentStatus === '付款处理中'
  )))) {
    throw new Error(`请款项目 ${record.request.requestCode} 存在仍在处理中的付款批次`);
  }
  return record;
};

export const createPaymentProjectPaymentRecord = ({
  request,
  payouts,
  generatedInvoices,
  paymentLists,
  contracts,
}: Omit<PaymentBatchSourceData, 'requests'> & Readonly<{
  request: RequestProjectSummary;
}>): PaymentProjectPaymentRecord => {
  const invoiceIds = requestInvoiceIds(request);
  const sourcePayoutIds = new Set(generatedInvoices
    .filter((invoice) => invoiceIds.has(invoice.invoiceId))
    .map((invoice) => invoice.sourcePayoutId));
  const linkedPayouts = payouts.filter((payout) => (
    (Boolean(request.paymentRequestProjectId)
      && payout.paymentRequestProjectId === request.paymentRequestProjectId)
    || sourcePayoutIds.has(payout.id)
  ));
  if (!linkedPayouts.length) {
    throw new Error('当前请款项目没有可展示的付款明细');
  }

  const requestLists = paymentLists.filter((list) => (
    list.paymentRequestProjectId === request.paymentRequestProjectId
  ));
  const lastActivityAt = [
    ...linkedPayouts.flatMap((payout) => [
      payout.paymentFailureReturn?.occurredAt,
      payout.paymentFailure?.occurredAt,
      payout.paidAt,
    ]),
    ...requestLists.map((list) => list.updatedAt),
    request.approval?.updatedAt,
  ]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0];
  const items = linkedPayouts.map((payout) => snapshotItem({
    payout,
    request,
    generatedInvoices,
    paymentLists,
    contracts,
    batchPaidAt: lastActivityAt ?? '',
  }));
  const statuses = new Set(items.map((item) => item.paymentStatus));
  const status: PaymentProjectPaymentStatus = statuses.has('付款失败')
    ? '部分失败'
    : statuses.has('已退回')
      ? '已退回'
      : statuses.has('付款处理中')
        ? '付款处理中'
        : '已付款';
  return {
    request: snapshotRequest(request),
    paymentOrderCodes: [...new Set([
      ...requestLists.map((list) => list.paymentListCode),
      ...items.map((item) => item.paymentListCode).filter((code) => code !== '关联资料缺失'),
    ])],
    providers: [...new Set(linkedPayouts.map((payout) => payout.provider))],
    status,
    lastActivityAt,
    items,
  };
};

export type PaymentBatchMoneyTotal = Readonly<{
  currency: InvoiceCurrency;
  amount: number;
}>;

export type PaymentBatchFinancialSummary = Readonly<{
  items: readonly PaymentBatchItemSnapshot[];
  paymentAmounts: readonly PaymentBatchMoneyTotal[];
  transferFeeAmounts: readonly PaymentBatchMoneyTotal[];
  actualPaidAmounts: readonly PaymentBatchMoneyTotal[];
}>;

const paymentAttemptForBatchItem = (
  batch: PaymentBatchRecord,
  item: PaymentBatchItemSnapshot,
): PaymentAttemptSnapshot | undefined => item.paymentAttempts?.find((attempt) => (
  attempt.paymentBatchId === batch.paymentBatchId
  || (
    !attempt.paymentBatchId
    && attempt.attemptNumber === batch.paymentAttemptNumber
  )
));

export const paymentBatchItemForAttempt = (
  batch: PaymentBatchRecord,
  item: PaymentBatchItemSnapshot,
): PaymentBatchItemSnapshot => {
  const attempt = paymentAttemptForBatchItem(batch, item);
  if (!attempt) return item;
  return {
    ...item,
    paymentCode: attempt.paymentCode ?? item.paymentCode,
    paymentOrderCode: batch.paymentOrderCode,
    sourcePaymentOrderCode: batch.sourcePaymentOrderCode ?? item.sourcePaymentOrderCode,
    paymentAttemptNumber: batch.paymentAttemptNumber,
    paymentStatus: attempt.status,
    paidAt: attempt.occurredAt,
    transferFeeAmount: attempt.transferFeeAmount,
    transferFeeCurrency: attempt.transferFeeCurrency,
    actualPaidAmount: attempt.actualPaidAmount,
    actualPaidCurrency: attempt.actualPaidCurrency,
    failure: attempt.status === '付款失败' && (attempt.errorCode || attempt.providerResponse)
      ? {
          code: attempt.errorCode || '未记录',
          response: attempt.providerResponse || '未记录',
          occurredAt: attempt.occurredAt || '未记录',
        }
      : undefined,
  };
};

const paymentBatchMoneyTotals = (
  items: readonly PaymentBatchItemSnapshot[],
  amountFor: (item: PaymentBatchItemSnapshot) => number | undefined,
  currencyFor: (item: PaymentBatchItemSnapshot) => InvoiceCurrency | undefined,
): readonly PaymentBatchMoneyTotal[] => {
  const totals = items.reduce<Map<InvoiceCurrency, number>>((result, item) => {
    const amount = amountFor(item);
    const currency = currencyFor(item);
    if (amount === undefined || !currency) return result;
    result.set(currency, (result.get(currency) ?? 0) + amount);
    return result;
  }, new Map());
  return [...totals.entries()].map(([currency, amount]) => ({
    currency,
    amount: Math.round((amount + Number.EPSILON) * 100) / 100,
  }));
};

export const paymentBatchMoneyTotalsLabel = (
  totals: readonly PaymentBatchMoneyTotal[],
  fallback = '—',
) => totals.length
  ? totals.map(({ currency, amount }) => `${currency} ${amount.toLocaleString('en-US')}`).join(' + ')
  : fallback;

export const paymentBatchFinancialSummary = (
  batch: PaymentBatchRecord,
): PaymentBatchFinancialSummary => {
  const items = batch.items.map((item) => paymentBatchItemForAttempt(batch, item));
  return {
    items,
    paymentAmounts: paymentBatchMoneyTotals(items, (item) => item.amount, (item) => item.currency),
    transferFeeAmounts: paymentBatchMoneyTotals(
      items,
      (item) => item.transferFeeAmount,
      (item) => item.transferFeeCurrency,
    ),
    actualPaidAmounts: paymentBatchMoneyTotals(
      items,
      (item) => item.actualPaidAmount,
      (item) => item.actualPaidCurrency,
    ),
  };
};

export const paymentBatchAmountLabel = (batch: Pick<PaymentBatchRecord, 'items'>) => (
  paymentBatchMoneyTotalsLabel(
    paymentBatchMoneyTotals(batch.items, (item) => item.amount, (item) => item.currency),
    '',
  )
);

export const paymentBatchStatusCounts = (batch: Pick<PaymentBatchRecord, 'items'>) => batch.items.reduce(
  (counts, item) => {
    if (item.paymentStatus === '已付款') counts.succeeded += 1;
    else if (item.paymentStatus === '付款失败' || item.paymentStatus === '已退回') counts.failed += 1;
    else counts.processing += 1;
    return counts;
  },
  { succeeded: 0, failed: 0, processing: 0 },
);

export type PaymentBatchAttemptUpdateResult = Readonly<{
  batches: readonly PaymentBatchRecord[];
  updatedBatchId?: PaymentBatchId;
  issue?: 'INVALID_RESULT' | 'BATCH_NOT_FOUND' | 'AMBIGUOUS_BATCH' | 'ATTEMPT_FINALIZED';
}>;

const batchLifecycleForStatus = (
  lifecycle: readonly string[],
  status: PaymentBatchStatus,
) => {
  const activeLifecycle = lifecycle.filter((stage) => (
    !['COMPLETED', 'PARTIALLY_FAILED', 'FAILED'].includes(stage)
  ));
  const resultStage = status === '已付款'
    ? 'COMPLETED'
    : status === '部分失败'
      ? 'PARTIALLY_FAILED'
      : status === '全部失败'
        ? 'FAILED'
        : undefined;
  return resultStage ? [...activeLifecycle, resultStage] : activeLifecycle;
};

export const applyPaymentResultToCurrentBatch = ({
  batches,
  payout,
}: {
  batches: readonly PaymentBatchRecord[];
  payout: Payout;
}): PaymentBatchAttemptUpdateResult => {
  if (payout.status !== '已付款' && payout.status !== '付款失败') {
    return { batches, issue: 'INVALID_RESULT' };
  }

  const explicitBatchId = payout.currentPaymentAttempt?.paymentBatchId
    ?? (payout.paymentFailureRecovery?.status === 'RETRY_SUBMITTED'
      ? payout.paymentFailureRecovery.retryBatchId as PaymentBatchId | undefined
      : undefined);
  const matchingBatches = explicitBatchId
    ? batches.filter((batch) => (
        batch.paymentBatchId === explicitBatchId
        && batch.items.some((item) => item.payoutId === payout.id)
      ))
    : batches.filter((batch) => batch.items.some((item) => (
        item.payoutId === payout.id && item.paymentStatus === '付款处理中'
      )));

  if (!matchingBatches.length) return { batches, issue: 'BATCH_NOT_FOUND' };
  if (matchingBatches.length > 1) return { batches, issue: 'AMBIGUOUS_BATCH' };

  const target = matchingBatches[0];
  const targetItem = target.items.find((item) => item.payoutId === payout.id);
  if (!targetItem || targetItem.paymentStatus !== '付款处理中') {
    return { batches, issue: 'ATTEMPT_FINALIZED' };
  }

  const items = target.items.map((item): PaymentBatchItemSnapshot => {
    if (item.payoutId !== payout.id) return item;
    const currentAttempt = payout.paymentAttempts?.find((attempt) => (
      attempt.paymentBatchId === target.paymentBatchId
      || (
        !attempt.paymentBatchId
        && attempt.attemptNumber === target.paymentAttemptNumber
      )
    ));
    const normalizedAttempts = payout.paymentAttempts
      ?.filter((attempt) => attempt.attemptNumber <= target.paymentAttemptNumber)
      .map((attempt) => normalizePaymentAttemptRecipient(
        attempt,
        item.receiveCurrency,
        item.feeBearer,
      ));
    if (payout.status === '已付款') {
      const recipientResult = recipientResultSnapshot({
        status: payout.status,
        amount: item.amount,
        currency: item.currency,
        receiveCurrency: item.receiveCurrency,
        feeBearer: item.feeBearer,
        transferFeeAmount: payout.transferFeeAmount,
        transferFeeCurrency: payout.transferFeeCurrency,
        recipientReceivedAmount: payout.recipientReceivedAmount,
        recipientReceivedCurrency: payout.recipientReceivedCurrency,
      });
      return {
        ...item,
        paymentStatus: '已付款',
        paidAt: payout.paidAt,
        transferFeeAmount: payout.transferFeeAmount,
        transferFeeCurrency: payout.transferFeeCurrency,
        actualPaidAmount: payout.actualPaidAmount,
        actualPaidCurrency: payout.actualPaidCurrency,
        recipientReceivedAmount: recipientResult.recipientReceivedAmount,
        recipientReceivedCurrency: recipientResult.recipientReceivedCurrency,
        paymentAttempts: normalizedAttempts,
        failure: undefined,
      };
    }
    return {
      ...item,
      paymentStatus: '付款失败',
      paidAt: currentAttempt?.occurredAt ?? payout.paymentFailure?.occurredAt,
      transferFeeAmount: currentAttempt?.transferFeeAmount,
      transferFeeCurrency: currentAttempt?.transferFeeCurrency,
      actualPaidAmount: currentAttempt?.actualPaidAmount,
      actualPaidCurrency: currentAttempt?.actualPaidCurrency,
      recipientReceivedAmount: 0,
      recipientReceivedCurrency: item.receiveCurrency,
      paymentAttempts: normalizedAttempts,
      failure: payout.paymentFailure ? {
        code: payout.paymentFailure.errorCode,
        response: payout.paymentFailure.providerResponse,
        occurredAt: payout.paymentFailure.occurredAt,
      } : undefined,
    };
  });
  const status = aggregatePaymentStatus(items.map((item) => item.paymentStatus), target.status);
  const updatedBatch: PaymentBatchRecord = {
    ...target,
    status,
    lifecycle: batchLifecycleForStatus(target.lifecycle, status),
    items,
  };

  return {
    batches: batches.map((batch) => (
      batch.paymentBatchId === target.paymentBatchId ? updatedBatch : batch
    )),
    updatedBatchId: target.paymentBatchId,
  };
};

export const createInitialPaymentBatches = ({
  payouts,
  requests,
  generatedInvoices,
  paymentLists,
  contracts,
}: PaymentBatchSourceData): PaymentBatchRecord[] => {
  const batchItemLimit = 5;
  const scenarioResources = applyPaymentBatchPrototypeScenario({
    payouts,
    requests,
    generatedInvoices,
    paymentLists,
    perspective: 'historical-batch',
  });
  const currentResources = applyPaymentBatchPrototypeScenario({
    payouts,
    requests,
    generatedInvoices,
    paymentLists,
  });
  const financePayers = SYSTEM_USERS
    .filter((user) => user.roleKey === 'finance' && !user.isDemo)
    .map((user) => user.name);
  const eligibleRequests = scenarioResources.requests
    .filter((request) => Boolean(paymentBatchPrototypeStatusFor(request)))
    .sort((left, right) => (
      Number((right.requestCode ?? right.id) === PAYMENT_BATCH_PARTIAL_FAILURE_DEMO.requestCode)
      - Number((left.requestCode ?? left.id) === PAYMENT_BATCH_PARTIAL_FAILURE_DEMO.requestCode)
    ));
  const eligibleGroups = eligibleRequests
    .flatMap((request) => {
      const invoiceIds = requestInvoiceIds(request);
      const sourcePayoutIds = new Set(generatedInvoices
        .filter((invoice) => invoiceIds.has(invoice.invoiceId))
        .map((invoice) => invoice.sourcePayoutId));
      const groupedPayouts = scenarioResources.payouts.reduce<Map<PaymentBatchRecord['provider'], Payout[]>>(
        (groups, payout) => {
          if (!sourcePayoutIds.has(payout.id)) return groups;
          groups.set(payout.provider, [...(groups.get(payout.provider) ?? []), payout]);
          return groups;
        },
        new Map(),
      );
      return [...groupedPayouts.entries()].flatMap(([provider, grouped]) => {
        const chunks: Array<{
          provider: PaymentBatchRecord['provider'];
          payouts: Payout[];
          status: PaymentBatchStatus;
        }> = [];
        const status = paymentBatchPrototypeStatusFor(request)!;
        for (let index = 0; index < grouped.length; index += batchItemLimit) {
          chunks.push({ provider, payouts: grouped.slice(index, index + batchItemLimit), status });
        }
        return chunks;
      });
    });

  const usedInitialPaymentOrderCodes = new Set<string>();
  const reservedPaymentOrderCodes = new Set([
    ...scenarioResources.paymentLists.map((list) => list.paymentListCode),
    ...Object.values(HISTORICAL_PAYMENT_BATCH_SEEDS).map((seed) => seed.paymentListCode),
    PAYMENT_BATCH_RETRY_DEMO.retryPaymentOrderCode,
  ]);
  const initialAttempts = eligibleGroups.map(({ provider, payouts: groupedPayouts, status }, index) => {
    const ordinal = eligibleGroups.length - index;
    const ordinalLabel = String(ordinal).padStart(3, '0');
    const totalMinutes = (16 * 60) - (index * 10);
    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    const paidAt = `2026-08-05T${hours}:${minutes}`;
    const recordInput = {
      requests: scenarioResources.requests,
      generatedInvoices,
      paymentLists: scenarioResources.paymentLists,
      contracts,
      payouts: groupedPayouts.map((payout) => ({ ...payout, paidAt })),
      paymentBatchId: `payment_batch_fixture_paid_${ordinalLabel}` as PaymentBatchId,
      paymentBatchCode: `BAT-20260805-${ordinalLabel}`,
      provider,
      fundingAccountId: PAYMENT_EXECUTION_FUNDING_ACCOUNTS[provider],
      sourceCurrency: groupedPayouts[0].currency,
      payer: financePayers[index % financePayers.length],
      paidAt,
      status,
      lifecycle: status === '已付款'
        ? ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED', 'COMPLETED']
        : status === '部分失败'
          ? ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED', 'PARTIALLY_FAILED']
          : ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED'],
    } satisfies CreatePaymentBatchRecordInput;
    const sourceRecord = createPaymentBatchRecord(recordInput);
    const paymentOrderCode = usedInitialPaymentOrderCodes.has(sourceRecord.paymentOrderCode)
      ? nextPaymentBusinessCode(
          'PAY',
          reservedPaymentOrderCodes,
          new Date(`${paidAt}:00+08:00`),
        )
      : sourceRecord.paymentOrderCode;
    usedInitialPaymentOrderCodes.add(paymentOrderCode);
    reservedPaymentOrderCodes.add(paymentOrderCode);
    return paymentOrderCode === sourceRecord.paymentOrderCode
      ? sourceRecord
      : createPaymentBatchRecord({
          ...recordInput,
          paymentOrderCode,
          paymentAttemptNumber: 1,
        });
  });

  const originalFailedBatch = initialAttempts.find((batch) => (
    batch.paymentBatchCode === PAYMENT_BATCH_RETRY_DEMO.originalBatchCode
    && batch.request.requestCode === PAYMENT_BATCH_RETRY_DEMO.requestCode
  ));
  const failedItem = originalFailedBatch?.items.find((item) => item.paymentStatus === '付款失败');
  const retryPayout = failedItem
    ? currentResources.payouts.find((payout) => payout.id === failedItem.payoutId)
    : undefined;
  const scenarioBatches = retryPayout ? [
    createPaymentBatchRecord({
      requests: currentResources.requests,
      generatedInvoices,
      paymentLists: currentResources.paymentLists,
      contracts,
      payouts: [retryPayout],
      paymentBatchId: PAYMENT_BATCH_RETRY_DEMO.retryBatchId as PaymentBatchId,
      paymentBatchCode: PAYMENT_BATCH_RETRY_DEMO.retryBatchCode,
      provider: retryPayout.provider,
      fundingAccountId: PAYMENT_EXECUTION_FUNDING_ACCOUNTS[retryPayout.provider],
      sourceCurrency: retryPayout.currency,
      payer: PAYMENT_BATCH_RETRY_DEMO.payer,
      paidAt: PAYMENT_BATCH_RETRY_DEMO.submittedAt,
      status: '已付款',
      lifecycle: ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED', 'COMPLETED'],
      itemStatus: '已付款',
      paymentOrderCode: PAYMENT_BATCH_RETRY_DEMO.retryPaymentOrderCode,
      paymentAttemptNumber: 2,
    }),
    ...initialAttempts,
  ] : initialAttempts;
  const historicalBatches = createHistoricalPaymentBatchRecords(payouts, scenarioBatches);

  return [...scenarioBatches, ...historicalBatches];
};
