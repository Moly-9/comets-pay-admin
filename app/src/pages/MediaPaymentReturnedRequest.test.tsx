import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { RequestApprovalState } from '../businessWorkflow';
import type { SystemUser } from '../data';
import type { Payout } from '../types';
import type { ProjectSummary } from './ProjectDetailPage';
import { MediaPaymentProjectsPage } from './MediaPaymentProjectsPage';
import type { RequestProjectSummary } from './RequestProjectDetailPage';

const mediaUser: SystemUser = {
  account: 'media.returned',
  name: '媒介测试账号',
  email: 'media.returned@example.test',
  initials: 'MT',
  roleKey: 'media',
  role: '媒介账号',
  scopeName: '赖丽红',
};

const approval: RequestApprovalState = {
  status: 'RETURNED_TO_MEDIA_REVIEW',
  round: 1,
  history: [{
    round: 1,
    stage: 'FINANCE',
    action: 'RETURN',
    actorAccount: 'finance.returned',
    actorName: '财务测试员',
    actorRole: '财务账号',
    fromStatus: 'PENDING_FINANCE',
    toStatus: 'RETURNED_TO_MEDIA_REVIEW',
    reason: '收款账户名与 Invoice 不一致，请修正付款清单。',
    occurredAt: '2026-08-10T04:30:00.000Z',
  }],
  submittedAt: '2026-08-09T02:00:00.000Z',
  returnedFromStage: 'FINANCE',
  resumeStatus: 'PENDING_FINANCE',
  returnReason: '收款账户名与 Invoice 不一致，请修正付款清单。',
  updatedAt: '2026-08-10T04:30:00.000Z',
};

const cooperationProject: ProjectSummary = {
  id: 'project-returned',
  cooperationProjectCode: 'PRJ-260810-01',
  name: '海外新品发布项目',
  brand: 'Test Brand',
  media: '赖丽红',
  pm: 'Test PM',
  creators: 0,
  budget: 'USD 1,200',
  status: '进行中',
};

const returnedRequest: RequestProjectSummary = {
  id: 'request-returned',
  requestCode: 'REQ-RETURNED-01',
  paymentRequestProjectId: 'request-returned-internal' as RequestProjectSummary['paymentRequestProjectId'],
  cooperationProjectCode: cooperationProject.cooperationProjectCode,
  cooperationProjectName: cooperationProject.name,
  lifecycle: 'RETURNED',
  approval,
  project: cooperationProject.name,
  brand: 'Test Brand',
  media: '赖丽红',
  pm: 'Test PM',
  amount: 'USD 1,200',
  contracts: 1,
  invoices: 1,
  creatorLinks: [],
  paymentOrder: 'PAY-RETURNED-01',
  status: '已退回',
  filter: 'pending',
  createdAt: '2026-08-09T02:00:00.000Z',
  generatedDetail: {
    brand: 'Test Brand',
    reason: '影音服务',
    contractId: 'CON-RETURNED-01',
    contractName: '测试合同',
    contractAmount: 'USD 1,200',
    contractStatus: '已确认',
    invoiceId: 'INV-RETURNED-01',
    invoiceAmount: 'USD 1,200',
    invoiceStatus: '已录入',
    paymentListId: 'PAY-RETURNED-01',
    paymentListStatus: '已生成',
    payee: '测试达人',
    provider: 'Airwallex',
    beneficiaryId: 'beneficiary-test',
    feePolicy: 'SHA',
  },
};

const resourceActions = {
  onChangeLinks: vi.fn(),
  onOpenContract: vi.fn(),
  onOpenInvoice: vi.fn(),
  onGenerateContract: vi.fn(),
  onGenerateInvoice: vi.fn(),
  onUploadContract: vi.fn(),
  onDeleteContract: vi.fn(),
  onDeleteInvoice: vi.fn(),
  onClearPaymentLists: vi.fn(),
  onRemovePaymentInvoice: vi.fn(),
  onUpdatePaymentItem: vi.fn(),
  onChangePaymentAccount: vi.fn(),
  onRevalidatePaymentItem: vi.fn(),
  onBeginEditPaymentList: vi.fn(),
  onGeneratePaymentListVersion: vi.fn(),
  onExportPaymentList: vi.fn(),
};

const renderPage = (focusedProjectId: string | null, payouts: Payout[] = []) => renderToStaticMarkup(
  <MediaPaymentProjectsPage
    notify={vi.fn()}
    currentUser={mediaUser}
    cooperationProjects={[cooperationProject]}
    creators={[]}
    contracts={[]}
    invoices={[]}
    paymentLists={[]}
    payouts={payouts}
    requests={[returnedRequest]}
    canCreate
    focusedProjectId={focusedProjectId}
    onFocusCleared={vi.fn()}
    onCreated={vi.fn()}
    onUpdated={vi.fn()}
    onGeneratePaymentList={vi.fn()}
    onSubmitRequest={vi.fn()}
    resourceActions={resourceActions}
  />,
);

describe('media returned payment request handling', () => {
  it('keeps payment-workbench returns visible in My Projects with a reason and action', () => {
    const html = renderPage(null);

    expect(html).toContain('1 个请款项目待修改');
    expect(html).toContain('1 个由付款工作台退回');
    expect(html).toContain('付款工作台 · 收款账户名与 Invoice 不一致');
    expect(html).toContain('处理退回');
  });

  it('shows full return details, correction entry points, and the resubmit action', () => {
    const html = renderPage(returnedRequest.id);

    expect(html).toContain('付款工作台已退回此请款项目');
    expect(html).toContain('收款账户名与 Invoice 不一致，请修正付款清单。');
    expect(html).toContain('财务测试员');
    expect(html).toContain('财务账号');
    expect(html).toContain('第 1 轮');
    expect(html).toContain('修改请款内容');
    expect(html).toContain('检查付款清单');
    expect(html).toContain('重新提交申请');
    expect(html).toContain('请选择付款渠道');
    expect(html).toContain('请选择预计付款时间');
    expect(html).toContain('重新提交');
  });

  it('separates a payment failure recovery from the ordinary returned-project interaction', () => {
    const failedPayout: Payout = {
      id: 'payout-returned-failure',
      paymentRequestProjectId: returnedRequest.paymentRequestProjectId,
      creator: '测试达人',
      handle: '@test',
      initials: 'TT',
      projectId: 'project-returned',
      project: cooperationProject.name,
      contract: 'CON-RETURNED-01',
      invoice: 'INV-RETURNED-01',
      provider: 'Airwallex',
      currency: 'USD',
      amount: 1200,
      account: 'prototype-account',
      status: '已退回',
      invoiceReviewStatus: '已通过',
      accent: '#64748b',
      paymentFailureReturn: {
        issueType: 'PAYMENT_LIST',
        reason: '达人收款账户不可用，请更新后重新校验。',
        actorAccount: 'finance.returned',
        actorName: '财务测试员',
        occurredAt: '2026-08-10T04:30:00.000Z',
        restartStage: 'PAYMENT_LIST_RESUBMISSION',
      },
      paymentFailureRecovery: {
        status: 'AWAITING_CREATOR_UPDATE',
        notifications: [],
      },
    };
    const listHtml = renderPage(null, [failedPayout]);
    const detailHtml = renderPage(returnedRequest.id, [failedPayout]);

    expect(listHtml).toContain('处理失败请款');
    expect(listHtml).not.toContain('处理退回');
    expect(listHtml).toContain('部分打款失败');
    expect(listHtml).toContain('1 笔失败款待恢复');
    expect(detailHtml).toContain('付款失败退回');
    expect(detailHtml).toContain('1 笔失败款需恢复');
    expect(detailHtml).toContain('达人收款账户不可用，请更新后重新校验。');
    expect(detailHtml).toContain('等待达人更新账户');
    expect(detailHtml).not.toContain('退回待处理');
    expect(detailHtml).not.toContain('付款工作台已退回此请款项目');
  });
});
