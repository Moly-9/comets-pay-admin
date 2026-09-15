import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  contractRequestResourceTitle,
  formatPaymentRequestSubmittedAt,
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

  it('only offers active cooperation projects to new payment requests', () => {
    const source = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');
    expect(source).toContain("(project.availability ?? 'ACTIVE') === 'ACTIVE'");
  });

  it('keeps my payment requests project-first before creator selection', () => {
    const source = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');
    const projectPicker = source.indexOf('ariaLabel="选择合作项目"');
    const creatorPicker = source.indexOf('<span>合作达人 <small className="request-optional-label">选填</small></span>');

    expect(projectPicker).toBeGreaterThan(-1);
    expect(creatorPicker).toBeGreaterThan(-1);
    expect(projectPicker).toBeLessThan(creatorPicker);
    expect(source).toContain("cooperationProjectId ? '可现在选择，也可创建请款后补充' : '请先选择关联项目'");
  });

  it('uses request terminology only in the my-request list and detail', () => {
    const source = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');

    expect(source).toContain('statusLabel="请款状态"');
    expect(source).toContain('<th>请款编号</th>');
    expect(source).toContain('<th>请款状态</th>');
    expect(source).toContain('title="请款信息"');
    expect(source).toContain('requestCodeLabel="请款编号"');
    expect(source).toContain('countLabel="个请款"');
    expect(source).toContain('<span>请款总数</span>');
    expect(source).not.toContain('请款项目总数');
    expect(source).not.toContain('返回我的请款项目');
  });

  it('adds the first request submission time beside the amount and enables date filtering', () => {
    const source = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('./MediaPaymentProjectsPage.css', import.meta.url), 'utf8');
    const tableSource = source.slice(
      source.indexOf('<table className="data-table operational-table media-payment-project-table">'),
      source.indexOf('</table>', source.indexOf('<table className="data-table operational-table media-payment-project-table">')),
    );
    const headingSource = tableSource.slice(tableSource.indexOf('<thead>'), tableSource.indexOf('</thead>'));

    expect(source).toContain('dateRangeLabel="请款时间"');
    expect(headingSource.indexOf('<th>请款金额</th>')).toBeLessThan(headingSource.indexOf('<th>请款时间</th>'));
    expect(headingSource.indexOf('<th>请款时间</th>')).toBeLessThan(headingSource.indexOf('<th>请款状态</th>'));
    expect(tableSource).toContain('paymentRequestFirstSubmittedAt(request)');
    expect(tableSource).toContain('<time dateTime={firstSubmittedAt}>');
    expect(tableSource).toContain('colSpan={9}');
    expect(css).toContain('min-width: 1200px');
    expect(css).toContain('.media-payment-project-table th:nth-child(9) { width: 9%; }');
    expect(formatPaymentRequestSubmittedAt('2026-08-07T16:00:00.000Z')).toBe('2026-08-08 00:00');
    expect(formatPaymentRequestSubmittedAt()).toBe('未提交');
  });

  it('requires payment ownership fields and uses a two-level procurement cost cascader', () => {
    const source = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');
    const cascaderSource = readFileSync(
      new URL('../components/PaymentRequestCostCascader.tsx', import.meta.url),
      'utf8',
    );
    const css = readFileSync(new URL('./MediaPaymentProjectsPage.css', import.meta.url), 'utf8');

    expect(source).toContain('ariaLabel="选择付款主体"');
    expect(source).toContain('ariaLabel="选择项目费用归属"');
    expect(source).toContain('日区项目请选择日本分公司');
    expect(source).toContain('<PaymentRequestCostCascader');
    expect(source).toContain('paymentEntity,');
    expect(source).toContain('projectCostAttribution,');
    expect(source).toContain("costTypeDetail: costType === '采购成本' ? costTypeDetail : undefined");
    expect(cascaderSource).toContain('PAYMENT_REQUEST_PROCUREMENT_COST_DETAILS.map');
    expect(cascaderSource).toContain("event.key === 'ArrowRight'");
    expect(cascaderSource).toContain("event.key === 'ArrowLeft'");
    expect(cascaderSource).toContain('aria-haspopup="tree"');
    expect(css).toContain('.payment-request-cost-cascader-menu.has-children');
    expect(css).toContain('@media (max-width: 559px)');
  });

  it('treats the project PM as optional and starts unassigned requests at the media owner', () => {
    const source = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');

    expect(source).toContain('项目 PM <small className="request-optional-label">选填</small>');
    expect(source).toContain("{ value: '', label: '不指定 PM', description: '将从媒介负责人审批开始' }");
    expect(source).toContain("const [pm, setPm] = useState('')");
    expect(source).toContain("setPm('')");
    expect(source).not.toContain("!pm ? '请选择项目 PM' : ''");
    expect(source).not.toMatch(/selectedProject\s*&&\s*pm\s*&&\s*paymentChannel/);
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
    expect(css).toContain('tr.media-payment-project-row:not(.media-request-returned-row):not(.media-request-payment-failure-row):hover');
    expect(css).toContain('tr.media-payment-project-row:focus-visible');
    expect(css).not.toMatch(/tr\.media-payment-project-row:hover\s*\{[^}]*outline:/s);
    expect(css).toMatch(/tr\.media-payment-project-row:focus-visible\s*\{[^}]*outline:/s);
    expect(css).toMatch(/\.media-payment-project-table :is\(th, td\):not\(\[colspan\]\)\s*\{[^}]*padding-right: 14px;[^}]*padding-left: 14px;/s);
    expect(css).toContain('.media-payment-project-table th:nth-child(2) { width: 20%; }');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('opens the dedicated three-method creator modal from both detail entry points', () => {
    const source = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');
    const modalSource = readFileSync(
      new URL('../components/PaymentRequestCreatorAddModal.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('<PaymentRequestCreatorAddModal');
    expect(source).toContain('onClick={() => setCreatorAddRequestId(selectedRequest.id)}>添加达人</button>');
    expect(source).toContain('点击使用链接、达人档案或 Excel 批量添加');
    expect(source).toContain('onApply={(selection) => openEditForm(selectedRequest, false, selection)}');
    expect(source).toContain('id="media-request-document-section"');
    expect(modalSource).toContain("{ value: 'LINKS', label: '粘贴链接'");
    expect(modalSource).toContain("{ value: 'ARCHIVE', label: '从达人档案库选择'");
    expect(modalSource).toContain("{ value: 'EXCEL', label: 'Excel 导入'");
    expect(modalSource).toContain('initialPageSize: 10');
    expect(modalSource).toContain('socialAccountsMaxVisible={1}');
    expect(modalSource).toContain('INVOICE_BATCH_CREATOR_IMPORT_MAX_FILE_SIZE');
  });

  it('keeps payment attribution and expected payment date controls horizontally aligned', () => {
    const css = readFileSync(new URL('./MediaPaymentProjectsPage.css', import.meta.url), 'utf8');

    expect(css).toMatch(/\.media-request-payment-plan \.form-field-label\s*\{[^}]*display: inline-flex;[^}]*min-height: 19px;[^}]*white-space: nowrap;/s);
    expect(css).toMatch(/\.media-request-payment-plan \.form-field\s*\{[^}]*align-content: start;/s);
    expect(css).toMatch(/\.media-request-payment-plan \.required-mark\s*\{[^}]*flex: 0 0 auto;/s);
  });
});
