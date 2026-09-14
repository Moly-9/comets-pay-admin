import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { applyPaymentBatchPrototypeScenario } from '../paymentBatchPrototypeScenario';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';
import type { ContractRecord } from '../contracts';
import type { GeneratedInvoiceRecord, Payout } from '../types';
import {
  DashboardPage,
  dashboardDocumentMetricsFor,
  dashboardRequestMetricsFor,
} from './DashboardPage';

const prototypeScenario = applyPaymentBatchPrototypeScenario({
  payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
  requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
  generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
  paymentLists: INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists,
});

describe('dashboard request project overview', () => {
  it('derives the confirmed mutually exclusive six-card demo metrics', () => {
    expect(dashboardRequestMetricsFor(
      prototypeScenario.requests,
      prototypeScenario.payouts,
    )).toEqual({
      total: 15,
      approving: 8,
      awaitingPayment: 2,
      paid: 3,
      processing: 1,
      failed: 1,
    });
  });

  it('renders the six cards in order with their request-list filters', () => {
    const html = renderToStaticMarkup(
      <DashboardPage
        requests={prototypeScenario.requests}
        creators={[]}
        contracts={[]}
        payouts={prototypeScenario.payouts}
        generatedInvoices={INITIAL_COMPLETE_REQUEST_RESOURCES.invoices}
        onNavigate={vi.fn()}
      />,
    );
    const cards = [
      ['total', 'all', '请款项目总数', 15],
      ['approving', 'approving', '审批中的项目', 8],
      ['awaiting-payment', 'awaiting-payment', '待打款项目', 2],
      ['paid', 'paid', '付款成功项目', 3],
      ['processing', 'processing', '渠道处理中的项目', 1],
      ['failed', 'failed', '付款失败的项目', 1],
    ] as const;

    let previousIndex = -1;
    cards.forEach(([id, filter, label, value], index) => {
      const cardIndex = html.indexOf(`data-testid="dashboard-request-card-${id}"`);
      expect(cardIndex).toBeGreaterThan(previousIndex);
      previousIndex = cardIndex;
      const nextId = cards[index + 1]?.[0];
      const nextCardIndex = nextId
        ? html.indexOf(`data-testid="dashboard-request-card-${nextId}"`)
        : html.indexOf('</section>', cardIndex);
      const cardHtml = html.slice(cardIndex, nextCardIndex);
      expect(cardHtml).toContain(`data-status-filter="${filter}"`);
      expect(cardHtml).toContain(label);
      expect(cardHtml).toContain(`<strong>${value}</strong>`);
    });
  });

  it('keeps three columns across desktop, tablet and phone layouts', () => {
    const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    expect(styles).toMatch(/\.dashboard-request-card-grid\s*{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
    expect(styles).toMatch(/@media \(max-width: 1024px\)[\s\S]*?\.dashboard-request-card-grid\s*{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width: 420px\)[\s\S]*?\.dashboard-request-card-grid\s*{[^}]*gap:\s*6px/);
    expect(styles).toMatch(/\.dashboard-asset-stage:only-child\s*{[^}]*flex:\s*0 1 auto[^}]*grid-template-columns:\s*auto auto auto/s);
  });

  it('groups contract and Invoice progress into the requested dashboard stages', () => {
    const baseContract = INITIAL_COMPLETE_REQUEST_RESOURCES.contracts.find((contract) => !contract.isTemplate)!;
    const contract = (
      id: string,
      updates: Partial<ContractRecord>,
    ): ContractRecord => ({
      ...baseContract,
      id,
      isTemplate: false,
      campaignEnd: '2099-12-31',
      ...updates,
    });
    const contracts = [
      contract('draft', { lifecycle: 'EDITING_DRAFT' }),
      contract('upload', { lifecycle: 'GENERATED_DRAFT' }),
      contract('signature', { lifecycle: 'SENT_FOR_SIGNATURE', signed: false }),
      contract('attention', { lifecycle: 'RECOGNITION_CONFIRMED', signed: false }),
      contract('ready', {
        lifecycle: 'CONFIRMED',
        signed: true,
        issues: [],
        publisher: 'Demo Creator',
        currency: 'USD',
        totalFee: 100,
        paymentWithinWorkingDays: 10,
        paymentMethod: 'BANK',
        feeBearer: 'ADVERTISER',
      }),
      contract('expired', { lifecycle: 'CONFIRMED', campaignEnd: '2020-01-01' }),
      contract('template', { isTemplate: true }),
    ];
    const invoice = (id: string, sourcePayoutId: string) => ({
      id: `INV-${id.toUpperCase()}`,
      invoiceId: `invoice-${id}` as GeneratedInvoiceRecord['invoiceId'],
      sourcePayoutId,
    });
    const invoices = [invoice('a', 'payout-a'), invoice('b', 'payout-b'), invoice('c', 'payout-c')];
    const payouts = [
      { id: 'payout-a', invoice: 'INV-A', status: '已付款' },
      { id: 'retry-a', invoice: 'INV-A', status: '已付款' },
      { id: 'retry-b', invoice: 'INV-B', status: '已付款' },
      { id: 'legacy', invoice: 'INV-LEGACY', status: '未进入付款' },
    ] as Pick<Payout, 'id' | 'invoice' | 'status'>[];

    expect(dashboardDocumentMetricsFor(contracts, payouts, invoices)).toEqual({
      contracts: {
        total: 6,
        processing: 4,
        ready: 1,
        expired: 1,
      },
      invoices: {
        total: 4,
        inProgress: 2,
        paid: 2,
      },
    });
  });

  it('renders the new contract and Invoice progress labels', () => {
    const html = renderToStaticMarkup(
      <DashboardPage
        requests={prototypeScenario.requests}
        creators={[]}
        contracts={INITIAL_COMPLETE_REQUEST_RESOURCES.contracts}
        payouts={prototypeScenario.payouts}
        generatedInvoices={INITIAL_COMPLETE_REQUEST_RESOURCES.invoices}
        onNavigate={vi.fn()}
      />,
    );
    const contractRow = html.slice(
      html.indexOf('data-testid="dashboard-row-contracts"'),
      html.indexOf('data-testid="dashboard-row-invoice"'),
    );
    const invoiceRow = html.slice(html.indexOf('data-testid="dashboard-row-invoice"'));

    expect(contractRow).toContain('处理中');
    expect(contractRow).toContain('可用于付款');
    expect(contractRow).toContain('已失效');
    expect(contractRow).not.toContain('已打款');
    expect(invoiceRow).toContain('正在推进');
    expect(invoiceRow).toContain('已打款');
  });
});
