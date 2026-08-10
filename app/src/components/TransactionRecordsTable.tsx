import { Banknote, CalendarClock, Eye, ReceiptText, UserRoundCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatAmount } from '../data';
import type { PaymentBatchRecord } from '../paymentBatches';
import {
  findTransactionBatchContext,
  transactionRecordDetails,
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

const displayTimeParts = (value?: string) => {
  const normalized = displayTime(value);
  const [date, ...timeParts] = normalized.split(' ');
  return { date, time: timeParts.join(' ') || '时间未记录' };
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
              const details = transactionRecordDetails(payout, context);
              const invoiceNumber = details.invoice?.invoiceNumber ?? payout.invoice;
              const transactionTime = displayTimeParts(transactionOccurredAt(payout));
              const payerTime = displayTimeParts(details.paymentTime);
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
                  <td>
                    <span className="transaction-data-cell transaction-invoice-cell">
                      <span className="transaction-field-icon is-invoice" aria-hidden="true"><ReceiptText size={14} /></span>
                      <span>
                        <strong>{invoiceNumber || '未记录'}</strong>
                        <small>{details.paymentBatchCode}</small>
                      </span>
                    </span>
                  </td>
                  <td><PaymentProviderBadge compact provider={payout.provider} /></td>
                  <td><StatusMark status={payout.status} /></td>
                  <td>
                    <span className="transaction-data-cell transaction-amount-cell">
                      <span className="transaction-field-icon is-amount" aria-hidden="true"><Banknote size={14} /></span>
                      <span>
                        <strong>{formatAmount(payout)}</strong>
                        <small>收款 {details.receiveCurrency}</small>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="transaction-data-cell transaction-time-cell">
                      <span className="transaction-field-icon is-time" aria-hidden="true"><CalendarClock size={14} /></span>
                      <span>
                        <strong>{transactionTime.date}</strong>
                        <small>{transactionTime.time}</small>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="transaction-data-cell transaction-payer-cell">
                      <span className="transaction-field-icon is-payer" aria-hidden="true"><UserRoundCheck size={14} /></span>
                      <span>
                        <strong>{details.payer}</strong>
                        <small>{payerTime.date} {payerTime.time}</small>
                      </span>
                    </span>
                  </td>
                  <td className="action-cell">
                    <Button
                      variant="secondary"
                      className="table-action"
                      icon={<Eye size={14} />}
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
