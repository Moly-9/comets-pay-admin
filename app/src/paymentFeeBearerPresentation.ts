const OWN_FEE_BEARER_VALUES = new Set([
  'ADVERTISER',
  '广告主承担',
  '付款方承担',
]);

const COUNTERPARTY_FEE_BEARER_VALUES = new Set([
  'PUBLISHER',
  '收款人承担',
  '收款方承担',
  '对方承担',
]);

const SHARED_FEE_BEARER_VALUES = new Set([
  'SHARED',
  '共同承担',
  '双方共同承担',
  '双方分摊',
]);

export type PaymentFeeBearer = 'ADVERTISER' | 'PUBLISHER' | 'SHARED';

export const paymentFeeBearerValue = (value: unknown): PaymentFeeBearer | undefined => {
  const normalized = String(value ?? '').trim();
  if (OWN_FEE_BEARER_VALUES.has(normalized)) return 'ADVERTISER';
  if (COUNTERPARTY_FEE_BEARER_VALUES.has(normalized)) return 'PUBLISHER';
  if (SHARED_FEE_BEARER_VALUES.has(normalized)) return 'SHARED';
  return undefined;
};

export const paymentFeeBearerDisplayName = (value: unknown) => {
  const normalized = paymentFeeBearerValue(value);
  if (normalized === 'ADVERTISER') return '我方承担';
  if (normalized === 'PUBLISHER') return '对方承担';
  if (normalized === 'SHARED') return '共同承担';
  return String(value ?? '').trim() || '未记录';
};
