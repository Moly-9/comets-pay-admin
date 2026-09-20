import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { PaymentBatchRecord } from '../paymentBatches';
import type { Payout } from '../types';
import { PaymentBatchDetailPage, PaymentBatchItemDrawer, PaymentItemDetails } from './PaymentBatchDetailPage';

const DETAIL_BATCH: PaymentBatchRecord = {
  paymentBatchId: 'payment_batch_detail_test' as PaymentBatchRecord['paymentBatchId'],
  paymentBatchCode: 'BAT-20260810-001',
  purpose: 'NORMAL',
  paymentOrderCode: 'PAY-2608100001',
  paymentAttemptNumber: 1,
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
    paymentCode: 'PMT-2608100001',
    creatorId: 'creator_detail_test',
    creatorName: 'Mina Kato',
    creatorHandle: '@minakato',
    deliverable: 'Instagram Reels 内容合作',
    paymentListId: 'payment_list_detail_test' as NonNullable<PaymentBatchRecord['items'][number]['paymentListId']>,
    paymentListCode: 'PAY-2608100001',
    paymentListStatus: 'submitted',
    paymentListVersion: 2,
    paymentOrderCode: 'PAY-2608100001',
    paymentAttemptNumber: 1,
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
    accountName: 'Mina Kato Account',
    payoutAccountId: 'payout_account_detail_test',
    payoutAccountVersion: 'v2',
    feeBearer: '广告主承担',
    paymentReason: '达人内容合作费用',
    transactionReference: 'COMETS-MINA-0810',
    description: 'Instagram Reels 内容合作',
    paymentStatus: '付款失败',
    paidAt: '2026-08-10T14:32',
    transferFeeAmount: 2.5,
    transferFeeCurrency: 'USD',
    actualPaidAmount: 2.5,
    actualPaidCurrency: 'USD',
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
    expect(html).toContain('COMETS 夏季内容项目');
    expect(html).toContain('PRJ-202608-000001');
    expect(html).toContain('PAY-2608100001');
    expect(html).not.toContain('INV-202608-000001');
    expect(html).not.toContain('CON-202608-000001');
    expect(html).toContain('data-payment-provider="Airwallex"');
    expect(html).toContain('<span class="payment-provider-label">Airwallex</span>');
    expect(html).toContain('<small title="LOCAL">LOCAL</small>');
    expect(html).toContain('达人');
    expect(html).toContain('付款渠道');
    expect(html).toContain('请款金额');
    expect(html).toContain('avatar avatar-sm');
    expect(html).toContain('>MK</span>');
    expect(html).toContain('aria-label="查看 Mina Kato 的付款详情"');
    expect(html).not.toContain('<h2 id="payment-batch-orders-title">付款单与付款明细</h2>');
    expect(html).toContain('aria-label="付款项目信息与付款记录"');
    expect(html).toContain('class="payment-batch-order-card"');
    expect(html).toContain('payment-batch-order-summary-card payment-batch-project-summary-card');
    expect(html).toContain('payment-batch-order-items payment-batch-order-items-card');
    expect(html).toContain('class="payment-batch-order-items-heading"');
    expect(html).toContain('<span>批次用途</span><strong>正常付款</strong><small>1 笔付款明细</small>');
    expect(html).toContain('<small>付款项目信息</small>');
    expect(html).toContain('<dt>付款单号</dt><dd class="payment-batch-project-code" title="PAY-2608100001">PAY-2608100001</dd>');
    expect(html).toContain('class="payment-batch-project-info-card"');
    expect(html).toContain('<dt>请款项目编号</dt>');
    expect(html).toContain('<span>付款人 / 时间</span><strong>奚文慧</strong>');
    expect(html).toContain('<span>付款渠道</span><strong>Airwallex</strong>');
    expect(html).toContain('<span>支付币种</span><strong>USD</strong>');
    expect(html).toContain('<p>PRJ-202608-000001 · COMETS 夏季内容项目</p>');
    expect(html).not.toContain('<dt>付款项目编号</dt>');
    expect(html).not.toContain('payment-batch-order-project');
    expect(html).toContain('<th class="payment-batch-col-creator" scope="col">达人</th>');
    expect(html).toContain('<th class="payment-batch-col-code" scope="col">付款编号</th>');
    expect(html.indexOf('scope="col">达人</th>')).toBeLessThan(html.indexOf('scope="col">付款编号</th>'));
    expect(html.indexOf('scope="col">付款编号</th>')).toBeLessThan(html.indexOf('scope="col">关联项目</th>'));
    expect(html).toContain('class="payment-batch-table-payment-code" title="PMT-2608100001">PMT-2608100001</span>');
    expect(html).toContain('<th class="payment-batch-col-project" scope="col">关联项目</th>');
    expect(html).toContain('<th class="action-cell payment-batch-col-actions" scope="col">操作</th>');
    expect(html).toContain('class="data-table payment-batch-order-table"');
    expect(html).toContain('<strong title="COMETS 夏季内容项目">COMETS 夏季内容项目</strong><small title="PRJ-202608-000001">PRJ-202608-000001</small>');
    expect(html).toContain('<strong title="Mina Kato Account">Mina Kato Account</strong><small title="Mina Kato">Mina Kato</small>');
    expect(html).toContain('class="payment-batch-attempt-badge">正常付款</span>');
    expect(html).toContain('下载确认函');
    expect(html).toContain('查看详情');
    expect(html).toContain('payment-project-payment-detail-page payment-batch-payment-detail-page');
    expect(html).toMatch(/payment-batch-detail-total[\s\S]*?<strong>USD 1,252.5<\/strong>/);
    expect(html).toContain('<small>批次支付金额 USD 1,252.5</small>');
    expect(html).toContain('<th class="payment-batch-col-amount" scope="col">请款金额</th>');
    expect(html).toContain('<th class="payment-batch-col-actual" scope="col">单笔支付金额</th>');
    expect(html).not.toContain('payment-batch-order-result');
    expect(html).not.toContain('payment_batch_detail_test');
    expect(html).not.toContain('请款项目 / 所属项目');
    expect(html).not.toContain('<dt>请款编号</dt>');
    expect(html).toContain('<dt>请款金额</dt>');
  });

  it('uses the processing status in the batch header', () => {
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

    expect(html).toMatch(/payment-batch-detail-total[\s\S]*?<span class="simple-status is-processing"><i><\/i>付款处理中<\/span>/);
    expect(html).toMatch(/payment-batch-detail-total[\s\S]*?<strong>待渠道回写<\/strong>/);
    expect(html).toContain('<small>批次支付金额 待渠道回写</small>');
    expect(html).not.toContain('payment-batch-order-result');
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

  it('renders exactly one payment order card for every batch', () => {
    const secondItem = {
      ...DETAIL_BATCH.items[0],
      payoutId: 'payout_detail_second',
      creatorId: 'creator_detail_second',
      creatorName: 'Alex Ruiz',
      creatorHandle: '@alexbuilds',
      paymentListId: 'payment_list_detail_second' as NonNullable<PaymentBatchRecord['items'][number]['paymentListId']>,
      paymentListCode: 'PAY-2608100002',
      paymentStatus: '已付款',
      failure: undefined,
      associationIssues: [],
    } satisfies PaymentBatchRecord['items'][number];
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage batch={{ ...DETAIL_BATCH, items: [...DETAIL_BATCH.items, secondItem] }} onBack={vi.fn()} />,
    );

    expect(html.match(/class="payment-batch-order-card"/g)).toHaveLength(1);
    expect(html).toContain('PAY-2608100001');
    expect(html).not.toContain('PAY-2608100002');
    expect(html).toContain('<small>2 笔付款明细</small>');
    expect(html).not.toContain('1 张付款单 · 2 笔明细');
  });

  it('renders a retry batch while keeping the original payment order', () => {
    const retryItem = {
      ...DETAIL_BATCH.items[0],
      paymentOrderCode: 'PAY-2608100001',
      sourcePaymentOrderCode: 'PAY-2608100001',
      paymentAttemptNumber: 2,
      paymentStatus: '已付款',
      failure: undefined,
      paidAt: '2026-08-11T09:05',
      transferFeeAmount: 8.5,
      transferFeeCurrency: 'USD',
      actualPaidAmount: 1258.5,
      actualPaidCurrency: 'USD',
    } satisfies PaymentBatchRecord['items'][number];
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage
        batch={{
          ...DETAIL_BATCH,
          purpose: 'RETRY',
          sourcePaymentBatchId: DETAIL_BATCH.paymentBatchId,
          sourcePaymentBatchCode: DETAIL_BATCH.paymentBatchCode,
          paymentBatchId: 'payment_batch_retry' as PaymentBatchRecord['paymentBatchId'],
          paymentBatchCode: 'BAT-20260811-001',
          paymentOrderCode: 'PAY-2608100001',
          sourcePaymentOrderCode: undefined,
          paymentAttemptNumber: 2,
          status: '已付款',
          items: [retryItem],
        }}
        onBack={vi.fn()}
      />,
    );

    expect(html).toContain('<span>批次用途</span><strong>重新付款</strong><small>来源批次 BAT-20260810-001</small>');
    expect(html).toContain('<dt>付款单号</dt><dd class="payment-batch-project-code" title="PAY-2608100001">PAY-2608100001</dd>');
    expect(html).toContain('payment-batch-attempt-badge is-retry">重新付款</span>');
    expect(html).toContain('USD 8.5');
    expect(html).toMatch(/payment-batch-detail-total[\s\S]*?<strong>USD 1,258.5<\/strong>/);
    expect(html).not.toContain('PAY-2608110002');
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
      currentPaymentAttempt: {
        paymentBatchId: DETAIL_BATCH.paymentBatchId,
        paymentBatchCode: DETAIL_BATCH.paymentBatchCode,
        submittedAt: DETAIL_BATCH.paidAt,
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

    expect(html).toContain('查看详情');
    expect(html).not.toContain('退回媒介处理');

    const drawerHtml = renderToStaticMarkup(
      <PaymentBatchItemDrawer
        batch={DETAIL_BATCH}
        item={DETAIL_BATCH.items[0]}
        payout={payout}
        canHandleFailure
        onClose={vi.fn()}
        onRequestFailureReturn={vi.fn()}
      />,
    );
    expect(drawerHtml).toContain('退回媒介处理');
    expect(drawerHtml).toContain('BENEFICIARY_DISABLED');
    expect(drawerHtml).toContain('aria-label="本次付款金额"');
    expect(drawerHtml).toContain('<span>付款金额</span><strong>USD 1,250</strong>');
    expect(drawerHtml).toContain('<span>手续费金额</span><strong>USD 2.5</strong>');
    expect(drawerHtml).toContain('<span>实际付款金额</span><strong>USD 2.5</strong>');
    expect(drawerHtml).toContain('<dt>所属付款项目</dt><dd class="payment-batch-drawer-code" title="REQ-202608-000001">REQ-202608-000001</dd>');
    expect(drawerHtml).toContain('<dt>付款编号</dt><dd class="payment-batch-drawer-code" title="PMT-2608100001">PMT-2608100001</dd>');
    expect(drawerHtml).toContain('<dt>付款单</dt><dd class="payment-batch-drawer-code" title="PAY-2608100001">PAY-2608100001</dd>');
    expect(drawerHtml).toContain('<dt>所属付款项目</dt><dd class="payment-batch-drawer-code" title="REQ-202608-000001">REQ-202608-000001</dd>');
    expect(drawerHtml).toContain('<dt>付款编号</dt><dd class="payment-batch-drawer-code" title="PMT-2608100001">PMT-2608100001</dd>');
    expect(drawerHtml).toContain('<dt>付款单</dt><dd class="payment-batch-drawer-code" title="PAY-2608100001">PAY-2608100001</dd>');
    expect(drawerHtml).toContain('我方承担');
    expect(drawerHtml.indexOf('付款渠道 / 方式')).toBeLessThan(drawerHtml.indexOf('本地清算方式'));
    expect(drawerHtml.indexOf('本地清算方式')).toBeLessThan(drawerHtml.indexOf('收款国家 / 地区'));
    const paymentPanel = drawerHtml.slice(drawerHtml.indexOf('payment-batch-detail-panel is-payment'));
    expect(paymentPanel).not.toContain('<dt>付款金额</dt>');
    expect(paymentPanel).not.toContain('<dt>手续费金额</dt>');
    expect(paymentPanel).not.toContain('<dt>实际付款金额</dt>');
    expect(paymentPanel).not.toContain('交易后余额');
    expect(drawerHtml).not.toContain('合同编号');
    expect(drawerHtml).not.toContain('Invoice 编号');
  });

  it('keeps a historical failed batch read-only after a later attempt succeeds', () => {
    const succeededPayout: Payout = {
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
      status: '已付款',
      invoiceReviewStatus: '已通过',
      accent: '#64748b',
      paidAt: '2026-08-11T09:05',
      currentPaymentAttempt: {
        paymentBatchId: 'payment_batch_retry_success' as PaymentBatchRecord['paymentBatchId'],
        paymentBatchCode: 'BAT-20260811-002',
        submittedAt: '2026-08-11T09:00',
      },
    };
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage
        batch={DETAIL_BATCH}
        payouts={[succeededPayout]}
        canHandleFailure
        onBack={vi.fn()}
        onReturnPayout={vi.fn(() => true)}
      />,
    );

    expect(html).toContain('部分失败');
    expect(html).not.toContain('BENEFICIARY_DISABLED');
    expect(html).not.toContain('退回媒介处理');

    const drawerHtml = renderToStaticMarkup(
      <PaymentBatchItemDrawer
        batch={DETAIL_BATCH}
        item={DETAIL_BATCH.items[0]}
        payout={succeededPayout}
        canHandleFailure
        onClose={vi.fn()}
        onRequestFailureReturn={vi.fn()}
      />,
    );
    expect(drawerHtml).toContain('BENEFICIARY_DISABLED');
    expect(drawerHtml).not.toContain('退回媒介处理');
  });

  it('shows an explicit placeholder for a legacy item without a payment code', () => {
    const drawerHtml = renderToStaticMarkup(
      <PaymentBatchItemDrawer
        batch={DETAIL_BATCH}
        item={{ ...DETAIL_BATCH.items[0], paymentCode: undefined }}
        canHandleFailure={false}
        onClose={vi.fn()}
      />,
    );

    expect(drawerHtml).toContain('<dt>付款编号</dt><dd class="payment-batch-drawer-code" title="付款编号待补全">付款编号待补全</dd>');
    expect(drawerHtml).not.toContain('<dt>付款编号</dt><dd>payout_detail_test</dd>');
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

  it('renders expanded contract, Invoice, legacy account warning and channel failure details', () => {
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
    expect(html).toContain('历史记录未保存完整账号');
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

  it('keeps the renamed payment workbook action before the item count', () => {
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage batch={DETAIL_BATCH} onBack={vi.fn()} />,
    );

    expect(html).not.toContain('>下载合同<');
    expect(html).not.toContain('>下载 Invoice<');
    expect(html).toContain('下载付款明细表');
    expect(html).not.toContain('下载项目资料');
    expect(html.indexOf('下载付款明细表')).toBeLessThan(html.indexOf('payment-batch-order-items-count'));
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
    expect(html).toContain('尚未更新');
    expect(html).toContain('查看付款清单');
  });

  it('keeps the frozen batch result when a live payout has been returned', () => {
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

    expect(html).toContain('<span class="simple-status is-danger"><i></i>部分失败</span>');
  });

  it('shows an explicit empty state when a stored batch has no item snapshots', () => {
    const html = renderToStaticMarkup(
      <PaymentBatchDetailPage batch={{ ...DETAIL_BATCH, items: [] }} onBack={vi.fn()} />,
    );

    expect(html).toContain('该批次暂无付款明细');
    expect(html).toContain('没有可展示的付款项快照');
  });

  it('uses a responsive right drawer and the workbench table rhythm with sticky status and actions', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    const pageCss = readFileSync(new URL('./PaymentBatchDetailPage.css', import.meta.url), 'utf8');
    const detailCss = readFileSync(new URL('./PaymentProjectPaymentDetailPage.css', import.meta.url), 'utf8');
    const source = readFileSync(new URL('./PaymentBatchDetailPage.tsx', import.meta.url), 'utf8');

    expect(css).toContain('.payment-batch-item-drawer-backdrop');
    expect(css).toContain('width: min(560px, 100vw)');
    expect(pageCss).toContain('min-width: max(100%, 2082px)');
    expect(pageCss).toContain('table-layout: fixed');
    expect(pageCss).toMatch(/\.payment-batch-order-table thead th\s*{[^}]*height:\s*47px;[^}]*padding:\s*0 14px;/s);
    expect(pageCss).toMatch(/\.payment-batch-order-table tbody td\s*{[^}]*height:\s*64px;[^}]*padding:\s*8px 14px;/s);
    expect(pageCss).toContain(':is(th, td).payment-batch-col-creator');
    expect(pageCss).toContain(':is(th, td).payment-batch-col-code');
    expect(pageCss).toMatch(/\.payment-batch-order-card \.payment-batch-project-info-grid\s*{[^}]*gap:\s*12px;[^}]*padding:\s*2px;/);
    expect(pageCss).toMatch(/@media \(max-width: 520px\)[\s\S]*?\.payment-batch-order-card \.payment-batch-project-info-grid\s*{[^}]*grid-template-columns:\s*1fr/);
    expect(pageCss).toContain('min-width: 220px');
    expect(pageCss).toContain('min-width: 252px');
    expect(pageCss).toContain('min-width: 214px');
    expect(pageCss).toContain('min-width: 158px');
    expect(pageCss).toContain('right: var(--payment-batch-actions-width)');
    expect(pageCss).toContain('right: 0');
    expect(pageCss).toContain('text-overflow: ellipsis');
    expect(pageCss).toMatch(/@media \(max-width: 520px\)[\s\S]*?--payment-batch-actions-width:\s*124px;[\s\S]*?min-width:\s*max\(100%, 1970px\)/);
    expect(css).toContain('.payment-batch-table-actions');
    expect(css).toContain('.payment-batch-order-summary-card');
    expect(css).toContain('.payment-batch-order-items-card');
    expect(css).toContain('.payment-batch-drawer-financial-summary');
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.payment-batch-order-items-tools \.button \{[\s\S]*?min-height: 44px/);
    expect(source).toContain('className="payment-batch-col-creator" scope="col"');
    expect(source).toContain('className="payment-batch-col-code" scope="col"');
    expect(source).toContain('className="action-cell payment-batch-col-actions" scope="col"');
    expect(source).toContain("import './PaymentBatchDetailPage.css'");
    expect(detailCss).toMatch(/payment-batch-payment-detail-page\.payment-batch-detail-page[\s\S]*?\.payment-project-summary-card strong,[\s\S]*?font-size: 18px/);
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.payment-batch-item-drawer \{[\s\S]*?width: 100vw/);
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain("event.key !== 'Tab'");
    expect(source).toContain('detailTriggerRef.current?.focus()');
  });
});
