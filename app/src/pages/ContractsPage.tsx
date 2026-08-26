import { AlertTriangle, CalendarDays, ChevronDown, Download, FilePlus2, Search, Trash2, Upload } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button, ListActionButton, Modal, PageHeading, SelectField } from '../components/Common';
import { ContractUploadWizard } from '../components/ContractUploadWizard';
import { Pagination, usePagination } from '../components/Pagination';
import {
  contractExportArchiveFilename,
  contractSelectionId,
  createContractExportArchive,
  selectedContracts,
  toggleVisibleContractSelection,
} from '../contractBatchOperations';
import {
  CONTRACT_TYPE_LABELS,
  contractMatchesValidityFilter,
  currentContractReferenceDate,
  formatContractMoney,
  getContractType,
  getContractReadiness,
  getContractValidity,
  isContractAvailableForNewAssociation,
  type ContractRecord,
  type ContractUploadInput,
  type ContractValidityFilter,
} from '../contracts';
import type { ContractId } from '../businessWorkflow';
import type { CreatorProfile } from '../types';
import { downloadBlob } from '../invoice/invoiceUtils';
import { ContractDetailPage } from './ContractDetailPage';
import type { ProjectSummary } from './ProjectDetailPage';

type Notify = (title: string, message: string) => void;
type ContractFilter = 'all' | 'ready' | 'attention' | 'template';

const CONTRACT_VALIDITY_FILTERS: Array<{ value: ContractValidityFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'expiring', label: '即将到期' },
  { value: 'expired', label: '已到期' },
  { value: 'long-term', label: '长期有效' },
  { value: 'unset', label: '未设置' },
];

const creatorRealNameFor = (contract: ContractRecord, creators: CreatorProfile[]) => {
  const creator = contract.creatorId
    ? creators.find((candidate) => candidate.id === contract.creatorId)
    : undefined;
  return creator?.contact.legalName?.trim() || creator?.name?.trim() || contract.publisher || '待补充';
};

const projectDisplayFor = (contract: ContractRecord, projects: ProjectSummary[]) => {
  const projectId = contract.cooperationProjectId ?? contract.projectId;
  const project = projectId
    ? projects.find((candidate) => (
      (candidate.cooperationProjectId ?? candidate.projectId ?? candidate.id) === projectId
    ))
    : undefined;
  return {
    name: project?.name || contract.project || '待关联项目',
    code: project?.cooperationProjectCode || project?.projectCode || (projectId ? String(projectId) : ''),
  };
};

const projectFilterKeyFor = (contract: ContractRecord, projects: ProjectSummary[]) => {
  const projectId = contract.cooperationProjectId ?? contract.projectId;
  if (projectId) return `project:${String(projectId)}`;
  return `name:${projectDisplayFor(contract, projects).name.trim().toLowerCase()}`;
};

type ContractProjectFilterOption = {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
  contractCount?: number;
};

function ContractProjectFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: ContractProjectFilterOption[];
  onChange: (value: string) => void;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const selected = options.find((option) => option.value === value) ?? options[0];
  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => (
      `${option.label} ${option.description ?? ''} ${option.searchText ?? ''}`
        .toLowerCase()
        .includes(normalized)
    ));
  }, [options, query]);

  const updateMenuStyle = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 12;
    const gap = 7;
    const availableWidth = Math.max(0, window.innerWidth - margin * 2);
    const width = Math.min(Math.max(rect.width, 320), availableWidth);
    const left = Math.min(
      Math.max(rect.left, margin),
      Math.max(margin, window.innerWidth - margin - width),
    );
    const estimatedHeight = Math.min(360, 64 + options.length * 54);
    const roomBelow = window.innerHeight - rect.bottom - margin - gap;
    const roomAbove = rect.top - margin - gap;
    const placeAbove = roomBelow < estimatedHeight && roomAbove > roomBelow;
    const availableHeight = placeAbove ? roomAbove : roomBelow;
    setMenuStyle({
      bottom: placeAbove ? window.innerHeight - rect.top + gap : undefined,
      left,
      maxHeight: Math.max(148, Math.min(360, availableHeight)),
      top: placeAbove ? undefined : rect.bottom + gap,
      width,
    });
  };

  const openMenu = () => {
    if (open) return;
    setQuery('');
    setActiveIndex(Math.max(options.findIndex((option) => option.value === value), 0));
    updateMenuStyle();
    setOpen(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const closeMenu = () => {
    setQuery('');
    setOpen(false);
  };

  const choose = (option: ContractProjectFilterOption) => {
    onChange(option.value);
    closeMenu();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) closeMenu();
    };
    window.addEventListener('resize', updateMenuStyle);
    window.addEventListener('scroll', updateMenuStyle, true);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('resize', updateMenuStyle);
      window.removeEventListener('scroll', updateMenuStyle, true);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open, options.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => {
        if (!visibleOptions.length) return 0;
        return event.key === 'ArrowDown'
          ? (index + 1) % visibleOptions.length
          : (index - 1 + visibleOptions.length) % visibleOptions.length;
      });
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : Math.max(visibleOptions.length - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) choose(option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const menu = open ? (
    <div
      ref={menuRef}
      className="custom-select-menu custom-select-menu-toolbar custom-select-menu-fixed contract-project-filter-menu"
      style={menuStyle}
    >
      <label className="contract-project-filter-search">
        <Search size={15} aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="search"
          role="searchbox"
          aria-label="搜索关联项目"
          aria-controls={listboxId}
          aria-activedescendant={visibleOptions[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder="搜索关联项目"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
      </label>
      <div id={listboxId} className="contract-project-filter-options" role="listbox" aria-label="关联项目选项">
        {visibleOptions.map((option, index) => {
          const optionSelected = option.value === value;
          return (
            <button
              id={`${listboxId}-option-${index}`}
              className={`custom-select-option${optionSelected ? ' custom-select-option-selected' : ''}${activeIndex === index ? ' contract-project-filter-option-active' : ''}`}
              type="button"
              role="option"
              aria-selected={optionSelected}
              tabIndex={-1}
              key={option.value || 'all-projects'}
              onPointerDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              <span className="contract-project-filter-radio" aria-hidden="true" />
              <span className="custom-select-option-copy">
                <span className="custom-select-option-label" title={option.label}>{option.label}</span>
                <span className="contract-project-filter-option-meta">
                  {option.description ? <span>{option.description}</span> : null}
                  {typeof option.contractCount === 'number' ? <span>{option.contractCount} 份合同</span> : null}
                </span>
              </span>
            </button>
          );
        })}
        {!visibleOptions.length ? <div className="contract-project-filter-empty" role="status">没有匹配的关联项目</div> : null}
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`contract-project-filter contract-toolbar-field${open ? ' is-open' : ''}`}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (event.currentTarget.contains(nextTarget) || menuRef.current?.contains(nextTarget)) return;
        closeMenu();
      }}
    >
      <span className="contract-toolbar-field-label">关联项目</span>
      <button
        ref={triggerRef}
        className="contract-project-filter-trigger"
        type="button"
        role="combobox"
        aria-label="筛选关联项目"
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open}
        title={selected?.label}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) openMenu();
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            closeMenu();
          }
        }}
        onClick={() => {
          if (open) closeMenu();
          else openMenu();
        }}
      >
        <span>{selected?.label ?? '全部关联项目'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {menu && typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
    </div>
  );
}

const templateReadinessFor = (contract: ContractRecord) => {
  const blockerCount = contract.issues.filter((issue) => issue.severity === 'blocker').length;
  return { ready: blockerCount === 0, label: blockerCount === 0 ? '可使用' : '待完善' };
};

function ContractValidityCell({ contract, referenceDate }: { contract: ContractRecord; referenceDate: string }) {
  const validity = getContractValidity(contract, referenceDate);
  if (validity.status === 'ACTIVE') {
    return <span className="contract-validity-date">{validity.endDate}</span>;
  }
  if (validity.status === 'LONG_TERM') {
    return <span className="contract-validity-badge is-long-term">长期有效</span>;
  }
  if (validity.status === 'UNSET') {
    return <span className="contract-validity-badge is-unset">未设置</span>;
  }

  const label = validity.status === 'EXPIRES_TODAY'
    ? '今日到期'
    : validity.status === 'EXPIRED'
      ? `已到期 · ${Math.abs(validity.daysRemaining ?? 0)}天`
      : `即将到期 · ${validity.daysRemaining}天`;
  const tone = validity.status === 'EXPIRING'
    ? 'is-warning'
    : validity.status === 'EXPIRING_URGENT'
      ? 'is-urgent'
      : 'is-expired';

  return (
    <span className="contract-validity-stack">
      <span className="contract-validity-date">{validity.endDate}</span>
      <span className={`contract-validity-badge ${tone}`}>{label}</span>
    </span>
  );
}

export function ContractsPage({
  contracts,
  projects,
  projectDirectory = projects,
  creators,
  canUpload,
  canEditTemplates = false,
  canDelete,
  canDeleteContract,
  focusedContractId,
  onFocusCleared,
  onUploadContracts,
  onUploadContract,
  onBindFrameworkContract,
  onCreateContract,
  onUpdateContract,
  onDeleteContracts,
  notify,
}: {
  contracts: ContractRecord[];
  projects: ProjectSummary[];
  projectDirectory?: ProjectSummary[];
  creators: CreatorProfile[];
  canUpload: boolean;
  canEditTemplates?: boolean;
  canDelete: boolean;
  canDeleteContract: (contract: ContractRecord) => boolean;
  focusedContractId: string | null;
  onFocusCleared: () => void;
  onUploadContracts?: (inputs: ContractUploadInput[]) => ContractRecord[];
  onUploadContract?: (input: ContractUploadInput) => ContractRecord;
  onBindFrameworkContract?: (ioContractId: ContractId, frameworkContractId?: ContractId) => boolean;
  onCreateContract?: () => void;
  onUpdateContract: (contract: ContractRecord) => void;
  onDeleteContracts: (contractIds: string[]) => number;
  notify: Notify;
}) {
  const handleUploadContracts = (inputs: ContractUploadInput[]) => (
    onUploadContracts
      ? onUploadContracts(inputs)
      : inputs.map((input) => onUploadContract?.(input)).filter((record): record is ContractRecord => Boolean(record))
  );
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ContractFilter>('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [validityFilter, setValidityFilter] = useState<ContractValidityFilter>('all');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(focusedContractId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedContract = selectedContractId
    ? contracts.find((contract) => contract.id === selectedContractId)
    : null;
  const referenceDate = currentContractReferenceDate();

  const displayProjects = useMemo(() => {
    const merged = new Map<string, ProjectSummary>();
    [...projects, ...(projectDirectory ?? [])].forEach((project) => {
      const key = String(project.cooperationProjectId ?? project.projectId ?? project.id);
      merged.set(key, project);
    });
    return [...merged.values()];
  }, [projectDirectory, projects]);

  const projectFilterOptions = useMemo<ContractProjectFilterOption[]>(() => {
    const optionsByValue = new Map<string, ContractProjectFilterOption>();
    contracts.filter((contract) => !contract.isTemplate).forEach((contract) => {
      const display = projectDisplayFor(contract, displayProjects);
      const value = projectFilterKeyFor(contract, displayProjects);
      const existing = optionsByValue.get(value);
      if (existing) {
        existing.contractCount = (existing.contractCount ?? 0) + 1;
        return;
      }
      optionsByValue.set(value, {
        value,
        label: display.name,
        description: display.code || contract.brand || undefined,
        searchText: `${display.name} ${display.code} ${contract.brand}`,
        contractCount: 1,
      });
    });
    return [
      {
        value: '',
        label: '全部关联项目',
        description: '不限制关联项目',
        searchText: '全部',
        contractCount: contracts.filter((contract) => !contract.isTemplate).length,
      },
      ...[...optionsByValue.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')),
    ];
  }, [contracts, displayProjects]);

  useEffect(() => {
    if (projectFilter && !projectFilterOptions.some((option) => option.value === projectFilter)) {
      setProjectFilter('');
    }
  }, [projectFilter, projectFilterOptions]);

  const filteredContracts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contracts.filter((contract) => {
      const readiness = getContractReadiness(contract);
      const validity = getContractValidity(contract, referenceDate);
      const realName = creatorRealNameFor(contract, creators);
      const project = projectDisplayFor(contract, displayProjects);
      const matchesQuery = !query || `${contract.id}${contract.ioId}${contract.name}${contract.project}${contract.brand}${contract.publisher}${realName}${project.name}${project.code}`
        .toLowerCase()
        .includes(query);
      const matchesFilter = (
        (filter === 'all' && !contract.isTemplate)
        || (filter === 'ready' && isContractAvailableForNewAssociation(contract, referenceDate))
        || (filter === 'attention' && (!readiness.ready || validity.expired) && !contract.isTemplate)
        || (filter === 'template' && contract.isTemplate)
      );
      const matchesValidity = contract.isTemplate
        || contractMatchesValidityFilter(contract, validityFilter, referenceDate);
      const matchesProject = contract.isTemplate
        || !projectFilter
        || projectFilterKeyFor(contract, displayProjects) === projectFilter;
      return matchesQuery && matchesFilter && matchesProject && matchesValidity;
    });
  }, [contracts, creators, displayProjects, filter, projectFilter, referenceDate, search, validityFilter]);
  const {
    page,
    pageItems: visible,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination(filteredContracts, { resetKey: `${search}\u0000${filter}\u0000${projectFilter}\u0000${validityFilter}` });

  const readyCount = contracts.filter((contract) => (
    isContractAvailableForNewAssociation(contract, referenceDate)
  )).length;
  const attentionCount = contracts.filter((contract) => (
    !contract.isTemplate
    && (!getContractReadiness(contract).ready || getContractValidity(contract, referenceDate).expired)
  )).length;
  const templateCount = contracts.filter((contract) => contract.isTemplate).length;
  const businessContractCount = contracts.length - templateCount;
  const contractFilterCounts: Record<ContractFilter, number> = {
    all: businessContractCount,
    ready: readyCount,
    attention: attentionCount,
    template: templateCount,
  };
  const selected = useMemo(
    () => selectedContracts(contracts, selectedIds),
    [contracts, selectedIds],
  );
  const visibleIds = useMemo(
    () => filter === 'template' ? [] : filteredContracts.map(contractSelectionId),
    [filter, filteredContracts],
  );
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const selectedCanBeDeleted = selected.length > 0 && selected.every(canDeleteContract);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected;
    }
  }, [allVisibleSelected, selectedVisibleCount]);

  useEffect(() => {
    const contractIds = new Set(contracts.map(contractSelectionId));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => contractIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [contracts]);

  const toggleContract = (contractId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(contractId)) next.delete(contractId);
      else next.add(contractId);
      return next;
    });
  };

  const exportSelectedContracts = async () => {
    if (exporting) return;
    if (!selected.length) {
      notify('请选择合同', '请先勾选需要导出的合同。');
      return;
    }
    setExporting(true);
    try {
      const archive = await createContractExportArchive(selected);
      downloadBlob(archive.blob, contractExportArchiveFilename());
      notify(
        '合同导出完成',
        archive.failures.length
          ? `已导出 ${selected.length} 份合同清单和 ${archive.documentCount} 个文件，${archive.failures.length} 个源文件暂不可读取。`
          : `已导出 ${selected.length} 份合同及 ${archive.documentCount} 个源文件。`,
      );
    } catch {
      notify('合同导出失败', '浏览器未能生成批量合同压缩包，请稍后重试。');
    } finally {
      setExporting(false);
    }
  };
  const requestDeleteSelectedContracts = () => {
    if (!selected.length) {
      notify('请选择合同', '请先勾选需要删除的合同。');
      return;
    }
    if (!selectedCanBeDeleted) {
      notify('无法删除所选合同', '所选合同中包含无权删除的记录，请重新选择。');
      return;
    }
    setDeleteConfirmOpen(true);
  };
  const openContract = (contractId: string) => {
    setSelectedContractId(contractId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const isTemplateTab = filter === 'template';

  if (selectedContract) {
    return (
      <ContractDetailPage
        contract={selectedContract}
        contracts={contracts}
        projects={projects}
        projectDirectory={displayProjects}
        creators={creators}
        canEditTemplate={canEditTemplates}
        notify={notify}
        onUpdateContract={onUpdateContract}
        onBindFrameworkContract={onBindFrameworkContract}
        onUploadContracts={handleUploadContracts}
        onBack={() => {
          setSelectedContractId(null);
          onFocusCleared();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  return (
    <div className="page-stack contracts-page">
      <PageHeading
        title="合同管理"
        subtitle="生成合同草稿、上传线下签署文件，并确认合同是否可进入 Invoice 校验。"
        actions={canUpload ? (
          <div className="page-heading-actions">
            {onCreateContract
              ? <Button variant="secondary" icon={<FilePlus2 size={17} />} onClick={onCreateContract}>生成合同</Button>
              : null}
            <Button icon={<Upload size={17} />} onClick={() => setUploadOpen(true)}>上传合同</Button>
          </div>
        ) : undefined}
      />

      <div className="contract-overview-strip">
        <article className="contract-overview-card contract-overview-card-peach">
          <span>合同总数</span>
          <strong>{contracts.length}</strong>
          <small>{businessContractCount} 份业务合同 · {templateCount} 份参考模板</small>
        </article>
        <article className="contract-overview-card contract-overview-card-mint">
          <span>可用于付款项目</span>
          <strong>{readyCount}</strong>
          <small>资料完整，可进入请款与付款流程</small>
        </article>
        <article className="contract-overview-card contract-overview-card-amber">
          <span>待处理合同</span>
          <strong>{attentionCount}</strong>
          <small>存在信息缺失或付款阻断项</small>
        </article>
      </div>

      <section className="content-card">
        <div className="tabs-row contract-filter-tabs" role="tablist" aria-label="合同筛选">
          {([
            ['all', '全部'],
            ['ready', '可付款'],
            ['attention', '待处理'],
            ['template', '模板'],
          ] as Array<[ContractFilter, string]>).map(([value, label]) => (
            <button
              className={`tab-button ${filter === value ? 'tab-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={filter === value}
              key={value}
              onClick={() => setFilter(value)}
            >
              {label}
              <span>{contractFilterCounts[value]}</span>
            </button>
          ))}
          {!isTemplateTab ? (
            <div className="contract-bulk-actions">
              <Button
                variant="secondary"
                data-testid="contract-bulk-export"
                icon={<Download size={15} />}
                disabled={exporting}
                onClick={() => { void exportSelectedContracts(); }}
              >
                {exporting ? '导出中...' : '导出'}
              </Button>
              {canDelete ? (
                <Button
                  variant="danger"
                  data-testid="contract-bulk-delete"
                  icon={<Trash2 size={15} />}
                  title={selected.length && !selectedCanBeDeleted ? '所选合同中包含无权删除的记录' : undefined}
                  onClick={requestDeleteSelectedContracts}
                >
                  删除
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="content-toolbar contract-toolbar">
          <label className="contract-toolbar-field contract-toolbar-search-field">
            <span className="contract-toolbar-field-label">关键词</span>
            <span className="search-control page-search">
              <Search size={16} />
              <input
                aria-label="搜索合同、项目或Publisher"
                placeholder="搜索合同、项目、品牌或Publisher"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </span>
          </label>
          {!isTemplateTab ? (
            <div className="contract-toolbar-filters">
              <ContractProjectFilter
                value={projectFilter}
                options={projectFilterOptions}
                onChange={setProjectFilter}
              />
              <div className="contract-toolbar-field contract-validity-filter-field">
                <span className="contract-toolbar-field-label">有效期</span>
                <SelectField
                  ariaLabel="筛选合同有效期"
                  className="contract-validity-select"
                  menuClassName="contract-validity-select-menu"
                  menuStrategy="fixed"
                  menuWidth={196}
                  options={CONTRACT_VALIDITY_FILTERS}
                  selectedLabel={validityFilter === 'all'
                    ? '全部有效期'
                    : CONTRACT_VALIDITY_FILTERS.find((item) => item.value === validityFilter)?.label ?? '全部有效期'}
                  value={validityFilter}
                  leadingIcon={<CalendarDays size={16} />}
                  onChange={setValidityFilter}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="table-scroll">
          <table className={`data-table operational-table contract-table${isTemplateTab ? ' contract-template-table' : ''}`}>
            <thead>
              {isTemplateTab ? (
                <tr>
                  <th>模板名称</th>
                  <th>合同类型</th>
                  <th className="contract-date-cell">更新日期</th>
                  <th>使用就绪度</th>
                  <th className="action-cell">操作</th>
                </tr>
              ) : (
                <tr>
                  <th className="contract-select-cell">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      aria-label="全选当前列表合同"
                      checked={allVisibleSelected}
                      disabled={!filteredContracts.length}
                      onChange={() => setSelectedIds((current) => toggleVisibleContractSelection(current, filteredContracts))}
                    />
                  </th>
                  <th>合同名称 / IO 单名称</th>
                  <th>Publisher</th>
                  <th>关联项目</th>
                  <th>合同金额</th>
                  <th>到期时间</th>
                  <th>付款就绪度</th>
                  <th className="action-cell">操作</th>
                </tr>
              )}
            </thead>
            <tbody>
              {visible.map((contract) => {
                const readiness = getContractReadiness(contract);
                const validity = getContractValidity(contract, referenceDate);
                const stableId = contractSelectionId(contract);
                const rowSelected = selectedIds.has(stableId);
                const project = projectDisplayFor(contract, displayProjects);
                const realName = creatorRealNameFor(contract, creators);
                const templateReadiness = templateReadinessFor(contract);
                if (isTemplateTab) {
                  return (
                    <tr className="clickable-table-row" key={stableId} onClick={() => openContract(contract.id)}>
                      <td>
                        <button
                          className="contract-name-link"
                          type="button"
                          onClick={(event) => { event.stopPropagation(); openContract(contract.id); }}
                        >
                          <strong>{contract.name}</strong>
                          <small>{contract.id}</small>
                        </button>
                      </td>
                      <td>
                        <span className={`contract-type-badge contract-type-${getContractType(contract).toLowerCase()}`}>
                          {CONTRACT_TYPE_LABELS[getContractType(contract)]}
                        </span>
                      </td>
                      <td className="contract-date-cell">{contract.updated}</td>
                      <td>
                        <span className={`contract-readiness contract-readiness-${templateReadiness.ready ? 'ready' : 'attention'}`}>
                          <i />
                          {templateReadiness.label}
                        </span>
                      </td>
                      <td className="action-cell">
                        <ListActionButton kind={canEditTemplates ? 'edit' : 'view'} onClick={(event) => { event.stopPropagation(); openContract(contract.id); }}>
                          {canEditTemplates ? '编辑模板' : '查看模板'}
                        </ListActionButton>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr
                    className={`clickable-table-row${rowSelected ? ' is-selected' : ''}`}
                    key={stableId}
                    aria-selected={rowSelected}
                    onClick={() => openContract(contract.id)}
                  >
                    <td className="contract-select-cell" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`选择合同 ${contract.id}`}
                        checked={rowSelected}
                        onChange={() => toggleContract(stableId)}
                      />
                    </td>
                    <td>
                      <button
                        className="contract-name-link"
                        type="button"
                        title={`${contract.name} · ${contract.id}${contract.ioId ? ` · ${contract.ioId}` : ''}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openContract(contract.id);
                        }}
                      >
                        <strong>{contract.name}</strong>
                        <span className={`contract-type-badge contract-type-${getContractType(contract).toLowerCase()}`}>
                          {CONTRACT_TYPE_LABELS[getContractType(contract)]}
                        </span>
                        <small>{contract.id}{contract.ioId ? ` · ${contract.ioId}` : ''}</small>
                        {contract.frameworkContractId ? <small className="contract-relation-subtext">框架合同：{contract.frameworkContractId}</small> : null}
                      </button>
                    </td>
                    <td title={realName}>{realName}</td>
                    <td title={[project.name, project.code || contract.brand].filter(Boolean).join(' · ')}><strong className="contract-project-name">{project.name}</strong><small className="cell-subtext">{project.code || contract.brand}</small></td>
                    <td>{formatContractMoney(contract)}</td>
                    <td><ContractValidityCell contract={contract} referenceDate={referenceDate} /></td>
                    <td>
                      <span className={`contract-readiness contract-readiness-${validity.expired ? 'expired' : readiness.ready ? 'ready' : contract.isTemplate ? 'template' : 'attention'}`}>
                        <i />
                        {validity.expired ? '已失效' : contract.isTemplate ? '参考模板' : readiness.label}
                      </span>
                    </td>
                    <td className="action-cell">
                      <ListActionButton kind="view" onClick={(event) => { event.stopPropagation(); openContract(contract.id); }}>查看合同</ListActionButton>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 ? <tr><td className="request-project-empty" colSpan={isTemplateTab ? 5 : 8}>暂无符合条件的合同</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>共 {filteredContracts.length} 条</span>
          <Pagination
            ariaLabel="合同列表分页"
            page={page}
            pageSize={pageSize}
            total={filteredContracts.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </section>
      {uploadOpen ? (
        <ContractUploadWizard
          projects={projects}
          creators={creators}
          contracts={contracts}
          onClose={() => setUploadOpen(false)}
          onSave={(inputs) => {
            const records = handleUploadContracts(inputs);
            setUploadOpen(false);
            if (records[0]) openContract(records[0].id);
            const first = inputs[0];
            notify('合同已保存', `${records[0]?.name ?? first?.contractName ?? '新上传合同'} 已关联 ${first?.projectName ?? '当前项目'} / ${first?.creatorName ?? '当前达人'}，等待字段人工确认。`);
          }}
        />
      ) : null}
      {deleteConfirmOpen ? (
        <Modal
          title="删除已选合同"
          width="480px"
          className="contract-delete-modal"
          onClose={() => setDeleteConfirmOpen(false)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>取消</Button>
              <Button
                variant="danger"
                icon={<Trash2 size={15} />}
                onClick={() => {
                  const deletedCount = onDeleteContracts(selected.map(contractSelectionId));
                  setDeleteConfirmOpen(false);
                  if (deletedCount > 0) {
                    setSelectedIds(new Set());
                    notify('合同已删除', `已从当前浏览器会话删除 ${deletedCount} 份合同，相关业务资料已标记为需重新校验。`);
                  }
                }}
              >
                确认删除 {selected.length} 项
              </Button>
            </>
          )}
        >
          <div className="contract-delete-confirmation">
            <span><AlertTriangle size={22} /></span>
            <div>
              <strong>此操作无法在当前会话内撤销</strong>
              <p>将删除已选择的 {selected.length} 份合同，并解除它们与 Invoice、请款项目的关联。</p>
              <small>当前系统为纯前端原型，刷新页面后会恢复初始演示数据。</small>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
