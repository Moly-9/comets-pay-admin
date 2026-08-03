import type {
  AirwallexFormSchemaField,
  AirwallexFormSchemaResponse,
} from './airwallexFormSchema';

export type AirwallexSupplementalField = {
  key: string;
  label: string;
  sourceLabel: string;
  path: string;
  aliases: string[];
  placeholder: string;
  type?: 'text' | 'email' | 'tel' | 'number';
};

/**
 * Source: "Airwallex-收集信息最全.docx".
 * These fields are stored only as optional profile supplements when the
 * active Form Schema does not already cover an equivalent concept.
 */
export const AIRWALLEX_SUPPLEMENTAL_FIELD_CATALOG: AirwallexSupplementalField[] = [
  {
    key: 'legal_name',
    label: '真实姓名 / 公司名称',
    sourceLabel: 'YOUR REAL NAME OR COMPANY NAME',
    path: 'profile_supplement.legal_name',
    aliases: [
      'beneficiary.first_name',
      'beneficiary.last_name',
      'beneficiary.company_name',
    ],
    placeholder: '个人真实姓名或公司法定名称',
  },
  {
    key: 'phone',
    label: '联系电话',
    sourceLabel: 'Tel / Beneficiary Mobile Phone Number',
    path: 'beneficiary.additional_info.personal_mobile_number',
    aliases: [
      'beneficiary.additional_info.personal_phone_number',
      'beneficiary.additional_info.mobile_number',
      'beneficiary.additional_info.phone_number',
      'beneficiary.phone_number',
    ],
    placeholder: '包含国家 / 地区代码',
    type: 'tel',
  },
  {
    key: 'email',
    label: '联系邮箱',
    sourceLabel: 'Your Email Address',
    path: 'beneficiary.additional_info.personal_email',
    aliases: [
      'beneficiary.email',
      'beneficiary.notification_email',
    ],
    placeholder: 'creator@example.com',
    type: 'email',
  },
  {
    key: 'current_address',
    label: 'Current address',
    sourceLabel: 'Current Address',
    path: 'beneficiary.address.state',
    aliases: [
      'beneficiary.address.street_address',
      'beneficiary.address.city',
      'beneficiary.address.postcode',
      'beneficiary.address.address_line_1',
    ],
    placeholder: '当前居住地址',
  },
  {
    key: 'bank_name',
    label: '银行名称',
    sourceLabel: "Beneficiary's Bank Name",
    path: 'beneficiary.bank_details.bank_name',
    aliases: [
      'beneficiary.bank_details.financial_institution_name',
    ],
    placeholder: '收款银行完整名称',
  },
  {
    key: 'trade_amount',
    label: '预计交易金额',
    sourceLabel: 'Trade Amount',
    path: 'profile_supplement.trade_amount',
    aliases: [
      'beneficiary.additional_info.trade_amount',
      'beneficiary.additional_info.expected_transaction_amount',
    ],
    placeholder: '预计单笔或累计金额',
    type: 'number',
  },
  {
    key: 'account_name',
    label: '账户名称',
    sourceLabel: 'Account Name',
    path: 'beneficiary.bank_details.account_name',
    aliases: [
      'beneficiary.bank_details.beneficiary_name',
      'beneficiary.bank_details.account_holder_name',
    ],
    placeholder: '银行登记的完整账户名称',
  },
  {
    key: 'bank_account_type',
    label: '银行账户类型',
    sourceLabel: 'Bank Account Type (Checking/Payment/Savings)',
    path: 'beneficiary.bank_details.bank_account_category',
    aliases: [
      'beneficiary.bank_details.account_type',
      'beneficiary.bank_details.bank_account_type',
    ],
    placeholder: 'Checking / Payment / Savings',
  },
  {
    key: 'routing_code_type',
    label: '主要路由代码类型',
    sourceLabel: 'Primary Routing Code Type',
    path: 'beneficiary.bank_details.account_routing_type1',
    aliases: [
      'beneficiary.bank_details.routing_code_type',
      'beneficiary.bank_details.primary_routing_code_type',
    ],
    placeholder: '例如 ABA、Sort Code、BSB',
  },
  {
    key: 'routing_code',
    label: '主要路由代码',
    sourceLabel: 'Primary Routing Code',
    path: 'beneficiary.bank_details.account_routing_value1',
    aliases: [
      'beneficiary.bank_details.routing_code',
      'beneficiary.bank_details.primary_routing_code',
    ],
    placeholder: '银行路由代码',
  },
  {
    key: 'branch_code',
    label: '分行代码',
    sourceLabel: 'Branch Code',
    path: 'beneficiary.bank_details.account_routing_value2',
    aliases: [
      'beneficiary.bank_details.branch_code',
      'beneficiary.bank_details.bank_branch',
    ],
    placeholder: '分行代码',
  },
  {
    key: 'swift_code',
    label: 'SWIFT / BIC',
    sourceLabel: 'SWIFT Code',
    path: 'beneficiary.bank_details.swift_code',
    aliases: [
      'beneficiary.bank_details.bic',
      'beneficiary.bank_details.bic_code',
    ],
    placeholder: '8 或 11 位 SWIFT / BIC',
  },
  {
    key: 'account_number',
    label: '银行账号',
    sourceLabel: 'Bank Account Number',
    path: 'beneficiary.bank_details.account_number',
    aliases: [
      'beneficiary.bank_details.bank_account_number',
    ],
    placeholder: '银行账号',
  },
  {
    key: 'iban',
    label: 'IBAN',
    sourceLabel: 'IBAN',
    path: 'beneficiary.bank_details.iban',
    aliases: [],
    placeholder: '国际银行账号',
  },
  {
    key: 'beneficiary_type',
    label: '收款主体类型',
    sourceLabel: 'Beneficiary Type (Personal/Corporate)',
    path: 'beneficiary.entity_type',
    aliases: [
      'beneficiary.beneficiary_type',
      'beneficiary.recipient_type',
    ],
    placeholder: 'Personal / Corporate',
  },
  {
    key: 'bank_country',
    label: '银行国家 / 地区',
    sourceLabel: "Beneficiary's Bank Country / Region",
    path: 'beneficiary.bank_details.bank_country_code',
    aliases: [
      'beneficiary.bank_details.bank_country',
      'beneficiary.bank_details.country_code',
    ],
    placeholder: '收款银行所在国家 / 地区',
  },
  {
    key: 'bank_street_address',
    label: '银行街道地址',
    sourceLabel: "Beneficiary's Bank Street Address",
    path: 'beneficiary.bank_details.bank_street_address',
    aliases: [
      'beneficiary.bank_details.bank_address',
      'beneficiary.bank_details.bank_address_line_1',
    ],
    placeholder: '银行街道地址',
  },
  {
    key: 'bank_city',
    label: '银行城市',
    sourceLabel: "Beneficiary's Bank City",
    path: 'beneficiary.bank_details.bank_city',
    aliases: [],
    placeholder: '银行所在城市',
  },
  {
    key: 'bank_state',
    label: '银行州 / 省',
    sourceLabel: "Beneficiary's Bank State / Province",
    path: 'beneficiary.bank_details.bank_state',
    aliases: [
      'beneficiary.bank_details.bank_province',
    ],
    placeholder: '银行所在州 / 省',
  },
  {
    key: 'bank_postcode',
    label: '银行邮政编码',
    sourceLabel: "Beneficiary's Bank Postal Code",
    path: 'beneficiary.bank_details.bank_postcode',
    aliases: [
      'beneficiary.bank_details.bank_postal_code',
      'beneficiary.bank_details.bank_zip_code',
    ],
    placeholder: '银行邮政编码',
  },
  {
    key: 'id_document_type',
    label: '证件类型',
    sourceLabel: 'ID Document Type',
    path: 'beneficiary.additional_info.personal_id_type',
    aliases: [
      'beneficiary.additional_info.id_document_type',
      'beneficiary.additional_info.personal_id_document_type',
    ],
    placeholder: '例如 Passport / National ID',
  },
  {
    key: 'beneficiary_id_number',
    label: '收款人证件号码',
    sourceLabel: 'Beneficiary ID Number',
    path: 'beneficiary.additional_info.personal_id_number',
    aliases: [
      'beneficiary.additional_info.id_number',
      'beneficiary.additional_info.personal_identification_number',
    ],
    placeholder: '证件号码',
  },
  {
    key: 'business_registration_number',
    label: '企业注册号',
    sourceLabel: 'Business Registration Number',
    path: 'beneficiary.additional_info.business_registration_number',
    aliases: [
      'beneficiary.additional_info.company_registration_number',
      'beneficiary.business_registration_number',
    ],
    placeholder: '企业注册号码',
  },
];

const normalizePath = (path: string) => path.trim().toLowerCase();

const fieldPaths = (field: AirwallexFormSchemaField) => [
  field.path,
  field.field.key,
].map(normalizePath);

export const isAirwallexSupplementCovered = (
  supplement: AirwallexSupplementalField,
  schemaFields: AirwallexFormSchemaField[],
) => {
  const aliases = new Set([
    supplement.path,
    ...supplement.aliases,
  ].map(normalizePath));

  return schemaFields.some((field) => (
    fieldPaths(field).some((path) => aliases.has(path))
  ));
};

export const getAirwallexSupplementalFields = (
  schema: AirwallexFormSchemaResponse,
) => AIRWALLEX_SUPPLEMENTAL_FIELD_CATALOG.filter(
  (field) => !isAirwallexSupplementCovered(field, schema.fields),
);
