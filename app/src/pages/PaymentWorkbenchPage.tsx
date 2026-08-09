import { CalendarDays, Plus, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Modal, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { Pagination } from '../components/Pagination';
import { getProjectFixture } from '../data';
import { isInvoiceApprovedForPayment } from '../invoice/invoiceReviewWorkflow';
import type { RequestProjectSummary } from './RequestProjectDetailPage';
import {
  aggregatePayoutCurrencies,
  getPaymentCurrencyOverviews,
  type PaymentCurrencyItem,
} from '../paymentCurrencyOverview';
import type { GeneratedInvoiceRecord, Payout } from '../types';

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

export const CURRENCY_FLAG_PATHS: Record<PaymentCurrencyItem['currency'], string> = {
  USD: '/currency-flags/us.svg',
  EUR: '/currency-flags/eu.svg',
  GBP: '/currency-flags/gb.svg',
  HKD: '/currency-flags/hk.svg',
  SGD: '/currency-flags/sg.svg',
};

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
  const visibleSecondary = secondary.slice(0, 4);
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
              <span>{formatOverviewAmount(item.amount)}</span>
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
      <ul className="payment-currency-detail-list" aria-label="币种金额和付款笔数">
        {items.map((item) => (
          <li className="payment-currency-detail-row" key={item.currency}>
            <img
              className="payment-currency-flag"
              src={CURRENCY_FLAG_PATHS[item.currency]}
              alt=""
              width="24"
              height="16"
            />
            <span className="payment-currency-detail-meta">
              <strong>{item.currency}</strong>
              <small>{item.count} 笔</small>
            </span>
            <strong className="payment-currency-detail-amount">
              {formatOverviewAmount(item.amount)} <small>{item.currency}</small>
            </strong>
          </li>
        ))}
      </ul>
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
  requestCode: string;
  cooperationProjectCode: string;
  cooperationProjectName: string;
  media: string;
  pm: string;
  amount: string;
  contracts: number;
  invoices: number;
  paymentOrder: string;
  status: string;
  actionLabel: string;
  payouts: Payout[];
  requestId?: string;
};

const summarizePayoutAmounts = (payouts: Payout[]) => {
  return aggregatePayoutCurrencies(payouts)
    .map(({ currency, amount }) => `${currency} ${formatOverviewAmount(amount)}`)
    .join(' · ');
};

const requestMatchesWorkbenchTab = (
  request: RequestProjectSummary,
  tab: WorkbenchTab,
) => {
  if (tab === 'review') {
    return request.lifecycle === 'SUBMITTED' && request.approval?.status === 'PENDING_FINANCE';
  }
  if (tab === 'payment') return request.lifecycle === 'APPROVED';
  if (tab === 'paid') return request.lifecycle === 'COMPLETED';
  return request.lifecycle === 'RETURNED';
};

export const buildPaymentProjectRows = ({
  tab,
  payouts,
  requests,
  generatedInvoices,
}: {
  tab: WorkbenchTab;
  payouts: Payout[];
  requests: RequestProjectSummary[];
  generatedInvoices: GeneratedInvoiceRecord[];
}): PaymentProjectRow[] => {
  const invoiceById = new Map(generatedInvoices.map((invoice) => [invoice.invoiceId, invoice]));
  const requestProjectCodes = new Set(requests.flatMap((request) => [
    request.cooperationProjectCode,
    request.cooperationProjectId,
    request.projectId,
  ].filter((value): value is string => Boolean(value))));
  const requestRows = requests
    .filter((request) => requestMatchesWorkbenchTab(request, tab))
    .map((request): PaymentProjectRow => {
      const invoiceIds = new Set([
        ...(request.invoiceIds ?? []),
        ...(request.creatorLinks ?? []).flatMap((link) => link.invoiceIds),
      ]);
      const sourcePayoutIds = new Set([...invoiceIds].flatMap((invoiceId) => {
        const invoice = invoiceById.get(invoiceId);
        return invoice ? [invoice.sourcePayoutId] : [];
      }));
      const projectPayouts = payouts.filter((payout) => (
        payout.paymentRequestProjectId === request.paymentRequestProjectId
        || sourcePayoutIds.has(payout.id)
      ));
      return {
        id: String(request.paymentRequestProjectId ?? request.id),
        requestId: request.id,
        requestCode: request.requestCode ?? request.id,
        cooperationProjectCode: request.cooperationProjectCode ?? String(request.cooperationProjectId ?? request.projectId ?? '待同步'),
        cooperationProjectName: request.cooperationProjectName ?? request.project,
        media: request.media,
        pm: request.pm,
        amount: projectPayouts.length ? summarizePayoutAmounts(projectPayouts) : request.amount,
        contracts: request.contracts,
        invoices: invoiceIds.size || request.invoices,
        paymentOrder: request.paymentOrder,
        status: tab === 'review' ? '待财务审核' : TAB_PROJECT_STATUS[tab],
        actionLabel: TAB_ACTION_LABELS[tab],
        payouts: projectPayouts,
      };
    });

  if (tab === 'review') return requestRows;

  const requestPayoutIds = new Set(requestRows.flatMap((row) => row.payouts.map((payout) => payout.id)));
  const legacyPayouts = payouts.filter((payout) => (
    !requestPayoutIds.has(payout.id)
    && !payout.paymentRequestProjectId
    && !requestProjectCodes.has(payout.projectId)
    && isInvoiceApprovedForPayment(payout)
    && TAB_STATUSES[tab].includes(payout.status)
  ));
  const legacyByProject = legacyPayouts.reduce<Map<string, Payout[]>>((result, payout) => {
    result.set(payout.projectId, [...(result.get(payout.projectId) ?? []), payout]);
    return result;
  }, new Map());
  const legacyRows = [...legacyByProject.entries()].map(([projectId, projectPayouts]): PaymentProjectRow => {
    const project = getProjectFixture(projectId);
    return {
      id: `legacy:${projectId}`,
      requestCode: projectId,
      cooperationProjectCode: projectId,
      cooperationProjectName: project?.name ?? projectPayouts[0].project,
      media: project?.media ?? '待同步',
      pm: project?.pm ?? '待同步',
      amount: summarizePayoutAmounts(projectPayouts),
      contracts: new Set(projectPayouts.map((payout) => payout.contract)).size,
      invoices: new Set(projectPayouts.map((payout) => payout.invoice)).size,
      paymentOrder: project?.paymentOrder ?? '待生成',
      status: TAB_PROJECT_STATUS[tab],
      actionLabel: TAB_ACTION_LABELS[tab],
      payouts: projectPayouts,
    };
  });
  return [...requestRows, ...legacyRows];
};

function PaymentProjectTable({
  projects,
  onSelect,
  emptyText,
}: {
  projects: PaymentProjectRow[];
  onSelect: (project: PaymentProjectRow) => void;
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
              <th>项目编号</th>
              <th>关联项目</th>
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
              return (
                <tr className="clickable-table-row" key={project.id} onClick={() => onSelect(project)}>
                  <td className="payment-project-code">
                    <button
                      className="request-project-link"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(project);
                      }}
                    >
                      <strong>{project.requestCode}</strong>
                    </button>
                  </td>
                  <td className="payment-project-associated">
                    <strong>{project.cooperationProjectName}</strong>
                    <small className="cell-subtext">{project.cooperationProjectCode}</small>
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
                        onSelect(project);
                      }}
                    >
                      {project.actionLabel}
                    </Button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td className="request-project-empty" colSpan={10}>{emptyText}</td>
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
  requests,
  generatedInvoices,
  onNewBatch,
  onSelectPayout,
  onReviewRequest,
  canCreateBatch,
  currentDate = new Date(),
}: {
  payouts: Payout[];
  requests: RequestProjectSummary[];
  generatedInvoices: GeneratedInvoiceRecord[];
  onNewBatch: () => void;
  onSelectPayout: (payout: Payout) => void;
  onReviewRequest: (requestId: string) => void;
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

  const rowsByTab = useMemo(() => Object.fromEntries(TAB_LABELS.map((tab) => [
    tab.id,
    buildPaymentProjectRows({ tab: tab.id, payouts, requests, generatedInvoices }),
  ])) as Record<WorkbenchTab, PaymentProjectRow[]>, [generatedInvoices, payouts, requests]);
  const filteredProjects = useMemo(() => (
    provider === '全部渠道'
      ? rowsByTab[activeTab]
      : rowsByTab[activeTab].filter((project) => (
          project.payouts.some((payout) => payout.provider === provider)
        ))
  ), [activeTab, provider, rowsByTab]);
  const filtered = useMemo(
    () => filteredProjects.flatMap((project) => project.payouts),
    [filteredProjects],
  );

  const statusCounts = useMemo(() => TAB_LABELS.reduce<Record<WorkbenchTab, number>>((counts, tab) => ({
    ...counts,
    [tab.id]: rowsByTab[tab.id].length,
  }), {
    review: 0,
    payment: 0,
    paid: 0,
    returned: 0,
  }), [rowsByTab]);

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
          onSelect={(project) => {
            if (activeTab === 'review' && project.requestId) {
              onReviewRequest(project.requestId);
              return;
            }
            const payout = project.payouts[0];
            if (payout) onSelectPayout(payout);
          }}
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
