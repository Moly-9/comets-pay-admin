import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PaymentCreatorIdentity } from './PaymentCreatorIdentity';

describe('PaymentCreatorIdentity', () => {
  it('renders one avatar with Account Name above Display Name', () => {
    const html = renderToStaticMarkup(
      <PaymentCreatorIdentity
        accountName="Mina Kato Studio"
        displayName="Mina Kato"
        initials="MK"
        accent="#5f72d8"
      />,
    );

    expect(html.match(/class="avatar avatar-sm"/g)).toHaveLength(1);
    expect(html.indexOf('Mina Kato Studio')).toBeLessThan(html.indexOf('Mina Kato</small>'));
    expect(html).toContain('title="Mina Kato Studio"');
    expect(html).toContain('title="Mina Kato"');
    expect(html).toContain('aria-label="Account Name：Mina Kato Studio，Display Name：Mina Kato"');
  });

  it('passes size and custom class to the compact identity block', () => {
    const html = renderToStaticMarkup(
      <PaymentCreatorIdentity
        className="transaction-payee"
        accountName="Account Name 待补充"
        displayName="Display Name 待补充"
        initials="?"
        size="lg"
      />,
    );

    expect(html).toContain('payment-creator-identity is-lg transaction-payee');
    expect(html).toContain('avatar avatar-lg');
  });
});
