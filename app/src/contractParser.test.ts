import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
} from 'docx';
import { readFile } from 'node:fs/promises';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { describe, expect, it } from 'vitest';
import { parseDocx, parsePdf } from './contractParser.worker';

describe('DOCX contract parser', () => {
  it('preserves headings, paragraphs, and cells from the same table row', async () => {
    const document = new Document({
      sections: [{
        children: [
          new Paragraph({ text: 'Campaign Details', heading: HeadingLevel.HEADING_1 }),
          new Paragraph('Advertiser: Comets International Limited'),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('IO Number')] }),
                  new TableCell({ children: [new Paragraph('IO-2026-0088')] }),
                ],
              }),
            ],
          }),
        ],
      }],
    });
    const buffer = await Packer.toBuffer(document);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    const result = await parseDocx(
      'docx-fixture',
      'campaign-io.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'IO',
      arrayBuffer,
    );

    expect(result.parseStatus).toBe('parsed');
    expect(result.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'heading',
        section: 'Campaign Details',
        text: 'Campaign Details',
      }),
      expect.objectContaining({
        section: 'Campaign Details',
        text: 'Advertiser: Comets International Limited',
      }),
      expect.objectContaining({
        kind: 'table-row',
        section: 'Campaign Details',
        text: 'IO Number | IO-2026-0088',
      }),
    ]));
  });

  it('rejects an invalid DOCX archive as corrupt', async () => {
    const invalid = new TextEncoder().encode('not a docx').buffer;
    const result = await parseDocx(
      'broken-docx',
      'broken.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'OTHER',
      invalid,
    );

    expect(result).toMatchObject({
      parseStatus: 'corrupt',
      blocks: [],
      errorMessage: 'DOCX 文件损坏、为空或不是标准 Open XML 文档',
    });
  });
});

describe('PDF contract parser', () => {
  it('extracts page-numbered text blocks from a text PDF', async () => {
    GlobalWorkerOptions.workerSrc = new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
    const buffer = await readFile(new URL('../public/contracts/26-kol-standard-terms-template.pdf', import.meta.url));
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    const result = await parsePdf(
      'pdf-fixture',
      'standard-terms.pdf',
      'application/pdf',
      'STANDARD_TERMS',
      arrayBuffer,
    );

    expect(result.parseStatus).toBe('parsed');
    expect(result.pageCount).toBeGreaterThan(1);
    expect(result.blocks.length).toBeGreaterThan(20);
    expect(result.blocks.every((block) => typeof block.pageNumber === 'number')).toBe(true);
  });

  it('rejects an invalid PDF as corrupt', async () => {
    const result = await parsePdf(
      'broken-pdf',
      'broken.pdf',
      'application/pdf',
      'OTHER',
      new TextEncoder().encode('not a pdf').buffer,
    );

    expect(result).toMatchObject({
      parseStatus: 'corrupt',
      blocks: [],
      errorMessage: 'PDF 文件损坏或格式不受支持',
    });
  });
});
