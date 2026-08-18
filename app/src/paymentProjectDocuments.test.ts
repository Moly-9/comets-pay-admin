import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { ContractRecord } from './contracts';
import type { PaymentBatchItemSnapshot, PaymentBatchRequestSnapshot } from './paymentBatches';
import {
  createPaymentProjectContractArchive,
  createPaymentProjectInvoiceArchive,
  createPaymentProjectWorkbook,
  paymentProjectWorkbookFilename,
  resolvePaymentProjectDocuments,
} from './paymentProjectDocuments';
import type { GeneratedInvoiceRecord } from './types';

const request = {
  paymentRequestProjectId: 'request_project_documents',
  requestCode: 'REQ-202608-000019',
  requestStatus: '已付款',
  lifecycle: 'COMPLETED',
  amount: 'USD 1,250',
  reason: '达人内容合作费用',
  expectedPaymentDate: '2026-08-18',
  cooperationProjectId: 'project_documents',
  cooperationProjectCode: 'PRJ-202608-000019',
  cooperationProjectName: 'COMETS 文档导出项目',
  brand: 'COMETS',
  media: '张晓晓',
  pm: '陈晨',
} as PaymentBatchRequestSnapshot;

const item = {
  payoutId: 'payout_documents',
  creatorId: 'creator_documents',
  creatorName: 'Mina Kato',
  creatorHandle: '@minakato',
  deliverable: 'Instagram Reels',
  paymentListId: 'payment_list_documents' as NonNullable<PaymentBatchItemSnapshot['paymentListId']>,
  paymentListCode: 'PAY-202608-000019',
  paymentListStatus: 'paid',
  paymentListVersion: 2,
  contracts: [{
    contractId: 'contract_documents' as PaymentBatchItemSnapshot['contracts'][number]['contractId'],
    contractCode: 'CON-202608-000019',
    name: 'COMETS 内容合作合同',
    currency: 'USD',
    amount: 1250,
    status: '已生效',
    signed: true,
    updatedAt: '2026-08-17',
  }],
  invoice: {
    invoiceId: 'invoice_documents' as NonNullable<PaymentBatchItemSnapshot['invoice']>['invoiceId'],
    invoiceNumber: 'INV-202608-000019',
    invoiceDate: '2026-08-17',
    currency: 'USD',
    amount: 1250,
    version: 2,
    reviewStatus: '已通过',
    validationStatus: 'valid',
  },
  provider: 'Airwallex',
  amount: 1250,
  currency: 'USD',
  receiveCurrency: 'USD',
  transferMethod: '本地转账',
  accountSummary: '•••• 2401',
  payoutAccountVersion: 'v2',
  feeBearer: '广告主承担',
  paymentReason: '达人内容合作费用',
  transactionReference: 'COMETS-MINA-0818',
  description: 'Instagram Reels 内容合作',
  paymentStatus: '已付款',
  paidAt: '2026-08-18T12:00',
  associationIssues: [],
} satisfies PaymentBatchItemSnapshot;

const contract = {
  contractId: 'contract_documents',
  id: 'CON-202608-000019',
  name: 'COMETS 内容合作合同',
} as unknown as ContractRecord;

const invoice = {
  invoiceId: 'invoice_documents',
  id: 'INV-202608-000019',
  snapshot: {
    invoiceNumber: 'INV-202608-000019',
    creatorName: 'Mina Kato',
    projectName: 'COMETS 文档导出项目',
    payment: { accountName: 'Mina Kato' },
  },
} as unknown as GeneratedInvoiceRecord;

describe('payment project documents', () => {
  it('resolves stable contract and Invoice records without duplicating them', () => {
    const resolved = resolvePaymentProjectDocuments({
      items: [item, { ...item, payoutId: 'payout_documents_2' }],
      contracts: [contract],
      invoices: [invoice],
    });

    expect(resolved.contracts).toEqual([contract]);
    expect(resolved.invoices).toEqual([invoice]);
  });

  it('creates separate contract and Invoice archives', async () => {
    const contractArchiveBlob = await createPaymentProjectContractArchive({
      items: [item],
      contracts: [contract],
      contractPdf: async () => new Blob(['CONTRACT PDF'], { type: 'application/pdf' }),
    });
    const invoiceArchiveBlob = await createPaymentProjectInvoiceArchive({
      items: [item],
      invoices: [invoice],
      invoicePdf: async () => new Blob(['INVOICE PDF'], { type: 'application/pdf' }),
    });
    const contractArchive = await JSZip.loadAsync(await contractArchiveBlob.arrayBuffer());
    const invoiceArchive = await JSZip.loadAsync(await invoiceArchiveBlob.arrayBuffer());

    expect(Object.keys(contractArchive.files)).toHaveLength(1);
    expect(Object.keys(contractArchive.files)[0]).toMatch(/\.pdf$/);
    expect(Object.keys(invoiceArchive.files)).toHaveLength(1);
    expect(Object.keys(invoiceArchive.files)[0]).toMatch(/\.pdf$/);
  });

  it('writes every payment item to a single Excel worksheet', async () => {
    const workbookBlob = await createPaymentProjectWorkbook({ request, items: [item] });
    const { Workbook } = await import('exceljs');
    const workbook = new Workbook();
    await workbook.xlsx.load(await workbookBlob.arrayBuffer());
    const sheet = workbook.getWorksheet('付款表');

    expect(sheet?.rowCount).toBe(2);
    expect(sheet?.getCell('B2').value).toBe('REQ-202608-000019');
    expect(sheet?.getCell('D2').value).toBe('Mina Kato');
    expect(sheet?.getCell('G2').value).toBe('INV-202608-000019');
    expect(sheet?.getCell('L2').value).toBe(1250);
  });

  it('uses stable project filenames', () => {
    expect(paymentProjectWorkbookFilename('REQ-202608-000019')).toBe('REQ-202608-000019-付款表.xlsx');
  });
});
