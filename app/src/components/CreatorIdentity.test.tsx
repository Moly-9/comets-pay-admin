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
  ],
} as CreatorProfile;

describe('CreatorIdentity', () => {
  it('keeps profile account order and exposes platforms through labelled icons', () => {
    const html = renderToStaticMarkup(<CreatorIdentity creator={creator} />);

    expect(html.indexOf('@mina.first')).toBeLessThan(html.indexOf('@mina.second'));
    expect(html).toContain('aria-label="Instagram"');
    expect(html).toContain('aria-label="TikTok"');
    expect(html).not.toContain('>Instagram<');
    expect(html).not.toContain('>TikTok<');
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
});
