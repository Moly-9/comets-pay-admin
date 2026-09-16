import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleAlert,
  Clock3,
  FileText,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useState } from 'react';
import { accountDisplayValue } from '../accountPresentation';
import { Button, ListActionButton, Modal, PageHeading } from '../components/Common';
import { CreatorIdentity } from '../components/CreatorIdentity';
import { InvoiceContractMismatchNotice } from '../components/InvoiceContractMismatchNotice';
import { PaymentListReviewContent } from '../components/PaymentListReviewContent';
import { PaymentProviderBadge, paymentProviderDisplayName } from '../components/PaymentProviderBadge';
import { RequestProjectInfoCard } from '../components/RequestProjectInfoCard';
import type {
  ProjectResourceKind,
  ProjectResourceRecord,
  ProjectResourceRecords,
  ProjectResourceViewerState,
} from '../projectResources';
import { ProjectDocumentDetailPage } from './ProjectDocumentDetailPage';
import { ProjectResourceViewer } from './ProjectDetailPage';
import type { SystemUser } from '../data';
import type { ContractRecord } from '../contracts';
import type { CreatorProfile, GeneratedInvoiceRecord, Payout, PayoutStatus } from '../types';
import { buildRequestFinanceReview, type RequestFinanceReview } from '../financeReview';
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
  canReturnRequestApproval,
  canReviewRequestApproval,
  REQUEST_APPROVAL_STATUS_LABEL,
  requestApprovalStage,
  type RequestApprovalAction,
} from '../requestApprovalWorkflow';
import {
  myProjectStatusFor,
  requestProjectStatusFor,
  type PaymentRequestLifecycle,
  type PaymentRequestExtraDetails,
  type PaymentRequestPaymentPlan,
} from '../paymentRequestProjects';
import { formatInvoiceMoney } from '../invoice/invoiceUtils';
import { demoDisplayName } from '../demoCreatorNames';
import { paymentPayoutExpenditureTotals } from '../paymentAttempts';

export type RequestProjectSummary = PaymentRequestPaymentPlan & PaymentRequestExtraDetails & {
  id: string;
  paymentRequestProjectId?: PaymentRequestProjectId;
  requestCode?: string;
  cooperationProjectId?: CooperationProjectId;
  cooperationProjectCode?: string;
  cooperationProjectName?: string;
  lifecycle?: PaymentRequestLifecycle;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  creatorLinks?: Array<{
    creatorId: CreatorId;
    socialAccountId?: string;
    creatorHandle?: string;
    creatorPlatform?: string;
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
  creatorId?: CreatorId;
  socialAccountId?: string;
  handle?: string;
  platform?: string;
  initials?: string;
  accent?: string;
  invoice: string;
  amount: string;
  channel: string;
  paymentMethod?: string;
  actualExpenditure?: string;
  validationStatus?: string;
  paymentStatus?: string;
  status?: string;
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

type RequestPaymentChannel = 'Airwallex' | 'PayPal' | 'Payer Max' | '待确认';

const paymentChannelFromValue = (value: string): RequestPaymentChannel => {
  const match = value.match(/airwallex|paypal|pay(?:er)?\s*max/i)?.[0].toLowerCase();
  if (match === 'airwallex') return 'Airwallex';
  if (match === 'paypal') return 'PayPal';
  if (match?.startsWith('pay')) return 'Payer Max';
  return '待确认';
};

export const requestPaymentChannelLabel = (channels: string | string[]) => {
  const values = Array.isArray(channels) ? channels : [channels];
  return values.map(paymentChannelFromValue).find((channel) => channel !== '待确认') ?? '待确认';
};

export const requestPaymentMethodLabel = (channel: string) => {
  const normalizedChannel = requestPaymentChannelLabel(channel);
  if (normalizedChannel === 'PayPal') return 'PayPal';
  if (normalizedChannel === 'Airwallex' || normalizedChannel === 'Payer Max') return '银行转账';
  return '待确认';
};

export type RequestPaymentStatus = '未付款' | '付款处理中' | '已付款' | '付款失败';

export const requestTransferMethodLabel = (
  transferMethod?: ReturnType<typeof paymentListEffectiveAccount>['transferMethod'],
  provider?: string,
) => {
  if (transferMethod === 'LOCAL') return 'Local';
  if (transferMethod === 'SWIFT') return 'Swift';
  if (transferMethod === 'PAYPAL' || requestPaymentChannelLabel(provider ?? '') === 'PayPal') return 'PayPal';
  return '待确认';
};

export const requestPaymentStatusLabel = (
  payoutStatus?: PayoutStatus | string,
  paymentListStatus?: PaymentListRecord['status'],
): RequestPaymentStatus => {
  if (payoutStatus === '付款失败' || payoutStatus === '已退回') return '付款失败';
  if (payoutStatus === '付款处理中') return '付款处理中';
  if (payoutStatus === '已付款' || paymentListStatus === 'paid') return '已付款';
  return '未付款';
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
  generatedInvoices: GeneratedInvoiceRecord[] = [],
  payouts: Payout[] = [],
): ProjectResourceRecord[] => paymentLists.flatMap((list) => (
  list.items.map((item, index) => {
    const effectiveAccount = paymentListEffectiveAccount(item);
    const provider = paymentProviderDisplayName(effectiveAccount.provider || list.provider);
    const currency = String(paymentListItemValue(item, 'currency') || '待确认');
    const receiveCurrency = String(paymentListItemValue(item, 'receiveCurrency') || '待确认');
    const amount = Number(paymentListItemValue(item, 'amount') || 0);
    const invoice = generatedInvoices.find((candidate) => candidate.invoiceId === item.invoiceId);
    const payout = invoice
      ? payouts.find((candidate) => candidate.id === invoice.sourcePayoutId)
      : payouts.find((candidate) => candidate.invoice === item.snapshot.invoiceNumber);
    const recordId = payout?.paymentCode || '付款编号待补全';
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
        { label: '请款金额', value: formatInvoiceMoney(currency, amount) },
        { label: '费用承担', value: requestFeeBearerLabel(paymentListItemValue(item, 'feeBearer')) },
        { label: '收款账户', value: accountDisplayValue(effectiveAccount.accountSummary) },
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

export const requestPayeesFromPaymentLists = (
  paymentLists: PaymentListRecord[],
  creators: CreatorProfile[] = [],
  generatedInvoices: GeneratedInvoiceRecord[] = [],
  payouts: Payout[] = [],
): RequestPayee[] => {
  const creatorById = new Map(creators.map((creator) => [String(creator.id), creator]));
  const invoiceById = new Map(generatedInvoices.map((invoice) => [String(invoice.invoiceId), invoice]));
  const payoutById = new Map(payouts.map((payout) => [payout.id, payout]));
  return paymentLists.flatMap((list) => (
    list.items.map((item) => {
      const account = paymentListEffectiveAccount(item);
      const currency = String(paymentListItemValue(item, 'currency') || '待确认');
      const amount = Number(paymentListItemValue(item, 'amount') || 0);
      const creator = item.snapshot.creatorId
        ? creatorById.get(String(item.snapshot.creatorId))
        : creators.find((candidate) => candidate.name === item.snapshot.creatorName);
      const invoice = invoiceById.get(String(item.invoiceId));
      const payout = invoice?.sourcePayoutId
        ? payoutById.get(invoice.sourcePayoutId)
        : payouts.find((candidate) => candidate.invoice === item.snapshot.invoiceNumber);
      const expenditureTotals = payout ? paymentPayoutExpenditureTotals(payout) : [];
      return {
        name: item.snapshot.creatorName,
        creatorId: item.snapshot.creatorId,
        ...(item.snapshot.creatorSocialAccountId
          ? { socialAccountId: item.snapshot.creatorSocialAccountId }
          : {}),
        handle: item.snapshot.creatorHandle,
        platform: item.snapshot.creatorPlatform ?? creator?.platform,
        initials: creator?.initials,
        accent: creator?.accent,
        invoice: item.snapshot.invoiceNumber,
        amount: formatInvoiceMoney(currency, amount),
        channel: paymentProviderDisplayName(account.provider || list.provider),
        paymentMethod: requestTransferMethodLabel(account.transferMethod, account.provider || list.provider),
        actualExpenditure: expenditureTotals.length
          ? expenditureTotals.map(({ currency: expenditureCurrency, amount: expenditureAmount }) => (
              formatInvoiceMoney(expenditureCurrency, expenditureAmount)
            )).join(' · ')
          : payout?.status === '付款处理中' ? '待渠道回写' : '—',
        validationStatus: item.requiresRevalidation ? '需重新校验' : item.lastValidatedAt ? '已校验' : '待校验',
        paymentStatus: requestPaymentStatusLabel(payout?.status, list.status),
      };
    })
  ));
};

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
  { status: 'PENDING_PROJECT_OWNER', stage: 'PROJECT_OWNER', label: '媒介负责人审批' },
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

const RAW_REQUEST_CREATOR_NAMES: Record<string, string[]> = {
  'PRJ-260718': ['Mina Kato', 'Yuki Tanaka', 'Camila Costa', 'Oliver Chen', 'Alex Ruiz', 'Hannah Lee'],
  'PRJ-260716': ['Alex Ruiz', 'Hannah Lee', 'Luca Bianchi'],
  'PRJ-260711': ['Luna Jones', 'Emily Wong', 'Marc O.', 'Sofia Kim', 'Noah Park'],
  'PRJ-260625': [
    'Kenji Mori',
    'Mina Kato',
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

const REQUEST_CREATOR_NAMES: Record<string, string[]> = Object.fromEntries(
  Object.entries(RAW_REQUEST_CREATOR_NAMES).map(([projectId, names]) => [
    projectId,
    names.map(demoDisplayName),
  ]),
);

const RAW_REQUEST_PROJECT_DETAILS: Record<string, RequestProjectDetail> = {
  'PRJ-260718': {
    brand: 'Solara Beauty',
    submitter: '赖丽红',
    approver: '奚文慧',
    submittedAt: '2026-07-18 09:36',
    updatedAt: '今天 10:12',
    reason: '结算夏日直播计划首期达人合作、内容制作及素材授权费用。',
    contract: { id: 'CON-260718-01', meta: '1 份已签署合同 · USD 32,000', status: '已归档' },
    invoice: { id: '6 份 Invoice', meta: '请款金额 USD 18,420', status: '已校验' },
    payment: { id: 'PAY-2607180004', meta: '多渠道 · 分组付款', status: '待打款' },
    payees: [
      { name: 'Mina Kato', invoice: 'INV-20240718-00001', amount: 'USD 3,240', channel: 'Airwallex', status: '待打款' },
      { name: 'Yuki Tanaka', invoice: 'INV-20240719-00001', amount: 'USD 2,180', channel: 'PayPal', status: '待打款' },
      { name: 'Camila Costa', invoice: 'INV-20240720-00001', amount: 'USD 2,760', channel: 'PayMax', status: '待打款' },
    ],
    progress: [
      { label: '请款提交', description: '合同、Invoice 与付款名单已提交', time: '07-18 09:36', state: 'complete' },
      { label: 'PM 审批', description: '张咏诗已确认项目资料与请款范围', time: '07-18 10:05', state: 'complete' },
      { label: '媒介负责人审批', description: '项目资料与预算已通过', time: '07-18 11:10', state: 'complete' },
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
      { name: 'Alex Ruiz', invoice: 'INV-20240716-00001', amount: 'EUR 2,450', channel: 'PayMax', status: '待审批' },
      { name: 'Hannah Lee', invoice: 'INV-20240716-00002', amount: 'EUR 1,850', channel: 'PayPal', status: '待审批' },
      { name: 'Luca Bianchi', invoice: 'INV-20240716-00003', amount: 'EUR 1,900', channel: 'PayMax', status: '待审批' },
    ],
    progress: [
      { label: '请款提交', description: '项目资料已提交', time: '07-16 14:20', state: 'complete' },
      { label: 'PM 审批', description: '等待霍舜华确认项目资料与请款范围', time: '待审批', state: 'current' },
      { label: '媒介负责人审批', description: 'PM 审批通过后进入', time: '待开始', state: 'pending' },
      { label: '老板审批', description: '媒介负责人审批通过后进入', time: '待开始', state: 'pending' },
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
      { name: 'Luna Jones', invoice: 'INV-20240711-00001', amount: 'USD 4,200', channel: 'Airwallex', status: '资料完整' },
      { name: 'Emily Wong', invoice: 'INV-20240711-00002', amount: 'USD 3,600', channel: 'Airwallex', status: '资料完整' },
      { name: 'Marc O.', invoice: 'INV-20240711-00003', amount: 'USD 2,100', channel: 'PayPal', status: '待补资料' },
    ],
    progress: [
      { label: '请款提交', description: '发现 1 份 PayPal 收款资料不完整，等待媒介补充', time: '07-18 17:40', state: 'current' },
      { label: 'PM 审批', description: '资料补齐后由陈旸媛审批', time: '待开始', state: 'pending' },
      { label: '媒介负责人审批', description: 'PM 审批通过后进入', time: '待开始', state: 'pending' },
      { label: '老板审批', description: '媒介负责人审批通过后进入', time: '待开始', state: 'pending' },
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
    payment: { id: 'PAY-2606250012', meta: 'Airwallex · 16 笔付款', status: '已完成' },
    payees: [
      { name: 'Kenji Mori', invoice: 'INV-20240625-00001', amount: 'USD 3,800', channel: 'Airwallex', status: '已付款' },
      { name: 'Mina Kato', invoice: 'INV-20240625-00002', amount: 'USD 3,240', channel: 'Airwallex', status: '已付款' },
      { name: 'Nika', invoice: 'INV-20240625-00003', amount: 'USD 2,980', channel: 'PayPal', status: '已付款' },
    ],
    progress: [
      { label: '请款提交', description: '合同、Invoice 与付款名单已提交', time: '06-25 14:00', state: 'complete' },
      { label: 'PM 审批', description: '张咏诗已确认项目资料与请款范围', time: '06-25 16:10', state: 'complete' },
      { label: '媒介负责人审批', description: '项目与请款金额已通过', time: '06-26 10:20', state: 'complete' },
      { label: '老板审批', description: 'theo 已完成最终业务审批', time: '06-27 11:30', state: 'complete' },
      { label: '财务审批', description: '收款主体与金额已通过', time: '06-28 16:45', state: 'complete' },
      { label: '渠道付款', description: '16 笔付款全部成功', time: '07-16 14:32', state: 'complete' },
    ],
  },
};

const REQUEST_PROJECT_DETAILS: Record<string, RequestProjectDetail> = Object.fromEntries(
  Object.entries(RAW_REQUEST_PROJECT_DETAILS).map(([projectId, detail]) => [
    projectId,
    {
      ...detail,
      payees: detail.payees.map((payee) => ({
        ...payee,
        name: demoDisplayName(payee.name),
      })),
    },
  ]),
);

function getRequestProjectDetail(request: RequestProjectSummary): RequestProjectDetail {
  const myProjectStatus = myProjectStatusFor(request);
  if (request.generatedDetail) {
    const generated = request.generatedDetail;
    const hasContract = request.contracts > 0;
    return {
      brand: generated.brand,
      submitter: request.media,
      approver: request.pm || '媒介负责人',
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
        meta: `${paymentProviderDisplayName(generated.provider)} · ${generated.beneficiaryId} · ${generated.feePolicy}`,
        status: generated.paymentListStatus,
      },
      payees: [
        {
          name: generated.payee,
          invoice: generated.invoiceId,
          amount: generated.invoiceAmount,
          channel: paymentProviderDisplayName(generated.provider),
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
        ...(request.pm ? [{ label: 'PM 审批', description: `等待${request.pm}确认项目资料与请款范围`, time: '待审批', state: 'current' as const }] : []),
        { label: '媒介负责人审批', description: request.pm ? 'PM 审批通过后进入' : '提交后直接进入', time: request.pm ? '待开始' : '待审批', state: request.pm ? 'pending' : 'current' },
        { label: '老板审批', description: '媒介负责人审批通过后进入', time: '待开始', state: 'pending' },
        { label: '财务审批', description: '老板审批通过后进入', time: '待开始', state: 'pending' },
        { label: '渠道付款', description: `审批完成后通过${paymentProviderDisplayName(generated.provider)}执行`, time: '待开始', state: 'pending' },
      ],
    };
  }

  const paid = myProjectStatus === '已付款';
  const approved = paid || myProjectStatus === '待打款';
  const paymentGenerated = request.paymentOrder !== '待生成';
  return REQUEST_PROJECT_DETAILS[request.id] ?? {
    brand: request.brand,
    submitter: request.media,
    approver: request.pm || '媒介负责人',
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
      ...(request.pm ? [{ label: 'PM 审批', description: approved ? `${request.pm}已完成审核` : `由${request.pm}审核项目资料`, time: approved ? '已完成' : '处理中', state: approved ? 'complete' as const : 'current' as const }] : []),
      { label: '媒介负责人审批', description: approved ? '项目资料与预算已通过' : request.pm ? 'PM 审批通过后进入' : '提交后直接进入', time: approved ? '已完成' : request.pm ? '待开始' : '处理中', state: approved ? 'complete' : request.pm ? 'pending' : 'current' },
      { label: '老板审批', description: approved ? '业务审批已完成' : '媒介负责人审批通过后进入', time: approved ? '已完成' : '待开始', state: approved ? 'complete' : 'pending' },
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
  generatedInvoices: GeneratedInvoiceRecord[],
  payouts: Payout[],
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
    : invoices.map((invoice, index) => {
      const paymentDate = detail.payment.id.match(/^PAY-(\d{6})\d{4}$/)?.[1] ?? projectCode;
      const paymentCode = `PMT-${paymentDate}${String(index + 1).padStart(4, '0')}`;
      return {
        id: paymentCode,
        title: invoice.title,
        subtitle: `${detail.payment.id} · ${invoice.channel}`,
        amount: invoice.amount,
        status: detail.payment.status,
        channel: invoice.channel,
        fields: [
          { label: '付款明细编号', value: paymentCode },
          { label: '付款批次', value: detail.payment.id },
          { label: '收款人', value: invoice.title },
          { label: '关联项目', value: request.project },
          { label: '关联 Invoice', value: invoice.id },
          { label: '付款渠道', value: invoice.channel ?? '待确认' },
          { label: '付款方式', value: requestPaymentMethodLabel(invoice.channel ?? '') },
          { label: '请款金额', value: invoice.amount },
          { label: '付款状态', value: detail.payment.status },
        ],
      };
    });
  const payments = paymentLists.length
    ? paymentRecordsFromLists(
        paymentLists,
        request.cooperationProjectName ?? request.project,
        generatedInvoices,
        payouts,
      )
    : fallbackPayments;
  return { contract: contracts, invoice: invoices, payment: payments };
}

function RequestPaymentListReviewViewer({
  project,
  paymentLists,
  creators,
  financeReview,
  onExportPaymentList,
  onClose,
}: {
  project: { id: string; name: string };
  paymentLists: PaymentListRecord[];
  creators: CreatorProfile[];
  financeReview: RequestFinanceReview;
  onExportPaymentList: (paymentListId: PaymentListId) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Modal
      title={`${project.name} · 付款清单`}
      width="1120px"
      className="project-resource-modal request-payment-review-modal"
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>关闭</Button>}
    >
      <PaymentListReviewContent
        paymentLists={paymentLists}
        creators={creators}
        financeReview={financeReview}
        onExportPaymentList={onExportPaymentList}
        accountDisplay="all-summary"
        exportMode="all"
      />
    </Modal>
  );
}

export function RequestProjectDetailPage({
  request,
  payouts = [],
  paymentLists,
  creators,
  generatedInvoices,
  contracts = [],
  currentUser,
  onExportPaymentList,
  onApprovalAction,
  onOpenFinanceReview,
  onBack,
  notify,
}: {
  request: RequestProjectSummary;
  payouts?: Payout[];
  paymentLists: PaymentListRecord[];
  creators: CreatorProfile[];
  generatedInvoices: GeneratedInvoiceRecord[];
  contracts?: ContractRecord[];
  currentUser: SystemUser;
  onExportPaymentList: (request: RequestProjectSummary, paymentListId: PaymentListId) => Promise<void>;
  onApprovalAction: (
    request: RequestProjectSummary,
    action: RequestApprovalAction,
    reason?: string,
  ) => boolean;
  onOpenFinanceReview: () => void;
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
  const canReturnCurrentRequest = Boolean(
    request.approval
    && canReturnRequestApproval(currentUser, request.approval, request.pm),
  );
  const currentApprovalLabel = request.approval
    ? REQUEST_APPROVAL_STATUS_LABEL[request.approval.status]
    : requestProjectStatusFor(request) ?? '请款提交';
  const normalizedReturnReason = returnReason.trim();
  const requestPaymentLists = paymentListsForRequest(request, paymentLists);
  const paymentListPayees = requestPayeesFromPaymentLists(
    requestPaymentLists,
    creators,
    generatedInvoices,
    payouts,
  );
  const payees = paymentListPayees.length ? paymentListPayees : getRequestPayees(request, detail);
  const paymentChannel = requestPaymentChannelLabel(
    request.paymentChannel ?? payees.map((payee) => payee.channel),
  );
  const financeReview = buildRequestFinanceReview(request, generatedInvoices, paymentLists, contracts);
  const contractMismatchNoticeItems = financeReview.pages.flatMap((page) => {
    const review = page.contractMismatchReview;
    if (!review?.reason) return [];
    const reviewedAt = review.reviewedAt ? new Date(review.reviewedAt) : null;
    const reviewedAtLabel = reviewedAt && !Number.isNaN(reviewedAt.getTime())
      ? reviewedAt.toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : review.reviewedAt;
    return [{
      invoiceNumber: page.invoiceNumber,
      reason: review.reason,
      meta: [review.actorName || review.actorRole, reviewedAtLabel].filter(Boolean).join(' · ') || undefined,
    }];
  });
  const financeApprovalBlocked = request.approval?.status === 'PENDING_FINANCE' && !financeReview.canApprove;
  const isFinanceApprovalStage = request.approval?.status === 'PENDING_FINANCE';
  const records = getRequestProjectResourceRecords(
    request,
    detail,
    payees,
    requestPaymentLists,
    generatedInvoices,
    payouts,
  );
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
        subtitle={`关联项目 ${request.cooperationProjectName ?? request.project}`}
        actions={<span className="project-detail-status"><i />{currentApprovalLabel}</span>}
      />

      <div className="metrics-grid project-detail-metrics">
        <article className="metric-card metric-peach"><span>请款金额</span><strong>{request.amount}</strong><small>由 {detail.submitter} 提交</small></article>
        <article className="metric-card"><span>关联资料</span><strong>{request.contracts + request.invoices} 份</strong><small>{request.contracts} 份合同 · {request.invoices} 份 Invoice</small></article>
        <article className="metric-card metric-lilac"><span>当前状态</span><strong>{currentApprovalLabel}</strong><small>{request.approval ? `第 ${request.approval.round} 轮审批` : `审批负责人 · ${detail.approver}`}</small></article>
      </div>

      <div className="project-detail-layout">
        <div className="project-detail-main">
          <RequestProjectInfoCard
            requestCode={request.requestCode ?? request.id}
            cooperationProjectName={request.cooperationProjectName ?? request.project}
            cooperationProjectCode={request.cooperationProjectCode ?? String(request.projectId ?? '')}
            brand={request.brand}
            pm={request.pm}
            paymentChannel={request.paymentChannel ? paymentProviderDisplayName(request.paymentChannel) : undefined}
            paymentEntity={request.paymentEntity}
            projectCostAttribution={request.projectCostAttribution}
            expectedPaymentDate={request.expectedPaymentDate}
            costType={request.costType}
            costTypeDetail={request.costTypeDetail}
            media={request.media}
            createdAt={request.createdAt ?? request.approval?.submittedAt}
            reason={request.generatedDetail?.reason}
            remark={request.remark}
          />

          <InvoiceContractMismatchNotice
            className="request-contract-mismatch-notices"
            items={contractMismatchNoticeItems}
          />

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
                    <ListActionButton
                      kind="view"
                      data-testid={`open-request-${resource.kind}`}
                      onClick={() => setViewer({ kind: resource.kind, recordId: null })}
                    >
                      {resource.action}
                    </ListActionButton>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="project-detail-card">
            <header className="project-detail-card-header">
              <div><h2>付款明细</h2><p>展示当前请款中的达人、Invoice、请款与实际支出。</p></div>
              <span>共 {request.invoices} 份 Invoice</span>
            </header>
            <div className="table-scroll">
              <table className="data-table request-detail-payment-table">
                <thead><tr><th>达人</th><th>Invoice</th><th>付款渠道</th><th>请款金额</th><th>实际支出金额</th><th>校验状态</th><th>付款状态</th></tr></thead>
                <tbody>{payees.map((payee) => {
                  const creator = payee.creatorId
                    ? creators.find((candidate) => String(candidate.id) === String(payee.creatorId))
                    : creators.find((candidate) => candidate.name === payee.name);
                  const validationStatus = payee.validationStatus ?? '已校验';
                  const paymentStatus = payee.paymentStatus ?? payee.status ?? '未付款';
                  return <tr key={`${request.id}${payee.invoice}`}><td><div className="request-detail-creator-cell"><CreatorIdentity creator={creator} displayName={payee.name} initials={payee.initials} accent={payee.accent} fallbackHandle={payee.handle} fallbackPlatform={payee.platform} socialAccountsMaxVisible={1} /></div></td><td><button className="invoice-record-link" type="button" onClick={() => { setDocumentViewer({ kind: 'invoice', recordId: payee.invoice }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{payee.invoice}</button></td><td><PaymentProviderBadge compact provider={payee.channel} /></td><td>{payee.amount}</td><td>{payee.actualExpenditure ?? '—'}</td><td><span className={`simple-status ${validationStatus === '已校验' ? 'is-success' : 'is-processing'}`}><i />{validationStatus}</span></td><td><span className={`simple-status ${paymentStatus === '已付款' ? 'is-success' : paymentStatus === '付款失败' ? 'is-danger' : 'is-processing'}`}><i />{paymentStatus}</span></td></tr>;
                })}</tbody>
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
          {isFinanceApprovalStage && canReviewCurrentStage ? (
            <div className="invoice-review-actions request-approval-actions">
              <Button icon={<WalletCards size={16} />} onClick={onOpenFinanceReview}>
                前往付款工作台
              </Button>
            </div>
          ) : canReviewCurrentStage || canReturnCurrentRequest ? (
            <div className="invoice-review-actions request-approval-actions">
              {canReturnCurrentRequest ? <Button variant="secondary" onClick={() => setReturnDialogOpen(true)}>退回媒介修改</Button> : null}
              {canReviewCurrentStage ? (
                <Button
                  disabled={financeApprovalBlocked}
                  disabledReason="财务资料校验尚未完成，当前不能审批通过。"
                  onClick={() => onApprovalAction(request, 'APPROVE')}
                >
                  审批通过
                </Button>
              ) : null}
            </div>
          ) : null}
          {isFinanceApprovalStage && canReviewCurrentStage ? (
            <div className="drawer-alert">
              {financeApprovalBlocked ? <CircleAlert size={18} /> : <ShieldCheck size={18} />}
              <span>
                <strong>{financeApprovalBlocked ? '存在待处理差异' : '等待逐份核对'}</strong>
                {financeApprovalBlocked
                  ? `Invoice 与付款清单存在 ${financeReview.mismatchCount || '未定位'} 项关键差异。`
                  : `请前往付款工作台，逐份确认 ${financeReview.totalCount} 份 Invoice 与付款明细。`}
              </span>
            </div>
          ) : null}
        </aside>
      </div>

      {viewer?.kind === 'payment' ? (
        <RequestPaymentListReviewViewer
          project={projectContext}
          paymentLists={requestPaymentLists}
          creators={creators}
          financeReview={financeReview}
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
          title="退回媒介修改"
          width="520px"
          onClose={() => setReturnDialogOpen(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setReturnDialogOpen(false)}>取消</Button>
              <Button
                variant="danger"
                disabled={!normalizedReturnReason}
                disabledReason="请先填写退回原因。"
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
            <small>项目修改后回到当前 OA 节点；只有实际修改的 Invoice 需要重新签署和媒介审核。</small>
          </label>
        </Modal>
      ) : null}
    </div>
  );
}
