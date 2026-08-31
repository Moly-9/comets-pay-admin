import type { InvoiceNotificationDelivery } from '../types';

export const invoiceNotificationEmailIsValid = (value?: string | null) => {
  const [localPart, domain] = String(value ?? '').trim().split('@');
  return Boolean(localPart && domain?.includes('.'));
};

export const invoiceNotificationEmailDisplayValue = (email?: string | null) => {
  if (!invoiceNotificationEmailIsValid(email)) return '达人档案邮箱待补充';
  const [localPart, domain] = String(email).trim().split('@');
  const maskedLocalPart = localPart.length <= 2
    ? `${localPart.slice(0, 1)}***`
    : localPart.length <= 4
      ? `${localPart.slice(0, 1)}***${localPart.slice(-1)}`
      : `${localPart.slice(0, 2)}***${localPart.slice(-2)}`;
  return `${maskedLocalPart}@${domain}`;
};

export const createInvoiceNotificationDeliveries = (
  email?: string | null,
): InvoiceNotificationDelivery[] => {
  const hasValidEmail = invoiceNotificationEmailIsValid(email);
  return [
    {
      channel: 'IN_APP',
      status: 'SIMULATED_SENT',
      recipientLabel: '达人端 Invoice 消息中心',
    },
    {
      channel: 'EMAIL',
      status: hasValidEmail ? 'SIMULATED_SENT' : 'SKIPPED_MISSING_RECIPIENT',
      recipientLabel: hasValidEmail
        ? invoiceNotificationEmailDisplayValue(email)
        : '达人档案邮箱待补充',
    },
  ];
};
