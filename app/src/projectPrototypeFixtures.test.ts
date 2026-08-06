import { describe, expect, it } from 'vitest';
import {
  ALL_PROJECT_PROTOTYPE_INVOICES,
  ALL_PROJECT_PROTOTYPE_PAYMENT_LISTS,
  ALL_PROJECT_PROTOTYPE_PAYOUTS,
  INVOICE_EDIT_REQUEST_INVOICES,
  PROJECT_DEMO_CONTRACTS,
  PROJECT_DEMO_INVOICES,
  PROJECT_DEMO_PAYOUTS,
  PROJECT_DEMO_TOTAL,
} from './prototypeResourceFixtures';
import { INITIAL_PAYOUTS } from './data';
import {
  invoicePaymentListItem,
  paymentListEffectiveAccount,
  paymentListItemValue,
} from './businessWorkflow';
import { eligibleInvoicePayoutAccounts, getPayoutAccountId } from './payoutAccounts';
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

  it('covers all 20 projects and 237 engagements with stable Invoice, Payout, and payment rows', () => {
    const engagements = INITIAL_PROJECTS.flatMap((project) => project.creatorProfiles ?? []);
    const payouts = new Map(
      [...INITIAL_PAYOUTS, ...ALL_PROJECT_PROTOTYPE_PAYOUTS].map((payout) => [payout.id, payout]),
    );

    expect(INITIAL_PROJECTS).toHaveLength(20);
    expect(engagements).toHaveLength(237);
    expect(ALL_PROJECT_PROTOTYPE_INVOICES).toHaveLength(237);
    expect(ALL_PROJECT_PROTOTYPE_PAYMENT_LISTS).toHaveLength(20);
    expect(new Set(ALL_PROJECT_PROTOTYPE_PAYMENT_LISTS.map((list) => list.projectId)).size).toBe(20);
    expect(ALL_PROJECT_PROTOTYPE_PAYMENT_LISTS.flatMap((list) => list.items)).toHaveLength(237);
    expect(new Set(ALL_PROJECT_PROTOTYPE_INVOICES.map((invoice) => invoice.snapshot.engagementId)).size).toBe(237);

    engagements.forEach((engagement) => {
      const invoice = ALL_PROJECT_PROTOTYPE_INVOICES.find((candidate) => (
        candidate.snapshot.engagementId === engagement.engagementId
      ));
      const lists = ALL_PROJECT_PROTOTYPE_PAYMENT_LISTS.filter((candidate) => (
        candidate.projectId === engagement.projectId
      ));
      expect(lists).toHaveLength(1);
      expect(invoice?.snapshot.creatorId).toBe(engagement.creatorId);
      expect(invoice?.snapshot.projectId).toBe(engagement.projectId);
      expect(payouts.get(invoice!.sourcePayoutId)?.invoice).toBe(invoice?.id);
      expect(lists.flatMap((list) => list.items).filter((item) => (
        item.engagementId === engagement.engagementId
      ))).toHaveLength(1);
    });
  });

  it('allocates every project budget exactly and keeps description blank in every payment row', () => {
    INITIAL_PROJECTS.forEach((project) => {
      const expected = Number(project.budget.replace(/[^0-9.]/g, ''));
      const lists = ALL_PROJECT_PROTOTYPE_PAYMENT_LISTS.filter((candidate) => (
        candidate.projectId === project.projectId
      ));
      const items = lists.flatMap((list) => list.items);
      const total = items.reduce((sum, item) => (
        sum + Number(paymentListItemValue(item, 'amount'))
      ), 0);
      expect(total).toBeCloseTo(expected, 2);
      expect(items.every((item) => paymentListItemValue(item, 'description') === '')).toBe(true);
      const invalidAccounts = items.flatMap((item) => {
        const account = paymentListEffectiveAccount(item);
        return account.provider === 'Airwallex' && account.externalBeneficiaryId
          ? []
          : [{ creator: item.snapshot.creatorName, provider: account.provider, accountId: account.payoutAccountId }];
      });
      expect(invalidAccounts).toEqual([]);
      expect(lists.every((list) => list.provider === 'Airwallex')).toBe(true);
    });
  });

  it('backs every Invoice payout snapshot with the creator\'s eligible stable account', () => {
    ALL_PROJECT_PROTOTYPE_INVOICES.forEach((invoice) => {
      const creator = INITIAL_CREATORS.find((candidate) => candidate.id === invoice.snapshot.creatorId);
      const eligibleAccountIds = eligibleInvoicePayoutAccounts(creator).map(getPayoutAccountId);
      expect(invoice.snapshot.payoutAccountId).toBeTruthy();
      expect(eligibleAccountIds).toContain(invoice.snapshot.payoutAccountId);
    });
  });

  it('maps approval and payment-failure states without unlocking Invoice-content failures', () => {
    const lists = (projectId: string) => ALL_PROJECT_PROTOTYPE_PAYMENT_LISTS.filter((candidate) => (
      candidate.projectId === projectId
    ));
    expect(lists('PRJ-260727-05').every((list) => list.status === 'draft')).toBe(true);
    expect(lists('PRJ-260727-06').every((list) => list.status === 'approved')).toBe(true);
    expect(lists('PRJ-260727-07').every((list) => list.status === 'paid')).toBe(true);
    expect(lists('PRJ-260801-07').every((list) => list.status === 'submitted')).toBe(true);
    expect(lists('PRJ-260801-08').every((list) => (
      list.status === 'draft' && list.draftFromVersion === 1
    ))).toBe(true);
    expect(lists('PRJ-260801-08').flatMap((list) => list.items).every((item) => (
      paymentListItemValue(item, 'transactionReference') === ''
    ))).toBe(true);
    expect(lists('PRJ-260801-08').flatMap((list) => list.versions?.[0]?.items ?? []).every((item) => (
      Boolean(paymentListItemValue(item, 'transactionReference'))
    ))).toBe(true);
    expect(lists('PRJ-260727-05').flatMap((list) => list.items).every((item) => (
      paymentListItemValue(item, 'transactionReference') === ''
    ))).toBe(true);
    expect(lists('PRJ-260727-02').flatMap((list) => list.items).every((item) => (
      Boolean(paymentListItemValue(item, 'transactionReference'))
    ))).toBe(true);
  });

  it('keeps new payment-list transaction reference and description empty by default', () => {
    const item = invoicePaymentListItem(ALL_PROJECT_PROTOTYPE_INVOICES[0]!, PROJECT_DEMO_CONTRACTS);
    expect(item.snapshot.transactionReference).toBe('');
    expect(item.snapshot.description).toBe('');
    expect(item.validationIssues).toContain('交易附言未填写');
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
