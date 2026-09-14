import type { ContractRecord } from './contracts';
import { contractLinkedToProject, isPaymentContract } from './contracts';
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
import type { Payout } from './types';
import {
  invoicePaymentListItem,
  paymentListEffectiveAccount,
  paymentListItemProvider,
  paymentListItemValue,
  revalidatePaymentListItem,
} from './businessWorkflow';
import type { GeneratedInvoiceRecord, InvoiceReviewStatus } from './types';
import { requestApprovalReturnEditScope } from './requestApprovalWorkflow';

export type PaymentRequestCreatorLink = {
  creatorId: CreatorId;
  socialAccountId?: string;
  creatorHandle?: string;
  creatorPlatform?: string;
  engagementId: EngagementId;
  contractIds: ContractId[];
  invoiceIds: InvoiceId[];
};

export type PaymentRequestPaymentChannel = 'Airwallex' | 'PayPal' | 'Payermax';

export const PAYMENT_REQUEST_PAYMENT_ENTITIES = [
  'Comets International Limited',
  'novacomets',
] as const;

export type PaymentRequestPaymentEntity = typeof PAYMENT_REQUEST_PAYMENT_ENTITIES[number];

export const PAYMENT_REQUEST_COST_ATTRIBUTIONS = [
  '日本分公司',
  '香港公司（comets）',
  'novacomets',
] as const;

export type PaymentRequestCostAttribution = typeof PAYMENT_REQUEST_COST_ATTRIBUTIONS[number];

export const PAYMENT_REQUEST_COST_TYPES = [
  '网红采买成本',
  '采购成本',
  '外包成本',
  '投流',
] as const;

export type PaymentRequestCostType = typeof PAYMENT_REQUEST_COST_TYPES[number];

export const PAYMENT_REQUEST_PROCUREMENT_COST_DETAILS = [
  '实物采购',
  '礼品卡',
  '会员订阅',
  '版主工资',
] as const;

export type PaymentRequestProcurementCostDetail = typeof PAYMENT_REQUEST_PROCUREMENT_COST_DETAILS[number];

export const DEFAULT_PAYMENT_REQUEST_COST_TYPE: PaymentRequestCostType = '网红采买成本';

export const normalizePaymentRequestCostType = (value?: string): PaymentRequestCostType => {
  const normalized = value?.trim() ?? '';
  if (normalized.includes('投流')) return '投流';
  if (normalized.includes('外包')) return '外包成本';
  if (normalized.includes('采购') && !normalized.includes('网红')) return '采购成本';
  return DEFAULT_PAYMENT_REQUEST_COST_TYPE;
};

export const normalizePaymentRequestProcurementCostDetail = (
  value?: string,
): PaymentRequestProcurementCostDetail | '' => (
  PAYMENT_REQUEST_PROCUREMENT_COST_DETAILS.find((detail) => detail === value?.trim()) ?? ''
);

export const paymentRequestCostTypeLabel = (
  costType?: PaymentRequestExtraDetails['costType'],
  costTypeDetail?: PaymentRequestExtraDetails['costTypeDetail'],
) => {
  if (!costType?.trim()) return '待补充';
  if (costType !== '采购成本') return costType;
  return costTypeDetail?.trim() ? `${costType} / ${costTypeDetail}` : costType;
};

export type PaymentRequestFeeBearer = '付款方' | '收款方' | '各自承担';

export const paymentRequestFeeBearerToPaymentList = (
  feeBearer?: PaymentRequestFeeBearer,
): 'ADVERTISER' | 'PUBLISHER' | 'SHARED' | '' => {
  if (feeBearer === '付款方') return 'ADVERTISER';
  if (feeBearer === '收款方') return 'PUBLISHER';
  if (feeBearer === '各自承担') return 'SHARED';
  return '';
};

export type PaymentRequestRemarkAttachment = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  dataUrl?: string;
};

export const mergePaymentRequestRemarkAttachments = (
  current: PaymentRequestRemarkAttachment[],
  files: ArrayLike<PaymentRequestRemarkAttachment>,
) => [...current, ...Array.from(files, (file) => ({
  name: file.name,
  size: file.size,
  type: file.type,
  lastModified: file.lastModified,
  ...(file.dataUrl ? { dataUrl: file.dataUrl } : {}),
}))].filter((attachment, index, all) => (
  all.findIndex((candidate) => candidate.name === attachment.name
    && candidate.size === attachment.size
    && candidate.lastModified === attachment.lastModified) === index
));

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
  paymentEntity?: PaymentRequestPaymentEntity;
  projectCostAttribution?: PaymentRequestCostAttribution;
  expectedPaymentDate?: string;
};

export type PaymentRequestExtraDetails = {
  costType?: PaymentRequestCostType | string;
  costTypeDetail?: PaymentRequestProcurementCostDetail | string;
  feeBearer?: PaymentRequestFeeBearer;
  remark?: string;
  remarkAttachments?: PaymentRequestRemarkAttachment[];
};

export type PaymentRequestPaymentPlanForm = {
  paymentChannel: PaymentRequestPaymentChannel | '';
  paymentEntity: PaymentRequestPaymentEntity | '';
  projectCostAttribution: PaymentRequestCostAttribution | '';
  expectedPaymentDate: string;
};

export const paymentRequestPaymentPlanFor = (
  request?: PaymentRequestPaymentPlan,
): PaymentRequestPaymentPlanForm => ({
  paymentChannel: request?.paymentChannel ?? '',
  paymentEntity: request?.paymentEntity ?? '',
  projectCostAttribution: request?.projectCostAttribution ?? '',
  expectedPaymentDate: request?.expectedPaymentDate ?? '',
});

export const paymentRequestPaymentPlanIssues = ({
  paymentChannel,
  paymentEntity,
  projectCostAttribution,
  expectedPaymentDate,
}: PaymentRequestPaymentPlanForm) => [
  !paymentChannel ? '请选择付款渠道' : '',
  !paymentEntity ? '请选择付款主体' : '',
  !projectCostAttribution ? '请选择项目费用归属' : '',
  !expectedPaymentDate.trim() ? '请选择预计付款时间' : '',
].filter((issue) => Boolean(issue));

export const paymentRequestExtraDetailIssues = ({
  costType,
  costTypeDetail,
}: Pick<PaymentRequestExtraDetails, 'costType' | 'costTypeDetail'>) => [
  !costType?.trim() ? '请选择成本类型' : '',
  costType === '采购成本' && !costTypeDetail?.trim() ? '请选择采购成本明细' : '',
].filter((issue) => Boolean(issue));

export const paymentRequestDraftCreatorsReady = (
  selectedCreatorCount: number,
  validCreatorLinkCount: number,
) => selectedCreatorCount === validCreatorLinkCount;

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
  socialAccountId: link.socialAccountId,
  creatorHandle: link.creatorHandle,
  creatorPlatform: link.creatorPlatform,
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
  lifecycle?: PaymentRequestLifecycle;
  approval?: RequestApprovalState;
  creatorLinks?: PaymentRequestCreatorLink[];
  invoiceIds?: InvoiceId[];
  status?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
};

export type PaymentRequestLifecycle = 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED' | 'COMPLETED' | 'CANCELLED';

export type PaymentRequestCancellationContext = {
  roleKey: string;
  lifecycle?: PaymentRequestLifecycle;
  ownsRequest: boolean;
  hasPaymentActivity: boolean;
};

export const paymentRequestHasPaymentActivity = (
  paymentRequestProjectId: PaymentRequestProjectId | undefined,
  payouts: Array<Pick<Payout, 'paymentRequestProjectId' | 'paymentFailureRecovery' | 'status'>>,
) => Boolean(paymentRequestProjectId) && payouts.some((payout) => (
  payout.paymentRequestProjectId === paymentRequestProjectId
  && (Boolean(payout.paymentFailureRecovery) || ['等待付款', '付款处理中', '付款失败', '已付款'].includes(payout.status))
));

export const canCancelPaymentRequest = ({
  roleKey,
  lifecycle,
  ownsRequest,
  hasPaymentActivity,
}: PaymentRequestCancellationContext) => (
  ['media', 'admin'].includes(roleKey)
  && ['DRAFT', 'RETURNED'].includes(lifecycle ?? '')
  && (roleKey === 'admin' || ownsRequest)
  && !hasPaymentActivity
);

export const paymentRequestCancellationIssue = (
  context: PaymentRequestCancellationContext,
  reason: string,
) => {
  if (context.hasPaymentActivity) return '项目已进入付款或失败恢复流程，不能取消。';
  if (!canCancelPaymentRequest(context)) {
    return '仅项目媒介或管理员可取消草稿、已退回的请款项目。审批中的项目需先退回。';
  }
  if (!reason.trim()) return '请填写取消原因。';
  return '';
};

export type MyProjectStatus =
  | '草稿'
  | 'PM审批中'
  | '媒介负责人审批中'
  | '老板审批中'
  | '财务审批中'
  | '待打款'
  | '部分打款失败'
  | '已付款'
  | '已退回'
  | '已取消';

export type RequestProjectStatus =
  | 'PM审批中'
  | '媒介负责人审批中'
  | '老板审批中'
  | '财务审批中'
  | '正在付款'
  | '付款处理中'
  | '部分失败'
  | '全部失败'
  | '已付款'
  | '已退回';

const MY_PROJECT_APPROVAL_STATUS: Record<RequestApprovalState['status'], MyProjectStatus> = {
  PENDING_PM: 'PM审批中',
  PENDING_PROJECT_OWNER: '媒介负责人审批中',
  PENDING_OWNER: '老板审批中',
  PENDING_FINANCE: '财务审批中',
  APPROVED: '待打款',
  RETURNED_TO_MEDIA_REVIEW: '已退回',
};

const REQUEST_PROJECT_APPROVAL_STATUS: Record<RequestApprovalState['status'], RequestProjectStatus> = {
  PENDING_PM: 'PM审批中',
  PENDING_PROJECT_OWNER: '媒介负责人审批中',
  PENDING_OWNER: '老板审批中',
  PENDING_FINANCE: '财务审批中',
  APPROVED: '正在付款',
  RETURNED_TO_MEDIA_REVIEW: '已退回',
};

const legacyMyProjectStatus = (status?: string): MyProjectStatus => {
  if (status === '已取消') return '已取消';
  if (status === '已完成' || status === '已付款') return '已付款';
  if (status === '待打款' || status === '已通过') return '待打款';
  if (status === '已退回' || status === '待补资料' || status === '待媒介复核') return '已退回';
  if (status?.includes('财务')) return '财务审批中';
  if (status?.includes('老板')) return '老板审批中';
  if (status?.includes('媒介负责人') || status?.includes('项目负责人')) return '媒介负责人审批中';
  if (status?.includes('PM') || status === '待审批') return 'PM审批中';
  return '草稿';
};

export const myProjectStatusFor = (
  request: Pick<PaymentRequestProjectLike, 'approval' | 'lifecycle' | 'status'>,
): MyProjectStatus => {
  if (request.lifecycle === 'CANCELLED') return '已取消';
  if (request.lifecycle === 'COMPLETED') return '已付款';
  if (request.lifecycle === 'RETURNED' && request.status === '部分打款失败') return '部分打款失败';
  if (request.lifecycle === 'RETURNED') return '已退回';
  if (request.lifecycle === 'APPROVED') return '待打款';
  if (request.approval) return MY_PROJECT_APPROVAL_STATUS[request.approval.status];
  if (request.lifecycle === 'DRAFT') return '草稿';
  return legacyMyProjectStatus(request.status);
};

export const requestProjectStatusFor = (
  request: Pick<PaymentRequestProjectLike, 'approval' | 'lifecycle' | 'status' | 'paymentRequestProjectId'>,
  payouts: readonly Pick<Payout, 'paymentRequestProjectId' | 'status'>[] = [],
): RequestProjectStatus | null => {
  if (request.lifecycle === 'DRAFT' || request.lifecycle === 'CANCELLED' || (!request.approval && !request.lifecycle)) return null;
  if (request.lifecycle === 'COMPLETED') return '已付款';
  const linkedPayouts = request.paymentRequestProjectId
    ? payouts.filter((payout) => payout.paymentRequestProjectId === request.paymentRequestProjectId)
    : [];
  const failedCount = linkedPayouts.filter((payout) => payout.status === '付款失败').length;
  if (request.lifecycle === 'RETURNED') {
    if (failedCount === linkedPayouts.length && failedCount > 0) return '全部失败';
    if (failedCount > 0 || request.status === '部分打款失败' || request.status === '部分失败') return '部分失败';
    if (request.status === '全部失败') return '全部失败';
    return '已退回';
  }
  if (request.lifecycle === 'APPROVED') {
    if (failedCount === linkedPayouts.length && failedCount > 0) return '全部失败';
    if (failedCount > 0) return '部分失败';
    if (linkedPayouts.length > 0 && linkedPayouts.every((payout) => payout.status === '已付款')) return '已付款';
    if (linkedPayouts.some((payout) => ['付款处理中', '已付款'].includes(payout.status))) return '付款处理中';
    return '正在付款';
  }
  if (request.approval) return REQUEST_PROJECT_APPROVAL_STATUS[request.approval.status];
  const legacyStatus = legacyMyProjectStatus(request.status);
  if (legacyStatus === '已付款') return '已付款';
  if (legacyStatus === '待打款') return '正在付款';
  if (legacyStatus === '已退回') return '已退回';
  if (legacyStatus === '媒介负责人审批中') return '媒介负责人审批中';
  if (legacyStatus === '老板审批中') return '老板审批中';
  if (legacyStatus === '财务审批中') return '财务审批中';
  return 'PM审批中';
};

export const MY_PROJECT_APPROVAL_STATUSES = new Set<MyProjectStatus>([
  'PM审批中',
  '媒介负责人审批中',
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
  startDate: string;
  endDate: string;
  statuses: string[];
};

export const createEmptyPaymentRequestListFilters = (): PaymentRequestListFilters => ({
  customers: [],
  pms: [],
  currency: 'all',
  minBudget: '',
  maxBudget: '',
  startDate: '',
  endDate: '',
  statuses: [],
});

export const paymentRequestFirstSubmittedAt = (
  request: Pick<PaymentRequestProjectLike, 'approval'>,
) => {
  const submissions = request.approval?.submissionHistory;
  if (submissions?.length) {
    return [...submissions]
      .sort((left, right) => left.round - right.round || left.submittedAt.localeCompare(right.submittedAt))[0]
      ?.submittedAt;
  }
  return request.approval?.submittedAt;
};

const paymentRequestSubmittedDateKey = (request: Pick<PaymentRequestProjectLike, 'approval'>) => {
  const submittedAt = paymentRequestFirstSubmittedAt(request);
  if (!submittedAt) return '';
  const date = new Date(submittedAt);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

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
  statusFor = myProjectStatusFor,
}: {
  requests: T[];
  search: string;
  filters: PaymentRequestListFilters;
  statusFor?: (request: T) => MyProjectStatus;
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
    const matchesPM = filters.pms.length === 0 || filters.pms.includes(request.pm || '__UNASSIGNED__');
    const matchesCurrency = filters.currency === 'all' || filters.currency === budget.currency;
    const matchesMinBudget = invalidBudgetRange || minBudget === null || budget.amount >= minBudget;
    const matchesMaxBudget = invalidBudgetRange || maxBudget === null || budget.amount <= maxBudget;
    const submittedDate = paymentRequestSubmittedDateKey(request);
    const hasDateFilter = Boolean(filters.startDate || filters.endDate);
    const matchesStartDate = !hasDateFilter || Boolean(submittedDate && (!filters.startDate || submittedDate >= filters.startDate));
    const matchesEndDate = !hasDateFilter || Boolean(submittedDate && (!filters.endDate || submittedDate <= filters.endDate));
    const matchesStatus = filters.statuses.length === 0 || filters.statuses.includes(statusFor(request));
    return matchesSearch
      && matchesCustomer
      && matchesPM
      && matchesCurrency
      && matchesMinBudget
      && matchesMaxBudget
      && matchesStartDate
      && matchesEndDate
      && matchesStatus;
  });
  return { visible, invalidBudgetRange };
};

export const canAddCreatorToPaymentRequest = (request: PaymentRequestProjectLike) => (
  request.lifecycle === 'DRAFT'
  || (
    request.lifecycle === 'RETURNED'
    && requestApprovalReturnEditScope(request.approval) === 'full'
  )
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

export type CooperationProjectWithCreatorsLike = CooperationProjectLike & {
  creatorProfiles?: Array<{
    creatorId: CreatorId;
    engagementId: EngagementId;
    status?: 'active' | 'removed';
  }>;
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
  contractLinkedToProject(contract, cooperationProjectId)
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

export const findExistingEngagementId = ({
  project,
  creatorId,
  contracts,
  invoices,
}: {
  project: CooperationProjectWithCreatorsLike;
  creatorId: CreatorId;
  contracts: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
}): EngagementId | undefined => {
  const projectId = cooperationProjectIdFor(project);
  const activeReference = project.creatorProfiles?.find((reference) => (
    reference.creatorId === creatorId && reference.status !== 'removed'
  ));
  if (activeReference) return activeReference.engagementId;

  const invoiceReference = invoicesForCooperationCreator(invoices, projectId, creatorId)
    .find((invoice) => invoice.snapshot.engagementId)?.snapshot.engagementId;
  if (invoiceReference) return invoiceReference as EngagementId;

  return contractsForCooperationCreator(contracts, projectId, creatorId)
    .find((contract) => contract.engagementId)?.engagementId;
};

export const requestOwningInvoice = (
  requests: PaymentRequestProjectLike[],
  invoiceId: InvoiceId,
  excludeRequestId?: PaymentRequestProjectId,
) => requests.find((request) => (
  request.lifecycle !== 'CANCELLED'
  &&
  (!excludeRequestId || request.paymentRequestProjectId !== excludeRequestId)
  && (
    request.creatorLinks?.some((link) => link.invoiceIds.includes(invoiceId))
    || request.invoiceIds?.includes(invoiceId)
  )
));

export const selectableContractIds = (contracts: ContractRecord[]) => contracts
  .filter(isPaymentContract)
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
  if (lifecycle === 'CANCELLED') return { label: status || '已取消', tone: 'info' };
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
  cooperationProjectId,
}: {
  link: PaymentRequestCreatorLink;
  invoices: GeneratedInvoiceRecord[];
  contracts: ContractRecord[];
  paymentLists: PaymentListRecord[];
  paymentRequestProjectId?: PaymentRequestProjectId;
  requestLifecycle?: PaymentRequestProjectLike['lifecycle'];
  requestStatus?: string;
  cooperationProjectId?: CooperationProjectId;
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
      || !effectiveAccount.validationStatus
      || !['VALIDATED', 'VERIFIED'].includes(effectiveAccount.validationStatus)
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
      invoiceReady: invoice.status === '已通过',
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
        && (!cooperationProjectId || contractLinkedToProject(record, cooperationProjectId))
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
      && contractLinkedToProject(contract, invoiceCooperationProjectId(invoice)),
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
  status: 'READY' | 'MISSING_INVOICE' | 'INVOICE_NOT_APPROVED' | 'INVOICE_IN_USE';
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
  const approvedInvoices = matchedInvoices.filter((invoice) => invoice.status === '已通过');
  if (approvedInvoices.length === 0) {
    return {
      contracts: matchedContracts,
      invoices: matchedInvoices,
      availableInvoices: [],
      invoiceOwners: [],
      status: 'INVOICE_NOT_APPROVED',
    };
  }
  const invoiceOwners = approvedInvoices.flatMap((invoice) => {
    const owner = requestOwningInvoice(requests, invoice.invoiceId, excludeRequestId);
    return owner ? [{ invoiceId: invoice.invoiceId, owner }] : [];
  });
  const occupiedIds = new Set(invoiceOwners.map((item) => item.invoiceId));
  const availableInvoices = approvedInvoices.filter((invoice) => (
    !occupiedIds.has(invoice.invoiceId)
  ));
  return {
    contracts: matchedContracts,
    invoices: matchedInvoices,
    availableInvoices,
    invoiceOwners,
    status: availableInvoices.length ? 'READY' : 'INVOICE_IN_USE',
  };
};

const SUBMITTABLE_INVOICE_STATUSES: InvoiceReviewStatus[] = ['已通过'];

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
  paymentList?: PaymentListRecord | null,
) => {
  const linkedInvoiceIds = paymentRequestInvoiceIds(links);
  const effectivePaymentItems = paymentList?.items.filter((item) => linkedInvoiceIds.includes(item.invoiceId)) ?? [];
  const totals = effectivePaymentItems.length
    ? effectivePaymentItems.reduce<Record<string, number>>((result, item) => {
        const currency = String(paymentListItemValue(item, 'currency'));
        result[currency] = (result[currency] ?? 0) + Number(paymentListItemValue(item, 'amount'));
        return result;
      }, {})
    : linkedInvoiceIds.reduce<Record<string, number>>((result, invoiceId) => {
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
  contractIds: _legacyContractIds,
}: {
  invoice: GeneratedInvoiceRecord;
  contracts: ContractRecord[];
  /** @deprecated Invoice 自身冻结的 contractIds 是唯一付款依据。 */
  contractIds?: ContractId[];
}) => {
  const source = invoicePaymentListItem(invoice, contracts);
  return revalidatePaymentListItem({
    ...source,
    snapshot: {
      ...source.snapshot,
      transactionReference: '',
    },
  });
};
