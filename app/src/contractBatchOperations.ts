import type { ContractRecord } from './contracts';

export type ContractExportFailure = {
  contractCode: string;
  fileName: string;
};

export type ContractExportArchive = {
  blob: Blob;
  documentCount: number;
  failures: ContractExportFailure[];
};

type ContractExportDocument = {
  fileName: string;
  documentUrl: string;
};

export const contractSelectionId = (contract: ContractRecord) => (
  contract.contractId ?? contract.id
);

export const selectedContracts = (
  contracts: ContractRecord[],
  selectedIds: ReadonlySet<string>,
) => contracts.filter((contract) => selectedIds.has(contractSelectionId(contract)));

export const toggleVisibleContractSelection = (
  current: ReadonlySet<string>,
  visibleContracts: ContractRecord[],
) => {
  const next = new Set(current);
  const visibleIds = visibleContracts.map(contractSelectionId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id));
  visibleIds.forEach((id) => {
    if (allVisibleSelected) next.delete(id);
    else next.add(id);
  });
  return next;
};

export const removeSelectedContracts = (
  contracts: ContractRecord[],
  selectedIds: ReadonlySet<string>,
) => contracts.filter((contract) => !selectedIds.has(contractSelectionId(contract)));

const csvCell = (value: string | number | null | undefined) => (
  `"${String(value ?? '').replace(/"/g, '""')}"`
);

const contractManifest = (contracts: ContractRecord[]) => {
  const header = [
    'Contract ID',
    'Contract Code',
    'IO Number',
    'Contract Name',
    'Publisher',
    'Project',
    'Brand',
    'Currency',
    'Total Fee',
    'Status',
    'Updated Date',
  ];
  const rows = contracts.map((contract) => [
    contractSelectionId(contract),
    contract.id,
    contract.ioId,
    contract.name,
    contract.publisher,
    contract.project,
    contract.brand,
    contract.currency,
    contract.totalFee,
    contract.status,
    contract.updated,
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
};

const safeFileSegment = (value: string, fallback: string) => (
  value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 96) || fallback
);

const contractDocuments = (contract: ContractRecord): ContractExportDocument[] => {
  const sourceDocuments = (contract.sourceDocuments ?? [])
    .filter((document) => Boolean(document.documentUrl))
    .map((document) => ({
      fileName: document.fileName,
      documentUrl: document.documentUrl,
    }));
  if (sourceDocuments.length) return sourceDocuments;
  if (!contract.documentUrl) return [];
  return [{
    fileName: contract.sourceName || `${contract.id}.pdf`,
    documentUrl: contract.documentUrl,
  }];
};

const fetchContractDocument = async (documentUrl: string) => {
  const response = await fetch(documentUrl);
  if (!response.ok) throw new Error(`Unable to read contract document: ${response.status}`);
  return response.blob();
};

export const createContractExportArchive = async (
  contracts: ContractRecord[],
  loadDocument: (documentUrl: string) => Promise<Blob> = fetchContractDocument,
): Promise<ContractExportArchive> => {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const failures: ContractExportFailure[] = [];
  let documentCount = 0;

  zip.file('contracts.csv', contractManifest(contracts));
  await Promise.all(contracts.map(async (contract) => {
    const folderName = safeFileSegment(`${contract.id} ${contract.name}`, contract.id);
    const folder = zip.folder(`contracts/${folderName}`);
    const usedNames = new Set<string>();
    const documents = contractDocuments(contract);
    if (!documents.length) {
      failures.push({
        contractCode: contract.id,
        fileName: contract.sourceName || 'Source document unavailable',
      });
      return;
    }
    await Promise.all(documents.map(async (document, index) => {
      const rawName = safeFileSegment(document.fileName, `${contract.id}-${index + 1}.pdf`);
      const duplicateIndex = usedNames.has(rawName) ? index + 1 : 0;
      const dotIndex = rawName.lastIndexOf('.');
      const fileName = duplicateIndex > 0
        ? `${dotIndex > 0 ? rawName.slice(0, dotIndex) : rawName}-${duplicateIndex}${dotIndex > 0 ? rawName.slice(dotIndex) : ''}`
        : rawName;
      usedNames.add(fileName);
      try {
        const blob = await loadDocument(document.documentUrl);
        folder?.file(fileName, new Uint8Array(await blob.arrayBuffer()));
        documentCount += 1;
      } catch {
        failures.push({ contractCode: contract.id, fileName: document.fileName });
      }
    }));
  }));

  if (failures.length) {
    zip.file(
      'unavailable-files.csv',
      `\uFEFF${['Contract Code,File Name', ...failures.map((item) => `${csvCell(item.contractCode)},${csvCell(item.fileName)}`)].join('\r\n')}`,
    );
  }

  return {
    blob: await zip.generateAsync({ type: 'blob' }),
    documentCount,
    failures,
  };
};

export const contractExportArchiveFilename = (now = new Date()) => {
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  return `COMETS-Pay-contracts-${localDate}.zip`;
};
