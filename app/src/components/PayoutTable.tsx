import type { ReactNode } from 'react';
import { Avatar, Button, StatusMark } from './Common';
import { PaymentProviderBadge } from './PaymentProviderBadge';
import { Pagination, usePagination } from './Pagination';
import { formatAmount } from '../data';
import type { InvoiceReviewStatus, Payout, PayoutStatus } from '../types';

const ACTION_LABELS: Record<Payout['status'], string> = {
  未进入付款: '查看详情',
  等待付款: '执行打款',
  信息异常: '查看原因',
  飞书审批中: '查看',
  付款处理中: '查看进度',
  付款失败: '查看失败信息',
  已付款: '查看详情',
  已退回: '查看原因',
};

export function PayoutTable({
  payouts,
  onSelect,
  emptyText = '当前筛选条件下没有付款记录',
  statusLabels,
  statusFor,
  statusLabelFor,
  actionLabelFor,
  primaryActionFor,
  additionalActionFor,
  additionalActionLabelFor,
  additionalActionIcon,
  onAdditionalAction,
  identityFor,
  projectNameFor,
  invoiceNumberFor,
}: {
  payouts: Payout[];
  onSelect: (payout: Payout) => void;
  emptyText?: string;
  statusLabels?: Partial<Record<Payout['status'], string>>;
  statusFor?: (payout: Payout) => PayoutStatus | InvoiceReviewStatus;
  statusLabelFor?: (payout: Payout) => string;
  actionLabelFor?: (payout: Payout) => string;
  primaryActionFor?: (payout: Payout) => boolean;
  additionalActionFor?: (payout: Payout) => boolean;
  additionalActionLabelFor?: (payout: Payout) => string;
  additionalActionIcon?: ReactNode;
  onAdditionalAction?: (payout: Payout) => void;
  identityFor?: (payout: Payout) => {
    displayName: string;
    channelId: string;
    initials: string;
    accent: string;
  };
  projectNameFor?: (payout: Payout) => string;
  invoiceNumberFor?: (payout: Payout) => string;
}) {
  const {
    page,
    pageItems: visiblePayouts,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination(payouts, { resetKey: payouts.map((payout) => payout.id).join('|') });

  return (
    <div className="table-shell">
      <div className="table-scroll">
        <table className="data-table payout-table">
          <thead>
            <tr>
              <th>达人</th>
              <th>关联项目</th>
              <th>Invoice 编号</th>
              <th>付款渠道</th>
              <th>状态</th>
              <th className="amount-cell">金额</th>
              <th className="action-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            {visiblePayouts.length ? visiblePayouts.map((payout) => {
              const displayStatus = statusFor?.(payout) ?? payout.status;
              const identity = identityFor?.(payout) ?? {
                displayName: payout.creator,
                channelId: payout.handle,
                initials: payout.initials,
                accent: payout.accent,
              };
              const invoiceNumber = invoiceNumberFor?.(payout) ?? payout.invoice;
              const additionalActionLabel = additionalActionLabelFor?.(payout);
              const primaryActionLabel = actionLabelFor?.(payout) ?? ACTION_LABELS[payout.status];
              const showPrimaryAction = Boolean(primaryActionFor?.(payout));
              const showAdditionalAction = Boolean(
                onAdditionalAction
                && additionalActionLabel
                && additionalActionFor?.(payout),
              );
              return (
              <tr key={payout.id} onClick={() => onSelect(payout)}>
                <td>
                  <div className="creator-cell">
                    <Avatar initials={identity.initials} accent={identity.accent} size="sm" />
                    <span><strong>{identity.displayName}</strong><small>{identity.channelId}</small></span>
                  </div>
                </td>
                <td className="invoice-project-cell">{projectNameFor?.(payout) ?? payout.project}</td>
                <td className="mono-cell">
                  <button
                    className="invoice-number-link"
                    type="button"
                    aria-label={`查看 Invoice ${invoiceNumber}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(payout);
                    }}
                  >
                    {invoiceNumber}
                  </button>
                </td>
                <td><PaymentProviderBadge compact provider={payout.provider} /></td>
                <td><StatusMark status={displayStatus} label={statusLabelFor?.(payout) ?? statusLabels?.[payout.status]} /></td>
                <td className="amount-cell">{formatAmount(payout)}</td>
                <td className="action-cell">
                  <div className="table-action-group">
                    <Button
                      variant={showPrimaryAction ? 'primary' : 'secondary'}
                      className="table-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(payout);
                      }}
                    >
                      {primaryActionLabel}
                    </Button>
                    {showAdditionalAction ? (
                      <Button
                        icon={additionalActionIcon}
                        className="table-action invoice-quick-action"
                        aria-label={`${additionalActionLabel}：${invoiceNumber}`}
                        title={additionalActionLabel}
                        onClick={(event) => {
                          event.stopPropagation();
                          onAdditionalAction?.(payout);
                        }}
                      >
                        {additionalActionLabel}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
              );
            }) : (
              <tr>
                <td colSpan={7}>
                  <div className="empty-table">{emptyText}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>共 {payouts.length} 条</span>
        <Pagination
          ariaLabel="付款列表分页"
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
