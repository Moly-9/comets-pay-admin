import type { ContractRecord } from './contracts';
import { INITIAL_INVOICE_ENTITY, INITIAL_PAYOUTS, PROJECT_FIXTURES } from './data';
import {
  createDocumentPayoutSnapshot,
  eligibleInvoicePayoutAccounts,
  getDefaultPayoutAccount,
  invoicePaymentForCreator,
} from './payoutAccounts';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from './pages/OperationalPages';
import type {
  ContractId,
  CreatorId,
  EngagementId,
  InvoiceId,
  PaymentListItem,
  PaymentListRecord,
  ProjectId,
} from './businessWorkflow';
import {
  applyPaymentListPayoutSnapshot,
  invoicePaymentListItem,
  paymentListEffectiveAccount,
} from './businessWorkflow';
import type {
  CreatorProfile,
  GeneratedInvoiceRecord,
  InvoiceDocumentModel,
  Payout,
  Provider,
} from './types';

const DEMO_PROJECT_CODE = 'PRJ-301164';
const DEMO_TIMESTAMP = '2026-08-01T09:00:00.000Z';
export const AVAILABLE_PAYMENT_REQUEST_INVOICE_ID = 'invoice_fixture_04_24' as InvoiceId;

const demoInvoiceReviewStatus = (index: number): Payout['invoiceReviewStatus'] => {
  if (index === 0) return '达人反馈';
  if (index === 1) return '待媒介复核';
  if (index === 2 || index === 3) return '已退回';
  return '已通过';
};

const DEMO_INVOICE_AMOUNTS = [
  4800,
  3200,
  2800,
  2400,
  2600,
  2200,
  3000,
  2400,
  2600,
  2800,
  3200,
  2000,
  1800,
  2600,
  2400,
  2200,
  2800,
  2200,
] as const;

const DEMO_DELIVERABLES = [
  'Dedicated Video 1 条 + CTA',
  'YouTube Integrated Video 1 条',
  'TikTok 短视频 2 条',
  'Instagram Reels 1 条 + Story 2 条',
  '图文内容 2 组',
  '短视频 1 条 + 授权 30 天',
  'YouTube Dedicated Video 1 条',
  'Instagram Reels 1 条',
  'TikTok 短视频 2 条',
  '直播合作 1 场 + 数据截图',
  'YouTube Integrated Video 1 条',
  'TikTok 短视频 1 条',
  'Instagram 图文内容 2 组',
  'YouTube Dedicated Video 1 条',
  'Instagram Reels 1 条',
  '直播合作 1 场',
  'TikTok 短视频 2 条',
  'YouTube Integrated Video 1 条',
] as const;

type DemoContractSpec = {
  contractId: ContractId;
  contractCode: string;
  ioNumber: string;
  creatorIndex: number;
  amount: number;
  includeInInvoice: boolean;
  title: string;
};

const DEMO_CONTRACT_SPECS: DemoContractSpec[] = [
  {
    contractId: 'contract_fixture_301164_01' as ContractId,
    contractCode: 'CON-20260801-A30101',
    ioNumber: 'IO-20260801-A30101',
    creatorIndex: 0,
    amount: 2800,
    includeInInvoice: true,
    title: '短视频制作与发布',
  },
  {
    contractId: 'contract_fixture_301164_02' as ContractId,
    contractCode: 'CON-20260801-A30102',
    ioNumber: 'IO-20260801-A30102',
    creatorIndex: 0,
    amount: 2000,
    includeInInvoice: true,
    title: '内容授权补充协议',
  },
  {
    contractId: 'contract_fixture_301164_03' as ContractId,
    contractCode: 'CON-20260801-A30103',
    ioNumber: 'IO-20260801-A30103',
    creatorIndex: 1,
    amount: 3200,
    includeInInvoice: true,
    title: 'YouTube 整合视频合作',
  },
  {
    contractId: 'contract_fixture_301164_04' as ContractId,
    contractCode: 'CON-20260801-A30104',
    ioNumber: 'IO-20260801-A30104',
    creatorIndex: 2,
    amount: 2800,
    includeInInvoice: false,
    title: 'TikTok 短视频合作',
  },
  {
    contractId: 'contract_fixture_301164_05' as ContractId,
    contractCode: 'CON-20260801-A30105',
    ioNumber: 'IO-20260801-A30105',
    creatorIndex: 3,
    amount: 2400,
    includeInInvoice: true,
    title: 'Instagram Reels 合作',
  },
  {
    contractId: 'contract_fixture_301164_06' as ContractId,
    contractCode: 'CON-20260801-A30106',
    ioNumber: 'IO-20260801-A30106',
    creatorIndex: 4,
    amount: 2600,
    includeInInvoice: false,
    title: '社交媒体内容制作',
  },
  {
    contractId: 'contract_fixture_301164_07' as ContractId,
    contractCode: 'CON-20260801-A30107',
    ioNumber: 'IO-20260801-A30107',
    creatorIndex: 5,
    amount: 2200,
    includeInInvoice: true,
    title: '短视频与图片内容合作',
  },
  {
    contractId: 'contract_fixture_301164_08' as ContractId,
    contractCode: 'CON-20260801-A30108',
    ioNumber: 'IO-20260801-A30108',
    creatorIndex: 6,
    amount: 3000,
    includeInInvoice: true,
    title: 'YouTube Dedicated Video',
  },
  {
    contractId: 'contract_fixture_301164_09' as ContractId,
    contractCode: 'CON-20260801-A30109',
    ioNumber: 'IO-20260801-A30109',
    creatorIndex: 7,
    amount: 2400,
    includeInInvoice: true,
    title: 'Instagram Reels 合作',
  },
];

const demoProject = INITIAL_PROJECTS.find((project) => project.id === DEMO_PROJECT_CODE);
const demoReferences = demoProject?.creatorProfiles ?? [];
const creatorById = new Map(INITIAL_CREATORS.map((creator) => [creator.id, creator]));

if (!demoProject || demoReferences.length !== DEMO_INVOICE_AMOUNTS.length) {
  throw new Error(`${DEMO_PROJECT_CODE} 原型项目的达人关系与 Invoice fixture 数量不一致`);
}

const creatorForReference = (creatorId: CreatorId): CreatorProfile => {
  const creator = creatorById.get(creatorId);
  if (!creator) throw new Error(`原型达人 ${creatorId} 不存在`);
  return creator;
};

const EDIT_REQUEST_TIMESTAMP = '2026-08-02T08:42:00.000Z';
const editRequestPayout = INITIAL_PAYOUTS.find((payout) => payout.id === 'pay-013');
const editRequestProject = INITIAL_PROJECTS.find((project) => project.id === 'PRJ-260727-04');
const editRequestCreator = creatorForReference('creator-emily' as CreatorId);
const editRequestEngagement = editRequestProject?.creatorProfiles?.find((reference) => (
  reference.creatorId === editRequestCreator.id
));

if (
  !editRequestPayout
  || !editRequestProject
  || !editRequestEngagement
  || editRequestPayout.projectId !== editRequestProject.id
) {
  throw new Error('INV-240705 修改请求 fixture 缺少稳定的付款、项目、达人或合作关系');
}

const editRequestPayment = invoicePaymentForCreator(
  editRequestCreator,
  editRequestPayout.provider,
);

export const INVOICE_EDIT_REQUEST_INVOICES: GeneratedInvoiceRecord[] = [{
  id: editRequestPayout.invoice,
  invoiceId: 'invoice_fixture_edit_pay_013' as InvoiceId,
  sourcePayoutId: editRequestPayout.id,
  status: editRequestPayout.invoiceReviewStatus,
  generatedAt: EDIT_REQUEST_TIMESTAMP,
  snapshot: {
    invoiceNumber: editRequestPayout.invoice,
    invoiceDate: '2026-07-05',
    billTo: { ...INITIAL_INVOICE_ENTITY },
    creatorHandle: editRequestCreator.handle,
    creatorName: editRequestCreator.name,
    creatorId: editRequestCreator.id as CreatorId,
    engagementId: editRequestEngagement.engagementId,
    projectId: editRequestProject.projectId as ProjectId,
    projectName: editRequestProject.name,
    contractIds: [],
    from: { ...editRequestCreator.contact },
    currency: editRequestPayout.currency,
    items: [{
      id: 'invoice_line_fixture_edit_pay_013',
      description: editRequestPayout.deliverable || '达人内容合作服务费',
      unitPrice: editRequestPayout.amount,
      quantity: 1,
      lineTotal: editRequestPayout.amount,
    }],
    payoutAccountId: editRequestPayment.payoutAccountId,
    payoutAccountVersion: editRequestPayment.payoutAccountVersion,
    payoutProvider: editRequestPayment.payoutProvider,
    payoutAccountFingerprint: editRequestPayment.accountFingerprint,
    paymentMethod: editRequestPayout.provider === 'PayPal' ? 'paypal' : 'bank',
    payment: editRequestPayment,
  },
  validationStatus: 'valid',
  version: 1,
}];

const providerForCreator = (creator: CreatorProfile): Exclude<Provider, '手动打款'> => {
  const account = getDefaultPayoutAccount(creator.payoutAccounts);
  if (account?.provider === 'PayPal') return 'PayPal';
  if (account?.provider === 'PayMax') return 'PayMax';
  return 'Airwallex';
};

const accountFingerprintForCreator = (creator: CreatorProfile) => {
  const account = getDefaultPayoutAccount(creator.payoutAccounts);
  if (!account) return '待补充';
  if (account.provider === 'PayPal') return account.paypalEmail || account.paypalUsername;
  if (account.provider === 'PayMax') return account.payermaxAccountId;
  const value = (account.bankDetails.iban || account.bankDetails.accountNumber).replace(/\s/g, '');
  return value ? `•••• ${value.slice(-4)}` : '待补充';
};

export const PROJECT_DEMO_CONTRACTS: ContractRecord[] = DEMO_CONTRACT_SPECS.map((spec) => {
  const reference = demoReferences[spec.creatorIndex];
  const creator = creatorForReference(reference.creatorId);
  const provider = providerForCreator(creator);
  const payment = invoicePaymentForCreator(creator, provider);

  return {
    contractId: spec.contractId,
    id: spec.contractCode,
    ioId: spec.ioNumber,
    name: `${creator.name} · ${spec.title}`,
    templateFamily: '2026 KOL 社交媒体推广服务合同',
    sourceName: `${spec.contractCode}.pdf`,
    documentUrl: '',
    documentNote: '前端原型固定演示数据，不对应真实合同文件。',
    pageCount: 16,
    isTemplate: false,
    project: demoProject.name,
    brand: demoProject.brand,
    advertiser: 'COMETS INTERNATIONAL LIMITED',
    publisher: creator.contact.legalName || creator.name,
    channelName: creator.handle,
    channelLink: creator.socialAccounts[0]?.profileUrl ?? '',
    platform: creator.platform,
    effectiveDate: '2026-04-01',
    campaignStart: '2026-04-01',
    campaignEnd: '2026-06-30',
    currency: 'USD',
    totalFee: spec.amount,
    licensePrice: null,
    licenseIncludedInTotal: true,
    invoiceWithinWorkingDays: 5,
    paymentWithinWorkingDays: 45,
    feeBearer: 'ADVERTISER',
    paymentMethod: provider === 'PayPal' ? 'PAYPAL' : 'BANK',
    accountName: payment.accountName || creator.contact.legalName || creator.name,
    accountFingerprint: accountFingerprintForCreator(creator),
    payoutAccountId: payment.payoutAccountId,
    payoutAccountVersion: payment.payoutAccountVersion,
    payoutProvider: payment.payoutProvider === 'PayPal' ? 'PayPal' : 'Airwallex',
    payoutAccountFingerprint: payment.accountFingerprint,
    paymentSnapshot: { ...payment },
    signed: true,
    status: '已生效',
    updated: '2026-08-01',
    deliverables: [{
      id: `deliverable_fixture_301164_${String(spec.creatorIndex + 1).padStart(2, '0')}`,
      title: spec.title,
      description: DEMO_DELIVERABLES[spec.creatorIndex],
      source: `${spec.ioNumber} · Services/Deliverables`,
    }],
    issues: [],
    projectId: demoProject.projectId as ProjectId,
    creatorId: reference.creatorId,
    creatorHandle: creator.handle,
    engagementId: reference.engagementId,
    lifecycle: 'CONFIRMED',
    confirmedAt: DEMO_TIMESTAMP,
    extractionStage: 'applied',
  };
});

const coveredContractIds = (creatorId: CreatorId) => (
  PROJECT_DEMO_CONTRACTS
    .filter((contract) => (
      contract.creatorId === creatorId
      && DEMO_CONTRACT_SPECS.some((spec) => (
        spec.contractId === contract.contractId && spec.includeInInvoice
      ))
    ))
    .flatMap((contract) => contract.contractId ? [contract.contractId] : [])
);

const createInvoiceModel = (
  creator: CreatorProfile,
  reference: (typeof demoReferences)[number],
  index: number,
): InvoiceDocumentModel => {
  const provider = providerForCreator(creator);
  const payoutAccount = getDefaultPayoutAccount(creator.payoutAccounts);
  const amount = DEMO_INVOICE_AMOUNTS[index];
  const payment = invoicePaymentForCreator(creator, provider);

  return {
    invoiceNumber: `INV-301164-${String(index + 1).padStart(2, '0')}`,
    invoiceDate: '2026-07-31',
    billTo: { ...INITIAL_INVOICE_ENTITY },
    creatorHandle: creator.handle,
    creatorName: creator.name,
    creatorId: reference.creatorId,
    engagementId: reference.engagementId,
    projectId: demoProject.projectId as ProjectId,
    projectName: demoProject.name,
    contractIds: coveredContractIds(reference.creatorId),
    from: { ...creator.contact },
    currency: 'USD',
    items: [{
      id: `invoice_line_fixture_301164_${String(index + 1).padStart(2, '0')}`,
      description: DEMO_DELIVERABLES[index],
      unitPrice: amount,
      quantity: 1,
      lineTotal: amount,
    }],
    payoutAccountId: payment.payoutAccountId ?? payoutAccount?.id,
    payoutAccountVersion: payment.payoutAccountVersion,
    payoutProvider: payment.payoutProvider,
    payoutAccountFingerprint: payment.accountFingerprint,
    paymentMethod: provider === 'PayPal' ? 'paypal' : 'bank',
    payment,
  };
};

export const PROJECT_DEMO_INVOICES: GeneratedInvoiceRecord[] = demoReferences.map((reference, index) => {
  const creator = creatorForReference(reference.creatorId);
  const snapshot = createInvoiceModel(creator, reference, index);

  return {
    id: snapshot.invoiceNumber,
    invoiceId: `invoice_fixture_301164_${String(index + 1).padStart(2, '0')}` as InvoiceId,
    sourcePayoutId: `payout_fixture_301164_${String(index + 1).padStart(2, '0')}`,
    status: demoInvoiceReviewStatus(index),
    generatedAt: DEMO_TIMESTAMP,
    snapshot,
    validationStatus: 'valid',
    version: 1,
  };
});

export const PROJECT_DEMO_PAYOUTS: Payout[] = PROJECT_DEMO_INVOICES.map((invoice, index) => {
  const reference = demoReferences[index];
  const creator = creatorForReference(reference.creatorId);
  const provider = providerForCreator(creator);
  const firstContract = PROJECT_DEMO_CONTRACTS.find((contract) => (
    invoice.snapshot.contractIds?.includes(contract.contractId as ContractId)
  ));
  const accountValue = invoice.snapshot.paymentMethod === 'paypal'
    ? invoice.snapshot.payment.paypalEmail || invoice.snapshot.payment.paypalUsername
    : accountFingerprintForCreator(creator);

  const reviewStatus = demoInvoiceReviewStatus(index);
  const reviewFixture: Partial<Payout> = index === 0
    ? {
        creatorFeedback: {
          reason: '请将 Invoice 联系地址更新为最新的合成测试地址。',
          actorName: '原型达人',
          occurredAt: '2026-08-04T09:00:00.000Z',
        },
        issue: '达人反馈：请更新联系地址。',
      }
    : index === 1
      ? {
          invoiceSignedAt: '2026-08-04T10:00:00.000Z',
          invoiceReviewReturn: {
            stage: 'PM',
            reason: '请复核费用说明后重新提交。',
            actorName: '原型 PM',
            occurredAt: '2026-08-04T11:00:00.000Z',
          },
          issue: '项目审批退回：请复核费用说明后重新提交。',
          returnReason: '请复核费用说明后重新提交。',
        }
      : index === 2
        ? {
            invoiceSignedAt: '2026-08-03T10:00:00.000Z',
            paymentFailure: {
              provider: 'Airwallex',
              errorCode: 'SYNTHETIC_PAYOUT_ACCOUNT_REJECTED',
              providerResponse: 'Synthetic beneficiary account was rejected.',
              occurredAt: '2026-08-04T12:00:00.000Z',
            },
            paymentFailureReturn: {
              issueType: 'INVOICE_CONTENT',
              reason: 'Invoice 收款账户不可用，请选择新的已验证账户后重新签署。',
              actorAccount: 'finance.prototype',
              actorName: '原型财务',
              occurredAt: '2026-08-04T12:30:00.000Z',
              restartStage: 'SIGNATURE',
            },
            issue: '付款失败已退回：Invoice 收款账户不可用。',
            returnReason: 'Invoice 收款账户不可用，请选择新的已验证账户后重新签署。',
          }
        : index === 3
          ? {
              invoiceSignedAt: '2026-08-03T11:00:00.000Z',
              paymentFailure: {
                provider: 'Airwallex',
                errorCode: 'SYNTHETIC_PAYMENT_LIST_STALE',
                providerResponse: 'Synthetic payment-list snapshot is stale.',
                occurredAt: '2026-08-04T13:00:00.000Z',
              },
              paymentFailureReturn: {
                issueType: 'PAYMENT_LIST',
                reason: '付款清单账户快照需要更新。',
                actorAccount: 'finance.prototype',
                actorName: '原型财务',
                occurredAt: '2026-08-04T13:30:00.000Z',
                restartStage: 'PAYMENT_LIST_RESUBMISSION',
              },
              issue: '付款失败已退回：付款清单账户快照需要更新。',
              returnReason: '付款清单账户快照需要更新。',
            }
          : {};
  return {
    id: invoice.sourcePayoutId,
    creator: creator.name,
    handle: creator.handle,
    initials: creator.initials,
    projectId: demoProject.projectId as ProjectId,
    project: demoProject.name,
    deliverable: DEMO_DELIVERABLES[index],
    contract: firstContract?.id ?? '未关联合同（非必填）',
    invoice: invoice.id,
    provider,
    currency: invoice.snapshot.currency,
    amount: DEMO_INVOICE_AMOUNTS[index],
    account: accountValue,
    creatorId: invoice.snapshot.creatorId,
    payoutAccountId: invoice.snapshot.payoutAccountId,
    payoutAccountVersion: invoice.snapshot.payoutAccountVersion,
    payoutAccountFingerprint: invoice.snapshot.payoutAccountFingerprint,
    externalBeneficiaryId: invoice.snapshot.payment.externalBeneficiaryId,
    transferMethod: invoice.snapshot.payment.transferMethod,
    localClearingSystem: invoice.snapshot.payment.localClearingSystem,
    feeBearer: firstContract?.feeBearer ?? '',
    status: reviewStatus === '已通过' ? '已付款' : reviewStatus === '已退回' ? '已退回' : '未进入付款',
    invoiceReviewStatus: reviewStatus,
    invoiceVersion: 1,
    invoiceSignedAt: reviewStatus === '已通过' ? '2026-07-31T10:00:00.000Z' : undefined,
    invoiceSnapshot: invoice.snapshot,
    accent: creator.accent,
    paidAt: reviewStatus === '已通过' ? '2026-08-01 16:00' : undefined,
    ...reviewFixture,
  };
});

export const PROJECT_DEMO_TOTAL = PROJECT_DEMO_INVOICES.reduce(
  (total, invoice) => total + invoice.snapshot.items.reduce(
    (invoiceTotal, item) => invoiceTotal + item.lineTotal,
    0,
  ),
  0,
);

const projectBudget = (budget: string) => {
  const [currency = 'USD'] = budget.trim().split(/\s+/);
  const amount = Number(budget.replace(/[^0-9.]/g, ''));
  return { currency, amount };
};

const distributeProjectBudget = (amount: number, count: number) => {
  if (!count) return [];
  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / count);
  return Array.from({ length: count }, (_, index) => (
    (index === count - 1
      ? totalCents - baseCents * (count - 1)
      : baseCents) / 100
  ));
};

const prototypePaymentAccount = (creator: CreatorProfile) => (
  eligibleInvoicePayoutAccounts(creator).find((account) => account.provider === 'Airwallex')
  ?? eligibleInvoicePayoutAccounts(creator).find((account) => account.provider === 'PayPal')
  ?? getDefaultPayoutAccount(creator.payoutAccounts)
);

const requestStatusPaymentListState = (
  projectId: string,
  requestStatus: string,
): PaymentListRecord['status'] => {
  if (requestStatus === '待补资料') return 'draft';
  if (requestStatus === '已退回') {
    return projectId === 'PRJ-260801-08' ? 'draft' : 'submitted';
  }
  if (requestStatus === '待打款') return 'approved';
  if (requestStatus === '已完成') return 'paid';
  return 'submitted';
};

const invoiceReviewState = (
  paymentListStatus: PaymentListRecord['status'],
): Payout['invoiceReviewStatus'] => {
  if (paymentListStatus === 'draft') return '待媒介审核';
  if (paymentListStatus === 'submitted') return '待PM审核';
  return '已通过';
};

const payoutStatus = (
  paymentListStatus: PaymentListRecord['status'],
): Payout['status'] => {
  if (paymentListStatus === 'approved') return '等待付款';
  if (paymentListStatus === 'paid') return '已付款';
  return '未进入付款';
};

const preservedInvoiceByEngagement = new Map<EngagementId, GeneratedInvoiceRecord>([
  ...PROJECT_DEMO_INVOICES,
  ...INVOICE_EDIT_REQUEST_INVOICES,
].flatMap((invoice) => (
  invoice.snapshot.engagementId
    ? [[invoice.snapshot.engagementId as EngagementId, invoice] as const]
    : []
)));

const prototypeInvoiceAmounts = new Map<EngagementId, number>();
INITIAL_PROJECTS.forEach((project) => {
  const references = project.creatorProfiles ?? [];
  const { amount } = projectBudget(project.budget);
  const fixedTotal = references.reduce((total, reference) => {
    const preserved = preservedInvoiceByEngagement.get(reference.engagementId);
    return total + (preserved
      ? preserved.snapshot.items.reduce((sum, item) => sum + item.lineTotal, 0)
      : 0);
  }, 0);
  const generatedReferences = references.filter((reference) => (
    !preservedInvoiceByEngagement.has(reference.engagementId)
  ));
  const distributed = distributeProjectBudget(amount - fixedTotal, generatedReferences.length);
  references.forEach((reference) => {
    const preserved = preservedInvoiceByEngagement.get(reference.engagementId);
    if (preserved) {
      prototypeInvoiceAmounts.set(
        reference.engagementId,
        preserved.snapshot.items.reduce((sum, item) => sum + item.lineTotal, 0),
      );
      return;
    }
    const index = generatedReferences.findIndex((item) => item.engagementId === reference.engagementId);
    prototypeInvoiceAmounts.set(reference.engagementId, distributed[index] ?? 0);
  });
});

const createPrototypeInvoice = (
  project: (typeof INITIAL_PROJECTS)[number],
  reference: NonNullable<(typeof INITIAL_PROJECTS)[number]['creatorProfiles']>[number],
  projectIndex: number,
  creatorIndex: number,
): GeneratedInvoiceRecord => {
  const creator = creatorForReference(reference.creatorId);
  const account = prototypePaymentAccount(creator);
  const payment = createDocumentPayoutSnapshot(account, creator.id);
  const provider = account?.provider === 'PayPal' ? 'PayPal' : 'Airwallex';
  const amount = prototypeInvoiceAmounts.get(reference.engagementId) ?? 0;
  const projectPart = String(projectIndex + 1).padStart(2, '0');
  const creatorPart = String(creatorIndex + 1).padStart(2, '0');
  const invoiceNumber = `INV-${project.id.replace(/^PRJ-/, '')}-${creatorPart}`;
  const invoiceId = `invoice_fixture_${projectPart}_${creatorPart}` as InvoiceId;
  const generatedAt = `2026-08-${String((projectIndex % 5) + 1).padStart(2, '0')}T09:00:00.000Z`;

  return {
    id: invoiceNumber,
    invoiceId,
    sourcePayoutId: `payout_fixture_${projectPart}_${creatorPart}`,
    status: invoiceId === AVAILABLE_PAYMENT_REQUEST_INVOICE_ID
      ? '待发起请款'
      : invoiceReviewState(requestStatusPaymentListState(project.id, PROJECT_FIXTURES[projectIndex].requestStatus)),
    generatedAt,
    validationStatus: 'valid',
    version: 1,
    snapshot: {
      invoiceNumber,
      invoiceDate: generatedAt.slice(0, 10),
      billTo: { ...INITIAL_INVOICE_ENTITY },
      creatorHandle: creator.handle,
      creatorName: creator.name,
      creatorId: reference.creatorId,
      engagementId: reference.engagementId,
      projectId: project.projectId as ProjectId,
      projectName: project.name,
      contractIds: [],
      from: { ...creator.contact },
      currency: projectBudget(project.budget).currency as InvoiceDocumentModel['currency'],
      items: [{
        id: `invoice_line_fixture_${projectPart}_${creatorPart}`,
        description: `${project.brand} 创作者内容合作服务`,
        unitPrice: amount,
        quantity: 1,
        lineTotal: amount,
      }],
      payoutAccountId: payment.payoutAccountId,
      payoutAccountVersion: payment.payoutAccountVersion,
      payoutProvider: provider,
      payoutAccountFingerprint: payment.accountFingerprint,
      paymentMethod: provider === 'PayPal' ? 'paypal' : 'bank',
      payment,
    },
  };
};

export const ALL_PROJECT_PROTOTYPE_INVOICES: GeneratedInvoiceRecord[] = INITIAL_PROJECTS.flatMap(
  (project, projectIndex) => (project.creatorProfiles ?? []).map((reference, creatorIndex) => (
    preservedInvoiceByEngagement.get(reference.engagementId)
    ?? createPrototypeInvoice(project, reference, projectIndex, creatorIndex)
  )),
);

const initialPayoutIds = new Set(INITIAL_PAYOUTS.map((payout) => payout.id));
const preservedDemoPayoutBySourceId = new Map(
  PROJECT_DEMO_PAYOUTS.map((payout) => [payout.id, payout]),
);

export const ALL_PROJECT_PROTOTYPE_PAYOUTS: Payout[] = ALL_PROJECT_PROTOTYPE_INVOICES.flatMap((invoice) => {
  const preserved = preservedDemoPayoutBySourceId.get(invoice.sourcePayoutId);
  if (preserved) return [preserved];
  if (initialPayoutIds.has(invoice.sourcePayoutId)) return [];
  const projectIndex = INITIAL_PROJECTS.findIndex((project) => project.projectId === invoice.snapshot.projectId);
  const project = INITIAL_PROJECTS[projectIndex];
  const creator = creatorForReference(invoice.snapshot.creatorId as CreatorId);
  const listStatus = requestStatusPaymentListState(project.id, PROJECT_FIXTURES[projectIndex].requestStatus);
  const isAvailableRequestDemo = invoice.invoiceId === AVAILABLE_PAYMENT_REQUEST_INVOICE_ID;
  const rawAccount = invoice.snapshot.paymentMethod === 'paypal'
    ? invoice.snapshot.payment.paypalEmail || invoice.snapshot.payment.paypalUsername
    : invoice.snapshot.payment.iban || invoice.snapshot.payment.accountNumber;
  return [{
    id: invoice.sourcePayoutId,
    creator: creator.name,
    handle: creator.handle,
    initials: creator.initials,
    projectId: project.id,
    project: project.name,
    deliverable: invoice.snapshot.items[0]?.description ?? '创作者内容合作服务',
    contract: '未关联合同（非必填）',
    invoice: invoice.id,
    provider: invoice.snapshot.paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex',
    currency: invoice.snapshot.currency,
    amount: invoice.snapshot.items.reduce((total, item) => total + item.lineTotal, 0),
    account: rawAccount ? `•••• ${rawAccount.replace(/\s/g, '').slice(-4)}` : '待补充',
    creatorId: invoice.snapshot.creatorId,
    payoutAccountId: invoice.snapshot.payoutAccountId,
    payoutAccountVersion: invoice.snapshot.payoutAccountVersion,
    payoutAccountFingerprint: invoice.snapshot.payoutAccountFingerprint,
    externalBeneficiaryId: invoice.snapshot.payment.externalBeneficiaryId,
    transferMethod: invoice.snapshot.payment.transferMethod,
    localClearingSystem: invoice.snapshot.payment.localClearingSystem,
    feeBearer: 'ADVERTISER',
    status: isAvailableRequestDemo ? '未进入付款' : payoutStatus(listStatus),
    invoiceReviewStatus: isAvailableRequestDemo ? '待发起请款' : invoiceReviewState(listStatus),
    invoiceVersion: 1,
    invoiceSignedAt: ['approved', 'paid'].includes(listStatus) ? '2026-08-02T10:00:00.000Z' : undefined,
    invoiceSnapshot: invoice.snapshot,
    accent: creator.accent,
    paidAt: listStatus === 'paid' ? '2026-08-05 16:00' : undefined,
  }];
});

const cloneFixtureItems = (items: PaymentListItem[]) => items.map((item) => ({
  ...item,
  snapshot: {
    ...item.snapshot,
    contractIds: item.snapshot.contractIds ? [...item.snapshot.contractIds] : undefined,
  },
  accountOverride: item.accountOverride ? { ...item.accountOverride } : undefined,
  overrides: { ...item.overrides },
  validationIssues: item.validationIssues ? [...item.validationIssues] : undefined,
}));

export const ALL_PROJECT_PROTOTYPE_PAYMENT_LISTS: PaymentListRecord[] = INITIAL_PROJECTS.map(
  (project, projectIndex) => {
    const projectInvoices = ALL_PROJECT_PROTOTYPE_INVOICES.filter((invoice) => (
      invoice.snapshot.projectId === project.projectId
    ));
    const status = requestStatusPaymentListState(project.id, PROJECT_FIXTURES[projectIndex].requestStatus);
    const hasHistory = status !== 'draft' || project.id === 'PRJ-260801-08';
    const generatedAt = `2026-08-${String((projectIndex % 5) + 1).padStart(2, '0')}T12:00:00.000Z`;
    const actor = {
      account: 'prototype.fixture',
      name: '原型数据生成器',
      role: '系统原型',
    };
    const items = projectInvoices.map((invoice, invoiceIndex) => {
      const originalItem = invoicePaymentListItem(invoice, PROJECT_DEMO_CONTRACTS);
      const creator = creatorForReference(invoice.snapshot.creatorId as CreatorId);
      const airwallexAccount = eligibleInvoicePayoutAccounts(creator).find((account) => (
        account.provider === 'Airwallex'
      ));
      const item = paymentListEffectiveAccount(originalItem).provider === 'Airwallex' || !airwallexAccount
        ? originalItem
        : applyPaymentListPayoutSnapshot(
            originalItem,
            createDocumentPayoutSnapshot(airwallexAccount, creator.id),
          );
      const historical = status !== 'draft';
      return {
        ...item,
        id: `payment_item_fixture_${String(projectIndex + 1).padStart(2, '0')}_${String(invoiceIndex + 1).padStart(2, '0')}`,
        snapshot: {
          ...item.snapshot,
          feeBearer: item.snapshot.feeBearer || 'ADVERTISER',
          transactionReference: historical
            ? `${project.id}-AWX-${String(invoiceIndex + 1).padStart(2, '0')}`
            : '',
          description: '',
        },
        requiresRevalidation: historical ? false : true,
        validationIssues: historical ? [] : ['交易附言未填写'],
        lastValidatedAt: historical ? generatedAt : undefined,
      };
    });
    const historicalItems = project.id === 'PRJ-260801-08'
      ? items.map((item, invoiceIndex) => ({
          ...item,
          snapshot: {
            ...item.snapshot,
            transactionReference: `${project.id}-AWX-${String(invoiceIndex + 1).padStart(2, '0')}`,
          },
          requiresRevalidation: false,
          validationIssues: [],
          lastValidatedAt: generatedAt,
        }))
      : items;
    const versionSnapshot = hasHistory ? [{
      version: 1,
      generatedAt,
      generatedBy: actor,
      items: cloneFixtureItems(historicalItems),
    }] : undefined;
    const paymentListCode = project.paymentOrder && project.paymentOrder !== '待生成'
      ? project.paymentOrder
      : `PAY-${project.id.replace(/^PRJ-/, '')}-01`;
    return {
      paymentListId: `payment_list_fixture_${String(projectIndex + 1).padStart(2, '0')}` as PaymentListRecord['paymentListId'],
      paymentListCode,
      projectId: project.projectId as ProjectId,
      provider: 'Airwallex',
      status,
      version: hasHistory ? 1 : 0,
      generatedAt: hasHistory ? generatedAt : undefined,
      generatedBy: hasHistory ? actor : undefined,
      versions: versionSnapshot,
      draftFromVersion: project.id === 'PRJ-260801-08' ? 1 : undefined,
      items,
      createdAt: DEMO_TIMESTAMP,
      updatedAt: project.id === 'PRJ-260801-08' ? '2026-08-01T10:35:00.000Z' : generatedAt,
    };
  },
);
