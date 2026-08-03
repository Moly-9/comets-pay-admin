export type ContractStatus =
  | '参考模板'
  | '待解析'
  | '待补字段'
  | '已生效'
  | '履约中'
  | '待签署'
  | '已归档';

export type ContractFeeBearer = 'ADVERTISER' | 'PUBLISHER' | 'SHARED' | '';
export type ContractPaymentMethod = 'BANK' | 'PAYPAL' | '';

export type ContractIssue = {
  id: string;
  label: string;
  description: string;
  severity: 'blocker' | 'review';
  source: string;
};

export type ContractDeliverable = {
  id: string;
  title: string;
  description: string;
  source: string;
};

export type ContractExtractionStage = 'parsing' | 'review' | 'confirmed';

export type ContractFieldReview = {
  key: string;
  label: string;
  value: string;
  source: string;
  required: boolean;
};

export type ContractRecord = {
  id: string;
  ioId: string;
  name: string;
  templateFamily: string;
  sourceName: string;
  documentUrl: string;
  documentNote?: string;
  pageCount?: number;
  isTemplate: boolean;
  project: string;
  brand: string;
  advertiser: string;
  publisher: string;
  channelName: string;
  channelLink: string;
  platform: string;
  effectiveDate: string;
  campaignStart: string;
  campaignEnd: string;
  currency: string;
  totalFee: number | null;
  licensePrice: number | null;
  licenseIncludedInTotal: boolean | null;
  invoiceWithinWorkingDays: number | null;
  paymentWithinWorkingDays: number | null;
  feeBearer: ContractFeeBearer;
  paymentMethod: ContractPaymentMethod;
  accountName: string;
  accountFingerprint: string;
  signed: boolean;
  status: ContractStatus;
  updated: string;
  deliverables: ContractDeliverable[];
  issues: ContractIssue[];
  projectId?: string;
  creatorId?: string;
  creatorHandle?: string;
  engagementId?: string;
  extractionStage?: ContractExtractionStage;
  extractedFields?: ContractFieldReview[];
};

export const formatContractMoney = (contract: ContractRecord) => {
  if (!contract.currency || contract.totalFee === null) return '待补充';
  return `${contract.currency} ${contract.totalFee.toLocaleString('en-US')}`;
};

export const getContractReadiness = (contract: ContractRecord) => {
  const blockers = contract.issues.filter((issue) => issue.severity === 'blocker');
  const ready = (
    contract.signed
    && !contract.isTemplate
    && blockers.length === 0
    && Boolean(contract.publisher)
    && Boolean(contract.currency)
    && contract.totalFee !== null
    && contract.paymentWithinWorkingDays !== null
    && Boolean(contract.paymentMethod)
    && Boolean(contract.feeBearer)
  );

  return {
    ready,
    blockerCount: blockers.length,
    reviewCount: contract.issues.length - blockers.length,
    label: ready ? '可用于付款项目' : contract.status === '待解析' ? '等待解析' : `${blockers.length} 项待处理`,
  };
};

const TEMPLATE_DOCUMENT_URL = '/contracts/26-kol-standard-terms-template.pdf';

export const INITIAL_CONTRACTS: ContractRecord[] = [
  {
    id: 'CON-260724-KOL-01',
    ioId: 'IO-260724-NQ-FR',
    name: 'Nebula Quest 法国 KOL 推广服务合同',
    templateFamily: '2026 KOL 社交媒体推广服务合同',
    sourceName: 'Nebula_Quest_FR_KOL_Agreement.pdf',
    documentUrl: TEMPLATE_DOCUMENT_URL,
    documentNote: '当前原型使用用户提供的合同模板展示原文；右侧为同模板已填写合同的示例解析结果。',
    pageCount: 16,
    isTemplate: false,
    project: 'Nebula Quest 法国市场推广',
    brand: 'Nebula Quest',
    advertiser: 'Comets International Limited',
    publisher: 'Léa Martin',
    channelName: 'LeaPlay FR',
    channelLink: 'https://www.youtube.com/@LeaPlayFR',
    platform: 'YouTube',
    effectiveDate: '2026-07-24',
    campaignStart: '2026-08-01',
    campaignEnd: '2026-08-31',
    currency: 'EUR',
    totalFee: 8500,
    licensePrice: 1500,
    licenseIncludedInTotal: true,
    invoiceWithinWorkingDays: 3,
    paymentWithinWorkingDays: 45,
    feeBearer: 'ADVERTISER',
    paymentMethod: 'BANK',
    accountName: 'Léa Martin',
    accountFingerprint: '•••• 0001',
    signed: true,
    status: '已生效',
    updated: '2026-07-24',
    deliverables: [
      {
        id: 'DEL-01',
        title: '脚本初稿',
        description: '正式制作前提交视频脚本和初始创意，等待品牌确认。',
        source: 'IO · 第13页',
      },
      {
        id: 'DEL-02',
        title: 'YouTube Dedicated Video',
        description: '发布一条法语横版独立视频，包含游戏名称、CTA、跟踪链接及指定Hashtag。',
        source: 'IO · 第14页',
      },
      {
        id: 'DEL-03',
        title: '内容保留与授权',
        description: '视频至少保留一年；License费用已包含在项目总费用内。',
        source: 'IO · 第14–15页',
      },
    ],
    issues: [],
  },
  {
    id: 'CON-TPL-2026-KOL',
    ioId: '待填写',
    name: '社交媒体推广服务标准合同（2026 KOL 模板）',
    templateFamily: '2026 KOL 社交媒体推广服务合同',
    sourceName: '【26年-KOL】Standard Terms And Conditions For Social Media Promotion Services (TEMPLATE).pdf',
    documentUrl: TEMPLATE_DOCUMENT_URL,
    pageCount: 16,
    isTemplate: true,
    project: '待关联',
    brand: 'Comets International Limited',
    advertiser: 'Comets International Limited',
    publisher: '',
    channelName: '',
    channelLink: '',
    platform: '',
    effectiveDate: '',
    campaignStart: '',
    campaignEnd: '',
    currency: '',
    totalFee: null,
    licensePrice: null,
    licenseIncludedInTotal: null,
    invoiceWithinWorkingDays: 3,
    paymentWithinWorkingDays: null,
    feeBearer: '',
    paymentMethod: '',
    accountName: '',
    accountFingerprint: '',
    signed: false,
    status: '参考模板',
    updated: '2026-07-24',
    deliverables: [
      {
        id: 'TPL-DEL-01',
        title: '视频/直播交付要求',
        description: '模板支持脚本、独立或植入视频、直播分析截图、CTA、Tracklink及Hashtag。',
        source: 'IO · 第13–14页',
      },
    ],
    issues: [
      { id: 'publisher', label: 'Publisher未填写', description: '需要填写真实姓名或公司法定名称。', severity: 'blocker', source: 'Standard Terms · 第1页' },
      { id: 'currency', label: '项目币种缺失', description: 'Project Total Fees没有币种，无法与Invoice匹配。', severity: 'blocker', source: 'IO · 第14页' },
      { id: 'amount', label: '项目总费用缺失', description: 'Project Total Fees仍为模板占位符。', severity: 'blocker', source: 'IO · 第14页' },
      { id: 'days', label: '付款期限未确定', description: '模板仍保留[60/45] working days二选一。', severity: 'blocker', source: 'IO · 第15页' },
      { id: 'fee', label: '转账费用承担未选择', description: '双方共同、Advertiser或Publisher承担尚未选择。', severity: 'blocker', source: 'Standard Terms · 第5页' },
      { id: 'method', label: '付款方式未选择', description: '银行转账与PayPal之间尚未选择。', severity: 'blocker', source: 'Standard Terms · 第4–5页' },
      { id: 'billing', label: 'Bill To地址缺失', description: '正文引用IO中的billing address，但模板IO没有独立字段。', severity: 'review', source: 'Standard Terms · 第4页' },
    ],
  },
  {
    id: 'CON-260718-01',
    ioId: 'IO-260718-SB-01',
    name: '夏日直播计划合作合同',
    templateFamily: '品牌直播合作合同',
    sourceName: 'Solara_Summer_Live_Agreement.pdf',
    documentUrl: '',
    isTemplate: false,
    project: '夏日直播计划',
    brand: 'Solara Beauty',
    advertiser: 'Solara Beauty Limited',
    publisher: 'Mina Kato',
    channelName: '@MinaKato',
    channelLink: 'https://www.youtube.com/@MinaKato',
    platform: 'YouTube',
    effectiveDate: '2026-07-18',
    campaignStart: '2026-07-20',
    campaignEnd: '2026-08-20',
    currency: 'USD',
    totalFee: 32000,
    licensePrice: null,
    licenseIncludedInTotal: true,
    invoiceWithinWorkingDays: 3,
    paymentWithinWorkingDays: 45,
    feeBearer: 'ADVERTISER',
    paymentMethod: 'BANK',
    accountName: 'Mina Kato',
    accountFingerprint: '•••• 0002',
    signed: true,
    status: '履约中',
    updated: '2026-07-18',
    deliverables: [],
    issues: [],
  },
  {
    id: 'CON-260714-03',
    ioId: 'IO-260714-NL-03',
    name: '新品开箱达人推广合同',
    templateFamily: 'KOL推广服务合同',
    sourceName: 'Nova_Lab_Unboxing_Agreement.pdf',
    documentUrl: '',
    isTemplate: false,
    project: '新品开箱',
    brand: 'Nova Lab',
    advertiser: 'Nova Lab GmbH',
    publisher: 'Alex Ruiz',
    channelName: 'Alex Reviews',
    channelLink: '',
    platform: 'Instagram',
    effectiveDate: '',
    campaignStart: '2026-07-18',
    campaignEnd: '2026-08-05',
    currency: 'EUR',
    totalFee: 18500,
    licensePrice: null,
    licenseIncludedInTotal: null,
    invoiceWithinWorkingDays: 3,
    paymentWithinWorkingDays: 45,
    feeBearer: 'ADVERTISER',
    paymentMethod: 'BANK',
    accountName: 'Alex Ruiz',
    accountFingerprint: '•••• 0003',
    signed: false,
    status: '待签署',
    updated: '2026-07-16',
    deliverables: [],
    issues: [
      { id: 'signature', label: '合同尚未完成签署', description: '双方签署完成后才能进入付款项目。', severity: 'blocker', source: '签署页' },
    ],
  },
  {
    id: 'CON-260625-06',
    ioId: 'IO-260625-AM-06',
    name: '日本市场测评服务合同',
    templateFamily: 'KOL推广服务合同',
    sourceName: 'Aster_Mobile_JP_Review_Agreement.pdf',
    documentUrl: '',
    isTemplate: false,
    project: '日本市场测评',
    brand: 'Aster Mobile',
    advertiser: 'Aster Mobile Pte. Ltd.',
    publisher: 'Kenji Mori',
    channelName: 'Kenji Tech',
    channelLink: '',
    platform: 'YouTube',
    effectiveDate: '2026-06-25',
    campaignStart: '2026-06-25',
    campaignEnd: '2026-07-10',
    currency: 'USD',
    totalFee: 41200,
    licensePrice: null,
    licenseIncludedInTotal: true,
    invoiceWithinWorkingDays: 3,
    paymentWithinWorkingDays: 45,
    feeBearer: 'ADVERTISER',
    paymentMethod: 'BANK',
    accountName: 'Kenji Mori',
    accountFingerprint: '•••• 0004',
    signed: true,
    status: '已归档',
    updated: '2026-06-28',
    deliverables: [],
    issues: [],
  },
];

export type ContractUploadInput = {
  file: File;
  documentUrl: string;
  projectId: string;
  projectName: string;
  customer: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  creatorPlatform: string;
  engagementId: string;
  fields: ContractFieldReview[];
  parseNote?: string;
};

const fieldValue = (fields: ContractFieldReview[], key: string) => (
  fields.find((field) => field.key === key)?.value.trim() ?? ''
);

export const createUploadedContract = ({
  file,
  documentUrl,
  projectId,
  projectName,
  customer,
  creatorId,
  creatorName,
  creatorHandle,
  creatorPlatform,
  engagementId,
  fields,
  parseNote,
}: ContractUploadInput): ContractRecord => {
  const timestamp = Date.now().toString().slice(-7);
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());
  const displayName = file.name.replace(/\.(pdf|docx?|doc)$/i, '').trim();
  const amountValue = fieldValue(fields, 'totalFee').replace(/,/g, '');
  const amount = Number(amountValue.match(/\d+(?:\.\d+)?/)?.[0] ?? '');
  const currency = fieldValue(fields, 'currency').toUpperCase();
  const missingFields = fields.filter((field) => field.required && !field.value.trim());

  return {
    id: `CON-UPL-${timestamp}`,
    ioId: '待解析',
    name: displayName || '新上传合同',
    templateFamily: '待识别',
    sourceName: file.name,
    documentUrl,
    documentNote: parseNote,
    isTemplate: false,
    project: projectName,
    brand: customer || '待补充客户',
    advertiser: fieldValue(fields, 'advertiser') || '待识别',
    publisher: fieldValue(fields, 'publisher') || creatorName,
    channelName: '',
    channelLink: '',
    platform: creatorPlatform,
    effectiveDate: '',
    campaignStart: '',
    campaignEnd: '',
    currency,
    totalFee: Number.isFinite(amount) && amount > 0 ? amount : null,
    licensePrice: null,
    licenseIncludedInTotal: null,
    invoiceWithinWorkingDays: null,
    paymentWithinWorkingDays: null,
    feeBearer: '',
    paymentMethod: '',
    accountName: '',
    accountFingerprint: '',
    signed: false,
    status: missingFields.length ? '待补字段' : '待签署',
    updated: today,
    deliverables: [],
    issues: [
      {
        id: 'signature',
        label: '合同尚未完成签署',
        description: '字段复核不代表合同签署；双方签署完成后才能进入付款项目。',
        severity: 'blocker',
        source: '签署页',
      },
      ...missingFields.map((field) => ({
        id: `missing-${field.key}`,
        label: `${field.label}缺失`,
        description: '本地解析未识别该关键字段，需要人工补充后确认。',
        severity: 'blocker' as const,
        source: field.source || '上传文件',
      })),
    ],
    projectId,
    creatorId,
    creatorHandle,
    engagementId,
    extractionStage: 'review',
    extractedFields: fields,
  };
};
