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
    expect(html).toContain('aria-label="全选当前列表合同"');
    expect(html).toContain('aria-label="选择合同 CON-260724-KOL-01"');
    expect(html).toContain('data-testid="contract-bulk-export"');
    expect(html).not.toContain('data-testid="contract-bulk-delete"');
  });

  it('shows the list-level delete action only when the role can delete contracts', () => {
    const html = renderContractsPage(true);
    expect(html).toContain('data-testid="contract-bulk-delete"');
    expect(html).not.toContain('请选择合同');
    expect(html).not.toContain('contract-selection-count');
  });
});
