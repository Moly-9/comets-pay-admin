import { describe, expect, it } from 'vitest';
import {
  INVOICE_EDIT_REQUEST_INVOICES,
  PROJECT_DEMO_CONTRACTS,
  PROJECT_DEMO_INVOICES,
  PROJECT_DEMO_PAYOUTS,
  PROJECT_DEMO_TOTAL,
} from './prototypeResourceFixtures';
import { INITIAL_PAYOUTS } from './data';
import { eligibleInvoicePayoutAccounts } from './payoutAccounts';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from './pages/OperationalPages';

describe('project prototype fixtures', () => {
  it('creates one stable creator engagement for every displayed project creator', () => {
    const creatorIds = new Set(INITIAL_CREATORS.map((creator) => creator.id));

    INITIAL_PROJECTS.forEach((project) => {
      const references = project.creatorProfiles ?? [];
      expect(references).toHaveLength(project.creators);
      expect(new Set(references.map((reference) => reference.creatorId)).size).toBe(references.length);
      expect(new Set(references.map((reference) => reference.engagementId)).size).toBe(references.length);
      expect(references.every((reference) => creatorIds.has(reference.creatorId))).toBe(true);
      expect(references.every((reference) => reference.projectId === project.projectId)).toBe(true);
    });
  });

  it('provides cross-module creator, contract, and Invoice fixtures for the primary project', () => {
    const project = INITIAL_PROJECTS.find((item) => item.id === 'PRJ-301164');
    const references = project?.creatorProfiles ?? [];
    const referenceByEngagement = new Map(
      references.map((reference) => [reference.engagementId, reference]),
    );
    const creatorIds = new Set(INITIAL_CREATORS.map((creator) => creator.id));

    expect(project?.invoiceCount).toBe(18);
    expect(PROJECT_DEMO_INVOICES).toHaveLength(18);
    expect(PROJECT_DEMO_PAYOUTS).toHaveLength(18);
    expect(PROJECT_DEMO_CONTRACTS).toHaveLength(9);
    expect(PROJECT_DEMO_TOTAL).toBe(48000);

    PROJECT_DEMO_CONTRACTS.forEach((contract) => {
      const reference = referenceByEngagement.get(contract.engagementId!);
      expect(contract.projectId).toBe(project?.projectId);
      expect(reference?.creatorId).toBe(contract.creatorId);
      expect(creatorIds.has(contract.creatorId!)).toBe(true);
    });

    PROJECT_DEMO_INVOICES.forEach((invoice) => {
      const reference = referenceByEngagement.get(invoice.snapshot.engagementId!);
      const payout = PROJECT_DEMO_PAYOUTS.find((item) => item.id === invoice.sourcePayoutId);
      expect(invoice.snapshot.projectId).toBe(project?.projectId);
      expect(reference?.creatorId).toBe(invoice.snapshot.creatorId);
      expect(payout?.invoice).toBe(invoice.id);
      expect(payout?.projectId).toBe(project?.projectId);
      invoice.snapshot.contractIds?.forEach((contractId) => {
        const contract = PROJECT_DEMO_CONTRACTS.find((item) => item.contractId === contractId);
        expect(contract?.engagementId).toBe(invoice.snapshot.engagementId);
        expect(contract?.lifecycle).toBe('CONFIRMED');
      });
    });
  });

  it('provides a stable editable snapshot for the INV-240705 modification request', () => {
    const record = INVOICE_EDIT_REQUEST_INVOICES[0]!;
    const payout = INITIAL_PAYOUTS.find((item) => item.id === record.sourcePayoutId);
    const project = INITIAL_PROJECTS.find((item) => item.projectId === record.snapshot.projectId);
    const engagement = project?.creatorProfiles?.find((reference) => (
      reference.engagementId === record.snapshot.engagementId
    ));

    expect(INVOICE_EDIT_REQUEST_INVOICES).toHaveLength(1);
    expect(record.id).toBe('INV-240705');
    expect(record.sourcePayoutId).toBe('pay-013');
    expect(record.status).toBe('待媒介复核');
    expect(record.snapshot.items[0]?.lineTotal).toBe(2440);
    expect(payout?.invoice).toBe(record.id);
    expect(payout?.projectId).toBe(project?.id);
    expect(engagement?.creatorId).toBe(record.snapshot.creatorId);
  });

  it('provides two verified payout accounts for the payment-failure edit prototype', () => {
    const record = PROJECT_DEMO_INVOICES[2]!;
    const payout = PROJECT_DEMO_PAYOUTS.find((item) => item.id === record.sourcePayoutId);
    const creator = INITIAL_CREATORS.find((item) => item.id === record.snapshot.creatorId);

    expect(payout?.paymentFailureReturn?.issueType).toBe('INVOICE_CONTENT');
    expect(payout?.paymentFailureReturn?.reason).toContain('收款账户不可用');
    expect(record.snapshot.payoutAccountId).toBe('awx-creator-nika');
    expect(eligibleInvoicePayoutAccounts(creator).map((account) => account.id)).toEqual([
      'awx-creator-nika',
      'paypal-creator-nika',
    ]);
  });
});
