import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CreatorId, EngagementId, InvoiceId, ProjectId } from '../businessWorkflow';
import { INITIAL_CONTRACTS } from '../contracts';
import { INITIAL_INVOICE_BILLING_SETTINGS, INITIAL_PAYOUTS } from '../data';
import type { GeneratedInvoiceRecord, InvoiceBatchRow } from '../types';
import { InvoiceBatchBuilderPage, InvoiceBatchResultSection } from './InvoiceBatchBuilderPage';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from './OperationalPages';

describe('InvoiceBatchBuilderPage layout', () => {
  it('separates compact creator accounts, contract selection, and contract preview actions', () => {
    const source = readFileSync(new URL('./InvoiceBatchBuilderPage.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./InvoiceBatchBuilderPage.css', import.meta.url), 'utf8');
    const tableSource = source.match(/function BatchRowTable\([\s\S]*?export function InvoiceBatchBuilderPage/)?.[0] ?? '';
    const contractPickerSource = tableSource.match(/<details className="invoice-batch-contract-picker">[\s\S]*?<\/details>/)?.[0] ?? '';

    expect(tableSource).toContain('showSocialAccounts={false}');
    expect(tableSource).toContain('<CreatorSocialAccounts');
    expect(tableSource).toContain('maxVisible={1}');
    expect(tableSource).toContain('className="invoice-batch-creator-socials"');
    expect(contractPickerSource).toContain('className="invoice-batch-contract-select"');
    expect(contractPickerSource).toContain('aria-pressed={selected}');
    expect(contractPickerSource).toContain('<Circle size={17}');
    expect(contractPickerSource).not.toContain('type="checkbox"');
    expect(contractPickerSource.indexOf('<strong>{contract.name}</strong>')).toBeLessThan(
      contractPickerSource.indexOf('<small>{contract.id}</small>'),
    );
    expect(contractPickerSource).toContain('onPreviewContract(contract)');
    expect(tableSource).toContain('<InvoiceContractMatchPanel');
    expect(source).toContain('className="invoice-batch-contract-preview-modal"');
    expect(source).toContain('<ContractDocumentView');
    expect(tableSource).toContain('contractMatchCollapsed');
    expect(tableSource).toContain('差异说明已填写');
    expect(tableSource).toContain('查看差异');
    expect(tableSource).toContain('onCollapseMatch(row.engagementId)');
    expect(source).toContain('const [collapsedMatchRows, setCollapsedMatchRows]');
    expect(source).not.toContain('withInvoiceBatchPrototypeAccounts');
    expect(source).not.toContain('seed.payoutProvider');
    expect(styles).toContain('.invoice-batch-contract-select[aria-pressed="true"]');
    expect(styles).toContain('.invoice-batch-match-reason-row .invoice-contract-match-panel');
    expect(styles).toContain('.invoice-batch-collapsed-match');
  });

  it('keeps five match cards adaptive on desktop and supports creator-only line items', () => {
    const source = readFileSync(new URL('./InvoiceBatchBuilderPage.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./InvoiceBatchBuilderPage.css', import.meta.url), 'utf8');
    const tableSource = source.match(/function BatchRowTable\([\s\S]*?export function InvoiceBatchBuilderPage/)?.[0] ?? '';

    expect(tableSource).toContain('invoiceBatchLineItemScope(item)');
    expect(tableSource).toContain('className="invoice-batch-add-creator-line"');
    expect(tableSource).toContain('addInvoiceBatchCreatorLineItem(row.items)');
    expect(tableSource).toContain('removeInvoiceBatchCreatorLineItem(row.items, item.id)');
    expect(tableSource).toContain('个人明细');
    expect(tableSource).toContain('disabled={rowLocked}');
    expect(styles).toContain('@media (min-width: 1181px)');
    expect(styles).toMatch(/\.invoice-batch-match-reason-row \.invoice-contract-match-grid\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*nowrap;/);
    expect(styles).toMatch(/article\[data-state="MATCH"\][\s\S]*?flex:\s*0\.72 1 126px;/);
    expect(styles).toMatch(/article\[data-state="REASON_REQUIRED"\][\s\S]*?flex:\s*1\.35 1 196px;/);
    expect(styles).toMatch(/article\.has-account-difference\s*\{[\s\S]*?flex:\s*1\.9 1 300px;/);
    expect(styles).toMatch(/@media \(max-width: 1180px\)[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
  });

  it('moves Excel import into the bulk-input footer and previews matches in the creator archive', () => {
    const source = readFileSync(new URL('./InvoiceBatchBuilderPage.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./InvoiceBatchBuilderPage.css', import.meta.url), 'utf8');
    const toolbarStart = source.indexOf('className="invoice-batch-creator-import-actions"');
    const toolbarEnd = source.indexOf('{creatorImportReview && creatorSelectionPreview', toolbarStart);
    const modalStart = source.indexOf('title="批量输入达人"');
    const modalEnd = source.indexOf('{forceDescriptionKey ?', modalStart);
    const toolbarSource = source.slice(toolbarStart, toolbarEnd);
    const modalSource = source.slice(modalStart, modalEnd);

    expect(toolbarSource).toContain('下载 Excel 模板');
    expect(toolbarSource).not.toContain("'导入 Excel'");
    expect(modalSource.indexOf('导入 Excel')).toBeLessThan(modalSource.indexOf('解析并预览'));
    expect(source).toContain('className="invoice-batch-creator-grid invoice-batch-import-preview-grid"');
    expect(source).toContain('达人档案 · 导入预览');
    expect(source).toContain('频道 ID/Handle、完整频道链接和 Display Name');
    expect(source).toContain("placeholder={'例如：\\nMinaKato\\nhttps://www.youtube.com/@MinaKato'}");
    expect(styles).toMatch(/\.invoice-batch-creator\.is-selected,[\s\S]*?background:\s*#f6fbf8;/);
    expect(styles).toMatch(/\.invoice-batch-creator \.avatar-sm\s*\{[\s\S]*?width:\s*38px;/);
    expect(styles).toMatch(/\.invoice-batch-creator > \.creator-identity\s*\{[\s\S]*?grid-template-columns:\s*38px minmax\(0, 1fr\);/);
    expect(styles).toMatch(/\.invoice-batch-creator \.creator-social-accounts\.is-expanded-view\s*\{[\s\S]*?flex-wrap:\s*nowrap;/);
    expect(source).not.toContain('可继续生成');
    expect(source).not.toContain('默认空中云汇');
  });

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
    expect(html).toContain('aria-label="批量 Invoice Bill To 开票主体"');
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
