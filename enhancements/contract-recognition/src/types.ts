export type DocumentType =
  | "STANDARD_TERMS"
  | "MAIN_AGREEMENT"
  | "IO"
  | "PAYMENT_ADDENDUM"
  | "SIGNATURE_PAGE"
  | "UNKNOWN";

export type RecognitionStatus =
  | "detected"
  | "missing"
  | "conflict"
  | "confirmed";

export type FieldKey =
  | "advertiser"
  | "publisher"
  | "contractNumber"
  | "ioNumber"
  | "projectBrand"
  | "platformChannel"
  | "effectiveDate"
  | "campaignPeriod"
  | "projectTotalFees"
  | "invoiceIssuePeriod"
  | "paymentTerm"
  | "paymentMethod"
  | "transferFee"
  | "beneficiaryAccount";

export interface SourceLocation {
  documentType: DocumentType | "SYSTEM";
  fileName: string;
  pageNumber?: number;
  paragraphIndex?: number;
  section?: string;
  sourceText: string;
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface RecognitionCandidate<T = unknown> {
  rawValue: string;
  normalizedValue: T;
  source: SourceLocation;
  confidence: number;
  qualifier?: "explicit" | "candidate";
}

export interface RecognitionField<T = unknown> {
  fieldKey: FieldKey;
  label: string;
  rawValue: string;
  normalizedValue: T | null;
  source: SourceLocation | null;
  confidence: number;
  status: RecognitionStatus;
  candidates: RecognitionCandidate<T>[];
  editedValue?: string;
}

export interface ParsedBlock {
  id: string;
  kind: "heading" | "paragraph" | "line" | "table" | "tableCell";
  text: string;
  pageNumber?: number;
  paragraphIndex?: number;
  section?: string;
  rowIndex?: number;
  columnIndex?: number;
  coordinates?: SourceLocation["coordinates"];
}

export interface ParsedDocument {
  id: string;
  fileName: string;
  fileType: "pdf" | "docx";
  documentType: DocumentType;
  pageCount?: number;
  blocks: ParsedBlock[];
  textLength: number;
  status: "parsed" | "error" | "scanned";
  errorCode?: ParseErrorCode;
  errorMessage?: string;
}

export type ParseErrorCode =
  | "EMPTY_FILE"
  | "UNSUPPORTED_TYPE"
  | "FILE_TOO_LARGE"
  | "CORRUPTED_FILE"
  | "ENCRYPTED_PDF"
  | "SCANNED_PDF"
  | "DOCX_CONTENT_MISSING"
  | "UNKNOWN";

export interface FileParseInput {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  buffer: ArrayBuffer;
}

export interface ParseProgress {
  fileId: string;
  fileName: string;
  phase: "queued" | "parsing" | "recognizing" | "complete" | "error";
  progress: number;
  message: string;
}

export interface RecognitionContext {
  systemContractNumber?: string;
  creatorAccountSnapshot?: string;
}

export interface RecognitionResult {
  documents: ParsedDocument[];
  fields: Record<FieldKey, RecognitionField>;
  recognizedAt: string;
}

export interface ContractRecord {
  id: string;
  name: string;
  ioId: string;
  advertiser: string;
  publisher: string;
  projectName: string;
  brandName: string;
  status: "待解析" | "待确认" | "需核对" | "已确认";
  updatedAt: string;
  sourceNames: string[];
  result?: RecognitionResult;
  fileRefs?: ContractFileRef[];
}

export interface ContractFileRef {
  id: string;
  name: string;
  type: "pdf" | "docx";
  objectUrl: string;
  blob?: Blob;
  documentType: DocumentType;
}

export interface WorkerParseRequest {
  type: "parse";
  files: FileParseInput[];
}

export type WorkerParseResponse =
  | {
      type: "progress";
      payload: ParseProgress;
    }
  | {
      type: "complete";
      payload: ParsedDocument[];
    }
  | {
      type: "fatal";
      payload: {
        message: string;
      };
    };
