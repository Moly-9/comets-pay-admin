import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  normalizePaymentProviderBadgeName,
  paymentProviderDisplayName,
  PaymentProviderBadge,
  PaymentProviderBadges,
} from './PaymentProviderBadge';

describe('PaymentProviderBadge', () => {
  it('normalizes all supported provider spellings', () => {
    expect(normalizePaymentProviderBadgeName('Airwallex')).toBe('Airwallex');
    expect(normalizePaymentProviderBadgeName('PayPal')).toBe('PayPal');
    expect(normalizePaymentProviderBadgeName('Payermax')).toBe('PayMax');
    expect(normalizePaymentProviderBadgeName('payer max')).toBe('PayMax');
    expect(paymentProviderDisplayName('PayMax')).toBe('Payer Max');
    expect(paymentProviderDisplayName('PayerMax')).toBe('Payer Max');
  });

  it('renders a provider-specific tone and visible label', () => {
    const html = renderToStaticMarkup(<PaymentProviderBadge provider="PayPal" />);
    expect(html).toContain('is-paypal');
    expect(html).toContain('data-payment-provider="PayPal"');
    expect(html).toContain('PayPal');
    expect(html).not.toContain('payment-provider-mark');
  });

  it('renders the standardized Payer Max brand label', () => {
    const html = renderToStaticMarkup(<PaymentProviderBadge provider="PayMax" />);
    expect(html).toContain('data-payment-provider="PayMax"');
    expect(html).toContain('Payer Max');
    expect(html).not.toContain('>PayMax<');
    expect(html).not.toContain('>PayerMax<');
  });

  it('renders multiple providers as separate highlighted labels', () => {
    const html = renderToStaticMarkup(<PaymentProviderBadges compact providers="Airwallex、Payermax、PayPal" />);
    expect(html).toContain('is-airwallex');
    expect(html).toContain('is-paymax');
    expect(html).toContain('is-paypal');
  });

  it('keeps compact sizing and provides a neutral fallback for unknown channels', () => {
    const compact = renderToStaticMarkup(<PaymentProviderBadge compact provider="Airwallex" />);
    const unknown = renderToStaticMarkup(<PaymentProviderBadge provider="Pending provider" />);

    expect(compact).toContain('is-airwallex is-compact');
    expect(unknown).toContain('is-unknown');
    expect(unknown).toContain('Pending provider');
  });

  it('uses light brand surfaces with darker brand text', () => {
    const css = readFileSync(new URL('./PaymentProviderBadge.css', import.meta.url), 'utf8');

    expect(css).toContain('--payment-provider-surface: #f0efff');
    expect(css).toContain('--payment-provider-surface: #fff0f1');
    expect(css).toContain('--payment-provider-surface: #edf4ff');
    expect(css).toContain('color: var(--payment-provider-ink, #4b5563)');
  });
});
