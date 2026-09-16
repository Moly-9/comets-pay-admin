import type { CreatorId, EngagementId, ProjectId } from '../businessWorkflow';
import { cooperationProjectIdFor } from '../paymentRequestProjects';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type { CreatorProfile, GeneratedInvoiceRecord } from '../types';

export type ProjectCreatorEngagementInput = {
  projectId: ProjectId;
  creatorId: CreatorId;
  engagementId: EngagementId;
  creatorHandle?: string;
  creatorSocialAccountId?: string;
  creatorPlatform?: string;
};

export const upsertProjectCreatorEngagements = ({
  projects,
  creators,
  associations,
  occurredAt,
}: {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  associations: ProjectCreatorEngagementInput[];
  occurredAt: string;
}) => projects.map((project) => {
  const projectId = cooperationProjectIdFor(project) as ProjectId;
  const projectAssociations = associations.filter((association) => association.projectId === projectId);
  if (!projectAssociations.length) return project;

  const creatorProfiles = [...(project.creatorProfiles ?? [])];
  projectAssociations.forEach((association) => {
    const creator = creators.find((candidate) => candidate.id === association.creatorId);
    if (!creator) return;
    const existingIndex = creatorProfiles.findIndex((reference) => (
      reference.creatorId === association.creatorId
      || reference.engagementId === association.engagementId
    ));
    const existing = existingIndex >= 0 ? creatorProfiles[existingIndex] : undefined;
    const reference = {
      ...existing,
      creatorId: association.creatorId,
      projectId,
      engagementId: association.engagementId,
      status: 'active' as const,
      createdAt: existing?.createdAt ?? occurredAt,
      updatedAt: occurredAt,
      name: creator.name,
      handle: association.creatorHandle || existing?.handle || creator.handle,
      platform: association.creatorPlatform ?? existing?.platform ?? creator.platform,
      socialAccountId: association.creatorSocialAccountId ?? existing?.socialAccountId,
    };
    if (existingIndex >= 0) creatorProfiles[existingIndex] = reference;
    else creatorProfiles.push(reference);
  });

  return {
    ...project,
    creatorProfiles,
    creators: creatorProfiles.filter((reference) => reference.status !== 'removed').length,
  };
});

export const upsertGeneratedInvoiceEngagements = ({
  projects,
  creators,
  records,
  existingInvoices = [],
  occurredAt,
}: {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  records: GeneratedInvoiceRecord[];
  existingInvoices?: GeneratedInvoiceRecord[];
  occurredAt: string;
}) => {
  const associations = records.flatMap<ProjectCreatorEngagementInput>((record) => {
    const projectId = record.snapshot.cooperationProjectId ?? record.snapshot.projectId;
    const creatorId = record.snapshot.creatorId;
    const engagementId = record.snapshot.engagementId;
    if (!projectId || !creatorId || !engagementId) return [];
    return [{
      projectId: projectId as ProjectId,
      creatorId: creatorId as CreatorId,
      engagementId: engagementId as EngagementId,
      creatorHandle: record.snapshot.creatorHandle,
      creatorSocialAccountId: record.snapshot.creatorSocialAccountId,
      creatorPlatform: record.snapshot.creatorPlatform,
    }];
  });
  const linkedProjects = upsertProjectCreatorEngagements({
    projects,
    creators,
    associations,
    occurredAt,
  });

  return linkedProjects.map((project) => {
    const projectId = cooperationProjectIdFor(project) as ProjectId;
    const projectRecords = records.filter((record) => (
      (record.snapshot.cooperationProjectId ?? record.snapshot.projectId) === projectId
      && record.snapshot.creatorId
      && record.snapshot.engagementId
    ));
    if (!projectRecords.length) return project;

    const newInvoiceCount = projectRecords.filter((record) => !existingInvoices.some((invoice) => (
      invoice.invoiceId === record.invoiceId || invoice.id === record.id
    ))).length;

    return {
      ...project,
      invoiceCount: (project.invoiceCount ?? 0) + newInvoiceCount,
    };
  });
};

export const updateCreatorProjectCounts = (
  creators: CreatorProfile[],
  projects: ProjectSummary[],
) => creators.map((creator) => {
  const projectCount = projects.filter((project) => project.creatorProfiles?.some((reference) => (
    reference.creatorId === creator.id && reference.status !== 'removed'
  ))).length;
  return creator.projects === projectCount ? creator : { ...creator, projects: projectCount };
});
