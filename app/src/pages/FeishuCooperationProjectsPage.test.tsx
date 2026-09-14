import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FeishuCooperationProjectsPage } from './FeishuCooperationProjectsPage';
import type { CooperationProjectDirectoryRecord } from '../cooperationProjectDirectory';

const record: CooperationProjectDirectoryRecord = {
  id: 'project-1', projectCode: 'PRJ-1', externalProjectId: 'fs-1', name: '海外达人合作',
  projectType: '品牌营销', projectStatus: 'ACTIVE', initiatorName: '林琪', startDate: '2026-08-01',
  endDate: '2026-10-01', source: 'FEISHU', availability: 'ACTIVE', sourceUpdatedAt: '2026-08-07T01:00:00Z',
  localUpdatedAt: '2026-08-07T02:00:00Z',
};

const renderPage = (canManage: boolean) => renderToStaticMarkup(<FeishuCooperationProjectsPage
  records={[record]}
  metadata={{ projectTypes: ['品牌营销'], projectStatuses: ['ACTIVE'] }}
  typeAllowlist={[]}
  canManage={canManage}
  syncing={false}
  onAllowlistChange={vi.fn()}
  onSync={vi.fn()}
  onSaveManual={vi.fn()}
  onAvailabilityChange={vi.fn()}
  onProjectStatusChange={vi.fn()}
/>);

describe('FeishuCooperationProjectsPage', () => {
  it('shows the synchronized directory fields and empty allowlist guidance to maintainers', () => {
    const html = renderPage(true);
    expect(html).toContain('飞书关联项目');
    expect(html).toContain('项目发起人');
    expect(html).toContain('海外达人合作');
    expect(html).toContain('请先配置项目类型');
    expect(html).toContain('同步飞书');
    expect(html).toContain('全部项目状态');
    expect(html).toContain('全部数据来源');
    expect(html).toContain('全部可用状态');
    expect(html).toContain('修改 海外达人合作 的可用状态');
    expect(html).not.toContain('已移出同步范围');
    expect(html).toContain('已停用');
    expect(html).toContain('修改 海外达人合作 的项目状态');
  });

  it('hides all maintenance controls for a read-only account', () => {
    const html = renderPage(false);
    expect(html).not.toContain('配置同步范围');
    expect(html).not.toContain('手动添加</span>');
    expect(html).not.toContain('操作</th>');
    expect(html).not.toContain('修改 海外达人合作 的可用状态');
  });
});
