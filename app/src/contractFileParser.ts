import type { ContractFieldReview } from './contracts';

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const decodePdfString = (value: string) => value
  .replace(/\\([()\\])/g, '$1')
  .replace(/\\n/g, '\n')
  .replace(/\\r/g, '\r')
  .replace(/\\t/g, '\t')
  .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)));

const textFromPdfContent = (content: string) => {
  const parts: string[] = [];
  for (const match of content.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(decodePdfString(match[1]));
  for (const match of content.matchAll(/\[((?:.|\n|\r)*?)\]\s*TJ/g)) {
    for (const literal of match[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)) parts.push(decodePdfString(literal[1]));
  }
  return parts.join('\n');
};

const inflate = async (bytes: Uint8Array, format: 'deflate' | 'deflate-raw') => {
  const buffer = new Uint8Array(bytes).buffer as ArrayBuffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const extractPdfText = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoder = new TextDecoder('latin1');
  const source = decoder.decode(bytes);
  const textParts = [textFromPdfContent(source)];
  for (const match of source.matchAll(/stream\r?\n/g)) {
    const start = (match.index ?? 0) + match[0].length;
    const end = source.indexOf('endstream', start);
    if (end < 0 || !/FlateDecode/.test(source.slice(Math.max(0, (match.index ?? 0) - 400), match.index))) continue;
    try {
      textParts.push(textFromPdfContent(decoder.decode(await inflate(bytes.slice(start, end), 'deflate'))));
    } catch {
      // Scanned, encrypted and unsupported PDF streams remain available for manual review.
    }
  }
  return textParts.flatMap((part) => part.split(/\r?\n/)).map(normalizeText).filter(Boolean).join('\n');
};

const extractDocxText = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let endOffset = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      endOffset = index;
      break;
    }
  }
  if (endOffset < 0) throw new Error('不是有效的 DOCX 文件');
  const entryCount = view.getUint16(endOffset + 10, true);
  let directoryOffset = view.getUint32(endOffset + 16, true);
  const decoder = new TextDecoder();
  let xmlText = '';
  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(directoryOffset, true) !== 0x02014b50) break;
    const method = view.getUint16(directoryOffset + 10, true);
    const compressedSize = view.getUint32(directoryOffset + 20, true);
    const nameLength = view.getUint16(directoryOffset + 28, true);
    const extraLength = view.getUint16(directoryOffset + 30, true);
    const commentLength = view.getUint16(directoryOffset + 32, true);
    const localOffset = view.getUint32(directoryOffset + 42, true);
    const name = decoder.decode(bytes.subarray(directoryOffset + 46, directoryOffset + 46 + nameLength));
    if (name === 'word/document.xml') {
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
      if (method === 0) xmlText = decoder.decode(compressed);
      else if (method === 8) xmlText = decoder.decode(await inflate(compressed, 'deflate-raw'));
      else throw new Error('暂不支持该 DOCX 压缩格式');
      break;
    }
    directoryOffset += 46 + nameLength + extraLength + commentLength;
  }
  if (!xmlText) throw new Error('DOCX 文件缺少正文');
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('DOCX 正文 XML 无法解析');
  return [...xml.getElementsByTagName('*')]
    .filter((node) => node.localName === 'p')
    .map((paragraph) => [...paragraph.getElementsByTagName('*')]
      .filter((node) => node.localName === 't')
      .map((node) => node.textContent ?? '')
      .join(''))
    .map(normalizeText)
    .filter(Boolean)
    .join('\n');
};

const findLabeledValue = (text: string, aliases: string[]) => {
  const aliasSet = new Set(aliases.map((alias) => alias.toLocaleLowerCase()));
  for (const line of text.split(/\r?\n/).map(normalizeText)) {
    const separator = line.search(/[:：]/);
    if (separator < 0) continue;
    const label = normalizeText(line.slice(0, separator)).toLocaleLowerCase();
    const value = normalizeText(line.slice(separator + 1));
    if (aliasSet.has(label) && value) return value;
  }
  return '';
};

const FIELD_DEFINITIONS: Array<Omit<ContractFieldReview, 'value' | 'source'> & { aliases: string[] }> = [
  { key: 'advertiser', label: 'Advertiser', required: true, aliases: ['Advertiser', 'Client', 'Company', '广告主', '客户', '甲方'] },
  { key: 'publisher', label: 'Publisher', required: true, aliases: ['Publisher', 'Creator', 'Influencer', '发布方', '达人', '创作者', '乙方'] },
  { key: 'ioId', label: 'IO 编号', required: false, aliases: ['IO Number', 'IO No.', 'Insertion Order Number', 'IO 编号', '订单编号'] },
  { key: 'currency', label: '币种', required: true, aliases: ['Currency', '币种'] },
  { key: 'totalFee', label: '项目总费用', required: true, aliases: ['Project Total Fees', 'Total Fees', 'Contract Amount', 'Service Fee', '项目总费用'] },
  { key: 'paymentTerm', label: '付款期限', required: true, aliases: ['Payment Term', 'Payment Terms', '付款期限', '付款条款'] },
];

export type ContractParseResult = {
  fields: ContractFieldReview[];
  note?: string;
};

export const parseContractFile = async (
  file: File,
  creatorName: string,
): Promise<ContractParseResult> => {
  let text = '';
  let note: string | undefined;
  if (/\.docx$/i.test(file.name)) text = await extractDocxText(file);
  else if (/\.pdf$/i.test(file.name)) text = await extractPdfText(file);
  else note = '旧版 DOC 文件无法在浏览器中可靠解析，已保留原文件供下载查看，请人工补充字段。';
  const fields = FIELD_DEFINITIONS.map(({ aliases, ...definition }) => {
    const extracted = findLabeledValue(text, aliases);
    const value = definition.key === 'publisher' ? (extracted || creatorName) : extracted;
    return {
      ...definition,
      value,
      source: extracted ? '合同文件 · 本地提取' : definition.key === 'publisher' ? '项目达人关联' : '未识别',
    };
  });
  if (!text && !note) note = '未从文件中提取到可识别文本，可能是扫描件、加密文件或使用了不支持的编码，请人工补充字段。';
  return { fields, note };
};
