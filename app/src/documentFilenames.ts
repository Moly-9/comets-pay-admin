import type { ContractRecord } from './contracts';
import type { InvoiceDocumentModel } from './types';

const safeDocumentSegment = (value: string, fallback: string) => (
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || fallback
);

export const contractDocumentFilename = (
  contract: Pick<ContractRecord, 'name' | 'id'>,
  extension: 'pdf' | 'docx' = 'pdf',
) => `${safeDocumentSegment(contract.name, '合同')}-${safeDocumentSegment(contract.id, '未编号')}.${extension}`;

export const invoiceDocumentName = (
  model: Pick<InvoiceDocumentModel, 'payment' | 'creatorName' | 'projectName'>,
) => {
  const accountName = safeDocumentSegment(model.payment.accountName || model.creatorName, '收款账户');
  const projectName = safeDocumentSegment(model.projectName, '关联项目');
  return `${accountName}-${projectName}`;
};

export const invoiceDocumentFilename = (
  model: Pick<InvoiceDocumentModel, 'payment' | 'creatorName' | 'projectName' | 'invoiceNumber'>,
  extension: 'pdf' | 'docx',
) => `${invoiceDocumentName(model)}-${safeDocumentSegment(model.invoiceNumber, '未编号')}.${extension}`;
