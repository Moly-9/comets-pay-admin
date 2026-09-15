import { CalendarDays, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PaymentListRecord, RequestApprovalStatus } from '../businessWorkflow';
import { Button, ListActionButton, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { Pagination, usePagination } from '../components/Pagination';
import { PaymentCurrencySummaryCard } from '../components/PaymentCurrencySummaryCard';
import { PaymentExecutionWorkspace } from '../components/PaymentExecutionWorkspace';
import { PaymentProviderBadges } from '../components/PaymentProviderBadge';
import type { ContractRecord } from '../contracts';
import { getProjectFixture } from '../data';
import { isInvoiceApprovedForPayment } from '../invoice/invoiceReviewWorkflow';
import { paymentRequestProviderForChannel } from '../paymentRequestProjects';
import type { RequestProjectSummary } from './RequestProjectDetailPage';
import {
  aggregatePayoutCurrencies,
  getPaymentCurrencyOverviews,
  sortPaymentCurrencyItems,
  type PaymentCurrencyItem,
} from '../paymentCurrencyOverview';
import type { CreatorProfile, GeneratedInvoiceRecord, Payout } from '../types';
import {
  paymentExecutionDatesForPayouts,
  type PaymentBatchRecord,
} from '../paymentBatches';
import { paymentAttemptAmountTotals, paymentPayoutExpenditureTotals } from '../paymentAttempts';
import {
  ALL_PAYMENT_STATUSES,
  PAYMENT_STATUS_FILTER_OPTIONS,
  aggregatePaymentStatus,
  matchesPaymentStatus,
  type PaymentStatusFilter,
} from '../paymentStatusFilters';
import './PaymentWorkbenchPage.css';

export type WorkbenchTab = 'review' | 'payment' | 'paid' | 'returned';

type CurrencyOverviewId = 'pending' | 'paid';

const CURRENCY_OVERVIEW_META: Record<CurrencyOverviewId, {
  detailTitle: string;
  summaryLabel: string;
}> = {
  pending: { detailTitle: '待付款币种详情', summaryLabel: '待付款总额' },
  paid: { detailTitle: '本月已付款币种详情', summaryLabel: '本月已付款' },
};

const formatOverviewAmount = (amount: number) => amount.toLocaleString('en-US');

export { CURRENCY_FLAG_PATHS } from '../components/PaymentCurrencySummaryCard';

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

const workbenchActionKind = (label: string) => {
  if (label === '审核') return 'review' as const;
  if (label === '执行打款') return 'execute' as const;
  if (label.includes('失败')) return 'danger' as const;
  return 'view' as const;
};

const TAB_STATUSES: Record<WorkbenchTab, Payout['status'][]> = {
  review: ['飞书审批中'],
  payment: ['等待付款'],
  paid: ['付款处理中', '已付款', '付款失败'],
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

const ALL_PAYMENT_PROVIDERS = '全部付款渠道' as const;
export const ALL_REVIEW_STATUSES = '全部项目状态' as const;

type PaymentProviderFilter = typeof ALL_PAYMENT_PROVIDERS | Payout['provider'];
export type ReviewApprovalStatus = Extract<
  RequestApprovalStatus,
  'PENDING_PM' | 'PENDING_PROJECT_OWNER' | 'PENDING_OWNER' | 'PENDING_FINANCE'
>;
export type ReviewStatusFilter = typeof ALL_REVIEW_STATUSES | ReviewApprovalStatus;

const PAYMENT_PROVIDER_OPTIONS = [
  { value: ALL_PAYMENT_PROVIDERS, label: ALL_PAYMENT_PROVIDERS, description: '显示所有付款渠道' },
  { value: 'Airwallex', label: 'Airwallex', description: '国际银行转账' },
  { value: 'PayMax', label: 'Payer Max', description: '本地银行网络' },
  { value: 'PayPal', label: 'PayPal', description: '邮箱账户付款' },
] as const;

const PAYMENT_PROVIDERS: Payout['provider'][] = ['Airwallex', 'PayMax', 'PayPal'];

const REVIEW_STATUS_PRESENTATION: Record<ReviewApprovalStatus, {
  status: string;
  actionLabel: '查看详情' | '审核';
}> = {
  PENDING_PM: { status: '待PM审核', actionLabel: '查看详情' },
  PENDING_PROJECT_OWNER: { status: '待媒介负责人审核', actionLabel: '查看详情' },
  PENDING_OWNER: { status: '待老板审核', actionLabel: '查看详情' },
  PENDING_FINANCE: { status: '待财务审核', actionLabel: '审核' },
};

export const REVIEW_STATUS_FILTER_OPTIONS = [
  { value: ALL_REVIEW_STATUSES, label: ALL_REVIEW_STATUSES, description: '显示全部审批节点' },
  { value: 'PENDING_PM', label: REVIEW_STATUS_PRESENTATION.PENDING_PM.status, description: 'PM 审批节点' },
  { value: 'PENDING_PROJECT_OWNER', label: REVIEW_STATUS_PRESENTATION.PENDING_PROJECT_OWNER.status, description: '媒介负责人审批节点' },
  { value: 'PENDING_OWNER', label: REVIEW_STATUS_PRESENTATION.PENDING_OWNER.status, description: '老板审批节点' },
  { value: 'PENDING_FINANCE', label: REVIEW_STATUS_PRESENTATION.PENDING_FINANCE.status, description: '财务审批节点' },
] as const;

const REVIEW_APPROVAL_STATUSES = new Set<ReviewApprovalStatus>([
  'PENDING_PM',
  'PENDING_PROJECT_OWNER',
  'PENDING_OWNER',
  'PENDING_FINANCE',
]);

const isReviewApprovalStatus = (
  status?: RequestApprovalStatus,
): status is ReviewApprovalStatus => Boolean(status && REVIEW_APPROVAL_STATUSES.has(status as ReviewApprovalStatus));

export type PaymentProjectRow = {
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
  paymentChannels: Payout['provider'][];
  paymentEntity: string;
  amountTotals: PaymentCurrencyItem[];
  transferFeeTotals: PaymentCurrencyItem[];
  actualPaidTotals: PaymentCurrencyItem[];
  paymentSubmittedDates: string[];
  invoiceIds: string[];
  invoiceCurrencyById: Record<string, string>;
  status: string;
  actionLabel: string;
  payouts: Payout[];
  requestId?: string;
  approvalStatus?: ReviewApprovalStatus;
};

const summarizePayoutAmounts = (payouts: Payout[]) => {
  return aggregatePayoutCurrencies(payouts)
    .map(({ currency, amount }) => `${currency} ${formatOverviewAmount(amount)}`)
    .join(' · ');
};

const parsePaymentAmountSummary = (value: string): PaymentCurrencyItem[] => (
  Array.from(value.toUpperCase().matchAll(/\b([A-Z]{3})\s*([\d,]+(?:\.\d+)?)/g), (match) => ({
    currency: match[1],
    amount: Number(match[2].replace(/,/g, '')),
    count: 1,
  })).filter((item) => Number.isFinite(item.amount))
);

const paymentChannelsFor = (payouts: Payout[], fallback = '') => {
  const values = new Set(payouts.map((payout) => payout.provider));
  if (!values.size) {
    PAYMENT_PROVIDERS.forEach((provider) => {
      if (fallback.toLowerCase().includes(provider.toLowerCase())) values.add(provider);
    });
  }
  return PAYMENT_PROVIDERS.filter((provider) => values.has(provider));
};

const paymentChannelForRequest = (
  request: RequestProjectSummary,
  payouts: Payout[],
) => {
  const configuredProvider = paymentRequestProviderForChannel(request.paymentChannel);
  return configuredProvider
    ? [configuredProvider]
    : paymentChannelsFor(payouts, request.generatedDetail?.provider).slice(0, 1);
};

const paymentAmountTotalsFor = (payouts: Payout[], fallback: string) => (
  payouts.length ? aggregatePayoutCurrencies(payouts) : parsePaymentAmountSummary(fallback)
);

const paymentResultFieldsFor = (
  payouts: Payout[],
  paymentBatches: readonly PaymentBatchRecord[] = [],
) => {
  const resultPayouts = payouts.filter((payout) => ['已付款', '付款失败', '已退回'].includes(payout.status));
  const expenditureTotals = Array.from(resultPayouts.reduce<Map<string, PaymentCurrencyItem>>((result, payout) => {
    paymentPayoutExpenditureTotals(payout).forEach(({ currency, amount }) => {
      const current = result.get(currency) ?? { currency, amount: 0, count: 0 };
      result.set(currency, { currency, amount: current.amount + amount, count: current.count + 1 });
    });
    return result;
  }, new Map()).values());
  const transferFeeTotals = Array.from(resultPayouts.reduce<Map<string, PaymentCurrencyItem>>((result, payout) => {
    const totals = payout.paymentAttempts?.length
      ? paymentAttemptAmountTotals(payout.paymentAttempts, 'transferFeeAmount', 'transferFeeCurrency')
      : payout.transferFeeAmount !== undefined && payout.transferFeeCurrency
        ? [{ currency: payout.transferFeeCurrency, amount: payout.transferFeeAmount }]
        : [];
    totals.forEach(({ currency, amount }) => {
      const current = result.get(currency) ?? { currency, amount: 0, count: 0 };
      result.set(currency, { currency, amount: current.amount + amount, count: current.count + 1 });
    });
    return result;
  }, new Map()).values());
  const executionDates = paymentExecutionDatesForPayouts(payouts, paymentBatches).sort();
  return {
    transferFeeTotals: sortPaymentCurrencyItems(transferFeeTotals),
    actualPaidTotals: sortPaymentCurrencyItems(expenditureTotals),
    paymentSubmittedDates: executionDates.length ? [executionDates[executionDates.length - 1]] : [],
  };
};

const paymentResultFallback = (project: PaymentProjectRow) => (
  project.payouts.some((payout) => payout.status === '付款处理中') ? '待渠道回写' : '—'
);

const paymentProjectSearchText = (project: PaymentProjectRow) => [
  project.requestCode,
  project.cooperationProjectCode,
  project.cooperationProjectName,
  project.media,
  project.pm,
  project.amount,
  project.paymentEntity,
  ...project.transferFeeTotals.map((item) => `${item.currency} ${item.amount}`),
  ...project.actualPaidTotals.map((item) => `${item.currency} ${item.amount}`),
  ...project.paymentSubmittedDates,
  `${project.contracts}份合同`,
  `${project.invoices}份invoice`,
  project.paymentOrder,
  project.paymentChannels.join(' '),
  project.status,
  ...project.payouts.flatMap((payout) => [
    payout.creator,
    payout.handle,
    payout.project,
    payout.contract,
    payout.invoice,
    payout.provider,
    payout.currency,
    payout.account,
    payout.status,
  ]),
].join(' ').toLocaleLowerCase('zh-CN');

export const filterPaymentProjectRows = (
  projects: PaymentProjectRow[],
  filters: {
    search: string;
    provider: PaymentProviderFilter;
    status?: PaymentStatusFilter;
    reviewStatus?: ReviewStatusFilter;
  },
) => {
  const searchTerms = filters.search.trim().toLocaleLowerCase('zh-CN').split(/\s+/).filter(Boolean);
  return projects.filter((project) => {
    const matchesProvider = filters.provider === ALL_PAYMENT_PROVIDERS
      || project.paymentChannels.includes(filters.provider);
    const matchesStatus = matchesPaymentStatus(
      aggregatePaymentStatus(project.payouts.map((payout) => payout.status)),
      filters.status ?? ALL_PAYMENT_STATUSES,
    );
    const matchesReviewStatus = !filters.reviewStatus
      || filters.reviewStatus === ALL_REVIEW_STATUSES
      || project.approvalStatus === filters.reviewStatus;
    if (!matchesProvider || !matchesStatus || !matchesReviewStatus || !searchTerms.length) {
      return matchesProvider && matchesStatus && matchesReviewStatus;
    }
    const searchText = paymentProjectSearchText(project);
    return searchTerms.every((term) => searchText.includes(term));
  });
};

export const summarizePaymentProjectRows = (projects: PaymentProjectRow[]) => {
  const reviewRows = projects.filter((project) => project.approvalStatus);
  const reviewInvoiceCurrencyById = new Map(reviewRows.flatMap((project) => (
    Object.entries(project.invoiceCurrencyById)
  )));
  const amountTotals = projects.flatMap((project) => project.amountTotals)
    .reduce<Map<string, PaymentCurrencyItem>>((result, item) => {
      const current = result.get(item.currency) ?? { currency: item.currency, amount: 0, count: 0 };
      result.set(item.currency, {
        currency: item.currency,
        amount: current.amount + item.amount,
        count: current.count + item.count,
      });
      return result;
    }, new Map());
  if (reviewRows.length) {
    amountTotals.forEach((item, currency) => {
      amountTotals.set(currency, {
        ...item,
        count: [...reviewInvoiceCurrencyById.values()].filter((candidate) => candidate === currency).length,
      });
    });
  }
  const knownReviewInvoiceIds = new Set(reviewRows.flatMap((project) => project.invoiceIds));
  const reviewInvoiceFallbackCount = reviewRows.reduce((total, project) => (
    total + Math.max(0, project.invoices - project.invoiceIds.length)
  ), 0);
  return {
    projects: projects.length,
    contracts: projects.reduce((total, project) => total + project.contracts, 0),
    invoices: reviewRows.length
      ? knownReviewInvoiceIds.size + reviewInvoiceFallbackCount
      : projects.reduce((total, project) => total + project.invoices, 0),
    amounts: sortPaymentCurrencyItems(Array.from(amountTotals.values())),
  };
};

export const togglePaymentProjectSelection = (
  selectedIds: Set<string>,
  projectIds: string[],
) => {
  const next = new Set(selectedIds);
  const allSelected = projectIds.length > 0 && projectIds.every((id) => next.has(id));
  projectIds.forEach((id) => {
    if (allSelected) next.delete(id);
    else next.add(id);
  });
  return next;
};

const requestMatchesWorkbenchTab = (
  request: RequestProjectSummary,
  tab: WorkbenchTab,
  projectPayouts: Payout[],
) => {
  if (tab === 'review') {
    return request.lifecycle === 'SUBMITTED' && isReviewApprovalStatus(request.approval?.status);
  }
  if (tab === 'returned') {
    return request.lifecycle === 'RETURNED'
      && request.approval?.returnedFromStage === 'FINANCE';
  }
  if (request.lifecycle === 'COMPLETED') return tab === 'paid';
  if (request.lifecycle !== 'APPROVED') return false;

  const hasWaitingPayout = projectPayouts.some((payout) => payout.status === '等待付款');
  if (tab === 'payment') return !projectPayouts.length || hasWaitingPayout;
  return !hasWaitingPayout && projectPayouts.some((payout) => (
    payout.status === '付款处理中'
    || payout.status === '付款失败'
    || payout.status === '已付款'
  ));
};

const paymentProjectPresentation = (
  tab: WorkbenchTab,
  payouts: Payout[],
  approvalStatus?: RequestApprovalStatus,
) => {
  if (tab === 'review' && isReviewApprovalStatus(approvalStatus)) {
    return REVIEW_STATUS_PRESENTATION[approvalStatus];
  }
  if (tab === 'review') return { status: '待审核', actionLabel: '查看详情' };
  if (tab === 'returned') return { status: '已退回', actionLabel: '查看详情' };
  if (tab === 'payment') return { status: '待打款', actionLabel: '执行打款' };
  const status = aggregatePaymentStatus(payouts.map((payout) => payout.status));
  if (status === '全部失败' || status === '部分失败') {
    return { status, actionLabel: '处理失败' };
  }
  if (status === '付款处理中') return { status, actionLabel: '查看进度' };
  return { status, actionLabel: '查看详情' };
};

const paymentProjectStatusTone = (status: string) => {
  if (status === '部分失败' || status === '全部失败') return 'is-danger';
  if (status === '付款处理中') return 'is-processing';
  if (status === '已付款') return 'is-success';
  return '';
};

export const buildPaymentProjectRows = ({
  tab,
  payouts,
  requests,
  generatedInvoices,
  paymentBatches = [],
}: {
  tab: WorkbenchTab;
  payouts: Payout[];
  requests: RequestProjectSummary[];
  generatedInvoices: GeneratedInvoiceRecord[];
  paymentBatches?: readonly PaymentBatchRecord[];
}): PaymentProjectRow[] => {
  const invoiceById = new Map(generatedInvoices.map((invoice) => [invoice.invoiceId, invoice]));
  const requestProjectCodes = new Set(requests.flatMap((request) => [
    request.cooperationProjectCode,
    request.cooperationProjectId,
    request.projectId,
  ].filter((value): value is string => Boolean(value))));
  const requestRows = requests.flatMap((request): PaymentProjectRow[] => {
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
      if (!requestMatchesWorkbenchTab(request, tab, projectPayouts)) return [];
      const amount = tab === 'review'
        ? request.amount
        : projectPayouts.length ? summarizePayoutAmounts(projectPayouts) : request.amount;
      const presentation = paymentProjectPresentation(tab, projectPayouts, request.approval?.status);
      const paymentResults = paymentResultFieldsFor(projectPayouts, paymentBatches);
      const invoiceCurrencyCounts = [...invoiceIds].reduce<Map<string, number>>((counts, invoiceId) => {
        const currency = invoiceById.get(invoiceId)?.snapshot.currency;
        if (currency) counts.set(currency, (counts.get(currency) ?? 0) + 1);
        return counts;
      }, new Map());
      const invoiceCurrencyById = Object.fromEntries([...invoiceIds].flatMap((invoiceId) => {
        const currency = invoiceById.get(invoiceId)?.snapshot.currency;
        return currency ? [[invoiceId, currency]] : [];
      }));
      const amountTotals = tab === 'review'
        ? parsePaymentAmountSummary(request.amount).map((item) => ({
          ...item,
          count: invoiceCurrencyCounts.get(item.currency) ?? 0,
        }))
        : paymentAmountTotalsFor(projectPayouts, amount);
      return [{
        id: String(request.paymentRequestProjectId ?? request.id),
        requestId: request.id,
        requestCode: request.requestCode ?? request.id,
        cooperationProjectCode: request.cooperationProjectCode ?? String(request.cooperationProjectId ?? request.projectId ?? '待同步'),
        cooperationProjectName: request.cooperationProjectName ?? request.project,
        media: request.media,
        pm: request.pm,
        amount,
        contracts: request.contracts,
        invoices: invoiceIds.size || request.invoices,
        paymentOrder: request.paymentOrder,
        paymentChannels: paymentChannelForRequest(request, projectPayouts),
        paymentEntity: request.paymentEntity || '待补充',
        amountTotals,
        ...paymentResults,
        invoiceIds: [...invoiceIds],
        invoiceCurrencyById,
        status: presentation.status,
        actionLabel: presentation.actionLabel,
        payouts: projectPayouts,
        approvalStatus: isReviewApprovalStatus(request.approval?.status)
          ? request.approval.status
          : undefined,
      }];
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
    const presentation = paymentProjectPresentation(tab, projectPayouts);
    const paymentResults = paymentResultFieldsFor(projectPayouts, paymentBatches);
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
      paymentChannels: paymentChannelsFor(projectPayouts),
      paymentEntity: '待补充',
      amountTotals: aggregatePayoutCurrencies(projectPayouts),
      ...paymentResults,
      invoiceIds: [...new Set(projectPayouts.map((payout) => payout.invoice))],
      invoiceCurrencyById: Object.fromEntries(projectPayouts.map((payout) => [payout.invoice, payout.currency])),
      status: presentation.status,
      actionLabel: presentation.actionLabel,
      payouts: projectPayouts,
    };
  });
  return [...requestRows, ...legacyRows];
};

function PaymentProjectTable({
  projects,
  selectedIds,
  onToggleProject,
  onToggleAll,
  onSelect,
  emptyText,
}: {
  projects: PaymentProjectRow[];
  selectedIds: Set<string>;
  onToggleProject: (projectId: string) => void;
  onToggleAll: (projectIds: string[]) => void;
  onSelect: (project: PaymentProjectRow) => void;
  emptyText: string;
}) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const {
    page,
    pageItems: visibleProjects,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination(projects, { resetKey: projects.map((project) => project.id).join('|') });
  const selectedCount = projects.filter((project) => selectedIds.has(project.id)).length;
  const allSelected = projects.length > 0 && selectedCount === projects.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected;
    }
  }, [allSelected, selectedCount]);

  return (
    <div className="table-shell">
      <div
        className="table-scroll payment-project-table-scroll"
        role="region"
        aria-label="付款项目明细表，可横向滚动查看更多列"
        tabIndex={0}
      >
        <table className="data-table request-project-table payment-project-table">
          <thead>
            <tr>
              <th className="payment-project-select-cell">
                <label className="payment-project-select-control">
                  <span className="sr-only">全选当前筛选结果中的付款项目</span>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="全选当前筛选结果中的付款项目"
                    checked={allSelected}
                    disabled={!projects.length}
                    onChange={() => onToggleAll(projects.map((project) => project.id))}
                  />
                </label>
              </th>
              <th className="payment-project-code-heading">项目编号</th>
              <th className="payment-project-channel-heading">付款渠道</th>
              <th className="payment-project-entity-heading">付款主体</th>
              <th className="payment-project-associated-heading">关联项目</th>
              <th className="payment-project-money-heading">请款金额及币种</th>
              <th className="payment-project-money-heading">转账手续费及币种</th>
              <th className="payment-project-money-heading">总支出金额及币种</th>
              <th className="payment-project-date-heading">最后付款日期</th>
              <th className="payment-project-initiator-heading">发起人</th>
              <th className="payment-project-status-cell">项目状态</th>
              <th className="action-cell payment-project-action-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleProjects.length ? visibleProjects.map((project) => {
              const selected = selectedIds.has(project.id);
              return (
                <tr
                  className={`clickable-table-row${selected ? ' is-selected' : ''}`}
                  key={project.id}
                  aria-selected={selected}
                  onClick={() => onSelect(project)}
                >
                  <td className="payment-project-select-cell" onClick={(event) => event.stopPropagation()}>
                    <label className="payment-project-select-control">
                      <span className="sr-only">选择付款项目 {project.requestCode}</span>
                      <input
                        type="checkbox"
                        aria-label={`选择付款项目 ${project.requestCode}`}
                        checked={selected}
                        onChange={() => onToggleProject(project.id)}
                      />
                    </label>
                  </td>
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
                  <td className="payment-project-channel">
                    <PaymentProviderBadges compact providers={project.paymentChannels} />
                  </td>
                  <td className="payment-project-entity" title={project.paymentEntity}>{project.paymentEntity}</td>
                  <td className="payment-project-associated">
                    <strong title={project.cooperationProjectName}>{project.cooperationProjectName}</strong>
                    <small className="cell-subtext">{project.cooperationProjectCode}</small>
                  </td>
                  <td className="payment-project-money-cell">
                    <span className="payment-project-value-stack">
                      {project.amountTotals.length ? project.amountTotals.map((item) => (
                        <span key={item.currency}><strong>{item.currency}</strong> {formatOverviewAmount(item.amount)}</span>
                      )) : <span>{project.amount || '—'}</span>}
                    </span>
                  </td>
                  <td className="payment-project-money-cell">
                    <span className="payment-project-value-stack">
                      {project.transferFeeTotals.length ? project.transferFeeTotals.map((item) => (
                        <span key={item.currency}><strong>{item.currency}</strong> {formatOverviewAmount(item.amount)}</span>
                      )) : <span className="payment-project-value-muted">{paymentResultFallback(project)}</span>}
                    </span>
                  </td>
                  <td className="payment-project-money-cell">
                    <span className="payment-project-value-stack">
                      {project.actualPaidTotals.length ? project.actualPaidTotals.map((item) => (
                        <span key={item.currency}><strong>{item.currency}</strong> {formatOverviewAmount(item.amount)}</span>
                      )) : <span className="payment-project-value-muted">{paymentResultFallback(project)}</span>}
                    </span>
                  </td>
                  <td className="payment-project-date-cell">
                    <span className="payment-project-value-stack">
                      {project.paymentSubmittedDates.length
                        ? project.paymentSubmittedDates.map((date) => <span key={date}>{date}</span>)
                        : <span className="payment-project-value-muted">—</span>}
                    </span>
                  </td>
                  <td className="payment-project-initiator" title={project.media}>{project.media}</td>
                  <td className="payment-project-status-cell"><span className={`simple-status ${paymentProjectStatusTone(project.status)}`.trim()}><i />{project.status}</span></td>
                  <td className="action-cell payment-project-action-cell">
                    <ListActionButton
                      kind={workbenchActionKind(project.actionLabel)}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(project);
                      }}
                    >
                      {project.actionLabel}
                    </ListActionButton>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td className="request-project-empty" colSpan={12}>{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>共 {projects.length} 个项目{selectedCount ? `，已选 ${selectedCount} 个` : ''}</span>
        <Pagination
          ariaLabel="付款项目列表分页"
          page={page}
          pageSize={pageSize}
          total={projects.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}

export function PaymentWorkbenchPage({
  payouts,
  requests,
  generatedInvoices,
  paymentLists = [],
  contracts = [],
  creators = [],
  paymentBatches = [],
  onNewBatch,
  onSelectPayout,
  onSelectPaidProject,
  onOpenRequest,
  onReviewRequest,
  onExecuteRequest,
  onReturnRequest,
  onOpenContract,
  onOpenInvoice,
  canCreateBatch,
  initialTab = 'review',
  currentDate = new Date(),
}: {
  payouts: Payout[];
  requests: RequestProjectSummary[];
  generatedInvoices: GeneratedInvoiceRecord[];
  paymentLists?: PaymentListRecord[];
  contracts?: ContractRecord[];
  creators?: CreatorProfile[];
  paymentBatches?: readonly PaymentBatchRecord[];
  onNewBatch: () => void;
  onSelectPayout: (payout: Payout) => void;
  onSelectPaidProject: (project: PaymentProjectRow) => void;
  onOpenRequest: (requestId: string) => void;
  onReviewRequest: (requestId: string) => void;
  onExecuteRequest: (payouts: Payout[]) => boolean;
  onReturnRequest: (requestId: string, reason: string) => boolean;
  onOpenContract?: (request: RequestProjectSummary, contractId: string) => void;
  onOpenInvoice?: (request: RequestProjectSummary, invoiceId: GeneratedInvoiceRecord['invoiceId']) => void;
  canCreateBatch: boolean;
  initialTab?: WorkbenchTab;
  currentDate?: Date;
}) {
  const [showNotice, setShowNotice] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>(initialTab);
  const [provider, setProvider] = useState<PaymentProviderFilter>(ALL_PAYMENT_PROVIDERS);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>(ALL_PAYMENT_STATUSES);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusFilter>(ALL_REVIEW_STATUSES);
  const [searchByTab, setSearchByTab] = useState<Record<WorkbenchTab, string>>({
    review: '',
    payment: '',
    paid: '',
    returned: '',
  });
  const [selectedIdsByTab, setSelectedIdsByTab] = useState<Record<WorkbenchTab, Set<string>>>(() => ({
    review: new Set(),
    payment: new Set(),
    paid: new Set(),
    returned: new Set(),
  }));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentExecutionProjectId, setPaymentExecutionProjectId] = useState<string | null>(null);

  const currencyOverviews = useMemo(
    () => getPaymentCurrencyOverviews(payouts, currentDate),
    [currentDate, payouts],
  );

  const rowsByTab = useMemo(() => Object.fromEntries(TAB_LABELS.map((tab) => [
    tab.id,
    buildPaymentProjectRows({ tab: tab.id, payouts, requests, generatedInvoices, paymentBatches }),
  ])) as Record<WorkbenchTab, PaymentProjectRow[]>, [generatedInvoices, paymentBatches, payouts, requests]);
  const reviewSummary = useMemo(
    () => summarizePaymentProjectRows(rowsByTab.review),
    [rowsByTab],
  );
  const pendingCurrencyOverview = useMemo(() => {
    const amounts = [...reviewSummary.amounts];
    if (!amounts.some((item) => item.currency === 'USD')) {
      amounts.push({ currency: 'USD', amount: 0, count: 0 });
    }
    return sortPaymentCurrencyItems(amounts);
  }, [reviewSummary.amounts]);
  const paymentExecutionProject = paymentExecutionProjectId
    ? [...rowsByTab.payment, ...rowsByTab.returned]
      .find((project) => project.id === paymentExecutionProjectId)
    : undefined;
  const paymentExecutionVariant = paymentExecutionProject
    && rowsByTab.returned.some((project) => project.id === paymentExecutionProject.id)
    ? 'returned' as const
    : 'execution' as const;
  const paymentExecutionRequest = paymentExecutionProject?.requestId
    ? requests.find((request) => request.id === paymentExecutionProject.requestId)
    : undefined;
  const activeSearch = searchByTab[activeTab];
  const selectedIds = selectedIdsByTab[activeTab];
  const filteredProjects = useMemo(
    () => filterPaymentProjectRows(rowsByTab[activeTab], {
      provider,
      search: activeSearch,
      status: activeTab === 'paid' ? paymentStatus : ALL_PAYMENT_STATUSES,
      reviewStatus: activeTab === 'review' ? reviewStatus : ALL_REVIEW_STATUSES,
    }),
    [activeSearch, activeTab, paymentStatus, provider, reviewStatus, rowsByTab],
  );
  const selectedProjects = useMemo(
    () => filteredProjects.filter((project) => selectedIds.has(project.id)),
    [filteredProjects, selectedIds],
  );
  const displayedSummary = useMemo(
    () => summarizePaymentProjectRows(selectedProjects.length ? selectedProjects : filteredProjects),
    [filteredProjects, selectedProjects],
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

  const activeTabLabel = TAB_LABELS.find((tab) => tab.id === activeTab)?.label ?? '';
  const activeTabSummaryLabel = TAB_SUMMARY_LABELS[activeTab];
  const displayedAmountSummary = displayedSummary.amounts
    .map(({ currency, amount }) => `${currency} ${formatOverviewAmount(amount)}`)
    .join(' · ');

  useEffect(() => {
    setSelectedIdsByTab((current) => {
      let changed = false;
      const next = { ...current };
      TAB_LABELS.forEach((tab) => {
        const validIds = new Set(rowsByTab[tab.id].map((project) => project.id));
        const validSelection = new Set([...current[tab.id]].filter((id) => validIds.has(id)));
        if (validSelection.size !== current[tab.id].size) {
          next[tab.id] = validSelection;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [rowsByTab]);

  const clearActiveSelection = () => {
    setSelectedIdsByTab((current) => ({ ...current, [activeTab]: new Set() }));
  };

  const updateSearch = (value: string) => {
    setSearchByTab((current) => ({ ...current, [activeTab]: value }));
    clearActiveSelection();
  };

  const updateProvider = (value: PaymentProviderFilter) => {
    setProvider(value);
    clearActiveSelection();
  };

  const updatePaymentStatus = (value: PaymentStatusFilter) => {
    setPaymentStatus(value);
    clearActiveSelection();
  };

  const updateReviewStatus = (value: ReviewStatusFilter) => {
    setReviewStatus(value);
    clearActiveSelection();
  };

  const toggleProject = (projectId: string) => {
    setSelectedIdsByTab((current) => ({
      ...current,
      [activeTab]: togglePaymentProjectSelection(current[activeTab], [projectId]),
    }));
  };

  const toggleAllProjects = (projectIds: string[]) => {
    setSelectedIdsByTab((current) => ({
      ...current,
      [activeTab]: togglePaymentProjectSelection(current[activeTab], projectIds),
    }));
  };

  return (
    <div className="page-stack payment-workbench-page">
      <PageHeading
        title="付款工作台"
        subtitle="审核请款、组织付款批次，并追踪渠道回写状态。"
        actions={canCreateBatch ? <Button icon={<Plus size={17} />} onClick={onNewBatch}>新建付款批次</Button> : undefined}
      />

      {showNotice ? (
        <NoticeBanner onClose={() => setShowNotice(false)}>
          付款将通过已配置的 Airwallex、Payer Max 或 PayPal 渠道执行。提交前请确认 Invoice、收款主体与银行资料一致。
        </NoticeBanner>
      ) : null}

      <section className="summary-surface payment-workbench-summary" aria-label="付款概览">
        <PaymentCurrencySummaryCard
          items={pendingCurrencyOverview}
          summaryLabel={CURRENCY_OVERVIEW_META.pending.summaryLabel}
          detailTitle={CURRENCY_OVERVIEW_META.pending.detailTitle}
          summaryCount={reviewSummary.invoices}
          tone="peach"
          icon="pending"
        />
        <PaymentCurrencySummaryCard
          items={currencyOverviews.paid}
          summaryLabel={CURRENCY_OVERVIEW_META.paid.summaryLabel}
          detailTitle={CURRENCY_OVERVIEW_META.paid.detailTitle}
          tone="lilac"
          icon="paid"
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
          <label className="search-control payment-project-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label={`搜索${activeTabLabel}付款项目`}
              placeholder="搜索项目编号、关联项目、付款主体等"
              value={activeSearch}
              onChange={(event) => updateSearch(event.target.value)}
            />
          </label>
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
            onChange={updateProvider}
          />
          {activeTab === 'review' ? (
            <SelectField<ReviewStatusFilter>
              ariaLabel="项目状态"
              className="payment-review-status-select"
              value={reviewStatus}
              options={REVIEW_STATUS_FILTER_OPTIONS}
              onChange={updateReviewStatus}
            />
          ) : null}
          {activeTab === 'paid' ? (
            <SelectField<PaymentStatusFilter>
              ariaLabel="付款状态"
              className="payment-status-select"
              value={paymentStatus}
              options={PAYMENT_STATUS_FILTER_OPTIONS}
              onChange={updatePaymentStatus}
            />
          ) : null}
          <span className="filter-result">当前显示 {filteredProjects.length} 个项目</span>
        </div>

        <div className={`table-group-title payment-project-summary-bar${selectedProjects.length ? ' has-selection' : ''}`} aria-live="polite">
          <span className="payment-project-summary-title">
            <strong>付款项目</strong>
            <small>
              {selectedProjects.length
                ? `已选 ${selectedProjects.length} 个项目`
                : `${activeTabSummaryLabel} · ${filteredProjects.length} 个项目`}
            </small>
          </span>
          <span className="payment-project-summary-metrics">
            <span>合同 <strong>{displayedSummary.contracts}</strong> 份</span>
            <span>Invoice <strong>{displayedSummary.invoices}</strong> 份</span>
            <span>金额 <strong>{displayedAmountSummary || '暂无金额'}</strong></span>
          </span>
        </div>
        <PaymentProjectTable
          key={`${activeTab}-${provider}-${paymentStatus}-${reviewStatus}-${activeSearch}`}
          projects={filteredProjects}
          selectedIds={selectedIds}
          onToggleProject={toggleProject}
          onToggleAll={toggleAllProjects}
          onSelect={(project) => {
            if (activeTab === 'review' && project.requestId) {
              if (project.approvalStatus === 'PENDING_FINANCE') onReviewRequest(project.requestId);
              else onOpenRequest(project.requestId);
              return;
            }
            if (activeTab === 'payment' && project.requestId) {
              setPaymentExecutionProjectId(project.id);
              return;
            }
            if (activeTab === 'returned' && project.requestId) {
              setPaymentExecutionProjectId(project.id);
              return;
            }
            if (activeTab === 'paid') {
              onSelectPaidProject(project);
              return;
            }
            const payout = project.payouts[0];
            if (payout) onSelectPayout(payout);
          }}
          emptyText={activeSearch.trim()
            ? `未找到与“${activeSearch.trim()}”匹配的${activeTabLabel}付款项目，请尝试其他关键词`
            : activeTab === 'paid' && paymentStatus !== ALL_PAYMENT_STATUSES
              ? `当前付款状态下没有${activeTabLabel}付款项目`
              : activeTab === 'review' && reviewStatus !== ALL_REVIEW_STATUSES
                ? `当前项目状态下没有${activeTabLabel}付款项目`
              : provider !== ALL_PAYMENT_PROVIDERS
              ? `当前付款渠道下没有${activeTabLabel}付款项目`
              : `当前没有${activeTabLabel}付款项目`}
        />
      </section>
      {paymentExecutionProject && paymentExecutionRequest ? (
        <PaymentExecutionWorkspace
          request={paymentExecutionRequest}
          project={paymentExecutionProject}
          generatedInvoices={generatedInvoices}
          paymentLists={paymentLists}
          contracts={contracts}
          creators={creators}
          variant={paymentExecutionVariant}
          canExecute={canCreateBatch}
          onExecute={(projectPayouts) => {
            const executed = onExecuteRequest(projectPayouts);
            if (executed) setActiveTab('paid');
            return executed;
          }}
          onReturn={(reason) => onReturnRequest(paymentExecutionRequest.id, reason)}
          onOpenContract={(contractId) => onOpenContract?.(paymentExecutionRequest, contractId)}
          onOpenInvoice={(invoiceId) => onOpenInvoice?.(paymentExecutionRequest, invoiceId)}
          onClose={() => setPaymentExecutionProjectId(null)}
        />
      ) : null}
    </div>
  );
}
