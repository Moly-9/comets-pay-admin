import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  BatchesPage,
  PAYMENT_CONFIRMATION_FILENAME,
  correctedPaymentBatchDateRange,
  createBatchConfirmationArchive,
  filterPaymentBatchRows,
  paymentBatchExportAvailability,
  paymentBatchCurrentRequestStatus,
  paymentBatchRows,
  toggleVisiblePaymentBatchSelection,
} from './OperationalPages';
import type { PaymentBatchRecord } from '../paymentBatches';
import type { Payout } from '../types';
import type { RequestProjectSummary } from './RequestProjectDetailPage';

const createTestBatch = (
  paymentBatchCode: string,
  provider: PaymentBatchRecord['provider'],
  paidAt: string,
): PaymentBatchRecord => ({
  paymentBatchId: `payment_batch_${paymentBatchCode}` as PaymentBatchRecord['paymentBatchId'],
  paymentBatchCode,
  purpose: 'NORMAL',
  paymentOrderCode: 'PAY-TEST-001',
  paymentAttemptNumber: 1,
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
  fundingAccountId: provider === 'Airwallex'
    ? 'mock-awx-operating'
    : provider === 'PayMax'
      ? 'mock-paymax-operating'
      : 'mock-paypal-balance',
  sourceCurrency: 'USD',
  payer: '付款测试员',
  paidAt,
  status: '已付款',
  lifecycle: ['CREATED', 'SUBMITTED', 'COMPLETED'],
  items: [{
    payoutId: `${paymentBatchCode}-item`,
    creatorName: '测试达人',
    creatorHandle: '@test',
    deliverable: '测试交付',
    paymentListCode: 'PAY-TEST-001',
    paymentListStatus: 'paid',
    paymentOrderCode: 'PAY-TEST-001',
    paymentAttemptNumber: 1,
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
    transferFeeAmount: 2.5,
    transferFeeCurrency: 'USD',
    actualPaidAmount: 1002.5,
    actualPaidCurrency: 'USD',
    associationIssues: [],
  }],
});

const TEST_BATCHES = [
  createTestBatch('BAT-20260716-007', 'Airwallex', '2026-07-16T16:42'),
  createTestBatch('BAT-20260715-006', 'PayPal', '2026-07-15T11:20'),
  createTestBatch('BAT-20260714-005', 'PayMax', '2026-07-14T09:18'),
];
const TEST_BATCH_ROWS = paymentBatchRows(TEST_BATCHES);

describe('payment batch filters and selection', () => {
  it('combines batch code, inclusive minute range and provider filters', () => {
    expect(filterPaymentBatchRows(TEST_BATCH_ROWS, {
      search: '0716-007',
      start: '2026-07-16T16:42',
      end: '2026-07-16T16:42',
      provider: 'Airwallex',
      status: '已付款',
    }).map((row) => row.id)).toEqual(['BAT-20260716-007']);

    expect(filterPaymentBatchRows(TEST_BATCH_ROWS, {
      search: '007',
      start: '',
      end: '2026-07-16T16:41',
      provider: 'Airwallex',
    })).toEqual([]);

    const purposeRows = TEST_BATCH_ROWS.map((row, index) => ({
      ...row,
      purpose: index === 0 ? 'RETRY' as const : row.purpose,
    }));
    expect(filterPaymentBatchRows(purposeRows, {
      search: '',
      start: '',
      end: '',
      provider: 'all',
      purpose: 'RETRY',
      status: '已付款',
    }).map((row) => row.id)).toEqual(['BAT-20260716-007']);
  });

  it('auto-corrects crossed date ranges from the boundary the user changed', () => {
    expect(correctedPaymentBatchDateRange('2026-07-17T09:30', '2026-07-16T09:30', 'start'))
      .toEqual(['2026-07-17T09:30', '2026-07-17T09:30']);
    expect(correctedPaymentBatchDateRange('2026-07-17T09:30', '2026-07-16T09:30', 'end'))
      .toEqual(['2026-07-16T09:30', '2026-07-16T09:30']);
  });

  it('selects all visible providers and preserves hidden selections', () => {
    const initial = new Set(['BAT-HIDDEN']);
    const selected = toggleVisiblePaymentBatchSelection(initial, TEST_BATCH_ROWS);
    expect([...selected].sort()).toEqual([
      'BAT-20260714-005',
      'BAT-20260715-006',
      'BAT-20260716-007',
      'BAT-HIDDEN',
    ]);
    expect(toggleVisiblePaymentBatchSelection(selected, TEST_BATCH_ROWS))
      .toEqual(new Set(['BAT-HIDDEN']));
  });

  it('enables payment data for every provider while keeping confirmations Airwallex-only', () => {
    expect(paymentBatchExportAvailability(TEST_BATCH_ROWS.slice(1))).toEqual({
      confirmations: false,
      records: true,
    });
    expect(paymentBatchExportAvailability(TEST_BATCH_ROWS)).toEqual({
      confirmations: true,
      records: true,
    });
    expect(paymentBatchExportAvailability([])).toEqual({
      confirmations: false,
      records: false,
    });
  });

  it('renders filters, linked projects, financial columns and independent export buttons', () => {
    const html = renderToStaticMarkup(
      <BatchesPage batches={TEST_BATCHES} onNewBatch={vi.fn()} notify={vi.fn()} canCreateBatch />,
    );
    expect(html.match(/type="datetime-local"/g)).toHaveLength(2);
    expect(html).toContain('全部付款渠道');
    expect(html).toContain('aria-label="批次用途筛选"');
    expect(html).toContain('>全部批次用途</span>');
    expect(html).toContain('aria-label="付款状态筛选"');
    expect(html).toContain('>全部付款状态</span>');
    expect(html).toContain('付款人 / 时间');
    expect(html).not.toContain('创建人 / 时间');
    expect(html).toContain('<th>批次号</th><th>批次用途</th><th>请款项目编号</th><th>付款渠道</th><th>付款主体</th><th>项目名称</th><th>请款金额及币种</th>');
    expect(html).toContain('<td class="payment-batch-project-cell" title="测试项目"><strong>测试项目</strong></td>');
    expect(html).toContain('<th class="payment-batch-status-cell">付款状态</th>');
    expect(html).toContain('<th class="action-cell payment-batch-action-cell">操作</th>');
    expect(html).toContain('aria-label="付款批次导出"');
    expect(html).toContain('payment-batch-export-button is-confirmation');
    expect(html).toContain('payment-batch-export-button is-record');
    expect(html).toContain('导出确认函');
    expect(html).toContain('导出付款明细');
    expect(html).not.toContain('aria-label="批次导出选项"');
    expect(html).toContain('已付款批次');
    expect(html).toContain('aria-label="选择付款批次 BAT-20260715-006"');
    expect(html).toContain('aria-label="选择付款批次 BAT-20260714-005"');
    expect(html).not.toContain('不支持确认函导出');

    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    expect(css).toContain('.payment-batch-table :is(th, td).payment-batch-status-cell');
    expect(css).toContain('right: 132px');
    expect(css).toContain('.payment-batch-table :is(th, td).payment-batch-action-cell');
    expect(css).toMatch(/\.payment-batch-export-button\.is-confirmation:not\(:disabled\)[\s\S]*?color: #2f333a/);
    expect(css).toMatch(/\.payment-batch-export-button\.is-record:not\(:disabled\)[\s\S]*?color: #2f333a/);
  });

  it('keeps the batch list status frozen when the live payout changes', () => {
    const batch = createTestBatch('BAT-LIVE-001', 'Airwallex', '2026-08-11T10:00');
    const basePayout = {
      id: batch.items[0].payoutId,
      status: '已付款',
    } as Payout;

    expect(paymentBatchRows([{ ...batch, status: '部分失败' }])[0].status).toBe('部分失败');
    expect(paymentBatchRows([batch])[0].status).toBe(batch.status);
    expect(basePayout.status).toBe('已付款');
  });

  it('exposes the source batch for reversal rows', () => {
    const source = TEST_BATCHES[0];
    const reversal = {
      ...source,
      paymentBatchId: 'payment_batch_reversal_test' as PaymentBatchRecord['paymentBatchId'],
      paymentBatchCode: 'BAT-REVERSAL-TEST',
      purpose: 'REVERSAL' as const,
      sourcePaymentBatchId: source.paymentBatchId,
      sourcePaymentBatchCode: source.paymentBatchCode,
    };

    expect(paymentBatchRows([reversal])[0]).toMatchObject({
      purpose: 'REVERSAL',
      sourcePaymentBatchCode: source.paymentBatchCode,
    });

    const html = renderToStaticMarkup(
      <BatchesPage batches={[reversal]} onNewBatch={vi.fn()} notify={vi.fn()} canCreateBatch />,
    );
    expect(html).toContain('>冲退付款</span><small class="cell-subtext" title="BAT-20260716-007">来源批次 BAT-20260716-007</small>');
  });

  it('exports the current request-project status with a frozen snapshot fallback', () => {
    const source = TEST_BATCHES[0];
    const currentRequest = {
      id: 'request_test',
      paymentRequestProjectId: source.request.paymentRequestProjectId,
      lifecycle: 'COMPLETED',
      status: '已完成',
    } as RequestProjectSummary;

    expect(paymentBatchCurrentRequestStatus(source, [currentRequest], [])).toBe('已付款');
    expect(paymentBatchCurrentRequestStatus(source, [], [])).toBe('待打款');
  });

  it('summarizes only the current batch attempt and marks processing results as pending', () => {
    expect(TEST_BATCH_ROWS[0]).toMatchObject({
      purpose: 'NORMAL',
      requestCode: 'REQ-TEST-001',
      projectName: '测试项目',
      paymentAmount: 'USD 1,000',
      transferFeeAmount: 'USD 2.5',
      actualPaidAmount: 'USD 1,002.5',
    });
    const processingBatch = createTestBatch('BAT-PROCESSING', 'Airwallex', '2026-08-12T10:00');
    const processingRow = paymentBatchRows([{
      ...processingBatch,
      status: '付款处理中',
      items: processingBatch.items.map((item) => ({
        ...item,
        paymentStatus: '付款处理中',
        transferFeeAmount: undefined,
        transferFeeCurrency: undefined,
        actualPaidAmount: undefined,
        actualPaidCurrency: undefined,
      })),
    }])[0];
    expect(processingRow.transferFeeAmount).toBe('待渠道回写');
    expect(processingRow.actualPaidAmount).toBe('待渠道回写');
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
});
