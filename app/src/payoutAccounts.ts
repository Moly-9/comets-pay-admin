import type {
  AirwallexBankDetails,
  AirwallexPayoutAccount,
  AirwallexTransferMethod,
  BeneficiaryAddress,
  CreatorPaymentDetails,
  CreatorPayoutAccount,
  CreatorProfile,
  PayMaxPayoutAccount,
  PayPalPayoutAccount,
  PayoutAccountStatus,
  Provider,
} from './types';
import {
  AIRWALLEX_SCHEMA_COUNTRIES,
  AIRWALLEX_SCHEMA_CURRENCIES,
  generateLocalAirwallexFormSchema,
  getAirwallexCountryProfile,
  validateAirwallexFormSchema,
} from './airwallexFormSchema';

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
}: Partial<PayPalPayoutAccount> & { id: string }): PayPalPayoutAccount => ({
  id,
  provider: 'PayPal',
  nickname,
  isDefault,
  status,
  paypalUsername,
  paypalEmail,
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
}: Partial<PayMaxPayoutAccount> & { id: string }): PayMaxPayoutAccount => ({
  id,
  provider: 'PayMax',
  nickname,
  isDefault,
  status,
  beneficiaryName,
  payermaxAccountId,
  countryCode,
  currency,
  email,
});

export const createEmptyAirwallexAccount = (
  creatorName = '',
  notificationEmail = '',
): AirwallexPayoutAccount => {
  const nameParts = creatorName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts.slice(1).join(' ');
  return createAirwallexPayoutAccount({
    id: `awx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
): PayPalPayoutAccount => createPayPalPayoutAccount({
  id: `paypal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  nickname: '新的 PayPal 账户',
  status: creatorName.trim() && /^\S+@\S+\.\S+$/.test(email) ? 'READY_FOR_VALIDATION' : 'DRAFT',
  paypalUsername: creatorName,
  paypalEmail: email,
});

export const createEmptyPayMaxAccount = (
  creatorName = '',
  email = '',
): PayMaxPayoutAccount => createPayMaxPayoutAccount({
  id: `payermax-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

export const payoutAccountToInvoicePayment = (
  account: CreatorPayoutAccount | null,
): CreatorPaymentDetails => {
  if (!account) return { ...EMPTY_INVOICE_PAYMENT };
  if (account.provider === 'PayPal') {
    return {
      ...EMPTY_INVOICE_PAYMENT,
      paypalUsername: account.paypalUsername,
      paypalEmail: account.paypalEmail,
    };
  }
  if (account.provider === 'PayMax') {
    return {
      ...EMPTY_INVOICE_PAYMENT,
      accountName: account.beneficiaryName,
      accountNumber: account.payermaxAccountId,
      bankCountry: account.countryCode,
    };
  }
  return {
    ...EMPTY_INVOICE_PAYMENT,
    bankCountry: account.bankDetails.bankCountryName,
    accountName: account.bankDetails.accountName,
    accountType: account.bankDetails.bankAccountCategory,
    swiftCode: account.bankDetails.swiftCode,
    accountNumber: account.bankDetails.accountNumber,
    iban: account.bankDetails.iban,
    beneficiaryType: account.entityType,
    bankName: account.bankDetails.bankName,
    bankStreetAddress: account.bankDetails.bankStreetAddress,
    bankState: account.bankDetails.bankState,
    intermediaryBankCode: account.bankDetails.intermediaryBankSwiftCode,
  };
};

export const invoicePaymentForCreator = (
  creator: CreatorProfile | null | undefined,
  provider?: Provider,
) => payoutAccountToInvoicePayment(
  creator ? getPayoutAccountForProvider(creator.payoutAccounts, provider) : null,
);
