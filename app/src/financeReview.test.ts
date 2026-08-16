import { describe, expect, it } from 'vitest';
import type { PaymentListRecord } from './businessWorkflow';
import type { ContractRecord } from './contracts';
import {
  buildRequestFinanceReview,
  createFinanceReviewSession,
  financeReviewReturnItems,
  financeReviewReturnReason,
  financeReviewSessionCanApprove,
  financeReviewSessionCanReturn,
  reconcileFinanceReviewSession,
  setFinanceReviewDecision,
} from './financeReview';
import type { PaymentRequestProjectLike } from './paymentRequestProjects';
import type { GeneratedInvoiceRecord } from './types';

const invoicePaymentDetails = {
  bankCountry: 'United Kingdom',
  accountName: 'Creator',
  accountType: 'Checking',
  swiftCode: 'EXAMPLEXX',
  accountNumber: '1234567890',
  iban: 'GB82WEST12345698765432',
  beneficiaryType: 'Personal',
  bankName: 'Example Bank',
  bankStreetAddress: '1 Main Street',
  bankCity: 'London',
  bankState: 'Greater London',
  bankPostalCode: 'SW1A 1AA',
  intermediaryBankCountry: '',
  intermediaryBankCode: '',
  transferRemarks: '',
  paypalUsername: '',
  paypalEmail: '',
  payoutAccountId: 'account-test',
  payoutAccountVersion: 2 as never,
  payoutProvider: 'Airwallex' as const,
  accountFingerprint: 'fingerprint-test',
  transferMethod: 'LOCAL' as const,
};

const invoice = {
  id: 'INV-TEST',
  invoiceId: 'invoice-test',
  sourcePayoutId: 'payout-test',
  status: '已通过',
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
    paymentMethod: 'bank', payment: invoicePaymentDetails,
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
      realName: invoice.snapshot.from.legalName,
      creatorId: invoice.snapshot.creatorId, currency: 'USD', receiveCurrency: 'USD', amount: 100,
      provider: 'Airwallex', accountSummary: '****0000', paymentReason: 'Content service',
      transactionReference: invoice.id, description: 'Content service', payoutAccountId: 'account-test',
      payoutAccountVersion: 2 as never, accountFingerprint: 'fingerprint-test', transferMethod: 'LOCAL',
      feeBearer: 'ADVERTISER',
      paymentDetails: { ...invoicePaymentDetails },
    },
    overrides: {},
  }],
  createdAt: '2026-08-09T00:00:00.000Z', updatedAt: '2026-08-09T00:00:00.000Z',
});

const contract = (overrides: Partial<ContractRecord> = {}): ContractRecord => ({
  contractId: 'contract-test' as never,
  id: 'CON-TEST',
  ioId: 'IO-TEST',
  name: 'Creator · 合作合同',
  templateFamily: 'test',
  sourceName: 'CON-TEST.pdf',
  documentUrl: '',
  isTemplate: false,
  project: 'Project',
  brand: 'Brand',
  advertiser: 'COMETS',
  publisher: 'Creator',
  channelName: '@creator',
  channelLink: '',
  platform: 'YouTube',
  effectiveDate: '2026-08-09',
  campaignStart: '2026-08-09',
  campaignEnd: '2026-09-09',
  currency: 'USD',
  totalFee: 100,
  licensePrice: null,
  licenseIncludedInTotal: true,
  invoiceWithinWorkingDays: 5,
  paymentWithinWorkingDays: 45,
  feeBearer: 'ADVERTISER',
  paymentMethod: 'BANK',
  accountName: 'Creator',
  accountFingerprint: 'fingerprint-test',
  payoutAccountId: 'account-test',
  payoutAccountVersion: 2 as never,
  payoutProvider: 'Airwallex',
  payoutAccountFingerprint: 'fingerprint-test',
  paymentSnapshot: { ...invoicePaymentDetails },
  signed: true,
  status: '已生效',
  updated: '2026-08-09',
  deliverables: [],
  issues: [],
  creatorId: 'creator-test' as never,
  engagementId: 'engagement-test' as never,
  ...overrides,
});

const requestWithContract = {
  ...request,
  creatorLinks: [{
    creatorId: 'creator-test' as never,
    engagementId: 'engagement-test' as never,
    contractIds: ['contract-test'] as never,
    invoiceIds: [invoice.invoiceId],
  }],
};

describe('request finance review', () => {
  it('approves only a one-to-one matching invoice and payment row', () => {
    const review = buildRequestFinanceReview(request, [invoice], [paymentList()]);
    expect(review.canApprove).toBe(true);
    expect(review.matchedCount).toBe(1);
    expect(review.invoices[0].fields.some((field) => field.state === 'review')).toBe(true);
    expect(review.invoices[0].fields.filter((field) => [
      'real-name',
      'account-name',
      'account-number',
      'bank-name',
      'bank-address',
      'swift-code',
      'iban',
    ].includes(field.id)).every((field) => field.state === 'match')).toBe(true);
    expect(review.invoices[0].fields.find((field) => field.id === 'reason')).toMatchObject({
      invoiceValue: '影音服务',
      paymentValue: 'Content service',
      state: 'review',
    });
  });

  it('shows a dash for missing contracts without adding a blocking difference', () => {
    const review = buildRequestFinanceReview(request, [invoice], [paymentList()]);
    const amount = review.pages[0].fields.find((field) => field.id === 'amount');
    expect(amount).toMatchObject({ contractValue: '—', state: 'match' });
    expect(review.warningCount).toBe(0);
    expect(review.canApprove).toBe(true);
  });

  it('treats non-name contract differences as yellow non-blocking warnings', () => {
    const review = buildRequestFinanceReview(
      requestWithContract,
      [{ ...invoice, snapshot: { ...invoice.snapshot, contractIds: ['contract-test'] as never[] } }],
      [paymentList()],
      [contract({ totalFee: 120 })],
    );
    expect(review.canApprove).toBe(true);
    expect(review.mismatchCount).toBe(0);
    expect(review.warningCount).toBeGreaterThan(0);
    expect(review.pages[0].fields.find((field) => field.id === 'amount')).toMatchObject({
      contractValue: 'USD 120.00',
      state: 'warning',
      warning: '合同信息需核对',
    });
  });

  it('blocks a Real Name difference from the contract', () => {
    const review = buildRequestFinanceReview(
      requestWithContract,
      [{ ...invoice, snapshot: { ...invoice.snapshot, contractIds: ['contract-test'] as never[] } }],
      [paymentList()],
      [contract({ publisher: 'Different Name' })],
    );
    expect(review.canApprove).toBe(false);
    expect(review.pages[0].fields.find((field) => field.id === 'real-name')).toMatchObject({
      contractValue: 'Different Name',
      state: 'mismatch',
    });
  });

  it('keeps manual reason and reference checks non-blocking by default', () => {
    const review = buildRequestFinanceReview(request, [invoice], [paymentList()]);
    expect(review.pages[0].fields.filter((field) => ['reason', 'reference'].includes(field.id))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'reason', state: 'review' }),
        expect.objectContaining({ id: 'reference', state: 'review' }),
      ]),
    );
    expect(review.canApprove).toBe(true);
  });

  it('merges multiple contract values by contract number and counts their warnings', () => {
    const secondContract = contract({
      contractId: 'contract-test-2' as never,
      id: 'CON-TEST-2',
      totalFee: 110,
    });
    const multiContractRequest = {
      ...requestWithContract,
      creatorLinks: [{
        ...requestWithContract.creatorLinks![0],
        contractIds: ['contract-test', 'contract-test-2'] as never,
      }],
    };
    const review = buildRequestFinanceReview(
      multiContractRequest,
      [{ ...invoice, snapshot: { ...invoice.snapshot, contractIds: ['contract-test', 'contract-test-2'] as never[] } }],
      [paymentList()],
      [contract(), secondContract],
    );
    expect(review.pages[0].fields.find((field) => field.id === 'amount')).toMatchObject({
      contractValue: 'USD 100.00\nUSD 110.00',
      state: 'warning',
    });
  });

  it('blocks approval when a complete account snapshot differs from the Invoice', () => {
    const mismatched = paymentList();
    mismatched.items[0].snapshot.paymentDetails = {
      ...mismatched.items[0].snapshot.paymentDetails!,
      accountNumber: '9999999999',
    };

    const review = buildRequestFinanceReview(request, [invoice], [mismatched]);
    expect(review.canApprove).toBe(false);
    expect(review.pages[0].fields.find((field) => field.id === 'account-number')).toMatchObject({
      label: 'Account Number',
      invoiceValue: '1234567890',
      paymentValue: '9999999999',
      state: 'mismatch',
    });
  });

  it('normalizes account spacing and letter case without hiding real differences', () => {
    const normalized = paymentList();
    normalized.items[0].snapshot.realName = '  creator  ';
    normalized.items[0].snapshot.paymentDetails = {
      ...normalized.items[0].snapshot.paymentDetails!,
      accountName: 'creator',
      accountNumber: '1234 567 890',
      bankName: 'example bank',
      bankStreetAddress: '1   main street',
      bankCity: 'london',
      bankState: 'greater london',
      bankPostalCode: 'sw1a 1aa',
      bankCountry: 'united kingdom',
      swiftCode: 'example xx',
      iban: 'gb82 west 1234 5698 7654 32',
    };

    const review = buildRequestFinanceReview(request, [invoice], [normalized]);
    expect(review.mismatchCount).toBe(0);
    expect(review.canApprove).toBe(true);
  });

  it('treats a missing full payment-account snapshot as a blocking mismatch', () => {
    const missing = paymentList();
    delete missing.items[0].snapshot.paymentDetails;

    const review = buildRequestFinanceReview(request, [invoice], [missing]);
    expect(review.canApprove).toBe(false);
    expect(review.pages[0].fields.find((field) => field.id === 'bank-name')).toMatchObject({
      paymentValue: '未填写',
      state: 'mismatch',
    });
  });

  it('blocks a single missing payment field instead of treating two empty values as equal', () => {
    const missing = paymentList();
    missing.items[0].snapshot.paymentDetails = {
      ...missing.items[0].snapshot.paymentDetails!,
      accountNumber: '',
    };

    const review = buildRequestFinanceReview(request, [invoice], [missing]);
    expect(review.canApprove).toBe(false);
    expect(review.pages[0].fields.find((field) => field.id === 'account-number')).toMatchObject({
      invoiceValue: '1234567890',
      paymentValue: '未填写',
      state: 'mismatch',
    });
  });

  it('blocks amount mismatches and duplicate payment rows', () => {
    const amountMismatch = paymentList();
    amountMismatch.items[0].snapshot.amount = 99;
    const amountReview = buildRequestFinanceReview(request, [invoice], [amountMismatch]);
    expect(amountReview.canApprove).toBe(false);
    expect(amountReview.pages[0].kind).toBe('pair');

    const duplicate = paymentList();
    duplicate.items.push({ ...duplicate.items[0], id: 'item-duplicate' });
    const duplicateReview = buildRequestFinanceReview(request, [invoice], [duplicate]);
    expect(duplicateReview.canApprove).toBe(false);
    expect(duplicateReview.pages[0]).toMatchObject({
      kind: 'duplicate-payment',
      paymentItems: [{ itemId: 'item-test' }, { itemId: 'item-duplicate' }],
    });
  });

  it('creates explicit pages for missing invoice and missing payment records', () => {
    expect(buildRequestFinanceReview(request, [], [paymentList()]).pages[0].kind).toBe('missing-invoice');
    expect(buildRequestFinanceReview(request, [invoice], []).pages[0].kind).toBe('missing-payment');
  });

  it('creates a returnable blocking page when the request has no review records', () => {
    const emptyRequest = { ...request, invoiceIds: [] };
    const review = buildRequestFinanceReview(emptyRequest, [], []);
    expect(review.pages).toHaveLength(1);
    expect(review.pages[0]).toMatchObject({
      kind: 'empty-request',
      invoiceNumber: '未关联 Invoice',
      mismatchCount: 1,
    });
    expect(review.canApprove).toBe(false);
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
    expect(review.pages[1]).toMatchObject({
      kind: 'extra-payment',
      invoiceNumber: 'INV-EXTRA',
    });
    expect(review.pageCount).toBe(2);
  });

  it('requires every stable page to be manually confirmed for the current fingerprint', () => {
    const review = buildRequestFinanceReview(request, [invoice], [paymentList()]);
    const initial = createFinanceReviewSession({
      requestId: request.id,
      approvalRound: 1,
      reviewerAccount: 'finance.test',
      review,
    });
    expect(financeReviewSessionCanApprove(initial, review)).toBe(false);

    const confirmed = setFinanceReviewDecision(initial, review.pages[0].key, {
      state: 'correct',
      reviewedAt: '2026-08-09T10:00:00.000Z',
    });
    expect(financeReviewSessionCanApprove(confirmed, review)).toBe(true);

    const changedList = paymentList();
    changedList.items[0].snapshot.paymentReason = 'Changed reason';
    const changedReview = buildRequestFinanceReview(request, [invoice], [changedList]);
    const reconciled = reconcileFinanceReviewSession(confirmed, {
      requestId: request.id,
      approvalRound: 1,
      reviewerAccount: 'finance.test',
      review: changedReview,
    });
    expect(changedReview.fingerprint).not.toBe(review.fingerprint);
    expect(reconciled.decisions[changedReview.pages[0].key]).toEqual({ state: 'unreviewed' });
    expect(financeReviewSessionCanApprove(reconciled, changedReview)).toBe(false);

    const versionedReview = buildRequestFinanceReview(
      request,
      [{ ...invoice, version: (invoice.version ?? 0) + 1 }],
      [paymentList()],
    );
    expect(versionedReview.pages[0].fields).toEqual(review.pages[0].fields);
    expect(versionedReview.fingerprint).not.toBe(review.fingerprint);
    expect(financeReviewSessionCanApprove(confirmed, versionedReview)).toBe(false);
  });

  it('aggregates incorrect reasons by Invoice number', () => {
    const review = buildRequestFinanceReview(request, [invoice], [paymentList()]);
    const initial = createFinanceReviewSession({
      requestId: request.id,
      approvalRound: 1,
      reviewerAccount: 'finance.test',
      review,
    });
    const incorrect = setFinanceReviewDecision(initial, review.pages[0].key, {
      state: 'incorrect',
      issueType: 'INVOICE_CONTENT',
      reason: '收款账户与 Invoice 不一致',
      reviewedAt: '2026-08-09T10:00:00.000Z',
    });
    expect(financeReviewReturnReason(incorrect, review)).toBe('INV-TEST（Invoice）：收款账户与 Invoice 不一致');
    expect(financeReviewReturnItems(incorrect, review)).toEqual([{
      pageKey: review.pages[0].key,
      invoiceId: invoice.invoiceId,
      invoiceNumber: 'INV-TEST',
      issueType: 'INVOICE_CONTENT',
      reason: '收款账户与 Invoice 不一致',
      paymentItems: [{ paymentListId: 'payment-list-test', itemId: 'item-test' }],
    }]);
  });

  it('allows a finance return only after every page is reviewed and at least one is incorrect', () => {
    const baseReview = buildRequestFinanceReview(request, [invoice], [paymentList()]);
    const review = {
      ...baseReview,
      pageCount: 2,
      pages: [
        baseReview.pages[0],
        { ...baseReview.pages[0], key: 'invoice:second', invoiceNumber: 'INV-SECOND' },
      ],
    };
    const initial = createFinanceReviewSession({
      requestId: request.id,
      approvalRound: 1,
      reviewerAccount: 'finance.test',
      review,
    });
    const oneIncorrect = setFinanceReviewDecision(initial, review.pages[0].key, {
      state: 'incorrect',
      issueType: 'PAYMENT_LIST',
      reason: '收款账户与 Invoice 不一致',
      reviewedAt: '2026-08-09T10:00:00.000Z',
    });

    expect(financeReviewSessionCanReturn(initial, review)).toBe(false);
    expect(financeReviewSessionCanReturn(oneIncorrect, review)).toBe(false);

    const allReviewed = setFinanceReviewDecision(oneIncorrect, review.pages[1].key, {
      state: 'correct',
      reviewedAt: '2026-08-09T10:01:00.000Z',
    });
    expect(financeReviewSessionCanReturn(allReviewed, review)).toBe(true);

    const allCorrect = setFinanceReviewDecision(
      setFinanceReviewDecision(initial, review.pages[0].key, {
        state: 'correct',
        reviewedAt: '2026-08-09T10:00:00.000Z',
      }),
      review.pages[1].key,
      { state: 'correct', reviewedAt: '2026-08-09T10:01:00.000Z' },
    );
    expect(financeReviewSessionCanReturn(allCorrect, review)).toBe(false);
    expect(financeReviewSessionCanReturn({
      ...allReviewed,
      decisions: { [review.pages[0].key]: allReviewed.decisions[review.pages[0].key] },
    }, review)).toBe(false);
    expect(financeReviewSessionCanReturn(setFinanceReviewDecision(
      oneIncorrect,
      review.pages[1].key,
      { state: 'incorrect', issueType: 'PAYMENT_LIST', reason: '   ', reviewedAt: '2026-08-09T10:01:00.000Z' },
    ), review)).toBe(false);
    expect(financeReviewSessionCanReturn({
      ...allReviewed,
      decisions: {
        ...allReviewed.decisions,
        [review.pages[0].key]: {
          state: 'incorrect',
          reason: '缺少问题类型',
          reviewedAt: '2026-08-09T10:01:00.000Z',
        } as never,
      },
    }, review)).toBe(false);
    expect(financeReviewSessionCanReturn(
      { ...allReviewed, fingerprint: 'stale-fingerprint' },
      review,
    )).toBe(false);
  });
});
