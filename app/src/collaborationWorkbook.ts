import type { CollaborationInvoiceRow } from './collaborationInvoices';

export const COLLABORATION_WORKBOOK_HEADERS = [
  '达人名称',
  '社媒账号',
  '项目名称',
  '项目编号',
  '合作交付',
  'Invoice 编号',
  '付款进度',
  '请款时间',
] as const;

const shanghaiParts = (date: Date) => Object.fromEntries(
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((part) => [part.type, part.value]),
);

const requestTimeForExcel = (value?: string): Date | string => {
  if (!value) return '未发起';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = shanghaiParts(date);
  return new Date(Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute),
  ));
};

export const buildCollaborationWorkbookRows = (rows: readonly CollaborationInvoiceRow[]) => rows.map((row) => ({
  creatorName: row.identity.displayName,
  socialAccount: `${row.identity.platform} · ${row.identity.channelId}`,
  projectName: row.projectName,
  projectCode: row.project?.cooperationProjectCode ?? row.project?.projectCode ?? row.projectLinkId ?? '项目资料未找到',
  description: row.descriptionText,
  invoiceNumber: row.invoiceNumber,
  paymentStatus: row.status,
  requestTime: requestTimeForExcel(row.requestSubmittedAt),
}));

export const collaborationWorkbookFilename = (date = new Date()) => {
  const parts = shanghaiParts(date);
  return `合作名单-${parts.year}${parts.month}${parts.day}.xlsx`;
};

export const createCollaborationWorkbook = async (rows: readonly CollaborationInvoiceRow[]) => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'COMETS Pay';
  const sheet = workbook.addWorksheet('合作名单', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: COLLABORATION_WORKBOOK_HEADERS[0], key: 'creatorName', width: 26 },
    { header: COLLABORATION_WORKBOOK_HEADERS[1], key: 'socialAccount', width: 34 },
    { header: COLLABORATION_WORKBOOK_HEADERS[2], key: 'projectName', width: 34 },
    { header: COLLABORATION_WORKBOOK_HEADERS[3], key: 'projectCode', width: 24 },
    { header: COLLABORATION_WORKBOOK_HEADERS[4], key: 'description', width: 44 },
    { header: COLLABORATION_WORKBOOK_HEADERS[5], key: 'invoiceNumber', width: 26 },
    { header: COLLABORATION_WORKBOOK_HEADERS[6], key: 'paymentStatus', width: 18 },
    { header: COLLABORATION_WORKBOOK_HEADERS[7], key: 'requestTime', width: 24 },
  ];
  sheet.autoFilter = { from: 'A1', to: 'H1' };
  sheet.getRow(1).height = 24;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { name: '宋体', size: 11, bold: true, color: { argb: 'FF394150' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F7' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD8DDE7' } } };
  });
  buildCollaborationWorkbookRows(rows).forEach((item) => {
    const row = sheet.addRow(item);
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: '宋体', size: 11, color: { argb: 'FF414752' } };
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E8EE' } } };
    });
    row.getCell(8).numFmt = 'yyyy-mm-dd hh:mm';
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer as ArrayBuffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};
