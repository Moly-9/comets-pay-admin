import { describe, expect, it } from 'vitest';
import type { GeneratedInvoiceRecord, Payout } from '../types';
import {
  applyInvoiceDocumentEdit,
  applyInvoiceReviewAction,
  createInvoiceReviewEvent,
  getAvailableInvoiceReviewActions,
  getApprovedInvoicePaymentStatus,
  getInvoiceDetailNavigationTarget,
  getInvoiceDetailReviewActions,
  getInvoiceEditContext,
  getInvoicePageTab,
  getInvoiceRowStatus,
  getPaymentListResubmissionState,
  invalidateSignedInvoice,
  isInvoiceApprovedForPayment,
  isPayoutPaymentInformationValidated,
  isPayoutEligibleForBatch,
  markGeneratedInvoiceSigned,
  publishGeneratedInvoiceDraft,
  recordInvoiceSignatureReminder,
  replyToCreatorFeedback,
} from './invoiceReviewWorkflow';

const actor = { account: 'reviewer', name: '审核人', role: '测试角色' };
const payout: Payout = {
  id: 'pay-test',
  creator: 'Synthetic Creator',
  handle: '@synthetic',
  initials: 'SC',
  projectId: 'PRJ-TEST',
  project: 'Synthetic Project',
  contract: 'CON-TEST',
  invoice: 'INV-TEST',
  provider: 'Airwallex',
  currency: 'USD',
  amount: 100,
  account: '****0000',
  status: '未进入付款',
  invoiceReviewStatus: '待签署',
  accent: '#999999',
};

const snapshot = {
  invoiceNumber: 'INV-TEST',
  invoiceDate: '2026-08-05',
  billTo: { name: 'Synthetic Advertiser', address: 'Synthetic address' },
  creatorHandle: '@synthetic',
  creatorName: 'Synthetic Creator',
  creatorId: 'crt_test',
  engagementId: 'col_test',
  projectId: 'prj_test',
  projectName: 'Synthetic Project',
  contractIds: [],
  from: {
    legalName: 'Synthetic Creator',
    address: 'Synthetic address',
    phone: '+1 000 000 0000',
    email: 'creator@example.test',
  },
  currency: 'USD' as const,
  items: [{
    id: 'item-test',
    description: 'Synthetic service',
    unitPrice: 100,
    quantity: 1,
    lineTotal: 100,
  }],
  payoutAccountId: 'awx-synthetic',
  paymentMethod: 'bank' as const,
  payment: {
    bankCountry: 'US',
    accountName: 'Synthetic Creator',
    accountType: 'Checking',
    swiftCode: 'TESTUS00',
    accountNumber: '0000000000',
    iban: '',
    beneficiaryType: 'PERSONAL',
    bankName: 'Synthetic Bank',
    bankStreetAddress: 'Synthetic address',
    bankCity: 'Test City',
    bankState: 'CA',
    bankPostalCode: '00000',
    intermediaryBankCountry: '',
    intermediaryBankCode: '',
    transferRemarks: '',
    paypalUsername: '',
    paypalEmail: '',
  },
} as unknown as GeneratedInvoiceRecord['snapshot'];

const generatedRecord: GeneratedInvoiceRecord = {
  id: 'INV-TEST',
  invoiceId: 'inv_local_test' as never,
  sourcePayoutId: payout.id,
  status: '待签署',
  generatedAt: '2026-08-05 10:00',
  snapshot,
  validationStatus: 'valid',
  version: 1,
};

describe('Invoice review workflow', () => {
  it('handles creator feedback, edited resend, signature and first media approval', () => {
    const feedback = applyInvoiceReviewAction(
      payout,
      'RECORD_CREATOR_FEEDBACK',
      actor,
      '请修改地址',
    );
    expect(feedback.invoiceReviewStatus).toBe('达人反馈');
    expect(getInvoiceRowStatus(feedback)).toBe('达人反馈');

    const edited = applyInvoiceDocumentEdit({
      record: generatedRecord,
      payout: { ...feedback, invoiceSnapshot: snapshot },
      snapshot: { ...snapshot, invoiceDate: '2026-08-06' },
      context: 'CREATOR_FEEDBACK',
      actor,
    });
    expect(edited.payout.invoiceReviewStatus).toBe('待签署');
    expect(edited.payout.invoiceVersion).toBe(2);
    expect(edited.record.revisions).toHaveLength(1);

    const signed = applyInvoiceReviewAction(edited.payout, 'MARK_SIGNED', actor);
    expect(signed.invoiceReviewStatus).toBe('待媒介审核');
    expect(signed.invoiceSignatureRound).toBe(1);
    expect(signed.invoiceSnapshot?.signatureText).toBe('Synthetic Creator');
    expect(getInvoiceRowStatus(signed)).toBe('待审核');

    const mediaApproved = applyInvoiceReviewAction(signed, 'APPROVE_MEDIA', actor);
    expect(mediaApproved.invoiceReviewStatus).toBe('已通过');
    expect(mediaApproved.status).toBe('未进入付款');
    expect(mediaApproved.invoiceSnapshot?.signatureText).toBe('Synthetic Creator');
    expect(getInvoicePageTab(mediaApproved.invoiceReviewStatus)).toBe('approved');

    const rechecked = applyInvoiceReviewAction(
      { ...signed, invoiceReviewStatus: '待媒介复核' },
      'APPROVE_MEDIA',
      actor,
    );
    expect(rechecked.invoiceReviewHistory?.slice(-1)[0]?.action).toBe('复核通过并重新提交');
  });

  it('keeps draft edits at V1 and only creates signature notifications after publishing', () => {
    const draftRecord: GeneratedInvoiceRecord = { ...generatedRecord, status: '草稿' };
    const draftPayout: Payout = {
      ...payout,
      invoiceReviewStatus: '草稿',
      invoiceVersion: 1,
      invoiceSnapshot: snapshot,
    };
    const edited = applyInvoiceDocumentEdit({
      record: draftRecord,
      payout: draftPayout,
      snapshot: { ...snapshot, invoiceDate: '2026-08-06' },
      context: 'DRAFT',
      actor,
      occurredAt: '2026-08-06T01:00:00.000Z',
    });

    expect(edited.record.status).toBe('草稿');
    expect(edited.record.version).toBe(1);
    expect(edited.record.revisions).toBeUndefined();
    expect(edited.payout.invoiceReviewStatus).toBe('草稿');
    expect(edited.payout.invoiceReviewHistory?.slice(-1)[0]?.action).toBe('编辑草稿');

    const published = publishGeneratedInvoiceDraft(
      edited.record,
      edited.payout,
      actor,
      snapshot.from.email,
      '2026-08-06T02:00:00.000Z',
    );
    expect(published.record.status).toBe('待签署');
    expect(published.record.publishedAt).toBe('2026-08-06T02:00:00.000Z');
    expect(published.payout.invoiceReviewStatus).toBe('待签署');
    expect(published.payout.invoiceReviewHistory?.slice(-1)[0]).toMatchObject({
      action: '发布达人签署',
      fromStatus: '草稿',
      toStatus: '待签署',
      notificationDeliveries: [
        { channel: 'IN_APP', status: 'SIMULATED_SENT' },
        { channel: 'EMAIL', status: 'SIMULATED_SENT' },
      ],
    });
    expect(() => publishGeneratedInvoiceDraft(
      published.record,
      published.payout,
      actor,
      snapshot.from.email,
    )).toThrow(/只有草稿/);
  });

  it('groups media-approved Invoices under the approved business tab', () => {
    expect(getInvoicePageTab('已通过')).toBe('approved');
  });

  it('returns a signed Invoice to creator and invalidates the signature', () => {
    const signed = {
      ...payout,
      invoiceReviewStatus: '待媒介审核' as const,
      invoiceSignedAt: '2026-08-04T01:00:00.000Z',
      invoiceSnapshot: { ...snapshot, signatureDate: '2026-08-04', signatureText: 'Synthetic Creator' } as never,
      invoiceVersion: 1,
    };
    const returned = applyInvoiceReviewAction(
      signed,
      'RETURN_TO_CREATOR',
      actor,
      '签署页主体错误',
    );
    expect(returned.invoiceReviewStatus).toBe('待签署');
    expect(returned.invoiceSignedAt).toBeUndefined();
    expect(returned.invoiceSnapshot?.signatureDate).toBeUndefined();
    expect(returned.invoiceSnapshot?.signatureText).toBeUndefined();
    expect(returned.invoiceVersion).toBe(2);
  });

  it('only allows Invoice-content failures to enter the edit flow', () => {
    const invoiceContentReturn: Payout = {
      ...payout,
      status: '已退回',
      invoiceReviewStatus: '已退回',
      paymentFailureReturn: {
        issueType: 'INVOICE_CONTENT',
        reason: 'Invoice 金额错误',
        actorAccount: 'finance',
        actorName: '财务',
        occurredAt: '2026-08-04T02:00:00.000Z',
        restartStage: 'SIGNATURE',
      },
    };
    const paymentListReturn: Payout = {
      ...invoiceContentReturn,
      paymentFailureReturn: {
        ...invoiceContentReturn.paymentFailureReturn!,
        issueType: 'PAYMENT_LIST',
        restartStage: 'PAYMENT_LIST_RESUBMISSION',
      },
    };

    const manage = { manage: true, mediaReview: false, financeReview: false };
    expect(getInvoiceEditContext(invoiceContentReturn, manage)).toBe('PAYMENT_FAILURE_CONTENT');
    expect(getInvoiceEditContext(paymentListReturn, manage)).toBeNull();
    expect(getInvoiceDetailReviewActions('已退回', manage)).toEqual([]);
    expect(getPaymentListResubmissionState([paymentListReturn])).toBe('ELIGIBLE');
    expect(getPaymentListResubmissionState([
      paymentListReturn,
      { ...payout, status: '等待付款', invoiceReviewStatus: '已通过' },
    ])).toBe('ELIGIBLE');
    expect(getPaymentListResubmissionState([
      paymentListReturn,
      { ...payout, invoiceReviewStatus: '待媒介审核' },
    ])).toBe('INVALID');
    expect(getPaymentListResubmissionState([
      { ...payout, invoiceReviewStatus: '已通过' },
    ])).toBe('NOT_RETURNED');
  });

  it('invalidates a recheck signature after sensitive fields change', () => {
    const recheck = {
      ...payout,
      invoiceReviewStatus: '待媒介复核' as const,
      invoiceSignedAt: '2026-08-04T01:00:00.000Z',
      invoiceSnapshot: { ...snapshot, signatureDate: '2026-08-04', signatureText: 'Synthetic Creator' } as never,
    };
    const invalidated = invalidateSignedInvoice(recheck, actor);
    expect(invalidated.invoiceReviewStatus).toBe('待签署');
    expect(invalidated.invoiceSignedAt).toBeUndefined();
    expect(invalidated.invoiceSnapshot?.signatureDate).toBeUndefined();
    expect(invalidated.invoiceSnapshot?.signatureText).toBeUndefined();
    expect(invalidated.invoiceReviewHistory?.slice(-1)[0]?.action).toBe('签署失效');
  });

  it('rejects invalid transitions and required empty reasons', () => {
    expect(() => createInvoiceReviewEvent(payout, 'APPROVE_MEDIA', actor)).toThrow();
    expect(() => createInvoiceReviewEvent(
      { ...payout, invoiceReviewStatus: '待媒介审核' },
      'RETURN_TO_CREATOR',
      actor,
      '   ',
    )).toThrow();
  });

  it('exposes media and manage actions only at their responsible stages', () => {
    const media = { manage: false, mediaReview: true, financeReview: false };
    const manage = { manage: true, mediaReview: false, financeReview: false };
    const readOnly = { manage: false, mediaReview: false, financeReview: false };

    expect(getAvailableInvoiceReviewActions('待媒介审核', media)).toEqual([
      'APPROVE_MEDIA',
      'RETURN_TO_CREATOR',
    ]);
    expect(getAvailableInvoiceReviewActions('待媒介复核', media)).toEqual([
      'APPROVE_MEDIA',
      'RETURN_TO_CREATOR',
    ]);
    expect(getAvailableInvoiceReviewActions('待签署', manage)).toEqual([
      'MARK_SIGNED',
      'RECORD_CREATOR_FEEDBACK',
    ]);
    expect(getAvailableInvoiceReviewActions('已通过', readOnly)).toEqual([]);
    expect(getInvoiceDetailReviewActions('待签署', manage)).toEqual([]);
    expect(getInvoiceDetailReviewActions('达人反馈', manage)).toEqual([]);
  });

  it('applies a document edit atomically while preserving stable identity', () => {
    const returned: Payout = {
      ...payout,
      status: '已退回',
      invoiceReviewStatus: '已退回',
      invoiceSignedAt: '2026-08-04T01:00:00.000Z',
      invoiceSnapshot: snapshot,
      paymentFailure: {
        provider: 'Airwallex',
        errorCode: 'SYNTHETIC_FAILURE',
        providerResponse: 'Synthetic failure response',
        occurredAt: '2026-08-04T02:00:00.000Z',
      },
      paymentFailureReturn: {
        issueType: 'INVOICE_CONTENT',
        reason: 'Invoice 金额错误',
        actorAccount: 'finance',
        actorName: '财务',
        occurredAt: '2026-08-04T03:00:00.000Z',
        restartStage: 'SIGNATURE',
      },
    };
    const result = applyInvoiceDocumentEdit({
      record: generatedRecord,
      payout: returned,
      snapshot: {
        ...snapshot,
        signatureDate: '2026-08-04',
        signatureText: 'Synthetic Creator',
        currency: 'EUR',
        items: [{ ...snapshot.items[0]!, unitPrice: 120, lineTotal: 120 }],
        payoutAccountId: 'paypal-synthetic',
        paymentMethod: 'paypal',
        payment: {
          ...snapshot.payment,
          accountName: '',
          accountNumber: '',
          paypalUsername: 'synthetic.creator',
          paypalEmail: 'creator@example.test',
        },
      },
      context: 'PAYMENT_FAILURE_CONTENT',
      actor,
      occurredAt: '2026-08-05T01:00:00.000Z',
    });

    expect(result.record.invoiceId).toBe(generatedRecord.invoiceId);
    expect(result.record.sourcePayoutId).toBe(generatedRecord.sourcePayoutId);
    expect(result.record.version).toBe(2);
    expect(result.record.revisions?.[0]).toMatchObject({
      version: 1,
      changedFields: ['currency', 'items', 'payoutAccountId', 'paymentMethod', 'payment'],
    });
    expect(result.payout).toMatchObject({
      invoiceReviewStatus: '待签署',
      status: '未进入付款',
      currency: 'EUR',
      amount: 120,
      provider: 'PayPal',
      payoutAccountId: 'paypal-synthetic',
      invoiceVersion: 2,
    });
    expect(result.payout.invoiceSignedAt).toBeUndefined();
    expect(result.record.snapshot.signatureDate).toBeUndefined();
    expect(result.record.snapshot.signatureText).toBeUndefined();
    expect(result.payout.invoiceSnapshot?.signatureDate).toBeUndefined();
    expect(result.payout.invoiceSnapshot?.signatureText).toBeUndefined();
    expect(result.payout.paymentFailure).toBeUndefined();
    expect(result.payout.paymentFailureReturn).toBeUndefined();
  });

  it('stores complete bank and PayPal account values outside the document snapshot', () => {
    const feedbackPayout: Payout = {
      ...payout,
      invoiceReviewStatus: '达人反馈',
      creatorFeedback: {
        reason: '请更新付款方式',
        actorName: '原型达人',
        occurredAt: '2026-08-05T00:00:00.000Z',
      },
    };
    const paypalSnapshot = {
      ...snapshot,
      payoutAccountId: 'paypal-synthetic',
      paymentMethod: 'paypal' as const,
      payment: {
        ...snapshot.payment,
        paypalUsername: 'synthetic.creator',
        paypalEmail: 'creator@example.test',
      },
    };
    const result = applyInvoiceDocumentEdit({
      record: generatedRecord,
      payout: feedbackPayout,
      snapshot: paypalSnapshot,
      context: 'CREATOR_FEEDBACK',
      actor,
    });
    expect(result.payout.account).toBe('creator@example.test');
    expect(result.record.snapshot.payment.paypalEmail).toBe('creator@example.test');
  });

  it('rejects unchanged edits, mismatched contexts and changed stable IDs', () => {
    const feedback = {
      ...payout,
      invoiceReviewStatus: '达人反馈' as const,
      creatorFeedback: {
        reason: '请修改日期',
        actorName: '媒介',
        occurredAt: '2026-08-05T00:00:00.000Z',
      },
    };
    expect(() => applyInvoiceDocumentEdit({
      record: generatedRecord,
      payout: feedback,
      snapshot,
      context: 'CREATOR_FEEDBACK',
      actor,
    })).toThrow(/尚未修改/);
    expect(() => applyInvoiceDocumentEdit({
      record: generatedRecord,
      payout: feedback,
      snapshot: { ...snapshot, invoiceDate: '2026-08-06' },
      context: 'MEDIA_RECHECK',
      actor,
    })).toThrow(/入口不一致/);
    expect(() => applyInvoiceDocumentEdit({
      record: generatedRecord,
      payout: feedback,
      snapshot: { ...snapshot, projectId: 'prj_other' as never, invoiceDate: '2026-08-06' },
      context: 'CREATOR_FEEDBACK',
      actor,
    })).toThrow(/稳定 ID/);
  });

  it('records feedback replies without changing the lifecycle state', () => {
    const feedback = applyInvoiceReviewAction(
      payout,
      'RECORD_CREATOR_FEEDBACK',
      actor,
      '请修改地址',
    );
    const replied = replyToCreatorFeedback(
      feedback,
      { account: 'media', name: '媒介', role: '媒介账号' },
      '已收到，修改后重新发送。',
      '2026-08-04T04:00:00.000Z',
    );

    expect(replied.invoiceReviewStatus).toBe('达人反馈');
    expect(replied.creatorFeedback?.replies).toEqual([{
      message: '已收到，修改后重新发送。',
      actorAccount: 'media',
      actorName: '媒介',
      actorRole: '媒介账号',
      occurredAt: '2026-08-04T04:00:00.000Z',
    }]);
    expect(replied.invoiceReviewHistory?.slice(-1)[0]?.action).toBe('回复达人反馈');
    expect(() => replyToCreatorFeedback(payout, actor, '回复')).toThrow(/没有可回复/);
    expect(() => replyToCreatorFeedback(feedback, actor, '   ')).toThrow(/不能为空/);
  });

  it('records repeatable signature reminders without changing signature state', () => {
    const firstReminder = recordInvoiceSignatureReminder(
      { ...payout, invoiceSignatureRound: 2 },
      actor,
      '  请登录达人端签署 Invoice。  ',
      'creator@example.test',
      '2026-08-07T01:00:00.000Z',
    );

    expect(firstReminder.invoiceReviewStatus).toBe('待签署');
    expect(firstReminder.invoiceSignatureRound).toBe(2);
    expect(firstReminder.invoiceSignedAt).toBeUndefined();
    expect(firstReminder.invoiceReviewHistory?.slice(-1)[0]).toMatchObject({
      action: '通知达人签署',
      fromStatus: '待签署',
      toStatus: '待签署',
      reason: '请登录达人端签署 Invoice。',
      occurredAt: '2026-08-07T01:00:00.000Z',
      notificationDeliveries: [
        {
          channel: 'IN_APP',
          status: 'SIMULATED_SENT',
          recipientLabel: '达人端 Invoice 消息中心',
        },
        {
          channel: 'EMAIL',
          status: 'SIMULATED_SENT',
          recipientLabel: 'creator@example.test',
        },
      ],
    });

    const secondReminder = recordInvoiceSignatureReminder(
      firstReminder,
      actor,
      '再次提醒签署。',
      '',
      '2026-08-07T02:00:00.000Z',
    );
    expect(secondReminder.invoiceReviewHistory).toHaveLength(2);
    expect(secondReminder.invoiceReviewHistory?.[1]?.notificationDeliveries?.[1]).toEqual({
      channel: 'EMAIL',
      status: 'SKIPPED_MISSING_RECIPIENT',
      recipientLabel: '达人档案邮箱待补充',
    });
  });

  it('rejects invalid signature reminder submissions', () => {
    expect(() => recordInvoiceSignatureReminder(
      { ...payout, invoiceReviewStatus: '待媒介审核' },
      actor,
      '提醒签署',
      'creator@example.test',
    )).toThrow(/待签署/);
    expect(() => recordInvoiceSignatureReminder(payout, actor, '   ', ''))
      .toThrow(/不能为空/);
    expect(() => recordInvoiceSignatureReminder(payout, actor, 'x'.repeat(301), ''))
      .toThrow(/300/);
  });

  it('routes project approval and payment actions to their canonical detail pages', () => {
    expect(getInvoiceDetailNavigationTarget('待签署')).toBeNull();
    expect(getInvoiceDetailNavigationTarget('达人反馈')).toBeNull();
    expect(getInvoiceDetailNavigationTarget('待媒介审核')).toBeNull();
    expect(getInvoiceDetailNavigationTarget('待媒介复核')).toBeNull();
    expect(getInvoiceDetailNavigationTarget('已通过')).toBe('PROJECT');
    expect(getInvoiceDetailNavigationTarget('已退回')).toBeNull();
  });

  it('links a signed generated Invoice only through sourcePayoutId', () => {
    const record: GeneratedInvoiceRecord = {
      id: 'INV-GENERATED',
      invoiceId: 'inv_local_test' as never,
      sourcePayoutId: payout.id,
      status: '待签署',
      generatedAt: '2026-08-04 10:00',
      snapshot,
      validationStatus: 'valid',
      version: 1,
    };
    const occurredAt = '2026-08-14T10:00:00.000+08:00';
    const linked = markGeneratedInvoiceSigned(payout, record, actor, occurredAt);
    expect(linked.invoice).toBe('INV-GENERATED');
    expect(linked.invoiceReviewStatus).toBe('待媒介审核');
    expect(linked.invoiceSignedAt).toBe(occurredAt);
    expect(linked.invoiceSnapshot).toEqual({
      ...record.snapshot,
      signatureDate: '2026-08-14',
      signatureText: 'Synthetic Creator',
    });
    expect(linked.invoicePaymentFreezeSnapshot).toMatchObject({
      invoiceId: record.invoiceId,
      invoiceVersion: 1,
      amount: 100,
      payoutAccountId: 'awx-synthetic',
      freezeStage: 'CREATOR_SIGNED',
    });

    expect(() => markGeneratedInvoiceSigned(
      payout,
      { ...record, sourcePayoutId: 'pay-other' },
      actor,
    )).toThrow(/稳定关联/);
  });

  it.each(['BLOCKED', 'REASON_REQUIRED'] as const)(
    'does not move a %s contract match into media review',
    (result) => {
      const record: GeneratedInvoiceRecord = {
        id: 'INV-BLOCKED',
        invoiceId: 'inv_blocked' as never,
        sourcePayoutId: payout.id,
        status: '待签署',
        generatedAt: '2026-08-04 10:00',
        snapshot,
        validationStatus: 'valid',
        version: 1,
        contractMatchReviews: [{
          version: 1,
          contractIds: [],
          result,
          issues: [],
        }],
      };

      expect(() => markGeneratedInvoiceSigned(payout, record, actor))
        .toThrow(/未处理的阻断项/);
    },
  );

  it.each(['MATCHED', 'NOT_APPLICABLE', 'APPROVED_WITH_REASON'] as const)(
    'allows a %s contract match to move into media review',
    (result) => {
      const record: GeneratedInvoiceRecord = {
        id: 'INV-READY',
        invoiceId: 'inv_ready' as never,
        sourcePayoutId: payout.id,
        status: '待签署',
        generatedAt: '2026-08-04 10:00',
        snapshot,
        validationStatus: 'valid',
        version: 1,
        contractMatchReviews: [{
          version: 1,
          contractIds: [],
          result,
          issues: [],
        }],
      };

      expect(markGeneratedInvoiceSigned(payout, record, actor).invoiceReviewStatus)
        .toBe('待媒介审核');
    },
  );

  it('blocks payment and batches until finance approval', () => {
    expect(isInvoiceApprovedForPayment(payout)).toBe(false);
    expect(isPayoutEligibleForBatch(payout)).toBe(false);
    expect(isPayoutEligibleForBatch({
      ...payout,
      invoiceReviewStatus: '已通过',
      status: '等待付款',
    })).toBe(true);
    const expectedStatuses = [
      ['等待付款', '付款中'],
      ['付款处理中', '付款中'],
      ['已付款', '已付款'],
      ['付款失败', '付款中'],
    ] as const;
    expectedStatuses.forEach(([status, label]) => {
      const approvedPayout = { ...payout, invoiceReviewStatus: '已通过' as const, status };
      expect(getApprovedInvoicePaymentStatus(approvedPayout)).toBe(status);
      expect(getInvoiceRowStatus(approvedPayout)).toBe(label);
    });

    expect(getApprovedInvoicePaymentStatus({
      ...payout,
      status: '飞书审批中',
    })).toBe('等待付款');
    expect(getInvoiceRowStatus({
      ...payout,
      invoiceReviewStatus: '已通过',
      status: '信息异常',
    })).toBe('付款中');
  });

  it('validates the approved Invoice and payment-list snapshot before execution', () => {
    const validated = {
      ...payout,
      account: '•••• 2048',
      invoiceReviewStatus: '已通过' as const,
      paymentListRequiresRevalidation: false,
      paymentListValidationIssues: [],
    };

    expect(isPayoutPaymentInformationValidated(validated)).toBe(true);
    expect(isPayoutPaymentInformationValidated({
      ...validated,
      paymentListRequiresRevalidation: true,
    })).toBe(false);
    expect(isPayoutPaymentInformationValidated({
      ...validated,
      account: '待补充',
    })).toBe(false);
  });

  it('uses one display label set for Invoice lists and details', () => {
    const expectedLabels = {
      待签署: '待签署',
      达人反馈: '达人反馈',
      待媒介审核: '待审核',
      待媒介复核: '待复核',
      已通过: '付款中',
      已退回: '已退回',
    } as const;

    Object.entries(expectedLabels).forEach(([invoiceReviewStatus, label]) => {
      expect(getInvoiceRowStatus({
        ...payout,
        invoiceReviewStatus: invoiceReviewStatus as Payout['invoiceReviewStatus'],
      })).toBe(label);
    });
  });
});
