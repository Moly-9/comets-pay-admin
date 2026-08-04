import { describe, expect, it } from 'vitest';
import {
  type CreatorId,
  type EngagementId,
  type ProjectId,
} from './businessWorkflow';
import { createPrototypeRecognitionFields } from './contractRecognitionPrototype';
import type { ParsedContractDocument } from './contractRecognitionTypes';
import { createUploadedContract } from './contracts';

const documents: ParsedContractDocument[] = [
  {
    id: 'contract-document',
    fileName: 'demo-contract.pdf',
    mimeType: 'application/pdf',
    documentType: 'STANDARD_TERMS',
    parseStatus: 'parsed',
    pageCount: 6,
    blocks: [],
  },
  {
    id: 'io-document',
    fileName: 'demo-io.pdf',
    mimeType: 'application/pdf',
    documentType: 'IO',
    parseStatus: 'parsed',
    pageCount: 2,
    blocks: [],
  },
];

const fields = createPrototypeRecognitionFields({
  documents,
  systemContractNumber: 'CON-20260804-DEMO01',
  projectName: 'Nebula Quest Creator Launch',
  brandName: 'Nebula Quest',
  creatorName: 'Mina Kato',
  creatorHandle: '@MinaKato',
  creatorPlatform: 'YouTube',
});

describe('prototype contract recognition results', () => {
  it('provides a complete detected value and source for all 14 demo fields', () => {
    expect(fields).toHaveLength(14);
    expect(fields.every((field) => (
      field.status === 'detected'
      && Boolean(field.rawValue)
      && Boolean(field.source)
      && field.candidates.length === 1
    ))).toBe(true);
    expect(fields.find((field) => field.fieldKey === 'publisher')?.rawValue).toBe('Mina Kato');
    expect(fields.find((field) => field.fieldKey === 'projectBrand')?.normalizedValue).toEqual({
      projectName: 'Nebula Quest Creator Launch',
      brandName: 'Nebula Quest',
    });
    expect(fields.find((field) => field.fieldKey === 'projectTotalFees')?.normalizedValue).toEqual({
      amount: 12500,
      currency: 'USD',
    });
    expect(fields.find((field) => field.fieldKey === 'ioNumber')?.source?.documentId).toBe('io-document');
    expect(fields.find((field) => field.fieldKey === 'contractNumber')?.source?.documentId).toBe('system-contract');
  });

  it('uses only a masked synthetic account snapshot and syncs the same fields to contract details', () => {
    const beneficiary = fields.find((field) => field.fieldKey === 'beneficiaryAccount');
    expect(beneficiary?.rawValue).toContain('Example Bank');
    expect(beneficiary?.rawValue).toContain('4826');
    expect(beneficiary?.rawValue).not.toMatch(/\d{8,}/);

    const contract = createUploadedContract({
      systemContractNumber: 'CON-20260804-DEMO01',
      projectId: 'project-demo' as ProjectId,
      projectName: 'Nebula Quest Creator Launch',
      customer: 'Nebula Quest',
      creatorId: 'creator-demo' as CreatorId,
      creatorName: 'Mina Kato',
      creatorHandle: '@MinaKato',
      creatorPlatform: 'YouTube',
      engagementId: 'engagement-demo' as EngagementId,
      recognitionResults: fields,
      sourceDocuments: documents.map((document) => ({
        ...document,
        documentUrl: `blob:${document.id}`,
      })),
    });

    expect(contract.recognitionResults).toEqual(fields);
    expect(contract.extractionStage).toBe('review');
    expect(contract.lifecycle).toBe('UPLOADED_PENDING_CONFIRMATION');
  });
});
