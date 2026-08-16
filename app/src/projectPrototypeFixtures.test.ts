import { describe, expect, it } from 'vitest';
import {
  ACTIVE_INVOICE_DEMO_INVOICES,
  ACTIVE_INVOICE_DEMO_PAYOUTS,
  ALL_PROJECT_PROTOTYPE_INVOICES,
  ALL_PROJECT_PROTOTYPE_PAYMENT_LISTS,
  ALL_PROJECT_PROTOTYPE_PAYOUTS,
  AVAILABLE_PAYMENT_REQUEST_INVOICE_ID,
  INVOICE_EDIT_REQUEST_INVOICES,
  PAYMENT_REQUEST_CREATION_DEMO_INVOICES,
  PAYMENT_REQUEST_CREATION_DEMO_PAYOUTS,
  PROJECT_DEMO_CONTRACTS,
  PROJECT_DEMO_INITIAL_REQUEST_CONTRACT_IDS,
  REQUEST_CONTRACT_ASSOCIATION_FIXTURES,
  PROJECT_DEMO_INVOICES,
  PROJECT_DEMO_PAYOUTS,
  PROJECT_DEMO_TOTAL,
  REQUEST_INVOICE_ASSOCIATION_FIXTURES,
  REQUEST_INVOICE_ASSOCIATION_PAYOUTS,
} from './prototypeResourceFixtures';
import { INITIAL_PAYOUTS } from './data';
import { resolveCreatorDocuments } from './paymentRequestProjects';
import {
  invoicePaymentListItem,
  paymentListEffectiveAccount,
  paymentListItemValue,
} from './businessWorkflow';
import { eligibleInvoicePayoutAccounts, getPayoutAccountId } from './payoutAccounts';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from './pages/OperationalPages';

describe('project prototype fixtures', () => {
  it('seeds the focused active Invoice chains and leaves the other engagements available', () => {
    const activeEngagementIds = new Set(
      ACTIVE_INVOICE_DEMO_INVOICES.map((invoice) => invoice.snapshot.engagementId),
    );
    const activePayoutsById = new Map(
      [...INITIAL_PAYOUTS, ...ACTIVE_INVOICE_DEMO_PAYOUTS].map((payout) => [payout.id, payout]),
    );
    const alexDemoEngagement = INITIAL_PROJECTS
      .find((project) => project.id === 'PRJ-260801-08')
      ?.creatorProfiles?.find((reference) => reference.creatorId === 'creator-alex');

    expect(ACTIVE_INVOICE_DEMO_INVOICES).toHaveLength(4);
    expect(activeEngagementIds.size).toBe(4);
    expect(ACTIVE_INVOICE_DEMO_INVOICES.map((invoice) => invoice.status)).toEqual([
      '达人反馈',
      '已退回',
      '已退回',
      '已退回',
    ]);
    ACTIVE_INVOICE_DEMO_INVOICES.forEach((invoice) => {
      expect(activePayoutsById.get(invoice.sourcePayoutId)?.invoice).toBe(invoice.id);
    });
    expect(alexDemoEngagement).toBeDefined();
    expect(activeEngagementIds.has(alexDemoEngagement?.engagementId)).toBe(false);
  });

  it('keeps two request-ready Invoices available for the new My Project demo', () => {
    const demoProject = INITIAL_PROJECTS.find((project) => project.id === 'PRJ-301164');
    const demoInvoices = [
      ...ACTIVE_INVOICE_DEMO_INVOICES,
      ...PAYMENT_REQUEST_CREATION_DEMO_INVOICES,
    ];
    const existingRequestLinks = ACTIVE_INVOICE_DEMO_INVOICES.flatMap((invoice) => (
      invoice.snapshot.creatorId && invoice.snapshot.engagementId
        ? [{
            creatorId: invoice.snapshot.creatorId,
            engagementId: invoice.snapshot.engagementId,
            contractIds: [],
            invoiceIds: [invoice.invoiceId],
          }]
        : []
    ));
    const payoutByInvoiceNumber = new Map(
      PAYMENT_REQUEST_CREATION_DEMO_PAYOUTS.map((payout) => [payout.invoice, payout]),
    );

    expect(demoProject?.projectId).toBeDefined();
    expect(PAYMENT_REQUEST_CREATION_DEMO_INVOICES.map((invoice) => invoice.id)).toEqual([
      'INV-301164-19',
      'INV-301164-20',
    ]);
    expect(PAYMENT_REQUEST_CREATION_DEMO_INVOICES.map((invoice) => invoice.status)).toEqual([
      '已通过',
      '已通过',
    ]);

    PAYMENT_REQUEST_CREATION_DEMO_INVOICES.forEach((invoice) => {
      const resolution = resolveCreatorDocuments({
        contracts: PROJECT_DEMO_CONTRACTS,
        invoices: demoInvoices,
        requests: [{ id: 'REQ-EXISTING', creatorLinks: existingRequestLinks }],
        cooperationProjectId: demoProject!.projectId!,
        creatorId: invoice.snapshot.creatorId!,
      });
      expect(resolution.status).toBe('READY');
      expect(resolution.availableInvoices.map((candidate) => candidate.invoiceId)).toContain(invoice.invoiceId);
      expect(payoutByInvoiceNumber.get(invoice.id)?.payoutAccountId).toBe(invoice.snapshot.payoutAccountId);
    });
  });

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

  it('allocates every project budget exactly and requires descriptions outside editable drafts', () => {
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
      expect(items.every((item) => (
        lists[0]?.status === 'draft'
          ? paymentListItemValue(item, 'description') === ''
          : Boolean(paymentListItemValue(item, 'description'))
      ))).toBe(true);
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

  it('keeps one synthetic ready Invoice available for creating a new media request project', () => {
    const invoice = ALL_PROJECT_PROTOTYPE_INVOICES.find((candidate) => (
      candidate.invoiceId === AVAILABLE_PAYMENT_REQUEST_INVOICE_ID
    ));
    const matches = ALL_PROJECT_PROTOTYPE_INVOICES.filter((candidate) => (
      candidate.snapshot.projectId === invoice?.snapshot.projectId
      && candidate.snapshot.creatorId === invoice?.snapshot.creatorId
    ));

    expect(invoice?.status).toBe('已通过');
    expect(invoice?.snapshot.projectId).toBe(INITIAL_PROJECTS.find((project) => (
      project.id === 'PRJ-260727-04'
    ))?.projectId);
    expect(matches).toHaveLength(1);
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
    expect(INITIAL_PAYOUTS.some((payout) => (
      payout.projectId === 'PRJ-260727-08'
      && payout.invoiceReviewStatus === '已通过'
    ))).toBe(true);
  });

  it('keeps new payment-list transaction reference and description empty by default', () => {
    const item = invoicePaymentListItem(ALL_PROJECT_PROTOTYPE_INVOICES[0]!, PROJECT_DEMO_CONTRACTS);
    expect(item.snapshot.transactionReference).toBe('');
    expect(item.snapshot.description).toBe('');
    expect(item.snapshot.realName).toBe(ALL_PROJECT_PROTOTYPE_INVOICES[0]!.snapshot.from.legalName);
    expect(item.snapshot.paymentDetails).toEqual(ALL_PROJECT_PROTOTYPE_INVOICES[0]!.snapshot.payment);
    expect(item.validationIssues).toContain('交易附言未填写');
    expect(item.validationIssues).not.toContain('付款描述未填写');
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
    expect(PROJECT_DEMO_CONTRACTS).toHaveLength(12);
    expect(PROJECT_DEMO_INITIAL_REQUEST_CONTRACT_IDS).toHaveLength(9);
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

  it('provides confirmed contracts whose creators can be added to the request by stable IDs', () => {
    expect(REQUEST_CONTRACT_ASSOCIATION_FIXTURES).toHaveLength(5);
    REQUEST_CONTRACT_ASSOCIATION_FIXTURES.forEach((fixture) => {
      const project = INITIAL_PROJECTS.find((item) => item.projectId === fixture.projectId);
      const reference = project?.creatorProfiles?.find((item) => (
        item.creatorId === fixture.creatorId && item.engagementId === fixture.engagementId
      ));
      const creator = INITIAL_CREATORS.find((item) => item.id === fixture.creatorId);

      expect(fixture.lifecycle).toBe('CONFIRMED');
      expect(fixture.cooperationProjectId).toBe(project?.cooperationProjectId);
      expect(reference).toBeDefined();
      expect(creator).toBeDefined();
    });

    expect(REQUEST_CONTRACT_ASSOCIATION_FIXTURES.filter((fixture) => (
      fixture.creatorId === 'creator-sara'
    ))).toHaveLength(2);
    expect(REQUEST_CONTRACT_ASSOCIATION_FIXTURES.filter((fixture) => (
      fixture.creatorId === 'creator-sofia'
    ))).toHaveLength(2);
  });

  it('provides unlinked cooperation-project Invoice candidates with stable creator and payout references', () => {
    const invoiceIds = new Set(ALL_PROJECT_PROTOTYPE_INVOICES.map((invoice) => invoice.invoiceId));
    const payoutById = new Map(REQUEST_INVOICE_ASSOCIATION_PAYOUTS.map((payout) => [payout.id, payout]));

    expect(REQUEST_INVOICE_ASSOCIATION_FIXTURES).toHaveLength(6);
    expect(REQUEST_INVOICE_ASSOCIATION_PAYOUTS).toHaveLength(6);
    REQUEST_INVOICE_ASSOCIATION_FIXTURES.forEach((invoice) => {
      const project = INITIAL_PROJECTS.find((item) => item.projectId === invoice.snapshot.projectId);
      const engagement = project?.creatorProfiles?.find((reference) => (
        reference.creatorId === invoice.snapshot.creatorId
        && reference.engagementId === invoice.snapshot.engagementId
      ));
      const payout = payoutById.get(invoice.sourcePayoutId);

      expect(invoiceIds.has(invoice.invoiceId)).toBe(false);
      expect(invoice.status).toBe('已通过');
      expect(['PRJ-301164', 'PRJ-260727-04']).toContain(project?.id);
      expect(engagement).toBeDefined();
      expect(payout?.invoice).toBe(invoice.id);
      expect(payout?.creatorId).toBe(invoice.snapshot.creatorId);
      expect(payout?.invoiceSnapshot).toEqual(invoice.snapshot);
      invoice.snapshot.contractIds?.forEach((contractId) => {
        const contract = [...PROJECT_DEMO_CONTRACTS, ...REQUEST_CONTRACT_ASSOCIATION_FIXTURES]
          .find((item) => item.contractId === contractId);
        expect(contract?.lifecycle).toBe('CONFIRMED');
        expect(contract?.projectId).toBe(invoice.snapshot.projectId);
        expect(contract?.creatorId).toBe(invoice.snapshot.creatorId);
        expect(contract?.engagementId).toBe(invoice.snapshot.engagementId);
      });
    });

    expect(REQUEST_INVOICE_ASSOCIATION_FIXTURES.filter((invoice) => (
      invoice.snapshot.creatorId === 'creator-sara'
    ))).toHaveLength(2);
    expect(REQUEST_INVOICE_ASSOCIATION_FIXTURES.filter((invoice) => (
      invoice.snapshot.creatorId === 'creator-sofia'
    ))).toHaveLength(2);
  });

  it('provides a stable editable snapshot for the INV-240705 modification request', () => {
    const record = INVOICE_EDIT_REQUEST_INVOICES[0]!;
    const payout = INITIAL_PAYOUTS.find((item) => item.id === record.sourcePayoutId);
    const project = INITIAL_PROJECTS.find((item) => item.projectId === record.snapshot.projectId);
    const engagement = project?.creatorProfiles?.find((reference) => (
      reference.engagementId === record.snapshot.engagementId
    ));

    expect(INVOICE_EDIT_REQUEST_INVOICES).toHaveLength(2);
    expect(record.id).toBe('INV-240705');
    expect(record.sourcePayoutId).toBe('pay-013');
    expect(record.status).toBe('已退回');
    expect(record.snapshot.items[0]?.lineTotal).toBe(2440);
    expect(payout?.invoice).toBe(record.id);
    expect(payout?.paymentFailureReturn?.issueType).toBe('INVOICE_CONTENT');
    expect(payout?.projectId).toBe(project?.id);
    expect(engagement?.creatorId).toBe(record.snapshot.creatorId);
  });

  it('provides a stable editable Invoice for the returned payment request', () => {
    const record = INVOICE_EDIT_REQUEST_INVOICES[1]!;
    const payout = INITIAL_PAYOUTS.find((item) => item.id === record.sourcePayoutId);
    const project = INITIAL_PROJECTS.find((item) => item.projectId === record.snapshot.projectId);
    const engagement = project?.creatorProfiles?.find((reference) => (
      reference.engagementId === record.snapshot.engagementId
    ));

    expect(record.id).toBe('INV-240807');
    expect(record.sourcePayoutId).toBe('pay-020');
    expect(record.status).toBe('已退回');
    expect(record.snapshot.items[0]?.lineTotal).toBe(1320);
    expect(payout?.paymentFailureReturn?.issueType).toBe('INVOICE_CONTENT');
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
