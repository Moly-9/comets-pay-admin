import { CalendarDays, Plus, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Modal, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { Pagination } from '../components/Pagination';
import { getProjectFixture } from '../data';
import { isInvoiceApprovedForPayment } from '../invoice/invoiceReviewWorkflow';
import {
  aggregatePayoutCurrencies,
  getPaymentCurrencyOverviews,
  type PaymentCurrencyItem,
} from '../paymentCurrencyOverview';
import type { Payout } from '../types';

type WorkbenchTab = 'review' | 'payment' | 'paid' | 'returned';

type CurrencyOverviewId = 'pending' | 'paid';

const CURRENCY_OVERVIEW_META: Record<CurrencyOverviewId, {
  detailTitle: string;
  summaryLabel: string;
}> = {
  pending: { detailTitle: '待付款币种详情', summaryLabel: '待付款总额' },
  paid: { detailTitle: '本月已付款币种详情', summaryLabel: '本月已付款' },
};

const formatOverviewAmount = (amount: number) => amount.toLocaleString('en-US');

function CurrencyOverviewCard({
  id,
  items,
  onViewDetails,
}: {
  id: CurrencyOverviewId;
  items: PaymentCurrencyItem[];
  onViewDetails: () => void;
}) {
  const primary = items.find((item) => item.currency === 'USD')
    ?? { currency: 'USD', amount: 0, count: 0 };
  const secondary = items.filter((item) => item.currency !== 'USD');
  const hasDetails = items.length > 4;
  const visibleSecondary = secondary.slice(0, hasDetails ? 2 : 3);
  const meta = CURRENCY_OVERVIEW_META[id];

  return (
    <article
      className={`summary-card ${id === 'pending' ? 'summary-card-peach' : 'summary-card-lilac'} payment-workbench-summary-card`}
      aria-label={meta.summaryLabel}
    >
      <span className={`summary-illustration ${id === 'pending' ? 'summary-coins' : ''}`} aria-hidden="true">
        {id === 'pending' ? '◆' : <WalletCards size={27} />}
      </span>
      <div className="payment-summary-primary">
        <strong>USD {formatOverviewAmount(primary.amount)}</strong>
        <span>{meta.summaryLabel} · {primary.count} 笔</span>
      </div>
      {visibleSecondary.length || hasDetails ? (
        <div className="payment-summary-secondary" aria-label={`${meta.summaryLabel}其他币种`}>
          {visibleSecondary.map((item) => (
            <div className="payment-summary-secondary-row" key={item.currency}>
              <span>{item.currency}</span>
              <strong>{formatOverviewAmount(item.amount)}</strong>
              <small>{item.count} 笔</small>
            </div>
          ))}
          {hasDetails ? (
            <button className="payment-summary-details-button" type="button" onClick={onViewDetails}>
              查看详情
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function CurrencyOverviewModal({
  id,
  items,
  onClose,
}: {
  id: CurrencyOverviewId;
  items: PaymentCurrencyItem[];
  onClose: () => void;
}) {
  return (
    <Modal
      title={CURRENCY_OVERVIEW_META[id].detailTitle}
      width="460px"
      className="payment-currency-detail-modal"
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>关闭</Button>}
    >
      <div className="payment-currency-detail-table">
        <table>
          <thead>
            <tr><th>币种</th><th>金额</th><th>笔数</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.currency}>
                <td><strong>{item.currency}</strong></td>
                <td>{formatOverviewAmount(item.amount)}</td>
                <td>{item.count} 笔</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

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
  review: ['飞书审批中'],
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
  return aggregatePayoutCurrencies(payouts)
    .map(({ currency, amount }) => `${currency} ${formatOverviewAmount(amount)}`)
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
  currentDate = new Date(),
}: {
  payouts: Payout[];
  onNewBatch: () => void;
  onSelectPayout: (payout: Payout) => void;
  canCreateBatch: boolean;
  currentDate?: Date;
}) {
  const [showNotice, setShowNotice] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('review');
  const [provider, setProvider] = useState('全部渠道');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [detailOverview, setDetailOverview] = useState<CurrencyOverviewId | null>(null);

  const currencyOverviews = useMemo(
    () => getPaymentCurrencyOverviews(payouts, currentDate),
    [currentDate, payouts],
  );

  const filtered = useMemo(() => {
    const tabFiltered = payouts.filter((payout) => (
      isInvoiceApprovedForPayment(payout) && TAB_STATUSES[activeTab].includes(payout.status)
    ));
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
        amount: summarizePayoutAmounts(projectPayouts),
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
        .filter((payout) => (
          isInvoiceApprovedForPayment(payout) && TAB_STATUSES[tab.id].includes(payout.status)
        ))
        .map((payout) => payout.projectId),
    ).size,
  }), {
    review: 0,
    payment: 0,
    paid: 0,
    returned: 0,
  }), [payouts]);

  const filteredAmountSummary = useMemo(
    () => summarizePayoutAmounts(filtered),
    [filtered],
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

      <section className="summary-surface payment-workbench-summary" aria-label="付款概览">
        <CurrencyOverviewCard
          id="pending"
          items={currencyOverviews.pending}
          onViewDetails={() => setDetailOverview('pending')}
        />
        <CurrencyOverviewCard
          id="paid"
          items={currencyOverviews.paid}
          onViewDetails={() => setDetailOverview('paid')}
        />
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

      {detailOverview ? (
        <CurrencyOverviewModal
          id={detailOverview}
          items={currencyOverviews[detailOverview]}
          onClose={() => setDetailOverview(null)}
        />
      ) : null}
    </div>
  );
}
