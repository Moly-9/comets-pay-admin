import { allRecognitionFieldsConfirmed, normalizeDays, normalizeMoney } from './contractRecognition';
import {
  asCollaborationId,
  asContractId,
  asContractIoId,
  asCreatorId,
  asProjectId,
  type StructuredContract,
  type StructuredContractIo,
} from './contractDomain';
import type {
  ContractRecognitionField,
  ContractRecognitionResult,
  ContractSourceDocument,
} from './contractRecognitionTypes';

export type ContractStatus =
  | '参考模板'
  | '待解析'
  | '待补字段'
  | '已生效'
  | '履约中'
  | '待签署'
  | '已归档';

export type ContractFeeBearer = 'ADVERTISER' | 'PUBLISHER' | 'SHARED' | '';
export type ContractPaymentMethod = 'BANK' | 'PAYPAL' | 'AIRWALLEX' | '';

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
  recognitionResults?: ContractRecognitionField[];
  recognitionResult?: ContractRecognitionResult;
  sourceDocuments?: ContractSourceDocument[];
  recognitionAppliedAt?: string;
  structuredContract?: StructuredContract;
  contractIOs?: StructuredContractIo[];
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
    extractionStage: 'applied',
    structuredContract: {
      contract_id: asContractId('019a1f40-2000-7000-8000-000000000101'),
      contract_code: 'CON-260718-01',
      project_id: asProjectId('PRJ-260727-03'),
      collaboration_id: asCollaborationId('collaboration-pay-001'),
      creator_id: asCreatorId('creator-mina'),
      advertiser: 'Solara Beauty Limited',
      publisher: 'Mina Kato',
      effective_date: '2026-07-18',
      signature_status: 'SIGNED',
      advertiser_signature_date: '2026-07-18',
      publisher_signature_date: '2026-07-18',
      payment_rules: {
        invoice_issue_period: null,
        payment_term: null,
        payment_method: null,
        transfer_fee_bearer: null,
      },
      payout_account_snapshot: {
        beneficiary_account_name: 'Mina Kato',
        bank_name: 'MUFG Bank',
        account_number_last4: '0002',
        swift_code: '',
        iban_last4: '',
        paypal_username: '',
        paypal_email: '',
        remittance_information: '',
        status: 'CONFIRMED',
      },
    },
    contractIOs: [{
      contract_io_id: asContractIoId('019a1f40-2000-7000-8000-000000000201'),
      io_number: 'IO-260718-SB-01',
      contract_id: asContractId('019a1f40-2000-7000-8000-000000000101'),
      project_id: asProjectId('PRJ-260727-03'),
      collaboration_id: asCollaborationId('collaboration-pay-001'),
      creator_id: asCreatorId('creator-mina'),
      project_name: '夏日直播计划',
      brand_name: 'Solara Beauty',
      campaign_start: '2026-07-20',
      campaign_end: '2026-08-20',
      platform: 'YouTube',
      channel_name: '@MinaKato',
      channel_url: 'https://www.youtube.com/@MinaKato',
      project_total_fee: 32000,
      currency: 'USD',
      deliverables: [],
      obligations: [],
    }],
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
  contractId: string;
  contractIoId: string;
  systemContractNumber: string;
  systemIoNumber: string;
  projectId: string;
  projectName: string;
  customer: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  creatorPlatform: string;
  engagementId: string;
  recognitionResults: ContractRecognitionField[];
  recognitionResult: ContractRecognitionResult;
  sourceDocuments: ContractSourceDocument[];
};

const PROTOTYPE_CONTRACT_IDENTITIES = [
  ['019a1f40-1000-7000-8000-000000000101', '019a1f40-1000-7000-8000-000000000201', 'CON-LOCAL-001', 'IO-LOCAL-001'],
  ['019a1f40-1000-7000-8000-000000000102', '019a1f40-1000-7000-8000-000000000202', 'CON-LOCAL-002', 'IO-LOCAL-002'],
  ['019a1f40-1000-7000-8000-000000000103', '019a1f40-1000-7000-8000-000000000203', 'CON-LOCAL-003', 'IO-LOCAL-003'],
  ['019a1f40-1000-7000-8000-000000000104', '019a1f40-1000-7000-8000-000000000204', 'CON-LOCAL-004', 'IO-LOCAL-004'],
] as const;

export const allocatePrototypeContractIdentity = (contracts: ContractRecord[]) => {
  const usedIds = new Set(contracts.map((contract) => contract.structuredContract?.contract_id).filter(Boolean));
  const selected = PROTOTYPE_CONTRACT_IDENTITIES.find(([contractId]) => !usedIds.has(asContractId(contractId)))
    ?? PROTOTYPE_CONTRACT_IDENTITIES[PROTOTYPE_CONTRACT_IDENTITIES.length - 1];
  return {
    contractId: selected[0],
    contractIoId: selected[1],
    contractCode: selected[2],
    ioNumber: selected[3],
  };
};

const recognitionField = (
  fields: ContractRecognitionField[],
  fieldKey: ContractRecognitionField['fieldKey'],
) => fields.find((field) => field.fieldKey === fieldKey);

const recognizedText = (fields: ContractRecognitionField[], fieldKey: ContractRecognitionField['fieldKey']) => {
  const field = recognitionField(fields, fieldKey);
  return field?.editedValue?.trim() || field?.rawValue.trim() || '';
};

const recognizedObject = <T,>(
  fields: ContractRecognitionField[],
  fieldKey: ContractRecognitionField['fieldKey'],
) => {
  const value = recognitionField(fields, fieldKey)?.normalizedValue;
  return value && typeof value === 'object' ? value as T : {} as T;
};

const buildStructuredEntities = (input: ContractUploadInput) => {
  const fields = input.recognitionResults;
  const campaign = recognizedObject<{ startDate?: string; endDate?: string }>(fields, 'campaignPeriod');
  const total = recognizedObject<{ amount?: number | null; currency?: string }>(fields, 'projectTotalFees');
  const signatureStatus = recognitionField(fields, 'signatureStatus')?.normalizedValue;
  const accountStatuses = [
    'beneficiaryAccountName', 'bankName', 'accountNumberLast4', 'swiftCode', 'ibanLast4',
    'paypalUsername', 'paypalEmail', 'remittanceInformation',
  ].map((key) => recognitionField(fields, key as ContractRecognitionField['fieldKey'])?.status);
  const payoutStatus = accountStatuses.includes('CONFLICT')
    ? 'CONFLICT'
    : accountStatuses.some((status) => status === 'DETECTED' || status === 'CONFIRMED')
      ? 'DETECTED'
      : 'MISSING';
  const structuredContract: StructuredContract = {
    contract_id: asContractId(input.contractId),
    contract_code: input.systemContractNumber,
    project_id: asProjectId(input.projectId),
    collaboration_id: asCollaborationId(input.engagementId),
    creator_id: asCreatorId(input.creatorId),
    advertiser: recognizedText(fields, 'advertiser'),
    publisher: recognizedText(fields, 'publisher'),
    effective_date: String(recognitionField(fields, 'effectiveDate')?.normalizedValue ?? ''),
    signature_status: ['UNSIGNED', 'PARTIALLY_SIGNED', 'SIGNED'].includes(String(signatureStatus))
      ? signatureStatus as StructuredContract['signature_status']
      : 'UNKNOWN',
    advertiser_signature_date: String(recognitionField(fields, 'advertiserSignatureDate')?.normalizedValue ?? ''),
    publisher_signature_date: String(recognitionField(fields, 'publisherSignatureDate')?.normalizedValue ?? ''),
    payment_rules: {
      invoice_issue_period: recognitionField(fields, 'invoiceIssuePeriod') ?? null,
      payment_term: recognitionField(fields, 'paymentTerm') ?? null,
      payment_method: recognitionField(fields, 'paymentMethod') ?? null,
      transfer_fee_bearer: recognitionField(fields, 'transferFee') ?? null,
    },
    payout_account_snapshot: {
      beneficiary_account_name: recognizedText(fields, 'beneficiaryAccountName'),
      bank_name: recognizedText(fields, 'bankName'),
      account_number_last4: String(recognitionField(fields, 'accountNumberLast4')?.normalizedValue ?? ''),
      swift_code: recognizedText(fields, 'swiftCode'),
      iban_last4: String(recognitionField(fields, 'ibanLast4')?.normalizedValue ?? ''),
      paypal_username: recognizedText(fields, 'paypalUsername'),
      paypal_email: recognizedText(fields, 'paypalEmail'),
      remittance_information: recognizedText(fields, 'remittanceInformation'),
      status: payoutStatus,
    },
  };
  const contractIo: StructuredContractIo = {
    contract_io_id: asContractIoId(input.contractIoId),
    io_number: input.systemIoNumber,
    contract_id: structuredContract.contract_id,
    project_id: structuredContract.project_id,
    collaboration_id: structuredContract.collaboration_id,
    creator_id: structuredContract.creator_id,
    project_name: recognizedText(fields, 'projectName') || input.projectName,
    brand_name: recognizedText(fields, 'brandName'),
    campaign_start: campaign.startDate ?? '',
    campaign_end: campaign.endDate ?? '',
    platform: recognizedText(fields, 'platform'),
    channel_name: recognizedText(fields, 'channelName'),
    channel_url: recognizedText(fields, 'channelLink'),
    project_total_fee: total.amount ?? null,
    currency: total.currency || recognizedText(fields, 'currency'),
    deliverables: input.recognitionResult.deliverables,
    obligations: input.recognitionResult.obligations,
  };
  return { structuredContract, contractIo };
};

export const createUploadedContract = ({
  systemContractNumber,
  systemIoNumber,
  projectId,
  projectName,
  customer,
  creatorId,
  creatorHandle,
  engagementId,
  recognitionResults,
  recognitionResult,
  sourceDocuments,
  ...identity
}: ContractUploadInput): ContractRecord => {
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());
  const primaryDocument = sourceDocuments[0];
  const displayName = primaryDocument?.fileName.replace(/\.(pdf|docx)$/i, '').trim();
  const parseWarnings = sourceDocuments
    .filter((document) => document.parseStatus !== 'parsed')
    .map((document) => `${document.fileName}：${document.errorMessage ?? '无法解析'}`);

  const structured = buildStructuredEntities({
    systemContractNumber,
    systemIoNumber,
    projectId,
    projectName,
    customer,
    creatorId,
    creatorName: '',
    creatorHandle,
    creatorPlatform: '',
    engagementId,
    recognitionResults,
    recognitionResult,
    sourceDocuments,
    contractId: identity.contractId,
    contractIoId: identity.contractIoId,
  });
  return {
    id: systemContractNumber,
    ioId: systemIoNumber,
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
    deliverables: recognitionResult.deliverables.map((deliverable) => ({
      id: deliverable.id,
      title: deliverable.title,
      description: deliverable.content_requirements,
      source: `${deliverable.source.documentType === 'IO' ? 'IO' : '合同'}${deliverable.source_page ? ` · 第${deliverable.source_page}页` : ''}`,
    })),
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
        label: '合同尚未完成签署',
        description: '字段复核不代表合同签署；双方签署完成后才能进入付款项目。',
        severity: 'blocker',
        source: '签署页',
      },
    ],
    projectId,
    creatorId,
    creatorHandle,
    engagementId,
    extractionStage: 'review',
    recognitionResults,
    recognitionResult,
    sourceDocuments,
    structuredContract: structured.structuredContract,
    contractIOs: [structured.contractIo],
  };
};

const confirmedField = (contract: ContractRecord, fieldKey: ContractRecognitionField['fieldKey']) => (
  contract.recognitionResults?.find((field) => field.fieldKey === fieldKey && field.status === 'CONFIRMED')
);

const fieldText = (field: ContractRecognitionField | undefined) => (
  field?.editedValue?.trim() || field?.rawValue.trim() || ''
);

export const applyConfirmedRecognitionToContract = (contract: ContractRecord): ContractRecord | null => {
  const fields = contract.recognitionResults ?? [];
  if (!allRecognitionFieldsConfirmed(fields)) return null;

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
  const beneficiary = fieldText(confirmedField(contract, 'beneficiaryAccountName'));
  const objectValue = <T,>(field: ContractRecognitionField | undefined) => (
    typeof field?.normalizedValue === 'object' && field.normalizedValue
      ? field.normalizedValue as T
      : {} as T
  );
  const effectiveData = effectiveDate?.normalizedValue;
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
    project: fieldText(confirmedField(contract, 'projectName')) || contract.project,
    brand: fieldText(confirmedField(contract, 'brandName')) || contract.brand,
    platform: fieldText(confirmedField(contract, 'platform')),
    channelName: fieldText(confirmedField(contract, 'channelName')),
    channelLink: fieldText(confirmedField(contract, 'channelLink')),
    effectiveDate: typeof effectiveData === 'string' ? effectiveData : '',
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
    status: contract.signed ? contract.status : '待签署',
    issues: contract.issues.filter((issue) => issue.id !== 'recognition-review'),
    structuredContract: contract.structuredContract ? {
      ...contract.structuredContract,
      advertiser: fieldText(confirmedField(contract, 'advertiser')),
      publisher: fieldText(confirmedField(contract, 'publisher')),
      effective_date: typeof effectiveData === 'string' ? effectiveData : '',
      payout_account_snapshot: {
        ...contract.structuredContract.payout_account_snapshot,
        beneficiary_account_name: beneficiary,
        bank_name: fieldText(confirmedField(contract, 'bankName')),
        account_number_last4: String(confirmedField(contract, 'accountNumberLast4')?.normalizedValue ?? ''),
        swift_code: fieldText(confirmedField(contract, 'swiftCode')),
        iban_last4: String(confirmedField(contract, 'ibanLast4')?.normalizedValue ?? ''),
        paypal_username: fieldText(confirmedField(contract, 'paypalUsername')),
        paypal_email: fieldText(confirmedField(contract, 'paypalEmail')),
        remittance_information: fieldText(confirmedField(contract, 'remittanceInformation')),
        status: 'CONFIRMED',
      },
    } : undefined,
    contractIOs: contract.contractIOs?.map((io) => ({
      ...io,
      io_number: fieldText(confirmedField(contract, 'ioNumber')) || io.io_number,
      project_name: fieldText(confirmedField(contract, 'projectName')) || io.project_name,
      brand_name: fieldText(confirmedField(contract, 'brandName')),
      campaign_start: campaignData.startDate ?? '',
      campaign_end: campaignData.endDate ?? '',
      platform: fieldText(confirmedField(contract, 'platform')),
      channel_name: fieldText(confirmedField(contract, 'channelName')),
      channel_url: fieldText(confirmedField(contract, 'channelLink')),
      project_total_fee: moneyData.amount ?? null,
      currency: moneyData.currency || fieldText(confirmedField(contract, 'currency')),
    })),
  };
};
