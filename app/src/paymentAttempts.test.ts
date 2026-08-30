import { describe, expect, it } from 'vitest';
import {
  paymentAttemptAmountTotals,
  paymentAttemptSnapshotFor,
  withLatestFailedAttemptReturnReason,
  withPaymentAttemptSnapshot,
} from './paymentAttempts';
import type { Payout } from './types';

const payout = (): Payout => ({
  id: 'payout_attempt_test',
  creator: '测试达人',
  handle: '@attempt-test',
  initials: 'TA',
  projectId: 'project_attempt_test',
  project: '付款尝试测试项目',
  contract: 'CON-ATTEMPT',
  invoice: 'INV-ATTEMPT',
  provider: 'Airwallex',
  currency: 'USD',
  amount: 1_250,
  account: 'prototype-account',
  status: '付款处理中',
  invoiceReviewStatus: '已通过',
  accent: '#64748b',
  currentPaymentAttempt: {
    paymentBatchId: 'payment_batch_attempt_test' as NonNullable<Payout['currentPaymentAttempt']>['paymentBatchId'],
    paymentBatchCode: 'BAT-ATTEMPT-TEST',
    submittedAt: '2026-08-30T10:00:00.000Z',
    attemptNumber: 1,
  },
});

describe('payment attempt snapshots', () => {
  it('freezes a failed attempt fee without counting the untransferred principal', () => {
    const source = payout();
    const snapshot = paymentAttemptSnapshotFor({
      payout: source,
      status: '付款失败',
      occurredAt: '2026-08-30T10:05:00.000Z',
      transferFeeAmount: 2.5,
      transferFeeCurrency: 'USD',
      actualPaidAmount: 2.5,
      actualPaidCurrency: 'USD',
      recipientReceivedAmount: 0,
      recipientReceivedCurrency: 'USD',
      errorCode: 'PROTOTYPE_DECLINE',
      providerResponse: 'Prototype transfer declined.',
    });
    const failed = withPaymentAttemptSnapshot(source, snapshot);

    expect(failed.paymentAttempts).toEqual([
      expect.objectContaining({
        principalAmount: 1_250,
        transferFeeAmount: 2.5,
        actualPaidAmount: 2.5,
        recipientReceivedAmount: 0,
        status: '付款失败',
      }),
    ]);
  });

  it('preserves earlier attempts and attaches a later business return reason', () => {
    const source = payout();
    const first = withPaymentAttemptSnapshot(source, paymentAttemptSnapshotFor({
      payout: source,
      status: '付款失败',
      occurredAt: '2026-08-30T10:05:00.000Z',
      transferFeeAmount: 2.5,
      transferFeeCurrency: 'USD',
      actualPaidAmount: 2.5,
      actualPaidCurrency: 'USD',
    }));
    const returned = withLatestFailedAttemptReturnReason(first, '请更新收款账户。');

    expect(returned.paymentAttempts?.[0]).toMatchObject({
      status: '付款失败',
      returnReason: '请更新收款账户。',
    });
  });

  it('aggregates attempts by currency without double counting the same batch', () => {
    const duplicateBatchId = 'payment_batch_attempt_test' as NonNullable<Payout['currentPaymentAttempt']>['paymentBatchId'];
    const attempts = [
      {
        paymentBatchId: duplicateBatchId,
        attemptNumber: 1,
        status: '付款失败' as const,
        principalAmount: 1_250,
        principalCurrency: 'USD' as const,
        transferFeeAmount: 2,
        transferFeeCurrency: 'USD' as const,
      },
      {
        paymentBatchId: duplicateBatchId,
        attemptNumber: 1,
        status: '付款失败' as const,
        principalAmount: 1_250,
        principalCurrency: 'USD' as const,
        transferFeeAmount: 2.5,
        transferFeeCurrency: 'USD' as const,
      },
      {
        attemptNumber: 2,
        status: '已付款' as const,
        principalAmount: 1_250,
        principalCurrency: 'USD' as const,
        transferFeeAmount: 3,
        transferFeeCurrency: 'EUR' as const,
      },
    ];

    expect(paymentAttemptAmountTotals(attempts, 'transferFeeAmount', 'transferFeeCurrency')).toEqual([
      { currency: 'USD', amount: 2.5 },
      { currency: 'EUR', amount: 3 },
    ]);
  });
});
