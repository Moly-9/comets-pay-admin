import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEMO_SYSTEM_USERS } from '../data';
import type { SystemRoleKey } from '../data';
import { AppShell } from './AppShell';

const userFor = (roleKey: SystemRoleKey) => {
  const user = DEMO_SYSTEM_USERS.find((candidate) => candidate.roleKey === roleKey);
  if (!user) throw new Error(`Missing ${roleKey} demo user`);
  return user;
};

const renderFor = (roleKey: SystemRoleKey) => renderToStaticMarkup(
  <AppShell
    activePage="dashboard"
    currentUser={userFor(roleKey)}
    notificationUnreadCount={0}
    onNavigate={vi.fn()}
  >
    <div>页面内容</div>
  </AppShell>,
);

describe('AppShell system navigation', () => {
  it('shows system accounts and configuration to administrators', () => {
    const html = renderFor('admin');
    expect(html).toContain('系统设置');
    expect(html).toContain('系统账号');
    expect(html).toContain('系统配置');
  });

  it('shows only system configuration to project leads and hides the group from media', () => {
    const projectHtml = renderFor('project');
    const mediaHtml = renderFor('media');
    expect(projectHtml).toContain('系统设置');
    expect(projectHtml).toContain('系统配置');
    expect(projectHtml).not.toContain('系统账号');
    expect(mediaHtml).not.toContain('系统设置');
    expect(mediaHtml).not.toContain('系统配置');
  });
});
