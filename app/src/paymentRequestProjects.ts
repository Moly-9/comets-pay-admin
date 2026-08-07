import type { ContractRecord } from './contracts';
import { isConfirmedContract } from './contracts';
import type {
  ContractId,
  CooperationProjectId,
  CreatorId,
  EngagementId,
  InvoiceId,
  PaymentListRecord,
  PaymentRequestProjectId,
  ProjectId,
} from './businessWorkflow';
import { invoicePaymentListItem, revalidatePaymentListItem } from './businessWorkflow';
import type { GeneratedInvoiceRecord, InvoiceReviewStatus } from './types';

export type PaymentRequestCreatorLink = {
  creatorId: CreatorId;
  engagementId: EngagementId;
  contractIds: ContractId[];
  invoiceIds: InvoiceId[];
};

type LegacyPaymentRequestCreatorLink = Omit<PaymentRequestCreatorLink, 'invoiceIds'> & {
  invoiceId?: InvoiceId;
  invoiceIds?: InvoiceId[];
};

export const normalizePaymentRequestCreatorLink = (
  link: LegacyPaymentRequestCreatorLink,
): PaymentRequestCreatorLink => ({
  creatorId: link.creatorId,
  engagementId: link.engagementId,
  contractIds: [...new Set(link.contractIds)],
  invoiceIds: [...new Set([
    ...(link.invoiceIds ?? []),
    ...(link.invoiceId ? [link.invoiceId] : []),
  ])],
});

export const paymentRequestInvoiceIds = (
  links: PaymentRequestCreatorLink[],
) => [...new Set(links.flatMap((link) => link.invoiceIds))];

export type PaymentRequestProjectLike = {
  id: string;
  paymentRequestProjectId?: PaymentRequestProjectId;
  requestCode?: string;
  lifecycle?: 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED' | 'COMPLETED';
  creatorLinks?: PaymentRequestCreatorLink[];
  invoiceIds?: InvoiceId[];
};

export type PaymentRequestListItem = PaymentRequestProjectLike & {
  cooperationProjectName?: string;
  project: string;
  brand: string;
  pm: string;
  amount: string;
  status: string;
};

export type PaymentRequestListFilters = {
  customers: string[];
  pms: string[];
  currency: string;
  minBudget: string;
  maxBudget: string;
  statuses: string[];
};

export const createEmptyPaymentRequestListFilters = (): PaymentRequestListFilters => ({
  customers: [],
  pms: [],
  currency: 'all',
  minBudget: '',
  maxBudget: '',
  statuses: [],
});

export const paymentRequestAmount = (value: string) => ({
  currency: value.match(/\b[A-Z]{3}\b/)?.[0] ?? '',
  amount: Number(value.replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0] ?? 0),
});

export const paymentRequestListMetrics = (requests: PaymentRequestListItem[]) => {
  const waitingReview = requests.filter((request) => request.status === '待审批').length;
  const reviewing = requests.filter((request) => request.status.includes('审批中')).length;
  return {
    waitingReview,
    reviewing,
    reviewTotal: waitingReview + reviewing,
    waitingPayment: requests.filter((request) => request.status === '待打款').length,
    total: requests.length,
  };
};

export const filterPaymentRequestList = <T extends PaymentRequestListItem>({
  requests,
  search,
  filters,
}: {
  requests: T[];
  search: string;
  filters: PaymentRequestListFilters;
}) => {
  const query = search.trim().toLowerCase();
  const minBudget = filters.minBudget ? Number(filters.minBudget) : null;
  const maxBudget = filters.maxBudget ? Number(filters.maxBudget) : null;
  const invalidBudgetRange = minBudget !== null && maxBudget !== null && minBudget > maxBudget;
  const visible = requests.filter((request) => {
    const budget = paymentRequestAmount(request.amount);
    const searchable = `${request.requestCode ?? request.id}${request.cooperationProjectName ?? request.project}${request.project}`.toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesCustomer = filters.customers.length === 0 || filters.customers.includes(request.brand);
    const matchesPM = filters.pms.length === 0 || filters.pms.includes(request.pm);
    const matchesCurrency = filters.currency === 'all' || filters.currency === budget.currency;
    const matchesMinBudget = invalidBudgetRange || minBudget === null || budget.amount >= minBudget;
    const matchesMaxBudget = invalidBudgetRange || maxBudget === null || budget.amount <= maxBudget;
    const matchesStatus = filters.statuses.length === 0 || filters.statuses.includes(request.status);
    return matchesSearch && matchesCustomer && matchesPM && matchesCurrency && matchesMinBudget && matchesMaxBudget && matchesStatus;
  });
  return { visible, invalidBudgetRange };
};

export const canAddCreatorToPaymentRequest = (request: PaymentRequestProjectLike) => (
  request.lifecycle === 'DRAFT'
);

export type CooperationProjectLike = {
  id: string;
  projectId?: ProjectId;
  cooperationProjectId?: CooperationProjectId;
};

export const cooperationProjectIdFor = (project: CooperationProjectLike) => (
  (project.cooperationProjectId ?? project.projectId ?? project.id) as CooperationProjectId
);

export const contractCooperationProjectId = (contract: ContractRecord) => (
  (contract.cooperationProjectId ?? contract.projectId ?? '') as CooperationProjectId | ''
);

export const invoiceCooperationProjectId = (invoice: GeneratedInvoiceRecord) => (
  (invoice.snapshot.cooperationProjectId ?? invoice.snapshot.projectId ?? '') as CooperationProjectId | ''
);

export const contractsForCooperationCreator = (
  contracts: ContractRecord[],
  cooperationProjectId: CooperationProjectId,
  creatorId: CreatorId,
) => contracts.filter((contract) => (
  contractCooperationProjectId(contract) === cooperationProjectId
  && contract.creatorId === creatorId
));

export const invoicesForCooperationCreator = (
  invoices: GeneratedInvoiceRecord[],
  cooperationProjectId: CooperationProjectId,
  creatorId: CreatorId,
) => invoices.filter((invoice) => (
  invoiceCooperationProjectId(invoice) === cooperationProjectId
  && invoice.snapshot.creatorId === creatorId
));

export const requestOwningInvoice = (
  requests: PaymentRequestProjectLike[],
  invoiceId: InvoiceId,
  excludeRequestId?: PaymentRequestProjectId,
) => requests.find((request) => (
  (!excludeRequestId || request.paymentRequestProjectId !== excludeRequestId)
  && (
    request.creatorLinks?.some((link) => link.invoiceIds.includes(invoiceId))
    || request.invoiceIds?.includes(invoiceId)
  )
));

export const selectableContractIds = (contracts: ContractRecord[]) => contracts
  .filter(isConfirmedContract)
  .map((contract) => contract.contractId)
  .filter((contractId): contractId is ContractId => Boolean(contractId));

export type CreatorDocumentResolution = {
  contracts: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
  availableInvoices: GeneratedInvoiceRecord[];
  invoiceOwners: Array<{
    invoiceId: InvoiceId;
    owner: PaymentRequestProjectLike;
  }>;
  status: 'READY' | 'MISSING_INVOICE' | 'INVOICE_IN_USE';
};

export const resolveCreatorDocuments = ({
  contracts,
  invoices,
  requests,
  cooperationProjectId,
  creatorId,
  excludeRequestId,
}: {
  contracts: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
  requests: PaymentRequestProjectLike[];
  cooperationProjectId: CooperationProjectId;
  creatorId: CreatorId;
  excludeRequestId?: PaymentRequestProjectId;
}): CreatorDocumentResolution => {
  const matchedContracts = contractsForCooperationCreator(contracts, cooperationProjectId, creatorId);
  const matchedInvoices = invoicesForCooperationCreator(invoices, cooperationProjectId, creatorId);
  if (matchedInvoices.length === 0) {
    return {
      contracts: matchedContracts,
      invoices: [],
      availableInvoices: [],
      invoiceOwners: [],
      status: 'MISSING_INVOICE',
    };
  }
  const invoiceOwners = matchedInvoices.flatMap((invoice) => {
    const owner = requestOwningInvoice(requests, invoice.invoiceId, excludeRequestId);
    return owner ? [{ invoiceId: invoice.invoiceId, owner }] : [];
  });
  const occupiedIds = new Set(invoiceOwners.map((item) => item.invoiceId));
  const availableInvoices = matchedInvoices.filter((invoice) => !occupiedIds.has(invoice.invoiceId));
  return {
    contracts: matchedContracts,
    invoices: matchedInvoices,
    availableInvoices,
    invoiceOwners,
    status: availableInvoices.length ? 'READY' : 'INVOICE_IN_USE',
  };
};

const SUBMITTABLE_INVOICE_STATUSES: InvoiceReviewStatus[] = ['待发起请款'];

export const paymentRequestSubmissionIssues = ({
  creatorLinks,
  invoices,
  paymentLists,
  paymentRequestProjectId,
}: {
  creatorLinks: PaymentRequestCreatorLink[];
  invoices: GeneratedInvoiceRecord[];
  paymentLists: PaymentListRecord[];
  paymentRequestProjectId?: PaymentRequestProjectId;
}) => {
  const issues: string[] = [];
  if (!creatorLinks.length) issues.push('请至少关联一位合作达人');
  const expectedInvoiceIds = paymentRequestInvoiceIds(creatorLinks);
  creatorLinks.forEach((link) => {
    if (!link.invoiceIds.length) {
      issues.push(`达人 ${link.creatorId} 缺少关联 Invoice`);
      return;
    }
    link.invoiceIds.forEach((invoiceId) => {
      const invoice = invoices.find((candidate) => candidate.invoiceId === invoiceId);
      if (!invoice) {
        issues.push(`达人 ${link.creatorId} 的 Invoice ${invoiceId} 不存在`);
        return;
      }
      if (
        invoice.snapshot.creatorId !== link.creatorId
        || invoice.snapshot.engagementId !== link.engagementId
      ) {
        issues.push(`${invoice.id} 与当前达人或合作关系不一致`);
      }
      if (!SUBMITTABLE_INVOICE_STATUSES.includes(invoice.status)) {
        issues.push(`${invoice.id} 尚未完成签署和媒介审核`);
      }
      const paymentList = paymentLists
        .filter((list) => !paymentRequestProjectId || list.paymentRequestProjectId === paymentRequestProjectId)
        .find((list) => list.items.some((item) => item.invoiceId === invoiceId));
      const paymentItem = paymentList?.items.find((item) => item.invoiceId === invoiceId);
      if (!paymentItem) {
        issues.push(`${invoice.id} 尚未生成付款清单`);
      } else if (paymentList?.status !== 'generated') {
        issues.push(`${invoice.id} 的付款清单尚未生成锁定版本`);
      } else if (paymentItem.requiresRevalidation || paymentItem.validationIssues?.length) {
        issues.push(`${invoice.id} 的付款账户快照需要重新校验`);
      }
    });
  });
  const requestLists = paymentLists.filter((list) => (
    !paymentRequestProjectId || list.paymentRequestProjectId === paymentRequestProjectId
  ));
  const listedInvoiceIds = requestLists.flatMap((list) => list.items.map((item) => item.invoiceId));
  const listedCounts = listedInvoiceIds.reduce<Map<InvoiceId, number>>((counts, invoiceId) => (
    counts.set(invoiceId, (counts.get(invoiceId) ?? 0) + 1)
  ), new Map());
  const duplicate = [...listedCounts].find(([, count]) => count > 1)?.[0];
  const extra = listedInvoiceIds.find((invoiceId) => !expectedInvoiceIds.includes(invoiceId));
  if (duplicate) issues.push(`Invoice ${duplicate} 在付款清单中重复出现`);
  if (extra) issues.push(`付款清单包含当前请款项目未关联的 Invoice ${extra}`);
  return issues;
};

export const paymentRequestAmountLabel = (
  links: PaymentRequestCreatorLink[],
  invoices: GeneratedInvoiceRecord[],
) => {
  const totals = paymentRequestInvoiceIds(links).reduce<Record<string, number>>((result, invoiceId) => {
    const invoice = invoices.find((candidate) => candidate.invoiceId === invoiceId);
    if (!invoice) return result;
    const total = invoice.snapshot.items.reduce((sum, item) => sum + item.lineTotal, 0);
    result[invoice.snapshot.currency] = (result[invoice.snapshot.currency] ?? 0) + total;
    return result;
  }, {});
  return Object.entries(totals)
    .map(([currency, amount]) => `${currency} ${amount.toLocaleString('en-US')}`)
    .join(' + ') || '待核算';
};

export const createPaymentRequestListItem = ({
  invoice,
  contracts,
  contractIds = [],
  requestCode,
  lineNumber,
}: {
  invoice: GeneratedInvoiceRecord;
  contracts: ContractRecord[];
  contractIds?: ContractId[];
  requestCode: string;
  lineNumber: number;
}) => {
  const source = invoicePaymentListItem({
    ...invoice,
    snapshot: { ...invoice.snapshot, contractIds },
  }, contracts);
  return revalidatePaymentListItem({
    ...source,
    snapshot: {
      ...source.snapshot,
      feeBearer: source.snapshot.feeBearer || (contractIds.length ? '' : 'ADVERTISER'),
      transactionReference: `${requestCode}-${String(lineNumber).padStart(2, '0')}`,
    },
  });
};
