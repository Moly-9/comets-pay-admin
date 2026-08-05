export type InvoiceBatchArchiveEntry = {
  pdfFilename: string;
  docxFilename: string;
  pdfBlob: Blob;
  docxBlob: Blob;
};

export const createInvoiceBatchArchive = async (
  entries: InvoiceBatchArchiveEntry[],
) => {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const pdfFolder = zip.folder('PDF');
  const docxFolder = zip.folder('DOCX');
  await Promise.all(entries.map(async (entry) => {
    const [pdf, docx] = await Promise.all([
      entry.pdfBlob.arrayBuffer(),
      entry.docxBlob.arrayBuffer(),
    ]);
    pdfFolder?.file(entry.pdfFilename, new Uint8Array(pdf));
    docxFolder?.file(entry.docxFilename, new Uint8Array(docx));
  }));
  return zip.generateAsync({ type: 'blob' });
};
