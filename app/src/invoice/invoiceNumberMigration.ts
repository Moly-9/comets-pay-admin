import type { PaymentListRecord } from '../businessWorkflow';
import type { GeneratedInvoiceRecord, Payout } from '../types';
import {
  formatInvoiceNumber,
  parseInvoiceNumber,
  todayInputValue,
} from './invoiceUtils';

const validDate = (value: string | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) || todayInputValue(parsed) !== value ? null : value;
};

export const legacyInvoiceDate = (value: string | undefined) => {
  if (!value) return null;
  const canonical = parseInvoiceNumber(value);
  if (canonical) return validDate(canonical.invoiceDate);
  const eightDigit = /^INV-(\d{4})(\d{2})(\d{2})(?:-|$)/.exec(value);
  if (eightDigit) return validDate(`${eightDigit[1]}-${eightDigit[2]}-${eightDigit[3]}`);
  const sixDigit = /^INV-(\d{2})(\d{2})(\d{2})(?:-|$)/.exec(value);
  if (sixDigit) return validDate(`20${sixDigit[1]}-${sixDigit[2]}-${sixDigit[3]}`);
  return null;
};

const invoiceDateFor = (record: GeneratedInvoiceRecord) => (
  validDate(record.snapshot.invoiceDate)
  ?? legacyInvoiceDate(record.snapshot.invoiceNumber)
  ?? legacyInvoiceDate(record.id)
);

const payoutDateFor = (payout: Payout) => (
  validDate(payout.invoiceSnapshot?.invoiceDate)
  ?? legacyInvoiceDate(payout.invoiceSnapshot?.invoiceNumber)
  ?? legacyInvoiceDate(payout.invoice)
);

const migrateSnapshotNumber = <T extends { invoiceNumber: string }>(snapshot: T, invoiceNumber: string): T => ({
  ...snapshot,
  invoiceNumber,
});

export type NormalizedInvoiceResources = {
  invoices: GeneratedInvoiceRecord[];
  payouts: Payout[];
  paymentLists: PaymentListRecord[];
  invoiceNumberByInvoiceId: Map<string, string>;
  invoiceNumberBySourcePayoutId: Map<string, string>;
};

export const normalizeInvoiceResourceNumbers = ({
  invoices,
  payouts,
  paymentLists,
}: {
  invoices: GeneratedInvoiceRecord[];
  payouts: Payout[];
  paymentLists: PaymentListRecord[];
}): NormalizedInvoiceResources => {
  const recordByPayoutId = new Map(invoices.map((record) => [record.sourcePayoutId, record]));
  const entities = [
    ...invoices.map((record) => {
      const invoiceDate = invoiceDateFor(record);
      if (!invoiceDate) throw new Error(`Invoice fixture ${record.invoiceId} 缺少有效 Invoice 日期。`);
      return {
        key: `invoice:${record.invoiceId}`,
        invoiceDate,
        generatedAt: record.generatedAt,
        stableId: String(record.invoiceId),
        record,
        payout: undefined as Payout | undefined,
      };
    }),
    ...payouts.filter((payout) => !recordByPayoutId.has(payout.id)).map((payout) => {
      const invoiceDate = payoutDateFor(payout);
      if (!invoiceDate) throw new Error(`Payout fixture ${payout.id} 缺少可解析的 Invoice 日期。`);
      return {
        key: `payout:${payout.id}`,
        invoiceDate,
        generatedAt: payout.invoiceSignedAt ?? payout.paidAt ?? '',
        stableId: payout.id,
        record: undefined as GeneratedInvoiceRecord | undefined,
        payout,
      };
    }),
  ].sort((left, right) => (
    left.invoiceDate.localeCompare(right.invoiceDate)
    || left.generatedAt.localeCompare(right.generatedAt)
    || left.stableId.localeCompare(right.stableId)
  ));

  const dailySequence = new Map<string, number>();
  const numberByEntityKey = new Map<string, string>();
  entities.forEach((entity) => {
    const sequence = (dailySequence.get(entity.invoiceDate) ?? 0) + 1;
    dailySequence.set(entity.invoiceDate, sequence);
    numberByEntityKey.set(entity.key, formatInvoiceNumber(entity.invoiceDate, sequence));
  });

  const invoiceNumberByInvoiceId = new Map<string, string>();
  const invoiceNumberBySourcePayoutId = new Map<string, string>();
  const normalizedInvoices = invoices.map((record) => {
    const invoiceNumber = numberByEntityKey.get(`invoice:${record.invoiceId}`);
    if (!invoiceNumber) throw new Error(`Invoice fixture ${record.invoiceId} 未分配编号。`);
    invoiceNumberByInvoiceId.set(String(record.invoiceId), invoiceNumber);
    invoiceNumberBySourcePayoutId.set(record.sourcePayoutId, invoiceNumber);
    return {
      ...record,
      id: invoiceNumber,
      snapshot: migrateSnapshotNumber(record.snapshot, invoiceNumber),
      revisions: record.revisions?.map((revision) => ({
        ...revision,
        snapshot: migrateSnapshotNumber(revision.snapshot, invoiceNumber),
      })),
    };
  });

  const normalizedPayouts = payouts.map((payout) => {
    const invoiceNumber = invoiceNumberBySourcePayoutId.get(payout.id)
      ?? numberByEntityKey.get(`payout:${payout.id}`);
    if (!invoiceNumber) throw new Error(`Payout fixture ${payout.id} 未分配 Invoice 编号。`);
    return {
      ...payout,
      invoice: invoiceNumber,
      invoiceSnapshot: payout.invoiceSnapshot
        ? migrateSnapshotNumber(payout.invoiceSnapshot, invoiceNumber)
        : payout.invoiceSnapshot,
    };
  });

  const normalizePaymentList = (list: PaymentListRecord): PaymentListRecord => ({
    ...list,
    items: list.items.map((item) => ({
      ...item,
      snapshot: {
        ...item.snapshot,
        invoiceNumber: invoiceNumberByInvoiceId.get(String(item.invoiceId)) ?? item.snapshot.invoiceNumber,
      },
    })),
    versions: list.versions?.map((version) => ({
      ...version,
      items: version.items.map((item) => ({
        ...item,
        snapshot: {
          ...item.snapshot,
          invoiceNumber: invoiceNumberByInvoiceId.get(String(item.invoiceId)) ?? item.snapshot.invoiceNumber,
        },
      })),
    })),
  });

  return {
    invoices: normalizedInvoices,
    payouts: normalizedPayouts,
    paymentLists: paymentLists.map(normalizePaymentList),
    invoiceNumberByInvoiceId,
    invoiceNumberBySourcePayoutId,
  };
};
