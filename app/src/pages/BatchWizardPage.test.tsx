import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  beginPaymentFailureAccountRecovery,
  completePaymentFailureRevalidation,
  recordPaymentFailureNotification,
  simulateCreatorAccountUpdated,
} from '../paymentFailureRecovery';
import type { Payout } from '../types';
import { BatchWizardPage } from './BatchWizardPage';

const retryPayout = (): Payout => ({
  id: 'retry-payout',
  paymentRequestProjectId: 'request-1' as NonNullable<Payout['paymentRequestProjectId']>,
  creator: 'Retry Creator',
  creatorId: 'creator-1' as NonNullable<Payout['creatorId']>,
  handle: '@retry',
  initials: 'RC',
  projectId: 'project-1',
  project: 'Retry Project',
  contract: 'CON-1',
  invoice: 'INV-RETRY-1',
  provider: 'Airwallex',
  currency: 'USD',
  amount: 1800,
  account: 'prototype account',
  payoutAccountId: 'account-1',
  payoutAccountVersion: 'v1',
  payoutAccountFingerprint: 'fp-v1',
  externalBeneficiaryId: 'beneficiary-v1',
  transferMethod: 'LOCAL',
  localClearingSystem: 'ACH',
  feeBearer: 'ADVERTISER',
  status: '付款失败',
  invoiceReviewStatus: '已通过',
  accent: '#64748b',
  paymentFailure: {
    provider: 'Airwallex',
    errorCode: 'BENEFICIARY_DISABLED',
    providerResponse: 'Beneficiary disabled',
    occurredAt: '2026-08-10T10:00:00.000Z',
  },
  paymentFailureReturn: {
    issueType: 'PAYMENT_LIST',
    reason: '请更新收款账户',
    actorAccount: 'finance',
    actorName: '财务人员',
    occurredAt: '2026-08-10T10:05:00.000Z',
    restartStage: 'PAYMENT_LIST_RESUBMISSION',
  },
});

describe('BatchWizardPage payment failure retries', () => {
  it('shows an awaiting retry immediately, unchecked and disabled', () => {
    const payout = beginPaymentFailureAccountRecovery(retryPayout());
    const html = renderToStaticMarkup(
      <BatchWizardPage payouts={[payout]} onCancel={vi.fn()} onSubmit={vi.fn()} onDraft={vi.fn()} />,
    );

    expect(html).toContain('Retry Creator');
    expect(html).toContain('失败重试');
    expect(html).toContain('等待达人更新账户');
    expect(html).toContain('aria-label="选择 Retry Creator" type="checkbox" disabled=""');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" checked=""');
  });

  it('keeps a revalidated retry unchecked but makes it selectable', () => {
    const started = beginPaymentFailureAccountRecovery(retryPayout());
    const notified = recordPaymentFailureNotification(
      started,
      { account: 'media', name: '项目媒介' },
      '请更新收款账户',
      'creator@example.com',
    );
    const ready = completePaymentFailureRevalidation(simulateCreatorAccountUpdated(notified));
    const html = renderToStaticMarkup(
      <BatchWizardPage payouts={[ready]} onCancel={vi.fn()} onSubmit={vi.fn()} onDraft={vi.fn()} />,
    );

    expect(html).toContain('已重新校验，可重试');
    expect(html).toContain('aria-label="选择 Retry Creator" type="checkbox"');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" disabled=""');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" checked=""');
  });
});
