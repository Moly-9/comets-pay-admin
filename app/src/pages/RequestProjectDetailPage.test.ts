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
} from './RequestProjectDetailPage';

describe('request project payment presentation', () => {
  it('keeps one standard payment channel across the request', () => {
    expect(requestPaymentChannelLabel('Airwallex、PayPal')).toBe('Airwallex');
    expect(requestPaymentChannelLabel(['PayPal', 'Airwallex'])).toBe('PayPal');
    expect(requestPaymentChannelLabel('payer Max')).toBe('PayMax');
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
    const projectInfo = source.slice(
      source.indexOf('<dl className="project-info-grid">'),
      source.indexOf('</dl>', source.indexOf('<dl className="project-info-grid">')),
    );
    const paymentTable = source.slice(
      source.indexOf('<table className="data-table request-detail-payment-table">'),
      source.indexOf('</table>', source.indexOf('<table className="data-table request-detail-payment-table">')),
    );

    expect(projectInfo).not.toContain('<dt>审批负责人</dt>');
    expect(projectInfo).not.toContain('<dt>付款方式</dt>');
    expect(projectInfo).toContain('<dt>付款渠道</dt>');
    expect(projectInfo).toContain('<dt>预计付款时间</dt>');
    expect(projectInfo).toContain('<dt>成本类型</dt>');
    expect(projectInfo).toContain('<dt>手续费承担方</dt>');
    expect(projectInfo).toContain('<dt>备注</dt>');
    expect(projectInfo).toContain('<dt>备注附件</dt>');
    expect(paymentTable).toContain('<th>达人</th>');
    expect(paymentTable).toContain('<th>Invoice</th>');
    expect(paymentTable).toContain('<th>请款金额</th>');
    expect(paymentTable).toContain('<th>付款渠道</th>');
    expect(paymentTable).toContain('<th>付款方式</th>');
    expect(paymentTable).toContain('<th>状态</th>');
  });

  it('keeps the extra request fields in both project detail entries', () => {
    const myProjectsSource = readFileSync(new URL('./MediaPaymentProjectsPage.tsx', import.meta.url), 'utf8');

    expect(myProjectsSource).toContain('<dt>成本类型</dt>');
    expect(myProjectsSource).toContain('<dt>手续费承担方</dt>');
    expect(myProjectsSource).toContain('<dt>备注</dt>');
    expect(myProjectsSource).toContain('<dt>备注附件</dt>');
    expect(myProjectsSource).toContain('aria-label="上传备注附件"');
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
      { label: '收款账户', value: '•••• 3011' },
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
        },
        overrides: {},
      }],
    } as unknown as PaymentListRecord]);

    expect(payees).toEqual([{
      name: 'Mina Kato',
      invoice: 'INV-301164-19',
      amount: 'USD 1,250.00',
      channel: 'Airwallex',
      status: '已提交',
    }]);
  });

  it('renders approval-focused payment fields, API validation, and export without mutation controls', () => {
    const source = readFileSync(new URL('./RequestProjectDetailPage.tsx', import.meta.url), 'utf8');
    const viewerSource = readFileSync(
      new URL('../components/PaymentListReviewContent.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('<PaymentListReviewContent');
    expect(viewerSource).toContain('校验 Airwallex 付款信息完整性');
    expect(viewerSource).toContain('导出 Excel');
    expect(viewerSource).toContain('<dt>收款账户</dt>');
    expect(viewerSource).toContain('<dt>付款金额</dt>');
    expect(viewerSource).toContain('<dt>费用承担</dt>');
    expect(viewerSource).toContain('<dt>交易附言</dt>');
    expect(viewerSource).toContain('validatePaymentListAccountViaApi');
    expect(viewerSource).toContain('onExportPaymentList(list.paymentListId)');
    expect(viewerSource).not.toContain('添加付款行');
    expect(viewerSource).not.toContain('删除清单');
    expect(viewerSource).not.toContain('编辑付款清单');
    expect(viewerSource).not.toContain('生成付款单');
  });
});
