import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import type { ContractId } from './businessWorkflow';
import {
  contractSelectionId,
  createContractExportArchive,
  removeSelectedContracts,
  selectedContracts,
  toggleVisibleContractSelection,
} from './contractBatchOperations';
import { INITIAL_CONTRACTS, type ContractRecord } from './contracts';

const contract = (
  code: string,
  contractId: string,
  documentUrl = `memory://${contractId}`,
): ContractRecord => ({
  ...INITIAL_CONTRACTS[0],
  contractId: contractId as ContractId,
  id: code,
  name: `${code} Synthetic Contract`,
  sourceName: `${code}.pdf`,
  documentUrl,
  sourceDocuments: undefined,
});

describe('contract batch selection', () => {
  const first = contract('CON-TEST-001', 'contract-test-001');
  const second = contract('CON-TEST-002', 'contract-test-002');

  it('uses the stable contract ID and toggles only currently visible records', () => {
    expect(contractSelectionId(first)).toBe('contract-test-001');
    const selectedOnAnotherFilter = new Set([contractSelectionId(second)]);
    const selected = toggleVisibleContractSelection(selectedOnAnotherFilter, [first]);
    expect([...selected]).toEqual(['contract-test-002', 'contract-test-001']);
    expect([...toggleVisibleContractSelection(selected, [first])]).toEqual(['contract-test-002']);
  });

  it('keeps selection and deletion aligned to stable IDs', () => {
    const ids = new Set([contractSelectionId(second)]);
    expect(selectedContracts([first, second], ids)).toEqual([second]);
    expect(removeSelectedContracts([first, second], ids)).toEqual([first]);
  });
});

describe('contract batch export', () => {
  it('creates one ZIP with a manifest and the selected contract documents', async () => {
    const selected = [
      contract('CON-TEST-001', 'contract-test-001'),
      contract('CON-TEST-002', 'contract-test-002'),
    ];
    const loadDocument = vi.fn(async (url: string) => new Blob([`PDF ${url}`], { type: 'application/pdf' }));

    const result = await createContractExportArchive(selected, loadDocument);
    const archive = await JSZip.loadAsync(await result.blob.arrayBuffer());
    const files = Object.keys(archive.files);
    const manifest = await archive.file('contracts.csv')?.async('string');

    expect(result.documentCount).toBe(2);
    expect(result.failures).toEqual([]);
    expect(loadDocument).toHaveBeenCalledTimes(2);
    expect(files).toContain('contracts.csv');
    expect(files.some((file) => file.endsWith('/CON-TEST-001 Synthetic Contract-CON-TEST-001.pdf'))).toBe(true);
    expect(files.some((file) => file.endsWith('/CON-TEST-002 Synthetic Contract-CON-TEST-002.pdf'))).toBe(true);
    expect(manifest).toContain('contract-test-001');
    expect(manifest).toContain('CON-TEST-002');
  });

  it('still exports the manifest and a failure list when one source file is unavailable', async () => {
    const result = await createContractExportArchive(
      [contract('CON-TEST-003', 'contract-test-003')],
      async () => { throw new Error('Synthetic unavailable file'); },
    );
    const archive = await JSZip.loadAsync(await result.blob.arrayBuffer());

    expect(result.documentCount).toBe(0);
    expect(result.failures).toEqual([{ contractCode: 'CON-TEST-003', fileName: 'CON-TEST-003.pdf' }]);
    expect(archive.file('contracts.csv')).not.toBeNull();
    expect(archive.file('unavailable-files.csv')).not.toBeNull();
  });

  it('reports selected records that do not have an exportable source URL', async () => {
    const result = await createContractExportArchive([
      contract('CON-TEST-004', 'contract-test-004', ''),
    ]);

    expect(result.documentCount).toBe(0);
    expect(result.failures).toEqual([{ contractCode: 'CON-TEST-004', fileName: 'CON-TEST-004.pdf' }]);
  });
});
