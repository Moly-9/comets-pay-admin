import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ChevronDown,
  CircleAlert,
  Coins,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Landmark,
  ListChecks,
  LoaderCircle,
  ReceiptText,
  RotateCcw,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { accountDisplayValue } from '../accountPresentation';
import { Avatar, Button } from '../components/Common';
import {
  PaymentAttachmentPreview,
  type PaymentAttachmentPreviewTarget,
} from '../components/PaymentAttachmentPreview';
import { PaymentFailureReturnDialog } from '../components/PaymentFailureReturnDialog';
import { PaymentProgressSteps } from '../components/PaymentProgressSteps';
import { paymentProviderDisplayName, PaymentProviderBadge } from '../components/PaymentProviderBadge';
import {
  paymentBatchAmountLabel,
  paymentBatchStatusCounts,
  type PaymentBatchItemSnapshot,
  type PaymentBatchRecord,
} from '../paymentBatches';
import type { ContractRecord } from '../contracts';
import { downloadBlob } from '../invoice/invoiceUtils';
import { paymentFailureRecoveryLabel } from '../paymentFailureRecovery';
import {
  createPaymentProjectContractArchive,
  createPaymentProjectInvoiceArchive,
  createPaymentProjectWorkbook,
  paymentProjectWorkbookFilename,
  resolvePaymentProjectDocuments,
} from '../paymentProjectDocuments';
import { projectPdfArchiveFilename } from '../projectResourcePdfArchive';
import type { CreatorProfile, GeneratedInvoiceRecord, PaymentFailureIssueType, Payout } from '../types';
import { CreatorIdentity } from '../components/CreatorIdentity';

const displayTime = (value?: string) => value ? value.replace('T', ' ') : '未记录';

const fundingAccountLabel = (value: string) => {
  if (value === 'mock-awx-operating') return 'Airwallex 运营资金账户';
  if (value === 'mock-awx-reserve') return 'Airwallex 备用资金账户';
  if (value === 'mock-paypal-balance') return 'PayPal Business Balance';
  if (value === 'mock-paymax-operating') return 'Payer Max 运营资金账户';
  return value || '未记录';
};

const creatorInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return Array.from(parts[0] ?? '?').slice(0, 2).join('').toUpperCase();
};

const CREATOR_ACCENTS = ['#e49728', '#4c78d8', '#dc5d5d', '#8b5bd6', '#2f8f72', '#b35c96'];

const creatorAccent = (value: string) => {
  const hash = Array.from(value).reduce((total, character) => total + character.charCodeAt(0), 0);
  return CREATOR_ACCENTS[hash % CREATOR_ACCENTS.length];
};

const paymentStatusTone = (status: string) => {
  if (/失败|异常|退回/.test(status)) return 'is-danger';
  if (/处理中|等待|审批/.test(status)) return 'is-processing';
  if (status === '已付款') return 'is-success';
  return 'is-neutral';
};

const batchStatusTone = (status: PaymentBatchRecord['status']) => {
  if (status === '部分失败' || status === '全部失败') return 'is-danger';
  if (status === '付款处理中') return 'is-processing';
  return 'is-success';
};

const money = (currency: string, amount: number | null) => (
  amount === null ? '未记录' : `${currency} ${amount.toLocaleString('en-US')}`
);

const contractSummary = (item: PaymentBatchItemSnapshot) => {
  if (item.contracts.length) return item.contracts.map((contract) => contract.contractCode).join('、');
  return item.legacyContractReference || '未关联';
};

const paymentOrderStatus = (items: readonly PaymentBatchItemSnapshot[]) => {
  if (items.some((item) => ['付款失败', '已退回'].includes(item.paymentStatus))) return '部分打款失败';
  if (items.length > 0 && items.every((item) => item.paymentStatus === '已付款')) return '已付款';
  return '付款处理中';
};

export function PaymentItemDetails({
  item,
  payout,
  onOpenFailurePaymentList,
  onViewContractAttachment,
  onViewInvoiceAttachment,
}: {
  item: PaymentBatchItemSnapshot;
  payout?: Payout;
  onOpenFailurePaymentList?: () => void;
  onViewContractAttachment?: (contract: PaymentBatchItemSnapshot['contracts'][number]) => void;
  onViewInvoiceAttachment?: (invoiceId: NonNullable<PaymentBatchItemSnapshot['invoice']>['invoiceId']) => void;
}) {
  return (
    <div className="payment-batch-item-details">
      <section className="payment-batch-detail-panel is-contract" aria-labelledby={`${item.payoutId}-contract-title`}>
        <header>
          <span className="payment-batch-detail-panel-icon" aria-hidden="true"><FileText size={17} /></span>
          <div>
            <h3 id={`${item.payoutId}-contract-title`}>合同</h3>
            <small>{item.contracts.length ? '付款关联文件' : '本笔未关联合同'}</small>
          </div>
          <div className="payment-batch-detail-panel-actions">
            <span className="payment-batch-detail-panel-badge">{item.contracts.length} 份</span>
            {item.contracts[0] ? (
              <button
                className="payment-batch-attachment-button"
                type="button"
                disabled={!onViewContractAttachment}
                title={onViewContractAttachment ? '查看合同附件' : '合同附件不可用'}
                aria-label={`查看合同附件 ${item.contracts[0].contractCode}`}
                onClick={() => onViewContractAttachment?.(item.contracts[0])}
              >
                <Eye size={13} aria-hidden="true" />
                查看附件
              </button>
            ) : null}
          </div>
        </header>
        {item.contracts.length ? (
          <div className="payment-batch-document-list">
            {item.contracts.map((contract) => (
              <article className="payment-batch-document-entry" key={contract.contractId}>
                <div className="payment-batch-document-entry-toolbar">
                  <span>{contract.contractCode}.pdf</span>
                </div>
                <dl>
                  <div><dt>合同编号</dt><dd>{contract.contractCode}</dd></div>
                  <div><dt>合同名称</dt><dd>{contract.name}</dd></div>
                  <div><dt>合同金额</dt><dd>{money(contract.currency, contract.amount)}</dd></div>
                  <div><dt>签署人</dt><dd>{contract.signer || (contract.signed ? '已签署' : '待签署')}</dd></div>
                  <div><dt>付款账户</dt><dd>{accountDisplayValue(contract.paymentAccount || item.accountSummary)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="payment-batch-detail-empty">
            {item.legacyContractReference && item.legacyContractReference !== '未关联合同（非必填）'
              ? `仅保留历史编号 ${item.legacyContractReference}，缺少稳定合同关联。`
              : '本笔付款未关联合同，合同为选填资料。'}
          </p>
        )}
      </section>

      <section className="payment-batch-detail-panel is-invoice" aria-labelledby={`${item.payoutId}-invoice-title`}>
        <header>
          <span className="payment-batch-detail-panel-icon" aria-hidden="true"><ReceiptText size={17} /></span>
          <div>
            <h3 id={`${item.payoutId}-invoice-title`}>Invoice</h3>
            <small>{item.invoice ? `V${item.invoice.version} · ${item.invoice.reviewStatus}` : '付款凭证与审核结果'}</small>
          </div>
          <div className="payment-batch-detail-panel-actions">
            <span className="payment-batch-detail-panel-badge">{item.invoice ? `V${item.invoice.version}` : '未关联'}</span>
            {item.invoice ? (
              <button
                className="payment-batch-attachment-button"
                type="button"
                disabled={!onViewInvoiceAttachment}
                title={onViewInvoiceAttachment ? '查看 Invoice 附件' : 'Invoice 附件不可用'}
                aria-label={`查看 Invoice 附件 ${item.invoice.invoiceNumber}`}
                onClick={() => onViewInvoiceAttachment?.(item.invoice!.invoiceId)}
              >
                <Eye size={13} aria-hidden="true" />
                查看附件
              </button>
            ) : null}
          </div>
        </header>
        {item.invoice ? (
          <dl>
            <div><dt>Invoice 编号</dt><dd>{item.invoice.invoiceNumber}</dd></div>
            <div><dt>Invoice 日期</dt><dd>{item.invoice.invoiceDate}</dd></div>
            <div><dt>Invoice 金额</dt><dd>{money(item.invoice.currency, item.invoice.amount)}</dd></div>
            <div><dt>付款账户</dt><dd>{accountDisplayValue(item.accountSummary)}</dd></div>
          </dl>
        ) : (
          <p className="payment-batch-detail-empty">
            {item.legacyInvoiceReference
              ? `仅保留历史编号 ${item.legacyInvoiceReference}，缺少稳定 Invoice 关联。`
              : '未关联 Invoice。'}
          </p>
        )}
      </section>

      <section className="payment-batch-detail-panel is-payment" aria-labelledby={`${item.payoutId}-payment-title`}>
        <header>
          <span className="payment-batch-detail-panel-icon" aria-hidden="true"><WalletCards size={17} /></span>
          <div>
            <h3 id={`${item.payoutId}-payment-title`}>付款信息</h3>
            <small>账户快照与渠道结果</small>
          </div>
          <span className={`payment-batch-detail-panel-badge ${paymentStatusTone(item.paymentStatus)}`}><i />{item.paymentStatus}</span>
        </header>
        <dl>
          <div><dt>付款单</dt><dd>{item.paymentListCode}{item.paymentListVersion ? ` · V${item.paymentListVersion}` : ''}</dd></div>
          <div><dt>付款渠道 / 方式</dt><dd>{paymentProviderDisplayName(item.provider)} · {item.transferMethod}</dd></div>
          <div><dt>支付 / 收款币种</dt><dd>{item.currency} / {item.receiveCurrency}</dd></div>
          <div><dt>收款账户</dt><dd>{accountDisplayValue(item.accountSummary)}</dd></div>
          <div><dt>费用承担</dt><dd>{item.feeBearer}</dd></div>
          <div><dt>付款原因</dt><dd>{item.paymentReason}</dd></div>
          <div><dt>交易附言</dt><dd>{item.transactionReference}</dd></div>
          <div><dt>描述</dt><dd>{item.description}</dd></div>
          <div><dt>渠道结果</dt><dd>{item.failure?.code ?? item.paymentStatus}</dd></div>
          <div><dt>付款时间</dt><dd>{displayTime(item.paidAt)}</dd></div>
        </dl>
        {item.failure ? (
          <div className="payment-batch-failure-result" role="status">
            <AlertTriangle size={17} aria-hidden="true" />
            <span>
              <strong>{item.failure.code}</strong>
              <small>{item.failure.response} · {displayTime(item.failure.occurredAt)}</small>
            </span>
          </div>
        ) : null}
        {payout?.paymentFailureReturn ? (
          <div className="payment-batch-failure-return" role="status">
            <div>
              <strong>{payout.paymentFailureReturn.issueType === 'PAYMENT_LIST' ? '失败款已转交媒介恢复' : 'Invoice 已退回修改'}</strong>
              <p>{payout.paymentFailureReturn.reason}</p>
              <small>{payout.paymentFailureReturn.actorName} · {displayTime(payout.paymentFailureReturn.occurredAt)}{payout.paymentFailureRecovery ? ` · ${paymentFailureRecoveryLabel(payout)}` : ''}</small>
            </div>
            {payout.paymentFailureReturn.issueType === 'PAYMENT_LIST' && onOpenFailurePaymentList ? (
              <Button variant="secondary" icon={<ExternalLink size={15} />} onClick={onOpenFailurePaymentList}>查看付款清单</Button>
            ) : null}
          </div>
        ) : null}
      </section>

      {item.associationIssues.length ? (
        <div className="payment-batch-association-warning" role="status">
          <CircleAlert size={17} aria-hidden="true" />
          <span><strong>关联资料缺失</strong>{item.associationIssues.join('；')}</span>
        </div>
      ) : null}
    </div>
  );
}

export function PaymentBatchDetailPage({
  batch,
  payouts = [],
  contracts = [],
  invoices = [],
  creators = [],
  projectItems,
  canHandleFailure = false,
  onBack,
  onReturnPayout,
  onOpenFailurePaymentList,
}: {
  batch: PaymentBatchRecord;
  payouts?: readonly Payout[];
  contracts?: readonly ContractRecord[];
  invoices?: readonly GeneratedInvoiceRecord[];
  creators?: readonly CreatorProfile[];
  projectItems?: readonly PaymentBatchItemSnapshot[];
  canHandleFailure?: boolean;
  onBack: () => void;
  onReturnPayout?: (payout: Payout, issueType: PaymentFailureIssueType, reason: string) => boolean;
  onOpenFailurePaymentList?: (requestId: string, payoutId: string) => void;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(() => (
    batch.items.find((item) => item.paymentStatus === '付款失败')?.payoutId ?? null
  ));
  const [failureDialogPayoutId, setFailureDialogPayoutId] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<PaymentAttachmentPreviewTarget | null>(null);
  const [downloadingResource, setDownloadingResource] = useState<'contract' | 'invoice' | 'workbook' | null>(null);
  const [resourceError, setResourceError] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const liveItems = useMemo(() => batch.items.map((item) => {
    const payout = payouts.find((candidate) => candidate.id === item.payoutId);
    if (!payout) return item;
    return {
      ...item,
      paymentStatus: payout.status,
      paidAt: payout.paidAt ?? item.paidAt,
      failure: payout.paymentFailure ? {
        code: payout.paymentFailure.errorCode,
        response: payout.paymentFailure.providerResponse,
        occurredAt: payout.paymentFailure.occurredAt,
      } : item.failure,
    };
  }), [batch.items, payouts]);
  const liveStatus: PaymentBatchRecord['status'] = liveItems.some((item) => ['付款失败', '已退回'].includes(item.paymentStatus))
    ? '部分失败'
    : liveItems.length > 0 && liveItems.every((item) => item.paymentStatus === '已付款')
      ? '已付款'
      : batch.status;
  const totals = paymentBatchAmountLabel({ items: liveItems });
  const projectArchiveItems = useMemo(() => {
    const sourceItems = projectItems?.length ? projectItems : liveItems;
    const seen = new Set<string>();
    return sourceItems.filter((item) => {
      if (seen.has(item.payoutId)) return false;
      seen.add(item.payoutId);
      return true;
    });
  }, [liveItems, projectItems]);
  const projectDocuments = useMemo(() => resolvePaymentProjectDocuments({
    items: projectArchiveItems,
    contracts,
    invoices,
  }), [contracts, invoices, projectArchiveItems]);
  const paymentOrders = useMemo(() => {
    const grouped = new Map<string, PaymentBatchItemSnapshot[]>();
    liveItems.forEach((item) => {
      const code = item.paymentListCode || '关联资料缺失';
      grouped.set(code, [...(grouped.get(code) ?? []), item]);
    });
    return [...grouped.entries()].map(([code, items]) => ({ code, items }));
  }, [liveItems]);
  const paymentOrderSummary = paymentOrders.length === 1 ? paymentOrders[0].code : `${paymentOrders.length} 张付款单`;
  const failureDialogItem = liveItems.find((item) => item.payoutId === failureDialogPayoutId);

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
    if (!projectArchiveItems.length || downloadingResource) return;
    setDownloadingResource(kind);
    setResourceError('');
    try {
      if (kind === 'contract') {
        downloadBlob(
          await createPaymentProjectContractArchive({ items: projectArchiveItems, contracts }),
          projectPdfArchiveFilename(batch.request.requestCode, 'contract'),
        );
      } else if (kind === 'invoice') {
        downloadBlob(
          await createPaymentProjectInvoiceArchive({ items: projectArchiveItems, invoices }),
          projectPdfArchiveFilename(batch.request.requestCode, 'invoice'),
        );
      } else {
        downloadBlob(
          await createPaymentProjectWorkbook({ request: batch.request, items: projectArchiveItems }),
          paymentProjectWorkbookFilename(batch.request.requestCode),
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

  return (
    <div className="page-stack payment-batch-detail-page">
      <button className="project-back-button payment-batch-detail-back" type="button" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true" />
        返回付款批次
      </button>

      <header className="payment-batch-detail-header">
        <div>
          <span>付款批次</span>
          <h1 ref={titleRef} tabIndex={-1}>{batch.paymentBatchCode}</h1>
          <p>{batch.request.cooperationProjectName}</p>
        </div>
        <div className="payment-batch-detail-total">
          <span className={`simple-status ${batchStatusTone(liveStatus)}`}><i />{liveStatus}</span>
          <strong>{totals}</strong>
          <small>{batch.items.length} 笔付款</small>
        </div>
      </header>

      <section className="payment-batch-detail-summary" aria-label="批次摘要">
        <div>
          <span className="payment-batch-summary-icon is-order" aria-hidden="true"><ReceiptText size={18} /></span>
          <span className="payment-batch-summary-content"><span>付款单</span><strong>{paymentOrderSummary}</strong><small>{batch.items.length} 笔付款明细</small></span>
        </div>
        <div>
          <span className="payment-batch-summary-icon is-payer" aria-hidden="true"><UserRound size={18} /></span>
          <span className="payment-batch-summary-content"><span>付款人 / 时间</span><strong>{batch.payer}</strong><small>{displayTime(batch.paidAt)}</small></span>
        </div>
        <div>
          <span className="payment-batch-summary-icon is-provider" aria-hidden="true"><Landmark size={18} /></span>
          <span className="payment-batch-summary-content"><span>付款渠道</span><strong>{paymentProviderDisplayName(batch.provider)}</strong><small>{fundingAccountLabel(batch.fundingAccountId)}</small></span>
        </div>
        <div>
          <span className="payment-batch-summary-icon is-currency" aria-hidden="true"><Coins size={18} /></span>
          <span className="payment-batch-summary-content"><span>支付币种</span><strong>{batch.sourceCurrency}</strong><small>批次总额 {totals}</small></span>
        </div>
      </section>

      <section className="payment-batch-detail-section payment-batch-lifecycle-section">
        <header><div><h2>渠道处理进度</h2><p>付款明细提交、平台处理与最终付款结果。</p></div></header>
        <PaymentProgressSteps ariaLabel="渠道处理进度" status={liveStatus} />
      </section>

      <section className="payment-batch-orders-section" aria-labelledby="payment-batch-orders-title">
        <header className="payment-batch-orders-heading">
          <div><h2 id="payment-batch-orders-title">付款单与付款明细</h2><p>每张付款单集中展示项目付款信息、付款项和渠道结果。</p></div>
          <div className="payment-project-resource-toolbar">
            <div className="payment-project-resource-actions" aria-label="下载付款项目资料">
              <Button
                variant="secondary"
                icon={downloadingResource === 'contract' ? <LoaderCircle className="is-spinning" size={15} /> : <FileText size={15} />}
                disabled={!projectDocuments.contracts.length || downloadingResource !== null}
                onClick={() => downloadProjectResource('contract')}
              >
                {downloadingResource === 'contract' ? '正在打包' : '下载合同'}
              </Button>
              <Button
                variant="secondary"
                icon={downloadingResource === 'invoice' ? <LoaderCircle className="is-spinning" size={15} /> : <ReceiptText size={15} />}
                disabled={!projectDocuments.invoices.length || downloadingResource !== null}
                onClick={() => downloadProjectResource('invoice')}
              >
                {downloadingResource === 'invoice' ? '正在打包' : '下载 Invoice'}
              </Button>
              <Button
                variant="secondary"
                icon={downloadingResource === 'workbook' ? <LoaderCircle className="is-spinning" size={15} /> : <FileSpreadsheet size={15} />}
                disabled={!projectArchiveItems.length || downloadingResource !== null}
                onClick={() => downloadProjectResource('workbook')}
              >
                {downloadingResource === 'workbook' ? '正在生成' : '下载付款表'}
              </Button>
            </div>
            <span>{paymentOrders.length} 张付款单 · {batch.items.length} 笔明细</span>
          </div>
        </header>
        {resourceError ? <p className="payment-project-resource-error" role="alert">{resourceError}</p> : null}
        <div className="payment-batch-order-list" role="list">
          {paymentOrders.map((order) => {
            const orderCounts = paymentBatchStatusCounts({ items: order.items });
            const orderStatus = paymentOrderStatus(order.items);
            const orderId = `payment-order-${order.code.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            return (
              <article className="payment-batch-order-card" key={order.code} role="listitem" aria-labelledby={`${orderId}-title`}>
                <header className="payment-batch-order-header">
                  <div className="payment-batch-order-identity">
                    <span aria-hidden="true"><WalletCards size={20} /></span>
                    <div><small>付款单</small><h2 id={`${orderId}-title`}>{order.code}</h2><p>{order.items.length} 笔付款明细</p></div>
                  </div>
                  <div className="payment-batch-order-result">
                    <span className={`simple-status ${paymentStatusTone(orderStatus)}`}><i />{orderStatus}</span>
                    <strong>{paymentBatchAmountLabel({ items: order.items })}</strong>
                    <small>{orderCounts.succeeded} 成功 · {orderCounts.failed} 失败 · {orderCounts.processing} 处理中</small>
                  </div>
                </header>

                <section className="payment-batch-order-project" aria-label={`${order.code} 付款信息`}>
                  <div className="payment-batch-project-heading">
                    <span aria-hidden="true"><Building2 size={20} /></span>
                    <div><h3 className="payment-batch-project-section-title">付款信息</h3><span className="payment-batch-project-name">{batch.request.cooperationProjectName}</span><small>{batch.request.cooperationProjectCode}</small></div>
                  </div>
                  <dl className="payment-batch-project-grid">
                    <div><dt>付款项目编号</dt><dd>{batch.request.requestCode}</dd></div>
                    <div><dt>付款金额</dt><dd>{paymentBatchAmountLabel({ items: order.items })}</dd></div>
                    <div><dt>品牌 / 客户</dt><dd>{batch.request.brand}</dd></div>
                    <div><dt>项目媒介</dt><dd>{batch.request.media}</dd></div>
                    <div><dt>负责 PM</dt><dd>{batch.request.pm}</dd></div>
                    <div><dt>预计付款时间</dt><dd>{batch.request.expectedPaymentDate}</dd></div>
                    <div className="payment-batch-project-full payment-batch-project-reason"><dt>付款事由</dt><dd>{batch.request.reason}</dd></div>
                  </dl>
                </section>

                <section className="payment-batch-order-items" aria-label={`${order.code} 付款明细`}>
                  <header>
                    <div className="payment-batch-order-items-heading">
                      <span aria-hidden="true"><ListChecks size={17} /></span>
                      <div><h3>付款明细</h3><p>展开付款项查看合同、Invoice、账户快照和渠道结果。</p></div>
                    </div>
                    <span className="payment-batch-order-items-count"><strong>{order.items.length}</strong> 笔</span>
                  </header>
                  <div className="payment-batch-item-list">
                    <div className="payment-batch-item-table-head" aria-hidden="true">
                      <span>达人</span>
                      <span>付款渠道</span>
                      <span>Invoice</span>
                      <span>合同</span>
                      <span>付款金额</span>
                      <span>付款状态</span>
                      <span />
                    </div>
                    <div className="payment-batch-item-rows" role="list">
                      {order.items.map((item) => {
                        const expanded = expandedItemId === item.payoutId;
                        const livePayout = payouts.find((payout) => payout.id === item.payoutId);
                        const detailId = `payment-batch-item-${item.payoutId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                        return (
                          <article className={expanded ? 'payment-batch-item is-expanded' : 'payment-batch-item'} key={item.payoutId} role="listitem">
                            <button
                              className="payment-batch-item-trigger"
                              type="button"
                              aria-expanded={expanded}
                              aria-controls={detailId}
                              aria-label={`${item.creatorName}，${money(item.currency, item.amount)}，${item.paymentStatus}，${expanded ? '收起' : '展开'}付款详情`}
                              onClick={() => setExpandedItemId(expanded ? null : item.payoutId)}
                            >
                              <span className="payment-batch-item-person">
                                <Avatar initials={creatorInitials(item.creatorName)} accent={creatorAccent(item.creatorName)} size="sm" />
                                <CreatorIdentity creator={creators.find((creator) => creator.id === item.creatorId)} displayName={item.creatorName} fallbackHandle={item.creatorHandle} fallbackPlatform={item.creatorPlatform} socialAccountsMode="expanded" />
                              </span>
                              <span className="payment-batch-item-provider" data-label="付款渠道"><PaymentProviderBadge compact provider={item.provider} /><small>{item.transferMethod}</small></span>
                              <span data-label="Invoice" title={item.invoice?.invoiceNumber ?? item.legacyInvoiceReference ?? '未关联'}><strong>{item.invoice?.invoiceNumber ?? item.legacyInvoiceReference ?? '未关联'}</strong></span>
                              <span data-label="合同" title={contractSummary(item)}><strong>{contractSummary(item)}</strong></span>
                              <span className="payment-batch-item-amount" data-label="付款金额"><strong>{money(item.currency, item.amount)}</strong></span>
                              <span className={`payment-batch-item-status ${paymentStatusTone(item.paymentStatus)}`} data-label="付款状态"><strong><i />{item.paymentStatus}</strong></span>
                              <span className="payment-batch-item-expand-icon" aria-hidden="true"><ChevronDown size={17} /></span>
                            </button>
                            {expanded ? (
                              <div id={detailId}>
                                <PaymentItemDetails
                                  item={item}
                                  payout={livePayout}
                                  onOpenFailurePaymentList={onOpenFailurePaymentList ? () => onOpenFailurePaymentList(batch.request.paymentRequestProjectId, item.payoutId) : undefined}
                                  onViewContractAttachment={contracts.length ? viewContractAttachment : undefined}
                                  onViewInvoiceAttachment={invoices.length ? viewInvoiceAttachment : undefined}
                                />
                                {item.paymentStatus === '付款失败' && !livePayout?.paymentFailureReturn ? (
                                  <div className="payment-project-failure-action">
                                    <div>
                                      <strong>该笔付款需要财务判断问题类型</strong>
                                      <span>退回后仅处理当前失败款，批次内已成功付款不会受影响。</span>
                                    </div>
                                    <Button
                                      variant="danger"
                                      icon={<RotateCcw size={16} />}
                                      disabled={!canHandleFailure || !onReturnPayout}
                                      onClick={() => setFailureDialogPayoutId(item.payoutId)}
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
                    </div>
                  </div>
                </section>
              </article>
            );
          })}
          {!paymentOrders.length ? (
            <div className="payment-batch-detail-empty-state" role="status">
              <ReceiptText size={22} aria-hidden="true" />
              <strong>该批次暂无付款明细</strong>
              <span>批次记录存在，但没有可展示的付款项快照。</span>
            </div>
          ) : null}
        </div>
      </section>

      {failureDialogPayoutId && failureDialogItem && onReturnPayout ? (
        <PaymentFailureReturnDialog
          key={failureDialogPayoutId}
          item={failureDialogItem}
          onClose={() => setFailureDialogPayoutId(null)}
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
