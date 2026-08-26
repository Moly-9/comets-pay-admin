import type { ReactNode } from 'react';
import { Avatar, ListActionButton } from './Common';
import { PaymentProviderBadge } from './PaymentProviderBadge';
import { Pagination, usePagination } from './Pagination';
import type { InvoiceManagementRow } from '../invoice/invoiceManagement';

const STATUS_CLASS: Record<InvoiceManagementRow['status'], string> = {
  草稿: 'draft',
  待发布: 'publish',
  待上传: 'upload',
  待重新上传: 'reupload',
  待签署: 'signature',
  达人反馈: 'feedback',
  待审核: 'review',
  待复核: 'recheck',
  待发起请款: 'request',
  已通过: 'approved',
  OA审批中: 'oa',
  付款中: 'paying',
  已付款: 'paid',
  已退回: 'returned',
};

const formatAmount = (row: InvoiceManagementRow) => (
  `${row.currency} ${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
);

const actionKindFor = (row: InvoiceManagementRow) => {
  if (row.status === '已退回') return 'danger' as const;
  if (row.actionLabel.includes('审核') || row.actionLabel.includes('复核')) return 'review' as const;
  if (row.actionLabel.includes('发布') || row.actionLabel.includes('签署')) return 'execute' as const;
  if (row.actionLabel.includes('处理') || row.actionLabel.includes('草稿')) return 'edit' as const;
  return 'view' as const;
};

export function InvoiceManagementTable({
  rows,
  onSelect,
  onAdditionalAction,
  selectableRowIds,
  selectedRowIds,
  onSelectionChange,
  emptyText = '当前筛选条件下没有 Invoice 记录',
}: {
  rows: InvoiceManagementRow[];
  onSelect: (row: InvoiceManagementRow) => void;
  onAdditionalAction?: (row: InvoiceManagementRow) => void;
  additionalActionIcon?: ReactNode;
  selectableRowIds?: Set<string>;
  selectedRowIds?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  emptyText?: string;
}) {
  const {
    page,
    pageItems,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination(rows, { resetKey: rows.map((row) => row.rowId).join('|') });
  const selectionEnabled = Boolean(selectableRowIds && selectedRowIds && onSelectionChange);
  const pageSelectableIds = selectionEnabled
    ? pageItems.filter((row) => selectableRowIds?.has(row.rowId)).map((row) => row.rowId)
    : [];
  const allPageSelected = Boolean(pageSelectableIds.length && pageSelectableIds.every((id) => selectedRowIds?.has(id)));
  const somePageSelected = Boolean(pageSelectableIds.some((id) => selectedRowIds?.has(id)) && !allPageSelected);

  const togglePageSelection = () => {
    if (!onSelectionChange || !selectedRowIds) return;
    const next = new Set(selectedRowIds);
    pageSelectableIds.forEach((id) => {
      if (allPageSelected) next.delete(id);
      else next.add(id);
    });
    onSelectionChange(next);
  };

  return (
    <div className="table-shell invoice-management-table-shell">
      <div className="table-scroll">
        <table className="data-table invoice-management-table">
          <thead>
            <tr>
              {selectionEnabled ? (
                <th className="invoice-select-cell">
                  <input
                    type="checkbox"
                    aria-label="选择当前页可发布的 Invoice"
                    checked={allPageSelected}
                    disabled={!pageSelectableIds.length}
                    ref={(element) => { if (element) element.indeterminate = somePageSelected; }}
                    onChange={togglePageSelection}
                  />
                </th>
              ) : null}
              <th>达人</th>
              <th>收款主体</th>
              <th>关联项目</th>
              <th>Invoice 编号</th>
              <th>Invoice 类型</th>
              <th>付款渠道</th>
              <th>状态</th>
              <th className="amount-cell">金额</th>
              <th className="action-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length ? pageItems.map((row) => (
              <tr className={selectedRowIds?.has(row.rowId) ? 'is-selected' : ''} key={row.rowId} onClick={() => onSelect(row)}>
                {selectionEnabled ? (
                  <td className="invoice-select-cell" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`选择 ${row.invoiceNumber}`}
                      checked={Boolean(selectedRowIds?.has(row.rowId))}
                      disabled={!selectableRowIds?.has(row.rowId)}
                      title={selectableRowIds?.has(row.rowId) ? '选择并发布' : '当前状态不可发布'}
                      onChange={() => {
                        if (!onSelectionChange || !selectedRowIds) return;
                        const next = new Set(selectedRowIds);
                        if (next.has(row.rowId)) next.delete(row.rowId);
                        else next.add(row.rowId);
                        onSelectionChange(next);
                      }}
                    />
                  </td>
                ) : null}
                <td>
                  <div className="creator-cell">
                    <Avatar initials={row.initials} accent={row.accent} size="sm" />
                    <span><strong>{row.creatorName}</strong><small>{row.channelId}</small></span>
                  </div>
                </td>
                <td className="invoice-issuer-cell">{row.issuerName || '待补充'}</td>
                <td className="invoice-project-cell">{row.projectName}</td>
                <td className="mono-cell">
                  <button
                    className="invoice-number-link"
                    type="button"
                    aria-label={`查看 Invoice ${row.invoiceNumber}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(row);
                    }}
                  >
                    {row.invoiceNumber}
                  </button>
                </td>
                <td>
                  <span className={`invoice-type-badge is-${row.invoiceType.toLowerCase()}`}>
                    {row.invoiceType === 'EXTERNAL' ? '外部 Invoice' : '内部 Invoice'}
                  </span>
                </td>
                <td><PaymentProviderBadge compact provider={row.provider} /></td>
                <td>
                  <div className="invoice-status-cell">
                    <span className={`invoice-row-status is-${STATUS_CLASS[row.status]}`}>{row.status}</span>
                    {row.status === '已退回' && row.returnSourceLabel ? (
                      <small title={row.returnSourceLabel}>
                        <b>{row.returnSourceLabel}</b>
                      </small>
                    ) : null}
                  </div>
                </td>
                <td className="amount-cell">{formatAmount(row)}</td>
                <td className="action-cell">
                  <div className="table-action-group">
                    <ListActionButton
                      kind={actionKindFor(row)}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(row);
                      }}
                    >
                      {row.actionLabel}
                    </ListActionButton>
                    {row.additionalActionLabel && onAdditionalAction ? (
                      <ListActionButton
                        kind="execute"
                        className="invoice-quick-action"
                        aria-label={`${row.additionalActionLabel}：${row.invoiceNumber}`}
                        title={row.additionalActionLabel}
                        onClick={(event) => {
                          event.stopPropagation();
                          onAdditionalAction(row);
                        }}
                      >
                        {row.additionalActionLabel}
                      </ListActionButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={9 + (selectionEnabled ? 1 : 0)}><div className="empty-table">{emptyText}</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>共 {rows.length} 条</span>
        <Pagination
          ariaLabel="Invoice 列表分页"
          page={page}
          pageSize={pageSize}
          total={rows.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
