import { isInvoiceApprovedForPayment } from './invoice/invoiceReviewWorkflow';
import type { Payout } from './types';

export type TransactionTab = 'all' | 'paid' | 'failed';
export type TransactionProvider = 'all' | Payout['provider'];

export type TransactionRecordFilters = {
  tab: TransactionTab;
  search: string;
  provider: TransactionProvider;
  startDate: string;
  endDate: string;
};

export const transactionOccurredAt = (payout: Payout) => (
  payout.status === '已付款'
    ? payout.paidAt ?? ''
    : payout.status === '付款失败'
      ? payout.paymentFailure?.occurredAt ?? ''
      : ''
);

export const transactionDateKey = (payout: Payout) => (
  transactionOccurredAt(payout).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? ''
);

export const isFinalTransaction = (payout: Payout) => (
  isInvoiceApprovedForPayment(payout)
  && (payout.status === '已付款' || payout.status === '付款失败')
);

const matchesTransactionSearch = (payout: Payout, search: string) => {
  const term = search.trim().toLocaleLowerCase();
  if (!term) return true;
  return [
    payout.creator,
    payout.handle,
    payout.project,
    payout.projectId,
    payout.invoice,
    payout.contract,
    payout.provider,
    payout.currency,
    payout.status,
  ].some((value) => value.toLocaleLowerCase().includes(term));
};

export const filterTransactionRecords = (
  payouts: Payout[],
  filters: TransactionRecordFilters,
) => payouts.filter((payout) => {
  if (!isFinalTransaction(payout)) return false;
  if (filters.tab === 'paid' && payout.status !== '已付款') return false;
  if (filters.tab === 'failed' && payout.status !== '付款失败') return false;
  if (filters.provider !== 'all' && payout.provider !== filters.provider) return false;
  if (!matchesTransactionSearch(payout, filters.search)) return false;

  const date = transactionDateKey(payout);
  if (filters.startDate && (!date || date < filters.startDate)) return false;
  if (filters.endDate && (!date || date > filters.endDate)) return false;
  return true;
});

export const transactionCreatorLabel = (payout: Payout) => {
  const creator = payout.creator.trim();
  const handle = payout.handle.trim();
  if (!handle || handle.toLocaleLowerCase() === creator.toLocaleLowerCase()) return creator;
  return `${creator} (${handle})`;
};
