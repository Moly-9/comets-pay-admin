import type { InvoiceCurrency, PaymentAttemptSnapshot, Payout } from './types';

export type PaymentAttemptAmountTotal = Readonly<{
  currency: InvoiceCurrency;
  amount: number;
}>;

type ExpenditureValues = Readonly<{
  principalAmount: number;
  principalCurrency: InvoiceCurrency;
  feeBearer?: string;
  transferFeeAmount?: number;
  transferFeeCurrency?: InvoiceCurrency;
  actualPaidAmount?: number;
  actualPaidCurrency?: InvoiceCurrency;
  refundAmount?: number;
  refundCurrency?: InvoiceCurrency;
}>;

const payerFeeRatio = (feeBearer?: string) => {
  if (['PUBLISHER', '收款人承担', '收款方承担', '对方承担'].includes(feeBearer ?? '')) return 0;
  if (['SHARED', '共同承担', '双方共同承担'].includes(feeBearer ?? '')) return 0.5;
  return 1;
};

export const paymentSingleAmountTotalsForValues = (
  values: Pick<ExpenditureValues, 'principalAmount' | 'principalCurrency' | 'feeBearer' | 'transferFeeAmount' | 'transferFeeCurrency'>,
): readonly PaymentAttemptAmountTotal[] | null => {
  if (!Number.isFinite(values.principalAmount) || !values.principalCurrency) return null;
  const feeRatio = payerFeeRatio(values.feeBearer);
  if (feeRatio && (values.transferFeeAmount === undefined || !Number.isFinite(values.transferFeeAmount))) return null;
  if (feeRatio && values.transferFeeAmount && !values.transferFeeCurrency) return null;

  const totals = new Map<string, number>();
  addMoney(totals, values.principalCurrency, values.principalAmount);
  if (feeRatio && values.transferFeeAmount) {
    addMoney(
      totals,
      values.transferFeeCurrency ?? values.principalCurrency,
      Math.round((values.transferFeeAmount * feeRatio + Number.EPSILON) * 100) / 100,
    );
  }
  return [...totals.entries()].map(([currency, amount]) => ({ currency: currency as InvoiceCurrency, amount }));
};

export const paymentSingleAmountLabel = (
  totals: readonly PaymentAttemptAmountTotal[] | null,
  fallback = '—',
) => totals?.length
  ? totals.map(({ currency, amount }) => `${currency} ${amount.toLocaleString('en-US')}`).join(' + ')
  : fallback;

const addMoney = (
  totals: Map<string, number>,
  currency: string | undefined,
  amount: number | undefined,
) => {
  if (!currency || amount === undefined || !Number.isFinite(amount)) return;
  const next = (totals.get(currency) ?? 0) + amount;
  totals.set(currency, Math.round((next + Number.EPSILON) * 100) / 100);
};

export const paymentExpenditureTotalsForValues = (
  values: ExpenditureValues,
): readonly PaymentAttemptAmountTotal[] => {
  const totals = new Map<string, number>();
  if (values.actualPaidAmount !== undefined && values.actualPaidCurrency) {
    addMoney(totals, values.actualPaidCurrency, values.actualPaidAmount);
  } else {
    addMoney(totals, values.principalCurrency, values.principalAmount);
    addMoney(
      totals,
      values.transferFeeCurrency ?? values.principalCurrency,
      values.transferFeeAmount === undefined
        ? undefined
        : values.transferFeeAmount * payerFeeRatio(values.feeBearer),
    );
  }
  addMoney(totals, values.refundCurrency, values.refundAmount === undefined ? undefined : -values.refundAmount);
  return [...totals.entries()].map(([currency, amount]) => ({ currency: currency as InvoiceCurrency, amount }));
};

export const paymentPayoutExpenditureTotals = (
  payout: Payout,
): readonly PaymentAttemptAmountTotal[] => {
  const attempts: readonly ExpenditureValues[] = payout.paymentAttempts?.length
    ? [...payout.paymentAttempts.reduce<Map<string, PaymentAttemptSnapshot>>((result, attempt) => {
        result.set(attemptIdentity(attempt), attempt);
        return result;
      }, new Map()).values()]
    : payout.status === '已付款' || payout.status === '付款失败' || payout.status === '已退回'
      ? [{
          principalAmount: payout.amount,
          principalCurrency: payout.currency,
          transferFeeAmount: payout.transferFeeAmount,
          transferFeeCurrency: payout.transferFeeCurrency,
          actualPaidAmount: payout.actualPaidAmount,
          actualPaidCurrency: payout.actualPaidCurrency,
          refundAmount: payout.refundAmount,
          refundCurrency: payout.refundCurrency,
        }]
      : [];
  const totals = new Map<string, number>();
  attempts.forEach((attempt) => {
    paymentExpenditureTotalsForValues({ ...attempt, feeBearer: payout.feeBearer }).forEach(({ currency, amount }) => {
      addMoney(totals, currency, amount);
    });
  });
  return [...totals.entries()].map(([currency, amount]) => ({ currency: currency as InvoiceCurrency, amount }));
};

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
  refundAmount,
  refundCurrency,
  refundedAt,
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
  refundAmount?: number;
  refundCurrency?: PaymentAttemptSnapshot['refundCurrency'];
  refundedAt?: string;
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
  refundAmount,
  refundCurrency,
  refundedAt,
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
    if (
      amountKey === 'actualPaidAmount'
      && attempt.refundAmount !== undefined
      && attempt.refundCurrency
    ) {
      const refundTotal = (result.get(attempt.refundCurrency) ?? 0) - attempt.refundAmount;
      result.set(
        attempt.refundCurrency,
        Math.round((refundTotal + Number.EPSILON) * 100) / 100,
      );
    }
    return result;
  }, new Map());
  return [...totals.entries()].map(([currency, amount]) => ({ currency: currency as InvoiceCurrency, amount }));
};
