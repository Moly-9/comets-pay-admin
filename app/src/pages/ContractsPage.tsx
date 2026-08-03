import { Search, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, PageHeading } from '../components/Common';
import { ContractUploadWizard } from '../components/ContractUploadWizard';
import {
  formatContractMoney,
  getContractReadiness,
  type ContractRecord,
  type ContractUploadInput,
} from '../contracts';
import type { CreatorProfile } from '../types';
import { ContractDetailPage } from './ContractDetailPage';
import type { ProjectSummary } from './ProjectDetailPage';

type Notify = (title: string, message: string) => void;
type ContractFilter = 'all' | 'ready' | 'attention' | 'template';

export function ContractsPage({
  contracts,
  projects,
  creators,
  canUpload,
  focusedContractId,
  onFocusCleared,
  onUploadContract,
  onUpdateContract,
  notify,
}: {
  contracts: ContractRecord[];
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  canUpload: boolean;
  focusedContractId: string | null;
  onFocusCleared: () => void;
  onUploadContract: (input: ContractUploadInput) => ContractRecord;
  onUpdateContract: (contract: ContractRecord) => void;
  notify: Notify;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ContractFilter>('all');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(focusedContractId);
  const [uploadOpen, setUploadOpen] = useState(false);
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
        subtitle="上传合同、查看原文与结构化字段，并确认合同是否可进入付款项目。"
        actions={canUpload ? <Button icon={<Upload size={17} />} onClick={() => setUploadOpen(true)}>上传合同</Button> : undefined}
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
        </div>

        <div className="table-scroll">
          <table className="data-table operational-table contract-table">
            <thead>
              <tr>
                <th>合同</th>
                <th>Publisher</th>
                <th>项目 / 品牌</th>
                <th>合同金额</th>
                <th>付款就绪度</th>
                <th>更新日期</th>
                <th className="action-cell">操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((contract) => {
                const readiness = getContractReadiness(contract);
                return (
                  <tr
                    className="clickable-table-row"
                    key={contract.id}
                    onClick={() => openContract(contract.id)}
                  >
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
                    <td>{contract.updated}</td>
                    <td className="action-cell">
                      <button className="text-link" type="button" onClick={(event) => { event.stopPropagation(); openContract(contract.id); }}>查看合同</button>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 ? <tr><td className="request-project-empty" colSpan={7}>暂无符合条件的合同</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      {uploadOpen ? (
        <ContractUploadWizard
          projects={projects}
          creators={creators}
          onClose={() => setUploadOpen(false)}
          onSave={(input) => {
            const contract = onUploadContract(input);
            setUploadOpen(false);
            openContract(contract.id);
            notify('合同已保存', `${input.sourceDocuments.length} 份文件已关联 ${input.projectName} / ${input.creatorName}，等待字段与签署确认。`);
          }}
        />
      ) : null}
    </div>
  );
}
