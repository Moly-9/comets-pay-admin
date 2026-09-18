import { describe, expect, it } from 'vitest';
import { paymentPreviewActualPaidTotals, paymentPreviewFor } from './paymentPreview';

const payout = {
  id: 'payout-preview',
  provider: 'Airwallex' as const,
  currency: 'USD' as const,
  amount: 1_000,
};

describe('payment preview', () => {
  it('uses the existing channel result rules for all three fee bearers', () => {
    const counterparty = paymentPreviewFor({ payout, feeBearer: 'PUBLISHER' });
    const payer = paymentPreviewFor({ payout, feeBearer: 'ADVERTISER' });
    const shared = paymentPreviewFor({ payout, feeBearer: 'SHARED' });

    expect(counterparty).toMatchObject({
      channelFeeAmount: 2,
      payerFeeAmount: 0,
      actualPaidAmount: 1_000,
      recipientReceivedAmount: 998,
    });
    expect(payer).toMatchObject({
      channelFeeAmount: 2,
      payerFeeAmount: 2,
      actualPaidAmount: 1_002,
      recipientReceivedAmount: 1_000,
    });
    expect(shared).toMatchObject({
      channelFeeAmount: 2,
      payerFeeAmount: 1,
      actualPaidAmount: 1_001,
      recipientReceivedAmount: 999,
    });
  });

  it('groups actual paid totals by currency without converting currencies', () => {
    const previews = [
      paymentPreviewFor({ payout, feeBearer: 'ADVERTISER' }),
      paymentPreviewFor({ payout: { ...payout, id: 'payout-2', amount: 500 }, feeBearer: 'PUBLISHER' }),
      paymentPreviewFor({ payout: { ...payout, id: 'payout-3', currency: 'EUR', amount: 100 }, feeBearer: 'SHARED' }),
    ];

    expect(paymentPreviewActualPaidTotals(previews)).toEqual([
      { currency: 'USD', amount: 1_502 },
      { currency: 'EUR', amount: 100.5 },
    ]);
  });

  it('safely previews account currencies outside the invoice currency set', () => {
    const jpy = paymentPreviewFor({ payout, feeBearer: 'ADVERTISER', receiveCurrency: 'JPY' });
    const thb = paymentPreviewFor({ payout, feeBearer: 'ADVERTISER', receiveCurrency: 'THB' });

    expect(jpy.recipientReceivedCurrency).toBe('JPY');
    expect(jpy.recipientReceivedAmount).toBeGreaterThan(0);
    expect(Number.isFinite(jpy.recipientReceivedAmount)).toBe(true);
    expect(thb.recipientReceivedCurrency).toBe('THB');
    expect(thb.recipientReceivedAmount).toBeGreaterThan(0);
    expect(Number.isFinite(thb.recipientReceivedAmount)).toBe(true);
  });
});
