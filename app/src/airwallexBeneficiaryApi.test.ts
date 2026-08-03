import { describe, expect, it, vi } from 'vitest';
import {
  AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH,
  AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH,
  AIRWALLEX_DYNAMIC_OPTIONS_PROXY_PATH,
  buildAirwallexBeneficiaryPayload,
  getAirwallexDynamicOptions,
  synchronizeAirwallexBeneficiary,
} from './airwallexBeneficiaryApi';
import {
  AIRWALLEX_FORM_SCHEMA_PROXY_PATH,
  generateLocalAirwallexFormSchema,
  type AirwallexFormSchemaField,
  type AirwallexFormSchemaResponse,
} from './airwallexFormSchema';
import { createAirwallexPayoutAccount } from './payoutAccounts';

const field = (
  path: string,
  label: string,
  required = true,
): AirwallexFormSchemaField => ({
  enabled: true,
  field: {
    key: path.split('.').slice(-1)[0] ?? path,
    label,
    type: 'INPUT',
    default: '',
    description: '',
    example: '',
    placeholder: '',
    refresh: false,
    tip: '',
  },
  path,
  required,
  rule: { type: 'string' },
});

const buildAccount = (beneficiaryId = '') => createAirwallexPayoutAccount({
  id: 'awx-test',
  nickname: 'USD 主账户',
  beneficiaryId,
  entityType: 'PERSONAL',
  firstName: 'Mina',
  lastName: 'Kato',
  address: {
    countryCode: 'US',
    state: 'New York',
  },
  transferMethod: 'LOCAL',
  bankDetails: {
    bankCountryCode: 'US',
    bankCountryName: 'United States',
    accountCurrency: 'USD',
    accountName: 'Mina Kato',
    accountNumber: '50001121',
    accountRoutingType1: 'aba',
    accountRoutingValue1: '021000021',
    localClearingSystem: 'ACH',
    bankName: 'Example Bank',
  },
});

const remoteSchema: AirwallexFormSchemaResponse = {
  condition: {
    type: 'BANK_ACCOUNT',
    bank_country_code: 'US',
    account_currency: 'USD',
    transfer_method: 'LOCAL',
    local_clearing_system: 'ACH',
    entity_type: 'PERSONAL',
  },
  fields: [
    field('beneficiary.entity_type', 'Recipient type'),
    field('beneficiary.first_name', 'First name'),
    field('beneficiary.last_name', 'Last name'),
    field('beneficiary.bank_details.bank_country_code', 'Country'),
    field('beneficiary.bank_details.account_currency', 'Currency'),
    field('beneficiary.bank_details.account_name', 'Account name'),
    field('beneficiary.bank_details.account_number', 'Account number'),
    field('beneficiary.bank_details.account_routing_type1', 'Routing type'),
    field('beneficiary.bank_details.account_routing_value1', 'Routing number'),
    field('beneficiary.bank_details.local_clearing_system', 'Clearing system'),
    field('beneficiary.address.country_code', 'Address country'),
    field('beneficiary.address.state', 'Current address', false),
  ],
};

const jsonResponse = (body: unknown, status = 200) => (
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
);

describe('Airwallex beneficiary integration', () => {
  it('removes hard-coded street, city and postcode fields from the local preview', () => {
    const schema = generateLocalAirwallexFormSchema(buildAccount());
    const paths = schema.fields.map((item) => item.path);
    expect(paths).not.toContain('beneficiary.address.street_address');
    expect(paths).not.toContain('beneficiary.address.city');
    expect(paths).not.toContain('beneficiary.address.postcode');
    expect(paths.slice(0, 4)).toEqual([
      'beneficiary.bank_details.bank_country_code',
      'beneficiary.bank_details.account_currency',
      'beneficiary.entity_type',
      'transfer_method',
    ]);
    expect(schema.fields.find((item) => item.path === 'beneficiary.address.state')).toMatchObject({
      required: false,
      field: { label: 'Current address' },
    });
  });

  it('maps schema values into the official beneficiary payload structure', () => {
    const payload = buildAirwallexBeneficiaryPayload(buildAccount(), remoteSchema);
    expect(payload).toMatchObject({
      nickname: 'USD 主账户',
      payer_entity_type: 'COMPANY',
      transfer_methods: ['LOCAL'],
      beneficiary: {
        type: 'BANK_ACCOUNT',
        entity_type: 'PERSONAL',
        first_name: 'Mina',
        last_name: 'Kato',
        address: {
          country_code: 'US',
          state: 'New York',
        },
        bank_details: {
          bank_country_code: 'US',
          account_currency: 'USD',
          account_name: 'Mina Kato',
          account_number: '50001121',
          account_routing_type1: 'aba',
          account_routing_value1: '021000021',
          local_clearing_system: 'ACH',
        },
      },
    });
  });

  it('queries dynamic financial-institution options through the fixed server proxy', async () => {
    const baseField = field('beneficiary.bank_details.swift_code', 'SWIFT / BIC');
    const dynamicField: AirwallexFormSchemaField = {
      ...baseField,
      field: {
        ...baseField.field,
        type: 'DYNAMIC_SELECT',
        dynamic_options: {
          query_url: '/api/v1/beneficiary_form_schemas/supported_financial_institutions',
          query_params: [
            {
              name: 'account_currency',
              value_of: 'beneficiary.bank_details.account_currency',
              required: true,
            },
            {
              name: 'bank_country_code',
              value_of: 'beneficiary.bank_details.bank_country_code',
              required: true,
            },
            { name: 'keyword', required: true, pattern: '^[0-9a-zA-Z]{3,}$' },
          ],
        },
      },
    };
    const request = vi.fn(async () => jsonResponse({
      financial_institutions: [
        { bank_name: 'Bank of Tokyo', swift_code: 'BOTKJPJT', bank_country_code: 'JP' },
      ],
    })) as unknown as typeof fetch;

    const options = await getAirwallexDynamicOptions(
      buildAccount(),
      dynamicField,
      'BOT',
      request,
    );

    expect(options).toEqual([
      { label: 'Bank of Tokyo · BOTKJPJT', value: 'BOTKJPJT', description: 'JP' },
    ]);
    expect(request).toHaveBeenCalledWith(
      AIRWALLEX_DYNAMIC_OPTIONS_PROXY_PATH,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          query_url: '/api/v1/beneficiary_form_schemas/supported_financial_institutions',
          query_params: {
            account_currency: 'USD',
            bank_country_code: 'US',
            keyword: 'BOT',
          },
          field_path: 'beneficiary.bank_details.swift_code',
        }),
      }),
    );
  });

  it('validates, creates and stores the returned beneficiary id', async () => {
    const requestMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === AIRWALLEX_FORM_SCHEMA_PROXY_PATH) return jsonResponse(remoteSchema);
      if (path === AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH) return new Response(null, { status: 200 });
      if (path === AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH) return jsonResponse({ id: 'bene-123' }, 201);
      return jsonResponse({ message: 'unexpected request' }, 500);
    });
    const request = requestMock as unknown as typeof fetch;

    const result = await synchronizeAirwallexBeneficiary(buildAccount(), {
      request,
      requestId: 'request-123',
      now: () => '2026-08-04T00:00:00.000Z',
    });

    expect(result.beneficiaryId).toBe('bene-123');
    expect(result.status).toBe('VALIDATED');
    expect(result.validatedAt).toBe('2026-08-04T00:00:00.000Z');
    expect(requestMock).toHaveBeenCalledTimes(3);
    expect(requestMock.mock.calls.map(([input]) => String(input))).toEqual([
      AIRWALLEX_FORM_SCHEMA_PROXY_PATH,
      AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH,
      AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH,
    ]);
  });

  it('updates an existing beneficiary instead of creating a duplicate', async () => {
    const requestMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === AIRWALLEX_FORM_SCHEMA_PROXY_PATH) return jsonResponse(remoteSchema);
      if (path === AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH) return new Response(null, { status: 200 });
      if (path.endsWith('/bene-existing')) return jsonResponse({ id: 'bene-existing' });
      return jsonResponse({ message: 'unexpected request' }, 500);
    });
    const request = requestMock as unknown as typeof fetch;

    const result = await synchronizeAirwallexBeneficiary(buildAccount('bene-existing'), {
      request,
      requestId: 'request-update',
    });

    expect(result.beneficiaryId).toBe('bene-existing');
    expect(requestMock.mock.calls.map(([input]) => String(input))).toContain(
      `${AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH}/bene-existing`,
    );
    expect(requestMock.mock.calls.map(([input]) => String(input))).not.toContain(
      AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH,
    );
  });

  it('stops before validate/create when the official schema reports missing data', async () => {
    const incompleteSchema: AirwallexFormSchemaResponse = {
      ...remoteSchema,
      fields: [...remoteSchema.fields, field('beneficiary.bank_details.swift_code', 'SWIFT / BIC')],
    };
    const request = vi.fn(async () => jsonResponse(incompleteSchema)) as unknown as typeof fetch;

    await expect(synchronizeAirwallexBeneficiary(buildAccount(), {
      request,
      requestId: 'request-invalid',
    })).rejects.toMatchObject({
      name: 'AirwallexIntegrationError',
      fieldIssues: [{ path: 'beneficiary.bank_details.swift_code' }],
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
