import { describe, expect, it } from 'vitest';
import type { PaymentBatchItemSnapshot, PaymentBatchRecord } from './paymentBatches';
import {
  PAYMENT_BATCH_WORKBOOK_HEADERS,
  buildPaymentBatchWorkbookRows,
  createPaymentBatchWorkbook,
  paymentBatchDetailWorkbookFilename,
  paymentBatchWorkbookFilename,
} from './paymentBatchWorkbook';

const item = (overrides: Partial<PaymentBatchItemSnapshot> = {}): PaymentBatchItemSnapshot => ({
  payoutId: 'payout_export_1',
  creatorName: '测试达人',
  creatorHandle: '@creator',
  deliverable: '视频内容',
  paymentListCode: 'PAY-2608060001',
  paymentListStatus: 'paid',
  paymentOrderCode: 'PAY-2608060001',
  paymentAttemptNumber: 1,
  contracts: [],
  provider: 'Airwallex',
  amount: 1_000,
  currency: 'USD',
  receiveCurrency: 'USD',
  transferMethod: '本地转账',
  accountSummary: '•••• 1234',
  payoutAccountVersion: 'v1',
  feeBearer: '我方承担',
  paymentReason: '达人合作费用',
  transactionReference: 'EXPORT-001',
  description: '视频内容',
  paymentStatus: '已付款',
  paidAt: '2026-08-19T12:00',
  transferFeeAmount: 2.5,
  transferFeeCurrency: 'USD',
  actualPaidAmount: 1_002.5,
  actualPaidCurrency: 'USD',
  associationIssues: [],
  ...overrides,
});

const batch = (overrides: Partial<PaymentBatchRecord> = {}): PaymentBatchRecord => ({
  paymentBatchId: 'payment_batch_export' as PaymentBatchRecord['paymentBatchId'],
  paymentBatchCode: 'BAT-20260819-001',
  paymentOrderCode: 'PAY-2608190001',
  paymentAttemptNumber: 1,
  request: {
    paymentRequestProjectId: 'request_export' as PaymentBatchRecord['request']['paymentRequestProjectId'],
    requestCode: 'REQ-202608-000019',
    requestStatus: '待打款',
    lifecycle: 'APPROVED',
    amount: 'USD 1,000',
    reason: '达人合作费用',
    paymentEntity: 'Muse Commerce Limited',
    projectCostAttribution: '日本分公司',
    expectedPaymentDate: '2026-08-19',
    costType: '采购成本',
    costTypeDetail: '网红采买成本',
    cooperationProjectId: 'project_export' as PaymentBatchRecord['request']['cooperationProjectId'],
    cooperationProjectCode: 'PRJ-202608-000019',
    cooperationProjectName: 'COMETS 日区项目',
    brand: 'COMETS',
    media: '张晓晓',
    pm: '陈晨',
  },
  provider: 'Airwallex',
  fundingAccountId: 'mock-awx-operating',
  sourceCurrency: 'USD',
  payer: '财务人员',
  submittedAt: '2026-08-19T10:00',
  paidAt: '2026-08-19T10:00',
  status: '已付款',
  lifecycle: ['CREATED', 'SUBMITTED', 'COMPLETED'],
  items: [item()],
  ...overrides,
  purpose: overrides.purpose ?? 'NORMAL',
});

describe('payment batch workbook', () => {
  it('builds one row per batch with current request status and current-attempt totals', () => {
    const source = batch({
      items: [
        item(),
        item({
          payoutId: 'payout_export_2',
          amount: 500,
          currency: 'EUR',
          receiveCurrency: 'EUR',
          paidAt: '2026-08-20T09:00',
          transferFeeAmount: 1,
          transferFeeCurrency: 'EUR',
          actualPaidAmount: 501,
          actualPaidCurrency: 'EUR',
        }),
      ],
    });

    expect(buildPaymentBatchWorkbookRows([{ batch: source, currentRequestStatus: '已付款' }]))
      .toEqual([{
        paymentBatchCode: 'BAT-20260819-001',
        purpose: '正常付款',
        requestCode: 'REQ-202608-000019',
        provider: 'Airwallex',
        paymentEntity: 'Muse Commerce Limited',
        projectCostAttribution: '日本分公司',
        projectName: 'COMETS 日区项目',
        costType: '采购成本',
        costTypeDetail: '网红采买成本',
        paymentAmount: 'USD 1,000 + EUR 500',
        transferFeeAmount: 'USD 2.5 + EUR 1',
        singlePaymentAmount: 'USD 1,002.5 + EUR 501',
        actualPaymentDate: '2026-08-20',
        requestStatus: '已付款',
        initiator: '张晓晓',
        projectPm: '陈晨',
      }]);
  });

  it('keeps retry batches separate while sharing the latest request status', () => {
    const failedBatch = batch({
      paymentBatchCode: 'BAT-20260805-008',
      status: '全部失败',
      items: [item({
        paymentStatus: '付款失败',
        amount: 15_288,
        currency: 'HKD',
        transferFeeAmount: 30.58,
        transferFeeCurrency: 'HKD',
        actualPaidAmount: 30.58,
        actualPaidCurrency: 'HKD',
      })],
    });
    const retryBatch = batch({
      paymentBatchCode: 'BAT-20260806-001',
      purpose: 'RETRY',
      paymentAttemptNumber: 2,
      items: [item({
        paymentStatus: '已付款',
        amount: 15_288,
        currency: 'HKD',
        transferFeeAmount: 30.58,
        transferFeeCurrency: 'HKD',
        actualPaidAmount: 15_318.58,
        actualPaidCurrency: 'HKD',
      })],
    });

    const rows = buildPaymentBatchWorkbookRows([
      { batch: failedBatch, currentRequestStatus: '已付款' },
      { batch: retryBatch, currentRequestStatus: '已付款' },
    ]);

    expect(rows.map((row) => [row.paymentBatchCode, row.singlePaymentAmount, row.requestStatus])).toEqual([
      ['BAT-20260805-008', 'HKD 15,318.58', '已付款'],
      ['BAT-20260806-001', 'HKD 15,318.58', '已付款'],
    ]);
  });

  it('uses pending and missing-value fallbacks without inventing results', () => {
    const processing = batch({
      status: '付款处理中',
      request: {
        ...batch().request,
        paymentEntity: undefined,
        projectCostAttribution: undefined,
        costType: '投流',
        costTypeDetail: undefined,
        requestStatus: '',
      },
      items: [item({
        paymentStatus: '付款处理中',
        transferFeeAmount: undefined,
        transferFeeCurrency: undefined,
        actualPaidAmount: undefined,
        actualPaidCurrency: undefined,
        paidAt: undefined,
      })],
    });

    const [row] = buildPaymentBatchWorkbookRows([{ batch: processing }]);
    expect(row.paymentEntity).toBe('待补充');
    expect(row.projectCostAttribution).toBe('待补充');
    expect(row.costTypeDetail).toBe('—');
    expect(row.transferFeeAmount).toBe('待渠道回写');
    expect(row.singlePaymentAmount).toBe('待渠道回写');
    expect(row.actualPaymentDate).toBe('2026-08-19');
    expect(row.requestStatus).toBe('待同步');

    const [missingTerminal] = buildPaymentBatchWorkbookRows([{ batch: batch({
      items: [item({ transferFeeAmount: undefined, transferFeeCurrency: undefined, actualPaidAmount: 1_000 })],
    }) }]);
    expect(missingTerminal.singlePaymentAmount).toBe('—');
    expect(missingTerminal.transferFeeAmount).toBe('—');
  });

  it('writes the exact sixteen-column worksheet with purpose and a frozen filtered header', async () => {
    const workbookBlob = await createPaymentBatchWorkbook([{
      batch: batch(),
      currentRequestStatus: '已付款',
    }]);
    const { Workbook } = await import('exceljs');
    const workbook = new Workbook();
    await workbook.xlsx.load(await workbookBlob.arrayBuffer());
    const sheet = workbook.getWorksheet('付款明细');

    expect(sheet?.columnCount).toBe(16);
    expect(sheet?.rowCount).toBe(2);
    expect(sheet?.getRow(1).values).toEqual([undefined, ...PAYMENT_BATCH_WORKBOOK_HEADERS]);
    expect(sheet?.getRow(1).getCell(12).value).toBe('批次支付金额及币种');
    expect(sheet?.getRow(2).values).toEqual([
      undefined,
      'BAT-20260819-001',
      '正常付款',
      'REQ-202608-000019',
      'Airwallex',
      'Muse Commerce Limited',
      '日本分公司',
      'COMETS 日区项目',
      '采购成本',
      '网红采买成本',
      'USD 1,000',
      'USD 2.5',
      'USD 1,002.5',
      '2026-08-19',
      '已付款',
      '张晓晓',
      '陈晨',
    ]);
    expect(sheet?.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(sheet?.autoFilter).toBe('A1:P1');
  });

  it('exports reversal batches as zero payment while preserving the negative refund snapshot', () => {
    const reversal = batch({
      purpose: 'REVERSAL',
      status: '已冲退',
      sourcePaymentBatchId: 'payment_batch_source' as PaymentBatchRecord['paymentBatchId'],
      sourcePaymentBatchCode: 'BAT-20260819-001',
      items: [item({
        amount: 0,
        paymentStatus: '已冲退',
        transferFeeAmount: 0,
        transferFeeCurrency: 'USD',
        actualPaidAmount: -1_000,
        actualPaidCurrency: 'USD',
      })],
    });
    expect(buildPaymentBatchWorkbookRows([{ batch: reversal }])[0]).toMatchObject({
      purpose: '冲退付款',
      paymentAmount: 'USD 0',
      transferFeeAmount: 'USD 0',
      singlePaymentAmount: 'USD 0',
    });
    expect(reversal.items[0].actualPaidAmount).toBe(-1_000);
    expect(buildPaymentBatchWorkbookRows([{ batch: {
      ...reversal,
      status: '冲退处理中',
      items: reversal.items.map((source) => ({ ...source, paymentStatus: '冲退处理中', actualPaidAmount: undefined })),
    } }])[0]).toMatchObject({ singlePaymentAmount: 'USD 0', transferFeeAmount: 'USD 0' });
  });

  it('uses Shanghai dates in list filenames and the batch code in detail filenames', () => {
    expect(paymentBatchWorkbookFilename(new Date('2026-09-09T16:30:00.000Z')))
      .toBe('付款批次明细-20260910.xlsx');
    expect(paymentBatchDetailWorkbookFilename('BAT-20260819-001'))
      .toBe('BAT-20260819-001-付款明细表.xlsx');
  });
});
