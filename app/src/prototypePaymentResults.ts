import type { InvoiceCurrency, Payout } from './types';

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const PROTOTYPE_USD_VALUE_BY_CURRENCY: Readonly<Record<InvoiceCurrency, number>> = {
  USD: 1,
  EUR: 1.09,
  GBP: 1.27,
  HKD: 0.128,
  SGD: 0.74,
};

export const prototypeConvertCurrency = (
  amount: number,
  sourceCurrency: InvoiceCurrency,
  targetCurrency: InvoiceCurrency,
) => roundCurrency(
  sourceCurrency === targetCurrency
    ? amount
    : amount
      * PROTOTYPE_USD_VALUE_BY_CURRENCY[sourceCurrency]
      / PROTOTYPE_USD_VALUE_BY_CURRENCY[targetCurrency],
);

const recipientFeeRatio = (feeBearer?: string) => {
  if (['PUBLISHER', '收款人承担', '收款方承担', '对方承担'].includes(feeBearer ?? '')) return 1;
  if (['SHARED', '共同承担', '双方共同承担'].includes(feeBearer ?? '')) return 0.5;
  return 0;
};

export const prototypeRecipientReceivedAmountFor = ({
  amount,
  currency,
  receiveCurrency,
  feeBearer,
  transferFeeAmount,
  transferFeeCurrency,
}: {
  amount: number;
  currency: InvoiceCurrency;
  receiveCurrency: InvoiceCurrency;
  feeBearer?: string;
  transferFeeAmount?: number;
  transferFeeCurrency?: InvoiceCurrency;
}) => {
  const normalizedFee = transferFeeAmount === undefined
    ? 0
    : prototypeConvertCurrency(
        transferFeeAmount,
        transferFeeCurrency ?? currency,
        currency,
      );
  const recipientNetAmount = Math.max(0, amount - normalizedFee * recipientFeeRatio(feeBearer));
  return prototypeConvertCurrency(recipientNetAmount, currency, receiveCurrency);
};

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
  receiveCurrency = currency,
}: Pick<Payout, 'provider' | 'currency' | 'amount' | 'feeBearer'> & {
  receiveCurrency?: InvoiceCurrency;
}): Pick<
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
  return {
    transferFeeAmount,
    transferFeeCurrency: currency,
    actualPaidAmount: roundCurrency(amount + payerFeeShare),
    actualPaidCurrency: currency,
    recipientReceivedAmount: prototypeRecipientReceivedAmountFor({
      amount,
      currency,
      receiveCurrency,
      feeBearer,
      transferFeeAmount,
      transferFeeCurrency: currency,
    }),
    recipientReceivedCurrency: receiveCurrency,
    postTransactionBalance: roundCurrency(
      prototypeFundingAccountOpeningBalance({ provider, currency }) - amount - payerFeeShare,
    ),
    postTransactionBalanceCurrency: currency,
  };
};
