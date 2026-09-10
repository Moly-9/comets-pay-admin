import {
  AlertTriangle,
  ArrowLeft,
  CircleAlert,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  ListChecks,
  LoaderCircle,
  ReceiptText,
  RotateCcw,
  WalletCards,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accountDisplayValue } from '../accountPresentation';
import { Button, ListActionButton } from '../components/Common';
import { PaymentFailureReturnDialog } from '../components/PaymentFailureReturnDialog';
import { PaymentProgressSteps } from '../components/PaymentProgressSteps';
import { paymentProviderDisplayName, PaymentProviderBadge } from '../components/PaymentProviderBadge';
import {
  paymentBatchFinancialSummary,
  paymentBatchItemForAttempt,
  paymentBatchItemAttemptLabel,
  paymentBatchItemAttemptNumber,
  paymentBatchItemOrderCode,
  paymentBatchItemSourceOrderCode,
  paymentBatchMoneyTotalsLabel,
  paymentBatchStatusCounts,
  type PaymentBatchItemSnapshot,
  type PaymentBatchRecord,
} from '../paymentBatches';
import { downloadBlob } from '../invoice/invoiceUtils';
import { paymentFailureRecoveryLabel } from '../paymentFailureRecovery';
import {
  createPaymentItemConfirmationPdf,
  paymentItemConfirmationFilename,
} from '../paymentProjectDocuments';
import {
  createPaymentBatchWorkbook,
  paymentBatchDetailWorkbookFilename,
} from '../paymentBatchWorkbook';
import type { CreatorProfile, PaymentFailureIssueType, Payout } from '../types';
import { PaymentCreatorIdentity } from '../components/PaymentCreatorIdentity';
import { paymentCreatorIdentityFromBatchItem } from '../paymentCreatorIdentity';
import { paymentFeeBearerDisplayName } from '../paymentFeeBearerPresentation';
import './PaymentBatchDetailPage.css';

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
  if (items.length > 0 && items.every((item) => ['付款失败', '已退回'].includes(item.paymentStatus))) return '全部失败';
  if (items.some((item) => ['付款失败', '已退回'].includes(item.paymentStatus))) return '部分失败';
  if (items.length > 0 && items.every((item) => item.paymentStatus === '已付款')) return '已付款';
  return '付款处理中';
};

const paymentDateLabel = (value?: string) => value
  ? value.replace('T', ' ').split(' ')[0]
  : '—';

const paymentFeeLabel = (item: PaymentBatchItemSnapshot) => (
  item.paymentStatus === '付款处理中'
    ? '待渠道回写'
    : item.transferFeeAmount !== undefined && item.transferFeeCurrency
      ? money(item.transferFeeCurrency, item.transferFeeAmount)
      : '—'
);

const paymentResultValue = (
  item: PaymentBatchItemSnapshot,
  amount?: number,
  currency?: string,
) => {
  if (item.paymentStatus === '付款处理中') return '待渠道回写';
  return amount !== undefined && currency ? money(currency, amount) : '—';
};

const channelWritebackTime = (item: PaymentBatchItemSnapshot) => (
  item.paymentStatus === '付款处理中'
    ? '待渠道回写'
    : displayTime(item.failure?.occurredAt ?? item.paidAt)
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
          <div className="is-payment-order"><dt>付款单</dt><dd>{paymentBatchItemOrderCode(item)}</dd></div>
          {paymentBatchItemAttemptNumber(item) > 1 ? <div className="is-source-payment-order"><dt>原付款单</dt><dd>{paymentBatchItemSourceOrderCode(item)}</dd></div> : null}
          <div className="is-payment-type"><dt>付款类型</dt><dd>{paymentBatchItemAttemptLabel(item)}</dd></div>
          <div className="is-provider-method"><dt>付款渠道 / 方式</dt><dd>{paymentProviderDisplayName(item.provider)} · {item.transferMethod}</dd></div>
          {mode === 'payment-only' ? (
            <>
              <div className="is-local-clearing"><dt>本地清算方式</dt><dd>{item.localClearingSystem || item.transferMethod || '待补充'}</dd></div>
              <div className="is-recipient-country"><dt>收款国家 / 地区</dt><dd>{item.recipientCountry || '待补充'}</dd></div>
            </>
          ) : null}
          <div className="is-currencies"><dt>支付 / 收款币种</dt><dd>{item.currency} / {item.receiveCurrency}</dd></div>
          <div className="is-account"><dt>收款账户</dt><dd>{accountDisplayValue(item.accountSummary)}</dd></div>
          <div className="is-fee-bearer"><dt>费用承担</dt><dd>{paymentFeeBearerDisplayName(item.feeBearer)}</dd></div>
          <div className="is-payment-reason is-wide"><dt>付款原因</dt><dd>{item.paymentReason}</dd></div>
          <div className="is-transaction-reference"><dt>交易附言</dt><dd>{item.transactionReference}</dd></div>
          <div className="is-description is-wide"><dt>描述</dt><dd>{item.description}</dd></div>
          <div className="is-provider-result"><dt>渠道结果</dt><dd>{item.failure?.code ?? item.paymentStatus}</dd></div>
          <div className="is-paid-at"><dt>付款时间</dt><dd>{displayTime(item.paidAt)}</dd></div>
          <div className="is-channel-writeback"><dt>渠道回写时间</dt><dd>{channelWritebackTime(item)}</dd></div>
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

export function PaymentBatchItemDrawer({
  batch,
  canHandleFailure,
  creator,
  item,
  onClose,
  onOpenFailurePaymentList,
  onRequestFailureReturn,
  payout,
}: {
  batch: PaymentBatchRecord;
  canHandleFailure: boolean;
  creator?: CreatorProfile;
  item: PaymentBatchItemSnapshot;
  onClose: () => void;
  onOpenFailurePaymentList?: () => void;
  onRequestFailureReturn?: () => void;
  payout?: Payout;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const creatorIdentity = paymentCreatorIdentityFromBatchItem(item, creator);
  const titleId = `payment-batch-item-drawer-${item.payoutId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const canReturnFailure = item.paymentStatus === '付款失败'
    && payout?.status === '付款失败'
    && !payout.paymentFailureReturn
    && Boolean(onRequestFailureReturn);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled):not([aria-disabled="true"]), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => !element.hasAttribute('hidden'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="payment-batch-item-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        className="payment-batch-item-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="payment-batch-item-drawer-header">
          <div><span>付款明细</span><h2 id={titleId}>{creatorIdentity.accountName}</h2></div>
          <div className="payment-batch-item-drawer-header-actions">
            <span className={`payment-batch-attempt-badge${batch.paymentAttemptNumber > 1 ? ' is-retry' : ''}`}>{paymentBatchItemAttemptLabel(item)}</span>
            <span className={`simple-status ${paymentStatusTone(item.paymentStatus)}`}><i />{item.paymentStatus}</span>
            <button ref={closeButtonRef} className="icon-button" type="button" aria-label="关闭付款明细" onClick={onClose}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="payment-batch-item-drawer-content">
          <section className="payment-batch-drawer-recipient" aria-label="收款人与批次信息">
            <div className="payment-batch-drawer-recipient-heading">
              <PaymentCreatorIdentity size="lg" {...creatorIdentity} />
              <PaymentProviderBadge compact provider={item.provider} />
            </div>
            <div className="payment-batch-drawer-financial-summary" aria-label="本次付款金额">
              <div><span>付款金额</span><strong>{money(item.currency, item.amount)}</strong></div>
              <div><span>手续费金额</span><strong>{paymentFeeLabel(item)}</strong></div>
              <div><span>实际付款金额</span><strong>{paymentResultValue(item, item.actualPaidAmount, item.actualPaidCurrency)}</strong></div>
            </div>
            <dl>
              <div><dt>{item.accountIdentifierLabel || '收款账户'}</dt><dd>{item.accountIdentifier || item.accountSummary || '待补充'}</dd></div>
              <div><dt>所属批次</dt><dd className="payment-batch-drawer-code" title={batch.paymentBatchCode}>{batch.paymentBatchCode}</dd></div>
              <div><dt>所属付款项目</dt><dd className="payment-batch-drawer-code" title={batch.request.requestCode}>{batch.request.requestCode}</dd></div>
              <div><dt>付款编号</dt><dd className="payment-batch-drawer-code" title={item.paymentCode || '付款编号待补全'}>{item.paymentCode || '付款编号待补全'}</dd></div>
              <div><dt>付款单</dt><dd className="payment-batch-drawer-code" title={batch.paymentOrderCode}>{batch.paymentOrderCode}</dd></div>
              {batch.sourcePaymentOrderCode ? <div><dt>原付款单</dt><dd className="payment-batch-drawer-code" title={batch.sourcePaymentOrderCode}>{batch.sourcePaymentOrderCode}</dd></div> : null}
            </dl>
          </section>
          <PaymentItemDetails
            item={item}
            payout={payout}
            mode="payment-only"
            onOpenFailurePaymentList={onOpenFailurePaymentList}
          />
        </div>
        <footer className="payment-batch-item-drawer-footer">
          <Button variant="secondary" onClick={onClose}>关闭</Button>
          {canReturnFailure ? (
            <Button
              variant="danger"
              icon={<RotateCcw size={16} />}
              disabled={!canHandleFailure}
              disabledReason="当前账号或付款状态不允许退回媒介处理。"
              onClick={onRequestFailureReturn}
            >
              退回媒介处理
            </Button>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}

export function PaymentBatchDetailPage({
  batch,
  payouts = [],
  creators = [],
  currentRequestStatus,
  canHandleFailure = false,
  onBack,
  onReturnPayout,
  onOpenFailurePaymentList,
}: {
  batch: PaymentBatchRecord;
  payouts?: readonly Payout[];
  creators?: readonly CreatorProfile[];
  currentRequestStatus?: string;
  canHandleFailure?: boolean;
  onBack: () => void;
  onReturnPayout?: (payout: Payout, issueType: PaymentFailureIssueType, reason: string) => boolean;
  onOpenFailurePaymentList?: (requestId: string, payoutId: string) => void;
}) {
  const [selectedDetailItemId, setSelectedDetailItemId] = useState<string | null>(null);
  const [failureDialogPayoutId, setFailureDialogPayoutId] = useState<string | null>(null);
  const [downloadingResource, setDownloadingResource] = useState<'workbook' | null>(null);
  const [downloadingConfirmationId, setDownloadingConfirmationId] = useState<string | null>(null);
  const [resourceError, setResourceError] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const financialSummary = useMemo(() => paymentBatchFinancialSummary(batch), [batch]);
  const actualPaidTotal = batch.status === '付款处理中'
    ? '待渠道回写'
    : paymentBatchMoneyTotalsLabel(financialSummary.actualPaidAmounts);
  const batchItems = financialSummary.items;
  const orderCounts = paymentBatchStatusCounts({ items: batchItems });
  const orderStatus = paymentOrderStatus(batchItems);
  const paymentTypeLabel = batch.paymentAttemptNumber > 1 ? '二次付款' : '首次付款';
  const sourcePaymentOrderCode = batch.sourcePaymentOrderCode
    ?? (batchItems[0] ? paymentBatchItemSourceOrderCode(batchItems[0]) : undefined);
  const failureDialogItem = batchItems.find((item) => item.payoutId === failureDialogPayoutId);
  const selectedDetailItem = batchItems.find((item) => item.payoutId === selectedDetailItemId);
  const selectedDetailCreator = selectedDetailItem
    ? creators.find((candidate) => candidate.id === selectedDetailItem.creatorId)
    : undefined;

  const currentAttemptPayout = (item: PaymentBatchItemSnapshot) => payouts.find((payout) => (
    payout.id === item.payoutId
    && (
      payout.currentPaymentAttempt?.paymentBatchId === batch.paymentBatchId
      || payout.paymentFailureRecovery?.retryBatchId === batch.paymentBatchId
    )
  ));

  const closeDetailDrawer = useCallback(() => {
    setSelectedDetailItemId(null);
    window.requestAnimationFrame(() => detailTriggerRef.current?.focus());
  }, []);
  const closeFailureDialog = () => {
    setFailureDialogPayoutId(null);
    window.requestAnimationFrame(() => detailTriggerRef.current?.focus());
  };

  const downloadProjectWorkbook = async () => {
    if (!batchItems.length || downloadingResource) return;
    setDownloadingResource('workbook');
    setResourceError('');
    try {
      downloadBlob(
        await createPaymentBatchWorkbook([{ batch, currentRequestStatus }]),
        paymentBatchDetailWorkbookFilename(batch.paymentBatchCode),
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
    <div className="page-stack payment-batch-detail-page payment-project-payment-detail-page payment-batch-payment-detail-page">
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
          <strong>{actualPaidTotal}</strong>
          <small>{batch.items.length} 笔付款</small>
        </div>
      </header>

      <section className="payment-batch-detail-summary payment-project-summary-grid" aria-label="批次摘要">
        <div className="payment-project-summary-card is-order">
          <div>
            <span>付款类型</span>
            <strong>{paymentTypeLabel}</strong>
            <small>{batch.paymentAttemptNumber > 1 ? `关联原付款单 ${sourcePaymentOrderCode ?? '未记录'}` : `${batch.items.length} 笔付款明细`}</small>
          </div>
        </div>
        <div className="payment-project-summary-card is-updated">
          <div><span>付款人 / 时间</span><strong>{batch.payer}</strong><small>{displayTime(batch.paidAt)}</small></div>
        </div>
        <div className="payment-project-summary-card is-provider">
          <div><span>付款渠道</span><strong>{paymentProviderDisplayName(batch.provider)}</strong><small>{fundingAccountLabel(batch.fundingAccountId)}</small></div>
        </div>
        <div className="payment-project-summary-card is-result">
          <div><span>支付币种</span><strong>{batch.sourceCurrency}</strong><small>实际付款金额 {actualPaidTotal}</small></div>
        </div>
      </section>

      <section className="payment-batch-detail-section payment-batch-lifecycle-section">
        <header><div><h2>渠道处理进度</h2><p>付款明细提交、平台处理与最终付款结果。</p></div></header>
        <PaymentProgressSteps ariaLabel="渠道处理进度" status={batch.status} />
      </section>

      <section className="payment-batch-orders-section" aria-label="付款单与付款明细">
        {batchItems.length ? (
          <div className="payment-batch-order-list">
              <article className="payment-batch-order-card" aria-labelledby="payment-batch-order-title">
                <header className="payment-batch-order-header payment-batch-order-summary-card">
                  <div className="payment-batch-order-identity">
                    <span aria-hidden="true"><WalletCards size={20} /></span>
                    <div>
                      <small>付款单</small>
                      <h2 id="payment-batch-order-title">{batch.paymentOrderCode}</h2>
                      <p>{paymentTypeLabel}</p>
                      {batch.paymentAttemptNumber > 1 ? <p>关联原付款单 {sourcePaymentOrderCode ?? '未记录'}</p> : null}
                      <p>关联请款项目 {batch.request.requestCode}</p>
                    </div>
                  </div>
                  <div className="payment-batch-order-result">
                    <span className={`simple-status ${paymentStatusTone(orderStatus)}`}><i />{orderStatus}</span>
                    <strong>{actualPaidTotal}</strong>
                    <small>{orderCounts.succeeded} 成功 · {orderCounts.failed} 失败 · {orderCounts.processing} 处理中</small>
                  </div>
                </header>

                <section className="payment-batch-order-items payment-batch-order-items-card" aria-label={`${batch.paymentOrderCode} 付款明细`}>
                  <header>
                    <div className="payment-batch-order-items-heading">
                      <span aria-hidden="true"><ListChecks size={17} /></span>
                      <div><h3>付款明细</h3><p>查看本次付款的账户快照、费用和渠道结果。</p></div>
                    </div>
                    <div className="payment-batch-order-items-tools" aria-label="付款明细工具">
                      <Button
                        variant="secondary"
                        icon={downloadingResource === 'workbook' ? <LoaderCircle className="is-spinning" size={15} /> : <FileSpreadsheet size={15} />}
                        disabled={!batchItems.length || downloadingResource !== null}
                        disabledReason={downloadingResource ? '文件正在导出，请稍候。' : '当前没有可导出的付款明细。'}
                        onClick={downloadProjectWorkbook}
                      >
                        {downloadingResource === 'workbook' ? '正在生成' : '下载付款明细表'}
                      </Button>
                      <span className="payment-batch-order-items-count"><strong>{batchItems.length}</strong> 笔</span>
                    </div>
                  </header>
                  {resourceError ? <p className="payment-project-resource-error" role="alert">{resourceError}</p> : null}
                  <div className="payment-batch-order-table-scroll" role="region" aria-label={`${batch.paymentOrderCode} 付款明细表，可横向滚动`} tabIndex={0}>
                    <table className="data-table payment-batch-order-table">
                      <thead>
                        <tr>
                          <th className="payment-batch-col-creator" scope="col">达人</th>
                          <th className="payment-batch-col-project" scope="col">关联项目</th>
                          <th className="payment-batch-col-provider" scope="col">付款渠道</th>
                          <th className="payment-batch-col-account" scope="col">收款银行账号</th>
                          <th className="payment-batch-col-date" scope="col">付款日期</th>
                          <th className="payment-batch-col-amount" scope="col">付款金额</th>
                          <th className="payment-batch-col-fee" scope="col">手续费</th>
                          <th className="payment-batch-col-actual" scope="col">实际付款金额</th>
                          <th className="payment-batch-col-attempt" scope="col">付款类型</th>
                          <th className="payment-batch-col-status" scope="col">付款状态</th>
                          <th className="action-cell payment-batch-col-actions" scope="col">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                      {batchItems.map((item) => {
                        const creator = creators.find((candidate) => candidate.id === item.creatorId);
                        const creatorIdentity = paymentCreatorIdentityFromBatchItem(item, creator);
                        const confirmationDisabledReason = item.provider !== 'Airwallex'
                          ? '当前付款渠道不支持付款确认函。'
                          : item.paymentStatus !== '已付款' || !item.paidAt
                            ? '仅已付款且已记录付款日期的明细可以下载确认函。'
                            : undefined;
                        return (
                          <tr key={item.payoutId}>
                              <td className="payment-batch-col-creator payment-batch-table-creator-cell">
                                <PaymentCreatorIdentity {...creatorIdentity} className="payment-batch-table-creator-identity" />
                              </td>
                              <td className="payment-batch-col-project">
                                <span className="payment-batch-table-project-cell"><strong title={batch.request.cooperationProjectName}>{batch.request.cooperationProjectName}</strong><small title={batch.request.cooperationProjectCode}>{batch.request.cooperationProjectCode}</small></span>
                              </td>
                              <td className="payment-batch-col-provider"><span className="payment-batch-table-provider"><PaymentProviderBadge compact provider={item.provider} /><small title={item.transferMethod}>{item.transferMethod}</small></span></td>
                              <td className="payment-batch-col-account">
                                <span className="payment-batch-table-account-cell"><strong title={item.accountIdentifier || item.accountSummary}>{item.accountIdentifier || item.accountSummary}</strong><small title={item.accountIdentifierLabel || '收款账户快照'}>{item.accountIdentifierLabel || '收款账户快照'}</small></span>
                              </td>
                              <td className="payment-batch-col-date payment-batch-table-date-cell">{paymentDateLabel(item.paidAt)}</td>
                              <td className="payment-batch-col-amount payment-batch-table-money-cell"><strong>{money(item.currency, item.amount)}</strong></td>
                              <td className="payment-batch-col-fee payment-batch-table-money-cell">{paymentFeeLabel(item)}</td>
                              <td className="payment-batch-col-actual payment-batch-table-money-cell"><strong>{paymentResultValue(item, item.actualPaidAmount, item.actualPaidCurrency)}</strong></td>
                              <td className="payment-batch-col-attempt"><span className={`payment-batch-attempt-badge${paymentBatchItemAttemptNumber(item) > 1 ? ' is-retry' : ''}`}>{paymentBatchItemAttemptLabel(item)}</span></td>
                              <td className="payment-batch-col-status"><span className={`simple-status ${paymentStatusTone(item.paymentStatus)}`}><i />{item.paymentStatus}</span></td>
                              <td className="action-cell payment-batch-col-actions payment-batch-table-action-cell">
                                <div className="payment-batch-table-actions">
                                  <ListActionButton
                                    ref={(node) => {
                                      if (selectedDetailItemId === item.payoutId) detailTriggerRef.current = node;
                                    }}
                                    kind="view"
                                    aria-label={`查看 ${item.creatorName} 的付款详情`}
                                    onClick={(event) => {
                                      detailTriggerRef.current = event.currentTarget;
                                      setSelectedDetailItemId(item.payoutId);
                                    }}
                                  >
                                    查看详情
                                  </ListActionButton>
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
                                </div>
                              </td>
                          </tr>
                        );
                      })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </article>
          </div>
        ) : (
            <div className="payment-batch-detail-empty-state" role="status">
              <ReceiptText size={22} aria-hidden="true" />
              <strong>该批次暂无付款明细</strong>
              <span>批次记录存在，但没有可展示的付款项快照。</span>
            </div>
        )}
      </section>

      {failureDialogPayoutId && failureDialogItem && onReturnPayout ? (
        <PaymentFailureReturnDialog
          key={failureDialogPayoutId}
          item={failureDialogItem}
          onClose={closeFailureDialog}
          onSubmit={(issueType, reason) => {
            const payout = currentAttemptPayout(failureDialogItem);
            return payout ? onReturnPayout(payout, issueType, reason) : false;
          }}
        />
      ) : null}
      {selectedDetailItem ? (
        <PaymentBatchItemDrawer
          batch={batch}
          canHandleFailure={canHandleFailure}
          creator={selectedDetailCreator}
          item={selectedDetailItem}
          payout={currentAttemptPayout(selectedDetailItem)}
          onClose={closeDetailDrawer}
          onOpenFailurePaymentList={onOpenFailurePaymentList
            ? () => onOpenFailurePaymentList(batch.request.paymentRequestProjectId, selectedDetailItem.payoutId)
            : undefined}
          onRequestFailureReturn={onReturnPayout
            ? () => {
                setSelectedDetailItemId(null);
                setFailureDialogPayoutId(selectedDetailItem.payoutId);
              }
            : undefined}
        />
      ) : null}
    </div>
  );
}
