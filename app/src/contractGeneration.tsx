import fontkit from '@pdf-lib/fontkit';
import unicodeFontUrl from './assets/fonts/NotoSansSC-Regular.ttf?url';
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  Footer,
  Header,
  PageBreak,
  PageNumber,
  Paragraph,
  Packer,
  ShadingType,
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
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import type {
  ContractDocumentVariant,
  ContractFieldAnchor,
  ContractGeneratedFiles,
  ContractGenerationModel,
  ContractQualityIssue,
  ContractQualityReport,
  ContractTemplateFieldKey,
  ContractTemplateOutputFieldKey,
} from './contracts';
import { formatContractPublishingChannelLinks } from './contractGenerationModel';
import {
  CONTRACT_TEMPLATE_BASE_PAGE_COUNT,
  CONTRACT_TEMPLATE_DEFINITION,
  CONTRACT_TEMPLATE_HEIGHT,
  CONTRACT_TEMPLATE_MARGIN,
  CONTRACT_TEMPLATE_URL,
  CONTRACT_TEMPLATE_WIDTH,
  createContractQualityReport,
  formatContractDate,
  formatContractMoneyValue,
  placeholderToken,
  replaceContractPlaceholders,
} from './contractTemplate';
import {
  isContractTemplateOutputFieldOmitted,
  resolveContractTemplateOutput,
} from './contractTemplateFieldPolicies';
export { contractGenerationFilename } from './contractGenerationFilename';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type FontSet = {
  latin: PDFFont;
  latinExt: PDFFont;
  chinese: PDFFont;
};

type EmbeddedFonts = {
  regular: FontSet;
  bold: FontSet;
};

export type ContractFontBytes = {
  latin: ArrayBuffer;
  latinExt: ArrayBuffer;
  chinese: ArrayBuffer;
  boldLatin?: ArrayBuffer;
  boldLatinExt?: ArrayBuffer;
  boldChinese?: ArrayBuffer;
};

type ParagraphStyle = 'body' | 'title' | 'heading' | 'subheading' | 'small';

type ResolvedParagraph = {
  type: 'paragraph';
  text: string;
  style?: ParagraphStyle;
  fieldKey?: ContractTemplateFieldKey;
  align?: 'left' | 'center' | 'justify';
};

type ResolvedTableRow = {
  label: string;
  value: string;
  fieldKey?: ContractTemplateFieldKey;
  optional?: boolean;
};

type ResolvedTable = {
  type: 'table';
  rows: ResolvedTableRow[];
};

type ResolvedSignature = {
  type: 'signature';
  advertiser: string;
  publisher: string;
  publisherAddress: string;
};

type ResolvedBlock = ResolvedParagraph | ResolvedTable | ResolvedSignature;

type ResolvedLogicalPage = {
  sourcePage: number;
  blocks: ResolvedBlock[];
};

type PreparedContractDocument = {
  pages: ResolvedLogicalPage[];
  qualityReport: ContractQualityReport;
};

type PdfBuildResult = {
  pdfBlob: Blob;
  pageCount: number;
  anchors: ContractFieldAnchor[];
  qualityReport: ContractQualityReport;
};

const TEMPLATE_FETCH_ERROR = '合同模板读取失败，请刷新页面后重试。';
const A4_DXA_WIDTH = 11906;
const A4_DXA_HEIGHT = 16838;
const A4_DXA_MARGIN = 1247;
const DOCX_CONTENT_WIDTH = A4_DXA_WIDTH - A4_DXA_MARGIN * 2;
const DOCX_LABEL_WIDTH = 2450;
const DOCX_VALUE_WIDTH = DOCX_CONTENT_WIDTH - DOCX_LABEL_WIDTH;
const DOCX_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'D8DCE4' };

const resourceBytesCache = new Map<string, Promise<ArrayBuffer>>();

const loadBytes = (url: string) => {
  const cached = resourceBytesCache.get(url);
  if (cached) return cached;
  const pending = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(TEMPLATE_FETCH_ERROR);
      return response.arrayBuffer();
    })
    .catch((error) => {
      resourceBytesCache.delete(url);
      throw error;
    });
  resourceBytesCache.set(url, pending);
  return pending;
};

const normalizePdfText = (value: string) => (
  value
    .replace(/[\u0000-\u001f\u007f-\u009f\uE000-\uF8FF\uFFFD]/g, ' ')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\uFF1A/g, ':')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const joinPdfTextRow = (items: Array<{ x: number; width: number; text: string }>) => {
  let result = '';
  let right = 0;
  items
    .sort((left, next) => left.x - next.x)
    .forEach((item) => {
      const text = normalizePdfText(item.text);
      if (!text) return;
      const gap = item.x - right;
      const needsSpace = Boolean(
        result
        && gap > 1.5
        && !/[\s(/-]$/.test(result)
        && !/^[,.;:)\]}]/.test(text),
      );
      result += `${needsSpace ? ' ' : ''}${text}`;
      right = Math.max(right, item.x + item.width);
    });
  return normalizePdfText(result);
};

const templatePageLinesCache = new WeakMap<ArrayBuffer, Promise<string[][]>>();

export const extractContractTemplatePageLines = (bytes: ArrayBuffer) => {
  const cached = templatePageLinesCache.get(bytes);
  if (cached) return cached;
  const pending = (async () => {
    const loadingTask = getDocument({ data: new Uint8Array(bytes.slice(0)) });
    const document = await loadingTask.promise;
    const pages: string[][] = [];
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const rows = new Map<number, Array<{ x: number; width: number; text: string }>>();
        content.items.forEach((item) => {
          if (!('str' in item)) return;
          const y = Math.round(item.transform[5] * 2) / 2;
          const row = rows.get(y) ?? [];
          row.push({ x: item.transform[4], width: item.width, text: item.str });
          rows.set(y, row);
        });
        pages.push(
          [...rows.entries()]
            .sort(([left], [right]) => right - left)
            .map(([, row]) => joinPdfTextRow(row))
            .filter(Boolean),
        );
      }
      return pages;
    } finally {
      await document.destroy();
    }
  })().catch((error) => {
    templatePageLinesCache.delete(bytes);
    throw error;
  });
  templatePageLinesCache.set(bytes, pending);
  return pending;
};

const isHeading = (value: string) => (
  /^(?:\d+(?:\.\d+)*\.?\s+[A-Z]|Insertion Order$|EXECUTED|Schedule|Appendix)/i.test(value)
);

const stripTemplateArtifacts = (
  value: string,
  model: ContractGenerationModel,
  variant: ContractDocumentVariant,
  pageNumber: number,
) => {
  const effectiveModel = resolveContractTemplateOutput(model).effectiveModel;
  const channelLinks = formatContractPublishingChannelLinks(effectiveModel);
  let result = value
    .replace(/_+/g, ' ')
    .replace(/\[\s*please fill[^\]]*\]/gi, variant === 'DRAFT' ? '待填写' : '')
    .replace(/please fill in REAL NAME or Company NAME/gi, effectiveModel.publisher || (variant === 'DRAFT' ? '待填写' : ''))
    .replace(/\[REAL NAME or Company Name\]/gi, effectiveModel.publisher || (variant === 'DRAFT' ? '待填写' : ''))
    .replace(/please fill in the promoted channel link/gi, channelLinks || (variant === 'DRAFT' ? '待填写' : ''))
    .replace(/https:\/\/www\.youtube\.com\/x+/gi, channelLinks || (variant === 'DRAFT' ? '待填写' : ''))
    .replace(/\bXXX\b/gi, variant === 'DRAFT' ? '待填写' : '')
    .replace(/\[Date\]/gi, variant === 'DRAFT' ? '待填写' : '')
    .replace(/example only/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (pageNumber === 6) {
    const bearer = model.feeBearer === 'ADVERTISER' ? 'ii' : model.feeBearer === 'PUBLISHER' ? 'iii' : model.feeBearer === 'SHARED' ? 'i' : '';
    result = result.replace(/\(\s*\)/, bearer ? `(${bearer})` : variant === 'DRAFT' ? '(待填写)' : '()');
  }
  if (pageNumber === 16) {
    result = result.replace(/\[60\/45\]/g, model.paymentWorkingDays ? `[${model.paymentWorkingDays}]` : variant === 'DRAFT' ? '[待填写]' : '');
  }
  return result;
};

const sourcePageBlocks = (
  pageNumber: number,
  lines: string[],
  model: ContractGenerationModel,
  variant: ContractDocumentVariant,
): ResolvedBlock[] => lines
  .map((line) => stripTemplateArtifacts(line, model, variant, pageNumber))
  .filter(Boolean)
  .map((text) => ({
    type: 'paragraph' as const,
    text,
    style: isHeading(text) ? 'subheading' as const : 'body' as const,
  }));

const standardTermsOpening = (
  lines: string[],
  model: ContractGenerationModel,
  variant: ContractDocumentVariant,
): ResolvedBlock[] => {
  const definitionsIndex = lines.findIndex((line) => /^1\s*\.\s*Definitions/i.test(line));
  const fixedTerms = definitionsIndex >= 0 ? lines.slice(definitionsIndex) : lines.slice(9);
  return [
    {
      type: 'paragraph',
      style: 'title',
      align: 'center',
      text: 'Standard Terms And Conditions For Digital Marketing Services',
    },
    {
      type: 'paragraph',
      style: 'body',
      fieldKey: 'publisher',
      align: 'justify',
      text: replaceContractPlaceholders(
        `This Standard Terms And Conditions (the "Standard Terms") constitute an integrated part of all Insertion Orders (the "IO") between ${placeholderToken('advertiser_name')} ("Advertiser") and ${placeholderToken('publisher_name')} on behalf of (${placeholderToken('channel_url')}) ("Publisher"). Publisher is required to have their own accounts on ${placeholderToken('platform')}. The Standard Terms and IO are collectively referred to herein as the "Agreement". In the event of a contradiction between the provisions of these Standard Terms and the IO, the provisions of the IO shall prevail.`,
        model,
        variant,
      ),
    },
    ...sourcePageBlocks(1, fixedTerms, model, variant),
  ];
};

const configuredOutputRow = (
  model: ContractGenerationModel,
  outputFieldKey: ContractTemplateOutputFieldKey,
  row: ResolvedTableRow,
): ResolvedTableRow[] => (
  isContractTemplateOutputFieldOmitted(model, outputFieldKey) ? [] : [row]
);

const paymentPage = (
  lines: string[],
  model: ContractGenerationModel,
  variant: ContractDocumentVariant,
): ResolvedBlock[] => {
  const paymentIndex = lines.findIndex((line) => /3\.3\s*Payments/i.test(line));
  const fixed = paymentIndex >= 0 ? lines.slice(0, paymentIndex + 1) : lines.slice(0, 10);
  const bank = model.payoutProvider === 'Airwallex';
  return [
    ...sourcePageBlocks(5, fixed, model, variant),
    {
      type: 'paragraph',
      style: 'subheading',
      text: replaceContractPlaceholders(
        `Publisher shall issue a valid Invoice within ${placeholderToken('invoice_issue_days')} after completing the agreed services.`,
        model,
        variant,
      ),
    },
    {
      type: 'table',
      rows: bank ? [
        { label: 'Payment Method', value: 'Bank transfer', fieldKey: 'payoutAccount' },
        ...configuredOutputRow(model, 'accountName', { label: 'Account Name', value: replaceContractPlaceholders(placeholderToken('account_name'), model, variant), fieldKey: 'payoutAccount' }),
        ...configuredOutputRow(model, 'accountNumber', { label: 'Account Number', value: replaceContractPlaceholders(placeholderToken('account_number'), model, variant), fieldKey: 'payoutAccount', optional: true }),
        ...configuredOutputRow(model, 'beneficiaryBankName', { label: 'Beneficiary Bank Name', value: replaceContractPlaceholders(placeholderToken('beneficiary_bank_name'), model, variant), fieldKey: 'payoutAccount' }),
        ...configuredOutputRow(model, 'beneficiaryBankAddress', { label: 'Beneficiary Bank Address', value: replaceContractPlaceholders(placeholderToken('beneficiary_bank_address'), model, variant), fieldKey: 'payoutAccount', optional: true }),
        ...configuredOutputRow(model, 'swiftCode', { label: 'Swift Code', value: replaceContractPlaceholders(placeholderToken('swift_code'), model, variant), fieldKey: 'payoutAccount', optional: true }),
        ...configuredOutputRow(model, 'iban', { label: 'IBAN', value: replaceContractPlaceholders(placeholderToken('iban'), model, variant), fieldKey: 'payoutAccount', optional: true }),
        ...configuredOutputRow(model, 'remittanceInformation', { label: 'Remittance Information (optional)', value: replaceContractPlaceholders(placeholderToken('remittance_information'), model, variant), fieldKey: 'payoutAccount', optional: true }),
      ] : [
        { label: 'Payment Method', value: 'PayPal', fieldKey: 'payoutAccount' },
        ...configuredOutputRow(model, 'paypalUsername', { label: 'PayPal Username', value: replaceContractPlaceholders(placeholderToken('paypal_username'), model, variant), fieldKey: 'payoutAccount' }),
        ...configuredOutputRow(model, 'paypalEmailAddress', { label: 'PayPal Email Address', value: replaceContractPlaceholders(placeholderToken('paypal_email'), model, variant), fieldKey: 'payoutAccount' }),
        ...configuredOutputRow(model, 'transferNote', { label: 'Transfer Note (optional)', value: replaceContractPlaceholders(placeholderToken('transfer_note'), model, variant), fieldKey: 'payoutAccount', optional: true }),
      ],
    },
  ];
};

const insertionOrderPage = (
  model: ContractGenerationModel,
  variant: ContractDocumentVariant,
): ResolvedBlock[] => {
  const partyRows: ResolvedTableRow[] = [
    ...configuredOutputRow(model, 'advertiser', { label: 'Advertiser', value: replaceContractPlaceholders(placeholderToken('advertiser_name'), model, variant), fieldKey: 'signature' }),
    { label: 'Advertiser Address', value: 'Unit 04-05, 16th Floor, The Broadway No. 54-62 Lockhart Road, Wanchai, Hong Kong', fieldKey: 'signature' },
    ...configuredOutputRow(model, 'publisher', { label: 'Publisher', value: replaceContractPlaceholders(placeholderToken('publisher_name'), model, variant), fieldKey: 'publisher' }),
    { label: 'Publisher Address', value: replaceContractPlaceholders(placeholderToken('publisher_address'), model, variant), fieldKey: 'publisherAddress' },
  ];
  const campaignRows: ResolvedTableRow[] = [
    { label: 'Project Name', value: replaceContractPlaceholders(placeholderToken('project_name'), model, variant), fieldKey: 'projectName' },
    { label: 'Service Provider Name', value: replaceContractPlaceholders(placeholderToken('channel_name'), model, variant), fieldKey: 'channelName' },
  ];
  return [
  {
    type: 'table',
    rows: partyRows,
  },
  { type: 'paragraph', style: 'title', align: 'center', text: 'Insertion Order' },
  {
    type: 'paragraph',
    style: 'body',
    fieldKey: 'effectiveDate',
    align: 'justify',
    text: replaceContractPlaceholders(
      `This Insertion Order ("this IO") relates to the services provided under the Standard Terms And Conditions For Digital Marketing Services entered into by ${placeholderToken('publisher_name')} on behalf of (${placeholderToken('channel_url')}) ("Publisher") and ${placeholderToken('advertiser_name')} ("Advertiser") with effect as of ${placeholderToken('effective_date')} ("the Agreement").`,
      model,
      variant,
    ),
  },
  {
    type: 'paragraph',
    style: 'body',
    text: 'All defined terms in this IO have the same meaning as in the Agreement unless this IO expressly states otherwise. If there is any conflict between this IO and the Agreement, this IO will take precedence.',
  },
  { type: 'paragraph', style: 'heading', text: '1. Campaign Details' },
  {
    type: 'table',
    rows: campaignRows,
  },
  ];
};

const campaignDetailsPage = (
  model: ContractGenerationModel,
  variant: ContractDocumentVariant,
): ResolvedBlock[] => {
  const purpose = model.purposeItems.length
    ? ['The content will help to promote:', ...model.purposeItems.map((item, index) => `${index + 1}. ${item}`)].join('\n')
    : variant === 'DRAFT' ? '待填写' : '';
  const deliverables = [
    '1. Provide a written script of initial ideas before producing the content.',
    `2. Publish a ${model.contentFormat || (variant === 'DRAFT' ? '待填写' : '')} about ${model.promotedProduct || (variant === 'DRAFT' ? '待填写' : '')}.`,
    '3. Include the approved campaign name, CTA and tracking link supplied by the Advertiser.',
    `4. Include ${model.hashtag || (variant === 'DRAFT' ? '待填写' : '')} in the description.`,
    '5. Provide publication evidence and analytics screenshots where applicable.',
    '6. Complete reasonable revisions and remove unfavourable branding content where contractually required.',
  ].join('\n');
  return [
    { type: 'paragraph', style: 'title', align: 'center', text: 'Campaign Details' },
    {
      type: 'table',
      rows: [
        { label: 'Purpose', value: purpose, fieldKey: 'purposeItems' },
        { label: 'Services / Deliverables', value: deliverables, fieldKey: 'contentFormat' },
        { label: 'Format', value: replaceContractPlaceholders(placeholderToken('content_format'), model, variant), fieldKey: 'contentFormat' },
        { label: 'Release Date', value: replaceContractPlaceholders(`${placeholderToken('release_start')} to ${placeholderToken('release_end')}`, model, variant), fieldKey: 'releasePeriod' },
        { label: 'Language', value: replaceContractPlaceholders(placeholderToken('language'), model, variant), fieldKey: 'language' },
        ...configuredOutputRow(model, 'channel', { label: 'Publishing Platform', value: replaceContractPlaceholders(placeholderToken('platform'), model, variant), fieldKey: 'platform' }),
        ...configuredOutputRow(model, 'channel', { label: 'Channel Link', value: replaceContractPlaceholders(placeholderToken('channel_url'), model, variant), fieldKey: 'channelUrl' }),
        { label: 'Length of Content', value: replaceContractPlaceholders(placeholderToken('content_length'), model, variant), fieldKey: 'contentLength' },
        { label: 'License Period', value: replaceContractPlaceholders(placeholderToken('license_period'), model, variant), fieldKey: 'licensePeriod', optional: true },
        { label: 'License Price', value: replaceContractPlaceholders(placeholderToken('license_price'), model, variant), fieldKey: 'licensePrice', optional: true },
        { label: 'Project Total Fees', value: replaceContractPlaceholders(placeholderToken('contract_amount'), model, variant), fieldKey: 'totalFee' },
      ],
    },
  ];
};

const signaturePage = (
  model: ContractGenerationModel,
  variant: ContractDocumentVariant,
): ResolvedBlock[] => {
  const output = resolveContractTemplateOutput(model);
  return [
  { type: 'paragraph', style: 'title', align: 'center', text: 'Execution' },
  {
    type: 'paragraph',
    style: 'body',
    text: 'The parties acknowledge that the Agreement may be executed in counterparts and by electronic signature. Handwritten signatures and signature dates are intentionally left blank for the signing workflow.',
  },
  {
    type: 'signature',
    advertiser: output.values.advertiser || (variant === 'DRAFT' ? '待填写' : ''),
    publisher: output.values.publisher || (variant === 'DRAFT' ? '待填写' : ''),
    publisherAddress: model.publisherAddress || (variant === 'DRAFT' ? '待填写' : ''),
  },
  ];
};

const prepareContractDocument = async (
  model: ContractGenerationModel,
  variant: ContractDocumentVariant,
  templateBytes: ArrayBuffer,
) => {
  const pageLines = await extractContractTemplatePageLines(templateBytes);
  const pages: ResolvedLogicalPage[] = Array.from(
    { length: CONTRACT_TEMPLATE_BASE_PAGE_COUNT },
    (_, index) => {
      const sourcePage = index + 1;
      const lines = pageLines[index] ?? [];
      let blocks: ResolvedBlock[];
      if (sourcePage === 1) blocks = standardTermsOpening(lines, model, variant);
      else if (sourcePage === 5) blocks = paymentPage(lines, model, variant);
      else if (sourcePage === 14) blocks = insertionOrderPage(model, variant);
      else if (sourcePage === 15) blocks = campaignDetailsPage(model, variant);
      else if (sourcePage === 17) blocks = signaturePage(model, variant);
      else blocks = sourcePageBlocks(sourcePage, lines, model, variant);
      return { sourcePage, blocks };
    },
  );
  const unresolved = pages.flatMap((page) => page.blocks.flatMap((block) => {
    const values = block.type === 'paragraph'
      ? [block.text]
      : block.type === 'table'
        ? block.rows.flatMap((row) => [row.label, row.value])
        : [block.advertiser, block.publisher, block.publisherAddress];
    return values.some((value) => /\{\{[^}]+\}\}/.test(value))
      ? [{
          id: `unresolved-page-${page.sourcePage}`,
          kind: 'PLACEHOLDER_UNRESOLVED' as const,
          severity: 'BLOCKER' as const,
          fieldKey: 'projectName' as const,
          pageNumber: page.sourcePage,
          message: `第 ${page.sourcePage} 页仍包含未替换的模板字段`,
        }]
      : [];
  }));
  return {
    pages,
    qualityReport: createContractQualityReport(model, unresolved),
  } satisfies PreparedContractDocument;
};

const isCjk = (character: string) => (character.codePointAt(0) ?? 0) >= 0x2e80;
const isBasicLatin = (character: string) => (character.codePointAt(0) ?? 0) <= 0x7f;

const fontForCharacter = (character: string, fonts: EmbeddedFonts, bold: boolean) => {
  const set = bold ? fonts.bold : fonts.regular;
  return isCjk(character) ? set.chinese : isBasicLatin(character) ? set.latin : set.latinExt;
};

type FontWidthCache = WeakMap<PDFFont, Map<number, Map<string, number>>>;

const characterWidth = (
  character: string,
  size: number,
  fonts: EmbeddedFonts,
  bold: boolean,
  cache: FontWidthCache,
) => {
  const font = fontForCharacter(character, fonts, bold);
  let sizes = cache.get(font);
  if (!sizes) {
    sizes = new Map();
    cache.set(font, sizes);
  }
  let characters = sizes.get(size);
  if (!characters) {
    characters = new Map();
    sizes.set(size, characters);
  }
  const cached = characters.get(character);
  if (cached !== undefined) return cached;
  const measured = font.widthOfTextAtSize(character, size);
  characters.set(character, measured);
  return measured;
};

const textWidth = (
  value: string,
  size: number,
  fonts: EmbeddedFonts,
  bold = false,
  cache: FontWidthCache = new WeakMap(),
) => (
  Array.from(value).reduce(
    (total, character) => total + characterWidth(character, size, fonts, bold, cache),
    0,
  )
);

const wrapText = (
  value: string,
  width: number,
  size: number,
  fonts: EmbeddedFonts,
  bold = false,
  cache: FontWidthCache = new WeakMap(),
) => {
  const lines: string[] = [];
  value.split(/\r?\n/).forEach((sourceLine) => {
    if (!sourceLine) {
      lines.push('');
      return;
    }
    let line = '';
    let lineWidth = 0;
    Array.from(sourceLine).forEach((character) => {
      const nextWidth = lineWidth + characterWidth(character, size, fonts, bold, cache);
      if (line && nextWidth > width) {
        const breakAt = line.lastIndexOf(' ');
        if (breakAt > 0) {
          lines.push(line.slice(0, breakAt).trimEnd());
          line = `${line.slice(breakAt + 1)}${character}`.trimStart();
          lineWidth = textWidth(line, size, fonts, bold, cache);
        } else {
          lines.push(line.trimEnd());
          line = character.trimStart();
          lineWidth = line ? characterWidth(character, size, fonts, bold, cache) : 0;
        }
      } else {
        line += character;
        lineWidth = nextWidth;
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
  bold = false,
  color = rgb(0.125, 0.141, 0.169),
) => {
  let cursor = x;
  let run = '';
  let currentFont: PDFFont | null = null;
  const flush = () => {
    if (!run || !currentFont) return;
    page.drawText(run, { x: cursor, y, size, font: currentFont, color });
    cursor += currentFont.widthOfTextAtSize(run, size);
    run = '';
  };
  Array.from(value).forEach((character) => {
    const font = fontForCharacter(character, fonts, bold);
    if (currentFont && font !== currentFont) flush();
    currentFont = font;
    run += character;
  });
  flush();
};

const loadEmbeddedFonts = async (
  pdf: PDFDocument,
  fontBytes?: ContractFontBytes,
): Promise<EmbeddedFonts> => {
  if (!fontBytes) {
    // Keep Latin text on PDF-native fonts and parse one Unicode fallback instead of six WOFF subsets.
    const [latin, boldLatin, unicode] = await Promise.all([
      pdf.embedFont(StandardFonts.Helvetica),
      pdf.embedFont(StandardFonts.HelveticaBold),
      loadBytes(unicodeFontUrl).then((bytes) => pdf.embedFont(bytes, { subset: true })),
    ]);
    return {
      regular: { latin, latinExt: unicode, chinese: unicode },
      bold: { latin: boldLatin, latinExt: unicode, chinese: unicode },
    };
  }
  const regular = await Promise.all([
    pdf.embedFont(fontBytes.latin, { subset: true }),
    pdf.embedFont(fontBytes.latinExt, { subset: true }),
    pdf.embedFont(fontBytes.chinese, { subset: true }),
  ]);
  const bold = await Promise.all([
    pdf.embedFont(fontBytes.boldLatin ?? fontBytes.latin, { subset: true }),
    pdf.embedFont(fontBytes.boldLatinExt ?? fontBytes.latinExt, { subset: true }),
    pdf.embedFont(fontBytes.boldChinese ?? fontBytes.chinese, { subset: true }),
  ]);
  return {
    regular: { latin: regular[0], latinExt: regular[1], chinese: regular[2] },
    bold: { latin: bold[0], latinExt: bold[1], chinese: bold[2] },
  };
};

const paragraphTokens = (style: ParagraphStyle = 'body') => {
  if (style === 'title') return { size: 18, lineHeight: 22.5, before: 6, after: 13, bold: true };
  if (style === 'heading') return { size: 14, lineHeight: 17.5, before: 8, after: 8, bold: true };
  if (style === 'subheading') return { size: 11, lineHeight: 14, before: 6, after: 6, bold: true };
  if (style === 'small') return { size: 9.5, lineHeight: 12, before: 0, after: 4, bold: false };
  return { size: 10.5, lineHeight: 13.125, before: 0, after: 6, bold: false };
};

const buildContractPdf = async (
  prepared: PreparedContractDocument,
  variant: ContractDocumentVariant,
  model: ContractGenerationModel,
  fontBytes?: ContractFontBytes,
): Promise<PdfBuildResult> => {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts = await loadEmbeddedFonts(pdf, fontBytes);
  const widthCache: FontWidthCache = new WeakMap();
  const anchors: ContractFieldAnchor[] = [];
  let page: PDFPage;
  let cursorY = 0;
  let anchorIndex = 0;

  const newPage = () => {
    page = pdf.addPage([CONTRACT_TEMPLATE_WIDTH, CONTRACT_TEMPLATE_HEIGHT]);
    cursorY = CONTRACT_TEMPLATE_HEIGHT - CONTRACT_TEMPLATE_MARGIN;
    return page;
  };

  const ensureSpace = (height: number) => {
    if (cursorY - height < CONTRACT_TEMPLATE_MARGIN) newPage();
  };

  const addAnchor = (
    fieldKey: ContractTemplateFieldKey | undefined,
    x: number,
    top: number,
    width: number,
    height: number,
  ) => {
    if (!fieldKey) return;
    anchorIndex += 1;
    anchors.push({
      id: `${fieldKey}-${anchorIndex}`,
      fieldKey,
      pageNumber: pdf.getPageCount(),
      x,
      top,
      width,
      height,
    });
  };

  const drawParagraph = (block: ResolvedParagraph) => {
    const tokens = paragraphTokens(block.style);
    const width = CONTRACT_TEMPLATE_WIDTH - CONTRACT_TEMPLATE_MARGIN * 2;
    const lines = wrapText(block.text, width, tokens.size, fonts, tokens.bold, widthCache);
    cursorY -= tokens.before;
    let chunkTop = CONTRACT_TEMPLATE_HEIGHT - cursorY;
    let chunkHeight = 0;
    lines.forEach((line) => {
      if (cursorY - tokens.lineHeight < CONTRACT_TEMPLATE_MARGIN) {
        if (chunkHeight) addAnchor(block.fieldKey, CONTRACT_TEMPLATE_MARGIN, chunkTop, width, chunkHeight);
        newPage();
        chunkTop = CONTRACT_TEMPLATE_HEIGHT - cursorY;
        chunkHeight = 0;
      }
      const lineWidth = textWidth(line, tokens.size, fonts, tokens.bold, widthCache);
      const x = block.align === 'center'
        ? Math.max(CONTRACT_TEMPLATE_MARGIN, (CONTRACT_TEMPLATE_WIDTH - lineWidth) / 2)
        : CONTRACT_TEMPLATE_MARGIN;
      cursorY -= tokens.lineHeight;
      drawMixedLine(page, line, x, cursorY + (tokens.lineHeight - tokens.size) * 0.55, tokens.size, fonts, tokens.bold);
      chunkHeight += tokens.lineHeight;
    });
    if (chunkHeight) addAnchor(block.fieldKey, CONTRACT_TEMPLATE_MARGIN, chunkTop, width, chunkHeight);
    cursorY -= tokens.after;
  };

  const drawTable = (block: ResolvedTable) => {
    const x = CONTRACT_TEMPLATE_MARGIN;
    const totalWidth = CONTRACT_TEMPLATE_WIDTH - CONTRACT_TEMPLATE_MARGIN * 2;
    const labelWidth = 132;
    const valueWidth = totalWidth - labelWidth;
    const size = 10.5;
    const lineHeight = 13.125;
    const paddingX = 7;
    const paddingY = 6;
    block.rows.forEach((row) => {
      const labelLines = wrapText(row.label, labelWidth - paddingX * 2, size, fonts, true, widthCache);
      const displayValue = row.value || (variant === 'DRAFT' && !row.optional ? '待填写' : '');
      const valueLines = wrapText(displayValue, valueWidth - paddingX * 2, size, fonts, false, widthCache);
      const lineCount = Math.max(1, labelLines.length, valueLines.length);
      const height = lineCount * lineHeight + paddingY * 2;
      ensureSpace(height + 1);
      const bottom = cursorY - height;
      page.drawRectangle({
        x,
        y: bottom,
        width: labelWidth,
        height,
        color: rgb(0.969, 0.973, 0.98),
        borderColor: rgb(0.847, 0.863, 0.894),
        borderWidth: 0.5,
      });
      page.drawRectangle({
        x: x + labelWidth,
        y: bottom,
        width: valueWidth,
        height,
        borderColor: rgb(0.847, 0.863, 0.894),
        borderWidth: 0.5,
      });
      labelLines.forEach((line, index) => {
        drawMixedLine(page, line, x + paddingX, cursorY - paddingY - size - index * lineHeight, size, fonts, true);
      });
      valueLines.forEach((line, index) => {
        drawMixedLine(
          page,
          line,
          x + labelWidth + paddingX,
          cursorY - paddingY - size - index * lineHeight,
          size,
          fonts,
          false,
          displayValue === '待填写' ? rgb(0.48, 0.5, 0.54) : rgb(0.125, 0.141, 0.169),
        );
      });
      addAnchor(row.fieldKey, x + labelWidth, CONTRACT_TEMPLATE_HEIGHT - cursorY, valueWidth, height);
      cursorY = bottom;
    });
    cursorY -= 10;
  };

  const drawSignature = (block: ResolvedSignature) => {
    const totalWidth = CONTRACT_TEMPLATE_WIDTH - CONTRACT_TEMPLATE_MARGIN * 2;
    const gap = 20;
    const columnWidth = (totalWidth - gap) / 2;
    ensureSpace(260);
    const top = cursorY;
    const parties = [
      {
        x: CONTRACT_TEMPLATE_MARGIN,
        party: `For and on behalf of ${block.advertiser}`,
        name: block.advertiser,
        title: 'Influencer Manager',
        address: 'Unit 04-05, 16th Floor, The Broadway No. 54-62 Lockhart Road, Wanchai, Hong Kong',
      },
      {
        x: CONTRACT_TEMPLATE_MARGIN + columnWidth + gap,
        party: `For and on behalf of ${block.publisher}`,
        name: block.publisher,
        title: '',
        address: block.publisherAddress,
      },
    ];
    parties.forEach((party, partyIndex) => {
      const partyLines = wrapText(party.party, columnWidth, 10.5, fonts, true, widthCache);
      partyLines.forEach((line, index) => drawMixedLine(page, line, party.x, top - 14 - index * 13.125, 10.5, fonts, true));
      const details = [
        ['Name', party.name],
        ['Title', party.title],
        ['Address', party.address],
      ];
      let detailY = top - 54;
      details.forEach(([label, value]) => {
        drawMixedLine(page, `${label}:`, party.x, detailY, 10.5, fonts, true);
        const lines = wrapText(value, columnWidth - 54, 10.5, fonts, false, widthCache);
        lines.forEach((line, index) => drawMixedLine(page, line, party.x + 54, detailY - index * 13.125, 10.5, fonts));
        detailY -= Math.max(28, lines.length * 13.125 + 8);
      });
      ['Signature', 'Date'].forEach((label) => {
        drawMixedLine(page, `${label}:`, party.x, detailY, 10.5, fonts, true);
        page.drawLine({
          start: { x: party.x + 62, y: detailY - 2 },
          end: { x: party.x + columnWidth, y: detailY - 2 },
          thickness: 0.65,
          color: rgb(0.36, 0.38, 0.42),
        });
        detailY -= 36;
      });
      addAnchor(
        partyIndex ? 'publisher' : 'signature',
        party.x,
        CONTRACT_TEMPLATE_HEIGHT - top,
        columnWidth,
        top - detailY,
      );
    });
    cursorY -= 260;
  };

  prepared.pages.forEach((logicalPage) => {
    newPage();
    logicalPage.blocks.forEach((block) => {
      if (block.type === 'paragraph') drawParagraph(block);
      else if (block.type === 'table') drawTable(block);
      else drawSignature(block);
    });
  });

  pdf.getPages().forEach((pdfPage, index) => {
    if (variant === 'DRAFT') {
      pdfPage.drawText('DRAFT', {
        x: 145,
        y: 330,
        size: 52,
        font: fonts.bold.latin,
        color: rgb(0.72, 0.74, 0.78),
        opacity: 0.18,
        rotate: degrees(32),
      });
      pdfPage.drawText('草稿', {
        x: 310,
        y: 435,
        size: 34,
        font: fonts.bold.chinese,
        color: rgb(0.72, 0.74, 0.78),
        opacity: 0.18,
        rotate: degrees(32),
      });
    }
    const pageNumber = `${index + 1} / ${pdf.getPageCount()}`;
    const pageNumberWidth = fonts.regular.latin.widthOfTextAtSize(pageNumber, 8.5);
    pdfPage.drawText(pageNumber, {
      x: (CONTRACT_TEMPLATE_WIDTH - pageNumberWidth) / 2,
      y: 24,
      size: 8.5,
      font: fonts.regular.latin,
      color: rgb(0.46, 0.49, 0.54),
    });
  });

  pdf.setTitle(`${model.contractNumber} ${model.projectName}`);
  pdf.setAuthor('COMETS Pay');
  pdf.setSubject(variant === 'DRAFT' ? 'Generated contract draft' : 'Generated contract');
  pdf.setCreator('COMETS Pay local prototype');
  const bytes = await pdf.save();
  const pdfBlob = new Blob(
    [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer],
    { type: 'application/pdf' },
  );
  return {
    pdfBlob,
    pageCount: pdf.getPageCount(),
    anchors,
    qualityReport: prepared.qualityReport,
  };
};

const docxRun = (
  value: string,
  options: { bold?: boolean; size?: number; color?: string } = {},
) => new TextRun({
  text: value,
  bold: options.bold,
  size: Math.round((options.size ?? 10.5) * 2),
  color: options.color ?? '20242B',
  font: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei' },
});

const docxParagraph = (block: ResolvedParagraph) => {
  const tokens = paragraphTokens(block.style);
  return new Paragraph({
    alignment: block.align === 'center'
      ? AlignmentType.CENTER
      : block.align === 'justify'
        ? AlignmentType.JUSTIFIED
        : AlignmentType.LEFT,
    spacing: {
      before: Math.round(tokens.before * 20),
      after: Math.round(tokens.after * 20),
      line: Math.round((tokens.lineHeight / tokens.size) * 240),
    },
    keepNext: block.style === 'title' || block.style === 'heading',
    children: [docxRun(block.text, { bold: tokens.bold, size: tokens.size })],
  });
};

const docxCellParagraphs = (value: string, bold = false) => (
  (value || '').split(/\r?\n/).map((line) => new Paragraph({
    spacing: { before: 0, after: 40, line: 300 },
    children: [docxRun(line, { bold })],
  }))
);

const docxCell = (value: string, width: number, bold = false, fill?: string) => new TableCell({
  width: { size: width, type: WidthType.DXA },
  verticalAlign: VerticalAlign.CENTER,
  margins: { top: 100, bottom: 100, left: 120, right: 120 },
  shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
  children: docxCellParagraphs(value, bold),
});

const docxTable = (
  rows: ResolvedTableRow[],
  variant: ContractDocumentVariant,
) => new Table({
  width: { size: DOCX_CONTENT_WIDTH, type: WidthType.DXA },
  columnWidths: [DOCX_LABEL_WIDTH, DOCX_VALUE_WIDTH],
  borders: {
    top: DOCX_BORDER,
    bottom: DOCX_BORDER,
    left: DOCX_BORDER,
    right: DOCX_BORDER,
    insideHorizontal: DOCX_BORDER,
    insideVertical: DOCX_BORDER,
  },
  rows: rows.map((row) => new TableRow({
    cantSplit: true,
    children: [
      docxCell(row.label, DOCX_LABEL_WIDTH, true, 'F7F8FA'),
      docxCell(row.value || (variant === 'DRAFT' && !row.optional ? '待填写' : ''), DOCX_VALUE_WIDTH),
    ],
  })),
});

const docxSignature = (block: ResolvedSignature) => {
  const signatureCell = (
    party: string,
    name: string,
    title: string,
    address: string,
    width: number,
  ) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 140, bottom: 140, left: 140, right: 140 },
    children: [
      new Paragraph({ spacing: { after: 160 }, children: [docxRun(party, { bold: true })] }),
      ...[
        ['Name', name],
        ['Title', title],
        ['Address', address],
      ].map(([label, value]) => new Paragraph({
        spacing: { after: 120, line: 300 },
        children: [docxRun(`${label}: `, { bold: true }), docxRun(value)],
      })),
      new Paragraph({
        spacing: { before: 260, after: 180 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 5, color: '666A73' } },
        children: [docxRun('Signature: ', { bold: true })],
      }),
      new Paragraph({
        spacing: { before: 140, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 5, color: '666A73' } },
        children: [docxRun('Date: ', { bold: true })],
      }),
    ],
  });
  const width = Math.floor(DOCX_CONTENT_WIDTH / 2);
  return new Table({
    width: { size: DOCX_CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [width, DOCX_CONTENT_WIDTH - width],
    borders: {
      top: DOCX_BORDER,
      bottom: DOCX_BORDER,
      left: DOCX_BORDER,
      right: DOCX_BORDER,
      insideHorizontal: DOCX_BORDER,
      insideVertical: DOCX_BORDER,
    },
    rows: [new TableRow({
      cantSplit: true,
      children: [
        signatureCell(
          `For and on behalf of ${block.advertiser}`,
          block.advertiser,
          'Influencer Manager',
          'Unit 04-05, 16th Floor, The Broadway No. 54-62 Lockhart Road, Wanchai, Hong Kong',
          width,
        ),
        signatureCell(
          `For and on behalf of ${block.publisher}`,
          block.publisher,
          '',
          block.publisherAddress,
          DOCX_CONTENT_WIDTH - width,
        ),
      ],
    })],
  });
};

const buildContractDocx = async (
  prepared: PreparedContractDocument,
  variant: ContractDocumentVariant,
  model: ContractGenerationModel,
) => {
  const children: FileChild[] = [];
  prepared.pages.forEach((page, pageIndex) => {
    page.blocks.forEach((block) => {
      if (block.type === 'paragraph') children.push(docxParagraph(block));
      else if (block.type === 'table') children.push(docxTable(block.rows, variant));
      else children.push(docxSignature(block));
    });
    if (pageIndex < prepared.pages.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  const header = variant === 'DRAFT'
    ? new Header({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 0 },
          children: [docxRun('DRAFT / 草稿', { bold: true, size: 22, color: 'C3C7CE' })],
        })],
      })
    : new Header({ children: [new Paragraph({ children: [] })] });
  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        docxRun('Page ', { size: 8.5, color: '767D89' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 17, color: '767D89', font: 'Arial' }),
      ],
    })],
  });
  const document = new DocxDocument({
    creator: 'COMETS Pay',
    title: `${model.contractNumber} ${model.projectName}`,
    description: variant === 'DRAFT'
      ? 'COMETS Pay local editable contract draft'
      : 'COMETS Pay local editable contract',
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei' },
            size: 21,
            color: '20242B',
          },
          paragraph: {
            spacing: { after: 120, line: 300 },
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: A4_DXA_WIDTH, height: A4_DXA_HEIGHT },
          margin: {
            top: A4_DXA_MARGIN,
            right: A4_DXA_MARGIN,
            bottom: A4_DXA_MARGIN,
            left: A4_DXA_MARGIN,
            header: 600,
            footer: 600,
          },
        },
      },
      headers: { default: header },
      footers: { default: footer },
      children,
    }],
  });
  return Packer.toBlob(document);
};

export const generateContractPdf = async (
  model: ContractGenerationModel,
  sourceBytes?: ArrayBuffer,
  fontBytes?: ContractFontBytes,
  variant: ContractDocumentVariant = 'FORMAL',
) => {
  const templateBytes = sourceBytes ?? await loadBytes(CONTRACT_TEMPLATE_URL);
  const prepared = await prepareContractDocument(model, variant, templateBytes);
  return (await buildContractPdf(prepared, variant, model, fontBytes)).pdfBlob;
};

export const generateContractDocx = async (
  model: ContractGenerationModel,
  sourceBytes?: ArrayBuffer,
  variant: ContractDocumentVariant = 'FORMAL',
) => {
  const templateBytes = sourceBytes ?? await loadBytes(CONTRACT_TEMPLATE_URL);
  const prepared = await prepareContractDocument(model, variant, templateBytes);
  return buildContractDocx(prepared, variant, model);
};

export const generateContractPreview = async (
  model: ContractGenerationModel,
  variant: ContractDocumentVariant = 'DRAFT',
) => {
  const templateBytes = await loadBytes(CONTRACT_TEMPLATE_URL);
  const prepared = await prepareContractDocument(model, variant, templateBytes);
  return buildContractPdf(prepared, variant, model);
};

export const generateContractFiles = async (
  model: ContractGenerationModel,
  options: { variant?: ContractDocumentVariant } = {},
): Promise<ContractGeneratedFiles> => {
  const variant = options.variant ?? 'FORMAL';
  const templateBytes = await loadBytes(CONTRACT_TEMPLATE_URL);
  const prepared = await prepareContractDocument(model, variant, templateBytes);
  if (variant === 'FORMAL' && prepared.qualityReport.hasBlockers) {
    const firstBlocker = prepared.qualityReport.issues.find((issue) => issue.severity === 'BLOCKER');
    throw new Error(firstBlocker?.message ?? '合同存在未完成的必需字段，不能生成正式文件。');
  }
  const [pdfResult, docxBlob] = await Promise.all([
    buildContractPdf(prepared, variant, model),
    buildContractDocx(prepared, variant, model),
  ]);
  return {
    variant,
    pdfBlob: pdfResult.pdfBlob,
    docxBlob,
    pageCount: pdfResult.pageCount,
    anchors: pdfResult.anchors,
    qualityReport: pdfResult.qualityReport,
  };
};

export const CONTRACT_GENERATION_STYLE = CONTRACT_TEMPLATE_DEFINITION;
