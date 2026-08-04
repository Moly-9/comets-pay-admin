import type { ContractGenerationModel, ContractPaymentMethod } from './contracts';
import {
  getDefaultPayoutAccount,
  isPayoutAccountVerified,
  payoutAccountToInvoicePayment,
} from './payoutAccounts';
import type { CreatorPayoutAccount, CreatorProfile } from './types';

export const eligibleContractPayoutAccounts = (creator: CreatorProfile | null | undefined) => (
  creator?.payoutAccounts.filter((account) => (
    account.status !== 'DISABLED'
    && isPayoutAccountVerified(account)
    && (account.provider === 'Airwallex' || account.provider === 'PayPal')
  )) ?? []
);

export const defaultContractPayoutAccount = (
  creator: CreatorProfile | null | undefined,
) => {
  const eligible = eligibleContractPayoutAccounts(creator);
  const profileDefault = getDefaultPayoutAccount(creator?.payoutAccounts ?? []);
  return eligible.find((account) => account.id === profileDefault?.id)
    ?? eligible.find((account) => account.isDefault)
    ?? eligible[0]
    ?? null;
};

export const contractPaymentMethodForAccount = (
  account: CreatorPayoutAccount | null,
): ContractPaymentMethod => (
  account?.provider === 'PayPal'
    ? 'PAYPAL'
    : account?.provider === 'Airwallex'
      ? 'AIRWALLEX'
      : ''
);

export const contractPayoutSnapshot = (account: CreatorPayoutAccount | null) => (
  payoutAccountToInvoicePayment(account)
);

const isDateAfter = (start: string, end: string) => (
  Boolean(start && end && new Date(`${start}T00:00:00`) > new Date(`${end}T00:00:00`))
);

export const validateContractGenerationModel = (
  model: ContractGenerationModel,
) => {
  const errors: Record<string, string> = {};
  const required: Array<[string, string, string | number | boolean]> = [
    ['project', '请选择关联项目', model.projectId],
    ['creator', '请选择合作达人', model.creatorId],
    ['publisher', '达人档案缺少法定名称', model.publisher],
    ['publisherAddress', '达人档案缺少联系地址', model.publisherAddress],
    ['channelName', '达人档案缺少频道名称', model.channelName],
    ['channelUrl', '达人档案缺少频道链接', model.channelUrl],
    ['platform', '达人档案缺少发布平台', model.platform],
    ['effectiveDate', '请选择合同生效日期', model.effectiveDate],
    ['campaignStart', '请选择 Campaign 开始日期', model.campaignStart],
    ['campaignEnd', '请选择 Campaign 结束日期', model.campaignEnd],
    ['purposeItems', '请至少填写一项推广目的', model.purposeItems.some((item) => item.trim())],
    ['promotedProduct', '请填写推广产品或活动名称', model.promotedProduct],
    ['hashtag', '请填写合同要求的 Hashtag', model.hashtag],
    ['contentFormat', '请选择内容形式', model.contentFormat],
    ['releaseStart', '请选择发布开始日期', model.releaseStart],
    ['releaseEnd', '请选择发布结束日期', model.releaseEnd],
    ['language', '请填写内容语言', model.language],
    ['contentLength', '请填写内容时长要求', model.contentLength],
    ['currency', '请选择合同币种', model.currency],
    ['totalFee', '请填写 Project Total Fees', model.totalFee],
    ['feeBearer', '请选择转账手续费承担方', model.feeBearer],
    ['payoutAccountId', '达人没有可用于合同的已验证 Airwallex 或 PayPal 账户', model.payoutAccountId],
  ];
  required.forEach(([key, message, value]) => {
    if (!value) errors[key] = message;
  });

  const amount = Number(model.totalFee);
  if (model.totalFee && (!Number.isFinite(amount) || amount <= 0)) {
    errors.totalFee = 'Project Total Fees 必须大于 0';
  }
  const licensePrice = model.licensePrice ? Number(model.licensePrice) : null;
  if (licensePrice !== null && (!Number.isFinite(licensePrice) || licensePrice < 0)) {
    errors.licensePrice = 'License Price 不能小于 0';
  }
  if (!(model.invoiceIssueWorkingDays > 0)) {
    errors.invoiceIssueWorkingDays = 'Invoice 开具天数必须大于 0';
  }
  if (![45, 60].includes(model.paymentWorkingDays)) {
    errors.paymentWorkingDays = '付款期限只能选择 45 或 60 个工作日';
  }
  if (isDateAfter(model.campaignStart, model.campaignEnd)) {
    errors.campaignEnd = 'Campaign 结束日期不能早于开始日期';
  }
  if (isDateAfter(model.releaseStart, model.releaseEnd)) {
    errors.releaseEnd = '发布结束日期不能早于开始日期';
  }
  if (model.purposeItems.some((item) => item.length > 84)) {
    errors.purposeItems = '单条推广目的不能超过 84 个字符';
  }
  if (model.purposeItems.filter((item) => item.trim()).length > 3) {
    errors.purposeItems = '模板最多容纳 3 条推广目的';
  }
  if (model.contentLength.length > 320) {
    errors.contentLength = '内容时长说明不能超过 320 个字符';
  }
  if (model.payoutProvider === 'PayPal') {
    if (!model.paymentSnapshot.paypalUsername.trim()) errors.payoutAccountId = 'PayPal 账户缺少用户名';
    if (!/^\S+@\S+\.\S+$/.test(model.paymentSnapshot.paypalEmail)) errors.payoutAccountId = 'PayPal 账户邮箱无效';
  } else {
    if (!model.paymentSnapshot.accountName.trim()) errors.payoutAccountId = '银行账户缺少 Account Name';
    if (!model.paymentSnapshot.accountNumber.trim() && !model.paymentSnapshot.iban.trim()) {
      errors.payoutAccountId = '银行账户缺少 Account Number 或 IBAN';
    }
  }
  return errors;
};
