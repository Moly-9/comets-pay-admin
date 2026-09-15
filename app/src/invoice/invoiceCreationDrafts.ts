import type {
  InvoiceBatchDraft,
  InvoiceBatchDraftRow,
  InvoiceCreationDraft,
  InvoiceSingleCreationDraft,
} from '../types';

export const INVOICE_CREATION_DRAFT_SCHEMA_VERSION = '2.0' as const;
export const INVOICE_CREATION_DRAFT_STORAGE_PREFIX = 'comets-pay.invoice-creation-drafts.v1';

export const invoiceCreationDraftStorageKey = (account: string) => (
  `${INVOICE_CREATION_DRAFT_STORAGE_PREFIX}:${account.trim().toLowerCase()}`
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isDraftBase = (value: unknown): value is Record<string, unknown> => (
  isRecord(value)
  && typeof value.draftId === 'string'
  && (value.schemaVersion === '1.0' || value.schemaVersion === INVOICE_CREATION_DRAFT_SCHEMA_VERSION)
  && typeof value.createdByAccount === 'string'
  && typeof value.createdByName === 'string'
  && typeof value.createdAt === 'string'
  && typeof value.updatedAt === 'string'
);

const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every((item) => typeof item === 'string')
);

const isInvoiceLineItem = (value: unknown) => (
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.description === 'string'
  && typeof value.unitPrice === 'number'
  && typeof value.quantity === 'number'
  && typeof value.lineTotal === 'number'
);

const isBatchLineItem = (value: unknown) => (
  isRecord(value)
  && isInvoiceLineItem(value)
  && typeof value.templateKey === 'string'
  && (value.lineItemScope === undefined || value.lineItemScope === 'SHARED' || value.lineItemScope === 'CREATOR')
);

const isGeneratedInvoiceRecord = (value: unknown) => (
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.invoiceId === 'string'
  && typeof value.sourcePayoutId === 'string'
  && typeof value.status === 'string'
  && typeof value.generatedAt === 'string'
  && isRecord(value.snapshot)
  && (value.validationStatus === 'valid' || value.validationStatus === 'needs_review')
);

const isBatchDraftRow = (value: unknown) => (
  isRecord(value)
  && typeof value.projectId === 'string'
  && typeof value.engagementId === 'string'
  && typeof value.creatorId === 'string'
  && typeof value.creatorName === 'string'
  && typeof value.creatorHandle === 'string'
  && typeof value.sourcePayoutId === 'string'
  && typeof value.invoiceDate === 'string'
  && Array.isArray(value.items)
  && value.items.every(isBatchLineItem)
  && isStringArray(value.descriptionOverrideKeys)
  && typeof value.currency === 'string'
  && typeof value.payoutAccountId === 'string'
  && typeof value.payoutAccountLocked === 'boolean'
  && isStringArray(value.contractIds)
  && isStringArray(value.availableContractIds)
  && typeof value.contractMatchReason === 'string'
  && typeof value.status === 'string'
  && isStringArray(value.issues)
  && (
    value.generated === undefined
    || (isRecord(value.generated) && isGeneratedInvoiceRecord(value.generated.record))
  )
);

export const isInvoiceCreationDraft = (value: unknown): value is InvoiceCreationDraft => {
  if (!isDraftBase(value)) return false;
  if (value.kind === 'SINGLE') {
    return typeof value.creatorId === 'string'
      && typeof value.creatorSocialAccountId === 'string'
      && typeof value.projectId === 'string'
      && typeof value.engagementId === 'string'
      && typeof value.invoiceDate === 'string'
      && typeof value.selectedBillingEntityId === 'string'
      && isStringArray(value.contractIds)
      && Array.isArray(value.items)
      && value.items.every(isInvoiceLineItem)
      && isRecord(value.billTo)
      && isRecord(value.from)
      && typeof value.currency === 'string'
      && typeof value.payoutAccountId === 'string'
      && isRecord(value.payment)
      && typeof value.contractMatchReason === 'string';
  }
  if (value.kind === 'BATCH') {
    return typeof value.batchId === 'string'
      && typeof value.projectId === 'string'
      && typeof value.invoiceDate === 'string'
      && typeof value.selectedBillingEntityId === 'string'
      && typeof value.currency === 'string'
      && (value.selectedCreatorIds === undefined || isStringArray(value.selectedCreatorIds))
      && isStringArray(value.selectedEngagementIds)
      && Array.isArray(value.sharedDescriptions)
      && value.sharedDescriptions.every((item) => (
        isRecord(item)
        && typeof item.templateKey === 'string'
        && typeof item.description === 'string'
      ))
      && Array.isArray(value.rows)
      && value.rows.every(isBatchDraftRow)
      && isRecord(value.generationProgress)
      && typeof value.generationProgress.current === 'number'
      && typeof value.generationProgress.total === 'number';
  }
  return false;
};

export const parseInvoiceCreationDrafts = (
  raw: string | null,
  account: string,
): InvoiceCreationDraft[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalizedAccount = account.trim().toLowerCase();
    return parsed
      .filter(isInvoiceCreationDraft)
      .filter((draft) => draft.createdByAccount.trim().toLowerCase() === normalizedAccount)
      .map((draft): InvoiceCreationDraft => {
        if (draft.kind !== 'BATCH') {
          return { ...draft, schemaVersion: INVOICE_CREATION_DRAFT_SCHEMA_VERSION };
        }
        const creatorIdByEngagementId = new Map(draft.rows.map((row) => [
          row.engagementId,
          row.creatorId,
        ]));
        const migratedCreatorIds = [
          ...draft.selectedEngagementIds.flatMap((engagementId) => {
            const creatorId = creatorIdByEngagementId.get(engagementId);
            return creatorId ? [creatorId] : [];
          }),
          ...draft.rows.map((row) => row.creatorId),
        ];
        return {
          ...draft,
          schemaVersion: INVOICE_CREATION_DRAFT_SCHEMA_VERSION,
          selectedCreatorIds: draft.selectedCreatorIds?.length
            ? [...draft.selectedCreatorIds]
            : [...new Set(migratedCreatorIds)] as InvoiceBatchDraft['selectedCreatorIds'],
        };
      })
      .filter((draft) => draft.kind === 'SINGLE' || invoiceBatchDraftHasPendingRows(draft))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [];
  }
};

export const loadInvoiceCreationDrafts = (
  account: string,
  storage: Pick<Storage, 'getItem'> = window.localStorage,
) => parseInvoiceCreationDrafts(storage.getItem(invoiceCreationDraftStorageKey(account)), account);

export const saveInvoiceCreationDrafts = (
  account: string,
  drafts: InvoiceCreationDraft[],
  storage: Pick<Storage, 'setItem'> = window.localStorage,
) => {
  const normalizedAccount = account.trim().toLowerCase();
  const ownedDrafts = drafts.filter((draft) => (
    draft.createdByAccount.trim().toLowerCase() === normalizedAccount
  ));
  storage.setItem(invoiceCreationDraftStorageKey(account), JSON.stringify(ownedDrafts));
};

export const upsertInvoiceCreationDraft = (
  drafts: InvoiceCreationDraft[],
  draft: InvoiceCreationDraft,
) => [
  draft,
  ...drafts.filter((candidate) => candidate.draftId !== draft.draftId),
].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

export const removeInvoiceCreationDraft = (
  drafts: InvoiceCreationDraft[],
  draftId: string,
) => drafts.filter((draft) => draft.draftId !== draftId);

export const invoiceSingleDraftHasMeaningfulContent = (
  draft: Pick<InvoiceSingleCreationDraft,
    | 'creatorId'
    | 'projectId'
    | 'contractIds'
    | 'items'
    | 'payoutAccountId'
    | 'contractMatchReason'>,
) => Boolean(
  draft.creatorId
  || draft.projectId
  || draft.contractIds.length
  || draft.payoutAccountId
  || draft.contractMatchReason.trim()
  || draft.items.some((item) => (
    item.description.trim() || item.unitPrice > 0 || item.quantity > 0
  )),
);

export const invoiceBatchDraftHasPendingRows = (draft: InvoiceBatchDraft) => (
  draft.rows.some((row) => row.status !== 'GENERATED')
  || (!draft.rows.length && Boolean(draft.selectedCreatorIds?.length))
);

export const invoiceBatchDraftGeneratedCount = (draft: InvoiceBatchDraft) => (
  draft.rows.filter((row) => row.status === 'GENERATED').length
);

export const invoiceBatchDraftRowWithFiles = (
  row: InvoiceBatchDraftRow,
  files: { pdfBlob: Blob; docxBlob: Blob },
) => ({
  ...row,
  generated: row.generated ? { ...row.generated, ...files } : undefined,
});
