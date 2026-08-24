import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CreatorId, EngagementId, InvoiceId, ProjectId } from '../businessWorkflow';
import { INITIAL_CONTRACTS } from '../contracts';
import { INITIAL_INVOICE_BILLING_SETTINGS, INITIAL_PAYOUTS } from '../data';
import type { GeneratedInvoiceRecord, InvoiceBatchRow } from '../types';
import { InvoiceBatchBuilderPage, InvoiceBatchResultSection } from './InvoiceBatchBuilderPage';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from './OperationalPages';

describe('InvoiceBatchBuilderPage layout', () => {
  it('renders the five batch workflow areas as cards with individual validation metrics', () => {
    const html = renderToStaticMarkup(
      <InvoiceBatchBuilderPage
        creators={INITIAL_CREATORS}
        payouts={INITIAL_PAYOUTS}
        projects={INITIAL_PROJECTS}
        contracts={INITIAL_CONTRACTS}
        invoiceBillingSettings={INITIAL_INVOICE_BILLING_SETTINGS}
        generatedInvoices={[]}
        onGenerated={() => undefined}
        onDirtyChange={() => undefined}
        onCancel={() => undefined}
        onOpenInvoiceManagement={() => undefined}
        onOpenCreatorPaymentInformation={() => undefined}
      />,
    );

    expect(html.match(/data-batch-section=/g)).toHaveLength(5);
    expect(html.match(/invoice-builder-section invoice-batch-card/g)).toHaveLength(5);
    expect(html).toContain('data-batch-section="project"');
    expect(html).toContain('data-batch-section="creators"');
    expect(html).toContain('data-batch-section="common"');
    expect(html).toContain('data-batch-section="validation"');
    expect(html).toContain('data-batch-section="results"');
    expect(html).toContain('aria-label="批量 Invoice 校验汇总"');
    expect(html).toContain('<dt>已选择达人</dt>');
    expect(html).toContain('<dt>可生成invoice</dt>');
    expect(html).toContain('<dt>需处理条数</dt>');
    expect(html).toContain('<dt>批次总金额</dt>');
    expect(html).toContain('暂无生成结果');
    expect(html).toContain('统一 Description');
    expect(html).not.toContain('分别填写 Description');
    expect(html).not.toContain('逐人费用模板');
  });

  it('renders generated results with creator avatars, reference columns, and file actions', () => {
    const creator = INITIAL_CREATORS[0];
    const snapshot = {
      invoiceNumber: 'INV-20260811-001',
      currency: 'EUR',
      payoutProvider: 'Airwallex',
    } as GeneratedInvoiceRecord['snapshot'];
    const row: InvoiceBatchRow = {
      projectId: 'project_result_test' as ProjectId,
      engagementId: 'engagement_result_test' as EngagementId,
      creatorId: creator.id as CreatorId,
      creatorName: creator.name,
      creatorHandle: creator.handle,
      sourcePayoutId: 'payout_result_test',
      invoiceDate: '2026-08-11',
      items: [{
        id: 'item_result_test',
        templateKey: 'template_result_test',
        description: 'Creator service',
        unitPrice: 1680,
        quantity: 1,
        lineTotal: 1680,
      }],
      descriptionOverrideKeys: [],
      currency: 'EUR',
      payoutAccountId: '',
      payoutAccountLocked: false,
      contractIds: [],
      availableContractIds: [],
      contractMatchReason: '',
      status: 'GENERATED',
      issues: [],
      generated: {
        record: {
          id: 'generated_result_test',
          invoiceId: 'invoice_result_test' as InvoiceId,
          sourcePayoutId: 'payout_result_test',
          status: '待签署',
          generatedAt: '2026-08-11T08:00:00.000Z',
          snapshot,
          validationStatus: 'valid',
        },
        pdfBlob: new Blob(['pdf']),
        docxBlob: new Blob(['docx']),
      },
    };
    const html = renderToStaticMarkup(
      <InvoiceBatchResultSection
        rows={[row]}
        creators={[creator]}
        contracts={[]}
        fallbackCurrency="EUR"
        onDownloadZip={() => undefined}
      />,
    );

    expect(html).toContain('invoice-batch-result-creator');
    expect(html).toContain('avatar avatar-sm');
    expect(html).toContain(creator.initials);
    expect(html).toContain('<th>付款渠道</th>');
    expect(html).toContain('<th>Invoice</th>');
    expect(html).toContain('<th>合同</th>');
    expect(html).toContain('<th>Invoice 金额</th>');
    expect(html).toContain('data-provider="Airwallex"');
    expect(html).toContain('1 份 Invoice');
    expect(html).toContain('INV-20260811-001');
    expect(html).toContain('下载整批 ZIP');
    expect(html).toContain(`aria-label="下载 ${creator.name} 的 PDF"`);
    expect(html).toContain(`aria-label="下载 ${creator.name} 的 DOCX"`);
  });
});
