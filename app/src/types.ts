import type {
  CooperationProjectId,
  ContractAdvertiserEntityId,
  ContractId,
  CreatorId,
  EngagementId,
  InvoiceBillingEntityId,
  InvoiceId,
  PaymentBatchId,
  PaymentRequestProjectId,
  ProjectId,
} from './businessWorkflow';

export type NavPage =
  | 'dashboard'
  | 'payment-workbench'
  | 'feishu-projects'
  | 'projects'
  | 'requests'
  | 'contracts'
  | 'contract-create'
  | 'creators'
  | 'collaborations'
  | 'invoice'
  | 'invoice-create'
  | 'invoice-batch-create'
  | 'invoice-edit'
  | 'batches'
  | 'new-batch'
  | 'transactions'
  | 'organization'
  | 'channels'
  | 'system-accounts'
  | 'system-config'
  | 'operation-log'
  | 'system-settings'
  | 'notifications';

export type RequestProjectStatusFilter =
  | 'all'
  | 'approving'
  | 'approved'
  | 'awaiting-payment'
  | 'processing'
  | 'paid'
  | 'failed';

export type NavOptions = {
  requestStatusFilter?: RequestProjectStatusFilter;
};

export type Provider = 'Airwallex' | 'PayMax' | 'PayPal' | '手动打款';

export type InvoiceCurrency = 'USD' | 'EUR' | 'GBP' | 'HKD' | 'SGD';

export type AirwallexEntityType = 'PERSONAL' | 'COMPANY';

export type AirwallexTransferMethod = 'LOCAL' | 'SWIFT';

export type PayoutAccountStatus =
  | 'DRAFT'
  | 'READY_FOR_VALIDATION'
  | 'VALIDATED'
  | 'VERIFIED'
  | 'REVIEW_REQUIRED'
  | 'CANNOT_VERIFY'
  | 'INVALID'
  | 'DISABLED';

export type PayoutAccountVersion = `v${number}` | 'legacy-v1';

export type PayoutAccountIdentity = {
  creatorId?: string;
  payoutAccountId?: string;
  payoutAccountVersion?: PayoutAccountVersion;
  providerAccountScope?: string;
  schemaKey?: string;
  accountFingerprint?: string;
  updatedAt?: string;
};

export type AirwallexVerificationCode =
  | 'VERIFIED'
  | 'INVALID'
  | 'CANNOT_VERIFY'
  | 'EXTERNAL_SERVICE_UNAVAILABLE'
  | '';

export type AirwallexNameMatchResult =
  | 'FULL_MATCH'
  | 'PARTIAL_MATCH'
  | 'NOT_MATCHED'
  | 'FULL_MATCH_INCORRECT_TYPE'
  | 'PARTIAL_MATCH_INCORRECT_TYPE'
  | '';

export type BeneficiaryAddress = {
  countryCode: string;
  streetAddress: string;
  city: string;
  state: string;
  postcode: string;
};

export type AirwallexBankDetails = {
  bankCountryCode: string;
  bankCountryName: string;
  accountCurrency: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  bankAccountCategory: string;
  accountRoutingType1: string;
  accountRoutingValue1: string;
  accountRoutingType2: string;
  accountRoutingValue2: string;
  localClearingSystem: string;
  bankName: string;
  bankBranch: string;
  bankStreetAddress: string;
  bankState: string;
  swiftCode: string;
  intermediaryBankName: string;
  intermediaryBankSwiftCode: string;
};

export type AirwallexPayoutAccount = PayoutAccountIdentity & {
  id: string;
  provider: 'Airwallex';
  nickname: string;
  isDefault: boolean;
  status: PayoutAccountStatus;
  beneficiaryId: string;
  beneficiaryEnvironment: '' | 'MOCK' | 'LIVE';
  entityType: AirwallexEntityType;
  firstName: string;
  lastName: string;
  companyName: string;
  notificationEmail: string;
  address: BeneficiaryAddress;
  transferMethod: AirwallexTransferMethod;
  bankDetails: AirwallexBankDetails;
  /**
   * 保留 Airwallex Form Schema 返回、但尚未进入标准字段模型的值。
   * key 使用 API 返回的完整 path，例如 beneficiary.additional_info.personal_id_number。
   */
  schemaValues: Record<string, string>;
  verificationCode: AirwallexVerificationCode;
  nameMatchResult: AirwallexNameMatchResult;
  validatedAt: string;
  verifiedAt: string;
  linkedProjectIds?: string[];
  invoiceIds?: string[];
  paymentBatchIds?: string[];
  transactionIds?: string[];
  activePaymentId?: string;
  hasPaymentHistory?: boolean;
  statusBeforeDisabled?: Exclude<PayoutAccountStatus, 'DISABLED'>;
};

export type PayPalPayoutAccount = PayoutAccountIdentity & {
  id: string;
  provider: 'PayPal';
  nickname: string;
  isDefault: boolean;
  status: PayoutAccountStatus;
  paypalUsername: string;
  paypalEmail: string;
  transferNote?: string;
  linkedProjectIds?: string[];
  invoiceIds?: string[];
  paymentBatchIds?: string[];
  transactionIds?: string[];
  activePaymentId?: string;
  hasPaymentHistory?: boolean;
  statusBeforeDisabled?: Exclude<PayoutAccountStatus, 'DISABLED'>;
};

export type PayMaxPayoutAccount = PayoutAccountIdentity & {
  id: string;
  provider: 'PayMax';
  nickname: string;
  isDefault: boolean;
  status: PayoutAccountStatus;
  beneficiaryName: string;
  payermaxAccountId: string;
  countryCode: string;
  currency: string;
  email: string;
  linkedProjectIds?: string[];
  invoiceIds?: string[];
  paymentBatchIds?: string[];
  transactionIds?: string[];
  activePaymentId?: string;
  hasPaymentHistory?: boolean;
  statusBeforeDisabled?: Exclude<PayoutAccountStatus, 'DISABLED'>;
};

export type CreatorPayoutAccount =
  | AirwallexPayoutAccount
  | PayPalPayoutAccount
  | PayMaxPayoutAccount;

// Invoice 文件使用的付款信息快照。达人主档改用 payoutAccounts[]，
// 避免把 Airwallex、PayPal 和每笔付款字段混在同一个长期对象中。
export type CreatorPaymentDetails = {
  bankCountry: string;
  accountName: string;
  accountType: string;
  swiftCode: string;
  accountNumber: string;
  iban: string;
  beneficiaryType: string;
  bankName: string;
  bankStreetAddress: string;
  bankCity: string;
  bankState: string;
  bankPostalCode: string;
  intermediaryBankCountry: string;
  intermediaryBankCode: string;
  transferRemarks: string;
  paypalUsername: string;
  paypalEmail: string;
};

export type DocumentPayoutSnapshot = CreatorPaymentDetails & {
  creatorId?: string;
  payoutAccountId?: string;
  payoutAccountVersion?: PayoutAccountVersion;
  payoutProvider?: Exclude<Provider, '手动打款'>;
  providerAccountScope?: string;
  externalBeneficiaryId?: string;
  accountFingerprint?: string;
  transferMethod?: AirwallexTransferMethod | 'PAYPAL';
  localClearingSystem?: string;
  accountCurrency?: string;
  schemaKey?: string;
  validationStatus?: PayoutAccountStatus;
  updatedAt?: string;
  validatedAt?: string;
  verifiedAt?: string;
  schemaValues?: Record<string, string>;
  schemaFields?: Array<{
    path: string;
    label: string;
    required: boolean;
  }>;
};

export type CreatorInvoiceContact = {
  legalName: string;
  address: string;
  phone: string;
  email: string;
};

export type CreatorSocialVerificationScreenshot = {
  id: string;
  fileName: string;
  imageUrl: string;
  uploadedAt: string;
};

export type CreatorSocialAccount = {
  id: string;
  platform: string;
  handle: string;
  profileUrl: string;
  /**
   * 达人在入驻流程中上传的平台后台截图。
   * 历史档案可能缺少该字段，管理端仅做只读展示。
   */
  verificationScreenshots?: CreatorSocialVerificationScreenshot[];
};

export type CreatorProfile = {
  id: string;
  initials: string;
  accent: string;
  name: string;
  handle: string;
  region: string;
  platform: string;
  projects: number;
  socialAccounts: CreatorSocialAccount[];
  contact: CreatorInvoiceContact;
  payoutAccounts: CreatorPayoutAccount[];
  payoutAccountHistory?: CreatorPayoutAccount[];
};

export type InvoiceEntity = {
  billingEntityId?: InvoiceBillingEntityId;
  name: string;
  address: string;
};

export type InvoiceBillingEntity = {
  id: InvoiceBillingEntityId;
  name: string;
  address: string;
};

export type InvoiceBillingSettings = {
  entities: InvoiceBillingEntity[];
  defaultEntityId: InvoiceBillingEntityId;
};

export type ContractAdvertiserEntity = {
  id: ContractAdvertiserEntityId;
  name: string;
  address: string;
};

export type ContractAdvertiserSettings = {
  entities: ContractAdvertiserEntity[];
  defaultEntityId: ContractAdvertiserEntityId;
};

export type InvoiceLineItem = {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type InvoicePaymentMethod = 'bank' | 'paypal';

export type InvoiceType = 'INTERNAL' | 'EXTERNAL';

export type InvoiceDocumentModel = {
  invoiceNumber: string;
  invoiceDate: string;
  signatureDate?: string;
  signatureText?: string;
  billTo: InvoiceEntity;
  creatorHandle: string;
  creatorSocialAccountId?: string;
  creatorPlatform?: string;
  creatorName: string;
  creatorId?: CreatorId;
  engagementId?: EngagementId;
  projectId: ProjectId;
  cooperationProjectId?: CooperationProjectId;
  projectName: string;
  contractIds?: ContractId[];
  from: CreatorInvoiceContact;
  currency: InvoiceCurrency;
  items: InvoiceLineItem[];
  payoutAccountId?: string;
  payoutAccountVersion?: PayoutAccountVersion;
  payoutProvider?: Exclude<Provider, '手动打款'>;
  payoutAccountFingerprint?: string;
  paymentMethod: InvoicePaymentMethod;
  payment: DocumentPayoutSnapshot;
};

export type InvoicePaymentFreezeSnapshot = {
  invoiceId: InvoiceId;
  invoiceVersion: number;
  creatorId?: CreatorId;
  currency: InvoiceCurrency;
  amount: number;
  payoutAccountId?: string;
  payoutAccountVersion?: PayoutAccountVersion;
  payoutAccountFingerprint?: string;
  payoutProvider: Exclude<Provider, '手动打款'>;
  paymentMethod: InvoicePaymentMethod;
  payment: DocumentPayoutSnapshot;
  frozenAt: string;
  frozenByAccount: string;
  frozenByName: string;
  frozenByRole: string;
  freezeStage: 'CREATOR_SIGNED' | 'EXTERNAL_APPROVED' | 'HISTORICAL_MIGRATION';
};

export type InvoiceReviewStatus =
  | '草稿'
  | '待签署'
  | '达人反馈'
  | '待媒介审核'
  | '待媒介复核'
  | '已通过'
  | '已退回';

export type InvoiceReviewStage =
  | 'SIGNATURE'
  | 'MEDIA'
  | 'REQUEST'
  | 'PM'
  | 'PROJECT_OWNER'
  | 'OWNER'
  | 'FINANCE'
  | 'PAYMENT';

export type InvoiceContractMatchField =
  | 'PUBLISHER'
  | 'ADVERTISER'
  | 'AMOUNT'
  | 'CURRENCY'
  | 'PAYMENT_ACCOUNT';

export type InvoiceContractMatchIssue = {
  field: InvoiceContractMatchField;
  label: string;
  severity: 'BLOCKER' | 'REASON_REQUIRED';
  contractIds: ContractId[];
  contractValue: string;
  invoiceValue: string;
  message: string;
  paymentAccountDifference?: InvoicePaymentAccountDifference;
};

export type InvoicePaymentAccountDifference = {
  fieldLabels: string[];
  technicalMetadataOnly: boolean;
  contractAccounts: Array<{
    contractReference: string;
    updatedAt?: string;
  }>;
  invoiceAccountUpdatedAt?: string;
};

export type InvoiceContractMatchReview = {
  version: number;
  contractIds: ContractId[];
  fingerprint?: string;
  result: 'MATCHED' | 'NOT_APPLICABLE' | 'BLOCKED' | 'APPROVED_WITH_REASON' | 'REASON_REQUIRED';
  issues: InvoiceContractMatchIssue[];
  reason?: string;
  actorAccount?: string;
  actorName?: string;
  actorRole?: string;
  reviewedAt?: string;
  historicalMigration?: boolean;
};

export type InvoiceNotificationDelivery = {
  channel: 'IN_APP' | 'EMAIL';
  status: 'SIMULATED_SENT' | 'SKIPPED_MISSING_RECIPIENT';
  recipientLabel: string;
};

export type InvoiceReviewEvent = {
  stage: InvoiceReviewStage;
  action:
    | '生成草稿'
    | '编辑草稿'
    | '发布达人签署'
    | '签署完成'
    | '通知达人签署'
    | '达人反馈'
    | '回复达人反馈'
    | '修改 Invoice'
    | '审核通过'
    | '复核通过并重新提交'
    | '提交请款'
    | '退回'
    | '重新提交'
    | '签署失效'
    | '付款失败'
    | '退回媒介';
  actorAccount: string;
  actorName: string;
  actorRole: string;
  fromStatus: InvoiceReviewStatus;
  toStatus: InvoiceReviewStatus;
  reason?: string;
  occurredAt: string;
  approvalRound?: number;
  notificationDeliveries?: InvoiceNotificationDelivery[];
};

export type GeneratedInvoiceRecord = {
  id: string;
  invoiceId: InvoiceId;
  invoiceType?: InvoiceType;
  sourcePayoutId: string;
  status: InvoiceReviewStatus;
  generatedAt: string;
  draftUpdatedAt?: string;
  publishedAt?: string;
  publishedBy?: {
    account: string;
    name: string;
    role: string;
  };
  snapshot: InvoiceDocumentModel;
  paymentFreezeSnapshot?: InvoicePaymentFreezeSnapshot;
  validationStatus: 'valid' | 'needs_review';
  version?: number;
  revisions?: GeneratedInvoiceRevision[];
  contractMatchReviews?: InvoiceContractMatchReview[];
};

export type InvoiceBatchRowStatus =
  | 'READY'
  | 'NEEDS_INPUT'
  | 'CONFLICT'
  | 'GENERATING'
  | 'GENERATED'
  | 'FAILED';

export type InvoiceBatchGeneratedFiles = {
  record: GeneratedInvoiceRecord;
  pdfBlob: Blob;
  docxBlob: Blob;
};

export type InvoiceBatchLineItem = InvoiceLineItem & {
  templateKey: string;
  lineItemScope?: 'SHARED' | 'CREATOR';
};

export type InvoiceBatchRow = {
  projectId: ProjectId;
  engagementId: EngagementId;
  creatorId: CreatorId;
  creatorName: string;
  creatorHandle: string;
  creatorSocialAccountId?: string;
  creatorPlatform?: string;
  sourcePayoutId: string;
  invoiceDate: string;
  items: InvoiceBatchLineItem[];
  descriptionOverrideKeys: string[];
  currency: InvoiceCurrency | '';
  payoutAccountId: string;
  payoutAccountLocked: boolean;
  contractIds: ContractId[];
  availableContractIds: ContractId[];
  contractMatchReview?: InvoiceContractMatchReview;
  contractMatchReason: string;
  status: InvoiceBatchRowStatus;
  issues: string[];
  generated?: InvoiceBatchGeneratedFiles;
};

export type InvoiceBatchDraftRow = Omit<InvoiceBatchRow, 'generated'> & {
  generated?: { record: GeneratedInvoiceRecord };
};

export type InvoiceCreationDraftBase = {
  draftId: string;
  schemaVersion: '1.0' | '2.0';
  createdByAccount: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceSingleCreationDraft = InvoiceCreationDraftBase & {
  kind: 'SINGLE';
  creatorId: string;
  creatorSocialAccountId: string;
  projectId: string;
  engagementId: string;
  contractIds: ContractId[];
  invoiceDate: string;
  selectedBillingEntityId: string;
  billTo: InvoiceEntity;
  from: CreatorInvoiceContact;
  currency: InvoiceCurrency;
  items: InvoiceLineItem[];
  payoutAccountId: string;
  payment: DocumentPayoutSnapshot;
  contractMatchReason: string;
};

export type InvoiceBatchDraft = InvoiceCreationDraftBase & {
  kind: 'BATCH';
  batchId: string;
  projectId: ProjectId | '';
  invoiceDate: string;
  selectedBillingEntityId: string;
  currency: InvoiceCurrency;
  selectedCreatorIds: CreatorId[];
  selectedEngagementIds: EngagementId[];
  sharedDescriptions: Array<Pick<InvoiceBatchLineItem, 'templateKey' | 'description'>>;
  rows: InvoiceBatchDraftRow[];
  generationProgress: { current: number; total: number };
};

export type InvoiceCreationDraft = InvoiceSingleCreationDraft | InvoiceBatchDraft;

export type InvoiceEditContext =
  | 'DRAFT'
  | 'CREATOR_FEEDBACK'
  | 'MEDIA_RECHECK'
  | 'PAYMENT_FAILURE_CONTENT'
  | 'PROJECT_RESOURCE';

export type GeneratedInvoiceRevision = {
  version: number;
  snapshot: InvoiceDocumentModel;
  paymentFreezeSnapshot?: InvoicePaymentFreezeSnapshot;
  changedFields: string[];
  reason: string;
  actorAccount: string;
  actorName: string;
  actorRole: string;
  occurredAt: string;
};

export type PayoutStatus =
  | '未进入付款'
  | '等待付款'
  | '信息异常'
  | '飞书审批中'
  | '付款处理中'
  | '付款失败'
  | '已付款'
  | '已退回';

export type PaymentFailureIssueType = 'INVOICE_CONTENT' | 'PAYMENT_LIST';

export type PaymentFailureRecord = {
  provider: Exclude<Provider, '手动打款'>;
  errorCode: string;
  providerResponse: string;
  occurredAt: string;
};

export type PaymentFailureReturn = {
  issueType: PaymentFailureIssueType;
  reason: string;
  actorAccount: string;
  actorName: string;
  occurredAt: string;
  restartStage: 'SIGNATURE' | 'PAYMENT_LIST_RESUBMISSION';
};

export type PaymentFailureRecoveryStatus =
  | 'AWAITING_CREATOR_UPDATE'
  | 'CREATOR_UPDATED'
  | 'PENDING_FINANCE_CONFIRMATION'
  | 'READY_FOR_RETRY'
  | 'RETRY_SUBMITTED'
  | 'RETRY_SUCCEEDED';

export type PaymentAttemptRef = {
  paymentBatchId: PaymentBatchId;
  paymentBatchCode: string;
  submittedAt: string;
  paymentCode?: string;
  paymentOrderCode?: string;
  sourcePaymentOrderCode?: string;
  attemptNumber?: number;
};

export type PaymentAttemptSnapshot = Readonly<{
  paymentBatchId?: PaymentBatchId;
  paymentBatchCode?: string;
  paymentCode?: string;
  attemptNumber: number;
  status: Extract<PayoutStatus, '付款失败' | '已付款'>;
  /** 财务执行打款并提交付款渠道的时间；与渠道回写时间 occurredAt 分离。 */
  submittedAt?: string;
  /** 付款渠道回写成功或失败结果的时间。 */
  occurredAt?: string;
  principalAmount: number;
  principalCurrency: InvoiceCurrency;
  transferFeeAmount?: number;
  transferFeeCurrency?: InvoiceCurrency;
  actualPaidAmount?: number;
  actualPaidCurrency?: InvoiceCurrency;
  /** 渠道确认的实际冲退金额；底层保存正数，资金流展示时转为负数。 */
  refundAmount?: number;
  refundCurrency?: InvoiceCurrency;
  refundedAt?: string;
  recipientReceivedAmount?: number;
  recipientReceivedCurrency?: InvoiceCurrency;
  errorCode?: string;
  providerResponse?: string;
  returnReason?: string;
}>;

export type PaymentNotificationDelivery = {
  channel: 'IN_APP' | 'GMAIL';
  status: 'SIMULATED_SENT' | 'SKIPPED_MISSING_RECIPIENT';
  recipientLabel: string;
};

export type PaymentNotification = {
  message: string;
  actorAccount: string;
  actorName: string;
  occurredAt: string;
  deliveries: PaymentNotificationDelivery[];
};

/** @deprecated Use PaymentNotificationDelivery for new notification flows. */
export type PaymentFailureNotificationDelivery = PaymentNotificationDelivery;

/** @deprecated Use PaymentNotification for new notification flows. */
export type PaymentFailureNotification = PaymentNotification;

export type PaymentFailureRecovery = {
  status: PaymentFailureRecoveryStatus;
  notifications: PaymentFailureNotification[];
  previousFailure?: PaymentFailureRecord;
  readyReason?: 'ACCOUNT_UNCHANGED' | 'REVALIDATED';
  failureCode?: string;
  returnReason?: string;
  creatorUpdatedAt?: string;
  reportedPayoutAccountId?: string;
  reportedPayoutAccountVersion?: PayoutAccountVersion;
  reportedAccountFingerprint?: string;
  reportedExternalBeneficiaryId?: string;
  revalidatedAt?: string;
  revalidationIssues?: string[];
  financeConfirmedAt?: string;
  financeConfirmedByAccount?: string;
  financeConfirmedByName?: string;
  retryBatchId?: string;
  retryBatchCode?: string;
  retrySucceededAt?: string;
  previousAttempts?: Array<{
    status: PaymentFailureRecoveryStatus;
    notifications: PaymentFailureNotification[];
    previousFailure?: PaymentFailureRecord;
    failureCode?: string;
    returnReason?: string;
    creatorUpdatedAt?: string;
    revalidatedAt?: string;
    financeConfirmedAt?: string;
    financeConfirmedByAccount?: string;
    financeConfirmedByName?: string;
    retryBatchId?: string;
    retryBatchCode?: string;
  }>;
};

export type Payout = {
  id: string;
  /** 用户可见的业务付款明细编号；重新付款时继续沿用。 */
  paymentCode?: string;
  paymentRequestProjectId?: PaymentRequestProjectId;
  creator: string;
  handle: string;
  creatorSocialAccountId?: string;
  creatorPlatform?: string;
  initials: string;
  projectId: string;
  project: string;
  deliverable?: string;
  contract: string;
  invoice: string;
  provider: Exclude<Provider, '手动打款'>;
  currency: InvoiceCurrency;
  amount: number;
  account: string;
  creatorId?: CreatorId;
  payoutAccountId?: string;
  payoutAccountVersion?: PayoutAccountVersion;
  payoutAccountFingerprint?: string;
  externalBeneficiaryId?: string;
  transferMethod?: AirwallexTransferMethod | 'PAYPAL';
  localClearingSystem?: string;
  recipientCountry?: string;
  feeBearer?: 'ADVERTISER' | 'PUBLISHER' | 'SHARED' | '';
  transferFeeAmount?: number;
  transferFeeCurrency?: InvoiceCurrency;
  actualPaidAmount?: number;
  actualPaidCurrency?: InvoiceCurrency;
  /** 当前失败付款对应的渠道冲退结果。 */
  refundAmount?: number;
  refundCurrency?: InvoiceCurrency;
  refundedAt?: string;
  recipientReceivedAmount?: number;
  recipientReceivedCurrency?: InvoiceCurrency;
  postTransactionBalance?: number;
  postTransactionBalanceCurrency?: InvoiceCurrency;
  paymentListRequiresRevalidation?: boolean;
  paymentListValidationIssues?: string[];
  status: PayoutStatus;
  invoiceReviewStatus: InvoiceReviewStatus;
  invoiceReviewHistory?: InvoiceReviewEvent[];
  invoiceVersion?: number;
  invoiceSignatureRound?: number;
  invoiceSignedAt?: string;
  requestApprovalRound?: number;
  paymentListVersion?: number;
  creatorFeedback?: {
    reason: string;
    actorName: string;
    occurredAt: string;
    replies?: Array<{
      message: string;
      actorAccount: string;
      actorName: string;
      actorRole: string;
      occurredAt: string;
    }>;
  };
  invoiceReviewReturn?: {
    stage: Exclude<InvoiceReviewStage, 'SIGNATURE'>;
    reason: string;
    actorName: string;
    occurredAt: string;
  };
  paymentFailure?: PaymentFailureRecord;
  paymentFailureReturn?: PaymentFailureReturn;
  paymentFailureRecovery?: PaymentFailureRecovery;
  currentPaymentAttempt?: PaymentAttemptRef;
  paymentAttempts?: readonly PaymentAttemptSnapshot[];
  invoiceSnapshot?: InvoiceDocumentModel;
  invoicePaymentFreezeSnapshot?: InvoicePaymentFreezeSnapshot;
  accent: string;
  issue?: string;
  returnReason?: string;
  paidAt?: string;
};

export type ToastState = {
  title: string;
  message: string;
  tone?: 'success' | 'warning';
} | null;
