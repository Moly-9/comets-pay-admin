import { describe, expect, it } from 'vitest';
import { FINANCE_RETURN_ISSUE_OPTIONS } from './FinanceReviewWorkspace';

describe('FinanceReviewWorkspace return issue types', () => {
  it('requires finance to choose the exact resource that media may modify', () => {
    expect(FINANCE_RETURN_ISSUE_OPTIONS).toEqual([
      {
        value: 'INVOICE_CONTENT',
        label: 'Invoice 原因',
        description: '仅开放该份 Invoice 修改权限',
      },
      {
        value: 'PAYMENT_LIST',
        label: '付款清单原因',
        description: '仅开放对应付款明细修改权限',
      },
    ]);
  });
});
