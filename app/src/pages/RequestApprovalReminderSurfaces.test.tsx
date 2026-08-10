import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '../components/AppShell';
import type { SystemUser } from '../data';
import {
  NotificationsPage,
  RequestsPage,
  type SystemNotificationItem,
} from './OperationalPages';
import { FileCheck2 } from 'lucide-react';

const financeUser: SystemUser = {
  account: 'finance.test',
  name: '财务测试账号',
  email: 'finance@example.test',
  initials: 'FT',
  roleKey: 'finance',
  role: '财务账号',
};

const approvalReminder = {
  count: 2,
  requestIds: ['request-one', 'request-two'],
  stageSummary: '财务审批 2 个',
};

const notifications: SystemNotificationItem[] = [{
  id: 1,
  icon: FileCheck2,
  title: 'Invoice 等待复核',
  body: '测试通知',
  time: '刚刚',
  unread: true,
}];

describe('request approval reminder surfaces', () => {
  it('renders a dismissible reminder above the request list', () => {
    const html = renderToStaticMarkup(
      <RequestsPage
        notify={vi.fn()}
        currentUser={financeUser}
        requests={[]}
        paymentLists={[]}
        creators={[]}
        generatedInvoices={[]}
        approvalReminder={approvalReminder}
        showApprovalReminder
        onDismissApprovalReminder={vi.fn()}
        onExportPaymentList={vi.fn()}
        onApprovalAction={vi.fn()}
        onOpenFinanceReview={vi.fn()}
        focusedRequestId={null}
        onFocusCleared={vi.fn()}
      />,
    );

    expect(html).toContain('你当前有 <b>2</b> 个请款项目待审批');
    expect(html).toContain('请及时核对请款资料并完成当前节点处理');
    expect(html).not.toContain('财务审批 2 个');
    expect(html).toContain('aria-label="关闭提示"');
  });

  it('adds the current approval reminder to the in-app inbox', () => {
    const html = renderToStaticMarkup(
      <NotificationsPage
        items={notifications}
        approvalReminder={approvalReminder}
        approvalReminderUnread
        onRead={vi.fn()}
        onReadApprovalReminder={vi.fn()}
        onMarkAllRead={vi.fn()}
        onOpenRequestApprovals={vi.fn()}
      />,
    );

    expect(html).toContain('你有 2 个请款项目待审批');
    expect(html).toContain('点击进入请款项目处理');
    expect(html).not.toContain('财务审批 2 个');
    expect(html).toContain('你有 2 条未读消息');
  });

  it('shows the real unread count on the global notification button', () => {
    const html = renderToStaticMarkup(
      <AppShell
        activePage="requests"
        onNavigate={vi.fn()}
        currentUser={financeUser}
        notificationUnreadCount={3}
      >
        <main>内容</main>
      </AppShell>,
    );

    expect(html).toContain('aria-label="通知，3 条未读"');
    expect(html).toContain('class="notification-count"');
    expect(html).toContain('>3</span>');
  });
});
