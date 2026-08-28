import { describe, expect, it } from 'vitest';
import type { DocumentPayoutSnapshot } from '../types';
import { invoicePayoutAccountPresentationRows } from './invoicePayoutAccountPresentation';

const snapshot = (overrides: Partial<DocumentPayoutSnapshot>): DocumentPayoutSnapshot => ({
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
  paypalUsername: '',
  paypalEmail: '',
  ...overrides,
});

describe('Invoice payout account presentation', () => {
  it('shows only PayPal-specific payment fields for PayPal', () => {
    const rows = invoicePayoutAccountPresentationRows({
      snapshot: snapshot({
        payoutProvider: 'PayPal',
        paypalUsername: 'Creator LLC',
        paypalEmail: 'creator@example.test',
        payoutAccountVersion: 'v1',
        validationStatus: 'VERIFIED',
      }),
      paymentMethod: 'paypal',
    });

    expect(rows).toContainEqual({ label: '付款渠道', value: 'PayPal' });
    expect(rows).toContainEqual({ label: 'PayPal Name', value: 'Creator LLC' });
    expect(rows).toContainEqual({ label: 'PayPal Email', value: 'creator@example.test' });
    expect(rows.map((row) => row.label)).not.toContain('Bank Name');
    expect(rows.map((row) => row.label)).not.toContain('SWIFT / BIC');
  });

  it('shows Airwallex bank, clearing and country fields', () => {
    const rows = invoicePayoutAccountPresentationRows({
      snapshot: snapshot({
        payoutProvider: 'Airwallex',
        transferMethod: 'LOCAL',
        localClearingSystem: 'ZENGIN',
        accountName: 'Creator LLC',
        accountNumber: '00001',
        bankName: 'Demo Bank',
        swiftCode: 'DEMOJP00',
        bankCountry: 'Japan',
        accountCurrency: 'JPY',
      }),
      paymentMethod: 'bank',
    });

    expect(rows).toContainEqual({ label: '付款渠道', value: 'Airwallex' });
    expect(rows).toContainEqual({ label: '付款方式', value: '本地银行转账（LOCAL）' });
    expect(rows).toContainEqual({ label: '本地清算方式', value: 'ZENGIN' });
    expect(rows).toContainEqual({ label: '国家 / 地区', value: 'Japan' });
    expect(rows.map((row) => row.label)).not.toContain('PayPal Email');
  });

  it('shows Payer Max account ID, country and currency fields', () => {
    const rows = invoicePayoutAccountPresentationRows({
      snapshot: snapshot({
        payoutProvider: 'PayMax',
        accountName: 'Creator LLC',
        accountNumber: 'payer-max-001',
        bankCountry: 'TH',
        accountCurrency: 'THB',
      }),
      paymentMethod: 'bank',
    });

    expect(rows).toContainEqual({ label: '付款渠道', value: 'Payer Max' });
    expect(rows).toContainEqual({ label: 'Payer Max Account ID', value: 'payer-max-001' });
    expect(rows).toContainEqual({ label: '国家 / 地区', value: 'TH' });
    expect(rows.map((row) => row.label)).not.toContain('Bank Name');
    expect(rows.map((row) => row.label)).not.toContain('PayPal Email');
  });
});
