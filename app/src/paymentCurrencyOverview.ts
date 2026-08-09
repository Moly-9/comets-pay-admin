import { isInvoiceApprovedForPayment } from './invoice/invoiceReviewWorkflow';
import type { InvoiceCurrency, Payout } from './types';

export type PaymentCurrencyItem = {
  currency: string;
  amount: number;
  count: number;
};

type OverviewPayout = Pick<
  Payout,
  'amount' | 'currency' | 'invoiceReviewStatus' | 'paidAt' | 'status'
>;

export const PAYMENT_CURRENCY_ORDER: InvoiceCurrency[] = ['USD', 'EUR', 'GBP', 'HKD', 'SGD'];

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';
const SHANGHAI_MONTH_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHANGHAI_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
});

const monthKeyForDate = (date: Date) => {
  const parts = SHANGHAI_MONTH_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return year && month ? `${year}-${month}` : '';
};

const monthKeyForPaidAt = (paidAt?: string) => {
  if (!paidAt) return '';
  const normalized = paidAt.trim();
  const localDate = normalized.match(/^(\d{4})-(\d{2})-\d{2}/);
  const hasExplicitTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  if (localDate && !hasExplicitTimeZone) return `${localDate[1]}-${localDate[2]}`;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? '' : monthKeyForDate(parsed);
};

const currencyRank = (currency: string) => {
  const rank = PAYMENT_CURRENCY_ORDER.indexOf(currency as InvoiceCurrency);
  return rank === -1 ? PAYMENT_CURRENCY_ORDER.length : rank;
};

export const sortPaymentCurrencyItems = (items: PaymentCurrencyItem[]) => (
  [...items].sort((left, right) => {
    const rankDifference = currencyRank(left.currency) - currencyRank(right.currency);
    return rankDifference || left.currency.localeCompare(right.currency, 'en');
  })
);

export const aggregatePayoutCurrencies = (
  payouts: Array<Pick<OverviewPayout, 'amount' | 'currency'>>,
  ensureUsd = false,
) => {
  const totals = payouts.reduce<Map<string, PaymentCurrencyItem>>((result, payout) => {
    const current = result.get(payout.currency) ?? {
      currency: payout.currency,
      amount: 0,
      count: 0,
    };
    result.set(payout.currency, {
      ...current,
      amount: current.amount + payout.amount,
      count: current.count + 1,
    });
    return result;
  }, new Map());

  if (ensureUsd && !totals.has('USD')) {
    totals.set('USD', { currency: 'USD', amount: 0, count: 0 });
  }

  return sortPaymentCurrencyItems(Array.from(totals.values()));
};

export const getPaymentCurrencyOverviews = (
  payouts: OverviewPayout[],
  now = new Date(),
) => {
  const currentMonth = monthKeyForDate(now);
  const approvedPayouts = payouts.filter(isInvoiceApprovedForPayment);

  return {
    pending: aggregatePayoutCurrencies(
      approvedPayouts.filter((payout) => (
        payout.status === '等待付款' || payout.status === '付款处理中'
      )),
      true,
    ),
    paid: aggregatePayoutCurrencies(
      approvedPayouts.filter((payout) => (
        payout.status === '已付款' && monthKeyForPaidAt(payout.paidAt) === currentMonth
      )),
      true,
    ),
  };
};
