import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  ChevronDown,
  CircleAlert,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Common';
import {
  PaymentAttachmentPreview,
  type PaymentAttachmentPreviewTarget,
} from '../components/PaymentAttachmentPreview';
import { PaymentFailureReturnDialog } from '../components/PaymentFailureReturnDialog';
import { PaymentProgressSteps } from '../components/PaymentProgressSteps';
import { PaymentProviderBadge, PaymentProviderBadges } from '../components/PaymentProviderBadge';
import {
  paymentBatchAmountLabel,
  paymentBatchStatusCounts,
  type PaymentBatchItemSnapshot,
  type PaymentProjectPaymentRecord,
} from '../paymentBatches';
import type { ContractRecord } from '../contracts';
import { downloadBlob } from '../invoice/invoiceUtils';
import {
  createPaymentProjectContractArchive,
  createPaymentProjectInvoiceArchive,
  createPaymentProjectWorkbook,
  paymentProjectWorkbookFilename,
  resolvePaymentProjectDocuments,
} from '../paymentProjectDocuments';
import { projectPdfArchiveFilename } from '../projectResourcePdfArchive';
import type { CreatorProfile, GeneratedInvoiceRecord, PaymentFailureIssueType, Payout } from '../types';
import { PaymentItemDetails } from './PaymentBatchDetailPage';
import './PaymentProjectPaymentDetailPage.css';

const displayTime = (value?: string) => value
  ? value.replace('T', ' ').replace(/\.\d{3}Z$/, '')
  : '未记录';

const money = (currency: string, amount: number) => `${currency} ${amount.toLocaleString('en-US')}`;

const paymentStatusTone = (status: string) => {
  if (/失败|异常|退回/.test(status)) return 'is-danger';
  if (/处理中|等待|审批/.test(status)) return 'is-processing';
  if (status === '已付款') return 'is-success';
  return 'is-neutral';
};

const projectStatusTone = (status: PaymentProjectPaymentRecord['status']) => {
  if (status === '部分失败' || status === '全部失败' || status === '已退回') return 'is-danger';
  if (status === '付款处理中') return 'is-processing';
  return 'is-success';
};

const projectSummaryResultTone = (status: PaymentProjectPaymentRecord['status']) => {
  if (status === '部分失败' || status === '全部失败' || status === '已退回') return 'is-result-danger';
  if (status === '付款处理中') return 'is-result-processing';
  return 'is-result-success';
};

const initialExpandedItemId = (record: PaymentProjectPaymentRecord) => (
  record.items.find((item) => item.paymentStatus === '付款失败')?.payoutId ?? null
);

const paymentResultPlaceholder = (status: Payout['status']) => (
  status === '付款处理中' ? '待渠道回写' : '—'
);

const paymentResultMoney = ({
  status,
  amount,
  currency,
}: {
  status: Payout['status'];
  amount?: number;
  currency?: string;
}) => (
  status === '已付款' && amount !== undefined && currency
    ? money(currency, amount)
    : paymentResultPlaceholder(status)
);

const paymentResultDate = (status: Payout['status'], paidAt?: string) => {
  if (status !== '已付款') return paymentResultPlaceholder(status);
  if (!paidAt) return '—';
  return paidAt.replace('T', ' ').split(' ')[0] || '—';
};

export function PaymentProjectPaymentDetailPage({
  record,
  payouts,
  contracts = [],
  invoices = [],
  creators = [],
  canHandleFailure,
  onBack,
  onReturnPayout,
  onOpenFailurePaymentList,
}: {
  record: PaymentProjectPaymentRecord;
  payouts: readonly Payout[];
  contracts?: readonly ContractRecord[];
  invoices?: readonly GeneratedInvoiceRecord[];
  creators?: readonly CreatorProfile[];
  canHandleFailure: boolean;
  onBack: () => void;
  onReturnPayout: (payout: Payout, issueType: PaymentFailureIssueType, reason: string) => boolean;
  onOpenFailurePaymentList?: (requestId: string, payoutId: string) => void;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(() => initialExpandedItemId(record));
  const [failureDialogPayoutId, setFailureDialogPayoutId] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<PaymentAttachmentPreviewTarget | null>(null);
  const [downloadingResource, setDownloadingResource] = useState<'contract' | 'invoice' | 'workbook' | null>(null);
  const [resourceError, setResourceError] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const totals = paymentBatchAmountLabel(record);
  const statusCounts = paymentBatchStatusCounts(record);
  const failedItems = useMemo(
    () => record.items.filter((item) => item.paymentStatus === '付款失败'),
    [record.items],
  );
  const dialogItem = record.items.find((item) => item.payoutId === failureDialogPayoutId);
  const projectDocuments = useMemo(() => resolvePaymentProjectDocuments({
    items: record.items,
    contracts,
    invoices,
  }), [contracts, invoices, record.items]);

  const viewContractAttachment = (snapshot: PaymentBatchItemSnapshot['contracts'][number]) => {
    const contract = contracts.find((candidate) => (
      String(candidate.contractId ?? candidate.id) === String(snapshot.contractId)
      || candidate.id === snapshot.contractCode
    ));
    if (!contract) {
      setResourceError('未找到该合同的附件记录，请返回项目资料检查关联。');
      return;
    }
    setResourceError('');
    setPreviewTarget({ kind: 'contract', contract });
  };

  const viewInvoiceAttachment = (invoiceId: NonNullable<PaymentBatchItemSnapshot['invoice']>['invoiceId']) => {
    const invoice = invoices.find((candidate) => String(candidate.invoiceId) === String(invoiceId));
    if (!invoice) {
      setResourceError('未找到该 Invoice 的附件记录，请返回项目资料检查关联。');
      return;
    }
    setResourceError('');
    setPreviewTarget({ kind: 'invoice', invoice });
  };

  const downloadProjectResource = async (kind: 'contract' | 'invoice' | 'workbook') => {
    if (!record.items.length || downloadingResource) return;
    setDownloadingResource(kind);
    setResourceError('');
    try {
      if (kind === 'contract') {
        downloadBlob(
          await createPaymentProjectContractArchive({ items: record.items, contracts }),
          projectPdfArchiveFilename(record.request.requestCode, 'contract'),
        );
      } else if (kind === 'invoice') {
        downloadBlob(
          await createPaymentProjectInvoiceArchive({ items: record.items, invoices }),
          projectPdfArchiveFilename(record.request.requestCode, 'invoice'),
        );
      } else {
        downloadBlob(
          await createPaymentProjectWorkbook({ request: record.request, items: record.items }),
          paymentProjectWorkbookFilename(record.request.requestCode),
        );
      }
    } catch (error) {
      setResourceError(error instanceof Error ? error.message : '项目资料下载失败，请稍后重试。');
    } finally {
      setDownloadingResource(null);
    }
  };

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (expandedItemId && record.items.some((item) => item.payoutId === expandedItemId)) return;
    setExpandedItemId(initialExpandedItemId(record));
  }, [expandedItemId, record]);

  const openFailureDialog = (payoutId: string) => {
    setFailureDialogPayoutId(payoutId);
  };

  const closeFailureDialog = () => {
    setFailureDialogPayoutId(null);
  };

  const revealFirstFailure = () => {
    const first = failedItems[0];
    if (!first) return;
    setExpandedItemId(first.payoutId);
    window.requestAnimationFrame(() => {
      document.getElementById(`payment-project-item-${first.payoutId.replace(/[^a-zA-Z0-9_-]/g, '-')}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  return (
    <div className="page-stack payment-batch-detail-page payment-project-payment-detail-page">
      <button className="project-back-button payment-batch-detail-back" type="button" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true" />
        返回付款工作台
      </button>

      <header className="payment-batch-detail-header">
        <div>
          <span>付款项目</span>
          <h1 ref={titleRef} tabIndex={-1}>{record.request.requestCode}</h1>
          <p>{record.request.cooperationProjectCode} · {record.request.cooperationProjectName}</p>
        </div>
        <div className="payment-batch-detail-total">
          <span className={`simple-status ${projectStatusTone(record.status)}`}><i />{record.status}</span>
          <strong>{totals}</strong>
          <small>{record.items.length} 笔付款明细</small>
        </div>
      </header>

      <section className="payment-batch-detail-summary payment-project-summary-grid" aria-label="项目付款摘要">
        <div className="payment-project-summary-card is-order">
          <span className="payment-project-summary-icon" aria-hidden="true"><ReceiptText size={18} /></span>
          <div>
            <span>付款单</span>
            <strong>{record.paymentOrderCodes.join('、') || '未关联'}</strong>
            <small>{record.paymentOrderCodes.length} 份付款清单</small>
          </div>
        </div>
        <div className="payment-project-summary-card is-provider">
          <span className="payment-project-summary-icon" aria-hidden="true"><WalletCards size={18} /></span>
          <div>
            <span>付款渠道</span>
            <PaymentProviderBadges compact providers={record.providers} />
            <small>{record.providers.length} 个执行渠道</small>
          </div>
        </div>
        <div className={`payment-project-summary-card ${projectSummaryResultTone(record.status)}`}>
          <span className="payment-project-summary-icon" aria-hidden="true"><Activity size={18} /></span>
          <div>
            <span>处理结果</span>
            <strong>{statusCounts.succeeded} 成功 · {statusCounts.failed} 失败</strong>
            <small>{statusCounts.processing} 笔处理中</small>
          </div>
        </div>
        <div className="payment-project-summary-card is-updated">
          <span className="payment-project-summary-icon" aria-hidden="true"><CalendarClock size={18} /></span>
          <div>
            <span>最近更新</span>
            <strong>{displayTime(record.lastActivityAt)}</strong>
            <small>以渠道回写时间为准</small>
          </div>
        </div>
      </section>

      {failedItems.length ? (
        <section className="payment-project-failure-overview" role="status" aria-live="polite">
          <span aria-hidden="true"><AlertTriangle size={19} /></span>
          <div>
            <strong>{failedItems.length} 笔付款失败需要处理</strong>
            <p>失败记录已优先展开。请核对渠道结果，并逐笔退回媒介修正对应资料。</p>
          </div>
          <Button variant="danger" icon={<CircleAlert size={16} />} onClick={revealFirstFailure}>查看失败明细</Button>
        </section>
      ) : null}

      <section className="payment-batch-detail-section payment-batch-lifecycle-section">
        <header>
          <div>
            <h2>项目付款进度</h2>
            <p>当前请款项目全部付款明细的渠道处理结果。</p>
          </div>
        </header>
        <PaymentProgressSteps ariaLabel="项目付款进度" status={record.status} />
      </section>

      <section className="payment-batch-detail-section">
        <header>
          <div><h2>付款项目信息</h2><p>本页面仅展示当前付款项目，不混入同批次的其他项目。</p></div>
          <span className={`simple-status ${projectStatusTone(record.status)}`}><i />{record.status}</span>
        </header>
        <div className="payment-batch-project-heading">
          <span aria-hidden="true"><Building2 size={20} /></span>
          <div><span className="payment-batch-project-name">{record.request.cooperationProjectName}</span><small>{record.request.cooperationProjectCode}</small></div>
        </div>
        <dl className="payment-batch-project-grid">
          <div><dt>付款编号</dt><dd>{record.request.requestCode}</dd></div>
          <div><dt>付款金额</dt><dd>{record.request.amount}</dd></div>
          <div><dt>品牌 / 客户</dt><dd>{record.request.brand}</dd></div>
          <div><dt>项目媒介</dt><dd>{record.request.media}</dd></div>
          <div><dt>负责 PM</dt><dd>{record.request.pm}</dd></div>
          <div><dt>付款主体</dt><dd>{record.request.paymentEntity || '待补充'}</dd></div>
          <div><dt>项目费用归属</dt><dd>{record.request.projectCostAttribution || '待补充'}</dd></div>
          <div><dt>预计付款时间</dt><dd>{record.request.expectedPaymentDate}</dd></div>
          <div><dt>成本类型</dt><dd>{record.request.costType || '待补充'}</dd></div>
          <div><dt>成本类型明细</dt><dd>{record.request.costType === '采购成本' ? record.request.costTypeDetail || '待补充' : '—'}</dd></div>
          <div className="payment-batch-project-full"><dt>付款事由</dt><dd>{record.request.reason}</dd></div>
        </dl>
      </section>

      <section className="payment-batch-detail-section payment-batch-items-section">
        <header>
          <div><h2>付款明细</h2><p>查看当前项目每笔付款的合同、Invoice、账户快照和渠道结果。</p></div>
          <div className="payment-project-resource-toolbar">
            <div className="payment-project-resource-actions" aria-label="下载付款项目资料">
              <Button
                variant="secondary"
                icon={downloadingResource === 'contract' ? <LoaderCircle className="is-spinning" size={15} /> : <FileText size={15} />}
                disabled={!projectDocuments.contracts.length || downloadingResource !== null}
                disabledReason={downloadingResource ? '文件正在导出，请稍候。' : '当前没有可导出的合同文件。'}
                onClick={() => downloadProjectResource('contract')}
              >
                {downloadingResource === 'contract' ? '正在打包' : '下载合同'}
              </Button>
              <Button
                variant="secondary"
                icon={downloadingResource === 'invoice' ? <LoaderCircle className="is-spinning" size={15} /> : <ReceiptText size={15} />}
                disabled={!projectDocuments.invoices.length || downloadingResource !== null}
                disabledReason={downloadingResource ? '文件正在导出，请稍候。' : '当前没有可导出的 Invoice 文件。'}
                onClick={() => downloadProjectResource('invoice')}
              >
                {downloadingResource === 'invoice' ? '正在打包' : '下载 Invoice'}
              </Button>
              <Button
                variant="secondary"
                icon={downloadingResource === 'workbook' ? <LoaderCircle className="is-spinning" size={15} /> : <FileSpreadsheet size={15} />}
                disabled={!record.items.length || downloadingResource !== null}
                disabledReason={downloadingResource ? '文件正在导出，请稍候。' : '当前没有可导出的付款确认文件。'}
                onClick={() => downloadProjectResource('workbook')}
              >
                {downloadingResource === 'workbook' ? '正在生成' : '下载付款表'}
              </Button>
            </div>
            <span>{record.items.length} 笔</span>
          </div>
        </header>
        {resourceError ? <p className="payment-project-resource-error" role="alert">{resourceError}</p> : null}
        <div className="payment-batch-item-list payment-project-detail-item-list">
          <div className="payment-batch-item-table-head payment-project-detail-item-head" aria-hidden="true">
            <span>达人名称</span>
            <span>付款渠道</span>
            <span>收款银行账号</span>
            <span>付款日期</span>
            <span>付款金额</span>
            <span>支付总金额</span>
            <span>手续费金额</span>
            <span>付款状态</span>
            <span />
          </div>
          <div className="payment-batch-item-rows" role="list">
            {record.items.map((item) => {
              const expanded = expandedItemId === item.payoutId;
              const livePayout = payouts.find((payout) => payout.id === item.payoutId);
              const currentStatus = livePayout?.status ?? item.paymentStatus;
              const displayName = creators.find((creator) => creator.id === item.creatorId)?.name ?? item.creatorName;
              const accountName = item.accountName || '待补充';
              const accountIdentifier = item.accountIdentifier || item.accountSummary || '待补充';
              const itemDomId = `payment-project-item-${item.payoutId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
              const detailId = `${itemDomId}-details`;
              return (
                <article
                  id={itemDomId}
                  className={`payment-batch-item payment-project-detail-item${expanded ? ' is-expanded' : ''}`}
                  key={item.payoutId}
                  role="listitem"
                >
                  <button
                    className="payment-batch-item-trigger payment-project-detail-item-trigger"
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={detailId}
                    aria-label={`${accountName}，${money(item.currency, item.amount)}，${currentStatus}，${expanded ? '收起' : '展开'}付款详情`}
                    onClick={() => setExpandedItemId(expanded ? null : item.payoutId)}
                  >
                    <span className="payment-batch-item-person payment-project-detail-item-person">
                      <span>
                        <strong title={accountName}>{accountName}</strong>
                        <small title={displayName}>{displayName}</small>
                      </span>
                    </span>
                    <span className="payment-batch-item-provider" data-label="付款渠道">
                      <PaymentProviderBadge compact provider={item.provider} />
                    </span>
                    <span data-label="收款银行账号">
                      <strong title={accountIdentifier}>{accountIdentifier}</strong>
                      <small>{item.accountIdentifierLabel || '收款账户快照'}</small>
                    </span>
                    <span data-label="付款日期"><strong>{paymentResultDate(currentStatus, livePayout?.paidAt ?? item.paidAt)}</strong></span>
                    <span className="payment-project-detail-item-money" data-label="付款金额"><strong>{money(item.currency, item.amount)}</strong></span>
                    <span className="payment-project-detail-item-money" data-label="支付总金额">
                      <strong>{paymentResultMoney({
                        status: currentStatus,
                        amount: livePayout?.actualPaidAmount ?? item.actualPaidAmount,
                        currency: livePayout?.actualPaidCurrency ?? item.actualPaidCurrency,
                      })}</strong>
                    </span>
                    <span className="payment-project-detail-item-money" data-label="手续费金额">
                      <strong>{paymentResultMoney({
                        status: currentStatus,
                        amount: livePayout?.transferFeeAmount ?? item.transferFeeAmount,
                        currency: livePayout?.transferFeeCurrency ?? item.transferFeeCurrency,
                      })}</strong>
                    </span>
                    <span className={`payment-batch-item-status ${paymentStatusTone(currentStatus)}`} data-label="付款状态"><strong><i />{currentStatus}</strong></span>
                    <span className="payment-batch-item-expand-icon" aria-hidden="true"><ChevronDown size={17} /></span>
                  </button>
                  {expanded ? (
                    <div id={detailId}>
                      <PaymentItemDetails
                        item={item}
                        payout={livePayout}
                        onOpenFailurePaymentList={onOpenFailurePaymentList ? () => onOpenFailurePaymentList(record.request.paymentRequestProjectId, item.payoutId) : undefined}
                        onViewContractAttachment={contracts.length ? viewContractAttachment : undefined}
                        onViewInvoiceAttachment={invoices.length ? viewInvoiceAttachment : undefined}
                      />
                      {currentStatus === '付款失败' && !livePayout?.paymentFailureReturn ? (
                        <div className="payment-project-failure-action">
                          <div>
                            <strong>该笔付款需要财务判断问题类型</strong>
                            <span>退回后不能直接重试，媒介需从对应资料节点重新提交。</span>
                          </div>
                          <Button
                            variant="danger"
                            icon={<RotateCcw size={16} />}
                            disabled={!canHandleFailure}
                            disabledReason="当前账号或付款状态不允许退回媒介处理。"
                            onClick={() => openFailureDialog(item.payoutId)}
                          >
                            退回媒介处理
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
            {!record.items.length ? (
              <div className="payment-batch-detail-empty-state" role="status">
                <ReceiptText size={22} aria-hidden="true" />
                <strong>该项目暂无付款明细</strong>
                <span>请款记录存在，但没有可展示的付款项快照。</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {failureDialogPayoutId && dialogItem ? (
        <PaymentFailureReturnDialog
          key={failureDialogPayoutId}
          item={dialogItem}
          onClose={closeFailureDialog}
          onSubmit={(issueType, reason) => {
            const payout = payouts.find((candidate) => candidate.id === failureDialogPayoutId);
            return payout ? onReturnPayout(payout, issueType, reason) : false;
          }}
        />
      ) : null}
      {previewTarget ? (
        <PaymentAttachmentPreview target={previewTarget} onClose={() => setPreviewTarget(null)} />
      ) : null}
    </div>
  );
}
