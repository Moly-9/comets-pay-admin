import type { ContractRecord } from './contracts';
import {
  contractProjectLinksFor,
  currentContractReferenceDate,
  getContractValidity,
  isConfirmedContract,
} from './contracts';
import type { ExternalInvoiceCollectionRecord } from './invoice/externalInvoiceCollection';
import type { ProjectSummary } from './pages/ProjectDetailPage';
import type { RequestProjectSummary } from './pages/RequestProjectDetailPage';
import type { CreatorId } from './businessWorkflow';
import type { GeneratedInvoiceRecord, Payout } from './types';

export type CreatorCollaborationRelationStatus = 'CURRENT' | 'HISTORICAL';
export type CreatorCollaborationContractStatus =
  | 'ACTIVE' | 'PENDING' | 'UNSET' | 'EXPIRED' | 'ENDED' | 'NONE';

export type CreatorCollaborationSocialAccount = {
  socialAccountId?: string;
  handle: string;
  platform: string;
};

export type CreatorCollaborationProjectRecord = {
  creatorId: CreatorId;
  projectId: string;
  projectCode: string;
  projectName: string;
  brand: string;
  projectStatus: string;
  relationStatus: CreatorCollaborationRelationStatus;
  contractStatus: CreatorCollaborationContractStatus;
  directoryResolved: boolean;
  socialAccounts: CreatorCollaborationSocialAccount[];
  contractCount: number;
  invoiceCount: number;
  requestCount: number;
  paymentCount: number;
};

export type CreatorCollaborationProjectSources = {
  projects: readonly ProjectSummary[];
  contracts: readonly ContractRecord[];
  generatedInvoices: readonly GeneratedInvoiceRecord[];
  externalInvoices: readonly ExternalInvoiceCollectionRecord[];
  requests: readonly RequestProjectSummary[];
  payouts: readonly Payout[];
  referenceDate?: string;
};

type MutableCollaborationProjectRecord = Omit<
  CreatorCollaborationProjectRecord,
  'relationStatus' | 'contractStatus' | 'socialAccounts' | 'contractCount' | 'invoiceCount' | 'requestCount' | 'paymentCount'
> & {
  hasCurrentReference: boolean;
  hasRemovedReference: boolean;
  socialAccounts: Map<string, CreatorCollaborationSocialAccount>;
  contracts: Map<string, { contract: ContractRecord; ended: boolean }>;
  invoicePayoutIds: Map<string, string | undefined>;
  requestIds: Set<string>;
  paymentIds: Set<string>;
};

const projectIdFor = (project: ProjectSummary) => String(
  project.cooperationProjectId ?? project.projectId ?? project.id,
);

const collaborationKey = (creatorId: CreatorId, projectId: string) => `${creatorId}\u0000${projectId}`;

const socialAccountKey = (account: CreatorCollaborationSocialAccount) => (
  account.socialAccountId
    ? `id:${account.socialAccountId}`
    : `snapshot:${account.handle.trim().toLowerCase()}\u0000${account.platform.trim().toLowerCase()}`
);

const contractStatusFor = (
  links: readonly { contract: ContractRecord; ended: boolean }[],
  referenceDate: string,
): CreatorCollaborationContractStatus => {
  if (!links.length) return 'NONE';
  const activeLinks = links.filter(({ ended }) => !ended);
  if (!activeLinks.length) return 'ENDED';
  const statuses = activeLinks.map(({ contract }) => ({
    confirmed: isConfirmedContract(contract),
    validity: getContractValidity(contract, referenceDate),
  }));
  if (statuses.some(({ confirmed, validity }) => confirmed && !validity.expired && validity.status !== 'UNSET')) {
    return 'ACTIVE';
  }
  if (statuses.some(({ validity }) => !validity.expired && validity.status !== 'UNSET')) return 'PENDING';
  if (statuses.some(({ validity }) => validity.status === 'UNSET')) return 'UNSET';
  return 'EXPIRED';
};

export const buildCreatorCollaborationProjects = ({
  projects,
  contracts,
  generatedInvoices,
  externalInvoices,
  requests,
  payouts,
  referenceDate = currentContractReferenceDate(),
}: CreatorCollaborationProjectSources): CreatorCollaborationProjectRecord[] => {
  const projectDirectory = new Map(projects.map((project) => [projectIdFor(project), project]));
  const projectOrder = new Map(projects.map((project, index) => [projectIdFor(project), index]));
  const projectAliases = new Map<string, string>();
  projects.forEach((project) => {
    const canonicalId = projectIdFor(project);
    [project.id, project.projectId, project.cooperationProjectId]
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .forEach((value) => projectAliases.set(String(value), canonicalId));
  });
  const resolveProjectId = (value: string) => projectAliases.get(String(value)) ?? String(value);
  const records = new Map<string, MutableCollaborationProjectRecord>();

  const ensureRecord = (
    creatorId: CreatorId,
    projectId: string,
    snapshot?: { projectName?: string; projectCode?: string; brand?: string; projectStatus?: string },
  ) => {
    const key = collaborationKey(creatorId, projectId);
    const existing = records.get(key);
    if (existing) {
      if (!existing.directoryResolved) {
        if (snapshot?.projectName && existing.projectName === '项目名称待同步') existing.projectName = snapshot.projectName;
        if (snapshot?.projectCode && existing.projectCode === projectId) existing.projectCode = snapshot.projectCode;
        if (snapshot?.brand && existing.brand === '品牌待同步') existing.brand = snapshot.brand;
        if (snapshot?.projectStatus && existing.projectStatus === '项目资料待同步') existing.projectStatus = snapshot.projectStatus;
      }
      return existing;
    }
    const project = projectDirectory.get(projectId);
    const record: MutableCollaborationProjectRecord = {
      creatorId,
      projectId,
      projectCode: project?.cooperationProjectCode ?? project?.projectCode ?? project?.id ?? snapshot?.projectCode ?? projectId,
      projectName: project?.name ?? snapshot?.projectName ?? '项目名称待同步',
      brand: project?.brand ?? snapshot?.brand ?? '品牌待同步',
      projectStatus: project?.status ?? snapshot?.projectStatus ?? '项目资料待同步',
      directoryResolved: Boolean(project),
      hasCurrentReference: false,
      hasRemovedReference: false,
      socialAccounts: new Map(),
      contracts: new Map(),
      invoicePayoutIds: new Map(),
      requestIds: new Set(),
      paymentIds: new Set(),
    };
    records.set(key, record);
    return record;
  };

  const addSocialAccount = (
    record: MutableCollaborationProjectRecord,
    account: CreatorCollaborationSocialAccount,
  ) => {
    if (!account.handle.trim() && !account.platform.trim()) return;
    record.socialAccounts.set(socialAccountKey(account), account);
  };

  projects.forEach((project) => {
    const projectId = projectIdFor(project);
    project.creatorProfiles?.forEach((reference) => {
      const record = ensureRecord(reference.creatorId, projectId);
      if (reference.status === 'removed') record.hasRemovedReference = true;
      else record.hasCurrentReference = true;
      addSocialAccount(record, {
        socialAccountId: reference.socialAccountId,
        handle: reference.handle,
        platform: reference.platform,
      });
    });
  });

  contracts.forEach((contract) => {
    if (!contract.creatorId || contract.isTemplate) return;
    const creatorId = contract.creatorId;
    const links = new Map<string, boolean>();
    contractProjectLinksFor(contract).forEach((link) => {
      links.set(resolveProjectId(String(link.cooperationProjectId)), link.status === 'ENDED');
    });
    const legacyProjectId = contract.cooperationProjectId ?? contract.projectId;
    if (legacyProjectId) {
      const projectId = resolveProjectId(String(legacyProjectId));
      if (!links.has(projectId)) links.set(projectId, false);
    }
    links.forEach((ended, projectId) => {
      const record = ensureRecord(creatorId, projectId, {
        projectName: contract.project,
        brand: contract.brand,
      });
      record.contracts.set(String(contract.contractId ?? contract.id), { contract, ended });
      addSocialAccount(record, {
        socialAccountId: contract.creatorSocialAccountId,
        handle: contract.creatorHandle ?? '',
        platform: contract.creatorPlatform ?? contract.platform,
      });
    });
  });

  generatedInvoices.forEach((invoice) => {
    const { snapshot } = invoice;
    if (!snapshot.creatorId || !(snapshot.cooperationProjectId ?? snapshot.projectId)) return;
    const projectId = resolveProjectId(String(snapshot.cooperationProjectId ?? snapshot.projectId));
    const record = ensureRecord(snapshot.creatorId, projectId, { projectName: snapshot.projectName });
    record.invoicePayoutIds.set(String(invoice.invoiceId), invoice.sourcePayoutId);
    addSocialAccount(record, {
      socialAccountId: snapshot.creatorSocialAccountId,
      handle: snapshot.creatorHandle,
      platform: snapshot.creatorPlatform ?? '',
    });
  });

  externalInvoices.forEach((invoice) => {
    if (invoice.status === 'CANCELLED' || !invoice.creatorId || !invoice.projectId) return;
    const projectId = resolveProjectId(String(invoice.projectId));
    const record = ensureRecord(invoice.creatorId, projectId, { projectName: invoice.projectName });
    if (!record.invoicePayoutIds.has(String(invoice.invoiceId))) {
      record.invoicePayoutIds.set(String(invoice.invoiceId), undefined);
    }
    addSocialAccount(record, {
      socialAccountId: invoice.creatorSocialAccountId,
      handle: invoice.creatorHandle,
      platform: invoice.creatorPlatform ?? '',
    });
  });

  requests.forEach((request) => {
    const projectIdValue = request.cooperationProjectId ?? request.projectId;
    if (!projectIdValue) return;
    const projectId = resolveProjectId(String(projectIdValue));
    request.creatorLinks?.forEach((link) => {
      const record = ensureRecord(link.creatorId, projectId, {
        projectName: request.cooperationProjectName ?? request.project,
        projectCode: request.cooperationProjectCode,
        brand: request.brand,
        projectStatus: request.status,
      });
      record.requestIds.add(String(request.paymentRequestProjectId ?? request.id));
      addSocialAccount(record, {
        socialAccountId: link.socialAccountId,
        handle: link.creatorHandle ?? '',
        platform: link.creatorPlatform ?? '',
      });
    });
  });

  payouts.forEach((payout) => {
    if (!payout.creatorId || !payout.projectId) return;
    const projectId = resolveProjectId(String(payout.projectId));
    const record = ensureRecord(payout.creatorId, projectId, { projectName: payout.project });
    record.paymentIds.add(String(payout.id));
    addSocialAccount(record, {
      socialAccountId: payout.creatorSocialAccountId,
      handle: payout.handle,
      platform: payout.creatorPlatform ?? '',
    });
  });

  const payoutsById = new Map(payouts.map((payout) => [payout.id, payout]));

  return [...records.values()]
    .filter((record) => record.contracts.size > 0 || record.invoicePayoutIds.size > 0)
    .map((record): CreatorCollaborationProjectRecord => {
      const contractStatus = contractStatusFor([...record.contracts.values()], referenceDate);
      const allInvoicesPaid = record.invoicePayoutIds.size > 0
        && [...record.invoicePayoutIds.values()].every((payoutId) => {
          const payout = payoutId ? payoutsById.get(payoutId) : undefined;
          return payout?.status === '已付款'
            && (!payout.creatorId || payout.creatorId === record.creatorId)
            && resolveProjectId(payout.projectId) === record.projectId;
        });
      const explicitlyRemoved = record.hasRemovedReference && !record.hasCurrentReference;
      const current = !explicitlyRemoved && (contractStatus === 'NONE'
        ? !allInvoicesPaid
        : ['ACTIVE', 'PENDING', 'UNSET'].includes(contractStatus));
      return {
        creatorId: record.creatorId,
        projectId: record.projectId,
        projectCode: record.projectCode,
        projectName: record.projectName,
        brand: record.brand,
        projectStatus: record.projectStatus,
        relationStatus: current ? 'CURRENT' : 'HISTORICAL',
        contractStatus,
        directoryResolved: record.directoryResolved,
        socialAccounts: [...record.socialAccounts.values()],
        contractCount: record.contracts.size,
        invoiceCount: record.invoicePayoutIds.size,
        requestCount: record.requestIds.size,
        paymentCount: record.paymentIds.size,
      };
    })
    .sort((left, right) => {
      if (left.relationStatus !== right.relationStatus) return left.relationStatus === 'CURRENT' ? -1 : 1;
      const leftOrder = projectOrder.get(left.projectId) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = projectOrder.get(right.projectId) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.projectCode.localeCompare(right.projectCode, 'zh-CN');
    });
};

export const creatorCollaborationProjectsFor = (
  records: readonly CreatorCollaborationProjectRecord[],
  creatorId: string,
) => records.filter((record) => record.creatorId === creatorId);
