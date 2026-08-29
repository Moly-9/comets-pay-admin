import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InvoiceContractMismatchNotice } from './InvoiceContractMismatchNotice';

describe('InvoiceContractMismatchNotice', () => {
  it('renders every Invoice reason once with its audit metadata', () => {
    const html = renderToStaticMarkup(<InvoiceContractMismatchNotice items={[
      {
        invoiceNumber: 'INV-001',
        reason: '金额包含额外授权费用',
        meta: 'Mina Media · 08/29 14:30',
      },
      {
        invoiceNumber: 'INV-002',
        reason: '付款账户按达人最新确认信息执行',
      },
    ]} />);

    expect(html).toContain('aria-label="合同差异说明"');
    expect(html.match(/合同差异说明/g)).toHaveLength(3);
    expect(html).toContain('INV-001');
    expect(html).toContain('金额包含额外授权费用');
    expect(html).toContain('Mina Media · 08/29 14:30');
    expect(html).toContain('INV-002');
    expect(html).toContain('付款账户按达人最新确认信息执行');
  });

  it('does not render an empty approval notice', () => {
    expect(renderToStaticMarkup(<InvoiceContractMismatchNotice items={[]} />)).toBe('');
  });
});
