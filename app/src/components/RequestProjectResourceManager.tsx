import {
  AlertTriangle,
  CircleAlert,
  Download,
  Eraser,
  Eye,
  FilePlus2,
  FileText,
  Link2,
  Mail,
  Pencil,
  ReceiptText,
  RefreshCw,
  Send,
  Trash2,
  Unlink,
  Upload,
  UserCheck,
  WalletCards,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  invoicePaymentListProvider,
  paymentListEffectiveAccount,
  paymentListItemValue,
  validatePaymentListGeneration,
  type ContractId,
  type InvoiceId,
  type PaymentListEditableField,
  type PaymentListId,
  type PaymentListRecord,
} from '../businessWorkflow';
import { CONTRACT_TYPE_LABELS, formatContractMoney, frameworkContractLinkedToProject, getContractReadiness, getContractType, isConfirmedContract, isFrameworkContract, type ContractRecord, type ContractUploadInput } from '../contracts';
import type { SystemUser } from '../data';
import { canDeleteContract } from '../permissions';
import { formatInvoiceMoney, invoiceTotal } from '../invoice/invoiceUtils';
import {
  contractCooperationProjectId,
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
import {
  requestApprovalHasScopedReturnItems,
  requestApprovalReturnItemForInvoice,
} from '../requestApprovalWorkflow';
import type { CreatorProfile, GeneratedInvoiceRecord, Payout } from '../types';
import { Button, Modal, NoticeBanner, SelectField } from './Common';
import { ContractUploadWizard } from './ContractUploadWizard';
import { PaymentListEditor } from './PaymentListEditor';

type ResourceKind = 'contract' | 'invoice' | 'payment';
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
  onLinkFrameworkContractToProject: (contractId: ContractId, cooperationProjectId: string) => void;
  onUnlinkFrameworkContractFromProject: (contractId: ContractId, cooperationProjectId: string) => void;
  onDeleteInvoice: (invoiceId: InvoiceId) => void;
  onGeneratePaymentLists: () => void;
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
  onGeneratePaymentListVersion: (paymentListId: PaymentListId) => void;
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
  onLinkFrameworkContractToProject?: (request: RequestProjectSummary, contractId: ContractId, cooperationProjectId: string) => void;
  onUnlinkFrameworkContractFromProject?: (request: RequestProjectSummary, contractId: ContractId, cooperationProjectId: string) => void;
  onDeleteInvoice: (request: RequestProjectSummary, invoiceId: InvoiceId) => void;
  onClearPaymentLists: (request: RequestProjectSummary) => void;
  onRemovePaymentInvoice: (request: RequestProjectSummary, paymentListId: PaymentListId, invoiceId: InvoiceId) => void;
  onUpdatePaymentItem: (request: RequestProjectSummary, paymentListId: PaymentListId, invoiceId: InvoiceId, field: PaymentListEditableField, value: string | number) => void;
  onChangePaymentAccount: (request: RequestProjectSummary, paymentListId: PaymentListId, invoiceId: InvoiceId, payoutAccountId: string) => void;
  onRevalidatePaymentItem: (request: RequestProjectSummary, paymentListId: PaymentListId, invoiceId: InvoiceId) => void;
  onBeginEditPaymentList: (request: RequestProjectSummary, paymentListId: PaymentListId) => void;
  onGeneratePaymentListVersion: (request: RequestProjectSummary, paymentListId: PaymentListId) => void;
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

const contractUsedInRequestProjects = (
  contract: ContractRecord,
  requests: RequestProjectSummary[],
) => {
  if (isFrameworkContract(contract) && contract.frameworkProjectLinks?.some((link) => link.status !== 'ENDED')) {
    return true;
  }
  const contractIds = new Set(
    [contract.contractId, contract.id].filter((id): id is string => Boolean(id)),
  );
  return requests.some((request) => request.creatorLinks?.some((link) => (
    link.contractIds.some((contractId) => contractIds.has(contractId))
  )));
};

const creatorFor = (creatorId: string, creators: CreatorProfile[]) => (
  creators.find((creator) => creator.id === creatorId)
);

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
  !contract.isTemplate
  && (isFrameworkContract(contract) || contractCooperationProjectId(contract) === cooperationProjectId)
)) : [];

const contractStateUnavailableReason = (contract: ContractRecord) => {
  if (contract.lifecycle === 'GENERATED_DRAFT') return '草稿尚未回传签署文件';
  if (contract.lifecycle === 'UPLOADED_PENDING_CONFIRMATION') return '已上传，待人工确认';
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
  if (isFrameworkContract(contract)) {
    if (cooperationProjectId && frameworkContractLinkedToProject(contract, cooperationProjectId)) {
      return '框架合同已关联当前合作项目';
    }
    return isConfirmedContract(contract) ? '' : contractStateUnavailableReason(contract);
  }
  if (!contract.creatorId) return '合同缺少达人稳定 ID';
  if (!creatorFor(contract.creatorId, creators)) return '合同关联的达人档案不存在';
  if (!contract.engagementId) return '合同缺少合作关系 ID';
  const existingLink = links.find((link) => link.creatorId === contract.creatorId);
  if (existingLink && existingLink.engagementId !== contract.engagementId) {
    return '达人已通过其他合作关系加入当前请款项目';
  }
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
    if (!contract.contractId || !contract.creatorId || !contract.engagementId) return;
    const existingIndex = linkIndexByCreator.get(contract.creatorId);
    if (existingIndex !== undefined) {
      const existing = next[existingIndex];
      if (!existing || existing.engagementId !== contract.engagementId) return;
      existing.contractIds = [...new Set([...existing.contractIds, contract.contractId])];
      return;
    }
    next.push({
      creatorId: contract.creatorId,
      engagementId: contract.engagementId,
      contractIds: [contract.contractId],
      invoiceIds: [],
    });
    linkIndexByCreator.set(contract.creatorId, next.length - 1);
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
  const existingLink = links.find((link) => link.creatorId === invoice.snapshot.creatorId);
  if (existingLink && existingLink.engagementId !== invoice.snapshot.engagementId) {
    return '达人已通过其他合作关系加入当前请款项目';
  }
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
      existing.invoiceIds = [...new Set([...existing.invoiceIds, invoice.invoiceId])];
      return;
    }
    next.push({
      creatorId,
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
  const cooperationProjectId = request.cooperationProjectId ?? request.projectId;
  return contracts.filter((contract) => (
    ids.has(contractStableId(contract))
    || (isFrameworkContract(contract)
      && Boolean(cooperationProjectId)
      && frameworkContractLinkedToProject(contract, cooperationProjectId as string))
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

const requiredPaymentLabel = (label: string) => (
  <span className="project-payment-required-label">{label}<em aria-hidden="true">*</em></span>
);

export function RequestProjectResourceManager({
  request,
  cooperationProject,
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
  onGenerateContract,
  onGenerateInvoice,
  onUploadContract,
  onDeleteContract,
  onLinkFrameworkContractToProject,
  onUnlinkFrameworkContractFromProject,
  onDeleteInvoice,
  onGeneratePaymentLists,
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
  const [selectedLinkedInvoiceIds, setSelectedLinkedInvoiceIds] = useState<InvoiceId[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [notificationPayoutId, setNotificationPayoutId] = useState<string | null>(null);
  const [notificationReturnInvoiceId, setNotificationReturnInvoiceId] = useState<InvoiceId | null>(null);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [paymentEditorListId, setPaymentEditorListId] = useState<PaymentListId | null>(null);
  const [paymentEditorInvoiceId, setPaymentEditorInvoiceId] = useState<InvoiceId | null>(null);
  const [paymentEditorMode, setPaymentEditorMode] = useState<'view' | 'edit'>('edit');
  const [paymentEditorCloseWarning, setPaymentEditorCloseWarning] = useState(false);
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
    && payout.status !== '已付款'
  ));
  const canEdit = canEditRequestProjectResources(
    currentUser,
    request,
    paymentFailureRecoveryMode,
  );
  const hasScopedApprovalReturn = requestApprovalHasScopedReturnItems(request.approval);
  const hasScopedPaymentListReturn = Boolean(request.approval?.returnItems?.some((item) => (
    item.issueType === 'PAYMENT_LIST'
  )));
  const canEditLinkedResources = canEdit && !paymentFailureRecoveryMode && !hasScopedApprovalReturn;
  const canEditPaymentList = canEdit
    && !paymentFailureRecoveryMode
    && (!hasScopedApprovalReturn || hasScopedPaymentListReturn);
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

  const generateOrRefreshPaymentList = () => {
    if (currentPaymentList?.status === 'draft' && currentPaymentList.items.length) {
      onGeneratePaymentListVersion(currentPaymentList.paymentListId);
      return;
    }
    onGeneratePaymentLists();
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

  const contractCandidates = contractAssociationCandidates(contracts, cooperationProjectId);

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
        ? `Invoice 收款账户渠道与请款项目付款渠道 ${request.paymentChannel} 不一致`
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
      const frameworkAdditions = additions.filter((contract) => isFrameworkContract(contract));
      if (frameworkAdditions.length && !cooperationProjectId) return;
      frameworkAdditions.forEach((contract) => onLinkFrameworkContractToProject(contractStableId(contract), cooperationProjectId as string));
      const projectContractAdditions = additions.filter((contract) => !isFrameworkContract(contract));
      if (projectContractAdditions.length) {
        const next = mergeContractCandidateLinks(links, projectContractAdditions);
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
    const contract = contracts.find((candidate) => contractStableId(candidate) === contractId);
    if (contract && isFrameworkContract(contract)) {
      if (cooperationProjectId) onUnlinkFrameworkContractFromProject(contractId, cooperationProjectId);
      return;
    }
    onChangeLinks(links.map((link) => ({
      ...link,
      contractIds: link.contractIds.filter((id) => id !== contractId),
    })), `已解除合同 ${contractId} 与当前请款项目的关联`);
  };

  const unlinkInvoices = (invoiceIds: InvoiceId[]) => {
    if (!invoiceIds.length) return;
    const idSet = new Set(invoiceIds);
    onChangeLinks(links.map((link) => ({
      ...link,
      invoiceIds: link.invoiceIds.filter((id) => !idSet.has(id)),
    })), `已解除 ${invoiceIds.length} 份 Invoice 与当前请款项目的关联`);
    setSelectedLinkedInvoiceIds([]);
  };

  const linkedContractIds = new Set(linkedContracts.map(contractStableId));
  const linkedInvoiceIds = new Set(linkedInvoices.map((invoice) => invoice.invoiceId));
  const availableContractCandidates = contractCandidates.filter((contract) => !linkedContractIds.has(contractStableId(contract)));
  const contractCreatorOptions = [
    {
      value: 'ALL',
      label: '全部达人',
      description: `${availableContractCandidates.length} 份候选合同`,
    },
    ...[...new Set(availableContractCandidates.flatMap((contract) => (
      contract.creatorId ? [contract.creatorId] : []
    )))].map((creatorId) => {
      const creator = creatorFor(creatorId, creators);
      const count = availableContractCandidates.filter((contract) => contract.creatorId === creatorId).length;
      return {
        value: creatorId,
        label: creator?.name ?? creatorId,
        description: `${creator?.handle ?? '达人档案缺失'} · ${count} 份合同`,
      };
    }),
  ];
  const filteredContractCandidates = availableContractCandidates.filter((contract) => (
    contractCreatorFilter === 'ALL' || contract.creatorId === contractCreatorFilter
  ));
  const availableInvoiceCandidates = invoiceCandidates.filter((invoice) => !linkedInvoiceIds.has(invoice.invoiceId));
  const invoiceCreatorOptions = [
    {
      value: 'ALL',
      label: '全部达人',
      description: `${availableInvoiceCandidates.length} 份候选 Invoice`,
    },
    ...[...new Set(availableInvoiceCandidates.flatMap((invoice) => (
      invoice.snapshot.creatorId ? [invoice.snapshot.creatorId] : []
    )))].map((creatorId) => {
      const creator = creatorFor(creatorId, creators);
      const count = availableInvoiceCandidates.filter((invoice) => (
        invoice.snapshot.creatorId === creatorId
      )).length;
      return {
        value: creatorId,
        label: creator?.name ?? creatorId,
        description: `${creator?.handle ?? '达人档案缺失'} · ${count} 份 Invoice`,
      };
    }),
  ];
  const filteredInvoiceCandidates = availableInvoiceCandidates.filter((invoice) => (
    invoiceCreatorFilter === 'ALL' || invoice.snapshot.creatorId === invoiceCreatorFilter
  ));

  return (
    <>
      <div className="project-resource-list">
        <article className="project-resource-row">
          <span className="project-resource-icon"><FileText size={19} /></span>
          <div className="project-resource-copy"><div className="project-resource-heading"><h3 className="project-resource-label">合同</h3><span className="project-resource-count">{linkedContracts.length} 条可查看</span></div><strong>{linkedContracts.length ? `${linkedContracts.length} 份合同` : '未关联合同（选填）'}</strong><small>已关联记录全部平铺展示</small></div>
          <span className="project-resource-status"><i />{linkedContracts.length ? '已关联' : '未关联'}</span>
          <button className="text-link project-resource-summary-open" type="button" onClick={() => setResourceDialog('contract')}>查看合同</button>
        </article>
        <article className="project-resource-row project-resource-row-invoice">
          <span className="project-resource-icon"><ReceiptText size={19} /></span>
          <div className="project-resource-copy"><div className="project-resource-heading"><h3 className="project-resource-label">Invoice</h3><span className="project-resource-count">{linkedInvoices.length} 条可查看</span></div><strong>{linkedInvoices.length} 份 Invoice</strong><small>同一达人可关联多份 Invoice</small></div>
          <span className="project-resource-status"><i />{linkedInvoices.length ? '已关联' : '待补资料'}</span>
          <button className="text-link project-resource-summary-open" type="button" onClick={() => setResourceDialog('invoice')}>查看 Invoice</button>
        </article>
        <article className="project-resource-row project-resource-row-payment">
          <span className="project-resource-icon"><WalletCards size={19} /></span>
          <div className="project-resource-copy"><div className="project-resource-heading"><h3 className="project-resource-label">付款单</h3><span className="project-resource-count">{paymentItemCount} 条明细</span></div><strong>{currentPaymentList?.paymentListCode ?? '待生成'}</strong><small>一张付款单覆盖当前请款项目全部 Invoice</small></div>
          <span className="project-resource-status"><i />{currentPaymentList ? paymentListStatusLabel(currentPaymentList.status) : '未生成'}</span>
          <button className="text-link project-resource-summary-open" type="button" onClick={() => setResourceDialog('payment')}>查看清单</button>
        </article>
      </div>

      {hasScopedApprovalReturn ? (
        <NoticeBanner>财务已按明细指定修改范围：仅标记为 Invoice 原因或付款清单原因的对应记录可修改，其余资料保持锁定。</NoticeBanner>
      ) : !canEditLinkedResources && !paymentFailureRecoveryMode ? <NoticeBanner>当前账号在项目提交后仅可查看与导出资料。</NoticeBanner> : null}

      {resourceDialog === 'contract' ? (
        <Modal title={`${request.requestCode ?? request.id} · 合同资料`} width="1120px" className="project-resource-modal request-resource-modal" onClose={() => setResourceDialog(null)} footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}>
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading"><div><strong>全部合同</strong><p>平铺展示当前请款项目已关联的合同。</p></div><span>{linkedContracts.length} 份</span></div>
            {canEditLinkedResources ? <div className="project-resource-browser-toolbar"><Button variant="ghost" icon={<FilePlus2 size={15} />} onClick={onGenerateContract}>生成合同</Button><Button variant="ghost" icon={<Upload size={15} />} onClick={() => { setResourceDialog(null); setUploadOpen(true); }}>上传合同</Button><Button variant="secondary" icon={<Link2 size={15} />} onClick={() => openLinkDialog('contract')}>关联已有合同</Button></div> : null}
            <div className="request-resource-flat-list">
              {linkedContracts.map((contract) => {
                const creator = contract.creatorId ? creatorFor(contract.creatorId, creators) : undefined;
                const contractId = contractStableId(contract);
                const usedInRequest = contractUsedInRequestProjects(contract, requests);
                return <article className="request-resource-flat-row" key={contractId}><span className="project-contract-record-icon"><FileText size={18} /></span><div><strong>{contract.id}</strong><small>{contract.name}</small></div><div><span>达人</span><strong>{creator?.name ?? '达人档案缺失'}</strong><small>{creator ? `${creator.handle} · ${creator.platform}` : contract.creatorId}</small></div><div><span>合同 / IO</span><strong>{contract.ioId || 'IO 待补充'}</strong><small>{formatContractMoney(contract)}</small></div><span className="project-record-status"><i />{getContractReadiness(contract).label}</span><div className="project-contract-record-actions"><Button variant="secondary" icon={<Eye size={14} />} onClick={() => onOpenContract(contract.id)}>查看</Button>{canEditLinkedResources ? <><button type="button" onClick={() => setConfirmAction({ title: '解除合同关联', description: `合同 ${contract.id} 源记录会保留，仅从当前请款项目移除。`, confirmLabel: '确认解除', run: () => unlinkContract(contractId) })}><Unlink size={14} />解除</button>{canDeleteContract(currentUser, contract, { usedInRequest }) ? <button className="danger" type="button" onClick={() => setConfirmAction({ title: '删除合同源记录', description: `将删除 ${contract.id}；系统会同步清理请款项目关联并触发重新校验。`, confirmLabel: '删除合同', danger: true, run: () => onDeleteContract(contractId) })}><Trash2 size={14} />删除</button> : null}</> : null}</div></article>;
              })}
              {!linkedContracts.length ? <div className="project-resource-browser-empty"><FileText size={23} /><strong>当前请款项目未关联合同</strong><p>合同选填，可上传、生成或关联已有记录。</p></div> : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {resourceDialog === 'invoice' ? (
        <Modal title={`${request.requestCode ?? request.id} · Invoice`} width="1080px" className="project-resource-modal request-resource-modal" onClose={() => setResourceDialog(null)} footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}>
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading"><div><strong>全部 Invoice</strong><p>平铺展示 {linkedInvoices.length} 份 Invoice，同一达人可关联多份。</p></div><span>{linkedInvoices.length} 份</span></div>
            {canEditLinkedResources ? <div className="project-resource-browser-toolbar"><Button variant="ghost" icon={<FilePlus2 size={15} />} onClick={onGenerateInvoice}>生成 Invoice</Button><Button variant="secondary" icon={<Link2 size={15} />} onClick={() => openLinkDialog('invoice')}>关联已有 Invoice</Button>{selectedLinkedInvoiceIds.length ? <Button variant="danger" icon={<Unlink size={15} />} onClick={() => setConfirmAction({ title: '批量解除 Invoice 关联', description: `将从当前请款项目移除 ${selectedLinkedInvoiceIds.length} 份 Invoice，源记录保留。`, confirmLabel: '确认解除', run: () => unlinkInvoices(selectedLinkedInvoiceIds) })}>解除已选</Button> : null}</div> : null}
            <div className="request-resource-flat-list">
              {linkedInvoices.map((invoice) => {
                const creator = invoice.snapshot.creatorId ? creatorFor(invoice.snapshot.creatorId, creators) : undefined;
                const selected = selectedLinkedInvoiceIds.includes(invoice.invoiceId);
                const invoiceReturn = requestApprovalReturnItemForInvoice(
                  request.approval,
                  invoice.invoiceId,
                  'INVOICE_CONTENT',
                );
                return <article className="request-resource-flat-row request-resource-invoice-row" key={invoice.invoiceId}>{canEditLinkedResources ? <label className="request-resource-select"><input type="checkbox" checked={selected} aria-label={`选择 ${invoice.id}`} onChange={() => setSelectedLinkedInvoiceIds((current) => selected ? current.filter((id) => id !== invoice.invoiceId) : [...current, invoice.invoiceId])} /></label> : <span className="project-contract-record-icon"><ReceiptText size={18} /></span>}<div><strong>{invoice.id}</strong><small>{invoice.status}</small></div><div><span>达人</span><strong>{creator?.name ?? invoice.snapshot.creatorName}</strong><small>{creator ? `${creator.handle} · ${creator.platform}` : invoice.snapshot.creatorHandle}</small></div><div><span>Invoice 金额</span><strong>{formatInvoiceMoney(invoice.snapshot.currency, invoiceTotal(invoice.snapshot))}</strong><small>{invoice.snapshot.contractIds?.length ?? 0} 份覆盖合同</small></div><span className={`project-record-status${invoiceReturn ? ' is-warning' : ''}`}><i />{invoiceReturn ? '需修改 Invoice' : invoice.validationStatus === 'valid' ? '已通过' : '需重新校验'}</span><div className="project-contract-record-actions"><Button variant="secondary" icon={invoiceReturn ? <Pencil size={14} /> : <Eye size={14} />} onClick={() => onOpenInvoice(invoice.invoiceId)}>{invoiceReturn ? '打开修改' : '查看'}</Button>{canEditLinkedResources ? <><button type="button" onClick={() => setConfirmAction({ title: '解除 Invoice 关联', description: `${invoice.id} 源记录会保留，对应付款行将移除。`, confirmLabel: '确认解除', run: () => unlinkInvoices([invoice.invoiceId]) })}><Unlink size={14} />解除</button><button className="danger" type="button" onClick={() => setConfirmAction({ title: '删除 Invoice 源记录', description: `将删除 ${invoice.id}；若被其他项目引用，系统会阻止操作。`, confirmLabel: '删除 Invoice', danger: true, run: () => onDeleteInvoice(invoice.invoiceId) })}><Trash2 size={14} />删除</button></> : null}</div></article>;
              })}
              {!linkedInvoices.length ? <div className="project-resource-browser-empty"><ReceiptText size={23} /><strong>当前请款项目未关联 Invoice</strong><p>每位达人提交审批前至少需要一份 Invoice。</p></div> : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {resourceDialog === 'payment' && !paymentEditorList ? (
        <Modal title={`${request.requestCode ?? request.id} · 付款单`} width="1120px" className="project-resource-modal request-resource-modal" onClose={() => setResourceDialog(null)} footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}>
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading"><div><strong>{currentPaymentList?.paymentListCode ?? '付款单待生成'}</strong><p>一张付款单包含全部 Invoice；当前请款项目固定使用 {request.paymentChannel || '待确认'}。</p></div><span>{paymentItemCount} 笔</span></div>
            {canEdit || currentPaymentList ? (
              <div className="project-resource-browser-toolbar request-payment-toolbar">
                {canEditLinkedResources && currentPaymentList ? <Button variant="danger" icon={<Eraser size={15} />} disabled onClick={() => setConfirmAction({ title: '清空付款清单', description: `将清空当前付款清单的 ${paymentItemCount} 笔付款行。清单编号和历史版本保留，Invoice 源记录不受影响。`, confirmLabel: '确认清空', danger: true, run: onClearPaymentLists })}>清空清单</Button> : null}
                {currentPaymentList ? <Button variant="secondary" icon={<Download size={15} />} disabled={!paymentListExportable} onClick={() => { void onExportPaymentList(currentPaymentList.paymentListId); }}>导出 Excel</Button> : null}
                {canEditPaymentList && currentPaymentList && (canEditSubmittedPaymentList || !['submitted', 'approved', 'paid'].includes(currentPaymentList.status)) ? <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => openPaymentEditor(currentPaymentList.paymentListId)}>编辑付款清单</Button> : null}
                {canEditLinkedResources ? <Button icon={<RefreshCw size={15} />} disabled={!paymentListReady || currentPaymentList?.status !== 'draft'} title={currentPaymentList?.status !== 'draft' ? '已生成的付款清单已锁定，请点击编辑付款清单后再修改' : paymentListReady ? '生成付款清单' : `还有 ${paymentListIssues.length} 项付款信息待完善`} onClick={generateOrRefreshPaymentList}>生成付款清单</Button> : null}
              </div>
            ) : null}
            {paymentFailureRecoveryMode ? <NoticeBanner>付款失败恢复中：已付款明细保持冻结，仅失败明细可修改或重新校验。</NoticeBanner> : null}
            {hasScopedApprovalReturn && hasScopedPaymentListReturn ? <NoticeBanner>仅财务标记为“付款清单原因”的明细可修改，其他付款明细已通过并保持锁定。</NoticeBanner> : null}
            {!paymentListReady && currentPaymentList?.items.length ? <div className="payment-list-overview-guidance" role="status"><CircleAlert size={17} /><div><strong>付款清单尚未完成</strong><span>请点击“编辑付款清单”逐笔完善付款明细，完成 {paymentListIssues.length} 项校验后才能生成。</span></div></div> : null}
            <div className="payment-list-overview-rows">
              {currentPaymentList?.items.map((item) => {
                const list = currentPaymentList;
                const effectiveAccount = paymentListEffectiveAccount(item);
                const invoice = invoices.find((candidate) => candidate.invoiceId === item.invoiceId);
                const linkedPayout = invoice
                  ? payouts.find((payout) => (
                      payout.id === invoice.sourcePayoutId
                    ))
                  : undefined;
                const failurePayout = linkedPayout?.paymentFailureRecovery && linkedPayout.status !== '已付款'
                  ? linkedPayout
                  : undefined;
                const paymentListReturn = requestApprovalReturnItemForInvoice(
                  request.approval,
                  item.invoiceId,
                  'PAYMENT_LIST',
                );
                const recovery = failurePayout?.paymentFailureRecovery;
                const focused = failurePayout?.id === focusedFailurePayoutId;
                const itemIssues = validatePaymentListGeneration({ ...list, items: [item] }, [item.invoiceId])
                  .filter((issue) => issue.code === 'INVALID_ITEM')
                  .map((issue) => issue.message.replace(`${item.snapshot.invoiceNumber}：`, ''));
                return (
                  <article
                    className={`payment-list-overview-row${failurePayout ? ' is-payment-failure' : ''}${focused ? ' is-failure-focused' : ''}`}
                    id={`request-payment-row-${item.invoiceId}`}
                    key={`${list.paymentListId}-${item.invoiceId}`}
                    tabIndex={focused ? -1 : undefined}
                  >
                    <header className="payment-list-overview-row-header">
                      <div><strong>{item.snapshot.creatorName}</strong><span>{item.snapshot.invoiceNumber} · {list.paymentListCode} · {effectiveAccount.provider}</span></div>
                      <span className={`payment-list-overview-state ${itemIssues.length ? 'is-warning' : 'is-ready'}`}>{itemIssues.length ? '待完善' : '已完成'}</span>
                    </header>
                    <div className="payment-list-overview-row-summary"><span>付款账户 <b>{effectiveAccount.accountSummary || '待选择'}</b></span><span>金额 <b>{paymentListItemValue(item, 'currency')} {Number(paymentListItemValue(item, 'amount')).toLocaleString('en-US')}</b></span><span>交易附言 <b>{paymentListItemValue(item, 'transactionReference') || '待填写'}</b></span></div>
                    {paymentListReturn ? (
                      <div className="request-approval-return-item-note" role="note">
                        <AlertTriangle size={15} />
                        <span><strong>退回原因：</strong>{paymentListReturn.reason}</span>
                        {canEditPaymentList && onSendPaymentListReturnNotification ? (
                          <Button
                            variant="ghost"
                            icon={<Send size={14} />}
                            onClick={() => openPaymentListReturnNotification(item.invoiceId, paymentListReturn)}
                          >
                            通知达人
                          </Button>
                        ) : null}
                        {canEditPaymentList && onSimulatePaymentListReturnAccountUpdate ? (
                          <Button
                            variant="ghost"
                            icon={<UserCheck size={14} />}
                            disabled={!paymentListReturn.notifications?.length || Boolean(paymentListReturn.accountUpdate)}
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
                            <Button variant="secondary" icon={<Send size={15} />} disabled={recovery.status === 'RETRY_SUBMITTED'} onClick={() => openFailureNotification(failurePayout)}>发送失败通知</Button>
                            <Button
                              variant="ghost"
                              icon={<UserCheck size={15} />}
                              disabled={!recovery.notifications.length || !['AWAITING_CREATOR_UPDATE', 'READY_FOR_RETRY'].includes(recovery.status)}
                              onClick={() => onSimulatePaymentFailureAccountUpdate?.(failurePayout.id)}
                            >
                              模拟达人已更新账户
                            </Button>
                            <Button
                              icon={<RefreshCw size={15} />}
                              disabled={recovery.status !== 'CREATOR_UPDATED'}
                              onClick={() => onRevalidatePaymentFailureAccount?.(failurePayout.id)}
                            >
                              重新校验
                            </Button>
                          </div>
                        ) : null}
                      </section>
                    ) : null}
                    {recovery ? <div className="payment-list-overview-recovery">{paymentFailureRecoveryLabel(failurePayout!)} · {recovery.status}</div> : null}
                    <footer className="payment-list-overview-row-footer"><span>{itemIssues.length ? itemIssues[0] : `付款信息完整 · ${paymentListStatusLabel(list.status)}`}</span><span className="payment-list-overview-row-actions">{canEditPaymentList && canEditSubmittedPaymentList && ['submitted', 'approved', 'paid'].includes(list.status) ? <button type="button" className="text-link" onClick={() => openPaymentEditor(list.paymentListId, item.invoiceId, 'view')}>查看本笔</button> : null}<button type="button" className="text-link" onClick={() => openPaymentEditor(list.paymentListId, item.invoiceId, canEditPaymentList && (!['submitted', 'approved', 'paid'].includes(list.status) || canEditSubmittedPaymentList) ? 'edit' : 'view')}>{canEditPaymentList && (!['submitted', 'approved', 'paid'].includes(list.status) || canEditSubmittedPaymentList) ? '编辑本笔' : '查看本笔'}</button></span></footer>
                  </article>
                );
              })}
              {!currentPaymentList ? <div className="project-resource-browser-empty"><WalletCards size={23} /><strong>付款单尚未生成</strong><p>请先关联 Invoice，再生成当前请款项目唯一的付款单。</p></div> : null}
              {currentPaymentList && !paymentItemCount ? <div className="project-resource-browser-empty"><WalletCards size={23} /><strong>付款单已清空</strong><p>点击“生成付款清单”可按当前关联的 Invoice 重新生成付款明细。</p></div> : null}
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
                  ? `${notificationReturnInvoice?.id ?? notificationReturnItem.invoiceNumber} · ${request.paymentChannel || '付款渠道待确认'} · 退回修改`
                  : `${notificationPayout?.invoice} · ${notificationPayout?.provider} · ${notificationPayout?.currency} ${notificationPayout?.amount.toLocaleString('en-US')}`}
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
        <Modal title={linkDialog === 'contract' ? '关联已有合同' : '关联已有 Invoice'} width="920px" className="project-resource-modal request-resource-link-modal" onClose={() => { setLinkDialog(null); setResourceDialog(linkDialog); }} footer={<><Button variant="secondary" onClick={() => { setLinkDialog(null); setResourceDialog(linkDialog); }}>取消</Button><Button disabled={!selectedCandidateIds.length} onClick={commitCandidates}>关联已选（{selectedCandidateIds.length}）</Button></>}>
          <div className="project-resource-browser"><div className="project-resource-browser-heading"><div><strong>{linkDialog === 'contract' ? '合同候选' : 'Invoice 候选'}</strong><p>{linkDialog === 'contract' ? '展示当前合作项目下全部达人的合同；关联项目外达人合同时，会同步将该达人加入请款项目。' : '展示当前合作项目下全部达人的 Invoice；关联项目外达人时，会同步加入请款项目。'}</p></div><span>{linkDialog === 'contract' ? filteredContractCandidates.length : filteredInvoiceCandidates.length} 条</span></div><div className="request-resource-candidate-filter"><div><strong>按达人筛选</strong><small>{linkDialog === 'contract' ? '合同候选范围不会受当前请款项目达人名单限制' : 'Invoice 候选范围不会受当前请款项目达人名单限制'}</small></div>{linkDialog === 'contract' ? <SelectField ariaLabel="合同候选达人筛选" variant="form" value={contractCreatorFilter} options={contractCreatorOptions} onChange={setContractCreatorFilter} /> : <SelectField ariaLabel="Invoice 候选达人筛选" variant="form" value={invoiceCreatorFilter} options={invoiceCreatorOptions} onChange={setInvoiceCreatorFilter} />}</div><div className="request-resource-candidate-list">
            {linkDialog === 'contract' ? filteredContractCandidates.map((contract) => {
              const id = contractStableId(contract);
              const creator = contract.creatorId ? creatorFor(contract.creatorId, creators) : undefined;
              const currentLink = contract.creatorId ? linkByCreator.get(contract.creatorId) : undefined;
              const unavailableReason = contractAssociationUnavailableReason(contract, links, creators, cooperationProjectId);
              const enabled = !unavailableReason;
              const selected = selectedCandidateIds.includes(id);
              return <article className={`request-resource-candidate${enabled ? '' : ' is-disabled'}`} key={id}><label><input type="checkbox" aria-label={`选择合同 ${contract.id}`} disabled={!enabled} checked={selected} onChange={() => toggleCandidate(id)} /><span><strong>{contract.id}</strong><small><span className={`contract-type-badge contract-type-${getContractType(contract).toLowerCase()}`}>{CONTRACT_TYPE_LABELS[getContractType(contract)]}</span> {contract.name}</small>{contract.frameworkContractId ? <small>框架：{contract.frameworkContractId}</small> : null}</span></label><div className="request-resource-candidate-creator"><strong>{creator?.name ?? (isFrameworkContract(contract) ? '跨项目框架合同' : '达人档案缺失')}</strong><small>{creator ? `${creator.handle} · ${creator.platform}` : contract.creatorId}</small>{enabled ? isFrameworkContract(contract) ? <span>可复用到当前项目</span> : currentLink ? <span className="is-existing">已在请款项目</span> : <span>关联后新增达人</span> : null}</div><div><strong>{enabled ? '可关联' : '不可关联'}</strong><small>{enabled ? `${formatContractMoney(contract)} · ${getContractReadiness(contract).label}` : unavailableReason}</small></div><button className="text-link" type="button" onClick={() => onOpenContract(contract.id)}>查看合同详情</button></article>;
            }) : filteredInvoiceCandidates.map((invoice) => {
              const creator = invoice.snapshot.creatorId ? creatorFor(invoice.snapshot.creatorId, creators) : undefined;
              const currentLink = invoice.snapshot.creatorId ? linkByCreator.get(invoice.snapshot.creatorId) : undefined;
              const unavailableReason = invoiceUnavailableReason(invoice);
              const enabled = !unavailableReason;
              const selected = selectedCandidateIds.includes(invoice.invoiceId);
              return <article className={`request-resource-candidate${enabled ? '' : ' is-disabled'}`} key={invoice.invoiceId}><label><input type="checkbox" aria-label={`选择 Invoice ${invoice.id}`} disabled={!enabled} checked={selected} onChange={() => toggleCandidate(invoice.invoiceId)} /><span><strong>{invoice.id}</strong><small>{invoice.status}</small></span></label><div className="request-resource-candidate-creator"><strong>{creator?.name ?? invoice.snapshot.creatorName}</strong><small>{creator ? `${creator.handle} · ${creator.platform}` : invoice.snapshot.creatorHandle}</small>{enabled ? currentLink ? <span className="is-existing">已在请款项目</span> : <span>关联后新增达人</span> : null}</div><div><strong>{enabled ? formatInvoiceMoney(invoice.snapshot.currency, invoiceTotal(invoice.snapshot)) : '不可关联'}</strong><small>{enabled ? `${invoice.snapshot.contractIds?.length ?? 0} 份覆盖合同` : unavailableReason}</small></div><button className="text-link" type="button" onClick={() => onOpenInvoice(invoice.invoiceId)}>查看 Invoice</button></article>;
            })}
            {linkDialog === 'contract' && !filteredContractCandidates.length ? <div className="request-resource-candidate-empty"><FileText size={22} /><strong>暂无符合条件的合同</strong><small>可切换达人查看该合作项目下的其他合同。</small></div> : null}
            {linkDialog === 'invoice' && !filteredInvoiceCandidates.length ? <div className="request-resource-candidate-empty"><ReceiptText size={22} /><strong>暂无符合条件的 Invoice</strong><small>可切换达人查看该合作项目下的其他 Invoice。</small></div> : null}
          </div></div>
        </Modal>
      ) : null}

      {uploadOpen ? <ContractUploadWizard projects={[cooperationProject]} creators={creators} contracts={contracts} onClose={() => { setUploadOpen(false); setResourceDialog('contract'); }} onSave={(inputs) => { const records = onUploadContract(inputs); setUploadOpen(false); if (records[0]) onOpenContract(records[0].id); }} /> : null}

      {confirmAction ? <Modal title={confirmAction.title} width="460px" className="project-payment-remove-modal" onClose={() => setConfirmAction(null)} footer={<><Button variant="secondary" onClick={() => setConfirmAction(null)}>取消</Button><Button variant={confirmAction.danger ? 'danger' : 'primary'} onClick={() => { confirmAction.run(); setConfirmAction(null); }}>{confirmAction.confirmLabel}</Button></>}><div className="project-payment-remove-confirmation"><span><AlertTriangle size={22} /></span><div><strong>请确认操作范围</strong><p>{confirmAction.description}</p><small>本原型的变更只保存在当前浏览器会话。</small></div></div></Modal> : null}
    </>
  );
}
