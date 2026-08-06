import { useCallback, useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { PayoutDrawer } from './components/PayoutDrawer';
import { Toast } from './components/Common';
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
import { canAccessPage, getDefaultPageForRole, hasPermission } from './permissions';
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
  invalidateSignedInvoice,
  invoiceStatusForRequestApproval,
  isInvoiceApprovedForPayment,
  isPayoutEligibleForBatch,
  markGeneratedInvoiceSigned,
  paymentFailureRestartStage,
  replyToCreatorFeedback,
  sensitiveInvoiceSnapshotChanged,
  type InvoiceReviewAction,
  type InvoicePageTab,
} from './invoice/invoiceReviewWorkflow';
import {
  BatchesPage,
  ChannelsPage,
  CollaborationsPage,
  CreatorsPage,
  InvoicePage,
  INITIAL_CREATORS,
  INITIAL_PROJECTS,
  INITIAL_REQUEST_PROJECTS,
  NotificationsPage,
  OrganizationPage,
  ProjectsPage,
  RequestsPage,
  TransactionsPage,
} from './pages/OperationalPages';
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
  beginPaymentListEdit,
  canEditProject,
  createAuditEvent,
  createPrototypeCode,
  createPrototypeId,
  hasInvoiceForEngagement,
  generatePaymentListVersion,
  invoicePaymentListItem,
  invoicePaymentListProvider,
  nextReviewStatusAfterMutation,
  nowIso,
  payoutWithPaymentListSnapshot,
  revalidatePaymentListItem,
  refreshPaymentListItemSnapshot,
  removePaymentListItem,
  upsertPaymentListItem,
  validateProjectSubmission,
  type EngagementId,
  type ContractId,
  type InvoiceId,
  type PaymentListItem,
  type PaymentListEditableField,
  type PaymentListRecord,
  type ProjectId,
  type WorkflowAuditAction,
  type WorkflowAuditEvent,
} from './businessWorkflow';
import { downloadBlob } from './invoice/invoiceUtils';
import {
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
  ALL_PROJECT_PROTOTYPE_INVOICES,
  ALL_PROJECT_PROTOTYPE_PAYMENT_LISTS,
  ALL_PROJECT_PROTOTYPE_PAYOUTS,
  PROJECT_DEMO_CONTRACTS,
} from './prototypeResourceFixtures';
import {
  applyRequestApprovalAction,
  canReviewRequestApproval,
  createRequestApprovalState,
  REQUEST_APPROVAL_STATUS_LABEL,
  requestApprovalStage,
  type RequestApprovalAction,
} from './requestApprovalWorkflow';

type CreatedBatch = { id: string; count: number; amount: string; provider: string } | null;

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
  (project.projectId ?? project.id) as ProjectId
);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<SystemUser>(CURRENT_USER);
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [payouts, setPayouts] = useState<Payout[]>(() => [
    ...INITIAL_PAYOUTS,
    ...ALL_PROJECT_PROTOTYPE_PAYOUTS,
  ]);
  const [creators, setCreators] = useState<CreatorProfile[]>(INITIAL_CREATORS);
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [contracts, setContracts] = useState<ContractRecord[]>(() => [
    ...INITIAL_CONTRACTS,
    ...PROJECT_DEMO_CONTRACTS,
  ]);
  const [invoiceEntity, setInvoiceEntity] = useState<InvoiceEntity>(INITIAL_INVOICE_ENTITY);
  const [generatedInvoices, setGeneratedInvoices] = useState<GeneratedInvoiceRecord[]>(() => (
    [...ALL_PROJECT_PROTOTYPE_INVOICES]
  ));
  const [paymentLists, setPaymentLists] = useState<PaymentListRecord[]>(() => (
    ALL_PROJECT_PROTOTYPE_PAYMENT_LISTS
  ));
  const [workflowAuditEvents, setWorkflowAuditEvents] = useState<WorkflowAuditEvent[]>([]);
  const [requestProjects, setRequestProjects] = useState(INITIAL_REQUEST_PROJECTS);
  const [invoiceTab, setInvoiceTab] = useState<InvoicePageTab>('signature');
  const [focusedInvoiceId, setFocusedInvoiceId] = useState<string | null>(null);
  const [focusedContractId, setFocusedContractId] = useState<string | null>(null);
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [focusedRequestId, setFocusedRequestId] = useState<string | null>(null);
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

  const notify = useCallback((title: string, message: string) => {
    setToast({ title, message });
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

  const uploadContract = useCallback((input: ContractUploadInput) => {
    const draft = input.draftContractId
      ? contracts.find((contract) => contract.contractId === input.draftContractId)
      : null;
    const record = draft
      ? completeGeneratedContractUpload(draft, input)
      : createUploadedContract(input);
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
  }, [contracts, registerProjectMutation]);

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
    const project = projects.find((item) => getProjectId(item) === updated.projectId);
    if (project && !canEditProject(currentUser, project.reviewStatus ?? 'draft')) {
      notify('项目资料已锁定', '当前账号不能修改已提交或已通过项目的合同。');
      return;
    }
    setContracts((current) => current.map((contract) => contract.id === updated.id ? updated : contract));
    if (updated.projectId) {
      registerProjectMutation({
        projectId: updated.projectId as ProjectId,
        engagementId: updated.engagementId,
        entityType: 'contract',
        entityId: updated.contractId ?? updated.id,
        action: 'update',
        summary: `已更新合同 ${updated.id}`,
      });
    }
  }, [currentUser, notify, projects, registerProjectMutation]);

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
      const project = projects.find((item) => getProjectId(item) === record.snapshot.projectId);
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
        projectId: project?.id ?? String(record.snapshot.projectId),
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

  const updateGeneratedInvoice = (updated: GeneratedInvoiceRecord) => {
    const previous = generatedInvoices.find((invoice) => invoice.invoiceId === updated.invoiceId);
    const linkedPayout = previous
      ? payouts.find((payout) => payout.id === previous.sourcePayoutId)
      : undefined;
    const invalidatesSignature = Boolean(
      previous
      && linkedPayout
      && linkedPayout.invoiceReviewStatus === '待媒介复核'
      && sensitiveInvoiceSnapshotChanged(previous, updated),
    );
    const nextPayout = invalidatesSignature && linkedPayout
      ? invalidateSignedInvoice(
          { ...linkedPayout, invoiceSnapshot: updated.snapshot },
          { account: currentUser.account, name: currentUser.name, role: currentUser.role },
        )
      : linkedPayout
        ? { ...linkedPayout, invoiceSnapshot: updated.snapshot }
        : undefined;
    setGeneratedInvoices((current) => current.map((invoice) => (
      invoice.invoiceId === updated.invoiceId
        ? {
            ...updated,
            version: invalidatesSignature ? (invoice.version ?? 1) + 1 : invoice.version,
            status: nextPayout?.invoiceReviewStatus ?? updated.status,
          }
        : invoice
    )));
    if (nextPayout) {
      setPayouts((current) => current.map((payout) => (
        payout.id === nextPayout.id ? nextPayout : payout
      )));
    }
    if (updated.snapshot.projectId) {
      registerProjectMutation({
        projectId: updated.snapshot.projectId as ProjectId,
        engagementId: updated.snapshot.engagementId as EngagementId | undefined,
        entityType: 'invoice',
        entityId: updated.invoiceId,
        action: 'update',
        summary: invalidatesSignature
          ? `已更新 Invoice ${updated.id} 的签署敏感字段，原签署失效`
          : `已更新 Invoice ${updated.id}，等待重新校验`,
      });
    }
    if (invalidatesSignature) {
      notify('需重新签署', '已修改主体、金额、币种、付款方式、收款账户、费用明细或合同关联，原签署已失效。');
    }
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
    });
    if (allowedContext !== invoiceEditTarget.context) {
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
    setPaymentLists((current) => {
      const sourceList = current.find((list) => (
        list.projectId === projectId
        && list.items.some((item) => item.invoiceId === result.record.invoiceId)
      ));
      if (!sourceList) return current;
      const nextProvider = invoicePaymentListProvider(result.record);
      if (sourceList.provider === nextProvider) {
        return current.map((list) => list.paymentListId === sourceList.paymentListId
          ? { ...refreshPaymentListItemSnapshot(list, refreshedPaymentItem), status: 'draft' }
          : list);
      }
      const previousItem = sourceList.items.find((item) => item.invoiceId === result.record.invoiceId);
      const movedItem: PaymentListItem = {
        ...refreshedPaymentItem,
        overrides: { ...(previousItem?.overrides ?? {}) },
        requiresRevalidation: true,
        validationIssues: ['Invoice 支付渠道或账户已变化，请重新校验'],
      };
      const targetList = current.find((list) => (
        list.projectId === projectId && list.provider === nextProvider
      ));
      const withoutSource = current.flatMap((list) => {
        if (list.paymentListId !== sourceList.paymentListId) return [list];
        const updated = removePaymentListItem(list, result.record.invoiceId);
        return updated.items.length ? [{ ...updated, status: 'draft' as const }] : [];
      });
      if (targetList) {
        return withoutSource.map((list) => list.paymentListId === targetList.paymentListId
          ? { ...upsertPaymentListItem(list, movedItem), status: 'draft' }
          : list);
      }
      const providerCode = nextProvider === 'Airwallex' ? 'AWX' : 'PPL';
      const createdAt = nowIso();
      return [{
        paymentListId: createPrototypeId('payment-list') as PaymentListRecord['paymentListId'],
        paymentListCode: `${createPrototypeCode('PAY')}-${providerCode}`,
        projectId,
        provider: nextProvider,
        status: 'draft',
        items: [movedItem],
        createdAt,
        updatedAt: createdAt,
      }, ...withoutSource];
    });
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
    setRequestProjects((current) => current.map((request) => (
      request.projectId === projectId
        ? {
            ...request,
            status: '待重新签署',
            filter: 'pending',
            approval: request.approval
              ? {
                  ...request.approval,
                  status: 'RETURNED_TO_MEDIA_REVIEW',
                  returnReason: 'Invoice 文件内容已生成新版本，原签署失效。',
                  updatedAt: nowIso(),
                }
              : request.approval,
          }
        : request
    )));
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
    setFocusedInvoiceId(`generated:${result.record.id}`);
    setInvoiceTab('signature');
    setActivePage('invoice');
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
    const existingProviders = new Set(
      paymentLists.filter((list) => list.projectId === projectId).map((list) => list.provider),
    );
    const providers = Array.from(new Set(invoices.map(invoicePaymentListProvider)));
    const lists = providers.flatMap((provider) => {
      if (existingProviders.has(provider)) return [];
      const providerCode = provider === 'Airwallex' ? 'AWX' : 'PPL';
      return [{
        paymentListId: createPrototypeId('payment-list') as PaymentListRecord['paymentListId'],
        paymentListCode: `${createPrototypeCode('PAY')}-${providerCode}`,
        projectId,
        provider,
        status: 'draft' as const,
        items: invoices
          .filter((invoice) => invoicePaymentListProvider(invoice) === provider)
          .map((invoice) => invoicePaymentListItem(invoice, contracts)),
        createdAt,
        updatedAt: createdAt,
      }];
    });
    if (!lists.length) {
      notify(
        invoices.length ? '渠道付款清单已存在' : '尚无可加入付款清单的 Invoice',
        invoices.length
          ? '当前项目的 Invoice 已按支付渠道分配到对应付款清单。'
          : '请先为项目达人生成包含付款账户的 Invoice。',
      );
      return;
    }
    setPaymentLists((current) => [...lists, ...current]);
    lists.forEach((list) => registerProjectMutation({
      projectId,
      entityType: 'payment-list',
      entityId: list.paymentListId,
      action: 'create',
      summary: `已创建 ${list.provider} 付款清单草稿 ${list.paymentListCode}`,
    }));
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
    if (invoicePaymentListProvider(invoice) !== list?.provider) {
      notify('支付渠道不一致', `该付款清单只能添加 ${list?.provider ?? '当前'} 渠道的 Invoice。`);
      return;
    }
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
    const creator = creators.find((candidate) => candidate.id === currentItem.snapshot.creatorId);
    const account = creator?.payoutAccounts.find((candidate) => (
      getPayoutAccountId(candidate) === currentItem.snapshot.payoutAccountId
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
        && invoicePaymentListProvider(invoice) === list.provider
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
      if (candidate.paymentListId === list.paymentListId) return updated;
      if (
        historicalStatus
        && candidate.projectId === projectId
        && ['submitted', 'approved', 'paid'].includes(candidate.status)
      ) {
        return { ...candidate, status: 'generated', updatedAt: nowIso() };
      }
      return candidate;
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
    if (list.provider !== 'Airwallex') {
      notify('当前渠道没有可用模板', '现有 Excel 模板仅用于 Airwallex；PayPal 付款清单不会导出为 Airwallex 格式。');
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
      notify('请先生成全部渠道付款单', '每个支付渠道的付款清单都必须完成校验并生成锁定版本后，才能提交请款审核。');
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
              ? '全部渠道付款清单合计必须包含项目内全部 Invoice。'
              : '存在需要重新校验的 Invoice。',
      );
      return;
    }
    const submittedAt = nowIso();
    const previousRequest = requestProjects.find((item) => item.projectId === projectId);
    const approval = createRequestApprovalState(submittedAt, previousRequest?.approval);
    const approvalInvoiceStatus = invoiceStatusForRequestApproval('PENDING_PM');
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
          invoiceReviewStatus: approvalInvoiceStatus,
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
              toStatus: approvalInvoiceStatus,
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
    setGeneratedInvoices((current) => current.map((invoice) => (
      invoiceIds.includes(invoice.invoiceId)
        ? { ...invoice, status: approvalInvoiceStatus }
        : invoice
    )));
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
      project: project.name,
      brand: project.brand,
      media: project.media,
      pm: project.pm,
      amount: amountLabel,
      contracts: contracts.filter((contract) => contract.projectId === projectId && contract.lifecycle !== 'GENERATED_DRAFT').length,
      invoices: projectInvoices.length,
      paymentOrder: lists.map((list) => list.paymentListCode).join('、'),
      status: REQUEST_APPROVAL_STATUS_LABEL[approval.status],
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
      `${project.name} 已进入第 ${approval.round} 轮 PM 审批。Invoice 签署版本保持不变。`,
    );
  };

  const handleRequestApproval = (
    request: RequestProjectSummary,
    action: RequestApprovalAction,
    reason?: string,
  ) => {
    if (!request.approval || !canReviewRequestApproval(currentUser, request.approval, request.pm)) {
      notify('暂无审批权限', '当前账号不是该请款当前节点的审批人，不能越级处理。');
      return;
    }
    const currentStage = requestApprovalStage(request.approval.status);
    if (!currentStage) {
      notify('当前状态不可审批', '该请款已结束当前审批轮次。');
      return;
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
      const nextInvoiceStatus = isReturned
        ? '待媒介复核'
        : invoiceStatusForRequestApproval(nextApproval.status as Exclude<
            typeof nextApproval.status,
            'RETURNED_TO_MEDIA_REVIEW'
          >);
      setPayouts((current) => current.map((payout) => {
        if (!sourcePayoutIds.has(payout.id)) return payout;
        return {
          ...payout,
          status: isApproved ? '等待付款' : '未进入付款',
          invoiceReviewStatus: nextInvoiceStatus,
          invoiceReviewHistory: [
            ...(payout.invoiceReviewHistory ?? []),
            {
              stage: currentStage,
              action: action === 'APPROVE' ? '审核通过' : '退回',
              actorAccount: currentUser.account,
              actorName: currentUser.name,
              actorRole: currentUser.role,
              fromStatus: payout.invoiceReviewStatus,
              toStatus: nextInvoiceStatus,
              reason: reason?.trim(),
              occurredAt,
              approvalRound: nextApproval.round,
            },
          ],
          invoiceReviewReturn: isReturned
            ? {
                stage: currentStage,
                reason: reason?.trim() ?? '',
                actorName: currentUser.name,
                occurredAt,
              }
            : undefined,
          issue: isReturned ? `项目审批退回：${reason?.trim()}` : undefined,
          returnReason: isReturned ? reason?.trim() : undefined,
        };
      }));
      setGeneratedInvoices((current) => current.map((invoice) => (
        sourcePayoutIds.has(invoice.sourcePayoutId)
          ? { ...invoice, status: nextInvoiceStatus }
          : invoice
      )));
      setRequestProjects((current) => current.map((item) => item.id === request.id
        ? {
            ...item,
            approval: nextApproval,
            status: REQUEST_APPROVAL_STATUS_LABEL[nextApproval.status],
            filter: isApproved ? 'processed' : 'pending',
            generatedDetail: item.generatedDetail
              ? {
                  ...item.generatedDetail,
                  invoiceStatus: isApproved ? '已通过' : isReturned ? '待媒介复核' : REQUEST_APPROVAL_STATUS_LABEL[nextApproval.status],
                  paymentListStatus: isApproved ? '已批准' : isReturned ? '草稿' : '审批中',
                }
              : item.generatedDetail,
          }
        : item));
      if (request.projectId) {
        setProjects((current) => current.map((project) => getProjectId(project) === request.projectId
          ? {
              ...project,
              reviewStatus: isApproved ? 'approved' : isReturned ? 'returned' : 'submitted',
              reviewUpdatedAt: occurredAt,
              returnedAt: isReturned ? occurredAt : project.returnedAt,
              status: isApproved
                ? '已通过'
                : isReturned
                  ? '待媒介复核'
                  : REQUEST_APPROVAL_STATUS_LABEL[nextApproval.status],
            }
          : project));
        setPaymentLists((current) => current.map((list) => list.projectId === request.projectId
          ? {
              ...list,
              status: isApproved ? 'approved' : isReturned ? 'draft' : 'submitted',
              updatedAt: occurredAt,
            }
          : list));
      }
      appendReviewAudit(
        (projects.find((project) => getProjectId(project) === request.projectId)
          ?? { id: request.id } as ProjectSummary),
        isReturned ? 'return' : isApproved ? 'approve' : 'approve',
        isReturned
          ? `第 ${nextApproval.round} 轮审批在${REQUEST_APPROVAL_STATUS_LABEL[request.approval.status]}退回媒介复核`
          : `${REQUEST_APPROVAL_STATUS_LABEL[request.approval.status]}已通过`,
      );
      notify(
        isReturned ? '已退回媒介复核' : isApproved ? '财务审批已通过' : '审批已通过',
        isReturned
          ? '该轮全部 Invoice 已进入“待媒介审核 / 待复核”，付款入口继续锁定。'
          : isApproved
            ? '项目请款与关联 Invoice 已通过，付款入口已解锁。'
            : `请款已进入“${REQUEST_APPROVAL_STATUS_LABEL[nextApproval.status]}”。`,
      );
    } catch (error) {
      notify('审批操作失败', error instanceof Error ? error.message : '当前节点无法执行该操作。');
    }
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
    const allProjectPaymentsCompleted = nextStatus === '已付款'
      && payouts
        .filter((item) => item.projectId === payout.projectId)
        .every((item) => item.id === payout.id || item.status === '已付款');
    setPayouts((current) => current.map((item) => item.id === payout.id ? updated : item));
    if (allProjectPaymentsCompleted) {
      const project = projects.find((item) => item.id === payout.projectId);
      if (project) {
        const projectId = getProjectId(project);
        setPaymentLists((current) => current.map((list) => list.projectId === projectId
          ? { ...list, status: 'paid', updatedAt: nowIso() }
          : list));
      }
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
          && list.provider === (payout.provider === 'PayPal' ? 'PayPal' : 'Airwallex')
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
      setInvoiceTab('media-review');
      setFocusedInvoiceId(linkedPayout.id);
      notify('已提交媒介审核', `${record.id} 已标记签署完成，当前状态为“待媒介审核”。`);
    } catch (error) {
      notify('提交失败', error instanceof Error ? error.message : '当前 Invoice 无法提交审核。');
    }
  };

  const openInvoiceFromPayout = (payout: Payout) => {
    setInvoiceTab(getInvoicePageTab(payout.invoiceReviewStatus));
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
    const project = projects.find((item) => getProjectId(item) === payout.projectId);
    if (!project) {
      notify('未找到关联项目', '该 Invoice 缺少可用的稳定 projectId 关联。');
      return;
    }
    setFocusedProjectId(project.id);
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
    setPayouts((current) => current.map((payout) => selected.some((item) => item.id === payout.id)
      ? { ...payout, status: '付款处理中', issue: undefined }
      : payout));
    setCreatedBatch({
      id: execution.batchCode,
      count: selected.length,
      amount: batchAmountLabel(execution.items),
      provider: execution.provider,
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
  const canManageProjects = hasPermission(currentUser, 'project_manage');
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
        <ProjectsPage
          notify={notify}
          creators={creators}
          currentUser={currentUser}
          projects={projects}
          contracts={contracts}
          generatedInvoices={generatedInvoices}
          paymentLists={paymentLists}
          auditEvents={workflowAuditEvents}
          onOpenContract={(contractId) => {
            setFocusedContractId(contractId);
            setActivePage('contracts');
          }}
          onOpenInvoice={(invoiceId) => {
            const invoice = generatedInvoices.find((item) => item.invoiceId === invoiceId);
            if (!invoice) return;
            setFocusedInvoiceId(`generated:${invoice.id}`);
            setInvoiceTab('signature');
            setActivePage('invoice');
          }}
          onCreateContract={(engagementId) => {
            setContractGenerationEngagementId(engagementId);
            setActivePage('contract-create');
          }}
          onCreateInvoice={(engagementId) => {
            setInvoiceCreationEngagementId(engagementId);
            setActivePage('invoice-create');
          }}
          onLinkContract={linkContractToEngagement}
          onUnlinkContract={unlinkContract}
          onDeleteContract={deleteContract}
          onLinkInvoice={linkInvoiceToEngagement}
          onUnlinkInvoice={unlinkInvoice}
          onDeleteInvoice={deleteInvoice}
          onUpdateInvoice={updateGeneratedInvoice}
          onCreatePaymentList={createPaymentList}
          onDeletePaymentList={deletePaymentList}
          onAddPaymentInvoice={addPaymentInvoice}
          onRemovePaymentInvoice={removePaymentInvoice}
          onUpdatePaymentItem={updatePaymentItem}
          onRevalidatePaymentItem={revalidatePaymentItem}
          onGeneratePaymentOrder={generatePaymentOrder}
          onEditPaymentOrder={editPaymentOrder}
          onExportPaymentList={exportPaymentList}
          onSubmitProjectReview={submitProjectReview}
          onProjectsChange={setProjects}
          canCreateProject={canManageProjects && ['media', 'admin', 'owner'].includes(currentUser.roleKey)}
          focusedProjectId={focusedProjectId}
          onFocusCleared={() => setFocusedProjectId(null)}
        />
      );
      break;
    case 'requests':
      pageContent = (
        <RequestsPage
          notify={notify}
          contracts={contracts}
          currentUser={currentUser}
          requests={requestProjects}
          onRequestCreated={(request) => setRequestProjects((current) => [request, ...current])}
          onApprovalAction={handleRequestApproval}
          canCreateRequest={false}
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
          projects={projects.filter((project) => canEditProject(currentUser, project.reviewStatus ?? 'draft'))}
          creators={creators}
          canUpload={canUploadContracts}
          focusedContractId={focusedContractId}
          onFocusCleared={() => setFocusedContractId(null)}
          onUploadContract={uploadContract}
          onCreateContract={() => {
            setContractGenerationEngagementId(null);
            setActivePage('contract-create');
          }}
          onUpdateContract={updateContract}
        />
      );
      break;
    case 'contract-create':
      pageContent = (
        <ContractBuilderPage
          projects={projects.filter((project) => canEditProject(currentUser, project.reviewStatus ?? 'draft'))}
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
            setActivePage('contracts');
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
          initialCreatorId={focusedCreatorId}
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
          tab={invoiceTab}
          onTabChange={setInvoiceTab}
          onCreateInvoice={() => setActivePage('invoice-create')}
          onCreateBatchInvoice={() => setActivePage('invoice-batch-create')}
          canCreateInvoice={canGenerateInvoices}
          canManageInvoice={canGenerateInvoices}
          canReviewMedia={canReviewInvoiceMedia}
          canReviewFinance={canReviewInvoiceFinance}
          focusedInvoiceId={focusedInvoiceId}
          onFocusCleared={() => setFocusedInvoiceId(null)}
          onMarkSigned={markInvoiceSigned}
          onReviewAction={updateInvoiceReview}
          onReplyFeedback={replyInvoiceFeedback}
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
            setFocusedInvoiceId(`generated:${editRecord.id}`);
            setInvoiceTab(getInvoicePageTab(editPayout.invoiceReviewStatus));
            setActivePage('invoice');
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
          projects={projects.filter((project) => canEditProject(currentUser, project.reviewStatus ?? 'draft'))}
          contracts={contracts}
          invoiceEntity={invoiceEntity}
          generatedInvoices={generatedInvoices}
          onGenerated={(record) => {
            addGeneratedInvoice(record);
            setInvoiceCreationEngagementId(null);
          }}
          onCancel={() => {
            setInvoiceCreationEngagementId(null);
            setActivePage('invoice');
          }}
          onOpenInvoiceManagement={() => {
            setInvoiceCreationEngagementId(null);
            setInvoiceTab('signature');
            setActivePage('invoice');
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
          projects={projects.filter((project) => (
            currentUser.roleKey === 'admin'
            || currentUser.roleKey === 'owner'
            || project.media === currentUser.name
          ))}
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
          onNewBatch={() => setActivePage('new-batch')}
          onSelectPayout={setSelectedPayout}
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

  return (
    <AppShell activePage={activePage} onNavigate={navigate} currentUser={currentUser}>
      {pageContent}
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
