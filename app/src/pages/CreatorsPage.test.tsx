import { describe, expect, it } from 'vitest';
import { createEmptyAirwallexAccount, createPayPalPayoutAccount } from '../payoutAccounts';
import type { CreatorProfile } from '../types';
import { getCreatorPayoutAccountValidationError, hasCreatorDraftContent } from './OperationalPages';

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
