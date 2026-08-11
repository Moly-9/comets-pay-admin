import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { INITIAL_CONTRACTS } from '../contracts';
import { INITIAL_INVOICE_ENTITY, INITIAL_PAYOUTS } from '../data';
import { InvoiceBatchBuilderPage } from './InvoiceBatchBuilderPage';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from './OperationalPages';

describe('InvoiceBatchBuilderPage layout', () => {
  it('renders the four batch workflow areas as cards with individual validation metrics', () => {
    const html = renderToStaticMarkup(
      <InvoiceBatchBuilderPage
        creators={INITIAL_CREATORS}
        payouts={INITIAL_PAYOUTS}
        projects={INITIAL_PROJECTS}
        contracts={INITIAL_CONTRACTS}
        invoiceEntity={INITIAL_INVOICE_ENTITY}
        generatedInvoices={[]}
        onGenerated={() => undefined}
        onDirtyChange={() => undefined}
        onCancel={() => undefined}
        onOpenInvoiceManagement={() => undefined}
        onOpenCreatorPaymentInformation={() => undefined}
      />,
    );

    expect(html.match(/data-batch-section=/g)).toHaveLength(4);
    expect(html.match(/invoice-builder-section invoice-batch-card/g)).toHaveLength(4);
    expect(html).toContain('data-batch-section="mode"');
    expect(html).toContain('data-batch-section="creators"');
    expect(html).toContain('data-batch-section="common"');
    expect(html).toContain('data-batch-section="validation"');
    expect(html).toContain('aria-label="批量 Invoice 校验汇总"');
    expect(html).toContain('<dt>已选择达人</dt>');
    expect(html).toContain('<dt>可生成invoice</dt>');
    expect(html).toContain('<dt>需处理条数</dt>');
    expect(html).toContain('<dt>批次总金额</dt>');
  });
});
