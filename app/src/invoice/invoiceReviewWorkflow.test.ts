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
  isPayoutEligibleForBatch,
  markGeneratedInvoiceSigned,
  maskInvoiceAccountValue,
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
    expect(getInvoiceRowStatus(signed)).toBe('待审核');

    const mediaApproved = applyInvoiceReviewAction(signed, 'APPROVE_MEDIA', actor);
    expect(mediaApproved.invoiceReviewStatus).toBe('待发起请款');
    expect(mediaApproved.status).toBe('未进入付款');
    expect(getInvoicePageTab(mediaApproved.invoiceReviewStatus)).toBe('approval');

    const rechecked = applyInvoiceReviewAction(
      { ...signed, invoiceReviewStatus: '待媒介复核' },
      'APPROVE_MEDIA',
      actor,
    );
    expect(rechecked.invoiceReviewHistory?.slice(-1)[0]?.action).toBe('复核通过并重新提交');
  });

  it('returns a signed Invoice to creator and invalidates the signature', () => {
    const signed = {
      ...payout,
      invoiceReviewStatus: '待媒介审核' as const,
      invoiceSignedAt: '2026-08-04T01:00:00.000Z',
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
      { ...payout, invoiceReviewStatus: '待发起请款' },
    ])).toBe('NOT_RETURNED');
  });

  it('invalidates a recheck signature after sensitive fields change', () => {
    const recheck = {
      ...payout,
      invoiceReviewStatus: '待媒介复核' as const,
      invoiceSignedAt: '2026-08-04T01:00:00.000Z',
    };
    const invalidated = invalidateSignedInvoice(recheck, actor);
    expect(invalidated.invoiceReviewStatus).toBe('待签署');
    expect(invalidated.invoiceSignedAt).toBeUndefined();
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
    expect(getAvailableInvoiceReviewActions('待财务审核', readOnly)).toEqual([]);
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
    expect(result.payout.paymentFailure).toBeUndefined();
    expect(result.payout.paymentFailureReturn).toBeUndefined();
  });

  it('stores only masked bank and PayPal account summaries outside the document snapshot', () => {
    expect(maskInvoiceAccountValue('0000 1111 2222 3456')).toBe('•••• 3456');
    expect(maskInvoiceAccountValue('creator@example.test')).toBe('c***@example.test');
    expect(maskInvoiceAccountValue('')).toBe('待补充');

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
    expect(result.payout.account).toBe('c***@example.test');
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
          recipientLabel: 'c***@example.test',
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
    expect(getInvoiceDetailNavigationTarget('待发起请款')).toBe('PROJECT');
    expect(getInvoiceDetailNavigationTarget('待PM审核')).toBe('REQUEST');
    expect(getInvoiceDetailNavigationTarget('待项目负责人审核')).toBe('REQUEST');
    expect(getInvoiceDetailNavigationTarget('待老板审核')).toBe('REQUEST');
    expect(getInvoiceDetailNavigationTarget('待财务审核')).toBe('REQUEST');
    expect(getInvoiceDetailNavigationTarget('已通过')).toBe('PAYMENT');
    expect(getInvoiceDetailNavigationTarget('已退回')).toBeNull();
  });

  it('links a signed generated Invoice only through sourcePayoutId', () => {
    const record: GeneratedInvoiceRecord = {
      id: 'INV-GENERATED',
      invoiceId: 'inv_local_test' as never,
      sourcePayoutId: payout.id,
      status: '待签署',
      generatedAt: '2026-08-04 10:00',
      snapshot: {} as never,
      validationStatus: 'valid',
      version: 1,
    };
    const linked = markGeneratedInvoiceSigned(payout, record, actor, '2026-08-04T03:00:00.000Z');
    expect(linked.invoice).toBe('INV-GENERATED');
    expect(linked.invoiceReviewStatus).toBe('待媒介审核');
    expect(linked.invoiceSnapshot).toBe(record.snapshot);

    expect(() => markGeneratedInvoiceSigned(
      payout,
      { ...record, sourcePayoutId: 'pay-other' },
      actor,
    )).toThrow(/稳定关联/);
  });

  it('blocks payment and batches until finance approval', () => {
    expect(isInvoiceApprovedForPayment(payout)).toBe(false);
    expect(isPayoutEligibleForBatch(payout)).toBe(false);
    expect(isPayoutEligibleForBatch({
      ...payout,
      invoiceReviewStatus: '已通过',
      status: '等待付款',
    })).toBe(true);
    const expectedStatuses = [
      ['等待付款', '等待付款'],
      ['付款处理中', '付款处理中'],
      ['已付款', '已付款'],
      ['付款失败', '付款失败待财务处理'],
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
    })).toBe('等待付款');
  });

  it('uses one display label set for Invoice lists and details', () => {
    const expectedLabels = {
      待签署: '待签署',
      达人反馈: '达人反馈',
      待媒介审核: '待审核',
      待媒介复核: '待复核',
      待发起请款: '待发起请款',
      待PM审核: '待 PM 审批',
      待项目负责人审核: '待项目负责人审批',
      待老板审核: '待老板审批',
      待财务审核: '待财务审批',
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
