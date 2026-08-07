import { describe, expect, it } from 'vitest';
import {
  AIRWALLEX_LOCAL_CLEARING_SYSTEM_PATH,
  generateLocalAirwallexFormSchema,
  getAirwallexSchemaGroup,
  prioritizeAirwallexLocalClearingOptions,
} from './airwallexFormSchema';
import { createEmptyAirwallexAccount } from './payoutAccounts';

describe('Airwallex payment scenario', () => {
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
});
