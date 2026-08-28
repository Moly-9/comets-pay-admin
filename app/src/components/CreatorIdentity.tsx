import {
  AtSign,
  Facebook,
  Instagram,
  Music2,
  Twitch,
  Twitter,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import type { CreatorProfile, CreatorSocialAccount } from '../types';
import { creatorSocialAccounts } from '../creatorSearchOptions';
import { Avatar } from './Common';

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  x: Twitter,
  twitter: Twitter,
  facebook: Facebook,
  twitch: Twitch,
};

const platformKey = (platform: string) => platform.trim().toLowerCase();

export function SocialPlatformIcon({ platform, size = 13 }: { platform: string; size?: number }) {
  const normalized = platformKey(platform);
  const Icon = PLATFORM_ICONS[normalized] ?? AtSign;
  const label = platform.trim() || '未知社媒平台';
  return (
    <span
      className={`creator-social-platform-icon is-${normalized.replace(/[^a-z0-9-]/g, '-') || 'unknown'}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <Icon size={size} aria-hidden="true" />
    </span>
  );
}

export function CreatorSocialAccounts({
  accounts,
  fallbackHandle,
  fallbackPlatform,
  className = '',
}: {
  accounts?: readonly CreatorSocialAccount[];
  fallbackHandle?: string;
  fallbackPlatform?: string;
  className?: string;
}) {
  const visibleAccounts = accounts?.length
    ? accounts
    : fallbackHandle || fallbackPlatform
      ? [{ id: 'creator-social-fallback', handle: fallbackHandle ?? '', platform: fallbackPlatform ?? '', profileUrl: '' }]
      : [];
  if (!visibleAccounts.length) return <span className="creator-social-accounts-empty">账号待补充</span>;
  return (
    <span className={`creator-social-accounts ${className}`.trim()}>
      {visibleAccounts.map((account) => (
        <span className="creator-social-account" key={account.id || `${account.handle}:${account.platform}`}>
          <span>{account.handle.trim() || 'Handle 待补充'}</span>
          <SocialPlatformIcon platform={account.platform} />
        </span>
      ))}
    </span>
  );
}

export function CreatorIdentity({
  creator,
  displayName,
  initials,
  accent,
  fallbackHandle,
  fallbackPlatform,
  accounts,
  size = 'sm',
  className = '',
}: {
  creator?: CreatorProfile | null;
  displayName?: string;
  initials?: string;
  accent?: string;
  fallbackHandle?: string;
  fallbackPlatform?: string;
  accounts?: readonly CreatorSocialAccount[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const name = creator?.name ?? displayName ?? '达人待补充';
  return (
    <span className={`creator-identity ${className}`.trim()}>
      <Avatar
        initials={creator?.initials ?? initials ?? name.slice(0, 2).toUpperCase()}
        accent={creator?.accent ?? accent}
        size={size}
      />
      <span className="creator-identity-copy">
        <strong>{name}</strong>
        <CreatorSocialAccounts
          accounts={creator ? creatorSocialAccounts(creator) : accounts}
          fallbackHandle={fallbackHandle}
          fallbackPlatform={fallbackPlatform}
        />
      </span>
    </span>
  );
}
