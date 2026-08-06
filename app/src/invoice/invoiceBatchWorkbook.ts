import type { InvoiceBatchDraft, InvoiceBatchRow } from '../types';
import {
  INVOICE_BATCH_MAX_ROWS,
  INVOICE_BATCH_SCHEMA_VERSION,
} from './invoiceBatch';

const INVOICE_SHEET = 'Invoices';
const METADATA_SHEET = '_Metadata';
const INSTRUCTIONS_SHEET = '填写说明';

export type InvoiceBatchWorkbookValue = {
  projectId: string;
  engagementId: string;
  creatorId: string;
  description: string;
  unitPrice: number;
  quantity: number;
};

export type InvoiceBatchWorkbookImport = {
  values: InvoiceBatchWorkbookValue[];
  issues: string[];
};

const cellText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) {
    return String((value as { text?: unknown }).text ?? '').trim();
  }
  if (typeof value === 'object' && 'result' in value) {
    return String((value as { result?: unknown }).result ?? '').trim();
  }
  return String(value).trim();
};

const cellNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  const normalized = cellText(value).replace(/,/g, '');
  return normalized ? Number(normalized) : Number.NaN;
};

export const exportInvoiceBatchWorkbook = async (
  draft: Pick<InvoiceBatchDraft, 'batchId' | 'projectId' | 'invoiceDate'>,
  rows: InvoiceBatchRow[],
) => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'COMETS Pay';
  workbook.created = new Date();

  const instructions = workbook.addWorksheet(INSTRUCTIONS_SHEET, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  instructions.columns = [{ width: 24 }, { width: 78 }];
  instructions.addRows([
    ['字段', '填写要求'],
    ['Description', '必填。填写该达人本次 Invoice 的费用说明。'],
    ['Price', '必填。单价，必须大于 0，最多保留两位小数。'],
    ['Amount', '必填。数量，必须大于 0，Total 由 Price × Amount 自动计算。'],
    ['注意', '请勿新增达人或修改隐藏的稳定 ID。联系人、账户、合同和币种以系统数据为准。'],
  ]);
  instructions.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  instructions.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172A3A' } };

  const sheet = workbook.addWorksheet(INVOICE_SHEET, {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 4 }],
  });
  sheet.columns = [
    { header: 'batch_id', key: 'batchId', width: 18, hidden: true },
    { header: 'project_id', key: 'projectId', width: 18, hidden: true },
    { header: 'engagement_id', key: 'engagementId', width: 22, hidden: true },
    { header: 'creator_id', key: 'creatorId', width: 18, hidden: true },
    { header: 'Creator', key: 'creatorName', width: 24 },
    { header: 'Handle', key: 'creatorHandle', width: 20 },
    { header: 'Currency', key: 'currency', width: 12 },
    { header: 'Description', key: 'description', width: 44 },
    { header: 'Price', key: 'unitPrice', width: 14 },
    { header: 'Amount', key: 'quantity', width: 14 },
    { header: 'Total', key: 'total', width: 16 },
    { header: 'Payout Account', key: 'account', width: 28 },
    { header: 'Contract', key: 'contract', width: 24 },
  ];
  sheet.getRow(1).height = 26;
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172A3A' } };
  sheet.getRow(1).alignment = { vertical: 'middle' };

  rows.forEach((row, index) => {
    const lineItem = row.items[0];
    const worksheetRow = sheet.addRow({
      batchId: draft.batchId,
      projectId: draft.projectId,
      engagementId: row.engagementId,
      creatorId: row.creatorId,
      creatorName: row.creatorName,
      creatorHandle: row.creatorHandle,
      currency: row.currency,
      description: lineItem?.description ?? '',
      unitPrice: lineItem?.unitPrice || '',
      quantity: lineItem?.quantity || 1,
      account: row.payoutAccountId ? '系统已匹配' : '待系统内选择',
      contract: row.contractIds.length ? '系统已匹配' : '未关联或待选择',
    });
    worksheetRow.getCell('total').value = {
      formula: `IF(OR(I${index + 2}="",J${index + 2}=""),"",I${index + 2}*J${index + 2})`,
    };
    ['description', 'unitPrice', 'quantity'].forEach((key) => {
      worksheetRow.getCell(key).protection = { locked: false };
      worksheetRow.getCell(key).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF7D6' },
      };
    });
    worksheetRow.getCell('unitPrice').numFmt = '#,##0.00';
    worksheetRow.getCell('quantity').numFmt = '0.00';
    worksheetRow.getCell('total').numFmt = '#,##0.00';
  });

  sheet.autoFilter = { from: 'E1', to: 'M1' };
  await sheet.protect('comets-pay-prototype', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatColumns: false,
    insertRows: false,
    deleteRows: false,
  });

  const metadata = workbook.addWorksheet(METADATA_SHEET, { state: 'veryHidden' });
  metadata.addRows([
    ['schema_version', INVOICE_BATCH_SCHEMA_VERSION],
    ['batch_id', draft.batchId],
    ['project_id', draft.projectId],
    ['invoice_date', draft.invoiceDate],
    ['row_count', rows.length],
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob(
    [new Uint8Array(buffer as ArrayBuffer)],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
};

export const importInvoiceBatchWorkbook = async (
  buffer: ArrayBuffer,
  expected: {
    batchId: string;
    projectId: string;
    rows: Array<{ engagementId: string; creatorId: string }>;
  },
): Promise<InvoiceBatchWorkbookImport> => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet(INVOICE_SHEET);
  const metadata = workbook.getWorksheet(METADATA_SHEET);
  if (!sheet || !metadata) {
    return { values: [], issues: ['文件不是系统导出的批量 Invoice 模板'] };
  }

  const metadataValues = new Map<string, string>();
  metadata.eachRow((row) => {
    metadataValues.set(cellText(row.getCell(1).value), cellText(row.getCell(2).value));
  });
  const issues: string[] = [];
  if (metadataValues.get('schema_version') !== INVOICE_BATCH_SCHEMA_VERSION) {
    issues.push('模板版本不受支持，请重新下载');
  }
  if (metadataValues.get('batch_id') !== expected.batchId) {
    issues.push('模板不属于当前批次');
  }
  if (metadataValues.get('project_id') !== expected.projectId) {
    issues.push('模板项目与当前选择不一致');
  }

  const expectedIds = new Set(expected.rows.map((row) => row.engagementId));
  const expectedCreators = new Map(expected.rows.map((row) => [row.engagementId, row.creatorId]));
  const seenIds = new Set<string>();
  const values: InvoiceBatchWorkbookValue[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const batchId = cellText(row.getCell(1).value);
    const projectId = cellText(row.getCell(2).value);
    const engagementId = cellText(row.getCell(3).value);
    const creatorId = cellText(row.getCell(4).value);
    const description = cellText(row.getCell(8).value);
    const unitPrice = cellNumber(row.getCell(9).value);
    const quantity = cellNumber(row.getCell(10).value);
    if (!engagementId && !creatorId && !description && !Number.isFinite(unitPrice)) return;

    if (batchId !== expected.batchId || projectId !== expected.projectId) {
      issues.push(`第 ${rowNumber} 行的批次或项目稳定 ID 被修改`);
      return;
    }
    if (!expectedIds.has(engagementId)) {
      issues.push(`第 ${rowNumber} 行包含未选择的合作关系`);
      return;
    }
    if (expectedCreators.get(engagementId) !== creatorId) {
      issues.push(`第 ${rowNumber} 行的达人稳定 ID 被修改`);
      return;
    }
    if (seenIds.has(engagementId)) {
      issues.push(`第 ${rowNumber} 行重复出现同一合作关系`);
      return;
    }
    seenIds.add(engagementId);
    if (!description) issues.push(`第 ${rowNumber} 行缺少 Description`);
    if (!(Number.isFinite(unitPrice) && unitPrice > 0)) issues.push(`第 ${rowNumber} 行 Price 必须大于 0`);
    if (!(Number.isFinite(quantity) && quantity > 0)) issues.push(`第 ${rowNumber} 行 Amount 必须大于 0`);
    values.push({ projectId, engagementId, creatorId, description, unitPrice, quantity });
  });

  expected.rows.forEach(({ engagementId }) => {
    if (!seenIds.has(engagementId)) issues.push(`模板缺少合作关系 ${engagementId}`);
  });
  if (values.length > INVOICE_BATCH_MAX_ROWS) issues.push(`模板最多允许 ${INVOICE_BATCH_MAX_ROWS} 行`);

  return { values, issues: [...new Set(issues)] };
};
