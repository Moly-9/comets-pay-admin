import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Download,
  Eye,
  FileText,
  Files,
  Landmark,
  LoaderCircle,
  ReceiptText,
  Send,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';
import {
  paymentListItemValue,
  type PaymentListItem,
  type PaymentListRecord,
} from '../businessWorkflow';
import { formatContractMoney, getContractReadiness, type ContractRecord } from '../contracts';
import { contractDocumentFilename, invoiceDocumentName } from '../documentFilenames';
import { isPayoutPaymentInformationValidated } from '../invoice/invoiceReviewWorkflow';
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
import type { RequestProjectSummary } from '../pages/RequestProjectDetailPage';
import type { PaymentProjectRow } from '../pages/PaymentWorkbenchPage';
import { requestApprovalReturnDetails } from '../requestApprovalWorkflow';
import { accountDisplayValue } from '../accountPresentation';
import type { CreatorProfile, GeneratedInvoiceRecord, Payout } from '../types';
import { ApprovalTimeline } from './FinanceReviewWorkspace';
import { requestLinkedContracts, requestLinkedInvoices } from './RequestProjectResourceManager';
import { Button, Modal } from './Common';
import { CreatorIdentity } from './CreatorIdentity';
import { paymentProviderDisplayName } from './PaymentProviderBadge';
import './PaymentExecutionWorkspace.css';

const formatDateTime = (value?: string) => {
  if (!value) return '待补充';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatPayoutAmount = (payout: Payout) => (
  `${payout.currency} ${payout.amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
);

const transferMethodLabel = (payout: Payout) => {
  if (payout.transferMethod === 'PAYPAL') return 'PayPal 账户';
  if (payout.localClearingSystem) return `本地转账 · ${payout.localClearingSystem}`;
  return payout.transferMethod ? `银行转账 · ${payout.transferMethod}` : '银行转账';
};

const feeBearerLabel = (value?: Payout['feeBearer']) => {
  if (value === 'ADVERTISER') return '付款方承担';
  if (value === 'PUBLISHER') return '收款方承担';
  if (value === 'SHARED') return '双方分摊';
  return '按付款单执行';
};

const payoutFailureReason = (payout: Payout, requestReason: string) => (
  payout.paymentFailureReturn?.reason?.trim()
  || payout.returnReason?.trim()
  || payout.issue?.trim()
  || requestReason
  || '未记录失败原因'
);

const payoutHasFailureMarker = (payout: Payout) => Boolean(
  payout.paymentFailure
  || payout.paymentFailureReturn
  || payout.paymentFailureRecovery
  || payout.returnReason?.trim()
  || payout.issue?.trim()
  || payout.status === '付款失败'
  || payout.status === '已退回'
);

const stableContractId = (contract: ContractRecord) => contract.contractId ?? contract.id;

type PaymentApprovalStep = {
  id: string;
  label: string;
  account: string;
  actor?: string;
  time?: string;
  state: 'complete' | 'current' | 'pending';
};

type PaymentExecutionStage = 'overview' | 'payment-list';

const paymentApprovalSteps = (
  request: RequestProjectSummary,
  paymentProvider: string,
): PaymentApprovalStep[] => {
  const approval = request.approval;
  if (!approval) return [];
  const stageDefinitions = [
    { stage: 'PM' as const, label: 'PM 审批', fallback: request.pm },
    { stage: 'PROJECT_OWNER' as const, label: '项目负责人审批', fallback: '项目负责人' },
    { stage: 'OWNER' as const, label: '老板审批', fallback: '老板' },
    { stage: 'FINANCE' as const, label: '财务审核', fallback: '财务' },
  ];
  return [
    {
      id: 'submitted',
      label: '请款提交',
      account: request.media,
      actor: request.media,
      time: approval.submittedAt,
      state: 'complete' as const,
    },
    ...stageDefinitions.map(({ stage, label, fallback }) => {
      const event = [...approval.history].reverse().find((candidate) => (
        candidate.round === approval.round
        && candidate.stage === stage
        && candidate.action === 'APPROVE'
      ));
      return {
        id: stage,
        label,
        account: event?.actorAccount ?? fallback,
        actor: event?.actorName ?? fallback,
        time: event?.occurredAt,
        state: event ? 'complete' as const : 'pending' as const,
      };
    }),
    {
      id: 'payment',
      label: '渠道付款',
      account: paymentProvider,
      actor: paymentProvider,
      state: 'current' as const,
    },
  ];
};

export function PaymentExecutionWorkspace({
  request,
  project,
  generatedInvoices,
  paymentLists = [],
  contracts = [],
  creators = [],
  variant = 'execution',
  initialStage = 'overview',
  canExecute,
  onExecute,
  onReturn,
  onOpenContract,
  onOpenInvoice,
  onClose,
}: {
  request: RequestProjectSummary;
  project: PaymentProjectRow;
  generatedInvoices: GeneratedInvoiceRecord[];
  paymentLists?: PaymentListRecord[];
  contracts?: ContractRecord[];
  creators?: CreatorProfile[];
  variant?: 'execution' | 'returned';
  initialStage?: PaymentExecutionStage;
  canExecute: boolean;
  onExecute: (payouts: Payout[]) => boolean;
  onReturn: (reason: string) => boolean;
  onOpenContract?: (contractId: string) => void;
  onOpenInvoice?: (invoiceId: GeneratedInvoiceRecord['invoiceId']) => void;
  onClose: () => void;
}) {
  const isReturned = variant === 'returned';
  const [stage, setStage] = useState<PaymentExecutionStage>(initialStage);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [resourceDialog, setResourceDialog] = useState<'contract' | 'invoice' | null>(null);
  const [approvalExpanded, setApprovalExpanded] = useState(false);
  const [downloadingResource, setDownloadingResource] = useState<ProjectPdfArchiveKind | null>(null);
  const [downloadingResourceRecord, setDownloadingResourceRecord] = useState('');
  const [resourceDownloadError, setResourceDownloadError] = useState('');
  const overviewFocusRef = useRef<HTMLElement>(null);
  const paymentListFocusRef = useRef<HTMLElement>(null);
  const payablePayouts = project.payouts.filter((payout) => payout.status === '等待付款');
  const validatedPayouts = isReturned
    ? project.payouts.filter(isPayoutPaymentInformationValidated)
    : payablePayouts;
  const linkedContracts = requestLinkedContracts(request, contracts);
  const linkedInvoices = requestLinkedInvoices(request, generatedInvoices);
  const accountValidationIssueCount = Math.max(0, project.payouts.length - validatedPayouts.length);
  const accountValidationStatus = project.payouts.length === 0
    ? 'empty'
    : accountValidationIssueCount === 0
      ? 'passed'
      : 'warning';
  const accountValidationLabel = accountValidationStatus === 'passed'
    ? '已通过'
    : accountValidationStatus === 'warning'
      ? `${accountValidationIssueCount} 笔需处理`
      : '暂无付款记录';
  const paymentProvider = project.paymentChannels[0] ?? '待确认';
  const projectBrand = request.generatedDetail?.brand ?? request.brand ?? '待补充';
  const requestReason = request.generatedDetail?.reason ?? '未单独填写';
  const submittedAt = request.approval?.submittedAt ?? request.createdAt;
  const returnDetails = requestApprovalReturnDetails(request.approval);
  const structuredReturnItems = returnDetails?.items ?? [];
  const hasScopedReturnItems = isReturned && structuredReturnItems.length > 0;
  const requestReturnReason = returnDetails?.reason?.trim() || '';
  const canSubmitPayment = canExecute
    && payablePayouts.length > 0
    && payablePayouts.length === project.payouts.length;
  const canReturnPayment = canExecute
    && payablePayouts.length > 0
    && payablePayouts.length === project.payouts.length;
  const returnItemForPayout = (payout: Payout) => {
    const invoice = generatedInvoices.find((record) => record.sourcePayoutId === payout.id);
    return invoice
      ? structuredReturnItems.find((item) => item.invoiceId === invoice.invoiceId)
      : undefined;
  };
  const returnedPayoutDetails = isReturned ? project.payouts.flatMap((payout) => {
    const returnItem = hasScopedReturnItems ? returnItemForPayout(payout) : undefined;
    if (!returnItem && !payoutHasFailureMarker(payout)) return [];
    return [{
      payoutId: payout.id,
      returnItem,
      reason: returnItem?.reason ?? payoutFailureReason(payout, requestReturnReason),
    }];
  }) : [];
  const returnedPayoutIds = new Set(returnedPayoutDetails.map((detail) => detail.payoutId));
  const returnedPayoutCount = returnedPayoutDetails.length;
  const passedPayoutCount = Math.max(0, project.payouts.length - returnedPayoutCount);
  const returnedReason = requestReturnReason
    || returnedPayoutDetails.find((detail) => detail.reason !== '未记录失败原因')?.reason
    || '未记录失败原因';
  const returnedAt = returnDetails?.occurredAt
    ?? project.payouts.find((payout) => payout.paymentFailureReturn?.occurredAt)
      ?.paymentFailureReturn?.occurredAt;
  const approvalSteps = paymentApprovalSteps(request, paymentProvider);
  const visibleApprovalSteps = approvalExpanded ? approvalSteps : approvalSteps.filter((step) => (
    step.id === 'submitted' || step.id === 'FINANCE' || step.state === 'current'
  ));
  const requestPaymentListIds = new Set([
    ...(request.paymentListIds ?? []),
    ...(request.paymentListId ? [request.paymentListId] : []),
  ]);
  const requestPaymentItems = paymentLists
    .filter((list) => (
      Boolean(
        request.paymentRequestProjectId
        && list.paymentRequestProjectId === request.paymentRequestProjectId,
      )
      || requestPaymentListIds.has(list.paymentListId)
    ))
    .flatMap((list) => list.items);
  const paymentItemForPayout = (payout: Payout): PaymentListItem | undefined => {
    const invoice = generatedInvoices.find((record) => record.sourcePayoutId === payout.id);
    return requestPaymentItems.find((item) => (
      item.invoiceId === invoice?.invoiceId
      || item.snapshot.invoiceNumber === payout.invoice
    ));
  };
  const paymentCurrencies = [...new Set(project.payouts.map((payout) => payout.currency))].join(' / ') || '待确认';
  const validationReady = accountValidationIssueCount === 0 && project.payouts.length > 0;
  const showOverview = stage === 'overview';

  const changeStage = (nextStage: PaymentExecutionStage) => {
    setStage(nextStage);
    window.requestAnimationFrame(() => {
      if (nextStage === 'overview') overviewFocusRef.current?.focus();
      else paymentListFocusRef.current?.focus();
    });
  };

  const executePayment = () => {
    if (onExecute(project.payouts)) onClose();
  };

  const submitReturn = () => {
    const normalizedReason = returnReason.trim();
    if (normalizedReason && onReturn(normalizedReason)) {
      setReturnDialogOpen(false);
      onClose();
    }
  };

  const openResourceDialog = (kind: 'contract' | 'invoice') => {
    setResourceDownloadError('');
    setResourceDialog(kind);
  };

  const closeResourceDialog = () => {
    setResourceDownloadError('');
    setResourceDialog(null);
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

  const invoicePdfBlob = async (invoice: GeneratedInvoiceRecord) => {
    const { generateInvoicePdf } = await import('../invoice/generateInvoice');
    return generateInvoicePdf(invoice.snapshot);
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

  const downloadInvoice = async (invoice: GeneratedInvoiceRecord) => {
    const recordKey = `invoice:${invoice.invoiceId}`;
    if (downloadingResource || downloadingResourceRecord) return;
    setDownloadingResourceRecord(recordKey);
    setResourceDownloadError('');
    try {
      downloadBlob(await invoicePdfBlob(invoice), invoiceFilename(invoice.snapshot, 'pdf'));
    } catch (error) {
      setResourceDownloadError(error instanceof Error ? error.message : 'Invoice 下载失败，请稍后重试。');
    } finally {
      setDownloadingResourceRecord('');
    }
  };

  const downloadContracts = async () => {
    if (!linkedContracts.length || downloadingResource || downloadingResourceRecord) return;
    setDownloadingResource('contract');
    setResourceDownloadError('');
    try {
      const entries = await Promise.all(linkedContracts.map(async (contract) => ({
        filename: contractDocumentFilename(contract),
        pdfBlob: await contractPdfBlob(contract),
      })));
      downloadBlob(
        await createFlatProjectPdfArchive(entries),
        projectPdfArchiveFilename(request.requestCode ?? request.id, 'contract'),
      );
    } catch (error) {
      setResourceDownloadError(error instanceof Error ? error.message : '合同压缩包生成失败，请稍后重试。');
    } finally {
      setDownloadingResource(null);
    }
  };

  const downloadInvoices = async () => {
    if (!linkedInvoices.length || downloadingResource || downloadingResourceRecord) return;
    setDownloadingResource('invoice');
    setResourceDownloadError('');
    try {
      const entries = await Promise.all(linkedInvoices.map(async (invoice) => ({
        filename: invoiceFilename(invoice.snapshot, 'pdf'),
        pdfBlob: await invoicePdfBlob(invoice),
      })));
      downloadBlob(
        await createFlatProjectPdfArchive(entries),
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
        title={`${project.requestCode} · ${isReturned ? '已退回详情' : '执行打款'}`}
        width={showOverview ? '520px' : '100vw'}
        className={`payment-execution-workspace is-${stage}${isReturned ? ' is-returned' : ''}`}
        onClose={onClose}
        onBackdropMouseDown={() => undefined}
        footer={showOverview ? (
          <div className="payment-execution-overview-footer">
            <div className={`payment-execution-overview-footer-note${isReturned ? ' is-returned' : ''}`}>
              {isReturned ? <AlertTriangle size={17} aria-hidden="true" /> : <ShieldCheck size={17} aria-hidden="true" />}
              <span>{isReturned
                ? '该项目审核未通过，可展开付款清单查看具体明细和退回原因。'
                : '付款信息已完成校验，可直接执行打款；也可先查看付款清单逐笔确认。'}</span>
            </div>
            <div className="payment-execution-overview-footer-actions">
              <Button variant="secondary" onClick={onClose}>关闭</Button>
              <Button
                variant="secondary"
                icon={<ArrowLeft size={16} />}
                onClick={() => changeStage('payment-list')}
              >
                查看付款清单
              </Button>
              {!isReturned ? (
                <Button
                  className="payment-execution-overview-submit-action"
                  icon={<Send size={16} />}
                  disabled={!canSubmitPayment}
                  onClick={executePayment}
                >
                  执行打款
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className={`payment-execution-footer${isReturned ? ' is-returned' : ''}`}>
            <div>
              <strong>{project.amount}</strong>
              <span>{isReturned
                ? `${returnedPayoutCount} 笔明细需修改，其余 ${passedPayoutCount} 笔已通过审核 · ${paymentProvider}`
                : `${validatedPayouts.length} 笔付款信息校验成功 · ${paymentProvider}`}</span>
            </div>
            <div>
              <Button variant="secondary" onClick={() => changeStage('overview')}>
                返回项目
              </Button>
              {!isReturned ? (
                <>
                  <Button
                    className="payment-execution-return-action"
                    variant="danger"
                    icon={<AlertTriangle size={16} />}
                    disabled={!canReturnPayment}
                    onClick={() => setReturnDialogOpen(true)}
                  >
                    退回媒介修改
                  </Button>
                  <Button
                    className="payment-execution-submit-action"
                    icon={<Send size={16} />}
                    disabled={!canSubmitPayment}
                    onClick={executePayment}
                  >
                    执行打款
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        )}
      >
        <div className={`payment-execution-shell${isReturned ? ` is-returned is-${stage}` : ` is-execution is-${stage}`}`} data-testid="payment-execution-workspace">
          <span className="payment-execution-stage-announcement" aria-live="polite">
            {showOverview
              ? isReturned ? '已打开退回项目概览' : '已打开请款项目概览'
              : isReturned ? '已展开退回付款清单详情' : '已进入付款清单核对'}
          </span>
          {!showOverview ? (
          <main
            ref={paymentListFocusRef}
            className={`payment-execution-main${isReturned ? ' is-returned' : ' payment-execution-board-card'}`}
            tabIndex={-1}
            aria-label="请款项目与达人请款信息"
          >
          {!isReturned ? (
            <section className="payment-execution-hero" aria-labelledby="payment-execution-project-title">
              <div className="payment-execution-hero-heading">
                <span className="payment-execution-section-icon"><WalletCards size={18} /></span>
                <div>
                  <p>请款项目信息</p>
                  <h2 id="payment-execution-project-title" title={project.cooperationProjectName}>{project.cooperationProjectName}</h2>
                  <small>{project.cooperationProjectCode} · {projectBrand}</small>
                </div>
                <span className="payment-execution-status"><i />待打款</span>
              </div>
              <div className="payment-execution-hero-summary" aria-label="付款项目摘要">
                <div className="is-amount"><span>付款总金额</span><strong>{project.amount}</strong></div>
                <div><span>付款单号</span><strong>{project.paymentOrder}</strong></div>
                <div><span>付款渠道</span><strong>{paymentProvider}</strong></div>
                <div><span>支付币种</span><strong>{paymentCurrencies}</strong></div>
                <div><span>预计付款时间</span><strong>{request.expectedPaymentDate || '待补充'}</strong></div>
              </div>
            </section>
          ) : (
          <section className="payment-execution-project payment-execution-content-card" aria-labelledby="payment-execution-project-title">
            <header>
              <div>
                <span className="payment-execution-section-icon"><WalletCards size={18} /></span>
                <div>
                  <h2 id="payment-execution-project-title">请款项目信息</h2>
                  <p>{project.cooperationProjectName}</p>
                </div>
              </div>
              <span className="payment-execution-status is-returned"><i />已退回</span>
            </header>

            <div className="payment-execution-metrics" aria-label="请款项目概览">
              <div><span>请款金额</span><strong>{project.amount}</strong></div>
              <div><span>关联资料</span><strong>{project.contracts + project.invoices} 份</strong><small>{project.contracts} 份合同 · {project.invoices} 份 Invoice</small></div>
              <div><span>付款单</span><strong>{project.paymentOrder}</strong><small>{paymentProvider} · {project.payouts.length} 笔明细</small></div>
            </div>

            <dl className="payment-execution-project-info">
              <div><dt>项目编号</dt><dd>{project.requestCode}</dd></div>
              <div><dt>关联项目</dt><dd>{project.cooperationProjectName}<small>{project.cooperationProjectCode}</small></dd></div>
              <div><dt>品牌 / 客户</dt><dd>{projectBrand}</dd></div>
              <div><dt>项目媒介</dt><dd>{project.media}</dd></div>
              <div><dt>负责 PM</dt><dd>{project.pm}</dd></div>
              <div><dt>提交人</dt><dd>{request.media}</dd></div>
              <div><dt>提交时间</dt><dd>{formatDateTime(submittedAt)}</dd></div>
              <div><dt>付款渠道</dt><dd>{paymentProvider}</dd></div>
              <div><dt>预计付款时间</dt><dd>{request.expectedPaymentDate || '待补充'}</dd></div>
              <div><dt>当前审批轮次</dt><dd>第 {request.approval?.round ?? 1} 轮</dd></div>
              <div className="is-wide"><dt>付款事由</dt><dd>{requestReason}</dd></div>
            </dl>
          </section>
          )}

          {isReturned ? (
            <section className="payment-execution-failure-card payment-execution-content-card" aria-labelledby="payment-execution-failure-title">
              <header>
                <div>
                  <span className="payment-execution-section-icon is-failure"><AlertTriangle size={18} /></span>
                  <div>
                    <h2 id="payment-execution-failure-title">退回原因</h2>
                    <p>{returnedPayoutCount} 位达人需修改 · {passedPayoutCount} 位达人已通过审核</p>
                  </div>
                </div>
                <span className="payment-execution-failure-count">{returnedPayoutCount} 位需处理</span>
              </header>
              <div className="payment-execution-failure-summary" role="alert">
                <AlertTriangle size={20} />
                <div>
                  <strong>{returnedReason}</strong>
                  <small>
                    {returnDetails
                      ? `${returnDetails.stageLabel} · ${returnDetails.actorName} · 第 ${returnDetails.round} 轮`
                      : '付款工作台退回'}
                    {returnedAt ? ` · ${formatDateTime(returnedAt)}` : ''}
                  </small>
                </div>
              </div>
            </section>
          ) : null}

          {!isReturned ? (
            <section className={`payment-execution-validation-alert is-${validationReady ? 'success' : 'warning'}`} role="status" aria-live="polite">
              <span>{validationReady ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}</span>
              <div>
                <strong>{validationReady
                  ? `${validatedPayouts.length} 笔付款信息均已校验，可执行打款`
                  : `还有 ${accountValidationIssueCount} 笔付款信息需要处理`}</strong>
                <p>{validationReady
                  ? '收款账户、Invoice 与付款资料已通过执行前核对。'
                  : '请完成全部付款信息校验；未通过前系统不会放行执行打款。'}</p>
              </div>
            </section>
          ) : null}

          <section className={`payment-execution-payees${isReturned ? ' payment-execution-content-card' : ' is-table-view'}`} aria-labelledby="payment-execution-payees-title">
            <header>
              <div>
                <span className="payment-execution-section-icon"><UserRound size={18} /></span>
                <div>
                  <h2 id="payment-execution-payees-title">达人付款信息</h2>
                  <p>{isReturned
                    ? `共 ${project.payouts.length} 位达人 · ${project.invoices} 份 Invoice`
                    : `逐笔核对付款字段与收款账户 · 已通过 ${validatedPayouts.length}/${project.payouts.length}`}</p>
                </div>
              </div>
            </header>

            {!isReturned ? (
              <div className="payment-execution-table-scroll">
                <table className="payment-execution-table">
                  <colgroup>
                    <col className="is-creator" />
                    <col className="is-account" />
                    <col className="is-currency" />
                    <col className="is-receive-currency" />
                    <col className="is-amount" />
                    <col className="is-fee" />
                    <col className="is-reason" />
                    <col className="is-reference" />
                    <col className="is-validation" />
                  </colgroup>
                  <thead><tr><th>达人名称</th><th>收款账户</th><th>支付币种</th><th>收款方币种</th><th>金额</th><th>手续费承担方</th><th>付款原因</th><th>交易附言</th><th>校验状态</th></tr></thead>
                  <tbody>
                    {project.payouts.map((payout) => {
                      const creator = creators.find((candidate) => candidate.id === payout.creatorId);
                      const informationValidated = payout.status === '等待付款';
                      const paymentItem = paymentItemForPayout(payout);
                      const receiveCurrency = paymentItem
                        ? String(paymentListItemValue(paymentItem, 'receiveCurrency') || payout.currency)
                        : payout.currency;
                      const paymentReason = paymentItem
                        ? String(paymentListItemValue(paymentItem, 'paymentReason') || '影音服务')
                        : '影音服务';
                      const transactionReference = paymentItem
                        ? String(paymentListItemValue(paymentItem, 'transactionReference') || payout.invoice)
                        : payout.invoice;
                      const feeBearer = paymentItem
                        ? paymentListItemValue(paymentItem, 'feeBearer')
                        : payout.feeBearer;
                      return (
                        <tr className={informationValidated ? 'is-valid' : 'is-pending'} key={payout.id}>
                          <td><div className="payment-execution-creator-cell"><CreatorIdentity creator={creator} displayName={payout.creator} initials={payout.initials} accent={payout.accent} fallbackHandle={payout.handle} fallbackPlatform={payout.creatorPlatform} /></div></td>
                          <td><div className="payment-execution-account-cell"><strong title={payout.account}>{accountDisplayValue(payout.account, '账户待补充')}</strong><small>{transferMethodLabel(payout)}</small></div></td>
                          <td><span className="payment-execution-currency">{payout.currency}</span></td>
                          <td><span className="payment-execution-currency">{receiveCurrency}</span></td>
                          <td className="payment-execution-amount-cell">{formatPayoutAmount(payout)}</td>
                          <td className="payment-execution-compact-cell" title={feeBearerLabel(feeBearer)}>{feeBearerLabel(feeBearer)}</td>
                          <td className="payment-execution-compact-cell" title={paymentReason}>{paymentReason}</td>
                          <td className="payment-execution-compact-cell" title={transactionReference}>{transactionReference}</td>
                          <td><span className={`payment-execution-table-status is-${informationValidated ? 'valid' : 'pending'}`}>{informationValidated ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{informationValidated ? '已通过' : '待校验'}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
            <div className="payment-execution-payee-list">
              {project.payouts.map((payout, index) => {
                const informationValidated = isPayoutPaymentInformationValidated(payout);
                const returnItem = hasScopedReturnItems ? returnItemForPayout(payout) : undefined;
                const detailReturned = isReturned && returnedPayoutIds.has(payout.id);
                const detailPassed = isReturned && !detailReturned;
                const failureReason = returnItem?.reason ?? payoutFailureReason(payout, requestReturnReason);
                return (
                  <article className={`payment-execution-payee${detailReturned ? ' is-returned' : ''}${detailPassed ? ' is-passed' : ''}`} key={payout.id}>
                    <header>
                      <span className="payment-execution-payee-avatar" style={{ '--payee-accent': payout.accent } as CSSProperties}>
                        {payout.initials}
                      </span>
                      <div>
                        <strong>{payout.creator}</strong>
                        <small>{payout.invoice} · {project.paymentOrder} · {paymentProviderDisplayName(payout.provider)}</small>
                      </div>
                      <span className={`payment-execution-payee-status ${detailReturned ? 'is-error' : detailPassed || informationValidated ? 'is-valid' : 'is-pending'}`}>
                        {detailReturned || (!detailPassed && !informationValidated) ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                        {detailReturned
                          ? '审核未通过'
                          : detailPassed
                            ? '已通过审核'
                            : informationValidated ? '付款信息校验成功' : '付款信息待校验'}
                      </span>
                    </header>
                    <div className={`payment-execution-account-note ${detailReturned ? 'is-error' : detailPassed || informationValidated ? 'is-valid' : 'is-pending'}`}>
                      {detailReturned || (!detailPassed && !informationValidated) ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                      <span>{detailReturned
                        ? <><b>具体退回原因：</b>{failureReason}</>
                        : detailPassed
                          ? '该达人请款信息已通过审核，无需修改'
                          : informationValidated
                            ? '付款信息校验成功，收款账户与付款资料均已通过审核'
                            : '付款信息尚未完成校验，暂不能执行打款'}</span>
                    </div>
                    <dl>
                      <div className="is-account"><dt>收款账户</dt><dd>{accountDisplayValue(payout.account)}<small>{transferMethodLabel(payout)}</small></dd></div>
                      <div><dt>支付币种</dt><dd>{payout.currency}</dd></div>
                      <div><dt>收款币种</dt><dd>{payout.currency}</dd></div>
                      <div className="is-money"><dt>付款金额</dt><dd>{formatPayoutAmount(payout)}</dd></div>
                      <div><dt>费用承担</dt><dd>{feeBearerLabel(payout.feeBearer)}</dd></div>
                      <div><dt>付款事由</dt><dd>{payout.deliverable || requestReason}</dd></div>
                      <div><dt>交易附言</dt><dd>{project.requestCode}-{String(index + 1).padStart(2, '0')}</dd></div>
                    </dl>
                    <footer>
                      <span><ReceiptText size={13} />Invoice {payout.invoice}</span>
                      <span><FileText size={13} />合同 {payout.contract}</span>
                      <span><Landmark size={13} />{paymentProviderDisplayName(payout.provider)}</span>
                    </footer>
                  </article>
                );
              })}
            </div>
            )}
          </section>
        </main>
          ) : null}

          <aside
            ref={showOverview ? overviewFocusRef : undefined}
            className={`payment-execution-side${isReturned ? '' : ' payment-execution-board-card'}`}
            aria-label={showOverview ? isReturned ? '已退回项目概览' : '请款项目概览' : '审批与关联资料'}
            tabIndex={showOverview ? -1 : undefined}
          >
            {showOverview && isReturned ? (
              <section className="payment-execution-failure-card payment-execution-overview-return-card" aria-labelledby="payment-execution-overview-failure-title">
                <header>
                  <div>
                    <span className="payment-execution-section-icon is-failure"><AlertTriangle size={18} /></span>
                    <div>
                      <h2 id="payment-execution-overview-failure-title">退回原因</h2>
                      <p>{returnedPayoutCount} 笔审核未通过 · {passedPayoutCount} 笔已通过审核</p>
                    </div>
                  </div>
                  <span className="payment-execution-failure-count">审核未通过</span>
                </header>
                <div className="payment-execution-failure-summary" role="alert">
                  <AlertTriangle size={20} />
                  <div>
                    <strong>{returnedReason}</strong>
                    <small>
                      {returnDetails
                        ? `${returnDetails.stageLabel} · ${returnDetails.actorName} · 第 ${returnDetails.round} 轮`
                        : '付款工作台退回'}
                      {returnedAt ? ` · ${formatDateTime(returnedAt)}` : ''}
                    </small>
                  </div>
                </div>
              </section>
            ) : null}
            {showOverview ? (
              <section className="payment-execution-project payment-execution-overview-project" aria-labelledby="payment-execution-project-title">
                <header>
                  <div>
                    <span className="payment-execution-section-icon"><WalletCards size={18} /></span>
                    <div>
                      <h2 id="payment-execution-project-title">请款项目信息</h2>
                      <p title={project.cooperationProjectName}>{project.cooperationProjectName}</p>
                    </div>
                  </div>
                  <span className={`payment-execution-status${isReturned ? ' is-returned' : ''}`}><i />{isReturned ? '已退回' : '待打款'}</span>
                </header>

                <div className="payment-execution-metrics" aria-label="请款项目概览">
                  <div><span>请款金额</span><strong>{project.amount}</strong></div>
                  <div><span>关联资料</span><strong>{project.contracts + project.invoices} 份</strong><small>{project.contracts} 份合同 · {project.invoices} 份 Invoice</small></div>
                  <div><span>付款单</span><strong>{project.paymentOrder}</strong><small>{paymentProvider} · {project.payouts.length} 笔明细</small></div>
                </div>

                <dl className="payment-execution-project-info">
                  <div><dt>项目编号</dt><dd>{project.requestCode}</dd></div>
                  <div><dt>关联项目</dt><dd>{project.cooperationProjectName}<small>{project.cooperationProjectCode}</small></dd></div>
                  <div><dt>品牌 / 客户</dt><dd>{projectBrand}</dd></div>
                  <div><dt>项目媒介</dt><dd>{project.media}</dd></div>
                  <div><dt>负责 PM</dt><dd>{project.pm}</dd></div>
                  <div><dt>提交人</dt><dd>{request.media}</dd></div>
                  <div><dt>提交时间</dt><dd>{formatDateTime(submittedAt)}</dd></div>
                  <div><dt>付款渠道</dt><dd>{paymentProvider}</dd></div>
                  <div><dt>预计付款时间</dt><dd>{request.expectedPaymentDate || '待补充'}</dd></div>
                  <div><dt>当前审批轮次</dt><dd>第 {request.approval?.round ?? 1} 轮</dd></div>
                  <div className="is-wide"><dt>付款事由</dt><dd>{requestReason}</dd></div>
                </dl>
              </section>
            ) : null}
            <section className={`payment-execution-approval${isReturned ? ' payment-execution-board-card' : ''}`} aria-labelledby="payment-execution-approval-title">
              <header>
                <div>
                  <span className="payment-execution-section-icon"><ShieldCheck size={18} /></span>
                  <div>
                    <h2 id="payment-execution-approval-title">当前审批流</h2>
                    <p>第 {request.approval?.round ?? 1} 轮 · {isReturned ? '请款已退回媒介修改' : '财务审批已完成'}</p>
                  </div>
                </div>
                <span className={isReturned ? 'is-returned' : ''}><CalendarClock size={14} />{isReturned ? '已退回' : '待执行'}</span>
              </header>
              <div className="payment-execution-approval-scroll" tabIndex={0} aria-label="付款审批流程">
                {isReturned ? (
                  <>
                    <div className="payment-execution-approval-return-note">
                      <AlertTriangle size={17} />
                      <div>
                        <strong>{returnDetails?.stageLabel ?? '付款工作台'}已退回</strong>
                        <p>{hasScopedReturnItems
                          ? `${returnedPayoutCount} 笔明细需要修改，具体原因请查看左侧对应达人卡片。`
                          : `${returnedPayoutCount} 笔明细需要修改，其余 ${passedPayoutCount} 笔已通过审核。`}</p>
                      </div>
                    </div>
                    <ApprovalTimeline
                      request={request}
                      paymentReady={false}
                      paymentProvider={paymentProvider}
                      compact
                    />
                  </>
                ) : approvalSteps.length ? (
                  <>
                    <ol className="payment-execution-vertical-steps">
                      {visibleApprovalSteps.map((step) => (
                        <li className={`is-${step.state}`} key={step.id} aria-current={step.state === 'current' ? 'step' : undefined}>
                          <span className="payment-execution-step-node" aria-hidden="true">{step.state === 'complete' ? <CheckCircle2 size={16} /> : <Circle size={15} />}</span>
                          <div><strong>{step.label}</strong><small>@{step.account}</small></div>
                          <time>{step.state === 'current' ? '待执行' : formatDateTime(step.time)}</time>
                        </li>
                      ))}
                    </ol>
                    <button className="payment-execution-approval-expand" type="button" aria-expanded={approvalExpanded} onClick={() => setApprovalExpanded((current) => !current)}>
                      {approvalExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      {approvalExpanded ? '收起审批记录' : `展开全部 ${approvalSteps.length} 个节点`}
                    </button>
                  </>
                ) : (
                  <div className="payment-execution-approval-empty"><CalendarClock size={20} /><span>暂无审批记录</span></div>
                )}
              </div>
            </section>

            <section className={`payment-execution-resources${isReturned ? ' payment-execution-board-card' : ''}`} aria-labelledby="payment-execution-resources-title">
              <header>
                <div>
                  <span className="payment-execution-section-icon"><Files size={18} /></span>
                  <div>
                    <h2 id="payment-execution-resources-title">关联资料</h2>
                    <p>合同、Invoice 与收款账户校验汇总</p>
                  </div>
                </div>
                <span>项目级汇总</span>
              </header>
              <div className="payment-execution-resource-list">
                <div className="payment-execution-resource-row">
                  <span className="payment-execution-resource-icon" aria-hidden="true"><FileText size={16} /></span>
                  <strong>合同 · {linkedContracts.length} 份</strong>
                  <div className="payment-execution-resource-actions">
                    <button type="button" disabled={!linkedContracts.length} onClick={() => openResourceDialog('contract')}>查看全部</button>
                    <button type="button" title="下载该请款项目的全部合同 PDF" aria-label="打包下载全部合同" disabled={!linkedContracts.length || Boolean(downloadingResource || downloadingResourceRecord)} onClick={() => { void downloadContracts(); }}>
                      {downloadingResource === 'contract' ? <LoaderCircle className="is-spinning" size={12} /> : <Download size={12} />}
                      {downloadingResource === 'contract' ? '打包中' : '下载'}
                    </button>
                  </div>
                </div>
                <div className="payment-execution-resource-row">
                  <span className="payment-execution-resource-icon" aria-hidden="true"><ReceiptText size={16} /></span>
                  <strong>Invoice · {linkedInvoices.length} 份</strong>
                  <div className="payment-execution-resource-actions">
                    <button type="button" disabled={!linkedInvoices.length} onClick={() => openResourceDialog('invoice')}>查看全部</button>
                    <button type="button" title="下载该请款项目的全部 Invoice PDF" aria-label="打包下载全部 Invoice" disabled={!linkedInvoices.length || Boolean(downloadingResource || downloadingResourceRecord)} onClick={() => { void downloadInvoices(); }}>
                      {downloadingResource === 'invoice' ? <LoaderCircle className="is-spinning" size={12} /> : <Download size={12} />}
                      {downloadingResource === 'invoice' ? '打包中' : '下载'}
                    </button>
                  </div>
                </div>
                <div className="payment-execution-resource-row">
                  <span className="payment-execution-resource-icon" aria-hidden="true"><Landmark size={16} /></span>
                  <strong>收款账户校验结果</strong>
                  <span className={`payment-execution-resource-status is-${accountValidationStatus}`}>{accountValidationLabel}</span>
                </div>
              </div>
              {resourceDownloadError ? <p className="finance-review-resource-error" role="alert">{resourceDownloadError}</p> : null}
            </section>
          </aside>
        </div>
      </Modal>

      {resourceDialog === 'contract' ? (
        <Modal
          title={`${request.requestCode ?? request.id} · 合同资料`}
          width="1120px"
          className="project-resource-modal request-resource-modal finance-review-resource-modal payment-execution-resource-modal"
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
                  icon={downloadingResource === 'contract' ? <LoaderCircle className="is-spinning" size={15} /> : <Download size={15} />}
                  disabled={!linkedContracts.length || Boolean(downloadingResource || downloadingResourceRecord)}
                  onClick={() => { void downloadContracts(); }}
                >
                  {downloadingResource === 'contract' ? '打包中' : '下载合同汇总'}
                </Button>
              </div>
            </div>
            {resourceDownloadError ? <p className="finance-review-resource-dialog-error" role="alert">{resourceDownloadError}</p> : null}
            <div className="finance-review-resource-card-list">
              {linkedContracts.map((contract) => {
                const creator = creators.find((candidate) => candidate.id === contract.creatorId);
                const contractId = stableContractId(contract);
                const recordKey = `contract:${contractId}`;
                const isDownloading = downloadingResourceRecord === recordKey;
                return (
                  <article className="finance-review-resource-card" key={contractId} aria-label={`${contract.name}，合同编号 ${contract.id}`}>
                    <span className="finance-review-resource-card-icon" aria-hidden="true"><FileText size={19} /></span>
                    <div className="finance-review-resource-card-identity">
                      <span>合同名称</span>
                      <strong title={contract.name}>{contract.name}</strong>
                      <small><b>合同编号</b>{contract.id}</small>
                    </div>
                    <div className="finance-review-resource-card-person">
                      <span>达人</span>
                      <CreatorIdentity creator={creator} displayName={contract.publisher ?? '达人档案缺失'} fallbackHandle={contract.creatorHandle} fallbackPlatform={contract.creatorPlatform ?? contract.platform} />
                    </div>
                    <div className="finance-review-resource-card-amount"><span>付款金额</span><strong>{formatContractMoney(contract)}</strong></div>
                    <span className="project-record-status"><i />{getContractReadiness(contract).label}</span>
                    <div className="finance-review-resource-card-actions">
                      <Button className="finance-review-resource-view" variant="secondary" icon={<Eye size={15} />} onClick={() => onOpenContract?.(contract.id)}>查看</Button>
                      <Button
                        className="finance-review-resource-download"
                        icon={isDownloading ? <LoaderCircle className="is-spinning" size={15} /> : <Download size={15} />}
                        disabled={Boolean(downloadingResource || downloadingResourceRecord)}
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
          className="project-resource-modal request-resource-modal finance-review-resource-modal payment-execution-resource-modal"
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
                  icon={downloadingResource === 'invoice' ? <LoaderCircle className="is-spinning" size={15} /> : <Download size={15} />}
                  disabled={!linkedInvoices.length || Boolean(downloadingResource || downloadingResourceRecord)}
                  onClick={() => { void downloadInvoices(); }}
                >
                  {downloadingResource === 'invoice' ? '打包中' : '下载 Invoice 汇总'}
                </Button>
              </div>
            </div>
            {resourceDownloadError ? <p className="finance-review-resource-dialog-error" role="alert">{resourceDownloadError}</p> : null}
            <div className="finance-review-resource-card-list">
              {linkedInvoices.map((linkedInvoice) => {
                const creator = creators.find((candidate) => candidate.id === linkedInvoice.snapshot.creatorId);
                const invoiceName = invoiceDocumentName(linkedInvoice.snapshot);
                const recordKey = `invoice:${linkedInvoice.invoiceId}`;
                const isDownloading = downloadingResourceRecord === recordKey;
                return (
                  <article className="finance-review-resource-card" key={linkedInvoice.invoiceId} aria-label={`${invoiceName}，Invoice 编号 ${linkedInvoice.id}`}>
                    <span className="finance-review-resource-card-icon is-invoice" aria-hidden="true"><ReceiptText size={19} /></span>
                    <div className="finance-review-resource-card-identity">
                      <span>Invoice 名称</span>
                      <strong title={invoiceName}>{invoiceName}</strong>
                      <small><b>Invoice 编号</b>{linkedInvoice.id}</small>
                    </div>
                    <div className="finance-review-resource-card-person">
                      <span>达人</span>
                      <CreatorIdentity creator={creator} displayName={linkedInvoice.snapshot.creatorName} fallbackHandle={linkedInvoice.snapshot.creatorHandle} fallbackPlatform={linkedInvoice.snapshot.creatorPlatform} />
                    </div>
                    <div className="finance-review-resource-card-amount"><span>Invoice 金额</span><strong>{formatInvoiceMoney(linkedInvoice.snapshot.currency, invoiceTotal(linkedInvoice.snapshot))}</strong></div>
                    <span className={`project-record-status${linkedInvoice.validationStatus === 'valid' ? '' : ' is-warning'}`}><i />{linkedInvoice.validationStatus === 'valid' ? '已通过' : '需重新校验'}</span>
                    <div className="finance-review-resource-card-actions">
                      <Button className="finance-review-resource-view" variant="secondary" icon={<Eye size={15} />} onClick={() => onOpenInvoice?.(linkedInvoice.invoiceId)}>查看</Button>
                      <Button
                        className="finance-review-resource-download"
                        icon={isDownloading ? <LoaderCircle className="is-spinning" size={15} /> : <Download size={15} />}
                        disabled={Boolean(downloadingResource || downloadingResourceRecord)}
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

      {!isReturned && returnDialogOpen ? (
        <Modal
          title="退回媒介修改"
          width="580px"
          onClose={() => setReturnDialogOpen(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setReturnDialogOpen(false)}>取消</Button>
              <Button variant="danger" disabled={!returnReason.trim()} onClick={submitReturn}>确认退回</Button>
            </>
          )}
        >
          <div className="payment-execution-return-content">
            <div className="payment-execution-return-heading">
              <AlertTriangle size={20} />
              <div>
                <strong>退回后将由媒介修改请款资料</strong>
                <p>媒介重新提交后，请款将回到财务审批节点，并保留本次退回原因。</p>
              </div>
            </div>
            <label className="payment-execution-return-field">
              <span>退回原因 <em>*</em></span>
              <textarea
                autoFocus
                rows={5}
                value={returnReason}
                placeholder="请说明需要媒介修改或补充的内容"
                onChange={(event) => setReturnReason(event.target.value)}
              />
              <small>退回原因会同步到请款项目详情与审批记录。</small>
            </label>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
