import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyAirwallexAccount, createPayPalPayoutAccount } from '../payoutAccounts';
import type { CreatorCollaborationProjectRecord } from '../creatorCollaborationProjects';
import type { CreatorProfile } from '../types';
import {
  CreatorCollaborationProjectDetails,
  CreatorSocialAccountDetails,
  CreatorSocialPlatformIcons,
  CreatorsPage,
  getCreatorPayoutAccountValidationError,
  hasCreatorDraftContent,
  INITIAL_CREATORS,
} from './OperationalPages';

const emptyCreatorDraft = (): CreatorProfile => {
  const id = 'creator-draft-test';
  return {
    id,
    initials: 'NA',
    accent: '#fb7185',
    name: '',
    handle: '',
    region: '',
    platform: '',
    projects: 0,
    socialAccounts: [{ id: 'social-draft-test', platform: '', handle: '', profileUrl: '' }],
    contact: { legalName: '', address: '', phone: '', email: '' },
    payoutAccounts: [createEmptyAirwallexAccount('', '', id)],
    payoutAccountHistory: [],
  };
};

describe('CreatorsPage draft exit guard', () => {
  it('将默认新建表单识别为无内容', () => {
    expect(hasCreatorDraftContent(emptyCreatorDraft())).toBe(false);
  });

  it('识别基本资料、联系资料和收款资料的变更', () => {
    const empty = emptyCreatorDraft();
    expect(hasCreatorDraftContent({ ...empty, name: 'Mina' })).toBe(true);
    expect(hasCreatorDraftContent({
      ...empty,
      contact: { ...empty.contact, email: 'mina@example.com' },
    })).toBe(true);

    const airwallex = empty.payoutAccounts[0];
    expect(airwallex.provider).toBe('Airwallex');
    if (airwallex.provider !== 'Airwallex') throw new Error('测试账户应为 Airwallex');
    expect(hasCreatorDraftContent({
      ...empty,
      payoutAccounts: [{
        ...airwallex,
        bankDetails: { ...airwallex.bankDetails, bankCountryCode: 'JP' },
      }],
    })).toBe(true);
  });
});

describe('CreatorsPage payout account gate', () => {
  it('requires exactly one verified Airwallex default account', () => {
    const airwallex = createEmptyAirwallexAccount('Taylor Morgan', 'taylor@example.com', 'creator-test');
    const verified = { ...airwallex, status: 'VALIDATED' as const, beneficiaryId: 'bene_test' };

    expect(getCreatorPayoutAccountValidationError([airwallex]))
      .toBe('默认 Airwallex 收款账户校验完成');
    expect(getCreatorPayoutAccountValidationError([verified])).toBe('');
    expect(getCreatorPayoutAccountValidationError([
      verified,
      { ...verified, id: 'airwallex-2', payoutAccountId: 'airwallex-2', isDefault: true },
    ])).toBe('仅一个默认收款账户');
    expect(getCreatorPayoutAccountValidationError([
      { ...verified, isDefault: false },
    ])).toBe('仅一个默认收款账户');
    expect(getCreatorPayoutAccountValidationError([
      createPayPalPayoutAccount({
        id: 'paypal-test',
        isDefault: true,
        status: 'VALIDATED',
        paypalUsername: 'Taylor Morgan',
        paypalEmail: 'taylor@example.com',
      }),
    ])).toBe('一个默认 Airwallex 收款账户');
  });
});

describe('CreatorsPage profile cards', () => {
  it('社媒图标组件使用官方 SVG，合作项目卡仅展示项目资料和 Invoice 份数', () => {
    const creator = INITIAL_CREATORS.find((item) => item.id === 'creator-luna');
    if (!creator) throw new Error('演示数据缺少 Luna');
    const collaborationProjects: CreatorCollaborationProjectRecord[] = [{
      creatorId: creator.id as CreatorCollaborationProjectRecord['creatorId'],
      projectId: 'project-luna-current',
      projectCode: 'PRJ-LUNA-001',
      projectName: 'Luna 联名项目',
      brand: 'COMETS',
      projectStatus: '执行中',
      relationStatus: 'CURRENT',
      contractStatus: 'ACTIVE',
      directoryResolved: true,
      socialAccounts: [{
        socialAccountId: creator.socialAccounts[1].id,
        handle: creator.socialAccounts[1].handle,
        platform: creator.socialAccounts[1].platform,
      }],
      contractCount: 2,
      invoiceCount: 1,
      requestCount: 1,
      paymentCount: 0,
    }];
    const summary = renderToStaticMarkup(
      <CreatorSocialPlatformIcons
        accounts={creator.socialAccounts}
        size={19}
        className="creator-profile-summary-platforms"
      />,
    );
    const projects = renderToStaticMarkup(
      <CreatorCollaborationProjectDetails projects={collaborationProjects} />,
    );

    expect(summary).toContain('aria-label="Instagram · @Luna_J"');
    expect(summary).toContain('aria-label="TikTok · @luna.j.tiktok"');
    expect(summary).toContain('<svg');
    expect(summary).not.toContain('@Luna_J · Instagram');
    expect(summary).not.toContain('>IG<');
    expect(summary).not.toContain('>TT<');
    expect(projects).toContain('creator-collaboration-project-card');
    expect(projects).toContain('Luna 联名项目');
    expect(projects).toContain('<dt>Invoice 份数</dt><dd>1 份</dd>');
    expect(projects).not.toContain('该项目关联社媒账号');
    expect(projects).not.toContain('项目关联资料数量');
    expect(projects).not.toContain('>2</strong> 合同');
    expect(projects).toContain('当前关联');
    expect(projects).toContain('合同有效');
    expect(projects).toContain('creator-collaboration-project-badges');
    const withoutContract = renderToStaticMarkup(
      <CreatorCollaborationProjectDetails projects={[{
        ...collaborationProjects[0],
        contractStatus: 'NONE',
        relationStatus: 'HISTORICAL',
      }]} />,
    );
    expect(withoutContract).toContain('历史关联');
    expect(withoutContract).toContain('未关联合同');
  });

  it('顶部摘要移除社媒图标，列表提供账号级展示、渠道筛选、多选和更新时间', () => {
    const creator = INITIAL_CREATORS.find((item) => item.id === 'creator-luna');
    if (!creator) throw new Error('演示数据缺少 Luna');
    const collaborationProjects: CreatorCollaborationProjectRecord[] = [{
      creatorId: creator.id as CreatorCollaborationProjectRecord['creatorId'],
      projectId: 'project-luna-current',
      projectCode: 'PRJ-LUNA-001',
      projectName: 'Luna 联名项目',
      brand: 'COMETS',
      projectStatus: '执行中',
      relationStatus: 'CURRENT',
      contractStatus: 'ACTIVE',
      directoryResolved: true,
      socialAccounts: [],
      contractCount: 2,
      invoiceCount: 1,
      requestCount: 1,
      paymentCount: 0,
    }];
    const html = renderToStaticMarkup(
      <CreatorsPage
        notify={vi.fn()}
        creators={[creator]}
        collaborationProjects={collaborationProjects}
        onSaveCreator={vi.fn()}
        canEdit
        currentUserAccount="admin@example.com"
        onFocusCleared={vi.fn()}
      />,
    );
    const source = readFileSync(new URL('./OperationalPages.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain('className="creator-profile-summary-platforms"');
    expect(html).toContain('aria-label="达人付款渠道筛选"');
    expect(html).toContain('全部付款渠道');
    expect(html).toContain('aria-label="全选当前筛选结果中的达人"');
    expect(html).toContain(`aria-label="选择达人 ${creator.name}"`);
    expect(html).toContain('导出所选（0）');
    expect(html).toContain('新建达人档案');
    expect(html).toContain('发送邀请链接');
    expect(html.indexOf('发送邀请链接')).toBeGreaterThan(html.indexOf('新建达人档案'));
    expect(html).toContain('邀请记录');
    expect(html.indexOf('邀请记录')).toBeGreaterThan(html.indexOf('导出所选（0）'));
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('<th>社媒平台数</th>');
    expect(html).toContain('<th>Real Name / Company Name</th>');
    expect(html).not.toContain('<th>地区</th>');
    expect(html).toContain(creator.contact.legalName);
    expect(html).toContain('搜索达人名称、账号或 Real Name / Company Name');
    expect(html).toContain('<th>账户更新时间</th>');
    expect(html).toContain('creator-directory-identity');
    expect(html).toContain('@Luna_J');
    expect(html).toContain('@luna.j.tiktok');
    expect(html).toContain('creator-directory-payout has-default-account');
    expect(html).toContain('账户已验证');
    expect(source).toContain('tone="identity"');
    expect(source).toContain('tone="payout"');
    expect(source).toContain('tone="collaboration"');
    expect(source).toContain('CreatorInvitationSendDialog');
    expect(source).toContain('CreatorInvitationRecordsDialog');
    expect(source).not.toContain('达人 C 端入驻');
    expect(source).toContain('Display Name · 默认使用首个 Handle（不含 @）');
    expect(source).toContain('nameIsAutoDerived');
    expect(source).toContain("const primaryHandle = normalizeSocialHandle(socialAccounts[0]?.handle ?? '')");
    expect(source).toContain('readOnly value={draft.region || \'待识别\'}');
    expect(source).toContain('请在联系地址末尾填写国家名');
    expect(source).not.toContain('<span>地区<em className="required-mark"');
  });

  it('社媒账号卡展示后台截图查看入口和历史缺失状态', () => {
    const mina = INITIAL_CREATORS.find((item) => item.id === 'creator-mina');
    const luna = INITIAL_CREATORS.find((item) => item.id === 'creator-luna');
    if (!mina || !luna) throw new Error('演示数据缺少 Mina 或 Luna');

    const instagram = mina.socialAccounts[0];
    const withScreenshots = renderToStaticMarkup(
      <CreatorSocialAccountDetails accounts={[{
        ...instagram,
        verificationScreenshots: [
          ...(instagram.verificationScreenshots ?? []),
          {
            id: 'screenshot-creator-mina-instagram-2',
            fileName: 'mina-instagram-audience-demo.svg',
            imageUrl: '/creator-verification-demo-mina-instagram.svg',
            uploadedAt: '2026-09-12T03:19:00.000Z',
          },
        ],
      }]} />,
    );
    const withoutScreenshots = renderToStaticMarkup(
      <CreatorSocialAccountDetails accounts={[luna.socialAccounts[0]]} />,
    );

    expect(withScreenshots).toContain('查看后台截图（2）');
    expect(withScreenshots).toContain(`aria-label="查看 Instagram @MinaKato 的 2 张后台截图"`);
    expect(withScreenshots).toContain('creator-social-screenshot-button');
    expect(withoutScreenshots).toContain('后台截图待补充');
    expect(withoutScreenshots).toContain('disabled=""');
  });
});
