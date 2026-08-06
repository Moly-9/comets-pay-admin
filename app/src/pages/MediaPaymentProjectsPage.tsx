import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  FileText,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, Button, Modal, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { formatContractMoney, isConfirmedContract, type ContractRecord } from '../contracts';
import { PM_USERS, type SystemUser } from '../data';
import {
  createPrototypeCode,
  createPrototypeId,
  type ContractId,
  type CooperationProjectId,
  type CreatorId,
  type PaymentListRecord,
  type PaymentRequestProjectId,
  type ProjectId,
} from '../businessWorkflow';
import {
  cooperationProjectIdFor,
  paymentRequestAmountLabel,
  paymentRequestSubmissionIssues,
  resolveCreatorDocuments,
  type PaymentRequestCreatorLink,
} from '../paymentRequestProjects';
import type { CreatorProfile, GeneratedInvoiceRecord } from '../types';
import type { ProjectSummary } from './ProjectDetailPage';
import type { RequestProjectSummary } from './RequestProjectDetailPage';

type Notify = (title: string, message: string) => void;

const STATUS_COPY = {
  READY: '已自动关联唯一 Invoice',
  MISSING_INVOICE: '该合作项目下暂无此达人 Invoice',
  MULTIPLE_INVOICES: '检测到多份 Invoice，需先处理数据冲突',
  INVOICE_IN_USE: '该 Invoice 已关联其他请款项目',
} as const;

const requestCodeFor = (request: RequestProjectSummary) => request.requestCode ?? request.id;

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
}) {
  const [creating, setCreating] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(focusedProjectId);
  const [cooperationProjectId, setCooperationProjectId] = useState('');
  const [brand, setBrand] = useState('');
  const [pm, setPm] = useState(PM_USERS[0]?.name ?? '');
  const [reason, setReason] = useState('');
  const [creatorSearch, setCreatorSearch] = useState('');
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<CreatorId[]>([]);
  const [contractIdsByCreator, setContractIdsByCreator] = useState<Record<string, ContractId[]>>({});

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
  const visibleCreators = creators.filter((creator) => (
    !query || `${creator.name}${creator.handle}${creator.region}${creator.platform}`.toLowerCase().includes(query)
  ));
  const selectedCreators = selectedCreatorIds
    .map((creatorId) => creators.find((creator) => creator.id === creatorId))
    .filter((creator): creator is CreatorProfile => Boolean(creator));

  const resolutions = useMemo(() => new Map(selectedCreators.map((creator) => [
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
  ])), [contracts, cooperationProjectId, editingRequest?.paymentRequestProjectId, invoices, requests, selectedCreators]);

  const resetForm = () => {
    setCooperationProjectId('');
    setBrand('');
    setPm(PM_USERS[0]?.name ?? '');
    setReason('');
    setCreatorSearch('');
    setSelectedCreatorIds([]);
    setContractIdsByCreator({});
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

  const openEditForm = (request: RequestProjectSummary) => {
    setCooperationProjectId(String(request.cooperationProjectId ?? request.projectId ?? ''));
    setBrand(request.brand ?? '');
    setPm(request.pm);
    setReason(request.generatedDetail?.reason ?? '');
    setCreatorSearch('');
    setSelectedCreatorIds((request.creatorLinks ?? []).map((link) => link.creatorId));
    setContractIdsByCreator(Object.fromEntries(
      (request.creatorLinks ?? []).map((link) => [link.creatorId, [...link.contractIds]]),
    ));
    setEditingRequestId(request.id);
    setSelectedRequestId(null);
    setCreating(true);
  };

  const changeProject = (value: string) => {
    setCooperationProjectId(value);
    setSelectedCreatorIds([]);
    setContractIdsByCreator({});
  };

  const toggleCreator = (creatorId: CreatorId) => {
    setSelectedCreatorIds((current) => current.includes(creatorId)
      ? current.filter((id) => id !== creatorId)
      : [...current, creatorId]);
    setContractIdsByCreator((current) => {
      if (!current[creatorId]) return current;
      const next = { ...current };
      delete next[creatorId];
      return next;
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

  const validCreatorLinks = selectedCreators.flatMap<PaymentRequestCreatorLink>((creator) => {
    const resolution = resolutions.get(creator.id);
    const invoice = resolution?.status === 'READY' ? resolution.invoice : null;
    const engagementId = invoice?.snapshot.engagementId;
    if (!invoice || !engagementId) return [];
    return [{
      creatorId: creator.id as CreatorId,
      engagementId,
      contractIds: contractIdsByCreator[creator.id] ?? [],
      invoiceId: invoice.invoiceId,
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
    const selectedInvoiceIds = validCreatorLinks.map((link) => link.invoiceId);
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
    const canSubmit = editable && submissionIssues.length === 0;
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
          <header className="project-detail-card-header"><div><h2>项目资料</h2><p>请款项目与合作项目通过稳定 ID 关联。</p></div></header>
          <dl className="project-info-grid">
            <div><dt>项目编号</dt><dd>{requestCodeFor(selectedRequest)}</dd></div>
            <div><dt>关联项目</dt><dd>{cooperationProject?.name ?? selectedRequest.cooperationProjectName ?? selectedRequest.project}<small className="cell-subtext">{selectedRequest.cooperationProjectCode ?? cooperationProject?.cooperationProjectCode ?? '待同步'}</small></dd></div>
            <div><dt>品牌</dt><dd>{selectedRequest.brand || '未填写（非必填）'}</dd></div>
            <div><dt>负责 PM</dt><dd>{selectedRequest.pm}</dd></div>
            <div className="project-info-wide"><dt>请款原因</dt><dd>{selectedRequest.generatedDetail?.reason || '待补充'}</dd></div>
          </dl>
        </section>
        <section className="project-detail-card">
          <header className="project-detail-card-header"><div><h2>达人及关联单据</h2><p>每位达人唯一关联一份 Invoice，合同可关联多份。</p></div></header>
          <div className="media-request-link-list">
            {links.map((link) => {
              const creator = creators.find((item) => item.id === link.creatorId);
              const invoice = invoices.find((item) => item.invoiceId === link.invoiceId);
              return (
                <article className="media-request-link-row" key={link.creatorId}>
                  <div><strong>{creator?.name ?? link.creatorId}</strong><small>{creator?.handle ?? '达人档案待核对'}</small></div>
                  <div><span><ReceiptText size={15} />Invoice</span><strong>{invoice?.id ?? link.invoiceId}</strong><small>{invoice?.status ?? '记录缺失'}</small></div>
                  <div><span><FileText size={15} />合同</span><strong>{link.contractIds.length ? `${link.contractIds.length} 份` : '未关联（选填）'}</strong><small>{link.contractIds.join('、') || '可不关联合同'}</small></div>
                </article>
              );
            })}
            {!links.length ? <div className="project-detail-empty">当前历史记录尚未迁移达人单据明细。</div> : null}
          </div>
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
        subtitle="管理当前媒介创建的请款草稿、退回记录和已提交项目。"
        actions={canCreate ? <Button icon={<Plus size={17} />} onClick={openCreateForm}>新建项目</Button> : undefined}
      />
      <div className="metrics-grid">
        <article className="metric-card"><span>我的项目</span><strong>{visibleRequests.length}</strong><small>仅按当前账号权限展示</small></article>
        <article className="metric-card metric-peach"><span>草稿 / 退回</span><strong>{visibleRequests.filter((request) => ['DRAFT', 'RETURNED'].includes(request.lifecycle ?? '')).length}</strong><small>可继续补充并提交</small></article>
        <article className="metric-card metric-lilac"><span>审批中</span><strong>{visibleRequests.filter((request) => Boolean(request.approval) && request.lifecycle === 'SUBMITTED').length}</strong><small>请在审批工作台查看进度</small></article>
      </div>
      <section className="content-card">
        <div className="table-scroll">
          <table className="data-table operational-table">
            <thead><tr><th>项目编号</th><th>关联项目</th><th>品牌</th><th>负责 PM</th><th>达人</th><th>请款金额</th><th>状态</th><th className="action-cell">操作</th></tr></thead>
            <tbody>
              {visibleRequests.map((request) => (
                <tr key={request.id}>
                  <td><strong>{requestCodeFor(request)}</strong></td>
                  <td><strong>{request.cooperationProjectName ?? request.project}</strong><small className="cell-subtext">{request.cooperationProjectCode ?? request.projectId ?? '待同步'}</small></td>
                  <td>{request.brand || '—'}</td>
                  <td>{request.pm}</td>
                  <td>{request.creatorLinks?.length ?? request.invoices} 位</td>
                  <td>{request.amount}</td>
                  <td><span className="project-detail-status"><i />{request.status}</span></td>
                  <td className="action-cell"><button className="text-link" type="button" onClick={() => { setSelectedRequestId(request.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>查看项目</button></td>
                </tr>
              ))}
              {!visibleRequests.length ? <tr><td colSpan={8} className="project-list-empty">当前账号暂无请款项目</td></tr> : null}
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
              <div className="media-request-creator-picker">
                <label className="media-request-creator-search"><Search size={16} /><input aria-label="搜索合作达人" placeholder="搜索姓名、Handle、地区或平台" value={creatorSearch} onChange={(event) => setCreatorSearch(event.target.value)} /></label>
                <div className="media-request-creator-options" role="listbox" aria-multiselectable="true">
                  {visibleCreators.map((creator) => {
                    const selected = selectedCreatorIds.includes(creator.id as CreatorId);
                    return <button type="button" role="option" aria-selected={selected} className={selected ? 'is-selected' : ''} key={creator.id} onClick={() => toggleCreator(creator.id as CreatorId)}><Avatar initials={creator.initials} accent={creator.accent} size="sm" /><span><strong>{creator.name}</strong><small>{creator.handle} · {creator.platform} · {creator.region}</small></span>{selected ? <CheckCircle2 size={18} /> : <Circle size={18} />}</button>;
                  })}
                </div>
              </div>
            </div>
            {selectedCreators.length ? (
              <section className="media-request-document-section">
                <header><div><h3>达人单据关联</h3><p>合同选填；每位达人必须在当前合作项目下有且只有一份 Invoice。</p></div><span>{selectedCreators.length} 位达人</span></header>
                {selectedCreators.map((creator) => {
                  const resolution = resolutions.get(creator.id);
                  const selectedContractIds = contractIdsByCreator[creator.id] ?? [];
                  return (
                    <article className="media-request-document-row" key={creator.id}>
                      <div className="media-request-document-creator"><Avatar initials={creator.initials} accent={creator.accent} size="sm" /><span><strong>{creator.name}</strong><small>{creator.handle}</small></span></div>
                      <div className={`media-request-invoice-state is-${resolution?.status.toLowerCase() ?? 'missing'}`}>
                        <span><ReceiptText size={16} />Invoice <em>必填</em></span>
                        <strong>{resolution?.invoice?.id ?? STATUS_COPY[resolution?.status ?? 'MISSING_INVOICE']}</strong>
                        <small>{resolution?.status === 'READY' ? resolution.invoice?.status : resolution?.status === 'INVOICE_IN_USE' ? `已关联 ${resolution.invoiceOwner?.requestCode ?? resolution.invoiceOwner?.id}` : resolution?.invoices.map((invoice) => invoice.id).join('、')}</small>
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
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
