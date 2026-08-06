import type {
  AirwallexEntityType,
  AirwallexPayoutAccount,
  AirwallexTransferMethod,
} from './types';

export const AIRWALLEX_FORM_SCHEMA_API_PATH = '/api/v1/beneficiary_form_schemas/generate';
export const AIRWALLEX_FORM_SCHEMA_PROXY_PATH = '/api/integrations/airwallex/beneficiary-form-schema';
export const AIRWALLEX_SCHEMA_API_VERSION = '2024-09-27';

export type AirwallexFormFieldType =
  | 'INPUT'
  | 'SELECT'
  | 'DYNAMIC_SELECT'
  | 'RADIO'
  | 'TRANSFER_METHOD';

export type AirwallexFormSchemaOption = {
  label: string;
  value: string;
  description?: string;
};

export type AirwallexDynamicOptionQueryParam = {
  name: string;
  value_of?: string;
  required: boolean;
  pattern?: string;
};

export type AirwallexFormSchemaField = {
  enabled: boolean;
  field: {
    key: string;
    label: string;
    type: AirwallexFormFieldType;
    default: string;
    description: string;
    example: string;
    placeholder: string;
    refresh: boolean;
    tip: string;
    options?: AirwallexFormSchemaOption[];
    dynamic_options?: {
      query_url: string;
      query_params: AirwallexDynamicOptionQueryParam[];
    };
  };
  path: string;
  required: boolean;
  rule: {
    type: 'string' | 'number' | 'boolean';
    pattern?: string;
  };
};

export type AirwallexFormSchemaCondition = {
  type: 'BANK_ACCOUNT';
  bank_country_code: string;
  account_currency: string;
  transfer_method: AirwallexTransferMethod;
  local_clearing_system?: string;
  entity_type: AirwallexEntityType;
  country_code: string;
};

export type AirwallexFormSchemaResponse = {
  condition: AirwallexFormSchemaCondition;
  fields: AirwallexFormSchemaField[];
  meta?: {
    source: 'airwallex' | 'mock' | 'local';
    simulated?: boolean;
  };
};

type CountryProfile = {
  value: string;
  label: string;
  englishLabel: string;
  currencies: string[];
  localClearingSystems: string[];
  routingTypes: string[];
  ibanPreferred?: boolean;
  stateRequired?: boolean;
};

/**
 * 仅供无 Airwallex 凭证的前端原型选择条件。
 * 生产环境的可选国家、币种、清算网络和校验规则必须由 Form Schema API 返回。
 */
export const AIRWALLEX_SCHEMA_COUNTRIES: CountryProfile[] = [
  { value: 'US', label: '美国', englishLabel: 'United States', currencies: ['USD'], localClearingSystems: ['ACH', 'FEDWIRE'], routingTypes: ['aba'], stateRequired: true },
  { value: 'GB', label: '英国', englishLabel: 'United Kingdom', currencies: ['GBP'], localClearingSystems: ['FPS', 'CHAPS'], routingTypes: ['sort_code'] },
  { value: 'ES', label: '西班牙', englishLabel: 'Spain', currencies: ['EUR'], localClearingSystems: ['SEPA'], routingTypes: [], ibanPreferred: true },
  { value: 'FR', label: '法国', englishLabel: 'France', currencies: ['EUR'], localClearingSystems: ['SEPA'], routingTypes: [], ibanPreferred: true },
  { value: 'IT', label: '意大利', englishLabel: 'Italy', currencies: ['EUR'], localClearingSystems: ['SEPA'], routingTypes: [], ibanPreferred: true },
  { value: 'JP', label: '日本', englishLabel: 'Japan', currencies: ['JPY'], localClearingSystems: ['ZENGIN'], routingTypes: ['bank_code', 'branch_code'] },
  { value: 'HK', label: '中国香港', englishLabel: 'Hong Kong SAR China', currencies: ['HKD', 'USD', 'CNY'], localClearingSystems: ['FPS', 'ACH'], routingTypes: ['bank_code', 'branch_code'] },
  { value: 'SG', label: '新加坡', englishLabel: 'Singapore', currencies: ['SGD'], localClearingSystems: ['FAST', 'GIRO'], routingTypes: ['bank_code', 'branch_code'] },
  { value: 'TH', label: '泰国', englishLabel: 'Thailand', currencies: ['THB'], localClearingSystems: ['PromptPay', 'BAHTNET'], routingTypes: ['bank_code'] },
  { value: 'KR', label: '韩国', englishLabel: 'South Korea', currencies: ['KRW'], localClearingSystems: ['HOFINET'], routingTypes: ['bank_code'] },
  { value: 'AU', label: '澳大利亚', englishLabel: 'Australia', currencies: ['AUD'], localClearingSystems: ['NPP', 'BANK_TRANSFER'], routingTypes: ['bsb'], stateRequired: true },
  { value: 'BR', label: '巴西', englishLabel: 'Brazil', currencies: ['BRL'], localClearingSystems: ['PIX'], routingTypes: ['bank_code', 'branch_code'] },
  { value: 'MX', label: '墨西哥', englishLabel: 'Mexico', currencies: ['MXN'], localClearingSystems: ['SPEI'], routingTypes: ['clabe'] },
];

export const AIRWALLEX_SCHEMA_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'HKD',
  'CNY',
  'JPY',
  'SGD',
  'THB',
  'KRW',
  'AUD',
  'BRL',
  'MXN',
] as const;

export const AIRWALLEX_ENTITY_OPTIONS: AirwallexFormSchemaOption[] = [
  { value: 'PERSONAL', label: '个人 · PERSONAL', description: '以个人名义持有银行账户' },
  { value: 'COMPANY', label: '企业 · COMPANY', description: '以公司或机构名义持有银行账户' },
];

export const AIRWALLEX_TRANSFER_METHOD_OPTIONS: AirwallexFormSchemaOption[] = [
  { value: 'LOCAL', label: '本地转账 · LOCAL', description: '使用本地清算网络，通常更快且费用更低' },
  { value: 'SWIFT', label: '国际电汇 · SWIFT', description: '用于跨境电汇或本地网络未覆盖的场景' },
];

const countryOptions = AIRWALLEX_SCHEMA_COUNTRIES.map((country) => ({
  value: country.value,
  label: `${country.label} · ${country.value}`,
  description: country.englishLabel,
}));

const currencyOptions = AIRWALLEX_SCHEMA_CURRENCIES.map((currency) => ({
  value: currency,
  label: currency,
}));

const makeField = ({
  key,
  path,
  label,
  type = 'INPUT',
  required = false,
  enabled = true,
  refresh = false,
  defaultValue = '',
  description = '',
  example = '',
  placeholder = '',
  tip = '',
  pattern,
  options,
  dynamicOptions,
}: {
  key: string;
  path: string;
  label: string;
  type?: AirwallexFormFieldType;
  required?: boolean;
  enabled?: boolean;
  refresh?: boolean;
  defaultValue?: string;
  description?: string;
  example?: string;
  placeholder?: string;
  tip?: string;
  pattern?: string;
  options?: AirwallexFormSchemaOption[];
  dynamicOptions?: AirwallexFormSchemaField['field']['dynamic_options'];
}): AirwallexFormSchemaField => ({
  enabled,
  field: {
    key,
    label,
    type,
    default: defaultValue,
    description,
    example,
    placeholder,
    refresh,
    tip,
    ...(options ? { options } : {}),
    ...(dynamicOptions ? { dynamic_options: dynamicOptions } : {}),
  },
  path,
  required,
  rule: {
    type: 'string',
    ...(pattern ? { pattern } : {}),
  },
});

export const getAirwallexCountryProfile = (countryCode: string) => (
  AIRWALLEX_SCHEMA_COUNTRIES.find((country) => country.value === countryCode)
);

export const AIRWALLEX_LOCAL_CLEARING_SYSTEM_PATH =
  'beneficiary.bank_details.local_clearing_system';

/**
 * Form Schema only provides eligible clearing systems, not a payable fee quote.
 * The local prototype keeps a typical low-cost network first in each country
 * profile and annotates that option without presenting it as a guaranteed fee.
 */
export const prioritizeAirwallexLocalClearingOptions = (
  countryCode: string,
  options: AirwallexFormSchemaOption[],
): AirwallexFormSchemaOption[] => {
  const preferredOrder = getAirwallexCountryProfile(countryCode)?.localClearingSystems ?? [];
  const orderByValue = new Map(preferredOrder.map((value, index) => [value, index]));
  const recommendedValue = preferredOrder[0];

  return options
    .map((option, index) => ({
      option,
      index,
      priority: orderByValue.get(option.value) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ option }) => {
      if (!recommendedValue || option.value !== recommendedValue) return option;
      return {
        ...option,
        label: `${option.label.replace(/\s*·\s*低费优先$/, '')} · 低费优先`,
        description: '本地成本顺序推荐；实际手续费以付款报价为准',
      };
    });
};

export const buildAirwallexSchemaCondition = (
  account: AirwallexPayoutAccount,
): AirwallexFormSchemaCondition => ({
  type: 'BANK_ACCOUNT',
  bank_country_code: account.bankDetails.bankCountryCode,
  account_currency: account.bankDetails.accountCurrency,
  transfer_method: account.transferMethod,
  ...(account.transferMethod === 'LOCAL' && account.bankDetails.localClearingSystem
    ? { local_clearing_system: account.bankDetails.localClearingSystem }
    : {}),
  entity_type: account.entityType,
  country_code: account.address.countryCode,
});

export const getAirwallexSchemaConditionKey = (account: AirwallexPayoutAccount) => {
  const condition = buildAirwallexSchemaCondition(account);
  return [
    condition.type,
    condition.bank_country_code,
    condition.account_currency,
    condition.transfer_method,
    condition.local_clearing_system ?? '',
    condition.entity_type,
    condition.country_code,
  ].join('|');
};

const buildConditionFields = (
  account: AirwallexPayoutAccount,
  country: CountryProfile | undefined,
): AirwallexFormSchemaField[] => [
  makeField({
    key: 'entity_type',
    path: 'beneficiary.entity_type',
    label: '收款主体类型',
    type: 'RADIO',
    required: true,
    refresh: true,
    defaultValue: 'PERSONAL',
    options: AIRWALLEX_ENTITY_OPTIONS,
    pattern: '^(COMPANY|PERSONAL)$',
  }),
  makeField({
    key: 'bank_country_code',
    path: 'beneficiary.bank_details.bank_country_code',
    label: '银行国家 / 地区',
    type: 'SELECT',
    required: true,
    refresh: true,
    options: countryOptions,
    pattern: '^[A-Z]{2}$',
  }),
  makeField({
    key: 'account_currency',
    path: 'beneficiary.bank_details.account_currency',
    label: '账户币种',
    type: 'SELECT',
    required: true,
    refresh: true,
    options: currencyOptions,
    pattern: '^[A-Z]{3}$',
  }),
  makeField({
    key: 'transfer_method',
    path: 'transfer_method',
    label: '转账方式',
    type: 'TRANSFER_METHOD',
    required: true,
    refresh: true,
    defaultValue: 'LOCAL',
    options: AIRWALLEX_TRANSFER_METHOD_OPTIONS,
    pattern: '^(LOCAL|SWIFT)$',
  }),
  makeField({
    key: 'local_clearing_system',
    path: AIRWALLEX_LOCAL_CLEARING_SYSTEM_PATH,
    label: '本地清算方式',
    type: 'SELECT',
    required: account.transferMethod === 'LOCAL',
    enabled: account.transferMethod === 'LOCAL',
    refresh: true,
    defaultValue: country?.localClearingSystems[0] ?? '',
    options: (country?.localClearingSystems ?? []).map((value) => ({ value, label: value })),
    pattern: country?.localClearingSystems.length
      ? `^(${country.localClearingSystems.join('|')})$`
      : undefined,
  }),
  makeField({
    key: 'country_code',
    path: 'beneficiary.address.country_code',
    label: '收款人地址国家 / 地区',
    type: 'SELECT',
    required: true,
    refresh: true,
    options: countryOptions,
    pattern: '^[A-Z]{2}$',
  }),
];

const buildIdentityFields = (account: AirwallexPayoutAccount): AirwallexFormSchemaField[] => (
  account.entityType === 'PERSONAL'
    ? [
      makeField({
        key: 'first_name',
        path: 'beneficiary.first_name',
        label: '法定名',
        required: true,
        description: '需与银行账户登记的收款人姓名一致',
        example: 'Mina',
        pattern: '^.{1,50}$',
      }),
      makeField({
        key: 'last_name',
        path: 'beneficiary.last_name',
        label: '法定姓',
        required: true,
        description: '需与银行账户登记的收款人姓名一致',
        example: 'Kato',
        pattern: '^.{1,50}$',
      }),
      makeField({
        key: 'date_of_birth',
        path: 'beneficiary.date_of_birth',
        label: '出生日期',
        description: '仅在当前付款场景的 Schema 要求时采集',
        example: '1992-08-16',
        placeholder: 'YYYY-MM-DD',
        pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
      }),
    ]
    : [
      makeField({
        key: 'company_name',
        path: 'beneficiary.company_name',
        label: '公司法定名称',
        required: true,
        description: '需与银行账户登记的企业名称一致',
        example: 'Muse Creator Studio Limited',
        pattern: '^.{1,200}$',
      }),
    ]
);

const buildAddressFields = (
  country: CountryProfile | undefined,
): AirwallexFormSchemaField[] => [
  makeField({
    key: 'street_address',
    path: 'beneficiary.address.street_address',
    label: '街道地址',
    required: true,
    example: '2-7-1 Marunouchi',
    pattern: '^.{1,200}$',
  }),
  makeField({
    key: 'city',
    path: 'beneficiary.address.city',
    label: '城市',
    required: true,
    example: 'Tokyo',
    pattern: '^.{1,100}$',
  }),
  makeField({
    key: 'state',
    path: 'beneficiary.address.state',
    label: '州 / 省',
    required: Boolean(country?.stateRequired),
    example: 'Tokyo',
    pattern: '^.{1,100}$',
  }),
  makeField({
    key: 'postcode',
    path: 'beneficiary.address.postcode',
    label: '邮政编码',
    required: true,
    example: '100-8388',
    pattern: '^.{1,50}$',
  }),
  makeField({
    key: 'personal_email',
    path: 'beneficiary.additional_info.personal_email',
    label: '收款通知邮箱',
    description: '用于付款通知；仅在 Schema 返回该字段时提交给 Airwallex',
    example: 'creator@example.com',
    pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
  }),
];

const supportedBankDynamicOptions: AirwallexFormSchemaField['field']['dynamic_options'] = {
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
    {
      name: 'keyword',
      required: true,
      pattern: '^[0-9a-zA-Z]{3,}$',
    },
  ],
};

const buildLocalBankFields = (
  country: CountryProfile | undefined,
): AirwallexFormSchemaField[] => {
  if (country?.ibanPreferred) {
    return [
      makeField({
        key: 'iban',
        path: 'beneficiary.bank_details.iban',
        label: 'IBAN',
        required: true,
        description: '请输入不含空格的国际银行账号',
        example: 'ES8023100001180000012345',
        pattern: '^[A-Z]{2}[0-9A-Z]{13,32}$',
      }),
      makeField({
        key: 'bank_name',
        path: 'beneficiary.bank_details.bank_name',
        label: '银行名称',
        required: true,
        description: '部分地区可由 IBAN 自动识别',
        example: 'Banco Bilbao Vizcaya Argentaria',
        pattern: '^.{1,200}$',
      }),
    ];
  }

  const routingFields = (country?.routingTypes ?? []).flatMap((routingType, index) => {
    const suffix = index + 1;
    const isUsAba = country?.value === 'US' && routingType === 'aba';
    const routingPatterns: Record<string, string> = {
      aba: '^[0-9]{9}$',
      sort_code: '^[0-9]{6}$',
      bsb: '^[0-9]{6}$',
      bank_code: '^[0-9A-Za-z]{3,12}$',
      branch_code: '^[0-9A-Za-z]{2,12}$',
      clabe: '^[0-9]{18}$',
    };
    const routingLabels: Record<string, string> = {
      aba: 'ACH routing number',
      sort_code: 'Sort code',
      bsb: 'BSB',
      bank_code: '银行代码',
      branch_code: '分行代码',
      clabe: 'CLABE',
    };
    return [
      makeField({
        key: `account_routing_type${suffix}`,
        path: `beneficiary.bank_details.account_routing_type${suffix}`,
        label: `路由代码类型 ${suffix}`,
        required: true,
        enabled: false,
        defaultValue: routingType,
        pattern: `^${routingType}$`,
      }),
      makeField({
        key: `account_routing_value${suffix}`,
        path: `beneficiary.bank_details.account_routing_value${suffix}`,
        label: routingLabels[routingType] ?? `路由代码 ${suffix}`,
        type: isUsAba ? 'DYNAMIC_SELECT' : 'INPUT',
        required: true,
        description: isUsAba
          ? '输入至少 3 个字符后，通过 Airwallex 支持银行接口检索'
          : '格式与必填规则由当前 Form Schema 返回',
        example: isUsAba ? '021000021' : '',
        pattern: routingPatterns[routingType],
        dynamicOptions: isUsAba ? supportedBankDynamicOptions : undefined,
      }),
    ];
  });

  return [
    ...routingFields,
    makeField({
      key: 'account_number',
      path: 'beneficiary.bank_details.account_number',
      label: '银行账号',
      required: true,
      description: '仅保存结构化值；展示时默认掩码',
      example: '50001121',
      pattern: '^[0-9A-Za-z\\-]{1,34}$',
    }),
    makeField({
      key: 'bank_name',
      path: 'beneficiary.bank_details.bank_name',
      label: '银行名称',
      required: true,
      description: '生产环境可由银行检索结果回填',
      example: 'MUFG Bank',
      pattern: '^.{1,200}$',
    }),
  ];
};

const buildSwiftBankFields = (
  country: CountryProfile | undefined,
): AirwallexFormSchemaField[] => [
  makeField({
    key: country?.ibanPreferred ? 'iban' : 'account_number',
    path: country?.ibanPreferred
      ? 'beneficiary.bank_details.iban'
      : 'beneficiary.bank_details.account_number',
    label: country?.ibanPreferred ? 'IBAN' : '银行账号',
    required: true,
    description: country?.ibanPreferred
      ? '当前目的地的 Form Schema 使用 IBAN'
      : '当前目的地的 Form Schema 使用银行账号',
    pattern: country?.ibanPreferred
      ? '^[A-Z]{2}[0-9A-Z]{13,32}$'
      : '^[0-9A-Za-z\\- ]{1,34}$',
  }),
  makeField({
    key: 'swift_code',
    path: 'beneficiary.bank_details.swift_code',
    label: 'SWIFT / BIC',
    type: 'DYNAMIC_SELECT',
    required: true,
    description: '输入至少 3 个字符后检索 Airwallex 支持的银行',
    example: 'BOTKJPJT',
    pattern: '^[A-Z0-9]{8}([A-Z0-9]{3})?$',
    dynamicOptions: supportedBankDynamicOptions,
  }),
  makeField({
    key: 'bank_name',
    path: 'beneficiary.bank_details.bank_name',
    label: '银行名称',
    required: true,
    example: 'MUFG Bank',
    pattern: '^.{1,200}$',
  }),
  makeField({
    key: 'bank_branch',
    path: 'beneficiary.bank_details.bank_branch',
    label: '分行名称',
    description: '仅在 Form Schema 返回时采集',
    pattern: '^.{1,200}$',
  }),
  makeField({
    key: 'bank_state',
    path: 'beneficiary.bank_details.bank_state',
    label: '银行州 / 省',
    description: '仅在 Form Schema 返回时采集',
    pattern: '^.{1,100}$',
  }),
  makeField({
    key: 'intermediary_bank_name',
    path: 'beneficiary.bank_details.intermediary_bank_name',
    label: '中间行名称',
    description: '仅在收款银行明确指定中间行时填写',
    pattern: '^.{1,200}$',
  }),
  makeField({
    key: 'intermediary_bank_swift_code',
    path: 'beneficiary.bank_details.intermediary_bank_swift_code',
    label: '中间行 SWIFT / BIC',
    description: '仅在收款银行明确指定中间行时填写',
    pattern: '^[A-Z0-9]{8}([A-Z0-9]{3})?$',
  }),
];

const buildRequiredBankAddressField = (): AirwallexFormSchemaField => makeField({
  key: 'bank_street_address',
  path: 'beneficiary.bank_details.bank_street_address',
  label: '银行街道地址',
  required: true,
  description: '请输入收款银行的完整地址',
  example: '1 Finance Street, New York, NY 10005',
  pattern: '^[\\s\\S]{2,300}$',
});

/**
 * 无凭证原型使用的 Schema 适配器。
 * 返回结构与 Airwallex Form Schema 保持一致，生产环境只需把数据源替换为服务端代理响应。
 */
export const generateLocalAirwallexFormSchema = (
  account: AirwallexPayoutAccount,
): AirwallexFormSchemaResponse => {
  const country = getAirwallexCountryProfile(account.bankDetails.bankCountryCode);
  const fields = [
    ...buildConditionFields(account, country),
    ...buildIdentityFields(account),
    ...buildAddressFields(country),
    makeField({
      key: 'account_name',
      path: 'beneficiary.bank_details.account_name',
      label: '账户名称',
      required: true,
      description: '请输入银行登记的完整账户名称',
      example: 'Mina Kato',
      pattern: '^[\\s\\S]{2,200}$',
    }),
    ...(account.transferMethod === 'SWIFT'
      ? buildSwiftBankFields(country)
      : buildLocalBankFields(country)),
    buildRequiredBankAddressField(),
  ];

  return {
    condition: buildAirwallexSchemaCondition(account),
    fields,
    meta: { source: 'local', simulated: true },
  };
};

const readKnownPath = (
  account: AirwallexPayoutAccount,
  path: string,
): string | undefined => {
  const values: Record<string, string> = {
    'beneficiary.entity_type': account.entityType,
    'beneficiary.first_name': account.firstName,
    'beneficiary.last_name': account.lastName,
    'beneficiary.company_name': account.companyName,
    'beneficiary.additional_info.personal_email': account.notificationEmail,
    'beneficiary.address.country_code': account.address.countryCode,
    'beneficiary.address.street_address': account.address.streetAddress,
    'beneficiary.address.city': account.address.city,
    'beneficiary.address.state': account.address.state,
    'beneficiary.address.postcode': account.address.postcode,
    'transfer_method': account.transferMethod,
    'beneficiary.bank_details.bank_country_code': account.bankDetails.bankCountryCode,
    'beneficiary.bank_details.account_currency': account.bankDetails.accountCurrency,
    'beneficiary.bank_details.account_name': account.bankDetails.accountName,
    'beneficiary.bank_details.account_number': account.bankDetails.accountNumber,
    'beneficiary.bank_details.iban': account.bankDetails.iban,
    'beneficiary.bank_details.bank_account_category': account.bankDetails.bankAccountCategory,
    'beneficiary.bank_details.account_routing_type1': account.bankDetails.accountRoutingType1,
    'beneficiary.bank_details.account_routing_value1': account.bankDetails.accountRoutingValue1,
    'beneficiary.bank_details.account_routing_type2': account.bankDetails.accountRoutingType2,
    'beneficiary.bank_details.account_routing_value2': account.bankDetails.accountRoutingValue2,
    'beneficiary.bank_details.local_clearing_system': account.bankDetails.localClearingSystem,
    'beneficiary.bank_details.bank_name': account.bankDetails.bankName,
    'beneficiary.bank_details.bank_branch': account.bankDetails.bankBranch,
    'beneficiary.bank_details.bank_street_address': account.bankDetails.bankStreetAddress
      || account.schemaValues?.['beneficiary.bank_details.bank_address']
      || account.schemaValues?.['beneficiary.bank_details.bank_address_line_1']
      || account.schemaValues?.['profile_supplement.beneficiary_bank_address']
      || '',
    'beneficiary.bank_details.bank_state': account.bankDetails.bankState,
    'beneficiary.bank_details.swift_code': account.bankDetails.swiftCode,
    'beneficiary.bank_details.intermediary_bank_name': account.bankDetails.intermediaryBankName,
    'beneficiary.bank_details.intermediary_bank_swift_code': account.bankDetails.intermediaryBankSwiftCode,
  };
  return values[path];
};

export const getAirwallexFormValue = (
  account: AirwallexPayoutAccount,
  path: string,
) => readKnownPath(account, path) ?? account.schemaValues?.[path] ?? '';

export const setAirwallexFormValue = (
  account: AirwallexPayoutAccount,
  path: string,
  value: string,
): AirwallexPayoutAccount => {
  const next: AirwallexPayoutAccount = {
    ...account,
    address: { ...account.address },
    bankDetails: { ...account.bankDetails },
    schemaValues: { ...(account.schemaValues ?? {}), [path]: value },
  };

  switch (path) {
    case 'beneficiary.entity_type':
      next.entityType = value as AirwallexEntityType;
      break;
    case 'beneficiary.first_name':
      next.firstName = value;
      break;
    case 'beneficiary.last_name':
      next.lastName = value;
      break;
    case 'beneficiary.company_name':
      next.companyName = value;
      break;
    case 'beneficiary.additional_info.personal_email':
      next.notificationEmail = value;
      break;
    case 'beneficiary.address.country_code':
      next.address.countryCode = value;
      break;
    case 'beneficiary.address.street_address':
      next.address.streetAddress = value;
      break;
    case 'beneficiary.address.city':
      next.address.city = value;
      break;
    case 'beneficiary.address.state':
      next.address.state = value;
      break;
    case 'beneficiary.address.postcode':
      next.address.postcode = value;
      break;
    case 'transfer_method':
      next.transferMethod = value as AirwallexTransferMethod;
      break;
    case 'beneficiary.bank_details.bank_country_code': {
      const country = getAirwallexCountryProfile(value);
      next.bankDetails.bankCountryCode = value;
      next.bankDetails.bankCountryName = country?.englishLabel ?? value;
      if (country && !country.currencies.includes(next.bankDetails.accountCurrency)) {
        next.bankDetails.accountCurrency = country.currencies[0] ?? '';
      }
      if (
        country
        && next.transferMethod === 'LOCAL'
        && !country.localClearingSystems.includes(next.bankDetails.localClearingSystem)
      ) {
        next.bankDetails.localClearingSystem = country.localClearingSystems[0] ?? '';
      }
      break;
    }
    case 'beneficiary.bank_details.account_currency':
      next.bankDetails.accountCurrency = value;
      break;
    case 'beneficiary.bank_details.account_name':
      next.bankDetails.accountName = value;
      break;
    case 'beneficiary.bank_details.account_number':
      next.bankDetails.accountNumber = value;
      break;
    case 'beneficiary.bank_details.iban':
      next.bankDetails.iban = value.toUpperCase();
      break;
    case 'beneficiary.bank_details.bank_account_category':
      next.bankDetails.bankAccountCategory = value;
      break;
    case 'beneficiary.bank_details.account_routing_type1':
      next.bankDetails.accountRoutingType1 = value;
      break;
    case 'beneficiary.bank_details.account_routing_value1':
      next.bankDetails.accountRoutingValue1 = value;
      break;
    case 'beneficiary.bank_details.account_routing_type2':
      next.bankDetails.accountRoutingType2 = value;
      break;
    case 'beneficiary.bank_details.account_routing_value2':
      next.bankDetails.accountRoutingValue2 = value;
      break;
    case 'beneficiary.bank_details.local_clearing_system':
      next.bankDetails.localClearingSystem = value;
      break;
    case 'beneficiary.bank_details.bank_name':
      next.bankDetails.bankName = value;
      break;
    case 'beneficiary.bank_details.bank_branch':
      next.bankDetails.bankBranch = value;
      break;
    case 'beneficiary.bank_details.bank_street_address':
      next.bankDetails.bankStreetAddress = value;
      break;
    case 'beneficiary.bank_details.bank_state':
      next.bankDetails.bankState = value;
      break;
    case 'beneficiary.bank_details.swift_code':
      next.bankDetails.swiftCode = value.toUpperCase();
      break;
    case 'beneficiary.bank_details.intermediary_bank_name':
      next.bankDetails.intermediaryBankName = value;
      break;
    case 'beneficiary.bank_details.intermediary_bank_swift_code':
      next.bankDetails.intermediaryBankSwiftCode = value.toUpperCase();
      break;
    default:
      break;
  }

  return next;
};

export const applyAirwallexSchemaDefaults = (
  account: AirwallexPayoutAccount,
  schema: AirwallexFormSchemaResponse,
) => schema.fields.reduce((next, item) => {
  if (!item.field.default || getAirwallexFormValue(next, item.path)) return next;
  return setAirwallexFormValue(next, item.path, item.field.default);
}, account);

export type AirwallexSchemaValidationIssue = {
  path: string;
  code: 'REQUIRED' | 'PATTERN';
  message: string;
};

const matchesPattern = (value: string, pattern?: string) => {
  if (!pattern || !value) return true;
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return true;
  }
};

export const validateAirwallexFormSchema = (
  account: AirwallexPayoutAccount,
  schema = generateLocalAirwallexFormSchema(account),
): AirwallexSchemaValidationIssue[] => (
  schema.fields.flatMap<AirwallexSchemaValidationIssue>((item): AirwallexSchemaValidationIssue[] => {
    const value = getAirwallexFormValue(account, item.path) || item.field.default;
    if (item.required && !value.trim()) {
      return [{
        path: item.path,
        code: 'REQUIRED',
        message: `${item.field.label}为必填项`,
      }];
    }
    if (value && !matchesPattern(value, item.rule.pattern)) {
      return [{
        path: item.path,
        code: 'PATTERN',
        message: `${item.field.label}格式不符合当前 Schema`,
      }];
    }
    return [];
  })
);

export const getAirwallexSchemaGroup = (
  path: string,
): 'condition' | 'identity' | 'address' | 'bank' => {
  if (
    path === 'transfer_method'
    || path === 'beneficiary.entity_type'
    || path === 'beneficiary.bank_details.bank_country_code'
    || path === 'beneficiary.bank_details.account_currency'
    || path === AIRWALLEX_LOCAL_CLEARING_SYSTEM_PATH
  ) return 'condition';
  if (path.startsWith('beneficiary.address.')) return 'address';
  if (path.startsWith('beneficiary.bank_details.')) return 'bank';
  return 'identity';
};

/**
 * 生产实现应由服务端持有 Airwallex token，并由前端调用此代理地址。
 * 该函数只定义前后端契约；当前纯前端原型不会主动发起真实请求。
 */
export const fetchAirwallexFormSchema = async (
  condition: AirwallexFormSchemaCondition,
  request: typeof fetch = fetch,
): Promise<AirwallexFormSchemaResponse> => {
  const response = await request(AIRWALLEX_FORM_SCHEMA_PROXY_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-airwallex-api-version': AIRWALLEX_SCHEMA_API_VERSION,
    },
    body: JSON.stringify(condition),
  });
  if (!response.ok) {
    throw new Error(`Airwallex Form Schema 请求失败（${response.status}）`);
  }
  return response.json() as Promise<AirwallexFormSchemaResponse>;
};
