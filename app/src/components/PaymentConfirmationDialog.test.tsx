import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { paymentPreviewFor } from '../paymentPreview';
import { PaymentConfirmationDialog } from './PaymentConfirmationDialog';

vi.mock('react-dom', () => ({
  createPortal: (children: ReactNode) => children,
}));
vi.stubGlobal('document', { body: {} });

describe('PaymentConfirmationDialog', () => {
  it('shows every transaction as a semantic table row with ordered fields and actual-paid totals', () => {
    const html = renderToStaticMarkup(
      <PaymentConfirmationDialog
        rows={[
          {
            id: 'payment-1',
            creatorName: 'Synthetic Creator',
            invoiceNumber: 'INV-001',
            account: '•••• 0001',
            preview: paymentPreviewFor({
              payout: {
                id: 'payment-1',
                provider: 'Airwallex',
                currency: 'USD',
                amount: 1_000,
              },
              feeBearer: 'ADVERTISER',
            }),
          },
          {
            id: 'payment-2',
            creatorName: 'Second Synthetic Creator',
            invoiceNumber: 'INV-002',
            account: '•••• 0002',
            preview: paymentPreviewFor({
              payout: {
                id: 'payment-2',
                provider: 'Airwallex',
                currency: 'USD',
                amount: 500,
              },
              feeBearer: 'PUBLISHER',
            }),
          },
        ]}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toContain('确认本次打款');
    expect(html).toContain('收款账户');
    expect(html).toContain('请款金额');
    expect(html).toContain('渠道手续费');
    expect(html).toContain('手续费承担方');
    expect(html).toContain('我方实际支付');
    expect(html).toContain('对方预计到账');
    expect(html).toContain('本次我方实付合计');
    expect(html).toContain('USD 1,502.00');
    expect(html).toContain('>确认打款</span>');
    expect(html).toContain('<table class="payment-confirmation-table">');
    expect(html).toContain('<caption class="sr-only">本次打款交易明细</caption>');
    expect(html.match(/<tbody><tr>/g)).toHaveLength(1);
    expect(html.match(/<tr>/g)).toHaveLength(3);
    expect(html).toContain('data-label="达人 / Invoice"');
    expect(html).toContain('Synthetic Creator');
    expect(html).toContain('INV-001');
    expect(html).toContain('•••• 0001');
    expect(html).toContain('Second Synthetic Creator');
    expect(html).toContain('INV-002');
    expect(html).toContain('•••• 0002');

    const headings = [
      '序号',
      '达人 / Invoice',
      '收款账户',
      '请款金额',
      '渠道手续费',
      '手续费承担方',
      '我方实际支付',
      '对方预计到账',
    ];
    const tableHead = html.slice(html.indexOf('<thead>'), html.indexOf('</thead>'));
    headings.reduce((previousIndex, heading) => {
      const index = tableHead.indexOf(`>${heading}</th>`);
      expect(index).toBeGreaterThan(previousIndex);
      return index;
    }, -1);

    const css = readFileSync(new URL('./PaymentConfirmationDialog.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.payment-confirmation-dialog \.modal-footer \{[\s\S]*?display: flex;[\s\S]*?padding-block: 16px;/);
    expect(css).toMatch(/\.payment-confirmation-table th \{[\s\S]*?position: sticky;[\s\S]*?top: 0;/);
    expect(css).toMatch(/\.payment-confirmation-money-cell \{[\s\S]*?font-variant-numeric: tabular-nums;/);
    expect(css).toMatch(/@media \(max-width: 760px\) \{[\s\S]*?\.payment-confirmation-table td \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns:/);
    expect(css).toContain('content: attr(data-label);');
  });
});
