import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { describe, expect, it } from 'vitest';
import type { CreatorId, EngagementId, ProjectId } from './businessWorkflow';
import {
  generateContractDocx,
  generateContractPdf,
  type ContractFontBytes,
} from './contractGeneration';
import type { ContractGenerationModel } from './contracts';
import {
  bindingsForField,
  CONTRACT_TEMPLATE_FIELD_BINDINGS,
} from './contractTemplate';

const toArrayBuffer = (buffer: Buffer) => (
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
);

GlobalWorkerOptions.workerSrc = pathToFileURL(
  resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
).href;

const model: ContractGenerationModel = {
  templateId: 'CON-TPL-2026-KOL',
  projectId: 'project-synthetic' as ProjectId,
  projectName: 'Synthetic Launch Campaign',
  brandName: 'Synthetic Brand',
  creatorId: 'creator-synthetic' as CreatorId,
  creatorName: 'Sample Creator',
  creatorHandle: '@sample',
  engagementId: 'engagement-synthetic' as EngagementId,
  contractNumber: 'CON-SYNTHETIC-001',
  ioNumber: '',
  advertiser: 'Comets International Limited',
  publisher: 'Sample Creator Limited',
  publisherAddress: '1 Example Road, Sample City',
  platform: 'YouTube',
  channelName: 'Sample Studio',
  channelUrl: 'https://example.invalid/sample-studio',
  effectiveDate: '2026-08-05',
  campaignStart: '2026-08-10',
  campaignEnd: '2026-08-31',
  purposeItems: ['Introduce the synthetic campaign', 'Explain the sample feature'],
  promotedProduct: 'Synthetic Product',
  hashtag: '#SyntheticCampaign',
  contentFormat: 'Dedicated video',
  releaseStart: '2026-08-12',
  releaseEnd: '2026-08-20',
  language: 'English',
  contentLength: 'At least 8 minutes',
  licensePeriod: '12 months',
  licensePrice: '500',
  currency: 'USD',
  totalFee: '3000',
  invoiceIssueWorkingDays: 3,
  paymentWorkingDays: 45,
  paymentMethod: 'AIRWALLEX',
  feeBearer: 'ADVERTISER',
  payoutAccountId: 'account-synthetic',
  payoutProvider: 'Airwallex',
  paymentSnapshot: {
    bankCountry: 'Sample Country',
    accountName: 'Sample Creator Limited',
    accountType: 'Business',
    swiftCode: 'SAMPXX00',
    accountNumber: '0000001234',
    iban: 'SA0000000000001234',
    beneficiaryType: 'COMPANY',
    bankName: 'Sample Bank',
    bankStreetAddress: '2 Bank Road',
    bankCity: 'Sample City',
    bankState: '',
    bankPostalCode: '000000',
    intermediaryBankCountry: '',
    intermediaryBankCode: '',
    transferRemarks: 'Synthetic test only',
    paypalUsername: '',
    paypalEmail: '',
  },
};

const readTemplate = async () => (
  toArrayBuffer(await readFile(resolve('public/contracts/single-campaign-contract-template-v1.pdf')))
);

const readFonts = async (): Promise<ContractFontBytes> => {
  const root = resolve('node_modules/@fontsource/noto-sans-sc/files');
  const [latin, latinExt, chinese] = await Promise.all([
    readFile(resolve(root, 'noto-sans-sc-latin-400-normal.woff')),
    readFile(resolve(root, 'noto-sans-sc-latin-ext-400-normal.woff')),
    readFile(resolve(root, 'noto-sans-sc-chinese-simplified-400-normal.woff')),
  ]);
  return {
    latin: toArrayBuffer(latin),
    latinExt: toArrayBuffer(latinExt),
    chinese: toArrayBuffer(chinese),
  };
};

describe('contract generation', () => {
  it('keeps repeated publisher and campaign values synchronized across template pages', () => {
    expect(bindingsForField('publisher').map((binding) => binding.value(model))).toEqual([
      model.publisher,
      model.publisher,
      model.publisher,
      model.publisher,
      model.publisher,
    ]);
    expect(bindingsForField('campaignPeriod').map((binding) => binding.value(model))).toEqual([
      'Aug 10, 2026 to Aug 31, 2026',
      'Aug 10, 2026',
      'Aug 31, 2026',
    ]);
    expect(CONTRACT_TEMPLATE_FIELD_BINDINGS.find((binding) => binding.id === 'p6-fee')?.value(model)).toBe('ii');
  });

  it('creates a filled 17-page PDF from the original template', async () => {
    const pdfBlob = await generateContractPdf(model, await readTemplate(), await readFonts());
    const generatedPdf = await PDFDocument.load(await pdfBlob.arrayBuffer());

    expect(pdfBlob.type).toBe('application/pdf');
    expect(generatedPdf.getPageCount()).toBe(17);
    expect(generatedPdf.getTitle()).toContain(model.contractNumber);
  }, 30_000);

  it('creates an editable DOCX with full text, structured tables, and blank signature dates', async () => {
    const docxBlob = await generateContractDocx(model, await readTemplate());
    const archive = await JSZip.loadAsync(await docxBlob.arrayBuffer());
    const documentXml = await archive.file('word/document.xml')?.async('string');

    expect(docxBlob.type).toContain('officedocument.wordprocessingml.document');
    expect(documentXml).toContain('Standard Terms And Conditions');
    expect(documentXml).toContain(model.publisher);
    expect(documentXml).toContain(model.projectName);
    expect(documentXml).toContain(model.channelUrl);
    expect(documentXml).toContain(`accounts on ${model.platform}`);
    expect(documentXml).toContain('[45]');
    expect(documentXml).not.toContain('[60/45]');
    expect(documentXml).not.toMatch(/please fill|xxx|example only/i);
    expect(documentXml).toContain('Signature: _________________________');
    expect(documentXml).toContain('Date:');
    expect(documentXml).not.toContain('w:pict');
  }, 30_000);
});
