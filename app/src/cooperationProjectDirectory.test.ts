import { describe, expect, it } from 'vitest';
import {
  emptyCooperationProjectDirectoryStore,
  loadCooperationProjectDirectory,
  synchronizeFeishuDirectory,
  type CooperationProjectDirectoryRecord,
} from './cooperationProjectDirectory';
import type { FeishuCooperationProjectDto } from './cooperationProjects';

const existing: CooperationProjectDirectoryRecord = {
  id: 'project-internal-1', projectCode: 'PRJ-1', externalProjectId: 'fs-1', name: 'Old name',
  projectType: '品牌营销', projectStatus: 'ACTIVE', initiatorName: 'A', startDate: '2026-01-01',
  endDate: '2026-02-01', source: 'FEISHU', availability: 'ACTIVE', localUpdatedAt: '2026-01-01T00:00:00Z',
};
const incoming: FeishuCooperationProjectDto = {
  externalProjectId: 'fs-1', projectCode: 'FS-1', name: 'New name', projectType: '品牌营销', status: 'ARCHIVED',
  initiatorName: 'B', startDate: '2026-01-02', endDate: '2026-03-01', updatedAt: '2026-02-01T00:00:00Z',
};

describe('cooperation project directory', () => {
  it('updates by external id while retaining the internal identity', () => {
    const result = synchronizeFeishuDirectory({ current: [existing], incoming: [incoming], syncedAt: '2026-02-02T00:00:00Z', internalIdFor: () => ({ id: 'new', projectCode: 'new' }) });
    expect(result[0]).toMatchObject({ id: existing.id, projectCode: existing.projectCode, name: 'New name', projectStatus: 'ARCHIVED', sourceProjectStatus: 'ARCHIVED', availability: 'ACTIVE' });
  });

  it('keeps a local status override when the Feishu source is synchronized again', () => {
    const overridden = { ...existing, projectStatus: 'ARCHIVED', statusOverriddenAt: '2026-02-01T00:00:00Z' };
    const result = synchronizeFeishuDirectory({ current: [overridden], incoming: [{ ...incoming, status: 'ACTIVE' }], syncedAt: '2026-02-02T00:00:00Z', internalIdFor: () => ({ id: 'new', projectCode: 'new' }) });
    expect(result[0]).toMatchObject({ projectStatus: 'ARCHIVED', sourceProjectStatus: 'ACTIVE', statusOverriddenAt: overridden.statusOverriddenAt });
  });

  it('keeps a manually overridden availability when the Feishu source is synchronized again', () => {
    const overridden = { ...existing, availability: 'DISABLED' as const, availabilityOverriddenAt: '2026-02-01T00:00:00Z' };
    const result = synchronizeFeishuDirectory({ current: [overridden], incoming: [incoming], syncedAt: '2026-02-02T00:00:00Z', internalIdFor: () => ({ id: 'new', projectCode: 'new' }) });
    expect(result[0]).toMatchObject({ availability: 'DISABLED', sourceAvailability: 'ACTIVE', availabilityOverriddenAt: overridden.availabilityOverriddenAt });
  });

  it('marks missing Feishu records out of scope without removing manual records', () => {
    const manual = { ...existing, id: 'manual-1', externalProjectId: undefined, source: 'MANUAL' as const };
    const result = synchronizeFeishuDirectory({ current: [existing, manual], incoming: [], syncedAt: '2026-02-02T00:00:00Z', internalIdFor: () => ({ id: 'new', projectCode: 'new' }) });
    expect(result.find((item) => item.id === existing.id)?.availability).toBe('OUT_OF_SCOPE');
    expect(result.find((item) => item.id === manual.id)?.availability).toBe('ACTIVE');
  });

  it('safely falls back when local storage is corrupt or from another version', () => {
    expect(loadCooperationProjectDirectory({ getItem: () => '{bad' })).toEqual(emptyCooperationProjectDirectoryStore());
    expect(loadCooperationProjectDirectory({ getItem: () => JSON.stringify({ version: 0, records: [], typeAllowlist: ['x'] }) })).toEqual(emptyCooperationProjectDirectoryStore());
  });
});
