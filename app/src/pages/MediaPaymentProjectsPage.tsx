import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Circle,
  FileText,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Send,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { createPortal } from 'react-dom';
import './MediaPaymentProjectsPage.css';
import { Avatar, Button, ListActionButton, Modal, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { ContractDocumentView } from '../components/ContractDocumentView';
import { InvoiceDocumentView } from '../components/InvoiceDocumentView';
import { Pagination, usePagination } from '../components/Pagination';
import { RequestRemarkAttachments } from '../components/RequestRemarkAttachments';
import { RequestProjectInfoCard } from '../components/RequestProjectInfoCard';
import { paymentProviderDisplayName, PaymentProviderBadge } from '../components/PaymentProviderBadge';
import {
  canEditRequestProjectResources,
  RequestProjectResourceManager,
  type RequestProjectResourceActions,
} from '../components/RequestProjectResourceManager';
import { formatContractMoney, getContractValidity, isContractAvailableForNewAssociation, type ContractRecord } from '../contracts';
import { PM_USERS, type SystemUser } from '../data';
import {
  createPrototypeCode,
  createPrototypeId,
  invoicePaymentListProvider,
  paymentListEffectiveAccount,
  type ContractId,
  type CooperationProjectId,
  type CreatorId,
  type InvoiceId,
  type PaymentListRecord,
  type PaymentRequestProjectId,
  type ProjectId,
} from '../businessWorkflow';
import {
  addInvoiceToPaymentRequestSelection,
  canAddCreatorToPaymentRequest,
  canCancelPaymentRequest,
  cooperationProjectIdFor,
  createEmptyPaymentRequestListFilters,
  DEFAULT_PAYMENT_REQUEST_COST_TYPE,
  filterPaymentRequestList,
  invoiceAmountLabel,
  myProjectStatusFor,
  mergePaymentRequestRemarkAttachments,
  normalizePaymentRequestCostType,
  PAYMENT_REQUEST_COST_TYPES,
  paymentRequestAmount,
  paymentRequestAmountLabel,
  paymentRequestCreatorPresentation,
  paymentRequestDraftCreatorsReady,
  paymentRequestHasPaymentActivity,
  paymentRequestInvoiceIds,
  paymentRequestListMetrics,
  paymentRequestPaymentPlanFor,
  paymentRequestPaymentPlanIssues,
  paymentRequestExtraDetailIssues,
  paymentRequestProviderForChannel,
  paymentRequestSubmissionIssues,
  resolveCreatorDocuments,
  type MyProjectStatus,
  type PaymentRequestCostType,
  type PaymentRequestCreatorLink,
  type PaymentRequestPaymentChannel,
  type PaymentRequestRemarkAttachment,
} from '../paymentRequestProjects';
import { paymentFailureRecoveryLabel } from '../paymentFailureRecovery';
import type { CreatorProfile, GeneratedInvoiceRecord, Payout } from '../types';
import { CreatorIdentity } from '../components/CreatorIdentity';
import {
  creatorSearchTerms,
  resolveCreatorSocialAccount,
} from '../creatorSearchOptions';
import {
  requestApprovalHasScopedReturnItems,
  requestApprovalReturnDetails,
} from '../requestApprovalWorkflow';
import {
  ProjectInlineFilterPanel,
  ProjectStatus,
  type ProjectListFilters,
} from './OperationalPages';
import type { ProjectSummary } from './ProjectDetailPage';
import type { RequestProjectSummary } from './RequestProjectDetailPage';
import { downloadBlob } from '../invoice/invoiceUtils';

type Notify = (title: string, message: string) => void;

const STATUS_COPY = {
  READY: '可选择多份 Invoice',
  MISSING_INVOICE: '该合作项目下暂无此达人 Invoice',
  INVOICE_NOT_APPROVED: '该合作项目下的 Invoice 尚未完成签署和审核',
  INVOICE_IN_USE: '可用 Invoice 均已关联其他请款项目',
} as const;

const PAYMENT_CHANNEL_OPTIONS = [
  { value: 'Airwallex', label: 'Airwallex', description: '跨境银行转账' },
  { value: 'PayPal', label: 'PayPal', description: 'PayPal 账户付款' },
  { value: 'Payermax', label: 'Payer Max', description: '本地支付网络' },
] as const;

const COST_TYPE_OPTIONS = PAYMENT_REQUEST_COST_TYPES.map((costType) => ({
  value: costType,
  label: costType,
}));

const REMARK_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const actualPayoutAmountLabel = (payout?: Payout) => {
  if (!payout || payout.status !== '已付款') return '—';
  return `${payout.currency} ${payout.amount.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(payout.amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

const fileDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result ?? ''));
  reader.onerror = () => reject(reader.error ?? new Error('无法读取截图'));
  reader.readAsDataURL(file);
});

type RequestResourcePickerOption = {
  value: string;
  label: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  resource: RequestResourceDocument;
};

type RequestResourceDocument =
  | { kind: 'invoice'; invoice: GeneratedInvoiceRecord }
  | { kind: 'contract'; contract: ContractRecord };

type RequestResourceAnchor = Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left'>;

type RequestResourcePreview = {
  resource: RequestResourceDocument;
  anchor: RequestResourceAnchor;
};

const REQUEST_RESOURCE_PREVIEW_DELAY_MS = 300;
const REQUEST_RESOURCE_PREVIEW_WIDTH = 344;
const REQUEST_RESOURCE_PREVIEW_HEIGHT = 430;
const REQUEST_RESOURCE_PREVIEW_GAP = 12;

export const invoiceRequestResourceTitle = (
  invoice: Pick<GeneratedInvoiceRecord, 'id'> & { snapshot: Pick<GeneratedInvoiceRecord['snapshot'], 'projectName'> },
  fallbackProjectName?: string,
) => `${invoice.id} · ${(invoice.snapshot.projectName ?? '').trim() || fallbackProjectName?.trim() || '未关联项目'}`;

export const contractRequestResourceTitle = (contract: Pick<ContractRecord, 'name'>) => (
  (contract.name ?? '').trim() || '未命名合同'
);

export const positionRequestResourcePreview = (
  anchor: RequestResourceAnchor,
  viewport: { width: number; height: number },
) => {
  const margin = REQUEST_RESOURCE_PREVIEW_GAP;
  const preferredRight = anchor.right + REQUEST_RESOURCE_PREVIEW_GAP;
  const preferredLeft = anchor.left - REQUEST_RESOURCE_PREVIEW_WIDTH - REQUEST_RESOURCE_PREVIEW_GAP;
  const left = preferredRight + REQUEST_RESOURCE_PREVIEW_WIDTH <= viewport.width - margin
    ? preferredRight
    : Math.max(margin, Math.min(preferredLeft, viewport.width - REQUEST_RESOURCE_PREVIEW_WIDTH - margin));
  const top = Math.max(
    margin,
    Math.min(anchor.top, viewport.height - REQUEST_RESOURCE_PREVIEW_HEIGHT - margin),
  );
  return { left, top };
};

export const sortRequestResourcePickerOptions = <T extends Pick<RequestResourcePickerOption, 'selected' | 'disabled'>>(
  options: T[],
) => options
  .map((option, index) => ({ option, index }))
  .sort((left, right) => {
    const leftDisabled = Boolean(left.option.disabled && !left.option.selected);
    const rightDisabled = Boolean(right.option.disabled && !right.option.selected);
    if (leftDisabled !== rightDisabled) return leftDisabled ? 1 : -1;
    return left.index - right.index;
  })
  .map(({ option }) => option);

function RequestResourcePicker({
  id,
  kind,
  creatorName,
  open,
  selectedCount,
  options,
  emptyCopy,
  onOpenChange,
  onToggle,
  onPreview,
  onPreviewClose,
  onOpenDocument,
}: {
  id: string;
  kind: 'invoice' | 'contract';
  creatorName: string;
  open: boolean;
  selectedCount: number;
  options: RequestResourcePickerOption[];
  emptyCopy: string;
  onOpenChange: (open: boolean) => void;
  onToggle: (value: string, selected: boolean) => void;
  onPreview: (resource: RequestResourceDocument, anchor: DOMRect) => void;
  onPreviewClose: () => void;
  onOpenDocument: (resource: RequestResourceDocument) => void;
}) {
  const previewTimerRef = useRef<number | null>(null);
  const isInvoice = kind === 'invoice';
  const label = isInvoice ? 'Invoice' : '合同';
  const ResourceIcon = isInvoice ? ReceiptText : FileText;
  const helper = isInvoice
    ? '关联已录入系统的 Invoice，可多选'
    : '仅已确认合同可关联，可多选';
  const selectedCopy = selectedCount
    ? `已选择 ${selectedCount} 份${isInvoice ? ' Invoice' : '合同'}`
    : helper;
  const sortedOptions = sortRequestResourcePickerOptions(options);

  const cancelPreviewTimer = () => {
    if (previewTimerRef.current === null) return;
    window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = null;
  };

  const closePreview = () => {
    cancelPreviewTimer();
    onPreviewClose();
  };

  const schedulePreview = (option: RequestResourcePickerOption, target: HTMLElement) => {
    cancelPreviewTimer();
    previewTimerRef.current = window.setTimeout(() => {
      onPreview(option.resource, target.getBoundingClientRect());
      previewTimerRef.current = null;
    }, REQUEST_RESOURCE_PREVIEW_DELAY_MS);
  };

  useEffect(() => {
    if (!open) closePreview();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const dismissPreview = () => closePreview();
    window.addEventListener('scroll', dismissPreview, true);
    window.addEventListener('resize', dismissPreview);
    return () => {
      cancelPreviewTimer();
      window.removeEventListener('scroll', dismissPreview, true);
      window.removeEventListener('resize', dismissPreview);
    };
  }, [open]);

  return (
    <div className="invoice-picker media-request-resource-picker">
      <button
        className={`invoice-picker-trigger ${open ? 'invoice-picker-trigger-open' : ''}`}
        type="button"
        aria-label={`为 ${creatorName} 从系统选择 ${label}`}
        aria-expanded={open}
        aria-controls={id}
        disabled={!options.length}
        onClick={() => onOpenChange(!open)}
      >
        <span className="invoice-picker-leading">
          <ResourceIcon size={16} aria-hidden="true" />
          <span className="invoice-picker-copy">
            <strong>从系统选择 {label}</strong>
            <small>{options.length ? selectedCopy : emptyCopy}</small>
          </span>
        </span>
        <ChevronDown className="invoice-picker-chevron" size={16} aria-hidden="true" />
      </button>
      {open && options.length ? (
        <div
          id={id}
          className="invoice-options"
          role="list"
          aria-label={`为 ${creatorName} 查看或选择${label}`}
        >
          {sortedOptions.map((option) => {
            const selectionDisabled = Boolean(option.disabled && !option.selected);
            return (
              <div
                className={`invoice-option ${option.selected ? 'invoice-option-selected' : ''} ${selectionDisabled ? 'invoice-option-unavailable' : ''}`}
                role="listitem"
                key={option.value}
                onMouseEnter={(event) => schedulePreview(option, event.currentTarget)}
                onMouseLeave={closePreview}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closePreview();
                }}
              >
                <button
                  className="invoice-option-view"
                  type="button"
                  aria-label={`查看${label}：${option.label}`}
                  title={option.label}
                  onFocus={(event) => {
                    cancelPreviewTimer();
                    onPreview(option.resource, event.currentTarget.closest('.invoice-option')?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect());
                  }}
                  onClick={() => {
                    closePreview();
                    onOpenDocument(option.resource);
                  }}
                >
                  <ResourceIcon className="invoice-option-icon" size={15} aria-hidden="true" />
                  <span className="invoice-option-copy">
                    <strong title={option.label}>{option.label}</strong>
                    <small title={option.description}>{option.description}</small>
                  </span>
                </button>
                <button
                  className="invoice-option-select"
                  type="button"
                  aria-label={`${option.selected ? '取消选择' : '选择'}${label}：${option.label}`}
                  aria-pressed={option.selected}
                  disabled={selectionDisabled}
                  onClick={() => onToggle(option.value, option.selected)}
                >
                  {option.selected
                    ? <CheckCircle2 className="invoice-option-mark invoice-option-mark-selected" size={18} aria-hidden="true" />
                    : <Circle className="invoice-option-mark" size={18} aria-hidden="true" />}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function RequestResourceDocumentContent({
  resource,
  preview = false,
}: {
  resource: RequestResourceDocument;
  preview?: boolean;
}) {
  if (resource.kind === 'invoice') {
    return (
      <InvoiceDocumentView
        model={resource.invoice.snapshot}
        ariaLabel={preview ? 'Invoice 文档缩略预览' : `${resource.invoice.id} Invoice 全文`}
      />
    );
  }
  return (
    <ContractDocumentView
      contract={resource.contract}
      ariaLabel={preview ? '合同文档缩略预览' : `${contractRequestResourceTitle(resource.contract)} 合同全文`}
    />
  );
}

const requestCodeFor = (request: RequestProjectSummary) => request.requestCode ?? request.id;

const formatCreatedAt = (value?: string) => {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const formatReturnTime = (value?: string) => {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

export type MyProjectRequestProgressStep = {
  label: string;
  description: string;
  time: string;
  state: 'complete' | 'current' | 'pending';
};

export const buildMyProjectRequestProgress = ({
  request,
  invoices,
  payouts,
  submissionIssues = [],
}: {
  request: RequestProjectSummary;
  invoices: GeneratedInvoiceRecord[];
  payouts: Payout[];
  submissionIssues?: readonly string[];
}): MyProjectRequestProgressStep[] => {
  const links = request.creatorLinks ?? [];
  const linkedInvoiceIds = paymentRequestInvoiceIds(links);
  const linkedContractCount = new Set(links.flatMap((link) => link.contractIds)).size || request.contracts;
  const linkedInvoiceCount = linkedInvoiceIds.length || request.invoices;
  const invoiceReady = links.length
    ? links.every((link) => link.invoiceIds.length > 0)
    : linkedInvoiceCount > 0;
  const linkedPayoutIds = new Set(invoices
    .filter((invoice) => linkedInvoiceIds.includes(invoice.invoiceId))
    .map((invoice) => invoice.sourcePayoutId));
  const requestPayouts = payouts.filter((payout) => (
    linkedPayoutIds.size > 0
      ? linkedPayoutIds.has(payout.id)
      : Boolean(
          request.paymentRequestProjectId
          && payout.paymentRequestProjectId === request.paymentRequestProjectId,
        )
  ));
  const paidPayouts = requestPayouts.filter((payout) => payout.status === '已付款');
  const processingPayouts = requestPayouts.filter((payout) => payout.status === '付款处理中');
  const waitingPayouts = requestPayouts.filter((payout) => payout.status === '等待付款');
  const failedPayouts = requestPayouts.filter((payout) => (
    ['付款失败', '已退回', '信息异常'].includes(payout.status)
  ));
  const hasPaymentFailureRecovery = failedPayouts.some((payout) => payout.paymentFailureRecovery);
  const allPayoutsPaid = request.lifecycle === 'COMPLETED'
    || (requestPayouts.length > 0 && paidPayouts.length === requestPayouts.length);
  const approvalRound = request.approval?.round ?? 1;
  const returnDetails = requestApprovalReturnDetails(request.approval);
  const approvalCompleted = request.lifecycle === 'APPROVED'
    || request.lifecycle === 'COMPLETED'
    || request.approval?.status === 'APPROVED'
    || hasPaymentFailureRecovery;
  const createdTime = formatCreatedAt(request.createdAt ?? request.approval?.submittedAt);
  const updatedTime = formatCreatedAt(request.approval?.updatedAt ?? request.approval?.submittedAt);

  let invoiceStep: MyProjectRequestProgressStep;
  if (invoiceReady) {
    invoiceStep = {
      label: '关联 Invoice',
      description: `已关联 ${linkedInvoiceCount} 份 Invoice`,
      time: '已完成',
      state: 'complete',
    };
  } else {
    const missingCreatorCount = links.filter((link) => link.invoiceIds.length === 0).length;
    invoiceStep = {
      label: '关联 Invoice',
      description: missingCreatorCount
        ? `仍有 ${missingCreatorCount} 位达人待关联 Invoice`
        : '请先关联至少一份已完成媒介审核的 Invoice',
      time: request.lifecycle === 'DRAFT' ? '待补充' : '资料不完整',
      state: request.lifecycle === 'DRAFT' ? 'current' : 'pending',
    };
  }

  let approvalStep: MyProjectRequestProgressStep;
  if (request.lifecycle === 'CANCELLED') {
    approvalStep = {
      label: '提交审核',
      description: `请款已取消：${request.cancelReason ?? '未记录原因'}`,
      time: formatCreatedAt(request.cancelledAt),
      state: 'current',
    };
  } else if (approvalCompleted) {
    approvalStep = {
      label: '提交审核',
      description: hasPaymentFailureRecovery ? '审批已完成，失败款正在恢复处理' : 'PM、项目负责人、老板及财务均已通过',
      time: updatedTime,
      state: 'complete',
    };
  } else if (request.lifecycle === 'RETURNED') {
    approvalStep = {
      label: '提交审核',
      description: `${returnDetails?.stageLabel ?? '审批流'}已退回，待修改后重新提交`,
      time: `第 ${returnDetails?.round ?? approvalRound} 轮 · ${formatCreatedAt(returnDetails?.occurredAt)}`,
      state: 'current',
    };
  } else if (request.approval || request.lifecycle === 'SUBMITTED') {
    approvalStep = {
      label: '提交审核',
      description: `第 ${approvalRound} 轮 · ${myProjectStatusFor(request)}`,
      time: updatedTime,
      state: 'current',
    };
  } else if (invoiceReady && submissionIssues.length === 0) {
    approvalStep = {
      label: '提交审核',
      description: '资料完整，可以提交审核',
      time: '待提交',
      state: 'current',
    };
  } else {
    approvalStep = {
      label: '提交审核',
      description: invoiceReady ? `仍有 ${submissionIssues.length} 项资料待完善` : '完成 Invoice 关联后提交',
      time: '待开始',
      state: 'pending',
    };
  }

  let paymentStep: MyProjectRequestProgressStep;
  if (request.lifecycle === 'CANCELLED') {
    paymentStep = {
      label: '渠道打款',
      description: '请款已取消，不再进入审批与付款',
      time: '已终止',
      state: 'pending',
    };
  } else if (allPayoutsPaid) {
    const paidTimes = paidPayouts
      .map((payout) => payout.paidAt)
      .filter((value): value is string => Boolean(value))
      .sort();
    const paidAt = paidTimes[paidTimes.length - 1];
    paymentStep = {
      label: '渠道打款',
      description: requestPayouts.length ? `${requestPayouts.length} 笔付款均已完成` : '全部关联付款均已完成',
      time: paidAt ? formatCreatedAt(paidAt) : '已完成',
      state: 'complete',
    };
  } else if (hasPaymentFailureRecovery || failedPayouts.length > 0) {
    paymentStep = {
      label: '渠道打款',
      description: `${failedPayouts.length} 笔付款异常，待修正后重新发起`,
      time: paidPayouts.length ? `已付款 ${paidPayouts.length} / ${requestPayouts.length} 笔` : '待处理',
      state: 'current',
    };
  } else if (processingPayouts.length > 0) {
    paymentStep = {
      label: '渠道打款',
      description: `${processingPayouts.length} 笔付款处理中`,
      time: paidPayouts.length ? `已付款 ${paidPayouts.length} / ${requestPayouts.length} 笔` : '渠道处理中',
      state: 'current',
    };
  } else if (waitingPayouts.length > 0 || approvalCompleted) {
    paymentStep = {
      label: '渠道打款',
      description: waitingPayouts.length ? `${waitingPayouts.length} 笔付款等待执行` : '财务审批已通过，等待执行打款',
      time: '待打款',
      state: 'current',
    };
  } else {
    paymentStep = {
      label: '渠道打款',
      description: request.lifecycle === 'RETURNED' ? '重新提交并完成审批后执行' : '全部审批完成后执行',
      time: '待开始',
      state: 'pending',
    };
  }

  return [
    {
      label: '项目创建',
      description: links.length ? `项目草稿与 ${links.length} 位达人已关联` : '请款项目草稿已创建',
      time: createdTime,
      state: 'complete',
    },
    {
      label: '补充合同',
      description: linkedContractCount ? `已关联 ${linkedContractCount} 份合同` : '合同为选填，当前未关联',
      time: linkedContractCount ? '已完成' : '已跳过',
      state: 'complete',
    },
    invoiceStep,
    approvalStep,
    paymentStep,
  ];
};

const paymentListStatusLabel = (status?: PaymentListRecord['status']) => {
  if (status === 'generated') return '已生成';
  if (status === 'submitted') return '已提交';
  if (status === 'approved') return '已通过';
  if (status === 'paid') return '已完成';
  return '草稿';
};

const MEDIA_CONFIRMATION_ASSET_PATH = '/export-assets/airwallex/airwallex付款单-支付确认函.pdf';
const MEDIA_CONFIRMATION_FILENAME = 'airwallex付款单-支付确认函.pdf';

type MediaConfirmationAssetLoader = (path: string) => Promise<Blob>;

export type MediaConfirmationItem = {
  paymentListCode: string;
  invoiceNumber: string;
};

const loadMediaConfirmationAsset: MediaConfirmationAssetLoader = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to read confirmation asset: ${response.status}`);
  return response.blob();
};

const safeMediaExportSegment = (value: string, fallback: string) => {
  const safe = value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
  return safe || fallback;
};

export const mediaConfirmationItemsFor = (
  request: RequestProjectSummary,
  paymentLists: PaymentListRecord[],
): MediaConfirmationItem[] => {
  const explicitIds = new Set([
    ...(request.paymentListIds ?? []),
    ...(request.paymentListId ? [request.paymentListId] : []),
  ]);
  return paymentLists
    .filter((list) => (
      list.status === 'paid'
      && (
        Boolean(
          request.paymentRequestProjectId
          && list.paymentRequestProjectId === request.paymentRequestProjectId,
        )
        || explicitIds.has(list.paymentListId)
      )
    ))
    .flatMap((list) => list.items.flatMap((item) => (
      paymentListEffectiveAccount(item).provider === 'Airwallex'
        ? [{
            paymentListCode: list.paymentListCode,
            invoiceNumber: item.snapshot.invoiceNumber,
          }]
        : []
    )));
};

export const createMediaConfirmationArchive = async (
  requestCode: string,
  items: MediaConfirmationItem[],
  loadAsset: MediaConfirmationAssetLoader = loadMediaConfirmationAsset,
) => {
  const [{ default: JSZip }, template] = await Promise.all([
    import('jszip'),
    loadAsset(MEDIA_CONFIRMATION_ASSET_PATH),
  ]);
  const bytes = new Uint8Array(await template.arrayBuffer());
  const zip = new JSZip();
  const projectFolder = zip.folder(`${safeMediaExportSegment(requestCode, 'project')}-付款确认函`);
  items.forEach((item, index) => {
    const paymentListCode = safeMediaExportSegment(item.paymentListCode, `payment-list-${index + 1}`);
    const invoiceNumber = safeMediaExportSegment(item.invoiceNumber, `invoice-${index + 1}`);
    projectFolder?.file(
      `${String(index + 1).padStart(2, '0')}-${paymentListCode}-${invoiceNumber}-${MEDIA_CONFIRMATION_FILENAME}`,
      bytes,
    );
  });
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
};

export function MediaPaymentProjectsPage({
  notify,
  currentUser,
  cooperationProjects,
  creators,
  contracts,
  invoices,
  paymentLists,
  payouts = [],
  requests,
  canCreate,
  focusedProjectId,
  onFocusCleared,
  initialFocusedFailurePayoutId = null,
  onFailureFocusCleared = () => undefined,
  onCreated,
  onUpdated,
  onSubmitRequest,
  onCancelRequest = () => false,
  resourceActions,
  onSendPaymentFailureNotification = () => false,
  onSendPaymentListReturnNotification = () => false,
  onSimulatePaymentListReturnAccountUpdate = () => false,
  onSimulatePaymentFailureAccountUpdate = () => false,
  onRevalidatePaymentFailureAccount = () => false,
}: {
  notify: Notify;
  currentUser: SystemUser;
  cooperationProjects: ProjectSummary[];
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
  paymentLists: PaymentListRecord[];
  payouts?: Payout[];
  requests: RequestProjectSummary[];
  canCreate: boolean;
  focusedProjectId: string | null;
  onFocusCleared: () => void;
  initialFocusedFailurePayoutId?: string | null;
  onFailureFocusCleared?: () => void;
  onCreated: (request: RequestProjectSummary) => void;
  onUpdated: (request: RequestProjectSummary) => void;
  /** @deprecated 付款草稿现已在 Invoice 关联变化时自动同步。 */
  onGeneratePaymentList?: (request: RequestProjectSummary) => void;
  onSubmitRequest: (request: RequestProjectSummary) => void;
  onCancelRequest?: (request: RequestProjectSummary, reason: string) => boolean;
  resourceActions: RequestProjectResourceActions;
  onSendPaymentFailureNotification?: (payoutId: string, message: string) => boolean;
  onSendPaymentListReturnNotification?: (requestId: string, invoiceId: InvoiceId, message: string) => boolean;
  onSimulatePaymentListReturnAccountUpdate?: (requestId: string, invoiceId: InvoiceId) => boolean;
  onSimulatePaymentFailureAccountUpdate?: (payoutId: string) => boolean;
  onRevalidatePaymentFailureAccount?: (payoutId: string) => boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(focusedProjectId);
  const [cooperationProjectId, setCooperationProjectId] = useState('');
  const [brand, setBrand] = useState('');
  const [pm, setPm] = useState(PM_USERS[0]?.name ?? '');
  const [paymentChannel, setPaymentChannel] = useState<PaymentRequestPaymentChannel | ''>('');
  const [expectedPaymentDate, setExpectedPaymentDate] = useState('');
  const [costType, setCostType] = useState<PaymentRequestCostType>(DEFAULT_PAYMENT_REQUEST_COST_TYPE);
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [remarkAttachments, setRemarkAttachments] = useState<PaymentRequestRemarkAttachment[]>([]);
  const [creatorSearch, setCreatorSearch] = useState('');
  const [creatorPickerOpen, setCreatorPickerOpen] = useState(false);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<CreatorId[]>([]);
  const [socialAccountIdsByCreator, setSocialAccountIdsByCreator] = useState<Record<string, string>>({});
  const [contractIdsByCreator, setContractIdsByCreator] = useState<Record<string, ContractId[]>>({});
  const [invoiceIdsByCreator, setInvoiceIdsByCreator] = useState<Record<string, InvoiceId[]>>({});
  const [autoLinkedContractIdsByCreator, setAutoLinkedContractIdsByCreator] = useState<Record<string, ContractId[]>>({});
  const [openDocumentPicker, setOpenDocumentPicker] = useState<string | null>(null);
  const [resourcePreview, setResourcePreview] = useState<RequestResourcePreview | null>(null);
  const [resourceDocumentDialog, setResourceDocumentDialog] = useState<RequestResourceDocument | null>(null);
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ProjectListFilters>(createEmptyPaymentRequestListFilters);
  const [exportingRequestId, setExportingRequestId] = useState<string | null>(null);
  const [focusedFailurePayoutId, setFocusedFailurePayoutId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<RequestProjectSummary | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (initialFocusedFailurePayoutId) setFocusedFailurePayoutId(initialFocusedFailurePayoutId);
  }, [initialFocusedFailurePayoutId]);

  const currentScopeName = currentUser.scopeName ?? currentUser.name;
  const visibleRequests = requests.filter((request) => {
    if (currentUser.roleKey === 'media') return request.media === currentScopeName;
    return true;
  });
  const failurePayoutsForRequest = (request: RequestProjectSummary) => payouts.filter((payout) => (
    payout.paymentRequestProjectId === request.paymentRequestProjectId
    && Boolean(payout.paymentFailureRecovery)
    && payout.status !== '已付款'
  ));
  const requestEditAllowed = (request: RequestProjectSummary) => (
    canCreate
    && ['DRAFT', 'RETURNED'].includes(request.lifecycle ?? '')
    && canEditRequestProjectResources(
      currentUser,
      request,
      failurePayoutsForRequest(request).length > 0,
    )
  );
  const requestStatusForDisplay = (request: RequestProjectSummary): MyProjectStatus => (
    failurePayoutsForRequest(request).length > 0
      ? '部分打款失败'
      : myProjectStatusFor(request)
  );
  const canCancelRequest = (request: RequestProjectSummary) => (
    canCancelPaymentRequest({
      roleKey: currentUser.roleKey,
      lifecycle: request.lifecycle,
      ownsRequest: request.media === currentScopeName,
      hasPaymentActivity: paymentRequestHasPaymentActivity(request.paymentRequestProjectId, payouts),
    })
  );
  const editingRequest = editingRequestId
    ? visibleRequests.find((request) => request.id === editingRequestId) ?? null
    : null;
  const selectedRequest = selectedRequestId
    ? visibleRequests.find((request) => request.id === selectedRequestId || requestCodeFor(request) === selectedRequestId) ?? null
    : null;
  const selectedProject = cooperationProjects.find((project) => (
    cooperationProjectIdFor(project) === cooperationProjectId
  )) ?? null;
  const query = creatorSearch.trim().toLowerCase();
  const selectedCreators = selectedCreatorIds
    .map((creatorId) => creators.find((creator) => creator.id === creatorId))
    .filter((creator): creator is CreatorProfile => Boolean(creator));

  const resolutions = useMemo(() => new Map(creators.map((creator) => [
    creator.id,
    cooperationProjectId
      ? resolveCreatorDocuments({
          contracts,
          invoices,
          requests,
          cooperationProjectId: cooperationProjectId as CooperationProjectId,
          creatorId: creator.id as CreatorId,
          excludeRequestId: editingRequest?.paymentRequestProjectId,
        })
      : null,
  ])), [contracts, cooperationProjectId, creators, editingRequest?.paymentRequestProjectId, invoices, requests]);
  const requestCountByCooperationProject = useMemo(() => requests.reduce<Map<string, number>>((counts, request) => {
    const projectId = String(request.cooperationProjectId ?? request.projectId ?? '');
    if (!projectId) return counts;
    counts.set(projectId, (counts.get(projectId) ?? 0) + 1);
    return counts;
  }, new Map()), [requests]);
  const selectableCooperationProjects = cooperationProjects;
  const selectedProjectRequestCount = requestCountByCooperationProject.get(cooperationProjectId) ?? 0;
  const selectedProjectAvailableInvoiceCount = [...resolutions.values()].reduce((count, resolution) => (
    count + (resolution?.availableInvoices.length ?? 0)
  ), 0);
  const visibleCreators = creators
    .filter((creator) => !query || `${creatorSearchTerms(creator)} ${creator.region}`.toLowerCase().includes(query))
    .filter((creator) => (
      resolutions.get(creator.id)?.status === 'READY'
      || selectedCreatorIds.includes(creator.id as CreatorId)
    ))
    .sort((left, right) => {
      const leftReady = resolutions.get(left.id)?.status === 'READY';
      const rightReady = resolutions.get(right.id)?.status === 'READY';
      if (leftReady !== rightReady) return leftReady ? -1 : 1;
      return left.name.localeCompare(right.name);
    });

  const metrics = paymentRequestListMetrics(visibleRequests);
  const returnedRequests = visibleRequests
    .filter((request) => request.lifecycle === 'RETURNED' && !failurePayoutsForRequest(request).length)
    .map((request) => ({ request, details: requestApprovalReturnDetails(request.approval) }));
  const paymentFailureRequests = visibleRequests.filter((request) => (
    failurePayoutsForRequest(request).length > 0
  ));
  const pendingRequestCount = returnedRequests.length + paymentFailureRequests.length;
  const { visible: filteredRequests, invalidBudgetRange } = filterPaymentRequestList({
    requests: visibleRequests,
    search,
    filters,
    statusFor: requestStatusForDisplay,
  });
  const {
    page,
    pageItems: paginatedRequests,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination(filteredRequests, {
    resetKey: `${search}\u0000${JSON.stringify(filters)}`,
  });
  const customerCounts = visibleRequests.reduce<Record<string, number>>((result, request) => (
    request.brand ? { ...result, [request.brand]: (result[request.brand] ?? 0) + 1 } : result
  ), {});
  const pmCounts = visibleRequests.reduce<Record<string, number>>((result, request) => ({
    ...result,
    [request.pm]: (result[request.pm] ?? 0) + 1,
  }), {});
  const customerFilterOptions = Object.entries(customerCounts).map(([customer, count]) => ({
    value: customer,
    label: customer,
    description: `${count} 个项目`,
  }));
  const pmFilterOptions = Object.entries(pmCounts).map(([pmName, count]) => ({
    value: pmName,
    label: pmName,
    description: `${count} 个项目${PM_USERS.find((user) => user.name === pmName)?.email ? ` · ${PM_USERS.find((user) => user.name === pmName)?.email}` : ''}`,
  }));
  const currencies = Array.from(new Set(visibleRequests
    .map((request) => paymentRequestAmount(request.amount).currency)
    .filter(Boolean)));
  const statuses = Array.from(new Set(visibleRequests.map(requestStatusForDisplay)));
  const currencyFilterOptions = [
    { value: 'all', label: '全部币种' },
    ...currencies.map((currency) => ({ value: currency, label: currency })),
  ];
  const statusFilterOptions = [
    {
      value: 'all',
      label: '全部状态',
      description: `共 ${visibleRequests.length} 个项目`,
      leading: <span className="project-status-select-dot project-status-select-dot-all" />,
    },
    ...statuses.map((status) => ({
      value: status,
      label: status,
      description: `${visibleRequests.filter((request) => requestStatusForDisplay(request) === status).length} 个项目`,
      leading: <span className={`project-status-select-dot ${status === '已付款' ? 'project-status-select-dot-complete' : status === '部分打款失败' ? 'project-status-select-dot-failure' : 'project-status-select-dot-active'}`} />,
    })),
  ];
  const creatorSelectionEditable = !editingRequest || canAddCreatorToPaymentRequest(editingRequest);

  const exportProjectConfirmations = async (
    request: RequestProjectSummary,
    items: MediaConfirmationItem[],
  ) => {
    if (!items.length || exportingRequestId) return;
    setExportingRequestId(request.id);
    try {
      const requestCode = requestCodeFor(request);
      const archive = await createMediaConfirmationArchive(requestCode, items);
      downloadBlob(archive, `${safeMediaExportSegment(requestCode, 'project')}-付款确认函.zip`);
      notify('确认函已导出', `已为 ${requestCode} 生成 ${items.length} 份 Airwallex 付款确认函。`);
    } catch {
      notify('确认函导出失败', '无法读取付款确认函模板，请检查导出资源后重试。');
    } finally {
      setExportingRequestId(null);
    }
  };

  const resetForm = () => {
    setCooperationProjectId('');
    setBrand('');
    setPm(PM_USERS[0]?.name ?? '');
    setPaymentChannel('');
    setExpectedPaymentDate('');
    setCostType(DEFAULT_PAYMENT_REQUEST_COST_TYPE);
    setReason('');
    setRemark('');
    setRemarkAttachments([]);
    setCreatorSearch('');
    setCreatorPickerOpen(false);
    setSelectedCreatorIds([]);
    setSocialAccountIdsByCreator({});
    setContractIdsByCreator({});
    setInvoiceIdsByCreator({});
    setAutoLinkedContractIdsByCreator({});
    setOpenDocumentPicker(null);
    setResourcePreview(null);
    setResourceDocumentDialog(null);
    setFormSubmitAttempted(false);
    setEditingRequestId(null);
  };

  const closeForm = () => {
    const returnRequestId = editingRequest?.id ?? null;
    resetForm();
    setCreating(false);
    if (returnRequestId) setSelectedRequestId(returnRequestId);
  };

  const openCreateForm = () => {
    resetForm();
    setCreating(true);
  };

  const openRequestDetail = (request: RequestProjectSummary) => {
    setSelectedRequestId(request.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEditForm = (request: RequestProjectSummary, showCreatorPicker = false) => {
    if (!requestEditAllowed(request)) {
      notify('项目已锁定', '请款项目提交后仅可查看；审批退回或付款失败后才能修改。');
      return;
    }
    const paymentPlan = paymentRequestPaymentPlanFor(request);
    setCooperationProjectId(String(request.cooperationProjectId ?? request.projectId ?? ''));
    setBrand(request.brand ?? '');
    setPm(request.pm);
    setPaymentChannel(paymentPlan.paymentChannel);
    setExpectedPaymentDate(paymentPlan.expectedPaymentDate);
    setCostType(normalizePaymentRequestCostType(request.costType));
    setReason(request.generatedDetail?.reason ?? '');
    setRemark(request.remark ?? '');
    setRemarkAttachments(request.remarkAttachments ?? []);
    setCreatorSearch('');
    setCreatorPickerOpen(showCreatorPicker && canAddCreatorToPaymentRequest(request));
    setSelectedCreatorIds((request.creatorLinks ?? []).map((link) => link.creatorId));
    setSocialAccountIdsByCreator(Object.fromEntries(
      (request.creatorLinks ?? []).flatMap((link) => {
        const creator = creators.find((item) => item.id === link.creatorId);
        const invoice = invoices.find((item) => link.invoiceIds.includes(item.invoiceId));
        const socialAccount = resolveCreatorSocialAccount(
          creator,
          link.socialAccountId ?? invoice?.snapshot.creatorSocialAccountId,
          link.creatorHandle ?? invoice?.snapshot.creatorHandle,
          link.creatorPlatform ?? invoice?.snapshot.creatorPlatform,
        );
        return socialAccount ? [[link.creatorId, socialAccount.id]] : [];
      }),
    ));
    setContractIdsByCreator(Object.fromEntries(
      (request.creatorLinks ?? []).map((link) => [link.creatorId, [...link.contractIds]]),
    ));
    setInvoiceIdsByCreator(Object.fromEntries(
      (request.creatorLinks ?? []).map((link) => [link.creatorId, [...link.invoiceIds]]),
    ));
    setAutoLinkedContractIdsByCreator({});
    setOpenDocumentPicker(null);
    setResourcePreview(null);
    setResourceDocumentDialog(null);
    setFormSubmitAttempted(false);
    setEditingRequestId(request.id);
    setSelectedRequestId(null);
    setCreating(true);
  };

  const changeProject = (value: string) => {
    setCooperationProjectId(value);
    setSelectedCreatorIds([]);
    setSocialAccountIdsByCreator({});
    setContractIdsByCreator({});
    setInvoiceIdsByCreator({});
    setAutoLinkedContractIdsByCreator({});
    setOpenDocumentPicker(null);
    setResourcePreview(null);
    setResourceDocumentDialog(null);
    setFormSubmitAttempted(false);
  };

  const toggleCreator = (creatorId: CreatorId) => {
    if (!creatorSelectionEditable) {
      notify('达人名单已锁定', '只有草稿状态可以添加或移除达人。');
      return;
    }
    const removing = selectedCreatorIds.includes(creatorId);
    if (!removing && resolutions.get(creatorId)?.status !== 'READY') {
      notify('暂无可请款 Invoice', '该达人在当前合作项目下没有未占用的已通过 Invoice。');
      return;
    }
    if (removing && openDocumentPicker?.startsWith(`${creatorId}:`)) {
      setOpenDocumentPicker(null);
      setResourcePreview(null);
    }
    setSelectedCreatorIds((current) => removing
      ? current.filter((id) => id !== creatorId)
      : [...current, creatorId]);
    setSocialAccountIdsByCreator((current) => {
      if (removing) {
        const next = { ...current };
        delete next[creatorId];
        return next;
      }
      const creator = creators.find((item) => item.id === creatorId);
      return { ...current, [creatorId]: resolveCreatorSocialAccount(creator)?.id ?? '' };
    });
    setContractIdsByCreator((current) => {
      if (!current[creatorId]) return current;
      const next = { ...current };
      delete next[creatorId];
      return next;
    });
    setInvoiceIdsByCreator((current) => {
      if (removing) {
        if (!current[creatorId]) return current;
        const next = { ...current };
        delete next[creatorId];
        return next;
      }
      return {
        ...current,
        [creatorId]: [],
      };
    });
    setAutoLinkedContractIdsByCreator((current) => {
      if (!current[creatorId]) return current;
      const next = { ...current };
      delete next[creatorId];
      return next;
    });
  };

  const addContract = (creatorId: CreatorId, contractId: ContractId) => {
    setContractIdsByCreator((current) => {
      const selected = current[creatorId] ?? [];
      return {
        ...current,
        [creatorId]: selected.includes(contractId) ? selected : [...selected, contractId],
      };
    });
  };

  const removeContract = (creatorId: CreatorId, contractId: ContractId) => {
    setContractIdsByCreator((current) => ({
      ...current,
      [creatorId]: (current[creatorId] ?? []).filter((id) => id !== contractId),
    }));
    setAutoLinkedContractIdsByCreator((current) => ({
      ...current,
      [creatorId]: (current[creatorId] ?? []).filter((id) => id !== contractId),
    }));
  };

  const addInvoice = (creatorId: CreatorId, invoiceId: InvoiceId) => {
    const resolution = resolutions.get(creatorId);
    const invoice = resolution?.availableInvoices.find((candidate) => candidate.invoiceId === invoiceId);
    if (!invoice || !resolution) return;
    const expectedProvider = paymentRequestProviderForChannel(paymentChannel || undefined);
    const invoiceProvider = invoicePaymentListProvider(invoice);
    if (expectedProvider && invoiceProvider !== expectedProvider) {
      notify(
        'Invoice 付款渠道不一致',
        `当前请款项目选择 ${paymentProviderDisplayName(paymentChannel)}，不能关联使用 ${paymentProviderDisplayName(invoiceProvider)} 收款账户的 Invoice。`,
      );
      return;
    }
    const result = addInvoiceToPaymentRequestSelection({
      invoice,
      invoices: resolution.invoices,
      contracts: resolution.contracts,
      selectedInvoiceIds: invoiceIdsByCreator[creatorId] ?? [],
      selectedContractIds: contractIdsByCreator[creatorId] ?? [],
    });
    setInvoiceIdsByCreator((current) => ({ ...current, [creatorId]: result.invoiceIds }));
    setContractIdsByCreator((current) => ({ ...current, [creatorId]: result.contractIds }));
    setAutoLinkedContractIdsByCreator((current) => ({
      ...current,
      [creatorId]: [...new Set([
        ...(current[creatorId] ?? []),
        ...result.autoLinkedContractIds,
      ])],
    }));
  };

  const removeInvoice = (creatorId: CreatorId, invoiceId: InvoiceId) => {
    const resolution = resolutions.get(creatorId);
    const remainingInvoiceIds = (invoiceIdsByCreator[creatorId] ?? []).filter((id) => id !== invoiceId);
    const remainingCoveredContractIds = new Set(remainingInvoiceIds.flatMap((id) => (
      resolution?.invoices.find((invoice) => invoice.invoiceId === id)?.snapshot.contractIds ?? []
    )));
    const previouslyAutoLinked = autoLinkedContractIdsByCreator[creatorId] ?? [];
    const autoLinkedToKeep = previouslyAutoLinked.filter((contractId) => remainingCoveredContractIds.has(contractId));
    const autoLinkedToRemove = new Set(previouslyAutoLinked.filter((contractId) => !remainingCoveredContractIds.has(contractId)));
    setInvoiceIdsByCreator((current) => ({ ...current, [creatorId]: remainingInvoiceIds }));
    setContractIdsByCreator((current) => ({
      ...current,
      [creatorId]: (current[creatorId] ?? []).filter((contractId) => !autoLinkedToRemove.has(contractId)),
    }));
    setAutoLinkedContractIdsByCreator((current) => ({ ...current, [creatorId]: autoLinkedToKeep }));
  };

  const validCreatorLinks = selectedCreators.flatMap<PaymentRequestCreatorLink>((creator) => {
    const resolution = resolutions.get(creator.id);
    const selectedInvoiceIds = invoiceIdsByCreator[creator.id] ?? [];
    const selectedInvoices = resolution?.invoices.filter((invoice) => (
      selectedInvoiceIds.includes(invoice.invoiceId)
    )) ?? [];
    const engagementId = selectedInvoices[0]?.snapshot.engagementId;
    if (!selectedInvoices.length || !engagementId) return [];
    const socialAccount = resolveCreatorSocialAccount(
      creator,
      selectedInvoices[0]?.snapshot.creatorSocialAccountId,
      selectedInvoices[0]?.snapshot.creatorHandle,
      selectedInvoices[0]?.snapshot.creatorPlatform,
    );
    return [{
      creatorId: creator.id as CreatorId,
      socialAccountId: socialAccount?.id,
      creatorHandle: socialAccount?.handle ?? creator.handle,
      creatorPlatform: socialAccount?.platform ?? creator.platform,
      engagementId,
      contractIds: contractIdsByCreator[creator.id] ?? [],
      invoiceIds: selectedInvoices.map((invoice) => invoice.invoiceId),
    }];
  });
  const creatorsReady = paymentRequestDraftCreatorsReady(
    selectedCreators.length,
    validCreatorLinks.length,
  );
  const handleRemarkPaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => REMARK_IMAGE_TYPES.has(item.type))
      .flatMap((item) => {
        const file = item.getAsFile();
        return file ? [file] : [];
      });
    if (!imageFiles.length) return;
    const pastedAt = Date.now();
    try {
      const pastedAttachments = await Promise.all(imageFiles.map(async (file, index) => {
        const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1] || 'png';
        return {
          name: `备注截图-${pastedAt}-${index + 1}.${extension}`,
          size: file.size,
          type: file.type,
          lastModified: pastedAt + index,
          dataUrl: await fileDataUrl(file),
        };
      }));
      setRemarkAttachments((current) => mergePaymentRequestRemarkAttachments(current, pastedAttachments));
    } catch {
      notify('截图粘贴失败', '无法读取剪贴板中的截图，请重新截图后粘贴。');
    }
  };
  const formIssues = [
    !selectedProject ? '请选择关联项目' : '',
    !pm ? '请选择项目 PM' : '',
    ...paymentRequestPaymentPlanIssues({ paymentChannel, expectedPaymentDate }),
    ...paymentRequestExtraDetailIssues({ costType }),
    !reason.trim() ? '请填写请款事由' : '',
    ...selectedCreators.flatMap((creator) => {
      const selectedInvoiceIds = invoiceIdsByCreator[creator.id] ?? [];
      if (!selectedInvoiceIds.length) return [`请为 ${creator.name} 至少选择一份 Invoice`];
      const resolution = resolutions.get(creator.id);
      const selectedInvoices = resolution?.invoices.filter((invoice) => selectedInvoiceIds.includes(invoice.invoiceId)) ?? [];
      if (selectedInvoices.length !== selectedInvoiceIds.length) return [`${creator.name} 的 Invoice 关联已失效，请重新选择`];
      const expectedProvider = paymentRequestProviderForChannel(paymentChannel || undefined);
      const incompatibleInvoice = expectedProvider
        ? selectedInvoices.find((invoice) => invoicePaymentListProvider(invoice) !== expectedProvider)
        : undefined;
      if (incompatibleInvoice) {
        return [`${creator.name} 的 ${incompatibleInvoice.id} 与付款渠道 ${paymentProviderDisplayName(paymentChannel)} 不一致`];
      }
      if (new Set(selectedInvoices.map((invoice) => invoice.snapshot.engagementId)).size > 1) {
        return [`${creator.name} 的 Invoice 分属不同合作关系，不能合并到同一达人记录`];
      }
      return [];
    }),
  ].filter(Boolean);
  const canCreateRequest = Boolean(
    selectedProject
    && pm
    && paymentChannel
    && expectedPaymentDate
    && costType
    && reason.trim()
    && creatorsReady
    && formIssues.length === 0,
  );

  const saveRequest = () => {
    setFormSubmitAttempted(true);
    if (editingRequest && !requestEditAllowed(editingRequest)) {
      notify('项目已锁定', '项目状态已变化，本次修改不能保存。');
      return;
    }
    if (!selectedProject || !paymentChannel || !expectedPaymentDate || !costType || !canCreateRequest) {
      notify('请完善必填信息', formIssues[0] ?? '请检查达人和 Invoice 关联信息。');
      return;
    }
    const paymentRequestProjectId = editingRequest?.paymentRequestProjectId
      ?? createPrototypeId('request-project') as PaymentRequestProjectId;
    const requestCode = editingRequest?.requestCode ?? createPrototypeCode('REQ');
    const selectedContractIds = validCreatorLinks.flatMap((link) => link.contractIds);
    const selectedInvoiceIds = paymentRequestInvoiceIds(validCreatorLinks);
    const request: RequestProjectSummary = {
      ...editingRequest,
      id: editingRequest?.id ?? requestCode,
      paymentRequestProjectId,
      requestCode,
      cooperationProjectId: cooperationProjectIdFor(selectedProject),
      cooperationProjectCode: selectedProject.cooperationProjectCode ?? selectedProject.projectCode ?? selectedProject.id,
      cooperationProjectName: selectedProject.name,
      lifecycle: editingRequest?.lifecycle ?? 'DRAFT',
      creatorLinks: validCreatorLinks,
      projectId: cooperationProjectIdFor(selectedProject) as ProjectId,
      invoiceIds: selectedInvoiceIds,
      project: selectedProject.name,
      brand: brand.trim(),
      media: currentScopeName,
      pm,
      paymentChannel,
      expectedPaymentDate,
      costType,
      remark: remark.trim(),
      remarkAttachments,
      amount: paymentRequestAmountLabel(validCreatorLinks, invoices),
      contracts: selectedContractIds.length,
      invoices: selectedInvoiceIds.length,
      paymentListId: undefined,
      paymentListIds: undefined,
      paymentOrder: '待生成',
      status: editingRequest?.status ?? '草稿',
      filter: editingRequest?.filter ?? 'pending',
      createdAt: editingRequest?.createdAt ?? new Date().toISOString(),
      generatedDetail: {
        brand: brand.trim(),
        reason: reason.trim(),
        contractId: selectedContractIds.join('、') || '未关联',
        contractName: selectedContractIds.length ? `${selectedContractIds.length} 份已选合同` : '合同选填，当前未关联',
        contractAmount: '按所选合同分别校验',
        contractStatus: selectedContractIds.length ? '待校验' : '未关联',
        invoiceId: selectedInvoiceIds.join('、'),
        invoiceAmount: paymentRequestAmountLabel(validCreatorLinks, invoices),
        invoiceStatus: '待提交',
        paymentListId: '待生成',
        paymentListStatus: '草稿',
        payee: `${validCreatorLinks.length} 位合作达人`,
        provider: paymentChannel,
        beneficiaryId: '按付款清单账户快照',
        feePolicy: '按合同约定；合同未约定时由付款清单补充',
      },
    };
    if (editingRequest) onUpdated(request);
    else onCreated(request);
    resetForm();
    setCreating(false);
    setSelectedRequestId(request.id);
    notify(
      editingRequest ? '请款已更新' : '请款已创建',
      `${requestCode} 已保存，所选 Invoice 的付款草稿将自动同步；可在详情中完成校验后提交申请。`,
    );
  };

  const cancelRequestModal = cancelTarget ? (
    <Modal
      title={`取消请款 · ${requestCodeFor(cancelTarget)}`}
      width="520px"
      onClose={() => { setCancelTarget(null); setCancelReason(''); }}
      footer={<><Button variant="ghost" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>返回</Button><Button variant="danger" disabled={!cancelReason.trim()} onClick={() => {
        if (!onCancelRequest(cancelTarget, cancelReason.trim())) return;
        setSelectedRequestId(cancelTarget.id);
        setCancelTarget(null);
        setCancelReason('');
      }}>确认取消</Button></>}
    >
      <div className="form-grid single-column media-request-cancel-form">
        <NoticeBanner>取消后项目保留为只读历史，所占用的 Invoice 会立即释放并可用于新的请款项目。</NoticeBanner>
        <label><span>取消原因 *</span><textarea autoFocus value={cancelReason} placeholder="请填写取消原因，便于后续审计和追溯" onChange={(event) => setCancelReason(event.target.value)} /></label>
      </div>
    </Modal>
  ) : null;

  if (selectedRequest) {
    const failedPayouts = failurePayoutsForRequest(selectedRequest);
    const hasPaymentFailureRecovery = failedPayouts.length > 0;
    const selectedMyProjectStatus = requestStatusForDisplay(selectedRequest);
    const cooperationProject = cooperationProjects.find((project) => (
      cooperationProjectIdFor(project) === (selectedRequest.cooperationProjectId ?? selectedRequest.projectId)
    ));
    const links = selectedRequest.creatorLinks ?? [];
    const submissionIssues = [
      ...paymentRequestPaymentPlanIssues(paymentRequestPaymentPlanFor(selectedRequest)),
      ...paymentRequestExtraDetailIssues(selectedRequest),
      !selectedRequest.generatedDetail?.reason?.trim() ? '请填写付款事由' : '',
      ...paymentRequestSubmissionIssues({
        creatorLinks: links,
        invoices,
        paymentLists,
        paymentRequestProjectId: selectedRequest.paymentRequestProjectId,
        paymentChannel: selectedRequest.paymentChannel,
      }),
    ].filter(Boolean);
    const editable = requestEditAllowed(selectedRequest);
    const hasScopedApprovalReturn = requestApprovalHasScopedReturnItems(selectedRequest.approval);
    const hasInvoiceReturn = Boolean(selectedRequest.approval?.returnItems?.some((item) => (
      item.issueType === 'INVOICE_CONTENT'
    )));
    const hasPaymentListReturn = Boolean(selectedRequest.approval?.returnItems?.some((item) => (
      item.issueType === 'PAYMENT_LIST'
    )));
    const requestContentEditable = editable && !hasPaymentFailureRecovery && !hasScopedApprovalReturn;
    const canAddCreators = !hasPaymentFailureRecovery
      && !hasScopedApprovalReturn
      && canCreate
      && canAddCreatorToPaymentRequest(selectedRequest);
    const canSubmit = editable && submissionIssues.length === 0;
    const requestPaymentLists = paymentLists.filter((list) => (
      list.paymentRequestProjectId === selectedRequest.paymentRequestProjectId
    ));
    const linkedContractIds = Array.from(new Set(links.flatMap((link) => link.contractIds)));
    const linkedInvoices = paymentRequestInvoiceIds(links).flatMap((invoiceId) => {
      const invoice = invoices.find((item) => item.invoiceId === invoiceId);
      return invoice ? [invoice] : [];
    });
    const latestPaymentList = requestPaymentLists[0];
    const isReturned = selectedRequest.lifecycle === 'RETURNED';
    const isCancelled = selectedRequest.lifecycle === 'CANCELLED';
    const canHandlePaymentFailure = ['media', 'admin', 'owner'].includes(currentUser.roleKey);
    const returnDetails = requestApprovalReturnDetails(selectedRequest.approval);
    const returnHeading = returnDetails?.stage === 'FINANCE'
      ? '付款工作台已退回此请款项目'
      : `${returnDetails?.stageLabel ?? '审批流'}已退回此请款项目`;
    const progress = buildMyProjectRequestProgress({
      request: selectedRequest,
      invoices,
      payouts,
      submissionIssues,
    });
    const scrollToSection = (id: string) => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    return (
      <div className="page-stack project-detail-page media-request-detail-page">
        <button className="project-back-button" type="button" onClick={() => {
          setSelectedRequestId(null);
          onFocusCleared();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}><ArrowLeft size={17} />返回我的请款项目</button>
        <PageHeading
          title={requestCodeFor(selectedRequest)}
          subtitle={`关联项目 ${selectedRequest.cooperationProjectName ?? selectedRequest.project} · 创建媒介 ${selectedRequest.media}`}
          actions={<>{requestContentEditable ? <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => openEditForm(selectedRequest)}>{isReturned ? '修改请款内容' : '编辑项目'}</Button> : null}{isReturned && !hasPaymentFailureRecovery ? <Button variant="ghost" icon={<ArrowDown size={16} />} onClick={() => scrollToSection('media-request-submit-section')}>查看重新提交要求</Button> : null}{canCancelRequest(selectedRequest) ? <Button variant="ghost" icon={<X size={16} />} onClick={() => { setCancelTarget(selectedRequest); setCancelReason(''); }}>取消请款</Button> : null}<span className="project-detail-status" data-tone={hasPaymentFailureRecovery ? 'failure' : undefined}><i />{selectedMyProjectStatus}</span></>}
        />
        <div className="metrics-grid project-detail-metrics">
          <article className="metric-card metric-blue"><span>请款金额</span><strong>{selectedRequest.amount}</strong><small>按关联 Invoice 汇总</small></article>
          <article className="metric-card metric-lilac"><span>合作达人</span><strong>{links.length || selectedRequest.invoices} 位</strong><small>{selectedRequest.contracts} 份合同 · {selectedRequest.invoices} 份 Invoice</small></article>
          <article className="metric-card metric-peach"><span>当前状态</span><strong>{selectedMyProjectStatus}</strong>{hasPaymentFailureRecovery ? null : <small>{selectedRequest.approval ? '已进入审批流' : '尚未提交审批'}</small>}</article>
        </div>
        {isCancelled ? <NoticeBanner>此请款已于 {formatCreatedAt(selectedRequest.cancelledAt)} 取消。原因：{selectedRequest.cancelReason ?? '未记录'}。关联 Invoice 已释放，可用于新的请款项目。</NoticeBanner> : null}
        {hasPaymentFailureRecovery ? (
          <section className="media-request-return-panel media-request-payment-failure-panel" aria-labelledby="media-request-payment-failure-heading">
            <div className="media-request-return-panel-icon"><AlertTriangle size={21} aria-hidden="true" /></div>
            <div className="media-request-return-panel-body">
              <header>
                <div>
                  <span>付款失败退回</span>
                  <h2 id="media-request-payment-failure-heading">{failedPayouts.length} 笔失败款待处理</h2>
                  <p>仅失败款进入恢复流程，成功款保持已付款并冻结。达人更新账户后资料校验会同步刷新；重新校验通过并发起付款后，该笔状态更新为“付款处理中”。</p>
                </div>
              </header>
              <div className="media-payment-failure-list">
                {failedPayouts.map((payout) => {
                  const recoveryStatus = payout.paymentFailureRecovery?.status ?? 'AWAITING_CREATOR_UPDATE';
                  return (
                    <article key={payout.id}>
                      <div className="media-payment-failure-identity">
                        <span className="media-payment-failure-account-icon" aria-hidden="true"><WalletCards size={18} /></span>
                        <div>
                          <strong>{payout.creator}</strong>
                          <span>{payout.invoice} · {paymentProviderDisplayName(payout.provider)} · {payout.currency} {payout.amount.toLocaleString('en-US')}</span>
                        </div>
                      </div>
                      <p className="media-payment-failure-reason">
                        <span>付款失败原因：</span>
                        <strong>{payout.paymentFailureReturn?.reason ?? payout.paymentFailure?.providerResponse ?? '未记录失败原因'}</strong>
                      </p>
                      <div className="media-payment-failure-actions">
                        <span className={`media-payment-failure-state is-${recoveryStatus.toLowerCase()}`}><i aria-hidden="true" />{paymentFailureRecoveryLabel(payout)}</span>
                        <Button className="media-payment-failure-action" variant="secondary" icon={<ReceiptText size={15} />} onClick={() => setFocusedFailurePayoutId(payout.id)}>查看付款清单</Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}
        {isReturned && !hasPaymentFailureRecovery ? (
          <section className="media-request-return-panel" aria-labelledby="media-request-return-heading">
            <div className="media-request-return-panel-icon"><AlertTriangle size={21} aria-hidden="true" /></div>
            <div className="media-request-return-panel-body">
              <header>
                <div>
                  <span>退回待处理</span>
                  <h2 id="media-request-return-heading">{returnHeading}</h2>
                  <p>{hasScopedApprovalReturn
                    ? '请仅处理下方标记的退回明细；未被标记的 Invoice 与付款明细保持锁定。'
                    : '请根据退回意见修改请款内容和付款清单，完成校验后重新提交。'}</p>
                </div>
                {editable ? (
                  <div className="media-request-return-panel-actions">
                    {!hasScopedApprovalReturn ? <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => openEditForm(selectedRequest)}>修改请款内容</Button> : null}
                    <Button variant={hasScopedApprovalReturn ? 'secondary' : 'ghost'} onClick={() => scrollToSection('media-request-resource-section')}>
                      {hasInvoiceReturn && hasPaymentListReturn
                        ? '处理退回明细'
                        : hasInvoiceReturn
                          ? '修改指定 Invoice'
                          : hasPaymentListReturn
                            ? '修改指定付款明细'
                            : '检查付款清单'}
                    </Button>
                  </div>
                ) : null}
              </header>
              <blockquote>{returnDetails?.reason ?? '未记录退回原因'}</blockquote>
              <dl className="media-request-return-meta">
                <div><dt>退回节点</dt><dd>{returnDetails?.stageLabel ?? '未记录'}</dd></div>
                <div><dt>退回人</dt><dd>{returnDetails?.actorName ?? '未记录'}<small>{returnDetails?.actorRole ?? ''}</small></dd></div>
                <div><dt>退回时间</dt><dd><Clock3 size={14} aria-hidden="true" />{formatReturnTime(returnDetails?.occurredAt)}</dd></div>
                <div><dt>审批轮次</dt><dd>第 {returnDetails?.round ?? selectedRequest.approval?.round ?? 1} 轮</dd></div>
              </dl>
            </div>
          </section>
        ) : null}
        <div className="project-detail-layout">
          <div className="project-detail-main">
        <RequestProjectInfoCard
          requestCode={requestCodeFor(selectedRequest)}
          cooperationProjectName={cooperationProject?.name ?? selectedRequest.cooperationProjectName ?? selectedRequest.project}
          cooperationProjectCode={selectedRequest.cooperationProjectCode ?? cooperationProject?.cooperationProjectCode}
          brand={selectedRequest.brand}
          pm={selectedRequest.pm}
          paymentChannel={selectedRequest.paymentChannel ? paymentProviderDisplayName(selectedRequest.paymentChannel) : undefined}
          expectedPaymentDate={selectedRequest.expectedPaymentDate}
          costType={selectedRequest.costType}
          media={selectedRequest.media}
          createdAt={selectedRequest.createdAt ?? selectedRequest.approval?.submittedAt}
          reason={selectedRequest.generatedDetail?.reason}
          remark={selectedRequest.remark}
        />
        <section id="media-request-resource-section" className="project-detail-card project-workflow-card">
          <header className="project-detail-card-header"><div><h2>合同、Invoice 与付款清单</h2><p>逐项查看和管理当前请款项目明确关联的资料。</p></div></header>
          <RequestProjectResourceManager
            request={selectedRequest}
            cooperationProject={cooperationProject ?? cooperationProjects[0]}
            requests={requests}
            creators={creators}
            contracts={contracts}
            invoices={invoices}
            paymentLists={paymentLists}
            payouts={payouts}
            focusedFailurePayoutId={focusedFailurePayoutId}
            canHandlePaymentFailure={canHandlePaymentFailure}
            onFailureFocusHandled={() => {
              setFocusedFailurePayoutId(null);
              onFailureFocusCleared();
            }}
            onSendPaymentFailureNotification={onSendPaymentFailureNotification}
            onSendPaymentListReturnNotification={onSendPaymentListReturnNotification}
            onSimulatePaymentListReturnAccountUpdate={onSimulatePaymentListReturnAccountUpdate}
            onSimulatePaymentFailureAccountUpdate={onSimulatePaymentFailureAccountUpdate}
            onRevalidatePaymentFailureAccount={onRevalidatePaymentFailureAccount}
            currentUser={currentUser}
            onChangeLinks={(nextLinks, summary) => resourceActions.onChangeLinks(selectedRequest, nextLinks, summary)}
            onOpenContract={(contractId) => resourceActions.onOpenContract(selectedRequest, contractId)}
            onOpenInvoice={(invoiceId) => resourceActions.onOpenInvoice(selectedRequest, invoiceId)}
            onGenerateContract={() => resourceActions.onGenerateContract(selectedRequest)}
            onGenerateInvoice={() => resourceActions.onGenerateInvoice(selectedRequest)}
            onUploadContract={(inputs) => resourceActions.onUploadContract(selectedRequest, inputs)}
            onDeleteContract={(contractId) => resourceActions.onDeleteContract(selectedRequest, contractId)}
            onDeleteInvoice={(invoiceId) => resourceActions.onDeleteInvoice(selectedRequest, invoiceId)}
            onClearPaymentLists={() => resourceActions.onClearPaymentLists(selectedRequest)}
            onRemovePaymentInvoice={(paymentListId, invoiceId) => resourceActions.onRemovePaymentInvoice(selectedRequest, paymentListId, invoiceId)}
            onUpdatePaymentItem={(paymentListId, invoiceId, field, value) => resourceActions.onUpdatePaymentItem(selectedRequest, paymentListId, invoiceId, field, value)}
            onChangePaymentAccount={(paymentListId, invoiceId, payoutAccountId) => resourceActions.onChangePaymentAccount(selectedRequest, paymentListId, invoiceId, payoutAccountId)}
            onRevalidatePaymentItem={(paymentListId, invoiceId) => resourceActions.onRevalidatePaymentItem(selectedRequest, paymentListId, invoiceId)}
            onBeginEditPaymentList={(paymentListId) => resourceActions.onBeginEditPaymentList(selectedRequest, paymentListId)}
            onGeneratePaymentListVersion={(paymentListId) => resourceActions.onGeneratePaymentListVersion(selectedRequest, paymentListId)}
            onExportPaymentList={(paymentListId) => resourceActions.onExportPaymentList(selectedRequest, paymentListId)}
          />
        </section>
        <section className="project-detail-card">
          <header className="project-detail-card-header"><div><h2>达人名单</h2><p>按达人核对付款渠道、请款金额与实际付款金额。</p></div>{canAddCreators ? <button className="text-link" type="button" onClick={() => openEditForm(selectedRequest, true)}>添加达人</button> : <span>共 {links.length} 位</span>}</header>
          {links.length ? (
            <div className="table-scroll">
              <table className="data-table project-creator-table media-request-creator-table">
                <thead><tr><th>达人</th><th>付款渠道</th><th className="media-request-money-heading">Invoice 金额</th><th className="media-request-money-heading">请款金额</th><th className="media-request-money-heading">实际付款金额</th><th>校验状态</th><th>付款状态</th></tr></thead>
                <tbody>{links.map((link) => {
                  const creator = creators.find((item) => item.id === link.creatorId);
                  const presentation = paymentRequestCreatorPresentation({
                    link,
                    invoices,
                    contracts,
                    paymentLists,
                    paymentRequestProjectId: selectedRequest.paymentRequestProjectId,
                    requestLifecycle: selectedRequest.lifecycle,
                    requestStatus: selectedMyProjectStatus,
                    cooperationProjectId: selectedRequest.cooperationProjectId,
                  });
                  const creatorPayouts = link.invoiceIds.map((invoiceId) => {
                    const invoice = invoices.find((candidate) => candidate.invoiceId === invoiceId);
                    return invoice ? payouts.find((payout) => payout.id === invoice.sourcePayoutId) : undefined;
                  });
                  const validationFailed = presentation.invoices.some((invoice) => (
                    invoice.missing
                    || invoice.paymentItemMissing
                    || invoice.accountNeedsReview
                    || invoice.requiresRevalidation
                  ));
                  return (
                    <tr key={link.creatorId}>
                      <td><div className="media-request-creator-cell"><CreatorIdentity creator={creator} displayName={String(link.creatorId)} fallbackHandle={link.creatorHandle} fallbackPlatform={link.creatorPlatform} /></div></td>
                      <td>
                        <div className="media-request-record-stack">
                          {presentation.invoices.length ? presentation.invoices.map((invoice) => (
                            <span className="media-request-record-line media-request-channel" key={invoice.invoiceId}>
                              <PaymentProviderBadge compact provider={invoice.provider} />
                            </span>
                          )) : <span className="media-request-record-empty">—</span>}
                        </div>
                      </td>
                      <td className="media-request-money-cell">
                        <div className="media-request-record-stack">
                          {presentation.invoices.length ? presentation.invoices.map((invoice) => (
                            <span className="media-request-record-line" key={invoice.invoiceId}>{invoice.invoiceAmountLabel}</span>
                          )) : <span className="media-request-record-empty">—</span>}
                          {presentation.invoices.length > 1 ? <small>合计 {presentation.invoiceTotalLabel}</small> : null}
                        </div>
                      </td>
                      <td className="media-request-money-cell">
                        <div className="media-request-record-stack">
                          {presentation.invoices.length ? presentation.invoices.map((invoice) => (
                            <span className="media-request-record-line media-request-request-amount" key={invoice.invoiceId}>
                              <strong>{invoice.requestAmountLabel}</strong>
                              {invoice.amountAdjusted ? <small>已调整</small> : null}
                            </span>
                          )) : <span className="media-request-record-empty">—</span>}
                          {presentation.invoices.length > 1 ? <small>合计 {presentation.requestTotalLabel}</small> : null}
                        </div>
                      </td>
                      <td className="media-request-money-cell">
                        <div className="media-request-record-stack">
                          {creatorPayouts.length ? creatorPayouts.map((payout, index) => (
                            <span className="media-request-record-line media-request-actual-amount" key={`${link.invoiceIds[index]}-actual-amount`}>
                              <strong>{actualPayoutAmountLabel(payout)}</strong>
                            </span>
                          )) : <span className="media-request-record-empty">—</span>}
                        </div>
                      </td>
                      <td>
                        <div className="media-request-validation-stack">
                          <span className="media-request-validation-status" data-tone={validationFailed ? 'danger' : 'success'}>
                            <i aria-hidden="true" />{validationFailed ? '校验失败' : '校验通过'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="media-request-validation-stack">
                          {creatorPayouts.length ? creatorPayouts.map((payout, index) => {
                            const status = payout?.status ?? '未进入付款';
                            const tone = status === '已付款' ? 'success' : ['付款失败', '已退回'].includes(status) ? 'danger' : 'info';
                            return <span className="media-request-validation-status" data-tone={tone} key={`${link.invoiceIds[index]}-${status}`}><i aria-hidden="true" />{status}</span>;
                          }) : <span className="media-request-validation-status" data-tone="info"><i aria-hidden="true" />未进入付款</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          ) : canAddCreators ? (
            <button className="project-detail-empty project-detail-empty-action" type="button" onClick={() => openEditForm(selectedRequest, true)}><Users size={20} /><span><strong>尚未添加达人</strong><small>点击从达人档案筛选项目达人</small></span></button>
          ) : <div className="project-detail-empty"><Users size={20} /><span><strong>尚未添加达人</strong><small>当前项目为只读状态</small></span></div>}
        </section>
        {!hasPaymentFailureRecovery ? <section id="media-request-submit-section" className="project-detail-card media-request-submit-card">
          <header className="project-detail-card-header"><div><h2>{editable ? (isReturned ? '重新提交申请' : '提交申请') : '申请状态'}</h2><p>{editable ? (isReturned ? '请先按退回意见完成请款内容和付款清单修正；重新提交后将回到原退回审批节点。' : '提交后进入“合作项目”审批工作台，草稿不会出现在审批列表。') : '该项目已进入“合作项目”审批工作台，当前页面保留关联资料快照。'}</p></div></header>
          {editable ? submissionIssues.length ? (
            <div className="media-request-issue-list"><AlertTriangle size={18} /><div><strong>暂不能提交</strong>{submissionIssues.map((issue) => <span key={issue}>{issue}</span>)}</div></div>
          ) : <NoticeBanner>资料与付款账户快照校验通过，可以提交审批。</NoticeBanner> : (
            <NoticeBanner>申请当前状态：{selectedMyProjectStatus}。审批处理请前往“合作项目”工作台。</NoticeBanner>
          )}
          {editable ? <div className="media-request-submit-actions">
            <Button icon={<Send size={17} />} disabled={!canSubmit} onClick={() => onSubmitRequest(selectedRequest)}>{isReturned ? '重新提交' : '提交申请'}</Button>
          </div> : null}
        </section> : null}
          </div>
          <aside className="project-detail-card project-progress-card" aria-label="请款进度">
            <header className="project-detail-card-header"><div><h2>请款进度</h2><p>项目资料、审核与打款状态。</p></div></header>
            <div className="project-progress-list">
              {progress.map((step, index) => (
                <div className={`project-progress-item progress-${step.state}`} key={step.label}>
                  <span className="project-progress-node">
                    {step.state === 'complete' ? <Check size={15} aria-hidden="true" /> : step.state === 'current' ? <Clock3 size={15} aria-hidden="true" /> : index + 1}
                  </span>
                  <div><strong>{step.label}</strong><p>{step.description}</p><small>{step.time}</small></div>
                </div>
              ))}
            </div>
          </aside>
        </div>
        {cancelRequestModal}
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        title="我的请款项目"
        subtitle="仅展示与当前账号关联的项目，集中管理合同与 Invoice、达人名单和请款进度。"
        actions={canCreate ? <Button icon={<Plus size={17} />} onClick={openCreateForm}>新建请款审批</Button> : undefined}
      />
      <div className="metrics-grid">
        <article className="metric-card metric-peach"><span>审核中</span><strong>{metrics.reviewTotal}</strong><small>{metrics.reviewing} 个正在审批</small></article>
        <article className="metric-card"><span>待打款</span><strong>{metrics.waitingPayment}</strong><small>已完成全部审批</small></article>
        <article className="metric-card metric-lilac"><span>请款项目总数</span><strong>{metrics.total}</strong><small>已完成打款审批项目</small></article>
      </div>
      {pendingRequestCount ? (
        <div className="media-request-return-notice" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>{pendingRequestCount} 个请款项目待处理</strong>
            <p>其中 {returnedRequests.length} 个付款信息有误，{paymentFailureRequests.length} 个打款失败。请在下方列表中点击“处理退回”或“处理失败请款”，查看原因并处理。</p>
          </div>
        </div>
      ) : null}
      <section className="content-card">
        <ProjectInlineFilterPanel
          search={search}
          filters={filters}
          customerOptions={customerFilterOptions}
          pmOptions={pmFilterOptions}
          currencyOptions={currencyFilterOptions}
          statusOptions={statusFilterOptions}
          resultCount={filteredRequests.length}
          totalCount={visibleRequests.length}
          invalidBudgetRange={invalidBudgetRange}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onClear={() => { setSearch(''); setFilters(createEmptyPaymentRequestListFilters()); }}
        />
        <div className="table-scroll">
          <table className="data-table operational-table media-payment-project-table">
            <thead><tr><th>项目编号</th><th>关联项目</th><th>品牌</th><th>负责 PM</th><th>达人</th><th>请款金额</th><th>状态</th><th className="action-cell">操作</th></tr></thead>
            <tbody>
              {paginatedRequests.map((request) => {
                const returnDetails = requestApprovalReturnDetails(request.approval);
                const isReturned = request.lifecycle === 'RETURNED';
                const failedPayouts = failurePayoutsForRequest(request);
                const hasPaymentFailure = failedPayouts.length > 0;
                const canShowConfirmationExport = (
                  currentUser.roleKey === 'media'
                  && request.media === currentScopeName
                  && request.lifecycle === 'COMPLETED'
                );
                const confirmationItems = canShowConfirmationExport
                  ? mediaConfirmationItemsFor(request, paymentLists)
                  : [];
                const isExporting = exportingRequestId === request.id;
                return (
                  <tr
                    className={`media-payment-project-row${hasPaymentFailure ? ' media-request-payment-failure-row' : isReturned ? ' media-request-returned-row' : ''}`}
                    key={request.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`查看项目 ${requestCodeFor(request)}`}
                    onClick={() => openRequestDetail(request)}
                    onKeyDown={(event) => {
                      if (event.currentTarget !== event.target || !['Enter', ' '].includes(event.key)) return;
                      event.preventDefault();
                      openRequestDetail(request);
                    }}
                  >
                    <td><strong>{requestCodeFor(request)}</strong></td>
                    <td><strong>{request.cooperationProjectName ?? request.project}</strong><small className="cell-subtext">{request.cooperationProjectCode ?? request.projectId ?? '待同步'}</small></td>
                    <td>{request.brand || '—'}</td>
                    <td>{request.pm}</td>
                    <td>{request.creatorLinks?.length ?? request.invoices} 位</td>
                    <td>{request.amount}</td>
                    <td>
                      <div className="media-request-list-status">
                        <ProjectStatus status={requestStatusForDisplay(request)} />
                        {isReturned && !hasPaymentFailure ? (
                          <small title={returnDetails?.reason}>
                            {returnDetails?.stage === 'FINANCE' ? '付款工作台' : returnDetails?.stageLabel ?? '审批流'} · {returnDetails?.reason ?? '请查看退回原因'}
                          </small>
                        ) : null}
                        {isReturned && failedPayouts.length ? <small>{failedPayouts.length} 笔失败款待恢复</small> : null}
                      </div>
                    </td>
                    <td className="action-cell" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      <div className="media-project-row-actions">
                        <ListActionButton
                          kind={hasPaymentFailure || isReturned ? 'danger' : 'view'}
                          onClick={() => openRequestDetail(request)}
                        >
                          {hasPaymentFailure
                            ? (canCreate ? '处理失败请款' : '查看失败请款')
                            : isReturned
                              ? (canCreate ? '处理退回' : '查看退回')
                              : '查看项目'}
                        </ListActionButton>
                        {canShowConfirmationExport ? (
                          <>
                            <ListActionButton
                              kind="download"
                              className="media-project-confirmation-action"
                              disabled={!confirmationItems.length || Boolean(exportingRequestId)}
                              loading={isExporting}
                              title={!confirmationItems.length ? '没有已付款的 Airwallex 付款明细' : undefined}
                              onClick={() => { void exportProjectConfirmations(request, confirmationItems); }}
                            >
                              {isExporting ? '导出中...' : '导出确认函'}
                            </ListActionButton>
                            {!confirmationItems.length ? <small>无已付款 Airwallex 明细</small> : null}
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredRequests.length ? <tr><td colSpan={8} className="project-list-empty">暂无符合当前搜索与筛选条件的项目</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>共 {filteredRequests.length} 个项目</span>
          <Pagination
            ariaLabel="我的请款项目列表分页"
            page={page}
            pageSize={pageSize}
            total={filteredRequests.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </section>
      {creating ? (
        <Modal
          title={editingRequest ? `编辑请款 · ${requestCodeFor(editingRequest)}` : '新建请款'}
          onClose={closeForm}
          width="820px"
          footer={<><Button variant="ghost" onClick={closeForm}>取消</Button><Button onClick={saveRequest}>{editingRequest ? '保存修改' : '创建请款'}</Button></>}
        >
          <div className="form-grid single-column project-create-form media-request-create-form">
            <div className="form-field">
              <span className="form-field-label">关联项目 <em className="required-mark" aria-hidden="true">*</em></span>
              <SelectField
                ariaLabel="选择合作项目"
                variant="form"
                value={cooperationProjectId}
                disabled={!creatorSelectionEditable}
                options={selectableCooperationProjects.map((project) => {
                  const projectId = cooperationProjectIdFor(project);
                  const requestCount = requestCountByCooperationProject.get(projectId) ?? 0;
                  return {
                    value: projectId,
                    label: project.name,
                    description: `${project.cooperationProjectCode ?? project.projectCode ?? project.id} · ${requestCount ? `已有 ${requestCount} 个请款记录` : '暂无请款记录'}`,
                  };
                })}
                onChange={changeProject}
                placeholder="请选择飞书合作项目"
              />
            </div>
            <label><span>品牌 <small className="request-optional-label">选填</small></span><input placeholder="输入品牌或客户名称" value={brand} onChange={(event) => setBrand(event.target.value)} /></label>
            <div className="form-field"><span className="form-field-label">项目 PM <em className="required-mark" aria-hidden="true">*</em></span><SelectField ariaLabel="选择项目 PM" variant="form" value={pm} options={PM_USERS.map((user) => ({ value: user.name, label: user.name, description: user.email }))} onChange={setPm} /></div>
            <div className="media-request-payment-plan">
              <div className="form-field">
                <span className="form-field-label">付款渠道 <em className="required-mark" aria-hidden="true">*</em></span>
                <SelectField<PaymentRequestPaymentChannel | ''>
                  ariaLabel="选择付款渠道"
                  variant="form"
                  value={paymentChannel}
                  options={PAYMENT_CHANNEL_OPTIONS}
                  onChange={setPaymentChannel}
                  placeholder="请选择付款渠道"
                />
              </div>
              <div className="form-field">
                <span id="media-request-expected-payment-date-label" className="form-field-label">预计付款时间 <em className="required-mark" aria-hidden="true">*</em></span>
                <input
                  id="media-request-expected-payment-date"
                  type="date"
                  aria-labelledby="media-request-expected-payment-date-label"
                  value={expectedPaymentDate}
                  onChange={(event) => setExpectedPaymentDate(event.target.value)}
                />
              </div>
            </div>
            <div className="form-field">
              <span className="form-field-label">成本类型 <em className="required-mark" aria-hidden="true">*</em></span>
              <SelectField<PaymentRequestCostType>
                ariaLabel="选择成本类型"
                variant="form"
                value={costType}
                options={COST_TYPE_OPTIONS}
                onChange={setCostType}
              />
            </div>
            <div className="form-field"><span id="media-request-reason-label" className="form-field-label">付款事由 <em className="required-mark" aria-hidden="true">*</em></span><textarea aria-labelledby="media-request-reason-label" placeholder="填写本项目的付款背景或用途" value={reason} onChange={(event) => setReason(event.target.value)} /></div>
            <div className="form-field media-request-remark-field">
              <span id="media-request-remark-label" className="form-field-label">备注 <small className="request-optional-label">选填</small></span>
              <textarea aria-labelledby="media-request-remark-label" placeholder="补充付款说明；可直接在此粘贴截图" value={remark} onChange={(event) => setRemark(event.target.value)} onPaste={handleRemarkPaste} />
              <small className="media-request-remark-paste-hint">支持粘贴 PNG、JPG 或 WebP 截图，图片仅保留在当前浏览器原型中。</small>
              <RequestRemarkAttachments
                attachments={remarkAttachments}
                onRemove={(attachment) => setRemarkAttachments((current) => current.filter((item) => item !== attachment))}
              />
            </div>
            <div className="form-field">
              <span className="form-field-label form-field-label-with-meta"><span>合作达人 <small className="request-optional-label">选填</small></span><small>可在创建后继续添加，当前仅展示有未占用已通过 Invoice 的达人</small></span>
              <div className="creator-picker media-request-creator-picker" data-testid="media-request-creator-picker">
                <button
                  className={`invoice-picker-trigger creator-picker-trigger ${creatorPickerOpen ? 'invoice-picker-trigger-open' : ''}`}
                  type="button"
                  disabled={!creatorSelectionEditable || !cooperationProjectId}
                  aria-expanded={creatorPickerOpen}
                  aria-controls="media-request-creator-options"
                  onClick={() => {
                    setOpenDocumentPicker(null);
                    setResourcePreview(null);
                    setCreatorPickerOpen((current) => !current);
                  }}
                >
                  <span className="invoice-picker-leading"><Users size={18} /><span className="invoice-picker-copy"><strong>{selectedCreatorIds.length ? `已选择 ${selectedCreatorIds.length} 位合作达人` : '从达人档案选择合作达人'}</strong><small>{cooperationProjectId ? '可现在选择，也可创建请款后补充' : '请先选择关联项目'}</small></span></span>
                  <ChevronDown className="invoice-picker-chevron" size={18} />
                </button>
                {selectedCreators.length ? (
                  <div className="creator-selection-chips" aria-label="已选择的合作达人">
                    {selectedCreators.map((creator) => creatorSelectionEditable ? (
                      <button className="creator-selection-chip" type="button" aria-label={`移除 ${creator.name}`} key={creator.id} onClick={() => toggleCreator(creator.id as CreatorId)}><CreatorIdentity creator={creator} socialAccountsMode="expanded" /><X size={13} aria-hidden="true" /></button>
                    ) : <span className="creator-selection-chip is-readonly" key={creator.id}><CreatorIdentity creator={creator} socialAccountsMode="expanded" /></span>)}
                    {creatorSelectionEditable ? <button className="invoice-selection-clear" type="button" onClick={() => { setSelectedCreatorIds([]); setSocialAccountIdsByCreator({}); setContractIdsByCreator({}); setInvoiceIdsByCreator({}); setAutoLinkedContractIdsByCreator({}); setOpenDocumentPicker(null); setResourcePreview(null); }}>清除已选</button> : null}
                  </div>
                ) : null}
                {creatorPickerOpen && creatorSelectionEditable ? (
                  <div id="media-request-creator-options" className="creator-options" role="listbox" aria-label="达人档案列表" aria-multiselectable="true">
                    <div className="creator-picker-search-row"><label className="creator-picker-search"><Search size={16} aria-hidden="true" /><input aria-label="搜索合作达人" placeholder="搜索 Display Name、Handle、Real Name、Company Name 或 Account Name" value={creatorSearch} onChange={(event) => setCreatorSearch(event.target.value)} /></label><span className="creator-picker-result-count" aria-live="polite"><strong>{visibleCreators.length}</strong><span>位达人</span></span></div>
                    <div className="creator-option-list">
                      {visibleCreators.map((creator) => {
                        const selected = selectedCreatorIds.includes(creator.id as CreatorId);
                        const resolution = resolutions.get(creator.id);
                        const ready = resolution?.status === 'READY';
                        const availableInvoiceCount = resolution?.availableInvoices.length ?? 0;
                        return <button className={`creator-option ${selected ? 'creator-option-selected' : ''} ${ready ? 'creator-option-ready' : ''}`} type="button" role="option" aria-selected={selected} key={creator.id} onClick={() => toggleCreator(creator.id as CreatorId)}><CreatorIdentity creator={creator} className="creator-option-profile" socialAccountsMode="expanded" /><span className="creator-option-meta"><strong>{ready ? '可加入请款' : creator.region}</strong><small>{ready ? `${availableInvoiceCount} 份可用 Invoice` : resolution ? STATUS_COPY[resolution.status] : '待选择项目'}</small></span>{selected ? <CheckCircle2 className="creator-option-mark creator-option-mark-selected" size={18} /> : <Circle className="creator-option-mark" size={18} />}</button>;
                      })}
                      {!visibleCreators.length ? <div className="creator-picker-empty">没有找到匹配的达人档案</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {selectedCreators.length ? (
              <section className="media-request-document-section">
                <header><div><h3>达人单据关联</h3><p>使用下拉框选择单据。Invoice 必填且可多选，选择后自动带入其覆盖的已确认合同。</p></div><span>{selectedCreators.length} 位达人</span></header>
                {selectedCreators.map((creator) => {
                  const resolution = resolutions.get(creator.id);
                  const selectedContractIds = contractIdsByCreator[creator.id] ?? [];
                  const selectedInvoiceIds = invoiceIdsByCreator[creator.id] ?? [];
                  const autoLinkedContractIds = autoLinkedContractIdsByCreator[creator.id] ?? [];
                  const invoicePickerId = `media-request-invoices-${creator.id}`;
                  const contractPickerId = `media-request-contracts-${creator.id}`;
                  const invoicePickerKey = `${creator.id}:invoice`;
                  const contractPickerKey = `${creator.id}:contract`;
                  const invoiceOptions = (resolution?.invoices ?? []).map((invoice): RequestResourcePickerOption => {
                    const owner = resolution?.invoiceOwners.find((item) => item.invoiceId === invoice.invoiceId)?.owner;
                    const selected = selectedInvoiceIds.includes(invoice.invoiceId);
                    const expectedProvider = paymentRequestProviderForChannel(paymentChannel || undefined);
                    const invoiceProvider = invoicePaymentListProvider(invoice);
                    const channelMismatch = Boolean(expectedProvider && invoiceProvider !== expectedProvider);
                    const invoiceNotApproved = invoice.status !== '已通过';
                    return {
                      value: invoice.invoiceId,
                      label: invoiceRequestResourceTitle(invoice, selectedProject?.name),
                      description: `${invoiceAmountLabel(invoice)} · ${owner ? `已关联 ${owner.requestCode ?? owner.id}` : invoiceNotApproved ? '尚未完成签署和审核' : channelMismatch ? `${invoiceProvider} 与所选付款渠道不一致` : selected ? '已选择' : invoice.status}`,
                      selected,
                      disabled: Boolean(owner || invoiceNotApproved || channelMismatch),
                      resource: { kind: 'invoice', invoice },
                    };
                  });
                  const contractOptions = (resolution?.contracts ?? []).flatMap<RequestResourcePickerOption>((contract) => {
                    if (!contract.contractId) return [];
                    const enabled = isContractAvailableForNewAssociation(contract);
                    const expired = getContractValidity(contract).expired;
                    const selected = selectedContractIds.includes(contract.contractId);
                    const selectedSource = autoLinkedContractIds.includes(contract.contractId)
                      ? 'Invoice 自动带入'
                      : '已选择';
                    return [{
                      value: contract.contractId,
                      label: contractRequestResourceTitle(contract),
                      description: `${formatContractMoney(contract)} · ${selected ? selectedSource : enabled ? contract.status : expired ? '不可关联：合同已失效' : `不可关联：${contract.status}`}`,
                      selected,
                      disabled: !enabled,
                      resource: { kind: 'contract', contract },
                    }];
                  });
                  return (
                    <article className="media-request-document-row" key={creator.id}>
                      <div className="media-request-document-creator"><CreatorIdentity creator={creator} /></div>
                      <div className="media-request-document-fields">
                        <div className={`media-request-document-field media-request-invoice-state is-${resolution?.status.toLowerCase() ?? 'missing'}`}>
                          <span>Invoice <em>必填，可多选</em></span>
                          <RequestResourcePicker
                            id={invoicePickerId}
                            kind="invoice"
                            creatorName={creator.name}
                            open={openDocumentPicker === invoicePickerKey}
                            selectedCount={selectedInvoiceIds.length}
                            options={invoiceOptions}
                            emptyCopy={STATUS_COPY[resolution?.status ?? 'MISSING_INVOICE']}
                            onOpenChange={(open) => {
                              setCreatorPickerOpen(false);
                              setResourcePreview(null);
                              setOpenDocumentPicker(open ? invoicePickerKey : null);
                            }}
                            onToggle={(invoiceId, selected) => {
                              if (selected) removeInvoice(creator.id as CreatorId, invoiceId as InvoiceId);
                              else addInvoice(creator.id as CreatorId, invoiceId as InvoiceId);
                            }}
                            onPreview={(resource, anchor) => setResourcePreview({
                              resource,
                              anchor: { top: anchor.top, right: anchor.right, bottom: anchor.bottom, left: anchor.left },
                            })}
                            onPreviewClose={() => setResourcePreview(null)}
                            onOpenDocument={(resource) => {
                              setResourcePreview(null);
                              setResourceDocumentDialog(resource);
                            }}
                          />
                        </div>
                        <div className="media-request-document-field media-request-contracts">
                          <span>合同 <em>选填，可多选</em></span>
                          <RequestResourcePicker
                            id={contractPickerId}
                            kind="contract"
                            creatorName={creator.name}
                            open={openDocumentPicker === contractPickerKey}
                            selectedCount={selectedContractIds.length}
                            options={contractOptions}
                            emptyCopy="该合作项目下暂无合同，可不关联"
                            onOpenChange={(open) => {
                              setCreatorPickerOpen(false);
                              setResourcePreview(null);
                              setOpenDocumentPicker(open ? contractPickerKey : null);
                            }}
                            onToggle={(contractId, selected) => {
                              if (selected) removeContract(creator.id as CreatorId, contractId as ContractId);
                              else addContract(creator.id as CreatorId, contractId as ContractId);
                            }}
                            onPreview={(resource, anchor) => setResourcePreview({
                              resource,
                              anchor: { top: anchor.top, right: anchor.right, bottom: anchor.bottom, left: anchor.left },
                            })}
                            onPreviewClose={() => setResourcePreview(null)}
                            onOpenDocument={(resource) => {
                              setResourcePreview(null);
                              setResourceDocumentDialog(resource);
                            }}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : null}
            {!cooperationProjectId ? <NoticeBanner>请先选择关联项目，再选择达人并核对合同与 Invoice。</NoticeBanner> : null}
            {cooperationProjectId && !selectedCreators.length ? (
              <NoticeBanner>
                历史请款 {selectedProjectRequestCount} 个，当前有 {selectedProjectAvailableInvoiceCount} 份未占用且已通过的 Invoice 可用于新请款。
              </NoticeBanner>
            ) : null}
            {formSubmitAttempted && formIssues.length ? <div className="media-request-form-issues" role="alert"><AlertTriangle size={17} /><div><strong>请完成以下必填项后创建请款</strong>{formIssues.map((issue) => <span key={issue}>{issue}</span>)}</div></div> : null}
          </div>
        </Modal>
      ) : null}
      {resourcePreview && typeof document !== 'undefined' ? createPortal((() => {
        const position = positionRequestResourcePreview(resourcePreview.anchor, {
          width: window.innerWidth,
          height: window.innerHeight,
        });
        return (
          <aside
            className={`request-resource-preview request-resource-preview-${resourcePreview.resource.kind}`}
            role="tooltip"
            aria-label={resourcePreview.resource.kind === 'invoice' ? 'Invoice 文档预览' : '合同文档预览'}
            style={{ left: position.left, top: position.top }}
          >
            <div className="request-resource-preview-page" aria-hidden="true">
              <RequestResourceDocumentContent resource={resourcePreview.resource} preview />
            </div>
          </aside>
        );
      })(), document.body) : null}
      {resourceDocumentDialog ? (
        <Modal
          title={resourceDocumentDialog.kind === 'invoice'
            ? `${resourceDocumentDialog.invoice.id} · Invoice`
            : contractRequestResourceTitle(resourceDocumentDialog.contract)}
          width="860px"
          className="request-resource-document-modal"
          onClose={() => setResourceDocumentDialog(null)}
          footer={<Button variant="ghost" onClick={() => setResourceDocumentDialog(null)}>关闭</Button>}
        >
          <div className={`request-resource-document-canvas is-${resourceDocumentDialog.kind}`}>
            <RequestResourceDocumentContent resource={resourceDocumentDialog} />
          </div>
        </Modal>
      ) : null}
      {cancelRequestModal}
    </div>
  );
}
