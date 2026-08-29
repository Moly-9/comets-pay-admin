import type { GeneratedInvoiceRecord, Payout } from '../types';

const snapshotHasSignature = (snapshot?: GeneratedInvoiceRecord['snapshot']) => Boolean(
  snapshot?.signatureText?.trim() || snapshot?.signatureDate?.trim(),
);

export const hasInvoiceSignatureEvidence = (
  payout?: Pick<Payout, 'invoiceSignedAt' | 'invoiceSnapshot'> | null,
  record?: Pick<GeneratedInvoiceRecord, 'snapshot'> | null,
) => Boolean(
  payout?.invoiceSignedAt
  || snapshotHasSignature(payout?.invoiceSnapshot)
  || snapshotHasSignature(record?.snapshot),
);
