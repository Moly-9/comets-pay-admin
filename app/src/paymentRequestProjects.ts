import type { ContractRecord } from './contracts';
import { isConfirmedContract } from './contracts';
import type {
  ContractId,
  CooperationProjectId,
  CreatorId,
  EngagementId,
  InvoiceId,
  PaymentListItemProvider,
  PaymentListRecord,
  PaymentRequestProjectId,
  ProjectId,
  RequestApprovalState,
} from './businessWorkflow';
import {
  invoicePaymentListItem,
  paymentListEffectiveAccount,
  paymentListItemProvider,
  paymentListItemValue,
  revalidatePaymentListItem,
} from './businessWorkflow';
import type { GeneratedInvoiceRecord, InvoiceReviewStatus } from './types';

export type PaymentRequestCreatorLink = {
  creatorId: CreatorId;
  engagementId: EngagementId;
  contractIds: ContractId[];
  invoiceIds: InvoiceId[];
};

export type PaymentRequestPaymentChannel = 'Airwallex' | 'PayPal' | 'Payermax';

export const paymentRequestProviderForChannel = (
  channel?: PaymentRequestPaymentChannel,
): PaymentListItemProvider | null => {
  if (channel === 'Payermax') return 'PayMax';
  return channel ?? null;
};

export const paymentRequestChannelForProvider = (
  provider: PaymentListItemProvider,
): PaymentRequestPaymentChannel => (
  provider === 'PayMax' ? 'Payermax' : provider
);

export type PaymentRequestPaymentPlan = {
  paymentChannel?: PaymentRequestPaymentChannel;
  expectedPaymentDate?: string;
};

export type PaymentRequestPaymentPlanForm = {
  paymentChannel: PaymentRequestPaymentChannel | '';
  expectedPaymentDate: string;
};

export const paymentRequestPaymentPlanFor = (
  request?: PaymentRequestPaymentPlan,
): PaymentRequestPaymentPlanForm => ({
  paymentChannel: request?.paymentChannel ?? '',
  expectedPaymentDate: request?.expectedPaymentDate ?? '',
});

export const paymentRequestPaymentPlanIssues = ({
  paymentChannel,
  expectedPaymentDate,
}: PaymentRequestPaymentPlanForm) => [
  !paymentChannel ? '请选择付款渠道' : '',
  !expectedPaymentDate.trim() ? '请选择预计付款时间' : '',
].filter((issue) => Boolean(issue));

export type PaymentRequestCreatorInvoicePresentation = {
  invoiceId: InvoiceId;
  invoiceNumber: string;
  provider: string;
  invoiceAmount: number | null;
  invoiceCurrency: string;
  invoiceAmountLabel: string;
  requestAmount: number | null;
  requestCurrency: string;
  requestAmountLabel: string;
  requestAmountSource: 'INVOICE' | 'PAYMENT_LIST';
  amountAdjusted: boolean;
  missing: boolean;
  relationshipValid: boolean;
  invoiceReady: boolean;
  paymentListStatus?: PaymentListRecord['status'];
  paymentItemMissing: boolean;
  accountNeedsReview: boolean;
  requiresRevalidation: boolean;
};

export type PaymentRequestCreatorContractPresentation = {
  contractId: ContractId;
  contractNumber: string;
  missing: boolean;
  relationshipValid: boolean;
};

export type PaymentRequestCreatorPresentationStatus = {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
};

export type PaymentRequestCreatorPresentation = {
  invoices: PaymentRequestCreatorInvoicePresentation[];
  contracts: PaymentRequestCreatorContractPresentation[];
  invoiceTotalLabel: string;
  requestTotalLabel: string;
  statuses: PaymentRequestCreatorPresentationStatus[];
};

type LegacyPaymentRequestCreatorLink = Omit<PaymentRequestCreatorLink, 'invoiceIds'> & {
  invoiceId?: InvoiceId;
  invoiceIds?: InvoiceId[];
};

export const normalizePaymentRequestCreatorLink = (
  link: LegacyPaymentRequestCreatorLink,
): PaymentRequestCreatorLink => ({
  creatorId: link.creatorId,
  engagementId: link.engagementId,
  contractIds: [...new Set(link.contractIds)],
  invoiceIds: [...new Set([
    ...(link.invoiceIds ?? []),
    ...(link.invoiceId ? [link.invoiceId] : []),
  ])],
});

export const paymentRequestInvoiceIds = (
  links: PaymentRequestCreatorLink[],
) => [...new Set(links.flatMap((link) => link.invoiceIds))];

export type PaymentRequestProjectLike = {
  id: string;
  paymentRequestProjectId?: PaymentRequestProjectId;
  requestCode?: string;
  lifecycle?: 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED' | 'COMPLETED';
  approval?: RequestApprovalState;
  creatorLinks?: PaymentRequestCreatorLink[];
  invoiceIds?: InvoiceId[];
  status?: string;
};

export type MyProjectStatus =
  | '草稿'
  | 'PM审批中'
  | '项目负责人审批中'
  | '老板审批中'
  | '财务审批中'
  | '待打款'
  | '部分打款失败'
  | '已付款'
  | '已退回';

export type RequestProjectStatus =
  | '请款提交'
  | 'PM审批通过'
  | '项目负责人审批通过'
  | '老板审批通过'
  | '财务审批通过'
  | '部分打款失败'
  | '已付款'
  | '已退回';

const MY_PROJECT_APPROVAL_STATUS: Record<RequestApprovalState['status'], MyProjectStatus> = {
  PENDING_PM: 'PM审批中',
  PENDING_PROJECT_OWNER: '项目负责人审批中',
  PENDING_OWNER: '老板审批中',
  PENDING_FINANCE: '财务审批中',
  APPROVED: '待打款',
  RETURNED_TO_MEDIA_REVIEW: '已退回',
};

const REQUEST_PROJECT_APPROVAL_STATUS: Record<RequestApprovalState['status'], RequestProjectStatus> = {
  PENDING_PM: '请款提交',
  PENDING_PROJECT_OWNER: 'PM审批通过',
  PENDING_OWNER: '项目负责人审批通过',
  PENDING_FINANCE: '老板审批通过',
  APPROVED: '财务审批通过',
  RETURNED_TO_MEDIA_REVIEW: '已退回',
};

const legacyMyProjectStatus = (status?: string): MyProjectStatus => {
  if (status === '已完成' || status === '已付款') return '已付款';
  if (status === '待打款' || status === '已通过') return '待打款';
  if (status === '已退回' || status === '待补资料' || status === '待媒介复核') return '已退回';
  if (status?.includes('财务')) return '财务审批中';
  if (status?.includes('老板')) return '老板审批中';
  if (status?.includes('项目负责人')) return '项目负责人审批中';
  if (status?.includes('PM') || status === '待审批') return 'PM审批中';
  return '草稿';
};

export const myProjectStatusFor = (
  request: Pick<PaymentRequestProjectLike, 'approval' | 'lifecycle' | 'status'>,
): MyProjectStatus => {
  if (request.status === '部分打款失败') return '部分打款失败';
  if (request.lifecycle === 'COMPLETED') return '已付款';
  if (request.lifecycle === 'RETURNED') return '已退回';
  if (request.lifecycle === 'APPROVED') return '待打款';
  if (request.approval) return MY_PROJECT_APPROVAL_STATUS[request.approval.status];
  if (request.lifecycle === 'DRAFT') return '草稿';
  return legacyMyProjectStatus(request.status);
};

export const requestProjectStatusFor = (
  request: Pick<PaymentRequestProjectLike, 'approval' | 'lifecycle' | 'status'>,
): RequestProjectStatus | null => {
  if (request.status === '部分打款失败') return '部分打款失败';
  if (request.lifecycle === 'DRAFT' || (!request.approval && !request.lifecycle)) return null;
  if (request.lifecycle === 'COMPLETED') return '已付款';
  if (request.lifecycle === 'RETURNED') return '已退回';
  if (request.lifecycle === 'APPROVED') return '财务审批通过';
  if (request.approval) return REQUEST_PROJECT_APPROVAL_STATUS[request.approval.status];
  const legacyStatus = legacyMyProjectStatus(request.status);
  if (legacyStatus === '已付款') return '已付款';
  if (legacyStatus === '待打款') return '财务审批通过';
  if (legacyStatus === '已退回') return '已退回';
  return '请款提交';
};

export const MY_PROJECT_APPROVAL_STATUSES = new Set<MyProjectStatus>([
  'PM审批中',
  '项目负责人审批中',
  '老板审批中',
  '财务审批中',
]);

export type PaymentRequestListItem = PaymentRequestProjectLike & {
  cooperationProjectName?: string;
  project: string;
  brand: string;
  pm: string;
  amount: string;
  status: string;
};

export type PaymentRequestListFilters = {
  customers: string[];
  pms: string[];
  currency: string;
  minBudget: string;
  maxBudget: string;
  statuses: string[];
};

export const createEmptyPaymentRequestListFilters = (): PaymentRequestListFilters => ({
  customers: [],
  pms: [],
  currency: 'all',
  minBudget: '',
  maxBudget: '',
  statuses: [],
});

export const paymentRequestAmount = (value: string) => ({
  currency: value.match(/\b[A-Z]{3}\b/)?.[0] ?? '',
  amount: Number(value.replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0] ?? 0),
});

export const paymentRequestListMetrics = (requests: PaymentRequestListItem[]) => {
  const statuses = requests.map(myProjectStatusFor);
  const reviewing = statuses.filter((status) => MY_PROJECT_APPROVAL_STATUSES.has(status)).length;
  return {
    reviewing,
    reviewTotal: reviewing,
    waitingPayment: statuses.filter((status) => status === '待打款').length,
    total: requests.length,
  };
};

export const filterPaymentRequestList = <T extends PaymentRequestListItem>({
  requests,
  search,
  filters,
}: {
  requests: T[];
  search: string;
  filters: PaymentRequestListFilters;
}) => {
  const query = search.trim().toLowerCase();
  const minBudget = filters.minBudget ? Number(filters.minBudget) : null;
  const maxBudget = filters.maxBudget ? Number(filters.maxBudget) : null;
  const invalidBudgetRange = minBudget !== null && maxBudget !== null && minBudget > maxBudget;
  const visible = requests.filter((request) => {
    const budget = paymentRequestAmount(request.amount);
    const searchable = `${request.requestCode ?? request.id}${request.cooperationProjectName ?? request.project}${request.project}`.toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesCustomer = filters.customers.length === 0 || filters.customers.includes(request.brand);
    const matchesPM = filters.pms.length === 0 || filters.pms.includes(request.pm);
    const matchesCurrency = filters.currency === 'all' || filters.currency === budget.currency;
    const matchesMinBudget = invalidBudgetRange || minBudget === null || budget.amount >= minBudget;
    const matchesMaxBudget = invalidBudgetRange || maxBudget === null || budget.amount <= maxBudget;
    const matchesStatus = filters.statuses.length === 0 || filters.statuses.includes(myProjectStatusFor(request));
    return matchesSearch && matchesCustomer && matchesPM && matchesCurrency && matchesMinBudget && matchesMaxBudget && matchesStatus;
  });
  return { visible, invalidBudgetRange };
};

export const canAddCreatorToPaymentRequest = (request: PaymentRequestProjectLike) => (
  request.lifecycle === 'DRAFT'
);

export const isPaymentRequestFullyPaid = ({
  request,
  invoices,
  payouts,
}: {
  request: PaymentRequestProjectLike;
  invoices: Array<Pick<GeneratedInvoiceRecord, 'invoiceId' | 'sourcePayoutId'>>;
  payouts: Array<{ id: string; status: string }>;
}) => {
  const invoiceIds = request.creatorLinks?.length
    ? paymentRequestInvoiceIds(request.creatorLinks)
    : request.invoiceIds ?? [];
  if (!invoiceIds.length) return false;
  const payoutIds = invoiceIds.map((invoiceId) => (
    invoices.find((invoice) => invoice.invoiceId === invoiceId)?.sourcePayoutId
  ));
  if (payoutIds.some((payoutId) => !payoutId)) return false;
  return payoutIds.every((payoutId) => payouts.some((payout) => (
    payout.id === payoutId && payout.status === '已付款'
  )));
};

export type CooperationProjectLike = {
  id: string;
  projectId?: ProjectId;
  cooperationProjectId?: CooperationProjectId;
};

export const cooperationProjectIdFor = (project: CooperationProjectLike) => (
  (project.cooperationProjectId ?? project.projectId ?? project.id) as CooperationProjectId
);

export const contractCooperationProjectId = (contract: ContractRecord) => (
  (contract.cooperationProjectId ?? contract.projectId ?? '') as CooperationProjectId | ''
);

export const invoiceCooperationProjectId = (invoice: GeneratedInvoiceRecord) => (
  (invoice.snapshot.cooperationProjectId ?? invoice.snapshot.projectId ?? '') as CooperationProjectId | ''
);

export const contractsForCooperationCreator = (
  contracts: ContractRecord[],
  cooperationProjectId: CooperationProjectId,
  creatorId: CreatorId,
) => contracts.filter((contract) => (
  contractCooperationProjectId(contract) === cooperationProjectId
  && contract.creatorId === creatorId
));

export const invoicesForCooperationCreator = (
  invoices: GeneratedInvoiceRecord[],
  cooperationProjectId: CooperationProjectId,
  creatorId: CreatorId,
) => invoices.filter((invoice) => (
  invoiceCooperationProjectId(invoice) === cooperationProjectId
  && invoice.snapshot.creatorId === creatorId
));

export const requestOwningInvoice = (
  requests: PaymentRequestProjectLike[],
  invoiceId: InvoiceId,
  excludeRequestId?: PaymentRequestProjectId,
) => requests.find((request) => (
  (!excludeRequestId || request.paymentRequestProjectId !== excludeRequestId)
  && (
    request.creatorLinks?.some((link) => link.invoiceIds.includes(invoiceId))
    || request.invoiceIds?.includes(invoiceId)
  )
));

export const selectableContractIds = (contracts: ContractRecord[]) => contracts
  .filter(isConfirmedContract)
  .map((contract) => contract.contractId)
  .filter((contractId): contractId is ContractId => Boolean(contractId));

export const invoiceAmountLabel = (invoice: GeneratedInvoiceRecord) => {
  const amount = invoice.snapshot.items.reduce((sum, item) => sum + item.lineTotal, 0);
  return `${invoice.snapshot.currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatRequestMoney = (currency: string, amount: number | null) => {
  if (!currency || amount === null || !Number.isFinite(amount)) return '待核算';
  return `${currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

const summarizeRequestMoney = (
  rows: PaymentRequestCreatorInvoicePresentation[],
  amountKey: 'invoiceAmount' | 'requestAmount',
  currencyKey: 'invoiceCurrency' | 'requestCurrency',
) => {
  const totals = rows.reduce<Record<string, number>>((result, row) => {
    const amount = row[amountKey];
    const currency = row[currencyKey];
    if (!currency || amount === null || !Number.isFinite(amount)) return result;
    result[currency] = (result[currency] ?? 0) + amount;
    return result;
  }, {});
  return Object.entries(totals)
    .map(([currency, amount]) => formatRequestMoney(currency, amount))
    .join(' + ') || '待核算';
};

const ACCOUNT_ISSUE_PATTERN = /账户|beneficiary|beneficiary_id|收款|渠道/i;

const lockedRequestStatus = (
  lifecycle: PaymentRequestProjectLike['lifecycle'],
  status: string | undefined,
): PaymentRequestCreatorPresentationStatus | null => {
  if (!lifecycle || lifecycle === 'DRAFT' || lifecycle === 'RETURNED') return null;
  if (lifecycle === 'COMPLETED') return { label: status || '已完成', tone: 'success' };
  if (lifecycle === 'APPROVED') return { label: status || '已通过', tone: 'info' };
  return { label: status || '已提交', tone: 'info' };
};

export const paymentRequestCreatorPresentation = ({
  link,
  invoices,
  contracts,
  paymentLists,
  paymentRequestProjectId,
  requestLifecycle,
  requestStatus,
}: {
  link: PaymentRequestCreatorLink;
  invoices: GeneratedInvoiceRecord[];
  contracts: ContractRecord[];
  paymentLists: PaymentListRecord[];
  paymentRequestProjectId?: PaymentRequestProjectId;
  requestLifecycle?: PaymentRequestProjectLike['lifecycle'];
  requestStatus?: string;
}): PaymentRequestCreatorPresentation => {
  const requestLists = paymentLists.filter((list) => (
    !paymentRequestProjectId || list.paymentRequestProjectId === paymentRequestProjectId
  ));
  const invoiceRows = link.invoiceIds.map<PaymentRequestCreatorInvoicePresentation>((invoiceId) => {
    const invoice = invoices.find((candidate) => candidate.invoiceId === invoiceId);
    if (!invoice) {
      return {
        invoiceId,
        invoiceNumber: '关联记录异常',
        provider: '—',
        invoiceAmount: null,
        invoiceCurrency: '',
        invoiceAmountLabel: '—',
        requestAmount: null,
        requestCurrency: '',
        requestAmountLabel: '—',
        requestAmountSource: 'INVOICE',
        amountAdjusted: false,
        missing: true,
        relationshipValid: false,
        invoiceReady: false,
        paymentItemMissing: true,
        accountNeedsReview: false,
        requiresRevalidation: false,
      };
    }

    const invoiceAmount = invoice.snapshot.items.reduce((sum, item) => sum + item.lineTotal, 0);
    const paymentList = requestLists.find((list) => (
      list.items.some((item) => item.invoiceId === invoiceId)
    ));
    const paymentItem = paymentList?.items.find((item) => item.invoiceId === invoiceId);
    const effectiveAccount = paymentItem ? paymentListEffectiveAccount(paymentItem) : null;
    const provider = effectiveAccount?.provider
      || invoice.snapshot.payoutProvider
      || invoice.snapshot.payment.payoutProvider
      || (invoice.snapshot.paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex');
    const requestAmount = paymentItem ? paymentListItemValue(paymentItem, 'amount') : invoiceAmount;
    const requestCurrency = paymentItem
      ? paymentListItemValue(paymentItem, 'currency')
      : invoice.snapshot.currency;
    const validationIssues = paymentItem?.validationIssues ?? [];
    const accountNeedsReview = Boolean(paymentItem && (
      !effectiveAccount?.payoutAccountId
      || provider !== 'Airwallex'
      || (effectiveAccount.validationStatus
        && !['VALIDATED', 'VERIFIED'].includes(effectiveAccount.validationStatus))
      || validationIssues.some((issue) => ACCOUNT_ISSUE_PATTERN.test(issue))
    ));

    return {
      invoiceId,
      invoiceNumber: invoice.snapshot.invoiceNumber || invoice.id,
      provider,
      invoiceAmount,
      invoiceCurrency: invoice.snapshot.currency,
      invoiceAmountLabel: formatRequestMoney(invoice.snapshot.currency, invoiceAmount),
      requestAmount,
      requestCurrency,
      requestAmountLabel: formatRequestMoney(requestCurrency, requestAmount),
      requestAmountSource: paymentItem ? 'PAYMENT_LIST' : 'INVOICE',
      amountAdjusted: paymentItem?.overrides.amount !== undefined,
      missing: false,
      relationshipValid: (
        invoice.snapshot.creatorId === link.creatorId
        && invoice.snapshot.engagementId === link.engagementId
      ),
      invoiceReady: invoice.status === '待发起请款',
      paymentListStatus: paymentList?.status,
      paymentItemMissing: !paymentItem,
      accountNeedsReview,
      requiresRevalidation: Boolean(paymentItem?.requiresRevalidation || validationIssues.length),
    };
  });

  const contractRows = link.contractIds.map<PaymentRequestCreatorContractPresentation>((contractId) => {
    const record = contracts.find((contract) => contract.contractId === contractId);
    return {
      contractId,
      contractNumber: record?.id ?? '关联记录异常',
      missing: !record,
      relationshipValid: Boolean(
        record
        && (!record.creatorId || record.creatorId === link.creatorId)
        && (!record.engagementId || record.engagementId === link.engagementId)
      ),
    };
  });

  const lockedStatus = lockedRequestStatus(requestLifecycle, requestStatus);
  const statuses: PaymentRequestCreatorPresentationStatus[] = [];
  const addStatus = (status: PaymentRequestCreatorPresentationStatus) => {
    if (!statuses.some((current) => current.label === status.label)) statuses.push(status);
  };

  if (lockedStatus) {
    addStatus(lockedStatus);
  } else {
    if (!link.invoiceIds.length) addStatus({ label: '待补 Invoice', tone: 'danger' });
    if (invoiceRows.some((row) => row.missing) || contractRows.some((row) => row.missing || !row.relationshipValid)) {
      addStatus({ label: '关联记录异常', tone: 'danger' });
    }
    if (invoiceRows.some((row) => !row.missing && !row.relationshipValid)) {
      addStatus({ label: '关联记录异常', tone: 'danger' });
    }
    if (invoiceRows.some((row) => !row.missing && !row.invoiceReady)) {
      addStatus({ label: 'Invoice 状态未就绪', tone: 'warning' });
    }
    if (invoiceRows.some((row) => !row.missing && (
      row.paymentItemMissing || row.paymentListStatus !== 'generated'
    ))) {
      addStatus({ label: '付款清单待生成', tone: 'warning' });
    }
    if (invoiceRows.some((row) => row.accountNeedsReview)) {
      addStatus({ label: '付款账户待核对', tone: 'danger' });
    }
    if (invoiceRows.some((row) => row.requiresRevalidation)) {
      addStatus({ label: '需重新校验', tone: 'warning' });
    }
    if (invoiceRows.some((row) => row.amountAdjusted)) {
      addStatus({ label: '付款金额已调整', tone: 'info' });
    }
    if (!statuses.length) addStatus({ label: '可提交', tone: 'success' });
  }

  return {
    invoices: invoiceRows,
    contracts: contractRows,
    invoiceTotalLabel: summarizeRequestMoney(invoiceRows, 'invoiceAmount', 'invoiceCurrency'),
    requestTotalLabel: summarizeRequestMoney(invoiceRows, 'requestAmount', 'requestCurrency'),
    statuses,
  };
};

export const addInvoiceToPaymentRequestSelection = ({
  invoice,
  invoices,
  contracts,
  selectedInvoiceIds,
  selectedContractIds,
}: {
  invoice: GeneratedInvoiceRecord;
  invoices: GeneratedInvoiceRecord[];
  contracts: ContractRecord[];
  selectedInvoiceIds: InvoiceId[];
  selectedContractIds: ContractId[];
}) => {
  const selectableIds = new Set(selectableContractIds(contracts));
  const coveredContractIds = (invoice.snapshot.contractIds ?? []).filter((contractId) => {
    if (!selectableIds.has(contractId)) return false;
    const contract = contracts.find((candidate) => candidate.contractId === contractId);
    return Boolean(
      contract
      && contract.creatorId === invoice.snapshot.creatorId
      && contractCooperationProjectId(contract) === invoiceCooperationProjectId(invoice)
      && contract.engagementId === invoice.snapshot.engagementId,
    );
  });
  const selectedInvoices = [...new Set([...selectedInvoiceIds, invoice.invoiceId])];
  const selectedContracts = [...new Set([...selectedContractIds, ...coveredContractIds])];
  const remainingCoveredIds = new Set(selectedInvoices.flatMap((invoiceId) => (
    invoices.find((candidate) => candidate.invoiceId === invoiceId)?.snapshot.contractIds ?? []
  )));

  return {
    invoiceIds: selectedInvoices,
    contractIds: selectedContracts,
    autoLinkedContractIds: coveredContractIds.filter((contractId) => (
      !selectedContractIds.includes(contractId) && remainingCoveredIds.has(contractId)
    )),
  };
};

export type CreatorDocumentResolution = {
  contracts: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
  availableInvoices: GeneratedInvoiceRecord[];
  invoiceOwners: Array<{
    invoiceId: InvoiceId;
    owner: PaymentRequestProjectLike;
  }>;
  status: 'READY' | 'MISSING_INVOICE' | 'INVOICE_IN_USE';
};

export const resolveCreatorDocuments = ({
  contracts,
  invoices,
  requests,
  cooperationProjectId,
  creatorId,
  excludeRequestId,
}: {
  contracts: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
  requests: PaymentRequestProjectLike[];
  cooperationProjectId: CooperationProjectId;
  creatorId: CreatorId;
  excludeRequestId?: PaymentRequestProjectId;
}): CreatorDocumentResolution => {
  const matchedContracts = contractsForCooperationCreator(contracts, cooperationProjectId, creatorId);
  const matchedInvoices = invoicesForCooperationCreator(invoices, cooperationProjectId, creatorId);
  if (matchedInvoices.length === 0) {
    return {
      contracts: matchedContracts,
      invoices: [],
      availableInvoices: [],
      invoiceOwners: [],
      status: 'MISSING_INVOICE',
    };
  }
  const invoiceOwners = matchedInvoices.flatMap((invoice) => {
    const owner = requestOwningInvoice(requests, invoice.invoiceId, excludeRequestId);
    return owner ? [{ invoiceId: invoice.invoiceId, owner }] : [];
  });
  const occupiedIds = new Set(invoiceOwners.map((item) => item.invoiceId));
  const availableInvoices = matchedInvoices.filter((invoice) => !occupiedIds.has(invoice.invoiceId));
  return {
    contracts: matchedContracts,
    invoices: matchedInvoices,
    availableInvoices,
    invoiceOwners,
    status: availableInvoices.length ? 'READY' : 'INVOICE_IN_USE',
  };
};

const SUBMITTABLE_INVOICE_STATUSES: InvoiceReviewStatus[] = ['待发起请款'];

export const paymentRequestSubmissionIssues = ({
  creatorLinks,
  invoices,
  paymentLists,
  paymentRequestProjectId,
  paymentChannel,
}: {
  creatorLinks: PaymentRequestCreatorLink[];
  invoices: GeneratedInvoiceRecord[];
  paymentLists: PaymentListRecord[];
  paymentRequestProjectId?: PaymentRequestProjectId;
  paymentChannel?: PaymentRequestPaymentChannel;
}) => {
  const issues: string[] = [];
  if (!creatorLinks.length) issues.push('请至少关联一位合作达人');
  const expectedInvoiceIds = paymentRequestInvoiceIds(creatorLinks);
  const requestLists = paymentLists.filter((list) => (
    !paymentRequestProjectId || list.paymentRequestProjectId === paymentRequestProjectId
  ));
  if (requestLists.length > 1) {
    issues.push('一个请款项目只能关联一张付款单');
  }
  const expectedProvider = paymentRequestProviderForChannel(paymentChannel);
  if (expectedProvider) {
    const mismatchedItem = requestLists
      .flatMap((list) => list.items)
      .find((item) => paymentListItemProvider(item) !== expectedProvider);
    if (mismatchedItem) {
      issues.push(
        `${mismatchedItem.snapshot.invoiceNumber} 的收款账户渠道与请款项目付款渠道 ${paymentChannel} 不一致`,
      );
    }
  }
  creatorLinks.forEach((link) => {
    if (!link.invoiceIds.length) {
      issues.push(`达人 ${link.creatorId} 缺少关联 Invoice`);
      return;
    }
    link.invoiceIds.forEach((invoiceId) => {
      const invoice = invoices.find((candidate) => candidate.invoiceId === invoiceId);
      if (!invoice) {
        issues.push(`达人 ${link.creatorId} 的 Invoice ${invoiceId} 不存在`);
        return;
      }
      if (
        invoice.snapshot.creatorId !== link.creatorId
        || invoice.snapshot.engagementId !== link.engagementId
      ) {
        issues.push(`${invoice.id} 与当前达人或合作关系不一致`);
      }
      if (!SUBMITTABLE_INVOICE_STATUSES.includes(invoice.status)) {
        issues.push(`${invoice.id} 尚未完成签署和媒介审核`);
      }
      const paymentList = requestLists
        .find((list) => list.items.some((item) => item.invoiceId === invoiceId));
      const paymentItem = paymentList?.items.find((item) => item.invoiceId === invoiceId);
      if (!paymentItem) {
        issues.push(`${invoice.id} 尚未生成付款清单`);
      } else if (paymentList?.status !== 'generated') {
        issues.push(`${invoice.id} 的付款清单尚未生成锁定版本`);
      } else if (paymentItem.requiresRevalidation || paymentItem.validationIssues?.length) {
        issues.push(`${invoice.id} 的付款账户快照需要重新校验`);
      }
    });
  });
  const listedInvoiceIds = requestLists.flatMap((list) => list.items.map((item) => item.invoiceId));
  const listedCounts = listedInvoiceIds.reduce<Map<InvoiceId, number>>((counts, invoiceId) => (
    counts.set(invoiceId, (counts.get(invoiceId) ?? 0) + 1)
  ), new Map());
  const duplicate = [...listedCounts].find(([, count]) => count > 1)?.[0];
  const extra = listedInvoiceIds.find((invoiceId) => !expectedInvoiceIds.includes(invoiceId));
  if (duplicate) issues.push(`Invoice ${duplicate} 在付款清单中重复出现`);
  if (extra) issues.push(`付款清单包含当前请款项目未关联的 Invoice ${extra}`);
  return issues;
};

export const paymentRequestAmountLabel = (
  links: PaymentRequestCreatorLink[],
  invoices: GeneratedInvoiceRecord[],
) => {
  const totals = paymentRequestInvoiceIds(links).reduce<Record<string, number>>((result, invoiceId) => {
    const invoice = invoices.find((candidate) => candidate.invoiceId === invoiceId);
    if (!invoice) return result;
    const total = invoice.snapshot.items.reduce((sum, item) => sum + item.lineTotal, 0);
    result[invoice.snapshot.currency] = (result[invoice.snapshot.currency] ?? 0) + total;
    return result;
  }, {});
  return Object.entries(totals)
    .map(([currency, amount]) => `${currency} ${amount.toLocaleString('en-US')}`)
    .join(' + ') || '待核算';
};

export const createPaymentRequestListItem = ({
  invoice,
  contracts,
  contractIds = [],
  requestCode,
  lineNumber,
}: {
  invoice: GeneratedInvoiceRecord;
  contracts: ContractRecord[];
  contractIds?: ContractId[];
  requestCode: string;
  lineNumber: number;
}) => {
  const source = invoicePaymentListItem({
    ...invoice,
    snapshot: { ...invoice.snapshot, contractIds },
  }, contracts);
  return revalidatePaymentListItem({
    ...source,
    snapshot: {
      ...source.snapshot,
      feeBearer: source.snapshot.feeBearer || (contractIds.length ? '' : 'ADVERTISER'),
      transactionReference: `${requestCode}-${String(lineNumber).padStart(2, '0')}`,
    },
  });
};
