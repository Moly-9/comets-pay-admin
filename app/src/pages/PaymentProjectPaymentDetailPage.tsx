import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  ReceiptText,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Button, Modal, SelectField } from '../components/Common';
import {
  paymentBatchAmountLabel,
  paymentBatchStatusCounts,
  type PaymentBatchItemSnapshot,
  type PaymentProjectPaymentRecord,
} from '../paymentBatches';
import type { PaymentFailureIssueType, Payout } from '../types';
import { PaymentItemDetails } from './PaymentBatchDetailPage';

const PAYMENT_PROGRESS_STEPS = ['已付款', '平台处理中', '已完成'] as const;

const displayTime = (value?: string) => value
  ? value.replace('T', ' ').replace(/\.\d{3}Z$/, '')
  : '未记录';

const money = (currency: string, amount: number) => `${currency} ${amount.toLocaleString('en-US')}`;

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

const projectStatusTone = (status: PaymentProjectPaymentRecord['status']) => {
  if (status === '部分失败' || status === '已退回') return 'is-danger';
  if (status === '付款处理中') return 'is-processing';
  return 'is-success';
};

const contractSummary = (item: PaymentBatchItemSnapshot) => (
  item.contracts.length
    ? item.contracts.map((contract) => contract.contractCode).join('、')
    : item.legacyContractReference || '未关联'
);

const initialExpandedItemId = (record: PaymentProjectPaymentRecord) => (
  record.items.find((item) => item.paymentStatus === '付款失败')?.payoutId ?? null
);

export function PaymentProjectPaymentDetailPage({
  record,
  payouts,
  canHandleFailure,
  onBack,
  onReturnPayout,
  onOpenFailurePaymentList,
}: {
  record: PaymentProjectPaymentRecord;
  payouts: readonly Payout[];
  canHandleFailure: boolean;
  onBack: () => void;
  onReturnPayout: (payout: Payout, issueType: PaymentFailureIssueType, reason: string) => boolean;
  onOpenFailurePaymentList?: (requestId: string, payoutId: string) => void;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(() => initialExpandedItemId(record));
  const [failureDialogPayoutId, setFailureDialogPayoutId] = useState<string | null>(null);
  const [issueType, setIssueType] = useState<PaymentFailureIssueType | ''>('');
  const [returnReason, setReturnReason] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const totals = paymentBatchAmountLabel(record);
  const statusCounts = paymentBatchStatusCounts(record);
  const failedItems = useMemo(
    () => record.items.filter((item) => item.paymentStatus === '付款失败'),
    [record.items],
  );
  const dialogItem = record.items.find((item) => item.payoutId === failureDialogPayoutId);
  const normalizedReturnReason = returnReason.trim();

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (expandedItemId && record.items.some((item) => item.payoutId === expandedItemId)) return;
    setExpandedItemId(initialExpandedItemId(record));
  }, [expandedItemId, record]);

  const openFailureDialog = (payoutId: string) => {
    setFailureDialogPayoutId(payoutId);
    setIssueType('');
    setReturnReason('');
  };

  const closeFailureDialog = () => {
    setFailureDialogPayoutId(null);
    setIssueType('');
    setReturnReason('');
  };

  const submitFailureReturn = () => {
    const payout = payouts.find((candidate) => candidate.id === failureDialogPayoutId);
    if (!payout || !issueType || !normalizedReturnReason) return;
    if (onReturnPayout(payout, issueType, normalizedReturnReason)) closeFailureDialog();
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
          <span>请款项目付款</span>
          <h1 ref={titleRef} tabIndex={-1}>{record.request.requestCode}</h1>
          <p>{record.request.cooperationProjectCode} · {record.request.cooperationProjectName}</p>
        </div>
        <div className="payment-batch-detail-total">
          <span className={`simple-status ${projectStatusTone(record.status)}`}><i />{record.status}</span>
          <strong>{totals}</strong>
          <small>{record.items.length} 笔付款明细</small>
        </div>
      </header>

      <section className="payment-batch-detail-summary" aria-label="项目付款摘要">
        <div>
          <span>付款单</span>
          <strong>{record.paymentOrderCodes.join('、') || '未关联'}</strong>
          <small>{record.paymentOrderCodes.length} 份付款清单</small>
        </div>
        <div>
          <span>付款渠道</span>
          <strong>{record.providers.join('、') || '待确认'}</strong>
          <small>{record.providers.length} 个执行渠道</small>
        </div>
        <div>
          <span>处理结果</span>
          <strong>{statusCounts.succeeded} 成功 · {statusCounts.failed} 失败</strong>
          <small>{statusCounts.processing} 笔处理中</small>
        </div>
        <div>
          <span>最近更新</span>
          <strong>{displayTime(record.lastActivityAt)}</strong>
          <small>以渠道回写时间为准</small>
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
        <ol aria-label="项目付款进度">
          {PAYMENT_PROGRESS_STEPS.map((step, index) => {
            const state = record.status === '已付款'
              ? 'complete'
              : (record.status === '部分失败' || record.status === '已退回') && index < 2
                ? 'complete'
                : (record.status === '部分失败' || record.status === '已退回') && index === 2
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
                <small>{state === 'complete' ? '已完成' : state === 'current' ? '当前阶段' : state === 'failed' ? record.status : '待处理'}</small>
                {index < PAYMENT_PROGRESS_STEPS.length - 1 ? <i aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="payment-batch-detail-section">
        <header>
          <div><h2>请款项目 / 所属项目</h2><p>本页面仅展示当前请款项目，不混入同批次的其他项目。</p></div>
          <span className="simple-status"><i />{record.request.requestStatus}</span>
        </header>
        <div className="payment-batch-project-heading">
          <span aria-hidden="true"><Building2 size={20} /></span>
          <div><span className="payment-batch-project-name">{record.request.cooperationProjectName}</span><small>{record.request.cooperationProjectCode}</small></div>
        </div>
        <dl className="payment-batch-project-grid">
          <div><dt>请款编号</dt><dd>{record.request.requestCode}</dd></div>
          <div><dt>请款金额</dt><dd>{record.request.amount}</dd></div>
          <div><dt>品牌 / 客户</dt><dd>{record.request.brand}</dd></div>
          <div><dt>项目媒介</dt><dd>{record.request.media}</dd></div>
          <div><dt>负责 PM</dt><dd>{record.request.pm}</dd></div>
          <div><dt>预计付款时间</dt><dd>{record.request.expectedPaymentDate}</dd></div>
          <div className="payment-batch-project-full"><dt>请款原因</dt><dd>{record.request.reason}</dd></div>
        </dl>
      </section>

      <section className="payment-batch-detail-section payment-batch-items-section">
        <header>
          <div><h2>付款明细</h2><p>查看当前项目每笔付款的合同、Invoice、账户快照和渠道结果。</p></div>
          <span>{record.items.length} 笔</span>
        </header>
        <div className="payment-batch-item-list">
          <div className="payment-batch-item-table-head" aria-hidden="true">
            <span>达人</span><span>付款渠道</span><span>Invoice</span><span>合同</span>
            <span>付款清单</span><span>付款金额</span><span>付款状态</span><span />
          </div>
          <div className="payment-batch-item-rows" role="list">
            {record.items.map((item) => {
              const expanded = expandedItemId === item.payoutId;
              const livePayout = payouts.find((payout) => payout.id === item.payoutId);
              const itemDomId = `payment-project-item-${item.payoutId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
              const detailId = `${itemDomId}-details`;
              return (
                <article id={itemDomId} className={expanded ? 'payment-batch-item is-expanded' : 'payment-batch-item'} key={item.payoutId} role="listitem">
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
                      <PaymentItemDetails item={item} payout={livePayout} onOpenFailurePaymentList={onOpenFailurePaymentList ? () => onOpenFailurePaymentList(record.request.paymentRequestProjectId, item.payoutId) : undefined} />
                      {item.paymentStatus === '付款失败' && !livePayout?.paymentFailureReturn ? (
                        <div className="payment-project-failure-action">
                          <div>
                            <strong>该笔付款需要财务判断问题类型</strong>
                            <span>退回后不能直接重试，媒介需从对应资料节点重新提交。</span>
                          </div>
                          <Button
                            variant="danger"
                            icon={<RotateCcw size={16} />}
                            disabled={!canHandleFailure}
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
        <Modal
          title="付款失败退回媒介"
          width="520px"
          onClose={closeFailureDialog}
          footer={(
            <>
              <Button variant="ghost" onClick={closeFailureDialog}>取消</Button>
              <Button
                variant="danger"
                disabled={!normalizedReturnReason || !issueType}
                onClick={submitFailureReturn}
              >
                确认退回
              </Button>
            </>
          )}
        >
          <div className="return-review-dialog">
            <div className="return-review-summary">
              <span><CircleAlert size={19} /></span>
              <div>
                <strong>请选择问题类型并填写退回原因</strong>
                <p>{dialogItem.creatorName} · {dialogItem.invoice?.invoiceNumber ?? dialogItem.legacyInvoiceReference ?? '未关联 Invoice'} · {money(dialogItem.currency, dialogItem.amount)}</p>
              </div>
            </div>
            <label className="return-review-field">
              <span>问题类型 <em className="required-mark" aria-hidden="true">*</em></span>
              <SelectField<PaymentFailureIssueType | ''>
                ariaLabel="付款失败问题类型"
                value={issueType}
                placeholder="请选择问题类型"
                variant="form"
                menuStrategy="fixed"
                options={[
                  { value: 'INVOICE_CONTENT', label: 'Invoice 内容问题', description: '修改 Invoice 并重新签署' },
                  { value: 'PAYMENT_LIST', label: '付款清单问题', description: '仅恢复失败达人的收款账户' },
                ]}
                onChange={setIssueType}
              />
              <small>必须由财务人工判断，系统不会根据渠道错误文本自动分类。</small>
            </label>
            <label className="return-review-field">
              <span>退回原因 <em className="required-mark" aria-hidden="true">*</em><small>{returnReason.length}/300</small></span>
              <textarea
                autoFocus
                maxLength={300}
                aria-label="退回原因"
                placeholder="请说明失败原因和媒介需要处理的内容"
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
              />
              <small>原因、操作人和退回时间会记录在该笔付款详情中。</small>
            </label>
            <div className="return-review-warning"><AlertTriangle size={17} /><span>{
              issueType === 'INVOICE_CONTENT'
                ? '确认后需修改 Invoice，并从达人签署节点重新开始。'
                : issueType === 'PAYMENT_LIST'
                  ? '确认后仅该失败款进入账户恢复流程；成功款和审批结果保持不变。'
                  : '确认后将按所选资料节点进入对应处理流程。'
            }</span></div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
