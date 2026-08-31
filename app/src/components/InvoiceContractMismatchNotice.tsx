import { CircleAlert } from 'lucide-react';

export type InvoiceContractMismatchNoticeItem = {
  invoiceNumber?: string;
  reason: string;
  meta?: string;
};

export function InvoiceContractMismatchNotice({
  items,
  className = '',
}: {
  items: InvoiceContractMismatchNoticeItem[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <section
      className={`invoice-contract-mismatch-notices ${className}`.trim()}
      aria-label="合同差异说明"
    >
      {items.map((item, index) => (
        <article
          className="invoice-contract-mismatch-notice"
          role="note"
          key={`${item.invoiceNumber ?? 'invoice'}:${index}:${item.reason}`}
        >
          <CircleAlert size={16} aria-hidden="true" />
          <span>
            <header>
              <strong>合同差异说明</strong>
              {item.invoiceNumber ? <em title={item.invoiceNumber}>{item.invoiceNumber}</em> : null}
            </header>
            <p>{item.reason}</p>
            {item.meta ? <small>{item.meta}</small> : null}
          </span>
        </article>
      ))}
    </section>
  );
}
