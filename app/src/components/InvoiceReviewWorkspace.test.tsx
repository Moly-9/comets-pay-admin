import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  InvoiceReviewReturnDialogContent,
  InvoiceReviewWorkspace,
} from './InvoiceReviewWorkspace';

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

  it('identifies creator-entered payment information as prototype-only account data', () => {
    const html = renderToStaticMarkup(
      <InvoiceReviewWorkspace
        {...baseProps}
        sourceType="INTERNAL_GENERATED"
        initialTab="account"
        accountTitle="达人填写的付款信息"
        accountDescription="当前仅为前端原型展示，待接入付款账户接口后展示完整字段"
        accountRows={[
          { label: '付款渠道', value: 'PayPal' },
          { label: 'PayPal Email', value: 'creator@example.test' },
        ]}
      />,
    );

    expect(html).toContain('达人填写的付款信息');
    expect(html).toContain('当前仅为前端原型展示，待接入付款账户接口后展示完整字段');
    expect(html).toContain('<dt>付款渠道</dt><dd>PayPal</dd>');
    expect(html).toContain('<dt>PayPal Email</dt><dd>creator@example.test</dd>');
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

  it('shows the current-version mismatch reason once above the contract checks', () => {
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
    expect(html).toContain('invoice-contract-mismatch-notice');
    expect(html).toContain('合同差异说明');
    expect(html.match(/合同为预算金额/g)).toHaveLength(1);
    expect(html).toContain('合同为预算金额，Invoice 按实际验收金额结算。');
    expect(html).toContain('生成 Invoice 时填写 · 媒介测试');
  });

  it('renders shared contract content when an external Invoice has linked contracts', () => {
    const html = renderToStaticMarkup(
      <InvoiceReviewWorkspace
        {...baseProps}
        sourceType="EXTERNAL_UPLOADED"
        initialTab="contract"
        noContract={false}
        contractChecks={[]}
        contractContent={<div data-testid="external-contract-content">外部合同匹配与签名</div>}
      />,
    );

    expect(html).toContain('external-contract-content');
    expect(html).toContain('外部合同匹配与签名');
  });

  it('uses one return-dialog structure while keeping external handling options source-specific', () => {
    const context = {
      creatorName: 'Alicia Lin',
      invoiceNumber: 'INV-20260820-00001',
      projectName: 'Creator Campaign',
      recipientEmail: 'alicia@example.com',
    };
    const externalHtml = renderToStaticMarkup(
      <InvoiceReviewReturnDialogContent
        context={context}
        returnOptions={[
          { value: 'CORRECTION', label: '纠正识别结果', description: '原文件正确，按原文重新确认。' },
          { value: 'REUPLOAD', label: '要求重新上传', description: '原文件错误，上传新版本。' },
        ]}
        returnOption="CORRECTION"
        returnReason=""
        onOptionChange={vi.fn()}
        onReasonChange={vi.fn()}
      />,
    );
    expect(externalHtml).toContain('退回处理方式');
    expect(externalHtml).toContain('原文件正确，按原文重新确认。');
    expect(externalHtml).toContain('退回通知渠道');
    expect(externalHtml).toContain('al***ia@example.com');

    const internalHtml = renderToStaticMarkup(
      <InvoiceReviewReturnDialogContent
        context={{ ...context, instruction: '根据原因修改 Invoice 并重新签署。' }}
        returnOptions={[]}
        returnOption=""
        returnReason="主体需要修改"
        onOptionChange={vi.fn()}
        onReasonChange={vi.fn()}
      />,
    );
    expect(internalHtml).not.toContain('退回处理方式');
    expect(internalHtml).toContain('根据原因修改 Invoice 并重新签署。');
    expect(internalHtml).toContain('6/300');
  });
});
