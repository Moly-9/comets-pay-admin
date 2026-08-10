import { useEffect, useRef } from 'react';
import { formatAmount } from '../data';
import type { PaymentBatchRecord } from '../paymentBatches';
import {
  findTransactionBatchContext,
  transactionOccurredAt,
} from '../transactionRecords';
import type { Payout } from '../types';
import { Avatar, Button, StatusMark } from './Common';
import { Pagination, usePagination } from './Pagination';
import { PaymentProviderBadge } from './PaymentProviderBadge';

const displayTime = (value?: string) => {
  if (!value) return '未记录';
  return value.replace('T', ' ').replace(/\.000Z$/, '').replace(/Z$/, '');
};

export function TransactionRecordsTable({
  payouts,
  paymentBatches,
  selectedIds,
  onToggle,
  onToggleAll,
  onOpenDetail,
}: {
  payouts: Payout[];
  paymentBatches: readonly PaymentBatchRecord[];
  selectedIds: ReadonlySet<string>;
  onToggle: (payoutId: string, checked: boolean) => void;
  onToggleAll: (payoutIds: readonly string[], checked: boolean) => void;
  onOpenDetail: (payout: Payout) => void;
}) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const allIds = payouts.map((payout) => payout.id);
  const selectedVisibleCount = allIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = allIds.length > 0 && selectedVisibleCount === allIds.length;
  const partlySelected = selectedVisibleCount > 0 && !allSelected;
  const {
    page,
    pageItems,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination(payouts, { resetKey: allIds.join('|') });

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = partlySelected;
  }, [partlySelected]);

  return (
    <div className="table-shell transaction-table-shell">
      <div className="table-scroll">
        <table className="data-table transaction-records-table">
          <thead>
            <tr>
              <th className="transaction-select-cell">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label={allSelected ? '取消选择当前筛选的全部交易' : '选择当前筛选的全部交易'}
                  checked={allSelected}
                  disabled={!allIds.length}
                  onChange={(event) => onToggleAll(allIds, event.target.checked)}
                />
              </th>
              <th>达人 / 付款项目</th>
              <th>Invoice</th>
              <th>渠道</th>
              <th>状态</th>
              <th>金额</th>
              <th>时间</th>
              <th>付款人 / 付款时间</th>
              <th className="action-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length ? pageItems.map((payout) => {
              const context = findTransactionBatchContext(payout, paymentBatches);
              const invoiceNumber = context?.item.invoice?.invoiceNumber
                ?? context?.item.legacyInvoiceReference
                ?? payout.invoice;
              const payer = context?.batch.payer ?? '未记录';
              const payerTime = context?.batch.paidAt;
              return (
                <tr className={selectedIds.has(payout.id) ? 'is-selected' : ''} key={payout.id}>
                  <td className="transaction-select-cell">
                    <input
                      type="checkbox"
                      aria-label={`选择 ${payout.creator} 的交易`}
                      checked={selectedIds.has(payout.id)}
                      onChange={(event) => onToggle(payout.id, event.target.checked)}
                    />
                  </td>
                  <td>
                    <div className="creator-cell transaction-creator-cell">
                      <Avatar initials={payout.initials} accent={payout.accent} size="sm" />
                      <span><strong>{payout.creator}</strong><small>{payout.project}</small></span>
                    </div>
                  </td>
                  <td className="mono-cell">{invoiceNumber || '未记录'}</td>
                  <td><PaymentProviderBadge compact provider={payout.provider} /></td>
                  <td><StatusMark status={payout.status} /></td>
                  <td className="transaction-amount-cell">{formatAmount(payout)}</td>
                  <td className="transaction-time-cell">{displayTime(transactionOccurredAt(payout))}</td>
                  <td>
                    <span className="transaction-payer-cell">
                      <strong>{payer}</strong>
                      <small>{displayTime(payerTime)}</small>
                    </span>
                  </td>
                  <td className="action-cell">
                    <Button
                      variant="secondary"
                      className="table-action"
                      data-transaction-detail={payout.id}
                      onClick={() => onOpenDetail(payout)}
                    >
                      查看详情
                    </Button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={9}>
                  <div className="empty-table">暂无符合当前搜索与筛选条件的交易记录</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>共 {payouts.length} 条{selectedVisibleCount ? `，当前筛选已选 ${selectedVisibleCount} 条` : ''}</span>
        <Pagination
          ariaLabel="交易记录分页"
          page={page}
          pageSize={pageSize}
          total={payouts.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
