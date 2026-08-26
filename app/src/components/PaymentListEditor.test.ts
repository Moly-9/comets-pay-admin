import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('PaymentListEditor', () => {
  it('keeps the editor as a separate two-pane, provider-aware workflow', () => {
    const source = readFileSync(new URL('./PaymentListEditor.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('./PaymentListEditor.css', import.meta.url), 'utf8');

    expect(source).toContain('Invoice 快照');
    expect(source).toContain('Invoice PDF 文件快照');
    expect(source).toContain('InvoiceDocumentView');
    expect(source).toContain('缩放');
    expect(source).toContain('金额、币种和收款账户来自 Invoice 签署冻结快照');
    expect(source).toContain('本次执行账户');
    expect(source).toContain('accountEditableInvoiceIds');
    expect(source).toContain('accountOverrideOnly');
    expect(source).toContain('paymentFieldsEditable = editable && !accountOverrideOnly');
    expect(source).toContain('编辑付款手续费承担方');
    expect(source).toContain('paymentListContractFeeBearer');
    expect(source).toContain('contractFeeBearer.locked');
    expect(source).toContain('合同未约定，请填写');
    expect(source).toContain('合同约定不一致，请确认');
    expect(source).toContain('付款描述（选填）');
    expect(source).toContain('Airwallex');
    expect(source).toContain('PayPal');
    expect(source).toContain('PayMax');
    expect(source).toContain('onUpdatePaymentItem');
    expect(source).toContain('整单批量填入');
    expect(source).toContain('payment-list-editor-header-actions');
    expect(source).toContain("applyBulkField('paymentReason', bulkPaymentReason)");
    expect(source).toContain("applyBulkField('transactionReference', bulkTransactionReference)");
    expect(source).toContain('list.items.forEach');
    expect(source).toContain('onPointerUp');
    expect(source).toContain('ArrowLeft');
    expect(source).toContain('ArrowRight');
    expect(css).toContain('--payment-editor-inset');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 2fr)');
    expect(css).toContain('min-height: 56px');
    expect(css).toContain('grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr)');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('touch-action');
    expect(css).toContain('payment-list-editor-bulk-fill');
    expect(css).toContain('payment-list-editor-source-lock');
    expect(css).toContain('payment-list-editor-source-lock.is-warning');
  });
});
