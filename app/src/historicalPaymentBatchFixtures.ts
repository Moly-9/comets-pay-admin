export type HistoricalPaymentBatchSeed = Readonly<{
  payer: string;
  paymentBatchCode: string;
  requestCode: string;
  paymentListCode: string;
  invoiceDate: string;
  transferMethod: string;
}>;

/** Only for legacy demo payouts that have a result time but no execution timestamp. */
export const simulatedHistoricalPaymentSubmittedAt = (resultTime: string): string | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})([ T])(\d{2}):(\d{2})(?::(\d{2})(\.\d{3})?)?(Z)?$/.exec(resultTime);
  if (!match) return undefined;
  const [, year, month, day, separator, hour, minute, second, milliseconds, utcSuffix] = match;
  const timestamp = Date.UTC(
    Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute),
    Number(second ?? 0), Number(milliseconds?.slice(1) ?? 0),
  );
  const normalized = new Date(timestamp).toISOString();
  if (normalized.slice(0, 10) !== `${year}-${month}-${day}`
    || normalized.slice(11, 16) !== `${hour}:${minute}`) return undefined;
  const earlier = new Date(timestamp - 5 * 60_000).toISOString();
  return `${earlier.slice(0, 10)}${separator}${earlier.slice(11, 16)}`
    + (second === undefined ? '' : earlier.slice(16, 19))
    + (milliseconds ? earlier.slice(19, 23) : '')
    + (utcSuffix ?? '');
};

export const HISTORICAL_PAYMENT_BATCH_SEEDS: Readonly<Record<string, HistoricalPaymentBatchSeed>> = {
  'pay-005': {
    payer: '奚文慧',
    paymentBatchCode: 'BAT-20260716-001',
    requestCode: 'REQ-20260716-000005',
    paymentListCode: 'PAY-2607160001',
    invoiceDate: '2026-07-12',
    transferMethod: '本地转账',
  },
  'pay-006': {
    payer: '李梦',
    paymentBatchCode: 'BAT-20260715-001',
    requestCode: 'REQ-20260715-000006',
    paymentListCode: 'PAY-2607150001',
    invoiceDate: '2026-07-11',
    transferMethod: '本地转账',
  },
  'pay-017': {
    payer: '吴雪霓',
    paymentBatchCode: 'BAT-20260804-001',
    requestCode: 'REQ-20260804-000017',
    paymentListCode: 'PAY-2608040001',
    invoiceDate: '2026-08-02',
    transferMethod: '本地转账',
  },
  'pay-018': {
    payer: '奚文慧',
    paymentBatchCode: 'BAT-20260725-001',
    requestCode: 'REQ-20260725-000018',
    paymentListCode: 'PAY-2607250001',
    invoiceDate: '2026-07-22',
    transferMethod: '本地转账',
  },
  'pay-019': {
    payer: '李梦',
    paymentBatchCode: 'BAT-20260726-001',
    requestCode: 'REQ-20260726-000019',
    paymentListCode: 'PAY-2607260001',
    invoiceDate: '2026-07-23',
    transferMethod: 'PayPal',
  },
  'pay-026': {
    payer: '吴雪霓',
    paymentBatchCode: 'BAT-20260804-002',
    requestCode: 'REQ-20260804-000026',
    paymentListCode: 'PAY-2608040002',
    invoiceDate: '2026-08-01',
    transferMethod: '本地转账',
  },
  'pay-027': {
    payer: '奚文慧',
    paymentBatchCode: 'BAT-20260805-010',
    requestCode: 'REQ-20260805-000027',
    paymentListCode: 'PAY-2608050001',
    invoiceDate: '2026-08-02',
    transferMethod: '本地转账',
  },
  'pay-028': {
    payer: '李梦',
    paymentBatchCode: 'BAT-20260806-002',
    requestCode: 'REQ-20260806-000028',
    paymentListCode: 'PAY-2608060002',
    invoiceDate: '2026-08-03',
    transferMethod: 'SWIFT',
  },
  'pay-029': {
    payer: '吴雪霓',
    paymentBatchCode: 'BAT-20260807-001',
    requestCode: 'REQ-20260807-000029',
    paymentListCode: 'PAY-2608070001',
    invoiceDate: '2026-08-04',
    transferMethod: '本地转账',
  },
  'pay-030': {
    payer: '奚文慧',
    paymentBatchCode: 'BAT-20260808-001',
    requestCode: 'REQ-20260808-000030',
    paymentListCode: 'PAY-2608080001',
    invoiceDate: '2026-08-05',
    transferMethod: '本地转账',
  },
};
