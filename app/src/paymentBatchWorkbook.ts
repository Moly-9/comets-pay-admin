import {
  paymentBatchFinancialSummary,
  paymentBatchMoneyTotalsLabel,
  paymentBatchPurposeLabel,
  type PaymentBatchRecord,
} from './paymentBatches';
import { paymentProviderDisplayName } from './paymentProviderPresentation';

const PAYMENT_BATCH_WORKBOOK_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const PAYMENT_BATCH_WORKBOOK_HEADERS = [
  '付款批次号',
  '批次用途',
  '项目编号',
  '付款渠道',
  '付款主体',
  '项目费用归属（日区项目填写日本主体）',
  '项目名称',
  '成本类型',
  '成本类型明细①',
  '请款金额及币种',
  '转账手续费及币种',
  '总支出金额及币种',
  '最后付款日期',
  '项目状态（固定）',
  '发起人',
  '项目PM',
] as const;

export type PaymentBatchWorkbookEntry = Readonly<{
  batch: PaymentBatchRecord;
  currentRequestStatus?: string;
}>;

export type PaymentBatchWorkbookRow = Readonly<{
  paymentBatchCode: string;
  purpose: string;
  requestCode: string;
  provider: string;
  paymentEntity: string;
  projectCostAttribution: string;
  projectName: string;
  costType: string;
  costTypeDetail: string;
  paymentAmount: string;
  transferFeeAmount: string;
  actualPaidAmount: string;
  actualPaymentDate: string;
  requestStatus: string;
  initiator: string;
  projectPm: string;
}>;

const textOrFallback = (value: string | undefined, fallback = '待补充') => (
  value?.trim() || fallback
);

const datePart = (value?: string) => value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];

const paymentResultDate = (
  batch: PaymentBatchRecord,
  items: readonly PaymentBatchRecord['items'][number][],
) => {
  const resultDates = items
    .map((item) => datePart(item.paidAt))
    .filter((value): value is string => Boolean(value))
    .sort();
  return resultDates[resultDates.length - 1]
    ?? datePart(batch.submittedAt)
    ?? datePart(batch.paidAt)
    ?? '—';
};

const paymentResultTotal = (
  batch: PaymentBatchRecord,
  totals: ReturnType<typeof paymentBatchFinancialSummary>['actualPaidAmounts'],
) => batch.status === '付款处理中' || batch.status === '冲退处理中'
  ? '待渠道回写'
  : paymentBatchMoneyTotalsLabel(totals);

export const buildPaymentBatchWorkbookRows = (
  entries: readonly PaymentBatchWorkbookEntry[],
): PaymentBatchWorkbookRow[] => entries.map(({ batch, currentRequestStatus }) => {
  const summary = paymentBatchFinancialSummary(batch);
  return {
    paymentBatchCode: batch.paymentBatchCode,
    purpose: paymentBatchPurposeLabel(batch.purpose),
    requestCode: batch.request.requestCode,
    provider: paymentProviderDisplayName(batch.provider),
    paymentEntity: textOrFallback(batch.request.paymentEntity),
    projectCostAttribution: textOrFallback(batch.request.projectCostAttribution),
    projectName: textOrFallback(batch.request.cooperationProjectName, '待同步'),
    costType: textOrFallback(batch.request.costType),
    costTypeDetail: batch.request.costType === '采购成本'
      ? textOrFallback(batch.request.costTypeDetail)
      : '—',
    paymentAmount: paymentBatchMoneyTotalsLabel(summary.paymentAmounts),
    transferFeeAmount: paymentResultTotal(batch, summary.transferFeeAmounts),
    actualPaidAmount: paymentResultTotal(batch, summary.actualPaidAmounts),
    actualPaymentDate: paymentResultDate(batch, summary.items),
    requestStatus: textOrFallback(currentRequestStatus ?? batch.request.requestStatus, '待同步'),
    initiator: textOrFallback(batch.request.media),
    projectPm: textOrFallback(batch.request.pm),
  };
});

export const createPaymentBatchWorkbook = async (
  entries: readonly PaymentBatchWorkbookEntry[],
) => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'COMETS Pay';
  workbook.created = new Date();
  workbook.subject = '付款批次付款明细';

  const sheet = workbook.addWorksheet('付款明细', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[0], key: 'paymentBatchCode', width: 24 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[1], key: 'purpose', width: 16 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[2], key: 'requestCode', width: 24 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[3], key: 'provider', width: 16 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[4], key: 'paymentEntity', width: 28 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[5], key: 'projectCostAttribution', width: 34 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[6], key: 'projectName', width: 34 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[7], key: 'costType', width: 18 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[8], key: 'costTypeDetail', width: 22 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[9], key: 'paymentAmount', width: 24 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[10], key: 'transferFeeAmount', width: 24 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[11], key: 'actualPaidAmount', width: 26 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[12], key: 'actualPaymentDate', width: 18 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[13], key: 'requestStatus', width: 18 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[14], key: 'initiator', width: 18 },
    { header: PAYMENT_BATCH_WORKBOOK_HEADERS[15], key: 'projectPm', width: 18 },
  ];
  sheet.autoFilter = { from: 'A1', to: 'P1' };
  sheet.getRow(1).height = 34;
  sheet.getRow(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4D5664' } };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  buildPaymentBatchWorkbookRows(entries).forEach((item, index) => {
    const row = sheet.addRow(item);
    row.height = 26;
    row.font = { name: 'Arial', size: 10 };
    row.alignment = { vertical: 'middle', wrapText: true };
    if (index % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FA' } };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer as ArrayBuffer)], { type: PAYMENT_BATCH_WORKBOOK_MIME });
};

const shanghaiDateKey = (date: Date) => Object.fromEntries(
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).map((part) => [part.type, part.value]),
);

export const paymentBatchWorkbookFilename = (date = new Date()) => {
  const parts = shanghaiDateKey(date);
  return `付款批次明细-${parts.year}${parts.month}${parts.day}.xlsx`;
};

export const paymentBatchDetailWorkbookFilename = (paymentBatchCode: string) => (
  `${paymentBatchCode}-付款明细表.xlsx`
);
