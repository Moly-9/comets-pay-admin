import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Eye,
  FileText,
  Files,
  Landmark,
  ReceiptText,
  Send,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { formatContractMoney, getContractReadiness, type ContractRecord } from '../contracts';
import { isPayoutPaymentInformationValidated } from '../invoice/invoiceReviewWorkflow';
import { formatInvoiceMoney, invoiceTotal } from '../invoice/invoiceUtils';
import type { RequestProjectSummary } from '../pages/RequestProjectDetailPage';
import type { PaymentProjectRow } from '../pages/PaymentWorkbenchPage';
import { requestApprovalReturnDetails } from '../requestApprovalWorkflow';
import type { CreatorProfile, GeneratedInvoiceRecord, Payout } from '../types';
import { ApprovalTimeline } from './FinanceReviewWorkspace';
import { requestLinkedContracts, requestLinkedInvoices } from './RequestProjectResourceManager';
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

const payoutFailureReason = (payout: Payout, requestReason: string) => (
  payout.paymentFailureReturn?.reason?.trim()
  || payout.returnReason?.trim()
  || payout.issue?.trim()
  || requestReason
  || '未记录失败原因'
);

const payoutHasFailureMarker = (payout: Payout) => Boolean(
  payout.paymentFailure
  || payout.paymentFailureReturn
  || payout.paymentFailureRecovery
  || payout.returnReason?.trim()
  || payout.issue?.trim()
  || payout.status === '付款失败'
  || payout.status === '已退回'
);

export function PaymentExecutionWorkspace({
  request,
  project,
  generatedInvoices,
  contracts = [],
  creators = [],
  variant = 'execution',
  canExecute,
  onExecute,
  onReturn,
  onOpenContract,
  onOpenInvoice,
  onClose,
}: {
  request: RequestProjectSummary;
  project: PaymentProjectRow;
  generatedInvoices: GeneratedInvoiceRecord[];
  contracts?: ContractRecord[];
  creators?: CreatorProfile[];
  variant?: 'execution' | 'returned';
  canExecute: boolean;
  onExecute: (payouts: Payout[]) => boolean;
  onReturn: (reason: string) => boolean;
  onOpenContract?: (contractId: string) => void;
  onOpenInvoice?: (invoiceId: GeneratedInvoiceRecord['invoiceId']) => void;
  onClose: () => void;
}) {
  const isReturned = variant === 'returned';
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [resourceDialog, setResourceDialog] = useState<'contract' | 'invoice' | null>(null);
  const payablePayouts = project.payouts.filter((payout) => payout.status === '等待付款');
  const validatedPayouts = project.payouts.filter(isPayoutPaymentInformationValidated);
  const linkedContracts = requestLinkedContracts(request, contracts);
  const linkedInvoices = requestLinkedInvoices(request, generatedInvoices);
  const accountValidationIssueCount = Math.max(0, project.payouts.length - validatedPayouts.length);
  const accountValidationStatus = project.payouts.length === 0
    ? 'empty'
    : accountValidationIssueCount === 0
      ? 'passed'
      : 'warning';
  const accountValidationLabel = accountValidationStatus === 'passed'
    ? '已通过'
    : accountValidationStatus === 'warning'
      ? `${accountValidationIssueCount} 笔需处理`
      : '暂无付款记录';
  const paymentProvider = project.paymentChannels[0] ?? '待确认';
  const projectBrand = request.generatedDetail?.brand ?? request.brand ?? '待补充';
  const requestReason = request.generatedDetail?.reason ?? '未单独填写';
  const submittedAt = request.approval?.submittedAt ?? request.createdAt;
  const returnDetails = requestApprovalReturnDetails(request.approval);
  const structuredReturnItems = returnDetails?.items ?? [];
  const hasScopedReturnItems = isReturned && structuredReturnItems.length > 0;
  const requestReturnReason = returnDetails?.reason?.trim() || '';
  const canSubmitPayment = canExecute
    && payablePayouts.length > 0
    && payablePayouts.length === project.payouts.length
    && validatedPayouts.length === project.payouts.length;
  const canReturnPayment = canExecute
    && payablePayouts.length > 0
    && payablePayouts.length === project.payouts.length;
  const returnItemForPayout = (payout: Payout) => {
    const invoice = generatedInvoices.find((record) => record.sourcePayoutId === payout.id);
    return invoice
      ? structuredReturnItems.find((item) => item.invoiceId === invoice.invoiceId)
      : undefined;
  };
  const returnedPayoutDetails = isReturned ? project.payouts.flatMap((payout) => {
    const returnItem = hasScopedReturnItems ? returnItemForPayout(payout) : undefined;
    if (!returnItem && !payoutHasFailureMarker(payout)) return [];
    return [{
      payoutId: payout.id,
      returnItem,
      reason: returnItem?.reason ?? payoutFailureReason(payout, requestReturnReason),
    }];
  }) : [];
  const returnedPayoutIds = new Set(returnedPayoutDetails.map((detail) => detail.payoutId));
  const returnedPayoutCount = returnedPayoutDetails.length;
  const passedPayoutCount = Math.max(0, project.payouts.length - returnedPayoutCount);
  const returnedReason = requestReturnReason
    || returnedPayoutDetails.find((detail) => detail.reason !== '未记录失败原因')?.reason
    || '未记录失败原因';
  const returnedAt = returnDetails?.occurredAt
    ?? project.payouts.find((payout) => payout.paymentFailureReturn?.occurredAt)
      ?.paymentFailureReturn?.occurredAt;

  const executePayment = () => {
    if (onExecute(project.payouts)) onClose();
  };

  const submitReturn = () => {
    const normalizedReason = returnReason.trim();
    if (normalizedReason && onReturn(normalizedReason)) {
      setReturnDialogOpen(false);
      onClose();
    }
  };

  return (
    <>
      <Modal
        title={`${project.requestCode} · ${isReturned ? '已退回详情' : '执行打款'}`}
        width="100vw"
        className="payment-execution-workspace"
        onClose={onClose}
        onBackdropMouseDown={() => undefined}
        footer={(
          <div className={`payment-execution-footer${isReturned ? ' is-returned' : ''}`}>
            <div>
              <strong>{project.amount}</strong>
              <span>{isReturned
                ? `${returnedPayoutCount} 笔明细需修改，其余 ${passedPayoutCount} 笔已通过审核 · ${paymentProvider}`
                : `${validatedPayouts.length} 笔付款信息校验成功 · ${paymentProvider}`}</span>
            </div>
            <div>
              <Button variant="secondary" onClick={onClose}>返回列表</Button>
              {!isReturned ? (
                <>
                  <Button
                    className="payment-execution-return-action"
                    variant="danger"
                    icon={<AlertTriangle size={16} />}
                    disabled={!canReturnPayment}
                    onClick={() => setReturnDialogOpen(true)}
                  >
                    退回媒介修改
                  </Button>
                  <Button
                    className="payment-execution-submit-action"
                    icon={<Send size={16} />}
                    disabled={!canSubmitPayment}
                    onClick={executePayment}
                  >
                    执行打款
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        )}
      >
        <div className="payment-execution-shell" data-testid="payment-execution-workspace">
          <main
            className={`payment-execution-main${isReturned ? ' is-returned' : ' payment-execution-board-card'}`}
            tabIndex={0}
            aria-label="请款项目与达人请款信息"
          >
          <section className={`payment-execution-project${isReturned ? ' payment-execution-content-card' : ''}`} aria-labelledby="payment-execution-project-title">
            <header>
              <div>
                <span className="payment-execution-section-icon"><WalletCards size={18} /></span>
                <div>
                  <h2 id="payment-execution-project-title">请款项目信息</h2>
                  <p>{project.cooperationProjectName}</p>
                </div>
              </div>
              <span className={`payment-execution-status${isReturned ? ' is-returned' : ''}`}><i />{isReturned ? '已退回' : '待打款'}</span>
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
              <div className="is-wide"><dt>付款事由</dt><dd>{requestReason}</dd></div>
            </dl>
          </section>

          {isReturned ? (
            <section className="payment-execution-failure-card payment-execution-content-card" aria-labelledby="payment-execution-failure-title">
              <header>
                <div>
                  <span className="payment-execution-section-icon is-failure"><AlertTriangle size={18} /></span>
                  <div>
                    <h2 id="payment-execution-failure-title">失败原因</h2>
                    <p>{returnedPayoutCount} 位达人需修改 · {passedPayoutCount} 位达人已通过审核</p>
                  </div>
                </div>
                <span className="payment-execution-failure-count">{returnedPayoutCount} 位需处理</span>
              </header>
              <div className="payment-execution-failure-summary" role="alert">
                <AlertTriangle size={20} />
                <div>
                  <strong>{returnedReason}</strong>
                  <small>
                    {returnDetails
                      ? `${returnDetails.stageLabel} · ${returnDetails.actorName} · 第 ${returnDetails.round} 轮`
                      : '付款工作台退回'}
                    {returnedAt ? ` · ${formatDateTime(returnedAt)}` : ''}
                  </small>
                </div>
              </div>
            </section>
          ) : null}

          <section className={`payment-execution-payees${isReturned ? ' payment-execution-content-card' : ''}`} aria-labelledby="payment-execution-payees-title">
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
              {project.payouts.map((payout, index) => {
                const informationValidated = isPayoutPaymentInformationValidated(payout);
                const returnItem = hasScopedReturnItems ? returnItemForPayout(payout) : undefined;
                const detailReturned = isReturned && returnedPayoutIds.has(payout.id);
                const detailPassed = isReturned && !detailReturned;
                const failureReason = returnItem?.reason ?? payoutFailureReason(payout, requestReturnReason);
                return (
                  <article className={`payment-execution-payee${detailReturned ? ' is-returned' : ''}${detailPassed ? ' is-passed' : ''}`} key={payout.id}>
                    <header>
                      <span className="payment-execution-payee-avatar" style={{ '--payee-accent': payout.accent } as CSSProperties}>
                        {payout.initials}
                      </span>
                      <div>
                        <strong>{payout.creator}</strong>
                        <small>{payout.invoice} · {project.paymentOrder} · {payout.provider}</small>
                      </div>
                      <span className={`payment-execution-payee-status ${detailReturned ? 'is-error' : detailPassed || informationValidated ? 'is-valid' : 'is-pending'}`}>
                        {detailReturned || (!detailPassed && !informationValidated) ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                        {detailReturned
                          ? returnItem?.issueType === 'PAYMENT_LIST'
                            ? '付款清单已退回'
                            : returnItem?.issueType === 'INVOICE_CONTENT'
                              ? 'Invoice 已退回'
                              : '请款信息已退回'
                          : detailPassed
                            ? '已通过审核'
                            : informationValidated ? '付款信息校验成功' : '付款信息待校验'}
                      </span>
                    </header>
                    <div className={`payment-execution-account-note ${detailReturned ? 'is-error' : detailPassed || informationValidated ? 'is-valid' : 'is-pending'}`}>
                      {detailReturned || (!detailPassed && !informationValidated) ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                      <span>{detailReturned
                        ? <><b>退回原因：</b>{failureReason}</>
                        : detailPassed
                          ? '该达人请款信息已通过审核，无需修改'
                          : informationValidated
                            ? '付款信息校验成功，收款账户与付款资料均已通过审核'
                            : '付款信息尚未完成校验，暂不能执行打款'}</span>
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
                );
              })}
            </div>
          </section>
        </main>

          <aside className="payment-execution-side" aria-label="审批与关联资料">
            <section className="payment-execution-approval payment-execution-board-card" aria-labelledby="payment-execution-approval-title">
              <header>
                <div>
                  <span className="payment-execution-section-icon"><ShieldCheck size={18} /></span>
                  <div>
                    <h2 id="payment-execution-approval-title">当前审批流</h2>
                    <p>第 {request.approval?.round ?? 1} 轮 · {isReturned ? '请款已退回媒介修改' : '财务审批已完成'}</p>
                  </div>
                </div>
                <span className={isReturned ? 'is-returned' : ''}><CalendarClock size={14} />{isReturned ? '已退回' : '待执行'}</span>
              </header>
              <div className="payment-execution-approval-scroll" tabIndex={0} aria-label="付款审批流程">
                {isReturned ? (
                  <div className="payment-execution-approval-return-note">
                    <AlertTriangle size={17} />
                    <div>
                      <strong>{returnDetails?.stageLabel ?? '付款工作台'}已退回</strong>
                      <p>{hasScopedReturnItems
                        ? `${returnedPayoutCount} 笔明细需要修改，具体原因请查看左侧对应达人卡片。`
                        : `${returnedPayoutCount} 笔明细需要修改，其余 ${passedPayoutCount} 笔已通过审核。`}</p>
                    </div>
                  </div>
                ) : null}
                <ApprovalTimeline
                  request={request}
                  paymentReady={!isReturned}
                  paymentProvider={paymentProvider}
                  compact
                />
              </div>
            </section>

            <section className="payment-execution-resources payment-execution-board-card" aria-labelledby="payment-execution-resources-title">
              <header>
                <div>
                  <span className="payment-execution-section-icon"><Files size={18} /></span>
                  <div>
                    <h2 id="payment-execution-resources-title">关联资料</h2>
                    <p>合同、Invoice 与收款账户校验汇总</p>
                  </div>
                </div>
                <span>项目级汇总</span>
              </header>
              <div className="payment-execution-resource-list">
                <div className="payment-execution-resource-row">
                  <span className="payment-execution-resource-icon" aria-hidden="true"><FileText size={16} /></span>
                  <strong>合同 · {linkedContracts.length} 份</strong>
                  <button type="button" disabled={!linkedContracts.length} onClick={() => setResourceDialog('contract')}>查看合同</button>
                </div>
                <div className="payment-execution-resource-row">
                  <span className="payment-execution-resource-icon" aria-hidden="true"><ReceiptText size={16} /></span>
                  <strong>Invoice · {linkedInvoices.length} 份</strong>
                  <button type="button" disabled={!linkedInvoices.length} onClick={() => setResourceDialog('invoice')}>查看 Invoice</button>
                </div>
                <div className="payment-execution-resource-row">
                  <span className="payment-execution-resource-icon" aria-hidden="true"><Landmark size={16} /></span>
                  <strong>收款账户校验结果</strong>
                  <span className={`payment-execution-resource-status is-${accountValidationStatus}`}>{accountValidationLabel}</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </Modal>

      {resourceDialog === 'contract' ? (
        <Modal
          title={`${request.requestCode ?? request.id} · 合同资料`}
          width="1120px"
          className="project-resource-modal request-resource-modal payment-execution-resource-modal"
          onClose={() => setResourceDialog(null)}
          footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}
        >
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading"><div><strong>全部合同</strong><p>平铺展示当前请款项目已关联的合同。</p></div><span>{linkedContracts.length} 份</span></div>
            <div className="request-resource-flat-list">
              {linkedContracts.map((contract) => {
                const creator = creators.find((candidate) => candidate.id === contract.creatorId);
                const contractId = contract.contractId ?? contract.id;
                return (
                  <article className="request-resource-flat-row" key={contractId}>
                    <span className="project-contract-record-icon"><FileText size={18} /></span>
                    <div><strong>{contract.id}</strong><small>{contract.name}</small></div>
                    <div><span>达人</span><strong>{creator?.name ?? contract.publisher ?? '达人档案缺失'}</strong><small>{creator ? `${creator.handle} · ${creator.platform}` : contract.creatorHandle ?? contract.creatorId}</small></div>
                    <div><span>合同 / IO</span><strong>{contract.ioId || 'IO 待补充'}</strong><small>{formatContractMoney(contract)}</small></div>
                    <span className="project-record-status"><i />{getContractReadiness(contract).label}</span>
                    <div className="project-contract-record-actions"><Button variant="secondary" icon={<Eye size={14} />} onClick={() => onOpenContract?.(contract.id)}>查看</Button></div>
                  </article>
                );
              })}
            </div>
          </div>
        </Modal>
      ) : null}

      {resourceDialog === 'invoice' ? (
        <Modal
          title={`${request.requestCode ?? request.id} · Invoice`}
          width="1080px"
          className="project-resource-modal request-resource-modal payment-execution-resource-modal"
          onClose={() => setResourceDialog(null)}
          footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}
        >
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading"><div><strong>全部 Invoice</strong><p>平铺展示 {linkedInvoices.length} 份 Invoice，同一达人可关联多份。</p></div><span>{linkedInvoices.length} 份</span></div>
            <div className="request-resource-flat-list">
              {linkedInvoices.map((linkedInvoice) => {
                const creator = creators.find((candidate) => candidate.id === linkedInvoice.snapshot.creatorId);
                return (
                  <article className="request-resource-flat-row request-resource-invoice-row" key={linkedInvoice.invoiceId}>
                    <span className="project-contract-record-icon"><ReceiptText size={18} /></span>
                    <div><strong>{linkedInvoice.id}</strong><small>{linkedInvoice.status}</small></div>
                    <div><span>达人</span><strong>{creator?.name ?? linkedInvoice.snapshot.creatorName}</strong><small>{creator ? `${creator.handle} · ${creator.platform}` : linkedInvoice.snapshot.creatorHandle}</small></div>
                    <div><span>Invoice 金额</span><strong>{formatInvoiceMoney(linkedInvoice.snapshot.currency, invoiceTotal(linkedInvoice.snapshot))}</strong><small>{linkedInvoice.snapshot.contractIds?.length ?? 0} 份覆盖合同</small></div>
                    <span className={`project-record-status${linkedInvoice.validationStatus === 'valid' ? '' : ' is-warning'}`}><i />{linkedInvoice.validationStatus === 'valid' ? '已通过' : '需重新校验'}</span>
                    <div className="project-contract-record-actions"><Button variant="secondary" icon={<Eye size={14} />} onClick={() => onOpenInvoice?.(linkedInvoice.invoiceId)}>查看</Button></div>
                  </article>
                );
              })}
            </div>
          </div>
        </Modal>
      ) : null}

      {!isReturned && returnDialogOpen ? (
        <Modal
          title="退回媒介修改"
          width="580px"
          onClose={() => setReturnDialogOpen(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setReturnDialogOpen(false)}>取消</Button>
              <Button variant="danger" disabled={!returnReason.trim()} onClick={submitReturn}>确认退回</Button>
            </>
          )}
        >
          <div className="payment-execution-return-content">
            <div className="payment-execution-return-heading">
              <AlertTriangle size={20} />
              <div>
                <strong>退回后将由媒介修改请款资料</strong>
                <p>媒介重新提交后，请款将回到财务审批节点，并保留本次退回原因。</p>
              </div>
            </div>
            <label className="payment-execution-return-field">
              <span>退回原因 <em>*</em></span>
              <textarea
                autoFocus
                rows={5}
                value={returnReason}
                placeholder="请说明需要媒介修改或补充的内容"
                onChange={(event) => setReturnReason(event.target.value)}
              />
              <small>退回原因会同步到请款项目详情与审批记录。</small>
            </label>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
