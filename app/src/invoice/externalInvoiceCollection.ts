import type { ContractRecord } from '../contracts';
import {
  createPrototypeId,
  type ContractId,
  type CreatorId,
  type EngagementId,
  type InvoiceId,
  type ProjectId,
} from '../businessWorkflow';
import {
  createDocumentPayoutSnapshot,
  eligibleInvoicePayoutAccounts,
  getPayoutAccountId,
} from '../payoutAccounts';
import type {
  CreatorPayoutAccount,
  CreatorProfile,
  GeneratedInvoiceRecord,
  InvoiceCurrency,
  InvoiceDocumentModel,
  InvoiceEntity,
  Payout,
} from '../types';
import { formatInvoiceNumber, invoiceDatePart, nextInvoiceNumber } from './invoiceUtils';

export type ExternalInvoiceCollectionStatus =
  | 'DRAFT'
  | 'WAITING_UPLOAD'
  | 'RECOGNIZING'
  | 'WAITING_CONFIRMATION'
  | 'WAITING_MEDIA_REVIEW'
  | 'RETURNED_FOR_CORRECTION'
  | 'RETURNED_FOR_REUPLOAD'
  | 'APPROVED'
  | 'RECOGNITION_FAILED'
  | 'CANCELLED';

export type ExternalInvoiceListStatus = '待发布' | '待上传' | '待重新上传' | '待审核' | '已通过';

export type ExternalInvoiceScenario = 'NORMAL' | 'OCR_ERROR' | 'SOURCE_FILE_ERROR';

export type ExternalInvoiceFieldKey =
  | 'SOURCE_INVOICE_NUMBER'
  | 'INVOICE_DATE'
  | 'PUBLISHER'
  | 'ADVERTISER'
  | 'AMOUNT'
  | 'CURRENCY'
  | 'PAYMENT_ACCOUNT';

export const EXTERNAL_INVOICE_FIELD_ORDER: ExternalInvoiceFieldKey[] = [
  'SOURCE_INVOICE_NUMBER',
  'INVOICE_DATE',
  'PUBLISHER',
  'ADVERTISER',
  'AMOUNT',
  'CURRENCY',
  'PAYMENT_ACCOUNT',
];

export const EXTERNAL_INVOICE_FIELD_LABEL: Record<ExternalInvoiceFieldKey, string> = {
  SOURCE_INVOICE_NUMBER: '票面 Invoice Number',
  INVOICE_DATE: 'Date of Invoice',
  PUBLISHER: '开票主体',
  ADVERTISER: '付款主体',
  AMOUNT: '总金额',
  CURRENCY: '币种',
  PAYMENT_ACCOUNT: '收款账户',
};

export const EXTERNAL_INVOICE_CRITICAL_FIELDS: ExternalInvoiceFieldKey[] = [
  'PUBLISHER',
  'AMOUNT',
  'CURRENCY',
  'ADVERTISER',
  'PAYMENT_ACCOUNT',
];

export type ExternalInvoiceActor = {
  account: string;
  name: string;
  role: string;
};

export type ExternalInvoiceSourceEvidence = {
  pageNumber: number;
  sourceText: string;
  sourceValue: string;
};

export type ExternalInvoiceRecognizedField = {
  fieldKey: ExternalInvoiceFieldKey;
  label: string;
  value: string;
  confidence: number;
  evidence: ExternalInvoiceSourceEvidence;
};

export type ExternalInvoiceFileVersion = {
  fileVersionId: string;
  version: number;
  fileName: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  fileHash: string;
  scenario: ExternalInvoiceScenario;
  uploadedBy: ExternalInvoiceActor;
  uploadedAt: string;
  supersedesFileVersionId?: string;
};

export type ExternalInvoiceRecognitionSnapshot = {
  recognitionId: string;
  fileVersionId: string;
  engineVersion: string;
  recognizedAt: string;
  fields: Record<ExternalInvoiceFieldKey, ExternalInvoiceRecognizedField>;
};

export type ExternalInvoiceCorrection = {
  fieldKey: ExternalInvoiceFieldKey;
  recognizedValue: string;
  confirmedValue: string;
  evidenceMatched: boolean;
  correctedBy: ExternalInvoiceActor;
  correctedAt: string;
};

export type ExternalInvoiceConfirmedSnapshot = {
  confirmationId: string;
  recognitionId: string;
  values: Record<ExternalInvoiceFieldKey, string>;
  corrections: ExternalInvoiceCorrection[];
  payoutAccountId: string;
  confirmedBy: ExternalInvoiceActor;
  confirmedAt: string;
};

export type ExternalInvoiceReviewAction =
  | 'CREATED'
  | 'PUBLISHED'
  | 'FILE_UPLOADED'
  | 'RECOGNITION_CORRECTED'
  | 'SUBMITTED'
  | 'RETURNED_FOR_CORRECTION'
  | 'RETURNED_FOR_REUPLOAD'
  | 'APPROVED';

export type ExternalInvoiceReviewEvent = {
  eventId: string;
  action: ExternalInvoiceReviewAction;
  actor: ExternalInvoiceActor;
  occurredAt: string;
  reason?: string;
  fromStatus?: ExternalInvoiceCollectionStatus;
  toStatus: ExternalInvoiceCollectionStatus;
};

export type ExternalInvoiceExpectedValues = {
  amount: number;
  currency: InvoiceCurrency;
  advertiser: string;
  description: string;
  dueDate: string;
};

export type ExternalInvoiceCollectionInput = {
  projectId: ProjectId;
  projectName: string;
  engagementId: EngagementId;
  creatorId: CreatorId;
  creatorName: string;
  creatorHandle: string;
  contractIds: ContractId[];
  expected: ExternalInvoiceExpectedValues;
};

export type ExternalInvoiceCollectionRecord = {
  invoiceId: InvoiceId;
  invoiceType: 'EXTERNAL';
  invoiceNumber?: string;
  sourceInvoiceNumber?: string;
  projectId: ProjectId;
  projectName: string;
  engagementId: EngagementId;
  creatorId: CreatorId;
  creatorName: string;
  creatorHandle: string;
  contractIds: ContractId[];
  expected: ExternalInvoiceExpectedValues;
  status: ExternalInvoiceCollectionStatus;
  selectedPayoutAccountId?: string;
  sourceFileVersions: ExternalInvoiceFileVersion[];
  recognitionSnapshots: ExternalInvoiceRecognitionSnapshot[];
  confirmedSnapshots: ExternalInvoiceConfirmedSnapshot[];
  reviewHistory: ExternalInvoiceReviewEvent[];
  createdBy: ExternalInvoiceActor;
  createdAt: string;
  publishedAt?: string;
  approvedAt?: string;
};

export type ExternalInvoiceValidationIssue = {
  fieldKey: ExternalInvoiceFieldKey | 'PAYOUT_ACCOUNT_STATUS';
  label: string;
  severity: 'BLOCKER' | 'WARNING';
  expectedValue: string;
  actualValue: string;
  message: string;
};

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const sameText = (left: string, right: string) => normalizeText(left) === normalizeText(right);
const nowActor = (actor?: ExternalInvoiceActor): ExternalInvoiceActor => actor ?? {
  account: 'creator.demo',
  name: '达人端演示账号',
  role: '达人账号',
};

export const externalInvoiceListStatus = (
  status: ExternalInvoiceCollectionStatus,
): ExternalInvoiceListStatus => {
  if (status === 'DRAFT') return '待发布';
  if (status === 'RETURNED_FOR_CORRECTION' || status === 'RETURNED_FOR_REUPLOAD') {
    return '待重新上传';
  }
  if (status === 'WAITING_MEDIA_REVIEW') return '待审核';
  if (status === 'APPROVED') return '已通过';
  return '待上传';
};

export const externalInvoicePageTab = (
  status: ExternalInvoiceCollectionStatus,
): 'upload' | 'review' | 'approved' => {
  if (status === 'WAITING_MEDIA_REVIEW') return 'review';
  if (status === 'APPROVED') return 'approved';
  return 'upload';
};

export const currentExternalInvoiceRecognition = (record: ExternalInvoiceCollectionRecord) => (
  record.recognitionSnapshots[record.recognitionSnapshots.length - 1]
);

export const currentExternalInvoiceConfirmation = (record: ExternalInvoiceCollectionRecord) => (
  record.confirmedSnapshots[record.confirmedSnapshots.length - 1]
);

export const createExternalInvoiceCollection = ({
  projectId,
  projectName,
  engagementId,
  creatorId,
  creatorName,
  creatorHandle,
  contractIds,
  expected,
  actor,
  publish,
  occurredAt = new Date().toISOString(),
}: ExternalInvoiceCollectionInput & {
  actor: ExternalInvoiceActor;
  publish: boolean;
  occurredAt?: string;
}): ExternalInvoiceCollectionRecord => {
  const status: ExternalInvoiceCollectionStatus = publish ? 'WAITING_UPLOAD' : 'DRAFT';
  return {
    invoiceId: createPrototypeId('invoice') as InvoiceId,
    invoiceType: 'EXTERNAL',
    projectId,
    projectName,
    engagementId,
    creatorId,
    creatorName,
    creatorHandle,
    contractIds,
    expected,
    status,
    sourceFileVersions: [],
    recognitionSnapshots: [],
    confirmedSnapshots: [],
    reviewHistory: [{
      eventId: createPrototypeId('audit'),
      action: 'CREATED',
      actor,
      occurredAt,
      toStatus: status,
    }, ...(publish ? [{
      eventId: createPrototypeId('audit'),
      action: 'PUBLISHED' as const,
      actor,
      occurredAt,
      fromStatus: 'DRAFT' as const,
      toStatus: 'WAITING_UPLOAD' as const,
    }] : [])],
    createdBy: actor,
    createdAt: occurredAt,
    publishedAt: publish ? occurredAt : undefined,
  };
};

export const publishExternalInvoiceCollection = (
  record: ExternalInvoiceCollectionRecord,
  actor: ExternalInvoiceActor,
  occurredAt = new Date().toISOString(),
): ExternalInvoiceCollectionRecord => {
  if (record.status !== 'DRAFT') throw new Error('只有待发布的外部 Invoice 可以发布。');
  return {
    ...record,
    status: 'WAITING_UPLOAD',
    publishedAt: occurredAt,
    reviewHistory: [...record.reviewHistory, {
      eventId: createPrototypeId('audit'),
      action: 'PUBLISHED',
      actor,
      occurredAt,
      fromStatus: record.status,
      toStatus: 'WAITING_UPLOAD',
    }],
  };
};

const payoutAccountSourceValue = (account: CreatorPayoutAccount, creatorId: CreatorId) => {
  const snapshot = createDocumentPayoutSnapshot(account, creatorId);
  return account.provider === 'PayPal'
    ? `${snapshot.paypalUsername} / ${snapshot.paypalEmail}`
    : `${snapshot.accountName} / ${snapshot.iban || snapshot.accountNumber}`;
};

const payoutAccountPublisher = (account: CreatorPayoutAccount, creatorId: CreatorId) => {
  const snapshot = createDocumentPayoutSnapshot(account, creatorId);
  return account.provider === 'PayPal'
    ? snapshot.paypalUsername
    : snapshot.accountName;
};

const sourceValuesForScenario = (
  record: ExternalInvoiceCollectionRecord,
  account: CreatorPayoutAccount,
  scenario: ExternalInvoiceScenario,
  invoiceDate: string,
) => {
  const expectedAmount = record.expected.amount;
  const sourceAmount = scenario === 'SOURCE_FILE_ERROR'
    ? Math.max(1, expectedAmount - 200)
    : expectedAmount;
  return {
    SOURCE_INVOICE_NUMBER: `MCN-${invoiceDate.replace(/-/g, '')}-${String(record.sourceFileVersions.length + 1).padStart(2, '0')}`,
    INVOICE_DATE: invoiceDate,
    PUBLISHER: payoutAccountPublisher(account, record.creatorId),
    ADVERTISER: record.expected.advertiser,
    AMOUNT: sourceAmount.toFixed(2),
    CURRENCY: record.expected.currency,
    PAYMENT_ACCOUNT: payoutAccountSourceValue(account, record.creatorId),
  } satisfies Record<ExternalInvoiceFieldKey, string>;
};

const recognitionValuesForScenario = (
  sourceValues: Record<ExternalInvoiceFieldKey, string>,
  scenario: ExternalInvoiceScenario,
) => ({
  ...sourceValues,
  AMOUNT: scenario === 'OCR_ERROR'
    ? Math.max(1, Number(sourceValues.AMOUNT) - 200).toFixed(2)
    : sourceValues.AMOUNT,
});

const fieldRecord = (
  values: Record<ExternalInvoiceFieldKey, string>,
  sourceValues: Record<ExternalInvoiceFieldKey, string>,
  scenario: ExternalInvoiceScenario,
) => Object.fromEntries(EXTERNAL_INVOICE_FIELD_ORDER.map((fieldKey, index) => [fieldKey, {
  fieldKey,
  label: EXTERNAL_INVOICE_FIELD_LABEL[fieldKey],
  value: values[fieldKey],
  confidence: scenario === 'OCR_ERROR' && fieldKey === 'AMOUNT' ? 0.61 : 0.96,
  evidence: {
    pageNumber: 1,
    sourceText: `${EXTERNAL_INVOICE_FIELD_LABEL[fieldKey]}: ${sourceValues[fieldKey]}`,
    sourceValue: sourceValues[fieldKey],
  },
}])) as Record<ExternalInvoiceFieldKey, ExternalInvoiceRecognizedField>;

export const simulateExternalInvoiceUpload = ({
  record,
  creator,
  payoutAccountId,
  scenario,
  actor,
  invoiceDate,
  occurredAt = new Date().toISOString(),
}: {
  record: ExternalInvoiceCollectionRecord;
  creator: CreatorProfile;
  payoutAccountId: string;
  scenario: ExternalInvoiceScenario;
  actor?: ExternalInvoiceActor;
  invoiceDate: string;
  occurredAt?: string;
}): ExternalInvoiceCollectionRecord => {
  if (!['WAITING_UPLOAD', 'RETURNED_FOR_REUPLOAD', 'WAITING_CONFIRMATION'].includes(record.status)) {
    throw new Error('当前状态不能上传或替换 Invoice 文件。');
  }
  invoiceDatePart(invoiceDate);
  const account = eligibleInvoicePayoutAccounts(creator).find((candidate) => (
    getPayoutAccountId(candidate) === payoutAccountId
  ));
  if (!account) throw new Error('请选择达人档案中已验证且可用于 Invoice 的收款账户。');
  const sourceValues = sourceValuesForScenario(record, account, scenario, invoiceDate);
  const recognitionValues = recognitionValuesForScenario(sourceValues, scenario);
  const version = record.sourceFileVersions.length + 1;
  const fileVersionId = createPrototypeId('item');
  const recognitionId = createPrototypeId('item');
  const uploader = nowActor(actor);
  const previousFile = record.sourceFileVersions[record.sourceFileVersions.length - 1];
  const fileVersion: ExternalInvoiceFileVersion = {
    fileVersionId,
    version,
    fileName: `External-Invoice-${record.creatorName.replace(/\s+/g, '-')}-v${version}.pdf`,
    mimeType: 'application/pdf',
    fileHash: `sha256-demo-${String(record.invoiceId).slice(-8)}-${version}`,
    scenario,
    uploadedBy: uploader,
    uploadedAt: occurredAt,
    supersedesFileVersionId: previousFile?.fileVersionId,
  };
  const recognition: ExternalInvoiceRecognitionSnapshot = {
    recognitionId,
    fileVersionId,
    engineVersion: 'prototype-ocr-1.0',
    recognizedAt: occurredAt,
    fields: fieldRecord(recognitionValues, sourceValues, scenario),
  };
  const confirmation: ExternalInvoiceConfirmedSnapshot = {
    confirmationId: createPrototypeId('item'),
    recognitionId,
    values: { ...recognitionValues },
    corrections: [],
    payoutAccountId,
    confirmedBy: uploader,
    confirmedAt: occurredAt,
  };
  return {
    ...record,
    status: 'WAITING_CONFIRMATION',
    invoiceNumber: undefined,
    sourceInvoiceNumber: sourceValues.SOURCE_INVOICE_NUMBER,
    selectedPayoutAccountId: payoutAccountId,
    sourceFileVersions: [...record.sourceFileVersions, fileVersion],
    recognitionSnapshots: [...record.recognitionSnapshots, recognition],
    confirmedSnapshots: [...record.confirmedSnapshots, confirmation],
    reviewHistory: [...record.reviewHistory, {
      eventId: createPrototypeId('audit'),
      action: 'FILE_UPLOADED',
      actor: uploader,
      occurredAt,
      fromStatus: record.status,
      toStatus: 'WAITING_CONFIRMATION',
    }],
  };
};

export const correctExternalInvoiceRecognition = (
  record: ExternalInvoiceCollectionRecord,
  fieldKey: ExternalInvoiceFieldKey,
  confirmedValue: string,
  actor?: ExternalInvoiceActor,
  occurredAt = new Date().toISOString(),
): ExternalInvoiceCollectionRecord => {
  if (!['WAITING_CONFIRMATION', 'RETURNED_FOR_CORRECTION'].includes(record.status)) {
    throw new Error('当前状态不能纠正识别结果。');
  }
  const recognition = currentExternalInvoiceRecognition(record);
  const confirmation = currentExternalInvoiceConfirmation(record);
  if (!recognition || !confirmation) throw new Error('当前 Invoice 尚未生成识别结果。');
  const sourceValue = recognition.fields[fieldKey].evidence.sourceValue;
  if (!sameText(sourceValue, confirmedValue)) {
    throw new Error('纠正值无法在原始 Invoice 中找到一致证据，请修改原文件后重新上传。');
  }
  const correction: ExternalInvoiceCorrection = {
    fieldKey,
    recognizedValue: recognition.fields[fieldKey].value,
    confirmedValue: confirmedValue.trim(),
    evidenceMatched: true,
    correctedBy: nowActor(actor),
    correctedAt: occurredAt,
  };
  const nextConfirmation: ExternalInvoiceConfirmedSnapshot = {
    ...confirmation,
    values: { ...confirmation.values, [fieldKey]: confirmedValue.trim() },
    corrections: [
      ...confirmation.corrections.filter((item: ExternalInvoiceCorrection) => item.fieldKey !== fieldKey),
      correction,
    ],
    confirmedBy: correction.correctedBy,
    confirmedAt: occurredAt,
  };
  return {
    ...record,
    status: 'WAITING_CONFIRMATION',
    confirmedSnapshots: [...record.confirmedSnapshots.slice(0, -1), nextConfirmation],
    reviewHistory: [...record.reviewHistory, {
      eventId: createPrototypeId('audit'),
      action: 'RECOGNITION_CORRECTED',
      actor: correction.correctedBy,
      occurredAt,
      fromStatus: record.status,
      toStatus: 'WAITING_CONFIRMATION',
    }],
  };
};

export const externalInvoiceValidationIssues = ({
  record,
  creator,
  contracts = [],
}: {
  record: ExternalInvoiceCollectionRecord;
  creator?: CreatorProfile;
  contracts?: ContractRecord[];
}): ExternalInvoiceValidationIssue[] => {
  const confirmation = currentExternalInvoiceConfirmation(record);
  if (!confirmation) return [{
    fieldKey: 'SOURCE_INVOICE_NUMBER',
    label: 'Invoice 文件',
    severity: 'BLOCKER',
    expectedValue: '已上传并确认',
    actualValue: '尚未上传',
    message: '请先上传 Invoice 并确认识别结果。',
  }];
  const account = eligibleInvoicePayoutAccounts(creator).find((candidate) => (
    getPayoutAccountId(candidate) === confirmation.payoutAccountId
  ));
  const issues: ExternalInvoiceValidationIssue[] = [];
  const addMismatch = (
    fieldKey: ExternalInvoiceFieldKey,
    expectedValue: string,
    actualValue: string,
    message: string,
  ) => issues.push({ fieldKey, label: EXTERNAL_INVOICE_FIELD_LABEL[fieldKey], severity: 'BLOCKER', expectedValue, actualValue, message });

  if (Number(confirmation.values.AMOUNT) !== record.expected.amount) {
    addMismatch('AMOUNT', record.expected.amount.toFixed(2), confirmation.values.AMOUNT, '总金额与媒介发起时的预期金额不一致。');
  }
  if (!sameText(confirmation.values.CURRENCY, record.expected.currency)) {
    addMismatch('CURRENCY', record.expected.currency, confirmation.values.CURRENCY, '币种与媒介发起时的预期币种不一致。');
  }
  if (!sameText(confirmation.values.ADVERTISER, record.expected.advertiser)) {
    addMismatch('ADVERTISER', record.expected.advertiser, confirmation.values.ADVERTISER, '付款主体与媒介发起时的付款主体不一致。');
  }
  if (!account) {
    issues.push({
      fieldKey: 'PAYOUT_ACCOUNT_STATUS',
      label: '收款账户状态',
      severity: 'BLOCKER',
      expectedValue: '达人档案中的已验证账户',
      actualValue: confirmation.payoutAccountId || '未选择',
      message: '选定账户已失效或不属于当前达人档案。',
    });
  } else {
    const expectedPublisher = payoutAccountPublisher(account, record.creatorId);
    const expectedAccount = payoutAccountSourceValue(account, record.creatorId);
    if (!sameText(confirmation.values.PUBLISHER, expectedPublisher)) {
      addMismatch('PUBLISHER', expectedPublisher, confirmation.values.PUBLISHER, '开票主体与选定收款账户主体不一致。');
    }
    if (!sameText(confirmation.values.PAYMENT_ACCOUNT, expectedAccount)) {
      addMismatch('PAYMENT_ACCOUNT', expectedAccount, confirmation.values.PAYMENT_ACCOUNT, '票面收款账户与达人选择的账户不一致。');
    }
  }

  const selectedContracts = contracts.filter((contract) => (
    contract.contractId && record.contractIds.includes(contract.contractId)
  ));
  if (account && selectedContracts.some((contract) => {
    const contractAccountId = contract.payoutAccountId || contract.paymentSnapshot?.payoutAccountId;
    return Boolean(contractAccountId && contractAccountId !== getPayoutAccountId(account));
  })) {
    issues.push({
      fieldKey: 'PAYMENT_ACCOUNT',
      label: '合同账户提醒',
      severity: 'WARNING',
      expectedValue: selectedContracts.map((contract) => contract.accountName || contract.id).join('；'),
      actualValue: payoutAccountSourceValue(account, record.creatorId),
      message: '关联合同的账户信息与达人本次选择不同，请媒介结合原文件确认。',
    });
  }
  return issues;
};

export const submitExternalInvoiceForReview = ({
  record,
  creator,
  contracts,
  occupiedInvoices,
  reservedInvoiceNumbers = [],
  reservedSourceInvoiceNumbers = [],
  actor,
  occurredAt = new Date().toISOString(),
}: {
  record: ExternalInvoiceCollectionRecord;
  creator?: CreatorProfile;
  contracts?: ContractRecord[];
  occupiedInvoices: GeneratedInvoiceRecord[];
  reservedInvoiceNumbers?: string[];
  reservedSourceInvoiceNumbers?: string[];
  actor?: ExternalInvoiceActor;
  occurredAt?: string;
}): ExternalInvoiceCollectionRecord => {
  if (record.status !== 'WAITING_CONFIRMATION') {
    throw new Error('当前状态不能提交媒介审核。');
  }
  const blockers = externalInvoiceValidationIssues({ record, creator, contracts })
    .filter((issue) => issue.severity === 'BLOCKER');
  if (blockers.length) throw new Error(blockers[0].message);
  const confirmation = currentExternalInvoiceConfirmation(record)!;
  const sourceInvoiceNumber = confirmation.values.SOURCE_INVOICE_NUMBER.trim();
  if (reservedSourceInvoiceNumbers.some((value) => sameText(value, sourceInvoiceNumber))) {
    throw new Error(`票面 Invoice Number ${sourceInvoiceNumber} 已被其他外部 Invoice 使用。`);
  }
  const invoiceDate = confirmation.values.INVOICE_DATE;
  const candidateNumber = nextInvoiceNumber(occupiedInvoices, invoiceDate, reservedInvoiceNumbers);
  const submitter = nowActor(actor);
  return {
    ...record,
    status: 'WAITING_MEDIA_REVIEW',
    invoiceNumber: candidateNumber,
    sourceInvoiceNumber,
    reviewHistory: [...record.reviewHistory, {
      eventId: createPrototypeId('audit'),
      action: 'SUBMITTED',
      actor: submitter,
      occurredAt,
      fromStatus: record.status,
      toStatus: 'WAITING_MEDIA_REVIEW',
    }],
  };
};

export const returnExternalInvoice = (
  record: ExternalInvoiceCollectionRecord,
  returnType: 'CORRECTION' | 'REUPLOAD',
  reason: string,
  actor: ExternalInvoiceActor,
  occurredAt = new Date().toISOString(),
): ExternalInvoiceCollectionRecord => {
  if (record.status !== 'WAITING_MEDIA_REVIEW') throw new Error('只有待审核的外部 Invoice 可以退回。');
  if (!reason.trim()) throw new Error('退回原因不能为空。');
  const toStatus = returnType === 'CORRECTION' ? 'RETURNED_FOR_CORRECTION' : 'RETURNED_FOR_REUPLOAD';
  return {
    ...record,
    status: toStatus,
    reviewHistory: [...record.reviewHistory, {
      eventId: createPrototypeId('audit'),
      action: returnType === 'CORRECTION' ? 'RETURNED_FOR_CORRECTION' : 'RETURNED_FOR_REUPLOAD',
      actor,
      occurredAt,
      reason: reason.trim(),
      fromStatus: record.status,
      toStatus,
    }],
  };
};

export const buildApprovedExternalInvoice = ({
  record,
  creator,
  contracts = [],
  invoiceEntity,
  occupiedInvoices,
  reservedInvoiceNumbers = [],
  reservedSourceInvoiceNumbers = [],
  actor,
  occurredAt = new Date().toISOString(),
}: {
  record: ExternalInvoiceCollectionRecord;
  creator: CreatorProfile;
  contracts?: ContractRecord[];
  invoiceEntity: InvoiceEntity;
  occupiedInvoices: GeneratedInvoiceRecord[];
  reservedInvoiceNumbers?: string[];
  reservedSourceInvoiceNumbers?: string[];
  actor: ExternalInvoiceActor;
  occurredAt?: string;
}): {
  collection: ExternalInvoiceCollectionRecord;
  invoice: GeneratedInvoiceRecord;
  payout: Payout;
} => {
  if (record.status !== 'WAITING_MEDIA_REVIEW') throw new Error('只有待审核的外部 Invoice 可以审核通过。');
  const blockers = externalInvoiceValidationIssues({ record, creator, contracts })
    .filter((issue) => issue.severity === 'BLOCKER');
  if (blockers.length) throw new Error(blockers[0].message);
  const confirmation = currentExternalInvoiceConfirmation(record);
  if (!confirmation) throw new Error('外部 Invoice 缺少达人确认数据。');
  const sourceInvoiceNumber = confirmation.values.SOURCE_INVOICE_NUMBER.trim();
  if (reservedSourceInvoiceNumbers.some((value) => sameText(value, sourceInvoiceNumber))) {
    throw new Error(`票面 Invoice Number ${sourceInvoiceNumber} 已被其他外部 Invoice 使用。`);
  }
  const account = eligibleInvoicePayoutAccounts(creator).find((candidate) => (
    getPayoutAccountId(candidate) === confirmation.payoutAccountId
  ));
  if (!account) throw new Error('外部 Invoice 的收款账户已失效。');
  const invoiceDate = confirmation.values.INVOICE_DATE;
  const currentNumber = record.invoiceNumber;
  const occupiedWithoutCurrent = occupiedInvoices.filter((candidate) => candidate.id !== currentNumber);
  const invoiceNumber = currentNumber
    && currentNumber.startsWith(`INV-${invoiceDate.replace(/-/g, '')}-`)
    && !occupiedWithoutCurrent.some((candidate) => candidate.id === currentNumber)
    && !reservedInvoiceNumbers.includes(currentNumber)
      ? currentNumber
      : nextInvoiceNumber(occupiedWithoutCurrent, invoiceDate, reservedInvoiceNumbers);
  const payment = createDocumentPayoutSnapshot(account, creator.id);
  const amount = Number(confirmation.values.AMOUNT);
  const snapshot: InvoiceDocumentModel = {
    invoiceNumber,
    invoiceDate,
    billTo: { ...invoiceEntity, name: confirmation.values.ADVERTISER },
    creatorHandle: record.creatorHandle,
    creatorName: record.creatorName,
    creatorId: record.creatorId,
    engagementId: record.engagementId,
    projectId: record.projectId,
    cooperationProjectId: record.projectId,
    projectName: record.projectName,
    contractIds: [...record.contractIds],
    from: {
      ...creator.contact,
      legalName: confirmation.values.PUBLISHER,
    },
    currency: confirmation.values.CURRENCY as InvoiceCurrency,
    items: [{
      id: createPrototypeId('item'),
      description: record.expected.description,
      unitPrice: amount,
      quantity: 1,
      lineTotal: amount,
    }],
    payoutAccountId: payment.payoutAccountId,
    payoutAccountVersion: payment.payoutAccountVersion,
    payoutProvider: payment.payoutProvider,
    payoutAccountFingerprint: payment.accountFingerprint,
    paymentMethod: account.provider === 'PayPal' ? 'paypal' : 'bank',
    payment,
  };
  const payoutId = createPrototypeId('payout');
  const invoice: GeneratedInvoiceRecord = {
    id: invoiceNumber,
    invoiceId: record.invoiceId,
    invoiceType: 'EXTERNAL',
    sourcePayoutId: payoutId,
    status: '已通过',
    generatedAt: occurredAt,
    snapshot,
    validationStatus: 'valid',
    version: record.sourceFileVersions.length,
  };
  const provider: Payout['provider'] = account.provider;
  const rawAccount = account.provider === 'PayPal'
    ? payment.paypalEmail
    : payment.iban || payment.accountNumber;
  const payout: Payout = {
    id: payoutId,
    creator: record.creatorName,
    handle: record.creatorHandle,
    initials: creator.initials,
    projectId: String(record.projectId),
    project: record.projectName,
    deliverable: record.expected.description,
    contract: record.contractIds.join('、') || '未关联合同',
    invoice: invoiceNumber,
    provider,
    currency: snapshot.currency,
    amount,
    account: rawAccount ? `•••• ${rawAccount.replace(/\s/g, '').slice(-4)}` : '待补充',
    creatorId: record.creatorId,
    payoutAccountId: payment.payoutAccountId,
    payoutAccountVersion: payment.payoutAccountVersion,
    payoutAccountFingerprint: payment.accountFingerprint,
    externalBeneficiaryId: payment.externalBeneficiaryId,
    transferMethod: payment.transferMethod,
    localClearingSystem: payment.localClearingSystem,
    status: '未进入付款',
    invoiceReviewStatus: '已通过',
    invoiceVersion: record.sourceFileVersions.length,
    invoiceSignatureRound: 0,
    invoiceSnapshot: snapshot,
    accent: creator.accent,
  };
  const collection: ExternalInvoiceCollectionRecord = {
    ...record,
    invoiceNumber,
    status: 'APPROVED',
    approvedAt: occurredAt,
    reviewHistory: [...record.reviewHistory, {
      eventId: createPrototypeId('audit'),
      action: 'APPROVED',
      actor,
      occurredAt,
      fromStatus: record.status,
      toStatus: 'APPROVED',
    }],
  };
  return { collection, invoice, payout };
};

export const externalInvoicePayoutProvider = (
  record: ExternalInvoiceCollectionRecord,
  creator?: CreatorProfile,
) => {
  const account = creator?.payoutAccounts.find((candidate) => (
    getPayoutAccountId(candidate) === record.selectedPayoutAccountId
  ));
  return account?.provider;
};

export const contractAccountReminder = (
  record: ExternalInvoiceCollectionRecord,
  contracts: ContractRecord[],
) => contracts.filter((contract) => (
  contract.contractId && record.contractIds.includes(contract.contractId)
)).map((contract) => ({
  contractId: contract.contractId!,
  contractNumber: contract.id,
  accountName: contract.accountName || contract.paymentSnapshot?.accountName || '合同未填写账户主体',
  accountReference: contract.accountFingerprint || contract.payoutAccountFingerprint || '合同未填写账户标识',
}));

export const formatExternalInvoiceAmount = (record: ExternalInvoiceCollectionRecord) => (
  `${record.expected.currency} ${record.expected.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
);

export const externalInvoiceNumberCandidate = (
  invoiceDate: string,
  sequence: number,
) => formatInvoiceNumber(invoiceDate, sequence);
