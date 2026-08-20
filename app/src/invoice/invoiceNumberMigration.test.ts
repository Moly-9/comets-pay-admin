import { describe, expect, it } from 'vitest';
import type { InvoiceId, PaymentListRecord } from '../businessWorkflow';
import type { GeneratedInvoiceRecord, InvoiceDocumentModel, Payout } from '../types';
import { normalizeInvoiceResourceNumbers } from './invoiceNumberMigration';

const snapshot = (invoiceNumber: string, invoiceDate: string): InvoiceDocumentModel => ({
  invoiceNumber,
  invoiceDate,
  billTo: { name: 'Advertiser', address: 'Address' },
  creatorHandle: '@creator',
  creatorName: 'Creator',
  projectId: 'project-1' as never,
  projectName: 'Project',
  from: { legalName: 'Creator', address: 'Address', phone: '000', email: 'creator@example.com' },
  currency: 'USD',
  items: [{ id: 'line', description: 'Service', unitPrice: 100, quantity: 1, lineTotal: 100 }],
  paymentMethod: 'paypal',
  payment: {
    bankCountry: '', accountName: '', accountType: '', swiftCode: '', accountNumber: '', iban: '', beneficiaryType: '',
    bankName: '', bankStreetAddress: '', bankCity: '', bankState: '', bankPostalCode: '', intermediaryBankCountry: '',
    intermediaryBankCode: '', transferRemarks: '', paypalUsername: 'Creator', paypalEmail: 'creator@example.com',
  },
});

const invoice = (
  invoiceId: string,
  sourcePayoutId: string,
  invoiceDate: string,
  generatedAt: string,
): GeneratedInvoiceRecord => ({
  id: `INV-LEGACY-${invoiceId}`,
  invoiceId: invoiceId as InvoiceId,
  sourcePayoutId,
  status: '已通过',
  generatedAt,
  snapshot: snapshot(`INV-LEGACY-${invoiceId}`, invoiceDate),
  validationStatus: 'valid',
  version: 2,
  revisions: [{
    version: 1,
    snapshot: snapshot(`INV-OLDER-${invoiceId}`, invoiceDate),
    changedFields: ['items'],
    reason: 'test',
    actorAccount: 'media',
    actorName: 'Media',
    actorRole: '媒介账号',
    occurredAt: generatedAt,
  }],
});

const payout = (id: string, invoiceNumber: string, invoiceSnapshot?: InvoiceDocumentModel): Payout => ({
  id,
  creator: 'Creator',
  handle: '@creator',
  initials: 'CR',
  projectId: 'project-1',
  project: 'Project',
  contract: 'CON-1',
  invoice: invoiceNumber,
  provider: 'PayPal',
  currency: 'USD',
  amount: 100,
  account: 'creator@example.com',
  status: '未进入付款',
  invoiceReviewStatus: '已通过',
  invoiceSnapshot,
  accent: '#000000',
});

describe('prototype Invoice number migration', () => {
  it('reorders each day and synchronizes stable references, versions and revisions', () => {
    const later = invoice('invoice-b', 'payout-b', '2026-08-20', '2026-08-20T11:00:00.000Z');
    const earlier = invoice('invoice-a', 'payout-a', '2026-08-20', '2026-08-20T09:00:00.000Z');
    const paymentList = {
      paymentListId: 'payment-list-1',
      paymentListCode: 'PAY-1',
      projectId: 'project-1',
      provider: 'PayPal',
      status: 'submitted',
      version: 1,
      items: [{
        id: 'item-a',
        engagementId: 'engagement-a',
        invoiceId: earlier.invoiceId,
        snapshot: { invoiceNumber: earlier.id },
        overrides: {},
      }],
      versions: [{
        version: 1,
        generatedAt: '2026-08-20T12:00:00.000Z',
        generatedBy: { account: 'media', name: 'Media', role: '媒介账号' },
        items: [{
          id: 'item-a-v1',
          engagementId: 'engagement-a',
          invoiceId: earlier.invoiceId,
          snapshot: { invoiceNumber: earlier.id },
          overrides: {},
        }],
      }],
      createdAt: '2026-08-20T12:00:00.000Z',
      updatedAt: '2026-08-20T12:00:00.000Z',
    } as PaymentListRecord;

    const result = normalizeInvoiceResourceNumbers({
      invoices: [later, earlier],
      payouts: [payout('payout-b', later.id, later.snapshot), payout('payout-a', earlier.id, earlier.snapshot)],
      paymentLists: [paymentList],
    });
    const normalizedEarlier = result.invoices.find((item) => item.invoiceId === earlier.invoiceId)!;
    const normalizedLater = result.invoices.find((item) => item.invoiceId === later.invoiceId)!;

    expect(normalizedEarlier.id).toBe('INV-20260820-00001');
    expect(normalizedLater.id).toBe('INV-20260820-00002');
    expect(normalizedEarlier.snapshot.invoiceNumber).toBe(normalizedEarlier.id);
    expect(normalizedEarlier.revisions?.[0].snapshot.invoiceNumber).toBe(normalizedEarlier.id);
    expect(result.payouts.find((item) => item.id === 'payout-a')?.invoice).toBe(normalizedEarlier.id);
    expect(result.paymentLists[0].items[0].snapshot.invoiceNumber).toBe(normalizedEarlier.id);
    expect(result.paymentLists[0].versions?.[0].items[0].snapshot.invoiceNumber).toBe(normalizedEarlier.id);
  });

  it('uses a legacy number date only when a standalone Payout has no snapshot date', () => {
    const result = normalizeInvoiceResourceNumbers({
      invoices: [],
      payouts: [payout('orphan-payout', 'INV-240718')],
      paymentLists: [],
    });
    expect(result.payouts[0].invoice).toBe('INV-20240718-00001');
  });

  it('fails fixtures that have neither a valid Date of Invoice nor a parseable legacy date', () => {
    expect(() => normalizeInvoiceResourceNumbers({
      invoices: [invoice('invoice-invalid', 'payout-invalid', '', '2026-08-20T09:00:00.000Z')],
      payouts: [],
      paymentLists: [],
    })).toThrow('缺少有效 Invoice 日期');
  });
});
