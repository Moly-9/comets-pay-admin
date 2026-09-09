import type {
  ContractDocumentVariant,
  ContractGenerationModel,
  ContractQualityIssue,
  ContractQualityReport,
  ContractTemplateFieldKey,
} from './contracts';
import {
  formatContractPublishingChannelLinks,
  formatContractPublishingPlatforms,
  resolveContractPublishingChannels,
} from './contractGenerationModel';
import { getDocumentPayoutSnapshotIssues } from './payoutAccounts';
import {
  contractTemplateOutputFieldApplies,
  resolveContractTemplateOutput,
} from './contractTemplateFieldPolicies';

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
  required: boolean | ((model: ContractGenerationModel) => boolean);
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
  if (!currency.trim()) return value.trim();
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

const hasCreator = (model: ContractGenerationModel) => Boolean(model.creatorId);
const hasPayoutAccount = (model: ContractGenerationModel) => Boolean(model.payoutAccountId);
const isRequired = (
  definition: ContractPlaceholderDefinition,
  model: ContractGenerationModel,
) => (
  typeof definition.required === 'function'
    ? definition.required(model)
    : definition.required
);

export const CONTRACT_PLACEHOLDER_DEFINITIONS: ContractPlaceholderDefinition[] = [
  { token: 'advertiser_name', label: 'Advertiser', fieldKey: 'signature', kind: 'text', required: true, pageHint: 1, overflowAt: 100, value: (model) => resolveContractTemplateOutput(model).values.advertiser },
  { token: 'publisher_name', label: 'Publisher', fieldKey: 'publisher', kind: 'text', required: hasCreator, pageHint: 1, overflowAt: 72, value: (model) => resolveContractTemplateOutput(model).values.publisher },
  { token: 'publisher_address', label: 'Publisher Address', fieldKey: 'publisherAddress', kind: 'longText', required: hasCreator, pageHint: 14, overflowAt: 180, value: (model) => model.publisherAddress },
  { token: 'channel_url', label: 'Channel Link', fieldKey: 'channelUrl', kind: 'longText', required: false, pageHint: 1, overflowAt: 240, value: (model) => formatContractPublishingChannelLinks(resolveContractTemplateOutput(model).effectiveModel) || '—' },
  { token: 'platform', label: 'Publishing Platform', fieldKey: 'platform', kind: 'text', required: false, pageHint: 1, overflowAt: 120, value: (model) => formatContractPublishingPlatforms(resolveContractTemplateOutput(model).effectiveModel) || '—' },
  { token: 'effective_date', label: 'Effective Date', fieldKey: 'effectiveDate', kind: 'date', required: false, pageHint: 14, value: (model) => formatContractDate(model.effectiveDate) },
  { token: 'project_name', label: 'Project Name', fieldKey: 'projectName', kind: 'longText', required: false, pageHint: 14, overflowAt: 120, value: (model) => model.projectName },
  { token: 'channel_name', label: 'Channel Name', fieldKey: 'channelName', kind: 'text', required: false, pageHint: 14, overflowAt: 90, value: (model) => model.channelName || '—' },
  { token: 'campaign_purpose', label: 'Campaign Purpose', fieldKey: 'purposeItems', kind: 'longText', required: false, pageHint: 15, overflowAt: 280, value: (model) => model.purposeItems.join('\n') },
  { token: 'promoted_product', label: 'Promoted Product', fieldKey: 'promotedProduct', kind: 'longText', required: false, pageHint: 15, overflowAt: 120, value: (model) => model.promotedProduct },
  { token: 'hashtag', label: 'Hashtag', fieldKey: 'hashtag', kind: 'text', required: false, pageHint: 15, overflowAt: 70, value: (model) => model.hashtag },
  { token: 'content_format', label: 'Content Format', fieldKey: 'contentFormat', kind: 'text', required: false, pageHint: 15, value: (model) => model.contentFormat },
  { token: 'release_start', label: 'Release Start', fieldKey: 'releasePeriod', kind: 'date', required: false, pageHint: 15, value: (model) => formatContractDate(model.releaseStart) },
  { token: 'release_end', label: 'Release End', fieldKey: 'releasePeriod', kind: 'date', required: false, pageHint: 15, value: (model) => formatContractDate(model.releaseEnd) },
  { token: 'language', label: 'Language', fieldKey: 'language', kind: 'text', required: false, pageHint: 15, value: (model) => model.language },
  { token: 'content_length', label: 'Content Length', fieldKey: 'contentLength', kind: 'longText', required: false, pageHint: 15, overflowAt: 280, value: (model) => model.contentLength },
  { token: 'license_period', label: 'License Period', fieldKey: 'licensePeriod', kind: 'text', required: false, pageHint: 15, value: (model) => model.licensePeriod },
  { token: 'license_price', label: 'License Price', fieldKey: 'licensePrice', kind: 'money', required: false, pageHint: 15, value: (model) => formatContractMoneyValue(model.currency, model.licensePrice) },
  { token: 'contract_amount', label: 'Project Total Fees', fieldKey: 'totalFee', kind: 'money', required: false, pageHint: 15, value: (model) => formatContractMoneyValue(model.currency, model.totalFee) },
  { token: 'invoice_issue_days', label: 'Invoice Issue Period', fieldKey: 'invoiceIssueWorkingDays', kind: 'text', required: false, pageHint: 5, value: (model) => model.invoiceIssueWorkingDays > 0 ? `${model.invoiceIssueWorkingDays} working days` : '' },
  { token: 'payment_days', label: 'Payment Term', fieldKey: 'paymentWorkingDays', kind: 'text', required: false, pageHint: 16, value: (model) => model.paymentWorkingDays ? `${model.paymentWorkingDays} working days` : '' },
  { token: 'fee_bearer', label: 'Transfer Fee Bearer', fieldKey: 'feeBearer', kind: 'text', required: false, pageHint: 6, value: (model) => model.feeBearer === 'ADVERTISER' ? 'Advertiser' : model.feeBearer === 'PUBLISHER' ? 'Publisher' : model.feeBearer === 'SHARED' ? 'Shared' : '' },
  { token: 'account_name', label: 'Account Name', fieldKey: 'payoutAccount', kind: 'payment', required: hasPayoutAccount, pageHint: 5, overflowAt: 100, applicable: (model) => contractTemplateOutputFieldApplies('accountName', model.payoutProvider), value: (model) => resolveContractTemplateOutput(model).values.accountName },
  { token: 'account_number', label: 'Account Number', fieldKey: 'payoutAccount', kind: 'payment', required: false, pageHint: 5, overflowAt: 120, applicable: (model) => contractTemplateOutputFieldApplies('accountNumber', model.payoutProvider), value: (model) => resolveContractTemplateOutput(model).values.accountNumber },
  { token: 'beneficiary_bank_name', label: 'Beneficiary Bank Name', fieldKey: 'payoutAccount', kind: 'payment', required: hasPayoutAccount, pageHint: 5, applicable: (model) => contractTemplateOutputFieldApplies('beneficiaryBankName', model.payoutProvider), value: (model) => resolveContractTemplateOutput(model).values.beneficiaryBankName },
  { token: 'beneficiary_bank_address', label: 'Beneficiary Bank Address', fieldKey: 'payoutAccount', kind: 'payment', required: false, pageHint: 5, overflowAt: 180, applicable: (model) => contractTemplateOutputFieldApplies('beneficiaryBankAddress', model.payoutProvider), value: (model) => resolveContractTemplateOutput(model).values.beneficiaryBankAddress },
  { token: 'swift_code', label: 'SWIFT Code', fieldKey: 'payoutAccount', kind: 'payment', required: false, pageHint: 5, applicable: (model) => contractTemplateOutputFieldApplies('swiftCode', model.payoutProvider), value: (model) => resolveContractTemplateOutput(model).values.swiftCode },
  { token: 'iban', label: 'IBAN', fieldKey: 'payoutAccount', kind: 'payment', required: false, pageHint: 5, overflowAt: 80, applicable: (model) => contractTemplateOutputFieldApplies('iban', model.payoutProvider), value: (model) => resolveContractTemplateOutput(model).values.iban },
  { token: 'remittance_information', label: 'Remittance Information', fieldKey: 'payoutAccount', kind: 'payment', required: false, pageHint: 5, overflowAt: 180, applicable: (model) => contractTemplateOutputFieldApplies('remittanceInformation', model.payoutProvider), value: (model) => resolveContractTemplateOutput(model).values.remittanceInformation },
  { token: 'paypal_username', label: 'PayPal Username', fieldKey: 'payoutAccount', kind: 'payment', required: hasPayoutAccount, pageHint: 5, overflowAt: 100, applicable: (model) => contractTemplateOutputFieldApplies('paypalUsername', model.payoutProvider), value: (model) => resolveContractTemplateOutput(model).values.paypalUsername },
  { token: 'paypal_email', label: 'PayPal Email Address', fieldKey: 'payoutAccount', kind: 'payment', required: hasPayoutAccount, pageHint: 5, applicable: (model) => contractTemplateOutputFieldApplies('paypalEmailAddress', model.payoutProvider), value: (model) => resolveContractTemplateOutput(model).values.paypalEmailAddress },
  { token: 'transfer_note', label: 'Transfer Note', fieldKey: 'payoutAccount', kind: 'payment', required: false, pageHint: 5, overflowAt: 180, applicable: (model) => contractTemplateOutputFieldApplies('transferNote', model.payoutProvider), value: (model) => resolveContractTemplateOutput(model).values.transferNote },
];

export const placeholderToken = (token: string) => `{{${token}}}`;

export const resolveContractPlaceholder = (
  definition: ContractPlaceholderDefinition,
  model: ContractGenerationModel,
  variant: ContractDocumentVariant,
) => {
  const value = definition.value(model).trim();
  if (value) return value;
  return variant === 'DRAFT' && isRequired(definition, model) ? '待填写' : '';
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
  const output = resolveContractTemplateOutput(model);
  const effectiveModel = output.effectiveModel;
  const applicable = CONTRACT_PLACEHOLDER_DEFINITIONS.filter((definition) => (
    definition.applicable?.(effectiveModel) ?? true
  ));
  const issues: ContractQualityIssue[] = [];
  if (!effectiveModel.creatorId) {
    issues.push({
      id: 'missing-creator-selection',
      kind: 'REQUIRED_MISSING',
      severity: 'BLOCKER',
      fieldKey: 'publisher',
      pageNumber: 1,
      message: '请选择合作达人',
    });
  }
  if (!effectiveModel.projectId) {
    issues.push({
      id: 'missing-project-selection',
      kind: 'REQUIRED_MISSING',
      severity: 'BLOCKER',
      fieldKey: 'projectName',
      pageNumber: 14,
      message: '请选择关联项目',
    });
  }
  if (!effectiveModel.payoutAccountId) {
    issues.push({
      id: 'missing-payout-account-selection',
      kind: 'REQUIRED_MISSING',
      severity: 'BLOCKER',
      fieldKey: 'payoutAccount',
      pageNumber: 5,
      message: '请选择达人已验证的收款账户',
    });
  }
  if (effectiveModel.creatorId) {
    const publishingChannels = resolveContractPublishingChannels(effectiveModel);
    const invalidUrlIndex = publishingChannels.findIndex((channel) => {
      const value = channel.channelUrl.trim();
      if (!value) return false;
      try {
        const url = new URL(value);
        return url.protocol !== 'http:' && url.protocol !== 'https:';
      } catch {
        return true;
      }
    });
    if (invalidUrlIndex >= 0) {
      issues.push({
        id: 'format-channel-url',
        kind: 'FORMAT_INVALID',
        severity: 'BLOCKER',
        fieldKey: 'channelUrl',
        pageNumber: 1,
        message: `第 ${invalidUrlIndex + 1} 个频道链接格式无效`,
      });
    }
  }
  applicable.forEach((definition) => {
    const value = definition.value(effectiveModel).trim();
    if (isRequired(definition, effectiveModel) && !value) {
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

  const amount = Number(effectiveModel.totalFee);
  if (effectiveModel.totalFee && (!Number.isFinite(amount) || amount <= 0)) {
    issues.push({
      id: 'format-total-fee',
      kind: 'FORMAT_INVALID',
      severity: 'BLOCKER',
      fieldKey: 'totalFee',
      pageNumber: 15,
      message: 'Project Total Fees 必须是大于 0 的金额',
    });
  }
  if (effectiveModel.licensePrice && (!Number.isFinite(Number(effectiveModel.licensePrice)) || Number(effectiveModel.licensePrice) < 0)) {
    issues.push({
      id: 'format-license-price',
      kind: 'FORMAT_INVALID',
      severity: 'BLOCKER',
      fieldKey: 'licensePrice',
      pageNumber: 15,
      message: 'License Price 不能小于 0',
    });
  }
  if ((effectiveModel.totalFee || effectiveModel.licensePrice) && !effectiveModel.currency) {
    issues.push({
      id: 'format-currency',
      kind: 'FORMAT_INVALID',
      severity: 'BLOCKER',
      fieldKey: 'totalFee',
      pageNumber: 15,
      message: '填写金额时必须选择币种',
    });
  }
  if (
    effectiveModel.payoutAccountId
    && effectiveModel.payoutProvider === 'PayPal'
    && effectiveModel.paymentSnapshot.paypalEmail
    && !/^\S+@\S+\.\S+$/.test(effectiveModel.paymentSnapshot.paypalEmail.trim())
  ) {
    issues.push({
      id: 'format-paypal-email',
      kind: 'FORMAT_INVALID',
      severity: 'BLOCKER',
      fieldKey: 'payoutAccount',
      pageNumber: 5,
      message: 'PayPal Email 格式无效',
    });
  }
  if (Boolean(effectiveModel.releaseStart) !== Boolean(effectiveModel.releaseEnd)) {
    issues.push({
      id: 'format-release-period-incomplete',
      kind: 'FORMAT_INVALID',
      severity: 'BLOCKER',
      fieldKey: 'releasePeriod',
      pageNumber: 15,
      message: '发布日期需同时填写开始和结束日期',
    });
  }
  if (isDateAfter(effectiveModel.releaseStart, effectiveModel.releaseEnd)) {
    issues.push({
      id: 'format-release-period',
      kind: 'FORMAT_INVALID',
      severity: 'BLOCKER',
      fieldKey: 'releasePeriod',
      pageNumber: 15,
      message: '发布结束日期不能早于开始日期',
    });
  }
  if (effectiveModel.payoutAccountId) {
    const payoutIssues = getDocumentPayoutSnapshotIssues(
      effectiveModel.paymentSnapshot,
      effectiveModel.payoutProvider,
    );
    payoutIssues.forEach((issue, index) => {
      issues.push({
        id: `payout-policy-${issue.fieldKey}-${index}`,
        kind: 'REQUIRED_MISSING',
        severity: 'BLOCKER',
        fieldKey: 'payoutAccount',
        pageNumber: 5,
        message: issue.message,
      });
    });
  }
  issues.push(...additionalIssues);
  const deduplicatedIssues = [...new Map(issues.map((issue) => [`${issue.kind}:${issue.fieldKey}:${issue.message}`, issue])).values()];
  const completedFields = applicable.filter((definition) => definition.value(effectiveModel).trim()).length;
  const missingRequired = deduplicatedIssues.filter((issue) => issue.kind === 'REQUIRED_MISSING').length;
  const overflowRisks = deduplicatedIssues.filter((issue) => issue.kind === 'OVERFLOW_RISK').length;
  return {
    completedFields,
    totalFields: applicable.length,
    missingRequired,
    overflowRisks,
    issues: deduplicatedIssues,
    hasBlockers: deduplicatedIssues.some((issue) => issue.severity === 'BLOCKER'),
  };
};

export const pageHintForField = (fieldKey: ContractTemplateFieldKey) => (
  CONTRACT_PLACEHOLDER_DEFINITIONS.find((definition) => definition.fieldKey === fieldKey)?.pageHint ?? 1
);
