import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  beginPaymentFailureAccountRecovery,
  completePaymentFailureRevalidation,
  confirmPaymentFailureAccountChange,
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

  it('keeps a revalidated account blocked until finance confirms it', () => {
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

    expect(html).toContain('账户已校验，待财务确认');
    expect(html).toContain('aria-label="选择 Retry Creator" type="checkbox" disabled=""');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" checked=""');
  });

  it('makes a revalidated retry selectable after finance confirmation', () => {
    const started = beginPaymentFailureAccountRecovery(retryPayout());
    const notified = recordPaymentFailureNotification(
      started,
      { account: 'media', name: '项目媒介' },
      '请更新收款账户',
      'creator@example.com',
    );
    const pendingFinance = completePaymentFailureRevalidation(simulateCreatorAccountUpdated(notified));
    const ready = confirmPaymentFailureAccountChange(
      pendingFinance,
      { account: 'finance', name: '财务审核人' },
    );
    const html = renderToStaticMarkup(
      <BatchWizardPage payouts={[ready]} onCancel={vi.fn()} onSubmit={vi.fn()} onDraft={vi.fn()} />,
    );

    expect(html).toContain('已重新校验，可重试');
    expect(html).toContain('aria-label="选择 Retry Creator" type="checkbox"');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" disabled=""');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" checked=""');
  });

  it('refreshes the validation status as soon as the creator account update is recorded', () => {
    const notified = recordPaymentFailureNotification(
      beginPaymentFailureAccountRecovery(retryPayout()),
      { account: 'media', name: '项目媒介' },
      '请更新收款账户',
      'creator@example.com',
    );
    const updated = simulateCreatorAccountUpdated(notified);
    const html = renderToStaticMarkup(
      <BatchWizardPage payouts={[updated]} onCancel={vi.fn()} onSubmit={vi.fn()} onDraft={vi.fn()} />,
    );

    expect(html).toContain('达人已更新，待重新校验');
    expect(html).toContain('aria-label="选择 Retry Creator" type="checkbox" disabled=""');
  });

  it('makes an unchanged account selectable immediately after the failure notice', () => {
    const ready = recordPaymentFailureNotification(
      beginPaymentFailureAccountRecovery(retryPayout()),
      { account: 'media', name: '项目媒介' },
      '付款失败，请确认原账户是否仍可使用',
      'creator@example.com',
    );
    const html = renderToStaticMarkup(
      <BatchWizardPage payouts={[ready]} onCancel={vi.fn()} onSubmit={vi.fn()} onDraft={vi.fn()} />,
    );

    expect(html).toContain('已通知，可重试');
    expect(html).toContain('aria-label="选择 Retry Creator" type="checkbox"');
    expect(html).not.toContain('aria-label="选择 Retry Creator" type="checkbox" disabled=""');
  });
});
