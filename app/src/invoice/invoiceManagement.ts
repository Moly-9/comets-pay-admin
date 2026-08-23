import type { RequestApprovalStatus } from '../businessWorkflow';
import type { PaymentRequestProjectLike } from '../paymentRequestProjects';
import type { GeneratedInvoiceRecord, InvoiceType, Payout, Provider } from '../types';
import {
  REQUEST_APPROVAL_STAGE_LABEL,
  requestApprovalReturnItemForInvoice,
} from '../requestApprovalWorkflow';

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
  issuerName: string;
  initials: string;
  accent: string;
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

export type InvoiceManagementView = {
  tab: InvoicePageTab;
  status: InvoiceManagementStatus;
  requestApprovalStatus?: RequestApprovalStatus;
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
  payout: Pick<Payout, 'invoiceReviewStatus' | 'status'>,
  request?: PaymentRequestProjectLike,
): InvoiceManagementView => {
  const requestReturned = request?.lifecycle === 'RETURNED'
    || request?.approval?.status === 'RETURNED_TO_MEDIA_REVIEW';
  if (
    payout.invoiceReviewStatus === '已退回'
    || payout.status === '已退回'
    || payout.status === '付款失败'
  ) {
    return { tab: 'returned', status: '已退回', requestApprovalStatus: request?.approval?.status };
  }

  if (payout.invoiceReviewStatus === '草稿') {
    return { tab: 'signature', status: '草稿', requestApprovalStatus: request?.approval?.status };
  }

  if (payout.invoiceReviewStatus === '待签署') {
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
  if (requestReturned) {
    return { tab: 'returned', status: '已退回', requestApprovalStatus: request?.approval?.status };
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
    || request?.lifecycle === 'APPROVED'
    || request?.approval?.status === 'APPROVED'
  ) {
    return { tab: 'approved', status: '付款中', requestApprovalStatus: request?.approval?.status };
  }
  return { tab: 'approved', status: '已通过', requestApprovalStatus: request?.approval?.status };
};

export const getInvoiceManagementReturnInfo = (
  payout: Payout,
  invoiceId: GeneratedInvoiceRecord['invoiceId'],
  request?: PaymentRequestProjectLike,
) => {
  const scopedReturn = requestApprovalReturnItemForInvoice(request?.approval, invoiceId);
  if (scopedReturn) {
    return {
      sourceLabel: scopedReturn.issueType === 'INVOICE_CONTENT' ? '财务退回 · Invoice' : '财务退回 · 付款清单',
      reason: scopedReturn.reason,
    };
  }
  if (request?.approval?.status === 'RETURNED_TO_MEDIA_REVIEW') {
    const stage = request.approval.returnedFromStage;
    return {
      sourceLabel: stage ? `${REQUEST_APPROVAL_STAGE_LABEL[stage]}退回` : '请款审批退回',
      reason: request.approval.returnReason?.trim() || '未记录退回原因',
    };
  }
  if (payout.paymentFailureReturn) {
    return {
      sourceLabel: payout.paymentFailureReturn.issueType === 'INVOICE_CONTENT'
        ? '付款失败退回 · Invoice'
        : '付款失败退回 · 付款账户',
      reason: payout.paymentFailureReturn.reason,
    };
  }
  if (payout.invoiceReviewReturn) {
    return {
      sourceLabel: payout.invoiceReviewReturn.stage === 'MEDIA' ? '媒介审核退回' : 'Invoice 审核退回',
      reason: payout.invoiceReviewReturn.reason,
    };
  }
  if (payout.returnReason?.trim()) {
    return { sourceLabel: '业务退回', reason: payout.returnReason.trim() };
  }
  if (payout.paymentFailure) {
    return {
      sourceLabel: '渠道付款失败',
      reason: payout.paymentFailure.providerResponse || payout.paymentFailure.errorCode,
    };
  }
  return undefined;
};
