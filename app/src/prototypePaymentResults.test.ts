import { describe, expect, it } from 'vitest';
import {
  prototypeConvertCurrency,
  prototypePaymentResultFor,
  prototypeRecipientReceivedAmountFor,
} from './prototypePaymentResults';
import type { InvoiceCurrency } from './types';

describe('prototype payment currency results', () => {
  it('converts successful recipient amounts into every supported receive currency', () => {
    const expected: Record<InvoiceCurrency, number> = {
      USD: 100,
      EUR: 91.74,
      GBP: 78.74,
      HKD: 781.25,
      SGD: 135.14,
    };

    (Object.keys(expected) as InvoiceCurrency[]).forEach((receiveCurrency) => {
      expect(prototypeRecipientReceivedAmountFor({
        amount: 100,
        currency: 'USD',
        receiveCurrency,
        feeBearer: 'ADVERTISER',
      })).toBe(expected[receiveCurrency]);
    });
  });

  it('deducts the recipient fee share before converting into the receive currency', () => {
    expect(prototypeRecipientReceivedAmountFor({
      amount: 100,
      currency: 'USD',
      receiveCurrency: 'SGD',
      feeBearer: 'PUBLISHER',
      transferFeeAmount: 10,
      transferFeeCurrency: 'USD',
    })).toBe(121.62);
    expect(prototypeRecipientReceivedAmountFor({
      amount: 100,
      currency: 'USD',
      receiveCurrency: 'SGD',
      feeBearer: 'SHARED',
      transferFeeAmount: 10,
      transferFeeCurrency: 'USD',
    })).toBe(128.38);
  });

  it('writes the receive currency into the simulated channel result', () => {
    const result = prototypePaymentResultFor({
      provider: 'Airwallex',
      currency: 'USD',
      amount: 100,
      feeBearer: 'ADVERTISER',
      receiveCurrency: 'SGD',
    });

    expect(result.recipientReceivedCurrency).toBe('SGD');
    expect(result.recipientReceivedAmount).toBe(prototypeConvertCurrency(100, 'USD', 'SGD'));
    expect(result.actualPaidCurrency).toBe('USD');
  });
});
