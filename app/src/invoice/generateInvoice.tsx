import { pdf } from '@react-pdf/renderer';
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import type { InvoiceDocumentModel } from '../types';
import notoSansScDocxFont from '../assets/fonts/NotoSansSC-Regular.ttf?url';
import { InvoicePdfDocument } from './InvoicePdfDocument';
import { bankAddress, formatInvoiceDate, formatInvoiceMoney, invoiceTotal } from './invoiceUtils';

const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NONE_BORDER, bottom: NONE_BORDER, left: NONE_BORDER, right: NONE_BORDER, insideHorizontal: NONE_BORDER, insideVertical: NONE_BORDER };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 5, color: '555555' };
const TABLE_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER, insideHorizontal: THIN_BORDER, insideVertical: THIN_BORDER };
const DOCX_CJK_FONT = 'Noto Sans SC Embedded';
const DOCX_FONT = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: DOCX_CJK_FONT, cs: 'Times New Roman' };
const DOCX_CJK_RUN_FONT = { ascii: 'Microsoft YaHei', hAnsi: 'Microsoft YaHei', eastAsia: DOCX_CJK_FONT, cs: 'Microsoft YaHei', hint: 'eastAsia' };
const containsCjk = (value: string) => /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(value);
const fontForText = (value: string) => containsCjk(value) ? DOCX_CJK_RUN_FONT : DOCX_FONT;

let docxFontPromise: Promise<Uint8Array> | null = null;
const loadDocxFont = () => {
  if (!docxFontPromise) {
    docxFontPromise = fetch(notoSansScDocxFont)
      .then((response) => {
        if (!response.ok) throw new Error('Invoice DOCX 字体加载失败');
        return response.arrayBuffer();
      })
      .then((data) => new Uint8Array(data));
  }
  return docxFontPromise;
};

const paragraph = (label: string, value: string, options?: { before?: number; after?: number }) => new Paragraph({
  spacing: { before: options?.before ?? 0, after: options?.after ?? 40 },
  children: [
    new TextRun({ text: `${label}: `, bold: true, size: 20, font: DOCX_FONT }),
    new TextRun({ text: value, size: 20, font: fontForText(value) }),
  ],
});

const headerCell = (text: string, width: number, alignment: (typeof AlignmentType)[keyof typeof AlignmentType]) => new TableCell({
  width: { size: width, type: WidthType.DXA },
  verticalAlign: VerticalAlign.CENTER,
  shading: { type: ShadingType.CLEAR, fill: '111111', color: 'auto' },
  margins: { top: 120, bottom: 120, left: 120, right: 120 },
  children: [new Paragraph({
    alignment,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18, font: DOCX_FONT })],
  })],
});

const bodyCell = (text: string, width: number, alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) => new TableCell({
  width: { size: width, type: WidthType.DXA },
  verticalAlign: VerticalAlign.CENTER,
  margins: { top: 130, bottom: 130, left: 120, right: 120 },
  children: [new Paragraph({
    alignment,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text, size: 19, font: fontForText(text) })],
  })],
});

const paymentParagraphs = (model: InvoiceDocumentModel) => {
  if (model.paymentMethod === 'paypal') {
    return [
      new Paragraph({ spacing: { before: 0, after: 100 }, children: [new TextRun({ text: 'Paid by Paypal', bold: true, size: 21, font: DOCX_FONT })] }),
      paragraph('Paypal Name', model.payment.paypalUsername),
      paragraph('Paypal Email', model.payment.paypalEmail),
    ];
  }
  return [
    new Paragraph({ spacing: { before: 0, after: 100 }, children: [new TextRun({ text: 'Paid by Bank', bold: true, size: 21, font: DOCX_FONT })] }),
    paragraph('Real Name', model.from.legalName),
    paragraph('Account Name', model.payment.accountName),
    paragraph('Account Number', model.payment.accountNumber),
    paragraph('Beneficiary Bank Name', model.payment.bankName),
    paragraph('Beneficiary Bank Address', bankAddress(model)),
    paragraph('Swift Code', model.payment.swiftCode),
    paragraph('IBAN (optional)', model.payment.iban || '-'),
  ];
};

export async function generateInvoiceDocx(model: InvoiceDocumentModel) {
  const docxFontData = await loadDocxFont();
  const descriptionWidth = 4400;
  const priceWidth = 1770;
  const quantityWidth = 1310;
  const totalWidth = 1880;
  const invoiceTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [descriptionWidth, priceWidth, quantityWidth, totalWidth],
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [
          headerCell('DESCRIPTION', descriptionWidth, AlignmentType.LEFT),
          headerCell('PRICE', priceWidth, AlignmentType.RIGHT),
          headerCell('AMOUNT', quantityWidth, AlignmentType.CENTER),
          headerCell('TOTAL', totalWidth, AlignmentType.RIGHT),
        ],
      }),
      ...model.items.map((item) => new TableRow({
        cantSplit: true,
        children: [
          bodyCell(item.description, descriptionWidth),
          bodyCell(formatInvoiceMoney(model.currency, item.unitPrice), priceWidth, AlignmentType.RIGHT),
          bodyCell(item.quantity.toLocaleString('en-US'), quantityWidth, AlignmentType.CENTER),
          bodyCell(formatInvoiceMoney(model.currency, item.lineTotal), totalWidth, AlignmentType.RIGHT),
        ],
      })),
    ],
  });

  const fromInvoiceTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [5400, 3960],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [new TableRow({ children: [
      new TableCell({
        width: { size: 5400, type: WidthType.DXA },
        borders: NO_BORDERS,
        margins: { top: 0, bottom: 120, left: 0, right: 240 },
        children: [
          new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: 'From', bold: true, size: 22, font: DOCX_FONT })] }),
          paragraph('Real Name', model.from.legalName),
          paragraph('Address', model.from.address),
          paragraph('Tel', model.from.phone),
          paragraph('Email', model.from.email),
        ],
      }),
      new TableCell({
        width: { size: 3960, type: WidthType.DXA },
        borders: NO_BORDERS,
        margins: { top: 0, bottom: 120, left: 240, right: 0 },
        children: [
          new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: 'Invoice', bold: true, size: 22, font: DOCX_FONT })] }),
          paragraph('Date of Invoice', formatInvoiceDate(model.invoiceDate)),
          paragraph('Currency', `[${model.currency}]`),
          paragraph('Project', model.projectName),
        ],
      }),
    ] })],
  });

  const document = new DocxDocument({
    creator: 'COMETS Pay',
    title: model.invoiceNumber,
    description: `Invoice for ${model.projectName}`,
    styles: {
      default: {
        document: {
          run: { font: DOCX_FONT, size: 20, color: '111111' },
          paragraph: { spacing: { after: 80, line: 276 } },
        },
      },
    },
    fonts: [{ name: DOCX_CJK_FONT, data: docxFontData as never }],
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1080, right: 1440, bottom: 1080, left: 1440, header: 360, footer: 360, gutter: 0 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 260 },
          children: [new TextRun({ text: 'INVOICE', bold: true, size: 52, characterSpacing: 30, font: DOCX_FONT })],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: `Invoice No. ${model.invoiceNumber}`, bold: true, size: 20, font: DOCX_FONT })],
        }),
        new Paragraph({ spacing: { after: 70 }, children: [new TextRun({ text: 'Bill to', bold: true, size: 21, font: DOCX_FONT })] }),
        new Paragraph({ spacing: { after: 45 }, children: [new TextRun({ text: model.billTo.name, bold: true, size: 21, font: fontForText(model.billTo.name) })] }),
        new Paragraph({ spacing: { after: 220 }, children: [new TextRun({ text: model.billTo.address, size: 20, font: fontForText(model.billTo.address) })] }),
        new Paragraph({ border: { top: THIN_BORDER }, spacing: { before: 0, after: 150 }, children: [] }),
        fromInvoiceTable,
        new Paragraph({ spacing: { before: 60, after: 100 }, children: [] }),
        invoiceTable,
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 120, after: 260 },
          children: [
            new TextRun({ text: 'TOTAL PRICE    ', bold: true, size: 21, font: DOCX_FONT }),
            new TextRun({ text: formatInvoiceMoney(model.currency, invoiceTotal(model)), bold: true, size: 22, font: DOCX_FONT }),
          ],
        }),
        new Paragraph({ border: { top: THIN_BORDER }, spacing: { before: 0, after: 140 }, children: [] }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Payment information (choose one)', bold: true, size: 22, font: DOCX_FONT })] }),
        ...paymentParagraphs(model),
        new Paragraph({ spacing: { before: 240, after: 360 }, children: [new TextRun({ text: 'Signature:', bold: true, size: 21, font: DOCX_FONT })] }),
        new Paragraph({ border: { bottom: THIN_BORDER }, indent: { right: 5600 }, spacing: { before: 0, after: 0 }, children: [new TextRun({ text: ' ', size: 20 })] }),
      ],
    }],
  });
  return Packer.toBlob(document);
}

export async function generateInvoicePdf(model: InvoiceDocumentModel) {
  return pdf(<InvoicePdfDocument model={model} />).toBlob();
}

export async function generateInvoiceFiles(model: InvoiceDocumentModel) {
  const [pdfBlob, docxBlob] = await Promise.all([generateInvoicePdf(model), generateInvoiceDocx(model)]);
  return { pdfBlob, docxBlob };
}
