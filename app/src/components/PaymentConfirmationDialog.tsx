import { useEffect } from 'react';
import { ReceiptText, Send } from 'lucide-react';
import { paymentFeeBearerDisplayName } from '../paymentFeeBearerPresentation';
import {
  formatPaymentPreviewMoney,
  paymentPreviewActualPaidTotals,
  type PaymentPreview,
} from '../paymentPreview';
import { Button, Modal } from './Common';
import './PaymentConfirmationDialog.css';

export type PaymentConfirmationRow = Readonly<{
  id: string;
  creatorName: string;
  invoiceNumber: string;
  account: string;
  preview: PaymentPreview;
}>;

export function PaymentConfirmationDialog({
  rows,
  onClose,
  onConfirm,
}: {
  rows: readonly PaymentConfirmationRow[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  const totals = paymentPreviewActualPaidTotals(rows.map((row) => row.preview));

  useEffect(() => {
    const underlyingDialogs = [...document.querySelectorAll<HTMLElement>('.modal-panel:not(.payment-confirmation-dialog)')];
    const previousInertValues = underlyingDialogs.map((dialog) => dialog.inert);
    underlyingDialogs.forEach((dialog) => { dialog.inert = true; });
    return () => {
      underlyingDialogs.forEach((dialog, index) => {
        dialog.inert = previousInertValues[index];
      });
    };
  }, []);

  return (
    <Modal
      title="确认本次打款"
      width="1180px"
      className="payment-confirmation-dialog"
      onClose={onClose}
      footer={(
        <div className="payment-confirmation-footer">
          <div className="payment-confirmation-totals" aria-label="本次我方实付合计">
            <span>本次我方实付合计</span>
            <strong>{totals.length
              ? totals.map(({ currency, amount }) => formatPaymentPreviewMoney(currency, amount)).join(' · ')
              : '—'}</strong>
          </div>
          <div className="payment-confirmation-actions">
            <Button variant="secondary" onClick={onClose}>取消</Button>
            <Button autoFocus icon={<Send size={16} />} onClick={onConfirm}>确认打款</Button>
          </div>
        </div>
      )}
    >
      <div className="payment-confirmation-intro">
        <ReceiptText size={19} aria-hidden="true" />
        <div><strong>请确认每一笔交易信息</strong><p>确认后将提交付款渠道，当前共 {rows.length} 笔。</p></div>
      </div>
      <div className="payment-confirmation-list" role="list">
        {rows.map((row, index) => (
          <article className="payment-confirmation-card" role="listitem" key={row.id}>
            <header>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{row.creatorName}</strong><small>{row.invoiceNumber}</small></div>
            </header>
            <dl>
              <div><dt>收款账户</dt><dd title={row.account}>{row.account}</dd></div>
              <div><dt>请款金额</dt><dd>{formatPaymentPreviewMoney(row.preview.requestedCurrency, row.preview.requestedAmount)}</dd></div>
              <div><dt>渠道手续费</dt><dd>{formatPaymentPreviewMoney(row.preview.channelFeeCurrency, row.preview.channelFeeAmount)}</dd></div>
              <div><dt>手续费承担方</dt><dd>{paymentFeeBearerDisplayName(row.preview.feeBearer)}</dd></div>
              <div><dt>我方实际支付</dt><dd>{formatPaymentPreviewMoney(row.preview.actualPaidCurrency, row.preview.actualPaidAmount)}</dd></div>
              <div><dt>对方预计到账</dt><dd>{formatPaymentPreviewMoney(row.preview.recipientReceivedCurrency, row.preview.recipientReceivedAmount)}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </Modal>
  );
}
