import type { EngagementId, ProjectId } from '../businessWorkflow';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type { CreatorProfile, GeneratedInvoiceRecord, InvoiceCurrency } from '../types';
import { creatorSearchTerms } from '../creatorSearchOptions';

export const INVOICE_BATCH_PROTOTYPE_CURRENCY = 'USD' as const;
export const INVOICE_BATCH_PROTOTYPE_DEMO_CURRENCY: InvoiceCurrency = 'EUR';
export const INVOICE_BATCH_PROTOTYPE_DEMO_DESCRIPTION = '海外创作者内容合作服务费（演示数据）';

const INVOICE_BATCH_PROTOTYPE_DEMO_VALUES = [
  { unitPrice: 1_680, quantity: 1 },
  { unitPrice: 840, quantity: 2 },
  { unitPrice: 2_250, quantity: 1 },
  { unitPrice: 610, quantity: 3 },
  { unitPrice: 2_980, quantity: 1 },
] as const;

type ProjectCreatorReference = NonNullable<ProjectSummary['creatorProfiles']>[number];

export const filterInvoiceBatchCreatorReferences = (
  references: ProjectCreatorReference[],
  query: string,
  creators: CreatorProfile[] = [],
) => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return references;
  return references.filter((reference) => {
    const creator = creators.find((candidate) => candidate.id === reference.creatorId);
    return [reference.name, reference.handle, reference.platform, creator ? creatorSearchTerms(creator) : '']
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
};

export const selectableInvoiceBatchEngagementIds = (
  references: ProjectCreatorReference[],
  _generatedInvoices: GeneratedInvoiceRecord[],
  limit: number,
): EngagementId[] => {
  return references
    .filter((reference) => (
      reference.status !== 'removed'
    ))
    .slice(0, limit)
    .map((reference) => reference.engagementId);
};

export type InvoiceBatchPrototypeSeed = {
  projectId: ProjectId;
  currency: InvoiceCurrency;
  description: string;
  rows: Array<{
    engagementId: EngagementId;
    unitPrice: number;
    quantity: number;
  }>;
};

export const createInvoiceBatchPrototypeSeed = (
  projects: ProjectSummary[],
  generatedInvoices: GeneratedInvoiceRecord[],
  limit = INVOICE_BATCH_PROTOTYPE_DEMO_VALUES.length,
): InvoiceBatchPrototypeSeed | null => {
  const candidate = projects.reduce<{
    projectId: ProjectId;
    engagementIds: EngagementId[];
  } | null>((best, project) => {
    const projectId = (
      project.cooperationProjectId ?? project.projectId ?? project.id
    ) as ProjectId;
    const engagementIds = selectableInvoiceBatchEngagementIds(
      project.creatorProfiles ?? [],
      generatedInvoices,
      Math.min(limit, INVOICE_BATCH_PROTOTYPE_DEMO_VALUES.length),
    );
    return !best || engagementIds.length > best.engagementIds.length
      ? { projectId, engagementIds }
      : best;
  }, null);

  if (!candidate?.engagementIds.length) return null;

  return {
    projectId: candidate.projectId,
    currency: INVOICE_BATCH_PROTOTYPE_DEMO_CURRENCY,
    description: INVOICE_BATCH_PROTOTYPE_DEMO_DESCRIPTION,
    rows: candidate.engagementIds.map((engagementId, index) => ({
      engagementId,
      ...INVOICE_BATCH_PROTOTYPE_DEMO_VALUES[index],
    })),
  };
};
