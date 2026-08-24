import type { ContractRecord } from './contracts';
import { contractDocumentFilename } from './documentFilenames';
import { invoiceFilename } from './invoice/invoiceUtils';
import { paymentProviderDisplayName } from './paymentProviderPresentation';
import { createFlatProjectPdfArchive } from './projectResourcePdfArchive';
import type {
  PaymentBatchItemSnapshot,
  PaymentBatchRequestSnapshot,
} from './paymentBatches';
import type { GeneratedInvoiceRecord } from './types';

const PAYMENT_PROJECT_WORKBOOK_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const safeFileSegment = (value: string, fallback: string) => (
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || fallback
);

const stableContractId = (contract: ContractRecord) => String(contract.contractId ?? contract.id);

const uniqueBy = <T,>(values: readonly T[], keyFor: (value: T) => string) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = keyFor(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const paymentProjectContractPdfBlob = async (contract: ContractRecord) => {
  if (contract.generationSnapshot) {
    const { generateContractPdf } = await import('./contractGeneration');
    return generateContractPdf(
      contract.generationSnapshot,
      undefined,
      undefined,
      contract.generationVariant ?? 'FORMAL',
    );
  }
  const sourceDocument = contract.sourceDocuments?.find((document) => (
    document.mimeType === 'application/pdf' || /\.pdf$/i.test(document.fileName)
  ));
  const documentUrl = sourceDocument?.documentUrl || contract.documentUrl;
  if (!documentUrl) throw new Error(`${contract.id} 缺少可查看的 PDF 附件`);
  const response = await fetch(documentUrl);
  if (!response.ok) throw new Error(`${contract.id} PDF 附件读取失败`);
  return response.blob();
};

export const paymentProjectInvoicePdfBlob = async (invoice: GeneratedInvoiceRecord) => {
  const { generateInvoicePdf } = await import('./invoice/generateInvoice');
  return generateInvoicePdf(invoice.snapshot);
};

export const resolvePaymentProjectDocuments = ({
  items,
  contracts,
  invoices,
}: {
  items: readonly PaymentBatchItemSnapshot[];
  contracts: readonly ContractRecord[];
  invoices: readonly GeneratedInvoiceRecord[];
}) => {
  const contractIds = new Set(items.flatMap((item) => (
    item.contracts.map((contract) => String(contract.contractId))
  )));
  const contractCodes = new Set(items.flatMap((item) => (
    item.contracts.map((contract) => contract.contractCode)
  )));
  const invoiceIds = new Set(items.flatMap((item) => (
    item.invoice ? [String(item.invoice.invoiceId)] : []
  )));
  const invoiceNumbers = new Set(items.flatMap((item) => (
    item.invoice ? [item.invoice.invoiceNumber] : []
  )));
  return {
    contracts: uniqueBy(
      contracts.filter((contract) => (
        contractIds.has(stableContractId(contract)) || contractCodes.has(contract.id)
      )),
      stableContractId,
    ),
    invoices: uniqueBy(
      invoices.filter((invoice) => (
        invoiceIds.has(String(invoice.invoiceId)) || invoiceNumbers.has(invoice.id)
      )),
      (invoice) => String(invoice.invoiceId),
    ),
  };
};

export const createPaymentProjectWorkbook = async ({
  request,
  items,
}: {
  request: PaymentBatchRequestSnapshot;
  items: readonly PaymentBatchItemSnapshot[];
}) => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'COMETS Pay';
  workbook.created = new Date();
  workbook.subject = `${request.requestCode} 付款项目明细`;

  const sheet = workbook.addWorksheet('付款表', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: '序号', key: 'sequence', width: 8 },
    { header: '付款项目编号', key: 'requestCode', width: 24 },
    { header: '付款清单', key: 'paymentListCode', width: 24 },
    { header: '达人', key: 'creatorName', width: 22 },
    { header: '达人账号', key: 'creatorHandle', width: 22 },
    { header: '合同', key: 'contracts', width: 34 },
    { header: 'Invoice', key: 'invoice', width: 26 },
    { header: '付款渠道', key: 'provider', width: 16 },
    { header: '付款方式', key: 'transferMethod', width: 18 },
    { header: '支付币种', key: 'currency', width: 14 },
    { header: '收款币种', key: 'receiveCurrency', width: 14 },
    { header: '付款金额', key: 'amount', width: 18 },
    { header: '收款账户', key: 'accountSummary', width: 22 },
    { header: '费用承担', key: 'feeBearer', width: 18 },
    { header: '付款原因', key: 'paymentReason', width: 28 },
    { header: '交易附言', key: 'transactionReference', width: 28 },
    { header: '描述', key: 'description', width: 32 },
    { header: '付款状态', key: 'paymentStatus', width: 16 },
    { header: '付款时间', key: 'paidAt', width: 22 },
  ];
  sheet.autoFilter = { from: 'A1', to: 'S1' };
  sheet.getRow(1).height = 34;
  sheet.getRow(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4D5664' } };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  items.forEach((item, index) => {
    const row = sheet.addRow({
      sequence: index + 1,
      requestCode: request.requestCode,
      paymentListCode: item.paymentListCode,
      creatorName: item.creatorName,
      creatorHandle: item.creatorHandle,
      contracts: item.contracts.map((contract) => contract.contractCode).join('、') || item.legacyContractReference || '未关联',
      invoice: item.invoice?.invoiceNumber || item.legacyInvoiceReference || '未关联',
      provider: paymentProviderDisplayName(item.provider),
      transferMethod: item.transferMethod,
      currency: item.currency,
      receiveCurrency: item.receiveCurrency,
      amount: item.amount,
      accountSummary: item.accountSummary,
      feeBearer: item.feeBearer,
      paymentReason: item.paymentReason,
      transactionReference: item.transactionReference,
      description: item.description,
      paymentStatus: item.paymentStatus,
      paidAt: item.paidAt?.replace('T', ' ') ?? '未记录',
    });
    row.height = 25;
    row.font = { name: 'Arial', size: 10 };
    row.alignment = { vertical: 'middle', wrapText: true };
    row.getCell('amount').numFmt = '#,##0.00';
    if (index % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FA' } };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer as ArrayBuffer)], { type: PAYMENT_PROJECT_WORKBOOK_MIME });
};

export const paymentProjectWorkbookFilename = (requestCode: string) => (
  `${safeFileSegment(requestCode, '付款项目')}-付款表.xlsx`
);

export const createPaymentProjectContractArchive = async ({
  items,
  contracts,
  contractPdf = paymentProjectContractPdfBlob,
}: {
  items: readonly PaymentBatchItemSnapshot[];
  contracts: readonly ContractRecord[];
  contractPdf?: (contract: ContractRecord) => Promise<Blob>;
}) => {
  const resolved = resolvePaymentProjectDocuments({ items, contracts, invoices: [] });
  const entries = await Promise.all(resolved.contracts.map(async (contract) => ({
    filename: contractDocumentFilename(contract),
    pdfBlob: await contractPdf(contract),
  })));
  return createFlatProjectPdfArchive(entries);
};

export const createPaymentProjectInvoiceArchive = async ({
  items,
  invoices,
  invoicePdf = paymentProjectInvoicePdfBlob,
}: {
  items: readonly PaymentBatchItemSnapshot[];
  invoices: readonly GeneratedInvoiceRecord[];
  invoicePdf?: (invoice: GeneratedInvoiceRecord) => Promise<Blob>;
}) => {
  const resolved = resolvePaymentProjectDocuments({ items, contracts: [], invoices });
  const entries = await Promise.all(resolved.invoices.map(async (invoice) => ({
    filename: invoiceFilename(invoice.snapshot, 'pdf'),
    pdfBlob: await invoicePdf(invoice),
  })));
  return createFlatProjectPdfArchive(entries);
};
