import { Workbook } from 'exceljs';
import { describe, expect, it } from 'vitest';
import type {
  CreatorId,
  EngagementId,
  InvoiceId,
  PaymentListRecord,
  ProjectId,
} from './businessWorkflow';
import {
  getPayoutAccountFingerprint,
  getPayoutAccountVersion,
  createAirwallexPayoutAccount,
} from './payoutAccounts';
import {
  AIRWALLEX_PAYMENT_LIST_HEADERS,
  AIRWALLEX_PAYMENT_LIST_SHEET,
  PAYPAL_PAYMENT_LIST_HEADERS,
  PAYPAL_PAYMENT_LIST_SHEET,
  buildAirwallexPaymentListRows,
  buildPayPalPaymentListRows,
  exportAirwallexPaymentListWorkbook,
  exportPayPalPaymentListWorkbook,
  paymentListWorkbookFilename,
  PaymentListWorkbookError,
} from './paymentListWorkbook';
import type { AirwallexPayoutAccount, CreatorProfile } from './types';

const creatorId = 'creator-workbook' as CreatorId;
const projectId = 'project-workbook' as ProjectId;

const account = (
  id: string,
  transferMethod: 'LOCAL' | 'SWIFT',
  beneficiaryId = `beneficiary-${id}`,
): AirwallexPayoutAccount => createAirwallexPayoutAccount({
  id,
  creatorId,
  payoutAccountVersion: 'v2',
  nickname: `${transferMethod} synthetic account`,
  status: 'VERIFIED',
  beneficiaryId,
  beneficiaryEnvironment: 'MOCK',
  entityType: 'PERSONAL',
  firstName: 'Synthetic',
  lastName: 'Creator',
  address: {
    countryCode: 'US',
    streetAddress: '100 Example Street',
    city: 'New York',
    state: 'New York',
    postcode: '00101',
  },
  transferMethod,
  bankDetails: {
    bankCountryCode: 'US',
    bankCountryName: 'United States',
    accountCurrency: 'USD',
    accountName: 'Synthetic Creator',
    accountNumber: '000012340001',
    bankName: 'Synthetic Bank',
    bankStreetAddress: '200 Example Avenue',
    bankState: 'New York',
    swiftCode: transferMethod === 'SWIFT' ? 'SYNTHUS33' : '',
    intermediaryBankSwiftCode: transferMethod === 'SWIFT' ? 'INTERUS33' : '',
    localClearingSystem: transferMethod === 'LOCAL' ? 'ACH' : '',
  },
  validatedAt: '2026-08-06T00:00:00.000Z',
  verifiedAt: '2026-08-06T00:00:00.000Z',
});

const swiftAccount = account('account-swift', 'SWIFT');
const localAccount = account('account-local', 'LOCAL');

const creator: CreatorProfile = {
  id: creatorId,
  initials: 'SC',
  accent: '#64748b',
  name: 'Synthetic Creator',
  handle: '@synthetic',
  region: '美国',
  platform: 'YouTube',
  projects: 1,
  socialAccounts: [],
  contact: {
    legalName: 'Synthetic Creator',
    address: 'Synthetic address',
    phone: '+0 000 000 0000',
    email: 'synthetic@example.test',
  },
  payoutAccounts: [swiftAccount, localAccount],
};

const paymentItem = (
  invoiceNumber: string,
  payoutAccount: AirwallexPayoutAccount,
  feeBearer: 'ADVERTISER' | 'PUBLISHER' | 'SHARED',
) => ({
  id: `request-${invoiceNumber}`,
  engagementId: `engagement-${invoiceNumber}` as EngagementId,
  invoiceId: `invoice-${invoiceNumber}` as InvoiceId,
  snapshot: {
    invoiceNumber,
    creatorName: creator.name,
    currency: 'USD',
    receiveCurrency: 'USD',
    amount: 3400,
    provider: 'Airwallex',
    accountSummary: '•••• 0001',
    paymentReason: '影音服务',
    transactionReference: `${invoiceNumber} Seasonal Payment`,
    description: 'Synthetic campaign payment',
    creatorId,
    contractIds: [],
    payoutAccountId: payoutAccount.id,
    payoutAccountVersion: getPayoutAccountVersion(payoutAccount),
    externalBeneficiaryId: payoutAccount.beneficiaryId,
    transferMethod: payoutAccount.transferMethod,
    localClearingSystem: payoutAccount.bankDetails.localClearingSystem,
    feeBearer,
    accountFingerprint: getPayoutAccountFingerprint(payoutAccount),
    schemaKey: 'BANK_ACCOUNT:US:USD:PERSONAL',
    validationStatus: payoutAccount.status,
  },
  overrides: {},
  requiresRevalidation: false,
});

const paymentList = (items = [
  paymentItem('INV-SWIFT', swiftAccount, 'ADVERTISER'),
  paymentItem('INV-LOCAL', localAccount, 'PUBLISHER'),
]): PaymentListRecord => ({
  paymentListId: 'payment-list-workbook' as PaymentListRecord['paymentListId'],
  paymentListCode: 'PAY-20260806-TEST01',
  projectId,
  provider: 'Airwallex',
  status: 'generated',
  items,
  createdAt: '2026-08-06T00:00:00.000Z',
  updatedAt: '2026-08-06T00:00:00.000Z',
});

describe('Airwallex payment-list workbook', () => {
  it('maps SWIFT and LOCAL rows without inventing SWIFT values for LOCAL', () => {
    const rows = buildAirwallexPaymentListRows({ paymentList: paymentList(), creators: [creator] });
    expect(rows[0]).toMatchObject({
      paymentMethod: 'SWIFT 支付',
      swiftChargeOption: 'OUR',
      feePaidBy: '付款方',
      swiftCode: 'SYNTHUS33',
      intermediarySwiftCode: 'INTERUS33',
      postcode: '00101',
    });
    expect(rows[1]).toMatchObject({
      paymentMethod: '本地支付',
      swiftChargeOption: null,
      feePaidBy: '付款方',
      swiftCode: null,
      intermediarySwiftCode: null,
    });
  });

  it('reuses the Airwallex fee mapping for shared SWIFT fees', () => {
    const rows = buildAirwallexPaymentListRows({
      paymentList: paymentList([paymentItem('INV-SHARED', swiftAccount, 'SHARED')]),
      creators: [creator],
    });
    expect(rows[0]).toMatchObject({
      swiftChargeOption: 'SHA',
      feePaidBy: '付款方',
    });
  });

  it('exports the exact 21-column sheet with numeric amounts and text identifiers', async () => {
    const blob = await exportAirwallexPaymentListWorkbook({
      paymentList: paymentList(),
      creators: [creator],
    });
    const workbook = new Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const sheet = workbook.getWorksheet(AIRWALLEX_PAYMENT_LIST_SHEET)!;
    expect(workbook.worksheets).toHaveLength(1);
    expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual(AIRWALLEX_PAYMENT_LIST_HEADERS);
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getCell('E2').value).toBe(3400);
    expect(sheet.getCell('K2').value).toBe('000012340001');
    expect(sheet.getCell('K2').numFmt).toBe('@');
    expect(sheet.getCell('T2').value).toBe('00101');
    expect(sheet.getCell('U2').value).toBe('request-INV-SWIFT');
  });

  it('blocks export when the beneficiary ID is missing', () => {
    const missing = account('account-missing', 'SWIFT', '');
    const invalidCreator = { ...creator, payoutAccounts: [missing] };
    expect(() => buildAirwallexPaymentListRows({
      paymentList: paymentList([paymentItem('INV-MISSING', missing, 'ADVERTISER')]),
      creators: [invalidCreator],
    })).toThrow(PaymentListWorkbookError);
  });

  it('blocks export before a draft has been generated and locked', () => {
    expect(() => buildAirwallexPaymentListRows({
      paymentList: { ...paymentList(), status: 'draft' },
      creators: [creator],
    })).toThrow(PaymentListWorkbookError);
  });

  it('allows the approval view to export a submitted list with the same fixed template', async () => {
    expect(() => buildAirwallexPaymentListRows({
      paymentList: { ...paymentList(), status: 'submitted' },
      creators: [creator],
    })).toThrow(PaymentListWorkbookError);
    expect(buildAirwallexPaymentListRows({
      paymentList: { ...paymentList(), status: 'submitted' },
      creators: [creator],
      allowSubmitted: true,
    })).toHaveLength(2);

    const blob = await exportAirwallexPaymentListWorkbook({
      paymentList: { ...paymentList(), status: 'submitted' },
      creators: [creator],
      allowSubmitted: true,
    });
    const workbook = new Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const sheet = workbook.getWorksheet(AIRWALLEX_PAYMENT_LIST_SHEET)!;
    expect(workbook.worksheets).toHaveLength(1);
    expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual(AIRWALLEX_PAYMENT_LIST_HEADERS);
  });

  it('does not export a PayPal list with the Airwallex template', () => {
    expect(() => buildAirwallexPaymentListRows({
      paymentList: { ...paymentList(), provider: 'PayPal' },
      creators: [creator],
    })).toThrow(PaymentListWorkbookError);
  });

  it('exports a submitted PayPal list with its frozen PayPal account fields', async () => {
    const paypal = paymentList();
    paypal.provider = 'PayPal';
    paypal.status = 'submitted';
    paypal.items = [{
      ...paypal.items[0],
      snapshot: {
        ...paypal.items[0].snapshot,
        provider: 'PayPal',
        realName: 'Synthetic Creator',
        accountSummary: 'creator@example.test',
        transferMethod: 'PAYPAL',
        paymentDetails: {
          bankCountry: '', accountName: '', accountType: '', swiftCode: '', accountNumber: '',
          iban: '', beneficiaryType: 'Personal', bankName: '', bankStreetAddress: '', bankCity: '',
          bankState: '', bankPostalCode: '', intermediaryBankCountry: '', intermediaryBankCode: '',
          transferRemarks: '', paypalUsername: 'synthetic.creator', paypalEmail: 'creator@example.test',
          payoutProvider: 'PayPal', transferMethod: 'PAYPAL', verifiedAt: '2026-08-06T00:00:00.000Z',
        },
      },
    }];

    expect(buildPayPalPaymentListRows({ paymentList: paypal, allowSubmitted: true })[0]).toMatchObject({
      paypalName: 'synthetic.creator',
      paypalEmail: 'creator@example.test',
      amount: 3400,
    });
    const blob = await exportPayPalPaymentListWorkbook({ paymentList: paypal, allowSubmitted: true });
    const workbook = new Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const sheet = workbook.getWorksheet(PAYPAL_PAYMENT_LIST_SHEET)!;
    expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual(PAYPAL_PAYMENT_LIST_HEADERS);
    expect(sheet.getCell('D1').value).toBe('Real Name / Company Name');
    expect(sheet.getCell('F2').value).toBe('creator@example.test');
    expect(sheet.getCell('H2').value).toBe(3400);
  });

  it('blocks a non-Airwallex row override even when the project list targets Airwallex', () => {
    const source = paymentItem('INV-PAYPAL-OVERRIDE', swiftAccount, 'ADVERTISER');
    const overridden = {
      ...source,
      accountOverride: {
        provider: 'PayPal',
        accountSummary: '脱敏 PayPal 账户',
        receiveCurrency: 'USD',
        payoutAccountId: 'paypal-account-test',
        payoutAccountVersion: 'v1' as const,
        accountFingerprint: 'paypal-fingerprint-test',
        transferMethod: 'PAYPAL' as const,
        validationStatus: 'VERIFIED' as const,
      },
    };
    expect(() => buildAirwallexPaymentListRows({
      paymentList: paymentList([overridden]),
      creators: [creator],
    })).toThrow(PaymentListWorkbookError);
    expect(source.snapshot.provider).toBe('Airwallex');
  });

  it('exports from an Airwallex account override without changing the Invoice snapshot', () => {
    const source = paymentItem('INV-AWX-OVERRIDE', swiftAccount, 'ADVERTISER');
    const overridden = {
      ...source,
      accountOverride: {
        provider: 'Airwallex',
        accountSummary: '•••• 0002',
        receiveCurrency: 'USD',
        payoutAccountId: localAccount.id,
        payoutAccountVersion: getPayoutAccountVersion(localAccount),
        externalBeneficiaryId: localAccount.beneficiaryId,
        transferMethod: localAccount.transferMethod,
        localClearingSystem: localAccount.bankDetails.localClearingSystem,
        accountFingerprint: getPayoutAccountFingerprint(localAccount),
        schemaKey: 'BANK_ACCOUNT:US:USD:PERSONAL:LOCAL:ACH',
        validationStatus: localAccount.status,
      },
    };
    const rows = buildAirwallexPaymentListRows({
      paymentList: paymentList([overridden]),
      creators: [creator],
    });
    expect(rows[0]).toMatchObject({
      paymentMethod: '本地支付',
      accountNumber: localAccount.bankDetails.accountNumber,
    });
    expect(source.snapshot.payoutAccountId).toBe(swiftAccount.id);
  });

  it('uses a DRAFT prefix until the payment list is approved', () => {
    expect(paymentListWorkbookFilename('PRJ-TEST', paymentList())).toBe(
      'DRAFT-COMETS-PAY-PRJ-TEST-PAY-20260806-TEST01.xlsx',
    );
    expect(paymentListWorkbookFilename('PRJ-TEST', { ...paymentList(), status: 'approved' })).toBe(
      'COMETS-PAY-PRJ-TEST-PAY-20260806-TEST01.xlsx',
    );
    expect(paymentListWorkbookFilename('PRJ-TEST', { ...paymentList(), status: 'paid' })).toBe(
      'COMETS-PAY-PRJ-TEST-PAY-20260806-TEST01.xlsx',
    );
    expect(paymentListWorkbookFilename('PRJ-TEST', paymentList(), 'PayPal')).toBe(
      'DRAFT-COMETS-PAY-PRJ-TEST-PAY-20260806-TEST01-PAYPAL.xlsx',
    );
    expect(paymentListWorkbookFilename('PRJ-TEST', paymentList(), 'PayMax')).toBe(
      'DRAFT-COMETS-PAY-PRJ-TEST-PAY-20260806-TEST01-PAYER-MAX.xlsx',
    );
  });
});
