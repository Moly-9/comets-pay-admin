import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceReviewWorkspace } from './InvoiceReviewWorkspace';

const baseProps = {
  issueCount: 0,
  sourceStatusText: '等待媒介审核',
  documentName: 'invoice.pdf',
  documentMeta: '1 页',
  documentContent: <div data-review-evidence="AMOUNT">USD 4,800</div>,
  contractChecks: [],
  noContract: true,
  accountRows: [{ label: '账户审核状态', value: '已审核通过' }],
  timeline: [{ id: 'created', title: '任务创建', description: '已完成', state: 'COMPLETE' as const }],
  completion: { completed: 4, total: 4 },
  blockingReasons: [] as string[],
};

describe('InvoiceReviewWorkspace', () => {
  it('keeps the four audit tabs stable for an internal Invoice', () => {
    const html = renderToStaticMarkup(
      <InvoiceReviewWorkspace
        {...baseProps}
        sourceType="INTERNAL_GENERATED"
        summaryFields={[{ id: 'amount', label: '金额和币种', value: 'USD 4,800', evidenceTarget: '[data-review-evidence="AMOUNT"]' }]}
      />,
    );
    expect(html).toContain('系统生成');
    expect(html).toContain('审核概览');
    expect(html).toContain('合同匹配 · 无合同');
    expect(html).toContain('收款账户');
    expect(html).toContain('审核记录');
    expect(html).toContain('系统字段已校验');
    expect(html).toContain('invoice-review-summary-list');
    expect(html).toContain('--invoice-review-left:40%');
  });

  it('shows external exceptions first and explains why approval is disabled', () => {
    const html = renderToStaticMarkup(
      <InvoiceReviewWorkspace
        {...baseProps}
        sourceType="EXTERNAL_UPLOADED"
        issueCount={1}
        overviewFields={[{
          id: 'AMOUNT',
          label: '总金额',
          baselineValue: '4800.00',
          confirmedValue: '4800.00',
          status: 'PENDING_REVIEW',
          statusLabel: '待媒介复核',
          evidenceTarget: 'AMOUNT',
          evidence: {
            sourceValue: '4800.00',
            recognizedValue: '4600.00',
            confirmedValue: '4800.00',
          },
          allowConfirmCorrection: true,
        }]}
        blockingReasons={['总金额的达人纠正值待媒介确认']}
        completion={{ completed: 3, total: 4 }}
        canReview
        onFieldAction={vi.fn()}
        approveLabel="审核通过"
        approveDisabled
        onApprove={vi.fn()}
      />,
    );
    expect(html).toContain('外部上传');
    expect(html).toContain('1项待媒介复核');
    expect(html).toContain('总金额的达人纠正值待媒介确认');
    expect(html).toContain('确认纠正');
    expect(html).toContain('disabled=""');
    expect(html).toContain('invoice-review-field-list');
    expect(html).not.toContain('invoice-review-compare-table');
  });
});
