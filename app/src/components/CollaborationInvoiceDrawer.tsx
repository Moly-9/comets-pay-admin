import {
  CalendarClock,
  Check,
  CircleAlert,
  FileSignature,
  FileText,
  FolderKanban,
  History,
  Landmark,
  ReceiptText,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import {
  paymentListItemValue,
  type RequestApprovalEvent,
} from '../businessWorkflow';
import {
  collaborationStatusTone,
  type CollaborationInvoiceRow,
} from '../collaborationInvoices';
import {
  CONTRACT_TYPE_LABELS,
  formatContractMoney,
  getContractReadiness,
  getContractValidity,
  type ContractRecord,
} from '../contracts';
import { paymentProviderDisplayName } from './PaymentProviderBadge';
import { CreatorIdentity } from './CreatorIdentity';
import './CollaborationInvoiceDrawer.css';

type TimelineEntry = {
  id: string;
  title: string;
  description: string;
  occurredAt?: string;
  state: 'complete' | 'current' | 'warning';
};

const formatDateTime = (value?: string) => {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '-');
};

const formatMoney = (currency: string, amount: number) => currency
  ? `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : '待核算';

const projectCodeFor = (row: CollaborationInvoiceRow) => row.project?.cooperationProjectCode
  ?? row.project?.projectCode
  ?? row.projectLinkId
  ?? '未记录';

const contractPaymentReadinessLabel = (contract: ContractRecord) => (
  getContractValidity(contract).expired ? '已失效' : getContractReadiness(contract).label
);

const contractPeriodLabel = (contract: ContractRecord) => {
  if (contract.isLongTerm) return '长期有效';
  if (!contract.campaignStart && !contract.campaignEnd) return '未记录';
  return `${contract.campaignStart || '待补充'} 至 ${contract.campaignEnd || '待补充'}`;
};

const approvalStageLabel = (event: RequestApprovalEvent) => {
  const stage = {
    PM: 'PM 审批',
    PROJECT_OWNER: '媒介负责人审批',
    OWNER: '老板审批',
    FINANCE: '财务审批',
  }[event.stage];
  return `${stage}${event.action === 'RETURN' ? '退回' : '通过'}`;
};

const buildTimeline = (row: CollaborationInvoiceRow): TimelineEntry[] => {
  const payout = row.payout;
  const entries: TimelineEntry[] = [];
  entries.push({
    id: 'invoice-generated',
    title: 'Invoice 已生成',
    description: `${row.invoiceNumber} · ${row.invoiceType === 'EXTERNAL' ? '外部 Invoice' : '内部 Invoice'}`,
    occurredAt: row.invoice?.generatedAt ?? row.invoiceDate,
    state: 'complete',
  });
  if (payout?.invoiceSignedAt) {
    entries.push({
      id: 'invoice-signed',
      title: '达人签署完成',
      description: `第 ${Math.max(1, payout.invoiceSignatureRound ?? 1)} 轮签署`,
      occurredAt: payout.invoiceSignedAt,
      state: 'complete',
    });
  }
  (payout?.invoiceReviewHistory ?? [])
    .filter((event) => event.action !== '生成草稿')
    .forEach((event, index) => entries.push({
      id: `invoice-review-${index}-${event.occurredAt}`,
      title: event.action,
      description: [event.actorName, event.reason].filter(Boolean).join(' · ') || 'Invoice 审核事件',
      occurredAt: event.occurredAt,
      state: event.action.includes('退回') || event.action === '付款失败' ? 'warning' : 'complete',
    }));
  row.requestSubmissions.forEach((submission) => entries.push({
    id: `request-submission-${submission.round}`,
    title: submission.round === 1 ? '发起请款' : `第 ${submission.round} 轮重新提交`,
    description: `${row.request?.requestCode ?? row.request?.id ?? '请款项目'} · ${row.request?.media ?? '发起人未记录'}`,
    occurredAt: submission.submittedAt,
    state: 'complete',
  }));
  (row.request?.approval?.history ?? []).forEach((event, index) => entries.push({
    id: `request-approval-${event.round}-${index}-${event.occurredAt}`,
    title: approvalStageLabel(event),
    description: [event.actorName, event.reason].filter(Boolean).join(' · '),
    occurredAt: event.occurredAt,
    state: event.action === 'RETURN' ? 'warning' : 'complete',
  }));
  if (payout?.currentPaymentAttempt?.submittedAt) {
    entries.push({
      id: `payment-attempt-current-${payout.currentPaymentAttempt.paymentBatchId}`,
      title: '已提交付款',
      description: payout.currentPaymentAttempt.paymentBatchCode,
      occurredAt: payout.currentPaymentAttempt.submittedAt,
      state: 'complete',
    });
  }
  (payout?.paymentAttempts ?? []).forEach((attempt) => entries.push({
    id: `payment-attempt-${attempt.paymentBatchId ?? attempt.attemptNumber}-${attempt.status}`,
    title: attempt.status === '已付款' ? '渠道付款成功' : '渠道付款失败',
    description: attempt.paymentBatchCode ?? `第 ${attempt.attemptNumber} 次付款`,
    occurredAt: attempt.occurredAt,
    state: attempt.status === '已付款' ? 'complete' : 'warning',
  }));
  if (payout?.paymentFailure && !(payout.paymentAttempts ?? []).some((attempt) => attempt.status === '付款失败')) {
    entries.push({
      id: 'payment-failure',
      title: '渠道付款失败',
      description: `${payout.paymentFailure.errorCode} · ${payout.paymentFailure.providerResponse}`,
      occurredAt: payout.paymentFailure.occurredAt,
      state: 'warning',
    });
  }
  if (payout?.paidAt && !(payout.paymentAttempts ?? []).some((attempt) => attempt.status === '已付款')) {
    entries.push({
      id: 'payment-paid',
      title: '付款已完成',
      description: `${paymentProviderDisplayName(payout.provider)} · ${formatMoney(payout.currency, payout.amount)}`,
      occurredAt: payout.paidAt,
      state: 'complete',
    });
  }
  const uniqueEntries = [...new Map(entries.map((entry) => [
    `${entry.title}|${entry.occurredAt ?? ''}|${entry.description}`,
    entry,
  ])).values()];
  uniqueEntries.sort((left, right) => {
    const leftTime = left.occurredAt ? Date.parse(left.occurredAt) : Number.NaN;
    const rightTime = right.occurredAt ? Date.parse(right.occurredAt) : Number.NaN;
    if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return 0;
    return leftTime - rightTime;
  });
  uniqueEntries.push({
    id: 'current-status',
    title: `当前状态：${row.status}`,
    description: row.status === '已付款' ? '该笔 Invoice 与付款记录已完成归档' : '系统根据当前 Invoice、请款与付款记录计算',
    state: row.status === '已付款' ? 'complete' : /失败|退回|异常/.test(row.status) ? 'warning' : 'current',
  });
  return uniqueEntries;
};

export function CollaborationInvoiceDrawer({
  row,
  returnFocusTo,
  onClose,
}: {
  row: CollaborationInvoiceRow;
  returnFocusTo?: HTMLElement | null;
  onClose: () => void;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = `collaboration-invoice-drawer-${row.rowId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const timeline = useMemo(() => buildTimeline(row), [row]);
  const requestAmount = row.paymentItem
    ? Number(paymentListItemValue(row.paymentItem, 'amount'))
    : row.amount;
  const requestCurrency = row.paymentItem
    ? String(paymentListItemValue(row.paymentItem, 'currency'))
    : row.currency;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []);
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
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.requestAnimationFrame(() => returnFocusTo?.focus());
    };
  }, [onClose, returnFocusTo]);

  return (
    <div
      className="collaboration-invoice-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        className="collaboration-invoice-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="collaboration-invoice-drawer-header">
          <div>
            <span>合作请款详情</span>
            <h2 id={titleId}>{row.invoiceNumber}</h2>
          </div>
          <div className="collaboration-invoice-drawer-header-actions">
            <span className={`collaboration-lifecycle-status is-${collaborationStatusTone(row.status)}`}><i />{row.status}</span>
            <button ref={closeButtonRef} className="icon-button" type="button" aria-label="关闭合作请款详情" onClick={onClose}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="collaboration-invoice-drawer-content">
          <section className="collaboration-invoice-hero" aria-label="达人">
            <CreatorIdentity
              creator={row.identity.creator}
              displayName={row.identity.displayName}
              initials={row.identity.initials}
              accent={row.identity.accent}
              accounts={row.identity.socialAccounts}
              fallbackHandle={row.identity.channelId}
              fallbackPlatform={row.identity.platform}
              socialAccountsMode="expanded"
              size="lg"
            />
          </section>

          <section className="collaboration-invoice-drawer-section" aria-labelledby={`${titleId}-project`}>
            <h3 id={`${titleId}-project`}><FolderKanban size={17} aria-hidden="true" />关联项目</h3>
            {row.project ? (
              <article className="collaboration-project-card">
                <header><div><span>{projectCodeFor(row)}</span><strong>{row.project.name}</strong></div><em>{row.project.status}</em></header>
                <dl className="collaboration-detail-grid">
                  <div><dt>合作品牌</dt><dd>{row.project.brand || '未记录'}</dd></div>
                </dl>
              </article>
            ) : (
              <div className="collaboration-resource-missing" role="note">
                <CircleAlert size={17} aria-hidden="true" />
                <span><strong>{row.projectName}</strong><small>保留 Invoice 冻结项目名称，但未找到对应的稳定项目 ID 记录。</small></span>
              </div>
            )}
          </section>

          <section className="collaboration-invoice-drawer-section" aria-labelledby={`${titleId}-invoice`}>
            <h3 id={`${titleId}-invoice`}><ReceiptText size={17} aria-hidden="true" />Invoice 信息</h3>
            <dl className="collaboration-detail-grid">
              <div><dt>Invoice 类型</dt><dd>{row.invoiceType === 'EXTERNAL' ? '外部 Invoice' : '内部 Invoice'}</dd></div>
              <div><dt>Invoice 日期</dt><dd>{row.invoiceDate || '未记录'}</dd></div>
              <div><dt>Invoice 金额</dt><dd>{formatMoney(row.currency, row.amount)}</dd></div>
            </dl>
            <div className="collaboration-description-list">
              <span>合作交付</span>
              {row.descriptions.length ? row.descriptions.map((description, index) => (
                <div key={`${description}-${index}`}><i>{index + 1}</i><p>{description}</p></div>
              )) : <p>待补充</p>}
            </div>
          </section>

          <section className="collaboration-invoice-drawer-section" aria-labelledby={`${titleId}-contracts`}>
            <h3 id={`${titleId}-contracts`}><FileSignature size={17} aria-hidden="true" />关联合同</h3>
            {row.contracts.length ? (
              <div className="collaboration-contract-list">
                {row.contracts.map((contract) => (
                  <article className="collaboration-contract-card" key={String(contract.contractId)}>
                    <header>
                      <div><span>{contract.id}</span><strong>{contract.name}</strong></div>
                      <em>{CONTRACT_TYPE_LABELS[contract.contractType ?? 'INDEPENDENT']}</em>
                    </header>
                    <dl className="collaboration-detail-grid">
                      <div><dt>付款就绪度</dt><dd>{contractPaymentReadinessLabel(contract)}</dd></div>
                      <div><dt>合同金额</dt><dd>{formatContractMoney(contract)}</dd></div>
                      <div><dt>有效期</dt><dd>{contractPeriodLabel(contract)}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : null}
            {row.missingContractIds.map((contractId) => (
              <div className="collaboration-resource-missing" role="note" key={contractId}>
                <CircleAlert size={17} aria-hidden="true" />
                <span><strong>{contractId}</strong><small>Invoice 保留了合同 ID，但当前合同资料中未找到该记录。</small></span>
              </div>
            ))}
            {row.legacyContractReference ? (
              <div className="collaboration-legacy-reference" role="note"><History size={16} aria-hidden="true" /><span><strong>历史合同引用</strong><small>{row.legacyContractReference} · 缺少稳定 contractId，不自动匹配。</small></span></div>
            ) : null}
            {!row.contracts.length && !row.missingContractIds.length && !row.legacyContractReference ? (
              <div className="collaboration-resource-empty">当前 Invoice 未记录关联合同</div>
            ) : null}
          </section>

          <section className="collaboration-invoice-drawer-section" aria-labelledby={`${titleId}-request`}>
            <h3 id={`${titleId}-request`}><FileText size={17} aria-hidden="true" />请款信息</h3>
            <dl className="collaboration-detail-grid">
              <div><dt>请款编号</dt><dd>{row.request?.requestCode ?? row.request?.id ?? '未发起'}</dd></div>
              <div><dt>发起人</dt><dd>{row.request?.media ?? '未记录'}</dd></div>
              <div><dt>本轮请款时间</dt><dd>{row.requestSubmittedAt ? formatDateTime(row.requestSubmittedAt) : '未发起'}</dd></div>
              <div><dt>付款清单编号</dt><dd>{row.paymentList?.paymentListCode ?? '未生成'}</dd></div>
              <div><dt>请款金额</dt><dd>{formatMoney(requestCurrency, requestAmount)}</dd></div>
            </dl>
            {row.requestSubmissions.length ? (
              <div className="collaboration-submission-history">
                <span>历次提交</span>
                {row.requestSubmissions.map((submission) => (
                  <div key={submission.round}><strong>第 {submission.round} 轮</strong><time>{formatDateTime(submission.submittedAt)}</time></div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="collaboration-invoice-drawer-section" aria-labelledby={`${titleId}-timeline`}>
            <h3 id={`${titleId}-timeline`}><CalendarClock size={17} aria-hidden="true" />全链路时间线</h3>
            <div className="collaboration-invoice-timeline">
              {timeline.map((entry) => (
                <article className={`is-${entry.state}`} key={entry.id}>
                  <span>{entry.state === 'complete' ? <Check size={13} aria-hidden="true" /> : entry.state === 'warning' ? <CircleAlert size={13} aria-hidden="true" /> : <Landmark size={13} aria-hidden="true" />}</span>
                  <div><strong>{entry.title}</strong><small>{entry.description}</small></div>
                  <time>{entry.occurredAt ? formatDateTime(entry.occurredAt) : '当前节点'}</time>
                </article>
              ))}
            </div>
          </section>
        </div>

        <footer className="collaboration-invoice-drawer-footer">
          <span><UserRound size={15} aria-hidden="true" />只读资料链路</span>
          <button className="button button-secondary" type="button" onClick={onClose}>关闭</button>
        </footer>
      </aside>
    </div>
  );
}
