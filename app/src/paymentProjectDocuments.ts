import type { ContractRecord } from './contracts';
import { accountDisplayValue } from './accountPresentation';
import { contractDocumentFilename } from './documentFilenames';
import { invoiceFilename } from './invoice/invoiceUtils';
import { paymentProviderDisplayName } from './paymentProviderPresentation';
import { paymentSingleAmountLabel, paymentSingleAmountTotalsForValues } from './paymentAttempts';
import { formatCreatorHandle } from './creatorSearchOptions';
import { createFlatProjectPdfArchive } from './projectResourcePdfArchive';
import { createGenericPaymentConfirmationPdf } from './paymentProjectConfirmation';
import type {
  PaymentBatchItemSnapshot,
  PaymentBatchRequestSnapshot,
} from './paymentBatches';
import type { GeneratedInvoiceRecord } from './types';

const PAYMENT_PROJECT_WORKBOOK_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PAYMENT_CONFIRMATION_ASSET_PATH = '/export-assets/airwallex/airwallex付款单-支付确认函.pdf';

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
    { header: '付款单', key: 'paymentOrderCode', width: 22 },
    { header: '付款编号', key: 'paymentCode', width: 22 },
    { header: '达人', key: 'creatorName', width: 22 },
    { header: '达人账号', key: 'creatorHandle', width: 22 },
    { header: '合同', key: 'contracts', width: 34 },
    { header: 'Invoice', key: 'invoice', width: 26 },
    { header: '付款渠道', key: 'provider', width: 16 },
    { header: '付款方式', key: 'transferMethod', width: 18 },
    { header: '支付币种', key: 'currency', width: 14 },
    { header: '收款币种', key: 'receiveCurrency', width: 14 },
    { header: '请款金额', key: 'amount', width: 18 },
    { header: '收款账户', key: 'accountSummary', width: 22 },
    { header: '费用承担', key: 'feeBearer', width: 18 },
    { header: '付款原因', key: 'paymentReason', width: 28 },
    { header: '交易附言', key: 'transactionReference', width: 28 },
    { header: '描述', key: 'description', width: 32 },
    { header: '付款状态', key: 'paymentStatus', width: 16 },
    { header: '付款时间', key: 'paidAt', width: 22 },
  ];
  sheet.autoFilter = { from: 'A1', to: 'T1' };
  sheet.getRow(1).height = 34;
  sheet.getRow(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4D5664' } };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  items.forEach((item, index) => {
    const row = sheet.addRow({
      sequence: index + 1,
      requestCode: request.requestCode,
      paymentOrderCode: item.paymentOrderCode || item.paymentListCode,
      paymentCode: item.paymentCode || '付款编号待补全',
      creatorName: item.creatorName,
      creatorHandle: formatCreatorHandle(item.creatorHandle, item.creatorPlatform),
      contracts: item.contracts.map((contract) => contract.contractCode).join('、') || item.legacyContractReference || '未关联',
      invoice: item.invoice?.invoiceNumber || item.legacyInvoiceReference || '未关联',
      provider: paymentProviderDisplayName(item.provider),
      transferMethod: item.transferMethod,
      currency: item.currency,
      receiveCurrency: item.receiveCurrency,
      amount: item.amount,
      accountSummary: accountDisplayValue(item.accountSummary),
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

const paymentDateKey = (value?: string) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}${match[2]}${match[3]}` : '';
};

const workbookDateLabel = (value?: string) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '—';
};

const workbookMoney = (amount?: number, currency?: string) => (
  amount !== undefined && currency ? `${currency} ${amount.toLocaleString('en-US')}` : '—'
);

export type PaymentProjectDetailWorkbookRecord = Readonly<{
  recordKind: 'PAYMENT' | 'RETURN';
  item: PaymentBatchItemSnapshot;
  refundAmount?: number;
  refundCurrency?: string;
  refundedAt?: string;
}>;

export const createPaymentProjectDetailWorkbook = async ({
  request,
  items: sourceItems,
}: {
  request: PaymentBatchRequestSnapshot;
  items: readonly (PaymentBatchItemSnapshot | PaymentProjectDetailWorkbookRecord)[];
}) => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'COMETS Pay';
  workbook.created = new Date();
  workbook.subject = `${request.requestCode} 付款明细`;
  const sheet = workbook.addWorksheet('付款明细', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: '付款渠道', key: 'provider', width: 18 },
    { header: '付款方式', key: 'method', width: 18 },
    { header: '付款至', key: 'country', width: 22 },
    { header: '账户名', key: 'accountName', width: 28 },
    { header: '付款日期', key: 'paidAt', width: 16 },
    { header: '请款金额', key: 'requestAmount', width: 18 },
    { header: '单笔支付金额', key: 'singlePaymentAmount', width: 22 },
    { header: '手续费', key: 'feeAmount', width: 18 },
    { header: '退款金额', key: 'refundAmount', width: 18 },
    { header: '付款状态', key: 'status', width: 16 },
    { header: '余额', key: 'balance', width: 22 },
  ];
  sheet.autoFilter = { from: 'A1', to: 'K1' };
  sheet.getRow(1).height = 34;
  sheet.getRow(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4D5664' } };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  sourceItems.forEach((source, index) => {
    const record = 'item' in source ? source : { recordKind: 'PAYMENT' as const, item: source };
    const item = record.item;
    const isReturn = record.recordKind === 'RETURN';
    const paid = item.paymentStatus === '已付款';
    const refundAmount = 'refundAmount' in record ? record.refundAmount : undefined;
    const refundCurrency = 'refundCurrency' in record ? record.refundCurrency : undefined;
    const refundedAt = 'refundedAt' in record ? record.refundedAt : undefined;
    const row = sheet.addRow({
      provider: paymentProviderDisplayName(item.provider),
      method: item.localClearingSystem || item.transferMethod || '待补充',
      country: item.recipientCountry || '待补充',
      accountName: item.accountName || '待补充',
      paidAt: isReturn ? workbookDateLabel(refundedAt) : workbookDateLabel(item.paymentSubmittedAt),
      requestAmount: isReturn ? '—' : workbookMoney(item.amount, item.currency),
      singlePaymentAmount: isReturn
        ? workbookMoney(0, refundCurrency || item.currency)
        : item.paymentStatus === '付款处理中'
          ? '待渠道回写'
          : paymentSingleAmountLabel(paymentSingleAmountTotalsForValues({
              principalAmount: item.amount,
              principalCurrency: item.currency,
              feeBearer: item.feeBearer,
              transferFeeAmount: item.transferFeeAmount,
              transferFeeCurrency: item.transferFeeCurrency,
            })),
      feeAmount: isReturn ? '—' : workbookMoney(item.transferFeeAmount, item.transferFeeCurrency),
      refundAmount: isReturn
        ? refundAmount !== undefined && refundCurrency ? workbookMoney(Math.abs(refundAmount), refundCurrency) : '待渠道回写'
        : '—',
      status: isReturn ? refundAmount !== undefined && refundCurrency ? '已退回' : '退回处理中' : item.paymentStatus,
      balance: paid && !isReturn
        ? workbookMoney(item.postTransactionBalance, item.postTransactionBalanceCurrency)
        : '—',
    });
    row.height = 26;
    row.font = { name: 'Arial', size: 10 };
    row.alignment = { vertical: 'middle', wrapText: true };
    if (index % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FA' } };
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer as ArrayBuffer)], { type: PAYMENT_PROJECT_WORKBOOK_MIME });
};

export const paymentProjectDetailWorkbookFilename = (requestCode: string) => (
  `${safeFileSegment(requestCode, '付款项目')}-付款明细.xlsx`
);

type ConfirmationAssetLoader = (path: string) => Promise<Blob>;

const loadConfirmationAsset: ConfirmationAssetLoader = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`付款确认函模板读取失败：${response.status}`);
  return response.blob();
};

const confirmationAmountSegment = (amount: number) => (
  Number.isInteger(amount) ? String(amount) : String(amount).replace(/0+$/, '').replace(/\.$/, '')
);

export const createPaymentItemConfirmationPdf = async ({
  item,
  loadAsset = loadConfirmationAsset,
  genericPdf = createGenericPaymentConfirmationPdf,
}: {
  item: PaymentBatchItemSnapshot;
  loadAsset?: ConfirmationAssetLoader;
  genericPdf?: (item: PaymentBatchItemSnapshot) => Promise<Blob>;
}) => {
  if (item.paymentStatus !== '已付款' || !paymentDateKey(item.paymentSubmittedAt)) {
    throw new Error('仅具备付款日期的已付款明细可以下载确认函。');
  }
  return item.provider === 'Airwallex'
    ? loadAsset(PAYMENT_CONFIRMATION_ASSET_PATH)
    : genericPdf(item);
};

export const paymentItemConfirmationFilename = (item: PaymentBatchItemSnapshot) => {
  const paymentOrderCode = item.paymentOrderCode || item.paymentListCode || '付款单';
  const invoiceNumber = item.invoice?.invoiceNumber || item.legacyInvoiceReference || item.payoutId;
  return `${safeFileSegment(paymentOrderCode, '付款单')}-${safeFileSegment(invoiceNumber, '付款明细')}-付款确认函.pdf`;
};

export const createPaymentProjectConfirmationArchive = async ({
  items,
  loadAsset = loadConfirmationAsset,
  genericPdf = createGenericPaymentConfirmationPdf,
}: {
  items: readonly PaymentBatchItemSnapshot[];
  loadAsset?: ConfirmationAssetLoader;
  genericPdf?: (item: PaymentBatchItemSnapshot) => Promise<Blob>;
}) => {
  const eligibleItems = items.filter((item) => (
    item.paymentStatus === '已付款' && paymentDateKey(item.paymentSubmittedAt)
  ));
  if (!eligibleItems.length) throw new Error('当前没有具备付款日期的已付款明细。');
  const [{ default: JSZip }, airwallexTemplate] = await Promise.all([
    import('jszip'),
    eligibleItems.some((item) => item.provider === 'Airwallex')
      ? loadAsset(PAYMENT_CONFIRMATION_ASSET_PATH)
      : Promise.resolve(null),
  ]);
  const zip = new JSZip();
  const filenameCounts = new Map<string, number>();
  for (const item of eligibleItems) {
    const date = paymentDateKey(item.paymentSubmittedAt);
    const folderName = `${date}-${safeFileSegment(paymentProviderDisplayName(item.provider), '付款渠道')}-确认函`;
    const accountName = safeFileSegment(item.accountName || item.creatorName, '收款方账户');
    const baseFilename = `${date}${accountName}-${confirmationAmountSegment(item.amount)} ${item.currency}`;
    const collisionKey = `${folderName}/${baseFilename}`;
    const count = (filenameCounts.get(collisionKey) ?? 0) + 1;
    filenameCounts.set(collisionKey, count);
    const filename = `${baseFilename}${count > 1 ? `-${String(count).padStart(2, '0')}` : ''}.pdf`;
    const pdfBlob = item.provider === 'Airwallex'
      ? airwallexTemplate!
      : await genericPdf(item);
    zip.folder(folderName)?.file(filename, new Uint8Array(await pdfBlob.arrayBuffer()));
  }
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
};

export const paymentProjectConfirmationArchiveFilename = (requestCode: string) => (
  `${safeFileSegment(requestCode, '付款项目')}-付款确认函.zip`
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
