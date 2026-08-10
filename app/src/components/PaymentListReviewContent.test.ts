import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FinanceReviewPage } from '../financeReview';
import { financeWorkspaceComparisonFields } from './PaymentListReviewContent';

const reviewContentSource = readFileSync(
  new URL('./PaymentListReviewContent.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = readFileSync(
  new URL('./FinanceReviewWorkspace.tsx', import.meta.url),
  'utf8',
);

describe('shared payment-list finance review content', () => {
  it('limits the finance workspace comparison to the fields selected for manual review', () => {
    const fields = [
      'invoice-number',
      'creator',
      'amount',
      'real-name',
      'account-name',
      'account-number',
      'bank-name',
      'bank-address',
      'swift-code',
      'iban',
      'reason',
      'fee',
      'reference',
      'validation',
    ].map((id) => ({
      id,
      label: id,
      invoiceValue: id,
      paymentValue: id,
      state: 'match' as const,
    }));
    const page = {
      key: 'invoice:test',
      kind: 'pair',
      invoiceId: 'invoice-test',
      invoiceNumber: 'INV-TEST',
      creatorName: 'Test Creator',
      paymentItems: [],
      sourceVersions: [],
      fields,
      mismatchCount: 0,
    } as unknown as FinanceReviewPage;

    expect(financeWorkspaceComparisonFields(page, 'current-full').map((field) => field.id)).toEqual([
      'real-name',
      'account-name',
      'account-number',
      'bank-name',
      'bank-address',
      'swift-code',
      'iban',
      'reason',
      'fee',
      'reference',
    ]);
    expect(financeWorkspaceComparisonFields(page, 'all-summary')).toEqual(fields);
  });

  it('renders the selected comparison fields and the complete current account snapshot', () => {
    expect(reviewContentSource).toContain('currentReviewFields.map');
    expect(reviewContentSource).toContain('核对字段');
    expect(reviewContentSource).toContain('Invoice');
    expect(reviewContentSource).toContain('付款清单');
    expect(reviewContentSource).toContain('结果');
    expect(reviewContentSource).toContain('Real Name');
    expect(reviewContentSource).toContain('Account Name');
    expect(reviewContentSource).toContain('Account Number');
    expect(reviewContentSource).toContain('Beneficiary Bank Name');
    expect(reviewContentSource).toContain('Beneficiary Bank Address');
    expect(reviewContentSource).toContain('Swift Code');
    expect(reviewContentSource).toContain('IBAN (optional)');
    expect(reviewContentSource).toContain('当前账户字段为原型展示，具体字段需调用 Airwallex API');
    expect(reviewContentSource).toContain('details?.accountName || row.item.snapshot.realName');
    expect(reviewContentSource).not.toContain('row.effectiveAccount.accountSummary || displayValue(details?.accountName)');
  });

  it('keeps the Invoice page, payment comparison, account snapshot, and export target synchronized', () => {
    expect(workspaceSource).toContain('pages={financeReview.pages}');
    expect(workspaceSource).toContain('paymentLists={reviewPaymentLists}');
    expect(workspaceSource).toContain('reviewPaymentListIds.has(list.paymentListId)');
    expect(workspaceSource).toContain('activeIndex={reviewIndex}');
    expect(workspaceSource).toContain('onActiveIndexChange={setReviewIndex}');
    expect(workspaceSource).toContain('accountDisplay="current-full"');
    expect(workspaceSource).toContain('exportMode="current"');
    expect(reviewContentSource).toContain('currentReview?.paymentItems');
    expect(reviewContentSource).toContain('currentListIds.includes(list.paymentListId)');
    expect(reviewContentSource).toContain('disabled>导出 Excel</Button>');
  });

  it('preserves read-only validation and export behavior without payment mutation controls', () => {
    expect(reviewContentSource).toContain('validatePaymentListAccountViaApi');
    expect(reviewContentSource).toContain('reviewPaymentListAccountSnapshot');
    expect(reviewContentSource).toContain('onExportPaymentList(list.paymentListId)');
    expect(reviewContentSource).not.toContain('添加付款行');
    expect(reviewContentSource).not.toContain('删除清单');
    expect(reviewContentSource).not.toContain('编辑付款清单');
    expect(reviewContentSource).not.toContain('生成付款单');
  });

  it('shows the requested project metrics, project snapshot, and real approval flow', () => {
    expect(workspaceSource).toContain('请款金额');
    expect(workspaceSource).toContain('关联资料');
    expect(workspaceSource).toContain('当前审批状态');
    expect(workspaceSource).toContain('项目编号');
    expect(workspaceSource).toContain('关联项目');
    expect(workspaceSource).toContain('品牌 / 客户');
    expect(workspaceSource).toContain('项目媒介');
    expect(workspaceSource).toContain('负责 PM');
    expect(workspaceSource).toContain('提交人');
    expect(workspaceSource).toContain('提交时间');
    expect(workspaceSource).toContain('付款渠道');
    expect(workspaceSource).toContain('预计付款时间');
    expect(workspaceSource).toContain('请款原因');
    expect(workspaceSource).toContain('<ApprovalTimeline request={request} currentUser={currentUser} />');
  });
});
