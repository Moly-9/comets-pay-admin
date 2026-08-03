import {
  AIRWALLEX_FORM_SCHEMA_PROXY_PATH,
  AIRWALLEX_SCHEMA_API_VERSION,
  buildAirwallexSchemaCondition,
  getAirwallexFormValue,
  validateAirwallexFormSchema,
  type AirwallexFormSchemaField,
  type AirwallexFormSchemaOption,
  type AirwallexFormSchemaResponse,
  type AirwallexSchemaValidationIssue,
} from './airwallexFormSchema';
import type { AirwallexPayoutAccount } from './types';

export const AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH = '/api/integrations/airwallex/beneficiaries/validate';
export const AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH = '/api/integrations/airwallex/beneficiaries';
export const AIRWALLEX_DYNAMIC_OPTIONS_PROXY_PATH = '/api/integrations/airwallex/beneficiary-form-schema/options';

export type AirwallexBeneficiaryPayload = {
  beneficiary: Record<string, unknown>;
  nickname: string;
  payer_entity_type: 'COMPANY';
  transfer_methods: Array<AirwallexPayoutAccount['transferMethod']>;
};

export type AirwallexBeneficiaryResponse = {
  id: string;
};

export class AirwallexIntegrationError extends Error {
  status?: number;
  fieldIssues?: AirwallexSchemaValidationIssue[];

  constructor(
    message: string,
    options: { status?: number; fieldIssues?: AirwallexSchemaValidationIssue[] } = {},
  ) {
    super(message);
    this.name = 'AirwallexIntegrationError';
    this.status = options.status;
    this.fieldIssues = options.fieldIssues;
  }
}

const setNestedValue = (
  target: Record<string, unknown>,
  path: string,
  value: string,
) => {
  const segments = path.split('.');
  let current = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value;
      return;
    }
    const nested = current[segment];
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  });
};

const responseMessage = (
  status: number,
  body: unknown,
) => {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const message = record.message ?? record.detail ?? record.error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return `Airwallex 服务端代理请求失败（${status}）`;
};

const requestJson = async <T>(
  path: string,
  init: RequestInit,
  request: typeof fetch,
): Promise<T> => {
  const response = await request(path, init);
  const text = await response.text();
  let body: unknown;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (response.ok) {
        throw new AirwallexIntegrationError(
          'Airwallex 服务端代理未配置或返回了非 JSON 响应',
          { status: response.status },
        );
      }
    }
  }
  if (!response.ok) {
    throw new AirwallexIntegrationError(
      responseMessage(response.status, body),
      { status: response.status },
    );
  }
  return body as T;
};

const proxyHeaders = (requestId?: string): HeadersInit => ({
  'Content-Type': 'application/json',
  'x-airwallex-api-version': AIRWALLEX_SCHEMA_API_VERSION,
  ...(requestId ? { 'x-client-request-id': requestId } : {}),
});

const firstText = (
  record: Record<string, unknown>,
  keys: string[],
) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const dynamicOptionItems = (body: unknown): unknown[] => {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== 'object') return [];
  const record = body as Record<string, unknown>;
  for (const key of ['options', 'items', 'data', 'financial_institutions']) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
};

const normalizeDynamicOptions = (
  body: unknown,
  field: AirwallexFormSchemaField,
): AirwallexFormSchemaOption[] => {
  const valueKeys = field.path.includes('swift')
    ? ['swift_code', 'swift', 'bic', 'bank_identifier', 'value', 'id']
    : field.path.includes('routing')
      ? ['routing_value', 'routing_number', 'bank_identifier', 'bank_code', 'value', 'id']
      : ['value', 'id', 'bank_identifier', 'swift_code', 'routing_value'];
  const seen = new Set<string>();

  return dynamicOptionItems(body).flatMap<AirwallexFormSchemaOption>((item) => {
    if (typeof item === 'string') {
      const value = item.trim();
      if (!value || seen.has(value)) return [];
      seen.add(value);
      return [{ value, label: value }];
    }
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const value = firstText(record, valueKeys);
    if (!value || seen.has(value)) return [];
    seen.add(value);
    const name = firstText(record, ['label', 'name', 'bank_name', 'financial_institution_name']);
    const description = firstText(record, [
      'description',
      'bank_country_code',
      'bank_branch',
      'bank_address',
    ]);
    return [{
      value,
      label: name && name !== value ? `${name} · ${value}` : value,
      ...(description ? { description } : {}),
    }];
  });
};

export const getAirwallexBeneficiaryFormSchema = async (
  account: AirwallexPayoutAccount,
  request: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<AirwallexFormSchemaResponse> => {
  const schema = await requestJson<AirwallexFormSchemaResponse>(
    AIRWALLEX_FORM_SCHEMA_PROXY_PATH,
    {
      method: 'POST',
      headers: proxyHeaders(),
      body: JSON.stringify(buildAirwallexSchemaCondition(account)),
      signal,
    },
    request,
  );
  if (!schema || !Array.isArray(schema.fields) || !schema.condition) {
    throw new AirwallexIntegrationError('Airwallex Form Schema 响应结构无效');
  }
  return schema;
};

export const getAirwallexDynamicOptions = async (
  account: AirwallexPayoutAccount,
  field: AirwallexFormSchemaField,
  keyword: string,
  request: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<AirwallexFormSchemaOption[]> => {
  const dynamicOptions = field.field.dynamic_options;
  if (!dynamicOptions?.query_url || !dynamicOptions.query_params?.length) {
    throw new AirwallexIntegrationError('Airwallex Schema 未返回动态候选查询配置');
  }

  const queryParams = dynamicOptions.query_params.reduce<Record<string, string>>((params, item) => {
    const value = item.name === 'keyword'
      ? keyword.trim()
      : item.value_of
        ? getAirwallexFormValue(account, item.value_of).trim()
        : '';
    if (item.required && !value) {
      throw new AirwallexIntegrationError(`缺少动态候选查询参数：${item.name}`);
    }
    if (item.pattern && value) {
      try {
        if (!new RegExp(item.pattern).test(value)) {
          throw new AirwallexIntegrationError(`动态候选查询参数格式无效：${item.name}`);
        }
      } catch (error) {
        if (error instanceof AirwallexIntegrationError) throw error;
      }
    }
    if (value) params[item.name] = value;
    return params;
  }, {});

  const response = await requestJson<unknown>(
    AIRWALLEX_DYNAMIC_OPTIONS_PROXY_PATH,
    {
      method: 'POST',
      headers: proxyHeaders(),
      body: JSON.stringify({
        query_url: dynamicOptions.query_url,
        query_params: queryParams,
        field_path: field.path,
      }),
      signal,
    },
    request,
  );
  return normalizeDynamicOptions(response, field);
};

export const buildAirwallexBeneficiaryPayload = (
  account: AirwallexPayoutAccount,
  schema: AirwallexFormSchemaResponse,
): AirwallexBeneficiaryPayload => {
  const beneficiary: Record<string, unknown> = {
    type: 'BANK_ACCOUNT',
    address: {
      country_code: account.address.countryCode || account.bankDetails.bankCountryCode,
    },
  };

  schema.fields.forEach((item) => {
    if (!item.path.startsWith('beneficiary.')) return;
    const value = getAirwallexFormValue(account, item.path) || item.field.default;
    if (!value.trim()) return;
    setNestedValue({ beneficiary }, item.path, value);
  });

  return {
    beneficiary,
    nickname: account.nickname.trim(),
    payer_entity_type: 'COMPANY',
    transfer_methods: [account.transferMethod],
  };
};

export const validateAirwallexBeneficiary = async (
  payload: AirwallexBeneficiaryPayload,
  request: typeof fetch = fetch,
) => {
  await requestJson<unknown>(
    AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH,
    {
      method: 'POST',
      headers: proxyHeaders(),
      body: JSON.stringify(payload),
    },
    request,
  );
};

export const createAirwallexBeneficiary = async (
  payload: AirwallexBeneficiaryPayload,
  requestId: string,
  request: typeof fetch = fetch,
) => requestJson<AirwallexBeneficiaryResponse>(
  AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH,
  {
    method: 'POST',
    headers: proxyHeaders(requestId),
    body: JSON.stringify(payload),
  },
  request,
);

export const updateAirwallexBeneficiary = async (
  beneficiaryId: string,
  payload: AirwallexBeneficiaryPayload,
  requestId: string,
  request: typeof fetch = fetch,
) => requestJson<AirwallexBeneficiaryResponse>(
  `${AIRWALLEX_BENEFICIARY_CREATE_PROXY_PATH}/${encodeURIComponent(beneficiaryId)}`,
  {
    method: 'POST',
    headers: proxyHeaders(requestId),
    body: JSON.stringify(payload),
  },
  request,
);

export const synchronizeAirwallexBeneficiary = async (
  account: AirwallexPayoutAccount,
  {
    request = fetch,
    requestId = crypto.randomUUID(),
    now = () => new Date().toISOString(),
  }: {
    request?: typeof fetch;
    requestId?: string;
    now?: () => string;
  } = {},
): Promise<AirwallexPayoutAccount> => {
  const schema = await getAirwallexBeneficiaryFormSchema(account, request);
  const fieldIssues = validateAirwallexFormSchema(account, schema);
  if (fieldIssues.length) {
    throw new AirwallexIntegrationError(
      `Airwallex Schema 校验未通过：${fieldIssues.map((issue) => issue.message).join('、')}`,
      { fieldIssues },
    );
  }

  const payload = buildAirwallexBeneficiaryPayload(account, schema);
  await validateAirwallexBeneficiary(payload, request);
  const result = account.beneficiaryId
    ? await updateAirwallexBeneficiary(account.beneficiaryId, payload, requestId, request)
    : await createAirwallexBeneficiary(payload, requestId, request);
  if (!result?.id) {
    throw new AirwallexIntegrationError('Airwallex 未返回 beneficiary_id，档案未保存');
  }

  return {
    ...account,
    beneficiaryId: result.id,
    status: 'VALIDATED',
    validatedAt: now(),
    verificationCode: '',
    nameMatchResult: '',
    verifiedAt: '',
  };
};
