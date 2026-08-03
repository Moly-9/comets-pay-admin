export type ContractDocumentType =
  | 'STANDARD_TERMS'
  | 'IO'
  | 'SIGNATURE_PAGE'
  | 'PAYMENT_ADDENDUM'
  | 'OTHER';

export type ContractParseStatus = 'parsed' | 'scanned' | 'encrypted' | 'corrupt';

export type ContractFieldStatus =
  | 'DETECTED'
  | 'CONFIRMED'
  | 'MISSING'
  | 'PLACEHOLDER'
  | 'CONFLICT'
  | 'NOT_APPLICABLE';

export type ContractFieldKey =
  | 'advertiser'
  | 'publisher'
  | 'contractNumber'
  | 'ioNumber'
  | 'projectName'
  | 'brandName'
  | 'platform'
  | 'channelName'
  | 'channelLink'
  | 'effectiveDate'
  | 'signatureStatus'
  | 'advertiserSignatureDate'
  | 'publisherSignatureDate'
  | 'campaignPeriod'
  | 'projectTotalFees'
  | 'currency'
  | 'invoiceIssuePeriod'
  | 'paymentTerm'
  | 'paymentMethod'
  | 'transferFee'
  | 'beneficiaryAccountName'
  | 'bankName'
  | 'accountNumberLast4'
  | 'swiftCode'
  | 'ibanLast4'
  | 'paypalUsername'
  | 'paypalEmail'
  | 'remittanceInformation';

export type ContractSourceLocation = {
  documentId: string;
  documentType: ContractDocumentType;
  fileName: string;
  pageNumber: number | null;
  section: string;
  sourceText: string;
  blockId: string;
};

export type ContractFieldCandidate = {
  rawValue: string;
  normalizedValue: unknown;
  source: ContractSourceLocation;
  confidence: number;
  placeholder?: boolean;
};

export type ContractRecognitionField = {
  fieldKey: ContractFieldKey;
  label: string;
  rawValue: string;
  normalizedValue: unknown;
  sourceText: string;
  pageNumber: number | null;
  section: string;
  source: ContractSourceLocation | null;
  confidence: number;
  status: ContractFieldStatus;
  candidates: ContractFieldCandidate[];
  originalDetectedValue?: string;
  editedValue?: string;
  profileComparison?: {
    status: 'MATCHED' | 'CONFLICT';
    referenceLabels: string[];
  };
};

export type ContractTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ContractTextBlock = {
  id: string;
  pageNumber: number | null;
  section: string;
  documentType: ContractDocumentType;
  text: string;
  items: ContractTextItem[];
  kind: 'heading' | 'paragraph' | 'table-row';
};

export type ContractTemplateMatch = {
  matched: boolean;
  templateKey: 'COMETS_DIGITAL_MARKETING_SINGLE_CAMPAIGN' | 'UNKNOWN';
  confidence: number;
  matchedHeadings: string[];
  ioStartPage: number | null;
};

export type ParsedContractDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  documentType: ContractDocumentType;
  parseStatus: ContractParseStatus;
  pageCount: number | null;
  blocks: ContractTextBlock[];
  templateMatch: ContractTemplateMatch;
  errorMessage?: string;
};

export type ContractSourceDocument = ParsedContractDocument & {
  documentUrl: string;
};

export type ContractRecognitionContext = {
  systemContractNumber?: string;
  systemIoNumber?: string;
  beneficiaryReferences?: Array<{
    label: string;
    matchTokens: string[];
  }>;
};

export type ContractDeliverableType =
  | 'SCRIPT'
  | 'DEDICATED_VIDEO'
  | 'INTEGRATED_VIDEO'
  | 'STREAM'
  | 'CTA'
  | 'TRACKLINK'
  | 'HASHTAG'
  | 'ANALYTICS_SCREENSHOT'
  | 'CONTENT_REMOVAL'
  | 'OTHER';

export type StructuredContractDeliverable = {
  id: string;
  type: ContractDeliverableType;
  title: string;
  quantity: number | null;
  platform: string;
  format: string;
  language: string;
  duration: string;
  release_start: string;
  release_end: string;
  content_requirements: string;
  acceptance_evidence: string;
  source_text: string;
  source_page: number | null;
  status: ContractFieldStatus;
  source: ContractSourceLocation;
};

export type ContractObligationGroup =
  | 'PURPOSE'
  | 'PUBLISHING_SPEC'
  | 'LICENSE'
  | 'ACCEPTANCE_MODIFICATION'
  | 'PAYMENT_TRIGGER';

export type StructuredContractObligation = {
  id: string;
  group: ContractObligationGroup;
  label: string;
  rawValue: string;
  normalizedValue: unknown;
  sourceText: string;
  sourcePage: number | null;
  status: ContractFieldStatus;
  source: ContractSourceLocation;
};

export type ContractValidationIssue = {
  id: string;
  severity: 'BLOCKER' | 'REVIEW';
  fieldKey?: ContractFieldKey;
  label: string;
  description: string;
  sources: ContractSourceLocation[];
};

export type ContractRecognitionResult = {
  templateMatch: ContractTemplateMatch;
  fields: ContractRecognitionField[];
  deliverables: StructuredContractDeliverable[];
  obligations: StructuredContractObligation[];
  issues: ContractValidationIssue[];
};

export type ContractParserFileInput = {
  id: string;
  fileName: string;
  mimeType: string;
  documentType: ContractDocumentType;
  buffer: ArrayBuffer;
};

export type ContractParserRequest = {
  requestId: string;
  files: ContractParserFileInput[];
};

export type ContractParserResponse =
  | {
      requestId: string;
      ok: true;
      documents: ParsedContractDocument[];
    }
  | {
      requestId: string;
      ok: false;
      error: string;
    };

export const CONTRACT_DOCUMENT_TYPE_LABELS: Record<ContractDocumentType, string> = {
  STANDARD_TERMS: 'Standard Terms / 主协议',
  IO: 'IO / 投放订单',
  SIGNATURE_PAGE: '签署页',
  PAYMENT_ADDENDUM: '付款补充协议',
  OTHER: '其他合同文件',
};

export const CONTRACT_FIELD_LABELS: Record<ContractFieldKey, string> = {
  advertiser: 'Advertiser',
  publisher: 'Publisher',
  contractNumber: '合同编号',
  ioNumber: 'IO 编号',
  projectName: '项目名称',
  brandName: '品牌',
  platform: '平台',
  channelName: '频道名称',
  channelLink: 'Channel Link',
  effectiveDate: '生效日期',
  signatureStatus: '双方签署状态',
  advertiserSignatureDate: 'Advertiser 签署日期',
  publisherSignatureDate: 'Publisher 签署日期',
  campaignPeriod: 'Campaign Period',
  projectTotalFees: 'Project Total Fees',
  currency: 'Currency',
  invoiceIssuePeriod: 'Invoice Issue Period',
  paymentTerm: 'Payment Term',
  paymentMethod: 'Payment Method',
  transferFee: 'Transfer Fee Bearer',
  beneficiaryAccountName: 'Beneficiary Account Name',
  bankName: 'Bank Name',
  accountNumberLast4: 'Account Number 后四位',
  swiftCode: 'SWIFT Code',
  ibanLast4: 'IBAN 后四位',
  paypalUsername: 'PayPal Username',
  paypalEmail: 'PayPal Email',
  remittanceInformation: 'Remittance Information',
};

export const SUMMARY_FIELD_KEYS: ContractFieldKey[] = [
  'advertiser',
  'publisher',
  'contractNumber',
  'ioNumber',
  'projectName',
  'brandName',
  'platform',
  'channelName',
  'channelLink',
  'effectiveDate',
  'campaignPeriod',
  'signatureStatus',
  'advertiserSignatureDate',
  'publisherSignatureDate',
];

export const PAYMENT_FIELD_KEYS: ContractFieldKey[] = [
  'projectTotalFees',
  'currency',
  'invoiceIssuePeriod',
  'paymentTerm',
  'paymentMethod',
  'transferFee',
  'beneficiaryAccountName',
  'bankName',
  'accountNumberLast4',
  'swiftCode',
  'ibanLast4',
  'paypalUsername',
  'paypalEmail',
  'remittanceInformation',
];
