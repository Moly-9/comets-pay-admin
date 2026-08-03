import {
  CONTRACT_FIELD_LABELS,
  type ContractDocumentType,
  type ContractFieldCandidate,
  type ContractFieldKey,
  type ContractFieldStatus,
  type ContractRecognitionContext,
  type ContractRecognitionField,
  type ContractRecognitionResult,
  type ContractSourceLocation,
  type ContractTextBlock,
  type ParsedContractDocument,
  type StructuredContractDeliverable,
  type StructuredContractObligation,
} from './contractRecognitionTypes';

type AliasDefinition = {
  aliases: string[];
  confidence?: number;
};

const ALIASES: Record<ContractFieldKey, AliasDefinition> = {
  advertiser: { aliases: ['Advertiser', 'Client', 'Brand Party', 'Company', '广告主', '客户', '品牌方', '甲方'] },
  publisher: { aliases: ['Publisher', 'Creator', 'Influencer', 'Service Provider', '发布方', '达人', '创作者', '服务提供方', '乙方'] },
  contractNumber: { aliases: ['Contract Number', 'Contract No.', 'Contract No', 'Agreement Number', 'Agreement ID', '合同编号', '协议编号'] },
  ioNumber: { aliases: ['IO Number', 'IO No.', 'IO No', 'Insertion Order Number', 'Order Number', 'IO 编号', '订单编号', '投放订单号'] },
  projectName: { aliases: ['Project Name', 'Campaign Name', '推广项目', '项目名称', '活动名称'] },
  brandName: { aliases: ['Brand Name', 'Brand', '品牌名称', '品牌'] },
  platform: { aliases: ['Publishing Platform', 'Platform', '发布平台', '平台'] },
  channelName: { aliases: ['Service Provider Name', 'Channel Name', 'Channel', 'Handle', '频道名称', '频道', '账号'] },
  channelLink: { aliases: ['Channel Link', 'Channel URL', 'Profile URL', 'Homepage', '主页链接'] },
  effectiveDate: { aliases: ['Agreement Effective Date', 'Effective Date', '协议生效日', '生效日期'] },
  signatureStatus: { aliases: ['Signature Status', '签署状态'] },
  advertiserSignatureDate: { aliases: ['Advertiser Signature Date', 'Advertiser Date', '甲方签署日期'] },
  publisherSignatureDate: { aliases: ['Publisher Signature Date', 'Publisher Date', '乙方签署日期'] },
  campaignPeriod: { aliases: ['Campaign Period', 'Campaign Date', 'Service Period', '活动周期', '项目周期', '推广周期', '服务周期'] },
  projectTotalFees: { aliases: ['Project Total Fees', 'Total Fees', 'Contract Amount', 'Service Fee', '项目总费用', '合同金额', '服务费'] },
  currency: { aliases: ['Currency', '币种'] },
  invoiceIssuePeriod: { aliases: ['Invoice Issue Period', 'Invoice Submission Period', 'Invoice Due', 'Invoice 开具期限', 'Invoice 提交期限', '发票开具期限'] },
  paymentTerm: { aliases: ['Payment Terms', 'Payment Term', '付款期限', '付款条款'] },
  paymentMethod: { aliases: ['Payment Method', 'Method of Payment', '付款方式', '支付方式'] },
  transferFee: { aliases: ['Transfer Fee Bearer', 'Transfer Fee', 'Bank Charges', 'Wire transfer fees', 'Transaction Fee', '转账手续费', '银行手续费', '手续费承担'] },
  beneficiaryAccountName: { aliases: ['Beneficiary Account Name', 'Beneficiary Name', 'Account Name', '收款主体', '账户名称'] },
  bankName: { aliases: ['Beneficiary Bank Name', 'Bank Name', '收款银行', '银行名称'] },
  accountNumberLast4: { aliases: ['Account Number', 'Bank Account Number', '银行账号'] },
  swiftCode: { aliases: ['SWIFT Code', 'Swift Code', 'BIC', '银行国际代码'] },
  ibanLast4: { aliases: ['IBAN', 'IBAN Number'] },
  paypalUsername: { aliases: ['Paypal UserName', 'PayPal Username', 'PayPal Name'] },
  paypalEmail: { aliases: ['Paypal Email Address', 'PayPal Email'] },
  remittanceInformation: { aliases: ['Remittance Information', 'Transfer Note', '汇款附言', '汇款信息'] },
};

const START_DATE_ALIASES = ['Start Date', 'Campaign Start', 'Service Start Date', '开始日期', '活动开始日期'];
const END_DATE_ALIASES = ['End Date', 'Campaign End', 'Service End Date', '结束日期', '活动结束日期'];
const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'HKD', 'JPY', 'CNY', 'RMB', 'AUD', 'CAD', 'SGD', 'THB', 'BRL'];
const PLACEHOLDER_PATTERN = /(?:please\s+fill|example\s+only|\bxxx\b|\[\s*date\s*\]|_{3,}|-{4,}|youtube\.com\/x{3,}|\[\s*please\b|for\s+further\s+credit\s+to|模板占位|未填写|待填写|未选择)/i;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cleanValue = (value: string) => value
  .replace(/[\u0000-\u001f\u007f]+/g, ' ')
  .replace(/^[\s:：\-–—|]+/, '')
  .replace(/\s+/g, ' ')
  .trim();

export const isContractPlaceholder = (value: string) => {
  const normalized = cleanValue(value);
  return !normalized || PLACEHOLDER_PATTERN.test(normalized) || /^\[[^\]]+\]$/.test(normalized);
};

const normalizedKey = (value: unknown) => {
  if (value && typeof value === 'object') {
    const sorted = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((result, [key, item]) => ({ ...result, [key]: item }), {});
    return JSON.stringify(sorted).toLocaleLowerCase();
  }
  return String(value ?? '').trim().toLocaleLowerCase();
};

const sourceFor = (
  document: ParsedContractDocument,
  block: ContractTextBlock,
  sourceText = block.text,
): ContractSourceLocation => ({
  documentId: document.id,
  documentType: block.documentType ?? document.documentType,
  fileName: document.fileName,
  pageNumber: block.pageNumber,
  section: block.section,
  sourceText,
  blockId: block.id,
});

const matchLabeledValue = (text: string, aliases: string[]) => {
  const pattern = aliases.map(escapeRegExp).sort((left, right) => right.length - left.length).join('|');
  const match = text.match(new RegExp(`(?:^|[\\s|])(?:${pattern})\\s*(?::|：|[-–—]|\\|)\\s*(.+)$`, 'iu'));
  return cleanValue(match?.[1] ?? '');
};

const isStandaloneLabel = (text: string, aliases: string[]) => {
  const pattern = aliases.map(escapeRegExp).sort((left, right) => right.length - left.length).join('|');
  return new RegExp(`^(?:${pattern})\\s*(?::|：|[-–—]|\\|)?$`, 'iu').test(text.trim());
};

const allAliases = [
  ...Object.values(ALIASES).flatMap((definition) => definition.aliases),
  ...START_DATE_ALIASES,
  ...END_DATE_ALIASES,
  'Beneficiary bank address',
  'Beneficiary Bank Address',
  'Transfer Note',
  'Transfer Note (optional)',
  'Remittance Information (optional)',
];
const isAnyStandaloneLabel = (text: string) => isStandaloneLabel(text, [
  ...allAliases,
]);
const startsWithKnownLabel = (text: string) => allAliases.some((alias) => (
  new RegExp(`^${escapeRegExp(alias)}\\s*(?::|：|[-–—]|\\||$)`, 'iu').test(text.trim())
));

const candidate = (
  rawValue: string,
  normalizedValue: unknown,
  source: ContractSourceLocation,
  confidence: number,
): ContractFieldCandidate => ({
  rawValue: cleanValue(rawValue),
  normalizedValue,
  source,
  confidence,
  placeholder: isContractPlaceholder(rawValue),
});

const candidatesForAliases = (
  documents: ParsedContractDocument[],
  aliases: string[],
  normalize: (raw: string) => unknown = (raw) => raw,
  confidence = 0.9,
) => documents.flatMap((document) => (
  document.parseStatus !== 'parsed'
    ? []
    : document.blocks.flatMap((block, index) => {
      const directMatch = matchLabeledValue(block.text, aliases);
      const directValue = directMatch && !startsWithKnownLabel(directMatch) ? directMatch : '';
      const nextBlock = document.blocks[index + 1];
      const adjacentValue = !directValue
        && isStandaloneLabel(block.text, aliases)
        && nextBlock
        && nextBlock.pageNumber === block.pageNumber
        && nextBlock.kind !== 'heading'
        && !startsWithKnownLabel(nextBlock.text)
        && nextBlock.text.length <= 700
          ? cleanValue(nextBlock.text)
          : '';
      const blankPlaceholder = !directValue
        && !adjacentValue
        && (isStandaloneLabel(block.text, aliases) || Boolean(directMatch))
          ? '未填写（模板占位）'
          : '';
      const rawValue = directValue || adjacentValue || blankPlaceholder;
      if (!rawValue) return [];
      return [candidate(
        rawValue,
        normalize(rawValue),
        adjacentValue || blankPlaceholder
          ? sourceFor(document, block, `${block.text} ${nextBlock?.text ?? ''}`.trim())
          : sourceFor(document, block),
        adjacentValue ? Math.min(confidence, 0.78) : blankPlaceholder ? 0.99 : confidence,
      )];
    })
));

const pageGroups = (document: ParsedContractDocument) => {
  const groups = new Map<number | null, ContractTextBlock[]>();
  document.blocks.forEach((block) => {
    const current = groups.get(block.pageNumber) ?? [];
    current.push(block);
    groups.set(block.pageNumber, current);
  });
  return Array.from(groups.values());
};

const candidatesFromPagePattern = (
  documents: ParsedContractDocument[],
  pattern: RegExp,
  normalize: (raw: string) => unknown = (raw) => raw,
  confidence = 0.88,
) => documents.flatMap((document) => {
  if (document.parseStatus !== 'parsed') return [];
  return pageGroups(document).flatMap((blocks) => {
    const text = blocks.map((block) => block.text).join(' ');
    const match = text.match(pattern);
    const raw = cleanValue(match?.[1] ?? '');
    if (!raw) return [];
    const block = blocks.find((item) => item.text.includes(raw.split(' ')[0])) ?? blocks[0];
    return block ? [candidate(raw, normalize(raw), sourceFor(document, block, match?.[0] ?? block.text), confidence)] : [];
  });
});

const parseEnglishDate = (value: string) => {
  const match = value.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(20\d{2})$/i);
  if (!match) return '';
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const month = months.indexOf(match[1].toLowerCase()) + 1;
  return `${match[3]}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
};

export const normalizeContractDate = (raw: string) => {
  const value = cleanValue(raw).replace(/[.]/g, '-');
  const iso = value.match(/\b(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})(?:日)?\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const english = value.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,\s+20\d{2}\b/i);
  return english ? parseEnglishDate(english[0]) : '';
};

export const normalizeCampaignPeriod = (raw: string) => {
  const parts = cleanValue(raw).split(/\s+(?:to|through|until|至|到|—|–)\s+/i);
  if (parts.length < 2) return { startDate: '', endDate: '' };
  return {
    startDate: normalizeContractDate(parts[0]),
    endDate: normalizeContractDate(parts.slice(1).join(' ')),
  };
};

export const normalizeMoney = (raw: string) => {
  const currency = raw.match(new RegExp(`\\b(${CURRENCY_CODES.join('|')})\\b`, 'i'))?.[1]?.toUpperCase() ?? '';
  const amountMatches = raw.replace(new RegExp(CURRENCY_CODES.join('|'), 'ig'), '').match(/(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g);
  const amountText = amountMatches?.[amountMatches.length - 1] ?? '';
  const amount = Number(amountText.replace(/,/g, ''));
  return { amount: Number.isFinite(amount) && amount > 0 ? amount : null, currency };
};

export const normalizeDays = (raw: string) => {
  if (/\[\s*\d+\s*\/\s*\d+\s*\]/.test(raw)) return null;
  const match = raw.match(/\b(?:net\s*)?(\d{1,3})\s*(?:working\s+|business\s+)?days?\b/i)
    ?? raw.match(/(\d{1,3})\s*(?:个)?(?:工作日|天|日)/);
  return match ? Number(match[1]) : null;
};

const normalizePaymentMethod = (raw: string) => {
  const methods: string[] = [];
  if (/airwallex/i.test(raw)) methods.push('AIRWALLEX');
  if (/paypal/i.test(raw)) methods.push('PAYPAL');
  if (/bank\s*(?:wire|transfer)|wire\s*transfer|银行转账|电汇/i.test(raw)) methods.push('BANK_TRANSFER');
  return methods.length === 1 ? methods[0] : methods;
};

const normalizeTransferFee = (raw: string) => {
  if (/borne\s+by\s+(?:the\s+)?advertiser|advertiser\s+(?:shall\s+)?(?:bear|pay)|由(?:广告主|甲方|付款方)承担/i.test(raw)) return 'ADVERTISER';
  if (/borne\s+by\s+(?:the\s+)?publisher|publisher\s+(?:shall\s+)?(?:bear|pay)|由(?:收款方|发布方|乙方|达人)承担/i.test(raw)) return 'PUBLISHER';
  if (/shared|jointly|each party|双方(?:共同|各自)承担/i.test(raw)) return 'SHARED';
  return '';
};

const lastFour = (raw: string) => raw.replace(/\s/g, '').slice(-4);
const maskedLastFour = (raw: string) => {
  const tail = lastFour(raw);
  return tail ? `•••• ${tail}` : '';
};

const documentPriority = (fieldKey: ContractFieldKey, type: ContractDocumentType) => {
  if (['ioNumber', 'projectName', 'brandName', 'platform', 'channelName', 'channelLink', 'campaignPeriod', 'projectTotalFees', 'currency'].includes(fieldKey)) {
    return type === 'IO' ? 60 : type === 'STANDARD_TERMS' ? 20 : 10;
  }
  if (['advertiser', 'publisher', 'effectiveDate', 'signatureStatus', 'advertiserSignatureDate', 'publisherSignatureDate'].includes(fieldKey)) {
    return type === 'STANDARD_TERMS' ? 60 : type === 'SIGNATURE_PAGE' ? 55 : type === 'IO' ? 40 : 10;
  }
  return type === 'PAYMENT_ADDENDUM' ? 70 : type === 'IO' ? 60 : type === 'STANDARD_TERMS' ? 50 : 10;
};

const sortCandidates = (fieldKey: ContractFieldKey, candidates: ContractFieldCandidate[]) => (
  [...candidates].sort((left, right) => (
    Number(right.source.documentId.startsWith('system-')) * 1000
    - Number(left.source.documentId.startsWith('system-')) * 1000
    || Number(left.placeholder) - Number(right.placeholder)
    || documentPriority(fieldKey, right.source.documentType) - documentPriority(fieldKey, left.source.documentType)
    || right.confidence - left.confidence
  ))
);

const fieldStatus = (selected: ContractFieldCandidate, candidates: ContractFieldCandidate[]): ContractFieldStatus => {
  if (/\[\s*(\d+)\s*\/\s*(\d+)\s*\]/.test(selected.rawValue)) return 'CONFLICT';
  if (selected.placeholder) return 'PLACEHOLDER';
  const valid = candidates.filter((item) => !item.placeholder);
  const values = new Set(valid.map((item) => normalizedKey(item.normalizedValue)).filter(Boolean));
  return values.size > 1 ? 'CONFLICT' : 'DETECTED';
};

const resultFromCandidates = (
  fieldKey: ContractFieldKey,
  candidates: ContractFieldCandidate[],
): ContractRecognitionField => {
  const sorted = sortCandidates(fieldKey, candidates);
  const selected = sorted[0];
  if (!selected) {
    return {
      fieldKey,
      label: CONTRACT_FIELD_LABELS[fieldKey],
      rawValue: '',
      normalizedValue: null,
      sourceText: '',
      pageNumber: null,
      section: '',
      source: null,
      confidence: 0,
      status: 'MISSING',
      candidates: [],
    };
  }
  return {
    fieldKey,
    label: CONTRACT_FIELD_LABELS[fieldKey],
    rawValue: selected.rawValue,
    originalDetectedValue: selected.rawValue,
    normalizedValue: selected.normalizedValue,
    sourceText: selected.source.sourceText,
    pageNumber: selected.source.pageNumber,
    section: selected.source.section,
    source: selected.source,
    confidence: selected.confidence,
    status: fieldStatus(selected, sorted),
    candidates: sorted,
  };
};

const systemCandidate = (
  kind: 'contract' | 'io',
  value: string,
): ContractFieldCandidate => candidate(value, value, {
  documentId: `system-${kind}`,
  documentType: kind === 'io' ? 'IO' : 'OTHER',
  fileName: '系统字段',
  pageNumber: null,
  section: kind === 'io' ? '系统 IO 资料' : '系统合同资料',
  sourceText: `${kind === 'io' ? '系统 IO 编号' : '系统合同编号'}：${value}`,
  blockId: `system-${kind}-number`,
}, 1);

const campaignCandidates = (documents: ParsedContractDocument[]) => {
  const direct = candidatesForAliases(documents, ALIASES.campaignPeriod.aliases, normalizeCampaignPeriod, 0.95);
  const split = documents.flatMap((document) => {
    if (document.parseStatus !== 'parsed') return [];
    const start = candidatesForAliases([document], START_DATE_ALIASES, normalizeContractDate, 0.9)[0];
    const end = candidatesForAliases([document], END_DATE_ALIASES, normalizeContractDate, 0.9)[0];
    if (!start && !end) return [];
    const raw = [start?.rawValue, end?.rawValue].filter(Boolean).join(' to ');
    return [candidate(raw, {
      startDate: String(start?.normalizedValue ?? ''),
      endDate: String(end?.normalizedValue ?? ''),
    }, start?.source ?? end!.source, 0.92)];
  });
  return [...direct, ...split].filter((item) => {
    const value = item.normalizedValue as { startDate?: string; endDate?: string };
    return item.placeholder || value.startDate || value.endDate;
  });
};

const signatureDateCandidates = (documents: ParsedContractDocument[], side: 'advertiser' | 'publisher') => documents.flatMap((document) => {
  if (document.parseStatus !== 'parsed') return [];
  return document.blocks.flatMap((block) => {
    if (!/Date\s*:/i.test(block.text) || !/20\d{2}/.test(block.text)) return [];
    const dates = [...block.text.matchAll(/(?:XXX|\d{4}[./-]\d{1,2}[./-]\d{1,2}|[A-Za-z]+\s+\d{1,2},\s+20\d{2})/gi)]
      .map((match) => match[0]);
    const value = dates[side === 'advertiser' ? 0 : 1] ?? dates[0];
    return value ? [candidate(value, normalizeContractDate(value), sourceFor(document, block), dates.length > 1 ? 0.92 : 0.7)] : [];
  });
});

const signatureStatusCandidates = (documents: ParsedContractDocument[]) => documents.flatMap((document) => {
  if (document.parseStatus !== 'parsed') return [];
  const signatureBlocks = document.blocks.filter((block) => /^\s*Signature\s*:|^\s*Signature_{2,}/i.test(block.text));
  if (!signatureBlocks.length) return [];
  const signedCount = signatureBlocks.filter((block) => !/_{3,}|Signature\s*:?\s*$/i.test(block.text)).length;
  const normalizedValue = signedCount >= 2 ? 'SIGNED' : signedCount === 1 ? 'PARTIALLY_SIGNED' : 'UNSIGNED';
  return [candidate(
    normalizedValue === 'SIGNED' ? '双方已签署' : normalizedValue === 'PARTIALLY_SIGNED' ? '部分签署' : '未签署（模板占位）',
    normalizedValue,
    sourceFor(document, signatureBlocks[0]),
    0.78,
  )];
});

const totalFeeCandidates = (documents: ParsedContractDocument[]) => candidatesForAliases(
  documents,
  ALIASES.projectTotalFees.aliases,
  normalizeMoney,
  0.95,
);

const currencyCandidates = (documents: ParsedContractDocument[], feeCandidates: ContractFieldCandidate[]) => [
  ...candidatesForAliases(documents, ALIASES.currency.aliases, (raw) => raw.toUpperCase(), 0.9),
  ...feeCandidates.flatMap((item) => {
    const currency = (item.normalizedValue as { currency?: string }).currency;
    return currency ? [candidate(currency, currency, item.source, item.confidence)] : [];
  }),
];

const accountCandidates = (
  documents: ParsedContractDocument[],
  fieldKey: 'accountNumberLast4' | 'ibanLast4',
) => candidatesForAliases(
  documents,
  ALIASES[fieldKey].aliases,
  lastFour,
  0.9,
).map((item) => {
  if (item.placeholder) {
    return {
      ...item,
      rawValue: '未填写（模板占位）',
      normalizedValue: '',
    };
  }
  const masked = maskedLastFour(item.rawValue);
  return {
    ...item,
    rawValue: masked,
    normalizedValue: lastFour(item.rawValue),
    source: {
      ...item.source,
      sourceText: item.source.sourceText.replace(item.rawValue, masked),
    },
  };
});

const inferredPaymentMethodCandidates = (
  bank: ContractFieldCandidate[],
  iban: ContractFieldCandidate[],
  paypalUser: ContractFieldCandidate[],
  paypalEmail: ContractFieldCandidate[],
) => {
  const result: ContractFieldCandidate[] = [];
  const bankSource = [...bank, ...iban].find((item) => !item.placeholder);
  const paypalSource = [...paypalUser, ...paypalEmail].find((item) => !item.placeholder);
  if (bankSource) result.push(candidate('Bank transfer', 'BANK_TRANSFER', bankSource.source, 0.88));
  if (paypalSource) result.push(candidate('PayPal', 'PAYPAL', paypalSource.source, 0.88));
  return result;
};

const transferFeeCandidates = (documents: ParsedContractDocument[]) => {
  const labeled = candidatesForAliases(documents, ALIASES.transferFee.aliases, normalizeTransferFee, 0.9)
    .filter((item) => Boolean(item.normalizedValue));
  const unselectedTemplate = documents.flatMap((document) => document.blocks.flatMap((block) => (
    /choose the following\s*\(\s*\)/i.test(block.text)
      ? [candidate('未选择（模板占位）', '', sourceFor(document, block), 0.95)]
      : []
  )));
  return [...labeled, ...unselectedTemplate];
};

const paymentTermCandidates = (documents: ParsedContractDocument[]) => {
  const labeled = candidatesForAliases(
    documents,
    ALIASES.paymentTerm.aliases,
    (raw) => ({ raw, normalizedDays: normalizeDays(raw) }),
    0.93,
  );
  const clauses = candidatesFromPagePattern(
    documents,
    /(within\s+\[\s*\d+\s*\/\s*\d+\s*\]\s+working\s+days[^.]*receipt\s+of\s+the\s+invoice)/i,
    (raw) => ({
      raw,
      normalizedDays: normalizeDays(raw),
      options: [...raw.matchAll(/\d+/g)].map((match) => Number(match[0])),
    }),
    0.96,
  );
  return [...labeled, ...clauses];
};

const invoiceIssueCandidates = (documents: ParsedContractDocument[]) => [
  ...candidatesForAliases(
    documents,
    ALIASES.invoiceIssuePeriod.aliases,
    (raw) => ({ raw, normalizedDays: normalizeDays(raw), normalizedDate: normalizeContractDate(raw) || null }),
    0.9,
  ),
  ...candidatesFromPagePattern(
    documents,
    /(within\s+\[?\s*\d+\s+working\s+days\]?\s+from\s+the\s+date\s+of\s+the\s+final\s+acceptance[^.]*)/i,
    (raw) => ({ raw, normalizedDays: normalizeDays(raw), normalizedDate: null }),
    0.94,
  ),
];

const templatePartyCandidates = (documents: ParsedContractDocument[], party: 'advertiser' | 'publisher') => {
  if (party === 'advertiser') {
    return [
      ...candidatesFromPagePattern(documents, /between\s+(.+?)\s*\(\s*["“]Advertiser["”]\s*\)/i, (raw) => raw, 0.94),
      ...candidatesFromPagePattern(documents, /and\s+\[?(.+?)\]?\s*\(\s*["“]Advertiser["”]\s*\)/i, (raw) => raw, 0.88),
    ];
  }
  return [
    ...candidatesFromPagePattern(documents, /and\s+(.+?)\s+on\s+behalf\s+of\s*\(.+?\)\s*\(\s*["“]Publisher["”]\s*\)/i, (raw) => raw, 0.94),
    ...candidatesFromPagePattern(documents, /between\s+\[?\s*(.+?)\s*\]?\s*\(\s*["“]Publisher["”]\s*\)\s+and/i, (raw) => raw, 0.9),
  ];
};

const deliverableDefinitions = [
  { type: 'SCRIPT' as const, title: '脚本初稿', pattern: /written script|script of initial ideas|脚本初稿/i },
  { type: 'DEDICATED_VIDEO' as const, title: 'Dedicated Video', pattern: /dedicated(?: landscape)? video/i },
  { type: 'INTEGRATED_VIDEO' as const, title: 'Integrated Video', pattern: /integrated video/i },
  { type: 'STREAM' as const, title: 'Stream', pattern: /\bstream(?:ing)?\b/i },
  { type: 'CTA' as const, title: 'CTA', pattern: /call-to-action|\bCTA\b/i },
  { type: 'TRACKLINK' as const, title: 'Tracklink', pattern: /tracklink|tracking link/i },
  { type: 'HASHTAG' as const, title: 'Hashtag', pattern: /hashtag|#[\w-]+/i },
  { type: 'ANALYTICS_SCREENSHOT' as const, title: '直播数据截图', pattern: /screenshots?.+analytics|analytics.+screenshots?/i },
  { type: 'CONTENT_REMOVAL' as const, title: '不利品牌内容删除', pattern: /unfavourable branding|detrimental.+reputation|delete the published|removal/i },
];

export const recognizeDeliverables = (documents: ParsedContractDocument[]): StructuredContractDeliverable[] => {
  const grouped = new Map<string, StructuredContractDeliverable>();
  documents.forEach((document) => {
    if (document.parseStatus !== 'parsed') return;
    document.blocks.forEach((block) => deliverableDefinitions.forEach((definition) => {
      if (!definition.pattern.test(block.text)) return;
      const key = `${document.id}-${block.documentType}-${definition.type}`;
      const platform = block.text.match(/\b(YouTube|TikTok|Twitch|Instagram|Facebook)\b/i)?.[1] ?? '';
      const format = /landscape/i.test(block.text) ? 'LANDSCAPE' : '';
      const duration = block.text.match(/(?:at least|no longer than)\s+\d+\s+(?:minutes?|seconds?|hours?)|stream\s+\d+\s+hours?/i)?.[0] ?? '';
      const existing = grouped.get(key);
      if (existing) {
        if (!existing.source_text.includes(block.text)) {
          existing.source_text = `${existing.source_text}\n${block.text}`;
          existing.content_requirements = existing.source_text;
        }
        existing.quantity ??= /\b(?:a|one|1)\b/i.test(block.text) ? 1 : null;
        existing.platform ||= platform;
        existing.format ||= format;
        existing.duration ||= duration;
        if (existing.status === 'PLACEHOLDER' && !isContractPlaceholder(block.text)) existing.status = 'DETECTED';
        return;
      }
      const source = sourceFor(document, block);
      grouped.set(key, {
        id: `deliverable-${grouped.size + 1}`,
        type: definition.type,
        title: definition.title,
        quantity: /\b(?:a|one|1)\b/i.test(block.text) ? 1 : null,
        platform,
        format,
        language: '',
        duration,
        release_start: '',
        release_end: '',
        content_requirements: block.text,
        acceptance_evidence: definition.type === 'ANALYTICS_SCREENSHOT' ? 'Analytics screenshot' : '',
        source_text: block.text,
        source_page: block.pageNumber,
        status: isContractPlaceholder(block.text) ? 'PLACEHOLDER' : 'DETECTED',
        source,
      });
    }));
  });
  return [...grouped.values()];
};

const obligationRule = (
  documents: ParsedContractDocument[],
  group: StructuredContractObligation['group'],
  label: string,
  pattern: RegExp,
  normalize: (raw: string) => unknown = (raw) => raw,
): StructuredContractObligation[] => documents.flatMap((document) => document.blocks.flatMap((block) => {
  if (document.parseStatus !== 'parsed' || !pattern.test(block.text)) return [];
  const source = sourceFor(document, block);
  return [{
    id: `obligation-${group}-${label}-${document.id}-${block.id}`,
    group,
    label,
    rawValue: block.text,
    normalizedValue: normalize(block.text),
    sourceText: block.text,
    sourcePage: block.pageNumber,
    status: isContractPlaceholder(block.text) ? 'PLACEHOLDER' : /\[\s*\d+\s*\/\s*\d+\s*\]/.test(block.text) ? 'CONFLICT' : 'DETECTED',
    source,
  }];
}));

export const recognizeObligations = (documents: ParsedContractDocument[]) => [
  ...obligationRule(documents, 'PURPOSE', '推广目的', /^Purpose\s*[:|]/i),
  ...obligationRule(documents, 'PUBLISHING_SPEC', '发布格式', /^Format\s*[:|]/i),
  ...obligationRule(documents, 'PUBLISHING_SPEC', '发布日期', /^Release Date\s*[:|]?/i),
  ...obligationRule(documents, 'PUBLISHING_SPEC', '语言', /^Language\s*[:|]/i),
  ...obligationRule(documents, 'PUBLISHING_SPEC', '视频时长', /^Length of Video\s*[:|]/i),
  ...obligationRule(documents, 'LICENSE', 'License Period', /^License Period\s*[:|]/i),
  ...obligationRule(documents, 'LICENSE', 'License Price', /^License Price\s*[:|]/i, normalizeMoney),
  ...obligationRule(documents, 'LICENSE', 'License Scope', /license of the right to use|global scale/i),
  ...obligationRule(documents, 'LICENSE', '内容保留期限', /shall not be deleted.+one\)?\s*year/i),
  ...obligationRule(documents, 'ACCEPTANCE_MODIFICATION', '脚本预审', /written script|prior written confirmation/i),
  ...obligationRule(documents, 'ACCEPTANCE_MODIFICATION', '发布证明', /screenshots?.+acceptance|proof of publication/i),
  ...obligationRule(documents, 'ACCEPTANCE_MODIFICATION', '免费修改次数', /modification.+3\s*\(three\)\s*times/i, () => ({ freeRevisions: 3 })),
  ...obligationRule(documents, 'ACCEPTANCE_MODIFICATION', '修改完成期限', /complete the modifications.+within the time specified/i),
  ...obligationRule(documents, 'ACCEPTANCE_MODIFICATION', '超次修改费用', /exceeds 3\s*\(three\)\s*times.+additional fees/i),
  ...obligationRule(documents, 'PAYMENT_TRIGGER', '一次性付款', /made by one installment/i, () => ({ installments: 1 })),
  ...obligationRule(documents, 'PAYMENT_TRIGGER', '付款触发条件', /after the video is released.+accepted.+receipt of the invoice/i, (raw) => ({
    releaseCompleted: /video is released/i.test(raw),
    clientAccepted: /accepted by the Client/i.test(raw),
    validInvoiceReceived: /receipt of the invoice/i.test(raw),
    workingDays: normalizeDays(raw),
  })),
];

const requiredBlockerKeys: ContractFieldKey[] = [
  'advertiser', 'publisher', 'contractNumber', 'ioNumber', 'projectName', 'platform',
  'campaignPeriod', 'projectTotalFees', 'currency', 'paymentTerm', 'paymentMethod',
];

const buildIssues = (
  fields: ContractRecognitionField[],
  deliverables: StructuredContractDeliverable[],
): ContractRecognitionResult['issues'] => {
  const issues: ContractRecognitionResult['issues'] = [];
  fields.forEach((field) => {
    if (!['MISSING', 'PLACEHOLDER', 'CONFLICT'].includes(field.status)) return;
    const blocker = requiredBlockerKeys.includes(field.fieldKey);
    issues.push({
      id: `field-${field.fieldKey}-${field.status}`,
      severity: blocker ? 'BLOCKER' : 'REVIEW',
      fieldKey: field.fieldKey,
      label: `${field.label}${field.status === 'CONFLICT' ? '存在冲突' : field.status === 'PLACEHOLDER' ? '仍为占位符' : '未识别'}`,
      description: blocker ? '该字段需人工核对并确认后才能进入 Invoice 校验。' : '该字段未确定，请根据合同原文人工复核。',
      sources: field.candidates.map((item) => item.source),
    });
  });
  if (!deliverables.length) {
    issues.push({
      id: 'deliverables-missing',
      severity: 'REVIEW',
      label: '未识别结构化交付物',
      description: '请人工录入 IO 的 Services/Deliverables，解析失败不会阻断合同查看。',
      sources: [],
    });
  }
  return issues;
};

const aggregateTemplateMatch = (documents: ParsedContractDocument[]) => {
  const best = [...documents].sort((left, right) => right.templateMatch.confidence - left.templateMatch.confidence)[0];
  return best?.templateMatch ?? {
    matched: false,
    templateKey: 'UNKNOWN' as const,
    confidence: 0,
    matchedHeadings: [],
    ioStartPage: null,
  };
};

export const recognizeContract = (
  documents: ParsedContractDocument[],
  context: ContractRecognitionContext = {},
): ContractRecognitionResult => {
  const feeCandidates = totalFeeCandidates(documents);
  const accountNumber = accountCandidates(documents, 'accountNumberLast4');
  const iban = accountCandidates(documents, 'ibanLast4');
  const paypalUser = candidatesForAliases(documents, ALIASES.paypalUsername.aliases);
  const paypalEmail = candidatesForAliases(documents, ALIASES.paypalEmail.aliases);
  const fileContractNumbers = candidatesForAliases(documents, ALIASES.contractNumber.aliases, (raw) => raw, 0.94);
  const fileIoNumbers = candidatesForAliases(documents, ALIASES.ioNumber.aliases, (raw) => raw, 0.94);
  const candidates: Record<ContractFieldKey, ContractFieldCandidate[]> = {
    advertiser: [...candidatesForAliases(documents, ALIASES.advertiser.aliases), ...templatePartyCandidates(documents, 'advertiser')],
    publisher: [...candidatesForAliases(documents, ALIASES.publisher.aliases), ...templatePartyCandidates(documents, 'publisher')],
    contractNumber: context.systemContractNumber ? [systemCandidate('contract', context.systemContractNumber), ...fileContractNumbers] : fileContractNumbers,
    ioNumber: context.systemIoNumber ? [systemCandidate('io', context.systemIoNumber), ...fileIoNumbers] : fileIoNumbers,
    projectName: candidatesForAliases(documents, ALIASES.projectName.aliases),
    brandName: candidatesForAliases(documents, ALIASES.brandName.aliases),
    platform: candidatesForAliases(documents, ALIASES.platform.aliases),
    channelName: candidatesForAliases(documents, ALIASES.channelName.aliases),
    channelLink: candidatesForAliases(documents, ALIASES.channelLink.aliases),
    effectiveDate: [
      ...candidatesForAliases(documents, ALIASES.effectiveDate.aliases, normalizeContractDate, 0.95),
      ...candidatesFromPagePattern(
        documents,
        /with\s+an\s+effect\s+as\s+of\s+(.+?)\s*\(\s*["“]the\s+Agreement/i,
        normalizeContractDate,
        0.88,
      ),
    ],
    signatureStatus: signatureStatusCandidates(documents),
    advertiserSignatureDate: [
      ...candidatesForAliases(documents, ALIASES.advertiserSignatureDate.aliases, normalizeContractDate),
      ...signatureDateCandidates(documents, 'advertiser'),
    ],
    publisherSignatureDate: [
      ...candidatesForAliases(documents, ALIASES.publisherSignatureDate.aliases, normalizeContractDate),
      ...signatureDateCandidates(documents, 'publisher'),
    ],
    campaignPeriod: campaignCandidates(documents),
    projectTotalFees: feeCandidates,
    currency: currencyCandidates(documents, feeCandidates),
    invoiceIssuePeriod: invoiceIssueCandidates(documents),
    paymentTerm: paymentTermCandidates(documents),
    paymentMethod: [
      ...candidatesForAliases(documents, ALIASES.paymentMethod.aliases, normalizePaymentMethod, 0.92),
      ...inferredPaymentMethodCandidates(accountNumber, iban, paypalUser, paypalEmail),
    ],
    transferFee: transferFeeCandidates(documents),
    beneficiaryAccountName: candidatesForAliases(documents, ALIASES.beneficiaryAccountName.aliases),
    bankName: candidatesForAliases(documents, ALIASES.bankName.aliases),
    accountNumberLast4: accountNumber,
    swiftCode: candidatesForAliases(documents, ALIASES.swiftCode.aliases),
    ibanLast4: iban,
    paypalUsername: paypalUser,
    paypalEmail,
    remittanceInformation: candidatesForAliases(documents, ALIASES.remittanceInformation.aliases),
  };

  const fields = (Object.keys(CONTRACT_FIELD_LABELS) as ContractFieldKey[])
    .map((fieldKey) => resultFromCandidates(fieldKey, candidates[fieldKey]));
  const paymentMethod = fields.find((field) => field.fieldKey === 'paymentMethod');
  const normalizedMethods = Array.isArray(paymentMethod?.normalizedValue)
    ? paymentMethod.normalizedValue
    : [paymentMethod?.normalizedValue].filter(Boolean);
  if (paymentMethod?.status === 'DETECTED' && normalizedMethods.length === 1) {
    const notApplicable = normalizedMethods[0] === 'PAYPAL'
      ? ['bankName', 'accountNumberLast4', 'swiftCode', 'ibanLast4']
      : ['paypalUsername', 'paypalEmail'];
    fields.forEach((field) => {
      if (notApplicable.includes(field.fieldKey) && field.status === 'MISSING') {
        field.status = 'NOT_APPLICABLE';
        field.rawValue = '不适用';
        field.normalizedValue = null;
      }
    });
  }
  const signatureStatus = fields.find((field) => field.fieldKey === 'signatureStatus');
  if (signatureStatus?.normalizedValue === 'UNSIGNED' && signatureStatus.status === 'PLACEHOLDER') {
    fields.forEach((field) => {
      if (['advertiserSignatureDate', 'publisherSignatureDate'].includes(field.fieldKey)) {
        field.status = 'PLACEHOLDER';
      }
    });
  }
  const templateMatch = aggregateTemplateMatch(documents);
  const publisher = fields.find((field) => field.fieldKey === 'publisher');
  if (templateMatch.matched && publisher?.status === 'PLACEHOLDER') {
    fields.forEach((field) => {
      if (['platform', 'channelName', 'channelLink'].includes(field.fieldKey) && field.status === 'DETECTED') {
        field.status = 'PLACEHOLDER';
      }
    });
  }
  const beneficiaryFields = fields.filter((field) => [
    'beneficiaryAccountName', 'accountNumberLast4', 'ibanLast4', 'paypalUsername', 'paypalEmail',
  ].includes(field.fieldKey));
  if (context.beneficiaryReferences?.length) {
    beneficiaryFields.forEach((field) => {
      if (!field.rawValue || ['MISSING', 'PLACEHOLDER'].includes(field.status)) return;
      const recognized = field.rawValue.toLocaleLowerCase().replace(/\s+/g, '');
      const matched = context.beneficiaryReferences!.some((reference) => reference.matchTokens.some((token) => (
        token.trim().length >= 4 && recognized.includes(token.toLocaleLowerCase().replace(/\s+/g, ''))
      )));
      field.profileComparison = {
        status: matched ? 'MATCHED' : 'CONFLICT',
        referenceLabels: context.beneficiaryReferences!.map((reference) => reference.label),
      };
      if (!matched) field.status = 'CONFLICT';
    });
  }
  const deliverables = recognizeDeliverables(documents);
  const obligations = recognizeObligations(documents);
  return {
    templateMatch,
    fields,
    deliverables,
    obligations,
    issues: buildIssues(fields, deliverables),
  };
};

export const recognizeContractFields = (
  documents: ParsedContractDocument[],
  context: ContractRecognitionContext = {},
) => recognizeContract(documents, context).fields;

export const editRecognitionField = (
  field: ContractRecognitionField,
  editedValue: string,
): ContractRecognitionField => {
  const normalizedValue = field.fieldKey === 'campaignPeriod'
    ? normalizeCampaignPeriod(editedValue)
    : ['effectiveDate', 'advertiserSignatureDate', 'publisherSignatureDate'].includes(field.fieldKey)
      ? normalizeContractDate(editedValue)
      : field.fieldKey === 'projectTotalFees'
        ? normalizeMoney(editedValue)
        : field.fieldKey === 'currency'
          ? editedValue.trim().toUpperCase()
          : field.fieldKey === 'invoiceIssuePeriod' || field.fieldKey === 'paymentTerm'
            ? { raw: editedValue, normalizedDays: normalizeDays(editedValue) }
            : field.fieldKey === 'paymentMethod'
              ? normalizePaymentMethod(editedValue)
              : field.fieldKey === 'transferFee'
                ? normalizeTransferFee(editedValue)
                : ['accountNumberLast4', 'ibanLast4'].includes(field.fieldKey)
                  ? lastFour(editedValue)
                  : editedValue;
  const rawValue = ['accountNumberLast4', 'ibanLast4'].includes(field.fieldKey)
    ? maskedLastFour(editedValue)
    : editedValue;
  return {
    ...field,
    rawValue,
    normalizedValue,
    originalDetectedValue: field.originalDetectedValue ?? field.rawValue,
    editedValue: rawValue,
    confidence: 1,
    status: isContractPlaceholder(editedValue) ? 'PLACEHOLDER' : editedValue.trim() ? 'DETECTED' : 'MISSING',
    profileComparison: undefined,
  };
};

export const confirmRecognitionField = (
  field: ContractRecognitionField,
): ContractRecognitionField => (
  field.rawValue.trim() && !['PLACEHOLDER', 'CONFLICT'].includes(field.status)
    ? { ...field, status: 'CONFIRMED', confidence: 1 }
    : field
);

export const allRecognitionFieldsConfirmed = (fields: ContractRecognitionField[]) => (
  fields.length > 0 && fields.every((field) => ['CONFIRMED', 'NOT_APPLICABLE'].includes(field.status))
);
