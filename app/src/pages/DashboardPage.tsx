import {
  ArrowUpRight,
  CircleDollarSign,
  CircleX,
  ClipboardCheck,
  Clock3,
  FileSignature,
  FolderKanban,
  LoaderCircle,
  ReceiptText,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { PageHeading } from '../components/Common';
import { getContractManagementBucket, type ContractRecord } from '../contracts';
import { requestProjectStatusFor } from '../paymentRequestProjects';
import type { RequestProjectSummary } from './RequestProjectDetailPage';
import type {
  CreatorProfile,
  GeneratedInvoiceRecord,
  NavOptions,
  NavPage,
  Payout,
  RequestProjectStatusFilter,
} from '../types';

type DashboardStageTone = 'peach' | 'amber' | 'lilac' | 'blue' | 'mint' | 'rose';

type DashboardStage = {
  id: string;
  label: string;
  value: number;
  tone: DashboardStageTone;
};

type DashboardRequestMetric = DashboardStage & {
  meta: string;
  icon: LucideIcon;
  statusFilter: RequestProjectStatusFilter;
};

export type DashboardRequestMetrics = {
  total: number;
  approving: number;
  awaitingPayment: number;
  paid: number;
  processing: number;
  failed: number;
};

export const dashboardRequestMetricsFor = (
  requests: readonly RequestProjectSummary[],
  payouts: readonly Pick<Payout, 'paymentRequestProjectId' | 'status'>[],
): DashboardRequestMetrics => {
  const statuses = requests.map((request) => requestProjectStatusFor(request, payouts));
  const approving = statuses.filter((status) => (
    status === 'PM审批中'
    || status === '媒介负责人审批中'
    || status === '老板审批中'
    || status === '财务审批中'
  )).length;
  const awaitingPayment = statuses.filter((status) => status === '正在付款').length;
  const paid = statuses.filter((status) => status === '已付款').length;
  const processing = statuses.filter((status) => status === '付款处理中').length;
  const failed = statuses.filter((status) => status === '部分失败' || status === '全部失败').length;

  return {
    total: approving + awaitingPayment + paid + processing + failed,
    approving,
    awaitingPayment,
    paid,
    processing,
    failed,
  };
};

export type DashboardDocumentMetrics = {
  contracts: {
    total: number;
    processing: number;
    ready: number;
    expired: number;
  };
  invoices: {
    total: number;
    inProgress: number;
    paid: number;
  };
};

export const dashboardDocumentMetricsFor = (
  contracts: readonly ContractRecord[],
  payouts: readonly Pick<Payout, 'id' | 'invoice' | 'status'>[],
  generatedInvoices: readonly Pick<GeneratedInvoiceRecord, 'id' | 'invoiceId' | 'sourcePayoutId'>[],
): DashboardDocumentMetrics => {
  const uploadedContracts = contracts.filter((contract) => !contract.isTemplate);
  const contractBuckets = uploadedContracts.map((contract) => getContractManagementBucket(contract));

  const invoiceKeyBySourcePayoutId = new Map(
    generatedInvoices.map((invoice) => [invoice.sourcePayoutId, String(invoice.invoiceId)]),
  );
  const invoiceKeyByNumber = new Map(
    generatedInvoices.map((invoice) => [invoice.id, String(invoice.invoiceId)]),
  );
  const invoiceKeyForPayout = (payout: Pick<Payout, 'id' | 'invoice'>) => (
    invoiceKeyBySourcePayoutId.get(payout.id)
    ?? invoiceKeyByNumber.get(payout.invoice)
    ?? `legacy:${payout.invoice}`
  );
  const invoiceIds = new Set(generatedInvoices.map((invoice) => String(invoice.invoiceId)));
  payouts.forEach((payout) => invoiceIds.add(invoiceKeyForPayout(payout)));
  const paidInvoiceIds = new Set(
    payouts
      .filter((payout) => payout.status === '已付款')
      .map((payout) => invoiceKeyForPayout(payout)),
  );

  return {
    contracts: {
      total: uploadedContracts.length,
      processing: contractBuckets.filter((bucket) => (
        bucket === 'draft'
        || bucket === 'upload'
        || bucket === 'signature'
        || bucket === 'attention'
      )).length,
      ready: contractBuckets.filter((bucket) => bucket === 'ready').length,
      expired: contractBuckets.filter((bucket) => bucket === 'expired').length,
    },
    invoices: {
      total: invoiceIds.size,
      inProgress: invoiceIds.size - paidInvoiceIds.size,
      paid: paidInvoiceIds.size,
    },
  };
};

function DashboardRequestCard({
  metric,
  onOpen,
}: {
  metric: DashboardRequestMetric;
  onOpen: () => void;
}) {
  const MetricIcon = metric.icon;

  return (
    <button
      className={`dashboard-request-card dashboard-request-card-${metric.tone}`}
      data-testid={`dashboard-request-card-${metric.id}`}
      data-status-filter={metric.statusFilter}
      type="button"
      onClick={onOpen}
      aria-label={`查看${metric.label}`}
    >
      <div className="dashboard-request-card-head">
        <span>{metric.label}</span>
        <i aria-hidden="true"><MetricIcon size={18} /></i>
      </div>
      <div className="dashboard-request-card-value">
        <strong>{metric.value.toLocaleString('zh-CN')}</strong>
        <small>{metric.meta}</small>
      </div>
    </button>
  );
}

function DashboardOverviewRow({
  id,
  title,
  description,
  icon: RowIcon,
  total,
  totalLabel,
  stages,
  onOpen,
}: {
  id: 'creators' | 'contracts' | 'invoice';
  title: string;
  description: string;
  icon: LucideIcon;
  total: number;
  totalLabel: string;
  stages: DashboardStage[];
  onOpen: () => void;
}) {
  const safeTotal = Math.max(total, 1);

  return (
    <article className="dashboard-asset-row" data-testid={`dashboard-row-${id}`}>
      <div className="dashboard-asset-identity">
        <span className={`dashboard-asset-icon dashboard-asset-icon-${id}`} aria-hidden="true">
          <RowIcon size={21} />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="dashboard-asset-total">
        <strong>{total.toLocaleString('zh-CN')}</strong>
        <span>{totalLabel}</span>
      </div>

      <div className="dashboard-asset-stages">
        <div className="dashboard-asset-stage-values">
          {stages.map((stage) => (
            <span className="dashboard-asset-stage" key={stage.id}>
              <i className={`dashboard-stage-dot dashboard-stage-dot-${stage.tone}`} aria-hidden="true" />
              <small>{stage.label}</small>
              <strong>{stage.value.toLocaleString('zh-CN')}</strong>
            </span>
          ))}
        </div>
        <div
          className="dashboard-asset-progress"
          role="img"
          aria-label={stages.map((stage) => `${stage.label} ${stage.value}`).join('，')}
        >
          {stages.map((stage) => (
            <span
              className={`dashboard-progress-segment dashboard-progress-segment-${stage.tone}`}
              key={stage.id}
              style={{ width: `${Math.min((stage.value / safeTotal) * 100, 100)}%` }}
            />
          ))}
        </div>
      </div>

      <button className="dashboard-asset-link" type="button" onClick={onOpen}>
        查看详情
        <ArrowUpRight size={15} aria-hidden="true" />
      </button>
    </article>
  );
}

export function DashboardPage({
  requests,
  creators,
  contracts,
  payouts,
  generatedInvoices,
  onNavigate,
}: {
  requests: RequestProjectSummary[];
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  payouts: Payout[];
  generatedInvoices: GeneratedInvoiceRecord[];
  onNavigate: (page: NavPage, options?: NavOptions) => void;
}) {
  const metrics = useMemo(() => {
    const requestMetrics = dashboardRequestMetricsFor(requests, payouts);
    const documentMetrics = dashboardDocumentMetricsFor(contracts, payouts, generatedInvoices);

    const activeCreatorHandles = new Set(
      payouts
        .filter((payout) => payout.status !== '已付款' && payout.status !== '已退回')
        .map((payout) => payout.handle.toLowerCase()),
    );
    const activeCreators = creators.filter((creator) => (
      activeCreatorHandles.has(creator.handle.toLowerCase())
    )).length;

    return {
      requests: {
        ...requestMetrics,
      },
      creators: {
        total: creators.length,
        active: activeCreators,
      },
      contracts: documentMetrics.contracts,
      invoices: documentMetrics.invoices,
    };
  }, [contracts, creators, generatedInvoices, payouts, requests]);

  const requestMetrics: DashboardRequestMetric[] = [
    {
      id: 'total',
      label: '请款项目总数',
      value: metrics.requests.total,
      meta: '当前审批及付款流程中的项目',
      tone: 'peach',
      icon: FolderKanban,
      statusFilter: 'all',
    },
    {
      id: 'approving',
      label: '审批中的项目',
      value: metrics.requests.approving,
      meta: '正在流程中流转',
      tone: 'amber',
      icon: Clock3,
      statusFilter: 'approving',
    },
    {
      id: 'awaiting-payment',
      label: '待打款项目',
      value: metrics.requests.awaitingPayment,
      meta: '已完成审批，还未执行打款',
      tone: 'lilac',
      icon: ClipboardCheck,
      statusFilter: 'awaiting-payment',
    },
    {
      id: 'paid',
      label: '付款成功项目',
      value: metrics.requests.paid,
      meta: '全部付款明细已成功',
      tone: 'mint',
      icon: CircleDollarSign,
      statusFilter: 'paid',
    },
    {
      id: 'processing',
      label: '渠道处理中的项目',
      value: metrics.requests.processing,
      meta: '付款已发起，等待渠道结果',
      tone: 'blue',
      icon: LoaderCircle,
      statusFilter: 'processing',
    },
    {
      id: 'failed',
      label: '付款失败的项目',
      value: metrics.requests.failed,
      meta: '包含部分付款失败、全部付款失败',
      tone: 'rose',
      icon: CircleX,
      statusFilter: 'failed',
    },
  ];

  return (
    <div className="page-stack dashboard-page">
      <PageHeading
        title="数据工作台"
        subtitle="集中查看请款项目、达人档案、合同与 Invoice 的当前业务状态。"
      />

      <div className="dashboard-board" aria-label="业务数据看板">
        <section className="dashboard-request-summary" aria-labelledby="dashboard-request-title">
          <header className="dashboard-request-summary-head">
            <div>
              <h2 id="dashboard-request-title">请款项目概览</h2>
              <p>查看系统当前请款项目的审批与打款进度。</p>
            </div>
            <button
              className="dashboard-request-summary-link"
              type="button"
              onClick={() => onNavigate('requests')}
            >
              查看请款项目
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          </header>
          <div className="dashboard-request-card-grid" data-testid="dashboard-request-card-grid">
            {requestMetrics.map((metric) => (
              <DashboardRequestCard
                key={metric.id}
                metric={metric}
                onOpen={() => onNavigate('requests', { requestStatusFilter: metric.statusFilter })}
              />
            ))}
          </div>
        </section>

        <section className="dashboard-assets-panel" aria-labelledby="dashboard-assets-title">
          <header className="dashboard-assets-head">
            <div>
              <h2 id="dashboard-assets-title">业务资料概览</h2>
              <p>用统一视图观察达人、合同与 Invoice 的规模和推进状态。</p>
            </div>
            <span>3 类核心资料</span>
          </header>

          <div className="dashboard-asset-list">
            <DashboardOverviewRow
              id="creators"
              title="达人档案"
              description="合作达人资料与当前合作状态"
              icon={UsersRound}
              total={metrics.creators.total}
              totalLabel="档案总数"
              stages={[
                {
                  id: 'active',
                  label: '正在合作中',
                  value: metrics.creators.active,
                  tone: 'blue',
                },
              ]}
              onOpen={() => onNavigate('creators')}
            />
            <DashboardOverviewRow
              id="contracts"
              title="合同"
              description="待处理、待上传合同与付款可用状态"
              icon={FileSignature}
              total={metrics.contracts.total}
              totalLabel="合同总数"
              stages={[
                {
                  id: 'processing',
                  label: '处理中',
                  value: metrics.contracts.processing,
                  tone: 'lilac',
                },
                {
                  id: 'ready',
                  label: '可用于付款',
                  value: metrics.contracts.ready,
                  tone: 'mint',
                },
                {
                  id: 'expired',
                  label: '已失效',
                  value: metrics.contracts.expired,
                  tone: 'rose',
                },
              ]}
              onOpen={() => onNavigate('contracts')}
            />
            <DashboardOverviewRow
              id="invoice"
              title="Invoice"
              description="除已打款外的 Invoice 均计入正在推进"
              icon={ReceiptText}
              total={metrics.invoices.total}
              totalLabel="Invoice 总数"
              stages={[
                {
                  id: 'ongoing',
                  label: '正在推进',
                  value: metrics.invoices.inProgress,
                  tone: 'peach',
                },
                {
                  id: 'paid',
                  label: '已打款',
                  value: metrics.invoices.paid,
                  tone: 'mint',
                },
              ]}
              onOpen={() => onNavigate('invoice')}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
