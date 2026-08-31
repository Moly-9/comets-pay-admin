import { accountDisplayValue } from './accountPresentation';
import { paymentProviderDisplayName } from './paymentProviderPresentation';
import {
  transactionCreatorLabel,
  transactionRecordDetails,
  type TransactionRecord,
} from './transactionRecords';

export const TRANSACTION_RECORDS_TEMPLATE_PATH = '/export-assets/transactions/transaction-records-template.xlsx';
export const TRANSACTION_RECORDS_SHEET_NAME = 'AWX payments';

const TEMPLATE_HEADERS = [
  '付款达人',
  '请款项目',
  '关联项目',
  '付款日期',
  '付款渠道',
  '付款金额',
  '状态',
  '余额',
] as const;

const TRANSACTION_RECORD_HEADERS = [
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
  records: readonly TransactionRecord[],
) => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  await workbook.xlsx.load(template);

  const worksheet = workbook.getWorksheet(TRANSACTION_RECORDS_SHEET_NAME) ?? workbook.worksheets[0];
  if (!worksheet) throw new Error('交易流水模版缺少工作表');

  const headers = TEMPLATE_HEADERS.map((_, index) => worksheet.getRow(1).getCell(index + 1).text.trim());
  if (headers.some((header, index) => header !== TEMPLATE_HEADERS[index])) {
    throw new Error('交易流水模版字段与系统版本不一致');
  }

  if (worksheet.rowCount > 1) worksheet.spliceRows(2, worksheet.rowCount - 1);
  const headerRow = worksheet.getRow(1);
  TRANSACTION_RECORD_HEADERS.forEach((header, index) => {
    const target = headerRow.getCell(index + 1);
    const styleSource = headerRow.getCell(Math.min(index + 1, TEMPLATE_HEADERS.length));
    target.value = header;
    target.style = { ...styleSource.style };
  });
  [32, 22, 52, 21, 16, 18, 18, 24, 14, 18, 30, 24].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = { from: 'A1', to: 'L1' };

  records.forEach((record) => {
    const { payout, context } = record;
    const details = transactionRecordDetails(payout, context);
    const balance = record.status === '已付款'
      ? context?.item.postTransactionBalance ?? payout.postTransactionBalance ?? null
      : null;
    const row = worksheet.addRow([
      transactionCreatorLabel(payout),
      details.invoice?.invoiceNumber ?? payout.invoice,
      `${details.cooperationProjectCode} · ${details.cooperationProjectName}`,
      excelDate(record.occurredAt),
      paymentProviderDisplayName(record.provider),
      record.paymentAmount,
      record.transferFeeAmount ?? null,
      record.recipientReceivedAmount ?? null,
      record.status,
      balance,
      accountDisplayValue(details.accountSummary),
      details.paymentBatchCode,
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
    [
      { index: 6, currency: record.paymentCurrency },
      { index: 7, currency: record.transferFeeCurrency },
      { index: 8, currency: record.recipientReceivedCurrency },
      { index: 10, currency: context?.item.postTransactionBalanceCurrency ?? payout.postTransactionBalanceCurrency },
    ].forEach(({ index, currency }) => {
      if (!currency || typeof row.getCell(index).value !== 'number') return;
      row.getCell(index).numFmt = `[$${currency}] #,##0.00`;
      row.getCell(index).alignment = { horizontal: 'right', vertical: 'middle' };
    });
  });

  if (records.length) worksheet.autoFilter = { from: 'A1', to: `L${records.length + 1}` };
  workbook.creator = 'COMETS Pay';
  workbook.lastModifiedBy = 'COMETS Pay';

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob(
    [new Uint8Array(buffer as ArrayBuffer)],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
};

export const loadTransactionRecordsWorkbook = async (
  records: readonly TransactionRecord[],
  fetcher: typeof fetch = fetch,
) => {
  const response = await fetcher(TRANSACTION_RECORDS_TEMPLATE_PATH);
  if (!response.ok) throw new Error('交易流水模版加载失败');
  return createTransactionRecordsWorkbook(await response.arrayBuffer(), records);
};
