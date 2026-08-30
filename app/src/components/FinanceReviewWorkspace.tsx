import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileText,
  Files,
  GripVertical,
  Landmark,
  LoaderCircle,
  PanelRightClose,
  PanelRightOpen,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRoundCheck,
  WalletCards,
  Workflow,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import {
  contractsForFinanceReviewPage,
  financeReviewReturnReason,
  financeReviewSessionCanApprove,
  financeReviewSessionCanReturn,
  reconcileFinanceReviewSession,
  setFinanceReviewDecision,
  type FinanceReviewPage,
  type FinanceReviewSession,
  type RequestFinanceReview,
} from '../financeReview';
export { contractsForFinanceReviewPage } from '../financeReview';
import {
  type RequestApprovalReturnIssueType,
  type ContractId,
  paymentListProviders,
  type InvoiceId,
  type PaymentListId,
  type PaymentListRecord,
  type RequestApprovalStage,
} from '../businessWorkflow';
import {
  REQUEST_APPROVAL_STATUS_LABEL,
  requestApprovalStage,
} from '../requestApprovalWorkflow';
import type { SystemUser } from '../data';
import { formatContractMoney, getContractReadiness, type ContractRecord } from '../contracts';
import { contractDocumentFilename, invoiceDocumentName } from '../documentFilenames';
import {
  downloadBlob,
  formatInvoiceMoney,
  invoiceFilename,
  invoiceTotal,
} from '../invoice/invoiceUtils';
import {
  createFlatProjectPdfArchive,
  projectPdfArchiveFilename,
  type ProjectPdfArchiveKind,
} from '../projectResourcePdfArchive';
import type { CreatorProfile, GeneratedInvoiceRecord } from '../types';
import { paymentCreatorIdentityFromValues } from '../paymentCreatorIdentity';
import type { RequestProjectSummary } from '../pages/RequestProjectDetailPage';
import { ContractDocumentView } from './ContractDocumentView';
import { InvoiceDocumentView } from './InvoiceDocumentView';
import { PaymentListReviewContent } from './PaymentListReviewContent';
import { requestLinkedContracts, requestLinkedInvoices } from './RequestProjectResourceManager';
import { Button, Modal, SelectField, type SelectOption } from './Common';
import { PaymentCreatorIdentity } from './PaymentCreatorIdentity';
import { paymentProviderDisplayName } from './PaymentProviderBadge';
import './FinanceReviewWorkspace.css';

type FinanceReviewPane = 'invoice' | 'payment' | 'approval';
type FinanceReviewStage = 'overview' | 'validation';
export type ReviewDocumentKind = 'invoice' | 'contract';

const REVIEW_PANE_OPTIONS: Array<{
  id: FinanceReviewPane;
  label: string;
}> = [
  { id: 'invoice', label: 'Invoice' },
  { id: 'payment', label: '付款清单' },
  { id: 'approval', label: '项目与审批' },
];

export const FINANCE_RETURN_ISSUE_OPTIONS: readonly SelectOption<RequestApprovalReturnIssueType>[] = [
  { value: 'INVOICE_CONTENT', label: 'Invoice 原因', description: '仅开放该份 Invoice 修改权限' },
  { value: 'PAYMENT_LIST', label: '付款清单原因', description: '仅开放对应付款明细修改权限' },
  { value: 'CONTRACT_CONTENT', label: '合同原因', description: '仅开放指定的一份合同修改权限' },
  { value: 'FULL_ITEM', label: '整笔退回', description: '开放该达人本笔请款的合同、Invoice 和付款明细' },
];

const FINANCE_RETURN_ISSUE_LABEL: Record<RequestApprovalReturnIssueType, string> = {
  INVOICE_CONTENT: 'Invoice 原因',
  PAYMENT_LIST: '付款清单原因',
  CONTRACT_CONTENT: '合同原因',
  FULL_ITEM: '整笔退回',
};

const financeReturnIssueLabel = (issueType: RequestApprovalReturnIssueType) => (
  FINANCE_RETURN_ISSUE_LABEL[issueType]
);

const PAGE_KIND_LABEL: Record<Exclude<FinanceReviewPage['kind'], 'pair'>, string> = {
  'missing-invoice': '缺少 Invoice',
  'missing-payment': '缺少付款明细',
  'duplicate-payment': '重复付款明细',
  'extra-payment': '额外付款明细',
  'empty-request': '未关联资料',
};

const STAGE_LABEL: Record<RequestApprovalStage, string> = {
  PM: 'PM 审批',
  PROJECT_OWNER: '项目负责人审批',
  OWNER: '老板审批',
  FINANCE: '财务审批',
};

const COMPACT_APPROVAL_ICONS: Record<string, LucideIcon> = {
  submitted: Send,
  PM: ClipboardCheck,
  PROJECT_OWNER: UserRoundCheck,
  OWNER: BadgeCheck,
  FINANCE: Landmark,
  payment: CreditCard,
  'status-writeback': RefreshCw,
};

const formatReviewTime = (value?: string) => {
  if (!value) return '待处理';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const initialsFor = (value: string) => {
  const normalized = value.trim().replace(/^@/, '');
  if (!normalized) return '--';
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return normalized.slice(0, 2).toUpperCase();
};

const reviewStatusLabel = (state: 'unreviewed' | 'correct' | 'incorrect') => {
  if (state === 'correct') return '已确认无误';
  if (state === 'incorrect') return '已记录有误';
  return '待核对';
};

const MIN_INVOICE_ZOOM = 0.6;
const MAX_INVOICE_ZOOM = 2.2;
const INVOICE_ZOOM_STEP = 0.1;
const MIN_INVOICE_PANE_PERCENT = 20;
const MAX_INVOICE_PANE_PERCENT = 80;
const FINANCE_REVIEW_RESIZER_WIDTH = 44;

const ACCOUNT_VALIDATION_FIELD_IDS = new Set([
  'account-id',
  'account-version',
  'account-fingerprint',
  'real-name',
  'account-name',
  'account-number',
  'bank-name',
  'bank-address',
  'swift-code',
  'iban',
  'validation',
]);

const normalizeInvoiceZoom = (value: number) => (
  Math.round(Math.min(MAX_INVOICE_ZOOM, Math.max(MIN_INVOICE_ZOOM, value)) * 100) / 100
);

const stableContractId = (contract: ContractRecord) => contract.contractId ?? contract.id;

export const projectPaymentListsForFinanceReview = (
  request: Pick<RequestProjectSummary, 'paymentListId' | 'paymentListIds' | 'paymentRequestProjectId'>,
  paymentLists: PaymentListRecord[],
) => {
  const explicitIds = new Set([
    ...(request.paymentListIds ?? []),
    ...(request.paymentListId ? [request.paymentListId] : []),
  ]);
  const seen = new Set<PaymentListId>();
  return paymentLists.filter((list) => {
    const belongsToRequest = Boolean(
      request.paymentRequestProjectId
      && list.paymentRequestProjectId === request.paymentRequestProjectId
    ) || explicitIds.has(list.paymentListId);
    if (!belongsToRequest || seen.has(list.paymentListId)) return false;
    seen.add(list.paymentListId);
    return true;
  });
};

export function ApprovalTimeline({
  request,
  currentUser,
  paymentReady = false,
  paymentProvider,
  compact = false,
}: {
  request: RequestProjectSummary;
  currentUser?: SystemUser;
  paymentReady?: boolean;
  paymentProvider?: string;
  compact?: boolean;
}) {
  const compactCurveMaskId = `finance-approval-curve-mask-${useId().replace(/:/g, '')}`;
  const approval = request.approval;
  if (!approval) {
    return (
      <div className="finance-review-empty finance-review-empty-compact">
        <Clock3 size={22} />
        <strong>审批流尚未开始</strong>
      </div>
    );
  }
  const currentStage = requestApprovalStage(approval.status);
  const stageOrder: RequestApprovalStage[] = ['PM', 'PROJECT_OWNER', 'OWNER', 'FINANCE'];
  const resumedStage = approval.status === 'RETURNED_TO_MEDIA_REVIEW' && approval.resumeStatus
    ? requestApprovalStage(approval.resumeStatus)
    : null;
  const progressStage = currentStage ?? resumedStage;
  const progressStageIndex = progressStage ? stageOrder.indexOf(progressStage) : -1;
  const steps = [
    {
      id: 'submitted',
      label: '请款提交',
      description: `第 ${approval.round} 轮审批已提交`,
      state: 'complete' as const,
      accountName: request.media,
      actorName: request.media,
      actorMeta: '媒介账号',
      time: approval.submittedAt,
    },
    ...stageOrder.map((stage, stageIndex) => {
      const event = [...approval.history].reverse().find((candidate) => (
        candidate.round === approval.round && candidate.stage === stage
      ));
      const isCurrent = currentStage === stage;
      const hasBeenTraversed = event?.action === 'APPROVE'
        || approval.status === 'APPROVED'
        || (progressStageIndex >= 0 && stageIndex < progressStageIndex);
      const state = hasBeenTraversed
        ? 'complete' as const
        : isCurrent
          ? 'current' as const
          : 'pending' as const;
      const fallbackAccount = stage === 'PM'
        ? request.pm
        : stage === 'FINANCE' && isCurrent
          ? currentUser?.account ?? 'finance'
          : '待分配';
      const fallbackName = stage === 'PM'
        ? request.pm
        : stage === 'FINANCE' && isCurrent
          ? currentUser?.name ?? '财务'
          : STAGE_LABEL[stage].replace('审批', '');
      return {
        id: stage,
        label: STAGE_LABEL[stage],
        description: event?.action === 'APPROVE'
          ? '当前轮次已审批通过'
          : event?.action === 'RETURN'
            ? '已退回媒介修改'
            : hasBeenTraversed
              ? '审批流已通过该节点'
            : isCurrent
              ? '等待当前节点处理'
              : '上一节点通过后进入',
        state,
        accountName: event?.actorAccount ?? fallbackAccount,
        actorName: event?.actorName ?? fallbackName,
        actorMeta: event ? `${event.actorRole} · @${event.actorAccount}` : STAGE_LABEL[stage],
        time: event?.occurredAt ?? (isCurrent ? approval.updatedAt : undefined),
      };
    }),
    {
      id: 'payment',
      label: '渠道付款',
      description: paymentReady ? '财务审批已完成，等待执行付款' : '全部审批完成后执行',
      state: paymentReady ? 'current' as const : 'pending' as const,
      accountName: paymentProvider ?? '付款渠道',
      actorName: paymentProvider ?? '付款渠道',
      actorMeta: `${paymentProvider ?? '付款渠道'} · 付款渠道`,
      time: undefined,
    },
    {
      id: 'status-writeback',
      label: '状态回写',
      description: '同步渠道结果与交易状态',
      state: 'pending' as const,
      accountName: 'system',
      actorName: 'COMETS Pay',
      actorMeta: '@system · 系统自动任务',
      time: undefined,
    },
  ];
  const compactRowHeight = 84;
  const compactCurveWidth = 300;
  const compactCurveHeight = Math.ceil(steps.length / 2) * compactRowHeight;
  const compactPositions = steps.map((_step, index) => {
    const rowIndex = Math.floor(index / 2);
    const positionInRow = index % 2;
    const column = rowIndex % 2 === 0 ? positionInRow + 1 : 2 - positionInRow;
    return {
      column,
      row: rowIndex + 1,
      x: column === 1 ? 75 : 225,
      y: 23 + rowIndex * compactRowHeight,
    };
  });
  const buildCompactCurvePath = (lastIndex: number) => compactPositions
    .slice(1, lastIndex + 1)
    .reduce((path, point, index) => {
      const previous = compactPositions[index];
      if (point.row === previous.row) {
        const direction = point.x > previous.x ? 1 : -1;
        const distance = Math.abs(point.x - previous.x);
        const firstControlX = previous.x + direction * distance * 0.34;
        const secondControlX = previous.x + direction * distance * 0.66;
        return `${path} C ${firstControlX} ${previous.y - 3}, ${secondControlX} ${point.y + 3}, ${point.x} ${point.y}`;
      }
      const outerX = previous.column === 2 ? compactCurveWidth : 0;
      return `${path} C ${outerX} ${previous.y}, ${outerX} ${point.y}, ${point.x} ${point.y}`;
    }, compactPositions[0] ? `M ${compactPositions[0].x} ${compactPositions[0].y}` : '');
  const compactCurvePath = buildCompactCurvePath(compactPositions.length - 1);
  const compactProgressLastIndex = steps.reduce((lastIndex, step, index) => (
    step.state === 'complete' || step.state === 'current' ? index : lastIndex
  ), 0);
  const compactProgressPath = buildCompactCurvePath(compactProgressLastIndex);

  return (
    <div className={`finance-approval-timeline ${compact ? 'is-compact' : ''}`} aria-label="当前审批流">
      {compact ? (
        <svg
          className="finance-approval-curve"
          viewBox={`0 0 ${compactCurveWidth} ${compactCurveHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <mask
              id={compactCurveMaskId}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={compactCurveWidth}
              height={compactCurveHeight}
            >
              <rect width={compactCurveWidth} height={compactCurveHeight} fill="#fff" />
              {compactPositions.map((position, index) => (
                <circle
                  key={`curve-mask-${steps[index].id}`}
                  cx={position.x}
                  cy={position.y}
                  r="19"
                  fill="#000"
                />
              ))}
            </mask>
          </defs>
          <g mask={`url(#${compactCurveMaskId})`}>
            <path d={compactCurvePath} />
            <path className="finance-approval-curve-progress" d={compactProgressPath} />
          </g>
        </svg>
      ) : null}
      {steps.map((step, index) => {
        const CompactIcon = COMPACT_APPROVAL_ICONS[step.id] ?? Circle;
        return (
          <article
            aria-label={`${step.label}，账号 ${step.accountName}，${step.state === 'complete' ? '已完成' : step.state === 'current' ? '当前节点' : '待处理'}`}
            className={`finance-approval-step is-${step.state}`}
            key={step.id}
            style={compact ? {
              gridColumn: compactPositions[index].column,
              gridRow: compactPositions[index].row,
            } : undefined}
          >
            <span className="finance-approval-node" aria-hidden="true">
              {compact
                ? (
                    <>
                      <CompactIcon className="finance-approval-stage-icon" size={14} strokeWidth={1.8} />
                      {step.state === 'complete' ? (
                        <span className="finance-approval-state-mark">
                          <Check size={7} strokeWidth={2.6} />
                        </span>
                      ) : step.state === 'current' ? (
                        <span className="finance-approval-state-mark">
                          <Clock3 size={7} strokeWidth={2.4} />
                        </span>
                      ) : null}
                    </>
                  )
                : step.state === 'complete'
                  ? <Check size={13} />
                  : step.state === 'current'
                    ? <Clock3 size={13} />
                    : <Circle size={11} />}
            </span>
            <div className="finance-approval-stage">
              {compact ? (
                <>
                  <strong title={step.label}>{step.label}</strong>
                  <span title={step.accountName}>@{step.accountName}</span>
                </>
              ) : (
                <>
                  <div>
                    <strong>{step.label}</strong>
                    <span>{step.state === 'complete' ? '已完成' : step.state === 'current' ? (step.id === 'payment' ? '待打款' : '待审核') : '待处理'}</span>
                  </div>
                  <p>{step.description}</p>
                </>
              )}
            </div>
            {!compact ? (
              <>
                <div className="finance-approval-actor">
                  <span>{initialsFor(step.actorName)}</span>
                  <div><strong>{step.actorName}</strong><small>{step.actorMeta}</small></div>
                </div>
                <time>{formatReviewTime(step.time)}</time>
              </>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function FinanceReviewProjectOverview({
  request,
  linkedContracts,
  linkedInvoices,
  approvalLabel,
  accountValidationStatus,
  accountValidationLabel,
  currentUser,
  projectBrand,
  createdAt,
  paymentChannel,
  requestReason,
  exportingPaymentLists,
  downloadingResource,
  resourceDownloadError,
  canExportPaymentLists,
  onExportPaymentLists,
  onDownloadContracts,
  onDownloadInvoices,
  onOpenContracts,
  onOpenInvoices,
}: {
  request: RequestProjectSummary;
  linkedContracts: ContractRecord[];
  linkedInvoices: GeneratedInvoiceRecord[];
  approvalLabel: string;
  accountValidationStatus: 'pending' | 'warning' | 'passed';
  accountValidationLabel: string;
  currentUser: SystemUser;
  projectBrand: string;
  createdAt: string;
  paymentChannel: string;
  requestReason: string;
  exportingPaymentLists: boolean;
  downloadingResource: ProjectPdfArchiveKind | null;
  resourceDownloadError: string;
  canExportPaymentLists: boolean;
  onExportPaymentLists: () => void;
  onDownloadContracts: () => void;
  onDownloadInvoices: () => void;
  onOpenContracts: () => void;
  onOpenInvoices: () => void;
}) {
  return (
    <>
      <section className="finance-review-metrics" aria-label="请款项目概况">
        <article className="is-amount">
          <span><span className="finance-review-metric-icon" aria-hidden="true"><WalletCards size={13} /></span>请款金额</span>
          <strong>{request.amount}</strong>
          <small>当前请款项目总额</small>
        </article>
        <article className="is-resources">
          <span><span className="finance-review-metric-icon" aria-hidden="true"><FileText size={13} /></span>关联资料</span>
          <strong>{request.contracts + request.invoices} 份</strong>
          <small>{request.contracts} 份合同 · {request.invoices} 份 Invoice</small>
        </article>
        <article className="is-payment-order">
          <span><span className="finance-review-metric-icon" aria-hidden="true"><ReceiptText size={13} /></span>付款单</span>
          <strong>{request.paymentOrder || '待生成'}</strong>
          <small>当前请款项目付款单</small>
        </article>
        <article className="is-status">
          <span><span className="finance-review-metric-icon" aria-hidden="true"><ShieldCheck size={13} /></span>当前审批状态</span>
          <strong>{approvalLabel}</strong>
          <small>第 {request.approval?.round ?? 1} 轮审批</small>
        </article>
      </section>

      <section className="finance-review-project-section" aria-label="付款信息">
        <header>
          <div className="finance-review-section-heading"><span className="finance-review-card-title-icon is-project" aria-hidden="true"><BriefcaseBusiness size={14} /></span><strong>付款信息</strong></div>
          <Button
            className="finance-review-project-export"
            variant="secondary"
            icon={exportingPaymentLists ? <LoaderCircle className="is-spinning" size={14} /> : <Download size={14} />}
            title="导出该项目的全部付款清单"
            disabled={!canExportPaymentLists || exportingPaymentLists}
            disabledReason={exportingPaymentLists ? '付款清单正在导出，请稍候。' : '当前没有可导出的付款清单。'}
            onClick={onExportPaymentLists}
          >
            {exportingPaymentLists ? '导出中' : '导出 Excel'}
          </Button>
        </header>
        <dl className="finance-review-project-info">
          <div><dt>项目编号</dt><dd>{request.requestCode ?? request.id}</dd></div>
          <div><dt>关联项目</dt><dd>{request.cooperationProjectName ?? request.project}<small>{request.cooperationProjectCode ?? request.projectId ?? '待同步'}</small></dd></div>
          <div><dt>品牌</dt><dd>{projectBrand}</dd></div>
          <div><dt>负责 PM</dt><dd>{request.pm}</dd></div>
          <div><dt>付款渠道</dt><dd>{paymentProviderDisplayName(paymentChannel)}</dd></div>
          <div><dt>付款主体</dt><dd>{request.paymentEntity || '待补充'}</dd></div>
          <div><dt>项目费用归属</dt><dd>{request.projectCostAttribution || '待补充'}</dd></div>
          <div><dt>预计付款时间</dt><dd>{request.expectedPaymentDate || '待补充'}</dd></div>
          <div><dt>成本类型</dt><dd>{request.costType || '待补充'}</dd></div>
          <div><dt>成本类型明细</dt><dd>{request.costType === '采购成本' ? request.costTypeDetail || '待补充' : '—'}</dd></div>
          <div><dt>手续费承担方</dt><dd>{request.feeBearer || '待补充'}</dd></div>
          <div><dt>项目媒介</dt><dd>{request.media}</dd></div>
          <div><dt>创建时间</dt><dd>{createdAt}</dd></div>
          <div className="is-wide"><dt>付款事由</dt><dd>{requestReason}</dd></div>
          <div className="is-wide"><dt>备注</dt><dd>{request.remark || '未填写'}</dd></div>
          <div className="is-wide">
            <dt>备注附件</dt>
            <dd className="request-remark-attachment-summary">
              {request.remarkAttachments?.length
                ? request.remarkAttachments.map((attachment) => <span key={`${attachment.name}-${attachment.size}-${attachment.lastModified}`}><FileText size={14} aria-hidden="true" />{attachment.name}</span>)
                : '无附件'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="finance-review-project-section" aria-label="当前审批流">
        <header><div className="finance-review-section-heading"><span className="finance-review-card-title-icon is-workflow" aria-hidden="true"><Workflow size={14} /></span><strong>当前审批流</strong></div><span>第 {request.approval?.round ?? 1} 轮</span></header>
        <ApprovalTimeline request={request} currentUser={currentUser} compact />
      </section>

      <section className="finance-review-project-section finance-review-linked-resources" aria-label="关联资料">
        <header>
          <div className="finance-review-section-heading finance-review-linked-resource-heading">
            <span className="finance-review-card-title-icon is-resources" aria-hidden="true"><Files size={14} /></span>
            <span className="finance-review-linked-resource-title">
              <strong>关联资料</strong>
              <small>合同、Invoice 与收款账户校验汇总</small>
            </span>
          </div>
          <span>项目级汇总</span>
        </header>
        <div className="finance-review-resource-list">
          <div className="finance-review-resource-row">
            <span className="finance-review-resource-icon" aria-hidden="true"><FileText size={15} /></span>
            <strong>合同 · {linkedContracts.length} 份</strong>
            <div className="finance-review-resource-actions">
              <button type="button" disabled={!linkedContracts.length} onClick={onOpenContracts}>查看全部</button>
              <button
                type="button"
                aria-label="打包下载全部合同"
                disabled={!linkedContracts.length || downloadingResource !== null}
                title="下载该请款项目的全部合同 PDF"
                onClick={onDownloadContracts}
              >
                {downloadingResource === 'contract'
                  ? <LoaderCircle className="is-spinning" size={12} />
                  : <Download size={12} />}
                {downloadingResource === 'contract' ? '打包中' : '下载'}
              </button>
            </div>
          </div>
          <div className="finance-review-resource-row">
            <span className="finance-review-resource-icon" aria-hidden="true"><ReceiptText size={15} /></span>
            <strong>Invoice · {linkedInvoices.length} 份</strong>
            <div className="finance-review-resource-actions">
              <button type="button" disabled={!linkedInvoices.length} onClick={onOpenInvoices}>查看全部</button>
              <button
                type="button"
                aria-label="打包下载全部 Invoice"
                disabled={!linkedInvoices.length || downloadingResource !== null}
                title="下载该请款项目的全部 Invoice PDF"
                onClick={onDownloadInvoices}
              >
                {downloadingResource === 'invoice'
                  ? <LoaderCircle className="is-spinning" size={12} />
                  : <Download size={12} />}
                {downloadingResource === 'invoice' ? '打包中' : '下载'}
              </button>
            </div>
          </div>
          <div className="finance-review-resource-row">
            <span className="finance-review-resource-icon" aria-hidden="true"><Landmark size={15} /></span>
            <strong>收款账户校验结果</strong>
            <span className={`finance-review-resource-status is-${accountValidationStatus}`}>{accountValidationLabel}</span>
          </div>
        </div>
        {resourceDownloadError ? (
          <p className="finance-review-resource-error" role="alert">{resourceDownloadError}</p>
        ) : null}
      </section>
    </>
  );
}

export function FinanceReviewWorkspace({
  request,
  financeReview,
  generatedInvoices,
  contracts,
  paymentLists,
  creators,
  currentUser,
  session,
  onSessionChange,
  onApprove,
  onReturn,
  onExportPaymentList,
  onOpenContract,
  onOpenInvoice,
  initialResourceDialog,
  initialResourceRecordId,
  onResourceRestoreConsumed,
  onClose,
}: {
  request: RequestProjectSummary;
  financeReview: RequestFinanceReview;
  generatedInvoices: GeneratedInvoiceRecord[];
  contracts: ContractRecord[];
  paymentLists: PaymentListRecord[];
  creators: CreatorProfile[];
  currentUser: SystemUser;
  session?: FinanceReviewSession;
  onSessionChange: (session: FinanceReviewSession) => void;
  onApprove: () => boolean;
  onReturn: (reason: string) => boolean;
  onExportPaymentList: (paymentListId: PaymentListId) => Promise<void>;
  onOpenContract: (contractId: string) => void;
  onOpenInvoice: (invoiceId: InvoiceId) => void;
  initialResourceDialog?: 'contract' | 'invoice' | null;
  initialResourceRecordId?: string | null;
  onResourceRestoreConsumed?: () => void;
  onClose: (completed?: boolean) => void;
}) {
  const activeSession = reconcileFinanceReviewSession(session, {
    requestId: request.id,
    approvalRound: request.approval?.round ?? 0,
    reviewerAccount: currentUser.account,
    review: financeReview,
  });
  const firstPendingIndex = Math.max(0, financeReview.pages.findIndex((page) => (
    activeSession.decisions[page.key]?.state !== 'correct'
  )));
  const [stage, setStage] = useState<FinanceReviewStage>('overview');
  const [reviewIndex, setReviewIndex] = useState(firstPendingIndex);
  const [activePane, setActivePane] = useState<FinanceReviewPane>('invoice');
  const [approvalCollapsed, setApprovalCollapsed] = useState(false);
  const [invoicePanePercent, setInvoicePanePercent] = useState(40);
  const [paneResizing, setPaneResizing] = useState(false);
  const [documentKind, setDocumentKind] = useState<ReviewDocumentKind>('invoice');
  const [selectedContractId, setSelectedContractId] = useState('');
  const [invoiceZoom, setInvoiceZoom] = useState(1);
  const [issueEditorOpen, setIssueEditorOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [resourceDialog, setResourceDialog] = useState<'contract' | 'invoice' | null>(initialResourceDialog ?? null);
  const [exportingPaymentLists, setExportingPaymentLists] = useState(false);
  const [downloadingResource, setDownloadingResource] = useState<ProjectPdfArchiveKind | null>(null);
  const [downloadingResourceRecord, setDownloadingResourceRecord] = useState('');
  const [resourceDownloadError, setResourceDownloadError] = useState('');
  const [issueType, setIssueType] = useState<RequestApprovalReturnIssueType | ''>('');
  const [issueContractId, setIssueContractId] = useState('');
  const [issueReason, setIssueReason] = useState('');
  const invoiceCanvasRef = useRef<HTMLDivElement>(null);
  const invoiceZoomRef = useRef(1);
  const overviewFocusRef = useRef<HTMLDivElement>(null);
  const validationFocusRef = useRef<HTMLDivElement>(null);
  const comparisonPanesRef = useRef<HTMLDivElement>(null);
  const resourceListRef = useRef<HTMLDivElement>(null);
  const restoredResourceRef = useRef('');

  useEffect(() => {
    if (!initialResourceDialog || !initialResourceRecordId) return;
    const restoreKey = `${initialResourceDialog}:${initialResourceRecordId}`;
    if (restoredResourceRef.current === restoreKey) return;
    setResourceDialog(initialResourceDialog);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = Array.from(
          resourceListRef.current?.querySelectorAll<HTMLElement>('[data-resource-record-id]') ?? [],
        ).find((element) => element.dataset.resourceRecordId === initialResourceRecordId);
        target?.scrollIntoView({ block: 'center' });
        target?.focus({ preventScroll: true });
        restoredResourceRef.current = restoreKey;
        onResourceRestoreConsumed?.();
      });
    });
  }, [initialResourceDialog, initialResourceRecordId, onResourceRestoreConsumed]);

  const changeStage = (nextStage: FinanceReviewStage) => {
    setStage(nextStage);
    setApprovalCollapsed(nextStage === 'validation');
    if (nextStage === 'validation') setActivePane('invoice');
    window.requestAnimationFrame(() => {
      if (nextStage === 'validation') validationFocusRef.current?.focus();
      else overviewFocusRef.current?.focus();
    });
  };

  const updateInvoicePanePercentFromPointer = (clientX: number) => {
    const bounds = comparisonPanesRef.current?.getBoundingClientRect();
    const availableWidth = (bounds?.width ?? 0) - FINANCE_REVIEW_RESIZER_WIDTH;
    if (!bounds || availableWidth <= 0) return;
    const pointerPosition = clientX - bounds.left - FINANCE_REVIEW_RESIZER_WIDTH / 2;
    const nextPercent = (pointerPosition / availableWidth) * 100;
    setInvoicePanePercent(Math.min(
      MAX_INVOICE_PANE_PERCENT,
      Math.max(MIN_INVOICE_PANE_PERCENT, nextPercent),
    ));
  };

  const openResourceDialog = (kind: 'contract' | 'invoice') => {
    setResourceDownloadError('');
    setResourceDialog(kind);
  };

  const closeResourceDialog = () => {
    setResourceDownloadError('');
    setResourceDialog(null);
  };

  const setInvoiceZoomLevel = useCallback((value: number, anchor?: { clientX: number; clientY: number }) => {
    const nextZoom = normalizeInvoiceZoom(value);
    const previousZoom = invoiceZoomRef.current;
    if (nextZoom === previousZoom) return;

    const canvas = invoiceCanvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const offsetX = rect && anchor ? anchor.clientX - rect.left : 0;
    const offsetY = rect && anchor ? anchor.clientY - rect.top : 0;
    const contentX = canvas && anchor ? (canvas.scrollLeft + offsetX) / previousZoom : 0;
    const contentY = canvas && anchor ? (canvas.scrollTop + offsetY) / previousZoom : 0;

    invoiceZoomRef.current = nextZoom;
    setInvoiceZoom(nextZoom);

    if (canvas && anchor) {
      requestAnimationFrame(() => {
        canvas.scrollTo({
          left: Math.max(0, contentX * nextZoom - offsetX),
          top: Math.max(0, contentY * nextZoom - offsetY),
        });
      });
    }
  }, []);

  useEffect(() => {
    setReviewIndex((current) => Math.min(current, Math.max(0, financeReview.pages.length - 1)));
  }, [financeReview.fingerprint, financeReview.pages.length]);

  useEffect(() => {
    if (stage !== 'validation') return undefined;
    const canvas = invoiceCanvasRef.current;
    if (!canvas) return undefined;

    const handleInvoiceWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setInvoiceZoomLevel(invoiceZoomRef.current * Math.exp(-event.deltaY * 0.003), {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    canvas.addEventListener('wheel', handleInvoiceWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleInvoiceWheel);
  }, [setInvoiceZoomLevel, stage]);

  const safeReviewIndex = Number.isFinite(reviewIndex)
    ? Math.min(Math.max(0, reviewIndex), Math.max(0, financeReview.pages.length - 1))
    : 0;
  const currentPage = financeReview.pages[safeReviewIndex];
  const currentDecision = currentPage
    ? activeSession.decisions[currentPage.key] ?? { state: 'unreviewed' as const }
    : { state: 'unreviewed' as const };
  const invoice = currentPage
    ? generatedInvoices.find((record) => record.invoiceId === currentPage.invoiceId)
    : undefined;
  const reviewPaymentListIds = new Set(financeReview.pages.flatMap((page) => (
    page.paymentItems.map((item) => item.paymentListId)
  )));
  const reviewPaymentLists = paymentLists.filter((list) => reviewPaymentListIds.has(list.paymentListId));
  const projectPaymentLists = projectPaymentListsForFinanceReview(request, paymentLists);
  const linkedContracts = requestLinkedContracts(request, contracts);
  const linkedInvoices = requestLinkedInvoices(request, generatedInvoices);
  const currentContracts = contractsForFinanceReviewPage({
    page: currentPage,
    invoice,
    request,
    contracts,
    paymentLists,
  });
  const currentContractKey = currentContracts.map(stableContractId).join('|');
  const selectedContract = currentContracts.find((contract) => stableContractId(contract) === selectedContractId);
  const activeDocumentAvailable = documentKind === 'contract' ? Boolean(selectedContract) : Boolean(invoice);
  const activeDocumentLabel = documentKind === 'contract' ? '合同快照' : 'Invoice 快照';
  const documentSwitcherLabel = documentKind === 'invoice' ? '切换合同快照' : '切换 Invoice 快照';
  const activeDocumentMeta = documentKind === 'contract'
    ? selectedContract
      ? `${selectedContract.sourceName || selectedContract.name} · ${selectedContract.pageCount ?? 1} 页`
      : '未关联合同'
    : `${currentPage?.invoiceNumber ?? '未关联'}.pdf · 1 页`;
  const documentKindOptions: readonly SelectOption<ReviewDocumentKind>[] = [
    {
      value: 'invoice',
      label: 'Invoice 快照',
      leading: <ReceiptText size={15} />,
    },
    {
      value: 'contract',
      label: '合同快照',
      description: currentContracts.length ? `${currentContracts.length} 份可查看` : '没有合同',
      title: currentContracts.length ? undefined : '没有合同',
      disabled: currentContracts.length === 0,
      leading: <Files size={15} />,
    },
  ];
  const contractOptions: readonly SelectOption<string>[] = currentContracts.map((contract) => ({
    value: stableContractId(contract),
    label: contract.id,
    description: [contract.name, contract.sourceName].filter(Boolean).join(' · ') || '合同快照',
    leading: <FileText size={15} />,
  }));
  const returnIssueOptions: readonly SelectOption<RequestApprovalReturnIssueType>[] = FINANCE_RETURN_ISSUE_OPTIONS.map((option) => (
    option.value === 'CONTRACT_CONTENT' && currentContracts.length === 0
      ? {
          ...option,
          disabled: true,
          title: '当前达人无关联合同',
          description: '当前达人无关联合同',
        }
      : option
  ));
  const accountValidationIssueCount = financeReview.pages.reduce((count, page) => (
    page.kind !== 'pair'
      ? count + 1
      : count + page.fields.filter((field) => (
          ACCOUNT_VALIDATION_FIELD_IDS.has(field.id) && field.state === 'mismatch'
        )).length
  ), 0);
  const accountValidationStatus = financeReview.pageCount === 0
    ? 'pending' as const
    : accountValidationIssueCount > 0
      ? 'warning' as const
      : 'passed' as const;
  const accountValidationLabel = accountValidationStatus === 'passed'
    ? '已通过'
    : accountValidationStatus === 'warning'
      ? `${accountValidationIssueCount} 项需处理`
      : '待校验';
  const currentPaymentRowCount = currentPage?.paymentItems.length ?? 0;
  const approvalLabel = request.approval
    ? REQUEST_APPROVAL_STATUS_LABEL[request.approval.status]
    : request.status;
  const createdAt = formatReviewTime(request.createdAt ?? request.approval?.submittedAt);
  const paymentChannel = request.paymentChannel
    || [...new Set(reviewPaymentLists.flatMap(paymentListProviders))].join(' / ')
    || '待补充';
  const projectBrand = request.generatedDetail?.brand ?? request.brand ?? '待补充';
  const requestReason = request.generatedDetail?.reason ?? '未单独填写';
  const counts = financeReview.pages.reduce((result, page) => {
    const state = activeSession.decisions[page.key]?.state ?? 'unreviewed';
    return { ...result, [state]: result[state] + 1 };
  }, { correct: 0, incorrect: 0, unreviewed: 0 });
  const canApprove = financeReviewSessionCanApprove(activeSession, financeReview);
  const allPagesReviewed = financeReview.pageCount > 0 && counts.unreviewed === 0;
  const canReturn = financeReviewSessionCanReturn(activeSession, financeReview);
  const canConfirmCurrentPage = Boolean(
    currentPage
    && currentPage.mismatchCount === 0
    && currentDecision.state !== 'incorrect'
  );
  const returnReason = financeReviewReturnReason(activeSession, financeReview);
  const reviewGuidance = counts.unreviewed > 0
    ? `请先完成剩余 ${counts.unreviewed} 份 Invoice 与付款清单核对；全部核对后，可一次性汇总有误项并退回媒介。`
    : counts.incorrect > 0
      ? `全部核对已完成，可一次性退回 ${counts.incorrect} 份有误记录。`
      : allPagesReviewed
        ? '全部核对完成，可提交财务审核。'
        : '请完成全部 Invoice 与付款清单核对后再提交审核结果。';

  useEffect(() => {
    const firstContractId = currentContracts[0] ? stableContractId(currentContracts[0]) : '';
    setDocumentKind('invoice');
    setSelectedContractId(firstContractId);
    setInvoiceZoomLevel(1);
  }, [currentPage?.key, currentContractKey, setInvoiceZoomLevel]);

  const goTo = (nextIndex: number) => {
    setReviewIndex(Math.min(Math.max(0, nextIndex), Math.max(0, financeReview.pages.length - 1)));
  };

  const changeDocumentKind = (nextKind: ReviewDocumentKind) => {
    if (nextKind === 'contract' && !currentContracts.length) return;
    setDocumentKind(nextKind);
    setInvoiceZoomLevel(1);
    if (nextKind === 'contract' && !selectedContractId && currentContracts[0]) {
      setSelectedContractId(stableContractId(currentContracts[0]));
    }
  };

  const changeContract = (nextContractId: string) => {
    if (!currentContracts.some((contract) => stableContractId(contract) === nextContractId)) return;
    setSelectedContractId(nextContractId);
    setInvoiceZoomLevel(1);
  };

  const openIssueEditor = () => {
    setIssueType(currentDecision.state === 'incorrect' ? currentDecision.issueType : '');
    setIssueReason(currentDecision.state === 'incorrect' ? currentDecision.reason : '');
    const savedContractId = currentDecision.state === 'incorrect'
      ? currentDecision.contractIds?.[0]
      : undefined;
    const suggestedContractId = documentKind === 'contract' && selectedContractId
      ? selectedContractId
      : currentContracts.length === 1
        ? stableContractId(currentContracts[0])
        : '';
    setIssueContractId(savedContractId ? String(savedContractId) : suggestedContractId);
    setIssueEditorOpen(true);
  };

  const changeIssueType = (nextIssueType: RequestApprovalReturnIssueType | '') => {
    setIssueType(nextIssueType);
    if (nextIssueType !== 'CONTRACT_CONTENT') {
      setIssueContractId('');
      return;
    }
    if (documentKind === 'contract' && selectedContractId) {
      setIssueContractId(selectedContractId);
      return;
    }
    setIssueContractId(currentContracts.length === 1 ? stableContractId(currentContracts[0]) : '');
  };

  const saveIssue = () => {
    if (
      !currentPage
      || !issueType
      || !issueReason.trim()
      || (issueType === 'CONTRACT_CONTENT' && !issueContractId)
    ) return;
    const contractIds = issueType === 'CONTRACT_CONTENT'
      ? [issueContractId as ContractId]
      : issueType === 'FULL_ITEM'
        ? currentContracts.map((contract) => stableContractId(contract) as ContractId)
        : undefined;
    onSessionChange(setFinanceReviewDecision(activeSession, currentPage.key, {
      state: 'incorrect',
      issueType,
      reason: issueReason.trim(),
      contractIds,
      reviewedAt: new Date().toISOString(),
    }));
    setIssueEditorOpen(false);
  };

  const confirmCurrentPage = () => {
    if (!currentPage || !canConfirmCurrentPage) return;
    const nextSession = setFinanceReviewDecision(activeSession, currentPage.key, {
      state: 'correct',
      reviewedAt: new Date().toISOString(),
    });
    onSessionChange(nextSession);
    const nextPending = financeReview.pages.findIndex((page, index) => (
      index > reviewIndex && nextSession.decisions[page.key]?.state !== 'correct'
    ));
    const firstPending = financeReview.pages.findIndex((page) => (
      nextSession.decisions[page.key]?.state !== 'correct'
    ));
    const target = nextPending >= 0 ? nextPending : firstPending;
    if (target >= 0) goTo(target);
  };

  const submitApproval = () => {
    if (canApprove && onApprove()) onClose(true);
  };

  const openReturnDialog = () => {
    if (!canReturn || !returnReason) return;
    setReturnDialogOpen(true);
  };

  const submitReturn = () => {
    if (canReturn && returnReason && onReturn(returnReason)) onClose(true);
  };

  const exportProjectPaymentLists = async () => {
    if (!projectPaymentLists.length || exportingPaymentLists) return;
    setExportingPaymentLists(true);
    try {
      for (const list of projectPaymentLists) {
        await onExportPaymentList(list.paymentListId);
      }
    } finally {
      setExportingPaymentLists(false);
    }
  };

  const contractPdfBlob = async (contract: ContractRecord) => {
    if (contract.generationSnapshot) {
      const { generateContractPdf } = await import('../contractGeneration');
      return generateContractPdf(
        contract.generationSnapshot,
        undefined,
        undefined,
        contract.generationVariant ?? 'FORMAL',
      );
    }
    const sourceDocument = contract.sourceDocuments?.find((document) => (
      document.mimeType === 'application/pdf' || /\.pdf$/i.test(document.fileName)
    ));
    const documentUrl = sourceDocument?.documentUrl || contract.documentUrl;
    if (!documentUrl) throw new Error(`${contract.id} 缺少可下载的 PDF 文件`);
    const response = await fetch(documentUrl);
    if (!response.ok) throw new Error(`${contract.id} PDF 下载失败`);
    return response.blob();
  };

  const invoicePdfBlob = async (linkedInvoice: GeneratedInvoiceRecord) => {
    const { generateInvoicePdf } = await import('../invoice/generateInvoice');
    return generateInvoicePdf(linkedInvoice.snapshot);
  };

  const downloadContract = async (contract: ContractRecord) => {
    const recordKey = `contract:${stableContractId(contract)}`;
    if (downloadingResource || downloadingResourceRecord) return;
    setDownloadingResourceRecord(recordKey);
    setResourceDownloadError('');
    try {
      downloadBlob(await contractPdfBlob(contract), contractDocumentFilename(contract));
    } catch (error) {
      setResourceDownloadError(error instanceof Error ? error.message : '合同下载失败，请稍后重试。');
    } finally {
      setDownloadingResourceRecord('');
    }
  };

  const downloadInvoice = async (linkedInvoice: GeneratedInvoiceRecord) => {
    const recordKey = `invoice:${linkedInvoice.invoiceId}`;
    if (downloadingResource || downloadingResourceRecord) return;
    setDownloadingResourceRecord(recordKey);
    setResourceDownloadError('');
    try {
      downloadBlob(
        await invoicePdfBlob(linkedInvoice),
        invoiceFilename(linkedInvoice.snapshot, 'pdf'),
      );
    } catch (error) {
      setResourceDownloadError(error instanceof Error ? error.message : 'Invoice 下载失败，请稍后重试。');
    } finally {
      setDownloadingResourceRecord('');
    }
  };

  const downloadProjectContracts = async () => {
    if (!linkedContracts.length || downloadingResource || downloadingResourceRecord) return;
    setDownloadingResource('contract');
    setResourceDownloadError('');
    try {
      const entries = await Promise.all(linkedContracts.map(async (contract) => ({
        filename: contractDocumentFilename(contract),
        pdfBlob: await contractPdfBlob(contract),
      })));
      const archive = await createFlatProjectPdfArchive(entries);
      downloadBlob(
        archive,
        projectPdfArchiveFilename(request.requestCode ?? request.id, 'contract'),
      );
    } catch (error) {
      setResourceDownloadError(error instanceof Error ? error.message : '合同压缩包生成失败，请稍后重试。');
    } finally {
      setDownloadingResource(null);
    }
  };

  const downloadProjectInvoices = async () => {
    if (!linkedInvoices.length || downloadingResource || downloadingResourceRecord) return;
    setDownloadingResource('invoice');
    setResourceDownloadError('');
    try {
      const entries = await Promise.all(linkedInvoices.map(async (linkedInvoice) => ({
        filename: invoiceFilename(linkedInvoice.snapshot, 'pdf'),
        pdfBlob: await invoicePdfBlob(linkedInvoice),
      })));
      const archive = await createFlatProjectPdfArchive(entries);
      downloadBlob(
        archive,
        projectPdfArchiveFilename(request.requestCode ?? request.id, 'invoice'),
      );
    } catch (error) {
      setResourceDownloadError(error instanceof Error ? error.message : 'Invoice 压缩包生成失败，请稍后重试。');
    } finally {
      setDownloadingResource(null);
    }
  };

  return (
    <>
      <Modal
        title={`${request.requestCode ?? request.id} · 财务审核`}
        width={stage === 'overview' ? '520px' : '100vw'}
        className={`finance-review-workspace is-${stage}`}
        onClose={() => onClose(false)}
        onBackdropMouseDown={() => undefined}
        footer={stage === 'overview' ? (
          <div className="finance-review-overview-footer">
            <div className="finance-review-overview-footer-note">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>进入校验后，需要逐份核对 Invoice 与付款清单。</span>
            </div>
            <div className="finance-review-overview-footer-actions">
              <Button variant="secondary" onClick={() => onClose(false)}>关闭</Button>
              <Button icon={<ArrowLeft size={16} />} onClick={() => changeStage('validation')}>
                校验审核
              </Button>
            </div>
          </div>
        ) : (
          <div className="finance-review-footer">
            <div className="finance-review-footer-primary" aria-label="当前记录审核操作">
              <div className="finance-review-page-nav" role="group" aria-label="审核记录翻页">
                <button
                  className="finance-review-page-button"
                  type="button"
                  disabled={reviewIndex === 0}
                  onClick={() => goTo(reviewIndex - 1)}
                >
                  上一页
                </button>
                <span>{financeReview.pageCount ? reviewIndex + 1 : 0} / {financeReview.pageCount}</span>
                <button
                  className="finance-review-page-button"
                  type="button"
                  disabled={reviewIndex >= financeReview.pageCount - 1}
                  onClick={() => goTo(reviewIndex + 1)}
                >
                  下一页
                </button>
              </div>
              <div className="finance-review-page-actions">
                <Button
                  variant="secondary"
                  icon={<CircleAlert size={16} />}
                  disabled={!currentPage}
                  disabledReason="当前没有可记录的审核项目。"
                  onClick={openIssueEditor}
                >
                  {currentDecision.state === 'incorrect' ? '编辑有误记录' : '记录有误'}
                </Button>
                <Button
                  variant="secondary"
                  icon={<CheckCircle2 size={16} />}
                  disabled={!canConfirmCurrentPage}
                  disabledReason="请先完成当前记录的必填核对项。"
                  onClick={confirmCurrentPage}
                >
                  确认本页无误
                </Button>
              </div>
              <div className="finance-review-footer-summary" aria-live="polite">
                <strong>{counts.correct} / {financeReview.pageCount}</strong>
                <span>{counts.incorrect ? `${counts.incorrect} 份有误` : `${counts.unreviewed} 份待核对`}</span>
              </div>
            </div>
            <div className="finance-review-footer-actions">
              {counts.incorrect > 0 ? (
                <Button
                  variant="danger"
                  icon={<AlertTriangle size={16} />}
                  disabled={!canReturn}
                  disabledReason={`仍有 ${counts.unreviewed} 份记录待核对。`}
                  title={canReturn ? '汇总全部有误记录并退回媒介' : `仍有 ${counts.unreviewed} 份记录待核对`}
                  onClick={openReturnDialog}
                >
                  退回媒介修改
                </Button>
              ) : null}
              <Button
                variant="secondary"
                icon={<ChevronLeft size={16} />}
                onClick={() => changeStage('overview')}
              >
                返回项目概览
              </Button>
              <Button icon={<ShieldCheck size={16} />} disabled={!canApprove} disabledReason={counts.incorrect ? '存在有误记录，请先退回媒介修改。' : `仍有 ${counts.unreviewed} 份记录待核对。`} onClick={submitApproval}>
                通过财务审核
              </Button>
            </div>
          </div>
        )}
      >
        <div
          className="finance-review-shell"
          data-stage={stage}
          data-testid="finance-review-workspace"
        >
          <span className="finance-review-stage-announcement" aria-live="polite">
            {stage === 'overview' ? '已打开请款项目概览' : '已进入 Invoice 与付款清单校验'}
          </span>
          {stage === 'overview' ? (
            <div
              ref={overviewFocusRef}
              className="finance-review-overview-stage"
              data-testid="finance-review-overview-stage"
              tabIndex={-1}
            >
              <header className="finance-review-overview-heading">
                <span className="finance-review-overview-heading-icon" aria-hidden="true"><BriefcaseBusiness size={19} /></span>
                <div>
                  <span>请款项目概览</span>
                  <strong>{request.cooperationProjectName ?? request.project}</strong>
                  <small>{request.requestCode ?? request.id}</small>
                </div>
                <span className="finance-review-overview-status">{approvalLabel}</span>
              </header>
              <div
                className="finance-review-overview-scroll"
                tabIndex={0}
                aria-label="付款信息、当前审批流与关联资料"
                data-testid="finance-review-overview-scroll"
              >
                <div className="finance-review-overview-intro">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <div>
                    <strong>先确认项目范围与关联资料</strong>
                    <p>确认无误后进入逐份校验，审核结论只会在校验阶段提交。</p>
                  </div>
                </div>
                <FinanceReviewProjectOverview
                  request={request}
                  linkedContracts={linkedContracts}
                  linkedInvoices={linkedInvoices}
                  approvalLabel={approvalLabel}
                  accountValidationStatus={accountValidationStatus}
                  accountValidationLabel={accountValidationLabel}
                  currentUser={currentUser}
                  projectBrand={projectBrand}
                  createdAt={createdAt}
                  paymentChannel={paymentChannel}
                  requestReason={requestReason}
                  exportingPaymentLists={exportingPaymentLists}
                  downloadingResource={downloadingResource}
                  resourceDownloadError={resourceDownloadError}
                  canExportPaymentLists={projectPaymentLists.length > 0}
                  onExportPaymentLists={() => { void exportProjectPaymentLists(); }}
                  onDownloadContracts={() => { void downloadProjectContracts(); }}
                  onDownloadInvoices={() => { void downloadProjectInvoices(); }}
                  onOpenContracts={() => openResourceDialog('contract')}
                  onOpenInvoices={() => openResourceDialog('invoice')}
                />
              </div>
            </div>
          ) : (
            <div
              ref={validationFocusRef}
              className="finance-review-validation-stage"
              data-testid="finance-review-validation-stage"
              tabIndex={-1}
            >
              <header className="finance-review-overview">
            <div className="finance-review-title-group">
              <span className="finance-review-title-icon"><ShieldCheck size={19} /></span>
              <div className="finance-review-title-copy">
                <div className="finance-review-project-line">
                  <span className="finance-review-project-label">所属项目</span>
                  <strong>{request.cooperationProjectName ?? request.project}</strong>
                </div>
                <span className="finance-review-current-record">{currentPage?.invoiceNumber ?? '暂无可审核记录'} · {currentPage?.creatorName ?? '待补充'}</span>
              </div>
            </div>
            <div
              className={`finance-review-guidance${allPagesReviewed ? counts.incorrect > 0 ? ' is-return-ready' : ' is-approval-ready' : ''}`}
              role="status"
              aria-live="polite"
            >
              {allPagesReviewed
                ? counts.incorrect > 0
                  ? <AlertTriangle size={15} aria-hidden="true" />
                  : <CheckCircle2 size={15} aria-hidden="true" />
                : <CircleAlert size={15} aria-hidden="true" />}
              <span>{reviewGuidance}</span>
            </div>
            <div className="finance-review-counts" aria-live="polite">
              <span className="is-correct"><CheckCircle2 size={14} />已确认 {counts.correct}</span>
              <span className="is-incorrect"><CircleAlert size={14} />有误 {counts.incorrect}</span>
              <span><Clock3 size={14} />未审核 {counts.unreviewed}</span>
            </div>
            <span className={`finance-review-current-state is-${currentDecision.state}`}>
              {reviewStatusLabel(currentDecision.state)}
            </span>
              </header>

              <div className="finance-review-mobile-tabs" role="tablist" aria-label="财务审核内容">
            {REVIEW_PANE_OPTIONS.map((option) => (
              <button
                className={activePane === option.id ? 'is-active' : ''}
                type="button"
                role="tab"
                aria-selected={activePane === option.id}
                key={option.id}
                onClick={() => setActivePane(option.id)}
              >
                {option.label}
              </button>
            ))}
              </div>

              <div className={`finance-review-grid${approvalCollapsed ? ' is-approval-collapsed' : ''}`}>
            <div
              className={`finance-review-comparison-panes${paneResizing ? ' is-resizing' : ''}`}
              ref={comparisonPanesRef}
              style={{
                '--finance-review-invoice-size': `${invoicePanePercent}fr`,
                '--finance-review-payment-size': `${100 - invoicePanePercent}fr`,
              } as CSSProperties}
            >
            <section className={`finance-review-pane finance-review-invoice-pane${activePane === 'invoice' ? ' is-mobile-active' : ''}`}>
              <header className="finance-review-pane-header">
                <div className="finance-review-pane-heading"><span className="finance-review-pane-header-icon" aria-hidden="true">{documentKind === 'contract' ? <Files size={17} /> : <FileText size={17} />}</span><span><strong>{activeDocumentLabel}</strong><small title={activeDocumentMeta}>{activeDocumentMeta}</small></span></div>
                <div
                  className="finance-review-document-switcher finance-review-document-header-controls"
                  aria-label="凭证快照切换"
                  data-testid="finance-review-document-controls"
                >
                  <label className="finance-review-document-switch-field">
                    <span>凭证</span>
                    <SelectField<ReviewDocumentKind>
                      ariaLabel="选择凭证类型"
                      value={documentKind}
                      selectedLabel={documentSwitcherLabel}
                      options={documentKindOptions}
                      variant="form"
                      menuStrategy="fixed"
                      menuWidth={210}
                      className="finance-review-document-kind-select"
                      onChange={changeDocumentKind}
                    />
                  </label>
                  {documentKind === 'contract' ? (
                    <label className="finance-review-document-switch-field is-contract">
                      <span>合同</span>
                      <SelectField<string>
                        ariaLabel="选择具体合同"
                        value={selectedContractId}
                        options={contractOptions}
                        variant="form"
                        menuStrategy="fixed"
                        menuWidth={300}
                        className="finance-review-document-contract-select"
                        placeholder="请选择合同"
                        disabled={!contractOptions.length}
                        onChange={changeContract}
                      />
                    </label>
                  ) : null}
                </div>
                <div className="finance-review-invoice-header-actions">
                  {currentPage && currentPage.kind !== 'pair' ? <span className={`finance-review-kind is-${currentPage.kind}`}>{PAGE_KIND_LABEL[currentPage.kind]}</span> : null}
                  <div className="finance-review-zoom-controls" role="group" aria-label={`${activeDocumentLabel}缩放`}>
                    <button
                      className="icon-button"
                      type="button"
                      title={`缩小${activeDocumentLabel}`}
                      aria-label={`缩小${activeDocumentLabel}`}
                      disabled={!activeDocumentAvailable || invoiceZoom <= MIN_INVOICE_ZOOM}
                      onClick={() => setInvoiceZoomLevel(invoiceZoomRef.current - INVOICE_ZOOM_STEP)}
                    >
                      <ZoomOut size={16} />
                    </button>
                    <button
                      className="finance-review-zoom-reset"
                      type="button"
                      title="恢复 100%"
                      aria-label={`当前缩放 ${Math.round(invoiceZoom * 100)}%，点击恢复 100%`}
                      disabled={!activeDocumentAvailable || invoiceZoom === 1}
                      onClick={() => setInvoiceZoomLevel(1)}
                    >
                      {Math.round(invoiceZoom * 100)}%
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      title={`放大${activeDocumentLabel}`}
                      aria-label={`放大${activeDocumentLabel}`}
                      disabled={!activeDocumentAvailable || invoiceZoom >= MAX_INVOICE_ZOOM}
                      onClick={() => setInvoiceZoomLevel(invoiceZoomRef.current + INVOICE_ZOOM_STEP)}
                    >
                      <ZoomIn size={16} />
                    </button>
                  </div>
                </div>
              </header>
              <div
                ref={invoiceCanvasRef}
                className="finance-review-invoice-canvas"
                tabIndex={0}
                aria-label={`${activeDocumentLabel}查看区`}
                onKeyDown={(event) => {
                  if (!event.ctrlKey && !event.metaKey) return;
                  if (event.key === '+' || event.key === '=') {
                    event.preventDefault();
                    setInvoiceZoomLevel(invoiceZoomRef.current + INVOICE_ZOOM_STEP);
                  } else if (event.key === '-') {
                    event.preventDefault();
                    setInvoiceZoomLevel(invoiceZoomRef.current - INVOICE_ZOOM_STEP);
                  } else if (event.key === '0') {
                    event.preventDefault();
                    setInvoiceZoomLevel(1);
                  }
                }}
              >
                {documentKind === 'contract' ? (
                  selectedContract ? (
                    <div
                      className="finance-review-invoice-zoom-stage"
                      style={{ '--finance-review-invoice-zoom': invoiceZoom } as CSSProperties}
                    >
                      <ContractDocumentView contract={selectedContract} ariaLabel={`${selectedContract.id} 合同冻结快照`} />
                    </div>
                  ) : (
                    <div className="finance-review-empty">
                      <Files size={30} />
                      <strong>未找到合同快照</strong>
                      <p>当前达人未关联合同，无法查看合同资料。</p>
                    </div>
                  )
                ) : invoice ? (
                  <div
                    className="finance-review-invoice-zoom-stage"
                    style={{ '--finance-review-invoice-zoom': invoiceZoom } as CSSProperties}
                  >
                    <InvoiceDocumentView model={invoice.snapshot} ariaLabel={`${invoice.id} Invoice 冻结快照`} />
                  </div>
                ) : (
                  <div className="finance-review-empty">
                    <ReceiptText size={30} />
                    <strong>未找到 Invoice 快照</strong>
                    <p>{currentPage?.invoiceNumber ?? '当前请款没有可审核的 Invoice。'}</p>
                  </div>
                )}
              </div>
              <button
                className="finance-review-invoice-edge-nav is-previous"
                type="button"
                title="上一份 Invoice 与付款清单"
                aria-label="上一份 Invoice 与付款清单"
                disabled={reviewIndex === 0}
                onClick={() => goTo(reviewIndex - 1)}
              >
                <ChevronLeft size={26} strokeWidth={2.6} />
              </button>
              <button
                className="finance-review-invoice-edge-nav is-next"
                type="button"
                title="下一份 Invoice 与付款清单"
                aria-label="下一份 Invoice 与付款清单"
                disabled={reviewIndex >= financeReview.pageCount - 1}
                onClick={() => goTo(reviewIndex + 1)}
              >
                <ChevronRight size={26} strokeWidth={2.6} />
              </button>
            </section>

            <div
              className="finance-review-pane-resizer"
              role="separator"
              aria-label="调整 Invoice 快照与付款清单核对看板宽度"
              aria-orientation="vertical"
              aria-valuemin={MIN_INVOICE_PANE_PERCENT}
              aria-valuemax={MAX_INVOICE_PANE_PERCENT}
              aria-valuenow={Math.round(invoicePanePercent)}
              aria-valuetext={`Invoice ${Math.round(invoicePanePercent)}%，付款清单 ${Math.round(100 - invoicePanePercent)}%`}
              tabIndex={0}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                setPaneResizing(true);
                updateInvoicePanePercentFromPointer(event.clientX);
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                updateInvoicePanePercentFromPointer(event.clientX);
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                setPaneResizing(false);
              }}
              onPointerCancel={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                setPaneResizing(false);
              }}
              onLostPointerCapture={() => setPaneResizing(false)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                if (event.key === 'Home') setInvoicePanePercent(MIN_INVOICE_PANE_PERCENT);
                else if (event.key === 'End') setInvoicePanePercent(MAX_INVOICE_PANE_PERCENT);
                else setInvoicePanePercent((current) => Math.min(MAX_INVOICE_PANE_PERCENT, Math.max(
                  MIN_INVOICE_PANE_PERCENT,
                  current + (event.key === 'ArrowLeft' ? -2 : 2),
                )));
              }}
            >
              <GripVertical size={18} aria-hidden="true" />
            </div>

            <section className={`finance-review-pane finance-review-payment-pane${activePane === 'payment' ? ' is-mobile-active' : ''}`}>
              <header className="finance-review-pane-header">
                <div className="finance-review-pane-heading"><span className="finance-review-pane-header-icon" aria-hidden="true"><WalletCards size={17} /></span><span><strong>付款清单核对</strong><small>{currentPaymentRowCount} 条当前页冻结记录</small></span></div>
                {currentPage?.mismatchCount
                  ? <span className="finance-review-warning-count"><CircleAlert size={13} />关键字段不一致 · {currentPage.mismatchCount} 项</span>
                  : currentPage?.warningCount
                    ? <span className="finance-review-warning-count"><CircleAlert size={13} />合同信息需核对 · {currentPage.warningCount} 项</span>
                    : <span className="finance-review-match-count"><CheckCircle2 size={13} />关键字段一致</span>}
              </header>
              <div className="finance-review-payment-scroll">
                <PaymentListReviewContent
                  className="finance-payment-list-review-content"
                  paymentLists={reviewPaymentLists}
                  creators={creators}
                  financeReview={financeReview}
                  pages={financeReview.pages}
                  activeIndex={reviewIndex}
                  onActiveIndexChange={setReviewIndex}
                  onRequestPane={() => setActivePane('payment')}
                  onExportPaymentList={onExportPaymentList}
                  accountDisplay="current-full"
                  variant="finance-workspace"
                />
              </div>
            </section>
            </div>

            <aside
              id="finance-review-approval-panel"
              className={`finance-review-pane finance-review-approval-pane${activePane === 'approval' ? ' is-mobile-active' : ''}`}
            >
              <header className="finance-review-pane-header">
                <div className="finance-review-pane-heading"><span className="finance-review-pane-header-icon" aria-hidden="true"><ShieldCheck size={17} /></span><span><strong>项目与审批</strong><small>{request.requestCode ?? request.id}</small></span></div>
              </header>
              <div
                className="finance-review-approval-scroll"
                tabIndex={0}
                aria-label="项目与审批详情"
                data-testid="finance-review-approval-scroll"
              >
                <FinanceReviewProjectOverview
                  request={request}
                  linkedContracts={linkedContracts}
                  linkedInvoices={linkedInvoices}
                  approvalLabel={approvalLabel}
                  accountValidationStatus={accountValidationStatus}
                  accountValidationLabel={accountValidationLabel}
                  currentUser={currentUser}
                  projectBrand={projectBrand}
                  createdAt={createdAt}
                  paymentChannel={paymentChannel}
                  requestReason={requestReason}
                  exportingPaymentLists={exportingPaymentLists}
                  downloadingResource={downloadingResource}
                  resourceDownloadError={resourceDownloadError}
                  canExportPaymentLists={projectPaymentLists.length > 0}
                  onExportPaymentLists={() => { void exportProjectPaymentLists(); }}
                  onDownloadContracts={() => { void downloadProjectContracts(); }}
                  onDownloadInvoices={() => { void downloadProjectInvoices(); }}
                  onOpenContracts={() => openResourceDialog('contract')}
                  onOpenInvoices={() => openResourceDialog('invoice')}
                />

                {currentDecision.state === 'incorrect' ? (
                  <section className="finance-review-recorded-issue">
                    <CircleAlert size={17} />
                    <div><strong>{financeReturnIssueLabel(currentDecision.issueType)}</strong><p>{currentDecision.reason}</p></div>
                  </section>
                ) : null}
              </div>
            </aside>
            <button
              className="finance-review-approval-toggle"
              type="button"
              title={approvalCollapsed ? '展开项目与审批看板' : '收起项目与审批看板'}
              aria-label={approvalCollapsed ? '展开项目与审批看板' : '收起项目与审批看板'}
              aria-controls="finance-review-approval-panel"
              aria-expanded={!approvalCollapsed}
              onClick={() => setApprovalCollapsed((collapsed) => !collapsed)}
            >
              {approvalCollapsed
                ? <PanelRightOpen size={23} strokeWidth={2.4} />
                : <PanelRightClose size={23} strokeWidth={2.4} />}
            </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {resourceDialog === 'contract' ? (
        <Modal
          title={`${request.requestCode ?? request.id} · 合同资料`}
          width="1120px"
          className="project-resource-modal request-resource-modal finance-review-resource-modal"
          onClose={closeResourceDialog}
          footer={<Button variant="secondary" onClick={closeResourceDialog}>关闭</Button>}
        >
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading finance-review-resource-heading">
              <div><strong>全部合同</strong><p>合同名称、编号和付款金额集中展示，可逐份查看或下载。</p></div>
              <div className="finance-review-resource-heading-actions">
                <span>{linkedContracts.length} 份</span>
                <Button
                  variant="secondary"
                  icon={downloadingResource === 'contract'
                    ? <LoaderCircle className="is-spinning" size={15} />
                    : <Download size={15} />}
                  disabled={!linkedContracts.length || Boolean(downloadingResource || downloadingResourceRecord)}
                  disabledReason={downloadingResource || downloadingResourceRecord ? '合同文件正在导出，请稍候。' : '当前没有可导出的合同文件。'}
                  onClick={() => { void downloadProjectContracts(); }}
                >
                  {downloadingResource === 'contract' ? '打包中' : '下载合同汇总'}
                </Button>
              </div>
            </div>
            {resourceDownloadError ? <p className="finance-review-resource-dialog-error" role="alert">{resourceDownloadError}</p> : null}
            <div className="finance-review-resource-card-list" ref={resourceListRef}>
              {linkedContracts.map((contract) => {
                const creator = creators.find((candidate) => candidate.id === contract.creatorId);
                const creatorIdentity = paymentCreatorIdentityFromValues({
                  accountName: contract.paymentSnapshot?.accountName || contract.accountName,
                  displayName: creator?.name || contract.publisher || '达人档案缺失',
                  creator,
                });
                const contractId = contract.contractId ?? contract.id;
                const recordKey = `contract:${contractId}`;
                const isDownloading = downloadingResourceRecord === recordKey;
                return (
                  <article
                    className="finance-review-resource-card"
                    key={contractId}
                    data-resource-record-id={contract.id}
                    tabIndex={-1}
                    aria-label={`${contract.name}，合同编号 ${contract.id}`}
                  >
                    <span className="finance-review-resource-card-icon" aria-hidden="true"><FileText size={19} /></span>
                    <div className="finance-review-resource-card-identity">
                      <span>合同名称</span>
                      <strong title={contract.name}>{contract.name}</strong>
                      <small><b>合同编号</b>{contract.id}</small>
                    </div>
                    <div className="finance-review-resource-card-person">
                      <span>达人</span>
                      <PaymentCreatorIdentity {...creatorIdentity} />
                    </div>
                    <div className="finance-review-resource-card-amount">
                      <span>付款金额</span>
                      <strong>{formatContractMoney(contract)}</strong>
                    </div>
                    <span className="project-record-status"><i />{getContractReadiness(contract).label}</span>
                    <div className="finance-review-resource-card-actions">
                      <Button
                        className="finance-review-resource-view"
                        variant="secondary"
                        icon={<Eye size={15} />}
                        onClick={() => onOpenContract(contract.id)}
                      >查看</Button>
                      <Button
                        className="finance-review-resource-download"
                        icon={isDownloading
                          ? <LoaderCircle className="is-spinning" size={15} />
                          : <Download size={15} />}
                        disabled={Boolean(downloadingResource || downloadingResourceRecord)}
                        disabledReason="文件正在导出，请稍候。"
                        onClick={() => { void downloadContract(contract); }}
                      >{isDownloading ? '下载中' : '下载'}</Button>
                    </div>
                  </article>
                );
              })}
              {!linkedContracts.length ? <div className="project-resource-browser-empty"><FileText size={23} /><strong>当前请款项目未关联合同</strong><p>请回到请款项目核对关联资料。</p></div> : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {resourceDialog === 'invoice' ? (
        <Modal
          title={`${request.requestCode ?? request.id} · Invoice`}
          width="1080px"
          className="project-resource-modal request-resource-modal finance-review-resource-modal"
          onClose={closeResourceDialog}
          footer={<Button variant="secondary" onClick={closeResourceDialog}>关闭</Button>}
        >
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading finance-review-resource-heading">
              <div><strong>全部 Invoice</strong><p>Invoice 名称由收款账户名和关联项目名称组成，可逐份查看或下载。</p></div>
              <div className="finance-review-resource-heading-actions">
                <span>{linkedInvoices.length} 份</span>
                <Button
                  variant="secondary"
                  icon={downloadingResource === 'invoice'
                    ? <LoaderCircle className="is-spinning" size={15} />
                    : <Download size={15} />}
                  disabled={!linkedInvoices.length || Boolean(downloadingResource || downloadingResourceRecord)}
                  disabledReason={downloadingResource || downloadingResourceRecord ? 'Invoice 文件正在导出，请稍候。' : '当前没有可导出的 Invoice 文件。'}
                  onClick={() => { void downloadProjectInvoices(); }}
                >
                  {downloadingResource === 'invoice' ? '打包中' : '下载 Invoice 汇总'}
                </Button>
              </div>
            </div>
            {resourceDownloadError ? <p className="finance-review-resource-dialog-error" role="alert">{resourceDownloadError}</p> : null}
            <div className="finance-review-resource-card-list" ref={resourceListRef}>
              {linkedInvoices.map((linkedInvoice) => {
                const creator = creators.find((candidate) => candidate.id === linkedInvoice.snapshot.creatorId);
                const creatorIdentity = paymentCreatorIdentityFromValues({
                  accountName: linkedInvoice.snapshot.payment.accountName,
                  displayName: linkedInvoice.snapshot.creatorName,
                  creator,
                });
                const invoiceName = invoiceDocumentName(linkedInvoice.snapshot);
                const recordKey = `invoice:${linkedInvoice.invoiceId}`;
                const isDownloading = downloadingResourceRecord === recordKey;
                return (
                  <article
                    className="finance-review-resource-card"
                    key={linkedInvoice.invoiceId}
                    data-resource-record-id={linkedInvoice.invoiceId}
                    tabIndex={-1}
                    aria-label={`${invoiceName}，Invoice 编号 ${linkedInvoice.id}`}
                  >
                    <span className="finance-review-resource-card-icon is-invoice" aria-hidden="true"><ReceiptText size={19} /></span>
                    <div className="finance-review-resource-card-identity">
                      <span>Invoice 名称</span>
                      <strong title={invoiceName}>{invoiceName}</strong>
                      <small><b>Invoice 编号</b>{linkedInvoice.id}</small>
                    </div>
                    <div className="finance-review-resource-card-person">
                      <span>达人</span>
                      <PaymentCreatorIdentity {...creatorIdentity} />
                    </div>
                    <div className="finance-review-resource-card-amount">
                      <span>Invoice 金额</span>
                      <strong>{formatInvoiceMoney(linkedInvoice.snapshot.currency, invoiceTotal(linkedInvoice.snapshot))}</strong>
                    </div>
                    <span className={`project-record-status${linkedInvoice.validationStatus === 'valid' ? '' : ' is-warning'}`}><i />{linkedInvoice.validationStatus === 'valid' ? '已通过' : '需重新校验'}</span>
                    <div className="finance-review-resource-card-actions">
                      <Button
                        className="finance-review-resource-view"
                        variant="secondary"
                        icon={<Eye size={15} />}
                        onClick={() => onOpenInvoice(linkedInvoice.invoiceId)}
                      >查看</Button>
                      <Button
                        className="finance-review-resource-download"
                        icon={isDownloading
                          ? <LoaderCircle className="is-spinning" size={15} />
                          : <Download size={15} />}
                        disabled={Boolean(downloadingResource || downloadingResourceRecord)}
                        disabledReason="文件正在导出，请稍候。"
                        onClick={() => { void downloadInvoice(linkedInvoice); }}
                      >{isDownloading ? '下载中' : '下载'}</Button>
                    </div>
                  </article>
                );
              })}
              {!linkedInvoices.length ? <div className="project-resource-browser-empty"><ReceiptText size={23} /><strong>当前请款项目未关联 Invoice</strong><p>请回到请款项目核对关联资料。</p></div> : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {issueEditorOpen && currentPage ? (
        <Modal
          title={`${currentPage.invoiceNumber} · 记录有误`}
          width="500px"
          onClose={() => setIssueEditorOpen(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setIssueEditorOpen(false)}>取消</Button>
              <Button
                variant="danger"
                disabled={!issueType || !issueReason.trim() || (issueType === 'CONTRACT_CONTENT' && !issueContractId)}
                disabledReason={!issueType
                  ? '请先选择问题类型。'
                  : issueType === 'CONTRACT_CONTENT' && !issueContractId
                    ? '请先选择需修改的合同。'
                    : '请先填写问题说明。'}
                onClick={saveIssue}
              >保存有误记录</Button>
            </>
          )}
        >
          <label className="finance-review-reason-field">
            <span>问题类型 <em>*</em></span>
            <SelectField<RequestApprovalReturnIssueType | ''>
              ariaLabel="财务退回问题类型"
              value={issueType}
              placeholder="请选择退回问题类型"
              variant="form"
              menuStrategy="fixed"
              options={returnIssueOptions}
              onChange={changeIssueType}
            />
            <small>所选类型决定媒介侧可修改的合同、Invoice 和付款明细范围。</small>
          </label>
          {issueType === 'CONTRACT_CONTENT' ? (
            <label className="finance-review-reason-field">
              <span>需修改合同 <em>*</em></span>
              <SelectField<string>
                ariaLabel="选择需修改合同"
                value={issueContractId}
                placeholder="请选择一份合同"
                variant="form"
                menuStrategy="fixed"
                menuWidth={320}
                options={contractOptions}
                disabled={!contractOptions.length}
                onChange={setIssueContractId}
              />
              <small>只会开放选中合同，其他关联资料继续锁定。</small>
            </label>
          ) : null}
          <label className="finance-review-reason-field">
            <span>问题说明 <em>*</em></span>
            <textarea
              autoFocus
              rows={5}
              value={issueReason}
              placeholder={issueType === 'INVOICE_CONTENT'
                ? '请说明该份 Invoice 需要修改的内容'
                : issueType === 'PAYMENT_LIST'
                  ? '请说明对应付款明细需要修改的内容'
                  : issueType === 'CONTRACT_CONTENT'
                    ? '请说明选中合同需要修改的内容'
                    : issueType === 'FULL_ITEM'
                      ? '请说明该达人本笔请款需要整体修改的内容'
                  : '请先选择问题类型，再填写具体原因'}
              onChange={(event) => setIssueReason(event.target.value)}
            />
            <small>该说明会随其他有误记录一并退回媒介。</small>
          </label>
        </Modal>
      ) : null}

      {returnDialogOpen ? (
        <Modal
          title="退回媒介修改"
          width="580px"
          onClose={() => setReturnDialogOpen(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setReturnDialogOpen(false)}>取消</Button>
              <Button variant="danger" disabled={!canReturn || !returnReason} disabledReason={!canReturn ? '仍有审核记录尚未完成核对。' : '请先填写退回原因。'} onClick={submitReturn}>确认退回</Button>
            </>
          )}
        >
          <div className="finance-review-return-summary">
            <div className="finance-review-return-heading">
              <AlertTriangle size={20} />
              <div><strong>共 {counts.incorrect} 份记录有误</strong><p>退回后将进入媒介复核，并保留以下汇总原因。</p></div>
            </div>
            <div className="finance-review-return-list">
              {financeReview.pages.flatMap((page) => {
                const decision = activeSession.decisions[page.key];
                return decision?.state === 'incorrect' ? (
                  <article key={page.key}>
                    <strong>{page.invoiceNumber}<span>{financeReturnIssueLabel(decision.issueType)}</span></strong>
                    {decision.contractIds?.length ? (
                      <small>合同范围：{decision.contractIds.map((contractId) => (
                        contracts.find((contract) => stableContractId(contract) === String(contractId))?.id
                        ?? String(contractId)
                      )).join('、')}</small>
                    ) : null}
                    <p>{decision.reason}</p>
                  </article>
                ) : [];
              })}
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
