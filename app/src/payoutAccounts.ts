import type {
  AirwallexBankDetails,
  AirwallexPayoutAccount,
  AirwallexTransferMethod,
  BeneficiaryAddress,
  CreatorPaymentDetails,
  CreatorPayoutAccount,
  CreatorProfile,
  DocumentPayoutSnapshot,
  PayMaxPayoutAccount,
  PayPalPayoutAccount,
  PayoutAccountStatus,
  PayoutAccountVersion,
  Provider,
} from './types';
import {
  AIRWALLEX_SCHEMA_COUNTRIES,
  AIRWALLEX_SCHEMA_CURRENCIES,
  generateLocalAirwallexFormSchema,
  getAirwallexCountryProfile,
  validateAirwallexFormSchema,
} from './airwallexFormSchema';
import { createPrototypeId } from './businessWorkflow';

export const AIRWALLEX_COUNTRIES = AIRWALLEX_SCHEMA_COUNTRIES;
export const AIRWALLEX_CURRENCIES = AIRWALLEX_SCHEMA_CURRENCIES;

export const TRANSFER_METHOD_OPTIONS: Array<{ value: AirwallexTransferMethod; label: string; description: string }> = [
  { value: 'LOCAL', label: '本地转账 · LOCAL', description: '优先使用本地清算网络，通常更快、费用更低' },
  { value: 'SWIFT', label: '国际电汇 · SWIFT', description: '用于跨境电汇或本地网络未覆盖的场景' },
];

const EMPTY_ADDRESS: BeneficiaryAddress = {
  countryCode: '',
  streetAddress: '',
  city: '',
  state: '',
  postcode: '',
};

const EMPTY_BANK_DETAILS: AirwallexBankDetails = {
  bankCountryCode: '',
  bankCountryName: '',
  accountCurrency: '',
  accountName: '',
  accountNumber: '',
  iban: '',
  bankAccountCategory: '',
  accountRoutingType1: '',
  accountRoutingValue1: '',
  accountRoutingType2: '',
  accountRoutingValue2: '',
  localClearingSystem: '',
  bankName: '',
  bankBranch: '',
  bankStreetAddress: '',
  bankState: '',
  swiftCode: '',
  intermediaryBankName: '',
  intermediaryBankSwiftCode: '',
};

const EMPTY_INVOICE_PAYMENT: CreatorPaymentDetails = {
  bankCountry: '',
  accountName: '',
  accountType: '',
  swiftCode: '',
  accountNumber: '',
  iban: '',
  beneficiaryType: '',
  bankName: '',
  bankStreetAddress: '',
  bankCity: '',
  bankState: '',
  bankPostalCode: '',
  intermediaryBankCountry: '',
  intermediaryBankCode: '',
  transferRemarks: '',
  paypalUsername: '',
  paypalEmail: '',
};

export type DocumentPayoutFieldKey =
  | 'accountName'
  | 'accountNumber'
  | 'bankName'
  | 'bankAddress'
  | 'swiftCode'
  | 'iban'
  | 'paypalUsername'
  | 'paypalEmail'
  | 'provider';

export type DocumentPayoutIssue = {
  fieldKey: DocumentPayoutFieldKey;
  label: string;
  message: string;
};

type DocumentPayoutValidationInput = {
  provider?: CreatorPayoutAccount['provider'];
  transferMethod?: AirwallexTransferMethod | 'PAYPAL';
  requiresIban?: boolean;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankAddress: string;
  swiftCode: string;
  iban: string;
  paypalUsername: string;
  paypalEmail: string;
};

const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

const validateDocumentPayoutValues = ({
  provider,
  transferMethod,
  requiresIban = false,
  accountName,
  accountNumber,
  bankName,
  bankAddress,
  swiftCode,
  iban,
  paypalUsername,
  paypalEmail,
}: DocumentPayoutValidationInput): DocumentPayoutIssue[] => {
  if (provider === 'PayPal') {
    const issues: DocumentPayoutIssue[] = [];
    if (!paypalUsername.trim()) {
      issues.push({
        fieldKey: 'paypalUsername',
        label: 'PayPal Username',
        message: 'PayPal Username 为合同和 Invoice 必填项',
      });
    }
    if (!validEmail(paypalEmail)) {
      issues.push({
        fieldKey: 'paypalEmail',
        label: 'PayPal Email Address',
        message: 'PayPal Email Address 必须填写有效邮箱',
      });
    }
    return issues;
  }

  if (provider !== 'Airwallex') {
    return [{
      fieldKey: 'provider',
      label: '付款渠道',
      message: '该付款渠道暂不能生成合同或 Invoice 收款快照',
    }];
  }

  const issues: DocumentPayoutIssue[] = [];
  if (!accountName.trim()) {
    issues.push({
      fieldKey: 'accountName',
      label: 'Account Name',
      message: 'Account Name 为 Airwallex 付款信息必填项',
    });
  }
  if (!accountNumber.trim() && !iban.trim()) {
    issues.push({
      fieldKey: 'accountNumber',
      label: 'Account Number / IBAN',
      message: 'Account Number 或 IBAN 为 Airwallex 付款信息必填项，至少填写一项',
    });
  }
  if (!bankName.trim()) {
    issues.push({
      fieldKey: 'bankName',
      label: 'Beneficiary Bank Name',
      message: 'Beneficiary Bank Name 为 Airwallex 付款信息必填项',
    });
  }
  if (!bankAddress.trim()) {
    issues.push({
      fieldKey: 'bankAddress',
      label: 'Beneficiary Bank Address',
      message: 'Beneficiary Bank Address 为 Airwallex 付款信息必填项',
    });
  }
  if (transferMethod === 'SWIFT' && !swiftCode.trim()) {
    issues.push({
      fieldKey: 'swiftCode',
      label: 'SWIFT Code',
      message: 'SWIFT Code 为当前 SWIFT Form Schema 必填项',
    });
  }
  if (requiresIban && !iban.trim()) {
    issues.push({
      fieldKey: 'iban',
      label: 'IBAN',
      message: 'IBAN 为当前国家或地区的 Form Schema 必填项',
    });
  }
  return issues;
};

const fingerprintHash = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const orderedRecord = (record: Record<string, string>) => (
  Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)))
);

const schemaKeyForAccount = (account: CreatorPayoutAccount) => {
  if (account.provider === 'PayPal') return 'PAYPAL';
  if (account.provider === 'PayMax') {
    return ['PAYERMAX', account.countryCode, account.currency].filter(Boolean).join(':');
  }
  return [
    'BANK_ACCOUNT',
    account.bankDetails.bankCountryCode,
    account.bankDetails.accountCurrency,
    account.entityType,
    account.transferMethod,
    account.transferMethod === 'LOCAL' ? account.bankDetails.localClearingSystem : '',
  ].filter(Boolean).join(':');
};

const payoutAccountFingerprintSource = (account: CreatorPayoutAccount) => {
  if (account.provider === 'PayPal') {
    return JSON.stringify({
      provider: account.provider,
      username: account.paypalUsername.trim(),
      email: account.paypalEmail.trim().toLowerCase(),
      transferNote: account.transferNote?.trim() ?? '',
    });
  }
  if (account.provider === 'PayMax') {
    return JSON.stringify({
      provider: account.provider,
      beneficiaryName: account.beneficiaryName.trim(),
      payermaxAccountId: account.payermaxAccountId.trim(),
      countryCode: account.countryCode.trim(),
      currency: account.currency.trim(),
    });
  }
  return JSON.stringify({
    provider: account.provider,
    entityType: account.entityType,
    transferMethod: account.transferMethod,
    beneficiaryId: account.beneficiaryId,
    address: account.address,
    bankDetails: account.bankDetails,
    schemaValues: orderedRecord(account.schemaValues),
  });
};

export const getPayoutAccountId = (account: CreatorPayoutAccount) => (
  account.payoutAccountId || account.id
);

export const getPayoutAccountVersion = (account: CreatorPayoutAccount): PayoutAccountVersion => (
  account.payoutAccountVersion || 'legacy-v1'
);

export const getPayoutAccountFingerprint = (account: CreatorPayoutAccount) => (
  account.accountFingerprint || `fp_${fingerprintHash(payoutAccountFingerprintSource(account))}`
);

const nextPayoutAccountVersion = (version: PayoutAccountVersion): PayoutAccountVersion => {
  const current = version === 'legacy-v1' ? 1 : Number(version.slice(1));
  return `v${Number.isFinite(current) ? current + 1 : 2}`;
};

export const prepareCreatorPayoutAccountsForSave = (
  creatorId: string,
  previousAccounts: CreatorPayoutAccount[],
  nextAccounts: CreatorPayoutAccount[],
) => {
  const archived: CreatorPayoutAccount[] = [];
  const accounts = nextAccounts.map((candidate) => {
    const previous = previousAccounts.find((account) => (
      getPayoutAccountId(account) === getPayoutAccountId(candidate)
      || account.id === candidate.id
    ));
    const identity = {
      creatorId,
      payoutAccountId: previous ? getPayoutAccountId(previous) : getPayoutAccountId(candidate),
      providerAccountScope: candidate.providerAccountScope || previous?.providerAccountScope || 'mock:default',
      schemaKey: candidate.schemaKey || schemaKeyForAccount(candidate),
    };
    if (!previous) {
      return {
        ...candidate,
        ...identity,
        payoutAccountVersion: candidate.payoutAccountVersion || 'v1',
        accountFingerprint: `fp_${fingerprintHash(payoutAccountFingerprintSource(candidate))}`,
      } as CreatorPayoutAccount;
    }
    const changed = payoutAccountFingerprintSource(previous) !== payoutAccountFingerprintSource(candidate);
    if (!changed) {
      return {
        ...candidate,
        ...identity,
        payoutAccountVersion: getPayoutAccountVersion(previous),
        accountFingerprint: getPayoutAccountFingerprint(previous),
      } as CreatorPayoutAccount;
    }
    if (!isPayoutAccountVerified(previous)) {
      return {
        ...candidate,
        ...identity,
        payoutAccountVersion: getPayoutAccountVersion(previous),
        accountFingerprint: `fp_${fingerprintHash(payoutAccountFingerprintSource(candidate))}`,
      } as CreatorPayoutAccount;
    }
    archived.push({
      ...previous,
      creatorId,
      payoutAccountId: getPayoutAccountId(previous),
      payoutAccountVersion: getPayoutAccountVersion(previous),
      providerAccountScope: previous.providerAccountScope || 'mock:default',
      accountFingerprint: getPayoutAccountFingerprint(previous),
    } as CreatorPayoutAccount);
    return {
      ...candidate,
      ...identity,
      payoutAccountVersion: nextPayoutAccountVersion(getPayoutAccountVersion(previous)),
      accountFingerprint: `fp_${fingerprintHash(payoutAccountFingerprintSource(candidate))}`,
    } as CreatorPayoutAccount;
  });
  return { accounts, archived };
};

type AirwallexAccountSeed = Partial<Omit<AirwallexPayoutAccount, 'provider' | 'address' | 'bankDetails'>> & {
  id: string;
  address?: Partial<BeneficiaryAddress>;
  bankDetails?: Partial<AirwallexBankDetails>;
};

export const getCountryConfig = (countryCode: string) => (
  getAirwallexCountryProfile(countryCode)
);

export const createAirwallexPayoutAccount = ({
  id,
  address,
  bankDetails,
  ...account
}: AirwallexAccountSeed): AirwallexPayoutAccount => ({
  id,
  payoutAccountId: id,
  payoutAccountVersion: 'legacy-v1',
  providerAccountScope: 'mock:default',
  provider: 'Airwallex',
  nickname: 'Airwallex 银行账户',
  isDefault: false,
  status: 'DRAFT',
  beneficiaryId: '',
  beneficiaryEnvironment: '',
  entityType: 'PERSONAL',
  firstName: '',
  lastName: '',
  companyName: '',
  notificationEmail: '',
  address: { ...EMPTY_ADDRESS, ...address },
  transferMethod: 'LOCAL',
  bankDetails: { ...EMPTY_BANK_DETAILS, ...bankDetails },
  schemaValues: {},
  verificationCode: '',
  nameMatchResult: '',
  validatedAt: '',
  verifiedAt: '',
  ...account,
});

export const createPayPalPayoutAccount = ({
  id,
  nickname = 'PayPal 账户',
  isDefault = false,
  status = 'DRAFT',
  paypalUsername = '',
  paypalEmail = '',
  transferNote = '',
  ...account
}: Partial<PayPalPayoutAccount> & { id: string }): PayPalPayoutAccount => ({
  id,
  payoutAccountId: id,
  payoutAccountVersion: 'legacy-v1',
  providerAccountScope: 'mock:default',
  provider: 'PayPal',
  nickname,
  isDefault,
  status,
  paypalUsername,
  paypalEmail,
  transferNote,
  ...account,
});

export const createPayMaxPayoutAccount = ({
  id,
  nickname = 'PayerMax 账户',
  isDefault = false,
  status = 'DRAFT',
  beneficiaryName = '',
  payermaxAccountId = '',
  countryCode = '',
  currency = '',
  email = '',
  ...account
}: Partial<PayMaxPayoutAccount> & { id: string }): PayMaxPayoutAccount => ({
  id,
  payoutAccountId: id,
  payoutAccountVersion: 'legacy-v1',
  providerAccountScope: 'mock:default',
  provider: 'PayMax',
  nickname,
  isDefault,
  status,
  beneficiaryName,
  payermaxAccountId,
  countryCode,
  currency,
  email,
  ...account,
});

export const createEmptyAirwallexAccount = (
  creatorName = '',
  notificationEmail = '',
  creatorId = '',
): AirwallexPayoutAccount => {
  const nameParts = creatorName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts.slice(1).join(' ');
  return createAirwallexPayoutAccount({
    id: createPrototypeId('payout-account'),
    creatorId,
    payoutAccountVersion: 'v1',
    nickname: '新的 Airwallex 账户',
    isDefault: true,
    firstName,
    lastName,
    notificationEmail,
    address: { countryCode: 'US' },
    bankDetails: {
      bankCountryCode: 'US',
      bankCountryName: 'United States',
      accountCurrency: 'USD',
      bankAccountCategory: 'Checking',
      accountRoutingType1: 'aba',
      localClearingSystem: 'ACH',
    },
  });
};

export const createEmptyPayPalAccount = (
  creatorName = '',
  email = '',
  creatorId = '',
): PayPalPayoutAccount => createPayPalPayoutAccount({
  id: createPrototypeId('payout-account'),
  creatorId,
  payoutAccountVersion: 'v1',
  nickname: '新的 PayPal 账户',
  status: creatorName.trim() && /^\S+@\S+\.\S+$/.test(email) ? 'READY_FOR_VALIDATION' : 'DRAFT',
  paypalUsername: creatorName,
  paypalEmail: email,
});

export const createEmptyPayMaxAccount = (
  creatorName = '',
  email = '',
  creatorId = '',
): PayMaxPayoutAccount => createPayMaxPayoutAccount({
  id: createPrototypeId('payout-account'),
  creatorId,
  payoutAccountVersion: 'v1',
  nickname: '新的 PayerMax 账户',
  beneficiaryName: creatorName,
  email,
});

export const clonePayoutAccounts = (accounts: CreatorPayoutAccount[]): CreatorPayoutAccount[] => (
  accounts.map((account) => account.provider === 'Airwallex'
    ? {
      ...account,
      address: { ...account.address },
      bankDetails: { ...account.bankDetails },
      schemaValues: { ...(account.schemaValues ?? {}) },
    }
    : { ...account })
);

export const getDefaultPayoutAccount = (accounts: CreatorPayoutAccount[]) => (
  accounts.find((account) => account.isDefault && account.status !== 'DISABLED')
  ?? accounts.find((account) => account.status !== 'DISABLED')
  ?? null
);

export const isPayoutAccountVerified = (account: CreatorPayoutAccount) => (
  account.status === 'VALIDATED' || account.status === 'VERIFIED'
);

const airwallexBankAddress = (account: AirwallexPayoutAccount) => (
  account.bankDetails.bankStreetAddress.trim()
  || account.schemaValues['beneficiary.bank_details.bank_address']?.trim()
  || account.schemaValues['beneficiary.bank_details.bank_address_line_1']?.trim()
  || account.schemaValues['profile_supplement.beneficiary_bank_address']?.trim()
  || ''
);

export const getPayoutAccountDocumentIssues = (
  account: CreatorPayoutAccount,
): DocumentPayoutIssue[] => {
  if (account.provider === 'PayPal') {
    return validateDocumentPayoutValues({
      provider: account.provider,
      transferMethod: 'PAYPAL',
      accountName: '',
      accountNumber: '',
      bankName: '',
      bankAddress: '',
      swiftCode: '',
      iban: '',
      paypalUsername: account.paypalUsername,
      paypalEmail: account.paypalEmail,
    });
  }
  if (account.provider === 'PayMax') {
    return validateDocumentPayoutValues({
      provider: account.provider,
      accountName: '',
      accountNumber: '',
      bankName: '',
      bankAddress: '',
      swiftCode: '',
      iban: '',
      paypalUsername: '',
      paypalEmail: '',
    });
  }
  const country = getAirwallexCountryProfile(account.bankDetails.bankCountryCode);
  return validateDocumentPayoutValues({
    provider: account.provider,
    transferMethod: account.transferMethod,
    requiresIban: account.transferMethod === 'LOCAL' && Boolean(country?.ibanPreferred),
    accountName: account.bankDetails.accountName,
    accountNumber: account.bankDetails.accountNumber,
    bankName: account.bankDetails.bankName,
    bankAddress: airwallexBankAddress(account),
    swiftCode: account.bankDetails.swiftCode,
    iban: account.bankDetails.iban,
    paypalUsername: '',
    paypalEmail: '',
  });
};

export const isPayoutAccountDocumentReady = (account: CreatorPayoutAccount) => (
  getPayoutAccountDocumentIssues(account).length === 0
);

export const isPayoutAccountUsableForDocuments = (account: CreatorPayoutAccount) => (
  isPayoutAccountVerified(account) && isPayoutAccountDocumentReady(account)
);

export const eligibleInvoicePayoutAccounts = (
  creator: CreatorProfile | null | undefined,
) => creator?.payoutAccounts.filter((account) => (
  account.status !== 'DISABLED'
  && isPayoutAccountUsableForDocuments(account)
  && (account.provider === 'Airwallex' || account.provider === 'PayPal')
)) ?? [];

export const hasPayoutAccountHistory = (account: CreatorPayoutAccount) => Boolean(
  account.hasPaymentHistory
  || account.linkedProjectIds?.length
  || account.invoiceIds?.length
  || account.paymentBatchIds?.length
  || account.transactionIds?.length
);

export const canDeletePayoutAccount = (account: CreatorPayoutAccount) => (
  !hasPayoutAccountHistory(account)
  && !account.activePaymentId
  && ['DRAFT', 'READY_FOR_VALIDATION', 'INVALID', 'CANNOT_VERIFY'].includes(account.status)
);

export const canDisablePayoutAccount = (account: CreatorPayoutAccount) => (
  account.status !== 'DISABLED' && !account.activePaymentId
);

export const shouldSynchronizeAirwallexAccount = (
  account: CreatorPayoutAccount,
): account is AirwallexPayoutAccount => (
  account.provider === 'Airwallex'
  && account.status !== 'DISABLED'
  && !(account.beneficiaryId && ['VALIDATED', 'VERIFIED'].includes(account.status))
);

export const getPayoutAccountForProvider = (
  accounts: CreatorPayoutAccount[],
  provider?: Provider,
) => {
  if (provider === 'PayPal') {
    return accounts.find((account) => account.provider === 'PayPal' && account.status !== 'DISABLED') ?? null;
  }
  if (provider === 'PayMax') {
    return accounts.find((account) => account.provider === 'PayMax' && account.status !== 'DISABLED' && account.isDefault)
      ?? accounts.find((account) => account.provider === 'PayMax' && account.status !== 'DISABLED')
      ?? null;
  }
  if (provider) {
    return accounts.find((account) => account.provider === 'Airwallex' && account.status !== 'DISABLED' && account.isDefault)
      ?? accounts.find((account) => account.provider === 'Airwallex' && account.status !== 'DISABLED')
      ?? null;
  }
  return getDefaultPayoutAccount(accounts);
};

export const isIbanPreferred = (account: AirwallexPayoutAccount) => (
  Boolean(getCountryConfig(account.bankDetails.bankCountryCode)?.ibanPreferred)
  && account.transferMethod === 'LOCAL'
);

export const isAirwallexAccountReady = (account: AirwallexPayoutAccount) => {
  const schema = generateLocalAirwallexFormSchema(account);
  return validateAirwallexFormSchema(account, schema).length === 0;
};

export const invalidateAirwallexVerification = (
  account: AirwallexPayoutAccount,
): AirwallexPayoutAccount => ({
  ...account,
  status: isAirwallexAccountReady(account) ? 'READY_FOR_VALIDATION' : 'DRAFT',
  verificationCode: '',
  nameMatchResult: '',
  validatedAt: '',
  verifiedAt: '',
});

export const normalizePayPalStatus = (account: PayPalPayoutAccount): PayPalPayoutAccount => ({
  ...account,
  status: account.paypalUsername.trim() && /^\S+@\S+\.\S+$/.test(account.paypalEmail)
    ? 'READY_FOR_VALIDATION'
    : 'DRAFT',
});

export const normalizePayMaxStatus = (account: PayMaxPayoutAccount): PayMaxPayoutAccount => ({
  ...account,
  status: (
    account.beneficiaryName.trim()
    && account.payermaxAccountId.trim()
    && account.countryCode.trim()
    && account.currency.trim()
  )
    ? 'READY_FOR_VALIDATION'
    : 'DRAFT',
});

export type PayoutAccountStatusMeta = {
  label: string;
  description: string;
  tone: 'success' | 'pending' | 'warning' | 'danger' | 'muted';
};

const ACCOUNT_STATUS_META: Record<PayoutAccountStatus, PayoutAccountStatusMeta> = {
  DRAFT: { label: '资料待补充', description: '尚未达到提交校验的最低资料要求', tone: 'pending' },
  READY_FOR_VALIDATION: { label: '待 Airwallex 校验', description: '资料完整，接入后应调用 Beneficiary Validate API', tone: 'pending' },
  VALIDATED: { label: '格式校验通过', description: '字段已通过 Airwallex Schema 校验', tone: 'success' },
  VERIFIED: { label: '账户已验证', description: '账户有效，账户名匹配结果已确认', tone: 'success' },
  REVIEW_REQUIRED: { label: '名称需复核', description: '账户有效，但账户名或主体类型需要人工确认', tone: 'warning' },
  CANNOT_VERIFY: { label: '暂不支持验证', description: '当前银行或清算路径不支持实时账户验证', tone: 'muted' },
  INVALID: { label: '账户无效', description: '账户不存在、已关闭或未通过验证，禁止付款', tone: 'danger' },
  DISABLED: { label: '账户已停用', description: '该账户不会出现在付款账户选择中', tone: 'muted' },
};

export const getPayoutAccountStatusMeta = (
  status: PayoutAccountStatus,
  provider?: Provider,
) => {
  if (status === 'READY_FOR_VALIDATION' && provider === 'PayPal') {
    return {
      label: '待 PayPal 确认',
      description: '邮箱与用户名已完整，付款前仍需确认账户可收款',
      tone: 'pending',
    } satisfies PayoutAccountStatusMeta;
  }
  if (status === 'READY_FOR_VALIDATION' && provider === 'PayMax') {
    return {
      label: '待 PayerMax 确认',
      description: '收款账号资料已完整，付款前仍需由 PayerMax 服务端校验',
      tone: 'pending',
    } satisfies PayoutAccountStatusMeta;
  }
  return ACCOUNT_STATUS_META[status];
};

const maskValue = (value: string) => {
  const normalized = value.replace(/\s/g, '');
  if (!normalized) return '待补充';
  return `•••• ${normalized.slice(-4)}`;
};

export const getPayoutAccountIdentifier = (account: CreatorPayoutAccount) => (
  account.provider === 'PayPal'
    ? account.paypalEmail || '待补充 PayPal 邮箱'
    : account.provider === 'PayMax'
      ? account.payermaxAccountId || '待补充 PayerMax 账号'
    : maskValue(account.bankDetails.iban || account.bankDetails.accountNumber)
);

export const getPayoutAccountSummary = (account: CreatorPayoutAccount) => (
  account.provider === 'PayPal'
    ? 'PayPal · 邮箱账户'
    : account.provider === 'PayMax'
      ? `PayerMax · ${account.currency || '待选币种'}${account.countryCode ? ` · ${account.countryCode}` : ''}`
    : `${account.bankDetails.accountCurrency || '待选币种'} · ${account.transferMethod}${account.transferMethod === 'LOCAL' && account.bankDetails.localClearingSystem ? ` · ${account.bankDetails.localClearingSystem}` : ''}`
);

export const createDocumentPayoutSnapshot = (
  account: CreatorPayoutAccount | null,
  creatorId?: string,
): DocumentPayoutSnapshot => {
  if (!account) return { ...EMPTY_INVOICE_PAYMENT };
  const identity: Pick<
    DocumentPayoutSnapshot,
    | 'creatorId'
    | 'payoutAccountId'
    | 'payoutAccountVersion'
    | 'payoutProvider'
    | 'providerAccountScope'
    | 'accountFingerprint'
    | 'schemaKey'
    | 'validationStatus'
  > = {
    creatorId: creatorId || account.creatorId,
    payoutAccountId: getPayoutAccountId(account),
    payoutAccountVersion: getPayoutAccountVersion(account),
    payoutProvider: account.provider,
    providerAccountScope: account.providerAccountScope || 'mock:default',
    accountFingerprint: getPayoutAccountFingerprint(account),
    schemaKey: account.schemaKey || schemaKeyForAccount(account),
    validationStatus: account.status,
  };
  if (account.provider === 'PayPal') {
    return {
      ...EMPTY_INVOICE_PAYMENT,
      ...identity,
      paypalUsername: account.paypalUsername,
      paypalEmail: account.paypalEmail,
      transferRemarks: account.transferNote ?? '',
      transferMethod: 'PAYPAL',
    };
  }
  if (account.provider === 'PayMax') {
    return {
      ...EMPTY_INVOICE_PAYMENT,
      ...identity,
      accountName: account.beneficiaryName,
      accountNumber: account.payermaxAccountId,
      bankCountry: account.countryCode,
      accountCurrency: account.currency,
    };
  }
  return {
    ...EMPTY_INVOICE_PAYMENT,
    ...identity,
    externalBeneficiaryId: account.beneficiaryId || undefined,
    transferMethod: account.transferMethod,
    localClearingSystem: account.transferMethod === 'LOCAL'
      ? account.bankDetails.localClearingSystem
      : undefined,
    accountCurrency: account.bankDetails.accountCurrency,
    validatedAt: account.validatedAt || undefined,
    verifiedAt: account.verifiedAt || undefined,
    bankCountry: account.bankDetails.bankCountryName,
    accountName: account.bankDetails.accountName,
    accountType: account.bankDetails.bankAccountCategory,
    swiftCode: account.bankDetails.swiftCode,
    accountNumber: account.bankDetails.accountNumber,
    iban: account.bankDetails.iban,
    beneficiaryType: account.entityType,
    bankName: account.bankDetails.bankName,
    bankStreetAddress: airwallexBankAddress(account),
    bankCity: account.schemaValues['beneficiary.bank_details.bank_city'] || '',
    bankState: account.bankDetails.bankState,
    bankPostalCode: account.schemaValues['beneficiary.bank_details.bank_postcode'] || '',
    intermediaryBankCountry: account.schemaValues['beneficiary.bank_details.intermediary_bank_country_code'] || '',
    intermediaryBankCode: account.bankDetails.intermediaryBankSwiftCode,
  };
};

export const payoutAccountToInvoicePayment = createDocumentPayoutSnapshot;

const snapshotCountryCode = (snapshot: DocumentPayoutSnapshot) => {
  const [schemaType, countryCode = ''] = (snapshot.schemaKey ?? '').split(':');
  return schemaType === 'BANK_ACCOUNT' ? countryCode : '';
};

export const getDocumentPayoutSnapshotIssues = (
  snapshot: DocumentPayoutSnapshot,
  provider = snapshot.payoutProvider,
): DocumentPayoutIssue[] => {
  const country = getAirwallexCountryProfile(snapshotCountryCode(snapshot));
  return validateDocumentPayoutValues({
    provider,
    transferMethod: snapshot.transferMethod,
    requiresIban: snapshot.transferMethod === 'LOCAL' && Boolean(country?.ibanPreferred),
    accountName: snapshot.accountName,
    accountNumber: snapshot.accountNumber,
    bankName: snapshot.bankName,
    bankAddress: snapshot.bankStreetAddress,
    swiftCode: snapshot.swiftCode,
    iban: snapshot.iban,
    paypalUsername: snapshot.paypalUsername,
    paypalEmail: snapshot.paypalEmail,
  });
};

export const assertDocumentPayoutSnapshotReady = (
  snapshot: DocumentPayoutSnapshot,
  provider = snapshot.payoutProvider,
) => {
  const issues = getDocumentPayoutSnapshotIssues(snapshot, provider);
  if (!issues.length) return;
  throw new Error(`收款账户不能用于合同或 Invoice：${issues.map((issue) => issue.message).join('；')}`);
};

export const invoicePaymentForCreator = (
  creator: CreatorProfile | null | undefined,
  provider?: Provider,
) => createDocumentPayoutSnapshot(
  creator ? getPayoutAccountForProvider(creator.payoutAccounts, provider) : null,
  creator?.id,
);
