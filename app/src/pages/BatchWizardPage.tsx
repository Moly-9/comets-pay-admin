import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { accountDisplayValue } from '../accountPresentation';
import {
  paymentListEffectiveAccount,
  paymentListItemValue,
  type PaymentListItem,
  type PaymentListRecord,
} from '../businessWorkflow';
import {
  createMockBatchSubmission,
  validatePayoutForBatch,
  type ExecutableBatchProvider,
  type MockBatchSubmission,
} from '../batchTransfers';
import { Button, PageHeading, SelectField, StatusMark, type SelectOption } from '../components/Common';
import {
  PaymentConfirmationDialog,
  type PaymentConfirmationRow,
} from '../components/PaymentConfirmationDialog';
import { PaymentCreatorIdentity } from '../components/PaymentCreatorIdentity';
import { paymentProviderDisplayName } from '../components/PaymentProviderBadge';
import { formatAmount } from '../data';
import {
  isPaymentFailureRetryCandidate,
  isPaymentFailureRetryReady,
  paymentFailureRecoveryLabel,
} from '../paymentFailureRecovery';
import {
  findPaymentListItemForPayout,
  paymentCreatorIdentityFromPayout,
  type PaymentCreatorIdentityData,
} from '../paymentCreatorIdentity';
import type { PaymentFeeBearer } from '../paymentFeeBearerPresentation';
import {
  DEFAULT_BATCH_FEE_BEARER,
  PAYMENT_FEE_BEARER_OPTIONS,
  paymentPreviewFor,
} from '../paymentPreview';
import type { CreatorProfile, GeneratedInvoiceRecord, InvoiceCurrency, Payout } from '../types';
import type { RequestProjectSummary } from './RequestProjectDetailPage';

const STEPS = ['选择付款', '校验资料', '选择渠道', '确认提交'];
const ALL_PROJECTS = 'all';
const PROVIDERS: Array<{
  id: ExecutableBatchProvider | 'PayMax';
  title: string;
  description: string;
  disabled?: boolean;
}> = [
  { id: 'Airwallex', title: 'Airwallex', description: 'LOCAL 与 SWIFT 按冻结快照执行' },
  { id: 'PayPal', title: 'PayPal', description: 'PayPal 独立成批，不进入 Airwallex' },
  { id: 'PayMax', title: 'Payer Max', description: '渠道保留，当前阶段不可执行', disabled: true },
];

const SOURCE_CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'HKD', 'SGD'].map((currency) => ({
  value: currency,
  label: currency,
}));

const FUNDING_ACCOUNTS: Record<ExecutableBatchProvider, Array<{ value: string; label: string; description: string }>> = {
  Airwallex: [
    { value: 'mock-awx-operating', label: 'Airwallex 运营资金账户', description: '模拟资金账户，不连接真实余额' },
    { value: 'mock-awx-reserve', label: 'Airwallex 备用资金账户', description: '模拟备用账户' },
  ],
  PayPal: [
    { value: 'mock-paypal-balance', label: 'PayPal Business Balance', description: '模拟 PayPal 资金账户' },
  ],
};

export type BatchWizardRequestProject = Pick<
  RequestProjectSummary,
  | 'id'
  | 'paymentRequestProjectId'
  | 'requestCode'
  | 'cooperationProjectId'
  | 'cooperationProjectCode'
  | 'cooperationProjectName'
  | 'projectId'
  | 'project'
>;

export type BatchWizardRow = {
  payout: Payout;
  request: BatchWizardRequestProject | null;
  requestKey: string;
  requestCode: string;
  cooperationProjectKey: string;
  cooperationProjectCode: string;
  cooperationProjectName: string;
  paymentItem?: PaymentListItem;
  creatorIdentity: PaymentCreatorIdentityData;
  accountSummary: string;
  accountVersion: string;
  accountProvider: string;
  sourcePaymentOrderKey: string;
};

const normalized = (value: unknown) => String(value ?? '').trim();

export const batchWizardRequestForPayout = (
  payout: Payout,
  requests: readonly BatchWizardRequestProject[],
) => requests.find((request) => (
  Boolean(payout.paymentRequestProjectId)
  && request.paymentRequestProjectId === payout.paymentRequestProjectId
)) ?? requests.find((request) => {
  const requestProjectId = normalized(request.cooperationProjectId ?? request.projectId);
  return Boolean(requestProjectId) && requestProjectId === normalized(payout.projectId);
}) ?? null;

const requestKeyFor = (payout: Payout, request: BatchWizardRequestProject | null) => (
  normalized(payout.paymentRequestProjectId ?? request?.paymentRequestProjectId)
  || `legacy:${normalized(request?.cooperationProjectId ?? request?.projectId ?? payout.projectId)}`
);

export const buildBatchWizardRows = ({
  payouts,
  requests,
  generatedInvoices,
  paymentLists,
  creators,
}: {
  payouts: readonly Payout[];
  requests: readonly BatchWizardRequestProject[];
  generatedInvoices: readonly GeneratedInvoiceRecord[];
  paymentLists: readonly PaymentListRecord[];
  creators: readonly CreatorProfile[];
}): BatchWizardRow[] => payouts.map((payout) => {
  const request = batchWizardRequestForPayout(payout, requests);
  const paymentItem = findPaymentListItemForPayout(payout, generatedInvoices, paymentLists);
  const paymentList = paymentItem
    ? paymentLists.find((list) => list.items.some((item) => item.invoiceId === paymentItem.invoiceId))
    : undefined;
  const creator = creators.find((candidate) => candidate.id === payout.creatorId);
  const effectiveAccount = paymentItem ? paymentListEffectiveAccount(paymentItem) : undefined;
  const usesProjectedCreatorUpdate = payout.paymentFailureRecovery?.readyReason === 'REVALIDATED'
    && Boolean(payout.paymentFailureRecovery.reportedPayoutAccountId)
    && payout.paymentFailureRecovery.reportedPayoutAccountId !== effectiveAccount?.payoutAccountId;
  const accountVersion = usesProjectedCreatorUpdate
    ? payout.paymentFailureRecovery?.reportedPayoutAccountVersion
    : effectiveAccount?.payoutAccountVersion
      ?? payout.paymentFailureRecovery?.reportedPayoutAccountVersion
      ?? payout.payoutAccountVersion;
  const cooperationProjectKey = normalized(
    request?.cooperationProjectId
    ?? request?.projectId
    ?? request?.cooperationProjectCode
    ?? payout.projectId,
  );
  return {
    payout,
    request,
    requestKey: requestKeyFor(payout, request),
    requestCode: normalized(request?.requestCode) || '待同步',
    cooperationProjectKey,
    cooperationProjectCode: normalized(request?.cooperationProjectCode ?? request?.projectId ?? payout.projectId) || '待同步',
    cooperationProjectName: normalized(request?.cooperationProjectName ?? request?.project ?? payout.project) || '待同步',
    paymentItem,
    creatorIdentity: paymentCreatorIdentityFromPayout({ payout, paymentItem, creator }),
    accountSummary: accountDisplayValue(
      usesProjectedCreatorUpdate ? payout.account : effectiveAccount?.accountSummary ?? payout.account,
    ),
    accountVersion: normalized(accountVersion) || 'legacy-v1',
    accountProvider: paymentProviderDisplayName(
      ((usesProjectedCreatorUpdate ? payout.provider : effectiveAccount?.provider) || payout.provider) as Payout['provider'],
    ),
    sourcePaymentOrderKey: normalized(
      payout.currentPaymentAttempt?.sourcePaymentOrderCode
      ?? payout.currentPaymentAttempt?.paymentOrderCode
      ?? paymentList?.paymentListCode,
    ),
  };
});

export const filterBatchWizardRows = (
  rows: readonly BatchWizardRow[],
  search: string,
  cooperationProjectFilter: string,
) => {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    const matchesProject = cooperationProjectFilter === ALL_PROJECTS
      || row.cooperationProjectKey === cooperationProjectFilter;
    const matchesSearch = !query || [
      row.creatorIdentity.accountName,
      row.creatorIdentity.displayName,
      row.requestCode,
      row.cooperationProjectName,
      row.cooperationProjectCode,
    ].some((value) => value.toLowerCase().includes(query));
    return matchesProject && matchesSearch;
  });
};

export const batchWizardSelectionScopeIssue = (
  row: BatchWizardRow,
  selectedRow: BatchWizardRow | undefined,
) => {
  if (!selectedRow) return '';
  if (row.requestKey !== selectedRow.requestKey) return '一个付款批次只能关联一个请款项目';
  if (row.payout.provider !== selectedRow.payout.provider) return '一个付款批次只能使用同一付款渠道';
  const selectedIsRetry = isPaymentFailureRetryCandidate(selectedRow.payout);
  if (isPaymentFailureRetryCandidate(row.payout) !== selectedIsRetry) {
    return '首次付款和重新付款需要分别创建付款批次';
  }
  if (
    selectedIsRetry
    && selectedRow.sourcePaymentOrderKey
    && row.sourcePaymentOrderKey !== selectedRow.sourcePaymentOrderKey
  ) return '重新付款只能选择同一张原付款单的失败明细';
  return '';
};

const retryResultLabel = (payout: Payout) => {
  const recovery = payout.paymentFailureRecovery;
  if (!recovery) return null;
  if (recovery.status === 'AWAITING_CREATOR_UPDATE') return '尚未更新';
  if (recovery.readyReason === 'ACCOUNT_UNCHANGED') return '原账户未变 · 可重试';
  if (
    recovery.readyReason === 'REVALIDATED'
    || ['CREATOR_UPDATED', 'PENDING_FINANCE_CONFIRMATION'].includes(recovery.status)
  ) return '达人已更新 · 可重试';
  return null;
};

export function BatchWizardPage({
  payouts,
  requests = [],
  generatedInvoices = [],
  paymentLists = [],
  creators = [],
  onCancel,
  onSubmit,
  onDraft,
}: {
  payouts: Payout[];
  requests?: BatchWizardRequestProject[];
  generatedInvoices?: GeneratedInvoiceRecord[];
  paymentLists?: PaymentListRecord[];
  creators?: CreatorProfile[];
  onCancel: () => void;
  onSubmit: (submission: MockBatchSubmission) => boolean;
  onDraft: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [provider, setProvider] = useState<ExecutableBatchProvider>('Airwallex');
  const [mode, setMode] = useState<'batch' | 'single'>('batch');
  const [search, setSearch] = useState('');
  const [cooperationProjectFilter, setCooperationProjectFilter] = useState(ALL_PROJECTS);
  const [sourceCurrency, setSourceCurrency] = useState<InvoiceCurrency>('USD');
  const [fundingAccountId, setFundingAccountId] = useState(FUNDING_ACCOUNTS.Airwallex[0].value);
  const [submissionError, setSubmissionError] = useState('');
  const [feeBearerByPayoutId, setFeeBearerByPayoutId] = useState<Record<string, PaymentFeeBearer>>({});
  const [pendingSubmission, setPendingSubmission] = useState<MockBatchSubmission | null>(null);

  const rows = useMemo(() => buildBatchWizardRows({
    payouts,
    requests,
    generatedInvoices,
    paymentLists,
    creators,
  }), [creators, generatedInvoices, paymentLists, payouts, requests]);
  const rowByPayoutId = useMemo(() => new Map(rows.map((row) => [row.payout.id, row])), [rows]);
  const projectOptions = useMemo<readonly SelectOption<string>[]>(() => {
    const projects = new Map<string, SelectOption<string>>();
    rows.forEach((row) => {
      if (!row.cooperationProjectKey || projects.has(row.cooperationProjectKey)) return;
      projects.set(row.cooperationProjectKey, {
        value: row.cooperationProjectKey,
        label: row.cooperationProjectName,
        description: row.cooperationProjectCode,
      });
    });
    return [
      { value: ALL_PROJECTS, label: '全部合作项目' },
      ...projects.values(),
    ];
  }, [rows]);
  const visibleRows = useMemo(
    () => filterBatchWizardRows(rows, search, cooperationProjectFilter),
    [cooperationProjectFilter, rows, search],
  );
  const selectedRows = rows.filter((row) => selected.has(row.payout.id));
  const selectedPayouts = selectedRows.map((row) => row.payout);
  const selectedScopeRow = selectedRows[0];
  const selectedRequestKey = selectedRows[0]?.requestKey ?? '';
  const feeBearerFor = (payoutId: string) => (
    feeBearerByPayoutId[payoutId] ?? DEFAULT_BATCH_FEE_BEARER
  );

  const getAccountCheck = (row: BatchWizardRow) => {
    const { payout } = row;
    const retryCandidate = isPaymentFailureRetryCandidate(payout);
    if (retryCandidate && !isPaymentFailureRetryReady(payout)) {
      return {
        eligible: false,
        label: retryResultLabel(payout) ?? paymentFailureRecoveryLabel(payout),
        issue: retryResultLabel(payout) ?? paymentFailureRecoveryLabel(payout),
      };
    }
    const issues = validatePayoutForBatch(payout, provider, feeBearerFor(payout.id));
    const retryLabel = retryCandidate ? retryResultLabel(payout) : null;
    return {
      eligible: issues.length === 0,
      label: retryLabel ?? issues[0] ?? '冻结快照校验通过',
      issue: issues[0],
    };
  };
  const selectedChecks = selectedRows.map((row) => getAccountCheck(row));
  const issueCount = selectedChecks.filter((check) => !check.eligible).length;
  const hasIssue = issueCount > 0;
  const firstSelectedIssue = selectedChecks.find((check) => !check.eligible)?.issue;
  const passedCount = selectedPayouts.length - issueCount;
  const canSubmit = selectedPayouts.length > 0 && !hasIssue && Boolean(fundingAccountId);
  const totals = useMemo(() => selectedPayouts.reduce<Record<string, number>>((result, payout) => ({
    ...result,
    [payout.currency]: (result[payout.currency] ?? 0) + payout.amount,
  }), {}), [selectedPayouts]);
  const confirmationRows: PaymentConfirmationRow[] = selectedRows.map((row) => {
    const receiveCurrency = String(
      row.paymentItem
        ? paymentListItemValue(row.paymentItem, 'receiveCurrency') || row.payout.currency
        : row.payout.currency,
    );
    return {
      id: row.payout.id,
      creatorName: row.payout.creator,
      invoiceNumber: row.payout.invoice,
      account: row.accountSummary,
      preview: paymentPreviewFor({
        payout: row.payout,
        receiveCurrency,
        feeBearer: feeBearerFor(row.payout.id),
      }),
    };
  });

  const selectionScopeIssue = (row: BatchWizardRow) => {
    if (mode !== 'batch' || !selectedRequestKey) return '';
    return batchWizardSelectionScopeIssue(row, selectedScopeRow);
  };

  const selectableVisibleRows = mode === 'batch' && selectedRequestKey
    ? visibleRows.filter((row) => (
        !selectionScopeIssue(row)
        && (!isPaymentFailureRetryCandidate(row.payout) || isPaymentFailureRetryReady(row.payout))
      ))
    : [];
  const selectableVisibleIds = selectableVisibleRows.map((row) => row.payout.id);
  const selectedVisibleCount = selectableVisibleIds.filter((id) => selected.has(id)).length;
  const allVisibleSelected = selectableVisibleIds.length > 0
    && selectedVisibleCount === selectableVisibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const toggleOne = (id: string) => {
    const row = rowByPayoutId.get(id);
    if (!row || (isPaymentFailureRetryCandidate(row.payout) && !isPaymentFailureRetryReady(row.payout))) return;
    if (selectionScopeIssue(row)) return;
    setSelected((current) => {
      if (mode === 'single') {
        return current.has(id) && current.size === 1 ? new Set() : new Set([id]);
      }
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (mode === 'single' || !selectedRequestKey || !selectableVisibleIds.length) return;
    setSelected((current) => {
      const next = new Set(current);
      if (selectableVisibleIds.every((id) => current.has(id))) {
        selectableVisibleIds.forEach((id) => next.delete(id));
      } else {
        selectableVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const changeMode = (nextMode: 'batch' | 'single') => {
    setMode(nextMode);
    if (nextMode === 'single') {
      setSelected((current) => {
        const firstSelected = rows.find((row) => current.has(row.payout.id));
        return firstSelected ? new Set([firstSelected.payout.id]) : new Set();
      });
    }
  };

  const changeProvider = (nextProvider: ExecutableBatchProvider) => {
    setProvider(nextProvider);
    setFundingAccountId(FUNDING_ACCOUNTS[nextProvider][0].value);
    setSubmissionError('');
  };

  const submit = () => {
    try {
      const submission = createMockBatchSubmission({
        payouts: selectedPayouts,
        provider,
        fundingAccountId,
        sourceCurrency,
        feeBearerByPayoutId: Object.fromEntries(
          selectedPayouts.map((payout) => [payout.id, feeBearerFor(payout.id)]),
        ),
      });
      setSubmissionError('');
      setPendingSubmission(submission);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : '批次校验失败');
    }
  };

  const confirmSubmission = () => {
    if (pendingSubmission && onSubmit(pendingSubmission)) setPendingSubmission(null);
  };

  return (
    <>
    <div className="page-stack batch-page">
      <button className="back-link" type="button" onClick={onCancel}><ArrowLeft size={17} />返回付款批次</button>
      <PageHeading title="新建付款批次" subtitle="先校验达人资料，再选择渠道并提交财务执行。" />

      <ol className="wizard-steps" aria-label="创建付款批次进度">
        {STEPS.map((step, index) => (
          <li className={index < 2 ? 'step-complete' : index === 2 ? 'step-current' : ''} key={step}>
            <span>{index < 2 ? <Check size={15} /> : index + 1}</span>
            <strong>{step}</strong>
            {index < STEPS.length - 1 ? <i /> : null}
          </li>
        ))}
      </ol>

      <div className="batch-layout">
        <section className="batch-panel batch-selection-panel">
          <div className="panel-title-row batch-selection-toolbar">
            <div className="batch-selection-filters">
              <label className="search-control"><Search size={16} /><input aria-label="搜索付款" placeholder="搜索达人、请款编号或合作项目" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <SelectField
                ariaLabel="按合作项目筛选付款"
                className="batch-project-filter"
                value={cooperationProjectFilter}
                options={projectOptions}
                onChange={setCooperationProjectFilter}
              />
            </div>
            <div className="batch-selection-count"><h2>已选择的付款</h2><p>{selectedPayouts.length} 笔付款将进入本批次</p></div>
          </div>

          <div className="batch-table-scroll">
            <table className="batch-table batch-wizard-table">
              <thead><tr>
                <th className="batch-wizard-col-select"><input
                  ref={(node) => { if (node) node.indeterminate = someVisibleSelected; }}
                  aria-label="全选当前请款项目付款"
                  type="checkbox"
                  checked={mode === 'batch' && allVisibleSelected}
                  disabled={mode === 'single' || !selectedRequestKey || !selectableVisibleIds.length}
                  title={!selectedRequestKey ? '请先选择一笔付款以锁定请款项目' : undefined}
                  onChange={toggleAll}
                /></th>
                <th className="batch-wizard-col-creator">达人</th>
                <th className="batch-wizard-col-request">请款编号</th>
                <th className="batch-wizard-col-amount">请款金额</th>
                <th className="batch-wizard-col-project">合作项目</th>
                <th className="batch-wizard-col-account">银行账号</th>
                <th className="batch-wizard-col-validation">账户校验</th>
                <th className="batch-wizard-col-fee-bearer">手续费承担方</th>
              </tr></thead>
              <tbody>
                {visibleRows.map((row) => {
                  const { payout } = row;
                  const accountCheck = getAccountCheck(row);
                  const accountIssue = !accountCheck.eligible;
                  const rowIssue = selected.has(payout.id) && accountIssue;
                  const retryCandidate = isPaymentFailureRetryCandidate(payout);
                  const retryBlocked = retryCandidate && !isPaymentFailureRetryReady(payout);
                  const scopeIssue = selectionScopeIssue(row);
                  const selectionBlocked = retryBlocked || Boolean(scopeIssue);
                  const blockedReason = scopeIssue || (retryBlocked ? accountCheck.label : undefined);
                  return (
                    <tr className={`${rowIssue ? 'row-error ' : ''}${retryCandidate ? 'batch-retry-row ' : ''}${scopeIssue ? 'batch-request-locked-row' : ''}`.trim()} key={payout.id} title={scopeIssue ? blockedReason : undefined}>
                      <td className="batch-wizard-col-select"><input aria-label={`选择 ${payout.creator}`} type="checkbox" checked={selected.has(payout.id)} disabled={selectionBlocked} title={blockedReason} onChange={() => toggleOne(payout.id)} /></td>
                      <td className="batch-wizard-col-creator">
                        <div className="batch-wizard-creator-cell">
                          <PaymentCreatorIdentity {...row.creatorIdentity} />
                          {retryCandidate ? <em className="batch-retry-badge">失败重试</em> : null}
                        </div>
                      </td>
                      <td className="batch-wizard-col-request"><strong className="batch-wizard-request-code" title={row.requestCode}>{row.requestCode}</strong></td>
                      <td className="batch-wizard-col-amount amount-cell">{formatAmount(payout)}</td>
                      <td className="batch-wizard-col-project"><span className="batch-wizard-project-cell"><strong title={row.cooperationProjectName}>{row.cooperationProjectName}</strong><small title={row.cooperationProjectCode}>{row.cooperationProjectCode}</small></span></td>
                      <td className="batch-wizard-col-account">
                        <span className="batch-account-cell">
                          <strong title={row.accountSummary}>{row.accountSummary}</strong>
                          <small title={`${row.accountProvider} · ${row.accountVersion}`}>{row.accountProvider} · {row.accountVersion}</small>
                        </span>
                      </td>
                      <td className="batch-wizard-col-validation">
                        {accountIssue && !isPaymentFailureRetryReady(payout) ? (
                          <span className="warning-text" title={accountCheck.label}><AlertTriangle size={15} />{accountCheck.label}</span>
                        ) : <span className="validation-ok" title={accountCheck.label}><CheckCircle2 size={16} />{accountCheck.label}</span>}
                      </td>
                      <td className="batch-wizard-col-fee-bearer">
                        <SelectField
                          ariaLabel={`${payout.creator} 手续费承担方`}
                          className="batch-fee-bearer-select"
                          variant="compact"
                          value={feeBearerFor(payout.id)}
                          options={PAYMENT_FEE_BEARER_OPTIONS}
                          onChange={(value) => setFeeBearerByPayoutId((current) => ({
                            ...current,
                            [payout.id]: value,
                          }))}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!visibleRows.length ? <tr><td className="batch-wizard-empty" colSpan={8}>没有符合当前条件的付款</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="batch-panel channel-panel">
          <div className="panel-title-row"><div><h2>付款方式</h2><p>选择本批次的执行方式与渠道</p></div></div>
          <div className="segmented-control" aria-label="付款模式">
            <button className={mode === 'batch' ? 'selected' : ''} type="button" onClick={() => changeMode('batch')}>批量打款</button>
            <button className={mode === 'single' ? 'selected' : ''} type="button" onClick={() => changeMode('single')}>单笔打款</button>
          </div>
          <div className="provider-list">
            {PROVIDERS.map((option) => (
              <button
                className={`provider-option ${provider === option.id ? 'provider-selected' : ''}`}
                key={option.id}
                type="button"
                disabled={option.disabled}
                onClick={() => !option.disabled && changeProvider(option.id as ExecutableBatchProvider)}
              >
                <span className="provider-radio"><i /></span>
                <span><strong>{option.title}</strong><small>{option.description}</small></span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          <div className="batch-funding-controls">
            <div className="invoice-form-control">
              <span>资金账户 *</span>
              <SelectField
                ariaLabel="批次资金账户"
                variant="form"
                value={fundingAccountId}
                options={FUNDING_ACCOUNTS[provider]}
                onChange={setFundingAccountId}
              />
            </div>
            <div className="invoice-form-control">
              <span>source_currency *</span>
              <SelectField
                ariaLabel="批次资金源币种"
                variant="form"
                value={sourceCurrency}
                options={SOURCE_CURRENCY_OPTIONS}
                onChange={(value) => setSourceCurrency(value as InvoiceCurrency)}
              />
            </div>
          </div>
          <div className="validation-summary">
            <div><ShieldCheck size={20} /><span><strong>{mode === 'batch' ? '批次资料校验' : '单笔资料校验'}</strong><small>{passedCount} / {selectedPayouts.length} 笔通过</small></span></div>
            <StatusMark status={hasIssue ? '信息异常' : '等待付款'} />
          </div>
          {hasIssue ? <div className="inline-alert"><AlertTriangle size={17} />{firstSelectedIssue || `请先处理 ${issueCount} 笔冻结快照，才能提交付款。`}</div> : null}
          {submissionError ? <div className="inline-alert" role="alert"><AlertTriangle size={17} />{submissionError}</div> : null}
        </aside>
      </div>

      <footer className="batch-summary-bar">
        <div><span>已选 {selectedPayouts.length} 笔</span><strong>{Object.entries(totals).map(([currency, amount]) => `${currency} ${amount.toLocaleString('en-US')}`).join(' + ') || '—'}</strong></div>
        <div className="batch-actions"><Button variant="ghost" onClick={onCancel}>取消</Button><Button variant="secondary" onClick={onDraft}>保存草稿</Button><Button disabled={!canSubmit} disabledReason={!selectedPayouts.length ? '请先选择付款记录。' : hasIssue ? '请先处理付款资料校验异常。' : '请先选择执行账户。'} onClick={submit}>创建并提交</Button></div>
      </footer>

    </div>
    {pendingSubmission ? (
      <PaymentConfirmationDialog
        rows={confirmationRows}
        onClose={() => setPendingSubmission(null)}
        onConfirm={confirmSubmission}
      />
    ) : null}
    </>
  );
}
