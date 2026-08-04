import { useCallback, useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { PayoutDrawer } from './components/PayoutDrawer';
import { Toast } from './components/Common';
import {
  completeGeneratedContractUpload,
  createGeneratedContractDraft,
  createUploadedContract,
  INITIAL_CONTRACTS,
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
import { BatchWizardPage } from './pages/BatchWizardPage';
import { AuthPage } from './pages/AuthPage';
import { ContractsPage } from './pages/ContractsPage';
import { ContractBuilderPage } from './pages/ContractBuilderPage';
import { DashboardPage } from './pages/DashboardPage';
import { PaymentWorkbenchPage } from './pages/PaymentWorkbenchPage';
import { InvoiceBuilderPage } from './pages/InvoiceBuilderPage';
import { SystemSettingsPage } from './pages/SystemSettingsPage';
import {
  applyInvoiceReviewAction,
  getAvailableInvoiceReviewActions,
  getInvoicePageTab,
  invalidateSignedInvoice,
  invoiceStatusForRequestApproval,
  isInvoiceApprovedForPayment,
  isPayoutEligibleForBatch,
  markGeneratedInvoiceSigned,
  paymentFailureRestartStage,
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
  InvoiceEntity,
  NavPage,
  PaymentFailureIssueType,
  Payout,
  Provider,
  ToastState,
} from './types';
import {
  canEditProject,
  createAuditEvent,
  createPrototypeCode,
  createPrototypeId,
  hasInvoiceForEngagement,
  nextReviewStatusAfterMutation,
  nowIso,
  removePaymentListItem,
  upsertPaymentListItem,
  validateProjectSubmission,
  type EngagementId,
  type ContractId,
  type InvoiceId,
  type PaymentListItem,
  type PaymentListRecord,
  type ProjectId,
  type WorkflowAuditAction,
  type WorkflowAuditEvent,
} from './businessWorkflow';
import type { ProjectSummary } from './pages/ProjectDetailPage';
import type { RequestProjectSummary } from './pages/RequestProjectDetailPage';
import {
  PROJECT_DEMO_CONTRACTS,
  PROJECT_DEMO_INVOICES,
  PROJECT_DEMO_PAYOUTS,
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

const batchAmountLabel = (payouts: Payout[]) => {
  const totals = payouts.reduce<Record<string, number>>((result, payout) => ({
    ...result,
    [payout.currency]: (result[payout.currency] ?? 0) + payout.amount,
  }), {});
  return Object.entries(totals)
    .map(([currency, amount]) => `${currency} ${amount.toLocaleString('en-US')}`)
    .join(' + ');
};

const getProjectId = (project: ProjectSummary) => (
  (project.projectId ?? project.id) as ProjectId
);

const invoicePaymentListItem = (invoice: GeneratedInvoiceRecord): PaymentListItem => {
  const payment = invoice.snapshot.payment;
  const account = invoice.snapshot.paymentMethod === 'paypal'
    ? payment.paypalEmail || payment.paypalUsername || '待补充 PayPal'
    : (payment.iban || payment.accountNumber).replace(/\s/g, '');
  return {
    id: createPrototypeId('item'),
    engagementId: invoice.snapshot.engagementId as EngagementId,
    invoiceId: invoice.invoiceId,
    snapshot: {
      invoiceNumber: invoice.id,
      creatorName: invoice.snapshot.creatorName,
      currency: invoice.snapshot.currency,
      amount: invoice.snapshot.items.reduce((total, item) => total + item.lineTotal, 0),
      provider: invoice.snapshot.paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex',
      accountSummary: invoice.snapshot.paymentMethod === 'paypal'
        ? account
        : account ? `账户尾号 ${account.slice(-4)}` : '待补充银行账户',
    },
    overrides: {},
  };
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<SystemUser>(CURRENT_USER);
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [payouts, setPayouts] = useState<Payout[]>(() => [
    ...INITIAL_PAYOUTS,
    ...PROJECT_DEMO_PAYOUTS,
  ]);
  const [creators, setCreators] = useState<CreatorProfile[]>(INITIAL_CREATORS);
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [contracts, setContracts] = useState<ContractRecord[]>(() => [
    ...INITIAL_CONTRACTS,
    ...PROJECT_DEMO_CONTRACTS,
  ]);
  const [invoiceEntity, setInvoiceEntity] = useState<InvoiceEntity>(INITIAL_INVOICE_ENTITY);
  const [generatedInvoices, setGeneratedInvoices] = useState<GeneratedInvoiceRecord[]>(() => (
    PROJECT_DEMO_INVOICES
  ));
  const [paymentLists, setPaymentLists] = useState<PaymentListRecord[]>([]);
  const [workflowAuditEvents, setWorkflowAuditEvents] = useState<WorkflowAuditEvent[]>([]);
  const [requestProjects, setRequestProjects] = useState(INITIAL_REQUEST_PROJECTS);
  const [invoiceTab, setInvoiceTab] = useState<InvoicePageTab>('signature');
  const [focusedInvoiceId, setFocusedInvoiceId] = useState<string | null>(null);
  const [focusedContractId, setFocusedContractId] = useState<string | null>(null);
  const [contractGenerationEngagementId, setContractGenerationEngagementId] = useState<EngagementId | null>(null);
  const [invoiceCreationEngagementId, setInvoiceCreationEngagementId] = useState<EngagementId | null>(null);
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

  const generateContract = useCallback((model: ContractGenerationModel, pdfBlob: Blob) => {
    const version = contracts.filter((contract) => (
      contract.engagementId === model.engagementId
      && contract.lifecycle === 'GENERATED_DRAFT'
    )).length + 1;
    const record = createGeneratedContractDraft(model, version, URL.createObjectURL(pdfBlob));
    setContracts((current) => [record, ...current]);
    registerProjectMutation({
      projectId: model.projectId,
      engagementId: model.engagementId,
      entityType: 'contract',
      entityId: record.contractId ?? record.id,
      action: 'create',
      summary: `已生成合同草稿 ${record.id}`,
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
      return;
    }
    setActivePage(page);
    setFocusedInvoiceId(null);
    setFocusedContractId(null);
    setSelectedPayout(null);
  };

  const saveCreator = (updated: CreatorProfile) => {
    setCreators((current) => current.some((creator) => creator.id === updated.id)
      ? current.map((creator) => creator.id === updated.id ? updated : creator)
      : [updated, ...current]);
  };

  const addGeneratedInvoice = (record: GeneratedInvoiceRecord) => {
    if (!payouts.some((payout) => payout.id === record.sourcePayoutId)) {
      const creator = creators.find((item) => item.id === record.snapshot.creatorId);
      const project = projects.find((item) => getProjectId(item) === record.snapshot.projectId);
      const rawAccount = record.snapshot.paymentMethod === 'paypal'
        ? record.snapshot.payment.paypalEmail
        : record.snapshot.payment.iban || record.snapshot.payment.accountNumber;
      setPayouts((current) => [{
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
        status: '未进入付款',
        invoiceReviewStatus: '待签署',
        invoiceVersion: record.version ?? 1,
        invoiceSignatureRound: 0,
        invoiceSnapshot: record.snapshot,
        accent: creator?.accent ?? '#64748b',
      }, ...current]);
    }
    setGeneratedInvoices((current) => [
      { ...record, version: record.version ?? 1 },
      ...current.filter((item) => item.id !== record.id),
    ]);
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
    setInvoiceTab('signature');
    notify('Invoice 已生成', `${record.id} 的 PDF 与 DOCX 已准备完成，签名区域保持为空。`);
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

  const createPaymentList = (project: ProjectSummary) => {
    const projectId = getProjectId(project);
    if (paymentLists.some((list) => list.projectId === projectId)) return;
    const invoices = generatedInvoices.filter((invoice) => (
      invoice.snapshot.projectId === projectId && invoice.snapshot.engagementId
    ));
    const createdAt = nowIso();
    const list: PaymentListRecord = {
      paymentListId: createPrototypeId('payment-list') as PaymentListRecord['paymentListId'],
      paymentListCode: createPrototypeCode('PAY'),
      projectId,
      status: 'draft',
      items: invoices.map(invoicePaymentListItem),
      createdAt,
      updatedAt: createdAt,
    };
    setPaymentLists((current) => [list, ...current]);
    registerProjectMutation({
      projectId,
      entityType: 'payment-list',
      entityId: list.paymentListId,
      action: 'create',
      summary: `已生成付款清单 ${list.paymentListCode}`,
    });
  };

  const deletePaymentList = (project: ProjectSummary) => {
    const projectId = getProjectId(project);
    const list = paymentLists.find((item) => item.projectId === projectId);
    if (!list) return;
    setPaymentLists((current) => current.filter((item) => item.paymentListId !== list.paymentListId));
    registerProjectMutation({
      projectId,
      entityType: 'payment-list',
      entityId: list.paymentListId,
      action: 'delete',
      summary: `已删除付款清单 ${list.paymentListCode}`,
    });
  };

  const addPaymentInvoice = (project: ProjectSummary, invoiceId: InvoiceId) => {
    const projectId = getProjectId(project);
    const invoice = generatedInvoices.find((item) => item.invoiceId === invoiceId);
    if (!invoice?.snapshot.engagementId || invoice.snapshot.projectId !== projectId) return;
    setPaymentLists((current) => current.map((list) => (
      list.projectId === projectId ? upsertPaymentListItem(list, invoicePaymentListItem(invoice)) : list
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
    setPaymentLists((current) => current.map((list) => (
      list.projectId === projectId ? removePaymentListItem(list, invoiceId) : list
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
    field: 'currency' | 'amount' | 'provider' | 'accountSummary',
    value: string | number,
  ) => {
    const projectId = getProjectId(project);
    setPaymentLists((current) => current.map((list) => list.projectId === projectId
      ? {
          ...list,
          updatedAt: nowIso(),
          items: list.items.map((item) => item.invoiceId === invoiceId
            ? { ...item, overrides: { ...item.overrides, [field]: value } }
            : item),
        }
      : list));
    registerProjectMutation({
      projectId,
      entityType: 'payment-list',
      entityId: invoiceId,
      action: 'update',
      summary: '已修改付款清单字段并保留 Invoice 原始快照',
    });
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
    const list = paymentLists.find((item) => item.projectId === projectId);
    const linkedPayouts = projectInvoices.map((invoice) => (
      payouts.find((payout) => payout.id === invoice.sourcePayoutId)
    ));
    if (
      linkedPayouts.some((payout) => !payout)
      || linkedPayouts.some((payout) => payout?.invoiceReviewStatus !== '待发起请款')
    ) {
      notify('暂不能发起请款', '项目内全部 Invoice 必须先完成达人签署和媒介审核。');
      return;
    }
    const submissionIssues = validateProjectSubmission({
      engagementIds: references.map((reference) => reference.engagementId),
      invoices: projectInvoices.map((invoice) => ({
        invoiceId: invoice.invoiceId,
        engagementId: invoice.snapshot.engagementId as EngagementId | undefined,
        validationStatus: invoice.validationStatus,
      })),
      paymentListInvoiceIds: list?.items.map((item) => item.invoiceId) ?? null,
    });
    if (submissionIssues.length) {
      notify(
        '暂不能提交审核',
        submissionIssues.includes('NO_ENGAGEMENT')
          ? '项目至少需要一位达人。'
          : submissionIssues.includes('INVOICE_COUNT')
            ? '每位项目达人必须有且仅有一份 Invoice。'
            : submissionIssues.includes('PAYMENT_LIST_MISSING')
              ? '付款清单必须包含项目内全部 Invoice。'
              : '存在需要重新校验的 Invoice。',
      );
      return;
    }
    const submittedAt = nowIso();
    const previousRequest = requestProjects.find((item) => item.projectId === projectId);
    const approval = createRequestApprovalState(submittedAt, previousRequest?.approval);
    const approvalInvoiceStatus = invoiceStatusForRequestApproval('PENDING_PM');
    const invoiceIds = projectInvoices.map((invoice) => invoice.invoiceId);
    const sourcePayoutIds = new Set(projectInvoices.map((invoice) => invoice.sourcePayoutId));
    setProjects((current) => current.map((item) => getProjectId(item) === projectId
      ? { ...item, reviewStatus: 'submitted', submittedAt, reviewUpdatedAt: submittedAt, status: '待审批' }
      : item));
    setPaymentLists((current) => current.map((item) => item.projectId === projectId
      ? { ...item, status: 'submitted', updatedAt: submittedAt }
      : item));
    setPayouts((current) => current.map((payout) => sourcePayoutIds.has(payout.id)
      ? {
          ...payout,
          status: '未进入付款',
          invoiceReviewStatus: approvalInvoiceStatus,
          requestApprovalRound: approval.round,
          paymentListVersion: list?.version ?? 1,
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
        }
      : payout));
    setGeneratedInvoices((current) => current.map((invoice) => (
      invoiceIds.includes(invoice.invoiceId)
        ? { ...invoice, status: approvalInvoiceStatus }
        : invoice
    )));
    const requestId = previousRequest?.id ?? createPrototypeCode('REQ');
    const requestAmount = list!.items.reduce<Record<string, number>>((result, item) => {
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
      paymentListId: list!.paymentListId,
      approval,
      project: project.name,
      brand: project.brand,
      media: project.media,
      pm: project.pm,
      amount: amountLabel,
      contracts: contracts.filter((contract) => contract.projectId === projectId && contract.lifecycle !== 'GENERATED_DRAFT').length,
      invoices: projectInvoices.length,
      paymentOrder: list!.paymentListCode,
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
        paymentListId: list!.paymentListCode,
        paymentListStatus: '已提交',
        payee: `${references.length} 位项目达人`,
        provider: Array.from(new Set(list!.items.map((item) => String(item.overrides.provider ?? item.snapshot.provider)))).join('、'),
        beneficiaryId: '按付款清单账户快照',
        feePolicy: '按合同及付款清单执行',
      },
    };
    setRequestProjects((current) => [
      request,
      ...current.filter((item) => item.id !== request.id && item.projectId !== projectId),
    ]);
    appendReviewAudit(project, 'submit', `已提交第 ${approval.round} 轮项目请款审批并锁定项目资料`);
    notify('已提交项目请款', `${project.name} 已进入第 ${approval.round} 轮 PM 审批。`);
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
    setPayouts((current) => current.map((item) => item.id === payout.id ? updated : item));
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
    setSelectedPayout((current) => current?.id === payout.id ? updated : current);
    notify(
      '已退回媒介',
      issueType === 'INVOICE_CONTENT'
        ? '该 Invoice 重新发起后将从达人签署开始。'
        : '该 Invoice 重新发起后将从媒介复核开始，无需达人重新签署。',
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
      const isPaymentRestart = action === 'RESTART_AFTER_PAYMENT_FAILURE';
      const restartIssueType = payout.paymentFailureReturn?.issueType;
      const restartProject = isPaymentRestart
        ? projects.find((item) => item.id === payout.projectId)
        : undefined;
      const restartProjectId = restartProject ? getProjectId(restartProject) : undefined;
      const nextPaymentListVersion = restartProjectId
        ? (paymentLists.find((list) => list.projectId === restartProjectId)?.version ?? 1) + 1
        : undefined;
      const relatedPayoutIds = new Set(
        payouts.filter((item) => item.projectId === payout.projectId).map((item) => item.id),
      );
      setPayouts((current) => current.map((item) => {
        if (item.id === payout.id) {
          return isPaymentRestart
            ? { ...updated, paymentListVersion: nextPaymentListVersion ?? item.paymentListVersion }
            : updated;
        }
        if (!isPaymentRestart || !relatedPayoutIds.has(item.id)) return item;
        return {
          ...item,
          status: '未进入付款',
          invoiceReviewStatus: restartIssueType === 'PAYMENT_LIST' ? '待媒介复核' : '待发起请款',
          paymentListVersion: nextPaymentListVersion ?? item.paymentListVersion,
          issue: restartIssueType === 'PAYMENT_LIST' ? '付款清单问题待媒介复核' : undefined,
        };
      }));
      setGeneratedInvoices((current) => current.map((record) => (
        record.sourcePayoutId === payout.id
          ? { ...record, status: updated.invoiceReviewStatus }
          : isPaymentRestart && relatedPayoutIds.has(record.sourcePayoutId)
            ? {
                ...record,
                status: restartIssueType === 'PAYMENT_LIST' ? '待媒介复核' : '待发起请款',
              }
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
      if (isPaymentRestart) {
        setProjects((current) => current.map((item) => item.id === payout.projectId
          ? {
              ...item,
              reviewStatus: 'returned',
              status: updated.invoiceReviewStatus === '待签署' ? '待重新签署' : '待媒介复核',
              reviewUpdatedAt: nowIso(),
            }
          : item));
        if (restartProjectId) {
          setPaymentLists((current) => current.map((list) => list.projectId === restartProjectId
            ? {
                ...list,
                status: 'draft',
                version: nextPaymentListVersion,
                updatedAt: nowIso(),
              }
            : list));
          setRequestProjects((current) => current.map((request) => request.projectId === restartProjectId
            ? {
                ...request,
                status: updated.invoiceReviewStatus === '待签署' ? '待重新签署' : '待媒介复核',
                filter: 'pending',
                approval: request.approval
                  ? {
                      ...request.approval,
                      status: 'RETURNED_TO_MEDIA_REVIEW',
                      returnReason: payout.paymentFailureReturn?.reason,
                      updatedAt: nowIso(),
                    }
                  : request.approval,
              }
            : request));
        }
      }
      notify('Invoice 审核状态已更新', `${payout.invoice} 已进入“${updated.invoiceReviewStatus}”。`);
    } catch (error) {
      notify('状态更新失败', error instanceof Error ? error.message : '当前 Invoice 无法执行该操作。');
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

  const createBatch = (selected: Payout[], provider: Provider) => {
    const ineligible = selected.filter((payout) => !isPayoutEligibleForBatch(payout));
    if (ineligible.length > 0) {
      notify('无法创建付款批次', '仅 Invoice 审核已通过且处于等待付款的记录可以进入付款批次。');
      return;
    }
    setPayouts((current) => current.map((payout) => selected.some((item) => item.id === payout.id)
      ? { ...payout, status: '等待付款', issue: undefined }
      : payout));
    setCreatedBatch({
      id: 'BAT-20260717-008',
      count: selected.length,
      amount: batchAmountLabel(selected),
      provider,
    });
    setActivePage('batches');
    notify('付款批次已创建', `${selected.length} 笔付款已提交至 ${provider} 执行队列。`);
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
          onSubmitProjectReview={submitProjectReview}
          onProjectsChange={setProjects}
          canCreateProject={canManageProjects && ['media', 'admin', 'owner'].includes(currentUser.roleKey)}
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
          onGenerated={(model, pdfBlob) => {
            const record = generateContract(model, pdfBlob);
            notify('合同草稿已生成', `${record.id} 已关联 ${model.projectName} / ${model.creatorName}，等待线下签署文件回传。`);
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
      pageContent = <CreatorsPage notify={notify} creators={creators} onSaveCreator={saveCreator} canEdit={canManageCreators} />;
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
          canCreateInvoice={canGenerateInvoices}
          canManageInvoice={canGenerateInvoices}
          canReviewMedia={canReviewInvoiceMedia}
          canReviewFinance={canReviewInvoiceFinance}
          focusedInvoiceId={focusedInvoiceId}
          onFocusCleared={() => setFocusedInvoiceId(null)}
          onMarkSigned={markInvoiceSigned}
          onReviewAction={updateInvoiceReview}
          notify={notify}
        />
      );
      break;
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
    case 'batches':
      pageContent = <BatchesPage createdBatch={createdBatch} onNewBatch={() => setActivePage('new-batch')} notify={notify} canCreateBatch={canExecutePayouts} />;
      break;
    case 'new-batch':
      pageContent = (
        <BatchWizardPage
          payouts={payouts.filter(isPayoutEligibleForBatch).slice(0, 4)}
          creators={creators}
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
