import { useEffect, useRef } from 'react';
import { formatAmount } from '../data';
import {
  transactionRecordDetails,
  type TransactionRecord,
} from '../transactionRecords';
import {
  paymentCreatorIdentityFromBatchItem,
  paymentCreatorIdentityFromPayout,
} from '../paymentCreatorIdentity';
import { ListActionButton, StatusMark } from './Common';
import { PaymentCreatorIdentity } from './PaymentCreatorIdentity';
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

const displayMoney = (currency: string | undefined, amount: number | undefined, fallback = '—') => (
  currency && amount !== undefined
    ? `${currency} ${amount.toLocaleString('en-US', {
        minimumFractionDigits: amount === 0 ? 2 : 0,
        maximumFractionDigits: 2,
      })}`
    : fallback
);

export function TransactionRecordsTable({
  records,
  selectedKeys,
  onToggle,
  onToggleAll,
  onOpenDetail,
}: {
  records: TransactionRecord[];
  selectedKeys: ReadonlySet<string>;
  onToggle: (recordKey: string, checked: boolean) => void;
  onToggleAll: (recordKeys: readonly string[], checked: boolean) => void;
  onOpenDetail: (record: TransactionRecord) => void;
}) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const allKeys = records.map((record) => record.key);
  const selectedVisibleCount = allKeys.filter((key) => selectedKeys.has(key)).length;
  const allSelected = allKeys.length > 0 && selectedVisibleCount === allKeys.length;
  const partlySelected = selectedVisibleCount > 0 && !allSelected;
  const {
    page,
    pageItems,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination(records, { resetKey: allKeys.join('|') });

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
                  disabled={!allKeys.length}
                  onChange={(event) => onToggleAll(allKeys, event.target.checked)}
                />
              </th>
              <th>达人</th>
              <th>关联项目</th>
              <th>渠道</th>
              <th>支付金额</th>
              <th>手续费</th>
              <th>对方实际收到金额</th>
              <th>付款人 / 付款时间</th>
              <th>付款状态</th>
              <th className="action-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length ? pageItems.map((record) => {
              const { payout, context } = record;
              const details = transactionRecordDetails(payout, context);
              const payerTime = displayTimeParts(details.paymentTime);
              const creatorIdentity = context
                ? paymentCreatorIdentityFromBatchItem(context.item)
                : paymentCreatorIdentityFromPayout({ payout });
              return (
                <tr className={selectedKeys.has(record.key) ? 'is-selected' : ''} key={record.key}>
                  <td className="transaction-select-cell">
                    <input
                      type="checkbox"
                      aria-label={`选择 ${payout.creator} 的交易`}
                      checked={selectedKeys.has(record.key)}
                      onChange={(event) => onToggle(record.key, event.target.checked)}
                    />
                  </td>
                  <td>
                    <div className="transaction-creator-cell">
                      <PaymentCreatorIdentity {...creatorIdentity} />
                    </div>
                  </td>
                  <td>
                    <span className="transaction-data-cell transaction-project-cell">
                      <span className="transaction-primary-value" title={details.cooperationProjectName}>
                        {details.cooperationProjectName || payout.project || '未记录'}
                      </span>
                      <small>{details.cooperationProjectCode || payout.projectId || '项目编号未记录'}</small>
                    </span>
                  </td>
                  <td><PaymentProviderBadge compact provider={record.provider} /></td>
                  <td>
                    <span className="transaction-data-cell transaction-amount-cell">
                      <span className="transaction-primary-value">{formatAmount({ currency: record.paymentCurrency, amount: record.paymentAmount })}</span>
                      <small>收款 {details.receiveCurrency}</small>
                    </span>
                  </td>
                  <td>
                    <span className="transaction-data-cell transaction-money-cell">
                      <span className="transaction-primary-value">{displayMoney(
                        record.transferFeeCurrency,
                        record.transferFeeAmount,
                        record.status === '付款处理中' ? '待渠道回写' : '—',
                      )}</span>
                    </span>
                  </td>
                  <td>
                    <span className="transaction-data-cell transaction-money-cell transaction-received-cell">
                      <span className="transaction-primary-value">{displayMoney(
                        record.recipientReceivedCurrency,
                        record.recipientReceivedAmount,
                        record.status === '付款处理中' ? '待渠道回写' : '—',
                      )}</span>
                    </span>
                  </td>
                  <td>
                    <span className="transaction-data-cell transaction-payer-cell">
                      <span className="transaction-primary-value">{details.payer}</span>
                      <small>{payerTime.date} {payerTime.time}</small>
                    </span>
                  </td>
                  <td><StatusMark status={record.status} /></td>
                  <td className="action-cell">
                    <ListActionButton
                      kind="view"
                      data-transaction-detail={record.key}
                      onClick={() => onOpenDetail(record)}
                    >
                      查看详情
                    </ListActionButton>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={10}>
                  <div className="empty-table">暂无符合当前搜索与筛选条件的交易记录</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>共 {records.length} 条{selectedVisibleCount ? `，当前筛选已选 ${selectedVisibleCount} 条` : ''}</span>
        <Pagination
          ariaLabel="交易记录分页"
          page={page}
          pageSize={pageSize}
          total={records.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
