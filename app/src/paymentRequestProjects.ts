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
  invoiceId: InvoiceId;
};

export type PaymentRequestProjectLike = {
  id: string;
  paymentRequestProjectId?: PaymentRequestProjectId;
  requestCode?: string;
  lifecycle?: 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED' | 'COMPLETED';
  creatorLinks?: PaymentRequestCreatorLink[];
  invoiceIds?: InvoiceId[];
};

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
    request.creatorLinks?.some((link) => link.invoiceId === invoiceId)
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
  invoice: GeneratedInvoiceRecord | null;
  invoiceOwner: PaymentRequestProjectLike | null;
  status: 'READY' | 'MISSING_INVOICE' | 'MULTIPLE_INVOICES' | 'INVOICE_IN_USE';
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
    return { contracts: matchedContracts, invoices: [], invoice: null, invoiceOwner: null, status: 'MISSING_INVOICE' };
  }
  if (matchedInvoices.length > 1) {
    return { contracts: matchedContracts, invoices: matchedInvoices, invoice: null, invoiceOwner: null, status: 'MULTIPLE_INVOICES' };
  }
  const invoice = matchedInvoices[0];
  const invoiceOwner = requestOwningInvoice(requests, invoice.invoiceId, excludeRequestId) ?? null;
  return {
    contracts: matchedContracts,
    invoices: matchedInvoices,
    invoice,
    invoiceOwner,
    status: invoiceOwner ? 'INVOICE_IN_USE' : 'READY',
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
  creatorLinks.forEach((link) => {
    const invoice = invoices.find((candidate) => candidate.invoiceId === link.invoiceId);
    if (!invoice) {
      issues.push(`达人 ${link.creatorId} 缺少关联 Invoice`);
      return;
    }
    if (!SUBMITTABLE_INVOICE_STATUSES.includes(invoice.status)) {
      issues.push(`${invoice.id} 尚未完成签署和媒介审核`);
    }
    const paymentList = paymentLists
      .filter((list) => !paymentRequestProjectId || list.paymentRequestProjectId === paymentRequestProjectId)
      .find((list) => list.items.some((item) => item.invoiceId === link.invoiceId));
    const paymentItem = paymentList?.items.find((item) => item.invoiceId === link.invoiceId);
    if (!paymentItem) {
      issues.push(`${invoice.id} 尚未生成付款清单`);
    } else if (paymentList?.status !== 'generated') {
      issues.push(`${invoice.id} 的付款清单尚未生成锁定版本`);
    } else if (paymentItem.requiresRevalidation || paymentItem.validationIssues?.length) {
      issues.push(`${invoice.id} 的付款账户快照需要重新校验`);
    }
  });
  return issues;
};

export const paymentRequestAmountLabel = (
  links: PaymentRequestCreatorLink[],
  invoices: GeneratedInvoiceRecord[],
) => {
  const totals = links.reduce<Record<string, number>>((result, link) => {
    const invoice = invoices.find((candidate) => candidate.invoiceId === link.invoiceId);
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
