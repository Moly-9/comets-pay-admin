import { describe, expect, it } from 'vitest';
import {
  createInvoiceNotificationDeliveries,
  invoiceNotificationEmailDisplayValue,
  invoiceNotificationEmailIsValid,
} from './invoiceNotification';

describe('invoiceNotification', () => {
  it('creates two simulated channels and masks a valid creator email', () => {
    expect(invoiceNotificationEmailIsValid('creator@example.test')).toBe(true);
    expect(invoiceNotificationEmailDisplayValue('creator@example.test')).toBe('cr***or@example.test');
    expect(createInvoiceNotificationDeliveries('creator@example.test')).toEqual([
      {
        channel: 'IN_APP',
        status: 'SIMULATED_SENT',
        recipientLabel: '达人端 Invoice 消息中心',
      },
      {
        channel: 'EMAIL',
        status: 'SIMULATED_SENT',
        recipientLabel: 'cr***or@example.test',
      },
    ]);
  });

  it('keeps the in-app notification and skips only email when the profile email is invalid', () => {
    expect(invoiceNotificationEmailIsValid('missing-email')).toBe(false);
    expect(createInvoiceNotificationDeliveries('missing-email')).toEqual([
      {
        channel: 'IN_APP',
        status: 'SIMULATED_SENT',
        recipientLabel: '达人端 Invoice 消息中心',
      },
      {
        channel: 'EMAIL',
        status: 'SKIPPED_MISSING_RECIPIENT',
        recipientLabel: '达人档案邮箱待补充',
      },
    ]);
  });
});
