import type { FeishuCooperationProjectDto } from './cooperationProjects';

export type CooperationProjectSourceType = 'FEISHU' | 'MANUAL';
export type CooperationProjectAvailability = 'ACTIVE' | 'DISABLED';
export type CooperationProjectSyncScope = 'IN_SCOPE' | 'OUT_OF_SCOPE';

export type CooperationProjectDirectoryRecord = {
  id: string;
  projectCode: string;
  externalProjectId?: string;
  name: string;
  projectType: string;
  projectStatus: string;
  sourceProjectStatus?: string;
  statusOverriddenAt?: string;
  initiatorName: string;
  startDate: string;
  endDate: string;
  source: CooperationProjectSourceType;
  availability: CooperationProjectAvailability;
  syncScope?: CooperationProjectSyncScope;
  availabilityOverriddenAt?: string;
  sourceUpdatedAt?: string;
  localUpdatedAt: string;
  syncedAt?: string;
};

export type CooperationProjectDirectoryStore = {
  version: 2;
  typeAllowlist: string[];
  records: CooperationProjectDirectoryRecord[];
  lastSyncedAt?: string;
};

export const COOPERATION_PROJECT_DIRECTORY_STORAGE_KEY = 'comets-pay:cooperation-project-directory:v2';
export const LEGACY_COOPERATION_PROJECT_DIRECTORY_STORAGE_KEY = 'comets-pay:cooperation-project-directory:v1';

export const emptyCooperationProjectDirectoryStore = (): CooperationProjectDirectoryStore => ({
  version: 2,
  typeAllowlist: [],
  records: [],
});

const normalizeRecord = (value: unknown): CooperationProjectDirectoryRecord | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Omit<Partial<CooperationProjectDirectoryRecord>, 'availability'> & {
    availability?: CooperationProjectAvailability | 'OUT_OF_SCOPE';
    sourceAvailability?: CooperationProjectAvailability | 'OUT_OF_SCOPE';
  };
  const valid = typeof record.id === 'string' && typeof record.projectCode === 'string'
    && typeof record.name === 'string' && typeof record.projectType === 'string'
    && typeof record.projectStatus === 'string' && typeof record.initiatorName === 'string'
    && typeof record.startDate === 'string' && typeof record.endDate === 'string'
    && ['FEISHU', 'MANUAL'].includes(record.source ?? '')
    && ['ACTIVE', 'OUT_OF_SCOPE', 'DISABLED'].includes(record.availability ?? '')
    && typeof record.localUpdatedAt === 'string';
  if (!valid) return undefined;
  const { sourceAvailability, ...rest } = record;
  const syncScope = record.source === 'FEISHU'
    ? (record.syncScope ?? (sourceAvailability === 'OUT_OF_SCOPE' || record.availability === 'OUT_OF_SCOPE'
      ? 'OUT_OF_SCOPE'
      : 'IN_SCOPE'))
    : undefined;
  return {
    ...rest,
    source: record.source as CooperationProjectSourceType,
    availability: record.availability === 'ACTIVE' ? 'ACTIVE' : 'DISABLED',
    syncScope,
  } as CooperationProjectDirectoryRecord;
};

const parseStore = (raw: string): CooperationProjectDirectoryStore | undefined => {
  const parsed = JSON.parse(raw) as { version?: number; typeAllowlist?: unknown; records?: unknown; lastSyncedAt?: unknown };
  if (![1, 2].includes(parsed.version ?? 0) || !Array.isArray(parsed.typeAllowlist) || !Array.isArray(parsed.records)
    || !parsed.typeAllowlist.every((item) => typeof item === 'string')) return undefined;
  const records = parsed.records.map(normalizeRecord);
  if (records.some((record) => !record)) return undefined;
  return {
    version: 2,
    typeAllowlist: [...new Set(parsed.typeAllowlist as string[])],
    records: records as CooperationProjectDirectoryRecord[],
    lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : undefined,
  };
};

export const loadCooperationProjectDirectory = (storage: Pick<Storage, 'getItem'>): CooperationProjectDirectoryStore => {
  for (const key of [COOPERATION_PROJECT_DIRECTORY_STORAGE_KEY, LEGACY_COOPERATION_PROJECT_DIRECTORY_STORAGE_KEY]) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const store = parseStore(raw);
      if (store) return store;
    } catch {
      // Try the legacy key before falling back to an empty directory.
    }
  }
  return emptyCooperationProjectDirectoryStore();
};

export const saveCooperationProjectDirectory = (
  storage: Pick<Storage, 'setItem'>,
  store: CooperationProjectDirectoryStore,
) => storage.setItem(COOPERATION_PROJECT_DIRECTORY_STORAGE_KEY, JSON.stringify(store));

export const synchronizeFeishuDirectory = ({ current, incoming, internalIdFor, syncedAt }: {
  current: CooperationProjectDirectoryRecord[];
  incoming: FeishuCooperationProjectDto[];
  internalIdFor: (externalProjectId: string) => { id: string; projectCode: string };
  syncedAt: string;
}): CooperationProjectDirectoryRecord[] => {
  const incomingIds = new Set(incoming.map((record) => record.externalProjectId));
  const previousByExternalId = new Map(current.flatMap((record) => (
    record.source === 'FEISHU' && record.externalProjectId ? [[record.externalProjectId, record] as const] : []
  )));
  const retained = current.map((record) => (
    record.source === 'FEISHU' && record.externalProjectId && !incomingIds.has(record.externalProjectId)
      ? {
        ...record,
        availability: record.availabilityOverriddenAt ? record.availability : 'DISABLED' as const,
        syncScope: 'OUT_OF_SCOPE' as const,
        localUpdatedAt: syncedAt,
        syncedAt,
      }
      : record
  ));
  const nextById = new Map(retained.map((record) => [record.id, record]));
  incoming.forEach((source) => {
    const previous = previousByExternalId.get(source.externalProjectId);
    const identity = previous ?? internalIdFor(source.externalProjectId);
    nextById.set(identity.id, {
      id: identity.id,
      projectCode: previous?.projectCode ?? identity.projectCode,
      externalProjectId: source.externalProjectId,
      name: source.name,
      projectType: source.projectType,
      projectStatus: previous?.statusOverriddenAt ? previous.projectStatus : source.status,
      sourceProjectStatus: source.status,
      statusOverriddenAt: previous?.statusOverriddenAt,
      initiatorName: source.initiatorName,
      startDate: source.startDate,
      endDate: source.endDate,
      source: 'FEISHU',
      availability: previous?.availabilityOverriddenAt ? previous.availability : 'ACTIVE',
      syncScope: 'IN_SCOPE',
      availabilityOverriddenAt: previous?.availabilityOverriddenAt,
      sourceUpdatedAt: source.updatedAt,
      localUpdatedAt: syncedAt,
      syncedAt,
    });
  });
  return [...nextById.values()];
};

export const activeCooperationProjectIds = (records: CooperationProjectDirectoryRecord[]) => (
  new Set(records.filter((record) => record.availability === 'ACTIVE').map((record) => record.id))
);
