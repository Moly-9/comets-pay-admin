import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Eye,
  FileText,
  ListChecks,
  ReceiptText,
  Search,
  Users,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Modal, PageHeading, SelectField } from '../components/Common';
import { CreatorIdentity } from '../components/CreatorIdentity';
import { paymentProviderDisplayName } from '../components/PaymentProviderBadge';
import type { ContractRecord } from '../contracts';
import type {
  ProjectResourceKind,
  ProjectResourceRecord,
  ProjectResourceRecords,
  ProjectResourceViewerState,
} from '../projectResources';
import type { CreatorProfile, GeneratedInvoiceRecord } from '../types';
import {
  canEditProject,
  type CooperationProjectId,
  type CreatorId,
  type InvoiceId,
  type PaymentListEditableField,
  type PaymentListId,
  type PaymentListRecord,
  type EngagementId,
  type ProjectId,
  type ProjectReviewStatus,
  type WorkflowAuditEvent,
} from '../businessWorkflow';
import { ProjectDocumentDetailPage } from './ProjectDocumentDetailPage';
import { ProjectResourceManager } from '../components/ProjectResourceManager';
import type { SystemUser } from '../data';
import { demoDisplayName } from '../demoCreatorNames';
import {
  creatorSocialAccounts,
  creatorSocialSelectionValue,
  creatorSearchTerms,
  findCreatorSocialAccount,
  parseCreatorSocialSelectionValue,
  resolveCreatorSocialAccount,
} from '../creatorSearchOptions';

export type ProjectSummary = {
  id: string;
  projectId?: ProjectId;
  projectCode?: string;
  cooperationProjectId?: CooperationProjectId;
  cooperationProjectCode?: string;
  externalProjectId?: string;
  externalSystem?: 'FEISHU';
  syncStatus?: 'SYNCED' | 'STALE' | 'FAILED';
  syncedAt?: string;
  name: string;
  brand: string;
  media: string;
  pm: string;
  creators: number;
  creatorProfiles?: Array<{
    creatorId: CreatorId;
    engagementId: EngagementId;
    projectId?: ProjectId;
    status?: 'active' | 'removed';
    createdAt?: string;
    updatedAt?: string;
    name: string;
    handle: string;
    platform: string;
    socialAccountId?: string;
  }>;
  requestReason?: string;
  invoiceCount?: number;
  paymentOrder?: string;
  budget: string;
  status: string;
  reviewStatus?: ProjectReviewStatus;
  submittedAt?: string;
  returnedAt?: string;
  reviewUpdatedAt?: string;
};

type ProjectCreator = {
  creatorId?: CreatorId;
  name: string;
  platform: string;
  deliverable: string;
  status: string;
};

type ProjectProgress = {
  label: string;
  description: string;
  time: string;
  state: 'complete' | 'current' | 'pending';
};

type ProjectResource = {
  id: string;
  meta: string;
  status: string;
};

type ProjectDetail = {
  media: string;
  requestReason: string;
  createdAt: string;
  updatedAt: string;
  contract: ProjectResource;
  invoice: ProjectResource;
  payment: ProjectResource;
  creators: ProjectCreator[];
  progress: ProjectProgress[];
};

type Notify = (title: string, message: string) => void;

type InvoiceSeed = {
  creator: string;
  amount: string;
  channel: string;
};

type ProjectCreatorReference = NonNullable<ProjectSummary['creatorProfiles']>[number];

const PROJECT_RESOURCE_CONFIG = [
  { kind: 'contract', label: '合同', icon: FileText, action: '查看合同' },
  { kind: 'invoice', label: 'Invoice', icon: ReceiptText, action: '查看 Invoice' },
  { kind: 'payment', label: '付款清单', icon: WalletCards, action: '查看清单' },
] as const;

const PROJECT_RESOURCE_VIEW_COPY: Record<ProjectResourceKind, {
  title: string;
  singular: string;
  emptyTitle: string;
  emptyDescription: string;
  previewTitle: string;
  previewDescription: string;
}> = {
  contract: {
    title: '合同资料',
    singular: '合同',
    emptyTitle: '尚未关联合同',
    emptyDescription: '上传或从合同管理中关联后，可在这里查看合同详情。',
    previewTitle: '合同内容摘要',
    previewDescription: '展示该项目合同的签署主体、合作金额与归档信息。',
  },
  invoice: {
    title: 'Invoice 列表',
    singular: 'Invoice',
    emptyTitle: '尚未关联 Invoice',
    emptyDescription: '从系统选择 Invoice 后，可在这里逐项查看开票与收款信息。',
    previewTitle: 'Invoice 内容摘要',
    previewDescription: '展示达人、Invoice 日期、付款渠道及审核状态。',
  },
  payment: {
    title: '付款清单',
    singular: '付款明细',
    emptyTitle: '付款清单尚未生成',
    emptyDescription: '请款审批通过后，系统会按 Invoice 自动生成付款清单。',
    previewTitle: '付款处理摘要',
    previewDescription: '展示付款批次、收款人、渠道及当前处理状态。',
  },
};

function createCreatorContractRecords({
  projectId,
  projectName,
  brand,
  status,
  signedAt,
  invoices,
}: {
  projectId: string;
  projectName: string;
  brand: string;
  status: string;
  signedAt: string;
  invoices: ProjectResourceRecord[];
}): ProjectResourceRecord[] {
  const projectCode = projectId.replace('PRJ-', '');
  return invoices.map((invoice, index) => {
    const id = `CON-${projectCode}-${String(index + 1).padStart(2, '0')}`;
    return {
      id,
      title: `${invoice.title} 达人合作协议`,
      subtitle: `${invoice.title} · ${brand}`,
      amount: invoice.amount,
      status,
      channel: invoice.channel,
      fields: [
        { label: '合同编号', value: id },
        { label: '签约达人', value: invoice.title },
        { label: '合作品牌', value: brand },
        { label: '关联项目', value: projectName },
        { label: '合同金额', value: invoice.amount },
        { label: '关联 Invoice', value: invoice.id },
        { label: '签署状态', value: status },
        { label: '签署 / 更新时间', value: signedAt },
        { label: '归档文件', value: `${id}${status === '待签署' || status === '待补充' ? '-draft' : ''}.pdf` },
      ],
    };
  });
}

function createInvoiceRecords({
  projectId,
  projectName,
  status,
  invoiceDate,
  rows,
}: {
  projectId: string;
  projectName: string;
  status: string;
  invoiceDate: string;
  rows: InvoiceSeed[];
}): ProjectResourceRecord[] {
  const projectCode = projectId.replace('PRJ-', '');
  return rows.map((row, index) => {
    const id = `INV-${projectCode}-${String(index + 1).padStart(2, '0')}`;
    const channel = paymentProviderDisplayName(row.channel);
    const creatorName = demoDisplayName(row.creator);
    return {
      id,
      title: creatorName,
      subtitle: `${invoiceDate} · ${channel}`,
      amount: row.amount,
      status,
      channel,
      fields: [
        { label: 'Invoice 编号', value: id },
        { label: '达人 / 收款人', value: creatorName },
        { label: '关联项目', value: projectName },
        { label: 'Invoice 日期', value: invoiceDate },
        { label: '付款渠道', value: channel },
        { label: '金额', value: row.amount },
        { label: '审核状态', value: status },
      ],
    };
  });
}

function createPaymentRecords({
  projectId,
  projectName,
  batchId,
  status,
  processedAt,
  invoices,
}: {
  projectId: string;
  projectName: string;
  batchId: string;
  status: string;
  processedAt: string;
  invoices: ProjectResourceRecord[];
}): ProjectResourceRecord[] {
  const projectCode = projectId.replace('PRJ-', '');
  return invoices.map((invoice, index) => {
    const id = `PMT-${projectCode}${String(index + 1).padStart(4, '0')}`;
    const channel = invoice.channel ?? '待确认';
    return {
      id,
      title: invoice.title,
      subtitle: `${batchId} · ${channel}`,
      amount: invoice.amount,
      status,
      channel,
      fields: [
        { label: '付款明细编号', value: id },
        { label: '付款批次', value: batchId },
        { label: '收款人', value: invoice.title },
        { label: '关联项目', value: projectName },
        { label: '关联 Invoice', value: invoice.id },
        { label: '付款渠道', value: channel },
        { label: '付款金额', value: invoice.amount },
        { label: '处理时间', value: processedAt },
        { label: '付款状态', value: status },
      ],
    };
  });
}

const SUMMER_INVOICE_RECORDS = createInvoiceRecords({
  projectId: 'PRJ-260718',
  projectName: '夏日直播计划',
  status: '财务复核中',
  invoiceDate: '2026-07-19',
  rows: [
    { creator: 'Mina Kato', amount: 'USD 3,240', channel: 'Airwallex' },
    { creator: 'Yuki Tanaka', amount: 'USD 1,480', channel: 'PayPal' },
    { creator: 'Camila Costa', amount: 'USD 2,160', channel: 'PayMax' },
    { creator: 'Oliver Chen', amount: 'USD 1,850', channel: 'Airwallex' },
    { creator: 'Alex Ruiz', amount: 'USD 1,320', channel: 'PayMax' },
    { creator: 'Hannah Lee', amount: 'USD 920', channel: 'PayPal' },
    { creator: 'Nika Petrova', amount: 'USD 1,200', channel: 'Airwallex' },
    { creator: 'Luca Bianchi', amount: 'USD 1,050', channel: 'PayMax' },
    { creator: 'Luna Jones', amount: 'USD 980', channel: 'Airwallex' },
    { creator: 'Sofia Kim', amount: 'USD 1,420', channel: 'PayPal' },
    { creator: 'Noah Park', amount: 'USD 1,350', channel: 'Airwallex' },
    { creator: 'Maya Chen', amount: 'USD 1,450', channel: 'PayMax' },
  ],
});

const UNBOXING_INVOICE_RECORDS = createInvoiceRecords({
  projectId: 'PRJ-260714',
  projectName: '新品开箱',
  status: '飞书审批中',
  invoiceDate: '2026-07-16',
  rows: [
    { creator: 'Alex Ruiz', amount: 'EUR 1,850', channel: 'PayMax' },
    { creator: 'Hannah Lee', amount: 'EUR 950', channel: 'PayPal' },
    { creator: 'Luca Bianchi', amount: 'EUR 800', channel: 'Airwallex' },
    { creator: 'Mia Johnson', amount: 'EUR 700', channel: 'PayPal' },
    { creator: 'Theo Martin', amount: 'EUR 650', channel: 'Airwallex' },
    { creator: 'Sofia Kim', amount: 'EUR 500', channel: 'PayMax' },
    { creator: 'Noah Park', amount: 'EUR 400', channel: 'Airwallex' },
    { creator: 'Emma Davis', amount: 'EUR 350', channel: 'PayPal' },
  ],
});

const COLLAB_INVOICE_RECORDS = createInvoiceRecords({
  projectId: 'PRJ-260702',
  projectName: '七月联名',
  status: '已通过',
  invoiceDate: '2026-07-15',
  rows: [
    { creator: 'Luna Jones', amount: 'USD 2,800', channel: 'Airwallex' },
    { creator: 'Emily Wong', amount: 'USD 2,400', channel: 'PayPal' },
    { creator: 'Marc O.', amount: 'USD 2,500', channel: 'Airwallex' },
    { creator: 'Sofia Kim', amount: 'USD 2,250', channel: 'PayMax' },
    { creator: 'Noah Park', amount: 'USD 2,650', channel: 'Airwallex' },
  ],
});

const JAPAN_CREATOR_NAMES = [
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
];

const JAPAN_INVOICE_RECORDS = createInvoiceRecords({
  projectId: 'PRJ-260625',
  projectName: '日本市场测评',
  status: '已通过',
  invoiceDate: '2026-07-10',
  rows: JAPAN_CREATOR_NAMES.map((creator, index) => ({
    creator,
    amount: 'USD 2,575',
    channel: index % 4 === 1 ? 'PayPal' : 'Airwallex',
  })),
});

const PROJECT_RESOURCE_RECORDS: Record<string, ProjectResourceRecords> = {
  'PRJ-260718': {
    contract: createCreatorContractRecords({
      projectId: 'PRJ-260718',
      projectName: '夏日直播计划',
      brand: 'Solara Beauty',
      status: '履约中',
      signedAt: '2026-07-18 10:05',
      invoices: SUMMER_INVOICE_RECORDS,
    }),
    invoice: SUMMER_INVOICE_RECORDS,
    payment: createPaymentRecords({
      projectId: 'PRJ-260718',
      projectName: '夏日直播计划',
      batchId: 'PAY-2607180004',
      status: '待打款',
      processedAt: '财务复核通过后执行',
      invoices: SUMMER_INVOICE_RECORDS,
    }),
  },
  'PRJ-260714': {
    contract: createCreatorContractRecords({
      projectId: 'PRJ-260714',
      projectName: '新品开箱',
      brand: 'Nova Lab',
      status: '待签署',
      signedAt: '最后更新 2026-07-16 15:40',
      invoices: UNBOXING_INVOICE_RECORDS,
    }),
    invoice: UNBOXING_INVOICE_RECORDS,
    payment: [],
  },
  'PRJ-260702': {
    contract: createCreatorContractRecords({
      projectId: 'PRJ-260702',
      projectName: '七月联名',
      brand: 'Mellow Home',
      status: '已签署',
      signedAt: '2026-07-08 12:10',
      invoices: COLLAB_INVOICE_RECORDS,
    }),
    invoice: COLLAB_INVOICE_RECORDS,
    payment: createPaymentRecords({
      projectId: 'PRJ-260702',
      projectName: '七月联名',
      batchId: 'PAY-2607020008',
      status: '付款处理中',
      processedAt: '2026-07-17 18:05',
      invoices: COLLAB_INVOICE_RECORDS,
    }),
  },
  'PRJ-260625': {
    contract: createCreatorContractRecords({
      projectId: 'PRJ-260625',
      projectName: '日本市场测评',
      brand: 'Aster Mobile',
      status: '已归档',
      signedAt: '2026-06-28 10:20',
      invoices: JAPAN_INVOICE_RECORDS,
    }),
    invoice: JAPAN_INVOICE_RECORDS,
    payment: createPaymentRecords({
      projectId: 'PRJ-260625',
      projectName: '日本市场测评',
      batchId: 'PAY-2606250012',
      status: '已完成',
      processedAt: '2026-07-16 14:32',
      invoices: JAPAN_INVOICE_RECORDS,
    }),
  },
};

const RAW_PROJECT_DETAILS: Record<string, ProjectDetail> = {
  'PRJ-260718': {
    media: '赖丽红',
    requestReason: '支付直播达人首期合作费用、内容制作费用及项目投流预算。',
    createdAt: '2026-07-18 09:20',
    updatedAt: '今天 09:36',
    contract: { id: '12 份合同', meta: '对应 12 位达人 · 已关联 12 份 Invoice', status: '履约中' },
    invoice: { id: '12 份 Invoice', meta: '对应 12 份合同 · 请款金额 USD 18,420', status: '财务复核中' },
    payment: { id: 'PAY-2607180004', meta: 'Airwallex · 12 笔付款', status: '待打款' },
    creators: [
      { name: 'Mina Kato', platform: 'TikTok / Instagram', deliverable: '直播 2 场 + 短视频 3 条', status: '已验收' },
      { name: 'Yuki Tanaka', platform: 'Instagram', deliverable: 'Reels 2 条', status: '内容制作中' },
      { name: 'Camila Costa', platform: 'TikTok', deliverable: '短视频 2 条', status: '待交付' },
    ],
    progress: [
      { label: '项目创建', description: '项目与预算信息已建立', time: '07-18 09:20', state: 'complete' },
      { label: '合同归档', description: '12 份达人合同已签署并归档', time: '07-18 10:05', state: 'complete' },
      { label: 'Invoice 汇总', description: '12 份合同已一一关联 Invoice', time: '07-19 14:30', state: 'complete' },
      { label: '财务复核', description: '正在核对收款主体与金额', time: '今天 09:36', state: 'current' },
      { label: '渠道打款', description: '复核通过后进入 Airwallex', time: '待开始', state: 'pending' },
    ],
  },
  'PRJ-260714': {
    media: '张诗雨',
    requestReason: '支付新品开箱项目的达人内容制作、授权及样品拍摄费用。',
    createdAt: '2026-07-14 11:10',
    updatedAt: '昨天 16:20',
    contract: { id: '8 份合同', meta: '对应 8 位达人 · 已关联 8 份 Invoice', status: '待签署' },
    invoice: { id: '8 份 Invoice', meta: '对应 8 份合同 · 请款金额 EUR 6,200', status: '飞书审批中' },
    payment: { id: '待生成', meta: '审批完成后自动生成付款清单', status: '未生成' },
    creators: [
      { name: 'Alex Ruiz', platform: 'YouTube', deliverable: '长视频 1 条', status: '待验收' },
      { name: 'Hannah Lee', platform: 'Instagram', deliverable: 'Reels 1 条 + Story 3 条', status: '已交付' },
      { name: 'Luca Bianchi', platform: 'TikTok', deliverable: '短视频 2 条', status: '内容制作中' },
    ],
    progress: [
      { label: '项目创建', description: '项目与达人名单已建立', time: '07-14 11:10', state: 'complete' },
      { label: '合同签署', description: '8 份达人合同等待完成签署', time: '处理中', state: 'current' },
      { label: 'Invoice 汇总', description: '已收到并关联 8 份 Invoice', time: '07-16 15:40', state: 'complete' },
      { label: '飞书审批', description: '等待项目负责人审批', time: '昨天 16:20', state: 'current' },
      { label: '生成付款清单', description: '审批完成后自动生成', time: '待开始', state: 'pending' },
    ],
  },
  'PRJ-260702': {
    media: '龙哲心',
    requestReason: '结算七月联名内容合作费用及达人素材授权费用。',
    createdAt: '2026-07-02 10:35',
    updatedAt: '2026-07-17 18:05',
    contract: { id: '5 份合同', meta: '对应 5 位达人 · 已关联 5 份 Invoice', status: '已签署' },
    invoice: { id: '5 份 Invoice', meta: '对应 5 份合同 · 请款金额 USD 12,600', status: '已通过' },
    payment: { id: 'PAY-2607020008', meta: 'Airwallex · 批量付款', status: '付款处理中' },
    creators: [
      { name: 'Luna Jones', platform: 'Instagram', deliverable: 'Reels 2 条 + Story 6 条', status: '已验收' },
      { name: 'Emily Wong', platform: 'YouTube', deliverable: '长视频 1 条', status: '已验收' },
      { name: 'Marc O.', platform: 'Instagram', deliverable: '图文 3 组', status: '已验收' },
    ],
    progress: [
      { label: '项目创建', description: '项目已建立', time: '07-02 10:35', state: 'complete' },
      { label: '合同归档', description: '5 份达人合同已归档', time: '07-08 12:10', state: 'complete' },
      { label: 'Invoice 审核', description: '5 份 Invoice 均已通过', time: '07-15 17:25', state: 'complete' },
      { label: '付款单生成', description: 'PAY-2607020008', time: '07-16 09:15', state: 'complete' },
      { label: '渠道打款', description: 'Airwallex 正在处理', time: '07-17 18:05', state: 'current' },
    ],
  },
  'PRJ-260625': {
    media: '赖丽红',
    requestReason: '结算日本市场测评项目全部达人合作与内容授权费用。',
    createdAt: '2026-06-25 14:00',
    updatedAt: '2026-07-16 14:32',
    contract: { id: '16 份合同', meta: '对应 16 位达人 · 已关联 16 份 Invoice', status: '已归档' },
    invoice: { id: '16 份 Invoice', meta: '对应 16 份合同 · 请款金额 USD 41,200', status: '已通过' },
    payment: { id: 'PAY-2606250012', meta: 'Airwallex · 16 笔付款', status: '已完成' },
    creators: [
      { name: 'Kenji Mori', platform: 'YouTube', deliverable: '测评视频 1 条', status: '已完成' },
      { name: 'Mina Kato', platform: 'TikTok', deliverable: '短视频 2 条', status: '已完成' },
      { name: 'Nika', platform: 'Instagram', deliverable: 'Reels 2 条', status: '已完成' },
    ],
    progress: [
      { label: '项目创建', description: '项目已建立', time: '06-25 14:00', state: 'complete' },
      { label: '合同归档', description: '16 份达人合同已签署并归档', time: '06-28 10:20', state: 'complete' },
      { label: 'Invoice 审核', description: '16 份 Invoice 均已通过', time: '07-10 16:45', state: 'complete' },
      { label: '渠道打款', description: '16 笔付款全部成功', time: '07-16 14:32', state: 'complete' },
      { label: '项目完成', description: '项目资料已归档', time: '07-16 15:00', state: 'complete' },
    ],
  },
};

const PROJECT_DETAILS: Record<string, ProjectDetail> = Object.fromEntries(
  Object.entries(RAW_PROJECT_DETAILS).map(([projectId, detail]) => [
    projectId,
    {
      ...detail,
      creators: detail.creators.map((creator) => ({
        ...creator,
        name: demoDisplayName(creator.name),
      })),
    },
  ]),
);

function resolveProjectCreatorReferences(
  project: ProjectSummary,
  creatorArchive: CreatorProfile[],
): ProjectCreatorReference[] {
  const archiveById = new Map(creatorArchive.map((creator) => [creator.id, creator]));
  return (project.creatorProfiles ?? []).map((reference) => {
    const currentProfile = archiveById.get(reference.creatorId);
    const currentSocialAccount = findCreatorSocialAccount(
      currentProfile,
      reference.socialAccountId,
      reference.handle,
      reference.platform,
    );
    return currentProfile
      ? {
          creatorId: currentProfile.id as CreatorId,
          engagementId: reference.engagementId,
          name: currentProfile.name,
          handle: currentSocialAccount?.handle ?? reference.handle,
          platform: currentSocialAccount?.platform ?? reference.platform,
          socialAccountId: currentSocialAccount?.id ?? reference.socialAccountId,
        }
      : reference;
  });
}

function projectCreatorRows(
  project: ProjectSummary,
  creatorArchive: CreatorProfile[],
): ProjectCreator[] {
  const deliverables = [
    'Dedicated Video 1 条',
    'TikTok 短视频 2 条',
    'Instagram Reels 1 条',
    '直播合作 1 场',
    'Integrated Video 1 条',
    '图文内容 2 组',
  ];
  const activeStatuses = ['脚本确认中', '待发布', '待验收', '已交付'];

  return resolveProjectCreatorReferences(project, creatorArchive).map((creator, index) => ({
    creatorId: creator.creatorId,
    name: creator.name,
    platform: creator.platform,
    deliverable: deliverables[index % deliverables.length],
    status: project.status === '已完成' ? '已完成' : activeStatuses[index % activeStatuses.length],
  }));
}

function getProjectDetail(project: ProjectSummary, creatorArchive: CreatorProfile[]): ProjectDetail {
  const existingDetail = PROJECT_DETAILS[project.id];
  if (existingDetail) {
    return project.creatorProfiles
      ? { ...existingDetail, creators: projectCreatorRows(project, creatorArchive) }
      : existingDetail;
  }

  const hasPaymentOrder = Boolean(project.paymentOrder && project.paymentOrder !== '待生成');
  return {
    media: project.media,
    requestReason: project.requestReason || '尚未填写付款事由。',
    createdAt: '已从项目系统同步',
    updatedAt: '今天',
    contract: {
      id: `${project.invoiceCount ?? 0} 份合同`,
      meta: project.invoiceCount ? `对应 ${project.creators} 位达人 · 与 Invoice 一一匹配` : '尚未关联合同',
      status: project.status === '已完成' ? '已归档' : '履约中',
    },
    invoice: {
      id: `${project.invoiceCount ?? 0} 份 Invoice`,
      meta: project.invoiceCount ? `对应 ${project.invoiceCount} 份合同 · 项目金额 ${project.budget}` : '尚未关联 Invoice',
      status: project.status === '已完成' ? '已通过' : '审核中',
    },
    payment: {
      id: project.paymentOrder ?? '待生成',
      meta: hasPaymentOrder ? `${project.creators} 笔达人付款明细` : '请款审核通过后生成付款清单',
      status: hasPaymentOrder ? (project.status === '已完成' ? '已完成' : '待打款') : '未生成',
    },
    creators: projectCreatorRows(project, creatorArchive),
    progress: [
      { label: '项目创建', description: project.creators > 0 ? `项目草稿与 ${project.creators} 位达人已关联` : '项目草稿已建立', time: '刚刚', state: 'current' },
      { label: '补充合同', description: '等待上传并关联合同', time: '待开始', state: 'pending' },
      { label: '关联 Invoice', description: project.invoiceCount ? `已选择 ${project.invoiceCount} 份 Invoice` : '等待选择 Invoice', time: '待开始', state: 'pending' },
      { label: '提交审核', description: '资料完整后可提交', time: '待开始', state: 'pending' },
      { label: '渠道打款', description: '审核完成后执行', time: '待开始', state: 'pending' },
    ],
  };
}

function getProjectResourceRecords(
  project: ProjectSummary,
  creatorArchive: CreatorProfile[],
): ProjectResourceRecords {
  const existingRecords = PROJECT_RESOURCE_RECORDS[project.id];
  if (existingRecords) return existingRecords;

  const linkedInvoiceCount = project.invoiceCount ?? 0;
  const linkedCreators = resolveProjectCreatorReferences(project, creatorArchive);
  const invoiceRecords = createInvoiceRecords({
    projectId: project.id,
    projectName: project.name,
    status: '待审核',
    invoiceDate: '刚刚关联',
    rows: Array.from({ length: linkedInvoiceCount }, (_, index) => ({
      creator: linkedCreators[index]?.handle || linkedCreators[index]?.name || `待确认达人 ${index + 1}`,
      amount: `${project.budget.split(' ')[0] || 'USD'} 待确认`,
      channel: '待确认',
    })),
  });

  const contractRecords = createCreatorContractRecords({
    projectId: project.id,
    projectName: project.name,
    brand: project.brand,
    status: project.status === '已完成' ? '已归档' : '履约中',
    signedAt: project.status === '已完成' ? '已完成归档' : '推进中',
    invoices: invoiceRecords,
  });
  const paymentRecords = project.paymentOrder && project.paymentOrder !== '待生成'
    ? createPaymentRecords({
      projectId: project.id,
      projectName: project.name,
      batchId: project.paymentOrder,
      status: project.status === '已完成' ? '已完成' : '待打款',
      processedAt: project.status === '已完成' ? '已完成' : '等待审批完成',
      invoices: invoiceRecords,
    })
    : [];

  return {
    contract: contractRecords,
    invoice: invoiceRecords,
    payment: paymentRecords,
  };
}

const splitCreatorPlatforms = (platform: string) => (
  platform
    .split(/\s*[·/]\s*/)
    .map((value) => value.trim())
    .filter(Boolean)
);

function ProjectCreatorManagerModal({
  project,
  creatorArchive,
  onSave,
  onClose,
}: {
  project: ProjectSummary;
  creatorArchive: CreatorProfile[];
  onSave: (creatorHandles: string[]) => void;
  onClose: () => void;
}) {
  const creatorEntries = useMemo(() => creatorArchive.flatMap((creator) => {
    const primaryAccount = creatorSocialAccounts(creator)[0];
    return primaryAccount ? [{
      creator,
      value: creatorSocialSelectionValue(creator.id, primaryAccount.id),
    }] : [];
  }), [creatorArchive]);
  const initialHandles = project.creatorProfiles?.flatMap((reference) => {
    const creator = creatorArchive.find((item) => item.id === reference.creatorId);
    const socialAccount = resolveCreatorSocialAccount(
      creator,
      reference.socialAccountId,
      reference.handle,
      reference.platform,
    );
    return creator && socialAccount
      ? [creatorSocialSelectionValue(creator.id, socialAccount.id)]
      : [];
  }) ?? [];
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [selectedHandles, setSelectedHandles] = useState<string[]>(initialHandles);
  const selectedHandleSet = useMemo(() => new Set(selectedHandles), [selectedHandles]);
  const normalizedSearch = search.trim().toLowerCase();
  const regionOptions = useMemo(() => [
    { value: 'all', label: '全部地区', description: `${creatorArchive.length} 位达人` },
    ...Array.from(new Set(creatorArchive.map((creator) => creator.region))).map((item) => ({
      value: item,
      label: item,
      description: `${creatorArchive.filter((creator) => creator.region === item).length} 位达人`,
    })),
  ], [creatorArchive]);
  const platformOptions = useMemo(() => {
    const platforms = Array.from(new Set(creatorArchive.flatMap((creator) => (
      creatorSocialAccounts(creator).map((socialAccount) => socialAccount.platform)
    ))));
    return [
      { value: 'all', label: '全部平台', description: `${creatorArchive.length} 位达人` },
      ...platforms.map((item) => ({
        value: item,
        label: item,
        description: `${creatorArchive.filter((creator) => creatorSocialAccounts(creator).some((account) => account.platform === item)).length} 位达人`,
      })),
    ];
  }, [creatorArchive]);
  const visibleCreators = useMemo(() => creatorEntries.filter(({ creator }) => {
    const matchesSearch = !normalizedSearch || (
      `${creatorSearchTerms(creator)} ${creator.region}`.toLowerCase().includes(normalizedSearch)
    );
    const matchesRegion = region === 'all' || creator.region === region;
    const matchesPlatform = platform === 'all' || creatorSocialAccounts(creator).some((account) => account.platform === platform);
    return matchesSearch && matchesRegion && matchesPlatform;
  }), [creatorEntries, normalizedSearch, platform, region]);
  const hasFilters = Boolean(normalizedSearch || region !== 'all' || platform !== 'all');

  const toggleCreator = (creatorId: string, value: string) => {
    setSelectedHandles((current) => (
      current.includes(value)
        ? current.filter((selectedValue) => selectedValue !== value)
        : [
            ...current.filter((selectedValue) => (
              parseCreatorSocialSelectionValue(selectedValue)?.creatorId !== creatorId
            )),
            value,
          ]
    ));
  };

  const clearFilters = () => {
    setSearch('');
    setRegion('all');
    setPlatform('all');
  };

  return (
    <Modal
      title="选择项目达人"
      onClose={onClose}
      width="900px"
      footer={(
        <>
          <div className="project-creator-modal-footer-summary">
            已选择 <strong>{selectedHandles.length}</strong> 位达人
          </div>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={() => onSave(selectedHandles)}>保存名单（{selectedHandles.length}）</Button>
        </>
      )}
    >
      <div className="project-creator-modal" data-testid="project-creator-manager">
        <div className="project-creator-modal-intro">
          <span className="project-creator-modal-intro-icon"><Users size={20} /></span>
          <div>
            <strong>从达人档案筛选合作达人</strong>
            <p>名单数据实时来自系统【达人档案】，支持按姓名、账号、地区和平台筛选并多选。</p>
          </div>
          <span>{project.name}</span>
        </div>

        {project.creators > 0 && initialHandles.length === 0 ? (
          <div className="project-creator-modal-sync-note">
            当前项目仅同步了 {project.creators} 位达人数量，尚未关联具体档案。保存后将以本次所选达人更新名单。
          </div>
        ) : null}

        <div className="project-creator-modal-toolbar">
          <label className="creator-picker-search project-creator-modal-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="搜索项目达人"
              autoFocus
              placeholder="搜索达人姓名、账号、地区或平台"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <SelectField
            ariaLabel="筛选达人地区"
            variant="form"
            value={region}
            options={regionOptions}
            onChange={setRegion}
          />
          <SelectField
            ariaLabel="筛选达人平台"
            variant="form"
            value={platform}
            options={platformOptions}
            onChange={setPlatform}
          />
        </div>

        <div className="project-creator-modal-list-header">
          <span>
            达人档案
            <small>显示 {visibleCreators.length} / {creatorEntries.length} 位达人</small>
          </span>
          <div>
            {selectedHandles.length > 0 ? (
              <button type="button" onClick={() => setSelectedHandles([])}>清空选择</button>
            ) : null}
            {hasFilters ? <button type="button" onClick={clearFilters}>重置筛选</button> : null}
          </div>
        </div>

        <div className="project-creator-modal-list" role="listbox" aria-label="项目达人档案" aria-multiselectable="true">
          {visibleCreators.map(({ creator, value }) => {
            const selected = selectedHandleSet.has(value);
            return (
              <button
                className={`project-creator-modal-option ${selected ? 'project-creator-modal-option-selected' : ''}`}
                type="button"
                role="option"
                aria-selected={selected}
                data-creator-handle={creatorSocialAccounts(creator)[0]?.handle}
                key={value}
                onClick={() => toggleCreator(creator.id, value)}
              >
                <span className="project-creator-modal-profile">
                  <CreatorIdentity creator={creator} size="md" socialAccountsMode="expanded" />
                </span>
                <span className="project-creator-modal-meta"><strong>{creator.region}</strong><small>{creatorSocialAccounts(creator).length} 个社媒账号</small></span>
                <span className="project-creator-modal-projects">参与 {creator.projects} 个项目</span>
                {selected
                  ? <CheckCircle2 className="project-creator-modal-check project-creator-modal-check-selected" size={20} />
                  : <Circle className="project-creator-modal-check" size={20} />}
              </button>
            );
          })}
          {visibleCreators.length === 0 ? (
            <div className="project-creator-modal-empty">
              <Search size={20} />
              <strong>没有找到匹配的达人</strong>
              <p>可尝试更换关键词、地区或平台条件。</p>
              <Button variant="secondary" onClick={clearFilters}>重置筛选</Button>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

export function ProjectResourceViewer({
  project,
  records,
  viewer,
  onChange,
  onOpenDocument,
  onClose,
}: {
  project: Pick<ProjectSummary, 'id' | 'name' | 'brand'>;
  records: ProjectResourceRecords;
  viewer: ProjectResourceViewerState;
  onChange: (nextState: ProjectResourceViewerState) => void;
  onOpenDocument: (
    kind: Extract<ProjectResourceKind, 'contract' | 'invoice'>,
    recordId: string,
  ) => void;
  onClose: () => void;
}) {
  const copy = PROJECT_RESOURCE_VIEW_COPY[viewer.kind];
  const resourceRecords = records[viewer.kind];
  const selectedRecord = viewer.recordId
    ? resourceRecords.find((record) => record.id === viewer.recordId) ?? null
    : null;
  const ViewerIcon = viewer.kind === 'contract'
    ? FileText
    : viewer.kind === 'invoice'
      ? ReceiptText
      : WalletCards;

  return (
    <Modal
      title={`${project.name} · ${copy.title}`}
      onClose={onClose}
      width="820px"
      footer={selectedRecord ? (
        <>
          <Button variant="ghost" onClick={() => onChange({ ...viewer, recordId: null })}>返回列表</Button>
          <Button variant="secondary" onClick={onClose}>关闭</Button>
        </>
      ) : <Button variant="secondary" onClick={onClose}>关闭</Button>}
    >
      {selectedRecord ? (
        <div className="project-record-detail" data-testid={`project-${viewer.kind}-detail`}>
          <div className="project-record-detail-heading">
            <span className="project-record-detail-icon"><ViewerIcon size={21} /></span>
            <div>
              <small>{copy.singular}详情</small>
              <h3>{selectedRecord.id}</h3>
              <p>{selectedRecord.title}</p>
            </div>
            <span className="project-record-status"><i />{selectedRecord.status}</span>
          </div>

          <div className="project-record-amount">
            <span>关联金额</span>
            <strong>{selectedRecord.amount}</strong>
          </div>

          <dl className="project-record-field-grid">
            {selectedRecord.fields.map((field) => (
              <div key={`${selectedRecord.id}-${field.label}`}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>

          <section className="project-record-preview">
            <div className="project-record-preview-heading">
              <span><ViewerIcon size={17} />{copy.previewTitle}</span>
              <em>只读预览</em>
            </div>
            <p>{copy.previewDescription}</p>
            <div className="project-record-preview-note">
              当前内容来自项目资料快照，查看操作不会修改合同、Invoice 或付款数据。
            </div>
          </section>
        </div>
      ) : (
        <div className="project-record-browser" data-testid={`project-${viewer.kind}-list`}>
          <div className="project-record-browser-heading">
            <div>
              <strong>{copy.title}</strong>
              <p>
                共 {resourceRecords.length} 条资料，
                {viewer.kind === 'payment' ? '点击“查看详情”可展开完整信息。' : '点击“全文阅读”可查看单份完整资料。'}
              </p>
            </div>
            <span>{project.id}</span>
          </div>

          {resourceRecords.length > 0 ? (
            <div className="project-record-list" role="list">
              {resourceRecords.map((record) => (
                <article className="project-record-item" role="listitem" key={record.id}>
                  <span className={`project-record-item-icon is-${viewer.kind}`}><ViewerIcon size={18} /></span>
                  <div className="project-record-item-copy">
                    <strong>{viewer.kind === 'contract' ? record.title : record.id}</strong>
                    <span>{viewer.kind === 'contract' ? record.id : record.title}</span>
                    <small>{record.subtitle}</small>
                  </div>
                  <div className="project-record-item-meta">
                    <strong>{record.amount}</strong>
                    <span className={`project-record-status${(
                      (viewer.kind === 'contract' && record.status === '已签署')
                      || (viewer.kind === 'invoice' && record.status === '已校验')
                    ) ? ' is-success' : ''}`}><i />{record.status}</span>
                  </div>
                  <Button
                    className="project-record-open"
                    variant="secondary"
                    icon={<Eye size={15} />}
                    data-testid={`view-${viewer.kind}-${record.id}`}
                    onClick={() => {
                      if (viewer.kind === 'contract' || viewer.kind === 'invoice') {
                        onOpenDocument(viewer.kind, record.id);
                        return;
                      }
                      onChange({ ...viewer, recordId: record.id });
                    }}
                  >
                    {viewer.kind === 'payment' ? '查看详情' : '全文阅读'}
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="project-record-empty">
              <span><ListChecks size={23} /></span>
              <strong>{copy.emptyTitle}</strong>
              <p>{copy.emptyDescription}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function ProjectDetailPage({
  project,
  creatorArchive,
  currentUser,
  onBack,
  onUpdateCreators,
  contracts = [],
  invoices,
  paymentLists,
  auditEvents,
  onOpenContract,
  onOpenInvoice,
  onCreateInvoice,
  onLinkContract,
  onUnlinkContract,
  onDeleteContract,
  onLinkInvoice,
  onUnlinkInvoice,
  onDeleteInvoice,
  onCreatePaymentList,
  onDeletePaymentList,
  onAddPaymentInvoice,
  onRemovePaymentInvoice,
  onUpdatePaymentItem,
  onChangePaymentAccount,
  onRevalidatePaymentItem,
  onGeneratePaymentOrder,
  onEditPaymentOrder,
  onExportPaymentList,
  onSubmitReview,
  notify,
}: {
  project: ProjectSummary;
  creatorArchive: CreatorProfile[];
  currentUser: SystemUser;
  onBack: () => void;
  onUpdateCreators: (creatorHandles: string[]) => void;
  contracts?: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
  paymentLists: PaymentListRecord[];
  auditEvents: WorkflowAuditEvent[];
  onOpenContract?: (contractId: string) => void;
  onOpenInvoice: (invoiceId: InvoiceId) => void;
  onCreateInvoice: (engagementId: EngagementId) => void;
  onLinkContract: (contractId: string, engagementId: EngagementId) => void;
  onUnlinkContract: (contractId: string) => void;
  onDeleteContract: (contractId: string) => void;
  onLinkInvoice: (invoiceId: InvoiceId, engagementId: EngagementId) => void;
  onUnlinkInvoice: (invoiceId: InvoiceId) => void;
  onDeleteInvoice: (invoiceId: InvoiceId) => void;
  onCreatePaymentList: () => void;
  onDeletePaymentList: (paymentListId: PaymentListId) => void;
  onAddPaymentInvoice: (paymentListId: PaymentListId, invoiceId: InvoiceId) => void;
  onRemovePaymentInvoice: (invoiceId: InvoiceId) => void;
  onUpdatePaymentItem: (invoiceId: InvoiceId, field: PaymentListEditableField, value: string | number) => void;
  onChangePaymentAccount: (invoiceId: InvoiceId, payoutAccountId: string) => void;
  onRevalidatePaymentItem: (invoiceId: InvoiceId) => void;
  onGeneratePaymentOrder: (paymentListId: PaymentListId) => InvoiceId | null;
  onEditPaymentOrder: (paymentListId: PaymentListId) => void;
  onExportPaymentList: (paymentListId: PaymentListId) => Promise<void>;
  onSubmitReview: () => void;
  notify: Notify;
}) {
  const [viewer, setViewer] = useState<ProjectResourceViewerState | null>(null);
  const [creatorManagerOpen, setCreatorManagerOpen] = useState(false);
  const [documentViewer, setDocumentViewer] = useState<{
    kind: Extract<ProjectResourceKind, 'contract' | 'invoice'>;
    recordId: string;
  } | null>(null);
  const canEdit = canEditProject(currentUser, project.reviewStatus ?? 'draft');
  const detail = getProjectDetail(project, creatorArchive);
  const records = getProjectResourceRecords(project, creatorArchive);
  const linkedContracts = contracts.filter((contract) => (
    contract.projectId === (project.projectId ?? project.id)
  ));
  const resources = PROJECT_RESOURCE_CONFIG.map((resource) => ({
    ...resource,
    data: resource.kind === 'contract' && linkedContracts.length > 0
      ? {
          id: `${linkedContracts.length} 份合同`,
          meta: `已按项目 ID 关联 ${linkedContracts.length} 位达人合同`,
          status: linkedContracts.every((contract) => contract.signed) ? '已签署' : '待处理',
        }
      : detail[resource.kind],
    count: resource.kind === 'contract' && linkedContracts.length > 0
      ? linkedContracts.length
      : records[resource.kind].length,
  }));

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
          project={project}
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
    <div className="page-stack project-detail-page">
      <button className="project-back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        返回我的项目
      </button>

      <PageHeading
        title={project.name}
        subtitle={`${project.id} · ${project.brand}`}
        actions={<span className="project-detail-status"><i />{project.status}</span>}
      />

      <div className="metrics-grid project-detail-metrics">
        <article className="metric-card metric-peach"><span>品牌 / 客户</span><strong>{project.brand}</strong><small>{project.id}</small></article>
        <article className="metric-card"><span>项目预算</span><strong>{project.budget}</strong><small>共 {project.creators} 位达人</small></article>
        <article className="metric-card metric-lilac"><span>当前状态</span><strong>{project.status}</strong><small>负责 PM · {project.pm}</small></article>
      </div>

      <div className="project-detail-layout">
        <div className="project-detail-main">
          <section className="project-detail-card">
            <header className="project-detail-card-header">
              <div><h2>项目基础信息</h2><p>项目主体、负责人及付款背景。</p></div>
              <span>更新于 {detail.updatedAt}</span>
            </header>
            <dl className="project-info-grid">
              <div><dt>项目编号</dt><dd>{project.id}</dd></div>
              <div><dt>品牌 / 客户</dt><dd>{project.brand}</dd></div>
              <div><dt>项目媒介</dt><dd>{detail.media}</dd></div>
              <div><dt>负责 PM</dt><dd>{project.pm}</dd></div>
              <div><dt>创建时间</dt><dd>{detail.createdAt}</dd></div>
              <div className="project-info-full"><dt>付款事由</dt><dd>{detail.requestReason}</dd></div>
            </dl>
          </section>

          <section className="project-detail-card project-workflow-card">
            <header className="project-detail-card-header">
              <div><h2>合同、Invoice 与付款清单</h2><p>所有资料按 Engagement ID 关联并同步主模块。</p></div>
            </header>
            <ProjectResourceManager
              project={project}
              creators={creatorArchive}
              contracts={contracts}
              invoices={invoices}
              paymentLists={paymentLists}
              auditEvents={auditEvents}
              currentUser={currentUser}
              onOpenContract={(contractId) => onOpenContract?.(contractId)}
              onOpenInvoice={onOpenInvoice}
              onCreateInvoice={onCreateInvoice}
              onLinkContract={onLinkContract}
              onUnlinkContract={onUnlinkContract}
              onDeleteContract={onDeleteContract}
              onLinkInvoice={onLinkInvoice}
              onUnlinkInvoice={onUnlinkInvoice}
              onDeleteInvoice={onDeleteInvoice}
              onCreatePaymentList={onCreatePaymentList}
              onDeletePaymentList={onDeletePaymentList}
              onAddPaymentInvoice={onAddPaymentInvoice}
              onRemovePaymentInvoice={onRemovePaymentInvoice}
              onUpdatePaymentItem={onUpdatePaymentItem}
              onChangePaymentAccount={onChangePaymentAccount}
              onRevalidatePaymentItem={onRevalidatePaymentItem}
              onGeneratePaymentOrder={onGeneratePaymentOrder}
              onEditPaymentOrder={onEditPaymentOrder}
              onExportPaymentList={onExportPaymentList}
              onSubmitReview={onSubmitReview}
            />
          </section>

          <section className="project-detail-card">
            <header className="project-detail-card-header">
              <div><h2>达人名单</h2><p>展示当前项目中已关联的达人与交付状态。</p></div>
              {canEdit
                ? <button className="text-link" type="button" onClick={() => setCreatorManagerOpen(true)}>编辑全部 {project.creators} 位</button>
                : <span>共 {project.creators} 位</span>}
            </header>
            {detail.creators.length > 0 ? (
              <div className="table-scroll">
                <table className="data-table project-creator-table">
                  <thead><tr><th>达人</th><th>合作内容</th><th>交付状态</th></tr></thead>
                  <tbody>{detail.creators.map((creator) => <tr key={`${project.id}${creator.creatorId ?? creator.name}`}><td><CreatorIdentity creator={creator.creatorId ? creatorArchive.find((profile) => profile.id === creator.creatorId) : null} displayName={creator.name} fallbackPlatform={creator.platform} /></td><td>{creator.deliverable}</td><td><span className="simple-status"><i />{creator.status}</span></td></tr>)}</tbody>
                </table>
              </div>
            ) : (
              canEdit ? (
                <button className="project-detail-empty project-detail-empty-action" type="button" onClick={() => setCreatorManagerOpen(true)}>
                  <Users size={20} />
                  <span><strong>尚未添加达人</strong><small>点击从达人档案筛选项目达人</small></span>
                </button>
              ) : (
                <div className="project-detail-empty">
                  <Users size={20} />
                  <span><strong>尚未添加达人</strong><small>当前项目为只读状态</small></span>
                </div>
              )
            )}
          </section>
        </div>

        <aside className="project-detail-card project-progress-card">
          <header className="project-detail-card-header"><div><h2>请款进度</h2><p>项目资料、审核与打款状态。</p></div></header>
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
          project={project}
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
      {creatorManagerOpen && canEdit ? (
        <ProjectCreatorManagerModal
          project={project}
          creatorArchive={creatorArchive}
          onClose={() => setCreatorManagerOpen(false)}
          onSave={(creatorHandles) => {
            onUpdateCreators(creatorHandles);
            setCreatorManagerOpen(false);
            notify('达人名单已更新', `${project.name} 已关联 ${creatorHandles.length} 位达人，合同与 Invoice 数量已同步。`);
          }}
        />
      ) : null}
    </div>
  );
}
