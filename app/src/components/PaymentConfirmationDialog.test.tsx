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
  it('shows every transaction field and actual-paid totals without a table scroller', () => {
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
    expect(html).toContain('USD 1,002.00');
    expect(html).toContain('>确认打款</span>');
    expect(html).not.toContain('<table');

    const css = readFileSync(new URL('./PaymentConfirmationDialog.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.payment-confirmation-dialog \.modal-footer \{[\s\S]*?display: flex;[\s\S]*?padding-block: 16px;/);
  });
});
