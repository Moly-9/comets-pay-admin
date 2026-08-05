import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createInvoiceBatchArchive } from './invoiceBatchArchive';

describe('Invoice batch ZIP', () => {
  it('places only supplied successful files into PDF and DOCX folders', async () => {
    const blob = await createInvoiceBatchArchive([{
      pdfFilename: 'INV-001-Creator.pdf',
      docxFilename: 'INV-001-Creator.docx',
      pdfBlob: new Blob(['pdf']),
      docxBlob: new Blob(['docx']),
    }]);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    expect(Object.keys(zip.files).sort()).toEqual([
      'DOCX/',
      'DOCX/INV-001-Creator.docx',
      'PDF/',
      'PDF/INV-001-Creator.pdf',
    ]);
    expect(await zip.file('PDF/INV-001-Creator.pdf')?.async('string')).toBe('pdf');
    expect(await zip.file('DOCX/INV-001-Creator.docx')?.async('string')).toBe('docx');
  });
});
