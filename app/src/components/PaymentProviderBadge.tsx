import './PaymentProviderBadge.css';

export type PaymentProviderBadgeName = 'Airwallex' | 'PayMax' | 'PayPal';

const PAYMENT_PROVIDER_META: Record<PaymentProviderBadgeName, { monogram: string; tone: string }> = {
  Airwallex: { monogram: 'A', tone: 'airwallex' },
  PayMax: { monogram: 'P', tone: 'paymax' },
  PayPal: { monogram: 'P', tone: 'paypal' },
};

export const normalizePaymentProviderBadgeName = (provider?: string | null): PaymentProviderBadgeName | null => {
  const normalized = provider?.trim().toLowerCase().replace(/[\s_-]+/g, '') ?? '';
  if (normalized === 'airwallex') return 'Airwallex';
  if (normalized === 'paypal') return 'PayPal';
  if (normalized === 'paymax' || normalized === 'payermax') return 'PayMax';
  return null;
};

export function PaymentProviderBadge({
  provider,
  compact = false,
  className = '',
}: {
  provider?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const normalizedProvider = normalizePaymentProviderBadgeName(provider);
  const label = (normalizedProvider ?? provider?.trim()) || '待确认';
  const meta = normalizedProvider ? PAYMENT_PROVIDER_META[normalizedProvider] : null;

  return (
    <span
      className={`payment-provider-badge is-${meta?.tone ?? 'unknown'}${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}
      data-payment-provider={normalizedProvider ?? 'unknown'}
    >
      {meta ? <span className="payment-provider-mark" aria-hidden="true">{meta.monogram}</span> : null}
      <span className="payment-provider-label">{label}</span>
    </span>
  );
}

const providerList = (providers: string | readonly string[]) => {
  const values = Array.isArray(providers) ? providers : [providers];
  const parsed = values.flatMap((value) => value.split(/[、,，]/)).map((value) => value.trim()).filter(Boolean);
  return [...new Set(parsed)];
};

export function PaymentProviderBadges({
  providers,
  compact = false,
  className = '',
}: {
  providers: string | readonly string[];
  compact?: boolean;
  className?: string;
}) {
  const values = providerList(providers);
  return (
    <span className={`payment-provider-badge-group${className ? ` ${className}` : ''}`}>
      {(values.length ? values : ['待确认']).map((provider) => (
        <PaymentProviderBadge compact={compact} key={provider} provider={provider} />
      ))}
    </span>
  );
}
