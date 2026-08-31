import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { accountDisplayValue } from '../accountPresentation';
import type { PaymentListRecord } from '../businessWorkflow';
import {
  createMockBatchSubmission,
  validatePayoutForBatch,
  type ExecutableBatchProvider,
  type MockBatchSubmission,
} from '../batchTransfers';
import { Button, PageHeading, SelectField, StatusMark } from '../components/Common';
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
} from '../paymentCreatorIdentity';
import type { CreatorProfile, GeneratedInvoiceRecord, InvoiceCurrency, Payout } from '../types';

const STEPS = ['选择付款', '校验资料', '选择渠道', '确认提交'];
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

export function BatchWizardPage({
  payouts,
  generatedInvoices = [],
  paymentLists = [],
  creators = [],
  onCancel,
  onSubmit,
  onDraft,
}: {
  payouts: Payout[];
  generatedInvoices?: GeneratedInvoiceRecord[];
  paymentLists?: PaymentListRecord[];
  creators?: CreatorProfile[];
  onCancel: () => void;
  onSubmit: (submission: MockBatchSubmission) => void;
  onDraft: () => void;
}) {
  const [selected, setSelected] = useState(() => new Set(
    payouts.filter((payout) => !isPaymentFailureRetryCandidate(payout)).map((payout) => payout.id),
  ));
  const [provider, setProvider] = useState<ExecutableBatchProvider>('Airwallex');
  const [mode, setMode] = useState<'batch' | 'single'>('batch');
  const [search, setSearch] = useState('');
  const [sourceCurrency, setSourceCurrency] = useState<InvoiceCurrency>('USD');
  const [fundingAccountId, setFundingAccountId] = useState(FUNDING_ACCOUNTS.Airwallex[0].value);
  const [submissionError, setSubmissionError] = useState('');

  const visiblePayouts = payouts.filter((payout) =>
    `${payout.creator}${payout.project}${payout.invoice}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedPayouts = payouts.filter((payout) => selected.has(payout.id));
  const getAccountCheck = (payout: Payout) => {
    const retryCandidate = isPaymentFailureRetryCandidate(payout);
    if (retryCandidate && !isPaymentFailureRetryReady(payout)) {
      return {
        eligible: false,
        label: paymentFailureRecoveryLabel(payout),
        description: `${paymentProviderDisplayName(payout.provider)} · ${payout.paymentFailureRecovery?.reportedPayoutAccountVersion ?? payout.payoutAccountVersion ?? 'legacy-v1'} · 失败重试款`,
      };
    }
    const issues = validatePayoutForBatch(payout, provider);
    return {
      eligible: issues.length === 0,
      label: issues[0] ?? (retryCandidate ? paymentFailureRecoveryLabel(payout) : '冻结快照校验通过'),
      description: `${paymentProviderDisplayName(payout.provider)} · ${payout.payoutAccountVersion ?? payout.invoiceSnapshot?.payoutAccountVersion ?? 'legacy-v1'} · ${accountDisplayValue(payout.account)}`,
    };
  };
  const selectedChecks = selectedPayouts.map((payout) => getAccountCheck(payout));
  const issueCount = selectedChecks.filter((check) => !check.eligible).length;
  const hasIssue = issueCount > 0;
  const passedCount = selectedPayouts.length - issueCount;
  const canSubmit = selectedPayouts.length > 0 && !hasIssue && Boolean(fundingAccountId);
  const totals = useMemo(() => selectedPayouts.reduce<Record<string, number>>((result, payout) => ({
    ...result,
    [payout.currency]: (result[payout.currency] ?? 0) + payout.amount,
  }), {}), [selectedPayouts]);

  const toggleOne = (id: string) => {
    const payout = payouts.find((candidate) => candidate.id === id);
    if (!payout || (isPaymentFailureRetryCandidate(payout) && !isPaymentFailureRetryReady(payout))) return;
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
    if (mode === 'single') return;
    const selectableIds = payouts
      .filter((payout) => !isPaymentFailureRetryCandidate(payout) || isPaymentFailureRetryReady(payout))
      .map((payout) => payout.id);
    setSelected((current) => selectableIds.every((id) => current.has(id))
      ? new Set()
      : new Set(selectableIds));
  };

  const changeMode = (nextMode: 'batch' | 'single') => {
    setMode(nextMode);
    if (nextMode === 'single') {
      setSelected((current) => {
        const firstSelected = payouts.find((payout) => current.has(payout.id));
        return firstSelected ? new Set([firstSelected.id]) : new Set();
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
      });
      setSubmissionError('');
      onSubmit(submission);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : '批次校验失败');
    }
  };

  return (
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
          <div className="panel-title-row">
            <div><h2>已选择的付款</h2><p>{selectedPayouts.length} 笔付款将进入本批次</p></div>
            <label className="search-control"><Search size={16} /><input aria-label="搜索付款" placeholder="搜索达人、项目或 Invoice" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          </div>

          <div className="batch-table-scroll">
            <table className="batch-table">
              <thead><tr><th><input aria-label="全选付款" type="checkbox" checked={mode === 'batch' && payouts.filter((payout) => !isPaymentFailureRetryCandidate(payout) || isPaymentFailureRetryReady(payout)).every((payout) => selected.has(payout.id))} disabled={mode === 'single'} onChange={toggleAll} /></th><th>达人 / 项目</th><th>执行账户</th><th>资料校验</th><th>金额</th></tr></thead>
              <tbody>
                {visiblePayouts.map((payout) => {
                  const creator = creators.find((candidate) => candidate.id === payout.creatorId);
                  const paymentItem = findPaymentListItemForPayout(payout, generatedInvoices, paymentLists);
                  const creatorIdentity = paymentCreatorIdentityFromPayout({ payout, paymentItem, creator });
                  const accountCheck = getAccountCheck(payout);
                  const accountIssue = !accountCheck.eligible;
                  const rowIssue = selected.has(payout.id) && accountIssue;
                  const retryCandidate = isPaymentFailureRetryCandidate(payout);
                  const retryBlocked = retryCandidate && !isPaymentFailureRetryReady(payout);
                  return (
                    <tr className={`${rowIssue ? 'row-error ' : ''}${retryCandidate ? 'batch-retry-row' : ''}`.trim()} key={payout.id}>
                      <td><input aria-label={`选择 ${payout.creator}`} type="checkbox" checked={selected.has(payout.id)} disabled={retryBlocked} onChange={() => toggleOne(payout.id)} /></td>
                      <td>
                        <div className="batch-wizard-creator-cell">
                          <PaymentCreatorIdentity {...creatorIdentity} />
                          <span className="batch-wizard-creator-meta">
                            <span title={`${payout.invoice} · ${payout.project}`}>{payout.invoice} · {payout.project}</span>
                            {retryCandidate ? <em className="batch-retry-badge">失败重试</em> : null}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="batch-account-cell">
                          <strong>{provider}</strong>
                          <small>{accountCheck.description}</small>
                        </span>
                      </td>
                      <td>
                        {accountIssue ? (
                          <span className="warning-text"><AlertTriangle size={15} />{accountCheck.label}</span>
                        ) : <span className="validation-ok"><CheckCircle2 size={16} />{accountCheck.label}</span>}
                      </td>
                      <td className="amount-cell">{formatAmount(payout)}</td>
                    </tr>
                  );
                })}
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
          {hasIssue ? <div className="inline-alert"><AlertTriangle size={17} />请先处理 {issueCount} 笔冻结快照，才能提交付款。</div> : null}
          {submissionError ? <div className="inline-alert"><AlertTriangle size={17} />{submissionError}</div> : null}
        </aside>
      </div>

      <footer className="batch-summary-bar">
        <div><span>已选 {selectedPayouts.length} 笔</span><strong>{Object.entries(totals).map(([currency, amount]) => `${currency} ${amount.toLocaleString('en-US')}`).join(' + ') || '—'}</strong></div>
        <div className="batch-actions"><Button variant="ghost" onClick={onCancel}>取消</Button><Button variant="secondary" onClick={onDraft}>保存草稿</Button><Button disabled={!canSubmit} disabledReason={!selectedPayouts.length ? '请先选择付款记录。' : hasIssue ? '请先处理付款资料校验异常。' : '请先选择执行账户。'} onClick={submit}>创建并提交</Button></div>
      </footer>

    </div>
  );
}
