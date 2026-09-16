import type { CreatorId, EngagementId, ProjectId } from '../businessWorkflow';
import type { CreatorProfile } from '../types';

export const INVOICE_BATCH_CREATOR_IMPORT_SCHEMA_VERSION = '1.0' as const;
export const INVOICE_BATCH_GLOBAL_CREATOR_IMPORT_SCHEMA_VERSION = '2.0' as const;
export const INVOICE_BATCH_CREATOR_IMPORT_MAX_FILE_SIZE = 5 * 1024 * 1024;

const CREATOR_SHEET = '达人名单';
const METADATA_SHEET = '_metadata';
const CREATOR_HEADERS = ['频道ID', 'Display Name', '频道链接'] as const;
const PROJECT_TEMPLATE_PURPOSE = 'PROJECT_CREATOR_SELECTION';
const GLOBAL_TEMPLATE_PURPOSE = 'INVOICE_BATCH_GLOBAL_CREATOR_SELECTION';

export type InvoiceBatchCreatorImportRow = {
  sourceRow: number;
  channelId: string;
  displayName: string;
  channelUrl: string;
};

export type InvoiceBatchCreatorImportIssueCode =
  | 'INVALID_TEMPLATE'
  | 'UNSUPPORTED_VERSION'
  | 'WRONG_PROJECT'
  | 'NOT_FOUND'
  | 'AMBIGUOUS'
  | 'FIELD_CONFLICT'
  | 'NOT_IN_PROJECT'
  | 'DUPLICATE'
  | 'LIMIT';

export type InvoiceBatchCreatorImportIssue = {
  code: InvoiceBatchCreatorImportIssueCode;
  message: string;
  sourceRow?: number;
  sourceValue?: string;
};

export type InvoiceBatchCreatorMatch = {
  engagementId: EngagementId;
  creatorId: CreatorId;
  creatorName: string;
  creatorHandle: string;
  sourceLabel: string;
};

export type InvoiceBatchGlobalCreatorMatch = Omit<InvoiceBatchCreatorMatch, 'engagementId'>;

export type InvoiceBatchGlobalCreatorMatchResult = {
  matches: InvoiceBatchGlobalCreatorMatch[];
  issues: InvoiceBatchCreatorImportIssue[];
};

export type InvoiceBatchCreatorMatchResult = {
  matches: InvoiceBatchCreatorMatch[];
  issues: InvoiceBatchCreatorImportIssue[];
};

export type InvoiceBatchProjectCreatorReference = {
  creatorId: CreatorId;
  engagementId: EngagementId;
  status?: 'active' | 'removed';
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

export const normalizeInvoiceBatchChannelId = (value: string) => (
  value.trim().replace(/^@+/, '').toLocaleLowerCase('en-US')
);

export const normalizeInvoiceBatchDisplayName = (value: string) => (
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
);

export const normalizeInvoiceBatchChannelUrl = (value: string) => {
  const source = value.trim();
  if (!source) return '';
  try {
    const parsed = new URL(/^https?:\/\//i.test(source) ? source : `https://${source}`);
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.hostname.toLocaleLowerCase('en-US')}${path}`;
  } catch {
    return source.replace(/[?#].*$/, '').replace(/\/+$/, '').toLocaleLowerCase('en-US');
  }
};

export const exportInvoiceBatchCreatorTemplate = async ({
  projectId,
  projectName,
}: {
  projectId: ProjectId;
  projectName: string;
}) => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'COMETS Pay';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(CREATOR_SHEET, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: CREATOR_HEADERS[0], key: 'channelId', width: 24 },
    { header: CREATOR_HEADERS[1], key: 'displayName', width: 28 },
    { header: CREATOR_HEADERS[2], key: 'channelUrl', width: 48 },
  ];
  sheet.getRow(1).height = 28;
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172A3A' } };
  sheet.getRow(1).alignment = { vertical: 'middle' };
  sheet.autoFilter = { from: 'A1', to: 'C1' };
  for (let rowNumber = 2; rowNumber <= 51; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 23;
    row.alignment = { vertical: 'middle' };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9E8' } };
      cell.protection = { locked: false };
    });
  }
  sheet.getCell('A2').note = '每行填写频道ID、Display Name、频道链接中的任意一项；填写多项时必须指向同一达人。';

  const metadata = workbook.addWorksheet(METADATA_SHEET, { state: 'veryHidden' });
  metadata.addRows([
    ['schema_version', INVOICE_BATCH_CREATOR_IMPORT_SCHEMA_VERSION],
    ['project_id', projectId],
    ['project_name', projectName],
    ['template_purpose', PROJECT_TEMPLATE_PURPOSE],
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob(
    [new Uint8Array(buffer as ArrayBuffer)],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
};

export const exportInvoiceBatchGlobalCreatorTemplate = async () => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'COMETS Pay';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(CREATOR_SHEET, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: CREATOR_HEADERS[0], key: 'channelId', width: 24 },
    { header: CREATOR_HEADERS[1], key: 'displayName', width: 28 },
    { header: CREATOR_HEADERS[2], key: 'channelUrl', width: 48 },
  ];
  sheet.getRow(1).height = 28;
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172A3A' } };
  sheet.getRow(1).alignment = { vertical: 'middle' };
  sheet.autoFilter = { from: 'A1', to: 'C1' };
  for (let rowNumber = 2; rowNumber <= 51; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 23;
    row.alignment = { vertical: 'middle' };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9E8' } };
      cell.protection = { locked: false };
    });
  }
  sheet.getCell('A2').note = '每行填写频道ID、Display Name、频道链接中的任意一项；填写多项时必须指向同一达人。';

  const metadata = workbook.addWorksheet(METADATA_SHEET, { state: 'veryHidden' });
  metadata.addRows([
    ['schema_version', INVOICE_BATCH_GLOBAL_CREATOR_IMPORT_SCHEMA_VERSION],
    ['template_purpose', GLOBAL_TEMPLATE_PURPOSE],
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob(
    [new Uint8Array(buffer as ArrayBuffer)],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
};

export const importInvoiceBatchGlobalCreatorTemplate = async (
  buffer: ArrayBuffer,
): Promise<{
  rows: InvoiceBatchCreatorImportRow[];
  issues: InvoiceBatchCreatorImportIssue[];
  fatal: boolean;
}> => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet(CREATOR_SHEET);
  const metadata = workbook.getWorksheet(METADATA_SHEET);
  if (!sheet || !metadata) {
    return {
      rows: [],
      issues: [{ code: 'INVALID_TEMPLATE', message: '文件不是系统下载的批量 Invoice 达人模板' }],
      fatal: true,
    };
  }

  const actualHeaders = CREATOR_HEADERS.map((_, index) => cellText(sheet.getRow(1).getCell(index + 1).value));
  if (actualHeaders.some((header, index) => header !== CREATOR_HEADERS[index])) {
    return {
      rows: [],
      issues: [{ code: 'INVALID_TEMPLATE', message: '模板表头必须为“频道ID / Display Name / 频道链接”' }],
      fatal: true,
    };
  }

  const metadataValues = new Map<string, string>();
  metadata.eachRow((row) => {
    metadataValues.set(cellText(row.getCell(1).value), cellText(row.getCell(2).value));
  });
  if (
    metadataValues.get('schema_version') !== INVOICE_BATCH_GLOBAL_CREATOR_IMPORT_SCHEMA_VERSION
    || metadataValues.get('template_purpose') !== GLOBAL_TEMPLATE_PURPOSE
  ) {
    return {
      rows: [],
      issues: [{ code: 'UNSUPPORTED_VERSION', message: '模板类型或版本不受支持，请在批量 Invoice 页重新下载通用模板' }],
      fatal: true,
    };
  }

  const rows: InvoiceBatchCreatorImportRow[] = [];
  sheet.eachRow((row, sourceRow) => {
    if (sourceRow === 1) return;
    const channelId = cellText(row.getCell(1).value);
    const displayName = cellText(row.getCell(2).value);
    const channelUrl = cellText(row.getCell(3).value);
    if (!channelId && !displayName && !channelUrl) return;
    rows.push({ sourceRow, channelId, displayName, channelUrl });
  });
  return { rows, issues: [], fatal: false };
};

export const importInvoiceBatchCreatorTemplate = async (
  buffer: ArrayBuffer,
  expectedProjectId: ProjectId,
): Promise<{
  rows: InvoiceBatchCreatorImportRow[];
  issues: InvoiceBatchCreatorImportIssue[];
  fatal: boolean;
}> => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet(CREATOR_SHEET);
  const metadata = workbook.getWorksheet(METADATA_SHEET);
  if (!sheet || !metadata) {
    return {
      rows: [],
      issues: [{ code: 'INVALID_TEMPLATE', message: '文件不是系统下载的达人导入模板' }],
      fatal: true,
    };
  }

  const actualHeaders = CREATOR_HEADERS.map((_, index) => cellText(sheet.getRow(1).getCell(index + 1).value));
  if (actualHeaders.some((header, index) => header !== CREATOR_HEADERS[index])) {
    return {
      rows: [],
      issues: [{ code: 'INVALID_TEMPLATE', message: '模板表头必须为“频道ID / Display Name / 频道链接”' }],
      fatal: true,
    };
  }

  const metadataValues = new Map<string, string>();
  metadata.eachRow((row) => {
    metadataValues.set(cellText(row.getCell(1).value), cellText(row.getCell(2).value));
  });
  const issues: InvoiceBatchCreatorImportIssue[] = [];
  if (metadataValues.get('schema_version') !== INVOICE_BATCH_CREATOR_IMPORT_SCHEMA_VERSION) {
    issues.push({ code: 'UNSUPPORTED_VERSION', message: '模板版本不受支持，请重新下载' });
  }
  if (
    metadataValues.get('template_purpose')
    && metadataValues.get('template_purpose') !== PROJECT_TEMPLATE_PURPOSE
  ) {
    issues.push({ code: 'INVALID_TEMPLATE', message: '请使用“我的请款”中下载的项目达人模板' });
  }
  if (metadataValues.get('project_id') !== expectedProjectId) {
    issues.push({ code: 'WRONG_PROJECT', message: '模板项目与当前选择的合作项目不一致' });
  }
  if (issues.length) return { rows: [], issues, fatal: true };

  const rows: InvoiceBatchCreatorImportRow[] = [];
  sheet.eachRow((row, sourceRow) => {
    if (sourceRow === 1) return;
    const channelId = cellText(row.getCell(1).value);
    const displayName = cellText(row.getCell(2).value);
    const channelUrl = cellText(row.getCell(3).value);
    if (!channelId && !displayName && !channelUrl) return;
    rows.push({ sourceRow, channelId, displayName, channelUrl });
  });
  return { rows, issues: [], fatal: false };
};

const creatorChannelIds = (creator: CreatorProfile) => [
  creator.handle,
  ...creator.socialAccounts.map((account) => account.handle),
].map(normalizeInvoiceBatchChannelId).filter(Boolean);

const creatorChannelUrls = (creator: CreatorProfile) => creator.socialAccounts
  .map((account) => normalizeInvoiceBatchChannelUrl(account.profileUrl))
  .filter(Boolean);

const candidatesForField = (
  creators: CreatorProfile[],
  field: 'channelId' | 'displayName' | 'channelUrl',
  value: string,
) => {
  if (field === 'channelId') {
    const normalized = normalizeInvoiceBatchChannelId(value);
    return creators.filter((creator) => creatorChannelIds(creator).includes(normalized));
  }
  if (field === 'displayName') {
    const normalized = normalizeInvoiceBatchDisplayName(value);
    return creators.filter((creator) => normalizeInvoiceBatchDisplayName(creator.name) === normalized);
  }
  const normalized = normalizeInvoiceBatchChannelUrl(value);
  return creators.filter((creator) => creatorChannelUrls(creator).includes(normalized));
};

const fieldLabel = {
  channelId: '频道ID',
  displayName: 'Display Name',
  channelUrl: '频道链接',
} as const;

export const matchInvoiceBatchCreatorRows = ({
  rows,
  creators,
  projectReferences,
}: {
  rows: InvoiceBatchCreatorImportRow[];
  creators: CreatorProfile[];
  projectReferences: InvoiceBatchProjectCreatorReference[];
}): InvoiceBatchCreatorMatchResult => {
  const matches: InvoiceBatchCreatorMatch[] = [];
  const issues: InvoiceBatchCreatorImportIssue[] = [];
  const seenEngagementIds = new Set<EngagementId>();
  const activeReferenceByCreatorId = new Map(projectReferences
    .filter((reference) => reference.status !== 'removed')
    .map((reference) => [reference.creatorId, reference]));

  rows.forEach((row) => {
    const values = ([
      ['channelId', row.channelId],
      ['displayName', row.displayName],
      ['channelUrl', row.channelUrl],
    ] as const).filter((entry) => entry[1].trim());
    const resolvedCreators: CreatorProfile[] = [];
    let rowHasIssue = false;

    values.forEach(([field, value]) => {
      const candidates = candidatesForField(creators, field, value);
      if (!candidates.length) {
        issues.push({
          code: 'NOT_FOUND',
          sourceRow: row.sourceRow,
          sourceValue: value,
          message: `第 ${row.sourceRow} 行的${fieldLabel[field]}未匹配到达人`,
        });
        rowHasIssue = true;
      } else if (candidates.length > 1) {
        issues.push({
          code: 'AMBIGUOUS',
          sourceRow: row.sourceRow,
          sourceValue: value,
          message: `第 ${row.sourceRow} 行的${fieldLabel[field]}匹配到多位达人，请改用频道ID或频道链接`,
        });
        rowHasIssue = true;
      } else {
        resolvedCreators.push(candidates[0]);
      }
    });
    if (rowHasIssue || !resolvedCreators.length) return;

    const creatorIds = new Set(resolvedCreators.map((creator) => creator.id));
    if (creatorIds.size > 1) {
      issues.push({
        code: 'FIELD_CONFLICT',
        sourceRow: row.sourceRow,
        message: `第 ${row.sourceRow} 行填写的频道ID、Display Name和频道链接指向不同达人`,
      });
      return;
    }

    const creator = resolvedCreators[0];
    const reference = activeReferenceByCreatorId.get(creator.id as CreatorId);
    if (!reference) {
      issues.push({
        code: 'NOT_IN_PROJECT',
        sourceRow: row.sourceRow,
        sourceValue: creator.name,
        message: `第 ${row.sourceRow} 行的 ${creator.name} 不属于当前合作项目`,
      });
      return;
    }
    if (seenEngagementIds.has(reference.engagementId)) {
      issues.push({
        code: 'DUPLICATE',
        sourceRow: row.sourceRow,
        sourceValue: creator.name,
        message: `第 ${row.sourceRow} 行的 ${creator.name} 重复，已自动去重`,
      });
      return;
    }

    seenEngagementIds.add(reference.engagementId);
    matches.push({
      engagementId: reference.engagementId,
      creatorId: creator.id as CreatorId,
      creatorName: creator.name,
      creatorHandle: creator.handle,
      sourceLabel: `第 ${row.sourceRow} 行`,
    });
  });

  return { matches, issues };
};

export const parseInvoiceBatchCreatorTokens = (value: string) => value
  .split(/[\n\r\t,，;；、|]+/)
  .map((token) => token.trim())
  .filter(Boolean);

const isInvoiceBatchChannelUrlToken = (value: string) => {
  const source = value.trim();
  if (!source || /\s/.test(source)) return false;
  if (/^(?:https?:\/\/|www\.)/i.test(source)) return true;
  return /^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#]|$)/i.test(source);
};

export const matchInvoiceBatchCreatorTokens = ({
  tokens,
  creators,
  projectReferences,
}: {
  tokens: string[];
  creators: CreatorProfile[];
  projectReferences: InvoiceBatchProjectCreatorReference[];
}): InvoiceBatchCreatorMatchResult => {
  const rows: InvoiceBatchCreatorImportRow[] = [];
  const directMatches: InvoiceBatchCreatorMatch[] = [];
  const issues: InvoiceBatchCreatorImportIssue[] = [];
  const remainingTokens: Array<{ token: string; sourceRow: number }> = [];
  const activeReferenceByCreatorId = new Map(projectReferences
    .filter((reference) => reference.status !== 'removed')
    .map((reference) => [reference.creatorId, reference]));
  const seenEngagementIds = new Set<EngagementId>();

  tokens.forEach((token, index) => {
    const creator = creators.find((candidate) => candidate.id === token);
    if (!creator) {
      remainingTokens.push({ token, sourceRow: index + 1 });
      return;
    }
    const reference = activeReferenceByCreatorId.get(creator.id as CreatorId);
    if (!reference) {
      issues.push({
        code: 'NOT_IN_PROJECT',
        sourceRow: index + 1,
        sourceValue: token,
        message: `${token} 对应的达人不属于当前合作项目`,
      });
      return;
    }
    if (seenEngagementIds.has(reference.engagementId)) {
      issues.push({ code: 'DUPLICATE', sourceValue: token, message: `${token} 重复，已自动去重` });
      return;
    }
    seenEngagementIds.add(reference.engagementId);
    directMatches.push({
      engagementId: reference.engagementId,
      creatorId: creator.id as CreatorId,
      creatorName: creator.name,
      creatorHandle: creator.handle,
      sourceLabel: `第 ${index + 1} 项`,
    });
  });

  remainingTokens.forEach(({ token, sourceRow }) => {
    if (isInvoiceBatchChannelUrlToken(token)) {
      rows.push({ sourceRow, channelId: '', displayName: '', channelUrl: token });
      return;
    }
    const channelCandidates = candidatesForField(creators, 'channelId', token);
    if (channelCandidates.length) {
      rows.push({ sourceRow, channelId: token, displayName: '', channelUrl: '' });
    } else {
      rows.push({ sourceRow, channelId: '', displayName: token, channelUrl: '' });
    }
  });
  const resolved = matchInvoiceBatchCreatorRows({ rows, creators, projectReferences });
  resolved.matches.forEach((match) => {
    if (seenEngagementIds.has(match.engagementId)) {
      issues.push({ code: 'DUPLICATE', sourceValue: match.creatorName, message: `${match.creatorName} 重复，已自动去重` });
    } else {
      seenEngagementIds.add(match.engagementId);
      directMatches.push(match);
    }
  });
  return { matches: directMatches, issues: [...issues, ...resolved.issues] };
};

const globalCreatorReferences = (creators: CreatorProfile[]): InvoiceBatchProjectCreatorReference[] => (
  creators.map((creator) => ({
    creatorId: creator.id as CreatorId,
    engagementId: `global-creator:${creator.id}` as EngagementId,
    status: 'active',
  }))
);

const withoutGlobalEngagement = (
  result: InvoiceBatchCreatorMatchResult,
): InvoiceBatchGlobalCreatorMatchResult => ({
  matches: result.matches.map(({ engagementId: _engagementId, ...match }) => match),
  issues: result.issues,
});

export const matchInvoiceBatchGlobalCreatorRows = ({
  rows,
  creators,
}: {
  rows: InvoiceBatchCreatorImportRow[];
  creators: CreatorProfile[];
}) => withoutGlobalEngagement(matchInvoiceBatchCreatorRows({
  rows,
  creators,
  projectReferences: globalCreatorReferences(creators),
}));

export const matchInvoiceBatchGlobalCreatorTokens = ({
  tokens,
  creators,
}: {
  tokens: string[];
  creators: CreatorProfile[];
}) => withoutGlobalEngagement(matchInvoiceBatchCreatorTokens({
  tokens,
  creators,
  projectReferences: globalCreatorReferences(creators),
}));

export const mergeInvoiceBatchCreatorSelection = <SelectionId extends string>({
  currentIds,
  incomingIds,
  lockedIds,
  mode,
  maxRows,
}: {
  currentIds: SelectionId[];
  incomingIds: SelectionId[];
  lockedIds: SelectionId[];
  mode: 'APPEND' | 'REPLACE';
  maxRows: number;
}) => {
  const locked = [...new Set(lockedIds)];
  const base = mode === 'APPEND'
    ? [...new Set([...currentIds, ...locked])]
    : locked;
  const candidates = [...new Set([...base, ...incomingIds])];
  const selectedIds = candidates.slice(0, maxRows);
  const overflowIds = incomingIds.filter((id) => !selectedIds.includes(id));
  return { selectedIds, overflowIds };
};
