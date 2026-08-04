import type {
  ContractId,
  CreatorId,
  EngagementId,
  InvoiceId,
  ProjectId,
} from './businessWorkflow';

export type NavPage =
  | 'dashboard'
  | 'payment-workbench'
  | 'projects'
  | 'requests'
  | 'contracts'
  | 'contract-create'
  | 'creators'
  | 'collaborations'
  | 'invoice'
  | 'invoice-create'
  | 'batches'
  | 'new-batch'
  | 'transactions'
  | 'organization'
  | 'channels'
  | 'system-settings'
  | 'notifications';

export type Provider = 'Airwallex' | 'PayMax' | 'PayPal' | '手动打款';

export type InvoiceCurrency = 'USD' | 'EUR' | 'GBP' | 'HKD';

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

export type AirwallexPayoutAccount = {
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

export type PayPalPayoutAccount = {
  id: string;
  provider: 'PayPal';
  nickname: string;
  isDefault: boolean;
  status: PayoutAccountStatus;
  paypalUsername: string;
  paypalEmail: string;
  linkedProjectIds?: string[];
  invoiceIds?: string[];
  paymentBatchIds?: string[];
  transactionIds?: string[];
  activePaymentId?: string;
  hasPaymentHistory?: boolean;
  statusBeforeDisabled?: Exclude<PayoutAccountStatus, 'DISABLED'>;
};

export type PayMaxPayoutAccount = {
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

export type CreatorInvoiceContact = {
  legalName: string;
  address: string;
  phone: string;
  email: string;
};

export type CreatorSocialAccount = {
  id: string;
  platform: string;
  handle: string;
  profileUrl: string;
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
};

export type InvoiceEntity = {
  name: string;
  address: string;
};

export type InvoiceLineItem = {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type InvoicePaymentMethod = 'bank' | 'paypal';

export type InvoiceDocumentModel = {
  invoiceNumber: string;
  invoiceDate: string;
  billTo: InvoiceEntity;
  creatorHandle: string;
  creatorName: string;
  creatorId?: CreatorId;
  engagementId?: EngagementId;
  projectId: ProjectId;
  projectName: string;
  contractIds?: ContractId[];
  from: CreatorInvoiceContact;
  currency: InvoiceCurrency;
  items: InvoiceLineItem[];
  paymentMethod: InvoicePaymentMethod;
  payment: CreatorPaymentDetails;
};

export type InvoiceReviewStatus =
  | '待签署'
  | '达人反馈'
  | '待媒介审核'
  | '待媒介复核'
  | '待发起请款'
  | '待PM审核'
  | '待项目负责人审核'
  | '待老板审核'
  | '待财务审核'
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

export type InvoiceReviewEvent = {
  stage: InvoiceReviewStage;
  action:
    | '签署完成'
    | '达人反馈'
    | '重新发送'
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
};

export type GeneratedInvoiceRecord = {
  id: string;
  invoiceId: InvoiceId;
  sourcePayoutId: string;
  status: InvoiceReviewStatus;
  generatedAt: string;
  snapshot: InvoiceDocumentModel;
  validationStatus: 'valid' | 'needs_review';
  version?: number;
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
  restartStage: 'SIGNATURE' | 'MEDIA_RECHECK';
};

export type Payout = {
  id: string;
  creator: string;
  handle: string;
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
  };
  invoiceReviewReturn?: {
    stage: Exclude<InvoiceReviewStage, 'SIGNATURE'>;
    reason: string;
    actorName: string;
    occurredAt: string;
  };
  paymentFailure?: PaymentFailureRecord;
  paymentFailureReturn?: PaymentFailureReturn;
  invoiceSnapshot?: InvoiceDocumentModel;
  accent: string;
  issue?: string;
  returnReason?: string;
  paidAt?: string;
};

export type ToastState = {
  title: string;
  message: string;
} | null;
