import { describe, expect, it } from 'vitest';
import { PAYMENT_CURRENCY_OPTIONS } from './paymentCurrencies';

describe('payment currency options', () => {
  it('provides the supported ISO currency codes used by payment details', () => {
    const values = PAYMENT_CURRENCY_OPTIONS.map((option) => option.value);
    expect(values).toEqual(expect.arrayContaining(['USD', 'HKD', 'JPY', 'EUR', 'GBP', 'SGD']));
    expect(values).not.toContain('JPD');
  });
});
