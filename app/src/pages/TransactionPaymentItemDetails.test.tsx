import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PaymentBatchItemSnapshot } from '../paymentBatches';
import { PaymentItemDetails } from './PaymentBatchDetailPage';

const paymentItem = (overrides: Partial<PaymentBatchItemSnapshot> = {}): PaymentBatchItemSnapshot => ({
  payoutId: 'payout-transaction-detail',
  creatorName: 'Grace Lim',
  creatorHandle: '@grace',
  deliverable: '达人内容合作',
  paymentListCode: 'PAY-20260808-001',
  paymentListStatus: 'paid',
  paymentOrderCode: 'PAY-20260808-001',
  paymentAttemptNumber: 1,
  contracts: [],
  provider: 'Airwallex',
  amount: 4720,
  currency: 'SGD',
  receiveCurrency: 'SGD',
  transferMethod: 'LOCAL',
  localClearingSystem: '本地转账',
  recipientCountry: 'SG',
  accountSummary: '0000000018',
  payoutAccountVersion: 'legacy-v1',
  feeBearer: '广告主承担',
  paymentReason: '达人内容验收完成',
  transactionReference: 'REQ-20260808-000030-01',
  description: 'TikTok 短视频合作',
  paymentStatus: '已付款',
  paidAt: '2026-08-08T16:50',
  associationIssues: [],
  ...overrides,
});

describe('transaction payment detail cards', () => {
  it('renders every payment field as a semantic card and prefers the local clearing value', () => {
    const html = renderToStaticMarkup(<PaymentItemDetails item={paymentItem()} mode="payment-only" />);

    expect(html).toContain('class="is-payment-order"');
    expect(html).toContain('class="is-provider-method"');
    expect(html).toContain('Airwallex · LOCAL');
    expect(html).toContain('class="is-local-clearing"');
    expect(html).toContain('<dd>本地转账</dd>');
    expect(html).toContain('class="is-payment-reason is-wide"');
    expect(html).toContain('class="is-description is-wide"');
    expect(html).toContain('class="is-channel-writeback"');
    expect(html).toContain('<dt>渠道回写时间</dt><dd>2026-08-08 16:50</dd>');
  });

  it('uses the failed result time and keeps processing attempts pending', () => {
    const failedHtml = renderToStaticMarkup(<PaymentItemDetails item={paymentItem({
      paymentStatus: '付款失败',
      failure: {
        code: 'BENEFICIARY_UNAVAILABLE',
        response: 'The beneficiary is temporarily unavailable.',
        occurredAt: '2026-08-08T16:53',
      },
    })} mode="payment-only" />);
    const processingHtml = renderToStaticMarkup(<PaymentItemDetails item={paymentItem({
      paymentStatus: '付款处理中',
      paidAt: '2026-08-08T16:50',
    })} mode="payment-only" />);

    expect(failedHtml).toContain('<dt>渠道回写时间</dt><dd>2026-08-08 16:53</dd>');
    expect(processingHtml).toContain('<dt>渠道回写时间</dt><dd>待渠道回写</dd>');
  });

  it('uses a full-width responsive card grid without association side bars', () => {
    const css = readFileSync(new URL('./TransactionsPage.css', import.meta.url), 'utf8');

    expect(css).toContain('.transaction-payment-detail-modal .payment-batch-item-details');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(css).toMatch(/@media \(max-width: 860px\)[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@media \(max-width: 560px\)[\s\S]*?grid-template-columns: 1fr/);
    expect(css).not.toContain('box-shadow: inset 3px 0 0 var(--transaction-');
  });
});
