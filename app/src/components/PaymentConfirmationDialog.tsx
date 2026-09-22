import { useEffect } from 'react';
import { ReceiptText, Send } from 'lucide-react';
import { paymentFeeBearerDisplayName } from '../paymentFeeBearerPresentation';
import {
  formatPaymentPreviewMoney,
  paymentPreviewActualPaidTotals,
  type PaymentPreview,
} from '../paymentPreview';
import { Button, Modal } from './Common';
import { PaymentProviderBadge } from './PaymentProviderBadge';
import type { Provider } from '../types';
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
  provider,
}: {
  rows: readonly PaymentConfirmationRow[];
  onClose: () => void;
  onConfirm: () => void;
  provider?: Provider;
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
        <div><strong>请确认每一笔交易信息</strong><p>确认后将提交付款渠道，当前共 {rows.length} 笔。{provider ? <>本次渠道：<PaymentProviderBadge compact provider={provider} /></> : null}</p></div>
      </div>
      <div className="payment-confirmation-table-shell">
        <table className="payment-confirmation-table">
          <caption className="sr-only">本次打款交易明细</caption>
          <colgroup>
            <col className="payment-confirmation-col-index" />
            <col className="payment-confirmation-col-identity" />
            <col className="payment-confirmation-col-account" />
            <col className="payment-confirmation-col-requested" />
            <col className="payment-confirmation-col-fee" />
            <col className="payment-confirmation-col-fee-bearer" />
            <col className="payment-confirmation-col-paid" />
            <col className="payment-confirmation-col-received" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">序号</th>
              <th scope="col">达人 / Invoice</th>
              <th scope="col">收款账户</th>
              <th scope="col">请款金额</th>
              <th scope="col">渠道手续费</th>
              <th scope="col">手续费承担方</th>
              <th scope="col">我方实际支付</th>
              <th scope="col">对方预计到账</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td className="payment-confirmation-index-cell" data-label="序号">
                  <span aria-label={`第 ${index + 1} 笔`}>{String(index + 1).padStart(2, '0')}</span>
                </td>
                <td className="payment-confirmation-identity-cell" data-label="达人 / Invoice">
                  <div>
                    <strong>{row.creatorName}</strong>
                    <small>{row.invoiceNumber}</small>
                  </div>
                </td>
                <td className="payment-confirmation-account-cell" data-label="收款账户" title={row.account}>{row.account}</td>
                <td className="payment-confirmation-money-cell" data-label="请款金额">
                  {formatPaymentPreviewMoney(row.preview.requestedCurrency, row.preview.requestedAmount)}
                </td>
                <td className="payment-confirmation-money-cell" data-label="渠道手续费">
                  {formatPaymentPreviewMoney(row.preview.channelFeeCurrency, row.preview.channelFeeAmount)}
                </td>
                <td data-label="手续费承担方">{paymentFeeBearerDisplayName(row.preview.feeBearer)}</td>
                <td className="payment-confirmation-money-cell" data-label="我方实际支付">
                  {formatPaymentPreviewMoney(row.preview.actualPaidCurrency, row.preview.actualPaidAmount)}
                </td>
                <td className="payment-confirmation-money-cell" data-label="对方预计到账">
                  {formatPaymentPreviewMoney(row.preview.recipientReceivedCurrency, row.preview.recipientReceivedAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
