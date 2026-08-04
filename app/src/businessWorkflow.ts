import type { SystemUser } from './data';

declare const entityIdBrand: unique symbol;

export type EntityId<T extends string> = string & { readonly [entityIdBrand]: T };
export type ProjectId = EntityId<'project'>;
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

export type ProjectEngagement = {
  engagementId: EngagementId;
  projectId: ProjectId;
  creatorId: CreatorId;
  status: 'active' | 'removed';
  createdAt: string;
  updatedAt: string;
};

export type PaymentListItemSnapshot = {
  invoiceNumber: string;
  creatorName: string;
  currency: string;
  amount: number;
  provider: string;
  accountSummary: string;
};

export type PaymentListItem = {
  id: string;
  engagementId: EngagementId;
  invoiceId: InvoiceId;
  snapshot: PaymentListItemSnapshot;
  overrides: Partial<Pick<PaymentListItemSnapshot, 'currency' | 'amount' | 'provider' | 'accountSummary'>>;
};

export type PaymentListRecord = {
  paymentListId: PaymentListId;
  paymentListCode: string;
  projectId: ProjectId;
  status: 'draft' | 'submitted' | 'approved';
  items: PaymentListItem[];
  createdAt: string;
  updatedAt: string;
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
  creator: 'crt',
  engagement: 'col',
  contract: 'con',
  invoice: 'inv',
  payout: 'payout',
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

export const createPrototypeCode = (prefix: 'PRJ' | 'CON' | 'INV' | 'PAY' | 'REQ', now = new Date()) => {
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

export const createAuditEvent = ({
  projectId,
  engagementId,
  entityType,
  entityId,
  action,
  actor,
  summary,
}: Omit<WorkflowAuditEvent, 'id' | 'occurredAt'>): WorkflowAuditEvent => ({
  id: createPrototypeId('audit'),
  projectId,
  engagementId,
  entityType,
  entityId,
  action,
  actor,
  occurredAt: nowIso(),
  summary,
});

export const paymentListItemValue = <K extends keyof PaymentListItemSnapshot>(
  item: PaymentListItem,
  key: K,
) => ((item.overrides as Partial<PaymentListItemSnapshot>)[key] ?? item.snapshot[key]) as PaymentListItemSnapshot[K];

export const upsertPaymentListItem = (
  list: PaymentListRecord,
  item: PaymentListItem,
): PaymentListRecord => {
  if (list.items.some((current) => current.invoiceId === item.invoiceId)) return list;
  return { ...list, items: [...list.items, item], updatedAt: nowIso() };
};

export const removePaymentListItem = (
  list: PaymentListRecord,
  invoiceId: InvoiceId,
): PaymentListRecord => ({
  ...list,
  items: list.items.filter((item) => item.invoiceId !== invoiceId),
  updatedAt: nowIso(),
});

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
