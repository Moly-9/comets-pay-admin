import type { GeneratedInvoiceRecord, InvoiceDocumentModel, InvoiceLineItem } from '../types';
import { invoiceDocumentFilename } from '../documentFilenames';

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

export const INVOICE_NUMBER_PATTERN = /^INV-(\d{8})-(\d{5})$/;
export const INVOICE_DAILY_SEQUENCE_LIMIT = 99_999;

export const invoiceDatePart = (invoiceDate: string | Date) => {
  const value = invoiceDate instanceof Date ? todayInputValue(invoiceDate) : invoiceDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Invoice 日期无效，无法分配 Invoice 编号。');
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime()) || todayInputValue(parsed) !== value) {
    throw new Error('Invoice 日期无效，无法分配 Invoice 编号。');
  }
  return value.replace(/-/g, '');
};

export const formatInvoiceNumber = (invoiceDate: string | Date, sequence: number) => {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > INVOICE_DAILY_SEQUENCE_LIMIT) {
    throw new Error('Invoice 单日流水号必须在 00001–99999 之间。');
  }
  return `INV-${invoiceDatePart(invoiceDate)}-${String(sequence).padStart(5, '0')}`;
};

export const parseInvoiceNumber = (value: string) => {
  const match = INVOICE_NUMBER_PATTERN.exec(value.trim());
  if (!match) return null;
  const sequence = Number(match[2]);
  if (sequence < 1 || sequence > INVOICE_DAILY_SEQUENCE_LIMIT) return null;
  return {
    invoiceDate: `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}`,
    sequence,
  };
};

export const nextInvoiceNumber = (
  records: GeneratedInvoiceRecord[],
  invoiceDate: string | Date = todayInputValue(),
  reservedNumbers: string[] = [],
) => {
  const datePart = invoiceDatePart(invoiceDate);
  const prefix = `INV-${datePart}-`;
  const recordMaxSequence = records.reduce((max, record) => {
    const sequence = [record.snapshot?.invoiceNumber, record.id].reduce((recordMax, value) => {
      if (!value?.startsWith(prefix)) return recordMax;
      const suffix = value.slice(prefix.length);
      if (!/^\d+$/.test(suffix)) return recordMax;
      return Math.max(recordMax, Number(suffix));
    }, 0);
    return Math.max(max, sequence);
  }, 0);
  const reservedMaxSequence = reservedNumbers.reduce((max, value) => {
    if (!value.startsWith(prefix)) return max;
    const suffix = value.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) return max;
    return Math.max(max, Number(suffix));
  }, 0);
  return formatInvoiceNumber(
    invoiceDate instanceof Date ? invoiceDate : invoiceDate,
    Math.max(recordMaxSequence, reservedMaxSequence) + 1,
  );
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
  return invoiceDocumentFilename(model, extension);
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
