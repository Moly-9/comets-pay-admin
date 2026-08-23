import type {
  GeneratedInvoiceRecord,
  InvoiceContractMatchReview,
  InvoiceDocumentModel,
  InvoiceEditContext,
  InvoiceReviewEvent,
  InvoiceReviewStage,
  InvoiceReviewStatus,
  PaymentFailureIssueType,
  Payout,
  PayoutStatus,
} from '../types';
import type { InvoicePageTab } from './invoiceManagement';
import { todayInputValue } from './invoiceUtils';

export type { InvoicePageTab } from './invoiceManagement';

export type InvoiceReviewAction =
  | 'MARK_SIGNED'
  | 'RECORD_CREATOR_FEEDBACK'
  | 'APPROVE_MEDIA'
  | 'RETURN_TO_CREATOR';

export type InvoiceReviewActor = {
  account: string;
  name: string;
  role: string;
};

const notificationEmailIsValid = (value: string) => {
  const [localPart, domain] = value.trim().split('@');
  return Boolean(localPart && domain?.includes('.'));
};

const maskNotificationEmail = (value: string) => {
  const [localPart, domain] = value.trim().split('@');
  if (!localPart || !domain) return '达人档案邮箱待补充';
  return `${localPart.slice(0, 1)}***@${domain}`;
};

const signatureDateFromOccurredAt = (occurredAt: string) => (
  todayInputValue(new Date(occurredAt))
);

export const buildMockElectronicSignature = (creatorName?: string) => (
  creatorName?.trim() || 'Signed electronically'
);

export type InvoiceReviewCapabilities = {
  manage: boolean;
  mediaReview: boolean;
  financeReview: boolean;
  projectResourceEdit?: boolean;
};

export type InvoiceDetailNavigationTarget = 'PROJECT' | 'REQUEST' | 'PAYMENT';
export type ApprovedInvoicePaymentStatus = Extract<
  PayoutStatus,
  '等待付款' | '付款处理中' | '已付款' | '付款失败'
>;

export const APPROVED_INVOICE_PAYMENT_STATUS_LABEL: Record<
  ApprovedInvoicePaymentStatus,
  string
> = {
  等待付款: '等待付款',
  付款处理中: '付款处理中',
  已付款: '已付款',
  付款失败: '付款失败待财务处理',
};

export const INVOICE_REVIEW_STATUS_META: Record<
  InvoiceReviewStatus,
  { label: string; color: string }
> = {
  待签署: { label: '待签署', color: '#8b5cf6' },
  达人反馈: { label: '达人反馈', color: '#e8792e' },
  待媒介审核: { label: '待审核', color: '#f59e0b' },
  待媒介复核: { label: '待复核', color: '#f97316' },
  已通过: { label: '已通过', color: '#22c55e' },
  已退回: { label: '已退回', color: '#ef4444' },
};

type Transition = {
  from: InvoiceReviewStatus[];
  to: InvoiceReviewStatus;
  stage: InvoiceReviewStage;
  label: InvoiceReviewEvent['action'];
  reasonRequired?: boolean;
};

const STATIC_TRANSITIONS: Partial<Record<InvoiceReviewAction, Transition>> = {
  MARK_SIGNED: {
    from: ['待签署'],
    to: '待媒介审核',
    stage: 'SIGNATURE',
    label: '签署完成',
  },
  RECORD_CREATOR_FEEDBACK: {
    from: ['待签署'],
    to: '达人反馈',
    stage: 'SIGNATURE',
    label: '达人反馈',
    reasonRequired: true,
  },
  APPROVE_MEDIA: {
    from: ['待媒介审核', '待媒介复核'],
    to: '已通过',
    stage: 'MEDIA',
    label: '审核通过',
  },
  RETURN_TO_CREATOR: {
    from: ['待媒介审核', '待媒介复核'],
    to: '待签署',
    stage: 'MEDIA',
    label: '退回',
    reasonRequired: true,
  },
};

export const getInvoicePageTab = (status: InvoiceReviewStatus): InvoicePageTab => {
  if (status === '待签署') return 'signature';
  if (status === '达人反馈' || status === '待媒介审核' || status === '待媒介复核') {
    return 'review';
  }
  if (status === '已退回') return 'returned';
  return 'approved';
};

export const getInvoiceDetailNavigationTarget = (
  status: InvoiceReviewStatus,
): InvoiceDetailNavigationTarget | null => {
  if (status === '已通过') return 'PROJECT';
  return null;
};

export const getApprovedInvoicePaymentStatus = (
  payout: Pick<Payout, 'status'>,
): ApprovedInvoicePaymentStatus => {
  if (
    payout.status === '付款处理中'
    || payout.status === '已付款'
    || payout.status === '付款失败'
  ) {
    return payout.status;
  }
  return '等待付款';
};

export const getInvoiceRowStatus = (payout: Pick<Payout, 'invoiceReviewStatus' | 'status'>) => {
  if (payout.invoiceReviewStatus === '待签署') return '待签署';
  if (payout.invoiceReviewStatus === '达人反馈') return '达人反馈';
  if (payout.invoiceReviewStatus === '待媒介审核') return '待审核';
  if (payout.invoiceReviewStatus === '待媒介复核') return '待复核';
  if (payout.invoiceReviewStatus === '已通过') {
    return getApprovedInvoicePaymentStatus(payout) === '已付款' ? '已付款' : '付款中';
  }
  return INVOICE_REVIEW_STATUS_META[payout.invoiceReviewStatus].label;
};

export const getAvailableInvoiceReviewActions = (
  status: InvoiceReviewStatus,
  capabilities: InvoiceReviewCapabilities,
): InvoiceReviewAction[] => {
  if (status === '待签署') {
    return capabilities.manage ? ['MARK_SIGNED', 'RECORD_CREATOR_FEEDBACK'] : [];
  }
  if (status === '达人反馈') {
    return [];
  }
  if (status === '待媒介审核' || status === '待媒介复核') {
    return capabilities.mediaReview ? ['APPROVE_MEDIA', 'RETURN_TO_CREATOR'] : [];
  }
  if (status === '已退回') {
    return [];
  }
  return [];
};

export const getInvoiceDetailReviewActions = (
  status: InvoiceReviewStatus,
  capabilities: InvoiceReviewCapabilities,
) => (
  status === '待签署'
    ? []
    : getAvailableInvoiceReviewActions(status, capabilities)
);

const resolveTransition = (
  payout: Pick<Payout, 'invoiceReviewStatus'>,
  action: InvoiceReviewAction,
): Transition => {
  const transition = STATIC_TRANSITIONS[action];
  if (!transition) throw new Error('当前 Invoice 操作未配置。');
  return transition;
};

export const createInvoiceReviewEvent = (
  payout: Pick<Payout, 'invoiceReviewStatus' | 'paymentFailureReturn'>,
  action: InvoiceReviewAction,
  actor: InvoiceReviewActor,
  reason?: string,
  occurredAt = new Date().toISOString(),
): InvoiceReviewEvent => {
  const transition = resolveTransition(payout, action);
  if (!transition.from.includes(payout.invoiceReviewStatus)) {
    throw new Error(`Invoice 状态“${payout.invoiceReviewStatus}”不能执行该操作。`);
  }
  const normalizedReason = reason?.trim();
  if (transition.reasonRequired && !normalizedReason) {
    throw new Error(action === 'RECORD_CREATOR_FEEDBACK'
      ? '记录达人反馈时必须填写反馈内容。'
      : '退回达人修改时必须填写原因。');
  }

  return {
    stage: transition.stage,
    action: action === 'APPROVE_MEDIA' && payout.invoiceReviewStatus === '待媒介复核'
      ? '复核通过并重新提交'
      : transition.label,
    actorAccount: actor.account,
    actorName: actor.name,
    actorRole: actor.role,
    fromStatus: payout.invoiceReviewStatus,
    toStatus: transition.to,
    reason: normalizedReason,
    occurredAt,
  };
};

export const applyInvoiceReviewAction = (
  payout: Payout,
  action: InvoiceReviewAction,
  actor: InvoiceReviewActor,
  reason?: string,
  occurredAt = new Date().toISOString(),
): Payout => {
  const event = createInvoiceReviewEvent(payout, action, actor, reason, occurredAt);
  const isCreatorFeedback = action === 'RECORD_CREATOR_FEEDBACK';
  const isSigned = action === 'MARK_SIGNED';
  const invalidatesSignature = action === 'RETURN_TO_CREATOR';
  const invoiceSnapshot = payout.invoiceSnapshot
    ? {
        ...payout.invoiceSnapshot,
        signatureDate: isSigned
          ? signatureDateFromOccurredAt(occurredAt)
          : invalidatesSignature
            ? undefined
            : payout.invoiceSnapshot.signatureDate,
        signatureText: isSigned
          ? buildMockElectronicSignature(payout.invoiceSnapshot.creatorName || payout.creator)
          : invalidatesSignature
            ? undefined
            : payout.invoiceSnapshot.signatureText,
      }
    : undefined;

  return {
    ...payout,
    status: '未进入付款',
    invoiceReviewStatus: event.toStatus,
    invoiceReviewHistory: [...(payout.invoiceReviewHistory ?? []), event],
    invoiceVersion: invalidatesSignature
      ? (payout.invoiceVersion ?? 1) + 1
      : payout.invoiceVersion ?? 1,
    invoiceSignatureRound: isSigned
      ? (payout.invoiceSignatureRound ?? 0) + 1
      : payout.invoiceSignatureRound,
    invoiceSignedAt: isSigned ? occurredAt : invalidatesSignature ? undefined : payout.invoiceSignedAt,
    invoiceSnapshot,
    creatorFeedback: isCreatorFeedback
      ? { reason: event.reason ?? '', actorName: actor.name, occurredAt }
      : payout.creatorFeedback,
    invoiceReviewReturn: action === 'RETURN_TO_CREATOR'
      ? {
          stage: 'MEDIA',
          reason: event.reason ?? '',
          actorName: actor.name,
          occurredAt,
        }
      : payout.invoiceReviewReturn,
    issue: isCreatorFeedback
      ? `达人反馈：${event.reason}`
      : action === 'RETURN_TO_CREATOR'
        ? `媒介退回达人修改：${event.reason}`
        : undefined,
    returnReason: action === 'RETURN_TO_CREATOR' ? event.reason : undefined,
    paymentFailureReturn: payout.paymentFailureReturn,
    paymentFailure: payout.paymentFailure,
  };
};

export const getInvoiceEditContext = (
  payout: Pick<Payout, 'invoiceReviewStatus' | 'paymentFailureReturn'>,
  capabilities: InvoiceReviewCapabilities,
): InvoiceEditContext | null => {
  if (payout.invoiceReviewStatus === '达人反馈' && capabilities.manage) {
    return 'CREATOR_FEEDBACK';
  }
  if (payout.invoiceReviewStatus === '待媒介复核' && capabilities.mediaReview) {
    return 'MEDIA_RECHECK';
  }
  if (
    payout.invoiceReviewStatus === '已退回'
    && payout.paymentFailureReturn?.issueType === 'INVOICE_CONTENT'
    && capabilities.manage
  ) {
    return 'PAYMENT_FAILURE_CONTENT';
  }
  if (capabilities.manage && capabilities.projectResourceEdit) {
    return 'PROJECT_RESOURCE';
  }
  return null;
};

const cloneInvoiceSnapshot = (snapshot: InvoiceDocumentModel): InvoiceDocumentModel => ({
  ...snapshot,
  billTo: { ...snapshot.billTo },
  from: { ...snapshot.from },
  contractIds: snapshot.contractIds ? [...snapshot.contractIds] : undefined,
  items: snapshot.items.map((item) => ({ ...item })),
  payment: { ...snapshot.payment },
});

const EDITABLE_INVOICE_FIELDS: Array<keyof InvoiceDocumentModel> = [
  'invoiceDate',
  'billTo',
  'contractIds',
  'from',
  'currency',
  'items',
  'payoutAccountId',
  'paymentMethod',
  'payment',
];

export const invoiceDocumentChangedFields = (
  previous: InvoiceDocumentModel,
  next: InvoiceDocumentModel,
) => EDITABLE_INVOICE_FIELDS.filter((field) => (
  JSON.stringify(
    field === 'contractIds' ? previous.contractIds ?? [] : previous[field],
  ) !== JSON.stringify(
    field === 'contractIds' ? next.contractIds ?? [] : next[field],
  )
));

export const invoiceDocumentChanged = (
  previous: InvoiceDocumentModel,
  next: InvoiceDocumentModel,
) => invoiceDocumentChangedFields(previous, next).length > 0;

export const maskInvoiceAccountValue = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return '待补充';
  if (normalized.includes('@')) {
    const [localPart, domain = ''] = normalized.split('@');
    return `${localPart.slice(0, 1) || '*'}***@${domain}`;
  }
  const compact = normalized.replace(/\s/g, '');
  return `•••• ${compact.slice(-4)}`;
};

const assertStableInvoiceIdentity = (
  record: GeneratedInvoiceRecord,
  payout: Payout,
  snapshot: InvoiceDocumentModel,
) => {
  if (record.sourcePayoutId !== payout.id) {
    throw new Error('生成记录与付款记录的稳定关联不一致。');
  }
  const previous = record.snapshot;
  if (
    snapshot.invoiceNumber !== previous.invoiceNumber
    || snapshot.creatorId !== previous.creatorId
    || snapshot.creatorName !== previous.creatorName
    || snapshot.creatorHandle !== previous.creatorHandle
    || snapshot.engagementId !== previous.engagementId
    || snapshot.projectId !== previous.projectId
    || snapshot.projectName !== previous.projectName
  ) {
    throw new Error('Invoice 编号、达人、项目和稳定 ID 不允许在修改页变更。');
  }
};

const assertInvoiceEditContext = (payout: Payout, context: InvoiceEditContext) => {
  if (context === 'PROJECT_RESOURCE') return;
  const expected = payout.invoiceReviewStatus === '达人反馈'
    ? 'CREATOR_FEEDBACK'
    : payout.invoiceReviewStatus === '待媒介复核'
      ? 'MEDIA_RECHECK'
      : payout.invoiceReviewStatus === '已退回'
        && payout.paymentFailureReturn?.issueType === 'INVOICE_CONTENT'
        ? 'PAYMENT_FAILURE_CONTENT'
        : null;
  if (expected !== context) {
    throw new Error('当前 Invoice 状态与修改入口不一致，不能保存。');
  }
};

export const applyInvoiceDocumentEdit = ({
  record,
  payout,
  snapshot,
  contractMatchReview,
  context,
  actor,
  reason,
  occurredAt = new Date().toISOString(),
}: {
  record: GeneratedInvoiceRecord;
  payout: Payout;
  snapshot: InvoiceDocumentModel;
  contractMatchReview?: InvoiceContractMatchReview;
  context: InvoiceEditContext;
  actor: InvoiceReviewActor;
  reason?: string;
  occurredAt?: string;
}): { record: GeneratedInvoiceRecord; payout: Payout } => {
  assertStableInvoiceIdentity(record, payout, snapshot);
  assertInvoiceEditContext(payout, context);
  const changedFields = invoiceDocumentChangedFields(record.snapshot, snapshot);
  if (!changedFields.length) {
    throw new Error('尚未修改任何 Invoice 字段。');
  }

  const previousVersion = record.version ?? payout.invoiceVersion ?? 1;
  const nextVersion = previousVersion + 1;
  const normalizedReason = reason?.trim()
    || (
      context === 'CREATOR_FEEDBACK'
        ? `根据达人反馈修改：${payout.creatorFeedback?.reason ?? '已处理反馈'}`
        : context === 'PAYMENT_FAILURE_CONTENT'
          ? `处理付款失败退回：${payout.paymentFailureReturn?.reason ?? 'Invoice 内容问题'}`
          : context === 'PROJECT_RESOURCE'
            ? '从请款项目资料管理修改 Invoice'
            : `处理媒介复核：${payout.invoiceReviewReturn?.reason ?? '已修改 Invoice'}`
    );
  const nextSnapshot = {
    ...cloneInvoiceSnapshot(snapshot),
    signatureDate: undefined,
    signatureText: undefined,
  };
  const nextRecord: GeneratedInvoiceRecord = {
    ...record,
    status: '待签署',
    snapshot: nextSnapshot,
    validationStatus: 'valid',
    version: nextVersion,
    revisions: [
      ...(record.revisions ?? []),
      {
        version: previousVersion,
        snapshot: cloneInvoiceSnapshot(record.snapshot),
        changedFields,
        reason: normalizedReason,
        actorAccount: actor.account,
        actorName: actor.name,
        actorRole: actor.role,
        occurredAt,
      },
    ],
    contractMatchReviews: [
      ...(record.contractMatchReviews ?? []),
      ...(contractMatchReview ? [contractMatchReview] : []),
    ],
  };
  const accountValue = nextSnapshot.paymentMethod === 'paypal'
    ? nextSnapshot.payment.paypalEmail || nextSnapshot.payment.paypalUsername
    : nextSnapshot.payment.iban || nextSnapshot.payment.accountNumber;
  const account = maskInvoiceAccountValue(accountValue);
  const event: InvoiceReviewEvent = {
    stage: 'SIGNATURE',
    action: '修改 Invoice',
    actorAccount: actor.account,
    actorName: actor.name,
    actorRole: actor.role,
    fromStatus: payout.invoiceReviewStatus,
    toStatus: '待签署',
    reason: `${normalizedReason}；版本 v${previousVersion} → v${nextVersion}`,
    occurredAt,
  };
  const nextPayout: Payout = {
    ...payout,
    invoice: record.id,
    provider: nextSnapshot.paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex',
    currency: nextSnapshot.currency,
    amount: nextSnapshot.items.reduce((total, item) => total + item.lineTotal, 0),
    account,
    creatorId: nextSnapshot.creatorId,
    payoutAccountId: nextSnapshot.payoutAccountId,
    payoutAccountVersion: nextSnapshot.payoutAccountVersion ?? nextSnapshot.payment.payoutAccountVersion,
    payoutAccountFingerprint: nextSnapshot.payoutAccountFingerprint ?? nextSnapshot.payment.accountFingerprint,
    externalBeneficiaryId: nextSnapshot.payment.externalBeneficiaryId,
    transferMethod: nextSnapshot.payment.transferMethod,
    localClearingSystem: nextSnapshot.payment.localClearingSystem,
    deliverable: nextSnapshot.items.map((item) => item.description).filter(Boolean).join('；'),
    contract: nextSnapshot.contractIds?.join('、') || '未关联合同',
    status: '未进入付款',
    invoiceReviewStatus: '待签署',
    invoiceReviewHistory: [...(payout.invoiceReviewHistory ?? []), event],
    invoiceVersion: nextVersion,
    invoiceSignedAt: undefined,
    creatorFeedback: undefined,
    invoiceReviewReturn: undefined,
    paymentFailure: context === 'PAYMENT_FAILURE_CONTENT' ? undefined : payout.paymentFailure,
    paymentFailureReturn: context === 'PAYMENT_FAILURE_CONTENT'
      ? undefined
      : payout.paymentFailureReturn,
    invoiceSnapshot: nextSnapshot,
    issue: undefined,
    returnReason: undefined,
  };
  return { record: nextRecord, payout: nextPayout };
};

export const replyToCreatorFeedback = (
  payout: Payout,
  actor: InvoiceReviewActor,
  message: string,
  occurredAt = new Date().toISOString(),
): Payout => {
  if (payout.invoiceReviewStatus !== '达人反馈' || !payout.creatorFeedback) {
    throw new Error('当前 Invoice 没有可回复的达人反馈。');
  }
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    throw new Error('回复内容不能为空。');
  }
  const event: InvoiceReviewEvent = {
    stage: 'SIGNATURE',
    action: '回复达人反馈',
    actorAccount: actor.account,
    actorName: actor.name,
    actorRole: actor.role,
    fromStatus: '达人反馈',
    toStatus: '达人反馈',
    reason: normalizedMessage,
    occurredAt,
  };
  return {
    ...payout,
    creatorFeedback: {
      ...payout.creatorFeedback,
      replies: [
        ...(payout.creatorFeedback.replies ?? []),
        {
          message: normalizedMessage,
          actorAccount: actor.account,
          actorName: actor.name,
          actorRole: actor.role,
          occurredAt,
        },
      ],
    },
    invoiceReviewHistory: [...(payout.invoiceReviewHistory ?? []), event],
  };
};

export const recordInvoiceSignatureReminder = (
  payout: Payout,
  actor: InvoiceReviewActor,
  message: string,
  email: string,
  occurredAt = new Date().toISOString(),
): Payout => {
  if (payout.invoiceReviewStatus !== '待签署') {
    throw new Error('只能向待签署 Invoice 发送签署提醒。');
  }
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    throw new Error('提醒内容不能为空。');
  }
  if (normalizedMessage.length > 300) {
    throw new Error('提醒内容不能超过 300 字。');
  }

  const hasValidEmail = notificationEmailIsValid(email);
  const event: InvoiceReviewEvent = {
    stage: 'SIGNATURE',
    action: '通知达人签署',
    actorAccount: actor.account,
    actorName: actor.name,
    actorRole: actor.role,
    fromStatus: '待签署',
    toStatus: '待签署',
    reason: normalizedMessage,
    occurredAt,
    notificationDeliveries: [
      {
        channel: 'IN_APP',
        status: 'SIMULATED_SENT',
        recipientLabel: '达人端 Invoice 消息中心',
      },
      {
        channel: 'EMAIL',
        status: hasValidEmail ? 'SIMULATED_SENT' : 'SKIPPED_MISSING_RECIPIENT',
        recipientLabel: hasValidEmail
          ? maskNotificationEmail(email)
          : '达人档案邮箱待补充',
      },
    ],
  };

  return {
    ...payout,
    invoiceReviewHistory: [...(payout.invoiceReviewHistory ?? []), event],
  };
};

export const markGeneratedInvoiceSigned = (
  payout: Payout,
  record: GeneratedInvoiceRecord,
  actor: InvoiceReviewActor,
  occurredAt = new Date().toISOString(),
): Payout => {
  if (record.sourcePayoutId !== payout.id) {
    throw new Error('生成记录与付款记录的稳定关联不一致。');
  }
  const event = createInvoiceReviewEvent(payout, 'MARK_SIGNED', actor, undefined, occurredAt);
  const signedSnapshot = {
    ...record.snapshot,
    signatureDate: signatureDateFromOccurredAt(occurredAt),
    signatureText: buildMockElectronicSignature(record.snapshot.creatorName),
  };
  return {
    ...payout,
    invoice: record.id,
    invoiceSnapshot: signedSnapshot,
    status: '未进入付款',
    invoiceReviewStatus: event.toStatus,
    invoiceReviewHistory: [...(payout.invoiceReviewHistory ?? []), event],
    invoiceVersion: record.version ?? payout.invoiceVersion ?? 1,
    invoiceSignatureRound: (payout.invoiceSignatureRound ?? 0) + 1,
    invoiceSignedAt: occurredAt,
    creatorFeedback: undefined,
    invoiceReviewReturn: undefined,
    issue: undefined,
    returnReason: undefined,
  };
};

export const invalidateSignedInvoice = (
  payout: Payout,
  actor: InvoiceReviewActor,
  occurredAt = new Date().toISOString(),
): Payout => {
  if (payout.invoiceReviewStatus !== '待媒介复核') return payout;
  const event: InvoiceReviewEvent = {
    stage: 'SIGNATURE',
    action: '签署失效',
    actorAccount: actor.account,
    actorName: actor.name,
    actorRole: actor.role,
    fromStatus: '待媒介复核',
    toStatus: '待签署',
    reason: '复核期间修改了影响签署效力的 Invoice 字段。',
    occurredAt,
  };
  return {
    ...payout,
    status: '未进入付款',
    invoiceReviewStatus: '待签署',
    invoiceReviewHistory: [...(payout.invoiceReviewHistory ?? []), event],
    invoiceVersion: (payout.invoiceVersion ?? 1) + 1,
    invoiceSignedAt: undefined,
    invoiceSnapshot: payout.invoiceSnapshot
      ? { ...payout.invoiceSnapshot, signatureDate: undefined, signatureText: undefined }
      : undefined,
    issue: event.reason,
  };
};

export const sensitiveInvoiceSnapshotChanged = (
  previous: GeneratedInvoiceRecord,
  next: GeneratedInvoiceRecord,
) => {
  const project = (record: GeneratedInvoiceRecord) => ({
    billTo: record.snapshot.billTo,
    from: record.snapshot.from,
    currency: record.snapshot.currency,
    items: record.snapshot.items,
    payoutAccountId: record.snapshot.payoutAccountId,
    paymentMethod: record.snapshot.paymentMethod,
    payment: record.snapshot.payment,
    contractIds: record.snapshot.contractIds,
  });
  return JSON.stringify(project(previous)) !== JSON.stringify(project(next));
};

export const isInvoiceApprovedForPayment = (
  payout: Pick<Payout, 'invoiceReviewStatus'>,
) => payout.invoiceReviewStatus === '已通过';

export const isPayoutPaymentInformationValidated = (
  payout: Pick<
    Payout,
    | 'account'
    | 'invoiceReviewStatus'
    | 'paymentListRequiresRevalidation'
    | 'paymentListValidationIssues'
  >,
) => (
  isInvoiceApprovedForPayment(payout)
  && Boolean(payout.account.trim())
  && payout.account !== '待补充'
  && !payout.paymentListRequiresRevalidation
  && !(payout.paymentListValidationIssues?.length)
);

export const isPayoutEligibleForBatch = (
  payout: Pick<Payout, 'invoiceReviewStatus' | 'status'>,
) => isInvoiceApprovedForPayment(payout) && payout.status === '等待付款';

export const paymentFailureRestartStage = (issueType: PaymentFailureIssueType) => (
  issueType === 'INVOICE_CONTENT' ? 'SIGNATURE' : 'PAYMENT_LIST_RESUBMISSION'
);

export type PaymentListResubmissionState = 'NOT_RETURNED' | 'ELIGIBLE' | 'INVALID';

export const getPaymentListResubmissionState = (
  payouts: Array<Payout | undefined>,
): PaymentListResubmissionState => {
  const hasPaymentListReturn = payouts.some((payout) => (
    payout?.invoiceReviewStatus === '已退回'
    && payout.paymentFailureReturn?.issueType === 'PAYMENT_LIST'
  ));
  if (!hasPaymentListReturn) return 'NOT_RETURNED';
  return payouts.every((payout) => (
    Boolean(payout)
    && (
      payout?.paymentFailureReturn?.issueType === 'PAYMENT_LIST'
      || payout?.invoiceReviewStatus === '已通过'
    )
  ))
    ? 'ELIGIBLE'
    : 'INVALID';
};
