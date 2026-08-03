import {
  ArrowLeft,
  Check,
  Clock3,
  FileText,
  ReceiptText,
  WalletCards,
} from 'lucide-react';
import { useState } from 'react';
import { PageHeading } from '../components/Common';
import type {
  ProjectResourceKind,
  ProjectResourceRecord,
  ProjectResourceRecords,
  ProjectResourceViewerState,
} from '../projectResources';
import { ProjectDocumentDetailPage } from './ProjectDocumentDetailPage';
import { ProjectResourceViewer } from './ProjectDetailPage';

export type RequestProjectSummary = {
  id: string;
  project: string;
  brand: string;
  media: string;
  pm: string;
  amount: string;
  contracts: number;
  invoices: number;
  paymentOrder: string;
  status: string;
  filter: 'pending' | 'processed';
  generatedDetail?: {
    brand: string;
    reason: string;
    contractId: string;
    contractName: string;
    contractAmount: string;
    contractStatus: string;
    invoiceId: string;
    invoiceAmount: string;
    invoiceStatus: string;
    paymentListId: string;
    paymentListStatus: string;
    payee: string;
    provider: string;
    beneficiaryId: string;
    feePolicy: string;
  };
};

type RequestResource = {
  id: string;
  meta: string;
  status: string;
};

type RequestPayee = {
  name: string;
  invoice: string;
  amount: string;
  channel: string;
  status: string;
};

type RequestProgress = {
  label: string;
  description: string;
  time: string;
  state: 'complete' | 'current' | 'pending';
};

type RequestProjectDetail = {
  brand: string;
  submitter: string;
  approver: string;
  submittedAt: string;
  updatedAt: string;
  reason: string;
  contract: RequestResource;
  invoice: RequestResource;
  payment: RequestResource;
  payees: RequestPayee[];
  progress: RequestProgress[];
};

type Notify = (title: string, message: string) => void;

const REQUEST_CREATOR_NAMES: Record<string, string[]> = {
  'PRJ-260718': ['@MinaKato', 'Yuki Tanaka', 'Camila Costa', 'Oliver Chen', 'Alex Ruiz', 'Hannah Lee'],
  'PRJ-260716': ['Alex Ruiz', 'Hannah Lee', 'Luca Bianchi'],
  'PRJ-260711': ['@Luna_J', 'Emily Wong', 'Marc O.', 'Sofia Kim', 'Noah Park'],
  'PRJ-260625': [
    'Kenji Mori',
    '@MinaKato',
    'Nika Petrova',
    'Aoi Sato',
    'Riku Tanaka',
    'Mei Kobayashi',
    'Haru Ito',
    'Ren Yamada',
    'Yuna Suzuki',
    'Kaito Watanabe',
    'Sora Nakamura',
    'Mio Takahashi',
    'Hinata Kato',
    'Rin Yoshida',
    'Yuto Yamamoto',
    'Akari Inoue',
  ],
};

const REQUEST_PROJECT_DETAILS: Record<string, RequestProjectDetail> = {
  'PRJ-260718': {
    brand: 'Solara Beauty',
    submitter: '媒介演示用户 A',
    approver: '财务演示用户 A',
    submittedAt: '2026-07-18 09:36',
    updatedAt: '今天 10:12',
    reason: '结算夏日直播计划首期达人合作、内容制作及素材授权费用。',
    contract: { id: 'CON-260718-01', meta: '1 份已签署合同 · USD 32,000', status: '已归档' },
    invoice: { id: '6 份 Invoice', meta: '请款金额 USD 18,420', status: '已校验' },
    payment: { id: 'PAY-260718-04', meta: '多渠道 · 分组付款', status: '待打款' },
    payees: [
      { name: '@MinaKato', invoice: 'INV-240718', amount: 'USD 3,240', channel: 'Airwallex', status: '待打款' },
      { name: 'Yuki Tanaka', invoice: 'INV-240719', amount: 'USD 2,180', channel: 'PayPal', status: '待打款' },
      { name: 'Camila Costa', invoice: 'INV-240720', amount: 'USD 2,760', channel: 'PayMax', status: '待打款' },
    ],
    progress: [
      { label: '请款提交', description: '合同、Invoice 与付款名单已提交', time: '07-18 09:36', state: 'complete' },
      { label: 'PM 审批', description: 'PM 演示用户 A已确认项目资料与请款范围', time: '07-18 10:05', state: 'complete' },
      { label: '项目负责人审批', description: '项目资料与预算已通过', time: '07-18 11:10', state: 'complete' },
      { label: '老板审批', description: 'heather 已完成最终业务审批', time: '07-19 09:20', state: 'complete' },
      { label: '财务审批', description: '正在核对收款主体与金额', time: '今天 10:12', state: 'current' },
      { label: '渠道付款', description: '按各达人收款账户渠道分组执行', time: '待开始', state: 'pending' },
    ],
  },
  'PRJ-260716': {
    brand: 'Nova Lab',
    submitter: '媒介演示用户 B',
    approver: 'PM 演示用户 B',
    submittedAt: '2026-07-16 14:20',
    updatedAt: '昨天 16:20',
    reason: '支付新品开箱项目的达人内容制作、样品拍摄与广告授权费用。',
    contract: { id: 'CON-260716-03', meta: '1 份合同 · EUR 18,500', status: '已签署' },
    invoice: { id: '3 份 Invoice', meta: '请款金额 EUR 6,200', status: '已校验' },
    payment: { id: '待生成', meta: '审批通过后自动生成付款单', status: '未生成' },
    payees: [
      { name: 'Alex Ruiz', invoice: 'INV-240716-A', amount: 'EUR 2,450', channel: 'PayMax', status: '待审批' },
      { name: 'Hannah Lee', invoice: 'INV-240716-B', amount: 'EUR 1,850', channel: 'PayPal', status: '待审批' },
      { name: 'Luca Bianchi', invoice: 'INV-240716-C', amount: 'EUR 1,900', channel: 'PayMax', status: '待审批' },
    ],
    progress: [
      { label: '请款提交', description: '项目资料已提交', time: '07-16 14:20', state: 'complete' },
      { label: 'PM 审批', description: '等待PM 演示用户 B确认项目资料与请款范围', time: '待审批', state: 'current' },
      { label: '项目负责人审批', description: 'PM 审批通过后进入', time: '待开始', state: 'pending' },
      { label: '老板审批', description: '项目负责人审批通过后进入', time: '待开始', state: 'pending' },
      { label: '财务审批', description: '老板审批通过后进入', time: '待开始', state: 'pending' },
      { label: '渠道付款', description: '付款单生成后执行', time: '待开始', state: 'pending' },
    ],
  },
  'PRJ-260711': {
    brand: 'Mellow Home',
    submitter: '媒介演示用户 C',
    approver: 'PM 演示用户 C',
    submittedAt: '2026-07-11 10:15',
    updatedAt: '2026-07-18 17:40',
    reason: '结算七月联名内容合作费用及达人素材授权费用。',
    contract: { id: 'CON-260711-02', meta: '2 份合同 · USD 24,000', status: '已签署' },
    invoice: { id: '5 份 Invoice', meta: '其中 1 份收款账号待补充', status: '待补资料' },
    payment: { id: '待生成', meta: '资料补齐且审批通过后生成', status: '未生成' },
    payees: [
      { name: '@Luna_J', invoice: 'INV-240711-A', amount: 'USD 4,200', channel: 'Airwallex', status: '资料完整' },
      { name: 'Emily Wong', invoice: 'INV-240711-B', amount: 'USD 3,600', channel: 'Airwallex', status: '资料完整' },
      { name: 'Marc O.', invoice: 'INV-240711-C', amount: 'USD 2,100', channel: 'PayPal', status: '待补资料' },
    ],
    progress: [
      { label: '请款提交', description: '发现 1 份 PayPal 收款资料不完整，等待媒介补充', time: '07-18 17:40', state: 'current' },
      { label: 'PM 审批', description: '资料补齐后由PM 演示用户 C审批', time: '待开始', state: 'pending' },
      { label: '项目负责人审批', description: 'PM 审批通过后进入', time: '待开始', state: 'pending' },
      { label: '老板审批', description: '项目负责人审批通过后进入', time: '待开始', state: 'pending' },
      { label: '财务审批', description: '老板审批通过后进入', time: '待开始', state: 'pending' },
      { label: '渠道付款', description: '付款单生成后执行', time: '待开始', state: 'pending' },
    ],
  },
  'PRJ-260625': {
    brand: 'Aster Mobile',
    submitter: '媒介演示用户 A',
    approver: '财务演示用户 A',
    submittedAt: '2026-06-25 14:00',
    updatedAt: '2026-07-16 15:00',
    reason: '结算日本市场测评项目全部达人合作与内容授权费用。',
    contract: { id: 'CON-260625-06', meta: '1 份合同 · USD 41,200', status: '已归档' },
    invoice: { id: '16 份 Invoice', meta: '请款金额 USD 41,200', status: '已通过' },
    payment: { id: 'PAY-260625-12', meta: 'Airwallex · 16 笔付款', status: '已完成' },
    payees: [
      { name: 'Kenji Mori', invoice: 'INV-240625-A', amount: 'USD 3,800', channel: 'Airwallex', status: '已付款' },
      { name: '@MinaKato', invoice: 'INV-240625-B', amount: 'USD 3,240', channel: 'Airwallex', status: '已付款' },
      { name: 'Nika', invoice: 'INV-240625-C', amount: 'USD 2,980', channel: 'PayPal', status: '已付款' },
    ],
    progress: [
      { label: '请款提交', description: '合同、Invoice 与付款名单已提交', time: '06-25 14:00', state: 'complete' },
      { label: 'PM 审批', description: 'PM 演示用户 A已确认项目资料与请款范围', time: '06-25 16:10', state: 'complete' },
      { label: '项目负责人审批', description: '项目与请款金额已通过', time: '06-26 10:20', state: 'complete' },
      { label: '老板审批', description: 'theo 已完成最终业务审批', time: '06-27 11:30', state: 'complete' },
      { label: '财务审批', description: '收款主体与金额已通过', time: '06-28 16:45', state: 'complete' },
      { label: '渠道付款', description: '16 笔付款全部成功', time: '07-16 14:32', state: 'complete' },
    ],
  },
};

function getRequestProjectDetail(request: RequestProjectSummary): RequestProjectDetail {
  if (request.generatedDetail) {
    const generated = request.generatedDetail;
    const hasContract = request.contracts > 0;
    return {
      brand: generated.brand,
      submitter: request.media,
      approver: request.pm,
      submittedAt: '刚刚',
      updatedAt: '刚刚',
      reason: generated.reason,
      contract: hasContract
        ? {
            id: generated.contractId,
            meta: `${generated.contractName} · ${generated.contractAmount}`,
            status: generated.contractStatus,
          }
        : {
            id: '未关联合同',
            meta: '合同为选填项，可在后续补充',
            status: '未关联',
          },
      invoice: {
        id: generated.invoiceId,
        meta: `${generated.payee} · ${generated.invoiceAmount}`,
        status: generated.invoiceStatus,
      },
      payment: {
        id: generated.paymentListId,
        meta: `${generated.provider} · ${generated.beneficiaryId} · ${generated.feePolicy}`,
        status: generated.paymentListStatus,
      },
      payees: [
        {
          name: generated.payee,
          invoice: generated.invoiceId,
          amount: generated.invoiceAmount,
          channel: generated.provider,
          status: '待审批',
        },
      ],
      progress: [
        {
          label: '请款提交',
          description: hasContract
            ? `合同、Invoice 与 ${generated.paymentListId} 已提交`
            : `Invoice 与 ${generated.paymentListId} 已提交，合同未关联（选填）`,
          time: '刚刚',
          state: 'complete',
        },
        { label: 'PM 审批', description: `等待${request.pm}确认项目资料与请款范围`, time: '待审批', state: 'current' },
        { label: '项目负责人审批', description: 'PM 审批通过后进入', time: '待开始', state: 'pending' },
        { label: '老板审批', description: '项目负责人审批通过后进入', time: '待开始', state: 'pending' },
        { label: '财务审批', description: '老板审批通过后进入', time: '待开始', state: 'pending' },
        { label: '渠道付款', description: `审批完成后通过${generated.provider}执行`, time: '待开始', state: 'pending' },
      ],
    };
  }

  const processed = request.filter === 'processed';
  const paymentGenerated = request.paymentOrder !== '待生成';
  return REQUEST_PROJECT_DETAILS[request.id] ?? {
    brand: request.brand,
    submitter: request.media,
    approver: request.pm,
    submittedAt: '已从项目系统同步',
    updatedAt: '今天',
    reason: `结算${request.project}的达人合作、内容制作及授权费用。`,
    contract: {
      id: `${request.contracts} 份合同`,
      meta: `对应 ${request.invoices} 份 Invoice · 与达人一一签约`,
      status: processed ? '已归档' : '已签署',
    },
    invoice: {
      id: `${request.invoices} 份 Invoice`,
      meta: `对应 ${request.contracts} 份合同 · 请款金额 ${request.amount}`,
      status: processed ? '已通过' : request.status === '待补资料' ? '待补资料' : '已校验',
    },
    payment: {
      id: request.paymentOrder,
      meta: paymentGenerated ? `${request.invoices} 笔达人付款明细` : '请款审核通过后生成',
      status: processed ? '已完成' : request.status === '待打款' ? '待打款' : '审批中',
    },
    payees: [],
    progress: [
      { label: '请款提交', description: '合同、Invoice 与付款名单已同步', time: '已完成', state: 'complete' },
      { label: 'PM 审批', description: processed ? `${request.pm}已完成审核` : `由${request.pm}审核项目资料`, time: processed ? '已完成' : '处理中', state: processed ? 'complete' : 'current' },
      { label: '项目负责人审批', description: processed ? '项目资料与预算已通过' : 'PM 审批通过后进入', time: processed ? '已完成' : '待开始', state: processed ? 'complete' : 'pending' },
      { label: '老板审批', description: processed ? '业务审批已完成' : '项目负责人审批通过后进入', time: processed ? '已完成' : '待开始', state: processed ? 'complete' : 'pending' },
      { label: '财务审批', description: processed ? '收款主体与金额已通过' : '老板审批通过后进入', time: processed ? '已完成' : '待开始', state: processed ? 'complete' : 'pending' },
      { label: '渠道付款', description: processed ? '付款已完成' : '全部审批完成后执行', time: processed ? '已完成' : '待开始', state: processed ? 'complete' : 'pending' },
    ],
  };
}

const parseAmount = (value: string) => {
  const amount = Number(value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
  const currency = value.match(/\b(USD|EUR|GBP|HKD)\b/i)?.[1]?.toUpperCase() ?? 'USD';
  return { amount, currency };
};

function getRequestPayees(
  request: RequestProjectSummary,
  detail: RequestProjectDetail,
): RequestPayee[] {
  if (detail.payees.length >= request.invoices) return detail.payees.slice(0, request.invoices);
  const names = REQUEST_CREATOR_NAMES[request.id] ?? [];
  const requestMoney = parseAmount(request.amount);
  const existingTotal = detail.payees.reduce((sum, payee) => sum + parseAmount(payee.amount).amount, 0);
  const missingCount = Math.max(request.invoices - detail.payees.length, 0);
  const defaultAmount = missingCount > 0 ? Math.max((requestMoney.amount - existingTotal) / missingCount, 0) : 0;
  const projectCode = request.id.replace('PRJ-', '');
  const missing = Array.from({ length: missingCount }, (_, index) => {
    const position = detail.payees.length + index;
    const name = names[position] ?? `项目达人 ${String(position + 1).padStart(2, '0')}`;
    const isLast = index === missingCount - 1;
    const roundedAmount = isLast
      ? Math.max(requestMoney.amount - existingTotal - Math.round(defaultAmount) * (missingCount - 1), 0)
      : Math.round(defaultAmount);
    return {
      name,
      invoice: `INV-${projectCode}-${String(position + 1).padStart(2, '0')}`,
      amount: `${requestMoney.currency} ${roundedAmount.toLocaleString('en-US')}`,
      channel: position % 3 === 1 ? 'PayPal' : position % 3 === 2 ? 'PayMax' : 'Airwallex',
      status: request.status === '已完成' ? '已付款' : request.status,
    };
  });
  return [...detail.payees, ...missing];
}

function getRequestProjectResourceRecords(
  request: RequestProjectSummary,
  detail: RequestProjectDetail,
  payees: RequestPayee[],
): ProjectResourceRecords {
  const projectCode = request.id.replace('PRJ-', '');
  const invoices: ProjectResourceRecord[] = payees.map((payee, index) => ({
    id: payee.invoice,
    title: payee.name,
    subtitle: `${detail.submittedAt.split(' ')[0]} · ${payee.channel}`,
    amount: payee.amount,
    status: detail.invoice.status,
    channel: payee.channel,
    fields: [
      { label: 'Invoice 编号', value: payee.invoice },
      { label: '达人 / 收款人', value: payee.name },
      { label: '关联项目', value: request.project },
      { label: 'Invoice 日期', value: detail.submittedAt.split(' ')[0] },
      { label: '付款渠道', value: payee.channel },
      { label: '金额', value: payee.amount },
      { label: '审核状态', value: detail.invoice.status },
    ],
  }));
  const contracts: ProjectResourceRecord[] = invoices.slice(0, request.contracts).map((invoice, index) => {
    const contractId = `CON-${projectCode}-${String(index + 1).padStart(2, '0')}`;
    return {
      id: contractId,
      title: `${invoice.title} 达人合作协议`,
      subtitle: `${invoice.title} · ${detail.brand}`,
      amount: invoice.amount,
      status: detail.contract.status,
      channel: invoice.channel,
      fields: [
        { label: '合同编号', value: contractId },
        { label: '签约达人', value: invoice.title },
        { label: '合作品牌', value: detail.brand },
        { label: '关联项目', value: request.project },
        { label: '合同金额', value: invoice.amount },
        { label: '关联 Invoice', value: invoice.id },
        { label: '签署状态', value: detail.contract.status },
        { label: '签署 / 更新时间', value: detail.submittedAt },
        { label: '归档文件', value: `${contractId}.pdf` },
      ],
    };
  });
  const payments: ProjectResourceRecord[] = detail.payment.id === '待生成'
    ? []
    : invoices.map((invoice, index) => ({
      id: `${detail.payment.id}-${String(index + 1).padStart(2, '0')}`,
      title: invoice.title,
      subtitle: `${detail.payment.id} · ${invoice.channel}`,
      amount: invoice.amount,
      status: detail.payment.status,
      channel: invoice.channel,
      fields: [
        { label: '付款明细编号', value: `${detail.payment.id}-${String(index + 1).padStart(2, '0')}` },
        { label: '付款批次', value: detail.payment.id },
        { label: '收款人', value: invoice.title },
        { label: '关联项目', value: request.project },
        { label: '关联 Invoice', value: invoice.id },
        { label: '付款渠道', value: invoice.channel ?? '待确认' },
        { label: '付款金额', value: invoice.amount },
        { label: '付款状态', value: detail.payment.status },
      ],
    }));
  return { contract: contracts, invoice: invoices, payment: payments };
}

export function RequestProjectDetailPage({
  request,
  onBack,
  notify,
}: {
  request: RequestProjectSummary;
  onBack: () => void;
  notify: Notify;
}) {
  const [viewer, setViewer] = useState<ProjectResourceViewerState | null>(null);
  const [documentViewer, setDocumentViewer] = useState<{
    kind: Extract<ProjectResourceKind, 'contract' | 'invoice'>;
    recordId: string;
  } | null>(null);
  const detail = getRequestProjectDetail(request);
  const payees = getRequestPayees(request, detail);
  const records = getRequestProjectResourceRecords(request, detail, payees);
  const projectContext = { id: request.id, name: request.project, brand: detail.brand };
  const resources = [
    {
      kind: 'contract' as const,
      label: '合同',
      icon: FileText,
      data: request.contracts > 0
        ? { ...detail.contract, id: `${records.contract.length} 份合同`, meta: `与 ${records.invoice.length} 份 Invoice 一一对应` }
        : { ...detail.contract, id: '0 份合同', meta: '本次请款未关联合同，合同为选填项' },
      action: request.contracts > 0 ? '查看合同' : '查看状态',
    },
    {
      kind: 'invoice' as const,
      label: 'Invoice',
      icon: ReceiptText,
      data: { ...detail.invoice, id: `${records.invoice.length} 份 Invoice` },
      action: '查看 Invoice',
    },
    {
      kind: 'payment' as const,
      label: '付款单',
      icon: WalletCards,
      data: detail.payment,
      action: '查看付款单',
    },
  ];

  if (documentViewer) {
    const recordList = records[documentViewer.kind];
    const recordIndex = recordList.findIndex((record) => record.id === documentViewer.recordId);
    const record = recordList[recordIndex];
    const linkedKind = documentViewer.kind === 'contract' ? 'invoice' : 'contract';
    const linkedRecord = recordIndex >= 0 ? records[linkedKind][recordIndex] : undefined;
    if (record) {
      return (
        <ProjectDocumentDetailPage
          kind={documentViewer.kind}
          project={projectContext}
          record={record}
          linkedRecord={linkedRecord}
          notify={notify}
          onBack={() => {
            setDocumentViewer(null);
            setViewer({ kind: documentViewer.kind, recordId: null });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      );
    }
  }

  return (
    <div className="page-stack project-detail-page request-detail-page">
      <button className="project-back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        返回请款项目
      </button>

      <PageHeading
        title={request.project}
        subtitle={`${request.id} · 项目媒介 ${request.media} · 负责 PM ${request.pm}`}
        actions={<span className="project-detail-status"><i />{request.status}</span>}
      />

      <div className="metrics-grid project-detail-metrics">
        <article className="metric-card metric-peach"><span>请款金额</span><strong>{request.amount}</strong><small>由 {detail.submitter} 提交</small></article>
        <article className="metric-card"><span>关联资料</span><strong>{request.contracts + request.invoices} 份</strong><small>{request.contracts} 份合同 · {request.invoices} 份 Invoice</small></article>
        <article className="metric-card metric-lilac"><span>当前状态</span><strong>{request.status}</strong><small>审批负责人 · {detail.approver}</small></article>
      </div>

      <div className="project-detail-layout">
        <div className="project-detail-main">
          <section className="project-detail-card">
            <header className="project-detail-card-header">
              <div><h2>请款项目信息</h2><p>查看项目、提交人与请款背景。</p></div>
              <span>更新于 {detail.updatedAt}</span>
            </header>
            <dl className="project-info-grid">
              <div><dt>项目编号</dt><dd>{request.id}</dd></div>
              <div><dt>品牌 / 客户</dt><dd>{detail.brand}</dd></div>
              <div><dt>项目媒介</dt><dd>{request.media}</dd></div>
              <div><dt>负责 PM</dt><dd>{request.pm}</dd></div>
              <div><dt>提交时间</dt><dd>{detail.submittedAt}</dd></div>
              <div><dt>提交人</dt><dd>{detail.submitter}</dd></div>
              <div><dt>审批负责人</dt><dd>{detail.approver}</dd></div>
              <div className="project-info-full"><dt>请款原因</dt><dd>{detail.reason}</dd></div>
            </dl>
          </section>

          <section className="project-detail-card">
            <header className="project-detail-card-header">
              <div><h2>合同、Invoice 与付款单</h2><p>核对请款项目中的全部关联资料。</p></div>
            </header>
            <div className="project-resource-list">
              {resources.map((resource) => {
                const ResourceIcon = resource.icon;
                return (
                  <article
                    className={`project-resource-row project-resource-row-${resource.kind}`}
                    key={resource.label}
                  >
                    <span
                      className={`project-resource-icon project-resource-icon-${resource.kind}`}
                      aria-hidden="true"
                    >
                      <ResourceIcon size={20} />
                    </span>
                    <div className="project-resource-copy"><small>{resource.label}</small><strong>{resource.data.id}</strong><span>{resource.data.meta}</span></div>
                    <span className="project-resource-status"><i />{resource.data.status}</span>
                    <button
                      className="text-link"
                      type="button"
                      data-testid={`open-request-${resource.kind}`}
                      onClick={() => setViewer({ kind: resource.kind, recordId: null })}
                    >
                      {resource.action}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="project-detail-card">
            <header className="project-detail-card-header">
              <div><h2>付款明细</h2><p>展示当前请款中的达人、Invoice 与渠道状态。</p></div>
              <span>共 {request.invoices} 份 Invoice</span>
            </header>
            <div className="table-scroll">
              <table className="data-table request-detail-payment-table">
                <thead><tr><th>收款人 / 达人</th><th>Invoice</th><th>请款金额</th><th>付款渠道</th><th>状态</th></tr></thead>
                <tbody>{payees.map((payee) => <tr key={`${request.id}${payee.invoice}`}><td><strong>{payee.name}</strong></td><td><button className="invoice-record-link" type="button" onClick={() => { setDocumentViewer({ kind: 'invoice', recordId: payee.invoice }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{payee.invoice}</button></td><td>{payee.amount}</td><td>{payee.channel}</td><td><span className="simple-status"><i />{payee.status}</span></td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="project-detail-card project-progress-card">
          <header className="project-detail-card-header"><div><h2>审批与付款进度</h2><p>请款提交、审批、复核与渠道付款状态。</p></div></header>
          <div className="project-progress-list">
            {detail.progress.map((step, index) => (
              <div className={`project-progress-item progress-${step.state}`} key={`${step.label}${step.time}`}>
                <span className="project-progress-node">{step.state === 'complete' ? <Check size={15} /> : step.state === 'current' ? <Clock3 size={15} /> : index + 1}</span>
                <div><strong>{step.label}</strong><p>{step.description}</p><small>{step.time}</small></div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {viewer ? (
        <ProjectResourceViewer
          project={projectContext}
          records={records}
          viewer={viewer}
          onChange={setViewer}
          onOpenDocument={(kind, recordId) => {
            setViewer(null);
            setDocumentViewer({ kind, recordId });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  );
}
