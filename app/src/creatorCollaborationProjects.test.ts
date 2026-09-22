import { describe, expect, it } from 'vitest';
import type { CreatorId, CooperationProjectId, ProjectId } from './businessWorkflow';
import type { ContractRecord } from './contracts';
import type { ExternalInvoiceCollectionRecord } from './invoice/externalInvoiceCollection';
import type { ProjectSummary } from './pages/ProjectDetailPage';
import type { RequestProjectSummary } from './pages/RequestProjectDetailPage';
import type { GeneratedInvoiceRecord, Payout } from './types';
import {
  buildCreatorCollaborationProjects,
  creatorCollaborationProjectsFor,
  type CreatorCollaborationProjectSources,
} from './creatorCollaborationProjects';

const creatorA = 'creator-a' as CreatorId;
const creatorB = 'creator-b' as CreatorId;

const sources = (overrides: Partial<CreatorCollaborationProjectSources> = {}): CreatorCollaborationProjectSources => ({
  projects: [],
  contracts: [],
  generatedInvoices: [],
  externalInvoices: [],
  requests: [],
  payouts: [],
  referenceDate: '2026-09-19',
  ...overrides,
});

const contractFor = (id: string, end: string, overrides: Partial<ContractRecord> = {}) => ({
  id,
  contractId: id,
  creatorId: creatorA,
  projectId: 'project-contract',
  project: '合同项目',
  platform: 'Instagram',
  signed: true,
  lifecycle: 'CONFIRMED',
  campaignEnd: end,
  ...overrides,
} as ContractRecord);

const invoiceFor = (id: string, payoutId: string) => ({
  invoiceId: id,
  sourcePayoutId: payoutId,
  snapshot: {
    creatorId: creatorA,
    projectId: 'project-invoice',
    projectName: 'Invoice 项目',
    creatorHandle: '@same-handle',
  },
} as GeneratedInvoiceRecord);

const payoutFor = (id: string, status: Payout['status'], overrides: Partial<Payout> = {}) => ({
  id,
  creatorId: creatorA,
  projectId: 'project-invoice',
  project: 'Invoice 项目',
  handle: '@same-handle',
  status,
  ...overrides,
} as Payout);

const project = (
  id: string,
  creatorId: CreatorId,
  status: 'active' | 'removed',
): ProjectSummary => ({
  id,
  projectId: id as ProjectId,
  cooperationProjectId: id as CooperationProjectId,
  cooperationProjectCode: id,
  name: `项目 ${id}`,
  brand: `品牌 ${id}`,
  media: '媒介',
  pm: '媒介负责人',
  creators: 1,
  budget: 'USD 1,000',
  status: status === 'active' ? '执行中' : '已完成',
  creatorProfiles: [{
    creatorId,
    engagementId: `engagement-${id}` as NonNullable<ProjectSummary['creatorProfiles']>[number]['engagementId'],
    status,
    name: '同名达人',
    handle: '@same-handle',
    platform: 'Instagram',
    socialAccountId: `social-${creatorId}`,
  }],
});

describe('buildCreatorCollaborationProjects', () => {
  it('按稳定 ID 聚合当前和历史项目，并对各业务资源去重', () => {
    const currentProject = project('project-current', creatorA, 'active');
    const historicalProject = project('project-history', creatorA, 'removed');
    const sameNameOtherCreatorProject = project('project-other-creator', creatorB, 'active');
    const contract = {
      id: 'contract-history',
      contractId: 'contract-history',
      creatorId: creatorA,
      creatorHandle: '@same-handle',
      creatorSocialAccountId: `social-${creatorA}`,
      creatorPlatform: 'Instagram',
      project: '项目 project-history',
      brand: '历史品牌',
      platform: 'Instagram',
      projectLinks: [{ cooperationProjectId: 'project-history', status: 'ENDED' }],
    } as unknown as ContractRecord;
    const generatedInvoice = {
      invoiceId: 'invoice-current',
      snapshot: {
        creatorId: creatorA,
        projectId: 'project-current',
        projectName: '项目 project-current',
        creatorHandle: '@same-handle',
        creatorSocialAccountId: `social-${creatorA}`,
        creatorPlatform: 'Instagram',
      },
    } as unknown as GeneratedInvoiceRecord;
    const externalInvoice = {
      invoiceId: 'invoice-history',
      creatorId: creatorA,
      projectId: 'project-history',
      projectName: '项目 project-history',
      creatorHandle: '@same-handle',
      creatorSocialAccountId: `social-${creatorA}`,
      creatorPlatform: 'Instagram',
    } as unknown as ExternalInvoiceCollectionRecord;
    const request = {
      id: 'request-current',
      paymentRequestProjectId: 'request-current',
      cooperationProjectId: 'project-current',
      cooperationProjectName: '项目 project-current',
      cooperationProjectCode: 'PRJ-CURRENT',
      project: '项目 project-current',
      brand: '当前品牌',
      status: '审批中',
      creatorLinks: [{
        creatorId: creatorA,
        engagementId: 'engagement-current',
        contractIds: [],
        invoiceIds: [],
        socialAccountId: `social-${creatorA}`,
        creatorHandle: '@same-handle',
        creatorPlatform: 'Instagram',
      }],
    } as unknown as RequestProjectSummary;
    const payout = {
      id: 'payment-current',
      creatorId: creatorA,
      projectId: 'project-current',
      project: '项目 project-current',
      handle: '@same-handle',
      creatorSocialAccountId: `social-${creatorA}`,
      creatorPlatform: 'Instagram',
    } as unknown as Payout;

    const records = buildCreatorCollaborationProjects({
      projects: [historicalProject, currentProject, sameNameOtherCreatorProject],
      contracts: [contract, contract],
      generatedInvoices: [generatedInvoice, generatedInvoice],
      externalInvoices: [externalInvoice, externalInvoice],
      requests: [request, request],
      payouts: [payout, payout],
      referenceDate: '2026-09-19',
    });
    const creatorRecords = creatorCollaborationProjectsFor(records, creatorA);

    expect(creatorRecords.map((record) => [record.projectId, record.relationStatus])).toEqual([
      ['project-current', 'CURRENT'],
      ['project-history', 'HISTORICAL'],
    ]);
    expect(creatorRecords[0]).toMatchObject({
      invoiceCount: 1,
      requestCount: 1,
      paymentCount: 1,
      contractCount: 0,
      directoryResolved: true,
    });
    expect(creatorRecords[0].socialAccounts).toHaveLength(1);
    expect(creatorRecords[1]).toMatchObject({
      invoiceCount: 1,
      contractCount: 1,
      contractStatus: 'ENDED',
      relationStatus: 'HISTORICAL',
    });
    expect(creatorCollaborationProjectsFor(records, creatorB).map((record) => record.projectId))
      .toEqual([]);
  });

  it('为目录缺失的业务快照生成当前关联并补齐可用资料', () => {
    const invoice = {
      invoiceId: 'invoice-orphan',
      snapshot: {
        creatorId: creatorA,
        projectId: 'project-orphan',
        projectName: '快照项目',
        creatorHandle: '@snapshot',
        creatorPlatform: 'TikTok',
      },
    } as unknown as GeneratedInvoiceRecord;
    const request = {
      id: 'request-orphan',
      cooperationProjectId: 'project-orphan',
      cooperationProjectCode: 'PRJ-ORPHAN',
      cooperationProjectName: '快照项目',
      project: '快照项目',
      brand: '快照品牌',
      status: '已完成',
      creatorLinks: [{
        creatorId: creatorA,
        engagementId: 'engagement-orphan',
        contractIds: [],
        invoiceIds: [],
        creatorHandle: '@snapshot',
        creatorPlatform: 'TikTok',
      }],
    } as unknown as RequestProjectSummary;

    const [record] = buildCreatorCollaborationProjects({
      projects: [],
      contracts: [],
      generatedInvoices: [invoice],
      externalInvoices: [],
      requests: [request],
      payouts: [],
    });

    expect(record).toMatchObject({
      projectId: 'project-orphan',
      projectCode: 'PRJ-ORPHAN',
      projectName: '快照项目',
      brand: '快照品牌',
      projectStatus: '已完成',
      directoryResolved: false,
      relationStatus: 'CURRENT',
      contractStatus: 'NONE',
      invoiceCount: 1,
      requestCount: 1,
    });
  });

  it('将同一目录项目的内部 projectId 解析到稳定 cooperationProjectId', () => {
    const directoryProject = {
      ...project('project-directory-id', creatorA, 'active'),
      id: 'project-directory-id',
      projectId: 'project-internal-id' as ProjectId,
      cooperationProjectId: 'project-cooperation-id' as CooperationProjectId,
      cooperationProjectCode: 'PRJ-STABLE-001',
    };
    const externalInvoice = {
      invoiceId: 'invoice-project-alias',
      creatorId: creatorA,
      projectId: 'project-internal-id',
      projectName: directoryProject.name,
      creatorHandle: '@same-handle',
      creatorPlatform: 'Instagram',
    } as unknown as ExternalInvoiceCollectionRecord;

    const records = buildCreatorCollaborationProjects({
      projects: [directoryProject],
      contracts: [],
      generatedInvoices: [],
      externalInvoices: [externalInvoice],
      requests: [],
      payouts: [],
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      projectId: 'project-cooperation-id',
      projectCode: 'PRJ-STABLE-001',
      relationStatus: 'CURRENT',
      contractStatus: 'NONE',
      invoiceCount: 1,
    });
  });

  it('合同到期当天仍当前关联，次日历史关联；长期或另一份有效合同覆盖到期合同', () => {
    const ending = contractFor('contract-ending', '2026-09-19');
    expect(buildCreatorCollaborationProjects(sources({ contracts: [ending] }))[0]).toMatchObject({
      relationStatus: 'CURRENT', contractStatus: 'ACTIVE',
    });
    expect(buildCreatorCollaborationProjects(sources({
      contracts: [ending], referenceDate: '2026-09-20',
    }))[0]).toMatchObject({ relationStatus: 'HISTORICAL', contractStatus: 'EXPIRED' });
    expect(buildCreatorCollaborationProjects(sources({
      contracts: [ending, contractFor('contract-long-term', '', { isLongTerm: true })],
      referenceDate: '2026-09-20',
    }))[0]).toMatchObject({ relationStatus: 'CURRENT', contractStatus: 'ACTIVE', contractCount: 2 });
    expect(buildCreatorCollaborationProjects(sources({
      contracts: [ending, contractFor('contract-later', '2026-10-01')],
      referenceDate: '2026-09-20',
    }))[0]).toMatchObject({ relationStatus: 'CURRENT', contractStatus: 'ACTIVE' });
  });

  it('未确认、缺少期限及已结束的合同分别显示对应状态，不将已结束链接当作有效合同', () => {
    const pending = contractFor('contract-pending', '2026-12-31', {
      lifecycle: 'SENT_FOR_SIGNATURE', signed: false,
    });
    expect(buildCreatorCollaborationProjects(sources({ contracts: [pending] }))[0]).toMatchObject({
      relationStatus: 'CURRENT', contractStatus: 'PENDING',
    });
    expect(buildCreatorCollaborationProjects(sources({
      contracts: [contractFor('contract-no-date', '')],
    }))[0]).toMatchObject({ relationStatus: 'CURRENT', contractStatus: 'UNSET' });
    expect(buildCreatorCollaborationProjects(sources({
      contracts: [contractFor('contract-ended', '2026-12-31', {
        projectLinks: [{ cooperationProjectId: 'project-contract' as CooperationProjectId, status: 'ENDED' }],
      })],
    }))[0]).toMatchObject({ relationStatus: 'HISTORICAL', contractStatus: 'ENDED', contractCount: 1 });
    expect(buildCreatorCollaborationProjects(sources({
      contracts: [contractFor('contract-ended', '2026-12-31', { isTemplate: true })],
    }))).toEqual([]);
  });

  it('有合同时合同到期优先于未付款 Invoice；目录明确移除时即使合同有效也为历史', () => {
    const expired = contractFor('contract-expired', '2026-09-18', { projectId: 'project-invoice' });
    const invoices = [invoiceFor('invoice-unpaid', 'payout-unpaid')];
    expect(buildCreatorCollaborationProjects(sources({
      contracts: [expired], generatedInvoices: invoices,
    }))[0]).toMatchObject({ relationStatus: 'HISTORICAL', contractStatus: 'EXPIRED', invoiceCount: 1 });
    expect(buildCreatorCollaborationProjects(sources({
      projects: [project('project-contract', creatorA, 'removed')],
      contracts: [contractFor('contract-active', '2026-12-31')],
    }))[0]).toMatchObject({ relationStatus: 'HISTORICAL', contractStatus: 'ACTIVE' });
  });

  it('无合同时未请款与请款草稿仍当前，部分付款仍当前，全部逐张已付款才转历史', () => {
    const invoices = [invoiceFor('invoice-a', 'payout-a'), invoiceFor('invoice-b', 'payout-b')];
    const request = {
      id: 'request-draft',
      cooperationProjectId: 'project-invoice',
      lifecycle: 'DRAFT',
      creatorLinks: [{ creatorId: creatorA, invoiceIds: ['invoice-a', 'invoice-b'], contractIds: [] }],
    } as unknown as RequestProjectSummary;
    expect(buildCreatorCollaborationProjects(sources({ generatedInvoices: invoices }))[0]).toMatchObject({
      relationStatus: 'CURRENT', contractStatus: 'NONE', invoiceCount: 2,
    });
    expect(buildCreatorCollaborationProjects(sources({
      generatedInvoices: invoices, requests: [request],
      payouts: [payoutFor('payout-a', '已付款'), payoutFor('payout-b', '等待付款')],
    }))[0]).toMatchObject({ relationStatus: 'CURRENT', requestCount: 1, invoiceCount: 2 });
    expect(buildCreatorCollaborationProjects(sources({
      generatedInvoices: [invoices[0], invoices[0], invoices[1]], requests: [request],
      payouts: [payoutFor('payout-a', '已付款'), payoutFor('payout-b', '已付款')],
    }))[0]).toMatchObject({ relationStatus: 'HISTORICAL', invoiceCount: 2 });
    expect(buildCreatorCollaborationProjects(sources({
      generatedInvoices: invoices,
      payouts: [payoutFor('payout-a', '已付款'), payoutFor('payout-b', '已付款', { creatorId: creatorB })],
    }))[0].relationStatus).toBe('CURRENT');
  });

  it('外部 Invoice 按 ID 与生成记录去重，取消记录不产生项目或阻碍已付款判定', () => {
    const external = {
      invoiceId: 'invoice-a', creatorId: creatorA, projectId: 'project-invoice', status: 'APPROVED',
      projectName: 'Invoice 项目', creatorHandle: '@same-handle',
    } as ExternalInvoiceCollectionRecord;
    const cancelled = { ...external, invoiceId: 'invoice-cancelled', status: 'CANCELLED' } as ExternalInvoiceCollectionRecord;
    expect(buildCreatorCollaborationProjects(sources({ externalInvoices: [cancelled] }))).toEqual([]);
    expect(buildCreatorCollaborationProjects(sources({
      generatedInvoices: [invoiceFor('invoice-a', 'payout-a')],
      externalInvoices: [external, cancelled],
      payouts: [payoutFor('payout-a', '已付款')],
    }))[0]).toMatchObject({ relationStatus: 'HISTORICAL', invoiceCount: 1 });
  });

  it('目录、请款和付款快照不能单独生成成员；仅按达人稳定 ID 关联业务', () => {
    const request = {
      id: 'request-alone', cooperationProjectId: 'project-invoice',
      creatorLinks: [{ creatorId: creatorA, contractIds: [], invoiceIds: [] }],
    } as unknown as RequestProjectSummary;
    expect(buildCreatorCollaborationProjects(sources({
      projects: [project('project-invoice', creatorA, 'active')],
      requests: [request], payouts: [payoutFor('payout-alone', '已付款')],
    }))).toEqual([]);
    const records = buildCreatorCollaborationProjects(sources({
      projects: [project('project-invoice', creatorB, 'active')],
      generatedInvoices: [invoiceFor('invoice-a', 'payout-a')],
    }));
    expect(creatorCollaborationProjectsFor(records, creatorB)).toEqual([]);
    expect(creatorCollaborationProjectsFor(records, creatorA)).toHaveLength(1);
  });
});
