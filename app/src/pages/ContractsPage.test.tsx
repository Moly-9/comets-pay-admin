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
});
