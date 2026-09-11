import { Workbook } from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  buildCreatorInvitationPreview,
  createCreatorInvitationRecords,
  createCreatorInvitationTemplate,
  CREATOR_INVITATION_HEADERS,
  CREATOR_INVITATION_MAX_ACCOUNTS,
  CREATOR_INVITATION_MAX_FILE_SIZE,
  CREATOR_INVITATION_SHEET_NAME,
  CREATOR_INVITATION_STORAGE_KEY,
  CREATOR_INVITATION_TEMPLATE_VERSION,
  filterCreatorInvitationRecords,
  loadCreatorInvitationRecords,
  parseCreatorInvitationWorkbook,
  resolveCreatorInvitationStatus,
  saveCreatorInvitationRecords,
  validateCreatorInvitationFile,
  type CreatorInvitationRecord,
} from './creatorInvitations';
import type { CreatorProfile } from './types';

const creator = ({
  id = 'creator-existing',
  email = 'existing@example.com',
  profileUrl = 'https://www.instagram.com/existing',
}: {
  id?: string;
  email?: string;
  profileUrl?: string;
} = {}): CreatorProfile => ({
  id,
  initials: 'EX',
  accent: '#999999',
  name: 'Existing Creator dis',
  handle: '@existing',
  region: '美国',
  platform: 'Instagram',
  projects: 0,
  socialAccounts: [{ id: `${id}-social`, platform: 'Instagram', handle: '@existing', profileUrl }],
  contact: { legalName: 'Existing Creator real', address: 'New York', phone: '', email },
  payoutAccounts: [],
  payoutAccountHistory: [],
});

const storedInvitation = (overrides: Partial<CreatorInvitationRecord> = {}): CreatorInvitationRecord => ({
  id: 'cinv-existing',
  email: 'pending@example.com',
  invitationCode: 'CMT-PENDING1',
  socialAccounts: [{
    id: 'cinv-existing-social-1',
    platform: 'TikTok',
    handle: '@pending',
    profileUrl: 'https://www.tiktok.com/@pending',
  }],
  sentAt: '2026-09-01T00:00:00.000Z',
  expiresAt: '2026-09-20T00:00:00.000Z',
  deliveryStatus: 'SIMULATED_SENT',
  status: 'SENT',
  ...overrides,
});

const workbookWithRows = async (rows: Array<[string, string, string]>) => {
  const template = await createCreatorInvitationTemplate();
  const workbook = new Workbook();
  await workbook.xlsx.load(await template.arrayBuffer());
  const sheet = workbook.getWorksheet(CREATOR_INVITATION_SHEET_NAME);
  if (!sheet) throw new Error('测试模板缺少达人邀请名单');
  rows.forEach((values, index) => {
    values.forEach((value, columnIndex) => {
      sheet.getRow(index + 2).getCell(columnIndex + 1).value = value;
    });
  });
  const output = await workbook.xlsx.writeBuffer();
  return new Uint8Array(output as ArrayBuffer).slice().buffer;
};

describe('creator invitation workbook', () => {
  it('生成固定工作表、字段、平台下拉、填写说明与隐藏版本', async () => {
    const blob = await createCreatorInvitationTemplate();
    const workbook = new Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const sheet = workbook.getWorksheet(CREATOR_INVITATION_SHEET_NAME);
    const metadata = workbook.getWorksheet('_metadata');

    expect(sheet).toBeDefined();
    expect(CREATOR_INVITATION_HEADERS.map((_, index) => sheet?.getRow(1).getCell(index + 1).text))
      .toEqual([...CREATOR_INVITATION_HEADERS]);
    expect(sheet?.getCell('B2').dataValidation.type).toBe('list');
    expect(sheet?.getCell('B2').dataValidation.formulae?.[0]).toContain('Instagram,TikTok,YouTube,Facebook,X,Twitch');
    expect(workbook.getWorksheet('填写说明')?.getCell('A1').text).toContain('填写说明');
    expect(metadata?.state).toBe('veryHidden');
    expect(metadata?.getCell('B2').text).toBe(CREATOR_INVITATION_TEMPLATE_VERSION);
  });

  it('仅接受 5 MB 以内的 xlsx 文件并校验空模板', async () => {
    expect(validateCreatorInvitationFile({ name: 'invite.csv', size: 10 }).map((issue) => issue.code))
      .toContain('FILE_TYPE');
    expect(validateCreatorInvitationFile({ name: 'invite.xlsx', size: CREATOR_INVITATION_MAX_FILE_SIZE + 1 }).map((issue) => issue.code))
      .toContain('FILE_SIZE');
    expect(validateCreatorInvitationFile({ name: 'invite.xlsx', size: 10 })).toEqual([]);

    const parsed = await parseCreatorInvitationWorkbook(await workbookWithRows([]));
    expect(parsed.fatal).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain('EMPTY_LIST');
  });

  it('逐行校验邮箱、平台、HTTP(S) URL、重复行与 200 条上限', async () => {
    const rows: Array<[string, string, string]> = [
      ['luna@example.com', 'Instagram', 'https://instagram.com/luna'],
      ['LUNA@example.com ', 'Instagram', 'https://instagram.com/luna?from=duplicate'],
      ['bad-email', 'TikTok', 'https://tiktok.com/@bad'],
      ['youtube@example.com', 'Unsupported', 'https://youtube.com/@channel'],
      ['x@example.com', 'X', 'ftp://x.com/channel'],
      ...Array.from({ length: CREATOR_INVITATION_MAX_ACCOUNTS - 4 }, (_, index): [string, string, string] => [
        `valid-${index}@example.com`,
        'Twitch',
        `https://twitch.tv/valid-${index}`,
      ]),
    ];
    const parsed = await parseCreatorInvitationWorkbook(await workbookWithRows(rows));
    const codes = parsed.issues.map((issue) => issue.code);

    expect(parsed.sourceAccountCount).toBe(CREATOR_INVITATION_MAX_ACCOUNTS + 1);
    expect(codes).toContain('DUPLICATE_ROW');
    expect(codes).toContain('INVALID_EMAIL');
    expect(codes).toContain('INVALID_PLATFORM');
    expect(codes).toContain('INVALID_URL');
    expect(codes).toContain('LIMIT_EXCEEDED');
  });
});

describe('creator invitation recognition and sending', () => {
  it('按邮箱合并多平台，跳过现有达人、频道、文件冲突和有效邀请', async () => {
    const workbook = await parseCreatorInvitationWorkbook(await workbookWithRows([
      ['new@example.com', 'Instagram', 'https://instagram.com/new.creator'],
      ['new@example.com', 'TikTok', 'https://tiktok.com/@new.creator'],
      ['new@example.com', 'X', 'https://x.com/shared.creator'],
      ['other@example.com', 'X', 'https://x.com/shared.creator'],
      ['existing@example.com', 'YouTube', 'https://youtube.com/@existing-new'],
      ['channel@example.com', 'Instagram', 'https://instagram.com/existing'],
      ['pending@example.com', 'Twitch', 'https://twitch.tv/pending-new'],
      ['broken@example.com', 'TikTok', 'not-a-url'],
    ]));
    const preview = buildCreatorInvitationPreview({
      workbook,
      creators: [creator()],
      records: [storedInvitation()],
      now: new Date('2026-09-10T00:00:00.000Z'),
    });

    expect(preview.readyInvitationCount).toBe(1);
    expect(preview.readyAccountCount).toBe(3);
    expect(preview.groups[0].email).toBe('new@example.com');
    expect(preview.groups[0].socialAccounts.map((account) => account.platform))
      .toEqual(['Instagram', 'TikTok', 'X']);
    expect(preview.groups[0].socialAccounts.map((account) => account.handle))
      .toEqual(['@new.creator', '@new.creator', '@shared.creator']);
    expect(preview.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'INVALID_URL',
      'FILE_CHANNEL_CONFLICT',
      'EXISTING_CREATOR_EMAIL',
      'EXISTING_CHANNEL_URL',
      'ACTIVE_INVITATION',
    ]));
    expect(preview.skippedAccountCount).toBe(4);
    expect(preview.errorCount).toBe(1);
  });

  it('生成稳定记录、唯一邀请码、模拟发送结果和 7 天有效期', () => {
    const groups = [{
      email: 'new@example.com',
      sourceRows: [2, 3],
      socialAccounts: [
        { id: 'preview-1', platform: 'Instagram' as const, handle: '@new', profileUrl: 'https://instagram.com/new', sourceRow: 2 },
        { id: 'preview-2', platform: 'TikTok' as const, handle: '@new', profileUrl: 'https://tiktok.com/@new', sourceRow: 3 },
      ],
    }];
    const created = createCreatorInvitationRecords(groups, [], {
      now: new Date('2026-09-10T10:00:00.000Z'),
      idFactory: () => 'cinv-local-test',
      codeFactory: () => 'CMT-TESTCODE',
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      id: 'cinv-local-test',
      email: 'new@example.com',
      invitationCode: 'CMT-TESTCODE',
      deliveryStatus: 'SIMULATED_SENT',
      status: 'SENT',
      expiresAt: '2026-09-17T10:00:00.000Z',
    });
    expect(created[0].socialAccounts.map((account) => account.id))
      .toEqual(['cinv-local-test-social-1', 'cinv-local-test-social-2']);
  });
});

describe('creator invitation records', () => {
  it('刷新时从带版本存储恢复，并按过期状态搜索筛选', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const sent = storedInvitation();
    const expired = storedInvitation({
      id: 'cinv-expired',
      email: 'expired@example.com',
      invitationCode: 'CMT-EXPIRED1',
      sentAt: '2026-08-01T00:00:00.000Z',
      expiresAt: '2026-08-08T00:00:00.000Z',
    });
    saveCreatorInvitationRecords([sent, expired], storage);

    expect(values.get(CREATOR_INVITATION_STORAGE_KEY)).toContain('"version":1');
    expect(loadCreatorInvitationRecords(storage)).toHaveLength(2);
    expect(resolveCreatorInvitationStatus(expired, new Date('2026-09-10T00:00:00.000Z'))).toBe('EXPIRED');
    expect(filterCreatorInvitationRecords([sent, expired], {
      search: 'expired',
      status: 'EXPIRED',
      now: new Date('2026-09-10T00:00:00.000Z'),
    }).map((record) => record.id)).toEqual(['cinv-expired']);
    expect(filterCreatorInvitationRecords([sent, expired], {
      search: 'TikTok CMT-PENDING1',
      status: 'SENT',
      now: new Date('2026-09-10T00:00:00.000Z'),
    }).map((record) => record.id)).toEqual(['cinv-existing']);
  });

  it('保留状态枚举并将验证码请求阶段展示为已请求邀请码', () => {
    expect(resolveCreatorInvitationStatus(storedInvitation({
      status: 'VERIFICATION_REQUESTED',
    }), new Date('2026-09-10T00:00:00.000Z'))).toBe('VERIFICATION_REQUESTED');
    expect(filterCreatorInvitationRecords([storedInvitation({
      status: 'VERIFICATION_REQUESTED',
    })], {
      search: '已请求邀请码',
      status: 'VERIFICATION_REQUESTED',
      now: new Date('2026-09-10T00:00:00.000Z'),
    })).toHaveLength(1);
  });
});
