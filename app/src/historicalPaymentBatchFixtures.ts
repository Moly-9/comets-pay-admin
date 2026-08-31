export type HistoricalPaymentBatchSeed = Readonly<{
  payer: string;
  paymentBatchCode: string;
  requestCode: string;
  paymentListCode: string;
  invoiceDate: string;
  transferMethod: string;
}>;

export const HISTORICAL_PAYMENT_BATCH_SEEDS: Readonly<Record<string, HistoricalPaymentBatchSeed>> = {
  'pay-005': {
    payer: '奚文慧',
    paymentBatchCode: 'BAT-20260716-001',
    requestCode: 'REQ-20260716-000005',
    paymentListCode: 'PAY-20260716-001',
    invoiceDate: '2026-07-12',
    transferMethod: '本地转账',
  },
  'pay-006': {
    payer: '李梦',
    paymentBatchCode: 'BAT-20260715-001',
    requestCode: 'REQ-20260715-000006',
    paymentListCode: 'PAY-20260715-001',
    invoiceDate: '2026-07-11',
    transferMethod: '本地转账',
  },
  'pay-017': {
    payer: '吴雪霓',
    paymentBatchCode: 'BAT-20260804-001',
    requestCode: 'REQ-20260804-000017',
    paymentListCode: 'PAY-20260804-001',
    invoiceDate: '2026-08-02',
    transferMethod: '本地转账',
  },
  'pay-018': {
    payer: '奚文慧',
    paymentBatchCode: 'BAT-20260725-001',
    requestCode: 'REQ-20260725-000018',
    paymentListCode: 'PAY-20260725-001',
    invoiceDate: '2026-07-22',
    transferMethod: '本地转账',
  },
  'pay-019': {
    payer: '李梦',
    paymentBatchCode: 'BAT-20260726-001',
    requestCode: 'REQ-20260726-000019',
    paymentListCode: 'PAY-20260726-001',
    invoiceDate: '2026-07-23',
    transferMethod: 'PayPal',
  },
  'pay-026': {
    payer: '吴雪霓',
    paymentBatchCode: 'BAT-20260804-002',
    requestCode: 'REQ-20260804-000026',
    paymentListCode: 'PAY-20260804-002',
    invoiceDate: '2026-08-01',
    transferMethod: '本地转账',
  },
  'pay-027': {
    payer: '奚文慧',
    paymentBatchCode: 'BAT-20260805-010',
    requestCode: 'REQ-20260805-000027',
    paymentListCode: 'PAY-20260805-001',
    invoiceDate: '2026-08-02',
    transferMethod: '本地转账',
  },
  'pay-028': {
    payer: '李梦',
    paymentBatchCode: 'BAT-20260806-002',
    requestCode: 'REQ-20260806-000028',
    paymentListCode: 'PAY-20260806-001',
    invoiceDate: '2026-08-03',
    transferMethod: 'SWIFT',
  },
  'pay-029': {
    payer: '吴雪霓',
    paymentBatchCode: 'BAT-20260807-001',
    requestCode: 'REQ-20260807-000029',
    paymentListCode: 'PAY-20260807-001',
    invoiceDate: '2026-08-04',
    transferMethod: '本地转账',
  },
  'pay-030': {
    payer: '奚文慧',
    paymentBatchCode: 'BAT-20260808-001',
    requestCode: 'REQ-20260808-000030',
    paymentListCode: 'PAY-20260808-001',
    invoiceDate: '2026-08-05',
    transferMethod: '本地转账',
  },
};
