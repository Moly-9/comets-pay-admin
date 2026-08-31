import type { InvoiceId, RequestApprovalStatus } from '../businessWorkflow';
import type { PaymentRequestProjectLike } from '../paymentRequestProjects';
import type { CreatorSocialAccount, GeneratedInvoiceRecord, InvoiceType, Payout, Provider } from '../types';
import { requestApprovalReturnItemForInvoiceEdit } from '../requestApprovalWorkflow';

export type InvoicePageTab = 'signature' | 'upload' | 'review' | 'approved' | 'returned';

export type InvoiceManagementStatus =
  | '草稿'
  | '待签署'
  | '待发布'
  | '待上传'
  | '待重新上传'
  | '待发起请款'
  | '达人反馈'
  | '待审核'
  | '待复核'
  | '已通过'
  | 'OA审批中'
  | '付款中'
  | '已付款'
  | '已退回';

export type InvoiceManagementRow = {
  rowId: string;
  invoiceId: string;
  invoiceType: InvoiceType;
  creatorName: string;
  channelId: string;
  creatorPlatform: string;
  creatorSocialAccounts?: CreatorSocialAccount[];
  issuerName: string;
  initials: string;
  accent: string;
  projectKey: string;
  projectName: string;
  invoiceNumber: string;
  provider?: Exclude<Provider, '手动打款'>;
  status: InvoiceManagementStatus;
  currency: string;
  amount: number;
  actionLabel: string;
  primaryAction?: boolean;
  source: { kind: 'payout'; payout: Payout } | { kind: 'external'; externalInvoiceId: string };
  additionalActionLabel?: string;
  returnReason?: string;
  returnSourceLabel?: string;
};

export type InvoiceManagementFilters = {
  search: string;
  projectKeys: string[];
  provider: 'all' | Exclude<Provider, '手动打款'>;
  status: 'all' | InvoiceManagementStatus;
  invoiceType: 'all' | InvoiceType;
};

export const INVOICE_MANAGEMENT_STATUSES_BY_TAB: Record<InvoicePageTab, InvoiceManagementStatus[]> = {
  signature: ['草稿', '待签署'],
  upload: ['待发布', '待上传', '待重新上传'],
  review: ['达人反馈', '待审核', '待复核'],
  approved: ['待发起请款', '已通过', 'OA审批中', '付款中', '已付款'],
  returned: ['已退回'],
};

export const filterInvoiceManagementRows = (
  rows: InvoiceManagementRow[],
  filters: InvoiceManagementFilters,
) => {
  const query = filters.search.trim().toLowerCase();
  const selectedProjects = new Set(filters.projectKeys);

  return rows.filter((row) => {
    const matchesSearch = !query || (
      `${row.creatorName} ${row.channelId} ${row.creatorPlatform} ${(row.creatorSocialAccounts ?? []).map((account) => `${account.handle} ${account.platform} ${account.profileUrl}`).join(' ')} ${row.issuerName} ${row.projectName} ${row.invoiceNumber} ${row.provider ?? ''} ${row.status}`
        .toLowerCase()
        .includes(query)
    );
    const matchesProject = selectedProjects.size === 0 || selectedProjects.has(row.projectKey);
    const matchesProvider = filters.provider === 'all' || row.provider === filters.provider;
    const matchesStatus = filters.status === 'all' || row.status === filters.status;
    const matchesInvoiceType = filters.invoiceType === 'all' || row.invoiceType === filters.invoiceType;
    return matchesSearch && matchesProject && matchesProvider && matchesStatus && matchesInvoiceType;
  });
};

export type InvoiceManagementView = {
  tab: InvoicePageTab;
  status: InvoiceManagementStatus;
  requestApprovalStatus?: RequestApprovalStatus;
};

export type InvoiceManagementEvidence = {
  signed?: boolean;
};

export type InvoiceManagementReturnContext = {
  source: 'APPROVAL_INVOICE' | 'PAYMENT_FAILURE_INVOICE';
  sourceLabel: string;
  reason: string;
  actorName?: string;
  occurredAt?: string;
};

const requestInvoiceIds = (request: PaymentRequestProjectLike) => new Set([
  ...(request.invoiceIds ?? []),
  ...(request.creatorLinks ?? []).flatMap((link) => link.invoiceIds),
]);

export const findInvoiceRequest = (
  payout: Pick<Payout, 'id'>,
  generatedInvoices: GeneratedInvoiceRecord[],
  requests: PaymentRequestProjectLike[],
) => {
  const invoice = generatedInvoices.find((candidate) => candidate.sourcePayoutId === payout.id);
  if (!invoice) return undefined;
  return requests.find((request) => (
    request.lifecycle !== 'CANCELLED' && requestInvoiceIds(request).has(invoice.invoiceId)
  ));
};

export const getInvoiceManagementView = (
  payout: Pick<Payout, 'invoiceReviewStatus' | 'status' | 'paymentFailureReturn' | 'paymentFailureRecovery'>,
  request?: PaymentRequestProjectLike,
  returnContext?: InvoiceManagementReturnContext | null,
  evidence?: InvoiceManagementEvidence,
): InvoiceManagementView => {
  if (returnContext) {
    return { tab: 'returned', status: '已退回', requestApprovalStatus: request?.approval?.status };
  }

  if (payout.invoiceReviewStatus === '草稿') {
    return { tab: 'signature', status: '草稿', requestApprovalStatus: request?.approval?.status };
  }

  if (
    payout.invoiceReviewStatus === '待签署'
    || (
      (payout.invoiceReviewStatus === '待媒介审核' || payout.invoiceReviewStatus === '待媒介复核')
      && evidence?.signed === false
    )
  ) {
    return { tab: 'signature', status: '待签署', requestApprovalStatus: request?.approval?.status };
  }
  if (payout.invoiceReviewStatus === '达人反馈') {
    return { tab: 'review', status: '达人反馈', requestApprovalStatus: request?.approval?.status };
  }
  if (payout.invoiceReviewStatus === '待媒介审核') {
    return { tab: 'review', status: '待审核', requestApprovalStatus: request?.approval?.status };
  }
  if (payout.invoiceReviewStatus === '待媒介复核') {
    return { tab: 'review', status: '待复核', requestApprovalStatus: request?.approval?.status };
  }
  if (payout.status === '已付款' || request?.lifecycle === 'COMPLETED') {
    return { tab: 'approved', status: '已付款', requestApprovalStatus: request?.approval?.status };
  }
  if (
    request?.lifecycle === 'SUBMITTED'
    || (request?.approval && !['APPROVED', 'RETURNED_TO_MEDIA_REVIEW'].includes(request.approval.status))
  ) {
    return { tab: 'approved', status: 'OA审批中', requestApprovalStatus: request?.approval?.status };
  }
  if (
    payout.status === '等待付款'
    || payout.status === '付款处理中'
    || payout.status === '付款失败'
    || payout.paymentFailureReturn?.issueType === 'PAYMENT_LIST'
    || Boolean(payout.paymentFailureRecovery)
    || request?.lifecycle === 'APPROVED'
    || request?.approval?.status === 'APPROVED'
  ) {
    return { tab: 'approved', status: '付款中', requestApprovalStatus: request?.approval?.status };
  }
  return { tab: 'approved', status: '已通过', requestApprovalStatus: request?.approval?.status };
};

export const getInvoiceManagementReturnContext = (
  payout: Payout,
  invoiceId?: InvoiceId,
  request?: PaymentRequestProjectLike,
): InvoiceManagementReturnContext | null => {
  if (
    payout.invoiceReviewStatus === '已退回'
    && payout.paymentFailureReturn?.issueType === 'INVOICE_CONTENT'
  ) {
    return {
      source: 'PAYMENT_FAILURE_INVOICE',
      sourceLabel: '付款失败退回 · Invoice',
      reason: payout.paymentFailureReturn.reason,
      actorName: payout.paymentFailureReturn.actorName,
      occurredAt: payout.paymentFailureReturn.occurredAt,
    };
  }

  if (!invoiceId || request?.approval?.status !== 'RETURNED_TO_MEDIA_REVIEW') return null;
  const scopedReturn = requestApprovalReturnItemForInvoiceEdit(request.approval, invoiceId);
  if (!scopedReturn) return null;
  const returnEvent = [...request.approval.history].reverse().find((event) => (
    event.action === 'RETURN'
    && event.round === request.approval?.round
    && (event.returnItems ?? request.approval?.returnItems)?.some((item) => (
      item.invoiceId === invoiceId && ['INVOICE_CONTENT', 'FULL_ITEM'].includes(item.issueType)
    ))
  ));
  const returnTime = Date.parse(returnEvent?.occurredAt ?? request.approval.updatedAt);
  const invoiceWasModifiedAfterReturn = [...(payout.invoiceReviewHistory ?? [])].reverse().some((event) => (
    event.action === '修改 Invoice'
    && Number.isFinite(returnTime)
    && Date.parse(event.occurredAt) > returnTime
  ));
  if (invoiceWasModifiedAfterReturn) return null;
  return {
    source: 'APPROVAL_INVOICE',
    sourceLabel: '财务退回 · Invoice',
    reason: scopedReturn.reason,
    actorName: returnEvent?.actorName,
    occurredAt: returnEvent?.occurredAt ?? request.approval.updatedAt,
  };
};
