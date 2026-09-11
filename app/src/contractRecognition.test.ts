import { describe, expect, it } from 'vitest';
import {
  canConfirmRecognitionFields,
  confirmRecognitionField,
  confirmRecognitionFields,
  editRecognitionField,
  normalizeCampaignPeriod,
  normalizeMoney,
  recognitionFieldDisplayValue,
  recognizeContractFields,
  recognizeUploadContractFields,
  reopenRecognitionFields,
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
  pageCount: 2,
  blocks: lines.map((text, index) => ({
    id: `${id}-${index}`,
    pageNumber: index + 1,
    section: documentType === 'IO' ? 'Campaign Details' : 'Standard Terms',
    text,
    items: [],
    kind: 'paragraph',
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

  it('extracts IO number, project, platform, and Campaign Period from IO', () => {
    const io = documentFixture('campaign-io', 'IO', [
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
    expect(results.find((item) => item.fieldKey === 'projectBrand')?.normalizedValue).toEqual({
      projectName: 'Summer Launch',
      brandName: 'Nebula Quest',
    });
    expect(results.find((item) => item.fieldKey === 'platformChannel')?.normalizedValue).toEqual({
      platform: 'YouTube',
      channelName: 'LeaPlay FR',
      handle: '',
      channelUrl: 'https://youtube.com/@LeaPlayFR',
    });
    expect(results.find((item) => item.fieldKey === 'campaignPeriod')?.normalizedValue).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });
  });

  it('normalizes an English date range', () => {
    expect(normalizeCampaignPeriod('August 1, 2026 to August 31, 2026')).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });
  });

  it.each([
    ['300 USD', { amount: 300, currency: 'USD' }],
    ['USD 300', { amount: 300, currency: 'USD' }],
  ])('normalizes amount and currency order: %s', (raw, expected) => {
    expect(normalizeMoney(raw)).toEqual(expected);
  });

  it('keeps the system contract number authoritative when the file contains another number', () => {
    const standardTerms = documentFixture('standard', 'STANDARD_TERMS', ['Contract Number: FILE-100']);
    const result = field([standardTerms], 'contractNumber', 'SYS-200');

    expect(result.status).toBe('confirmed');
    expect(result.rawValue).toBe('SYS-200');
    expect(result.source?.documentId).toBe('system-contract');
    expect(result.candidates.map((candidate) => candidate.rawValue)).toEqual(['SYS-200']);
    expect(result.readOnly).toBe(true);
  });

  it('marks different payment terms from multiple documents as conflict', () => {
    const terms = documentFixture('standard', 'STANDARD_TERMS', ['Payment Term: Net 30 days']);
    const addendum = documentFixture('payment-addendum', 'PAYMENT_ADDENDUM', ['Payment Term: Net 45 days']);
    const result = field([terms, addendum], 'paymentTerm');

    expect(result.status).toBe('conflict');
    expect(result.rawValue).toBe('Net 45 days');
    expect(result.candidates).toHaveLength(2);
  });

  it('does not produce candidates from a scanned PDF', () => {
    const scanned = documentFixture('scan', 'IO', ['IO Number: SHOULD-NOT-EXIST'], 'scanned');
    const result = field([scanned], 'ioNumber');

    expect(result.status).toBe('missing');
    expect(result.candidates).toEqual([]);
  });

  it('returns missing fields without invented values', () => {
    const terms = documentFixture('standard', 'STANDARD_TERMS', ['This paragraph has no labeled contract data.']);
    const result = field([terms], 'paymentMethod');

    expect(result).toMatchObject({
      rawValue: '',
      normalizedValue: null,
      status: 'missing',
      candidates: [],
    });
  });

  it('updates status after editing and confirming a field', () => {
    const missing = field([], 'publisher');
    const edited = editRecognitionField(missing, 'Zoë Dupont');
    const confirmed = confirmRecognitionField(edited);

    expect(edited.status).toBe('detected');
    expect(confirmed).toMatchObject({
      rawValue: 'Zoë Dupont',
      editedValue: 'Zoë Dupont',
      status: 'confirmed',
    });
  });

  it('confirms a complete field group atomically and leaves fields outside the page unchanged', () => {
    const publisher = editRecognitionField(field([], 'publisher'), 'Zoë Dupont');
    const advertiser = editRecognitionField(field([], 'advertiser'), 'COMETS INTERNATIONAL LIMITED');
    const paymentMethod = editRecognitionField(field([], 'paymentMethod'), 'Bank Transfer');
    const fields = [publisher, advertiser, paymentMethod];

    expect(canConfirmRecognitionFields(fields, ['publisher', 'advertiser'])).toBe(true);
    const confirmed = confirmRecognitionFields(fields, ['publisher', 'advertiser']);

    expect(confirmed.find((item) => item.fieldKey === 'publisher')?.status).toBe('confirmed');
    expect(confirmed.find((item) => item.fieldKey === 'advertiser')?.status).toBe('confirmed');
    expect(confirmed.find((item) => item.fieldKey === 'paymentMethod')?.status).toBe('detected');
  });

  it('does not partially confirm a page with missing or conflicting fields', () => {
    const publisher = editRecognitionField(field([], 'publisher'), 'Zoë Dupont');
    const advertiser = field([], 'advertiser');
    const fields = [publisher, advertiser];

    expect(canConfirmRecognitionFields(fields, ['publisher', 'advertiser'])).toBe(false);
    expect(confirmRecognitionFields(fields, ['publisher', 'advertiser'])).toBe(fields);
    expect(fields[0].status).toBe('detected');
  });

  it('keeps confirmed fields immutable until their page is reopened for editing', () => {
    const publisher = confirmRecognitionField(editRecognitionField(field([], 'publisher'), 'Zoë Dupont'));
    const advertiser = confirmRecognitionField(editRecognitionField(field([], 'advertiser'), 'COMETS INTERNATIONAL LIMITED'));
    const paymentMethod = confirmRecognitionField(editRecognitionField(field([], 'paymentMethod'), 'Bank Transfer'));
    const confirmed = [publisher, advertiser, paymentMethod];

    expect(editRecognitionField(publisher, 'Changed Publisher')).toBe(publisher);

    const reopened = reopenRecognitionFields(confirmed, ['publisher', 'advertiser']);
    expect(reopened.find((item) => item.fieldKey === 'publisher')?.status).toBe('detected');
    expect(reopened.find((item) => item.fieldKey === 'advertiser')?.status).toBe('detected');
    expect(reopened.find((item) => item.fieldKey === 'paymentMethod')?.status).toBe('confirmed');

    const edited = editRecognitionField(
      reopened.find((item) => item.fieldKey === 'publisher')!,
      'Changed Publisher',
    );
    expect(edited).toMatchObject({
      rawValue: 'Changed Publisher',
      status: 'detected',
    });
  });

  it('marks a contract beneficiary mismatch against the creator profile without replacing the value', () => {
    const payment = documentFixture('payment', 'PAYMENT_ADDENDUM', [
      'Beneficiary: Different Trading Limited',
    ]);
    const result = recognizeContractFields([payment], {
      beneficiaryReferences: [{
        label: 'Léa Martin · •••• 0001',
        matchTokens: ['Léa Martin', '0001'],
      }],
    }).find((item) => item.fieldKey === 'beneficiaryAccount')!;

    expect(result.rawValue).toBe('Different Trading Limited');
    expect(result.status).toBe('conflict');
    expect(result.profileComparison).toEqual({
      status: 'conflict',
      referenceLabels: ['Léa Martin · •••• 0001'],
    });
  });

  it('uses an explicit standalone label and the next page block as a low-confidence candidate', () => {
    const terms = documentFixture('cross-page', 'STANDARD_TERMS', [
      'Payment Term:',
      'Net 30 days after receipt of Invoice',
    ]);
    const result = field([terms], 'paymentTerm');

    expect(result).toMatchObject({
      rawValue: 'Net 30 days after receipt of Invoice',
      confidence: 0.78,
      status: 'detected',
    });
    expect(result.source?.sourceText).toBe('Payment Term: Net 30 days after receipt of Invoice');
  });

  it('builds the new upload field set from real contract text and keeps only the expiry date', () => {
    const contract = {
      ...documentFixture('signed-bank-contract', 'STANDARD_TERMS', [
        'Advertiser: COMETS INTERNATIONAL LIMITED',
        'Publisher: Mina Kato',
        'Project Total Fees: USD 12,500',
        'Signed by: Mina Kato',
        'Campaign Period: August 10, 2026 to September 17, 2026',
        'Transfer Fee: All transfer fees shall be borne by Advertiser',
        'Publishing Platform: Instagram',
        'Channel Name: @MinaKato',
        'Account Name: Mina Kato Studio',
        'Account Number: 0000004826',
        'Beneficiary Bank Name: Example Bank',
        'Beneficiary Bank Address: 1 Example Road, Tokyo',
        'SWIFT Code: EXAMPLE1',
        'IBAN: GB82 WEST 1234 5698 7654 32',
        'Remittance Information: Creator campaign',
        'Contract Number: FILE-IGNORED',
      ]),
      contractType: 'INDEPENDENT' as const,
    };
    const fields = recognizeUploadContractFields([contract], { systemContractNumber: 'CON-SYSTEM-001' });

    expect(fields.map((item) => item.fieldKey)).toEqual([
      'advertiser',
      'publisher',
      'projectTotalFees',
      'signatureStatus',
      'contractExpiry',
      'transferFee',
      'accountName',
      'accountNumber',
      'beneficiaryBankName',
      'beneficiaryBankAddress',
      'swiftCode',
      'iban',
      'remittanceInformation',
      'platformChannel',
      'contractNumber',
    ]);
    expect(recognitionFieldDisplayValue(fields.find((item) => item.fieldKey === 'signatureStatus')!)).toBe('已签署');
    expect(recognitionFieldDisplayValue(fields.find((item) => item.fieldKey === 'contractExpiry')!)).toBe('2026-09-17');
    expect(fields.find((item) => item.fieldKey === 'contractNumber')).toMatchObject({
      rawValue: 'CON-SYSTEM-001',
      status: 'confirmed',
      readOnly: true,
    });
    expect(fields.some((item) => item.fieldKey === 'paymentTerm')).toBe(false);
  });

  it('shows PayPal fields only when the document contains PayPal account evidence', () => {
    const contract = {
      ...documentFixture('paypal-contract', 'STANDARD_TERMS', [
        'PayPal Username: mina.kato',
        'PayPal Email Address: mina@example.com',
        'Transfer Note: Summer campaign',
      ]),
      contractType: 'INDEPENDENT' as const,
    };
    const fields = recognizeUploadContractFields([contract], { systemContractNumber: 'CON-SYSTEM-002' });

    expect(fields.filter((item) => item.group === 'paypal').map((item) => item.fieldKey)).toEqual([
      'paypalUsername',
      'paypalEmail',
      'transferNote',
    ]);
    expect(fields.some((item) => item.group === 'bank' && item.applicable !== false)).toBe(false);
  });

  it('keeps empty account fields available for later manual supplementation without displaying fake values', () => {
    const contract = {
      ...documentFixture('no-account-contract', 'STANDARD_TERMS', ['Publisher: Mina Kato']),
      contractType: 'INDEPENDENT' as const,
    };
    const fields = recognizeUploadContractFields([contract], { systemContractNumber: 'CON-SYSTEM-003' });
    const accountFields = fields.filter((item) => item.group === 'bank' || item.group === 'paypal');

    expect(accountFields).toHaveLength(10);
    expect(accountFields.every((item) => item.applicable === false && item.rawValue === '')).toBe(true);
  });

  it('keeps an unknown signature status empty until it is selected manually', () => {
    const signature = recognizeContractFields([], {}).find((item) => item.fieldKey === 'signatureStatus')!;
    const selected = editRecognitionField(signature, 'UNSIGNED');

    expect(signature.status).toBe('missing');
    expect(selected).toMatchObject({
      rawValue: '未签署',
      normalizedValue: { signed: false },
      status: 'detected',
    });
  });

  it('recognizes an explicit signed status but does not guess from a blank signature line', () => {
    const signed = documentFixture('signed-status', 'SIGNATURE_PAGE', ['Signature Status: Signed']);
    const unsigned = documentFixture('unsigned-status', 'SIGNATURE_PAGE', ['Signed: No']);
    const blank = documentFixture('blank-signature', 'SIGNATURE_PAGE', ['Signature: ____________________']);

    expect(field([signed], 'signatureStatus')).toMatchObject({
      rawValue: '已签署',
      normalizedValue: { signed: true },
      status: 'detected',
    });
    expect(field([unsigned], 'signatureStatus')).toMatchObject({
      rawValue: '未签署',
      normalizedValue: { signed: false },
      status: 'detected',
    });
    expect(field([blank], 'signatureStatus')).toMatchObject({
      rawValue: '',
      normalizedValue: null,
      status: 'missing',
    });
  });

  it('rejects an invalid manually entered expiry date until it is corrected', () => {
    const expiry = editRecognitionField(field([], 'contractExpiry'), 'not a date');

    expect(expiry).toMatchObject({ rawValue: 'not a date', status: 'missing' });
    expect(canConfirmRecognitionFields([expiry], ['contractExpiry'])).toBe(false);
  });

  it('keeps the IO number immediately before the system contract number for IO uploads', () => {
    const io = {
      ...documentFixture('io-upload', 'IO', ['IO Number: IO-2026-0099']),
      contractType: 'IO' as const,
    };
    const fields = recognizeUploadContractFields([io], { systemContractNumber: 'CON-SYSTEM-IO' });

    expect(fields.slice(-3).map((item) => item.fieldKey)).toEqual([
      'platformChannel',
      'ioNumber',
      'contractNumber',
    ]);
  });

  it('extracts multiple label-value pairs from one DOCX table row independently', () => {
    const bankTable = documentFixture('bank-table', 'PAYMENT_ADDENDUM', [
      'Account Name | Mina Kato Studio | Account Number | 0000004826',
      'Beneficiary Bank Name | Example Bank | SWIFT Code | EXAMPLE1',
    ]);

    expect(field([bankTable], 'accountName').rawValue).toBe('Mina Kato Studio');
    expect(field([bankTable], 'accountNumber').rawValue).toBe('0000004826');
    expect(field([bankTable], 'beneficiaryBankName').rawValue).toBe('Example Bank');
    expect(field([bankTable], 'swiftCode').rawValue).toBe('EXAMPLE1');
  });
});
