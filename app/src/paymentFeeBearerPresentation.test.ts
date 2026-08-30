import { describe, expect, it } from 'vitest';
import { paymentFeeBearerDisplayName } from './paymentFeeBearerPresentation';

describe('paymentFeeBearerDisplayName', () => {
  it('uses payment-management language without changing unrelated values', () => {
    ['ADVERTISER', '广告主承担', '付款方承担'].forEach((value) => {
      expect(paymentFeeBearerDisplayName(value)).toBe('我方承担');
    });
    ['PUBLISHER', '收款人承担', '收款方承担'].forEach((value) => {
      expect(paymentFeeBearerDisplayName(value)).toBe('对方承担');
    });
    expect(paymentFeeBearerDisplayName('共同承担')).toBe('共同承担');
    expect(paymentFeeBearerDisplayName('')).toBe('未记录');
  });
});
