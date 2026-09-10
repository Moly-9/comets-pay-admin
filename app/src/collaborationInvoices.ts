import type { ContractRecord } from './contracts';
import type {
  InvoiceId,
  PaymentListItem,
  PaymentListRecord,
  RequestApprovalSubmission,
} from './businessWorkflow';
import type { ExternalInvoiceCollectionRecord } from './invoice/externalInvoiceCollection';
import {
  resolveInvoiceCreatorIdentity,
  type InvoiceCreatorIdentity,
} from './invoice/invoiceCreatorIdentity';
import type { ProjectSummary } from './pages/ProjectDetailPage';
import type { RequestProjectSummary } from './pages/RequestProjectDetailPage';
import type {
  CreatorProfile,
  GeneratedInvoiceRecord,
  InvoiceDocumentModel,
  InvoiceType,
  Payout,
} from './types';

export type CollaborationLifecycleStatus =
  | '草稿'
  | '待签署'
  | '达人反馈'
  | '待审核'
  | '待复核'
  | '已退回'
  | '请款草稿'
  | '待发起请款'
  | 'PM审批中'
  | '媒介负责人审批中'
  | '老板审批中'
  | '财务审批中'
  | '审批中'
  | '待打款'
  | '信息异常'
  | '付款处理中'
  | '付款失败'
  | '已付款';

export type CollaborationInvoiceRow = {
  rowId: string;
  invoiceId?: InvoiceId;
  invoiceType: InvoiceType;
  invoiceNumber: string;
  invoiceDate: string;
  generatedAt?: string;
  descriptions: string[];
  descriptionText: string;
  currency: string;
  amount: number;
  identity: InvoiceCreatorIdentity;
  projectLinkId?: string;
  projectName: string;
  project?: ProjectSummary;
  projectMissing: boolean;
  contractIds: string[];
  contracts: ContractRecord[];
  missingContractIds: string[];
  legacyContractReference?: string;
  request?: RequestProjectSummary;
  requestSubmittedAt?: string;
  requestSubmissions: RequestApprovalSubmission[];
  paymentList?: PaymentListRecord;
  paymentItem?: PaymentListItem;
  payout?: Payout;
  invoice?: GeneratedInvoiceRecord;
  externalInvoice?: ExternalInvoiceCollectionRecord;
  status: CollaborationLifecycleStatus;
  searchText: string;
  sortTimestamp: number;
};

export type CollaborationInvoiceBuildInput = {
  creators: readonly CreatorProfile[];
  projects: readonly ProjectSummary[];
  contracts: readonly ContractRecord[];
  payouts: readonly Payout[];
  generatedInvoices: readonly GeneratedInvoiceRecord[];
  externalInvoices: readonly ExternalInvoiceCollectionRecord[];
  requests: readonly RequestProjectSummary[];
  paymentLists: readonly PaymentListRecord[];
};

const requestInvoiceIds = (request: RequestProjectSummary) => new Set([
  ...(request.invoiceIds ?? []),
  ...(request.creatorLinks ?? []).flatMap((link) => link.invoiceIds),
]);

const findRequestFor = (
  invoiceId: InvoiceId | undefined,
  payout: Payout | undefined,
  requests: readonly RequestProjectSummary[],
) => requests.find((request) => (
  request.lifecycle !== 'CANCELLED'
  && (
    Boolean(invoiceId && requestInvoiceIds(request).has(invoiceId))
    || Boolean(
      payout?.paymentRequestProjectId
      && request.paymentRequestProjectId === payout.paymentRequestProjectId,
    )
  )
));

const requestApprovalStatus = (request: RequestProjectSummary): CollaborationLifecycleStatus => {
  if (request.lifecycle === 'DRAFT') return '请款草稿';
  if (request.lifecycle === 'RETURNED' || request.approval?.status === 'RETURNED_TO_MEDIA_REVIEW') return '已退回';
  if (request.lifecycle === 'COMPLETED') return '已付款';
  if (request.lifecycle === 'APPROVED' || request.approval?.status === 'APPROVED') return '待打款';
  if (request.approval?.status === 'PENDING_PM') return 'PM审批中';
  if (request.approval?.status === 'PENDING_PROJECT_OWNER') return '媒介负责人审批中';
  if (request.approval?.status === 'PENDING_OWNER') return '老板审批中';
  if (request.approval?.status === 'PENDING_FINANCE') return '财务审批中';
  return '审批中';
};

export const collaborationLifecycleStatus = ({
  payout,
  request,
  invoiceStatus,
}: {
  payout?: Payout;
  request?: RequestProjectSummary;
  invoiceStatus?: GeneratedInvoiceRecord['status'];
}): CollaborationLifecycleStatus => {
  if (payout?.status === '已付款' || request?.lifecycle === 'COMPLETED') return '已付款';
  if (payout?.status === '付款失败') return '付款失败';
  if (payout?.status === '付款处理中') return '付款处理中';
  if (payout?.status === '等待付款') return '待打款';
  if (payout?.status === '信息异常') return '信息异常';
  if (payout?.status === '已退回') return '已退回';
  const reviewStatus = payout?.invoiceReviewStatus ?? invoiceStatus;
  if (reviewStatus === '草稿') return '草稿';
  if (reviewStatus === '待签署') return '待签署';
  if (reviewStatus === '达人反馈') return '达人反馈';
  if (reviewStatus === '待媒介审核') return '待审核';
  if (reviewStatus === '待媒介复核') return '待复核';
  if (reviewStatus === '已退回') return '已退回';
  return request ? requestApprovalStatus(request) : '待发起请款';
};

export const collaborationStatusTone = (status: CollaborationLifecycleStatus) => {
  if (status === '已付款') return 'success';
  if (/^已退回$|失败|异常/.test(status)) return 'danger';
  if (/审批中|处理中|待审核|待复核|达人反馈/.test(status)) return 'processing';
  if (/草稿|待签署|待发起|待打款/.test(status)) return 'pending';
  return 'neutral';
};

const timeValue = (value?: string) => {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const projectFor = (projects: readonly ProjectSummary[], projectLinkId?: string) => (
  projectLinkId
    ? projects.find((project) => (
        String(project.cooperationProjectId ?? '') === projectLinkId
        || String(project.projectId ?? '') === projectLinkId
      ))
    : undefined
);

const requestSubmissionsFor = (request?: RequestProjectSummary): RequestApprovalSubmission[] => {
  const approval = request?.approval;
  if (!approval) return [];
  return approval.submissionHistory?.length
    ? [...approval.submissionHistory].sort((left, right) => left.round - right.round)
    : [{ round: approval.round, submittedAt: approval.submittedAt }];
};

const unique = (values: Array<string | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value)))];

const buildRow = ({
  creators,
  projects,
  contracts,
  externalInvoices,
  requests,
  paymentLists,
  invoice,
  payout,
  snapshot,
}: Omit<CollaborationInvoiceBuildInput, 'payouts' | 'generatedInvoices'> & {
  invoice?: GeneratedInvoiceRecord;
  payout?: Payout;
  snapshot?: InvoiceDocumentModel;
}): CollaborationInvoiceRow | null => {
  const invoiceNumber = snapshot?.invoiceNumber?.trim() || payout?.invoice?.trim() || invoice?.id.trim() || '';
  if (!invoiceNumber || invoiceNumber === '待生成') return null;
  const invoiceId = invoice?.invoiceId;
  const request = findRequestFor(invoiceId, payout, requests);
  const requestLink = invoiceId
    ? request?.creatorLinks?.find((link) => link.invoiceIds.includes(invoiceId))
    : undefined;
  const contractIds = unique([
    ...(snapshot?.contractIds ?? []).map(String),
    ...(requestLink?.contractIds ?? []).map(String),
  ]);
  const linkedContracts = contractIds.flatMap((contractId) => {
    const contract = contracts.find((candidate) => String(candidate.contractId ?? '') === contractId);
    return contract ? [contract] : [];
  });
  const linkedContractIds = new Set(linkedContracts.map((contract) => String(contract.contractId)));
  const missingContractIds = contractIds.filter((contractId) => !linkedContractIds.has(contractId));
  const projectLinkId = String(snapshot?.cooperationProjectId ?? snapshot?.projectId ?? payout?.projectId ?? '') || undefined;
  const project = projectFor(projects, projectLinkId);
  const descriptions = (snapshot?.items ?? [])
    .map((item) => item.description.trim())
    .filter(Boolean);
  if (!snapshot && payout) {
    descriptions.push(payout.deliverable?.trim() || `${payout.project} 达人合作服务费`);
  }
  const identity = resolveInvoiceCreatorIdentity({
    creators,
    allowLegacyEntityMatch: false,
    source: {
      creatorId: snapshot?.creatorId ?? payout?.creatorId,
      creatorName: snapshot?.creatorName ?? payout?.creator,
      creatorHandle: snapshot?.creatorHandle ?? payout?.handle,
      creatorSocialAccountId: snapshot?.creatorSocialAccountId ?? payout?.creatorSocialAccountId,
      creatorPlatform: snapshot?.creatorPlatform ?? payout?.creatorPlatform,
      initials: payout?.initials,
      accent: payout?.accent,
    },
  });
  const paymentList = request?.paymentRequestProjectId
    ? paymentLists.find((list) => (
        list.paymentRequestProjectId === request.paymentRequestProjectId
        && Boolean(invoiceId && list.items.some((item) => item.invoiceId === invoiceId))
      ))
    : undefined;
  const paymentItem = invoiceId
    ? paymentList?.items.find((item) => item.invoiceId === invoiceId)
    : undefined;
  const requestSubmissions = requestSubmissionsFor(request);
  const requestSubmittedAt = request?.approval?.submittedAt;
  const amount = snapshot?.items.reduce((sum, item) => sum + item.lineTotal, 0) ?? payout?.amount ?? 0;
  const status = collaborationLifecycleStatus({ payout, request, invoiceStatus: invoice?.status });
  const actualProjectName = project?.name ?? snapshot?.projectName ?? payout?.project ?? '项目待补充';
  const externalInvoice = invoiceId
    ? externalInvoices.find((record) => record.invoiceId === invoiceId)
    : undefined;
  const legacyContractReference = contractIds.length || !payout?.contract?.trim() || payout.contract === '未关联合同'
    ? undefined
    : payout.contract.trim();
  const searchText = [
    identity.displayName,
    identity.channelId,
    identity.platform,
    ...(identity.socialAccounts ?? []).flatMap((account) => [account.handle, account.platform, account.profileUrl]),
    actualProjectName,
    project?.projectCode,
    project?.cooperationProjectCode,
    ...descriptions,
    invoiceNumber,
    request?.requestCode,
    status,
    ...linkedContracts.flatMap((contract) => [contract.id, contract.name]),
    ...missingContractIds,
    legacyContractReference,
  ].filter(Boolean).join(' ').toLocaleLowerCase();
  return {
    rowId: invoiceId ? `invoice:${invoiceId}` : `payout:${payout?.id ?? invoiceNumber}`,
    invoiceId,
    invoiceType: invoice?.invoiceType ?? externalInvoice?.invoiceType ?? 'INTERNAL',
    invoiceNumber,
    invoiceDate: snapshot?.invoiceDate ?? '',
    generatedAt: invoice?.generatedAt,
    descriptions,
    descriptionText: descriptions.join('；') || '待补充',
    currency: snapshot?.currency ?? payout?.currency ?? '',
    amount,
    identity,
    projectLinkId,
    projectName: actualProjectName,
    project,
    projectMissing: !project,
    contractIds,
    contracts: linkedContracts,
    missingContractIds,
    legacyContractReference,
    request,
    requestSubmittedAt,
    requestSubmissions,
    paymentList,
    paymentItem,
    payout,
    invoice,
    externalInvoice,
    status,
    searchText,
    sortTimestamp: timeValue(requestSubmittedAt)
      || timeValue(invoice?.generatedAt)
      || timeValue(snapshot?.invoiceDate),
  };
};

export const buildCollaborationInvoiceRows = (input: CollaborationInvoiceBuildInput) => {
  const payoutById = new Map(input.payouts.map((payout) => [payout.id, payout]));
  const generatedPayoutIds = new Set(input.generatedInvoices.map((invoice) => invoice.sourcePayoutId));
  const generatedRows = input.generatedInvoices.flatMap((invoice) => {
    const row = buildRow({
      ...input,
      invoice,
      payout: payoutById.get(invoice.sourcePayoutId),
      snapshot: invoice.snapshot,
    });
    return row ? [row] : [];
  });
  const legacyRows = input.payouts.flatMap((payout) => {
    if (generatedPayoutIds.has(payout.id)) return [];
    const row = buildRow({
      ...input,
      payout,
      snapshot: payout.invoiceSnapshot,
    });
    return row ? [row] : [];
  });
  const rowsByKey = new Map<string, CollaborationInvoiceRow>();
  [...generatedRows, ...legacyRows].forEach((row) => {
    if (!rowsByKey.has(row.rowId)) rowsByKey.set(row.rowId, row);
  });
  return [...rowsByKey.values()].sort((left, right) => (
    right.sortTimestamp - left.sortTimestamp
    || left.invoiceNumber.localeCompare(right.invoiceNumber, 'zh-CN')
  ));
};
