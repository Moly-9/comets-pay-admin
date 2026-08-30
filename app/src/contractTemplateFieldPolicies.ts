import type {
  ContractGenerationModel,
  ContractPublishingChannel,
  ContractRecord,
  ContractTemplateFieldMode,
  ContractTemplateFieldPolicyMap,
  ContractTemplateManualFieldValueMap,
  ContractTemplateOutputFieldKey,
  ContractTemplateStatus,
} from './contracts';

export type ContractTemplateFieldGroupKey = 'COMMON' | 'BANK' | 'PAYPAL';

export type ContractTemplateOutputFieldDefinition = {
  key: ContractTemplateOutputFieldKey;
  label: string;
  description: string;
  group: ContractTemplateFieldGroupKey;
  requiredInline?: boolean;
};

export const CONTRACT_TEMPLATE_FIELD_MODES: Array<{
  value: ContractTemplateFieldMode;
  label: string;
  description: string;
}> = [
  { value: 'SYSTEM', label: '系统自动带入', description: '从当前系统资料读取并冻结到合同快照' },
  { value: 'MANUAL', label: '生成时人工填写', description: '生成合同时填写，仅写入合同文档快照' },
  { value: 'OMIT', label: '不生成', description: '独立字段行不输出；正文必需字段会阻止正式生成' },
];

export const CONTRACT_TEMPLATE_OUTPUT_FIELDS: ContractTemplateOutputFieldDefinition[] = [
  { key: 'advertiser', label: 'Advertiser', description: '系统组织主体', group: 'COMMON', requiredInline: true },
  { key: 'publisher', label: 'Publisher', description: '达人法定名称', group: 'COMMON', requiredInline: true },
  { key: 'channel', label: 'Channel', description: '社媒平台及频道链接', group: 'COMMON', requiredInline: true },
  { key: 'campaignPeriod', label: 'Campaign Period', description: '项目开始与结束日期', group: 'COMMON', requiredInline: true },
  { key: 'accountName', label: 'Account Name', description: '银行账户名称', group: 'BANK' },
  { key: 'accountNumber', label: 'Account Number', description: '银行账号', group: 'BANK' },
  { key: 'beneficiaryBankName', label: 'Beneficiary Bank Name', description: '收款银行名称', group: 'BANK' },
  { key: 'beneficiaryBankAddress', label: 'Beneficiary Bank Address', description: '收款银行地址', group: 'BANK' },
  { key: 'swiftCode', label: 'Swift Code', description: 'SWIFT / BIC', group: 'BANK' },
  { key: 'iban', label: 'IBAN', description: '国际银行账号', group: 'BANK' },
  { key: 'remittanceInformation', label: 'Remittance Information (optional)', description: '银行汇款备注', group: 'BANK' },
  { key: 'paypalUsername', label: 'PayPal Username', description: 'PayPal 收款用户名', group: 'PAYPAL' },
  { key: 'paypalEmailAddress', label: 'PayPal Email Address', description: 'PayPal 收款邮箱', group: 'PAYPAL' },
  { key: 'transferNote', label: 'Transfer Note (optional)', description: 'PayPal 转账备注', group: 'PAYPAL' },
];

export const CONTRACT_TEMPLATE_FIELD_GROUPS: Array<{
  key: ContractTemplateFieldGroupKey;
  label: string;
  description: string;
}> = [
  { key: 'COMMON', label: '通用字段', description: '所有合同生成渠道共同使用' },
  { key: 'BANK', label: '银行转账字段', description: '选择 Airwallex 银行账户时生效' },
  { key: 'PAYPAL', label: 'PayPal 字段', description: '选择 PayPal 账户时生效' },
];

export const ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS = CONTRACT_TEMPLATE_OUTPUT_FIELDS
  .map((field) => field.key);

const VALID_OUTPUT_FIELD_KEYS = new Set<ContractTemplateOutputFieldKey>(
  ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS,
);

export const DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES: ContractTemplateFieldPolicyMap = {
  advertiser: 'SYSTEM',
  publisher: 'SYSTEM',
  channel: 'SYSTEM',
  campaignPeriod: 'MANUAL',
  accountName: 'SYSTEM',
  accountNumber: 'SYSTEM',
  beneficiaryBankName: 'SYSTEM',
  beneficiaryBankAddress: 'SYSTEM',
  swiftCode: 'SYSTEM',
  iban: 'SYSTEM',
  remittanceInformation: 'SYSTEM',
  paypalUsername: 'SYSTEM',
  paypalEmailAddress: 'SYSTEM',
  transferNote: 'SYSTEM',
};

const VALID_FIELD_MODES = new Set<ContractTemplateFieldMode>(['SYSTEM', 'MANUAL', 'OMIT']);

export const resolveContractTemplateOutputFieldKeys = (
  fieldKeys?: readonly ContractTemplateOutputFieldKey[] | null,
): ContractTemplateOutputFieldKey[] => {
  if (fieldKeys == null) return [...ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS];
  const requested = new Set(fieldKeys.filter((key) => VALID_OUTPUT_FIELD_KEYS.has(key)));
  return ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS.filter((key) => requested.has(key));
};

export const getContractTemplateStatus = (
  contract: Pick<ContractRecord, 'templateStatus'>,
): ContractTemplateStatus => contract.templateStatus ?? 'ACTIVE';

export const resolveContractTemplateFieldPolicies = (
  policies?: Partial<ContractTemplateFieldPolicyMap> | null,
): ContractTemplateFieldPolicyMap => {
  const resolved = { ...DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES };
  CONTRACT_TEMPLATE_OUTPUT_FIELDS.forEach(({ key }) => {
    const candidate = policies?.[key];
    if (candidate && VALID_FIELD_MODES.has(candidate)) resolved[key] = candidate;
  });
  return resolved;
};

export type ContractTemplatePolicyIssue = {
  id: string;
  fieldKeys: ContractTemplateOutputFieldKey[];
  groupKeys: ContractTemplateFieldGroupKey[];
  message: string;
};

export const validateContractTemplateFieldPolicies = (
  policies?: Partial<ContractTemplateFieldPolicyMap> | null,
  fieldKeys?: readonly ContractTemplateOutputFieldKey[] | null,
): ContractTemplatePolicyIssue[] => {
  const resolved = resolveContractTemplateFieldPolicies(policies);
  const activeFields = new Set(resolveContractTemplateOutputFieldKeys(fieldKeys));
  const issues: ContractTemplatePolicyIssue[] = [];

  const usable = (key: ContractTemplateOutputFieldKey) => (
    activeFields.has(key) && resolved[key] !== 'OMIT'
  );
  const groupFields = (group: ContractTemplateFieldGroupKey) => (
    CONTRACT_TEMPLATE_OUTPUT_FIELDS.filter((field) => field.group === group)
  );
  const groupEnabled = (group: ContractTemplateFieldGroupKey) => (
    groupFields(group).some((field) => activeFields.has(field.key))
  );

  CONTRACT_TEMPLATE_OUTPUT_FIELDS
    .filter((field) => field.requiredInline && !usable(field.key))
    .forEach((field) => {
      issues.push({
        id: `required-inline-missing-${field.key}`,
        fieldKeys: [field.key],
        groupKeys: [field.group],
        message: `${field.label} 出现在合同正文中，必须保留且不能设为“不生成”。`,
      });
    });

  const bankEnabled = groupEnabled('BANK');
  const paypalEnabled = groupEnabled('PAYPAL');
  if (!bankEnabled && !paypalEnabled) {
    issues.push({
      id: 'payout-provider-missing',
      fieldKeys: [],
      groupKeys: ['BANK', 'PAYPAL'],
      message: '银行转账与 PayPal 至少启用一种付款方式。',
    });
  }

  if (bankEnabled && !usable('accountName')) {
    issues.push({
      id: 'bank-account-name-missing',
      fieldKeys: ['accountName'],
      groupKeys: ['BANK'],
      message: '启用银行转账时必须保留 Account Name，且不能设为“不生成”。',
    });
  }
  if (bankEnabled && !usable('beneficiaryBankName')) {
    issues.push({
      id: 'bank-name-missing',
      fieldKeys: ['beneficiaryBankName'],
      groupKeys: ['BANK'],
      message: '启用银行转账时必须保留 Beneficiary Bank Name，且不能设为“不生成”。',
    });
  }
  if (bankEnabled && !usable('accountNumber') && !usable('iban')) {
    issues.push({
      id: 'bank-account-locator-omitted',
      fieldKeys: ['accountNumber', 'iban'],
      groupKeys: ['BANK'],
      message: '启用银行转账时，Account Number 与 IBAN 至少保留一项，且不能同时设为“不生成”。',
    });
  }
  if (paypalEnabled && !usable('paypalUsername')) {
    issues.push({
      id: 'paypal-username-missing',
      fieldKeys: ['paypalUsername'],
      groupKeys: ['PAYPAL'],
      message: '启用 PayPal 时必须保留 PayPal Username，且不能设为“不生成”。',
    });
  }
  if (paypalEnabled && !usable('paypalEmailAddress')) {
    issues.push({
      id: 'paypal-email-missing',
      fieldKeys: ['paypalEmailAddress'],
      groupKeys: ['PAYPAL'],
      message: '启用 PayPal 时必须保留 PayPal Email Address，且不能设为“不生成”。',
    });
  }
  return issues;
};

export const contractTemplateConfigurationSignature = (
  policies?: Partial<ContractTemplateFieldPolicyMap> | null,
  fieldKeys?: readonly ContractTemplateOutputFieldKey[] | null,
) => JSON.stringify({
  policies: resolveContractTemplateFieldPolicies(policies),
  fieldKeys: resolveContractTemplateOutputFieldKeys(fieldKeys),
});

export const contractTemplatePoliciesAreDirty = (
  saved?: Partial<ContractTemplateFieldPolicyMap> | null,
  draft?: Partial<ContractTemplateFieldPolicyMap> | null,
  savedFieldKeys?: readonly ContractTemplateOutputFieldKey[] | null,
  draftFieldKeys?: readonly ContractTemplateOutputFieldKey[] | null,
) => contractTemplateConfigurationSignature(saved, savedFieldKeys)
  !== contractTemplateConfigurationSignature(draft, draftFieldKeys);

export const createContractTemplatePolicyUpdate = (
  contract: ContractRecord,
  policies: Partial<ContractTemplateFieldPolicyMap>,
  fieldKeys: readonly ContractTemplateOutputFieldKey[],
  options: {
    deactivateIfInvalid?: boolean;
    updated?: string;
  } = {},
): { contract: ContractRecord; issues: ContractTemplatePolicyIssue[]; autoDeactivated: boolean } => {
  const resolved = resolveContractTemplateFieldPolicies(policies);
  const resolvedFieldKeys = resolveContractTemplateOutputFieldKeys(fieldKeys);
  const issues = validateContractTemplateFieldPolicies(resolved, resolvedFieldKeys);
  const autoDeactivated = Boolean(
    issues.length
    && options.deactivateIfInvalid
    && getContractTemplateStatus(contract) === 'ACTIVE'
  );
  return {
    issues,
    autoDeactivated,
    contract: {
      ...contract,
      templateFieldPolicies: resolved,
      templateOutputFieldKeys: resolvedFieldKeys,
      templateStatus: autoDeactivated ? 'INACTIVE' : getContractTemplateStatus(contract),
      updated: options.updated ?? new Intl.DateTimeFormat('en-CA').format(new Date()),
    },
  };
};

export const getContractTemplatePolicyReadiness = (
  policies?: Partial<ContractTemplateFieldPolicyMap> | null,
  fieldKeys?: readonly ContractTemplateOutputFieldKey[] | null,
) => {
  const resolved = resolveContractTemplateFieldPolicies(policies);
  const blockers = validateContractTemplateFieldPolicies(resolved, fieldKeys);
  return {
    ready: blockers.length === 0,
    label: blockers.length === 0 ? '可使用' : '待完善',
    blockers,
  };
};

export const getContractTemplateSupportedPayoutProviders = (
  policies?: Partial<ContractTemplateFieldPolicyMap> | null,
  fieldKeys?: readonly ContractTemplateOutputFieldKey[] | null,
): Array<ContractGenerationModel['payoutProvider']> => {
  const resolved = resolveContractTemplateFieldPolicies(policies);
  const activeFields = new Set(resolveContractTemplateOutputFieldKeys(fieldKeys));
  const providers: Array<ContractGenerationModel['payoutProvider']> = [];
  if (CONTRACT_TEMPLATE_OUTPUT_FIELDS.some((field) => (
    field.group === 'BANK' && activeFields.has(field.key) && resolved[field.key] !== 'OMIT'
  ))) providers.push('Airwallex');
  if (CONTRACT_TEMPLATE_OUTPUT_FIELDS.some((field) => (
    field.group === 'PAYPAL' && activeFields.has(field.key) && resolved[field.key] !== 'OMIT'
  ))) providers.push('PayPal');
  return providers;
};

export const createContractTemplateStatusUpdate = (
  contract: ContractRecord,
  status: ContractTemplateStatus,
  updated = new Intl.DateTimeFormat('en-CA').format(new Date()),
): { contract?: ContractRecord; issues: ContractTemplatePolicyIssue[] } => {
  const issues = status === 'ACTIVE'
    ? validateContractTemplateFieldPolicies(
      contract.templateFieldPolicies,
      contract.templateOutputFieldKeys,
    )
    : [];
  if (issues.length) return { issues };
  return {
    issues: [],
    contract: { ...contract, templateStatus: status, updated },
  };
};

const bankAddressFromSnapshot = (model: ContractGenerationModel) => [
  model.paymentSnapshot.bankStreetAddress,
  model.paymentSnapshot.bankCity,
  model.paymentSnapshot.bankState,
  model.paymentSnapshot.bankPostalCode,
  model.paymentSnapshot.bankCountry,
].filter(Boolean).join(', ');

const systemPublishingChannels = (model: ContractGenerationModel): ContractPublishingChannel[] => (
  model.publishingChannels?.length
    ? model.publishingChannels.map((channel) => ({ ...channel }))
    : model.platform.trim() || model.channelUrl.trim()
      ? [{ socialAccountId: '', platform: model.platform, channelUrl: model.channelUrl }]
      : []
);

const scalarSystemValues = (model: ContractGenerationModel): Record<
  Exclude<ContractTemplateOutputFieldKey, 'channel' | 'campaignPeriod'>,
  string
> => ({
  advertiser: model.advertiser,
  publisher: model.publisher,
  accountName: model.paymentSnapshot.accountName,
  accountNumber: model.paymentSnapshot.accountNumber,
  beneficiaryBankName: model.paymentSnapshot.bankName,
  beneficiaryBankAddress: bankAddressFromSnapshot(model),
  swiftCode: model.paymentSnapshot.swiftCode,
  iban: model.paymentSnapshot.iban,
  remittanceInformation: model.paymentSnapshot.transferRemarks,
  paypalUsername: model.paymentSnapshot.paypalUsername,
  paypalEmailAddress: model.paymentSnapshot.paypalEmail,
  transferNote: model.paymentSnapshot.transferRemarks,
});

const manualScalarValue = (
  manualValues: Partial<ContractTemplateManualFieldValueMap> | undefined,
  key: Exclude<ContractTemplateOutputFieldKey, 'channel' | 'campaignPeriod'>,
  legacyFallback: string,
  useLegacyFallback: boolean,
) => {
  const value = manualValues?.[key];
  return typeof value === 'string' ? value : useLegacyFallback ? legacyFallback : '';
};

export type ResolvedContractTemplateOutput = {
  policies: ContractTemplateFieldPolicyMap;
  outputFieldKeys: ContractTemplateOutputFieldKey[];
  values: Record<ContractTemplateOutputFieldKey, string>;
  publishingChannels: ContractPublishingChannel[];
  campaignStart: string;
  campaignEnd: string;
  effectiveModel: ContractGenerationModel;
};

export const resolveContractTemplateOutput = (
  model: ContractGenerationModel,
): ResolvedContractTemplateOutput => {
  const policies = resolveContractTemplateFieldPolicies(model.templateFieldPolicies);
  const outputFieldKeys = resolveContractTemplateOutputFieldKeys(model.templateOutputFieldKeys);
  const activeFields = new Set(outputFieldKeys);
  const manualValues = model.templateManualFieldValues;
  const useLegacyFallback = !model.templateFieldPolicies && !manualValues;
  const systemScalars = scalarSystemValues(model);
  const values = {} as Record<ContractTemplateOutputFieldKey, string>;

  (Object.keys(systemScalars) as Array<keyof typeof systemScalars>).forEach((key) => {
    const mode = activeFields.has(key) ? policies[key] : 'OMIT';
    values[key] = mode === 'OMIT'
      ? ''
      : mode === 'MANUAL'
        ? manualScalarValue(manualValues, key, systemScalars[key], useLegacyFallback)
        : systemScalars[key];
  });

  const systemChannels = systemPublishingChannels(model);
  const manualChannels = manualValues?.channel?.publishingChannels;
  const channelMode = activeFields.has('channel') ? policies.channel : 'OMIT';
  const publishingChannels = channelMode === 'OMIT'
    ? []
    : channelMode === 'MANUAL'
      ? (manualChannels ?? (useLegacyFallback ? systemChannels : [])).map((channel) => ({ ...channel }))
      : systemChannels;
  values.channel = publishingChannels
    .map((channel) => {
      const platform = channel.platform.trim();
      const channelUrl = channel.channelUrl.trim();
      return platform && channelUrl ? `${platform}: ${channelUrl}` : channelUrl || platform;
    })
    .filter(Boolean)
    .join('\n');

  const manualPeriod = manualValues?.campaignPeriod;
  const campaignPeriodMode = activeFields.has('campaignPeriod') ? policies.campaignPeriod : 'OMIT';
  const campaignStart = campaignPeriodMode === 'OMIT'
    ? ''
    : campaignPeriodMode === 'MANUAL'
      ? manualPeriod?.startDate ?? (useLegacyFallback ? model.campaignStart : '')
      : model.campaignStart;
  const campaignEnd = campaignPeriodMode === 'OMIT'
    ? ''
    : campaignPeriodMode === 'MANUAL'
      ? manualPeriod?.endDate ?? (useLegacyFallback ? model.campaignEnd : '')
      : model.campaignEnd;
  values.campaignPeriod = [campaignStart, campaignEnd].filter(Boolean).join(' – ');

  const paymentSnapshot = {
    ...model.paymentSnapshot,
    accountName: values.accountName,
    accountNumber: values.accountNumber,
    bankName: values.beneficiaryBankName,
    bankStreetAddress: activeFields.has('beneficiaryBankAddress') && policies.beneficiaryBankAddress === 'SYSTEM'
      ? model.paymentSnapshot.bankStreetAddress
      : values.beneficiaryBankAddress,
    swiftCode: values.swiftCode,
    iban: values.iban,
    paypalUsername: values.paypalUsername,
    paypalEmail: values.paypalEmailAddress,
    transferRemarks: model.payoutProvider === 'PayPal' ? values.transferNote : values.remittanceInformation,
  };
  if (!activeFields.has('beneficiaryBankAddress') || policies.beneficiaryBankAddress !== 'SYSTEM') {
    paymentSnapshot.bankCity = '';
    paymentSnapshot.bankState = '';
    paymentSnapshot.bankPostalCode = '';
    paymentSnapshot.bankCountry = '';
  }

  const effectiveModel: ContractGenerationModel = {
    ...model,
    advertiser: values.advertiser,
    publisher: values.publisher,
    publishingChannels,
    platform: publishingChannels.map((channel) => channel.platform.trim()).filter(Boolean).join(' · '),
    channelUrl: values.channel,
    campaignStart,
    campaignEnd,
    paymentSnapshot,
  };

  return { policies, outputFieldKeys, values, publishingChannels, campaignStart, campaignEnd, effectiveModel };
};

export const contractTemplateOutputFieldApplies = (
  key: ContractTemplateOutputFieldKey,
  provider: ContractGenerationModel['payoutProvider'],
) => {
  const definition = CONTRACT_TEMPLATE_OUTPUT_FIELDS.find((field) => field.key === key);
  if (definition?.group === 'BANK') return provider === 'Airwallex';
  if (definition?.group === 'PAYPAL') return provider === 'PayPal';
  return true;
};

export const isContractTemplateOutputFieldOmitted = (
  model: ContractGenerationModel,
  key: ContractTemplateOutputFieldKey,
) => (
  !resolveContractTemplateOutputFieldKeys(model.templateOutputFieldKeys).includes(key)
  || resolveContractTemplateFieldPolicies(model.templateFieldPolicies)[key] === 'OMIT'
);

export const hasManualPayoutDocumentDifferences = (model: ContractGenerationModel) => {
  const output = resolveContractTemplateOutput(model);
  return CONTRACT_TEMPLATE_OUTPUT_FIELDS.some((field) => (
    (field.group === 'BANK' || field.group === 'PAYPAL')
    && contractTemplateOutputFieldApplies(field.key, model.payoutProvider)
    && output.outputFieldKeys.includes(field.key)
    && output.policies[field.key] === 'MANUAL'
    && output.values[field.key] !== scalarSystemValues(model)[field.key as keyof ReturnType<typeof scalarSystemValues>]
  ));
};
