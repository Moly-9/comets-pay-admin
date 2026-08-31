import { describe, expect, it } from 'vitest';
import type { ContractRecord } from '../contracts';
import type { ContractId, InvoiceId, ProjectId } from '../businessWorkflow';
import type { GeneratedInvoiceRecord, InvoiceDocumentModel } from '../types';
import {
  createInvoiceContractMatchReview,
  evaluateInvoiceContractMatch,
} from './invoiceContractMatching';

const payment = {
  bankCountry: 'US',
  accountName: 'Taylor Example',
  accountType: 'CHECKING',
  swiftCode: 'SYNTHETIC1',
  accountNumber: '0000000001',
  iban: '',
  beneficiaryType: 'PERSONAL',
  bankName: 'Prototype Bank',
  bankStreetAddress: '1 Test Street',
  bankCity: 'New York',
  bankState: 'NY',
  bankPostalCode: '10001',
  intermediaryBankCountry: '',
  intermediaryBankCode: '',
  transferRemarks: '',
  paypalUsername: '',
  paypalEmail: '',
  payoutAccountId: 'account-1',
  payoutAccountVersion: 'v2' as const,
  payoutProvider: 'Airwallex' as const,
  accountFingerprint: 'fingerprint-1',
  updatedAt: '2026-08-20T09:30:00.000Z',
  transferMethod: 'LOCAL' as const,
  localClearingSystem: 'ACH',
};

const model = (overrides: Partial<InvoiceDocumentModel> = {}): InvoiceDocumentModel => ({
  invoiceNumber: 'INV-20260820-00001',
  invoiceDate: '2026-08-20',
  billTo: { name: 'COMETS INTERNATIONAL LIMITED', address: 'Hong Kong' },
  creatorHandle: '@taylor',
  creatorName: 'Taylor Example',
  projectId: 'project-1' as ProjectId,
  projectName: 'Prototype project',
  from: { legalName: 'Taylor Example', address: 'Test address', phone: '000', email: 'taylor@example.com' },
  currency: 'USD',
  items: [{ id: 'line-1', description: 'Creator service', unitPrice: 500, quantity: 1, lineTotal: 500 }],
  payoutAccountId: 'account-1',
  payoutAccountVersion: 'v2',
  payoutProvider: 'Airwallex',
  payoutAccountFingerprint: 'fingerprint-1',
  paymentMethod: 'bank',
  payment,
  ...overrides,
});

const contract = (overrides: Partial<ContractRecord> = {}): ContractRecord => ({
  contractId: 'contract-1' as ContractId,
  id: 'CON-TEST-1',
  contractType: 'INDEPENDENT',
  projectLinks: [{ cooperationProjectId: 'project-1' as never, status: 'ACTIVE' }],
  ioId: '',
  name: 'Prototype contract',
  templateFamily: '',
  sourceName: '',
  documentUrl: '',
  isTemplate: false,
  project: 'Prototype project',
  brand: 'Prototype brand',
  advertiser: 'COMETS INTERNATIONAL LIMITED',
  publisher: 'Taylor Example',
  channelName: '@taylor',
  channelLink: '',
  platform: 'YouTube',
  effectiveDate: '2026-08-01',
  campaignStart: '2026-08-01',
  campaignEnd: '2026-08-31',
  currency: 'USD',
  totalFee: 500,
  licensePrice: null,
  licenseIncludedInTotal: null,
  invoiceWithinWorkingDays: null,
  paymentWithinWorkingDays: null,
  feeBearer: 'ADVERTISER',
  paymentMethod: 'BANK',
  accountName: 'Taylor Example',
  accountFingerprint: 'fingerprint-1',
  payoutAccountId: 'account-1',
  payoutAccountVersion: 'v2',
  payoutProvider: 'Airwallex',
  payoutAccountFingerprint: 'fingerprint-1',
  paymentSnapshot: payment,
  signed: true,
  status: '已生效',
  updated: '2026-08-01',
  deliverables: [],
  issues: [],
  lifecycle: 'CONFIRMED',
  ...overrides,
});

describe('Invoice contract matching', () => {
  it('treats an Invoice without contracts as not applicable', () => {
    const result = evaluateInvoiceContractMatch([], model());
    expect(result.result).toBe('NOT_APPLICABLE');
    expect(result.canProceed).toBe(true);
    expect(result.checks.every((check) => check.state === 'NOT_APPLICABLE')).toBe(true);
  });

  it('normalizes casing and repeated spaces for both legal entities', () => {
    const result = evaluateInvoiceContractMatch([
      contract({ publisher: '  TAYLOR   EXAMPLE ', advertiser: 'comets international limited' }),
    ], model());
    expect(result.blockerIssues).toEqual([]);
    expect(result.result).toBe('MATCHED');
  });

  it('hard-blocks missing or mismatched Publisher and Advertiser', () => {
    const result = evaluateInvoiceContractMatch([
      contract({ publisher: '', advertiser: 'Different Company' }),
    ], model());
    expect(result.result).toBe('BLOCKED');
    expect(result.blockerIssues.map((issue) => issue.field)).toEqual(['PUBLISHER', 'ADVERTISER']);
    expect(result.canProceed).toBe(false);
  });

  it('requires one reason for combined amount, currency and bank-account differences', () => {
    const mismatched = contract({
      currency: 'EUR',
      totalFee: 480,
      payoutAccountId: 'account-2',
      paymentSnapshot: {
        ...payment,
        payoutAccountId: 'account-2',
        accountNumber: '0000000002',
        updatedAt: '2026-08-01T08:00:00.000Z',
      },
    });
    const unresolved = evaluateInvoiceContractMatch([mismatched], model());
    expect(unresolved.reasonRequiredIssues.map((issue) => issue.field)).toEqual([
      'AMOUNT',
      'CURRENCY',
      'PAYMENT_ACCOUNT',
    ]);
    expect(unresolved.result).toBe('REASON_REQUIRED');
    const accountIssue = unresolved.reasonRequiredIssues.find((issue) => issue.field === 'PAYMENT_ACCOUNT');
    expect(accountIssue?.message).toBe('付款账户信息存在差异。');
    expect(accountIssue?.message).not.toContain('CON-TEST-1');
    expect(accountIssue?.paymentAccountDifference).toEqual({
      fieldLabels: ['Account Number'],
      technicalMetadataOnly: false,
      contractAccounts: [{
        contractReference: 'CON-TEST-1',
        updatedAt: '2026-08-01T08:00:00.000Z',
      }],
      invoiceAccountUpdatedAt: '2026-08-20T09:30:00.000Z',
    });

    const approved = evaluateInvoiceContractMatch([mismatched], model(), '合同为预算金额，Invoice 按本次实际交付结算。');
    expect(approved.result).toBe('APPROVED_WITH_REASON');
    expect(approved.canProceed).toBe(true);
  });

  it('keeps technical account identity matching without exposing raw metadata as payment fields', () => {
    const result = evaluateInvoiceContractMatch([
      contract({
        payoutAccountId: 'account-2',
        paymentSnapshot: {
          ...payment,
          payoutAccountId: 'account-2',
          updatedAt: undefined,
          verifiedAt: '2026-08-01 10:31',
        },
      }),
    ], model());
    const accountIssue = result.reasonRequiredIssues.find((issue) => issue.field === 'PAYMENT_ACCOUNT');

    expect(accountIssue?.message).toBe('账户记录版本不同，付款信息字段一致。');
    expect(accountIssue?.paymentAccountDifference).toMatchObject({
      fieldLabels: [],
      technicalMetadataOnly: true,
      contractAccounts: [{ updatedAt: '2026-08-01 10:31' }],
    });
  });

  it('sums populated contracts while leaving blank framework fields not applicable', () => {
    const result = evaluateInvoiceContractMatch([
      contract({ contractId: 'contract-a' as ContractId, totalFee: 200 }),
      contract({ contractId: 'contract-b' as ContractId, totalFee: 300 }),
      contract({
        contractId: 'contract-framework' as ContractId,
        contractType: 'FRAMEWORK',
        totalFee: null,
        currency: '',
        paymentMethod: '',
        accountName: '',
        payoutAccountId: undefined,
        payoutAccountVersion: undefined,
        payoutAccountFingerprint: undefined,
        paymentSnapshot: undefined,
      }),
    ], model());
    expect(result.issues).toEqual([]);
    expect(result.result).toBe('MATCHED');
  });

  it('matches PayPal identity fields and saves the per-version reason audit', () => {
    const paypalModel = model({
      payoutAccountId: 'paypal-1',
      payoutProvider: 'PayPal',
      paymentMethod: 'paypal',
      payment: {
        ...payment,
        accountName: '',
        accountNumber: '',
        payoutAccountId: 'paypal-1',
        payoutProvider: 'PayPal',
        paypalUsername: 'Taylor Example',
        paypalEmail: 'taylor.paypal@example.com',
      },
    });
    const paypalContract = contract({
      paymentMethod: 'PAYPAL',
      payoutAccountId: 'paypal-1',
      payoutProvider: 'PayPal',
      paymentSnapshot: {
        ...payment,
        accountName: '',
        accountNumber: '',
        payoutAccountId: 'paypal-1',
        payoutProvider: 'PayPal',
        paypalUsername: 'Taylor Example',
        paypalEmail: 'different@example.com',
      },
    });
    const review = createInvoiceContractMatchReview({
      contracts: [paypalContract],
      model: paypalModel,
      version: 2,
      reason: '达人本次指定使用新的 PayPal 邮箱。',
      actor: { account: 'media-1', name: '媒介测试', role: '媒介账号' },
      reviewedAt: '2026-08-20T10:00:00.000Z',
    });
    expect(review).toMatchObject({
      version: 2,
      result: 'APPROVED_WITH_REASON',
      reason: '达人本次指定使用新的 PayPal 邮箱。',
      actorAccount: 'media-1',
    });
  });
});

const _recordTypeGuard: Pick<GeneratedInvoiceRecord, 'invoiceId'> = {
  invoiceId: 'invoice-test' as InvoiceId,
};
void _recordTypeGuard;
