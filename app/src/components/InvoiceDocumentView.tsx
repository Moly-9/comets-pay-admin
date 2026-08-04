import { formatInvoiceDate, formatInvoiceMoney, invoiceTotal } from '../invoice/invoiceUtils';
import type { InvoiceDocumentModel } from '../types';

export function InvoiceDocumentView({
  model,
  ariaLabel = 'Invoice 全文',
}: {
  model: InvoiceDocumentModel;
  ariaLabel?: string;
}) {
  const paymentLines = model.paymentMethod === 'bank'
    ? [
      ['Real Name', model.from.legalName],
      ['Account Name', model.payment.accountName],
      ['Account Number', model.payment.accountNumber],
      ['Beneficiary Bank Name', model.payment.bankName],
      ['Beneficiary Bank Address', [
        model.payment.bankStreetAddress,
        model.payment.bankCity,
        model.payment.bankState,
        model.payment.bankPostalCode,
        model.payment.bankCountry,
      ].filter(Boolean).join(', ')],
      ['Swift Code', model.payment.swiftCode],
      ['IBAN (optional)', model.payment.iban || '-'],
    ]
    : [
      ['Paypal Name', model.payment.paypalUsername],
      ['Paypal Email', model.payment.paypalEmail],
    ];

  return (
    <article className="invoice-paper" aria-label={ariaLabel}>
      <h2>INVOICE</h2>
      <p className="invoice-paper-number">Invoice No. {model.invoiceNumber}</p>
      <section className="invoice-paper-bill-to">
        <strong>Bill to</strong>
        <b>{model.billTo.name || '—'}</b>
        <span>{model.billTo.address || '—'}</span>
      </section>
      <div className="invoice-paper-meta">
        <section>
          <strong>From</strong>
          <p><b>Real Name:</b> {model.from.legalName || '—'}</p>
          <p><b>Address:</b> {model.from.address || '—'}</p>
          <p><b>Tel:</b> {model.from.phone || '—'}</p>
          <p><b>Email:</b> {model.from.email || '—'}</p>
        </section>
        <section>
          <strong>Invoice</strong>
          <p><b>Date of Invoice:</b> {formatInvoiceDate(model.invoiceDate) || '—'}</p>
          <p><b>Currency:</b> [{model.currency}]</p>
        </section>
      </div>
      <div className="invoice-paper-table-wrap">
        <table>
          <thead><tr><th>DESCRIPTION</th><th>PRICE</th><th>AMOUNT</th><th>TOTAL</th></tr></thead>
          <tbody>
            {model.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description || '—'}</td>
                <td>{formatInvoiceMoney(model.currency, item.unitPrice)}</td>
                <td>{item.quantity}</td>
                <td>{formatInvoiceMoney(model.currency, item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="invoice-paper-total">
        <span>TOTAL PRICE</span>
        <strong>{formatInvoiceMoney(model.currency, invoiceTotal(model))}</strong>
      </div>
      <section className="invoice-paper-payment">
        <strong>Payment information (choose one)</strong>
        <b>{model.paymentMethod === 'bank' ? 'Paid by Bank' : 'Paid by Paypal'}</b>
        {paymentLines.map(([label, value]) => <p key={label}><b>{label}:</b> {value || '—'}</p>)}
      </section>
      <section className="invoice-paper-signature"><strong>Signature:</strong><span /></section>
    </article>
  );
}
