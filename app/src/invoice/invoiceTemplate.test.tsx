import { renderToStaticMarkup } from 'react-dom/server';
import JSZip from 'jszip';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvoiceDocumentView } from '../components/InvoiceDocumentView';
import type { CreatorId, EngagementId, ProjectId } from '../businessWorkflow';
import type { InvoiceDocumentModel } from '../types';
import { generateInvoiceDocx, generateInvoicePdf } from './generateInvoice';

const PROJECT_NAME = 'Internal Project Alpha';

const model: InvoiceDocumentModel = {
  invoiceNumber: 'INV-20260804-TEST01',
  invoiceDate: '2026-08-04',
  signatureDate: '2026-08-14',
  billTo: {
    name: 'COMETS INTERNATIONAL LIMITED',
    address: 'Unit 04-05, 16th Floor, The Broadway',
  },
  creatorHandle: '@creator',
  creatorName: 'Creator Name',
  creatorId: 'creator-id' as CreatorId,
  engagementId: 'engagement-id' as EngagementId,
  projectId: 'project-id' as ProjectId,
  projectName: PROJECT_NAME,
  from: {
    legalName: 'Creator Legal Name',
    address: 'Creator Address',
    phone: '+1 202 555 0100',
    email: 'creator@example.com',
  },
  currency: 'USD',
  items: [{
    id: 'line-1',
    description: 'Campaign deliverable',
    unitPrice: 300,
    quantity: 1,
    lineTotal: 300,
  }],
  paymentMethod: 'paypal',
  payment: {
    bankCountry: '',
    accountName: '',
    accountType: '',
    swiftCode: '',
    accountNumber: '',
    iban: '',
    beneficiaryType: '',
    bankName: '',
    bankStreetAddress: '',
    bankCity: '',
    bankState: '',
    bankPostalCode: '',
    intermediaryBankCountry: '',
    intermediaryBankCode: '',
    transferRemarks: '',
    paypalUsername: 'Creator PayPal',
    paypalEmail: 'paypal@example.com',
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Invoice template project visibility', () => {
  it('keeps project association in the model without rendering it in the live preview', () => {
    const html = renderToStaticMarkup(<InvoiceDocumentView model={model} />);

    expect(model).toMatchObject({
      projectId: 'project-id',
      projectName: PROJECT_NAME,
    });
    expect(html).toContain('Date of Invoice:');
    expect(html).toContain('<b>Date:</b> 14 Aug 2026');
    expect(html).toContain('Currency:');
    expect(html).not.toContain('Project:');
    expect(html).not.toContain(PROJECT_NAME);
  });

  it('renders Airwallex Payment Information as Paid by Bank', () => {
    const html = renderToStaticMarkup(<InvoiceDocumentView model={{
      ...model,
      paymentMethod: 'bank',
      payment: {
        ...model.payment,
        accountName: 'Creator Legal Name',
        accountNumber: '0000001234',
        bankName: 'Airwallex Prototype Bank',
        bankStreetAddress: '100 Prototype Avenue',
        paypalUsername: '',
        paypalEmail: '',
      },
    }} />);

    expect(html).toContain('Payment information (choose one)');
    expect(html).toContain('Paid by Bank');
    expect(html).not.toContain('Paid by Paypal');
  });

  it('does not write project details into the generated DOCX', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([0])));

    const blob = await generateInvoiceDocx(model);
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const documentXml = await archive.file('word/document.xml')?.async('string');
    const metadataXml = await archive.file('docProps/core.xml')?.async('string');

    expect(documentXml).toContain('Date of Invoice');
    expect(documentXml).toContain('Date');
    expect(documentXml).toContain('14 Aug 2026');
    expect(documentXml).toContain('Currency');
    expect(documentXml).not.toContain('Project');
    expect(documentXml).not.toContain(PROJECT_NAME);
    expect(metadataXml).not.toContain(PROJECT_NAME);
  });

  it('does not write project details into the generated PDF', async () => {
    GlobalWorkerOptions.workerSrc = new URL(
      '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url,
    ).href;

    const blob = await generateInvoicePdf(model);
    const pdf = await getDocument({
      data: new Uint8Array(await blob.arrayBuffer()),
      standardFontDataUrl: new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).href,
      verbosity: 0,
    }).promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');

    expect(text).toContain('Date of Invoice:');
    expect(text).toContain('Date:');
    expect(text).toContain('14 Aug 2026');
    expect(text).toContain('Currency:');
    expect(text).not.toContain('Project:');
    expect(text).not.toContain(PROJECT_NAME);
    expect(await pdf.getMetadata()).toEqual(expect.objectContaining({
      info: expect.not.objectContaining({ Subject: expect.stringContaining(PROJECT_NAME) }),
    }));
  });

  it('blocks file generation when the selected payout snapshot is incomplete', async () => {
    const incompleteBankModel: InvoiceDocumentModel = {
      ...model,
      paymentMethod: 'bank',
      payment: {
        ...model.payment,
        payoutProvider: 'Airwallex',
        transferMethod: 'LOCAL',
        accountName: 'Creator Legal Name',
        accountNumber: '0000000001',
        bankName: 'Sample Bank',
        bankStreetAddress: '',
        paypalUsername: '',
        paypalEmail: '',
      },
    };

    await expect(generateInvoicePdf(incompleteBankModel))
      .rejects.toThrow('Beneficiary Bank Address');
  });
});
