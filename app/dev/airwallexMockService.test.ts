import { describe, expect, it } from 'vitest';
import {
  AIRWALLEX_FORM_SCHEMA_PROXY_PATH,
} from '../src/airwallexFormSchema';
import {
  AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH,
  AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH,
} from '../src/airwallexBeneficiaryApi';
import { handleAirwallexMockRequest } from './airwallexMockService';

const condition = {
  type: 'BANK_ACCOUNT' as const,
  bank_country_code: 'US',
  account_currency: 'USD',
  transfer_method: 'LOCAL' as const,
  local_clearing_system: 'ACH',
  entity_type: 'PERSONAL' as const,
};

describe('Airwallex local mock service', () => {
  it('returns a scenario-specific Form Schema marked as simulated', () => {
    const response = handleAirwallexMockRequest(
      AIRWALLEX_FORM_SCHEMA_PROXY_PATH,
      condition,
    );

    expect(response).toMatchObject({
      status: 200,
      body: {
        condition,
        meta: { source: 'mock', simulated: true },
      },
    });
    const fields = (response?.body as { fields: Array<{ path: string; required: boolean }> }).fields;
    expect(fields.map((field) => field.path)).toContain(
      'beneficiary.bank_details.local_clearing_system',
    );
    expect(fields.filter((field) => field.required).map((field) => field.path)).toEqual(
      expect.arrayContaining([
        'beneficiary.bank_details.account_name',
        'beneficiary.bank_details.account_number',
        'beneficiary.bank_details.bank_name',
        'beneficiary.bank_details.bank_street_address',
      ]),
    );
  });

  it('rejects invalid validation payloads', () => {
    expect(handleAirwallexMockRequest(
      AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH,
      { beneficiary: { type: 'BANK_ACCOUNT' } },
    )).toMatchObject({
      status: 422,
    });
  });

  it('returns a clearly simulated deterministic beneficiary id', () => {
    const payload = {
      beneficiary: {
        type: 'BANK_ACCOUNT',
        bank_details: { account_number: '50001121' },
      },
    };
    const first = handleAirwallexMockRequest(
      AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH,
      payload,
    );
    const second = handleAirwallexMockRequest(
      AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH,
      payload,
    );

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      status: 200,
      body: {
        id: expect.stringMatching(/^sim_beneficiary_/),
        simulated: true,
      },
    });
  });
});
