import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  normalizeRequestPaymentChannels,
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
    expect(paymentTable).toContain('<th>达人</th>');
    expect(paymentTable).toContain('<th>Invoice</th>');
    expect(paymentTable).toContain('<th>请款金额</th>');
    expect(paymentTable).toContain('<th>付款渠道</th>');
    expect(paymentTable).toContain('<th>付款方式</th>');
    expect(paymentTable).toContain('<th>状态</th>');
  });
});
