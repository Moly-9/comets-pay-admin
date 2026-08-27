import type { SearchableOption } from './components/SearchableComboBox';
import type { CreatorProfile } from './types';

const normalizeChannelId = (value: string) => value.trim().replace(/^@/, '').toLowerCase();

const payoutAccountNameTerms = (creator: CreatorProfile) => creator.payoutAccounts.flatMap((account) => {
  if (account.provider === 'PayPal') return [account.nickname, account.paypalUsername];
  if (account.provider === 'PayMax') return [account.nickname, account.beneficiaryName];
  return [
    account.nickname,
    account.bankDetails.accountName,
    account.companyName,
    [account.firstName, account.lastName].filter(Boolean).join(' '),
  ];
});

export const creatorSearchOption = (creator: CreatorProfile): SearchableOption => {
  const primarySocialAccount = creator.socialAccounts.find((account) => (
    normalizeChannelId(account.handle) === normalizeChannelId(creator.handle)
  )) ?? creator.socialAccounts[0];
  const channelId = primarySocialAccount?.handle || creator.handle || '频道 ID 待补充';
  const platform = primarySocialAccount?.platform || creator.platform || '社媒平台待补充';

  return {
    value: creator.id,
    label: creator.name,
    selectedLabel: `${creator.name} · ${channelId} · ${platform}`,
    description: `${channelId} · ${platform}`,
    searchText: [
      creator.name,
      creator.contact.legalName,
      creator.handle,
      creator.platform,
      ...creator.socialAccounts.flatMap((account) => [
        account.id,
        account.handle,
        account.profileUrl,
        account.platform,
      ]),
      ...payoutAccountNameTerms(creator),
    ].filter(Boolean).join(' '),
  };
};
