import {
  AlertTriangle,
  ArrowLeft,
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
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { accountDisplayValue } from '../accountPresentation';
import { Button, ListActionButton } from '../components/Common';
import {
  PaymentAttachmentPreview,
  type PaymentAttachmentPreviewTarget,
} from '../components/PaymentAttachmentPreview';
import { PaymentFailureReturnDialog } from '../components/PaymentFailureReturnDialog';
import { PaymentProgressSteps } from '../components/PaymentProgressSteps';
import { paymentProviderDisplayName, PaymentProviderBadge } from '../components/PaymentProviderBadge';
import {
  paymentBatchAmountLabel,
  paymentBatchItemAttemptLabel,
  paymentBatchItemAttemptNumber,
  paymentBatchItemOrderCode,
  paymentBatchItemSourceOrderCode,
  paymentBatchStatusCounts,
  type PaymentBatchItemSnapshot,
  type PaymentBatchRecord,
} from '../paymentBatches';
import type { ContractRecord } from '../contracts';
import { downloadBlob } from '../invoice/invoiceUtils';
import { paymentFailureRecoveryLabel } from '../paymentFailureRecovery';
import {
  createPaymentItemConfirmationPdf,
  createPaymentProjectWorkbook,
  paymentItemConfirmationFilename,
  paymentProjectWorkbookFilename,
} from '../paymentProjectDocuments';
import type { CreatorProfile, GeneratedInvoiceRecord, PaymentFailureIssueType, Payout } from '../types';
import { PaymentCreatorIdentity } from '../components/PaymentCreatorIdentity';
import { paymentCreatorIdentityFromBatchItem } from '../paymentCreatorIdentity';

const displayTime = (value?: string) => value ? value.replace('T', ' ') : '未记录';

const fundingAccountLabel = (value: string) => {
  if (value === 'mock-awx-operating') return 'Airwallex 运营资金账户';
  if (value === 'mock-awx-reserve') return 'Airwallex 备用资金账户';
  if (value === 'mock-paypal-balance') return 'PayPal Business Balance';
  if (value === 'mock-paymax-operating') return 'Payer Max 运营资金账户';
  return value || '未记录';
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

const paymentOrderStatus = (items: readonly PaymentBatchItemSnapshot[]) => {
  if (items.some((item) => ['付款失败', '已退回'].includes(item.paymentStatus))) return '部分打款失败';
  if (items.length > 0 && items.every((item) => item.paymentStatus === '已付款')) return '已付款';
  return '付款处理中';
};

const paymentDateLabel = (value?: string) => value
  ? value.replace('T', ' ').split(' ')[0]
  : '—';

const paymentFeeLabel = (item: PaymentBatchItemSnapshot) => (
  item.transferFeeAmount !== undefined && item.transferFeeCurrency
    ? money(item.transferFeeCurrency, item.transferFeeAmount)
    : '—'
);

export function PaymentItemDetails({
  item,
  payout,
  mode = 'complete',
  onOpenFailurePaymentList,
  onViewContractAttachment,
  onViewInvoiceAttachment,
}: {
  item: PaymentBatchItemSnapshot;
  payout?: Payout;
  mode?: 'complete' | 'payment-only';
  onOpenFailurePaymentList?: () => void;
  onViewContractAttachment?: (contract: PaymentBatchItemSnapshot['contracts'][number]) => void;
  onViewInvoiceAttachment?: (invoiceId: NonNullable<PaymentBatchItemSnapshot['invoice']>['invoiceId']) => void;
}) {
  return (
    <div className="payment-batch-item-details">
      {mode === 'complete' ? (
        <>
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

        </>
      ) : null}

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
          <div><dt>付款单</dt><dd>{paymentBatchItemOrderCode(item)}</dd></div>
          {paymentBatchItemAttemptNumber(item) > 1 ? <div><dt>原付款单</dt><dd>{paymentBatchItemSourceOrderCode(item)}</dd></div> : null}
          <div><dt>付款类型</dt><dd>{paymentBatchItemAttemptLabel(item)}</dd></div>
          <div><dt>付款渠道 / 方式</dt><dd>{paymentProviderDisplayName(item.provider)} · {item.transferMethod}</dd></div>
          <div><dt>支付 / 收款币种</dt><dd>{item.currency} / {item.receiveCurrency}</dd></div>
          <div><dt>收款账户</dt><dd>{accountDisplayValue(item.accountSummary)}</dd></div>
          <div><dt>费用承担</dt><dd>{item.feeBearer}</dd></div>
          <div><dt>付款原因</dt><dd>{item.paymentReason}</dd></div>
          <div><dt>交易附言</dt><dd>{item.transactionReference}</dd></div>
          <div><dt>描述</dt><dd>{item.description}</dd></div>
          <div><dt>渠道结果</dt><dd>{item.failure?.code ?? item.paymentStatus}</dd></div>
          <div><dt>付款时间</dt><dd>{displayTime(item.paidAt)}</dd></div>
          {mode === 'payment-only' ? (
            <>
              <div><dt>本地清算方式</dt><dd>{item.localClearingSystem || item.transferMethod || '待补充'}</dd></div>
              <div><dt>收款国家 / 地区</dt><dd>{item.recipientCountry || '待补充'}</dd></div>
              <div><dt>付款方实付</dt><dd>{item.actualPaidAmount !== undefined && item.actualPaidCurrency ? money(item.actualPaidCurrency, item.actualPaidAmount) : '—'}</dd></div>
              <div><dt>手续费金额</dt><dd>{item.transferFeeAmount !== undefined && item.transferFeeCurrency ? money(item.transferFeeCurrency, item.transferFeeAmount) : '—'}</dd></div>
              <div><dt>交易后余额</dt><dd>{item.postTransactionBalance !== undefined && item.postTransactionBalanceCurrency ? money(item.postTransactionBalanceCurrency, item.postTransactionBalance) : '—'}</dd></div>
            </>
          ) : null}
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

      {mode === 'complete' && item.associationIssues.length ? (
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
  const [downloadingResource, setDownloadingResource] = useState<'workbook' | null>(null);
  const [downloadingConfirmationId, setDownloadingConfirmationId] = useState<string | null>(null);
  const [resourceError, setResourceError] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const totals = paymentBatchAmountLabel(batch);
  const projectArchiveItems = useMemo(() => {
    const sourceItems = projectItems?.length ? projectItems : batch.items;
    const seen = new Set<string>();
    return sourceItems.filter((item) => {
      if (seen.has(item.payoutId)) return false;
      seen.add(item.payoutId);
      return true;
    });
  }, [batch.items, projectItems]);
  const paymentOrders = useMemo(() => {
    const grouped = new Map<string, PaymentBatchItemSnapshot[]>();
    batch.items.forEach((item) => {
      const code = paymentBatchItemOrderCode(item);
      grouped.set(code, [...(grouped.get(code) ?? []), item]);
    });
    return [...grouped.entries()].map(([code, items]) => ({ code, items }));
  }, [batch.items]);
  const paymentOrderSummary = paymentOrders.length === 1 ? paymentOrders[0].code : `${paymentOrders.length} 张付款单`;
  const failureDialogItem = batch.items.find((item) => item.payoutId === failureDialogPayoutId);

  const currentAttemptPayout = (item: PaymentBatchItemSnapshot) => payouts.find((payout) => (
    payout.id === item.payoutId
    && (
      payout.currentPaymentAttempt?.paymentBatchId === batch.paymentBatchId
      || payout.paymentFailureRecovery?.retryBatchId === batch.paymentBatchId
    )
  ));

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

  const downloadProjectWorkbook = async () => {
    if (!projectArchiveItems.length || downloadingResource) return;
    setDownloadingResource('workbook');
    setResourceError('');
    try {
      downloadBlob(
        await createPaymentProjectWorkbook({ request: batch.request, items: projectArchiveItems }),
        paymentProjectWorkbookFilename(batch.request.requestCode),
      );
    } catch (error) {
      setResourceError(error instanceof Error ? error.message : '项目资料下载失败，请稍后重试。');
    } finally {
      setDownloadingResource(null);
    }
  };

  const downloadItemConfirmation = async (item: PaymentBatchItemSnapshot) => {
    if (downloadingConfirmationId) return;
    setDownloadingConfirmationId(item.payoutId);
    setResourceError('');
    try {
      downloadBlob(
        await createPaymentItemConfirmationPdf({ item }),
        paymentItemConfirmationFilename(item),
      );
    } catch (error) {
      setResourceError(error instanceof Error ? error.message : '付款确认函下载失败，请稍后重试。');
    } finally {
      setDownloadingConfirmationId(null);
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
          <p>{batch.request.cooperationProjectCode} · {batch.request.cooperationProjectName}</p>
        </div>
        <div className="payment-batch-detail-total">
          <span className={`simple-status ${batchStatusTone(batch.status)}`}><i />{batch.status}</span>
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
        <PaymentProgressSteps ariaLabel="渠道处理进度" status={batch.status} />
      </section>

      <section className="payment-batch-orders-section" aria-labelledby="payment-batch-orders-title">
        <header className="payment-batch-orders-heading">
          <div><h2 id="payment-batch-orders-title">付款单与付款明细</h2><p>每次重新付款创建新付款单，并保留与原付款单的结果关联。</p></div>
          <div className="payment-project-resource-toolbar">
            <div className="payment-project-resource-actions" aria-label="下载付款项目资料">
              <Button
                variant="secondary"
                icon={downloadingResource === 'workbook' ? <LoaderCircle className="is-spinning" size={15} /> : <FileSpreadsheet size={15} />}
                disabled={!projectArchiveItems.length || downloadingResource !== null}
                disabledReason={downloadingResource ? '文件正在导出，请稍候。' : '当前没有可导出的付款确认文件。'}
                onClick={downloadProjectWorkbook}
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
            const attemptNumber = paymentBatchItemAttemptNumber(order.items[0]);
            const sourcePaymentOrderCode = paymentBatchItemSourceOrderCode(order.items[0]);
            return (
              <article className="payment-batch-order-card" key={order.code} role="listitem" aria-labelledby={`${orderId}-title`}>
                <header className="payment-batch-order-header">
                  <div className="payment-batch-order-identity">
                    <span aria-hidden="true"><WalletCards size={20} /></span>
                    <div>
                      <small>付款单</small>
                      <h2 id={`${orderId}-title`}>{order.code}</h2>
                      <p>{paymentBatchItemAttemptLabel(order.items[0])}{attemptNumber > 1 ? ` · 关联原付款单 ${sourcePaymentOrderCode}` : ''} · {order.items.length} 笔付款明细</p>
                    </div>
                  </div>
                  <div className="payment-batch-order-result">
                    <span className={`simple-status ${paymentStatusTone(orderStatus)}`}><i />{orderStatus}</span>
                    <strong>{paymentBatchAmountLabel({ items: order.items })}</strong>
                    <small>{orderCounts.succeeded} 成功 · {orderCounts.failed} 失败 · {orderCounts.processing} 处理中</small>
                  </div>
                </header>

                <section className="payment-batch-order-items" aria-label={`${order.code} 付款明细`}>
                  <header>
                    <div className="payment-batch-order-items-heading">
                      <span aria-hidden="true"><ListChecks size={17} /></span>
                      <div><h3>付款明细</h3><p>展开付款项查看合同、Invoice、账户快照和渠道结果。</p></div>
                    </div>
                    <span className="payment-batch-order-items-count"><strong>{order.items.length}</strong> 笔</span>
                  </header>
                  <div className="payment-batch-order-table-scroll" role="region" aria-label={`${order.code} 付款明细表，可横向滚动`} tabIndex={0}>
                    <table className="data-table payment-batch-order-table">
                      <thead>
                        <tr>
                          <th>达人</th>
                          <th>关联项目</th>
                          <th>付款渠道</th>
                          <th>收款银行账号</th>
                          <th>付款日期</th>
                          <th>付款金额</th>
                          <th>手续费</th>
                          <th>付款类型</th>
                          <th>付款状态</th>
                          <th className="action-cell">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                      {order.items.map((item) => {
                        const expanded = expandedItemId === item.payoutId;
                        const livePayout = currentAttemptPayout(item);
                        const creator = creators.find((candidate) => candidate.id === item.creatorId);
                        const creatorIdentity = paymentCreatorIdentityFromBatchItem(item, creator);
                        const detailId = `payment-batch-item-${item.payoutId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                        const confirmationDisabledReason = item.provider !== 'Airwallex'
                          ? '当前付款渠道不支持付款确认函。'
                          : item.paymentStatus !== '已付款' || !item.paidAt
                            ? '仅已付款且已记录付款日期的明细可以下载确认函。'
                            : undefined;
                        return (
                          <Fragment key={item.payoutId}>
                            <tr className={expanded ? 'is-expanded' : undefined}>
                              <td className="payment-batch-table-creator-cell">
                                <button
                                  className="payment-batch-table-detail-trigger"
                                  type="button"
                                  aria-expanded={expanded}
                                  aria-controls={detailId}
                                  aria-label={`${item.creatorName}，${money(item.currency, item.amount)}，${item.paymentStatus}，${expanded ? '收起' : '展开'}付款详情`}
                                  onClick={() => setExpandedItemId(expanded ? null : item.payoutId)}
                                >
                                  <PaymentCreatorIdentity {...creatorIdentity} />
                                  <ChevronDown size={16} aria-hidden="true" />
                                </button>
                              </td>
                              <td className="payment-batch-table-project-cell"><strong>{batch.request.cooperationProjectCode}</strong><small>{batch.request.cooperationProjectName}</small></td>
                              <td><span className="payment-batch-table-provider"><PaymentProviderBadge compact provider={item.provider} /><small>{item.transferMethod}</small></span></td>
                              <td className="payment-batch-table-account-cell"><strong title={item.accountIdentifier || item.accountSummary}>{item.accountIdentifier || item.accountSummary}</strong><small>{item.accountIdentifierLabel || '收款账户快照'}</small></td>
                              <td className="payment-batch-table-date-cell">{paymentDateLabel(item.paidAt)}</td>
                              <td className="payment-batch-table-money-cell"><strong>{money(item.currency, item.amount)}</strong></td>
                              <td className="payment-batch-table-money-cell">{paymentFeeLabel(item)}</td>
                              <td><span className={`payment-batch-attempt-badge${paymentBatchItemAttemptNumber(item) > 1 ? ' is-retry' : ''}`}>{paymentBatchItemAttemptLabel(item)}</span></td>
                              <td><span className={`simple-status ${paymentStatusTone(item.paymentStatus)}`}><i />{item.paymentStatus}</span></td>
                              <td className="action-cell payment-batch-table-action-cell">
                                <ListActionButton
                                  kind="download"
                                  loading={downloadingConfirmationId === item.payoutId}
                                  disabled={Boolean(confirmationDisabledReason) || Boolean(downloadingConfirmationId)}
                                  title={confirmationDisabledReason}
                                  aria-label={`下载 ${item.creatorName} 的付款确认函`}
                                  onClick={() => { void downloadItemConfirmation(item); }}
                                >
                                  {downloadingConfirmationId === item.payoutId ? '下载中' : '下载确认函'}
                                </ListActionButton>
                              </td>
                            </tr>
                            {expanded ? (
                              <tr className="payment-batch-table-detail-row">
                                <td colSpan={10} id={detailId}>
                                  <PaymentItemDetails
                                    item={item}
                                    payout={livePayout}
                                    onOpenFailurePaymentList={onOpenFailurePaymentList ? () => onOpenFailurePaymentList(batch.request.paymentRequestProjectId, item.payoutId) : undefined}
                                    onViewContractAttachment={contracts.length ? viewContractAttachment : undefined}
                                    onViewInvoiceAttachment={invoices.length ? viewInvoiceAttachment : undefined}
                                  />
                                  {item.paymentStatus === '付款失败'
                                    && livePayout?.status === '付款失败'
                                    && !livePayout.paymentFailureReturn ? (
                                    <div className="payment-project-failure-action">
                                      <div>
                                        <strong>该笔付款需要财务判断问题类型</strong>
                                        <span>退回后仅处理当前失败款，批次内已成功付款不会受影响。</span>
                                      </div>
                                      <Button
                                        variant="danger"
                                        icon={<RotateCcw size={16} />}
                                        disabled={!canHandleFailure || !onReturnPayout}
                                        disabledReason={!onReturnPayout ? '当前流程未配置退回操作。' : '当前账号或付款状态不允许退回。'}
                                        onClick={() => setFailureDialogPayoutId(item.payoutId)}
                                      >
                                        退回媒介处理
                                      </Button>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                      </tbody>
                    </table>
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
            const payout = currentAttemptPayout(failureDialogItem);
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
