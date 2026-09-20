import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEMO_SYSTEM_USERS } from './data';
import { createOperationLogEvent, filterOperationLogs } from './operationLog';
import { canAccessPage } from './permissions';
import { OperationLogPage } from './pages/OperationLogPage';

const user = DEMO_SYSTEM_USERS.find((candidate) => candidate.roleKey === 'admin')!;
const first = createOperationLogEvent(
  { module: 'contracts', action: '查看详情', targetId: 'CON-001' },
  user,
  'session-1',
  '2026-09-20T03:30:00.000Z',
);
const second = createOperationLogEvent(
  { module: 'transactions', action: '导出', result: '失败', failure: '导出失败' },
  { name: '测试财务', role: '财务账号' },
  'session-2',
  '2026-09-19T03:30:00.000Z',
);
const filters = { search: '', startDate: '', endDate: '', actor: '', module: '', action: '', result: '' };

describe('会话操作日志', () => {
  it('只开放管理员与老板的导航权限', () => {
    for (const account of DEMO_SYSTEM_USERS) {
      expect(canAccessPage(account, 'operation-log')).toBe(['admin', 'owner'].includes(account.roleKey));
    }
  });

  it('只使用安全字段生成事件，拒绝邮箱、纯数字账户和自由文本内容', () => {
    const event = createOperationLogEvent({ module: 'projects', action: '提交', targetId: 'sensitive@example.com' }, user, 's1');
    expect(event.targetId).toBeUndefined();
    expect(createOperationLogEvent({ module: 'projects', action: '编辑', targetId: '1234567890123456' }, user, 's2').targetId).toBeUndefined();
    expect(createOperationLogEvent({ module: 'projects', action: '编辑', targetId: 'GB82WEST12345698765432' }, user, 's4').targetId).toBeUndefined();
    expect(event.summary).toBe('我的请款 · 提交');
    expect(first.targetId).toBe('CON-001');
    expect(second.summary).toBe('交易记录 · 导出（导出失败）');
    expect(createOperationLogEvent({ module: 'requests', action: '审核退回', targetId: 'REQ-001' }, user, 's3').summary).toBe('请款审批 · 审核退回');
  });

  it('按安全字段、日期、角色、动作与结果过滤', () => {
    expect(filterOperationLogs([first, second], { ...filters, search: 'con-001' })).toEqual([first]);
    expect(filterOperationLogs([first, second], { ...filters, actor: '测试财务', result: '失败' })).toEqual([second]);
    expect(filterOperationLogs([first, second], { ...filters, module: 'contracts', action: '查看详情' })).toEqual([first]);
    expect(filterOperationLogs([first, second], { ...filters, startDate: '2026-09-20' })).toEqual([first]);
  });

  it('空页面不预置虚构日志，日志详情入口可见', () => {
    const empty = renderToStaticMarkup(<OperationLogPage events={[]} />);
    expect(empty).toContain('刷新后清空');
    expect(empty).toContain('当前会话还没有操作记录');
    const populated = renderToStaticMarkup(<OperationLogPage events={[first]} />);
    expect(populated).toContain('CON-001');
    expect(populated).toContain('查看详情');
  });
});
