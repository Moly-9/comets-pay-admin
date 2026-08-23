import {
  createPrototypeId,
  type ContractId,
  type CreatorId,
  type EngagementId,
  type InvoiceId,
  type ProjectId,
} from '../businessWorkflow';
import { contractLinkedToProject, isContractAvailableForNewAssociation, type ContractRecord } from '../contracts';
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
import { validateInvoiceDocumentModel } from './invoiceDraft';
import { createInvoiceContractMatchReview, evaluateInvoiceContractMatch } from './invoiceContractMatching';
import { formatInvoiceNumber, normalizeLineItem } from './invoiceUtils';

export const INVOICE_BATCH_MAX_ROWS = 50;
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
  descriptionOverrideKeys: string[] = [],
  forceTemplateKeys: string[] = [],
) => seeds.map((seed) => {
  const existing = current.find((item) => item.templateKey === seed.templateKey);
  const preservesOverride = existing
    && descriptionOverrideKeys.includes(seed.templateKey)
    && !forceTemplateKeys.includes(seed.templateKey);
  return createBatchLineItem(
    preservesOverride ? { ...seed, description: existing.description } : seed,
    existing,
  );
});

export const synchronizeInvoiceBatchDescriptions = (
  row: Pick<InvoiceBatchRow, 'items' | 'descriptionOverrideKeys'>,
  seeds: InvoiceBatchLineItemSeed[],
  forceTemplateKeys: string[] = [],
): Pick<InvoiceBatchRow, 'items' | 'descriptionOverrideKeys'> => {
  const availableKeys = new Set(seeds.map((seed) => seed.templateKey));
  const forcedKeys = new Set(forceTemplateKeys);
  const descriptionOverrideKeys = row.descriptionOverrideKeys.filter((key) => (
    availableKeys.has(key) && !forcedKeys.has(key)
  ));
  return {
    items: synchronizeInvoiceBatchLineItems(
      row.items,
      seeds,
      descriptionOverrideKeys,
      forceTemplateKeys,
    ),
    descriptionOverrideKeys,
  };
};

export const setInvoiceBatchDescriptionOverride = (
  row: Pick<InvoiceBatchRow, 'items' | 'descriptionOverrideKeys'>,
  lineItemId: string,
  description: string,
): Pick<InvoiceBatchRow, 'items' | 'descriptionOverrideKeys'> => {
  const item = row.items.find((candidate) => candidate.id === lineItemId);
  if (!item) return row;
  return {
    items: updateInvoiceBatchLineItem(row.items, lineItemId, { description }),
    descriptionOverrideKeys: [...new Set([...row.descriptionOverrideKeys, item.templateKey])],
  };
};

export const clearInvoiceBatchDescriptionOverride = (
  row: Pick<InvoiceBatchRow, 'items' | 'descriptionOverrideKeys'>,
  seeds: InvoiceBatchLineItemSeed[],
  templateKey: string,
) => synchronizeInvoiceBatchDescriptions(row, seeds, [templateKey]);

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
  contract.creatorId === association.creatorId
  && contractLinkedToProject(contract, association.projectId)
  && isContractAvailableForNewAssociation(contract)
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
  const eligibleAccounts = eligibleInvoicePayoutAccounts(creator);
  const defaultAccounts = eligibleAccounts.filter((account) => account.isDefault);
  const selectedAccount = defaultAccounts.length === 1
    ? defaultAccounts[0]
    : eligibleAccounts.length === 1 ? eligibleAccounts[0] : null;

  const row: InvoiceBatchRow = {
    projectId,
    engagementId,
    creatorId: creator.id as CreatorId,
    creatorName: creator.name,
    creatorHandle: creator.handle,
    sourcePayoutId: payout?.id ?? createPrototypeId('payout'),
    invoiceDate,
    items: synchronizeInvoiceBatchLineItems([], lineItems),
    descriptionOverrideKeys: [],
    currency,
    payoutAccountId: selectedAccount ? getPayoutAccountId(selectedAccount) : '',
    payoutAccountLocked: false,
    contractIds,
    availableContractIds: availableContracts.map((contract) => contract.contractId),
    contractMatchReason: '',
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.invoiceDate)) issues.push('缺少有效 Invoice 日期');
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
    && /^\d{4}-\d{2}-\d{2}$/.test(row.invoiceDate)
    && lineItemsReady
  ) {
    const model = buildInvoiceDocumentForBatchRow(
      row,
      context,
      formatInvoiceNumber(row.invoiceDate, 1),
    );
    Object.values(validateInvoiceDocumentModel(model, [])).forEach((message) => {
      if (message.includes('不一致') || message.includes('应等于')) conflictIssues.push(message);
      else issues.push(message);
    });
    const selectedContracts = availableContracts.filter((contract) => (
      row.contractIds.includes(contract.contractId)
    ));
    const match = evaluateInvoiceContractMatch(selectedContracts, model, row.contractMatchReason);
    match.blockerIssues.forEach((matchIssue) => conflictIssues.push(matchIssue.message));
    if (match.reasonRequiredIssues.length && !match.reasonValid) {
      issues.push(row.contractMatchReason.trim().length > 300
        ? '合同差异说明不能超过 300 个字符'
        : '合同金额、币种或付款账户存在差异，请填写 1–300 个字符的说明');
    }
    row = {
      ...row,
      contractMatchReview: createInvoiceContractMatchReview({
        contracts: selectedContracts,
        model,
        version: 1,
        reason: row.contractMatchReason,
      }),
    };
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
    | 'descriptionOverrideKeys'
    | 'currency'
    | 'payoutAccountId'
    | 'contractIds'
    | 'payoutAccountLocked'
    | 'contractMatchReason'
  >>,
  context: InvoiceBatchContext,
) => {
  const resetsMatchReason = Object.keys(patch).some((field) => field !== 'contractMatchReason');
  return validateInvoiceBatchRow({
    ...row,
    ...patch,
    contractMatchReason: resetsMatchReason && patch.contractMatchReason === undefined
      ? ''
      : patch.contractMatchReason ?? row.contractMatchReason,
    contractMatchReview: undefined,
    status: 'NEEDS_INPUT',
    issues: [],
  }, context);
};

export const createGeneratedInvoiceRecord = (
  row: InvoiceBatchRow,
  snapshot: InvoiceDocumentModel,
  contractMatchReview = row.contractMatchReview,
): GeneratedInvoiceRecord => ({
  id: snapshot.invoiceNumber,
  invoiceId: createPrototypeId('invoice') as InvoiceId,
  sourcePayoutId: row.sourcePayoutId,
  status: '草稿',
  generatedAt: new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  }).format(new Date()),
  snapshot,
  validationStatus: 'valid',
  version: 1,
  contractMatchReviews: contractMatchReview ? [contractMatchReview] : undefined,
});
