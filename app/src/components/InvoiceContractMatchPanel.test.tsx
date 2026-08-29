import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { InvoiceContractMatchIssue } from '../types';
import type { InvoiceContractMatchCheck } from '../invoice/invoiceContractMatching';
import { InvoiceContractMatchPanel, type InvoiceContractMatchPanelValue } from './InvoiceContractMatchPanel';

const issue = (
  severity: InvoiceContractMatchIssue['severity'],
  message: string,
): InvoiceContractMatchIssue => ({
  field: severity === 'BLOCKER' ? 'PUBLISHER' : 'AMOUNT',
  label: severity === 'BLOCKER' ? '收款主体' : '应付金额',
  severity,
  contractIds: [],
  contractValue: '合同值',
  invoiceValue: 'Invoice 值',
  message,
});

const checks = (state: InvoiceContractMatchCheck['state']): InvoiceContractMatchCheck[] => ([
  { field: 'PUBLISHER', label: '收款主体', contractValue: 'A', invoiceValue: 'A', state: 'MATCH', message: '合同与 Invoice 一致。' },
  { field: 'ADVERTISER', label: '付款主体', contractValue: 'B', invoiceValue: 'B', state: 'MATCH', message: '合同与 Invoice 一致。' },
  { field: 'AMOUNT', label: '应付金额', contractValue: 'USD 100', invoiceValue: 'USD 120', state, message: '金额不一致。' },
  { field: 'CURRENCY', label: '币种', contractValue: 'USD', invoiceValue: 'USD', state: 'MATCH', message: '合同与 Invoice 一致。' },
  { field: 'PAYMENT_ACCOUNT', label: '付款账户', contractValue: 'A', invoiceValue: 'A', state: 'MATCH', message: '合同与 Invoice 一致。' },
]);

describe('InvoiceContractMatchPanel', () => {
  it('renders the shared five-check layout and per-invoice mismatch reason', () => {
    const reasonIssue = issue('REASON_REQUIRED', '金额不一致。');
    const match: InvoiceContractMatchPanelValue = {
      result: 'REASON_REQUIRED',
      checks: checks('REASON_REQUIRED'),
      blockerIssues: [],
      reasonRequiredIssues: [reasonIssue],
    };
    const html = renderToStaticMarkup(
      <InvoiceContractMatchPanel
        match={match}
        reason=""
        contextLabel="Mina Kato"
        reasonInputId="batch-match-reason"
        onReasonChange={() => undefined}
      />,
    );

    expect(html).toContain('aria-label="Mina Kato 合同匹配"');
    expect(html.match(/invoice-contract-match-grid/g)).toHaveLength(1);
    expect(html.match(/<article/g)).toHaveLength(5);
    expect(html).toContain('存在可放行差异，请填写说明');
    expect(html).toContain('id="batch-match-reason"');
    expect(html).toContain('合同差异说明 *');
    expect(html).toContain('0/300');
  });

  it('renders blocking issues without a reason input', () => {
    const blocker = issue('BLOCKER', '每份合同的 Publisher 必须与 Invoice 一致。');
    const match: InvoiceContractMatchPanelValue = {
      result: 'BLOCKED',
      checks: checks('MATCH').map((check) => check.field === 'PUBLISHER'
        ? { ...check, state: 'BLOCKER' as const, message: blocker.message }
        : check),
      blockerIssues: [blocker],
      reasonRequiredIssues: [],
    };
    const html = renderToStaticMarkup(
      <InvoiceContractMatchPanel match={match} reason="" />,
    );

    expect(html).toContain('主体不一致，暂不能生成');
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('<textarea');
  });
});
