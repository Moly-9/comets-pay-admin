import { describe, expect, it } from 'vitest';
import type { CooperationProjectId } from './businessWorkflow';
import { mapFeishuCooperationProjects, type FeishuCooperationProjectDto } from './cooperationProjects';

const record: FeishuCooperationProjectDto = {
  externalProjectId: 'feishu-project-001',
  projectCode: 'FS-2026-001',
  name: 'Synthetic Creator Campaign',
  status: 'ACTIVE',
  updatedAt: '2026-08-07T01:00:00.000Z',
};

describe('Feishu cooperation project adapter', () => {
  it('keeps external identity separate from the COMETS Pay internal id', () => {
    const internalId = 'cooperation_internal_001' as CooperationProjectId;
    expect(mapFeishuCooperationProjects(
      [record],
      { [record.externalProjectId]: internalId },
      '2026-08-07T02:00:00.000Z',
    )).toEqual([expect.objectContaining({
      cooperationProjectId: internalId,
      cooperationProjectCode: record.projectCode,
      externalProjectId: record.externalProjectId,
      externalSystem: 'FEISHU',
      syncStatus: 'SYNCED',
    })]);
  });

  it('rejects duplicated Feishu external project ids', () => {
    expect(() => mapFeishuCooperationProjects(
      [record, { ...record, projectCode: 'FS-2026-002' }],
      { [record.externalProjectId]: 'cooperation_internal_001' as CooperationProjectId },
      '2026-08-07T02:00:00.000Z',
    )).toThrow('externalProjectId 重复');
  });

  it('fails explicitly when an internal identity mapping is missing', () => {
    expect(() => mapFeishuCooperationProjects(
      [record],
      {},
      '2026-08-07T02:00:00.000Z',
    )).toThrow('缺少 COMETS Pay 内部 ID 映射');
  });
});
