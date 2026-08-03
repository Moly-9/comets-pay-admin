export type NavPage =
  | 'dashboard'
  | 'payment-workbench'
  | 'projects'
  | 'requests'
  | 'contracts'
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

export type CreatorPayoutAccount = AirwallexPayoutAccount | PayPalPayoutAccount;

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
  creatorId?: string;
  engagementId?: string;
  projectId: string;
  projectName: string;
  from: CreatorInvoiceContact;
  currency: InvoiceCurrency;
  items: InvoiceLineItem[];
  paymentMethod: InvoicePaymentMethod;
  payment: CreatorPaymentDetails;
};

export type GeneratedInvoiceRecord = {
  id: string;
  status: '待签署';
  generatedAt: string;
  snapshot: InvoiceDocumentModel;
};

export type PayoutStatus =
  | '待财务复核'
  | '等待付款'
  | '信息异常'
  | '飞书审批中'
  | '付款处理中'
  | '已付款'
  | '已退回';

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
  currency: 'USD' | 'EUR';
  amount: number;
  account: string;
  status: PayoutStatus;
  accent: string;
  issue?: string;
  returnReason?: string;
  paidAt?: string;
};

export type ToastState = {
  title: string;
  message: string;
} | null;
