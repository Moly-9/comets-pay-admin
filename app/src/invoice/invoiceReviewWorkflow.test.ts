import { describe, expect, it } from 'vitest';
import type { GeneratedInvoiceRecord, Payout } from '../types';
import {
  applyInvoiceReviewAction,
  createInvoiceReviewEvent,
  getAvailableInvoiceReviewActions,
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
  invoiceReviewStatus: '待媒介审核',
  accent: '#999999',
};

describe('Invoice review workflow', () => {
  it('runs the media and finance approval chain and only then enables payment', () => {
    const mediaApproved = applyInvoiceReviewAction(
      payout,
      'APPROVE_MEDIA',
      actor,
      undefined,
      '2026-08-04T01:00:00.000Z',
    );
    expect(mediaApproved.invoiceReviewStatus).toBe('待财务审核');
    expect(mediaApproved.status).toBe('未进入付款');

    const financeApproved = applyInvoiceReviewAction(
      mediaApproved,
      'APPROVE_FINANCE',
      actor,
      undefined,
      '2026-08-04T02:00:00.000Z',
    );
    expect(financeApproved.invoiceReviewStatus).toBe('已通过');
    expect(financeApproved.status).toBe('等待付款');
    expect(financeApproved.invoiceReviewHistory).toHaveLength(2);
  });

  it('separates media revision and finance return states', () => {
    const mediaReturned = applyInvoiceReviewAction(
      payout,
      'RETURN_MEDIA',
      actor,
      '请修改主体',
    );
    expect(mediaReturned.invoiceReviewStatus).toBe('待修改');
    expect(mediaReturned.invoiceReviewReturn?.stage).toBe('MEDIA');

    const financePending = { ...payout, invoiceReviewStatus: '待财务审核' as const };
    const financeReturned = applyInvoiceReviewAction(
      financePending,
      'RETURN_FINANCE',
      actor,
      '金额不一致',
    );
    expect(financeReturned.invoiceReviewStatus).toBe('已退回');
    expect(financeReturned.invoiceReviewReturn?.stage).toBe('FINANCE');
  });

  it('resubmits both return states to media review', () => {
    const revision = { ...payout, invoiceReviewStatus: '待修改' as const };
    const financeReturn = { ...payout, invoiceReviewStatus: '已退回' as const };
    expect(applyInvoiceReviewAction(revision, 'RESUBMIT', actor).invoiceReviewStatus).toBe('待媒介审核');
    expect(applyInvoiceReviewAction(financeReturn, 'RESUBMIT', actor).invoiceReviewStatus).toBe('待媒介审核');
  });

  it('rejects invalid transitions and empty return reasons', () => {
    expect(() => createInvoiceReviewEvent('待媒介审核', 'APPROVE_FINANCE', actor)).toThrow();
    expect(() => createInvoiceReviewEvent('待媒介审核', 'RETURN_MEDIA', actor, '   ')).toThrow();
  });

  it('exposes actions only to the responsible role capability', () => {
    const media = { manage: false, mediaReview: true, financeReview: false };
    const projectOwner = { manage: false, mediaReview: true, financeReview: false };
    const finance = { manage: false, mediaReview: false, financeReview: true };
    const readOnly = { manage: false, mediaReview: false, financeReview: false };

    expect(getAvailableInvoiceReviewActions('待媒介审核', media)).toEqual(['APPROVE_MEDIA', 'RETURN_MEDIA']);
    expect(getAvailableInvoiceReviewActions('待媒介审核', projectOwner)).toEqual(['APPROVE_MEDIA', 'RETURN_MEDIA']);
    expect(getAvailableInvoiceReviewActions('待财务审核', finance)).toEqual(['APPROVE_FINANCE', 'RETURN_FINANCE']);
    expect(getAvailableInvoiceReviewActions('待媒介审核', readOnly)).toEqual([]);
  });

  it('links a signed generated Invoice only through sourcePayoutId', () => {
    const record: GeneratedInvoiceRecord = {
      id: 'INV-GENERATED',
      sourcePayoutId: payout.id,
      status: '待签署' as const,
      generatedAt: '2026-08-04 10:00',
      snapshot: {} as never,
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
  });
});
