import { describe, expect, it } from 'vitest';
import { isConfirmedContract } from './contracts';
import { buildRequestFinanceReview } from './financeReview';
import { paymentListEffectiveAccount, paymentListItemValue } from './businessWorkflow';
import { INITIAL_PROJECTS } from './pages/OperationalPages';
import { paymentRequestProviderForChannel, requestProjectStatusFor } from './paymentRequestProjects';
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
  it('links all 20 projects through channel-compatible stable resources', () => {
    const links = requests.flatMap((request) => request.creatorLinks ?? []);
    const linkedInvoiceIds = links.flatMap((link) => link.invoiceIds);

    expect(requests).toHaveLength(20);
    expect(new Set(requests.map((request) => request.paymentRequestProjectId)).size).toBe(20);
    expect(links.length).toBeGreaterThanOrEqual(20);
    expect(linkedInvoiceIds).toHaveLength(links.length);
    expect(new Set(linkedInvoiceIds).size).toBe(linkedInvoiceIds.length);
    expect(paymentLists).toHaveLength(20);

    INITIAL_PROJECTS.forEach((project) => {
      const request = requests.find((candidate) => candidate.cooperationProjectId === project.cooperationProjectId);
      expect(request?.requestCode).toMatch(/^REQ-/);
      expect(request?.cooperationProjectCode).toBe(project.id);
      expect(request?.cooperationProjectName).toBe(project.name);
      expect(request?.paymentChannel).toMatch(/^(Airwallex|PayPal|Payermax)$/);
      expect(request?.creatorLinks?.length).toBeGreaterThan(0);
      expect(request?.contracts).toBe(request?.creatorLinks?.length);
      expect(request?.invoices).toBe(request?.creatorLinks?.length);
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
      expect(requestLists).toHaveLength(1);
      expect(request.paymentListId).toBe(requestLists[0]?.paymentListId);
      expect(request.paymentListIds).toEqual([requestLists[0]?.paymentListId]);
      expect(request.paymentOrder).toBe(requestLists[0]?.paymentListCode);
      expect(request.paymentOrder).not.toMatch(/、|-(?:AWX|PP)$/);
      const requestItems = requestLists.flatMap((list) => list.items.map((item) => ({ list, item })));
      const expectedProvider = paymentRequestProviderForChannel(request.paymentChannel);
      expect(requestLists[0]?.provider).toBe(expectedProvider);
      expect(new Set(requestItems.map(({ item }) => paymentListEffectiveAccount(item).provider)))
        .toEqual(new Set([expectedProvider]));
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
          payoutProvider: account.provider,
          payoutAccountId: invoice?.snapshot.payoutAccountId,
          payoutAccountVersion: invoice?.snapshot.payoutAccountVersion,
          payoutAccountFingerprint: invoice?.snapshot.payoutAccountFingerprint,
        });
        expect(item.requiresRevalidation).toBe(false);
        expect(item.validationIssues).toEqual([]);
        expect(Number(paymentListItemValue(item, 'amount'))).toBe(invoiceAmount);
        expect(String(paymentListItemValue(item, 'currency'))).toBe(invoice?.snapshot.currency);
        expect(account).toMatchObject({
          provider: account.provider,
          payoutAccountId: invoice?.snapshot.payoutAccountId,
          payoutAccountVersion: invoice?.snapshot.payoutAccountVersion,
          accountFingerprint: invoice?.snapshot.payoutAccountFingerprint,
          paymentDetails: invoice?.snapshot.payment,
        });
        expect(item.snapshot.realName).toBe(invoice?.snapshot.from.legalName);
        expect(paymentListItemValue(item, 'paymentReason')).toBe('影音服务');
        expect(payout).toMatchObject({
          paymentRequestProjectId: request.paymentRequestProjectId,
          creatorId: link.creatorId,
          invoice: invoice?.id,
          provider: account.provider,
        });
      });
    });
  });

  it('provides a visible multi-currency mix while keeping each project resource chain aligned', () => {
    const expectedCurrencies = new Map([
      ['PRJ-260727-02', 'EUR'],
      ['PRJ-260727-03', 'GBP'],
      ['PRJ-260727-04', 'HKD'],
      ['PRJ-260727-05', 'SGD'],
      ['PRJ-260727-08', 'EUR'],
      ['PRJ-260727-09', 'GBP'],
    ]);
    const contractById = new Map(contracts.map((contract) => [contract.contractId, contract]));
    const invoiceById = new Map(invoices.map((invoice) => [invoice.invoiceId, invoice]));

    expect(new Set(requests.slice(0, 10).map((request) => request.amount.split(' ')[0])))
      .toEqual(new Set(['USD', 'EUR', 'GBP', 'HKD', 'SGD']));

    expectedCurrencies.forEach((currency, projectCode) => {
      const request = requests.find((candidate) => candidate.cooperationProjectCode === projectCode);
      expect(request?.amount).toMatch(new RegExp(`^${currency} \\d`));
      const linkedInvoices = (request?.creatorLinks ?? []).flatMap((link) => (
        link.invoiceIds.flatMap((invoiceId) => {
          const invoice = invoiceById.get(invoiceId);
          return invoice ? [invoice] : [];
        })
      ));
      expect(new Set(linkedInvoices.map((invoice) => invoice.snapshot.currency)))
        .toEqual(new Set([currency]));
      expect(new Set((request?.creatorLinks ?? []).flatMap((link) => (
        link.contractIds.flatMap((contractId) => {
          const contract = contractById.get(contractId);
          return contract ? [contract.currency] : [];
        })
      )))).toEqual(new Set([currency]));

      const requestList = paymentLists.find((list) => (
        list.paymentRequestProjectId === request?.paymentRequestProjectId
      ));
      expect(new Set((requestList?.items ?? []).map((item) => (
        String(paymentListItemValue(item, 'currency'))
      )))).toEqual(new Set([currency]));
      expect(new Set(payouts.filter((payout) => (
        payout.paymentRequestProjectId === request?.paymentRequestProjectId
      )).map((payout) => payout.currency))).toEqual(new Set([currency]));
    });
  });

  it('provides two zero-mismatch finance reviews and preserves both resubmission histories', () => {
    const financeRequests = requests.filter((request) => (
      request.lifecycle === 'SUBMITTED' && request.approval?.status === 'PENDING_FINANCE'
    ));
    expect(financeRequests).toHaveLength(2);
    expect(new Set(financeRequests.map((request) => request.cooperationProjectCode))).toEqual(
      COMPLETE_REQUEST_FINANCE_PROJECT_CODES,
    );

    financeRequests.forEach((request) => {
      const review = buildRequestFinanceReview(request, invoices, paymentLists);
      expect(review.pageCount).toBe(request.invoices);
      expect(review.mismatchCount).toBe(0);
      expect(review.canApprove).toBe(true);
    });

    ['PRJ-260727-07', 'PRJ-260727-08'].forEach((projectCode) => {
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

  it('provides exactly two visible projects for every cooperation-project status', () => {
    const visibleRequests = requests.filter((request) => request.lifecycle !== 'DRAFT');
    const counts = visibleRequests.reduce<Record<string, number>>((result, request) => {
      const status = requestProjectStatusFor(request, payouts);
      if (status) result[status] = (result[status] ?? 0) + 1;
      return result;
    }, {});

    expect(counts).toEqual({
      PM审批中: 2,
      项目负责人审批中: 2,
      老板审批中: 2,
      财务审批中: 2,
      正在付款: 2,
      付款处理中: 2,
      已付款: 2,
    });
    expect(requests.filter((request) => request.lifecycle === 'DRAFT')).toHaveLength(5);
    expect(requests.filter((request) => request.lifecycle === 'CANCELLED')).toHaveLength(1);
  });

  it('keeps the standalone available Invoice outside every existing request', async () => {
    const { AVAILABLE_PAYMENT_REQUEST_INVOICE_ID } = await import('./prototypeResourceFixtures');
    expect(invoices.some((invoice) => invoice.invoiceId === AVAILABLE_PAYMENT_REQUEST_INVOICE_ID)).toBe(true);
    expect(requests.some((request) => request.creatorLinks?.some((link) => (
      link.invoiceIds.includes(AVAILABLE_PAYMENT_REQUEST_INVOICE_ID)
    )))).toBe(false);
  });
});
