import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  BatchesPage,
  PAYMENT_CONFIRMATION_FILENAME,
  correctedPaymentBatchDateRange,
  createBatchConfirmationArchive,
  filterPaymentBatchRows,
  loadPaymentDataRecord,
  paymentBatchRows,
  toggleVisibleAirwallexBatchSelection,
} from './OperationalPages';
import type { PaymentBatchRecord } from '../paymentBatches';

const createTestBatch = (
  paymentBatchCode: string,
  provider: PaymentBatchRecord['provider'],
  paidAt: string,
): PaymentBatchRecord => ({
  paymentBatchId: `payment_batch_${paymentBatchCode}` as PaymentBatchRecord['paymentBatchId'],
  paymentBatchCode,
  request: {
    paymentRequestProjectId: 'request_test' as PaymentBatchRecord['request']['paymentRequestProjectId'],
    requestCode: 'REQ-TEST-001',
    requestStatus: '待打款',
    lifecycle: 'APPROVED',
    amount: 'USD 1,000',
    reason: '达人合作费用',
    expectedPaymentDate: '2026-07-16',
    cooperationProjectId: 'project_test' as PaymentBatchRecord['request']['cooperationProjectId'],
    cooperationProjectCode: 'PRJ-TEST-001',
    cooperationProjectName: '测试项目',
    brand: '测试品牌',
    media: '测试媒介',
    pm: '测试 PM',
  },
  provider,
  fundingAccountId: provider === 'Airwallex' ? 'mock-awx-operating' : 'mock-paypal-balance',
  sourceCurrency: 'USD',
  payer: '付款测试员',
  paidAt,
  status: '已完成',
  lifecycle: ['CREATED', 'SUBMITTED', 'COMPLETED'],
  items: [{
    payoutId: `${paymentBatchCode}-item`,
    creatorName: '测试达人',
    creatorHandle: '@test',
    deliverable: '测试交付',
    paymentListCode: 'PAY-TEST-001',
    paymentListStatus: 'paid',
    contracts: [],
    provider,
    amount: 1000,
    currency: 'USD',
    receiveCurrency: 'USD',
    transferMethod: provider,
    accountSummary: provider === 'PayPal' ? 'te***@example.com' : '•••• 1234',
    payoutAccountVersion: 'v1',
    feeBearer: '广告主承担',
    paymentReason: '达人合作费用',
    transactionReference: 'TEST-001',
    description: '测试交付',
    paymentStatus: '已付款',
    associationIssues: [],
  }],
});

const TEST_BATCHES = [
  createTestBatch('BAT-20260716-007', 'Airwallex', '2026-07-16T16:42'),
  createTestBatch('BAT-20260715-006', 'PayPal', '2026-07-15T11:20'),
];
const TEST_BATCH_ROWS = paymentBatchRows(TEST_BATCHES);

describe('payment batch filters and selection', () => {
  it('combines batch code, inclusive minute range and provider filters', () => {
    expect(filterPaymentBatchRows(TEST_BATCH_ROWS, {
      search: '0716-007',
      start: '2026-07-16T16:42',
      end: '2026-07-16T16:42',
      provider: 'Airwallex',
    }).map((row) => row.id)).toEqual(['BAT-20260716-007']);

    expect(filterPaymentBatchRows(TEST_BATCH_ROWS, {
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
    const selected = toggleVisibleAirwallexBatchSelection(initial, TEST_BATCH_ROWS);
    expect([...selected].sort()).toEqual(['BAT-20260716-007', 'BAT-HIDDEN-AIRWALLEX']);
    expect(toggleVisibleAirwallexBatchSelection(selected, TEST_BATCH_ROWS))
      .toEqual(new Set(['BAT-HIDDEN-AIRWALLEX']));
  });

  it('renders minute filters, Airwallex-only selection and the renamed payer column', () => {
    const html = renderToStaticMarkup(
      <BatchesPage batches={TEST_BATCHES} onNewBatch={vi.fn()} notify={vi.fn()} canCreateBatch />,
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
