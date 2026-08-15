import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  Landmark,
  ListChecks,
  LoaderCircle,
  ReceiptText,
  ShieldCheck,
  UserRoundCheck,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  paymentListEffectiveAccount,
  paymentListItemValue,
  type PaymentListId,
  type PaymentListRecord,
} from '../businessWorkflow';
import type {
  FinanceReviewField,
  FinanceReviewPage,
  RequestFinanceReview,
} from '../financeReview';
import { bankAddress, formatInvoiceMoney } from '../invoice/invoiceUtils';
import {
  reviewPaymentListAccountSnapshot,
  validatePaymentListAccountViaApi,
  type PaymentAccountApiValidation,
} from '../requestPaymentAccountValidation';
import type { CreatorProfile } from '../types';
import { Button } from './Common';

type RequestPaymentAccountCheck = PaymentAccountApiValidation | {
  state: 'checking';
  message: string;
};

type AccountDisplayMode = 'all-summary' | 'current-full';
type ExportMode = 'all' | 'current';
type ReviewContentVariant = 'project' | 'finance-workspace';

const FINANCE_WORKSPACE_COMPARISON_FIELD_IDS = new Set([
  'amount',
  'real-name',
  'account-name',
  'account-number',
  'bank-name',
  'bank-address',
  'swift-code',
  'iban',
  'reason',
  'fee',
  'reference',
]);

export const financeWorkspaceComparisonFields = (
  page: FinanceReviewPage,
  accountDisplay: AccountDisplayMode,
) => (
  accountDisplay === 'current-full' && page.kind === 'pair'
    ? page.fields.filter((field) => FINANCE_WORKSPACE_COMPARISON_FIELD_IDS.has(field.id))
    : page.fields
);

const paymentListStatusLabel = (paymentList: PaymentListRecord | null) => {
  if (!paymentList) return '未生成';
  if (paymentList.status === 'paid') return '已付款';
  if (paymentList.status === 'approved') return '已批准';
  if (paymentList.status === 'submitted') return '已提交';
  if (paymentList.status === 'generated') return '已生成';
  return '草稿';
};

const feeBearerLabel = (value: unknown) => {
  if (value === 'ADVERTISER') return '付款方承担';
  if (value === 'PUBLISHER') return '收款方承担';
  if (value === 'SHARED') return '共同承担';
  return '待确认';
};

const transferMethodLabel = (
  transferMethod: ReturnType<typeof paymentListEffectiveAccount>['transferMethod'],
  localClearingSystem?: string,
) => {
  if (transferMethod === 'PAYPAL') return 'PayPal';
  if (transferMethod === 'SWIFT') return 'SWIFT 转账';
  if (transferMethod === 'LOCAL') {
    return localClearingSystem ? `本地转账 · ${localClearingSystem}` : '本地转账';
  }
  return '待确认';
};

const displayValue = (value: unknown) => (
  value === undefined || value === null || value === '' ? '未填写' : String(value)
);

const recipientAccountName = (
  account: ReturnType<typeof paymentListEffectiveAccount>,
  fallbackName?: string,
) => {
  const details = account.paymentDetails;
  if (account.transferMethod === 'PAYPAL') {
    return details?.paypalUsername || details?.accountName || fallbackName || '未填写';
  }
  return details?.accountName || fallbackName || '未填写';
};

const fieldStateLabel = (field?: FinanceReviewField) => {
  if (field?.state === 'match') return '一致';
  if (field?.state === 'mismatch') return '不一致';
  if (field?.state === 'warning') return field.warning ?? '合同信息需核对';
  if (field?.state === 'review') return '人工核对（默认通过）';
  return '人工核对';
};

export function PaymentListReviewContent({
  paymentLists,
  creators,
  financeReview,
  pages = financeReview.invoices,
  activeIndex,
  onActiveIndexChange,
  onExportPaymentList,
  accountDisplay = 'all-summary',
  exportMode = 'all',
  variant = 'project',
  className = '',
}: {
  paymentLists: PaymentListRecord[];
  creators: CreatorProfile[];
  financeReview: RequestFinanceReview;
  pages?: FinanceReviewPage[];
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  onExportPaymentList: (paymentListId: PaymentListId) => Promise<void>;
  accountDisplay?: AccountDisplayMode;
  exportMode?: ExportMode;
  variant?: ReviewContentVariant;
  className?: string;
}) {
  const [accountChecks, setAccountChecks] = useState<Record<string, RequestPaymentAccountCheck>>({});
  const [validating, setValidating] = useState(false);
  const [localIndex, setLocalIndex] = useState(0);
  const [pendingAccountFocusKey, setPendingAccountFocusKey] = useState<string | null>(null);
  const maxIndex = Math.max(0, pages.length - 1);
  const reviewIndex = Math.min(activeIndex ?? localIndex, maxIndex);
  const currentReview = pages[reviewIndex];
  const currentReviewFields = currentReview
    ? financeWorkspaceComparisonFields(currentReview, accountDisplay)
    : [];
  const rows = useMemo(() => paymentLists.flatMap((list) => list.items.map((item) => ({
    key: `${list.paymentListId}-${item.id}`,
    list,
    item,
    effectiveAccount: paymentListEffectiveAccount(item),
    snapshotReview: reviewPaymentListAccountSnapshot(item, creators),
  }))), [creators, paymentLists]);
  const rowByReference = useMemo(() => new Map(rows.map((row) => [
    `${row.list.paymentListId}:${row.item.id}`,
    row,
  ])), [rows]);
  const reviewIndexByReference = useMemo(() => new Map(pages.flatMap((page, index) => (
    page.paymentItems.map((reference) => [
      `${reference.paymentListId}:${reference.itemId}`,
      index,
    ] as const)
  ))), [pages]);
  const currentRows = currentReview?.paymentItems.flatMap((reference) => {
    const row = rowByReference.get(`${reference.paymentListId}:${reference.itemId}`);
    return row ? [row] : [];
  }) ?? [];
  const visibleAccountRows = accountDisplay === 'current-full' ? currentRows : rows;
  const snapshotAttentionCount = rows.filter((row) => row.snapshotReview.state !== 'ready').length;
  const apiPassedCount = rows.filter((row) => accountChecks[row.key]?.state === 'passed').length;
  const apiIssueCount = rows.filter((row) => (
    ['invalid', 'unavailable'].includes(accountChecks[row.key]?.state ?? '')
  )).length;
  const accountAttentionRows = useMemo(() => rows.flatMap((row) => {
    const check = accountChecks[row.key];
    const issues = [
      ...(row.snapshotReview.state === 'ready' ? [] : row.snapshotReview.issues),
      ...(check && ['invalid', 'unavailable'].includes(check.state) ? [check.message] : []),
    ];
    if (!issues.length) return [];
    return [{
      key: row.key,
      accountName: recipientAccountName(row.effectiveAccount, row.item.snapshot.realName),
      creatorName: row.item.snapshot.creatorName,
      invoiceNumber: row.item.snapshot.invoiceNumber,
      issue: [...new Set(issues)].join('；'),
      reviewIndex: reviewIndexByReference.get(`${row.list.paymentListId}:${row.item.id}`),
    }];
  }), [accountChecks, reviewIndexByReference, rows]);
  const allApiChecksPassed = rows.length > 0
    && apiPassedCount === rows.length
    && snapshotAttentionCount === 0;
  const currentListIds = [...new Set(currentReview?.paymentItems.map((item) => item.paymentListId) ?? [])];
  const exportLists = exportMode === 'current'
    ? paymentLists.filter((list) => currentListIds.includes(list.paymentListId))
    : paymentLists;

  useEffect(() => {
    if (activeIndex === undefined) setLocalIndex((current) => Math.min(current, maxIndex));
  }, [activeIndex, maxIndex]);

  useEffect(() => {
    if (!pendingAccountFocusKey) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`finance-payment-account-${pendingAccountFocusKey}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target?.focus({ preventScroll: true });
      setPendingAccountFocusKey(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingAccountFocusKey, reviewIndex]);

  const setReviewIndex = (nextIndex: number) => {
    const normalized = Math.min(Math.max(0, nextIndex), maxIndex);
    if (activeIndex === undefined) setLocalIndex(normalized);
    onActiveIndexChange?.(normalized);
  };

  const focusAccountReview = (row: (typeof accountAttentionRows)[number]) => {
    if (row.reviewIndex === undefined) return;
    setPendingAccountFocusKey(row.key);
    setReviewIndex(row.reviewIndex);
  };

  const validateAccounts = async () => {
    if (!rows.length || validating) return;
    setValidating(true);
    setAccountChecks(Object.fromEntries(rows.map((row) => [row.key, {
      state: 'checking',
      message: '正在请求收款账户校验 API',
    }])));
    const results = await Promise.all(rows.map(async (row) => [
      row.key,
      await validatePaymentListAccountViaApi({ item: row.item, creators }),
    ] as const));
    setAccountChecks(Object.fromEntries(results));
    setValidating(false);
  };

  const summaryTitle = validating
    ? '正在校验收款账户'
    : allApiChecksPassed
      ? '全部收款账户已通过 API 校验'
      : apiIssueCount
        ? `${apiIssueCount} 笔 API 校验未通过`
        : snapshotAttentionCount
          ? `${snapshotAttentionCount} 笔账户快照需要处理`
          : '账户快照完整，待 API 校验';

  const renderValidation = (row: (typeof rows)[number]) => {
    const check = accountChecks[row.key];
    const accountIssue = row.snapshotReview.issues[0];
    const message = check
      ? accountIssue && check.state !== 'checking'
        ? `${check.message}；${accountIssue}`
        : check.message
      : accountIssue || '账户快照完整，等待审批人执行 API 校验';
    const state = check?.state === 'passed' && row.snapshotReview.state === 'ready'
      ? 'is-passed'
      : check?.state === 'checking'
        ? 'is-checking'
        : row.snapshotReview.state !== 'ready'
          || ['invalid', 'unavailable'].includes(check?.state ?? '')
          ? 'is-warning'
          : '';
    return (
      <div className={`request-payment-account-check ${state}`} role="status" aria-live="polite">
        {check?.state === 'checking'
          ? <LoaderCircle className="is-spinning" size={14} />
          : state === 'is-passed'
            ? <CircleCheck size={14} />
            : state === 'is-warning'
              ? <CircleAlert size={14} />
              : <ShieldCheck size={14} />}
        <span>{message}</span>
      </div>
    );
  };

  return (
    <div className={`project-resource-browser payment-list-review-content ${className}`.trim()} data-testid="request-payment-list-review">
      {variant === 'project' ? (
        <div className="project-resource-browser-heading">
          <div className="finance-review-heading-with-icon">
            <span className="finance-review-card-title-icon is-payment" aria-hidden="true"><ListChecks size={15} /></span>
            <div>
              <strong>全部付款明细</strong>
              <p>每张 Invoice 保留独立付款行，内容来自“我的项目”提交时的冻结快照。</p>
            </div>
          </div>
          <span>{rows.length} 笔</span>
        </div>
      ) : null}

      {rows.length ? (
        <>
          {variant === 'project' ? (
            <div className="project-resource-browser-toolbar request-payment-review-toolbar">
              <Button
                variant="secondary"
                icon={validating ? <LoaderCircle className="is-spinning" size={15} /> : <ShieldCheck size={15} />}
                disabled={validating}
                onClick={() => { void validateAccounts(); }}
              >
                {validating ? '校验中' : '校验账户完整性'}
              </Button>
              {exportLists.map((list) => (
                <Button
                  variant="secondary"
                  icon={<Download size={15} />}
                  key={list.paymentListId}
                  onClick={() => { void onExportPaymentList(list.paymentListId); }}
                >
                  {exportLists.length === 1 ? '导出 Excel' : `导出 ${list.paymentListCode}`}
                </Button>
              ))}
              {exportMode === 'current' && exportLists.length === 0 ? (
                <Button variant="secondary" icon={<Download size={15} />} disabled>导出 Excel</Button>
              ) : null}
            </div>
          ) : null}

          <div
            className={`request-payment-review-summary${allApiChecksPassed ? ' is-passed' : snapshotAttentionCount || apiIssueCount ? ' is-warning' : ''}`}
            role="status"
            aria-live="polite"
          >
            <span>
              {validating
                ? <LoaderCircle className="is-spinning" size={18} />
                : allApiChecksPassed
                  ? <CircleCheck size={18} />
                  : snapshotAttentionCount || apiIssueCount
                    ? <CircleAlert size={18} />
                    : <ShieldCheck size={18} />}
            </span>
            <div>
              <strong>{summaryTitle}</strong>
              <p>审批前应核对冻结账户、币种、金额、费用承担与交易附言；API 校验只检查账户字段，不改写付款数据。</p>
              {accountDisplay === 'current-full' && accountAttentionRows.length ? (
                <ul className="request-payment-attention-list" aria-label="需要处理的收款账户">
                  {accountAttentionRows.map((row) => (
                    <li key={row.key}>
                      <span>
                        <strong>{row.creatorName}</strong>
                        <small>收款账户：{row.accountName} · {row.invoiceNumber}</small>
                        <small>{row.issue}</small>
                      </span>
                      <button
                        type="button"
                        disabled={row.reviewIndex === undefined}
                        aria-label={`核对 ${row.creatorName} 的收款账户`}
                        onClick={() => focusAccountReview(row)}
                      >
                        去核对<ArrowRight size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {variant === 'finance-workspace' ? (
              <Button
                className="request-payment-review-summary-action"
                variant="secondary"
                icon={validating ? <LoaderCircle className="is-spinning" size={15} /> : <ShieldCheck size={15} />}
                disabled={validating}
                onClick={() => { void validateAccounts(); }}
              >
                {validating ? '校验中' : '校验账户完整性'}
              </Button>
            ) : null}
          </div>

          {variant === 'project' ? (
            <div
              className={`request-finance-project-summary${financeReview.canApprove ? ' is-passed' : ' is-warning'}`}
              role="status"
            >
              <div className="finance-review-summary-heading"><span className="finance-review-card-title-icon is-validation" aria-hidden="true"><ShieldCheck size={14} /></span><strong>项目核对：{financeReview.matchedCount} / {financeReview.totalCount} 份 Invoice 关键字段一致</strong></div>
              <span>{financeReview.canApprove ? '可提交财务审批通过' : `存在 ${financeReview.mismatchCount} 项关键差异，需退回修改`}</span>
              {financeReview.warningCount ? <small>另有 {financeReview.warningCount} 项合同信息需核对（不阻断审批）</small> : null}
              {financeReview.projectIssues.map((issue) => (
                <small key={issue.id}>{issue.label}：{issue.paymentValue}</small>
              ))}
            </div>
          ) : null}

          {currentReview ? (
            <section className="request-finance-comparison" aria-label="合同、Invoice 与付款清单三方对照">
              <header className="request-finance-comparison-header">
                <div className="finance-review-comparison-title">
                  <span className="finance-review-card-title-icon is-invoice" aria-hidden="true"><ReceiptText size={14} /></span>
                  <div>
                    <strong>{currentReview.invoiceNumber}</strong>
                    <span>
                      {currentReview.creatorName} · {currentReview.mismatchCount ? `${currentReview.mismatchCount} 项不一致` : '关键字段一致'}
                      {currentReview.warningCount ? ` · ${currentReview.warningCount} 项合同信息需核对` : ''}
                    </span>
                  </div>
                </div>
                <div className="request-finance-navigator">
                  <span>{reviewIndex + 1} / {pages.length}</span>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="上一份 Invoice"
                    disabled={reviewIndex === 0}
                    onClick={() => setReviewIndex(reviewIndex - 1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="下一份 Invoice"
                    disabled={reviewIndex >= pages.length - 1}
                    onClick={() => setReviewIndex(reviewIndex + 1)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </header>
              <div className="table-scroll">
                <table className="request-finance-comparison-table">
                  <thead><tr><th>核对字段</th><th>合同</th><th>Invoice</th><th>付款清单</th><th>结果</th></tr></thead>
                  <tbody>
                    {currentReviewFields.map((field) => (
                      <tr key={field.id}>
                        <th>{field.label}</th>
                        <td>{field.contractValue}</td>
                        <td>{field.invoiceValue}</td>
                        <td>{field.paymentValue}</td>
                        <td>
                          <span className={`finance-match-state is-${field.state}`}>
                            {field.state === 'match' ? (
                              <>
                                <CircleCheck size={16} strokeWidth={2.4} aria-hidden="true" />
                                <span className="sr-only">一致</span>
                              </>
                            ) : fieldStateLabel(field)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {accountDisplay === 'current-full' ? (
            <section className="finance-payment-account-snapshots" aria-label="当前达人账户快照">
              <header>
                <div><span className="finance-review-card-title-icon is-account" aria-hidden="true"><Landmark size={14} /></span><span><strong>当前达人账户快照</strong><small>当前账户字段为原型展示，具体字段需调用 Airwallex API</small></span></div>
                <span>{visibleAccountRows.length} 条</span>
              </header>
              {visibleAccountRows.length ? visibleAccountRows.map((row) => {
                const fieldById = new Map(currentReview?.fields.map((field) => [field.id, field]) ?? []);
                const details = row.effectiveAccount.paymentDetails;
                const currency = String(paymentListItemValue(row.item, 'currency') || '待确认');
                const amount = Number(paymentListItemValue(row.item, 'amount') || 0);
                const accountName = recipientAccountName(row.effectiveAccount, row.item.snapshot.realName);
                const accountFields = [
                  { id: 'real-name', label: 'Real Name', value: row.item.snapshot.realName },
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
                  <article
                    className="finance-payment-account-snapshot"
                    id={`finance-payment-account-${row.key}`}
                    key={row.key}
                    tabIndex={-1}
                  >
                    <header>
                      <div><span className="finance-review-card-title-icon is-creator" aria-hidden="true"><UserRoundCheck size={14} /></span><span><strong>{row.item.snapshot.creatorName}</strong><small>{row.item.snapshot.invoiceNumber} · {row.list.paymentListCode} · {row.effectiveAccount.provider}</small></span></div>
                      <span className="project-record-status"><i />{paymentListStatusLabel(row.list)}</span>
                    </header>
                    {renderValidation(row)}
                    <dl className="finance-payment-account-fields">
                      {accountFields.map((accountField) => {
                        const reviewField = fieldById.get(accountField.id);
                        return (
                          <div className={`is-${reviewField?.state ?? 'review'}`} key={accountField.id}>
                            <dt>
                              <span>{accountField.label}</span>
                              <em>
                                {reviewField?.state === 'match' ? (
                                  <>
                                    <CircleCheck size={16} strokeWidth={2.4} aria-hidden="true" />
                                    <span className="sr-only">一致</span>
                                  </>
                                ) : fieldStateLabel(reviewField)}
                              </em>
                            </dt>
                            <dd>{displayValue(reviewField?.paymentValue ?? accountField.value)}</dd>
                          </div>
                        );
                      })}
                    </dl>
                    <dl className="request-payment-review-fields finance-payment-operational-fields">
                      <div className="request-payment-review-account"><dt>收款账户</dt><dd>{displayValue(accountName)}</dd><small>{transferMethodLabel(row.effectiveAccount.transferMethod, row.effectiveAccount.localClearingSystem)}</small></div>
                      <div><dt>支付币种</dt><dd>{currency}</dd></div>
                      <div><dt>收款币种</dt><dd>{displayValue(paymentListItemValue(row.item, 'receiveCurrency'))}</dd></div>
                      <div><dt>付款金额</dt><dd>{formatInvoiceMoney(currency, amount)}</dd></div>
                      <div><dt>费用承担</dt><dd>{feeBearerLabel(paymentListItemValue(row.item, 'feeBearer'))}</dd></div>
                      <div><dt>付款原因</dt><dd>{displayValue(paymentListItemValue(row.item, 'paymentReason'))}</dd></div>
                      <div className="request-payment-review-reference"><dt>交易附言</dt><dd>{displayValue(paymentListItemValue(row.item, 'transactionReference'))}</dd></div>
                    </dl>
                  </article>
                );
              }) : (
                <div className="project-resource-browser-empty finance-payment-account-empty">
                  <WalletCards size={23} />
                  <strong>当前页没有付款账户快照</strong>
                  <p>请核对缺失或额外付款明细，并记录有误原因。</p>
                </div>
              )}
            </section>
          ) : (
            <div className="project-payment-rows request-payment-flat-rows">
              {visibleAccountRows.map((row) => {
                const currency = String(paymentListItemValue(row.item, 'currency') || '待确认');
                const amount = Number(paymentListItemValue(row.item, 'amount') || 0);
                const check = accountChecks[row.key];
                const updatedAt = check?.state === 'passed'
                  ? check.checkedAt
                  : row.item.lastValidatedAt ?? row.list.generatedAt ?? row.list.updatedAt;
                return (
                  <article className="project-payment-row request-payment-review-row" key={row.key}>
                    <header className="project-payment-row-header">
                      <div><strong>{row.item.snapshot.creatorName}</strong><span>{row.item.snapshot.invoiceNumber} · {row.list.paymentListCode} · {row.effectiveAccount.provider}</span></div>
                      <span className="project-record-status"><i />{paymentListStatusLabel(row.list)}</span>
                    </header>
                    {renderValidation(row)}
                    <dl className="request-payment-review-fields">
                      <div className="request-payment-review-account"><dt>收款账户</dt><dd>{row.effectiveAccount.accountSummary || '待补充'}</dd><small>{transferMethodLabel(row.effectiveAccount.transferMethod, row.effectiveAccount.localClearingSystem)}</small></div>
                      <div><dt>支付币种</dt><dd>{currency}</dd></div>
                      <div><dt>收款币种</dt><dd>{displayValue(paymentListItemValue(row.item, 'receiveCurrency'))}</dd></div>
                      <div><dt>付款金额</dt><dd>{formatInvoiceMoney(currency, amount)}</dd></div>
                      <div><dt>费用承担</dt><dd>{feeBearerLabel(paymentListItemValue(row.item, 'feeBearer'))}</dd></div>
                      <div><dt>付款原因</dt><dd>{displayValue(paymentListItemValue(row.item, 'paymentReason'))}</dd></div>
                      <div className="request-payment-review-reference"><dt>交易附言</dt><dd>{displayValue(paymentListItemValue(row.item, 'transactionReference'))}</dd></div>
                    </dl>
                    <footer className="project-payment-row-meta">
                      <span>{paymentListStatusLabel(row.list)} · v{row.list.version ?? 1}</span>
                      <span>Invoice {row.item.snapshot.invoiceNumber}</span>
                      <span>{row.item.snapshot.contractIds?.length ? `${row.item.snapshot.contractIds.length} 份合同` : '未关联合同'}</span>
                      <span>{updatedAt ? `校验时间 ${new Date(updatedAt).toLocaleString('zh-CN')}` : '尚未校验'}</span>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="project-resource-browser-empty">
          <WalletCards size={23} />
          <strong>付款清单尚未生成</strong>
          <p>当前请款项目没有可供审批查看的付款清单快照。</p>
        </div>
      )}
    </div>
  );
}
