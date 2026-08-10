import { renderToStaticMarkup } from 'react-dom/server';
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
  it('renders one request project with all payment details and expands the failed item', () => {
    const html = renderToStaticMarkup(
      <PaymentProjectPaymentDetailPage
        record={failedRecord}
        payouts={resources.payouts}
        canHandleFailure
        onBack={vi.fn()}
        onReturnPayout={vi.fn(() => true)}
      />,
    );

    expect(html).toContain('返回付款工作台');
    expect(html).toContain('>付款项目</span>');
    expect(html).toContain('REQ-202607-000011');
    expect(html).toContain(failedRecord.request.cooperationProjectName);
    expect(html).toContain('本页面仅展示当前请款项目，不混入同批次的其他项目');
    expect(html).toContain(`${failedRecord.items.length} 笔付款明细`);
    expect(html).toContain('付款失败需要处理');
    expect(html).toContain('退回媒介处理');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('BENEFICIARY_UNAVAILABLE');
    expect(html).not.toContain('付款批次</span>');
    expect(html).not.toContain('请款项目付款');
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
    expect(html).toContain('部分失败');
    expect(html).toContain('以渠道回写时间为准');
    expect(html).toContain('disabled=""');
    expect(html).toContain('payment-project-summary-card is-order');
    expect(html).toContain('payment-project-summary-card is-provider');
    expect(html).toContain('payment-project-summary-card is-result-danger');
    expect(html).toContain('payment-project-summary-card is-updated');
    expect(html).toContain('data-payment-provider="Airwallex"');
  });
});
