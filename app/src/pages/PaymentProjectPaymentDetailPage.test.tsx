import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applyPaymentBatchPrototypeScenario } from '../paymentBatchPrototypeScenario';
import { createPaymentProjectPaymentRecord } from '../paymentBatches';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';
import { PaymentProjectItemDrawer, PaymentProjectPaymentDetailPage } from './PaymentProjectPaymentDetailPage';

const resources = applyPaymentBatchPrototypeScenario({
  payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
  requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
  generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
  paymentLists: INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists,
});

const failedRequest = resources.requests.find((request) => request.requestCode === 'REQ-202607-000011')!;
const failedRecord = createPaymentProjectPaymentRecord({
  request: failedRequest,
  payouts: resources.payouts,
  generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
  paymentLists: resources.paymentLists,
  contracts: INITIAL_COMPLETE_REQUEST_RESOURCES.contracts,
});
const partialFailureRequest = resources.requests.find((request) => (
  request.requestCode === 'REQ-202607-000015'
))!;
const partialFailureRecord = createPaymentProjectPaymentRecord({
  request: partialFailureRequest,
  payouts: resources.payouts,
  generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
  paymentLists: resources.paymentLists,
  contracts: INITIAL_COMPLETE_REQUEST_RESOURCES.contracts,
});

describe('PaymentProjectPaymentDetailPage', () => {
  it('renders the dedicated three-item partial-failure demo and its failure action', () => {
    const html = renderToStaticMarkup(
      <PaymentProjectPaymentDetailPage
        record={partialFailureRecord}
        payouts={resources.payouts}
        contracts={INITIAL_COMPLETE_REQUEST_RESOURCES.contracts}
        invoices={INITIAL_COMPLETE_REQUEST_RESOURCES.invoices}
        canHandleFailure
        onBack={vi.fn()}
        onReturnPayout={vi.fn(() => true)}
      />,
    );

    expect(partialFailureRecord.status).toBe('部分失败');
    expect(partialFailureRecord.items).toHaveLength(3);
    expect(partialFailureRecord.items.filter((item) => item.paymentStatus === '已付款')).toHaveLength(2);
    expect(partialFailureRecord.items.filter((item) => item.paymentStatus === '付款失败')).toHaveLength(1);
    expect(html).toContain('REQ-202607-000015');
    expect(html).toContain('3 笔付款明细');
    expect(html).toContain('1 笔付款失败需要处理');
    expect(html).toContain('查看失败明细');
    expect(html.match(/>查看详情<\/span>/g)).toHaveLength(3);
  });

  it('renders the retried request project with its current successful payment result', () => {
    const html = renderToStaticMarkup(
      <PaymentProjectPaymentDetailPage
        record={failedRecord}
        payouts={resources.payouts}
        contracts={INITIAL_COMPLETE_REQUEST_RESOURCES.contracts}
        invoices={INITIAL_COMPLETE_REQUEST_RESOURCES.invoices}
        canHandleFailure
        onBack={vi.fn()}
        onReturnPayout={vi.fn(() => true)}
      />,
    );

    expect(html).toContain('返回付款工作台');
    expect(html).toContain('>付款项目</span>');
    expect(html).toContain('REQ-202607-000011');
    expect(html).toContain(failedRecord.request.cooperationProjectName);
    expect(html).toContain('付款项目信息');
    expect(html).toContain('本页面仅展示当前付款项目，不混入同批次的其他项目');
    expect(html).toContain('>付款编号</dt>');
    expect(html).toContain('>付款金额</dt>');
    expect(html).toContain(`simple-status is-success"><i></i>${failedRecord.status}`);
    expect(html).not.toContain('请款项目 / 所属项目');
    expect(html).not.toContain('<dt>请款编号</dt>');
    expect(html).not.toContain('<dt>请款金额</dt>');
    expect(html).toContain(`${failedRecord.items.length} 笔付款明细`);
    const headings = [
      '达人名称',
      '付款渠道',
      '收款银行账号',
      '付款日期',
      '付款金额',
      '实际付款金额',
      '实际总手续费',
      '付款状态',
    ];
    headings.forEach((heading) => expect(html).toContain(`>${heading}</th>`));
    const headStart = html.indexOf('<thead>');
    const tableHead = html.slice(headStart, html.indexOf('</thead>', headStart));
    headings.slice(1).forEach((heading, index) => {
      expect(tableHead.indexOf(headings[index])).toBeLessThan(tableHead.indexOf(heading));
    });
    expect(html).toContain('data-table payment-project-detail-table');
    expect(html).toContain('payment-project-detail-action-cell');
    expect(html).toContain('<table');
    expect(html).not.toContain('付款失败需要处理');
    expect(html).not.toContain('退回媒介处理');
    expect(html).not.toContain('payment-batch-item-expand-icon');
    expect(html).not.toContain('BENEFICIARY_UNAVAILABLE');
    expect(html).toContain('下载付款资料');
    expect(html).toContain('下载付款明细');
    expect(html).toContain('下载确认函');
    expect(html).toContain('选择全部可导出确认函的付款明细');
    expect(html).toContain('payment-project-detail-select-cell');
    expect(html).toContain('class="avatar avatar-sm"');
    expect(html).toContain('查看详情');
    expect(html).toContain('HKD 15,288');
    expect(html).toContain('HKD 15,349.16');
    expect(html).toContain('HKD 61.16');
    expect(html).not.toContain('下载项目资料');
    expect(html).not.toContain('查看合同附件');
    expect(html).not.toContain('查看 Invoice 附件');
    expect(html).not.toContain('关联资料缺失');
    expect(html).not.toContain('付款批次</span>');
    expect(html).not.toContain('请款项目付款');
  });

  it('renders frozen Account Name as primary copy and Display Name as secondary copy', () => {
    const sourceItem = failedRecord.items[0];
    const accountRecord = {
      ...failedRecord,
      items: [{
        ...sourceItem,
        accountName: 'Frozen Creator Legal Account',
        accountIdentifier: 'GB29NWBK60161331926819',
        accountIdentifierLabel: 'IBAN' as const,
        creatorName: 'Frozen Display Name',
      }],
    };
    const html = renderToStaticMarkup(
      <PaymentProjectPaymentDetailPage
        record={accountRecord}
        payouts={[]}
        canHandleFailure={false}
        onBack={vi.fn()}
        onReturnPayout={vi.fn(() => true)}
      />,
    );

    expect(html).toContain('<strong title="Frozen Creator Legal Account">Frozen Creator Legal Account</strong>');
    expect(html).toContain('<small title="Frozen Display Name">Frozen Display Name</small>');
    expect(html).toContain('<strong title="GB29NWBK60161331926819">GB29NWBK60161331926819</strong>');
    expect(html).toContain('<small>IBAN</small>');
  });

  it('uses channel result amounts only after payment succeeds and keeps status inside the eighth column', () => {
    const sourceItem = failedRecord.items[0];
    const paidItem = {
      ...sourceItem,
      paymentStatus: '已付款' as const,
      paidAt: '2026-08-26T18:30:00.000Z',
      transferFeeAmount: 8.5,
      transferFeeCurrency: 'USD' as const,
      actualPaidAmount: 1258.5,
      actualPaidCurrency: 'USD' as const,
      paymentAttempts: undefined,
    };
    const paidRecord = { ...failedRecord, status: '已付款' as const, items: [paidItem] };
    const paidHtml = renderToStaticMarkup(
      <PaymentProjectPaymentDetailPage
        record={paidRecord}
        payouts={[]}
        canHandleFailure={false}
        onBack={vi.fn()}
        onReturnPayout={vi.fn(() => true)}
      />,
    );

    expect(paidHtml).toContain('2026-08-26');
    expect(paidHtml).toContain('USD 1,258.5');
    expect(paidHtml).toContain('USD 8.5');
    expect(paidHtml).toContain('simple-status is-success');
    expect(paidHtml).toContain('payment-project-detail-status-cell');
    expect(paidHtml).not.toContain('payment-batch-item-expand-icon');
    expect(paidHtml).not.toContain('payment-batch-item-expand-icon');

    const processingRecord = {
      ...failedRecord,
      status: '付款处理中' as const,
      items: [{
        ...paidItem,
        paymentStatus: '付款处理中' as const,
      }],
    };
    const processingHtml = renderToStaticMarkup(
      <PaymentProjectPaymentDetailPage
        record={processingRecord}
        payouts={[]}
        canHandleFailure={false}
        onBack={vi.fn()}
        onReturnPayout={vi.fn(() => true)}
      />,
    );

    expect((processingHtml.match(/待渠道回写/g) ?? [])).toHaveLength(3);
    expect(processingHtml).not.toContain('USD 1,258.5');
    expect(processingHtml).not.toContain('USD 8.5');

    const failedResultRecord = {
      ...failedRecord,
      status: '全部失败' as const,
      items: [{
        ...paidItem,
        paymentStatus: '付款失败' as const,
        actualPaidAmount: 8.5,
      }],
    };
    const failedHtml = renderToStaticMarkup(
      <PaymentProjectPaymentDetailPage
        record={failedResultRecord}
        payouts={[]}
        canHandleFailure={false}
        onBack={vi.fn()}
        onReturnPayout={vi.fn(() => true)}
      />,
    );
    const failedRowStart = failedHtml.indexOf('<tbody>');
    const failedDataRow = failedHtml.slice(failedRowStart, failedHtml.indexOf('</tr>', failedRowStart));

    expect(failedDataRow).not.toContain('2026-08-26');
    expect(failedDataRow).not.toContain('USD 1,258.5');
    expect((failedDataRow.match(/USD 8.5/g) ?? [])).toHaveLength(2);
  });

  it('opens failed payment information in a dedicated drawer without row expansion', () => {
    const failedItem = {
      ...failedRecord.items[0],
      paymentAttemptNumber: 1,
      paymentAttempts: undefined,
      paymentStatus: '付款失败' as const,
      paidAt: undefined,
      failure: {
        code: 'BENEFICIARY_UNAVAILABLE',
        response: 'The beneficiary account is unavailable.',
        occurredAt: '2026-08-26T18:30:00.000Z',
      },
    };
    const pageHtml = renderToStaticMarkup(
      <PaymentProjectPaymentDetailPage
        record={{ ...failedRecord, status: '全部失败', items: [failedItem] }}
        payouts={[]}
        canHandleFailure={false}
        onBack={vi.fn()}
        onReturnPayout={vi.fn(() => true)}
      />,
    );

    expect(pageHtml).toContain('查看失败明细');
    expect(pageHtml).toContain('查看详情');
    expect(pageHtml).not.toContain('payment-batch-item-expand-icon');
    expect(pageHtml).not.toContain('BENEFICIARY_UNAVAILABLE');

    const drawerHtml = renderToStaticMarkup(
      <PaymentProjectItemDrawer
        item={failedItem}
        canHandleFailure
        onClose={vi.fn()}
        onRequestFailureReturn={vi.fn()}
      />,
    );

    expect(drawerHtml).toContain('role="dialog"');
    expect(drawerHtml).toContain('aria-modal="true"');
    expect(drawerHtml).toContain('收款人');
    expect(drawerHtml).toContain('付款信息');
    expect(drawerHtml).toContain('我方承担');
    expect(drawerHtml).toContain('渠道结果');
    expect(drawerHtml).toContain('BENEFICIARY_UNAVAILABLE');
    expect(drawerHtml).toContain('The beneficiary account is unavailable.');
    expect(drawerHtml).toContain('退回媒介处理');
    expect(drawerHtml.indexOf('渠道结果')).toBeLessThan(drawerHtml.indexOf('付款信息'));
    expect(drawerHtml).not.toContain('二次付款');
    expect(drawerHtml).not.toContain('付款关联文件');
    expect(drawerHtml).not.toContain('Invoice 日期');
    expect(drawerHtml).not.toContain('关联资料缺失');
  });

  it('shows two frozen payment attempts and cumulative spend before payment information', () => {
    const retryPayout = resources.payouts.find((payout) => payout.currentPaymentAttempt);
    const retryItem = failedRecord.items.find((item) => item.payoutId === retryPayout?.id);
    expect(retryPayout).toBeDefined();
    expect(retryItem).toBeDefined();

    const drawerHtml = renderToStaticMarkup(
      <PaymentProjectItemDrawer
        item={retryItem!}
        payout={retryPayout}
        canHandleFailure={false}
        onClose={vi.fn()}
      />,
    );

    expect((drawerHtml.match(/二次付款/g) ?? [])).toHaveLength(2);
    expect(drawerHtml).toContain('首次付款');
    expect(drawerHtml).toContain('所属批次');
    expect(drawerHtml).toContain('BAT-20260805-008');
    expect(drawerHtml).toContain('BAT-20260806-001');
    expect(drawerHtml).toContain('付款时间');
    expect(drawerHtml).toContain('2026-08-05 16:05');
    expect(drawerHtml).toContain('HKD 30.58');
    expect(drawerHtml).toContain('HKD 15,318.58');
    expect(drawerHtml).toContain('累计实际付款金额');
    expect(drawerHtml).toContain('HKD 15,349.16');
    expect(drawerHtml).toContain('实际总手续费');
    expect(drawerHtml).toContain('HKD 61.16');
    expect(drawerHtml).toContain('BENEFICIARY_UNAVAILABLE');
    expect(drawerHtml).toContain('The beneficiary is temporarily unavailable.');
    expect(drawerHtml).toContain('业务退回原因');
    expect(drawerHtml.indexOf('渠道结果')).toBeLessThan(drawerHtml.indexOf('付款信息'));
    const paymentInfo = drawerHtml.slice(drawerHtml.indexOf('付款信息'));
    expect(paymentInfo).not.toContain('<dt>支付总金额</dt>');
    expect(paymentInfo).not.toContain('<dt>手续费金额</dt>');
    expect(paymentInfo).not.toContain('<dt>交易后余额</dt>');
  });

  it('uses legacy successful results and keeps abnormal multi-currency attempts separated', () => {
    const sourceItem = failedRecord.items[1];
    const legacyHtml = renderToStaticMarkup(
      <PaymentProjectItemDrawer
        item={{
          ...sourceItem,
          paymentAttempts: undefined,
          paymentAttemptNumber: 1,
          paymentStatus: '已付款',
          actualPaidAmount: 1_258.5,
          actualPaidCurrency: 'USD',
          transferFeeAmount: 8.5,
          transferFeeCurrency: 'USD',
        }}
        canHandleFailure={false}
        onClose={vi.fn()}
      />,
    );
    const legacyRecipient = legacyHtml.slice(legacyHtml.indexOf('收款人'), legacyHtml.indexOf('渠道结果'));
    expect(legacyRecipient).toContain('USD 1,258.5');
    expect(legacyRecipient).toContain('USD 8.5');

    const multiCurrencyHtml = renderToStaticMarkup(
      <PaymentProjectItemDrawer
        item={{
          ...sourceItem,
          paymentStatus: '已付款',
          paymentAttempts: [
            {
              attemptNumber: 1,
              status: '付款失败',
              principalAmount: 1_250,
              principalCurrency: 'USD',
              transferFeeAmount: 2,
              transferFeeCurrency: 'USD',
              actualPaidAmount: 2,
              actualPaidCurrency: 'USD',
            },
            {
              attemptNumber: 2,
              status: '已付款',
              principalAmount: 1_250,
              principalCurrency: 'USD',
              transferFeeAmount: 3,
              transferFeeCurrency: 'EUR',
              actualPaidAmount: 1_253,
              actualPaidCurrency: 'EUR',
            },
          ],
        }}
        canHandleFailure={false}
        onClose={vi.fn()}
      />,
    );
    const multiCurrencyRecipient = multiCurrencyHtml.slice(
      multiCurrencyHtml.indexOf('收款人'),
      multiCurrencyHtml.indexOf('渠道结果'),
    );
    expect(multiCurrencyRecipient).toContain('USD 2');
    expect(multiCurrencyRecipient).toContain('EUR 1,253');
    expect(multiCurrencyRecipient).toContain('EUR 3');
  });

  it('uses the workbench table, summary-style downloads, and responsive drawer', () => {
    const css = readFileSync(new URL('./PaymentProjectPaymentDetailPage.css', import.meta.url), 'utf8');
    const source = readFileSync(new URL('./PaymentProjectPaymentDetailPage.tsx', import.meta.url), 'utf8');

    expect(css).toContain('.payment-project-detail-table');
    expect(css).toContain('position: sticky');
    expect(css).toContain('right: 116px');
    expect(css).toContain('right: 0');
    expect(css).toContain('.payment-project-item-drawer');
    expect(css).toContain('width: min(520px, 100vw)');
    expect(css).toContain('.payment-project-info-icon');
    expect(css).toContain('linear-gradient(125deg, #fff5e9, #fff0ea)');
    expect(css).toContain('linear-gradient(125deg, #f0faf6, #eaf8f6)');
    expect(css).toContain('linear-gradient(125deg, #fff9ea, #fff2df)');
    expect(css).toContain('linear-gradient(125deg, #fff4f8, #f9effb)');
    expect(css).toContain('font-size: clamp(17px, 1.55vw, 24px)');
    expect(css).toContain('linear-gradient(125deg, #eef5ff 0%, #e1ecfb 100%)');
    expect(css).toContain('linear-gradient(125deg, #fff2f0 0%, #f8e2df 100%)');
    expect(css).toContain('linear-gradient(125deg, #f7f0fc 0%, #ecdef6 100%)');
    expect(css).toContain('.payment-project-attempt-card');
    expect(css).toContain('.payment-project-retry-badge');
    expect(css).toContain('font-size: 28px');
    expect(css).toContain('border-radius: 14px');
    expect(css).toContain('.payment-project-info-cards');
    expect(css).toContain('min-height: 44px');
    expect(css).not.toContain('.payment-project-detail-item-trigger');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(source).not.toContain('份合同 PDF 压缩包');
    expect(source).not.toContain('份 Invoice PDF 压缩包');
    expect(source).not.toContain('导出当前项目冻结付款清单 Excel');
    expect(source).not.toContain('笔已付款明细可导出');
    expect(source).not.toContain('笔已选择');
  });

  it('uses project-level progress copy and status counts', () => {
    const html = renderToStaticMarkup(
      <PaymentProjectPaymentDetailPage
        record={failedRecord}
        payouts={resources.payouts}
        canHandleFailure={false}
        onBack={vi.fn()}
        onReturnPayout={vi.fn(() => true)}
      />,
    );

    expect(html).toContain('项目付款进度');
    expect(html).toContain('<strong>已提交</strong>');
    expect(html).toContain('<strong>平台处理中</strong>');
    expect(html).toContain('<strong>已付款</strong>');
    expect(html).not.toContain('<strong>已完成</strong>');
    expect(html).toContain('payment-progress-steps');
    expect(html).toContain('5 成功 · 0 失败');
    expect(html).toContain('以渠道回写时间为准');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('payment-project-summary-card is-order');
    expect(html).toContain('payment-project-summary-card is-provider');
    expect(html).toContain('payment-project-summary-card is-result');
    expect(html).toContain('payment-project-summary-card is-updated');
    expect(html).toContain('data-payment-provider="Airwallex"');
    expect(html).not.toContain('payment-project-summary-icon');
  });

  it('shows the current payment project status in the payment information card', () => {
    const processingRecord = {
      ...failedRecord,
      status: '付款处理中' as const,
      request: {
        ...failedRecord.request,
        requestStatus: '已完成',
      },
    };
    const html = renderToStaticMarkup(
      <PaymentProjectPaymentDetailPage
        record={processingRecord}
        payouts={resources.payouts}
        canHandleFailure
        onBack={vi.fn()}
        onReturnPayout={vi.fn(() => true)}
      />,
    );

    expect(html).toContain('付款项目信息');
    expect(html).toContain('付款主体');
    expect(html).toContain('项目费用归属');
    expect(html).toContain('成本类型明细');
    expect(html).toContain('simple-status is-processing"><i></i>付款处理中');
    expect(html).toContain('payment-project-summary-card is-result');
    expect(html).not.toContain('payment-project-summary-card is-result-processing');
    expect(html).not.toContain('simple-status"><i></i>已完成');
  });
});
