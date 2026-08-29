import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import { describe, expect, it } from 'vitest';
import type { CreatorId, EngagementId, ProjectId } from './businessWorkflow';
import {
  extractContractTemplatePageLines,
  generateContractDocx,
  generateContractPdf,
  type ContractFontBytes,
} from './contractGeneration';
import type { ContractGenerationModel } from './contracts';
import {
  CONTRACT_PLACEHOLDER_DEFINITIONS,
  createContractQualityReport,
  replaceContractPlaceholders,
} from './contractTemplate';

const toArrayBuffer = (buffer: Buffer) => (
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
);

GlobalWorkerOptions.workerSrc = pathToFileURL(
  resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
).href;

const model: ContractGenerationModel = {
  templateId: 'CON-TPL-2026-KOL',
  contractName: 'Sample Creator-Synthetic Launch Campaign',
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
  publishingChannels: [
    {
      socialAccountId: 'social-youtube',
      platform: 'YouTube',
      channelUrl: 'https://example.invalid/sample-studio',
    },
    {
      socialAccountId: 'social-instagram',
      platform: 'Instagram',
      channelUrl: 'https://instagram.com/sample-studio',
    },
  ],
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

const optionalFieldsBlankModel = (): ContractGenerationModel => ({
  ...model,
  projectName: '',
  brandName: '',
  effectiveDate: '',
  campaignStart: '',
  campaignEnd: '',
  purposeItems: [],
  promotedProduct: '',
  hashtag: '',
  contentFormat: '',
  releaseStart: '',
  releaseEnd: '',
  language: '',
  contentLength: '',
  licensePeriod: '',
  licensePrice: '',
  currency: '',
  totalFee: '',
  feeBearer: '',
});

const readTemplate = async () => (
  toArrayBuffer(await readFile(resolve('public/contracts/single-campaign-contract-template-v1.pdf')))
);

const renderFixtureDir = process.env.CONTRACT_RENDER_FIXTURE_DIR;

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

const pdfText = async (blob: Blob) => {
  const task = getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  const document = await task.promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  await task.destroy();
  return pages.join('\n');
};

describe('contract generation', () => {
  it('reconstructs source rows without private-use glyphs or word-fragment spacing', async () => {
    const pages = await extractContractTemplatePageLines(await readTemplate());
    const text = pages.flat().join('\n');

    expect(pages).toHaveLength(17);
    expect(pages.flat().some((line) => (
      /[\u0000-\u001f\u007f-\u009f\uE000-\uF8FF\uFFFD]/.test(line)
    ))).toBe(false);
    expect(text).toContain('Associated Company means a company');
    expect(text).not.toContain('Associated Compan y');
  });

  it('reuses parsed template rows for repeated generation from the same source', async () => {
    const template = await readTemplate();
    const firstExtraction = extractContractTemplatePageLines(template);
    const secondExtraction = extractContractTemplatePageLines(template);

    expect(secondExtraction).toBe(firstExtraction);
    const [firstPages, secondPages] = await Promise.all([firstExtraction, secondExtraction]);
    expect(secondPages).toBe(firstPages);
    expect(firstPages).toHaveLength(17);
  });

  it('replaces registered placeholders without changing unrelated text', () => {
    const template = 'Publisher {{publisher_name}} / Project {{project_name}} / {{publisher_name}}';
    const result = replaceContractPlaceholders(template, model, 'FORMAL');

    expect(result).toBe(`Publisher ${model.publisher} / Project ${model.projectName} / ${model.publisher}`);
    expect(result).not.toMatch(/\{\{[^}]+\}\}/);
    expect(CONTRACT_PLACEHOLDER_DEFINITIONS.every((definition) => definition.kind)).toBe(true);
  });

  it('calculates dynamic completion, blocking fields, formats, and overflow warnings', () => {
    const complete = createContractQualityReport(model);
    const incomplete = createContractQualityReport({
      ...model,
      publisherAddress: '',
      totalFee: '-1',
      campaignStart: '2026-09-01',
      campaignEnd: '2026-08-31',
      contentLength: 'x'.repeat(320),
    });

    expect(complete.hasBlockers).toBe(false);
    expect(complete.completedFields).toBe(complete.totalFields);
    expect(incomplete.completedFields).toBeLessThan(incomplete.totalFields);
    expect(incomplete.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'REQUIRED_MISSING', fieldKey: 'publisherAddress' }),
      expect.objectContaining({ kind: 'FORMAT_INVALID', fieldKey: 'totalFee' }),
      expect.objectContaining({ kind: 'FORMAT_INVALID', fieldKey: 'campaignPeriod' }),
      expect.objectContaining({ kind: 'OVERFLOW_RISK', fieldKey: 'contentLength' }),
    ]));
  });

  it('keeps optional blank fields empty without creating quality blockers', () => {
    const optionalFieldsBlank = optionalFieldsBlankModel();
    const report = createContractQualityReport(optionalFieldsBlank);
    const rendered = replaceContractPlaceholders(
      '{{project_name}}|{{effective_date}}|{{campaign_purpose}}|{{contract_amount}}|{{fee_bearer}}',
      optionalFieldsBlank,
      'DRAFT',
    );

    expect(report.hasBlockers).toBe(false);
    expect(report.missingRequired).toBe(0);
    expect(rendered).toBe('||||');
    expect(rendered).not.toContain('待填写');
  });

  it('reports one selector issue before validating derived creator or payout fields', () => {
    const missingSelections: ContractGenerationModel = {
      ...model,
      creatorId: '' as CreatorId,
      projectId: '' as ProjectId,
      publisher: '',
      publisherAddress: '',
      platform: '',
      channelName: '',
      channelUrl: '',
      payoutAccountId: '',
      paymentSnapshot: {
        ...model.paymentSnapshot,
        accountName: '',
        accountNumber: '',
        iban: '',
        bankName: '',
      },
    };
    const report = createContractQualityReport(missingSelections);

    expect(report.issues.filter((issue) => issue.kind === 'REQUIRED_MISSING')).toEqual([
      expect.objectContaining({ id: 'missing-creator-selection' }),
      expect.objectContaining({ id: 'missing-project-selection' }),
      expect.objectContaining({ id: 'missing-payout-account-selection' }),
    ]);
  });

  it('creates A4 draft and formal PDFs with dynamic pages and variant-specific watermarks', async () => {
    const [template, fonts] = await Promise.all([readTemplate(), readFonts()]);
    const draftBlob = await generateContractPdf(model, template, fonts, 'DRAFT');
    const formalBlob = await generateContractPdf(model, template, fonts, 'FORMAL');
    const optionalBlankBlob = await generateContractPdf(optionalFieldsBlankModel(), template, fonts, 'FORMAL');
    const [draftPdf, formalPdf, draftText, formalText, optionalBlankText] = await Promise.all([
      PDFDocument.load(await draftBlob.arrayBuffer()),
      PDFDocument.load(await formalBlob.arrayBuffer()),
      pdfText(draftBlob),
      pdfText(formalBlob),
      pdfText(optionalBlankBlob),
    ]);

    expect(draftBlob.type).toBe('application/pdf');
    expect(formalPdf.getPageCount()).toBeGreaterThanOrEqual(17);
    expect(draftPdf.getPageCount()).toBe(formalPdf.getPageCount());
    expect(formalPdf.getPage(0).getSize()).toMatchObject({ width: 595.92, height: 841.92 });
    expect(formalPdf.getTitle()).toContain(model.contractNumber);
    expect(draftText).toContain('DRAFT');
    expect(formalText).not.toContain('DRAFT');
    expect(formalText).toContain('Standard Terms And Conditions');
    expect(formalText).toContain(model.publisher);
    expect(formalText).toContain('YouTube');
    expect(formalText).toContain('https://example.invalid/sample-studio');
    expect(formalText).toContain('Instagram');
    expect(formalText).toContain('https://instagram.com/sample-studio');
    expect(formalText).not.toMatch(/\{\{[^}]+\}\}|please fill|example only/i);
    expect(optionalBlankText).not.toMatch(/\{\{[^}]+\}\}|待填写|please fill|example only/i);
    if (renderFixtureDir) {
      await mkdir(renderFixtureDir, { recursive: true });
      await writeFile(resolve(renderFixtureDir, 'synthetic-contract-formal.pdf'), Buffer.from(await formalBlob.arrayBuffer()));
    }
  }, 60_000);

  it('creates editable DOCX files with A4 styles, growable tables, and blank bordered signature lines', async () => {
    const template = await readTemplate();
    const [draftBlob, formalBlob, optionalBlankBlob] = await Promise.all([
      generateContractDocx(model, template, 'DRAFT'),
      generateContractDocx(model, template, 'FORMAL'),
      generateContractDocx(optionalFieldsBlankModel(), template, 'FORMAL'),
    ]);
    const [draftArchive, formalArchive] = await Promise.all([
      JSZip.loadAsync(await draftBlob.arrayBuffer()),
      JSZip.loadAsync(await formalBlob.arrayBuffer()),
    ]);
    const documentXml = await formalArchive.file('word/document.xml')?.async('string') ?? '';
    const optionalBlankArchive = await JSZip.loadAsync(await optionalBlankBlob.arrayBuffer());
    const optionalBlankXml = await optionalBlankArchive.file('word/document.xml')?.async('string') ?? '';
    const stylesXml = await formalArchive.file('word/styles.xml')?.async('string') ?? '';
    const draftHeaders = await Promise.all(
      Object.keys(draftArchive.files)
        .filter((name) => /^word\/header\d+\.xml$/.test(name))
        .map((name) => draftArchive.file(name)?.async('string') ?? ''),
    );
    const formalHeaders = await Promise.all(
      Object.keys(formalArchive.files)
        .filter((name) => /^word\/header\d+\.xml$/.test(name))
        .map((name) => formalArchive.file(name)?.async('string') ?? ''),
    );

    expect(formalBlob.type).toContain('officedocument.wordprocessingml.document');
    expect(documentXml).toContain('Standard Terms And Conditions');
    expect(documentXml).toContain(model.publisher);
    expect(documentXml).toContain(model.projectName);
    expect(documentXml).toContain('YouTube: https://example.invalid/sample-studio');
    expect(documentXml).toContain('Instagram: https://instagram.com/sample-studio');
    expect(documentXml).not.toMatch(/\{\{[^}]+\}\}|please fill|example only/i);
    expect(documentXml).not.toContain('________________');
    expect(optionalBlankXml).not.toMatch(/\{\{[^}]+\}\}|待填写|please fill|example only/i);
    expect(documentXml).toContain('w:pBdr');
    expect(documentXml).toContain('w:cantSplit');
    expect(documentXml).toContain('w:pgSz');
    expect(stylesXml).toContain('w:sz w:val="21"');
    expect(draftHeaders.join(' ')).toContain('DRAFT / 草稿');
    expect(formalHeaders.join(' ')).not.toContain('DRAFT / 草稿');
    if (renderFixtureDir) {
      await mkdir(renderFixtureDir, { recursive: true });
      await writeFile(resolve(renderFixtureDir, 'synthetic-contract-formal.docx'), Buffer.from(await formalBlob.arrayBuffer()));
    }
  }, 60_000);
});
