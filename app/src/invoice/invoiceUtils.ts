import type { GeneratedInvoiceRecord, InvoiceDocumentModel, InvoiceLineItem } from '../types';

export const calculateLineTotal = (unitPrice: number, quantity: number) => {
  const safePrice = Number.isFinite(unitPrice) ? unitPrice : 0;
  const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
  return Math.round(safePrice * safeQuantity * 100) / 100;
};

export const normalizeLineItem = (item: Omit<InvoiceLineItem, 'lineTotal'> | InvoiceLineItem): InvoiceLineItem => ({
  ...item,
  lineTotal: calculateLineTotal(item.unitPrice, item.quantity),
});

export const invoiceTotal = (model: Pick<InvoiceDocumentModel, 'items'>) => (
  Math.round(model.items.reduce((total, item) => total + calculateLineTotal(item.unitPrice, item.quantity), 0) * 100) / 100
);

export const formatInvoiceMoney = (currency: string, amount: number) => (
  `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
);

export const formatInvoiceDate = (date: string) => {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
};

export const todayInputValue = (now = new Date()) => {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export const nextInvoiceNumber = (records: GeneratedInvoiceRecord[], now = new Date()) => {
  const datePart = todayInputValue(now).replace(/-/g, '');
  const prefix = `INV-${datePart}-`;
  const maxSequence = records.reduce((max, record) => {
    if (!record.id.startsWith(prefix)) return max;
    const sequence = Number(record.id.slice(prefix.length));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return `${prefix}${String(maxSequence + 1).padStart(3, '0')}`;
};

export const bankAddress = (model: Pick<InvoiceDocumentModel, 'payment'>) => (
  [
    model.payment.bankStreetAddress,
    model.payment.bankCity,
    model.payment.bankState,
    model.payment.bankPostalCode,
    model.payment.bankCountry,
  ].filter(Boolean).join(', ')
);

export const invoiceFilename = (model: InvoiceDocumentModel, extension: 'pdf' | 'docx') => {
  const safeName = model.creatorName.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
  return `${model.invoiceNumber}-${safeName || 'creator'}.${extension}`;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};
