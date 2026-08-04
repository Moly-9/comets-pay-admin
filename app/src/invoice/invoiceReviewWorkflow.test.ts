import { describe, expect, it } from 'vitest';
import type { GeneratedInvoiceRecord, Payout } from '../types';
import {
  applyInvoiceReviewAction,
  createInvoiceReviewEvent,
  getAvailableInvoiceReviewActions,
  getInvoicePageTab,
  getInvoiceRowStatus,
  invalidateSignedInvoice,
  isInvoiceApprovedForPayment,
  isPayoutEligibleForBatch,
  markGeneratedInvoiceSigned,
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

describe('Invoice review workflow', () => {
  it('handles creator feedback, resend, signature and first media approval', () => {
    const feedback = applyInvoiceReviewAction(
      payout,
      'RECORD_CREATOR_FEEDBACK',
      actor,
      '请修改地址',
    );
    expect(feedback.invoiceReviewStatus).toBe('达人反馈');
    expect(getInvoiceRowStatus(feedback)).toBe('达人反馈');

    const resent = applyInvoiceReviewAction(feedback, 'RESEND_FOR_SIGNATURE', actor);
    expect(resent.invoiceReviewStatus).toBe('待签署');
    expect(resent.invoiceVersion).toBe(2);

    const signed = applyInvoiceReviewAction(resent, 'MARK_SIGNED', actor);
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

  it('restarts payment failures from the finance-selected stage', () => {
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
        restartStage: 'MEDIA_RECHECK',
      },
    };

    expect(applyInvoiceReviewAction(
      invoiceContentReturn,
      'RESTART_AFTER_PAYMENT_FAILURE',
      actor,
    ).invoiceReviewStatus).toBe('待签署');
    expect(applyInvoiceReviewAction(
      paymentListReturn,
      'RESTART_AFTER_PAYMENT_FAILURE',
      actor,
    ).invoiceReviewStatus).toBe('待媒介复核');
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
    expect(() => applyInvoiceReviewAction(
      { ...payout, status: '已退回', invoiceReviewStatus: '已退回' },
      'RESTART_AFTER_PAYMENT_FAILURE',
      actor,
    )).toThrow(/尚未由财务分类/);
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
    expect(getInvoiceRowStatus({
      ...payout,
      invoiceReviewStatus: '已通过',
      status: '付款失败',
    })).toBe('付款失败 · 待财务处理');
  });
});
