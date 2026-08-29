import { Info, Mail, MessageSquareText, Send } from 'lucide-react';
import {
  invoiceNotificationEmailDisplayValue,
  invoiceNotificationEmailIsValid,
} from '../invoice/invoiceNotification';

export type InvoiceDeliveryNoticePurpose = 'feedback' | 'signature' | 'return';

const PURPOSE_COPY: Record<InvoiceDeliveryNoticePurpose, {
  ariaLabel: string;
  title: string;
  subtitle: string;
  inAppDescription: string;
  prototypeRecord: string;
}> = {
  feedback: {
    ariaLabel: '回复发送渠道说明',
    title: '回复发送渠道',
    subtitle: '提交后将通过两个渠道同步触达达人',
    inAppDescription: '发送至达人端的 Invoice 消息中心',
    prototypeRecord: '回复记录',
  },
  signature: {
    ariaLabel: '签署提醒发送渠道说明',
    title: '通知发送渠道',
    subtitle: '发送后将通过两个渠道同步提醒达人签署',
    inAppDescription: '发送至达人端 Invoice 消息中心，并引导进入签署',
    prototypeRecord: '通知记录',
  },
  return: {
    ariaLabel: '退回通知渠道说明',
    title: '退回通知渠道',
    subtitle: '退回后将通过两个渠道同步通知达人',
    inAppDescription: '发送至达人端 Invoice 消息中心',
    prototypeRecord: '退回通知记录',
  },
};

export function InvoiceDeliveryNotice({
  email,
  purpose,
}: {
  email?: string | null;
  purpose: InvoiceDeliveryNoticePurpose;
}) {
  const copy = PURPOSE_COPY[purpose];
  const hasEmail = invoiceNotificationEmailIsValid(email);
  return (
    <div
      className="invoice-feedback-delivery"
      role="note"
      aria-label={copy.ariaLabel}
    >
      <div className="invoice-feedback-delivery-title">
        <Send size={16} />
        <span>
          <strong>{copy.title}</strong>
          <small>{copy.subtitle}</small>
        </span>
      </div>
      <ul>
        <li>
          <MessageSquareText size={16} />
          <span>
            <strong>达人端站内信</strong>
            <small>{copy.inAppDescription}</small>
          </span>
        </li>
        <li>
          <Mail size={16} />
          <span>
            <strong>邮件（站外信）</strong>
            <small>{hasEmail ? `发送至达人档案邮箱：${invoiceNotificationEmailDisplayValue(email)}` : '未发送 · 达人档案邮箱待补充'}</small>
          </span>
        </li>
      </ul>
      <p>
        <Info size={15} />
        <span>
          <strong>原型说明：</strong>
          当前仅模拟发送并保留{copy.prototypeRecord}，不会真实触发站内信或邮件。正式接入后需分别记录双渠道发送状态、失败原因和重试结果，并保留操作审计；真实发送与状态持久化待后端接入。
        </span>
      </p>
    </div>
  );
}

export function InvoiceFeedbackDeliveryNotice({ email }: { email?: string | null }) {
  return <InvoiceDeliveryNotice email={email} purpose="feedback" />;
}

export function InvoiceSignatureReminderDeliveryNotice({ email }: { email?: string | null }) {
  return <InvoiceDeliveryNotice email={email} purpose="signature" />;
}
