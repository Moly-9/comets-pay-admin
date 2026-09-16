import { describe, expect, it } from 'vitest';
import {
  isPaymentBusinessCode,
  nextPaymentBusinessCode,
  normalizeLegacyPaymentOrderCode,
  paymentBusinessDate,
  reservePaymentBusinessCodes,
} from './paymentNumbering';
import { INITIAL_PAYOUTS, PROJECT_FIXTURES } from './data';
import { HISTORICAL_PAYMENT_BATCH_SEEDS } from './historicalPaymentBatchFixtures';
import { PAYMENT_BATCH_RETRY_DEMO } from './paymentBatchPrototypeScenario';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from './requestProjectPrototypeResources';
import { createInitialPaymentBatches } from './paymentBatches';

describe('payment business numbering', () => {
  it('uses the Asia/Shanghai business date at the UTC boundary', () => {
    expect(paymentBusinessDate(new Date('2026-08-05T15:59:59.000Z'))).toBe('260805');
    expect(paymentBusinessDate(new Date('2026-08-05T16:00:00.000Z'))).toBe('260806');
  });

  it('increments PAY and PMT independently and resets on a new date', () => {
    const existing = ['PAY-2608060001', 'PAY-2608060008', 'PMT-2608060003'];
    expect(nextPaymentBusinessCode('PAY', existing, new Date('2026-08-06T03:00:00.000Z')))
      .toBe('PAY-2608060009');
    expect(nextPaymentBusinessCode('PMT', existing, new Date('2026-08-06T03:00:00.000Z')))
      .toBe('PMT-2608060004');
    expect(nextPaymentBusinessCode('PAY', existing, new Date('2026-08-07T03:00:00.000Z')))
      .toBe('PAY-2608070001');
  });

  it('reserves unique daily sequences and blocks overflow', () => {
    expect(reservePaymentBusinessCodes('PMT', ['PMT-2608060001'], 3, new Date('2026-08-06T03:00:00.000Z')))
      .toEqual(['PMT-2608060002', 'PMT-2608060003', 'PMT-2608060004']);
    expect(() => nextPaymentBusinessCode('PAY', ['PAY-2608069999'], new Date('2026-08-06T03:00:00.000Z')))
      .toThrow('9999 上限');
  });

  it('recognizes the exact format and normalizes supported legacy orders', () => {
    expect(isPaymentBusinessCode('PAY-2608060001', 'PAY')).toBe(true);
    expect(isPaymentBusinessCode('PAY-20260806-001', 'PAY')).toBe(false);
    expect(normalizeLegacyPaymentOrderCode('PAY-260727-11', '260806', 1)).toBe('PAY-2607270011');
    expect(normalizeLegacyPaymentOrderCode('PAY-20260806-001', '260806', 1)).toBe('PAY-2608060001');
    expect(normalizeLegacyPaymentOrderCode('PAY-UNMAPPED', '260806', 7)).toBe('PAY-2608060007');
  });

  it('migrates all loaded demo payment orders and payment items to valid unique codes', () => {
    const fixtureOrderCodes = PROJECT_FIXTURES.map((project) => project.paymentOrder);
    const requestOrderCodes = INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists.map((list) => list.paymentListCode);
    const historicalOrderCodes = Object.values(HISTORICAL_PAYMENT_BATCH_SEEDS).map((seed) => seed.paymentListCode);
    const payoutCodes = INITIAL_COMPLETE_REQUEST_RESOURCES.payouts.map((payout) => payout.paymentCode);

    [...fixtureOrderCodes, ...requestOrderCodes, ...historicalOrderCodes, PAYMENT_BATCH_RETRY_DEMO.retryPaymentOrderCode]
      .forEach((code) => expect(isPaymentBusinessCode(code, 'PAY')).toBe(true));
    [...INITIAL_PAYOUTS.map((payout) => payout.paymentCode), ...payoutCodes]
      .forEach((code) => expect(isPaymentBusinessCode(code, 'PMT')).toBe(true));
    expect(new Set(fixtureOrderCodes).size).toBe(fixtureOrderCodes.length);
    expect(new Set(requestOrderCodes).size).toBe(requestOrderCodes.length);
    expect(new Set(historicalOrderCodes).size).toBe(historicalOrderCodes.length);
    expect(new Set(payoutCodes).size).toBe(payoutCodes.length);
  });

  it('keeps PAY and PMT stable across retry and reversal batches', () => {
    const batches = createInitialPaymentBatches({
      payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
      requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
      generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
      paymentLists: INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists,
      contracts: INITIAL_COMPLETE_REQUEST_RESOURCES.contracts,
    });
    const orderCodes = batches.map((batch) => batch.paymentOrderCode);
    orderCodes.forEach((code) => expect(isPaymentBusinessCode(code, 'PAY')).toBe(true));
    expect(new Set(batches.map((batch) => batch.paymentBatchCode)).size).toBe(batches.length);
    batches.flatMap((batch) => batch.items).forEach((item) => (
      expect(isPaymentBusinessCode(item.paymentCode, 'PMT')).toBe(true)
    ));

    const original = batches.find((batch) => batch.paymentBatchId === PAYMENT_BATCH_RETRY_DEMO.originalBatchId);
    const retry = batches.find((batch) => batch.paymentBatchId === PAYMENT_BATCH_RETRY_DEMO.retryBatchId);
    const originalFailed = original?.items.find((item) => item.paymentStatus === '付款失败');
    expect(retry?.purpose).toBe('RETRY');
    expect(retry?.paymentOrderCode).toBe(original?.paymentOrderCode);
    expect(retry?.items[0].paymentCode).toBe(originalFailed?.paymentCode);
    const reversal = batches.find((batch) => (
      batch.purpose === 'REVERSAL' && batch.sourcePaymentBatchId === original?.paymentBatchId
    ));
    expect(reversal?.paymentOrderCode).toBe(original?.paymentOrderCode);
    expect(reversal?.items[0].paymentCode).toBe(originalFailed?.paymentCode);
  });
});
