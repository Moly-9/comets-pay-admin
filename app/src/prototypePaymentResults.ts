import type { Payout } from './types';

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const prototypePaymentResultFor = ({
  provider,
  currency,
  amount,
  feeBearer,
}: Pick<Payout, 'provider' | 'currency' | 'amount' | 'feeBearer'>): Pick<
  Payout,
  'transferFeeAmount' | 'transferFeeCurrency' | 'actualPaidAmount' | 'actualPaidCurrency'
> => {
  const rate = provider === 'PayPal' ? 0.03 : provider === 'PayMax' ? 0.008 : 0.002;
  const transferFeeAmount = roundCurrency(Math.max(1, amount * rate));
  const payerFeeShare = feeBearer === 'PUBLISHER'
    ? 0
    : feeBearer === 'SHARED'
      ? transferFeeAmount / 2
      : transferFeeAmount;
  return {
    transferFeeAmount,
    transferFeeCurrency: currency,
    actualPaidAmount: roundCurrency(amount + payerFeeShare),
    actualPaidCurrency: currency,
  };
};
