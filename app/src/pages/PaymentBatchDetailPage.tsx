import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileText,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Button } from '../components/Common';
import { PaymentFailureReturnDialog } from '../components/PaymentFailureReturnDialog';
import {
  paymentBatchAmountLabel,
  paymentBatchStatusCounts,
  type PaymentBatchItemSnapshot,
  type PaymentBatchRecord,
} from '../paymentBatches';
import { paymentFailureRecoveryLabel } from '../paymentFailureRecovery';
import type { PaymentFailureIssueType, Payout } from '../types';

const displayTime = (value?: string) => value ? value.replace('T', ' ') : '未记录';

const fundingAccountLabel = (value: string) => {
  if (value === 'mock-awx-operating') return 'Airwallex 运营资金账户';
  if (value === 'mock-awx-reserve') return 'Airwallex 备用资金账户';
  if (value === 'mock-paypal-balance') return 'PayPal Business Balance';
  if (value === 'mock-paymax-operating') return 'PayMax 运营资金账户';
  return value || '未记录';
};

const PAYMENT_PROGRESS_STEPS = ['已付款', '平台处理中', '已完成'] as const;

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
  if (status === '部分失败') return 'is-danger';
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

export function PaymentItemDetails({
  item,
  payout,
  onOpenFailurePaymentList,
}: {
  item: PaymentBatchItemSnapshot;
  payout?: Payout;
  onOpenFailurePaymentList?: () => void;
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
          <span className="payment-batch-detail-panel-badge">{item.contracts.length} 份</span>
        </header>
        {item.contracts.length ? (
          <div className="payment-batch-document-list">
            {item.contracts.map((contract) => (
              <dl key={contract.contractId}>
                <div><dt>合同编号</dt><dd>{contract.contractCode}</dd></div>
                <div><dt>合同名称</dt><dd>{contract.name}</dd></div>
                <div><dt>合同金额</dt><dd>{money(contract.currency, contract.amount)}</dd></div>
                <div><dt>签署 / 状态</dt><dd>{contract.signed ? '已签署' : '待签署'} · {contract.status}</dd></div>
                <div><dt>更新时间</dt><dd>{contract.updatedAt}</dd></div>
              </dl>
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
            <small>付款凭证与审核结果</small>
          </div>
          <span className="payment-batch-detail-panel-badge">{item.invoice ? `V${item.invoice.version}` : '未关联'}</span>
        </header>
        {item.invoice ? (
          <dl>
            <div><dt>Invoice 号</dt><dd>{item.invoice.invoiceNumber}</dd></div>
            <div><dt>Invoice 日期</dt><dd>{item.invoice.invoiceDate}</dd></div>
            <div><dt>Invoice 金额</dt><dd>{money(item.invoice.currency, item.invoice.amount)}</dd></div>
            <div><dt>版本 / 状态</dt><dd>V{item.invoice.version} · {item.invoice.reviewStatus}</dd></div>
            <div><dt>资料校验</dt><dd>{item.invoice.validationStatus === 'valid' ? '已通过' : '需要复核'}</dd></div>
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
          <div><dt>付款记录 ID</dt><dd>{item.payoutId}</dd></div>
          <div><dt>付款清单</dt><dd>{item.paymentListCode}{item.paymentListVersion ? ` · V${item.paymentListVersion}` : ''}</dd></div>
          <div><dt>付款渠道 / 方式</dt><dd>{item.provider} · {item.transferMethod}</dd></div>
          <div><dt>支付 / 收款币种</dt><dd>{item.currency} / {item.receiveCurrency}</dd></div>
          <div><dt>收款账户</dt><dd>{item.accountSummary}</dd></div>
          <div><dt>账户版本</dt><dd>{item.payoutAccountVersion}</dd></div>
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
  canHandleFailure = false,
  onBack,
  onReturnPayout,
  onOpenFailurePaymentList,
}: {
  batch: PaymentBatchRecord;
  payouts?: readonly Payout[];
  canHandleFailure?: boolean;
  onBack: () => void;
  onReturnPayout?: (payout: Payout, issueType: PaymentFailureIssueType, reason: string) => boolean;
  onOpenFailurePaymentList?: (requestId: string, payoutId: string) => void;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(() => (
    batch.items.find((item) => item.paymentStatus === '付款失败')?.payoutId ?? null
  ));
  const [failureDialogPayoutId, setFailureDialogPayoutId] = useState<string | null>(null);
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
  const statusCounts = paymentBatchStatusCounts({ items: liveItems });
  const completed = liveStatus === '已付款';
  const paymentInformationStatus = liveStatus === '部分失败' ? '部分打款失败' : liveStatus;
  const failureDialogItem = liveItems.find((item) => item.payoutId === failureDialogPayoutId);

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
          <p>{batch.request.requestCode} · {batch.request.cooperationProjectName}</p>
        </div>
        <div className="payment-batch-detail-total">
          <span className={`simple-status ${batchStatusTone(liveStatus)}`}><i />{liveStatus}</span>
          <strong>{totals}</strong>
          <small>{batch.items.length} 笔付款</small>
        </div>
      </header>

      <section className="payment-batch-detail-summary" aria-label="批次摘要">
        <div><span>付款渠道</span><strong>{batch.provider}</strong><small>{fundingAccountLabel(batch.fundingAccountId)}</small></div>
        <div><span>付款人 / 时间</span><strong>{batch.payer}</strong><small>{displayTime(batch.paidAt)}</small></div>
        <div><span>处理结果</span><strong>{statusCounts.succeeded} 成功 · {statusCounts.failed} 失败</strong><small>{statusCounts.processing} 笔处理中</small></div>
        <div><span>资金源币种</span><strong>{batch.sourceCurrency}</strong></div>
      </section>

      <section className="payment-batch-detail-section payment-batch-lifecycle-section">
        <header><div><h2>渠道处理进度</h2><p>付款发起、平台处理与最终结果回写。</p></div></header>
        <ol aria-label="渠道处理进度">
          {PAYMENT_PROGRESS_STEPS.map((step, index) => {
            const state = completed || liveStatus === '部分失败' && index < 2
              ? 'complete'
              : liveStatus === '部分失败' && index === 2
                ? 'failed'
                : index === 0
                  ? 'complete'
                  : index === 1
                    ? 'current'
                    : 'pending';
            return (
              <li className={`is-${state}`} key={step} aria-current={state === 'current' || state === 'failed' ? 'step' : undefined}>
                <span aria-hidden="true">
                  {state === 'complete'
                    ? <Check size={14} />
                    : state === 'current'
                      ? <Clock3 size={14} />
                      : state === 'failed'
                        ? <CircleAlert size={14} />
                        : index + 1}
                </span>
                <strong>{step}</strong>
                <small>{state === 'complete' ? '已完成' : state === 'current' ? '当前阶段' : state === 'failed' ? '部分失败' : '待处理'}</small>
                {index < PAYMENT_PROGRESS_STEPS.length - 1 ? <i aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="payment-batch-detail-section">
        <header>
          <div><h2>付款信息</h2><p>本批次只关联一个请款项目。</p></div>
          <span className="simple-status"><i />{paymentInformationStatus}</span>
        </header>
        <div className="payment-batch-project-heading">
          <span aria-hidden="true"><Building2 size={20} /></span>
          <div><span className="payment-batch-project-name">{batch.request.cooperationProjectName}</span><small>{batch.request.cooperationProjectCode}</small></div>
        </div>
        <dl className="payment-batch-project-grid">
          <div><dt>付款项目编号</dt><dd>{batch.request.requestCode}</dd></div>
          <div><dt>付款金额</dt><dd>{batch.request.amount}</dd></div>
          <div><dt>品牌 / 客户</dt><dd>{batch.request.brand}</dd></div>
          <div><dt>项目媒介</dt><dd>{batch.request.media}</dd></div>
          <div><dt>负责 PM</dt><dd>{batch.request.pm}</dd></div>
          <div><dt>预计付款时间</dt><dd>{batch.request.expectedPaymentDate}</dd></div>
          <div className="payment-batch-project-full"><dt>请款原因</dt><dd>{batch.request.reason}</dd></div>
        </dl>
      </section>

      <section className="payment-batch-detail-section payment-batch-items-section">
        <header><div><h2>付款明细</h2><p>按付款项查看合同、Invoice、账户快照和渠道结果。</p></div><span>{batch.items.length} 笔</span></header>
        <div className="payment-batch-item-list">
          {batch.items.length ? (
            <div className="payment-batch-item-table-head" aria-hidden="true">
              <span>达人</span>
              <span>付款渠道</span>
              <span>Invoice</span>
              <span>合同</span>
              <span>付款清单</span>
              <span>付款金额</span>
              <span>付款状态</span>
              <span />
            </div>
          ) : null}
          <div className="payment-batch-item-rows" role="list">
            {liveItems.map((item) => {
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
                      <span><strong>{item.creatorName}</strong><small>{item.creatorHandle}</small></span>
                    </span>
                    <span data-label="付款渠道"><strong>{item.provider}</strong><small>{item.transferMethod}</small></span>
                    <span data-label="Invoice" title={item.invoice?.invoiceNumber ?? item.legacyInvoiceReference ?? '未关联'}><strong>{item.invoice?.invoiceNumber ?? item.legacyInvoiceReference ?? '未关联'}</strong></span>
                    <span data-label="合同" title={contractSummary(item)}><strong>{contractSummary(item)}</strong></span>
                    <span data-label="付款清单" title={item.paymentListCode}><strong>{item.paymentListCode}</strong></span>
                    <span className="payment-batch-item-amount" data-label="付款金额"><strong>{money(item.currency, item.amount)}</strong></span>
                    <span className={`payment-batch-item-status ${paymentStatusTone(item.paymentStatus)}`} data-label="付款状态"><strong><i />{item.paymentStatus}</strong></span>
                    <span className="payment-batch-item-expand-icon" aria-hidden="true"><ChevronDown size={17} /></span>
                  </button>
                  {expanded ? (
                    <div id={detailId}>
                      <PaymentItemDetails item={item} payout={livePayout} onOpenFailurePaymentList={onOpenFailurePaymentList ? () => onOpenFailurePaymentList(batch.request.paymentRequestProjectId, item.payoutId) : undefined} />
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
            {!batch.items.length ? (
              <div className="payment-batch-detail-empty-state" role="status">
                <ReceiptText size={22} aria-hidden="true" />
                <strong>该批次暂无付款明细</strong>
                <span>批次记录存在，但没有可展示的付款项快照。</span>
              </div>
            ) : null}
          </div>
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
    </div>
  );
}
