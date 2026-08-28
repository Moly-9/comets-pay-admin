import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CreatorId } from './businessWorkflow';
import { filterSearchableOptions } from './components/SearchableComboBox';
import {
  creatorSearchOption,
  creatorSearchOptions,
  creatorSocialAccountMatches,
  creatorSocialAccountSearchOptions,
  parseCreatorSocialSelectionValue,
} from './creatorSearchOptions';
import type { CreatorProfile } from './types';
import { INITIAL_CREATORS } from './pages/OperationalPages';

const creatorId = 'creator-search-shared' as CreatorId;
const creator: CreatorProfile = {
  id: creatorId,
  initials: 'CC',
  accent: '#8d6a8b',
  name: 'Camila Costa',
  handle: '@camila.beauty',
  region: 'BR',
  platform: 'Instagram',
  projects: 2,
  socialAccounts: [
    {
      id: 'channel-camila-instagram',
      platform: 'Instagram',
      handle: '@camila.beauty',
      profileUrl: 'https://instagram.com/camila.beauty',
    },
    {
      id: 'channel-camila-tiktok',
      platform: 'TikTok',
      handle: '@camila.tiktok',
      profileUrl: 'https://tiktok.com/@camila.tiktok',
    },
  ],
  contact: {
    legalName: 'Camila Costa Studio Ltd.',
    address: 'São Paulo',
    phone: '000',
    email: 'camila@example.com',
  },
  payoutAccounts: [{
    id: 'paypal-camila',
    creatorId,
    provider: 'PayPal',
    nickname: 'Creator PayPal',
    isDefault: true,
    status: 'VERIFIED',
    paypalUsername: 'Camila Costa Payments',
    paypalEmail: 'payments@example.com',
  }],
};

describe('shared creator search option', () => {
  it('uses the same presentation and matches every supported creator identifier', () => {
    const option = creatorSearchOption(creator);
    const options = [option];

    expect(option.selectedLabel).toBe('Camila Costa · @camila.beauty · @camila.tiktok');
    expect(filterSearchableOptions(options, 'Camila Costa')).toEqual(options);
    expect(filterSearchableOptions(options, 'channel-camila-instagram')).toEqual(options);
    expect(filterSearchableOptions(options, 'instagram.com/camila.beauty')).toEqual(options);
    expect(filterSearchableOptions(options, 'Camila Costa Payments')).toEqual(options);
    expect(filterSearchableOptions(options, 'payments@example.com')).toEqual(options);
    expect(creatorSearchOptions([creator])).toHaveLength(1);
  });

  it('returns one stable option per social account when searching the same display name', () => {
    const options = creatorSocialAccountSearchOptions(creator);
    const matches = filterSearchableOptions(options, 'Camila Costa');

    expect(matches).toHaveLength(2);
    expect(matches.map((option) => option.selectedLabel)).toEqual([
      'Camila Costa · @camila.beauty · Instagram',
      'Camila Costa · @camila.tiktok · TikTok',
    ]);
    expect(parseCreatorSocialSelectionValue(matches[1].value)).toEqual({
      creatorId,
      socialAccountId: 'channel-camila-tiktok',
    });
    expect(filterSearchableOptions(options, 'tiktok.com/@camila.tiktok')).toEqual([options[1]]);
  });

  it('falls back from a stale account ID to the frozen handle and platform snapshot', () => {
    expect(creatorSocialAccountMatches(creator.socialAccounts[1], {
      socialAccountId: 'deleted-social-account',
      handle: '@camila.tiktok',
      platform: 'TikTok',
    })).toBe(true);
    expect(creatorSocialAccountMatches(creator.socialAccounts[0], {
      socialAccountId: 'channel-camila-tiktok',
      handle: '@old-handle',
      platform: 'TikTok',
    })).toBe(false);
  });

  it('exposes Luna Instagram and TikTok demo accounts as separate choices', () => {
    const luna = INITIAL_CREATORS.find((item) => item.id === 'creator-luna')!;
    const options = creatorSocialAccountSearchOptions(luna);

    expect(filterSearchableOptions(options, 'Luna Jones dis').map((option) => option.selectedLabel)).toEqual([
      'Luna Jones dis · @Luna_J · Instagram',
      'Luna Jones dis · @luna.j.tiktok · TikTok',
    ]);
  });

  it('is reused by every single-creator business form', () => {
    const invoiceBuilder = readFileSync(new URL('./pages/InvoiceBuilderPage.tsx', import.meta.url), 'utf8');
    const contractBuilder = readFileSync(new URL('./pages/ContractBuilderPage.tsx', import.meta.url), 'utf8');
    const contractUpload = readFileSync(new URL('./components/ContractUploadWizard.tsx', import.meta.url), 'utf8');
    const externalCollection = readFileSync(new URL('./pages/ExternalInvoiceCollectionPage.tsx', import.meta.url), 'utf8');

    [invoiceBuilder, contractBuilder, contractUpload, externalCollection].forEach((source) => {
      expect(source).toMatch(/creatorSearchOptions|creatorSearchOption/);
      expect(source).toContain('CreatorIdentity');
      expect(source).toContain('className="creator-search-combobox"');
      expect(source).toContain('搜索 Display Name、Handle、Real Name、Company Name 或 Account Name');
    });
    expect(contractUpload).toContain('<SearchableComboBox');
    expect(externalCollection).toContain('<SearchableComboBox');
  });
});
