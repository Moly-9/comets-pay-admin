import { isConfirmedContract, type ContractRecord } from '../contracts';
import { accountDisplayValue } from '../accountPresentation';
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
  InvoiceContractMatchIssue,
  InvoiceNotificationDelivery,
  DocumentPayoutSnapshot,
  Payout,
} from '../types';
import { formatInvoiceNumber, invoiceDatePart, nextInvoiceNumber } from './invoiceUtils';
import { createInvoicePaymentFreezeSnapshot } from '../invoicePaymentFreeze';
import { createInvoiceNotificationDeliveries } from './invoiceNotification';
import {
  createInvoiceContractMatchReview,
  evaluateInvoiceContractMatch,
} from './invoiceContractMatching';

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

export type ExternalInvoiceListStatus = '待发布' | '待上传' | '待重新上传' | '待审核' | '待发起请款';

export type ExternalInvoiceScenario =
  | 'NORMAL'
  | 'OCR_ERROR'
  | 'SOURCE_FILE_ERROR'
  | 'ACCOUNT_MISMATCH';

export type ExternalInvoiceFieldKey =
  | 'SOURCE_INVOICE_NUMBER'
  | 'INVOICE_DATE'
  | 'PUBLISHER'
  | 'ADVERTISER'
  | 'DESCRIPTION'
  | 'AMOUNT'
  | 'CURRENCY'
  | 'PAYMENT_ACCOUNT';

export const EXTERNAL_INVOICE_FIELD_ORDER: ExternalInvoiceFieldKey[] = [
  'SOURCE_INVOICE_NUMBER',
  'INVOICE_DATE',
  'PUBLISHER',
  'ADVERTISER',
  'DESCRIPTION',
  'AMOUNT',
  'CURRENCY',
  'PAYMENT_ACCOUNT',
];

export const EXTERNAL_INVOICE_REVIEW_FIELD_ORDER = EXTERNAL_INVOICE_FIELD_ORDER.filter(
  (field): field is Exclude<ExternalInvoiceFieldKey, 'SOURCE_INVOICE_NUMBER'> => field !== 'SOURCE_INVOICE_NUMBER',
);

export const EXTERNAL_INVOICE_FIELD_LABEL: Record<ExternalInvoiceFieldKey, string> = {
  SOURCE_INVOICE_NUMBER: '票面 Invoice Number',
  INVOICE_DATE: 'Date of Invoice',
  PUBLISHER: 'From',
  ADVERTISER: 'Bill To',
  DESCRIPTION: 'Description',
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

export type ExternalInvoiceMediaReviewDecision =
  | 'CONFIRMED_CORRECTION'
  | 'ANOMALY'
  | 'REUPLOAD_REQUIRED';

export type ExternalInvoiceMediaFieldReview = {
  reviewId: string;
  fieldKey: ExternalInvoiceFieldKey;
  fileVersionId: string;
  decision: ExternalInvoiceMediaReviewDecision;
  note?: string;
  reviewedBy: ExternalInvoiceActor;
  reviewedAt: string;
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
  | 'FIELD_REVIEWED'
  | 'CONTRACT_MATCH_REVIEWED'
  | 'INVOICE_SIGNATURE_CONFIRMED'
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
  fieldKey?: ExternalInvoiceFieldKey;
  fieldDecision?: ExternalInvoiceMediaReviewDecision;
  fromStatus?: ExternalInvoiceCollectionStatus;
  toStatus: ExternalInvoiceCollectionStatus;
  notificationDeliveries?: InvoiceNotificationDelivery[];
};

export type ExternalInvoiceExpectedValues = {
  amount: number;
  currency: InvoiceCurrency;
  billTo: InvoiceEntity;
  description: string;
  dueDate: string;
};

export type ExternalInvoiceContractMatchStage = 'CREATION' | 'MEDIA_REVIEW';

export type ExternalInvoiceContractMatchReview = {
  reviewId: string;
  stage: ExternalInvoiceContractMatchStage;
  fileVersionId?: string;
  fingerprint: string;
  result: 'MATCHED' | 'NOT_APPLICABLE' | 'BLOCKED' | 'APPROVED_WITH_REASON' | 'REASON_REQUIRED';
  issues: InvoiceContractMatchIssue[];
  reason?: string;
  reviewedBy: ExternalInvoiceActor;
  reviewedAt: string;
};

export type ExternalInvoiceSignatureConfirmation = {
  confirmationId: string;
  fileVersionId: string;
  confirmedBy: ExternalInvoiceActor;
  confirmedAt: string;
};

export type ExternalInvoiceCollectionInput = {
  projectId: ProjectId;
  projectName: string;
  engagementId: EngagementId;
  creatorId: CreatorId;
  creatorName: string;
  creatorLegalName: string;
  creatorHandle: string;
  creatorSocialAccountId?: string;
  creatorPlatform?: string;
  contractIds: ContractId[];
  presetPayoutAccountId?: string;
  presetPayoutAccountSnapshot?: DocumentPayoutSnapshot;
  contractMatchReason?: string;
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
  creatorLegalNameSnapshot: string;
  creatorHandle: string;
  creatorSocialAccountId?: string;
  creatorPlatform?: string;
  contractIds: ContractId[];
  presetPayoutAccountId?: string;
  presetPayoutAccountSnapshot?: DocumentPayoutSnapshot;
  expected: ExternalInvoiceExpectedValues;
  status: ExternalInvoiceCollectionStatus;
  selectedPayoutAccountId?: string;
  sourceFileVersions: ExternalInvoiceFileVersion[];
  recognitionSnapshots: ExternalInvoiceRecognitionSnapshot[];
  confirmedSnapshots: ExternalInvoiceConfirmedSnapshot[];
  mediaFieldReviews: ExternalInvoiceMediaFieldReview[];
  contractMatchReviews: ExternalInvoiceContractMatchReview[];
  invoiceSignatureConfirmations: ExternalInvoiceSignatureConfirmation[];
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

export type ExternalInvoiceReviewReadiness = {
  canApprove: boolean;
  completed: number;
  total: number;
  blockers: string[];
  pendingCriticalFields: ExternalInvoiceFieldKey[];
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
  if (status === 'APPROVED') return '待发起请款';
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

export const currentExternalInvoiceFieldReview = (
  record: ExternalInvoiceCollectionRecord,
  fieldKey: ExternalInvoiceFieldKey,
) => {
  const currentFileVersionId = record.sourceFileVersions[record.sourceFileVersions.length - 1]?.fileVersionId;
  return [...(record.mediaFieldReviews ?? [])].reverse().find((review) => (
    review.fieldKey === fieldKey && review.fileVersionId === currentFileVersionId
  ));
};

const emptyPayoutSnapshot = (): DocumentPayoutSnapshot => ({
  bankCountry: '',
  accountName: '',
  accountType: '',
  swiftCode: '',
  accountNumber: '',
  iban: '',
  beneficiaryType: '',
  bankName: '',
  bankStreetAddress: '',
  bankCity: '',
  bankState: '',
  bankPostalCode: '',
  intermediaryBankCountry: '',
  intermediaryBankCode: '',
  transferRemarks: '',
  paypalUsername: '',
  paypalEmail: '',
});

const externalInvoiceContractModel = ({
  record,
  creator,
  account,
}: {
  record: Pick<ExternalInvoiceCollectionRecord,
    | 'invoiceNumber'
    | 'creatorHandle'
    | 'creatorSocialAccountId'
    | 'creatorPlatform'
    | 'creatorName'
    | 'creatorId'
    | 'engagementId'
    | 'projectId'
    | 'projectName'
    | 'contractIds'
    | 'expected'
    | 'creatorLegalNameSnapshot'> & Partial<Pick<ExternalInvoiceCollectionRecord, 'confirmedSnapshots'>>;
  creator?: CreatorProfile;
  account?: CreatorPayoutAccount;
}): InvoiceDocumentModel => {
  const confirmation = record.confirmedSnapshots?.[record.confirmedSnapshots.length - 1];
  const payment = account
    ? createDocumentPayoutSnapshot(account, record.creatorId)
    : emptyPayoutSnapshot();
  const amount = Number(confirmation?.values.AMOUNT ?? record.expected.amount);
  return {
    invoiceNumber: record.invoiceNumber ?? '',
    invoiceDate: confirmation?.values.INVOICE_DATE ?? '',
    billTo: {
      ...record.expected.billTo,
      name: confirmation?.values.ADVERTISER ?? record.expected.billTo.name,
    },
    creatorHandle: record.creatorHandle,
    creatorSocialAccountId: record.creatorSocialAccountId,
    creatorPlatform: record.creatorPlatform,
    creatorName: record.creatorName,
    creatorId: record.creatorId,
    engagementId: record.engagementId,
    projectId: record.projectId,
    cooperationProjectId: record.projectId,
    projectName: record.projectName,
    contractIds: [...record.contractIds],
    from: {
      ...(creator?.contact ?? { legalName: '', address: '', phone: '', email: '' }),
      legalName: confirmation?.values.PUBLISHER
        ?? creator?.contact.legalName
        ?? record.creatorLegalNameSnapshot,
    },
    currency: (confirmation?.values.CURRENCY ?? record.expected.currency) as InvoiceCurrency,
    items: [{
      id: 'external-contract-match-line',
      description: confirmation?.values.DESCRIPTION ?? record.expected.description,
      unitPrice: Number.isFinite(amount) ? amount : 0,
      quantity: 1,
      lineTotal: Number.isFinite(amount) ? amount : 0,
    }],
    payoutAccountId: payment.payoutAccountId,
    payoutAccountVersion: payment.payoutAccountVersion,
    payoutProvider: payment.payoutProvider,
    payoutAccountFingerprint: payment.accountFingerprint,
    paymentMethod: account?.provider === 'PayPal' ? 'paypal' : 'bank',
    payment,
  };
};

const contractMatchFingerprint = (issues: InvoiceContractMatchIssue[]) => JSON.stringify(
  issues.map((issue) => ({
    field: issue.field,
    severity: issue.severity,
    contractIds: issue.contractIds,
    contractValue: issue.contractValue,
    invoiceValue: issue.invoiceValue,
  })),
);

const selectedExternalContracts = (
  record: Pick<ExternalInvoiceCollectionRecord, 'contractIds'>,
  contracts: ContractRecord[],
) => contracts.filter((contract) => (
  contract.contractId && record.contractIds.includes(contract.contractId)
));

export const evaluateExternalInvoiceContractMatch = ({
  record,
  creator,
  contracts,
  reason,
}: {
  record: ExternalInvoiceCollectionRecord;
  creator?: CreatorProfile;
  contracts: ContractRecord[];
  reason?: string;
}): ReturnType<typeof evaluateInvoiceContractMatch> & { fingerprint: string; effectiveReason: string } => {
  const confirmation = currentExternalInvoiceConfirmation(record);
  const account = confirmation
    ? eligibleInvoicePayoutAccounts(creator).find((candidate) => (
        getPayoutAccountId(candidate) === confirmation.payoutAccountId
      ))
    : undefined;
  const selectedContracts = selectedExternalContracts(record, contracts);
  const base = evaluateInvoiceContractMatch(
    selectedContracts,
    externalInvoiceContractModel({ record, creator, account }),
    '',
    { paymentAccountPending: !confirmation },
  );
  const fingerprint = contractMatchFingerprint(base.issues);
  const inheritedReason = [...(record.contractMatchReviews ?? [])].reverse().find((review) => (
    review.fingerprint === fingerprint && review.reason
  ))?.reason ?? '';
  const effectiveReason = reason === undefined ? inheritedReason : reason;
  return {
    ...evaluateInvoiceContractMatch(
      selectedContracts,
      externalInvoiceContractModel({ record, creator, account }),
      effectiveReason,
      { paymentAccountPending: !confirmation },
    ),
    fingerprint,
    effectiveReason,
  };
};

export const evaluateExternalInvoiceCreationContractMatch = ({
  creator,
  creatorId,
  creatorHandle,
  projectId,
  projectName,
  engagementId,
  contractIds,
  contracts,
  expected,
  reason = '',
}: {
  creator: CreatorProfile;
  creatorId: CreatorId;
  creatorHandle: string;
  projectId: ProjectId;
  projectName: string;
  engagementId: EngagementId;
  contractIds: ContractId[];
  contracts: ContractRecord[];
  expected: ExternalInvoiceExpectedValues;
  reason?: string;
}) => evaluateInvoiceContractMatch(
  contracts.filter((contract) => contract.contractId && contractIds.includes(contract.contractId)),
  externalInvoiceContractModel({
    record: {
      creatorHandle,
      creatorName: creator.name,
      creatorLegalNameSnapshot: creator.contact.legalName,
      creatorId,
      engagementId,
      projectId,
      projectName,
      contractIds,
      expected,
    },
    creator,
  }),
  reason,
  { paymentAccountPending: true },
);

const createExternalContractMatchReview = ({
  record,
  creator,
  contracts,
  reason,
  stage,
  actor,
  reviewedAt,
}: {
  record: ExternalInvoiceCollectionRecord;
  creator?: CreatorProfile;
  contracts: ContractRecord[];
  reason?: string;
  stage: ExternalInvoiceContractMatchStage;
  actor: ExternalInvoiceActor;
  reviewedAt: string;
}): ExternalInvoiceContractMatchReview => {
  const match = evaluateExternalInvoiceContractMatch({ record, creator, contracts, reason });
  return {
    reviewId: createPrototypeId('audit'),
    stage,
    fileVersionId: currentExternalInvoiceConfirmation(record)
      ? record.sourceFileVersions[record.sourceFileVersions.length - 1]?.fileVersionId
      : undefined,
    fingerprint: match.fingerprint,
    result: match.result,
    issues: match.issues,
    reason: match.reasonRequiredIssues.length && match.reasonValid
      ? match.effectiveReason.trim()
      : undefined,
    reviewedBy: actor,
    reviewedAt,
  };
};

export const createExternalInvoiceCollection = ({
  projectId,
  projectName,
  engagementId,
  creatorId,
  creatorName,
  creatorLegalName,
  creatorHandle,
  creatorSocialAccountId,
  creatorPlatform,
  contractIds,
  presetPayoutAccountId,
  presetPayoutAccountSnapshot,
  contractMatchReason,
  expected,
  creator,
  contracts = [],
  actor,
  publish,
  occurredAt = new Date().toISOString(),
}: ExternalInvoiceCollectionInput & {
  actor: ExternalInvoiceActor;
  publish: boolean;
  creator?: CreatorProfile;
  contracts?: ContractRecord[];
  occurredAt?: string;
}): ExternalInvoiceCollectionRecord => {
  if (creator && creator.id !== creatorId) throw new Error('达人档案与当前 creatorId 不一致。');
  const currentCreatorLegalName = creator?.contact.legalName.trim() ?? creatorLegalName.trim();
  if (!currentCreatorLegalName) throw new Error('达人档案 Real Name 待补充。');
  const status: ExternalInvoiceCollectionStatus = publish ? 'WAITING_UPLOAD' : 'DRAFT';
  const record: ExternalInvoiceCollectionRecord = {
    invoiceId: createPrototypeId('invoice') as InvoiceId,
    invoiceType: 'EXTERNAL',
    projectId,
    projectName,
    engagementId,
    creatorId,
    creatorName,
    creatorLegalNameSnapshot: currentCreatorLegalName,
    creatorHandle,
    creatorSocialAccountId,
    creatorPlatform,
    contractIds,
    ...(presetPayoutAccountId && presetPayoutAccountSnapshot ? {
      presetPayoutAccountId,
      presetPayoutAccountSnapshot: { ...presetPayoutAccountSnapshot },
    } : {}),
    expected: { ...expected, billTo: { ...expected.billTo } },
    status,
    sourceFileVersions: [],
    recognitionSnapshots: [],
    confirmedSnapshots: [],
    mediaFieldReviews: [],
    contractMatchReviews: [],
    invoiceSignatureConfirmations: [],
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
  const selectedContracts = selectedExternalContracts(record, contracts);
  if (contractIds.length && selectedContracts.length !== contractIds.length) {
    throw new Error('部分关联合同已失效，请重新选择。');
  }
  const match = evaluateExternalInvoiceContractMatch({
    record,
    creator,
    contracts,
    reason: contractMatchReason,
  });
  if (match.blockerIssues.length) throw new Error(match.blockerIssues[0].message);
  if (match.reasonRequiredIssues.length && !match.reasonValid) {
    throw new Error('合同存在金额或币种差异，请填写 1–300 字可放行差异说明。');
  }
  return {
    ...record,
    contractMatchReviews: [createExternalContractMatchReview({
      record,
      creator,
      contracts,
      reason: contractMatchReason,
      stage: 'CREATION',
      actor,
      reviewedAt: occurredAt,
    })],
  };
};

export const publishExternalInvoiceCollection = (
  record: ExternalInvoiceCollectionRecord,
  actor: ExternalInvoiceActor,
  occurredAt = new Date().toISOString(),
  creator?: CreatorProfile,
): ExternalInvoiceCollectionRecord => {
  if (record.status !== 'DRAFT') throw new Error('只有待发布的外部 Invoice 可以发布。');
  if (creator && creator.id !== record.creatorId) throw new Error('达人档案与当前 creatorId 不一致。');
  if (!(creator?.contact.legalName ?? record.creatorLegalNameSnapshot ?? '').trim()) {
    throw new Error('达人档案 Real Name 待补充。');
  }
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

const sourceValuesForScenario = (
  record: ExternalInvoiceCollectionRecord,
  creator: CreatorProfile,
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
    PUBLISHER: creator.contact.legalName,
    ADVERTISER: record.expected.billTo.name,
    DESCRIPTION: record.expected.description,
    AMOUNT: sourceAmount.toFixed(2),
    CURRENCY: record.expected.currency,
    PAYMENT_ACCOUNT: scenario === 'ACCOUNT_MISMATCH'
      ? 'Unverified account / DEMO-0917'
      : payoutAccountSourceValue(account, record.creatorId),
  } satisfies Record<ExternalInvoiceFieldKey, string>;
};

export const reviewExternalInvoiceField = (
  record: ExternalInvoiceCollectionRecord,
  fieldKey: ExternalInvoiceFieldKey,
  decision: ExternalInvoiceMediaReviewDecision,
  actor: ExternalInvoiceActor,
  note = '',
  occurredAt = new Date().toISOString(),
): ExternalInvoiceCollectionRecord => {
  if (record.status !== 'WAITING_MEDIA_REVIEW') {
    throw new Error('只有待审核的外部 Invoice 可以记录字段复核结果。');
  }
  const recognition = currentExternalInvoiceRecognition(record);
  const confirmation = currentExternalInvoiceConfirmation(record);
  const fileVersionId = record.sourceFileVersions[record.sourceFileVersions.length - 1]?.fileVersionId;
  if (!recognition || !confirmation || !fileVersionId) {
    throw new Error('当前 Invoice 缺少有效的文件、识别或达人确认数据。');
  }
  const correction = confirmation.corrections.find((item) => item.fieldKey === fieldKey);
  if (decision === 'CONFIRMED_CORRECTION' && !correction?.evidenceMatched) {
    throw new Error('只有能在原文件中找到证据的达人纠正值才可以确认。');
  }
  if (decision !== 'CONFIRMED_CORRECTION' && !note.trim()) {
    throw new Error('标记异常或要求重新上传时必须填写说明。');
  }
  const review: ExternalInvoiceMediaFieldReview = {
    reviewId: createPrototypeId('audit'),
    fieldKey,
    fileVersionId,
    decision,
    note: note.trim() || undefined,
    reviewedBy: actor,
    reviewedAt: occurredAt,
  };
  return {
    ...record,
    mediaFieldReviews: [...(record.mediaFieldReviews ?? []), review],
    reviewHistory: [...record.reviewHistory, {
      eventId: createPrototypeId('audit'),
      action: 'FIELD_REVIEWED',
      actor,
      occurredAt,
      reason: review.note,
      fieldKey,
      fieldDecision: decision,
      fromStatus: record.status,
      toStatus: record.status,
    }],
  };
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
  if (!creator.contact.legalName.trim()) throw new Error('达人档案 Real Name 待补充。');
  const sourceValues = sourceValuesForScenario(record, creator, account, scenario, invoiceDate);
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
  if (!sameText(confirmation.values.ADVERTISER, record.expected.billTo.name)) {
    addMismatch('ADVERTISER', record.expected.billTo.name, confirmation.values.ADVERTISER, 'Bill To 与发起任务时选择的开票主体名称不一致。');
  }
  if (!sameText(confirmation.values.DESCRIPTION, record.expected.description)) {
    addMismatch('DESCRIPTION', record.expected.description, confirmation.values.DESCRIPTION, '合作内容与媒介发起时的校验基准不一致。');
  }
  const creatorLegalName = creator?.contact.legalName.trim() ?? '';
  if (!creatorLegalName) {
    addMismatch('PUBLISHER', '达人档案 Real Name', confirmation.values.PUBLISHER, '达人档案 Real Name 待补充。');
  } else if (!sameText(confirmation.values.PUBLISHER, creatorLegalName)) {
    addMismatch('PUBLISHER', creatorLegalName, confirmation.values.PUBLISHER, 'From 与达人档案 Real Name 不一致。');
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
    const expectedAccount = payoutAccountSourceValue(account, record.creatorId);
    if (!sameText(confirmation.values.PAYMENT_ACCOUNT, expectedAccount)) {
      addMismatch('PAYMENT_ACCOUNT', expectedAccount, confirmation.values.PAYMENT_ACCOUNT, '票面收款账户与达人选择的账户不一致。');
    }
  }
  return issues;
};

export const currentExternalInvoiceSignatureConfirmation = (
  record: ExternalInvoiceCollectionRecord,
) => {
  const currentFileVersionId = record.sourceFileVersions[record.sourceFileVersions.length - 1]?.fileVersionId;
  if (!currentFileVersionId) return undefined;
  return [...(record.invoiceSignatureConfirmations ?? [])].reverse().find((item) => (
    item.fileVersionId === currentFileVersionId
  ));
};

export const confirmExternalInvoiceSignature = (
  record: ExternalInvoiceCollectionRecord,
  actor: ExternalInvoiceActor,
  occurredAt = new Date().toISOString(),
): ExternalInvoiceCollectionRecord => {
  if (record.status !== 'WAITING_MEDIA_REVIEW') {
    throw new Error('只有待审核的外部 Invoice 可以确认签名。');
  }
  const fileVersionId = record.sourceFileVersions[record.sourceFileVersions.length - 1]?.fileVersionId;
  if (!fileVersionId) throw new Error('当前 Invoice 缺少有效文件版本。');
  if (currentExternalInvoiceSignatureConfirmation(record)) return record;
  return {
    ...record,
    invoiceSignatureConfirmations: [...(record.invoiceSignatureConfirmations ?? []), {
      confirmationId: createPrototypeId('audit'),
      fileVersionId,
      confirmedBy: actor,
      confirmedAt: occurredAt,
    }],
    reviewHistory: [...record.reviewHistory, {
      eventId: createPrototypeId('audit'),
      action: 'INVOICE_SIGNATURE_CONFIRMED',
      actor,
      occurredAt,
      fromStatus: record.status,
      toStatus: record.status,
    }],
  };
};

export const saveExternalInvoiceContractMatchReview = ({
  record,
  creator,
  contracts,
  reason,
  actor,
  occurredAt = new Date().toISOString(),
}: {
  record: ExternalInvoiceCollectionRecord;
  creator?: CreatorProfile;
  contracts: ContractRecord[];
  reason: string;
  actor: ExternalInvoiceActor;
  occurredAt?: string;
}): ExternalInvoiceCollectionRecord => {
  if (record.status !== 'WAITING_MEDIA_REVIEW') {
    throw new Error('只有待审核的外部 Invoice 可以保存合同差异说明。');
  }
  const match = evaluateExternalInvoiceContractMatch({ record, creator, contracts, reason });
  if (match.blockerIssues.length) throw new Error(match.blockerIssues[0].message);
  if (match.reasonRequiredIssues.length && !match.reasonValid) {
    throw new Error('请填写 1–300 字合同差异说明。');
  }
  const review = createExternalContractMatchReview({
    record,
    creator,
    contracts,
    reason,
    stage: 'MEDIA_REVIEW',
    actor,
    reviewedAt: occurredAt,
  });
  return {
    ...record,
    contractMatchReviews: [...(record.contractMatchReviews ?? []), review],
    reviewHistory: [...record.reviewHistory, {
      eventId: createPrototypeId('audit'),
      action: 'CONTRACT_MATCH_REVIEWED',
      actor,
      occurredAt,
      reason: review.reason,
      fromStatus: record.status,
      toStatus: record.status,
    }],
  };
};

export const externalInvoiceReviewReadiness = ({
  record,
  creator,
  contracts = [],
  contractMatchReason,
}: {
  record: ExternalInvoiceCollectionRecord;
  creator?: CreatorProfile;
  contracts?: ContractRecord[];
  contractMatchReason?: string;
}): ExternalInvoiceReviewReadiness => {
  const recognition = currentExternalInvoiceRecognition(record);
  const confirmation = currentExternalInvoiceConfirmation(record);
  const validationBlockers = externalInvoiceValidationIssues({ record, creator, contracts })
    .filter((issue) => issue.severity === 'BLOCKER');
  const selectedContracts = selectedExternalContracts(record, contracts);
  const missingContractCount = Math.max(0, record.contractIds.length - selectedContracts.length);
  const contractMatch = evaluateExternalInvoiceContractMatch({
    record,
    creator,
    contracts,
    reason: contractMatchReason,
  });
  const contractMatchBlockers = [
    ...contractMatch.blockerIssues.map((issue) => `${issue.label}：${issue.message}`),
    ...(contractMatch.reasonRequiredIssues.length && !contractMatch.reasonValid
      ? ['合同存在可放行差异，请填写 1–300 字说明']
      : []),
    ...(missingContractCount ? [`${missingContractCount} 份关联合同已失效`] : []),
  ];
  const unsignedContracts = selectedContracts.filter((contract) => !isConfirmedContract(contract));
  const currentFileVersionId = record.sourceFileVersions[record.sourceFileVersions.length - 1]?.fileVersionId;
  const invoiceSignatureConfirmed = Boolean(currentFileVersionId && (record.invoiceSignatureConfirmations ?? []).some((item) => (
    item.fileVersionId === currentFileVersionId
  )));
  const correctedCriticalFields = confirmation?.corrections
    .filter((correction) => (
      correction.evidenceMatched && EXTERNAL_INVOICE_CRITICAL_FIELDS.includes(correction.fieldKey)
    ))
    .map((correction) => correction.fieldKey) ?? [];
  const pendingCriticalFields = correctedCriticalFields.filter((fieldKey) => (
    currentExternalInvoiceFieldReview(record, fieldKey)?.decision !== 'CONFIRMED_CORRECTION'
  ));
  const currentFieldReviews = (record.mediaFieldReviews ?? []).filter((review) => (
    review.fileVersionId === currentFileVersionId
  ));
  const reviewBlockers = currentFieldReviews
    .filter((review) => review.decision === 'ANOMALY' || review.decision === 'REUPLOAD_REQUIRED')
    .map((review) => `${EXTERNAL_INVOICE_FIELD_LABEL[review.fieldKey]}：${review.note ?? '需要处理'}`);
  const blockers = [
    ...(!recognition || !confirmation ? ['识别结果或达人确认值不完整'] : []),
    ...validationBlockers.map((issue) => `${issue.label}：${issue.message}`),
    ...pendingCriticalFields.map((fieldKey) => `${EXTERNAL_INVOICE_FIELD_LABEL[fieldKey]}的达人纠正值待确认`),
    ...reviewBlockers,
    ...contractMatchBlockers,
    ...unsignedContracts.map((contract) => `合同 ${contract.id} 尚未完成签署`),
    ...(!invoiceSignatureConfirmed ? ['请确认当前版本 Invoice 已签名'] : []),
    ...(!currentFileVersionId ? ['当前文件版本无效'] : []),
  ];
  const total = 7;
  const incompleteGroups = [
    !recognition || !confirmation,
    validationBlockers.some((issue) => ['AMOUNT', 'CURRENCY', 'DESCRIPTION'].includes(issue.fieldKey)),
    validationBlockers.some((issue) => issue.fieldKey === 'PUBLISHER' || issue.fieldKey === 'ADVERTISER')
      || contractMatch.blockerIssues.length > 0,
    validationBlockers.some((issue) => issue.fieldKey === 'PAYMENT_ACCOUNT' || issue.fieldKey === 'PAYOUT_ACCOUNT_STATUS'),
    pendingCriticalFields.length > 0 || reviewBlockers.length > 0,
    contractMatchBlockers.length > 0 || unsignedContracts.length > 0,
    !currentFileVersionId || !invoiceSignatureConfirmed,
  ].filter(Boolean).length;
  return {
    canApprove: record.status === 'WAITING_MEDIA_REVIEW' && blockers.length === 0,
    completed: total - incompleteGroups,
    total,
    blockers,
    pendingCriticalFields,
  };
};

export const submitExternalInvoiceForReview = ({
  record,
  creator,
  contracts,
  occupiedInvoices,
  reservedInvoiceNumbers = [],
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
    throw new Error('当前状态不能提交审核。');
  }
  const blockers = externalInvoiceValidationIssues({ record, creator, contracts })
    .filter((issue) => issue.severity === 'BLOCKER');
  if (blockers.length) throw new Error(blockers[0].message);
  const contractMatch = evaluateExternalInvoiceContractMatch({ record, creator, contracts: contracts ?? [] });
  if (contractMatch.blockerIssues.length) throw new Error(contractMatch.blockerIssues[0].message);
  const confirmation = currentExternalInvoiceConfirmation(record)!;
  const sourceInvoiceNumber = confirmation.values.SOURCE_INVOICE_NUMBER.trim();
  const invoiceDate = confirmation.values.INVOICE_DATE;
  const candidateNumber = nextInvoiceNumber(occupiedInvoices, invoiceDate, reservedInvoiceNumbers);
  const submitter = nowActor(actor);
  const contractMatchReview = createExternalContractMatchReview({
    record,
    creator,
    contracts: contracts ?? [],
    reason: contractMatch.effectiveReason,
    stage: 'MEDIA_REVIEW',
    actor: submitter,
    reviewedAt: occurredAt,
  });
  return {
    ...record,
    status: 'WAITING_MEDIA_REVIEW',
    invoiceNumber: candidateNumber,
    sourceInvoiceNumber,
    contractMatchReviews: [...(record.contractMatchReviews ?? []), contractMatchReview],
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
  notificationEmail?: string,
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
      notificationDeliveries: createInvoiceNotificationDeliveries(notificationEmail),
    }],
  };
};

export const buildApprovedExternalInvoice = ({
  record,
  creator,
  contracts = [],
  occupiedInvoices,
  reservedInvoiceNumbers = [],
  contractMatchReason,
  actor,
  occurredAt = new Date().toISOString(),
}: {
  record: ExternalInvoiceCollectionRecord;
  creator: CreatorProfile;
  contracts?: ContractRecord[];
  occupiedInvoices: GeneratedInvoiceRecord[];
  reservedInvoiceNumbers?: string[];
  reservedSourceInvoiceNumbers?: string[];
  contractMatchReason?: string;
  actor: ExternalInvoiceActor;
  occurredAt?: string;
}): {
  collection: ExternalInvoiceCollectionRecord;
  invoice: GeneratedInvoiceRecord;
  payout: Payout;
} => {
  if (record.status !== 'WAITING_MEDIA_REVIEW') throw new Error('只有待审核的外部 Invoice 可以审核通过。');
  const readiness = externalInvoiceReviewReadiness({ record, creator, contracts, contractMatchReason });
  if (!readiness.canApprove) throw new Error(readiness.blockers[0] ?? '外部 Invoice 尚未完成复核。');
  const confirmation = currentExternalInvoiceConfirmation(record);
  if (!confirmation) throw new Error('外部 Invoice 缺少达人确认数据。');
  const sourceInvoiceNumber = confirmation.values.SOURCE_INVOICE_NUMBER.trim();
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
    billTo: { ...record.expected.billTo },
    creatorHandle: record.creatorHandle,
    creatorSocialAccountId: record.creatorSocialAccountId,
    creatorPlatform: record.creatorPlatform,
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
      description: confirmation.values.DESCRIPTION,
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
  const paymentFreezeSnapshot = createInvoicePaymentFreezeSnapshot({
    invoiceId: record.invoiceId,
    invoiceVersion: record.sourceFileVersions.length,
    snapshot,
    actor,
    freezeStage: 'EXTERNAL_APPROVED',
    frozenAt: occurredAt,
  });
  const finalContractMatch = evaluateExternalInvoiceContractMatch({
    record,
    creator,
    contracts,
    reason: contractMatchReason,
  });
  const invoice: GeneratedInvoiceRecord = {
    id: invoiceNumber,
    invoiceId: record.invoiceId,
    invoiceType: 'EXTERNAL',
    sourcePayoutId: payoutId,
    status: '已通过',
    generatedAt: occurredAt,
    snapshot,
    paymentFreezeSnapshot,
    validationStatus: 'valid',
    version: record.sourceFileVersions.length,
    contractMatchReviews: [createInvoiceContractMatchReview({
      contracts: selectedExternalContracts(record, contracts),
      model: snapshot,
      version: record.sourceFileVersions.length,
      reason: finalContractMatch.effectiveReason,
      actor: {
        account: actor.account,
        name: actor.name,
        role: actor.role,
      },
      reviewedAt: occurredAt,
    })],
  };
  const provider: Payout['provider'] = account.provider;
  const rawAccount = account.provider === 'PayPal'
    ? payment.paypalEmail
    : payment.iban || payment.accountNumber;
  const payout: Payout = {
    id: payoutId,
    creator: record.creatorName,
    handle: record.creatorHandle,
    creatorSocialAccountId: record.creatorSocialAccountId,
    creatorPlatform: record.creatorPlatform,
    initials: creator.initials,
    projectId: String(record.projectId),
    project: record.projectName,
    deliverable: record.expected.description,
    contract: record.contractIds.join('、') || '未关联合同',
    invoice: invoiceNumber,
    provider,
    currency: snapshot.currency,
    amount,
    account: accountDisplayValue(rawAccount),
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
    invoicePaymentFreezeSnapshot: paymentFreezeSnapshot,
    accent: creator.accent,
  };
  const finalContractReview = createExternalContractMatchReview({
    record,
    creator,
    contracts,
    reason: contractMatchReason,
    stage: 'MEDIA_REVIEW',
    actor,
    reviewedAt: occurredAt,
  });
  const collection: ExternalInvoiceCollectionRecord = {
    ...record,
    invoiceNumber,
    status: 'APPROVED',
    approvedAt: occurredAt,
    contractMatchReviews: [...(record.contractMatchReviews ?? []), finalContractReview],
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
