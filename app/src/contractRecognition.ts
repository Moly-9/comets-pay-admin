import {
  CONTRACT_FIELD_LABELS,
  CONTRACT_UPLOAD_BANK_FIELD_KEYS,
  CONTRACT_UPLOAD_CORE_FIELD_KEYS,
  CONTRACT_UPLOAD_PAYPAL_FIELD_KEYS,
  type ContractDocumentType,
  type ContractFieldCandidate,
  type ContractFieldKey,
  type ContractRecognitionContext,
  type ContractRecognitionField,
  type ContractSourceLocation,
  type ParsedContractDocument,
} from './contractRecognitionTypes';

type AliasDefinition = {
  aliases: string[];
  confidence?: number;
};

const ALIASES: Record<ContractFieldKey, AliasDefinition> = {
  advertiser: {
    aliases: ['Advertiser', 'Client', 'Brand Party', 'Company', '广告主', '客户', '品牌方', '甲方'],
  },
  publisher: {
    aliases: ['Publisher', 'Creator', 'Influencer', 'Service Provider', '发布方', '达人', '创作者', '服务提供方', '乙方'],
  },
  signatureStatus: {
    aliases: ['Signature Status', 'Signing Status', '签署状态', '签字状态'],
  },
  contractExpiry: {
    aliases: ['Contract End Date', 'Expiration Date', 'Expiry Date', 'Campaign End', 'End Date', '合同有效期', '合同到期日', '到期日期', '失效日期'],
  },
  contractNumber: {
    aliases: ['Contract Number', 'Contract No.', 'Contract No', 'Agreement Number', 'Agreement ID', '合同编号', '协议编号'],
  },
  ioNumber: {
    aliases: ['IO Number', 'IO No.', 'IO No', 'Insertion Order Number', 'Order Number', 'IO 编号', '订单编号', '投放订单号'],
  },
  projectBrand: {
    aliases: ['Project Name', 'Campaign Name', 'Campaign Details', '项目名称', '推广项目', '活动名称'],
  },
  platformChannel: {
    aliases: ['Publishing Platform', 'Platform', 'Channel Name', 'Channel Link', 'Channel', 'Handle', '发布平台', '平台', '频道', '账号', '主页链接'],
  },
  effectiveDate: {
    aliases: ['Agreement Effective Date', 'Effective Date', '协议生效日', '生效日期'],
  },
  campaignPeriod: {
    aliases: ['Campaign Period', 'Campaign Date', 'Service Period', '活动周期', '项目周期', '推广周期', '服务周期'],
  },
  projectTotalFees: {
    aliases: ['Project Total Fees', 'Total Fees', 'Contract Amount', 'Service Fee', '项目总费用', '合同金额', '服务费'],
  },
  invoiceIssuePeriod: {
    aliases: ['Invoice Issue Period', 'Invoice Submission Period', 'Invoice Due', 'Invoice 开具期限', 'Invoice 提交期限', '发票开具期限'],
  },
  paymentTerm: {
    aliases: ['Payment Terms', 'Payment Term', '付款期限', '付款条款'],
  },
  paymentMethod: {
    aliases: ['Payment Method', 'Method of Payment', '付款方式', '支付方式'],
  },
  transferFee: {
    aliases: ['Transfer Fee', 'Bank Charges', 'Transaction Fee', '转账手续费', '银行手续费', '手续费承担'],
  },
  beneficiaryAccount: {
    aliases: ['Beneficiary', 'Beneficiary Name', 'Bank Account', 'Account Name', 'Account Number', '收款主体', '收款账户', '银行账户', '账户名称'],
  },
  accountName: {
    aliases: ['Account Name', 'Account Holder Name', 'Beneficiary Name', 'Beneficiary Account Name', 'Bank Account Name', '账户名称', '开户名称', '收款账户名'],
  },
  accountNumber: {
    aliases: ['Account Number', 'Beneficiary Account Number', 'Bank Account Number', 'A/C Number', 'A/C No.', '银行账号', '收款账号', '账户号码'],
  },
  beneficiaryBankName: {
    aliases: ['Beneficiary Bank Name', 'Beneficiary Bank', 'Bank Name', '收款银行名称', '收款银行', '开户银行'],
  },
  beneficiaryBankAddress: {
    aliases: ['Beneficiary Bank Address', 'Bank Address', '收款银行地址', '开户行地址'],
  },
  swiftCode: {
    aliases: ['SWIFT Code', 'SWIFT/BIC', 'SWIFT', 'BIC Code', 'BIC', '银行国际代码'],
  },
  iban: {
    aliases: ['IBAN', 'International Bank Account Number', '国际银行账号'],
  },
  remittanceInformation: {
    aliases: ['Remittance Information', 'Remittance Info', 'Wire Instructions', '汇款信息', '汇款附言'],
  },
  paypalUsername: {
    aliases: ['PayPal Username', 'Paypal UserName', 'PayPal User Name', 'PayPal Account Name', 'PayPal 用户名', 'PayPal 账号'],
  },
  paypalEmail: {
    aliases: ['PayPal Email Address', 'Paypal Email Address', 'PayPal Email', 'PayPal 邮箱'],
  },
  transferNote: {
    aliases: ['Transfer Note', 'PayPal Transfer Note', '转账备注', '付款备注'],
  },
};

const SIGNATURE_DATE_ALIASES = ['Signature Date', 'Date Signed', '签署日期', '签字日期'];
const BRAND_ALIASES = ['Brand Name', 'Brand', '品牌名称', '品牌'];
const PROJECT_ALIASES = ['Project Name', 'Campaign Name', '推广项目', '项目名称', '活动名称'];
const PLATFORM_ALIASES = ['Publishing Platform', 'Platform', '发布平台', '平台'];
const CHANNEL_NAME_ALIASES = ['Channel Name', 'Channel', '频道'];
const HANDLE_ALIASES = ['Handle', 'Account', '账号'];
const CHANNEL_URL_ALIASES = ['Channel Link', 'Channel URL', 'Profile URL', 'Homepage', '主页链接'];
const START_DATE_ALIASES = ['Start Date', 'Campaign Start', 'Service Start Date', '开始日期', '活动开始日期'];
const END_DATE_ALIASES = ['End Date', 'Campaign End', 'Service End Date', '结束日期', '活动结束日期'];
const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'HKD', 'JPY', 'CNY', 'RMB', 'AUD', 'CAD', 'SGD', 'THB', 'BRL'];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cleanValue = (value: string) => value
  .replace(/^[\s:：\-–—|]+/, '')
  .replace(/\s+/g, ' ')
  .trim();

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
  block: ParsedContractDocument['blocks'][number],
): ContractSourceLocation => ({
  documentId: document.id,
  documentType: document.documentType,
  fileName: document.fileName,
  pageNumber: block.pageNumber,
  section: block.section,
  sourceText: block.text,
  blockId: block.id,
});

const matchLabeledValue = (text: string, aliases: string[]) => {
  const pattern = aliases.map(escapeRegExp).sort((left, right) => right.length - left.length).join('|');
  const tableMatch = text.match(new RegExp(`(?:^|\\|\\s*)(?:${pattern})\\s*\\|\\s*([^|]+)`, 'iu'));
  if (tableMatch?.[1]) return cleanValue(tableMatch[1]);
  const match = text.match(new RegExp(`(?:^|[\\s|])(?:${pattern})\\s*(?::|：|[-–—]|\\|)\\s*(.+)$`, 'iu'));
  return cleanValue(match?.[1] ?? '');
};

const isStandaloneLabel = (text: string, aliases: string[]) => {
  const pattern = aliases.map(escapeRegExp).sort((left, right) => right.length - left.length).join('|');
  return new RegExp(`^(?:${pattern})\\s*(?::|：|[-–—]|\\|)?$`, 'iu').test(text.trim());
};

const candidatesForAliases = (
  documents: ParsedContractDocument[],
  aliases: string[],
  normalize: (raw: string) => unknown = (raw) => raw,
  confidence = 0.9,
) => documents.flatMap((document) => (
  document.parseStatus !== 'parsed'
    ? []
    : document.blocks.flatMap((block, index) => {
      const directValue = matchLabeledValue(block.text, aliases);
      const nextBlock = document.blocks[index + 1];
      const adjacentValue = !directValue
        && isStandaloneLabel(block.text, aliases)
        && nextBlock
        && nextBlock.kind !== 'heading'
        && nextBlock.text.length <= 500
          ? cleanValue(nextBlock.text)
          : '';
      const rawValue = directValue || adjacentValue;
      if (!rawValue) return [];
      return [{
        rawValue,
        normalizedValue: normalize(rawValue),
        source: adjacentValue
          ? {
              ...sourceFor(document, block),
              sourceText: `${block.text} ${nextBlock.text}`,
            }
          : sourceFor(document, block),
        confidence: adjacentValue ? Math.min(confidence, 0.78) : confidence,
      } satisfies ContractFieldCandidate];
    })
));

const parseEnglishDate = (value: string) => {
  const match = value.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})$/i);
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
  const iso = value.match(/(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})(?:日)?/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const english = value.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}\b/i);
  return english ? parseEnglishDate(english[0]) : '';
};

export const normalizeCampaignPeriod = (raw: string) => {
  const value = cleanValue(raw);
  const dateMatches = [
    ...value.matchAll(/20\d{2}[-/年]\d{1,2}[-/月]\d{1,2}(?:日)?/g),
    ...value.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}\b/gi),
  ].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
  if (dateMatches.length >= 2) {
    return {
      startDate: normalizeContractDate(dateMatches[0][0]),
      endDate: normalizeContractDate(dateMatches[dateMatches.length - 1][0]),
    };
  }
  const separators = /\s*(?:to|through|until|至|到|—|–)\s*/i;
  const parts = value.split(separators);
  if (parts.length < 2) return { startDate: '', endDate: '' };
  return {
    startDate: normalizeContractDate(parts[0]),
    endDate: normalizeContractDate(parts.slice(1).join(' ')),
  };
};

type ContractExpiryValue = {
  startDate: string;
  endDate: string;
  isLongTerm: boolean;
};

const isLongTermContractText = (value: string) => (
  /\b(?:perpetual|indefinite|no\s+fixed\s+(?:end|term)|long[-\s]?term)\b|长期有效|永久有效|无固定期限/i.test(value)
);

const legacyCampaignPeriodExpiry = (
  normalizedValue: unknown,
  rawValue: string,
): ContractExpiryValue => {
  const normalized = normalizedValue && typeof normalizedValue === 'object'
    ? normalizedValue as { startDate?: unknown; endDate?: unknown; isLongTerm?: unknown }
    : {};
  if (normalized.isLongTerm === true || isLongTermContractText(rawValue)) {
    return { startDate: '', endDate: '', isLongTerm: true };
  }
  const parsedPeriod = normalizeCampaignPeriod(rawValue);
  const normalizedStart = String(normalized.startDate ?? '').trim();
  const normalizedEnd = String(normalized.endDate ?? '').trim();
  return {
    startDate: normalizeContractDate(normalizedStart) || parsedPeriod.startDate,
    endDate: normalizeContractDate(normalizedEnd)
      || parsedPeriod.endDate
      || (!parsedPeriod.startDate ? normalizeContractDate(rawValue) : ''),
    isLongTerm: false,
  };
};

const contractExpiryRawValue = (value: ContractExpiryValue) => (
  value.isLongTerm
    ? '长期有效'
    : value.startDate && value.endDate
      ? `${value.startDate} 至 ${value.endDate}`
      : value.startDate || value.endDate
);

const contractDateDayNumber = (value: string) => {
  const match = /^(20\d{2})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null;
  return timestamp / (24 * 60 * 60 * 1000);
};

export const contractExpiryRangeValidationMessage = (normalizedValue: unknown) => {
  if (!normalizedValue || typeof normalizedValue !== 'object') return '请选择开始日期和结束日期。';
  const value = normalizedValue as Partial<ContractExpiryValue>;
  const startDay = contractDateDayNumber(value.startDate?.trim() ?? '');
  const endDay = contractDateDayNumber(value.endDate?.trim() ?? '');
  if (startDay === null || endDay === null) return '请选择开始日期和结束日期。';
  if (endDay < startDay) return '结束日期不能早于开始日期。';
  return '';
};

export const isContractExpiryRangeValid = (normalizedValue: unknown) => (
  !contractExpiryRangeValidationMessage(normalizedValue)
);

const legacyCampaignCandidateAsExpiry = (
  candidate: ContractFieldCandidate,
): ContractFieldCandidate => {
  const expiry = legacyCampaignPeriodExpiry(candidate.normalizedValue, candidate.rawValue);
  return {
    ...candidate,
    rawValue: contractExpiryRawValue(expiry),
    normalizedValue: expiry,
  };
};

const normalizeExistingContractExpiryField = (
  field: ContractRecognitionField,
): ContractRecognitionField => {
  const expiry = legacyCampaignPeriodExpiry(
    field.normalizedValue,
    field.editedValue?.trim() || field.rawValue,
  );
  const rawValue = contractExpiryRawValue(expiry);
  const validForNewUpload = isContractExpiryRangeValid(expiry);
  return {
    ...field,
    rawValue,
    editedValue: field.editedValue === undefined ? undefined : rawValue,
    normalizedValue: expiry,
    status: field.status === 'confirmed' && validForNewUpload
      ? 'confirmed'
      : validForNewUpload
        ? field.status
        : 'missing',
    candidates: field.candidates.map(legacyCampaignCandidateAsExpiry),
  };
};

/**
 * Adapts historical Campaign Period recognition snapshots to the current expiry-only field.
 * The original source text and location remain attached to the converted field and candidates.
 */
export const normalizeContractRecognitionFields = (
  fields: ContractRecognitionField[],
): ContractRecognitionField[] => {
  const currentExpiry = fields.find((field) => field.fieldKey === 'contractExpiry');
  const legacyPeriod = fields.find((field) => field.fieldKey === 'campaignPeriod');
  const expiry = legacyPeriod
    ? legacyCampaignPeriodExpiry(
        legacyPeriod.normalizedValue,
        legacyPeriod.editedValue?.trim() || legacyPeriod.rawValue,
      )
    : null;
  const rawValue = expiry ? contractExpiryRawValue(expiry) : '';
  const converted: ContractRecognitionField | null = legacyPeriod && !currentExpiry
    ? {
        ...legacyPeriod,
        fieldKey: 'contractExpiry',
        label: CONTRACT_FIELD_LABELS.contractExpiry,
        rawValue,
        editedValue: legacyPeriod.editedValue === undefined ? undefined : rawValue,
        normalizedValue: expiry,
        status: expiry && isContractExpiryRangeValid(expiry) ? legacyPeriod.status : 'missing',
        candidates: legacyPeriod.candidates
          .map(legacyCampaignCandidateAsExpiry)
          .filter((candidate) => Boolean(candidate.rawValue)),
        group: legacyPeriod.group === 'legacy' ? 'summary' : legacyPeriod.group,
      }
    : null;
  const normalized = fields.flatMap((field) => (
    field.fieldKey === 'campaignPeriod'
      ? converted ? [converted] : []
      : [field.fieldKey === 'contractExpiry' ? normalizeExistingContractExpiryField(field) : field]
  ));
  if (!normalized.length || normalized.some((field) => field.fieldKey === 'signatureStatus')) {
    return normalized;
  }
  return [
    ...normalized,
    {
      fieldKey: 'signatureStatus',
      label: CONTRACT_FIELD_LABELS.signatureStatus,
      rawValue: '',
      normalizedValue: null,
      source: null,
      confidence: 0,
      status: 'missing',
      candidates: [],
      origin: 'document',
      group: 'summary',
      applicable: true,
      requiredForConfirmation: true,
      readOnly: false,
    },
  ];
};

export const normalizeMoney = (raw: string) => {
  const currency = raw.match(new RegExp(`\\b(${CURRENCY_CODES.join('|')})\\b`, 'i'))?.[1]?.toUpperCase() ?? '';
  const amountMatches = raw.replace(new RegExp(CURRENCY_CODES.join('|'), 'ig'), '').match(/(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g);
  const amountText = amountMatches?.[amountMatches.length - 1] ?? '';
  const amount = Number(amountText.replace(/,/g, ''));
  return {
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    currency,
  };
};

export const normalizeDays = (raw: string) => {
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
  if (/shared|each party|双方(?:共同|各自)承担/i.test(raw)) return 'SHARED';
  return '';
};

const documentPriority = (fieldKey: ContractFieldKey, type: ContractDocumentType) => {
  if (['ioNumber', 'projectBrand', 'platformChannel', 'campaignPeriod', 'contractExpiry'].includes(fieldKey)) {
    return type === 'IO' ? 50 : type === 'STANDARD_TERMS' ? 20 : 10;
  }
  if (['advertiser', 'publisher', 'effectiveDate', 'signatureStatus'].includes(fieldKey)) {
    return type === 'STANDARD_TERMS' ? 50 : type === 'SIGNATURE_PAGE' ? 35 : 15;
  }
  if ([
    'projectTotalFees',
    'invoiceIssuePeriod',
    'paymentTerm',
    'paymentMethod',
    'transferFee',
    'beneficiaryAccount',
    ...CONTRACT_UPLOAD_BANK_FIELD_KEYS,
    ...CONTRACT_UPLOAD_PAYPAL_FIELD_KEYS,
  ].includes(fieldKey)) {
    return type === 'PAYMENT_ADDENDUM' ? 60 : type === 'IO' ? 50 : type === 'STANDARD_TERMS' ? 40 : 10;
  }
  return type === 'STANDARD_TERMS' ? 40 : type === 'IO' ? 35 : 10;
};

const sortCandidates = (fieldKey: ContractFieldKey, candidates: ContractFieldCandidate[]) => (
  [...candidates].sort((left, right) => (
    Number(right.source.documentId === 'system-contract') * 1000
    - Number(left.source.documentId === 'system-contract') * 1000
    ||
    documentPriority(fieldKey, right.source.documentType)
    - documentPriority(fieldKey, left.source.documentType)
    || right.confidence - left.confidence
  ))
);

const resultFromCandidates = (
  fieldKey: ContractFieldKey,
  candidates: ContractFieldCandidate[],
): ContractRecognitionField => {
  const sorted = sortCandidates(fieldKey, candidates);
  const distinctValues = new Set(sorted.map((candidate) => normalizedKey(candidate.normalizedValue)).filter(Boolean));
  const selected = sorted[0];
  if (!selected) {
    return {
      fieldKey,
      label: CONTRACT_FIELD_LABELS[fieldKey],
      rawValue: '',
      normalizedValue: null,
      source: null,
      confidence: 0,
      status: 'missing',
      candidates: [],
    };
  }
  return {
    fieldKey,
    label: CONTRACT_FIELD_LABELS[fieldKey],
    rawValue: selected.rawValue,
    normalizedValue: selected.normalizedValue,
    source: selected.source,
    confidence: selected.confidence,
    status: distinctValues.size > 1
      ? 'conflict'
      : fieldKey === 'contractExpiry' && !isContractExpiryRangeValid(selected.normalizedValue)
        ? 'missing'
        : 'detected',
    candidates: sorted,
  };
};

const combineDocumentFields = (
  documents: ParsedContractDocument[],
  definitions: Array<{ key: string; aliases: string[] }>,
  normalize: (values: Record<string, string>) => unknown,
  display: (values: Record<string, string>) => string,
  confidence = 0.9,
) => documents.flatMap((document) => {
  if (document.parseStatus !== 'parsed') return [];
  const values: Record<string, string> = {};
  let firstBlock: ParsedContractDocument['blocks'][number] | null = null;
  for (const definition of definitions) {
    for (const block of document.blocks) {
      const value = matchLabeledValue(block.text, definition.aliases);
      if (!value) continue;
      values[definition.key] = value;
      firstBlock ??= block;
      break;
    }
  }
  if (!firstBlock || Object.keys(values).length === 0) return [];
  return [{
    rawValue: display(values),
    normalizedValue: normalize(values),
    source: sourceFor(document, firstBlock),
    confidence,
  } satisfies ContractFieldCandidate];
});

const campaignCandidates = (documents: ParsedContractDocument[]) => {
  const direct = candidatesForAliases(documents, ALIASES.campaignPeriod.aliases, normalizeCampaignPeriod, 0.95)
    .filter((candidate) => {
      const value = candidate.normalizedValue as { startDate: string; endDate: string };
      return value.startDate || value.endDate;
    });
  const split = combineDocumentFields(
    documents,
    [
      { key: 'startDateRaw', aliases: START_DATE_ALIASES },
      { key: 'endDateRaw', aliases: END_DATE_ALIASES },
    ],
    (values) => ({
      startDate: normalizeContractDate(values.startDateRaw ?? ''),
      endDate: normalizeContractDate(values.endDateRaw ?? ''),
    }),
    (values) => [values.startDateRaw, values.endDateRaw].filter(Boolean).join(' to '),
    0.92,
  );
  return [...direct, ...split];
};

const projectBrandCandidates = (documents: ParsedContractDocument[]) => combineDocumentFields(
  documents,
  [
    { key: 'projectName', aliases: PROJECT_ALIASES },
    { key: 'brandName', aliases: BRAND_ALIASES },
  ],
  (values) => ({ projectName: values.projectName ?? '', brandName: values.brandName ?? '' }),
  (values) => [values.projectName, values.brandName].filter(Boolean).join(' · '),
  0.92,
);

const platformChannelCandidates = (documents: ParsedContractDocument[]) => combineDocumentFields(
  documents,
  [
    { key: 'platform', aliases: PLATFORM_ALIASES },
    { key: 'channelName', aliases: CHANNEL_NAME_ALIASES },
    { key: 'handle', aliases: HANDLE_ALIASES },
    { key: 'channelUrl', aliases: CHANNEL_URL_ALIASES },
  ],
  (values) => ({
    platform: values.platform ?? '',
    channelName: values.channelName ?? '',
    handle: values.handle ?? '',
    channelUrl: values.channelUrl ?? '',
  }),
  (values) => [values.platform, values.channelUrl].filter(Boolean).join(' · '),
  0.9,
);

const effectiveDateCandidates = (documents: ParsedContractDocument[]) => {
  const explicit = candidatesForAliases(
    documents,
    ALIASES.effectiveDate.aliases,
    (raw) => ({ date: normalizeContractDate(raw), basis: 'effective-date' }),
    0.95,
  ).filter((candidate) => Boolean((candidate.normalizedValue as { date: string }).date));
  if (explicit.length > 0) return explicit;
  return candidatesForAliases(
    documents,
    SIGNATURE_DATE_ALIASES,
    (raw) => ({ date: normalizeContractDate(raw), basis: 'signature-date-candidate', needsConfirmation: true }),
    0.65,
  ).filter((candidate) => Boolean((candidate.normalizedValue as { date: string }).date));
};

const signatureStatusCandidates = (documents: ParsedContractDocument[]) => documents.flatMap((document) => (
  document.parseStatus !== 'parsed'
    ? []
    : document.blocks.flatMap((block) => {
        const text = block.text.trim();
        const statusValue = matchLabeledValue(text, ALIASES.signatureStatus.aliases);
        const labeledValue = text.match(/(?:signed\s+by|date\s+signed|signed|signature|签署人|签署日期|签字人|签字日期)\s*[:：]\s*(.+)$/i)?.[1]?.trim() ?? '';
        const explicitlyUnsigned = /\b(?:not\s+signed|unsigned|awaiting\s+signature|pending\s+signature)\b|未签署|尚未签署|待签署/i.test(text)
          || /^(?:no|false|pending|unsigned|not\s+signed|否|未签署|待签署)$/i.test(statusValue)
          || /^(?:no|false|pending|unsigned|not\s+signed|否|未签署|待签署)$/i.test(labeledValue);
        const hasFilledSignatureValue = Boolean(
          labeledValue
          && /[\p{L}\p{N}]/u.test(labeledValue)
          && !/^(?:n\/?a|none|no|false|pending|unsigned|not\s+signed|否|待签署|未签署)$/i.test(labeledValue),
        );
        const explicitlySigned = hasFilledSignatureValue
          || /^(?:signed|executed|complete|completed|yes)$/i.test(statusValue)
          || /^(?:signed|executed)$/i.test(text)
          || /已签署|已签字|已盖章/i.test(text);
        if (!explicitlyUnsigned && !explicitlySigned) return [];
        const signed = !explicitlyUnsigned;
        const signedAt = signed ? normalizeContractDate(text) : '';
        return [{
          rawValue: signed ? '已签署' : '未签署',
          normalizedValue: { signed, signedAt: signedAt || undefined },
          source: sourceFor(document, block),
          confidence: explicitlyUnsigned ? 0.96 : 0.9,
        } satisfies ContractFieldCandidate];
      })
));

const contractExpiryCandidates = (documents: ParsedContractDocument[]) => {
  const explicit = candidatesForAliases(
    documents,
    ALIASES.contractExpiry.aliases,
    (raw) => {
      const period = normalizeCampaignPeriod(raw);
      return {
        startDate: period.startDate,
        endDate: period.endDate || normalizeContractDate(raw),
        isLongTerm: false,
      };
    },
    0.95,
  ).filter((candidate) => Boolean((candidate.normalizedValue as { endDate?: string }).endDate));
  const ranges = campaignCandidates(documents)
    .filter((candidate) => {
      const value = candidate.normalizedValue as { startDate?: string; endDate?: string };
      return Boolean(value.startDate || value.endDate);
    })
    .map((candidate) => ({
      ...candidate,
      rawValue: contractExpiryRawValue({
        startDate: (candidate.normalizedValue as { startDate?: string }).startDate ?? '',
        endDate: (candidate.normalizedValue as { endDate?: string }).endDate ?? '',
        isLongTerm: false,
      }),
      normalizedValue: {
        startDate: (candidate.normalizedValue as { startDate?: string }).startDate ?? '',
        endDate: (candidate.normalizedValue as { endDate?: string }).endDate ?? '',
        isLongTerm: false,
      },
    }));
  const completeRangeDocumentIds = new Set(ranges
    .filter((candidate) => isContractExpiryRangeValid(candidate.normalizedValue))
    .map((candidate) => candidate.source.documentId));
  return [
    ...ranges,
    ...explicit.filter((candidate) => !completeRangeDocumentIds.has(candidate.source.documentId)),
  ];
};

const totalFeeCandidates = (documents: ParsedContractDocument[]) => {
  const direct = candidatesForAliases(documents, ALIASES.projectTotalFees.aliases, normalizeMoney, 0.95);
  return direct.map((candidate) => {
    const normalized = candidate.normalizedValue as { amount: number | null; currency: string };
    if (normalized.currency) return candidate;
    const document = documents.find((item) => item.id === candidate.source.documentId);
    const currencyCandidate = document
      ? candidatesForAliases([document], ['Currency', '币种'], (raw) => raw.toUpperCase(), 0.85)[0]
      : undefined;
    return currencyCandidate
      ? { ...candidate, normalizedValue: { ...normalized, currency: String(currencyCandidate.normalizedValue) } }
      : candidate;
  });
};

const systemContractCandidate = (systemContractNumber: string): ContractFieldCandidate => ({
  rawValue: systemContractNumber,
  normalizedValue: systemContractNumber,
  confidence: 1,
  source: {
    documentId: 'system-contract',
    documentType: 'OTHER',
    fileName: '系统字段',
    pageNumber: null,
    section: '系统合同资料',
    sourceText: `系统合同编号：${systemContractNumber}`,
    blockId: 'system-contract-number',
  },
});

export const recognizeContractFields = (
  documents: ParsedContractDocument[],
  context: ContractRecognitionContext = {},
): ContractRecognitionField[] => {
  const fileContractNumbers = candidatesForAliases(documents, ALIASES.contractNumber.aliases, (raw) => raw, 0.94);
  const candidates: Record<ContractFieldKey, ContractFieldCandidate[]> = {
    advertiser: candidatesForAliases(documents, ALIASES.advertiser.aliases),
    publisher: candidatesForAliases(documents, ALIASES.publisher.aliases),
    signatureStatus: signatureStatusCandidates(documents),
    contractExpiry: contractExpiryCandidates(documents),
    contractNumber: context.systemContractNumber
      ? [systemContractCandidate(context.systemContractNumber)]
      : fileContractNumbers,
    ioNumber: candidatesForAliases(documents, ALIASES.ioNumber.aliases, (raw) => raw, 0.94),
    projectBrand: projectBrandCandidates(documents),
    platformChannel: platformChannelCandidates(documents),
    effectiveDate: effectiveDateCandidates(documents),
    campaignPeriod: campaignCandidates(documents),
    projectTotalFees: totalFeeCandidates(documents),
    invoiceIssuePeriod: candidatesForAliases(
      documents,
      ALIASES.invoiceIssuePeriod.aliases,
      (raw) => ({
        raw,
        normalizedDays: normalizeDays(raw),
        normalizedDate: normalizeContractDate(raw) || null,
      }),
      0.9,
    ),
    paymentTerm: candidatesForAliases(
      documents,
      ALIASES.paymentTerm.aliases,
      (raw) => ({ raw, normalizedDays: normalizeDays(raw) }),
      0.93,
    ),
    paymentMethod: candidatesForAliases(documents, ALIASES.paymentMethod.aliases, normalizePaymentMethod, 0.9)
      .filter((candidate) => (
        typeof candidate.normalizedValue === 'string'
          ? Boolean(candidate.normalizedValue)
          : (candidate.normalizedValue as string[]).length > 0
      )),
    transferFee: candidatesForAliases(documents, ALIASES.transferFee.aliases, normalizeTransferFee, 0.9)
      .filter((candidate) => Boolean(candidate.normalizedValue)),
    beneficiaryAccount: candidatesForAliases(documents, ALIASES.beneficiaryAccount.aliases, (raw) => raw, 0.82),
    accountName: candidatesForAliases(documents, ALIASES.accountName.aliases, (raw) => raw, 0.92),
    accountNumber: candidatesForAliases(documents, ALIASES.accountNumber.aliases, (raw) => raw, 0.94),
    beneficiaryBankName: candidatesForAliases(documents, ALIASES.beneficiaryBankName.aliases, (raw) => raw, 0.92),
    beneficiaryBankAddress: candidatesForAliases(documents, ALIASES.beneficiaryBankAddress.aliases, (raw) => raw, 0.9),
    swiftCode: candidatesForAliases(documents, ALIASES.swiftCode.aliases, (raw) => raw.toUpperCase(), 0.94),
    iban: candidatesForAliases(documents, ALIASES.iban.aliases, (raw) => raw.replace(/\s+/g, '').toUpperCase(), 0.94),
    remittanceInformation: candidatesForAliases(documents, ALIASES.remittanceInformation.aliases, (raw) => raw, 0.86),
    paypalUsername: candidatesForAliases(documents, ALIASES.paypalUsername.aliases, (raw) => raw, 0.94),
    paypalEmail: candidatesForAliases(documents, ALIASES.paypalEmail.aliases, (raw) => raw.trim().toLowerCase(), 0.96),
    transferNote: candidatesForAliases(documents, ALIASES.transferNote.aliases, (raw) => raw, 0.86),
  };

  const results = (Object.keys(CONTRACT_FIELD_LABELS) as ContractFieldKey[])
    .map((fieldKey) => resultFromCandidates(fieldKey, candidates[fieldKey]));
  const systemContractNumber = results.find((field) => field.fieldKey === 'contractNumber');
  if (systemContractNumber && context.systemContractNumber) {
    systemContractNumber.status = 'confirmed';
    systemContractNumber.origin = 'system';
    systemContractNumber.group = 'summary';
    systemContractNumber.readOnly = true;
    systemContractNumber.requiredForConfirmation = false;
  }
  const beneficiary = results.find((field) => field.fieldKey === 'beneficiaryAccount');
  if (beneficiary && beneficiary.status !== 'missing' && context.beneficiaryReferences?.length) {
    const recognizedValue = beneficiary.rawValue.toLocaleLowerCase().replace(/\s+/g, '');
    const matched = context.beneficiaryReferences.some((reference) => (
      reference.matchTokens.some((token) => (
        token.trim().length >= 4
        && recognizedValue.includes(token.toLocaleLowerCase().replace(/\s+/g, ''))
      ))
    ));
    beneficiary.profileComparison = {
      status: matched ? 'matched' : 'conflict',
      referenceLabels: context.beneficiaryReferences.map((reference) => reference.label),
    };
    if (!matched) beneficiary.status = 'conflict';
  }
  return results;
};

export const recognizeUploadContractFields = (
  documents: ParsedContractDocument[],
  context: ContractRecognitionContext,
): ContractRecognitionField[] => {
  const results = recognizeContractFields(documents, context);
  const fieldFor = (fieldKey: ContractFieldKey) => results.find((field) => field.fieldKey === fieldKey);
  const hasBankFields = CONTRACT_UPLOAD_BANK_FIELD_KEYS.some((fieldKey) => Boolean(fieldFor(fieldKey)?.rawValue.trim()));
  const hasPaypalFields = CONTRACT_UPLOAD_PAYPAL_FIELD_KEYS.some((fieldKey) => Boolean(fieldFor(fieldKey)?.rawValue.trim()));
  const hasNoAccountFields = !hasBankFields && !hasPaypalFields;
  const contractType = documents[0]?.contractType ?? 'INDEPENDENT';
  const orderedKeys: ContractFieldKey[] = [
    ...CONTRACT_UPLOAD_CORE_FIELD_KEYS,
    ...(hasBankFields || hasNoAccountFields ? CONTRACT_UPLOAD_BANK_FIELD_KEYS : []),
    ...(hasPaypalFields || hasNoAccountFields ? CONTRACT_UPLOAD_PAYPAL_FIELD_KEYS : []),
    'platformChannel',
    ...(contractType === 'IO' ? ['ioNumber' as const] : []),
    'contractNumber',
  ];
  const optionalKeys = new Set<ContractFieldKey>([
    ...CONTRACT_UPLOAD_BANK_FIELD_KEYS,
    ...CONTRACT_UPLOAD_PAYPAL_FIELD_KEYS,
    'platformChannel',
  ]);
  return orderedKeys.flatMap((fieldKey) => {
    const field = fieldFor(fieldKey);
    if (!field) return [];
    return [{
      ...field,
      label: fieldKey === 'projectTotalFees'
        ? '合同金额'
        : fieldKey === 'transferFee'
          ? '手续费承担方'
          : field.label,
      origin: fieldKey === 'contractNumber' ? 'system' : 'document',
      group: CONTRACT_UPLOAD_BANK_FIELD_KEYS.includes(fieldKey)
        ? 'bank'
        : CONTRACT_UPLOAD_PAYPAL_FIELD_KEYS.includes(fieldKey)
          ? 'paypal'
          : 'summary',
      applicable: CONTRACT_UPLOAD_BANK_FIELD_KEYS.includes(fieldKey)
        ? hasBankFields
        : CONTRACT_UPLOAD_PAYPAL_FIELD_KEYS.includes(fieldKey)
          ? hasPaypalFields
          : true,
      requiredForConfirmation: fieldKey === 'projectTotalFees' && contractType === 'FRAMEWORK'
        ? false
        : !optionalKeys.has(fieldKey) && fieldKey !== 'contractNumber',
      readOnly: fieldKey === 'contractNumber',
      status: fieldKey === 'contractNumber' ? 'confirmed' : field.status,
    }];
  });
};

export const recognitionFieldDisplayValue = (field: ContractRecognitionField) => {
  if (field.fieldKey === 'signatureStatus' && field.normalizedValue && typeof field.normalizedValue === 'object') {
    return (field.normalizedValue as { signed?: boolean }).signed ? '已签署' : '未签署';
  }
  if (field.fieldKey === 'contractExpiry' && field.normalizedValue && typeof field.normalizedValue === 'object') {
    const value = field.normalizedValue as Partial<ContractExpiryValue>;
    if (value.isLongTerm) return '长期有效';
    if (value.startDate && value.endDate) return `${value.startDate} 至 ${value.endDate}`;
    return value.startDate || value.endDate || field.rawValue;
  }
  return field.rawValue;
};

export const editContractExpiryRange = (
  field: ContractRecognitionField,
  startDate: string,
  endDate: string,
): ContractRecognitionField => {
  if (field.fieldKey !== 'contractExpiry' || field.status === 'confirmed' || field.readOnly) return field;
  const normalizedValue: ContractExpiryValue = {
    startDate: normalizeContractDate(startDate),
    endDate: normalizeContractDate(endDate),
    isLongTerm: false,
  };
  const rawValue = contractExpiryRawValue(normalizedValue);
  return {
    ...field,
    rawValue,
    normalizedValue,
    editedValue: rawValue,
    confidence: 1,
    status: isContractExpiryRangeValid(normalizedValue) ? 'detected' : 'missing',
  };
};

type PlatformChannelValue = {
  platform?: string;
  channelName?: string;
  handle?: string;
  channelUrl?: string;
};

export const editPlatformChannelRecognitionField = (
  field: ContractRecognitionField,
  patch: Partial<Pick<PlatformChannelValue, 'platform' | 'channelUrl'>>,
): ContractRecognitionField => {
  if (field.fieldKey !== 'platformChannel' || field.status === 'confirmed' || field.readOnly) return field;
  const current = field.normalizedValue && typeof field.normalizedValue === 'object'
    ? field.normalizedValue as PlatformChannelValue
    : {};
  const platformChanged = patch.platform !== undefined && patch.platform !== (current.platform ?? '');
  const normalizedValue: PlatformChannelValue = {
    ...current,
    ...(platformChanged ? { channelName: '', handle: '' } : {}),
    ...patch,
  };
  const rawValue = [normalizedValue.platform, normalizedValue.channelUrl]
    .map((value) => value?.trim() ?? '')
    .filter(Boolean)
    .join(' · ');
  return {
    ...field,
    rawValue,
    normalizedValue,
    editedValue: rawValue,
    confidence: 1,
    status: rawValue ? 'detected' : 'missing',
  };
};

export const editRecognitionField = (
  field: ContractRecognitionField,
  editedValue: string,
): ContractRecognitionField => {
  if (field.status === 'confirmed' || field.readOnly) return field;
  const parts = editedValue.split(/\s*[·|]\s*/);
  const normalizedValue = field.fieldKey === 'signatureStatus'
    ? { signed: editedValue === 'SIGNED', signedAt: undefined }
    : field.fieldKey === 'contractExpiry'
      ? {
          ...normalizeCampaignPeriod(editedValue),
          isLongTerm: false,
        }
      : field.fieldKey === 'campaignPeriod'
        ? normalizeCampaignPeriod(editedValue)
        : field.fieldKey === 'effectiveDate'
      ? { date: normalizeContractDate(editedValue), basis: 'manual' }
      : field.fieldKey === 'projectTotalFees'
        ? normalizeMoney(editedValue)
        : field.fieldKey === 'invoiceIssuePeriod' || field.fieldKey === 'paymentTerm'
          ? {
              raw: editedValue,
              normalizedDays: normalizeDays(editedValue),
              ...(field.fieldKey === 'invoiceIssuePeriod'
                ? { normalizedDate: normalizeContractDate(editedValue) || null }
                : {}),
            }
          : field.fieldKey === 'paymentMethod'
            ? normalizePaymentMethod(editedValue)
            : field.fieldKey === 'transferFee'
              ? normalizeTransferFee(editedValue)
              : field.fieldKey === 'projectBrand'
                ? { projectName: parts[0] ?? '', brandName: parts[1] ?? '' }
                : field.fieldKey === 'platformChannel'
                  ? { platform: parts[0] ?? '', channelName: parts[1] ?? '', handle: '', channelUrl: '' }
                  : editedValue;
  const rawValue = field.fieldKey === 'signatureStatus'
    ? editedValue === 'SIGNED'
      ? '已签署'
      : editedValue === 'UNSIGNED'
        ? '未签署'
        : ''
    : editedValue;
  const validValue = field.fieldKey !== 'contractExpiry'
    || isContractExpiryRangeValid(normalizedValue);
  return {
    ...field,
    rawValue,
    normalizedValue,
    editedValue: rawValue,
    confidence: 1,
    status: rawValue.trim() && validValue ? 'detected' : 'missing',
    profileComparison: field.fieldKey === 'beneficiaryAccount'
      ? undefined
      : field.profileComparison,
  };
};

export const confirmRecognitionField = (
  field: ContractRecognitionField,
): ContractRecognitionField => (
  field.rawValue.trim()
    && (field.fieldKey !== 'contractExpiry' || isContractExpiryRangeValid(field.normalizedValue))
    ? { ...field, status: 'confirmed', confidence: 1 }
    : field
);

export const canConfirmRecognitionFields = (
  fields: ContractRecognitionField[],
  fieldKeys: readonly ContractFieldKey[],
) => fieldKeys.length > 0 && fieldKeys.every((fieldKey) => {
  const field = fields.find((item) => item.fieldKey === fieldKey);
  return Boolean(field?.rawValue.trim())
    && field?.status !== 'missing'
    && field?.status !== 'conflict'
    && (fieldKey !== 'contractExpiry' || isContractExpiryRangeValid(field?.normalizedValue));
});

export const confirmRecognitionFields = (
  fields: ContractRecognitionField[],
  fieldKeys: readonly ContractFieldKey[],
): ContractRecognitionField[] => {
  if (!canConfirmRecognitionFields(fields, fieldKeys)) return fields;
  const targetKeys = new Set(fieldKeys);
  return fields.map((field) => (
    targetKeys.has(field.fieldKey) ? confirmRecognitionField(field) : field
  ));
};

export const reopenRecognitionFields = (
  fields: ContractRecognitionField[],
  fieldKeys: readonly ContractFieldKey[],
): ContractRecognitionField[] => {
  const targetKeys = new Set(fieldKeys);
  return fields.map((field) => (
    targetKeys.has(field.fieldKey) && field.status === 'confirmed' && !field.readOnly
      ? { ...field, status: 'detected' }
      : field
  ));
};

export const allRecognitionFieldsConfirmed = (fields: ContractRecognitionField[]) => (
  fields.length > 0 && fields.every((field) => field.status === 'confirmed')
);
