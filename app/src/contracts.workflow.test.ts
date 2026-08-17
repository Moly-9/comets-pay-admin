import { describe, expect, it } from 'vitest';
import {
  completeGeneratedContractUpload,
  createGeneratedContractDraft,
  createUploadedContract,
  frameworkIoContracts,
  getContractReadiness,
  isPaymentContract,
  applyConfirmedRecognitionToContract,
  type ContractGenerationModel,
  type ContractRecord,
  type ContractUploadInput,
} from './contracts';
import type { ContractId, CreatorId, EngagementId, ProjectId } from './businessWorkflow';
import type { ContractFieldKey, ContractRecognitionField } from './contractRecognitionTypes';

const projectId = 'project-test' as ProjectId;
const engagementId = 'engagement-test' as EngagementId;

const generationModel: ContractGenerationModel = {
  templateId: 'CON-TPL-2026-KOL',
  contractName: 'Synthetic Creator-Synthetic Campaign',
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
  publishingChannels: [{
    socialAccountId: 'social-youtube',
    platform: 'YouTube',
    channelUrl: 'https://example.invalid/sample-studio',
  }],
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
  it('keeps the contract identity when the same collaboration draft is regenerated', () => {
    const initialDraft = createGeneratedContractDraft(generationModel, 1);
    const updatedDraft = createGeneratedContractDraft(
      { ...generationModel, totalFee: '3600' },
      2,
      'blob:synthetic-contract-v2',
      { existingContractId: initialDraft.contractId },
    );

    expect(updatedDraft.contractId).toBe(initialDraft.contractId);
    expect(updatedDraft.engagementId).toBe(initialDraft.engagementId);
    expect(updatedDraft.generationVersion).toBe(2);
    expect(updatedDraft.totalFee).toBe(3600);
    expect(updatedDraft.name).toBe(generationModel.contractName);
    expect(updatedDraft.documentUrl).toBe('blob:synthetic-contract-v2');
  });

  it('reuses the draft identity and keeps its generation snapshot and version', () => {
    const draft = createGeneratedContractDraft(generationModel, 3);
    expect(draft.pageCount).toBe(17);
    expect(draft.accountName).toBe('Sample Creator Limited');
    expect(draft.accountFingerprint).toBe('•••• 1234');
    const upload: ContractUploadInput = {
      systemContractNumber: 'SHOULD-NOT-REPLACE-DRAFT',
      contractName: '回传后更新的合同名称',
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

    const uploaded = completeGeneratedContractUpload(draft, upload, 'media.contract.owner');

    expect(uploaded.contractId).toBe(draft.contractId);
    expect(uploaded.id).toBe(draft.id);
    expect(uploaded.engagementId).toBe(engagementId);
    expect(uploaded.lifecycle).toBe('UPLOADED_PENDING_CONFIRMATION');
    expect(uploaded.generationVersion).toBe(3);
    expect(uploaded.generationSnapshot).toEqual(generationModel);
    expect(uploaded.uploadedFromDraftId).toBe(draft.contractId);
    expect(uploaded.uploadedByAccount).toBe('media.contract.owner');
    expect(uploaded.sourceName).toBe('synthetic-signed-contract.pdf');
    expect(uploaded.name).toBe('回传后更新的合同名称');
    expect(uploaded.currency).toBe(draft.currency);
    expect(uploaded.totalFee).toBe(draft.totalFee);
    expect(uploaded.invoiceWithinWorkingDays).toBe(draft.invoiceWithinWorkingDays);
    expect(uploaded.paymentWithinWorkingDays).toBe(draft.paymentWithinWorkingDays);
    expect(uploaded.paymentMethod).toBe(draft.paymentMethod);
    expect(uploaded.feeBearer).toBe(draft.feeBearer);
    expect(uploaded.paymentSnapshot).toEqual(draft.paymentSnapshot);
  });

  it('treats a confirmed framework contract without financial fields as a resource, not a payment contract', () => {
    const framework = {
      ...createUploadedContract({
        systemContractNumber: 'CON-FRAMEWORK-001',
        contractType: 'FRAMEWORK',
        projectId,
        projectName: generationModel.projectName,
        customer: generationModel.brandName,
        creatorId: generationModel.creatorId,
        creatorName: generationModel.creatorName,
        creatorHandle: generationModel.creatorHandle,
        creatorPlatform: generationModel.platform,
        engagementId,
        recognitionResults: [],
        sourceDocuments: [],
      }),
      publisher: generationModel.publisher,
      lifecycle: 'CONFIRMED' as const,
      signed: true,
      issues: [],
    } satisfies ContractRecord;

    expect(framework.totalFee).toBeNull();
    expect(framework.currency).toBe('');
    expect(getContractReadiness(framework).ready).toBe(true);
    expect(getContractReadiness(framework).label).toBe('可作为框架资源');
    expect(isPaymentContract(framework)).toBe(false);
  });

  it('supports several IO records sharing one framework contract', () => {
    const frameworkId = 'contract-framework-parent' as ContractId;
    const framework = {
      ...({ id: 'CON-FRAMEWORK', contractId: frameworkId, contractType: 'FRAMEWORK' } as ContractRecord),
    };
    const ioOne = {
      ...({ id: 'CON-IO-001', contractId: 'contract-io-001' as ContractId, contractType: 'IO', frameworkContractId: frameworkId } as ContractRecord),
    };
    const ioTwo = {
      ...({ id: 'CON-IO-002', contractId: 'contract-io-002' as ContractId, contractType: 'IO', frameworkContractId: frameworkId } as ContractRecord),
    };

    expect(frameworkIoContracts(framework, [framework, ioOne, ioTwo])).toEqual([ioOne, ioTwo]);
  });

  it('applies only applicable recognition fields for framework contracts', () => {
    const source = {
      documentId: 'framework-document',
      documentType: 'STANDARD_TERMS' as const,
      fileName: 'framework.pdf',
      pageNumber: 1,
      section: 'Terms',
      sourceText: 'Synthetic framework contract',
      blockId: 'framework-block',
    };
    const field = (
      fieldKey: ContractFieldKey,
      rawValue: string,
      normalizedValue: unknown = rawValue,
    ): ContractRecognitionField => ({
      fieldKey,
      label: fieldKey,
      rawValue,
      normalizedValue,
      source,
      confidence: 1,
      status: 'confirmed',
      candidates: [],
    });
    const framework = {
      ...createUploadedContract({
        systemContractNumber: 'CON-FRAMEWORK-002',
        contractType: 'FRAMEWORK',
        projectId,
        projectName: generationModel.projectName,
        customer: generationModel.brandName,
        creatorId: generationModel.creatorId,
        creatorName: generationModel.creatorName,
        creatorHandle: generationModel.creatorHandle,
        creatorPlatform: generationModel.platform,
        engagementId,
        recognitionResults: [],
        sourceDocuments: [],
      }),
      project: 'Keep this project',
      platform: 'Keep this platform',
      lifecycle: 'UPLOADED_PENDING_CONFIRMATION' as const,
      recognitionResults: [
        field('advertiser', generationModel.advertiser),
        field('publisher', generationModel.publisher),
        field('contractNumber', 'CON-FRAMEWORK-002'),
        field('effectiveDate', '2026-08-05', { date: '2026-08-05' }),
        field('campaignPeriod', '2026-08-10 至 2026-08-31', { startDate: '2026-08-10', endDate: '2026-08-31' }),
        field('transferFee', 'Advertiser', 'ADVERTISER'),
        field('beneficiaryAccount', 'Sample Creator Limited'),
      ],
    } satisfies ContractRecord;

    const applied = applyConfirmedRecognitionToContract(framework, [
      'advertiser',
      'publisher',
      'contractNumber',
      'effectiveDate',
      'campaignPeriod',
      'transferFee',
      'beneficiaryAccount',
    ]);

    expect(applied?.lifecycle).toBe('CONFIRMED');
    expect(applied?.feeBearer).toBe('ADVERTISER');
    expect(applied?.project).toBe('Keep this project');
    expect(applied?.platform).toBe('Keep this platform');
    expect(applied?.totalFee).toBeNull();
    expect(applied?.currency).toBe('');
  });
});
