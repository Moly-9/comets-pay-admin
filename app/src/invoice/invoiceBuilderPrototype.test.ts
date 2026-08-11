import { describe, expect, it } from 'vitest';
import { INITIAL_CONTRACTS } from '../contracts';
import { INITIAL_PAYOUTS } from '../data';
import {
  PROJECT_DEMO_CONTRACTS,
  PROJECT_DEMO_INVOICES,
  PROJECT_DEMO_PAYOUTS,
} from '../prototypeResourceFixtures';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from '../pages/OperationalPages';
import { createInvoiceBuilderPrototypeSeed } from './invoiceBuilderPrototype';

describe('single Invoice prototype seed', () => {
  it('selects an unused creator engagement and supplies complete display data', () => {
    const seed = createInvoiceBuilderPrototypeSeed({
      creators: INITIAL_CREATORS,
      payouts: [...INITIAL_PAYOUTS, ...PROJECT_DEMO_PAYOUTS],
      projects: INITIAL_PROJECTS,
      contracts: [...INITIAL_CONTRACTS, ...PROJECT_DEMO_CONTRACTS],
      generatedInvoices: PROJECT_DEMO_INVOICES,
    });

    expect(seed).not.toBeNull();
    expect(PROJECT_DEMO_INVOICES.some((invoice) => (
      invoice.snapshot.engagementId === seed?.engagementId
    ))).toBe(false);
    expect(seed?.creatorId).toBeTruthy();
    expect(seed?.payoutAccountId).toBeTruthy();
    expect(seed?.payment.payoutAccountId).toBe(seed?.payoutAccountId);
    expect(seed?.lineItems).toEqual([
      expect.objectContaining({ unitPrice: 1680, quantity: 1 }),
      expect.objectContaining({ unitPrice: 420, quantity: 1 }),
    ]);
  });

  it('returns no seed when every available engagement already has an Invoice', () => {
    const occupied = INITIAL_PROJECTS.flatMap((project) => (
      (project.creatorProfiles ?? []).map((reference, index) => ({
        ...PROJECT_DEMO_INVOICES[index % PROJECT_DEMO_INVOICES.length],
        snapshot: {
          ...PROJECT_DEMO_INVOICES[index % PROJECT_DEMO_INVOICES.length].snapshot,
          engagementId: reference.engagementId,
        },
      }))
    ));

    expect(createInvoiceBuilderPrototypeSeed({
      creators: INITIAL_CREATORS,
      payouts: [...INITIAL_PAYOUTS, ...PROJECT_DEMO_PAYOUTS],
      projects: INITIAL_PROJECTS,
      contracts: [...INITIAL_CONTRACTS, ...PROJECT_DEMO_CONTRACTS],
      generatedInvoices: occupied,
    })).toBeNull();
  });
});
