import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { INITIAL_INVOICE_ENTITY } from '../data';
import {
  PROJECT_DEMO_CONTRACTS,
  PROJECT_DEMO_INVOICES,
  PROJECT_DEMO_PAYOUTS,
} from '../prototypeResourceFixtures';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from './OperationalPages';
import { InvoiceBuilderPage } from './InvoiceBuilderPage';

describe('InvoiceBuilderPage edit mode', () => {
  it('prefills and locks stable identity fields without enabling an unchanged save', () => {
    const record = PROJECT_DEMO_INVOICES[0]!;
    const html = renderToStaticMarkup(
      <InvoiceBuilderPage
        creators={INITIAL_CREATORS}
        payouts={PROJECT_DEMO_PAYOUTS}
        projects={INITIAL_PROJECTS}
        contracts={PROJECT_DEMO_CONTRACTS}
        invoiceEntity={INITIAL_INVOICE_ENTITY}
        generatedInvoices={PROJECT_DEMO_INVOICES}
        editRecord={record}
        editContext="CREATOR_FEEDBACK"
        onEdited={() => record}
        onCancel={() => undefined}
        onOpenInvoiceManagement={() => undefined}
      />,
    );

    expect(html).toContain('修改 Invoice');
    expect(html).toContain(record.id);
    expect(html).toContain(record.invoiceId);
    expect(html).toContain(record.sourcePayoutId);
    expect(html).toContain('Invoice ID（锁定）');
    expect(html).toContain('Source Payout ID（锁定）');
    expect(html).toContain('保存并重新发送达人');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*保存并重新发送达人/s);
  });
});
