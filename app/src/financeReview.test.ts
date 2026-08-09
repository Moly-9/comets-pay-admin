import { describe, expect, it } from 'vitest';
import type { PaymentListRecord } from './businessWorkflow';
import { buildRequestFinanceReview } from './financeReview';
import type { PaymentRequestProjectLike } from './paymentRequestProjects';
import type { GeneratedInvoiceRecord } from './types';

const invoice = {
  id: 'INV-TEST',
  invoiceId: 'invoice-test',
  sourcePayoutId: 'payout-test',
  status: '待发起请款',
  generatedAt: '2026-08-09 10:00',
  validationStatus: 'valid',
  snapshot: {
    invoiceNumber: 'INV-TEST', invoiceDate: '2026-08-09',
    billTo: { name: 'COMETS', address: 'Hong Kong' },
    creatorHandle: '@creator', creatorName: 'Creator', creatorId: 'creator-test',
    engagementId: 'engagement-test', projectId: 'project-test', projectName: 'Project',
    from: { legalName: 'Creator', address: '', phone: '', email: '' },
    currency: 'USD',
    items: [{ id: 'line', description: 'Content service', unitPrice: 100, quantity: 1, lineTotal: 100 }],
    payoutAccountId: 'account-test', payoutAccountVersion: 2 as never,
    payoutAccountFingerprint: 'fingerprint-test', payoutProvider: 'Airwallex',
    paymentMethod: 'bank', payment: {},
  },
} as unknown as GeneratedInvoiceRecord;

const request: PaymentRequestProjectLike = {
  id: 'request-test',
  paymentRequestProjectId: 'request-test' as never,
  invoiceIds: [invoice.invoiceId],
};

const paymentList = (): PaymentListRecord => ({
  paymentListId: 'payment-list-test' as never,
  paymentListCode: 'PAY-TEST',
  projectId: invoice.snapshot.projectId,
  paymentRequestProjectId: request.paymentRequestProjectId,
  provider: 'Airwallex',
  status: 'submitted',
  items: [{
    id: 'item-test', engagementId: invoice.snapshot.engagementId!, invoiceId: invoice.invoiceId,
    snapshot: {
      invoiceNumber: invoice.id, creatorName: invoice.snapshot.creatorName,
      creatorId: invoice.snapshot.creatorId, currency: 'USD', receiveCurrency: 'USD', amount: 100,
      provider: 'Airwallex', accountSummary: '****0000', paymentReason: 'Content service',
      transactionReference: invoice.id, description: 'Content service', payoutAccountId: 'account-test',
      payoutAccountVersion: 2 as never, accountFingerprint: 'fingerprint-test', transferMethod: 'LOCAL',
      feeBearer: 'ADVERTISER',
    },
    overrides: {},
  }],
  createdAt: '2026-08-09T00:00:00.000Z', updatedAt: '2026-08-09T00:00:00.000Z',
});

describe('request finance review', () => {
  it('approves only a one-to-one matching invoice and payment row', () => {
    const review = buildRequestFinanceReview(request, [invoice], [paymentList()]);
    expect(review.canApprove).toBe(true);
    expect(review.matchedCount).toBe(1);
    expect(review.invoices[0].fields.some((field) => field.state === 'review')).toBe(true);
  });

  it('blocks amount mismatches and duplicate payment rows', () => {
    const amountMismatch = paymentList();
    amountMismatch.items[0].snapshot.amount = 99;
    expect(buildRequestFinanceReview(request, [invoice], [amountMismatch]).canApprove).toBe(false);

    const duplicate = paymentList();
    duplicate.items.push({ ...duplicate.items[0], id: 'item-duplicate' });
    expect(buildRequestFinanceReview(request, [invoice], [duplicate]).canApprove).toBe(false);
  });

  it('blocks payment rows that do not belong to the request', () => {
    const extra = paymentList();
    extra.items.push({
      ...extra.items[0],
      id: 'item-extra',
      invoiceId: 'invoice-extra' as never,
      snapshot: { ...extra.items[0].snapshot, invoiceNumber: 'INV-EXTRA' },
    });
    const review = buildRequestFinanceReview(request, [invoice], [extra]);
    expect(review.canApprove).toBe(false);
    expect(review.projectIssues[0]).toMatchObject({
      label: '付款清单额外明细',
      state: 'mismatch',
    });
  });
});
