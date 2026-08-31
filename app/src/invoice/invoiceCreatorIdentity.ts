import {
  creatorSocialAccounts,
  resolveCreatorSocialAccount,
} from '../creatorSearchOptions';
import type { CreatorProfile, CreatorSocialAccount } from '../types';

export type InvoiceCreatorIdentitySource = {
  creatorId?: string;
  creatorName?: string;
  creatorHandle?: string;
  creatorSocialAccountId?: string;
  creatorPlatform?: string;
  initials?: string;
  accent?: string;
};

export type InvoiceCreatorIdentity = {
  creator?: CreatorProfile;
  displayName: string;
  channelId: string;
  platform: string;
  initials: string;
  accent?: string;
  socialAccounts?: CreatorSocialAccount[];
};

const normalizeHandle = (value?: string) => (
  value?.trim().replace(/^@/, '').toLocaleLowerCase() ?? ''
);

const fallbackInitials = (value: string) => Array.from(value.trim() || '?')
  .slice(0, 2)
  .join('')
  .toUpperCase();

const legacyCreatorFor = (
  creators: readonly CreatorProfile[],
  source: InvoiceCreatorIdentitySource,
) => {
  const normalizedHandle = normalizeHandle(source.creatorHandle);
  const handleMatch = normalizedHandle
    ? creators.find((candidate) => (
        normalizeHandle(candidate.handle) === normalizedHandle
        || creatorSocialAccounts(candidate).some((account) => (
          normalizeHandle(account.handle) === normalizedHandle
        ))
      ))
    : undefined;
  if (handleMatch) return handleMatch;
  const normalizedName = source.creatorName?.trim().toLocaleLowerCase();
  return normalizedName
    ? creators.find((candidate) => candidate.name.trim().toLocaleLowerCase() === normalizedName)
    : undefined;
};

export const resolveInvoiceCreatorIdentity = ({
  creators,
  source,
  allowLegacyEntityMatch = true,
}: {
  creators: readonly CreatorProfile[];
  source: InvoiceCreatorIdentitySource;
  allowLegacyEntityMatch?: boolean;
}): InvoiceCreatorIdentity => {
  const creator = source.creatorId
    ? creators.find((candidate) => String(candidate.id) === String(source.creatorId))
    : allowLegacyEntityMatch
      ? legacyCreatorFor(creators, source)
      : undefined;
  const primarySocialAccount = resolveCreatorSocialAccount(
    creator,
    source.creatorSocialAccountId,
    source.creatorHandle,
    source.creatorPlatform,
  );
  const displayName = creator?.name ?? source.creatorName?.trim() ?? '达人待补充';
  return {
    creator,
    displayName,
    channelId: primarySocialAccount?.handle
      ?? creator?.handle
      ?? source.creatorHandle?.trim()
      ?? 'Handle 待补充',
    platform: source.creatorPlatform?.trim()
      ?? primarySocialAccount?.platform.trim()
      ?? creator?.platform?.trim()
      ?? '社媒平台待补充',
    initials: creator?.initials ?? source.initials ?? fallbackInitials(displayName),
    accent: creator?.accent ?? source.accent,
    socialAccounts: creator
      ? creatorSocialAccounts(creator).map((account) => ({ ...account }))
      : undefined,
  };
};
