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
  publisher: 'Sample Creator Limited',
  publisherAddress: '1 Example Road, Sample City',
  platform: 'YouTube',
  channelName: 'Sample Studio',
  channelUrl: 'https://example.invalid/sample-studio',
  effectiveDate: '2026-08-05',
  campaignStart: '2026-08-10',
  campaignEnd: '2026-08-31',
  purposeItems: ['Introduce the synthetic campaign'],
  promotedProduct: 'Synthetic Product',
  hashtag: '#SyntheticCampaign',
  contentFormat: 'Dedicated video',
  releaseStart: '2026-08-12',
  releaseEnd: '2026-08-20',
  language: 'English',
  contentLength: 'At least 8 minutes',
  licensePeriod: '12 months',
  licensePrice: '500',
  currency: 'USD',
  totalFee: '3000',
  invoiceIssueWorkingDays: 3,
  paymentWorkingDays: 45,
  paymentMethod: 'AIRWALLEX',
  feeBearer: 'ADVERTISER',
  payoutAccountId: 'account-synthetic',
  payoutProvider: 'Airwallex',
  paymentSnapshot: {
    bankCountry: 'Sample Country',
    accountName: 'Sample Creator Limited',
    accountType: 'Business',
    swiftCode: 'SAMPXX00',
    accountNumber: '0000001234',
    iban: 'SA0000000000001234',
    beneficiaryType: 'COMPANY',
    bankName: 'Sample Bank',
    bankStreetAddress: '2 Bank Road',
    bankCity: 'Sample City',
    bankState: '',
    bankPostalCode: '000000',
    intermediaryBankCountry: '',
    intermediaryBankCode: '',
    transferRemarks: 'Synthetic test only',
    paypalUsername: '',
    paypalEmail: '',
  },
};

describe('generated contract upload workflow', () => {
  it('reuses the draft identity and keeps its generation snapshot and version', () => {
    const draft = createGeneratedContractDraft(generationModel, 3);
    expect(draft.pageCount).toBe(17);
    expect(draft.accountName).toBe('Sample Creator Limited');
    expect(draft.accountFingerprint).toBe('•••• 1234');
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
