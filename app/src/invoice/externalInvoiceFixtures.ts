import type { ContractRecord } from '../contracts';
import { contractLinkedToProject } from '../contracts';
import type { CooperationProjectId, ContractId, ProjectId } from '../businessWorkflow';
import {
  createDocumentPayoutSnapshot,
  eligibleInvoicePayoutAccounts,
  getPayoutAccountId,
} from '../payoutAccounts';
import type { CreatorProfile, GeneratedInvoiceRecord, InvoiceEntity } from '../types';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import {
  correctExternalInvoiceRecognition,
  createExternalInvoiceCollection,
  simulateExternalInvoiceUpload,
  submitExternalInvoiceForReview,
  type ExternalInvoiceActor,
  type ExternalInvoiceCollectionRecord,
} from './externalInvoiceCollection';

export const createInitialExternalInvoiceCollections = ({
  projects,
  creators,
  contracts,
  generatedInvoices,
  invoiceEntity,
  actor,
}: {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  generatedInvoices: GeneratedInvoiceRecord[];
  invoiceEntity: InvoiceEntity;
  actor: ExternalInvoiceActor;
}): ExternalInvoiceCollectionRecord[] => {
  const candidates = projects.flatMap((project) => (
    (project.creatorProfiles ?? []).filter((reference) => reference.status !== 'removed').map((reference) => ({
      project,
      reference,
      creator: creators.find((candidate) => candidate.id === reference.creatorId),
    }))
  )).filter((candidate): candidate is typeof candidate & { creator: CreatorProfile } => (
    Boolean(candidate.creator && eligibleInvoicePayoutAccounts(candidate.creator).some((account) => account.isDefault))
  )).slice(0, 4);

  const records: ExternalInvoiceCollectionRecord[] = [];
  candidates.forEach(({ project, reference, creator }, index) => {
    const defaultAccount = eligibleInvoicePayoutAccounts(creator).find((account) => account.isDefault)!;
    const presetPayoutAccountId = getPayoutAccountId(defaultAccount);
    const projectId = (project.projectId ?? project.id) as ProjectId;
    const contractIds = contracts.filter((contract) => (
      contract.lifecycle === 'CONFIRMED'
      && contract.creatorId === reference.creatorId
      && contractLinkedToProject(contract, projectId as CooperationProjectId)
      && contract.contractId
    )).slice(0, 2).map((contract) => contract.contractId as ContractId);
    let record = createExternalInvoiceCollection({
      projectId,
      projectName: project.name,
      engagementId: reference.engagementId,
      creatorId: reference.creatorId,
      creatorName: creator.name,
      creatorHandle: creator.socialAccounts.find((account) => account.handle.trim())?.handle ?? creator.handle,
      contractIds: index === 2 ? [] : contractIds,
      presetPayoutAccountId,
      presetPayoutAccountSnapshot: createDocumentPayoutSnapshot(defaultAccount, creator.id),
      expected: {
        amount: 3600 + index * 600,
        currency: index % 2 === 0 ? 'USD' : 'EUR',
        billTo: { ...invoiceEntity },
        description: ['Short-form video production', 'Creator licensing fee', 'Campaign content package', 'Social content publishing'][index],
        dueDate: `2026-09-${String(3 + index).padStart(2, '0')}`,
      },
      actor,
      publish: index !== 0,
      occurredAt: `2026-08-${String(18 + index).padStart(2, '0')}T02:30:00.000Z`,
    });

    if (index >= 2) {
      record = simulateExternalInvoiceUpload({
        record,
        creator,
        payoutAccountId: presetPayoutAccountId,
        scenario: index === 3 ? 'OCR_ERROR' : 'NORMAL',
        actor: { account: 'creator.demo', name: `${creator.name}（C 端）`, role: '达人账号' },
        invoiceDate: `2026-08-${String(20 + index).padStart(2, '0')}`,
        occurredAt: `2026-08-${String(20 + index).padStart(2, '0')}T04:20:00.000Z`,
      });
      if (index === 3) {
        const currentRecognition = record.recognitionSnapshots[record.recognitionSnapshots.length - 1];
        record = correctExternalInvoiceRecognition(
          record,
          'AMOUNT',
          currentRecognition.fields.AMOUNT.evidence.sourceValue,
          { account: 'creator.demo', name: `${creator.name}（C 端）`, role: '达人账号' },
          '2026-08-23T04:35:00.000Z',
        );
      }
      record = submitExternalInvoiceForReview({
        record,
        creator,
        contracts,
        occupiedInvoices: generatedInvoices,
        reservedInvoiceNumbers: records.flatMap((item) => item.invoiceNumber ? [item.invoiceNumber] : []),
        reservedSourceInvoiceNumbers: records.flatMap((item) => item.sourceInvoiceNumber ? [item.sourceInvoiceNumber] : []),
        actor: { account: 'creator.demo', name: `${creator.name}（C 端）`, role: '达人账号' },
        occurredAt: `2026-08-${String(20 + index).padStart(2, '0')}T05:00:00.000Z`,
      });
    }
    records.push(record);
  });
  return records;
};
