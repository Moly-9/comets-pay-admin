import { allRecognitionFieldsConfirmed, normalizeDays, normalizeMoney } from './contractRecognition';
import type { ContractRecognitionField, ContractSourceDocument } from './contractRecognitionTypes';
import {
  createPrototypeId,
  type ContractId,
  type CreatorId,
  type EngagementId,
  type ProjectId,
} from './businessWorkflow';
import type { CreatorPaymentDetails } from './types';

export type ContractStatus =
  | '参考模板'
  | '待解析'
  | '待补字段'
  | '待回传'
  | '已生效'
  | '履约中'
  | '待签署'
  | '已归档';

export type ContractFeeBearer = 'ADVERTISER' | 'PUBLISHER' | 'SHARED' | '';
export type ContractPaymentMethod = 'BANK' | 'PAYPAL' | 'AIRWALLEX' | '';
export type ContractDocumentVariant = 'DRAFT' | 'FORMAL';

export type ContractTemplateFieldKey =
  | 'publisher'
  | 'publisherAddress'
  | 'channelUrl'
  | 'platform'
  | 'invoiceIssueWorkingDays'
  | 'payoutAccount'
  | 'feeBearer'
  | 'effectiveDate'
  | 'campaignPeriod'
  | 'projectName'
  | 'channelName'
  | 'purposeItems'
  | 'promotedProduct'
  | 'hashtag'
  | 'contentFormat'
  | 'releasePeriod'
  | 'language'
  | 'contentLength'
  | 'licensePeriod'
  | 'licensePrice'
  | 'totalFee'
  | 'paymentWorkingDays'
  | 'signature';

export type ContractQualityIssueKind =
  | 'REQUIRED_MISSING'
  | 'PLACEHOLDER_UNRESOLVED'
  | 'FORMAT_INVALID'
  | 'OVERFLOW_RISK'
  | 'CONTENT_CLIPPED'
  | 'CONTENT_OVERLAP'
  | 'SIGNATURE_INCOMPLETE';

export type ContractQualityIssue = {
  id: string;
  kind: ContractQualityIssueKind;
  severity: 'BLOCKER' | 'WARNING';
  fieldKey: ContractTemplateFieldKey;
  pageNumber: number;
  message: string;
};

export type ContractQualityReport = {
  completedFields: number;
  totalFields: number;
  missingRequired: number;
  overflowRisks: number;
  issues: ContractQualityIssue[];
  hasBlockers: boolean;
};

export type ContractFieldAnchor = {
  id: string;
  fieldKey: ContractTemplateFieldKey;
  pageNumber: number;
  x: number;
  top: number;
  width: number;
  height: number;
};

export type ContractGeneratedFiles = {
  variant: ContractDocumentVariant;
  pdfBlob: Blob;
  docxBlob: Blob;
  pageCount: number;
  anchors: ContractFieldAnchor[];
  qualityReport: ContractQualityReport;
};

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

export type ContractExtractionStage = 'parsing' | 'review' | 'confirmed' | 'applied';
export type ContractLifecycle =
  | 'GENERATED_DRAFT'
  | 'UPLOADED_PENDING_CONFIRMATION'
  | 'CONFIRMED';

export type ContractGenerationModel = {
  templateId: 'CON-TPL-2026-KOL';
  projectId: ProjectId;
  projectName: string;
  brandName: string;
  creatorId: CreatorId;
  creatorName: string;
  creatorHandle: string;
  engagementId: EngagementId;
  contractNumber: string;
  ioNumber: string;
  advertiser: string;
  publisher: string;
  publisherAddress: string;
  platform: string;
  channelName: string;
  channelUrl: string;
  effectiveDate: string;
  campaignStart: string;
  campaignEnd: string;
  purposeItems: string[];
  promotedProduct: string;
  hashtag: string;
  contentFormat: string;
  releaseStart: string;
  releaseEnd: string;
  language: string;
  contentLength: string;
  licensePeriod: string;
  licensePrice: string;
  currency: string;
  totalFee: string;
  invoiceIssueWorkingDays: number;
  paymentWorkingDays: 45 | 60;
  paymentMethod: ContractPaymentMethod;
  feeBearer: ContractFeeBearer;
  payoutAccountId: string;
  payoutProvider: 'Airwallex' | 'PayPal';
  paymentSnapshot: CreatorPaymentDetails;
};

export type ContractRecord = {
  contractId?: ContractId;
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
  projectId?: ProjectId | string;
  creatorId?: CreatorId;
  creatorHandle?: string;
  engagementId?: EngagementId;
  lifecycle?: ContractLifecycle;
  generationSnapshot?: ContractGenerationModel;
  generationVariant?: ContractDocumentVariant;
  qualityReport?: ContractQualityReport;
  generationVersion?: number;
  generatedFileBaseName?: string;
  uploadedFromDraftId?: ContractId;
  confirmedAt?: string;
  extractionStage?: ContractExtractionStage;
  recognitionResults?: ContractRecognitionField[];
  sourceDocuments?: ContractSourceDocument[];
  recognitionAppliedAt?: string;
};

export const formatContractMoney = (contract: ContractRecord) => {
  if (!contract.currency || contract.totalFee === null) return '待补充';
  return `${contract.currency} ${contract.totalFee.toLocaleString('en-US')}`;
};

export const getContractReadiness = (contract: ContractRecord) => {
  const blockers = contract.issues.filter((issue) => issue.severity === 'blocker');
  const lifecycleConfirmed = contract.lifecycle
    ? contract.lifecycle === 'CONFIRMED'
    : contract.signed;
  const ready = (
    lifecycleConfirmed
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
    label: ready
      ? '可用于付款项目'
      : contract.lifecycle === 'GENERATED_DRAFT'
        ? '待上传签署合同'
        : contract.status === '待解析'
          ? '等待解析'
          : `${blockers.length} 项待处理`,
  };
};

export const isConfirmedContract = (contract: ContractRecord) => (
  contract.lifecycle ? contract.lifecycle === 'CONFIRMED' : getContractReadiness(contract).ready
);

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
  systemContractNumber: string;
  projectId: ProjectId;
  projectName: string;
  customer: string;
  creatorId: CreatorId;
  creatorName: string;
  creatorHandle: string;
  creatorPlatform: string;
  engagementId: EngagementId;
  draftContractId?: ContractId;
  recognitionResults: ContractRecognitionField[];
  sourceDocuments: ContractSourceDocument[];
};

const blankFieldIssues = (model: ContractGenerationModel): ContractIssue[] => {
  const fields = [
    ['publisher', 'Publisher', model.publisher],
    ['campaign', 'Campaign Period', model.campaignStart && model.campaignEnd],
    ['purpose', 'Campaign Purpose', model.purposeItems.some(Boolean)],
    ['format', 'Content Format', model.contentFormat],
    ['amount', 'Project Total Fees', model.totalFee],
    ['currency', 'Currency', model.currency],
    ['payment-term', 'Payment Term', model.paymentWorkingDays],
    ['payment-method', 'Payment Method', model.paymentMethod],
    ['payout-account', 'Payout Account', model.payoutAccountId],
  ];
  return fields
    .filter(([, , value]) => !value)
    .map(([id, label]) => ({
      id: `draft-${id}`,
      label: `${label} 待补充`,
      description: '生成文件中保留空白填写区域，媒介可在线下补充后发起签署。',
      severity: 'review' as const,
      source: '合同生成草稿',
    }));
};

export const createGeneratedContractDraft = (
  model: ContractGenerationModel,
  version = 1,
  documentUrl = '',
  options: {
    existingContractId?: ContractId;
    generationVariant?: ContractDocumentVariant;
    qualityReport?: ContractQualityReport;
    pageCount?: number;
  } = {},
): ContractRecord => {
  const totalFee = model.totalFee.trim() ? Number(model.totalFee) : null;
  const licensePrice = model.licensePrice.trim() ? Number(model.licensePrice) : null;
  const rawAccount = model.payoutProvider === 'PayPal'
    ? model.paymentSnapshot.paypalEmail
    : model.paymentSnapshot.iban || model.paymentSnapshot.accountNumber;
  const accountName = model.payoutProvider === 'PayPal'
    ? model.paymentSnapshot.paypalUsername
    : model.paymentSnapshot.accountName;
  const accountFingerprint = rawAccount
    ? `•••• ${rawAccount.replace(/\s/g, '').slice(-4)}`
    : '';
  const fileBaseName = `${model.contractNumber || 'contract'}-${model.creatorHandle.replace(/^@/, '') || 'creator'}-v${version}`;
  return {
    contractId: options.existingContractId ?? createPrototypeId('contract') as ContractId,
    id: model.contractNumber,
    ioId: model.ioNumber || '待补充',
    name: `${model.projectName || '未命名项目'} · ${model.creatorName || '待补充达人'} 合同草稿`,
    templateFamily: '欧美单次商单合作模板 v1',
    sourceName: `${fileBaseName}.pdf`,
    documentUrl,
    documentNote: '合同由系统在浏览器本地生成，等待双方线下签署后回传。',
    pageCount: options.pageCount ?? 17,
    isTemplate: false,
    project: model.projectName,
    brand: model.brandName,
    advertiser: model.advertiser,
    publisher: model.publisher,
    channelName: model.channelName,
    channelLink: model.channelUrl,
    platform: model.platform,
    effectiveDate: model.effectiveDate,
    campaignStart: model.campaignStart,
    campaignEnd: model.campaignEnd,
    currency: model.currency,
    totalFee: Number.isFinite(totalFee) ? totalFee : null,
    licensePrice: Number.isFinite(licensePrice) ? licensePrice : null,
    licenseIncludedInTotal: model.licensePrice.trim() ? false : null,
    invoiceWithinWorkingDays: model.invoiceIssueWorkingDays,
    paymentWithinWorkingDays: model.paymentWorkingDays,
    feeBearer: model.feeBearer,
    paymentMethod: model.paymentMethod,
    accountName,
    accountFingerprint,
    signed: false,
    status: '待回传',
    updated: new Intl.DateTimeFormat('en-CA').format(new Date()),
    deliverables: [
      ...model.purposeItems,
      model.promotedProduct ? `Promoted product / campaign: ${model.promotedProduct}` : '',
      model.contentFormat ? `Format: ${model.contentFormat}` : '',
      model.contentLength ? `Length: ${model.contentLength}` : '',
    ]
      .map((value) => value.trim())
      .filter(Boolean)
      .map((description, index) => ({
        id: `generated-deliverable-${index + 1}`,
        title: `交付要求 ${index + 1}`,
        description,
        source: '合同生成表单',
      })),
    issues: blankFieldIssues(model),
    projectId: model.projectId,
    creatorId: model.creatorId,
    creatorHandle: model.creatorHandle,
    engagementId: model.engagementId,
    lifecycle: 'GENERATED_DRAFT',
    generationSnapshot: { ...model },
    generationVariant: options.generationVariant ?? 'DRAFT',
    qualityReport: options.qualityReport,
    generationVersion: version,
    generatedFileBaseName: fileBaseName,
  };
};

export const createUploadedContract = ({
  systemContractNumber,
  projectId,
  projectName,
  customer,
  creatorId,
  creatorHandle,
  engagementId,
  draftContractId,
  recognitionResults,
  sourceDocuments,
}: ContractUploadInput): ContractRecord => {
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());
  const primaryDocument = sourceDocuments[0];
  const displayName = primaryDocument?.fileName.replace(/\.(pdf|docx)$/i, '').trim();
  const parseWarnings = sourceDocuments
    .filter((document) => document.parseStatus !== 'parsed')
    .map((document) => `${document.fileName}：${document.errorMessage ?? '无法解析'}`);

  return {
    contractId: draftContractId ?? createPrototypeId('contract') as ContractId,
    id: systemContractNumber,
    ioId: '待确认',
    name: displayName || '新上传合同',
    templateFamily: '待识别',
    sourceName: primaryDocument?.fileName ?? '合同文件',
    documentUrl: primaryDocument?.documentUrl ?? '',
    documentNote: parseWarnings.join('；') || '识别结果保留原文来源，全部字段需逐项人工确认。',
    pageCount: primaryDocument?.pageCount ?? undefined,
    isTemplate: false,
    project: projectName,
    brand: customer || '待补充客户',
    advertiser: '',
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
    invoiceWithinWorkingDays: null,
    paymentWithinWorkingDays: null,
    feeBearer: '',
    paymentMethod: '',
    accountName: '',
    accountFingerprint: '',
    signed: false,
    status: '待补字段',
    updated: today,
    deliverables: [],
    issues: [
      {
        id: 'recognition-review',
        label: '合同识别结果待人工确认',
        description: '所有摘要及付款字段逐项确认后，才能写入正式合同资料。',
        severity: 'blocker',
        source: '本地合同识别',
      },
      {
        id: 'signature',
        label: '上传合同尚未确认',
        description: '请人工确认当前上传文件是线下完成后的最终合同版本，再用于 Invoice 校验。',
        severity: 'blocker',
        source: '回传文件',
      },
    ],
    projectId,
    creatorId,
    creatorHandle,
    engagementId,
    lifecycle: 'UPLOADED_PENDING_CONFIRMATION',
    uploadedFromDraftId: draftContractId,
    extractionStage: 'review',
    recognitionResults,
    sourceDocuments,
  };
};

export const completeGeneratedContractUpload = (
  draft: ContractRecord,
  input: ContractUploadInput,
): ContractRecord => {
  const uploaded = createUploadedContract({
    ...input,
    systemContractNumber: draft.id,
    draftContractId: draft.contractId,
  });
  return {
    ...uploaded,
    contractId: draft.contractId,
    id: draft.id,
    name: draft.name,
    generationSnapshot: draft.generationSnapshot,
    generationVariant: draft.generationVariant,
    qualityReport: draft.qualityReport,
    generationVersion: draft.generationVersion,
    generatedFileBaseName: draft.generatedFileBaseName,
    uploadedFromDraftId: draft.contractId,
  };
};

const confirmedField = (contract: ContractRecord, fieldKey: ContractRecognitionField['fieldKey']) => (
  contract.recognitionResults?.find((field) => field.fieldKey === fieldKey && field.status === 'confirmed')
);

const fieldText = (field: ContractRecognitionField | undefined) => (
  field?.editedValue?.trim() || field?.rawValue.trim() || ''
);

export const applyConfirmedRecognitionToContract = (contract: ContractRecord): ContractRecord | null => {
  const fields = contract.recognitionResults ?? [];
  if (!allRecognitionFieldsConfirmed(fields)) return null;

  const projectBrand = confirmedField(contract, 'projectBrand');
  const platformChannel = confirmedField(contract, 'platformChannel');
  const effectiveDate = confirmedField(contract, 'effectiveDate');
  const campaignPeriod = confirmedField(contract, 'campaignPeriod');
  const totalFees = confirmedField(contract, 'projectTotalFees');
  const invoicePeriod = confirmedField(contract, 'invoiceIssuePeriod');
  const paymentTerm = confirmedField(contract, 'paymentTerm');
  const paymentMethodField = confirmedField(contract, 'paymentMethod');
  const transferFeeField = confirmedField(contract, 'transferFee');
  const paymentMethod = typeof paymentMethodField?.normalizedValue === 'string'
    ? paymentMethodField.normalizedValue
    : fieldText(paymentMethodField);
  const transferFee = typeof transferFeeField?.normalizedValue === 'string'
    ? transferFeeField.normalizedValue
    : fieldText(transferFeeField);
  const beneficiary = fieldText(confirmedField(contract, 'beneficiaryAccount'));
  const objectValue = <T,>(field: ContractRecognitionField | undefined) => (
    typeof field?.normalizedValue === 'object' && field.normalizedValue
      ? field.normalizedValue as T
      : {} as T
  );
  const projectData = objectValue<{ projectName?: string; brandName?: string }>(projectBrand);
  const channelData = objectValue<{ platform?: string; channelName?: string; handle?: string; channelUrl?: string }>(platformChannel);
  const effectiveData = objectValue<{ date?: string }>(effectiveDate);
  const campaignData = objectValue<{ startDate?: string; endDate?: string }>(campaignPeriod);
  const moneyData = typeof totalFees?.normalizedValue === 'object' && totalFees.normalizedValue
    ? totalFees.normalizedValue as { amount?: number | null; currency?: string }
    : normalizeMoney(fieldText(totalFees));
  const invoiceData = objectValue<{ normalizedDays?: number | null }>(invoicePeriod);
  const paymentData = objectValue<{ normalizedDays?: number | null }>(paymentTerm);

  return {
    ...contract,
    advertiser: fieldText(confirmedField(contract, 'advertiser')),
    publisher: fieldText(confirmedField(contract, 'publisher')),
    ioId: fieldText(confirmedField(contract, 'ioNumber')) || '待补充',
    project: projectData.projectName || contract.project,
    brand: projectData.brandName || contract.brand,
    platform: channelData.platform ?? '',
    channelName: channelData.channelName || channelData.handle || '',
    channelLink: channelData.channelUrl ?? '',
    effectiveDate: effectiveData.date ?? '',
    campaignStart: campaignData.startDate ?? '',
    campaignEnd: campaignData.endDate ?? '',
    totalFee: moneyData.amount ?? null,
    currency: moneyData.currency ?? '',
    invoiceWithinWorkingDays: invoiceData.normalizedDays ?? normalizeDays(fieldText(invoicePeriod)),
    paymentWithinWorkingDays: paymentData.normalizedDays ?? normalizeDays(fieldText(paymentTerm)),
    paymentMethod: paymentMethod === 'AIRWALLEX'
      ? 'AIRWALLEX'
      : paymentMethod === 'PAYPAL'
        ? 'PAYPAL'
        : paymentMethod === 'BANK_TRANSFER' || /bank|银行|电汇/i.test(paymentMethod)
          ? 'BANK'
          : '',
    feeBearer: ['ADVERTISER', 'PUBLISHER', 'SHARED'].includes(transferFee)
      ? transferFee as ContractFeeBearer
      : '',
    accountName: beneficiary,
    accountFingerprint: beneficiary ? '合同识别快照' : '',
    extractionStage: 'applied',
    recognitionAppliedAt: new Date().toISOString(),
    lifecycle: 'CONFIRMED',
    confirmedAt: new Date().toISOString(),
    signed: true,
    status: '已归档',
    issues: contract.issues.filter((issue) => !['recognition-review', 'signature'].includes(issue.id)),
  };
};
