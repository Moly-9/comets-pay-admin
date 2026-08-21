import type { ReactNode } from 'react';
import { Avatar, Button } from './Common';
import { PaymentProviderBadge } from './PaymentProviderBadge';
import { Pagination, usePagination } from './Pagination';
import type { InvoiceManagementRow } from '../invoice/invoiceManagement';

const statusTone = (status: InvoiceManagementRow['status']) => {
  if (['已通过', '待发起请款', '已付款'].includes(status)) return 'success';
  if (['已退回', '待重新上传'].includes(status)) return 'danger';
  if (['待发布', '待上传', '待签署', '待审核', '待复核', '达人反馈'].includes(status)) return 'warning';
  return 'info';
};

const formatAmount = (row: InvoiceManagementRow) => (
  `${row.currency} ${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
);

export function InvoiceManagementTable({
  rows,
  onSelect,
  onAdditionalAction,
  additionalActionIcon,
  emptyText = '当前筛选条件下没有 Invoice 记录',
}: {
  rows: InvoiceManagementRow[];
  onSelect: (row: InvoiceManagementRow) => void;
  onAdditionalAction?: (row: InvoiceManagementRow) => void;
  additionalActionIcon?: ReactNode;
  emptyText?: string;
}) {
  const {
    page,
    pageItems,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination(rows, { resetKey: rows.map((row) => row.rowId).join('|') });

  return (
    <div className="table-shell invoice-management-table-shell">
      <div className="table-scroll">
        <table className="data-table invoice-management-table">
          <thead>
            <tr>
              <th>达人</th>
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
              <tr key={row.rowId} onClick={() => onSelect(row)}>
                <td>
                  <div className="creator-cell">
                    <Avatar initials={row.initials} accent={row.accent} size="sm" />
                    <span><strong>{row.creatorName}</strong><small>{row.channelId}</small></span>
                  </div>
                </td>
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
                <td><span className={`invoice-row-status is-${statusTone(row.status)}`}>{row.status}</span></td>
                <td className="amount-cell">{formatAmount(row)}</td>
                <td className="action-cell">
                  <div className="table-action-group">
                    <Button
                      variant={row.primaryAction ? 'primary' : 'secondary'}
                      className="table-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(row);
                      }}
                    >
                      {row.actionLabel}
                    </Button>
                    {row.additionalActionLabel && onAdditionalAction ? (
                      <Button
                        icon={additionalActionIcon}
                        className="table-action invoice-quick-action"
                        aria-label={`${row.additionalActionLabel}：${row.invoiceNumber}`}
                        title={row.additionalActionLabel}
                        onClick={(event) => {
                          event.stopPropagation();
                          onAdditionalAction(row);
                        }}
                      >
                        {row.additionalActionLabel}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={8}><div className="empty-table">{emptyText}</div></td></tr>
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
