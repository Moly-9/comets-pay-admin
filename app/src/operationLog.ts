import type { SystemUser } from './data';
import { PAGE_TITLES } from './data';
import type { NavPage } from './types';

export type OperationAction = '进入页面' | '查看详情' | '搜索' | '导出' | '新增' | '编辑' | '删除' | '取消请款' | '生成' | '提交' | '审核通过' | '审核退回' | '付款' | '记录付款失败' | '配置' | '测试连接';
export type OperationResult = '已访问' | '成功' | '失败';
export type OperationFailure = '权限不足' | '校验未通过' | '操作失败' | '导出失败';

export type OperationLogEvent = {
  id: string;
  occurredAt: string;
  actorName: string;
  actorRole: string;
  module: NavPage;
  action: OperationAction;
  targetId?: string;
  result: OperationResult;
  summary: string;
};

export type OperationLogInput = {
  module: NavPage;
  action: OperationAction;
  targetId?: string;
  result?: OperationResult;
  failure?: OperationFailure;
};

// Never accept a free-form summary, form value, filename, account, or exception message.
export function createOperationLogEvent(
  input: OperationLogInput,
  user: Pick<SystemUser, 'name' | 'role'>,
  id: string,
  occurredAt = new Date().toISOString(),
): OperationLogEvent {
  const result = input.result ?? (input.action === '进入页面' || input.action === '查看详情' ? '已访问' : '成功');
  const targetId = input.targetId
    && input.targetId.length <= 100
    && /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Z]{2,6}-[a-zA-Z0-9_-]+|[a-z][a-z0-9]*(?:[_:-][a-z0-9]+)+)$/.test(input.targetId)
    ? input.targetId : undefined;
  return {
    id,
    occurredAt,
    actorName: user.name,
    actorRole: user.role,
    module: input.module,
    action: input.action,
    ...(targetId ? { targetId } : {}),
    result,
    summary: `${PAGE_TITLES[input.module]} · ${input.action}${result === '失败' ? `（${input.failure ?? '操作失败'}）` : ''}`,
  };
}

export type OperationLogFilters = {
  search: string;
  startDate: string;
  endDate: string;
  actor: string;
  module: string;
  action: string;
  result: string;
};

export function filterOperationLogs(events: readonly OperationLogEvent[], filters: OperationLogFilters) {
  const search = filters.search.trim().toLocaleLowerCase('zh-CN');
  return events.filter((event) => {
    const localDay = new Date(event.occurredAt).toLocaleDateString('en-CA');
    return (!filters.startDate || localDay >= filters.startDate)
      && (!filters.endDate || localDay <= filters.endDate)
      && (!filters.actor || event.actorName === filters.actor)
      && (!filters.module || event.module === filters.module)
      && (!filters.action || event.action === filters.action)
      && (!filters.result || event.result === filters.result)
      && (!search || `${event.actorName} ${event.actorRole} ${PAGE_TITLES[event.module]} ${event.action} ${event.targetId ?? ''} ${event.result} ${event.summary}`.toLocaleLowerCase('zh-CN').includes(search));
  });
}
