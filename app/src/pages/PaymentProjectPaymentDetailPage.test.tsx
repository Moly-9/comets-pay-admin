import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applyPaymentBatchPrototypeScenario } from '../paymentBatchPrototypeScenario';
import { createPaymentProjectPaymentRecord } from '../paymentBatches';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';
import { PaymentProjectPaymentDetailPage } from './PaymentProjectPaymentDetailPage';

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

describe('PaymentProjectPaymentDetailPage', () => {
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
    expect(html).toContain('<dt>付款编号</dt>');
    expect(html).toContain('<dt>付款金额</dt>');
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
      '支付总金额',
      '手续费金额',
      '付款状态',
    ];
    headings.forEach((heading) => expect(html).toContain(`>${heading}</span>`));
    const headStart = html.indexOf('payment-project-detail-item-head');
    const tableHead = html.slice(headStart, html.indexOf('</div>', headStart));
    headings.slice(1).forEach((heading, index) => {
      expect(tableHead.indexOf(headings[index])).toBeLessThan(tableHead.indexOf(heading));
    });
    expect(html).toContain('payment-batch-item-list payment-project-detail-item-list');
    expect(html).toContain('payment-batch-item-trigger payment-project-detail-item-trigger');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('付款失败需要处理');
    expect(html).not.toContain('退回媒介处理');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('BENEFICIARY_UNAVAILABLE');
    expect(html).toContain('下载合同');
    expect(html).toContain('下载 Invoice');
    expect(html).toContain('下载付款表');
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
    expect(paidHtml).toContain('payment-batch-item-status is-success');
    expect(paidHtml).toContain('payment-batch-item-expand-icon');
    expect(paidHtml).toContain('aria-expanded="false"');

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
    const failedRowStart = failedHtml.indexOf('<article id="payment-project-item');
    const failedDataRow = failedHtml.slice(failedRowStart, failedHtml.indexOf('</button>', failedRowStart));

    expect(failedDataRow).not.toContain('2026-08-26');
    expect(failedDataRow).not.toContain('USD 1,258.5');
    expect(failedDataRow).not.toContain('USD 8.5');
    expect((failedDataRow.match(/>—</g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('reuses the original payment item list styling and mobile expand target', () => {
    const css = readFileSync(new URL('./PaymentProjectPaymentDetailPage.css', import.meta.url), 'utf8');
    const sharedCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

    expect(css).toContain('.payment-project-detail-item-head,');
    expect(css).toContain('.payment-project-detail-item-trigger');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(sharedCss).toContain('.payment-batch-item-list');
    expect(sharedCss).toMatch(/\.payment-batch-item-trigger > \.payment-batch-item-expand-icon\s*{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/);
    expect(css).not.toContain('.payment-project-detail-table');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
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
    expect(html).toContain('payment-project-summary-card is-result-success');
    expect(html).toContain('payment-project-summary-card is-updated');
    expect(html).toContain('data-payment-provider="Airwallex"');
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
    expect(html).not.toContain('simple-status"><i></i>已完成');
  });
});
