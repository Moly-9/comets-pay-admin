import { CircleDollarSign, RadioTower, Send } from 'lucide-react';

export type PaymentProgressStatus = '付款处理中' | '部分失败' | '已退回' | '已付款';

const PAYMENT_PROGRESS_STEPS = [
  { label: '已提交', icon: Send },
  { label: '平台处理中', icon: RadioTower },
  { label: '已付款', icon: CircleDollarSign },
] as const;

const progressStepState = (status: PaymentProgressStatus, index: number) => {
  if (status === '已付款') return 'complete';
  if (status === '部分失败' || status === '已退回') return index < 2 ? 'complete' : 'failed';
  if (index === 0) return 'complete';
  return index === 1 ? 'current' : 'pending';
};

export function PaymentProgressSteps({
  ariaLabel,
  status,
}: {
  ariaLabel: string;
  status: PaymentProgressStatus;
}) {
  return (
    <ol className="payment-progress-steps" aria-label={ariaLabel}>
      {PAYMENT_PROGRESS_STEPS.map((step, index) => {
        const StepIcon = step.icon;
        const state = progressStepState(status, index);
        const stateLabel = state === 'complete'
          ? '已完成'
          : state === 'current'
            ? '当前阶段'
            : state === 'failed'
              ? status
              : '待处理';
        return (
          <li className={`is-${state}`} key={step.label} aria-current={state === 'current' || state === 'failed' ? 'step' : undefined}>
            <span aria-hidden="true"><StepIcon size={18} /></span>
            <strong>{step.label}</strong>
            <small>{stateLabel}</small>
            {index < PAYMENT_PROGRESS_STEPS.length - 1 ? <i aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
