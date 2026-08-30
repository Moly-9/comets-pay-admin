import { readFile } from 'node:fs/promises';
import { Workbook } from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { Payout } from './types';
import type { PaymentBatchRecord } from './paymentBatches';
import { createTransactionRecords, type TransactionRecord } from './transactionRecords';
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
  creatorPlatform: 'Instagram',
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

const workbookBatch = {
  paymentBatchId: 'payment-batch-workbook',
  paymentBatchCode: 'BAT-20260805-001',
  payer: '财务测试员',
  paidAt: '2026-08-05 16:00',
  status: '已付款',
  provider: 'PayMax',
  sourceCurrency: 'USD',
  request: {
    requestCode: 'REQ-20260805-001',
    requestStatus: '已付款',
    reason: '达人合作款',
    cooperationProjectCode: records[0].projectId,
    cooperationProjectName: records[0].project,
  },
  items: [{
    payoutId: records[0].id,
    creatorName: records[0].creator,
    creatorHandle: records[0].handle,
    creatorPlatform: records[0].creatorPlatform,
    legacyInvoiceReference: records[0].invoice,
    provider: records[0].provider,
    amount: records[0].amount,
    currency: records[0].currency,
    receiveCurrency: records[0].currency,
    accountSummary: records[0].account,
    transferMethod: 'Payer Max',
    feeBearer: '广告主承担',
    transactionReference: 'TEST-WORKBOOK',
    paymentListCode: 'PAY-20260805-001',
    paymentListStatus: 'paid',
    contracts: [],
    paymentStatus: '已付款',
    paidAt: records[0].paidAt,
    recipientReceivedAmount: records[0].amount,
    recipientReceivedCurrency: records[0].currency,
  }],
} as unknown as PaymentBatchRecord;

describe('transaction records workbook', () => {
  it('fills the supplied template with typed transaction rows', async () => {
    const template = await readFile(templatePath);
    const blob = await createTransactionRecordsWorkbook(template.buffer.slice(
      template.byteOffset,
      template.byteOffset + template.byteLength,
    ), createTransactionRecords(records, [workbookBatch]));
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
      '支付金额',
      '手续费',
      '对方实际收到金额',
      '状态',
      '余额',
      '收款账户',
      '付款批次号',
    ]);
    expect(worksheet?.getRow(2).getCell(1).value).toBe('Mina Kato (@MinaKato · Instagram)');
    expect(worksheet?.getRow(2).getCell(2).value).toBe('INV-20260801-TEST01');
    expect(worksheet?.getRow(2).getCell(4).value).toBeInstanceOf(Date);
    expect((worksheet?.getRow(2).getCell(4).value as Date).getUTCHours()).toBe(16);
    expect(worksheet?.getRow(2).getCell(5).value).toBe('Payer Max');
    expect(worksheet?.getRow(2).getCell(6).value).toBe(1980);
    expect(worksheet?.getRow(2).getCell(6).numFmt).toContain('USD');
    expect(worksheet?.getRow(2).getCell(7).value).toBeNull();
    expect(worksheet?.getRow(2).getCell(8).value).toBe(1980);
    expect(worksheet?.getRow(2).getCell(9).value).toBe('已付款');
    expect(worksheet?.getRow(2).getCell(10).value).toBeNull();
    expect(worksheet?.getRow(2).getCell(11).value).toBe('test-account');
    expect(worksheet?.getRow(2).getCell(12).value).toBe('BAT-20260805-001');
  });

  it('creates a stable date-based filename', () => {
    expect(transactionRecordsFilename(new Date('2026-08-10T05:30:00.000Z'))).toMatch(/^COMETS-Pay-交易流水-\d{8}\.xlsx$/);
  });

  it('exports a failed batch attempt with its fee, zero recipient amount, and batch code', async () => {
    const template = await readFile(templatePath);
    const failedPayout: Payout = {
      ...records[0],
      status: '付款失败',
      paidAt: undefined,
      paymentFailure: {
        provider: 'PayMax',
        errorCode: 'DECLINED',
        providerResponse: 'Prototype decline',
        occurredAt: '2026-08-06T08:10:00.000Z',
      },
    };
    const failedRecord: TransactionRecord = {
      key: 'batch:payment-batch-export:payout:pay-test',
      paymentBatchId: 'payment-batch-export' as TransactionRecord['paymentBatchId'],
      payout: failedPayout,
      context: {
        batch: {
          paymentBatchCode: 'BAT-20260806-001',
          payer: '财务测试员',
          paidAt: '2026-08-06T08:00:00.000Z',
          status: '全部失败',
          request: {
            requestCode: 'REQ-20260806-001',
            requestStatus: '付款失败',
            reason: '达人合作款',
            cooperationProjectCode: failedPayout.projectId,
            cooperationProjectName: failedPayout.project,
          },
        },
        item: {
          payoutId: failedPayout.id,
          receiveCurrency: 'USD',
          accountSummary: failedPayout.account,
          transferMethod: '本地转账',
          feeBearer: '收款人承担',
          transactionReference: 'TEST-FAILED',
          paymentListCode: 'PAY-FAILED-001',
          paymentListStatus: 'failed',
          contracts: [],
          paymentStatus: '付款失败',
          paidAt: '2026-08-06T08:10:00.000Z',
          failure: {
            code: 'DECLINED',
            response: 'Prototype decline',
            occurredAt: '2026-08-06T08:10:00.000Z',
          },
        },
      } as unknown as TransactionRecord['context'],
      status: '付款失败',
      occurredAt: '2026-08-06T08:10:00.000Z',
      provider: 'PayMax',
      paymentAmount: 1980,
      paymentCurrency: 'USD',
      transferFeeAmount: 6,
      transferFeeCurrency: 'USD',
      recipientReceivedAmount: 0,
      recipientReceivedCurrency: 'USD',
    };
    const blob = await createTransactionRecordsWorkbook(template.buffer.slice(
      template.byteOffset,
      template.byteOffset + template.byteLength,
    ), [failedRecord]);
    const workbook = new Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const row = workbook.getWorksheet(TRANSACTION_RECORDS_SHEET_NAME)?.getRow(2);

    expect(row?.getCell(7).value).toBe(6);
    expect(row?.getCell(8).value).toBe(0);
    expect(row?.getCell(9).value).toBe('付款失败');
    expect(row?.getCell(12).value).toBe('BAT-20260806-001');
  });
});
