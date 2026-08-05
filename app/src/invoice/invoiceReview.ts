import { invoicePaymentForCreator } from '../payoutAccounts';
import type { ProjectId } from '../businessWorkflow';
import type {
  CreatorInvoiceContact,
  CreatorProfile,
  InvoiceDocumentModel,
  InvoiceEntity,
  Payout,
} from '../types';

const FALLBACK_CONTACT: CreatorInvoiceContact = {
  legalName: '',
  address: '',
  phone: '',
  email: '',
};

const CONTRACT_IO_REFERENCES: Record<string, string> = {
  'CON-260718-01': 'IO-260718-SB-01',
  'CON-260714-03': 'IO-260714-NL-03',
  'CON-260625-06': 'IO-260625-AM-06',
};

const invoiceDateFromNumber = (invoiceNumber: string) => {
  const match = invoiceNumber.match(/(\d{2})(\d{2})$/);
  return match ? `2026-${match[1]}-${match[2]}` : '2026-07-18';
};

export const getInvoiceContractReference = (payout: Payout) => {
  return {
    contractId: payout.contract,
    ioId: CONTRACT_IO_REFERENCES[payout.contract] ?? payout.contract.replace(/^CON-/, 'IO-'),
  };
};

export const buildInvoiceReviewModel = (
  payout: Payout,
  creators: CreatorProfile[],
  billTo: InvoiceEntity,
): InvoiceDocumentModel => {
  const creator = creators.find((item) => item.handle === payout.handle) ?? null;
  const paymentMethod = payout.provider === 'PayPal' ? 'paypal' : 'bank';
  const payment = invoicePaymentForCreator(creator, payout.provider);
  const fallbackName = payout.creator.replace(/^@/, '');
  const from = creator?.contact ?? {
    ...FALLBACK_CONTACT,
    legalName: fallbackName,
    email: payout.provider === 'PayPal' && payout.account.includes('@') ? payout.account : '',
  };

  return {
    invoiceNumber: payout.invoice,
    invoiceDate: invoiceDateFromNumber(payout.invoice),
    billTo: { ...billTo },
    creatorHandle: payout.handle,
    creatorName: creator?.name ?? fallbackName,
    projectId: payout.projectId as ProjectId,
    projectName: payout.project,
    from: { ...from },
    currency: payout.currency,
    items: [{
      id: `line-${payout.id}`,
      description: payout.deliverable ?? `${payout.project} 达人合作服务费`,
      unitPrice: payout.amount,
      quantity: 1,
      lineTotal: payout.amount,
    }],
    payoutAccountId: payment.payoutAccountId,
    payoutAccountVersion: payment.payoutAccountVersion,
    payoutProvider: payment.payoutProvider,
    payoutAccountFingerprint: payment.accountFingerprint,
    paymentMethod,
    payment: { ...payment },
  };
};

export const invoiceAccountSummary = (model: InvoiceDocumentModel) => {
  if (model.paymentMethod === 'paypal') {
    return model.payment.paypalEmail || model.payment.paypalUsername || '待补充';
  }
  const accountValue = model.payment.accountNumber || model.payment.iban;
  if (!accountValue) return '待补充';
  const normalized = accountValue.replace(/\s/g, '');
  return `•••• ${normalized.slice(-4)}`;
};
