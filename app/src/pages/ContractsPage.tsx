import { AlertTriangle, Download, FilePlus2, Search, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, PageHeading } from '../components/Common';
import { ContractUploadWizard } from '../components/ContractUploadWizard';
import {
  contractExportArchiveFilename,
  contractSelectionId,
  createContractExportArchive,
  selectedContracts,
  toggleVisibleContractSelection,
} from '../contractBatchOperations';
import {
  formatContractMoney,
  getContractReadiness,
  type ContractRecord,
  type ContractUploadInput,
} from '../contracts';
import type { CreatorProfile } from '../types';
import { downloadBlob } from '../invoice/invoiceUtils';
import { ContractDetailPage } from './ContractDetailPage';
import type { ProjectSummary } from './ProjectDetailPage';

type Notify = (title: string, message: string) => void;
type ContractFilter = 'all' | 'ready' | 'attention' | 'template';

export function ContractsPage({
  contracts,
  projects,
  creators,
  canUpload,
  canDelete,
  focusedContractId,
  onFocusCleared,
  onUploadContract,
  onCreateContract,
  onUpdateContract,
  onDeleteContracts,
  notify,
}: {
  contracts: ContractRecord[];
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  canUpload: boolean;
  canDelete: boolean;
  focusedContractId: string | null;
  onFocusCleared: () => void;
  onUploadContract: (input: ContractUploadInput) => ContractRecord;
  onCreateContract?: () => void;
  onUpdateContract: (contract: ContractRecord) => void;
  onDeleteContracts: (contractIds: string[]) => number;
  notify: Notify;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ContractFilter>('all');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(focusedContractId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedContract = selectedContractId
    ? contracts.find((contract) => contract.id === selectedContractId)
    : null;

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contracts.filter((contract) => {
      const readiness = getContractReadiness(contract);
      const matchesQuery = !query || `${contract.id}${contract.ioId}${contract.name}${contract.project}${contract.brand}${contract.publisher}`
        .toLowerCase()
        .includes(query);
      const matchesFilter = (
        filter === 'all'
        || (filter === 'ready' && readiness.ready)
        || (filter === 'attention' && !readiness.ready && !contract.isTemplate)
        || (filter === 'template' && contract.isTemplate)
      );
      return matchesQuery && matchesFilter;
    });
  }, [contracts, filter, search]);

  const readyCount = contracts.filter((contract) => getContractReadiness(contract).ready).length;
  const attentionCount = contracts.filter((contract) => !contract.isTemplate && !getContractReadiness(contract).ready).length;
  const templateCount = contracts.filter((contract) => contract.isTemplate).length;
  const businessContractCount = contracts.length - templateCount;
  const selected = useMemo(
    () => selectedContracts(contracts, selectedIds),
    [contracts, selectedIds],
  );
  const visibleIds = useMemo(() => visible.map(contractSelectionId), [visible]);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

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
    if (!selected.length || exporting) return;
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
  const openContract = (contractId: string) => {
    setSelectedContractId(contractId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (selectedContract) {
    return (
      <ContractDetailPage
        contract={selectedContract}
        notify={notify}
        onUpdateContract={onUpdateContract}
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
        <div className="content-toolbar contract-toolbar">
          <label className="search-control page-search">
            <Search size={16} />
            <input
              aria-label="搜索合同、项目或Publisher"
              placeholder="搜索合同、项目、品牌或Publisher"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="contract-toolbar-controls">
            <div className="toolbar-chips" aria-label="合同筛选">
              {([
                ['all', '全部'],
                ['ready', '可付款'],
                ['attention', '待处理'],
                ['template', '模板'],
              ] as Array<[ContractFilter, string]>).map(([value, label]) => (
                <button
                  className={`chip ${filter === value ? 'chip-active' : ''}`}
                  type="button"
                  aria-pressed={filter === value}
                  key={value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="contract-bulk-actions">
              <span className="contract-selection-count" aria-live="polite">
                {selected.length ? `已选择 ${selected.length} 项` : '请选择合同'}
              </span>
              <Button
                variant="secondary"
                data-testid="contract-bulk-export"
                icon={<Download size={15} />}
                disabled={!selected.length || exporting}
                onClick={() => { void exportSelectedContracts(); }}
              >
                {exporting ? '导出中...' : '导出'}
              </Button>
              {canDelete ? (
                <Button
                  variant="danger"
                  data-testid="contract-bulk-delete"
                  icon={<Trash2 size={15} />}
                  disabled={!selected.length}
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  删除
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table operational-table contract-table">
            <thead>
              <tr>
                <th className="contract-select-cell">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="全选当前列表合同"
                    checked={allVisibleSelected}
                    disabled={!visible.length}
                    onChange={() => setSelectedIds((current) => toggleVisibleContractSelection(current, visible))}
                  />
                </th>
                <th>合同</th>
                <th>Publisher</th>
                <th>项目 / 品牌</th>
                <th>合同金额</th>
                <th>付款就绪度</th>
                <th className="contract-date-cell">更新日期</th>
                <th className="action-cell">操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((contract) => {
                const readiness = getContractReadiness(contract);
                const stableId = contractSelectionId(contract);
                const rowSelected = selectedIds.has(stableId);
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
                        onClick={(event) => {
                          event.stopPropagation();
                          openContract(contract.id);
                        }}
                      >
                        <strong>{contract.name}</strong>
                        <small>{contract.id} · {contract.ioId}</small>
                      </button>
                    </td>
                    <td>{contract.publisher || '待补充'}</td>
                    <td><strong className="contract-project-name">{contract.project}</strong><small className="cell-subtext">{contract.brand}</small></td>
                    <td>{formatContractMoney(contract)}</td>
                    <td>
                      <span className={`contract-readiness contract-readiness-${readiness.ready ? 'ready' : contract.isTemplate ? 'template' : 'attention'}`}>
                        <i />
                        {contract.isTemplate ? '参考模板' : readiness.label}
                      </span>
                    </td>
                    <td className="contract-date-cell">{contract.updated}</td>
                    <td className="action-cell">
                      <button className="text-link" type="button" onClick={(event) => { event.stopPropagation(); openContract(contract.id); }}>查看合同</button>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 ? <tr><td className="request-project-empty" colSpan={8}>暂无符合条件的合同</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      {uploadOpen ? (
        <ContractUploadWizard
          projects={projects}
          creators={creators}
          contracts={contracts}
          onClose={() => setUploadOpen(false)}
          onSave={(input) => {
            const contract = onUploadContract(input);
            setUploadOpen(false);
            openContract(contract.id);
            notify('合同已保存', `${input.sourceDocuments.length} 份文件已关联 ${input.projectName} / ${input.creatorName}，等待字段人工确认。`);
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
