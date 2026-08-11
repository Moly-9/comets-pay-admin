import {
  createPrototypeId,
  hasInvoiceForEngagement,
  type ContractId,
  type CreatorId,
  type EngagementId,
  type InvoiceId,
  type ProjectId,
} from '../businessWorkflow';
import { isConfirmedContract, type ContractRecord } from '../contracts';
import {
  eligibleInvoicePayoutAccounts,
  getPayoutAccountId,
  payoutAccountToInvoicePayment,
} from '../payoutAccounts';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type {
  CreatorProfile,
  GeneratedInvoiceRecord,
  InvoiceBatchLineItem,
  InvoiceBatchRow,
  InvoiceCurrency,
  InvoiceDocumentModel,
  InvoiceEntity,
  Payout,
} from '../types';
import { payoutSnapshotForContract, validateInvoiceDocumentModel } from './invoiceDraft';
import { normalizeLineItem } from './invoiceUtils';

export const INVOICE_BATCH_SCHEMA_VERSION = '1.0' as const;
export const INVOICE_BATCH_MAX_ROWS = 50;
export const INVOICE_BATCH_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const INVOICE_BATCH_CURRENCIES: InvoiceCurrency[] = ['USD', 'EUR', 'GBP', 'HKD', 'SGD'];

export type InvoiceBatchContext = {
  project: ProjectSummary;
  creators: CreatorProfile[];
  payouts: Payout[];
  contracts: ContractRecord[];
  generatedInvoices: GeneratedInvoiceRecord[];
  invoiceEntity: InvoiceEntity;
};

export type InvoiceBatchLineItemSeed = Pick<
  InvoiceBatchLineItem,
  'templateKey' | 'description'
>;

const createBatchLineItem = (
  seed: InvoiceBatchLineItemSeed,
  current?: InvoiceBatchLineItem,
): InvoiceBatchLineItem => ({
  ...normalizeLineItem({
    id: current?.id ?? createPrototypeId('item'),
    description: seed.description,
    unitPrice: current?.unitPrice ?? 0,
    quantity: current?.quantity ?? 1,
  }),
  templateKey: seed.templateKey,
});

export const synchronizeInvoiceBatchLineItems = (
  current: InvoiceBatchLineItem[],
  seeds: InvoiceBatchLineItemSeed[],
) => seeds.map((seed) => createBatchLineItem(
  seed,
  current.find((item) => item.templateKey === seed.templateKey),
));

export const updateInvoiceBatchLineItem = (
  items: InvoiceBatchLineItem[],
  lineItemId: string,
  patch: Partial<Pick<InvoiceBatchLineItem, 'description' | 'unitPrice' | 'quantity'>>,
) => items.map((item) => item.id === lineItemId ? ({
  ...item,
  ...normalizeLineItem({
    ...item,
    ...patch,
  }),
}) : item);

const projectIdFor = (project: ProjectSummary) => (
  (project.cooperationProjectId ?? project.projectId ?? project.id) as ProjectId
);

const supportedCurrency = (value?: string): InvoiceCurrency | '' => (
  INVOICE_BATCH_CURRENCIES.includes(value as InvoiceCurrency)
    ? value as InvoiceCurrency
    : ''
);

const eligibleAccountsForRow = (
  row: Pick<InvoiceBatchRow, 'creatorId'>,
  creators: CreatorProfile[],
) => eligibleInvoicePayoutAccounts(
  creators.find((creator) => creator.id === row.creatorId),
);

export const availableContractsForEngagement = (
  engagementId: EngagementId,
  contracts: ContractRecord[],
  association: { projectId: ProjectId; creatorId: CreatorId },
) => contracts.filter((contract): contract is ContractRecord & { contractId: ContractId } => (
  contract.engagementId === engagementId
  && contract.creatorId === association.creatorId
  && (contract.cooperationProjectId ?? contract.projectId) === association.projectId
  && isConfirmedContract(contract)
  && Boolean(contract.contractId)
));

export const createInvoiceBatchRow = ({
  project,
  engagementId,
  creators,
  payouts,
  contracts,
  generatedInvoices,
  invoiceEntity,
  invoiceDate,
  currency = 'USD',
  lineItems,
}: InvoiceBatchContext & {
  engagementId: EngagementId;
  invoiceDate: string;
  currency?: InvoiceCurrency;
  lineItems: InvoiceBatchLineItemSeed[];
}) => {
  const projectId = projectIdFor(project);
  const reference = project.creatorProfiles?.find((item) => item.engagementId === engagementId);
  if (!reference) throw new Error(`项目中不存在合作关系 ${engagementId}`);
  const creator = creators.find((item) => item.id === reference.creatorId);
  if (!creator) throw new Error(`合作关系 ${engagementId} 缺少达人档案`);
  const payout = payouts.find((item) => (
    item.creatorId === creator.id && item.projectId === projectId
  ));
  const availableContracts = availableContractsForEngagement(engagementId, contracts, {
    projectId,
    creatorId: reference.creatorId,
  });
  const contractIds = availableContracts.length === 1
    ? [availableContracts[0].contractId]
    : [];
  const contractSnapshot = availableContracts.length === 1
    ? payoutSnapshotForContract(availableContracts[0])
    : null;
  const eligibleAccounts = eligibleInvoicePayoutAccounts(creator);
  const contractAccount = contractSnapshot?.payoutAccountId
    ? eligibleAccounts.find((account) => (
        getPayoutAccountId(account) === contractSnapshot.payoutAccountId
      ))
    : null;
  const defaultAccounts = eligibleAccounts.filter((account) => account.isDefault);
  const selectedAccount = defaultAccounts.length === 1
    ? defaultAccounts[0]
    : contractAccount;

  const row: InvoiceBatchRow = {
    projectId,
    engagementId,
    creatorId: creator.id as CreatorId,
    creatorName: creator.name,
    creatorHandle: creator.handle,
    sourcePayoutId: payout?.id ?? createPrototypeId('payout'),
    invoiceDate,
    items: synchronizeInvoiceBatchLineItems([], lineItems),
    currency,
    payoutAccountId: selectedAccount ? getPayoutAccountId(selectedAccount) : '',
    payoutAccountLocked: false,
    contractIds,
    availableContractIds: availableContracts.map((contract) => contract.contractId),
    status: 'NEEDS_INPUT',
    issues: [],
  };

  return validateInvoiceBatchRow(row, {
    project,
    creators,
    payouts,
    contracts,
    generatedInvoices,
    invoiceEntity,
  });
};

export const buildInvoiceDocumentForBatchRow = (
  row: InvoiceBatchRow,
  context: InvoiceBatchContext,
  invoiceNumber: string,
): InvoiceDocumentModel => {
  const creator = context.creators.find((item) => item.id === row.creatorId);
  if (!creator) throw new Error('达人档案不存在');
  const account = eligibleAccountsForRow(row, context.creators)
    .find((item) => getPayoutAccountId(item) === row.payoutAccountId);
  if (!account) throw new Error('未选择可用于 Invoice 的已验证收款账户');
  if (!row.currency) throw new Error('Invoice 币种未确认');
  const payment = payoutAccountToInvoicePayment(account, creator.id);

  return {
    invoiceNumber,
    invoiceDate: row.invoiceDate,
    billTo: { ...context.invoiceEntity },
    creatorHandle: creator.handle,
    creatorName: creator.name,
    creatorId: creator.id as CreatorId,
    engagementId: row.engagementId,
    projectId: row.projectId,
    cooperationProjectId: row.projectId,
    projectName: context.project.name,
    contractIds: [...row.contractIds],
    from: { ...creator.contact },
    currency: row.currency,
    items: row.items.map(({ templateKey: _templateKey, ...item }) => normalizeLineItem(item)),
    payoutAccountId: getPayoutAccountId(account),
    payoutAccountVersion: payment.payoutAccountVersion,
    payoutProvider: account.provider,
    payoutAccountFingerprint: payment.accountFingerprint,
    paymentMethod: account.provider === 'PayPal' ? 'paypal' : 'bank',
    payment,
  };
};

export const validateInvoiceBatchRow = (
  row: InvoiceBatchRow,
  context: InvoiceBatchContext,
): InvoiceBatchRow => {
  if (row.generated) return { ...row, status: 'GENERATED', issues: [] };
  const issues: string[] = [];
  const conflictIssues: string[] = [];
  const projectId = projectIdFor(context.project);
  const reference = context.project.creatorProfiles?.find((item) => (
    item.engagementId === row.engagementId
  ));

  if (
    !reference
    || reference.creatorId !== row.creatorId
    || projectId !== row.projectId
    || reference.status === 'removed'
  ) {
    conflictIssues.push('项目、达人和合作关系的稳定 ID 不一致');
  }
  const existing = hasInvoiceForEngagement(
    context.generatedInvoices.map((record) => ({
      invoiceId: record.invoiceId,
      engagementId: record.snapshot.engagementId as EngagementId | undefined,
    })),
    row.engagementId,
  );
  if (existing) conflictIssues.push('该项目达人已有有效 Invoice，不能重复生成');

  const creator = context.creators.find((item) => item.id === row.creatorId);
  if (!creator) {
    conflictIssues.push('达人档案不存在');
  } else {
    if (!creator.contact.legalName.trim()) issues.push('缺少达人真实姓名');
    if (!creator.contact.address.trim()) issues.push('缺少达人联系地址');
    if (!creator.contact.phone.trim()) issues.push('缺少达人联系电话');
    if (!creator.contact.email.trim() || !/^\S+@\S+\.\S+$/.test(creator.contact.email)) {
      issues.push('缺少有效达人邮箱');
    }
  }

  const availableContracts = availableContractsForEngagement(row.engagementId, context.contracts, {
    projectId: row.projectId,
    creatorId: row.creatorId,
  });
  if (availableContracts.length > 1 && row.contractIds.length === 0) {
    conflictIssues.push('存在多份已确认合同，请逐行选择');
  }
  if (row.contractIds.some((contractId) => (
    !availableContracts.some((contract) => contract.contractId === contractId)
  ))) {
    conflictIssues.push('所选合同不属于当前项目达人');
  }

  const eligibleAccounts = eligibleAccountsForRow(row, context.creators);
  const account = eligibleAccounts.find((item) => (
    getPayoutAccountId(item) === row.payoutAccountId
  ));
  if (!account) issues.push('请选择唯一、已验证且资料完整的收款账户');

  if (!row.currency) issues.push('缺少支持的 Invoice 币种');
  if (!row.items.length) issues.push('至少需要 1 条费用明细');
  row.items.forEach((item, index) => {
    const prefix = row.items.length > 1 ? `第 ${index + 1} 条 ` : '';
    if (!item.description.trim()) issues.push(`${prefix}Description 不能为空`);
    if (!(Number.isFinite(item.unitPrice) && item.unitPrice > 0)) {
      issues.push(`${prefix}Price 必须大于 0`);
    }
    if (!(Number.isFinite(item.quantity) && item.quantity > 0)) {
      issues.push(`${prefix}Amount 必须大于 0`);
    }
  });

  const lineItemsReady = Boolean(row.items.length) && row.items.every((item) => (
    item.description.trim()
    && Number.isFinite(item.unitPrice)
    && item.unitPrice > 0
    && Number.isFinite(item.quantity)
    && item.quantity > 0
  ));

  if (
    creator
    && account
    && row.currency
    && lineItemsReady
  ) {
    const model = buildInvoiceDocumentForBatchRow(
      row,
      context,
      'INV-BATCH-VALIDATION',
    );
    Object.values(validateInvoiceDocumentModel(model, [])).forEach((message) => {
      if (message.includes('不一致') || message.includes('应等于')) conflictIssues.push(message);
      else issues.push(message);
    });
  }

  const uniqueIssues = [...new Set([...conflictIssues, ...issues])];
  return {
    ...row,
    status: conflictIssues.length
      ? 'CONFLICT'
      : uniqueIssues.length
        ? 'NEEDS_INPUT'
        : 'READY',
    issues: uniqueIssues,
  };
};

export const updateAndValidateInvoiceBatchRow = (
  row: InvoiceBatchRow,
  patch: Partial<Pick<
    InvoiceBatchRow,
    | 'invoiceDate'
    | 'items'
    | 'currency'
    | 'payoutAccountId'
    | 'contractIds'
    | 'payoutAccountLocked'
  >>,
  context: InvoiceBatchContext,
) => validateInvoiceBatchRow({
  ...row,
  ...patch,
  status: 'NEEDS_INPUT',
  issues: [],
}, context);

export const createGeneratedInvoiceRecord = (
  row: InvoiceBatchRow,
  snapshot: InvoiceDocumentModel,
): GeneratedInvoiceRecord => ({
  id: snapshot.invoiceNumber,
  invoiceId: createPrototypeId('invoice') as InvoiceId,
  sourcePayoutId: row.sourcePayoutId,
  status: '待签署',
  generatedAt: new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  }).format(new Date()),
  snapshot,
  validationStatus: 'valid',
  version: 1,
});
