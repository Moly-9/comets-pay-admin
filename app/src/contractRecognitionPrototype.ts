import {
  CONTRACT_FIELD_LABELS,
  type ContractDocumentType,
  type ContractFieldKey,
  type ContractRecognitionField,
  type ContractSourceLocation,
  type ContractUploadDocumentType,
  type ParsedContractDocument,
} from './contractRecognitionTypes';

export type PrototypeRecognitionContext = {
  documents: ParsedContractDocument[];
  systemContractNumber: string;
  projectName: string;
  brandName: string;
  creatorName: string;
  creatorHandle: string;
  creatorPlatform: string;
};

type PrototypeFieldDefinition = {
  fieldKey: ContractFieldKey;
  rawValue: string;
  normalizedValue: unknown;
  preferredDocumentType: ContractUploadDocumentType;
  pageNumber: number;
  section: string;
  sourceText: string;
};

const profileUrl = (platform: string, handle: string) => {
  const account = handle.replace(/^@/, '');
  if (/youtube/i.test(platform)) return `https://www.youtube.com/@${account}`;
  if (/tiktok/i.test(platform)) return `https://www.tiktok.com/@${account}`;
  return `https://www.instagram.com/${account}/`;
};

const documentSource = (
  document: ParsedContractDocument,
  definition: PrototypeFieldDefinition,
): ContractSourceLocation => ({
  documentId: document.id,
  documentType: document.documentType,
  fileName: document.fileName,
  pageNumber: document.pageCount
    ? Math.min(definition.pageNumber, document.pageCount)
    : null,
  section: definition.section,
  sourceText: definition.sourceText,
  blockId: `prototype-${document.id}-${definition.fieldKey}`,
});

const systemSource = (systemContractNumber: string): ContractSourceLocation => ({
  documentId: 'system-contract',
  documentType: 'OTHER' as ContractDocumentType,
  fileName: '系统合同资料',
  pageNumber: null,
  section: '系统字段',
  sourceText: `Contract Number: ${systemContractNumber}`,
  blockId: 'system-contract-number',
});

export const createPrototypeRecognitionFields = ({
  documents,
  systemContractNumber,
  projectName,
  brandName,
  creatorName,
  creatorHandle,
  creatorPlatform,
}: PrototypeRecognitionContext): ContractRecognitionField[] => {
  if (!documents.length) return [];

  const channelUrl = profileUrl(creatorPlatform, creatorHandle);
  const definitions: PrototypeFieldDefinition[] = [
    {
      fieldKey: 'advertiser',
      rawValue: 'COMETS INTERNATIONAL LIMITED',
      normalizedValue: 'COMETS INTERNATIONAL LIMITED',
      preferredDocumentType: 'STANDARD_TERMS',
      pageNumber: 1,
      section: 'Contract Parties',
      sourceText: 'Advertiser: COMETS INTERNATIONAL LIMITED',
    },
    {
      fieldKey: 'publisher',
      rawValue: creatorName,
      normalizedValue: creatorName,
      preferredDocumentType: 'STANDARD_TERMS',
      pageNumber: 1,
      section: 'Contract Parties',
      sourceText: `Publisher: ${creatorName}`,
    },
    {
      fieldKey: 'contractNumber',
      rawValue: systemContractNumber,
      normalizedValue: systemContractNumber,
      preferredDocumentType: 'STANDARD_TERMS',
      pageNumber: 1,
      section: '系统字段',
      sourceText: `Contract Number: ${systemContractNumber}`,
    },
    {
      fieldKey: 'ioNumber',
      rawValue: 'IO-2026-DEMO-0821',
      normalizedValue: 'IO-2026-DEMO-0821',
      preferredDocumentType: 'IO',
      pageNumber: 1,
      section: 'Campaign Details',
      sourceText: 'IO Number: IO-2026-DEMO-0821',
    },
    {
      fieldKey: 'projectBrand',
      rawValue: `${projectName} · ${brandName}`,
      normalizedValue: { projectName, brandName },
      preferredDocumentType: 'IO',
      pageNumber: 1,
      section: 'Campaign Details',
      sourceText: `Project Name: ${projectName} | Brand: ${brandName}`,
    },
    {
      fieldKey: 'platformChannel',
      rawValue: `${creatorPlatform} · ${creatorHandle}`,
      normalizedValue: {
        platform: creatorPlatform,
        channelName: creatorHandle,
        handle: creatorHandle,
        channelUrl,
      },
      preferredDocumentType: 'IO',
      pageNumber: 2,
      section: 'Publishing Details',
      sourceText: `Publishing Platform: ${creatorPlatform} | Channel: ${creatorHandle} | Channel Link: ${channelUrl}`,
    },
    {
      fieldKey: 'effectiveDate',
      rawValue: 'August 8, 2026',
      normalizedValue: { date: '2026-08-08', basis: 'effective-date' },
      preferredDocumentType: 'STANDARD_TERMS',
      pageNumber: 1,
      section: 'Effective Date',
      sourceText: 'Effective Date: August 8, 2026',
    },
    {
      fieldKey: 'campaignPeriod',
      rawValue: 'August 10, 2026 to September 10, 2026',
      normalizedValue: { startDate: '2026-08-10', endDate: '2026-09-10' },
      preferredDocumentType: 'IO',
      pageNumber: 1,
      section: 'Campaign Details',
      sourceText: 'Campaign Period: August 10, 2026 to September 10, 2026',
    },
    {
      fieldKey: 'projectTotalFees',
      rawValue: 'USD 12,500',
      normalizedValue: { amount: 12500, currency: 'USD' },
      preferredDocumentType: 'IO',
      pageNumber: 2,
      section: 'Project Total Fees',
      sourceText: 'Project Total Fees: USD 12,500',
    },
    {
      fieldKey: 'invoiceIssuePeriod',
      rawValue: 'Within 5 working days after campaign completion',
      normalizedValue: {
        raw: 'Within 5 working days after campaign completion',
        normalizedDays: 5,
        normalizedDate: null,
      },
      preferredDocumentType: 'STANDARD_TERMS',
      pageNumber: 4,
      section: 'Payment Terms',
      sourceText: 'Invoice Issue Period: Within 5 working days after campaign completion',
    },
    {
      fieldKey: 'paymentTerm',
      rawValue: 'Net 30 working days after receipt of a valid Invoice',
      normalizedValue: {
        raw: 'Net 30 working days after receipt of a valid Invoice',
        normalizedDays: 30,
      },
      preferredDocumentType: 'STANDARD_TERMS',
      pageNumber: 4,
      section: 'Payment Terms',
      sourceText: 'Payment Term: Net 30 working days after receipt of a valid Invoice',
    },
    {
      fieldKey: 'paymentMethod',
      rawValue: 'Bank Transfer',
      normalizedValue: 'BANK_TRANSFER',
      preferredDocumentType: 'STANDARD_TERMS',
      pageNumber: 5,
      section: 'Remittance Information',
      sourceText: 'Payment Method: Bank Transfer',
    },
    {
      fieldKey: 'transferFee',
      rawValue: 'All transfer fees shall be borne by Advertiser',
      normalizedValue: 'ADVERTISER',
      preferredDocumentType: 'STANDARD_TERMS',
      pageNumber: 5,
      section: 'Remittance Information',
      sourceText: 'Transfer Fee: All transfer fees shall be borne by Advertiser',
    },
    {
      fieldKey: 'beneficiaryAccount',
      rawValue: `${creatorName} Studio · Example Bank · 账户尾号 4826`,
      normalizedValue: `${creatorName} Studio · Example Bank · 账户尾号 4826`,
      preferredDocumentType: 'STANDARD_TERMS',
      pageNumber: 5,
      section: 'Remittance Information',
      sourceText: `Beneficiary: ${creatorName} Studio | Bank: Example Bank | Account ending: 4826`,
    },
  ];

  return definitions.map((definition) => {
    const source = definition.fieldKey === 'contractNumber'
      ? systemSource(systemContractNumber)
      : documentSource(
          documents.find((document) => document.documentType === definition.preferredDocumentType)
            ?? documents[0],
          definition,
        );
    const confidence = 0.96;
    return {
      fieldKey: definition.fieldKey,
      label: CONTRACT_FIELD_LABELS[definition.fieldKey],
      rawValue: definition.rawValue,
      normalizedValue: definition.normalizedValue,
      source,
      confidence,
      status: 'detected',
      candidates: [{
        rawValue: definition.rawValue,
        normalizedValue: definition.normalizedValue,
        source,
        confidence,
      }],
    };
  });
};
