import {
  CalendarClock,
  FileText,
  Landmark,
  ReceiptText,
  Send,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { RequestProjectSummary } from '../pages/RequestProjectDetailPage';
import type { PaymentProjectRow } from '../pages/PaymentWorkbenchPage';
import type { Payout } from '../types';
import { ApprovalTimeline } from './FinanceReviewWorkspace';
import { Button, Modal } from './Common';
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

export function PaymentExecutionWorkspace({
  request,
  project,
  canExecute,
  onExecute,
  onClose,
}: {
  request: RequestProjectSummary;
  project: PaymentProjectRow;
  canExecute: boolean;
  onExecute: (payouts: Payout[]) => boolean;
  onClose: () => void;
}) {
  const payablePayouts = project.payouts.filter((payout) => payout.status === '等待付款');
  const paymentProvider = project.paymentChannels[0] ?? '待确认';
  const projectBrand = request.generatedDetail?.brand ?? request.brand ?? '待补充';
  const requestReason = request.generatedDetail?.reason ?? '未单独填写';
  const submittedAt = request.approval?.submittedAt ?? request.createdAt;
  const canSubmitPayment = canExecute && payablePayouts.length > 0;

  const executePayment = () => {
    if (onExecute(project.payouts)) onClose();
  };

  return (
    <Modal
      title={`${project.requestCode} · 执行打款`}
      width="100vw"
      className="payment-execution-workspace"
      onClose={onClose}
      onBackdropMouseDown={() => undefined}
      footer={(
        <div className="payment-execution-footer">
          <div>
            <strong>{project.amount}</strong>
            <span>{payablePayouts.length} 笔待打款 · {paymentProvider}</span>
          </div>
          <div>
            <Button variant="secondary" onClick={onClose}>返回列表</Button>
            <Button icon={<Send size={16} />} disabled={!canSubmitPayment} onClick={executePayment}>
              执行打款
            </Button>
          </div>
        </div>
      )}
    >
      <div className="payment-execution-shell" data-testid="payment-execution-workspace">
        <main className="payment-execution-main">
          <section className="payment-execution-project" aria-labelledby="payment-execution-project-title">
            <header>
              <div>
                <span className="payment-execution-section-icon"><WalletCards size={18} /></span>
                <div>
                  <h2 id="payment-execution-project-title">请款项目信息</h2>
                  <p>{project.cooperationProjectName}</p>
                </div>
              </div>
              <span className="payment-execution-status"><i />待打款</span>
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
              <div className="is-wide"><dt>请款事由</dt><dd>{requestReason}</dd></div>
            </dl>
          </section>

          <section className="payment-execution-payees" aria-labelledby="payment-execution-payees-title">
            <header>
              <div>
                <span className="payment-execution-section-icon"><UserRound size={18} /></span>
                <div>
                  <h2 id="payment-execution-payees-title">达人请款信息概览</h2>
                  <p>共 {project.payouts.length} 位达人 · {project.invoices} 份 Invoice</p>
                </div>
              </div>
            </header>

            <div className="payment-execution-payee-list">
              {project.payouts.map((payout, index) => (
                <article className="payment-execution-payee" key={payout.id}>
                  <header>
                    <span className="payment-execution-payee-avatar" style={{ '--payee-accent': payout.accent } as CSSProperties}>
                      {payout.initials}
                    </span>
                    <div>
                      <strong>{payout.creator}</strong>
                      <small>{payout.invoice} · {project.paymentOrder} · {payout.provider}</small>
                    </div>
                    <span className="payment-execution-payee-status"><i />{payout.status === '等待付款' ? '待打款' : payout.status}</span>
                  </header>
                  <div className="payment-execution-account-note">
                    <ShieldCheck size={15} />
                    <span>账户快照完整，付款时按已审核资料执行</span>
                  </div>
                  <dl>
                    <div className="is-account"><dt>收款账户</dt><dd>{payout.account}<small>{transferMethodLabel(payout)}</small></dd></div>
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
                    <span><Landmark size={13} />{payout.provider}</span>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="payment-execution-approval" aria-labelledby="payment-execution-approval-title">
          <header>
            <div>
              <span className="payment-execution-section-icon"><ShieldCheck size={18} /></span>
              <div>
                <h2 id="payment-execution-approval-title">当前审批流</h2>
                <p>第 {request.approval?.round ?? 1} 轮 · 财务审批已完成</p>
              </div>
            </div>
            <span><CalendarClock size={14} />待执行</span>
          </header>
          <div className="payment-execution-approval-scroll" tabIndex={0} aria-label="付款审批流程">
            <ApprovalTimeline
              request={request}
              paymentReady
              paymentProvider={paymentProvider}
            />
          </div>
        </aside>
      </div>
    </Modal>
  );
}
