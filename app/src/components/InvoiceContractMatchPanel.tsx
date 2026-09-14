import { AlertTriangle, CheckCircle2, ChevronUp, FileText } from 'lucide-react';
import { useId } from 'react';
import type { InvoiceContractMatchIssue } from '../types';
import type { InvoiceContractMatchCheck } from '../invoice/invoiceContractMatching';

export type InvoiceContractMatchPanelValue = {
  result: 'NOT_APPLICABLE' | 'BLOCKED' | 'REASON_REQUIRED' | 'APPROVED_WITH_REASON' | 'MATCHED';
  checks: InvoiceContractMatchCheck[];
  blockerIssues: InvoiceContractMatchIssue[];
  reasonRequiredIssues: InvoiceContractMatchIssue[];
};

type InvoiceContractMatchPanelProps = {
  match: InvoiceContractMatchPanelValue;
  reason: string;
  onReasonChange?: (reason: string) => void;
  error?: string;
  disabled?: boolean;
  contextLabel?: string;
  className?: string;
  reasonInputId?: string;
  onCollapse?: () => void;
  actionLabel?: string;
};

const confirmedCheck = (check: InvoiceContractMatchCheck) => (
  ['MATCH', 'NOT_APPLICABLE', 'APPROVED_WITH_REASON'].includes(check.state)
);

const resultTitle = (result: InvoiceContractMatchPanelValue['result'], actionLabel: string) => {
  if (result === 'NOT_APPLICABLE') return '未关联合同，匹配不适用';
  if (result === 'BLOCKED') return `主体不一致，暂不能${actionLabel}`;
  if (result === 'REASON_REQUIRED') return '存在可放行差异，请填写说明';
  if (result === 'APPROVED_WITH_REASON') return `差异说明已填写，可以${actionLabel}`;
  return '合同与 Invoice 已匹配';
};

const formatAccountUpdatedAt = (value?: string) => {
  if (!value) return '暂无更新时间';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
};

export function InvoiceContractMatchPanel({
  match,
  reason,
  onReasonChange,
  error,
  disabled = false,
  contextLabel,
  className = '',
  reasonInputId,
  onCollapse,
  actionLabel = '生成',
}: InvoiceContractMatchPanelProps) {
  const generatedReasonId = useId();
  const reasonId = reasonInputId ?? generatedReasonId;
  const helpId = `${reasonId}-help`;
  const confirmedCount = match.checks.filter(confirmedCheck).length;
  const classes = [
    'invoice-contract-match-panel',
    contextLabel ? 'invoice-contract-match-panel-contextual' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      data-result={match.result}
      aria-label={contextLabel ? `${contextLabel} 合同匹配` : '合同匹配'}
    >
      {contextLabel ? <small className="invoice-contract-match-context">{contextLabel}</small> : null}
      <div className="invoice-contract-match-head">
        <span>
          {match.result === 'BLOCKED' ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
          <strong>{resultTitle(match.result, actionLabel)}</strong>
        </span>
        <div className="invoice-contract-match-head-actions">
          <em>{match.result === 'NOT_APPLICABLE'
            ? '不适用'
            : `${confirmedCount}/${match.checks.length} 已确认`}</em>
          {onCollapse && match.result === 'APPROVED_WITH_REASON' ? (
            <button type="button" onClick={onCollapse}>
              <ChevronUp size={14} aria-hidden="true" />
              收起
            </button>
          ) : null}
        </div>
      </div>
      <div className="invoice-contract-match-grid">
        {match.checks.map((check) => (
          <article
            className={check.paymentAccountDifference ? 'has-account-difference' : undefined}
            data-state={check.state}
            key={check.field}
          >
            <span>{
              check.state === 'MATCH' || check.state === 'APPROVED_WITH_REASON'
                ? <CheckCircle2 size={15} />
                : check.state === 'NOT_APPLICABLE'
                  ? <FileText size={15} />
                  : <AlertTriangle size={15} />
            }</span>
            <div className="invoice-contract-match-check-copy">
              <strong>{check.label}</strong>
              <small>{check.message}</small>
              {check.paymentAccountDifference ? (
                <dl className="invoice-contract-account-difference">
                  <div>
                    <dt>差异字段</dt>
                    <dd>{check.paymentAccountDifference.technicalMetadataOnly
                      ? '账户记录已更新，付款信息字段一致'
                      : check.paymentAccountDifference.fieldLabels.join('、')}</dd>
                  </div>
                  <div>
                    <dt>合同账户更新</dt>
                    <dd>{check.paymentAccountDifference.contractAccounts.map((account) => (
                      <span key={account.contractReference}>
                        {account.contractReference} · {formatAccountUpdatedAt(account.updatedAt)}
                      </span>
                    ))}</dd>
                  </div>
                  <div>
                    <dt>当前 Invoice 账户更新</dt>
                    <dd>{formatAccountUpdatedAt(check.paymentAccountDifference.invoiceAccountUpdatedAt)}</dd>
                  </div>
                </dl>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {match.reasonRequiredIssues.length ? (
        <label className={`invoice-contract-match-reason${error ? ' has-error' : ''}`} htmlFor={reasonId}>
          <span>合同差异说明 *</span>
          <textarea
            id={reasonId}
            value={reason}
            maxLength={300}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={helpId}
            placeholder="说明金额、币种或付款账户与合同不一致的业务原因"
            onChange={(event) => onReasonChange?.(event.target.value)}
          />
          <small id={helpId} role={error ? 'alert' : undefined}>
            {error || `${reason.trim().length}/300`}
          </small>
        </label>
      ) : match.blockerIssues.length ? (
        <p className="invoice-contract-match-blocker" role="alert">
          {match.blockerIssues.map((item) => item.message).join('；')}
        </p>
      ) : null}
    </div>
  );
}
