import { useEffect, useMemo, useState } from 'react';
import { CloudDownload, Plus, RefreshCw, Search, Settings2 } from 'lucide-react';
import { Button, ListActionButton, Modal, PageHeading, SelectField } from '../components/Common';
import { Pagination, usePagination } from '../components/Pagination';
import type { CooperationProjectAvailability, CooperationProjectDirectoryRecord } from '../cooperationProjectDirectory';
import type { FeishuProjectMetadata } from '../cooperationProjects';
import './FeishuCooperationProjectsPage.css';

type FilterValue = 'all' | string;
type ManualDraft = Pick<CooperationProjectDirectoryRecord,
  'name' | 'projectType' | 'projectStatus' | 'initiatorName' | 'startDate' | 'endDate'>;

const EMPTY_DRAFT: ManualDraft = {
  name: '', projectType: '', projectStatus: '', initiatorName: '', startDate: '', endDate: '',
};

const formatTime = (value?: string) => value
  ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '尚未同步';

const availabilityLabel = {
  ACTIVE: '可用', DISABLED: '已停用',
} as const;
export function FeishuCooperationProjectsPage({
  records,
  metadata,
  typeAllowlist,
  lastSyncedAt,
  canManage,
  syncing,
  syncError,
  onAllowlistChange,
  onSync,
  onSaveManual,
  onAvailabilityChange,
}: {
  records: CooperationProjectDirectoryRecord[];
  metadata: FeishuProjectMetadata;
  typeAllowlist: string[];
  lastSyncedAt?: string;
  canManage: boolean;
  syncing: boolean;
  syncError?: string;
  onAllowlistChange: (types: string[]) => void;
  onSync: () => void;
  onSaveManual: (draft: ManualDraft, editingId?: string) => string | undefined;
  onAvailabilityChange: (id: string, availability: 'ACTIVE' | 'DISABLED') => void;
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterValue>('all');
  const [sourceFilter, setSourceFilter] = useState<FilterValue>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<FilterValue>('all');
  const [configOpen, setConfigOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [draft, setDraft] = useState<ManualDraft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState('');

  const allTypes = [...new Set([...metadata.projectTypes, ...records.map((record) => record.projectType)])].filter(Boolean);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => (
      (!query || `${record.name} ${record.initiatorName} ${record.projectCode}`.toLowerCase().includes(query))
      && (typeFilter === 'all' || record.projectType === typeFilter)
      && (sourceFilter === 'all' || record.source === sourceFilter)
      && (availabilityFilter === 'all' || record.availability === availabilityFilter)
    ));
  }, [availabilityFilter, records, search, sourceFilter, typeFilter]);
  const pagination = usePagination(filtered, { resetKey: `${search}\0${typeFilter}\0${sourceFilter}\0${availabilityFilter}` });

  useEffect(() => { pagination.setPage(1); }, [records.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditingId(undefined); setDraft(EMPTY_DRAFT); setFormError(''); setFormOpen(true);
  };
  const openEdit = (record: CooperationProjectDirectoryRecord) => {
    setEditingId(record.id);
    setDraft({ name: record.name, projectType: record.projectType, projectStatus: record.projectStatus, initiatorName: record.initiatorName, startDate: record.startDate, endDate: record.endDate });
    setFormError(''); setFormOpen(true);
  };
  const submit = () => {
    if (Object.values(draft).some((value) => !value.trim())) return setFormError('请填写全部必填字段。');
    if (draft.endDate < draft.startDate) return setFormError('结束时间不得早于开始时间。');
    const warning = onSaveManual(draft, editingId);
    if (warning) { setFormError(warning); return; }
    setFormOpen(false);
  };

  return (
    <div className="page-stack feishu-project-page">
      <PageHeading
        title="飞书关联项目"
        subtitle="集中维护请款可关联的合作项目；飞书数据仅通过同步更新。"
        actions={canManage ? <>
          <Button variant="secondary" icon={<Settings2 size={17} />} onClick={() => setConfigOpen(true)}>配置同步范围</Button>
          <Button variant="secondary" icon={<Plus size={17} />} onClick={openCreate}>手动添加</Button>
          <Button icon={<RefreshCw className={syncing ? 'is-spinning' : ''} size={17} />} disabled={syncing || !typeAllowlist.length} disabledReason={!typeAllowlist.length ? '请先配置项目类型白名单。' : undefined} onClick={onSync}>{syncing ? '同步中' : '同步飞书'}</Button>
        </> : undefined}
      />

      <section className="feishu-project-summary" aria-label="项目目录汇总">
        <article><span>全部项目</span><strong>{records.length}</strong><small>包含历史记录</small></article>
        <article><span>飞书同步</span><strong>{records.filter((item) => item.source === 'FEISHU').length}</strong><small>最近 {formatTime(lastSyncedAt)}</small></article>
        <article><span>手动项目</span><strong>{records.filter((item) => item.source === 'MANUAL').length}</strong><small>本地维护</small></article>
        <article><span>已停用</span><strong>{records.filter((item) => item.availability === 'DISABLED').length}</strong><small>不进入新请款候选</small></article>
      </section>

      {syncError ? <div className="feishu-project-feedback is-error" role="alert">{syncError}</div> : null}
      {!typeAllowlist.length && canManage ? <div className="feishu-project-feedback"><CloudDownload size={17} />白名单当前为空，请先配置项目类型再同步。</div> : null}

      <section className="content-card feishu-project-directory">
        <div className="project-inline-filter-panel feishu-project-filters">
          <label className="feishu-project-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索项目名称、发起人或编号" /></label>
          <SelectField ariaLabel="按项目类型筛选" value={typeFilter} options={[{ value: 'all', label: '全部类型' }, ...allTypes.map((value) => ({ value, label: value }))]} onChange={setTypeFilter} />
          <SelectField ariaLabel="按数据来源筛选" value={sourceFilter} options={[{ value: 'all', label: '全部数据来源' }, { value: 'FEISHU', label: '飞书同步' }, { value: 'MANUAL', label: '手动添加' }]} onChange={setSourceFilter} />
          <SelectField ariaLabel="按可用状态筛选" value={availabilityFilter} options={[{ value: 'all', label: '全部可用状态' }, { value: 'ACTIVE', label: '可用' }, { value: 'DISABLED', label: '已停用' }]} onChange={setAvailabilityFilter} />
        </div>
        <div className="table-scroll feishu-project-table-wrap">
          <table className="data-table operational-table feishu-project-table"><thead><tr><th>项目名称</th><th>项目类型</th><th>项目发起人</th><th>项目周期</th><th>项目更新时间</th><th>数据来源</th><th>可用状态</th>{canManage ? <th>操作</th> : null}</tr></thead>
            <tbody>{pagination.pageItems.map((record) => <tr key={record.id} className={record.availability !== 'ACTIVE' ? 'is-muted' : ''}>
              <td data-label="项目名称"><strong>{record.name}</strong><small>{record.projectCode}</small></td>
              <td data-label="项目类型">{record.projectType}</td><td data-label="项目发起人">{record.initiatorName}</td>
              <td data-label="项目周期">{record.startDate}<small>至 {record.endDate}</small></td><td data-label="项目更新时间">{formatTime(record.sourceUpdatedAt ?? record.localUpdatedAt)}</td>
              <td data-label="数据来源"><span className={`feishu-project-source is-${record.source.toLowerCase()}`}>{record.source === 'FEISHU' ? '飞书同步' : '手动添加'}</span></td>
              <td data-label="可用状态">{canManage ? <SelectField<CooperationProjectAvailability>
                ariaLabel={`修改 ${record.name} 的可用状态`}
                variant="compact"
                menuStrategy="fixed"
                className={`feishu-project-row-availability is-${record.availability.toLowerCase()}`}
                value={record.availability}
                options={[
                  { value: 'ACTIVE', label: '可用', leading: <i className="feishu-project-status-dot is-active" /> },
                  { value: 'DISABLED', label: '已停用', leading: <i className="feishu-project-status-dot is-disabled" /> },
                ]}
                onChange={(availability) => onAvailabilityChange(record.id, availability)}
              /> : <span className={`feishu-project-availability is-${record.availability.toLowerCase()}`}>{availabilityLabel[record.availability]}</span>}</td>
              {canManage ? <td data-label="操作"><span className="feishu-project-actions">{record.source === 'MANUAL' ? <ListActionButton kind="edit" onClick={() => openEdit(record)}>编辑</ListActionButton> : <small>飞书源数据只读</small>}</span></td> : null}
            </tr>)}</tbody></table>
          {!pagination.pageItems.length ? <div className="feishu-project-empty">暂无符合条件的项目。</div> : null}
        </div>
        <Pagination total={filtered.length} page={pagination.page} pageSize={pagination.pageSize} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
      </section>

      {configOpen ? <Modal className="feishu-project-modal" title="配置飞书同步范围" width="520px" onClose={() => setConfigOpen(false)} footer={<Button onClick={() => setConfigOpen(false)}>完成</Button>}><div className="feishu-project-allowlist"><p>只同步精确匹配以下类型的多维表格项目。取消选中后，不再返回的项目会在下次同步时自动设为已停用。</p>{metadata.projectTypes.map((type) => <label key={type}><input type="checkbox" checked={typeAllowlist.includes(type)} onChange={() => onAllowlistChange(typeAllowlist.includes(type) ? typeAllowlist.filter((item) => item !== type) : [...typeAllowlist, type])} /><span>{type}</span></label>)}</div></Modal> : null}

      {formOpen ? <Modal className="feishu-project-modal" title={editingId ? '编辑手动项目' : '手动添加合作项目'} width="640px" onClose={() => setFormOpen(false)} footer={<><Button variant="secondary" onClick={() => setFormOpen(false)}>取消</Button><Button onClick={submit}>保存</Button></>}><div className="feishu-project-form">{([
        ['name', '项目名称', 'text'], ['projectType', '项目类型', 'text'], ['projectStatus', '项目状态', 'text'], ['initiatorName', '项目发起人', 'text'], ['startDate', '开始时间', 'date'], ['endDate', '结束时间', 'date'],
      ] as const).map(([key, label, type]) => <label key={key}><span>{label} *</span>{key === 'projectStatus' ? <SelectField<'ACTIVE' | 'ARCHIVED' | ''> ariaLabel="手动项目状态" variant="form" value={draft.projectStatus as 'ACTIVE' | 'ARCHIVED' | ''} placeholder="请选择项目状态" options={[{ value: 'ACTIVE', label: '进行中', leading: <i className="feishu-project-status-dot is-active" /> }, { value: 'ARCHIVED', label: '已归档', leading: <i className="feishu-project-status-dot is-archived" /> }]} onChange={(projectStatus) => { setDraft((current) => ({ ...current, projectStatus })); setFormError(''); }} /> : <input type={type} value={draft[key]} onChange={(event) => { setDraft((current) => ({ ...current, [key]: event.target.value })); setFormError(''); }} />}</label>)}{formError ? <div className="feishu-project-form-error" role="alert">{formError}</div> : null}</div></Modal> : null}
    </div>
  );
}
