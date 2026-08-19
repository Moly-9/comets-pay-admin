import { readFileSync } from 'node:fs';
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

const invoiceBuilderSource = readFileSync(new URL('./InvoiceBuilderPage.tsx', import.meta.url), 'utf8');

describe('InvoiceBuilderPage create mode', () => {
  it('keeps every fee-detail input blank until the user enters it', () => {
    const html = renderToStaticMarkup(
      <InvoiceBuilderPage
        creators={INITIAL_CREATORS}
        payouts={[...INITIAL_PAYOUTS, ...PROJECT_DEMO_PAYOUTS]}
        projects={INITIAL_PROJECTS}
        contracts={[...INITIAL_CONTRACTS, ...PROJECT_DEMO_CONTRACTS]}
        invoiceEntity={INITIAL_INVOICE_ENTITY}
        generatedInvoices={[]}
        onCancel={() => undefined}
        onOpenInvoiceManagement={() => undefined}
      />,
    );

    expect(html).toMatch(/<span>DESCRIPTION<\/span><input[^>]*value=""/);
    expect(html).toMatch(/<span>PRICE<\/span><input[^>]*value=""/);
    expect(html).toMatch(/<span>AMOUNT<\/span><input[^>]*value=""/);
    expect(html).toContain('data-testid="invoice-fill-demo"');
    expect(html).toContain('填充演示数据');
  });

  it('keeps user-entered fee details independent from contract selection', () => {
    const contractSelectionHandler = invoiceBuilderSource.match(
      /const toggleContract = [\s\S]*?const selectPayoutAccount =/,
    )?.[0];

    expect(contractSelectionHandler).toBeDefined();
    expect(contractSelectionHandler).not.toContain('setItems(');
    expect(contractSelectionHandler).not.toContain('contract.totalFee');
    expect(contractSelectionHandler).not.toContain('line-contract-');
  });
});

describe('InvoiceBuilderPage edit mode', () => {
  it('prefills business identity fields without exposing internal IDs or enabling an unchanged save', () => {
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
    expect(html).not.toContain('填充演示数据');
    expect(html).toContain(record.id);
    expect(html).not.toContain(record.invoiceId);
    expect(html).not.toContain(record.sourcePayoutId);
    expect(html).not.toContain('Invoice ID（锁定）');
    expect(html).not.toContain('Source Payout ID（锁定）');
    expect(html).toContain('达人、项目及 Invoice 编号已锁定');
    expect(html).toContain('保存并重新发送达人');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*保存并重新发送达人/s);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-labelledby="invoice-contract-coverage-label"');
    expect(html).toContain('已选 2 份');
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
    expect(html).not.toContain('invoice_fixture_edit_pay_013');
    expect(html).not.toContain('pay-013');
    expect(html).toContain('value="2440"');
    expect(html).toContain('保存修改并重新签署');
  });

  it('shows stable payout-account selection for an Invoice content payment failure', () => {
    const sourceRecord = PROJECT_DEMO_INVOICES[2]!;
    const stablePayoutAccountId = 'stable-awx-creator-nika';
    const record = {
      ...sourceRecord,
      snapshot: {
        ...sourceRecord.snapshot,
        payoutAccountId: stablePayoutAccountId,
        payment: {
          ...sourceRecord.snapshot.payment,
          payoutAccountId: stablePayoutAccountId,
        },
      },
    };
    const creatorsWithDistinctAccountIds = INITIAL_CREATORS.map((creator) => (
      creator.id === record.snapshot.creatorId
        ? {
            ...creator,
            payoutAccounts: creator.payoutAccounts.map((account) => ({
              ...account,
              payoutAccountId: `stable-${account.id}`,
            })),
          }
        : creator
    ));
    const html = renderToStaticMarkup(
      <InvoiceBuilderPage
        creators={creatorsWithDistinctAccountIds}
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

  it('unlocks payout account and payment method for the scoped finance Invoice return', () => {
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
        editContext="PROJECT_RESOURCE"
        allowPayoutAccountChange
        onEdited={() => record}
        onCancel={() => undefined}
        onOpenInvoiceManagement={() => undefined}
      />,
    );

    const payoutAccountTrigger = html.match(/<button[^>]*aria-label="付款账户"[^>]*>/)?.[0];
    const paymentMethodTrigger = html.match(/<button[^>]*aria-label="付款方式"[^>]*>/)?.[0];
    expect(html).toContain('财务以 Invoice 原因退回，可重新选择达人档案中的已验证账户及相应付款方式。');
    expect(html).toContain('同步刷新对应付款明细');
    expect(payoutAccountTrigger).not.toContain('disabled');
    expect(paymentMethodTrigger).not.toContain('disabled');
  });

  it('keeps payout fields editable independently from the selected contracts', () => {
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
        editContext="PROJECT_RESOURCE"
        onEdited={() => record}
        onCancel={() => undefined}
        onOpenInvoiceManagement={() => undefined}
      />,
    );

    expect(html.match(/<button[^>]*aria-label="付款账户"[^>]*>/)?.[0]).not.toContain('disabled');
    expect(html.match(/<button[^>]*aria-label="付款方式"[^>]*>/)?.[0]).not.toContain('disabled');
    expect(html).toContain('选择达人档案中的已验证账户后');
  });
});
