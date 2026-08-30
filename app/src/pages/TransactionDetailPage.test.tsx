import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TransactionBatchContext, TransactionRecord } from '../transactionRecords';
import type { Payout } from '../types';
import { TransactionDetailPage } from './TransactionDetailPage';

const payout: Payout = {
  id: 'pay-detail-test',
  creator: 'Kenji Mori',
  handle: '@kenji.mori',
  initials: 'KM',
  projectId: 'project-test',
  project: 'Racing Master NA/EU KOC 4-6月',
  contract: 'CON-20260810-001',
  invoice: 'INV-20260810-001',
  provider: 'Airwallex',
  currency: 'USD',
  amount: 4100,
  account: '•••• 0007',
  status: '已付款',
  invoiceReviewStatus: '已通过',
  accent: '#2f9f68',
  paidAt: '2026-08-10 16:30',
};

const context = {
  batch: {
    paymentBatchCode: 'PAY-20260810-001',
    provider: 'Airwallex',
    payer: '财务测试员',
    paidAt: '2026-08-10 16:30',
    status: '已付款',
    request: {
      cooperationProjectName: 'Racing Master NA/EU KOC 4-6月',
      cooperationProjectCode: 'PRJ-20260810-001',
      requestCode: 'REQ-20260810-001',
      requestStatus: '已付款',
      reason: '达人合作内容验收完成',
    },
  },
  item: {
    receiveCurrency: 'USD',
    transferMethod: '本地转账',
    accountSummary: '•••• 0007',
    feeBearer: '广告主承担',
    transactionReference: 'Racing Master creator payout',
    contracts: [{
      contractId: 'contract-test',
      contractCode: 'CON-20260810-001',
      name: 'Racing Master 达人合作合同',
      currency: 'USD',
      amount: 4100,
      signed: true,
      status: '已生效',
    }],
    invoice: {
      invoiceNumber: 'INV-20260810-001',
      version: 2,
      currency: 'USD',
      amount: 4100,
      invoiceDate: '2026-08-08',
      reviewStatus: '已通过',
    },
    paymentListCode: 'PL-20260810-001',
    paymentListVersion: 3,
    paymentListStatus: 'paid',
  },
} as unknown as TransactionBatchContext;

const record: TransactionRecord = {
  key: 'batch:payment-batch-test:payout:pay-detail-test',
  payout,
  context,
  status: '已付款',
  occurredAt: '2026-08-10 16:30',
  provider: 'Airwallex',
  paymentAmount: 4100,
  paymentCurrency: 'USD',
  transferFeeAmount: 8.2,
  transferFeeCurrency: 'USD',
  recipientReceivedAmount: 4100,
  recipientReceivedCurrency: 'USD',
};

describe('TransactionDetailPage', () => {
  it('renders the creator card, transaction summary, associations, and highlighted payment list', () => {
    const html = renderToStaticMarkup(
      <TransactionDetailPage record={record} onBack={vi.fn()} />,
    );

    expect(html).toContain('transaction-creator-summary-card');
    expect(html).not.toContain('transaction-detail-header');
    expect(html).toContain('支付金额');
    expect(html).toContain('手续费 USD 8.2');
    expect(html).toContain('对方实收 USD 4,100');
    expect(html).toContain('付款渠道');
    expect(html).toContain('交易状态');
    expect(html).toContain('所属关联项目');
    expect(html).toContain('所属请款项目');
    expect(html).toContain('所属请款批次');
    expect(html).toContain('CON-20260810-001');
    expect(html).toContain('INV-20260810-001');
    expect(html).toContain('transaction-resource-card is-payment-list');
    expect(html).toContain('is-cooperation-project');
    expect(html).toContain('is-request-project');
    expect(html).toContain('is-payment-batch');
    expect(html).toContain('transaction-resource-icon is-contract');
    expect(html).toContain('transaction-resource-icon is-invoice');
    expect(html).toContain('PL-20260810-001');
    expect(html).not.toContain('交易记录 ID');
    expect(html).toContain('付款批次号');
    expect(html).toContain('PAY-20260810-001');
    expect(html).toContain('付款事由');
    expect(html).toContain('达人合作内容验收完成');
    expect(html).toContain('aria-label="查看合同"');
    expect(html).toContain('aria-label="查看 Invoice"');
    expect(html).toContain('aria-label="查看付款清单"');
    expect(html).toContain('transaction-section-icon');
    expect(html).toContain('transaction-detail-summary-label');
  });

  it('marks unknown historical records for completion without hiding known payout data', () => {
    const html = renderToStaticMarkup(
      <TransactionDetailPage record={{ ...record, key: 'historical:payout:pay-detail-test', context: null }} onBack={vi.fn()} />,
    );

    expect(html).toContain('历史数据待补全');
    expect(html).toContain('CON-20260810-001');
    expect(html).toContain('INV-20260810-001');
  });
});
