import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  normalizePaymentProviderBadgeName,
  PaymentProviderBadge,
  PaymentProviderBadges,
} from './PaymentProviderBadge';

describe('PaymentProviderBadge', () => {
  it('normalizes all supported provider spellings', () => {
    expect(normalizePaymentProviderBadgeName('Airwallex')).toBe('Airwallex');
    expect(normalizePaymentProviderBadgeName('PayPal')).toBe('PayPal');
    expect(normalizePaymentProviderBadgeName('Payermax')).toBe('PayMax');
    expect(normalizePaymentProviderBadgeName('payer max')).toBe('PayMax');
  });

  it('renders a provider-specific tone and visible label', () => {
    const html = renderToStaticMarkup(<PaymentProviderBadge provider="PayPal" />);
    expect(html).toContain('is-paypal');
    expect(html).toContain('data-payment-provider="PayPal"');
    expect(html).toContain('PayPal');
  });

  it('renders multiple providers as separate highlighted labels', () => {
    const html = renderToStaticMarkup(<PaymentProviderBadges compact providers="Airwallex、Payermax、PayPal" />);
    expect(html).toContain('is-airwallex');
    expect(html).toContain('is-paymax');
    expect(html).toContain('is-paypal');
  });
});
