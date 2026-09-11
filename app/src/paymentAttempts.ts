import type { PaymentAttemptSnapshot, Payout } from './types';

export type PaymentAttemptAmountTotal = Readonly<{
  currency: string;
  amount: number;
}>;

const attemptIdentity = (attempt: PaymentAttemptSnapshot) => (
  attempt.paymentBatchId
    ? `batch:${attempt.paymentBatchId}`
    : `attempt:${attempt.attemptNumber}`
);

export const mergePaymentAttemptSnapshot = (
  attempts: readonly PaymentAttemptSnapshot[] | undefined,
  snapshot: PaymentAttemptSnapshot,
) => [
  ...(attempts ?? []).filter((attempt) => attemptIdentity(attempt) !== attemptIdentity(snapshot)),
  snapshot,
].sort((left, right) => left.attemptNumber - right.attemptNumber);

export const paymentAttemptSnapshotFor = ({
  payout,
  status,
  occurredAt,
  transferFeeAmount,
  transferFeeCurrency,
  actualPaidAmount,
  actualPaidCurrency,
  recipientReceivedAmount,
  recipientReceivedCurrency,
  errorCode,
  providerResponse,
  returnReason,
}: {
  payout: Payout;
  status: PaymentAttemptSnapshot['status'];
  occurredAt?: string;
  transferFeeAmount?: number;
  transferFeeCurrency?: PaymentAttemptSnapshot['transferFeeCurrency'];
  actualPaidAmount?: number;
  actualPaidCurrency?: PaymentAttemptSnapshot['actualPaidCurrency'];
  recipientReceivedAmount?: number;
  recipientReceivedCurrency?: PaymentAttemptSnapshot['recipientReceivedCurrency'];
  errorCode?: string;
  providerResponse?: string;
  returnReason?: string;
}): PaymentAttemptSnapshot => ({
  paymentBatchId: payout.currentPaymentAttempt?.paymentBatchId,
  paymentBatchCode: payout.currentPaymentAttempt?.paymentBatchCode,
  paymentCode: payout.currentPaymentAttempt?.paymentCode ?? payout.paymentCode,
  attemptNumber: Math.max(
    1,
    payout.currentPaymentAttempt?.attemptNumber
      ?? (payout.paymentAttempts?.length ? payout.paymentAttempts.length + 1 : 1),
  ),
  status,
  submittedAt: payout.currentPaymentAttempt?.submittedAt,
  occurredAt,
  principalAmount: payout.amount,
  principalCurrency: payout.currency,
  transferFeeAmount,
  transferFeeCurrency,
  actualPaidAmount,
  actualPaidCurrency,
  recipientReceivedAmount,
  recipientReceivedCurrency,
  errorCode,
  providerResponse,
  returnReason,
});

export const withPaymentAttemptSnapshot = (
  payout: Payout,
  snapshot: PaymentAttemptSnapshot,
): Payout => ({
  ...payout,
  paymentAttempts: mergePaymentAttemptSnapshot(payout.paymentAttempts, snapshot),
});

export const withLatestFailedAttemptReturnReason = (
  payout: Payout,
  returnReason: string,
): Payout => {
  const latestFailedAttempt = [...(payout.paymentAttempts ?? [])]
    .reverse()
    .find((attempt) => attempt.status === '付款失败');
  if (!latestFailedAttempt) return payout;
  return {
    ...payout,
    paymentAttempts: payout.paymentAttempts?.map((attempt) => (
      attemptIdentity(attempt) === attemptIdentity(latestFailedAttempt)
        ? { ...attempt, returnReason }
        : attempt
    )),
  };
};

export const paymentAttemptAmountTotals = (
  attempts: readonly PaymentAttemptSnapshot[],
  amountKey: 'actualPaidAmount' | 'transferFeeAmount',
  currencyKey: 'actualPaidCurrency' | 'transferFeeCurrency',
): readonly PaymentAttemptAmountTotal[] => {
  const uniqueAttempts = [...attempts.reduce<Map<string, PaymentAttemptSnapshot>>((result, attempt) => {
    result.set(attemptIdentity(attempt), attempt);
    return result;
  }, new Map()).values()];
  const totals = uniqueAttempts.reduce<Map<string, number>>((result, attempt) => {
    const amount = attempt[amountKey];
    const currency = attempt[currencyKey];
    if (amount === undefined || !currency) return result;
    const total = (result.get(currency) ?? 0) + amount;
    result.set(currency, Math.round((total + Number.EPSILON) * 100) / 100);
    return result;
  }, new Map());
  return [...totals.entries()].map(([currency, amount]) => ({ currency, amount }));
};
