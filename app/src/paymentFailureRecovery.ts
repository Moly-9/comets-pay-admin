import type {
  PaymentFailureNotificationDelivery,
  Payout,
  PayoutAccountVersion,
} from './types';

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
  if (!payout.paymentFailureRecovery || payout.paymentFailureRecovery.status === 'RETRY_SUBMITTED') {
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
    },
  };
};

const nextAccountVersion = (value?: PayoutAccountVersion): PayoutAccountVersion => {
  const current = value && value !== 'legacy-v1' ? Number(value.slice(1)) : 1;
  return `v${Number.isFinite(current) ? current + 1 : 2}`;
};

const maskEmail = (value: string) => {
  const [local, domain] = value.trim().split('@');
  if (!local || !domain) return '达人档案邮箱待补充';
  return `${local.slice(0, 1)}***@${domain}`;
};

const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

export const isPaymentFailureRetryCandidate = (payout: Payout) => (
  payout.paymentFailureReturn?.issueType === 'PAYMENT_LIST'
  && Boolean(payout.paymentFailureRecovery)
  && payout.paymentFailureRecovery?.status !== 'RETRY_SUBMITTED'
);

export const isPaymentFailureRetryReady = (payout: Payout) => (
  isPaymentFailureRetryCandidate(payout)
  && payout.paymentFailureRecovery?.status === 'READY_FOR_RETRY'
);

export const paymentFailureRecoveryLabel = (payout: Payout) => {
  const status = payout.paymentFailureRecovery?.status;
  if (status === 'CREATOR_UPDATED') return '达人已更新，待重新校验';
  if (status === 'READY_FOR_RETRY') {
    return payout.paymentFailureRecovery?.readyReason === 'ACCOUNT_UNCHANGED'
      ? '已通知，可重试'
      : '已重新校验，可重试';
  }
  if (status === 'RETRY_SUBMITTED') return '付款处理中';
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
      readyReason: undefined,
      failureCode: payout.paymentFailure?.errorCode,
      returnReason: payout.paymentFailureReturn?.reason,
      previousAttempts: previous ? [
        ...(previous.previousAttempts ?? []),
        {
          status: previous.status,
          notifications: previous.notifications,
          failureCode: previous.failureCode,
          returnReason: previous.returnReason,
          creatorUpdatedAt: previous.creatorUpdatedAt,
          revalidatedAt: previous.revalidatedAt,
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
  const normalizedMessage = message.trim();
  if (!normalizedMessage) throw new Error('通知内容不能为空。');
  if (normalizedMessage.length > 300) throw new Error('通知内容不能超过 300 字。');
  const deliveries: PaymentFailureNotificationDelivery[] = [
    {
      channel: 'IN_APP',
      status: 'SIMULATED_SENT',
      recipientLabel: '达人站内信',
    },
    {
      channel: 'GMAIL',
      status: validEmail(email) ? 'SIMULATED_SENT' : 'SKIPPED_MISSING_RECIPIENT',
      recipientLabel: maskEmail(email),
    },
  ];
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
        {
          message: normalizedMessage,
          actorAccount: actor.account,
          actorName: actor.name,
          occurredAt,
          deliveries,
        },
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
      status: 'READY_FOR_RETRY',
      readyReason: 'REVALIDATED',
      revalidatedAt: occurredAt,
      revalidationIssues: [],
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
): Payout => ({
  ...payout,
  status: '付款处理中',
  issue: undefined,
  paymentFailureRecovery: payout.paymentFailureRecovery ? {
    ...payout.paymentFailureRecovery,
    status: 'RETRY_SUBMITTED',
    retryBatchId: batchId,
    retryBatchCode: batchCode,
  } : undefined,
});
