import {
  paymentListEffectiveAccount,
  type PaymentListItem,
  type PaymentListRecord,
} from './businessWorkflow';
import type { PaymentBatchItemSnapshot } from './paymentBatches';
import type { CreatorProfile, GeneratedInvoiceRecord, Payout } from './types';

export const PAYMENT_ACCOUNT_NAME_MISSING = 'Account Name 待补充';
export const PAYMENT_DISPLAY_NAME_MISSING = 'Display Name 待补充';

export type PaymentCreatorIdentityData = Readonly<{
  accountName: string;
  displayName: string;
  initials: string;
  accent?: string;
}>;

const normalizedValue = (value?: string) => value?.trim() ?? '';

const fallbackInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return Array.from(parts[0] ?? '?').slice(0, 2).join('').toUpperCase();
};

export const paymentCreatorIdentityFromValues = ({
  accountName,
  displayName,
  creator,
  initials,
  accent,
}: {
  accountName?: string;
  displayName?: string;
  creator?: CreatorProfile | null;
  initials?: string;
  accent?: string;
}): PaymentCreatorIdentityData => {
  const resolvedAccountName = normalizedValue(accountName) || PAYMENT_ACCOUNT_NAME_MISSING;
  const resolvedDisplayName = normalizedValue(displayName)
    || normalizedValue(creator?.name)
    || PAYMENT_DISPLAY_NAME_MISSING;
  return {
    accountName: resolvedAccountName,
    displayName: resolvedDisplayName,
    initials: normalizedValue(creator?.initials)
      || normalizedValue(initials)
      || fallbackInitials(resolvedDisplayName),
    accent: creator?.accent || accent,
  };
};

export const findPaymentListItemForPayout = (
  payout: Payout,
  generatedInvoices: readonly GeneratedInvoiceRecord[],
  paymentLists: readonly PaymentListRecord[],
): PaymentListItem | undefined => {
  const invoice = generatedInvoices.find((candidate) => candidate.sourcePayoutId === payout.id);
  const scopedLists = payout.paymentRequestProjectId
    ? paymentLists.filter((list) => list.paymentRequestProjectId === payout.paymentRequestProjectId)
    : paymentLists;
  return scopedLists
    .flatMap((list) => list.items)
    .find((item) => item.invoiceId === invoice?.invoiceId)
    ?? scopedLists
      .flatMap((list) => list.items)
      .find((item) => item.snapshot.invoiceNumber === payout.invoice);
};

export const paymentCreatorIdentityFromPayout = ({
  payout,
  paymentItem,
  creator,
}: {
  payout: Payout;
  paymentItem?: PaymentListItem;
  creator?: CreatorProfile | null;
}): PaymentCreatorIdentityData => {
  const effectivePayment = paymentItem
    ? paymentListEffectiveAccount(paymentItem).paymentDetails
    : undefined;
  const accountName = normalizedValue(effectivePayment?.accountName)
    || normalizedValue(payout.invoicePaymentFreezeSnapshot?.payment.accountName)
    || normalizedValue(payout.invoiceSnapshot?.payment.accountName);
  const displayName = normalizedValue(creator?.name)
    || normalizedValue(payout.creator);
  return paymentCreatorIdentityFromValues({
    accountName,
    displayName,
    creator,
    initials: payout.initials,
    accent: payout.accent,
  });
};

export const paymentCreatorIdentityFromBatchItem = (
  item: PaymentBatchItemSnapshot,
  creator?: CreatorProfile | null,
): PaymentCreatorIdentityData => {
  return paymentCreatorIdentityFromValues({
    accountName: item.accountName,
    displayName: item.creatorName,
    creator,
  });
};
