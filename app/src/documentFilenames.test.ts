import { describe, expect, it } from 'vitest';
import type { ContractRecord } from './contracts';
import type { InvoiceDocumentModel } from './types';
import {
  contractDocumentFilename,
  invoiceDocumentFilename,
  invoiceDocumentName,
} from './documentFilenames';

describe('document filenames', () => {
  it('uses contract name followed by contract number', () => {
    expect(contractDocumentFilename({ name: 'KOL 服务 / 主合同', id: 'CON:001' } as ContractRecord))
      .toBe('KOL 服务 - 主合同-CON-001.pdf');
  });

  it('uses account name and linked project name as the invoice name', () => {
    const invoice = {
      invoiceNumber: 'INV/001',
      creatorName: 'Creator fallback',
      projectName: '夏日项目',
      payment: { accountName: 'Mina Kato Studio' },
    } as InvoiceDocumentModel;

    expect(invoiceDocumentName(invoice)).toBe('Mina Kato Studio-夏日项目');
    expect(invoiceDocumentFilename(invoice, 'pdf'))
      .toBe('Mina Kato Studio-夏日项目-INV-001.pdf');
  });

  it('falls back to the creator name when the account name is missing', () => {
    const invoice = {
      invoiceNumber: 'INV-002',
      creatorName: 'Mina Kato',
      projectName: 'Creator Campaign',
      payment: { accountName: '' },
    } as InvoiceDocumentModel;

    expect(invoiceDocumentFilename(invoice, 'docx'))
      .toBe('Mina Kato-Creator Campaign-INV-002.docx');
  });
});
