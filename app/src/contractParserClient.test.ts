import { describe, expect, it } from 'vitest';
import {
  MAX_CONTRACT_FILE_SIZE,
  validateContractFile,
} from './contractParserClient';

describe('contract file validation', () => {
  it('rejects an empty file', () => {
    const file = new File([], 'empty.pdf', { type: 'application/pdf' });
    expect(validateContractFile(file)).toBe('文件为空，无法解析。');
  });

  it('rejects unsupported extensions and mismatched MIME types', () => {
    const legacyDoc = new File(['content'], 'legacy.doc', { type: 'application/msword' });
    const fakePdf = new File(['content'], 'fake.pdf', { type: 'text/plain' });

    expect(validateContractFile(legacyDoc)).toBe('仅支持文字型 PDF 或标准 DOCX 文件。');
    expect(validateContractFile(fakePdf)).toBe('文件 MIME 类型与 PDF/DOCX 不匹配。');
  });

  it('rejects files above the 30 MB limit', () => {
    const oversized = {
      name: 'large.pdf',
      size: MAX_CONTRACT_FILE_SIZE + 1,
      type: 'application/pdf',
    } as File;
    expect(validateContractFile(oversized)).toBe('单个文件不能超过 30 MB。');
  });
});
