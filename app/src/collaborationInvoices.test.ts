import { describe, expect, it } from 'vitest';
import type { ContractRecord } from './contracts';
import type { PaymentListRecord } from './businessWorkflow';
import {
  buildCollaborationInvoiceRows,
  collaborationLifecycleStatus,
} from './collaborationInvoices';
import { buildInvoiceReviewModel } from './invoice/invoiceReview';
import type { ProjectSummary } from './pages/ProjectDetailPage';
import type { RequestProjectSummary } from './pages/RequestProjectDetailPage';
import type { CreatorProfile, GeneratedInvoiceRecord, Payout } from './types';

const creator = {
  id: 'creator-1',
  name: 'Mina Display',
  handle: '@mina',
  platform: 'Instagram',
  initials: 'MD',
  accent: '#786e9c',
  region: '新加坡',
  projects: 1,
  socialAccounts: [{ id: 'social-1', handle: '@mina-reels', platform: 'Instagram', profileUrl: '' }],
  contact: { legalName: 'Mina Studio', address: '', phone: '', email: '' },
  payoutAccounts: [],
} as CreatorProfile;

const project = {
  projectId: 'project-1',
  cooperationProjectId: 'project-1',
  projectCode: 'PRJ-001',
  cooperationProjectCode: 'PRJ-001',
  name: '夏日合作',
  brand: 'COMETS',
  media: '媒介 A',
  pm: 'PM A',
  creators: 1,
  budget: 'USD 2,000',
  status: '进行中',
} as unknown as ProjectSummary;

const contract = (id: string, code: string): ContractRecord => ({
  contractId: id as ContractRecord['contractId'],
  id: code,
  name: `${code} 合同`,
  contractType: 'INDEPENDENT',
  ioId: '',
  templateFamily: '',
  sourceName: '',
  documentUrl: '',
  isTemplate: false,
  project: project.name,
  brand: project.brand,
  advertiser: 'COMETS',
  publisher: 'Mina Studio',
  channelName: '@mina',
  channelLink: '',
  platform: 'Instagram',
  effectiveDate: '2026-08-01',
  campaignStart: '2026-08-01',
  campaignEnd: '2026-08-31',
  currency: 'USD',
  totalFee: 1000,
  licensePrice: null,
  licenseIncludedInTotal: true,
  invoiceWithinWorkingDays: 5,
  paymentWithinWorkingDays: 45,
  feeBearer: 'ADVERTISER',
  paymentMethod: 'BANK',
  accountName: 'Mina Studio',
  accountFingerprint: 'fixture',
  signed: true,
  updated: '2026-08-01',
  deliverables: [],
  issues: [],
});

const invoice = {
  id: 'INV-001',
  invoiceId: 'invoice-1',
  invoiceType: 'INTERNAL',
  sourcePayoutId: 'payout-1',
  status: '已通过',
  generatedAt: '2026-08-01T01:00:00.000Z',
  validationStatus: 'valid',
  version: 1,
  snapshot: {
    invoiceNumber: 'INV-001',
    invoiceDate: '2026-08-01',
    creatorId: creator.id,
    creatorName: '历史名称',
    creatorHandle: '@mina-reels',
    creatorSocialAccountId: 'social-1',
    creatorPlatform: 'Instagram',
    projectId: 'project-1',
    cooperationProjectId: 'project-1',
    projectName: project.name,
    contractIds: ['contract-1', 'contract-2'],
    billTo: { name: 'COMETS', address: '' },
    from: creator.contact,
    currency: 'USD',
    items: [
      { id: 'line-1', description: 'Instagram Reels 一条', unitPrice: 600, quantity: 1, lineTotal: 600 },
      { id: 'line-2', description: 'Story 两条', unitPrice: 200, quantity: 2, lineTotal: 400 },
    ],
    paymentMethod: 'bank',
    payment: {},
  },
} as unknown as GeneratedInvoiceRecord;

const payout = {
  id: 'payout-1',
  creator: '历史名称',
  creatorId: creator.id,
  handle: '@mina-reels',
  initials: 'HM',
  accent: '#444',
  projectId: 'project-1',
  project: project.name,
  contract: 'CON-LEGACY',
  invoice: invoice.id,
  provider: 'Airwallex',
  currency: 'USD',
  amount: 1000,
  account: '0000001234',
  status: '未进入付款',
  invoiceReviewStatus: '已通过',
} as Payout;

const request = {
  id: 'REQ-001',
  requestCode: 'REQ-001',
  paymentRequestProjectId: 'request-1',
  cooperationProjectId: 'project-1',
  lifecycle: 'SUBMITTED',
  media: '媒介 A',
  project: project.name,
  brand: project.brand,
  pm: project.pm,
  amount: 'USD 1,000',
  contracts: 2,
  invoices: 1,
  paymentOrder: 'PAY-001',
  status: 'PM审批中',
  filter: 'pending',
  creatorLinks: [{
    creatorId: creator.id,
    engagementId: 'engagement-1',
    contractIds: ['contract-1', 'contract-2'],
    invoiceIds: ['invoice-1'],
  }],
  approval: {
    status: 'PENDING_PM',
    round: 2,
    history: [],
    submittedAt: '2026-08-05T02:00:00.000Z',
    submissionHistory: [
      { round: 1, submittedAt: '2026-08-03T02:00:00.000Z' },
      { round: 2, submittedAt: '2026-08-05T02:00:00.000Z' },
    ],
    updatedAt: '2026-08-05T02:00:00.000Z',
  },
} as unknown as RequestProjectSummary;

const paymentList = {
  paymentListId: 'payment-list-1',
  paymentListCode: 'PAY-001',
  projectId: 'project-1',
  paymentRequestProjectId: 'request-1',
  provider: 'Airwallex',
  status: 'submitted',
  items: [{
    id: 'item-1',
    engagementId: 'engagement-1',
    invoiceId: 'invoice-1',
    snapshot: { invoiceNumber: 'INV-001', amount: 1000, currency: 'USD' },
    overrides: {},
  }],
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-05T02:00:00.000Z',
} as unknown as PaymentListRecord;

describe('buildCollaborationInvoiceRows', () => {
  it('builds one Invoice row with stable creator, project, contracts and current-round request time', () => {
    const rows = buildCollaborationInvoiceRows({
      creators: [creator],
      projects: [project],
      contracts: [contract('contract-1', 'CON-001'), contract('contract-2', 'CON-002')],
      payouts: [payout],
      generatedInvoices: [invoice],
      externalInvoices: [],
      requests: [request],
      paymentLists: [paymentList],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowId: 'invoice:invoice-1',
      invoiceNumber: 'INV-001',
      descriptionText: 'Instagram Reels 一条；Story 两条',
      projectName: '夏日合作',
      requestSubmittedAt: '2026-08-05T02:00:00.000Z',
      status: 'PM审批中',
    });
    expect(rows[0].descriptions).toEqual(['Instagram Reels 一条', 'Story 两条']);
    expect(rows[0].identity.displayName).toBe('Mina Display');
    expect(rows[0].contracts.map((item) => item.id)).toEqual(['CON-001', 'CON-002']);
    expect(rows[0].requestSubmissions).toHaveLength(2);
  });

  it('uses the same Description fallback as Invoice detail for a historical Payout without a snapshot', () => {
    const historicalPayout = {
      ...payout,
      id: 'payout-historical',
      invoice: 'INV-HISTORICAL',
      deliverable: undefined,
      invoiceSnapshot: undefined,
    } as Payout;
    const reviewModel = buildInvoiceReviewModel(
      historicalPayout,
      [creator],
      { name: 'COMETS', address: '' },
    );
    const rows = buildCollaborationInvoiceRows({
      creators: [creator],
      projects: [project],
      contracts: [],
      payouts: [historicalPayout],
      generatedInvoices: [],
      externalInvoices: [],
      requests: [],
      paymentLists: [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].descriptions).toEqual(reviewModel.items.map((item) => item.description));
    expect(rows[0].descriptionText).toBe(reviewModel.items[0].description);
  });

  it('does not include external collection tasks without a generated Invoice record', () => {
    const rows = buildCollaborationInvoiceRows({
      creators: [creator],
      projects: [project],
      contracts: [],
      payouts: [],
      generatedInvoices: [],
      externalInvoices: [{ invoiceId: 'external-task', invoiceNumber: undefined } as never],
      requests: [],
      paymentLists: [],
    });

    expect(rows).toEqual([]);
  });

  it('deduplicates an approved external Invoice by its stable invoiceId', () => {
    const externalInvoice = {
      invoiceId: invoice.invoiceId,
      invoiceType: 'EXTERNAL',
      invoiceNumber: invoice.id,
      projectId: 'project-1',
      projectName: project.name,
      creatorId: creator.id,
      creatorName: creator.name,
      creatorHandle: creator.handle,
      contractIds: [],
      status: 'APPROVED',
    } as never;
    const rows = buildCollaborationInvoiceRows({
      creators: [creator],
      projects: [project],
      contracts: [],
      payouts: [payout],
      generatedInvoices: [{ ...invoice, invoiceType: 'EXTERNAL' }],
      externalInvoices: [externalInvoice],
      requests: [],
      paymentLists: [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].externalInvoice).toBe(externalInvoice);
    expect(rows[0].invoiceType).toBe('EXTERNAL');
  });

  it('keeps missing IDs and legacy contract references read-only without name matching', () => {
    const legacyPayout = {
      ...payout,
      id: 'legacy-payout',
      creatorId: undefined,
      projectId: 'missing-project-id',
      contract: 'CON-HISTORICAL',
      invoice: 'INV-LEGACY',
      invoiceSnapshot: {
        ...invoice.snapshot,
        invoiceNumber: 'INV-LEGACY',
        creatorId: undefined,
        projectId: 'missing-project-id',
        cooperationProjectId: undefined,
        contractIds: [],
      },
    } as unknown as Payout;
    const rows = buildCollaborationInvoiceRows({
      creators: [creator],
      projects: [project],
      contracts: [contract('another-id', 'CON-HISTORICAL')],
      payouts: [legacyPayout],
      generatedInvoices: [],
      externalInvoices: [],
      requests: [],
      paymentLists: [],
    });

    expect(rows[0].projectMissing).toBe(true);
    expect(rows[0].identity.creator).toBeUndefined();
    expect(rows[0].identity.displayName).toBe('历史名称');
    expect(rows[0].contracts).toEqual([]);
    expect(rows[0].legacyContractReference).toBe('CON-HISTORICAL');
  });
});

describe('collaborationLifecycleStatus', () => {
  it('prioritizes payment failure and completion over approval state', () => {
    expect(collaborationLifecycleStatus({ payout: { ...payout, status: '付款失败' }, request })).toBe('付款失败');
    expect(collaborationLifecycleStatus({ payout: { ...payout, status: '已付款' }, request })).toBe('已付款');
  });

  it.each([
    ['信息异常', '信息异常'],
    ['付款处理中', '付款处理中'],
    ['等待付款', '待打款'],
  ] as const)('maps payout status %s to %s', (sourceStatus, expected) => {
    expect(collaborationLifecycleStatus({ payout: { ...payout, status: sourceStatus } })).toBe(expected);
  });

  it.each([
    ['草稿', '草稿'],
    ['待签署', '待签署'],
    ['达人反馈', '达人反馈'],
    ['待媒介审核', '待审核'],
    ['待媒介复核', '待复核'],
    ['已退回', '已退回'],
  ] as const)('maps Invoice review status %s to %s without a payout row', (invoiceStatus, expected) => {
    expect(collaborationLifecycleStatus({ invoiceStatus })).toBe(expected);
  });

  it('maps request drafts and approval nodes after Invoice review completes', () => {
    expect(collaborationLifecycleStatus({ request: { ...request, lifecycle: 'DRAFT' } })).toBe('请款草稿');
    expect(collaborationLifecycleStatus({ request })).toBe('PM审批中');
    expect(collaborationLifecycleStatus({})).toBe('待发起请款');
  });
});
