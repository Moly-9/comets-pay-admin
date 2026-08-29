import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PaymentListRecord } from '../businessWorkflow';
import type { ContractRecord } from '../contracts';
import type { FinanceReviewPage } from '../financeReview';
import type { GeneratedInvoiceRecord } from '../types';
import type { RequestProjectSummary } from '../pages/RequestProjectDetailPage';
import {
  ApprovalTimeline,
  FINANCE_RETURN_ISSUE_OPTIONS,
  contractsForFinanceReviewPage,
  projectPaymentListsForFinanceReview,
} from './FinanceReviewWorkspace';

const workspaceSource = readFileSync(
  new URL('./FinanceReviewWorkspace.tsx', import.meta.url),
  'utf8',
);
const workspaceStageStyles = readFileSync(
  new URL('./FinanceReviewWorkspace.css', import.meta.url),
  'utf8',
);
const appSource = readFileSync(
  new URL('../App.tsx', import.meta.url),
  'utf8',
);

describe('FinanceReviewWorkspace progressive review stages', () => {
  it('opens in the project overview drawer before exposing validation actions', () => {
    expect(workspaceSource).toContain("const [stage, setStage] = useState<FinanceReviewStage>('overview')");
    expect(workspaceSource).toContain('data-testid="finance-review-overview-stage"');
    expect(workspaceSource).toContain('data-testid="finance-review-validation-stage"');
    expect(workspaceSource).toContain("footer={stage === 'overview' ? (");
    expect(workspaceSource).toContain('进入校验后，需要逐份核对 Invoice 与付款清单。');
    expect(workspaceSource).toContain('onClick={() => changeStage(\'validation\')}');
    expect(workspaceSource).toContain('校验审核');
    expect(workspaceSource).toContain('icon={<ArrowLeft size={16} />}');
    expect(workspaceSource).toContain("setApprovalCollapsed(nextStage === 'validation')");
    expect(workspaceSource).toContain("if (nextStage === 'validation') setActivePane('invoice')");
  });

  it('returns to the overview without resetting review, page, or zoom state', () => {
    expect(workspaceSource).toContain('onClick={() => changeStage(\'overview\')}');
    expect(workspaceSource).toContain('返回项目概览');
    expect(workspaceSource).toContain("const [reviewIndex, setReviewIndex] = useState(firstPendingIndex)");
    expect(workspaceSource).toContain('const [approvalCollapsed, setApprovalCollapsed] = useState(false)');
    expect(workspaceSource).toContain('const [invoiceZoom, setInvoiceZoom] = useState(1)');
    expect(workspaceSource).toContain("if (stage !== 'validation') return undefined");
    expect(workspaceSource).toContain('}, [setInvoiceZoomLevel, stage])');
    expect(workspaceSource.match(/setReviewIndex\(/g)?.length).toBeGreaterThan(0);
    expect(workspaceSource).not.toContain("changeStage = (nextStage: FinanceReviewStage) => {\n    setReviewIndex");
  });

  it('keeps page-level review actions centered and the overview return with final actions', () => {
    expect(workspaceSource).toContain('className="finance-review-footer-primary"');
    expect(workspaceSource).toContain('className="finance-review-page-actions"');
    expect(workspaceSource).toMatch(/finance-review-footer-primary[\s\S]*上一页[\s\S]*下一页[\s\S]*记录有误[\s\S]*确认本页无误[\s\S]*finance-review-footer-summary/);
    expect(workspaceSource).toMatch(/finance-review-footer-actions[\s\S]*退回媒介修改[\s\S]*changeStage\('overview'\)[\s\S]*返回项目概览[\s\S]*通过财务审核/);
    expect(workspaceSource).not.toContain('className="finance-review-validation-bar"');
    expect(workspaceStageStyles).toMatch(/\.finance-review-workspace \.modal-footer\s*{[^}]*width:\s*100%;[^}]*justify-content:\s*stretch;/s);
    expect(workspaceStageStyles).toMatch(/\.finance-review-footer\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\);/s);
    expect(workspaceStageStyles).toMatch(/\.finance-review-footer\s*{[^}]*width:\s*100%;[^}]*flex:\s*none;/s);
    expect(workspaceStageStyles).toMatch(/\.finance-review-footer-primary\s*{[^}]*grid-column:\s*2;[^}]*justify-self:\s*center;/s);
    expect(workspaceStageStyles).not.toMatch(/\.finance-review-footer-primary\s*{[^}]*position:\s*absolute;/s);
    expect(workspaceStageStyles).toMatch(/\.finance-review-footer > \.finance-review-footer-actions\s*{[^}]*grid-column:\s*3;[^}]*justify-self:\s*end;/s);
    expect(workspaceStageStyles).toMatch(/@media \(max-width: 1280px\) and \(min-width: 768px\)[\s\S]*\.finance-review-footer\s*{[^}]*grid-template-rows:\s*auto auto;[^}]*row-gap:\s*8px;/s);
  });

  it('reuses the same project overview for the drawer and approval board', () => {
    expect(workspaceSource.match(/<FinanceReviewProjectOverview/g)).toHaveLength(2);
    expect(workspaceSource).toContain('canExportPaymentLists={projectPaymentLists.length > 0}');
    expect(workspaceSource.match(/onDownloadContracts=/g)).toHaveLength(2);
    expect(workspaceSource.match(/onDownloadInvoices=/g)).toHaveLength(2);
    expect(workspaceSource).toContain('下载该请款项目的全部合同 PDF');
    expect(workspaceSource).toContain('下载该请款项目的全部 Invoice PDF');
    expect(workspaceSource).toContain('合同、Invoice 与收款账户校验汇总');
    expect(workspaceSource.match(/>查看全部<\/button>/g)).toHaveLength(2);
    expect(workspaceSource).toContain('aria-label="打包下载全部合同"');
    expect(workspaceSource).toContain('aria-label="打包下载全部 Invoice"');
    expect(workspaceSource).toContain("projectPdfArchiveFilename(request.requestCode ?? request.id, 'contract')");
    expect(workspaceSource).toContain("projectPdfArchiveFilename(request.requestCode ?? request.id, 'invoice')");
    expect(workspaceSource).toContain("onOpenContracts={() => openResourceDialog('contract')}");
    expect(workspaceSource).toContain("onOpenInvoices={() => openResourceDialog('invoice')}");
    expect(workspaceSource).toContain('await onExportPaymentList(list.paymentListId)');
  });

  it('keeps the overview scrollable and places the approval flow before linked resources', () => {
    expect(workspaceSource).toContain('data-testid="finance-review-overview-scroll"');
    expect(workspaceSource).toContain('aria-label="付款信息、当前审批流与关联资料"');
    expect(workspaceSource).toMatch(/aria-label="付款信息"[\s\S]*aria-label="当前审批流"[\s\S]*aria-label="关联资料"/);
    expect(workspaceSource.match(/<ApprovalTimeline request=\{request\} currentUser=\{currentUser\} compact \/>/g)).toHaveLength(1);
    expect(workspaceStageStyles).toMatch(/\.finance-review-overview-scroll\s*{[^}]*grid-auto-rows:\s*max-content;[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*scroll;[^}]*scrollbar-width:\s*thin;[^}]*touch-action:\s*pan-y;/s);
    expect(workspaceStageStyles).toMatch(/\.finance-review-overview-scroll > \*\s*{[^}]*min-height:\s*max-content;/s);
    expect(workspaceStageStyles).toMatch(/\.finance-review-overview-scroll > \.finance-review-project-section\s*{[^}]*align-self:\s*start;/s);
    expect(workspaceStageStyles).toMatch(/\.finance-review-overview-scroll:focus-visible\s*{[^}]*outline:\s*2px solid #8a72a5;/s);
  });

  it('matches the My Projects payment information fields', () => {
    expect(workspaceSource).toContain('aria-label="付款信息"');
    expect(workspaceSource).toContain('<strong>付款信息</strong>');
    expect(workspaceSource).not.toContain('aria-label="请款项目信息"');
    for (const label of [
      '项目编号',
      '关联项目',
      '品牌',
      '负责 PM',
      '付款渠道',
      '付款主体',
      '项目费用归属',
      '预计付款时间',
      '成本类型',
      '成本类型明细',
      '手续费承担方',
      '项目媒介',
      '创建时间',
      '付款事由',
      '备注',
      '备注附件',
    ]) {
      expect(workspaceSource).toContain(`<dt>${label}</dt>`);
    }
    expect(workspaceSource).not.toContain('<dt>提交人</dt>');
    expect(workspaceSource).not.toContain('<dt>提交时间</dt>');
  });

  it('uses a right-side 520px drawer that expands in 220ms and becomes full-screen on mobile', () => {
    expect(workspaceSource).toContain("width={stage === 'overview' ? '520px' : '100vw'}");
    expect(workspaceSource).toContain('className={`finance-review-workspace is-${stage}`}');
    expect(workspaceStageStyles).toMatch(/\.modal-backdrop:has\(\.finance-review-workspace\)\s*{[^}]*justify-content:\s*flex-end;/s);
    expect(workspaceStageStyles).toMatch(/\.modal-panel\.finance-review-workspace\.is-overview\s*{[^}]*width:\s*min\(520px, 100vw\);/s);
    expect(workspaceStageStyles).toMatch(/transition:\s*width 220ms ease-out, max-width 220ms ease-out/s);
    expect(workspaceStageStyles).toMatch(/@media \(max-width: 767px\)[\s\S]*\.modal-panel\.finance-review-workspace\.is-overview\s*{[^}]*width:\s*100vw;/s);
    expect(workspaceStageStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.modal-panel\.finance-review-workspace,[\s\S]*transition:\s*none;/s);
  });
});

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

describe('FinanceReviewWorkspace project payment-list export', () => {
  it('collects every unique payment list linked to the current request', () => {
    const lists = [
      { paymentListId: 'list-airwallex', paymentRequestProjectId: 'request-one' },
      { paymentListId: 'list-paypal', paymentRequestProjectId: 'request-one' },
      { paymentListId: 'list-airwallex', paymentRequestProjectId: 'request-one' },
      { paymentListId: 'list-explicit', paymentRequestProjectId: 'request-other' },
      { paymentListId: 'list-unrelated', paymentRequestProjectId: 'request-other' },
    ] as unknown as PaymentListRecord[];

    const result = projectPaymentListsForFinanceReview({
      paymentRequestProjectId: 'request-one' as RequestProjectSummary['paymentRequestProjectId'],
      paymentListIds: ['list-explicit'] as RequestProjectSummary['paymentListIds'],
    }, lists);

    expect(result.map((list) => list.paymentListId)).toEqual([
      'list-airwallex',
      'list-paypal',
      'list-explicit',
    ]);
  });
});

describe('FinanceReviewWorkspace project resource cards', () => {
  it('shows contract and Invoice identity, amount, and consistent view/download actions', () => {
    expect(workspaceSource).toContain('<span>合同名称</span>');
    expect(workspaceSource).toContain('<small><b>合同编号</b>{contract.id}</small>');
    expect(workspaceSource).toContain('<span>付款金额</span>');
    expect(workspaceSource).toContain('<span>Invoice 名称</span>');
    expect(workspaceSource).toContain('<small><b>Invoice 编号</b>{linkedInvoice.id}</small>');
    expect(workspaceSource.match(/className="finance-review-resource-card-person"/g)).toHaveLength(2);
    expect(workspaceSource.match(/<span>达人<\/span>/g)).toHaveLength(2);
    expect(workspaceSource.match(/<PaymentCreatorIdentity \{\.\.\.creatorIdentity\} \/>/g)).toHaveLength(2);
    expect(workspaceSource).toContain('accountName: contract.paymentSnapshot?.accountName || contract.accountName');
    expect(workspaceSource).toContain('accountName: linkedInvoice.snapshot.payment.accountName');
    expect(workspaceSource).toContain('invoiceDocumentName(linkedInvoice.snapshot)');
    expect(workspaceSource).toContain('contractDocumentFilename(contract)');
    expect(workspaceSource).toContain("invoiceFilename(linkedInvoice.snapshot, 'pdf')");
    expect(workspaceSource).toContain('finance-review-resource-card-actions');
    expect(workspaceSource).toContain('下载合同汇总');
    expect(workspaceSource).toContain('下载 Invoice 汇总');
    expect(workspaceStageStyles).toContain('.finance-review-linked-resource-title');
    expect(workspaceStageStyles).toMatch(/\.finance-review-linked-resources \.finance-review-resource-icon\s*{[^}]*background:\s*#f3eef9;[^}]*color:\s*#7256a0;/s);
  });

  it('restores the resource modal, scroll position, and focus after returning from detail', () => {
    expect(workspaceSource).toContain("querySelectorAll<HTMLElement>('[data-resource-record-id]')");
    expect(workspaceSource).toContain("target?.scrollIntoView({ block: 'center' })");
    expect(workspaceSource).toContain("target?.focus({ preventScroll: true })");
    expect(appSource).toContain("source: 'my-project' | 'finance-review'");
    expect(appSource).toContain("source: 'finance-review'");
    expect(appSource).toContain("returnFromRequestResourceDetail('contract')");
    expect(appSource).toContain("returnFromRequestResourceDetail('invoice')");
    expect(appSource).toContain('initialResourceRecordId={financeReviewResourceRestore?.requestId === financeReviewRequest.id');
  });

  it('keeps cards readable without horizontal overflow on narrow screens', () => {
    expect(workspaceStageStyles).toMatch(/\.finance-review-resource-card\s*{[^}]*grid-template-columns:\s*44px minmax\(220px, 1fr\) minmax\(150px, \.7fr\) minmax\(140px, \.55fr\) auto auto;/s);
    expect(workspaceStageStyles).toContain('.finance-review-resource-card-person');
    expect(workspaceStageStyles).toMatch(/@media \(max-width: 767px\)[\s\S]*\.finance-review-resource-card-person\s*{[^}]*grid-column:\s*2;[^}]*grid-row:\s*2;/s);
    expect(workspaceStageStyles).toMatch(/@media \(max-width: 480px\)[\s\S]*\.finance-review-resource-card\s*{[^}]*grid-template-columns:\s*38px minmax\(0, 1fr\);[^}]*height:\s*max-content;[^}]*min-height:\s*0;/s);
    expect(workspaceStageStyles).toMatch(/\.finance-review-resource-card-actions\s*{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s);
  });
});

describe('FinanceReviewWorkspace document switching', () => {
  const contract = (id: string, engagementId = 'eng-1') => ({
    contractId: id,
    id,
    name: `${id} 合同`,
    sourceName: `${id}.pdf`,
    engagementId,
  } as unknown as ContractRecord);

  it('resolves every contract for the current creator through stable invoice and engagement links', () => {
    const invoice = {
      invoiceId: 'inv-1',
      snapshot: { contractIds: ['contract-invoice'], engagementId: 'eng-1' },
    } as unknown as GeneratedInvoiceRecord;
    const page = {
      invoiceId: 'inv-1',
      paymentItems: [{ paymentListId: 'list-1', itemId: 'item-1' }],
    } as unknown as FinanceReviewPage;
    const paymentLists = [{
      paymentListId: 'list-1',
      items: [{
        id: 'item-1',
        engagementId: 'eng-1',
        snapshot: { contractIds: ['contract-payment'] },
      }],
    }] as unknown as PaymentListRecord[];

    const result = contractsForFinanceReviewPage({
      page,
      invoice,
      request: {
        creatorLinks: [{
          creatorId: 'creator-1',
          engagementId: 'eng-1',
          contractIds: ['contract-request-1', 'contract-request-2'],
          invoiceIds: ['inv-1'],
        }],
      } as unknown as Pick<RequestProjectSummary, 'creatorLinks'>,
      contracts: [
        contract('contract-invoice'),
        contract('contract-payment'),
        contract('contract-request-1'),
        contract('contract-request-2'),
        contract('contract-unrelated', 'eng-2'),
      ],
      paymentLists,
    });

    expect(result.map((item) => item.id)).toEqual([
      'contract-invoice',
      'contract-payment',
      'contract-request-1',
      'contract-request-2',
    ]);
  });

  it('returns no contract options when the current page has no stable contract association', () => {
    const result = contractsForFinanceReviewPage({
      page: { invoiceId: 'inv-without-contract', paymentItems: [] } as unknown as FinanceReviewPage,
      invoice: {
        invoiceId: 'inv-without-contract',
        snapshot: { engagementId: 'eng-without-contract' },
      } as unknown as GeneratedInvoiceRecord,
      request: { creatorLinks: [] },
      contracts: [contract('contract-unrelated', 'eng-other')],
      paymentLists: [],
    });

    expect(result).toEqual([]);
  });

  it('keeps the document switcher and two-level contract selector in the invoice pane', () => {
    expect(workspaceSource).toContain('data-testid="finance-review-validation-stage"');
    expect(workspaceSource).toContain('className="finance-review-document-switcher finance-review-document-header-controls"');
    expect(workspaceSource).toContain('data-testid="finance-review-document-controls"');
    expect(workspaceSource).toContain('aria-label="凭证快照切换"');
    expect(workspaceSource).toContain('选择凭证类型');
    expect(workspaceSource).toContain('selectedLabel={documentSwitcherLabel}');
    expect(workspaceSource).toContain('切换合同快照');
    expect(workspaceSource).toContain('选择具体合同');
    expect(workspaceSource).toContain('没有合同');
    expect(workspaceSource).toContain('<ContractDocumentView contract={selectedContract}');
    expect(workspaceSource).toContain('setDocumentKind(\'invoice\')');
    expect(workspaceSource).not.toContain('<div className="finance-review-document-switcher"');
    expect(workspaceStageStyles).toContain('.finance-review-document-switcher');
    expect(workspaceStageStyles).toContain('.finance-review-document-header-controls');
    expect(workspaceStageStyles).toContain('@media (max-width: 767px)');
  });
});

describe('FinanceReviewWorkspace approval timeline', () => {
  it('renders a compact two-column curved flow with only stage and account content', () => {
    const request = {
      media: 'media.demo',
      pm: 'pm.demo',
      approval: {
        status: 'PENDING_FINANCE',
        round: 1,
        submittedAt: '2026-08-10T08:00:00.000Z',
        updatedAt: '2026-08-10T09:00:00.000Z',
        history: [{
          round: 1,
          stage: 'PM',
          action: 'APPROVE',
          actorAccount: 'fixture-pm',
          actorName: '测试 PM',
          actorRole: 'PM 账号',
          fromStatus: 'PENDING_PM',
          toStatus: 'PENDING_PROJECT_OWNER',
          occurredAt: '2026-08-10T08:10:00.000Z',
        }],
      },
    } as unknown as RequestProjectSummary;

    const html = renderToStaticMarkup(createElement(ApprovalTimeline, { request, compact: true }));

    expect(html).toContain('请款提交');
    expect(html).toContain('@media.demo');
    expect(html).toContain('PM 审批');
    expect(html).toContain('@fixture-pm');
    expect(html).toContain('class="finance-approval-curve"');
    expect(html).toContain('class="lucide lucide-send finance-approval-stage-icon"');
    expect(html).toContain('class="lucide lucide-clipboard-check finance-approval-stage-icon"');
    expect(html).toContain('class="lucide lucide-landmark finance-approval-stage-icon"');
    expect(html).toContain('class="lucide lucide-credit-card finance-approval-stage-icon"');
    expect(html).toContain('class="lucide lucide-refresh-cw finance-approval-stage-icon"');
    expect(html).toContain('class="finance-approval-state-mark"');
    expect(html).toContain('class="finance-approval-curve-progress"');
    expect(html).toContain('<mask id="finance-approval-curve-mask-');
    expect(html).toContain('maskUnits="userSpaceOnUse"');
    expect(html).toContain('r="19"');
    expect(html).toContain('<g mask="url(#finance-approval-curve-mask-');
    expect(html).toContain('财务审批，账号 finance，当前节点');
    expect(html).toContain('grid-column:1;grid-row:1');
    expect(html).toContain('grid-column:2;grid-row:1');
    expect(html).toContain('grid-column:2;grid-row:2');
    expect(html).not.toContain('lucide-git-branch');
    expect(html).not.toContain('当前轮次已审批通过');
    expect(html).not.toContain('第 1 轮审批已提交');
    expect(html).not.toContain('finance-approval-actor');
    expect(html).not.toContain('<time');
  });
});
