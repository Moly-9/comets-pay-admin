import { creatorSocialAccounts, creatorSearchTerms } from './creatorSearchOptions';
import {
  getPayoutAccountStatusMeta,
  getPayoutAccountVersion,
} from './payoutAccounts';
import { paymentProviderDisplayName } from './paymentProviderPresentation';
import type { CreatorPayoutAccount, CreatorProfile } from './types';

export type CreatorDirectoryProviderFilter = 'all' | 'Airwallex' | 'PayPal' | 'PayMax';

export const CREATOR_DIRECTORY_PROVIDER_OPTIONS: ReadonlyArray<{
  value: CreatorDirectoryProviderFilter;
  label: string;
}> = [
  { value: 'all', label: '全部付款渠道' },
  { value: 'Airwallex', label: 'Airwallex' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'PayMax', label: 'Payer Max' },
];

export const explicitDefaultPayoutAccount = (
  creator: Pick<CreatorProfile, 'payoutAccounts'>,
) => creator.payoutAccounts.find((account) => account.isDefault && account.status !== 'DISABLED') ?? null;

export const creatorDirectoryLegalEntityName = (
  creator: Pick<CreatorProfile, 'contact' | 'payoutAccounts'>,
) => {
  const defaultAccount = explicitDefaultPayoutAccount(creator);
  if (defaultAccount?.provider === 'Airwallex' && defaultAccount.entityType === 'COMPANY') {
    return defaultAccount.companyName.trim() || '待补充';
  }
  return creator.contact.legalName.trim() || '待补充';
};

const normalizePlatform = (platform: string) => {
  const normalized = platform.trim().toLowerCase().replace(/[\s_-]+/g, '');
  return normalized === 'twitter' ? 'x' : normalized;
};

export const distinctCreatorSocialPlatformCount = (
  creator: CreatorProfile,
) => new Set(
  creatorSocialAccounts(creator)
    .map((account) => normalizePlatform(account.platform))
    .filter(Boolean),
).size;

export const creatorPayoutAccountVersionResult = (
  account: CreatorPayoutAccount | null | undefined,
): '账户已验证' | '账户已更新' | null => {
  if (!account) return null;
  const version = getPayoutAccountVersion(account);
  if (version === 'legacy-v1') return '账户已验证';
  const versionNumber = Number(version.slice(1));
  return Number.isFinite(versionNumber) && versionNumber >= 2 ? '账户已更新' : '账户已验证';
};

const validTimestamp = (value?: string) => {
  if (!value?.trim()) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const latestCreatorPayoutAccountUpdatedAt = (
  creator: Pick<CreatorProfile, 'payoutAccounts' | 'payoutAccountHistory'>,
) => [...creator.payoutAccounts, ...(creator.payoutAccountHistory ?? [])]
  .reduce<{ value: string; timestamp: number } | null>((latest, account) => {
    const timestamp = validTimestamp(account.updatedAt);
    if (timestamp === null || (latest && latest.timestamp >= timestamp)) return latest;
    return { value: account.updatedAt ?? '', timestamp };
  }, null)?.value ?? '';

const SHANGHAI_DATE_TIME_FORMAT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const dateTimeParts = (value: Date) => Object.fromEntries(
  SHANGHAI_DATE_TIME_FORMAT.formatToParts(value)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]),
);

export const formatCreatorPayoutAccountUpdatedAt = (value?: string) => {
  const timestamp = validTimestamp(value);
  if (timestamp === null) return '未记录';
  const parts = dateTimeParts(new Date(timestamp));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
};

export const filterCreatorDirectory = (
  creators: readonly CreatorProfile[],
  {
    search,
    provider,
  }: {
    search: string;
    provider: CreatorDirectoryProviderFilter;
  },
) => {
  const query = search.trim().toLocaleLowerCase('zh-CN');
  return creators.filter((creator) => {
    const defaultAccount = explicitDefaultPayoutAccount(creator);
    const matchesProvider = provider === 'all' || defaultAccount?.provider === provider;
    if (!matchesProvider) return false;
    if (!query) return true;
    const searchableText = [
      creatorSearchTerms(creator),
      creator.region,
      creator.contact.address,
      creator.contact.phone,
      creator.contact.email,
    ].join(' ').toLocaleLowerCase('zh-CN');
    return query.split(/\s+/).every((term) => searchableText.includes(term));
  });
};

export const toggleCreatorDirectorySelection = (
  current: ReadonlySet<string>,
  creatorIds: readonly string[],
  checked?: boolean,
) => {
  const next = new Set(current);
  const shouldSelect = checked ?? !creatorIds.every((id) => next.has(id));
  creatorIds.forEach((id) => {
    if (shouldSelect) next.add(id);
    else next.delete(id);
  });
  return next;
};

const maskAccountValue = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, '');
  if (!normalized) return '未提供可导出标识';
  const tail = normalized.slice(-4);
  return `•••• ${tail}`;
};

const maskEmail = (value: string) => {
  const normalized = value.trim();
  const separator = normalized.lastIndexOf('@');
  if (separator <= 0 || separator === normalized.length - 1) return '邮箱已脱敏';
  const local = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);
  const visibleEnd = local.length > 1 ? local.slice(-1) : '';
  return `${local.slice(0, 1)}•••${visibleEnd}@${domain}`;
};

export const maskedCreatorPayoutAccountIdentifier = (account: CreatorPayoutAccount) => {
  if (account.provider === 'PayPal') return `邮箱 · ${maskEmail(account.paypalEmail)}`;
  if (account.provider === 'PayMax') return `账户 ID · ${maskAccountValue(account.payermaxAccountId)}`;
  const identifier = account.bankDetails.accountNumber || account.bankDetails.iban;
  return `银行账号 · ${maskAccountValue(identifier)}`;
};

const workbookDate = (now: Date) => {
  const parts = dateTimeParts(now);
  return `${parts.year}${parts.month}${parts.day}`;
};

export const creatorDirectoryWorkbookFilename = (now = new Date()) => (
  `COMETS_Pay_达人档案_${workbookDate(now)}.xlsx`
);

const payoutAccountsForExport = (creator: CreatorProfile) => [
  ...creator.payoutAccounts.map((account) => ({ account, scope: '当前账户' })),
  ...(creator.payoutAccountHistory ?? []).map((account) => ({ account, scope: '历史账户' })),
];

export const createCreatorDirectoryWorkbook = async (
  creators: readonly CreatorProfile[],
) => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'COMETS Pay';
  workbook.lastModifiedBy = 'COMETS Pay';

  const profileSheet = workbook.addWorksheet('达人档案与 Invoice 联系资料', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  profileSheet.addRow([
    '达人名称', '真实姓名 / 公司名称', '地区', 'Invoice 联系地址', 'Invoice 联系电话', 'Invoice 联系邮箱', '社媒账号数', '社媒平台数',
  ]);
  creators.forEach((creator) => profileSheet.addRow([
    creator.name,
    creator.contact.legalName,
    creator.region,
    creator.contact.address,
    creator.contact.phone,
    creator.contact.email,
    creatorSocialAccounts(creator).length,
    distinctCreatorSocialPlatformCount(creator),
  ]));

  const socialSheet = workbook.addWorksheet('全部社媒账号', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  socialSheet.addRow(['达人名称', '社媒平台', 'Handle', '主页链接']);
  creators.forEach((creator) => creatorSocialAccounts(creator).forEach((account) => {
    socialSheet.addRow([creator.name, account.platform, account.handle, account.profileUrl]);
  }));

  const payoutSheet = workbook.addWorksheet('收款账户摘要', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  payoutSheet.addRow([
    '达人名称', '账户范围', '付款渠道', '账户别名', '账户标识（已脱敏）', '默认账户', '业务状态', '账户版本', '更新时间',
  ]);
  creators.forEach((creator) => payoutAccountsForExport(creator).forEach(({ account, scope }) => {
    payoutSheet.addRow([
      creator.name,
      scope,
      paymentProviderDisplayName(account.provider),
      account.nickname,
      maskedCreatorPayoutAccountIdentifier(account),
      scope === '当前账户' && account.isDefault ? '是' : '否',
      getPayoutAccountStatusMeta(account.status, account.provider).label,
      getPayoutAccountVersion(account),
      formatCreatorPayoutAccountUpdatedAt(account.updatedAt),
    ]);
  }));

  const sheets = [profileSheet, socialSheet, payoutSheet];
  const widths = [
    [24, 24, 14, 42, 22, 32, 14, 14],
    [24, 18, 28, 48],
    [24, 14, 18, 28, 32, 14, 20, 14, 22],
  ];
  sheets.forEach((sheet, sheetIndex) => {
    sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(sheet.columnCount).letter}${Math.max(1, sheet.rowCount)}` };
    widths[sheetIndex].forEach((width, columnIndex) => {
      sheet.getColumn(columnIndex + 1).width = width;
    });
    sheet.getRow(1).height = 24;
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { name: '宋体', size: 11, bold: true, color: { argb: 'FF394150' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F7' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD8DDE7' } } };
    });
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.height = 22;
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: '宋体', size: 11, color: { argb: 'FF414752' } };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E8EE' } } };
      });
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob(
    [new Uint8Array(buffer as ArrayBuffer)],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
};
