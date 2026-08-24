export type PaymentProviderName = 'Airwallex' | 'PayMax' | 'PayPal';

export const normalizePaymentProviderName = (provider?: string | null): PaymentProviderName | null => {
  const normalized = provider?.trim().toLowerCase().replace(/[\s_-]+/g, '') ?? '';
  if (normalized === 'airwallex') return 'Airwallex';
  if (normalized === 'paypal') return 'PayPal';
  if (normalized === 'paymax' || normalized === 'payermax') return 'PayMax';
  return null;
};

export const paymentProviderDisplayName = (provider?: string | null) => {
  const normalizedProvider = normalizePaymentProviderName(provider);
  if (normalizedProvider === 'PayMax') return 'Payer Max';
  return normalizedProvider ?? (provider?.trim() || '待确认');
};
