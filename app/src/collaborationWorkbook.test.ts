import { Workbook } from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { CollaborationInvoiceRow } from './collaborationInvoices';
import {
  buildCollaborationWorkbookRows,
  COLLABORATION_WORKBOOK_HEADERS,
  collaborationWorkbookFilename,
  createCollaborationWorkbook,
} from './collaborationWorkbook';

const invoiceRow = (overrides: Partial<CollaborationInvoiceRow> = {}) => ({
  rowId: 'invoice:one',
  identity: { displayName: '达人 A', platform: 'YouTube', channelId: '@artist-a', initials: 'AA' },
  projectName: '夏日合作',
  projectLinkId: 'PRJ-001',
  descriptionText: '短视频一条',
  invoiceNumber: 'INV-001',
  status: '财务审批中',
  requestSubmittedAt: '2026-09-19T16:30:00.000Z',
  ...overrides,
}) as CollaborationInvoiceRow;

describe('collaboration workbook', () => {
  it('maps one Invoice to one row using the linked social account and existing missing-data labels', () => {
    expect(buildCollaborationWorkbookRows([
      invoiceRow(),
      invoiceRow({
        rowId: 'invoice:two', invoiceNumber: 'INV-002', projectLinkId: undefined,
        identity: { displayName: '达人 B', platform: 'Instagram', channelId: '@artist-b', initials: 'BB' },
        requestSubmittedAt: undefined,
      }),
    ])).toMatchObject([
      {
        creatorName: '达人 A', socialAccount: 'YouTube · @artist-a', projectName: '夏日合作',
        projectCode: 'PRJ-001', description: '短视频一条', invoiceNumber: 'INV-001',
        paymentStatus: '财务审批中',
      },
      {
        creatorName: '达人 B', socialAccount: 'Instagram · @artist-b',
        projectCode: '项目资料未找到', invoiceNumber: 'INV-002', requestTime: '未发起',
      },
    ]);
  });

  it('downloads a typed, sortable Excel workbook with exact columns, source order and filter', async () => {
    const source = [invoiceRow(), invoiceRow({ rowId: 'invoice:two', invoiceNumber: 'INV-002' })];
    const blob = await createCollaborationWorkbook(source);
    const workbook = new Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const sheet = workbook.getWorksheet('合作名单');

    expect(workbook.worksheets).toHaveLength(1);
    expect(sheet?.getRow(1).values).toEqual([undefined, ...COLLABORATION_WORKBOOK_HEADERS]);
    expect(sheet?.rowCount).toBe(3);
    expect(sheet?.getRow(2).getCell(6).value).toBe('INV-001');
    expect(sheet?.getRow(3).getCell(6).value).toBe('INV-002');
    expect(sheet?.getRow(2).getCell(8).value).toEqual(new Date('2026-09-20T00:30:00.000Z'));
    expect(sheet?.getRow(2).getCell(8).numFmt).toBe('yyyy-mm-dd hh:mm');
    expect(sheet?.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(sheet?.autoFilter).toBe('A1:H1');
    expect(sheet?.getRow(1).getCell(1).font?.bold).toBe(true);
    expect(sheet?.getRow(2).getCell(2).value).not.toContain('0000001234');
  });

  it('uses the Shanghai business date in the filename', () => {
    expect(collaborationWorkbookFilename(new Date('2026-09-19T16:30:00.000Z')))
      .toBe('合作名单-20260920.xlsx');
  });
});
