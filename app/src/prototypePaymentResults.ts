import type { Payout } from './types';

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const prototypeFundingAccountOpeningBalance = ({
  provider,
  currency,
}: Pick<Payout, 'provider' | 'currency'>) => {
  const providerBase = provider === 'PayPal' ? 180_000 : provider === 'PayMax' ? 320_000 : 500_000;
  const currencyScale = currency === 'HKD' ? 8 : 1;
  return roundCurrency(providerBase * currencyScale);
};

export const prototypePaymentResultFor = ({
  provider,
  currency,
  amount,
  feeBearer,
}: Pick<Payout, 'provider' | 'currency' | 'amount' | 'feeBearer'>): Pick<
  Payout,
  | 'transferFeeAmount'
  | 'transferFeeCurrency'
  | 'actualPaidAmount'
  | 'actualPaidCurrency'
  | 'recipientReceivedAmount'
  | 'recipientReceivedCurrency'
  | 'postTransactionBalance'
  | 'postTransactionBalanceCurrency'
> => {
  const rate = provider === 'PayPal' ? 0.03 : provider === 'PayMax' ? 0.008 : 0.002;
  const transferFeeAmount = roundCurrency(Math.max(1, amount * rate));
  const payerFeeShare = feeBearer === 'PUBLISHER'
    ? 0
    : feeBearer === 'SHARED'
      ? transferFeeAmount / 2
      : transferFeeAmount;
  const recipientFeeShare = roundCurrency(transferFeeAmount - payerFeeShare);
  return {
    transferFeeAmount,
    transferFeeCurrency: currency,
    actualPaidAmount: roundCurrency(amount + payerFeeShare),
    actualPaidCurrency: currency,
    recipientReceivedAmount: roundCurrency(Math.max(0, amount - recipientFeeShare)),
    recipientReceivedCurrency: currency,
    postTransactionBalance: roundCurrency(
      prototypeFundingAccountOpeningBalance({ provider, currency }) - amount - payerFeeShare,
    ),
    postTransactionBalanceCurrency: currency,
  };
};
