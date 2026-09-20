import { CalendarDays, Search } from 'lucide-react';
import { useState } from 'react';
import { Button, ListActionButton, Modal, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { Pagination, usePagination } from '../components/Pagination';
import { PAGE_TITLES } from '../data';
import { filterOperationLogs, type OperationLogEvent, type OperationLogFilters } from '../operationLog';
import './OperationLogPage.css';

const emptyFilters: OperationLogFilters = {
  search: '', startDate: '', endDate: '', actor: '', module: '', action: '', result: '',
};

const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });
const filterLabels = { actor: '操作者', module: '功能模块', action: '动作', result: '结果' } as const;
const filterFields = ['actor', 'module', 'action', 'result'] as const;

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
        <div className="content-toolbar operation-log-toolbar">
          <label className="search-control page-search operation-log-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" aria-label="搜索操作日志" placeholder="搜索操作者、功能或目标编号" value={filters.search} onChange={(event) => update('search', event.target.value)} />
          </label>
          <div className="date-filter operation-log-date-filter">
            <CalendarDays size={17} aria-hidden="true" />
            <label><span className="sr-only">开始日期</span><input type="date" value={filters.startDate} max={filters.endDate || undefined} onChange={(event) => update('startDate', event.target.value)} /></label>
            <span className="date-divider" aria-hidden="true">—</span>
            <label><span className="sr-only">结束日期</span><input type="date" value={filters.endDate} min={filters.startDate || undefined} onChange={(event) => update('endDate', event.target.value)} /></label>
          </div>
          {filterFields.map((field) => (
            <SelectField
              key={field}
              ariaLabel={`按${filterLabels[field]}筛选`}
              className={`operation-log-filter operation-log-filter-${field}`}
              value={filters[field]}
              options={[
                { value: '', label: `全部${filterLabels[field]}` },
                ...options(field).map((value) => ({ value, label: field === 'module' ? PAGE_TITLES[value as OperationLogEvent['module']] : value })),
              ]}
              onChange={(value) => update(field, value)}
            />
          ))}
          <Button className="operation-log-reset" variant="ghost" onClick={() => setFilters(emptyFilters)}>重置筛选</Button>
        </div>
        <div className="table-scroll operation-log-table-scroll">
          <table className="data-table operational-table operation-log-table">
            <thead><tr><th>时间</th><th>操作者</th><th>功能模块</th><th>动作</th><th>目标编号</th><th>结果</th><th className="action-cell">操作</th></tr></thead>
            <tbody>{pageItems.map((event) => (
              <tr key={event.id}>
                <td><time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time></td>
                <td><strong className="operation-log-actor">{event.actorName}</strong><small className="operation-log-secondary">{event.actorRole}</small></td>
                <td>{PAGE_TITLES[event.module]}</td><td>{event.action}</td><td className="operation-log-target">{event.targetId ?? '—'}</td>
                <td><span className={`simple-status ${event.result === '失败' ? 'is-danger' : 'is-success'}`}><i aria-hidden="true" />{event.result}</span></td>
                <td className="action-cell"><ListActionButton kind="view" onClick={() => setSelectedId(event.id)}>查看详情</ListActionButton></td>
              </tr>
            ))}</tbody>
          </table>
          {!visible.length ? <div className="empty-table">{events.length ? '没有符合筛选条件的操作记录' : '当前会话还没有操作记录'}</div> : null}
        </div>
        <div className="table-footer"><span>共 {visible.length} 条记录</span><Pagination ariaLabel="操作日志分页" page={page} pageSize={pageSize} total={visible.length} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>
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
