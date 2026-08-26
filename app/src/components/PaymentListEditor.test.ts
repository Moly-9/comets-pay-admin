import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('PaymentListEditor', () => {
  it('renders a responsive payment table with inline detail, edit, bulk fill and API validation', () => {
    const source = readFileSync(new URL('./PaymentListEditor.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('./PaymentListEditor.css', import.meta.url), 'utf8');

    ['Handle', '真名', 'Invoice 编号', '付款账户', '付款金额', '支付币种', '收款币种', '转账方式', '手续费承担方', '付款原因', '交易附言'].forEach((label) => expect(source).toContain(label));
    expect(source).toContain('查看详情');
    expect(source).toContain('PaymentInlinePanel');
    expect(source).toContain('整单批量填入');
    expect(source).toContain("applyBulkField('paymentReason', bulkPaymentReason)");
    expect(source).toContain("applyBulkField('transactionReference', bulkTransactionReference)");
    expect(source).toContain('isValidPaymentTransactionReference');
    expect(source).toContain("update('amount', Number(event.target.value))");
    expect(source).toContain("update('currency', value)");
    expect(source).toContain("update('receiveCurrency', value)");
    expect(source).toContain('转账方式（只读）');
    expect(source).toContain('正在校验…');
    expect(source).toContain('生成付款清单');
    expect(css).toContain('.payment-list-table-scroll');
    expect(css).toContain('.payment-list-expanded-row');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('position: sticky');
  });
});
