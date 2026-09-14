import { describe, expect, it } from 'vitest';
import type { ContractId, CreatorId, EngagementId, ProjectId } from '../businessWorkflow';
import type { ContractRecord } from '../contracts';
import type { CreatorProfile, InvoiceEntity } from '../types';
import { createDocumentPayoutSnapshot } from '../payoutAccounts';
import {
  EXTERNAL_INVOICE_REVIEW_FIELD_ORDER,
  buildApprovedExternalInvoice,
  confirmExternalInvoiceSignature,
  correctExternalInvoiceRecognition,
  createExternalInvoiceCollection,
  currentExternalInvoiceSignatureConfirmation,
  currentExternalInvoiceConfirmation,
  currentExternalInvoiceFieldReview,
  currentExternalInvoiceRecognition,
  externalInvoiceListStatus,
  externalInvoicePageTab,
  externalInvoiceReviewReadiness,
  externalInvoiceValidationIssues,
  evaluateExternalInvoiceContractMatch,
  publishExternalInvoiceCollection,
  reviewExternalInvoiceField,
  returnExternalInvoice,
  saveExternalInvoiceContractMatchReview,
  simulateExternalInvoiceUpload,
  submitExternalInvoiceForReview,
} from './externalInvoiceCollection';

const creatorId = 'creator-external-1' as CreatorId;
const creator: CreatorProfile = {
  id: creatorId,
  initials: 'AL',
  accent: '#8d6a8b',
  name: 'Alicia Lin',
  handle: '@alicia',
  region: 'US',
  platform: 'YouTube',
  projects: 1,
  socialAccounts: [{ id: 'social-1', platform: 'YouTube', handle: '@alicia', profileUrl: 'https://example.com/alicia' }],
  contact: { legalName: 'Alicia Lin LLC', address: '1 Market Street', phone: '000', email: 'alicia@example.com' },
  payoutAccounts: [{
    id: 'paypal-alicia',
    creatorId,
    payoutAccountId: 'payout-account-alicia',
    payoutAccountVersion: 'v1',
    accountFingerprint: 'fp-alicia',
    provider: 'PayPal',
    nickname: 'Primary PayPal',
    isDefault: true,
    status: 'VERIFIED',
    paypalUsername: 'Alicia Payout Account',
    paypalEmail: 'alicia@example.com',
  }],
};

const actor = { account: 'media.demo', name: 'Media Reviewer', role: '媒介' };
const creatorActor = { account: 'creator.demo', name: 'Alicia Lin', role: '达人账号' };
const invoiceEntity: InvoiceEntity = { name: 'Comets Global Ltd.', address: 'Hong Kong' };
const presetPayoutAccountId = 'payout-account-alicia';
const primaryPayoutAccount = creator.payoutAccounts[0];

const contract = (overrides: Partial<ContractRecord> = {}): ContractRecord => ({
  contractId: 'contract-external-1' as ContractId,
  id: 'CON-EXTERNAL-1',
  contractType: 'INDEPENDENT',
  ioId: '',
  name: 'External creator services',
  templateFamily: '',
  sourceName: '',
  documentUrl: '',
  isTemplate: false,
  project: 'Global Creator Campaign',
  brand: 'Prototype brand',
  advertiser: invoiceEntity.name,
  publisher: creator.contact.legalName,
  channelName: creator.handle,
  channelLink: '',
  platform: creator.platform,
  effectiveDate: '2026-08-01',
  campaignStart: '2026-08-01',
  campaignEnd: '2026-08-31',
  currency: 'USD',
  totalFee: 4800,
  licensePrice: null,
  licenseIncludedInTotal: null,
  invoiceWithinWorkingDays: null,
  paymentWithinWorkingDays: null,
  feeBearer: 'ADVERTISER',
  paymentMethod: 'PAYPAL',
  accountName: primaryPayoutAccount.provider === 'PayPal'
    ? primaryPayoutAccount.paypalUsername
    : primaryPayoutAccount.nickname,
  accountFingerprint: 'fp-alicia',
  payoutAccountId: presetPayoutAccountId,
  payoutAccountVersion: 'v1',
  payoutProvider: 'PayPal',
  payoutAccountFingerprint: 'fp-alicia',
  paymentSnapshot: createDocumentPayoutSnapshot(primaryPayoutAccount, creatorId),
  signed: true,
  status: '已生效',
  updated: '2026-08-20',
  deliverables: [],
  issues: [],
  lifecycle: 'CONFIRMED',
  ...overrides,
});

const createRecord = (publish = true) => createExternalInvoiceCollection({
  projectId: 'project-external-1' as ProjectId,
  projectName: 'Global Creator Campaign',
  engagementId: 'engagement-external-1' as EngagementId,
  creatorId,
  creatorName: creator.name,
  creatorLegalName: creator.contact.legalName,
  creatorHandle: creator.handle,
  contractIds: [],
  expected: {
    amount: 4800,
    currency: 'USD',
    billTo: invoiceEntity,
    description: 'Creator production service',
    dueDate: '2026-09-05',
  },
  actor,
  publish,
  occurredAt: '2026-08-20T01:00:00.000Z',
});

const createRecordWithContract = (
  selectedContract: ContractRecord,
  contractMatchReason?: string,
) => createExternalInvoiceCollection({
  projectId: 'project-external-1' as ProjectId,
  projectName: 'Global Creator Campaign',
  engagementId: 'engagement-external-1' as EngagementId,
  creatorId,
  creatorName: creator.name,
  creatorLegalName: creator.contact.legalName,
  creatorHandle: creator.handle,
  contractIds: [selectedContract.contractId!],
  contractMatchReason,
  expected: {
    amount: 4800,
    currency: 'USD',
    billTo: invoiceEntity,
    description: 'Creator production service',
    dueDate: '2026-09-05',
  },
  actor,
  creator,
  contracts: [selectedContract],
  publish: true,
  occurredAt: '2026-08-20T01:00:00.000Z',
});

const upload = (scenario: 'NORMAL' | 'OCR_ERROR' | 'SOURCE_FILE_ERROR' | 'ACCOUNT_MISMATCH' = 'NORMAL') => (
  simulateExternalInvoiceUpload({
    record: createRecord(),
    creator,
    payoutAccountId: 'payout-account-alicia',
    scenario,
    actor: creatorActor,
    invoiceDate: '2026-08-20',
    occurredAt: '2026-08-20T02:00:00.000Z',
  })
);

describe('external Invoice collection workflow', () => {
  it('keeps the source file number as audit data instead of a review match field', () => {
    expect(EXTERNAL_INVOICE_REVIEW_FIELD_ORDER).not.toContain('SOURCE_INVOICE_NUMBER');
    expect(EXTERNAL_INVOICE_REVIEW_FIELD_ORDER).toContain('INVOICE_DATE');
  });

  it('maps internal workflow states to only the three upload-list statuses', () => {
    expect(externalInvoiceListStatus(createRecord(false).status)).toBe('待发布');
    expect(externalInvoiceListStatus(createRecord(true).status)).toBe('待上传');
    expect(externalInvoiceListStatus('RECOGNIZING')).toBe('待上传');
    expect(externalInvoiceListStatus('WAITING_CONFIRMATION')).toBe('待上传');
    expect(externalInvoiceListStatus('RETURNED_FOR_CORRECTION')).toBe('待重新上传');
    expect(externalInvoiceListStatus('RETURNED_FOR_REUPLOAD')).toBe('待重新上传');
    expect(externalInvoicePageTab('WAITING_MEDIA_REVIEW')).toBe('review');
  });

  it('saves a draft before publishing it to the creator', () => {
    const draft = createRecord(false);
    expect(draft.invoiceNumber).toBeUndefined();
    expect(draft.presetPayoutAccountId).toBeUndefined();
    expect(draft.presetPayoutAccountSnapshot).toBeUndefined();
    expect(draft.expected.billTo).toEqual(invoiceEntity);
    expect(draft.expected.billTo).not.toBe(invoiceEntity);
    expect(draft.reviewHistory.map((event) => event.action)).toEqual(['CREATED']);

    const published = publishExternalInvoiceCollection(draft, actor, '2026-08-20T01:15:00.000Z');
    expect(published.status).toBe('WAITING_UPLOAD');
    expect(published.reviewHistory[published.reviewHistory.length - 1]?.action).toBe('PUBLISHED');
  });

  it('does not require a preset payout account but blocks a missing Real Name', () => {
    expect(() => createExternalInvoiceCollection({
      projectId: 'project-external-1' as ProjectId,
      projectName: 'Global Creator Campaign',
      engagementId: 'engagement-external-1' as EngagementId,
      creatorId,
      creatorName: creator.name,
      creatorLegalName: '   ',
      creatorHandle: creator.handle,
      contractIds: [],
      expected: {
        amount: 4800,
        currency: 'USD',
        billTo: invoiceEntity,
        description: 'Creator production service',
        dueDate: '2026-09-05',
      },
      actor,
      publish: false,
    })).toThrow('Real Name');
  });

  it('uses From and Bill To as hard contract blockers while allowing documented amount differences', () => {
    expect(() => createRecordWithContract(contract({ publisher: 'Different Publisher' })))
      .toThrow('From');
    expect(() => createRecordWithContract(contract({ totalFee: 4200 })))
      .toThrow('1–300');

    const documented = createRecordWithContract(
      contract({ totalFee: 4200 }),
      '合同金额为合作上限，本次 Invoice 按实际已交付内容结算。',
    );
    expect(documented.contractMatchReviews).toEqual([
      expect.objectContaining({
        stage: 'CREATION',
        result: 'APPROVED_WITH_REASON',
        reason: '合同金额为合作上限，本次 Invoice 按实际已交付内容结算。',
      }),
    ]);
  });

  it('carries a still-valid creation difference reason into media review and saves its audit', () => {
    const selectedContract = contract({ totalFee: 4200 });
    const uploaded = simulateExternalInvoiceUpload({
      record: createRecordWithContract(selectedContract, '合同金额为合作上限，本次按实际交付结算。'),
      creator,
      payoutAccountId: presetPayoutAccountId,
      scenario: 'NORMAL',
      actor: creatorActor,
      invoiceDate: '2026-08-20',
    });
    const submitted = submitExternalInvoiceForReview({
      record: uploaded,
      creator,
      contracts: [selectedContract],
      occupiedInvoices: [],
      actor: creatorActor,
    });
    expect(evaluateExternalInvoiceContractMatch({
      record: submitted,
      creator,
      contracts: [selectedContract],
    })).toMatchObject({
      result: 'APPROVED_WITH_REASON',
      effectiveReason: '合同金额为合作上限，本次按实际交付结算。',
    });

    const saved = saveExternalInvoiceContractMatchReview({
      record: submitted,
      creator,
      contracts: [selectedContract],
      reason: '合同金额为合作上限，本次按实际交付结算，媒介已复核。',
      actor,
      occurredAt: '2026-08-20T04:00:00.000Z',
    });
    expect(saved.reviewHistory[saved.reviewHistory.length - 1]?.action).toBe('CONTRACT_MATCH_REVIEWED');
    expect(saved.contractMatchReviews[saved.contractMatchReviews.length - 1]).toMatchObject({
      stage: 'MEDIA_REVIEW',
      result: 'APPROVED_WITH_REASON',
    });
  });

  it('preserves source, first recognition and corrected confirmation as separate layers', () => {
    const recognized = upload('OCR_ERROR');
    const recognition = currentExternalInvoiceRecognition(recognized)!;
    expect(recognition.fields.AMOUNT.evidence.sourceValue).toBe('4800.00');
    expect(recognition.fields.AMOUNT.value).toBe('4600.00');
    expect(recognition.fields.PUBLISHER.evidence.sourceValue).toBe('Alicia Lin LLC');
    expect(recognition.fields.PUBLISHER.evidence.sourceValue).not.toBe('Alicia Payout Account');
    expect(currentExternalInvoiceConfirmation(recognized)?.values.AMOUNT).toBe('4600.00');

    const corrected = correctExternalInvoiceRecognition(
      recognized,
      'AMOUNT',
      '4800.00',
      creatorActor,
      '2026-08-20T02:15:00.000Z',
    );
    expect(currentExternalInvoiceRecognition(corrected)?.fields.AMOUNT.value).toBe('4600.00');
    expect(currentExternalInvoiceConfirmation(corrected)?.values.AMOUNT).toBe('4800.00');
    expect(currentExternalInvoiceConfirmation(corrected)?.corrections[0]).toMatchObject({
      recognizedValue: '4600.00',
      confirmedValue: '4800.00',
      evidenceMatched: true,
    });
  });

  it('rejects a correction that cannot be found in source evidence', () => {
    expect(() => correctExternalInvoiceRecognition(upload('NORMAL'), 'AMOUNT', '5200.00', creatorActor))
      .toThrow('请修改原文件后重新上传');
  });

  it('requires media confirmation for corrected critical fields before approval', () => {
    const corrected = correctExternalInvoiceRecognition(
      upload('OCR_ERROR'),
      'AMOUNT',
      '4800.00',
      creatorActor,
      '2026-08-20T02:15:00.000Z',
    );
    const submitted = submitExternalInvoiceForReview({
      record: corrected,
      creator,
      contracts: [],
      occupiedInvoices: [],
      actor: creatorActor,
      occurredAt: '2026-08-20T03:00:00.000Z',
    });
    expect(externalInvoiceReviewReadiness({ record: submitted, creator }).pendingCriticalFields)
      .toEqual(['AMOUNT']);
    expect(() => buildApprovedExternalInvoice({
      record: submitted,
      creator,
      occupiedInvoices: [],
      actor,
    })).toThrow('达人纠正值待确认');

    const reviewed = reviewExternalInvoiceField(
      submitted,
      'AMOUNT',
      'CONFIRMED_CORRECTION',
      actor,
      '',
      '2026-08-20T03:20:00.000Z',
    );
    expect(currentExternalInvoiceFieldReview(reviewed, 'AMOUNT')).toMatchObject({
      decision: 'CONFIRMED_CORRECTION',
      fileVersionId: reviewed.sourceFileVersions[0].fileVersionId,
    });
    expect(externalInvoiceReviewReadiness({ record: reviewed, creator }).blockers).toContain('请确认当前版本 Invoice 已签名');
    const signed = confirmExternalInvoiceSignature(reviewed, actor, '2026-08-20T03:30:00.000Z');
    expect(externalInvoiceReviewReadiness({ record: signed, creator }).canApprove).toBe(true);
    expect(signed.reviewHistory[signed.reviewHistory.length - 1]?.action).toBe('INVOICE_SIGNATURE_CONFIRMED');
  });

  it('blocks an Invoice-file account that differs from the selected verified profile account', () => {
    const mismatched = upload('ACCOUNT_MISMATCH');
    expect(externalInvoiceValidationIssues({ record: mismatched, creator }))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        fieldKey: 'PAYMENT_ACCOUNT',
        severity: 'BLOCKER',
      })]));
    expect(() => submitExternalInvoiceForReview({
      record: mismatched,
      creator,
      contracts: [],
      occupiedInvoices: [],
      actor: creatorActor,
    })).toThrow('票面收款账户');
  });

  it('keeps Date of Invoice as record-only data outside system consistency validation', () => {
    const uploaded = upload('NORMAL');
    const confirmation = currentExternalInvoiceConfirmation(uploaded)!;
    const changedDate = {
      ...uploaded,
      confirmedSnapshots: [{
        ...confirmation,
        values: { ...confirmation.values, INVOICE_DATE: '2025-01-01' },
      }],
    };
    expect(externalInvoiceValidationIssues({ record: changedDate, creator })
      .some((issue) => issue.fieldKey === 'INVOICE_DATE')).toBe(false);
  });

  it('requires a note when media marks a field anomalous or requiring reupload', () => {
    const submitted = submitExternalInvoiceForReview({
      record: upload('NORMAL'),
      creator,
      contracts: [],
      occupiedInvoices: [],
      actor: creatorActor,
    });
    expect(() => reviewExternalInvoiceField(
      submitted,
      'SOURCE_INVOICE_NUMBER',
      'REUPLOAD_REQUIRED',
      actor,
    )).toThrow('必须填写说明');
  });

  it('retains old files when the creator uploads a new version', () => {
    const first = upload('SOURCE_FILE_ERROR');
    const second = simulateExternalInvoiceUpload({
      record: first,
      creator,
      payoutAccountId: 'payout-account-alicia',
      scenario: 'NORMAL',
      actor: creatorActor,
      invoiceDate: '2026-08-21',
      occurredAt: '2026-08-21T02:00:00.000Z',
    });
    expect(second.sourceFileVersions).toHaveLength(2);
    expect(second.sourceFileVersions[1].supersedesFileVersionId).toBe(second.sourceFileVersions[0].fileVersionId);
    expect(second.recognitionSnapshots).toHaveLength(2);
    expect(second.confirmedSnapshots).toHaveLength(2);
  });

  it('inherits contract signature state and invalidates Invoice signature confirmation after reupload', () => {
    const signedContract = contract();
    const firstSubmitted = submitExternalInvoiceForReview({
      record: simulateExternalInvoiceUpload({
        record: createRecordWithContract(signedContract),
        creator,
        payoutAccountId: presetPayoutAccountId,
        scenario: 'NORMAL',
        actor: creatorActor,
        invoiceDate: '2026-08-20',
      }),
      creator,
      contracts: [signedContract],
      occupiedInvoices: [],
      actor: creatorActor,
    });
    const confirmed = confirmExternalInvoiceSignature(firstSubmitted, actor);
    expect(currentExternalInvoiceSignatureConfirmation(confirmed)?.fileVersionId)
      .toBe(confirmed.sourceFileVersions[confirmed.sourceFileVersions.length - 1]?.fileVersionId);
    expect(externalInvoiceReviewReadiness({
      record: confirmed,
      creator,
      contracts: [{ ...signedContract, signed: false, lifecycle: 'SENT_FOR_SIGNATURE' }],
    }).blockers).toContain(`合同 ${signedContract.id} 尚未完成签署`);

    const returned = returnExternalInvoice(confirmed, 'REUPLOAD', '请上传带签名的新文件。', actor);
    const replacement = simulateExternalInvoiceUpload({
      record: returned,
      creator,
      payoutAccountId: presetPayoutAccountId,
      scenario: 'NORMAL',
      actor: creatorActor,
      invoiceDate: '2026-08-21',
    });
    const resubmitted = submitExternalInvoiceForReview({
      record: replacement,
      creator,
      contracts: [signedContract],
      occupiedInvoices: [],
      actor: creatorActor,
    });
    expect(currentExternalInvoiceSignatureConfirmation(resubmitted)).toBeUndefined();
    expect(resubmitted.invoiceSignatureConfirmations).toHaveLength(1);
    expect(externalInvoiceReviewReadiness({ record: resubmitted, creator, contracts: [signedContract] }).blockers)
      .toContain('请确认当前版本 Invoice 已签名');
  });

  it('blocks task mismatches but treats contract account differences separately', () => {
    const incorrectSource = upload('SOURCE_FILE_ERROR');
    expect(externalInvoiceValidationIssues({ record: incorrectSource, creator }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ fieldKey: 'AMOUNT', severity: 'BLOCKER' })]));
    expect(() => submitExternalInvoiceForReview({
      record: incorrectSource,
      creator,
      contracts: [],
      occupiedInvoices: [],
      actor: creatorActor,
    })).toThrow('总金额');
  });

  it('allocates a candidate number around other pending external candidates', () => {
    const submitted = submitExternalInvoiceForReview({
      record: upload('NORMAL'),
      creator,
      contracts: [],
      occupiedInvoices: [],
      reservedInvoiceNumbers: ['INV-20260820-00003'],
      actor: creatorActor,
      occurredAt: '2026-08-20T03:00:00.000Z',
    });
    expect(submitted.invoiceNumber).toBe('INV-20260820-00004');
    expect(submitted.status).toBe('WAITING_MEDIA_REVIEW');
  });

  it('uses the system Invoice number even when a source file number is duplicated', () => {
    const submitted = submitExternalInvoiceForReview({
      record: upload('NORMAL'),
      creator,
      contracts: [],
      occupiedInvoices: [],
      reservedSourceInvoiceNumbers: ['mcn-20260820-01'],
      actor: creatorActor,
    });

    expect(submitted.invoiceNumber).toBe('INV-20260820-00001');
    expect(submitted.sourceInvoiceNumber).toBe('MCN-20260820-01');
  });

  it('returns to upload handling and approves into a request-eligible external Invoice', () => {
    const submitted = submitExternalInvoiceForReview({
      record: upload('NORMAL'),
      creator,
      contracts: [],
      occupiedInvoices: [],
      actor: creatorActor,
    });
    const returned = returnExternalInvoice(
      submitted,
      'REUPLOAD',
      'Please replace the source file.',
      actor,
      '2026-08-20T06:00:00.000Z',
      creator.contact.email,
    );
    expect(returned.status).toBe('RETURNED_FOR_REUPLOAD');
    expect(externalInvoiceListStatus(returned.status)).toBe('待重新上传');
    expect(returned.reviewHistory.slice(-1)[0]?.notificationDeliveries).toEqual([
      {
        channel: 'IN_APP',
        status: 'SIMULATED_SENT',
        recipientLabel: '达人端 Invoice 消息中心',
      },
      {
        channel: 'EMAIL',
        status: 'SIMULATED_SENT',
        recipientLabel: 'al***ia@example.com',
      },
    ]);
    expect(() => submitExternalInvoiceForReview({
      record: returned,
      creator,
      contracts: [],
      occupiedInvoices: [],
      actor: creatorActor,
    })).toThrow('当前状态不能提交');

    const replacement = simulateExternalInvoiceUpload({
      record: returned,
      creator,
      payoutAccountId: 'payout-account-alicia',
      scenario: 'NORMAL',
      actor: creatorActor,
      invoiceDate: '2026-08-21',
    });
    expect(replacement.sourceFileVersions).toHaveLength(2);
    expect(submitExternalInvoiceForReview({
      record: replacement,
      creator,
      contracts: [],
      occupiedInvoices: [],
      actor: creatorActor,
    }).status).toBe('WAITING_MEDIA_REVIEW');

    const correctionReturn = returnExternalInvoice(submitted, 'CORRECTION', 'Please confirm the amount evidence.', actor);
    expect(correctionReturn.reviewHistory.slice(-1)[0]?.notificationDeliveries?.[1]).toEqual({
      channel: 'EMAIL',
      status: 'SKIPPED_MISSING_RECIPIENT',
      recipientLabel: '达人档案邮箱待补充',
    });
    expect(() => simulateExternalInvoiceUpload({
      record: correctionReturn,
      creator,
      payoutAccountId: 'payout-account-alicia',
      scenario: 'NORMAL',
      actor: creatorActor,
      invoiceDate: '2026-08-21',
    })).toThrow('当前状态不能上传');
    const reconfirmed = correctExternalInvoiceRecognition(correctionReturn, 'AMOUNT', '4800.00', creatorActor);
    expect(reconfirmed.status).toBe('WAITING_CONFIRMATION');
    expect(submitExternalInvoiceForReview({
      record: reconfirmed,
      creator,
      contracts: [],
      occupiedInvoices: [],
      actor: creatorActor,
    }).status).toBe('WAITING_MEDIA_REVIEW');

    const signedSubmitted = confirmExternalInvoiceSignature(submitted, actor, '2026-08-20T03:45:00.000Z');
    const approved = buildApprovedExternalInvoice({
      record: signedSubmitted,
      creator,
      occupiedInvoices: [],
      actor,
      occurredAt: '2026-08-20T04:00:00.000Z',
    });
    expect(approved.collection.status).toBe('APPROVED');
    expect(approved.invoice.invoiceType).toBe('EXTERNAL');
    expect(approved.invoice.status).toBe('已通过');
    expect(approved.invoice.snapshot.billTo).toEqual(submitted.expected.billTo);
    expect(approved.invoice.snapshot.billTo).not.toBe(submitted.expected.billTo);
    expect(approved.payout.invoiceReviewStatus).toBe('已通过');
    expect(approved.payout.invoiceSignatureRound).toBe(0);
    expect(approved.invoice.invoiceId).toBe(submitted.invoiceId);
    expect(approved.invoice.paymentFreezeSnapshot).toMatchObject({
      invoiceId: submitted.invoiceId,
      freezeStage: 'EXTERNAL_APPROVED',
      amount: 4800,
    });
    expect(approved.payout.invoicePaymentFreezeSnapshot).toEqual(
      approved.invoice.paymentFreezeSnapshot,
    );
  });
});
