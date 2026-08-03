import { CalendarDays, Plus, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { Pagination } from '../components/Pagination';
import { getProjectFixture } from '../data';
import type { Payout } from '../types';

type WorkbenchTab = 'review' | 'payment' | 'paid' | 'returned';

const TAB_LABELS: Array<{ id: WorkbenchTab; label: string }> = [
  { id: 'review', label: '待审核' },
  { id: 'payment', label: '待打款' },
  { id: 'paid', label: '已付款' },
  { id: 'returned', label: '已退回' },
];

const TAB_SUMMARY_LABELS: Record<WorkbenchTab, string> = {
  review: '待审核合计',
  payment: '待打款合计',
  paid: '已付款总金额',
  returned: '已退回总金额',
};

const TAB_STATUSES: Record<WorkbenchTab, Payout['status'][]> = {
  review: ['待财务复核'],
  payment: ['等待付款', '付款处理中'],
  paid: ['已付款'],
  returned: ['已退回'],
};

const TAB_PROJECT_STATUS: Record<WorkbenchTab, string> = {
  review: '待审核',
  payment: '待打款',
  paid: '已付款',
  returned: '已退回',
};

const TAB_ACTION_LABELS: Record<WorkbenchTab, string> = {
  review: '审核',
  payment: '执行打款',
  paid: '查看详情',
  returned: '查看原因',
};

const PAYMENT_PROVIDER_OPTIONS = [
  { value: '全部渠道', label: '全部渠道', description: '显示所有付款渠道' },
  { value: 'Airwallex', label: 'Airwallex', description: '国际银行转账' },
  { value: 'PayMax', label: 'PayMax', description: '本地银行网络' },
  { value: 'PayPal', label: 'PayPal', description: '邮箱账户付款' },
] as const;

type PaymentProjectRow = {
  id: string;
  project: string;
  media: string;
  pm: string;
  amount: string;
  contracts: number;
  invoices: number;
  paymentOrder: string;
  status: string;
  actionLabel: string;
  payouts: Payout[];
};

const summarizePayoutAmounts = (payouts: Payout[]) => {
  const totals = payouts.reduce<Record<string, number>>((result, payout) => ({
    ...result,
    [payout.currency]: (result[payout.currency] ?? 0) + payout.amount,
  }), {});
  return Object.entries(totals)
    .map(([currency, amount]) => `${currency} ${amount.toLocaleString('en-US')}`)
    .join(' · ');
};

const summarizeProjectAmounts = (projects: PaymentProjectRow[]) => {
  const totals = projects.reduce<Record<string, number>>((result, project) => {
    const currency = project.amount.match(/\b[A-Z]{3}\b/)?.[0];
    const amount = Number(project.amount.replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
    if (!currency) return result;
    return {
      ...result,
      [currency]: (result[currency] ?? 0) + amount,
    };
  }, {});
  return Object.entries(totals)
    .map(([currency, amount]) => `${currency} ${amount.toLocaleString('en-US')}`)
    .join(' · ');
};

function PaymentProjectTable({
  projects,
  onSelect,
  emptyText,
}: {
  projects: PaymentProjectRow[];
  onSelect: (payout: Payout) => void;
  emptyText: string;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(projects.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleProjects = projects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="table-shell">
      <div className="table-scroll">
        <table className="data-table request-project-table payment-project-table">
          <thead>
            <tr>
              <th>项目</th>
              <th>媒介</th>
              <th>负责 PM</th>
              <th>请款金额</th>
              <th>合同</th>
              <th>invoice</th>
              <th>付款单</th>
              <th>项目状态</th>
              <th className="action-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleProjects.length ? visibleProjects.map((project) => {
              const representativePayout = project.payouts[0];
              return (
                <tr className="clickable-table-row" key={project.id} onClick={() => onSelect(representativePayout)}>
                  <td>
                    <button
                      className="request-project-link"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(representativePayout);
                      }}
                    >
                      <strong>{project.project}</strong>
                      <small className="cell-subtext">{project.id}</small>
                    </button>
                  </td>
                  <td>{project.media}</td>
                  <td>{project.pm}</td>
                  <td>{project.amount}</td>
                  <td>{project.contracts} 份</td>
                  <td>{project.invoices} 份</td>
                  <td className="mono-cell">{project.paymentOrder}</td>
                  <td><span className="simple-status"><i />{project.status}</span></td>
                  <td className="action-cell">
                    <Button
                      variant={project.actionLabel === '审核' ? 'primary' : 'secondary'}
                      className="table-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(representativePayout);
                      }}
                    >
                      {project.actionLabel}
                    </Button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td className="request-project-empty" colSpan={9}>{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>共 {projects.length} 个项目</span>
        <Pagination
          ariaLabel="付款项目列表分页"
          page={currentPage}
          pageSize={pageSize}
          total={projects.length}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}

export function PaymentWorkbenchPage({
  payouts,
  onNewBatch,
  onSelectPayout,
  canCreateBatch,
}: {
  payouts: Payout[];
  onNewBatch: () => void;
  onSelectPayout: (payout: Payout) => void;
  canCreateBatch: boolean;
}) {
  const [showNotice, setShowNotice] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('review');
  const [provider, setProvider] = useState('全部渠道');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filtered = useMemo(() => {
    const tabFiltered = payouts.filter((payout) => TAB_STATUSES[activeTab].includes(payout.status));
    return provider === '全部渠道'
      ? tabFiltered
      : tabFiltered.filter((payout) => payout.provider === provider);
  }, [activeTab, payouts, provider]);

  const filteredProjects = useMemo(() => {
    const payoutsByProject = filtered.reduce<Map<string, Payout[]>>((result, payout) => {
      const current = result.get(payout.projectId) ?? [];
      result.set(payout.projectId, [...current, payout]);
      return result;
    }, new Map());

    return Array.from(payoutsByProject.entries()).map(([projectId, projectPayouts]): PaymentProjectRow => {
      const project = getProjectFixture(projectId);
      return {
        id: projectId,
        project: project?.name ?? projectPayouts[0].project,
        media: project?.media ?? '待同步',
        pm: project?.pm ?? '待同步',
        amount: project?.budget ?? summarizePayoutAmounts(projectPayouts),
        contracts: project?.creators ?? new Set(projectPayouts.map((payout) => payout.contract)).size,
        invoices: project?.creators ?? new Set(projectPayouts.map((payout) => payout.invoice)).size,
        paymentOrder: project?.paymentOrder ?? '待生成',
        status: TAB_PROJECT_STATUS[activeTab],
        actionLabel: TAB_ACTION_LABELS[activeTab],
        payouts: projectPayouts,
      };
    });
  }, [activeTab, filtered]);

  const statusCounts = useMemo(() => TAB_LABELS.reduce<Record<WorkbenchTab, number>>((counts, tab) => ({
    ...counts,
    [tab.id]: new Set(
      payouts
        .filter((payout) => TAB_STATUSES[tab.id].includes(payout.status))
        .map((payout) => payout.projectId),
    ).size,
  }), {
    review: 0,
    payment: 0,
    paid: 0,
    returned: 0,
  }), [payouts]);

  const filteredAmountSummary = useMemo(
    () => summarizeProjectAmounts(filteredProjects),
    [filteredProjects],
  );
  const activeTabLabel = TAB_LABELS.find((tab) => tab.id === activeTab)?.label ?? '';
  const activeTabSummaryLabel = TAB_SUMMARY_LABELS[activeTab];

  return (
    <div className="page-stack">
      <PageHeading
        title="付款工作台"
        subtitle="审核请款、组织付款批次，并追踪渠道回写状态。"
        actions={canCreateBatch ? <Button icon={<Plus size={17} />} onClick={onNewBatch}>新建付款批次</Button> : undefined}
      />

      {showNotice ? (
        <NoticeBanner onClose={() => setShowNotice(false)}>
          付款将通过已配置的 Airwallex、PayMax 或 PayPal 渠道执行。提交前请确认 Invoice、收款主体与银行资料一致。
        </NoticeBanner>
      ) : null}

      <section className="summary-surface" aria-label="付款概览">
        <article className="summary-card summary-card-peach">
          <span className="summary-illustration summary-coins" aria-hidden="true">◆</span>
          <div><strong>USD 48,210</strong><span>待付款总额 · 24 笔</span></div>
        </article>
        <article className="summary-card summary-card-lilac">
          <span className="summary-illustration" aria-hidden="true"><WalletCards size={27} /></span>
          <div><strong>USD 128,640</strong><span>本月已付款 · 86 笔</span></div>
        </article>
      </section>

      <section className="operations-card">
        <div className="tabs-row" role="tablist" aria-label="付款状态">
          {TAB_LABELS.map((tab) => (
            <button
              className={`tab-button ${activeTab === tab.id ? 'tab-active' : ''}`}
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}<span>{statusCounts[tab.id]}</span>
            </button>
          ))}
        </div>

        <div className="filter-row">
          <div className="date-filter">
            <CalendarDays size={17} />
            <label>
              <span className="sr-only">开始日期</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <span className="date-divider">—</span>
            <label>
              <span className="sr-only">结束日期</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </div>
          <SelectField
            ariaLabel="付款渠道"
            className="dashboard-provider-select"
            value={provider}
            options={PAYMENT_PROVIDER_OPTIONS}
            onChange={setProvider}
          />
          <span className="filter-result">当前显示 {filteredProjects.length} 个项目</span>
        </div>

        <div className="table-group-title">
          <span>付款项目</span>
          <strong>{activeTabSummaryLabel}：{filteredAmountSummary || '暂无金额'}</strong>
        </div>
        <PaymentProjectTable
          key={`${activeTab}-${provider}`}
          projects={filteredProjects}
          onSelect={onSelectPayout}
          emptyText={`当前没有${activeTabLabel}付款项目`}
        />
      </section>
    </div>
  );
}
