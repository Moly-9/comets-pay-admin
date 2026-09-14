import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { applyPaymentBatchPrototypeScenario } from '../paymentBatchPrototypeScenario';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';
import { DashboardPage, dashboardRequestMetricsFor } from './DashboardPage';

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
      total: 20,
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
      ['total', 'all', '请款项目总数', 20],
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

  it('keeps six desktop columns and three tablet and phone columns', () => {
    const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    expect(styles).toMatch(/\.dashboard-request-card-grid\s*{[^}]*grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/s);
    expect(styles).toMatch(/@media \(max-width: 1024px\)[\s\S]*?\.dashboard-request-card-grid\s*{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width: 420px\)[\s\S]*?\.dashboard-request-card-grid\s*{[^}]*gap:\s*6px/);
  });
});
