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
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { describe, expect, it } from 'vitest';
import { parseDocx, parsePdf } from './contractParser.worker';
import { recognitionFieldDisplayValue, recognizeUploadContractFields } from './contractRecognition';

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
    expect(result.documentType).toBe('IO');
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

    const recognition = recognizeUploadContractFields(
      [{ ...result, contractType: 'IO' }],
      { systemContractNumber: 'CON-SYSTEM-DOCX' },
    );
    expect(recognition.find((field) => field.fieldKey === 'advertiser')?.rawValue).toBe('Comets International Limited');
    expect(recognition.find((field) => field.fieldKey === 'ioNumber')?.rawValue).toBe('IO-2026-0088');
    expect(recognition[recognition.length - 1]).toMatchObject({
      fieldKey: 'contractNumber',
      rawValue: 'CON-SYSTEM-DOCX',
      readOnly: true,
    });
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
  it('feeds extracted PDF text into the upload recognition field catalog', async () => {
    GlobalWorkerOptions.workerSrc = new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([595, 842]);
    [
      'Advertiser: COMETS INTERNATIONAL LIMITED',
      'Publisher: Mina Kato',
      'Contract Amount: USD 1200',
      'Signature Status: Signed',
      'Campaign End: September 30, 2026',
      'Transfer Fee: borne by Advertiser',
      'Publishing Platform: Instagram',
      'Channel Link: https://instagram.com/mina.example',
      'PayPal Email Address: mina@example.com',
    ].forEach((text, index) => page.drawText(text, { x: 52, y: 780 - index * 28, size: 11, font }));
    const bytes = await pdf.save();
    const result = await parsePdf(
      'recognition-pdf',
      'recognition.pdf',
      'application/pdf',
      'STANDARD_TERMS',
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    );
    const recognition = recognizeUploadContractFields(
      [{ ...result, contractType: 'INDEPENDENT' }],
      { systemContractNumber: 'CON-SYSTEM-PDF' },
    );

    expect(result.parseStatus).toBe('parsed');
    expect(recognition.find((field) => field.fieldKey === 'publisher')?.rawValue).toBe('Mina Kato');
    expect(recognitionFieldDisplayValue(recognition.find((field) => field.fieldKey === 'signatureStatus')!)).toBe('已签署');
    expect(recognitionFieldDisplayValue(recognition.find((field) => field.fieldKey === 'contractExpiry')!)).toBe('2026-09-30');
    expect(recognition.filter((field) => field.group === 'paypal').map((field) => field.fieldKey)).toEqual([
      'paypalUsername',
      'paypalEmail',
      'transferNote',
    ]);
  });

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
