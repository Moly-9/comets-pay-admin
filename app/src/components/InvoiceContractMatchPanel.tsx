import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
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
};

const confirmedCheck = (check: InvoiceContractMatchCheck) => (
  ['MATCH', 'NOT_APPLICABLE', 'APPROVED_WITH_REASON'].includes(check.state)
);

const resultTitle = (result: InvoiceContractMatchPanelValue['result']) => {
  if (result === 'NOT_APPLICABLE') return '未关联合同，匹配不适用';
  if (result === 'BLOCKED') return '主体不一致，暂不能生成';
  if (result === 'REASON_REQUIRED') return '存在可放行差异，请填写说明';
  if (result === 'APPROVED_WITH_REASON') return '差异说明已填写，可以生成';
  return '合同与 Invoice 已匹配';
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
          <strong>{resultTitle(match.result)}</strong>
        </span>
        <em>{match.result === 'NOT_APPLICABLE'
          ? '不适用'
          : `${confirmedCount}/${match.checks.length} 已确认`}</em>
      </div>
      <div className="invoice-contract-match-grid">
        {match.checks.map((check) => (
          <article data-state={check.state} key={check.field}>
            <span>{
              check.state === 'MATCH' || check.state === 'APPROVED_WITH_REASON'
                ? <CheckCircle2 size={15} />
                : check.state === 'NOT_APPLICABLE'
                  ? <FileText size={15} />
                  : <AlertTriangle size={15} />
            }</span>
            <div><strong>{check.label}</strong><small>{check.message}</small></div>
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
