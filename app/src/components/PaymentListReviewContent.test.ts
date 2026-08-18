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
const workspaceStyles = readFileSync(
  new URL('../index.css', import.meta.url),
  'utf8',
);
const workspaceStageStyles = readFileSync(
  new URL('./FinanceReviewWorkspace.css', import.meta.url),
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
      'amount',
      'real-name',
      'account-name',
      'account-number',
      'bank-name',
      'bank-address',
      'swift-code',
      'iban',
    ]);
    expect(financeWorkspaceComparisonFields(page, 'current-full').some((field) => (
      ['reason', 'fee', 'reference'].includes(field.id)
    ))).toBe(false);
    expect(financeWorkspaceComparisonFields(page, 'all-summary')).toEqual(fields);
  });

  it('renders the selected comparison fields and the complete current account snapshot', () => {
    expect(reviewContentSource).toContain('currentReviewFields.map');
    expect(reviewContentSource).toContain('核对字段');
    expect(reviewContentSource).toContain('合同');
    expect(reviewContentSource).toContain('Invoice');
    expect(reviewContentSource).toContain('付款清单');
    expect(reviewContentSource).toContain('结果');
    expect(reviewContentSource).toContain('合同信息需核对');
    expect(reviewContentSource).toContain('<strong>{currentReview.creatorName}</strong>');
    expect(reviewContentSource).toContain('Real Name');
    expect(reviewContentSource).toContain('Account Name');
    expect(reviewContentSource).toContain('Account Number');
    expect(reviewContentSource).toContain('Beneficiary Bank Name');
    expect(reviewContentSource).toContain('Beneficiary Bank Address');
    expect(reviewContentSource).toContain('Swift Code');
    expect(reviewContentSource).toContain('IBAN (optional)');
    expect(reviewContentSource).toContain('支付币种');
    expect(reviewContentSource).toContain('收款币种');
    expect(reviewContentSource).toContain('费用承担');
    expect(reviewContentSource).toContain('付款原因');
    expect(reviewContentSource).toContain('交易附言');
    expect(reviewContentSource).toContain('Airwallex 付款信息完整性字段');
    expect(reviewContentSource).toContain('银行国家 / 地区');
    expect(reviewContentSource).toContain('本地清算系统');
    expect(reviewContentSource).toContain('通知邮箱');
    expect(reviewContentSource).toContain('原型演示值');
    expect(reviewContentSource).toContain('schemaFields');
    expect(reviewContentSource).toContain('apiFieldIssue ? apiFieldIssue.message : reviewField?.state');
    expect(reviewContentSource).toContain('accountCheck && \'fieldIssues\' in accountCheck');
    expect(reviewContentSource).toContain('收款人地址国家 / 地区');
    expect(reviewContentSource).toContain('路由代码类型 1');
    expect(reviewContentSource).toContain("return details?.accountName || fallbackName || '未填写'");
    expect(reviewContentSource).not.toContain('row.effectiveAccount.accountSummary || displayValue(details?.accountName)');
    expect(reviewContentSource).not.toContain("id: 'bank-street-address'");
    expect(reviewContentSource).not.toContain("id: 'bank-city'");
    expect(reviewContentSource).not.toContain("id: 'bank-state'");
    expect(reviewContentSource).not.toContain("id: 'bank-postal-code'");
  });

  it('uses readable 14px comparison text and the requested payment summary header fields', () => {
    expect(reviewContentSource).toContain('<dt>Account Name</dt><dd>{accountName}</dd>');
    expect(reviewContentSource).toContain('<dt>付款清单编号</dt><dd>{row.list.paymentListCode}</dd>');
    expect(reviewContentSource).toContain('<dt>支付方式</dt><dd>{transferMethodCode(row.effectiveAccount.transferMethod)}</dd>');
    expect(reviewContentSource).toContain("if (transferMethod === 'LOCAL') return 'LOCAL'");
    expect(reviewContentSource).toContain("if (transferMethod === 'SWIFT') return 'SWIFT'");
    expect(workspaceStyles).toMatch(/\.finance-review-workspace \.finance-payment-list-review-content \.request-finance-comparison-table th,[\s\S]*\.request-finance-comparison-table td,[\s\S]*font-size:\s*14px;/s);
  });

  it('renders matching fields as accessible green circle-check icons', () => {
    expect(reviewContentSource).toContain("field.state === 'match'");
    expect(reviewContentSource.match(/<CircleCheck size=\{16\} strokeWidth=\{2\.4\} aria-hidden="true" \/>/g)).toHaveLength(2);
    expect(reviewContentSource.match(/<span className="sr-only">一致<\/span>/g)).toHaveLength(2);
    expect(workspaceStyles).toMatch(/\.finance-match-state\.is-match\s*{[^}]*background:\s*transparent;[^}]*color:\s*#15803d;/s);
    expect(workspaceStyles).toMatch(/\.finance-payment-account-fields \.is-match dt em svg\s*{[^}]*color:\s*#15803d;/s);
  });

  it('keeps the Invoice page, payment comparison, and account snapshot synchronized', () => {
    expect(workspaceSource).toContain('pages={financeReview.pages}');
    expect(workspaceSource).toContain('paymentLists={reviewPaymentLists}');
    expect(workspaceSource).toContain('reviewPaymentListIds.has(list.paymentListId)');
    expect(workspaceSource).toContain('activeIndex={reviewIndex}');
    expect(workspaceSource).toContain('onActiveIndexChange={setReviewIndex}');
    expect(workspaceSource).toContain('accountDisplay="current-full"');
    expect(workspaceSource).toContain('variant="finance-workspace"');
    expect(reviewContentSource).toContain('currentReview?.paymentItems');
  });

  it('simplifies the workspace summary and places account validation inside its status card', () => {
    expect(reviewContentSource).toContain("{variant === 'project' ? (");
    expect(reviewContentSource).toContain('request-payment-review-summary-action');
    expect(reviewContentSource).toContain("{validating ? 'Airwallex 校验中' : '校验 Airwallex 付款信息完整性'}");
    expect(workspaceSource).toContain('variant="finance-workspace"');
    expect(workspaceSource).not.toContain('exportMode="current"');
  });

  it('identifies each account requiring attention and jumps to its synchronized review page', () => {
    expect(reviewContentSource).toContain('accountAttentionRows.map');
    expect(reviewContentSource).toContain('需要处理的收款账户');
    expect(reviewContentSource).toContain('收款账户：{row.accountName}');
    expect(reviewContentSource).toContain('去核对<ArrowRight');
    expect(reviewContentSource).toContain('setReviewIndex(row.reviewIndex)');
    expect(reviewContentSource).toContain('onRequestPane?.()');
    expect(reviewContentSource).toContain('Number.isFinite(requestedIndex)');
    expect(reviewContentSource).toContain("scrollIntoView({ behavior: 'smooth', block: 'start' })");
    expect(reviewContentSource).toContain("scrollContainer.scrollTo({");
    expect(reviewContentSource).toContain('id={`finance-payment-account-${row.key}`}');
    expect(reviewContentSource).toContain('暂无可定位的付款明细');
  });

  it('constrains the approval board to its own keyboard-scrollable viewport', () => {
    expect(workspaceSource).toContain('data-testid="finance-review-approval-scroll"');
    expect(workspaceSource).toContain('aria-label="项目与审批详情"');
    expect(workspaceSource).toContain('tabIndex={0}');
    expect(workspaceStyles).toMatch(/\.finance-review-grid\s*{[^}]*height:\s*0;[^}]*grid-template-rows:\s*minmax\(0, 1fr\);[^}]*overflow:\s*hidden;/s);
    expect(workspaceStyles).toMatch(/\.finance-review-payment-scroll,\s*\.finance-review-approval-scroll\s*{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s);
    expect(workspaceStyles).toMatch(/\.finance-review-approval-scroll\s*{[^}]*grid-auto-rows:\s*max-content;/s);
  });

  it('supports the desktop approval drawer and synchronized prominent page navigation', () => {
    expect(workspaceSource).toContain("const [approvalCollapsed, setApprovalCollapsed] = useState(false)");
    expect(workspaceSource).toContain('PanelRightClose');
    expect(workspaceSource).toContain('PanelRightOpen');
    expect(workspaceSource).toContain('aria-controls="finance-review-approval-panel"');
    expect(workspaceSource).toContain('aria-expanded={!approvalCollapsed}');
    expect(workspaceSource).toContain('finance-review-invoice-edge-nav is-previous');
    expect(workspaceSource).toContain('finance-review-invoice-edge-nav is-next');
    expect(workspaceSource).toContain('上一页');
    expect(workspaceSource).toContain('下一页');
    expect(workspaceSource).not.toContain('finance-review-project-page-nav');
    expect(workspaceSource.match(/onClick=\{\(\) => goTo\(reviewIndex - 1\)\}/g)).toHaveLength(2);
    expect(workspaceSource.match(/onClick=\{\(\) => goTo\(reviewIndex \+ 1\)\}/g)).toHaveLength(2);
    expect(workspaceStyles).toMatch(/\.finance-review-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 4fr\) minmax\(0, 4fr\) minmax\(260px, 2fr\);/s);
    expect(workspaceStyles).toMatch(/\.finance-review-grid\s*\{[^}]*gap:\s*8px;[^}]*padding:\s*8px;/s);
    expect(workspaceStyles).toMatch(/\.finance-review-pane\s*\{[^}]*overflow:\s*hidden;[^}]*border-radius:\s*8px;/s);
    expect(workspaceStyles).toMatch(/\.finance-review-grid\.is-approval-collapsed\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\) 0fr;/s);
    expect(workspaceStyles).toMatch(/\.finance-review-approval-toggle\s*\{[^}]*right:\s*16px;[^}]*top:\s*15px;/s);
    expect(workspaceStyles).toMatch(/\.finance-review-invoice-edge-nav\s*\{[^}]*width:\s*48px;[^}]*height:\s*48px;[^}]*border-radius:\s*50%;/s);
    expect(workspaceStyles).toMatch(/@media \(max-width: 900px\)[\s\S]*\.finance-review-invoice-edge-nav,[\s\S]*\.finance-review-approval-toggle\s*\{[^}]*display:\s*none;/s);
    expect(workspaceStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.finance-review-grid,[\s\S]*transition:\s*none;/s);
    expect(workspaceStageStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.finance-review-validation-stage\s*{[^}]*transition:\s*none;/s);
  });

  it('centers the complete page-review control group in the footer viewport', () => {
    expect(workspaceSource).toContain('className="finance-review-footer-primary"');
    expect(workspaceSource).toContain('className="finance-review-page-actions"');
    expect(workspaceStageStyles).toMatch(/\.finance-review-workspace \.modal-footer\s*{[^}]*width:\s*100%;[^}]*justify-content:\s*stretch;/s);
    expect(workspaceStageStyles).toMatch(/\.finance-review-footer\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\);/s);
    expect(workspaceStageStyles).toMatch(/\.finance-review-footer\s*{[^}]*width:\s*100%;[^}]*flex:\s*none;/s);
    expect(workspaceStageStyles).toMatch(/\.finance-review-footer-primary\s*{[^}]*justify-self:\s*center;/s);
    expect(workspaceStageStyles).not.toMatch(/\.finance-review-footer-primary\s*{[^}]*position:\s*absolute;/s);
    expect(workspaceStageStyles).toMatch(/@media \(max-width: 1280px\) and \(min-width: 901px\)[\s\S]*\.finance-review-footer\s*{[^}]*grid-template-rows:\s*auto auto;[^}]*row-gap:\s*8px;/s);
  });

  it('does not allow an incorrect record to be overwritten as correct', () => {
    expect(workspaceSource).toContain("currentDecision.state !== 'incorrect'");
    expect(workspaceSource).toContain('if (!currentPage || !canConfirmCurrentPage) return');
    expect(workspaceSource).toContain('disabled={!canConfirmCurrentPage}');
  });

  it('supports accessible Invoice zoom controls and modifier-wheel trackpad zoom', () => {
    expect(workspaceSource).toContain('finance-review-invoice-zoom-stage');
    expect(workspaceSource).toContain('finance-review-zoom-controls');
    expect(workspaceSource).toContain('event.ctrlKey && !event.metaKey');
    expect(workspaceSource).toContain("addEventListener('wheel', handleInvoiceWheel, { passive: false })");
    expect(workspaceSource).toContain("event.key === '+' || event.key === '='");
    expect(workspaceSource).toContain("event.key === '0'");
    expect(workspaceStyles).toMatch(/\.finance-review-invoice-zoom-stage\s*\{[^}]*width:\s*calc\(min\(100%, 680px\) \* var\(--finance-review-invoice-zoom, 1\)\);/s);
    expect(workspaceStyles).toMatch(/\.finance-review-invoice-zoom-stage \.invoice-paper\s*\{[^}]*transform:\s*scale\(var\(--finance-review-invoice-zoom, 1\)\);/s);
  });

  it('requires all Invoice and payment-list pages to be reviewed before returning to media', () => {
    expect(workspaceSource).toContain('const allPagesReviewed = financeReview.pageCount > 0 && counts.unreviewed === 0');
    expect(workspaceSource).toContain('financeReviewSessionCanReturn(activeSession, financeReview)');
    expect(workspaceSource).toContain('请先完成剩余 ${counts.unreviewed} 份 Invoice 与付款清单核对');
    expect(workspaceSource).toContain('全部核对已完成，可一次性退回 ${counts.incorrect} 份有误记录');
    expect(workspaceSource).toContain('全部核对完成，可提交财务审核');
    expect(workspaceSource).toContain('disabled={!canReturn}');
    expect(workspaceSource).toContain('if (!canReturn || !returnReason) return');
    expect(workspaceSource).toContain('if (canReturn && returnReason && onReturn(returnReason))');
  });

  it('preserves read-only validation and export behavior without payment mutation controls', () => {
    expect(reviewContentSource).toContain('validatePaymentListAccountViaApi');
    expect(reviewContentSource).toContain('reviewPaymentListAccountSnapshot');
    expect(workspaceSource).toContain('await onExportPaymentList(list.paymentListId)');
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
    expect(workspaceSource).toContain('品牌');
    expect(workspaceSource).toContain('负责 PM');
    expect(workspaceSource).toContain('付款渠道');
    expect(workspaceSource).toContain('预计付款时间');
    expect(workspaceSource).toContain('成本类型');
    expect(workspaceSource).toContain('手续费承担方');
    expect(workspaceSource).toContain('项目媒介');
    expect(workspaceSource).toContain('创建时间');
    expect(workspaceSource).toContain('付款事由');
    expect(workspaceSource).toContain('备注附件');
    expect(workspaceSource).toContain('<ApprovalTimeline request={request} currentUser={currentUser} compact />');
    expect(workspaceSource).toContain('合同 · {linkedContracts.length} 份');
    expect(workspaceSource).toContain('Invoice · {linkedInvoices.length} 份');
    expect(workspaceSource).toContain('收款账户校验结果');
    expect(workspaceSource).toContain("openResourceDialog('contract')");
    expect(workspaceSource).toContain("openResourceDialog('invoice')");
    expect(workspaceSource).toContain('title={`${request.requestCode ?? request.id} · 合同资料`}');
    expect(workspaceSource).toContain('title={`${request.requestCode ?? request.id} · Invoice`}');
  });

  it('keeps the real approval order in a continuous two-column horizontal curved flow', () => {
    expect(workspaceSource).toContain('className="finance-approval-curve"');
    expect(workspaceSource).toContain('<path d={compactCurvePath} />');
    expect(workspaceSource).toContain('className="finance-approval-curve-progress"');
    expect(workspaceSource).toContain('className="finance-approval-stage-icon"');
    expect(workspaceSource).toContain('className="finance-approval-state-mark"');
    expect(workspaceSource).toContain('const outerX = previous.column === 2 ? compactCurveWidth : 0');
    expect(workspaceSource).toContain('const compactCurvePath = buildCompactCurvePath(compactPositions.length - 1)');
    expect(workspaceSource).toContain('maskUnits="userSpaceOnUse"');
    expect(workspaceSource).toContain('<strong title={step.label}>{step.label}</strong>');
    expect(workspaceSource).toContain('<span title={step.accountName}>@{step.accountName}</span>');
    expect(workspaceSource).toContain("compact ? (");
    expect(workspaceSource).toContain('gridColumn: compactPositions[index].column');
    expect(workspaceStyles).toMatch(/\.finance-approval-timeline\.is-compact\s*{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[^}]*grid-auto-rows:\s*84px;/s);
    expect(workspaceStyles).toMatch(/\.finance-approval-curve path\s*{[^}]*stroke:\s*#cbd2da;[^}]*stroke-linecap:\s*round;/s);
    expect(workspaceStyles).toMatch(/\.finance-approval-curve path\.finance-approval-curve-progress\s*{[^}]*stroke:\s*#675187;/s);
    expect(workspaceStyles).toMatch(/\.finance-approval-timeline\.is-compact \.finance-approval-node\s*{[^}]*width:\s*30px;[^}]*height:\s*30px;[^}]*border-radius:\s*50%;/s);
    expect(workspaceStyles).toMatch(/\.finance-approval-timeline\.is-compact \.finance-approval-stage\s*{[^}]*max-width:\s*142px;/s);
    expect(workspaceStyles).toMatch(/\.finance-approval-timeline\.is-compact \.finance-approval-stage strong\s*{[^}]*max-width:\s*none;[^}]*overflow:\s*visible;[^}]*text-overflow:\s*clip;[^}]*white-space:\s*nowrap;/s);
    expect(workspaceStyles).toMatch(/\.finance-approval-timeline\.is-compact \.finance-approval-step::after\s*{[^}]*content:\s*none;/s);
  });
});
