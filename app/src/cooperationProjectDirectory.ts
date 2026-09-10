import type { FeishuCooperationProjectDto } from './cooperationProjects';

export type CooperationProjectSourceType = 'FEISHU' | 'MANUAL';
export type CooperationProjectAvailability = 'ACTIVE' | 'OUT_OF_SCOPE' | 'DISABLED';

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
  sourceUpdatedAt?: string;
  localUpdatedAt: string;
  syncedAt?: string;
};

export type CooperationProjectDirectoryStore = {
  version: 1;
  typeAllowlist: string[];
  records: CooperationProjectDirectoryRecord[];
  lastSyncedAt?: string;
};

export const COOPERATION_PROJECT_DIRECTORY_STORAGE_KEY = 'comets-pay:cooperation-project-directory:v1';

export const emptyCooperationProjectDirectoryStore = (): CooperationProjectDirectoryStore => ({
  version: 1,
  typeAllowlist: [],
  records: [],
});

const isRecord = (value: unknown): value is CooperationProjectDirectoryRecord => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<CooperationProjectDirectoryRecord>;
  return typeof record.id === 'string' && typeof record.projectCode === 'string'
    && typeof record.name === 'string' && typeof record.projectType === 'string'
    && typeof record.projectStatus === 'string' && typeof record.initiatorName === 'string'
    && typeof record.startDate === 'string' && typeof record.endDate === 'string'
    && ['FEISHU', 'MANUAL'].includes(record.source ?? '')
    && ['ACTIVE', 'OUT_OF_SCOPE', 'DISABLED'].includes(record.availability ?? '')
    && typeof record.localUpdatedAt === 'string';
};

export const loadCooperationProjectDirectory = (storage: Pick<Storage, 'getItem'>): CooperationProjectDirectoryStore => {
  try {
    const raw = storage.getItem(COOPERATION_PROJECT_DIRECTORY_STORAGE_KEY);
    if (!raw) return emptyCooperationProjectDirectoryStore();
    const parsed = JSON.parse(raw) as Partial<CooperationProjectDirectoryStore>;
    if (parsed.version !== 1 || !Array.isArray(parsed.typeAllowlist) || !Array.isArray(parsed.records)
      || !parsed.typeAllowlist.every((item) => typeof item === 'string') || !parsed.records.every(isRecord)) {
      return emptyCooperationProjectDirectoryStore();
    }
    return {
      version: 1,
      typeAllowlist: [...new Set(parsed.typeAllowlist)],
      records: parsed.records,
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : undefined,
    };
  } catch {
    return emptyCooperationProjectDirectoryStore();
  }
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
      ? { ...record, availability: 'OUT_OF_SCOPE' as const, localUpdatedAt: syncedAt, syncedAt }
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
      availability: 'ACTIVE',
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
