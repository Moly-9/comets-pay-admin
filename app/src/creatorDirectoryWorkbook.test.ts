import { Workbook } from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  createAirwallexPayoutAccount,
  createPayPalPayoutAccount,
} from './payoutAccounts';
import type { CreatorProfile } from './types';
import {
  createCreatorDirectoryWorkbook,
  creatorDirectoryLegalEntityName,
  creatorDirectoryWorkbookFilename,
  creatorPayoutAccountVersionResult,
  distinctCreatorSocialPlatformCount,
  explicitDefaultPayoutAccount,
  filterCreatorDirectory,
  formatCreatorPayoutAccountUpdatedAt,
  latestCreatorPayoutAccountUpdatedAt,
  maskedCreatorPayoutAccountIdentifier,
  toggleCreatorDirectorySelection,
} from './creatorDirectoryWorkbook';

const creator = (
  id: string,
  provider: 'Airwallex' | 'PayPal' = 'Airwallex',
): CreatorProfile => {
  const payoutAccount = provider === 'PayPal'
    ? createPayPalPayoutAccount({
        id: `paypal-${id}`,
        creatorId: id,
        nickname: 'PayPal 主账户',
        isDefault: true,
        status: 'VALIDATED',
        payoutAccountVersion: 'v2',
        updatedAt: '2026-08-30T02:10:00.000Z',
        paypalUsername: `Account ${id}`,
        paypalEmail: `${id}@example.com`,
      })
    : createAirwallexPayoutAccount({
        id: `airwallex-${id}`,
        creatorId: id,
        nickname: '美国 USD 主账户',
        isDefault: true,
        status: 'VERIFIED',
        payoutAccountVersion: 'v1',
        updatedAt: '2026-08-29T02:10:00.000Z',
        beneficiaryId: `bene-secret-${id}`,
        bankDetails: {
          accountName: `Account ${id}`,
          accountNumber: `98765432${id.slice(-2)}`,
          bankName: 'Secret Bank',
          swiftCode: 'SECRET12',
        },
      });
  return {
    id,
    initials: id.slice(-2).toUpperCase(),
    accent: '#8b5cf6',
    name: `Display ${id}`,
    handle: `@${id}`,
    region: id === 'creator-alpha' ? '日本' : '美国',
    platform: 'Instagram · TikTok',
    projects: 0,
    socialAccounts: [
      { id: `social-${id}-1`, platform: 'Instagram', handle: `@${id}.ig`, profileUrl: `https://instagram.com/${id}` },
      { id: `social-${id}-2`, platform: 'instagram', handle: `@${id}.ig2`, profileUrl: `https://instagram.com/${id}2` },
      { id: `social-${id}-3`, platform: 'TikTok', handle: `@${id}.tt`, profileUrl: `https://tiktok.com/@${id}` },
    ],
    contact: {
      legalName: `Real ${id}`,
      address: `Address ${id}`,
      phone: '+1 555 0100',
      email: `${id}.invoice@example.com`,
    },
    payoutAccounts: [payoutAccount],
    payoutAccountHistory: [{
      ...payoutAccount,
      id: `${payoutAccount.id}-history`,
      payoutAccountId: payoutAccount.payoutAccountId,
      payoutAccountVersion: 'legacy-v1',
      updatedAt: '2026-08-31T03:20:00.000Z',
      isDefault: false,
    }],
  };
};

describe('creator directory helpers', () => {
  it('按显式默认账户渠道筛选，并对社媒平台去重', () => {
    const airwallex = creator('creator-alpha');
    const paypal = creator('creator-beta', 'PayPal');
    const noDefault = {
      ...creator('creator-gamma'),
      payoutAccounts: creator('creator-gamma').payoutAccounts.map((account) => ({ ...account, isDefault: false })),
    };

    expect(explicitDefaultPayoutAccount(noDefault)).toBeNull();
    expect(distinctCreatorSocialPlatformCount(airwallex)).toBe(2);
    expect(filterCreatorDirectory([airwallex, paypal, noDefault], { search: '', provider: 'PayPal' }))
      .toEqual([paypal]);
    expect(filterCreatorDirectory([airwallex, paypal, noDefault], { search: '日本 creator-alpha.tt', provider: 'all' }))
      .toEqual([airwallex]);
  });

  it('使用版本区分验证与更新，并取当前和历史账户的最新时间', () => {
    const airwallex = creator('creator-alpha');
    const paypal = creator('creator-beta', 'PayPal');

    expect(creatorPayoutAccountVersionResult(airwallex.payoutAccounts[0])).toBe('账户已验证');
    expect(creatorPayoutAccountVersionResult(paypal.payoutAccounts[0])).toBe('账户已更新');
    expect(creatorPayoutAccountVersionResult(null)).toBeNull();
    expect(latestCreatorPayoutAccountUpdatedAt(airwallex)).toBe('2026-08-31T03:20:00.000Z');
    expect(formatCreatorPayoutAccountUpdatedAt('2026-08-31T03:20:00.000Z')).toBe('2026-08-31 11:20');
    expect(formatCreatorPayoutAccountUpdatedAt('')).toBe('未记录');
  });

  it('按默认账户主体类型展示 Real Name 或 Company Name', () => {
    const personal = creator('creator-personal');
    const companyBase = creator('creator-company');
    const company = {
      ...companyBase,
      payoutAccounts: companyBase.payoutAccounts.map((account) => account.provider === 'Airwallex'
        ? { ...account, entityType: 'COMPANY' as const, companyName: 'Creator Company LLC' }
        : account),
    };
    const companyMissingName = {
      ...company,
      payoutAccounts: company.payoutAccounts.map((account) => account.provider === 'Airwallex'
        ? { ...account, companyName: '' }
        : account),
    };
    const paypal = creator('creator-paypal', 'PayPal');

    expect(creatorDirectoryLegalEntityName(personal)).toBe('Real creator-personal');
    expect(creatorDirectoryLegalEntityName(company)).toBe('Creator Company LLC');
    expect(creatorDirectoryLegalEntityName(companyMissingName)).toBe('待补充');
    expect(creatorDirectoryLegalEntityName(paypal)).toBe('Real creator-paypal');
  });

  it('全选覆盖当前筛选结果，保留其他筛选中的已选达人', () => {
    const selected = new Set(['creator-outside']);
    const next = toggleCreatorDirectorySelection(selected, ['creator-alpha', 'creator-beta'], true);
    expect([...next]).toEqual(['creator-outside', 'creator-alpha', 'creator-beta']);
    expect([...toggleCreatorDirectorySelection(next, ['creator-alpha', 'creator-beta'], false)])
      .toEqual(['creator-outside']);
  });
});

describe('createCreatorDirectoryWorkbook', () => {
  it('导出三张表并保留传入的达人顺序', async () => {
    const alpha = creator('creator-alpha');
    const beta = creator('creator-beta', 'PayPal');
    const blob = await createCreatorDirectoryWorkbook([beta, alpha]);
    const workbook = new Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      '达人档案与 Invoice 联系资料',
      '全部社媒账号',
      '收款账户摘要',
    ]);
    expect(workbook.worksheets[0].getRow(1).getCell(2).text).toBe('真实姓名 / 公司名称');
    expect(workbook.worksheets[0].getRow(2).getCell(1).text).toBe(beta.name);
    expect(workbook.worksheets[0].getRow(3).getCell(1).text).toBe(alpha.name);
    expect(workbook.worksheets[1].rowCount).toBe(7);
    expect(workbook.worksheets[2].rowCount).toBe(5);
  });

  it('真正脱敏账户标识，不导出原始银行、PayPal 或技术 API 字段', async () => {
    const airwallex = creator('creator-alpha');
    const paypal = creator('creator-beta', 'PayPal');
    const rawBankAccount = airwallex.payoutAccounts[0].provider === 'Airwallex'
      ? airwallex.payoutAccounts[0].bankDetails.accountNumber
      : '';
    const rawPayPalEmail = paypal.payoutAccounts[0].provider === 'PayPal'
      ? paypal.payoutAccounts[0].paypalEmail
      : '';
    const blob = await createCreatorDirectoryWorkbook([airwallex, paypal]);
    const workbook = new Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const allCellText = workbook.worksheets.flatMap((sheet) => (
      [...Array(sheet.rowCount)].flatMap((_, rowIndex) => (
        [...Array(sheet.columnCount)].map((__, columnIndex) => sheet.getRow(rowIndex + 1).getCell(columnIndex + 1).text)
      ))
    )).join('\n');

    expect(maskedCreatorPayoutAccountIdentifier(airwallex.payoutAccounts[0])).toContain('••••');
    expect(maskedCreatorPayoutAccountIdentifier(paypal.payoutAccounts[0])).toContain('•••');
    expect(allCellText).not.toContain(rawBankAccount);
    expect(allCellText).not.toContain(rawPayPalEmail);
    expect(allCellText).not.toContain('bene-secret-creator-alpha');
    expect(allCellText).not.toContain('Secret Bank');
    expect(allCellText).not.toContain('SECRET12');
    expect(allCellText).not.toContain('schemaValues');
    expect(allCellText).not.toContain('accountFingerprint');
  });

  it('按上海日期生成文件名', () => {
    expect(creatorDirectoryWorkbookFilename(new Date('2026-08-31T16:30:00.000Z')))
      .toBe('COMETS_Pay_达人档案_20260901.xlsx');
  });
});
