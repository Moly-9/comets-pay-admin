import { describe, expect, it } from 'vitest';
import { isConfirmedContract } from './contracts';
import { buildRequestFinanceReview } from './financeReview';
import { paymentListEffectiveAccount, paymentListItemValue } from './businessWorkflow';
import { INITIAL_PROJECTS } from './pages/OperationalPages';
import {
  COMPLETE_REQUEST_FINANCE_PROJECT_CODES,
  INITIAL_COMPLETE_REQUEST_RESOURCES,
} from './requestProjectPrototypeResources';

const {
  requests,
  contracts,
  invoices,
  paymentLists,
  payouts,
} = INITIAL_COMPLETE_REQUEST_RESOURCES;

describe('complete request project prototype resources', () => {
  it('links all 20 projects and all 237 creator engagements through complete stable resources', () => {
    const links = requests.flatMap((request) => request.creatorLinks ?? []);
    const linkedInvoiceIds = links.flatMap((link) => link.invoiceIds);

    expect(requests).toHaveLength(20);
    expect(new Set(requests.map((request) => request.paymentRequestProjectId)).size).toBe(20);
    expect(links).toHaveLength(237);
    expect(linkedInvoiceIds).toHaveLength(237);
    expect(new Set(linkedInvoiceIds).size).toBe(237);

    INITIAL_PROJECTS.forEach((project) => {
      const request = requests.find((candidate) => candidate.cooperationProjectId === project.cooperationProjectId);
      expect(request?.requestCode).toMatch(/^REQ-/);
      expect(request?.cooperationProjectCode).toBe(project.id);
      expect(request?.cooperationProjectName).toBe(project.name);
      expect(request?.creatorLinks).toHaveLength(project.creators);
      expect(request?.contracts).toBe(project.creators);
      expect(request?.invoices).toBe(project.creators);
    });
  });

  it('keeps every linked contract, Invoice, payment item, and payout aligned one-to-one', () => {
    const contractById = new Map(contracts.map((contract) => [contract.contractId, contract]));
    const invoiceById = new Map(invoices.map((invoice) => [invoice.invoiceId, invoice]));
    const payoutById = new Map(payouts.map((payout) => [payout.id, payout]));

    requests.forEach((request) => {
      const requestLists = paymentLists.filter((list) => (
        list.paymentRequestProjectId === request.paymentRequestProjectId
      ));
      const requestItems = requestLists.flatMap((list) => list.items.map((item) => ({ list, item })));
      (request.creatorLinks ?? []).forEach((link) => {
        expect(link.contractIds).toHaveLength(1);
        expect(link.invoiceIds).toHaveLength(1);
        const contract = contractById.get(link.contractIds[0]);
        const invoice = invoiceById.get(link.invoiceIds[0]);
        expect(contract).toBeTruthy();
        expect(invoice).toBeTruthy();
        expect(isConfirmedContract(contract!)).toBe(true);
        expect(contract).toMatchObject({
          creatorId: link.creatorId,
          engagementId: link.engagementId,
          cooperationProjectId: request.cooperationProjectId,
        });
        expect(invoice?.snapshot).toMatchObject({
          creatorId: link.creatorId,
          engagementId: link.engagementId,
          cooperationProjectId: request.cooperationProjectId,
          contractIds: link.contractIds,
        });

        const matchingItems = requestItems.filter(({ item }) => item.invoiceId === invoice?.invoiceId);
        expect(matchingItems).toHaveLength(1);
        const { list, item } = matchingItems[0];
        const payout = invoice ? payoutById.get(invoice.sourcePayoutId) : undefined;
        const account = paymentListEffectiveAccount(item);
        const invoiceAmount = invoice?.snapshot.items.reduce((sum, line) => sum + line.lineTotal, 0);
        expect(contract).toMatchObject({
          currency: invoice?.snapshot.currency,
          totalFee: invoiceAmount,
          payoutProvider: list.provider,
          payoutAccountId: invoice?.snapshot.payoutAccountId,
          payoutAccountVersion: invoice?.snapshot.payoutAccountVersion,
          payoutAccountFingerprint: invoice?.snapshot.payoutAccountFingerprint,
        });
        expect(item.requiresRevalidation).toBe(false);
        expect(item.validationIssues).toEqual([]);
        expect(Number(paymentListItemValue(item, 'amount'))).toBe(invoiceAmount);
        expect(String(paymentListItemValue(item, 'currency'))).toBe(invoice?.snapshot.currency);
        expect(account).toMatchObject({
          provider: list.provider,
          payoutAccountId: invoice?.snapshot.payoutAccountId,
          payoutAccountVersion: invoice?.snapshot.payoutAccountVersion,
          accountFingerprint: invoice?.snapshot.payoutAccountFingerprint,
          paymentDetails: invoice?.snapshot.payment,
        });
        expect(item.snapshot.realName).toBe(invoice?.snapshot.from.legalName);
        expect(payout).toMatchObject({
          paymentRequestProjectId: request.paymentRequestProjectId,
          creatorId: link.creatorId,
          invoice: invoice?.id,
          provider: list.provider,
        });
      });
    });
  });

  it('provides ten zero-mismatch finance reviews and preserves both resubmission histories', () => {
    const financeRequests = requests.filter((request) => (
      request.lifecycle === 'SUBMITTED' && request.approval?.status === 'PENDING_FINANCE'
    ));
    expect(financeRequests).toHaveLength(10);
    expect(new Set(financeRequests.map((request) => request.cooperationProjectCode))).toEqual(
      COMPLETE_REQUEST_FINANCE_PROJECT_CODES,
    );

    financeRequests.forEach((request) => {
      const review = buildRequestFinanceReview(request, invoices, paymentLists);
      expect(review.pageCount).toBe(request.invoices);
      expect(review.mismatchCount).toBe(0);
      expect(review.canApprove).toBe(true);
    });

    ['PRJ-260801-07', 'PRJ-260801-08'].forEach((projectCode) => {
      const request = financeRequests.find((candidate) => candidate.cooperationProjectCode === projectCode);
      expect(request?.approval?.round).toBe(2);
      expect(request?.approval?.history).toContainEqual(expect.objectContaining({
        round: 1,
        stage: 'FINANCE',
        action: 'RETURN',
        toStatus: 'RETURNED_TO_MEDIA_REVIEW',
      }));
    });
  });

  it('keeps the standalone available Invoice outside every existing request', async () => {
    const { AVAILABLE_PAYMENT_REQUEST_INVOICE_ID } = await import('./prototypeResourceFixtures');
    expect(invoices.some((invoice) => invoice.invoiceId === AVAILABLE_PAYMENT_REQUEST_INVOICE_ID)).toBe(true);
    expect(requests.some((request) => request.creatorLinks?.some((link) => (
      link.invoiceIds.includes(AVAILABLE_PAYMENT_REQUEST_INVOICE_ID)
    )))).toBe(false);
  });
});
