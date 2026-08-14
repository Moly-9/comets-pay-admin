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
    expect(html).toContain('>PayerMax</strong><small>暂未开放 · 暂不支持创建</small>');
    expect(html).toContain('title="PayPal 暂未开放"');
    expect(html).toContain('title="PayerMax 暂未开放"');
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(4);
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
    expect(html).toContain('示例：JPMorgan Chase Bank');
    expect(html).toContain('法定名');
    expect(html).toContain('ACH routing number');
    expect(html).not.toContain('出生日期');
    expect(html).not.toContain('收款通知邮箱');
    expect(html).not.toContain('Signature');
    expect(html).toContain('>校验账户</span>');
  });
});
