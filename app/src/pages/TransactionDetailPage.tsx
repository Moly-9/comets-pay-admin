import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  FileSpreadsheet,
  FileText,
  Layers3,
  ReceiptText,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Avatar, StatusMark } from '../components/Common';
import { PaymentProviderBadge } from '../components/PaymentProviderBadge';
import { formatAmount } from '../data';
import type { TransactionBatchContext } from '../transactionRecords';
import { transactionOccurredAt } from '../transactionRecords';
import type { Payout } from '../types';

const displayTime = (value?: string) => {
  if (!value) return '未记录';
  return value.replace('T', ' ').replace(/\.000Z$/, '').replace(/Z$/, '');
};

const money = (currency: string, amount: number | null) => (
  amount === null ? '未记录' : `${currency} ${amount.toLocaleString('en-US')}`
);

export function TransactionDetailPage({
  payout,
  context,
  onBack,
}: {
  payout: Payout;
  context: TransactionBatchContext | null;
  onBack: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const batch = context?.batch;
  const item = context?.item;
  const finalTime = transactionOccurredAt(payout);
  const transactionTitle = item?.transactionReference || payout.invoice || payout.id;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className="page-stack transaction-detail-page">
      <button className="project-back-button transaction-detail-back" type="button" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true" />
        返回交易记录
      </button>

      <header className="transaction-detail-header">
        <div>
          <span>交易详情</span>
          <h1 ref={titleRef} tabIndex={-1}>{transactionTitle}</h1>
          <p>{payout.invoice || 'Invoice 未记录'} · {displayTime(finalTime)}</p>
        </div>
        <StatusMark status={payout.status} />
      </header>

      <section className="transaction-creator-summary-card" aria-label={`付款达人 ${payout.creator}`}>
        <Avatar initials={payout.initials} accent={payout.accent} size="lg" />
        <div>
          <strong>{payout.creator}</strong>
          <small>{payout.project}</small>
          <span>{payout.handle}</span>
        </div>
        <StatusMark status={payout.status} />
      </section>

      <section className="transaction-detail-summary" aria-label="交易摘要">
        <article>
          <span>付款金额</span>
          <strong>{formatAmount(payout)}</strong>
          <small>{item ? `收款币种 ${item.receiveCurrency}` : '按交易记录快照'}</small>
        </article>
        <article>
          <span>付款渠道</span>
          <PaymentProviderBadge provider={payout.provider} />
          <small>{item?.transferMethod ?? '渠道方式未记录'}</small>
        </article>
        <article>
          <span>交易状态</span>
          <StatusMark status={payout.status} />
          <small>{displayTime(finalTime)}</small>
        </article>
      </section>

      {payout.paymentFailure ? (
        <section className="transaction-detail-failure" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>{payout.paymentFailure.errorCode}</strong>
            <span>{payout.paymentFailure.providerResponse}</span>
            <small>{displayTime(payout.paymentFailure.occurredAt)}</small>
          </div>
        </section>
      ) : null}

      <section className="transaction-detail-section">
        <header>
          <div><h2>付款信息</h2><p>本笔交易的渠道、账户与付款执行快照。</p></div>
        </header>
        <dl className="transaction-detail-info-grid">
          <div><dt>交易记录 ID</dt><dd>{payout.id}</dd></div>
          <div><dt>付款时间</dt><dd>{displayTime(finalTime)}</dd></div>
          <div><dt>付款人</dt><dd>{batch?.payer ?? '未记录'}</dd></div>
          <div><dt>付款批次时间</dt><dd>{displayTime(batch?.paidAt)}</dd></div>
          <div><dt>收款账户</dt><dd>{item?.accountSummary ?? payout.account ?? '未记录'}</dd></div>
          <div><dt>付款方式</dt><dd>{item?.transferMethod ?? payout.provider}</dd></div>
          <div><dt>费用承担</dt><dd>{item?.feeBearer ?? '未记录'}</dd></div>
          <div><dt>交易附言</dt><dd>{item?.transactionReference ?? '未记录'}</dd></div>
        </dl>
      </section>

      <section className="transaction-detail-section">
        <header>
          <div><h2>业务关联</h2><p>追溯本笔交易所属项目、请款项目和付款批次。</p></div>
        </header>
        <div className="transaction-association-grid">
          <article>
            <span className="transaction-association-icon" aria-hidden="true"><Building2 size={19} /></span>
            <div><small>所属关联项目</small><strong>{batch?.request.cooperationProjectName ?? payout.project}</strong><span>{batch?.request.cooperationProjectCode ?? payout.projectId}</span></div>
          </article>
          <article>
            <span className="transaction-association-icon" aria-hidden="true"><Layers3 size={19} /></span>
            <div><small>所属请款项目</small><strong>{batch?.request.requestCode ?? '未关联'}</strong><span>{batch?.request.requestStatus ?? '未记录'}</span></div>
          </article>
          <article>
            <span className="transaction-association-icon" aria-hidden="true"><ReceiptText size={19} /></span>
            <div><small>所属请款批次</small><strong>{batch?.paymentBatchCode ?? '未关联'}</strong><span>{batch ? `${batch.provider} · ${batch.status}` : '历史记录未保留批次快照'}</span></div>
          </article>
        </div>
      </section>

      <section className="transaction-detail-section transaction-resource-section">
        <header>
          <div><h2>合同、Invoice 与付款清单</h2><p>查看这笔交易在付款时保存的关联资料快照。</p></div>
        </header>
        <div className="transaction-resource-list">
          <article className="transaction-resource-card">
            <span className="transaction-resource-icon" aria-hidden="true"><FileText size={19} /></span>
            <div className="transaction-resource-heading">
              <strong>合同</strong>
              <small>{item?.contracts.length ? `${item.contracts.length} 份关联文件` : '未关联合同快照'}</small>
            </div>
            <div className="transaction-resource-content">
              {item?.contracts.length ? item.contracts.map((contract) => (
                <div className="transaction-resource-entry" key={contract.contractId}>
                  <strong>{contract.contractCode}</strong>
                  <span>{contract.name}</span>
                  <small>{money(contract.currency, contract.amount)} · {contract.signed ? '已签署' : '待签署'} · {contract.status}</small>
                </div>
              )) : <span>{item?.legacyContractReference ?? payout.contract ?? '未关联'}</span>}
            </div>
          </article>

          <article className="transaction-resource-card">
            <span className="transaction-resource-icon is-invoice" aria-hidden="true"><ReceiptText size={19} /></span>
            <div className="transaction-resource-heading">
              <strong>Invoice</strong>
              <small>{item?.invoice ? `版本 V${item.invoice.version}` : '未关联稳定快照'}</small>
            </div>
            <div className="transaction-resource-content">
              {item?.invoice ? (
                <div className="transaction-resource-entry">
                  <strong>{item.invoice.invoiceNumber}</strong>
                  <span>{money(item.invoice.currency, item.invoice.amount)}</span>
                  <small>{item.invoice.invoiceDate} · {item.invoice.reviewStatus}</small>
                </div>
              ) : <span>{item?.legacyInvoiceReference ?? payout.invoice ?? '未关联'}</span>}
            </div>
          </article>

          <article className="transaction-resource-card is-payment-list">
            <span className="transaction-resource-icon is-payment-list" aria-hidden="true"><FileSpreadsheet size={19} /></span>
            <div className="transaction-resource-heading">
              <strong>付款清单</strong>
              <small>本笔付款执行依据</small>
            </div>
            <div className="transaction-resource-content">
              <div className="transaction-resource-entry">
                <strong>{item?.paymentListCode ?? '未关联'}</strong>
                <span>{item?.paymentListVersion ? `版本 V${item.paymentListVersion}` : '版本未记录'}</span>
                <small>{item?.paymentListStatus ?? '历史记录未保留付款清单快照'}</small>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
