import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyAirwallexAccount } from '../payoutAccounts';
import type { CreatorProfile } from '../types';
import { CreatorsPage, hasCreatorDraftContent, INITIAL_CREATORS } from './OperationalPages';

vi.mock('react-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-dom')>(),
  createPortal: (children: ReactNode) => children,
}));

afterEach(() => vi.unstubAllGlobals());

describe('CreatorsPage', () => {
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

  it('区分系统默认值与用户已填写的新建达人内容', () => {
    const empty = emptyCreatorDraft();
    expect(hasCreatorDraftContent(empty)).toBe(false);
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

  it('保留最初达人档案布局并继续展示当前收款账户', () => {
    vi.stubGlobal('document', { body: {} });
    const creator = INITIAL_CREATORS[0];
    const html = renderToStaticMarkup(
      <CreatorsPage
        notify={vi.fn()}
        creators={[creator]}
        onSaveCreator={vi.fn()}
        canEdit
        currentUserAccount="test.account"
        initialCreatorId={creator.id}
      />,
    );

    expect(html).toContain('class="profile-summary"');
    expect(html).not.toContain('creator-profile-summary');
    expect(html).toContain('class="profile-details"');
    expect(html).toContain('合作项目');
    expect(html).toContain('真实姓名');
    expect(html).toContain('查看主页');
    expect(html).not.toContain('认证状态待同步');
    expect(html).toContain(`creator-payment-information-${creator.id}`);
    expect(html).toContain('收款账户');
  });
});
