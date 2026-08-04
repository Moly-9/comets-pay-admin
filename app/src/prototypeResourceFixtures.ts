import type { ContractRecord } from './contracts';
import { INITIAL_INVOICE_ENTITY } from './data';
import {
  getDefaultPayoutAccount,
  invoicePaymentForCreator,
} from './payoutAccounts';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from './pages/OperationalPages';
import type {
  ContractId,
  CreatorId,
  InvoiceId,
  ProjectId,
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
  const amount = DEMO_INVOICE_AMOUNTS[index];

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
    paymentMethod: provider === 'PayPal' ? 'paypal' : 'bank',
    payment: invoicePaymentForCreator(creator, provider),
  };
};

export const PROJECT_DEMO_INVOICES: GeneratedInvoiceRecord[] = demoReferences.map((reference, index) => {
  const creator = creatorForReference(reference.creatorId);
  const snapshot = createInvoiceModel(creator, reference, index);

  return {
    id: snapshot.invoiceNumber,
    invoiceId: `invoice_fixture_301164_${String(index + 1).padStart(2, '0')}` as InvoiceId,
    sourcePayoutId: `payout_fixture_301164_${String(index + 1).padStart(2, '0')}`,
    status: '已通过',
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
    status: '已付款',
    invoiceReviewStatus: '已通过',
    invoiceVersion: 1,
    invoiceSignedAt: '2026-07-31T10:00:00.000Z',
    invoiceSnapshot: invoice.snapshot,
    accent: creator.accent,
    paidAt: '2026-08-01 16:00',
  };
});

export const PROJECT_DEMO_TOTAL = PROJECT_DEMO_INVOICES.reduce(
  (total, invoice) => total + invoice.snapshot.items.reduce(
    (invoiceTotal, item) => invoiceTotal + item.lineTotal,
    0,
  ),
  0,
);
