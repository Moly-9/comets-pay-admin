import {
  ArrowUpRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileSignature,
  FolderKanban,
  ReceiptText,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { PageHeading } from '../components/Common';
import type { ContractRecord } from '../contracts';
import { MY_PROJECT_APPROVAL_STATUSES, myProjectStatusFor } from '../paymentRequestProjects';
import type { RequestProjectSummary } from './RequestProjectDetailPage';
import type {
  CreatorProfile,
  GeneratedInvoiceRecord,
  NavPage,
  Payout,
} from '../types';

type DashboardStageTone = 'peach' | 'amber' | 'lilac' | 'blue' | 'mint';

type DashboardStage = {
  id: string;
  label: string;
  value: number;
  tone: DashboardStageTone;
};

type DashboardRequestMetric = DashboardStage & {
  meta: string;
  icon: LucideIcon;
};

function DashboardRequestCard({ metric }: { metric: DashboardRequestMetric }) {
  const MetricIcon = metric.icon;

  return (
    <article
      className={`dashboard-request-card dashboard-request-card-${metric.tone}`}
      data-testid={`dashboard-request-card-${metric.id}`}
    >
      <div className="dashboard-request-card-head">
        <span>{metric.label}</span>
        <i aria-hidden="true"><MetricIcon size={18} /></i>
      </div>
      <div className="dashboard-request-card-value">
        <strong>{metric.value.toLocaleString('zh-CN')}</strong>
        <small>{metric.meta}</small>
      </div>
    </article>
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
  onNavigate: (page: NavPage) => void;
}) {
  const metrics = useMemo(() => {
    const requestStatuses = requests.map(myProjectStatusFor);
    const approvingRequests = requestStatuses.filter((status) => (
      MY_PROJECT_APPROVAL_STATUSES.has(status)
    )).length;
    const approvedRequests = requestStatuses.filter((status) => (
      status === '待打款' || status === '已付款'
    )).length;
    const paidRequests = requestStatuses.filter((status) => status === '已付款').length;

    const activeCreatorHandles = new Set(
      payouts
        .filter((payout) => payout.status !== '已付款' && payout.status !== '已退回')
        .map((payout) => payout.handle.toLowerCase()),
    );
    const activeCreators = creators.filter((creator) => (
      activeCreatorHandles.has(creator.handle.toLowerCase())
    )).length;

    const uploadedContracts = contracts.filter((contract) => !contract.isTemplate);
    const ongoingContractStatuses = new Set(['待解析', '待补字段', '已生效', '履约中', '待签署']);
    const ongoingContracts = uploadedContracts.filter((contract) => (
      ongoingContractStatuses.has(contract.status)
    )).length;
    const paidProjects = new Set(
      payouts.filter((payout) => payout.status === '已付款').map((payout) => payout.project),
    );
    const paidContracts = uploadedContracts.filter((contract) => paidProjects.has(contract.project)).length;

    const invoiceStatusById = new Map<string, string>();
    payouts.forEach((payout) => invoiceStatusById.set(payout.invoice, payout.invoiceReviewStatus));
    generatedInvoices.forEach((record) => {
      if (!invoiceStatusById.has(record.id)) invoiceStatusById.set(record.id, record.status);
    });
    const ongoingInvoices = Array.from(invoiceStatusById.values()).filter((status) => status !== '已通过').length;
    const paidInvoices = payouts.filter((payout) => payout.status === '已付款').length;

    return {
      requests: {
        total: requests.length,
        approving: approvingRequests,
        approved: approvedRequests,
        paid: paidRequests,
      },
      creators: {
        total: creators.length,
        active: activeCreators,
      },
      contracts: {
        total: uploadedContracts.length,
        ongoing: ongoingContracts,
        paid: paidContracts,
      },
      invoices: {
        total: invoiceStatusById.size,
        ongoing: ongoingInvoices,
        paid: paidInvoices,
      },
    };
  }, [contracts, creators, generatedInvoices, payouts, requests]);

  const requestMetrics: DashboardRequestMetric[] = [
    {
      id: 'total',
      label: '请款项目总数',
      value: metrics.requests.total,
      meta: '当前系统全部请款项目',
      tone: 'peach',
      icon: FolderKanban,
    },
    {
      id: 'approving',
      label: '审批中的项目',
      value: metrics.requests.approving,
      meta: '正在流程中流转',
      tone: 'amber',
      icon: Clock3,
    },
    {
      id: 'approved',
      label: '完成审批的项目',
      value: metrics.requests.approved,
      meta: '已完成审批节点',
      tone: 'lilac',
      icon: ClipboardCheck,
    },
    {
      id: 'paid',
      label: '已打款的项目',
      value: metrics.requests.paid,
      meta: '款项已完成支付',
      tone: 'mint',
      icon: CircleDollarSign,
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
              <DashboardRequestCard key={metric.id} metric={metric} />
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
              description="手动上传合同的推进与付款状态"
              icon={FileSignature}
              total={metrics.contracts.total}
              totalLabel="合同总数"
              stages={[
                {
                  id: 'ongoing',
                  label: '正在推进',
                  value: metrics.contracts.ongoing,
                  tone: 'lilac',
                },
                {
                  id: 'paid',
                  label: '已打款',
                  value: metrics.contracts.paid,
                  tone: 'mint',
                },
              ]}
              onOpen={() => onNavigate('contracts')}
            />
            <DashboardOverviewRow
              id="invoice"
              title="Invoice"
              description="Invoice 生成、推进与付款结果"
              icon={ReceiptText}
              total={metrics.invoices.total}
              totalLabel="Invoice 总数"
              stages={[
                {
                  id: 'ongoing',
                  label: '正在推进',
                  value: metrics.invoices.ongoing,
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
