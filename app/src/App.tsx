import { useCallback, useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { FinanceReviewWorkspace } from './components/FinanceReviewWorkspace';
import { PayoutDrawer } from './components/PayoutDrawer';
import { Toast } from './components/Common';
import type { RequestProjectResourceActions } from './components/RequestProjectResourceManager';
import {
  completeGeneratedContractUpload,
  createGeneratedContractDraft,
  createUploadedContract,
  INITIAL_CONTRACTS,
  type ContractGeneratedFiles,
  type ContractGenerationModel,
  type ContractRecord,
  type ContractUploadInput,
} from './contracts';
import {
  authenticateSystemUser,
  CURRENT_USER,
  INITIAL_INVOICE_ENTITY,
  INITIAL_PAYOUTS,
  PAGE_TITLES,
  type SystemUser,
} from './data';
import {
  canAccessPage,
  canDeleteContract,
  canDeleteContractSelection,
  getDefaultPageForRole,
  hasPermission,
} from './permissions';
import {
  executeMockBatchSubmission,
  type MockBatchSubmission,
} from './batchTransfers';
import { BatchWizardPage } from './pages/BatchWizardPage';
import { AuthPage } from './pages/AuthPage';
import { ContractsPage } from './pages/ContractsPage';
import { ContractBuilderPage } from './pages/ContractBuilderPage';
import { DashboardPage } from './pages/DashboardPage';
import { PaymentWorkbenchPage } from './pages/PaymentWorkbenchPage';
import { InvoiceBuilderPage } from './pages/InvoiceBuilderPage';
import { InvoiceBatchBuilderPage } from './pages/InvoiceBatchBuilderPage';
import { SystemSettingsPage } from './pages/SystemSettingsPage';
import {
  applyInvoiceDocumentEdit,
  applyInvoiceReviewAction,
  getAvailableInvoiceReviewActions,
  getInvoiceEditContext,
  getInvoicePageTab,
  getPaymentListResubmissionState,
  isInvoiceApprovedForPayment,
  isPayoutEligibleForBatch,
  markGeneratedInvoiceSigned,
  paymentFailureRestartStage,
  recordInvoiceSignatureReminder,
  replyToCreatorFeedback,
  type InvoiceReviewAction,
  type InvoicePageTab,
} from './invoice/invoiceReviewWorkflow';
import { findInvoiceRequest, getInvoiceManagementView } from './invoice/invoiceManagement';
import {
  buildRequestFinanceReview,
  financeReviewSessionCanApprove,
  financeReviewSessionKey,
  reconcileFinanceReviewSession,
  type FinanceReviewSession,
} from './financeReview';
import {
  BatchesPage,
  ChannelsPage,
  CollaborationsPage,
  CreatorsPage,
  InvoicePage,
  INITIAL_CREATORS,
  INITIAL_PROJECTS,
  INITIAL_REQUEST_PROJECTS,
  MOCK_FEISHU_COOPERATION_PROJECT_SOURCE,
  NotificationsPage,
  OrganizationPage,
  RequestsPage,
  TransactionsPage,
} from './pages/OperationalPages';
import { MediaPaymentProjectsPage } from './pages/MediaPaymentProjectsPage';
import type {
  CreatorProfile,
  GeneratedInvoiceRecord,
  InvoiceDocumentModel,
  InvoiceEditContext,
  InvoiceEntity,
  NavPage,
  PaymentFailureIssueType,
  Payout,
  ToastState,
} from './types';
import {
  applyPaymentListPayoutSnapshot,
  beginPaymentListEdit,
  canEditProject,
  clearPaymentListItems,
  createAuditEvent,
  createPrototypeCode,
  createPrototypeId,
  hasInvoiceForEngagement,
  generatePaymentListVersion,
  invoicePaymentListItem,
  nextReviewStatusAfterMutation,
  nowIso,
  paymentListEffectiveAccount,
  payoutWithPaymentListSnapshot,
  revalidatePaymentListItem,
  refreshPaymentListItemSnapshot,
  removePaymentListItem,
  upsertPaymentListItem,
  validateProjectSubmission,
  type EngagementId,
  type ContractId,
  type InvoiceId,
  type PaymentListEditableField,
  type PaymentListRecord,
  type PaymentRequestProjectId,
  type ProjectId,
  type RequestApprovalStatus,
  type WorkflowAuditAction,
  type WorkflowAuditEvent,
} from './businessWorkflow';
import {
  contractCooperationProjectId,
  createPaymentRequestListItem,
  invoiceCooperationProjectId,
  isPaymentRequestFullyPaid,
  myProjectStatusFor,
  paymentRequestAmountLabel,
  paymentRequestInvoiceIds,
  paymentRequestSubmissionIssues,
  type PaymentRequestCreatorLink,
} from './paymentRequestProjects';
import { downloadBlob } from './invoice/invoiceUtils';
import {
  createDocumentPayoutSnapshot,
  getPayoutAccountFingerprint,
  getPayoutAccountId,
  getPayoutAccountVersion,
} from './payoutAccounts';
import {
  exportAirwallexPaymentListWorkbook,
  paymentListWorkbookFilename,
  PaymentListWorkbookError,
} from './paymentListWorkbook';
import type { ProjectSummary } from './pages/ProjectDetailPage';
import type { RequestProjectSummary } from './pages/RequestProjectDetailPage';
import {
  ACTIVE_INVOICE_DEMO_INVOICES,
  ACTIVE_INVOICE_DEMO_PAYOUTS,
  ALL_PROJECT_PROTOTYPE_PAYMENT_LISTS,
  AVAILABLE_PAYMENT_REQUEST_INVOICE_ID,
  PAYMENT_REQUEST_CREATION_DEMO_INVOICES,
  PAYMENT_REQUEST_CREATION_DEMO_PAYOUTS,
  PROJECT_DEMO_CONTRACTS,
  PROJECT_DEMO_INITIAL_REQUEST_CONTRACT_IDS,
  REQUEST_CONTRACT_ASSOCIATION_FIXTURES,
} from './prototypeResourceFixtures';
import {
  applyRequestApprovalAction,
  canReturnRequestApproval,
  canReviewRequestApproval,
  createRequestApprovalState,
  REQUEST_APPROVAL_STATUS_LABEL,
  requestApprovalStage,
  type RequestApprovalAction,
} from './requestApprovalWorkflow';

type CreatedBatch = {
  id: string;
  count: number;
  amount: string;
  provider: string;
  payer: string;
  paidAt: string;
} | null;

const NEXT_STATUS: Partial<Record<Payout['status'], Payout['status']>> = {
  等待付款: '付款处理中',
  信息异常: '等待付款',
  付款处理中: '已付款',
};

const batchAmountLabel = (items: MockBatchSubmission['items']) => {
  const totals = items.reduce<Record<string, number>>((result, item) => ({
    ...result,
    [item.transferCurrency]: (result[item.transferCurrency] ?? 0) + item.transferAmount,
  }), {});
  return Object.entries(totals)
    .map(([currency, amount]) => `${currency} ${amount.toLocaleString('en-US')}`)
    .join(' + ');
};

const getProjectId = (project: ProjectSummary) => (
  (project.cooperationProjectId ?? project.projectId ?? project.id) as ProjectId
);

const FINANCE_REVIEW_FIXTURE_PROJECT_ID = 'PRJ-301164' as ProjectId;
const financeReviewFixtureListId = (provider: PaymentListRecord['provider']) => (
  `payment_list_finance_review_${provider.toLowerCase()}` as PaymentListRecord['paymentListId']
);

const canManageCooperationProjectFor = (user: SystemUser, project: ProjectSummary) => (
  user.roleKey === 'admin'
  || user.roleKey === 'owner'
  || (user.roleKey === 'media' && project.media === (user.scopeName ?? user.name))
);

const INITIAL_REQUEST_PROJECTS_WITH_LINKS: RequestProjectSummary[] = INITIAL_REQUEST_PROJECTS.map((request) => {
  const cooperationProjectId = request.cooperationProjectId ?? request.projectId;
  const isFinanceReviewFixture = cooperationProjectId === FINANCE_REVIEW_FIXTURE_PROJECT_ID;
  const invoicePool = isFinanceReviewFixture
    ? PAYMENT_REQUEST_CREATION_DEMO_INVOICES
    : ACTIVE_INVOICE_DEMO_INVOICES;
  const requestInvoices = invoicePool.filter((invoice) => (
    invoiceCooperationProjectId(invoice) === cooperationProjectId
    && invoice.invoiceId !== AVAILABLE_PAYMENT_REQUEST_INVOICE_ID
  ));
  const invoicesByCreator = requestInvoices.reduce<Map<string, GeneratedInvoiceRecord[]>>((groups, invoice) => {
    if (!invoice.snapshot.creatorId || !invoice.snapshot.engagementId) return groups;
    const existing = groups.get(invoice.snapshot.creatorId) ?? [];
    groups.set(invoice.snapshot.creatorId, [...existing, invoice]);
    return groups;
  }, new Map());
  const creatorLinks = [...invoicesByCreator.values()].flatMap((creatorInvoices) => {
    const firstInvoice = creatorInvoices[0];
    if (!firstInvoice?.snapshot.creatorId || !firstInvoice.snapshot.engagementId) return [];
    const invoiceContractIds = new Set([
      ...creatorInvoices.flatMap((invoice) => invoice.snapshot.contractIds ?? []),
      ...PROJECT_DEMO_INITIAL_REQUEST_CONTRACT_IDS,
    ]);
    const contractIds = [
      ...INITIAL_CONTRACTS,
      ...PROJECT_DEMO_CONTRACTS,
      ...REQUEST_CONTRACT_ASSOCIATION_FIXTURES,
    ]
      .filter((contract) => (
        contract.contractId
        && invoiceContractIds.has(contract.contractId)
        && contractCooperationProjectId(contract) === cooperationProjectId
        && contract.creatorId === firstInvoice.snapshot.creatorId
      ))
      .map((contract) => contract.contractId as ContractId);
    return [{
      creatorId: firstInvoice.snapshot.creatorId,
      engagementId: firstInvoice.snapshot.engagementId,
      contractIds,
      invoiceIds: creatorInvoices.map((invoice) => invoice.invoiceId),
    }];
  });
  return {
    ...request,
    ...(isFinanceReviewFixture ? {
      lifecycle: 'SUBMITTED' as const,
      status: '财务审批中',
      filter: 'pending' as const,
      approval: {
        status: 'PENDING_FINANCE' as const,
        round: 1,
        history: request.approval?.history.filter((event) => event.stage !== 'FINANCE') ?? [],
        submittedAt: request.approval?.submittedAt ?? request.createdAt ?? '2026-08-06T09:00:00.000Z',
        updatedAt: '2026-08-08T09:00:00.000Z',
      },
      paymentListIds: [...new Set(requestInvoices.map((invoice) => (
        financeReviewFixtureListId(invoice.snapshot.paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex')
      )))],
      paymentOrder: [...new Set(requestInvoices.map((invoice) => (
        invoice.snapshot.paymentMethod === 'paypal' ? 'PAY-FINANCE-PAYPAL' : 'PAY-FINANCE-AIRWALLEX'
      )))].join('、'),
    } : {}),
    creatorLinks,
    invoiceIds: paymentRequestInvoiceIds(creatorLinks),
    amount: paymentRequestAmountLabel(creatorLinks, requestInvoices),
    contracts: creatorLinks.reduce((count, link) => count + link.contractIds.length, 0),
    invoices: paymentRequestInvoiceIds(creatorLinks).length,
  };
});

const FINANCE_REVIEW_FIXTURE_PAYMENT_LISTS: PaymentListRecord[] = (() => {
  const request = INITIAL_REQUEST_PROJECTS_WITH_LINKS.find((candidate) => (
    candidate.cooperationProjectId === FINANCE_REVIEW_FIXTURE_PROJECT_ID
  ));
  if (!request?.paymentRequestProjectId) return [];
  const entries = PAYMENT_REQUEST_CREATION_DEMO_INVOICES.map((invoice, index) => ({
    provider: invoice.snapshot.paymentMethod === 'paypal' ? 'PayPal' as const : 'Airwallex' as const,
    item: createPaymentRequestListItem({
      invoice,
      contracts: [...INITIAL_CONTRACTS, ...PROJECT_DEMO_CONTRACTS, ...REQUEST_CONTRACT_ASSOCIATION_FIXTURES],
      contractIds: invoice.snapshot.contractIds ?? [],
      requestCode: request.requestCode ?? request.id,
      lineNumber: index + 1,
    }),
  }));
  return (['Airwallex', 'PayPal'] as const).flatMap((provider) => {
    const items = entries.filter((entry) => entry.provider === provider).map((entry) => entry.item);
    if (!items.length) return [];
    const createdAt = '2026-08-08T08:30:00.000Z';
    return [{
      paymentListId: financeReviewFixtureListId(provider),
      paymentListCode: provider === 'PayPal' ? 'PAY-FINANCE-PAYPAL' : 'PAY-FINANCE-AIRWALLEX',
      projectId: FINANCE_REVIEW_FIXTURE_PROJECT_ID,
      paymentRequestProjectId: request.paymentRequestProjectId,
      provider,
      status: 'submitted' as const,
      version: 1,
      generatedAt: createdAt,
      generatedBy: { account: 'media.fixture', name: request.media, role: '媒介账号' },
      items,
      createdAt,
      updatedAt: createdAt,
    }];
  });
})();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<SystemUser>(CURRENT_USER);
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [payouts, setPayouts] = useState<Payout[]>(() => [
    ...INITIAL_PAYOUTS,
    ...ACTIVE_INVOICE_DEMO_PAYOUTS,
    ...PAYMENT_REQUEST_CREATION_DEMO_PAYOUTS,
  ]);
  const [creators, setCreators] = useState<CreatorProfile[]>(INITIAL_CREATORS);
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [contracts, setContracts] = useState<ContractRecord[]>(() => [
    ...INITIAL_CONTRACTS,
    ...PROJECT_DEMO_CONTRACTS,
    ...REQUEST_CONTRACT_ASSOCIATION_FIXTURES,
  ].map((contract) => ({
    ...contract,
    cooperationProjectId: (contract.cooperationProjectId ?? contract.projectId) as ContractRecord['cooperationProjectId'],
  })));
  const [invoiceEntity, setInvoiceEntity] = useState<InvoiceEntity>(INITIAL_INVOICE_ENTITY);
  const [generatedInvoices, setGeneratedInvoices] = useState<GeneratedInvoiceRecord[]>(() => (
    [...ACTIVE_INVOICE_DEMO_INVOICES, ...PAYMENT_REQUEST_CREATION_DEMO_INVOICES].map((invoice) => ({
      ...invoice,
      snapshot: {
        ...invoice.snapshot,
        cooperationProjectId: invoice.snapshot.cooperationProjectId ?? invoice.snapshot.projectId,
      },
    }))
  ));
  const [paymentLists, setPaymentLists] = useState<PaymentListRecord[]>(() => (
    [
      ...ALL_PROJECT_PROTOTYPE_PAYMENT_LISTS.filter((list) => list.items.some((item) => (
        ACTIVE_INVOICE_DEMO_INVOICES.some((invoice) => invoice.invoiceId === item.invoiceId)
      ))).map((list) => {
        const request = INITIAL_REQUEST_PROJECTS_WITH_LINKS.find((candidate) => (
          candidate.cooperationProjectId === list.projectId
        ));
        const invoiceIds = new Set(request?.creatorLinks ? paymentRequestInvoiceIds(request.creatorLinks) : []);
        return {
          ...list,
          paymentRequestProjectId: request?.paymentRequestProjectId,
          items: list.items.filter((item) => invoiceIds.has(item.invoiceId)),
          versions: list.versions?.map((version) => ({
            ...version,
            items: version.items.filter((item) => invoiceIds.has(item.invoiceId)),
          })),
        };
      }).filter((list) => list.items.length > 0),
      ...FINANCE_REVIEW_FIXTURE_PAYMENT_LISTS,
    ]
  ));
  const [workflowAuditEvents, setWorkflowAuditEvents] = useState<WorkflowAuditEvent[]>([]);
  const [requestProjects, setRequestProjects] = useState(INITIAL_REQUEST_PROJECTS_WITH_LINKS);
  const [invoiceTab, setInvoiceTab] = useState<InvoicePageTab>('signature');
  const [focusedInvoiceId, setFocusedInvoiceId] = useState<string | null>(null);
  const [focusedContractId, setFocusedContractId] = useState<string | null>(null);
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [focusedRequestId, setFocusedRequestId] = useState<string | null>(null);
  const [requestResourceReturn, setRequestResourceReturn] = useState<{
    requestId: string;
    resource: 'contract' | 'invoice';
  } | null>(null);
  const [focusedCreatorId, setFocusedCreatorId] = useState<string | null>(null);
  const [contractGenerationEngagementId, setContractGenerationEngagementId] = useState<EngagementId | null>(null);
  const [invoiceCreationEngagementId, setInvoiceCreationEngagementId] = useState<EngagementId | null>(null);
  const [invoiceEditTarget, setInvoiceEditTarget] = useState<{
    invoiceId: InvoiceId;
    context: InvoiceEditContext;
  } | null>(null);
  const [invoiceEditorDirty, setInvoiceEditorDirty] = useState(false);
  const [invoiceBatchDirty, setInvoiceBatchDirty] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [createdBatch, setCreatedBatch] = useState<CreatedBatch>(null);
  const [financeReviewRequestId, setFinanceReviewRequestId] = useState<string | null>(null);
  const [financeReviewSessions, setFinanceReviewSessions] = useState<Record<string, FinanceReviewSession>>({});

  const notify = useCallback((title: string, message: string) => {
    setToast({ title, message });
  }, []);

  useEffect(() => {
    let active = true;
    void MOCK_FEISHU_COOPERATION_PROJECT_SOURCE.listProjects()
      .then((result) => {
        if (!active) return;
        const identities = new Map(result.projects.map((project) => [project.cooperationProjectId, project]));
        setProjects((current) => current.map((project) => ({
          ...project,
          ...(identities.get(getProjectId(project)) ?? {}),
        })));
      })
      .catch(() => {
        if (!active) return;
        setProjects((current) => current.map((project) => ({ ...project, syncStatus: 'FAILED' })));
      });
    return () => { active = false; };
  }, []);

  const registerProjectMutation = useCallback(({
    projectId,
    engagementId,
    entityType,
    entityId,
    action,
    summary,
  }: {
    projectId: ProjectId;
    engagementId?: EngagementId;
    entityType: WorkflowAuditEvent['entityType'];
    entityId: string;
    action: WorkflowAuditAction;
    summary: string;
  }) => {
    setProjects((current) => current.map((project) => (
      getProjectId(project) === projectId
        ? {
            ...project,
            reviewStatus: nextReviewStatusAfterMutation(currentUser, project.reviewStatus ?? 'draft'),
            reviewUpdatedAt: nowIso(),
            status: nextReviewStatusAfterMutation(currentUser, project.reviewStatus ?? 'draft') === 'changes_required'
              ? '资料已变更'
              : project.status,
          }
        : project
    )));
    setWorkflowAuditEvents((current) => [
      createAuditEvent({
        projectId,
        engagementId,
        entityType,
        entityId,
        action,
        actor: `${currentUser.name}（${currentUser.role}）`,
        summary,
      }),
      ...current,
    ]);
  }, [currentUser]);

  const approvalInvalidatedRequest = useCallback((
    request: RequestProjectSummary,
    summary: string,
  ): RequestProjectSummary => {
    if (['DRAFT', 'RETURNED'].includes(request.lifecycle ?? 'DRAFT')) return request;
    const occurredAt = nowIso();
    const approval = request.approval;
    const interruptedStatus = approval && requestApprovalStage(approval.status)
      ? approval.status as Exclude<RequestApprovalStatus, 'APPROVED' | 'RETURNED_TO_MEDIA_REVIEW'>
      : approval?.resumeStatus ?? 'PENDING_FINANCE';
    const returnedApproval = approval
      ? {
          ...approval,
          status: 'RETURNED_TO_MEDIA_REVIEW' as const,
          returnedFromStage: requestApprovalStage(interruptedStatus) ?? approval.returnedFromStage ?? 'FINANCE' as const,
          resumeStatus: interruptedStatus,
          returnReason: `管理员修改项目资料：${summary}`,
          updatedAt: occurredAt,
          history: [
            ...approval.history,
            {
              round: approval.round,
              stage: requestApprovalStage(interruptedStatus) ?? approval.returnedFromStage ?? 'FINANCE' as const,
              action: 'RETURN' as const,
              actorAccount: currentUser.account,
              actorName: currentUser.name,
              actorRole: currentUser.role,
              fromStatus: approval.status,
              toStatus: 'RETURNED_TO_MEDIA_REVIEW' as const,
              reason: `管理员修改项目资料：${summary}`,
              occurredAt,
            },
          ],
        }
      : approval;
    return {
      ...request,
      lifecycle: 'RETURNED',
      status: '资料已变更',
      filter: 'pending',
      approval: returnedApproval,
    };
  }, [currentUser]);

  const uploadContract = useCallback((input: ContractUploadInput) => {
    const draft = input.draftContractId
      ? contracts.find((contract) => contract.contractId === input.draftContractId)
      : null;
    const record = draft
      ? completeGeneratedContractUpload(draft, input, currentUser.account)
      : createUploadedContract(input, currentUser.account);
    setContracts((current) => draft
      ? current.map((contract) => contract.contractId === draft.contractId ? record : contract)
      : [record, ...current]);
    registerProjectMutation({
      projectId: input.projectId,
      engagementId: input.engagementId,
      entityType: 'contract',
      entityId: record.contractId ?? record.id,
      action: draft ? 'update' : 'create',
      summary: draft ? `已回传合同 ${record.id}` : `已上传合同 ${record.id}`,
    });
    return record;
  }, [contracts, currentUser.account, registerProjectMutation]);

  const generateContract = useCallback((model: ContractGenerationModel, files: ContractGeneratedFiles) => {
    const existing = contracts.find((contract) => (
      contract.engagementId === model.engagementId
      && contract.lifecycle === 'GENERATED_DRAFT'
    ));
    const version = (existing?.generationVersion ?? 0) + 1;
    const documentUrl = URL.createObjectURL(files.pdfBlob);
    const record = createGeneratedContractDraft(model, version, documentUrl, {
      existingContractId: existing?.contractId,
      generationVariant: files.variant,
      qualityReport: files.qualityReport,
      pageCount: files.pageCount,
    });
    if (existing) record.id = existing.id;
    setContracts((current) => existing
      ? current.map((contract) => contract.contractId === existing.contractId ? record : contract)
      : [record, ...current]);
    if (existing?.documentUrl.startsWith('blob:')) URL.revokeObjectURL(existing.documentUrl);
    registerProjectMutation({
      projectId: model.projectId,
      engagementId: model.engagementId,
      entityType: 'contract',
      entityId: record.contractId ?? record.id,
      action: existing ? 'update' : 'create',
      summary: `${existing ? '已更新' : '已生成'}合同${files.variant === 'FORMAL' ? '正式文件' : '草稿'} ${record.id}`,
    });
    return record;
  }, [contracts, registerProjectMutation]);

  const updateContract = useCallback((updated: ContractRecord) => {
    const cooperationProjectId = updated.cooperationProjectId ?? updated.projectId;
    const project = projects.find((item) => getProjectId(item) === cooperationProjectId);
    if (project && !canManageCooperationProjectFor(currentUser, project)) {
      notify('合作项目不可编辑', '当前账号不能修改其他媒介负责的合作项目合同。');
      return;
    }
    const contractId = (updated.contractId ?? updated.id) as ContractId;
    const affectedInvoiceIds = generatedInvoices
      .filter((invoice) => invoice.snapshot.contractIds?.includes(contractId))
      .map((invoice) => invoice.invoiceId);
    const affectedRequests = requestProjects.filter((request) => (
      request.creatorLinks?.some((link) => link.contractIds.includes(contractId))
    ));
    const summary = `已更新合同 ${updated.id}，引用项目需要重新校验`;
    setContracts((current) => current.map((contract) => contract.id === updated.id ? updated : contract));
    if (affectedInvoiceIds.length) {
      setGeneratedInvoices((current) => current.map((invoice) => affectedInvoiceIds.includes(invoice.invoiceId)
        ? { ...invoice, validationStatus: 'needs_review' }
        : invoice));
      setPaymentLists((current) => current.map((list) => {
        if (!list.items.some((item) => affectedInvoiceIds.includes(item.invoiceId))) return list;
        const editableList = list.status === 'draft' ? list : beginPaymentListEdit(list);
        return {
          ...editableList,
          items: editableList.items.map((item) => affectedInvoiceIds.includes(item.invoiceId)
            ? {
                ...item,
                requiresRevalidation: true,
                validationIssues: ['关联合同已变更，请重新校验 Invoice 与付款清单'],
              }
            : item),
          updatedAt: nowIso(),
        };
      }));
    }
    if (affectedRequests.length) {
      const affectedRequestIds = new Set(affectedRequests.map((request) => request.paymentRequestProjectId));
      setRequestProjects((current) => current.map((request) => (
        affectedRequestIds.has(request.paymentRequestProjectId)
          ? approvalInvalidatedRequest(request, summary)
          : request
      )));
      setWorkflowAuditEvents((current) => [
        ...affectedRequests.flatMap((request) => request.cooperationProjectId && request.paymentRequestProjectId
          ? [createAuditEvent({
              projectId: request.cooperationProjectId as ProjectId,
              paymentRequestProjectId: request.paymentRequestProjectId,
              creatorId: updated.creatorId,
              engagementId: updated.engagementId,
              entityType: 'contract',
              entityId: contractId,
              action: 'update',
              actor: `${currentUser.name}（${currentUser.role}）`,
              summary,
            })]
          : []),
        ...current,
      ]);
    }
    if (cooperationProjectId) {
      registerProjectMutation({
        projectId: cooperationProjectId as ProjectId,
        engagementId: updated.engagementId,
        entityType: 'contract',
        entityId: contractId,
        action: 'update',
        summary: `已更新合同 ${updated.id}`,
      });
    }
  }, [
    approvalInvalidatedRequest,
    currentUser,
    generatedInvoices,
    notify,
    projects,
    registerProjectMutation,
    requestProjects,
  ]);

  useEffect(() => {
    document.title = isAuthenticated ? `${PAGE_TITLES[activePage]} · COMETS Pay` : '账号登录 · COMETS Pay';
  }, [activePage, isAuthenticated]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const navigate = (page: NavPage) => {
    if (!canAccessPage(currentUser, page)) {
      notify('暂无操作权限', `${currentUser.role}无法访问该功能。`);
      return false;
    }
    if (
      (
        (activePage === 'invoice-edit' && invoiceEditorDirty)
        || (activePage === 'invoice-batch-create' && invoiceBatchDirty)
      )
      && !window.confirm('当前 Invoice 内容尚未保存，确定切换页面吗？')
    ) {
      return false;
    }
    setActivePage(page);
    setInvoiceEditTarget(null);
    setInvoiceEditorDirty(false);
    setInvoiceBatchDirty(false);
    setFocusedInvoiceId(null);
    setFocusedContractId(null);
    setFocusedProjectId(null);
    setFocusedRequestId(null);
    if (page !== 'creators') setFocusedCreatorId(null);
    setSelectedPayout(null);
    return true;
  };

  const saveCreator = (updated: CreatorProfile) => {
    setCreators((current) => current.some((creator) => creator.id === updated.id)
      ? current.map((creator) => creator.id === updated.id ? updated : creator)
      : [updated, ...current]);
  };

  const payoutFromGeneratedInvoice = (
    record: GeneratedInvoiceRecord,
    existing?: Payout,
  ): Payout => {
      const creator = creators.find((item) => item.id === record.snapshot.creatorId);
      const cooperationProjectId = record.snapshot.cooperationProjectId ?? record.snapshot.projectId;
      const project = projects.find((item) => getProjectId(item) === cooperationProjectId);
      const rawAccount = record.snapshot.paymentMethod === 'paypal'
        ? record.snapshot.payment.paypalEmail
        : record.snapshot.payment.iban || record.snapshot.payment.accountNumber;
      const feeBearers = [...new Set(contracts
        .filter((contract) => record.snapshot.contractIds?.some((contractId) => (
          contract.contractId === contractId || contract.id === contractId
        )))
        .map((contract) => contract.feeBearer)
        .filter(Boolean))];
      return {
        ...existing,
        id: record.sourcePayoutId,
        creator: record.snapshot.creatorName,
        handle: record.snapshot.creatorHandle,
        initials: creator?.initials ?? record.snapshot.creatorName.slice(0, 2).toUpperCase(),
        projectId: String(cooperationProjectId),
        project: project?.name ?? record.snapshot.projectName,
        deliverable: record.snapshot.items.map((item) => item.description).filter(Boolean).join('；'),
        contract: record.snapshot.contractIds?.join('、') || '未关联合同',
        invoice: record.id,
        provider: record.snapshot.paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex',
        currency: record.snapshot.currency,
        amount: record.snapshot.items.reduce((total, item) => total + item.lineTotal, 0),
        account: rawAccount ? `•••• ${rawAccount.replace(/\s/g, '').slice(-4)}` : '待补充',
        creatorId: record.snapshot.creatorId,
        payoutAccountId: record.snapshot.payoutAccountId ?? record.snapshot.payment.payoutAccountId,
        payoutAccountVersion: record.snapshot.payoutAccountVersion ?? record.snapshot.payment.payoutAccountVersion,
        payoutAccountFingerprint: record.snapshot.payoutAccountFingerprint ?? record.snapshot.payment.accountFingerprint,
        externalBeneficiaryId: record.snapshot.payment.externalBeneficiaryId,
        transferMethod: record.snapshot.payment.transferMethod,
        localClearingSystem: record.snapshot.payment.localClearingSystem,
        feeBearer: feeBearers.length === 1 ? feeBearers[0] : '',
        status: '未进入付款',
        invoiceReviewStatus: '待签署',
        invoiceVersion: record.version ?? 1,
        invoiceSignatureRound: 0,
        invoiceSnapshot: record.snapshot,
        accent: creator?.accent ?? '#64748b',
      };
  };

  const addGeneratedInvoices = (records: GeneratedInvoiceRecord[]) => {
    if (!records.length) return;
    const normalized = records.map((record) => ({ ...record, version: record.version ?? 1 }));
    setPayouts((current) => {
      const bySourcePayoutId = new Map(normalized.map((record) => [record.sourcePayoutId, record]));
      const updated = current.map((payout) => {
        const record = bySourcePayoutId.get(payout.id);
        if (!record) return payout;
        bySourcePayoutId.delete(payout.id);
        return payoutFromGeneratedInvoice(record, payout);
      });
      const additions = [...bySourcePayoutId.values()].map((record) => (
        payoutFromGeneratedInvoice(record)
      ));
      return [...additions, ...updated];
    });
    setGeneratedInvoices((current) => [
      ...normalized,
      ...current.filter((item) => !normalized.some((record) => (
        record.invoiceId === item.invoiceId || record.id === item.id
      ))),
    ]);
    normalized.forEach((record) => {
      if (record.snapshot.projectId && record.snapshot.engagementId) {
        registerProjectMutation({
          projectId: record.snapshot.projectId as ProjectId,
          engagementId: record.snapshot.engagementId as EngagementId,
          entityType: 'invoice',
          entityId: record.invoiceId,
          action: 'create',
          summary: `已生成 Invoice ${record.id}`,
        });
      }
    });
    setInvoiceTab('signature');
    notify(
      records.length === 1 ? 'Invoice 已生成' : '批量 Invoice 已生成',
      records.length === 1
        ? `${records[0].id} 的 PDF 与 DOCX 已准备完成，签名区域保持为空。`
        : `${records.length} 张 Invoice 已进入待签署，PDF 与 DOCX 文件已准备完成。`,
    );
  };

  const addGeneratedInvoice = (record: GeneratedInvoiceRecord) => {
    addGeneratedInvoices([record]);
  };

  const findEngagement = (engagementId: EngagementId) => {
    for (const project of projects) {
      const reference = project.creatorProfiles?.find((item) => item.engagementId === engagementId);
      if (reference) return { project, reference };
    }
    return null;
  };

  const linkContractToEngagement = (contractId: string, engagementId: EngagementId) => {
    const context = findEngagement(engagementId);
    const contract = contracts.find((item) => item.contractId === contractId || item.id === contractId);
    if (!context || !contract) return;
    const projectId = getProjectId(context.project);
    if (contract.projectId !== projectId || contract.creatorId !== context.reference.creatorId) {
      notify('无法关联合同', '合同与当前项目达人不一致，系统已阻止跨项目或跨达人关联。');
      return;
    }
    setContracts((current) => current.map((item) => (
      item === contract ? { ...item, engagementId } : item
    )));
    registerProjectMutation({
      projectId,
      engagementId,
      entityType: 'contract',
      entityId: contract.contractId ?? contract.id,
      action: 'link',
      summary: `已关联合同 ${contract.id}`,
    });
  };

  const unlinkContract = (contractId: string) => {
    const contract = contracts.find((item) => item.contractId === contractId || item.id === contractId);
    if (!contract?.projectId || !contract.engagementId) return;
    setContracts((current) => current.map((item) => (
      item === contract ? { ...item, engagementId: undefined } : item
    )));
    setGeneratedInvoices((current) => current.map((invoice) => (
      invoice.snapshot.contractIds?.includes(contract.contractId as ContractId)
        ? {
            ...invoice,
            validationStatus: 'needs_review',
            snapshot: {
              ...invoice.snapshot,
              contractIds: invoice.snapshot.contractIds.filter((id) => id !== contract.contractId),
            },
          }
        : invoice
    )));
    registerProjectMutation({
      projectId: contract.projectId as ProjectId,
      engagementId: contract.engagementId,
      entityType: 'contract',
      entityId: contract.contractId ?? contract.id,
      action: 'unlink',
      summary: `已解除合同 ${contract.id} 的 Engagement 关联`,
    });
  };

  const deleteContract = (contractId: string) => {
    const contract = contracts.find((item) => item.contractId === contractId || item.id === contractId);
    if (contract && !canDeleteContract(currentUser, contract)) {
      notify('暂无操作权限', '管理员可删除全部合同，媒介只能删除本人上传的合同。');
      return;
    }
    if (!contract?.projectId) return;
    setContracts((current) => current.filter((item) => item !== contract));
    setGeneratedInvoices((current) => current.map((invoice) => (
      invoice.snapshot.contractIds?.includes(contract.contractId as ContractId)
        ? {
            ...invoice,
            validationStatus: 'needs_review',
            snapshot: {
              ...invoice.snapshot,
              contractIds: invoice.snapshot.contractIds.filter((id) => id !== contract.contractId),
            },
          }
        : invoice
    )));
    registerProjectMutation({
      projectId: contract.projectId as ProjectId,
      engagementId: contract.engagementId,
      entityType: 'contract',
      entityId: contract.contractId ?? contract.id,
      action: 'delete',
      summary: `已删除合同 ${contract.id}`,
    });
  };

  const deleteContractsFromList = (contractIds: string[]) => {
    const selectedIds = new Set(contractIds);
    const targets = contracts.filter((contract) => selectedIds.has(contract.contractId ?? contract.id));
    if (!targets.length) return 0;
    if (!canDeleteContractSelection(currentUser, targets)) {
      notify(
        '暂无操作权限',
        currentUser.roleKey === 'media'
          ? '媒介只能删除本人上传的合同，请重新选择。'
          : '只有管理员，或合同上传媒介本人可以删除合同。',
      );
      return 0;
    }

    const deletedContractIds = new Set(targets.map((contract) => contract.contractId ?? contract.id));
    const affectedInvoiceIds = new Set(generatedInvoices
      .filter((invoice) => invoice.snapshot.contractIds?.some((id) => deletedContractIds.has(id)))
      .map((invoice) => invoice.invoiceId));
    const deletionSummary = `已删除 ${targets.length} 份合同，关联资料需要重新校验`;

    setContracts((current) => current.filter((contract) => !deletedContractIds.has(contract.contractId ?? contract.id)));
    setGeneratedInvoices((current) => current.map((invoice) => {
      const currentContractIds = invoice.snapshot.contractIds ?? [];
      const remainingContractIds = currentContractIds.filter((id) => !deletedContractIds.has(id));
      if (remainingContractIds.length === currentContractIds.length) return invoice;
      return {
        ...invoice,
        validationStatus: 'needs_review',
        snapshot: { ...invoice.snapshot, contractIds: remainingContractIds },
      };
    }));
    if (affectedInvoiceIds.size) {
      setPaymentLists((current) => current.map((list) => {
        if (!list.items.some((item) => affectedInvoiceIds.has(item.invoiceId))) return list;
        const editableList = list.status === 'draft' ? list : beginPaymentListEdit(list);
        return {
          ...editableList,
          items: editableList.items.map((item) => affectedInvoiceIds.has(item.invoiceId)
            ? {
                ...item,
                requiresRevalidation: true,
                validationIssues: ['关联合同已删除，请重新校验 Invoice 与付款清单'],
              }
            : item),
          updatedAt: nowIso(),
        };
      }));
    }
    setRequestProjects((current) => current.map((request) => {
      let changed = false;
      const creatorLinks = request.creatorLinks?.map((link) => {
        const remainingContractIds = link.contractIds.filter((id) => !deletedContractIds.has(id));
        if (remainingContractIds.length !== link.contractIds.length) changed = true;
        return remainingContractIds.length === link.contractIds.length
          ? link
          : { ...link, contractIds: remainingContractIds };
      });
      if (!changed) return request;
      const nextRequest = {
        ...request,
        creatorLinks,
        contracts: creatorLinks?.reduce((count, link) => count + link.contractIds.length, 0) ?? 0,
      };
      return approvalInvalidatedRequest(nextRequest, deletionSummary);
    }));

    targets.forEach((contract) => {
      if (contract.documentUrl.startsWith('blob:')) URL.revokeObjectURL(contract.documentUrl);
      const projectId = contract.cooperationProjectId ?? contract.projectId;
      if (!projectId) return;
      registerProjectMutation({
        projectId: projectId as ProjectId,
        engagementId: contract.engagementId,
        entityType: 'contract',
        entityId: contract.contractId ?? contract.id,
        action: 'delete',
        summary: `已删除合同 ${contract.id}`,
      });
    });
    return targets.length;
  };

  const linkInvoiceToEngagement = (invoiceId: InvoiceId, engagementId: EngagementId) => {
    const context = findEngagement(engagementId);
    const invoice = generatedInvoices.find((item) => item.invoiceId === invoiceId);
    if (!context || !invoice) return;
    const projectId = getProjectId(context.project);
    const hasExisting = hasInvoiceForEngagement(
      generatedInvoices.map((item) => ({
        invoiceId: item.invoiceId,
        engagementId: item.snapshot.engagementId as EngagementId | undefined,
      })),
      engagementId,
      invoiceId,
    );
    if (hasExisting) {
      notify('无法关联 Invoice', '当前项目达人已有一份 Invoice，请先解除旧关联。');
      return;
    }
    if (invoice.snapshot.projectId !== projectId || invoice.snapshot.creatorId !== context.reference.creatorId) {
      notify('无法关联 Invoice', 'Invoice 与当前项目达人不一致，系统已阻止跨项目或跨达人关联。');
      return;
    }
    setGeneratedInvoices((current) => current.map((item) => item.invoiceId === invoiceId
      ? { ...item, snapshot: { ...item.snapshot, engagementId } }
      : item));
    registerProjectMutation({
      projectId,
      engagementId,
      entityType: 'invoice',
      entityId: invoiceId,
      action: 'link',
      summary: `已关联 Invoice ${invoice.id}`,
    });
  };

  const unlinkInvoice = (invoiceId: InvoiceId) => {
    const invoice = generatedInvoices.find((item) => item.invoiceId === invoiceId);
    if (!invoice?.snapshot.projectId || !invoice.snapshot.engagementId) return;
    setGeneratedInvoices((current) => current.map((item) => item.invoiceId === invoiceId
      ? { ...item, snapshot: { ...item.snapshot, engagementId: undefined } }
      : item));
    setPaymentLists((current) => current.map((list) => removePaymentListItem(list, invoiceId)));
    registerProjectMutation({
      projectId: invoice.snapshot.projectId as ProjectId,
      engagementId: invoice.snapshot.engagementId as EngagementId,
      entityType: 'invoice',
      entityId: invoiceId,
      action: 'unlink',
      summary: `已解除 Invoice ${invoice.id} 的 Engagement 关联`,
    });
  };

  const deleteInvoice = (invoiceId: InvoiceId) => {
    const invoice = generatedInvoices.find((item) => item.invoiceId === invoiceId);
    if (!invoice?.snapshot.projectId) return;
    setGeneratedInvoices((current) => current.filter((item) => item.invoiceId !== invoiceId));
    setPaymentLists((current) => current.map((list) => removePaymentListItem(list, invoiceId)));
    registerProjectMutation({
      projectId: invoice.snapshot.projectId as ProjectId,
      engagementId: invoice.snapshot.engagementId as EngagementId | undefined,
      entityType: 'invoice',
      entityId: invoiceId,
      action: 'delete',
      summary: `已删除 Invoice ${invoice.id}`,
    });
  };

  const openInvoiceEditor = (payout: Payout, context: InvoiceEditContext) => {
    const record = generatedInvoices.find((invoice) => invoice.sourcePayoutId === payout.id);
    if (!record) {
      notify('无法修改 Invoice', '未找到通过 sourcePayoutId 关联的可维护生成记录。');
      return;
    }
    const allowedContext = getInvoiceEditContext(payout, {
      manage: hasPermission(currentUser, 'invoice_manage'),
      mediaReview: hasPermission(currentUser, 'invoice_media_review'),
      financeReview: hasPermission(currentUser, 'invoice_finance_review'),
      projectResourceEdit: Boolean(editableReturnedRequestForInvoice(record.invoiceId)),
    });
    if (allowedContext !== context) {
      notify('无法修改 Invoice', '当前状态或角色不允许从该入口修改 Invoice。');
      return;
    }
    setInvoiceEditTarget({ invoiceId: record.invoiceId, context });
    setInvoiceEditorDirty(false);
    setActivePage('invoice-edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveInvoiceEdit = (snapshot: InvoiceDocumentModel) => {
    if (!invoiceEditTarget) throw new Error('Invoice 修改上下文已失效，请返回详情后重试。');
    const record = generatedInvoices.find((invoice) => invoice.invoiceId === invoiceEditTarget.invoiceId);
    if (!record) throw new Error('未找到需要修改的 Invoice 生成记录。');
    const payout = payouts.find((item) => item.id === record.sourcePayoutId);
    if (!payout) throw new Error('未找到 Invoice 通过 sourcePayoutId 关联的付款记录。');
    const allowedContext = getInvoiceEditContext(payout, {
      manage: hasPermission(currentUser, 'invoice_manage'),
      mediaReview: hasPermission(currentUser, 'invoice_media_review'),
      financeReview: hasPermission(currentUser, 'invoice_finance_review'),
      projectResourceEdit: Boolean(editableReturnedRequestForInvoice(record.invoiceId)),
    });
    const requestEditContext = invoiceEditTarget.context === 'PROJECT_RESOURCE'
      ? editableReturnedRequestForInvoice(record.invoiceId)
      : undefined;
    if (
      invoiceEditTarget.context === 'PROJECT_RESOURCE'
        ? !requestEditContext || !requestResourceEditable(requestEditContext)
        : allowedContext !== invoiceEditTarget.context
    ) {
      throw new Error('当前状态或权限已变化，不能保存本次修改。');
    }

    const result = applyInvoiceDocumentEdit({
      record,
      payout,
      snapshot,
      context: invoiceEditTarget.context,
      actor: {
        account: currentUser.account,
        name: currentUser.name,
        role: currentUser.role,
      },
    });
    const projectId = result.record.snapshot.projectId as ProjectId;
    const refreshedPaymentItem = invoicePaymentListItem(result.record, contracts);
    setGeneratedInvoices((current) => current.map((invoice) => (
      invoice.invoiceId === result.record.invoiceId ? result.record : invoice
    )));
    setPayouts((current) => current.map((item) => (
      item.id === result.payout.id ? result.payout : item
    )));
    setPaymentLists((current) => current.map((list) => (
      list.projectId === projectId && list.items.some((item) => item.invoiceId === result.record.invoiceId)
        ? { ...refreshPaymentListItemSnapshot(list, refreshedPaymentItem), status: 'draft' }
        : list
    )));
    setProjects((current) => current.map((project) => (
      getProjectId(project) === projectId
        ? {
            ...project,
            reviewStatus: 'returned',
            status: '待重新签署',
            reviewUpdatedAt: nowIso(),
          }
        : project
    )));
    setRequestProjects((current) => current.map((request) => request.creatorLinks?.some((link) => (
      link.invoiceIds.includes(result.record.invoiceId)
    ))
      ? approvalInvalidatedRequest(
          { ...request, status: '待重新签署', filter: 'pending' },
          'Invoice 文件内容已生成新版本，原签署失效',
        )
      : request));
    setWorkflowAuditEvents((current) => [
      createAuditEvent({
        projectId,
        engagementId: result.record.snapshot.engagementId as EngagementId | undefined,
        entityType: 'invoice',
        entityId: result.record.invoiceId,
        action: 'update',
        actor: `${currentUser.name}（${currentUser.role}）`,
        summary: `已生成 Invoice ${result.record.id} v${result.record.version ?? 1}，原签署失效并回到待签署`,
      }),
      ...current,
    ]);
    setInvoiceEditTarget(null);
    setInvoiceEditorDirty(false);
    if (requestResourceReturn?.resource === 'invoice') {
      setFocusedProjectId(requestResourceReturn.requestId);
      setRequestResourceReturn(null);
      setActivePage('projects');
    } else {
      setFocusedInvoiceId(`generated:${result.record.id}`);
      setInvoiceTab('signature');
      setActivePage('invoice');
    }
    notify(
      'Invoice 新版本已生成',
      `${result.record.id} 已更新为 v${result.record.version ?? 1}，等待达人重新签署。`,
    );
    return result.record;
  };

  const canMutatePaymentList = (project: ProjectSummary, list: PaymentListRecord | undefined) => (
    Boolean(list)
    && list?.status === 'draft'
    && canEditProject(currentUser, project.reviewStatus ?? 'draft')
  );

  const createPaymentList = (project: ProjectSummary) => {
    const projectId = getProjectId(project);
    if (!canEditProject(currentUser, project.reviewStatus ?? 'draft')) {
      notify('项目资料已锁定', '当前账号不能创建该项目的付款清单。');
      return;
    }
    const invoices = generatedInvoices.filter((invoice) => (
      invoice.snapshot.projectId === projectId && invoice.snapshot.engagementId
    ));
    const createdAt = nowIso();
    if (paymentLists.some((list) => list.projectId === projectId)) {
      notify(
        '付款清单已存在',
        '每个项目保留一张当前付款清单。',
      );
      return;
    }
    if (!invoices.length) {
      notify('尚无可加入付款清单的 Invoice', '请先为项目达人生成包含付款账户的 Invoice。');
      return;
    }
    const list: PaymentListRecord = {
      paymentListId: createPrototypeId('payment-list') as PaymentListRecord['paymentListId'],
      paymentListCode: createPrototypeCode('PAY'),
      projectId,
      provider: 'Airwallex',
      status: 'draft',
      items: invoices.map((invoice) => invoicePaymentListItem(invoice, contracts)),
      createdAt,
      updatedAt: createdAt,
    };
    setPaymentLists((current) => [list, ...current]);
    registerProjectMutation({
      projectId,
      entityType: 'payment-list',
      entityId: list.paymentListId,
      action: 'create',
      summary: `已创建项目付款清单草稿 ${list.paymentListCode}`,
    });
  };

  const deletePaymentList = (project: ProjectSummary, paymentListId: PaymentListRecord['paymentListId']) => {
    const projectId = getProjectId(project);
    const list = paymentLists.find((item) => (
      item.projectId === projectId && item.paymentListId === paymentListId
    ));
    if (!list) return;
    if (!canMutatePaymentList(project, list)) {
      notify('付款单已锁定', '请先进入可编辑草稿状态，再删除付款清单。');
      return;
    }
    setPaymentLists((current) => current.filter((item) => item.paymentListId !== list.paymentListId));
    registerProjectMutation({
      projectId,
      entityType: 'payment-list',
      entityId: list.paymentListId,
      action: 'delete',
      summary: `已删除付款清单 ${list.paymentListCode}`,
    });
  };

  const addPaymentInvoice = (
    project: ProjectSummary,
    paymentListId: PaymentListRecord['paymentListId'],
    invoiceId: InvoiceId,
  ) => {
    const projectId = getProjectId(project);
    const invoice = generatedInvoices.find((item) => item.invoiceId === invoiceId);
    const list = paymentLists.find((item) => (
      item.projectId === projectId && item.paymentListId === paymentListId
    ));
    if (!canMutatePaymentList(project, list)) {
      notify('付款单已锁定', '请先进入可编辑草稿状态，再添加付款行。');
      return;
    }
    if (!invoice?.snapshot.engagementId || invoice.snapshot.projectId !== projectId) return;
    setPaymentLists((current) => current.map((list) => (
      list.paymentListId === paymentListId
        ? { ...upsertPaymentListItem(list, invoicePaymentListItem(invoice, contracts)), status: 'draft' }
        : list
    )));
    registerProjectMutation({
      projectId,
      engagementId: invoice.snapshot.engagementId as EngagementId,
      entityType: 'payment-list',
      entityId: invoiceId,
      action: 'update',
      summary: `付款清单已添加 Invoice ${invoice.id}`,
    });
  };

  const removePaymentInvoice = (project: ProjectSummary, invoiceId: InvoiceId) => {
    const projectId = getProjectId(project);
    const list = paymentLists.find((item) => (
      item.projectId === projectId && item.items.some((candidate) => candidate.invoiceId === invoiceId)
    ));
    if (!canMutatePaymentList(project, list)) {
      notify('付款单已锁定', '请先进入可编辑草稿状态，再移除付款行。');
      return;
    }
    const targetPaymentListId = list!.paymentListId;
    setPaymentLists((current) => current.map((candidate) => (
      candidate.paymentListId === targetPaymentListId
        ? { ...removePaymentListItem(candidate, invoiceId), status: 'draft' }
        : candidate
    )));
    registerProjectMutation({
      projectId,
      entityType: 'payment-list',
      entityId: invoiceId,
      action: 'update',
      summary: '已从付款清单移除一笔 Invoice，Invoice 源记录保留',
    });
  };

  const updatePaymentItem = (
    project: ProjectSummary,
    invoiceId: InvoiceId,
    field: PaymentListEditableField,
    value: string | number,
  ) => {
    const projectId = getProjectId(project);
    const list = paymentLists.find((item) => (
      item.projectId === projectId && item.items.some((candidate) => candidate.invoiceId === invoiceId)
    ));
    if (!canMutatePaymentList(project, list)) {
      notify('付款单已锁定', '请先进入可编辑草稿状态，再修改付款字段。');
      return;
    }
    const targetPaymentListId = list!.paymentListId;
    setPaymentLists((current) => current.map((candidate) => candidate.paymentListId === targetPaymentListId
      ? {
          ...candidate,
          status: 'draft',
          updatedAt: nowIso(),
          items: candidate.items.map((item) => item.invoiceId === invoiceId
            ? {
                ...item,
                overrides: { ...item.overrides, [field]: value },
                requiresRevalidation: true,
                validationIssues: ['付款清单字段已修改，请重新校验'],
              }
            : item),
        }
      : candidate));
    registerProjectMutation({
      projectId,
      entityType: 'payment-list',
      entityId: invoiceId,
      action: 'update',
      summary: '已修改付款清单字段并保留 Invoice 原始快照',
    });
  };

  const revalidatePaymentItem = (
    project: ProjectSummary,
    invoiceId: InvoiceId,
  ) => {
    const projectId = getProjectId(project);
    const list = paymentLists.find((candidate) => (
      candidate.projectId === projectId
      && candidate.items.some((item) => item.invoiceId === invoiceId)
    ));
    if (!canMutatePaymentList(project, list)) {
      notify('付款单已锁定', '请先进入可编辑草稿状态，再重新校验付款行。');
      return;
    }
    const currentItem = list?.items.find((item) => item.invoiceId === invoiceId);
    if (!currentItem) {
      notify('无法重新校验', '未找到付款清单中的稳定 invoiceId 关联。');
      return;
    }
    const effectiveAccount = paymentListEffectiveAccount(currentItem);
    const creator = creators.find((candidate) => candidate.id === currentItem.snapshot.creatorId);
    const account = creator?.payoutAccounts.find((candidate) => (
      getPayoutAccountId(candidate) === effectiveAccount.payoutAccountId
    ));
    const validated = revalidatePaymentListItem(
      currentItem,
      nowIso(),
      account
        ? {
            payoutAccountId: getPayoutAccountId(account),
            payoutAccountVersion: getPayoutAccountVersion(account),
            accountFingerprint: getPayoutAccountFingerprint(account),
            provider: account.provider,
            externalBeneficiaryId: account.provider === 'Airwallex' ? account.beneficiaryId : undefined,
            validationStatus: account.status,
          }
        : null,
    );
    const validationIssues = validated.validationIssues ?? [];
    const targetPaymentListId = list!.paymentListId;
    setPaymentLists((current) => current.map((candidate) => {
      if (candidate.paymentListId !== targetPaymentListId) return candidate;
      return {
        ...candidate,
        updatedAt: nowIso(),
        items: candidate.items.map((item) => item.invoiceId === invoiceId ? validated : item),
      };
    }));
    registerProjectMutation({
      projectId,
      entityType: 'payment-list',
      entityId: invoiceId,
      action: 'update',
      summary: validationIssues.length
        ? `付款清单重新校验未通过：${validationIssues[0]}`
        : '付款清单账户版本已重新校验',
    });
    notify(
      validationIssues.length ? '付款清单校验未通过' : '付款清单已重新校验',
      validationIssues[0] ?? '账户 ID、版本、Beneficiary、付款场景和费用规则均已通过。',
    );
  };

  const changePaymentAccount = (
    project: ProjectSummary,
    invoiceId: InvoiceId,
    payoutAccountId: string,
  ) => {
    const projectId = getProjectId(project);
    const list = paymentLists.find((candidate) => candidate.projectId === projectId);
    if (!canMutatePaymentList(project, list)) {
      notify('付款单已锁定', '请先进入可编辑草稿状态，再更换收款账户。');
      return;
    }
    const item = list?.items.find((candidate) => candidate.invoiceId === invoiceId);
    const creator = creators.find((candidate) => candidate.id === item?.snapshot.creatorId);
    const account = creator?.payoutAccounts.find((candidate) => (
      getPayoutAccountId(candidate) === payoutAccountId
    ));
    if (!item || !creator || !account) {
      notify('无法更换收款账户', '未找到该达人通过稳定 payoutAccountId 关联的可用收款账户。');
      return;
    }
    const updated = applyPaymentListPayoutSnapshot(
      item,
      createDocumentPayoutSnapshot(account, creator.id),
    );
    const paymentListId = list!.paymentListId;
    setPaymentLists((current) => current.map((candidate) => candidate.paymentListId === paymentListId
      ? {
          ...candidate,
          status: 'draft',
          updatedAt: nowIso(),
          items: candidate.items.map((currentItem) => currentItem.invoiceId === invoiceId ? updated : currentItem),
        }
      : candidate));
    registerProjectMutation({
      projectId,
      engagementId: item.engagementId,
      entityType: 'payment-list',
      entityId: invoiceId,
      action: 'update',
      summary: `已为 ${item.snapshot.invoiceNumber} 选择 ${account.provider} 收款账户，Invoice 原始快照保持不变`,
    });
  };

  const generatePaymentOrder = (
    project: ProjectSummary,
    paymentListId: PaymentListRecord['paymentListId'],
  ) => {
    const projectId = getProjectId(project);
    const list = paymentLists.find((candidate) => (
      candidate.projectId === projectId && candidate.paymentListId === paymentListId
    ));
    if (!list) {
      notify('无法生成付款单', '当前项目尚未创建付款清单。');
      return null;
    }
    if (!canMutatePaymentList(project, list)) {
      notify('付款单已锁定', '请先进入编辑态，再生成新的付款单版本。');
      return null;
    }
    const expectedInvoiceIds = generatedInvoices
      .filter((invoice) => (
        invoice.snapshot.projectId === projectId
        && invoice.snapshot.engagementId
      ))
      .map((invoice) => invoice.invoiceId);
    const result = generatePaymentListVersion({
      list,
      expectedInvoiceIds,
      actor: {
        account: currentUser.account,
        name: currentUser.name,
        role: currentUser.role,
      },
    });
    if (result.issues.length) {
      notify('付款单生成失败', result.issues[0].message);
      return result.issues[0].invoiceId ?? null;
    }
    setPaymentLists((current) => current.map((candidate) => (
      candidate.paymentListId === list.paymentListId ? result.record : candidate
    )));
    registerProjectMutation({
      projectId,
      entityType: 'payment-list',
      entityId: list.paymentListId,
      action: 'update',
      summary: `已生成付款单 ${list.paymentListCode} v${result.record.version ?? 1} 并锁定当前内容`,
    });
    notify(
      '付款单已生成',
      `${list.paymentListCode} v${result.record.version ?? 1} 已保存，提交请款前可重新进入编辑态。`,
    );
    return null;
  };

  const editPaymentOrder = (
    project: ProjectSummary,
    paymentListId: PaymentListRecord['paymentListId'],
  ) => {
    const projectId = getProjectId(project);
    const list = paymentLists.find((candidate) => (
      candidate.projectId === projectId && candidate.paymentListId === paymentListId
    ));
    if (!list) return;
    const privileged = currentUser.roleKey === 'admin' || currentUser.roleKey === 'owner';
    const historicalStatus = ['submitted', 'approved', 'paid'].includes(list.status);
    if (historicalStatus && !privileged) {
      notify('付款单已锁定', '提交请款后的付款单只有在审批退回或付款清单问题退回后才能修改。');
      return;
    }
    if (list.status === 'generated' && !canEditProject(currentUser, project.reviewStatus ?? 'draft')) {
      notify('付款单已锁定', '当前账号不能重新编辑该项目的付款单。');
      return;
    }
    if (list.status !== 'generated' && !historicalStatus) return;
    const updated = beginPaymentListEdit(list);
    setPaymentLists((current) => current.map((candidate) => {
      return candidate.paymentListId === list.paymentListId ? updated : candidate;
    }));
    if (historicalStatus) {
      setRequestProjects((current) => current.map((request) => request.projectId === projectId
        ? {
            ...request,
            status: '资料已变更',
            filter: 'pending',
            approval: request.approval
              ? {
                  ...request.approval,
                  status: 'RETURNED_TO_MEDIA_REVIEW',
                  returnReason: '管理员或老板已创建付款单新版本，原审批结果失效。',
                  updatedAt: nowIso(),
                }
              : request.approval,
          }
        : request));
    }
    registerProjectMutation({
      projectId,
      entityType: 'payment-list',
      entityId: list.paymentListId,
      action: 'update',
      summary: historicalStatus
        ? `已从付款单 v${list.version ?? 1} 创建特权修改草稿，历史版本保持不变`
        : `已重新编辑付款单 v${list.version ?? 1}`,
    });
    notify(
      historicalStatus ? '新版本草稿已创建' : '付款单已恢复编辑',
      historicalStatus
        ? '原审批与付款快照已保留；完成修改后需要重新生成付款单。'
        : '修改完成后请重新生成付款单，生成前不会覆盖当前历史版本。',
    );
  };

  const exportPaymentList = async (
    project: ProjectSummary,
    paymentListId: PaymentListRecord['paymentListId'],
  ) => {
    const projectId = getProjectId(project);
    const list = paymentLists.find((candidate) => (
      candidate.projectId === projectId && candidate.paymentListId === paymentListId
    ));
    if (!list) {
      notify('无法导出付款清单', '当前项目尚未生成付款清单。');
      return;
    }
    try {
      const blob = await exportAirwallexPaymentListWorkbook({
        paymentList: list,
        creators,
      });
      downloadBlob(
        blob,
        paymentListWorkbookFilename(project.projectCode ?? project.id, list),
      );
      notify(
        ['approved', 'paid'].includes(list.status) ? '付款清单已导出' : '付款清单预览已导出',
        'Excel 由浏览器本地生成，包含付款资料，请按敏感文件管理。',
      );
    } catch (error) {
      const message = error instanceof PaymentListWorkbookError
        ? error.issues[0]
        : error instanceof Error
          ? error.message
          : '付款清单导出失败';
      notify('无法导出付款清单', message);
    }
  };

  const appendReviewAudit = (
    project: ProjectSummary,
    action: 'submit' | 'return' | 'approve',
    summary: string,
  ) => {
    const projectId = getProjectId(project);
    setWorkflowAuditEvents((current) => [
      createAuditEvent({
        projectId,
        entityType: 'project',
        entityId: projectId,
        action,
        actor: `${currentUser.name}（${currentUser.role}）`,
        summary,
      }),
      ...current,
    ]);
  };

  const submitProjectReview = (project: ProjectSummary) => {
    const projectId = getProjectId(project);
    const references = (project.creatorProfiles ?? []).filter((item) => item.status !== 'removed');
    const projectInvoices = generatedInvoices.filter((invoice) => (
      invoice.snapshot.projectId === projectId && invoice.snapshot.engagementId
    ));
    const lists = paymentLists.filter((item) => item.projectId === projectId);
    const invalidPaymentItems = lists.flatMap((list) => (
      list.items.filter((item) => item.requiresRevalidation)
    ));
    const linkedPayouts = projectInvoices.map((invoice) => (
      payouts.find((payout) => payout.id === invoice.sourcePayoutId)
    ));
    const paymentListResubmissionState = getPaymentListResubmissionState(linkedPayouts);
    const isPaymentListResubmission = paymentListResubmissionState === 'ELIGIBLE';
    if (paymentListResubmissionState === 'INVALID') {
      notify('暂不能重新提交付款清单', '本轮 Invoice 状态不一致，请核对项目稳定关联和付款失败分类。');
      return;
    }
    const paymentListsNotReady = isPaymentListResubmission
      ? !lists.some((list) => list.status === 'generated')
        || lists.some((list) => list.status === 'draft')
      : lists.some((list) => list.status !== 'generated');
    if (!lists.length || paymentListsNotReady) {
      notify('请先生成付款单', '项目付款清单必须完成校验并生成锁定版本后，才能提交请款审核。');
      return;
    }
    if (
      linkedPayouts.some((payout) => !payout)
      || (
        !isPaymentListResubmission
        && linkedPayouts.some((payout) => payout?.invoiceReviewStatus !== '待发起请款')
      )
    ) {
      notify('暂不能发起请款', '项目内全部 Invoice 必须先完成达人签署和媒介审核。');
      return;
    }
    if (invalidPaymentItems.length > 0) {
      notify(
        '付款清单需要重新校验',
        `${invalidPaymentItems.length} 笔账户快照未通过校验：${invalidPaymentItems[0].validationIssues?.[0] ?? '请检查账户版本与付款资料。'}`,
      );
      return;
    }
    const submissionIssues = validateProjectSubmission({
      engagementIds: references.map((reference) => reference.engagementId),
      invoices: projectInvoices.map((invoice) => ({
        invoiceId: invoice.invoiceId,
        engagementId: invoice.snapshot.engagementId as EngagementId | undefined,
        validationStatus: invoice.validationStatus,
      })),
      paymentListInvoiceIds: lists.flatMap((list) => list.items.map((item) => item.invoiceId)),
    });
    if (submissionIssues.length) {
      notify(
        '暂不能提交审核',
        submissionIssues.includes('NO_ENGAGEMENT')
          ? '项目至少需要一位达人。'
          : submissionIssues.includes('INVOICE_COUNT')
            ? '每位项目达人必须有且仅有一份 Invoice。'
            : submissionIssues.includes('PAYMENT_LIST_MISSING')
              ? '项目付款清单必须包含项目内全部 Invoice。'
              : '存在需要重新校验的 Invoice。',
      );
      return;
    }
    const submittedAt = nowIso();
    const previousRequest = requestProjects.find((item) => item.projectId === projectId);
    const approval = createRequestApprovalState(submittedAt, previousRequest?.approval);
    const paymentListVersionByInvoice = new Map(
      lists.flatMap((list) => list.items.map((item) => [item.invoiceId, list.version ?? 1] as const)),
    );
    const invoiceIds = projectInvoices.map((invoice) => invoice.invoiceId);
    const sourcePayoutIds = new Set(projectInvoices.map((invoice) => invoice.sourcePayoutId));
    setProjects((current) => current.map((item) => getProjectId(item) === projectId
      ? { ...item, reviewStatus: 'submitted', submittedAt, reviewUpdatedAt: submittedAt, status: '待审批' }
      : item));
    setPaymentLists((current) => current.map((item) => item.projectId === projectId
      ? {
          ...item,
          status: 'submitted',
          updatedAt: submittedAt,
        }
      : item));
    setPayouts((current) => current.map((payout) => sourcePayoutIds.has(payout.id)
      ? {
          ...payout,
          status: '未进入付款',
          requestApprovalRound: approval.round,
          paymentListVersion: projectInvoices
            .find((invoice) => invoice.sourcePayoutId === payout.id)
            ? paymentListVersionByInvoice.get(
                projectInvoices.find((invoice) => invoice.sourcePayoutId === payout.id)!.invoiceId,
              ) ?? 1
            : payout.paymentListVersion,
          invoiceReviewHistory: [
            ...(payout.invoiceReviewHistory ?? []),
            {
              stage: 'REQUEST',
              action: '提交请款',
              actorAccount: currentUser.account,
              actorName: currentUser.name,
              actorRole: currentUser.role,
              fromStatus: payout.invoiceReviewStatus,
              toStatus: payout.invoiceReviewStatus,
              occurredAt: submittedAt,
              approvalRound: approval.round,
            },
          ],
          issue: undefined,
          returnReason: undefined,
          paymentFailure: payout.paymentFailureReturn?.issueType === 'PAYMENT_LIST'
            ? undefined
            : payout.paymentFailure,
          paymentFailureReturn: payout.paymentFailureReturn?.issueType === 'PAYMENT_LIST'
            ? undefined
            : payout.paymentFailureReturn,
        }
      : payout));
    const requestId = previousRequest?.id ?? createPrototypeCode('REQ');
    const requestAmount = lists.flatMap((list) => list.items).reduce<Record<string, number>>((result, item) => {
      const currency = String(item.overrides.currency ?? item.snapshot.currency);
      const amount = Number(item.overrides.amount ?? item.snapshot.amount);
      return { ...result, [currency]: (result[currency] ?? 0) + amount };
    }, {});
    const amountLabel = Object.entries(requestAmount)
      .map(([currency, amount]) => `${currency} ${amount.toLocaleString('en-US')}`)
      .join(' + ');
    const request: RequestProjectSummary = {
      id: requestId,
      projectId,
      invoiceIds,
      paymentListId: lists[0]?.paymentListId,
      paymentListIds: lists.map((list) => list.paymentListId),
      approval,
      createdAt: approval.submittedAt,
      project: project.name,
      brand: project.brand,
      media: project.media,
      pm: project.pm,
      amount: amountLabel,
      contracts: contracts.filter((contract) => contract.projectId === projectId && contract.lifecycle !== 'GENERATED_DRAFT').length,
      invoices: projectInvoices.length,
      paymentOrder: lists.map((list) => list.paymentListCode).join('、'),
      status: myProjectStatusFor({ approval, lifecycle: 'SUBMITTED' }),
      filter: 'pending',
      generatedDetail: {
        brand: project.brand,
        reason: project.requestReason || '项目达人费用请款',
        contractId: projectInvoices.flatMap((invoice) => invoice.snapshot.contractIds ?? []).join('、') || '未关联',
        contractName: '按项目达人 Engagement 关联',
        contractAmount: '按所选合同与 Invoice 校验',
        contractStatus: projectInvoices.some((invoice) => invoice.snapshot.contractIds?.length) ? '已匹配' : '未关联',
        invoiceId: projectInvoices.map((invoice) => invoice.id).join('、'),
        invoiceAmount: amountLabel,
        invoiceStatus: '已校验',
        paymentListId: lists.map((list) => list.paymentListCode).join('、'),
        paymentListStatus: '已提交',
        payee: `${references.length} 位项目达人`,
        provider: lists.map((list) => list.provider).join('、'),
        beneficiaryId: '按付款清单账户快照',
        feePolicy: '按合同及付款清单执行',
      },
    };
    setRequestProjects((current) => [
      request,
      ...current.filter((item) => item.id !== request.id && item.projectId !== projectId),
    ]);
    appendReviewAudit(
      project,
      'submit',
      `${isPaymentListResubmission ? '已重新提交付款清单并创建' : '已提交'}第 ${approval.round} 轮项目请款审批`,
    );
    notify(
      isPaymentListResubmission ? '付款清单已重新提交' : '已提交项目请款',
      `${project.name} 已进入第 ${approval.round} 轮${REQUEST_APPROVAL_STATUS_LABEL[approval.status]}。Invoice 签署版本保持不变。`,
    );
  };

  const generateMediaRequestPaymentLists = (request: RequestProjectSummary) => {
    if (!request.paymentRequestProjectId || !request.cooperationProjectId || !request.creatorLinks?.length) {
      notify('无法生成付款清单', '请款项目缺少稳定项目 ID 或达人 Invoice 关联。');
      return;
    }
    try {
      const createdAt = nowIso();
      const entries = request.creatorLinks.flatMap((link) => link.invoiceIds.map((invoiceId) => ({
        link,
        invoiceId,
      }))).map(({ link, invoiceId }, index) => {
        const invoice = generatedInvoices.find((candidate) => candidate.invoiceId === invoiceId);
        if (!invoice) throw new Error(`未找到 Invoice ${invoiceId}`);
        return createPaymentRequestListItem({
          invoice,
          contracts,
          contractIds: link.contractIds,
          requestCode: request.requestCode ?? request.id,
          lineNumber: index + 1,
        });
      });
      const groups = entries.reduce<Record<string, typeof entries>>((result, item) => {
        const provider = item.snapshot.provider === 'PayPal' ? 'PayPal' : 'Airwallex';
        result[provider] = [...(result[provider] ?? []), item];
        return result;
      }, {});
      const lists: PaymentListRecord[] = Object.entries(groups).map(([provider, items]) => ({
        paymentListId: createPrototypeId('payment-list') as PaymentListRecord['paymentListId'],
        paymentListCode: createPrototypeCode('PAY'),
        projectId: request.cooperationProjectId as ProjectId,
        paymentRequestProjectId: request.paymentRequestProjectId,
        provider: provider as PaymentListRecord['provider'],
        status: 'generated',
        version: 1,
        generatedAt: createdAt,
        generatedBy: { account: currentUser.account, name: currentUser.name, role: currentUser.role },
        items,
        createdAt,
        updatedAt: createdAt,
      }));
      setPaymentLists((current) => [
        ...lists,
        ...current.filter((list) => list.paymentRequestProjectId !== request.paymentRequestProjectId),
      ]);
      setRequestProjects((current) => current.map((candidate) => candidate.id === request.id
        ? {
            ...candidate,
            paymentListId: lists[0]?.paymentListId,
            paymentListIds: lists.map((list) => list.paymentListId),
            paymentOrder: lists.map((list) => list.paymentListCode).join('、'),
            generatedDetail: candidate.generatedDetail
              ? {
                  ...candidate.generatedDetail,
                  paymentListId: lists.map((list) => list.paymentListCode).join('、'),
                  paymentListStatus: '已生成',
                }
              : candidate.generatedDetail,
          }
        : candidate));
      notify('付款清单已生成', `${lists.length} 份渠道清单仅包含当前请款项目的 ${entries.length} 份 Invoice。`);
    } catch (error) {
      notify('无法生成付款清单', error instanceof Error ? error.message : 'Invoice 账户快照校验失败。');
    }
  };

  const submitMediaPaymentRequest = (request: RequestProjectSummary) => {
    const creatorLinks = request.creatorLinks ?? [];
    const issues = paymentRequestSubmissionIssues({
      creatorLinks,
      invoices: generatedInvoices,
      paymentLists,
      paymentRequestProjectId: request.paymentRequestProjectId,
    });
    if (!request.cooperationProjectId || !request.paymentRequestProjectId || !request.pm || !request.generatedDetail?.reason) {
      issues.unshift('项目必填资料不完整，请检查关联项目、PM 和请款原因');
    }
    const invoiceIds = paymentRequestInvoiceIds(creatorLinks);
    const duplicateInvoiceId = invoiceIds.find((invoiceId) => requestProjects.some((candidate) => (
      candidate.paymentRequestProjectId !== request.paymentRequestProjectId
      && candidate.creatorLinks?.some((candidateLink) => candidateLink.invoiceIds.includes(invoiceId))
    )));
    if (duplicateInvoiceId) issues.push(`Invoice ${duplicateInvoiceId} 已关联其他请款项目`);
    if (issues.length) {
      notify('暂不能提交申请', issues[0]);
      return;
    }

    const requestLists = paymentLists.filter((list) => (
      list.paymentRequestProjectId === request.paymentRequestProjectId
    ));
    const listedInvoiceIds = new Set(requestLists.flatMap((list) => list.items.map((item) => item.invoiceId)));
    if (!requestLists.length || invoiceIds.some((invoiceId) => !listedInvoiceIds.has(invoiceId))) {
      notify('暂不能提交申请', '请先在项目详情生成当前请款项目专属的付款清单。');
      return;
    }

    const submittedAt = nowIso();
    const approval = createRequestApprovalState(submittedAt, request.approval);
    const paymentListIds = requestLists.map((list) => list.paymentListId);
    const paymentListCodes = requestLists.map((list) => list.paymentListCode);
    const sourcePayoutIds = new Set(
      generatedInvoices
        .filter((invoice) => invoiceIds.includes(invoice.invoiceId))
        .map((invoice) => invoice.sourcePayoutId),
    );

    setPaymentLists((current) => current.map((list) => list.paymentRequestProjectId === request.paymentRequestProjectId
      ? { ...list, status: 'submitted', updatedAt: submittedAt }
      : list));
    setPayouts((current) => current.map((payout) => sourcePayoutIds.has(payout.id)
      ? {
          ...payout,
          status: '未进入付款',
          requestApprovalRound: approval.round,
        }
      : payout));
    setRequestProjects((current) => current.map((candidate) => (
      candidate.id === request.id
        ? {
            ...candidate,
            lifecycle: 'SUBMITTED',
            approval,
            status: myProjectStatusFor({ approval, lifecycle: 'SUBMITTED' }),
            invoiceIds,
            paymentListId: paymentListIds[0],
            paymentListIds,
            paymentOrder: paymentListCodes.join('、'),
            generatedDetail: candidate.generatedDetail
              ? {
                  ...candidate.generatedDetail,
                  invoiceStatus: '已提交审批',
                  paymentListId: paymentListCodes.join('、'),
                  paymentListStatus: '已提交',
                }
              : candidate.generatedDetail,
          }
        : candidate
    )));
    setWorkflowAuditEvents((current) => [
      createAuditEvent({
        projectId: request.cooperationProjectId as ProjectId,
        entityType: 'project',
        entityId: request.paymentRequestProjectId as PaymentRequestProjectId,
        action: 'submit',
        actor: `${currentUser.name}（${currentUser.role}）`,
        summary: `已提交请款项目 ${request.requestCode ?? request.id}`,
      }),
      ...current,
    ]);
    notify('申请已提交', `${request.requestCode ?? request.id} 已进入 PM 审批。`);
  };

  const handleRequestApproval = (
    request: RequestProjectSummary,
    action: RequestApprovalAction,
    reason?: string,
  ) => {
    const canApprove = Boolean(
      request.approval
      && canReviewRequestApproval(currentUser, request.approval, request.pm),
    );
    const canReturn = Boolean(
      request.approval
      && canReturnRequestApproval(currentUser, request.approval, request.pm),
    );
    if (!request.approval || (action === 'APPROVE' ? !canApprove : !canReturn)) {
      notify('暂无审批权限', '当前账号不是该请款当前节点的审批人，不能越级处理。');
      return false;
    }
    const currentStage = requestApprovalStage(request.approval.status);
    if (!currentStage) {
      notify('当前状态不可审批', '该请款已结束当前审批轮次。');
      return false;
    }
    if (action === 'APPROVE' && currentStage === 'FINANCE') {
      const financeReview = buildRequestFinanceReview(request, generatedInvoices, paymentLists);
      const session = financeReviewSessions[financeReviewSessionKey(
        request.id,
        request.approval.round,
        currentUser.account,
      )];
      if (!financeReviewSessionCanApprove(session, financeReview)) {
        const pendingCount = financeReview.pages.filter((page) => (
          session?.decisions[page.key]?.state !== 'correct'
        )).length;
        notify(
          '暂不能通过财务审核',
          financeReview.mismatchCount
            ? `Invoice 与付款清单存在 ${financeReview.mismatchCount} 项关键差异，请记录原因后退回修改。`
            : financeReview.totalCount
              ? `还有 ${pendingCount} 份 Invoice 尚未由当前审核人确认无误。`
            : '该请款没有可核对的 Invoice 与付款清单稳定关联。',
        );
        return false;
      }
    }
    try {
      const occurredAt = nowIso();
      const nextApproval = applyRequestApprovalAction(
        request.approval,
        action,
        { account: currentUser.account, name: currentUser.name, role: currentUser.role },
        reason,
        occurredAt,
      );
      const invoiceIds = new Set(request.invoiceIds ?? []);
      const sourcePayoutIds = new Set(
        generatedInvoices
          .filter((invoice) => invoiceIds.has(invoice.invoiceId))
          .map((invoice) => invoice.sourcePayoutId),
      );
      if (sourcePayoutIds.size === 0) {
        const requestProjectId = request.projectId ?? request.id;
        payouts
          .filter((payout) => payout.projectId === requestProjectId)
          .forEach((payout) => sourcePayoutIds.add(payout.id));
      }
      const isReturned = nextApproval.status === 'RETURNED_TO_MEDIA_REVIEW';
      const isApproved = nextApproval.status === 'APPROVED';
      setPayouts((current) => current.map((payout) => {
        if (!sourcePayoutIds.has(payout.id)) return payout;
        const nextInvoiceStatus = isApproved ? '已通过' : payout.invoiceReviewStatus;
        return {
          ...payout,
          status: isApproved ? '等待付款' : payout.status,
          invoiceReviewStatus: nextInvoiceStatus,
          invoiceReviewHistory: isApproved
            ? [
                ...(payout.invoiceReviewHistory ?? []),
                {
                  stage: 'FINANCE',
                  action: '审核通过',
                  actorAccount: currentUser.account,
                  actorName: currentUser.name,
                  actorRole: currentUser.role,
                  fromStatus: payout.invoiceReviewStatus,
                  toStatus: '已通过',
                  occurredAt,
                  approvalRound: nextApproval.round,
                },
              ]
            : payout.invoiceReviewHistory,
        };
      }));
      if (isApproved) {
        setGeneratedInvoices((current) => current.map((invoice) => (
          sourcePayoutIds.has(invoice.sourcePayoutId)
            ? { ...invoice, status: '已通过' }
            : invoice
        )));
      }
      const nextRequestLifecycle = isApproved ? 'APPROVED' as const : isReturned ? 'RETURNED' as const : 'SUBMITTED' as const;
      setRequestProjects((current) => current.map((item) => item.id === request.id
        ? {
            ...item,
            approval: nextApproval,
            lifecycle: nextRequestLifecycle,
            status: myProjectStatusFor({ approval: nextApproval, lifecycle: nextRequestLifecycle }),
            filter: isApproved ? 'processed' : 'pending',
            generatedDetail: item.generatedDetail
              ? {
                  ...item.generatedDetail,
                  invoiceStatus: isApproved ? '已通过' : isReturned ? '已退回' : 'OA审批中',
                  paymentListStatus: isApproved ? '已批准' : isReturned ? '已生成' : '审批中',
                }
              : item.generatedDetail,
          }
        : item));
      if (request.projectId && !request.paymentRequestProjectId) {
        setProjects((current) => current.map((project) => getProjectId(project) === request.projectId
          ? {
              ...project,
              reviewStatus: isApproved ? 'approved' : isReturned ? 'returned' : 'submitted',
              reviewUpdatedAt: occurredAt,
              returnedAt: isReturned ? occurredAt : project.returnedAt,
              status: isApproved
                ? '已通过'
                : isReturned
                  ? '已退回'
                  : REQUEST_APPROVAL_STATUS_LABEL[nextApproval.status],
            }
          : project));
      }
      if (request.paymentRequestProjectId || request.projectId) {
        setPaymentLists((current) => current.map((list) => (
          request.paymentRequestProjectId
            ? list.paymentRequestProjectId === request.paymentRequestProjectId
            : list.projectId === request.projectId
        )
          ? {
              ...list,
              status: isApproved ? 'approved' : isReturned ? 'generated' : 'submitted',
              updatedAt: occurredAt,
            }
          : list));
      }
      appendReviewAudit(
        (projects.find((project) => getProjectId(project) === request.projectId)
          ?? { id: request.id } as ProjectSummary),
        isReturned ? 'return' : isApproved ? 'approve' : 'approve',
        isReturned
          ? `第 ${nextApproval.round} 轮审批在${REQUEST_APPROVAL_STATUS_LABEL[request.approval.status]}退回媒介修改`
          : `${REQUEST_APPROVAL_STATUS_LABEL[request.approval.status]}已通过`,
      );
      notify(
        isReturned ? '已退回媒介修改' : isApproved ? '财务审批已通过' : '审批已通过',
        isReturned
          ? `请款项目已退回，修改后将回到“${REQUEST_APPROVAL_STATUS_LABEL[request.approval.status]}”；Invoice 可按反馈选择是否修改。`
          : isApproved
            ? '项目请款与关联 Invoice 已通过，付款入口已解锁。'
            : `请款已进入“${REQUEST_APPROVAL_STATUS_LABEL[nextApproval.status]}”。`,
      );
      if (currentStage === 'FINANCE') {
        const completedSessionKey = financeReviewSessionKey(
          request.id,
          request.approval.round,
          currentUser.account,
        );
        setFinanceReviewSessions((current) => {
          const next = { ...current };
          delete next[completedSessionKey];
          return next;
        });
      }
      return true;
    } catch (error) {
      notify('审批操作失败', error instanceof Error ? error.message : '当前节点无法执行该操作。');
      return false;
    }
  };

  const openFinanceReview = (requestId: string) => {
    const request = requestProjects.find((candidate) => candidate.id === requestId);
    if (!request?.approval || request.approval.status !== 'PENDING_FINANCE') {
      notify('当前无需财务审核', '该请款已不在待财务审核节点。');
      return;
    }
    if (!canReviewRequestApproval(currentUser, request.approval, request.pm)) {
      notify('暂无审批权限', '当前账号不是该请款的财务审核人。');
      return;
    }
    const review = buildRequestFinanceReview(request, generatedInvoices, paymentLists);
    const sessionKey = financeReviewSessionKey(request.id, request.approval.round, currentUser.account);
    setFinanceReviewSessions((current) => ({
      ...current,
      [sessionKey]: reconcileFinanceReviewSession(current[sessionKey], {
        requestId: request.id,
        approvalRound: request.approval!.round,
        reviewerAccount: currentUser.account,
        review,
      }),
    }));
    setFinanceReviewRequestId(request.id);
  };

  const advancePayout = (payout: Payout) => {
    if (!isInvoiceApprovedForPayment(payout)) {
      notify('Invoice 尚未通过', '完成媒介与财务审核后才能推进付款。');
      return;
    }
    const nextStatus = NEXT_STATUS[payout.status];
    if (!nextStatus) return;
    const updated: Payout = {
      ...payout,
      status: nextStatus,
      issue: payout.status === '信息异常' ? undefined : payout.issue,
      paidAt: nextStatus === '已付款' ? '2026-07-17 刚刚' : payout.paidAt,
    };
    const nextPayouts = payouts.map((item) => item.id === payout.id ? updated : item);
    const completedRequests = nextStatus === '已付款'
      ? requestProjects.filter((request) => (
          request.lifecycle === 'APPROVED'
          && isPaymentRequestFullyPaid({ request, invoices: generatedInvoices, payouts: nextPayouts })
        ))
      : [];
    const completedRequestIds = new Set(completedRequests.map((request) => request.paymentRequestProjectId).filter(Boolean));
    const completedLegacyInvoiceIds = new Set(completedRequests
      .filter((request) => !request.paymentRequestProjectId)
      .flatMap((request) => request.creatorLinks?.length
        ? paymentRequestInvoiceIds(request.creatorLinks)
        : request.invoiceIds ?? []));
    const completedIds = new Set(completedRequests.map((request) => request.id));
    setPayouts(nextPayouts);
    if (completedRequests.length) {
      const completedAt = nowIso();
      setRequestProjects((current) => current.map((request) => (
        completedIds.has(request.id)
          ? { ...request, lifecycle: 'COMPLETED', status: '已付款', filter: 'processed' }
          : request
      )));
      setPaymentLists((current) => current.map((list) => (
        (list.paymentRequestProjectId && completedRequestIds.has(list.paymentRequestProjectId))
        || (
          !list.paymentRequestProjectId
          && list.items.length > 0
          && list.items.every((item) => completedLegacyInvoiceIds.has(item.invoiceId))
        )
          ? { ...list, status: 'paid', updatedAt: completedAt }
          : list
      )));
    }
    setSelectedPayout((current) => current?.id === payout.id ? updated : current);
    notify('付款状态已更新', `${payout.creator} 已进入“${nextStatus}”。`);
  };

  const failPayout = (payout: Payout) => {
    if (!isInvoiceApprovedForPayment(payout) || payout.status !== '付款处理中') {
      notify('无法记录付款失败', '仅付款处理中的已通过 Invoice 可以记录渠道失败。');
      return;
    }
    if (!hasPermission(currentUser, 'payout_execute')) {
      notify('暂无付款权限', '当前账号不能操作付款结果。');
      return;
    }
    const occurredAt = nowIso();
    const failureReason = '渠道付款失败：SIMULATED_PROVIDER_DECLINE';
    const updated: Payout = {
      ...payout,
      status: '付款失败',
      paymentFailure: {
        provider: payout.provider,
        errorCode: 'SIMULATED_PROVIDER_DECLINE',
        providerResponse: 'Prototype channel response: transfer was declined.',
        occurredAt,
      },
      invoiceReviewHistory: [
        ...(payout.invoiceReviewHistory ?? []),
        {
          stage: 'PAYMENT',
          action: '付款失败',
          actorAccount: currentUser.account,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          fromStatus: payout.invoiceReviewStatus,
          toStatus: payout.invoiceReviewStatus,
          reason: failureReason,
          occurredAt,
        },
      ],
      issue: failureReason,
    };
    setPayouts((current) => current.map((item) => item.id === payout.id ? updated : item));
    setSelectedPayout((current) => current?.id === payout.id ? updated : current);
    notify('已记录付款失败', '请由财务选择问题类型并退回媒介，当前不可直接重试付款。');
  };

  const returnPayout = (
    payout: Payout,
    issueType: PaymentFailureIssueType,
    reason: string,
  ) => {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      notify('请填写退回原因', '付款失败退回媒介时必须说明需要处理的内容。');
      return;
    }
    if (
      payout.status !== '付款失败'
      || !payout.paymentFailure
      || !hasPermission(currentUser, 'payout_execute')
    ) {
      notify('无法退回媒介', '只有财务、管理员或老板可以处理当前付款失败记录。');
      return;
    }
    const occurredAt = nowIso();
    const updated: Payout = {
      ...payout,
      status: '已退回',
      invoiceReviewStatus: '已退回',
      paymentFailureReturn: {
        issueType,
        reason: normalizedReason,
        actorAccount: currentUser.account,
        actorName: currentUser.name,
        occurredAt,
        restartStage: paymentFailureRestartStage(issueType),
      },
      invoiceReviewHistory: [
        ...(payout.invoiceReviewHistory ?? []),
        {
          stage: 'PAYMENT',
          action: '退回媒介',
          actorAccount: currentUser.account,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          fromStatus: payout.invoiceReviewStatus,
          toStatus: '已退回',
          reason: normalizedReason,
          occurredAt,
        },
      ],
      returnReason: normalizedReason,
      issue: `付款失败已退回：${normalizedReason}`,
    };
    setPayouts((current) => current.map((item) => item.id === payout.id ? updated : item));
    setGeneratedInvoices((current) => current.map((invoice) => invoice.sourcePayoutId === payout.id
      ? { ...invoice, status: '已退回' }
      : invoice));
    if (issueType === 'PAYMENT_LIST') {
      const project = projects.find((item) => item.id === payout.projectId);
      const projectId = project ? getProjectId(project) : null;
      setProjects((current) => current.map((item) => item.id === payout.projectId
        ? {
            ...item,
            reviewStatus: 'returned',
            status: '付款清单待修改',
            reviewUpdatedAt: occurredAt,
          }
        : item));
      if (projectId) {
        setPaymentLists((current) => current.map((list) => list.projectId === projectId
          ? { ...list, status: 'draft', updatedAt: occurredAt }
          : list));
        setRequestProjects((current) => current.map((request) => request.projectId === projectId
          ? {
              ...request,
              status: '付款清单待修改',
              filter: 'pending',
              approval: request.approval
                ? {
                    ...request.approval,
                    status: 'RETURNED_TO_MEDIA_REVIEW',
                    returnReason: normalizedReason,
                    updatedAt: occurredAt,
                  }
                : request.approval,
            }
          : request));
      }
    }
    setSelectedPayout((current) => current?.id === payout.id ? updated : current);
    notify(
      '已退回媒介',
      issueType === 'INVOICE_CONTENT'
        ? '请在 Invoice 详情进入修改页，生成新版后从达人签署开始。'
        : 'Invoice 保持已退回，请在项目付款清单修正并重新提交后进入 PM 审批。',
    );
  };

  const updateInvoiceReview = (
    payout: Payout,
    action: InvoiceReviewAction,
    reason?: string,
  ) => {
    const allowedActions = getAvailableInvoiceReviewActions(payout.invoiceReviewStatus, {
      manage: hasPermission(currentUser, 'invoice_manage'),
      mediaReview: hasPermission(currentUser, 'invoice_media_review'),
      financeReview: hasPermission(currentUser, 'invoice_finance_review'),
    });
    if (!allowedActions.includes(action)) {
      notify('暂无审核权限', `${currentUser.role}不能处理“${payout.invoiceReviewStatus}”阶段。`);
      return;
    }
    try {
      const updated = applyInvoiceReviewAction(
        payout,
        action,
        { account: currentUser.account, name: currentUser.name, role: currentUser.role },
        reason,
      );
      setPayouts((current) => current.map((item) => (
        item.id === payout.id ? updated : item
      )));
      setGeneratedInvoices((current) => current.map((record) => (
        record.sourcePayoutId === payout.id
          ? { ...record, status: updated.invoiceReviewStatus }
          : record
      )));
      setInvoiceTab(getInvoicePageTab(updated.invoiceReviewStatus));
      if (action === 'APPROVE_MEDIA') {
        const allProjectInvoicesReady = payouts
          .filter((item) => item.projectId === payout.projectId)
          .every((item) => (
            item.id === payout.id
              ? updated.invoiceReviewStatus === '待发起请款'
              : item.invoiceReviewStatus === '待发起请款'
          ));
        setProjects((current) => current.map((project) => project.id === payout.projectId
          ? {
              ...project,
              status: allProjectInvoicesReady ? '待发起请款' : 'Invoice审核中',
            }
          : project));
      }
      notify('Invoice 审核状态已更新', `${payout.invoice} 已进入“${updated.invoiceReviewStatus}”。`);
    } catch (error) {
      notify('状态更新失败', error instanceof Error ? error.message : '当前 Invoice 无法执行该操作。');
    }
  };

  const replyInvoiceFeedback = (payout: Payout, message: string) => {
    if (!hasPermission(currentUser, 'invoice_manage')) {
      notify('暂无操作权限', `${currentUser.role}不能回复达人反馈。`);
      return;
    }
    try {
      const updated = replyToCreatorFeedback(
        payout,
        { account: currentUser.account, name: currentUser.name, role: currentUser.role },
        message,
      );
      setPayouts((current) => current.map((item) => item.id === payout.id ? updated : item));
      notify('回复已记录', `已回复 ${payout.creator} 对 ${payout.invoice} 的反馈。`);
    } catch (error) {
      notify('回复失败', error instanceof Error ? error.message : '当前反馈无法回复。');
    }
  };

  const sendInvoiceSignatureReminder = (
    payout: Payout,
    message: string,
    email: string,
  ) => {
    if (!hasPermission(currentUser, 'invoice_manage')) {
      notify('暂无操作权限', `${currentUser.role}不能通知达人签署 Invoice。`);
      return false;
    }
    const linkedPayout = payouts.find((item) => item.id === payout.id);
    if (!linkedPayout) {
      notify('通知发送失败', '未找到 Invoice 生成时关联的付款记录，请返回列表后重试。');
      return false;
    }
    try {
      const updated = recordInvoiceSignatureReminder(
        linkedPayout,
        { account: currentUser.account, name: currentUser.name, role: currentUser.role },
        message,
        email,
      );
      setPayouts((current) => current.map((item) => item.id === linkedPayout.id ? updated : item));
      const latestEvent = updated.invoiceReviewHistory?.[updated.invoiceReviewHistory.length - 1];
      const emailDelivery = latestEvent?.notificationDeliveries?.find((delivery) => (
        delivery.channel === 'EMAIL'
      ));
      notify(
        '签署提醒已记录',
        emailDelivery?.status === 'SIMULATED_SENT'
          ? '原型已模拟通过达人端站内信和邮件发送提醒。'
          : '原型已模拟发送站内信；达人邮箱待补充，邮件未发送。',
      );
      return true;
    } catch (error) {
      notify('通知发送失败', error instanceof Error ? error.message : '当前 Invoice 无法发送签署提醒。');
      return false;
    }
  };

  const markInvoiceSigned = (record: GeneratedInvoiceRecord) => {
    if (!hasPermission(currentUser, 'invoice_manage')) {
      notify('暂无操作权限', `${currentUser.role}不能提交签署完成的 Invoice。`);
      return;
    }
    const linkedPayout = payouts.find((payout) => payout.id === record.sourcePayoutId);
    if (!linkedPayout) {
      notify('无法提交审核', '未找到生成 Invoice 时关联的付款记录，请重新生成。');
      return;
    }

    try {
      const updatedPayout = markGeneratedInvoiceSigned(
        linkedPayout,
        record,
        { account: currentUser.account, name: currentUser.name, role: currentUser.role },
      );
      setPayouts((current) => current.map((payout) => (
        payout.id === linkedPayout.id ? updatedPayout : payout
      )));
      setGeneratedInvoices((current) => current.map((invoice) => (
        invoice.invoiceId === record.invoiceId
          ? { ...invoice, status: updatedPayout.invoiceReviewStatus }
          : invoice
      )));
      setInvoiceTab('review');
      setFocusedInvoiceId(linkedPayout.id);
      notify('已提交媒介审核', `${record.id} 已标记签署完成，当前状态为“待媒介审核”。`);
    } catch (error) {
      notify('提交失败', error instanceof Error ? error.message : '当前 Invoice 无法提交审核。');
    }
  };

  const openInvoiceFromPayout = (payout: Payout) => {
    const request = findInvoiceRequest(payout, generatedInvoices, requestProjects);
    setInvoiceTab(getInvoiceManagementView(payout, request).tab);
    setFocusedInvoiceId(payout.id);
    setSelectedPayout(null);
    setActivePage('invoice');
  };

  const openContractFromPayout = (contract: ContractRecord) => {
    setFocusedContractId(contract.id);
    setSelectedPayout(null);
    setActivePage('contracts');
  };

  const openProjectFromInvoice = (payout: Payout) => {
    const invoice = generatedInvoices.find((item) => item.sourcePayoutId === payout.id);
    const request = invoice
      ? requestProjects.find((item) => item.creatorLinks?.some((link) => link.invoiceIds.includes(invoice.invoiceId)))
      : undefined;
    if (!request) {
      notify('未找到我的项目', '该 Invoice 尚未关联媒介请款项目，请先在“我的项目”中创建项目。');
      return;
    }
    setFocusedProjectId(request.id);
    setFocusedInvoiceId(null);
    setActivePage('projects');
  };

  const openRequestFromInvoice = (payout: Payout) => {
    const invoice = generatedInvoices.find((item) => item.sourcePayoutId === payout.id);
    const directRequest = invoice
      ? requestProjects.find((request) => request.invoiceIds?.includes(invoice.invoiceId))
      : undefined;
    const projectRequests = requestProjects.filter((request) => request.projectId === payout.projectId);
    const linkedRequest = directRequest ?? (projectRequests.length === 1 ? projectRequests[0] : undefined);
    if (!linkedRequest) {
      notify(
        projectRequests.length > 1 ? '请款关联不明确' : '未找到关联请款',
        '无法通过稳定 invoiceId / projectId 唯一定位请款记录。',
      );
      return;
    }
    setFocusedRequestId(linkedRequest.id);
    setFocusedInvoiceId(null);
    setActivePage('requests');
  };

  const requestResourceEditable = (request: RequestProjectSummary) => (
    currentUser.roleKey === 'admin'
    || currentUser.roleKey === 'owner'
    || (currentUser.roleKey === 'media' && ['DRAFT', 'RETURNED'].includes(request.lifecycle ?? 'DRAFT'))
  );

  const editableReturnedRequestForInvoice = (invoiceId: InvoiceId) => requestProjects.find((request) => (
    request.lifecycle === 'RETURNED'
    && request.creatorLinks?.some((link) => link.invoiceIds.includes(invoiceId))
    && requestResourceEditable(request)
  ));

  const registerRequestResourceMutation = (
    request: RequestProjectSummary,
    entityType: WorkflowAuditEvent['entityType'],
    entityId: string,
    action: WorkflowAuditAction,
    summary: string,
    creatorId?: WorkflowAuditEvent['creatorId'],
    engagementId?: WorkflowAuditEvent['engagementId'],
  ) => {
    if (!request.cooperationProjectId || !request.paymentRequestProjectId) return;
    setWorkflowAuditEvents((current) => [
      createAuditEvent({
        projectId: request.cooperationProjectId as ProjectId,
        paymentRequestProjectId: request.paymentRequestProjectId,
        creatorId,
        engagementId,
        entityType,
        entityId,
        action,
        actor: `${currentUser.name}（${currentUser.role}）`,
        summary,
      }),
      ...current,
    ]);
  };

  const changeRequestResourceLinks = (
    request: RequestProjectSummary,
    links: PaymentRequestCreatorLink[],
    summary: string,
  ) => {
    if (!requestResourceEditable(request)) {
      notify('项目资料已锁定', '当前账号或项目状态不允许修改关联资料。');
      return;
    }
    const invoiceIds = paymentRequestInvoiceIds(links);
    const contractIds = [...new Set(links.flatMap((link) => link.contractIds))];
    setRequestProjects((current) => current.map((candidate) => {
      if (candidate.paymentRequestProjectId !== request.paymentRequestProjectId) return candidate;
      const updated = approvalInvalidatedRequest({
        ...candidate,
        creatorLinks: links,
        invoiceIds,
        amount: paymentRequestAmountLabel(links, generatedInvoices),
        contracts: contractIds.length,
        invoices: invoiceIds.length,
        paymentOrder: candidate.paymentListIds?.length ? '待重新生成' : '待生成',
        generatedDetail: candidate.generatedDetail ? {
          ...candidate.generatedDetail,
          contractId: contractIds.join('、') || '未关联',
          contractName: contractIds.length ? `${contractIds.length} 份已选合同` : '合同选填，当前未关联',
          contractStatus: contractIds.length ? '待重新校验' : '未关联',
          invoiceId: invoiceIds.join('、'),
          invoiceAmount: paymentRequestAmountLabel(links, generatedInvoices),
          invoiceStatus: '待重新校验',
          paymentListStatus: '待重新生成',
        } : candidate.generatedDetail,
      }, summary);
      return updated;
    }));
    setPaymentLists((current) => current.map((list) => {
      if (list.paymentRequestProjectId !== request.paymentRequestProjectId) return list;
      const editableList = list.status === 'draft' ? list : beginPaymentListEdit(list);
      return {
        ...editableList,
        items: editableList.items
          .filter((item) => invoiceIds.includes(item.invoiceId))
          .map((item) => ({
            ...item,
            requiresRevalidation: true,
            validationIssues: ['项目关联资料已变更，请重新校验'],
          })),
        updatedAt: nowIso(),
      };
    }));
    setGeneratedInvoices((current) => current.map((invoice) => invoiceIds.includes(invoice.invoiceId)
      ? { ...invoice, validationStatus: 'needs_review' }
      : invoice));
    registerRequestResourceMutation(request, 'project', request.paymentRequestProjectId ?? request.id, 'update', summary);
    notify('项目资料已更新', `${summary}。付款清单和审批结果需要重新校验。`);
  };

  const requestListFor = (request: RequestProjectSummary, paymentListId: PaymentListRecord['paymentListId']) => (
    paymentLists.find((list) => (
      list.paymentRequestProjectId === request.paymentRequestProjectId
      && list.paymentListId === paymentListId
    ))
  );

  const markRequestResourceChanged = (request: RequestProjectSummary, summary: string) => {
    setRequestProjects((current) => current.map((candidate) => (
      candidate.paymentRequestProjectId === request.paymentRequestProjectId
        ? approvalInvalidatedRequest(candidate, summary)
        : candidate
    )));
    registerRequestResourceMutation(request, 'payment-list', request.paymentRequestProjectId ?? request.id, 'update', summary);
  };

  const requestResourceActions: RequestProjectResourceActions = {
    onChangeLinks: changeRequestResourceLinks,
    onOpenContract: (request, contractId) => {
      setRequestResourceReturn({ requestId: request.id, resource: 'contract' });
      setFocusedContractId(contractId);
      setActivePage('contracts');
    },
    onOpenInvoice: (request, invoiceId) => {
      const invoice = generatedInvoices.find((candidate) => candidate.invoiceId === invoiceId);
      if (!invoice) return;
      setRequestResourceReturn({ requestId: request.id, resource: 'invoice' });
      setFocusedInvoiceId(`generated:${invoice.id}`);
      setInvoiceTab('signature');
      setActivePage('invoice');
    },
    onGenerateContract: (request) => {
      setRequestResourceReturn({ requestId: request.id, resource: 'contract' });
      setContractGenerationEngagementId(null);
      setActivePage('contract-create');
    },
    onGenerateInvoice: (request) => {
      setRequestResourceReturn({ requestId: request.id, resource: 'invoice' });
      setInvoiceCreationEngagementId(null);
      setActivePage('invoice-create');
    },
    onUploadContract: (_request, input) => uploadContract(input),
    onDeleteContract: (request, contractId) => {
      const contract = contracts.find((candidate) => (candidate.contractId ?? candidate.id) === contractId);
      if (!contract || !canDeleteContract(currentUser, contract)) {
        notify('暂无操作权限', '管理员可删除全部合同，媒介只能删除本人上传的合同。');
        return;
      }
      const other = requestProjects.find((candidate) => (
        candidate.paymentRequestProjectId !== request.paymentRequestProjectId
        && candidate.creatorLinks?.some((link) => link.contractIds.includes(contractId))
      ));
      if (other) {
        notify('无法删除合同', `该合同仍被 ${other.requestCode ?? other.id} 引用，请先解除关联。`);
        return;
      }
      setContracts((current) => current.filter((contract) => (contract.contractId ?? contract.id) !== contractId));
      setGeneratedInvoices((current) => current.map((invoice) => invoice.snapshot.contractIds?.includes(contractId)
        ? {
            ...invoice,
            validationStatus: 'needs_review',
            snapshot: { ...invoice.snapshot, contractIds: invoice.snapshot.contractIds.filter((id) => id !== contractId) },
          }
        : invoice));
      registerRequestResourceMutation(
        request,
        'contract',
        contractId,
        'delete',
        `已删除合同 ${contractId}`,
        contract?.creatorId,
        contract?.engagementId,
      );
      changeRequestResourceLinks(request, (request.creatorLinks ?? []).map((link) => ({
        ...link,
        contractIds: link.contractIds.filter((id) => id !== contractId),
      })), `已删除合同 ${contractId}`);
    },
    onDeleteInvoice: (request, invoiceId) => {
      const invoice = generatedInvoices.find((candidate) => candidate.invoiceId === invoiceId);
      const other = requestProjects.find((candidate) => (
        candidate.paymentRequestProjectId !== request.paymentRequestProjectId
        && candidate.creatorLinks?.some((link) => link.invoiceIds.includes(invoiceId))
      ));
      if (other) {
        notify('无法删除 Invoice', `该 Invoice 仍被 ${other.requestCode ?? other.id} 引用，请先解除关联。`);
        return;
      }
      setGeneratedInvoices((current) => current.filter((invoice) => invoice.invoiceId !== invoiceId));
      if (invoice) {
        setPayouts((current) => current.filter((payout) => payout.id !== invoice.sourcePayoutId));
      }
      setPaymentLists((current) => current.map((list) => removePaymentListItem(list, invoiceId)));
      registerRequestResourceMutation(
        request,
        'invoice',
        invoiceId,
        'delete',
        `已删除 Invoice ${invoiceId}`,
        invoice?.snapshot.creatorId,
        invoice?.snapshot.engagementId as EngagementId | undefined,
      );
      changeRequestResourceLinks(request, (request.creatorLinks ?? []).map((link) => ({
        ...link,
        invoiceIds: link.invoiceIds.filter((id) => id !== invoiceId),
      })), `已删除 Invoice ${invoiceId}`);
    },
    onClearPaymentLists: (request) => {
      const requestLists = paymentLists.filter((list) => (
        list.paymentRequestProjectId === request.paymentRequestProjectId
      ));
      const clearedItemCount = requestLists.reduce((sum, list) => sum + list.items.length, 0);
      if (!requestResourceEditable(request) || !clearedItemCount) return;
      const clearedAt = nowIso();
      setPaymentLists((current) => current.map((list) => (
        list.paymentRequestProjectId === request.paymentRequestProjectId
          ? clearPaymentListItems(list, clearedAt)
          : list
      )));
      markRequestResourceChanged(request, `已清空付款清单，共移除 ${clearedItemCount} 笔付款行`);
    },
    onRemovePaymentInvoice: (request, paymentListId, invoiceId) => {
      const list = requestListFor(request, paymentListId);
      if (!requestResourceEditable(request) || !list || list.status !== 'draft') return;
      setPaymentLists((current) => current.map((candidate) => candidate.paymentListId === paymentListId
        ? removePaymentListItem(candidate, invoiceId)
        : candidate));
      markRequestResourceChanged(request, `已从付款清单移除 Invoice ${invoiceId}`);
    },
    onUpdatePaymentItem: (request, paymentListId, invoiceId, field, value) => {
      const list = requestListFor(request, paymentListId);
      if (!requestResourceEditable(request) || !list || list.status !== 'draft') return;
      setPaymentLists((current) => current.map((candidate) => candidate.paymentListId === paymentListId ? {
        ...candidate,
        updatedAt: nowIso(),
        items: candidate.items.map((item) => item.invoiceId === invoiceId ? {
          ...item,
          overrides: { ...item.overrides, [field]: value },
          requiresRevalidation: true,
          validationIssues: ['付款字段已修改，请重新校验'],
        } : item),
      } : candidate));
      markRequestResourceChanged(request, `已修改 Invoice ${invoiceId} 的付款字段`);
    },
    onChangePaymentAccount: (request, paymentListId, invoiceId, payoutAccountId) => {
      const list = requestListFor(request, paymentListId);
      const item = list?.items.find((candidate) => candidate.invoiceId === invoiceId);
      const creator = creators.find((candidate) => candidate.id === item?.snapshot.creatorId);
      const account = creator?.payoutAccounts.find((candidate) => getPayoutAccountId(candidate) === payoutAccountId);
      if (!requestResourceEditable(request) || !list || list.status !== 'draft' || !item || !creator || !account) return;
      const updated = applyPaymentListPayoutSnapshot(item, createDocumentPayoutSnapshot(account, creator.id));
      setPaymentLists((current) => current.map((candidate) => candidate.paymentListId === paymentListId ? {
        ...candidate,
        updatedAt: nowIso(),
        items: candidate.items.map((paymentItem) => paymentItem.invoiceId === invoiceId ? updated : paymentItem),
      } : candidate));
      markRequestResourceChanged(request, `已更换 Invoice ${invoiceId} 的收款账户`);
    },
    onRevalidatePaymentItem: (request, paymentListId, invoiceId) => {
      const list = requestListFor(request, paymentListId);
      const item = list?.items.find((candidate) => candidate.invoiceId === invoiceId);
      const effectiveAccount = item ? paymentListEffectiveAccount(item) : null;
      const creator = creators.find((candidate) => candidate.id === item?.snapshot.creatorId);
      const account = creator?.payoutAccounts.find((candidate) => getPayoutAccountId(candidate) === effectiveAccount?.payoutAccountId);
      if (!requestResourceEditable(request) || !list || list.status !== 'draft' || !item) return;
      const validated = revalidatePaymentListItem(item, nowIso(), account ? {
        payoutAccountId: getPayoutAccountId(account),
        payoutAccountVersion: getPayoutAccountVersion(account),
        accountFingerprint: getPayoutAccountFingerprint(account),
        provider: account.provider,
        externalBeneficiaryId: account.provider === 'Airwallex' ? account.beneficiaryId : undefined,
        validationStatus: account.status,
      } : null);
      setPaymentLists((current) => current.map((candidate) => candidate.paymentListId === paymentListId ? {
        ...candidate,
        updatedAt: nowIso(),
        items: candidate.items.map((paymentItem) => paymentItem.invoiceId === invoiceId ? validated : paymentItem),
      } : candidate));
      notify(validated.requiresRevalidation ? '付款明细校验未通过' : '付款明细已重新校验', validated.validationIssues?.[0] ?? '账户与字段快照一致。');
    },
    onBeginEditPaymentList: (request, paymentListId) => {
      const list = requestListFor(request, paymentListId);
      if (!requestResourceEditable(request) || !list) return;
      setPaymentLists((current) => current.map((candidate) => candidate.paymentListId === paymentListId
        ? beginPaymentListEdit(candidate)
        : candidate));
      markRequestResourceChanged(request, `已从 ${list.paymentListCode} v${list.version ?? 1} 创建编辑草稿`);
    },
    onGeneratePaymentListVersion: (request, paymentListId) => {
      const list = requestListFor(request, paymentListId);
      if (!requestResourceEditable(request) || !list || list.status !== 'draft') return;
      const result = generatePaymentListVersion({
        list,
        expectedInvoiceIds: paymentRequestInvoiceIds(request.creatorLinks ?? []),
        actor: { account: currentUser.account, name: currentUser.name, role: currentUser.role },
      });
      if (result.issues.length) {
        notify('付款清单生成失败', result.issues[0].message);
        return;
      }
      setPaymentLists((current) => current.map((candidate) => candidate.paymentListId === paymentListId ? result.record : candidate));
      registerRequestResourceMutation(request, 'payment-list', paymentListId, 'update', `已生成 ${list.paymentListCode} v${result.record.version ?? 1}`);
      notify('付款清单版本已生成', `${list.paymentListCode} v${result.record.version ?? 1} 已锁定。`);
    },
    onExportPaymentList: async (request, paymentListId) => {
      const list = requestListFor(request, paymentListId);
      if (!list) return;
      try {
        const blob = await exportAirwallexPaymentListWorkbook({
          paymentList: list,
          creators,
          allowSubmitted: true,
        });
        downloadBlob(blob, paymentListWorkbookFilename(request.requestCode ?? request.id, list));
        notify(
          '付款清单已导出',
          '已使用“我的项目”相同的 Airwallex Excel 模板生成审批文件。',
        );
      } catch (error) {
        const message = error instanceof PaymentListWorkbookError
          ? error.issues[0]
          : error instanceof Error
            ? error.message
            : '生成文件失败。';
        notify('无法导出付款清单', message);
      }
    },
  };

  const createBatch = (submission: MockBatchSubmission) => {
    const selected = payouts.filter((payout) => (
      submission.items.some((item) => item.payoutId === payout.id)
    ));
    const ineligible = selected.filter((payout) => !isPayoutEligibleForBatch(payout));
    if (ineligible.length > 0) {
      notify('无法创建付款批次', '仅 Invoice 审核已通过且处于等待付款的记录可以进入付款批次。');
      return;
    }
    const execution = executeMockBatchSubmission(submission);
    const now = new Date();
    const localPaymentTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    setPayouts((current) => current.map((payout) => selected.some((item) => item.id === payout.id)
      ? { ...payout, status: '付款处理中', issue: undefined }
      : payout));
    setCreatedBatch({
      id: execution.batchCode,
      count: selected.length,
      amount: batchAmountLabel(execution.items),
      provider: execution.provider,
      payer: currentUser.name,
      paidAt: localPaymentTime,
    });
    setActivePage('batches');
    notify(
      '模拟付款批次已提交',
      `${selected.length} 笔 ${execution.provider} 付款已完成 create → add_items → quote → submit 契约模拟。`,
    );
  };

  const authenticate = (account: string, password: string) => {
    const result = authenticateSystemUser(account, password);
    if (!result.user) return result.error ?? '登录失败，请检查账号信息。';
    const nextUser = result.user;
    setCurrentUser(nextUser);
    setActivePage(getDefaultPageForRole(nextUser.roleKey));
    setIsAuthenticated(true);
    return null;
  };

  if (!isAuthenticated) {
    return <AuthPage onAuthenticated={authenticate} />;
  }

  const canReviewInvoiceMedia = hasPermission(currentUser, 'invoice_media_review');
  const canReviewInvoiceFinance = hasPermission(currentUser, 'invoice_finance_review');
  const canExecutePayouts = hasPermission(currentUser, 'payout_execute');
  const canGenerateInvoices = hasPermission(currentUser, 'invoice_manage');
  const canManageCreators = hasPermission(currentUser, 'creator_records_manage');
  const canUploadContracts = hasPermission(currentUser, 'contract_manage');
  const canDeleteContracts = hasPermission(currentUser, 'contract_delete');
  const canManageProjects = hasPermission(currentUser, 'project_manage');
  const manageableCooperationProjects = projects.filter((project) => (
    canManageCooperationProjectFor(currentUser, project)
  ));
  const batchReadyPayouts = payouts
    .filter(isPayoutEligibleForBatch)
    .map((payout) => {
      const invoice = generatedInvoices.find((record) => record.sourcePayoutId === payout.id);
      const paymentItem = invoice
        ? paymentLists.flatMap((list) => list.items).find((item) => item.invoiceId === invoice.invoiceId)
        : undefined;
      return paymentItem ? payoutWithPaymentListSnapshot(payout, paymentItem) : payout;
    })
    .slice(0, 4);

  let pageContent;
  switch (activePage) {
    case 'projects':
      pageContent = (
        <MediaPaymentProjectsPage
          notify={notify}
          currentUser={currentUser}
          cooperationProjects={projects}
          creators={creators}
          contracts={contracts}
          invoices={generatedInvoices}
          paymentLists={paymentLists}
          requests={requestProjects}
          canCreate={canManageProjects && ['media', 'admin', 'owner'].includes(currentUser.roleKey)}
          focusedProjectId={focusedProjectId}
          onFocusCleared={() => setFocusedProjectId(null)}
          onCreated={(request) => setRequestProjects((current) => [request, ...current])}
          onUpdated={(request) => {
            setRequestProjects((current) => current.map((candidate) => (
              candidate.paymentRequestProjectId === request.paymentRequestProjectId ? request : candidate
            )));
            setPaymentLists((current) => current.filter((list) => (
              list.paymentRequestProjectId !== request.paymentRequestProjectId
            )));
          }}
          onGeneratePaymentList={generateMediaRequestPaymentLists}
          onSubmitRequest={submitMediaPaymentRequest}
          resourceActions={requestResourceActions}
        />
      );
      break;
    case 'requests':
      pageContent = (
        <RequestsPage
          notify={notify}
          currentUser={currentUser}
          requests={requestProjects}
          paymentLists={paymentLists}
          creators={creators}
          generatedInvoices={generatedInvoices}
          onExportPaymentList={requestResourceActions.onExportPaymentList}
          onApprovalAction={handleRequestApproval}
          onOpenFinanceReview={openFinanceReview}
          focusedRequestId={focusedRequestId}
          onFocusCleared={() => setFocusedRequestId(null)}
        />
      );
      break;
    case 'contracts':
      pageContent = (
        <ContractsPage
          notify={notify}
          contracts={contracts}
          projects={manageableCooperationProjects}
          creators={creators}
          canUpload={canUploadContracts}
          canDelete={canDeleteContracts}
          canDeleteContract={(contract) => canDeleteContract(currentUser, contract)}
          focusedContractId={focusedContractId}
          onFocusCleared={() => {
            setFocusedContractId(null);
            if (requestResourceReturn?.resource === 'contract') {
              setFocusedProjectId(requestResourceReturn.requestId);
              setRequestResourceReturn(null);
              setActivePage('projects');
            }
          }}
          onUploadContract={uploadContract}
          onCreateContract={() => {
            setContractGenerationEngagementId(null);
            setActivePage('contract-create');
          }}
          onUpdateContract={updateContract}
          onDeleteContracts={deleteContractsFromList}
        />
      );
      break;
    case 'contract-create':
      pageContent = (
        <ContractBuilderPage
          projects={manageableCooperationProjects}
          creators={creators}
          initialEngagementId={contractGenerationEngagementId}
          existingDraft={contracts.find((contract) => (
            contract.engagementId === contractGenerationEngagementId
            && contract.lifecycle === 'GENERATED_DRAFT'
          ))}
          onGenerated={(model, files) => {
            const record = generateContract(model, files);
            notify(
              files.variant === 'FORMAL' ? '正式合同已生成' : '合同草稿已保存',
              `${record.id} 已关联 ${model.projectName} / ${model.creatorName}，等待线下签署文件回传。`,
            );
            return record;
          }}
          onCancel={() => {
            setContractGenerationEngagementId(null);
            if (requestResourceReturn?.resource === 'contract') {
              setFocusedProjectId(requestResourceReturn.requestId);
              setRequestResourceReturn(null);
              setActivePage('projects');
            } else {
              setActivePage('contracts');
            }
          }}
          onOpenContractManagement={(contractId) => {
            setContractGenerationEngagementId(null);
            setFocusedContractId(contractId);
            setActivePage('contracts');
          }}
        />
      );
      break;
    case 'creators':
      pageContent = (
        <CreatorsPage
          notify={notify}
          creators={creators}
          onSaveCreator={saveCreator}
          canEdit={canManageCreators}
          currentUserAccount={currentUser.account}
        />
      );
      break;
    case 'collaborations':
      pageContent = <CollaborationsPage notify={notify} canImport={canManageCreators} />;
      break;
    case 'invoice':
      pageContent = (
        <InvoicePage
          payouts={payouts}
          creators={creators}
          invoiceEntity={invoiceEntity}
          generatedInvoices={generatedInvoices}
          requests={requestProjects}
          tab={invoiceTab}
          onTabChange={setInvoiceTab}
          onCreateInvoice={() => setActivePage('invoice-create')}
          onCreateBatchInvoice={() => setActivePage('invoice-batch-create')}
          canCreateInvoice={canGenerateInvoices}
          canManageInvoice={canGenerateInvoices}
          canReviewMedia={canReviewInvoiceMedia}
          canReviewFinance={canReviewInvoiceFinance}
          canEditProjectResourceInvoice={(payout) => {
            const invoice = generatedInvoices.find((record) => record.sourcePayoutId === payout.id);
            return Boolean(invoice && editableReturnedRequestForInvoice(invoice.invoiceId));
          }}
          focusedInvoiceId={focusedInvoiceId}
          onFocusCleared={() => {
            setFocusedInvoiceId(null);
            if (requestResourceReturn?.resource === 'invoice') {
              setFocusedProjectId(requestResourceReturn.requestId);
              setRequestResourceReturn(null);
              setActivePage('projects');
            }
          }}
          onMarkSigned={markInvoiceSigned}
          onReviewAction={updateInvoiceReview}
          onReplyFeedback={replyInvoiceFeedback}
          onSendSignatureReminder={sendInvoiceSignatureReminder}
          onEditInvoice={openInvoiceEditor}
          onOpenProject={openProjectFromInvoice}
          onOpenRequest={openRequestFromInvoice}
          onOpenPayment={setSelectedPayout}
          canExecutePayout={canExecutePayouts}
          notify={notify}
        />
      );
      break;
    case 'invoice-edit': {
      const editRecord = invoiceEditTarget
        ? generatedInvoices.find((record) => record.invoiceId === invoiceEditTarget.invoiceId)
        : undefined;
      const editPayout = editRecord
        ? payouts.find((payout) => payout.id === editRecord.sourcePayoutId)
        : undefined;
      if (!invoiceEditTarget || !editRecord || !editPayout) {
        pageContent = (
          <section className="content-card">
            <h2>Invoice 修改上下文已失效</h2>
            <p>未找到稳定关联的 Invoice 与付款记录，请返回 Invoice 管理重新打开。</p>
            <button type="button" className="text-link" onClick={() => {
              setInvoiceEditTarget(null);
              setInvoiceEditorDirty(false);
              setActivePage('invoice');
            }}>返回 Invoice 管理</button>
          </section>
        );
        break;
      }
      pageContent = (
        <InvoiceBuilderPage
          creators={creators}
          payouts={payouts}
          projects={projects}
          contracts={contracts}
          invoiceEntity={invoiceEntity}
          generatedInvoices={generatedInvoices}
          editRecord={editRecord}
          editContext={invoiceEditTarget.context}
          onEdited={saveInvoiceEdit}
          onDirtyChange={setInvoiceEditorDirty}
          onCancel={() => {
            setInvoiceEditTarget(null);
            setInvoiceEditorDirty(false);
            if (requestResourceReturn?.resource === 'invoice') {
              setFocusedProjectId(requestResourceReturn.requestId);
              setRequestResourceReturn(null);
              setActivePage('projects');
            } else {
              setFocusedInvoiceId(`generated:${editRecord.id}`);
              setInvoiceTab(getInvoicePageTab(editPayout.invoiceReviewStatus));
              setActivePage('invoice');
            }
          }}
          onOpenInvoiceManagement={() => undefined}
        />
      );
      break;
    }
    case 'invoice-create':
      pageContent = (
        <InvoiceBuilderPage
          creators={creators}
          payouts={payouts}
          projects={manageableCooperationProjects}
          contracts={contracts}
          invoiceEntity={invoiceEntity}
          generatedInvoices={generatedInvoices}
          onGenerated={(record) => {
            addGeneratedInvoice(record);
            setInvoiceCreationEngagementId(null);
          }}
          onCancel={() => {
            setInvoiceCreationEngagementId(null);
            if (requestResourceReturn?.resource === 'invoice') {
              setFocusedProjectId(requestResourceReturn.requestId);
              setRequestResourceReturn(null);
              setActivePage('projects');
            } else {
              setActivePage('invoice');
            }
          }}
          onOpenInvoiceManagement={() => {
            setInvoiceCreationEngagementId(null);
            if (requestResourceReturn?.resource === 'invoice') {
              setFocusedProjectId(requestResourceReturn.requestId);
              setRequestResourceReturn(null);
              setActivePage('projects');
            } else {
              setInvoiceTab('signature');
              setActivePage('invoice');
            }
          }}
          initialEngagementId={invoiceCreationEngagementId}
        />
      );
      break;
    case 'invoice-batch-create':
      pageContent = (
        <InvoiceBatchBuilderPage
          creators={creators}
          payouts={payouts}
          projects={manageableCooperationProjects}
          contracts={contracts}
          invoiceEntity={invoiceEntity}
          generatedInvoices={generatedInvoices}
          onGenerated={addGeneratedInvoices}
          onDirtyChange={setInvoiceBatchDirty}
          onCancel={() => {
            setInvoiceBatchDirty(false);
            setActivePage('invoice');
          }}
          onOpenInvoiceManagement={() => {
            setInvoiceBatchDirty(false);
            setInvoiceTab('signature');
            setActivePage('invoice');
          }}
          onOpenCreatorPaymentInformation={(creatorId) => {
            if (navigate('creators')) setFocusedCreatorId(creatorId);
          }}
        />
      );
      break;
    case 'batches':
      pageContent = <BatchesPage createdBatch={createdBatch} onNewBatch={() => setActivePage('new-batch')} notify={notify} canCreateBatch={canExecutePayouts} />;
      break;
    case 'new-batch':
      pageContent = (
        <BatchWizardPage
          payouts={batchReadyPayouts}
          onCancel={() => setActivePage('batches')}
          onDraft={() => notify('草稿已保存', '付款选择与渠道配置已保存在当前浏览器。')}
          onSubmit={createBatch}
        />
      );
      break;
    case 'transactions':
      pageContent = <TransactionsPage payouts={payouts} onSelectPayout={setSelectedPayout} />;
      break;
    case 'organization':
      pageContent = <OrganizationPage notify={notify} invoiceEntity={invoiceEntity} onInvoiceEntityChange={setInvoiceEntity} />;
      break;
    case 'channels':
      pageContent = <ChannelsPage notify={notify} />;
      break;
    case 'system-settings':
      pageContent = <SystemSettingsPage notify={notify} />;
      break;
    case 'notifications':
      pageContent = <NotificationsPage />;
      break;
    case 'payment-workbench':
      pageContent = (
        <PaymentWorkbenchPage
          payouts={payouts}
          requests={requestProjects}
          generatedInvoices={generatedInvoices}
          onNewBatch={() => setActivePage('new-batch')}
          onSelectPayout={setSelectedPayout}
          onSelectRequest={openFinanceReview}
          canCreateBatch={canExecutePayouts}
        />
      );
      break;
    case 'dashboard':
    default:
      pageContent = (
        <DashboardPage
          requests={requestProjects}
          creators={creators}
          contracts={contracts}
          payouts={payouts}
          generatedInvoices={generatedInvoices}
          onNavigate={navigate}
        />
      );
      break;
  }

  const selectedPayoutContract = selectedPayout
    ? contracts.find((contract) => contract.id === selectedPayout.contract) ?? null
    : null;
  const financeReviewRequest = financeReviewRequestId
    ? requestProjects.find((request) => request.id === financeReviewRequestId) ?? null
    : null;
  const activeFinanceReview = financeReviewRequest
    ? buildRequestFinanceReview(financeReviewRequest, generatedInvoices, paymentLists)
    : null;
  const activeFinanceSessionKey = financeReviewRequest?.approval
    ? financeReviewSessionKey(financeReviewRequest.id, financeReviewRequest.approval.round, currentUser.account)
    : null;

  const closeFinanceReview = (completed = false) => {
    setFinanceReviewRequestId(null);
    if (!completed) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>('.tab-button[aria-selected="true"]')?.focus();
      });
    });
  };

  return (
    <AppShell activePage={activePage} onNavigate={navigate} currentUser={currentUser}>
      {pageContent}
      {financeReviewRequest && activeFinanceReview && activeFinanceSessionKey ? (
        <FinanceReviewWorkspace
          request={financeReviewRequest}
          financeReview={activeFinanceReview}
          generatedInvoices={generatedInvoices}
          paymentLists={paymentLists}
          currentUser={currentUser}
          session={financeReviewSessions[activeFinanceSessionKey]}
          onSessionChange={(session) => {
            const sessionKey = financeReviewSessionKey(
              session.requestId,
              session.approvalRound,
              session.reviewerAccount,
            );
            setFinanceReviewSessions((current) => ({ ...current, [sessionKey]: session }));
          }}
          onApprove={() => handleRequestApproval(financeReviewRequest, 'APPROVE')}
          onReturn={(reason) => handleRequestApproval(financeReviewRequest, 'RETURN', reason)}
          onClose={closeFinanceReview}
        />
      ) : null}
      {selectedPayout ? (
        <PayoutDrawer
          payout={selectedPayout}
          onClose={() => setSelectedPayout(null)}
          onAdvance={advancePayout}
          onPaymentFailed={failPayout}
          onReturn={returnPayout}
          canExecutePayout={canExecutePayouts}
          contract={selectedPayoutContract}
          onViewContract={openContractFromPayout}
          onViewInvoice={openInvoiceFromPayout}
        />
      ) : null}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}
