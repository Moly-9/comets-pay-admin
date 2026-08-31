import { describe, expect, it } from 'vitest';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from '../pages/OperationalPages';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';
import type { GeneratedInvoiceRecord } from '../types';
import {
  INVOICE_BATCH_PROTOTYPE_DEMO_CURRENCY,
  INVOICE_BATCH_PROTOTYPE_DEMO_DESCRIPTION,
  createInvoiceBatchPrototypeSeed,
  filterInvoiceBatchCreatorReferences,
  selectableInvoiceBatchEngagementIds,
} from './invoiceBatchPrototype';

describe('Invoice batch prototype defaults', () => {
  it('searches project creators by name, handle, or platform without changing order', () => {
    const references = INITIAL_PROJECTS[0].creatorProfiles!;

    expect(filterInvoiceBatchCreatorReferences(references, 'camila'))
      .toEqual(references.filter((reference) => reference.name.includes('Camila')));
    expect(filterInvoiceBatchCreatorReferences(references, '@OLIVER'))
      .toEqual(references.filter((reference) => reference.handle === '@oliver.tech'));
    expect(filterInvoiceBatchCreatorReferences(references, 'twitch'))
      .toEqual(references.filter((reference) => reference.platform.toLowerCase().includes('twitch')));
  });

  it('selects project creators up to the limit even when an engagement already has an Invoice', () => {
    const references = INITIAL_PROJECTS[0].creatorProfiles!;
    const existingReference = references[1];
    const generatedInvoices = [{
      snapshot: { engagementId: existingReference.engagementId },
    }] as GeneratedInvoiceRecord[];

    const selected = selectableInvoiceBatchEngagementIds(
      references,
      generatedInvoices,
      5,
    );

    expect(selected).toHaveLength(5);
    expect(selected).toContain(existingReference.engagementId);
    expect(selected[0]).toBe(references[0].engagementId);
  });

  it('builds five deterministic ready-to-fill demo rows from the project with available creators', () => {
    const seed = createInvoiceBatchPrototypeSeed(
      INITIAL_PROJECTS,
      INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    );

    expect(seed).toMatchObject({
      currency: INVOICE_BATCH_PROTOTYPE_DEMO_CURRENCY,
      description: INVOICE_BATCH_PROTOTYPE_DEMO_DESCRIPTION,
    });
    expect(INITIAL_PROJECTS.some((project) => project.id === seed?.projectId)).toBe(true);
    expect(seed?.rows).toHaveLength(5);
    expect(new Set(seed?.rows.map((row) => row.engagementId)).size).toBe(5);
    expect(seed?.rows.every((row) => !('payoutProvider' in row))).toBe(true);
    expect(seed?.rows.every((row) => row.unitPrice > 0 && row.quantity > 0)).toBe(true);
    expect(INITIAL_CREATORS.some((creator) => (
      creator.payoutAccounts.some((account) => account.isDefault)
    ))).toBe(true);
  });
});
