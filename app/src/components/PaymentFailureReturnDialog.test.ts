import { describe, expect, it } from 'vitest';
import { PAYMENT_FAILURE_ISSUE_OPTIONS } from './PaymentFailureReturnDialog';

describe('PaymentFailureReturnDialog issue options', () => {
  it('presents account recovery as a payment account issue without changing its recovery scope', () => {
    expect(PAYMENT_FAILURE_ISSUE_OPTIONS).toEqual([
      { value: 'INVOICE_CONTENT', label: 'Invoice 内容问题', description: '修改 Invoice 并重新签署' },
      { value: 'PAYMENT_LIST', label: '付款账户问题', description: '仅恢复失败达人的收款账户' },
    ]);
    expect(PAYMENT_FAILURE_ISSUE_OPTIONS.some((option) => option.label === '付款清单问题')).toBe(false);
  });
});
