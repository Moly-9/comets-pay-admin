import { describe, expect, it } from 'vitest';
import {
  confirmRecognitionField,
  editRecognitionField,
  normalizeCampaignPeriod,
  normalizeMoney,
  recognizeContract,
  recognizeContractFields,
} from './contractRecognition';
import type {
  ContractDocumentType,
  ContractParseStatus,
  ParsedContractDocument,
} from './contractRecognitionTypes';

const documentFixture = (
  id: string,
  documentType: ContractDocumentType,
  lines: string[],
  parseStatus: ContractParseStatus = 'parsed',
): ParsedContractDocument => ({
  id,
  fileName: `${id}.pdf`,
  mimeType: 'application/pdf',
  documentType,
  parseStatus,
  pageCount: 17,
  templateMatch: {
    matched: lines.some((line) => /Standard Terms And Conditions For Digital Marketing Services/i.test(line)),
    templateKey: lines.some((line) => /Standard Terms And Conditions For Digital Marketing Services/i.test(line))
      ? 'COMETS_DIGITAL_MARKETING_SINGLE_CAMPAIGN'
      : 'UNKNOWN',
    confidence: 1,
    matchedHeadings: [],
    ioStartPage: lines.findIndex((line) => line === 'Insertion Order') + 1 || null,
  },
  blocks: lines.map((text, index) => ({
    id: `${id}-${index}`,
    pageNumber: index + 1,
    section: documentType === 'IO' ? 'Campaign Details' : 'Standard Terms',
    documentType: text === 'Insertion Order' || index > lines.findIndex((line) => line === 'Insertion Order') && lines.includes('Insertion Order')
      ? 'IO'
      : documentType,
    text,
    items: [],
    kind: /^(Standard Terms|Insertion Order|Campaign Details)/.test(text) ? 'heading' : 'paragraph',
  })),
});

const field = (documents: ParsedContractDocument[], fieldKey: string, systemContractNumber?: string) => (
  recognizeContractFields(documents, { systemContractNumber })
    .find((item) => item.fieldKey === fieldKey)!
);

describe('contract field recognition', () => {
  it('extracts Advertiser and Publisher from Standard Terms', () => {
    const standardTerms = documentFixture('standard', 'STANDARD_TERMS', [
      'Advertiser: Comets International Limited',
      'Publisher | Léa Martin',
    ]);
    expect(field([standardTerms], 'advertiser').rawValue).toBe('Comets International Limited');
    expect(field([standardTerms], 'publisher').rawValue).toBe('Léa Martin');
  });

  it('extracts separate IO fields and a dynamic Campaign Period without fixed page assumptions', () => {
    const io = documentFixture('campaign-io', 'IO', [
      'Insertion Order',
      'Campaign Details',
      'IO Number: IO-2026-0088',
      'Project Name: Summer Launch',
      'Brand: Nebula Quest',
      'Platform: YouTube',
      'Channel Name: LeaPlay FR',
      'Channel Link: https://youtube.com/@LeaPlayFR',
      'Campaign Period: August 1, 2026 to August 31, 2026',
    ]);
    const results = recognizeContractFields([io]);
    expect(results.find((item) => item.fieldKey === 'ioNumber')?.rawValue).toBe('IO-2026-0088');
    expect(results.find((item) => item.fieldKey === 'projectName')?.rawValue).toBe('Summer Launch');
    expect(results.find((item) => item.fieldKey === 'brandName')?.rawValue).toBe('Nebula Quest');
    expect(results.find((item) => item.fieldKey === 'platform')?.rawValue).toBe('YouTube');
    expect(results.find((item) => item.fieldKey === 'campaignPeriod')?.normalizedValue).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });
    expect(results.find((item) => item.fieldKey === 'ioNumber')?.pageNumber).toBe(3);
  });

  it('normalizes English date and amount formats', () => {
    expect(normalizeCampaignPeriod('August 1, 2026 to August 31, 2026')).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });
    expect(normalizeMoney('300 USD')).toEqual({ amount: 300, currency: 'USD' });
    expect(normalizeMoney('USD 300')).toEqual({ amount: 300, currency: 'USD' });
  });

  it('keeps system contract and IO numbers selected while exposing file conflicts', () => {
    const document = documentFixture('standard', 'STANDARD_TERMS', [
      'Contract Number: FILE-100',
      'IO Number: FILE-IO-100',
    ]);
    const results = recognizeContractFields([document], {
      systemContractNumber: 'SYS-200',
      systemIoNumber: 'SYS-IO-200',
    });
    const contractNumber = results.find((item) => item.fieldKey === 'contractNumber')!;
    const ioNumber = results.find((item) => item.fieldKey === 'ioNumber')!;
    expect(contractNumber).toMatchObject({ status: 'CONFLICT', rawValue: 'SYS-200' });
    expect(ioNumber).toMatchObject({ status: 'CONFLICT', rawValue: 'SYS-IO-200' });
  });

  it('passes matching Publisher candidates and conflicts different candidates', () => {
    const consistent = [
      documentFixture('terms', 'STANDARD_TERMS', ['Publisher: Zoë Dupont']),
      documentFixture('io', 'IO', ['Publisher: Zoë Dupont']),
    ];
    const conflict = [
      consistent[0],
      documentFixture('signature', 'SIGNATURE_PAGE', ['Publisher: Zoe Studio Limited']),
    ];
    expect(field(consistent, 'publisher').status).toBe('DETECTED');
    expect(field(conflict, 'publisher').status).toBe('CONFLICT');
  });

  it('marks Campaign Period and split Start/End disagreement as conflict', () => {
    const io = documentFixture('io', 'IO', [
      'Campaign Period: August 1, 2026 to August 31, 2026',
      'Start Date: August 2, 2026',
      'End Date: August 31, 2026',
    ]);
    expect(field([io], 'campaignPeriod').status).toBe('CONFLICT');
  });

  it('marks retained [60/45] payment options as conflict', () => {
    const io = documentFixture('io', 'IO', [
      'The payment of 100% shall be made within [60/45] working days after the video is released, accepted by the Client, and upon receipt of the invoice.',
    ]);
    const result = field([io], 'paymentTerm');
    expect(result.status).toBe('CONFLICT');
    expect(result.normalizedValue).toMatchObject({ normalizedDays: null, options: [60, 45] });
  });

  it('splits Services/Deliverables into structured requirements', () => {
    const io = documentFixture('io', 'IO', [
      'Services/ Deliverables:',
      '1. Provide a written script of initial ideas for the video before making the video.',
      '2. Post a dedicated landscape video on YouTube channel.',
      '3. Put the correct game name, call-to-action (CTA), and tracklink at the top of the description.',
      '4. Relevant introduction with hashtag of #campaign.',
      '5. Stream: Provide screenshots of Twitch analytics within 2 days for acceptance purposes.',
      '6. In the event of unfavourable branding, work with the brand for removal.',
    ]);
    const result = recognizeContract([io]);
    expect(result.deliverables.map((item) => item.type)).toEqual(expect.arrayContaining([
      'SCRIPT', 'DEDICATED_VIDEO', 'CTA', 'TRACKLINK', 'HASHTAG', 'STREAM',
      'ANALYTICS_SCREENSHOT', 'CONTENT_REMOVAL',
    ]));
    expect(result.deliverables.filter((item) => item.type === 'STREAM')).toHaveLength(1);
    expect(result.deliverables.filter((item) => item.type === 'CONTENT_REMOVAL')).toHaveLength(1);
    expect(result.deliverables.every((item) => item.source_text && item.source_page)).toBe(true);
  });

  it('does not use visual highlight information to recognize the template', () => {
    const template = documentFixture('template', 'STANDARD_TERMS', [
      'Standard Terms And Conditions For Digital Marketing Services',
      'Insertion Order',
      'Campaign Details',
      'Services/Deliverables',
      'Project Total Fees: Please fill in fees here',
    ]);
    const result = recognizeContract([template]);
    expect(result.templateMatch.matched).toBe(true);
    expect(result.fields.find((item) => item.fieldKey === 'projectTotalFees')?.status).toBe('PLACEHOLDER');
  });

  it('does not produce candidates from a scanned PDF or invent missing fields', () => {
    const scanned = documentFixture('scan', 'IO', ['IO Number: SHOULD-NOT-EXIST'], 'scanned');
    expect(field([scanned], 'ioNumber')).toMatchObject({ status: 'MISSING', candidates: [] });
    expect(field([documentFixture('blank', 'OTHER', ['No labeled contract data.'])], 'paymentMethod'))
      .toMatchObject({ rawValue: '', normalizedValue: null, status: 'MISSING', candidates: [] });
  });

  it('masks account and IBAN values to their final four characters', () => {
    const payment = documentFixture('payment', 'PAYMENT_ADDENDUM', [
      'Account Number: 1234567890123456',
      'IBAN: GB82 WEST 1234 5698 7654 32',
    ]);
    expect(field([payment], 'accountNumberLast4')).toMatchObject({
      rawValue: '•••• 3456',
      normalizedValue: '3456',
    });
    expect(field([payment], 'ibanLast4')).toMatchObject({
      rawValue: '•••• 5432',
      normalizedValue: '5432',
    });
  });

  it('keeps an original value after edit and confirms only resolved fields', () => {
    const detected = field([documentFixture('terms', 'STANDARD_TERMS', ['Publisher: Zoë Dupont'])], 'publisher');
    const edited = editRecognitionField(detected, 'Zoë Dupont Studio');
    const confirmed = confirmRecognitionField(edited);
    expect(edited).toMatchObject({
      originalDetectedValue: 'Zoë Dupont',
      status: 'DETECTED',
    });
    expect(confirmed).toMatchObject({ editedValue: 'Zoë Dupont Studio', status: 'CONFIRMED' });
  });

  it('marks a payout snapshot mismatch without replacing the contract value', () => {
    const payment = documentFixture('payment', 'PAYMENT_ADDENDUM', [
      'Beneficiary Account Name: Different Trading Limited',
    ]);
    const result = recognizeContractFields([payment], {
      beneficiaryReferences: [{
        label: 'Zoë Dupont · •••• 0001',
        matchTokens: ['Zoë Dupont', '0001'],
      }],
    }).find((item) => item.fieldKey === 'beneficiaryAccountName')!;
    expect(result.rawValue).toBe('Different Trading Limited');
    expect(result.status).toBe('CONFLICT');
    expect(result.profileComparison?.status).toBe('CONFLICT');
  });
});
