import fontkit from '@pdf-lib/fontkit';
import latinFontUrl from '@fontsource/noto-sans-sc/files/noto-sans-sc-latin-400-normal.woff?url';
import latinExtFontUrl from '@fontsource/noto-sans-sc/files/noto-sans-sc-latin-ext-400-normal.woff?url';
import chineseFontUrl from '@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff?url';
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  PageBreak,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type FileChild,
} from 'docx';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import type { ContractGenerationModel } from './contracts';
import {
  CONTRACT_TEMPLATE_FIELD_BINDINGS,
  CONTRACT_TEMPLATE_PAGE_COUNT,
  CONTRACT_TEMPLATE_URL,
  CONTRACT_TEMPLATE_YELLOW_RECTS,
  type ContractTemplateFieldBinding,
} from './contractTemplate';
export { contractGenerationFilename } from './contractGenerationFilename';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type EmbeddedFonts = {
  latin: PDFFont;
  latinExt: PDFFont;
  chinese: PDFFont;
};

export type ContractFontBytes = {
  latin: ArrayBuffer;
  latinExt: ArrayBuffer;
  chinese: ArrayBuffer;
};

const TEMPLATE_FETCH_ERROR = '合同模板读取失败，请刷新页面后重试。';
const DOCX_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'D8DCE4' };

export class ContractTemplateFitError extends Error {
  fieldId: string;

  constructor(fieldId: string) {
    super('字段内容过长，无法放入合同模板，请缩短后重试。');
    this.name = 'ContractTemplateFitError';
    this.fieldId = fieldId;
  }
}

const loadBytes = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(TEMPLATE_FETCH_ERROR);
  return response.arrayBuffer();
};

const isCjk = (character: string) => {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint >= 0x2e80;
};

const isBasicLatin = (character: string) => (character.codePointAt(0) ?? 0) <= 0x7f;

const fontForCharacter = (character: string, fonts: EmbeddedFonts) => (
  isCjk(character) ? fonts.chinese : isBasicLatin(character) ? fonts.latin : fonts.latinExt
);

const textWidth = (value: string, size: number, fonts: EmbeddedFonts) => (
  Array.from(value).reduce(
    (total, character) => total + fontForCharacter(character, fonts).widthOfTextAtSize(character, size),
    0,
  )
);

const wrapText = (value: string, width: number, size: number, fonts: EmbeddedFonts) => {
  const lines: string[] = [];
  value.split(/\r?\n/).forEach((sourceLine) => {
    if (!sourceLine) {
      lines.push('');
      return;
    }
    let line = '';
    Array.from(sourceLine).forEach((character) => {
      const next = `${line}${character}`;
      if (line && textWidth(next, size, fonts) > width) {
        lines.push(line.trimEnd());
        line = character.trimStart();
      } else {
        line = next;
      }
    });
    lines.push(line);
  });
  return lines;
};

const drawMixedLine = (
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  size: number,
  fonts: EmbeddedFonts,
) => {
  let cursor = x;
  let run = '';
  let currentFont: PDFFont | null = null;
  const flush = () => {
    if (!run || !currentFont) return;
    page.drawText(run, { x: cursor, y, size, font: currentFont, color: rgb(0.08, 0.09, 0.11) });
    cursor += currentFont.widthOfTextAtSize(run, size);
    run = '';
  };
  Array.from(value).forEach((character) => {
    const font = fontForCharacter(character, fonts);
    if (currentFont && font !== currentFont) flush();
    currentFont = font;
    run += character;
  });
  flush();
};

const drawBinding = (
  page: PDFPage,
  binding: ContractTemplateFieldBinding,
  value: string,
  fonts: EmbeddedFonts,
) => {
  if (!value.trim()) return;
  const maxLines = binding.maxLines ?? 1;
  let size = binding.fontSize;
  let lines = wrapText(value, binding.width, size, fonts);
  while (
    size > 4.5
    && (
      lines.length > maxLines
      || lines.length * size * 1.25 > binding.height
    )
  ) {
    size -= 0.25;
    lines = wrapText(value, binding.width, size, fonts);
  }
  if (lines.length > maxLines || lines.length * size * 1.25 > binding.height) {
    throw new ContractTemplateFitError(binding.id);
  }
  lines.forEach((line, index) => {
    const baseline = page.getHeight() - binding.top - size - index * size * 1.25;
    drawMixedLine(page, line, binding.x, baseline, size, fonts);
  });
};

export const generateContractPdf = async (
  model: ContractGenerationModel,
  sourceBytes?: ArrayBuffer,
  fontBytes?: ContractFontBytes,
) => {
  const templateBytes = sourceBytes ?? await loadBytes(CONTRACT_TEMPLATE_URL);
  const pdf = await PDFDocument.load(templateBytes);
  pdf.registerFontkit(fontkit);
  const loadedFontBytes = fontBytes ?? {
    latin: await loadBytes(latinFontUrl),
    latinExt: await loadBytes(latinExtFontUrl),
    chinese: await loadBytes(chineseFontUrl),
  };
  const [latin, latinExt, chinese] = await Promise.all([
    pdf.embedFont(loadedFontBytes.latin, { subset: true }),
    pdf.embedFont(loadedFontBytes.latinExt, { subset: true }),
    pdf.embedFont(loadedFontBytes.chinese, { subset: true }),
  ]);
  const fonts = { latin, latinExt, chinese };
  const pages = pdf.getPages();
  CONTRACT_TEMPLATE_YELLOW_RECTS.forEach((rect) => {
    const page = pages[rect.page - 1];
    if (!page) return;
    page.drawRectangle({
      x: rect.x - 0.5,
      y: page.getHeight() - rect.top - rect.height - 0.5,
      width: rect.width + 1,
      height: rect.height + 1,
      color: rgb(1, 1, 1),
    });
  });
  CONTRACT_TEMPLATE_FIELD_BINDINGS.forEach((binding) => {
    const page = pages[binding.page - 1];
    if (page) drawBinding(page, binding, binding.value(model), fonts);
  });
  pdf.setTitle(`${model.contractNumber} ${model.projectName}`);
  pdf.setAuthor('COMETS Pay');
  pdf.setSubject('Generated contract draft');
  pdf.setCreator('COMETS Pay local prototype');
  const bytes = await pdf.save();
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: 'application/pdf',
  });
};

const normalizePdfText = (value: string) => (
  value
    .replace(/\u0001/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

export const extractContractTemplatePageLines = async (bytes: ArrayBuffer) => {
  const loadingTask = getDocument({ data: new Uint8Array(bytes.slice(0)) });
  const document = await loadingTask.promise;
  const pages: string[][] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    content.items.forEach((item) => {
      if (!('str' in item)) return;
      const textItem = item;
      const y = Math.round(textItem.transform[5] * 2) / 2;
      const row = rows.get(y) ?? [];
      row.push({ x: textItem.transform[4], text: normalizePdfText(textItem.str) });
      rows.set(y, row);
    });
    pages.push(
      [...rows.entries()]
        .sort(([left], [right]) => right - left)
        .map(([, row]) => normalizePdfText(
          row
            .sort((left, right) => left.x - right.x)
            .map((item) => item.text)
            .filter(Boolean)
            .join(' '),
        ))
        .filter(Boolean),
    );
  }
  await document.destroy();
  return pages;
};

const replaceTemplateValues = (
  pageNumber: number,
  value: string,
  model: ContractGenerationModel,
) => {
  let result = value;
  if ([1, 13, 14, 17].includes(pageNumber)) {
    result = result
      .replace(/_*\[?\s*please fill in REAL NAME or Company NAME?\s*\]?_*/gi, model.publisher)
      .replace(/\[REAL NAME or Company Name\]/gi, model.publisher)
      .replace(/_*\[?\s*please fill in the promoted channel link\s*\]?_*/gi, model.channelUrl)
      .replace(/https:\/\/www\.youtube\.com\/x+/gi, model.channelUrl);
  }
  if (pageNumber === 1) {
    result = result.replace(/\[\s*please fill in channel platform e\.g\., YouTube\s*\]/gi, model.platform);
  }
  if (pageNumber === 5) {
    result = result.replace(/\[\s*3 working days\s*\]/gi, `[${model.invoiceIssueWorkingDays} working days]`);
  }
  if (pageNumber === 6) {
    const feeChoice = model.feeBearer === 'SHARED' ? 'i' : model.feeBearer === 'ADVERTISER' ? 'ii' : 'iii';
    result = result.replace(/\(\s*\)/, `(${feeChoice})`);
  }
  if (pageNumber === 16) {
    result = result.replace(/\[60\/45\]/g, `[${model.paymentWorkingDays}]`);
  }
  return result;
};

const docxText = (value: string, bold = false, size = 16) => new TextRun({
  text: value,
  bold,
  size,
  font: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei' },
});

const paragraph = (
  value: string,
  options: { bold?: boolean; center?: boolean; before?: number; after?: number; size?: number } = {},
) => new Paragraph({
  alignment: options.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
  spacing: {
    before: options.before ?? 0,
    after: options.after ?? 54,
    line: 210,
  },
  children: [docxText(value, options.bold, options.size ?? 16)],
});

const docxCell = (value: string, width: number, bold = false) => new TableCell({
  width: { size: width, type: WidthType.DXA },
  verticalAlign: VerticalAlign.CENTER,
  margins: { top: 65, bottom: 65, left: 90, right: 90 },
  children: [new Paragraph({
    spacing: { before: 0, after: 0, line: 195 },
    children: [docxText(value, bold, 15)],
  })],
});

const table = (rows: Array<[string, string]>, widths: [number, number] = [2400, 6500]) => new Table({
  width: { size: widths[0] + widths[1], type: WidthType.DXA },
  columnWidths: widths,
  borders: {
    top: DOCX_BORDER,
    bottom: DOCX_BORDER,
    left: DOCX_BORDER,
    right: DOCX_BORDER,
    insideHorizontal: DOCX_BORDER,
    insideVertical: DOCX_BORDER,
  },
  rows: rows.map(([label, value]) => new TableRow({
    children: [docxCell(label, widths[0], true), docxCell(value, widths[1])],
  })),
});

const paymentBankAddress = (model: ContractGenerationModel) => [
  model.paymentSnapshot.bankStreetAddress,
  model.paymentSnapshot.bankCity,
  model.paymentSnapshot.bankState,
  model.paymentSnapshot.bankPostalCode,
  model.paymentSnapshot.bankCountry,
].filter(Boolean).join(', ');

const standardTermsOpeningPage = (
  lines: string[],
  model: ContractGenerationModel,
): FileChild[] => {
  const definitionsIndex = lines.findIndex((line) => /^1\s*\.\s*Definitions/i.test(line));
  const fixedTerms = definitionsIndex >= 0 ? lines.slice(definitionsIndex) : lines.slice(9);
  return [
    paragraph('Standard Terms And Conditions For Digital Marketing Services', {
      bold: true,
      center: true,
      after: 100,
      size: 18,
    }),
    paragraph(
      `This Standard Terms And Conditions (the "Standard Terms") constitute an integrated part of all Insertion Orders (the "IO") between Comets International Limited ("Advertiser") and ${model.publisher} on behalf of (${model.channelUrl}) ("Publisher"). Publisher is required to have their own accounts on ${model.platform}. The Standard Terms and IO are collectively referred to herein as the "Agreement". In the event of a contradiction between the provisions of these Standard Terms and the IO, the provisions of the IO shall prevail.`,
      { after: 90 },
    ),
    ...fixedTerms.map((line) => paragraph(line, {
      bold: /^1\s*\.\s*Definitions/i.test(line),
    })),
  ];
};

const paymentPage = (lines: string[], model: ContractGenerationModel): FileChild[] => {
  const fixed = lines.slice(0, Math.max(0, lines.findIndex((line) => /3\.3\s*Payments/i.test(line)) + 1));
  const bank = model.payoutProvider === 'Airwallex';
  return [
    ...fixed.map((line) => paragraph(replaceTemplateValues(5, line, model))),
    table([
      ['Account Name', bank ? model.paymentSnapshot.accountName : ''],
      ['Account Number', bank ? model.paymentSnapshot.accountNumber : ''],
      ['Beneficiary Bank Name', bank ? model.paymentSnapshot.bankName : ''],
      ['Beneficiary bank address', bank ? paymentBankAddress(model) : ''],
      ['Swift Code', bank ? model.paymentSnapshot.swiftCode : ''],
      ['IBAN', bank ? model.paymentSnapshot.iban : ''],
      ['Remittance Information (optional)', bank ? model.paymentSnapshot.transferRemarks : ''],
    ]),
    paragraph('Or', { before: 90, after: 90 }),
    table([
      ['Paypal UserName', bank ? '' : model.paymentSnapshot.paypalUsername],
      ['Paypal Email Address', bank ? '' : model.paymentSnapshot.paypalEmail],
      ['Transfer Note (optional)', ''],
      ['Remittance Information (optional)', bank ? '' : model.paymentSnapshot.transferRemarks],
    ]),
  ];
};

const insertionOrderPage = (model: ContractGenerationModel): FileChild[] => [
  table([
    ['Signature / Name / Title', ''],
    ['Signature / Name / Title', model.publisher],
    ['Address', 'Unit 04-05, 16th Floor, The Broadway No. 54-62 Lockhart Road, Wanchai, Hong Kong'],
    ['Publisher Address', model.publisherAddress],
  ], [4450, 4450]),
  paragraph('Insertion Order', { bold: true, center: true, before: 200, after: 150, size: 20 }),
  paragraph(
    `This Insertion Order ("this IO") relates to the services to be provided under the Standard Terms And Conditions For Digital Marketing Services entered into by and between ${model.publisher} on behalf of (${model.channelUrl}) ("Publisher") and Comets International Limited ("Advertiser") with effect as of ${model.effectiveDate} ("the Agreement").`,
  ),
  paragraph('All defined terms in this IO have the same meaning as in the Agreement unless this IO expressly states otherwise. If there is any conflict between this IO and the Agreement, this IO will take precedence.'),
  paragraph(`1. Campaign Period: ${model.campaignStart} to ${model.campaignEnd}.`, { bold: true, before: 120 }),
  paragraph('2. Campaign Details:', { bold: true, before: 80 }),
  table([
    ['Project Name', model.projectName],
    ['Service Provider Name', model.channelName],
    ['Start Date', model.campaignStart],
    ['End Date', model.campaignEnd],
  ]),
];

const campaignDetailsPage = (model: ContractGenerationModel): FileChild[] => [
  table([
    ['Purpose', ['The video will help to promote:', ...model.purposeItems.map((item, index) => `${index + 1}. ${item}`)].join('\n')],
    ['Services / Deliverables', [
      '1. Provide a written script of initial ideas before making the video/streaming.',
      `2. Post a ${model.contentFormat} about ${model.promotedProduct}.`,
      '3. Include the correct campaign name, CTA and tracklink supplied by the Brand.',
      `4. Include hashtag #${model.hashtag.replace(/^#/, '')} in the description.`,
      '5. Provide analytics screenshots within 2 days of streaming where applicable.',
      '6. Work with the Brand to remove unfavourable branding where required.',
    ].join('\n')],
    ['Format', model.contentFormat],
    ['Release Date', `${model.releaseStart} to ${model.releaseEnd}`],
    ['Language', model.language],
    ['Publishing Platform', model.platform],
    ['Channel Link', model.channelUrl],
    ['Length of Video', model.contentLength],
    ['License Period', model.licensePeriod],
    ['License Price', model.licensePrice ? `${model.currency} ${model.licensePrice}` : ''],
    ['Project Total Fees', `${model.currency} ${model.totalFee}`],
  ]),
];

const signaturePage = (model: ContractGenerationModel): FileChild[] => [
  table([
    ['For and on behalf of Comets International Limited', `For and on behalf of ${model.publisher}`],
    ['Signature: _________________________\nDate:', 'Signature: _________________________\nDate:'],
  ], [4450, 4450]),
];

const pageChildren = (
  pageNumber: number,
  lines: string[],
  model: ContractGenerationModel,
): FileChild[] => {
  if (pageNumber === 1) return standardTermsOpeningPage(lines, model);
  if (pageNumber === 5) return paymentPage(lines, model);
  if (pageNumber === 14) return insertionOrderPage(model);
  if (pageNumber === 15) return campaignDetailsPage(model);
  if (pageNumber === 17) return signaturePage(model);
  return lines.map((line) => paragraph(replaceTemplateValues(pageNumber, line, model), {
    bold: /^(\d+\.|Insertion Order|EXECUTED)/i.test(line),
  }));
};

export const generateContractDocx = async (
  model: ContractGenerationModel,
  sourceBytes?: ArrayBuffer,
) => {
  const templateBytes = sourceBytes ?? await loadBytes(CONTRACT_TEMPLATE_URL);
  const pageLines = await extractContractTemplatePageLines(templateBytes);
  const children = pageLines.flatMap((lines, index) => {
    const pageNumber = index + 1;
    const content = pageChildren(pageNumber, lines, model);
    return pageNumber < CONTRACT_TEMPLATE_PAGE_COUNT
      ? [...content, new Paragraph({ children: [new PageBreak()] })]
      : content;
  });
  const document = new DocxDocument({
    creator: 'COMETS Pay',
    title: `${model.contractNumber} ${model.projectName}`,
    description: 'COMETS Pay local editable contract draft',
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 420, right: 540, bottom: 420, left: 540 },
        },
      },
      children,
    }],
  });
  return Packer.toBlob(document);
};

export const generateContractFiles = async (model: ContractGenerationModel) => {
  const sourceBytes = await loadBytes(CONTRACT_TEMPLATE_URL);
  const [pdfBlob, docxBlob] = await Promise.all([
    generateContractPdf(model, sourceBytes.slice(0)),
    generateContractDocx(model, sourceBytes.slice(0)),
  ]);
  return { pdfBlob, docxBlob };
};
