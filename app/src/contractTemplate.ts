import type {
  ContractDocumentVariant,
  ContractGenerationModel,
  ContractQualityIssue,
  ContractQualityReport,
  ContractTemplateFieldKey,
} from './contracts';

export const CONTRACT_TEMPLATE_URL = '/contracts/single-campaign-contract-template-v1.pdf';
export const CONTRACT_TEMPLATE_BASE_PAGE_COUNT = 17;
export const CONTRACT_TEMPLATE_WIDTH = 595.92;
export const CONTRACT_TEMPLATE_HEIGHT = 841.92;
export const CONTRACT_TEMPLATE_MARGIN = 62.36;

export const CONTRACT_TEMPLATE_DEFINITION = {
  id: 'CON-TPL-2026-KOL',
  version: 2,
  sourcePageCount: CONTRACT_TEMPLATE_BASE_PAGE_COUNT,
  page: {
    size: 'A4',
    width: CONTRACT_TEMPLATE_WIDTH,
    height: CONTRACT_TEMPLATE_HEIGHT,
    margin: CONTRACT_TEMPLATE_MARGIN,
  },
  typography: {
    bodySize: 10.5,
    bodyLineHeight: 13.125,
    titleSize: 18,
    headingSize: 14,
    subheadingSize: 11,
  },
  colors: {
    ink: '#20242B',
    muted: '#6F7682',
    border: '#D8DCE4',
    draft: '#B8BDC6',
  },
} as const;

export type ContractPlaceholderKind =
  | 'text'
  | 'longText'
  | 'money'
  | 'date'
  | 'payment'
  | 'signature';

export type ContractPlaceholderDefinition = {
  token: string;
  label: string;
  fieldKey: ContractTemplateFieldKey;
  kind: ContractPlaceholderKind;
  required: boolean;
  pageHint: number;
  value: (model: ContractGenerationModel) => string;
  overflowAt?: number;
  applicable?: (model: ContractGenerationModel) => boolean;
};

export const formatContractDate = (value: string) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatContractMoneyValue = (currency: string, value: string) => {
  if (!value.trim()) return '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} ${value}`.trim();
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    currencyDisplay: 'code',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const bankAddress = (model: ContractGenerationModel) => [
  model.paymentSnapshot.bankStreetAddress,
  model.paymentSnapshot.bankCity,
  model.paymentSnapshot.bankState,
  model.paymentSnapshot.bankPostalCode,
  model.paymentSnapshot.bankCountry,
].filter(Boolean).join(', ');

const payoutAccountLocator = (model: ContractGenerationModel) => (
  model.payoutProvider === 'PayPal'
    ? model.paymentSnapshot.paypalEmail
    : model.paymentSnapshot.iban || model.paymentSnapshot.accountNumber
);

export const CONTRACT_PLACEHOLDER_DEFINITIONS: ContractPlaceholderDefinition[] = [
  { token: 'publisher_name', label: 'Publisher', fieldKey: 'publisher', kind: 'text', required: true, pageHint: 1, overflowAt: 72, value: (model) => model.publisher },
  { token: 'publisher_address', label: 'Publisher Address', fieldKey: 'publisherAddress', kind: 'longText', required: true, pageHint: 14, overflowAt: 180, value: (model) => model.publisherAddress },
  { token: 'channel_url', label: 'Channel Link', fieldKey: 'channelUrl', kind: 'text', required: true, pageHint: 1, overflowAt: 160, value: (model) => model.channelUrl },
  { token: 'platform', label: 'Publishing Platform', fieldKey: 'platform', kind: 'text', required: true, pageHint: 1, overflowAt: 80, value: (model) => model.platform },
  { token: 'effective_date', label: 'Effective Date', fieldKey: 'effectiveDate', kind: 'date', required: true, pageHint: 14, value: (model) => formatContractDate(model.effectiveDate) },
  { token: 'campaign_start', label: 'Campaign Start', fieldKey: 'campaignPeriod', kind: 'date', required: true, pageHint: 14, value: (model) => formatContractDate(model.campaignStart) },
  { token: 'campaign_end', label: 'Campaign End', fieldKey: 'campaignPeriod', kind: 'date', required: true, pageHint: 14, value: (model) => formatContractDate(model.campaignEnd) },
  { token: 'project_name', label: 'Project Name', fieldKey: 'projectName', kind: 'longText', required: true, pageHint: 14, overflowAt: 120, value: (model) => model.projectName },
  { token: 'channel_name', label: 'Channel Name', fieldKey: 'channelName', kind: 'text', required: true, pageHint: 14, overflowAt: 90, value: (model) => model.channelName },
  { token: 'campaign_purpose', label: 'Campaign Purpose', fieldKey: 'purposeItems', kind: 'longText', required: true, pageHint: 15, overflowAt: 280, value: (model) => model.purposeItems.join('\n') },
  { token: 'promoted_product', label: 'Promoted Product', fieldKey: 'promotedProduct', kind: 'longText', required: true, pageHint: 15, overflowAt: 120, value: (model) => model.promotedProduct },
  { token: 'hashtag', label: 'Hashtag', fieldKey: 'hashtag', kind: 'text', required: true, pageHint: 15, overflowAt: 70, value: (model) => model.hashtag },
  { token: 'content_format', label: 'Content Format', fieldKey: 'contentFormat', kind: 'text', required: true, pageHint: 15, value: (model) => model.contentFormat },
  { token: 'release_start', label: 'Release Start', fieldKey: 'releasePeriod', kind: 'date', required: true, pageHint: 15, value: (model) => formatContractDate(model.releaseStart) },
  { token: 'release_end', label: 'Release End', fieldKey: 'releasePeriod', kind: 'date', required: true, pageHint: 15, value: (model) => formatContractDate(model.releaseEnd) },
  { token: 'language', label: 'Language', fieldKey: 'language', kind: 'text', required: true, pageHint: 15, value: (model) => model.language },
  { token: 'content_length', label: 'Content Length', fieldKey: 'contentLength', kind: 'longText', required: true, pageHint: 15, overflowAt: 280, value: (model) => model.contentLength },
  { token: 'license_period', label: 'License Period', fieldKey: 'licensePeriod', kind: 'text', required: false, pageHint: 15, value: (model) => model.licensePeriod },
  { token: 'license_price', label: 'License Price', fieldKey: 'licensePrice', kind: 'money', required: false, pageHint: 15, value: (model) => formatContractMoneyValue(model.currency, model.licensePrice) },
  { token: 'contract_amount', label: 'Project Total Fees', fieldKey: 'totalFee', kind: 'money', required: true, pageHint: 15, value: (model) => formatContractMoneyValue(model.currency, model.totalFee) },
  { token: 'invoice_issue_days', label: 'Invoice Issue Period', fieldKey: 'invoiceIssueWorkingDays', kind: 'text', required: true, pageHint: 5, value: (model) => `${model.invoiceIssueWorkingDays} working days` },
  { token: 'payment_days', label: 'Payment Term', fieldKey: 'paymentWorkingDays', kind: 'text', required: true, pageHint: 16, value: (model) => `${model.paymentWorkingDays} working days` },
  { token: 'fee_bearer', label: 'Transfer Fee Bearer', fieldKey: 'feeBearer', kind: 'text', required: true, pageHint: 6, value: (model) => model.feeBearer === 'ADVERTISER' ? 'Advertiser' : model.feeBearer === 'PUBLISHER' ? 'Publisher' : model.feeBearer === 'SHARED' ? 'Shared' : '' },
  { token: 'payout_account_name', label: 'Payout Account Name', fieldKey: 'payoutAccount', kind: 'payment', required: true, pageHint: 5, overflowAt: 100, value: (model) => model.payoutProvider === 'PayPal' ? model.paymentSnapshot.paypalUsername : model.paymentSnapshot.accountName },
  { token: 'payout_account_locator', label: 'Payout Account', fieldKey: 'payoutAccount', kind: 'payment', required: true, pageHint: 5, overflowAt: 120, value: payoutAccountLocator },
  { token: 'bank_name', label: 'Beneficiary Bank', fieldKey: 'payoutAccount', kind: 'payment', required: true, pageHint: 5, applicable: (model) => model.payoutProvider === 'Airwallex', value: (model) => model.paymentSnapshot.bankName },
  { token: 'bank_address', label: 'Beneficiary Bank Address', fieldKey: 'payoutAccount', kind: 'payment', required: false, pageHint: 5, overflowAt: 180, applicable: (model) => model.payoutProvider === 'Airwallex', value: bankAddress },
  { token: 'swift_code', label: 'SWIFT Code', fieldKey: 'payoutAccount', kind: 'payment', required: false, pageHint: 5, applicable: (model) => model.payoutProvider === 'Airwallex', value: (model) => model.paymentSnapshot.swiftCode },
  { token: 'iban', label: 'IBAN', fieldKey: 'payoutAccount', kind: 'payment', required: false, pageHint: 5, overflowAt: 80, applicable: (model) => model.payoutProvider === 'Airwallex', value: (model) => model.paymentSnapshot.iban },
  { token: 'paypal_email', label: 'PayPal Email', fieldKey: 'payoutAccount', kind: 'payment', required: true, pageHint: 5, applicable: (model) => model.payoutProvider === 'PayPal', value: (model) => model.paymentSnapshot.paypalEmail },
];

export const placeholderToken = (token: string) => `{{${token}}}`;

export const resolveContractPlaceholder = (
  definition: ContractPlaceholderDefinition,
  model: ContractGenerationModel,
  variant: ContractDocumentVariant,
) => {
  const value = definition.value(model).trim();
  if (value) return value;
  return variant === 'DRAFT' && definition.required ? '待填写' : '';
};

export const replaceContractPlaceholders = (
  value: string,
  model: ContractGenerationModel,
  variant: ContractDocumentVariant,
) => CONTRACT_PLACEHOLDER_DEFINITIONS.reduce(
  (result, definition) => result.split(placeholderToken(definition.token)).join(
    resolveContractPlaceholder(definition, model, variant),
  ),
  value,
);

const isDateAfter = (start: string, end: string) => (
  Boolean(start && end && new Date(`${start}T00:00:00`) > new Date(`${end}T00:00:00`))
);

export const createContractQualityReport = (
  model: ContractGenerationModel,
  additionalIssues: ContractQualityIssue[] = [],
): ContractQualityReport => {
  const applicable = CONTRACT_PLACEHOLDER_DEFINITIONS.filter((definition) => (
    definition.applicable?.(model) ?? true
  ));
  const issues: ContractQualityIssue[] = [];
  applicable.forEach((definition) => {
    const value = definition.value(model).trim();
    if (definition.required && !value) {
      issues.push({
        id: `missing-${definition.token}`,
        kind: 'REQUIRED_MISSING',
        severity: 'BLOCKER',
        fieldKey: definition.fieldKey,
        pageNumber: definition.pageHint,
        message: `${definition.label} 为必填字段`,
      });
    } else if (value && definition.overflowAt && value.length > definition.overflowAt) {
      issues.push({
        id: `overflow-${definition.token}`,
        kind: 'OVERFLOW_RISK',
        severity: 'WARNING',
        fieldKey: definition.fieldKey,
        pageNumber: definition.pageHint,
        message: `${definition.label} 内容较长，将自动换行并可能增加续页`,
      });
    }
  });

  const amount = Number(model.totalFee);
  if (model.totalFee && (!Number.isFinite(amount) || amount <= 0)) {
    issues.push({
      id: 'format-total-fee',
      kind: 'FORMAT_INVALID',
      severity: 'BLOCKER',
      fieldKey: 'totalFee',
      pageNumber: 15,
      message: 'Project Total Fees 必须是大于 0 的金额',
    });
  }
  if (model.licensePrice && (!Number.isFinite(Number(model.licensePrice)) || Number(model.licensePrice) < 0)) {
    issues.push({
      id: 'format-license-price',
      kind: 'FORMAT_INVALID',
      severity: 'BLOCKER',
      fieldKey: 'licensePrice',
      pageNumber: 15,
      message: 'License Price 不能小于 0',
    });
  }
  if (isDateAfter(model.campaignStart, model.campaignEnd)) {
    issues.push({
      id: 'format-campaign-period',
      kind: 'FORMAT_INVALID',
      severity: 'BLOCKER',
      fieldKey: 'campaignPeriod',
      pageNumber: 14,
      message: 'Campaign 结束日期不能早于开始日期',
    });
  }
  if (isDateAfter(model.releaseStart, model.releaseEnd)) {
    issues.push({
      id: 'format-release-period',
      kind: 'FORMAT_INVALID',
      severity: 'BLOCKER',
      fieldKey: 'releasePeriod',
      pageNumber: 15,
      message: '发布结束日期不能早于开始日期',
    });
  }
  if (model.publisher && !model.publisherAddress) {
    issues.push({
      id: 'signature-publisher-address',
      kind: 'SIGNATURE_INCOMPLETE',
      severity: 'BLOCKER',
      fieldKey: 'signature',
      pageNumber: 17,
      message: 'Publisher 打印主体缺少地址',
    });
  }

  issues.push(...additionalIssues);
  const completedFields = applicable.filter((definition) => definition.value(model).trim()).length;
  const missingRequired = issues.filter((issue) => issue.kind === 'REQUIRED_MISSING').length;
  const overflowRisks = issues.filter((issue) => issue.kind === 'OVERFLOW_RISK').length;
  return {
    completedFields,
    totalFields: applicable.length,
    missingRequired,
    overflowRisks,
    issues,
    hasBlockers: issues.some((issue) => issue.severity === 'BLOCKER'),
  };
};

export const pageHintForField = (fieldKey: ContractTemplateFieldKey) => (
  CONTRACT_PLACEHOLDER_DEFINITIONS.find((definition) => definition.fieldKey === fieldKey)?.pageHint ?? 1
);
