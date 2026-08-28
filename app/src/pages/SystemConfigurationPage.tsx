import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ListActionButton, PageHeading } from '../components/Common';
import { Pagination, usePagination } from '../components/Pagination';
import {
  CONTRACT_TYPE_LABELS,
  getContractType,
  type ContractRecord,
} from '../contracts';
import type { CreatorProfile } from '../types';
import { ContractDetailPage } from './ContractDetailPage';
import type { ProjectSummary } from './ProjectDetailPage';

type Notify = (title: string, message: string) => void;

const templateReadinessFor = (contract: ContractRecord) => {
  const blockerCount = contract.issues.filter((issue) => issue.severity === 'blocker').length;
  return { ready: blockerCount === 0, label: blockerCount === 0 ? '可使用' : '待完善' };
};

export function SystemConfigurationPage({
  contracts,
  projects,
  creators,
  notify,
  onUpdateContract,
}: {
  contracts: ContractRecord[];
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  notify: Notify;
  onUpdateContract: (contract: ContractRecord) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const templates = useMemo(() => contracts.filter((contract) => contract.isTemplate), [contracts]);
  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((contract) => (
      `${contract.name}${contract.id}${CONTRACT_TYPE_LABELS[getContractType(contract)]}`
        .toLowerCase()
        .includes(query)
    ));
  }, [search, templates]);
  const selectedTemplate = selectedTemplateId
    ? templates.find((contract) => (contract.contractId ?? contract.id) === selectedTemplateId) ?? null
    : null;
  const {
    page,
    pageItems,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination(filteredTemplates, { resetKey: search });

  if (selectedTemplate) {
    return (
      <ContractDetailPage
        contract={selectedTemplate}
        contracts={contracts}
        projects={projects}
        creators={creators}
        canEditTemplate
        backLabel="返回系统配置"
        notify={notify}
        onUpdateContract={onUpdateContract}
        onBack={() => setSelectedTemplateId(null)}
      />
    );
  }

  return (
    <div className="page-stack system-configuration-page">
      <PageHeading
        title="系统配置"
        subtitle="维护合同模板及系统级业务配置。"
      />

      <section className="content-card system-configuration-card">
        <div className="system-configuration-section-heading">
          <div>
            <h2>合同模板</h2>
            <p>模板只用于合同生成，不能直接参与请款、Invoice 或付款。</p>
          </div>
          <span>{templates.length} 个模板</span>
        </div>

        <div className="content-toolbar system-configuration-toolbar">
          <label className="search-control page-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="搜索合同模板"
              placeholder="搜索模板名称、编号或合同类型"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="table-scroll">
          <table className="data-table operational-table contract-template-table">
            <thead>
              <tr>
                <th>模板名称</th>
                <th>合同类型</th>
                <th className="contract-date-cell">更新日期</th>
                <th>使用就绪度</th>
                <th className="action-cell">操作</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((template) => {
                const readiness = templateReadinessFor(template);
                const stableId = template.contractId ?? template.id;
                return (
                  <tr className="clickable-table-row" key={stableId} onClick={() => setSelectedTemplateId(stableId)}>
                    <td>
                      <button className="contract-name-link" type="button" onClick={(event) => { event.stopPropagation(); setSelectedTemplateId(stableId); }}>
                        <strong>{template.name}</strong>
                        <small>{template.id}</small>
                      </button>
                    </td>
                    <td>
                      <span className={`contract-type-badge contract-type-${getContractType(template).toLowerCase()}`}>
                        {CONTRACT_TYPE_LABELS[getContractType(template)]}
                      </span>
                    </td>
                    <td className="contract-date-cell">{template.updated}</td>
                    <td>
                      <span className={`contract-readiness contract-readiness-${readiness.ready ? 'ready' : 'attention'}`}>
                        <i />{readiness.label}
                      </span>
                    </td>
                    <td className="action-cell">
                      <ListActionButton kind="edit" onClick={(event) => { event.stopPropagation(); setSelectedTemplateId(stableId); }}>编辑模板</ListActionButton>
                    </td>
                  </tr>
                );
              })}
              {!pageItems.length ? <tr><td className="request-project-empty" colSpan={5}>暂无符合条件的合同模板</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>共 {filteredTemplates.length} 条</span>
          <Pagination
            ariaLabel="合同模板列表分页"
            page={page}
            pageSize={pageSize}
            total={filteredTemplates.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </section>
    </div>
  );
}
