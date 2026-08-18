import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PaymentBatchRecord } from '../paymentBatches';
import type { Payout } from '../types';
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
    expect(html).toContain('data-payment-provider="Airwallex"');
    expect(html).toContain('<span class="payment-provider-label">Airwallex</span>');
    expect(html).toContain('<small>LOCAL</small>');
    expect(html).toContain('达人');
    expect(html).toContain('付款渠道');
    expect(html).toContain('付款金额');
    expect(html).toContain('avatar avatar-sm');
    expect(html).toContain('>MK</span>');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="payment-batch-item-payout_detail_test"');
    expect(html).toContain('aria-label="Mina Kato，USD 1,250，付款失败，收起付款详情"');
    expect(html).toContain('<h2 id="payment-batch-orders-title">付款单与付款明细</h2>');
    expect(html).toContain('class="payment-batch-order-card"');
    expect(html).toContain('payment-batch-project-full payment-batch-project-reason');
    expect(html).toContain('class="payment-batch-order-items-heading"');
    expect(html).toContain('<span>付款单</span><strong>PAY-202608-000001</strong>');
    expect(html).toContain('<span>付款人 / 时间</span><strong>奚文慧</strong>');
    expect(html).toContain('<span>付款渠道</span><strong>Airwallex</strong>');
    expect(html).toContain('<span>支付币种</span><strong>USD</strong>');
    expect(html).toContain('<p>COMETS 夏季内容项目</p>');
    expect(html).not.toContain('<p>REQ-202608-000001 · COMETS 夏季内容项目</p>');
    expect(html).toContain('<dt>付款项目编号</dt>');
    expect(html).toContain('<dt>付款金额</dt>');
    expect(html).not.toContain('payment_batch_detail_test');
    expect(html).not.toContain('请款项目 / 所属项目');
    expect(html).not.toContain('<dt>请款编号</dt>');
    expect(html).not.toContain('<dt>请款金额</dt>');
  });

  it('uses the processing status in the payment order card', () => {
    const processingBatch: PaymentBatchRecord = {
      ...DETAIL_BATCH,
      request: { ...DETAIL_BATCH.request, requestStatus: '已付款' },
      status: '付款处理中',
      lifecycle: ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED'],
      items: DETAIL_BATCH.items.map((item) => ({
        ...item,
        paymentStatus: '付款处理中',
        failure: undefined,
      })),
    };
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage batch={processingBatch} onBack={vi.fn()} />,
    );

    expect(html).toMatch(/class="payment-batch-order-card"[\s\S]*?<span class="simple-status is-processing"><i><\/i>付款处理中<\/span>/);
  });

  it('highlights every supported payment provider in payment detail rows', () => {
    const providerItems = [
      DETAIL_BATCH.items[0],
      {
        ...DETAIL_BATCH.items[0],
        payoutId: 'payout_detail_paypal',
        creatorId: 'creator_detail_paypal',
        creatorName: 'Alex Ruiz',
        creatorHandle: '@alexbuilds',
        provider: 'PayPal',
      },
      {
        ...DETAIL_BATCH.items[0],
        payoutId: 'payout_detail_paymax',
        creatorId: 'creator_detail_paymax',
        creatorName: 'Nora Singh',
        creatorHandle: '@norasingh',
        provider: 'PayMax',
      },
    ] satisfies PaymentBatchRecord['items'];
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage batch={{ ...DETAIL_BATCH, items: providerItems }} onBack={vi.fn()} />,
    );

    expect(html).toContain('class="payment-provider-badge is-airwallex is-compact"');
    expect(html).toContain('data-payment-provider="Airwallex"');
    expect(html).toContain('class="payment-provider-badge is-paypal is-compact"');
    expect(html).toContain('data-payment-provider="PayPal"');
    expect(html).toContain('class="payment-provider-badge is-paymax is-compact"');
    expect(html).toContain('data-payment-provider="PayMax"');
  });

  it('renders one integrated card for each payment order in the batch', () => {
    const secondItem = {
      ...DETAIL_BATCH.items[0],
      payoutId: 'payout_detail_second',
      creatorId: 'creator_detail_second',
      creatorName: 'Alex Ruiz',
      creatorHandle: '@alexbuilds',
      paymentListId: 'payment_list_detail_second' as NonNullable<PaymentBatchRecord['items'][number]['paymentListId']>,
      paymentListCode: 'PAY-202608-000002',
      paymentStatus: '已付款',
      failure: undefined,
      associationIssues: [],
    } satisfies PaymentBatchRecord['items'][number];
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage batch={{ ...DETAIL_BATCH, items: [...DETAIL_BATCH.items, secondItem] }} onBack={vi.fn()} />,
    );

    expect(html.match(/class="payment-batch-order-card"/g)).toHaveLength(2);
    expect(html).toContain('PAY-202608-000001');
    expect(html).toContain('PAY-202608-000002');
    expect(html).toContain('<strong>2 张付款单</strong><small>2 笔付款明细</small>');
    expect(html).toContain('2 张付款单 · 2 笔明细');
  });

  it('exposes the shared return action for a failed item in the batch detail', () => {
    const payout: Payout = {
      id: 'payout_detail_test',
      paymentRequestProjectId: DETAIL_BATCH.request.paymentRequestProjectId,
      creator: 'Mina Kato',
      handle: '@minakato',
      initials: 'MK',
      projectId: DETAIL_BATCH.request.cooperationProjectId,
      project: DETAIL_BATCH.request.cooperationProjectName,
      contract: 'CON-202608-000001',
      invoice: 'INV-202608-000001',
      provider: 'Airwallex',
      currency: 'USD',
      amount: 1250,
      account: 'prototype-account',
      status: '付款失败',
      invoiceReviewStatus: '已通过',
      accent: '#64748b',
      paymentFailure: {
        provider: 'Airwallex',
        errorCode: 'BENEFICIARY_DISABLED',
        providerResponse: 'The beneficiary is currently disabled.',
        occurredAt: '2026-08-10T14:35',
      },
    };
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage
        batch={DETAIL_BATCH}
        payouts={[payout]}
        canHandleFailure
        onBack={vi.fn()}
        onReturnPayout={vi.fn(() => true)}
      />,
    );

    expect(html).toContain('该笔付款需要财务判断问题类型');
    expect(html).toContain('退回媒介处理');
  });

  it('uses the simplified three-stage channel progress', () => {
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage batch={DETAIL_BATCH} onBack={vi.fn()} />,
    );

    expect(html).toContain('<strong>已提交</strong>');
    expect(html).toContain('<strong>平台处理中</strong>');
    expect(html).toContain('<strong>已付款</strong>');
    expect(html).not.toContain('<strong>已完成</strong>');
    expect(html).toContain('payment-progress-steps');
    expect(html).toContain('class="is-failed"');
    expect(html).toContain('<small>部分失败</small>');
    expect(html).toContain('aria-current="step"');
    expect(html).not.toContain('已创建');
    expect(html).not.toContain('已加入付款项');
    expect(html).not.toContain('已询价');
    expect(html).not.toContain('已提交渠道');
  });

  it('renders expanded contract, Invoice, masked account and channel failure details', () => {
    const html = renderToStaticMarkup(
      <PaymentItemDetails
        item={DETAIL_BATCH.items[0]}
        onViewContractAttachment={vi.fn()}
        onViewInvoiceAttachment={vi.fn()}
      />,
    );

    expect(html).toContain('Instagram 内容合作合同');
    expect(html).toContain('INV-202608-000001');
    expect(html).toContain('V2 · 已通过');
    expect(html).toContain('<dt>合同编号</dt>');
    expect(html).toContain('<dt>合同名称</dt>');
    expect(html).toContain('<dt>合同金额</dt>');
    expect(html).toContain('<dt>签署人</dt>');
    expect(html).toContain('<dt>付款账户</dt>');
    expect(html).toContain('<dt>Invoice 编号</dt>');
    expect(html).toContain('<dt>Invoice 日期</dt>');
    expect(html).toContain('<dt>Invoice 金额</dt>');
    expect(html).toContain('<dt>付款单</dt>');
    expect(html).toContain('<dt>付款渠道 / 方式</dt>');
    expect(html).toContain('<dt>支付 / 收款币种</dt>');
    expect(html).toContain('<dt>收款账户</dt>');
    expect(html).toContain('<dt>费用承担</dt>');
    expect(html).toContain('<dt>付款原因</dt>');
    expect(html).toContain('<dt>交易附言</dt>');
    expect(html).toContain('<dt>描述</dt>');
    expect(html).toContain('<dt>渠道结果</dt>');
    expect(html).toContain('<dt>付款时间</dt>');
    expect(html).toContain('•••• 7890');
    expect(html).toContain('COMETS-MINA-0810');
    expect(html).toContain('BENEFICIARY_DISABLED');
    expect(html).toContain('关联资料缺失');
    expect(html).toContain('payment-batch-detail-panel is-contract');
    expect(html).toContain('payment-batch-detail-panel is-invoice');
    expect(html).toContain('payment-batch-detail-panel is-payment');
    expect(html).toContain('aria-label="查看合同附件 CON-202608-000001"');
    expect(html).toContain('aria-label="查看 Invoice 附件 INV-202608-000001"');
    expect(html.match(/>查看附件<\/button>/g)).toHaveLength(2);
    expect(html).toMatch(/payment-batch-detail-panel is-contract[\s\S]*?<header>[\s\S]*?查看合同附件 CON-202608-000001[\s\S]*?<\/header>/);
    expect(html).toContain('付款关联文件');
    expect(html).toContain('账户快照与渠道结果');
    expect(html).not.toContain('付款记录 ID');
    expect(html).not.toContain('<dt>账户版本</dt>');
    expect(html).not.toContain('1234567890');
  });

  it('provides separate contract, Invoice and payment workbook actions beside the payment orders', () => {
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage batch={DETAIL_BATCH} onBack={vi.fn()} />,
    );

    expect(html).toContain('下载合同');
    expect(html).toContain('下载 Invoice');
    expect(html).toContain('下载付款表');
    expect(html).not.toContain('下载项目资料');
  });

  it('reads the shared failure return record and exposes the payment-list deep link', () => {
    const payout: Payout = {
      id: 'payout_detail_test',
      paymentRequestProjectId: DETAIL_BATCH.request.paymentRequestProjectId,
      creator: 'Mina Kato',
      handle: '@minakato',
      initials: 'MK',
      projectId: DETAIL_BATCH.request.cooperationProjectId,
      project: DETAIL_BATCH.request.cooperationProjectName,
      contract: 'CON-202608-000001',
      invoice: 'INV-202608-000001',
      provider: 'Airwallex',
      currency: 'USD',
      amount: 1250,
      account: 'prototype-account',
      status: '已退回',
      invoiceReviewStatus: '已通过',
      accent: '#64748b',
      paymentFailureReturn: {
        issueType: 'PAYMENT_LIST',
        reason: '付款清单账户快照已失效，请达人更新账户。',
        actorAccount: 'finance',
        actorName: '财务人员',
        occurredAt: '2026-08-10T15:00:00.000Z',
        restartStage: 'PAYMENT_LIST_RESUBMISSION',
      },
      paymentFailureRecovery: {
        status: 'AWAITING_CREATOR_UPDATE',
        notifications: [],
      },
    };
    const html = renderToStaticMarkup(
      <PaymentItemDetails item={DETAIL_BATCH.items[0]} payout={payout} onOpenFailurePaymentList={vi.fn()} />,
    );

    expect(html).toContain('失败款已转交媒介恢复');
    expect(html).toContain('付款清单账户快照已失效，请达人更新账户。');
    expect(html).toContain('等待达人更新账户');
    expect(html).toContain('查看付款清单');
  });

  it('shows the partial-payment-failure request state when a live batch payout has been returned', () => {
    const payout: Payout = {
      id: 'payout_detail_test',
      paymentRequestProjectId: DETAIL_BATCH.request.paymentRequestProjectId,
      creator: 'Mina Kato',
      handle: '@minakato',
      initials: 'MK',
      projectId: DETAIL_BATCH.request.cooperationProjectId,
      project: DETAIL_BATCH.request.cooperationProjectName,
      contract: 'CON-202608-000001',
      invoice: 'INV-202608-000001',
      provider: 'Airwallex',
      currency: 'USD',
      amount: 1250,
      account: 'prototype-account',
      status: '已退回',
      invoiceReviewStatus: '已通过',
      accent: '#64748b',
    };
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage batch={DETAIL_BATCH} payouts={[payout]} onBack={vi.fn()} />,
    );

    expect(html).toContain('<span class="simple-status is-danger"><i></i>部分打款失败</span>');
  });

  it('shows an explicit empty state when a stored batch has no item snapshots', () => {
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage batch={{ ...DETAIL_BATCH, items: [] }} onBack={vi.fn()} />,
    );

    expect(html).toContain('该批次暂无付款明细');
    expect(html).toContain('没有可展示的付款项快照');
  });
});
