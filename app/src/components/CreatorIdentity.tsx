import {
  AtSign,
} from 'lucide-react';
import {
  siFacebook,
  siInstagram,
  siTiktok,
  siTwitch,
  siX,
  siYoutube,
  type SimpleIcon,
} from 'simple-icons';
import { useState, type MouseEvent, type PointerEvent } from 'react';
import type { CreatorProfile, CreatorSocialAccount } from '../types';
import { creatorSocialAccounts } from '../creatorSearchOptions';
import { Avatar } from './Common';
import './CreatorSearchOptions.css';

const PLATFORM_ICONS: Record<string, SimpleIcon> = {
  instagram: siInstagram,
  tiktok: siTiktok,
  youtube: siYoutube,
  x: siX,
  twitter: siX,
  facebook: siFacebook,
  twitch: siTwitch,
};

const platformKey = (platform: string) => platform.trim().toLowerCase();

export type CreatorSocialAccountsMode = 'collapsible' | 'expanded';

export function SocialPlatformIcon({
  platform,
  handle,
  size = 13,
}: {
  platform: string;
  handle?: string;
  size?: number;
}) {
  const normalized = platformKey(platform);
  const icon = PLATFORM_ICONS[normalized];
  const platformLabel = platform.trim() || '未知社媒平台';
  const label = [platformLabel, handle?.trim()].filter(Boolean).join(' · ');
  return (
    <span
      className={`creator-social-platform-icon is-${normalized.replace(/[^a-z0-9-]/g, '-') || 'unknown'}`}
      role="img"
      aria-label={label}
      title={label}
      style={{
        width: size,
        height: size,
        flexBasis: size,
        ...(icon ? { color: `#${icon.hex}` } : {}),
      }}
    >
      {icon ? (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={icon.path} fill="currentColor" />
        </svg>
      ) : <AtSign size={size} aria-hidden="true" />}
    </span>
  );
}

export function CreatorSocialAccounts({
  accounts,
  fallbackHandle,
  fallbackPlatform,
  mode = 'collapsible',
  maxVisible = 2,
  className = '',
}: {
  accounts?: readonly CreatorSocialAccount[];
  fallbackHandle?: string;
  fallbackPlatform?: string;
  mode?: CreatorSocialAccountsMode;
  maxVisible?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const resolvedAccounts = accounts?.length
    ? accounts
    : fallbackHandle || fallbackPlatform
      ? [{ id: 'creator-social-fallback', handle: fallbackHandle ?? '', platform: fallbackPlatform ?? '', profileUrl: '' }]
      : [];
  if (!resolvedAccounts.length) return <span className="creator-social-accounts-empty">账号待补充</span>;
  const limit = Math.max(1, maxVisible);
  const canCollapse = mode === 'collapsible' && resolvedAccounts.length > limit;
  const shownAccounts = canCollapse && !expanded ? resolvedAccounts.slice(0, limit) : resolvedAccounts;
  const hiddenCount = resolvedAccounts.length - limit;
  const expandedView = mode === 'expanded' || expanded;
  const stopPointerPropagation = (event: PointerEvent<HTMLButtonElement>) => event.stopPropagation();
  const toggleExpanded = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setExpanded((current) => !current);
  };
  return (
    <span className={`creator-social-accounts ${expandedView ? 'is-expanded-view' : 'is-collapsed-view'} ${className}`.trim()}>
      {shownAccounts.map((account) => {
        const normalizedPlatform = platformKey(account.platform).replace(/[^a-z0-9-]/g, '-') || 'unknown';
        return (
          <span className={`creator-social-account is-${normalizedPlatform}`} key={account.id || `${account.handle}:${account.platform}`}>
            <SocialPlatformIcon platform={account.platform} handle={account.handle} />
            <span>{account.handle.trim() || 'Handle 待补充'}</span>
          </span>
        );
      })}
      {canCollapse ? (
        <button
          className="creator-social-accounts-toggle"
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? '收起社媒平台' : `展开其余 ${hiddenCount} 个社媒平台`}
          title={expanded ? '收起' : `展开其余 ${hiddenCount} 个平台`}
          onPointerDown={stopPointerPropagation}
          onClick={toggleExpanded}
        >
          {expanded ? '收起' : `+${hiddenCount}`}
        </button>
      ) : null}
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
  socialAccountsMode = 'collapsible',
  socialAccountsMaxVisible = 2,
  showSocialAccounts = true,
  showAvatar = true,
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
  socialAccountsMode?: CreatorSocialAccountsMode;
  socialAccountsMaxVisible?: number;
  showSocialAccounts?: boolean;
  showAvatar?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const name = creator?.name ?? displayName ?? '达人待补充';
  return (
    <span className={`creator-identity${showAvatar ? '' : ' is-without-avatar'} ${className}`.trim()}>
      {showAvatar ? (
        <Avatar
          initials={creator?.initials ?? initials ?? name.slice(0, 2).toUpperCase()}
          accent={creator?.accent ?? accent}
          size={size}
        />
      ) : null}
      <span className="creator-identity-copy">
        <strong>{name}</strong>
        {showSocialAccounts ? (
          <CreatorSocialAccounts
            accounts={creator ? creatorSocialAccounts(creator) : accounts}
            fallbackHandle={fallbackHandle}
            fallbackPlatform={fallbackPlatform}
            mode={socialAccountsMode}
            maxVisible={socialAccountsMaxVisible}
          />
        ) : null}
      </span>
    </span>
  );
}
