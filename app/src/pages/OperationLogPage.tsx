import { Search } from 'lucide-react';
import { useState } from 'react';
import { Button, ListActionButton, Modal, NoticeBanner, PageHeading } from '../components/Common';
import { Pagination, usePagination } from '../components/Pagination';
import { PAGE_TITLES } from '../data';
import { filterOperationLogs, type OperationLogEvent, type OperationLogFilters } from '../operationLog';
import './OperationLogPage.css';

const emptyFilters: OperationLogFilters = {
  search: '', startDate: '', endDate: '', actor: '', module: '', action: '', result: '',
};

const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });

export function OperationLogPage({ events }: { events: readonly OperationLogEvent[] }) {
  const [filters, setFilters] = useState<OperationLogFilters>(emptyFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = filterOperationLogs(events, filters);
  const selected = events.find((event) => event.id === selectedId);
  const { page, pageItems, pageSize, setPage, setPageSize } = usePagination(visible, {
    resetKey: Object.values(filters).join('\u0000'),
  });
  const update = (field: keyof OperationLogFilters, value: string) => setFilters((current) => ({ ...current, [field]: value }));
  const options = (field: 'actor' | 'module' | 'action' | 'result') => [...new Set(events.map((event) => field === 'actor' ? event.actorName : event[field]))];

  return (
    <div className="page-stack operation-log-page">
      <PageHeading title="操作日志" subtitle="查看当前会话内的功能访问和关键操作结果。" />
      <NoticeBanner><strong>前端演示记录：</strong>仅记录当前浏览器页面的操作，刷新后清空；它不是跨设备、不可篡改的审计日志。</NoticeBanner>
      <section className="content-card operation-log-card" aria-label="操作日志列表">
        <div className="operation-log-toolbar">
          <label className="search-control page-search operation-log-search">
            <Search size={16} aria-hidden="true" />
            <input aria-label="搜索操作日志" placeholder="搜索操作者、功能或目标编号" value={filters.search} onChange={(event) => update('search', event.target.value)} />
          </label>
          <label>开始日期<input type="date" value={filters.startDate} max={filters.endDate || undefined} onChange={(event) => update('startDate', event.target.value)} /></label>
          <label>结束日期<input type="date" value={filters.endDate} min={filters.startDate || undefined} onChange={(event) => update('endDate', event.target.value)} /></label>
          {(['actor', 'module', 'action', 'result'] as const).map((field) => (
            <label key={field}>{({ actor: '操作者', module: '功能模块', action: '动作', result: '结果' })[field]}
              <select value={filters[field]} onChange={(event) => update(field, event.target.value)}>
                <option value="">全部</option>
                {options(field).map((value) => <option key={value} value={value}>{field === 'module' ? PAGE_TITLES[value as OperationLogEvent['module']] : value}</option>)}
              </select>
            </label>
          ))}
          <Button variant="ghost" onClick={() => setFilters(emptyFilters)}>重置</Button>
        </div>
        {visible.length ? (
          <>
            <div className="table-scroll operation-log-table-scroll">
              <table className="data-table operational-table operation-log-table">
                <thead><tr><th>时间</th><th>操作者</th><th>功能模块</th><th>动作</th><th>目标编号</th><th>结果</th><th className="action-cell">操作</th></tr></thead>
                <tbody>{pageItems.map((event) => (
                  <tr key={event.id}>
                    <td><time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time></td>
                    <td><strong>{event.actorName}</strong><small className="operation-log-secondary">{event.actorRole}</small></td>
                    <td>{PAGE_TITLES[event.module]}</td><td>{event.action}</td><td>{event.targetId ?? '—'}</td>
                    <td><span className={`operation-log-result ${event.result === '失败' ? 'is-failure' : ''}`}>{event.result}</span></td>
                    <td className="action-cell"><ListActionButton kind="view" onClick={() => setSelectedId(event.id)}>查看详情</ListActionButton></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="table-footer"><span>共 {visible.length} 条记录</span><Pagination ariaLabel="操作日志分页" page={page} pageSize={pageSize} total={visible.length} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>
          </>
        ) : <div className="operation-log-empty">{events.length ? '没有符合筛选条件的操作记录' : '当前会话还没有操作记录'}</div>}
      </section>
      {selected ? <Modal title="操作详情" onClose={() => setSelectedId(null)} width="520px" footer={<Button variant="secondary" onClick={() => setSelectedId(null)}>关闭</Button>}>
        <dl className="operation-log-detail">
          <div><dt>时间</dt><dd><time dateTime={selected.occurredAt}>{formatTime(selected.occurredAt)}</time></dd></div>
          <div><dt>操作者</dt><dd>{selected.actorName} · {selected.actorRole}</dd></div>
          <div><dt>功能模块</dt><dd>{PAGE_TITLES[selected.module]}</dd></div>
          <div><dt>动作 / 结果</dt><dd>{selected.action} · {selected.result}</dd></div>
          <div><dt>目标编号</dt><dd>{selected.targetId ?? '—'}</dd></div>
          <div><dt>摘要</dt><dd>{selected.summary}</dd></div>
        </dl>
      </Modal> : null}
    </div>
  );
}
