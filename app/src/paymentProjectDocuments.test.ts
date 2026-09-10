import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { ContractRecord } from './contracts';
import type { PaymentBatchItemSnapshot, PaymentBatchRequestSnapshot } from './paymentBatches';
import {
  createPaymentProjectConfirmationArchive,
  createPaymentItemConfirmationPdf,
  createPaymentProjectContractArchive,
  createPaymentProjectDetailWorkbook,
  createPaymentProjectInvoiceArchive,
  createPaymentProjectWorkbook,
  paymentProjectConfirmationArchiveFilename,
  paymentItemConfirmationFilename,
  paymentProjectDetailWorkbookFilename,
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
  paymentCode: 'PMT-2608180001',
  creatorId: 'creator_documents',
  creatorName: 'Mina Kato',
  creatorHandle: '@minakato',
  deliverable: 'Instagram Reels',
  paymentListId: 'payment_list_documents' as NonNullable<PaymentBatchItemSnapshot['paymentListId']>,
  paymentListCode: 'PAY-2608180019',
  paymentOrderCode: 'PAY-2608180019',
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
  accountSummary: '0000002401',
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
    const workbookBlob = await createPaymentProjectWorkbook({
      request,
      items: [{ ...item, provider: 'PayMax' }],
    });
    const { Workbook } = await import('exceljs');
    const workbook = new Workbook();
    await workbook.xlsx.load(await workbookBlob.arrayBuffer());
    const sheet = workbook.getWorksheet('付款表');

    expect(sheet?.rowCount).toBe(2);
    expect(sheet?.getCell('B2').value).toBe('REQ-202608-000019');
    expect(sheet?.getCell('C2').value).toBe('PAY-2608180019');
    expect(sheet?.getCell('D2').value).toBe('PMT-2608180001');
    expect(sheet?.getCell('E2').value).toBe('Mina Kato');
    expect(sheet?.getCell('H2').value).toBe('INV-202608-000019');
    expect(sheet?.getCell('I2').value).toBe('Payer Max');
    expect(sheet?.getCell('M2').value).toBe(1250);
    expect(sheet?.getCell('N2').value).toBe('0000002401');
  });

  it('exports the nine payment-result fields with the frozen post-transaction balance', async () => {
    const workbookBlob = await createPaymentProjectDetailWorkbook({
      request,
      items: [{
        ...item,
        accountName: 'Mina Kato Account',
        localClearingSystem: 'ACH',
        recipientCountry: 'United States',
        actualPaidAmount: 1258.5,
        actualPaidCurrency: 'USD',
        postTransactionBalance: 48_741.5,
        postTransactionBalanceCurrency: 'USD',
      }],
    });
    const { Workbook } = await import('exceljs');
    const workbook = new Workbook();
    await workbook.xlsx.load(await workbookBlob.arrayBuffer());
    const sheet = workbook.getWorksheet('付款明细');

    expect(sheet?.columnCount).toBe(9);
    expect(sheet?.getRow(1).values).toEqual([
      undefined,
      '付款渠道',
      '付款方式',
      '付款至',
      '账户名',
      '付款日期',
      '付款方支付的金额',
      '付款方支付的币种',
      '状态',
      '余额',
    ]);
    expect(sheet?.getRow(2).values).toEqual([
      undefined,
      'Airwallex',
      'ACH',
      'United States',
      'Mina Kato Account',
      '2026-08-18',
      1258.5,
      'USD',
      '已付款',
      'USD 48,741.5',
    ]);
  });

  it('groups confirmation PDFs by YYYYMMDD and provider with safe, collision-proof names', async () => {
    const airwallexPdf = new Blob(['AIRWALLEX CONFIRMATION'], { type: 'application/pdf' });
    const genericCalls: string[] = [];
    const baseConfirmationItem = {
      ...item,
      accountName: 'Mina Kato',
      paidAt: '2026-08-18T23:59:59-11:00',
    } satisfies PaymentBatchItemSnapshot;
    const archiveBlob = await createPaymentProjectConfirmationArchive({
      items: [
        baseConfirmationItem,
        { ...baseConfirmationItem, payoutId: 'payout_documents_duplicate' },
        {
          ...baseConfirmationItem,
          payoutId: 'payout_documents_paypal',
          provider: 'PayPal',
          accountName: 'Mina/Kato',
          amount: 12.5,
        },
        {
          ...baseConfirmationItem,
          payoutId: 'payout_documents_paymax',
          provider: 'PayMax',
          accountName: 'PayMax Account',
          amount: 10,
          paidAt: '2026-08-19T00:01:00+14:00',
        },
        {
          ...baseConfirmationItem,
          payoutId: 'payout_documents_failed',
          paymentStatus: '付款失败',
        },
        {
          ...baseConfirmationItem,
          payoutId: 'payout_documents_no_date',
          paidAt: undefined,
        },
      ],
      loadAsset: async (path) => {
        expect(path).toBe('/export-assets/airwallex/airwallex付款单-支付确认函.pdf');
        return airwallexPdf;
      },
      genericPdf: async (candidate) => {
        genericCalls.push(candidate.payoutId);
        return new Blob(['GENERIC PROTOTYPE CONFIRMATION'], { type: 'application/pdf' });
      },
    });
    const archive = await JSZip.loadAsync(await archiveBlob.arrayBuffer());
    const filenames = Object.keys(archive.files);

    expect(filenames).toContain('20260818-Airwallex-确认函/20260818Mina Kato-1250 USD.pdf');
    expect(filenames).toContain('20260818-Airwallex-确认函/20260818Mina Kato-1250 USD-02.pdf');
    expect(filenames).toContain('20260818-PayPal-确认函/20260818Mina-Kato-12.5 USD.pdf');
    expect(filenames).toContain('20260819-Payer Max-确认函/20260819PayMax Account-10 USD.pdf');
    expect(filenames.some((name) => name.includes('payout_documents_failed'))).toBe(false);
    expect(filenames.some((name) => name.includes('payout_documents_no_date'))).toBe(false);
    expect(genericCalls).toEqual(['payout_documents_paypal', 'payout_documents_paymax']);
  });

  it('blocks confirmation export when no paid item has an actual payment date', async () => {
    await expect(createPaymentProjectConfirmationArchive({
      items: [{ ...item, paidAt: undefined }],
      loadAsset: async () => new Blob(['unused']),
    })).rejects.toThrow('当前没有具备实际付款日期的已付款明细');
  });

  it('downloads one confirmation PDF with the current payment-order filename', async () => {
    const template = new Blob(['AIRWALLEX CONFIRMATION'], { type: 'application/pdf' });
    const retryItem = {
      ...item,
      paymentOrderCode: 'PAY-RETRY-002',
      sourcePaymentOrderCode: item.paymentListCode,
      paymentAttemptNumber: 2,
    } satisfies PaymentBatchItemSnapshot;

    const result = await createPaymentItemConfirmationPdf({
      item: retryItem,
      loadAsset: async (path) => {
        expect(path).toBe('/export-assets/airwallex/airwallex付款单-支付确认函.pdf');
        return template;
      },
    });

    expect(await result.text()).toBe('AIRWALLEX CONFIRMATION');
    expect(paymentItemConfirmationFilename(retryItem)).toBe('PAY-RETRY-002-INV-202608-000019-付款确认函.pdf');
  });

  it('uses stable project filenames', () => {
    expect(paymentProjectWorkbookFilename('REQ-202608-000019')).toBe('REQ-202608-000019-付款表.xlsx');
    expect(paymentProjectDetailWorkbookFilename('REQ-202608-000019')).toBe('REQ-202608-000019-付款明细.xlsx');
    expect(paymentProjectConfirmationArchiveFilename('REQ-202608-000019')).toBe('REQ-202608-000019-付款确认函.zip');
  });
});
