import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  CalendarClock,
  CircleCheckBig,
  ClipboardCheck,
  CreditCard,
  Eye,
  FileSpreadsheet,
  FileText,
  Files,
  FolderKanban,
  Landmark,
  Layers3,
  Link2,
  MessageSquareText,
  ReceiptText,
  ShieldCheck,
  UserRoundCheck,
  WalletCards,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { accountDisplayValue } from '../accountPresentation';
import { Button, Modal, StatusMark } from '../components/Common';
import { CreatorIdentity } from '../components/CreatorIdentity';
import { paymentProviderDisplayName, PaymentProviderBadge } from '../components/PaymentProviderBadge';
import { formatAmount } from '../data';
import type { TransactionBatchContext } from '../transactionRecords';
import { transactionOccurredAt, transactionRecordDetails } from '../transactionRecords';
import type { Payout } from '../types';

const displayTime = (value?: string) => {
  if (!value) return '未记录';
  return value.replace('T', ' ').replace(/\.000Z$/, '').replace(/Z$/, '');
};

const money = (currency: string, amount: number | null) => (
  amount === null ? '未记录' : `${currency} ${amount.toLocaleString('en-US')}`
);

type TransactionResourceView = 'contract' | 'invoice' | 'payment-list';

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
  const [resourceView, setResourceView] = useState<TransactionResourceView | null>(null);
  const details = transactionRecordDetails(payout, context);
  const finalTime = transactionOccurredAt(payout);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className="page-stack transaction-detail-page">
      <button className="project-back-button transaction-detail-back" type="button" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true" />
        返回交易记录
      </button>
      <h1 ref={titleRef} className="sr-only" tabIndex={-1}>交易详情：{payout.invoice || payout.creator}</h1>

      <section className="transaction-creator-summary-card" aria-label={`付款达人 ${payout.creator}`}>
        <CreatorIdentity displayName={payout.creator} initials={payout.initials} accent={payout.accent} fallbackHandle={payout.handle} fallbackPlatform={payout.creatorPlatform} size="lg" />
        <div className="transaction-creator-summary-identity">
          <span><FolderKanban size={13} aria-hidden="true" />{payout.project}</span>
        </div>
        <StatusMark status={payout.status} />
      </section>

      <section className="transaction-detail-summary" aria-label="交易摘要">
        <article className="is-amount">
          <span className="transaction-detail-summary-label"><Banknote size={15} aria-hidden="true" />付款金额</span>
          <strong>{formatAmount(payout)}</strong>
          <small>收款币种 {details.receiveCurrency}</small>
        </article>
        <article className="is-provider">
          <span className="transaction-detail-summary-label"><Landmark size={15} aria-hidden="true" />付款渠道</span>
          <PaymentProviderBadge provider={payout.provider} />
          <small>{details.transferMethod}</small>
        </article>
        <article className="is-status">
          <span className="transaction-detail-summary-label"><CircleCheckBig size={15} aria-hidden="true" />交易状态</span>
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
          <span className="transaction-section-icon" aria-hidden="true"><WalletCards size={18} /></span>
          <div><h2>付款信息</h2><p>本笔交易的渠道、账户与付款执行快照。</p></div>
        </header>
        <dl className="transaction-detail-info-grid">
          <div className="is-time"><dt><CalendarClock size={14} aria-hidden="true" />付款时间</dt><dd>{displayTime(details.paymentTime)}</dd></div>
          <div className="is-payer"><dt><UserRoundCheck size={14} aria-hidden="true" />付款人</dt><dd>{details.payer}</dd></div>
          <div className="is-batch"><dt><Layers3 size={14} aria-hidden="true" />付款批次号</dt><dd>{details.paymentBatchCode}</dd></div>
          <div className="is-account"><dt><Landmark size={14} aria-hidden="true" />收款账户</dt><dd>{accountDisplayValue(details.accountSummary)}</dd></div>
          <div className="is-method"><dt><CreditCard size={14} aria-hidden="true" />付款方式</dt><dd>{details.transferMethod}</dd></div>
          <div className="is-fee"><dt><ShieldCheck size={14} aria-hidden="true" />费用承担</dt><dd>{details.feeBearer}</dd></div>
          <div className="is-reference"><dt><MessageSquareText size={14} aria-hidden="true" />交易附言</dt><dd>{details.transactionReference}</dd></div>
          <div className="is-reason"><dt><ClipboardCheck size={14} aria-hidden="true" />付款事由</dt><dd>{details.requestReason}</dd></div>
        </dl>
      </section>

      <section className="transaction-detail-section">
        <header>
          <span className="transaction-section-icon is-association" aria-hidden="true"><Link2 size={18} /></span>
          <div><h2>业务关联</h2><p>追溯本笔交易所属项目、请款项目和付款批次。</p></div>
        </header>
        <div className="transaction-association-grid">
          <article className="is-cooperation-project">
            <span className="transaction-association-icon" aria-hidden="true"><Building2 size={19} /></span>
            <div><small>所属关联项目</small><strong>{details.cooperationProjectName}</strong><span>{details.cooperationProjectCode}</span></div>
          </article>
          <article className="is-request-project">
            <span className="transaction-association-icon" aria-hidden="true"><Layers3 size={19} /></span>
            <div><small>所属请款项目</small><strong>{details.requestCode}</strong><span>{details.requestStatus}</span></div>
          </article>
          <article className="is-payment-batch">
            <span className="transaction-association-icon" aria-hidden="true"><ReceiptText size={19} /></span>
            <div><small>所属请款批次</small><strong>{details.paymentBatchCode}</strong><span>{paymentProviderDisplayName(payout.provider)} · {details.batchStatus}</span></div>
          </article>
        </div>
      </section>

      <section className="transaction-detail-section transaction-resource-section">
        <header>
          <span className="transaction-section-icon is-resource" aria-hidden="true"><Files size={18} /></span>
          <div><h2>合同、Invoice 与付款清单</h2><p>查看这笔交易在付款时保存的关联资料快照。</p></div>
        </header>
        <div className="transaction-resource-list">
          <article className="transaction-resource-card">
            <span className="transaction-resource-icon is-contract" aria-hidden="true"><FileText size={19} /></span>
            <div className="transaction-resource-heading">
              <strong>合同</strong>
              <small>{details.contracts.length ? `${details.contracts.length} 份关联文件` : '历史数据待补全'}</small>
            </div>
            <div className="transaction-resource-content">
              {details.contracts.length ? details.contracts.map((contract) => (
                <div className="transaction-resource-entry" key={contract.contractId ?? contract.contractCode}>
                  <strong>{contract.contractCode}</strong>
                  <span>{contract.name}</span>
                  <small>{money(contract.currency, contract.amount)} · {contract.signed ? '已签署' : '待签署'} · {contract.status}</small>
                </div>
              )) : <span>{payout.contract || '历史数据待补全'}</span>}
            </div>
            <Button
              variant="secondary"
              className="transaction-resource-view-button"
              icon={<Eye size={15} />}
              aria-label="查看合同"
              aria-haspopup="dialog"
              onClick={() => setResourceView('contract')}
            >查看</Button>
          </article>

          <article className="transaction-resource-card">
            <span className="transaction-resource-icon is-invoice" aria-hidden="true"><ReceiptText size={19} /></span>
            <div className="transaction-resource-heading">
              <strong>Invoice</strong>
              <small>{details.invoice ? `版本 V${details.invoice.version}` : '历史数据待补全'}</small>
            </div>
            <div className="transaction-resource-content">
              {details.invoice ? (
                <div className="transaction-resource-entry">
                  <strong>{details.invoice.invoiceNumber}</strong>
                  <span>{money(details.invoice.currency, details.invoice.amount)}</span>
                  <small>{details.invoice.invoiceDate} · {details.invoice.reviewStatus}</small>
                </div>
              ) : <span>{payout.invoice || '历史数据待补全'}</span>}
            </div>
            <Button
              variant="secondary"
              className="transaction-resource-view-button"
              icon={<Eye size={15} />}
              aria-label="查看 Invoice"
              aria-haspopup="dialog"
              onClick={() => setResourceView('invoice')}
            >查看</Button>
          </article>

          <article className="transaction-resource-card is-payment-list">
            <span className="transaction-resource-icon is-payment-list" aria-hidden="true"><FileSpreadsheet size={19} /></span>
            <div className="transaction-resource-heading">
              <strong>付款清单</strong>
              <small>本笔付款执行依据</small>
            </div>
            <div className="transaction-resource-content">
              <div className="transaction-resource-entry">
                <strong>{details.paymentListCode}</strong>
                <span>{details.paymentListVersion ? `版本 V${details.paymentListVersion}` : '历史数据待补全'}</span>
                <small>{details.paymentListStatus}</small>
              </div>
            </div>
            <Button
              variant="secondary"
              className="transaction-resource-view-button is-payment-list"
              icon={<Eye size={15} />}
              aria-label="查看付款清单"
              aria-haspopup="dialog"
              onClick={() => setResourceView('payment-list')}
            >查看</Button>
          </article>
        </div>
      </section>

      {resourceView ? (
        <Modal
          className="transaction-resource-modal"
          width="680px"
          title={resourceView === 'contract' ? '合同详情' : resourceView === 'invoice' ? 'Invoice 详情' : '付款清单详情'}
          onClose={() => setResourceView(null)}
          footer={<Button variant="secondary" onClick={() => setResourceView(null)}>关闭</Button>}
        >
          {resourceView === 'contract' ? (
            details.contracts.length ? (
              <div className="transaction-resource-modal-list">
                {details.contracts.map((contract) => (
                  <section key={contract.contractId ?? contract.contractCode}>
                    <header><FileText size={18} aria-hidden="true" /><strong>{contract.contractCode}</strong></header>
                    <dl>
                      <div><dt>合同名称</dt><dd>{contract.name}</dd></div>
                      <div><dt>合同金额</dt><dd>{money(contract.currency, contract.amount)}</dd></div>
                      <div><dt>签署状态</dt><dd>{contract.signed ? '已签署' : '待签署'}</dd></div>
                      <div><dt>合同状态</dt><dd>{contract.status}</dd></div>
                      <div><dt>更新时间</dt><dd>{contract.updatedAt || '未记录'}</dd></div>
                    </dl>
                  </section>
                ))}
              </div>
            ) : (
              <p className="transaction-resource-modal-empty">合同快照仍待补全：{payout.contract || '未提供合同编号'}</p>
            )
          ) : null}

          {resourceView === 'invoice' ? (
            details.invoice ? (
              <dl className="transaction-resource-modal-grid">
                <div><dt>Invoice 号</dt><dd>{details.invoice.invoiceNumber}</dd></div>
                <div><dt>Invoice 日期</dt><dd>{details.invoice.invoiceDate}</dd></div>
                <div><dt>Invoice 金额</dt><dd>{money(details.invoice.currency, details.invoice.amount)}</dd></div>
                <div><dt>版本</dt><dd>V{details.invoice.version}</dd></div>
                <div><dt>审核状态</dt><dd>{details.invoice.reviewStatus}</dd></div>
                <div><dt>资料校验</dt><dd>{details.invoice.validationStatus === 'valid' ? '已通过' : '需要复核'}</dd></div>
              </dl>
            ) : (
              <p className="transaction-resource-modal-empty">Invoice 快照仍待补全：{payout.invoice || '未提供 Invoice 编号'}</p>
            )
          ) : null}

          {resourceView === 'payment-list' ? (
            <dl className="transaction-resource-modal-grid is-payment-list">
              <div><dt>付款清单编号</dt><dd>{details.paymentListCode}</dd></div>
              <div><dt>版本</dt><dd>{details.paymentListVersion ? `V${details.paymentListVersion}` : '历史数据待补全'}</dd></div>
              <div><dt>清单状态</dt><dd>{details.paymentListStatus}</dd></div>
              <div><dt>付款达人</dt><dd>{payout.creator}</dd></div>
              <div><dt>付款金额</dt><dd>{formatAmount(payout)}</dd></div>
              <div><dt>付款渠道</dt><dd>{paymentProviderDisplayName(payout.provider)}</dd></div>
              <div><dt>付款方式</dt><dd>{details.transferMethod}</dd></div>
              <div><dt>付款批次号</dt><dd>{details.paymentBatchCode}</dd></div>
              <div className="transaction-resource-modal-full"><dt>付款事由</dt><dd>{details.requestReason}</dd></div>
            </dl>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
