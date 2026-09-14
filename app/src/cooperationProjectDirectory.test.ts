import { describe, expect, it } from 'vitest';
import {
  activeCooperationProjectIds,
  COOPERATION_PROJECT_DIRECTORY_STORAGE_KEY,
  duplicateActiveCooperationProjectFor,
  emptyCooperationProjectDirectoryStore,
  LEGACY_COOPERATION_PROJECT_DIRECTORY_STORAGE_KEY,
  loadCooperationProjectDirectory,
  manualCooperationProjectRecordFor,
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
  it('creates manual projects without fabricated dates and keeps availability independent from lifecycle', () => {
    const active = manualCooperationProjectRecordFor({
      input: { name: 'Manual active', projectType: '品牌营销', initiatorName: 'A', availability: 'ACTIVE' },
      identity: { id: 'manual-active', projectCode: 'PRJ-MANUAL-ACTIVE' },
      updatedAt: '2026-09-14T12:00:00Z',
    });
    const disabled = manualCooperationProjectRecordFor({
      input: { name: 'Manual disabled', projectType: '品牌营销', initiatorName: 'B', availability: 'DISABLED' },
      identity: { id: 'manual-disabled', projectCode: 'PRJ-MANUAL-DISABLED' },
      updatedAt: '2026-09-14T12:00:00Z',
    });

    expect(active).toMatchObject({
      projectStatus: 'ACTIVE',
      availability: 'ACTIVE',
      source: 'MANUAL',
      startDate: '',
      endDate: '',
    });
    expect(disabled).toMatchObject({ projectStatus: 'ACTIVE', availability: 'DISABLED' });
    expect([...activeCooperationProjectIds([active, disabled])]).toEqual(['manual-active']);
  });

  it('preserves hidden lifecycle and historical dates when editing a manual project', () => {
    const previous: CooperationProjectDirectoryRecord = {
      ...existing,
      id: 'manual-existing',
      projectCode: 'PRJ-MANUAL-EXISTING',
      source: 'MANUAL',
      externalProjectId: undefined,
      projectStatus: 'ARCHIVED',
    };
    const updated = manualCooperationProjectRecordFor({
      input: { name: 'Updated manual', projectType: previous.projectType, initiatorName: 'B', availability: 'DISABLED' },
      identity: previous,
      previous,
      updatedAt: '2026-09-14T13:00:00Z',
    });

    expect(updated).toMatchObject({
      name: 'Updated manual',
      projectStatus: 'ARCHIVED',
      availability: 'DISABLED',
      startDate: previous.startDate,
      endDate: previous.endDate,
    });
  });

  it('only reports same-name conflicts when the project will be available', () => {
    expect(duplicateActiveCooperationProjectFor([existing], { name: ' old NAME ', availability: 'ACTIVE' })).toBe(existing);
    expect(duplicateActiveCooperationProjectFor([existing], { name: 'Old name', availability: 'DISABLED' })).toBeUndefined();
    expect(duplicateActiveCooperationProjectFor([existing], { name: 'Old name', availability: 'ACTIVE' }, existing.id)).toBeUndefined();
  });

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
    expect(result[0]).toMatchObject({ availability: 'DISABLED', syncScope: 'IN_SCOPE', availabilityOverriddenAt: overridden.availabilityOverriddenAt });
  });

  it('disables missing Feishu records while retaining sync scope metadata and manual records', () => {
    const manual = { ...existing, id: 'manual-1', externalProjectId: undefined, source: 'MANUAL' as const };
    const result = synchronizeFeishuDirectory({ current: [existing, manual], incoming: [], syncedAt: '2026-02-02T00:00:00Z', internalIdFor: () => ({ id: 'new', projectCode: 'new' }) });
    expect(result.find((item) => item.id === existing.id)).toMatchObject({ availability: 'DISABLED', syncScope: 'OUT_OF_SCOPE' });
    expect(result.find((item) => item.id === manual.id)?.availability).toBe('ACTIVE');
  });

  it('restores an automatically disabled project when it returns to the sync scope', () => {
    const [outsideScope] = synchronizeFeishuDirectory({ current: [existing], incoming: [], syncedAt: '2026-02-02T00:00:00Z', internalIdFor: () => ({ id: 'new', projectCode: 'new' }) });
    const [restored] = synchronizeFeishuDirectory({ current: [outsideScope], incoming: [incoming], syncedAt: '2026-02-03T00:00:00Z', internalIdFor: () => ({ id: 'new', projectCode: 'new' }) });
    expect(restored).toMatchObject({ availability: 'ACTIVE', syncScope: 'IN_SCOPE' });
  });

  it('keeps an explicit active override when a project leaves the sync scope', () => {
    const overridden = { ...existing, availabilityOverriddenAt: '2026-02-01T00:00:00Z' };
    const [result] = synchronizeFeishuDirectory({ current: [overridden], incoming: [], syncedAt: '2026-02-02T00:00:00Z', internalIdFor: () => ({ id: 'new', projectCode: 'new' }) });
    expect(result).toMatchObject({ availability: 'ACTIVE', syncScope: 'OUT_OF_SCOPE' });
  });

  it('migrates legacy out-of-scope records to the disabled state without losing data', () => {
    const legacy = JSON.stringify({
      version: 1,
      typeAllowlist: ['品牌营销'],
      records: [{ ...existing, availability: 'OUT_OF_SCOPE', sourceAvailability: 'OUT_OF_SCOPE' }],
      lastSyncedAt: '2026-02-02T00:00:00Z',
    });
    const storage = { getItem: (key: string) => key === LEGACY_COOPERATION_PROJECT_DIRECTORY_STORAGE_KEY ? legacy : null };
    expect(loadCooperationProjectDirectory(storage)).toMatchObject({
      version: 2,
      typeAllowlist: ['品牌营销'],
      records: [{ id: existing.id, availability: 'DISABLED', syncScope: 'OUT_OF_SCOPE' }],
    });
  });

  it('safely falls back when local storage is corrupt or from another version', () => {
    expect(loadCooperationProjectDirectory({ getItem: () => '{bad' })).toEqual(emptyCooperationProjectDirectoryStore());
    expect(loadCooperationProjectDirectory({ getItem: (key) => key === COOPERATION_PROJECT_DIRECTORY_STORAGE_KEY ? JSON.stringify({ version: 0, records: [], typeAllowlist: ['x'] }) : null })).toEqual(emptyCooperationProjectDirectoryStore());
  });
});
