import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CreatorId } from './businessWorkflow';
import { filterSearchableOptions } from './components/SearchableComboBox';
import { creatorSearchOption } from './creatorSearchOptions';
import type { CreatorProfile } from './types';

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
  socialAccounts: [{
    id: 'channel-camila-instagram',
    platform: 'Instagram',
    handle: '@camila.beauty',
    profileUrl: 'https://instagram.com/camila.beauty',
  }],
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

    expect(option.selectedLabel).toBe('Camila Costa · @camila.beauty · Instagram');
    expect(filterSearchableOptions(options, 'Camila Costa')).toEqual(options);
    expect(filterSearchableOptions(options, 'channel-camila-instagram')).toEqual(options);
    expect(filterSearchableOptions(options, 'instagram.com/camila.beauty')).toEqual(options);
    expect(filterSearchableOptions(options, 'Camila Costa Payments')).toEqual(options);
  });

  it('is reused by every single-creator business form', () => {
    const invoiceBuilder = readFileSync(new URL('./pages/InvoiceBuilderPage.tsx', import.meta.url), 'utf8');
    const contractBuilder = readFileSync(new URL('./pages/ContractBuilderPage.tsx', import.meta.url), 'utf8');
    const contractUpload = readFileSync(new URL('./components/ContractUploadWizard.tsx', import.meta.url), 'utf8');
    const externalCollection = readFileSync(new URL('./pages/ExternalInvoiceCollectionPage.tsx', import.meta.url), 'utf8');

    [invoiceBuilder, contractBuilder, contractUpload, externalCollection].forEach((source) => {
      expect(source).toContain('creatorSearchOption');
      expect(source).toContain('className="creator-search-combobox"');
      expect(source).toContain('搜索频道链接、频道 ID、Account Name 或 Display Name');
    });
    expect(contractUpload).toContain('<SearchableComboBox');
    expect(externalCollection).toContain('<SearchableComboBox');
  });
});
