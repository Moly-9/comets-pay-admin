import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  Clock3,
  FileText,
  Landmark,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  financeReviewReturnReason,
  financeReviewSessionCanApprove,
  reconcileFinanceReviewSession,
  setFinanceReviewDecision,
  type FinanceReviewField,
  type FinanceReviewPage,
  type FinanceReviewSession,
  type RequestFinanceReview,
} from '../financeReview';
import {
  paymentListEffectiveAccount,
  paymentListItemValue,
  type PaymentListRecord,
  type RequestApprovalStage,
} from '../businessWorkflow';
import { bankAddress, formatInvoiceMoney } from '../invoice/invoiceUtils';
import { requestApprovalStage } from '../requestApprovalWorkflow';
import type { SystemUser } from '../data';
import type { GeneratedInvoiceRecord } from '../types';
import type { RequestProjectSummary } from '../pages/RequestProjectDetailPage';
import { InvoiceDocumentView } from './InvoiceDocumentView';
import { Button, Modal } from './Common';

type FinanceReviewPane = 'invoice' | 'payment' | 'approval';

const REVIEW_PANE_OPTIONS: Array<{
  id: FinanceReviewPane;
  label: string;
}> = [
  { id: 'invoice', label: 'Invoice' },
  { id: 'payment', label: '付款明细' },
  { id: 'approval', label: '审批流' },
];

const ACCOUNT_REVIEW_FIELD_IDS = new Set([
  'real-name',
  'account-name',
  'account-number',
  'bank-name',
  'bank-address',
  'swift-code',
  'iban',
]);

const PAGE_KIND_LABEL: Record<FinanceReviewPage['kind'], string> = {
  pair: '一一对应',
  'missing-invoice': '缺少 Invoice',
  'missing-payment': '缺少付款明细',
  'duplicate-payment': '重复付款明细',
  'extra-payment': '额外付款明细',
  'empty-request': '未关联资料',
};

const STAGE_LABEL: Record<RequestApprovalStage, string> = {
  PM: 'PM 审批',
  PROJECT_OWNER: '项目负责人审批',
  OWNER: '老板审批',
  FINANCE: '财务审批',
};

const formatReviewTime = (value?: string) => {
  if (!value) return '待处理';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const initialsFor = (value: string) => {
  const normalized = value.trim().replace(/^@/, '');
  if (!normalized) return '--';
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return normalized.slice(0, 2).toUpperCase();
};

const paymentMethodLabel = (list: PaymentListRecord, transferMethod?: string) => (
  list.provider === 'PayPal' || transferMethod === 'PAYPAL' ? 'PayPal' : '银行转账'
);

const feeBearerLabel = (value: unknown) => {
  if (value === 'ADVERTISER') return '广告主承担';
  if (value === 'PUBLISHER') return '收款方承担';
  if (value === 'SHARED') return '双方分担';
  return String(value || '待确认');
};

const reviewStatusLabel = (state: 'unreviewed' | 'correct' | 'incorrect') => {
  if (state === 'correct') return '已确认无误';
  if (state === 'incorrect') return '已记录有误';
  return '待核对';
};

const paymentValue = (value: unknown) => (
  value === undefined || value === null || value === '' ? '未填写' : String(value)
);

const accountReviewState = (field?: FinanceReviewField) => {
  if (field?.state === 'mismatch') return 'mismatch';
  if (field?.state === 'match') return 'match';
  return 'review';
};

function ApprovalTimeline({
  request,
  currentUser,
}: {
  request: RequestProjectSummary;
  currentUser: SystemUser;
}) {
  const approval = request.approval;
  if (!approval) {
    return (
      <div className="finance-review-empty finance-review-empty-compact">
        <Clock3 size={22} />
        <strong>审批流尚未开始</strong>
      </div>
    );
  }
  const currentStage = requestApprovalStage(approval.status);
  const stageOrder: RequestApprovalStage[] = ['PM', 'PROJECT_OWNER', 'OWNER', 'FINANCE'];
  const steps = [
    {
      id: 'submitted',
      label: '请款提交',
      description: `第 ${approval.round} 轮审批已提交`,
      state: 'complete' as const,
      actorName: request.media,
      actorMeta: '媒介账号',
      time: approval.submittedAt,
    },
    ...stageOrder.map((stage) => {
      const event = [...approval.history].reverse().find((candidate) => (
        candidate.round === approval.round && candidate.stage === stage
      ));
      const isCurrent = currentStage === stage;
      const state = event?.action === 'APPROVE'
        ? 'complete' as const
        : isCurrent
          ? 'current' as const
          : 'pending' as const;
      const fallbackName = stage === 'PM'
        ? request.pm
        : stage === 'FINANCE' && isCurrent
          ? currentUser.name
          : STAGE_LABEL[stage].replace('审批', '');
      return {
        id: stage,
        label: STAGE_LABEL[stage],
        description: event?.action === 'APPROVE'
          ? '当前轮次已审批通过'
          : event?.action === 'RETURN'
            ? '已退回媒介修改'
            : isCurrent
              ? '等待当前节点处理'
              : '上一节点通过后进入',
        state,
        actorName: event?.actorName ?? fallbackName,
        actorMeta: event ? `${event.actorRole} · @${event.actorAccount}` : STAGE_LABEL[stage],
        time: event?.occurredAt ?? (isCurrent ? approval.updatedAt : undefined),
      };
    }),
    {
      id: 'payment',
      label: '渠道付款',
      description: '全部审批完成后执行',
      state: 'pending' as const,
      actorName: '付款渠道',
      actorMeta: 'Airwallex / PayPal',
      time: undefined,
    },
  ];

  return (
    <div className="finance-approval-timeline" aria-label="当前审批流">
      {steps.map((step) => (
        <article className={`finance-approval-step is-${step.state}`} key={step.id}>
          <span className="finance-approval-node" aria-hidden="true">
            {step.state === 'complete'
              ? <Check size={13} />
              : step.state === 'current'
                ? <Clock3 size={13} />
                : <Circle size={11} />}
          </span>
          <div className="finance-approval-stage">
            <div>
              <strong>{step.label}</strong>
              <span>{step.state === 'complete' ? '已完成' : step.state === 'current' ? '待审核' : '待处理'}</span>
            </div>
            <p>{step.description}</p>
          </div>
          <div className="finance-approval-actor">
            <span>{initialsFor(step.actorName)}</span>
            <div><strong>{step.actorName}</strong><small>{step.actorMeta}</small></div>
          </div>
          <time>{formatReviewTime(step.time)}</time>
        </article>
      ))}
    </div>
  );
}

export function FinanceReviewWorkspace({
  request,
  financeReview,
  generatedInvoices,
  paymentLists,
  currentUser,
  session,
  onSessionChange,
  onApprove,
  onReturn,
  onClose,
}: {
  request: RequestProjectSummary;
  financeReview: RequestFinanceReview;
  generatedInvoices: GeneratedInvoiceRecord[];
  paymentLists: PaymentListRecord[];
  currentUser: SystemUser;
  session?: FinanceReviewSession;
  onSessionChange: (session: FinanceReviewSession) => void;
  onApprove: () => boolean;
  onReturn: (reason: string) => boolean;
  onClose: (completed?: boolean) => void;
}) {
  const activeSession = reconcileFinanceReviewSession(session, {
    requestId: request.id,
    approvalRound: request.approval?.round ?? 0,
    reviewerAccount: currentUser.account,
    review: financeReview,
  });
  const firstPendingIndex = Math.max(0, financeReview.pages.findIndex((page) => (
    activeSession.decisions[page.key]?.state !== 'correct'
  )));
  const [reviewIndex, setReviewIndex] = useState(firstPendingIndex);
  const [activePane, setActivePane] = useState<FinanceReviewPane>('invoice');
  const [issueEditorOpen, setIssueEditorOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [issueReason, setIssueReason] = useState('');

  useEffect(() => {
    setReviewIndex((current) => Math.min(current, Math.max(0, financeReview.pages.length - 1)));
  }, [financeReview.fingerprint, financeReview.pages.length]);

  const currentPage = financeReview.pages[reviewIndex];
  const currentDecision = currentPage
    ? activeSession.decisions[currentPage.key] ?? { state: 'unreviewed' as const }
    : { state: 'unreviewed' as const };
  const invoice = currentPage
    ? generatedInvoices.find((record) => record.invoiceId === currentPage.invoiceId)
    : undefined;
  const paymentRows = useMemo(() => currentPage?.paymentItems.flatMap((reference) => {
    const list = paymentLists.find((candidate) => candidate.paymentListId === reference.paymentListId);
    const item = list?.items.find((candidate) => candidate.id === reference.itemId);
    return list && item ? [{ list, item, account: paymentListEffectiveAccount(item) }] : [];
  }) ?? [], [currentPage, paymentLists]);
  const comparisonFields = currentPage?.fields.filter((field) => !ACCOUNT_REVIEW_FIELD_IDS.has(field.id)) ?? [];
  const counts = financeReview.pages.reduce((result, page) => {
    const state = activeSession.decisions[page.key]?.state ?? 'unreviewed';
    return { ...result, [state]: result[state] + 1 };
  }, { correct: 0, incorrect: 0, unreviewed: 0 });
  const canApprove = financeReviewSessionCanApprove(activeSession, financeReview);
  const returnReason = financeReviewReturnReason(activeSession, financeReview);

  const goTo = (nextIndex: number) => {
    setReviewIndex(Math.min(Math.max(0, nextIndex), Math.max(0, financeReview.pages.length - 1)));
    setActivePane('invoice');
  };

  const openIssueEditor = () => {
    setIssueReason(currentDecision.state === 'incorrect' ? currentDecision.reason : '');
    setIssueEditorOpen(true);
  };

  const saveIssue = () => {
    if (!currentPage || !issueReason.trim()) return;
    onSessionChange(setFinanceReviewDecision(activeSession, currentPage.key, {
      state: 'incorrect',
      reason: issueReason.trim(),
      reviewedAt: new Date().toISOString(),
    }));
    setIssueEditorOpen(false);
  };

  const confirmCurrentPage = () => {
    if (!currentPage || currentPage.mismatchCount > 0) return;
    const nextSession = setFinanceReviewDecision(activeSession, currentPage.key, {
      state: 'correct',
      reviewedAt: new Date().toISOString(),
    });
    onSessionChange(nextSession);
    const nextPending = financeReview.pages.findIndex((page, index) => (
      index > reviewIndex && nextSession.decisions[page.key]?.state !== 'correct'
    ));
    const firstPending = financeReview.pages.findIndex((page) => (
      nextSession.decisions[page.key]?.state !== 'correct'
    ));
    const target = nextPending >= 0 ? nextPending : firstPending;
    if (target >= 0) goTo(target);
  };

  const submitApproval = () => {
    if (canApprove && onApprove()) onClose(true);
  };

  const submitReturn = () => {
    if (returnReason && onReturn(returnReason)) onClose(true);
  };

  return (
    <>
      <Modal
        title={`${request.requestCode ?? request.id} · 财务审核`}
        width="100vw"
        className="finance-review-workspace"
        onClose={() => onClose(false)}
        onBackdropMouseDown={() => undefined}
        footer={(
          <div className="finance-review-footer">
            <div className="finance-review-footer-summary" aria-live="polite">
              <strong>{counts.correct} / {financeReview.pageCount}</strong>
              <span>{counts.incorrect ? `${counts.incorrect} 份有误` : `${counts.unreviewed} 份待核对`}</span>
            </div>
            <div className="finance-review-page-nav">
              <button
                className="icon-button"
                type="button"
                aria-label="上一份 Invoice"
                disabled={reviewIndex === 0}
                onClick={() => goTo(reviewIndex - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <span>{financeReview.pageCount ? reviewIndex + 1 : 0} / {financeReview.pageCount}</span>
              <button
                className="icon-button"
                type="button"
                aria-label="下一份 Invoice"
                disabled={reviewIndex >= financeReview.pageCount - 1}
                onClick={() => goTo(reviewIndex + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="finance-review-footer-actions">
              <Button
                variant="secondary"
                icon={<CircleAlert size={16} />}
                disabled={!currentPage}
                onClick={openIssueEditor}
              >
                {currentDecision.state === 'incorrect' ? '编辑有误记录' : '记录有误'}
              </Button>
              <Button
                variant="secondary"
                icon={<CheckCircle2 size={16} />}
                disabled={!currentPage || currentPage.mismatchCount > 0}
                onClick={confirmCurrentPage}
              >
                确认本页无误
              </Button>
              {counts.incorrect > 0 ? (
                <Button variant="danger" icon={<AlertTriangle size={16} />} onClick={() => setReturnDialogOpen(true)}>
                  退回媒介修改
                </Button>
              ) : null}
              <Button icon={<ShieldCheck size={16} />} disabled={!canApprove} onClick={submitApproval}>
                通过财务审核
              </Button>
            </div>
          </div>
        )}
      >
        <div className="finance-review-shell" data-testid="finance-review-workspace">
          <header className="finance-review-overview">
            <div className="finance-review-title-group">
              <span className="finance-review-title-icon"><ShieldCheck size={19} /></span>
              <div>
                <strong>{request.cooperationProjectName ?? request.project}</strong>
                <span>{currentPage?.invoiceNumber ?? '暂无可审核记录'} · {currentPage?.creatorName ?? '待补充'}</span>
              </div>
            </div>
            <div className="finance-review-counts" aria-live="polite">
              <span className="is-correct"><CheckCircle2 size={14} />已确认 {counts.correct}</span>
              <span className="is-incorrect"><CircleAlert size={14} />有误 {counts.incorrect}</span>
              <span><Clock3 size={14} />未审核 {counts.unreviewed}</span>
            </div>
            <span className={`finance-review-current-state is-${currentDecision.state}`}>
              {reviewStatusLabel(currentDecision.state)}
            </span>
          </header>

          <div className="finance-review-mobile-tabs" role="tablist" aria-label="财务审核内容">
            {REVIEW_PANE_OPTIONS.map((option) => (
              <button
                className={activePane === option.id ? 'is-active' : ''}
                type="button"
                role="tab"
                aria-selected={activePane === option.id}
                key={option.id}
                onClick={() => setActivePane(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="finance-review-grid">
            <section className={`finance-review-pane finance-review-invoice-pane${activePane === 'invoice' ? ' is-mobile-active' : ''}`}>
              <header className="finance-review-pane-header">
                <div><FileText size={18} /><span><strong>Invoice 快照</strong><small>{currentPage?.invoiceNumber ?? '未关联'}.pdf · 1 页</small></span></div>
                {currentPage ? <span className={`finance-review-kind is-${currentPage.kind}`}>{PAGE_KIND_LABEL[currentPage.kind]}</span> : null}
              </header>
              <div className="finance-review-invoice-canvas">
                {invoice ? (
                  <InvoiceDocumentView model={invoice.snapshot} ariaLabel={`${invoice.id} Invoice 冻结快照`} />
                ) : (
                  <div className="finance-review-empty">
                    <ReceiptText size={30} />
                    <strong>未找到 Invoice 快照</strong>
                    <p>{currentPage?.invoiceNumber ?? '当前请款没有可审核的 Invoice。'}</p>
                  </div>
                )}
              </div>
            </section>

            <section className={`finance-review-pane finance-review-payment-pane${activePane === 'payment' ? ' is-mobile-active' : ''}`}>
              <header className="finance-review-pane-header">
                <div><WalletCards size={18} /><span><strong>付款明细</strong><small>{paymentRows.length} 条冻结记录</small></span></div>
                {currentPage?.mismatchCount
                  ? <span className="finance-review-warning-count"><CircleAlert size={13} />关键字段不一致 · {currentPage.mismatchCount} 项</span>
                  : <span className="finance-review-match-count"><CheckCircle2 size={13} />关键字段一致</span>}
              </header>
              <div className="finance-review-payment-scroll">
                {paymentRows.length ? paymentRows.map(({ list, item, account }) => {
                  const currency = String(paymentListItemValue(item, 'currency') || 'USD');
                  const amount = Number(paymentListItemValue(item, 'amount') || 0);
                  const details = account.paymentDetails;
                  const fieldById = new Map(currentPage?.fields.map((field) => [field.id, field]) ?? []);
                  const accountFields = [
                    { id: 'real-name', label: 'Real Name', value: item.snapshot.realName },
                    { id: 'account-name', label: 'Account Name', value: details?.accountName },
                    { id: 'account-number', label: 'Account Number', value: details?.accountNumber },
                    { id: 'bank-name', label: 'Beneficiary Bank Name', value: details?.bankName },
                    {
                      id: 'bank-address',
                      label: 'Beneficiary Bank Address',
                      value: details ? bankAddress({ payment: details }) : undefined,
                    },
                    { id: 'swift-code', label: 'Swift Code', value: details?.swiftCode },
                    { id: 'iban', label: 'IBAN (optional)', value: details?.iban },
                  ];
                  return (
                    <article className="finance-review-payment-card" key={`${list.paymentListId}:${item.id}`}>
                      <header>
                        <span className="finance-review-payee-avatar"><Landmark size={17} /></span>
                        <div><strong>{item.snapshot.creatorName}</strong><small>{item.snapshot.invoiceNumber} · {list.paymentListCode}</small></div>
                        <span>{list.status === 'submitted' ? '待财务审核' : list.status}</span>
                      </header>
                      <dl className="finance-review-payment-form" aria-label={`${item.snapshot.creatorName} 付款信息`}>
                        <div className="is-half"><dt>收款账户</dt><dd><Landmark size={13} />{paymentValue(details?.accountName || account.provider || list.provider)}</dd></div>
                        <div><dt>支付币种</dt><dd>{currency}</dd></div>
                        <div><dt>收款币种</dt><dd>{paymentValue(paymentListItemValue(item, 'receiveCurrency') || currency)}</dd></div>
                        <div className="is-half"><dt>金额</dt><dd className="is-money">{formatInvoiceMoney(currency, amount)}</dd></div>
                        <div className="is-half"><dt>费用承担</dt><dd>{feeBearerLabel(paymentListItemValue(item, 'feeBearer'))}</dd></div>
                        <div className="is-half"><dt>付款原因</dt><dd>{paymentValue(paymentListItemValue(item, 'paymentReason'))}</dd></div>
                        <div className="is-half"><dt>交易附言</dt><dd>{paymentValue(paymentListItemValue(item, 'transactionReference'))}</dd></div>
                        <div className="is-wide"><dt>描述（选填）</dt><dd>{paymentValue(paymentListItemValue(item, 'description'))}</dd></div>
                      </dl>

                      <section className="finance-review-account-details" aria-label="账户付款信息">
                        <header>
                          <div><Landmark size={15} /><span><strong>账户付款信息</strong><small>{paymentMethodLabel(list, account.transferMethod)} · {account.provider || list.provider}</small></span></div>
                        </header>
                        <dl>
                          {accountFields.map((accountField) => {
                            const reviewField = fieldById.get(accountField.id);
                            const state = accountReviewState(reviewField);
                            return (
                              <div className={`is-${state}`} key={accountField.id}>
                                <dt>
                                  <span>{accountField.label}</span>
                                  <span className="finance-review-account-field-state">
                                    {state === 'match' ? <CheckCircle2 size={12} /> : state === 'mismatch' ? <CircleAlert size={12} /> : <Clock3 size={12} />}
                                    {state === 'match' ? '一致' : state === 'mismatch' ? '不一致' : '待核对'}
                                  </span>
                                </dt>
                                <dd>{paymentValue(reviewField?.paymentValue ?? accountField.value)}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      </section>
                    </article>
                  );
                }) : (
                  <div className="finance-review-empty finance-review-empty-compact">
                    <WalletCards size={28} />
                    <strong>未找到付款明细</strong>
                    <p>当前 Invoice 没有一一对应的付款记录。</p>
                  </div>
                )}

                {currentPage && comparisonFields.length ? (
                  <section className="finance-review-comparison" aria-label="Invoice 与付款明细字段对照">
                    <header><strong>其他字段对照</strong><span>{comparisonFields.length} 项</span></header>
                    <div className="finance-review-comparison-list">
                      {comparisonFields.map((field) => (
                        <article className={`finance-review-field is-${field.state}`} key={field.id}>
                          <div className="finance-review-field-heading">
                            <strong>{field.label}</strong>
                            <span>
                              {field.state === 'match' ? <CheckCircle2 size={14} /> : field.state === 'mismatch' ? <CircleAlert size={14} /> : <Clock3 size={14} />}
                              {field.state === 'match' ? '一致' : field.state === 'mismatch' ? '不一致' : '人工核对'}
                            </span>
                          </div>
                          <dl>
                            <div><dt>Invoice</dt><dd>{field.invoiceValue}</dd></div>
                            <div><dt>付款明细</dt><dd>{field.paymentValue}</dd></div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </section>

            <aside className={`finance-review-pane finance-review-approval-pane${activePane === 'approval' ? ' is-mobile-active' : ''}`}>
              <header className="finance-review-pane-header">
                <div><ShieldCheck size={18} /><span><strong>当前审批流</strong><small>第 {request.approval?.round ?? 1} 轮</small></span></div>
              </header>
              <div className="finance-review-approval-scroll">
                <ApprovalTimeline request={request} currentUser={currentUser} />
                {currentDecision.state === 'incorrect' ? (
                  <section className="finance-review-recorded-issue">
                    <CircleAlert size={17} />
                    <div><strong>已记录有误</strong><p>{currentDecision.reason}</p></div>
                  </section>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </Modal>

      {issueEditorOpen && currentPage ? (
        <Modal
          title={`${currentPage.invoiceNumber} · 记录有误`}
          width="500px"
          onClose={() => setIssueEditorOpen(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setIssueEditorOpen(false)}>取消</Button>
              <Button variant="danger" disabled={!issueReason.trim()} onClick={saveIssue}>保存有误记录</Button>
            </>
          )}
        >
          <label className="finance-review-reason-field">
            <span>问题说明 <em>*</em></span>
            <textarea
              autoFocus
              rows={5}
              value={issueReason}
              placeholder="填写 Invoice 与付款明细不一致的具体内容"
              onChange={(event) => setIssueReason(event.target.value)}
            />
            <small>该说明会随其他有误记录一并退回媒介。</small>
          </label>
        </Modal>
      ) : null}

      {returnDialogOpen ? (
        <Modal
          title="退回媒介修改"
          width="580px"
          onClose={() => setReturnDialogOpen(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setReturnDialogOpen(false)}>取消</Button>
              <Button variant="danger" disabled={!returnReason} onClick={submitReturn}>确认退回</Button>
            </>
          )}
        >
          <div className="finance-review-return-summary">
            <div className="finance-review-return-heading">
              <AlertTriangle size={20} />
              <div><strong>共 {counts.incorrect} 份记录有误</strong><p>退回后将进入媒介复核，并保留以下汇总原因。</p></div>
            </div>
            <div className="finance-review-return-list">
              {financeReview.pages.flatMap((page) => {
                const decision = activeSession.decisions[page.key];
                return decision?.state === 'incorrect' ? (
                  <article key={page.key}><strong>{page.invoiceNumber}</strong><p>{decision.reason}</p></article>
                ) : [];
              })}
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
