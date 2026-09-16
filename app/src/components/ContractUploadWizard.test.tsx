import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contractNameFromUploadFile, contractUploadCreatorSearchOptions } from './ContractUploadWizard';
import type { CreatorProfile } from '../types';

describe('ContractUploadWizard contract naming', () => {
  it('uses a trimmed upload filename without the PDF or DOCX extension', () => {
    expect(contractNameFromUploadFile(' Creator Agreement.PDF ')).toBe('Creator Agreement');
    expect(contractNameFromUploadFile('Mina Kato 合作协议.docx')).toBe('Mina Kato 合作协议');
    expect(contractNameFromUploadFile('agreement.final')).toBe('agreement.final');
  });

  it('places editable naming after the uploaded file and keeps history selection identity-only', () => {
    const source = readFileSync(new URL('./ContractUploadWizard.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./CreatorSearchOptions.css', import.meta.url), 'utf8');

    expect(source.indexOf('className="contract-source-file-list"')).toBeLessThan(source.indexOf('contract-upload-contract-name'));
    expect(source).toContain('setContractName(contractNameFromUploadFile(files[0].name))');
    expect(source).toContain('<span>历史生成合同</span>');
    expect(source).toContain('ariaLabel="历史生成合同"');
    expect(source).toContain("label: '不覆盖历史生成合同'");
    expect(source).toContain('<small>选择后沿用历史生成合同 ID</small>');
    expect(source).not.toMatch(/onChange=\{[^}]*setDraftContractId[^}]*setContractName/);
    expect(source).not.toContain('对应生成草稿');
    expect(source.indexOf('<span>合作达人 *</span>')).toBeLessThan(
      source.indexOf('<span>合作项目 *</span>'),
    );
    expect(source).toContain('disabled={!selectedCreator}');
    expect(styles).toMatch(/\.creator-search-combobox \.contract-search-option > \.creator-identity\s*{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\);/s);
    expect(styles).toMatch(/\.creator-search-combobox \.contract-search-option \.creator-social-accounts\s*{[^}]*flex-wrap:\s*nowrap;[^}]*overflow:\s*hidden;/s);
  });

  it('shows only the creator display name after selection without reducing search coverage', () => {
    const creator = {
      id: 'creator-upload-display',
      initials: 'MK',
      accent: '#f4d7c4',
      name: 'Mina Kato dis',
      handle: '@MinaKato',
      region: 'JP',
      platform: 'Instagram',
      projects: 1,
      contact: {
        legalName: 'Mina Kato Limited',
        address: '',
        phone: '',
        email: 'mina@example.com',
      },
      socialAccounts: [{
        id: 'channel-mina-instagram',
        handle: '@MinaKato',
        platform: 'Instagram',
        profileUrl: 'https://instagram.com/MinaKato',
      }],
      payoutAccounts: [],
    } satisfies CreatorProfile;

    const [option] = contractUploadCreatorSearchOptions([creator]);

    expect(option.label).toBe('Mina Kato dis');
    expect(option.selectedLabel).toBe('Mina Kato dis');
    expect(option.searchText).toContain('channel-mina-instagram');
    expect(option.searchText).toContain('https://instagram.com/MinaKato');
    expect(option.searchText).toContain('Mina Kato Limited');
  });
});
