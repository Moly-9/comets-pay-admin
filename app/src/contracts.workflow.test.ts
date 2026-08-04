import { describe, expect, it } from 'vitest';
import {
  completeGeneratedContractUpload,
  createGeneratedContractDraft,
  type ContractGenerationModel,
  type ContractUploadInput,
} from './contracts';
import type { CreatorId, EngagementId, ProjectId } from './businessWorkflow';

const projectId = 'project-test' as ProjectId;
const engagementId = 'engagement-test' as EngagementId;

const generationModel: ContractGenerationModel = {
  templateId: 'CON-TPL-2026-KOL',
  projectId,
  projectName: 'Synthetic Campaign',
  brandName: 'Synthetic Brand',
  creatorId: 'creator-test' as CreatorId,
  creatorName: 'Synthetic Creator',
  creatorHandle: '@synthetic',
  engagementId,
  contractNumber: 'CON-TEST-001',
  ioNumber: '',
  advertiser: 'Comets International Limited',
  publisher: '',
  platform: '',
  channelName: '',
  channelUrl: '',
  effectiveDate: '',
  campaignStart: '',
  campaignEnd: '',
  currency: '',
  totalFee: '',
  invoiceIssuePeriod: '',
  paymentTerm: '',
  paymentMethod: '',
  feeBearer: '',
  deliverables: '',
  additionalTerms: '',
};

describe('generated contract upload workflow', () => {
  it('reuses the draft identity and keeps its generation snapshot and version', () => {
    const draft = createGeneratedContractDraft(generationModel, 3);
    const upload: ContractUploadInput = {
      systemContractNumber: 'SHOULD-NOT-REPLACE-DRAFT',
      projectId,
      projectName: generationModel.projectName,
      customer: generationModel.brandName,
      creatorId: generationModel.creatorId,
      creatorName: generationModel.creatorName,
      creatorHandle: generationModel.creatorHandle,
      creatorPlatform: 'YouTube',
      engagementId,
      draftContractId: draft.contractId,
      recognitionResults: [],
      sourceDocuments: [{
        id: 'document-test',
        documentType: 'SIGNATURE_PAGE',
        fileName: 'synthetic-signed-contract.pdf',
        mimeType: 'application/pdf',
        parseStatus: 'parsed',
        pageCount: 1,
        blocks: [{
          id: 'block-test',
          pageNumber: 1,
          section: 'Signature',
          text: 'Synthetic signed contract',
          items: [],
          kind: 'paragraph',
        }],
        documentUrl: 'blob:synthetic-contract',
      }],
    };

    const uploaded = completeGeneratedContractUpload(draft, upload);

    expect(uploaded.contractId).toBe(draft.contractId);
    expect(uploaded.id).toBe(draft.id);
    expect(uploaded.engagementId).toBe(engagementId);
    expect(uploaded.lifecycle).toBe('UPLOADED_PENDING_CONFIRMATION');
    expect(uploaded.generationVersion).toBe(3);
    expect(uploaded.generationSnapshot).toEqual(generationModel);
    expect(uploaded.uploadedFromDraftId).toBe(draft.contractId);
    expect(uploaded.sourceName).toBe('synthetic-signed-contract.pdf');
  });
});
