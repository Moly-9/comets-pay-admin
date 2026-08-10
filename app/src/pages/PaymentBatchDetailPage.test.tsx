import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PaymentBatchRecord } from '../paymentBatches';
import { PaymentBatchDetailPage, PaymentItemDetails } from './PaymentBatchDetailPage';

const DETAIL_BATCH: PaymentBatchRecord = {
  paymentBatchId: 'payment_batch_detail_test' as PaymentBatchRecord['paymentBatchId'],
  paymentBatchCode: 'BAT-20260810-001',
  request: {
    paymentRequestProjectId: 'payment_request_detail_test' as PaymentBatchRecord['request']['paymentRequestProjectId'],
    requestCode: 'REQ-202608-000001',
    requestStatus: '待打款',
    lifecycle: 'APPROVED',
    amount: 'USD 1,250',
    reason: '达人内容合作费用',
    expectedPaymentDate: '2026-08-18',
    cooperationProjectId: 'project_detail_test' as PaymentBatchRecord['request']['cooperationProjectId'],
    cooperationProjectCode: 'PRJ-202608-000001',
    cooperationProjectName: 'COMETS 夏季内容项目',
    brand: 'COMETS',
    media: '张晓晓',
    pm: '陈晨',
  },
  provider: 'Airwallex',
  fundingAccountId: 'mock-awx-operating',
  sourceCurrency: 'USD',
  payer: '奚文慧',
  paidAt: '2026-08-10T14:32',
  status: '部分失败',
  lifecycle: ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED', 'PARTIALLY_FAILED'],
  items: [{
    payoutId: 'payout_detail_test',
    creatorId: 'creator_detail_test',
    creatorName: 'Mina Kato',
    creatorHandle: '@minakato',
    deliverable: 'Instagram Reels 内容合作',
    paymentListId: 'payment_list_detail_test' as NonNullable<PaymentBatchRecord['items'][number]['paymentListId']>,
    paymentListCode: 'PAY-202608-000001',
    paymentListStatus: 'submitted',
    paymentListVersion: 2,
    contracts: [{
      contractId: 'contract_detail_test' as PaymentBatchRecord['items'][number]['contracts'][number]['contractId'],
      contractCode: 'CON-202608-000001',
      name: 'Instagram 内容合作合同',
      currency: 'USD',
      amount: 1250,
      status: '已生效',
      signed: true,
      updatedAt: '2026-08-08',
    }],
    invoice: {
      invoiceId: 'invoice_detail_test' as NonNullable<PaymentBatchRecord['items'][number]['invoice']>['invoiceId'],
      invoiceNumber: 'INV-202608-000001',
      invoiceDate: '2026-08-09',
      currency: 'USD',
      amount: 1250,
      version: 2,
      reviewStatus: '已通过',
      validationStatus: 'valid',
    },
    provider: 'Airwallex',
    amount: 1250,
    currency: 'USD',
    receiveCurrency: 'USD',
    transferMethod: 'LOCAL',
    accountSummary: '•••• 7890',
    payoutAccountId: 'payout_account_detail_test',
    payoutAccountVersion: 'v2',
    feeBearer: '广告主承担',
    paymentReason: '达人内容合作费用',
    transactionReference: 'COMETS-MINA-0810',
    description: 'Instagram Reels 内容合作',
    paymentStatus: '付款失败',
    paidAt: '2026-08-10T14:32',
    failure: {
      code: 'BENEFICIARY_DISABLED',
      response: 'The beneficiary is currently disabled.',
      occurredAt: '2026-08-10T14:35',
    },
    associationIssues: ['付款清单账户版本需要人工复核'],
  }],
};

describe('PaymentBatchDetailPage', () => {
  it('renders the linked batch, request, cooperation project and payment row', () => {
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage batch={DETAIL_BATCH} onBack={vi.fn()} />,
    );

    expect(html).toContain('BAT-20260810-001');
    expect(html).toContain('REQ-202608-000001');
    expect(html).toContain('COMETS 夏季内容项目');
    expect(html).toContain('PRJ-202608-000001');
    expect(html).toContain('张晓晓');
    expect(html).toContain('陈晨');
    expect(html).toContain('PAY-202608-000001');
    expect(html).toContain('INV-202608-000001');
    expect(html).toContain('CON-202608-000001');
    expect(html).toContain('>Airwallex</strong><small>LOCAL</small>');
    expect(html).toContain('达人');
    expect(html).toContain('付款渠道');
    expect(html).toContain('付款金额');
    expect(html).toContain('avatar avatar-sm');
    expect(html).toContain('>MK</span>');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="payment-batch-item-payout_detail_test"');
    expect(html).toContain('aria-label="Mina Kato，USD 1,250，付款失败，展开付款详情"');
  });

  it('uses the simplified three-stage channel progress', () => {
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage batch={DETAIL_BATCH} onBack={vi.fn()} />,
    );

    expect(html).toContain('已付款');
    expect(html).toContain('平台处理中');
    expect(html).toContain('已完成');
    expect(html).toContain('aria-current="step"');
    expect(html).not.toContain('已创建');
    expect(html).not.toContain('已加入付款项');
    expect(html).not.toContain('已询价');
    expect(html).not.toContain('已提交渠道');
  });

  it('renders expanded contract, Invoice, masked account and channel failure details', () => {
    const html = renderToStaticMarkup(<PaymentItemDetails item={DETAIL_BATCH.items[0]} />);

    expect(html).toContain('Instagram 内容合作合同');
    expect(html).toContain('INV-202608-000001');
    expect(html).toContain('V2 · 已通过');
    expect(html).toContain('•••• 7890');
    expect(html).toContain('COMETS-MINA-0810');
    expect(html).toContain('BENEFICIARY_DISABLED');
    expect(html).toContain('关联资料缺失');
    expect(html).not.toContain('1234567890');
  });

  it('shows an explicit empty state when a stored batch has no item snapshots', () => {
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage batch={{ ...DETAIL_BATCH, items: [] }} onBack={vi.fn()} />,
    );

    expect(html).toContain('该批次暂无付款明细');
    expect(html).toContain('没有可展示的付款项快照');
  });
});
