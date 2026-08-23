import { Workbook } from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { CreatorId, EngagementId, ProjectId } from '../businessWorkflow';
import { INITIAL_CREATORS } from '../pages/OperationalPages';
import {
  exportInvoiceBatchCreatorTemplate,
  importInvoiceBatchCreatorTemplate,
  matchInvoiceBatchCreatorRows,
  matchInvoiceBatchCreatorTokens,
  mergeInvoiceBatchCreatorSelection,
  normalizeInvoiceBatchChannelUrl,
  parseInvoiceBatchCreatorTokens,
} from './invoiceBatchCreatorImport';

const creators = INITIAL_CREATORS.slice(0, 4);
const projectId = 'project-creator-import' as ProjectId;
const references = creators.slice(0, 3).map((creator, index) => ({
  creatorId: creator.id as CreatorId,
  engagementId: `engagement-import-${index + 1}` as EngagementId,
  status: 'active' as const,
}));

const workbookBuffer = async (
  rows: Array<[string, string, string]>,
  overrides?: { projectId?: string; headers?: [string, string, string] },
) => {
  const blob = await exportInvoiceBatchCreatorTemplate({
    projectId,
    projectName: 'Creator Import Project',
  });
  const workbook = new Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  const sheet = workbook.getWorksheet('达人名单')!;
  if (overrides?.headers) sheet.getRow(1).values = [...overrides.headers];
  rows.forEach((values, index) => {
    sheet.getRow(index + 2).values = [...values];
  });
  if (overrides?.projectId) {
    workbook.getWorksheet('_metadata')!.getRow(2).getCell(2).value = overrides.projectId;
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer).buffer;
};

describe('Invoice batch creator workbook', () => {
  it('exports the exact three visible headers and imports any one identifier', async () => {
    const first = creators[0];
    const second = creators[1];
    const third = creators[2];
    const buffer = await workbookBuffer([
      [first.handle.toUpperCase(), '', ''],
      ['', `  ${second.name.toUpperCase()}  `, ''],
      ['', '', `${third.socialAccounts[0].profileUrl}/?utm_source=test#profile`],
      ['', '', ''],
    ]);
    const imported = await importInvoiceBatchCreatorTemplate(buffer, projectId);
    const matched = matchInvoiceBatchCreatorRows({
      rows: imported.rows,
      creators,
      projectReferences: references,
    });

    expect(imported).toMatchObject({ fatal: false, issues: [] });
    expect(imported.rows).toHaveLength(3);
    expect(matched.issues).toEqual([]);
    expect(matched.matches.map((match) => match.creatorId)).toEqual([
      first.id,
      second.id,
      third.id,
    ]);

    const workbook = new Workbook();
    await workbook.xlsx.load(buffer);
    expect(workbook.getWorksheet('达人名单')!.getRow(1).values).toEqual([
      undefined,
      '频道ID',
      'Display Name',
      '频道链接',
    ]);
  });

  it('rejects conflicting fields in one row and reports duplicate creators', () => {
    const result = matchInvoiceBatchCreatorRows({
      rows: [{
        sourceRow: 2,
        channelId: creators[0].handle,
        displayName: creators[1].name,
        channelUrl: '',
      }, {
        sourceRow: 3,
        channelId: '',
        displayName: creators[0].name,
        channelUrl: '',
      }, {
        sourceRow: 4,
        channelId: creators[0].handle,
        displayName: '',
        channelUrl: '',
      }],
      creators,
      projectReferences: references,
    });

    expect(result.matches).toHaveLength(1);
    expect(result.issues.map((issue) => issue.code)).toEqual(['FIELD_CONFLICT', 'DUPLICATE']);
  });

  it('distinguishes unknown, ambiguous and non-project creators', () => {
    const duplicateNameCreators = [
      creators[0],
      { ...creators[1], name: creators[0].name },
      creators[3],
    ];
    const result = matchInvoiceBatchCreatorRows({
      rows: [{ sourceRow: 2, channelId: '', displayName: 'Unknown Creator', channelUrl: '' }, {
        sourceRow: 3,
        channelId: '',
        displayName: creators[0].name,
        channelUrl: '',
      }, {
        sourceRow: 4,
        channelId: creators[3].handle,
        displayName: '',
        channelUrl: '',
      }],
      creators: duplicateNameCreators,
      projectReferences: references,
    });

    expect(result.matches).toEqual([]);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'NOT_FOUND',
      'AMBIGUOUS',
      'NOT_IN_PROJECT',
    ]);
  });

  it('rejects another project and changed headers', async () => {
    const wrongProject = await importInvoiceBatchCreatorTemplate(
      await workbookBuffer([[creators[0].handle, '', '']], { projectId: 'project-other' }),
      projectId,
    );
    const changedHeaders = await importInvoiceBatchCreatorTemplate(
      await workbookBuffer([], { headers: ['频道ID', 'Name', '频道链接'] }),
      projectId,
    );

    expect(wrongProject).toMatchObject({ fatal: true });
    expect(wrongProject.issues[0].code).toBe('WRONG_PROJECT');
    expect(changedHeaders).toMatchObject({ fatal: true });
    expect(changedHeaders.issues[0].code).toBe('INVALID_TEMPLATE');
  });

  it('normalizes channel URLs without changing the path identity', () => {
    expect(normalizeInvoiceBatchChannelUrl('HTTPS://Example.COM/Channel/Test/?ref=1#top'))
      .toBe('example.com/Channel/Test');
  });
});

describe('Invoice batch creator text import', () => {
  it('splits all supported delimiters and matches stable ID, handle and display name', () => {
    const tokens = parseInvoiceBatchCreatorTokens(
      `${creators[0].id}，${creators[1].handle}；${creators[2].name}|${creators[2].name}`,
    );
    const result = matchInvoiceBatchCreatorTokens({ tokens, creators, projectReferences: references });

    expect(tokens).toHaveLength(4);
    expect(result.matches.map((match) => match.creatorId)).toEqual(creators.slice(0, 3).map((creator) => creator.id));
    expect(result.issues.some((issue) => issue.code === 'DUPLICATE')).toBe(true);
  });

  it('supports append and replace while retaining locked rows and reporting overflow', () => {
    const current = ['engagement-current', 'engagement-locked'] as EngagementId[];
    const incoming = ['engagement-new-1', 'engagement-new-2'] as EngagementId[];
    const locked = ['engagement-locked'] as EngagementId[];

    expect(mergeInvoiceBatchCreatorSelection({
      currentIds: current,
      incomingIds: incoming,
      lockedIds: locked,
      mode: 'APPEND',
      maxRows: 3,
    })).toEqual({
      selectedIds: ['engagement-current', 'engagement-locked', 'engagement-new-1'],
      overflowIds: ['engagement-new-2'],
    });
    expect(mergeInvoiceBatchCreatorSelection({
      currentIds: current,
      incomingIds: incoming,
      lockedIds: locked,
      mode: 'REPLACE',
      maxRows: 3,
    })).toEqual({
      selectedIds: ['engagement-locked', 'engagement-new-1', 'engagement-new-2'],
      overflowIds: [],
    });
  });
});
