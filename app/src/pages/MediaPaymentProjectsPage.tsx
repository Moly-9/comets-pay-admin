import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Send,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, Button, Modal, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import {
  RequestProjectResourceManager,
  type RequestProjectResourceActions,
} from '../components/RequestProjectResourceManager';
import { formatContractMoney, isConfirmedContract, type ContractRecord } from '../contracts';
import { PM_USERS, type SystemUser } from '../data';
import {
  createPrototypeCode,
  createPrototypeId,
  type ContractId,
  type CooperationProjectId,
  type CreatorId,
  type InvoiceId,
  type PaymentListRecord,
  type PaymentRequestProjectId,
  type ProjectId,
} from '../businessWorkflow';
import {
  canAddCreatorToPaymentRequest,
  cooperationProjectIdFor,
  createEmptyPaymentRequestListFilters,
  filterPaymentRequestList,
  paymentRequestAmount,
  paymentRequestAmountLabel,
  paymentRequestInvoiceIds,
  paymentRequestListMetrics,
  paymentRequestSubmissionIssues,
  resolveCreatorDocuments,
  type PaymentRequestCreatorLink,
} from '../paymentRequestProjects';
import type { CreatorProfile, GeneratedInvoiceRecord } from '../types';
import {
  ProjectInlineFilterPanel,
  ProjectStatus,
  type ProjectListFilters,
} from './OperationalPages';
import type { ProjectSummary } from './ProjectDetailPage';
import type { RequestProjectSummary } from './RequestProjectDetailPage';

type Notify = (title: string, message: string) => void;

const STATUS_COPY = {
  READY: '可选择多份 Invoice',
  MISSING_INVOICE: '该合作项目下暂无此达人 Invoice',
  INVOICE_IN_USE: '可用 Invoice 均已关联其他请款项目',
} as const;

const requestCodeFor = (request: RequestProjectSummary) => request.requestCode ?? request.id;

const formatCreatedAt = (value?: string) => {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const paymentListStatusLabel = (status?: PaymentListRecord['status']) => {
  if (status === 'generated') return '已生成';
  if (status === 'submitted') return '已提交';
  if (status === 'approved') return '已通过';
  if (status === 'paid') return '已完成';
  return '草稿';
};

export function MediaPaymentProjectsPage({
  notify,
  currentUser,
  cooperationProjects,
  creators,
  contracts,
  invoices,
  paymentLists,
  requests,
  canCreate,
  focusedProjectId,
  onFocusCleared,
  onCreated,
  onUpdated,
  onGeneratePaymentList,
  onSubmitRequest,
  resourceActions,
}: {
  notify: Notify;
  currentUser: SystemUser;
  cooperationProjects: ProjectSummary[];
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
  paymentLists: PaymentListRecord[];
  requests: RequestProjectSummary[];
  canCreate: boolean;
  focusedProjectId: string | null;
  onFocusCleared: () => void;
  onCreated: (request: RequestProjectSummary) => void;
  onUpdated: (request: RequestProjectSummary) => void;
  onGeneratePaymentList: (request: RequestProjectSummary) => void;
  onSubmitRequest: (request: RequestProjectSummary) => void;
  resourceActions: RequestProjectResourceActions;
}) {
  const [creating, setCreating] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(focusedProjectId);
  const [cooperationProjectId, setCooperationProjectId] = useState('');
  const [brand, setBrand] = useState('');
  const [pm, setPm] = useState(PM_USERS[0]?.name ?? '');
  const [reason, setReason] = useState('');
  const [creatorSearch, setCreatorSearch] = useState('');
  const [creatorPickerOpen, setCreatorPickerOpen] = useState(false);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<CreatorId[]>([]);
  const [contractIdsByCreator, setContractIdsByCreator] = useState<Record<string, ContractId[]>>({});
  const [invoiceIdsByCreator, setInvoiceIdsByCreator] = useState<Record<string, InvoiceId[]>>({});
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ProjectListFilters>(createEmptyPaymentRequestListFilters);

  const currentScopeName = currentUser.scopeName ?? currentUser.name;
  const visibleRequests = requests.filter((request) => {
    if (currentUser.roleKey === 'media') return request.media === currentScopeName;
    return true;
  });
  const editingRequest = editingRequestId
    ? visibleRequests.find((request) => request.id === editingRequestId) ?? null
    : null;
  const selectedRequest = selectedRequestId
    ? visibleRequests.find((request) => request.id === selectedRequestId || requestCodeFor(request) === selectedRequestId) ?? null
    : null;
  const selectedProject = cooperationProjects.find((project) => (
    cooperationProjectIdFor(project) === cooperationProjectId
  )) ?? null;
  const query = creatorSearch.trim().toLowerCase();
  const selectedCreators = selectedCreatorIds
    .map((creatorId) => creators.find((creator) => creator.id === creatorId))
    .filter((creator): creator is CreatorProfile => Boolean(creator));

  const resolutions = useMemo(() => new Map(creators.map((creator) => [
    creator.id,
    cooperationProjectId
      ? resolveCreatorDocuments({
          contracts,
          invoices,
          requests,
          cooperationProjectId: cooperationProjectId as CooperationProjectId,
          creatorId: creator.id as CreatorId,
          excludeRequestId: editingRequest?.paymentRequestProjectId,
        })
      : null,
  ])), [contracts, cooperationProjectId, creators, editingRequest?.paymentRequestProjectId, invoices, requests]);
  const visibleCreators = creators
    .filter((creator) => (
      !query || `${creator.name}${creator.handle}${creator.region}${creator.platform}`.toLowerCase().includes(query)
    ))
    .sort((left, right) => {
      const leftReady = resolutions.get(left.id)?.status === 'READY';
      const rightReady = resolutions.get(right.id)?.status === 'READY';
      if (leftReady !== rightReady) return leftReady ? -1 : 1;
      return left.name.localeCompare(right.name);
    });

  const metrics = paymentRequestListMetrics(visibleRequests);
  const { visible: filteredRequests, invalidBudgetRange } = filterPaymentRequestList({
    requests: visibleRequests,
    search,
    filters,
  });
  const customerCounts = visibleRequests.reduce<Record<string, number>>((result, request) => (
    request.brand ? { ...result, [request.brand]: (result[request.brand] ?? 0) + 1 } : result
  ), {});
  const pmCounts = visibleRequests.reduce<Record<string, number>>((result, request) => ({
    ...result,
    [request.pm]: (result[request.pm] ?? 0) + 1,
  }), {});
  const customerFilterOptions = Object.entries(customerCounts).map(([customer, count]) => ({
    value: customer,
    label: customer,
    description: `${count} 个项目`,
  }));
  const pmFilterOptions = Object.entries(pmCounts).map(([pmName, count]) => ({
    value: pmName,
    label: pmName,
    description: `${count} 个项目${PM_USERS.find((user) => user.name === pmName)?.email ? ` · ${PM_USERS.find((user) => user.name === pmName)?.email}` : ''}`,
  }));
  const currencies = Array.from(new Set(visibleRequests
    .map((request) => paymentRequestAmount(request.amount).currency)
    .filter(Boolean)));
  const statuses = Array.from(new Set(visibleRequests.map((request) => request.status)));
  const currencyFilterOptions = [
    { value: 'all', label: '全部币种' },
    ...currencies.map((currency) => ({ value: currency, label: currency })),
  ];
  const statusFilterOptions = [
    {
      value: 'all',
      label: '全部状态',
      description: `共 ${visibleRequests.length} 个项目`,
      leading: <span className="project-status-select-dot project-status-select-dot-all" />,
    },
    ...statuses.map((status) => ({
      value: status,
      label: status,
      description: `${visibleRequests.filter((request) => request.status === status).length} 个项目`,
      leading: <span className={`project-status-select-dot ${status === '已完成' ? 'project-status-select-dot-complete' : 'project-status-select-dot-active'}`} />,
    })),
  ];
  const creatorSelectionEditable = !editingRequest || canAddCreatorToPaymentRequest(editingRequest);

  const resetForm = () => {
    setCooperationProjectId('');
    setBrand('');
    setPm(PM_USERS[0]?.name ?? '');
    setReason('');
    setCreatorSearch('');
    setCreatorPickerOpen(false);
    setSelectedCreatorIds([]);
    setContractIdsByCreator({});
    setInvoiceIdsByCreator({});
    setEditingRequestId(null);
  };

  const closeForm = () => {
    const returnRequestId = editingRequest?.id ?? null;
    resetForm();
    setCreating(false);
    if (returnRequestId) setSelectedRequestId(returnRequestId);
  };

  const openCreateForm = () => {
    resetForm();
    setCreating(true);
  };

  const openEditForm = (request: RequestProjectSummary, showCreatorPicker = false) => {
    setCooperationProjectId(String(request.cooperationProjectId ?? request.projectId ?? ''));
    setBrand(request.brand ?? '');
    setPm(request.pm);
    setReason(request.generatedDetail?.reason ?? '');
    setCreatorSearch('');
    setCreatorPickerOpen(showCreatorPicker && canAddCreatorToPaymentRequest(request));
    setSelectedCreatorIds((request.creatorLinks ?? []).map((link) => link.creatorId));
    setContractIdsByCreator(Object.fromEntries(
      (request.creatorLinks ?? []).map((link) => [link.creatorId, [...link.contractIds]]),
    ));
    setInvoiceIdsByCreator(Object.fromEntries(
      (request.creatorLinks ?? []).map((link) => [link.creatorId, [...link.invoiceIds]]),
    ));
    setEditingRequestId(request.id);
    setSelectedRequestId(null);
    setCreating(true);
  };

  const changeProject = (value: string) => {
    setCooperationProjectId(value);
    setSelectedCreatorIds([]);
    setContractIdsByCreator({});
    setInvoiceIdsByCreator({});
  };

  const toggleCreator = (creatorId: CreatorId) => {
    if (!creatorSelectionEditable) {
      notify('达人名单已锁定', '只有草稿状态可以添加或移除达人。');
      return;
    }
    const removing = selectedCreatorIds.includes(creatorId);
    setSelectedCreatorIds((current) => removing
      ? current.filter((id) => id !== creatorId)
      : [...current, creatorId]);
    setContractIdsByCreator((current) => {
      if (!current[creatorId]) return current;
      const next = { ...current };
      delete next[creatorId];
      return next;
    });
    setInvoiceIdsByCreator((current) => {
      if (removing) {
        if (!current[creatorId]) return current;
        const next = { ...current };
        delete next[creatorId];
        return next;
      }
      return {
        ...current,
        [creatorId]: resolutions.get(creatorId)?.availableInvoices.map((invoice) => invoice.invoiceId) ?? [],
      };
    });
  };

  const toggleContract = (creatorId: CreatorId, contractId: ContractId) => {
    setContractIdsByCreator((current) => {
      const selected = current[creatorId] ?? [];
      return {
        ...current,
        [creatorId]: selected.includes(contractId)
          ? selected.filter((id) => id !== contractId)
          : [...selected, contractId],
      };
    });
  };

  const toggleInvoice = (creatorId: CreatorId, invoiceId: InvoiceId) => {
    setInvoiceIdsByCreator((current) => {
      const selected = current[creatorId] ?? [];
      return {
        ...current,
        [creatorId]: selected.includes(invoiceId)
          ? selected.filter((id) => id !== invoiceId)
          : [...selected, invoiceId],
      };
    });
  };

  const validCreatorLinks = selectedCreators.flatMap<PaymentRequestCreatorLink>((creator) => {
    const resolution = resolutions.get(creator.id);
    const selectedInvoiceIds = invoiceIdsByCreator[creator.id] ?? [];
    const selectedInvoices = resolution?.invoices.filter((invoice) => selectedInvoiceIds.includes(invoice.invoiceId)) ?? [];
    const engagementId = selectedInvoices[0]?.snapshot.engagementId;
    if (!selectedInvoices.length || !engagementId) return [];
    return [{
      creatorId: creator.id as CreatorId,
      engagementId,
      contractIds: contractIdsByCreator[creator.id] ?? [],
      invoiceIds: selectedInvoices.map((invoice) => invoice.invoiceId),
    }];
  });
  const creatorsReady = selectedCreators.length > 0
    && validCreatorLinks.length === selectedCreators.length;
  const canCreateRequest = Boolean(
    selectedProject
    && pm
    && reason.trim()
    && creatorsReady,
  );

  const saveRequest = () => {
    if (!selectedProject || !canCreateRequest) return;
    const paymentRequestProjectId = editingRequest?.paymentRequestProjectId
      ?? createPrototypeId('request-project') as PaymentRequestProjectId;
    const requestCode = editingRequest?.requestCode ?? createPrototypeCode('REQ');
    const selectedContractIds = validCreatorLinks.flatMap((link) => link.contractIds);
    const selectedInvoiceIds = paymentRequestInvoiceIds(validCreatorLinks);
    const request: RequestProjectSummary = {
      ...editingRequest,
      id: editingRequest?.id ?? requestCode,
      paymentRequestProjectId,
      requestCode,
      cooperationProjectId: cooperationProjectIdFor(selectedProject),
      cooperationProjectCode: selectedProject.cooperationProjectCode ?? selectedProject.projectCode ?? selectedProject.id,
      cooperationProjectName: selectedProject.name,
      lifecycle: editingRequest?.lifecycle ?? 'DRAFT',
      creatorLinks: validCreatorLinks,
      projectId: cooperationProjectIdFor(selectedProject) as ProjectId,
      invoiceIds: selectedInvoiceIds,
      project: selectedProject.name,
      brand: brand.trim(),
      media: currentScopeName,
      pm,
      amount: paymentRequestAmountLabel(validCreatorLinks, invoices),
      contracts: selectedContractIds.length,
      invoices: selectedInvoiceIds.length,
      paymentListId: undefined,
      paymentListIds: undefined,
      paymentOrder: '待生成',
      status: editingRequest?.status ?? '草稿',
      filter: editingRequest?.filter ?? 'pending',
      createdAt: editingRequest?.createdAt ?? new Date().toISOString(),
      generatedDetail: {
        brand: brand.trim(),
        reason: reason.trim(),
        contractId: selectedContractIds.join('、') || '未关联',
        contractName: selectedContractIds.length ? `${selectedContractIds.length} 份已选合同` : '合同选填，当前未关联',
        contractAmount: '按所选合同分别校验',
        contractStatus: selectedContractIds.length ? '待校验' : '未关联',
        invoiceId: selectedInvoiceIds.join('、'),
        invoiceAmount: paymentRequestAmountLabel(validCreatorLinks, invoices),
        invoiceStatus: '待提交',
        paymentListId: '待生成',
        paymentListStatus: '草稿',
        payee: `${validCreatorLinks.length} 位合作达人`,
        provider: '按 Invoice 账户快照',
        beneficiaryId: '按付款清单账户快照',
        feePolicy: '按合同及 Invoice 执行',
      },
    };
    if (editingRequest) onUpdated(request);
    else onCreated(request);
    resetForm();
    setCreating(false);
    setSelectedRequestId(request.id);
    notify(
      editingRequest ? '项目已更新' : '项目已创建',
      `${requestCode} 已${editingRequest ? '更新并清除旧付款清单' : '保存为草稿'}，可在详情中完成校验后提交申请。`,
    );
  };

  if (selectedRequest) {
    const cooperationProject = cooperationProjects.find((project) => (
      cooperationProjectIdFor(project) === (selectedRequest.cooperationProjectId ?? selectedRequest.projectId)
    ));
    const links = selectedRequest.creatorLinks ?? [];
    const submissionIssues = paymentRequestSubmissionIssues({
      creatorLinks: links,
      invoices,
      paymentLists,
      paymentRequestProjectId: selectedRequest.paymentRequestProjectId,
    });
    const editable = canCreate && ['DRAFT', 'RETURNED'].includes(selectedRequest.lifecycle ?? '');
    const canAddCreators = canCreate && canAddCreatorToPaymentRequest(selectedRequest);
    const canSubmit = editable && submissionIssues.length === 0;
    const requestPaymentLists = paymentLists.filter((list) => (
      list.paymentRequestProjectId === selectedRequest.paymentRequestProjectId
    ));
    const linkedContractIds = Array.from(new Set(links.flatMap((link) => link.contractIds)));
    const linkedInvoices = paymentRequestInvoiceIds(links).flatMap((invoiceId) => {
      const invoice = invoices.find((item) => item.invoiceId === invoiceId);
      return invoice ? [invoice] : [];
    });
    const latestPaymentList = requestPaymentLists[0];
    return (
      <div className="page-stack project-detail-page media-request-detail-page">
        <button className="project-back-button" type="button" onClick={() => {
          setSelectedRequestId(null);
          onFocusCleared();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}><ArrowLeft size={17} />返回我的项目</button>
        <PageHeading
          title={requestCodeFor(selectedRequest)}
          subtitle={`关联项目 ${selectedRequest.cooperationProjectName ?? selectedRequest.project} · 创建媒介 ${selectedRequest.media}`}
          actions={<div className="page-heading-actions">{editable ? <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => openEditForm(selectedRequest)}>编辑项目</Button> : null}<span className="project-detail-status"><i />{selectedRequest.status}</span></div>}
        />
        <div className="metrics-grid project-detail-metrics">
          <article className="metric-card"><span>请款金额</span><strong>{selectedRequest.amount}</strong><small>按关联 Invoice 汇总</small></article>
          <article className="metric-card metric-lilac"><span>合作达人</span><strong>{links.length || selectedRequest.invoices} 位</strong><small>{selectedRequest.contracts} 份合同 · {selectedRequest.invoices} 份 Invoice</small></article>
          <article className="metric-card metric-peach"><span>当前状态</span><strong>{selectedRequest.status}</strong><small>{selectedRequest.approval ? '已进入审批流' : '尚未提交审批'}</small></article>
        </div>
        <section className="project-detail-card">
          <header className="project-detail-card-header"><div><h2>项目基础信息</h2><p>请款项目与合作项目通过稳定 ID 关联。</p></div></header>
          <dl className="project-info-grid">
            <div><dt>项目编号</dt><dd>{requestCodeFor(selectedRequest)}</dd></div>
            <div><dt>关联项目</dt><dd>{cooperationProject?.name ?? selectedRequest.cooperationProjectName ?? selectedRequest.project}<small className="cell-subtext">{selectedRequest.cooperationProjectCode ?? cooperationProject?.cooperationProjectCode ?? '待同步'}</small></dd></div>
            <div><dt>品牌</dt><dd>{selectedRequest.brand || '未填写（非必填）'}</dd></div>
            <div><dt>负责 PM</dt><dd>{selectedRequest.pm}</dd></div>
            <div><dt>项目媒介</dt><dd>{selectedRequest.media}</dd></div>
            <div><dt>创建时间</dt><dd>{formatCreatedAt(selectedRequest.createdAt ?? selectedRequest.approval?.submittedAt)}</dd></div>
            <div className="project-info-wide"><dt>请款原因</dt><dd>{selectedRequest.generatedDetail?.reason || '待补充'}</dd></div>
          </dl>
        </section>
        <section className="project-detail-card project-workflow-card">
          <header className="project-detail-card-header"><div><h2>合同、Invoice 与付款清单</h2><p>逐项查看和管理当前请款项目明确关联的资料。</p></div></header>
          <RequestProjectResourceManager
            request={selectedRequest}
            cooperationProject={cooperationProject ?? cooperationProjects[0]}
            requests={requests}
            creators={creators}
            contracts={contracts}
            invoices={invoices}
            paymentLists={paymentLists}
            currentUser={currentUser}
            onChangeLinks={(nextLinks, summary) => resourceActions.onChangeLinks(selectedRequest, nextLinks, summary)}
            onOpenContract={(contractId) => resourceActions.onOpenContract(selectedRequest, contractId)}
            onOpenInvoice={(invoiceId) => resourceActions.onOpenInvoice(selectedRequest, invoiceId)}
            onEditInvoice={(invoiceId) => resourceActions.onEditInvoice(selectedRequest, invoiceId)}
            onGenerateContract={() => resourceActions.onGenerateContract(selectedRequest)}
            onGenerateInvoice={() => resourceActions.onGenerateInvoice(selectedRequest)}
            onUploadContract={(input) => resourceActions.onUploadContract(selectedRequest, input)}
            onDeleteContract={(contractId) => resourceActions.onDeleteContract(selectedRequest, contractId)}
            onDeleteInvoice={(invoiceId) => resourceActions.onDeleteInvoice(selectedRequest, invoiceId)}
            onGeneratePaymentLists={() => onGeneratePaymentList(selectedRequest)}
            onDeletePaymentList={(paymentListId) => resourceActions.onDeletePaymentList(selectedRequest, paymentListId)}
            onRemovePaymentInvoice={(paymentListId, invoiceId) => resourceActions.onRemovePaymentInvoice(selectedRequest, paymentListId, invoiceId)}
            onUpdatePaymentItem={(paymentListId, invoiceId, field, value) => resourceActions.onUpdatePaymentItem(selectedRequest, paymentListId, invoiceId, field, value)}
            onChangePaymentAccount={(paymentListId, invoiceId, payoutAccountId) => resourceActions.onChangePaymentAccount(selectedRequest, paymentListId, invoiceId, payoutAccountId)}
            onRevalidatePaymentItem={(paymentListId, invoiceId) => resourceActions.onRevalidatePaymentItem(selectedRequest, paymentListId, invoiceId)}
            onBeginEditPaymentList={(paymentListId) => resourceActions.onBeginEditPaymentList(selectedRequest, paymentListId)}
            onGeneratePaymentListVersion={(paymentListId) => resourceActions.onGeneratePaymentListVersion(selectedRequest, paymentListId)}
            onExportPaymentList={(paymentListId) => resourceActions.onExportPaymentList(selectedRequest, paymentListId)}
          />
        </section>
        <section className="project-detail-card">
          <header className="project-detail-card-header"><div><h2>达人名单</h2><p>展示当前请款项目已关联的达人及单据状态。</p></div>{canAddCreators ? <button className="text-link" type="button" onClick={() => openEditForm(selectedRequest, true)}>添加达人</button> : <span>共 {links.length} 位</span>}</header>
          {links.length ? (
            <div className="table-scroll">
              <table className="data-table project-creator-table media-request-creator-table">
                <thead><tr><th>达人</th><th>平台</th><th>Invoice</th><th>合同</th><th>单据状态</th></tr></thead>
                <tbody>{links.map((link) => {
                  const creator = creators.find((item) => item.id === link.creatorId);
                  const creatorInvoices = link.invoiceIds.flatMap((invoiceId) => {
                    const invoice = invoices.find((item) => item.invoiceId === invoiceId);
                    return invoice ? [invoice] : [];
                  });
                  return <tr key={link.creatorId}><td><div className="media-request-creator-cell"><Avatar initials={creator?.initials ?? '?'} accent={creator?.accent ?? '#718096'} size="sm" /><span><strong>{creator?.name ?? link.creatorId}</strong><small>{creator?.handle ?? '达人档案待核对'}</small></span></div></td><td>{creator?.platform ?? '待核对'}</td><td><strong>{creatorInvoices.length ? `${creatorInvoices.length} 份 Invoice` : '未关联'}</strong><small className="cell-subtext">{creatorInvoices.map((invoice) => invoice.id).join('、') || '记录缺失'}</small></td><td>{link.contractIds.length ? `${link.contractIds.length} 份` : '未关联（选填）'}</td><td><ProjectStatus status={creatorInvoices.length ? '已关联' : '待补资料'} /></td></tr>;
                })}</tbody>
              </table>
            </div>
          ) : canAddCreators ? (
            <button className="project-detail-empty project-detail-empty-action" type="button" onClick={() => openEditForm(selectedRequest, true)}><Users size={20} /><span><strong>尚未添加达人</strong><small>点击从达人档案筛选项目达人</small></span></button>
          ) : <div className="project-detail-empty"><Users size={20} /><span><strong>尚未添加达人</strong><small>当前项目为只读状态</small></span></div>}
        </section>
        <section className="project-detail-card media-request-submit-card">
          <header className="project-detail-card-header"><div><h2>{editable ? '提交申请' : '申请状态'}</h2><p>{editable ? '提交后进入“请款项目”审批工作台，草稿不会出现在审批列表。' : '该项目已进入“请款项目”审批工作台，当前页面保留关联资料快照。'}</p></div></header>
          {editable ? submissionIssues.length ? (
            <div className="media-request-issue-list"><AlertTriangle size={18} /><div><strong>暂不能提交</strong>{submissionIssues.map((issue) => <span key={issue}>{issue}</span>)}</div></div>
          ) : <NoticeBanner>资料与付款账户快照校验通过，可以提交审批。</NoticeBanner> : (
            <NoticeBanner>申请当前状态：{selectedRequest.status}。审批处理请前往“请款项目”工作台。</NoticeBanner>
          )}
          {editable ? <div className="media-request-submit-actions">
            <Button variant="secondary" onClick={() => onGeneratePaymentList(selectedRequest)}>生成 / 刷新付款清单</Button>
            <Button icon={<Send size={17} />} disabled={!canSubmit} onClick={() => onSubmitRequest(selectedRequest)}>提交申请</Button>
          </div> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        title="我的项目"
        subtitle="仅展示与当前账号关联的项目，集中管理合同与 Invoice、达人名单和请款进度。"
        actions={canCreate ? <Button icon={<Plus size={17} />} onClick={openCreateForm}>新建项目</Button> : undefined}
      />
      <div className="metrics-grid">
        <article className="metric-card metric-peach"><span>审核中</span><strong>{metrics.reviewTotal}</strong><small>{metrics.waitingReview} 个待审批 · {metrics.reviewing} 个审批中</small></article>
        <article className="metric-card"><span>待打款</span><strong>{metrics.waitingPayment}</strong><small>已完成全部审批</small></article>
        <article className="metric-card metric-lilac"><span>请款项目总数</span><strong>{metrics.total}</strong><small>已关联真实合作项目</small></article>
      </div>
      <section className="content-card">
        <ProjectInlineFilterPanel
          search={search}
          filters={filters}
          customerOptions={customerFilterOptions}
          pmOptions={pmFilterOptions}
          currencyOptions={currencyFilterOptions}
          statusOptions={statusFilterOptions}
          resultCount={filteredRequests.length}
          totalCount={visibleRequests.length}
          invalidBudgetRange={invalidBudgetRange}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onClear={() => { setSearch(''); setFilters(createEmptyPaymentRequestListFilters()); }}
        />
        <div className="table-scroll">
          <table className="data-table operational-table">
            <thead><tr><th>项目编号</th><th>关联项目</th><th>品牌</th><th>负责 PM</th><th>达人</th><th>请款金额</th><th>状态</th><th className="action-cell">操作</th></tr></thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td><strong>{requestCodeFor(request)}</strong></td>
                  <td><strong>{request.cooperationProjectName ?? request.project}</strong><small className="cell-subtext">{request.cooperationProjectCode ?? request.projectId ?? '待同步'}</small></td>
                  <td>{request.brand || '—'}</td>
                  <td>{request.pm}</td>
                  <td>{request.creatorLinks?.length ?? request.invoices} 位</td>
                  <td>{request.amount}</td>
                  <td><ProjectStatus status={request.status} /></td>
                  <td className="action-cell"><button className="text-link" type="button" onClick={() => { setSelectedRequestId(request.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>查看项目</button></td>
                </tr>
              ))}
              {!filteredRequests.length ? <tr><td colSpan={8} className="project-list-empty">暂无符合当前搜索与筛选条件的项目</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      {creating ? (
        <Modal
          title={editingRequest ? `编辑项目 · ${requestCodeFor(editingRequest)}` : '新建项目'}
          onClose={closeForm}
          width="760px"
          footer={<><Button variant="ghost" onClick={closeForm}>取消</Button><Button disabled={!canCreateRequest} onClick={saveRequest}>{editingRequest ? '保存修改' : '创建项目'}</Button></>}
        >
          <div className="form-grid single-column project-create-form media-request-create-form">
            <div className="form-field">
              <span className="form-field-label">关联项目 <em className="required-mark" aria-hidden="true">*</em></span>
              <SelectField
                ariaLabel="选择合作项目"
                variant="form"
                value={cooperationProjectId}
                disabled={!creatorSelectionEditable}
                options={cooperationProjects.map((project) => ({
                  value: cooperationProjectIdFor(project),
                  label: project.name,
                  description: `${project.cooperationProjectCode ?? project.projectCode ?? project.id} · 来自飞书`,
                }))}
                onChange={changeProject}
                placeholder="请选择飞书合作项目"
              />
            </div>
            <label><span>品牌 <small className="request-optional-label">选填</small></span><input placeholder="输入品牌或客户名称" value={brand} onChange={(event) => setBrand(event.target.value)} /></label>
            <div className="form-field"><span className="form-field-label">项目 PM <em className="required-mark" aria-hidden="true">*</em></span><SelectField ariaLabel="选择项目 PM" variant="form" value={pm} options={PM_USERS.map((user) => ({ value: user.name, label: user.name, description: user.email }))} onChange={setPm} /></div>
            <label><span>请款原因 <em className="required-mark" aria-hidden="true">*</em></span><textarea placeholder="填写本项目的请款背景或用途" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <div className="form-field">
              <span className="form-field-label form-field-label-with-meta"><span>合作达人 <em className="required-mark" aria-hidden="true">*</em></span><small>展示达人库全部达人</small></span>
              <div className="creator-picker media-request-creator-picker" data-testid="media-request-creator-picker">
                <button
                  className={`invoice-picker-trigger creator-picker-trigger ${creatorPickerOpen ? 'invoice-picker-trigger-open' : ''}`}
                  type="button"
                  disabled={!creatorSelectionEditable || !cooperationProjectId}
                  aria-expanded={creatorPickerOpen}
                  aria-controls="media-request-creator-options"
                  onClick={() => setCreatorPickerOpen((current) => !current)}
                >
                  <span className="invoice-picker-leading"><Users size={18} /><span className="invoice-picker-copy"><strong>{selectedCreatorIds.length ? `已选择 ${selectedCreatorIds.length} 位合作达人` : '从达人档案选择合作达人'}</strong><small>{cooperationProjectId ? '已将有唯一可用 Invoice 的达人排在前面' : '请先选择关联项目'}</small></span></span>
                  <ChevronDown className="invoice-picker-chevron" size={18} />
                </button>
                {selectedCreators.length ? (
                  <div className="creator-selection-chips" aria-label="已选择的合作达人">
                    {selectedCreators.map((creator) => creatorSelectionEditable ? (
                      <button className="creator-selection-chip" type="button" aria-label={`移除 ${creator.name}`} key={creator.id} onClick={() => toggleCreator(creator.id as CreatorId)}><Avatar initials={creator.initials} accent={creator.accent} size="sm" /><span>{creator.name}</span><X size={13} aria-hidden="true" /></button>
                    ) : <span className="creator-selection-chip is-readonly" key={creator.id}><Avatar initials={creator.initials} accent={creator.accent} size="sm" /><span>{creator.name}</span></span>)}
                    {creatorSelectionEditable ? <button className="invoice-selection-clear" type="button" onClick={() => { setSelectedCreatorIds([]); setContractIdsByCreator({}); setInvoiceIdsByCreator({}); }}>清除已选</button> : null}
                  </div>
                ) : null}
                {creatorPickerOpen && creatorSelectionEditable ? (
                  <div id="media-request-creator-options" className="creator-options" role="listbox" aria-label="达人档案列表" aria-multiselectable="true">
                    <div className="creator-picker-search-row"><label className="creator-picker-search"><Search size={16} aria-hidden="true" /><input aria-label="搜索合作达人" placeholder="搜索姓名、账号、地区或平台" value={creatorSearch} onChange={(event) => setCreatorSearch(event.target.value)} /></label><span className="creator-picker-result-count" aria-live="polite"><strong>{visibleCreators.length}</strong><span>/ {creators.length} 位</span></span></div>
                    <div className="creator-option-list">
                      {visibleCreators.map((creator) => {
                        const selected = selectedCreatorIds.includes(creator.id as CreatorId);
                        const resolution = resolutions.get(creator.id);
                        const ready = resolution?.status === 'READY';
                        return <button className={`creator-option ${selected ? 'creator-option-selected' : ''} ${ready ? 'creator-option-ready' : ''}`} type="button" role="option" aria-selected={selected} key={creator.id} onClick={() => toggleCreator(creator.id as CreatorId)}><span className="creator-option-profile"><Avatar initials={creator.initials} accent={creator.accent} size="sm" /><span><strong>{creator.name}</strong><small>{creator.handle}</small></span></span><span className="creator-option-meta"><strong>{ready ? '可创建项目' : creator.region}</strong><small>{ready ? `${resolution?.availableInvoices.length ?? 0} 份 Invoice 可多选` : `${creator.platform} · ${resolution ? STATUS_COPY[resolution.status] : '待选择项目'}`}</small></span>{selected ? <CheckCircle2 className="creator-option-mark creator-option-mark-selected" size={18} /> : <Circle className="creator-option-mark" size={18} />}</button>;
                      })}
                      {!visibleCreators.length ? <div className="creator-picker-empty">没有找到匹配的达人档案</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {selectedCreators.length ? (
              <section className="media-request-document-section">
                <header><div><h3>达人单据关联</h3><p>合同选填；每位达人提交前至少关联一份 Invoice，合同和 Invoice 均可多选。</p></div><span>{selectedCreators.length} 位达人</span></header>
                {selectedCreators.map((creator) => {
                  const resolution = resolutions.get(creator.id);
                  const selectedContractIds = contractIdsByCreator[creator.id] ?? [];
                  return (
                    <article className="media-request-document-row" key={creator.id}>
                      <div className="media-request-document-creator"><Avatar initials={creator.initials} accent={creator.accent} size="sm" /><span><strong>{creator.name}</strong><small>{creator.handle}</small></span></div>
                      <div className={`media-request-invoice-state is-${resolution?.status.toLowerCase() ?? 'missing'}`}>
                        <span><ReceiptText size={16} />Invoice <em>必填，可多选</em></span>
                        {resolution?.invoices.length ? resolution.invoices.map((invoice) => {
                          const owner = resolution.invoiceOwners.find((item) => item.invoiceId === invoice.invoiceId)?.owner;
                          const enabled = !owner;
                          const selected = (invoiceIdsByCreator[creator.id] ?? []).includes(invoice.invoiceId);
                          return <button type="button" disabled={!enabled} aria-pressed={selected} className={selected ? 'is-selected' : ''} key={invoice.invoiceId} onClick={() => toggleInvoice(creator.id as CreatorId, invoice.invoiceId)}><span>{selected ? <CheckCircle2 size={15} /> : <Circle size={15} />}{invoice.id}</span><small>{enabled ? `${invoice.status} · 可关联` : `已关联 ${owner?.requestCode ?? owner?.id}`}</small></button>;
                        }) : <small className="media-request-empty-copy">{STATUS_COPY[resolution?.status ?? 'MISSING_INVOICE']}</small>}
                      </div>
                      <div className="media-request-contracts">
                        <span><FileText size={16} />合同 <em>选填，可多选</em></span>
                        {resolution?.contracts.length ? resolution.contracts.map((contract) => {
                          const contractId = contract.contractId;
                          const enabled = Boolean(contractId && isConfirmedContract(contract));
                          const selected = Boolean(contractId && selectedContractIds.includes(contractId));
                          return <button type="button" disabled={!enabled} aria-pressed={selected} className={selected ? 'is-selected' : ''} key={contract.id} onClick={() => contractId && toggleContract(creator.id as CreatorId, contractId)}><span>{selected ? <CheckCircle2 size={15} /> : <Circle size={15} />}{contract.id}</span><small>{formatContractMoney(contract)} · {enabled ? '可关联' : '待确认'}</small></button>;
                        }) : <small className="media-request-empty-copy">该合作项目下暂无此达人合同，可不关联。</small>}
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : null}
            {!cooperationProjectId ? <NoticeBanner>请先选择关联项目，再选择达人并核对合同与 Invoice。</NoticeBanner> : null}
            {cooperationProjectId && !selectedCreators.length ? <NoticeBanner>请至少选择一位合作达人。有唯一可用 Invoice 的达人已排在列表最前方。</NoticeBanner> : null}
            {selectedCreators.length && !creatorsReady ? <div className="media-request-form-issues"><AlertTriangle size={17} /><div><strong>所选达人暂不能创建项目</strong>{selectedCreators.filter((creator) => resolutions.get(creator.id)?.status !== 'READY').map((creator) => <span key={creator.id}>{creator.name}：{STATUS_COPY[resolutions.get(creator.id)?.status ?? 'MISSING_INVOICE']}</span>)}</div></div> : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
