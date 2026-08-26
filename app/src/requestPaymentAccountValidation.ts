import {
  AirwallexIntegrationError,
  buildAirwallexBeneficiaryPayload,
  getAirwallexBeneficiaryFormSchema,
  validateAirwallexBeneficiary,
} from './airwallexBeneficiaryApi';
import {
  getAirwallexCountryProfile,
  validateAirwallexFormSchema,
  type AirwallexSchemaValidationIssue,
} from './airwallexFormSchema';
import {
  paymentListEffectiveAccount,
  paymentListItemValue,
  type PaymentListItem,
} from './businessWorkflow';
import {
  paymentListAccountForItem,
  paymentListItemAccountIssues,
} from './paymentListWorkbook';
import type { CreatorProfile } from './types';

export type PaymentAccountSnapshotReview = {
  state: 'ready' | 'attention' | 'unsupported';
  issues: string[];
};

export type PaymentAccountApiValidation = {
  state: 'passed' | 'invalid' | 'unavailable';
  message: string;
  checkedAt?: string;
  fieldIssues?: PaymentAccountFieldIssue[];
};

export type PaymentAccountFieldIssue = {
  key: string;
  message: string;
};

const hasValue = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';

const paymentListFrozenSnapshotIssues = (item: PaymentListItem) => {
  const effectiveAccount = paymentListEffectiveAccount(item);
  if (effectiveAccount.provider !== 'Airwallex') return [];
  const details = effectiveAccount.paymentDetails;
  const context = [effectiveAccount.schemaKey, details?.bankCountry].filter(Boolean).join(' ');
  const schemaCountryCode = effectiveAccount.schemaKey?.split(':')[1] ?? '';
  const ibanRequiredScenario = Boolean(getAirwallexCountryProfile(schemaCountryCode)?.ibanPreferred)
    || /(?:SEPA|IBAN|Spain|France|Italy|西班牙|法国|意大利)/i.test(context);
  const address = [
    paymentListSnapshotValue(item, 'beneficiary.address.street_address'),
    paymentListSnapshotValue(item, 'beneficiary.address.city'),
    paymentListSnapshotValue(item, 'beneficiary.address.state'),
    paymentListSnapshotValue(item, 'beneficiary.address.postcode'),
    paymentListSnapshotValue(item, 'beneficiary.address.country_code'),
  ].filter(Boolean).join(', ');
  return [
    !paymentListSnapshotValue(item, 'beneficiary.bank_details.account_name') ? '付款清单缺少 Account Name' : '',
    effectiveAccount.transferMethod === 'SWIFT' || !ibanRequiredScenario
      ? (!paymentListSnapshotValue(item, 'beneficiary.bank_details.account_number') ? '付款清单缺少 Account Number' : '')
      : '',
    ibanRequiredScenario && !paymentListSnapshotValue(item, 'beneficiary.bank_details.iban') ? '付款清单缺少 IBAN' : '',
    !paymentListSnapshotValue(item, 'beneficiary.bank_details.bank_name') ? '付款清单缺少 Beneficiary Bank Name' : '',
    !address ? '付款清单缺少 Beneficiary Bank Address' : '',
    effectiveAccount.transferMethod === 'SWIFT'
      && !paymentListSnapshotValue(item, 'beneficiary.bank_details.swift_code')
      ? '付款清单缺少 Swift Code'
      : '',
  ].filter(Boolean);
};

/**
 * Form Schema 校验档案账户，付款清单校验冻结快照。
 * 两者不能互相替代：档案可能已经更新，而付款清单仍保留旧的、不完整的付款资料。
 */
const paymentListSnapshotValue = (item: PaymentListItem, path: string): string | undefined => {
  const effectiveAccount = paymentListEffectiveAccount(item);
  const details = effectiveAccount.paymentDetails;
  if (!details) return undefined;
  const schemaValue = details.schemaValues?.[path];
  if (hasValue(schemaValue)) return String(schemaValue);
  const fallbackRealName = item.snapshot.realName || item.snapshot.creatorName;
  const values: Record<string, unknown> = {
    'beneficiary.entity_type': details.beneficiaryType,
    'beneficiary.first_name': details.accountName || fallbackRealName,
    'beneficiary.last_name': details.accountName || fallbackRealName,
    'beneficiary.company_name': details.accountName || fallbackRealName,
    'beneficiary.address.country_code': details.bankCountry,
    'beneficiary.address.street_address': details.bankStreetAddress,
    'beneficiary.address.city': details.bankCity,
    'beneficiary.address.state': details.bankState,
    'beneficiary.address.postcode': details.bankPostalCode,
    'transfer_method': details.transferMethod || effectiveAccount.transferMethod,
    'beneficiary.bank_details.bank_country_code': details.bankCountry,
    'beneficiary.bank_details.account_currency': details.accountCurrency
      || paymentListEffectiveAccount(item).receiveCurrency
      || paymentListEffectiveAccount(item).currency,
    'beneficiary.bank_details.account_name': details.accountName,
    'beneficiary.bank_details.account_number': details.accountNumber,
    'beneficiary.bank_details.iban': details.iban,
    'beneficiary.bank_details.local_clearing_system': details.localClearingSystem
      || effectiveAccount.localClearingSystem,
    'beneficiary.bank_details.bank_name': details.bankName,
    'beneficiary.bank_details.bank_street_address': details.bankStreetAddress,
    'beneficiary.bank_details.bank_state': details.bankState,
    'beneficiary.bank_details.swift_code': details.swiftCode,
  };
  const value = values[path];
  return value === undefined || value === null ? undefined : String(value);
};

const PAYMENT_LIST_SNAPSHOT_SCHEMA_PATHS = new Set([
  'beneficiary.entity_type',
  'beneficiary.first_name',
  'beneficiary.last_name',
  'beneficiary.company_name',
  'beneficiary.address.country_code',
  'beneficiary.address.street_address',
  'beneficiary.address.city',
  'beneficiary.address.state',
  'beneficiary.address.postcode',
  'transfer_method',
  'beneficiary.bank_details.bank_country_code',
  'beneficiary.bank_details.account_currency',
  'beneficiary.bank_details.account_name',
  'beneficiary.bank_details.account_number',
  'beneficiary.bank_details.iban',
  'beneficiary.bank_details.local_clearing_system',
  'beneficiary.bank_details.bank_name',
  'beneficiary.bank_details.bank_street_address',
  'beneficiary.bank_details.bank_state',
  'beneficiary.bank_details.swift_code',
]);

const PAYMENT_LIST_FROZEN_SCHEMA_PATHS = new Set([
  'beneficiary.bank_details.account_name',
  'beneficiary.bank_details.account_number',
  'beneficiary.bank_details.iban',
  'beneficiary.bank_details.bank_name',
  'beneficiary.bank_details.bank_street_address',
  'beneficiary.bank_details.bank_state',
  'beneficiary.bank_details.swift_code',
]);

const paymentListSnapshotSchemaIssues = (
  item: PaymentListItem,
  schema: Awaited<ReturnType<typeof getAirwallexBeneficiaryFormSchema>>,
) => {
  const hasSnapshotSchema = Boolean(item.snapshot.paymentDetails?.schemaFields?.length);

  return schema.fields.flatMap((field) => {
    // New snapshots carry the exact Form Schema used to collect the payment
    // details, so every required field returned by the API must be present in
    // the frozen snapshot. Older snapshots predate dynamic schema fields and
    // keep the narrower compatibility allow-list below.
    const value = paymentListSnapshotValue(item, field.path);
    if (
      !field.required
      || (!hasSnapshotSchema && !PAYMENT_LIST_SNAPSHOT_SCHEMA_PATHS.has(field.path))
      || (!hasSnapshotSchema && PAYMENT_LIST_FROZEN_SCHEMA_PATHS.has(field.path))
      || hasValue(value)
    ) return [];
    return [`${field.field.label}未填写`];
  });
};

const paymentListTransactionIssues = (item: PaymentListItem) => {
  const currency = String(item.overrides.currency ?? item.snapshot.currency ?? '').trim();
  const receiveCurrency = String(item.overrides.receiveCurrency ?? item.snapshot.receiveCurrency ?? '').trim();
  const amount = Number(item.overrides.amount ?? item.snapshot.amount);
  const feeBearer = paymentListItemValue(item, 'feeBearer');
  const paymentReason = String(item.overrides.paymentReason ?? item.snapshot.paymentReason ?? '').trim();
  const transactionReference = String(
    item.overrides.transactionReference ?? item.snapshot.transactionReference ?? '',
  ).trim();
  return [
    !currency ? '支付币种未填写' : '',
    !receiveCurrency ? '收款币种未填写' : '',
    !(amount > 0) ? '付款金额未填写或必须大于 0' : '',
    !feeBearer ? '手续费承担方未填写' : '',
    !paymentReason ? '付款原因未填写' : '',
    !transactionReference ? '交易附言未填写' : '',
  ].filter(Boolean);
};

const snapshotIssueFieldKeys: Array<[string, string]> = [
  ['Account Name', 'beneficiary.bank_details.account_name'],
  ['Account Number', 'beneficiary.bank_details.account_number'],
  ['IBAN', 'beneficiary.bank_details.iban'],
  ['Beneficiary Bank Name', 'beneficiary.bank_details.bank_name'],
  ['Beneficiary Bank Address', 'beneficiary.bank_details.bank_street_address'],
  ['Swift Code', 'beneficiary.bank_details.swift_code'],
];

const transactionIssueFieldKeys: Array<[string, string]> = [
  ['支付币种', 'currency'],
  ['收款币种', 'receive-currency'],
  ['付款金额', 'amount'],
  ['手续费承担方', 'fee-bearer'],
  ['付款原因', 'payment-reason'],
  ['交易附言', 'transaction-reference'],
];

const mapMessageToFieldIssues = (
  messages: string[],
  mappings: Array<[string, string]>,
): PaymentAccountFieldIssue[] => messages.flatMap((message) => {
  const match = mappings.find(([label]) => message.includes(label));
  return match ? [{ key: match[1], message }] : [];
});

const mapSchemaIssues = (issues: AirwallexSchemaValidationIssue[]) => (
  issues.map((issue) => ({ key: issue.path, message: issue.message }))
);

export const reviewPaymentListAccountSnapshot = (
  item: PaymentListItem,
  creators: CreatorProfile[],
): PaymentAccountSnapshotReview => {
  const effectiveAccount = paymentListEffectiveAccount(item);
  if (effectiveAccount.provider !== 'Airwallex') {
    return {
      state: 'unsupported',
      issues: [`当前原型未接入 ${effectiveAccount.provider || '该渠道'} 收款账户校验 API`],
    };
  }
  const account = paymentListAccountForItem(item, creators);
  const issues = [
    ...paymentListItemAccountIssues(item, account),
    ...paymentListFrozenSnapshotIssues(item),
  ];
  return { state: issues.length ? 'attention' : 'ready', issues };
};

export const validatePaymentListAccountViaApi = async ({
  item,
  creators,
  request = fetch,
  now = () => new Date().toISOString(),
  scope = 'full',
}: {
  item: PaymentListItem;
  creators: CreatorProfile[];
  request?: typeof fetch;
  now?: () => string;
  scope?: 'full' | 'completeness';
}): Promise<PaymentAccountApiValidation> => {
  const effectiveAccount = paymentListEffectiveAccount(item);
  if (effectiveAccount.provider !== 'Airwallex') {
    return {
      state: 'unavailable',
      message: `当前原型未接入 ${effectiveAccount.provider || '该渠道'} 收款账户校验 API`,
    };
  }
  const account = paymentListAccountForItem(item, creators);
  if (!account) {
    return {
      state: 'invalid',
      message: '达人档案中未找到付款清单引用的 Airwallex 收款账户',
    };
  }

  try {
    const schema = await getAirwallexBeneficiaryFormSchema(account, request);
    const schemaFieldIssues = validateAirwallexFormSchema(account, schema);
    const fieldIssues = scope === 'completeness'
      ? schemaFieldIssues.filter((issue) => issue.code === 'REQUIRED')
      : schemaFieldIssues;
    const frozenSnapshotIssues = [...new Set([
      ...paymentListFrozenSnapshotIssues(item),
      ...paymentListSnapshotSchemaIssues(item, schema),
    ])];
    const transactionIssues = paymentListTransactionIssues(item);
    const displayFieldIssues = [
      ...mapSchemaIssues(fieldIssues),
      ...mapMessageToFieldIssues(frozenSnapshotIssues, snapshotIssueFieldKeys),
      ...mapMessageToFieldIssues(transactionIssues, transactionIssueFieldKeys),
    ];
    const requiredFieldIssues = fieldIssues.filter((issue) => issue.code === 'REQUIRED');
    const patternFieldIssues = fieldIssues.filter((issue) => issue.code === 'PATTERN');
    if (fieldIssues.length || frozenSnapshotIssues.length || transactionIssues.length) {
      return {
        state: 'invalid',
        message: [
          requiredFieldIssues.length
            ? `收款账户缺少 API 必填字段：${requiredFieldIssues.map((issue) => issue.message).join('、')}`
            : '',
          patternFieldIssues.length
            ? `收款账户 API 字段格式不符合要求：${patternFieldIssues.map((issue) => issue.message).join('、')}`
            : '',
          frozenSnapshotIssues.length
            ? `付款清单冻结快照缺少必填字段：${frozenSnapshotIssues.join('、')}`
            : '',
          transactionIssues.length
            ? `付款清单交易信息不完整：${transactionIssues.join('、')}`
            : '',
        ].filter(Boolean).join('；'),
        fieldIssues: displayFieldIssues,
      };
    }
    if (scope === 'full') {
      await validateAirwallexBeneficiary(
        buildAirwallexBeneficiaryPayload(account, schema),
        request,
      );
    }
    return {
      state: 'passed',
      message: scope === 'completeness'
        ? 'Airwallex 付款必填信息完整性校验通过'
        : 'Airwallex 付款信息完整性校验通过，收款账户字段完整',
      checkedAt: now(),
    };
  } catch (error) {
    if (error instanceof AirwallexIntegrationError && error.fieldIssues?.length) {
      return {
        state: 'invalid',
        message: error.fieldIssues.map((issue) => issue.message).join('、'),
        fieldIssues: mapSchemaIssues(error.fieldIssues),
      };
    }
    return {
      state: 'unavailable',
      message: error instanceof Error ? error.message : '收款账户校验 API 暂不可用',
    };
  }
};
