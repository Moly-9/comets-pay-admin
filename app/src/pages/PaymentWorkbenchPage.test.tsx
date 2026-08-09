import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_PAYOUTS } from '../data';
import type { InvoiceCurrency, Payout } from '../types';
import { PaymentWorkbenchPage } from './PaymentWorkbenchPage';

const renderWorkbench = (payouts: Payout[]) => renderToStaticMarkup(
  <PaymentWorkbenchPage
    payouts={payouts}
    onNewBatch={vi.fn()}
    onSelectPayout={vi.fn()}
    canCreateBatch
    currentDate={new Date('2026-08-09T00:00:00.000Z')}
  />,
);

const payout = (currency: InvoiceCurrency, index: number): Payout => ({
  id: `test-payout-${index}`,
  creator: `Creator ${index}`,
  handle: `@creator-${index}`,
  initials: 'CR',
  projectId: `test-project-${index}`,
  project: `Project ${index}`,
  contract: `CON-TEST-${index}`,
  invoice: `INV-TEST-${index}`,
  provider: 'Airwallex',
  currency,
  amount: index * 100,
  account: `00000000${index}`,
  status: '等待付款',
  invoiceReviewStatus: '已通过',
  accent: '#8b5cf6',
});

describe('PaymentWorkbenchPage currency overview', () => {
  it('restores the original card classes and renders both five-currency detail actions', () => {
    const html = renderWorkbench(INITIAL_PAYOUTS);

    expect(html).toContain('summary-surface payment-workbench-summary');
    expect(html).toContain('summary-card summary-card-peach');
    expect(html).toContain('summary-card summary-card-lilac');
    expect(html).not.toContain('payment-currency-card');
    expect(html).toContain('USD 7,840');
    expect(html).toContain('待付款总额 · 3 笔');
    expect(html).toContain('USD 4,860');
    expect(html).toContain('本月已付款 · 1 笔');
    expect(html.match(/>查看详情<\/button>/g)).toHaveLength(2);
  });

  it('hides the detail action when a card has no more than four currencies', () => {
    const html = renderWorkbench(['USD', 'EUR', 'GBP', 'HKD'].map((currency, index) => (
      payout(currency as InvoiceCurrency, index + 1)
    )));

    expect(html).not.toContain('查看详情');
    expect(html).toContain('>EUR<');
    expect(html).toContain('>GBP<');
    expect(html).toContain('>HKD<');
  });

  it('renders the USD zero-value fallback when no USD payout exists', () => {
    const html = renderWorkbench([payout('EUR', 1)]);

    expect(html).toContain('USD 0');
    expect(html).toContain('待付款总额 · 0 笔');
  });
});
