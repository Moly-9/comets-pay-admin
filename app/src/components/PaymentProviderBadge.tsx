import './PaymentProviderBadge.css';
import {
  normalizePaymentProviderName,
  paymentProviderDisplayName,
  type PaymentProviderName,
} from '../paymentProviderPresentation';

export type PaymentProviderBadgeName = PaymentProviderName;

const PAYMENT_PROVIDER_META: Record<PaymentProviderBadgeName, { tone: string }> = {
  Airwallex: { tone: 'airwallex' },
  PayMax: { tone: 'paymax' },
  PayPal: { tone: 'paypal' },
};

export const normalizePaymentProviderBadgeName = (provider?: string | null): PaymentProviderBadgeName | null => {
  return normalizePaymentProviderName(provider);
};

export { paymentProviderDisplayName };

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
  const label = paymentProviderDisplayName(provider);
  const meta = normalizedProvider ? PAYMENT_PROVIDER_META[normalizedProvider] : null;

  return (
    <span
      className={`payment-provider-badge is-${meta?.tone ?? 'unknown'}${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}
      data-payment-provider={normalizedProvider ?? 'unknown'}
    >
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
