import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  FeishuCooperationProjectsPage,
  ManualCooperationProjectForm,
} from './FeishuCooperationProjectsPage';
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
/>);

describe('FeishuCooperationProjectsPage', () => {
  it('shows the synchronized directory fields and empty allowlist guidance to maintainers', () => {
    const html = renderPage(true);
    expect(html).toContain('飞书关联项目');
    expect(html).toContain('项目发起人');
    expect(html).toContain('海外达人合作');
    expect(html).toContain('请先配置项目类型');
    expect(html).toContain('同步飞书');
    expect(html).not.toContain('全部项目状态');
    expect(html).not.toContain('<th>项目状态</th>');
    expect(html).not.toContain('data-label="项目状态"');
    expect(html).not.toContain('<th>项目周期</th>');
    expect(html).not.toContain('data-label="项目周期"');
    expect(html).toContain('全部数据来源');
    expect(html).toContain('全部可用状态');
    expect(html).toContain('修改 海外达人合作 的可用状态');
    expect(html).not.toContain('已移出同步范围');
    expect(html).toContain('已停用');
    expect(html).not.toContain('修改 海外达人合作 的项目状态');
  });

  it('hides all maintenance controls for a read-only account', () => {
    const html = renderPage(false);
    expect(html).not.toContain('配置同步范围');
    expect(html).not.toContain('手动添加</span>');
    expect(html).not.toContain('操作</th>');
    expect(html).not.toContain('修改 海外达人合作 的可用状态');
  });

  it('uses availability in the manual form and omits lifecycle and date fields', () => {
    const renderForm = (availability: '' | 'ACTIVE' | 'DISABLED') => renderToStaticMarkup(<ManualCooperationProjectForm
      draft={{ name: '', projectType: '', initiatorName: '', availability }}
      error=""
      onChange={vi.fn()}
    />);
    const html = renderForm('');

    expect(html).toContain('可用状态 *');
    expect(html).toContain('aria-label="手动项目可用状态"');
    expect(html).toContain('请选择可用状态');
    expect(renderForm('ACTIVE')).toContain('可用');
    expect(renderForm('DISABLED')).toContain('已停用');
    expect(html).not.toContain('项目状态');
    expect(html).not.toContain('进行中');
    expect(html).not.toContain('已归档');
    expect(html).not.toContain('开始时间');
    expect(html).not.toContain('结束时间');
  });
});
