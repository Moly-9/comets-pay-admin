import { describe, expect, it } from 'vitest';
import type { GeneratedInvoiceRecord } from '../types';
import { nextInvoiceNumber } from './invoiceUtils';

const invoiceRecord = (id: string, invoiceNumber = id) => ({
  id,
  snapshot: { invoiceNumber },
} as GeneratedInvoiceRecord);

describe('nextInvoiceNumber', () => {
  const currentDay = new Date(2026, 7, 20, 12, 0, 0);

  it('starts each day with a five-digit sequence', () => {
    expect(nextInvoiceNumber([], currentDay)).toBe('INV-20260820-00001');
  });

  it('continues from the highest same-day snapshot or record number', () => {
    const records = [
      invoiceRecord('generated-random-id', 'INV-20260820-00008'),
      invoiceRecord('INV-20260820-00012'),
      invoiceRecord('INV-20260819-99999'),
    ];

    expect(nextInvoiceNumber(records, currentDay)).toBe('INV-20260820-00013');
  });

  it('ignores other dates and malformed suffixes', () => {
    const records = [
      invoiceRecord('INV-20260819-00042'),
      invoiceRecord('INV-20260820-DRAFT'),
    ];

    expect(nextInvoiceNumber(records, currentDay)).toBe('INV-20260820-00001');
  });
});
