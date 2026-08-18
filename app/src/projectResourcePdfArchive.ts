export type ProjectPdfArchiveEntry = {
  filename: string;
  pdfBlob: Blob;
};

export type ProjectPdfArchiveKind = 'contract' | 'invoice';

const safeFileSegment = (value: string, fallback: string) => (
  value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 120) || fallback
);

const pdfFilename = (value: string, fallback: string) => {
  const safeName = safeFileSegment(value, fallback).replace(/\.[^.]+$/, '');
  return `${safeName || fallback}.pdf`;
};

const uniqueFilename = (filename: string, usedNames: Set<string>) => {
  if (!usedNames.has(filename)) {
    usedNames.add(filename);
    return filename;
  }
  const baseName = filename.replace(/\.pdf$/i, '');
  let sequence = 2;
  while (usedNames.has(`${baseName}-${sequence}.pdf`)) sequence += 1;
  const nextName = `${baseName}-${sequence}.pdf`;
  usedNames.add(nextName);
  return nextName;
};

export const createFlatProjectPdfArchive = async (entries: ProjectPdfArchiveEntry[]) => {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const usedNames = new Set<string>();

  await Promise.all(entries.map(async (entry, index) => {
    const filename = uniqueFilename(
      pdfFilename(entry.filename, `document-${index + 1}`),
      usedNames,
    );
    zip.file(filename, new Uint8Array(await entry.pdfBlob.arrayBuffer()));
  }));

  return zip.generateAsync({ type: 'blob' });
};

export const projectPdfArchiveFilename = (
  requestCode: string,
  kind: ProjectPdfArchiveKind,
) => {
  const safeRequestCode = safeFileSegment(requestCode, '请款项目');
  return `${safeRequestCode}-${kind === 'contract' ? '合同' : 'Invoice'}汇总.zip`;
};
