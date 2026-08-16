import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('PaymentListEditor', () => {
  it('keeps the editor as a separate two-pane, provider-aware workflow', () => {
    const source = readFileSync(new URL('./PaymentListEditor.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('./PaymentListEditor.css', import.meta.url), 'utf8');

    expect(source).toContain('Invoice 快照');
    expect(source).toContain('Airwallex');
    expect(source).toContain('PayPal');
    expect(source).toContain('PayMax');
    expect(source).toContain('onUpdatePaymentItem');
    expect(source).toContain('onPointerUp');
    expect(source).toContain('ArrowLeft');
    expect(source).toContain('ArrowRight');
    expect(css).toContain('grid-template-columns: minmax(300px, .88fr) minmax(420px, 1.12fr)');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('touch-action');
  });
});
