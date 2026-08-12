import {
  AlertTriangle,
  ArrowRight,
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
  financeReviewReturnReason,
  financeReviewSessionCanApprove,
  financeReviewSessionCanReturn,
  reconcileFinanceReviewSession,
  setFinanceReviewDecision,
  type FinanceReviewPage,
  type FinanceReviewSession,
  type RequestFinanceReview,
} from '../financeReview';
import {
  type RequestApprovalReturnIssueType,
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
import { formatInvoiceMoney, invoiceTotal } from '../invoice/invoiceUtils';
import type { CreatorProfile, GeneratedInvoiceRecord } from '../types';
import type { RequestProjectSummary } from '../pages/RequestProjectDetailPage';
import { InvoiceDocumentView } from './InvoiceDocumentView';
import { PaymentListReviewContent } from './PaymentListReviewContent';
import { requestLinkedContracts, requestLinkedInvoices } from './RequestProjectResourceManager';
import { Button, Modal, SelectField, type SelectOption } from './Common';
import './FinanceReviewWorkspace.css';

type FinanceReviewPane = 'invoice' | 'payment' | 'approval';
type FinanceReviewStage = 'overview' | 'validation';

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
];

const financeReturnIssueLabel = (issueType: RequestApprovalReturnIssueType) => (
  issueType === 'INVOICE_CONTENT' ? 'Invoice 原因' : '付款清单原因'
);

const PAGE_KIND_LABEL: Record<FinanceReviewPage['kind'], string> = {
  pair: '一一对应',
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
    ...stageOrder.map((stage) => {
      const event = [...approval.history].reverse().find((candidate) => (
        candidate.round === approval.round && candidate.stage === stage
      ));
      const isCurrent = currentStage === stage;
      const state = event?.action === 'APPROVE'
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
  projectBrand,
  submittedAt,
  paymentChannel,
  requestReason,
  exportingPaymentLists,
  canExportPaymentLists,
  onExportPaymentLists,
  onOpenContracts,
  onOpenInvoices,
}: {
  request: RequestProjectSummary;
  linkedContracts: ContractRecord[];
  linkedInvoices: GeneratedInvoiceRecord[];
  approvalLabel: string;
  accountValidationStatus: 'pending' | 'warning' | 'passed';
  accountValidationLabel: string;
  projectBrand: string;
  submittedAt: string;
  paymentChannel: string;
  requestReason: string;
  exportingPaymentLists: boolean;
  canExportPaymentLists: boolean;
  onExportPaymentLists: () => void;
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
        <article className="is-status">
          <span><span className="finance-review-metric-icon" aria-hidden="true"><ShieldCheck size={13} /></span>当前审批状态</span>
          <strong>{approvalLabel}</strong>
          <small>第 {request.approval?.round ?? 1} 轮审批</small>
        </article>
      </section>

      <section className="finance-review-project-section" aria-label="请款项目信息">
        <header>
          <div className="finance-review-section-heading"><span className="finance-review-card-title-icon is-project" aria-hidden="true"><BriefcaseBusiness size={14} /></span><strong>请款项目信息</strong></div>
          <Button
            className="finance-review-project-export"
            variant="secondary"
            icon={exportingPaymentLists ? <LoaderCircle className="is-spinning" size={14} /> : <Download size={14} />}
            title="导出该项目的全部付款清单"
            disabled={!canExportPaymentLists || exportingPaymentLists}
            onClick={onExportPaymentLists}
          >
            {exportingPaymentLists ? '导出中' : '导出 Excel'}
          </Button>
        </header>
        <dl className="finance-review-project-info">
          <div><dt>项目编号</dt><dd>{request.requestCode ?? request.id}</dd></div>
          <div><dt>关联项目</dt><dd>{request.cooperationProjectName ?? request.project}<small>{request.cooperationProjectCode ?? request.projectId ?? '待同步'}</small></dd></div>
          <div><dt>品牌 / 客户</dt><dd>{projectBrand}</dd></div>
          <div><dt>项目媒介</dt><dd>{request.media}</dd></div>
          <div><dt>负责 PM</dt><dd>{request.pm}</dd></div>
          <div><dt>提交人</dt><dd>{request.media}</dd></div>
          <div><dt>提交时间</dt><dd>{submittedAt}</dd></div>
          <div><dt>付款渠道</dt><dd>{paymentChannel}</dd></div>
          <div><dt>预计付款时间</dt><dd>{request.expectedPaymentDate || '待补充'}</dd></div>
          <div className="is-wide"><dt>付款事由</dt><dd>{requestReason}</dd></div>
        </dl>
      </section>

      <section className="finance-review-project-section finance-review-linked-resources" aria-label="关联资料">
        <header><div className="finance-review-section-heading"><span className="finance-review-card-title-icon is-resources" aria-hidden="true"><Files size={14} /></span><strong>关联资料</strong></div><span>项目级汇总</span></header>
        <div className="finance-review-resource-list">
          <div className="finance-review-resource-row">
            <span className="finance-review-resource-icon" aria-hidden="true"><FileText size={15} /></span>
            <strong>合同 · {linkedContracts.length} 份</strong>
            <button type="button" onClick={onOpenContracts}>查看合同</button>
          </div>
          <div className="finance-review-resource-row">
            <span className="finance-review-resource-icon" aria-hidden="true"><ReceiptText size={15} /></span>
            <strong>Invoice · {linkedInvoices.length} 份</strong>
            <button type="button" onClick={onOpenInvoices}>查看 Invoice</button>
          </div>
          <div className="finance-review-resource-row">
            <span className="finance-review-resource-icon" aria-hidden="true"><Landmark size={15} /></span>
            <strong>收款账户校验结果</strong>
            <span className={`finance-review-resource-status is-${accountValidationStatus}`}>{accountValidationLabel}</span>
          </div>
        </div>
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
  const [invoiceZoom, setInvoiceZoom] = useState(1);
  const [issueEditorOpen, setIssueEditorOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [resourceDialog, setResourceDialog] = useState<'contract' | 'invoice' | null>(null);
  const [exportingPaymentLists, setExportingPaymentLists] = useState(false);
  const [issueType, setIssueType] = useState<RequestApprovalReturnIssueType | ''>('');
  const [issueReason, setIssueReason] = useState('');
  const invoiceCanvasRef = useRef<HTMLDivElement>(null);
  const invoiceZoomRef = useRef(1);
  const overviewFocusRef = useRef<HTMLDivElement>(null);
  const validationFocusRef = useRef<HTMLButtonElement>(null);

  const changeStage = (nextStage: FinanceReviewStage) => {
    setStage(nextStage);
    window.requestAnimationFrame(() => {
      if (nextStage === 'validation') validationFocusRef.current?.focus();
      else overviewFocusRef.current?.focus();
    });
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

  const currentPage = financeReview.pages[reviewIndex];
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
  const submittedAt = request.approval?.submittedAt ?? request.createdAt ?? '待补充';
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

  const goTo = (nextIndex: number) => {
    setReviewIndex(Math.min(Math.max(0, nextIndex), Math.max(0, financeReview.pages.length - 1)));
  };

  const openIssueEditor = () => {
    setIssueType(currentDecision.state === 'incorrect' ? currentDecision.issueType : '');
    setIssueReason(currentDecision.state === 'incorrect' ? currentDecision.reason : '');
    setIssueEditorOpen(true);
  };

  const saveIssue = () => {
    if (!currentPage || !issueType || !issueReason.trim()) return;
    onSessionChange(setFinanceReviewDecision(activeSession, currentPage.key, {
      state: 'incorrect',
      issueType,
      reason: issueReason.trim(),
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
              <Button icon={<ArrowRight size={16} />} onClick={() => changeStage('validation')}>
                校验审核
              </Button>
            </div>
          </div>
        ) : (
          <div className="finance-review-footer">
            <div className="finance-review-footer-pagination">
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
              <div className="finance-review-footer-summary" aria-live="polite">
                <strong>{counts.correct} / {financeReview.pageCount}</strong>
                <span>{counts.incorrect ? `${counts.incorrect} 份有误` : `${counts.unreviewed} 份待核对`}</span>
              </div>
            </div>
            <div className="finance-review-footer-actions">
              <Button
                variant="secondary"
                icon={<CircleAlert size={16} />}
                disabled={!currentPage}
                onClick={openIssueEditor}
              >
                {currentDecision.state === 'incorrect' ? '编辑有误记录' : '记录有误'}
              </Button>
              <Button
                variant="secondary"
                icon={<CheckCircle2 size={16} />}
                disabled={!canConfirmCurrentPage}
                onClick={confirmCurrentPage}
              >
                确认本页无误
              </Button>
              {counts.incorrect > 0 ? (
                <Button
                  variant="danger"
                  icon={<AlertTriangle size={16} />}
                  disabled={!canReturn}
                  title={canReturn ? '汇总全部有误记录并退回媒介' : `仍有 ${counts.unreviewed} 份记录待核对`}
                  onClick={openReturnDialog}
                >
                  退回媒介修改
                </Button>
              ) : null}
              <Button icon={<ShieldCheck size={16} />} disabled={!canApprove} onClick={submitApproval}>
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
              <div className="finance-review-overview-scroll">
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
                  projectBrand={projectBrand}
                  submittedAt={submittedAt}
                  paymentChannel={paymentChannel}
                  requestReason={requestReason}
                  exportingPaymentLists={exportingPaymentLists}
                  canExportPaymentLists={projectPaymentLists.length > 0}
                  onExportPaymentLists={() => { void exportProjectPaymentLists(); }}
                  onOpenContracts={() => setResourceDialog('contract')}
                  onOpenInvoices={() => setResourceDialog('invoice')}
                />
              </div>
            </div>
          ) : (
            <div className="finance-review-validation-stage" data-testid="finance-review-validation-stage">
              <div className="finance-review-validation-bar">
                <button
                  ref={validationFocusRef}
                  className="finance-review-back-overview"
                  type="button"
                  onClick={() => changeStage('overview')}
                >
                  <ChevronLeft size={17} aria-hidden="true" />
                  返回项目概览
                </button>
                <span>{request.cooperationProjectName ?? request.project}</span>
              </div>
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
            <section className={`finance-review-pane finance-review-invoice-pane${activePane === 'invoice' ? ' is-mobile-active' : ''}`}>
              <header className="finance-review-pane-header">
                <div className="finance-review-pane-heading"><span className="finance-review-pane-header-icon" aria-hidden="true"><FileText size={17} /></span><span><strong>Invoice 快照</strong><small>{currentPage?.invoiceNumber ?? '未关联'}.pdf · 1 页</small></span></div>
                <div className="finance-review-invoice-header-actions">
                  {currentPage ? <span className={`finance-review-kind is-${currentPage.kind}`}>{PAGE_KIND_LABEL[currentPage.kind]}</span> : null}
                  <div className="finance-review-zoom-controls" role="group" aria-label="Invoice 缩放">
                    <button
                      className="icon-button"
                      type="button"
                      title="缩小 Invoice"
                      aria-label="缩小 Invoice"
                      disabled={!invoice || invoiceZoom <= MIN_INVOICE_ZOOM}
                      onClick={() => setInvoiceZoomLevel(invoiceZoomRef.current - INVOICE_ZOOM_STEP)}
                    >
                      <ZoomOut size={16} />
                    </button>
                    <button
                      className="finance-review-zoom-reset"
                      type="button"
                      title="恢复 100%"
                      aria-label={`当前缩放 ${Math.round(invoiceZoom * 100)}%，点击恢复 100%`}
                      disabled={!invoice || invoiceZoom === 1}
                      onClick={() => setInvoiceZoomLevel(1)}
                    >
                      {Math.round(invoiceZoom * 100)}%
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      title="放大 Invoice"
                      aria-label="放大 Invoice"
                      disabled={!invoice || invoiceZoom >= MAX_INVOICE_ZOOM}
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
                aria-label="Invoice 快照查看区"
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
                {invoice ? (
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

            <section className={`finance-review-pane finance-review-payment-pane${activePane === 'payment' ? ' is-mobile-active' : ''}`}>
              <header className="finance-review-pane-header">
                <div className="finance-review-pane-heading"><span className="finance-review-pane-header-icon" aria-hidden="true"><WalletCards size={17} /></span><span><strong>付款清单核对</strong><small>{currentPaymentRowCount} 条当前页冻结记录</small></span></div>
                {currentPage?.mismatchCount
                  ? <span className="finance-review-warning-count"><CircleAlert size={13} />关键字段不一致 · {currentPage.mismatchCount} 项</span>
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
                  onExportPaymentList={onExportPaymentList}
                  accountDisplay="current-full"
                  variant="finance-workspace"
                />
              </div>
            </section>

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
                  projectBrand={projectBrand}
                  submittedAt={submittedAt}
                  paymentChannel={paymentChannel}
                  requestReason={requestReason}
                  exportingPaymentLists={exportingPaymentLists}
                  canExportPaymentLists={projectPaymentLists.length > 0}
                  onExportPaymentLists={() => { void exportProjectPaymentLists(); }}
                  onOpenContracts={() => setResourceDialog('contract')}
                  onOpenInvoices={() => setResourceDialog('invoice')}
                />

                <section className="finance-review-project-section" aria-label="当前审批流">
                  <header><div className="finance-review-section-heading"><span className="finance-review-card-title-icon is-workflow" aria-hidden="true"><Workflow size={14} /></span><strong>当前审批流</strong></div><span>第 {request.approval?.round ?? 1} 轮</span></header>
                  <ApprovalTimeline request={request} currentUser={currentUser} compact />
                </section>

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
          onClose={() => setResourceDialog(null)}
          footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}
        >
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading"><div><strong>全部合同</strong><p>平铺展示当前请款项目已关联的合同。</p></div><span>{linkedContracts.length} 份</span></div>
            <div className="request-resource-flat-list">
              {linkedContracts.map((contract) => {
                const creator = creators.find((candidate) => candidate.id === contract.creatorId);
                const contractId = contract.contractId ?? contract.id;
                return (
                  <article className="request-resource-flat-row" key={contractId}>
                    <span className="project-contract-record-icon"><FileText size={18} /></span>
                    <div><strong>{contract.id}</strong><small>{contract.name}</small></div>
                    <div><span>达人</span><strong>{creator?.name ?? '达人档案缺失'}</strong><small>{creator ? `${creator.handle} · ${creator.platform}` : contract.creatorId}</small></div>
                    <div><span>合同 / IO</span><strong>{contract.ioId || 'IO 待补充'}</strong><small>{formatContractMoney(contract)}</small></div>
                    <span className="project-record-status"><i />{getContractReadiness(contract).label}</span>
                    <div className="project-contract-record-actions"><Button variant="secondary" icon={<Eye size={14} />} onClick={() => onOpenContract(contract.id)}>查看</Button></div>
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
          onClose={() => setResourceDialog(null)}
          footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}
        >
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading"><div><strong>全部 Invoice</strong><p>平铺展示 {linkedInvoices.length} 份 Invoice，同一达人可关联多份。</p></div><span>{linkedInvoices.length} 份</span></div>
            <div className="request-resource-flat-list">
              {linkedInvoices.map((linkedInvoice) => {
                const creator = creators.find((candidate) => candidate.id === linkedInvoice.snapshot.creatorId);
                return (
                  <article className="request-resource-flat-row request-resource-invoice-row" key={linkedInvoice.invoiceId}>
                    <span className="project-contract-record-icon"><ReceiptText size={18} /></span>
                    <div><strong>{linkedInvoice.id}</strong><small>{linkedInvoice.status}</small></div>
                    <div><span>达人</span><strong>{creator?.name ?? linkedInvoice.snapshot.creatorName}</strong><small>{creator ? `${creator.handle} · ${creator.platform}` : linkedInvoice.snapshot.creatorHandle}</small></div>
                    <div><span>Invoice 金额</span><strong>{formatInvoiceMoney(linkedInvoice.snapshot.currency, invoiceTotal(linkedInvoice.snapshot))}</strong><small>{linkedInvoice.snapshot.contractIds?.length ?? 0} 份覆盖合同</small></div>
                    <span className={`project-record-status${linkedInvoice.validationStatus === 'valid' ? '' : ' is-warning'}`}><i />{linkedInvoice.validationStatus === 'valid' ? '已通过' : '需重新校验'}</span>
                    <div className="project-contract-record-actions"><Button variant="secondary" icon={<Eye size={14} />} onClick={() => onOpenInvoice(linkedInvoice.invoiceId)}>查看</Button></div>
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
              <Button variant="danger" disabled={!issueType || !issueReason.trim()} onClick={saveIssue}>保存有误记录</Button>
            </>
          )}
        >
          <label className="finance-review-reason-field">
            <span>问题类型 <em>*</em></span>
            <SelectField<RequestApprovalReturnIssueType | ''>
              ariaLabel="财务退回问题类型"
              value={issueType}
              placeholder="请选择 Invoice 原因或付款清单原因"
              variant="form"
              menuStrategy="fixed"
              options={FINANCE_RETURN_ISSUE_OPTIONS}
              onChange={setIssueType}
            />
            <small>所选类型决定媒介侧仅开放 Invoice 或对应付款明细。</small>
          </label>
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
              <Button variant="danger" disabled={!canReturn || !returnReason} onClick={submitReturn}>确认退回</Button>
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
