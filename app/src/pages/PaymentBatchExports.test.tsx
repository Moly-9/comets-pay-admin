import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  BASE_BATCHES,
  BatchesPage,
  PAYMENT_CONFIRMATION_FILENAME,
  correctedPaymentBatchDateRange,
  createBatchConfirmationArchive,
  filterPaymentBatchRows,
  loadPaymentDataRecord,
  toggleVisibleAirwallexBatchSelection,
} from './OperationalPages';

describe('payment batch filters and selection', () => {
  it('combines batch code, inclusive minute range and provider filters', () => {
    expect(filterPaymentBatchRows(BASE_BATCHES, {
      search: '0716-007',
      start: '2026-07-16T16:42',
      end: '2026-07-16T16:42',
      provider: 'Airwallex',
    }).map((row) => row.id)).toEqual(['BAT-20260716-007']);

    expect(filterPaymentBatchRows(BASE_BATCHES, {
      search: '007',
      start: '',
      end: '2026-07-16T16:41',
      provider: 'Airwallex',
    })).toEqual([]);
  });

  it('auto-corrects crossed date ranges from the boundary the user changed', () => {
    expect(correctedPaymentBatchDateRange('2026-07-17T09:30', '2026-07-16T09:30', 'start'))
      .toEqual(['2026-07-17T09:30', '2026-07-17T09:30']);
    expect(correctedPaymentBatchDateRange('2026-07-17T09:30', '2026-07-16T09:30', 'end'))
      .toEqual(['2026-07-16T09:30', '2026-07-16T09:30']);
  });

  it('selects only visible Airwallex rows and preserves hidden selections', () => {
    const initial = new Set(['BAT-HIDDEN-AIRWALLEX']);
    const selected = toggleVisibleAirwallexBatchSelection(initial, BASE_BATCHES);
    expect([...selected].sort()).toEqual(['BAT-20260716-007', 'BAT-HIDDEN-AIRWALLEX']);
    expect(toggleVisibleAirwallexBatchSelection(selected, BASE_BATCHES))
      .toEqual(new Set(['BAT-HIDDEN-AIRWALLEX']));
  });

  it('renders minute filters, Airwallex-only selection and the renamed payer column', () => {
    const html = renderToStaticMarkup(
      <BatchesPage createdBatch={null} onNewBatch={vi.fn()} notify={vi.fn()} canCreateBatch />,
    );
    expect(html.match(/type="datetime-local"/g)).toHaveLength(2);
    expect(html).toContain('全部付款渠道');
    expect(html).toContain('付款人 / 付款时间');
    expect(html).not.toContain('创建人 / 时间');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-label="BAT-20260715-006 不支持确认函导出"');
  });
});

describe('payment batch export assets', () => {
  it('creates one batch folder and byte-identical PDF per selected batch', async () => {
    const source = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
    const loader = vi.fn(async () => new Blob([source], { type: 'application/pdf' }));
    const archiveBlob = await createBatchConfirmationArchive(
      ['BAT-ONE', 'BAT-TWO'],
      loader,
    );
    const archive = await JSZip.loadAsync(await archiveBlob.arrayBuffer());

    expect(loader).toHaveBeenCalledTimes(1);
    expect(Object.keys(archive.files).sort()).toEqual([
      'BAT-ONE/',
      `BAT-ONE/${PAYMENT_CONFIRMATION_FILENAME}`,
      'BAT-TWO/',
      `BAT-TWO/${PAYMENT_CONFIRMATION_FILENAME}`,
    ]);
    await Promise.all(['BAT-ONE', 'BAT-TWO'].map(async (batchId) => {
      const bytes = await archive.file(`${batchId}/${PAYMENT_CONFIRMATION_FILENAME}`)?.async('uint8array');
      expect(bytes).toEqual(source);
    }));
  });

  it('loads the original Excel exactly once without wrapping it in a ZIP', async () => {
    const source = new Uint8Array([80, 75, 3, 4, 88, 76, 83, 88]);
    const loader = vi.fn(async () => new Blob([source], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }));
    const workbook = await loadPaymentDataRecord(loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(new Uint8Array(await workbook.arrayBuffer())).toEqual(source);
  });
});
