import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileText,
  ReceiptText,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  paymentBatchAmountLabel,
  paymentBatchStatusCounts,
  type PaymentBatchItemSnapshot,
  type PaymentBatchRecord,
} from '../paymentBatches';

const displayTime = (value?: string) => value ? value.replace('T', ' ') : '未记录';

const fundingAccountLabel = (value: string) => {
  if (value === 'mock-awx-operating') return 'Airwallex 运营资金账户';
  if (value === 'mock-awx-reserve') return 'Airwallex 备用资金账户';
  if (value === 'mock-paypal-balance') return 'PayPal Business Balance';
  return value || '未记录';
};

const lifecycleLabel = (value: string) => ({
  CREATED: '已创建',
  ITEMS_ADDED: '已加入付款项',
  QUOTED: '已询价',
  SUBMITTED: '已提交渠道',
  COMPLETED: '已完成',
  PARTIALLY_FAILED: '部分失败',
}[value] ?? value);

const money = (currency: string, amount: number | null) => (
  amount === null ? '未记录' : `${currency} ${amount.toLocaleString('en-US')}`
);

const contractSummary = (item: PaymentBatchItemSnapshot) => {
  if (item.contracts.length) return item.contracts.map((contract) => contract.contractCode).join('、');
  return item.legacyContractReference || '未关联';
};

export function PaymentItemDetails({ item }: { item: PaymentBatchItemSnapshot }) {
  return (
    <div className="payment-batch-item-details">
      <section aria-labelledby={`${item.payoutId}-contract-title`}>
        <header>
          <FileText size={17} aria-hidden="true" />
          <h3 id={`${item.payoutId}-contract-title`}>合同</h3>
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

      <section aria-labelledby={`${item.payoutId}-invoice-title`}>
        <header>
          <ReceiptText size={17} aria-hidden="true" />
          <h3 id={`${item.payoutId}-invoice-title`}>Invoice</h3>
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

      <section aria-labelledby={`${item.payoutId}-payment-title`}>
        <header>
          <WalletCards size={17} aria-hidden="true" />
          <h3 id={`${item.payoutId}-payment-title`}>付款信息</h3>
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
  onBack,
}: {
  batch: PaymentBatchRecord;
  onBack: () => void;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const totals = paymentBatchAmountLabel(batch);
  const statusCounts = paymentBatchStatusCounts(batch);

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
          <span className="simple-status"><i />{batch.status}</span>
          <strong>{totals}</strong>
          <small>{batch.items.length} 笔付款</small>
        </div>
      </header>

      <section className="payment-batch-detail-summary" aria-label="批次摘要">
        <div><span>付款渠道</span><strong>{batch.provider}</strong><small>{fundingAccountLabel(batch.fundingAccountId)}</small></div>
        <div><span>付款人 / 时间</span><strong>{batch.payer}</strong><small>{displayTime(batch.paidAt)}</small></div>
        <div><span>处理结果</span><strong>{statusCounts.succeeded} 成功 · {statusCounts.failed} 失败</strong><small>{statusCounts.processing} 笔处理中</small></div>
        <div><span>资金源币种</span><strong>{batch.sourceCurrency}</strong><small>{batch.paymentBatchId}</small></div>
      </section>

      <section className="payment-batch-detail-section payment-batch-lifecycle-section">
        <header><div><h2>渠道处理进度</h2><p>批次创建、询价、提交与结果回写。</p></div></header>
        <ol>
          {batch.lifecycle.map((step, index) => (
            <li key={`${step}-${index}`}>
              <span>
                {step === 'PARTIALLY_FAILED'
                  ? <CircleAlert size={14} />
                  : index < batch.lifecycle.length - 1 || step === 'COMPLETED'
                    ? <Check size={14} />
                    : <Clock3 size={14} />}
              </span>
              <strong>{lifecycleLabel(step)}</strong>
              {index < batch.lifecycle.length - 1 ? <i /> : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="payment-batch-detail-section">
        <header>
          <div><h2>请款项目 / 所属项目</h2><p>本批次只关联一个请款项目。</p></div>
          <span className="simple-status"><i />{batch.request.requestStatus}</span>
        </header>
        <div className="payment-batch-project-heading">
          <span aria-hidden="true"><Building2 size={20} /></span>
          <div><strong>{batch.request.cooperationProjectName}</strong><small>{batch.request.cooperationProjectCode}</small></div>
        </div>
        <dl className="payment-batch-project-grid">
          <div><dt>请款编号</dt><dd>{batch.request.requestCode}</dd></div>
          <div><dt>请款金额</dt><dd>{batch.request.amount}</dd></div>
          <div><dt>品牌 / 客户</dt><dd>{batch.request.brand}</dd></div>
          <div><dt>项目媒介</dt><dd>{batch.request.media}</dd></div>
          <div><dt>负责 PM</dt><dd>{batch.request.pm}</dd></div>
          <div><dt>预计付款时间</dt><dd>{batch.request.expectedPaymentDate}</dd></div>
          <div className="payment-batch-project-full"><dt>请款原因</dt><dd>{batch.request.reason}</dd></div>
        </dl>
      </section>

      <section className="payment-batch-detail-section payment-batch-items-section">
        <header><div><h2>付款明细</h2><p>按付款项查看合同、Invoice、账户快照和渠道结果。</p></div><span>{batch.items.length} 笔</span></header>
        <div className="payment-batch-item-list" role="list">
          {batch.items.map((item) => {
            const expanded = expandedItemId === item.payoutId;
            const detailId = `payment-batch-item-${item.payoutId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            return (
              <article className={expanded ? 'payment-batch-item is-expanded' : 'payment-batch-item'} key={item.payoutId} role="listitem">
                <button
                  className="payment-batch-item-trigger"
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={detailId}
                  onClick={() => setExpandedItemId(expanded ? null : item.payoutId)}
                >
                  <span className="payment-batch-item-person"><UserRound size={17} aria-hidden="true" /><span><strong>{item.creatorName}</strong><small>{item.creatorHandle}</small></span></span>
                  <span><small>Invoice</small><strong>{item.invoice?.invoiceNumber ?? item.legacyInvoiceReference ?? '未关联'}</strong></span>
                  <span><small>合同</small><strong>{contractSummary(item)}</strong></span>
                  <span><small>付款清单</small><strong>{item.paymentListCode}</strong></span>
                  <span><small>金额</small><strong>{money(item.currency, item.amount)}</strong></span>
                  <span><small>渠道 / 方式</small><strong>{item.provider} · {item.transferMethod}</strong></span>
                  <span className="payment-batch-item-status"><small>状态</small><strong><i />{item.paymentStatus}</strong></span>
                  <ChevronDown size={17} aria-hidden="true" />
                </button>
                {expanded ? <div id={detailId}><PaymentItemDetails item={item} /></div> : null}
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
      </section>
    </div>
  );
}
