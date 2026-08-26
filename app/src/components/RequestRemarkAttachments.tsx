import { FileText, Trash2 } from 'lucide-react';
import type { PaymentRequestRemarkAttachment } from '../paymentRequestProjects';

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export function RequestRemarkAttachments({
  attachments,
  onRemove,
}: {
  attachments: PaymentRequestRemarkAttachment[];
  onRemove?: (attachment: PaymentRequestRemarkAttachment) => void;
}) {
  if (!attachments.length) return null;

  return (
    <div className="request-remark-attachments" aria-label="备注截图">
      {attachments.map((attachment) => (
        <figure key={`${attachment.name}-${attachment.size}-${attachment.lastModified}`}>
          {attachment.dataUrl ? (
            <img src={attachment.dataUrl} alt={attachment.name} />
          ) : (
            <span className="request-remark-file-icon" aria-hidden="true"><FileText size={20} /></span>
          )}
          <figcaption>
            <strong>{attachment.name}</strong>
            <small>{formatSize(attachment.size)}</small>
          </figcaption>
          {onRemove ? (
            <button
              type="button"
              aria-label={`移除截图 ${attachment.name}`}
              title="移除截图"
              onClick={() => onRemove(attachment)}
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
