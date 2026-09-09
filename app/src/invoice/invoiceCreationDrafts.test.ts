import { describe, expect, it } from 'vitest';
import {
  invoiceBatchDraftGeneratedCount,
  invoiceBatchDraftHasPendingRows,
  invoiceCreationDraftStorageKey,
  invoiceSingleDraftHasMeaningfulContent,
  parseInvoiceCreationDrafts,
  removeInvoiceCreationDraft,
  upsertInvoiceCreationDraft,
} from './invoiceCreationDrafts';
import type { InvoiceBatchDraft, InvoiceSingleCreationDraft } from '../types';
import { createPrototypeId } from '../businessWorkflow';

const singleDraft = (overrides: Partial<InvoiceSingleCreationDraft> = {}): InvoiceSingleCreationDraft => ({
  draftId: 'draft-single-1',
  schemaVersion: '1.0',
  kind: 'SINGLE',
  createdByAccount: 'jeff',
  createdByName: 'Jeff',
  createdAt: '2026-09-09T01:00:00.000Z',
  updatedAt: '2026-09-09T01:00:00.000Z',
  creatorId: '',
  creatorSocialAccountId: '',
  projectId: '',
  engagementId: '',
  contractIds: [],
  invoiceDate: '2026-09-09',
  selectedBillingEntityId: 'entity-1',
  billTo: { name: 'COMETS', address: '' },
  from: { legalName: '', address: '', phone: '', email: '' },
  currency: 'USD',
  items: [{ id: 'item-1', description: '', unitPrice: 0, quantity: 0, lineTotal: 0 }],
  payoutAccountId: '',
  payment: {
    bankCountry: '', accountName: '', accountType: '', swiftCode: '', accountNumber: '', iban: '',
    beneficiaryType: '', bankName: '', bankStreetAddress: '', bankCity: '', bankState: '', bankPostalCode: '',
    intermediaryBankCountry: '', intermediaryBankCode: '', transferRemarks: '', paypalUsername: '', paypalEmail: '',
  },
  contractMatchReason: '',
  ...overrides,
});

describe('invoice creation drafts', () => {
  it('isolates drafts by account and ignores damaged or old data', () => {
    expect(invoiceCreationDraftStorageKey(' Jeff ')).toBe('comets-pay.invoice-creation-drafts.v1:jeff');
    expect(parseInvoiceCreationDrafts('{damaged', 'jeff')).toEqual([]);
    expect(parseInvoiceCreationDrafts(JSON.stringify([
      singleDraft(),
      singleDraft({ draftId: 'other', createdByAccount: 'other' }),
      { ...singleDraft(), draftId: 'old', schemaVersion: '0.9' },
      { ...singleDraft(), draftId: 'broken-items', items: [null] },
      {
        ...singleDraft(),
        draftId: 'broken-batch',
        kind: 'BATCH',
        batchId: 'batch-broken',
        selectedEngagementIds: [],
        sharedDescriptions: [],
        rows: [{ creatorName: 'Incomplete row' }],
        generationProgress: { current: 0, total: 1 },
      },
    ]), 'jeff').map((draft) => draft.draftId)).toEqual(['draft-single-1']);
  });

  it('only considers business input meaningful', () => {
    expect(invoiceSingleDraftHasMeaningfulContent(singleDraft())).toBe(false);
    expect(invoiceSingleDraftHasMeaningfulContent(singleDraft({ creatorId: 'creator-1' }))).toBe(true);
    expect(invoiceSingleDraftHasMeaningfulContent(singleDraft({
      items: [{ id: 'item-1', description: 'Video', unitPrice: 0, quantity: 0, lineTotal: 0 }],
    }))).toBe(true);
  });

  it('upserts, removes, and summarizes a partial batch', () => {
    const projectId = createPrototypeId('cooperation-project');
    const engagement1 = createPrototypeId('engagement');
    const engagement2 = createPrototypeId('engagement');
    const batch = {
      draftId: 'draft-batch-1', schemaVersion: '1.0', kind: 'BATCH', batchId: 'batch-1',
      createdByAccount: 'jeff', createdByName: 'Jeff', createdAt: '2026-09-09T01:00:00.000Z', updatedAt: '2026-09-09T02:00:00.000Z',
      projectId, invoiceDate: '2026-09-09', selectedBillingEntityId: 'entity-1', currency: 'USD',
      selectedEngagementIds: [engagement1, engagement2], sharedDescriptions: [], generationProgress: { current: 1, total: 2 },
      rows: [
        { projectId, engagementId: engagement1, creatorId: createPrototypeId('creator'), creatorName: 'A', creatorHandle: '@a', sourcePayoutId: 'payout-1', invoiceDate: '2026-09-09', items: [], descriptionOverrideKeys: [], currency: 'USD', payoutAccountId: '', payoutAccountLocked: false, contractIds: [], availableContractIds: [], contractMatchReason: '', status: 'GENERATED', issues: [], generated: { record: { id: 'INV-1', invoiceId: createPrototypeId('invoice'), sourcePayoutId: 'payout-1', status: '草稿', generatedAt: '', validationStatus: 'valid', snapshot: singleDraft().payment as never } } },
        { projectId, engagementId: engagement2, creatorId: createPrototypeId('creator'), creatorName: 'B', creatorHandle: '@b', sourcePayoutId: 'payout-2', invoiceDate: '2026-09-09', items: [], descriptionOverrideKeys: [], currency: 'USD', payoutAccountId: '', payoutAccountLocked: false, contractIds: [], availableContractIds: [], contractMatchReason: '', status: 'NEEDS_INPUT', issues: [] },
      ],
    } as unknown as InvoiceBatchDraft;
    expect(invoiceBatchDraftGeneratedCount(batch)).toBe(1);
    expect(invoiceBatchDraftHasPendingRows(batch)).toBe(true);
    expect(upsertInvoiceCreationDraft([], batch)).toHaveLength(1);
    expect(removeInvoiceCreationDraft([batch], batch.draftId)).toEqual([]);
  });
});
