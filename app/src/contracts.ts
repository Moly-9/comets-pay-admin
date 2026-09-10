import { allRecognitionFieldsConfirmed, normalizeDays, normalizeMoney } from './contractRecognition';
import type { ContractRecognitionField, ContractSourceDocument } from './contractRecognitionTypes';
import {
  createPrototypeId,
  type CooperationProjectId,
  type ContractId,
  type CreatorId,
  type EngagementId,
  type ProjectId,
} from './businessWorkflow';
import type {
  DocumentPayoutSnapshot,
  PayoutAccountVersion,
} from './types';
import { demoAccountName, demoRealName } from './demoCreatorNames';
import { resolveContractTemplateOutput } from './contractTemplateFieldPolicies';

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

export type ContractRecognizedAccountSnapshot = {
  detectedChannel: 'BANK' | 'PAYPAL' | 'MIXED';
  accountName?: string;
  accountNumber?: string;
  beneficiaryBankName?: string;
  beneficiaryBankAddress?: string;
  swiftCode?: string;
  iban?: string;
  remittanceInformation?: string;
  paypalUsername?: string;
  paypalEmail?: string;
  transferNote?: string;
};

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

export type ContractPublishingChannel = {
  socialAccountId: string;
  platform: string;
  channelUrl: string;
};

export type ContractTemplateOutputFieldKey =
  | 'advertiser'
  | 'publisher'
  | 'channel'
  | 'campaignPeriod'
  | 'accountName'
  | 'accountNumber'
  | 'beneficiaryBankName'
  | 'beneficiaryBankAddress'
  | 'swiftCode'
  | 'iban'
  | 'remittanceInformation'
  | 'paypalUsername'
  | 'paypalEmailAddress'
  | 'transferNote';

export type ContractTemplateFieldMode = 'SYSTEM' | 'MANUAL' | 'OMIT';

export type ContractTemplateStatus = 'ACTIVE' | 'INACTIVE';

export type ContractTemplateFieldPolicyMap = Record<
  ContractTemplateOutputFieldKey,
  ContractTemplateFieldMode
>;

export type ContractTemplateManualFieldValueMap = {
  advertiser: string;
  publisher: string;
  channel: { publishingChannels: ContractPublishingChannel[] };
  campaignPeriod: { startDate: string; endDate: string };
  accountName: string;
  accountNumber: string;
  beneficiaryBankName: string;
  beneficiaryBankAddress: string;
  swiftCode: string;
  iban: string;
  remittanceInformation: string;
  paypalUsername: string;
  paypalEmailAddress: string;
  transferNote: string;
};

export type ContractExtractionStage = 'parsing' | 'review' | 'confirmed' | 'applied';
export type ContractLifecycle =
  | 'EDITING_DRAFT'
  | 'GENERATED_DRAFT'
  | 'UPLOADED_PENDING_CONFIRMATION'
  | 'RECOGNITION_CONFIRMED'
  | 'SENT_FOR_SIGNATURE'
  | 'CONFIRMED';

export type ContractManagementBucket =
  | 'template'
  | 'draft'
  | 'upload'
  | 'signature'
  | 'expired'
  | 'ready'
  | 'attention';

export type ContractType = 'INDEPENDENT' | 'FRAMEWORK' | 'IO';
export type ContractValidityStatus =
  | 'ACTIVE'
  | 'EXPIRING'
  | 'EXPIRING_URGENT'
  | 'EXPIRES_TODAY'
  | 'EXPIRED'
  | 'LONG_TERM'
  | 'UNSET';
export type ContractValidityFilter = 'all' | 'expiring' | 'expired' | 'long-term' | 'unset';

export type ContractProjectLink = {
  cooperationProjectId: CooperationProjectId;
  linkedAt?: string;
  status?: 'ACTIVE' | 'ENDED';
};

/** @deprecated Use ContractProjectLink and ContractRecord.projectLinks. */
export type FrameworkContractProjectLink = ContractProjectLink;

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  INDEPENDENT: '独立合同',
  FRAMEWORK: '框架合同',
  IO: 'IO 单',
};

export type ContractGenerationModel = {
  templateId: 'CON-TPL-2026-KOL';
  /** Frozen when the generation draft is created so later template edits do not alter history. */
  templateFieldPolicies?: ContractTemplateFieldPolicyMap;
  /** Frozen structural field list. Missing means every catalog field for legacy drafts. */
  templateOutputFieldKeys?: ContractTemplateOutputFieldKey[];
  /** Document-only values. These never update the creator's verified payout account. */
  templateManualFieldValues?: Partial<ContractTemplateManualFieldValueMap>;
  contractName: string;
  /** Optional for compatibility with older generated drafts. */
  contractType?: ContractType;
  projectId: ProjectId;
  cooperationProjectId?: CooperationProjectId;
  projectLinks?: ContractProjectLink[];
  projectName: string;
  brandName: string;
  creatorId: CreatorId;
  creatorName: string;
  creatorHandle: string;
  creatorSocialAccountId?: string;
  creatorPlatform?: string;
  engagementId: EngagementId;
  contractNumber: string;
  ioNumber: string;
  advertiser: string;
  publisher: string;
  publisherAddress: string;
  platform: string;
  channelName: string;
  channelUrl: string;
  publishingChannels: ContractPublishingChannel[];
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
  payoutAccountVersion?: PayoutAccountVersion;
  payoutAccountFingerprint?: string;
  payoutProvider: 'Airwallex' | 'PayPal';
  paymentSnapshot: DocumentPayoutSnapshot;
};

export type ContractRecord = {
  contractId?: ContractId;
  id: string;
  contractType?: ContractType;
  frameworkContractId?: ContractId;
  /** Active and historical cooperation-project coverage for every contract type. */
  projectLinks?: ContractProjectLink[];
  /** @deprecated Legacy framework-only project coverage. */
  frameworkProjectLinks?: FrameworkContractProjectLink[];
  ioId: string;
  name: string;
  templateFamily: string;
  sourceName: string;
  documentUrl: string;
  documentNote?: string;
  pageCount?: number;
  isTemplate: boolean;
  /** Missing means ACTIVE for backward compatibility with existing templates. */
  templateStatus?: ContractTemplateStatus;
  /** Template-level generation policy. Older templates are migrated through the default resolver. */
  templateFieldPolicies?: Partial<ContractTemplateFieldPolicyMap>;
  /** Structural field membership. Missing means every catalog field for older templates. */
  templateOutputFieldKeys?: ContractTemplateOutputFieldKey[];
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
  isLongTerm?: boolean;
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
  payoutAccountId?: string;
  payoutAccountVersion?: PayoutAccountVersion;
  payoutProvider?: 'Airwallex' | 'PayPal';
  payoutAccountFingerprint?: string;
  paymentSnapshot?: DocumentPayoutSnapshot;
  recognizedPaymentDetails?: ContractRecognizedAccountSnapshot;
  signed: boolean;
  /** @deprecated Historical snapshot only. New workflow uses lifecycle, readiness and validity. */
  status?: ContractStatus;
  updated: string;
  deliverables: ContractDeliverable[];
  issues: ContractIssue[];
  projectId?: ProjectId | string;
  cooperationProjectId?: CooperationProjectId;
  creatorId?: CreatorId;
  creatorHandle?: string;
  creatorSocialAccountId?: string;
  creatorPlatform?: string;
  engagementId?: EngagementId;
  lifecycle?: ContractLifecycle;
  generationSnapshot?: ContractGenerationModel;
  generationVariant?: ContractDocumentVariant;
  qualityReport?: ContractQualityReport;
  generationVersion?: number;
  generatedFileBaseName?: string;
  uploadedFromDraftId?: ContractId;
  uploadedByAccount?: string;
  sentForSignatureAt?: string;
  signedAt?: string;
  confirmedAt?: string;
  extractionStage?: ContractExtractionStage;
  recognitionResults?: ContractRecognitionField[];
  sourceDocuments?: ContractSourceDocument[];
  recognitionAppliedAt?: string;
};

export const formatContractMoney = (contract: ContractRecord) => {
  if (contract.contractType === 'FRAMEWORK') return '无固定金额';
  if (!contract.currency || contract.totalFee === null) return '待补充';
  return `${contract.currency} ${contract.totalFee.toLocaleString('en-US')}`;
};

export const getContractType = (contract: Pick<ContractRecord, 'contractType'>): ContractType => (
  contract.contractType ?? 'INDEPENDENT'
);

export const isFrameworkContract = (contract: Pick<ContractRecord, 'contractType'>) => (
  getContractType(contract) === 'FRAMEWORK'
);

export const contractProjectLinksFor = (
  contract: Pick<ContractRecord, 'cooperationProjectId' | 'projectId' | 'projectLinks' | 'frameworkProjectLinks'>,
) => {
  const linksByProject = new Map<CooperationProjectId, ContractProjectLink>();
  [...(contract.frameworkProjectLinks ?? []), ...(contract.projectLinks ?? [])]
    .forEach((link) => linksByProject.set(link.cooperationProjectId, { ...link }));
  return [...linksByProject.values()];
};

export const contractProjectIds = (
  contract: Pick<ContractRecord, 'cooperationProjectId' | 'projectId' | 'projectLinks' | 'frameworkProjectLinks'>,
) => {
  const explicitLinks = contractProjectLinksFor(contract);
  const linked = explicitLinks
    .filter((link) => link.status !== 'ENDED')
    .map((link) => link.cooperationProjectId);
  const hasExplicitLink = new Set(explicitLinks.map((link) => link.cooperationProjectId));
  const legacyProjectId = contract.cooperationProjectId ?? contract.projectId;
  return [...new Set([
    ...linked,
    ...(legacyProjectId && !hasExplicitLink.has(legacyProjectId as CooperationProjectId)
      ? [legacyProjectId as CooperationProjectId]
      : []),
  ])];
};

export const contractLinkedToProject = (
  contract: Pick<ContractRecord, 'cooperationProjectId' | 'projectId' | 'projectLinks' | 'frameworkProjectLinks'>,
  cooperationProjectId: CooperationProjectId | string,
) => contractProjectIds(contract).includes(cooperationProjectId as CooperationProjectId);

/** @deprecated Use contractProjectIds. */
export const frameworkContractProjectIds = contractProjectIds;

export const frameworkContractLinkedToProject = (
  contract: Pick<ContractRecord, 'cooperationProjectId' | 'projectId' | 'projectLinks' | 'frameworkProjectLinks'>,
  cooperationProjectId: CooperationProjectId | string,
) => contractLinkedToProject(contract, cooperationProjectId);

export const isIoContract = (contract: Pick<ContractRecord, 'contractType'>) => (
  getContractType(contract) === 'IO'
);

export const frameworkIoContracts = (
  framework: Pick<ContractRecord, 'contractId'>,
  contracts: ContractRecord[],
) => contracts.filter((contract) => (
  isIoContract(contract)
  && contract.frameworkContractId
  && contract.frameworkContractId === framework.contractId
));

export const getContractReadiness = (contract: ContractRecord) => {
  const nonSignatureIssues = contract.issues.filter((issue) => issue.id !== 'signature');
  const signatureConfirmed = contract.signed === true
    || (contract.signed == null && contract.lifecycle === 'CONFIRMED');
  const signaturePending = !contract.isTemplate && !signatureConfirmed;
  const blockers = nonSignatureIssues.filter((issue) => issue.severity === 'blocker');
  const blockerCount = blockers.length + (signaturePending ? 1 : 0);
  const lifecycleConfirmed = contract.lifecycle
    ? contract.lifecycle === 'CONFIRMED'
    : contract.signed;
  const contractType = getContractType(contract);
  const requiresFinancialFields = contractType !== 'FRAMEWORK';
  const parsing = contract.extractionStage === 'parsing';
  const ready = (
    lifecycleConfirmed
    && !contract.isTemplate
    && blockerCount === 0
    && Boolean(contract.publisher)
    && (!requiresFinancialFields || (
      Boolean(contract.currency)
      && contract.totalFee !== null
      && contract.paymentWithinWorkingDays !== null
      && Boolean(contract.paymentMethod)
      && Boolean(contract.feeBearer)
    ))
  );

  return {
    ready,
    blockerCount,
    reviewCount: nonSignatureIssues.length - blockers.length,
    label: ready
      ? '可用于付款项目'
      : contract.lifecycle === 'EDITING_DRAFT'
        ? '草稿未生成'
        : contract.lifecycle === 'GENERATED_DRAFT'
        ? '待上传合同文件'
        : contract.lifecycle === 'RECOGNITION_CONFIRMED'
          ? '待发送达人签署'
          : contract.lifecycle === 'SENT_FOR_SIGNATURE'
            ? '待达人签署'
        : parsing
          ? '等待解析'
          : `${blockerCount} 项待处理`,
  };
};

export const isConfirmedContract = (contract: ContractRecord) => (
  contract.lifecycle
    ? contract.lifecycle === 'CONFIRMED' && contract.signed !== false
    : contract.signed
);

export const isPaymentContract = (contract: ContractRecord) => (
  !contract.isTemplate && isConfirmedContract(contract)
);

const CONTRACT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const shanghaiDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const isoDateToDayNumber = (value?: string) => {
  if (typeof value !== 'string') return null;
  const match = CONTRACT_DATE_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null;
  return timestamp / MILLISECONDS_PER_DAY;
};

export const currentContractReferenceDate = () => {
  const parts = Object.fromEntries(
    shanghaiDateFormatter
      .formatToParts(new Date())
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const getContractValidity = (
  contract: Pick<ContractRecord, 'campaignEnd' | 'isLongTerm'>,
  referenceDate = currentContractReferenceDate(),
) => {
  if (contract.isLongTerm) {
    return {
      status: 'LONG_TERM' as const,
      endDate: '',
      daysRemaining: null,
      expired: false,
    };
  }

  const endDay = isoDateToDayNumber(contract.campaignEnd);
  const referenceDay = isoDateToDayNumber(referenceDate);
  if (endDay === null || referenceDay === null) {
    return {
      status: 'UNSET' as const,
      endDate: '',
      daysRemaining: null,
      expired: false,
    };
  }

  const daysRemaining = endDay - referenceDay;
  const status: ContractValidityStatus = daysRemaining < 0
    ? 'EXPIRED'
    : daysRemaining === 0
      ? 'EXPIRES_TODAY'
      : daysRemaining <= 7
        ? 'EXPIRING_URGENT'
        : daysRemaining <= 30
          ? 'EXPIRING'
          : 'ACTIVE';

  return {
    status,
    endDate: contract.campaignEnd,
    daysRemaining,
    expired: status === 'EXPIRED',
  };
};

export const contractMatchesValidityFilter = (
  contract: Pick<ContractRecord, 'campaignEnd' | 'isLongTerm'>,
  filter: ContractValidityFilter,
  referenceDate = currentContractReferenceDate(),
) => {
  if (filter === 'all') return true;
  const { status } = getContractValidity(contract, referenceDate);
  if (filter === 'expiring') {
    return status === 'EXPIRING' || status === 'EXPIRING_URGENT' || status === 'EXPIRES_TODAY';
  }
  if (filter === 'expired') return status === 'EXPIRED';
  if (filter === 'long-term') return status === 'LONG_TERM';
  return status === 'UNSET';
};

export const isContractAvailableForNewAssociation = (
  contract: ContractRecord,
  referenceDate = currentContractReferenceDate(),
) => isPaymentContract(contract) && !getContractValidity(contract, referenceDate).expired;

export const getContractManagementBucket = (
  contract: ContractRecord,
  referenceDate = currentContractReferenceDate(),
): ContractManagementBucket => {
  if (contract.isTemplate) return 'template';
  if (contract.lifecycle === 'EDITING_DRAFT') return 'draft';
  if (getContractValidity(contract, referenceDate).expired) return 'expired';
  if (contract.lifecycle === 'GENERATED_DRAFT') return 'upload';
  if (contract.lifecycle === 'SENT_FOR_SIGNATURE') return 'signature';
  return getContractReadiness(contract).ready ? 'ready' : 'attention';
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
    publisher: demoRealName('Léa Martin'),
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
    accountName: demoAccountName('Léa Martin'),
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
    templateStatus: 'ACTIVE',
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
    publisher: demoRealName('Mina Kato'),
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
    accountName: demoAccountName('Mina Kato'),
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
    publisher: demoRealName('Alejandro Ruiz'),
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
    accountName: demoAccountName('Alejandro Ruiz'),
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
    publisher: demoRealName('Kenji Mori'),
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
    accountName: demoAccountName('Kenji Mori'),
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
  contractName?: string;
  contractType?: ContractType;
  frameworkContractId?: ContractId;
  frameworkUploadKey?: string;
  projectId: ProjectId;
  cooperationProjectId?: CooperationProjectId;
  projectLinks?: ContractProjectLink[];
  projectName: string;
  customer: string;
  creatorId: CreatorId;
  creatorName: string;
  creatorHandle: string;
  creatorSocialAccountId?: string;
  creatorPlatform: string;
  engagementId?: EngagementId;
  draftContractId?: ContractId;
  recognitionResults: ContractRecognitionField[];
  sourceDocuments: ContractSourceDocument[];
};

const blankFieldIssues = (model: ContractGenerationModel): ContractIssue[] => {
  const fields = [
    ['creator', '合作达人', model.creatorId],
    ['project', '关联项目', model.projectId],
    ['publisher', 'Publisher', model.publisher],
    ['publisher-address', 'Publisher Address', model.publisherAddress],
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
    uploadedByAccount?: string;
  } = {},
): ContractRecord => {
  const documentModel = resolveContractTemplateOutput(model).effectiveModel;
  const totalFee = model.totalFee.trim() ? Number(model.totalFee) : null;
  const licensePrice = model.licensePrice.trim() ? Number(model.licensePrice) : null;
  const rawAccount = documentModel.payoutProvider === 'PayPal'
    ? documentModel.paymentSnapshot.paypalEmail
    : documentModel.paymentSnapshot.iban || documentModel.paymentSnapshot.accountNumber;
  const accountName = documentModel.payoutProvider === 'PayPal'
    ? documentModel.paymentSnapshot.paypalUsername
    : documentModel.paymentSnapshot.accountName;
  const accountFingerprint = documentModel.paymentSnapshot.accountFingerprint || (rawAccount
    ? `•••• ${rawAccount.replace(/\s/g, '').slice(-4)}`
    : '');
  const fileBaseName = `${model.contractNumber || 'contract'}-${model.creatorHandle.replace(/^@/, '') || 'creator'}-v${version}`;
  return {
    contractId: options.existingContractId ?? createPrototypeId('contract') as ContractId,
    id: model.contractNumber,
    contractType: model.contractType ?? 'INDEPENDENT',
    ioId: model.ioNumber || '待补充',
    name: model.contractName?.trim()
      || `${model.projectName || '未命名项目'} · ${model.creatorName || '待补充达人'} 合同草稿`,
    templateFamily: '欧美单次商单合作模板 v1',
    sourceName: `${fileBaseName}.pdf`,
    documentUrl,
    documentNote: '合同由系统在浏览器本地生成，请上传待发送达人的合同文件。',
    pageCount: options.pageCount ?? 17,
    isTemplate: false,
    project: model.projectName,
    brand: model.brandName,
    advertiser: documentModel.advertiser,
    publisher: documentModel.publisher,
    channelName: model.channelName,
    channelLink: documentModel.channelUrl,
    platform: documentModel.platform,
    effectiveDate: model.effectiveDate,
    campaignStart: documentModel.campaignStart,
    campaignEnd: documentModel.campaignEnd,
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
    payoutAccountId: model.payoutAccountId || undefined,
    payoutAccountVersion: model.payoutAccountVersion ?? documentModel.paymentSnapshot.payoutAccountVersion,
    payoutProvider: model.payoutAccountId ? model.payoutProvider : undefined,
    payoutAccountFingerprint: model.payoutAccountFingerprint ?? documentModel.paymentSnapshot.accountFingerprint,
    paymentSnapshot: { ...documentModel.paymentSnapshot },
    signed: false,
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
    issues: blankFieldIssues(documentModel),
    projectId: model.projectId,
    cooperationProjectId: model.cooperationProjectId ?? model.projectId,
    projectLinks: model.projectLinks?.length
      ? model.projectLinks.map((link) => ({ ...link }))
      : [{ cooperationProjectId: model.cooperationProjectId ?? model.projectId, status: 'ACTIVE' }],
    creatorId: model.creatorId,
    creatorHandle: model.creatorHandle,
    creatorSocialAccountId: model.creatorSocialAccountId,
    creatorPlatform: model.creatorPlatform ?? model.platform,
    engagementId: model.engagementId,
    lifecycle: 'GENERATED_DRAFT',
    generationSnapshot: {
      ...model,
      publishingChannels: model.publishingChannels.map((channel) => ({ ...channel })),
      paymentSnapshot: { ...model.paymentSnapshot },
      templateFieldPolicies: model.templateFieldPolicies ? { ...model.templateFieldPolicies } : undefined,
      templateOutputFieldKeys: model.templateOutputFieldKeys
        ? [...model.templateOutputFieldKeys]
        : undefined,
      templateManualFieldValues: model.templateManualFieldValues ? {
        ...model.templateManualFieldValues,
        channel: model.templateManualFieldValues.channel ? {
          publishingChannels: model.templateManualFieldValues.channel.publishingChannels.map((channel) => ({ ...channel })),
        } : undefined,
        campaignPeriod: model.templateManualFieldValues.campaignPeriod
          ? { ...model.templateManualFieldValues.campaignPeriod }
          : undefined,
      } : undefined,
    },
    generationVariant: options.generationVariant ?? 'DRAFT',
    qualityReport: options.qualityReport,
    generationVersion: version,
    generatedFileBaseName: fileBaseName,
    uploadedByAccount: options.uploadedByAccount,
  };
};

export const createEditingContractDraft = (
  model: ContractGenerationModel,
  existingDraft?: ContractRecord | null,
  uploadedByAccount?: string,
): ContractRecord => {
  const base = createGeneratedContractDraft(model, existingDraft?.generationVersion ?? 1, '', {
    existingContractId: existingDraft?.contractId,
    uploadedByAccount: uploadedByAccount ?? existingDraft?.uploadedByAccount,
  });
  return {
    ...base,
    id: existingDraft?.id ?? model.contractNumber,
    name: model.contractName.trim() || existingDraft?.name || '未命名合同草稿',
    sourceName: '合同文件尚未生成',
    documentUrl: '',
    documentNote: '生成中的合同表单草稿，可继续编辑后生成正式合同。',
    pageCount: undefined,
    lifecycle: 'EDITING_DRAFT',
    projectId: model.projectId || undefined,
    cooperationProjectId: model.cooperationProjectId || undefined,
    projectLinks: model.cooperationProjectId || model.projectId
      ? [{ cooperationProjectId: (model.cooperationProjectId ?? model.projectId) as CooperationProjectId, status: 'ACTIVE' }]
      : [],
    creatorId: model.creatorId || undefined,
    engagementId: model.engagementId || undefined,
    generationVariant: undefined,
    qualityReport: undefined,
    generatedFileBaseName: undefined,
    updated: new Intl.DateTimeFormat('en-CA').format(new Date()),
  };
};

export const createUploadedContract = (
  {
    systemContractNumber,
    contractName,
    contractType = 'INDEPENDENT',
    frameworkContractId,
    frameworkUploadKey,
    projectId,
    cooperationProjectId,
    projectLinks,
    projectName,
    customer,
    creatorId,
    creatorHandle,
    creatorSocialAccountId,
    creatorPlatform,
    engagementId,
    draftContractId,
    recognitionResults,
    sourceDocuments,
  }: ContractUploadInput,
  uploadedByAccount?: string,
): ContractRecord => {
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());
  const primaryDocument = sourceDocuments[0];
  const displayName = primaryDocument?.fileName.replace(/\.(pdf|docx)$/i, '').trim();
  const resolvedContractName = contractName?.trim() || displayName || '新上传合同';
  const parseWarnings = sourceDocuments
    .filter((document) => document.parseStatus !== 'parsed')
    .map((document) => `${document.fileName}：${document.errorMessage ?? '无法解析'}`);

  return {
    contractId: draftContractId ?? createPrototypeId('contract') as ContractId,
    id: systemContractNumber,
    contractType,
    frameworkContractId,
    ioId: '待确认',
    name: resolvedContractName,
    templateFamily: '待识别',
    sourceName: primaryDocument?.fileName ?? '合同文件',
    documentUrl: primaryDocument?.documentUrl ?? '',
    documentNote: [
      frameworkUploadKey && !frameworkContractId ? `待绑定本批次框架合同 ${frameworkUploadKey}` : '',
      parseWarnings.join('；'),
      '识别结果保留原文来源；系统合同编号自动确认，账户字段仅保存为合同识别快照。',
    ].filter(Boolean).join('；'),
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
    updated: today,
    deliverables: [],
    issues: [
      {
        id: 'recognition-review',
        label: '合同识别结果待人工确认',
        description: '主体、金额、签署状态、有效期及其他适用字段确认后，才能写入正式合同资料。',
        severity: 'blocker',
        source: '本地合同识别',
      },
      {
        id: 'signature',
        label: '合同尚未完成签署',
        description: '请先确认上传文件的识别信息，再发送给 C 端达人签署。',
        severity: 'blocker',
        source: '达人签署',
      },
    ],
    projectId,
    cooperationProjectId: cooperationProjectId ?? projectId,
    projectLinks: projectLinks?.length
      ? projectLinks.map((link) => ({ ...link }))
      : [{ cooperationProjectId: cooperationProjectId ?? projectId, status: 'ACTIVE' }],
    creatorId,
    creatorHandle,
    creatorSocialAccountId,
    creatorPlatform,
    engagementId,
    lifecycle: 'UPLOADED_PENDING_CONFIRMATION',
    uploadedFromDraftId: draftContractId,
    uploadedByAccount,
    extractionStage: 'review',
    recognitionResults,
    sourceDocuments,
  };
};

export const completeGeneratedContractUpload = (
  draft: ContractRecord,
  input: ContractUploadInput,
  uploadedByAccount?: string,
): ContractRecord => {
  const uploaded = createUploadedContract({
    ...input,
    systemContractNumber: draft.id,
    draftContractId: draft.contractId,
  }, uploadedByAccount ?? draft.uploadedByAccount);
  const generatedPaymentSnapshot = draft.paymentSnapshot
    ?? draft.generationSnapshot?.paymentSnapshot;
  return {
    ...uploaded,
    contractId: draft.contractId,
    id: draft.id,
    name: input.contractName?.trim() || draft.name,
    advertiser: draft.advertiser,
    publisher: draft.publisher,
    channelName: draft.channelName,
    channelLink: draft.channelLink,
    platform: draft.platform,
    effectiveDate: draft.effectiveDate,
    currency: draft.currency,
    totalFee: draft.totalFee,
    licensePrice: draft.licensePrice,
    licenseIncludedInTotal: draft.licenseIncludedInTotal,
    invoiceWithinWorkingDays: draft.invoiceWithinWorkingDays,
    paymentWithinWorkingDays: draft.paymentWithinWorkingDays,
    feeBearer: draft.feeBearer,
    paymentMethod: draft.paymentMethod,
    accountName: draft.accountName,
    accountFingerprint: draft.accountFingerprint,
    payoutAccountId: draft.payoutAccountId,
    payoutAccountVersion: draft.payoutAccountVersion,
    payoutProvider: draft.payoutProvider,
    payoutAccountFingerprint: draft.payoutAccountFingerprint,
    paymentSnapshot: generatedPaymentSnapshot
      ? { ...generatedPaymentSnapshot }
      : uploaded.paymentSnapshot,
    generationSnapshot: draft.generationSnapshot,
    generationVariant: draft.generationVariant,
    qualityReport: draft.qualityReport,
    generationVersion: draft.generationVersion,
    generatedFileBaseName: draft.generatedFileBaseName,
    uploadedFromDraftId: draft.contractId,
    projectLinks: draft.projectLinks ?? uploaded.projectLinks,
  };
};

const confirmedField = (contract: ContractRecord, fieldKey: ContractRecognitionField['fieldKey']) => (
  contract.recognitionResults?.find((field) => field.fieldKey === fieldKey && field.status === 'confirmed')
);

const fieldText = (field: ContractRecognitionField | undefined) => (
  field?.editedValue?.trim() || field?.rawValue.trim() || ''
);

export const applyConfirmedRecognitionToContract = (
  contract: ContractRecord,
  requiredFieldKeys?: readonly ContractRecognitionField['fieldKey'][],
): ContractRecord | null => {
  const fields = contract.recognitionResults ?? [];
  const fieldsToConfirm = requiredFieldKeys
    ? fields.filter((field) => requiredFieldKeys.includes(field.fieldKey))
    : fields;
  if (!allRecognitionFieldsConfirmed(fieldsToConfirm)) return null;
  const appliesField = (fieldKey: ContractRecognitionField['fieldKey']) => (
    !requiredFieldKeys || requiredFieldKeys.includes(fieldKey)
  );

  const projectBrand = confirmedField(contract, 'projectBrand');
  const platformChannel = confirmedField(contract, 'platformChannel');
  const effectiveDate = confirmedField(contract, 'effectiveDate');
  const campaignPeriod = confirmedField(contract, 'campaignPeriod');
  const contractExpiry = confirmedField(contract, 'contractExpiry');
  const signatureStatus = confirmedField(contract, 'signatureStatus');
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
  const expiryData = objectValue<{ endDate?: string; isLongTerm?: boolean }>(contractExpiry);
  const signatureData = objectValue<{ signed?: boolean; signedAt?: string }>(signatureStatus);
  const moneyData = typeof totalFees?.normalizedValue === 'object' && totalFees.normalizedValue
    ? totalFees.normalizedValue as { amount?: number | null; currency?: string }
    : normalizeMoney(fieldText(totalFees));
  const invoiceData = objectValue<{ normalizedDays?: number | null }>(invoicePeriod);
  const paymentData = objectValue<{ normalizedDays?: number | null }>(paymentTerm);
  const generatedPayment = contract.generationSnapshot;
  const fallbackCurrency = contract.currency || generatedPayment?.currency || '';
  const fallbackTotalFee = contract.totalFee ?? (
    generatedPayment?.totalFee.trim() ? Number(generatedPayment.totalFee) : null
  );
  const fallbackInvoiceDays = contract.invoiceWithinWorkingDays
    ?? generatedPayment?.invoiceIssueWorkingDays
    ?? null;
  const fallbackPaymentDays = contract.paymentWithinWorkingDays
    ?? generatedPayment?.paymentWorkingDays
    ?? null;
  const fallbackFeeBearer = contract.feeBearer || generatedPayment?.feeBearer || '';
  const fallbackPaymentMethod = contract.paymentMethod || generatedPayment?.paymentMethod || '';
  const fallbackAccountName = contract.accountName
    || generatedPayment?.paymentSnapshot.accountName
    || '';
  const recognizedBankDetails = {
    accountName: fieldText(confirmedField(contract, 'accountName')),
    accountNumber: fieldText(confirmedField(contract, 'accountNumber')),
    beneficiaryBankName: fieldText(confirmedField(contract, 'beneficiaryBankName')),
    beneficiaryBankAddress: fieldText(confirmedField(contract, 'beneficiaryBankAddress')),
    swiftCode: fieldText(confirmedField(contract, 'swiftCode')),
    iban: fieldText(confirmedField(contract, 'iban')),
    remittanceInformation: fieldText(confirmedField(contract, 'remittanceInformation')),
  };
  const recognizedPaypalDetails = {
    paypalUsername: fieldText(confirmedField(contract, 'paypalUsername')),
    paypalEmail: fieldText(confirmedField(contract, 'paypalEmail')),
    transferNote: fieldText(confirmedField(contract, 'transferNote')),
  };
  const hasRecognizedBankDetails = Object.values(recognizedBankDetails).some(Boolean);
  const hasRecognizedPaypalDetails = Object.values(recognizedPaypalDetails).some(Boolean);
  const recognizedPaymentDetails = hasRecognizedBankDetails || hasRecognizedPaypalDetails
    ? {
        detectedChannel: hasRecognizedBankDetails && hasRecognizedPaypalDetails
          ? 'MIXED' as const
          : hasRecognizedPaypalDetails
            ? 'PAYPAL' as const
            : 'BANK' as const,
        ...Object.fromEntries(Object.entries(recognizedBankDetails).filter(([, value]) => Boolean(value))),
        ...Object.fromEntries(Object.entries(recognizedPaypalDetails).filter(([, value]) => Boolean(value))),
      }
    : contract.recognizedPaymentDetails;
  const recognitionAppliedAt = new Date().toISOString();
  const signatureWasApplied = appliesField('signatureStatus') && Boolean(signatureStatus);
  const recognizedSigned = signatureWasApplied && signatureData.signed === true;

  return {
    ...contract,
    advertiser: appliesField('advertiser') ? fieldText(confirmedField(contract, 'advertiser')) : contract.advertiser,
    publisher: appliesField('publisher') ? fieldText(confirmedField(contract, 'publisher')) : contract.publisher,
    ioId: appliesField('ioNumber') ? fieldText(confirmedField(contract, 'ioNumber')) || '待补充' : contract.ioId,
    project: appliesField('projectBrand') ? projectData.projectName || contract.project : contract.project,
    brand: appliesField('projectBrand') ? projectData.brandName || contract.brand : contract.brand,
    platform: appliesField('platformChannel') ? channelData.platform ?? '' : contract.platform,
    channelName: appliesField('platformChannel') ? channelData.channelName || channelData.handle || '' : contract.channelName,
    channelLink: appliesField('platformChannel') ? channelData.channelUrl ?? '' : contract.channelLink,
    effectiveDate: appliesField('effectiveDate') ? effectiveData.date ?? '' : contract.effectiveDate,
    campaignStart: appliesField('campaignPeriod') ? campaignData.startDate ?? '' : contract.campaignStart,
    campaignEnd: appliesField('contractExpiry')
      ? expiryData.endDate ?? ''
      : appliesField('campaignPeriod')
        ? campaignData.endDate ?? ''
        : contract.campaignEnd,
    isLongTerm: appliesField('contractExpiry')
      ? Boolean(expiryData.isLongTerm)
      : contract.isLongTerm,
    totalFee: appliesField('projectTotalFees') ? moneyData.amount ?? fallbackTotalFee : contract.totalFee,
    currency: appliesField('projectTotalFees') ? moneyData.currency || fallbackCurrency : contract.currency,
    invoiceWithinWorkingDays: appliesField('invoiceIssuePeriod') ? invoiceData.normalizedDays ?? normalizeDays(fieldText(invoicePeriod)) ?? fallbackInvoiceDays : contract.invoiceWithinWorkingDays,
    paymentWithinWorkingDays: appliesField('paymentTerm') ? paymentData.normalizedDays ?? normalizeDays(fieldText(paymentTerm)) ?? fallbackPaymentDays : contract.paymentWithinWorkingDays,
    paymentMethod: appliesField('paymentMethod') ? paymentMethod === 'AIRWALLEX'
      ? 'AIRWALLEX'
      : paymentMethod === 'PAYPAL'
        ? 'PAYPAL'
        : paymentMethod === 'BANK_TRANSFER' || /bank|银行|电汇/i.test(paymentMethod)
          ? 'BANK'
          : fallbackPaymentMethod : contract.paymentMethod,
    feeBearer: appliesField('transferFee') && ['ADVERTISER', 'PUBLISHER', 'SHARED'].includes(transferFee)
      ? transferFee as ContractFeeBearer
      : appliesField('transferFee') ? fallbackFeeBearer : contract.feeBearer,
    accountName: appliesField('beneficiaryAccount') ? beneficiary || fallbackAccountName : contract.accountName,
    accountFingerprint: appliesField('beneficiaryAccount') && beneficiary ? '合同识别快照' : contract.accountFingerprint,
    recognizedPaymentDetails,
    extractionStage: 'applied',
    recognitionAppliedAt,
    lifecycle: recognizedSigned ? 'CONFIRMED' : 'RECOGNITION_CONFIRMED',
    confirmedAt: recognizedSigned ? recognitionAppliedAt : undefined,
    signedAt: recognizedSigned ? signatureData.signedAt : undefined,
    signed: recognizedSigned,
    status: undefined,
    issues: contract.issues
      .filter((issue) => issue.id !== 'recognition-review' && (!recognizedSigned || issue.id !== 'signature'))
      .map((issue) => issue.id === 'signature'
        ? {
            ...issue,
            label: '合同待发送达人签署',
            description: '结构化信息已确认，发送给 C 端达人后等待签署完成。',
            source: '达人签署',
          }
        : issue),
  };
};

export const sendContractForSignature = (
  contract: ContractRecord,
  occurredAt = new Date().toISOString(),
): ContractRecord | null => {
  if (
    contract.lifecycle !== 'RECOGNITION_CONFIRMED'
    || contract.extractionStage !== 'applied'
    || contract.signed
  ) return null;
  return {
    ...contract,
    lifecycle: 'SENT_FOR_SIGNATURE',
    sentForSignatureAt: occurredAt,
    signed: false,
    updated: occurredAt.slice(0, 10),
    issues: contract.issues.map((issue) => issue.id === 'signature'
      ? {
          ...issue,
          label: '等待达人签署',
          description: '合同已发送给 C 端达人，完成签署前不能参与付款流程。',
          source: '达人签署',
        }
      : issue),
  };
};

export const completeContractSignature = (
  contract: ContractRecord,
  occurredAt = new Date().toISOString(),
): ContractRecord | null => {
  if (contract.lifecycle !== 'SENT_FOR_SIGNATURE' || contract.signed) return null;
  return {
    ...contract,
    lifecycle: 'CONFIRMED',
    signed: true,
    signedAt: occurredAt,
    confirmedAt: occurredAt,
    updated: occurredAt.slice(0, 10),
    issues: contract.issues.filter((issue) => issue.id !== 'signature'),
  };
};
