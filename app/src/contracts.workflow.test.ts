import { describe, expect, it } from 'vitest';
import {
  completeGeneratedContractUpload,
  completeContractSignature,
  contractLinkedToProject,
  contractProjectLinksFor,
  contractProjectIds,
  createEditingContractDraft,
  createGeneratedContractDraft,
  createUploadedContract,
  frameworkIoContracts,
  getContractReadiness,
  isPaymentContract,
  projectConfirmedRecognitionDraft,
  sendContractForSignature,
  applyConfirmedRecognitionToContract,
  type ContractGenerationModel,
  type ContractRecord,
  type ContractSignatureRequest,
  type ContractUploadInput,
} from './contracts';
import {
  createContractSignatureRequest,
  sendContractSignatureRequest,
  simulateDocuSignContractSend,
} from './contractSignature';
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
  it('saves incomplete form data as an editing draft without generating files', () => {
    const incomplete = {
      ...generationModel,
      contractName: '',
      projectId: '' as ProjectId,
      projectName: '',
      creatorId: '' as CreatorId,
      creatorName: '',
      publisher: '',
      payoutAccountId: '',
    };

    const draft = createEditingContractDraft(incomplete, null, 'media.contract.owner');

    expect(draft.lifecycle).toBe('EDITING_DRAFT');
    expect(draft.name).toBe('未命名合同草稿');
    expect(draft.documentUrl).toBe('');
    expect(draft.sourceName).toBe('合同文件尚未生成');
    expect(draft.pageCount).toBeUndefined();
    expect(draft.generationVariant).toBeUndefined();
    expect(draft.generatedFileBaseName).toBeUndefined();
    expect(draft.generationSnapshot).toMatchObject({
      projectName: '',
      creatorName: '',
      payoutAccountId: '',
    });
  });

  it('updates one editing draft in place and upgrades the same identity after generation', () => {
    const initial = createEditingContractDraft(generationModel, null, 'media.contract.owner');
    const updatedModel = {
      ...generationModel,
      contractName: 'Updated synthetic contract',
      totalFee: '3600',
    };
    const updated = createEditingContractDraft(updatedModel, initial, 'media.contract.owner');
    const generated = createGeneratedContractDraft(updatedModel, 1, 'blob:generated-contract', {
      existingContractId: updated.contractId,
      generationVariant: 'FORMAL',
      uploadedByAccount: 'media.contract.owner',
    });

    expect(updated.contractId).toBe(initial.contractId);
    expect(updated.id).toBe(initial.id);
    expect(updated.name).toBe('Updated synthetic contract');
    expect(updated.lifecycle).toBe('EDITING_DRAFT');
    expect(generated.contractId).toBe(initial.contractId);
    expect(generated.id).toBe(initial.id);
    expect(generated.lifecycle).toBe('GENERATED_DRAFT');
    expect(generated.totalFee).toBe(3600);
    expect(generated.documentUrl).toBe('blob:generated-contract');
  });

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

  it('allows a confirmed framework contract without fixed financial fields to support payment requests', () => {
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
    expect(getContractReadiness(framework).label).toBe('可用于付款项目');
    expect(isPaymentContract(framework)).toBe(true);
  });

  it('blocks an unsigned confirmed contract even when legacy data has no signature issue', () => {
    const unsigned = {
      ...createGeneratedContractDraft(generationModel, 1),
      lifecycle: 'CONFIRMED' as const,
      signed: false,
      status: '已生效' as const,
      issues: [],
    } satisfies ContractRecord;

    const readiness = getContractReadiness(unsigned);

    expect(readiness.ready).toBe(false);
    expect(readiness.blockerCount).toBe(1);
    expect(readiness.label).toBe('1 项待处理');
    expect(isPaymentContract(unsigned)).toBe(false);
  });

  it('does not retain a stale signature issue after signature is confirmed', () => {
    const signed = {
      ...createGeneratedContractDraft(generationModel, 1),
      lifecycle: 'CONFIRMED' as const,
      signed: true,
      status: '已生效' as const,
      issues: [{
        id: 'signature' as const,
        label: '合同尚未完成签署',
        description: '历史签署提示',
        severity: 'blocker' as const,
        source: '签署页',
      }],
    } satisfies ContractRecord;

    const readiness = getContractReadiness(signed);

    expect(readiness.ready).toBe(true);
    expect(readiness.blockerCount).toBe(0);
    expect(readiness.label).toBe('可用于付款项目');
  });

  it('normalizes active project coverage from new and legacy contract fields', () => {
    const linkedProject = 'project-linked' as ProjectId;
    const endedProject = 'project-ended' as ProjectId;
    const contract = {
      cooperationProjectId: projectId,
      projectLinks: [
        { cooperationProjectId: linkedProject, status: 'ACTIVE' as const },
        { cooperationProjectId: endedProject, status: 'ENDED' as const },
      ],
    };

    expect(contractProjectIds(contract)).toEqual([linkedProject, projectId]);
    expect(contractLinkedToProject(contract, linkedProject)).toBe(true);
    expect(contractLinkedToProject(contract, projectId)).toBe(true);
    expect(contractLinkedToProject(contract, endedProject)).toBe(false);
    expect(contractProjectIds({
      projectId,
      frameworkProjectLinks: [{ cooperationProjectId: linkedProject, status: 'ACTIVE' }],
    })).toEqual([linkedProject, projectId]);
    expect(contractProjectLinksFor({
      projectId,
      frameworkProjectLinks: [{ cooperationProjectId: linkedProject, status: 'ACTIVE' }],
      projectLinks: [{ cooperationProjectId: linkedProject, status: 'ENDED' }],
    })).toEqual([{ cooperationProjectId: linkedProject, status: 'ENDED' }]);
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

  it('keeps an IO contract usable when it has no framework contract', () => {
    const independentIo = {
      ...createUploadedContract({
        systemContractNumber: 'CON-IO-INDEPENDENT-001',
        contractType: 'IO',
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
      currency: 'USD',
      totalFee: 1200,
      paymentWithinWorkingDays: 45,
      paymentMethod: 'BANK' as const,
      feeBearer: 'ADVERTISER' as const,
      lifecycle: 'CONFIRMED' as const,
      signed: true,
      issues: [],
    } satisfies ContractRecord;

    expect(independentIo.frameworkContractId).toBeUndefined();
    expect(isPaymentContract(independentIo)).toBe(true);
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
        field('signatureStatus', '已签署', { signed: true }),
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
      'signatureStatus',
      'transferFee',
      'beneficiaryAccount',
    ]);

    expect(applied?.lifecycle).toBe('CONFIRMED');
    expect(applied?.signed).toBe(true);
    expect(applied?.campaignStart).toBe('2026-08-10');
    expect(applied?.campaignEnd).toBe('2026-08-31');
    expect(applied?.feeBearer).toBe('ADVERTISER');
    expect(applied?.project).toBe('Keep this project');
    expect(applied?.platform).toBe('Keep this platform');
    expect(applied?.totalFee).toBeNull();
    expect(applied?.currency).toBe('');
  });

  it('requires a separate send step before a creator can complete signing', () => {
    const recognized = {
      ...createGeneratedContractDraft(generationModel),
      lifecycle: 'RECOGNITION_CONFIRMED' as const,
      extractionStage: 'applied' as const,
      signed: false,
      issues: [{
        id: 'signature',
        label: '合同待发送达人签署',
        description: '待发送',
        severity: 'blocker' as const,
        source: '达人签署',
      }],
    };

    expect(completeContractSignature(recognized, '2026-09-09T10:00:00.000Z')).toBeNull();
    const sent = sendContractForSignature(recognized, '2026-09-09T10:00:00.000Z');
    expect(sent).toMatchObject({
      lifecycle: 'SENT_FOR_SIGNATURE',
      signed: false,
      sentForSignatureAt: '2026-09-09T10:00:00.000Z',
    });

    const completed = completeContractSignature(sent!, '2026-09-10T11:00:00.000Z');
    expect(completed).toMatchObject({
      lifecycle: 'CONFIRMED',
      signed: true,
      signedAt: '2026-09-10T11:00:00.000Z',
      confirmedAt: '2026-09-10T11:00:00.000Z',
    });
    expect(completed?.issues.some((issue) => issue.id === 'signature')).toBe(false);
    expect(isPaymentContract(completed!)).toBe(true);
  });

  it('sends a confirmed unsigned recognition draft and auto-applies it after signing', async () => {
    const source = {
      documentId: 'unsigned-upload-document',
      documentType: 'STANDARD_TERMS' as const,
      fileName: 'unsigned-upload.pdf',
      pageNumber: 1,
      section: 'Contract',
      sourceText: 'Synthetic unsigned contract',
      blockId: 'unsigned-upload-block',
    };
    const confirmedField = (
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
    const recognitionResults = [
      confirmedField('advertiser', 'Draft Advertiser Limited'),
      confirmedField('publisher', 'Draft Publisher Limited'),
      confirmedField('projectTotalFees', 'USD 4,200', { amount: 4200, currency: 'USD' }),
      confirmedField('contractExpiry', '2026-09-01 至 2026-12-31', {
        startDate: '2026-09-01',
        endDate: '2026-12-31',
        isLongTerm: false,
      }),
      confirmedField('transferFee', 'Advertiser', 'ADVERTISER'),
      confirmedField('signatureStatus', '未签署', { signed: false }),
    ];
    const requiredKeys = recognitionResults.map((field) => field.fieldKey);
    const uploaded = {
      ...createGeneratedContractDraft(generationModel, 1, 'blob:unsigned-upload'),
      lifecycle: 'UPLOADED_PENDING_CONFIRMATION' as const,
      extractionStage: 'confirmed' as const,
      recognitionResults,
      advertiser: 'Formal value must stay frozen before signing',
      signed: false,
      issues: [
        { id: 'recognition-review', label: '待确认', description: '待确认', severity: 'blocker' as const, source: '识别' },
        { id: 'signature', label: '待签署', description: '待签署', severity: 'blocker' as const, source: '签署' },
      ],
    } satisfies ContractRecord;
    const projection = projectConfirmedRecognitionDraft(uploaded, requiredKeys);
    expect(projection).toMatchObject({
      advertiser: 'Draft Advertiser Limited',
      publisher: 'Draft Publisher Limited',
      totalFee: 4200,
      signed: false,
    });
    const request = createContractSignatureRequest(projection!, {
      creatorDisplayName: generationModel.creatorName,
      amount: 'USD 4,200',
      signerName: 'Draft Publisher Limited',
      requestedAt: '2026-09-09T10:00:00.000Z',
      paymentInformation: {
        source: 'frozen-payout-account',
        channel: 'Airwallex',
        fields: [{ label: 'Account Name', value: 'Sample Creator Limited' }],
      },
    });
    const result = await sendContractSignatureRequest(request, simulateDocuSignContractSend);
    if (!result.ok) throw new Error(result.error);

    const sent = sendContractForSignature(uploaded, request, result);
    expect(sent).toMatchObject({
      lifecycle: 'SENT_FOR_SIGNATURE',
      extractionStage: 'confirmed',
      advertiser: 'Formal value must stay frozen before signing',
      signatureRequestSnapshot: {
        advertiser: 'Draft Advertiser Limited',
        publisher: 'Draft Publisher Limited',
        signerName: 'Draft Publisher Limited',
      },
    });

    const completed = completeContractSignature(
      sent!,
      '2026-09-10T11:00:00.000Z',
      requiredKeys,
    );
    expect(completed).toMatchObject({
      lifecycle: 'CONFIRMED',
      extractionStage: 'applied',
      advertiser: 'Draft Advertiser Limited',
      publisher: 'Draft Publisher Limited',
      campaignStart: '2026-09-01',
      campaignEnd: '2026-12-31',
      isLongTerm: false,
      totalFee: 4200,
      signed: true,
      signedBy: 'Draft Publisher Limited',
      signedAt: '2026-09-10T11:00:00.000Z',
      confirmedAt: '2026-09-10T11:00:00.000Z',
    });
    expect(completed?.recognitionResults?.find((field) => field.fieldKey === 'signatureStatus')).toMatchObject({
      rawValue: '已签署',
      normalizedValue: {
        signed: true,
        signedAt: '2026-09-10T11:00:00.000Z',
        signerName: 'Draft Publisher Limited',
      },
      status: 'confirmed',
    });
    expect(completed?.issues.some((issue) => issue.id === 'signature' || issue.id === 'recognition-review')).toBe(false);
  });

  it('freezes the confirmed fields and document reference after a simulated DocuSign send', async () => {
    const recognized = {
      ...createGeneratedContractDraft(generationModel, 1, 'blob:generated-contract'),
      lifecycle: 'RECOGNITION_CONFIRMED' as const,
      extractionStage: 'applied' as const,
      signed: false,
      issues: [{
        id: 'signature',
        label: '合同待发送达人签署',
        description: '待发送',
        severity: 'blocker' as const,
        source: '达人签署',
      }],
    };
    const request: ContractSignatureRequest = createContractSignatureRequest(recognized, {
      creatorDisplayName: generationModel.creatorName,
      amount: 'USD 3,000',
      signerName: generationModel.publisher,
      requestedAt: '2026-09-09T10:00:00.000Z',
      paymentInformation: {
        source: 'frozen-payout-account',
        channel: 'Airwallex',
        fields: [{ label: 'Account Name', value: 'Sample Creator Limited' }],
      },
    });
    const result = await sendContractSignatureRequest(request, simulateDocuSignContractSend);

    expect(result).toMatchObject({ ok: true, sentAt: request.requestedAt });
    if (!result.ok) throw new Error(result.error);
    const sent = sendContractForSignature(recognized, request, result);
    expect(sent).toMatchObject({
      lifecycle: 'SENT_FOR_SIGNATURE',
      signatureEnvelopeId: result.envelopeId,
      signatureRequestSnapshot: {
        contractId: recognized.contractId,
        creatorId: generationModel.creatorId,
        signerName: generationModel.publisher,
        documentReference: {
          fileName: recognized.sourceName,
          documentUrl: 'blob:generated-contract',
        },
      },
    });
    const completed = completeContractSignature(sent!, '2026-09-10T11:00:00.000Z');
    expect(completed?.signedBy).toBe(generationModel.publisher);
  });

  it('keeps the contract unchanged when the signature adapter rejects the request', async () => {
    const request = createContractSignatureRequest(
      createGeneratedContractDraft(generationModel, 1, 'blob:generated-contract'),
      {
        creatorDisplayName: generationModel.creatorName,
        amount: 'USD 3,000',
        signerName: generationModel.publisher,
        requestedAt: '2026-09-09T10:00:00.000Z',
        paymentInformation: {
          source: 'frozen-payout-account',
          channel: 'Airwallex',
          fields: [],
        },
      },
    );
    const result = await sendContractSignatureRequest(request, async () => ({
      ok: false,
      error: '模拟发送失败',
    }));

    expect(result).toEqual({ ok: false, error: '模拟发送失败' });
  });
});
