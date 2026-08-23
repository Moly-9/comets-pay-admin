import type {
  GeneratedInvoiceRecord,
  InvoiceDocumentModel,
  InvoicePaymentFreezeSnapshot,
  Provider,
} from './types';
import type { InvoiceId } from './businessWorkflow';

export type InvoicePaymentFreezeActor = {
  account: string;
  name: string;
  role: string;
};

const clonePayment = (snapshot: InvoiceDocumentModel) => ({
  ...(snapshot.payment ?? {}),
  schemaFields: snapshot.payment?.schemaFields?.map((field) => ({ ...field })),
  schemaValues: snapshot.payment?.schemaValues ? { ...snapshot.payment.schemaValues } : undefined,
});

const invoiceProvider = (snapshot: InvoiceDocumentModel): Exclude<Provider, '手动打款'> => (
  snapshot.payoutProvider
  ?? snapshot.payment?.payoutProvider
  ?? (snapshot.paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex')
);

export const createInvoicePaymentFreezeSnapshot = ({
  invoiceId,
  invoiceVersion,
  snapshot,
  actor,
  freezeStage,
  frozenAt,
}: {
  invoiceId: InvoiceId;
  invoiceVersion: number;
  snapshot: InvoiceDocumentModel;
  actor: InvoicePaymentFreezeActor;
  freezeStage: InvoicePaymentFreezeSnapshot['freezeStage'];
  frozenAt: string;
}): InvoicePaymentFreezeSnapshot => ({
  invoiceId,
  invoiceVersion,
  creatorId: snapshot.creatorId,
  currency: snapshot.currency,
  amount: (snapshot.items ?? []).reduce((total, item) => total + item.lineTotal, 0),
  payoutAccountId: snapshot.payoutAccountId ?? snapshot.payment?.payoutAccountId,
  payoutAccountVersion: snapshot.payoutAccountVersion ?? snapshot.payment?.payoutAccountVersion,
  payoutAccountFingerprint: snapshot.payoutAccountFingerprint ?? snapshot.payment?.accountFingerprint,
  payoutProvider: invoiceProvider(snapshot),
  paymentMethod: snapshot.paymentMethod,
  payment: clonePayment(snapshot),
  frozenAt,
  frozenByAccount: actor.account,
  frozenByName: actor.name,
  frozenByRole: actor.role,
  freezeStage,
});

export const invoicePaymentFreezeSnapshot = (
  invoice: GeneratedInvoiceRecord,
): InvoicePaymentFreezeSnapshot => invoice.paymentFreezeSnapshot
  ?? createInvoicePaymentFreezeSnapshot({
    invoiceId: invoice.invoiceId,
    invoiceVersion: invoice.version ?? 1,
    snapshot: invoice.snapshot,
    actor: { account: 'prototype-migration', name: '历史数据迁移', role: '系统' },
    freezeStage: 'HISTORICAL_MIGRATION',
    frozenAt: invoice.generatedAt,
  });
