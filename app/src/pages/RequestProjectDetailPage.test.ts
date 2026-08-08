import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  requestExpectedPaymentTimeLabel,
  requestPaymentMethodLabel,
} from './RequestProjectDetailPage';

describe('request project payment presentation', () => {
  it('maps payment providers to user-facing methods', () => {
    expect(requestPaymentMethodLabel('Airwallex')).toBe('银行转账');
    expect(requestPaymentMethodLabel('PayMax')).toBe('银行转账');
    expect(requestPaymentMethodLabel('PayPal')).toBe('PayPal');
    expect(requestPaymentMethodLabel('Airwallex、PayPal')).toBe('银行转账、PayPal');
    expect(requestPaymentMethodLabel('按 Invoice 账户快照')).toBe('待确认');
  });

  it('describes the expected payment time from request progress', () => {
    expect(requestExpectedPaymentTimeLabel({ lifecycle: 'COMPLETED', status: '已完成' })).toBe('已完成');
    expect(requestExpectedPaymentTimeLabel({ status: '待打款' })).toBe('3 个工作日内');
    expect(requestExpectedPaymentTimeLabel({ status: 'PM 审批中' })).toBe('全部审批通过后 3 个工作日内');
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
    expect(projectInfo).toContain('<dt>付款方式</dt>');
    expect(projectInfo).toContain('<dt>预计付款时间</dt>');
    expect(paymentTable).toContain('<th>达人</th>');
    expect(paymentTable).toContain('<th>Invoice</th>');
    expect(paymentTable).toContain('<th>请款金额</th>');
    expect(paymentTable).toContain('<th>付款渠道</th>');
    expect(paymentTable).toContain('<th>付款方式</th>');
    expect(paymentTable).toContain('<th>状态</th>');
  });
});
