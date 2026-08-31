import { describe, expect, it } from 'vitest';
import type { CreatorProfile } from './types';
import { matchPaymentRequestCreatorProfileLinks } from './paymentRequestCreatorImport';

const creators = [
  {
    id: 'creator-alpha',
    name: 'Alpha Creator',
    socialAccounts: [
      {
        id: 'social-alpha-youtube',
        platform: 'YouTube',
        handle: '@alpha',
        profileUrl: 'https://www.youtube.com/@alpha/',
      },
      {
        id: 'social-alpha-instagram',
        platform: 'Instagram',
        handle: '@alpha.ig',
        profileUrl: 'https://www.instagram.com/alpha.ig/',
      },
    ],
  },
  {
    id: 'creator-beta',
    name: 'Beta Creator',
    socialAccounts: [{
      id: 'social-beta-tiktok',
      platform: 'TikTok',
      handle: '@beta',
      profileUrl: 'https://www.tiktok.com/@beta',
    }],
  },
] as CreatorProfile[];

describe('payment request creator profile link matching', () => {
  it('normalizes protocol, query, hash and trailing slash while preserving the matched social account', () => {
    const result = matchPaymentRequestCreatorProfileLinks({
      value: 'www.youtube.com/@alpha?utm_source=test#profile\nhttps://www.tiktok.com/@beta/',
      creators,
    });

    expect(result.issues).toEqual([]);
    expect(result.matches).toEqual([
      expect.objectContaining({ creatorId: 'creator-alpha', socialAccountId: 'social-alpha-youtube' }),
      expect.objectContaining({ creatorId: 'creator-beta', socialAccountId: 'social-beta-tiktok' }),
    ]);
  });

  it('keeps valid rows when other rows are invalid or unmatched', () => {
    const result = matchPaymentRequestCreatorProfileLinks({
      value: 'not a link\nhttps://x.com/unknown\nhttps://www.instagram.com/alpha.ig',
      creators,
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      creatorId: 'creator-alpha',
      socialAccountId: 'social-alpha-instagram',
    });
    expect(result.issues.map((issue) => issue.code)).toEqual(['INVALID_LINK', 'NOT_FOUND']);
  });

  it('deduplicates multiple profile links that belong to the same creator', () => {
    const result = matchPaymentRequestCreatorProfileLinks({
      value: 'https://www.youtube.com/@alpha\nhttps://www.instagram.com/alpha.ig',
      creators,
    });

    expect(result.matches).toHaveLength(1);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'DUPLICATE', sourceLine: 2 }),
    ]);
  });
});
