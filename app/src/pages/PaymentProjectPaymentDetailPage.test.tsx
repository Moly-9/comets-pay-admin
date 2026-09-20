import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applyPaymentBatchPrototypeScenario, PAYMENT_BATCH_RETRY_DEMO } from '../paymentBatchPrototypeScenario';
import { createInitialPaymentBatches, createPaymentProjectPaymentRecord } from '../paymentBatches';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';
import {
  buildPaymentProjectAttemptRows,
  PaymentProjectItemDrawer,
  PaymentProjectPaymentDetailPage,
} from './PaymentProjectPaymentDetailPage';

const resources = applyPaymentBatchPrototypeScenario({
  payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
  requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
  generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
  paymentLists: INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists,
});
const paymentBatches = createInitialPaymentBatches({
  payouts: resources.payouts,
  requests: resources.requests,
  generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
  paymentLists: resources.paymentLists,
  contracts: INITIAL_COMPLETE_REQUEST_RESOURCES.contracts,
});

const failedRequest = resources.requests.find((request) => request.requestCode === 'REQ-202607-000011')!;
const failedRecord = createPaymentProjectPaymentRecord({
  request: failedRequest,
  payouts: resources.payouts,
  generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
  paymentLists: resources.paymentLists,
  contracts: INITIAL_COMPLETE_REQUEST_RESOURCES.contracts,
  paymentBatches,
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
  paymentBatches,
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
    expect(html.match(/>查看详情<\/span>/g)).toHaveLength(4);
    expect(html).toContain('付款退回');
    expect(html).toContain('已退回');
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
    expect(html).toContain('>付款渠道</dt>');
    expect(html).toContain('>请款金额</dt>');
    const projectInfoStart = html.indexOf('payment-batch-project-grid payment-project-info-cards');
    const projectInfo = html.slice(projectInfoStart, html.indexOf('</dl>', projectInfoStart));
    expect(projectInfo.indexOf('付款编号')).toBeLessThan(projectInfo.indexOf('付款渠道'));
    expect(projectInfo.indexOf('付款渠道')).toBeLessThan(projectInfo.indexOf('请款金额'));
    expect(html).toContain(`simple-status is-success"><i></i>${failedRecord.status}`);
    expect(html).not.toContain('请款项目 / 所属项目');
    expect(html).not.toContain('<dt>请款编号</dt>');
    expect(html).toContain(`${failedRecord.items.length} 笔付款明细`);
    expect(html).toContain(`${failedRecord.items.length + 2} 条付款记录`);
    const headings = [
      '达人名称',
      '付款编号',
      '付款类型',
      '付款渠道',
      '收款银行账号',
      '付款日期',
      '请款金额',
      '单笔支付金额',
      '手续费',
      '退款金额',
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
    expect(html).toContain('>退款金额</th>');
    const returnBadgeIndex = html.indexOf('付款退回');
    const returnRowStart = html.lastIndexOf('<tr', returnBadgeIndex);
    const returnRow = html.slice(returnRowStart, html.indexOf('</tr>', returnBadgeIndex));
    expect(returnRow).toContain('<td class="payment-project-detail-money-cell">HKD 0</td>');
    expect(returnRow).toContain('<td class="payment-project-detail-money-cell">HKD 15,288</td>');
    const retriedPayout = resources.payouts.find((payout) => (
      payout.currentPaymentAttempt?.paymentBatchCode === PAYMENT_BATCH_RETRY_DEMO.retryBatchCode
    ));
    expect(html).toContain(retriedPayout?.paymentCode);
    expect(html).toContain('首次付款');
    expect(html).toContain('二次付款');
    expect(html).toContain('HKD 15,318.58');
    expect(html).toContain('HKD 30.58');
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

  it('expands retry history into independently numbered attempt rows', () => {
    const rows = buildPaymentProjectAttemptRows({ items: failedRecord.items, payouts: resources.payouts });
    const retriedPayout = resources.payouts.find((payout) => (
      payout.currentPaymentAttempt?.paymentBatchCode === PAYMENT_BATCH_RETRY_DEMO.retryBatchCode
    ));
    const retryRows = rows.filter((row) => row.item.payoutId === retriedPayout?.id);

    expect(rows).toHaveLength(failedRecord.items.length + 2);
    expect(retryRows).toHaveLength(3);
    expect(retryRows.map((row) => row.attemptNumber)).toEqual([1, 1, 2]);
    expect(retryRows.map((row) => row.recordKind)).toEqual(['PAYMENT', 'RETURN', 'PAYMENT']);
    expect(retryRows.map((row) => row.item.paymentStatus)).toEqual(['付款失败', '付款失败', '已付款']);
    expect(retryRows.map((row) => row.item.paymentCode)).toEqual([
      retriedPayout?.paymentCode,
      retriedPayout?.paymentCode,
      retriedPayout?.paymentCode,
    ]);
    expect(new Set(retryRows.map((row) => row.item.paymentCode)).size).toBe(1);
    expect(retryRows[0].item.actualPaidAmount).toBe(15_318.58);
    expect(retryRows[2].item.actualPaidAmount).toBe(15_318.58);

    const legacyPayout = {
      ...retriedPayout!,
      paymentAttempts: retriedPayout!.paymentAttempts?.map(({ paymentCode: _paymentCode, ...attempt }) => attempt),
    };
    const legacyRows = buildPaymentProjectAttemptRows({
      items: failedRecord.items.filter((item) => item.payoutId === retriedPayout?.id),
      payouts: [legacyPayout],
    });
    expect(legacyRows.map((row) => row.item.paymentCode)).toEqual([
      undefined,
      undefined,
      retriedPayout?.paymentCode,
    ]);

    const pendingReturnRows = buildPaymentProjectAttemptRows({
      items: failedRecord.items.filter((item) => item.payoutId === retriedPayout?.id),
      payouts: [{
        ...retriedPayout!,
        refundAmount: undefined,
        refundCurrency: undefined,
        refundedAt: undefined,
        paymentAttempts: retriedPayout!.paymentAttempts?.map((attempt) => (
          attempt.status === '付款失败'
            ? { ...attempt, refundAmount: undefined, refundCurrency: undefined, refundedAt: undefined }
            : attempt
        )),
      }],
    });
    expect(pendingReturnRows.find((row) => row.recordKind === 'RETURN')).toMatchObject({
      refundAmount: undefined,
      refundedAt: undefined,
    });
  });

  it('uses attempt-level channel results and keeps status inside the fixed status column', () => {
    const sourceItem = failedRecord.items[0];
    const paidItem = {
      ...sourceItem,
      paymentStatus: '已付款' as const,
      paymentSubmittedAt: '2026-08-25T23:55:00.000Z',
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

    expect(paidHtml).toContain('2026-08-25');
    expect(paidHtml).not.toContain('2026-08-26');
    expect(paidHtml).toContain('HKD 15,288 + USD 8.5');
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

    expect((processingHtml.match(/待渠道回写/g) ?? [])).toHaveLength(2);
    expect(processingHtml).toContain('2026-08-25');
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

    expect(failedDataRow).toContain('2026-08-25');
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
    expect(drawerHtml).not.toContain('账户版本');
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

    expect((drawerHtml.match(/payment-project-attempt-card/g) ?? [])).toHaveLength(2);
    expect(drawerHtml).toContain('首次付款');
    expect(drawerHtml).toContain('付款批次号');
    expect(drawerHtml).toContain('所属批次');
    expect(drawerHtml).toContain('BAT-20260805-008');
    expect(drawerHtml).toContain('BAT-20260806-001');
    expect(drawerHtml).toContain('执行打款时间');
    expect(drawerHtml).toContain('2026-08-05 16:00');
    expect(drawerHtml).toContain('2026-08-06 10:15');
    expect(drawerHtml).toContain('渠道回写时间');
    expect(drawerHtml).toContain('2026-08-06 10:20');
    expect(drawerHtml).toContain('HKD 30.58');
    expect(drawerHtml).toContain('HKD 15,318.58');
    expect(drawerHtml).toContain('累计净支出金额');
    expect(drawerHtml).toContain('HKD 15,349.16');
    expect(drawerHtml).toContain('累计手续费');
    expect(drawerHtml).toContain('HKD 61.16');
    expect(drawerHtml).toContain('BENEFICIARY_UNAVAILABLE');
    expect(drawerHtml).toContain('The beneficiary is temporarily unavailable.');
    expect(drawerHtml).toContain('业务退回原因');
    expect(drawerHtml.indexOf('渠道结果')).toBeLessThan(drawerHtml.indexOf('付款信息'));
    const paymentInfo = drawerHtml.slice(drawerHtml.indexOf('付款信息'));
    expect(paymentInfo).not.toContain('<dt>支付总金额</dt>');
    expect(paymentInfo).not.toContain('<dt>手续费金额</dt>');
    expect(paymentInfo).not.toContain('<dt>交易后余额</dt>');

    const firstAttemptDrawerHtml = renderToStaticMarkup(
      <PaymentProjectItemDrawer
        item={retryItem!}
        payout={retryPayout}
        selectedAttemptNumber={1}
        canHandleFailure={false}
        onClose={vi.fn()}
      />,
    );
    const resultGridStart = firstAttemptDrawerHtml.indexOf('payment-project-item-drawer-grid');
    const resultGrid = firstAttemptDrawerHtml.slice(
      resultGridStart,
      firstAttemptDrawerHtml.indexOf('</dl>', resultGridStart),
    );
    expect(resultGrid).toContain(`<dt>付款批次号</dt><dd class="payment-project-drawer-payment-code">${PAYMENT_BATCH_RETRY_DEMO.originalBatchCode}</dd>`);
    expect(resultGrid).not.toContain(PAYMENT_BATCH_RETRY_DEMO.retryBatchCode);
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
    expect(css).toContain('min-width: max(100%, 1848px)');
    expect(css).toContain('.payment-project-detail-code-heading');
    expect(css).toContain('.payment-project-detail-type-heading');
    expect(css).toContain('.payment-project-attempt-badge');
    expect(css).toMatch(/\.payment-project-attempt-badge\.is-return\s*{[^}]*background: #fff2f0;[^}]*color: #9a4b42;/s);
    expect(css).toContain('.payment-project-attempt-card.is-current');
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
    expect(css).toMatch(/\.payment-project-attempt-history\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s);
    expect(css).toContain('.payment-project-retry-badge');
    expect(css).toContain('font-size: 30px');
    expect(css).toMatch(/\.payment-project-payment-detail-page:not\(\.payment-batch-payment-detail-page\) \.payment-batch-detail-total > strong\s*{[^}]*font-size: 30px;[^}]*font-weight: 500;/s);
    expect(css).toMatch(/\.payment-project-payment-detail-page\.payment-batch-detail-page \.payment-project-summary-card strong\s*{[^}]*font-weight: 500;/s);
    expect(css).toMatch(/\.payment-project-payment-detail-page\.payment-batch-payment-detail-page\.payment-batch-detail-page[\s\S]*?\.payment-project-summary-provider \.payment-provider-badge\s*{[^}]*font-size: 18px;[^}]*font-weight: 500;/s);
    expect(css).toContain('border-radius: 14px');
    expect(css).toContain('.payment-project-info-cards');
    expect(css).toContain('min-height: 44px');
    expect(css).toMatch(/\.is-resource-download \.custom-select-trigger:not\([^}]+\)\s*{[^}]*color:\s*#20242c;/s);
    expect(css).toMatch(/\.is-detail-download:not\([^}]+\)\s*{[^}]*color:\s*#20242c;/s);
    expect(css).toMatch(/\.is-confirmation-download \.custom-select-trigger:not\([^}]+\)\s*{[^}]*color:\s*#20242c;/s);
    expect(css).toMatch(/\.payment-project-section-heading > span,[\s\S]*?\.payment-project-info-icon\s*{[^}]*color:\s*#405776;/s);
    expect(css).toMatch(/\.payment-project-item-drawer-section h3 svg\s*{[^}]*color:\s*#405776;/s);
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
    expect(html).toContain('5 成功 · 1 失败');
    expect(html).toContain('以渠道回写时间为准');
    expect(html).toContain('title="仅已付款明细可以生成确认函。"');
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
