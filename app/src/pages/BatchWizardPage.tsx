import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { accountDisplayValue } from '../accountPresentation';
import {
  paymentListEffectiveAccount,
  paymentListItemValue,
  type PaymentListItem,
  type PaymentListRecord,
} from '../businessWorkflow';
import {
  createMockBatchSubmission,
  resolvePaymentFailureSourceBatch,
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
import { PaymentProviderBadge, paymentProviderDisplayName } from '../components/PaymentProviderBadge';
import { formatAmount } from '../data';
import {
  isPaymentFailureRetryReady,
  paymentFailureRecoveryLabel,
} from '../paymentFailureRecovery';
import {
  findPaymentListItemForPayout,
  paymentCreatorIdentityFromPayout,
  type PaymentCreatorIdentityData,
} from '../paymentCreatorIdentity';
import type { PaymentFeeBearer } from '../paymentFeeBearerPresentation';
import type { PaymentBatchRecord } from '../paymentBatches';
import {
  DEFAULT_BATCH_FEE_BEARER,
  PAYMENT_FEE_BEARER_OPTIONS,
  paymentPreviewFor,
} from '../paymentPreview';
import type { CreatorProfile, GeneratedInvoiceRecord, InvoiceCurrency, Payout } from '../types';
import type { RequestProjectSummary } from './RequestProjectDetailPage';

const STEPS = ['选择失败明细', '校验资料', '确认配置', '提交重付'];
const ALL_PROJECTS = 'all';
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
  sourcePaymentBatchId?: PaymentBatchRecord['paymentBatchId'];
  sourcePaymentBatchCode: string;
  sourceProvider?: ExecutableBatchProvider;
  sourceCurrency?: InvoiceCurrency;
  sourceAttemptNumber?: number;
  sourceIssue?: string;
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
  paymentBatches = [],
}: {
  payouts: readonly Payout[];
  requests: readonly BatchWizardRequestProject[];
  generatedInvoices: readonly GeneratedInvoiceRecord[];
  paymentLists: readonly PaymentListRecord[];
  creators: readonly CreatorProfile[];
  paymentBatches?: readonly PaymentBatchRecord[];
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
  const sourceResolution = resolvePaymentFailureSourceBatch(payout, paymentBatches);
  const sourceBatch = sourceResolution.batch;
  const executableSourceProvider = sourceBatch?.provider === 'Airwallex' || sourceBatch?.provider === 'PayPal'
    ? sourceBatch.provider
    : undefined;
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
    sourcePaymentOrderKey: normalized(sourceBatch?.paymentOrderCode),
    sourcePaymentBatchId: sourceBatch?.paymentBatchId,
    sourcePaymentBatchCode: normalized(sourceBatch?.paymentBatchCode),
    sourceProvider: executableSourceProvider,
    sourceCurrency: sourceBatch?.sourceCurrency,
    sourceAttemptNumber: sourceBatch?.paymentAttemptNumber,
    sourceIssue: sourceResolution.issue
      ?? (sourceBatch && !executableSourceProvider ? '原付款渠道当前不支持重新付款' : undefined),
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
  if (!row.sourcePaymentBatchId || !selectedRow.sourcePaymentBatchId) return '原付款批次无法唯一确认';
  if (row.sourcePaymentBatchId !== selectedRow.sourcePaymentBatchId) return '重新付款只能选择同一原付款批次的失败明细';
  return '';
};

const retryResultLabel = (payout: Payout) => {
  const recovery = payout.paymentFailureRecovery;
  if (!recovery) return payout.status === '付款失败' ? '待财务处理' : '失败恢复流程待补全';
  if (recovery.revalidationIssues?.length) return recovery.revalidationIssues[0];
  if (recovery.status === 'AWAITING_CREATOR_UPDATE') return '尚未更新';
  if (recovery.readyReason === 'ACCOUNT_UNCHANGED') return '原账户未变 · 可重试';
  if (
    recovery.readyReason === 'REVALIDATED'
    || ['CREATOR_UPDATED', 'PENDING_FINANCE_CONFIRMATION'].includes(recovery.status)
  ) return '达人已更新 · 可重试';
  return paymentFailureRecoveryLabel(payout);
};

export function BatchWizardPage({
  payouts,
  requests = [],
  generatedInvoices = [],
  paymentLists = [],
  creators = [],
  paymentBatches = [],
  onCancel,
  onSubmit,
  onDraft,
}: {
  payouts: Payout[];
  requests?: BatchWizardRequestProject[];
  generatedInvoices?: GeneratedInvoiceRecord[];
  paymentLists?: PaymentListRecord[];
  creators?: CreatorProfile[];
  paymentBatches?: PaymentBatchRecord[];
  onCancel: () => void;
  onSubmit: (submission: MockBatchSubmission) => boolean;
  onDraft: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [mode, setMode] = useState<'batch' | 'single'>('batch');
  const [search, setSearch] = useState('');
  const [cooperationProjectFilter, setCooperationProjectFilter] = useState(ALL_PROJECTS);
  const [fundingAccountId, setFundingAccountId] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const [feeBearerByPayoutId, setFeeBearerByPayoutId] = useState<Record<string, PaymentFeeBearer>>({});
  const [pendingSubmission, setPendingSubmission] = useState<MockBatchSubmission | null>(null);

  const rows = useMemo(() => buildBatchWizardRows({
    payouts,
    requests,
    generatedInvoices,
    paymentLists,
    creators,
    paymentBatches,
  }), [creators, generatedInvoices, paymentBatches, paymentLists, payouts, requests]);
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
  const selectedSourceBatchId = selectedScopeRow?.sourcePaymentBatchId;
  const inheritedProvider = selectedScopeRow?.sourceProvider;
  const inheritedCurrency = selectedScopeRow?.sourceCurrency;
  const inheritedFundingAccounts = inheritedProvider ? FUNDING_ACCOUNTS[inheritedProvider] : [];
  const feeBearerFor = (payoutId: string) => (
    feeBearerByPayoutId[payoutId] ?? DEFAULT_BATCH_FEE_BEARER
  );

  useEffect(() => {
    setFundingAccountId(inheritedProvider ? FUNDING_ACCOUNTS[inheritedProvider][0]?.value ?? '' : '');
    setSubmissionError('');
  }, [inheritedProvider]);

  const getAccountCheck = (row: BatchWizardRow) => {
    const { payout } = row;
    if (row.sourceIssue || !row.sourcePaymentBatchId) {
      const issue = row.sourceIssue || '原付款批次无法唯一确认';
      return { eligible: false, label: issue, issue };
    }
    if (!isPaymentFailureRetryReady(payout)) {
      const issue = retryResultLabel(payout);
      return {
        eligible: false,
        label: issue,
        issue,
      };
    }
    const issues = row.sourceProvider
      ? validatePayoutForBatch(payout, row.sourceProvider, feeBearerFor(payout.id))
      : ['原付款渠道待补全'];
    const retryLabel = retryResultLabel(payout);
    return {
      eligible: issues.length === 0,
      label: issues[0] ?? retryLabel ?? '冻结快照校验通过',
      issue: issues[0],
    };
  };
  const selectedChecks = selectedRows.map((row) => getAccountCheck(row));
  const issueCount = selectedChecks.filter((check) => !check.eligible).length;
  const hasIssue = issueCount > 0;
  const firstSelectedIssue = selectedChecks.find((check) => !check.eligible)?.issue;
  const passedCount = selectedPayouts.length - issueCount;
  const canSubmit = selectedPayouts.length > 0
    && !hasIssue
    && Boolean(fundingAccountId)
    && Boolean(inheritedProvider)
    && Boolean(inheritedCurrency)
    && Boolean(selectedSourceBatchId);
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
    if (mode !== 'batch' || !selectedSourceBatchId) return '';
    return batchWizardSelectionScopeIssue(row, selectedScopeRow);
  };

  const selectableVisibleRows = mode === 'batch' && selectedSourceBatchId
    ? visibleRows.filter((row) => (
        !selectionScopeIssue(row)
        && isPaymentFailureRetryReady(row.payout)
        && !row.sourceIssue
        && Boolean(row.sourcePaymentBatchId)
      ))
    : [];
  const selectableVisibleIds = selectableVisibleRows.map((row) => row.payout.id);
  const selectedVisibleCount = selectableVisibleIds.filter((id) => selected.has(id)).length;
  const allVisibleSelected = selectableVisibleIds.length > 0
    && selectedVisibleCount === selectableVisibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const toggleOne = (id: string) => {
    const row = rowByPayoutId.get(id);
    if (!row || !isPaymentFailureRetryReady(row.payout) || row.sourceIssue || !row.sourcePaymentBatchId) return;
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
    if (mode === 'single' || !selectedSourceBatchId || !selectableVisibleIds.length) return;
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

  const submit = () => {
    try {
      if (!selectedScopeRow?.sourcePaymentBatchId
        || !selectedScopeRow.sourcePaymentBatchCode
        || !selectedScopeRow.sourceProvider
        || !selectedScopeRow.sourceCurrency
        || !selectedScopeRow.sourcePaymentOrderKey
        || !selectedScopeRow.sourceAttemptNumber) {
        throw new Error('原付款批次信息不完整，无法重新付款');
      }
      const submission = createMockBatchSubmission({
        payouts: selectedPayouts,
        provider: selectedScopeRow.sourceProvider,
        fundingAccountId,
        sourceCurrency: selectedScopeRow.sourceCurrency,
        sourcePaymentBatchId: selectedScopeRow.sourcePaymentBatchId,
        sourcePaymentBatchCode: selectedScopeRow.sourcePaymentBatchCode,
        sourcePaymentOrderCode: selectedScopeRow.sourcePaymentOrderKey,
        paymentAttemptNumber: selectedScopeRow.sourceAttemptNumber + 1,
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
      <PageHeading title="新建重新付款批次" subtitle="选择真实失败明细，核对继承的原批次配置后重新提交。" />

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
                  aria-label="全选当前原付款批次中的可重试明细"
                  type="checkbox"
                  checked={mode === 'batch' && allVisibleSelected}
                  disabled={mode === 'single' || !selectedSourceBatchId || !selectableVisibleIds.length}
                  title={!selectedSourceBatchId ? '请先选择一笔失败明细以锁定原付款批次' : undefined}
                  onChange={toggleAll}
                /></th>
                <th className="batch-wizard-col-creator">达人</th>
                <th className="batch-wizard-col-request">请款编号</th>
                <th className="batch-wizard-col-amount">请款金额</th>
                <th className="batch-wizard-col-fee-bearer">手续费承担方</th>
                <th className="batch-wizard-col-project">合作项目</th>
                <th className="batch-wizard-col-account">银行账号</th>
                <th className="batch-wizard-col-validation">账户校验</th>
              </tr></thead>
              <tbody>
                {visibleRows.map((row) => {
                  const { payout } = row;
                  const accountCheck = getAccountCheck(row);
                  const accountIssue = !accountCheck.eligible;
                  const rowIssue = selected.has(payout.id) && accountIssue;
                  const retryBlocked = !isPaymentFailureRetryReady(payout) || Boolean(row.sourceIssue);
                  const scopeIssue = selectionScopeIssue(row);
                  const selectionBlocked = retryBlocked || !row.sourcePaymentBatchId || Boolean(scopeIssue);
                  const blockedReason = scopeIssue || (selectionBlocked ? accountCheck.label : undefined);
                  return (
                    <tr className={`${rowIssue ? 'row-error ' : ''}batch-retry-row ${scopeIssue ? 'batch-request-locked-row' : ''}`.trim()} key={payout.id} title={blockedReason}>
                      <td className="batch-wizard-col-select"><input aria-label={`选择 ${payout.creator}`} type="checkbox" checked={selected.has(payout.id)} disabled={selectionBlocked} title={blockedReason} onChange={() => toggleOne(payout.id)} /></td>
                      <td className="batch-wizard-col-creator">
                        <div className="batch-wizard-creator-cell">
                          <PaymentCreatorIdentity {...row.creatorIdentity} />
                          <em className="batch-retry-badge" title={row.sourcePaymentBatchCode || row.sourceIssue}>失败重试</em>
                        </div>
                      </td>
                      <td className="batch-wizard-col-request"><strong className="batch-wizard-request-code" title={row.requestCode}>{row.requestCode}</strong></td>
                      <td className="batch-wizard-col-amount amount-cell">{formatAmount(payout)}</td>
                      <td className="batch-wizard-col-fee-bearer">
                        <SelectField
                          ariaLabel={`${payout.creator} 手续费承担方`}
                          className="batch-fee-bearer-select"
                          variant="compact"
                          value={feeBearerFor(payout.id)}
                          options={PAYMENT_FEE_BEARER_OPTIONS}
                          disabled={selectionBlocked}
                          onChange={(value) => setFeeBearerByPayoutId((current) => ({
                            ...current,
                            [payout.id]: value,
                          }))}
                        />
                      </td>
                      <td className="batch-wizard-col-project"><span className="batch-wizard-project-cell"><strong title={row.cooperationProjectName}>{row.cooperationProjectName}</strong><small title={row.cooperationProjectCode}>{row.cooperationProjectCode}</small></span></td>
                      <td className="batch-wizard-col-account">
                        <span className="batch-account-cell">
                          <strong title={row.accountSummary}>{row.accountSummary}</strong>
                          <small title={`${row.accountProvider} · ${row.accountVersion}`}>{row.accountProvider} · {row.accountVersion}</small>
                        </span>
                      </td>
                      <td className="batch-wizard-col-validation">
                        {accountIssue ? (
                          <span className="warning-text" title={accountCheck.label}><AlertTriangle size={15} />{accountCheck.label}</span>
                        ) : <span className="validation-ok" title={accountCheck.label}><CheckCircle2 size={16} />{accountCheck.label}</span>}
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
          <div className="panel-title-row"><div><h2>重新付款配置</h2><p>付款渠道和支付币种继承原付款批次</p></div></div>
          <div className="segmented-control" aria-label="付款模式">
            <button className={mode === 'batch' ? 'selected' : ''} type="button" onClick={() => changeMode('batch')}>批量打款</button>
            <button className={mode === 'single' ? 'selected' : ''} type="button" onClick={() => changeMode('single')}>单笔打款</button>
          </div>
          <dl className="batch-inherited-fields">
            <div>
              <dt>原付款批次</dt>
              <dd className={selectedScopeRow?.sourcePaymentBatchCode ? 'mono-cell' : ''}>{selectedScopeRow?.sourcePaymentBatchCode || '请选择失败明细'}</dd>
            </div>
            <div>
              <dt>付款渠道</dt>
              <dd>{inheritedProvider ? <PaymentProviderBadge compact provider={inheritedProvider} /> : '请选择失败明细'}</dd>
            </div>
            <div>
              <dt>付款单号</dt>
              <dd className={selectedScopeRow?.sourcePaymentOrderKey ? 'mono-cell' : ''}>{selectedScopeRow?.sourcePaymentOrderKey || '请选择失败明细'}</dd>
            </div>
            <div>
              <dt>支付币种</dt>
              <dd>{inheritedCurrency || '请选择失败明细'}</dd>
            </div>
          </dl>
          <div className="batch-funding-controls">
            <div className="invoice-form-control">
              <span>资金账户 *</span>
              <SelectField
                ariaLabel="批次资金账户"
                variant="form"
                value={fundingAccountId}
                options={inheritedFundingAccounts}
                placeholder="请先选择失败明细"
                disabled={!inheritedProvider}
                onChange={setFundingAccountId}
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
        <div className="batch-actions"><Button variant="ghost" onClick={onCancel}>取消</Button><Button variant="secondary" onClick={onDraft}>保存草稿</Button><Button disabled={!canSubmit} disabledReason={!selectedPayouts.length ? '请先选择失败明细。' : hasIssue ? '请先处理付款资料校验异常。' : '请先选择执行账户。'} onClick={submit}>创建并提交</Button></div>
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
