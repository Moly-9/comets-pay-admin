import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_NOTIFICATIONS,
  NotificationsPage,
} from './OperationalPages';

describe('NotificationsPage', () => {
  it('renders explicit navigation actions backed by stable notification targets', () => {
    const markup = renderToStaticMarkup(
      <NotificationsPage
        items={INITIAL_NOTIFICATIONS}
        approvalReminder={{ count: 0, requestIds: [], stageSummary: '' }}
        approvalReminderUnread={false}
        onRead={() => undefined}
        onReadApprovalReminder={() => undefined}
        onMarkAllRead={() => undefined}
        onOpenRequestApprovals={() => undefined}
        onOpenTarget={() => undefined}
      />,
    );

    expect(INITIAL_NOTIFICATIONS.map((item) => item.target.kind)).toEqual([
      'invoice-review',
      'creator-payout',
      'batch',
      'transaction',
    ]);
    expect(INITIAL_NOTIFICATIONS[0].target).toEqual({
      kind: 'invoice-review',
      invoiceId: 'invoice_fixture_301164_01',
    });
    expect(markup).toContain('aria-label="Invoice 待审核，进入审核"');
    expect(markup).toContain('更新收款资料');
    expect(markup).toContain('查看批次');
    expect(markup).toContain('查看付款详情');
  });
});
