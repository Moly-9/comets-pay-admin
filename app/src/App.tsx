import { useCallback, useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { PayoutDrawer } from './components/PayoutDrawer';
import { Toast } from './components/Common';
import { createUploadedContract, INITIAL_CONTRACTS, type ContractRecord } from './contracts';
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
import { DashboardPage } from './pages/DashboardPage';
import { PaymentWorkbenchPage } from './pages/PaymentWorkbenchPage';
import { InvoiceBuilderPage } from './pages/InvoiceBuilderPage';
import { SystemSettingsPage } from './pages/SystemSettingsPage';
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
import type { InvoicePageTab } from './pages/OperationalPages';
import type { CreatorProfile, GeneratedInvoiceRecord, InvoiceEntity, NavPage, Payout, Provider, ToastState } from './types';

type CreatedBatch = { id: string; count: number; amount: string; provider: string } | null;

const NEXT_STATUS: Partial<Record<Payout['status'], Payout['status']>> = {
  待财务复核: '等待付款',
  等待付款: '付款处理中',
  信息异常: '待财务复核',
  付款处理中: '已付款',
  已退回: '飞书审批中',
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

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<SystemUser>(CURRENT_USER);
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [payouts, setPayouts] = useState<Payout[]>(INITIAL_PAYOUTS);
  const [creators, setCreators] = useState<CreatorProfile[]>(INITIAL_CREATORS);
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [contracts, setContracts] = useState<ContractRecord[]>(INITIAL_CONTRACTS);
  const [invoiceEntity, setInvoiceEntity] = useState<InvoiceEntity>(INITIAL_INVOICE_ENTITY);
  const [generatedInvoices, setGeneratedInvoices] = useState<GeneratedInvoiceRecord[]>([]);
  const [requestProjects, setRequestProjects] = useState(INITIAL_REQUEST_PROJECTS);
  const [invoiceTab, setInvoiceTab] = useState<InvoicePageTab>('signature');
  const [focusedInvoiceId, setFocusedInvoiceId] = useState<string | null>(null);
  const [focusedContractId, setFocusedContractId] = useState<string | null>(null);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [createdBatch, setCreatedBatch] = useState<CreatedBatch>(null);

  const notify = useCallback((title: string, message: string) => {
    setToast({ title, message });
  }, []);

  const uploadContract = useCallback((file: File) => {
    const record = createUploadedContract(file, URL.createObjectURL(file));
    setContracts((current) => [record, ...current]);
    return record;
  }, []);

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
    setGeneratedInvoices((current) => [record, ...current.filter((item) => item.id !== record.id)]);
    setInvoiceTab('signature');
    notify('Invoice 已生成', `${record.id} 的 PDF 与 DOCX 已准备完成，签名区域保持为空。`);
  };

  const advancePayout = (payout: Payout) => {
    const nextStatus = NEXT_STATUS[payout.status];
    if (!nextStatus) return;
    const clearsReviewFeedback = nextStatus === '待财务复核' || payout.status === '已退回';
    const updated: Payout = {
      ...payout,
      status: nextStatus,
      issue: clearsReviewFeedback ? undefined : payout.issue,
      returnReason: payout.status === '已退回' ? undefined : payout.returnReason,
      paidAt: nextStatus === '已付款' ? '2026-07-17 刚刚' : payout.paidAt,
    };
    setPayouts((current) => current.map((item) => item.id === payout.id ? updated : item));
    setSelectedPayout((current) => current?.id === payout.id ? updated : current);
    notify('付款状态已更新', `${payout.creator} 已进入“${nextStatus}”。`);
  };

  const returnPayout = (payout: Payout, reason: string) => {
    const updated: Payout = { ...payout, status: '已退回', returnReason: reason, issue: `财务退回：${reason}` };
    setPayouts((current) => current.map((item) => item.id === payout.id ? updated : item));
    setSelectedPayout((current) => current?.id === payout.id ? updated : current);
    notify('已退回审核', '退回原因已同步给项目负责人。');
  };

  const openInvoiceFromPayout = (payout: Payout) => {
    setInvoiceTab(
      payout.status === '待财务复核'
        ? 'review'
        : payout.status === '已退回' || payout.status === '信息异常'
          ? 'returned'
          : 'approved',
    );
    setFocusedInvoiceId(payout.invoice);
    setSelectedPayout(null);
    setActivePage('invoice');
  };

  const openContractFromPayout = (contract: ContractRecord) => {
    setFocusedContractId(contract.id);
    setSelectedPayout(null);
    setActivePage('contracts');
  };

  const createBatch = (selected: Payout[], provider: Provider) => {
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

  const canReviewRequests = hasPermission(currentUser, 'request_review');
  const canExecutePayouts = hasPermission(currentUser, 'payout_execute');
  const canGenerateInvoices = hasPermission(currentUser, 'invoice_manage');
  const canManageCreators = hasPermission(currentUser, 'creator_records_manage');
  const canUploadContracts = hasPermission(currentUser, 'contract_manage');
  const canManageProjects = hasPermission(currentUser, 'project_manage');
  const canCreateRequests = hasPermission(currentUser, 'request_create');

  let pageContent;
  switch (activePage) {
    case 'projects':
      pageContent = (
        <ProjectsPage
          notify={notify}
          creators={creators}
          currentUser={currentUser}
          projects={projects}
          onProjectsChange={setProjects}
          canCreateProject={canManageProjects}
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
          canCreateRequest={canCreateRequests}
        />
      );
      break;
    case 'contracts':
      pageContent = (
        <ContractsPage
          notify={notify}
          contracts={contracts}
          canUpload={canUploadContracts}
          focusedContractId={focusedContractId}
          onFocusCleared={() => setFocusedContractId(null)}
          onUploadContract={uploadContract}
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
          canReview={canReviewRequests}
          canExecutePayout={canExecutePayouts}
          focusedInvoiceId={focusedInvoiceId}
          onFocusCleared={() => setFocusedInvoiceId(null)}
          onAdvance={advancePayout}
          onReturn={returnPayout}
          notify={notify}
        />
      );
      break;
    case 'invoice-create':
      pageContent = (
        <InvoiceBuilderPage
          creators={creators}
          payouts={payouts}
          invoiceEntity={invoiceEntity}
          generatedInvoices={generatedInvoices}
          onGenerated={addGeneratedInvoice}
          onCancel={() => setActivePage('invoice')}
          onOpenInvoiceManagement={() => { setInvoiceTab('signature'); setActivePage('invoice'); }}
        />
      );
      break;
    case 'batches':
      pageContent = <BatchesPage createdBatch={createdBatch} onNewBatch={() => setActivePage('new-batch')} notify={notify} canCreateBatch={canExecutePayouts} />;
      break;
    case 'new-batch':
      pageContent = (
        <BatchWizardPage
          payouts={payouts.filter((payout) => ['待财务复核', '等待付款', '信息异常', '飞书审批中'].includes(payout.status)).slice(0, 4)}
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
          onReturn={returnPayout}
          canReview={canReviewRequests}
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
