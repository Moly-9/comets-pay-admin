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
  type AirwallexFormSchemaField,
  type AirwallexFormSchemaResponse,
} from './airwallexFormSchema';
import { createAirwallexPayoutAccount } from './payoutAccounts';

const field = (
  path: string,
  required = true,
): AirwallexFormSchemaField => ({
  enabled: true,
  field: {
    key: path.split('.').slice(-1)[0] ?? path,
    label: path,
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

const account = () => createAirwallexPayoutAccount({
  id: 'awx-test',
  nickname: 'USD 主账户',
  entityType: 'PERSONAL',
  firstName: 'Mina',
  lastName: 'Kato',
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
    bankName: 'Sample Bank',
    bankStreetAddress: '1 Finance Street',
  },
  schemaValues: {
    'profile_supplement.trade_amount': '1000',
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
    country_code: 'US',
  },
  fields: [
    field('beneficiary.bank_details.bank_country_code'),
    field('beneficiary.bank_details.account_currency'),
    field('beneficiary.entity_type'),
    field('beneficiary.first_name'),
    field('beneficiary.last_name'),
    field('beneficiary.bank_details.account_name'),
    field('beneficiary.bank_details.account_number'),
    field('beneficiary.bank_details.bank_name'),
    field('beneficiary.bank_details.bank_street_address'),
    field('beneficiary.bank_details.account_routing_type1'),
    field('beneficiary.bank_details.account_routing_value1'),
    field('beneficiary.bank_details.local_clearing_system'),
  ],
};

const jsonResponse = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { 'Content-Type': 'application/json' } },
);

describe('Airwallex beneficiary proxy flow', () => {
  it('submits only fields returned by the active Form Schema', () => {
    const payload = buildAirwallexBeneficiaryPayload(account(), remoteSchema);

    expect(payload).toMatchObject({
      nickname: 'USD 主账户',
      transfer_methods: ['LOCAL'],
      beneficiary: {
        type: 'BANK_ACCOUNT',
        first_name: 'Mina',
        last_name: 'Kato',
        bank_details: {
          bank_country_code: 'US',
          account_currency: 'USD',
          account_number: '50001121',
          bank_name: 'Sample Bank',
          bank_street_address: '1 Finance Street',
        },
      },
    });
    expect(JSON.stringify(payload)).not.toContain('trade_amount');
  });

  it('queries dynamic financial-institution options through the fixed proxy', async () => {
    const dynamicField = {
      ...field('beneficiary.bank_details.swift_code'),
      field: {
        ...field('beneficiary.bank_details.swift_code').field,
        type: 'DYNAMIC_SELECT' as const,
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
        {
          bank_name: 'Bank of Tokyo',
          swift_code: 'BOTKJPJT',
          bank_country_code: 'JP',
        },
      ],
    })) as unknown as typeof fetch;

    await expect(getAirwallexDynamicOptions(
      account(),
      dynamicField,
      'BOT',
      request,
    )).resolves.toEqual([
      {
        label: 'Bank of Tokyo · BOTKJPJT',
        value: 'BOTKJPJT',
        description: 'JP',
      },
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

  it('loads Schema, validates, creates the beneficiary and stores beneficiary_id', async () => {
    const request = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === AIRWALLEX_FORM_SCHEMA_PROXY_PATH) return jsonResponse(remoteSchema);
      if (path === AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH) return jsonResponse({});
      if (path === AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH) {
        return jsonResponse({ id: 'beneficiary_123' });
      }
      return jsonResponse({ message: 'not found' }, 404);
    }) as unknown as typeof fetch;

    const result = await synchronizeAirwallexBeneficiary(account(), {
      request,
      requestId: 'request-123',
      now: () => '2026-08-04T00:00:00.000Z',
    });

    expect(result.beneficiaryId).toBe('beneficiary_123');
    expect(result.status).toBe('VALIDATED');
    expect(result.validatedAt).toBe('2026-08-04T00:00:00.000Z');
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('updates an existing beneficiary instead of creating a duplicate', async () => {
    const existingAccount = {
      ...account(),
      beneficiaryId: 'beneficiary_existing',
    };
    const updatePath = `${AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH}/beneficiary_existing`;
    const requestMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === AIRWALLEX_FORM_SCHEMA_PROXY_PATH) return jsonResponse(remoteSchema);
      if (path === AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH) return jsonResponse({});
      if (path === updatePath) return jsonResponse({ id: 'beneficiary_existing' });
      return jsonResponse({ message: 'not found' }, 404);
    });
    const request = requestMock as unknown as typeof fetch;

    const result = await synchronizeAirwallexBeneficiary(existingAccount, {
      request,
      requestId: 'request-update',
    });

    expect(result.beneficiaryId).toBe('beneficiary_existing');
    expect(requestMock.mock.calls.map(([input]) => String(input))).toContain(updatePath);
    expect(requestMock.mock.calls.map(([input]) => String(input))).not.toContain(
      AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH,
    );
  });

  it('does not create a beneficiary when Schema validation fails', async () => {
    const invalidSchema = {
      ...remoteSchema,
      fields: [...remoteSchema.fields, field('beneficiary.bank_details.swift_code')],
    };
    const request = vi.fn(async () => jsonResponse(invalidSchema)) as unknown as typeof fetch;

    await expect(synchronizeAirwallexBeneficiary(account(), {
      request,
      requestId: 'request-invalid',
    })).rejects.toMatchObject({
      name: 'AirwallexIntegrationError',
      fieldIssues: [{ path: 'beneficiary.bank_details.swift_code' }],
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not create a beneficiary when a required core payment field is missing', async () => {
    const request = vi.fn(async () => jsonResponse(remoteSchema)) as unknown as typeof fetch;
    const missingBankAddress = account();
    missingBankAddress.bankDetails.bankStreetAddress = '';

    await expect(synchronizeAirwallexBeneficiary(missingBankAddress, {
      request,
      requestId: 'request-missing-address',
    })).rejects.toMatchObject({
      name: 'AirwallexIntegrationError',
      fieldIssues: [{ path: 'beneficiary.bank_details.bank_street_address' }],
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
