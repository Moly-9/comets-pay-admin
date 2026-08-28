import type { ReactNode } from 'react';
import { ListActionButton, StatusMark } from './Common';
import { CreatorIdentity } from './CreatorIdentity';
import { PaymentProviderBadge } from './PaymentProviderBadge';
import { Pagination, usePagination } from './Pagination';
import { formatAmount } from '../data';
import type { CreatorSocialAccount, InvoiceReviewStatus, Payout, PayoutStatus } from '../types';

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

const actionKindFor = (label: string | undefined, status: Payout['status']) => {
  if (status === '付款失败' || status === '信息异常' || status === '已退回') return 'danger' as const;
  if (label?.includes('执行') || label?.includes('提交')) return 'execute' as const;
  if (label?.includes('审核') || label?.includes('复核')) return 'review' as const;
  if (label?.includes('编辑') || label?.includes('处理') || label?.includes('修改')) return 'edit' as const;
  return 'view' as const;
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
    platform?: string;
    initials: string;
    accent: string;
    socialAccounts?: CreatorSocialAccount[];
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
                platform: payout.creatorPlatform,
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
                  <CreatorIdentity className="creator-cell" displayName={identity.displayName} initials={identity.initials} accent={identity.accent} accounts={identity.socialAccounts} fallbackHandle={identity.channelId} fallbackPlatform={identity.platform ?? payout.creatorPlatform} />
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
                    <ListActionButton
                      kind={actionKindFor(primaryActionLabel, payout.status)}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(payout);
                      }}
                    >
                      {primaryActionLabel}
                    </ListActionButton>
                    {showAdditionalAction ? (
                      <ListActionButton
                        kind={actionKindFor(additionalActionLabel, payout.status)}
                        className="invoice-quick-action"
                        aria-label={`${additionalActionLabel}：${invoiceNumber}`}
                        title={additionalActionLabel}
                        onClick={(event) => {
                          event.stopPropagation();
                          onAdditionalAction?.(payout);
                        }}
                      >
                        {additionalActionLabel}
                      </ListActionButton>
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
