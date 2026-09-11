import type {
  Payout,
  PayoutAccountVersion,
} from './types';
import type { PaymentBatchId } from './businessWorkflow';
import { createPaymentNotification } from './paymentNotification';

export type PaymentFailureRecoveryActor = {
  account: string;
  name: string;
};

export type PaymentFailureRevalidationAccount = {
  payoutAccountId?: string;
  payoutAccountVersion?: PayoutAccountVersion;
  accountFingerprint?: string;
  externalBeneficiaryId?: string;
};

export const markPaymentFailureAccountChanged = (
  payout: Payout,
  account: PaymentFailureRevalidationAccount,
  occurredAt = new Date().toISOString(),
): Payout => {
  if (!payout.paymentFailureRecovery || ['RETRY_SUBMITTED', 'RETRY_SUCCEEDED'].includes(payout.paymentFailureRecovery.status)) {
    throw new Error('当前付款不在可修改的失败恢复流程中。');
  }
  return {
    ...payout,
    paymentListRequiresRevalidation: true,
    paymentListValidationIssues: ['收款账户已修改，请重新校验'],
    paymentFailureRecovery: {
      ...payout.paymentFailureRecovery,
      status: 'CREATOR_UPDATED',
      readyReason: undefined,
      creatorUpdatedAt: occurredAt,
      reportedPayoutAccountId: account.payoutAccountId,
      reportedPayoutAccountVersion: account.payoutAccountVersion,
      reportedAccountFingerprint: account.accountFingerprint,
      reportedExternalBeneficiaryId: account.externalBeneficiaryId,
      revalidationIssues: [],
      financeConfirmedAt: undefined,
      financeConfirmedByAccount: undefined,
      financeConfirmedByName: undefined,
    },
  };
};

const nextAccountVersion = (value?: PayoutAccountVersion): PayoutAccountVersion => {
  const current = value && value !== 'legacy-v1' ? Number(value.slice(1)) : 1;
  return `v${Number.isFinite(current) ? current + 1 : 2}`;
};

export const isPaymentFailureRetryCandidate = (payout: Payout) => (
  payout.paymentFailureReturn?.issueType === 'PAYMENT_LIST'
  && Boolean(payout.paymentFailureRecovery)
  && ['AWAITING_CREATOR_UPDATE', 'CREATOR_UPDATED', 'PENDING_FINANCE_CONFIRMATION', 'READY_FOR_RETRY']
    .includes(payout.paymentFailureRecovery!.status)
);

export const isPaymentFailureRetryReady = (payout: Payout) => (
  isPaymentFailureRetryCandidate(payout)
  && payout.paymentFailureRecovery?.status === 'READY_FOR_RETRY'
  && (
    payout.paymentFailureRecovery.readyReason === 'ACCOUNT_UNCHANGED'
    || Boolean(payout.paymentFailureRecovery.financeConfirmedAt)
  )
);

export const paymentFailureRecoveryLabel = (payout: Payout) => {
  const status = payout.paymentFailureRecovery?.status;
  if (status === 'CREATOR_UPDATED') return '达人已更新，待重新校验';
  if (status === 'PENDING_FINANCE_CONFIRMATION') return '账户已校验，待财务确认';
  if (status === 'READY_FOR_RETRY') {
    return payout.paymentFailureRecovery?.readyReason === 'ACCOUNT_UNCHANGED'
      ? '已通知，可重试'
      : '已重新校验，可重试';
  }
  if (status === 'RETRY_SUBMITTED') return '付款处理中';
  if (status === 'RETRY_SUCCEEDED') return '重试付款成功';
  return '等待达人更新账户';
};

export const beginPaymentFailureAccountRecovery = (
  payout: Payout,
): Payout => {
  const previous = payout.paymentFailureRecovery;
  return {
    ...payout,
    status: '已退回',
    invoiceReviewStatus: '已通过',
    paymentListRequiresRevalidation: false,
    paymentListValidationIssues: [],
    paymentFailureRecovery: {
      status: 'AWAITING_CREATOR_UPDATE',
      notifications: [],
      previousFailure: payout.paymentFailure ?? previous?.previousFailure,
      readyReason: undefined,
      failureCode: payout.paymentFailure?.errorCode,
      returnReason: payout.paymentFailureReturn?.reason,
      previousAttempts: previous ? [
        ...(previous.previousAttempts ?? []),
        {
          status: previous.status,
          notifications: previous.notifications,
          previousFailure: previous.previousFailure,
          failureCode: previous.failureCode,
          returnReason: previous.returnReason,
          creatorUpdatedAt: previous.creatorUpdatedAt,
          revalidatedAt: previous.revalidatedAt,
          financeConfirmedAt: previous.financeConfirmedAt,
          financeConfirmedByAccount: previous.financeConfirmedByAccount,
          financeConfirmedByName: previous.financeConfirmedByName,
          retryBatchId: previous.retryBatchId,
          retryBatchCode: previous.retryBatchCode,
        },
      ] : [],
    },
  };
};

export const recordPaymentFailureNotification = (
  payout: Payout,
  actor: PaymentFailureRecoveryActor,
  message: string,
  email: string,
  occurredAt = new Date().toISOString(),
): Payout => {
  if (!isPaymentFailureRetryCandidate(payout)) {
    throw new Error('当前付款不在账户更新恢复流程中。');
  }
  const notification = createPaymentNotification(
    actor,
    message,
    email,
    occurredAt,
  );
  return {
    ...payout,
    paymentFailureRecovery: {
      ...payout.paymentFailureRecovery!,
      status: payout.paymentFailureRecovery!.status === 'AWAITING_CREATOR_UPDATE'
        && !payout.paymentListRequiresRevalidation
        ? 'READY_FOR_RETRY'
        : payout.paymentFailureRecovery!.status,
      readyReason: payout.paymentFailureRecovery!.status === 'AWAITING_CREATOR_UPDATE'
        && !payout.paymentListRequiresRevalidation
        ? 'ACCOUNT_UNCHANGED'
        : payout.paymentFailureRecovery!.readyReason,
      notifications: [
        ...payout.paymentFailureRecovery!.notifications,
        notification,
      ],
    },
  };
};

export const simulateCreatorAccountUpdated = (
  payout: Payout,
  occurredAt = new Date().toISOString(),
): Payout => {
  if (!isPaymentFailureRetryCandidate(payout)) {
    throw new Error('当前付款不在账户更新恢复流程中。');
  }
  if (!payout.paymentFailureRecovery?.notifications.length) {
    throw new Error('请先向达人发送付款失败通知。');
  }
  const revision = payout.paymentFailureRecovery.notifications.length;
  return {
    ...payout,
    paymentListRequiresRevalidation: true,
    paymentListValidationIssues: ['达人已更新账户，待重新校验'],
    paymentFailureRecovery: {
      ...payout.paymentFailureRecovery,
      status: 'CREATOR_UPDATED',
      readyReason: undefined,
      creatorUpdatedAt: occurredAt,
      reportedPayoutAccountId: payout.payoutAccountId ?? payout.invoiceSnapshot?.payoutAccountId,
      reportedPayoutAccountVersion: nextAccountVersion(
        payout.payoutAccountVersion ?? payout.invoiceSnapshot?.payoutAccountVersion,
      ),
      reportedAccountFingerprint: `fp_recovery_${payout.id}_${revision}`,
      reportedExternalBeneficiaryId: payout.provider === 'Airwallex'
        ? `${payout.externalBeneficiaryId ?? payout.invoiceSnapshot?.payment.externalBeneficiaryId ?? 'beneficiary'}-updated-${revision}`
        : payout.externalBeneficiaryId,
    },
  };
};

export const completePaymentFailureRevalidation = (
  payout: Payout,
  occurredAt = new Date().toISOString(),
  issues: string[] = [],
): Payout => {
  const recovery = payout.paymentFailureRecovery;
  if (!recovery || recovery.status !== 'CREATOR_UPDATED') {
    throw new Error('需先收到达人账户已更新的反馈。');
  }
  if (!recovery.reportedPayoutAccountVersion || !recovery.reportedAccountFingerprint) {
    throw new Error('达人账户版本信息不完整。');
  }
  if (payout.provider === 'Airwallex' && !recovery.reportedExternalBeneficiaryId) {
    throw new Error('Airwallex beneficiary_id 尚未更新。');
  }
  if (issues.length) {
    return {
      ...payout,
      paymentListRequiresRevalidation: true,
      paymentListValidationIssues: [...issues],
      paymentFailureRecovery: {
        ...recovery,
        status: 'CREATOR_UPDATED',
        revalidatedAt: occurredAt,
        revalidationIssues: [...issues],
      },
    };
  }
  return {
    ...payout,
    payoutAccountId: recovery.reportedPayoutAccountId
      ?? payout.payoutAccountId
      ?? payout.invoiceSnapshot?.payoutAccountId,
    payoutAccountVersion: recovery.reportedPayoutAccountVersion,
    payoutAccountFingerprint: recovery.reportedAccountFingerprint,
    externalBeneficiaryId: recovery.reportedExternalBeneficiaryId ?? payout.externalBeneficiaryId,
    paymentListRequiresRevalidation: false,
    paymentListValidationIssues: [],
    paymentFailureRecovery: {
      ...recovery,
      status: 'PENDING_FINANCE_CONFIRMATION',
      readyReason: undefined,
      revalidatedAt: occurredAt,
      revalidationIssues: [],
    },
  };
};

export const confirmPaymentFailureAccountChange = (
  payout: Payout,
  actor: PaymentFailureRecoveryActor,
  occurredAt = new Date().toISOString(),
): Payout => {
  const recovery = payout.paymentFailureRecovery;
  if (!recovery || recovery.status !== 'PENDING_FINANCE_CONFIRMATION') {
    throw new Error('执行账户尚未完成重新校验，不能由财务确认。');
  }
  return {
    ...payout,
    paymentFailureRecovery: {
      ...recovery,
      status: 'READY_FOR_RETRY',
      readyReason: 'REVALIDATED',
      financeConfirmedAt: occurredAt,
      financeConfirmedByAccount: actor.account,
      financeConfirmedByName: actor.name,
    },
  };
};

export const paymentFailureRevalidationIssues = (
  payout: Payout,
  account: PaymentFailureRevalidationAccount | null,
) => {
  const recovery = payout.paymentFailureRecovery;
  if (!recovery || recovery.status !== 'CREATOR_UPDATED') return ['达人账户尚未更新'];
  if (!account) return ['达人档案中未找到失败款关联的收款账户'];
  const expectedPayoutAccountId = recovery.reportedPayoutAccountId
    ?? payout.payoutAccountId
    ?? payout.invoiceSnapshot?.payoutAccountId;
  return [
    account.payoutAccountId !== expectedPayoutAccountId ? '收款账户 ID 与失败付款记录不一致' : '',
    account.payoutAccountVersion !== recovery.reportedPayoutAccountVersion ? '收款账户版本与达人反馈不一致' : '',
    account.accountFingerprint !== recovery.reportedAccountFingerprint ? '收款账户资料指纹与达人反馈不一致' : '',
    payout.provider === 'Airwallex' && account.externalBeneficiaryId !== recovery.reportedExternalBeneficiaryId
      ? 'Airwallex beneficiary_id 与达人反馈不一致'
      : '',
  ].filter(Boolean);
};

export const markPaymentFailureRetrySubmitted = (
  payout: Payout,
  batchId: string,
  batchCode: string,
  submittedAt = new Date().toISOString(),
  paymentOrder?: {
    paymentCode?: string;
    paymentOrderCode: string;
    sourcePaymentOrderCode: string;
    attemptNumber: number;
  },
): Payout => {
  if (!isPaymentFailureRetryReady(payout)) {
    throw new Error('失败款尚未完成账户校验和财务确认。');
  }
  return {
    ...payout,
    paymentCode: paymentOrder?.paymentCode ?? payout.paymentCode,
    status: '付款处理中',
    issue: undefined,
    returnReason: undefined,
    paidAt: undefined,
    transferFeeAmount: undefined,
    transferFeeCurrency: undefined,
    actualPaidAmount: undefined,
    actualPaidCurrency: undefined,
    recipientReceivedAmount: undefined,
    recipientReceivedCurrency: undefined,
    paymentFailure: undefined,
    paymentFailureReturn: undefined,
    currentPaymentAttempt: {
      paymentBatchId: batchId as PaymentBatchId,
      paymentBatchCode: batchCode,
      submittedAt,
      ...paymentOrder,
    },
    paymentFailureRecovery: payout.paymentFailureRecovery ? {
      ...payout.paymentFailureRecovery,
      status: 'RETRY_SUBMITTED',
      retryBatchId: batchId,
      retryBatchCode: batchCode,
      retrySucceededAt: undefined,
    } : undefined,
  };
};
