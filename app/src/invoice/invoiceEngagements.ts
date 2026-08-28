import type { CreatorId, EngagementId, ProjectId } from '../businessWorkflow';
import { cooperationProjectIdFor } from '../paymentRequestProjects';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type { CreatorProfile, GeneratedInvoiceRecord } from '../types';

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
}) => projects.map((project) => {
  const projectId = cooperationProjectIdFor(project) as ProjectId;
  const projectRecords = records.filter((record) => (
    (record.snapshot.cooperationProjectId ?? record.snapshot.projectId) === projectId
    && record.snapshot.creatorId
    && record.snapshot.engagementId
  ));
  if (!projectRecords.length) return project;

  const creatorProfiles = [...(project.creatorProfiles ?? [])];
  projectRecords.forEach((record) => {
    const creator = creators.find((candidate) => candidate.id === record.snapshot.creatorId);
    if (!creator || !record.snapshot.engagementId) return;
    const existingIndex = creatorProfiles.findIndex((reference) => (
      reference.creatorId === creator.id
      || reference.engagementId === record.snapshot.engagementId
    ));
    const existing = existingIndex >= 0 ? creatorProfiles[existingIndex] : undefined;
    const reference = {
      ...existing,
      creatorId: creator.id as CreatorId,
      projectId,
      engagementId: record.snapshot.engagementId as EngagementId,
      status: 'active' as const,
      createdAt: existing?.createdAt ?? occurredAt,
      updatedAt: occurredAt,
      name: creator.name,
      handle: record.snapshot.creatorHandle || creator.handle,
      platform: record.snapshot.creatorPlatform ?? creator.platform,
      socialAccountId: record.snapshot.creatorSocialAccountId,
    };
    if (existingIndex >= 0) creatorProfiles[existingIndex] = reference;
    else creatorProfiles.push(reference);
  });
  const newInvoiceCount = projectRecords.filter((record) => !existingInvoices.some((invoice) => (
    invoice.invoiceId === record.invoiceId || invoice.id === record.id
  ))).length;

  return {
    ...project,
    creatorProfiles,
    creators: creatorProfiles.filter((reference) => reference.status !== 'removed').length,
    invoiceCount: (project.invoiceCount ?? 0) + newInvoiceCount,
  };
});

export const updateCreatorProjectCounts = (
  creators: CreatorProfile[],
  projects: ProjectSummary[],
) => creators.map((creator) => {
  const projectCount = projects.filter((project) => project.creatorProfiles?.some((reference) => (
    reference.creatorId === creator.id && reference.status !== 'removed'
  ))).length;
  return creator.projects === projectCount ? creator : { ...creator, projects: projectCount };
});
