import { describe, expect, it } from 'vitest';
import {
  AIRWALLEX_SUPPLEMENTAL_FIELD_CATALOG,
  getAirwallexBankPaymentFallbackFields,
  getAirwallexSupplementalFields,
} from './airwallexSupplementalFields';
import type {
  AirwallexFormSchemaField,
  AirwallexFormSchemaResponse,
} from './airwallexFormSchema';

const schemaField = (
  path: string,
  key = path.split('.').slice(-1)[0] ?? path,
  enabled = true,
): AirwallexFormSchemaField => ({
  enabled,
  field: {
    key,
    label: key,
    type: 'INPUT',
    default: '',
    description: '',
    example: '',
    placeholder: '',
    refresh: false,
    tip: '',
  },
  path,
  required: true,
  rule: { type: 'string' },
});

const schema = (paths: string[]): AirwallexFormSchemaResponse => ({
  condition: {
    type: 'BANK_ACCOUNT',
    bank_country_code: 'US',
    account_currency: 'USD',
    transfer_method: 'LOCAL',
    local_clearing_system: 'ACH',
    entity_type: 'PERSONAL',
    country_code: 'US',
  },
  fields: paths.map((path) => schemaField(path)),
});

describe('Airwallex supplemental field difference', () => {
  it('does not repeat fields or semantic aliases already returned by Form Schema', () => {
    const fields = getAirwallexSupplementalFields(schema([
      'beneficiary.first_name',
      'beneficiary.bank_details.account_name',
      'beneficiary.bank_details.account_type',
      'beneficiary.additional_info.mobile_number',
    ]));
    const keys = fields.map((field) => field.key);

    expect(keys).not.toContain('legal_name');
    expect(keys).not.toContain('account_name');
    expect(keys).not.toContain('bank_account_type');
    expect(keys).not.toContain('phone');
  });

  it('recomputes the optional difference when payment fields change', () => {
    const before = getAirwallexSupplementalFields(schema([
      'beneficiary.bank_details.account_number',
    ]));
    const after = getAirwallexSupplementalFields(schema([
      'beneficiary.bank_details.iban',
    ]));

    expect(before.map((field) => field.key)).not.toContain('account_number');
    expect(before.map((field) => field.key)).toContain('iban');
    expect(after.map((field) => field.key)).toContain('account_number');
    expect(after.map((field) => field.key)).not.toContain('iban');
  });

  it('treats fixed hidden Schema values as covered instead of duplicating them', () => {
    const response = schema([]);
    response.fields = [
      schemaField(
        'beneficiary.bank_details.account_routing_type1',
        'account_routing_type1',
        false,
      ),
    ];

    expect(getAirwallexSupplementalFields(response).map((field) => field.key))
      .not.toContain('routing_code_type');
  });

  it('keeps the source catalog unique and optional by construction', () => {
    const keys = AIRWALLEX_SUPPLEMENTAL_FIELD_CATALOG.map((field) => field.key);
    const paths = AIRWALLEX_SUPPLEMENTAL_FIELD_CATALOG.map((field) => field.path);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(AIRWALLEX_SUPPLEMENTAL_FIELD_CATALOG.every((field) => (
      field.label.trim() && field.sourceLabel.trim() && field.placeholder.trim()
    ))).toBe(true);
  });

  it('adds only the missing Invoice bank-payment concepts', () => {
    const fields = getAirwallexBankPaymentFallbackFields(schema([
      'beneficiary.first_name',
      'beneficiary.bank_details.account_name',
      'beneficiary.bank_details.account_number',
      'beneficiary.bank_details.bank_name',
    ]));
    const keys = fields.map((field) => field.key);

    expect(keys).not.toContain('legal_name');
    expect(keys).not.toContain('account_name');
    expect(keys).not.toContain('account_number');
    expect(keys).not.toContain('bank_name');
    expect(keys).toEqual([
      'beneficiary_bank_address',
      'swift_code',
      'iban',
    ]);
    expect(fields.find((field) => field.key === 'beneficiary_bank_address')?.path)
      .toBe('profile_supplement.beneficiary_bank_address');
  });

  it('treats structured bank address fields as the bank-address concept', () => {
    const fields = getAirwallexBankPaymentFallbackFields(schema([
      'beneficiary.first_name',
      'beneficiary.bank_details.account_name',
      'beneficiary.bank_details.account_number',
      'beneficiary.bank_details.bank_name',
      'beneficiary.bank_details.bank_city',
      'beneficiary.bank_details.swift_code',
      'beneficiary.bank_details.iban',
    ]));

    expect(fields).toEqual([]);
  });

  it('does not duplicate IBAN when a SWIFT schema combines it with account number', () => {
    const response = schema([
      'beneficiary.bank_details.account_number',
    ]);
    response.fields[0].field.label = '银行账号 / IBAN';
    response.fields[0].field.description = '输入银行账号或 IBAN';

    expect(getAirwallexBankPaymentFallbackFields(response).map((field) => field.key))
      .not.toContain('iban');
  });
});
