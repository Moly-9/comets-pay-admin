import { Avatar } from './Common';
import './PaymentCreatorIdentity.css';

export function PaymentCreatorIdentity({
  accountName,
  displayName,
  initials,
  accent,
  size = 'sm',
  className = '',
}: {
  accountName: string;
  displayName: string;
  initials: string;
  accent?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span
      className={`payment-creator-identity is-${size} ${className}`.trim()}
      aria-label={`Account Name：${accountName}，Display Name：${displayName}`}
    >
      <Avatar initials={initials} accent={accent} size={size} />
      <span className="payment-creator-identity-copy">
        <strong title={accountName}>{accountName}</strong>
        <small title={displayName}>{displayName}</small>
      </span>
    </span>
  );
}
