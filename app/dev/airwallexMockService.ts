import {
  AIRWALLEX_FORM_SCHEMA_PROXY_PATH,
  generateLocalAirwallexFormSchema,
  getAirwallexCountryProfile,
  type AirwallexFormSchemaCondition,
} from '../src/airwallexFormSchema';
import {
  AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH,
  AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH,
  AIRWALLEX_DYNAMIC_OPTIONS_PROXY_PATH,
} from '../src/airwallexBeneficiaryApi';
import { createAirwallexPayoutAccount } from '../src/payoutAccounts';

export type AirwallexMockResult = {
  status: number;
  body: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const textValue = (record: Record<string, unknown>, key: string) => (
  typeof record[key] === 'string' ? record[key] as string : ''
);

const isCondition = (body: unknown): body is AirwallexFormSchemaCondition => {
  const condition = asRecord(body);
  return (
    condition.type === 'BANK_ACCOUNT'
    && /^[A-Z]{2}$/.test(textValue(condition, 'bank_country_code'))
    && /^[A-Z]{3}$/.test(textValue(condition, 'account_currency'))
    && ['LOCAL', 'SWIFT'].includes(textValue(condition, 'transfer_method'))
    && ['PERSONAL', 'COMPANY'].includes(textValue(condition, 'entity_type'))
  );
};

const schemaFor = (condition: AirwallexFormSchemaCondition) => {
  const country = getAirwallexCountryProfile(condition.bank_country_code);
  const account = createAirwallexPayoutAccount({
    id: 'airwallex-schema-mock',
    entityType: condition.entity_type,
    transferMethod: condition.transfer_method,
    address: { countryCode: condition.bank_country_code },
    bankDetails: {
      bankCountryCode: condition.bank_country_code,
      bankCountryName: country?.englishLabel ?? condition.bank_country_code,
      accountCurrency: condition.account_currency,
      localClearingSystem: condition.local_clearing_system ?? '',
    },
  });
  return {
    ...generateLocalAirwallexFormSchema(account),
    condition,
    meta: {
      source: 'mock' as const,
      simulated: true,
    },
  };
};

const institutions = [
  { bank_name: 'JPMorgan Chase Bank', bank_country_code: 'US', routing_value: '021000021', swift_code: 'CHASUS33' },
  { bank_name: 'Bank of America', bank_country_code: 'US', routing_value: '026009593', swift_code: 'BOFAUS3N' },
  { bank_name: 'MUFG Bank', bank_country_code: 'JP', routing_value: '0005', swift_code: 'BOTKJPJT' },
  { bank_name: 'DBS Bank', bank_country_code: 'SG', routing_value: '7171', swift_code: 'DBSSSGSG' },
  { bank_name: 'HSBC Hong Kong', bank_country_code: 'HK', routing_value: '004', swift_code: 'HSBCHKHH' },
];

const dynamicOptions = (body: unknown) => {
  const request = asRecord(body);
  const queryParams = asRecord(request.query_params);
  const keyword = textValue(queryParams, 'keyword').toLowerCase();
  const country = textValue(queryParams, 'bank_country_code');
  const fieldPath = textValue(request, 'field_path');
  const matches = institutions.filter((institution) => (
    (!country || institution.bank_country_code === country)
    && (!keyword || JSON.stringify(institution).toLowerCase().includes(keyword))
  ));

  return {
    financial_institutions: matches.map((institution) => ({
      ...institution,
      value: fieldPath.includes('swift')
        ? institution.swift_code
        : institution.routing_value,
    })),
    simulated: true,
  };
};

const stableId = (body: unknown) => {
  const text = JSON.stringify(body);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `sim_beneficiary_${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const handleAirwallexMockRequest = (
  path: string,
  body: unknown,
): AirwallexMockResult | null => {
  if (path === AIRWALLEX_FORM_SCHEMA_PROXY_PATH) {
    if (!isCondition(body)) {
      return {
        status: 400,
        body: { message: '模拟 Form Schema 请求缺少有效付款场景参数', simulated: true },
      };
    }
    return { status: 200, body: schemaFor(body) };
  }

  if (path === AIRWALLEX_DYNAMIC_OPTIONS_PROXY_PATH) {
    return { status: 200, body: dynamicOptions(body) };
  }

  if (path === AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH) {
    const request = asRecord(body);
    const beneficiary = asRecord(request.beneficiary);
    const bankDetails = asRecord(beneficiary.bank_details);
    if (beneficiary.type !== 'BANK_ACCOUNT' || Object.keys(bankDetails).length === 0) {
      return {
        status: 422,
        body: { message: '模拟 Beneficiary 校验失败：银行资料不完整', simulated: true },
      };
    }
    return { status: 200, body: { valid: true, simulated: true } };
  }

  if (
    path === AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH
    || path.startsWith(`${AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH}/`)
  ) {
    const existingId = path.slice(AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH.length + 1);
    return {
      status: 200,
      body: {
        id: existingId || stableId(body),
        simulated: true,
      },
    };
  }

  return null;
};
