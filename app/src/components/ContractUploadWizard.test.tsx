import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contractNameFromUploadFile } from './ContractUploadWizard';

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
    expect(styles).toMatch(/\.creator-search-combobox \.contract-search-option > \.creator-identity\s*{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\);/s);
    expect(styles).toMatch(/\.creator-search-combobox \.contract-search-option \.creator-social-accounts\s*{[^}]*flex-wrap:\s*nowrap;[^}]*overflow:\s*hidden;/s);
  });
});
