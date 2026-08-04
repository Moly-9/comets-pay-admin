import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Avatar, Button, Modal, NoticeBanner, PageHeading, SelectField, StatusMark } from '../components/Common';
import { CreatorPayoutAccounts } from '../components/CreatorPayoutAccounts';
import type { ContractRecord } from '../contracts';
import { CURRENT_USER, PM_USERS, PROJECT_FIXTURES, type SystemUser } from '../data';
import { Pagination } from '../components/Pagination';
import { PayoutTable } from '../components/PayoutTable';
import { buildInvoiceReviewModel } from '../invoice/invoiceReview';
import { downloadBlob, formatInvoiceMoney, invoiceFilename, invoiceTotal } from '../invoice/invoiceUtils';
import {
  clonePayoutAccounts,
  createAirwallexPayoutAccount,
  createEmptyAirwallexAccount,
  createPayPalPayoutAccount,
  getDefaultPayoutAccount,
  getPayoutAccountStatusMeta,
} from '../payoutAccounts';
import type {
  AirwallexTransferMethod,
  CreatorInvoiceContact,
  CreatorProfile,
  CreatorSocialAccount,
  GeneratedInvoiceRecord,
  InvoiceEntity,
  Payout,
  PayoutAccountStatus,
} from '../types';
import { InvoiceDetailPage, type InvoiceDetailSource } from './InvoiceDetailPage';
import { ProjectDetailPage, type ProjectSummary } from './ProjectDetailPage';
import { RequestProjectCreatePage } from './RequestProjectCreatePage';
import { RequestProjectDetailPage, type RequestProjectSummary } from './RequestProjectDetailPage';

type Notify = (title: string, message: string) => void;
type CreatedBatch = { id: string; count: number; amount: string; provider: string } | null;

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="search-control page-search">
      <Search size={16} />
      <input aria-label={placeholder} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

type SearchableMultiFilterOption = {
  value: string;
  label: string;
  description?: string;
};

function SearchableMultiFilter({
  className = '',
  label,
  placeholder,
  searchPlaceholder,
  options,
  selected,
  onChange,
}: {
  className?: string;
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  options: SearchableMultiFilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const filteredOptions = options.filter((option) => (
    `${option.label}${option.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
  ));
  const selectedLabels = selected
    .map((value) => options.find((option) => option.value === value)?.label ?? value)
    .filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const toggleValue = (value: string) => {
    onChange(selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value]);
  };

  return (
    <div className={`searchable-multi-filter ${className}${open ? ' searchable-multi-filter-open' : ''}`.trim()} ref={rootRef}>
      <span className="project-filter-field-label">{label}</span>
      <button
        className="searchable-multi-trigger"
        type="button"
        role="combobox"
        aria-label={`${label}筛选`}
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          setOpen((current) => !current);
          if (open) setQuery('');
        }}
      >
        <span className={selectedLabels.length > 0 ? '' : 'searchable-multi-placeholder'}>
          {selectedLabels.length === 0
            ? placeholder
            : selectedLabels.length === 1
              ? selectedLabels[0]
              : `已选择 ${selectedLabels.length} 项`}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div className="searchable-multi-menu" id={listboxId} role="listbox" aria-label={`${label}选项`} aria-multiselectable="true">
          <label className="search-control searchable-multi-search">
            <Search size={15} />
            <input
              aria-label={searchPlaceholder}
              autoFocus
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="searchable-multi-options">
            {filteredOptions.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  className={`searchable-multi-option${isSelected ? ' searchable-multi-option-selected' : ''}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  key={option.value}
                  onClick={() => toggleValue(option.value)}
                >
                  <span className="searchable-multi-option-check" aria-hidden="true">{isSelected ? <Check size={13} /> : null}</span>
                  <span className="searchable-multi-option-copy">
                    <strong>{option.label}</strong>
                    {option.description ? <small>{option.description}</small> : null}
                  </span>
                </button>
              );
            })}
            {filteredOptions.length === 0 ? <div className="searchable-multi-empty">没有匹配选项</div> : null}
          </div>
          {selected.length > 0 ? (
            <button className="searchable-multi-clear" type="button" onClick={() => onChange([])}>清除已选</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, meta, tone = 'plain' }: { label: string; value: string; meta: string; tone?: 'plain' | 'peach' | 'lilac' }) {
  return <article className={`metric-card metric-${tone}`}><span>{label}</span><strong>{value}</strong><small>{meta}</small></article>;
}

type ProjectStatusTone = 'active' | 'review' | 'payment' | 'complete' | 'draft' | 'default';

const PROJECT_STATUS_TONES: Record<string, ProjectStatusTone> = {
  '执行中': 'active',
  'PM 审批中': 'active',
  '项目负责人审批中': 'active',
  '老板审批中': 'active',
  '财务审批中': 'active',
  '飞书审批中': 'active',
  '待验收': 'review',
  '待审批': 'review',
  '待补资料': 'review',
  '待财务复核': 'review',
  '付款中': 'payment',
  '待打款': 'payment',
  '等待付款': 'payment',
  '已完成': 'complete',
  '草稿': 'draft',
  '已退回': 'draft',
  '暂停': 'draft',
};

function ProjectStatus({ status }: { status: string }) {
  const tone = PROJECT_STATUS_TONES[status] ?? 'default';
  return <span className={`simple-status project-status project-status-${tone}`} data-project-status={status}><i aria-hidden="true" />{status}</span>;
}

type ProjectListFilters = {
  customers: string[];
  pms: string[];
  currency: string;
  minBudget: string;
  maxBudget: string;
  statuses: string[];
};

const createEmptyProjectListFilters = (): ProjectListFilters => ({
  customers: [],
  pms: [],
  currency: 'all',
  minBudget: '',
  maxBudget: '',
  statuses: [],
});

const parseProjectBudget = (budget: string) => ({
  currency: budget.match(/\b[A-Z]{3}\b/)?.[0] ?? '',
  amount: Number(budget.replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0] ?? 0),
});

type ProjectFilterSelectOption = {
  value: string;
  label: string;
  description?: string;
  leading?: ReactNode;
};

function ProjectInlineFilterPanel({
  search,
  filters,
  customerOptions,
  pmOptions,
  currencyOptions,
  statusOptions,
  resultCount,
  totalCount,
  invalidBudgetRange,
  onSearchChange,
  onFiltersChange,
  onClear,
}: {
  search: string;
  filters: ProjectListFilters;
  customerOptions: SearchableMultiFilterOption[];
  pmOptions: SearchableMultiFilterOption[];
  currencyOptions: ProjectFilterSelectOption[];
  statusOptions: ProjectFilterSelectOption[];
  resultCount: number;
  totalCount: number;
  invalidBudgetRange: boolean;
  onSearchChange: (value: string) => void;
  onFiltersChange: Dispatch<SetStateAction<ProjectListFilters>>;
  onClear: () => void;
}) {
  const hasBudgetFilter = filters.currency !== 'all' || Boolean(filters.minBudget || filters.maxBudget);
  const activeFilterCount = Number(filters.customers.length > 0)
    + Number(filters.pms.length > 0)
    + Number(hasBudgetFilter)
    + Number(filters.statuses.length > 0);
  const hasActiveFilters = activeFilterCount > 0 || Boolean(search.trim());
  const selectedStatus = filters.statuses[0] ?? 'all';
  const selectedStatusTone = selectedStatus === '已完成'
    ? 'complete'
    : selectedStatus === 'all'
      ? 'all'
      : 'active';

  return (
    <div className="project-inline-filter-panel" aria-label="项目列表筛选">
      <div className="project-inline-filters">
        <div className="project-filter-field project-inline-filter-search">
          <span className="project-filter-field-label">项目</span>
          <SearchBar value={search} onChange={onSearchChange} placeholder="搜索项目名称或编号" />
        </div>
        <SearchableMultiFilter
          className="project-inline-filter-customer"
          label="合作客户"
          placeholder="全部合作客户"
          searchPlaceholder="搜索合作客户"
          options={customerOptions}
          selected={filters.customers}
          onChange={(customers) => onFiltersChange((current) => ({ ...current, customers }))}
        />
        <SearchableMultiFilter
          className="project-inline-filter-pm"
          label="负责 PM"
          placeholder="全部 PM"
          searchPlaceholder="搜索 PM 姓名或邮箱"
          options={pmOptions}
          selected={filters.pms}
          onChange={(pms) => onFiltersChange((current) => ({ ...current, pms }))}
        />
        <div className="project-filter-field project-inline-filter-budget">
          <span className="project-filter-field-label">预算</span>
          <div className="project-budget-filter-grid">
            <SelectField
              ariaLabel="预算币种"
              variant="form"
              value={filters.currency}
              options={currencyOptions}
              onChange={(currency) => onFiltersChange((current) => ({ ...current, currency }))}
            />
            <label className="project-budget-input">
              <span>最低金额</span>
              <input
                aria-label="最低预算"
                inputMode="decimal"
                min="0"
                type="number"
                placeholder="不限"
                value={filters.minBudget}
                onChange={(event) => onFiltersChange((current) => ({ ...current, minBudget: event.target.value }))}
              />
            </label>
            <label className="project-budget-input">
              <span>最高金额</span>
              <input
                aria-label="最高预算"
                inputMode="decimal"
                min="0"
                type="number"
                placeholder="不限"
                value={filters.maxBudget}
                onChange={(event) => onFiltersChange((current) => ({ ...current, maxBudget: event.target.value }))}
              />
            </label>
          </div>
          {invalidBudgetRange ? <small className="project-budget-error">最高金额不能低于最低金额，当前暂不应用金额区间</small> : null}
        </div>
        <div className="project-filter-field project-inline-filter-status">
          <span className="project-filter-field-label">项目状态</span>
          <SelectField
            ariaLabel="项目状态"
            className={`project-status-select project-status-select-${selectedStatusTone}`}
            variant="form"
            value={selectedStatus}
            options={statusOptions}
            onChange={(status) => onFiltersChange((current) => ({
              ...current,
              statuses: status === 'all' ? [] : [status],
            }))}
          />
        </div>
        <div className="project-inline-filter-meta">
          <span>
            {hasActiveFilters
              ? `显示 ${resultCount} / ${totalCount} 个项目`
              : `共 ${totalCount} 个项目`}
          </span>
          {hasActiveFilters ? <button type="button" onClick={onClear}>清除全部</button> : null}
        </div>
      </div>
    </div>
  );
}

export const INITIAL_PROJECTS: ProjectSummary[] = PROJECT_FIXTURES.map((project) => ({
  id: project.id,
  name: project.name,
  brand: project.brand,
  media: project.media,
  pm: project.pm,
  creators: project.creators,
  invoiceCount: project.creators,
  budget: project.budget,
  status: project.projectStatus,
  paymentOrder: project.paymentOrder,
}));

const PROJECT_PM_ACCENTS = ['#ff7d64', '#7568e6', '#20a874'] as const;
const PROJECT_PM_OPTIONS = PM_USERS.map((user, index) => ({
  value: user.name,
  label: user.name,
  description: `${user.email} · PM 账号`,
  leading: <Avatar initials={user.initials} accent={PROJECT_PM_ACCENTS[index % PROJECT_PM_ACCENTS.length]} size="sm" />,
}));

export function ProjectsPage({
  notify,
  creators,
  currentUser,
  projects,
  contracts,
  onOpenContract,
  onProjectsChange,
  canCreateProject,
}: {
  notify: Notify;
  creators: CreatorProfile[];
  currentUser: SystemUser;
  projects: ProjectSummary[];
  contracts: ContractRecord[];
  onOpenContract: (contractId: string) => void;
  onProjectsChange: (updater: (current: ProjectSummary[]) => ProjectSummary[]) => void;
  canCreateProject: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ProjectListFilters>(createEmptyProjectListFilters);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [selectedPM, setSelectedPM] = useState(PM_USERS[0]?.name ?? '');
  const [requestReason, setRequestReason] = useState('');
  const [selectedCreatorHandles, setSelectedCreatorHandles] = useState<string[]>([]);
  const [closeGuardOpen, setCloseGuardOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const selectedProject = selectedProjectId ? projects.find((project) => project.id === selectedProjectId) : null;
  const currentScopeName = currentUser.scopeName ?? currentUser.name;
  const relatedProjects = projects.filter((project) => {
    if (currentUser.roleKey === 'media') return project.media === currentScopeName;
    if (currentUser.roleKey === 'pm') return project.pm === currentScopeName;
    return true;
  });
  const customerCounts = relatedProjects.reduce<Record<string, number>>((result, project) => ({
    ...result,
    [project.brand]: (result[project.brand] ?? 0) + 1,
  }), {});
  const customerFilterOptions = Object.entries(customerCounts).map(([customer, count]) => ({
    value: customer,
    label: customer,
    description: `${count} 个项目`,
  }));
  const pmCounts = relatedProjects.reduce<Record<string, number>>((result, project) => ({
    ...result,
    [project.pm]: (result[project.pm] ?? 0) + 1,
  }), {});
  const pmFilterOptions = PM_USERS
    .filter((user) => pmCounts[user.name])
    .map((user) => ({
      value: user.name,
      label: user.name,
      description: `${pmCounts[user.name]} 个项目 · ${user.email}`,
    }));
  const statusFilterOptions = Array.from(new Set(relatedProjects.map((project) => project.status))).map((status) => ({
    value: status,
    label: status,
    description: `${relatedProjects.filter((project) => project.status === status).length} 个项目`,
    leading: (
      <span
        className={`project-status-select-dot ${
          status === '已完成' ? 'project-status-select-dot-complete' : 'project-status-select-dot-active'
        }`}
      />
    ),
  }));
  const statusSelectOptions = [
    {
      value: 'all',
      label: '全部状态',
      description: `共 ${relatedProjects.length} 个项目`,
      leading: <span className="project-status-select-dot project-status-select-dot-all" />,
    },
    ...statusFilterOptions,
  ];
  const projectCurrencies = Array.from(new Set(relatedProjects.map((project) => parseProjectBudget(project.budget).currency).filter(Boolean)));
  const currencyFilterOptions = [
    { value: 'all', label: '全部币种' },
    ...projectCurrencies.map((currency) => ({ value: currency, label: currency })),
  ];
  const query = search.trim().toLowerCase();
  const minBudget = filters.minBudget ? Number(filters.minBudget) : null;
  const maxBudget = filters.maxBudget ? Number(filters.maxBudget) : null;
  const invalidBudgetRange = minBudget !== null && maxBudget !== null && minBudget > maxBudget;
  const visible = relatedProjects.filter((project) => {
    const budget = parseProjectBudget(project.budget);
    const matchesSearch = !query || `${project.name}${project.id}`.toLowerCase().includes(query);
    const matchesCustomer = filters.customers.length === 0 || filters.customers.includes(project.brand);
    const matchesPM = filters.pms.length === 0 || filters.pms.includes(project.pm);
    const matchesCurrency = filters.currency === 'all' || filters.currency === budget.currency;
    const matchesMinBudget = invalidBudgetRange || minBudget === null || budget.amount >= minBudget;
    const matchesMaxBudget = invalidBudgetRange || maxBudget === null || budget.amount <= maxBudget;
    const matchesStatus = filters.statuses.length === 0 || filters.statuses.includes(project.status);
    return matchesSearch && matchesCustomer && matchesPM && matchesCurrency && matchesMinBudget && matchesMaxBudget && matchesStatus;
  });
  const clearProjectFilters = () => {
    setSearch('');
    setFilters(createEmptyProjectListFilters());
  };
  const draftStorageKey = `comets-pay.project-draft.v1:${currentUser.account}`;
  const hasProjectDraftContent = Boolean(
    name.trim()
    || brand.trim()
    || requestReason.trim()
    || selectedCreatorHandles.length
    || selectedPM !== (PM_USERS[0]?.name ?? ''),
  );

  const resetProjectForm = () => {
    setName('');
    setBrand('');
    setSelectedPM(PM_USERS[0]?.name ?? '');
    setRequestReason('');
    setSelectedCreatorHandles([]);
  };

  const discardProjectDraft = () => {
    localStorage.removeItem(draftStorageKey);
    resetProjectForm();
    setCloseGuardOpen(false);
    setModalOpen(false);
  };

  const requestCloseProjectModal = () => {
    if (hasProjectDraftContent) {
      setCloseGuardOpen(true);
      return;
    }
    discardProjectDraft();
  };

  const saveProjectDraft = () => {
    localStorage.setItem(draftStorageKey, JSON.stringify({
      name,
      customer: brand,
      selectedPM,
      requestReason,
      selectedCreatorHandles,
      savedAt: new Date().toISOString(),
    }));
    setCloseGuardOpen(false);
    setModalOpen(false);
    notify('项目草稿已保存', '下次打开新建项目时会自动恢复。');
  };

  const openProjectModal = () => {
    resetProjectForm();
    const saved = localStorage.getItem(draftStorageKey);
    if (saved) {
      try {
        const draft = JSON.parse(saved) as {
          name?: string;
          customer?: string;
          selectedPM?: string;
          requestReason?: string;
          selectedCreatorHandles?: string[];
        };
        const validPM = PM_USERS.some((user) => user.name === draft.selectedPM);
        const creatorHandleSet = new Set(creators.map((creator) => creator.handle));
        const validHandles = (draft.selectedCreatorHandles ?? []).filter((handle) => creatorHandleSet.has(handle));
        setName(draft.name ?? '');
        setBrand(draft.customer ?? '');
        setSelectedPM(validPM ? draft.selectedPM! : (PM_USERS[0]?.name ?? ''));
        setRequestReason(draft.requestReason ?? '');
        setSelectedCreatorHandles(validHandles);
        notify(
          !validPM || validHandles.length !== (draft.selectedCreatorHandles ?? []).length
            ? '草稿已恢复并校正'
            : '项目草稿已恢复',
          !validPM || validHandles.length !== (draft.selectedCreatorHandles ?? []).length
            ? '已移除当前系统中不存在的 PM 或达人关联。'
            : '已恢复上次未完成的项目内容。',
        );
      } catch {
        localStorage.removeItem(draftStorageKey);
      }
    }
    setModalOpen(true);
  };

  const createProject = () => {
    if (!name.trim() || !selectedPM || selectedCreatorHandles.length === 0) return;
    const selectedCreatorProfiles = creators.filter((creator) => selectedCreatorHandles.includes(creator.handle));
    if (selectedCreatorProfiles.length === 0) return;
    const projectId = `PRJ-${Date.now().toString().slice(-6)}`;
    onProjectsChange((current) => [{
      id: projectId,
      name: name.trim(),
      brand: brand.trim() || '待补充品牌',
      media: currentUser.name,
      pm: selectedPM,
      creators: selectedCreatorProfiles.length,
      creatorProfiles: selectedCreatorProfiles.map((creator) => ({
        creatorId: creator.id,
        engagementId: `ENG-${projectId}-${creator.id}`,
        name: creator.name,
        handle: creator.handle,
        platform: creator.platform,
      })),
      requestReason: requestReason.trim(),
      invoiceCount: 0,
      budget: 'USD 0',
      status: '草稿',
    }, ...current]);
    localStorage.removeItem(draftStorageKey);
    resetProjectForm();
    setModalOpen(false);
    notify('项目已创建', `新项目已保存为草稿，已关联 ${selectedCreatorProfiles.length} 位合作达人。合同与 Invoice 请在后续独立流程中关联。`);
  };

  const updateProjectCreators = (projectId: string, creatorHandles: string[]) => {
    const selectedHandleSet = new Set(creatorHandles);
    const selectedCreatorProfiles = creators.filter((creator) => selectedHandleSet.has(creator.handle));
    onProjectsChange((current) => current.map((project) => (
      project.id === projectId
        ? {
            ...project,
            creators: selectedCreatorProfiles.length,
            creatorProfiles: selectedCreatorProfiles.map((creator) => ({
              creatorId: creator.id,
              engagementId: project.creatorProfiles?.find((item) => item.creatorId === creator.id)?.engagementId
                ?? `ENG-${project.id}-${creator.id}`,
              name: creator.name,
              handle: creator.handle,
              platform: creator.platform,
            })),
          }
        : project
    )));
  };

  if (selectedProject) {
    return (
      <ProjectDetailPage
        project={selectedProject}
        creatorArchive={creators}
        notify={notify}
        contracts={contracts}
        onOpenContract={onOpenContract}
        onUpdateCreators={(creatorHandles) => updateProjectCreators(selectedProject.id, creatorHandles)}
        onBack={() => {
          setSelectedProjectId(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        title="我的项目"
        subtitle="仅展示与当前账号关联的项目，集中管理项目合同与invoice、达人名单、请款进度。"
        actions={canCreateProject ? <Button icon={<Plus size={17} />} onClick={openProjectModal}>新建项目</Button> : undefined}
      />
      <div className="metrics-grid"><MetricCard label="审核中" value="5" meta="2 个待审批 · 3 个审批中" tone="peach" /><MetricCard label="待打款" value="1" meta="已完成全部审批" /><MetricCard label="请款项目总数" value={relatedProjects.length.toString()} meta="已同步真实项目名称" tone="lilac" /></div>
      <section className="content-card">
        <ProjectInlineFilterPanel
          search={search}
          filters={filters}
          customerOptions={customerFilterOptions}
          pmOptions={pmFilterOptions}
          currencyOptions={currencyFilterOptions}
          statusOptions={statusSelectOptions}
          resultCount={visible.length}
          totalCount={relatedProjects.length}
          invalidBudgetRange={invalidBudgetRange}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onClear={clearProjectFilters}
        />
        <div className="table-scroll">
          <table className="data-table operational-table">
            <thead><tr><th>项目</th><th>合作客户</th><th>负责 PM</th><th>达人</th><th>预算</th><th>状态</th><th className="action-cell">操作</th></tr></thead>
            <tbody>
              {visible.map((project) => (
                <tr key={project.id}>
                  <td><strong>{project.name}</strong><small className="cell-subtext">{project.id}</small></td>
                  <td>{project.brand}</td>
                  <td>{project.pm}</td>
                  <td>{project.creators} 位</td>
                  <td>{project.budget}</td>
                  <td><ProjectStatus status={project.status} /></td>
                  <td className="action-cell"><button className="text-link" type="button" onClick={() => { setSelectedProjectId(project.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>查看项目</button></td>
                </tr>
              ))}
              {visible.length === 0 ? <tr><td className="project-list-empty" colSpan={7}>暂无符合当前搜索与筛选条件的项目</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      {modalOpen ? (
        <Modal
          title="新建项目"
          onClose={requestCloseProjectModal}
          width="760px"
          footer={<><Button variant="ghost" onClick={requestCloseProjectModal}>取消</Button><Button disabled={!name.trim() || !selectedPM || selectedCreatorHandles.length === 0} onClick={createProject}>创建项目</Button></>}
        >
          <div className="form-grid single-column project-create-form">
            <label>
              <span className="required-field-label">项目名称 <em className="required-mark" aria-hidden="true">*</em></span>
              <input required aria-required="true" autoFocus placeholder="例如：秋季新品首发" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              <span>客户</span>
              <input placeholder="输入合作客户" value={brand} onChange={(event) => setBrand(event.target.value)} />
            </label>
            <div className="form-field project-pm-field">
              <span className="form-field-label">项目PM</span>
              <SelectField
                ariaLabel="选择项目PM"
                className="project-pm-select"
                variant="form"
                value={selectedPM}
                options={PROJECT_PM_OPTIONS}
                onChange={setSelectedPM}
                placeholder="请选择 PM 账号"
              />
            </div>
            <label>
              <span>请款原因</span>
              <textarea placeholder="填写本项目的请款背景或用途" value={requestReason} onChange={(event) => setRequestReason(event.target.value)} />
            </label>
            <div className="form-field">
              <span className="form-field-label form-field-label-with-meta">
                <span>合作达人 <em className="required-mark" aria-hidden="true">*</em></span>
                <small>必填 · 来自达人档案</small>
              </span>
              <ProjectCreatorPicker creators={creators} selectedHandles={selectedCreatorHandles} onChange={setSelectedCreatorHandles} />
            </div>
            <NoticeBanner>
              后续关联：合同与 Invoice 将在项目创建后分别通过合同管理和 Invoice 流程关联，避免在项目基础信息未确定时绑定业务单据。
            </NoticeBanner>
          </div>
        </Modal>
      ) : null}
      {closeGuardOpen ? (
        <Modal
          title="保留未完成的项目？"
          onClose={() => setCloseGuardOpen(false)}
          width="520px"
          footer={(
            <>
              <Button variant="ghost" onClick={discardProjectDraft}>放弃并退出</Button>
              <Button variant="secondary" onClick={saveProjectDraft}>保存草稿并退出</Button>
              <Button onClick={() => setCloseGuardOpen(false)}>继续编辑</Button>
            </>
          )}
        >
          <p className="project-draft-guard-copy">当前表单已有内容。草稿仅保存在此账号当前浏览器中，不会提交审批或同步到其他设备。</p>
        </Modal>
      ) : null}
    </div>
  );
}

export const INITIAL_REQUEST_PROJECTS: RequestProjectSummary[] = [
  ...PROJECT_FIXTURES.map((project) => ({
    id: project.id,
    project: project.name,
    brand: project.brand,
    media: project.media,
    pm: project.pm,
    amount: project.budget,
    contracts: project.creators,
    invoices: project.creators,
    paymentOrder: project.paymentOrder,
    status: project.requestStatus,
    filter: project.requestFilter,
  })),
];

export function RequestsPage({
  notify,
  contracts,
  currentUser,
  requests,
  onRequestCreated,
  canCreateRequest,
}: {
  notify: Notify;
  contracts: ContractRecord[];
  currentUser: SystemUser;
  requests: RequestProjectSummary[];
  onRequestCreated: (request: RequestProjectSummary) => void;
  canCreateRequest: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ProjectListFilters>(createEmptyProjectListFilters);
  const [creating, setCreating] = useState(false);
  const [showApprovalNotice, setShowApprovalNotice] = useState(true);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const selectedRequest = selectedRequestId ? requests.find((request) => request.id === selectedRequestId) : null;
  const currentScopeName = currentUser.scopeName ?? currentUser.name;
  const relatedRequests = requests.filter((request) => {
    if (currentUser.roleKey === 'media') return request.media === currentScopeName;
    if (currentUser.roleKey === 'pm') return request.pm === currentScopeName;
    return true;
  });
  const requestOverview = relatedRequests.reduce((summary, request) => {
    if (request.status === '待审批') summary.pendingApproval += 1;
    if (request.status.includes('审批中')) summary.approvalInProgress += 1;
    if (request.status === '待打款') summary.awaitingPayment += 1;
    if (request.status === '已完成') summary.completed += 1;
    if (request.status === '待补资料' || request.status === '已退回') summary.needsAttention += 1;
    return summary;
  }, {
    pendingApproval: 0,
    approvalInProgress: 0,
    awaitingPayment: 0,
    completed: 0,
    needsAttention: 0,
  });
  const requestCustomerCounts = relatedRequests.reduce<Record<string, number>>((result, request) => ({
    ...result,
    [request.brand]: (result[request.brand] ?? 0) + 1,
  }), {});
  const requestCustomerFilterOptions = Object.entries(requestCustomerCounts).map(([customer, count]) => ({
    value: customer,
    label: customer,
    description: `${count} 个项目`,
  }));
  const requestPmCounts = relatedRequests.reduce<Record<string, number>>((result, request) => ({
    ...result,
    [request.pm]: (result[request.pm] ?? 0) + 1,
  }), {});
  const requestPmFilterOptions = PM_USERS
    .filter((user) => requestPmCounts[user.name])
    .map((user) => ({
      value: user.name,
      label: user.name,
      description: `${requestPmCounts[user.name]} 个项目 · ${user.email}`,
    }));
  const requestStatusFilterOptions = Array.from(new Set(relatedRequests.map((request) => request.status))).map((status) => ({
    value: status,
    label: status,
    description: `${relatedRequests.filter((request) => request.status === status).length} 个项目`,
    leading: (
      <span
        className={`project-status-select-dot ${
          status === '已完成' ? 'project-status-select-dot-complete' : 'project-status-select-dot-active'
        }`}
      />
    ),
  }));
  const requestStatusSelectOptions = [
    {
      value: 'all',
      label: '全部状态',
      description: `共 ${relatedRequests.length} 个项目`,
      leading: <span className="project-status-select-dot project-status-select-dot-all" />,
    },
    ...requestStatusFilterOptions,
  ];
  const requestCurrencies = Array.from(new Set(
    relatedRequests.map((request) => parseProjectBudget(request.amount).currency).filter(Boolean),
  ));
  const requestCurrencyFilterOptions = [
    { value: 'all', label: '全部币种' },
    ...requestCurrencies.map((currency) => ({ value: currency, label: currency })),
  ];
  const requestQuery = search.trim().toLowerCase();
  const requestMinBudget = filters.minBudget ? Number(filters.minBudget) : null;
  const requestMaxBudget = filters.maxBudget ? Number(filters.maxBudget) : null;
  const invalidRequestBudgetRange = requestMinBudget !== null
    && requestMaxBudget !== null
    && requestMinBudget > requestMaxBudget;
  const visibleRequests = relatedRequests.filter((request) => {
    const budget = parseProjectBudget(request.amount);
    const matchesSearch = !requestQuery || `${request.project}${request.id}`.toLowerCase().includes(requestQuery);
    const matchesCustomer = filters.customers.length === 0 || filters.customers.includes(request.brand);
    const matchesPM = filters.pms.length === 0 || filters.pms.includes(request.pm);
    const matchesCurrency = filters.currency === 'all' || filters.currency === budget.currency;
    const matchesMinBudget = invalidRequestBudgetRange || requestMinBudget === null || budget.amount >= requestMinBudget;
    const matchesMaxBudget = invalidRequestBudgetRange || requestMaxBudget === null || budget.amount <= requestMaxBudget;
    const matchesStatus = filters.statuses.length === 0 || filters.statuses.includes(request.status);
    return matchesSearch && matchesCustomer && matchesPM && matchesCurrency && matchesMinBudget && matchesMaxBudget && matchesStatus;
  });

  const clearRequestFilters = () => {
    setSearch('');
    setFilters(createEmptyProjectListFilters());
  };

  const openRequest = (requestId: string) => {
    setSelectedRequestId(requestId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (creating) {
    return (
      <RequestProjectCreatePage
        contracts={contracts}
        currentUser={currentUser}
        notify={notify}
        onCancel={() => setCreating(false)}
        onCreated={(request) => {
          onRequestCreated(request);
          setCreating(false);
          setSelectedRequestId(request.id);
          notify(
            '付款项目已提交审批',
            request.contracts > 0
              ? `${request.id} 已关联合同与Invoice，付款清单 ${request.paymentOrder} 已生成。`
              : `${request.id} 未关联合同，已根据Invoice生成付款清单 ${request.paymentOrder} 并提交审批。`,
          );
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  if (selectedRequest) {
    return (
      <RequestProjectDetailPage
        request={selectedRequest}
        notify={notify}
        onBack={() => {
          setSelectedRequestId(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        title="请款项目"
        subtitle="系统请款项目列表，仅展示与当前账号关联项目。"
        actions={canCreateRequest ? <Button icon={<Plus size={17} />} onClick={() => setCreating(true)}>新建付款项目</Button> : undefined}
      />
      <div className="metrics-grid">
        <MetricCard
          label="审批中"
          value={(requestOverview.pendingApproval + requestOverview.approvalInProgress).toString()}
          meta={`${requestOverview.pendingApproval} 个待审批 · ${requestOverview.approvalInProgress} 个审批中`}
          tone="peach"
        />
        <MetricCard
          label="待打款"
          value={requestOverview.awaitingPayment.toString()}
          meta="已完成全部审批"
        />
        <MetricCard
          label="请款项目总数"
          value={relatedRequests.length.toString()}
          meta={`${requestOverview.completed} 个已完成 · ${requestOverview.needsAttention} 个需处理`}
          tone="lilac"
        />
      </div>
      {showApprovalNotice ? (
        <NoticeBanner onClose={() => setShowApprovalNotice(false)}>
          审批流程：媒介提交 → PM 审批 → 项目负责人审批 → 老板审批 → 财务审批；全部通过后才会解锁打款，退回原因会同步给提交人。
        </NoticeBanner>
      ) : null}
      <section className="content-card">
        <ProjectInlineFilterPanel
          search={search}
          filters={filters}
          customerOptions={requestCustomerFilterOptions}
          pmOptions={requestPmFilterOptions}
          currencyOptions={requestCurrencyFilterOptions}
          statusOptions={requestStatusSelectOptions}
          resultCount={visibleRequests.length}
          totalCount={relatedRequests.length}
          invalidBudgetRange={invalidRequestBudgetRange}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onClear={clearRequestFilters}
        />
        <div className="table-scroll">
          <table className="data-table operational-table request-project-table">
            <thead><tr><th>项目</th><th>媒介</th><th>负责 PM</th><th>请款金额</th><th>合同</th><th>invoice</th><th>付款单</th><th>项目状态</th><th className="action-cell">操作</th></tr></thead>
            <tbody>
              {visibleRequests.map((request) => (
                <tr className="clickable-table-row" key={request.id} onClick={() => openRequest(request.id)}>
                  <td><button className="request-project-link" type="button" onClick={(event) => { event.stopPropagation(); openRequest(request.id); }}><strong>{request.project}</strong><small className="cell-subtext">{request.id}</small></button></td>
                  <td>{request.media}</td>
                  <td>{request.pm}</td>
                  <td>{request.amount}</td>
                  <td>{request.contracts} 份</td>
                  <td>{request.invoices} 份</td>
                  <td className="mono-cell">{request.paymentOrder}</td>
                  <td><ProjectStatus status={request.status} /></td>
                  <td className="action-cell"><button className="text-link" type="button" onClick={(event) => { event.stopPropagation(); openRequest(request.id); }}>查看</button></td>
                </tr>
              ))}
              {visibleRequests.length === 0 ? <tr><td className="request-project-empty" colSpan={9}>暂无符合条件的请款项目</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

type ContactFieldDefinition = {
  key: keyof CreatorInvoiceContact;
  label: string;
  alias: string;
  placeholder: string;
  fullWidth?: boolean;
  inputType?: 'text' | 'email' | 'tel';
};

const INVOICE_CONTACT_FIELDS: ContactFieldDefinition[] = [
  { key: 'legalName', label: '真实姓名', alias: 'Real Name', placeholder: '请输入证件或合同中的真实姓名' },
  { key: 'phone', label: '联系电话', alias: 'Tel', placeholder: '请输入含国家区号的联系电话', inputType: 'tel' },
  { key: 'email', label: '联系邮箱', alias: 'Email', placeholder: '请输入达人联系邮箱', inputType: 'email' },
  { key: 'address', label: '联系地址', alias: 'Address', placeholder: '请输入 Invoice 中展示的完整地址', fullWidth: true },
];

const createInvoiceContact = (
  legalName: string,
  email: string,
  phone: string,
  address: string,
): CreatorInvoiceContact => ({ legalName, email, phone, address });

const normalizeSocialHandle = (handle: string) => {
  const normalized = handle.trim();
  if (!normalized) return '';
  return normalized.startsWith('@') ? normalized : `@${normalized}`;
};

const defaultSocialProfileUrl = (platform: string, handle: string) => {
  const username = normalizeSocialHandle(handle).replace(/^@/, '');
  if (!username) return '';
  const normalizedPlatform = platform.trim().toLowerCase();
  if (normalizedPlatform === 'instagram') return `https://www.instagram.com/${username}`;
  if (normalizedPlatform === 'tiktok') return `https://www.tiktok.com/@${username}`;
  if (normalizedPlatform === 'youtube') return `https://www.youtube.com/@${username}`;
  if (normalizedPlatform === 'x' || normalizedPlatform === 'twitter') return `https://x.com/${username}`;
  if (normalizedPlatform === 'facebook') return `https://www.facebook.com/${username}`;
  if (normalizedPlatform === 'twitch') return `https://www.twitch.tv/${username}`;
  return '';
};

const createSocialAccount = (
  id: string,
  platform = '',
  handle = '',
  profileUrl = '',
): CreatorSocialAccount => ({
  id,
  platform,
  handle,
  profileUrl: profileUrl || defaultSocialProfileUrl(platform, handle),
});

const createSocialAccountsFromSummary = (
  creatorId: string,
  platformSummary: string,
  handle: string,
) => platformSummary
  .split('·')
  .map((platform) => platform.trim())
  .filter(Boolean)
  .map((platform, index) => createSocialAccount(
    `social-${creatorId}-${index + 1}`,
    platform,
    normalizeSocialHandle(handle),
  ));

type CreatorBankSeed = {
  countryCode: string;
  countryName: string;
  currency: string;
  accountNumber?: string;
  iban?: string;
  accountCategory?: string;
  bankName: string;
  swiftCode?: string;
  transferMethod?: AirwallexTransferMethod;
  clearingSystem?: string;
  routingType1?: string;
  routingValue1?: string;
  routingType2?: string;
  routingValue2?: string;
  streetAddress: string;
  city: string;
  state?: string;
  postcode?: string;
  status?: PayoutAccountStatus;
};

type CreatorPayPalSeed = {
  username: string;
  email: string;
  nickname?: string;
  status?: PayoutAccountStatus;
};

type CreatorSeed = Omit<CreatorProfile, 'payoutAccounts' | 'socialAccounts'> & {
  socialAccounts?: CreatorSocialAccount[];
  bank?: CreatorBankSeed;
  paypal?: CreatorPayPalSeed;
  defaultPayoutProvider?: 'Airwallex' | 'PayPal';
};

const createSeedCreator = ({
  bank,
  paypal,
  defaultPayoutProvider,
  socialAccounts,
  ...creator
}: CreatorSeed): CreatorProfile => {
  const [firstName = '', ...lastNameParts] = creator.contact.legalName.trim().split(/\s+/);
  const paypalIsDefault = Boolean(paypal && (defaultPayoutProvider === 'PayPal' || !bank));
  const payoutAccounts: CreatorProfile['payoutAccounts'] = [];

  if (bank) {
    const status = bank.status ?? 'VERIFIED';
    const isValidated = !['DRAFT', 'READY_FOR_VALIDATION'].includes(status);
    payoutAccounts.push(createAirwallexPayoutAccount({
      id: `awx-${creator.id}`,
      nickname: `${bank.countryName} ${bank.currency} 主账户`,
      isDefault: !paypalIsDefault,
      status,
      beneficiaryId: isValidated ? `bene_demo_${creator.id.replace('creator-', '')}` : '',
      entityType: 'PERSONAL',
      firstName,
      lastName: lastNameParts.join(' '),
      notificationEmail: creator.contact.email,
      address: {
        countryCode: bank.countryCode,
        streetAddress: bank.streetAddress,
        city: bank.city,
        state: bank.state ?? '',
        postcode: bank.postcode ?? '',
      },
      transferMethod: bank.transferMethod ?? 'LOCAL',
      bankDetails: {
        bankCountryCode: bank.countryCode,
        bankCountryName: bank.countryName,
        accountCurrency: bank.currency,
        accountName: creator.contact.legalName,
        accountNumber: bank.accountNumber ?? '',
        iban: bank.iban ?? '',
        bankAccountCategory: bank.accountCategory ?? 'Checking',
        accountRoutingType1: bank.routingType1 ?? '',
        accountRoutingValue1: bank.routingValue1 ?? '',
        accountRoutingType2: bank.routingType2 ?? '',
        accountRoutingValue2: bank.routingValue2 ?? '',
        localClearingSystem: bank.clearingSystem ?? '',
        bankName: bank.bankName,
        bankStreetAddress: bank.streetAddress,
        bankState: bank.state ?? '',
        swiftCode: bank.swiftCode ?? '',
      },
      verificationCode: status === 'VERIFIED' || status === 'REVIEW_REQUIRED'
        ? 'VERIFIED'
        : status === 'CANNOT_VERIFY'
          ? 'CANNOT_VERIFY'
          : status === 'INVALID'
            ? 'INVALID'
            : '',
      nameMatchResult: status === 'VERIFIED'
        ? 'FULL_MATCH'
        : status === 'REVIEW_REQUIRED'
          ? 'PARTIAL_MATCH'
          : '',
      validatedAt: isValidated ? '2026-07-18 10:30' : '',
      verifiedAt: status === 'VERIFIED' || status === 'REVIEW_REQUIRED' || status === 'CANNOT_VERIFY'
        ? '2026-07-18 10:31'
        : '',
    }));
  }

  if (paypal) {
    payoutAccounts.push(createPayPalPayoutAccount({
      id: `paypal-${creator.id}`,
      nickname: paypal.nickname ?? (bank ? 'PayPal 备用账户' : 'PayPal 主账户'),
      isDefault: paypalIsDefault,
      status: paypal.status ?? 'READY_FOR_VALIDATION',
      paypalUsername: paypal.username,
      paypalEmail: paypal.email,
    }));
  }

  if (payoutAccounts.length === 0) {
    throw new Error(`${creator.name} 至少需要一个收款账户`);
  }

  return {
    ...creator,
    socialAccounts: socialAccounts?.map((account) => ({ ...account }))
      ?? createSocialAccountsFromSummary(creator.id, creator.platform, creator.handle),
    payoutAccounts,
  };
};

export const INITIAL_CREATORS: CreatorProfile[] = [
  createSeedCreator({
    id: 'creator-mina', initials: 'MK', accent: '#f59e0b', name: 'Mina Kato', handle: '@MinaKato', region: '日本', platform: 'Instagram · TikTok', projects: 4,
    contact: createInvoiceContact('Mina Kato', 'mina.kato@creator.example', '+81 90 0000 1024', 'Shibuya-ku, Tokyo, Japan'),
    bank: { countryCode: 'JP', countryName: 'Japan', currency: 'JPY', accountNumber: '0000000001', accountCategory: 'Savings', bankName: 'MUFG Bank', clearingSystem: 'ZENGIN', routingType1: 'bank_code', routingValue1: '0005', routingType2: 'branch_code', routingValue2: '001', streetAddress: '2-7-1 Marunouchi', city: 'Chiyoda-ku', state: 'Tokyo', postcode: '100-8388' },
    paypal: { username: 'minakato.creator', email: 'mina.kato@example.com' },
  }),
  createSeedCreator({
    id: 'creator-alex', initials: 'AR', accent: '#3b82f6', name: 'Alex Ruiz', handle: '@alexbuilds', region: '西班牙', platform: 'YouTube', projects: 2,
    contact: createInvoiceContact('Alejandro Ruiz', 'alex.ruiz@creator.example', '+34 600 000 218', 'Calle de Serrano, Madrid, Spain'),
    bank: { countryCode: 'ES', countryName: 'Spain', currency: 'EUR', iban: 'ES00 DEMO 0000 0000 0000 0000', bankName: 'Banco Bilbao Vizcaya Argentaria', clearingSystem: 'SEPA', streetAddress: 'Calle Azul 4', city: 'Madrid', state: 'Madrid', postcode: '28001' },
    paypal: { username: 'alexbuilds', email: 'alex.ruiz@example.com', nickname: 'PayPal EUR 主账户', status: 'VERIFIED' },
    defaultPayoutProvider: 'PayPal',
  }),
  createSeedCreator({
    id: 'creator-nika', initials: 'NK', accent: '#ef4444', name: 'Nika Petrova', handle: '@nika.spark', region: '泰国', platform: 'TikTok', projects: 3,
    contact: createInvoiceContact('Nika Petrova', 'nika.petrova@creator.example', '+66 80 000 9731', 'Bang Rak, Bangkok, Thailand'),
    bank: { countryCode: 'TH', countryName: 'Thailand', currency: 'THB', accountNumber: '0000000004', bankName: 'Bangkok Bank', clearingSystem: 'PromptPay', routingType1: 'bank_code', routingValue1: '', streetAddress: '333 Silom Road', city: 'Bangkok', state: 'Bangkok', postcode: '10500', status: 'DRAFT' },
  }),
  createSeedCreator({
    id: 'creator-luna', initials: 'LJ', accent: '#a855f7', name: 'Luna Jones', handle: '@Luna_J', region: '美国', platform: 'Instagram', projects: 5,
    contact: createInvoiceContact('Luna Jones', 'luna.jones@creator.example', '+1 212 555 0146', 'New York, NY, United States'),
    bank: { countryCode: 'US', countryName: 'United States', currency: 'USD', accountNumber: '0000000006', bankName: 'JPMorgan Chase Bank', clearingSystem: 'ACH', routingType1: 'aba', routingValue1: '000000000', streetAddress: '270 Park Avenue', city: 'New York', state: 'New York', postcode: '10017' },
    paypal: { username: 'luna.jones', email: 'luna.jones@example.com' },
  }),
  createSeedCreator({
    id: 'creator-yuki', initials: 'YT', accent: '#ec4899', name: 'Yuki Tanaka', handle: '@yuki.tokyo', region: '日本', platform: 'Instagram', projects: 3,
    contact: createInvoiceContact('Yuki Tanaka', 'yuki.tanaka@creator.example', '+81 80 0000 3128', 'Minato-ku, Tokyo, Japan'),
    paypal: { username: 'yuki.tokyo', email: 'yuki.tanaka@example.com', nickname: 'PayPal USD 主账户', status: 'VERIFIED' },
  }),
  createSeedCreator({
    id: 'creator-camila', initials: 'CC', accent: '#f97316', name: 'Camila Costa', handle: '@camila.beauty', region: '巴西', platform: 'Instagram · TikTok', projects: 6,
    contact: createInvoiceContact('Camila Costa', 'camila.costa@creator.example', '+55 11 90000 4206', 'Jardins, Sao Paulo, Brazil'),
    bank: { countryCode: 'BR', countryName: 'Brazil', currency: 'BRL', accountNumber: '0000000002', bankName: 'Itau Unibanco', clearingSystem: 'PIX', routingType1: 'bank_code', routingValue1: '341', routingType2: 'branch_code', routingValue2: '0156', streetAddress: 'Avenida Paulista 1294', city: 'Sao Paulo', state: 'Sao Paulo', postcode: '01310-100', status: 'REVIEW_REQUIRED' },
    paypal: { username: 'camila.beauty', email: 'camila.costa@example.com' },
  }),
  createSeedCreator({
    id: 'creator-oliver', initials: 'OC', accent: '#06b6d4', name: 'Oliver Chen', handle: '@oliver.tech', region: '新加坡', platform: 'YouTube', projects: 2,
    contact: createInvoiceContact('Oliver Chen', 'oliver.chen@creator.example', '+65 8000 5319', 'Tanjong Pagar, Singapore'),
    bank: { countryCode: 'SG', countryName: 'Singapore', currency: 'SGD', accountNumber: '0000000003', bankName: 'DBS Bank', clearingSystem: 'FAST', routingType1: 'bank_code', routingValue1: '7171', routingType2: 'branch_code', routingValue2: '006', streetAddress: '12 Marina Boulevard', city: 'Singapore', state: 'Singapore', postcode: '018982', status: 'CANNOT_VERIFY' },
  }),
  createSeedCreator({
    id: 'creator-hannah', initials: 'HL', accent: '#8b5cf6', name: 'Hannah Lee', handle: '@hannah.home', region: '韩国', platform: 'Instagram', projects: 4,
    contact: createInvoiceContact('Hannah Lee', 'hannah.lee@creator.example', '+82 10 0000 6412', 'Mapo-gu, Seoul, South Korea'),
    paypal: { username: 'hannah.home', email: 'hannah.lee@example.com', nickname: 'PayPal USD 主账户', status: 'VERIFIED' },
  }),
  createSeedCreator({
    id: 'creator-luca', initials: 'LB', accent: '#6366f1', name: 'Luca Bianchi', handle: '@luca.style', region: '意大利', platform: 'Instagram · TikTok', projects: 5,
    contact: createInvoiceContact('Luca Bianchi', 'luca.bianchi@creator.example', '+39 320 000 7514', 'Torino, Piemonte, Italy'),
    bank: { countryCode: 'IT', countryName: 'Italy', currency: 'EUR', iban: 'IT00 DEMO 0000 0000 0000 0000', bankName: 'Intesa Sanpaolo', clearingSystem: 'SEPA', streetAddress: 'Piazza San Carlo 156', city: 'Torino', state: 'Torino', postcode: '10121', status: 'VALIDATED' },
  }),
  createSeedCreator({
    id: 'creator-emily', initials: 'EW', accent: '#14b8a6', name: 'Emily Wong', handle: '@emily.travel', region: '中国香港', platform: 'YouTube · Instagram', projects: 3,
    contact: createInvoiceContact('Emily Wong', 'emily.wong@creator.example', '+852 6000 8621', 'Wan Chai, Hong Kong, China'),
    bank: { countryCode: 'HK', countryName: 'Hong Kong SAR China', currency: 'HKD', accountNumber: '000000005', bankName: 'HSBC Hong Kong', clearingSystem: 'FPS', routingType1: 'bank_code', routingValue1: '004', routingType2: 'branch_code', routingValue2: '621', streetAddress: '1 Queen\'s Road Central', city: 'Hong Kong', state: 'Hong Kong', postcode: '000000', status: 'READY_FOR_VALIDATION' },
  }),
  createSeedCreator({
    id: 'creator-kenji', initials: 'KM', accent: '#22c55e', name: 'Kenji Mori', handle: '@kenji.moves', region: '日本', platform: 'YouTube', projects: 7,
    contact: createInvoiceContact('Kenji Mori', 'kenji.mori@creator.example', '+81 70 0000 9735', 'Setagaya-ku, Tokyo, Japan'),
    bank: { countryCode: 'JP', countryName: 'Japan', currency: 'JPY', accountNumber: '0000000007', accountCategory: 'Savings', bankName: 'Mizuho Bank', clearingSystem: 'ZENGIN', routingType1: 'bank_code', routingValue1: '0001', routingType2: 'branch_code', routingValue2: '122', streetAddress: '1-5-5 Otemachi', city: 'Chiyoda-ku', state: 'Tokyo', postcode: '100-8176' },
  }),
  createSeedCreator({
    id: 'creator-sofia', initials: 'SM', accent: '#d946ef', name: 'Sofia Martinez', handle: '@sofia.daily', region: '墨西哥', platform: 'TikTok', projects: 2,
    contact: createInvoiceContact('Sofia Martinez', 'sofia.martinez@creator.example', '+52 55 0000 1842', 'Cuauhtemoc, Mexico City, Mexico'),
    bank: { countryCode: 'MX', countryName: 'Mexico', currency: 'MXN', accountNumber: '000000000008', bankName: 'BBVA Mexico', clearingSystem: 'SPEI', routingType1: 'clabe', routingValue1: '000000000000000000', streetAddress: 'Paseo de la Reforma 510', city: 'Mexico City', state: 'Mexico City', postcode: '06600' },
  }),
  createSeedCreator({
    id: 'creator-marc', initials: 'MO', accent: '#64748b', name: 'Marc Olivier', handle: '@marcframes', region: '法国', platform: 'Instagram', projects: 1,
    contact: createInvoiceContact('Marc Olivier', 'marc.olivier@creator.example', '+33 6 00 00 2957', 'Paris, Ile-de-France, France'),
    paypal: { username: 'marcframes', email: '', nickname: 'PayPal 主账户', status: 'DRAFT' },
  }),
];

function ProjectCreatorPicker({
  creators,
  selectedHandles,
  onChange,
}: {
  creators: CreatorProfile[];
  selectedHandles: string[];
  onChange: (handles: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const visibleCreators = creators.filter((creator) => !normalizedSearch || (
    `${creator.name}${creator.handle}${creator.region}${creator.platform}`.toLowerCase().includes(normalizedSearch)
  ));
  const selectedCreators = creators.filter((creator) => selectedHandles.includes(creator.handle));

  const toggleCreator = (handle: string) => {
    onChange(selectedHandles.includes(handle)
      ? selectedHandles.filter((selectedHandle) => selectedHandle !== handle)
      : [...selectedHandles, handle]);
  };

  return (
    <div className="creator-picker" data-testid="project-creator-picker">
      <button
        className={`invoice-picker-trigger creator-picker-trigger ${open ? 'invoice-picker-trigger-open' : ''}`}
        type="button"
        aria-expanded={open}
        aria-controls="project-creator-options"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="invoice-picker-leading">
          <Users size={18} />
          <span className="invoice-picker-copy">
            <strong>{selectedHandles.length > 0 ? `已选择 ${selectedHandles.length} 位合作达人` : '从达人档案选择合作达人'}</strong>
            <small>达人名单来自系统【达人档案】，支持多选</small>
          </span>
        </span>
        <ChevronDown className="invoice-picker-chevron" size={18} />
      </button>

      {selectedCreators.length > 0 ? (
        <div className="creator-selection-chips" aria-label="已选择的合作达人">
          {selectedCreators.map((creator) => (
            <button
              className="creator-selection-chip"
              type="button"
              aria-label={`移除 ${creator.name}`}
              key={creator.handle}
              onClick={() => toggleCreator(creator.handle)}
            >
              <Avatar initials={creator.initials} accent={creator.accent} size="sm" />
              <span>{creator.name}</span>
              <X size={13} aria-hidden="true" />
            </button>
          ))}
          <button className="invoice-selection-clear" type="button" onClick={() => onChange([])}>清除已选</button>
        </div>
      ) : null}

      {open ? (
        <div id="project-creator-options" className="creator-options" role="listbox" aria-label="达人档案列表" aria-multiselectable="true">
          <div className="creator-picker-search-row">
            <label className="creator-picker-search">
              <Search size={16} aria-hidden="true" />
              <input aria-label="搜索达人档案" placeholder="搜索姓名、账号、地区或平台" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <span className="creator-picker-result-count" aria-live="polite">
              <strong>{visibleCreators.length}</strong>
              <span>/ {creators.length} 位</span>
            </span>
          </div>
          <div className="creator-option-list">
            {visibleCreators.map((creator) => {
              const selected = selectedHandles.includes(creator.handle);
              return (
                <button
                  className={`creator-option ${selected ? 'creator-option-selected' : ''}`}
                  data-creator-handle={creator.handle}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  key={creator.handle}
                  onClick={() => toggleCreator(creator.handle)}
                >
                  <span className="creator-option-profile">
                    <Avatar initials={creator.initials} accent={creator.accent} size="sm" />
                    <span><strong>{creator.name}</strong><small>{creator.handle}</small></span>
                  </span>
                  <span className="creator-option-meta"><strong>{creator.region}</strong><small>{creator.platform}</small></span>
                  {selected ? <CheckCircle2 className="creator-option-mark creator-option-mark-selected" size={18} /> : <Circle className="creator-option-mark" size={18} />}
                </button>
              );
            })}
            {visibleCreators.length === 0 ? <div className="creator-picker-empty">没有找到匹配的达人档案</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CreatorPaymentSection({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section className="creator-payment-section">
      <header className="creator-payment-section-head">
        <span>{icon}</span>
        <div><h3>{title}</h3><p>{description}</p></div>
      </header>
      {children}
    </section>
  );
}

function CreatorContactDetailsGrid({ contact }: { contact: CreatorInvoiceContact }) {
  return (
    <div className="creator-payment-grid">
      {INVOICE_CONTACT_FIELDS.map((field) => (
        <div className={`creator-payment-value ${field.fullWidth ? 'creator-payment-value-wide' : ''}`} key={field.key}>
          <span>{field.label}<small>{field.alias}</small></span>
          <strong className={contact[field.key] ? '' : 'creator-payment-empty'}>{contact[field.key] || '待补充'}</strong>
        </div>
      ))}
    </div>
  );
}

function CreatorContactFormGrid({ contact, onChange }: { contact: CreatorInvoiceContact; onChange: (field: keyof CreatorInvoiceContact, value: string) => void }) {
  return (
    <div className="form-grid creator-payment-form-grid">
      {INVOICE_CONTACT_FIELDS.map((field) => (
        <label className={field.fullWidth ? 'full-width' : ''} key={field.key}>
          <span className="creator-payment-field-label">
            <span>{field.label}<em className="required-mark" aria-hidden="true">*</em></span>
            <small>{field.alias}</small>
          </span>
          {field.fullWidth ? (
            <textarea aria-label={field.label} placeholder={field.placeholder} value={contact[field.key]} onChange={(event) => onChange(field.key, event.target.value)} />
          ) : (
            <input aria-label={field.label} type={field.inputType ?? 'text'} placeholder={field.placeholder} value={contact[field.key]} onChange={(event) => onChange(field.key, event.target.value)} />
          )}
        </label>
      ))}
    </div>
  );
}

const SOCIAL_PLATFORM_META: Record<string, { abbreviation: string; tone: string }> = {
  instagram: { abbreviation: 'IG', tone: 'instagram' },
  tiktok: { abbreviation: 'TT', tone: 'tiktok' },
  youtube: { abbreviation: 'YT', tone: 'youtube' },
  x: { abbreviation: 'X', tone: 'x' },
  twitter: { abbreviation: 'X', tone: 'x' },
  facebook: { abbreviation: 'FB', tone: 'facebook' },
  twitch: { abbreviation: 'TW', tone: 'twitch' },
};

const getSocialPlatformMeta = (platform: string) => (
  SOCIAL_PLATFORM_META[platform.trim().toLowerCase()]
  ?? { abbreviation: platform.trim().slice(0, 2).toUpperCase() || '@', tone: 'default' }
);

function CreatorSocialAccountDetails({ accounts }: { accounts: CreatorSocialAccount[] }) {
  if (accounts.length === 0) {
    return (
      <div className="creator-social-empty">
        <Link2 size={18} />
        <span><strong>尚未填写社媒账号</strong><small>编辑达人档案后可添加对应平台账号</small></span>
      </div>
    );
  }

  return (
    <div className="creator-social-account-list">
      {accounts.map((account) => {
        const meta = getSocialPlatformMeta(account.platform);
        return (
          <article className="creator-social-account-card" key={account.id}>
            <span className={`creator-social-platform-mark creator-social-platform-${meta.tone}`}>{meta.abbreviation}</span>
            <div>
              <strong>{account.platform || '平台待补充'}</strong>
              <small>{account.handle || '账号待补充'}</small>
            </div>
            {account.profileUrl ? (
              <a href={account.profileUrl} target="_blank" rel="noreferrer" aria-label={`打开 ${account.platform} 主页`}>
                查看主页
                <ExternalLink size={14} />
              </a>
            ) : (
              <span className="creator-social-link-empty">未填写主页链接</span>
            )}
          </article>
        );
      })}
    </div>
  );
}

function CreatorSocialAccountsEditor({
  accounts,
  onChange,
}: {
  accounts: CreatorSocialAccount[];
  onChange: (accounts: CreatorSocialAccount[]) => void;
}) {
  const updateAccount = (
    id: string,
    field: 'platform' | 'handle' | 'profileUrl',
    value: string,
  ) => {
    onChange(accounts.map((account) => account.id === id ? { ...account, [field]: value } : account));
  };

  const addAccount = () => {
    onChange([
      ...accounts,
      createSocialAccount(`social-${Date.now()}-${accounts.length + 1}`),
    ]);
  };

  const removeAccount = (id: string) => {
    if (accounts.length <= 1) return;
    onChange(accounts.filter((account) => account.id !== id));
  };

  return (
    <div className="form-grid creator-social-account-editor">
      {accounts.map((account, index) => (
        <div className="creator-social-account-editor-row" key={account.id}>
          <label>
            <span className="creator-payment-field-label">
              <span>社媒平台<em className="required-mark" aria-hidden="true">*</em></span>
              <small>Social platform</small>
            </span>
            <input
              aria-label={`社媒平台 ${index + 1}`}
              placeholder="例如：Instagram"
              value={account.platform}
              onChange={(event) => updateAccount(account.id, 'platform', event.target.value)}
            />
          </label>
          <label>
            <span className="creator-payment-field-label">
              <span>平台账号<em className="required-mark" aria-hidden="true">*</em></span>
              <small>Platform handle</small>
            </span>
            <input
              aria-label={`平台账号 ${index + 1}`}
              placeholder="例如：@MinaKato"
              value={account.handle}
              onChange={(event) => updateAccount(account.id, 'handle', event.target.value)}
            />
          </label>
          <label>
            <span className="creator-payment-field-label">
              <span>主页链接</span>
              <small>Profile URL · 选填</small>
            </span>
            <input
              aria-label={`主页链接 ${index + 1}`}
              type="url"
              placeholder="https://..."
              value={account.profileUrl}
              onChange={(event) => updateAccount(account.id, 'profileUrl', event.target.value)}
            />
          </label>
          <button
            className="creator-social-remove-button"
            type="button"
            aria-label={`删除第 ${index + 1} 个社媒账号`}
            title={accounts.length <= 1 ? '至少保留一个社媒账号' : '删除社媒账号'}
            disabled={accounts.length <= 1}
            onClick={() => removeAccount(account.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button className="creator-social-add-button" type="button" onClick={addAccount}>
        <Plus size={16} />
        添加社媒账号
      </button>
    </div>
  );
}

export function CreatorsPage({
  notify,
  creators,
  onSaveCreator,
  canEdit,
}: {
  notify: Notify;
  creators: CreatorProfile[];
  onSaveCreator: (creator: CreatorProfile) => void;
  canEdit: boolean;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<CreatorProfile | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const selected = creators.find((creator) => creator.id === selectedId) ?? null;
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCreators = creators.filter((creator) => (
    `${creator.name}${creator.handle}${creator.region}${creator.platform}${creator.socialAccounts.map((account) => `${account.platform}${account.handle}`).join('')}`
      .toLowerCase()
      .includes(normalizedSearch)
  ));
  const verifiedCount = creators.filter((creator) => getDefaultPayoutAccount(creator.payoutAccounts)?.status === 'VERIFIED').length;
  const attentionCount = creators.filter((creator) => {
    const status = getDefaultPayoutAccount(creator.payoutAccounts)?.status ?? 'DRAFT';
    return ['DRAFT', 'REVIEW_REQUIRED', 'INVALID'].includes(status);
  }).length;
  const totalPages = Math.max(1, Math.ceil(filteredCreators.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleCreators = filteredCreators.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const openProfile = (creator: CreatorProfile) => {
    setSelectedId(creator.id);
    setEditing(false);
    setCreating(false);
    setDraft(null);
    setFormErrors([]);
  };

  const closeProfile = () => {
    setSelectedId(null);
    setEditing(false);
    setCreating(false);
    setDraft(null);
    setFormErrors([]);
  };

  const startEditing = () => {
    if (!selected) return;
    setDraft({
      ...selected,
      socialAccounts: selected.socialAccounts.map((account) => ({ ...account })),
      contact: { ...selected.contact },
      payoutAccounts: clonePayoutAccounts(selected.payoutAccounts),
    });
    setEditing(true);
    setCreating(false);
    setFormErrors([]);
  };

  const startCreating = () => {
    const id = `creator-${Date.now()}`;
    setSelectedId(null);
    setDraft({
      id,
      initials: 'NA',
      accent: '#fb7185',
      name: '',
      handle: '',
      region: '',
      platform: '',
      projects: 0,
      socialAccounts: [createSocialAccount(`social-${id}-1`)],
      contact: createInvoiceContact('', '', '', ''),
      payoutAccounts: [createEmptyAirwallexAccount()],
    });
    setEditing(true);
    setCreating(true);
    setFormErrors([]);
  };

  const cancelEditing = () => {
    if (creating) {
      closeProfile();
      return;
    }
    setDraft(null);
    setEditing(false);
    setFormErrors([]);
  };

  const updateDraftProfile = (
    field: 'name' | 'region',
    value: string,
  ) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  };

  const updateDraftSocialAccounts = (socialAccounts: CreatorSocialAccount[]) => {
    setDraft((current) => {
      if (!current) return current;
      const platforms = [...new Set(socialAccounts.map((account) => account.platform.trim()).filter(Boolean))];
      const primaryHandle = socialAccounts.find((account) => account.handle.trim())?.handle.trim() ?? '';
      return {
        ...current,
        socialAccounts,
        handle: primaryHandle,
        platform: platforms.join(' · '),
      };
    });
  };

  const updateDraftContact = (field: keyof CreatorInvoiceContact, value: string) => {
    setDraft((current) => current ? { ...current, contact: { ...current.contact, [field]: value } } : current);
  };

  const saveCreatorDetails = () => {
    if (!draft) return;
    const nextErrors: string[] = [];
    if (!draft.name.trim()) nextErrors.push('达人名称');
    if (!draft.region.trim()) nextErrors.push('地区');
    if (draft.socialAccounts.length === 0) nextErrors.push('至少一个社媒账号');
    if (draft.socialAccounts.some((account) => !account.platform.trim() || !account.handle.trim())) {
      nextErrors.push('每个社媒账号的平台与账号');
    }
    if (draft.socialAccounts.some((account) => account.profileUrl.trim() && !/^https?:\/\/\S+$/i.test(account.profileUrl.trim()))) {
      nextErrors.push('有效的社媒主页链接');
    }
    if (!draft.contact.legalName.trim()) nextErrors.push('Invoice 真实姓名');
    if (!draft.contact.phone.trim()) nextErrors.push('联系电话');
    if (!draft.contact.address.trim()) nextErrors.push('联系地址');
    if (!draft.contact.email.trim() || !/^\S+@\S+\.\S+$/.test(draft.contact.email)) nextErrors.push('有效联系邮箱');
    if (nextErrors.length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    const normalizedName = draft.name.trim();
    const initials = normalizedName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'NA';
    const normalizedSocialAccounts = draft.socialAccounts.map((account) => {
      const platform = account.platform.trim();
      const handle = normalizeSocialHandle(account.handle);
      return {
        ...account,
        platform,
        handle,
        profileUrl: account.profileUrl.trim() || defaultSocialProfileUrl(platform, handle),
      };
    });
    const platformSummary = [...new Set(normalizedSocialAccounts.map((account) => account.platform))].join(' · ');
    const updated: CreatorProfile = {
      ...draft,
      initials,
      name: normalizedName,
      handle: normalizedSocialAccounts[0]?.handle ?? '',
      region: draft.region.trim(),
      platform: platformSummary,
      socialAccounts: normalizedSocialAccounts,
    };
    onSaveCreator(updated);
    setSelectedId(updated.id);
    setDraft(null);
    setEditing(false);
    setCreating(false);
    setFormErrors([]);
    const defaultAccount = getDefaultPayoutAccount(updated.payoutAccounts);
    const status = getPayoutAccountStatusMeta(defaultAccount?.status ?? 'DRAFT', defaultAccount?.provider);
    notify(
      creating ? '达人档案已建立' : '达人档案已保存',
      `${updated.name} 的资料已保存；默认收款账户状态为“${status.label}”。`,
    );
  };

  const activeProfile = editing && draft ? draft : selected;
  const activeDefaultAccount = activeProfile ? getDefaultPayoutAccount(activeProfile.payoutAccounts) : null;
  const activeStatus = getPayoutAccountStatusMeta(activeDefaultAccount?.status ?? 'DRAFT', activeDefaultAccount?.provider);
  return (
    <div className="page-stack">
      <PageHeading
        title="达人档案"
        subtitle="分开维护达人身份、Invoice 联系资料及多个收款账户。"
        actions={canEdit ? <Button icon={<Plus size={17} />} onClick={startCreating}>新建达人档案</Button> : undefined}
      />
      <div className="metrics-grid">
        <MetricCard label="达人总数" value={creators.length.toLocaleString('zh-CN')} meta="当前档案" tone="peach" />
        <MetricCard label="默认账户已验证" value={verifiedCount.toLocaleString('zh-CN')} meta={creators.length ? `验证率 ${((verifiedCount / creators.length) * 100).toFixed(1)}%` : '暂无账户'} />
        <MetricCard label="需要处理" value={attentionCount.toLocaleString('zh-CN')} meta="待补充、复核或无效" tone="lilac" />
      </div>
      <section className="content-card">
        <div className="content-toolbar">
          <SearchBar value={search} onChange={handleSearchChange} placeholder="搜索达人名称、账号或地区" />
          <Button variant="secondary" icon={<Download size={16} />}>导出名单</Button>
        </div>
        <div className="table-scroll">
          <table className="data-table operational-table">
            <thead><tr><th>达人</th><th>地区</th><th>社媒平台</th><th>收款账户</th><th>合作项目</th><th className="action-cell">操作</th></tr></thead>
            <tbody>
              {visibleCreators.length > 0 ? visibleCreators.map((creator) => {
                const defaultAccount = getDefaultPayoutAccount(creator.payoutAccounts);
                const status = getPayoutAccountStatusMeta(defaultAccount?.status ?? 'DRAFT', defaultAccount?.provider);
                return (
                  <tr key={creator.id} onClick={() => openProfile(creator)}>
                    <td><div className="creator-cell"><Avatar initials={creator.initials} accent={creator.accent} size="sm" /><span><strong>{creator.name}</strong><small>{creator.handle}</small></span></div></td>
                    <td>{creator.region}</td>
                    <td>{creator.platform}</td>
                    <td>
                      <span className={`payout-list-status payout-list-status-${status.tone}`}>
                        {status.tone === 'success' ? <CheckCircle2 size={16} /> : status.tone === 'danger' || status.tone === 'warning' ? <AlertCircle size={16} /> : <Clock3 size={16} />}
                        <span><strong>{status.label}</strong><small>{defaultAccount ? `${defaultAccount.provider} · ${defaultAccount.nickname}` : '尚未建立收款账户'}</small></span>
                      </span>
                    </td>
                    <td>{creator.projects} 个</td>
                    <td className="action-cell"><button className="text-link" type="button" onClick={(event) => { event.stopPropagation(); openProfile(creator); }}>查看档案</button></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6}><div className="empty-table">没有找到匹配的达人档案</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>共 {filteredCreators.length} 条</span>
          <Pagination
            ariaLabel="达人列表分页"
            page={currentPage}
            pageSize={pageSize}
            total={filteredCreators.length}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />
        </div>
      </section>
      {activeProfile ? (
        <Modal
          title={creating ? '新建达人档案' : editing ? '编辑达人档案' : '达人档案'}
          width="1040px"
          className={editing ? 'creator-profile-editor-modal' : undefined}
          onClose={closeProfile}
          footer={editing ? (
            <><Button variant="ghost" onClick={cancelEditing}>取消</Button><Button onClick={saveCreatorDetails}>{creating ? '建立达人档案' : '保存达人档案'}</Button></>
          ) : (
            <>
              <Button variant="secondary" onClick={closeProfile}>关闭</Button>
              {canEdit ? <Button icon={<Pencil size={16} />} onClick={startEditing}>编辑达人档案</Button> : null}
            </>
          )}
        >
          <div className="profile-summary">
            <Avatar initials={activeProfile.initials} accent={activeProfile.accent} size="lg" />
            <div><h3>{activeProfile.name || '新达人'}</h3><p>{[activeProfile.handle, activeProfile.region, activeProfile.platform].filter(Boolean).join(' · ') || '请先完善达人基本资料'}</p></div>
            <span className={`verified-badge verified-badge-${activeStatus.tone}`}>
              {activeStatus.tone === 'success' ? <ShieldCheck size={15} /> : activeStatus.tone === 'danger' || activeStatus.tone === 'warning' ? <AlertCircle size={15} /> : <Clock3 size={15} />}
              {activeStatus.label}
            </span>
          </div>
          {editing && draft ? (
            <div className="creator-payment-editor">
              {formErrors.length > 0 ? (
                <NoticeBanner>
                  <strong>请先补充以下档案字段：</strong> {formErrors.join('、')}
                </NoticeBanner>
              ) : null}
              <CreatorPaymentSection icon={<Users size={19} />} title="达人基本资料" description="用于项目选择与档案检索，不参与银行账户验证">
                <div className="form-grid creator-payment-form-grid">
                  <label>
                    <span className="creator-payment-field-label"><span>达人名称<em className="required-mark" aria-hidden="true">*</em></span><small>Display name</small></span>
                    <input aria-label="达人名称" placeholder="例如：Mina Kato" value={draft.name} onChange={(event) => updateDraftProfile('name', event.target.value)} />
                  </label>
                  <label>
                    <span className="creator-payment-field-label"><span>地区<em className="required-mark" aria-hidden="true">*</em></span><small>Creator region</small></span>
                    <input aria-label="达人地区" placeholder="例如：日本" value={draft.region} onChange={(event) => updateDraftProfile('region', event.target.value)} />
                  </label>
                </div>
              </CreatorPaymentSection>
              <CreatorPaymentSection icon={<Link2 size={19} />} title="社媒账号" description="达人填写个人信息时补充；分别维护各平台账号与主页链接">
                <CreatorSocialAccountsEditor accounts={draft.socialAccounts} onChange={updateDraftSocialAccounts} />
              </CreatorPaymentSection>
              <CreatorPaymentSection icon={<FileText size={19} />} title="Invoice 联系资料" description="生成 Invoice 时使用，与银行账户名和 PayPal 邮箱独立维护">
                <CreatorContactFormGrid contact={draft.contact} onChange={updateDraftContact} />
              </CreatorPaymentSection>
              <div className="creator-payment-note">
                <ShieldCheck size={16} />
                <span>
                  <strong>保存档案不等于账户已验证</strong>
                  <small>修改银行信息后状态会回到“待 Airwallex 校验”；接入 API 后，再由 Validate 与 Verify Account 结果更新状态。</small>
                </span>
              </div>
              <CreatorPaymentSection icon={<WalletCards size={19} />} title="收款账户" description="按付款渠道管理账户，并指定一个默认账户用于新的付款">
                <CreatorPayoutAccounts
                  accounts={draft.payoutAccounts}
                  editing
                  creatorName={draft.name}
                  creatorEmail={draft.contact.email}
                  onChange={(payoutAccounts) => setDraft((current) => current ? { ...current, payoutAccounts } : current)}
                />
              </CreatorPaymentSection>
            </div>
          ) : (
            <div className="creator-profile-content">
              <div className="profile-details"><div><span>社媒账号</span><strong>{activeProfile.socialAccounts.length} 个 · {activeProfile.platform || '平台待补充'}</strong></div><div><span>合作项目</span><strong>{activeProfile.projects} 个</strong></div><div><span>真实姓名</span><strong>{activeProfile.contact.legalName || '待补充'}</strong></div><div><span>联系邮箱</span><strong>{activeProfile.contact.email || '待补充'}</strong></div></div>
              <CreatorPaymentSection icon={<Link2 size={19} />} title="社媒账号" description="达人在各社媒平台填写的公开账号">
                <CreatorSocialAccountDetails accounts={activeProfile.socialAccounts} />
              </CreatorPaymentSection>
              <CreatorPaymentSection icon={<FileText size={19} />} title="Invoice 联系资料" description="用于 Invoice 的 From 信息">
                <CreatorContactDetailsGrid contact={activeProfile.contact} />
              </CreatorPaymentSection>
              <CreatorPaymentSection icon={<WalletCards size={19} />} title="收款账户" description="支持 Airwallex、PayPal 和 PayerMax，默认账户决定付款时的预选资料">
                <CreatorPayoutAccounts
                  accounts={activeProfile.payoutAccounts}
                  creatorName={activeProfile.name}
                  creatorEmail={activeProfile.contact.email}
                />
              </CreatorPaymentSection>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}

const COLLABORATIONS = [
  { creator: '@MinaKato', project: '夏日直播计划', deliverable: '直播 2 场 + 短视频 3 条', invoice: '已提交', payment: '待财务复核' },
  { creator: 'Alex Ruiz', project: '新品开箱', deliverable: 'YouTube 长视频 1 条', invoice: '已通过', payment: '等待付款' },
  { creator: 'Nika', project: 'TikTok Spark', deliverable: 'TikTok 视频 4 条', invoice: '资料异常', payment: '暂停' },
  { creator: '@Luna_J', project: '七月联名', deliverable: 'Reels 2 条 + Story 6 条', invoice: '已通过', payment: '飞书审批中' },
];

export function CollaborationsPage({ notify, canImport }: { notify: Notify; canImport: boolean }) {
  const importAction = canImport
    ? <Button icon={<Upload size={17} />} onClick={() => notify('导入模板', '已准备达人合作名单模板。')}>导入合作名单</Button>
    : undefined;
  return <div className="page-stack"><PageHeading title="合作名单" subtitle="查看达人交付、Invoice 与付款状态的统一视图。" actions={importAction} /><section className="content-card"><div className="content-toolbar"><SearchBar value="" onChange={() => undefined} placeholder="搜索达人或项目" /><span className="toolbar-note">本月合作 28 人 · 待付款 12 人</span></div><div className="table-scroll"><table className="data-table operational-table"><thead><tr><th>达人</th><th>所属项目</th><th>合作交付</th><th>Invoice</th><th>付款进度</th><th className="action-cell">操作</th></tr></thead><tbody>{COLLABORATIONS.map((item) => <tr key={`${item.creator}${item.project}`}><td><strong>{item.creator}</strong></td><td>{item.project}</td><td>{item.deliverable}</td><td>{item.invoice}</td><td><ProjectStatus status={item.payment} /></td><td className="action-cell"><button className="text-link" type="button" onClick={() => notify('合作详情', `${item.creator} 的交付与付款链路已打开。`)}>查看链路</button></td></tr>)}</tbody></table></div></section></div>;
}

export type InvoicePageTab = 'signature' | 'review' | 'approved' | 'returned';

const INVOICE_REVIEW_STATUS_LABELS: Partial<Record<Payout['status'], string>> = {
  待财务复核: '待媒介审核',
};

export function InvoicePage({
  payouts,
  creators,
  invoiceEntity,
  generatedInvoices,
  tab,
  onTabChange,
  onCreateInvoice,
  canCreateInvoice,
  canReview,
  canExecutePayout,
  focusedInvoiceId,
  onFocusCleared,
  onAdvance,
  onReturn,
  notify,
}: {
  payouts: Payout[];
  creators: CreatorProfile[];
  invoiceEntity: InvoiceEntity;
  generatedInvoices: GeneratedInvoiceRecord[];
  tab: InvoicePageTab;
  onTabChange: (tab: InvoicePageTab) => void;
  onCreateInvoice: () => void;
  canCreateInvoice: boolean;
  canReview: boolean;
  canExecutePayout: boolean;
  focusedInvoiceId: string | null;
  onFocusCleared: () => void;
  onAdvance: (payout: Payout) => void;
  onReturn: (payout: Payout, reason: string) => void;
  notify: Notify;
}) {
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState('');
  const [signaturePage, setSignaturePage] = useState(1);
  const [signaturePageSize, setSignaturePageSize] = useState(10);
  const [selectedSourceKey, setSelectedSourceKey] = useState<string | null>(null);
  const effectiveSourceKey = selectedSourceKey ?? (focusedInvoiceId ? `payout:${focusedInvoiceId}` : null);
  const selectedPayout = effectiveSourceKey?.startsWith('payout:')
    ? payouts.find((payout) => payout.invoice === effectiveSourceKey.slice('payout:'.length)) ?? null
    : null;
  const selectedGenerated = effectiveSourceKey?.startsWith('generated:')
    ? generatedInvoices.find((record) => record.id === effectiveSourceKey.slice('generated:'.length)) ?? null
    : null;
  const selectedSource: InvoiceDetailSource | null = selectedPayout
    ? { kind: 'payout', payout: selectedPayout }
    : selectedGenerated
      ? { kind: 'generated', record: selectedGenerated }
      : null;
  const selectedModel = selectedPayout
    ? buildInvoiceReviewModel(selectedPayout, creators, invoiceEntity)
    : selectedGenerated?.snapshot ?? null;
  const groupedPayouts = useMemo(() => {
    const groups = {
      review: [] as Payout[],
      approved: [] as Payout[],
      returned: [] as Payout[],
    };

    payouts.forEach((payout) => {
      if (payout.status === '待财务复核') groups.review.push(payout);
      else if (payout.status === '已退回' || payout.status === '信息异常') groups.returned.push(payout);
      else groups.approved.push(payout);
    });

    return groups;
  }, [payouts]);
  const visiblePayouts = useMemo(() => {
    if (tab === 'signature') return [];
    const query = search.trim().toLowerCase();
    const source = groupedPayouts[tab];
    if (!query) return source;
    return source.filter((payout) => (
      `${payout.creator} ${payout.handle} ${payout.project} ${payout.invoice} ${payout.provider}`
        .toLowerCase()
      .includes(query)
    ));
  }, [groupedPayouts, search, tab]);
  const pendingSignatureInvoices = useMemo(
    () => generatedInvoices.filter((record) => record.status === '待签署'),
    [generatedInvoices],
  );
  const visiblePendingSignature = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pendingSignatureInvoices;
    return pendingSignatureInvoices.filter((record) => {
      const searchableText = `${record.id} ${record.snapshot.creatorName} ${record.snapshot.creatorHandle} ${record.snapshot.projectName}`;
      return searchableText.toLowerCase().includes(query);
    });
  }, [pendingSignatureInvoices, search]);
  const signatureTotalPages = Math.max(1, Math.ceil(visiblePendingSignature.length / signaturePageSize));
  const currentSignaturePage = Math.min(signaturePage, signatureTotalPages);
  const paginatedPendingSignature = visiblePendingSignature.slice(
    (currentSignaturePage - 1) * signaturePageSize,
    currentSignaturePage * signaturePageSize,
  );

  const downloadPendingSignature = async (record: GeneratedInvoiceRecord, type: 'pdf' | 'docx') => {
    const key = `${record.id}-${type}`;
    setDownloading(key);
    try {
      const { generateInvoiceDocx, generateInvoicePdf } = await import('../invoice/generateInvoice');
      const model = record.snapshot;
      const blob = type === 'pdf' ? await generateInvoicePdf(model) : await generateInvoiceDocx(model);
      downloadBlob(blob, invoiceFilename(model, type));
      notify('文件已准备下载', `${record.id} 的 ${type.toUpperCase()} 已重新生成。`);
    } catch (error) {
      notify('下载失败', error instanceof Error ? error.message : '文件重新生成失败，请稍后重试。');
    } finally {
      setDownloading('');
    }
  };

  const openReviewInvoice = (payout: Payout) => {
    setSelectedSourceKey(`payout:${payout.invoice}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openGeneratedInvoice = (record: GeneratedInvoiceRecord) => {
    setSelectedSourceKey(`generated:${record.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeInvoiceDetail = () => {
    setSelectedSourceKey(null);
    onFocusCleared();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (selectedSource && selectedModel) {
    return (
      <InvoiceDetailPage
        source={selectedSource}
        model={selectedModel}
        notify={notify}
        onAdvance={onAdvance}
        onReturn={onReturn}
        canReview={canReview}
        canExecutePayout={canExecutePayout}
        onBack={closeInvoiceDetail}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        title="Invoice 管理"
        subtitle="生成、下载并审核达人 Invoice，核对合同主体与收款信息。"
        actions={canCreateInvoice ? <Button icon={<Plus size={17} />} onClick={onCreateInvoice}>生成 Invoice</Button> : undefined}
      />
      <section className="content-card">
        <div className="tabs-row">
          <button className={`tab-button ${tab === 'signature' ? 'tab-active' : ''}`} type="button" onClick={() => onTabChange('signature')}>待签署 <span>{pendingSignatureInvoices.length}</span></button>
          <button className={`tab-button ${tab === 'review' ? 'tab-active' : ''}`} type="button" onClick={() => onTabChange('review')}>待审核 <span>{groupedPayouts.review.length}</span></button>
          <button className={`tab-button ${tab === 'approved' ? 'tab-active' : ''}`} type="button" onClick={() => onTabChange('approved')}>已通过 <span>{groupedPayouts.approved.length}</span></button>
          <button className={`tab-button ${tab === 'returned' ? 'tab-active' : ''}`} type="button" onClick={() => onTabChange('returned')}>已退回 <span>{groupedPayouts.returned.length}</span></button>
        </div>
        <div className="content-toolbar compact-toolbar">
          <SearchBar value={search} onChange={(value) => { setSearch(value); setSignaturePage(1); }} placeholder={tab === 'signature' ? '搜索待签署 Invoice、达人或项目' : '搜索 Invoice 或达人'} />
          <span className="toolbar-note"><FileCheck2 size={16} /> {tab === 'signature' ? '仅展示在 Invoice 模块生成、等待提交给达人签署的 Invoice' : '审核时会自动比对合同与收款主体'}</span>
        </div>
        {tab === 'signature' ? (
          <div className="table-shell">
            <div className="table-scroll">
              <table className="data-table operational-table generated-invoice-table">
                <thead><tr><th>达人 / 项目</th><th>Invoice</th><th>付款方式</th><th>金额</th><th>状态</th><th className="action-cell">文件</th></tr></thead>
                <tbody>
                  {paginatedPendingSignature.map((record) => {
                    const creatorName = record.snapshot.creatorName;
                    const projectName = record.snapshot.projectName;
                    const paymentMethod = record.snapshot.paymentMethod === 'bank' ? 'Bank transfer' : 'PayPal';
                    const amount = formatInvoiceMoney(record.snapshot.currency, invoiceTotal(record.snapshot));

                    return (
                      <tr className="clickable-table-row" key={record.id} onClick={() => openGeneratedInvoice(record)}>
                        <td><strong>{creatorName}</strong><small className="cell-subtext">{projectName}</small></td>
                        <td className="mono-cell"><button className="invoice-record-link" type="button" onClick={(event) => { event.stopPropagation(); openGeneratedInvoice(record); }}>{record.id}</button></td>
                        <td>{paymentMethod}</td>
                        <td>{amount}</td>
                        <td><span className="simple-status generated-invoice-status"><i />{record.status}</span></td>
                        <td className="action-cell"><div className="invoice-download-actions"><button type="button" disabled={Boolean(downloading)} onClick={(event) => { event.stopPropagation(); downloadPendingSignature(record, 'pdf'); }}>{downloading === `${record.id}-pdf` ? '生成中…' : 'PDF'}</button><button type="button" disabled={Boolean(downloading)} onClick={(event) => { event.stopPropagation(); downloadPendingSignature(record, 'docx'); }}>{downloading === `${record.id}-docx` ? '生成中…' : 'DOCX'}</button></div></td>
                      </tr>
                    );
                  })}
                  {visiblePendingSignature.length === 0 ? <tr><td colSpan={6} className="request-project-empty">{canCreateInvoice ? '暂无待签署 Invoice，点击右上角生成后即可在此提交给达人签署。' : '暂无待签署 Invoice。'}</td></tr> : null}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>共 {visiblePendingSignature.length} 条</span>
              <Pagination
                ariaLabel="待签署 Invoice 列表分页"
                page={currentSignaturePage}
                pageSize={signaturePageSize}
                total={visiblePendingSignature.length}
                onPageChange={setSignaturePage}
                onPageSizeChange={(nextPageSize) => {
                  setSignaturePageSize(nextPageSize);
                  setSignaturePage(1);
                }}
              />
            </div>
          </div>
        ) : (
          <PayoutTable
            payouts={visiblePayouts}
            onSelect={openReviewInvoice}
            emptyText="当前筛选条件下没有 Invoice 记录"
            statusLabels={tab === 'review' ? INVOICE_REVIEW_STATUS_LABELS : undefined}
          />
        )}
      </section>
    </div>
  );
}

const BASE_BATCHES = [
  { id: 'BAT-20260716-007', provider: 'Airwallex', count: 12, amount: 'USD 28,420', creator: '财务演示用户 A', time: '2026-07-16 16:42', status: '付款处理中' },
  { id: 'BAT-20260715-006', provider: 'PayMax', count: 8, amount: 'EUR 16,880', creator: '财务演示用户 B', time: '2026-07-15 11:20', status: '已完成' },
  { id: 'BAT-20260712-005', provider: 'PayPal', count: 23, amount: 'USD 41,260', creator: '财务演示用户 C', time: '2026-07-12 09:05', status: '部分失败' },
];

export function BatchesPage({ createdBatch, onNewBatch, notify, canCreateBatch }: { createdBatch: CreatedBatch; onNewBatch: () => void; notify: Notify; canCreateBatch: boolean }) {
  const rows = createdBatch ? [{ id: createdBatch.id, provider: createdBatch.provider, count: createdBatch.count, amount: createdBatch.amount, creator: CURRENT_USER.name, time: '刚刚', status: '等待付款' }, ...BASE_BATCHES] : BASE_BATCHES;
  const createAction = canCreateBatch ? <Button icon={<Plus size={17} />} onClick={onNewBatch}>新建付款批次</Button> : undefined;
  return <div className="page-stack"><PageHeading title="付款批次" subtitle="按渠道组织批量付款，并追踪失败重试与回写结果。" actions={createAction} /><div className="metrics-grid"><MetricCard label="处理中批次" value="2" meta="共 16 笔付款" tone="peach" /><MetricCard label="本月成功率" value="98.6%" meta="1,248 / 1,266 笔" /><MetricCard label="需人工处理" value="3" meta="来自 2 个批次" tone="lilac" /></div><section className="content-card"><div className="content-toolbar"><SearchBar value="" onChange={() => undefined} placeholder="搜索批次号" /><Button variant="secondary" icon={<Download size={16} />}>导出记录</Button></div><div className="table-scroll"><table className="data-table operational-table"><thead><tr><th>批次号</th><th>付款渠道</th><th>笔数</th><th>金额</th><th>创建人 / 时间</th><th>状态</th><th className="action-cell">操作</th></tr></thead><tbody>{rows.map((batch) => <tr key={batch.id}><td className="mono-cell">{batch.id}</td><td>{batch.provider}</td><td>{batch.count} 笔</td><td>{batch.amount}</td><td><strong>{batch.creator}</strong><small className="cell-subtext">{batch.time}</small></td><td><span className="simple-status"><i />{batch.status}</span></td><td className="action-cell"><button className="text-link" type="button" onClick={() => notify('批次详情', `${batch.id} 的付款明细与渠道响应已打开。`)}>查看明细</button></td></tr>)}</tbody></table></div></section></div>;
}

export function TransactionsPage({ payouts, onSelectPayout }: { payouts: Payout[]; onSelectPayout: (payout: Payout) => void }) {
  const [tab, setTab] = useState<'all' | 'processing' | 'paid'>('all');
  const visible = payouts.filter((payout) => tab === 'processing' ? payout.status === '付款处理中' || payout.status === '等待付款' : tab === 'paid' ? payout.status === '已付款' : true);
  return <div className="page-stack"><PageHeading title="交易记录" subtitle="查询每笔达人付款的渠道流水、币种与最终状态。" /><section className="summary-surface"><article className="summary-card summary-card-peach"><span className="summary-illustration"><WalletCards size={26} /></span><div><strong>USD 128,640</strong><span>本月付款总额 · 86 笔</span></div></article><article className="summary-card summary-card-lilac"><span className="summary-illustration"><Check size={26} /></span><div><strong>98.6%</strong><span>渠道付款成功率</span></div></article></section><section className="content-card"><div className="tabs-row"><button className={`tab-button ${tab === 'all' ? 'tab-active' : ''}`} type="button" onClick={() => setTab('all')}>全部</button><button className={`tab-button ${tab === 'processing' ? 'tab-active' : ''}`} type="button" onClick={() => setTab('processing')}>处理中</button><button className={`tab-button ${tab === 'paid' ? 'tab-active' : ''}`} type="button" onClick={() => setTab('paid')}>已付款</button></div><div className="content-toolbar compact-toolbar"><div className="date-range-static">2026-07-01 <span>—</span> 2026-07-31</div><Button variant="secondary" icon={<Download size={16} />}>导出流水</Button></div><PayoutTable payouts={visible} onSelect={onSelectPayout} /></section></div>;
}

const ORGANIZATION_COUNTRY_OPTIONS = [
  { value: 'Hong Kong SAR China', label: 'Hong Kong SAR China', description: '中国香港特别行政区' },
  { value: 'Singapore', label: 'Singapore', description: '新加坡' },
  { value: 'United States', label: 'United States', description: '美国' },
] as const;

export function OrganizationPage({
  notify,
  invoiceEntity,
  onInvoiceEntityChange,
}: {
  notify: Notify;
  invoiceEntity: InvoiceEntity;
  onInvoiceEntityChange: (entity: InvoiceEntity) => void;
}) {
  const [company, setCompany] = useState('Muse Commerce Limited');
  const [country, setCountry] = useState('Hong Kong SAR China');
  const [contact, setContact] = useState<string>(CURRENT_USER.name);
  const [email, setEmail] = useState('finance@comets.example');
  const [address, setAddress] = useState('Unit 18, 16/F, Harbour Centre, Hong Kong');
  return (
    <div className="page-stack">
      <PageHeading
        title="组织信息"
        subtitle="维护签约与付款流程中使用的企业主体资料。"
        actions={<Button onClick={() => notify('组织信息已保存', '公司资料与 Invoice 开票主体已在本次会话中更新。')}>保存修改</Button>}
      />
      <section className="profile-form-card">
        <div className="form-section-head">
          <span><Building2 size={21} /></span>
          <div><h2>公司 / 工作室信息</h2><p>这些信息会显示在请款单、Invoice 审核与付款资料中。</p></div>
        </div>
        <div className="form-grid">
          <label className="full-width">
            <span>公司 / 工作室名称 <small>{company.length} / 100</small></span>
            <input value={company} onChange={(event) => setCompany(event.target.value)} />
          </label>
          <div className="form-control full-width">
            <span>国家 / 地区</span>
            <SelectField
              ariaLabel="国家 / 地区"
              variant="form"
              value={country}
              options={ORGANIZATION_COUNTRY_OPTIONS}
              onChange={setCountry}
            />
          </div>
          <label><span>联系人</span><input value={contact} onChange={(event) => setContact(event.target.value)} /></label>
          <label><span>联系邮箱 *</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="full-width"><span>注册地址 <small>{address.length} / 2000</small></span><textarea value={address} onChange={(event) => setAddress(event.target.value)} /></label>
        </div>
        <button className="add-contact-button" type="button"><Plus size={16} />添加更多联系方式</button>
      </section>
      <section className="profile-form-card invoice-entity-card">
        <div className="form-section-head">
          <span><FileText size={21} /></span>
          <div><h2>Invoice 开票主体</h2><p>作为生成文件中的 Bill To 信息，与公司 / 工作室资料独立维护。</p></div>
        </div>
        <div className="form-grid">
          <label className="full-width">
            <span>Bill To 公司名称 <small>{invoiceEntity.name.length} / 100</small></span>
            <input value={invoiceEntity.name} onChange={(event) => onInvoiceEntityChange({ ...invoiceEntity, name: event.target.value })} />
          </label>
          <label className="full-width">
            <span>Bill To 地址 <small>{invoiceEntity.address.length} / 500</small></span>
            <textarea value={invoiceEntity.address} onChange={(event) => onInvoiceEntityChange({ ...invoiceEntity, address: event.target.value })} />
          </label>
        </div>
        <div className="invoice-entity-note"><CheckCircle2 size={16} /><span>生成 Invoice 时会自动带入，仍可在单份 Invoice 中临时修改。</span></div>
      </section>
    </div>
  );
}

const CHANNELS = [
  { name: 'Airwallex', tag: '国际银行转账', description: '支持本地转账、SWIFT 与批量付款', currencies: 'USD · EUR · GBP · HKD', state: '已连接', color: '#6d5ce7' },
  { name: 'PayMax', tag: '本地银行网络', description: '俄罗斯、泰国及区域本地银行模板', currencies: 'USD · EUR · THB', state: '已连接', color: '#ff765d' },
  { name: 'PayPal', tag: '数字钱包', description: '通过达人 PayPal 邮箱快速付款', currencies: 'USD · EUR', state: '已连接', color: '#1689e5' },
];

export function ChannelsPage({ notify }: { notify: Notify }) {
  const [testing, setTesting] = useState<string | null>(null);
  const test = (name: string) => {
    setTesting(name);
    window.setTimeout(() => {
      setTesting(null);
      notify(`${name} 连接正常`, 'API 凭证有效，回调地址可访问。');
    }, 700);
  };
  return <div className="page-stack"><PageHeading title="渠道设置" subtitle="配置付款服务商、API 凭证与回调状态。" actions={<Button variant="secondary" icon={<Settings2 size={16} />}>路由规则</Button>} /><NoticeBanner>演示环境仅展示渠道配置状态，不会发起真实付款或写入服务商账户。</NoticeBanner><div className="channel-grid">{CHANNELS.map((channel) => <article className="channel-card" key={channel.name}><header><span className="channel-logo" style={{ backgroundColor: channel.color }}>{channel.name.slice(0, 1)}</span><div><h2>{channel.name}</h2><p>{channel.tag}</p></div><span className="connected-state"><i />{channel.state}</span></header><p className="channel-description">{channel.description}</p><dl><div><dt>支持币种</dt><dd>{channel.currencies}</dd></div><div><dt>最近校验</dt><dd>2026-07-17 10:24</dd></div></dl><footer><Button variant="secondary" icon={<Link2 size={16} />} disabled={testing === channel.name} onClick={() => test(channel.name)}>{testing === channel.name ? '校验中…' : '测试连接'}</Button><button className="icon-button" type="button" aria-label={`配置 ${channel.name}`}><MoreHorizontal size={19} /></button></footer></article>)}</div></div>;
}

const INITIAL_NOTIFICATIONS = [
  { id: 1, icon: FileCheck2, title: 'Invoice INV-240718 等待财务复核', body: '@MinaKato · 夏日直播计划 · USD 3,240', time: '10 分钟前', unread: true },
  { id: 2, icon: AlertCircle, title: 'Nika 的收款资料校验失败', body: '泰国本地转账路由代码待补充，请在达人档案中更新。', time: '42 分钟前', unread: true },
  { id: 3, icon: Send, title: '批次 BAT-20260716-007 已提交渠道', body: 'Airwallex 正在处理 12 笔付款。', time: '昨天 16:42', unread: false },
  { id: 4, icon: CheckCircle2, title: '付款状态已回写', body: 'Kenji Mori · USD 4,100 · 已付款', time: '昨天 14:32', unread: false },
];

export function NotificationsPage() {
  const [items, setItems] = useState(INITIAL_NOTIFICATIONS);
  const unreadCount = useMemo(() => items.filter((item) => item.unread).length, [items]);
  return <div className="page-stack"><PageHeading title="通知" subtitle={`你有 ${unreadCount} 条未读消息。`} actions={<Button variant="secondary" onClick={() => setItems((current) => current.map((item) => ({ ...item, unread: false })))}>全部标为已读</Button>} /><section className="notification-card">{items.map((item) => { const Icon = item.icon; return <button className={`notification-item ${item.unread ? 'notification-unread' : ''}`} key={item.id} type="button" onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, unread: false } : entry))}><span className="notification-symbol"><Icon size={19} /></span><span><strong>{item.title}</strong><small>{item.body}</small></span><time><Clock3 size={14} />{item.time}</time>{item.unread ? <i className="unread-dot" /> : null}</button>; })}</section></div>;
}
