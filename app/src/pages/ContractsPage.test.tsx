import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_CONTRACTS, type ContractRecord } from '../contracts';
import { ContractsPage } from './ContractsPage';

const renderContractsPage = (
  canDelete: boolean,
  contracts: ContractRecord[] = INITIAL_CONTRACTS.slice(0, 2),
) => renderToStaticMarkup(
  <ContractsPage
    contracts={contracts}
    projects={[]}
    creators={[]}
    canUpload={false}
    canDelete={canDelete}
    canDeleteContract={() => canDelete}
    focusedContractId={null}
    onFocusCleared={vi.fn()}
    onUploadContract={vi.fn()}
    onUpdateContract={vi.fn()}
    onDeleteContracts={vi.fn(() => 0)}
    notify={vi.fn()}
  />,
);

describe('ContractsPage batch actions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T04:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows stable-ID selection and export to every contract viewer', () => {
    const html = renderContractsPage(false);
    const exportButton = html.match(/<button[^>]*data-testid="contract-bulk-export"[^>]*>/)?.[0];
    expect(html).toContain('class="contract-filter-bar"><div class="tabs-row contract-filter-tabs" role="tablist" aria-label="合同筛选"');
    expect(html).toContain('role="tab" aria-selected="true">全部<span>1</span>');
    expect(html).toContain('role="tab" aria-selected="false">可付款<span>');
    expect(html).toContain('role="tab" aria-selected="false">待处理<span>');
    expect(html).toContain('role="tab" aria-selected="false">草稿箱<span>0</span>');
    expect(html).toContain('role="tab" aria-selected="false">待上传<span>0</span>');
    expect(html).toContain('role="tab" aria-selected="false">待签署<span>0</span>');
    expect(html).toContain('role="tab" aria-selected="false">已到期<span>0</span>');
    expect(html).not.toContain('role="tab" aria-selected="false">模板<span>');
    expect(html).toContain('aria-label="全选当前列表合同"');
    expect(html).toContain('aria-label="选择合同 CON-260724-KOL-01"');
    expect(html).toContain('data-testid="contract-bulk-export"');
    expect(exportButton).toBeDefined();
    expect(exportButton).not.toContain('disabled');
    expect(html).not.toContain('data-testid="contract-bulk-delete"');
  });

  it('counts ready, upload, signature, and expired contracts without changing the all-tab count', () => {
    const base = INITIAL_CONTRACTS.find((contract) => !contract.isTemplate)!;
    const template = INITIAL_CONTRACTS.find((contract) => contract.isTemplate)!;
    const html = renderContractsPage(false, [
      { ...base, contractId: undefined, id: 'CON-READY', lifecycle: 'CONFIRMED', campaignEnd: '2026-12-31' },
      { ...base, contractId: undefined, id: 'CON-UPLOAD', lifecycle: 'GENERATED_DRAFT', campaignEnd: '2026-12-31' },
      { ...base, contractId: undefined, id: 'CON-SIGNATURE', lifecycle: 'SENT_FOR_SIGNATURE', signed: false, campaignEnd: '2026-12-31' },
      { ...base, contractId: undefined, id: 'CON-EXPIRED', lifecycle: 'CONFIRMED', campaignEnd: '2026-01-01' },
      { ...base, contractId: undefined, id: 'CON-ATTENTION', lifecycle: 'RECOGNITION_CONFIRMED', signed: false, campaignEnd: '2026-12-31' },
      { ...base, contractId: undefined, id: 'CON-DRAFT', lifecycle: 'EDITING_DRAFT', campaignEnd: '2026-12-31' },
      template,
    ]);

    expect(html).toContain('<span>合同总数</span><strong>4</strong><small>不含合同模板、待处理与草稿</small>');
    expect(html).toContain('role="tab" aria-selected="true">全部<span>6</span>');
  });

  it('disables new contract generation with an explicit reason when no active usable template exists', () => {
    const html = renderToStaticMarkup(
      <ContractsPage
        contracts={INITIAL_CONTRACTS.slice(0, 2)}
        projects={[]}
        creators={[]}
        canUpload
        canDelete={false}
        canDeleteContract={() => false}
        focusedContractId={null}
        onFocusCleared={vi.fn()}
        onCreateContract={vi.fn()}
        createContractDisabledReason="合同模板已停用，请先在系统配置中启动模板。"
        onUploadContract={vi.fn()}
        onUpdateContract={vi.fn()}
        onDeleteContracts={vi.fn(() => 0)}
        notify={vi.fn()}
      />,
    );

    expect(html).toContain('>生成合同</span>');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('data-disabled-reason="合同模板已停用，请先在系统配置中启动模板。"');
  });

  it('restores a contract by stable id and forwards scoped edit permission', () => {
    const source = readFileSync(new URL('./ContractsPage.tsx', import.meta.url), 'utf8');

    expect(source).toContain("String(contract.contractId ?? '') === selectedContractId");
    expect(source).toContain('canEdit={canEditContract?.(selectedContract) ?? true}');
  });

  it('shows the list-level delete action only when the role can delete contracts', () => {
    const html = renderContractsPage(true);
    const deleteButton = html.match(/<button[^>]*data-testid="contract-bulk-delete"[^>]*>/)?.[0];
    expect(html).toContain('data-testid="contract-bulk-delete"');
    expect(deleteButton).toBeDefined();
    expect(deleteButton).not.toContain('disabled');
    expect(html).not.toContain('请选择合同');
    expect(html).not.toContain('contract-selection-count');
  });

  it('replaces the business update column with validity and moves templates out of contract management', () => {
    const html = renderContractsPage(false);
    const source = readFileSync(new URL('./ContractsPage.tsx', import.meta.url), 'utf8');
    const configurationSource = readFileSync(new URL('./SystemConfigurationPage.tsx', import.meta.url), 'utf8');

    expect(html).toContain('<th>合同金额</th><th>到期时间</th><th>付款就绪度</th>');
    expect(html).not.toContain('<th class="contract-date-cell">更新日期</th>');
    expect(source).not.toContain('<th className="contract-date-cell">更新日期</th>');
    expect(configurationSource).toContain('<th className="contract-date-cell">更新日期</th>');
    expect(html).toContain('role="combobox" aria-label="筛选关联项目"');
    expect(html).toContain('<span>全部关联项目</span>');
    expect(html).toContain('class="contract-toolbar-field-label">关联项目</span>');
    expect(source).toContain('aria-label="搜索关联项目"');
    expect(source).toContain('className="contract-project-filter-radio"');
    expect(html).toContain('role="combobox" aria-label="筛选合同有效期"');
    expect(html).toContain('全部有效期');
    expect(source).toContain('matchesQuery && matchesFilter && matchesProject && matchesValidity');
    expect(source).toContain('${projectFilter}\\u0000${validityFilter}');
    expect(html).toContain('即将到期 · 7天');
  });

  it('keeps contract tabs horizontally scrollable without showing a scrollbar rail', () => {
    const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

    expect(styles).toMatch(/\.contract-filter-tabs\s*{[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*hidden;[^}]*scrollbar-width:\s*none;/s);
    expect(styles).toMatch(/\.contract-filter-tabs::\-webkit-scrollbar\s*{[^}]*display:\s*none;/s);
  });

  it('marks an expired contract as invalid for payment', () => {
    const expired = {
      ...INITIAL_CONTRACTS[0],
      campaignEnd: '2026-08-23',
      isLongTerm: false,
    };
    const html = renderContractsPage(false, [expired]);

    expect(html).toContain('2026-08-23');
    expect(html).toContain('已到期 · 1天');
    expect(html).toContain('contract-readiness contract-readiness-expired');
    expect(html).toContain('已失效');
    expect(html).toContain('role="tab" aria-selected="false">可付款<span>0</span>');
    expect(html).toContain('role="tab" aria-selected="false">待处理<span>0</span>');
    expect(html).toContain('role="tab" aria-selected="false">已到期<span>1</span>');
  });

  it('shows a complete-name tooltip and one type-specific number in the contract name cell', () => {
    const independent = {
      ...INITIAL_CONTRACTS[0],
      id: 'CON-INDEPENDENT-001',
      ioId: 'IO-SHOULD-NOT-SHOW-001',
      name: '这是一个用于验证单行省略与悬停完整展示的很长独立合同名称',
      contractType: 'INDEPENDENT' as const,
    };
    const framework = {
      ...INITIAL_CONTRACTS[0],
      id: 'CON-FRAMEWORK-001',
      ioId: 'IO-SHOULD-NOT-SHOW-002',
      name: '年度框架合作合同',
      contractType: 'FRAMEWORK' as const,
    };
    const io = {
      ...INITIAL_CONTRACTS[0],
      id: 'CON-SHOULD-NOT-SHOW-IN-META',
      ioId: 'IO-20260829-001',
      name: '八月内容合作 IO 单',
      contractType: 'IO' as const,
      frameworkContractId: 'contract-framework-source' as ContractRecord['frameworkContractId'],
    };
    const html = renderContractsPage(false, [independent, framework, io]);
    const nameCells = [...html.matchAll(/<button class="contract-name-link"[\s\S]*?<\/button>/g)].map(([cell]) => cell);

    expect(nameCells).toHaveLength(3);
    expect(nameCells[0]).toContain(`title="${independent.name}"`);
    expect(nameCells[0]).toContain('<span class="contract-name-meta"><span class="contract-type-badge contract-type-independent">独立合同</span><small>CON-INDEPENDENT-001</small></span>');
    expect(nameCells[0]).not.toContain('IO-SHOULD-NOT-SHOW-001');
    expect(nameCells[1]).toContain('<span class="contract-name-meta"><span class="contract-type-badge contract-type-framework">框架合同</span><small>CON-FRAMEWORK-001</small></span>');
    expect(nameCells[1]).not.toContain('IO-SHOULD-NOT-SHOW-002');
    expect(nameCells[2]).toContain('<span class="contract-name-meta"><span class="contract-type-badge contract-type-io">IO 单</span><small>IO-20260829-001</small></span>');
    expect(nameCells[2]).not.toContain('CON-SHOULD-NOT-SHOW-IN-META');
    expect(nameCells[2]).not.toContain('contract-framework-source');
    expect(nameCells[2]).not.toContain('框架合同：');
  });
});
