import type { RequestApprovalStatus } from '../businessWorkflow';
import type { PaymentRequestProjectLike } from '../paymentRequestProjects';
import type { GeneratedInvoiceRecord, Payout } from '../types';

export type InvoicePageTab = 'signature' | 'review' | 'approved' | 'returned';

export type InvoiceManagementStatus =
  | '待签署'
  | '达人反馈'
  | '待审核'
  | '待复核'
  | '待发起请款'
  | 'OA审批中'
  | '付款中'
  | '已付款'
  | '已退回';

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
  return requests.find((request) => requestInvoiceIds(request).has(invoice.invoiceId));
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
    payout.status === '等待付款'
    || payout.status === '付款处理中'
    || request?.lifecycle === 'APPROVED'
    || request?.approval?.status === 'APPROVED'
    || payout.invoiceReviewStatus === '已通过'
  ) {
    return { tab: 'approved', status: '付款中', requestApprovalStatus: request?.approval?.status };
  }
  if (
    request?.lifecycle === 'SUBMITTED'
    || (request?.approval && !['APPROVED', 'RETURNED_TO_MEDIA_REVIEW'].includes(request.approval.status))
  ) {
    return { tab: 'approved', status: 'OA审批中', requestApprovalStatus: request?.approval?.status };
  }
  return { tab: 'approved', status: '待发起请款', requestApprovalStatus: request?.approval?.status };
};
