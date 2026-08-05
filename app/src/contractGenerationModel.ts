import type {
  ContractGenerationModel,
  ContractPaymentMethod,
  ContractPublishingChannel,
} from './contracts';
import {
  getDefaultPayoutAccount,
  isPayoutAccountVerified,
  payoutAccountToInvoicePayment,
} from './payoutAccounts';
import type { CreatorPayoutAccount, CreatorProfile } from './types';

const legacyPublishingChannel = (
  model: Pick<ContractGenerationModel, 'platform' | 'channelUrl'>,
): ContractPublishingChannel[] => (
  model.platform.trim() || model.channelUrl.trim()
    ? [{
        socialAccountId: '',
        platform: model.platform.trim(),
        channelUrl: model.channelUrl.trim(),
      }]
    : []
);

export const resolveContractPublishingChannels = (
  model: Pick<ContractGenerationModel, 'platform' | 'channelUrl'> & {
    publishingChannels?: ContractPublishingChannel[];
  },
) => {
  const channels = model.publishingChannels ?? [];
  return channels.length
    ? channels.map((channel) => ({ ...channel }))
    : legacyPublishingChannel(model);
};

export const contractPublishingChannelsForCreator = (
  creator: CreatorProfile | null | undefined,
  savedModel?: Pick<ContractGenerationModel, 'platform' | 'channelUrl'> & {
    publishingChannels?: ContractPublishingChannel[];
  },
): ContractPublishingChannel[] => {
  if (savedModel) {
    const saved = resolveContractPublishingChannels(savedModel);
    if (saved.length) return saved;
  }
  if (creator?.socialAccounts.length) {
    return creator.socialAccounts.map((account) => ({
      socialAccountId: account.id,
      platform: account.platform,
      channelUrl: account.profileUrl,
    }));
  }
  return creator
    ? [{
        socialAccountId: '',
        platform: creator.platform,
        channelUrl: '',
      }]
    : [];
};

export const formatContractPublishingPlatforms = (
  model: Pick<ContractGenerationModel, 'platform' | 'channelUrl'> & {
    publishingChannels?: ContractPublishingChannel[];
  },
) => resolveContractPublishingChannels(model)
  .map((channel) => channel.platform.trim())
  .filter(Boolean)
  .join(' · ');

export const formatContractPublishingChannelLinks = (
  model: Pick<ContractGenerationModel, 'platform' | 'channelUrl'> & {
    publishingChannels?: ContractPublishingChannel[];
  },
) => resolveContractPublishingChannels(model)
  .map((channel) => {
    const platform = channel.platform.trim();
    const channelUrl = channel.channelUrl.trim();
    if (platform && channelUrl) return `${platform}: ${channelUrl}`;
    return channelUrl || platform;
  })
  .filter(Boolean)
  .join('\n');

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

const hasPartialDateRange = (start: string, end: string) => Boolean(start) !== Boolean(end);

export const validateContractGenerationModel = (
  model: ContractGenerationModel,
) => {
  const errors: Record<string, string> = {};
  const requiredSelections: Array<[string, string, string]> = [
    ['creator', '请选择合作达人', model.creatorId],
    ['project', '请选择关联项目', model.projectId],
  ];
  requiredSelections.forEach(([key, message, value]) => {
    if (!value) errors[key] = message;
  });

  if (model.creatorId) {
    const requiredCreatorProfile: Array<[string, string, string]> = [
      ['publisher', '达人档案缺少法定名称', model.publisher],
      ['publisherAddress', '达人档案缺少联系地址', model.publisherAddress],
      ['channelName', '达人档案缺少频道名称', model.channelName],
    ];
    requiredCreatorProfile.forEach(([key, message, value]) => {
      if (!value.trim()) errors[key] = message;
    });
    const channels = resolveContractPublishingChannels(model);
    if (!channels.length) {
      errors.platform = '达人档案缺少发布平台和频道链接';
    } else {
      const missingPlatformIndex = channels.findIndex((channel) => !channel.platform.trim());
      const missingChannelUrlIndex = channels.findIndex((channel) => !channel.channelUrl.trim());
      const invalidChannelUrlIndex = channels.findIndex((channel) => {
        const value = channel.channelUrl.trim();
        if (!value) return false;
        try {
          const url = new URL(value);
          return url.protocol !== 'http:' && url.protocol !== 'https:';
        } catch {
          return true;
        }
      });
      if (missingPlatformIndex >= 0) {
        errors.platform = `第 ${missingPlatformIndex + 1} 个频道缺少发布平台`;
      }
      if (missingChannelUrlIndex >= 0) {
        errors.channelUrl = `第 ${missingChannelUrlIndex + 1} 个频道缺少频道链接`;
      } else if (invalidChannelUrlIndex >= 0) {
        errors.channelUrl = `第 ${invalidChannelUrlIndex + 1} 个频道链接格式无效`;
      }
    }
  }

  if (!model.payoutAccountId) {
    errors.payoutAccountId = '达人没有可用于合同的已验证 Airwallex 或 PayPal 账户';
  }

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
  if (hasPartialDateRange(model.campaignStart, model.campaignEnd)) {
    errors.campaignEnd = 'Campaign 日期需同时填写开始和结束日期';
  } else if (isDateAfter(model.campaignStart, model.campaignEnd)) {
    errors.campaignEnd = 'Campaign 结束日期不能早于开始日期';
  }
  if (hasPartialDateRange(model.releaseStart, model.releaseEnd)) {
    errors.releaseEnd = '发布日期需同时填写开始和结束日期';
  } else if (isDateAfter(model.releaseStart, model.releaseEnd)) {
    errors.releaseEnd = '发布结束日期不能早于开始日期';
  }
  if ((model.totalFee || model.licensePrice) && !model.currency) {
    errors.currency = '填写金额时必须选择币种';
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
  if (model.payoutAccountId && model.payoutProvider === 'PayPal') {
    if (!model.paymentSnapshot.paypalUsername.trim()) {
      errors.payoutAccountId = 'PayPal 账户缺少 PayPal Name';
    } else if (!/^\S+@\S+\.\S+$/.test(model.paymentSnapshot.paypalEmail.trim())) {
      errors.payoutAccountId = 'PayPal 账户邮箱无效';
    }
  } else if (model.payoutAccountId) {
    if (!model.paymentSnapshot.accountName.trim()) {
      errors.payoutAccountId = '银行账户缺少 Account Name';
    } else if (!model.paymentSnapshot.bankName.trim()) {
      errors.payoutAccountId = '银行账户缺少 Beneficiary Bank';
    }
    if (!model.paymentSnapshot.accountNumber.trim() && !model.paymentSnapshot.iban.trim()) {
      errors.payoutAccountId = '银行账户缺少 Account Number 或 IBAN';
    }
  }
  return errors;
};
