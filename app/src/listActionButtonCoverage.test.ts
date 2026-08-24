import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const tableSources = [
  './components/InvoiceManagementTable.tsx',
  './components/PayoutTable.tsx',
  './components/TransactionRecordsTable.tsx',
  './pages/ContractsPage.tsx',
  './pages/MediaPaymentProjectsPage.tsx',
  './pages/OperationalPages.tsx',
  './pages/PaymentWorkbenchPage.tsx',
  './pages/SystemSettingsPage.tsx',
].map(source);

describe('list action button coverage', () => {
  it('removes legacy unadorned table action buttons from business tables', () => {
    tableSources.forEach((fileSource) => {
      expect(fileSource).not.toContain('className="table-action"');
      expect(fileSource).not.toMatch(/<td className="action-cell">[\s\S]{0,240}className="text-link"/);
    });
  });

  it('covers representative view, review, execute, danger, download and manage actions', () => {
    const operational = source('./pages/OperationalPages.tsx');
    const workbench = source('./pages/PaymentWorkbenchPage.tsx');
    const media = source('./pages/MediaPaymentProjectsPage.tsx');
    const settings = source('./pages/SystemSettingsPage.tsx');

    expect(operational).toContain('<ListActionButton kind="view"');
    expect(workbench).toContain("if (label === '审核') return 'review'");
    expect(workbench).toContain("if (label === '执行打款') return 'execute'");
    expect(workbench).toContain("if (label.includes('失败')) return 'danger'");
    expect(media).toContain('<ListActionButton\n                              kind="download"');
    expect(media).toContain('loading={isExporting}');
    expect(settings).toContain('<ListActionButton kind="manage"');
  });

  it('uses the shared component in card-style project resource lists', () => {
    const projectResources = source('./components/ProjectResourceManager.tsx');
    const requestResources = source('./components/RequestProjectResourceManager.tsx');

    expect(projectResources).toContain('kind="retry"');
    expect(projectResources).toContain('kind="danger"');
    expect(requestResources).toContain('project-resource-summary-open" kind="view"');
    expect(requestResources).toContain('kind="edit"');
    expect(requestResources).toContain('kind="danger"');
  });
});
