import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_CONTRACTS } from '../contracts';
import { ContractsPage } from './ContractsPage';

const renderContractsPage = (canDelete: boolean) => renderToStaticMarkup(
  <ContractsPage
    contracts={INITIAL_CONTRACTS.slice(0, 2)}
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
  it('shows stable-ID selection and export to every contract viewer', () => {
    const html = renderContractsPage(false);
    const exportButton = html.match(/<button[^>]*data-testid="contract-bulk-export"[^>]*>/)?.[0];
    expect(html).toContain('class="tabs-row contract-filter-tabs" role="tablist" aria-label="合同筛选"');
    expect(html).toContain('role="tab" aria-selected="true">全部<span>1</span>');
    expect(html).toContain('role="tab" aria-selected="false">可付款<span>');
    expect(html).toContain('role="tab" aria-selected="false">待处理<span>');
    expect(html).toContain('role="tab" aria-selected="false">模板<span>1</span>');
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
});
