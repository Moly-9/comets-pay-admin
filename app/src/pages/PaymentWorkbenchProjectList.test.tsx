import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Payout } from '../types';
import {
  buildPaymentProjectRows,
  filterPaymentProjectRows,
  PaymentWorkbenchPage,
  summarizePaymentProjectRows,
  togglePaymentProjectSelection,
} from './PaymentWorkbenchPage';

const payout = ({
  id,
  projectId,
  project,
  contract,
  invoice,
  provider,
  currency,
  amount,
}: Pick<Payout, 'id' | 'projectId' | 'project' | 'contract' | 'invoice' | 'provider' | 'currency' | 'amount'>): Payout => ({
  id,
  creator: `Creator ${id}`,
  handle: `@${id}`,
  initials: 'CP',
  projectId,
  project,
  contract,
  invoice,
  provider,
  currency,
  amount,
  account: `account-${id}`,
  status: '等待付款',
  invoiceReviewStatus: '已通过',
  accent: '#8b5cf6',
});

const projectPayouts: Payout[] = [
  payout({
    id: 'alpha-airwallex',
    projectId: 'project-alpha',
    project: 'Alpha Launch',
    contract: 'CON-ALPHA-01',
    invoice: 'INV-ALPHA-01',
    provider: 'Airwallex',
    currency: 'USD',
    amount: 1200,
  }),
  payout({
    id: 'alpha-paypal',
    projectId: 'project-alpha',
    project: 'Alpha Launch',
    contract: 'CON-ALPHA-02',
    invoice: 'INV-ALPHA-02',
    provider: 'PayPal',
    currency: 'EUR',
    amount: 300,
  }),
  payout({
    id: 'beta-airwallex',
    projectId: 'project-beta',
    project: 'Beta Campaign',
    contract: 'CON-BETA-01',
    invoice: 'INV-BETA-01',
    provider: 'Airwallex',
    currency: 'USD',
    amount: 800,
  }),
];

describe('PaymentWorkbenchPage project list controls', () => {
  it('renders search, the renamed provider default, selection, and payment channel column', () => {
    const html = renderToStaticMarkup(
      <PaymentWorkbenchPage
        payouts={projectPayouts}
        requests={[]}
        generatedInvoices={[]}
        onNewBatch={vi.fn()}
        onSelectPayout={vi.fn()}
        onReviewRequest={vi.fn()}
        onExecuteRequest={vi.fn(() => true)}
        canCreateBatch
      />,
    );

    expect(html).toContain('aria-label="搜索待审核付款项目"');
    expect(html).toContain('placeholder="搜索项目编号、名称、付款单等"');
    expect(html.indexOf('aria-label="搜索待审核付款项目"')).toBeLessThan(html.indexOf('type="date"'));
    expect(html).toContain('全部付款渠道');
    expect(html).toContain('aria-label="全选当前筛选结果中的付款项目"');
    expect(html).toContain('<th>付款单</th><th>付款渠道</th>');
    expect(html).toContain('待审核合计 · 0 个项目');
  });

  it('searches all fields in the active tab and filters by every project payment channel', () => {
    const rows = buildPaymentProjectRows({
      tab: 'payment',
      payouts: projectPayouts,
      requests: [],
      generatedInvoices: [],
    });

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === 'legacy:project-alpha')?.paymentChannels).toEqual([
      'Airwallex',
      'PayPal',
    ]);
    expect(filterPaymentProjectRows(rows, { provider: '全部付款渠道', search: 'alpha inv-alpha-02' }))
      .toHaveLength(1);
    expect(filterPaymentProjectRows(rows, { provider: 'PayPal', search: '' }).map((row) => row.id))
      .toEqual(['legacy:project-alpha']);
    expect(filterPaymentProjectRows(rows, { provider: 'Airwallex', search: 'beta campaign' }).map((row) => row.id))
      .toEqual(['legacy:project-beta']);
  });

  it('adds contract, invoice, and currency totals for selected projects', () => {
    const rows = buildPaymentProjectRows({
      tab: 'payment',
      payouts: projectPayouts,
      requests: [],
      generatedInvoices: [],
    });
    const summary = summarizePaymentProjectRows(rows);

    expect(summary).toMatchObject({ projects: 2, contracts: 3, invoices: 3 });
    expect(summary.amounts).toEqual([
      { currency: 'USD', amount: 2000, count: 2 },
      { currency: 'EUR', amount: 300, count: 1 },
    ]);
  });

  it('toggles one or all filtered project ids without losing other tab selections', () => {
    const initial = new Set(['other-tab-project']);
    const selected = togglePaymentProjectSelection(initial, ['project-alpha', 'project-beta']);

    expect([...selected]).toEqual(['other-tab-project', 'project-alpha', 'project-beta']);
    expect([...togglePaymentProjectSelection(selected, ['project-alpha', 'project-beta'])])
      .toEqual(['other-tab-project']);
  });
});
