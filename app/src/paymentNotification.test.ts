import { describe, expect, it } from 'vitest';
import { recordPaymentListReturnNotification } from './paymentNotification';
import type { RequestApprovalReturnItem } from './businessWorkflow';

const returnItem = (issueType: RequestApprovalReturnItem['issueType'] = 'PAYMENT_LIST'): RequestApprovalReturnItem => ({
  pageKey: 'invoice:notification-test',
  invoiceId: 'invoice-notification-test' as never,
  invoiceNumber: 'INV-NOTIFICATION-001',
  issueType,
  reason: '收款账户信息需要更新',
  paymentItems: [{ paymentListId: 'payment-list-notification-test' as never, itemId: 'item-1' }],
});

describe('payment return notifications', () => {
  it('records in-app and Gmail deliveries for a payment-list return', () => {
    const updated = recordPaymentListReturnNotification(
      returnItem(),
      { account: 'media@example.test', name: '项目媒介' },
      '请更新收款账户后重新提交。',
      'creator@example.test',
      '2026-08-17T10:00:00.000Z',
    );

    expect(updated.notifications).toHaveLength(1);
    expect(updated.notifications?.[0]).toMatchObject({
      message: '请更新收款账户后重新提交。',
      actorAccount: 'media@example.test',
      occurredAt: '2026-08-17T10:00:00.000Z',
      deliveries: [
        { channel: 'IN_APP', status: 'SIMULATED_SENT' },
        { channel: 'GMAIL', status: 'SIMULATED_SENT' },
      ],
    });
  });

  it('keeps in-app delivery successful when the creator email is missing', () => {
    const updated = recordPaymentListReturnNotification(
      returnItem(),
      { account: 'media@example.test', name: '项目媒介' },
      '请补充付款信息。',
      '',
    );

    expect(updated.notifications?.[0]?.deliveries).toEqual([
      expect.objectContaining({ channel: 'IN_APP', status: 'SIMULATED_SENT' }),
      expect.objectContaining({ channel: 'GMAIL', status: 'SKIPPED_MISSING_RECIPIENT' }),
    ]);
  });

  it('allows repeated reminders without replacing the previous history', () => {
    const first = recordPaymentListReturnNotification(
      returnItem(),
      { account: 'media@example.test', name: '项目媒介' },
      '第一次提醒',
      'creator@example.test',
    );
    const second = recordPaymentListReturnNotification(
      first,
      { account: 'media@example.test', name: '项目媒介' },
      '第二次提醒',
      'creator@example.test',
    );

    expect(second.notifications?.map((notification) => notification.message)).toEqual([
      '第一次提醒',
      '第二次提醒',
    ]);
  });

  it('rejects invoice-content returns and invalid messages', () => {
    expect(() => recordPaymentListReturnNotification(
      returnItem('INVOICE_CONTENT'),
      { account: 'media@example.test', name: '项目媒介' },
      '请修改 Invoice。',
      'creator@example.test',
    )).toThrow('只有付款清单退回明细可以通知达人');
    expect(() => recordPaymentListReturnNotification(
      returnItem(),
      { account: 'media@example.test', name: '项目媒介' },
      '  ',
      'creator@example.test',
    )).toThrow('通知内容不能为空');
    expect(() => recordPaymentListReturnNotification(
      returnItem(),
      { account: 'media@example.test', name: '项目媒介' },
      'x'.repeat(301),
      'creator@example.test',
    )).toThrow('通知内容不能超过 300 字');
  });
});
