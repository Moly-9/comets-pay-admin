import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CreatorProfile } from '../types';
import { CreatorIdentity, CreatorSocialAccounts } from './CreatorIdentity';

const creator = {
  id: 'creator-identity-test',
  initials: 'MC',
  accent: '#7c3aed',
  name: 'Mina Creator',
  handle: '@mina.first',
  platform: 'Instagram',
  region: 'JP',
  projects: 1,
  contact: {
    legalName: 'Mina Creator Studio',
    address: 'Tokyo',
    phone: '000',
    email: 'mina@example.test',
  },
  socialAccounts: [
    { id: 'social-instagram', handle: '@mina.first', platform: 'Instagram', profileUrl: '' },
    { id: 'social-tiktok', handle: '@mina.second', platform: 'TikTok', profileUrl: '' },
    { id: 'social-youtube', handle: '@mina.third', platform: 'YouTube', profileUrl: '' },
  ],
} as CreatorProfile;

describe('CreatorIdentity', () => {
  it('keeps profile account order, shows two badges, and exposes the remaining count', () => {
    const html = renderToStaticMarkup(<CreatorIdentity creator={creator} />);

    expect(html.indexOf('@mina.first')).toBeLessThan(html.indexOf('@mina.second'));
    expect(html).not.toContain('@mina.third');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('>+1</button>');
    expect(html).toContain('aria-label="Instagram"');
    expect(html).toContain('aria-label="TikTok"');
    expect(html).not.toContain('>Instagram<');
    expect(html).not.toContain('>TikTok<');
  });

  it('renders every social badge without a nested expansion control in expanded mode', () => {
    const html = renderToStaticMarkup(<CreatorIdentity creator={creator} socialAccountsMode="expanded" />);

    expect(html.indexOf('@mina.first')).toBeLessThan(html.indexOf('@mina.second'));
    expect(html.indexOf('@mina.second')).toBeLessThan(html.indexOf('@mina.third'));
    expect(html).toContain('aria-label="YouTube"');
    expect(html).not.toContain('creator-social-accounts-toggle');
    expect(html).not.toContain('<button');
  });

  it('uses the generic platform icon for unknown platforms', () => {
    const html = renderToStaticMarkup(<CreatorSocialAccounts accounts={[
      { id: 'social-unknown', handle: '@mina.new', platform: 'Mastodon', profileUrl: '' },
    ]} />);

    expect(html).toContain('creator-social-platform-icon is-mastodon');
    expect(html).toContain('aria-label="Mastodon"');
  });

  it('renders the legacy frozen account when the creator profile cannot be resolved', () => {
    const html = renderToStaticMarkup(
      <CreatorIdentity displayName="Legacy Creator" fallbackHandle="@legacy" fallbackPlatform="YouTube" />,
    );

    expect(html).toContain('Legacy Creator');
    expect(html).toContain('@legacy');
    expect(html).toContain('aria-label="YouTube"');
  });

  it('can render only the avatar and display name for compact selections', () => {
    const html = renderToStaticMarkup(<CreatorIdentity creator={creator} showSocialAccounts={false} />);

    expect(html).toContain('Mina Creator');
    expect(html).toContain('avatar');
    expect(html).not.toContain('@mina.first');
    expect(html).not.toContain('creator-social-accounts');
  });
});
