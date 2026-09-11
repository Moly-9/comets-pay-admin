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
} from './creatorCollaborationProjects';

const creatorA = 'creator-a' as CreatorId;
const creatorB = 'creator-b' as CreatorId;

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
      relationStatus: 'HISTORICAL',
    });
    expect(creatorCollaborationProjectsFor(records, creatorB).map((record) => record.projectId))
      .toEqual(['project-other-creator']);
  });

  it('为目录缺失的业务快照生成历史关联并补齐可用资料', () => {
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
      relationStatus: 'HISTORICAL',
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
      invoiceCount: 1,
    });
  });
});
