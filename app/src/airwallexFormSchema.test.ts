import { describe, expect, it } from 'vitest';
import {
  AIRWALLEX_LOCAL_CLEARING_SYSTEM_PATH,
  generateLocalAirwallexFormSchema,
  getAirwallexFormValue,
  getAirwallexSchemaGroup,
  prioritizeAirwallexLocalClearingOptions,
} from './airwallexFormSchema';
import { createEmptyAirwallexAccount } from './payoutAccounts';

describe('Airwallex payment scenario', () => {
  const enabledRequiredPaths = (account = createEmptyAirwallexAccount()) => (
    generateLocalAirwallexFormSchema(account).fields
      .filter((field) => field.enabled && field.required)
      .map((field) => field.path)
  );

  it('keeps recipient type inside the scenario that drives Form Schema', () => {
    expect(getAirwallexSchemaGroup('beneficiary.entity_type')).toBe('condition');
    expect(getAirwallexSchemaGroup('beneficiary.bank_details.account_number')).toBe('bank');
  });

  it('places the configured lower-cost local clearing system first', () => {
    const options = prioritizeAirwallexLocalClearingOptions('US', [
      { value: 'FEDWIRE', label: 'FEDWIRE' },
      { value: 'ACH', label: 'ACH' },
    ]);

    expect(options.map((option) => option.value)).toEqual(['ACH', 'FEDWIRE']);
    expect(options[0]).toMatchObject({
      label: 'ACH · 低费优先',
      description: expect.stringContaining('实际手续费以付款报价为准'),
    });
  });

  it('defaults a new local account to the first eligible clearing system', () => {
    const account = createEmptyAirwallexAccount();
    const schema = generateLocalAirwallexFormSchema(account);
    const clearingField = schema.fields.find(
      (field) => field.path === AIRWALLEX_LOCAL_CLEARING_SYSTEM_PATH,
    );

    expect(account.bankDetails.localClearingSystem).toBe('ACH');
    expect(clearingField).toMatchObject({
      enabled: true,
      required: true,
      field: {
        default: 'ACH',
      },
    });
  });

  it('always returns the four required bank-payment concepts inside Form Schema', () => {
    const usLocal = createEmptyAirwallexAccount();
    const esLocal = {
      ...createEmptyAirwallexAccount(),
      address: { ...createEmptyAirwallexAccount().address, countryCode: 'ES' },
      bankDetails: {
        ...createEmptyAirwallexAccount().bankDetails,
        bankCountryCode: 'ES',
        bankCountryName: 'Spain',
        accountCurrency: 'EUR',
        localClearingSystem: 'SEPA',
      },
    };

    expect(enabledRequiredPaths(usLocal)).toEqual(expect.arrayContaining([
      'beneficiary.bank_details.account_name',
      'beneficiary.bank_details.account_number',
      'beneficiary.bank_details.bank_name',
      'beneficiary.bank_details.bank_street_address',
    ]));
    expect(enabledRequiredPaths(esLocal)).toEqual(expect.arrayContaining([
      'beneficiary.bank_details.account_name',
      'beneficiary.bank_details.iban',
      'beneficiary.bank_details.bank_name',
      'beneficiary.bank_details.bank_street_address',
    ]));
  });

  it('refreshes scenario requirements while leaving non-Schema-required fields optional', () => {
    const local = createEmptyAirwallexAccount();
    const swift = {
      ...local,
      transferMethod: 'SWIFT' as const,
      bankDetails: { ...local.bankDetails, localClearingSystem: '' },
    };
    const localRequired = enabledRequiredPaths(local);
    const swiftSchema = generateLocalAirwallexFormSchema(swift);
    const swiftRequired = swiftSchema.fields
      .filter((field) => field.enabled && field.required)
      .map((field) => field.path);

    expect(localRequired).toContain(AIRWALLEX_LOCAL_CLEARING_SYSTEM_PATH);
    expect(localRequired).not.toContain('beneficiary.bank_details.swift_code');
    expect(swiftRequired).not.toContain(AIRWALLEX_LOCAL_CLEARING_SYSTEM_PATH);
    expect(swiftRequired).toContain('beneficiary.bank_details.swift_code');
    expect(swiftSchema.fields.find((field) => field.path === 'beneficiary.date_of_birth')?.required)
      .toBe(false);
    expect(swiftSchema.fields.find((field) => field.path === 'beneficiary.bank_details.bank_branch')?.required)
      .toBe(false);
  });

  it('reads a legacy supplemental bank address through the required Schema field', () => {
    const account = createEmptyAirwallexAccount();
    account.schemaValues['profile_supplement.beneficiary_bank_address'] = '1 Legacy Finance Street';

    expect(getAirwallexFormValue(
      account,
      'beneficiary.bank_details.bank_street_address',
    )).toBe('1 Legacy Finance Street');
  });
});
