const OWN_FEE_BEARER_VALUES = new Set([
  'ADVERTISER',
  '广告主承担',
  '付款方承担',
]);

const COUNTERPARTY_FEE_BEARER_VALUES = new Set([
  'PUBLISHER',
  '收款人承担',
  '收款方承担',
]);

export const paymentFeeBearerDisplayName = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  if (OWN_FEE_BEARER_VALUES.has(normalized)) return '我方承担';
  if (COUNTERPARTY_FEE_BEARER_VALUES.has(normalized)) return '对方承担';
  return normalized || '未记录';
};
