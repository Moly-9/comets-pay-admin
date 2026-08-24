import type { PaymentNotification, PaymentNotificationDelivery } from './types';
import type { RequestApprovalReturnItem } from './businessWorkflow';
import { emailDisplayValue } from './accountPresentation';

export type PaymentNotificationActor = {
  account: string;
  name: string;
};

const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

export const createPaymentNotification = (
  actor: PaymentNotificationActor,
  message: string,
  email: string,
  occurredAt = new Date().toISOString(),
): PaymentNotification => {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) throw new Error('通知内容不能为空。');
  if (normalizedMessage.length > 300) throw new Error('通知内容不能超过 300 字。');

  const deliveries: PaymentNotificationDelivery[] = [
    {
      channel: 'IN_APP',
      status: 'SIMULATED_SENT',
      recipientLabel: '达人站内信',
    },
    {
      channel: 'GMAIL',
      status: validEmail(email) ? 'SIMULATED_SENT' : 'SKIPPED_MISSING_RECIPIENT',
      recipientLabel: emailDisplayValue(email),
    },
  ];

  return {
    message: normalizedMessage,
    actorAccount: actor.account,
    actorName: actor.name,
    occurredAt,
    deliveries,
  };
};

export const recordPaymentListReturnNotification = (
  returnItem: RequestApprovalReturnItem,
  actor: PaymentNotificationActor,
  message: string,
  email: string,
  occurredAt = new Date().toISOString(),
): RequestApprovalReturnItem => {
  if (returnItem.issueType !== 'PAYMENT_LIST') {
    throw new Error('只有付款清单退回明细可以通知达人。');
  }
  const notification = createPaymentNotification(actor, message, email, occurredAt);
  return {
    ...returnItem,
    notifications: [...(returnItem.notifications ?? []), notification],
  };
};
