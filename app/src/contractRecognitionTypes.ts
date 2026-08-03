export type ContractDocumentType =
  | 'STANDARD_TERMS'
  | 'IO'
  | 'SIGNATURE_PAGE'
  | 'PAYMENT_ADDENDUM'
  | 'OTHER';

export type ContractParseStatus = 'parsed' | 'scanned' | 'encrypted' | 'corrupt';

export type ContractFieldStatus = 'detected' | 'missing' | 'conflict' | 'confirmed';

export type ContractFieldKey =
  | 'advertiser'
  | 'publisher'
  | 'contractNumber'
  | 'ioNumber'
  | 'projectBrand'
  | 'platformChannel'
  | 'effectiveDate'
  | 'campaignPeriod'
  | 'projectTotalFees'
  | 'invoiceIssuePeriod'
  | 'paymentTerm'
  | 'paymentMethod'
  | 'transferFee'
  | 'beneficiaryAccount';

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
};

export type ContractRecognitionField = {
  fieldKey: ContractFieldKey;
  label: string;
  rawValue: string;
  normalizedValue: unknown;
  source: ContractSourceLocation | null;
  confidence: number;
  status: ContractFieldStatus;
  candidates: ContractFieldCandidate[];
  editedValue?: string;
  profileComparison?: {
    status: 'matched' | 'conflict';
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
  text: string;
  items: ContractTextItem[];
  kind: 'heading' | 'paragraph' | 'table-row';
};

export type ParsedContractDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  documentType: ContractDocumentType;
  parseStatus: ContractParseStatus;
  pageCount: number | null;
  blocks: ContractTextBlock[];
  errorMessage?: string;
};

export type ContractSourceDocument = ParsedContractDocument & {
  documentUrl: string;
};

export type ContractRecognitionContext = {
  systemContractNumber?: string;
  beneficiaryReferences?: Array<{
    label: string;
    matchTokens: string[];
  }>;
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
  projectBrand: '项目 / 品牌',
  platformChannel: '平台 / 频道',
  effectiveDate: '生效日期',
  campaignPeriod: 'Campaign Period',
  projectTotalFees: 'Project Total Fees',
  invoiceIssuePeriod: 'Invoice Issue Period',
  paymentTerm: 'Payment Term',
  paymentMethod: 'Payment Method',
  transferFee: 'Transfer Fee',
  beneficiaryAccount: 'Beneficiary / Bank Account',
};

export const SUMMARY_FIELD_KEYS: ContractFieldKey[] = [
  'advertiser',
  'publisher',
  'contractNumber',
  'ioNumber',
  'projectBrand',
  'platformChannel',
  'effectiveDate',
  'campaignPeriod',
];

export const PAYMENT_FIELD_KEYS: ContractFieldKey[] = [
  'projectTotalFees',
  'invoiceIssuePeriod',
  'paymentTerm',
  'paymentMethod',
  'transferFee',
  'beneficiaryAccount',
];
