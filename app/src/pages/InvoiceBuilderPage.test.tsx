import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { INITIAL_CONTRACTS } from '../contracts';
import { INITIAL_INVOICE_ENTITY, INITIAL_PAYOUTS } from '../data';
import {
  INVOICE_EDIT_REQUEST_INVOICES,
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

  it('opens the INV-240705 media recheck request with editable prototype data', () => {
    const record = INVOICE_EDIT_REQUEST_INVOICES[0]!;
    const html = renderToStaticMarkup(
      <InvoiceBuilderPage
        creators={INITIAL_CREATORS}
        payouts={[...INITIAL_PAYOUTS, ...PROJECT_DEMO_PAYOUTS]}
        projects={INITIAL_PROJECTS}
        contracts={[...INITIAL_CONTRACTS, ...PROJECT_DEMO_CONTRACTS]}
        invoiceEntity={INITIAL_INVOICE_ENTITY}
        generatedInvoices={[record, ...PROJECT_DEMO_INVOICES]}
        editRecord={record}
        editContext="MEDIA_RECHECK"
        onEdited={() => record}
        onCancel={() => undefined}
        onOpenInvoiceManagement={() => undefined}
      />,
    );

    expect(html).toContain('修改 Invoice');
    expect(html).toContain('INV-240705');
    expect(html).toContain('invoice_fixture_edit_pay_013');
    expect(html).toContain('pay-013');
    expect(html).toContain('value="2440"');
    expect(html).toContain('保存修改并重新签署');
  });

  it('shows stable payout-account selection for an Invoice content payment failure', () => {
    const record = PROJECT_DEMO_INVOICES[2]!;
    const html = renderToStaticMarkup(
      <InvoiceBuilderPage
        creators={INITIAL_CREATORS}
        payouts={PROJECT_DEMO_PAYOUTS}
        projects={INITIAL_PROJECTS}
        contracts={PROJECT_DEMO_CONTRACTS}
        invoiceEntity={INITIAL_INVOICE_ENTITY}
        generatedInvoices={PROJECT_DEMO_INVOICES}
        editRecord={record}
        editContext="PAYMENT_FAILURE_CONTENT"
        onEdited={() => record}
        onCancel={() => undefined}
        onOpenInvoiceManagement={() => undefined}
      />,
    );

    expect(html).toContain('付款账户 *');
    expect(html).toContain('aria-label="付款账户"');
    expect(html).toContain('Thailand THB 主账户 · 默认');
    expect(html).toContain('选择达人档案中的已验证账户后');
    expect(html).toContain('保存并重新发起签署');
  });
});
