import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  contractRequestResourceTitle,
  invoiceRequestResourceTitle,
  positionRequestResourcePreview,
  sortRequestResourcePickerOptions,
} from './MediaPaymentProjectsPage';

describe('new payment request resource picker', () => {
  it('uses the concise my-request page title', () => {
    const source = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');
    expect(source).toContain('title="我的请款"');
    expect(source).not.toContain('title="我的请款项目"');
  });

  it('shows selectable and selected resources before disabled resources', () => {
    const options = [
      { value: 'disabled-one', label: '置灰 1', description: '', selected: false, disabled: true },
      { value: 'available-one', label: '可选 1', description: '', selected: false },
      { value: 'selected-one', label: '已选 1', description: '', selected: true, disabled: true },
      { value: 'disabled-two', label: '置灰 2', description: '', selected: false, disabled: true },
      { value: 'available-two', label: '可选 2', description: '', selected: false, disabled: false },
    ];

    expect(sortRequestResourcePickerOptions(options).map((option) => option.value)).toEqual([
      'available-one',
      'selected-one',
      'available-two',
      'disabled-one',
      'disabled-two',
    ]);
  });

  it('keeps the creator search icon and input on one horizontal row', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    const searchStyles = css.slice(
      css.indexOf('.creator-picker-search {'),
      css.indexOf('.creator-picker-result-count {'),
    );

    expect(searchStyles).toContain('grid-template-columns: auto minmax(0, 1fr)');
    expect(searchStyles).toContain('align-items: center');
    expect(searchStyles).toContain('height: 40px');
    expect(searchStyles).toContain('line-height: 40px');
    expect(searchStyles).toContain('white-space: nowrap');
  });

  it('uses compact selected creators and a two-column document identity layout', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    const source = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');

    expect(source).toContain('<CreatorIdentity creator={creator} showSocialAccounts={false} />');
    expect(source).toContain('<div className="media-request-document-creator"><CreatorIdentity creator={creator} /></div>');
    expect(css).toMatch(/\.media-request-document-creator > \.creator-identity\s*\{[^}]*grid-template-columns: auto minmax\(0, 1fr\);/s);
    expect(css).toMatch(/\.media-request-document-creator \.creator-identity-copy\s*\{[^}]*display: grid;[^}]*gap: 3px;/s);
  });

  it('formats Invoice and contract titles with explicit fallbacks', () => {
    expect(invoiceRequestResourceTitle({
      id: 'INV-20260826-00001',
      snapshot: { projectName: 'Creator Launch' },
    })).toBe('INV-20260826-00001 · Creator Launch');
    expect(invoiceRequestResourceTitle({
      id: 'INV-20260826-00002',
      snapshot: { projectName: '' },
    }, 'Fallback Project')).toBe('INV-20260826-00002 · Fallback Project');
    expect(invoiceRequestResourceTitle({
      id: 'INV-20260826-00003',
      snapshot: { projectName: '' },
    })).toBe('INV-20260826-00003 · 未关联项目');
    expect(contractRequestResourceTitle({ name: '  Mina Campaign Agreement  ' })).toBe('Mina Campaign Agreement');
    expect(contractRequestResourceTitle({ name: '' })).toBe('未命名合同');
  });

  it('places the document preview to the right and flips it inside the viewport', () => {
    expect(positionRequestResourcePreview(
      { top: 80, right: 280, bottom: 130, left: 80 },
      { width: 1000, height: 800 },
    )).toEqual({ left: 292, top: 80 });
    expect(positionRequestResourcePreview(
      { top: 700, right: 980, bottom: 750, left: 700 },
      { width: 1000, height: 800 },
    )).toEqual({ left: 344, top: 358 });
  });

  it('separates document viewing from selection and keeps disabled rows viewable', () => {
    const source = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');
    const pickerSource = source.slice(
      source.indexOf('function RequestResourcePicker({'),
      source.indexOf('function RequestResourceDocumentContent({'),
    );

    expect(pickerSource).toContain('className="invoice-option-view"');
    expect(pickerSource).toContain('onOpenDocument(option.resource)');
    expect(pickerSource).toContain('className="invoice-option-select"');
    expect(pickerSource).toContain('disabled={selectionDisabled}');
    expect(pickerSource).not.toContain('disabled={option.disabled && !option.selected}');
  });

  it('keeps resource titles and status lines on one line without exposing contract type', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    const source = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');
    const contractOptionsSource = source.slice(
      source.indexOf('const contractOptions ='),
      source.indexOf('return (', source.indexOf('const contractOptions =')),
    );

    expect(css).toMatch(/\.invoice-option-copy strong \{[\s\S]*?overflow: hidden;[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap;/);
    expect(css).toMatch(/\.invoice-option-copy small \{[\s\S]*?overflow: hidden;[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap;/);
    expect(css).toContain('.request-resource-preview');
    expect(contractOptionsSource).toContain('label: contractRequestResourceTitle(contract)');
    expect(contractOptionsSource).not.toContain('CONTRACT_TYPE_LABELS');
    expect(contractOptionsSource).not.toContain('contract.id');
  });

  it('simplifies the creator table and adds the actual paid amount after request amount', () => {
    const source = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');
    const tableSource = source.slice(
      source.indexOf('<table className="data-table project-creator-table media-request-creator-table">'),
      source.indexOf('</table>', source.indexOf('<table className="data-table project-creator-table media-request-creator-table">')),
    );
    const headingSource = tableSource.slice(tableSource.indexOf('<thead>'), tableSource.indexOf('</thead>'));

    expect(headingSource).toContain('Invoice 金额');
    expect(headingSource).toContain('请款金额');
    expect(headingSource).toContain('实际付款金额');
    expect(headingSource.indexOf('请款金额')).toBeLessThan(headingSource.indexOf('实际付款金额'));
    expect(headingSource).not.toContain('<th>Invoice</th>');
    expect(headingSource).not.toContain('<th>合同</th>');
    expect(tableSource).not.toContain('invoice.invoiceNumber');
    expect(tableSource).not.toContain('contract.contractNumber');
    expect(tableSource).not.toContain('付款清单${');
    expect(tableSource).toContain('actualPayoutAmountLabel(payout)');
    expect(tableSource).toContain('socialAccountsMaxVisible={1}');
  });

  it('keeps compact creator identities aligned and the longer progress card scrollable', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

    expect(css).toMatch(/\.media-request-creator-cell > span\s*{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\);/s);
    expect(css).toMatch(/\.media-request-creator-cell \.creator-identity-copy\s*{[^}]*display:\s*grid;/s);
    expect(css).toMatch(/\.project-progress-card\s*{[^}]*max-height:\s*calc\(100vh - 118px\);[^}]*overflow-y:\s*auto;/s);
    expect(css).toContain('.progress-returned .project-progress-node');
  });

  it('opens project detail from the full project row without hijacking row actions', () => {
    const source = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('./MediaPaymentProjectsPage.css', import.meta.url), 'utf8');
    const listTableSource = source.slice(
      source.indexOf('<table className="data-table operational-table media-payment-project-table">'),
      source.indexOf('</table>', source.indexOf('<table className="data-table operational-table media-payment-project-table">')),
    );

    expect(listTableSource).toContain('className={`media-payment-project-row');
    expect(listTableSource).toContain('role="link"');
    expect(listTableSource).toContain('tabIndex={0}');
    expect(listTableSource).toContain('onClick={() => openRequestDetail(request)}');
    expect(listTableSource).toContain("['Enter', ' '].includes(event.key)");
    expect(listTableSource).toContain('onClick={(event) => event.stopPropagation()}');
    expect(css).toContain('tr.media-payment-project-row:hover');
    expect(css).toContain('tr.media-payment-project-row:focus-visible');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
