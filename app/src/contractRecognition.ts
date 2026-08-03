import {
  CONTRACT_FIELD_LABELS,
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
  const iso = value.match(/\b(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})(?:日)?\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const english = value.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}\b/i);
  return english ? parseEnglishDate(english[0]) : '';
};

export const normalizeCampaignPeriod = (raw: string) => {
  const separators = /\s+(?:to|through|until|至|到|—|–)\s+/i;
  const parts = cleanValue(raw).split(separators);
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
  if (['ioNumber', 'projectBrand', 'platformChannel', 'campaignPeriod'].includes(fieldKey)) {
    return type === 'IO' ? 50 : type === 'STANDARD_TERMS' ? 20 : 10;
  }
  if (['advertiser', 'publisher', 'effectiveDate'].includes(fieldKey)) {
    return type === 'STANDARD_TERMS' ? 50 : type === 'SIGNATURE_PAGE' ? 35 : 15;
  }
  if (['projectTotalFees', 'invoiceIssuePeriod', 'paymentTerm', 'paymentMethod', 'transferFee', 'beneficiaryAccount'].includes(fieldKey)) {
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
    status: distinctValues.size > 1 ? 'conflict' : 'detected',
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
  (values) => [values.platform, values.channelName || values.handle].filter(Boolean).join(' · '),
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
    contractNumber: context.systemContractNumber
      ? [systemContractCandidate(context.systemContractNumber), ...fileContractNumbers]
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
  };

  const results = (Object.keys(CONTRACT_FIELD_LABELS) as ContractFieldKey[])
    .map((fieldKey) => resultFromCandidates(fieldKey, candidates[fieldKey]));
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

export const editRecognitionField = (
  field: ContractRecognitionField,
  editedValue: string,
): ContractRecognitionField => {
  const parts = editedValue.split(/\s*[·|]\s*/);
  const normalizedValue = field.fieldKey === 'campaignPeriod'
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
  return {
    ...field,
    rawValue: editedValue,
    normalizedValue,
    editedValue,
    confidence: 1,
    status: editedValue.trim() ? 'detected' : 'missing',
    profileComparison: field.fieldKey === 'beneficiaryAccount'
      ? undefined
      : field.profileComparison,
  };
};

export const confirmRecognitionField = (
  field: ContractRecognitionField,
): ContractRecognitionField => (
  field.rawValue.trim()
    ? { ...field, status: 'confirmed', confidence: 1 }
    : field
);

export const allRecognitionFieldsConfirmed = (fields: ContractRecognitionField[]) => (
  fields.length > 0 && fields.every((field) => field.status === 'confirmed')
);
