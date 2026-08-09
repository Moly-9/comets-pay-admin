import type { SystemUser } from './data';
import type {
  AirwallexTransferMethod,
  DocumentPayoutSnapshot,
  GeneratedInvoiceRecord,
  InvoiceCurrency,
  Payout,
  PayoutAccountVersion,
  PayoutAccountStatus,
} from './types';

declare const entityIdBrand: unique symbol;

export type EntityId<T extends string> = string & { readonly [entityIdBrand]: T };
export type CooperationProjectId = EntityId<'cooperation-project'>;
export type PaymentRequestProjectId = EntityId<'payment-request-project'>;
/** @deprecated Use CooperationProjectId for contracts, invoices and collaborations. */
export type ProjectId = CooperationProjectId;
export type CreatorId = EntityId<'creator'>;
export type EngagementId = EntityId<'engagement'>;
export type ContractId = EntityId<'contract'>;
export type InvoiceId = EntityId<'invoice'>;
export type PaymentListId = EntityId<'payment-list'>;

export type ProjectReviewStatus =
  | 'draft'
  | 'submitted'
  | 'returned'
  | 'approved'
  | 'changes_required';

export type RequestApprovalStatus =
  | 'PENDING_PM'
  | 'PENDING_PROJECT_OWNER'
  | 'PENDING_OWNER'
  | 'PENDING_FINANCE'
  | 'APPROVED'
  | 'RETURNED_TO_MEDIA_REVIEW';

export type RequestApprovalStage = 'PM' | 'PROJECT_OWNER' | 'OWNER' | 'FINANCE';

export type RequestApprovalEvent = {
  round: number;
  stage: RequestApprovalStage;
  action: 'APPROVE' | 'RETURN';
  actorAccount: string;
  actorName: string;
  actorRole: string;
  fromStatus: RequestApprovalStatus;
  toStatus: RequestApprovalStatus;
  reason?: string;
  occurredAt: string;
};

export type RequestApprovalState = {
  status: RequestApprovalStatus;
  round: number;
  history: RequestApprovalEvent[];
  submittedAt: string;
  returnedFromStage?: RequestApprovalStage;
  resumeStatus?: Exclude<RequestApprovalStatus, 'APPROVED' | 'RETURNED_TO_MEDIA_REVIEW'>;
  returnReason?: string;
  updatedAt: string;
};

export type ProjectEngagement = {
  engagementId: EngagementId;
  cooperationProjectId: CooperationProjectId;
  creatorId: CreatorId;
  status: 'active' | 'removed';
  createdAt: string;
  updatedAt: string;
};

export type PaymentListItemSnapshot = {
  invoiceNumber: string;
  creatorName: string;
  currency: string;
  receiveCurrency: string;
  amount: number;
  provider: string;
  accountSummary: string;
  paymentReason: string;
  transactionReference: string;
  description: string;
  creatorId?: CreatorId;
  contractIds?: ContractId[];
  payoutAccountId?: string;
  payoutAccountVersion?: PayoutAccountVersion;
  externalBeneficiaryId?: string;
  providerAccountScope?: string;
  transferMethod?: AirwallexTransferMethod | 'PAYPAL';
  localClearingSystem?: string;
  feeBearer?: 'ADVERTISER' | 'PUBLISHER' | 'SHARED' | '';
  accountFingerprint?: string;
  schemaKey?: string;
  validationStatus?: PayoutAccountStatus;
  transferNote?: string;
};

export type PaymentListEditableField =
  | 'currency'
  | 'receiveCurrency'
  | 'amount'
  | 'feeBearer'
  | 'paymentReason'
  | 'transactionReference'
  | 'description';

export type PaymentListAccountSnapshot = Pick<
  PaymentListItemSnapshot,
  | 'provider'
  | 'accountSummary'
  | 'receiveCurrency'
  | 'payoutAccountId'
  | 'payoutAccountVersion'
  | 'externalBeneficiaryId'
  | 'providerAccountScope'
  | 'transferMethod'
  | 'localClearingSystem'
  | 'accountFingerprint'
  | 'schemaKey'
  | 'validationStatus'
  | 'transferNote'
>;

export type PaymentListItem = {
  id: string;
  engagementId: EngagementId;
  invoiceId: InvoiceId;
  snapshot: PaymentListItemSnapshot;
  accountOverride?: PaymentListAccountSnapshot;
  overrides: Partial<Pick<PaymentListItemSnapshot, PaymentListEditableField>>;
  requiresRevalidation?: boolean;
  validationIssues?: string[];
  lastValidatedAt?: string;
};

export type PaymentListStatus = 'draft' | 'generated' | 'submitted' | 'approved' | 'paid';
export type PaymentListProvider = 'Airwallex' | 'PayPal';

export type PaymentListActor = {
  account: string;
  name: string;
  role: string;
};

export type PaymentListVersionSnapshot = {
  version: number;
  generatedAt: string;
  generatedBy: PaymentListActor;
  items: PaymentListItem[];
};

export type PaymentListRecord = {
  paymentListId: PaymentListId;
  paymentListCode: string;
  projectId: ProjectId;
  paymentRequestProjectId?: PaymentRequestProjectId;
  provider: PaymentListProvider;
  status: PaymentListStatus;
  version?: number;
  generatedAt?: string;
  generatedBy?: PaymentListActor;
  versions?: PaymentListVersionSnapshot[];
  draftFromVersion?: number;
  items: PaymentListItem[];
  createdAt: string;
  updatedAt: string;
};

export type PaymentListGenerationIssueCode =
  | 'NO_ITEMS'
  | 'UNSUPPORTED_PROVIDER'
  | 'MISSING_INVOICE'
  | 'UNKNOWN_INVOICE'
  | 'DUPLICATE_INVOICE'
  | 'INVALID_ITEM';

export type PaymentListGenerationIssue = {
  code: PaymentListGenerationIssueCode;
  message: string;
  invoiceId?: InvoiceId;
};

export type WorkflowAuditAction =
  | 'create'
  | 'update'
  | 'link'
  | 'unlink'
  | 'delete'
  | 'submit'
  | 'return'
  | 'approve';

export type WorkflowAuditEvent = {
  id: string;
  projectId: ProjectId;
  paymentRequestProjectId?: PaymentRequestProjectId;
  creatorId?: CreatorId;
  engagementId?: EngagementId;
  entityType: 'project' | 'contract' | 'invoice' | 'payment-list';
  entityId: string;
  action: WorkflowAuditAction;
  actor: string;
  occurredAt: string;
  summary: string;
};

const PROTOTYPE_ID_PREFIXES = {
  project: 'prj',
  'cooperation-project': 'cpr',
  'request-project': 'req',
  creator: 'crt',
  engagement: 'col',
  contract: 'con',
  invoice: 'inv',
  payout: 'payout',
  'payout-account': 'pac',
  batch: 'bat',
  'payment-list': 'pay',
  audit: 'audit',
  item: 'item',
} as const;

type PrototypeIdKind = keyof typeof PROTOTYPE_ID_PREFIXES;

const cryptoUuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new Error('当前浏览器不支持安全的本地请求 ID，请升级浏览器后重试。');
};

/**
 * 纯前端原型没有后端 UUIDv7 服务。这里生成的 ID 仅用于本次浏览器会话，
 * 由未来后端实体 ID 替换，不作为符合 ID_STANDARD 的正式业务 ID。
 */
export const createPrototypeId = <T extends PrototypeIdKind>(kind: T) => (
  `${PROTOTYPE_ID_PREFIXES[kind]}_local_${cryptoUuid()}`
);

const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const randomCodePart = (length: number) => {
  const values = new Uint8Array(length);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('');
};

export const createPrototypeCode = (prefix: 'PRJ' | 'CON' | 'INV' | 'PAY' | 'REQ' | 'BAT', now = new Date()) => {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${randomCodePart(6)}`;
};

export const nowIso = () => new Date().toISOString();

export const canEditProject = (
  user: Pick<SystemUser, 'roleKey'>,
  reviewStatus: ProjectReviewStatus,
) => {
  if (user.roleKey === 'admin' || user.roleKey === 'owner') return true;
  return user.roleKey === 'media'
    && ['draft', 'returned', 'changes_required'].includes(reviewStatus);
};

export const nextReviewStatusAfterMutation = (
  user: Pick<SystemUser, 'roleKey'>,
  reviewStatus: ProjectReviewStatus,
): ProjectReviewStatus => (
  (user.roleKey === 'admin' || user.roleKey === 'owner')
  && (reviewStatus === 'submitted' || reviewStatus === 'approved')
    ? 'changes_required'
    : reviewStatus
);

export const getPaymentListAccess = (
  user: Pick<SystemUser, 'roleKey'>,
  reviewStatus: ProjectReviewStatus,
  paymentListStatus: PaymentListStatus | null,
) => {
  const privileged = user.roleKey === 'admin' || user.roleKey === 'owner';
  const projectEditable = canEditProject(user, reviewStatus);
  const historical = Boolean(
    paymentListStatus && ['submitted', 'approved', 'paid'].includes(paymentListStatus),
  );
  return {
    privileged,
    historical,
    canEditFields: projectEditable && paymentListStatus === 'draft',
    canReopen: projectEditable && paymentListStatus === 'generated',
    canCreateVersion: privileged && historical,
  };
};

export const createAuditEvent = ({
  projectId,
  paymentRequestProjectId,
  creatorId,
  engagementId,
  entityType,
  entityId,
  action,
  actor,
  summary,
}: Omit<WorkflowAuditEvent, 'id' | 'occurredAt'>): WorkflowAuditEvent => ({
  id: createPrototypeId('audit'),
  projectId,
  paymentRequestProjectId,
  creatorId,
  engagementId,
  entityType,
  entityId,
  action,
  actor,
  occurredAt: nowIso(),
  summary,
});

export const paymentListEffectiveAccount = (
  item: PaymentListItem,
): PaymentListItemSnapshot => ({
  ...item.snapshot,
  ...(item.accountOverride ?? {}),
});

export const paymentListItemValue = <K extends keyof PaymentListItemSnapshot>(
  item: PaymentListItem,
  key: K,
) => (
  (item.overrides as Partial<PaymentListItemSnapshot>)[key]
  ?? (item.accountOverride as Partial<PaymentListItemSnapshot> | undefined)?.[key]
  ?? item.snapshot[key]
) as PaymentListItemSnapshot[K];

export const upsertPaymentListItem = (
  list: PaymentListRecord,
  item: PaymentListItem,
): PaymentListRecord => {
  if (list.items.some((current) => current.invoiceId === item.invoiceId)) return list;
  return { ...list, items: [...list.items, item], updatedAt: nowIso() };
};

export const invoicePaymentListProvider = (
  invoice: GeneratedInvoiceRecord,
): PaymentListProvider => (
  invoice.snapshot.payoutProvider === 'PayPal'
  || invoice.snapshot.payment.payoutProvider === 'PayPal'
  || invoice.snapshot.paymentMethod === 'paypal'
    ? 'PayPal'
    : 'Airwallex'
);

export const removePaymentListItem = (
  list: PaymentListRecord,
  invoiceId: InvoiceId,
): PaymentListRecord => ({
  ...list,
  items: list.items.filter((item) => item.invoiceId !== invoiceId),
  updatedAt: nowIso(),
});

export const clearPaymentListItems = (
  list: PaymentListRecord,
  clearedAt = nowIso(),
): PaymentListRecord => ({
  ...list,
  status: 'draft',
  draftFromVersion: list.version,
  items: [],
  updatedAt: clearedAt,
});

export const refreshPaymentListItemSnapshot = (
  list: PaymentListRecord,
  refreshedItem: PaymentListItem,
  updatedAt = nowIso(),
): PaymentListRecord => ({
  ...list,
  items: list.items.map((item) => (
    item.invoiceId === refreshedItem.invoiceId
      ? (() => {
          const previousEffectiveAccount = paymentListEffectiveAccount(item);
          const nextItem = {
            ...item,
            engagementId: refreshedItem.engagementId,
            snapshot: { ...refreshedItem.snapshot },
            accountOverride: item.accountOverride ? { ...item.accountOverride } : undefined,
            overrides: { ...item.overrides },
          };
          const nextEffectiveAccount = paymentListEffectiveAccount(nextItem);
          const previousAccountKey = [
            previousEffectiveAccount.payoutAccountId ?? '',
            previousEffectiveAccount.payoutAccountVersion ?? 'legacy-v1',
            previousEffectiveAccount.accountFingerprint ?? '',
          ].join(':');
          const nextAccountKey = [
            nextEffectiveAccount.payoutAccountId ?? '',
            nextEffectiveAccount.payoutAccountVersion ?? 'legacy-v1',
            nextEffectiveAccount.accountFingerprint ?? '',
          ].join(':');
          const accountVersionChanged = previousAccountKey !== nextAccountKey;
          return {
            ...nextItem,
            requiresRevalidation: accountVersionChanged || refreshedItem.requiresRevalidation,
            validationIssues: [
              ...(accountVersionChanged ? ['Invoice 账户版本已变化，付款清单必须重新校验'] : []),
              ...(refreshedItem.validationIssues ?? []),
            ],
          };
        })()
      : item
  )),
  updatedAt,
});

export type PaymentListContractReference = {
  contractId?: ContractId | string;
  id: string;
  feeBearer: 'ADVERTISER' | 'PUBLISHER' | 'SHARED' | '';
};

const maskPaymentAccount = (value: string) => {
  const normalized = value.replace(/\s/g, '');
  return normalized ? `•••• ${normalized.slice(-4)}` : '';
};

const paymentListItemValidationIssues = (item: PaymentListItem) => {
  const snapshot = paymentListEffectiveAccount(item);
  const provider = snapshot.provider;
  const currency = String(paymentListItemValue(item, 'currency'));
  const receiveCurrency = String(paymentListItemValue(item, 'receiveCurrency'));
  const amount = Number(paymentListItemValue(item, 'amount'));
  const feeBearer = String(paymentListItemValue(item, 'feeBearer'));
  const paymentReason = String(paymentListItemValue(item, 'paymentReason'));
  const transactionReference = String(paymentListItemValue(item, 'transactionReference'));
  return [
    !snapshot.creatorId ? 'Invoice 缺少 creatorId' : '',
    !snapshot.payoutAccountId ? 'Invoice 缺少 payoutAccountId' : '',
    !snapshot.accountFingerprint ? 'Invoice 缺少账户快照指纹' : '',
    !currency ? '付款清单缺少支付币种' : '',
    !receiveCurrency ? '付款清单缺少收款币种' : '',
    !(amount > 0) ? '付款清单金额必须大于 0' : '',
    !provider ? '付款渠道未填写' : '',
    provider === 'Airwallex' && !snapshot.externalBeneficiaryId ? 'Airwallex 账户缺少 beneficiary_id' : '',
    provider === 'Airwallex' && !snapshot.transferMethod ? 'Airwallex 账户缺少转账方式' : '',
    provider === 'Airwallex' && snapshot.transferMethod === 'LOCAL' && !snapshot.localClearingSystem
      ? 'LOCAL 账户缺少本地清算方式'
      : '',
    provider === 'Airwallex' && !snapshot.schemaKey ? 'Airwallex 账户缺少 Form Schema 场景' : '',
    !feeBearer ? '手续费承担方未确认' : '',
    !paymentReason ? '付款原因未填写' : '',
    !transactionReference ? '交易附言未填写' : '',
    !snapshot.validationStatus ? '账户快照缺少校验状态' : '',
    snapshot.validationStatus && !['VALIDATED', 'VERIFIED'].includes(snapshot.validationStatus)
      ? '账户快照未通过验证'
      : '',
  ].filter(Boolean);
};

const clonePaymentListItems = (items: PaymentListItem[]) => items.map((item) => ({
  ...item,
  snapshot: {
    ...item.snapshot,
    contractIds: item.snapshot.contractIds ? [...item.snapshot.contractIds] : undefined,
  },
  accountOverride: item.accountOverride ? { ...item.accountOverride } : undefined,
  overrides: { ...item.overrides },
  validationIssues: item.validationIssues ? [...item.validationIssues] : undefined,
}));

export const validatePaymentListGeneration = (
  list: PaymentListRecord,
  expectedInvoiceIds: InvoiceId[],
): PaymentListGenerationIssue[] => {
  const issues: PaymentListGenerationIssue[] = [];
  const itemCounts = list.items.reduce<Map<InvoiceId, number>>((counts, item) => {
    counts.set(item.invoiceId, (counts.get(item.invoiceId) ?? 0) + 1);
    return counts;
  }, new Map());

  if (!list.items.length) {
    issues.push({ code: 'NO_ITEMS', message: '付款清单至少需要一笔 Invoice。' });
  }
  list.items.forEach((item) => {
    const effectiveAccount = paymentListEffectiveAccount(item);
    if (effectiveAccount.provider !== 'Airwallex') {
      issues.push({
        code: 'UNSUPPORTED_PROVIDER',
        invoiceId: item.invoiceId,
        message: `${item.snapshot.creatorName} 当前选择 ${effectiveAccount.provider || '未指定渠道'}，付款单仅支持 Airwallex。`,
      });
    }
  });
  expectedInvoiceIds.forEach((invoiceId) => {
    if (!itemCounts.has(invoiceId)) {
      issues.push({
        code: 'MISSING_INVOICE',
        invoiceId,
        message: `付款清单未覆盖项目 Invoice ${invoiceId}。`,
      });
    }
  });
  list.items.forEach((item) => {
    if (!expectedInvoiceIds.includes(item.invoiceId)) {
      issues.push({
        code: 'UNKNOWN_INVOICE',
        invoiceId: item.invoiceId,
        message: `${item.snapshot.invoiceNumber} 不属于当前项目，不能进入付款单。`,
      });
    }
    if ((itemCounts.get(item.invoiceId) ?? 0) > 1) {
      issues.push({
        code: 'DUPLICATE_INVOICE',
        invoiceId: item.invoiceId,
        message: `${item.snapshot.invoiceNumber} 在付款清单中重复出现。`,
      });
    }
    const itemIssues = [
      ...(item.requiresRevalidation ? item.validationIssues ?? ['付款行需要重新校验'] : []),
      ...paymentListItemValidationIssues(item),
    ];
    [...new Set(itemIssues)].forEach((message) => issues.push({
      code: 'INVALID_ITEM',
      invoiceId: item.invoiceId,
      message: `${item.snapshot.invoiceNumber}：${message}`,
    }));
  });

  return issues.filter((issue, index, all) => (
    all.findIndex((candidate) => (
      candidate.code === issue.code
      && candidate.invoiceId === issue.invoiceId
      && candidate.message === issue.message
    )) === index
  ));
};

export const generatePaymentListVersion = ({
  list,
  expectedInvoiceIds,
  actor,
  generatedAt = nowIso(),
}: {
  list: PaymentListRecord;
  expectedInvoiceIds: InvoiceId[];
  actor: PaymentListActor;
  generatedAt?: string;
}): { record: PaymentListRecord; issues: PaymentListGenerationIssue[] } => {
  const issues = validatePaymentListGeneration(list, expectedInvoiceIds);
  if (issues.length) return { record: list, issues };

  const version = (list.version ?? 0) + 1;
  const snapshot: PaymentListVersionSnapshot = {
    version,
    generatedAt,
    generatedBy: { ...actor },
    items: clonePaymentListItems(list.items),
  };
  return {
    issues: [],
    record: {
      ...list,
      status: 'generated',
      version,
      generatedAt,
      generatedBy: { ...actor },
      draftFromVersion: undefined,
      items: clonePaymentListItems(list.items),
      versions: [...(list.versions ?? []), snapshot],
      updatedAt: generatedAt,
    },
  };
};

export const beginPaymentListEdit = (
  list: PaymentListRecord,
  editedAt = nowIso(),
): PaymentListRecord => ({
  ...list,
  status: 'draft',
  draftFromVersion: list.version,
  updatedAt: editedAt,
});

export type PaymentListAccountState = {
  payoutAccountId: string;
  payoutAccountVersion: PayoutAccountVersion;
  accountFingerprint: string;
  provider: string;
  externalBeneficiaryId?: string;
  validationStatus: PayoutAccountStatus;
};

export const revalidatePaymentListItem = (
  item: PaymentListItem,
  validatedAt = nowIso(),
  currentAccount?: PaymentListAccountState | null,
): PaymentListItem => {
  const effectiveAccount = paymentListEffectiveAccount(item);
  const validationIssues = [
    ...paymentListItemValidationIssues(item),
    ...(currentAccount === null ? ['达人档案中未找到付款清单关联的收款账户'] : []),
    ...(currentAccount && currentAccount.payoutAccountId !== effectiveAccount.payoutAccountId
      ? ['收款账户 ID 与付款清单快照不一致']
      : []),
    ...(currentAccount && currentAccount.payoutAccountVersion !== effectiveAccount.payoutAccountVersion
      ? ['收款账户版本已变化']
      : []),
    ...(currentAccount && currentAccount.accountFingerprint !== effectiveAccount.accountFingerprint
      ? ['收款账户资料已变化']
      : []),
    ...(currentAccount && currentAccount.provider !== effectiveAccount.provider
      ? ['收款账户渠道与付款清单不一致']
      : []),
    ...(currentAccount && currentAccount.externalBeneficiaryId !== effectiveAccount.externalBeneficiaryId
      ? ['Airwallex beneficiary_id 已变化']
      : []),
    ...(currentAccount && !['VALIDATED', 'VERIFIED'].includes(currentAccount.validationStatus)
      ? ['达人档案中的收款账户未通过验证']
      : []),
  ];
  return {
    ...item,
    requiresRevalidation: validationIssues.length > 0,
    validationIssues,
    lastValidatedAt: validatedAt,
  };
};

export const applyPaymentListPayoutSnapshot = (
  item: PaymentListItem,
  payment: DocumentPayoutSnapshot,
): PaymentListItem => {
  const provider = payment.payoutProvider
    ?? (payment.transferMethod === 'PAYPAL' ? 'PayPal' : 'Airwallex');
  const rawAccount = provider === 'PayPal'
    ? payment.paypalEmail || payment.paypalUsername
    : payment.iban || payment.accountNumber;
  const { receiveCurrency: _receiveCurrency, ...overrides } = item.overrides;
  return {
    ...item,
    accountOverride: {
      provider,
      accountSummary: rawAccount
        ? maskPaymentAccount(rawAccount)
        : provider === 'PayPal'
          ? '待补充 PayPal'
          : '待补充银行账户',
      receiveCurrency: payment.accountCurrency || item.snapshot.currency,
      payoutAccountId: payment.payoutAccountId,
      payoutAccountVersion: payment.payoutAccountVersion ?? 'legacy-v1',
      externalBeneficiaryId: payment.externalBeneficiaryId,
      providerAccountScope: payment.providerAccountScope,
      transferMethod: payment.transferMethod,
      localClearingSystem: payment.localClearingSystem,
      accountFingerprint: payment.accountFingerprint,
      schemaKey: payment.schemaKey,
      validationStatus: payment.validationStatus,
      transferNote: payment.transferRemarks,
    },
    overrides,
    requiresRevalidation: true,
    validationIssues: ['收款账户已更新，请重新校验付款清单'],
  };
};

export const invoicePaymentListItem = (
  invoice: GeneratedInvoiceRecord,
  contracts: PaymentListContractReference[] = [],
): PaymentListItem => {
  const payment = invoice.snapshot.payment;
  const provider = invoice.snapshot.payoutProvider
    ?? payment.payoutProvider
    ?? (invoice.snapshot.paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex');
  const rawAccount = invoice.snapshot.paymentMethod === 'paypal'
    ? payment.paypalEmail || payment.paypalUsername
    : payment.iban || payment.accountNumber;
  const contractReferences = contracts.filter((contract) => (
    invoice.snapshot.contractIds?.some((contractId) => (
      contract.contractId === contractId || contract.id === contractId
    ))
  ));
  const feeBearers = [...new Set(contractReferences.map((contract) => contract.feeBearer).filter(Boolean))];
  const feeBearer = feeBearers.length === 1 ? feeBearers[0] : '';
  const payoutAccountId = invoice.snapshot.payoutAccountId ?? payment.payoutAccountId;
  const payoutAccountVersion = invoice.snapshot.payoutAccountVersion
    ?? payment.payoutAccountVersion
    ?? 'legacy-v1';
  const accountFingerprint = invoice.snapshot.payoutAccountFingerprint
    ?? payment.accountFingerprint;
  const item: PaymentListItem = {
    id: createPrototypeId('item'),
    engagementId: invoice.snapshot.engagementId as EngagementId,
    invoiceId: invoice.invoiceId,
    snapshot: {
      invoiceNumber: invoice.id,
      creatorName: invoice.snapshot.creatorName,
      currency: invoice.snapshot.currency,
      receiveCurrency: payment.accountCurrency || invoice.snapshot.currency,
      amount: invoice.snapshot.items.reduce((total, item) => total + item.lineTotal, 0),
      provider,
      accountSummary: rawAccount
        ? maskPaymentAccount(rawAccount)
        : invoice.snapshot.paymentMethod === 'paypal'
          ? '待补充 PayPal'
          : '待补充银行账户',
      paymentReason: '影音服务',
      transactionReference: '',
      description: '',
      creatorId: invoice.snapshot.creatorId,
      contractIds: invoice.snapshot.contractIds ? [...invoice.snapshot.contractIds] : [],
      payoutAccountId,
      payoutAccountVersion,
      externalBeneficiaryId: payment.externalBeneficiaryId,
      providerAccountScope: payment.providerAccountScope,
      transferMethod: payment.transferMethod,
      localClearingSystem: payment.localClearingSystem,
      feeBearer,
      accountFingerprint,
      schemaKey: payment.schemaKey,
      validationStatus: payment.validationStatus,
      transferNote: payment.transferRemarks,
    },
    overrides: {},
  };
  return revalidatePaymentListItem(item);
};

export const payoutWithPaymentListSnapshot = (
  payout: Payout,
  item: PaymentListItem,
): Payout => {
  const effectiveAccount = paymentListEffectiveAccount(item);
  const provider = effectiveAccount.provider;
  const currency = String(paymentListItemValue(item, 'currency'));
  return {
    ...payout,
    creatorId: item.snapshot.creatorId,
    provider: ['Airwallex', 'PayPal', 'PayMax'].includes(provider)
      ? provider as Payout['provider']
      : payout.provider,
    currency: currency as InvoiceCurrency,
    amount: Number(paymentListItemValue(item, 'amount')),
    account: effectiveAccount.accountSummary,
    payoutAccountId: effectiveAccount.payoutAccountId,
    payoutAccountVersion: effectiveAccount.payoutAccountVersion ?? 'legacy-v1',
    payoutAccountFingerprint: effectiveAccount.accountFingerprint,
    externalBeneficiaryId: effectiveAccount.externalBeneficiaryId,
    transferMethod: effectiveAccount.transferMethod,
    localClearingSystem: effectiveAccount.localClearingSystem,
    feeBearer: paymentListItemValue(item, 'feeBearer'),
    paymentListRequiresRevalidation: item.requiresRevalidation,
    paymentListValidationIssues: [...(item.validationIssues ?? [])],
  };
};

export type ContractCoverageInput = {
  contractId: ContractId;
  advertiser: string;
  publisher: string;
  currency: string;
  totalFee: number | null;
  paymentMethod: string;
};

export type InvoiceCoverageInput = {
  billTo: string;
  publisher: string;
  currency: string;
  amount: number;
  paymentMethod: string;
};

export type EngagementInvoiceReference = {
  invoiceId: InvoiceId;
  engagementId?: EngagementId;
  validationStatus?: 'valid' | 'needs_review';
};

export const hasInvoiceForEngagement = (
  invoices: EngagementInvoiceReference[],
  engagementId: EngagementId | '',
  excludeInvoiceId?: InvoiceId,
) => Boolean(engagementId) && invoices.some((invoice) => (
  invoice.engagementId === engagementId
  && invoice.invoiceId !== excludeInvoiceId
));

export type ProjectSubmissionIssue =
  | 'NO_ENGAGEMENT'
  | 'INVOICE_COUNT'
  | 'PAYMENT_LIST_MISSING'
  | 'INVOICE_NEEDS_REVIEW';

export const validateProjectSubmission = ({
  engagementIds,
  invoices,
  paymentListInvoiceIds,
}: {
  engagementIds: EngagementId[];
  invoices: EngagementInvoiceReference[];
  paymentListInvoiceIds: InvoiceId[] | null;
}): ProjectSubmissionIssue[] => {
  const issues: ProjectSubmissionIssue[] = [];
  if (!engagementIds.length) issues.push('NO_ENGAGEMENT');
  if (engagementIds.some((engagementId) => (
    invoices.filter((invoice) => invoice.engagementId === engagementId).length !== 1
  ))) {
    issues.push('INVOICE_COUNT');
  }
  if (
    !paymentListInvoiceIds
    || invoices.some((invoice) => !paymentListInvoiceIds.includes(invoice.invoiceId))
  ) {
    issues.push('PAYMENT_LIST_MISSING');
  }
  if (invoices.some((invoice) => invoice.validationStatus !== 'valid')) {
    issues.push('INVOICE_NEEDS_REVIEW');
  }
  return issues;
};

export type CoverageValidationIssue = {
  field: 'advertiser' | 'publisher' | 'currency' | 'amount' | 'paymentMethod';
  message: string;
};

export const validateContractCoverage = (
  contracts: ContractCoverageInput[],
  invoice: InvoiceCoverageInput,
): CoverageValidationIssue[] => {
  if (!contracts.length) return [];
  const issues: CoverageValidationIssue[] = [];
  const advertisers = new Set(contracts.map((contract) => contract.advertiser).filter(Boolean));
  const publishers = new Set(contracts.map((contract) => contract.publisher).filter(Boolean));
  const currencies = new Set(contracts.map((contract) => contract.currency).filter(Boolean));
  const paymentMethods = new Set(contracts.map((contract) => contract.paymentMethod).filter(Boolean));
  const amount = contracts.reduce((total, contract) => total + (contract.totalFee ?? 0), 0);

  if (advertisers.size !== 1 || !advertisers.has(invoice.billTo)) {
    issues.push({ field: 'advertiser', message: '所选合同的 Advertiser 与 Invoice Bill To 不一致。' });
  }
  if (publishers.size !== 1 || !publishers.has(invoice.publisher)) {
    issues.push({ field: 'publisher', message: '所选合同的 Publisher 与 Invoice From 不一致。' });
  }
  if (currencies.size !== 1 || !currencies.has(invoice.currency)) {
    issues.push({ field: 'currency', message: '所选合同币种不一致，或与 Invoice 币种不一致。' });
  }
  if (amount !== invoice.amount) {
    issues.push({ field: 'amount', message: `Invoice 总额应等于所选合同合计金额 ${amount.toLocaleString('en-US')}。` });
  }
  if (paymentMethods.size !== 1 || !paymentMethods.has(invoice.paymentMethod)) {
    issues.push({ field: 'paymentMethod', message: '所选合同付款方式不一致，或与 Invoice 收款方式不一致。' });
  }
  return issues;
};

export const projectReviewStatusLabel: Record<ProjectReviewStatus, string> = {
  draft: '草稿',
  submitted: '已提交审核',
  returned: '已退回',
  approved: '已通过',
  changes_required: '资料已变更',
};
