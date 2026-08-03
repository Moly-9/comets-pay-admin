import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, Button, PageHeading, StatusMark } from '../components/Common';
import { formatAmount } from '../data';
import {
  getPayoutAccountForProvider,
  getPayoutAccountIdentifier,
  getPayoutAccountStatusMeta,
} from '../payoutAccounts';
import type { CreatorProfile, Payout, Provider } from '../types';

const STEPS = ['选择付款', '校验资料', '选择渠道', '确认提交'];
const PROVIDERS: Array<{ id: Provider; title: string; description: string }> = [
  { id: 'Airwallex', title: 'Airwallex', description: '按国家与币种选择 LOCAL 或 SWIFT' },
  { id: 'PayMax', title: 'PayMax', description: '俄罗斯、泰国及本地银行模板' },
  { id: 'PayPal', title: 'PayPal', description: '使用 PayPal 邮箱收款' },
  { id: '手动打款', title: '手动打款', description: '导出付款资料，由财务线下执行' },
];

export function BatchWizardPage({
  payouts,
  creators,
  onCancel,
  onSubmit,
  onDraft,
}: {
  payouts: Payout[];
  creators: CreatorProfile[];
  onCancel: () => void;
  onSubmit: (payouts: Payout[], provider: Provider) => void;
  onDraft: () => void;
}) {
  const [selected, setSelected] = useState(() => new Set(payouts.map((payout) => payout.id)));
  const [provider, setProvider] = useState<Provider>('Airwallex');
  const [mode, setMode] = useState<'batch' | 'single'>('batch');
  const [search, setSearch] = useState('');

  const visiblePayouts = payouts.filter((payout) =>
    `${payout.creator}${payout.project}${payout.invoice}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedPayouts = payouts.filter((payout) => selected.has(payout.id));
  const getAccountCheck = (payout: Payout) => {
    if (provider === 'PayMax' || provider === '手动打款') {
      return {
        account: null,
        eligible: true,
        label: provider === 'PayMax' ? '使用 PayMax 付款资料' : '导出后人工复核',
        description: payout.account,
      };
    }
    const creator = creators.find((item) => item.handle === payout.handle);
    const account = creator ? getPayoutAccountForProvider(creator.payoutAccounts, provider) : null;
    if (!account || account.provider !== provider) {
      return {
        account: null,
        eligible: false,
        label: `缺少 ${provider} 收款账户`,
        description: '请先在达人档案中新增对应渠道账户',
      };
    }
    const status = getPayoutAccountStatusMeta(account.status, account.provider);
    return {
      account,
      eligible: account.status === 'VALIDATED' || account.status === 'VERIFIED',
      label: status.label,
      description: `${account.nickname} · ${getPayoutAccountIdentifier(account)}`,
    };
  };
  const selectedChecks = selectedPayouts.map((payout) => getAccountCheck(payout));
  const issueCount = selectedChecks.filter((check) => !check.eligible).length;
  const hasIssue = issueCount > 0;
  const passedCount = selectedPayouts.length - issueCount;
  const canSubmit = selectedPayouts.length > 0 && !hasIssue;
  const totals = useMemo(() => selectedPayouts.reduce<Record<string, number>>((result, payout) => ({
    ...result,
    [payout.currency]: (result[payout.currency] ?? 0) + payout.amount,
  }), {}), [selectedPayouts]);

  const toggleOne = (id: string) => {
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
    setSelected((current) => current.size === payouts.length ? new Set() : new Set(payouts.map((payout) => payout.id)));
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
              <thead><tr><th><input aria-label="全选付款" type="checkbox" checked={mode === 'batch' && selected.size === payouts.length} disabled={mode === 'single'} onChange={toggleAll} /></th><th>达人 / 项目</th><th>执行账户</th><th>资料校验</th><th>金额</th></tr></thead>
              <tbody>
                {visiblePayouts.map((payout) => {
                  const accountCheck = getAccountCheck(payout);
                  const accountIssue = !accountCheck.eligible;
                  const rowIssue = selected.has(payout.id) && accountIssue;
                  return (
                    <tr className={rowIssue ? 'row-error' : ''} key={payout.id}>
                      <td><input aria-label={`选择 ${payout.creator}`} type="checkbox" checked={selected.has(payout.id)} onChange={() => toggleOne(payout.id)} /></td>
                      <td><div className="creator-cell"><Avatar initials={payout.initials} accent={payout.accent} size="sm" /><span><strong>{payout.creator}</strong><small>{payout.invoice} · {payout.project}</small></span></div></td>
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
              <button className={`provider-option ${provider === option.id ? 'provider-selected' : ''}`} key={option.id} type="button" onClick={() => setProvider(option.id)}>
                <span className="provider-radio"><i /></span>
                <span><strong>{option.title}</strong><small>{option.description}</small></span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          <div className="validation-summary">
            <div><ShieldCheck size={20} /><span><strong>{mode === 'batch' ? '批次资料校验' : '单笔资料校验'}</strong><small>{passedCount} / {selectedPayouts.length} 笔通过</small></span></div>
            <StatusMark status={hasIssue ? '信息异常' : '等待付款'} />
          </div>
          {hasIssue ? <div className="inline-alert"><AlertTriangle size={17} />请先在达人档案处理 {issueCount} 笔账户资料，才能提交付款。</div> : null}
        </aside>
      </div>

      <footer className="batch-summary-bar">
        <div><span>已选 {selectedPayouts.length} 笔</span><strong>{Object.entries(totals).map(([currency, amount]) => `${currency} ${amount.toLocaleString('en-US')}`).join(' + ') || '—'}</strong></div>
        <div className="batch-actions"><Button variant="ghost" onClick={onCancel}>取消</Button><Button variant="secondary" onClick={onDraft}>保存草稿</Button><Button disabled={!canSubmit} onClick={() => onSubmit(selectedPayouts, provider)}>创建并提交</Button></div>
      </footer>

    </div>
  );
}
