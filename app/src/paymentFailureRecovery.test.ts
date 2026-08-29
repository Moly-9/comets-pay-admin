import { describe, expect, it } from 'vitest';
import {
  beginPaymentFailureAccountRecovery,
  completePaymentFailureRevalidation,
  confirmPaymentFailureAccountChange,
  isPaymentFailureRetryCandidate,
  isPaymentFailureRetryReady,
  markPaymentFailureRetrySubmitted,
  paymentFailureRecoveryLabel,
  paymentFailureRevalidationIssues,
  recordPaymentFailureNotification,
  simulateCreatorAccountUpdated,
} from './paymentFailureRecovery';
import type { Payout } from './types';

const failedPayout = (overrides: Partial<Payout> = {}): Payout => ({
  id: 'payout_failed_1',
  paymentRequestProjectId: 'request_failed_1' as NonNullable<Payout['paymentRequestProjectId']>,
  creator: 'Mina Kato',
  creatorId: 'creator_1' as NonNullable<Payout['creatorId']>,
  handle: '@mina',
  initials: 'MK',
  projectId: 'project_1',
  project: 'COMETS 内容项目',
  contract: 'CON-001',
  invoice: 'INV-001',
  provider: 'Airwallex',
  currency: 'USD',
  amount: 1250,
  account: 'prototype-account',
  payoutAccountId: 'account_1',
  payoutAccountVersion: 'v2',
  payoutAccountFingerprint: 'fp_old',
  externalBeneficiaryId: 'beneficiary_old',
  status: '付款失败',
  invoiceReviewStatus: '已通过',
  accent: '#64748b',
  paymentFailure: {
    provider: 'Airwallex',
    errorCode: 'BENEFICIARY_DISABLED',
    providerResponse: 'The beneficiary is disabled.',
    occurredAt: '2026-08-10T10:00:00.000Z',
  },
  paymentFailureReturn: {
    issueType: 'PAYMENT_LIST',
    reason: '收款账户不可用，请达人更新账户。',
    actorAccount: 'finance',
    actorName: '财务人员',
    occurredAt: '2026-08-10T10:05:00.000Z',
    restartStage: 'PAYMENT_LIST_RESUBMISSION',
  },
  ...overrides,
});

const startRecovery = () => beginPaymentFailureAccountRecovery(failedPayout());

describe('payment failure recovery', () => {
  it('creates an unselectable retry candidate without changing invoice approval', () => {
    const payout = startRecovery();

    expect(payout.status).toBe('已退回');
    expect(payout.invoiceReviewStatus).toBe('已通过');
    expect(payout.paymentFailureRecovery?.status).toBe('AWAITING_CREATOR_UPDATE');
    expect(isPaymentFailureRetryCandidate(payout)).toBe(true);
    expect(isPaymentFailureRetryReady(payout)).toBe(false);
  });

  it('records in-app and Gmail outcomes, including a missing creator email', () => {
    const withEmail = recordPaymentFailureNotification(
      startRecovery(),
      { account: 'media', name: '项目媒介' },
      '请更新收款账户。',
      'mina@example.com',
      '2026-08-10T10:10:00.000Z',
    );
    const withoutEmail = recordPaymentFailureNotification(
      startRecovery(),
      { account: 'media', name: '项目媒介' },
      '请更新收款账户。',
      '',
      '2026-08-10T10:11:00.000Z',
    );

    expect(withEmail.paymentFailureRecovery?.notifications[0]?.deliveries).toEqual([
      expect.objectContaining({ channel: 'IN_APP', status: 'SIMULATED_SENT' }),
      expect.objectContaining({ channel: 'GMAIL', status: 'SIMULATED_SENT' }),
    ]);
    expect(withoutEmail.paymentFailureRecovery?.notifications[0]?.deliveries[1]).toMatchObject({
      channel: 'GMAIL',
      status: 'SKIPPED_MISSING_RECIPIENT',
    });
    expect(withEmail.paymentFailureRecovery).toMatchObject({
      status: 'READY_FOR_RETRY',
      readyReason: 'ACCOUNT_UNCHANGED',
    });
    expect(isPaymentFailureRetryReady(withEmail)).toBe(true);
  });

  it('requires a notification before accepting the simulated creator update', () => {
    expect(() => simulateCreatorAccountUpdated(startRecovery())).toThrow('请先向达人发送付款失败通知');
  });

  it('keeps concrete account mismatches blocked and becomes ready only after all identities match', () => {
    const notified = recordPaymentFailureNotification(
      startRecovery(),
      { account: 'media', name: '项目媒介' },
      '请更新收款账户。',
      'mina@example.com',
      '2026-08-10T10:10:00.000Z',
    );
    const updated = simulateCreatorAccountUpdated(notified, '2026-08-10T10:20:00.000Z');
    const mismatches = paymentFailureRevalidationIssues(updated, {
      payoutAccountId: 'account_1',
      payoutAccountVersion: 'v1',
      accountFingerprint: 'wrong-fingerprint',
      externalBeneficiaryId: 'wrong-beneficiary',
    });
    const blocked = completePaymentFailureRevalidation(updated, '2026-08-10T10:30:00.000Z', mismatches);

    expect(mismatches).toEqual([
      '收款账户版本与达人反馈不一致',
      '收款账户资料指纹与达人反馈不一致',
      'Airwallex beneficiary_id 与达人反馈不一致',
    ]);
    expect(blocked.paymentFailureRecovery?.status).toBe('CREATOR_UPDATED');
    expect(blocked.paymentFailureRecovery?.revalidationIssues).toEqual(mismatches);
    expect(isPaymentFailureRetryReady(blocked)).toBe(false);

    const recovery = updated.paymentFailureRecovery!;
    const pendingFinance = completePaymentFailureRevalidation(updated, '2026-08-10T10:31:00.000Z', paymentFailureRevalidationIssues(updated, {
      payoutAccountId: updated.payoutAccountId,
      payoutAccountVersion: recovery.reportedPayoutAccountVersion,
      accountFingerprint: recovery.reportedAccountFingerprint,
      externalBeneficiaryId: recovery.reportedExternalBeneficiaryId,
    }));
    const ready = confirmPaymentFailureAccountChange(
      pendingFinance,
      { account: 'finance', name: '财务人员' },
      '2026-08-10T10:32:00.000Z',
    );

    expect(pendingFinance.paymentFailureRecovery?.status).toBe('PENDING_FINANCE_CONFIRMATION');
    expect(isPaymentFailureRetryReady(pendingFinance)).toBe(false);
    expect(ready.paymentFailureRecovery?.status).toBe('READY_FOR_RETRY');
    expect(ready.paymentFailureRecovery?.financeConfirmedByAccount).toBe('finance');
    expect(ready.paymentListValidationIssues).toEqual([]);
    expect(isPaymentFailureRetryReady(ready)).toBe(true);
  });

  it('removes a submitted retry from candidates and preserves the attempt if it fails again', () => {
    const notified = recordPaymentFailureNotification(
      startRecovery(),
      { account: 'media', name: '项目媒介' },
      '请更新收款账户。',
      'mina@example.com',
    );
    const creatorUpdated = simulateCreatorAccountUpdated(notified);
    const pendingFinance = completePaymentFailureRevalidation(creatorUpdated);
    const ready = confirmPaymentFailureAccountChange(
      pendingFinance,
      { account: 'finance', name: '财务人员' },
    );
    const submitted = markPaymentFailureRetrySubmitted(ready, 'batch_retry_1', 'BAT-RETRY-001');
    const succeeded = {
      ...submitted,
      status: '已付款' as const,
      paymentFailureRecovery: submitted.paymentFailureRecovery ? {
        ...submitted.paymentFailureRecovery,
        status: 'RETRY_SUCCEEDED' as const,
        retrySucceededAt: '2026-08-11T10:00:00.000Z',
      } : undefined,
    };
    const failedAgain = beginPaymentFailureAccountRecovery({ ...submitted, status: '付款失败' });

    expect(isPaymentFailureRetryCandidate(submitted)).toBe(false);
    expect(submitted.status).toBe('付款处理中');
    expect(paymentFailureRecoveryLabel(submitted)).toBe('付款处理中');
    expect(submitted.paymentFailureRecovery?.retryBatchCode).toBe('BAT-RETRY-001');
    expect(isPaymentFailureRetryCandidate(succeeded)).toBe(false);
    expect(paymentFailureRecoveryLabel(succeeded)).toBe('重试付款成功');
    expect(failedAgain.paymentFailureRecovery?.status).toBe('AWAITING_CREATOR_UPDATE');
    expect(failedAgain.paymentFailureRecovery?.previousAttempts).toEqual([
      expect.objectContaining({
        status: 'RETRY_SUBMITTED',
        retryBatchCode: 'BAT-RETRY-001',
        failureCode: 'BENEFICIARY_DISABLED',
        returnReason: '收款账户不可用，请达人更新账户。',
      }),
    ]);
  });

  it('never treats an Invoice-content return as a retry candidate', () => {
    const invoiceReturn = failedPayout({
      paymentFailureReturn: {
        ...failedPayout().paymentFailureReturn!,
        issueType: 'INVOICE_CONTENT',
        restartStage: 'SIGNATURE',
      },
    });

    expect(isPaymentFailureRetryCandidate(invoiceReturn)).toBe(false);
  });
});
