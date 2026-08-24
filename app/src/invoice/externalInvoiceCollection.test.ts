import { describe, expect, it } from 'vitest';
import type { CreatorId, EngagementId, ProjectId } from '../businessWorkflow';
import type { CreatorProfile, InvoiceEntity } from '../types';
import { createDocumentPayoutSnapshot } from '../payoutAccounts';
import {
  EXTERNAL_INVOICE_REVIEW_FIELD_ORDER,
  buildApprovedExternalInvoice,
  correctExternalInvoiceRecognition,
  createExternalInvoiceCollection,
  currentExternalInvoiceConfirmation,
  currentExternalInvoiceFieldReview,
  currentExternalInvoiceRecognition,
  externalInvoiceListStatus,
  externalInvoicePageTab,
  externalInvoiceReviewReadiness,
  externalInvoiceValidationIssues,
  publishExternalInvoiceCollection,
  reviewExternalInvoiceField,
  returnExternalInvoice,
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
    paypalUsername: 'Alicia Lin LLC',
    paypalEmail: 'alicia@example.com',
  }],
};

const actor = { account: 'media.demo', name: 'Media Reviewer', role: '媒介' };
const creatorActor = { account: 'creator.demo', name: 'Alicia Lin', role: '达人账号' };
const invoiceEntity: InvoiceEntity = { name: 'Comets Global Ltd.', address: 'Hong Kong' };
const presetPayoutAccount = creator.payoutAccounts[0];
const presetPayoutAccountId = 'payout-account-alicia';

const createRecord = (publish = true) => createExternalInvoiceCollection({
  projectId: 'project-external-1' as ProjectId,
  projectName: 'Global Creator Campaign',
  engagementId: 'engagement-external-1' as EngagementId,
  creatorId,
  creatorName: creator.name,
  creatorHandle: creator.handle,
  contractIds: [],
  presetPayoutAccountId,
  presetPayoutAccountSnapshot: createDocumentPayoutSnapshot(presetPayoutAccount, creatorId),
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
    expect(draft.presetPayoutAccountId).toBe(presetPayoutAccountId);
    expect(draft.presetPayoutAccountSnapshot).toMatchObject({
      payoutAccountId: presetPayoutAccountId,
      validationStatus: 'VERIFIED',
    });
    expect(draft.expected.billTo).toEqual(invoiceEntity);
    expect(draft.expected.billTo).not.toBe(invoiceEntity);
    expect(draft.reviewHistory.map((event) => event.action)).toEqual(['CREATED']);

    const published = publishExternalInvoiceCollection(draft, actor, '2026-08-20T01:15:00.000Z');
    expect(published.status).toBe('WAITING_UPLOAD');
    expect(published.reviewHistory[published.reviewHistory.length - 1]?.action).toBe('PUBLISHED');
  });

  it('rejects a collection without a verified preset payout account snapshot', () => {
    expect(() => createExternalInvoiceCollection({
      projectId: 'project-external-1' as ProjectId,
      projectName: 'Global Creator Campaign',
      engagementId: 'engagement-external-1' as EngagementId,
      creatorId,
      creatorName: creator.name,
      creatorHandle: creator.handle,
      contractIds: [],
      presetPayoutAccountId,
      presetPayoutAccountSnapshot: {
        ...createDocumentPayoutSnapshot(presetPayoutAccount, creatorId),
        validationStatus: 'READY_FOR_VALIDATION',
      },
      expected: {
        amount: 4800,
        currency: 'USD',
        billTo: invoiceEntity,
        description: 'Creator production service',
        dueDate: '2026-09-05',
      },
      actor,
      publish: false,
    })).toThrow('默认且已审核的收款账户');
  });

  it('preserves source, first recognition and corrected confirmation as separate layers', () => {
    const recognized = upload('OCR_ERROR');
    const recognition = currentExternalInvoiceRecognition(recognized)!;
    expect(recognition.fields.AMOUNT.evidence.sourceValue).toBe('4800.00');
    expect(recognition.fields.AMOUNT.value).toBe('4600.00');
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
    expect(externalInvoiceReviewReadiness({ record: reviewed, creator }).canApprove).toBe(true);
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
    const returned = returnExternalInvoice(submitted, 'REUPLOAD', 'Please replace the source file.', actor);
    expect(returned.status).toBe('RETURNED_FOR_REUPLOAD');
    expect(externalInvoiceListStatus(returned.status)).toBe('待重新上传');
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

    const approved = buildApprovedExternalInvoice({
      record: submitted,
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
