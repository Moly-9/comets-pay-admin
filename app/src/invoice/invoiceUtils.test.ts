import { describe, expect, it } from 'vitest';
import type { GeneratedInvoiceRecord } from '../types';
import {
  formatInvoiceNumber,
  nextInvoiceNumber,
  parseInvoiceNumber,
} from './invoiceUtils';

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

  it('uses the explicit Date of Invoice and resets the sequence across dates', () => {
    const records = [invoiceRecord('INV-20260820-00008')];
    expect(nextInvoiceNumber(records, '2026-08-21')).toBe('INV-20260821-00001');
    expect(nextInvoiceNumber(records, '2026-08-20')).toBe('INV-20260820-00009');
  });

  it('parses only the canonical five-digit business number', () => {
    expect(parseInvoiceNumber('INV-20260820-00001')).toEqual({
      invoiceDate: '2026-08-20',
      sequence: 1,
    });
    expect(parseInvoiceNumber('INV-20260820-001')).toBeNull();
    expect(parseInvoiceNumber('INV-20260820-00000')).toBeNull();
    expect(parseInvoiceNumber('INV-240718')).toBeNull();
  });

  it('blocks an invalid date and a daily sequence overflow', () => {
    expect(() => formatInvoiceNumber('2026-02-30', 1)).toThrow('Invoice 日期无效');
    expect(() => nextInvoiceNumber([
      invoiceRecord('INV-20260820-99999'),
    ], '2026-08-20')).toThrow('00001–99999');
  });
});
