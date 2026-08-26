import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PaymentListRecord } from '../businessWorkflow';
import {
  normalizeRequestPaymentChannels,
  paymentRecordsFromLists,
  paymentListsForRequest,
  requestPayeesFromPaymentLists,
  requestExpectedPaymentDateLabel,
  requestPaymentChannelLabel,
  requestPaymentMethodLabel,
  requestPaymentStatusLabel,
  requestTransferMethodLabel,
} from './RequestProjectDetailPage';

describe('request project payment presentation', () => {
  it('keeps one standard payment channel across the request', () => {
    expect(requestPaymentChannelLabel('Airwallex、PayPal')).toBe('Airwallex');
    expect(requestPaymentChannelLabel(['PayPal', 'Airwallex'])).toBe('PayPal');
    expect(requestPaymentChannelLabel('payer Max')).toBe('Payer Max');
    expect(normalizeRequestPaymentChannels([
      { id: 'one', channel: 'Airwallex' },
      { id: 'two', channel: 'PayPal' },
    ])).toEqual([
      { id: 'one', channel: 'Airwallex' },
      { id: 'two', channel: 'Airwallex' },
    ]);
  });

  it('maps the selected payment channel to a user-facing method', () => {
    expect(requestPaymentMethodLabel('Airwallex')).toBe('银行转账');
    expect(requestPaymentMethodLabel('PayMax')).toBe('银行转账');
    expect(requestPaymentMethodLabel('PayPal')).toBe('PayPal');
    expect(requestPaymentMethodLabel('Airwallex、PayPal')).toBe('银行转账');
    expect(requestPaymentMethodLabel('按 Invoice 账户快照')).toBe('待确认');
    expect(requestTransferMethodLabel('LOCAL', 'Airwallex')).toBe('Local');
    expect(requestTransferMethodLabel('SWIFT', 'Airwallex')).toBe('Swift');
    expect(requestTransferMethodLabel('PAYPAL', 'PayPal')).toBe('PayPal');
  });

  it('normalizes payment rows to the four supported payout states', () => {
    expect(requestPaymentStatusLabel('等待付款', 'approved')).toBe('未付款');
    expect(requestPaymentStatusLabel('付款处理中', 'approved')).toBe('付款处理中');
    expect(requestPaymentStatusLabel('已付款', 'paid')).toBe('已付款');
    expect(requestPaymentStatusLabel('付款失败', 'paid')).toBe('付款失败');
    expect(requestPaymentStatusLabel('已退回', 'generated')).toBe('付款失败');
  });

  it('selects payment lists by stable request and explicit list IDs', () => {
    const paymentLists = [
      { paymentListId: 'list-one', paymentRequestProjectId: 'request-one' },
      { paymentListId: 'list-two', paymentRequestProjectId: 'request-two' },
      { paymentListId: 'list-three' },
    ] as unknown as PaymentListRecord[];

    expect(paymentListsForRequest({ paymentRequestProjectId: 'request-one' as never }, paymentLists))
      .toEqual([paymentLists[0]]);
    expect(paymentListsForRequest({ paymentListIds: ['list-two', 'list-three'] as never }, paymentLists))
      .toEqual([paymentLists[1], paymentLists[2]]);
  });

  it('returns a concrete expected payment date and skips weekends', () => {
    expect(requestExpectedPaymentDateLabel({
      lifecycle: 'COMPLETED',
      status: '已完成',
      createdAt: '2026-07-22T02:00:00.000Z',
    })).toBe('2026-07-22');
    expect(requestExpectedPaymentDateLabel({
      status: '待打款',
      createdAt: '2026-08-07T02:00:00.000Z',
    })).toBe('2026-08-12');
    expect(requestExpectedPaymentDateLabel(
      { status: 'PM 审批中' },
      undefined,
      new Date(2026, 7, 10),
    )).toBe('2026-08-13');
  });

  it('keeps the requested project fields and payment columns in the detail view', () => {
    const source = readFileSync(new URL('./RequestProjectDetailPage.tsx', import.meta.url), 'utf8');
    const viewerSource = readFileSync(new URL('./ProjectDetailPage.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    const sharedProjectInfo = readFileSync(
      new URL('../components/RequestProjectInfoCard.tsx', import.meta.url),
      'utf8',
    );
    const paymentTable = source.slice(
      source.indexOf('<table className="data-table request-detail-payment-table">'),
      source.indexOf('</table>', source.indexOf('<table className="data-table request-detail-payment-table">')),
    );
    const approvalActionsStart = source.lastIndexOf('<div className="invoice-review-actions request-approval-actions">');
    const approvalActions = source.slice(
      approvalActionsStart,
      source.indexOf('</div>', approvalActionsStart),
    );

    expect(source).toContain('<RequestProjectInfoCard');
    expect(sharedProjectInfo).not.toContain('<dt>审批负责人</dt>');
    expect(sharedProjectInfo).not.toContain('<dt>付款方式</dt>');
    expect(sharedProjectInfo).not.toContain('<dt>手续费承担方</dt>');
    expect(sharedProjectInfo).not.toContain('<dt>提交人</dt>');
    expect(sharedProjectInfo).not.toContain('<dt>备注附件</dt>');
    expect(sharedProjectInfo).toContain('<dt>付款渠道</dt>');
    expect(sharedProjectInfo).toContain('<dt>预计付款时间</dt>');
    expect(sharedProjectInfo).toContain('<dt>成本类型</dt>');
    expect(sharedProjectInfo).toContain('<dt>项目媒介</dt>');
    expect(sharedProjectInfo).toContain('<dt>创建时间</dt>');
    expect(sharedProjectInfo).toContain('<dt>备注</dt>');
    expect(paymentTable).toContain('<th>达人</th>');
    expect(paymentTable).toContain('<th>Invoice</th>');
    expect(paymentTable).toContain('<th>请款金额</th>');
    expect(paymentTable).toContain('<th>付款渠道</th>');
    expect(paymentTable).toContain('<th>付款方式</th>');
    expect(paymentTable).toContain('<th>状态</th>');
    expect(paymentTable).toContain('<Avatar');
    expect(paymentTable).toContain('<PaymentProviderBadge compact provider={payee.channel} />');
    expect(paymentTable).toContain('request-detail-transfer-method');
    expect(paymentTable).toContain('{handle} · {platform}');
    expect(styles).toContain('.request-detail-creator-cell');
    expect(approvalActions.indexOf('退回媒介修改')).toBeLessThan(approvalActions.indexOf('审批通过'));
    expect(styles).toMatch(/\.request-approval-actions\s*{[^}]*justify-content:\s*flex-end;/s);
    expect(styles).toMatch(/\.request-payment-review-modal \.modal-content\s*{[^}]*overflow:\s*hidden;/s);
    expect(styles).toMatch(/\.request-payment-review-modal \.request-payment-payee-table-scroll\s*{[^}]*scroll-padding-bottom:\s*12px;/s);
    expect(viewerSource).toContain("viewer.kind === 'contract' ? record.title : record.id");
    expect(viewerSource).toContain("viewer.kind === 'contract' ? record.id : record.title");
    expect(viewerSource).toContain("viewer.kind === 'contract' && record.status === '已签署'");
    expect(viewerSource).toContain("viewer.kind === 'invoice' && record.status === '已校验'");
    expect(viewerSource).toContain('project-record-item-icon is-${viewer.kind}');
    expect(styles).toContain('.project-record-item-icon.is-contract');
    expect(styles).toContain('.project-record-item-icon.is-invoice');
    expect(styles).not.toContain('.project-record-browser-heading.is-invoice');
    expect(styles).toContain('background: #eef6ff;');
    expect(styles).toContain('background: #f4efff;');
    expect(styles).toContain('.project-record-item .project-record-status.is-success');
  });

  it('keeps editable remark screenshots but simplifies the my-project detail fields', () => {
    const myProjectsSource = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');
    const sharedProjectInfo = readFileSync(
      new URL('../components/RequestProjectInfoCard.tsx', import.meta.url),
      'utf8',
    );
    const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

    expect(myProjectsSource).toContain('<RequestProjectInfoCard');
    expect(sharedProjectInfo).toContain('<dt>成本类型</dt>');
    expect(sharedProjectInfo).not.toContain('<dt>手续费承担方</dt>');
    expect(sharedProjectInfo).toContain('<dt>备注</dt>');
    expect(sharedProjectInfo).not.toContain('<dt>备注附件</dt>');
    expect(myProjectsSource).not.toContain('aria-label="上传备注附件"');
    expect(myProjectsSource).toContain('onPaste={handleRemarkPaste}');
    expect(myProjectsSource).toContain('<RequestRemarkAttachments');
    expect(myProjectsSource).toContain('className="metric-card metric-blue"');
    expect(myProjectsSource).toContain('审批处理请前往“合作项目”工作台');
    expect(myProjectsSource).not.toContain('审批处理请前往“请款项目”工作台');
    expect(appSource).not.toContain('!request.feeBearer');
    expect(appSource).not.toContain('feeBearer: request.feeBearer');
  });

  it('maps real payment-list snapshots into the shared read-only project viewer', () => {
    const records = paymentRecordsFromLists([{
      paymentListId: 'payment-list-one',
      paymentListCode: 'PAY-301164-01',
      projectId: 'project-one',
      provider: 'Airwallex',
      status: 'paid',
      version: 2,
      generatedAt: '2026-08-01T12:00:00.000Z',
      updatedAt: '2026-08-01T12:00:00.000Z',
      createdAt: '2026-08-01T10:00:00.000Z',
      items: [{
        id: 'payment-item-one',
        engagementId: 'engagement-one',
        invoiceId: 'invoice-one',
        snapshot: {
          invoiceNumber: 'INV-301164-01',
          creatorName: '项目达人 01',
          currency: 'USD',
          receiveCurrency: 'USD',
          amount: 3800,
          provider: 'Airwallex',
          accountSummary: '•••• 3011',
          paymentReason: '创作者合作款',
          transactionReference: 'REQ-301164-01',
          description: '',
          feeBearer: 'ADVERTISER',
        },
        overrides: {},
      }],
    } as unknown as PaymentListRecord], '#301164 DCD 项目');

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: 'PAY-301164-01-01',
      title: '项目达人 01',
      subtitle: 'PAY-301164-01 · Airwallex',
      amount: 'USD 3,800.00',
      status: '已付款',
    });
    expect(records[0].fields).toEqual(expect.arrayContaining([
      { label: '关联 Invoice', value: 'INV-301164-01' },
      { label: '付款方式', value: '银行转账' },
      { label: '收款账户', value: '历史记录未保存完整账号' },
      { label: '清单版本', value: 'v2' },
    ]));
  });

  it('uses bound payment-list snapshots for request payment rows', () => {
    const payees = requestPayeesFromPaymentLists([{
      paymentListId: 'payment-list-one',
      paymentListCode: 'PAY-301164-01',
      projectId: 'project-one',
      provider: 'Airwallex',
      status: 'submitted',
      version: 1,
      generatedAt: '2026-08-01T12:00:00.000Z',
      updatedAt: '2026-08-01T12:00:00.000Z',
      createdAt: '2026-08-01T10:00:00.000Z',
      items: [{
        id: 'payment-item-one',
        engagementId: 'engagement-one',
        invoiceId: 'invoice-one',
        snapshot: {
          invoiceNumber: 'INV-301164-19',
          creatorName: 'Mina Kato',
          currency: 'USD',
          amount: 1250,
          provider: 'Airwallex',
          creatorId: 'creator-mina',
          creatorHandle: '@MinaKato',
          transferMethod: 'LOCAL',
          localClearingSystem: 'ZENGIN',
        },
        overrides: {},
      }],
    } as unknown as PaymentListRecord], [{
      id: 'creator-mina',
      name: 'Mina Kato',
      handle: '@MinaKato',
      platform: 'Instagram · TikTok',
      initials: 'MK',
      accent: '#f59e0b',
    }] as never, [{
      invoiceId: 'invoice-one',
      sourcePayoutId: 'payout-one',
    }] as never, [{
      id: 'payout-one',
      invoice: 'INV-301164-19',
      status: '付款处理中',
    }] as never);

    expect(payees).toEqual([{
      name: 'Mina Kato',
      creatorId: 'creator-mina',
      handle: '@MinaKato',
      platform: 'Instagram · TikTok',
      initials: 'MK',
      accent: '#f59e0b',
      invoice: 'INV-301164-19',
      amount: 'USD 1,250.00',
      channel: 'Airwallex',
      paymentMethod: 'Local',
      status: '付款处理中',
    }]);
  });

  it('renders the compact payment review table with automatic API validation and export', () => {
    const source = readFileSync(new URL('./RequestProjectDetailPage.tsx', import.meta.url), 'utf8');
    const viewerSource = readFileSync(
      new URL('../components/PaymentListReviewContent.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('<PaymentListReviewContent');
    expect(viewerSource).not.toContain('校验 Airwallex 付款信息完整性</Button>');
    expect(viewerSource).toContain('await validatePaymentListAccountViaApi({ item: row.item, creators })');
    expect(viewerSource).toContain('导出 Excel');
    expect(viewerSource).toContain('<th>达人名称</th>');
    expect(viewerSource).toContain('<th>收款账户</th>');
    expect(viewerSource).toContain('<th>支付币种</th>');
    expect(viewerSource).toContain('<th>收款方币种</th>');
    expect(viewerSource).toContain('<th>Invoice 金额</th>');
    expect(viewerSource).toContain('<th>手续费承担方</th>');
    expect(viewerSource).toContain('<th>API 校验结果</th>');
    expect(viewerSource).toContain('validatePaymentListAccountViaApi');
    expect(viewerSource).toContain('onExportPaymentList(list.paymentListId)');
    expect(viewerSource).not.toContain('添加付款行');
    expect(viewerSource).not.toContain('删除清单');
    expect(viewerSource).not.toContain('编辑付款清单');
    expect(viewerSource).not.toContain('生成付款单');
  });
});
