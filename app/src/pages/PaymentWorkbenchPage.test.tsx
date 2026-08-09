import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_PAYOUTS } from '../data';
import { PaymentWorkbenchPage } from './PaymentWorkbenchPage';

describe('PaymentWorkbenchPage currency overview', () => {
  it('shows an emphasized USD total and every supported secondary currency in both cards', () => {
    const html = renderToStaticMarkup(
      <PaymentWorkbenchPage
        payouts={INITIAL_PAYOUTS}
        onNewBatch={vi.fn()}
        onSelectPayout={vi.fn()}
        canCreateBatch
      />,
    );

    expect(html).toContain('待付款');
    expect(html).toContain('本月已付款');
    expect(html.match(/payment-currency-entry-primary/g)).toHaveLength(2);
    expect(html.match(/>USD<\/dt>/g)).toHaveLength(2);
    expect(html.match(/>EUR<\/dt>/g)).toHaveLength(2);
    expect(html.match(/>GBP<\/dt>/g)).toHaveLength(2);
    expect(html.match(/>HKD<\/dt>/g)).toHaveLength(2);
    expect(html).toContain('48,210');
    expect(html).toContain('24 笔');
    expect(html).toContain('692,300');
    expect(html).toContain('34 笔');
  });
});
