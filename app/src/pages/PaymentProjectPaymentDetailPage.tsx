import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  CircleAlert,
  Coins,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Landmark,
  ListChecks,
  LoaderCircle,
  MessageSquareText,
  ReceiptText,
  RotateCcw,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, ListActionButton, SelectField, type SelectOption } from '../components/Common';
import { PaymentFailureReturnDialog } from '../components/PaymentFailureReturnDialog';
import { PaymentProgressSteps } from '../components/PaymentProgressSteps';
import { PaymentProviderBadge, PaymentProviderBadges } from '../components/PaymentProviderBadge';
import { PaymentCreatorIdentity } from '../components/PaymentCreatorIdentity';
import {
  paymentBatchAmountLabel,
  paymentBatchStatusCounts,
  type PaymentBatchItemSnapshot,
  type PaymentProjectPaymentRecord,
} from '../paymentBatches';
import type { ContractRecord } from '../contracts';
import { downloadBlob } from '../invoice/invoiceUtils';
import {
  createPaymentProjectContractArchive,
  createPaymentProjectConfirmationArchive,
  createPaymentProjectDetailWorkbook,
  createPaymentProjectInvoiceArchive,
  createPaymentProjectWorkbook,
  paymentProjectConfirmationArchiveFilename,
  paymentProjectDetailWorkbookFilename,
  paymentProjectWorkbookFilename,
  resolvePaymentProjectDocuments,
} from '../paymentProjectDocuments';
import { projectPdfArchiveFilename } from '../projectResourcePdfArchive';
import { paymentCreatorIdentityFromBatchItem } from '../paymentCreatorIdentity';
import type {
  CreatorProfile,
  GeneratedInvoiceRecord,
  PaymentAttemptSnapshot,
  PaymentFailureIssueType,
  Payout,
} from '../types';
import './PaymentProjectPaymentDetailPage.css';

const displayTime = (value?: string) => value
  ? value.replace('T', ' ').replace(/\.\d{3}Z$/, '')
  : '未记录';

const money = (currency: string, amount: number) => `${currency} ${amount.toLocaleString('en-US')}`;

const paymentStatusTone = (status: string) => {
  if (/失败|异常|退回/.test(status)) return 'is-danger';
  if (/处理中|等待|审批/.test(status)) return 'is-processing';
  if (status === '已付款') return 'is-success';
  return 'is-neutral';
};

const projectStatusTone = (status: PaymentProjectPaymentRecord['status']) => {
  if (status === '部分失败' || status === '全部失败' || status === '已退回') return 'is-danger';
  if (status === '付款处理中') return 'is-processing';
  return 'is-success';
};

const paymentResultPlaceholder = (status: Payout['status']) => (
  status === '付款处理中' ? '待渠道回写' : '—'
);

const paymentResultMoney = ({
  status,
  amount,
  currency,
}: {
  status: Payout['status'];
  amount?: number;
  currency?: string;
}) => (
  status === '已付款' && amount !== undefined && currency
    ? money(currency, amount)
    : paymentResultPlaceholder(status)
);

const paymentResultDate = (status: Payout['status'], paidAt?: string) => {
  if (status !== '已付款') return paymentResultPlaceholder(status);
  if (!paidAt) return '—';
  return paidAt.replace('T', ' ').split(' ')[0] || '—';
};

const paymentAttemptMoney = (amount?: number, currency?: string) => (
  amount !== undefined && currency ? money(currency, amount) : '待补充'
);

const paymentAttemptsForDrawer = (
  item: PaymentBatchItemSnapshot,
  payout?: Payout,
): readonly PaymentAttemptSnapshot[] => {
  const storedAttempts = payout?.paymentAttempts?.length
    ? payout.paymentAttempts
    : item.paymentAttempts;
  if (storedAttempts?.length) {
    return [...storedAttempts].sort((left, right) => left.attemptNumber - right.attemptNumber);
  }

  const currentAttemptNumber = Math.max(
    1,
    payout?.currentPaymentAttempt?.attemptNumber ?? item.paymentAttemptNumber ?? 1,
  );
  const previousFailure = payout?.paymentFailureRecovery?.previousFailure;
  const fallbackAttempts: PaymentAttemptSnapshot[] = [];
  if (currentAttemptNumber > 1 && previousFailure) {
    fallbackAttempts.push({
      attemptNumber: currentAttemptNumber - 1,
      status: '付款失败',
      occurredAt: previousFailure.occurredAt,
      principalAmount: item.amount,
      principalCurrency: item.currency,
      errorCode: previousFailure.errorCode,
      providerResponse: previousFailure.providerResponse,
      returnReason: payout?.paymentFailureRecovery?.returnReason,
    });
  }
  if (item.paymentStatus === '已付款' || item.paymentStatus === '付款失败') {
    fallbackAttempts.push({
      paymentBatchId: payout?.currentPaymentAttempt?.paymentBatchId,
      paymentBatchCode: payout?.currentPaymentAttempt?.paymentBatchCode,
      attemptNumber: currentAttemptNumber,
      status: item.paymentStatus,
      occurredAt: item.paymentStatus === '已付款' ? item.paidAt : item.failure?.occurredAt,
      principalAmount: item.amount,
      principalCurrency: item.currency,
      transferFeeAmount: item.transferFeeAmount,
      transferFeeCurrency: item.transferFeeCurrency,
      actualPaidAmount: item.actualPaidAmount,
      actualPaidCurrency: item.actualPaidCurrency,
      errorCode: item.failure?.code,
      providerResponse: item.failure?.response,
      returnReason: payout?.paymentFailureRecovery?.returnReason ?? payout?.returnReason,
    });
  }
  return fallbackAttempts;
};

const paymentAttemptAggregate = (
  attempts: readonly PaymentAttemptSnapshot[],
  amountKey: 'actualPaidAmount' | 'transferFeeAmount',
  currencyKey: 'actualPaidCurrency' | 'transferFeeCurrency',
  status: Payout['status'],
) => {
  if (!attempts.length) return [status === '付款处理中' ? '待渠道回写' : '待补充'];
  if (attempts.some((attempt) => attempt[amountKey] === undefined || !attempt[currencyKey])) {
    return ['待补充'];
  }
  const totals = attempts.reduce<Map<string, number>>((result, attempt) => {
    const currency = attempt[currencyKey]!;
    result.set(currency, (result.get(currency) ?? 0) + attempt[amountKey]!);
    return result;
  }, new Map());
  return [...totals.entries()].map(([currency, amount]) => money(currency, amount));
};

type ProjectDownloadAction = 'contract' | 'invoice' | 'payment-list' | 'payment-detail' | 'confirmation-all' | 'confirmation-selected';

const hasPaymentDate = (value?: string) => /^(\d{4})-(\d{2})-(\d{2})/.test(value ?? '');

function PaymentProjectInfoCard({
  className = '',
  icon,
  label,
  value,
}: {
  className?: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className={className}>
      <dt><span className="payment-project-info-icon" aria-hidden="true">{icon}</span>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function PaymentProjectItemDrawer({
  canHandleFailure,
  creator,
  item,
  onClose,
  onOpenFailurePaymentList,
  onRequestFailureReturn,
  payout,
}: {
  canHandleFailure: boolean;
  creator?: CreatorProfile;
  item: PaymentBatchItemSnapshot;
  onClose: () => void;
  onOpenFailurePaymentList?: () => void;
  onRequestFailureReturn?: () => void;
  payout?: Payout;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const creatorIdentity = paymentCreatorIdentityFromBatchItem(item, creator);
  const accountName = creatorIdentity.accountName;
  const accountIdentifier = item.accountIdentifier || item.accountSummary || '待补充';
  const failureReturn = payout?.paymentFailureReturn;
  const failure = item.failure;
  const failureRecovery = payout?.paymentFailureRecovery;
  const paymentAttempts = paymentAttemptsForDrawer(item, payout);
  const isSecondaryPayment = paymentAttempts.length > 1 || (failureRecovery
    ? ['RETRY_SUBMITTED', 'RETRY_SUCCEEDED'].includes(failureRecovery.status)
    : false);
  const cumulativePaidAmounts = paymentAttemptAggregate(
    paymentAttempts,
    'actualPaidAmount',
    'actualPaidCurrency',
    item.paymentStatus,
  );
  const cumulativeFeeAmounts = paymentAttemptAggregate(
    paymentAttempts,
    'transferFeeAmount',
    'transferFeeCurrency',
    item.paymentStatus,
  );
  const canReturnFailure = item.paymentStatus === '付款失败' && !failureReturn && Boolean(onRequestFailureReturn);
  const titleId = `payment-project-item-drawer-${item.payoutId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled):not([aria-disabled="true"]), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => !element.hasAttribute('hidden'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="payment-project-item-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        className="payment-project-item-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="payment-project-item-drawer-header">
          <div>
            <span>付款明细</span>
            <h2 id={titleId}>{accountName}</h2>
          </div>
          <div className="payment-project-item-drawer-header-actions">
            {isSecondaryPayment ? <span className="payment-project-retry-badge">二次付款</span> : null}
            <span className={`simple-status ${paymentStatusTone(item.paymentStatus)}`}><i />{item.paymentStatus}</span>
            <button ref={closeButtonRef} className="icon-button" type="button" aria-label="关闭付款明细" onClick={onClose}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="payment-project-item-drawer-content">
          <section className="payment-project-recipient-card" aria-labelledby={`${titleId}-recipient`}>
            <div className="payment-project-recipient-identity">
              <span id={`${titleId}-recipient`}>收款人</span>
              <PaymentCreatorIdentity size="lg" {...creatorIdentity} />
            </div>
            <PaymentProviderBadge compact provider={item.provider} />
            <dl>
              <div><dt>{item.accountIdentifierLabel || '收款账户'}</dt><dd>{accountIdentifier}</dd></div>
              <div><dt>收款国家 / 地区</dt><dd>{item.recipientCountry || '待补充'}</dd></div>
              <div><dt>收款币种</dt><dd>{item.receiveCurrency || '待补充'}</dd></div>
              <div><dt>账户版本</dt><dd>{item.payoutAccountVersion}</dd></div>
              <div>
                <dt>累计支付总金额</dt>
                <dd className="payment-project-amount-stack">{cumulativePaidAmounts.map((amount) => <span key={amount}>{amount}</span>)}</dd>
              </div>
              <div>
                <dt>累计手续费</dt>
                <dd className="payment-project-amount-stack">{cumulativeFeeAmounts.map((amount) => <span key={amount}>{amount}</span>)}</dd>
              </div>
            </dl>
          </section>

          <section className="payment-project-item-drawer-section" aria-labelledby={`${titleId}-result`}>
            <h3 id={`${titleId}-result`}><CircleAlert size={17} aria-hidden="true" />渠道结果</h3>
            <dl className="payment-project-item-drawer-grid">
              <div><dt>付款状态</dt><dd>{item.paymentStatus}</dd></div>
              <div><dt>渠道回写时间</dt><dd>{failure?.occurredAt ? displayTime(failure.occurredAt) : displayTime(item.paidAt)}</dd></div>
              {failure ? (
                <>
                  <div><dt>错误码</dt><dd>{failure.code}</dd></div>
                  <div className="is-full"><dt>渠道响应</dt><dd>{failure.response}</dd></div>
                </>
              ) : null}
            </dl>
            {isSecondaryPayment && paymentAttempts.length > 1 ? (
              <div className="payment-project-attempt-history" role="list" aria-label="多次付款记录">
                {paymentAttempts.map((attempt) => (
                  <article
                    className={`payment-project-attempt-card is-${attempt.status === '付款失败' ? 'failed' : 'succeeded'}`}
                    key={`${attempt.paymentBatchId ?? attempt.attemptNumber}-${attempt.status}`}
                    role="listitem"
                  >
                    <header>
                      <div>
                        <strong>{attempt.attemptNumber === 1 ? '首次付款' : attempt.attemptNumber === 2 ? '二次付款' : `第 ${attempt.attemptNumber} 次付款`}</strong>
                        <span>{attempt.status === '付款失败' ? '渠道付款失败' : '渠道付款成功'}</span>
                      </div>
                      <span className={`simple-status ${paymentStatusTone(attempt.status)}`}><i />{attempt.status}</span>
                    </header>
                    <dl>
                      <div><dt>所属批次</dt><dd>{attempt.paymentBatchCode || '未记录'}</dd></div>
                      <div><dt>付款时间</dt><dd>{displayTime(attempt.occurredAt)}</dd></div>
                      <div><dt>支付金额</dt><dd>{paymentAttemptMoney(attempt.principalAmount, attempt.principalCurrency)}</dd></div>
                      <div><dt>手续费</dt><dd>{paymentAttemptMoney(attempt.transferFeeAmount, attempt.transferFeeCurrency)}</dd></div>
                      <div className="is-full"><dt>支付总金额</dt><dd>{paymentAttemptMoney(attempt.actualPaidAmount, attempt.actualPaidCurrency)}</dd></div>
                      {attempt.status === '付款失败' ? (
                        <>
                          <div><dt>错误码</dt><dd>{attempt.errorCode || '未记录'}</dd></div>
                          <div className="is-full"><dt>失败原因</dt><dd>{attempt.providerResponse || '未记录'}</dd></div>
                          <div className="is-full"><dt>业务退回原因</dt><dd>{attempt.returnReason || '未记录'}</dd></div>
                        </>
                      ) : null}
                    </dl>
                  </article>
                ))}
              </div>
            ) : null}
            {failureReturn ? (
              <div className="payment-project-item-return-card" role="status">
                <AlertTriangle size={17} aria-hidden="true" />
                <div>
                  <strong>{failureReturn.issueType === 'INVOICE_CONTENT' ? 'Invoice 内容问题' : '付款账户问题'}</strong>
                  <span>退回原因：{failureReturn.reason}</span>
                  <small>{failureReturn.actorName} · {displayTime(failureReturn.occurredAt)}</small>
                </div>
              </div>
            ) : null}
          </section>

          <section className="payment-project-item-drawer-section" aria-labelledby={`${titleId}-payment`}>
            <h3 id={`${titleId}-payment`}><WalletCards size={17} aria-hidden="true" />付款信息</h3>
            <dl className="payment-project-item-drawer-grid">
              <div><dt>付款清单编号</dt><dd>{item.paymentListCode}{item.paymentListVersion ? ` · V${item.paymentListVersion}` : ''}</dd></div>
              <div><dt>付款渠道</dt><dd>{item.provider}</dd></div>
              <div><dt>付款方式</dt><dd>{item.transferMethod || '待补充'}</dd></div>
              <div><dt>本地清算方式</dt><dd>{item.localClearingSystem || '待补充'}</dd></div>
              <div><dt>付款金额</dt><dd>{money(item.currency, item.amount)}</dd></div>
              <div><dt>手续费承担方</dt><dd>{item.feeBearer || '未记录'}</dd></div>
              <div><dt>付款日期</dt><dd>{paymentResultDate(item.paymentStatus, item.paidAt)}</dd></div>
              <div className="is-full"><dt>付款原因</dt><dd>{item.paymentReason || '未记录'}</dd></div>
              <div className="is-full"><dt>交易附言</dt><dd>{item.transactionReference || '未记录'}</dd></div>
              <div className="is-full"><dt>付款描述</dt><dd>{item.description || '未记录'}</dd></div>
            </dl>
          </section>
        </div>

        <footer className="payment-project-item-drawer-footer">
          <Button variant="secondary" onClick={onClose}>关闭</Button>
          {failureReturn && onOpenFailurePaymentList ? (
            <Button icon={<ListChecks size={16} />} onClick={onOpenFailurePaymentList}>查看付款清单</Button>
          ) : null}
          {canReturnFailure ? (
            <Button
              variant="danger"
              icon={<RotateCcw size={16} />}
              disabled={!canHandleFailure}
              disabledReason="当前账号或付款状态不允许退回媒介处理。"
              onClick={onRequestFailureReturn}
            >
              退回媒介处理
            </Button>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}

export function PaymentProjectPaymentDetailPage({
  record,
  payouts,
  contracts = [],
  invoices = [],
  creators = [],
  canHandleFailure,
  onBack,
  onReturnPayout,
  onOpenFailurePaymentList,
  notify,
}: {
  record: PaymentProjectPaymentRecord;
  payouts: readonly Payout[];
  contracts?: readonly ContractRecord[];
  invoices?: readonly GeneratedInvoiceRecord[];
  creators?: readonly CreatorProfile[];
  canHandleFailure: boolean;
  onBack: () => void;
  onReturnPayout: (payout: Payout, issueType: PaymentFailureIssueType, reason: string) => boolean;
  onOpenFailurePaymentList?: (requestId: string, payoutId: string) => void;
  notify?: (title: string, message: string) => void;
}) {
  const [selectedDetailItemId, setSelectedDetailItemId] = useState<string | null>(null);
  const [failureDialogPayoutId, setFailureDialogPayoutId] = useState<string | null>(null);
  const [downloadingResource, setDownloadingResource] = useState<ProjectDownloadAction | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set());
  const [resourceError, setResourceError] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const liveItems = useMemo(() => record.items.map((item) => {
    const payout = payouts.find((candidate) => candidate.id === item.payoutId);
    if (!payout) return item;
    const succeeded = payout.status === '已付款';
    return {
      ...item,
      paymentStatus: payout.status,
      paidAt: payout.paidAt ?? item.paidAt,
      transferFeeAmount: succeeded ? payout.transferFeeAmount ?? item.transferFeeAmount : undefined,
      transferFeeCurrency: succeeded ? payout.transferFeeCurrency ?? item.transferFeeCurrency : undefined,
      actualPaidAmount: succeeded ? payout.actualPaidAmount ?? item.actualPaidAmount : undefined,
      actualPaidCurrency: succeeded ? payout.actualPaidCurrency ?? item.actualPaidCurrency : undefined,
      postTransactionBalance: succeeded ? payout.postTransactionBalance ?? item.postTransactionBalance : undefined,
      postTransactionBalanceCurrency: succeeded
        ? payout.postTransactionBalanceCurrency ?? item.postTransactionBalanceCurrency
        : undefined,
      paymentAttempts: payout.paymentAttempts ?? item.paymentAttempts,
      localClearingSystem: payout.localClearingSystem ?? item.localClearingSystem,
      recipientCountry: payout.recipientCountry ?? item.recipientCountry,
      failure: payout.paymentFailure ? {
        code: payout.paymentFailure.errorCode,
        response: payout.paymentFailure.providerResponse,
        occurredAt: payout.paymentFailure.occurredAt,
      } : item.failure,
    };
  }), [payouts, record.items]);
  const totals = paymentBatchAmountLabel(record);
  const statusCounts = paymentBatchStatusCounts({ items: liveItems });
  const failedItems = useMemo(
    () => liveItems.filter((item) => item.paymentStatus === '付款失败'),
    [liveItems],
  );
  const dialogItem = liveItems.find((item) => item.payoutId === failureDialogPayoutId);
  const selectedDetailItem = liveItems.find((item) => item.payoutId === selectedDetailItemId);
  const selectedDetailPayout = selectedDetailItem
    ? payouts.find((payout) => payout.id === selectedDetailItem.payoutId)
    : undefined;
  const selectedDetailCreator = selectedDetailItem
    ? creators.find((creator) => creator.id === selectedDetailItem.creatorId)
    : undefined;
  const confirmationEligibleItems = useMemo(() => liveItems.filter((item) => (
    item.paymentStatus === '已付款' && hasPaymentDate(item.paidAt)
  )), [liveItems]);
  const confirmationEligibleIds = useMemo(
    () => new Set(confirmationEligibleItems.map((item) => item.payoutId)),
    [confirmationEligibleItems],
  );
  const selectedConfirmationItems = useMemo(
    () => confirmationEligibleItems.filter((item) => selectedItemIds.has(item.payoutId)),
    [confirmationEligibleItems, selectedItemIds],
  );
  const allEligibleSelected = confirmationEligibleItems.length > 0
    && selectedConfirmationItems.length === confirmationEligibleItems.length;
  const projectDocuments = useMemo(() => resolvePaymentProjectDocuments({
    items: liveItems,
    contracts,
    invoices,
  }), [contracts, invoices, liveItems]);

  const downloadProjectResource = async (kind: ProjectDownloadAction) => {
    if (!liveItems.length || downloadingResource) return;
    setDownloadingResource(kind);
    setResourceError('');
    try {
      if (kind === 'contract') {
        downloadBlob(
          await createPaymentProjectContractArchive({ items: liveItems, contracts }),
          projectPdfArchiveFilename(record.request.requestCode, 'contract'),
        );
      } else if (kind === 'invoice') {
        downloadBlob(
          await createPaymentProjectInvoiceArchive({ items: liveItems, invoices }),
          projectPdfArchiveFilename(record.request.requestCode, 'invoice'),
        );
      } else if (kind === 'payment-list') {
        downloadBlob(
          await createPaymentProjectWorkbook({ request: record.request, items: liveItems }),
          paymentProjectWorkbookFilename(record.request.requestCode),
        );
      } else if (kind === 'payment-detail') {
        downloadBlob(
          await createPaymentProjectDetailWorkbook({ request: record.request, items: liveItems }),
          paymentProjectDetailWorkbookFilename(record.request.requestCode),
        );
      } else {
        const confirmationItems = kind === 'confirmation-selected'
          ? selectedConfirmationItems
          : confirmationEligibleItems;
        downloadBlob(
          await createPaymentProjectConfirmationArchive({ items: confirmationItems }),
          paymentProjectConfirmationArchiveFilename(record.request.requestCode),
        );
      }
      const successCopy: Record<ProjectDownloadAction, string> = {
        contract: '合同压缩包已生成。',
        invoice: 'Invoice 压缩包已生成。',
        'payment-list': '付款清单已导出。',
        'payment-detail': '付款明细已导出。',
        'confirmation-all': `已生成 ${confirmationEligibleItems.length} 份付款确认函。`,
        'confirmation-selected': `已生成 ${selectedConfirmationItems.length} 份所选付款确认函。`,
      };
      notify?.('下载已开始', successCopy[kind]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '项目资料下载失败，请稍后重试。';
      setResourceError(message);
      notify?.('下载失败', message);
    } finally {
      setDownloadingResource(null);
    }
  };

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!selectedDetailItemId || liveItems.some((item) => item.payoutId === selectedDetailItemId)) return;
    setSelectedDetailItemId(null);
  }, [liveItems, selectedDetailItemId]);

  useEffect(() => {
    setSelectedItemIds((current) => {
      const next = new Set([...current].filter((id) => confirmationEligibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [confirmationEligibleIds]);

  useEffect(() => {
    const indeterminate = selectedConfirmationItems.length > 0 && !allEligibleSelected;
    if (selectAllRef.current) selectAllRef.current.indeterminate = indeterminate;
  }, [allEligibleSelected, selectedConfirmationItems.length]);

  const openFailureDialog = (payoutId: string) => {
    setFailureDialogPayoutId(payoutId);
  };

  const closeFailureDialog = () => {
    setFailureDialogPayoutId(null);
  };

  const openDetailDrawer = (payoutId: string, trigger?: HTMLButtonElement | null) => {
    detailTriggerRef.current = trigger ?? null;
    setSelectedDetailItemId(payoutId);
  };

  const closeDetailDrawer = useCallback(() => {
    setSelectedDetailItemId(null);
    const trigger = detailTriggerRef.current;
    detailTriggerRef.current = null;
    window.requestAnimationFrame(() => trigger?.focus());
  }, []);

  const revealFirstFailure = (trigger?: HTMLButtonElement | null) => {
    const first = failedItems[0];
    if (!first) return;
    openDetailDrawer(first.payoutId, trigger);
  };

  const toggleConfirmationItem = (payoutId: string) => {
    if (!confirmationEligibleIds.has(payoutId)) return;
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(payoutId)) next.delete(payoutId);
      else next.add(payoutId);
      return next;
    });
  };

  const toggleAllConfirmationItems = () => {
    setSelectedItemIds(allEligibleSelected
      ? new Set()
      : new Set(confirmationEligibleItems.map((item) => item.payoutId)));
  };

  const resourceDownloadOptions: readonly SelectOption<ProjectDownloadAction>[] = [
    {
      value: 'contract',
      label: '下载合同',
      leading: <FileText size={16} />,
      disabled: !projectDocuments.contracts.length,
      title: !projectDocuments.contracts.length ? '当前没有可下载的合同。' : undefined,
    },
    {
      value: 'invoice',
      label: '下载 Invoice',
      leading: <ReceiptText size={16} />,
      disabled: !projectDocuments.invoices.length,
      title: !projectDocuments.invoices.length ? '当前没有可下载的 Invoice。' : undefined,
    },
    {
      value: 'payment-list',
      label: '下载付款清单',
      leading: <FileSpreadsheet size={16} />,
      disabled: !liveItems.length,
      title: !liveItems.length ? '当前没有可下载的付款清单。' : undefined,
    },
  ];

  const confirmationDownloadOptions: readonly SelectOption<ProjectDownloadAction>[] = [
    {
      value: 'confirmation-all',
      label: '导出所有',
      leading: <FileArchive size={16} />,
      disabled: !confirmationEligibleItems.length,
      title: !confirmationEligibleItems.length ? '没有具备实际付款日期的已付款明细。' : undefined,
    },
    {
      value: 'confirmation-selected',
      label: '导出所选',
      leading: <FileArchive size={16} />,
      disabled: !selectedConfirmationItems.length,
      title: !selectedConfirmationItems.length ? '请先勾选已付款明细。' : undefined,
    },
  ];

  return (
    <div className="page-stack payment-batch-detail-page payment-project-payment-detail-page">
      <button className="project-back-button payment-batch-detail-back" type="button" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true" />
        返回付款工作台
      </button>

      <header className="payment-batch-detail-header">
        <div>
          <span>付款项目</span>
          <h1 ref={titleRef} tabIndex={-1}>{record.request.requestCode}</h1>
          <p>{record.request.cooperationProjectCode} · {record.request.cooperationProjectName}</p>
        </div>
        <div className="payment-batch-detail-total">
          <span className={`simple-status ${projectStatusTone(record.status)}`}><i />{record.status}</span>
          <strong>{totals}</strong>
          <small>{record.items.length} 笔付款明细</small>
        </div>
      </header>

      <section className="payment-batch-detail-summary payment-project-summary-grid" aria-label="项目付款摘要">
        <div className="payment-project-summary-card is-order">
          <div>
            <span>付款单</span>
            <strong title={record.paymentOrderCodes.join('、') || '未关联'}>{record.paymentOrderCodes.join('、') || '未关联'}</strong>
            <small>{record.paymentOrderCodes.length} 份付款清单</small>
          </div>
        </div>
        <div className="payment-project-summary-card is-provider">
          <div>
            <span>付款渠道</span>
            <PaymentProviderBadges className="payment-project-summary-provider" compact providers={record.providers} />
            <small>{record.providers.length} 个执行渠道</small>
          </div>
        </div>
        <div className="payment-project-summary-card is-result">
          <div>
            <span>处理结果</span>
            <strong>{statusCounts.succeeded} 成功 · {statusCounts.failed} 失败</strong>
            <small>{statusCounts.processing} 笔处理中</small>
          </div>
        </div>
        <div className="payment-project-summary-card is-updated">
          <div>
            <span>最近更新</span>
            <strong title={displayTime(record.lastActivityAt)}>{displayTime(record.lastActivityAt)}</strong>
            <small>以渠道回写时间为准</small>
          </div>
        </div>
      </section>

      {failedItems.length ? (
        <section className="payment-project-failure-overview" role="status" aria-live="polite">
          <span aria-hidden="true"><AlertTriangle size={19} /></span>
          <div>
            <strong>{failedItems.length} 笔付款失败需要处理</strong>
            <p>请打开失败明细核对渠道结果，并逐笔退回媒介修正对应资料。</p>
          </div>
          <Button
            variant="danger"
            icon={<CircleAlert size={16} />}
            onClick={(event) => revealFirstFailure(event.currentTarget)}
          >
            查看失败明细
          </Button>
        </section>
      ) : null}

      <section className="payment-batch-detail-section payment-batch-lifecycle-section">
        <header>
          <div>
            <h2>项目付款进度</h2>
            <p>当前请款项目全部付款明细的渠道处理结果。</p>
          </div>
        </header>
        <PaymentProgressSteps ariaLabel="项目付款进度" status={record.status} />
      </section>

      <section className="payment-batch-detail-section">
        <header>
          <div>
            <h2 className="payment-project-section-heading"><span aria-hidden="true"><Building2 size={18} /></span>付款项目信息</h2>
            <p>本页面仅展示当前付款项目，不混入同批次的其他项目。</p>
          </div>
          <span className={`simple-status ${projectStatusTone(record.status)}`}><i />{record.status}</span>
        </header>
        <div className="payment-batch-project-heading">
          <span aria-hidden="true"><Building2 size={20} /></span>
          <div><span className="payment-batch-project-name">{record.request.cooperationProjectName}</span><small>{record.request.cooperationProjectCode}</small></div>
        </div>
        <dl className="payment-batch-project-grid payment-project-info-cards">
          <PaymentProjectInfoCard icon={<ReceiptText size={16} />} label="付款编号" value={record.request.requestCode} />
          <PaymentProjectInfoCard icon={<Coins size={16} />} label="付款金额" value={record.request.amount} />
          <PaymentProjectInfoCard icon={<Building2 size={16} />} label="品牌 / 客户" value={record.request.brand} />
          <PaymentProjectInfoCard icon={<UserRound size={16} />} label="项目媒介" value={record.request.media} />
          <PaymentProjectInfoCard icon={<UserRound size={16} />} label="负责 PM" value={record.request.pm} />
          <PaymentProjectInfoCard icon={<Landmark size={16} />} label="付款主体" value={record.request.paymentEntity || '待补充'} />
          <PaymentProjectInfoCard icon={<Building2 size={16} />} label="项目费用归属" value={record.request.projectCostAttribution || '待补充'} />
          <PaymentProjectInfoCard icon={<CalendarClock size={16} />} label="预计付款时间" value={record.request.expectedPaymentDate} />
          <PaymentProjectInfoCard icon={<ListChecks size={16} />} label="成本类型" value={record.request.costType || '待补充'} />
          <PaymentProjectInfoCard
            icon={<FileText size={16} />}
            label="成本类型明细"
            value={record.request.costType === '采购成本' ? record.request.costTypeDetail || '待补充' : '—'}
          />
          <PaymentProjectInfoCard
            className="payment-batch-project-full"
            icon={<MessageSquareText size={16} />}
            label="付款事由"
            value={record.request.reason}
          />
        </dl>
      </section>

      <section className="payment-batch-detail-section payment-batch-items-section">
        <header>
          <div>
            <h2 className="payment-project-section-heading"><span aria-hidden="true"><ListChecks size={18} /></span>付款明细</h2>
            <p>核对当前项目每笔付款的账户快照、付款结果与失败原因。</p>
          </div>
          <div className="payment-project-resource-toolbar">
            <div className="payment-project-resource-actions" aria-label="下载付款项目资料">
              <SelectField
                ariaLabel="下载付款资料"
                className="payment-project-download-select is-resource-download"
                value="payment-detail"
                options={resourceDownloadOptions}
                selectedLabel={downloadingResource && ['contract', 'invoice', 'payment-list'].includes(downloadingResource) ? '资料生成中…' : '下载付款资料'}
                leadingIcon={downloadingResource && ['contract', 'invoice', 'payment-list'].includes(downloadingResource)
                  ? <LoaderCircle className="is-spinning" size={15} />
                  : <Download size={15} />}
                variant="compact"
                menuStrategy="fixed"
                disabled={downloadingResource !== null}
                onChange={(kind) => { void downloadProjectResource(kind); }}
              />
              <Button
                variant="secondary"
                className="payment-project-download-button is-detail-download"
                icon={downloadingResource === 'payment-detail' ? <LoaderCircle className="is-spinning" size={15} /> : <FileSpreadsheet size={15} />}
                disabled={!liveItems.length || downloadingResource !== null}
                disabledReason={downloadingResource ? '文件正在导出，请稍候。' : '当前没有可导出的付款明细。'}
                onClick={() => { void downloadProjectResource('payment-detail'); }}
              >
                {downloadingResource === 'payment-detail' ? '正在生成' : '下载付款明细'}
              </Button>
              <SelectField
                ariaLabel="下载付款确认函"
                className="payment-project-download-select is-confirmation-download"
                value="payment-detail"
                options={confirmationDownloadOptions}
                selectedLabel={downloadingResource?.startsWith('confirmation') ? '确认函生成中…' : '下载确认函'}
                leadingIcon={downloadingResource?.startsWith('confirmation')
                  ? <LoaderCircle className="is-spinning" size={15} />
                  : <FileArchive size={15} />}
                variant="compact"
                menuStrategy="fixed"
                disabled={downloadingResource !== null}
                onChange={(kind) => { void downloadProjectResource(kind); }}
              />
            </div>
            <div className="payment-project-resource-meta">
              <span>{liveItems.length} 笔 · 已选 {selectedConfirmationItems.length} 笔</span>
            </div>
          </div>
        </header>
        {resourceError ? <p className="payment-project-resource-error" role="alert">{resourceError}</p> : null}
        <div className="table-shell payment-project-detail-table-shell">
          <div
            className="table-scroll payment-project-detail-table-scroll"
            role="region"
            aria-label="付款明细表，可横向滚动查看更多列"
            tabIndex={0}
          >
            <table className="data-table payment-project-detail-table">
              <thead>
                <tr>
                  <th className="payment-project-detail-select-cell">
                    <label className="payment-project-detail-select-control">
                      <span className="sr-only">选择全部可导出确认函的付款明细</span>
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        aria-label="选择全部可导出确认函的付款明细"
                        checked={allEligibleSelected}
                        disabled={!confirmationEligibleItems.length}
                        title={confirmationEligibleItems.length ? '选择全部可导出确认函的付款明细' : '没有可导出确认函的付款明细'}
                        onChange={toggleAllConfirmationItems}
                      />
                    </label>
                  </th>
                  <th className="payment-project-detail-creator-heading">达人名称</th>
                  <th className="payment-project-detail-provider-heading">付款渠道</th>
                  <th className="payment-project-detail-account-heading">收款银行账号</th>
                  <th className="payment-project-detail-date-heading">付款日期</th>
                  <th className="payment-project-detail-money-heading">付款金额</th>
                  <th className="payment-project-detail-money-heading">支付总金额</th>
                  <th className="payment-project-detail-money-heading">手续费金额</th>
                  <th className="payment-project-detail-status-cell">付款状态</th>
                  <th className="action-cell payment-project-detail-action-cell">操作</th>
                </tr>
              </thead>
              <tbody>
                {liveItems.length ? liveItems.map((item) => {
                  const currentStatus = item.paymentStatus;
                  const creator = creators.find((candidate) => candidate.id === item.creatorId);
                  const creatorIdentity = paymentCreatorIdentityFromBatchItem(item, creator);
                  const accountName = creatorIdentity.accountName;
                  const accountIdentifier = item.accountIdentifier || item.accountSummary || '待补充';
                  const canSelect = confirmationEligibleIds.has(item.payoutId);
                  const selected = selectedItemIds.has(item.payoutId);
                  const selectReason = currentStatus !== '已付款'
                    ? '仅已付款明细可以生成确认函。'
                    : !hasPaymentDate(item.paidAt)
                      ? '缺少实际付款时间，无法生成确认函。'
                      : '选择此付款明细';
                  return (
                    <tr className={selected ? 'is-selected' : ''} key={item.payoutId} aria-selected={selected}>
                      <td className="payment-project-detail-select-cell">
                        <label className="payment-project-detail-select-control">
                          <span className="sr-only">选择 {accountName} 的付款确认函</span>
                          <input
                            type="checkbox"
                            aria-label={`选择 ${accountName} 的付款确认函`}
                            checked={selected}
                            disabled={!canSelect}
                            title={selectReason}
                            onChange={() => toggleConfirmationItem(item.payoutId)}
                          />
                        </label>
                      </td>
                      <td className="payment-project-detail-creator-cell">
                        <PaymentCreatorIdentity {...creatorIdentity} />
                      </td>
                      <td className="payment-project-detail-provider-cell"><PaymentProviderBadge compact provider={item.provider} /></td>
                      <td className="payment-project-detail-account-cell">
                        <strong title={accountIdentifier}>{accountIdentifier}</strong>
                        <small>{item.accountIdentifierLabel || '收款账户快照'}</small>
                      </td>
                      <td className="payment-project-detail-date-cell">{paymentResultDate(currentStatus, item.paidAt)}</td>
                      <td className="payment-project-detail-money-cell">{money(item.currency, item.amount)}</td>
                      <td className="payment-project-detail-money-cell">{paymentResultMoney({ status: currentStatus, amount: item.actualPaidAmount, currency: item.actualPaidCurrency })}</td>
                      <td className="payment-project-detail-money-cell">{paymentResultMoney({ status: currentStatus, amount: item.transferFeeAmount, currency: item.transferFeeCurrency })}</td>
                      <td className="payment-project-detail-status-cell">
                        <span className={`simple-status ${paymentStatusTone(currentStatus)}`}><i />{currentStatus}</span>
                      </td>
                      <td className="action-cell payment-project-detail-action-cell">
                        <ListActionButton
                          kind="view"
                          onClick={(event) => openDetailDrawer(item.payoutId, event.currentTarget)}
                        >
                          查看详情
                        </ListActionButton>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td className="request-project-empty" colSpan={10}>该项目暂无付款明细</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedDetailItem ? (
        <PaymentProjectItemDrawer
          key={selectedDetailItem.payoutId}
          item={selectedDetailItem}
          payout={selectedDetailPayout}
          creator={selectedDetailCreator}
          canHandleFailure={canHandleFailure}
          onClose={closeDetailDrawer}
          onRequestFailureReturn={selectedDetailPayout ? () => openFailureDialog(selectedDetailItem.payoutId) : undefined}
          onOpenFailurePaymentList={selectedDetailPayout?.paymentFailureReturn && onOpenFailurePaymentList
            ? () => onOpenFailurePaymentList(record.request.paymentRequestProjectId, selectedDetailItem.payoutId)
            : undefined}
        />
      ) : null}

      {failureDialogPayoutId && dialogItem ? (
        <PaymentFailureReturnDialog
          key={failureDialogPayoutId}
          item={dialogItem}
          onClose={closeFailureDialog}
          onSubmit={(issueType, reason) => {
            const payout = payouts.find((candidate) => candidate.id === failureDialogPayoutId);
            return payout ? onReturnPayout(payout, issueType, reason) : false;
          }}
        />
      ) : null}
    </div>
  );
}
