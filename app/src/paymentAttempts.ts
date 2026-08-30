import type { PaymentAttemptSnapshot, Payout } from './types';

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
  errorCode?: string;
  providerResponse?: string;
  returnReason?: string;
}): PaymentAttemptSnapshot => ({
  paymentBatchId: payout.currentPaymentAttempt?.paymentBatchId,
  paymentBatchCode: payout.currentPaymentAttempt?.paymentBatchCode,
  attemptNumber: Math.max(
    1,
    payout.currentPaymentAttempt?.attemptNumber
      ?? (payout.paymentAttempts?.length ? payout.paymentAttempts.length + 1 : 1),
  ),
  status,
  occurredAt,
  principalAmount: payout.amount,
  principalCurrency: payout.currency,
  transferFeeAmount,
  transferFeeCurrency,
  actualPaidAmount,
  actualPaidCurrency,
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
