import { ChevronRight, Diamond, WalletCards } from 'lucide-react';
import { useState } from 'react';
import type { PaymentCurrencyItem } from '../paymentCurrencyOverview';
import { Button, Modal } from './Common';

export const CURRENCY_FLAG_PATHS: Record<string, string> = {
  USD: '/currency-flags/us.svg',
  EUR: '/currency-flags/eu.svg',
  GBP: '/currency-flags/gb.svg',
  HKD: '/currency-flags/hk.svg',
  SGD: '/currency-flags/sg.svg',
};

const formatOverviewAmount = (amount: number) => amount.toLocaleString('en-US');
const formatCurrencyAmount = ({ currency, amount }: Pick<PaymentCurrencyItem, 'currency' | 'amount'>) => (
  `${currency}\u00a0${formatOverviewAmount(amount)}`
);

export function PaymentCurrencySummaryCard({
  items,
  summaryLabel,
  detailTitle,
  tone,
  icon,
  summaryCount,
}: {
  items: PaymentCurrencyItem[];
  summaryLabel: string;
  detailTitle: string;
  tone: 'peach' | 'lilac';
  icon: 'pending' | 'paid';
  summaryCount?: number;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const primary = items.find((item) => item.currency === 'USD')
    ?? { currency: 'USD', amount: 0, count: 0 };
  const secondary = items.filter((item) => item.currency !== 'USD');
  const hasDetails = items.length > 4;
  const visibleSecondary = secondary.slice(0, 4);

  return (
    <>
      <article
        className={`summary-card summary-card-${tone} payment-workbench-summary-card${hasDetails ? ' has-details' : ''}`}
        aria-label={summaryLabel}
      >
        <span className={`summary-illustration ${icon === 'pending' ? 'summary-coins' : ''}`} aria-hidden="true">
          {icon === 'pending'
            ? <Diamond size={19} fill="currentColor" strokeWidth={1.5} />
            : <WalletCards size={27} />}
        </span>
        <div className="payment-summary-content">
          <div className="payment-summary-primary">
            <strong>{formatCurrencyAmount(primary)}</strong>
            <span>{summaryLabel} · {summaryCount ?? primary.count} 笔</span>
          </div>
        </div>
        {hasDetails ? (
          <button
            className="payment-summary-details-button"
            type="button"
            aria-label={`查看${detailTitle}`}
            title={`查看${detailTitle}`}
            onClick={() => setDetailsOpen(true)}
          >
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        ) : null}
        {visibleSecondary.length ? (
          <div className="payment-summary-secondary" aria-label={`${summaryLabel}其他币种`}>
            {visibleSecondary.map((item) => (
              <div className="payment-summary-secondary-row" key={item.currency}>
                <span className="payment-summary-secondary-amount">{formatCurrencyAmount(item)}</span>
                <small>{item.count} 笔</small>
              </div>
            ))}
          </div>
        ) : null}
      </article>

      {detailsOpen ? (
        <Modal
          title={detailTitle}
          width="460px"
          className="payment-currency-detail-modal"
          onClose={() => setDetailsOpen(false)}
          footer={<Button variant="secondary" onClick={() => setDetailsOpen(false)}>关闭</Button>}
        >
          <ul className="payment-currency-detail-list" aria-label="币种金额和付款笔数">
            {items.map((item) => (
              <li className="payment-currency-detail-row" key={item.currency}>
                <img
                  className="payment-currency-flag"
                  src={CURRENCY_FLAG_PATHS[item.currency]}
                  alt=""
                  width="24"
                  height="16"
                />
                <span className="payment-currency-detail-meta">
                  <strong>{item.currency}</strong>
                  <small>{item.count} 笔</small>
                </span>
                <strong className="payment-currency-detail-amount">
                  {formatCurrencyAmount(item)}
                </strong>
              </li>
            ))}
          </ul>
        </Modal>
      ) : null}
    </>
  );
}
