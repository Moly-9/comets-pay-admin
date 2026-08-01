import {
  AlertTriangle,
  ChevronRight,
  FileCheck2,
  Search,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ContractRecord } from "../types";

interface ContractListProps {
  contracts: ContractRecord[];
  canManage: boolean;
  onOpen: (contract: ContractRecord) => void;
  onUpload: () => void;
}

const recordTone = (status: ContractRecord["status"]) => {
  if (status === "已确认") return "confirmed";
  if (status === "需核对") return "conflict";
  return "detected";
};

export function ContractList({
  contracts,
  canManage,
  onOpen,
  onUpload,
}: ContractListProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "pending" | "confirmed">("all");
  const filtered = useMemo(
    () =>
      contracts.filter((contract) => {
        const matchesQuery = [
          contract.id,
          contract.ioId,
          contract.name,
          contract.advertiser,
          contract.publisher,
        ].some((value) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
        const matchesTab =
          tab === "all" ||
          (tab === "confirmed"
            ? contract.status === "已确认"
            : contract.status !== "已确认");
        return matchesQuery && matchesTab;
      }),
    [contracts, query, tab],
  );
  const reviewCount = contracts.filter(
    (contract) => contract.status !== "已确认",
  ).length;

  return (
    <div className="cr-page-stack">
      <div className="cr-page-heading">
        <div>
          <h1>合同管理</h1>
          <p>管理合同文件、识别结果及与项目和付款资料的关联状态。</p>
        </div>
        {canManage ? (
          <button
            type="button"
            className="cr-button cr-button-primary"
            onClick={onUpload}
          >
            <Upload size={17} />
            上传合同
          </button>
        ) : null}
      </div>

      <div className="cr-metrics">
        <article>
          <span className="cr-metric-icon cr-metric-icon-purple">
            <FileCheck2 size={21} />
          </span>
          <div>
            <strong>{contracts.length}</strong>
            <small>合同总数</small>
          </div>
        </article>
        <article>
          <span className="cr-metric-icon cr-metric-icon-amber">
            <AlertTriangle size={21} />
          </span>
          <div>
            <strong>{reviewCount}</strong>
            <small>待确认或需核对</small>
          </div>
        </article>
      </div>

      <section className="cr-content-card">
        <div className="cr-tabs">
          <button
            type="button"
            className={tab === "all" ? "cr-tab-active" : ""}
            onClick={() => setTab("all")}
          >
            全部 <span>{contracts.length}</span>
          </button>
          <button
            type="button"
            className={tab === "pending" ? "cr-tab-active" : ""}
            onClick={() => setTab("pending")}
          >
            待处理 <span>{reviewCount}</span>
          </button>
          <button
            type="button"
            className={tab === "confirmed" ? "cr-tab-active" : ""}
            onClick={() => setTab("confirmed")}
          >
            已确认
          </button>
        </div>
        <div className="cr-toolbar">
          <label className="cr-search">
            <Search size={16} />
            <input
              value={query}
              placeholder="搜索合同编号、IO、项目或达人"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <span>识别结果需人工确认后才能写入合同资料</span>
        </div>

        <div className="cr-table-scroll">
          <table className="cr-table">
            <thead>
              <tr>
                <th>合同 / 项目</th>
                <th>Advertiser / Publisher</th>
                <th>IO 编号</th>
                <th>文件</th>
                <th>状态</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((contract) => (
                <tr key={contract.id} onClick={() => onOpen(contract)}>
                  <td>
                    <strong>{contract.name}</strong>
                    <small className="cr-mono">{contract.id}</small>
                  </td>
                  <td>
                    <strong>{contract.advertiser}</strong>
                    <small>{contract.publisher}</small>
                  </td>
                  <td className="cr-mono">{contract.ioId}</td>
                  <td>{contract.sourceNames.length} 个</td>
                  <td>
                    <span
                      className={`cr-record-status cr-record-status-${recordTone(contract.status)}`}
                    >
                      <i />
                      {contract.status}
                    </span>
                  </td>
                  <td>
                    <button type="button" aria-label={`查看 ${contract.name}`}>
                      <ChevronRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr>
                  <td className="cr-empty-cell" colSpan={6}>
                    当前筛选条件下没有合同
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <footer className="cr-table-footer">共 {filtered.length} 条</footer>
      </section>
    </div>
  );
}
