/// <reference lib="webworker" />

import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import {
  GlobalWorkerOptions,
  getDocument,
} from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type {
  ContractDocumentType,
  ContractParserRequest,
  ContractParserResponse,
  ContractTextBlock,
  ContractTextItem,
  ParsedContractDocument,
} from './contractRecognitionTypes';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const workerScope = typeof self === 'undefined'
  ? null
  : self as unknown as DedicatedWorkerGlobalScope;

const normalizeText = (value: string) => value
  .replace(/[\u0000-\u001f\u007f]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const headingPattern = /^(?:[·•]\s*)?(?:standard terms(?: and conditions for digital marketing services)?|insertion order|campaign details|services\s*\/?\s*deliverables|payments?, taxes and costs|payment terms?|bank details|signature|advertiser|publisher|purpose|合同摘要|付款条款|项目详情|签署页)\s*:?\s*$/i;

const isHeading = (text: string) => (
  headingPattern.test(text)
  || (text.length <= 80 && /^\d{1,2}\.\s+[A-Z][A-Za-z\s,/&-]{2,45}\.?$/.test(text))
  || (text.length <= 80 && /^[A-Z][A-Z\s/&-]{4,}$/.test(text))
  || (text.length <= 80 && /^第[一二三四五六七八九十\d]+[章节条]$/.test(text))
);

const inferBlockDocumentType = (
  text: string,
  current: ContractDocumentType,
): ContractDocumentType => {
  const compact = text.replace(/\s+/g, '');
  if (/^insertionorder$/i.test(compact)) return 'IO';
  if (/^standardterms(?:andconditionsfordigitalmarketingservices)?$/i.test(compact.replace(/^[·•]/, ''))) {
    return 'STANDARD_TERMS';
  }
  return current;
};

const detectTemplate = (blocks: ContractTextBlock[]) => {
  const normalized = blocks.map((block) => block.text).join('\n');
  const compact = normalized.replace(/\s+/g, '');
  const headings = [
    'Standard Terms And Conditions For Digital Marketing Services',
    'Insertion Order',
    'Campaign Details',
    'Services/Deliverables',
    'Project Total Fees',
  ];
  const matchedHeadings = headings.filter((heading) => {
    const compactHeading = heading.replace(/\s+/g, '');
    return compact.toLocaleLowerCase().includes(compactHeading.toLocaleLowerCase());
  });
  const ioBlock = blocks.find((block) => /^InsertionOrder$/i.test(block.text.replace(/\s+/g, '')));
  return {
    matched: matchedHeadings.length >= 4,
    templateKey: matchedHeadings.length >= 4
      ? 'COMETS_DIGITAL_MARKETING_SINGLE_CAMPAIGN' as const
      : 'UNKNOWN' as const,
    confidence: matchedHeadings.length / headings.length,
    matchedHeadings,
    ioStartPage: ioBlock?.pageNumber ?? null,
  };
};

const emptyTemplateMatch = {
  matched: false,
  templateKey: 'UNKNOWN' as const,
  confidence: 0,
  matchedHeadings: [],
  ioStartPage: null,
};

const inferDocumentType = (fileName: string, text: string, selected: ContractDocumentType) => {
  if (selected !== 'OTHER') return selected;
  const sample = `${fileName}\n${text.slice(0, 2000)}`;
  if (/payment\s*(?:addendum|supplement)|付款补充/i.test(sample)) return 'PAYMENT_ADDENDUM';
  if (/signature|signed|execution page|签署页|签字页/i.test(sample)) return 'SIGNATURE_PAGE';
  if (/\bIO\b|insertion order|campaign details|投放订单/i.test(sample)) return 'IO';
  if (/standard terms|master agreement|主协议|标准条款/i.test(sample)) return 'STANDARD_TERMS';
  return 'OTHER';
};

const joinPdfLine = (items: ContractTextItem[]) => {
  const ordered = [...items].sort((left, right) => left.x - right.x);
  let result = '';
  let previousEnd = 0;
  for (const item of ordered) {
    const gap = item.x - previousEnd;
    const latinWordBoundary = /[A-Za-z0-9)\]"”]$/.test(result) && /^[A-Za-z0-9[(“"]/.test(item.text);
    result += result && (gap > Math.max(3, item.height * 0.25) || latinWordBoundary)
      ? ` ${item.text}`
      : item.text;
    previousEnd = item.x + item.width;
  }
  return normalizeText(result);
};

export const parsePdf = async (
  id: string,
  fileName: string,
  mimeType: string,
  selectedType: ContractDocumentType,
  buffer: ArrayBuffer,
): Promise<ParsedContractDocument> => {
  try {
    const loadingTask = getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useWorkerFetch: false,
    });
    const pdf = await loadingTask.promise;
    const blocks: ContractTextBlock[] = [];
    let currentSection = '正文';
    let currentDocumentType: ContractDocumentType = selectedType === 'OTHER' ? 'STANDARD_TERMS' : selectedType;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items
        .filter((item): item is TextItem => 'str' in item && Boolean(normalizeText(item.str)))
        .map<ContractTextItem>((item) => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: Math.abs(item.height || item.transform[3] || 10),
        }));
      const lines: ContractTextItem[][] = [];
      for (const item of [...items].sort((left, right) => right.y - left.y || left.x - right.x)) {
        const line = lines.find((candidate) => (
          Math.abs((candidate[0]?.y ?? item.y) - item.y) <= Math.max(2.5, item.height * 0.35)
        ));
        if (line) line.push(item);
        else lines.push([item]);
      }
      lines.sort((left, right) => (right[0]?.y ?? 0) - (left[0]?.y ?? 0));
      lines.forEach((line, lineIndex) => {
        const text = joinPdfLine(line);
        if (!text) return;
        const heading = isHeading(text);
        currentDocumentType = inferBlockDocumentType(text, currentDocumentType);
        if (heading) currentSection = text.replace(/^[·•]\s*/, '').replace(/:$/, '').trim();
        const ordered = [...line].sort((left, right) => left.x - right.x);
        const largeGapCount = ordered.slice(1).filter((item, index) => (
          item.x - (ordered[index].x + ordered[index].width) > Math.max(24, item.height * 2)
        )).length;
        blocks.push({
          id: `${id}-page-${pageNumber}-line-${lineIndex + 1}`,
          pageNumber,
          section: currentSection,
          documentType: currentDocumentType,
          text,
          items: ordered,
          kind: heading ? 'heading' : largeGapCount >= 2 ? 'table-row' : 'paragraph',
        });
      });
    }

    const plainText = blocks.map((block) => block.text).join('\n');
    return {
      id,
      fileName,
      mimeType,
      documentType: inferDocumentType(fileName, plainText, selectedType),
      parseStatus: plainText.trim() ? 'parsed' : 'scanned',
      pageCount: pdf.numPages,
      blocks,
      templateMatch: detectTemplate(blocks),
      errorMessage: plainText.trim()
        ? undefined
        : '该文件可能是扫描件，暂不支持自动识别，请手动填写',
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    const message = error instanceof Error ? error.message : String(error);
    const encrypted = name === 'PasswordException' || /password|encrypted/i.test(message);
    return {
      id,
      fileName,
      mimeType,
      documentType: selectedType,
      parseStatus: encrypted ? 'encrypted' : 'corrupt',
      pageCount: null,
      blocks: [],
      templateMatch: emptyTemplateMatch,
      errorMessage: encrypted ? 'PDF 已加密，暂不支持自动识别' : 'PDF 文件损坏或格式不受支持',
    };
  }
};

type OrderedXmlNode = Record<string, unknown>;

const textFromXmlNode = (node: unknown): string => {
  if (Array.isArray(node)) return node.map(textFromXmlNode).join('');
  if (!node || typeof node !== 'object') return '';
  const record = node as OrderedXmlNode;
  if (typeof record['#text'] === 'string') return record['#text'];
  return Object.entries(record)
    .filter(([key]) => !key.startsWith(':@'))
    .map(([, value]) => textFromXmlNode(value))
    .join('');
};

const findXmlChildren = (node: unknown, key: string): unknown[] => {
  if (Array.isArray(node)) {
    return node.flatMap((child) => findXmlChildren(child, key));
  }
  if (!node || typeof node !== 'object') return [];
  const record = node as OrderedXmlNode;
  return Object.entries(record).flatMap(([entryKey, value]) => (
    entryKey === key
      ? Array.isArray(value) ? value : [value]
      : entryKey.startsWith(':@') ? [] : findXmlChildren(value, key)
  ));
};

const directXmlElementContents = (nodes: unknown, key: string): unknown[][] => {
  if (!Array.isArray(nodes)) return [];
  return nodes.flatMap((node) => {
    if (!node || typeof node !== 'object') return [];
    const value = (node as OrderedXmlNode)[key];
    return Array.isArray(value) ? [value] : [];
  });
};

const paragraphStyle = (node: unknown) => {
  const styles = findXmlChildren(node, 'pStyle');
  for (const style of styles) {
    if (!style || typeof style !== 'object') continue;
    const attributes = (style as OrderedXmlNode)[':@'];
    if (attributes && typeof attributes === 'object') {
      const value = (attributes as Record<string, unknown>)['@_val'];
      if (typeof value === 'string') return value;
    }
  }
  return '';
};

const findBodyChildren = (node: unknown): unknown[] => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = findBodyChildren(child);
      if (result.length) return result;
    }
    return [];
  }
  if (!node || typeof node !== 'object') return [];
  const record = node as OrderedXmlNode;
  if (Array.isArray(record.body)) return record.body;
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith(':@')) continue;
    const result = findBodyChildren(value);
    if (result.length) return result;
  }
  return [];
};

export const parseDocx = async (
  id: string,
  fileName: string,
  mimeType: string,
  selectedType: ContractDocumentType,
  buffer: ArrayBuffer,
): Promise<ParsedContractDocument> => {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const documentEntry = zip.file('word/document.xml');
    if (!documentEntry) throw new Error('DOCX 缺少 word/document.xml');
    const xml = await documentEntry.async('string');
    const parser = new XMLParser({
      ignoreAttributes: false,
      preserveOrder: true,
      removeNSPrefix: true,
      trimValues: false,
    });
    const ordered = parser.parse(xml) as unknown[];
    const bodyChildren = findBodyChildren(ordered);
    const blocks: ContractTextBlock[] = [];
    let currentSection = '正文';
    let currentDocumentType: ContractDocumentType = selectedType === 'OTHER' ? 'STANDARD_TERMS' : selectedType;

    bodyChildren.forEach((child, childIndex) => {
      if (!child || typeof child !== 'object') return;
      const record = child as OrderedXmlNode;
      if (record.p) {
        const text = normalizeText(textFromXmlNode(record.p));
        if (!text) return;
        const style = paragraphStyle(record.p);
        const heading = /^heading|title/i.test(style) || isHeading(text);
        currentDocumentType = inferBlockDocumentType(text, currentDocumentType);
        if (heading) currentSection = text.replace(/^[·•]\s*/, '').replace(/:$/, '').trim();
        blocks.push({
          id: `${id}-paragraph-${childIndex + 1}`,
          pageNumber: null,
          section: currentSection,
          documentType: currentDocumentType,
          text,
          items: [],
          kind: heading ? 'heading' : 'paragraph',
        });
        return;
      }
      if (record.tbl) {
        const rows = directXmlElementContents(record.tbl, 'tr');
        rows.forEach((row, rowIndex) => {
          const cells = directXmlElementContents(row, 'tc')
            .map((cell) => normalizeText(textFromXmlNode(cell)))
            .filter(Boolean);
          if (!cells.length) return;
          blocks.push({
            id: `${id}-table-${childIndex + 1}-row-${rowIndex + 1}`,
            pageNumber: null,
            section: currentSection,
            documentType: currentDocumentType,
            text: cells.join(' | '),
            items: [],
            kind: 'table-row',
          });
        });
      }
    });

    const plainText = blocks.map((block) => block.text).join('\n');
    if (!plainText.trim()) throw new Error('DOCX 正文为空或无法读取');
    return {
      id,
      fileName,
      mimeType,
      documentType: inferDocumentType(fileName, plainText, selectedType),
      parseStatus: 'parsed',
      pageCount: null,
      blocks,
      templateMatch: detectTemplate(blocks),
    };
  } catch {
    return {
      id,
      fileName,
      mimeType,
      documentType: selectedType,
      parseStatus: 'corrupt',
      pageCount: null,
      blocks: [],
      templateMatch: emptyTemplateMatch,
      errorMessage: 'DOCX 文件损坏、为空或不是标准 Open XML 文档',
    };
  }
};

workerScope?.addEventListener('message', async (event: MessageEvent<ContractParserRequest>) => {
  const { requestId, files } = event.data;
  try {
    const documents = await Promise.all(files.map((file) => (
      /\.pdf$/i.test(file.fileName)
        ? parsePdf(file.id, file.fileName, file.mimeType, file.documentType, file.buffer)
        : parseDocx(file.id, file.fileName, file.mimeType, file.documentType, file.buffer)
    )));
    const response: ContractParserResponse = { requestId, ok: true, documents };
    workerScope.postMessage(response);
  } catch (error) {
    const response: ContractParserResponse = {
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : '合同解析失败',
    };
    workerScope.postMessage(response);
  }
});
