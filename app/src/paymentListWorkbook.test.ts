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
  buildAirwallexPaymentListRows,
  exportAirwallexPaymentListWorkbook,
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
  });
});
