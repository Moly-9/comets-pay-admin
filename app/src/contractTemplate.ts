import type { ContractGenerationModel } from './contracts';

export const CONTRACT_TEMPLATE_URL = '/contracts/single-campaign-contract-template-v1.pdf';
export const CONTRACT_TEMPLATE_PAGE_COUNT = 17;
export const CONTRACT_TEMPLATE_WIDTH = 595.92;
export const CONTRACT_TEMPLATE_HEIGHT = 841.92;

export type ContractTemplateFieldKey =
  | 'publisher'
  | 'publisherAddress'
  | 'channelUrl'
  | 'platform'
  | 'invoiceIssueWorkingDays'
  | 'payoutAccount'
  | 'feeBearer'
  | 'effectiveDate'
  | 'campaignPeriod'
  | 'projectName'
  | 'channelName'
  | 'purposeItems'
  | 'promotedProduct'
  | 'hashtag'
  | 'contentFormat'
  | 'releasePeriod'
  | 'language'
  | 'contentLength'
  | 'licensePeriod'
  | 'licensePrice'
  | 'totalFee'
  | 'paymentWorkingDays'
  | 'signature';

export type ContractTemplateRect = {
  page: number;
  x: number;
  top: number;
  width: number;
  height: number;
};

export type ContractTemplateFieldBinding = ContractTemplateRect & {
  id: string;
  fieldKey: ContractTemplateFieldKey;
  fontSize: number;
  maxLines?: number;
  value: (model: ContractGenerationModel) => string;
};

const formatDate = (value: string) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const bankAddress = (model: ContractGenerationModel) => [
  model.paymentSnapshot.bankStreetAddress,
  model.paymentSnapshot.bankCity,
  model.paymentSnapshot.bankState,
  model.paymentSnapshot.bankPostalCode,
  model.paymentSnapshot.bankCountry,
].filter(Boolean).join(', ');

const payoutValue = (
  model: ContractGenerationModel,
  bankValue: keyof ContractGenerationModel['paymentSnapshot'],
  paypalValue: keyof ContractGenerationModel['paymentSnapshot'],
) => String(model.paymentSnapshot[
  model.payoutProvider === 'PayPal' ? paypalValue : bankValue
] ?? '');

export const CONTRACT_TEMPLATE_FIELD_BINDINGS: ContractTemplateFieldBinding[] = [
  { id: 'p1-publisher', fieldKey: 'publisher', page: 1, x: 43, top: 211, width: 238, height: 18, fontSize: 8, value: (model) => model.publisher },
  { id: 'p1-channel', fieldKey: 'channelUrl', page: 1, x: 388, top: 211, width: 168, height: 37, fontSize: 5.8, maxLines: 2, value: (model) => model.channelUrl },
  { id: 'p1-platform', fieldKey: 'platform', page: 1, x: 30, top: 251, width: 188, height: 17, fontSize: 8, value: (model) => model.platform },
  { id: 'p5-invoice-days', fieldKey: 'invoiceIssueWorkingDays', page: 5, x: 212, top: 194, width: 90, height: 18, fontSize: 8, value: (model) => `${model.invoiceIssueWorkingDays} working days` },
  { id: 'p5-account-name', fieldKey: 'payoutAccount', page: 5, x: 190, top: 334, width: 355, height: 13, fontSize: 7.2, value: (model) => payoutValue(model, 'accountName', 'paypalUsername') },
  { id: 'p5-account-number', fieldKey: 'payoutAccount', page: 5, x: 190, top: 364, width: 355, height: 13, fontSize: 7.2, value: (model) => model.payoutProvider === 'PayPal' ? '' : model.paymentSnapshot.accountNumber },
  { id: 'p5-bank-name', fieldKey: 'payoutAccount', page: 5, x: 190, top: 394, width: 355, height: 13, fontSize: 7.2, value: (model) => model.payoutProvider === 'PayPal' ? '' : model.paymentSnapshot.bankName },
  { id: 'p5-bank-address', fieldKey: 'payoutAccount', page: 5, x: 190, top: 424, width: 355, height: 13, fontSize: 6.5, value: (model) => model.payoutProvider === 'PayPal' ? '' : bankAddress(model) },
  { id: 'p5-swift', fieldKey: 'payoutAccount', page: 5, x: 190, top: 454, width: 355, height: 13, fontSize: 7.2, value: (model) => model.payoutProvider === 'PayPal' ? '' : model.paymentSnapshot.swiftCode },
  { id: 'p5-iban', fieldKey: 'payoutAccount', page: 5, x: 190, top: 484, width: 355, height: 13, fontSize: 7.2, value: (model) => model.payoutProvider === 'PayPal' ? '' : model.paymentSnapshot.iban },
  { id: 'p5-bank-remittance', fieldKey: 'payoutAccount', page: 5, x: 190, top: 514, width: 355, height: 13, fontSize: 6.5, value: (model) => model.payoutProvider === 'PayPal' ? '' : model.paymentSnapshot.transferRemarks },
  { id: 'p5-paypal-name', fieldKey: 'payoutAccount', page: 5, x: 180, top: 623, width: 365, height: 13, fontSize: 7.2, value: (model) => model.payoutProvider === 'PayPal' ? model.paymentSnapshot.paypalUsername : '' },
  { id: 'p5-paypal-email', fieldKey: 'payoutAccount', page: 5, x: 180, top: 653, width: 365, height: 13, fontSize: 7.2, value: (model) => model.payoutProvider === 'PayPal' ? model.paymentSnapshot.paypalEmail : '' },
  { id: 'p5-paypal-remittance', fieldKey: 'payoutAccount', page: 5, x: 180, top: 713, width: 365, height: 13, fontSize: 6.5, value: (model) => model.payoutProvider === 'PayPal' ? model.paymentSnapshot.transferRemarks : '' },
  { id: 'p6-fee', fieldKey: 'feeBearer', page: 6, x: 389, top: 556, width: 18, height: 17, fontSize: 8, value: (model) => model.feeBearer === 'SHARED' ? 'i' : model.feeBearer === 'ADVERTISER' ? 'ii' : model.feeBearer === 'PUBLISHER' ? 'iii' : '' },
  { id: 'p13-publisher', fieldKey: 'publisher', page: 13, x: 299, top: 791, width: 215, height: 13, fontSize: 7, value: (model) => model.publisher },
  { id: 'p14-advertiser-title', fieldKey: 'signature', page: 14, x: 63, top: 145, width: 92, height: 13, fontSize: 7.5, value: () => 'Influencer Manager' },
  { id: 'p14-publisher-name', fieldKey: 'publisher', page: 14, x: 332, top: 99, width: 190, height: 13, fontSize: 7, value: (model) => model.publisher },
  { id: 'p14-publisher-address', fieldKey: 'publisherAddress', page: 14, x: 299, top: 245, width: 245, height: 28, fontSize: 6.4, maxLines: 2, value: (model) => model.publisherAddress },
  { id: 'p14-io-publisher', fieldKey: 'publisher', page: 14, x: 30, top: 446, width: 200, height: 17, fontSize: 6.8, value: (model) => model.publisher },
  { id: 'p14-io-channel', fieldKey: 'channelUrl', page: 14, x: 311, top: 446, width: 168, height: 17, fontSize: 5.8, value: (model) => model.channelUrl },
  { id: 'p14-effective', fieldKey: 'effectiveDate', page: 14, x: 500, top: 466, width: 57, height: 35, fontSize: 5.7, maxLines: 2, value: (model) => formatDate(model.effectiveDate) },
  { id: 'p14-campaign-period', fieldKey: 'campaignPeriod', page: 14, x: 151, top: 626, width: 165, height: 17, fontSize: 5.7, value: (model) => `${formatDate(model.campaignStart)} to ${formatDate(model.campaignEnd)}` },
  { id: 'p14-project', fieldKey: 'projectName', page: 14, x: 258, top: 701, width: 285, height: 13, fontSize: 7, value: (model) => model.projectName },
  { id: 'p14-channel-name', fieldKey: 'channelName', page: 14, x: 258, top: 731, width: 285, height: 13, fontSize: 7, value: (model) => model.channelName },
  { id: 'p14-start', fieldKey: 'campaignPeriod', page: 14, x: 258, top: 761, width: 285, height: 13, fontSize: 7, value: (model) => formatDate(model.campaignStart) },
  { id: 'p14-end', fieldKey: 'campaignPeriod', page: 14, x: 258, top: 791, width: 285, height: 13, fontSize: 7, value: (model) => formatDate(model.campaignEnd) },
  { id: 'p15-purpose', fieldKey: 'purposeItems', page: 15, x: 258, top: 35, width: 285, height: 60, fontSize: 6.6, maxLines: 4, value: (model) => ['The video will help to promote:', ...model.purposeItems.map((item, index) => `${index + 1}. ${item}`)].join('\n') },
  { id: 'p15-product', fieldKey: 'promotedProduct', page: 15, x: 412, top: 166, width: 132, height: 31, fontSize: 6.2, maxLines: 2, value: (model) => model.promotedProduct },
  { id: 'p15-hashtag', fieldKey: 'hashtag', page: 15, x: 462, top: 261, width: 80, height: 13, fontSize: 5.2, value: (model) => `#${model.hashtag.replace(/^#/, '')} in the` },
  { id: 'p15-format', fieldKey: 'contentFormat', page: 15, x: 258, top: 385, width: 285, height: 13, fontSize: 7, value: (model) => model.contentFormat },
  { id: 'p15-release-start', fieldKey: 'releasePeriod', page: 15, x: 421, top: 415, width: 122, height: 13, fontSize: 5.8, value: (model) => formatDate(model.releaseStart) },
  { id: 'p15-release-end', fieldKey: 'releasePeriod', page: 15, x: 258, top: 432, width: 285, height: 13, fontSize: 6.6, value: (model) => formatDate(model.releaseEnd) },
  { id: 'p15-language', fieldKey: 'language', page: 15, x: 258, top: 462, width: 285, height: 13, fontSize: 7, value: (model) => model.language },
  { id: 'p15-platform', fieldKey: 'platform', page: 15, x: 258, top: 492, width: 285, height: 13, fontSize: 7, value: (model) => model.platform },
  { id: 'p15-channel', fieldKey: 'channelUrl', page: 15, x: 258, top: 522, width: 285, height: 13, fontSize: 6.2, value: (model) => model.channelUrl },
  { id: 'p15-length', fieldKey: 'contentLength', page: 15, x: 258, top: 552, width: 285, height: 107, fontSize: 6.6, maxLines: 6, value: (model) => model.contentLength },
  { id: 'p15-license-period', fieldKey: 'licensePeriod', page: 15, x: 258, top: 675, width: 285, height: 13, fontSize: 7, value: (model) => model.licensePeriod },
  { id: 'p15-license-price', fieldKey: 'licensePrice', page: 15, x: 258, top: 705, width: 285, height: 13, fontSize: 7, value: (model) => model.licensePrice ? `${model.currency} ${model.licensePrice}` : '' },
  { id: 'p15-total', fieldKey: 'totalFee', page: 15, x: 258, top: 735, width: 285, height: 13, fontSize: 7.2, value: (model) => model.totalFee ? `${model.currency} ${model.totalFee}` : '' },
  { id: 'p16-payment-days', fieldKey: 'paymentWorkingDays', page: 16, x: 102, top: 466, width: 38, height: 17, fontSize: 8, value: (model) => String(model.paymentWorkingDays) },
  { id: 'p17-publisher', fieldKey: 'publisher', page: 17, x: 398, top: 29, width: 143, height: 31, fontSize: 6.8, maxLines: 2, value: (model) => model.publisher },
];

export const CONTRACT_TEMPLATE_YELLOW_RECTS: ContractTemplateRect[] = [
  { page: 1, x: 42, top: 210.75, width: 246.75, height: 21 },
  { page: 1, x: 381, top: 210.75, width: 155.25, height: 21 },
  { page: 1, x: 29.25, top: 230.25, width: 74.25, height: 21 },
  { page: 1, x: 494.25, top: 230.25, width: 64.5, height: 21 },
  { page: 1, x: 29.25, top: 249.75, width: 192.75, height: 21 },
  { page: 5, x: 211.5, top: 193.5, width: 91.5, height: 21 },
  ...[333.75, 363.75, 393.75, 423.75, 453.75, 483.75].map((top) => ({ page: 5, x: 189.75, top, width: 44.25, height: 15 })),
  { page: 5, x: 189.75, top: 513.75, width: 100.5, height: 15 },
  { page: 5, x: 179.25, top: 622.5, width: 44.25, height: 15 },
  { page: 5, x: 179.25, top: 652.5, width: 44.25, height: 15 },
  { page: 5, x: 179.25, top: 712.5, width: 100.5, height: 15 },
  { page: 6, x: 389.25, top: 555, width: 18.75, height: 21 },
  { page: 13, x: 298.5, top: 790.5, width: 246, height: 16 },
  { page: 14, x: 71.25, top: 98.25, width: 30.75, height: 15 },
  { page: 14, x: 62.25, top: 144.75, width: 94.5, height: 15 },
  { page: 14, x: 62.25, top: 190.5, width: 48.75, height: 16.5 },
  { page: 14, x: 332.25, top: 98.25, width: 26.25, height: 15 },
  { page: 14, x: 327.75, top: 144.75, width: 23.25, height: 15 },
  { page: 14, x: 332.25, top: 190.5, width: 49.5, height: 16.5 },
  { page: 14, x: 298.5, top: 244.5, width: 96, height: 15 },
  { page: 14, x: 512.25, top: 425.25, width: 44.25, height: 21 },
  { page: 14, x: 29.25, top: 444.75, width: 202.5, height: 21 },
  { page: 14, x: 310.5, top: 444.75, width: 170.25, height: 21 },
  { page: 14, x: 519.75, top: 463.5, width: 39, height: 22.5 },
  { page: 14, x: 28.5, top: 483, width: 48, height: 22.5 },
  { page: 14, x: 146.25, top: 623.25, width: 180, height: 23.25 },
  { page: 14, x: 258, top: 700.5, width: 44.25, height: 15 },
  { page: 14, x: 258, top: 730.5, width: 213, height: 15 },
  { page: 14, x: 258, top: 760.5, width: 27.75, height: 15 },
  { page: 14, x: 258, top: 790.5, width: 27.75, height: 15 },
  { page: 15, x: 257.25, top: 33.75, width: 287.25, height: 62.25 },
  { page: 15, x: 411.75, top: 165.75, width: 113.25, height: 15 },
  { page: 15, x: 276, top: 182.25, width: 123.75, height: 15 },
  { page: 15, x: 461.25, top: 259.5, width: 82.5, height: 16.5 },
  { page: 15, x: 258, top: 384, width: 184.5, height: 15 },
  { page: 15, x: 421.5, top: 414, width: 75.75, height: 15 },
  { page: 15, x: 258, top: 431.25, width: 75, height: 15 },
  { page: 15, x: 258, top: 461.25, width: 78, height: 15 },
  { page: 15, x: 258, top: 491.25, width: 82.5, height: 15 },
  { page: 15, x: 258, top: 521.25, width: 169.5, height: 15 },
  ...[551.25, 574.5, 597.75, 621, 644.25].map((top) => ({ page: 15, x: 258, top, width: 210, height: 15 })),
  { page: 15, x: 258, top: 674.25, width: 207.75, height: 15 },
  { page: 15, x: 258, top: 704.25, width: 198, height: 15 },
  { page: 15, x: 258, top: 734.25, width: 114, height: 15 },
  { page: 16, x: 101.25, top: 465, width: 39.75, height: 21 },
  { page: 17, x: 63, top: 115.5, width: 52.5, height: 15 },
  { page: 17, x: 398.25, top: 28.5, width: 123.75, height: 15 },
  { page: 17, x: 298.5, top: 45.75, width: 32.25, height: 15 },
  { page: 17, x: 324, top: 115.5, width: 54.75, height: 15 },
];

export const bindingsForField = (fieldKey: ContractTemplateFieldKey) => (
  CONTRACT_TEMPLATE_FIELD_BINDINGS.filter((binding) => binding.fieldKey === fieldKey)
);
