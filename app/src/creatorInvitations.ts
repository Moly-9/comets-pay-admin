import { createClientRequestId } from './clientRequestId';
import type { CreatorProfile } from './types';

export const CREATOR_INVITATION_TEMPLATE_VERSION = '1.0' as const;
export const CREATOR_INVITATION_STORAGE_VERSION = 1 as const;
export const CREATOR_INVITATION_STORAGE_KEY = 'comets-pay:creator-invitations:v1';
export const CREATOR_INVITATION_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const CREATOR_INVITATION_MAX_ACCOUNTS = 200;
export const CREATOR_INVITATION_VALID_DAYS = 7;
export const CREATOR_INVITATION_SHEET_NAME = '达人邀请名单';
export const CREATOR_INVITATION_HEADERS = ['达人邮箱', '社媒平台', '频道 URL'] as const;
export const CREATOR_INVITATION_PLATFORMS = [
  'Instagram',
  'TikTok',
  'YouTube',
  'Facebook',
  'X',
  'Twitch',
] as const;

const METADATA_SHEET_NAME = '_metadata';
const INSTRUCTIONS_SHEET_NAME = '填写说明';
const INVITATION_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export type CreatorInvitationPlatform = typeof CREATOR_INVITATION_PLATFORMS[number];

export type CreatorInvitationStatus =
  | 'SENT'
  | 'VERIFICATION_REQUESTED'
  | 'REGISTERING'
  | 'COMPLETED'
  | 'EXPIRED';

export type CreatorInvitationSocialAccount = {
  id: string;
  platform: CreatorInvitationPlatform;
  handle: string;
  profileUrl: string;
  sourceRow?: number;
};

export type CreatorInvitationRecord = {
  id: string;
  email: string;
  socialAccounts: CreatorInvitationSocialAccount[];
  invitationCode: string;
  sentAt: string;
  expiresAt: string;
  deliveryStatus: 'SIMULATED_SENT';
  status: CreatorInvitationStatus;
  creatorId?: string;
  verificationRequestedAt?: string;
  registrationStartedAt?: string;
  completedAt?: string;
};

export type CreatorInvitationImportIssueSeverity = 'ERROR' | 'SKIP';

export type CreatorInvitationImportIssueCode =
  | 'FILE_TYPE'
  | 'FILE_SIZE'
  | 'INVALID_TEMPLATE'
  | 'UNSUPPORTED_VERSION'
  | 'EMPTY_LIST'
  | 'LIMIT_EXCEEDED'
  | 'REQUIRED_FIELD'
  | 'INVALID_EMAIL'
  | 'INVALID_PLATFORM'
  | 'INVALID_URL'
  | 'DUPLICATE_ROW'
  | 'EXISTING_CREATOR_EMAIL'
  | 'EXISTING_CHANNEL_URL'
  | 'FILE_CHANNEL_CONFLICT'
  | 'ACTIVE_INVITATION';

export type CreatorInvitationImportIssue = {
  code: CreatorInvitationImportIssueCode;
  severity: CreatorInvitationImportIssueSeverity;
  message: string;
  sourceRow?: number;
  email?: string;
  count?: number;
};

export type CreatorInvitationImportRow = {
  sourceRow: number;
  email: string;
  platform: CreatorInvitationPlatform;
  profileUrl: string;
  handle: string;
};

export type CreatorInvitationWorkbookResult = {
  rows: CreatorInvitationImportRow[];
  issues: CreatorInvitationImportIssue[];
  sourceAccountCount: number;
  fatal: boolean;
};

export type CreatorInvitationPreviewGroup = {
  email: string;
  socialAccounts: CreatorInvitationSocialAccount[];
  sourceRows: number[];
};

export type CreatorInvitationImportPreview = {
  groups: CreatorInvitationPreviewGroup[];
  issues: CreatorInvitationImportIssue[];
  sourceAccountCount: number;
  readyInvitationCount: number;
  readyAccountCount: number;
  skippedAccountCount: number;
  errorCount: number;
};

export const CREATOR_INVITATION_STATUS_LABELS: Record<CreatorInvitationStatus, string> = {
  SENT: '已发送',
  VERIFICATION_REQUESTED: '已请求验证码',
  REGISTERING: '注册中',
  COMPLETED: '已完成',
  EXPIRED: '已失效',
};

const cellText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) {
    return String((value as { text?: unknown }).text ?? '').trim();
  }
  if (typeof value === 'object' && 'result' in value) {
    return String((value as { result?: unknown }).result ?? '').trim();
  }
  if (typeof value === 'object' && 'hyperlink' in value) {
    const linked = value as { text?: unknown; hyperlink?: unknown };
    return String(linked.text ?? linked.hyperlink ?? '').trim();
  }
  return String(value).trim();
};

export const normalizeCreatorInvitationEmail = (value: string) => (
  value.trim().toLocaleLowerCase('en-US')
);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeCreatorInvitationPlatform = (value: string): CreatorInvitationPlatform | null => {
  const normalized = value.trim().toLocaleLowerCase('en-US').replace(/[\s_-]+/g, '');
  if (normalized === 'twitter') return 'X';
  return CREATOR_INVITATION_PLATFORMS.find((platform) => (
    platform.toLocaleLowerCase('en-US').replace(/[\s_-]+/g, '') === normalized
  )) ?? null;
};

export const normalizeCreatorInvitationUrl = (value: string) => {
  const source = value.trim();
  if (!source) return '';
  try {
    const parsed = new URL(source);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return '';
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLocaleLowerCase('en-US').replace(/^www\./, '');
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
    return parsed.toString().replace(/\/$/, parsed.pathname === '/' ? '/' : '');
  } catch {
    return '';
  }
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const creatorInvitationHandleFromUrl = (
  profileUrl: string,
  platform: CreatorInvitationPlatform,
) => {
  const normalized = normalizeCreatorInvitationUrl(profileUrl);
  if (!normalized) return '';
  const parsed = new URL(normalized);
  const segments = parsed.pathname.split('/').map((segment) => safeDecode(segment.trim())).filter(Boolean);
  let candidate = segments[0] ?? '';
  if (platform === 'TikTok') candidate = segments.find((segment) => segment.startsWith('@')) ?? candidate;
  if (platform === 'YouTube') {
    const markerIndex = segments.findIndex((segment) => ['channel', 'user', 'c'].includes(segment.toLocaleLowerCase('en-US')));
    candidate = segments.find((segment) => segment.startsWith('@'))
      ?? (markerIndex >= 0 ? segments[markerIndex + 1] : undefined)
      ?? candidate;
  }
  if (platform === 'Instagram' && ['p', 'reel', 'reels', 'explore'].includes(candidate.toLocaleLowerCase('en-US'))) {
    candidate = '';
  }
  if (platform === 'Facebook' && ['pages', 'groups', 'watch'].includes(candidate.toLocaleLowerCase('en-US'))) {
    candidate = segments[1] ?? '';
  }
  const cleaned = candidate.replace(/^@+/, '').trim();
  return cleaned ? `@${cleaned}` : 'Handle 待识别';
};

export const validateCreatorInvitationFile = (
  file: Pick<File, 'name' | 'size'>,
): CreatorInvitationImportIssue[] => {
  const issues: CreatorInvitationImportIssue[] = [];
  if (!/\.xlsx$/i.test(file.name.trim())) {
    issues.push({
      code: 'FILE_TYPE',
      severity: 'ERROR',
      message: '仅支持上传系统下载的 .xlsx 模板',
    });
  }
  if (file.size > CREATOR_INVITATION_MAX_FILE_SIZE) {
    issues.push({
      code: 'FILE_SIZE',
      severity: 'ERROR',
      message: '文件不能超过 5 MB',
    });
  }
  return issues;
};

export const createCreatorInvitationTemplate = async () => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'COMETS Pay';
  workbook.lastModifiedBy = 'COMETS Pay';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(CREATOR_INVITATION_SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: CREATOR_INVITATION_HEADERS[0], key: 'email', width: 34 },
    { header: CREATOR_INVITATION_HEADERS[1], key: 'platform', width: 22 },
    { header: CREATOR_INVITATION_HEADERS[2], key: 'profileUrl', width: 58 },
  ];
  sheet.autoFilter = { from: 'A1', to: 'C1' };
  sheet.getRow(1).height = 28;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF343A46' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  for (let rowNumber = 2; rowNumber <= CREATOR_INVITATION_MAX_ACCOUNTS + 1; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 23;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber % 2 ? 'FFF9FAFC' : 'FFFFFFFF' } };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE3E6ED' } } };
      cell.alignment = { vertical: 'middle' };
    });
    sheet.getCell(`B${rowNumber}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${CREATOR_INVITATION_PLATFORMS.join(',')}"`],
      showErrorMessage: true,
      errorTitle: '请选择社媒平台',
      error: '请从下拉列表中选择系统支持的社媒平台。',
    };
  }
  sheet.getCell('A2').note = '同一个达人有多个社媒账号时，请使用相同邮箱分行填写；系统会合并为一封邀请。';
  sheet.getCell('C2').note = '仅填写以 http:// 或 https:// 开头的公开频道主页 URL。';

  const instructions = workbook.addWorksheet(INSTRUCTIONS_SHEET_NAME);
  instructions.getColumn(1).width = 96;
  instructions.addRows([
    ['COMETS Pay 达人邀请名单填写说明'],
    ['1. 请勿修改“达人邀请名单”工作表名称、表头或隐藏版本信息。'],
    ['2. 每行填写一个社媒账号：达人邮箱、社媒平台和频道 URL 均为必填。'],
    ['3. 同一达人有多个平台账号时，使用同一邮箱填写多行，系统会合并为一封邀请。'],
    ['4. 支持平台：Instagram、TikTok、YouTube、Facebook、X、Twitch。'],
    ['5. 频道 URL 必须以 http:// 或 https:// 开头；最多识别 200 条账号，文件不得超过 5 MB。'],
    ['6. 本功能仅用于管理端原型演示，邮件为模拟发送，请勿录入真实达人个人资料。'],
  ]);
  instructions.getRow(1).height = 30;
  instructions.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF343A46' } };
  instructions.eachRow((row, rowNumber) => {
    row.alignment = { vertical: 'middle', wrapText: true };
    if (rowNumber > 1) row.height = 30;
  });

  const metadata = workbook.addWorksheet(METADATA_SHEET_NAME, { state: 'veryHidden' });
  metadata.addRows([
    ['schema_type', 'creator_invitation'],
    ['schema_version', CREATOR_INVITATION_TEMPLATE_VERSION],
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob(
    [new Uint8Array(buffer as ArrayBuffer)],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
};

const invalidTemplateResult = (message: string): CreatorInvitationWorkbookResult => ({
  rows: [],
  issues: [{ code: 'INVALID_TEMPLATE', severity: 'ERROR', message }],
  sourceAccountCount: 0,
  fatal: true,
});

export const parseCreatorInvitationWorkbook = async (
  buffer: ArrayBuffer,
): Promise<CreatorInvitationWorkbookResult> => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return invalidTemplateResult('文件无法读取，请使用系统下载的 Excel 模板');
  }
  const sheet = workbook.getWorksheet(CREATOR_INVITATION_SHEET_NAME);
  const metadata = workbook.getWorksheet(METADATA_SHEET_NAME);
  if (!sheet || !metadata) return invalidTemplateResult('文件不是系统下载的达人邀请模板');

  const headers = CREATOR_INVITATION_HEADERS.map((_, index) => cellText(sheet.getRow(1).getCell(index + 1).value));
  if (headers.some((header, index) => header !== CREATOR_INVITATION_HEADERS[index])) {
    return invalidTemplateResult('模板表头必须为“达人邮箱 / 社媒平台 / 频道 URL”');
  }
  const metadataValues = new Map<string, string>();
  metadata.eachRow((row) => {
    metadataValues.set(cellText(row.getCell(1).value), cellText(row.getCell(2).value));
  });
  if (metadataValues.get('schema_type') !== 'creator_invitation') {
    return invalidTemplateResult('模板类型不正确，请重新下载达人邀请模板');
  }
  if (metadataValues.get('schema_version') !== CREATOR_INVITATION_TEMPLATE_VERSION) {
    return {
      rows: [],
      issues: [{
        code: 'UNSUPPORTED_VERSION',
        severity: 'ERROR',
        message: '模板版本不受支持，请重新下载最新模板',
      }],
      sourceAccountCount: 0,
      fatal: true,
    };
  }

  const sourceRows: Array<{ sourceRow: number; email: string; platform: string; profileUrl: string }> = [];
  sheet.eachRow((row, sourceRow) => {
    if (sourceRow === 1) return;
    const email = cellText(row.getCell(1).value);
    const platform = cellText(row.getCell(2).value);
    const profileUrl = cellText(row.getCell(3).value);
    if (!email && !platform && !profileUrl) return;
    sourceRows.push({ sourceRow, email, platform, profileUrl });
  });

  const issues: CreatorInvitationImportIssue[] = [];
  if (!sourceRows.length) {
    issues.push({
      code: 'EMPTY_LIST',
      severity: 'ERROR',
      message: '邀请名单中没有可识别的数据，请至少填写一条社媒账号',
    });
  }
  if (sourceRows.length > CREATOR_INVITATION_MAX_ACCOUNTS) {
    issues.push({
      code: 'LIMIT_EXCEEDED',
      severity: 'ERROR',
      count: sourceRows.length - CREATOR_INVITATION_MAX_ACCOUNTS,
      message: `最多识别 ${CREATOR_INVITATION_MAX_ACCOUNTS} 条账号，超出的 ${sourceRows.length - CREATOR_INVITATION_MAX_ACCOUNTS} 行未处理`,
    });
  }

  const rows: CreatorInvitationImportRow[] = [];
  const seenRows = new Set<string>();
  sourceRows.slice(0, CREATOR_INVITATION_MAX_ACCOUNTS).forEach((source) => {
    const email = normalizeCreatorInvitationEmail(source.email);
    const platform = normalizeCreatorInvitationPlatform(source.platform);
    const profileUrl = normalizeCreatorInvitationUrl(source.profileUrl);
    const missingFields = [
      !source.email.trim() ? '达人邮箱' : '',
      !source.platform.trim() ? '社媒平台' : '',
      !source.profileUrl.trim() ? '频道 URL' : '',
    ].filter(Boolean);
    if (missingFields.length) {
      issues.push({
        code: 'REQUIRED_FIELD',
        severity: 'ERROR',
        sourceRow: source.sourceRow,
        email: email || undefined,
        message: `第 ${source.sourceRow} 行缺少${missingFields.join('、')}`,
      });
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      issues.push({
        code: 'INVALID_EMAIL',
        severity: 'ERROR',
        sourceRow: source.sourceRow,
        email: email || undefined,
        message: `第 ${source.sourceRow} 行的达人邮箱格式不正确`,
      });
      return;
    }
    if (!platform) {
      issues.push({
        code: 'INVALID_PLATFORM',
        severity: 'ERROR',
        sourceRow: source.sourceRow,
        email,
        message: `第 ${source.sourceRow} 行的社媒平台不受支持`,
      });
      return;
    }
    if (!profileUrl) {
      issues.push({
        code: 'INVALID_URL',
        severity: 'ERROR',
        sourceRow: source.sourceRow,
        email,
        message: `第 ${source.sourceRow} 行的频道 URL 必须是有效的 HTTP(S) 地址`,
      });
      return;
    }
    const rowKey = `${email}\u0000${platform}\u0000${profileUrl}`;
    if (seenRows.has(rowKey)) {
      issues.push({
        code: 'DUPLICATE_ROW',
        severity: 'SKIP',
        sourceRow: source.sourceRow,
        email,
        message: `第 ${source.sourceRow} 行与文件内已有账号完全重复，已自动去重`,
      });
      return;
    }
    seenRows.add(rowKey);
    rows.push({
      sourceRow: source.sourceRow,
      email,
      platform,
      profileUrl,
      handle: creatorInvitationHandleFromUrl(profileUrl, platform),
    });
  });
  return {
    rows,
    issues,
    sourceAccountCount: sourceRows.length,
    fatal: false,
  };
};

export const resolveCreatorInvitationStatus = (
  record: CreatorInvitationRecord,
  now: Date = new Date(),
): CreatorInvitationStatus => {
  if (record.status === 'COMPLETED') return 'COMPLETED';
  const expiresAt = new Date(record.expiresAt).getTime();
  if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) return 'EXPIRED';
  return record.status;
};

const isActiveInvitation = (record: CreatorInvitationRecord, now: Date) => (
  ['SENT', 'VERIFICATION_REQUESTED', 'REGISTERING'].includes(resolveCreatorInvitationStatus(record, now))
);

export const buildCreatorInvitationPreview = ({
  workbook,
  creators,
  records,
  now = new Date(),
}: {
  workbook: CreatorInvitationWorkbookResult;
  creators: readonly CreatorProfile[];
  records: readonly CreatorInvitationRecord[];
  now?: Date;
}): CreatorInvitationImportPreview => {
  const issues = [...workbook.issues];
  const existingEmails = new Set(creators
    .map((creator) => normalizeCreatorInvitationEmail(creator.contact.email))
    .filter(Boolean));
  const existingUrls = new Set(creators.flatMap((creator) => creator.socialAccounts)
    .map((account) => normalizeCreatorInvitationUrl(account.profileUrl))
    .filter(Boolean));
  const activeInvitationEmails = new Set(records
    .filter((record) => isActiveInvitation(record, now))
    .map((record) => normalizeCreatorInvitationEmail(record.email)));
  const fileUrlOwner = new Map<string, string>();
  const groupedRows = new Map<string, CreatorInvitationImportRow[]>();

  workbook.rows.forEach((row) => {
    if (existingUrls.has(row.profileUrl)) {
      issues.push({
        code: 'EXISTING_CHANNEL_URL',
        severity: 'SKIP',
        sourceRow: row.sourceRow,
        email: row.email,
        message: `第 ${row.sourceRow} 行的频道 URL 已存在于正式达人档案，已跳过`,
      });
      return;
    }
    const fileOwner = fileUrlOwner.get(row.profileUrl);
    if (fileOwner && fileOwner !== row.email) {
      issues.push({
        code: 'FILE_CHANNEL_CONFLICT',
        severity: 'SKIP',
        sourceRow: row.sourceRow,
        email: row.email,
        message: `第 ${row.sourceRow} 行的频道 URL 已被文件内邮箱 ${fileOwner} 使用，已跳过`,
      });
      return;
    }
    fileUrlOwner.set(row.profileUrl, row.email);
    groupedRows.set(row.email, [...(groupedRows.get(row.email) ?? []), row]);
  });

  const groups: CreatorInvitationPreviewGroup[] = [];
  groupedRows.forEach((rows, email) => {
    if (existingEmails.has(email)) {
      issues.push({
        code: 'EXISTING_CREATOR_EMAIL',
        severity: 'SKIP',
        email,
        count: rows.length,
        message: `${email} 已存在于正式达人档案，本次邀请已跳过`,
      });
      return;
    }
    if (activeInvitationEmails.has(email)) {
      issues.push({
        code: 'ACTIVE_INVITATION',
        severity: 'SKIP',
        email,
        count: rows.length,
        message: `${email} 已有未失效邀请，本次邀请已跳过`,
      });
      return;
    }
    const seenGroupUrls = new Set<string>();
    const socialAccounts = rows.flatMap((row, index) => {
      if (seenGroupUrls.has(row.profileUrl)) {
        issues.push({
          code: 'DUPLICATE_ROW',
          severity: 'SKIP',
          sourceRow: row.sourceRow,
          email,
          message: `第 ${row.sourceRow} 行与该邮箱的另一账号使用相同频道 URL，已自动去重`,
        });
        return [];
      }
      seenGroupUrls.add(row.profileUrl);
      return [{
        id: `preview-${row.sourceRow}-${index + 1}`,
        platform: row.platform,
        handle: row.handle,
        profileUrl: row.profileUrl,
        sourceRow: row.sourceRow,
      }];
    });
    if (!socialAccounts.length) return;
    groups.push({
      email,
      socialAccounts,
      sourceRows: rows.map((row) => row.sourceRow),
    });
  });

  return {
    groups,
    issues,
    sourceAccountCount: workbook.sourceAccountCount,
    readyInvitationCount: groups.length,
    readyAccountCount: groups.reduce((total, group) => total + group.socialAccounts.length, 0),
    skippedAccountCount: issues
      .filter((issue) => issue.severity === 'SKIP')
      .reduce((total, issue) => total + (issue.count ?? 1), 0),
    errorCount: issues.filter((issue) => issue.severity === 'ERROR').length,
  };
};

const randomInvitationCode = () => {
  const values = new Uint8Array(8);
  globalThis.crypto.getRandomValues(values);
  return `CMT-${Array.from(values, (value) => INVITATION_CODE_ALPHABET[value % INVITATION_CODE_ALPHABET.length]).join('')}`;
};

export const createCreatorInvitationRecords = (
  groups: readonly CreatorInvitationPreviewGroup[],
  existingRecords: readonly CreatorInvitationRecord[],
  {
    now = new Date(),
    idFactory = () => `cinv_local_${createClientRequestId()}`,
    codeFactory = randomInvitationCode,
  }: {
    now?: Date;
    idFactory?: (email: string, index: number) => string;
    codeFactory?: () => string;
  } = {},
) => {
  const usedCodes = new Set(existingRecords.map((record) => record.invitationCode));
  const sentAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + CREATOR_INVITATION_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return groups.map((group, groupIndex): CreatorInvitationRecord => {
    let invitationCode = codeFactory();
    let attempts = 0;
    while (usedCodes.has(invitationCode) && attempts < 20) {
      invitationCode = codeFactory();
      attempts += 1;
    }
    if (usedCodes.has(invitationCode)) throw new Error('邀请码生成失败，请重新确认发送');
    usedCodes.add(invitationCode);
    const invitationId = idFactory(group.email, groupIndex);
    return {
      id: invitationId,
      email: group.email,
      socialAccounts: group.socialAccounts.map((account, accountIndex) => ({
        ...account,
        id: `${invitationId}-social-${accountIndex + 1}`,
      })),
      invitationCode,
      sentAt,
      expiresAt,
      deliveryStatus: 'SIMULATED_SENT',
      status: 'SENT',
    };
  });
};

const isInvitationStatus = (value: unknown): value is CreatorInvitationStatus => (
  typeof value === 'string' && value in CREATOR_INVITATION_STATUS_LABELS
);

const isInvitationPlatform = (value: unknown): value is CreatorInvitationPlatform => (
  typeof value === 'string' && CREATOR_INVITATION_PLATFORMS.includes(value as CreatorInvitationPlatform)
);

const isCreatorInvitationRecord = (value: unknown): value is CreatorInvitationRecord => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<CreatorInvitationRecord>;
  return typeof record.id === 'string'
    && typeof record.email === 'string'
    && typeof record.invitationCode === 'string'
    && typeof record.sentAt === 'string'
    && typeof record.expiresAt === 'string'
    && record.deliveryStatus === 'SIMULATED_SENT'
    && isInvitationStatus(record.status)
    && Array.isArray(record.socialAccounts)
    && record.socialAccounts.every((account) => (
      Boolean(account)
      && typeof account.id === 'string'
      && isInvitationPlatform(account.platform)
      && typeof account.handle === 'string'
      && typeof account.profileUrl === 'string'
    ));
};

export const parseCreatorInvitationStorage = (raw: string | null): CreatorInvitationRecord[] => {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as { version?: unknown; records?: unknown };
  if (parsed.version !== CREATOR_INVITATION_STORAGE_VERSION || !Array.isArray(parsed.records)) return [];
  return parsed.records.filter(isCreatorInvitationRecord);
};

export const loadCreatorInvitationRecords = (
  storage: Pick<Storage, 'getItem'>,
) => parseCreatorInvitationStorage(storage.getItem(CREATOR_INVITATION_STORAGE_KEY));

export const saveCreatorInvitationRecords = (
  records: readonly CreatorInvitationRecord[],
  storage: Pick<Storage, 'setItem'>,
) => {
  storage.setItem(CREATOR_INVITATION_STORAGE_KEY, JSON.stringify({
    version: CREATOR_INVITATION_STORAGE_VERSION,
    records,
  }));
};

export type CreatorInvitationStatusFilter = 'all' | CreatorInvitationStatus;

export const filterCreatorInvitationRecords = (
  records: readonly CreatorInvitationRecord[],
  {
    search,
    status,
    now = new Date(),
  }: {
    search: string;
    status: CreatorInvitationStatusFilter;
    now?: Date;
  },
) => {
  const query = search.trim().toLocaleLowerCase('zh-CN');
  return records
    .map((record) => ({ ...record, status: resolveCreatorInvitationStatus(record, now) }))
    .filter((record) => {
      if (status !== 'all' && record.status !== status) return false;
      if (!query) return true;
      const searchable = [
        record.email,
        record.invitationCode,
        CREATOR_INVITATION_STATUS_LABELS[record.status],
        ...record.socialAccounts.flatMap((account) => [
          account.platform,
          account.handle,
          account.profileUrl,
        ]),
      ].join(' ').toLocaleLowerCase('zh-CN');
      return query.split(/\s+/).every((term) => searchable.includes(term));
    })
    .sort((left, right) => right.sentAt.localeCompare(left.sentAt));
};

const SHANGHAI_INVITATION_DATE_TIME = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const formatCreatorInvitationDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间待同步';
  const parts = Object.fromEntries(SHANGHAI_INVITATION_DATE_TIME.formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
};
