import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  Download,
  FileText,
  LoaderCircle,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useState } from 'react';
import { Button, Modal, PageHeading } from '../components/Common';
import type {
  ProjectResourceKind,
  ProjectResourceRecord,
  ProjectResourceRecords,
  ProjectResourceViewerState,
} from '../projectResources';
import { ProjectDocumentDetailPage } from './ProjectDocumentDetailPage';
import { ProjectResourceViewer } from './ProjectDetailPage';
import type { SystemUser } from '../data';
import type { CreatorProfile } from '../types';
import {
  paymentListEffectiveAccount,
  paymentListItemValue,
  type ContractId,
  type CooperationProjectId,
  type CreatorId,
  type EngagementId,
  type InvoiceId,
  type PaymentRequestProjectId,
  type PaymentListId,
  type PaymentListRecord,
  type ProjectId,
  type RequestApprovalState,
  type RequestApprovalStatus,
} from '../businessWorkflow';
import {
  canReviewRequestApproval,
  requestApprovalStage,
  type RequestApprovalAction,
} from '../requestApprovalWorkflow';
import {
  myProjectStatusFor,
  requestProjectStatusFor,
  type PaymentRequestPaymentPlan,
} from '../paymentRequestProjects';
import { formatInvoiceMoney } from '../invoice/invoiceUtils';
import {
  reviewPaymentListAccountSnapshot,
  validatePaymentListAccountViaApi,
  type PaymentAccountApiValidation,
} from '../requestPaymentAccountValidation';

export type RequestProjectSummary = PaymentRequestPaymentPlan & {
  id: string;
  paymentRequestProjectId?: PaymentRequestProjectId;
  requestCode?: string;
  cooperationProjectId?: CooperationProjectId;
  cooperationProjectCode?: string;
  cooperationProjectName?: string;
  lifecycle?: 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED' | 'COMPLETED';
  creatorLinks?: Array<{
    creatorId: CreatorId;
    engagementId: EngagementId;
    contractIds: ContractId[];
    invoiceIds: InvoiceId[];
  }>;
  projectId?: ProjectId;
  invoiceIds?: InvoiceId[];
  paymentListId?: PaymentListId;
  paymentListIds?: PaymentListId[];
  approval?: RequestApprovalState;
  createdAt?: string;
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

type RequestPaymentChannel = 'Airwallex' | 'PayPal' | 'PayMax' | '待确认';

const paymentChannelFromValue = (value: string): RequestPaymentChannel => {
  const match = value.match(/airwallex|paypal|pay(?:er)?\s*max/i)?.[0].toLowerCase();
  if (match === 'airwallex') return 'Airwallex';
  if (match === 'paypal') return 'PayPal';
  if (match?.startsWith('pay')) return 'PayMax';
  return '待确认';
};

export const requestPaymentChannelLabel = (channels: string | string[]) => {
  const values = Array.isArray(channels) ? channels : [channels];
  return values.map(paymentChannelFromValue).find((channel) => channel !== '待确认') ?? '待确认';
};

export const requestPaymentMethodLabel = (channel: string) => {
  const normalizedChannel = requestPaymentChannelLabel(channel);
  if (normalizedChannel === 'PayPal') return 'PayPal';
  if (normalizedChannel === 'Airwallex' || normalizedChannel === 'PayMax') return '银行转账';
  return '待确认';
};

export const normalizeRequestPaymentChannels = <T extends { channel: string }>(items: T[]): T[] => {
  const channel = requestPaymentChannelLabel(items.map((item) => item.channel));
  return items.map((item) => ({ ...item, channel }));
};

export const paymentListsForRequest = (
  request: Pick<RequestProjectSummary, 'paymentListId' | 'paymentListIds' | 'paymentRequestProjectId'>,
  paymentLists: PaymentListRecord[],
) => {
  const explicitIds = new Set([
    ...(request.paymentListIds ?? []),
    ...(request.paymentListId ? [request.paymentListId] : []),
  ]);
  return paymentLists.filter((list) => (
    Boolean(
      request.paymentRequestProjectId
      && list.paymentRequestProjectId === request.paymentRequestProjectId,
    )
    || explicitIds.has(list.paymentListId)
  ));
};

const requestPaymentListStatusLabel = (paymentList: PaymentListRecord | null) => {
  if (!paymentList) return '未生成';
  if (paymentList.status === 'paid') return '已付款';
  if (paymentList.status === 'approved') return '已批准';
  if (paymentList.status === 'submitted') return '已提交';
  if (paymentList.status === 'generated') return '已生成';
  return '草稿';
};

const requestFeeBearerLabel = (value: unknown) => {
  if (value === 'ADVERTISER') return '付款方承担';
  if (value === 'PUBLISHER') return '收款方承担';
  if (value === 'SHARED') return '共同承担';
  return '待确认';
};

export const paymentRecordsFromLists = (
  paymentLists: PaymentListRecord[],
  projectName: string,
): ProjectResourceRecord[] => paymentLists.flatMap((list) => (
  list.items.map((item, index) => {
    const effectiveAccount = paymentListEffectiveAccount(item);
    const provider = effectiveAccount.provider || list.provider || '待确认';
    const currency = String(paymentListItemValue(item, 'currency') || '待确认');
    const receiveCurrency = String(paymentListItemValue(item, 'receiveCurrency') || '待确认');
    const amount = Number(paymentListItemValue(item, 'amount') || 0);
    const recordId = `${list.paymentListCode}-${String(index + 1).padStart(2, '0')}`;
    const status = item.requiresRevalidation
      ? '需重新校验'
      : requestPaymentListStatusLabel(list);
    const updatedAt = item.lastValidatedAt ?? list.generatedAt ?? list.updatedAt;

    return {
      id: recordId,
      title: item.snapshot.creatorName,
      subtitle: `${list.paymentListCode} · ${provider}`,
      amount: formatInvoiceMoney(currency, amount),
      status,
      channel: provider,
      fields: [
        { label: '付款明细编号', value: recordId },
        { label: '付款清单', value: list.paymentListCode },
        { label: '达人 / 收款人', value: item.snapshot.creatorName },
        { label: '关联项目', value: projectName },
        { label: '关联 Invoice', value: item.snapshot.invoiceNumber },
        { label: '付款渠道', value: provider },
        { label: '付款方式', value: requestPaymentMethodLabel(provider) },
        { label: '支付币种', value: currency },
        { label: '收款币种', value: receiveCurrency },
        { label: '付款金额', value: formatInvoiceMoney(currency, amount) },
        { label: '费用承担', value: requestFeeBearerLabel(paymentListItemValue(item, 'feeBearer')) },
        { label: '收款账户', value: effectiveAccount.accountSummary || '待补充' },
        { label: '付款原因', value: String(paymentListItemValue(item, 'paymentReason') || '未填写') },
        { label: '交易附言', value: String(paymentListItemValue(item, 'transactionReference') || '未填写') },
        { label: '描述', value: String(paymentListItemValue(item, 'description') || '未填写') },
        { label: '清单版本', value: `v${list.version ?? 1}` },
        { label: '付款状态', value: status },
        { label: '更新时间', value: updatedAt ? new Date(updatedAt).toLocaleString('zh-CN') : '待更新' },
      ],
    };
  })
));

const parsedRequestDate = (value?: string) => {
  const parts = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!parts) return null;
  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
};

const addBusinessDays = (value: Date, businessDays: number) => {
  const result = new Date(value);
  let added = 0;
  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) added += 1;
  }
  return result;
};

const formatRequestDate = (value: Date) => [
  value.getFullYear(),
  String(value.getMonth() + 1).padStart(2, '0'),
  String(value.getDate()).padStart(2, '0'),
].join('-');

export const requestExpectedPaymentDateLabel = (
  request: Pick<RequestProjectSummary, 'approval' | 'createdAt' | 'lifecycle' | 'status'>,
  fallbackSource?: string,
  fallbackDate = new Date(),
) => {
  const sourceDate = parsedRequestDate(
    request.approval?.updatedAt
    ?? request.createdAt
    ?? request.approval?.submittedAt
    ?? fallbackSource,
  ) ?? new Date(fallbackDate);
  const isCompleted = myProjectStatusFor(request) === '已付款';
  return formatRequestDate(isCompleted ? sourceDate : addBusinessDays(sourceDate, 3));
};

const APPROVAL_STEPS: Array<{
  status: Exclude<RequestApprovalStatus, 'APPROVED' | 'RETURNED_TO_MEDIA_REVIEW'>;
  stage: NonNullable<ReturnType<typeof requestApprovalStage>>;
  label: string;
}> = [
  { status: 'PENDING_PM', stage: 'PM', label: 'PM 审批' },
  { status: 'PENDING_PROJECT_OWNER', stage: 'PROJECT_OWNER', label: '项目负责人审批' },
  { status: 'PENDING_OWNER', stage: 'OWNER', label: '老板审批' },
  { status: 'PENDING_FINANCE', stage: 'FINANCE', label: '财务审批' },
];

const approvalProgress = (request: RequestProjectSummary): RequestProgress[] | null => {
  if (!request.approval) return null;
  const currentStage = requestApprovalStage(request.approval.status);
  return [
    {
      label: '请款提交',
      description: `第 ${request.approval.round} 轮审批已提交`,
      time: request.approval.submittedAt,
      state: 'complete',
    },
    ...APPROVAL_STEPS.map((step) => {
      const approvedEvent = [...request.approval!.history].reverse().find((event) => (
        event.round === request.approval!.round
        && event.stage === step.stage
        && event.action === 'APPROVE'
      ));
      const returnedEvent = [...request.approval!.history].reverse().find((event) => (
        event.round === request.approval!.round
        && event.stage === step.stage
        && event.action === 'RETURN'
      ));
      if (approvedEvent) {
        return {
          label: step.label,
          description: `${approvedEvent.actorName}已审批通过`,
          time: approvedEvent.occurredAt,
          state: 'complete' as const,
        };
      }
      if (returnedEvent) {
        return {
          label: step.label,
          description: `${returnedEvent.actorName}退回媒介复核`,
          time: returnedEvent.occurredAt,
          state: 'current' as const,
        };
      }
      return {
        label: step.label,
        description: currentStage === step.stage ? '等待当前节点处理' : '上一节点通过后进入',
        time: currentStage === step.stage ? '待审批' : '待开始',
        state: currentStage === step.stage ? 'current' as const : 'pending' as const,
      };
    }),
    {
      label: '渠道付款',
      description: request.approval.status === 'APPROVED' ? '财务已通过，付款入口已解锁' : '全部审批完成后执行',
      time: request.approval.status === 'APPROVED' ? request.approval.updatedAt : '待开始',
      state: request.approval.status === 'APPROVED' ? 'current' : 'pending',
    },
  ];
};

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
    submitter: '赖丽红',
    approver: '奚文慧',
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
      { label: 'PM 审批', description: '张咏诗已确认项目资料与请款范围', time: '07-18 10:05', state: 'complete' },
      { label: '项目负责人审批', description: '项目资料与预算已通过', time: '07-18 11:10', state: 'complete' },
      { label: '老板审批', description: 'heather 已完成最终业务审批', time: '07-19 09:20', state: 'complete' },
      { label: '财务审批', description: '正在核对收款主体与金额', time: '今天 10:12', state: 'current' },
      { label: '渠道付款', description: '按各达人收款账户渠道分组执行', time: '待开始', state: 'pending' },
    ],
  },
  'PRJ-260716': {
    brand: 'Nova Lab',
    submitter: '张诗雨',
    approver: '霍舜华',
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
      { label: 'PM 审批', description: '等待霍舜华确认项目资料与请款范围', time: '待审批', state: 'current' },
      { label: '项目负责人审批', description: 'PM 审批通过后进入', time: '待开始', state: 'pending' },
      { label: '老板审批', description: '项目负责人审批通过后进入', time: '待开始', state: 'pending' },
      { label: '财务审批', description: '老板审批通过后进入', time: '待开始', state: 'pending' },
      { label: '渠道付款', description: '付款单生成后执行', time: '待开始', state: 'pending' },
    ],
  },
  'PRJ-260711': {
    brand: 'Mellow Home',
    submitter: '龙哲心',
    approver: '陈旸媛',
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
      { label: 'PM 审批', description: '资料补齐后由陈旸媛审批', time: '待开始', state: 'pending' },
      { label: '项目负责人审批', description: 'PM 审批通过后进入', time: '待开始', state: 'pending' },
      { label: '老板审批', description: '项目负责人审批通过后进入', time: '待开始', state: 'pending' },
      { label: '财务审批', description: '老板审批通过后进入', time: '待开始', state: 'pending' },
      { label: '渠道付款', description: '付款单生成后执行', time: '待开始', state: 'pending' },
    ],
  },
  'PRJ-260625': {
    brand: 'Aster Mobile',
    submitter: '赖丽红',
    approver: '奚文慧',
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
      { label: 'PM 审批', description: '张咏诗已确认项目资料与请款范围', time: '06-25 16:10', state: 'complete' },
      { label: '项目负责人审批', description: '项目与请款金额已通过', time: '06-26 10:20', state: 'complete' },
      { label: '老板审批', description: 'theo 已完成最终业务审批', time: '06-27 11:30', state: 'complete' },
      { label: '财务审批', description: '收款主体与金额已通过', time: '06-28 16:45', state: 'complete' },
      { label: '渠道付款', description: '16 笔付款全部成功', time: '07-16 14:32', state: 'complete' },
    ],
  },
};

function getRequestProjectDetail(request: RequestProjectSummary): RequestProjectDetail {
  const myProjectStatus = myProjectStatusFor(request);
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

  const paid = myProjectStatus === '已付款';
  const approved = paid || myProjectStatus === '待打款';
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
      status: approved ? '已归档' : '已签署',
    },
    invoice: {
      id: `${request.invoices} 份 Invoice`,
      meta: `对应 ${request.contracts} 份合同 · 请款金额 ${request.amount}`,
      status: approved ? '已通过' : myProjectStatus === '已退回' ? '待补资料' : '已校验',
    },
    payment: {
      id: request.paymentOrder,
      meta: paymentGenerated ? `${request.invoices} 笔达人付款明细` : '请款审核通过后生成',
      status: paid ? '已完成' : approved ? '待打款' : '审批中',
    },
    payees: [],
    progress: [
      { label: '请款提交', description: '合同、Invoice 与付款名单已同步', time: '已完成', state: 'complete' },
      { label: 'PM 审批', description: approved ? `${request.pm}已完成审核` : `由${request.pm}审核项目资料`, time: approved ? '已完成' : '处理中', state: approved ? 'complete' : 'current' },
      { label: '项目负责人审批', description: approved ? '项目资料与预算已通过' : 'PM 审批通过后进入', time: approved ? '已完成' : '待开始', state: approved ? 'complete' : 'pending' },
      { label: '老板审批', description: approved ? '业务审批已完成' : '项目负责人审批通过后进入', time: approved ? '已完成' : '待开始', state: approved ? 'complete' : 'pending' },
      { label: '财务审批', description: approved ? '收款主体与金额已通过' : '老板审批通过后进入', time: approved ? '已完成' : '待开始', state: approved ? 'complete' : 'pending' },
      { label: '渠道付款', description: paid ? '付款已完成' : '全部审批完成后执行', time: paid ? '已完成' : '待开始', state: paid ? 'complete' : approved ? 'current' : 'pending' },
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
  if (detail.payees.length >= request.invoices) {
    return normalizeRequestPaymentChannels(detail.payees.slice(0, request.invoices));
  }
  const names = REQUEST_CREATOR_NAMES[request.id] ?? [];
  const requestMoney = parseAmount(request.amount);
  const existingTotal = detail.payees.reduce((sum, payee) => sum + parseAmount(payee.amount).amount, 0);
  const missingCount = Math.max(request.invoices - detail.payees.length, 0);
  const defaultAmount = missingCount > 0 ? Math.max((requestMoney.amount - existingTotal) / missingCount, 0) : 0;
  const projectCode = request.id.replace('PRJ-', '');
  const myProjectStatus = myProjectStatusFor(request);
  const payoutStatus = myProjectStatus === '已付款'
    ? '已付款'
    : myProjectStatus === '待打款'
      ? '待打款'
      : myProjectStatus === '已退回'
        ? '已退回'
        : '待审批';
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
      status: payoutStatus,
    };
  });
  return normalizeRequestPaymentChannels([...detail.payees, ...missing]);
}

function getRequestProjectResourceRecords(
  request: RequestProjectSummary,
  detail: RequestProjectDetail,
  payees: RequestPayee[],
  paymentLists: PaymentListRecord[],
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
  const fallbackPayments: ProjectResourceRecord[] = detail.payment.id === '待生成'
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
        { label: '付款方式', value: requestPaymentMethodLabel(invoice.channel ?? '') },
        { label: '付款金额', value: invoice.amount },
        { label: '付款状态', value: detail.payment.status },
      ],
    }));
  const payments = paymentLists.length
    ? paymentRecordsFromLists(paymentLists, request.cooperationProjectName ?? request.project)
    : fallbackPayments;
  return { contract: contracts, invoice: invoices, payment: payments };
}

type RequestPaymentAccountCheck = PaymentAccountApiValidation | {
  state: 'checking';
  message: string;
};

const requestTransferMethodLabel = (
  transferMethod: ReturnType<typeof paymentListEffectiveAccount>['transferMethod'],
  localClearingSystem?: string,
) => {
  if (transferMethod === 'PAYPAL') return 'PayPal';
  if (transferMethod === 'SWIFT') return 'SWIFT 转账';
  if (transferMethod === 'LOCAL') {
    return localClearingSystem ? `本地转账 · ${localClearingSystem}` : '本地转账';
  }
  return '待确认';
};

function RequestPaymentListReviewViewer({
  project,
  paymentLists,
  creators,
  onExportPaymentList,
  onClose,
}: {
  project: { id: string; name: string };
  paymentLists: PaymentListRecord[];
  creators: CreatorProfile[];
  onExportPaymentList: (paymentListId: PaymentListId) => Promise<void>;
  onClose: () => void;
}) {
  const [accountChecks, setAccountChecks] = useState<Record<string, RequestPaymentAccountCheck>>({});
  const [validating, setValidating] = useState(false);
  const rows = paymentLists.flatMap((list) => list.items.map((item) => ({
    key: `${list.paymentListId}-${item.id}`,
    list,
    item,
    effectiveAccount: paymentListEffectiveAccount(item),
    snapshotReview: reviewPaymentListAccountSnapshot(item, creators),
  })));
  const snapshotAttentionCount = rows.filter((row) => row.snapshotReview.state !== 'ready').length;
  const apiPassedCount = rows.filter((row) => accountChecks[row.key]?.state === 'passed').length;
  const apiIssueCount = rows.filter((row) => ['invalid', 'unavailable'].includes(accountChecks[row.key]?.state ?? '')).length;
  const allApiChecksPassed = rows.length > 0 && apiPassedCount === rows.length && snapshotAttentionCount === 0;

  const validateAccounts = async () => {
    if (!rows.length || validating) return;
    setValidating(true);
    setAccountChecks(Object.fromEntries(rows.map((row) => [row.key, {
      state: 'checking',
      message: '正在请求收款账户校验 API',
    }])));
    const results = await Promise.all(rows.map(async (row) => [
      row.key,
      await validatePaymentListAccountViaApi({ item: row.item, creators }),
    ] as const));
    setAccountChecks(Object.fromEntries(results));
    setValidating(false);
  };

  const summaryTitle = validating
    ? '正在校验收款账户'
    : allApiChecksPassed
      ? '全部收款账户已通过 API 校验'
      : apiIssueCount
        ? `${apiIssueCount} 笔 API 校验未通过`
        : snapshotAttentionCount
          ? `${snapshotAttentionCount} 笔账户快照需要处理`
          : '账户快照完整，待 API 校验';

  return (
    <Modal
      title={`${project.name} · 付款清单`}
      width="1120px"
      className="project-resource-modal request-payment-review-modal"
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>关闭</Button>}
    >
      <div className="project-resource-browser" data-testid="request-payment-list-review">
        <div className="project-resource-browser-heading">
          <div>
            <strong>全部付款明细</strong>
            <p>每张 Invoice 保留独立付款行，内容来自“我的项目”提交时的冻结快照。</p>
          </div>
          <span>{rows.length} 笔</span>
        </div>

        {rows.length ? (
          <>
            <div className="project-resource-browser-toolbar request-payment-review-toolbar">
              <Button
                variant="secondary"
                icon={validating ? <LoaderCircle className="is-spinning" size={15} /> : <ShieldCheck size={15} />}
                disabled={validating}
                onClick={() => { void validateAccounts(); }}
              >
                {validating ? '校验中' : '校验账户完整性'}
              </Button>
              {paymentLists.map((list) => (
                <Button
                  variant="secondary"
                  icon={<Download size={15} />}
                  key={list.paymentListId}
                  onClick={() => { void onExportPaymentList(list.paymentListId); }}
                >
                  {paymentLists.length === 1 ? '导出 Excel' : `导出 ${list.paymentListCode}`}
                </Button>
              ))}
            </div>

            <div
              className={`request-payment-review-summary${allApiChecksPassed ? ' is-passed' : snapshotAttentionCount || apiIssueCount ? ' is-warning' : ''}`}
              role="status"
              aria-live="polite"
            >
              <span>
                {validating
                  ? <LoaderCircle className="is-spinning" size={18} />
                  : allApiChecksPassed
                    ? <CircleCheck size={18} />
                    : snapshotAttentionCount || apiIssueCount
                      ? <CircleAlert size={18} />
                      : <ShieldCheck size={18} />}
              </span>
              <div>
                <strong>{summaryTitle}</strong>
                <p>审批前应核对冻结账户、币种、金额、费用承担与交易附言；API 校验只检查账户字段，不改写付款数据。</p>
              </div>
            </div>

            <div className="project-payment-rows request-payment-flat-rows">
              {rows.map((row) => {
                const check = accountChecks[row.key];
                const currency = String(paymentListItemValue(row.item, 'currency') || '待确认');
                const amount = Number(paymentListItemValue(row.item, 'amount') || 0);
                const accountIssue = row.snapshotReview.issues[0];
                const validationMessage = check
                  ? accountIssue && check.state !== 'checking'
                    ? `${check.message}；${accountIssue}`
                    : check.message
                  : accountIssue || '账户快照完整，等待审批人执行 API 校验';
                const validationState = check?.state === 'passed' && row.snapshotReview.state === 'ready'
                  ? 'is-passed'
                  : check?.state === 'checking'
                    ? 'is-checking'
                    : row.snapshotReview.state !== 'ready' || ['invalid', 'unavailable'].includes(check?.state ?? '')
                      ? 'is-warning'
                      : '';
                const updatedAt = check?.state === 'passed'
                  ? check.checkedAt
                  : row.item.lastValidatedAt ?? row.list.generatedAt ?? row.list.updatedAt;

                return (
                  <article className="project-payment-row request-payment-review-row" key={row.key}>
                    <header className="project-payment-row-header">
                      <div>
                        <strong>{row.item.snapshot.creatorName}</strong>
                        <span>{row.item.snapshot.invoiceNumber} · {row.list.paymentListCode} · {row.effectiveAccount.provider}</span>
                      </div>
                      <span className="project-record-status"><i />{requestPaymentListStatusLabel(row.list)}</span>
                    </header>

                    <div className={`request-payment-account-check ${validationState}`} role="status" aria-live="polite">
                      {check?.state === 'checking'
                        ? <LoaderCircle className="is-spinning" size={14} />
                        : validationState === 'is-passed'
                          ? <CircleCheck size={14} />
                          : validationState === 'is-warning'
                            ? <CircleAlert size={14} />
                            : <ShieldCheck size={14} />}
                      <span>{validationMessage}</span>
                    </div>

                    <dl className="request-payment-review-fields">
                      <div className="request-payment-review-account">
                        <dt>收款账户</dt>
                        <dd>{row.effectiveAccount.accountSummary || '待补充'}</dd>
                        <small>{requestTransferMethodLabel(row.effectiveAccount.transferMethod, row.effectiveAccount.localClearingSystem)}</small>
                      </div>
                      <div>
                        <dt>支付币种</dt>
                        <dd>{currency}</dd>
                      </div>
                      <div>
                        <dt>收款币种</dt>
                        <dd>{String(paymentListItemValue(row.item, 'receiveCurrency') || '待确认')}</dd>
                      </div>
                      <div>
                        <dt>付款金额</dt>
                        <dd>{formatInvoiceMoney(currency, amount)}</dd>
                      </div>
                      <div>
                        <dt>费用承担</dt>
                        <dd>{requestFeeBearerLabel(paymentListItemValue(row.item, 'feeBearer'))}</dd>
                      </div>
                      <div>
                        <dt>付款原因</dt>
                        <dd>{String(paymentListItemValue(row.item, 'paymentReason') || '未填写')}</dd>
                      </div>
                      <div className="request-payment-review-reference">
                        <dt>交易附言</dt>
                        <dd>{String(paymentListItemValue(row.item, 'transactionReference') || '未填写')}</dd>
                      </div>
                    </dl>

                    <footer className="project-payment-row-meta">
                      <span>{requestPaymentListStatusLabel(row.list)} · v{row.list.version ?? 1}</span>
                      <span>Invoice {row.item.snapshot.invoiceNumber}</span>
                      <span>{row.item.snapshot.contractIds?.length ? `${row.item.snapshot.contractIds.length} 份合同` : '未关联合同'}</span>
                      <span>{updatedAt ? `校验时间 ${new Date(updatedAt).toLocaleString('zh-CN')}` : '尚未校验'}</span>
                    </footer>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="project-resource-browser-empty">
            <WalletCards size={23} />
            <strong>付款清单尚未生成</strong>
            <p>当前请款项目没有可供审批查看的付款清单快照。</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function RequestProjectDetailPage({
  request,
  paymentLists,
  creators,
  currentUser,
  onExportPaymentList,
  onApprovalAction,
  onBack,
  notify,
}: {
  request: RequestProjectSummary;
  paymentLists: PaymentListRecord[];
  creators: CreatorProfile[];
  currentUser: SystemUser;
  onExportPaymentList: (request: RequestProjectSummary, paymentListId: PaymentListId) => Promise<void>;
  onApprovalAction: (
    request: RequestProjectSummary,
    action: RequestApprovalAction,
    reason?: string,
  ) => void;
  onBack: () => void;
  notify: Notify;
}) {
  const [viewer, setViewer] = useState<ProjectResourceViewerState | null>(null);
  const [documentViewer, setDocumentViewer] = useState<{
    kind: Extract<ProjectResourceKind, 'contract' | 'invoice'>;
    recordId: string;
  } | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const detail = getRequestProjectDetail(request);
  const liveProgress = approvalProgress(request) ?? detail.progress;
  const canReviewCurrentStage = Boolean(
    request.approval
    && canReviewRequestApproval(currentUser, request.approval, request.pm),
  );
  const currentApprovalLabel = requestProjectStatusFor(request) ?? '请款提交';
  const normalizedReturnReason = returnReason.trim();
  const payees = getRequestPayees(request, detail);
  const paymentChannel = requestPaymentChannelLabel(payees.map((payee) => payee.channel));
  const expectedPaymentDate = requestExpectedPaymentDateLabel(request, detail.updatedAt);
  const requestPaymentLists = paymentListsForRequest(request, paymentLists);
  const records = getRequestProjectResourceRecords(request, detail, payees, requestPaymentLists);
  const paymentListItemCount = requestPaymentLists.reduce((sum, list) => sum + list.items.length, 0);
  const currentPaymentList = requestPaymentLists[0] ?? null;
  const projectContext = {
    id: request.requestCode ?? request.id,
    name: request.cooperationProjectName ?? request.project,
    brand: detail.brand,
  };
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
      label: '付款清单',
      icon: WalletCards,
      data: {
        ...detail.payment,
        id: currentPaymentList?.paymentListCode ?? detail.payment.id,
        meta: `${paymentChannel} · ${paymentListItemCount || records.payment.length} 笔付款明细`,
        status: currentPaymentList ? requestPaymentListStatusLabel(currentPaymentList) : detail.payment.status,
      },
      action: '查看清单',
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
        title={request.requestCode ?? request.id}
        subtitle={`关联项目 ${request.cooperationProjectName ?? request.project} · 项目媒介 ${request.media} · 负责 PM ${request.pm}`}
        actions={<span className="project-detail-status"><i />{currentApprovalLabel}</span>}
      />

      <div className="metrics-grid project-detail-metrics">
        <article className="metric-card metric-peach"><span>请款金额</span><strong>{request.amount}</strong><small>由 {detail.submitter} 提交</small></article>
        <article className="metric-card"><span>关联资料</span><strong>{request.contracts + request.invoices} 份</strong><small>{request.contracts} 份合同 · {request.invoices} 份 Invoice</small></article>
        <article className="metric-card metric-lilac"><span>当前状态</span><strong>{currentApprovalLabel}</strong><small>{request.approval ? `第 ${request.approval.round} 轮审批` : `审批负责人 · ${detail.approver}`}</small></article>
      </div>

      <div className="project-detail-layout">
        <div className="project-detail-main">
          <section className="project-detail-card">
            <header className="project-detail-card-header">
              <div><h2>请款项目信息</h2><p>查看项目、提交人与请款背景。</p></div>
              <span>更新于 {detail.updatedAt}</span>
            </header>
            <dl className="project-info-grid">
              <div><dt>项目编号</dt><dd>{request.requestCode ?? request.id}</dd></div>
              <div><dt>关联项目</dt><dd>{request.cooperationProjectName ?? request.project}<small className="cell-subtext">{request.cooperationProjectCode ?? request.projectId ?? '待同步'}</small></dd></div>
              <div><dt>品牌 / 客户</dt><dd>{detail.brand}</dd></div>
              <div><dt>项目媒介</dt><dd>{request.media}</dd></div>
              <div><dt>负责 PM</dt><dd>{request.pm}</dd></div>
              <div><dt>提交时间</dt><dd>{detail.submittedAt}</dd></div>
              <div><dt>提交人</dt><dd>{detail.submitter}</dd></div>
              <div><dt>付款渠道</dt><dd>{paymentChannel}</dd></div>
              <div><dt>预计付款时间</dt><dd>{expectedPaymentDate}</dd></div>
              <div className="project-info-full"><dt>请款原因</dt><dd>{detail.reason}</dd></div>
            </dl>
          </section>

          <section className="project-detail-card">
            <header className="project-detail-card-header">
              <div><h2>合同、Invoice 与付款清单</h2><p>核对请款项目中的全部关联资料。</p></div>
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
              <div><h2>付款明细</h2><p>展示当前请款中的达人、Invoice、付款渠道、方式与状态。</p></div>
              <span>共 {request.invoices} 份 Invoice</span>
            </header>
            <div className="table-scroll">
              <table className="data-table request-detail-payment-table">
                <thead><tr><th>达人</th><th>Invoice</th><th>请款金额</th><th>付款渠道</th><th>付款方式</th><th>状态</th></tr></thead>
                <tbody>{payees.map((payee) => <tr key={`${request.id}${payee.invoice}`}><td><strong>{payee.name}</strong></td><td><button className="invoice-record-link" type="button" onClick={() => { setDocumentViewer({ kind: 'invoice', recordId: payee.invoice }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{payee.invoice}</button></td><td>{payee.amount}</td><td>{payee.channel}</td><td>{requestPaymentMethodLabel(payee.channel)}</td><td><span className="simple-status"><i />{payee.status}</span></td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="project-detail-card project-progress-card">
          <header className="project-detail-card-header"><div><h2>审批与付款进度</h2><p>请款提交、审批、复核与渠道付款状态。</p></div></header>
          <div className="project-progress-list">
            {liveProgress.map((step, index) => (
              <div className={`project-progress-item progress-${step.state}`} key={`${step.label}${step.time}`}>
                <span className="project-progress-node">{step.state === 'complete' ? <Check size={15} /> : step.state === 'current' ? <Clock3 size={15} /> : index + 1}</span>
                <div><strong>{step.label}</strong><p>{step.description}</p><small>{step.time}</small></div>
              </div>
            ))}
          </div>
          {request.approval?.status === 'RETURNED_TO_MEDIA_REVIEW' ? (
            <div className="drawer-alert">
              <AlertTriangle size={18} />
              <span><strong>已退回媒介复核</strong>{request.approval.returnReason}</span>
            </div>
          ) : null}
          {canReviewCurrentStage ? (
            <div className="invoice-review-actions request-approval-actions">
              <Button variant="secondary" onClick={() => setReturnDialogOpen(true)}>退回媒介复核</Button>
              <Button onClick={() => onApprovalAction(request, 'APPROVE')}>审批通过</Button>
            </div>
          ) : null}
        </aside>
      </div>

      {viewer?.kind === 'payment' ? (
        <RequestPaymentListReviewViewer
          project={projectContext}
          paymentLists={requestPaymentLists}
          creators={creators}
          onExportPaymentList={(paymentListId) => onExportPaymentList(request, paymentListId)}
          onClose={() => setViewer(null)}
        />
      ) : viewer ? (
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
      {returnDialogOpen ? (
        <Modal
          title="退回媒介复核"
          width="520px"
          onClose={() => setReturnDialogOpen(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setReturnDialogOpen(false)}>取消</Button>
              <Button
                variant="danger"
                disabled={!normalizedReturnReason}
                onClick={() => {
                  onApprovalAction(request, 'RETURN', normalizedReturnReason);
                  setReturnDialogOpen(false);
                  setReturnReason('');
                }}
              >
                确认退回
              </Button>
            </>
          )}
        >
          <label className="return-review-field">
            <span>退回原因 <em className="required-mark" aria-hidden="true">*</em><small>{returnReason.length}/300</small></span>
            <textarea
              autoFocus
              maxLength={300}
              aria-label="请款审批退回原因"
              placeholder="请说明媒介需要复核或修正的内容"
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
            />
            <small>该轮全部 Invoice 将进入“待媒介审核 / 待复核”，付款清单恢复草稿。</small>
          </label>
        </Modal>
      ) : null}
    </div>
  );
}
