import { useCallback, useEffect, useState } from 'react';
import { accountDisplayValue } from './accountPresentation';
import { resolveCreatorSocialAccount } from './creatorSearchOptions';
import { AppShell } from './components/AppShell';
import { DraftExitDialog } from './components/DraftExitDialog';
import { FinanceReviewWorkspace } from './components/FinanceReviewWorkspace';
import { PayoutDrawer } from './components/PayoutDrawer';
import { paymentProviderDisplayName } from './components/PaymentProviderBadge';
import { BLOCKED_ACTION_EVENT, Toast } from './components/Common';
import {
  canEditRequestProjectResources,
  type RequestProjectResourceActions,
} from './components/RequestProjectResourceManager';
import {
  completeGeneratedContractUpload,
  contractLinkedToProject,
  createEditingContractDraft,
  createGeneratedContractDraft,
  createUploadedContract,
  INITIAL_CONTRACTS,
  isFrameworkContract,
  isIoContract,
  type ContractGeneratedFiles,
  type ContractGenerationModel,
  type ContractRecord,
  type ContractUploadInput,
} from './contracts';
import {
  getContractTemplatePolicyReadiness,
  getContractTemplateStatus,
} from './contractTemplateFieldPolicies';
import {
  authenticateSystemUser,
  CURRENT_USER,
  INITIAL_INVOICE_BILLING_SETTINGS,
  INITIAL_PAYOUTS,
  PAGE_TITLES,
  resolveSystemUser,
  type SystemUser,
} from './data';
import {
  canAccessPage,
  canDeleteContract,
  canDeleteContractSelection,
  canEditContractTemplate,
  getDefaultPageForRole,
  hasPermission,
} from './permissions';
import {
  executeMockBatchSubmission,
  type MockBatchSubmission,
} from './batchTransfers';
import {
  applyPaymentResultToCurrentBatch,
  createInitialPaymentBatches,
  createPaymentBatchRecord,
  createPaymentExecutionBatchRecord,
  createPaymentProjectPaymentRecord,
  paymentBatchItemAttemptNumber,
  paymentBatchItemOrderCode,
  paymentBatchItemSourceOrderCode,
} from './paymentBatches';
import { BatchWizardPage } from './pages/BatchWizardPage';
import { AuthPage } from './pages/AuthPage';
import { ContractsPage } from './pages/ContractsPage';
import { ContractBuilderPage } from './pages/ContractBuilderPage';
import { DashboardPage } from './pages/DashboardPage';
import { PaymentWorkbenchPage } from './pages/PaymentWorkbenchPage';
import type { WorkbenchTab } from './pages/PaymentWorkbenchPage';
import { PaymentProjectPaymentDetailPage } from './pages/PaymentProjectPaymentDetailPage';
import { InvoiceBuilderPage } from './pages/InvoiceBuilderPage';
import { InvoiceBatchBuilderPage } from './pages/InvoiceBatchBuilderPage';
import { SystemSettingsPage } from './pages/SystemSettingsPage';
import { SystemConfigurationPage } from './pages/SystemConfigurationPage';
import {
  applyInvoiceDocumentEdit,
  applyInvoiceReviewAction,
  getAvailableInvoiceReviewActions,
  getInvoiceEditContext,
  getInvoicePageTab,
  isInvoiceApprovedForPayment,
  isPayoutPaymentInformationValidated,
  isPayoutEligibleForBatch,
  markGeneratedInvoiceSigned,
  paymentFailureRestartStage,
  publishGeneratedInvoiceDraft,
  recordInvoiceSignatureReminder,
  replyToCreatorFeedback,
  type InvoiceReviewAction,
  type InvoicePageTab,
} from './invoice/invoiceReviewWorkflow';
import {
  findInvoiceRequest,
  getInvoiceManagementReturnContext,
  getInvoiceManagementView,
} from './invoice/invoiceManagement';
import { hasInvoiceSignatureEvidence } from './invoice/invoiceSignature';
import {
  buildApprovedExternalInvoice,
  correctExternalInvoiceRecognition,
  createExternalInvoiceCollection,
  publishExternalInvoiceCollection,
  reviewExternalInvoiceField,
  returnExternalInvoice,
  simulateExternalInvoiceUpload,
  submitExternalInvoiceForReview,
  type ExternalInvoiceActor,
  type ExternalInvoiceCollectionInput,
  type ExternalInvoiceFieldKey,
  type ExternalInvoiceMediaReviewDecision,
  type ExternalInvoiceScenario,
} from './invoice/externalInvoiceCollection';
import { createInitialExternalInvoiceCollections } from './invoice/externalInvoiceFixtures';
import {
  defaultInvoiceBillingEntity,
  invoiceEntitySnapshot,
} from './invoice/invoiceBillingEntities';
import {
  updateCreatorProjectCounts,
  upsertGeneratedInvoiceEngagements,
} from './invoice/invoiceEngagements';
import {
  buildRequestFinanceReview,
  financeReviewReturnItems,
  financeReviewSessionCanApprove,
  financeReviewSessionCanReturn,
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
  INITIAL_NOTIFICATIONS,
  INITIAL_PROJECTS,
  MOCK_FEISHU_COOPERATION_PROJECT_SOURCE,
  NotificationsPage,
  OrganizationPage,
  RequestsPage,
  type NotificationNavigationTarget,
  type SystemNotificationItem,
  TransactionsPage,
} from './pages/OperationalPages';
import { MediaPaymentProjectsPage } from './pages/MediaPaymentProjectsPage';
import type {
  CreatorProfile,
  GeneratedInvoiceRecord,
  InvoiceDocumentModel,
  InvoiceContractMatchReview,
  InvoiceEditContext,
  InvoiceBillingSettings,
  NavOptions,
  NavPage,
  PaymentFailureIssueType,
  Payout,
  PayoutAccountVersion,
  RequestProjectStatusFilter,
  ToastState,
} from './types';
import {
  applyPaymentExecutionAccountOverride,
  applyPaymentListPayoutSnapshot,
  applyValidatedPaymentListPayoutSnapshot,
  beginPaymentListEdit,
  canEditProject,
  clearPaymentListItems,
  confirmPaymentExecutionAccountOverride,
  createAuditEvent,
  createPrototypeCode,
  createPrototypeId,
  generatePaymentListVersion,
  invoicePaymentListItem,
  isInvoiceDerivedPaymentListField,
  mockValidatePaymentList,
  nextReviewStatusAfterMutation,
  nowIso,
  paymentListEffectiveAccount,
  paymentListItemValue,
  paymentListForProvider,
  paymentListItemProvider,
  paymentListProviderForItems,
  paymentListProviders,
  payoutWithPaymentListSnapshot,
  revalidatePaymentListItem,
  refreshPaymentListFromInvoices,
  refreshPaymentListItemSnapshot,
  removePaymentListItem,
  upsertPaymentListItem,
  type EngagementId,
  type CreatorId,
  type ContractId,
  type InvoiceId,
  type PaymentListEditableField,
  type PaymentBatchId,
  type PaymentListRecord,
  type PaymentRequestProjectId,
  type ProjectId,
  type RequestApprovalState,
  type RequestApprovalReturnItem,
  type RequestApprovalStatus,
  type WorkflowAuditAction,
  type WorkflowAuditEvent,
} from './businessWorkflow';
import {
  contractCooperationProjectId,
  canCancelPaymentRequest,
  createPaymentRequestListItem,
  isPaymentRequestFullyPaid,
  myProjectStatusFor,
  paymentRequestAmountLabel,
  paymentRequestHasPaymentActivity,
  paymentRequestInvoiceIds,
  paymentRequestExtraDetailIssues,
  paymentRequestPaymentPlanFor,
  paymentRequestPaymentPlanIssues,
  paymentRequestProviderForChannel,
  paymentRequestSubmissionIssues,
  paymentRequestCancellationIssue,
  requestOwningInvoice,
  type PaymentRequestCreatorLink,
} from './paymentRequestProjects';
import { downloadBlob } from './invoice/invoiceUtils';
import { buildInvoiceReviewModel } from './invoice/invoiceReview';
import { normalizeInvoiceResourceNumbers } from './invoice/invoiceNumberMigration';
import {
  createDocumentPayoutSnapshot,
  getPayoutAccountFingerprint,
  getPayoutAccountId,
  getPayoutAccountVersion,
} from './payoutAccounts';
import {
  exportAirwallexPaymentListWorkbook,
  exportPayPalPaymentListWorkbook,
  paymentListWorkbookFilename,
  PaymentListWorkbookError,
} from './paymentListWorkbook';
import type { ProjectSummary } from './pages/ProjectDetailPage';
import type { RequestProjectSummary } from './pages/RequestProjectDetailPage';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from './requestProjectPrototypeResources';
import { applyPaymentBatchPrototypeScenario } from './paymentBatchPrototypeScenario';
import { prototypePaymentResultFor } from './prototypePaymentResults';
import {
  paymentAttemptSnapshotFor,
  withLatestFailedAttemptReturnReason,
  withPaymentAttemptSnapshot,
} from './paymentAttempts';
import { findPaymentListItemForPayout } from './paymentCreatorIdentity';
import {
  beginPaymentFailureAccountRecovery,
  completePaymentFailureRevalidation,
  confirmPaymentFailureAccountChange,
  isPaymentFailureRetryCandidate,
  isPaymentFailureRetryReady,
  markPaymentFailureAccountChanged,
  markPaymentFailureRetrySubmitted,
  paymentFailureRevalidationIssues,
  recordPaymentFailureNotification,
  simulateCreatorAccountUpdated,
} from './paymentFailureRecovery';
import {
  applyRequestApprovalAction,
  canReturnRequestApproval,
  canReviewRequestApproval,
  createRequestApprovalState,
  REQUEST_APPROVAL_STATUS_LABEL,
  requestApprovalAllowsInvoicePayoutOverride,
  requestApprovalHasScopedReturnItems,
  requestApprovalReturnItemForContract,
  requestApprovalReturnItemForInvoice,
  requestApprovalReturnItemForInvoiceEdit,
  requestApprovalReturnItemForPaymentListEdit,
  requestApprovalStage,
  appendRequestApprovalReturnNotification,
  recordRequestApprovalReturnAccountUpdate,
  returnApprovedRequestToMediaReview,
  type RequestApprovalAction,
} from './requestApprovalWorkflow';
import { requestApprovalReminderFor } from './requestApprovalReminders';
import { recordPaymentListReturnNotification } from './paymentNotification';

const RAW_PAYMENT_BATCH_PROTOTYPE_RESOURCES = applyPaymentBatchPrototypeScenario({
  payouts: INITIAL_COMPLETE_REQUEST_RESOURCES.payouts,
  requests: INITIAL_COMPLETE_REQUEST_RESOURCES.requests,
  generatedInvoices: INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
  paymentLists: INITIAL_COMPLETE_REQUEST_RESOURCES.paymentLists,
});

const NORMALIZED_INITIAL_INVOICE_RESOURCES = normalizeInvoiceResourceNumbers({
  invoices: [...INITIAL_COMPLETE_REQUEST_RESOURCES.invoices],
  payouts: [...new Map([
    ...INITIAL_PAYOUTS,
    ...RAW_PAYMENT_BATCH_PROTOTYPE_RESOURCES.payouts,
  ].map((payout) => [payout.id, payout])).values()],
  paymentLists: [...RAW_PAYMENT_BATCH_PROTOTYPE_RESOURCES.paymentLists],
});

const INITIAL_PAYMENT_BATCH_PROTOTYPE_RESOURCES = {
  ...RAW_PAYMENT_BATCH_PROTOTYPE_RESOURCES,
  invoices: NORMALIZED_INITIAL_INVOICE_RESOURCES.invoices,
  payouts: NORMALIZED_INITIAL_INVOICE_RESOURCES.payouts.map((payout) => {
    const creator = INITIAL_CREATORS.find((candidate) => (
      candidate.id === payout.creatorId
      || candidate.socialAccounts.some((account) => account.handle.toLowerCase() === payout.handle.toLowerCase())
    ));
    const socialAccount = resolveCreatorSocialAccount(
      creator,
      payout.creatorSocialAccountId,
      payout.handle,
      payout.creatorPlatform,
    );
    return {
      ...payout,
      creator: creator?.name ?? payout.creator,
      creatorId: payout.creatorId ?? creator?.id as CreatorId | undefined,
      creatorSocialAccountId: payout.creatorSocialAccountId ?? socialAccount?.id,
      creatorPlatform: payout.creatorPlatform ?? socialAccount?.platform ?? creator?.platform,
    };
  }),
  paymentLists: NORMALIZED_INITIAL_INVOICE_RESOURCES.paymentLists,
};

const NEXT_STATUS: Partial<Record<Payout['status'], Payout['status']>> = {
  等待付款: '付款处理中',
  信息异常: '等待付款',
  付款处理中: '已付款',
};

const paymentBatchAttemptIssueMessage = (issue: string | undefined) => {
  if (issue === 'AMBIGUOUS_BATCH') return '同一付款项匹配到多个处理中的批次，已停止状态更新。';
  if (issue === 'ATTEMPT_FINALIZED') return '当前付款批次已结束，不能再次修改历史结果。';
  if (issue === 'INVALID_RESULT') return '只有付款成功或付款失败结果可以写入付款批次。';
  return '未找到该付款项当前正在处理的付款批次。';
};

const returnPaymentFailureApproval = (
  state: RequestApprovalState,
  issueType: PaymentFailureIssueType,
  actor: Pick<SystemUser, 'account' | 'name' | 'role'>,
  reason: string,
  occurredAt: string,
  returnItems?: RequestApprovalReturnItem[],
): RequestApprovalState => {
  if (issueType === 'PAYMENT_LIST' && state.status === 'APPROVED') {
    return {
      ...state,
      history: [
        ...state.history,
        {
          round: state.round,
          stage: 'FINANCE',
          action: 'RETURN',
          actorAccount: actor.account,
          actorName: actor.name,
          actorRole: actor.role,
          fromStatus: state.status,
          toStatus: 'APPROVED',
          reason,
          occurredAt,
        },
      ],
      returnReason: reason,
      updatedAt: occurredAt,
    };
  }
  if (state.status === 'APPROVED') {
    return returnApprovedRequestToMediaReview(state, actor, reason, occurredAt, returnItems);
  }
  if (state.status !== 'RETURNED_TO_MEDIA_REVIEW') {
    throw new Error('当前请款项目不在可退回的付款执行状态。');
  }
  const mergedReturnItems = returnItems?.length
    ? [
        ...(state.returnItems ?? []).filter((existing) => !returnItems.some((item) => (
          item.invoiceId === existing.invoiceId && item.issueType === existing.issueType
        ))),
        ...returnItems,
      ]
    : state.returnItems;
  return {
    ...state,
    history: [
      ...state.history,
      {
        round: state.round,
        stage: 'FINANCE',
        action: 'RETURN',
        actorAccount: actor.account,
        actorName: actor.name,
        actorRole: actor.role,
        fromStatus: state.status,
        toStatus: 'RETURNED_TO_MEDIA_REVIEW',
        reason,
        returnItems: returnItems?.length ? returnItems : undefined,
        occurredAt,
      },
    ],
    returnedFromStage: 'FINANCE',
    resumeStatus: 'PENDING_FINANCE',
    returnReason: reason,
    returnItems: mergedReturnItems,
    updatedAt: occurredAt,
  };
};

const getProjectId = (project: ProjectSummary) => (
  (project.cooperationProjectId ?? project.projectId ?? project.id) as ProjectId
);

const canManageCooperationProjectFor = (user: SystemUser, project: ProjectSummary) => (
  user.roleKey === 'admin'
  || user.roleKey === 'owner'
  || (user.roleKey === 'media' && project.media === (user.scopeName ?? user.name))
);

const LOCAL_DEV_BYPASSES_AUTH = import.meta.env.DEV;
const LOCAL_DEV_USER = LOCAL_DEV_BYPASSES_AUTH
  ? (resolveSystemUser('jeff') ?? CURRENT_USER)
  : CURRENT_USER;

const getContractTemplateAvailability = (contracts: ContractRecord[]) => {
  const template = contracts.find((contract) => (
    contract.isTemplate && contract.id === 'CON-TPL-2026-KOL'
  ));
  const readiness = template
    ? getContractTemplatePolicyReadiness(
      template.templateFieldPolicies,
      template.templateOutputFieldKeys,
    )
    : null;
  const activeTemplate = template
    && getContractTemplateStatus(template) === 'ACTIVE'
    && readiness?.ready
    ? template
    : null;
  const disabledReason = !template
    ? '当前没有可用于生成合同的模板。'
    : getContractTemplateStatus(template) !== 'ACTIVE'
      ? '合同模板已停用，请先在系统配置中启动模板。'
      : !readiness?.ready
        ? '合同模板字段配置存在阻断项，请先在系统配置中修复。'
        : undefined;
  return { template, activeTemplate, disabledReason };
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(LOCAL_DEV_BYPASSES_AUTH);
  const [currentUser, setCurrentUser] = useState<SystemUser>(LOCAL_DEV_USER);
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [requestStatusFilter, setRequestStatusFilter] = useState<RequestProjectStatusFilter>('all');
  const [payouts, setPayouts] = useState<Payout[]>(INITIAL_PAYMENT_BATCH_PROTOTYPE_RESOURCES.payouts);
  const [creators, setCreators] = useState<CreatorProfile[]>(INITIAL_CREATORS);
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [contracts, setContracts] = useState<ContractRecord[]>(() => [
    ...INITIAL_CONTRACTS,
    ...INITIAL_COMPLETE_REQUEST_RESOURCES.contracts,
  ].map((contract) => ({
    ...contract,
    cooperationProjectId: (contract.cooperationProjectId ?? contract.projectId) as ContractRecord['cooperationProjectId'],
  })));
  const [invoiceBillingSettings, setInvoiceBillingSettings] = useState<InvoiceBillingSettings>(
    INITIAL_INVOICE_BILLING_SETTINGS,
  );
  const invoiceEntity = invoiceEntitySnapshot(
    defaultInvoiceBillingEntity(invoiceBillingSettings)
      ?? INITIAL_INVOICE_BILLING_SETTINGS.entities[0],
  );
  const [generatedInvoices, setGeneratedInvoices] = useState<GeneratedInvoiceRecord[]>(() => (
    INITIAL_PAYMENT_BATCH_PROTOTYPE_RESOURCES.invoices.map((invoice) => ({
      ...invoice,
      snapshot: {
        ...invoice.snapshot,
        cooperationProjectId: invoice.snapshot.cooperationProjectId ?? invoice.snapshot.projectId,
      },
    }))
  ));
  const [externalInvoices, setExternalInvoices] = useState(() => createInitialExternalInvoiceCollections({
    projects,
    creators,
    contracts,
    generatedInvoices,
    invoiceEntity,
    actor: {
      account: currentUser.account,
      name: currentUser.name,
      role: currentUser.role,
    },
  }));
  const [paymentLists, setPaymentLists] = useState<PaymentListRecord[]>(
    INITIAL_PAYMENT_BATCH_PROTOTYPE_RESOURCES.paymentLists,
  );
  const [workflowAuditEvents, setWorkflowAuditEvents] = useState<WorkflowAuditEvent[]>([]);
  const [requestProjects, setRequestProjects] = useState(INITIAL_PAYMENT_BATCH_PROTOTYPE_RESOURCES.requests);
  const [paymentBatches, setPaymentBatches] = useState(() => createInitialPaymentBatches({
    payouts,
    requests: requestProjects,
    generatedInvoices,
    paymentLists,
    contracts,
  }));
  const [invoiceTab, setInvoiceTab] = useState<InvoicePageTab>('signature');
  const [focusedInvoiceId, setFocusedInvoiceId] = useState<string | null>(null);
  const [focusedContractId, setFocusedContractId] = useState<string | null>(null);
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [focusedPaymentFailurePayoutId, setFocusedPaymentFailurePayoutId] = useState<string | null>(null);
  const [focusedRequestId, setFocusedRequestId] = useState<string | null>(null);
  const [requestResourceReturn, setRequestResourceReturn] = useState<{
    requestId: string;
    resource: 'contract' | 'invoice';
    source: 'my-project' | 'finance-review';
    recordId?: string;
  } | null>(null);
  const [financeReviewResourceRestore, setFinanceReviewResourceRestore] = useState<{
    requestId: string;
    resource: 'contract' | 'invoice';
    recordId: string;
  } | null>(null);
  const [focusedCreatorId, setFocusedCreatorId] = useState<string | null>(null);
  const [focusedBatchId, setFocusedBatchId] = useState<string | null>(null);
  const [contractGenerationEngagementId, setContractGenerationEngagementId] = useState<EngagementId | null>(null);
  const [editingContractDraftId, setEditingContractDraftId] = useState<string | null>(null);
  const [contractBuilderModel, setContractBuilderModel] = useState<ContractGenerationModel | null>(null);
  const [contractBuilderDirty, setContractBuilderDirty] = useState(false);
  const [contractTemplateDirty, setContractTemplateDirty] = useState(false);
  const [pendingContractExit, setPendingContractExit] = useState<{ run: () => void } | null>(null);
  const [invoiceCreationEngagementId, setInvoiceCreationEngagementId] = useState<EngagementId | null>(null);
  const [invoiceEditTarget, setInvoiceEditTarget] = useState<{
    invoiceId: InvoiceId;
    context: InvoiceEditContext;
  } | null>(null);
  const [invoiceEditorDirty, setInvoiceEditorDirty] = useState(false);
  const [invoiceBatchDirty, setInvoiceBatchDirty] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [paymentDetailRequestId, setPaymentDetailRequestId] = useState<string | null>(null);
  const [paymentWorkbenchInitialTab, setPaymentWorkbenchInitialTab] = useState<WorkbenchTab>('review');
  const [toast, setToast] = useState<ToastState>(null);
  const [notificationItems, setNotificationItems] = useState<SystemNotificationItem[]>(() => (
    INITIAL_NOTIFICATIONS.map((item) => {
      if (item.target.kind !== 'invoice-review') return item;
      const invoiceId = item.target.invoiceId;
      const invoice = NORMALIZED_INITIAL_INVOICE_RESOURCES.invoices.find((candidate) => (
        candidate.invoiceId === invoiceId
      ));
      return invoice ? { ...item, title: `Invoice ${invoice.id} 待审核` } : item;
    })
  ));
  const [showRequestApprovalReminder, setShowRequestApprovalReminder] = useState(true);
  const [requestApprovalReminderUnread, setRequestApprovalReminderUnread] = useState(true);
  const [financeReviewRequestId, setFinanceReviewRequestId] = useState<string | null>(null);
  const [financeReviewSessions, setFinanceReviewSessions] = useState<Record<string, FinanceReviewSession>>({});

  const isContractUsedInRequestProject = (contract: ContractRecord) => {
    const contractIds = new Set(
      [contract.contractId, contract.id].filter((id): id is string => Boolean(id)),
    );
    return requestProjects.some((request) => request.creatorLinks?.some((link) => (
      link.contractIds.some((contractId) => contractIds.has(contractId))
    )));
  };

  const contractDeletionOptions = (contract: ContractRecord) => ({
    usedInRequest: isContractUsedInRequestProject(contract),
  });

  const contractDeletionPolicyMessage = currentUser.roleKey === 'media'
    ? '媒介只能删除本人上传且尚未用于请款项目的合同。'
    : '管理员、项目负责人和老板可以删除任意合同；PM 和财务账号不可删除合同。';

  const notify = useCallback((title: string, message: string) => {
    setToast({ title, message });
  }, []);

  useEffect(() => {
    const explainBlockedAction = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: string }>).detail;
      setToast({
        title: '暂时无法操作',
        message: detail?.reason?.trim() || '请先完成当前页面的必填项与校验。',
        tone: 'warning',
      });
    };
    window.addEventListener(BLOCKED_ACTION_EVENT, explainBlockedAction);
    return () => window.removeEventListener(BLOCKED_ACTION_EVENT, explainBlockedAction);
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

  const uploadContracts = useCallback((inputs: ContractUploadInput[]) => {
    const engagementByKey = new Map<string, EngagementId>();
    const projectUpdates = new Map<string, ProjectSummary>();
    const resolvedInputs = inputs.map((input) => {
      const projectKey = String(input.cooperationProjectId ?? input.projectId);
      const engagementKey = `${projectKey}:${input.creatorId}`;
      const existingProject = projectUpdates.get(projectKey)
        ?? projects.find((project) => getProjectId(project) === input.projectId);
      let engagementId = input.engagementId;
      if (!engagementId) {
        engagementId = engagementByKey.get(engagementKey)
          ?? existingProject?.creatorProfiles?.find((reference) => (
            reference.creatorId === input.creatorId && reference.status !== 'removed'
          ))?.engagementId;
      }
      if (!engagementId) {
        engagementId = createPrototypeId('engagement') as EngagementId;
        const creator = creators.find((candidate) => candidate.id === input.creatorId);
        if (existingProject && creator) {
          const occurredAt = nowIso();
          const activeCreatorCount = existingProject.creatorProfiles?.filter((reference) => reference.status !== 'removed').length;
          const nextProject: ProjectSummary = {
            ...existingProject,
            creators: (activeCreatorCount ?? existingProject.creators) + 1,
            creatorProfiles: [
              ...(existingProject.creatorProfiles ?? []),
              {
                creatorId: input.creatorId,
                engagementId,
                projectId: getProjectId(existingProject),
                status: 'active',
                createdAt: occurredAt,
                updatedAt: occurredAt,
                name: creator.name,
                handle: input.creatorHandle,
                platform: input.creatorPlatform,
                socialAccountId: input.creatorSocialAccountId,
              },
            ],
          };
          projectUpdates.set(projectKey, nextProject);
        }
      }
      engagementByKey.set(engagementKey, engagementId);
      return { ...input, engagementId };
    });

    if (projectUpdates.size) {
      setProjects((current) => current.map((project) => projectUpdates.get(String(getProjectId(project))) ?? project));
    }

    const frameworkIdsByUploadKey = new Map<string, ContractId>();
    const orderedInputs = [...resolvedInputs].sort((left, right) => {
      const leftFramework = left.contractType === 'FRAMEWORK' ? 0 : 1;
      const rightFramework = right.contractType === 'FRAMEWORK' ? 0 : 1;
      return leftFramework - rightFramework;
    });
    const recordsByInput = new Map<ContractUploadInput, ContractRecord>();
    orderedInputs.forEach((input) => {
      const draft = input.draftContractId
        ? contracts.find((contract) => contract.contractId === input.draftContractId)
        : null;
      const resolvedFrameworkId = input.frameworkContractId
        ?? (input.frameworkUploadKey ? frameworkIdsByUploadKey.get(input.frameworkUploadKey) : undefined);
      const resolvedInput = { ...input, frameworkContractId: resolvedFrameworkId };
      const record = draft
        ? completeGeneratedContractUpload(draft, resolvedInput, currentUser.account)
        : createUploadedContract(resolvedInput, currentUser.account);
      if (input.contractType === 'FRAMEWORK' && input.sourceDocuments[0]?.id) {
        frameworkIdsByUploadKey.set(input.sourceDocuments[0].id, record.contractId!);
      }
      recordsByInput.set(input, record);
    });
    const records = resolvedInputs.map((input) => recordsByInput.get(input)!).filter(Boolean);
    setContracts((current) => {
      const replaced = new Map(records.filter((record) => record.uploadedFromDraftId).map((record) => [record.contractId, record]));
      return [
        ...records.filter((record) => !record.uploadedFromDraftId),
        ...current.map((contract) => replaced.get(contract.contractId) ?? contract),
      ];
    });
    resolvedInputs.forEach((input, index) => {
      const record = records[index];
      if (!record) return;
      registerProjectMutation({
        projectId: input.projectId,
        engagementId: input.engagementId,
        entityType: 'contract',
        entityId: record.contractId ?? record.id,
        action: record.uploadedFromDraftId ? 'update' : 'create',
        summary: record.uploadedFromDraftId ? `已回传合同 ${record.id}` : `已上传${input.contractType === 'FRAMEWORK' ? '框架合同' : input.contractType === 'IO' ? 'IO 单' : '独立合同'} ${record.id}`,
      });
    });
    return records;
  }, [contracts, creators, currentUser.account, projects, registerProjectMutation]);

  const bindFrameworkContract = useCallback((ioContractId: ContractId, frameworkContractId?: ContractId) => {
    const ioContract = contracts.find((contract) => (contract.contractId ?? contract.id) === ioContractId);
    if (!ioContract || !isIoContract(ioContract)) {
      notify('无法绑定框架合同', '只有 IO 单可以设置框架合同关系。');
      return false;
    }
    const frameworkContract = frameworkContractId
      ? contracts.find((contract) => (contract.contractId ?? contract.id) === frameworkContractId)
      : undefined;
    if (frameworkContractId && (!frameworkContract || !isFrameworkContract(frameworkContract))) {
      notify('无法绑定框架合同', '请选择有效的框架合同。');
      return false;
    }
    if (frameworkContract && ioContract.creatorId && frameworkContract.creatorId !== ioContract.creatorId) {
      notify('无法绑定框架合同', '框架合同与 IO 单必须属于同一合作达人。');
      return false;
    }
    const nextValue = frameworkContract?.contractId;
    setContracts((current) => current.map((contract) => (
      (contract.contractId ?? contract.id) === ioContractId
        ? { ...contract, frameworkContractId: nextValue }
        : contract
    )));
    registerProjectMutation({
      projectId: (ioContract.cooperationProjectId ?? ioContract.projectId ?? '') as ProjectId,
      engagementId: ioContract.engagementId,
      entityType: 'contract',
      entityId: ioContractId,
      action: 'update',
      summary: nextValue
        ? `已将 IO 单 ${ioContract.id} 绑定框架合同 ${frameworkContract?.id ?? nextValue}`
        : `已解除 IO 单 ${ioContract.id} 的框架合同关系`,
    });
    return true;
  }, [contracts, notify, registerProjectMutation]);

  const saveContractDraft = useCallback((model: ContractGenerationModel) => {
    const existingDraft = contracts.find((contract) => (
      contract.lifecycle === 'EDITING_DRAFT'
      && ((editingContractDraftId && (contract.contractId ?? contract.id) === editingContractDraftId)
        || contract.id === model.contractNumber)
    ));
    const record = createEditingContractDraft(model, existingDraft, currentUser.account);
    setContracts((current) => existingDraft
      ? current.map((contract) => (contract.contractId ?? contract.id) === (existingDraft.contractId ?? existingDraft.id) ? record : contract)
      : [record, ...current]);
    setEditingContractDraftId(record.contractId ?? record.id);
    setContractBuilderDirty(false);
    notify('合同草稿已保存', `${record.name} 已保存到草稿箱，可稍后继续编辑。`);
    return record;
  }, [contracts, currentUser.account, editingContractDraftId, notify]);

  const generateContract = useCallback((model: ContractGenerationModel, files: ContractGeneratedFiles) => {
    const existingDraft = contracts.find((contract) => (
      contract.lifecycle === 'EDITING_DRAFT'
      && ((editingContractDraftId && (contract.contractId ?? contract.id) === editingContractDraftId)
        || contract.id === model.contractNumber)
    ));
    const projectKey = String(model.cooperationProjectId ?? model.projectId);
    const existingProject = projects.find((project) => getProjectId(project) === projectKey);
    const existingReference = existingProject?.creatorProfiles?.find((reference) => (
      reference.creatorId === model.creatorId && reference.status !== 'removed'
    ));
    const resolvedEngagementId = existingReference?.engagementId
      || model.engagementId
      || createPrototypeId('engagement') as EngagementId;
    if (existingProject && !existingReference) {
      const creator = creators.find((candidate) => candidate.id === model.creatorId);
      if (creator) {
        const occurredAt = nowIso();
        const activeCreatorCount = existingProject.creatorProfiles?.filter((reference) => reference.status !== 'removed').length;
        setProjects((current) => current.map((project) => getProjectId(project) === projectKey
          ? {
              ...project,
              creators: (activeCreatorCount ?? project.creators) + 1,
              creatorProfiles: [
                ...(project.creatorProfiles ?? []),
                {
                  creatorId: model.creatorId,
                  engagementId: resolvedEngagementId,
                  projectId: getProjectId(project),
                  status: 'active',
                  createdAt: occurredAt,
                  updatedAt: occurredAt,
                  name: creator.name,
                  handle: model.creatorHandle,
                  platform: model.creatorPlatform ?? model.platform,
                  socialAccountId: model.creatorSocialAccountId,
                },
              ],
            }
          : project));
      }
    }
    const resolvedModel = { ...model, engagementId: resolvedEngagementId };
    const documentUrl = URL.createObjectURL(files.pdfBlob);
    const record = createGeneratedContractDraft(resolvedModel, existingDraft?.generationVersion ?? 1, documentUrl, {
      existingContractId: existingDraft?.contractId,
      generationVariant: files.variant,
      qualityReport: files.qualityReport,
      pageCount: files.pageCount,
      uploadedByAccount: currentUser.account,
    });
    setContracts((current) => existingDraft
      ? current.map((contract) => (contract.contractId ?? contract.id) === (existingDraft.contractId ?? existingDraft.id) ? record : contract)
      : [record, ...current]);
    setEditingContractDraftId(null);
    setContractBuilderDirty(false);
    registerProjectMutation({
      projectId: resolvedModel.projectId,
      engagementId: resolvedEngagementId,
      entityType: 'contract',
      entityId: record.contractId ?? record.id,
      action: existingDraft ? 'update' : 'create',
      summary: `已生成合同${files.variant === 'FORMAL' ? '正式文件' : '草稿'} ${record.id}`,
    });
    return record;
  }, [contracts, creators, currentUser.account, editingContractDraftId, projects, registerProjectMutation]);

  const updateContract = useCallback((updated: ContractRecord) => {
    if (updated.isTemplate && !canEditContractTemplate(currentUser)) {
      notify('暂无模板编辑权限', '仅项目负责人、老板或管理员可以修改合同模板。');
      return;
    }
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

  const finishNavigation = (page: NavPage, options?: NavOptions) => {
    if (page === 'requests') {
      setRequestStatusFilter(options?.requestStatusFilter ?? 'all');
    }
    setActivePage(page);
    setInvoiceEditTarget(null);
    setInvoiceEditorDirty(false);
    setInvoiceBatchDirty(false);
    setFocusedInvoiceId(null);
    setFocusedContractId(null);
    setFocusedProjectId(null);
    setFocusedRequestId(null);
    setFocusedBatchId(null);
    if (page !== 'creators') setFocusedCreatorId(null);
    setSelectedPayout(null);
    setPaymentDetailRequestId(null);
    setPaymentWorkbenchInitialTab('review');
    if (page !== 'contract-create') {
      setEditingContractDraftId(null);
      setContractBuilderModel(null);
      setContractBuilderDirty(false);
    }
    if (page !== 'system-config') setContractTemplateDirty(false);
    return true;
  };

  const navigate = (page: NavPage, options?: NavOptions) => {
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
    if (activePage === 'contract-create' && page !== 'contract-create' && contractBuilderDirty) {
      setPendingContractExit({ run: () => { finishNavigation(page, options); } });
      return false;
    }
    if (
      activePage === 'system-config'
      && page !== 'system-config'
      && contractTemplateDirty
      && !window.confirm('合同模板配置尚未保存，确定切换页面吗？')
    ) {
      return false;
    }
    return finishNavigation(page, options);
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
        creatorSocialAccountId: record.snapshot.creatorSocialAccountId,
        creatorPlatform: record.snapshot.creatorPlatform,
        initials: creator?.initials ?? record.snapshot.creatorName.slice(0, 2).toUpperCase(),
        projectId: String(cooperationProjectId),
        project: project?.name ?? record.snapshot.projectName,
        deliverable: record.snapshot.items.map((item) => item.description).filter(Boolean).join('；'),
        contract: record.snapshot.contractIds?.join('、') || '未关联合同',
        invoice: record.id,
        provider: record.snapshot.paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex',
        currency: record.snapshot.currency,
        amount: record.snapshot.items.reduce((total, item) => total + item.lineTotal, 0),
        account: accountDisplayValue(rawAccount),
        creatorId: record.snapshot.creatorId,
        payoutAccountId: record.snapshot.payoutAccountId ?? record.snapshot.payment.payoutAccountId,
        payoutAccountVersion: record.snapshot.payoutAccountVersion ?? record.snapshot.payment.payoutAccountVersion,
        payoutAccountFingerprint: record.snapshot.payoutAccountFingerprint ?? record.snapshot.payment.accountFingerprint,
        externalBeneficiaryId: record.snapshot.payment.externalBeneficiaryId,
        transferMethod: record.snapshot.payment.transferMethod,
        localClearingSystem: record.snapshot.payment.localClearingSystem,
        feeBearer: feeBearers.length === 1 ? feeBearers[0] : '',
        status: '未进入付款',
        invoiceReviewStatus: record.status,
        invoiceReviewHistory: existing?.invoiceReviewHistory ?? (record.status === '草稿' ? [{
          stage: 'SIGNATURE',
          action: '生成草稿',
          actorAccount: currentUser.account,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          fromStatus: '草稿',
          toStatus: '草稿',
          reason: 'Invoice 文件已生成，尚未发布至达人端。',
          occurredAt: nowIso(),
        }] : undefined),
        invoiceVersion: record.version ?? 1,
        invoiceSignatureRound: 0,
        invoiceSnapshot: record.snapshot,
        accent: creator?.accent ?? '#64748b',
      };
  };

  const addGeneratedInvoices = (records: GeneratedInvoiceRecord[]) => {
    if (!records.length) return;
    const normalized = records.map((record) => ({ ...record, version: record.version ?? 1 }));
    const relationshipCreatedAt = nowIso();
    const applyEngagements = (projectState: ProjectSummary[], creatorState: CreatorProfile[]) => (
      upsertGeneratedInvoiceEngagements({
        projects: projectState,
        creators: creatorState,
        records: normalized,
        existingInvoices: generatedInvoices,
        occurredAt: relationshipCreatedAt,
      })
    );
    setProjects((current) => applyEngagements(current, creators));
    setCreators((current) => updateCreatorProjectCounts(
      current,
      applyEngagements(projects, current),
    ));
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
        ? `${records[0].id} 的 PDF 与 DOCX 已准备完成，当前保存为草稿，尚未通知达人。`
        : `${records.length} 张 Invoice 已保存为草稿，发布后才会通知对应达人。`,
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
    if (!contractLinkedToProject(contract, projectId) || contract.creatorId !== context.reference.creatorId) {
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
    if (contract && !canDeleteContract(currentUser, contract, contractDeletionOptions(contract))) {
      notify('暂无操作权限', contractDeletionPolicyMessage);
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
    if (!canDeleteContractSelection(currentUser, targets, contractDeletionOptions)) {
      notify(
        '暂无操作权限',
        currentUser.roleKey === 'media'
          ? '媒介只能删除本人上传且尚未用于请款项目的合同，请重新选择。'
          : contractDeletionPolicyMessage,
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
    let record = generatedInvoices.find((invoice) => invoice.sourcePayoutId === payout.id);
    if (!record && payout.invoiceReviewStatus === '达人反馈') {
      const creator = creators.find((candidate) => (
        candidate.id === payout.creatorId || candidate.handle === payout.handle
      ));
      const project = projects.find((candidate) => getProjectId(candidate) === payout.projectId);
      const engagement = project?.creatorProfiles?.find((candidate) => candidate.creatorId === creator?.id);
      if (creator && project) {
        const snapshot = payout.invoiceSnapshot ?? buildInvoiceReviewModel(payout, creators, invoiceEntity);
        const legacyProjectId = getProjectId(project);
        const migratedRecord: GeneratedInvoiceRecord = {
          id: snapshot.invoiceNumber,
          invoiceId: `invoice_legacy_${payout.id}` as InvoiceId,
          invoiceType: 'INTERNAL',
          sourcePayoutId: payout.id,
          status: payout.invoiceReviewStatus,
          generatedAt: payout.creatorFeedback?.occurredAt ?? nowIso(),
          snapshot: {
            ...snapshot,
            creatorId: creator.id as CreatorId,
            engagementId: engagement?.engagementId
              ?? `engagement_legacy_${payout.id}` as EngagementId,
            projectId: legacyProjectId,
            cooperationProjectId: legacyProjectId,
          },
          validationStatus: 'valid',
          version: payout.invoiceVersion ?? 1,
        };
        record = migratedRecord;
        setGeneratedInvoices((current) => (
          current.some((invoice) => invoice.sourcePayoutId === payout.id)
            ? current
            : [migratedRecord, ...current]
        ));
      }
    }
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

  const saveInvoiceEdit = (
    snapshot: InvoiceDocumentModel,
    contractMatchReview: InvoiceContractMatchReview,
  ) => {
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
      contractMatchReview,
      context: invoiceEditTarget.context,
      actor: {
        account: currentUser.account,
        name: currentUser.name,
        role: currentUser.role,
      },
    });
    const projectId = result.record.snapshot.projectId as ProjectId;
    setGeneratedInvoices((current) => current.map((invoice) => (
      invoice.invoiceId === result.record.invoiceId ? result.record : invoice
    )));
    setPayouts((current) => current.map((item) => (
      item.id === result.payout.id ? result.payout : item
    )));
    if (invoiceEditTarget.context === 'DRAFT') {
      setWorkflowAuditEvents((current) => [
        createAuditEvent({
          projectId,
          engagementId: result.record.snapshot.engagementId as EngagementId | undefined,
          entityType: 'invoice',
          entityId: result.record.invoiceId,
          action: 'update',
          actor: `${currentUser.name}（${currentUser.role}）`,
          summary: `已更新 Invoice 草稿 ${result.record.id}，仍保持 v${result.record.version ?? 1}`,
        }),
        ...current,
      ]);
      setInvoiceEditTarget(null);
      setInvoiceEditorDirty(false);
      setFocusedInvoiceId(`generated:${result.record.id}`);
      setInvoiceTab('signature');
      setActivePage('invoice');
      notify('Invoice 草稿已保存', `${result.record.id} 仍为 v${result.record.version ?? 1}，尚未发布给达人。`);
      return result.record;
    }
    const refreshedPaymentItem = invoicePaymentListItem(result.record, contracts);
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
    const items = invoices.map((invoice) => invoicePaymentListItem(invoice, contracts));
    const list: PaymentListRecord = {
      paymentListId: createPrototypeId('payment-list') as PaymentListRecord['paymentListId'],
      paymentListCode: createPrototypeCode('PAY'),
      projectId,
      provider: paymentListProviderForItems(items),
      status: 'draft',
      items,
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
    setPaymentLists((current) => current.map((candidate) => {
      if (candidate.paymentListId !== paymentListId) return candidate;
      const items = candidate.items.map((currentItem) => (
        currentItem.invoiceId === invoiceId ? updated : currentItem
      ));
      return {
        ...candidate,
        provider: paymentListProviderForItems(items, candidate.provider),
        status: 'draft',
        updatedAt: nowIso(),
        items,
      };
    }));
    registerProjectMutation({
      projectId,
      engagementId: item.engagementId,
      entityType: 'payment-list',
      entityId: invoiceId,
      action: 'update',
      summary: `已为 ${item.snapshot.invoiceNumber} 选择 ${paymentProviderDisplayName(account.provider)} 收款账户，Invoice 原始快照保持不变`,
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
      notify('付款单已锁定', '提交请款后的付款单只有在审批退回或付款账户问题退回后才能修改。');
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

  const exportPaymentListFiles = async ({
    projectCode,
    list,
    allowSubmitted = false,
  }: {
    projectCode: string;
    list: PaymentListRecord;
    allowSubmitted?: boolean;
  }) => {
    const providers = paymentListProviders(list);
    if (!providers.length) {
      throw new PaymentListWorkbookError(['付款单没有可导出的渠道付款明细']);
    }
    if (providers.includes('PayMax')) {
      throw new PaymentListWorkbookError(['Payer Max 付款模板尚未配置，暂不能导出该渠道明细']);
    }
    const files = await Promise.all(providers.map(async (provider) => {
      const providerList = paymentListForProvider(list, provider);
      const blob = provider === 'PayPal'
        ? await exportPayPalPaymentListWorkbook({ paymentList: providerList, allowSubmitted })
        : await exportAirwallexPaymentListWorkbook({
            paymentList: providerList,
            creators,
            allowSubmitted,
          });
      return { provider, blob };
    }));
    files.forEach(({ provider, blob }) => downloadBlob(
      blob,
      paymentListWorkbookFilename(projectCode, list, files.length > 1 ? provider : undefined),
    ));
    return providers;
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
      const providers = await exportPaymentListFiles({
        projectCode: project.projectCode ?? project.id,
        list,
      });
      notify(
        ['approved', 'paid'].includes(list.status) ? '付款清单已导出' : '付款清单预览已导出',
        providers.length > 1
          ? `已按 ${providers.length} 个付款渠道导出执行文件，文件共用付款单号 ${list.paymentListCode}。`
          : 'Excel 由浏览器本地生成，包含付款资料，请按敏感文件管理。',
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

  const generateMediaRequestPaymentLists = (request: RequestProjectSummary) => {
    if (!request.paymentRequestProjectId || !request.cooperationProjectId || !request.creatorLinks?.length) {
      notify('无法生成付款清单', '请款项目缺少稳定项目 ID 或达人 Invoice 关联。');
      return;
    }
    try {
      const createdAt = nowIso();
      const refreshedItems = request.creatorLinks.flatMap((link) => link.invoiceIds).map((invoiceId) => {
        const invoice = generatedInvoices.find((candidate) => candidate.invoiceId === invoiceId);
        if (!invoice) throw new Error(`未找到 Invoice ${invoiceId}`);
        return createPaymentRequestListItem({
          invoice,
          contracts,
        });
      });
      const requestPaymentProvider = paymentRequestProviderForChannel(request.paymentChannel);
      if (!requestPaymentProvider) {
        throw new Error('请先为请款项目选择唯一付款渠道');
      }
      const existingList = paymentLists.find((list) => (
        list.paymentRequestProjectId === request.paymentRequestProjectId
      ));
      const actor = { account: currentUser.account, name: currentUser.name, role: currentUser.role };
      const baseList: PaymentListRecord = existingList ?? {
        paymentListId: createPrototypeId('payment-list') as PaymentListRecord['paymentListId'],
        paymentListCode: createPrototypeCode('PAY'),
        projectId: request.cooperationProjectId as ProjectId,
        paymentRequestProjectId: request.paymentRequestProjectId,
        provider: requestPaymentProvider,
        status: 'draft',
        items: [],
        createdAt,
        updatedAt: createdAt,
      };
      const list = refreshPaymentListFromInvoices({
        list: baseList,
        refreshedItems,
        actor,
        refreshedAt: createdAt,
      });
      const mismatchedEntry = list.items.find((entry) => (
        paymentListItemProvider(entry) !== requestPaymentProvider
      ));
      if (mismatchedEntry) {
        throw new Error(
          `${mismatchedEntry.snapshot.invoiceNumber} 的收款账户渠道与请款项目付款渠道 ${paymentProviderDisplayName(request.paymentChannel)} 不一致`,
        );
      }
      setPaymentLists((current) => [
        list,
        ...current.filter((list) => list.paymentRequestProjectId !== request.paymentRequestProjectId),
      ]);
      setRequestProjects((current) => current.map((candidate) => candidate.id === request.id
        ? {
            ...candidate,
            paymentListId: list.paymentListId,
            paymentListIds: [list.paymentListId],
            paymentOrder: list.paymentListCode,
            generatedDetail: candidate.generatedDetail
              ? {
                  ...candidate.generatedDetail,
                  paymentListId: list.paymentListCode,
                  paymentListStatus: '草稿待校验',
                }
              : candidate.generatedDetail,
          }
        : candidate));
      notify('付款草稿已同步', `${list.paymentListCode} 已自动同步 ${list.items.length} 份 Invoice 付款明细。`);
    } catch (error) {
      notify('无法生成付款清单', error instanceof Error ? error.message : 'Invoice 账户快照校验失败。');
    }
  };

  const submitMediaPaymentRequest = (request: RequestProjectSummary) => {
    const creatorLinks = request.creatorLinks ?? [];
    const issues = [
      ...paymentRequestPaymentPlanIssues(paymentRequestPaymentPlanFor(request)),
      ...paymentRequestExtraDetailIssues(request),
      ...paymentRequestSubmissionIssues({
        creatorLinks,
        invoices: generatedInvoices,
        paymentLists,
        paymentRequestProjectId: request.paymentRequestProjectId,
        paymentChannel: request.paymentChannel,
      }),
    ];
    if (!request.cooperationProjectId || !request.paymentRequestProjectId || !request.pm || !request.generatedDetail?.reason) {
      issues.unshift('项目必填资料不完整，请检查关联项目、PM 和付款事由');
    }
    const invoiceIds = paymentRequestInvoiceIds(creatorLinks);
    const duplicateInvoiceId = invoiceIds.find((invoiceId) => (
      requestOwningInvoice(requestProjects, invoiceId, request.paymentRequestProjectId)
    ));
    if (duplicateInvoiceId) issues.push(`Invoice ${duplicateInvoiceId} 已关联其他请款项目`);
    if (issues.length) {
      notify('暂不能提交申请', issues[0]);
      return;
    }

    const requestLists = paymentLists.filter((list) => (
      list.paymentRequestProjectId === request.paymentRequestProjectId
    ));
    const requestList = requestLists[0];
    const listedInvoiceIds = new Set(requestList?.items.map((item) => item.invoiceId) ?? []);
    if (requestLists.length !== 1 || invoiceIds.some((invoiceId) => !listedInvoiceIds.has(invoiceId))) {
      notify('暂不能提交申请', '请先在项目详情生成当前请款项目专属的付款清单。');
      return;
    }

    const submittedAt = nowIso();
    const approval = createRequestApprovalState(submittedAt, request.approval);
    const paymentListId = requestList.paymentListId;
    const paymentListCode = requestList.paymentListCode;
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
          provider: paymentRequestProviderForChannel(request.paymentChannel) ?? payout.provider,
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
            paymentListId,
            paymentListIds: [paymentListId],
            paymentOrder: paymentListCode,
            generatedDetail: candidate.generatedDetail
              ? {
                  ...candidate.generatedDetail,
                  invoiceStatus: '已提交审批',
                  paymentListId: paymentListCode,
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

  const cancelMediaPaymentRequest = (request: RequestProjectSummary, reason: string) => {
    const hasPaymentActivity = paymentRequestHasPaymentActivity(request.paymentRequestProjectId, payouts);
    const cancellationContext = {
      roleKey: currentUser.roleKey,
      lifecycle: request.lifecycle,
      ownsRequest: request.media === (currentUser.scopeName ?? currentUser.name),
      hasPaymentActivity,
    };
    const issue = paymentRequestCancellationIssue(cancellationContext, reason);
    if (!canCancelPaymentRequest(cancellationContext) || issue) {
      notify('无法取消请款', issue);
      return false;
    }
    const cancelledAt = nowIso();
    setRequestProjects((current) => current.map((candidate) => (
      candidate.paymentRequestProjectId === request.paymentRequestProjectId
        ? {
            ...candidate,
            lifecycle: 'CANCELLED',
            status: '已取消',
            filter: 'processed',
            cancelledAt,
            cancelledBy: currentUser.name,
            cancelReason: reason.trim(),
          }
        : candidate
    )));
    setWorkflowAuditEvents((current) => [
      createAuditEvent({
        projectId: request.cooperationProjectId as ProjectId,
        paymentRequestProjectId: request.paymentRequestProjectId,
        entityType: 'request-project',
        entityId: request.paymentRequestProjectId ?? request.id,
        action: 'cancel',
        actor: `${currentUser.name}（${currentUser.role}）`,
        summary: `已取消请款项目 ${request.requestCode ?? request.id}：${reason.trim()}`,
      }),
      ...current,
    ]);
    notify('请款已取消', `${request.requestCode ?? request.id} 已保留为只读历史，关联 Invoice 已释放。`);
    return true;
  };

  const handleRequestApproval = (
    request: RequestProjectSummary,
    action: RequestApprovalAction,
    reason?: string,
  ) => {
    const isPaymentExecutionReturn = Boolean(
      action === 'RETURN'
      && request.lifecycle === 'APPROVED'
      && request.approval?.status === 'APPROVED',
    );
    const canApprove = Boolean(
      request.approval
      && canReviewRequestApproval(currentUser, request.approval, request.pm),
    );
    const canReturn = Boolean(
      request.approval
      && (
        isPaymentExecutionReturn
          ? hasPermission(currentUser, 'payout_execute')
          : canReturnRequestApproval(currentUser, request.approval, request.pm)
      ),
    );
    if (!request.approval || (action === 'APPROVE' ? !canApprove : !canReturn)) {
      notify('暂无审批权限', '当前账号不是该请款当前节点的审批人，不能越级处理。');
      return false;
    }
    const currentStage = isPaymentExecutionReturn
      ? 'FINANCE' as const
      : requestApprovalStage(request.approval.status);
    if (!currentStage) {
      notify('当前状态不可审批', '该请款已结束当前审批轮次。');
      return false;
    }
    let structuredReturnItems: ReturnType<typeof financeReviewReturnItems> | undefined;
    if (action === 'APPROVE' && currentStage === 'FINANCE') {
      const financeReview = buildRequestFinanceReview(request, generatedInvoices, paymentLists, contracts);
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
    if (action === 'RETURN' && currentStage === 'FINANCE' && request.approval.status === 'PENDING_FINANCE') {
      const financeReview = buildRequestFinanceReview(request, generatedInvoices, paymentLists, contracts);
      const session = financeReviewSessions[financeReviewSessionKey(
        request.id,
        request.approval.round,
        currentUser.account,
      )];
      if (!financeReviewSessionCanReturn(session, financeReview)) {
        const unreviewedCount = financeReview.pages.filter((page) => (
          session?.decisions[page.key]?.state === 'unreviewed'
          || !session?.decisions[page.key]
        )).length;
        notify(
          '请先完成全部核对',
          unreviewedCount > 0
            ? `还有 ${unreviewedCount} 份 Invoice 与付款清单待核对；全部完成后再统一退回媒介。`
            : '请至少记录一份有误项及具体原因后再退回媒介。',
        );
        return false;
      }
      structuredReturnItems = session
        ? financeReviewReturnItems(session, financeReview)
        : undefined;
    }
    try {
      const occurredAt = nowIso();
      const actor = { account: currentUser.account, name: currentUser.name, role: currentUser.role };
      const nextApproval = isPaymentExecutionReturn
        ? returnApprovedRequestToMediaReview(request.approval, actor, reason ?? '', occurredAt)
        : applyRequestApprovalAction(
            request.approval,
            action,
            actor,
            reason,
            occurredAt,
            structuredReturnItems,
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
      const returnedFromPaymentExecution = isReturned && isPaymentExecutionReturn;
      const normalizedReturnReason = reason?.trim();
      setPayouts((current) => current.map((payout) => {
        if (!sourcePayoutIds.has(payout.id)) return payout;
        return {
          ...payout,
          status: isApproved ? '等待付款' : returnedFromPaymentExecution ? '已退回' : payout.status,
          invoiceReviewHistory: returnedFromPaymentExecution
              ? [
                  ...(payout.invoiceReviewHistory ?? []),
                  {
                    stage: 'FINANCE',
                    action: '退回媒介',
                    actorAccount: currentUser.account,
                    actorName: currentUser.name,
                    actorRole: currentUser.role,
                    fromStatus: payout.invoiceReviewStatus,
                    toStatus: payout.invoiceReviewStatus,
                    reason: normalizedReturnReason,
                    occurredAt,
                    approvalRound: nextApproval.round,
                  },
              ]
            : payout.invoiceReviewHistory,
          returnReason: returnedFromPaymentExecution ? normalizedReturnReason : payout.returnReason,
          issue: returnedFromPaymentExecution
            ? `付款执行前退回：${normalizedReturnReason}`
            : payout.issue,
        };
      }));
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
          ? isPaymentExecutionReturn
            ? `第 ${nextApproval.round} 轮请款在执行付款前退回媒介修改`
            : `第 ${nextApproval.round} 轮审批在${REQUEST_APPROVAL_STATUS_LABEL[request.approval.status]}退回媒介修改`
          : `${REQUEST_APPROVAL_STATUS_LABEL[request.approval.status]}已通过`,
      );
      notify(
        isReturned ? '已退回媒介修改' : isApproved ? '财务审批已通过' : '审批已通过',
        isReturned
          ? isPaymentExecutionReturn
            ? '请款项目已从付款执行页退回；媒介修改并重新提交后，将回到待财务审批节点。'
            : `请款项目已退回，修改后将回到“${REQUEST_APPROVAL_STATUS_LABEL[request.approval.status]}”；Invoice 可按反馈选择是否修改。`
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

  const returnPaymentRequestToMedia = (requestId: string, reason: string) => {
    const request = requestProjects.find((candidate) => candidate.id === requestId);
    if (!request) {
      notify('无法退回媒介', '未找到当前请款项目，请刷新付款工作台后重试。');
      return false;
    }
    const invoiceIds = new Set([
      ...(request.invoiceIds ?? []),
      ...(request.creatorLinks ?? []).flatMap((link) => link.invoiceIds),
    ]);
    const sourcePayoutIds = new Set(generatedInvoices
      .filter((invoice) => invoiceIds.has(invoice.invoiceId))
      .map((invoice) => invoice.sourcePayoutId));
    const linkedPayouts = payouts.filter((payout) => (
      (Boolean(request.paymentRequestProjectId)
        && payout.paymentRequestProjectId === request.paymentRequestProjectId)
      || sourcePayoutIds.has(payout.id)
    ));
    if (!linkedPayouts.length || linkedPayouts.some((payout) => payout.status !== '等待付款')) {
      notify('当前无法退回媒介', '仅全部明细均未开始付款的请款项目可以退回媒介修改。');
      return false;
    }
    return handleRequestApproval(request, 'RETURN', reason);
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
    const review = buildRequestFinanceReview(request, generatedInvoices, paymentLists, contracts);
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
    setFinanceReviewResourceRestore(null);
    setFinanceReviewRequestId(request.id);
  };

  const advancePayout = (payout: Payout) => {
    if (!isInvoiceApprovedForPayment(payout)) {
      notify('Invoice 尚未通过', '完成媒介与财务审核后才能推进付款。');
      return;
    }
    if (payout.status === '等待付款') {
      const projectPayouts = payout.paymentRequestProjectId
        ? payouts.filter((candidate) => candidate.paymentRequestProjectId === payout.paymentRequestProjectId)
        : [];
      if (!projectPayouts.length) {
        notify('无法执行打款', '该付款项未稳定关联请款项目，不能绕过付款批次直接执行。');
        return;
      }
      executePaymentRequest(projectPayouts);
      return;
    }
    const nextStatus = NEXT_STATUS[payout.status];
    if (!nextStatus) return;
    const resultAt = nowIso();
    const retrySucceeded = nextStatus === '已付款'
      && payout.paymentFailureRecovery?.status === 'RETRY_SUBMITTED';
    const paymentResult = nextStatus === '已付款' ? prototypePaymentResultFor(payout) : undefined;
    const baseUpdated: Payout = {
      ...payout,
      status: nextStatus,
      issue: payout.status === '信息异常' ? undefined : payout.issue,
      paidAt: nextStatus === '已付款' ? resultAt : payout.paidAt,
      ...(paymentResult ?? {}),
      ...(retrySucceeded ? {
        issue: undefined,
        returnReason: undefined,
        paymentFailure: undefined,
        paymentFailureReturn: undefined,
        paymentFailureRecovery: payout.paymentFailureRecovery ? {
          ...payout.paymentFailureRecovery,
          status: 'RETRY_SUCCEEDED' as const,
          retrySucceededAt: resultAt,
        } : undefined,
      } : {}),
    };
    const updated = nextStatus === '已付款' && paymentResult
      ? withPaymentAttemptSnapshot(baseUpdated, paymentAttemptSnapshotFor({
          payout: baseUpdated,
          status: '已付款',
          occurredAt: resultAt,
          transferFeeAmount: paymentResult.transferFeeAmount,
          transferFeeCurrency: paymentResult.transferFeeCurrency,
          actualPaidAmount: paymentResult.actualPaidAmount,
          actualPaidCurrency: paymentResult.actualPaidCurrency,
          recipientReceivedAmount: paymentResult.recipientReceivedAmount,
          recipientReceivedCurrency: paymentResult.recipientReceivedCurrency,
        }))
      : baseUpdated;
    if (nextStatus === '已付款') {
      const batchUpdate = applyPaymentResultToCurrentBatch({ batches: paymentBatches, payout: updated });
      if (!batchUpdate.updatedBatchId) {
        notify('无法更新付款结果', paymentBatchAttemptIssueMessage(batchUpdate.issue));
        return;
      }
      setPaymentBatches([...batchUpdate.batches]);
    }
    const nextPayouts = payouts.map((item) => item.id === payout.id ? updated : item);
    const completedRequests = nextStatus === '已付款'
      ? requestProjects.filter((request) => {
          const hasSubmittedRetry = nextPayouts.some((candidate) => (
            candidate.paymentRequestProjectId === request.paymentRequestProjectId
            && ['RETRY_SUBMITTED', 'RETRY_SUCCEEDED'].includes(candidate.paymentFailureRecovery?.status ?? '')
          ));
          return (
            request.lifecycle === 'APPROVED'
            || (request.lifecycle === 'RETURNED' && hasSubmittedRetry)
          ) && isPaymentRequestFullyPaid({ request, invoices: generatedInvoices, payouts: nextPayouts });
        })
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
          ? {
              ...request,
              lifecycle: 'COMPLETED',
              status: '已付款',
              filter: 'processed',
              approval: request.approval?.status === 'RETURNED_TO_MEDIA_REVIEW'
                ? {
                    ...request.approval,
                    status: 'APPROVED',
                    returnedFromStage: undefined,
                    resumeStatus: undefined,
                    returnReason: undefined,
                    updatedAt: completedAt,
                  }
                : request.approval,
            }
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

  const executePaymentRequest = (projectPayouts: Payout[]) => {
    if (!hasPermission(currentUser, 'payout_execute')) {
      notify('暂无付款权限', '当前账号不能执行项目付款。');
      return false;
    }
    const waitingPayouts = projectPayouts.filter((payout) => payout.status === '等待付款');
    if (!waitingPayouts.length) {
      notify('当前无需执行打款', '该请款项目没有待打款明细。');
      return false;
    }
    if (waitingPayouts.length !== projectPayouts.length) {
      notify('无法执行部分打款', '请款项目的全部付款明细必须同时处于“等待付款”。');
      return false;
    }
    const invalidPayout = projectPayouts.find((payout) => !isPayoutPaymentInformationValidated(payout));
    if (invalidPayout) {
      notify('付款信息校验未通过', `${invalidPayout.invoice} 的 Invoice 或付款清单仍需复核。`);
      return false;
    }
    const submittedAt = nowIso();
    let batchRecord: ReturnType<typeof createPaymentExecutionBatchRecord>;
    try {
      batchRecord = createPaymentExecutionBatchRecord({
        payouts: projectPayouts,
        requests: requestProjects,
        generatedInvoices,
        paymentLists,
        contracts,
        existingBatches: paymentBatches,
        paymentBatchId: createPrototypeId('batch') as PaymentBatchId,
        paymentBatchCode: createPrototypeCode('BAT'),
        payer: currentUser.name,
        submittedAt,
      });
    } catch (error) {
      notify(
        '无法执行打款',
        error instanceof Error ? error.message : '请款项目无法生成唯一付款批次。',
      );
      return false;
    }

    const waitingPayoutIds = new Set(projectPayouts.map((payout) => payout.id));
    setPayouts((current) => current.map((payout) => (
      waitingPayoutIds.has(payout.id)
        ? (() => {
            const batchItem = batchRecord.items.find((item) => item.payoutId === payout.id)!;
            return {
              ...payout,
              status: '付款处理中' as const,
              currentPaymentAttempt: {
                paymentBatchId: batchRecord.paymentBatchId,
                paymentBatchCode: batchRecord.paymentBatchCode,
                submittedAt,
                paymentOrderCode: paymentBatchItemOrderCode(batchItem),
                sourcePaymentOrderCode: paymentBatchItemSourceOrderCode(batchItem),
                attemptNumber: paymentBatchItemAttemptNumber(batchItem),
              },
            };
          })()
        : payout
    )));
    setSelectedPayout((current) => {
      if (!current || !waitingPayoutIds.has(current.id)) return current;
      const batchItem = batchRecord.items.find((item) => item.payoutId === current.id)!;
      return {
        ...current,
        status: '付款处理中',
        currentPaymentAttempt: {
          paymentBatchId: batchRecord.paymentBatchId,
          paymentBatchCode: batchRecord.paymentBatchCode,
          submittedAt,
          paymentOrderCode: paymentBatchItemOrderCode(batchItem),
          sourcePaymentOrderCode: paymentBatchItemSourceOrderCode(batchItem),
          attemptNumber: paymentBatchItemAttemptNumber(batchItem),
        },
      };
    });
    setPaymentBatches((current) => [batchRecord, ...current]);
    notify(
      '项目付款已提交渠道',
      `${batchRecord.request.requestCode} 的 ${projectPayouts.length} 笔付款已进入“付款处理中”，批次号 ${batchRecord.paymentBatchCode}。`,
    );
    return true;
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
    const failedPaymentResult = prototypePaymentResultFor(payout);
    const baseUpdated: Payout = {
      ...payout,
      status: '付款失败',
      paidAt: undefined,
      transferFeeAmount: undefined,
      transferFeeCurrency: undefined,
      actualPaidAmount: undefined,
      actualPaidCurrency: undefined,
      recipientReceivedAmount: undefined,
      recipientReceivedCurrency: undefined,
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
    const updated = withPaymentAttemptSnapshot(baseUpdated, paymentAttemptSnapshotFor({
      payout: baseUpdated,
      status: '付款失败',
      occurredAt,
      transferFeeAmount: failedPaymentResult.transferFeeAmount,
      transferFeeCurrency: failedPaymentResult.transferFeeCurrency,
      actualPaidAmount: failedPaymentResult.transferFeeAmount,
      actualPaidCurrency: failedPaymentResult.transferFeeCurrency,
      recipientReceivedAmount: 0,
      recipientReceivedCurrency: payout.currency,
      errorCode: baseUpdated.paymentFailure?.errorCode,
      providerResponse: baseUpdated.paymentFailure?.providerResponse,
    }));
    const batchUpdate = applyPaymentResultToCurrentBatch({ batches: paymentBatches, payout: updated });
    if (!batchUpdate.updatedBatchId) {
      notify('无法记录付款失败', paymentBatchAttemptIssueMessage(batchUpdate.issue));
      return;
    }
    setPaymentBatches([...batchUpdate.batches]);
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
      return false;
    }
    if (
      payout.status !== '付款失败'
      || !payout.paymentFailure
      || !hasPermission(currentUser, 'payout_execute')
    ) {
      notify('无法退回媒介', '只有财务、管理员或老板可以处理当前付款失败记录。');
      return false;
    }
    const occurredAt = nowIso();
    const returnedPayout = withLatestFailedAttemptReturnReason({
      ...payout,
      status: '已退回',
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
          toStatus: issueType === 'INVOICE_CONTENT'
            ? '已退回'
            : payout.invoiceReviewStatus,
          reason: normalizedReason,
          occurredAt,
        },
      ],
      returnReason: normalizedReason,
      issue: `付款失败已退回：${normalizedReason}`,
    }, normalizedReason);
    const linkedRequest = requestProjects.find((request) => (
      (Boolean(payout.paymentRequestProjectId)
        && request.paymentRequestProjectId === payout.paymentRequestProjectId)
      || request.projectId === payout.projectId
      || request.cooperationProjectId === payout.projectId
    ));
    const linkedInvoice = generatedInvoices.find((invoice) => invoice.sourcePayoutId === payout.id);
    if (issueType === 'INVOICE_CONTENT' && !linkedInvoice) {
      notify('无法退回 Invoice', '未找到该失败款通过稳定 invoiceId 关联的 Invoice 记录。');
      return false;
    }
    const scopedReturnItems: RequestApprovalReturnItem[] | undefined = linkedInvoice
      && issueType === 'INVOICE_CONTENT'
      ? [{
          pageKey: `invoice:${linkedInvoice.invoiceId}`,
          invoiceId: linkedInvoice.invoiceId,
          invoiceNumber: linkedInvoice.snapshot.invoiceNumber,
          issueType: 'INVOICE_CONTENT',
          reason: normalizedReason,
          paymentItems: paymentLists.flatMap((list) => (
            (
              payout.paymentRequestProjectId
                ? list.paymentRequestProjectId === payout.paymentRequestProjectId
                : list.projectId === payout.projectId
            )
              ? list.items
              .filter((item) => item.invoiceId === linkedInvoice.invoiceId)
              .map((item) => ({ paymentListId: list.paymentListId, itemId: item.id }))
              : []
          )),
        }]
      : undefined;
    let returnedApproval: RequestApprovalState | undefined;
    if (linkedRequest?.approval) {
      try {
        returnedApproval = returnPaymentFailureApproval(
          linkedRequest.approval,
          issueType,
          { account: currentUser.account, name: currentUser.name, role: currentUser.role },
          normalizedReason,
          occurredAt,
          scopedReturnItems,
        );
      } catch (error) {
        notify('无法退回媒介', error instanceof Error ? error.message : '请款项目审批状态不允许退回。');
        return false;
      }
    }
    if (issueType === 'PAYMENT_LIST') {
      const updated = beginPaymentFailureAccountRecovery(returnedPayout);
      setPayouts((current) => current.map((item) => item.id === payout.id ? updated : item));
      if (linkedInvoice) {
        setPaymentLists((current) => current.map((list) => (
          list.paymentRequestProjectId !== payout.paymentRequestProjectId
          || !list.items.some((item) => item.invoiceId === linkedInvoice.invoiceId)
            ? list
            : (() => {
                const editableList = list.status === 'draft' ? list : beginPaymentListEdit(list, occurredAt);
                return {
                  ...editableList,
                  items: editableList.items.map((item) => item.invoiceId === linkedInvoice.invoiceId
                    ? {
                        ...item,
                        requiresRevalidation: false,
                        validationIssues: [],
                      }
                    : item),
                updatedAt: occurredAt,
                };
              })()
        )));
      }
      setRequestProjects((current) => current.map((request) => {
        const matchesRequest = (Boolean(payout.paymentRequestProjectId)
          && request.paymentRequestProjectId === payout.paymentRequestProjectId)
          || request.id === linkedRequest?.id;
        if (!matchesRequest) return request;
        return {
          ...request,
          lifecycle: 'RETURNED',
          status: '部分打款失败',
          filter: 'pending',
          approval: returnedApproval ?? request.approval,
          generatedDetail: request.generatedDetail ? {
            ...request.generatedDetail,
            paymentListStatus: '部分打款失败',
          } : request.generatedDetail,
        };
      }));
      setSelectedPayout((current) => current?.id === payout.id ? updated : current);
      notify('已退回媒介', '项目已标记为“部分打款失败”；成功款保持已付款，仅该失败款进入恢复流程。');
      return true;
    }

    const updated: Payout = {
      ...returnedPayout,
      invoiceReviewStatus: '已退回',
    };
    setPayouts((current) => current.map((item) => item.id === payout.id ? updated : item));
    setGeneratedInvoices((current) => current.map((invoice) => invoice.sourcePayoutId === payout.id
      ? { ...invoice, status: '已退回' }
      : invoice));
    const returnStatus = 'Invoice 待修改';
    setRequestProjects((current) => current.map((request) => {
      const matchesRequest = (Boolean(payout.paymentRequestProjectId)
        && request.paymentRequestProjectId === payout.paymentRequestProjectId)
        || request.id === linkedRequest?.id;
      if (!matchesRequest) return request;
      return {
        ...request,
        lifecycle: 'RETURNED',
        status: returnStatus,
        filter: 'pending',
        approval: returnedApproval ?? request.approval,
      };
    }));
    setSelectedPayout((current) => current?.id === payout.id ? updated : current);
    notify(
      '已退回媒介',
      '请在 Invoice 详情进入修改页，生成新版后从达人签署开始。',
    );
    return true;
  };

  const sendPaymentFailureNotification = (payoutId: string, message: string) => {
    if (!['media', 'admin', 'owner'].includes(currentUser.roleKey)) {
      notify('暂无通知权限', '仅项目媒介、管理员或老板可以通知达人处理失败款。');
      return false;
    }
    const payout = payouts.find((candidate) => candidate.id === payoutId);
    if (!payout) return false;
    const creator = creators.find((candidate) => candidate.id === payout.creatorId);
    try {
      const updated = recordPaymentFailureNotification(
        payout,
        { account: currentUser.account, name: currentUser.name },
        message,
        creator?.contact.email ?? '',
        nowIso(),
      );
      setPayouts((current) => current.map((candidate) => candidate.id === payoutId ? updated : candidate));
      notify(
        '失败通知已记录',
        updated.paymentFailureRecovery?.status === 'READY_FOR_RETRY'
          ? '原收款账户未修改，该笔付款已自动更新为可加入新付款批次。'
          : '站内信与 Gmail 发送结果已按原型流程保存。',
      );
      return true;
    } catch (error) {
      notify('无法发送通知', error instanceof Error ? error.message : '当前付款不能通知达人。');
      return false;
    }
  };

  const sendPaymentListReturnNotification = (
    requestId: string,
    invoiceId: InvoiceId,
    message: string,
  ) => {
    if (!['media', 'admin', 'owner'].includes(currentUser.roleKey)) {
      notify('暂无通知权限', '仅项目媒介、管理员或老板可以通知达人修改付款明细。');
      return false;
    }
    const request = requestProjects.find((candidate) => (
      candidate.id === requestId || candidate.paymentRequestProjectId === requestId
    ));
    if (!request?.approval) {
      notify('无法发送通知', '未找到当前请款项目或审批记录。');
      return false;
    }
    const paymentListReturn = requestApprovalReturnItemForInvoice(
      request.approval,
      invoiceId,
      'PAYMENT_LIST',
    );
    if (!paymentListReturn) {
      notify('无法发送通知', '当前付款明细没有可处理的付款清单退回记录。');
      return false;
    }
    const invoice = generatedInvoices.find((candidate) => candidate.invoiceId === invoiceId);
    const paymentItem = paymentLists
      .filter((list) => (
        (Boolean(request.paymentRequestProjectId) && list.paymentRequestProjectId === request.paymentRequestProjectId)
        || (!request.paymentRequestProjectId && !list.paymentRequestProjectId && list.projectId === request.projectId)
      ))
      .flatMap((list) => list.items)
      .find((item) => item.invoiceId === invoiceId);
    const creatorId = invoice?.snapshot.creatorId ?? paymentItem?.snapshot.creatorId;
    const creator = creators.find((candidate) => candidate.id === creatorId);
    try {
      const updatedReturnItem = recordPaymentListReturnNotification(
        paymentListReturn,
        { account: currentUser.account, name: currentUser.name },
        message,
        creator?.contact.email ?? '',
        nowIso(),
      );
      const notification = updatedReturnItem.notifications?.[updatedReturnItem.notifications.length - 1];
      if (!notification) throw new Error('通知记录生成失败。');
      const updatedApproval = appendRequestApprovalReturnNotification(
        request.approval,
        invoiceId,
        notification,
      );
      setRequestProjects((current) => current.map((candidate) => (
        candidate.id === request.id
          ? { ...candidate, approval: updatedApproval }
          : candidate
      )));
      const gmailDelivery = notification.deliveries.find((delivery) => delivery.channel === 'GMAIL');
      notify(
        '通知已记录',
        gmailDelivery?.status === 'SKIPPED_MISSING_RECIPIENT'
          ? '站内信已发送，达人档案缺少邮箱，Gmail 未发送。'
          : '站内信与 Gmail 发送结果已按原型流程保存。',
      );
      return true;
    } catch (error) {
      notify('无法发送通知', error instanceof Error ? error.message : '当前付款明细不能通知达人。');
      return false;
    }
  };

  const simulatePaymentListReturnAccountUpdate = (
    requestId: string,
    invoiceId: InvoiceId,
  ) => {
    if (!['media', 'admin', 'owner'].includes(currentUser.roleKey)) {
      notify('暂无操作权限', '仅项目媒介、管理员或老板可以记录达人账户已完成修改。');
      return false;
    }
    const request = requestProjects.find((candidate) => (
      candidate.id === requestId || candidate.paymentRequestProjectId === requestId
    ));
    if (!request?.approval) {
      notify('无法记录账户更新', '未找到当前请款项目或审批记录。');
      return false;
    }
    const paymentListReturn = requestApprovalReturnItemForInvoice(
      request.approval,
      invoiceId,
      'PAYMENT_LIST',
    );
    if (!paymentListReturn) {
      notify('无法记录账户更新', '当前付款明细没有可处理的付款清单退回记录。');
      return false;
    }
    if (!paymentListReturn.notifications?.length) {
      notify('请先通知达人', '向达人发送付款明细修改通知后，才能记录账户更新反馈。');
      return false;
    }
    if (paymentListReturn.accountUpdate) {
      notify('账户更新已记录', '当前付款明细已经记录过达人账户更新反馈。');
      return false;
    }
    const paymentList = paymentLists.find((list) => (
      ((Boolean(request.paymentRequestProjectId) && list.paymentRequestProjectId === request.paymentRequestProjectId)
        || (!request.paymentRequestProjectId && !list.paymentRequestProjectId && list.projectId === request.projectId))
      && list.items.some((item) => item.invoiceId === invoiceId)
    ));
    const paymentItem = paymentList?.items.find((item) => item.invoiceId === invoiceId);
    const effectiveAccount = paymentItem ? paymentListEffectiveAccount(paymentItem) : null;
    const creator = creators.find((candidate) => candidate.id === paymentItem?.snapshot.creatorId);
    const currentAccount = creator && effectiveAccount?.payoutAccountId
      ? creator.payoutAccounts.find((account) => getPayoutAccountId(account) === effectiveAccount.payoutAccountId)
      : undefined;
    if (!paymentList || !paymentItem || !creator || !currentAccount) {
      notify('无法记录账户更新', '未找到该达人当前付款清单关联的收款账户。');
      return false;
    }
    const currentVersion = getPayoutAccountVersion(currentAccount);
    const versionNumber = currentVersion === 'legacy-v1' ? 1 : Number(currentVersion.slice(1));
    const nextVersion = `v${Number.isFinite(versionNumber) ? versionNumber + 1 : 2}` as PayoutAccountVersion;
    const occurredAt = nowIso();
    const accountFingerprint = `fp_return_${request.id}_${invoiceId}_${nextVersion}`;
    const updatedAccount = currentAccount.provider === 'Airwallex'
      ? {
          ...currentAccount,
          payoutAccountVersion: nextVersion,
          accountFingerprint,
          status: 'VALIDATED' as const,
          validatedAt: occurredAt,
        }
      : {
          ...currentAccount,
          payoutAccountVersion: nextVersion,
          accountFingerprint,
          status: 'VALIDATED' as const,
        };
    const updatedPaymentItem = applyValidatedPaymentListPayoutSnapshot(
      paymentItem,
      createDocumentPayoutSnapshot(updatedAccount, creator.id),
      occurredAt,
    );
    const accountUpdate = {
      status: 'VALIDATED' as const,
      occurredAt,
      payoutAccountVersion: nextVersion,
      accountFingerprint,
    };
    try {
      const updatedApproval = recordRequestApprovalReturnAccountUpdate(
        request.approval,
        invoiceId,
        accountUpdate,
      );
      setCreators((current) => current.map((candidate) => candidate.id !== creator.id ? candidate : {
        ...candidate,
        payoutAccounts: candidate.payoutAccounts.map((account) => (
          getPayoutAccountId(account) !== getPayoutAccountId(currentAccount)
            ? account
            : updatedAccount
        )),
      }));
      setPaymentLists((current) => current.map((list) => list.paymentListId !== paymentList.paymentListId ? list : {
        ...list,
        updatedAt: occurredAt,
        items: list.items.map((item) => item.invoiceId !== invoiceId ? item : updatedPaymentItem),
      }));
      setRequestProjects((current) => current.map((candidate) => (
        candidate.id === request.id
          ? { ...candidate, approval: updatedApproval }
          : candidate
      )));
      notify('达人账户已更新', '新账户版本已同步到达人档案和付款清单，资料校验已通过。');
      return true;
    } catch (error) {
      notify('无法记录账户更新', error instanceof Error ? error.message : '当前付款明细不能记录账户更新。');
      return false;
    }
  };

  const simulatePaymentFailureAccountUpdate = (payoutId: string) => {
    if (!['media', 'admin', 'owner'].includes(currentUser.roleKey)) {
      notify('暂无操作权限', '仅项目媒介、管理员或老板可以记录达人账户更新反馈。');
      return false;
    }
    const payout = payouts.find((candidate) => candidate.id === payoutId);
    if (!payout) return false;
    try {
      const updated = simulateCreatorAccountUpdated(payout, nowIso());
      const recovery = updated.paymentFailureRecovery!;
      const linkedPayoutAccountId = payout.paymentFailureRecovery?.reportedPayoutAccountId
        ?? payout.payoutAccountId
        ?? payout.invoiceSnapshot?.payoutAccountId;
      setCreators((current) => current.map((creator) => creator.id !== payout.creatorId ? creator : ({
        ...creator,
        payoutAccounts: creator.payoutAccounts.map((account) => {
          if (getPayoutAccountId(account) !== linkedPayoutAccountId) return account;
          const identity = {
            payoutAccountVersion: recovery.reportedPayoutAccountVersion,
            accountFingerprint: recovery.reportedAccountFingerprint,
            status: 'READY_FOR_VALIDATION' as const,
          };
          return account.provider === 'Airwallex'
            ? { ...account, ...identity, beneficiaryId: recovery.reportedExternalBeneficiaryId ?? account.beneficiaryId }
            : { ...account, ...identity };
        }),
      })));
      const linkedInvoice = generatedInvoices.find((invoice) => invoice.sourcePayoutId === payout.id);
      if (linkedInvoice) {
        setPaymentLists((current) => current.map((list) => (
          list.paymentRequestProjectId !== payout.paymentRequestProjectId
          || !list.items.some((item) => item.invoiceId === linkedInvoice.invoiceId)
          ? list
          : {
              ...list,
              items: list.items.map((item) => item.invoiceId === linkedInvoice.invoiceId
                ? { ...item, requiresRevalidation: true, validationIssues: ['达人已更新账户，待重新校验'] }
                : item),
              updatedAt: nowIso(),
            })));
      }
      setPayouts((current) => current.map((candidate) => candidate.id === payoutId ? updated : candidate));
      notify('已收到达人模拟反馈', '账户版本已更新，该笔付款仍需重新校验。');
      return true;
    } catch (error) {
      notify('无法记录达人反馈', error instanceof Error ? error.message : '请先完成失败通知。');
      return false;
    }
  };

  const revalidatePaymentFailureAccount = (payoutId: string) => {
    if (!['media', 'admin', 'owner'].includes(currentUser.roleKey)) {
      notify('暂无校验权限', '仅项目媒介、管理员或老板可以发起失败款资料重新校验。');
      return false;
    }
    const payout = payouts.find((candidate) => candidate.id === payoutId);
    if (!payout) return false;
    try {
      const occurredAt = nowIso();
      const creator = creators.find((candidate) => candidate.id === payout.creatorId);
      const linkedPayoutAccountId = payout.paymentFailureRecovery?.reportedPayoutAccountId
        ?? payout.payoutAccountId
        ?? payout.invoiceSnapshot?.payoutAccountId;
      const account = creator?.payoutAccounts.find((candidate) => getPayoutAccountId(candidate) === linkedPayoutAccountId);
      const issues = paymentFailureRevalidationIssues(payout, account ? {
        payoutAccountId: getPayoutAccountId(account),
        payoutAccountVersion: getPayoutAccountVersion(account),
        accountFingerprint: getPayoutAccountFingerprint(account),
        externalBeneficiaryId: account.provider === 'Airwallex' ? account.beneficiaryId : undefined,
      } : null);
      const updated = completePaymentFailureRevalidation(payout, occurredAt, issues);
      const linkedInvoice = generatedInvoices.find((invoice) => invoice.sourcePayoutId === payout.id);
      if (!linkedInvoice) throw new Error('未找到失败款项对应的 Invoice。');
      if (issues.length) {
        setPaymentLists((current) => current.map((list) => (
          list.paymentRequestProjectId !== payout.paymentRequestProjectId
          || !list.items.some((item) => item.invoiceId === linkedInvoice.invoiceId)
          ? list
          : {
              ...list,
              items: list.items.map((item) => item.invoiceId === linkedInvoice.invoiceId
                ? { ...item, requiresRevalidation: true, validationIssues: [...issues], lastValidatedAt: occurredAt }
                : item),
              updatedAt: occurredAt,
            })));
        setPayouts((current) => current.map((candidate) => candidate.id === payoutId ? updated : candidate));
        notify('重新校验未通过', issues.join('；'));
        return false;
      }
      const sourcePaymentItem = paymentLists
        .filter((list) => list.paymentRequestProjectId === payout.paymentRequestProjectId)
        .flatMap((list) => list.items)
        .find((item) => item.invoiceId === linkedInvoice.invoiceId);
      if (!sourcePaymentItem?.executionAccountOverride) {
        throw new Error('请先为失败明细选择新的本次执行账户。');
      }
      const effectiveAccount = paymentListEffectiveAccount(sourcePaymentItem);
      const validatedPaymentItem = revalidatePaymentListItem(sourcePaymentItem, occurredAt, {
        payoutAccountId: effectiveAccount.payoutAccountId ?? '',
        payoutAccountVersion: effectiveAccount.payoutAccountVersion ?? 'legacy-v1',
        accountFingerprint: effectiveAccount.accountFingerprint ?? '',
        provider: effectiveAccount.provider,
        externalBeneficiaryId: effectiveAccount.externalBeneficiaryId,
        validationStatus: effectiveAccount.validationStatus ?? 'DRAFT',
      });
      if (validatedPaymentItem.requiresRevalidation) {
        throw new Error(validatedPaymentItem.validationIssues?.[0] ?? '新执行账户未通过校验。');
      }
      setPaymentLists((current) => current.map((list) => (
        list.paymentRequestProjectId !== payout.paymentRequestProjectId
        || !list.items.some((item) => item.invoiceId === linkedInvoice.invoiceId)
          ? list
          : {
              ...list,
              items: list.items.map((item) => item.invoiceId === linkedInvoice.invoiceId
                ? validatedPaymentItem
                : item),
              updatedAt: occurredAt,
            }
      )));
      setCreators((current) => current.map((candidate) => candidate.id !== payout.creatorId ? candidate : ({
        ...candidate,
        payoutAccounts: candidate.payoutAccounts.map((account) => getPayoutAccountId(account) === linkedPayoutAccountId
          ? { ...account, status: 'VALIDATED' as const }
          : account),
      })));
      const pendingFinance = {
        ...updated,
        provider: effectiveAccount.provider as Payout['provider'],
        account: effectiveAccount.accountSummary,
        transferMethod: effectiveAccount.transferMethod,
        localClearingSystem: effectiveAccount.localClearingSystem,
      };
      setPayouts((current) => current.map((candidate) => candidate.id === payoutId ? pendingFinance : candidate));
      notify('失败款资料校验通过', '新执行账户已校验，等待财务确认后才能加入付款批次。');
      return true;
    } catch (error) {
      notify('资料校验未通过', error instanceof Error ? error.message : '账户快照仍需处理。');
      return false;
    }
  };

  const confirmPaymentFailureExecutionAccount = (payoutId: string) => {
    if (!['finance', 'admin', 'owner'].includes(currentUser.roleKey)) {
      notify('暂无确认权限', '新执行账户完成校验后，需要由财务确认。');
      return false;
    }
    const payout = payouts.find((candidate) => candidate.id === payoutId);
    const linkedInvoice = generatedInvoices.find((invoice) => invoice.sourcePayoutId === payoutId);
    if (!payout || !linkedInvoice) return false;
    try {
      const occurredAt = nowIso();
      const actor = { account: currentUser.account, name: currentUser.name };
      const confirmedPayout = confirmPaymentFailureAccountChange(payout, actor, occurredAt);
      const sourceList = paymentLists.find((list) => list.items.some((item) => (
        list.paymentRequestProjectId === payout.paymentRequestProjectId
        && item.invoiceId === linkedInvoice.invoiceId
      )));
      const sourceItem = sourceList?.items.find((item) => item.invoiceId === linkedInvoice.invoiceId);
      if (!sourceList || !sourceItem) throw new Error('未找到失败款对应的付款清单明细。');
      const confirmedItem = confirmPaymentExecutionAccountOverride(sourceItem, actor, occurredAt);
      setPaymentLists((current) => current.map((list) => {
        if (list.paymentListId !== sourceList.paymentListId) return list;
        return {
          ...list,
          items: list.items.map((item) => item.invoiceId === linkedInvoice.invoiceId
            ? confirmedItem
            : item),
          updatedAt: occurredAt,
        };
      }));
      setPayouts((current) => current.map((candidate) => candidate.id === payoutId ? confirmedPayout : candidate));
      setSelectedPayout((current) => current?.id === payoutId ? confirmedPayout : current);
      notify('财务已确认新执行账户', '该笔失败款已可加入新的付款批次，Invoice 签署快照保持不变。');
      return true;
    } catch (error) {
      notify('无法确认执行账户', error instanceof Error ? error.message : '新执行账户尚未满足确认条件。');
      return false;
    }
  };

  const externalInvoiceActor = (): ExternalInvoiceActor => ({
    account: currentUser.account,
    name: currentUser.name,
    role: currentUser.role,
  });

  const createExternalInvoiceTask = (input: ExternalInvoiceCollectionInput, publish: boolean) => {
    if (!hasPermission(currentUser, 'invoice_manage')) {
      notify('暂无操作权限', `${currentUser.role}不能发起外部 Invoice 收集。`);
      return;
    }
    try {
      const record = createExternalInvoiceCollection({
        ...input,
        actor: externalInvoiceActor(),
        publish,
      });
      setExternalInvoices((current) => [record, ...current]);
      setInvoiceTab('upload');
      notify(
        publish ? '外部 Invoice 收集已发布' : '外部 Invoice 收集草稿已保存',
        `${input.creatorName} / ${input.projectName} 已进入“${publish ? '待上传' : '待发布'}”。`,
      );
    } catch (error) {
      notify('无法创建收集任务', error instanceof Error ? error.message : '外部 Invoice 收集创建失败。');
    }
  };

  const publishExternalInvoiceTasks = (invoiceIds: string[]) => {
    if (!hasPermission(currentUser, 'invoice_manage')) {
      notify('暂无操作权限', `${currentUser.role}不能发布外部 Invoice 收集任务。`);
      return false;
    }
    const selectedIds = new Set(invoiceIds);
    const records = externalInvoices.filter((candidate) => selectedIds.has(String(candidate.invoiceId)));
    if (!records.length || records.length !== selectedIds.size) {
      notify('发布失败', '部分外部 Invoice 收集任务已不存在，请刷新列表后重试。');
      return false;
    }
    try {
      const occurredAt = nowIso();
      const updated = records.map((record) => publishExternalInvoiceCollection(
        record,
        externalInvoiceActor(),
        occurredAt,
      ));
      const updatedById = new Map(updated.map((record) => [record.invoiceId, record]));
      setExternalInvoices((current) => current.map((candidate) => updatedById.get(candidate.invoiceId) ?? candidate));
      setInvoiceTab('upload');
      notify(
        records.length === 1 ? '收集任务已发布' : '收集任务已批量发布',
        `${records.length} 个 C 端待上传任务已生成。`,
      );
      return true;
    } catch (error) {
      notify('发布失败', error instanceof Error ? error.message : '当前收集任务无法发布。');
      return false;
    }
  };

  const publishExternalInvoiceTask = (invoiceId: string) => publishExternalInvoiceTasks([invoiceId]);

  const simulateExternalInvoiceReturn = (
    invoiceId: string,
    scenario: ExternalInvoiceScenario,
    payoutAccountId: string,
    invoiceDate: string,
  ) => {
    const record = externalInvoices.find((candidate) => String(candidate.invoiceId) === invoiceId);
    const creator = record ? creators.find((candidate) => candidate.id === record.creatorId) : undefined;
    if (!record || !creator) {
      notify('模拟回传失败', '未找到外部 Invoice 对应的达人档案。');
      return;
    }
    try {
      const updated = simulateExternalInvoiceUpload({
        record,
        creator,
        payoutAccountId,
        scenario,
        invoiceDate,
        actor: { account: 'creator.demo', name: `${creator.name}（C 端）`, role: '达人账号' },
      });
      setExternalInvoices((current) => current.map((candidate) => candidate.invoiceId === record.invoiceId ? updated : candidate));
      notify(
        scenario === 'NORMAL'
          ? '已模拟正常上传'
          : scenario === 'OCR_ERROR'
            ? '已模拟 OCR 识别错误'
            : scenario === 'ACCOUNT_MISMATCH'
              ? '已模拟收款账户不一致'
              : '已模拟原文件错误',
        '新文件版本、首次识别值与达人确认层已分别保存。',
      );
    } catch (error) {
      notify('模拟回传失败', error instanceof Error ? error.message : '当前状态不能上传文件。');
    }
  };

  const correctExternalInvoiceField = (invoiceId: string, fieldKey: ExternalInvoiceFieldKey, value: string) => {
    const record = externalInvoices.find((candidate) => String(candidate.invoiceId) === invoiceId);
    if (!record) return;
    try {
      const updated = correctExternalInvoiceRecognition(
        record,
        fieldKey,
        value,
        { account: 'creator.demo', name: `${record.creatorName}（C 端）`, role: '达人账号' },
      );
      setExternalInvoices((current) => current.map((candidate) => candidate.invoiceId === record.invoiceId ? updated : candidate));
      notify('识别结果已纠正', '系统首次识别值保持不变，达人确认值和修改前后差异已保存。');
    } catch (error) {
      notify('无法纠正识别结果', error instanceof Error ? error.message : '纠正值无法匹配原文件证据。');
    }
  };

  const reviewExternalInvoiceTaskField = (
    invoiceId: string,
    fieldKey: ExternalInvoiceFieldKey,
    decision: ExternalInvoiceMediaReviewDecision,
    note?: string,
  ) => {
    if (!hasPermission(currentUser, 'invoice_media_review')) {
      notify('暂无审核权限', `${currentUser.role}不能记录外部 Invoice 字段复核结果。`);
      return;
    }
    const record = externalInvoices.find((candidate) => String(candidate.invoiceId) === invoiceId);
    if (!record) return;
    try {
      const updated = reviewExternalInvoiceField(
        record,
        fieldKey,
        decision,
        externalInvoiceActor(),
        note,
      );
      setExternalInvoices((current) => current.map((candidate) => (
        candidate.invoiceId === record.invoiceId ? updated : candidate
      )));
      notify(
        decision === 'CONFIRMED_CORRECTION' ? '达人纠正已确认' : decision === 'REUPLOAD_REQUIRED' ? '已记录重新上传要求' : '字段异常已记录',
        '媒介复核结果、操作人和时间已写入当前 Invoice 审核记录。',
      );
    } catch (error) {
      notify('字段复核失败', error instanceof Error ? error.message : '当前字段无法记录复核结果。');
    }
  };

  const submitExternalInvoiceTask = (invoiceId: string) => {
    const record = externalInvoices.find((candidate) => String(candidate.invoiceId) === invoiceId);
    const creator = record ? creators.find((candidate) => candidate.id === record.creatorId) : undefined;
    if (!record || !creator) return;
    try {
      const updated = submitExternalInvoiceForReview({
        record,
        creator,
        contracts,
        occupiedInvoices: generatedInvoices,
        reservedInvoiceNumbers: externalInvoices.filter((candidate) => candidate.invoiceId !== record.invoiceId)
          .flatMap((candidate) => candidate.invoiceNumber ? [candidate.invoiceNumber] : []),
        reservedSourceInvoiceNumbers: externalInvoices.filter((candidate) => candidate.invoiceId !== record.invoiceId)
          .flatMap((candidate) => candidate.sourceInvoiceNumber ? [candidate.sourceInvoiceNumber] : []),
        actor: { account: 'creator.demo', name: `${creator.name}（C 端）`, role: '达人账号' },
      });
      setExternalInvoices((current) => current.map((candidate) => candidate.invoiceId === record.invoiceId ? updated : candidate));
      setInvoiceTab('review');
      notify('已提交审核', `${updated.invoiceNumber} 已按达人确认的 Date of Invoice 分配候选编号。`);
    } catch (error) {
      notify('无法提交审核', error instanceof Error ? error.message : '任务或档案校验未通过。');
    }
  };

  const returnExternalInvoiceTask = (
    invoiceId: string,
    returnType: 'CORRECTION' | 'REUPLOAD',
    reason: string,
  ) => {
    const record = externalInvoices.find((candidate) => String(candidate.invoiceId) === invoiceId);
    if (!record) return;
    const creator = creators.find((candidate) => candidate.id === record.creatorId);
    try {
      const updated = returnExternalInvoice(
        record,
        returnType,
        reason,
        externalInvoiceActor(),
        undefined,
        creator?.contact.email,
      );
      setExternalInvoices((current) => current.map((candidate) => candidate.invoiceId === record.invoiceId ? updated : candidate));
      setInvoiceTab('upload');
      notify('外部 Invoice 已退回', '列表统一显示“待重新上传”，详情保留具体处理方式和原因。');
    } catch (error) {
      notify('退回失败', error instanceof Error ? error.message : '当前外部 Invoice 无法退回。');
    }
  };

  const approveExternalInvoiceTask = (invoiceId: string) => {
    const record = externalInvoices.find((candidate) => String(candidate.invoiceId) === invoiceId);
    const creator = record ? creators.find((candidate) => candidate.id === record.creatorId) : undefined;
    if (!record || !creator) return;
    try {
      const result = buildApprovedExternalInvoice({
        record,
        creator,
        contracts,
        occupiedInvoices: generatedInvoices,
        reservedInvoiceNumbers: externalInvoices.filter((candidate) => candidate.invoiceId !== record.invoiceId)
          .flatMap((candidate) => candidate.invoiceNumber ? [candidate.invoiceNumber] : []),
        reservedSourceInvoiceNumbers: externalInvoices.filter((candidate) => candidate.invoiceId !== record.invoiceId)
          .flatMap((candidate) => candidate.sourceInvoiceNumber ? [candidate.sourceInvoiceNumber] : []),
        actor: externalInvoiceActor(),
      });
      setExternalInvoices((current) => current.map((candidate) => candidate.invoiceId === record.invoiceId ? result.collection : candidate));
      setGeneratedInvoices((current) => [result.invoice, ...current]);
      setPayouts((current) => [result.payout, ...current]);
      setInvoiceTab('approved');
      notify('外部 Invoice 审核通过', `${result.invoice.id} 已跳过签署并进入“待发起请款”。`);
    } catch (error) {
      notify('审核通过失败', error instanceof Error ? error.message : '外部 Invoice 尚不满足审核条件。');
    }
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
      const creatorEmail = creators.find((creator) => creator.id === payout.creatorId)?.contact.email;
      const updated = applyInvoiceReviewAction(
        payout,
        action,
        { account: currentUser.account, name: currentUser.name, role: currentUser.role },
        reason,
        undefined,
        creatorEmail,
      );
      setPayouts((current) => current.map((item) => (
        item.id === payout.id ? updated : item
      )));
      setGeneratedInvoices((current) => current.map((record) => (
        record.sourcePayoutId === payout.id
          ? {
              ...record,
              status: updated.invoiceReviewStatus,
              snapshot: updated.invoiceSnapshot ?? record.snapshot,
              paymentFreezeSnapshot: updated.invoicePaymentFreezeSnapshot
                ?? (action === 'RETURN_TO_CREATOR' ? undefined : record.paymentFreezeSnapshot),
            }
          : record
      )));
      setInvoiceTab(getInvoicePageTab(updated.invoiceReviewStatus));
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

  const publishInternalInvoiceDrafts = (invoiceIds: string[]) => {
    if (!hasPermission(currentUser, 'invoice_manage')) {
      notify('暂无操作权限', `${currentUser.role}不能发布 Invoice 草稿。`);
      return false;
    }
    const selectedIds = new Set(invoiceIds);
    const records = generatedInvoices.filter((record) => selectedIds.has(String(record.invoiceId)));
    if (!records.length || records.length !== selectedIds.size) {
      notify('发布失败', '部分 Invoice 草稿已不存在，请刷新列表后重试。');
      return false;
    }
    const occurredAt = nowIso();
    const actor = { account: currentUser.account, name: currentUser.name, role: currentUser.role };
    try {
      const results = records.map((record) => {
        const payout = payouts.find((candidate) => candidate.id === record.sourcePayoutId);
        if (!payout) throw new Error(`${record.id} 缺少关联付款记录。`);
        return publishGeneratedInvoiceDraft(record, payout, actor, record.snapshot.from.email, occurredAt);
      });
      const recordsById = new Map(results.map((result) => [result.record.invoiceId, result.record]));
      const payoutsById = new Map(results.map((result) => [result.payout.id, result.payout]));
      setGeneratedInvoices((current) => current.map((record) => recordsById.get(record.invoiceId) ?? record));
      setPayouts((current) => current.map((payout) => payoutsById.get(payout.id) ?? payout));
      setInvoiceTab('signature');
      notify(
        records.length === 1 ? 'Invoice 已发布' : 'Invoice 已批量发布',
        `${records.length} 张 Invoice 已发送至达人端签署，并记录站内信与邮件模拟通知。`,
      );
      return true;
    } catch (error) {
      notify('发布失败', error instanceof Error ? error.message : 'Invoice 草稿暂时无法发布。');
      return false;
    }
  };

  const withdrawInternalInvoiceDraft = (invoiceId: string) => {
    if (!hasPermission(currentUser, 'invoice_manage')) {
      notify('暂无操作权限', `${currentUser.role}不能撤销 Invoice 草稿。`);
      return false;
    }
    const record = generatedInvoices.find((candidate) => String(candidate.invoiceId) === invoiceId);
    const payout = record ? payouts.find((candidate) => candidate.id === record.sourcePayoutId) : undefined;
    if (!record || !payout) {
      notify('撤销失败', '未找到完整的 Invoice 草稿记录。');
      return false;
    }
    if (record.status !== '草稿' || payout.invoiceReviewStatus !== '草稿') {
      notify('无法撤销', '只有尚未发布的 Invoice 草稿可以撤销。');
      return false;
    }
    if (findInvoiceRequest(payout, generatedInvoices, requestProjects)) {
      notify('无法撤销', '该 Invoice 已被请款项目占用，不能删除。');
      return false;
    }
    setGeneratedInvoices((current) => current.filter((candidate) => candidate.invoiceId !== record.invoiceId));
    setPayouts((current) => current.filter((candidate) => candidate.id !== payout.id));
    setPaymentLists((current) => current.map((list) => removePaymentListItem(list, record.invoiceId)));
    registerProjectMutation({
      projectId: record.snapshot.projectId as ProjectId,
      engagementId: record.snapshot.engagementId,
      entityType: 'invoice',
      entityId: record.invoiceId,
      action: 'delete',
      summary: `已撤销并删除 Invoice 草稿 ${record.id}`,
    });
    setFocusedInvoiceId(null);
    setInvoiceTab('signature');
    notify('Invoice 草稿已撤销', `${record.id} 已从当前前端会话中删除。`);
    return true;
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
          ? {
              ...invoice,
              status: updatedPayout.invoiceReviewStatus,
              snapshot: updatedPayout.invoiceSnapshot ?? invoice.snapshot,
              paymentFreezeSnapshot: updatedPayout.invoicePaymentFreezeSnapshot,
            }
          : invoice
      )));
      setInvoiceTab('review');
      setFocusedInvoiceId(linkedPayout.id);
      notify('已提交审核', `${record.id} 已标记签署完成，当前状态为“待审核”。`);
    } catch (error) {
      notify('提交失败', error instanceof Error ? error.message : '当前 Invoice 无法提交审核。');
    }
  };

  const openInvoiceFromPayout = (payout: Payout) => {
    const request = findInvoiceRequest(payout, generatedInvoices, requestProjects);
    const invoice = generatedInvoices.find((candidate) => candidate.sourcePayoutId === payout.id);
    const returnContext = getInvoiceManagementReturnContext(payout, invoice?.invoiceId, request);
    setInvoiceTab(getInvoiceManagementView(payout, request, returnContext, {
      signed: hasInvoiceSignatureEvidence(payout, invoice),
    }).tab);
    setFocusedInvoiceId(payout.id);
    setSelectedPayout(null);
    setActivePage('invoice');
  };

  const openNotificationTarget = (target: NotificationNavigationTarget) => {
    if (target.kind === 'invoice-review') {
      const invoice = generatedInvoices.find((item) => item.invoiceId === target.invoiceId);
      const payout = invoice
        ? payouts.find((item) => item.id === invoice.sourcePayoutId)
        : undefined;
      if (!invoice || !payout) {
        notify('未找到 Invoice', '无法通过稳定 Invoice ID 定位对应的审核记录。');
        return;
      }
      if (!navigate('invoice')) return;
      const request = findInvoiceRequest(payout, generatedInvoices, requestProjects);
      const returnContext = getInvoiceManagementReturnContext(payout, invoice.invoiceId, request);
      setInvoiceTab(getInvoiceManagementView(payout, request, returnContext, {
        signed: hasInvoiceSignatureEvidence(payout, invoice),
      }).tab);
      setFocusedInvoiceId(payout.id);
    } else if (target.kind === 'request-review') {
      const request = requestProjects.find((item) => (
        item.id === target.requestId || item.paymentRequestProjectId === target.requestId
      ));
      if (!request) {
        notify('未找到合作项目', `无法定位 ${target.requestId} 对应的审批项目。`);
        return;
      }
      if (!navigate('requests', { requestStatusFilter: 'approving' })) return;
      setFocusedRequestId(request.id);
    } else if (target.kind === 'creator-payout') {
      if (!creators.some((creator) => creator.id === target.creatorId)) {
        notify('未找到达人', '通知关联的达人档案已不存在。');
        return;
      }
      if (!navigate('creators')) return;
      setFocusedCreatorId(target.creatorId);
    } else if (target.kind === 'batch') {
      const batch = paymentBatches.find((item) => (
        item.paymentBatchId === target.batchId || item.paymentBatchCode === target.batchId
      ));
      if (!batch) {
        notify('未找到付款批次', `无法定位 ${target.batchId} 对应的付款批次。`);
        return;
      }
      if (!navigate('batches')) return;
      setFocusedBatchId(batch.paymentBatchId);
    } else {
      const payout = payouts.find((item) => item.id === target.payoutId);
      if (!payout) {
        notify('未找到付款记录', '通知关联的付款记录已不存在。');
        return;
      }
      if (!navigate('transactions')) return;
      setSelectedPayout(payout);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openContractFromPayout = (contract: ContractRecord) => {
    setFocusedContractId(contract.id);
    setSelectedPayout(null);
    setActivePage('contracts');
  };

  const openProjectFromInvoice = (payout: Payout) => {
    const invoice = generatedInvoices.find((item) => item.sourcePayoutId === payout.id);
    const request = invoice
      ? requestProjects.find((item) => item.lifecycle !== 'CANCELLED' && item.creatorLinks?.some((link) => link.invoiceIds.includes(invoice.invoiceId)))
      : undefined;
    if (!request) {
      setFocusedProjectId(null);
      setFocusedInvoiceId(null);
      setActivePage('projects');
      notify('Invoice 已可请款', '请在“我的项目”中新建请款项目，并关联这张已通过 Invoice。');
      return;
    }
    setFocusedProjectId(request.id);
    setFocusedInvoiceId(null);
    setActivePage('projects');
  };

  const openRequestFromInvoice = (payout: Payout) => {
    const invoice = generatedInvoices.find((item) => item.sourcePayoutId === payout.id);
    const directRequest = invoice
      ? requestProjects.find((request) => request.lifecycle !== 'CANCELLED' && request.invoiceIds?.includes(invoice.invoiceId))
      : undefined;
    const projectRequests = requestProjects.filter((request) => request.lifecycle !== 'CANCELLED' && request.projectId === payout.projectId);
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

  const paymentFailurePayoutForInvoice = (
    request: RequestProjectSummary,
    invoiceId: InvoiceId,
  ) => {
    const invoice = generatedInvoices.find((candidate) => candidate.invoiceId === invoiceId);
    if (!invoice) return undefined;
    return payouts.find((payout) => (
      payout.id === invoice.sourcePayoutId
      && payout.paymentRequestProjectId === request.paymentRequestProjectId
      && Boolean(payout.paymentFailureRecovery)
      && payout.paymentFailureRecovery?.status !== 'RETRY_SUBMITTED'
      && payout.status !== '已付款'
    ));
  };

  const requestHasPaymentFailureRecovery = (request: RequestProjectSummary) => payouts.some((payout) => (
    payout.paymentRequestProjectId === request.paymentRequestProjectId
    && Boolean(payout.paymentFailureRecovery)
    && payout.paymentFailureRecovery?.status !== 'RETRY_SUBMITTED'
    && payout.status !== '已付款'
  ));

  const requestResourceEditable = (request: RequestProjectSummary) => (
    canEditRequestProjectResources(
      currentUser,
      request,
      requestHasPaymentFailureRecovery(request),
    )
  );

  const requestWholeResourceEditable = (request: RequestProjectSummary) => (
    requestResourceEditable(request)
    && !requestApprovalHasScopedReturnItems(request.approval)
  );

  const paymentListItemEditable = (
    request: RequestProjectSummary,
    invoiceId: InvoiceId,
  ) => (
    requestResourceEditable(request)
    && (
      requestApprovalHasScopedReturnItems(request.approval)
        ? Boolean(requestApprovalReturnItemForPaymentListEdit(request.approval, invoiceId))
        : !requestHasPaymentFailureRecovery(request)
      || Boolean(paymentFailurePayoutForInvoice(request, invoiceId))
    )
  );

  const requestContractResourceEditable = (
    request: RequestProjectSummary,
    contractId: string,
  ) => (
    requestResourceEditable(request)
    && (
      !requestApprovalHasScopedReturnItems(request.approval)
      || Boolean(requestApprovalReturnItemForContract(request.approval, contractId))
    )
  );

  const editableReturnedRequestForInvoice = (invoiceId: InvoiceId) => requestProjects.find((request) => (
    request.lifecycle === 'RETURNED'
    && request.creatorLinks?.some((link) => link.invoiceIds.includes(invoiceId))
    && requestResourceEditable(request)
    && (
      !requestApprovalHasScopedReturnItems(request.approval)
      || Boolean(requestApprovalReturnItemForInvoiceEdit(request.approval, invoiceId))
    )
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
    if (!requestWholeResourceEditable(request)) {
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
    if (invoiceIds.length) {
      generateMediaRequestPaymentLists({ ...request, creatorLinks: links });
    } else {
      setPaymentLists((current) => current.map((list) => (
        list.paymentRequestProjectId === request.paymentRequestProjectId
          ? { ...beginPaymentListEdit(list), items: [], updatedAt: nowIso() }
          : list
      )));
      notify('项目资料已更新', `${summary}。当前没有关联 Invoice，付款草稿已清空。`);
    }
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

  const recordPrivilegedPaymentListEdit = (request: RequestProjectSummary, summary: string) => {
    registerRequestResourceMutation(request, 'payment-list', request.paymentRequestProjectId ?? request.id, 'update', summary);
  };

  const markPaymentListEdit = (request: RequestProjectSummary, summary: string) => {
    if (['admin', 'project', 'owner'].includes(currentUser.roleKey)) {
      recordPrivilegedPaymentListEdit(request, summary);
      return;
    }
    markRequestResourceChanged(request, summary);
  };

  const requestResourceActions: RequestProjectResourceActions = {
    onChangeLinks: changeRequestResourceLinks,
    onOpenContract: (request, contractId) => {
      setRequestResourceReturn({
        requestId: request.id,
        resource: 'contract',
        source: 'my-project',
        recordId: contractId,
      });
      setFocusedContractId(contractId);
      setActivePage('contracts');
    },
    onOpenInvoice: (request, invoiceId) => {
      const invoice = generatedInvoices.find((candidate) => candidate.invoiceId === invoiceId);
      if (!invoice) return;
      setRequestResourceReturn({
        requestId: request.id,
        resource: 'invoice',
        source: 'my-project',
        recordId: invoiceId,
      });
      setFocusedInvoiceId(`generated:${invoice.id}`);
      setInvoiceTab('signature');
      setActivePage('invoice');
    },
    onGenerateContract: (request) => {
      if (!requestWholeResourceEditable(request) || requestHasPaymentFailureRecovery(request)) {
        notify('项目资料已锁定', '当前项目仅可查看，不能生成新合同。');
        return;
      }
      const templateAvailability = getContractTemplateAvailability(contracts);
      if (!templateAvailability.activeTemplate) {
        notify('暂时无法生成合同', templateAvailability.disabledReason ?? '请先配置可用的合同模板。');
        return;
      }
      setRequestResourceReturn({ requestId: request.id, resource: 'contract', source: 'my-project' });
      setContractGenerationEngagementId(null);
      setActivePage('contract-create');
    },
    onGenerateInvoice: (request) => {
      if (!requestWholeResourceEditable(request) || requestHasPaymentFailureRecovery(request)) {
        notify('项目资料已锁定', '当前项目仅可查看，不能生成新 Invoice。');
        return;
      }
      setRequestResourceReturn({ requestId: request.id, resource: 'invoice', source: 'my-project' });
      setInvoiceCreationEngagementId(null);
      setActivePage('invoice-create');
    },
    onUploadContract: (request, inputs) => {
      if (!requestWholeResourceEditable(request) || requestHasPaymentFailureRecovery(request)) {
        notify('项目资料已锁定', '当前项目仅可查看，不能上传新合同。');
        return [];
      }
      return uploadContracts(inputs);
    },
    onDeleteContract: (request, contractId) => {
      if (!requestWholeResourceEditable(request) || requestHasPaymentFailureRecovery(request)) {
        notify('项目资料已锁定', '当前项目仅可查看，不能删除合同。');
        return;
      }
      const contract = contracts.find((candidate) => (candidate.contractId ?? candidate.id) === contractId);
      if (!contract || !canDeleteContract(currentUser, contract, contractDeletionOptions(contract))) {
        notify('暂无操作权限', contractDeletionPolicyMessage);
        return;
      }
      const isPrivilegedDeleter = ['admin', 'project', 'owner'].includes(currentUser.roleKey);
      const other = requestProjects.find((candidate) => (
        candidate.paymentRequestProjectId !== request.paymentRequestProjectId
        && candidate.creatorLinks?.some((link) => link.contractIds.includes(contractId))
      ));
      if (other && !isPrivilegedDeleter) {
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
      if (!requestWholeResourceEditable(request) || requestHasPaymentFailureRecovery(request)) {
        notify('项目资料已锁定', '当前项目仅可查看，不能删除 Invoice。');
        return;
      }
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
      if (!requestWholeResourceEditable(request) || requestHasPaymentFailureRecovery(request) || !clearedItemCount) return;
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
      if (!requestWholeResourceEditable(request) || requestHasPaymentFailureRecovery(request) || !list || list.status !== 'draft') return;
      setPaymentLists((current) => current.map((candidate) => candidate.paymentListId === paymentListId
        ? removePaymentListItem(candidate, invoiceId)
        : candidate));
      markRequestResourceChanged(request, `已从付款清单移除 Invoice ${invoiceId}`);
    },
    onUpdatePaymentItem: (request, paymentListId, invoiceId, field, value) => {
      const list = requestListFor(request, paymentListId);
      const item = list?.items.find((candidate) => candidate.invoiceId === invoiceId);
      if (!paymentListItemEditable(request, invoiceId) || !list || list.status !== 'draft') return;
      if (paymentFailurePayoutForInvoice(request, invoiceId)) {
        notify('失败明细仅可更换执行账户', '金额、币种、付款方式及付款备注继续使用原付款清单快照。');
        return;
      }
      if (isInvoiceDerivedPaymentListField(field)) {
        notify('转账方式不可修改', '转账方式来自达人签署时的付款账户快照。');
        return;
      }
      if (!item || String(paymentListItemValue(item, field)) === String(value)) return;
      setPaymentLists((current) => current.map((candidate) => {
        if (candidate.paymentListId !== paymentListId) return candidate;
        const updatedList = {
          ...candidate,
          updatedAt: nowIso(),
          items: candidate.items.map((paymentItem) => paymentItem.invoiceId === invoiceId ? {
            ...paymentItem,
            snapshot: field === 'feeBearer' ? {
              ...paymentItem.snapshot,
              feeBearerSource: paymentItem.snapshot.feeBearerSource === 'CONTRACT'
                ? 'CONTRACT_OVERRIDE' as const
                : 'MANUAL' as const,
            } : paymentItem.snapshot,
            overrides: { ...paymentItem.overrides, [field]: value },
            requiresRevalidation: true,
            validationIssues: ['付款字段已修改，请重新校验'],
          } : paymentItem),
        };
        setRequestProjects((requests) => requests.map((candidateRequest) => (
          candidateRequest.paymentRequestProjectId === request.paymentRequestProjectId
            ? {
                ...candidateRequest,
                amount: paymentRequestAmountLabel(candidateRequest.creatorLinks ?? [], generatedInvoices, updatedList),
                generatedDetail: candidateRequest.generatedDetail ? {
                  ...candidateRequest.generatedDetail,
                  invoiceAmount: paymentRequestAmountLabel(candidateRequest.creatorLinks ?? [], generatedInvoices, updatedList),
                } : candidateRequest.generatedDetail,
              }
            : candidateRequest
        )));
        return updatedList;
      }));
      markPaymentListEdit(request, `已修改 Invoice ${invoiceId} 的付款字段`);
    },
    onChangePaymentAccount: (request, paymentListId, invoiceId, payoutAccountId) => {
      const list = requestListFor(request, paymentListId);
      const item = list?.items.find((candidate) => candidate.invoiceId === invoiceId);
      const creator = creators.find((candidate) => candidate.id === item?.snapshot.creatorId);
      const account = creator?.payoutAccounts.find((candidate) => getPayoutAccountId(candidate) === payoutAccountId);
      const failurePayout = paymentFailurePayoutForInvoice(request, invoiceId);
      if (!paymentListItemEditable(request, invoiceId) || !list || list.status !== 'draft' || !item || !creator || !account) return;
      if (!failurePayout?.paymentFailureRecovery || failurePayout.paymentFailureReturn?.issueType !== 'PAYMENT_LIST') {
        notify('签署账户已冻结', '只有付款失败的明细可以更换本次实际执行账户，Invoice 原账户保持不变。');
        return;
      }
      if (!['VALIDATED', 'VERIFIED'].includes(account.status)) {
        notify('新执行账户不可用', '只能选择当前达人档案中已经审核通过的收款账户。');
        return;
      }
      if (paymentListEffectiveAccount(item).payoutAccountId === payoutAccountId) return;
      const requestPaymentProvider = paymentRequestProviderForChannel(request.paymentChannel);
      if (requestPaymentProvider && account.provider !== requestPaymentProvider) {
        notify('收款账户渠道不一致', `当前请款项目固定使用 ${paymentProviderDisplayName(request.paymentChannel)}，不能选择 ${paymentProviderDisplayName(account.provider)} 账户。`);
        return;
      }
      const occurredAt = nowIso();
      const updated = applyPaymentExecutionAccountOverride(
        item,
        createDocumentPayoutSnapshot(account, creator.id),
        {
          failurePayoutId: failurePayout.id,
          reason: failurePayout.paymentFailureReturn.reason,
          actor: { account: currentUser.account, name: currentUser.name },
          changedAt: occurredAt,
        },
      );
      setPaymentLists((current) => current.map((candidate) => {
        if (candidate.paymentListId !== paymentListId) return candidate;
        const items = candidate.items.map((paymentItem) => (
          paymentItem.invoiceId === invoiceId ? updated : paymentItem
        ));
        return {
          ...candidate,
          provider: paymentListProviderForItems(items, candidate.provider),
          updatedAt: occurredAt,
          items,
        };
      }));
      const changed = markPaymentFailureAccountChanged(failurePayout, {
        payoutAccountId: getPayoutAccountId(account),
        payoutAccountVersion: getPayoutAccountVersion(account),
        accountFingerprint: getPayoutAccountFingerprint(account),
        externalBeneficiaryId: account.provider === 'Airwallex' ? account.beneficiaryId : undefined,
      }, occurredAt);
      setPayouts((current) => current.map((candidate) => candidate.id === changed.id ? changed : candidate));
      markPaymentListEdit(request, `已更换 Invoice ${invoiceId} 的本次执行账户，Invoice 签署账户保持不变`);
    },
    onRevalidatePaymentItem: (request, paymentListId, invoiceId) => {
      const list = requestListFor(request, paymentListId);
      const item = list?.items.find((candidate) => candidate.invoiceId === invoiceId);
      const effectiveAccount = item ? paymentListEffectiveAccount(item) : null;
      const creator = creators.find((candidate) => candidate.id === item?.snapshot.creatorId);
      const account = creator?.payoutAccounts.find((candidate) => getPayoutAccountId(candidate) === effectiveAccount?.payoutAccountId);
      if (!paymentListItemEditable(request, invoiceId) || !list || list.status !== 'draft' || !item) return;
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
      const scopedPaymentListReturn = request.approval?.returnItems?.some((item) => (
        ['PAYMENT_LIST', 'FULL_ITEM'].includes(item.issueType)
        && item.paymentItems.some((paymentItem) => paymentItem.paymentListId === paymentListId)
      ));
      if (
        !requestResourceEditable(request)
        || requestHasPaymentFailureRecovery(request)
        || !list
        || (requestApprovalHasScopedReturnItems(request.approval) && !scopedPaymentListReturn)
      ) return;
      setPaymentLists((current) => current.map((candidate) => candidate.paymentListId === paymentListId
        ? beginPaymentListEdit(candidate)
        : candidate));
      markPaymentListEdit(request, `已从 ${list.paymentListCode} v${list.version ?? 1} 创建编辑草稿`);
    },
    onGeneratePaymentListVersion: async (request, paymentListId) => {
      const list = requestListFor(request, paymentListId);
      const scopedPaymentListReturn = request.approval?.returnItems?.some((item) => (
        ['PAYMENT_LIST', 'FULL_ITEM'].includes(item.issueType)
        && item.paymentItems.some((paymentItem) => paymentItem.paymentListId === paymentListId)
      ));
      if (
        !requestResourceEditable(request)
        || requestHasPaymentFailureRecovery(request)
        || !list
        || list.status !== 'draft'
        || (requestApprovalHasScopedReturnItems(request.approval) && !scopedPaymentListReturn)
      ) return;
      const expectedInvoiceIds = paymentRequestInvoiceIds(request.creatorLinks ?? []);
      const validation = await mockValidatePaymentList({
        paymentRequestProjectId: request.paymentRequestProjectId ?? request.id as PaymentRequestProjectId,
        paymentListId,
        draftVersion: (list.version ?? 0) + 1,
        expectedInvoiceIds,
        items: list.items.map((item) => ({
          ...item,
          requiresRevalidation: false,
          validationIssues: [],
        })),
      });
      if (!validation.valid) {
        setPaymentLists((current) => current.map((candidate) => candidate.paymentListId === paymentListId ? {
          ...candidate,
          status: 'draft',
          updatedAt: validation.validatedAt,
          items: candidate.items.map((item) => {
            const row = validation.rows.find((result) => result.invoiceId === item.invoiceId);
            return {
              ...item,
              requiresRevalidation: Boolean(row?.issues.length),
              validationIssues: row?.issues.map((issue) => issue.message.replace(`${item.snapshot.invoiceNumber}：`, '')) ?? [],
              lastValidatedAt: validation.validatedAt,
            };
          }),
        } : candidate));
        notify('付款清单生成失败', validation.issues[0]?.message ?? '付款清单校验未通过。');
        return;
      }
      const validatedList: PaymentListRecord = {
        ...list,
        items: list.items.map((item) => ({
          ...item,
          requiresRevalidation: false,
          validationIssues: [],
          lastValidatedAt: validation.validatedAt,
        })),
      };
      const result = generatePaymentListVersion({
        list: validatedList,
        expectedInvoiceIds,
        actor: { account: currentUser.account, name: currentUser.name, role: currentUser.role },
        generatedAt: validation.validatedAt,
      });
      setPaymentLists((current) => current.map((candidate) => candidate.paymentListId === paymentListId ? result.record : candidate));
      registerRequestResourceMutation(request, 'payment-list', paymentListId, 'update', `已生成 ${list.paymentListCode} v${result.record.version ?? 1}`);
      notify('付款清单版本已生成', `${list.paymentListCode} v${result.record.version ?? 1} 已锁定。`);
    },
    onExportPaymentList: async (request, paymentListId) => {
      const list = requestListFor(request, paymentListId);
      if (!list) return;
      try {
        const providers = await exportPaymentListFiles({
          projectCode: request.requestCode ?? request.id,
          list,
          allowSubmitted: true,
        });
        notify(
          '付款单已导出',
          providers.length > 1
            ? `已按 ${providers.length} 个渠道导出执行文件，所有文件共用 ${list.paymentListCode}。`
            : `已使用 ${paymentProviderDisplayName(providers[0])} 对应的 Excel 模板生成审批文件。`,
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
    const ineligible = selected.filter((payout) => (
      !isPayoutEligibleForBatch(payout) && !isPaymentFailureRetryReady(payout)
    ));
    if (ineligible.length > 0) {
      notify('无法创建付款批次', '仅 Invoice 审核已通过且处于等待付款的记录可以进入付款批次。');
      return;
    }
    const retryItems = selected.filter(isPaymentFailureRetryReady);
    if (retryItems.length > 0 && retryItems.length !== selected.length) {
      notify('无法创建付款批次', '首次付款和重新付款需要分别创建付款批次及付款单。');
      return;
    }
    const execution = executeMockBatchSubmission(submission);
    const now = new Date();
    const localPaymentTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    const isRetryBatch = retryItems.length > 0;
    const retryPaymentOrderCode = isRetryBatch ? createPrototypeCode('PAY') : undefined;
    const retryAttemptNumber = isRetryBatch
      ? Math.max(...retryItems.map((payout) => payout.currentPaymentAttempt?.attemptNumber ?? 1)) + 1
      : undefined;
    let batchRecord: ReturnType<typeof createPaymentBatchRecord>;
    try {
      batchRecord = createPaymentBatchRecord({
        payouts: selected,
        requests: requestProjects,
        generatedInvoices,
        paymentLists,
        contracts,
        paymentBatchId: execution.batchId as PaymentBatchId,
        paymentBatchCode: execution.batchCode,
        provider: execution.provider,
        fundingAccountId: execution.fundingAccountId,
        sourceCurrency: execution.sourceCurrency,
        payer: currentUser.name,
        paidAt: localPaymentTime,
        status: '付款处理中',
        lifecycle: execution.lifecycle,
        itemStatus: '付款处理中',
        paymentOrderCode: retryPaymentOrderCode,
        paymentAttemptNumber: retryAttemptNumber,
      });
    } catch (error) {
      notify(
        '无法创建付款批次',
        error instanceof Error ? error.message : '付款记录无法稳定关联到唯一请款项目。',
      );
      return;
    }
    setPayouts((current) => current.map((payout) => {
      if (!selected.some((item) => item.id === payout.id)) return payout;
      const batchItem = batchRecord.items.find((item) => item.payoutId === payout.id)!;
      return isPaymentFailureRetryReady(payout)
        ? markPaymentFailureRetrySubmitted(
            payout,
            execution.batchId,
            execution.batchCode,
            localPaymentTime,
            {
              paymentOrderCode: paymentBatchItemOrderCode(batchItem),
              sourcePaymentOrderCode: paymentBatchItemSourceOrderCode(batchItem),
              attemptNumber: paymentBatchItemAttemptNumber(batchItem),
            },
          )
        : {
            ...payout,
            status: '付款处理中',
            issue: undefined,
            currentPaymentAttempt: {
              paymentBatchId: batchRecord.paymentBatchId,
              paymentBatchCode: batchRecord.paymentBatchCode,
              submittedAt: localPaymentTime,
              paymentOrderCode: paymentBatchItemOrderCode(batchItem),
              sourcePaymentOrderCode: paymentBatchItemSourceOrderCode(batchItem),
              attemptNumber: paymentBatchItemAttemptNumber(batchItem),
            },
          };
    }));
    setPaymentBatches((current) => [batchRecord, ...current]);
    setActivePage('batches');
    notify(
      '模拟付款批次已提交',
      `${selected.length} 笔 ${paymentProviderDisplayName(execution.provider)} 付款已完成 create → add_items → quote → submit 契约模拟。`,
    );
  };

  const authenticate = (account: string, password: string) => {
    const result = authenticateSystemUser(account, password);
    if (!result.user) return result.error ?? '登录失败，请检查账号信息。';
    const nextUser = result.user;
    setCurrentUser(nextUser);
    setActivePage(getDefaultPageForRole(nextUser.roleKey));
    setShowRequestApprovalReminder(true);
    setRequestApprovalReminderUnread(true);
    setIsAuthenticated(true);
    return null;
  };

  if (!isAuthenticated) {
    return <AuthPage onAuthenticated={authenticate} />;
  }

  const requestApprovalReminder = requestApprovalReminderFor(currentUser, requestProjects);
  const notificationUnreadCount = notificationItems.filter((item) => item.unread).length
    + (requestApprovalReminder.count > 0 && requestApprovalReminderUnread ? 1 : 0);

  const canReviewInvoiceMedia = hasPermission(currentUser, 'invoice_media_review');
  const canReviewInvoiceFinance = hasPermission(currentUser, 'invoice_finance_review');
  const canExecutePayouts = hasPermission(currentUser, 'payout_execute');
  const canGenerateInvoices = hasPermission(currentUser, 'invoice_manage');
  const canManageCreators = hasPermission(currentUser, 'creator_records_manage');
  const canUploadContracts = hasPermission(currentUser, 'contract_manage');
  const canDeleteContracts = hasPermission(currentUser, 'contract_delete');
  const canEditTemplates = canEditContractTemplate(currentUser);
  const {
    template: configuredContractTemplate,
    activeTemplate: activeContractTemplate,
    disabledReason: createContractDisabledReason,
  } = getContractTemplateAvailability(contracts);
  const canManageProjects = hasPermission(currentUser, 'project_manage');
  const manageableCooperationProjects = projects.filter((project) => (
    canManageCooperationProjectFor(currentUser, project)
  ));
  const batchReadyPayouts = payouts
    .filter((payout) => isPayoutEligibleForBatch(payout) || isPaymentFailureRetryCandidate(payout))
    .map((payout) => {
      const invoice = generatedInvoices.find((record) => record.sourcePayoutId === payout.id);
      const paymentItem = invoice
        ? paymentLists.flatMap((list) => list.items).find((item) => item.invoiceId === invoice.invoiceId)
        : undefined;
      return paymentItem ? payoutWithPaymentListSnapshot(payout, paymentItem) : payout;
    })
    .sort((left, right) => Number(isPaymentFailureRetryCandidate(right)) - Number(isPaymentFailureRetryCandidate(left)));
  const paymentDetailRequest = paymentDetailRequestId
    ? requestProjects.find((request) => request.id === paymentDetailRequestId)
    : undefined;
  const paymentDetailRecord = paymentDetailRequest
    ? createPaymentProjectPaymentRecord({
        request: paymentDetailRequest,
        payouts,
        generatedInvoices,
        paymentLists,
        contracts,
      })
    : null;

  const returnFromRequestResourceDetail = (resource: 'contract' | 'invoice') => {
    const context = requestResourceReturn?.resource === resource ? requestResourceReturn : null;
    setRequestResourceReturn(null);
    if (!context) return;
    if (context.source === 'finance-review' && context.recordId) {
      setFinanceReviewResourceRestore({
        requestId: context.requestId,
        resource,
        recordId: context.recordId,
      });
      setPaymentWorkbenchInitialTab('review');
      setFinanceReviewRequestId(context.requestId);
      setActivePage('payment-workbench');
      return;
    }
    setFocusedProjectId(context.requestId);
    setActivePage('projects');
  };

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
          payouts={payouts}
          requests={requestProjects}
          canCreate={canManageProjects && ['media', 'admin', 'owner'].includes(currentUser.roleKey)}
          focusedProjectId={focusedProjectId}
          onFocusCleared={() => setFocusedProjectId(null)}
          initialFocusedFailurePayoutId={focusedPaymentFailurePayoutId}
          onFailureFocusCleared={() => setFocusedPaymentFailurePayoutId(null)}
          onCreated={(request) => {
            setRequestProjects((current) => [request, ...current]);
            generateMediaRequestPaymentLists(request);
          }}
          onUpdated={(request) => {
            const currentRequest = requestProjects.find((candidate) => (
              candidate.paymentRequestProjectId === request.paymentRequestProjectId
            ));
            if (!currentRequest || !requestResourceEditable(currentRequest)) {
              notify('项目已锁定', '请款项目提交后仅可查看；审批退回或付款失败后才能修改。');
              return;
            }
            setRequestProjects((current) => current.map((candidate) => (
              candidate.paymentRequestProjectId === request.paymentRequestProjectId ? request : candidate
            )));
            generateMediaRequestPaymentLists(request);
          }}
          onSubmitRequest={submitMediaPaymentRequest}
          onCancelRequest={cancelMediaPaymentRequest}
          resourceActions={requestResourceActions}
          onSendPaymentFailureNotification={sendPaymentFailureNotification}
          onSendPaymentListReturnNotification={sendPaymentListReturnNotification}
          onSimulatePaymentListReturnAccountUpdate={simulatePaymentListReturnAccountUpdate}
          onSimulatePaymentFailureAccountUpdate={simulatePaymentFailureAccountUpdate}
          onRevalidatePaymentFailureAccount={revalidatePaymentFailureAccount}
        />
      );
      break;
    case 'requests':
      pageContent = (
        <RequestsPage
          notify={notify}
          currentUser={currentUser}
          requests={requestProjects}
          payouts={payouts}
          paymentLists={paymentLists}
          creators={creators}
          generatedInvoices={generatedInvoices}
          contracts={contracts}
          approvalReminder={requestApprovalReminder}
          showApprovalReminder={showRequestApprovalReminder}
          onDismissApprovalReminder={() => setShowRequestApprovalReminder(false)}
          onExportPaymentList={requestResourceActions.onExportPaymentList}
          onApprovalAction={handleRequestApproval}
          onOpenFinanceReview={() => setActivePage('payment-workbench')}
          initialStatusFilter={requestStatusFilter}
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
          projectDirectory={projects}
          creators={creators}
          requestProjects={requestProjects}
          canUpload={canUploadContracts}
          canEditTemplates={canEditTemplates}
          canEditContract={(contract) => {
            const context = requestResourceReturn?.resource === 'contract'
              ? requestResourceReturn
              : null;
            if (!context) return true;
            if (context.source === 'finance-review') return false;
            const request = requestProjects.find((candidate) => candidate.id === context.requestId);
            return Boolean(request && requestContractResourceEditable(
              request,
              String(contract.contractId ?? contract.id),
            ));
          }}
          canDelete={canDeleteContracts}
          canDeleteContract={(contract) => canDeleteContract(currentUser, contract, contractDeletionOptions(contract))}
          focusedContractId={focusedContractId}
          onFocusCleared={() => {
            setFocusedContractId(null);
            if (requestResourceReturn?.resource === 'contract') {
              returnFromRequestResourceDetail('contract');
            }
          }}
          onUploadContracts={uploadContracts}
          onBindFrameworkContract={bindFrameworkContract}
          onCreateContract={() => {
            setContractGenerationEngagementId(null);
            setEditingContractDraftId(null);
            setActivePage('contract-create');
          }}
          createContractDisabledReason={createContractDisabledReason}
          onEditDraft={(contractId) => {
            setContractGenerationEngagementId(null);
            setEditingContractDraftId(contractId);
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
          contractTemplate={editingContractDraftId ? configuredContractTemplate : activeContractTemplate}
          initialEngagementId={contractGenerationEngagementId}
          existingDraft={contracts.find((contract) => (
            contract.lifecycle === 'EDITING_DRAFT'
            && ((editingContractDraftId && (contract.contractId ?? contract.id) === editingContractDraftId)
              || (!editingContractDraftId && contract.engagementId === contractGenerationEngagementId))
          ))}
          onGenerated={(model, files) => {
            const record = generateContract(model, files);
            notify(
              files.variant === 'FORMAL' ? '正式合同已生成' : '合同草稿已保存',
              `${record.id} 已关联 ${model.projectName} / ${model.creatorName}，等待线下签署文件回传。`,
            );
            return record;
          }}
          onSaveDraft={saveContractDraft}
          onDraftStateChange={(model, dirty) => {
            setContractBuilderModel(model);
            setContractBuilderDirty(dirty);
          }}
          onCancel={() => {
            const run = () => {
              setContractGenerationEngagementId(null);
              setEditingContractDraftId(null);
              setContractBuilderModel(null);
              setContractBuilderDirty(false);
              if (requestResourceReturn?.resource === 'contract') {
                setFocusedProjectId(requestResourceReturn.requestId);
                setRequestResourceReturn(null);
                setActivePage('projects');
              } else {
                setActivePage('contracts');
              }
            };
            if (contractBuilderDirty) setPendingContractExit({ run });
            else run();
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
          focusedCreatorId={focusedCreatorId}
          onFocusCleared={() => setFocusedCreatorId(null)}
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
          contracts={contracts}
          invoiceBillingSettings={invoiceBillingSettings}
          projects={projects}
          generatedInvoices={generatedInvoices}
          externalInvoices={externalInvoices}
          requests={requestProjects}
          tab={invoiceTab}
          onTabChange={setInvoiceTab}
          onCreateInvoice={() => setActivePage('invoice-create')}
          onCreateBatchInvoice={() => setActivePage('invoice-batch-create')}
          onCreateExternalInvoice={createExternalInvoiceTask}
          onPublishExternalInvoice={publishExternalInvoiceTask}
          onPublishExternalInvoices={publishExternalInvoiceTasks}
          onPublishGeneratedInvoices={publishInternalInvoiceDrafts}
          onWithdrawGeneratedInvoice={withdrawInternalInvoiceDraft}
          onSimulateExternalUpload={simulateExternalInvoiceReturn}
          onCorrectExternalRecognition={correctExternalInvoiceField}
          onSubmitExternalInvoice={submitExternalInvoiceTask}
          onReviewExternalInvoiceField={reviewExternalInvoiceTaskField}
          onReturnExternalInvoice={returnExternalInvoiceTask}
          onApproveExternalInvoice={approveExternalInvoiceTask}
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
              returnFromRequestResourceDetail('invoice');
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
          invoiceBillingSettings={invoiceBillingSettings}
          generatedInvoices={generatedInvoices}
          editRecord={editRecord}
          editContext={invoiceEditTarget.context}
          allowPayoutAccountChange={Boolean(
            invoiceEditTarget.context === 'PROJECT_RESOURCE'
            && requestApprovalAllowsInvoicePayoutOverride(
              editableReturnedRequestForInvoice(editRecord.invoiceId)?.approval,
              editRecord.invoiceId,
            )
          )}
          contractMatchActor={{ account: currentUser.account, name: currentUser.name, role: currentUser.role }}
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
          invoiceBillingSettings={invoiceBillingSettings}
          generatedInvoices={generatedInvoices}
          contractMatchActor={{ account: currentUser.account, name: currentUser.name, role: currentUser.role }}
          onGenerated={(record) => {
            addGeneratedInvoice(record);
            setInvoiceCreationEngagementId(null);
          }}
          onPublishGenerated={(record) => publishInternalInvoiceDrafts([String(record.invoiceId)])}
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
          invoiceBillingSettings={invoiceBillingSettings}
          generatedInvoices={generatedInvoices}
          contractMatchActor={{ account: currentUser.account, name: currentUser.name, role: currentUser.role }}
          onGenerated={addGeneratedInvoices}
          onPublishGenerated={(records) => publishInternalInvoiceDrafts(records.map((record) => String(record.invoiceId)))}
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
      pageContent = (
        <BatchesPage
          batches={paymentBatches}
          payouts={payouts}
          creators={creators}
          onNewBatch={() => setActivePage('new-batch')}
          notify={notify}
          canCreateBatch={canExecutePayouts}
          focusedBatchId={focusedBatchId}
          onReturnPayout={returnPayout}
          onOpenFailurePaymentList={(requestId, payoutId) => {
            const request = requestProjects.find((candidate) => (
              candidate.paymentRequestProjectId === requestId
            ));
            setFocusedProjectId(request?.id ?? requestId);
            setFocusedPaymentFailurePayoutId(payoutId);
            setActivePage('projects');
          }}
        />
      );
      break;
    case 'new-batch':
      pageContent = (
        <BatchWizardPage
          payouts={batchReadyPayouts}
          generatedInvoices={generatedInvoices}
          paymentLists={paymentLists}
          creators={creators}
          onCancel={() => setActivePage('batches')}
          onDraft={() => notify('草稿已保存', '付款选择与渠道配置已保存在当前浏览器。')}
          onSubmit={createBatch}
        />
      );
      break;
    case 'transactions':
      pageContent = (
        <TransactionsPage
          payouts={payouts}
          paymentBatches={paymentBatches}
          onOpenPaymentBatch={(batchId) => {
            if (!navigate('batches')) return;
            setFocusedBatchId(batchId);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      );
      break;
    case 'organization':
      pageContent = (
        <OrganizationPage
          notify={notify}
          invoiceBillingSettings={invoiceBillingSettings}
          onInvoiceBillingSettingsChange={setInvoiceBillingSettings}
        />
      );
      break;
    case 'channels':
      pageContent = <ChannelsPage notify={notify} />;
      break;
    case 'system-config':
      pageContent = (
        <SystemConfigurationPage
          contracts={contracts}
          projects={projects}
          creators={creators}
          notify={notify}
          onUpdateContract={updateContract}
          onTemplateDirtyChange={setContractTemplateDirty}
        />
      );
      break;
    case 'system-accounts':
    case 'system-settings':
      pageContent = <SystemSettingsPage notify={notify} />;
      break;
    case 'notifications':
      pageContent = (
        <NotificationsPage
          items={notificationItems}
          approvalReminder={requestApprovalReminder}
          approvalReminderUnread={requestApprovalReminderUnread}
          onRead={(notificationId) => setNotificationItems((current) => current.map((item) => (
            item.id === notificationId ? { ...item, unread: false } : item
          )))}
          onReadApprovalReminder={() => setRequestApprovalReminderUnread(false)}
          onMarkAllRead={() => {
            setNotificationItems((current) => current.map((item) => ({ ...item, unread: false })));
            setRequestApprovalReminderUnread(false);
          }}
          onOpenRequestApprovals={() => { navigate('requests', { requestStatusFilter: 'approving' }); }}
          onOpenTarget={openNotificationTarget}
        />
      );
      break;
    case 'payment-workbench':
      pageContent = paymentDetailRecord ? (
        <PaymentProjectPaymentDetailPage
          record={paymentDetailRecord}
          payouts={payouts}
          contracts={contracts}
          invoices={generatedInvoices}
          creators={creators}
          canHandleFailure={canExecutePayouts}
          notify={notify}
          onBack={() => setPaymentDetailRequestId(null)}
          onReturnPayout={returnPayout}
          onOpenFailurePaymentList={(requestId, payoutId) => {
            const request = requestProjects.find((candidate) => candidate.paymentRequestProjectId === requestId);
            setPaymentDetailRequestId(null);
            setFocusedProjectId(request?.id ?? requestId);
            setFocusedPaymentFailurePayoutId(payoutId);
            setActivePage('projects');
          }}
        />
      ) : (
        <PaymentWorkbenchPage
          payouts={payouts}
          requests={requestProjects}
          generatedInvoices={generatedInvoices}
          paymentLists={paymentLists}
          contracts={contracts}
          creators={creators}
          initialTab={paymentWorkbenchInitialTab}
          onNewBatch={() => setActivePage('new-batch')}
          onSelectPayout={setSelectedPayout}
          onSelectPaidProject={(project) => {
            if (project.requestId) {
              setPaymentWorkbenchInitialTab('paid');
              setPaymentDetailRequestId(project.requestId);
              return;
            }
            const payout = project.payouts[0];
            if (payout) setSelectedPayout(payout);
          }}
          onReviewRequest={openFinanceReview}
          onExecuteRequest={executePaymentRequest}
          onReturnRequest={returnPaymentRequestToMedia}
          onOpenContract={(request, contractId) => requestResourceActions.onOpenContract(request, contractId)}
          onOpenInvoice={(request, invoiceId) => requestResourceActions.onOpenInvoice(request, invoiceId)}
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
  const selectedPayoutPaymentItem = selectedPayout
    ? findPaymentListItemForPayout(selectedPayout, generatedInvoices, paymentLists)
    : undefined;
  const selectedPayoutCreator = selectedPayout?.creatorId
    ? creators.find((creator) => creator.id === selectedPayout.creatorId)
    : undefined;
  const financeReviewRequest = financeReviewRequestId
    ? requestProjects.find((request) => request.id === financeReviewRequestId) ?? null
    : null;
  const activeFinanceReview = financeReviewRequest
    ? buildRequestFinanceReview(financeReviewRequest, generatedInvoices, paymentLists, contracts)
    : null;
  const activeFinanceSessionKey = financeReviewRequest?.approval
    ? financeReviewSessionKey(financeReviewRequest.id, financeReviewRequest.approval.round, currentUser.account)
    : null;

  const closeFinanceReview = (completed = false) => {
    setFinanceReviewRequestId(null);
    setFinanceReviewResourceRestore(null);
    if (!completed) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>('.tab-button[aria-selected="true"]')?.focus();
      });
    });
  };

  const finishPendingContractExit = (saveDraft: boolean) => {
    const pending = pendingContractExit;
    if (!pending) return;
    if (saveDraft && contractBuilderModel) saveContractDraft(contractBuilderModel);
    setPendingContractExit(null);
    setContractBuilderDirty(false);
    pending.run();
  };

  return (
    <AppShell
      activePage={activePage}
      onNavigate={navigate}
      currentUser={currentUser}
      notificationUnreadCount={notificationUnreadCount}
    >
      {pageContent}
      {financeReviewRequest && activeFinanceReview && activeFinanceSessionKey ? (
        <FinanceReviewWorkspace
          request={financeReviewRequest}
          financeReview={activeFinanceReview}
          generatedInvoices={generatedInvoices}
          contracts={contracts}
          paymentLists={paymentLists}
          creators={creators}
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
          onExportPaymentList={(paymentListId) => (
            requestResourceActions.onExportPaymentList(financeReviewRequest, paymentListId)
          )}
          onOpenContract={(contractId) => {
            setRequestResourceReturn({
              requestId: financeReviewRequest.id,
              resource: 'contract',
              source: 'finance-review',
              recordId: contractId,
            });
            closeFinanceReview(false);
            setFocusedContractId(contractId);
            setActivePage('contracts');
          }}
          onOpenInvoice={(invoiceId) => {
            const invoice = generatedInvoices.find((candidate) => candidate.invoiceId === invoiceId);
            if (!invoice) return;
            setRequestResourceReturn({
              requestId: financeReviewRequest.id,
              resource: 'invoice',
              source: 'finance-review',
              recordId: invoiceId,
            });
            closeFinanceReview(false);
            setFocusedInvoiceId(`generated:${invoice.id}`);
            setInvoiceTab('signature');
            setActivePage('invoice');
          }}
          initialResourceDialog={financeReviewResourceRestore?.requestId === financeReviewRequest.id
            ? financeReviewResourceRestore.resource
            : null}
          initialResourceRecordId={financeReviewResourceRestore?.requestId === financeReviewRequest.id
            ? financeReviewResourceRestore.recordId
            : null}
          onResourceRestoreConsumed={() => setFinanceReviewResourceRestore(null)}
          onClose={closeFinanceReview}
        />
      ) : null}
      {selectedPayout ? (
        <PayoutDrawer
          payout={selectedPayout}
          paymentItem={selectedPayoutPaymentItem}
          creator={selectedPayoutCreator}
          onClose={() => setSelectedPayout(null)}
          onAdvance={advancePayout}
          onPaymentFailed={failPayout}
          onReturn={returnPayout}
          onConfirmAccountChange={confirmPaymentFailureExecutionAccount}
          canExecutePayout={canExecutePayouts}
          canConfirmAccountChange={['finance', 'admin', 'owner'].includes(currentUser.roleKey)}
          contract={selectedPayoutContract}
          onViewContract={openContractFromPayout}
          onViewInvoice={openInvoiceFromPayout}
        />
      ) : null}
      <DraftExitDialog
        open={Boolean(pendingContractExit)}
        title="退出生成合同？"
        description="当前合同内容尚未保存，你可以保存到草稿箱后退出。"
        onDiscard={() => finishPendingContractExit(false)}
        onSave={() => finishPendingContractExit(true)}
        onContinue={() => setPendingContractExit(null)}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}
