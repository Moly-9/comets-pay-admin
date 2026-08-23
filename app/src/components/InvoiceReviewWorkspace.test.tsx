import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceReviewWorkspace } from './InvoiceReviewWorkspace';

const baseProps = {
  issueCount: 0,
  sourceStatusText: '待审核',
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
          statusLabel: '待复核',
          evidenceTarget: 'AMOUNT',
          evidence: {
            sourceValue: '4800.00',
            recognizedValue: '4600.00',
            confirmedValue: '4800.00',
          },
          allowConfirmCorrection: true,
        }]}
        blockingReasons={['总金额的达人纠正值待确认']}
        completion={{ completed: 3, total: 4 }}
        canReview
        onFieldAction={vi.fn()}
        approveLabel="审核通过"
        approveDisabled
        onApprove={vi.fn()}
      />,
    );
    expect(html).toContain('外部上传');
    expect(html).toContain('1项待复核');
    expect(html).toContain('总金额的达人纠正值待确认');
    expect(html).not.toContain('待媒介复核');
    expect(html).toContain('确认纠正');
    expect(html).toContain('disabled=""');
    expect(html).toContain('invoice-review-field-list');
    expect(html).not.toContain('invoice-review-compare-table');
  });

  it('shows an Invoice return reason at the top of the overview', () => {
    const html = renderToStaticMarkup(
      <InvoiceReviewWorkspace
        {...baseProps}
        sourceType="INTERNAL_GENERATED"
        overviewNotice={{
          title: '财务退回 · Invoice',
          message: 'Invoice 主体需要修改',
          meta: '财务审核人 · 2026/08/11 13:00',
          tone: 'danger',
        }}
      />,
    );

    expect(html).toContain('invoice-review-overview-notice is-danger');
    expect(html).toContain('财务退回 · Invoice');
    expect(html).toContain('Invoice 主体需要修改');
    expect(html.indexOf('财务退回 · Invoice')).toBeLessThan(html.indexOf('结构化 Invoice 摘要'));
  });

  it('expands correctly matched fields by default while keeping the disclosure collapsible', () => {
    const html = renderToStaticMarkup(
      <InvoiceReviewWorkspace
        {...baseProps}
        sourceType="EXTERNAL_UPLOADED"
        issueCount={0}
        overviewFields={[{
          id: 'CURRENCY',
          label: '币种',
          baselineValue: 'USD',
          confirmedValue: 'USD',
          status: 'MATCHED',
          statusLabel: '一致',
          evidenceTarget: 'CURRENCY',
        }]}
      />,
    );

    expect(html).toContain('<details class="invoice-review-matched-details" open="">');
    expect(html).toContain('正常匹配项（1）');
  });

  it('renders the collection baseline and pending contract state before a file is uploaded', () => {
    const html = renderToStaticMarkup(
      <InvoiceReviewWorkspace
        {...baseProps}
        sourceType="EXTERNAL_UPLOADED"
        documentUnavailable
        downloadDisabled
        externalSummary
        issueStatusText="等待达人上传"
        summaryFields={[
          { id: 'creator', label: '达人', value: 'Alicia Lin', secondary: '@alicia' },
          { id: 'amount', label: '预计币种&金额', value: 'USD 4,800.00' },
        ]}
        contractChecks={[]}
        noContract={false}
        contractPending
        footerStatus={{ title: '等待达人上传 Invoice', message: '任务基准已固定。' }}
      />,
    );

    expect(html).toContain('收集任务与校验基准');
    expect(html).toContain('合同匹配 · 待上传');
    expect(html).toContain('-- / --');
    expect(html).toContain('is-document-unavailable');
  });

  it('shows the generation note inside each approved contract mismatch card', () => {
    const html = renderToStaticMarkup(
      <InvoiceReviewWorkspace
        {...baseProps}
        sourceType="INTERNAL_GENERATED"
        initialTab="contract"
        noContract={false}
        contractChecks={[{
          id: 'amount',
          label: '应付金额',
          contractValue: 'USD 4,600.00',
          invoiceValue: 'USD 4,800.00',
          state: 'WARNING',
          note: '合同金额与 Invoice 明细总额不一致。',
        }]}
        contractMismatchReview={{
          reason: '合同为预算金额，Invoice 按实际验收金额结算。',
          meta: '生成 Invoice 时填写 · 媒介测试 · 2026/08/24 10:00',
        }}
      />,
    );

    expect(html).toContain('合同匹配 0/1 · 1项需关注');
    expect(html).toContain('invoice-review-contract-mismatch-reason');
    expect(html).toContain('不一致原因');
    expect(html).toContain('合同为预算金额，Invoice 按实际验收金额结算。');
    expect(html).toContain('生成 Invoice 时填写 · 媒介测试');
  });
});
