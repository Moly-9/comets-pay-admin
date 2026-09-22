import { prototypePaymentResultFor } from './prototypePaymentResults';
import type { InvoiceCurrency, Payout } from './types';
import type { PaymentFeeBearer } from './paymentFeeBearerPresentation';

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const DEFAULT_BATCH_FEE_BEARER: PaymentFeeBearer = 'PUBLISHER';

export const PAYMENT_FEE_BEARER_OPTIONS: ReadonlyArray<{
  value: PaymentFeeBearer;
  label: string;
}> = [
  { value: 'PUBLISHER', label: '对方承担' },
  { value: 'ADVERTISER', label: '我方承担' },
  { value: 'SHARED', label: '共同承担' },
];

export type PaymentPreview = Readonly<{
  payoutId: string;
  feeBearer: PaymentFeeBearer;
  requestedAmount: number;
  requestedCurrency: InvoiceCurrency;
  channelFeeAmount: number;
  channelFeeCurrency: InvoiceCurrency;
  payerFeeAmount: number;
  payerFeeCurrency: InvoiceCurrency;
  actualPaidAmount: number;
  actualPaidCurrency: InvoiceCurrency;
  recipientReceivedAmount: number;
  recipientReceivedCurrency: string;
}>;

export const paymentPreviewFor = ({
  payout,
  receiveCurrency = payout.currency,
  feeBearer,
}: {
  payout: Pick<Payout, 'id' | 'provider' | 'amount' | 'currency'>;
  receiveCurrency?: string;
  feeBearer: PaymentFeeBearer;
}): PaymentPreview => {
  const result = prototypePaymentResultFor({
    ...payout,
    feeBearer,
    receiveCurrency: receiveCurrency as InvoiceCurrency,
  });
  const channelFeeAmount = result.transferFeeAmount ?? 0;
  const channelFeeCurrency = result.transferFeeCurrency ?? payout.currency;
  const actualPaidAmount = result.actualPaidAmount ?? payout.amount;
  const actualPaidCurrency = result.actualPaidCurrency ?? payout.currency;
  return {
    payoutId: payout.id,
    feeBearer,
    requestedAmount: payout.amount,
    requestedCurrency: payout.currency,
    channelFeeAmount,
    channelFeeCurrency,
    payerFeeAmount: roundCurrency(Math.max(0, actualPaidAmount - payout.amount)),
    payerFeeCurrency: actualPaidCurrency,
    actualPaidAmount,
    actualPaidCurrency,
    recipientReceivedAmount: result.recipientReceivedAmount ?? payout.amount,
    recipientReceivedCurrency: result.recipientReceivedCurrency ?? receiveCurrency,
  };
};

export const paymentPreviewActualPaidTotals = (
  previews: readonly PaymentPreview[],
) => [...previews.reduce<Map<InvoiceCurrency, number>>((totals, preview) => {
  totals.set(
    preview.actualPaidCurrency,
    roundCurrency((totals.get(preview.actualPaidCurrency) ?? 0) + preview.actualPaidAmount),
  );
  return totals;
}, new Map()).entries()].map(([currency, amount]) => ({ currency, amount }));

export const formatPaymentPreviewMoney = (
  currency: string,
  amount: number,
) => `${currency} ${amount.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;
