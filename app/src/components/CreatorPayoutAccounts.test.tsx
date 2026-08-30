import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyAirwallexAccount } from '../payoutAccounts';
import { CreatorPayoutAccounts } from './CreatorPayoutAccounts';

describe('CreatorPayoutAccounts profile editor', () => {
  it('disables unopened channels and presents US payment labels and examples', () => {
    const account = createEmptyAirwallexAccount('Taylor Morgan', 'taylor@example.com', 'creator-test');
    const html = renderToStaticMarkup(
      <CreatorPayoutAccounts
        accounts={[account]}
        editing
        creatorId="creator-test"
        creatorName="Taylor Morgan"
        creatorEmail="taylor@example.com"
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain('>PayPal</strong><small>暂未开放 · 暂不支持创建</small>');
    expect(html).toContain('>Payer Max</strong><small>暂未开放 · 暂不支持创建</small>');
    expect(html).toContain('title="PayPal 暂未开放"');
    expect(html).toContain('title="Payer Max 暂未开放"');
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html.match(/aria-disabled="true"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('Beneficiary Type');
    expect(html).toContain("Beneficiary&#x27;s Bank Country/Region");
    expect(html).toContain('>Currency</small>');
    expect(html).toContain('>Payment Method</small>');
    expect(html).toContain('>local_clearing_system</small>');
    expect(html).toContain('需要填写的付款信息字段由 Airwallex Form Schema 决定');
    expect(html).toContain("Beneficiary&#x27;s Bank SWIFT Code");
    expect(html).toContain('Primary Routing Code Type');
    expect(html).toContain('Primary Branch Code');
    expect(html).toContain('ID Document Type');
    expect(html).toContain('Beneficiary ID Number');
    expect(html).toContain('Business Registration Number');
    expect(html).toContain('Intermediary Bank Country (if any)');
    expect(html).toContain('Intermediary Bank Code (if any)');
    expect(html).toContain('Transfer Remarks (if any)');
    expect(html).toContain('Account Name');
    expect(html).toContain('Account Number');
    expect(html).toContain('Account Type');
    expect(html).toContain('Beneficiary&#x27;s Bank Name');
    expect(html).toContain('Beneficiary&#x27;s Bank Address');
    expect(html).toContain('Beneficiary&#x27;s Bank Country');
    expect(html).toContain('Beneficiary&#x27;s Bank State');
    expect(html).toContain('Beneficiary&#x27;s Bank City');
    expect(html).toContain('Beneficiary&#x27;s Bank Postal Code');
    expect(html).toContain('示例：JPMorgan Chase Bank');
    expect(html).toContain('法定名');
    expect(html).toContain('Primary Routing Code');
    expect(html).not.toContain('出生日期');
    expect(html).not.toContain('收款通知邮箱');
    expect(html).not.toContain('Signature');
    expect(html).not.toContain('校验通过，已回写');
    expect(html).toContain('>校验账户</span>');
  });

  it('在只读详情中使用独立字段卡和中英文展示标题，不外显技术字段名', () => {
    const draft = createEmptyAirwallexAccount('Taylor Morgan', 'taylor@example.com', 'creator-test');
    const account = {
      ...draft,
      beneficiaryId: 'bene_test_001',
      status: 'VERIFIED' as const,
      verificationCode: 'VERIFIED' as const,
      nameMatchResult: 'FULL_MATCH' as const,
      validatedAt: '2026-08-30 10:00',
      verifiedAt: '2026-08-30 10:01',
      bankDetails: {
        ...draft.bankDetails,
        accountName: 'Taylor Morgan acc',
        accountNumber: '50001121',
        bankName: 'JPMorgan Chase Bank',
      },
    };
    const html = renderToStaticMarkup(
      <CreatorPayoutAccounts
        accounts={[account]}
        creatorId="creator-test"
        creatorName="Taylor Morgan"
        creatorEmail="taylor@example.com"
      />,
    );

    expect(html.match(/creator-payment-value(?:\s|\")/g)?.length).toBeGreaterThan(12);
    expect(html).toContain('账户名称<small>Account Name</small>');
    expect(html).toContain('收款银行名称<small>Beneficiary&#x27;s Bank Name</small>');
    expect(html).toContain('账户验证结果<small>Account Verification Result</small>');
    expect(html).not.toContain('account_name');
    expect(html).not.toContain('verificationCode');
    expect(html).not.toContain('nameMatchResult');
    expect(html).not.toContain('beneficiary_id');
  });
});
