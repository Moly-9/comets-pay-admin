import type { ContractRecord } from './contracts';
import { accountDisplayValue } from './accountPresentation';
import { INITIAL_PAYOUTS } from './data';
import {
  invoicePaymentListItem,
  invoicePaymentListProvider,
  revalidatePaymentListItem,
  type ContractId,
  type PaymentListItem,
  type PaymentListRecord,
  type RequestApprovalEvent,
  type RequestApprovalState,
  type RequestApprovalStatus,
} from './businessWorkflow';
import {
  ACTIVE_INVOICE_DEMO_INVOICES,
  ACTIVE_INVOICE_DEMO_PAYOUTS,
  ALL_PROJECT_PROTOTYPE_INVOICES,
  ALL_PROJECT_PROTOTYPE_PAYOUTS,
  AVAILABLE_PAYMENT_REQUEST_INVOICE_ID,
  PAYMENT_REQUEST_CREATION_DEMO_INVOICES,
  PAYMENT_REQUEST_CREATION_DEMO_PAYOUTS,
  PROJECT_DEMO_CONTRACTS,
  REQUEST_CONTRACT_ASSOCIATION_FIXTURES,
} from './prototypeResourceFixtures';
import {
  myProjectStatusFor,
  paymentRequestAmountLabel,
  paymentRequestChannelForProvider,
  paymentRequestProviderForChannel,
  type PaymentRequestCreatorLink,
} from './paymentRequestProjects';
import {
  INITIAL_CREATORS,
  INITIAL_PROJECTS,
  INITIAL_REQUEST_PROJECTS,
} from './pages/OperationalPages';
import { demoAccountName } from './demoCreatorNames';
import type { RequestProjectSummary } from './pages/RequestProjectDetailPage';
import type { GeneratedInvoiceRecord, InvoiceCurrency, Payout } from './types';

const FINANCE_REVIEW_PROJECT_CODES = new Set([
  'PRJ-260727-07',
  'PRJ-260727-08',
]);

const RESUBMITTED_PROJECT_CODES = new Set([
  'PRJ-260727-07',
  'PRJ-260727-08',
]);

type RequestProjectDemoStage =
  | RequestApprovalStatus
  | 'PAYMENT_READY'
  | 'PAYMENT_PROCESSING'
  | 'PAID'
  | 'CANCELLED'
  | 'DRAFT';

const REQUEST_PROJECT_DEMO_STAGE_BY_CODE: Record<string, RequestProjectDemoStage> = {
  'PRJ-301164': 'PENDING_PM',
  'PRJ-260727-02': 'PENDING_PM',
  'PRJ-260727-03': 'PENDING_PROJECT_OWNER',
  'PRJ-260727-04': 'PENDING_PROJECT_OWNER',
  'PRJ-260727-05': 'PENDING_OWNER',
  'PRJ-260727-06': 'PENDING_OWNER',
  'PRJ-260727-07': 'PENDING_FINANCE',
  'PRJ-260727-08': 'PENDING_FINANCE',
  'PRJ-260727-09': 'PAYMENT_READY',
  'PRJ-260727-10': 'PAYMENT_READY',
  'PRJ-260727-11': 'PAYMENT_PROCESSING',
  'PRJ-260727-12': 'PAYMENT_PROCESSING',
  'PRJ-260801-01': 'PAID',
  'PRJ-260801-02': 'PAID',
  'PRJ-260801-03': 'DRAFT',
  'PRJ-260801-04': 'DRAFT',
  'PRJ-260801-05': 'DRAFT',
  'PRJ-260801-06': 'DRAFT',
  'PRJ-260801-07': 'DRAFT',
  'PRJ-260801-08': 'CANCELLED',
};

const SPECIAL_INVOICE_IDS = new Set([
  ...ACTIVE_INVOICE_DEMO_INVOICES.map((invoice) => invoice.invoiceId),
  AVAILABLE_PAYMENT_REQUEST_INVOICE_ID,
]);

const RESOURCE_ACTOR = {
  account: 'prototype.fixture',
  name: '原型数据生成器',
  role: '系统原型',
};

type RequestProjectMoneyProfile = {
  currency: InvoiceCurrency;
  amountScale: number;
};

// Keep several USD projects as a baseline while giving both pages of the request
// project list a realistic mix of settlement currencies. The profile is applied
// before contracts, invoices, payment lists and payouts are assembled so every
// linked resource keeps the same currency and amount snapshot.
const REQUEST_PROJECT_MONEY_PROFILES: Partial<Record<string, RequestProjectMoneyProfile>> = {
  'PRJ-260727-02': { currency: 'EUR', amountScale: 0.92 },
  'PRJ-260727-03': { currency: 'GBP', amountScale: 0.78 },
  'PRJ-260727-04': { currency: 'HKD', amountScale: 7.8 },
  'PRJ-260727-05': { currency: 'SGD', amountScale: 1.34 },
  'PRJ-260727-08': { currency: 'EUR', amountScale: 0.92 },
  'PRJ-260727-09': { currency: 'GBP', amountScale: 0.78 },
  'PRJ-260727-11': { currency: 'HKD', amountScale: 7.8 },
  'PRJ-260727-12': { currency: 'SGD', amountScale: 1.34 },
  'PRJ-260801-02': { currency: 'EUR', amountScale: 0.92 },
  'PRJ-260801-03': { currency: 'GBP', amountScale: 0.78 },
  'PRJ-260801-05': { currency: 'HKD', amountScale: 7.8 },
  'PRJ-260801-06': { currency: 'SGD', amountScale: 1.34 },
  'PRJ-260801-08': { currency: 'EUR', amountScale: 0.92 },
};

const requestMoneyProfileByEngagement = new Map(INITIAL_PROJECTS.flatMap((project) => {
  const profile = REQUEST_PROJECT_MONEY_PROFILES[project.id];
  if (!profile) return [];
  return (project.creatorProfiles ?? []).map((reference) => (
    [reference.engagementId, profile] as const
  ));
}));

const applyRequestMoneyProfile = (
  invoice: GeneratedInvoiceRecord,
  profile: RequestProjectMoneyProfile | undefined,
): GeneratedInvoiceRecord => {
  if (!profile) return invoice;
  return {
    ...invoice,
    snapshot: {
      ...invoice.snapshot,
      currency: profile.currency,
      items: invoice.snapshot.items.map((item) => {
        const lineTotal = Math.max(1, Math.round(item.lineTotal * profile.amountScale));
        const quantity = Math.max(1, item.quantity);
        return {
          ...item,
          lineTotal,
          unitPrice: Number((lineTotal / quantity).toFixed(2)),
        };
      }),
    },
  };
};

const cloneItems = (items: PaymentListItem[]) => items.map((item) => ({
  ...item,
  snapshot: {
    ...item.snapshot,
    contractIds: item.snapshot.contractIds ? [...item.snapshot.contractIds] : undefined,
  },
  sourceInvoicePaymentSnapshot: item.sourceInvoicePaymentSnapshot ? {
    ...item.sourceInvoicePaymentSnapshot,
    payment: { ...item.sourceInvoicePaymentSnapshot.payment },
  } : undefined,
  executionAccountOverride: item.executionAccountOverride ? {
    ...item.executionAccountOverride,
    account: { ...item.executionAccountOverride.account },
  } : undefined,
  accountOverride: item.accountOverride ? { ...item.accountOverride } : undefined,
  overrides: { ...item.overrides },
  validationIssues: item.validationIssues ? [...item.validationIssues] : undefined,
}));

const financeApprovalHistory = (
  request: RequestProjectSummary,
  resubmitted: boolean,
): RequestApprovalState => {
  const statuses = ['PENDING_PM', 'PENDING_PROJECT_OWNER', 'PENDING_OWNER'] as const;
  const stages = ['PM', 'PROJECT_OWNER', 'OWNER'] as const;
  const names = [request.pm, '项目负责人', '老板'];
  const history: RequestApprovalEvent[] = statuses.map((fromStatus, index) => ({
    round: 1,
    stage: stages[index],
    action: 'APPROVE',
    actorAccount: `fixture-${stages[index].toLowerCase()}`,
    actorName: names[index],
    actorRole: `${names[index]}账号`,
    fromStatus,
    toStatus: index === statuses.length - 1 ? 'PENDING_FINANCE' : statuses[index + 1],
    occurredAt: `2026-07-${String(18 + index).padStart(2, '0')}T02:00:00.000Z`,
  }));
  if (resubmitted) {
    history.push({
      round: 1,
      stage: 'FINANCE',
      action: 'RETURN',
      actorAccount: 'fixture-finance',
      actorName: '财务',
      actorRole: '财务账号',
      fromStatus: 'PENDING_FINANCE',
      toStatus: 'RETURNED_TO_MEDIA_REVIEW',
      reason: '请媒介复核付款资料后重新提交。',
      occurredAt: '2026-07-22T03:00:00.000Z',
    });
  }
  const submittedAt = resubmitted
    ? '2026-08-06T03:30:00.000Z'
    : request.approval?.submittedAt ?? request.createdAt ?? '2026-07-17T02:00:00.000Z';
  return {
    status: 'PENDING_FINANCE',
    round: resubmitted ? 2 : 1,
    history,
    submittedAt,
    updatedAt: resubmitted ? '2026-08-06T03:30:00.000Z' : '2026-08-08T09:00:00.000Z',
  };
};

const approvalAtStage = (
  request: RequestProjectSummary,
  status: RequestApprovalStatus,
): RequestApprovalState => {
  const approval = financeApprovalHistory(
    request,
    status === 'PENDING_FINANCE' && RESUBMITTED_PROJECT_CODES.has(request.id),
  );
  if (status === 'PENDING_FINANCE') return approval;
  const historyLength = {
    PENDING_PM: 0,
    PENDING_PROJECT_OWNER: 1,
    PENDING_OWNER: 2,
    APPROVED: 4,
    RETURNED_TO_MEDIA_REVIEW: 3,
  }[status];
  const history = approval.history.slice(0, historyLength);
  if (status === 'APPROVED') {
    history.push({
      round: 1,
      stage: 'FINANCE',
      action: 'APPROVE',
      actorAccount: 'fixture-finance',
      actorName: '财务',
      actorRole: '财务账号',
      fromStatus: 'PENDING_FINANCE',
      toStatus: 'APPROVED',
      occurredAt: '2026-07-21T02:00:00.000Z',
    });
  }
  return {
    ...approval,
    status,
    history,
    updatedAt: `2026-07-${String(18 + history.length).padStart(2, '0')}T02:00:00.000Z`,
  };
};

const sourceInvoiceByEngagement = new Map(ALL_PROJECT_PROTOTYPE_INVOICES.flatMap((invoice) => {
  const engagementId = invoice.snapshot.engagementId;
  if (!engagementId) return [];
  return [[
    engagementId,
    applyRequestMoneyProfile(invoice, requestMoneyProfileByEngagement.get(engagementId)),
  ] as const];
}));

const requestSeeds: RequestProjectSummary[] = INITIAL_REQUEST_PROJECTS.map((request) => {
  const project = INITIAL_PROJECTS.find((candidate) => (
    candidate.cooperationProjectId === request.cooperationProjectId
  ));
  const firstInvoice = project?.creatorProfiles?.flatMap((reference) => {
    const invoice = sourceInvoiceByEngagement.get(reference.engagementId);
    return invoice ? [invoice] : [];
  })[0];
  const paymentChannel = request.paymentChannel ?? paymentRequestChannelForProvider(
    firstInvoice ? invoicePaymentListProvider(firstInvoice) : 'Airwallex',
  );
  const normalizedRequest = { ...request, paymentChannel };
  const demoStage = REQUEST_PROJECT_DEMO_STAGE_BY_CODE[request.id] ?? 'DRAFT';
  if (demoStage === 'CANCELLED') {
    return {
      ...normalizedRequest,
      lifecycle: 'CANCELLED' as const,
      approval: undefined,
      status: '已取消',
      filter: 'processed' as const,
      cancelledAt: '2026-08-07T09:20:00.000Z',
      cancelledBy: request.media,
      cancelReason: '原请款资料重复创建，保留历史后重新整理。',
    };
  }
  if (demoStage === 'DRAFT') {
    return {
      ...normalizedRequest,
      lifecycle: 'DRAFT',
      approval: undefined,
      status: '草稿',
      filter: 'pending',
    };
  }
  const approvalStatus: RequestApprovalStatus = demoStage === 'PAYMENT_READY'
    || demoStage === 'PAYMENT_PROCESSING'
    || demoStage === 'PAID'
    ? 'APPROVED'
    : demoStage;
  const approval = approvalAtStage(normalizedRequest, approvalStatus);
  const lifecycle = demoStage === 'PAID'
    ? 'COMPLETED' as const
    : demoStage === 'PAYMENT_READY' || demoStage === 'PAYMENT_PROCESSING'
      ? 'APPROVED' as const
      : 'SUBMITTED' as const;
  return {
    ...normalizedRequest,
    lifecycle,
    approval,
    status: myProjectStatusFor({ approval, lifecycle, status: request.status }),
    filter: lifecycle === 'COMPLETED' ? 'processed' : 'pending',
  };
});

const requestByProjectId = new Map(requestSeeds.map((request) => [request.cooperationProjectId, request]));
const creatorById = new Map(INITIAL_CREATORS.map((creator) => [creator.id, creator]));

const requestContracts: ContractRecord[] = INITIAL_PROJECTS.flatMap((project, projectIndex) => (
  (project.creatorProfiles ?? []).map((reference, creatorIndex) => {
    const invoice = sourceInvoiceByEngagement.get(reference.engagementId);
    const creator = creatorById.get(reference.creatorId);
    if (!invoice || !creator) {
      throw new Error(`请款资源 ${project.id}/${reference.engagementId} 缺少 Invoice 或达人`);
    }
    const projectPart = String(projectIndex + 1).padStart(2, '0');
    const creatorPart = String(creatorIndex + 1).padStart(2, '0');
    const contractId = `contract_request_fixture_${projectPart}_${creatorPart}` as ContractId;
    const contractCode = `CON-${project.id.replace(/^PRJ-/, '')}-${creatorPart}`;
    const amount = invoice.snapshot.items.reduce((total, item) => total + item.lineTotal, 0);
    const payment = invoice.snapshot.payment;
    return {
      contractId,
      id: contractCode,
      ioId: `IO-${project.id.replace(/^PRJ-/, '')}-${creatorPart}`,
      name: `${creator.name} · ${project.name}合作协议`,
      templateFamily: '2026 KOL 社交媒体推广服务合同',
      sourceName: `${contractCode}.pdf`,
      documentUrl: '/contracts/26-kol-standard-terms-template.pdf',
      documentNote: '请款项目完整资源链合成演示合同。',
      pageCount: 16,
      isTemplate: false,
      project: project.name,
      brand: project.brand,
      advertiser: 'COMETS INTERNATIONAL LIMITED',
      publisher: invoice.snapshot.from.legalName || creator.name,
      channelName: creator.handle,
      channelLink: creator.socialAccounts[0]?.profileUrl ?? '',
      platform: creator.platform,
      effectiveDate: invoice.snapshot.invoiceDate,
      campaignStart: invoice.snapshot.invoiceDate,
      campaignEnd: '2026-09-30',
      currency: invoice.snapshot.currency,
      totalFee: amount,
      licensePrice: null,
      licenseIncludedInTotal: true,
      invoiceWithinWorkingDays: 5,
      paymentWithinWorkingDays: 45,
      feeBearer: 'ADVERTISER',
      paymentMethod: invoice.snapshot.paymentMethod === 'paypal' ? 'PAYPAL' : 'BANK',
      accountName: payment.accountName
        || payment.paypalUsername
        || demoAccountName(invoice.snapshot.from.legalName || creator.name),
      accountFingerprint: invoice.snapshot.payoutAccountFingerprint ?? payment.accountFingerprint ?? '原型账户快照',
      payoutAccountId: invoice.snapshot.payoutAccountId,
      payoutAccountVersion: invoice.snapshot.payoutAccountVersion,
      payoutProvider: invoice.snapshot.paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex',
      payoutAccountFingerprint: invoice.snapshot.payoutAccountFingerprint,
      paymentSnapshot: { ...payment },
      signed: true,
      status: '已生效',
      updated: invoice.snapshot.invoiceDate,
      deliverables: [{
        id: `deliverable_request_fixture_${projectPart}_${creatorPart}`,
        title: invoice.snapshot.items[0]?.description ?? '创作者内容合作服务',
        description: invoice.snapshot.items.map((item) => item.description).join('；'),
        source: `${contractCode} · Services/Deliverables`,
      }],
      issues: [],
      projectId: project.projectId,
      cooperationProjectId: project.cooperationProjectId,
      creatorId: reference.creatorId,
      creatorHandle: creator.handle,
      engagementId: reference.engagementId,
      lifecycle: 'CONFIRMED',
      confirmedAt: `${invoice.snapshot.invoiceDate}T08:30:00.000Z`,
      extractionStage: 'applied',
    } satisfies ContractRecord;
  })
));

const contractByEngagement = new Map(requestContracts.map((contract) => [contract.engagementId, contract]));

type RequestInvoiceEntry = {
  invoice: GeneratedInvoiceRecord;
  source: GeneratedInvoiceRecord;
  request: RequestProjectSummary;
  contract: ContractRecord;
  projectIndex: number;
  creatorIndex: number;
};

const requestInvoiceEntries: RequestInvoiceEntry[] = INITIAL_PROJECTS.flatMap((project, projectIndex) => (
  (project.creatorProfiles ?? []).flatMap((reference, creatorIndex) => {
    const source = sourceInvoiceByEngagement.get(reference.engagementId);
    const contract = contractByEngagement.get(reference.engagementId);
    const request = requestByProjectId.get(project.cooperationProjectId);
    if (!source || !contract?.contractId || !request) {
      throw new Error(`请款资源 ${project.id}/${reference.engagementId} 无法建立稳定关联`);
    }
    const requestProvider = paymentRequestProviderForChannel(request.paymentChannel);
    if (requestProvider && invoicePaymentListProvider(source) !== requestProvider) return [];
    const projectPart = String(projectIndex + 1).padStart(2, '0');
    const creatorPart = String(creatorIndex + 1).padStart(2, '0');
    const cloneSpecial = SPECIAL_INVOICE_IDS.has(source.invoiceId);
    const invoiceId = cloneSpecial
      ? `invoice_request_fixture_${projectPart}_${creatorPart}` as GeneratedInvoiceRecord['invoiceId']
      : source.invoiceId;
    const invoiceNumber = cloneSpecial
      ? `INV-${project.id.replace(/^PRJ-/, '')}-R${creatorPart}`
      : source.id;
    const status = request.lifecycle === 'APPROVED' || request.lifecycle === 'COMPLETED'
      ? '已通过' as const
      : request.lifecycle === 'RETURNED'
        ? '已退回' as const
        : '已通过' as const;
    return [{
      source,
      request,
      contract,
      projectIndex,
      creatorIndex,
      invoice: {
        ...source,
        id: invoiceNumber,
        invoiceId,
        sourcePayoutId: cloneSpecial
          ? `payout_request_fixture_${projectPart}_${creatorPart}`
          : source.sourcePayoutId,
        status,
        validationStatus: 'valid',
        version: 1,
        revisions: undefined,
        snapshot: {
          ...source.snapshot,
          invoiceNumber,
          cooperationProjectId: request.cooperationProjectId ?? source.snapshot.projectId,
          contractIds: [contract.contractId],
        },
      },
    }];
  })
));

const requestInvoices = requestInvoiceEntries.map((entry) => entry.invoice);
const payoutSources = new Map([
  ...INITIAL_PAYOUTS,
  ...ALL_PROJECT_PROTOTYPE_PAYOUTS,
  ...ACTIVE_INVOICE_DEMO_PAYOUTS,
  ...PAYMENT_REQUEST_CREATION_DEMO_PAYOUTS,
].map((payout) => [payout.id, payout]));

const requestPayouts: Payout[] = requestInvoiceEntries.map(({ invoice, source, request, contract }) => {
  const baseline = payoutSources.get(source.sourcePayoutId);
  if (!baseline) throw new Error(`请款 Invoice ${source.id} 缺少 Payout 快照`);
  const account = invoice.snapshot.paymentMethod === 'paypal'
    ? invoice.snapshot.payment.paypalEmail || invoice.snapshot.payment.paypalUsername
    : invoice.snapshot.payment.iban || invoice.snapshot.payment.accountNumber;
  const approved = request.lifecycle === 'APPROVED';
  const paid = request.lifecycle === 'COMPLETED';
  const returned = request.lifecycle === 'RETURNED';
  const processing = REQUEST_PROJECT_DEMO_STAGE_BY_CODE[request.id] === 'PAYMENT_PROCESSING';
  return {
    ...baseline,
    id: invoice.sourcePayoutId,
    paymentRequestProjectId: request.paymentRequestProjectId,
    projectId: request.cooperationProjectCode ?? baseline.projectId,
    project: request.cooperationProjectName ?? request.project,
    contract: contract.id,
    invoice: invoice.id,
    provider: paymentRequestProviderForChannel(request.paymentChannel)
      ?? invoicePaymentListProvider(invoice),
    currency: invoice.snapshot.currency,
    amount: invoice.snapshot.items.reduce((total, item) => total + item.lineTotal, 0),
    account: accountDisplayValue(account),
    creatorId: invoice.snapshot.creatorId,
    payoutAccountId: invoice.snapshot.payoutAccountId,
    payoutAccountVersion: invoice.snapshot.payoutAccountVersion,
    payoutAccountFingerprint: invoice.snapshot.payoutAccountFingerprint,
    externalBeneficiaryId: invoice.snapshot.payment.externalBeneficiaryId,
    transferMethod: invoice.snapshot.payment.transferMethod,
    localClearingSystem: invoice.snapshot.payment.localClearingSystem,
    feeBearer: 'ADVERTISER',
    status: paid ? '已付款' : processing ? '付款处理中' : approved ? '等待付款' : returned ? '已退回' : '未进入付款',
    invoiceReviewStatus: paid || approved ? '已通过' : returned ? '已退回' : '已通过',
    invoiceVersion: invoice.version,
    invoiceSignedAt: invoice.generatedAt,
    invoiceSnapshot: invoice.snapshot,
    requestApprovalRound: request.approval?.round,
    paidAt: paid ? '2026-08-05 16:00' : undefined,
    issue: undefined,
    returnReason: undefined,
  };
});

const paymentListStatusFor = (request: RequestProjectSummary): PaymentListRecord['status'] => {
  if (request.lifecycle === 'DRAFT' || request.lifecycle === 'CANCELLED') return 'draft';
  if (request.lifecycle === 'APPROVED') return 'approved';
  if (request.lifecycle === 'COMPLETED') return 'paid';
  if (request.lifecycle === 'RETURNED') return 'generated';
  return 'submitted';
};

const requestPaymentLists: PaymentListRecord[] = requestSeeds.map((request, requestIndex) => {
  const entries = requestInvoiceEntries.filter((entry) => entry.request.id === request.id);
  const generatedAt = `2026-08-${String((requestIndex % 5) + 1).padStart(2, '0')}T12:00:00.000Z`;
  const items = entries.map((entry, itemIndex) => {
    const source = invoicePaymentListItem(entry.invoice, [entry.contract]);
    return revalidatePaymentListItem({
      ...source,
      id: `payment_item_request_fixture_${String(requestIndex + 1).padStart(2, '0')}_${String(itemIndex + 1).padStart(3, '0')}`,
      snapshot: {
        ...source.snapshot,
        feeBearer: 'ADVERTISER',
        paymentReason: '影音服务',
        transactionReference: `${request.requestCode ?? request.id}-${String(itemIndex + 1).padStart(2, '0')}`,
        description: '',
      },
    }, generatedAt);
  });
  const status = paymentListStatusFor(request);
  const version = status === 'draft' ? 0 : 1;
  const paymentListCode = `PAY-${(request.cooperationProjectCode ?? request.id).replace(/^PRJ-/, '')}`;
  return {
    paymentListId: `payment_list_request_fixture_${String(requestIndex + 1).padStart(2, '0')}` as PaymentListRecord['paymentListId'],
    paymentListCode,
    projectId: request.cooperationProjectId as PaymentListRecord['projectId'],
    paymentRequestProjectId: request.paymentRequestProjectId,
    provider: paymentRequestProviderForChannel(request.paymentChannel)
      ?? (entries[0] ? invoicePaymentListProvider(entries[0].invoice) : 'Airwallex'),
    status,
    version,
    generatedAt: version ? generatedAt : undefined,
    generatedBy: version ? RESOURCE_ACTOR : undefined,
    versions: version ? [{
      version,
      generatedAt,
      generatedBy: RESOURCE_ACTOR,
      items: cloneItems(items),
    }] : undefined,
    items,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };
});

const requests: RequestProjectSummary[] = requestSeeds.map((request) => {
  const entries = requestInvoiceEntries.filter((entry) => entry.request.id === request.id);
  const creatorLinks: PaymentRequestCreatorLink[] = entries.map(({ invoice, contract }) => ({
    creatorId: invoice.snapshot.creatorId!,
    socialAccountId: invoice.snapshot.creatorSocialAccountId,
    creatorHandle: invoice.snapshot.creatorHandle,
    creatorPlatform: invoice.snapshot.creatorPlatform,
    engagementId: invoice.snapshot.engagementId!,
    contractIds: [contract.contractId!],
    invoiceIds: [invoice.invoiceId],
  }));
  const lists = requestPaymentLists.filter((list) => (
    list.paymentRequestProjectId === request.paymentRequestProjectId
  ));
  const contractIds = new Set(creatorLinks.flatMap((link) => link.contractIds));
  const invoiceIds = creatorLinks.flatMap((link) => link.invoiceIds);
  return {
    ...request,
    creatorLinks,
    invoiceIds,
    paymentListId: lists[0]?.paymentListId,
    paymentListIds: lists[0] ? [lists[0].paymentListId] : [],
    amount: paymentRequestAmountLabel(creatorLinks, requestInvoices),
    contracts: contractIds.size,
    invoices: invoiceIds.length,
    paymentOrder: lists[0]?.paymentListCode ?? '待生成',
    status: myProjectStatusFor(request),
  };
});

const specialInvoices = [
  ...ACTIVE_INVOICE_DEMO_INVOICES,
  ...PAYMENT_REQUEST_CREATION_DEMO_INVOICES,
  ALL_PROJECT_PROTOTYPE_INVOICES.find((invoice) => invoice.invoiceId === AVAILABLE_PAYMENT_REQUEST_INVOICE_ID),
].filter((invoice): invoice is GeneratedInvoiceRecord => Boolean(invoice));
const specialPayouts = [
  ...ACTIVE_INVOICE_DEMO_PAYOUTS,
  ...PAYMENT_REQUEST_CREATION_DEMO_PAYOUTS,
  ...specialInvoices.flatMap((invoice) => {
    const payout = payoutSources.get(invoice.sourcePayoutId);
    return payout ? [payout] : [];
  }),
];

const uniqueBy = <T,>(items: T[], keyFor: (item: T) => string) => (
  [...new Map(items.map((item) => [keyFor(item), item])).values()]
);

export const INITIAL_COMPLETE_REQUEST_RESOURCES = {
  requests,
  contracts: uniqueBy([
    ...PROJECT_DEMO_CONTRACTS,
    ...REQUEST_CONTRACT_ASSOCIATION_FIXTURES,
    ...requestContracts,
  ], (contract) => String(contract.contractId ?? contract.id)),
  invoices: uniqueBy([...requestInvoices, ...specialInvoices], (invoice) => String(invoice.invoiceId)),
  paymentLists: requestPaymentLists,
  payouts: uniqueBy([...requestPayouts, ...specialPayouts], (payout) => payout.id),
};

export const COMPLETE_REQUEST_FINANCE_PROJECT_CODES = FINANCE_REVIEW_PROJECT_CODES;
