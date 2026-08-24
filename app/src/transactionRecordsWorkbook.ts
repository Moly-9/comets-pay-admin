import type { Payout } from './types';
import { paymentProviderDisplayName } from './paymentProviderPresentation';
import { transactionCreatorLabel, transactionOccurredAt } from './transactionRecords';

export const TRANSACTION_RECORDS_TEMPLATE_PATH = '/export-assets/transactions/transaction-records-template.xlsx';
export const TRANSACTION_RECORDS_SHEET_NAME = 'AWX payments';

const TRANSACTION_RECORD_HEADERS = [
  '付款达人',
  '请款项目',
  '关联项目',
  '付款日期',
  '付款渠道',
  '付款金额',
  '状态',
  '余额',
] as const;

const excelDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) return value;
  const [, year, month, day, hour = '00', minute = '00'] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
};

export const transactionRecordsFilename = (now = new Date()) => {
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  return `COMETS-Pay-交易流水-${localDate}.xlsx`;
};

export const createTransactionRecordsWorkbook = async (
  template: ArrayBuffer,
  payouts: Payout[],
) => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  await workbook.xlsx.load(template);

  const worksheet = workbook.getWorksheet(TRANSACTION_RECORDS_SHEET_NAME) ?? workbook.worksheets[0];
  if (!worksheet) throw new Error('交易流水模版缺少工作表');

  const headers = TRANSACTION_RECORD_HEADERS.map((_, index) => worksheet.getRow(1).getCell(index + 1).text.trim());
  if (headers.some((header, index) => header !== TRANSACTION_RECORD_HEADERS[index])) {
    throw new Error('交易流水模版字段与系统版本不一致');
  }

  if (worksheet.rowCount > 1) worksheet.spliceRows(2, worksheet.rowCount - 1);
  [32, 22, 52, 21, 16, 18, 14, 18].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = { from: 'A1', to: 'H1' };

  payouts.forEach((payout) => {
    const row = worksheet.addRow([
      transactionCreatorLabel(payout),
      payout.invoice,
      `${payout.projectId} · ${payout.project}`,
      excelDate(transactionOccurredAt(payout)),
      paymentProviderDisplayName(payout.provider),
      payout.amount,
      payout.status,
      null,
    ]);

    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: '宋体', size: 11 };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFD9D9D9' } },
      };
    });
    row.getCell(4).numFmt = 'yyyy-mm-dd hh:mm';
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).numFmt = `[$${payout.currency}] #,##0.00`;
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
  });

  if (payouts.length) worksheet.autoFilter = { from: 'A1', to: `H${payouts.length + 1}` };
  workbook.creator = 'COMETS Pay';
  workbook.lastModifiedBy = 'COMETS Pay';

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob(
    [new Uint8Array(buffer as ArrayBuffer)],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
};

export const loadTransactionRecordsWorkbook = async (
  payouts: Payout[],
  fetcher: typeof fetch = fetch,
) => {
  const response = await fetcher(TRANSACTION_RECORDS_TEMPLATE_PATH);
  if (!response.ok) throw new Error('交易流水模版加载失败');
  return createTransactionRecordsWorkbook(await response.arrayBuffer(), payouts);
};
