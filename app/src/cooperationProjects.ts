import type { CooperationProjectId } from './businessWorkflow';

export type FeishuCooperationProjectDto = {
  externalProjectId: string;
  projectCode: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  ownerName?: string;
  updatedAt: string;
};

export type CooperationProjectIdentity = {
  cooperationProjectId: CooperationProjectId;
  cooperationProjectCode: string;
  externalSystem: 'FEISHU';
  externalProjectId: string;
  syncStatus: 'SYNCED' | 'STALE' | 'FAILED';
  syncedAt: string;
};

export type CooperationProjectSyncResult = {
  projects: CooperationProjectIdentity[];
  syncedAt: string;
  source: 'MOCK_FEISHU_ADAPTER';
};

export type CooperationProjectSource = {
  listProjects: () => Promise<CooperationProjectSyncResult>;
};

const assertUniqueExternalProjects = (records: FeishuCooperationProjectDto[]) => {
  const seen = new Set<string>();
  records.forEach((record) => {
    const key = record.externalProjectId.trim();
    if (!key) throw new Error('飞书合作项目缺少 externalProjectId');
    if (seen.has(key)) throw new Error(`飞书合作项目 externalProjectId 重复：${key}`);
    seen.add(key);
  });
};

export const mapFeishuCooperationProjects = (
  records: FeishuCooperationProjectDto[],
  internalIds: Record<string, CooperationProjectId>,
  syncedAt: string,
): CooperationProjectIdentity[] => {
  assertUniqueExternalProjects(records);
  return records.map((record) => {
    const cooperationProjectId = internalIds[record.externalProjectId];
    if (!cooperationProjectId) {
      throw new Error(`合作项目 ${record.externalProjectId} 缺少 COMETS Pay 内部 ID 映射`);
    }
    return {
      cooperationProjectId,
      cooperationProjectCode: record.projectCode,
      externalSystem: 'FEISHU',
      externalProjectId: record.externalProjectId,
      syncStatus: 'SYNCED',
      syncedAt,
    };
  });
};

export const createMockFeishuCooperationProjectSource = (
  records: FeishuCooperationProjectDto[],
  internalIds: Record<string, CooperationProjectId>,
): CooperationProjectSource => ({
  listProjects: async () => {
    const syncedAt = '2026-08-07T02:00:00.000Z';
    return {
      projects: mapFeishuCooperationProjects(records, internalIds, syncedAt),
      syncedAt,
      source: 'MOCK_FEISHU_ADAPTER',
    };
  },
});
