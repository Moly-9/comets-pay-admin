import {
  AlertTriangle,
  CircleAlert,
  Download,
  Eraser,
  FileSignature,
  FileText,
  Link2,
  Mail,
  ReceiptText,
  RefreshCw,
  Send,
  UserCheck,
  WalletCards,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { accountDisplayValue } from '../accountPresentation';
import {
  invoicePaymentListProvider,
  isValidPaymentTransactionReference,
  paymentListEffectiveAccount,
  paymentListItemValue,
  validatePaymentListGeneration,
  type ContractId,
  type InvoiceId,
  type PaymentListEditableField,
  type PaymentListId,
  type PaymentListRecord,
} from '../businessWorkflow';
import { CONTRACT_TYPE_LABELS, contractLinkedToProject, formatContractMoney, getContractReadiness, getContractType, getContractValidity, isConfirmedContract, type ContractRecord, type ContractUploadInput } from '../contracts';
import type { SystemUser } from '../data';
import { formatInvoiceMoney, invoiceTotal } from '../invoice/invoiceUtils';
import {
  invoiceCooperationProjectId,
  paymentRequestInvoiceIds,
  paymentRequestProviderForChannel,
  requestOwningInvoice,
  type PaymentRequestCreatorLink,
  type PaymentRequestProjectLike,
} from '../paymentRequestProjects';
import type { RequestProjectSummary } from '../pages/RequestProjectDetailPage';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import { paymentFailureRecoveryLabel } from '../paymentFailureRecovery';
import { PAYMENT_CURRENCY_OPTIONS } from '../paymentCurrencies';
import { creatorSearchTerms } from '../creatorSearchOptions';
import { validatePaymentListAccountViaApi } from '../requestPaymentAccountValidation';
import {
  requestApprovalHasScopedReturnItems,
  requestApprovalReturnEditScope,
  requestApprovalReturnItemForContract,
  requestApprovalReturnItemForInvoice,
  requestApprovalReturnItemForInvoiceEdit,
  requestApprovalReturnItemForPaymentListEdit,
} from '../requestApprovalWorkflow';
import type { CreatorProfile, GeneratedInvoiceRecord, Payout } from '../types';
import { Avatar, Button, ListActionButton, Modal, NoticeBanner } from './Common';
import { PaymentListEditor } from './PaymentListEditor';
import { paymentProviderDisplayName } from './PaymentProviderBadge';
import { CreatorIdentity } from './CreatorIdentity';
import { SearchableComboBox, type SearchableOption } from './SearchableComboBox';

type ResourceKind = 'contract' | 'invoice' | 'payment';
type ExpandedPaymentRow = { invoiceId: InvoiceId; mode: 'view' | 'edit' } | null;
type PaymentGenerationIssueGroup = {
  key: string;
  invoiceId?: InvoiceId;
  creatorName: string;
  invoiceNumber: string;
  issues: string[];
};
type ConfirmAction = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => void;
};

type Props = {
  request: RequestProjectSummary;
  cooperationProject: ProjectSummary;
  requests: RequestProjectSummary[];
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
  paymentLists: PaymentListRecord[];
  payouts?: Payout[];
  focusedFailurePayoutId?: string | null;
  canHandlePaymentFailure?: boolean;
  onFailureFocusHandled?: () => void;
  onSendPaymentFailureNotification?: (payoutId: string, message: string) => boolean;
  onSendPaymentListReturnNotification?: (requestId: string, invoiceId: InvoiceId, message: string) => boolean;
  onSimulatePaymentListReturnAccountUpdate?: (requestId: string, invoiceId: InvoiceId) => boolean;
  onSimulatePaymentFailureAccountUpdate?: (payoutId: string) => boolean;
  onRevalidatePaymentFailureAccount?: (payoutId: string) => boolean;
  currentUser: SystemUser;
  onChangeLinks: (links: PaymentRequestCreatorLink[], summary: string) => void;
  onOpenContract: (contractId: string) => void;
  onOpenInvoice: (invoiceId: InvoiceId) => void;
  onGenerateContract: () => void;
  onGenerateInvoice: () => void;
  onUploadContract: (inputs: ContractUploadInput[]) => ContractRecord[];
  onDeleteContract: (contractId: ContractId) => void;
  onDeleteInvoice: (invoiceId: InvoiceId) => void;
  onClearPaymentLists: () => void;
  onRemovePaymentInvoice: (paymentListId: PaymentListId, invoiceId: InvoiceId) => void;
  onUpdatePaymentItem: (
    paymentListId: PaymentListId,
    invoiceId: InvoiceId,
    field: PaymentListEditableField,
    value: string | number,
  ) => void;
  onChangePaymentAccount: (paymentListId: PaymentListId, invoiceId: InvoiceId, payoutAccountId: string) => void;
  onRevalidatePaymentItem: (paymentListId: PaymentListId, invoiceId: InvoiceId) => void;
  onBeginEditPaymentList: (paymentListId: PaymentListId) => void;
  onGeneratePaymentListVersion: (paymentListId: PaymentListId) => Promise<void>;
  onExportPaymentList: (paymentListId: PaymentListId) => Promise<void>;
};

export type RequestProjectResourceActions = {
  onChangeLinks: (request: RequestProjectSummary, links: PaymentRequestCreatorLink[], summary: string) => void;
  onOpenContract: (request: RequestProjectSummary, contractId: string) => void;
  onOpenInvoice: (request: RequestProjectSummary, invoiceId: InvoiceId) => void;
  onGenerateContract: (request: RequestProjectSummary) => void;
  onGenerateInvoice: (request: RequestProjectSummary) => void;
  onUploadContract: (request: RequestProjectSummary, inputs: ContractUploadInput[]) => ContractRecord[];
  onDeleteContract: (request: RequestProjectSummary, contractId: ContractId) => void;
  onDeleteInvoice: (request: RequestProjectSummary, invoiceId: InvoiceId) => void;
  onClearPaymentLists: (request: RequestProjectSummary) => void;
  onRemovePaymentInvoice: (request: RequestProjectSummary, paymentListId: PaymentListId, invoiceId: InvoiceId) => void;
  onUpdatePaymentItem: (request: RequestProjectSummary, paymentListId: PaymentListId, invoiceId: InvoiceId, field: PaymentListEditableField, value: string | number) => void;
  onChangePaymentAccount: (request: RequestProjectSummary, paymentListId: PaymentListId, invoiceId: InvoiceId, payoutAccountId: string) => void;
  onRevalidatePaymentItem: (request: RequestProjectSummary, paymentListId: PaymentListId, invoiceId: InvoiceId) => void;
  onBeginEditPaymentList: (request: RequestProjectSummary, paymentListId: PaymentListId) => void;
  onGeneratePaymentListVersion: (request: RequestProjectSummary, paymentListId: PaymentListId) => Promise<void>;
  onExportPaymentList: (request: RequestProjectSummary, paymentListId: PaymentListId) => Promise<void>;
};

export const canEditRequestProjectResources = (
  user: SystemUser,
  request: Pick<RequestProjectSummary, 'approval' | 'lifecycle'>,
  hasPaymentFailureRecovery = false,
) => (
  user.roleKey === 'admin'
  || user.roleKey === 'owner'
  || user.roleKey === 'project'
  || (
    user.roleKey === 'media'
    && (
      request.lifecycle === 'DRAFT'
      || (
        request.lifecycle === 'RETURNED'
        && (
          request.approval?.status === 'RETURNED_TO_MEDIA_REVIEW'
          || hasPaymentFailureRecovery
        )
      )
    )
  )
);

const contractStableId = (contract: ContractRecord) => contract.contractId ?? contract.id as ContractId;

const creatorFor = (creatorId: string, creators: CreatorProfile[]) => (
  creators.find((creator) => creator.id === creatorId)
);

export const requestResourceCreatorSearchText = (
  creator: CreatorProfile | undefined,
  fallbackValues: Array<string | undefined>,
) => [creator ? creatorSearchTerms(creator) : '', ...fallbackValues]
  .filter(Boolean)
  .join(' ');

const paymentListStatusLabel = (status: PaymentListRecord['status']) => {
  if (status === 'paid') return '已付款';
  if (status === 'approved') return '已批准';
  if (status === 'submitted') return '已提交';
  if (status === 'generated') return '已生成';
  return '草稿';
};

const requestLinksByCreator = (request: RequestProjectSummary) => new Map(
  (request.creatorLinks ?? []).map((link) => [link.creatorId, link]),
);

export const contractAssociationCandidates = (
  contracts: ContractRecord[],
  cooperationProjectId: string | undefined,
) => cooperationProjectId ? contracts.filter((contract) => (
  !contract.isTemplate && contractLinkedToProject(contract, cooperationProjectId)
)) : [];

const contractStateUnavailableReason = (contract: ContractRecord) => {
  if (getContractValidity(contract).expired) return '合同已失效';
  if (contract.lifecycle === 'GENERATED_DRAFT') return '正式合同已生成，尚未上传待签署文件';
  if (contract.lifecycle === 'UPLOADED_PENDING_CONFIRMATION') return '已上传，待人工确认';
  if (contract.lifecycle === 'RECOGNITION_CONFIRMED') return '识别信息已确认，待发送达人签署';
  if (contract.lifecycle === 'SENT_FOR_SIGNATURE') return '已发送达人，待完成签署';
  if (!contract.signed) return '合同尚未完成签署';
  return getContractReadiness(contract).label;
};

export const contractAssociationUnavailableReason = (
  contract: ContractRecord,
  links: PaymentRequestCreatorLink[],
  creators: CreatorProfile[],
  cooperationProjectId?: string,
) => {
  if (!contract.contractId) return '合同缺少稳定合同 ID';
  if (!contract.creatorId) return '合同缺少达人稳定 ID';
  if (!creatorFor(contract.creatorId, creators)) return '合同关联的达人档案不存在';
  if (cooperationProjectId && !contractLinkedToProject(contract, cooperationProjectId)) {
    return '合同不属于当前合作项目';
  }
  const existingLink = links.find((link) => link.creatorId === contract.creatorId);
  if (!existingLink) return '请先将该合同达人加入当前请款';
  if (
    existingLink.socialAccountId
    && contract.creatorSocialAccountId
    && existingLink.socialAccountId !== contract.creatorSocialAccountId
  ) return '合同社媒账号与当前请款达人账号不一致';
  if (getContractValidity(contract).expired) return '合同已失效';
  return isConfirmedContract(contract) ? '' : contractStateUnavailableReason(contract);
};

export const mergeContractCandidateLinks = (
  links: PaymentRequestCreatorLink[],
  contracts: ContractRecord[],
) => {
  const next = links.map((link) => ({
    ...link,
    contractIds: [...link.contractIds],
    invoiceIds: [...link.invoiceIds],
  }));
  const linkIndexByCreator = new Map(next.map((link, index) => [link.creatorId, index]));

  contracts.forEach((contract) => {
    if (!contract.contractId || !contract.creatorId) return;
    const existingIndex = linkIndexByCreator.get(contract.creatorId);
    if (existingIndex !== undefined) {
      const existing = next[existingIndex];
      if (!existing) return;
      existing.contractIds = [...new Set([...existing.contractIds, contract.contractId])];
      return;
    }
  });

  return next;
};

export const invoiceAssociationCandidates = (
  invoices: GeneratedInvoiceRecord[],
  cooperationProjectId: string | undefined,
) => cooperationProjectId ? invoices.filter((invoice) => (
  invoiceCooperationProjectId(invoice) === cooperationProjectId
)) : [];

export const invoiceAssociationUnavailableReason = (
  invoice: GeneratedInvoiceRecord,
  links: PaymentRequestCreatorLink[],
  creators: CreatorProfile[],
  requests: PaymentRequestProjectLike[],
  excludeRequestId?: PaymentRequestProjectLike['paymentRequestProjectId'],
) => {
  if (!invoice.invoiceId) return 'Invoice 缺少稳定 Invoice ID';
  if (!invoice.snapshot.creatorId) return 'Invoice 缺少达人稳定 ID';
  if (!creatorFor(invoice.snapshot.creatorId, creators)) return 'Invoice 关联的达人档案不存在';
  if (!invoice.snapshot.engagementId) return 'Invoice 缺少合作关系 ID';
  if (invoice.status === '达人反馈') return 'Invoice 正在处理达人反馈，完成审核后才能关联请款';
  if (invoice.status === '已退回') return 'Invoice 已退回，修正并重新审核通过后才能关联请款';
  if (invoice.status !== '已通过') return 'Invoice 尚未审核通过，不能关联请款';
  const existingLink = links.find((link) => link.creatorId === invoice.snapshot.creatorId);
  if (existingLink && existingLink.engagementId !== invoice.snapshot.engagementId) {
    return '达人已通过其他合作关系加入当前请款';
  }
  if (
    existingLink?.socialAccountId
    && invoice.snapshot.creatorSocialAccountId
    && existingLink.socialAccountId !== invoice.snapshot.creatorSocialAccountId
  ) return 'Invoice 社媒账号与当前请款达人账号不一致';
  if (existingLink?.invoiceIds.includes(invoice.invoiceId)) return 'Invoice 已关联当前请款';
  if (existingLink?.invoiceIds.length) return '该达人已关联其他 Invoice，请先解除后再选择';
  const owner = requestOwningInvoice(requests, invoice.invoiceId, excludeRequestId);
  return owner ? `已关联 ${owner.requestCode ?? owner.id}` : '';
};

export const mergeInvoiceCandidateLinks = (
  links: PaymentRequestCreatorLink[],
  invoices: GeneratedInvoiceRecord[],
) => {
  const next = links.map((link) => ({
    ...link,
    contractIds: [...link.contractIds],
    invoiceIds: [...link.invoiceIds],
  }));
  const linkIndexByCreator = new Map(next.map((link, index) => [link.creatorId, index]));

  invoices.forEach((invoice) => {
    const { creatorId, engagementId } = invoice.snapshot;
    if (!invoice.invoiceId || !creatorId || !engagementId) return;
    const existingIndex = linkIndexByCreator.get(creatorId);
    if (existingIndex !== undefined) {
      const existing = next[existingIndex];
      if (!existing || existing.engagementId !== engagementId) return;
      if (existing.invoiceIds.length) return;
      existing.invoiceIds = [invoice.invoiceId];
      return;
    }
    next.push({
      creatorId,
      socialAccountId: invoice.snapshot.creatorSocialAccountId,
      creatorHandle: invoice.snapshot.creatorHandle,
      creatorPlatform: invoice.snapshot.creatorPlatform,
      engagementId,
      contractIds: [],
      invoiceIds: [invoice.invoiceId],
    });
    linkIndexByCreator.set(creatorId, next.length - 1);
  });

  return next;
};

export const requestLinkedContracts = (
  request: RequestProjectSummary,
  contracts: ContractRecord[],
) => {
  const ids = new Set((request.creatorLinks ?? []).flatMap((link) => link.contractIds));
  return contracts.filter((contract) => (
    ids.has(contractStableId(contract))
  ));
};

export const requestLinkedInvoices = (
  request: RequestProjectSummary,
  invoices: GeneratedInvoiceRecord[],
) => {
  const ids = new Set(paymentRequestInvoiceIds(request.creatorLinks ?? []));
  return invoices.filter((invoice) => ids.has(invoice.invoiceId));
};

const paymentFeeBearerLabel = (value: unknown) => {
  if (value === 'ADVERTISER') return '付款方承担';
  if (value === 'PUBLISHER') return '收款方承担';
  if (value === 'SHARED') return '各自承担';
  return '待补充';
};

const swiftFeeOptionLabel = (value: unknown) => {
  if (value === 'ADVERTISER') return 'OUR · 付款方承担';
  if (value === 'PUBLISHER') return 'BEN · 收款方承担';
  if (value === 'SHARED') return 'SHA · 各自承担';
  return '待补充';
};

const requiredPaymentLabel = (label: string) => (
  <span className="project-payment-required-label">{label}<em aria-hidden="true">*</em></span>
);

export function RequestProjectResourceManager({
  request,
  requests,
  creators,
  contracts,
  invoices,
  paymentLists,
  payouts = [],
  focusedFailurePayoutId = null,
  canHandlePaymentFailure = false,
  onFailureFocusHandled,
  onSendPaymentFailureNotification,
  onSendPaymentListReturnNotification,
  onSimulatePaymentListReturnAccountUpdate,
  onSimulatePaymentFailureAccountUpdate,
  onRevalidatePaymentFailureAccount,
  currentUser,
  onChangeLinks,
  onOpenContract,
  onOpenInvoice,
  onClearPaymentLists,
  onRemovePaymentInvoice,
  onUpdatePaymentItem,
  onChangePaymentAccount,
  onRevalidatePaymentItem,
  onBeginEditPaymentList,
  onGeneratePaymentListVersion,
  onExportPaymentList,
}: Props) {
  const [resourceDialog, setResourceDialog] = useState<ResourceKind | null>(null);
  const [linkDialog, setLinkDialog] = useState<'contract' | 'invoice' | null>(null);
  const [contractCreatorFilter, setContractCreatorFilter] = useState('ALL');
  const [invoiceCreatorFilter, setInvoiceCreatorFilter] = useState('ALL');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [notificationPayoutId, setNotificationPayoutId] = useState<string | null>(null);
  const [notificationReturnInvoiceId, setNotificationReturnInvoiceId] = useState<InvoiceId | null>(null);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [paymentEditorListId, setPaymentEditorListId] = useState<PaymentListId | null>(null);
  const [paymentEditorInvoiceId, setPaymentEditorInvoiceId] = useState<InvoiceId | null>(null);
  const [paymentEditorMode, setPaymentEditorMode] = useState<'view' | 'edit'>('edit');
  const [paymentEditorCloseWarning, setPaymentEditorCloseWarning] = useState(false);
  const [expandedPaymentRow, setExpandedPaymentRow] = useState<ExpandedPaymentRow>(null);
  const [bulkPaymentReason, setBulkPaymentReason] = useState('');
  const [bulkTransactionReference, setBulkTransactionReference] = useState('');
  const [bulkPaymentNotice, setBulkPaymentNotice] = useState('');
  const [paymentGenerationChecking, setPaymentGenerationChecking] = useState(false);
  const [paymentGenerationIssues, setPaymentGenerationIssues] = useState<PaymentGenerationIssueGroup[] | null>(null);
  const [paymentGenerationFailedInvoiceIds, setPaymentGenerationFailedInvoiceIds] = useState<InvoiceId[]>([]);
  const links = request.creatorLinks ?? [];
  const linkByCreator = requestLinksByCreator(request);
  const cooperationProjectId = request.cooperationProjectId ?? request.projectId;
  const linkedContracts = requestLinkedContracts(request, contracts);
  const linkedInvoices = requestLinkedInvoices(request, invoices);
  const requestPaymentLists = paymentLists.filter((list) => (
    list.paymentRequestProjectId === request.paymentRequestProjectId
  ));
  const currentPaymentList = requestPaymentLists[0] ?? null;
  const paymentFailureRecoveryMode = payouts.some((payout) => (
    payout.paymentRequestProjectId === request.paymentRequestProjectId
    && Boolean(payout.paymentFailureRecovery)
    && payout.paymentFailureRecovery?.status !== 'RETRY_SUBMITTED'
    && payout.status !== '已付款'
  ));
  const failureEditableInvoiceIds = invoices.filter((invoice) => payouts.some((payout) => (
    payout.id === invoice.sourcePayoutId
    && payout.paymentRequestProjectId === request.paymentRequestProjectId
    && payout.paymentFailureReturn?.issueType === 'PAYMENT_LIST'
    && Boolean(payout.paymentFailureRecovery)
    && payout.paymentFailureRecovery?.status !== 'RETRY_SUBMITTED'
    && payout.status !== '已付款'
  ))).map((invoice) => invoice.invoiceId);
  const canEdit = canEditRequestProjectResources(
    currentUser,
    request,
    paymentFailureRecoveryMode,
  );
  const hasScopedApprovalReturn = requestApprovalHasScopedReturnItems(request.approval);
  const returnEditScope = requestApprovalReturnEditScope(request.approval, paymentFailureRecoveryMode);
  const hasEditScopeRestriction = returnEditScope === 'scoped';
  const hasScopedPaymentListReturn = Boolean(request.approval?.returnItems?.some((item) => (
    ['PAYMENT_LIST', 'FULL_ITEM'].includes(item.issueType)
  )));
  const canEditLinkedResources = canEdit && !paymentFailureRecoveryMode && !hasEditScopeRestriction;
  const canEditPaymentList = canEdit
    && (
      paymentFailureRecoveryMode
      || !hasEditScopeRestriction
      || hasScopedPaymentListReturn
    );
  const canEditSubmittedPaymentList = ['admin', 'project', 'owner'].includes(currentUser.roleKey);
  const paymentItemCount = currentPaymentList?.items.length ?? 0;
  const paymentListExportable = Boolean(
    currentPaymentList
    && !['draft', 'submitted'].includes(currentPaymentList.status),
  );
  const paymentListIssues = currentPaymentList
    ? validatePaymentListGeneration(currentPaymentList, paymentRequestInvoiceIds(request.creatorLinks ?? []))
    : [{ code: 'NO_ITEMS' as const, message: '付款清单尚未生成。' }];
  const paymentListReady = Boolean(currentPaymentList && paymentListIssues.length === 0);
  const canBulkEditPaymentFields = Boolean(
    canEditPaymentList
    && currentPaymentList?.status === 'draft'
    && !paymentFailureRecoveryMode
    && !hasEditScopeRestriction,
  );
  const paymentEditorList = paymentEditorListId
    ? paymentLists.find((list) => list.paymentListId === paymentEditorListId) ?? null
    : null;
  useEffect(() => {
    if (paymentEditorCloseWarning && paymentEditorList && !paymentEditorList.items.some((item) => item.requiresRevalidation)) {
      setPaymentEditorCloseWarning(false);
    }
  }, [paymentEditorCloseWarning, paymentEditorList]);
  const notificationPayout = notificationPayoutId
    ? payouts.find((payout) => payout.id === notificationPayoutId) ?? null
    : null;
  const notificationReturnItem = notificationReturnInvoiceId
    ? requestApprovalReturnItemForInvoice(request.approval, notificationReturnInvoiceId, 'PAYMENT_LIST') ?? null
    : null;
  const notificationReturnInvoice = notificationReturnInvoiceId
    ? invoices.find((invoice) => invoice.invoiceId === notificationReturnInvoiceId) ?? null
    : null;
  const notificationReturnPaymentItem = notificationReturnInvoiceId
    ? currentPaymentList?.items.find((item) => item.invoiceId === notificationReturnInvoiceId) ?? null
    : null;
  const notificationReturnCreatorId = notificationReturnInvoice?.snapshot.creatorId
    ?? notificationReturnPaymentItem?.snapshot.creatorId;
  const notificationReturnCreator = notificationReturnCreatorId
    ? creators.find((creator) => creator.id === notificationReturnCreatorId) ?? null
    : null;

  useEffect(() => {
    if (focusedFailurePayoutId) setResourceDialog('payment');
  }, [focusedFailurePayoutId]);

  useEffect(() => {
    if (resourceDialog !== 'payment' || !focusedFailurePayoutId) return;
    const invoice = invoices.find((candidate) => candidate.sourcePayoutId === focusedFailurePayoutId);
    if (!invoice) return;
    let secondFrame = 0;
    let clearHighlightTimer = 0;
    const frame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        document.getElementById(`request-payment-row-${invoice.invoiceId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        document.getElementById(`request-payment-row-${invoice.invoiceId}`)?.focus({ preventScroll: true });
        clearHighlightTimer = window.setTimeout(() => onFailureFocusHandled?.(), 2400);
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      if (clearHighlightTimer) window.clearTimeout(clearHighlightTimer);
    };
  }, [focusedFailurePayoutId, invoices, onFailureFocusHandled, resourceDialog]);

  const openFailureNotification = (payout: Payout) => {
    setNotificationReturnInvoiceId(null);
    setNotificationPayoutId(payout.id);
    setNotificationMessage(`您的 ${payout.invoice} 付款未成功，请更新收款账户后在系统中反馈，以便重新安排付款。`);
  };

  const closeFailureNotification = () => {
    setNotificationPayoutId(null);
    setNotificationMessage('');
  };

  const openPaymentListReturnNotification = (
    invoiceId: InvoiceId,
    returnItem: { invoiceNumber: string; reason: string },
  ) => {
    setNotificationPayoutId(null);
    setNotificationReturnInvoiceId(invoiceId);
    setNotificationMessage(`您的 ${returnItem.invoiceNumber} 付款明细已退回修改，原因：${returnItem.reason}。请登录达人端更新相关付款信息后重新提交。`);
  };

  const closePaymentListReturnNotification = () => {
    setNotificationReturnInvoiceId(null);
    setNotificationMessage('');
  };

  const submitFailureNotification = () => {
    if (!notificationPayout || !notificationMessage.trim()) return;
    if (onSendPaymentFailureNotification?.(notificationPayout.id, notificationMessage.trim())) {
      closeFailureNotification();
    }
  };

  const submitPaymentListReturnNotification = () => {
    if (!notificationReturnItem || !notificationReturnInvoiceId || !notificationMessage.trim()) return;
    if (onSendPaymentListReturnNotification?.(
      request.paymentRequestProjectId ?? request.id,
      notificationReturnInvoiceId,
      notificationMessage.trim(),
    )) {
      closePaymentListReturnNotification();
    }
  };

  const generateOrRefreshPaymentList = async () => {
    if (
      !currentPaymentList
      || currentPaymentList.status !== 'draft'
      || !currentPaymentList.items.length
      || paymentGenerationChecking
    ) return;
    setPaymentGenerationChecking(true);
    setPaymentGenerationIssues(null);
    setPaymentGenerationFailedInvoiceIds([]);
    try {
      const expectedInvoiceIds = paymentRequestInvoiceIds(request.creatorLinks ?? []);
      const validationList: PaymentListRecord = {
        ...currentPaymentList,
        items: currentPaymentList.items.map((item) => ({
          ...item,
          requiresRevalidation: false,
          validationIssues: [],
        })),
      };
      const localIssues = validatePaymentListGeneration(validationList, expectedInvoiceIds);
      const apiChecks = await Promise.all(currentPaymentList.items.map(async (item) => {
        const effectiveAccount = paymentListEffectiveAccount(item);
        if (effectiveAccount.provider !== 'Airwallex') return null;
        return validatePaymentListAccountViaApi({ item, creators, scope: 'completeness' });
      }));
      const issueGroups: PaymentGenerationIssueGroup[] = currentPaymentList.items.flatMap((item, index) => {
        const localMessages = localIssues
          .filter((issue) => issue.invoiceId === item.invoiceId)
          .map((issue) => issue.message.replace(`${item.snapshot.invoiceNumber}：`, ''));
        const apiCheck = apiChecks[index];
        const apiMessages = apiCheck && apiCheck.state !== 'passed'
          ? apiCheck.fieldIssues?.length
            ? apiCheck.fieldIssues.map((issue) => issue.message)
            : [apiCheck.message]
          : [];
        const issues = [...new Set([...localMessages, ...apiMessages])];
        return issues.length ? [{
          key: item.invoiceId,
          invoiceId: item.invoiceId,
          creatorName: item.snapshot.creatorName,
          invoiceNumber: item.snapshot.invoiceNumber,
          issues,
        }] : [];
      });
      const listIssues = localIssues.filter((issue) => !issue.invoiceId);
      if (listIssues.length) {
        issueGroups.unshift({
          key: 'payment-list',
          creatorName: '付款清单',
          invoiceNumber: currentPaymentList.paymentListCode,
          issues: listIssues.map((issue) => issue.message),
        });
      }
      if (issueGroups.length) {
        setPaymentGenerationFailedInvoiceIds(issueGroups.flatMap((group) => group.invoiceId ? [group.invoiceId] : []));
        setPaymentGenerationIssues(issueGroups);
        return;
      }
      await onGeneratePaymentListVersion(currentPaymentList.paymentListId);
    } finally {
      setPaymentGenerationChecking(false);
    }
  };

  const openPaymentGenerationIssue = (group: PaymentGenerationIssueGroup) => {
    setPaymentGenerationIssues(null);
    if (!group.invoiceId) return;
    setExpandedPaymentRow({ invoiceId: group.invoiceId, mode: 'view' });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const row = document.getElementById(`request-payment-row-${group.invoiceId}`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row?.focus({ preventScroll: true });
      });
    });
  };

  const applyBulkPaymentField = (field: 'paymentReason' | 'transactionReference', rawValue: string) => {
    const value = rawValue.trim();
    if (!currentPaymentList || !canBulkEditPaymentFields || !value) return;
    if (field === 'transactionReference' && !isValidPaymentTransactionReference(value)) {
      setBulkPaymentNotice('交易附言仅支持 1–140 位英文、数字和常用英文标点。');
      return;
    }
    currentPaymentList.items.forEach((item) => {
      onUpdatePaymentItem(currentPaymentList.paymentListId, item.invoiceId, field, value);
    });
    setBulkPaymentNotice(`已将${field === 'paymentReason' ? '付款原因' : '交易附言'}填入 ${currentPaymentList.items.length} 笔付款明细。`);
  };

  const togglePaymentRow = (
    list: PaymentListRecord,
    invoiceId: InvoiceId,
    mode: 'view' | 'edit',
  ) => {
    if (expandedPaymentRow?.invoiceId === invoiceId && expandedPaymentRow.mode === mode) {
      setExpandedPaymentRow(null);
      return;
    }
    if (mode === 'edit' && list.status !== 'draft') onBeginEditPaymentList(list.paymentListId);
    setExpandedPaymentRow({ invoiceId, mode });
  };

  const openPaymentEditor = (paymentListId: PaymentListId, invoiceId?: InvoiceId, mode: 'view' | 'edit' = 'edit') => {
    const list = paymentLists.find((candidate) => candidate.paymentListId === paymentListId);
    if (!list) return;
    const readOnly = mode === 'view' || (['submitted', 'approved', 'paid'].includes(list.status) && !canEditSubmittedPaymentList);
    if (!readOnly && !canEditPaymentList) return;
    if (!readOnly && list.status !== 'draft') onBeginEditPaymentList(paymentListId);
    setPaymentEditorListId(paymentListId);
    setPaymentEditorInvoiceId(invoiceId ?? null);
    setPaymentEditorMode(mode);
    setPaymentEditorCloseWarning(false);
  };

  const closePaymentEditor = () => {
    const requiresRevalidation = paymentEditorMode === 'edit'
      && ['admin', 'project', 'owner'].includes(currentUser.roleKey)
      && Boolean(paymentEditorList?.items.some((item) => item.requiresRevalidation));
    if (requiresRevalidation) {
      setPaymentEditorCloseWarning(true);
      return;
    }
    setPaymentEditorCloseWarning(false);
    setPaymentEditorListId(null);
    setPaymentEditorInvoiceId(null);
    setPaymentEditorMode('edit');
  };

  const contractCandidates = contractAssociationCandidates(contracts, cooperationProjectId).filter((contract) => (
    Boolean(contract.creatorId && linkByCreator.has(contract.creatorId))
  ));

  const invoiceCandidates = invoiceAssociationCandidates(invoices, cooperationProjectId);
  const requestPaymentProvider = paymentRequestProviderForChannel(request.paymentChannel);
  const invoiceUnavailableReason = (invoice: GeneratedInvoiceRecord) => (
    invoiceAssociationUnavailableReason(
      invoice,
      links,
      creators,
      requests as PaymentRequestProjectLike[],
      request.paymentRequestProjectId,
    ) || (
      requestPaymentProvider && invoicePaymentListProvider(invoice) !== requestPaymentProvider
        ? `Invoice 收款账户渠道与请款付款渠道 ${paymentProviderDisplayName(request.paymentChannel)} 不一致`
        : ''
    )
  );

  const openLinkDialog = (kind: 'contract' | 'invoice') => {
    setSelectedCandidateIds([]);
    if (kind === 'contract') setContractCreatorFilter('ALL');
    if (kind === 'invoice') setInvoiceCreatorFilter('ALL');
    setResourceDialog(null);
    setLinkDialog(kind);
  };

  const toggleCandidate = (id: string) => {
    setSelectedCandidateIds((current) => current.includes(id)
      ? current.filter((candidateId) => candidateId !== id)
      : [...current, id]);
  };

  const commitCandidates = () => {
    if (!linkDialog || !selectedCandidateIds.length) return;
    if (linkDialog === 'contract') {
      const additions = contractCandidates
        .filter((contract) => selectedCandidateIds.includes(contractStableId(contract)))
        .filter((contract) => !contractAssociationUnavailableReason(contract, links, creators, cooperationProjectId));
      if (additions.length) {
        const next = mergeContractCandidateLinks(links, additions);
        const addedCreatorCount = next.length - links.length;
        onChangeLinks(
          next,
          addedCreatorCount
            ? `已关联合同，并新增 ${addedCreatorCount} 位合同所属达人`
            : '已批量关联合同',
        );
      }
      setLinkDialog(null);
      setResourceDialog('contract');
      setSelectedCandidateIds([]);
      return;
    }
    const additions = invoiceCandidates
      .filter((invoice) => selectedCandidateIds.includes(invoice.invoiceId))
      .filter((invoice) => !invoiceUnavailableReason(invoice));
    const next = mergeInvoiceCandidateLinks(links, additions);
    const addedCreatorCount = next.length - links.length;
    onChangeLinks(
      next,
      addedCreatorCount
        ? `已关联 Invoice，并新增 ${addedCreatorCount} 位 Invoice 所属达人`
        : '已批量关联 Invoice',
    );
    setLinkDialog(null);
    setResourceDialog(linkDialog);
    setSelectedCandidateIds([]);
  };

  const unlinkContract = (contractId: ContractId) => {
    onChangeLinks(links.map((link) => ({
      ...link,
      contractIds: link.contractIds.filter((id) => id !== contractId),
    })), `已解除合同 ${contractId} 与当前请款的关联`);
  };

  const unlinkInvoices = (invoiceIds: InvoiceId[]) => {
    if (!invoiceIds.length) return;
    const idSet = new Set(invoiceIds);
    onChangeLinks(links.map((link) => ({
      ...link,
      invoiceIds: link.invoiceIds.filter((id) => !idSet.has(id)),
    })), `已解除 ${invoiceIds.length} 份 Invoice 与当前请款的关联`);
  };

  const linkedContractIds = new Set(linkedContracts.map(contractStableId));
  const availableContractCandidates = contractCandidates.filter((contract) => !linkedContractIds.has(contractStableId(contract)));
  const contractCreatorOptions: SearchableOption[] = [
    {
      value: 'ALL',
      label: '全部达人',
      description: `${availableContractCandidates.length} 份候选合同`,
    },
    ...[...new Set(availableContractCandidates.flatMap((contract) => (
      contract.creatorId ? [contract.creatorId] : []
    )))].map((creatorId) => {
      const creator = creatorFor(creatorId, creators);
      const sample = availableContractCandidates.find((contract) => contract.creatorId === creatorId);
      const count = availableContractCandidates.filter((contract) => contract.creatorId === creatorId).length;
      const fallbackName = sample?.generationSnapshot?.creatorName ?? creatorId;
      return {
        value: creatorId,
        label: creator?.name ?? fallbackName,
        selectedLabel: creator?.name ?? fallbackName,
        description: `${count} 份合同`,
        searchText: requestResourceCreatorSearchText(creator, [
          fallbackName,
          sample?.creatorHandle,
          sample?.creatorPlatform ?? sample?.platform,
          sample?.channelLink,
          sample?.generationSnapshot?.channelUrl,
        ]),
      };
    }),
  ];
  const filteredContractCandidates = availableContractCandidates.filter((contract) => (
    contractCreatorFilter === 'ALL' || contract.creatorId === contractCreatorFilter
  ));
  const availableInvoiceCandidates = invoiceCandidates;
  const invoiceCreatorOptions: SearchableOption[] = [
    {
      value: 'ALL',
      label: '全部达人',
      description: `${availableInvoiceCandidates.length} 份候选 Invoice`,
    },
    ...[...new Set(availableInvoiceCandidates.flatMap((invoice) => (
      invoice.snapshot.creatorId ? [invoice.snapshot.creatorId] : []
    )))].map((creatorId) => {
      const creator = creatorFor(creatorId, creators);
      const sample = availableInvoiceCandidates.find((invoice) => invoice.snapshot.creatorId === creatorId);
      const count = availableInvoiceCandidates.filter((invoice) => (
        invoice.snapshot.creatorId === creatorId
      )).length;
      return {
        value: creatorId,
        label: creator?.name ?? sample?.snapshot.creatorName ?? creatorId,
        selectedLabel: creator?.name ?? sample?.snapshot.creatorName ?? creatorId,
        description: `${count} 份 Invoice`,
        searchText: requestResourceCreatorSearchText(creator, [
          sample?.snapshot.creatorName,
          sample?.snapshot.creatorHandle,
          sample?.snapshot.creatorPlatform,
        ]),
      };
    }),
  ];
  const filteredInvoiceCandidates = availableInvoiceCandidates.filter((invoice) => (
    invoiceCreatorFilter === 'ALL' || invoice.snapshot.creatorId === invoiceCreatorFilter
  ));
  const selectedInvoiceIdByCreator = new Map<string, InvoiceId>();
  selectedCandidateIds.forEach((candidateId) => {
    const selectedInvoice = invoiceCandidates.find((invoice) => invoice.invoiceId === candidateId);
    if (selectedInvoice?.snapshot.creatorId && !selectedInvoiceIdByCreator.has(selectedInvoice.snapshot.creatorId)) {
      selectedInvoiceIdByCreator.set(selectedInvoice.snapshot.creatorId, selectedInvoice.invoiceId);
    }
  });

  return (
    <>
      <div className="project-resource-list">
        <article className="project-resource-row">
          <span className="project-resource-icon"><FileText size={19} /></span>
          <div className="project-resource-copy"><div className="project-resource-heading"><h3 className="project-resource-label">合同</h3><span className="project-resource-count">{linkedContracts.length} 条可查看</span></div><strong>{linkedContracts.length ? `${linkedContracts.length} 份合同` : '未关联合同（选填）'}</strong><small>已关联记录全部平铺展示</small></div>
          <span className="project-resource-status"><i />{linkedContracts.length ? '已关联' : '未关联'}</span>
          <ListActionButton className="project-resource-summary-open" kind="view" onClick={() => setResourceDialog('contract')}>查看合同</ListActionButton>
        </article>
        <article className="project-resource-row project-resource-row-invoice">
          <span className="project-resource-icon"><ReceiptText size={19} /></span>
          <div className="project-resource-copy"><div className="project-resource-heading"><h3 className="project-resource-label">Invoice</h3><span className="project-resource-count">{linkedInvoices.length} 条可查看</span></div><strong>{linkedInvoices.length} 份 Invoice</strong><small>每位达人仅可关联一份 Invoice</small></div>
          <span className="project-resource-status"><i />{linkedInvoices.length ? '已关联' : '待补资料'}</span>
          <ListActionButton className="project-resource-summary-open" kind="view" onClick={() => setResourceDialog('invoice')}>查看 Invoice</ListActionButton>
        </article>
        <article className="project-resource-row project-resource-row-payment">
          <span className="project-resource-icon"><WalletCards size={19} /></span>
          <div className="project-resource-copy"><div className="project-resource-heading"><h3 className="project-resource-label">付款单</h3><span className="project-resource-count">{paymentItemCount} 条明细</span></div><strong>{currentPaymentList?.paymentListCode ?? '待生成'}</strong><small>一张付款单覆盖当前请款全部 Invoice</small></div>
          <span className="project-resource-status"><i />{currentPaymentList ? paymentListStatusLabel(currentPaymentList.status) : '未生成'}</span>
          <ListActionButton className="project-resource-summary-open" kind="view" onClick={() => setResourceDialog('payment')}>查看清单</ListActionButton>
        </article>
      </div>

      {hasEditScopeRestriction && hasScopedApprovalReturn ? (
        <NoticeBanner>财务已按明细指定修改范围：仅退回记录对应的合同、Invoice 或付款明细可修改，其余资料保持锁定。</NoticeBanner>
      ) : !canEditLinkedResources && !paymentFailureRecoveryMode ? <NoticeBanner>当前账号在项目提交后仅可查看与导出资料。</NoticeBanner> : null}

      {resourceDialog === 'contract' ? (
        <Modal title={`${request.requestCode ?? request.id} · 合同资料`} width="920px" className="project-resource-modal request-resource-modal request-document-list-modal" onClose={() => setResourceDialog(null)} footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}>
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading"><div><strong>全部合同</strong><p>平铺展示当前请款已关联的合同。</p></div><span>{linkedContracts.length} 份</span></div>
            {canEditLinkedResources ? <div className="project-resource-browser-toolbar"><Button variant="secondary" icon={<Link2 size={15} />} onClick={() => openLinkDialog('contract')}>关联已有合同</Button></div> : null}
            <div className="request-resource-flat-list request-resource-contract-card-list">
              {linkedContracts.map((contract) => {
                const creator = contract.creatorId ? creatorFor(contract.creatorId, creators) : undefined;
                const contractId = contractStableId(contract);
                const readiness = getContractReadiness(contract);
                const contractName = contract.name || '合同名称待补充';
                const contractReturn = requestApprovalReturnItemForContract(request.approval, String(contractId));
                const contractEditable = canEdit && Boolean(contractReturn);
                return <article className="request-resource-flat-row request-resource-contract-row" key={contractId}><span className="project-contract-record-icon request-contract-record-icon" aria-hidden="true"><FileSignature size={19} strokeWidth={2} /></span><div><strong className="request-contract-name" title={contractName}>{contractName}</strong><small>{contract.id}</small></div><div><span>达人</span><CreatorIdentity creator={creator} displayName="达人档案缺失" fallbackHandle={contract.creatorHandle} fallbackPlatform={contract.creatorPlatform ?? contract.platform} showAvatar={false} socialAccountsMaxVisible={1} /></div><div><span>合同金额</span><strong>{formatContractMoney(contract)}</strong></div><span className={`project-record-status${contractReturn ? ' is-warning' : readiness.ready ? ' is-success' : ''}`}><i />{contractReturn ? '需修改合同' : readiness.label}</span><div className="project-contract-record-actions"><ListActionButton kind={contractEditable ? 'edit' : 'view'} onClick={() => onOpenContract(String(contractId))}>{contractEditable ? '打开修改' : '查看'}</ListActionButton>{canEditLinkedResources ? <ListActionButton kind="danger" onClick={() => setConfirmAction({ title: '移出当前请款', description: `合同 ${contract.id} 仍保留在当前合作项目，只从本次请款中移除。`, confirmLabel: '确认移出', run: () => unlinkContract(contractId) })}>移出请款</ListActionButton> : null}</div></article>;
              })}
              {!linkedContracts.length ? <div className="project-resource-browser-empty"><FileText size={23} /><strong>当前请款未关联合同</strong><p>合同选填，可关联当前合作项目下的已有记录。</p></div> : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {resourceDialog === 'invoice' ? (
        <Modal title={`${request.requestCode ?? request.id} · Invoice`} width="920px" className="project-resource-modal request-resource-modal request-document-list-modal" onClose={() => setResourceDialog(null)} footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}>
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading"><div><strong>全部 Invoice</strong><p>平铺展示 {linkedInvoices.length} 份 Invoice，每位达人仅可关联一份。</p></div><span>{linkedInvoices.length} 份</span></div>
            {canEditLinkedResources ? <div className="project-resource-browser-toolbar"><Button variant="secondary" icon={<Link2 size={15} />} onClick={() => openLinkDialog('invoice')}>关联已有 Invoice</Button></div> : null}
            <div className="request-resource-flat-list request-resource-invoice-card-list">
              {linkedInvoices.map((invoice) => {
                const creator = invoice.snapshot.creatorId ? creatorFor(invoice.snapshot.creatorId, creators) : undefined;
                const invoiceReturn = requestApprovalReturnItemForInvoiceEdit(request.approval, invoice.invoiceId);
                return <article className="request-resource-flat-row request-resource-invoice-row" key={invoice.invoiceId}><span className="project-contract-record-icon request-invoice-record-icon" aria-hidden="true"><ReceiptText size={19} strokeWidth={2} /></span><div><strong>{invoice.id}</strong><small>{invoice.status}</small></div><div><span>达人</span><CreatorIdentity creator={creator} displayName={invoice.snapshot.creatorName} fallbackHandle={invoice.snapshot.creatorHandle} fallbackPlatform={invoice.snapshot.creatorPlatform} showAvatar={false} socialAccountsMaxVisible={1} /></div><div><span>Invoice 金额</span><strong>{formatInvoiceMoney(invoice.snapshot.currency, invoiceTotal(invoice.snapshot))}</strong><small>{invoice.snapshot.contractIds?.length ?? 0} 份覆盖合同</small></div><span className={`project-record-status${invoiceReturn ? ' is-warning' : ''}`}><i />{invoiceReturn ? '需修改 Invoice' : invoice.validationStatus === 'valid' ? '已通过' : '需重新校验'}</span><div className="project-contract-record-actions"><ListActionButton kind={invoiceReturn ? 'edit' : 'view'} onClick={() => onOpenInvoice(invoice.invoiceId)}>{invoiceReturn ? '打开修改' : '查看'}</ListActionButton>{canEditLinkedResources ? <ListActionButton kind="edit" onClick={() => setConfirmAction({ title: '解除 Invoice 关联', description: `${invoice.id} 源记录会保留，对应付款行将移除。`, confirmLabel: '确认解除', run: () => unlinkInvoices([invoice.invoiceId]) })}>解除</ListActionButton> : null}</div></article>;
              })}
              {!linkedInvoices.length ? <div className="project-resource-browser-empty"><ReceiptText size={23} /><strong>当前请款未关联 Invoice</strong><p>每位达人提交审批前需要关联一份 Invoice。</p></div> : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {resourceDialog === 'payment' && !paymentEditorList ? (
        <Modal title={`${request.requestCode ?? request.id} · 付款单`} width="1120px" className="project-resource-modal request-resource-modal" onClose={() => setResourceDialog(null)} footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}>
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading"><div><strong>{currentPaymentList?.paymentListCode ?? '付款单待生成'}</strong><p>一张付款单包含全部 Invoice；当前请款固定使用 {paymentProviderDisplayName(request.paymentChannel)}。</p></div><span>{paymentItemCount} 笔</span></div>
            {canEdit || currentPaymentList ? (
              <div className="project-resource-browser-toolbar request-payment-toolbar">
                <div className="request-payment-bulk-fields">
                  <label><span>一键输入付款原因</span><span className="request-payment-bulk-control"><input aria-label="一键输入付款原因" value={bulkPaymentReason} disabled={!canBulkEditPaymentFields} placeholder="输入所有明细的付款原因" onChange={(event) => { setBulkPaymentReason(event.target.value); setBulkPaymentNotice(''); }} /><Button variant="secondary" disabled={!canBulkEditPaymentFields || !bulkPaymentReason.trim()} disabledReason={!canBulkEditPaymentFields ? '当前付款清单已锁定，不能批量修改。' : '请先填写付款原因。'} onClick={() => applyBulkPaymentField('paymentReason', bulkPaymentReason)}>填入全部</Button></span></label>
                  <label><span>一键输入交易附言 <small>请使用英文</small></span><span className="request-payment-bulk-control"><input aria-label="一键输入交易附言" value={bulkTransactionReference} maxLength={140} disabled={!canBulkEditPaymentFields} placeholder="English only, max 140 characters" onChange={(event) => { setBulkTransactionReference(event.target.value); setBulkPaymentNotice(''); }} /><Button variant="secondary" disabled={!canBulkEditPaymentFields || !bulkTransactionReference.trim()} disabledReason={!canBulkEditPaymentFields ? '当前付款清单已锁定，不能批量修改。' : '请先填写交易附言。'} onClick={() => applyBulkPaymentField('transactionReference', bulkTransactionReference)}>填入全部</Button></span></label>
                </div>
                <div className="request-payment-toolbar-actions">
                  {canEditLinkedResources && currentPaymentList ? <Button variant="danger" icon={<Eraser size={15} />} disabled disabledReason="为保留付款审计链路，当前不支持清空整张付款清单。" onClick={() => setConfirmAction({ title: '清空付款清单', description: `将清空当前付款清单的 ${paymentItemCount} 笔付款行。清单编号和历史版本保留，Invoice 源记录不受影响。`, confirmLabel: '确认清空', danger: true, run: onClearPaymentLists })}>清空清单</Button> : null}
                  {currentPaymentList ? <Button variant="secondary" icon={<Download size={15} />} disabled={!paymentListExportable} disabledReason="付款清单尚未生成完成，当前不可导出。" onClick={() => { void onExportPaymentList(currentPaymentList.paymentListId); }}>导出 Excel</Button> : null}
                  {canEditLinkedResources ? <Button icon={<RefreshCw className={paymentGenerationChecking ? 'is-spinning' : undefined} size={15} />} disabled={paymentGenerationChecking || !currentPaymentList?.items.length || currentPaymentList?.status !== 'draft'} disabledReason={paymentGenerationChecking ? '付款信息正在校验，请稍候。' : currentPaymentList?.status !== 'draft' ? '已生成的付款清单已锁定。' : '请先添加付款明细。'} title={currentPaymentList?.status !== 'draft' ? '已生成的付款清单已锁定' : '调用 Airwallex 付款信息完整性接口校验并生成付款清单'} onClick={() => { void generateOrRefreshPaymentList(); }}>{paymentGenerationChecking ? 'Airwallex 校验中' : '生成付款清单'}</Button> : null}
                </div>
              </div>
            ) : null}
            {bulkPaymentNotice ? <div className="request-payment-bulk-notice" role="status">{bulkPaymentNotice}</div> : null}
            {paymentFailureRecoveryMode ? <NoticeBanner>付款失败恢复中：已付款明细保持冻结，仅失败明细可修改或重新校验。</NoticeBanner> : null}
            {hasEditScopeRestriction && hasScopedApprovalReturn && hasScopedPaymentListReturn ? <NoticeBanner>仅财务退回范围内的付款明细可修改，其他付款明细已通过并保持锁定。</NoticeBanner> : null}
            {!paymentListReady && currentPaymentList?.items.length ? <div className="payment-list-overview-guidance" role="status"><CircleAlert size={17} /><div><strong>付款清单尚未完成</strong><span>可通过每笔卡片下方的“编辑本笔”完善信息；点击“生成付款清单”将调用 Airwallex 接口校验并展示缺失字段。</span></div></div> : null}
            <div className="payment-list-overview-rows">
              {currentPaymentList?.items.map((item) => {
                const list = currentPaymentList;
                const effectiveAccount = paymentListEffectiveAccount(item);
                const creator = creators.find((candidate) => candidate.id === item.snapshot.creatorId);
                const accountName = effectiveAccount.paymentDetails?.accountName
                  || effectiveAccount.paymentDetails?.paypalUsername
                  || accountDisplayValue(effectiveAccount.accountSummary, '待补充');
                const expandedMode = expandedPaymentRow?.invoiceId === item.invoiceId
                  ? expandedPaymentRow.mode
                  : null;
                const invoice = invoices.find((candidate) => candidate.invoiceId === item.invoiceId);
                const linkedPayout = invoice
                  ? payouts.find((payout) => (
                      payout.id === invoice.sourcePayoutId
                    ))
                  : undefined;
                const failurePayout = linkedPayout?.paymentFailureRecovery && linkedPayout.status !== '已付款'
                  ? linkedPayout
                  : undefined;
                const paymentListReturn = requestApprovalReturnItemForPaymentListEdit(
                  request.approval,
                  item.invoiceId,
                );
                const recovery = failurePayout?.paymentFailureRecovery;
                const focused = failurePayout?.id === focusedFailurePayoutId;
                const itemIssues = validatePaymentListGeneration({ ...list, items: [item] }, [item.invoiceId])
                  .filter((issue) => issue.code === 'INVALID_ITEM')
                  .map((issue) => issue.message.replace(`${item.snapshot.invoiceNumber}：`, ''));
                const rowCanEdit = canEditPaymentList
                  && !paymentFailureRecoveryMode
                  && (!hasEditScopeRestriction || Boolean(paymentListReturn))
                  && (list.status === 'draft' || canEditSubmittedPaymentList);
                const transactionReference = String(paymentListItemValue(item, 'transactionReference') || '');
                const transferMethod = String(paymentListItemValue(item, 'transferMethod') || effectiveAccount.transferMethod || '待补充');
                const generationFailed = paymentGenerationFailedInvoiceIds.includes(item.invoiceId);
                return (
                  <article
                    className={`payment-list-overview-row${failurePayout ? ' is-payment-failure' : ''}${focused ? ' is-failure-focused' : ''}${generationFailed ? ' is-generation-failed' : ''}`}
                    id={`request-payment-row-${item.invoiceId}`}
                    key={`${list.paymentListId}-${item.invoiceId}`}
                    tabIndex={focused || generationFailed ? -1 : undefined}
                  >
                    <header className="payment-list-overview-row-header">
                      <div className="payment-list-overview-creator"><Avatar initials={creator?.initials ?? item.snapshot.creatorName.slice(0, 2).toUpperCase()} accent={creator?.accent ?? '#60758f'} size="sm" /><span><strong>{item.snapshot.creatorName}</strong><small>{item.snapshot.invoiceNumber} · {list.paymentListCode} · {paymentProviderDisplayName(effectiveAccount.provider)}</small></span></div>
                      <span className={`payment-list-overview-state ${generationFailed ? 'is-error' : itemIssues.length ? 'is-warning' : 'is-ready'}`}>{generationFailed ? '校验未通过' : itemIssues.length ? '待完善' : '已完成'}</span>
                    </header>
                    <div className={`payment-list-overview-row-summary${transferMethod === 'SWIFT' ? ' is-swift' : ''}`}><span>收款账户名 <b title={accountName}>{accountName}</b></span><span>金额 <b>{paymentListItemValue(item, 'currency')} {Number(paymentListItemValue(item, 'amount')).toLocaleString('en-US')}</b></span><span>收款方币种 <b>{paymentListItemValue(item, 'receiveCurrency') || '待补充'}</b></span><span>转账方式 <b>{transferMethod}</b></span>{transferMethod === 'SWIFT' ? <span>SWIFT 费用选项 <b>{swiftFeeOptionLabel(paymentListItemValue(item, 'feeBearer'))}</b></span> : null}</div>
                    {paymentListReturn ? (
                      <div className="request-approval-return-item-note" role="note">
                        <AlertTriangle size={15} />
                        <span><strong>退回原因：</strong>{paymentListReturn.reason}</span>
                        {paymentListReturn.issueType === 'PAYMENT_LIST' && canEditPaymentList && onSendPaymentListReturnNotification ? (
                          <Button
                            variant="ghost"
                            icon={<Send size={14} />}
                            onClick={() => openPaymentListReturnNotification(item.invoiceId, paymentListReturn)}
                          >
                            通知达人
                          </Button>
                        ) : null}
                        {paymentListReturn.issueType === 'PAYMENT_LIST' && canEditPaymentList && onSimulatePaymentListReturnAccountUpdate ? (
                          <Button
                            variant="ghost"
                            icon={<UserCheck size={14} />}
                            disabled={!paymentListReturn.notifications?.length || Boolean(paymentListReturn.accountUpdate)}
                            disabledReason={!paymentListReturn.notifications?.length ? '请先通知达人更新账户。' : '账户已更新并通过校验。'}
                            title={!paymentListReturn.notifications?.length ? '请先通知达人' : paymentListReturn.accountUpdate ? '账户已更新并通过校验' : '模拟达人完成账户信息修改'}
                            onClick={() => onSimulatePaymentListReturnAccountUpdate(request.paymentRequestProjectId ?? request.id, item.invoiceId)}
                          >
                            {paymentListReturn.accountUpdate ? '账户已更新并通过校验' : '模拟达人已修改账户'}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {paymentListReturn?.notifications?.length ? (
                      <div className="request-approval-return-item-delivery" role="status">
                        <Mail size={14} aria-hidden="true" />
                        已通知 {paymentListReturn.notifications.length} 次 · 最近一次 {paymentListReturn.notifications[paymentListReturn.notifications.length - 1]?.deliveries.map((delivery) => `${delivery.channel === 'IN_APP' ? '站内信' : 'Gmail'}${delivery.status === 'SIMULATED_SENT' ? '已发送' : '未发送'}`).join(' / ')}
                      </div>
                    ) : null}
                    {paymentListReturn?.accountUpdate ? (
                      <div className="request-approval-return-item-account-update" role="status">
                        <UserCheck size={14} aria-hidden="true" />
                        达人账户已更新 · {paymentListReturn.accountUpdate.payoutAccountVersion ?? '新账户版本'} · 校验通过
                      </div>
                    ) : null}
                    {failurePayout && recovery ? (
                      <section className="payment-failure-recovery-panel" aria-label={`${item.snapshot.creatorName} 付款失败恢复`}>
                        <div className="payment-failure-recovery-copy">
                          <span className={`payment-failure-recovery-status is-${recovery.status.toLowerCase()}`}><i />{paymentFailureRecoveryLabel(failurePayout)}</span>
                          <strong>{failurePayout.paymentFailureReturn?.reason ?? failurePayout.paymentFailure?.providerResponse ?? '未记录失败原因'}</strong>
                          <small>此处为前端原型流程，站内信、Gmail 和达人反馈不会真实发送或持久化。</small>
                          {recovery.notifications.length ? (
                            <span className="payment-failure-delivery-summary">
                              <Mail size={14} aria-hidden="true" />
                              已通知 {recovery.notifications.length} 次 · 最近一次 {recovery.notifications[recovery.notifications.length - 1]?.deliveries.map((delivery) => `${delivery.channel === 'IN_APP' ? '站内信' : 'Gmail'}${delivery.status === 'SIMULATED_SENT' ? '已发送' : '未发送'}`).join(' / ')}
                            </span>
                          ) : null}
                          {recovery.revalidationIssues?.length ? (
                            <ul className="payment-failure-revalidation-issues">
                              {recovery.revalidationIssues.map((issue) => <li key={issue}>{issue}</li>)}
                            </ul>
                          ) : null}
                        </div>
                        {canHandlePaymentFailure ? (
                          <div className="payment-failure-recovery-actions">
                            <Button variant="secondary" icon={<Send size={15} />} disabled={recovery.status === 'RETRY_SUBMITTED'} disabledReason="该失败付款已重新提交，无需再次通知。" onClick={() => openFailureNotification(failurePayout)}>发送失败通知</Button>
                            <Button
                              variant="ghost"
                              icon={<UserCheck size={15} />}
                              disabled={!['AWAITING_CREATOR_UPDATE', 'CREATOR_UPDATED'].includes(recovery.status)}
                              disabledReason="请先发送失败通知并等待达人更新账户。"
                              onClick={() => openPaymentEditor(list.paymentListId, item.invoiceId, 'edit')}
                            >
                              更换执行账户
                            </Button>
                            {recovery.status === 'CREATOR_UPDATED' ? (
                              <Button
                                icon={<RefreshCw size={15} />}
                                onClick={() => onRevalidatePaymentFailureAccount?.(failurePayout.id)}
                              >
                                兼容旧数据校验
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </section>
                    ) : null}
                    {recovery ? <div className="payment-list-overview-recovery">{paymentFailureRecoveryLabel(failurePayout!)} · {recovery.status}</div> : null}
                    {expandedMode ? (
                      <section className={`payment-list-inline-panel is-${expandedMode}`} aria-label={`${expandedMode === 'edit' ? '编辑' : '查看'}${item.snapshot.creatorName}付款明细`}>
                        <div className="payment-list-inline-section">
                          <div className="payment-list-inline-heading"><strong>收款信息</strong><span>来自 Invoice 签署冻结快照，不可修改</span></div>
                          <dl className="payment-list-inline-details">
                            <div><dt>收款账户名</dt><dd>{accountName}</dd></div>
                            <div><dt>收款账户</dt><dd>{accountDisplayValue(effectiveAccount.accountSummary, '待补充')}</dd></div>
                            <div><dt>付款渠道</dt><dd>{paymentProviderDisplayName(effectiveAccount.provider)}</dd></div>
                            <div><dt>转账方式</dt><dd>{String(paymentListItemValue(item, 'transferMethod') || effectiveAccount.transferMethod || '待补充')}</dd></div>
                            <div><dt>账户校验</dt><dd>{effectiveAccount.validationStatus === 'VERIFIED' ? '已验证' : effectiveAccount.validationStatus || '待验证'}</dd></div>
                            <div><dt>账户收款币种</dt><dd>{effectiveAccount.paymentDetails?.accountCurrency || paymentListItemValue(item, 'receiveCurrency') || '待补充'}</dd></div>
                          </dl>
                        </div>
                        <div className="payment-list-inline-section">
                          <div className="payment-list-inline-heading"><strong>交易信息</strong><span>{expandedMode === 'edit' ? '修改后需重新生成付款清单' : '当前付款明细'}</span></div>
                          {expandedMode === 'view' ? (
                            <dl className="payment-list-inline-details">
                              <div><dt>Invoice</dt><dd>{item.snapshot.invoiceNumber}</dd></div>
                              <div><dt>付款金额</dt><dd>{paymentListItemValue(item, 'currency')} {Number(paymentListItemValue(item, 'amount')).toLocaleString('en-US')}</dd></div>
                              <div><dt>收款币种</dt><dd>{paymentListItemValue(item, 'receiveCurrency') || '待补充'}</dd></div>
                              <div><dt>手续费承担方</dt><dd>{paymentFeeBearerLabel(paymentListItemValue(item, 'feeBearer'))}</dd></div>
                              <div><dt>付款原因</dt><dd>{paymentListItemValue(item, 'paymentReason') || '待填写'}</dd></div>
                              <div><dt>交易附言</dt><dd>{transactionReference || '待填写'}</dd></div>
                            </dl>
                          ) : (
                            <div className="payment-list-inline-form">
                              <label>付款金额<input aria-label="行内编辑付款金额" type="number" min="0" step="0.01" value={paymentListItemValue(item, 'amount')} onChange={(event) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'amount', Number(event.target.value))} /></label>
                              <label>支付币种<select aria-label="行内编辑支付币种" value={String(paymentListItemValue(item, 'currency'))} onChange={(event) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'currency', event.target.value)}>{PAYMENT_CURRENCY_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                              <label>收款币种<select aria-label="行内编辑收款币种" value={String(paymentListItemValue(item, 'receiveCurrency'))} onChange={(event) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'receiveCurrency', event.target.value)}>{PAYMENT_CURRENCY_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                              <label>手续费承担方<select aria-label="行内编辑手续费承担方" value={String(paymentListItemValue(item, 'feeBearer') || '')} onChange={(event) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'feeBearer', event.target.value)}><option value="">请选择</option><option value="ADVERTISER">付款方承担</option><option value="PUBLISHER">收款方承担</option><option value="SHARED">各自承担</option></select></label>
                              <label className="is-wide">付款原因<input aria-label="行内编辑付款原因" value={String(paymentListItemValue(item, 'paymentReason') || '')} onChange={(event) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'paymentReason', event.target.value)} /></label>
                              <label className="is-wide">交易附言 <small>请使用英文</small><input className={transactionReference && !isValidPaymentTransactionReference(transactionReference) ? 'is-invalid' : ''} aria-label="行内编辑交易附言" value={transactionReference} maxLength={140} placeholder="English only, max 140 characters" onChange={(event) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'transactionReference', event.target.value)} />{transactionReference && !isValidPaymentTransactionReference(transactionReference) ? <em>仅支持英文、数字和常用英文标点</em> : null}</label>
                            </div>
                          )}
                        </div>
                      </section>
                    ) : null}
                    <footer className="payment-list-overview-row-footer"><span>{generationFailed ? 'Airwallex 校验未通过 · 请查看并修正本笔明细' : itemIssues.length ? itemIssues[0] : `付款信息完整 · ${paymentListStatusLabel(list.status)}`}</span><span className="payment-list-overview-row-actions"><ListActionButton kind="view" onClick={() => togglePaymentRow(list, item.invoiceId, 'view')}>{expandedMode === 'view' ? '收起详情' : '查看本笔'}</ListActionButton>{rowCanEdit ? <ListActionButton kind="edit" onClick={() => togglePaymentRow(list, item.invoiceId, 'edit')}>{expandedMode === 'edit' ? '收起编辑' : '编辑本笔'}</ListActionButton> : null}</span></footer>
                  </article>
                );
              })}
              {!currentPaymentList ? <div className="project-resource-browser-empty"><WalletCards size={23} /><strong>付款单尚未生成</strong><p>请先关联 Invoice，再生成当前请款唯一的付款单。</p></div> : null}
              {currentPaymentList && !paymentItemCount ? <div className="project-resource-browser-empty"><WalletCards size={23} /><strong>付款单已清空</strong><p>点击“生成付款清单”可按当前关联的 Invoice 重新生成付款明细。</p></div> : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {paymentGenerationIssues ? (
        <Modal
          title="付款信息校验未通过"
          width="620px"
          className="payment-generation-issues-modal"
          onClose={() => setPaymentGenerationIssues(null)}
          footer={<Button onClick={() => setPaymentGenerationIssues(null)}>返回修改</Button>}
        >
          <div className="payment-generation-issues">
            <div className="payment-generation-issues-intro" role="alert">
              <CircleAlert size={19} aria-hidden="true" />
              <div><strong>Airwallex 付款信息完整性校验未通过</strong><p>请补齐以下字段后再次生成付款清单。本地开发环境调用同结构的 Airwallex Mock 代理。</p></div>
            </div>
            <div className="payment-generation-issue-list">
              {paymentGenerationIssues.map((group) => (
                <article className={group.invoiceId ? 'is-clickable' : ''} key={group.key}>
                  {group.invoiceId ? (
                    <button type="button" aria-label={`查看 ${group.creatorName} ${group.invoiceNumber} 未通过明细`} onClick={() => openPaymentGenerationIssue(group)}>
                      <span className="payment-generation-issue-heading"><span><strong>{group.creatorName}</strong><small>{group.invoiceNumber}</small></span><em>{group.issues.length} 项待补充</em></span>
                      <span className="payment-generation-issue-messages">{group.issues.map((issue) => <span key={issue}>{issue}</span>)}</span>
                      <span className="payment-generation-issue-jump">查看该笔明细 →</span>
                    </button>
                  ) : (
                    <div className="payment-generation-issue-static">
                      <span className="payment-generation-issue-heading"><span><strong>{group.creatorName}</strong><small>{group.invoiceNumber}</small></span><em>{group.issues.length} 项待补充</em></span>
                      <span className="payment-generation-issue-messages">{group.issues.map((issue) => <span key={issue}>{issue}</span>)}</span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}

      {resourceDialog === 'payment' && paymentEditorList ? (
        <Modal title={`${request.requestCode ?? request.id} · ${paymentEditorMode === 'view' ? '查看付款明细' : '编辑付款清单'}`} width="100%" className="payment-list-editor-modal" onClose={closePaymentEditor} footer={null}>
          {paymentEditorCloseWarning ? (
            <NoticeBanner onClose={() => setPaymentEditorCloseWarning(false)}>
              <strong>请完成付款信息校验</strong>
              <span>修改后的付款明细需要点击“重新校验”，校验通过后才能关闭此弹窗。</span>
            </NoticeBanner>
          ) : null}
          <PaymentListEditor
            list={paymentEditorList}
            initialInvoiceId={paymentEditorInvoiceId ?? undefined}
            invoices={invoices}
            contracts={contracts}
            creators={creators}
            editable={paymentEditorMode === 'edit' && canEditPaymentList && paymentEditorList.status === 'draft'}
            accountEditableInvoiceIds={failureEditableInvoiceIds}
            accountOverrideOnly={paymentFailureRecoveryMode}
            requestPaymentProvider={requestPaymentProvider}
            onUpdatePaymentItem={onUpdatePaymentItem}
            onChangePaymentAccount={onChangePaymentAccount}
            onRevalidatePaymentItem={onRevalidatePaymentItem}
            onClose={closePaymentEditor}
          />
        </Modal>
      ) : null}

      {notificationPayout || notificationReturnItem ? (
        <Modal
          title={notificationReturnItem ? '通知达人修改付款明细' : '发送付款失败通知'}
          width="560px"
          onClose={notificationReturnItem ? closePaymentListReturnNotification : closeFailureNotification}
          footer={(
            <>
              <Button variant="ghost" onClick={notificationReturnItem ? closePaymentListReturnNotification : closeFailureNotification}>取消</Button>
              <Button
                icon={<Send size={16} />}
                disabled={!notificationMessage.trim() || (Boolean(notificationReturnItem) && !onSendPaymentListReturnNotification)}
                disabledReason={!notificationMessage.trim() ? '请先填写通知内容。' : '当前流程不支持发送该通知。'}
                onClick={notificationReturnItem ? submitPaymentListReturnNotification : submitFailureNotification}
              >
                模拟发送
              </Button>
            </>
          )}
        >
          <div className="payment-failure-notification-dialog">
            <div className="payment-failure-notification-recipient">
              <strong>{notificationReturnCreator?.name ?? notificationPayout?.creator ?? '当前达人'}</strong>
              <span>
                {notificationReturnItem
                  ? `${notificationReturnInvoice?.id ?? notificationReturnItem.invoiceNumber} · ${paymentProviderDisplayName(request.paymentChannel)} · 退回修改`
                  : `${notificationPayout?.invoice} · ${paymentProviderDisplayName(notificationPayout?.provider)} · ${notificationPayout?.currency} ${notificationPayout?.amount.toLocaleString('en-US')}`}
              </span>
              {notificationReturnItem ? <small>退回原因：{notificationReturnItem.reason}</small> : null}
            </div>
            <div className="payment-failure-notification-channels" aria-label="模拟通知渠道">
              <span><Send size={15} aria-hidden="true" />站内信</span>
              <span><Mail size={15} aria-hidden="true" />Gmail</span>
            </div>
            <label className="return-review-field">
              <span>通知内容 <em className="required-mark" aria-hidden="true">*</em><small>{notificationMessage.length}/300</small></span>
              <textarea
                autoFocus
                maxLength={300}
                aria-label={notificationReturnItem ? '付款清单退回通知内容' : '付款失败通知内容'}
                value={notificationMessage}
                onChange={(event) => setNotificationMessage(event.target.value)}
              />
              <small>当前仅模拟发送并保留通知记录，不会真实触发站内信或 Gmail。</small>
            </label>
          </div>
        </Modal>
      ) : null}

      {linkDialog ? (
        <Modal title={linkDialog === 'contract' ? '关联已有合同' : '关联已有 Invoice'} width="920px" className="project-resource-modal request-resource-link-modal" onClose={() => { setLinkDialog(null); setResourceDialog(linkDialog); }} footer={<><Button variant="secondary" onClick={() => { setLinkDialog(null); setResourceDialog(linkDialog); }}>取消</Button><Button disabled={!selectedCandidateIds.length} disabledReason={`请先选择要关联的${linkDialog === 'contract' ? '合同' : ' Invoice'}。`} onClick={commitCandidates}>关联已选（{selectedCandidateIds.length}）</Button></>}>
          <div className="project-resource-browser"><div className="project-resource-browser-heading"><div><strong>{linkDialog === 'contract' ? '合同候选' : 'Invoice 候选'}</strong><p>{linkDialog === 'contract' ? '展示当前合作项目下、属于本次请款达人的合同，可一次关联多份。' : '展示当前合作项目下全部达人的 Invoice；关联项目外达人时，会同步加入请款。'}</p></div><span>{linkDialog === 'contract' ? filteredContractCandidates.length : filteredInvoiceCandidates.length} 条</span></div><div className="request-resource-candidate-filter"><div><strong>按达人筛选</strong><small>{linkDialog === 'contract' ? '同一合作项目可以关联同一达人的多份合同' : 'Invoice 候选范围不会受当前请款达人名单限制'}</small></div><SearchableComboBox
            ariaLabel={linkDialog === 'contract' ? '合同候选达人筛选' : 'Invoice 候选达人筛选'}
            className="creator-search-combobox request-resource-creator-search"
            value={linkDialog === 'contract' ? contractCreatorFilter : invoiceCreatorFilter}
            options={linkDialog === 'contract' ? contractCreatorOptions : invoiceCreatorOptions}
            placeholder="搜索达人名称、频道 ID、频道链接…"
            resultUnit="位达人"
            onChange={linkDialog === 'contract' ? setContractCreatorFilter : setInvoiceCreatorFilter}
            onClear={() => (linkDialog === 'contract' ? setContractCreatorFilter('ALL') : setInvoiceCreatorFilter('ALL'))}
            renderOption={(option) => {
              if (option.value === 'ALL') return <span><strong>{option.label}</strong><small>{option.description}</small></span>;
              const creator = creatorFor(option.value, creators);
              const contract = linkDialog === 'contract'
                ? availableContractCandidates.find((candidate) => candidate.creatorId === option.value)
                : undefined;
              const invoice = linkDialog === 'invoice'
                ? availableInvoiceCandidates.find((candidate) => candidate.snapshot.creatorId === option.value)
                : undefined;
              return <span className="request-resource-creator-search-option"><CreatorIdentity creator={creator} displayName={option.label} fallbackHandle={contract?.creatorHandle ?? invoice?.snapshot.creatorHandle} fallbackPlatform={contract?.creatorPlatform ?? contract?.platform ?? invoice?.snapshot.creatorPlatform} socialAccountsMode="expanded" /><small>{option.description}</small></span>;
            }}
          /></div><div className="request-resource-candidate-list">
            {linkDialog === 'contract' ? filteredContractCandidates.map((contract) => {
              const id = contractStableId(contract);
              const creator = contract.creatorId ? creatorFor(contract.creatorId, creators) : undefined;
              const currentLink = contract.creatorId ? linkByCreator.get(contract.creatorId) : undefined;
              const unavailableReason = contractAssociationUnavailableReason(contract, links, creators, cooperationProjectId);
              const enabled = !unavailableReason;
              const selected = selectedCandidateIds.includes(id);
              return <article className={`request-resource-candidate${enabled ? '' : ' is-disabled'}`} key={id}><label><input type="checkbox" aria-label={`选择合同 ${contract.id}`} disabled={!enabled} checked={selected} onChange={() => toggleCandidate(id)} /><span><strong>{contract.id}</strong><small><span className={`contract-type-badge contract-type-${getContractType(contract).toLowerCase()}`}>{CONTRACT_TYPE_LABELS[getContractType(contract)]}</span> {contract.name}</small>{contract.frameworkContractId ? <small>框架：{contract.frameworkContractId}</small> : null}</span></label><div className="request-resource-candidate-creator"><CreatorIdentity creator={creator} displayName="达人档案缺失" fallbackHandle={contract.creatorHandle} fallbackPlatform={contract.creatorPlatform ?? contract.platform} />{enabled && currentLink ? <span className="is-existing">已在请款</span> : null}</div><div><strong>{enabled ? '可关联' : '不可关联'}</strong><small>{enabled ? `${formatContractMoney(contract)} · 当前合作项目` : unavailableReason}</small></div><ListActionButton kind="view" onClick={() => onOpenContract(contract.id)}>查看合同详情</ListActionButton></article>;
            }) : filteredInvoiceCandidates.map((invoice) => {
              const creator = invoice.snapshot.creatorId ? creatorFor(invoice.snapshot.creatorId, creators) : undefined;
              const currentLink = invoice.snapshot.creatorId ? linkByCreator.get(invoice.snapshot.creatorId) : undefined;
              const selectedInvoiceId = invoice.snapshot.creatorId
                ? selectedInvoiceIdByCreator.get(invoice.snapshot.creatorId)
                : undefined;
              const unavailableReason = invoiceUnavailableReason(invoice) || (
                selectedInvoiceId && selectedInvoiceId !== invoice.invoiceId
                  ? '本次已为该达人选择一份 Invoice，请先取消后再选择'
                  : ''
              );
              const enabled = !unavailableReason;
              const selected = selectedCandidateIds.includes(invoice.invoiceId);
              return <article className={`request-resource-candidate${enabled ? '' : ' is-disabled'}`} key={invoice.invoiceId}><label><input type="checkbox" aria-label={`选择 Invoice ${invoice.id}`} disabled={!enabled} checked={selected} onChange={() => toggleCandidate(invoice.invoiceId)} /><span><strong>{invoice.id}</strong><small>{invoice.status}</small></span></label><div className="request-resource-candidate-creator"><CreatorIdentity creator={creator} displayName={invoice.snapshot.creatorName} fallbackHandle={invoice.snapshot.creatorHandle} fallbackPlatform={invoice.snapshot.creatorPlatform} />{enabled ? currentLink ? <span className="is-existing">已在请款</span> : <span>关联后新增达人</span> : null}</div><div><strong>{enabled ? formatInvoiceMoney(invoice.snapshot.currency, invoiceTotal(invoice.snapshot)) : '不可关联'}</strong><small>{enabled ? `${invoice.snapshot.contractIds?.length ?? 0} 份覆盖合同` : unavailableReason}</small></div><ListActionButton kind="view" onClick={() => onOpenInvoice(invoice.invoiceId)}>查看 Invoice</ListActionButton></article>;
            })}
            {linkDialog === 'contract' && !filteredContractCandidates.length ? <div className="request-resource-candidate-empty"><FileText size={22} /><strong>暂无符合条件的合同</strong><small>可切换达人查看该合作项目下的其他合同。</small></div> : null}
            {linkDialog === 'invoice' && !filteredInvoiceCandidates.length ? <div className="request-resource-candidate-empty"><ReceiptText size={22} /><strong>暂无符合条件的 Invoice</strong><small>可切换达人查看该合作项目下的其他 Invoice。</small></div> : null}
          </div></div>
        </Modal>
      ) : null}

      {confirmAction ? <Modal title={confirmAction.title} width="460px" className="project-payment-remove-modal" onClose={() => setConfirmAction(null)} footer={<><Button variant="secondary" onClick={() => setConfirmAction(null)}>取消</Button><Button variant={confirmAction.danger ? 'danger' : 'primary'} onClick={() => { confirmAction.run(); setConfirmAction(null); }}>{confirmAction.confirmLabel}</Button></>}><div className="project-payment-remove-confirmation"><span><AlertTriangle size={22} /></span><div><strong>请确认操作范围</strong><p>{confirmAction.description}</p><small>本原型的变更只保存在当前浏览器会话。</small></div></div></Modal> : null}
    </>
  );
}
