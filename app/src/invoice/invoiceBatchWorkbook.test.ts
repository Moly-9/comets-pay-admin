import { Workbook } from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { CreatorId, EngagementId, ProjectId } from '../businessWorkflow';
import { INITIAL_INVOICE_ENTITY } from '../data';
import { eligibleInvoicePayoutAccounts } from '../payoutAccounts';
import { INITIAL_CREATORS } from '../pages/OperationalPages';
import type { InvoiceBatchRow } from '../types';
import {
  createInvoiceBatchRow,
  updateInvoiceBatchLineItem,
  type InvoiceBatchContext,
} from './invoiceBatch';
import {
  exportInvoiceBatchWorkbook,
  importInvoiceBatchWorkbook,
} from './invoiceBatchWorkbook';

const creator = INITIAL_CREATORS.find((item) => eligibleInvoicePayoutAccounts(item).length)!;
const engagementId = 'engagement_workbook_1' as EngagementId;
const projectId = 'project_workbook' as ProjectId;
const context: InvoiceBatchContext = {
  project: {
    id: projectId,
    projectId,
    projectCode: 'PRJ-WORKBOOK',
    name: 'Workbook Test',
    brand: 'Synthetic',
    media: 'Test',
    pm: 'Test',
    creators: 1,
    budget: 'USD 1,000',
    status: '草稿',
    creatorProfiles: [{
      creatorId: creator.id as CreatorId,
      engagementId,
      projectId,
      status: 'active',
      name: creator.name,
      handle: creator.handle,
      platform: creator.platform,
    }],
  },
  creators: [creator],
  payouts: [],
  contracts: [],
  generatedInvoices: [],
  invoiceEntity: INITIAL_INVOICE_ENTITY,
};

const createRows = (): InvoiceBatchRow[] => {
  const first = createInvoiceBatchRow({
    ...context,
    engagementId,
    invoiceDate: '2026-08-06',
    lineItems: [{ templateKey: 'template_workbook_1', description: 'First Description' }],
  });
  return [
    first,
    {
      ...first,
      engagementId: 'engagement_workbook_2' as EngagementId,
      creatorId: 'creator_workbook_2' as CreatorId,
      creatorName: 'Second Creator',
      creatorHandle: '@second',
      sourcePayoutId: 'payout_workbook_2',
      items: [{
        ...first.items[0],
        id: 'item_workbook_2',
        templateKey: 'template_workbook_2',
        description: 'Second Description',
      }],
    },
  ].map((row, index) => ({
    ...row,
    items: updateInvoiceBatchLineItem(row.items, row.items[0].id, {
      unitPrice: 100 + index * 50,
      quantity: index + 1,
    }),
  }));
};

const expectedRows = (rows: InvoiceBatchRow[]) => rows.map((row) => ({
  engagementId: row.engagementId,
  creatorId: row.creatorId,
}));

describe('Invoice batch XLSX', () => {
  it('imports reordered rows by stable engagement ID', async () => {
    const rows = createRows().reverse();
    const blob = await exportInvoiceBatchWorkbook({
      batchId: 'batch_workbook',
      projectId,
      invoiceDate: '2026-08-06',
    }, rows);
    const result = await importInvoiceBatchWorkbook(await blob.arrayBuffer(), {
      batchId: 'batch_workbook',
      projectId,
      rows: expectedRows(rows.slice().reverse()),
    });

    expect(result.issues).toEqual([]);
    expect(result.values.map((value) => value.engagementId)).toEqual(rows.map((row) => row.engagementId));
    expect(result.values[0]).toMatchObject({
      description: rows[0].items[0].description,
      unitPrice: rows[0].items[0].unitPrice,
      quantity: rows[0].items[0].quantity,
    });
  });

  it('rejects a modified creator stable ID', async () => {
    const rows = createRows();
    const blob = await exportInvoiceBatchWorkbook({
      batchId: 'batch_workbook',
      projectId,
      invoiceDate: '2026-08-06',
    }, rows);
    const workbook = new Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    workbook.getWorksheet('Invoices')!.getRow(2).getCell(4).value = 'creator_tampered';
    const buffer = await workbook.xlsx.writeBuffer();
    const result = await importInvoiceBatchWorkbook(
      new Uint8Array(buffer as ArrayBuffer).buffer,
      {
        batchId: 'batch_workbook',
        projectId: 'project_workbook',
        rows: expectedRows(rows),
      },
    );

    expect(result.issues).toContain('第 2 行的达人稳定 ID 被修改');
    expect(result.values).toHaveLength(1);
  });

  it('reports a missing selected engagement without blocking other values', async () => {
    const rows = createRows();
    const blob = await exportInvoiceBatchWorkbook({
      batchId: 'batch_workbook',
      projectId,
      invoiceDate: '2026-08-06',
    }, rows.slice(0, 1));
    const result = await importInvoiceBatchWorkbook(await blob.arrayBuffer(), {
      batchId: 'batch_workbook',
      projectId,
      rows: expectedRows(rows),
    });

    expect(result.values).toHaveLength(1);
    expect(result.issues).toContain(`模板缺少合作关系 ${rows[1].engagementId}`);
  });

  it('rejects a template from another batch', async () => {
    const rows = createRows();
    const blob = await exportInvoiceBatchWorkbook({
      batchId: 'batch_workbook',
      projectId,
      invoiceDate: '2026-08-06',
    }, rows);
    const result = await importInvoiceBatchWorkbook(await blob.arrayBuffer(), {
      batchId: 'batch_other',
      projectId,
      rows: expectedRows(rows),
    });

    expect(result.issues).toContain('模板不属于当前批次');
    expect(result.values).toHaveLength(0);
  });

  it('reports invalid Price while preserving other valid rows', async () => {
    const rows = createRows();
    const blob = await exportInvoiceBatchWorkbook({
      batchId: 'batch_workbook',
      projectId,
      invoiceDate: '2026-08-06',
    }, rows);
    const workbook = new Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    workbook.getWorksheet('Invoices')!.getRow(2).getCell(9).value = 'invalid';
    const buffer = await workbook.xlsx.writeBuffer();
    const result = await importInvoiceBatchWorkbook(
      new Uint8Array(buffer as ArrayBuffer).buffer,
      {
        batchId: 'batch_workbook',
        projectId,
        rows: expectedRows(rows),
      },
    );

    expect(result.issues).toContain('第 2 行 Price 必须大于 0');
    expect(result.values).toHaveLength(2);
    expect(result.values[1].unitPrice).toBe(rows[1].items[0].unitPrice);
  });

  it('keeps XLSX import mode limited to the first Invoice line item', async () => {
    const rows = createRows();
    rows[0] = {
      ...rows[0],
      items: [
        ...rows[0].items,
        {
          ...rows[0].items[0],
          id: 'item_workbook_extra',
          templateKey: 'template_workbook_extra',
          description: 'Not exported in XLSX v1',
          unitPrice: 999,
          quantity: 1,
          lineTotal: 999,
        },
      ],
    };
    const blob = await exportInvoiceBatchWorkbook({
      batchId: 'batch_workbook',
      projectId,
      invoiceDate: '2026-08-06',
    }, rows);
    const result = await importInvoiceBatchWorkbook(await blob.arrayBuffer(), {
      batchId: 'batch_workbook',
      projectId,
      rows: expectedRows(rows),
    });

    expect(result.values[0]).toMatchObject({
      description: rows[0].items[0].description,
      unitPrice: rows[0].items[0].unitPrice,
      quantity: rows[0].items[0].quantity,
    });
    expect(result.values[0].description).not.toBe('Not exported in XLSX v1');
  });

  it('throws for a damaged XLSX file', async () => {
    await expect(importInvoiceBatchWorkbook(
      new Uint8Array([1, 2, 3, 4]).buffer,
      {
        batchId: 'batch_workbook',
        projectId,
        rows: [],
      },
    )).rejects.toThrow();
  });
});
