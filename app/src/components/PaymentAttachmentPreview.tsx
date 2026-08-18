import { Download, FileText, LoaderCircle, ReceiptText } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ContractRecord } from '../contracts';
import { contractDocumentFilename } from '../documentFilenames';
import { downloadBlob, invoiceFilename } from '../invoice/invoiceUtils';
import {
  paymentProjectContractPdfBlob,
  paymentProjectInvoicePdfBlob,
} from '../paymentProjectDocuments';
import type { GeneratedInvoiceRecord } from '../types';
import { Button, Modal } from './Common';

export type PaymentAttachmentPreviewTarget =
  | { kind: 'contract'; contract: ContractRecord }
  | { kind: 'invoice'; invoice: GeneratedInvoiceRecord };

const targetLabel = (target: PaymentAttachmentPreviewTarget) => (
  target.kind === 'contract' ? target.contract.id : target.invoice.id
);

const targetFilename = (target: PaymentAttachmentPreviewTarget) => (
  target.kind === 'contract'
    ? contractDocumentFilename(target.contract)
    : invoiceFilename(target.invoice.snapshot, 'pdf')
);

const targetPdf = (target: PaymentAttachmentPreviewTarget) => (
  target.kind === 'contract'
    ? paymentProjectContractPdfBlob(target.contract)
    : paymentProjectInvoicePdfBlob(target.invoice)
);

export function PaymentAttachmentPreview({
  target,
  onClose,
}: {
  target: PaymentAttachmentPreviewTarget;
  onClose: () => void;
}) {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setPdfBlob(null);
    setPreviewUrl('');
    setError('');
    targetPdf(target)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfBlob(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : '附件加载失败，请稍后重试。');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [target]);

  const label = targetLabel(target);
  const isContract = target.kind === 'contract';
  return (
    <Modal
      title={`${isContract ? '合同' : 'Invoice'}附件 · ${label}`}
      width="960px"
      className="payment-attachment-preview-modal"
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>关闭</Button>
          <Button
            icon={<Download size={16} />}
            disabled={!pdfBlob}
            onClick={() => pdfBlob && downloadBlob(pdfBlob, targetFilename(target))}
          >
            下载附件
          </Button>
        </>
      )}
    >
      <div className="payment-attachment-preview-meta">
        <span aria-hidden="true">{isContract ? <FileText size={18} /> : <ReceiptText size={18} />}</span>
        <div><strong>{label}</strong><small>{targetFilename(target)}</small></div>
      </div>
      {!previewUrl && !error ? (
        <div className="payment-attachment-preview-state" role="status">
          <LoaderCircle className="is-spinning" size={24} aria-hidden="true" />
          <strong>正在加载附件</strong>
          <span>正在生成可预览的 PDF 文件。</span>
        </div>
      ) : null}
      {error ? (
        <div className="payment-attachment-preview-state is-error" role="alert">
          <FileText size={24} aria-hidden="true" />
          <strong>附件无法打开</strong>
          <span>{error}</span>
        </div>
      ) : null}
      {previewUrl ? (
        <iframe
          className="payment-attachment-preview-frame"
          src={`${previewUrl}#toolbar=1&navpanes=0&view=FitH`}
          title={`${isContract ? '合同' : 'Invoice'}附件 ${label}`}
        />
      ) : null}
    </Modal>
  );
}
