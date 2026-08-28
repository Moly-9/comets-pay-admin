import type { SearchableOption } from './components/SearchableComboBox';
import type { CreatorProfile, CreatorSocialAccount } from './types';

const normalizeChannelId = (value: string) => value.trim().replace(/^@/, '').toLowerCase();

const LEGACY_SOCIAL_ACCOUNT_PREFIX = 'legacy-social-account:';
const CREATOR_SOCIAL_SELECTION_SEPARATOR = '::social-account::';

export type CreatorSocialSelection = {
  creatorId: string;
  socialAccountId: string;
};

export const formatCreatorHandle = (
  handle: string,
  platform?: string,
) => {
  const normalizedHandle = handle.trim() || 'Handle 待补充';
  const normalizedPlatform = platform?.trim() || '社媒平台待补充';
  if (normalizedHandle.endsWith(`· ${normalizedPlatform}`)) return normalizedHandle;
  return `${normalizedHandle} · ${normalizedPlatform}`;
};

export const creatorSocialAccountMatches = (
  account: Pick<CreatorSocialAccount, 'id' | 'handle' | 'platform'>,
  snapshot: {
    socialAccountId?: string;
    handle?: string;
    platform?: string;
  },
) => (
  Boolean(snapshot.socialAccountId) && account.id === snapshot.socialAccountId
) || (
  Boolean(snapshot.handle)
  && normalizeChannelId(account.handle) === normalizeChannelId(snapshot.handle ?? '')
  && (!snapshot.platform || account.platform.toLowerCase() === snapshot.platform.toLowerCase())
);

export const creatorSocialSelectionValue = (
  creatorId: string,
  socialAccountId: string,
) => [creatorId, socialAccountId]
  .map(encodeURIComponent)
  .join(CREATOR_SOCIAL_SELECTION_SEPARATOR);

export const parseCreatorSocialSelectionValue = (
  value: string,
): CreatorSocialSelection | null => {
  const [creatorId, socialAccountId, ...remainder] = value.split(CREATOR_SOCIAL_SELECTION_SEPARATOR);
  if (!creatorId || !socialAccountId || remainder.length) return null;
  try {
    return {
      creatorId: decodeURIComponent(creatorId),
      socialAccountId: decodeURIComponent(socialAccountId),
    };
  } catch {
    return null;
  }
};

export const creatorSocialAccounts = (
  creator: CreatorProfile,
): CreatorSocialAccount[] => creator.socialAccounts?.length
  ? creator.socialAccounts
  : [{
      id: `${LEGACY_SOCIAL_ACCOUNT_PREFIX}${creator.id}`,
      handle: creator.handle,
      platform: creator.platform,
      profileUrl: '',
    }];

export const findCreatorSocialAccount = (
  creator: CreatorProfile | null | undefined,
  socialAccountId?: string,
  handle?: string,
  platform?: string,
): CreatorSocialAccount | null => {
  if (!creator) return null;
  const accounts = creatorSocialAccounts(creator);
  return accounts.find((account) => account.id === socialAccountId)
    ?? accounts.find((account) => (
      Boolean(handle)
      && normalizeChannelId(account.handle) === normalizeChannelId(handle ?? '')
      && (!platform || account.platform.toLowerCase() === platform.toLowerCase())
    ))
    ?? accounts.find((account) => (
      Boolean(handle) && normalizeChannelId(account.handle) === normalizeChannelId(handle ?? '')
    ))
    ?? null;
};

export const resolveCreatorSocialAccount = (
  creator: CreatorProfile | null | undefined,
  socialAccountId?: string,
  handle?: string,
  platform?: string,
): CreatorSocialAccount | null => findCreatorSocialAccount(
  creator,
  socialAccountId,
  handle,
  platform,
) ?? (creator ? creatorSocialAccounts(creator)[0] ?? null : null);

export const creatorHandleForDisplay = ({
  creator,
  socialAccountId,
  handle,
  platform,
}: {
  creator?: CreatorProfile | null;
  socialAccountId?: string;
  handle?: string;
  platform?: string;
}) => {
  const matched = findCreatorSocialAccount(creator, socialAccountId, handle, platform);
  return formatCreatorHandle(
    handle ?? matched?.handle ?? creator?.handle ?? '',
    platform ?? matched?.platform ?? creator?.platform,
  );
};

const payoutAccountNameTerms = (creator: CreatorProfile) => (creator.payoutAccounts ?? []).flatMap((account) => {
  if (account.provider === 'PayPal') return [account.nickname, account.paypalUsername];
  if (account.provider === 'PayMax') return [account.nickname, account.beneficiaryName];
  return [
    account.nickname,
    account.bankDetails.accountName,
    account.companyName,
    [account.firstName, account.lastName].filter(Boolean).join(' '),
  ];
});

export const creatorSocialAccountSearchOptions = (
  creator: CreatorProfile,
): SearchableOption[] => creatorSocialAccounts(creator).map((account) => {
  const channelId = account.handle || creator.handle || '频道 ID 待补充';
  const platform = account.platform || creator.platform || '社媒平台待补充';
  return {
    value: creatorSocialSelectionValue(creator.id, account.id),
    label: creator.name,
    selectedLabel: `${creator.name} · ${channelId} · ${platform}`,
    description: `${channelId} · ${platform}`,
    searchText: [
      creator.name,
      creator.contact.legalName,
      creator.handle,
      creator.platform,
      account.id,
      account.handle,
      account.profileUrl,
      account.platform,
      ...payoutAccountNameTerms(creator),
    ].filter(Boolean).join(' '),
  };
});

export const creatorSocialSearchOptions = (
  creators: CreatorProfile[],
) => creators.flatMap(creatorSocialAccountSearchOptions);

/** @deprecated Prefer creatorSocialAccountSearchOptions for account-aware selections. */
export const creatorSearchOption = (creator: CreatorProfile): SearchableOption => ({
  ...creatorSocialAccountSearchOptions(creator)[0],
  value: creator.id,
});
