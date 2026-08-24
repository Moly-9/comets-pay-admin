import { readFile } from 'node:fs/promises';
import { Workbook } from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { Payout } from './types';
import {
  createTransactionRecordsWorkbook,
  TRANSACTION_RECORDS_SHEET_NAME,
  transactionRecordsFilename,
} from './transactionRecordsWorkbook';

const templatePath = new URL('../public/export-assets/transactions/transaction-records-template.xlsx', import.meta.url);

const records: Payout[] = [{
  id: 'pay-test',
  creator: 'Mina Kato',
  handle: '@MinaKato',
  initials: 'MK',
  projectId: 'PRJ-20260801-TEST01',
  project: '夏季新品推广',
  contract: 'CON-20260801-TEST01',
  invoice: 'INV-20260801-TEST01',
  provider: 'PayMax',
  currency: 'USD',
  amount: 1980,
  account: 'test-account',
  status: '已付款',
  invoiceReviewStatus: '已通过',
  accent: '#000000',
  paidAt: '2026-08-05 16:00',
}];

describe('transaction records workbook', () => {
  it('fills the supplied template with typed transaction rows', async () => {
    const template = await readFile(templatePath);
    const blob = await createTransactionRecordsWorkbook(template.buffer.slice(
      template.byteOffset,
      template.byteOffset + template.byteLength,
    ), records);
    const workbook = new Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const worksheet = workbook.getWorksheet(TRANSACTION_RECORDS_SHEET_NAME);

    expect(worksheet?.getRow(1).values).toEqual([
      undefined,
      '付款达人',
      '请款项目',
      '关联项目',
      '付款日期',
      '付款渠道',
      '付款金额',
      '状态',
      '余额',
    ]);
    expect(worksheet?.getRow(2).getCell(1).value).toBe('Mina Kato (@MinaKato)');
    expect(worksheet?.getRow(2).getCell(2).value).toBe('INV-20260801-TEST01');
    expect(worksheet?.getRow(2).getCell(4).value).toBeInstanceOf(Date);
    expect((worksheet?.getRow(2).getCell(4).value as Date).getUTCHours()).toBe(16);
    expect(worksheet?.getRow(2).getCell(5).value).toBe('Payer Max');
    expect(worksheet?.getRow(2).getCell(6).value).toBe(1980);
    expect(worksheet?.getRow(2).getCell(6).numFmt).toContain('USD');
    expect(worksheet?.getRow(2).getCell(8).value).toBeNull();
  });

  it('creates a stable date-based filename', () => {
    expect(transactionRecordsFilename(new Date('2026-08-10T05:30:00.000Z'))).toMatch(/^COMETS-Pay-交易流水-\d{8}\.xlsx$/);
  });
});
