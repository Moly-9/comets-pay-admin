import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  createFlatProjectPdfArchive,
  projectPdfArchiveFilename,
} from './projectResourcePdfArchive';

describe('project resource PDF archives', () => {
  it('places every PDF directly in the ZIP root without nested folders', async () => {
    const entries = Array.from({ length: 17 }, (_, index) => ({
      filename: index < 2 ? '重复合同.pdf' : `CON-${String(index + 1).padStart(3, '0')}.pdf`,
      pdfBlob: new Blob([`PDF ${index + 1}`], { type: 'application/pdf' }),
    }));

    const archiveBlob = await createFlatProjectPdfArchive(entries);
    const archive = await JSZip.loadAsync(await archiveBlob.arrayBuffer());
    const files = Object.values(archive.files);

    expect(files).toHaveLength(17);
    expect(files.every((file) => !file.dir && !file.name.includes('/'))).toBe(true);
    expect(files.every((file) => file.name.endsWith('.pdf'))).toBe(true);
    expect(files.map((file) => file.name)).toContain('重复合同-2.pdf');
  });

  it('uses the request code and resource type in the archive filename', () => {
    expect(projectPdfArchiveFilename('PRJ-260801-01', 'contract'))
      .toBe('PRJ-260801-01-合同汇总.zip');
    expect(projectPdfArchiveFilename('PRJ-260801-01', 'invoice'))
      .toBe('PRJ-260801-01-Invoice汇总.zip');
  });
});
