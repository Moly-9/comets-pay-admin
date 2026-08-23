import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Eye,
  FileCheck2,
  FileText,
  GripVertical,
  History,
  Landmark,
  Save,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Button, Modal, SelectField } from './Common';
import './InvoiceReviewWorkspace.css';

export type InvoiceReviewSourceType = 'INTERNAL_GENERATED' | 'EXTERNAL_UPLOADED';
export type InvoiceReviewWorkspaceTab = 'overview' | 'contract' | 'account' | 'history';
export type InvoiceReviewFieldStatus =
  | 'MATCHED'
  | 'CORRECTED'
  | 'PENDING_REVIEW'
  | 'MISMATCH'
  | 'MISSING'
  | 'REUPLOAD_REQUIRED';
export type InvoiceReviewFieldAction = 'CONFIRM_CORRECTION' | 'REUPLOAD_REQUIRED' | 'ANOMALY';

export type InvoiceReviewEvidence = {
  sourceValue: string;
  recognizedValue: string;
  confirmedValue: string;
  correctionReason?: string;
  correctedBy?: string;
  correctedAt?: string;
  mediaReview?: string;
  pageNumber?: number;
};

export type InvoiceReviewOverviewField = {
  id: string;
  label: string;
  baselineValue: string;
  confirmedValue: string;
  status: InvoiceReviewFieldStatus;
  statusLabel: string;
  evidenceTarget?: string;
  evidence?: InvoiceReviewEvidence;
  allowConfirmCorrection?: boolean;
  allowExceptionActions?: boolean;
};

export type InvoiceReviewSummaryField = {
  id: string;
  label: string;
  value: string;
  secondary?: string;
  evidenceTarget?: string;
};

export type InvoiceReviewContractCheck = {
  id: string;
  label: string;
  contractValue: string;
  invoiceValue: string;
  state: 'PASS' | 'WARNING' | 'FAIL' | 'NOT_APPLICABLE';
  note: string;
  evidenceTarget?: string;
};

export type InvoiceReviewAccountRow = {
  label: string;
  value: string;
};

export type InvoiceReviewAccountComparison = {
  invoiceValue: string;
  profileValue: string;
  matched: boolean;
  message: string;
  evidenceTarget?: string;
};

export type InvoiceReviewTimelineItem = {
  id: string;
  title: string;
  description: string;
  meta?: string;
  state: 'COMPLETE' | 'CURRENT' | 'PENDING' | 'RETURNED';
};

export type InvoiceReviewReturnOption = {
  value: string;
  label: string;
  description?: string;
};

export type InvoiceReviewMetricItem = {
  label: string;
  value: ReactNode;
  secondary: ReactNode;
};

export function InvoiceReviewMetricGrid({ items }: { items: InvoiceReviewMetricItem[] }) {
  return (
    <div className="contract-metric-grid invoice-review-metric-grid">
      {items.map((item) => (
        <article key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.secondary}</small>
        </article>
      ))}
    </div>
  );
}

type InvoiceReviewWorkspaceProps = {
  sourceType: InvoiceReviewSourceType;
  issueCount: number;
  sourceStatusText: string;
  documentName: string;
  documentMeta: string;
  documentContent: ReactNode;
  pageCount?: number;
  onDownload?: () => void;
  downloadDisabled?: boolean;
  summaryFields?: InvoiceReviewSummaryField[];
  overviewFields?: InvoiceReviewOverviewField[];
  contractChecks: InvoiceReviewContractCheck[];
  noContract?: boolean;
  accountRows: InvoiceReviewAccountRow[];
  accountComparison?: InvoiceReviewAccountComparison;
  timeline: InvoiceReviewTimelineItem[];
  completion: { completed: number; total: number };
  blockingReasons: string[];
  onFieldAction?: (fieldId: string, action: InvoiceReviewFieldAction, note?: string) => void;
  returnLabel?: string;
  returnDialogTitle?: string;
  returnOptions?: InvoiceReviewReturnOption[];
  onReturn?: (reason: string, option?: string) => void;
  onSave?: () => void;
  approveLabel?: string;
  onApprove?: () => void;
  approveDisabled?: boolean;
  canReview?: boolean;
  additionalFooterActions?: ReactNode;
};

const SOURCE_LABEL: Record<InvoiceReviewSourceType, string> = {
  INTERNAL_GENERATED: '系统生成',
  EXTERNAL_UPLOADED: '外部上传',
};

const FIELD_STATUS_META: Record<InvoiceReviewFieldStatus, {
  tone: string;
  icon: typeof CheckCircle2;
}> = {
  MATCHED: { tone: 'success', icon: CheckCircle2 },
  CORRECTED: { tone: 'warning', icon: FileCheck2 },
  PENDING_REVIEW: { tone: 'warning', icon: CircleAlert },
  MISMATCH: { tone: 'danger', icon: AlertTriangle },
  MISSING: { tone: 'danger', icon: CircleAlert },
  REUPLOAD_REQUIRED: { tone: 'danger', icon: AlertTriangle },
};

const formatEvidenceTime = (value?: string) => {
  if (!value) return '未记录';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const contractStateLabel = (state: InvoiceReviewContractCheck['state']) => {
  if (state === 'PASS') return '已通过';
  if (state === 'WARNING') return '需关注';
  if (state === 'FAIL') return '异常';
  return '不适用';
};

export function InvoiceReviewWorkspace({
  sourceType,
  issueCount,
  sourceStatusText,
  documentName,
  documentMeta,
  documentContent,
  pageCount = 1,
  onDownload,
  downloadDisabled = false,
  summaryFields = [],
  overviewFields = [],
  contractChecks,
  noContract = false,
  accountRows,
  accountComparison,
  timeline,
  completion,
  blockingReasons,
  onFieldAction,
  returnLabel,
  returnDialogTitle,
  returnOptions = [],
  onReturn,
  onSave,
  approveLabel,
  onApprove,
  approveDisabled = false,
  canReview = false,
  additionalFooterActions,
}: InvoiceReviewWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<InvoiceReviewWorkspaceTab>('overview');
  const [zoom, setZoom] = useState(0.82);
  const [leftPercent, setLeftPercent] = useState(40);
  const [dragging, setDragging] = useState(false);
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnOption, setReturnOption] = useState(returnOptions[0]?.value ?? '');
  const [fieldDialog, setFieldDialog] = useState<{
    fieldId: string;
    fieldLabel: string;
    action: 'REUPLOAD_REQUIRED' | 'ANOMALY';
  } | null>(null);
  const [fieldNote, setFieldNote] = useState('');
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const documentScrollRef = useRef<HTMLDivElement | null>(null);
  const activeEvidenceElementRef = useRef<HTMLElement | null>(null);
  const dragStartRef = useRef({ clientX: 0, leftPercent: 40 });
  const tabIdPrefix = useId().replace(/:/g, '');

  const contractPassed = contractChecks.filter((check) => (
    check.state === 'PASS' || check.state === 'NOT_APPLICABLE'
  )).length;
  const contractLabel = noContract
    ? '合同匹配 · 无合同'
    : contractPassed === contractChecks.length
      ? `合同匹配 ${contractPassed}/${contractChecks.length}`
      : `合同匹配 ${contractPassed}/${contractChecks.length} · ${contractChecks.length - contractPassed}项异常`;
  const tabs: Array<{ id: InvoiceReviewWorkspaceTab; label: string; icon: typeof ShieldCheck }> = [
    { id: 'overview', label: '审核概览', icon: FileCheck2 },
    { id: 'contract', label: contractLabel, icon: ShieldCheck },
    { id: 'account', label: '收款账户', icon: Landmark },
    { id: 'history', label: '审核记录', icon: History },
  ];
  const exceptionFields = useMemo(() => overviewFields.filter((field) => (
    field.status !== 'MATCHED'
  )), [overviewFields]);
  const matchedFields = useMemo(() => overviewFields.filter((field) => (
    field.status === 'MATCHED'
  )), [overviewFields]);

  useEffect(() => {
    if (!dragging) return undefined;
    const handlePointerMove = (event: PointerEvent) => {
      const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width ?? 0;
      if (!workspaceWidth) return;
      const next = dragStartRef.current.leftPercent
        + ((event.clientX - dragStartRef.current.clientX) / workspaceWidth) * 100;
      setLeftPercent(Math.min(68, Math.max(36, next)));
    };
    const stopDragging = () => setDragging(false);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', stopDragging, { once: true });
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', stopDragging);
    };
  }, [dragging]);

  useEffect(() => () => {
    activeEvidenceElementRef.current?.classList.remove('is-review-evidence-active');
  }, []);

  const locateEvidence = (target?: string) => {
    if (!target) return;
    activeEvidenceElementRef.current?.classList.remove('is-review-evidence-active');
    const pane = documentScrollRef.current;
    const element = pane?.querySelector<HTMLElement>(`[data-review-evidence="${target}"]`)
      ?? pane?.querySelector<HTMLElement>(target);
    if (!element) return;
    activeEvidenceElementRef.current = element;
    element.classList.add('is-review-evidence-active');
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const toggleEvidence = (field: InvoiceReviewOverviewField) => {
    setExpandedEvidenceId((current) => current === field.id ? null : field.id);
    locateEvidence(field.evidenceTarget);
  };

  const renderExternalRows = (fields: InvoiceReviewOverviewField[]) => fields.map((field) => {
    const meta = FIELD_STATUS_META[field.status];
    const StatusIcon = meta.icon;
    const expanded = expandedEvidenceId === field.id;
    return (
      <article className={`invoice-review-field-row is-${meta.tone}`} key={field.id}>
        <div className="invoice-review-field-name">
          <strong>{field.label}</strong>
          <span className={`invoice-review-status-chip is-${meta.tone}`}>
            <StatusIcon size={14} />{field.statusLabel}
          </span>
        </div>
        <div className="invoice-review-field-values">
          <div><span>系统校验基准</span><strong>{field.baselineValue}</strong></div>
          <div><span>达人最终确认值</span><strong>{field.confirmedValue}</strong></div>
        </div>
        <div className="invoice-review-row-actions">
          {field.evidence ? (
            <button type="button" onClick={() => toggleEvidence(field)} aria-expanded={expanded}>
              <Eye size={14} />查看证据<ChevronDown size={13} />
            </button>
          ) : null}
          {field.allowConfirmCorrection && onFieldAction ? (
            <button type="button" onClick={() => onFieldAction(field.id, 'CONFIRM_CORRECTION')}>
              <CheckCircle2 size={14} />确认纠正
            </button>
          ) : null}
          {field.allowExceptionActions && onFieldAction ? (
            <button
              type="button"
              onClick={() => {
                setFieldNote('');
                setFieldDialog({ fieldId: field.id, fieldLabel: field.label, action: 'REUPLOAD_REQUIRED' });
              }}
            >
              要求重传
            </button>
          ) : null}
          {field.allowExceptionActions && onFieldAction ? (
            <button
              type="button"
              onClick={() => {
                setFieldNote('');
                setFieldDialog({ fieldId: field.id, fieldLabel: field.label, action: 'ANOMALY' });
              }}
            >
              标记异常
            </button>
          ) : null}
        </div>
        {expanded && field.evidence ? (
          <div className="invoice-review-evidence-grid">
            <div><span>原始 Invoice 原文</span><strong>{field.evidence.sourceValue}</strong><small>第 {field.evidence.pageNumber ?? 1} 页</small></div>
            <div><span>系统首次 OCR</span><strong>{field.evidence.recognizedValue}</strong><small>首次识别值不可覆盖</small></div>
            <div><span>达人最终确认值</span><strong>{field.evidence.confirmedValue}</strong><small>{field.evidence.correctionReason ?? '达人确认识别结果'}</small></div>
            <div><span>纠正与媒介复核</span><strong>{field.evidence.mediaReview ?? '待媒介复核'}</strong><small>{field.evidence.correctedBy ? `${field.evidence.correctedBy} · ${formatEvidenceTime(field.evidence.correctedAt)}` : '该字段未发生达人纠正'}</small></div>
          </div>
        ) : null}
      </article>
    );
  });

  const workspaceStyle = {
    '--invoice-review-left': `${leftPercent}%`,
    '--invoice-review-zoom': zoom,
  } as CSSProperties;

  const submitReturn = () => {
    if (!returnReason.trim() || !onReturn) return;
    onReturn(returnReason.trim(), returnOption || undefined);
    setReturnReason('');
    setReturnOpen(false);
  };

  const submitFieldAction = () => {
    if (!fieldDialog || fieldNote.trim().length < 5 || !onFieldAction) return;
    onFieldAction(fieldDialog.fieldId, fieldDialog.action, fieldNote.trim());
    setFieldDialog(null);
    setFieldNote('');
  };

  return (
    <div
      className={`invoice-review-workspace is-${sourceType === 'INTERNAL_GENERATED' ? 'internal' : 'external'} ${dragging ? 'is-resizing' : ''}`}
      ref={workspaceRef}
      style={workspaceStyle}
    >
      <section className="invoice-review-document-pane" aria-label="Invoice 原始文件">
        <header className="invoice-review-document-toolbar">
          <div className="invoice-review-document-title">
            <FileText size={18} />
            <span><strong>{documentName}</strong><small>{documentMeta}</small></span>
          </div>
          <div className="invoice-review-document-controls">
            <span className="invoice-review-page-control" aria-label={`第 1 页，共 ${pageCount} 页`}>
              <button type="button" aria-label="上一页" disabled><ChevronLeft size={16} /></button>
              <b>1 / {pageCount}</b>
              <button type="button" aria-label="下一页" disabled={pageCount <= 1}><ChevronRight size={16} /></button>
            </span>
            <span className="invoice-review-zoom-control">
              <button type="button" aria-label="缩小 Invoice" disabled={zoom <= 0.6} onClick={() => setZoom((value) => Math.max(0.6, Math.round((value - 0.1) * 10) / 10))}><ZoomOut size={16} /></button>
              <b>{Math.round(zoom * 100)}%</b>
              <button type="button" aria-label="放大 Invoice" disabled={zoom >= 1.6} onClick={() => setZoom((value) => Math.min(1.6, Math.round((value + 0.1) * 10) / 10))}><ZoomIn size={16} /></button>
            </span>
            {onDownload ? (
              <button type="button" aria-label="下载 Invoice 原始文件" disabled={downloadDisabled} onClick={onDownload}><Download size={16} /></button>
            ) : null}
          </div>
        </header>
        <div className="invoice-review-document-scroll" ref={documentScrollRef} tabIndex={0}>
          <div className="invoice-review-document-stage">{documentContent}</div>
        </div>
      </section>

      <div
        className="invoice-review-resizer"
        role="separator"
        aria-label="调整 Invoice 文件与审核内容宽度"
        aria-orientation="vertical"
        aria-valuemin={36}
        aria-valuemax={68}
        aria-valuenow={Math.round(leftPercent)}
        tabIndex={0}
        onPointerDown={(event) => {
          dragStartRef.current = { clientX: event.clientX, leftPercent };
          setDragging(true);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          setLeftPercent((current) => Math.min(68, Math.max(36, current + (event.key === 'ArrowLeft' ? -2 : 2))));
        }}
      >
        <GripVertical size={17} />
      </div>

      <section className="invoice-review-inspector-pane" aria-label="Invoice 审核内容">
        <header className="invoice-review-source-header">
          <div>
            <span className={`invoice-review-source-badge is-${sourceType === 'INTERNAL_GENERATED' ? 'internal' : 'external'}`}>
              {SOURCE_LABEL[sourceType]}
            </span>
            <strong>{sourceStatusText}</strong>
          </div>
          <span className={`invoice-review-issue-count ${issueCount ? 'has-issues' : 'is-clear'}`}>
            {issueCount ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            {issueCount ? `${issueCount}项待媒介复核` : '系统字段已校验'}
          </span>
        </header>

        <div className="invoice-review-tabs" role="tablist" aria-label="Invoice 审核详情分类">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                id={`${tabIdPrefix}-${tab.id}-tab`}
                className={activeTab === tab.id ? 'is-active' : ''}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${tabIdPrefix}-${tab.id}-panel`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={15} />{tab.label}
              </button>
            );
          })}
        </div>

        <div
          className="invoice-review-tab-scroll"
          id={`${tabIdPrefix}-${activeTab}-panel`}
          role="tabpanel"
          aria-labelledby={`${tabIdPrefix}-${activeTab}-tab`}
          tabIndex={0}
        >
          {activeTab === 'overview' && sourceType === 'INTERNAL_GENERATED' ? (
            <div className="invoice-review-overview-section">
              <div className="invoice-review-section-heading">
                <div><FileCheck2 size={18} /><span><strong>结构化 Invoice 摘要</strong><small>核对项目、主体、金额、币种和付款信息</small></span></div>
              </div>
              <dl className="invoice-review-summary-list">
                {summaryFields.map((field) => (
                  <div key={field.id}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}{field.secondary ? <small>{field.secondary}</small> : null}</dd>
                    {field.evidenceTarget ? <button type="button" onClick={() => locateEvidence(field.evidenceTarget)}><Eye size={14} />定位原文</button> : null}
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {activeTab === 'overview' && sourceType === 'EXTERNAL_UPLOADED' ? (
            <div className="invoice-review-overview-section">
              <div className="invoice-review-section-heading">
                <div><FileCheck2 size={18} /><span><strong>收集任务基准与达人最终确认值</strong><small>异常项优先展示，正常匹配项默认折叠</small></span></div>
              </div>
              {exceptionFields.length ? (
                <div className="invoice-review-exception-summary" role="status">
                  <AlertTriangle size={17} />
                  <span><strong>{exceptionFields.length} 项需要关注</strong><small>逐项查看原文证据并完成媒介复核</small></span>
                </div>
              ) : (
                <div className="invoice-review-clear-summary" role="status"><CheckCircle2 size={17} />全部识别字段与校验基准一致</div>
              )}
              {exceptionFields.length ? (
                <div className="invoice-review-field-list">{renderExternalRows(exceptionFields)}</div>
              ) : null}
              {matchedFields.length ? (
                <details className="invoice-review-matched-details">
                  <summary><CheckCircle2 size={16} />正常匹配项（{matchedFields.length}）<ChevronDown size={15} /></summary>
                  <div className="invoice-review-field-list is-matched-list">{renderExternalRows(matchedFields)}</div>
                </details>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'contract' ? (
            <div className="invoice-review-contract-section">
              <div className="invoice-review-section-heading">
                <div><ShieldCheck size={18} /><span><strong>合同与 Invoice 匹配</strong><small>合同非必填，无合同时视为正常状态</small></span></div>
              </div>
              {noContract ? (
                <div className="invoice-review-no-contract"><CheckCircle2 size={20} /><span><strong>无合同</strong><small>当前 Invoice 按无合同流程发起，不构成审核异常。</small></span></div>
              ) : (
                <div className="invoice-review-contract-list">
                  {contractChecks.map((check) => (
                    <article className={`is-${check.state.toLowerCase().replace('_', '-')}`} key={check.id}>
                      <span>{check.state === 'PASS' || check.state === 'NOT_APPLICABLE' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</span>
                      <div>
                        <header><strong>{check.label}</strong><small>{contractStateLabel(check.state)}</small></header>
                        <dl><div><dt>合同 / 系统</dt><dd>{check.contractValue}</dd></div><div><dt>Invoice</dt><dd>{check.invoiceValue}</dd></div></dl>
                        <p>{check.note}</p>
                        {check.evidenceTarget ? <button type="button" onClick={() => locateEvidence(check.evidenceTarget)}><Eye size={14} />定位原文</button> : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'account' ? (
            <div className="invoice-review-account-section">
              <div className="invoice-review-section-heading">
                <div><Landmark size={18} /><span><strong>达人档案已审核账户</strong><small>付款只能使用当前达人档案中的有效账户</small></span></div>
              </div>
              {accountComparison ? (
                <div className={`invoice-review-account-comparison ${accountComparison.matched ? 'is-matched' : 'is-blocked'}`}>
                  <div><span>Invoice 文件中的账户</span><strong>{accountComparison.invoiceValue}</strong></div>
                  <span className="invoice-review-account-arrow">对比</span>
                  <div><span>系统已审核账户</span><strong>{accountComparison.profileValue}</strong></div>
                  <p>{accountComparison.matched ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{accountComparison.message}</p>
                  {accountComparison.evidenceTarget ? <button type="button" onClick={() => locateEvidence(accountComparison.evidenceTarget)}><Eye size={14} />定位原文</button> : null}
                </div>
              ) : null}
              <dl className="invoice-review-account-grid">
                {accountRows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
              </dl>
            </div>
          ) : null}

          {activeTab === 'history' ? (
            <div className="invoice-review-history-section">
              <div className="invoice-review-section-heading">
                <div><History size={18} /><span><strong>审核与流转记录</strong><small>按当前 Invoice 来源隐藏不适用节点</small></span></div>
              </div>
              <div className="invoice-review-timeline">
                {timeline.map((item) => (
                  <article className={`is-${item.state.toLowerCase()}`} key={item.id}>
                    <span>{item.state === 'COMPLETE' ? <CheckCircle2 size={15} /> : item.state === 'RETURNED' ? <AlertTriangle size={15} /> : null}</span>
                    <div><strong>{item.title}</strong><p>{item.description}</p>{item.meta ? <small>{item.meta}</small> : null}</div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <footer className="invoice-review-sticky-actions">
          <div className="invoice-review-completion">
            <span><FileCheck2 size={17} /><strong>已完成 {completion.completed}/{completion.total} 项</strong></span>
            {blockingReasons.length ? (
              <p role="alert">{blockingReasons[0]}{blockingReasons.length > 1 ? `，另有 ${blockingReasons.length - 1} 项待处理` : ''}</p>
            ) : <p>当前没有阻断项，可以继续审核流程。</p>}
          </div>
          <div className="invoice-review-footer-buttons">
            {additionalFooterActions}
            {returnLabel && onReturn ? <Button variant="secondary" disabled={!canReview} onClick={() => setReturnOpen(true)}>{returnLabel}</Button> : null}
            {onSave ? <Button variant="secondary" icon={<Save size={16} />} disabled={!canReview} onClick={onSave}>保存审核进度</Button> : null}
            {approveLabel && onApprove ? (
              <Button
                icon={<CheckCircle2 size={16} />}
                disabled={!canReview || approveDisabled}
                title={approveDisabled ? blockingReasons.join('；') : undefined}
                onClick={onApprove}
              >
                {approveLabel}
              </Button>
            ) : null}
          </div>
        </footer>
      </section>

      {returnOpen ? (
        <Modal
          title={returnDialogTitle ?? returnLabel ?? '退回 Invoice'}
          width="540px"
          onClose={() => setReturnOpen(false)}
          footer={(
            <><Button variant="ghost" onClick={() => setReturnOpen(false)}>取消</Button><Button variant="danger" disabled={!returnReason.trim() || (returnOptions.length > 0 && !returnOption)} onClick={submitReturn}>确认退回</Button></>
          )}
        >
          <div className="invoice-review-return-form">
            {returnOptions.length ? (
              <div className="form-control">
                <span className="required-field-label">退回处理方式 <em className="required-mark">*</em></span>
                <SelectField
                  ariaLabel="选择退回处理方式"
                  variant="form"
                  menuStrategy="fixed"
                  value={returnOption}
                  options={returnOptions}
                  onChange={setReturnOption}
                />
              </div>
            ) : null}
            <label><span className="required-field-label">退回原因 <em className="required-mark">*</em><small>{returnReason.length}/300</small></span><textarea autoFocus maxLength={300} value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="请说明具体字段、原文件证据和需要处理的内容" /></label>
          </div>
        </Modal>
      ) : null}

      {fieldDialog ? (
        <Modal
          title={fieldDialog.action === 'REUPLOAD_REQUIRED' ? `要求重新上传 · ${fieldDialog.fieldLabel}` : `标记异常 · ${fieldDialog.fieldLabel}`}
          width="560px"
          className="invoice-review-field-modal"
          onClose={() => {
            setFieldDialog(null);
            setFieldNote('');
          }}
          footer={(
            <>
              <Button variant="ghost" onClick={() => {
                setFieldDialog(null);
                setFieldNote('');
              }}>取消</Button>
              <Button variant="danger" disabled={fieldNote.trim().length < 5} onClick={submitFieldAction}>
                {fieldDialog.action === 'REUPLOAD_REQUIRED' ? '确认要求重新上传' : '保存异常结果'}
              </Button>
            </>
          )}
        >
          <div className="invoice-review-field-dialog">
            <div className={`invoice-review-field-dialog-intro is-${fieldDialog.action === 'REUPLOAD_REQUIRED' ? 'reupload' : 'anomaly'}`}>
              <span><CircleAlert size={19} /></span>
              <div>
                <strong>{fieldDialog.action === 'REUPLOAD_REQUIRED' ? '原文件内容需要达人重新处理' : '记录该字段的审核异常'}</strong>
                <p>{fieldDialog.action === 'REUPLOAD_REQUIRED'
                  ? '请明确指出票面错误及重新上传要求，达人将在 C 端看到这段说明。'
                  : '请写明原文件证据、当前确认值和建议处理方式，便于后续追溯。'}</p>
              </div>
            </div>
            <label className="invoice-review-field-note" htmlFor={`${tabIdPrefix}-field-note`}>
              <span>
                <b>复核说明 <em className="required-mark">*</em></b>
                <small>{fieldNote.length}/300</small>
              </span>
              <textarea
                id={`${tabIdPrefix}-field-note`}
                autoFocus
                maxLength={300}
                aria-invalid={Boolean(fieldNote.length && fieldNote.trim().length < 5)}
                aria-describedby={`${tabIdPrefix}-field-note-help`}
                value={fieldNote}
                onChange={(event) => setFieldNote(event.target.value)}
                placeholder="例如：票面总金额为 USD 4,600，与任务金额不一致，请核对原文件后重新处理。"
              />
              <small
                id={`${tabIdPrefix}-field-note-help`}
                className={fieldNote.length && fieldNote.trim().length < 5 ? 'is-error' : ''}
                role={fieldNote.length && fieldNote.trim().length < 5 ? 'alert' : undefined}
              >
                {fieldNote.length && fieldNote.trim().length < 5 ? '请至少填写 5 个字的具体说明。' : '说明会写入当前 Invoice 的审核记录。'}
              </small>
            </label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
