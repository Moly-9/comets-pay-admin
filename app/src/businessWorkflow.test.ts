import { describe, expect, it } from 'vitest';
import {
  canEditProject,
  hasInvoiceForEngagement,
  nextReviewStatusAfterMutation,
  removePaymentListItem,
  upsertPaymentListItem,
  validateContractCoverage,
  validateProjectSubmission,
  type ContractId,
  type EngagementId,
  type InvoiceId,
  type PaymentListRecord,
  type ProjectId,
} from './businessWorkflow';

const roles = {
  admin: { roleKey: 'admin' as const },
  owner: { roleKey: 'owner' as const },
  media: { roleKey: 'media' as const },
  pm: { roleKey: 'pm' as const },
};

describe('project workflow permissions', () => {
  it('lets privileged roles edit all states and locks media after submission', () => {
    expect(canEditProject(roles.admin, 'approved')).toBe(true);
    expect(canEditProject(roles.owner, 'submitted')).toBe(true);
    expect(canEditProject(roles.media, 'draft')).toBe(true);
    expect(canEditProject(roles.media, 'returned')).toBe(true);
    expect(canEditProject(roles.media, 'submitted')).toBe(false);
    expect(canEditProject(roles.pm, 'draft')).toBe(false);
  });

  it('invalidates review when a privileged user edits submitted data', () => {
    expect(nextReviewStatusAfterMutation(roles.admin, 'submitted')).toBe('changes_required');
    expect(nextReviewStatusAfterMutation(roles.owner, 'approved')).toBe('changes_required');
    expect(nextReviewStatusAfterMutation(roles.media, 'draft')).toBe('draft');
  });
});

describe('contract coverage validation', () => {
  const contracts = [
    {
      contractId: 'contract-1' as ContractId,
      advertiser: 'Comets International Limited',
      publisher: 'Synthetic Creator Limited',
      currency: 'USD',
      totalFee: 300,
      paymentMethod: 'BANK',
    },
    {
      contractId: 'contract-2' as ContractId,
      advertiser: 'Comets International Limited',
      publisher: 'Synthetic Creator Limited',
      currency: 'USD',
      totalFee: 200,
      paymentMethod: 'BANK',
    },
  ];

  it('accepts a single invoice covering multiple consistent contracts', () => {
    expect(validateContractCoverage(contracts, {
      billTo: 'Comets International Limited',
      publisher: 'Synthetic Creator Limited',
      currency: 'USD',
      amount: 500,
      paymentMethod: 'BANK',
    })).toEqual([]);
  });

  it('reports amount and common-field conflicts', () => {
    const issues = validateContractCoverage(
      [{ ...contracts[0], currency: 'EUR' }, contracts[1]],
      {
        billTo: 'Other Entity',
        publisher: 'Synthetic Creator Limited',
        currency: 'USD',
        amount: 300,
        paymentMethod: 'BANK',
      },
    );
    expect(issues.map((issue) => issue.field)).toEqual(expect.arrayContaining(['advertiser', 'currency', 'amount']));
  });
});

describe('project payment list', () => {
  const invoiceId = 'invoice-1' as InvoiceId;
  const record: PaymentListRecord = {
    paymentListId: 'payment-list-1' as PaymentListRecord['paymentListId'],
    paymentListCode: 'PAY-20260804-TEST01',
    projectId: 'project-1' as ProjectId,
    status: 'draft',
    items: [],
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
  };
  const item = {
    id: 'item-1',
    engagementId: 'engagement-1' as EngagementId,
    invoiceId,
    snapshot: {
      invoiceNumber: 'INV-TEST',
      creatorName: 'Synthetic Creator',
      currency: 'USD',
      amount: 300,
      provider: 'Airwallex',
      accountSummary: 'Test account ending 0001',
    },
    overrides: {},
  };

  it('keeps one payment row per invoice and removes rows without deleting invoices', () => {
    const withItem = upsertPaymentListItem(record, item);
    expect(upsertPaymentListItem(withItem, item).items).toHaveLength(1);
    expect(removePaymentListItem(withItem, invoiceId).items).toEqual([]);
  });
});

describe('engagement invoice constraints', () => {
  const engagementId = 'engagement-1' as EngagementId;
  const invoiceId = 'invoice-1' as InvoiceId;
  const secondInvoiceId = 'invoice-2' as InvoiceId;

  it('allows only one linked invoice per engagement while excluding the current record', () => {
    const invoices = [{ invoiceId, engagementId, validationStatus: 'valid' as const }];
    expect(hasInvoiceForEngagement(invoices, engagementId)).toBe(true);
    expect(hasInvoiceForEngagement(invoices, engagementId, invoiceId)).toBe(false);
  });

  it('requires one valid invoice per engagement and every invoice in the payment list', () => {
    const validInvoices = [{ invoiceId, engagementId, validationStatus: 'valid' as const }];
    expect(validateProjectSubmission({
      engagementIds: [engagementId],
      invoices: validInvoices,
      paymentListInvoiceIds: [invoiceId],
    })).toEqual([]);

    expect(validateProjectSubmission({
      engagementIds: [engagementId],
      invoices: [
        ...validInvoices,
        { invoiceId: secondInvoiceId, engagementId, validationStatus: 'needs_review' as const },
      ],
      paymentListInvoiceIds: [invoiceId],
    })).toEqual(expect.arrayContaining([
      'INVOICE_COUNT',
      'PAYMENT_LIST_MISSING',
      'INVOICE_NEEDS_REVIEW',
    ]));
  });
});
