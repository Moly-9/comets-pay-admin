import { describe, expect, it } from 'vitest';
import {
  clonePayoutAccounts,
  createEmptyAirwallexAccount,
  createEmptyPayMaxAccount,
  createEmptyPayPalAccount,
  getPayoutAccountForProvider,
  normalizePayMaxStatus,
  payoutAccountToInvoicePayment,
  shouldSynchronizeAirwallexAccount,
} from './payoutAccounts';
import { setAirwallexFormValue } from './airwallexFormSchema';

describe('creator payout channels', () => {
  it('creates independent Airwallex, PayPal and PayerMax account models', () => {
    const airwallex = createEmptyAirwallexAccount('Mina Kato', 'mina@example.com');
    const paypal = createEmptyPayPalAccount('Mina Kato', 'mina@example.com');
    const payermax = createEmptyPayMaxAccount('Mina Kato', 'mina@example.com');

    expect([airwallex.provider, paypal.provider, payermax.provider]).toEqual([
      'Airwallex',
      'PayPal',
      'PayMax',
    ]);
    expect(paypal).not.toHaveProperty('bankDetails');
    expect(payermax).not.toHaveProperty('bankDetails');
  });

  it('marks a complete PayerMax account ready without Airwallex synchronization', () => {
    const payermax = normalizePayMaxStatus({
      ...createEmptyPayMaxAccount(),
      beneficiaryName: 'Mina Kato',
      payermaxAccountId: 'pmx_10001',
      countryCode: 'JP',
      currency: 'JPY',
    });
    const paypal = createEmptyPayPalAccount('Mina Kato', 'mina@example.com');

    expect(payermax.status).toBe('READY_FOR_VALIDATION');
    expect(shouldSynchronizeAirwallexAccount(payermax)).toBe(false);
    expect(shouldSynchronizeAirwallexAccount(paypal)).toBe(false);
  });

  it('selects and clones channel-specific accounts without sharing nested Airwallex data', () => {
    const airwallex = createEmptyAirwallexAccount();
    const payermax = {
      ...createEmptyPayMaxAccount(),
      isDefault: true,
    };
    const accounts = [airwallex, payermax];
    const cloned = clonePayoutAccounts(accounts);

    expect(getPayoutAccountForProvider(accounts, 'PayMax')?.id).toBe(payermax.id);
    expect(cloned).not.toBe(accounts);
    expect(cloned[0]).not.toBe(airwallex);
    if (cloned[0].provider === 'Airwallex') {
      expect(cloned[0].bankDetails).not.toBe(airwallex.bankDetails);
    }
  });

  it('carries a supplemental bank address into the Invoice payment snapshot', () => {
    const account = setAirwallexFormValue(
      createEmptyAirwallexAccount(),
      'profile_supplement.beneficiary_bank_address',
      '1 Finance Street, Hong Kong',
    );

    expect(payoutAccountToInvoicePayment(account).bankStreetAddress)
      .toBe('1 Finance Street, Hong Kong');
  });
});
