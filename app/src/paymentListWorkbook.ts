import {
  paymentListEffectiveAccount,
  paymentListItemValue,
  type PaymentListItem,
  type PaymentListRecord,
} from './businessWorkflow';
import { getAirwallexCountryProfile } from './airwallexFormSchema';
import { airwallexFeeOptions } from './batchTransfers';
import {
  getPayoutAccountFingerprint,
  getPayoutAccountId,
  getPayoutAccountVersion,
} from './payoutAccounts';
import type { AirwallexPayoutAccount, AirwallexTransferMethod, CreatorProfile } from './types';

export const AIRWALLEX_PAYMENT_LIST_SHEET = 'Airwallex batch transfer';

export const AIRWALLEX_PAYMENT_LIST_HEADERS = [
  '付款至',
  '付款方式',
  '收款方收到的币种',
  '您支付的币种',
  '付款金额（以您支付的币种表示）',
  'SWIFT 费用选项',
  '费用由哪方支付',
  '帐户名',
  'SWIFT 代码',
  '中间行 SWIFT 代码 (选填)',
  '银行帐号',
  '付款原因',
  '交易附言',
  '描述 (选填)',
  '收款方类型',
  '国家 / 地区',
  '街道地址',
  '城市',
  '洲 / 省',
  '邮政编码',
  '请求编号 (Request ID) (选填)',
] as const;

export type AirwallexPaymentListRow = {
  paymentDestination: string;
  paymentMethod: string;
  receiveCurrency: string;
  sourceCurrency: string;
  amount: number;
  swiftChargeOption: string | null;
  feePaidBy: string;
  accountName: string;
  swiftCode: string | null;
  intermediarySwiftCode: string | null;
  accountNumber: string;
  paymentReason: string;
  transactionReference: string;
  description: string | null;
  beneficiaryType: string;
  country: string;
  streetAddress: string;
  city: string;
  state: string | null;
  postcode: string;
  requestId: string;
};

export class PaymentListWorkbookError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super(issues[0] ?? '付款清单暂不能导出');
    this.name = 'PaymentListWorkbookError';
    this.issues = issues;
  }
}

const countryLabel = (countryCode: string, fallback = '') => (
  getAirwallexCountryProfile(countryCode)?.label || fallback || countryCode
);

export const paymentListAccountForItem = (
  item: PaymentListItem,
  creators: CreatorProfile[],
): AirwallexPayoutAccount | null => {
  const effectiveAccount = paymentListEffectiveAccount(item);
  const creator = creators.find((candidate) => candidate.id === item.snapshot.creatorId);
  const account = creator?.payoutAccounts.find((candidate) => (
    candidate.provider === 'Airwallex'
    && getPayoutAccountId(candidate) === effectiveAccount.payoutAccountId
  ));
  return account?.provider === 'Airwallex' ? account : null;
};

const feeValues = (item: PaymentListItem, transferMethod: AirwallexTransferMethod) => {
  const feeBearer = paymentListItemValue(item, 'feeBearer');
  const options = airwallexFeeOptions(transferMethod, feeBearer);
  return {
    swiftChargeOption: options.swiftChargeOption === 'PAYER'
      ? 'OUR'
      : options.swiftChargeOption === 'SHARED'
        ? 'SHA'
        : null,
    feePaidBy: options.feePaidBy === 'BENEFICIARY' ? '收款方' : '付款方',
  };
};

export const paymentListItemAccountIssues = (
  item: PaymentListItem,
  account: AirwallexPayoutAccount | null,
) => {
  const effectiveAccount = paymentListEffectiveAccount(item);
  const invoiceLabel = item.snapshot.invoiceNumber || String(item.invoiceId);
  const prefix = `${invoiceLabel}：`;
  return [
    effectiveAccount.provider !== 'Airwallex' ? `${prefix}Airwallex 模板与校验 API 不支持 ${effectiveAccount.provider || '未指定'} 收款账户` : '',
    !account ? `${prefix}达人档案中未找到关联的 Airwallex 收款账户` : '',
    account && getPayoutAccountVersion(account) !== effectiveAccount.payoutAccountVersion
      ? `${prefix}收款账户版本已变化`
      : '',
    account && getPayoutAccountFingerprint(account) !== effectiveAccount.accountFingerprint
      ? `${prefix}收款账户资料已变化`
      : '',
    account && account.beneficiaryId !== effectiveAccount.externalBeneficiaryId
      ? `${prefix}beneficiary ID 与付款清单快照不一致`
      : '',
    account && !['VALIDATED', 'VERIFIED'].includes(account.status)
      ? `${prefix}Airwallex 收款账户未通过验证`
      : '',
    account && !account.beneficiaryId ? `${prefix}Airwallex 收款账户缺少 beneficiary ID` : '',
    account && !account.bankDetails.bankCountryCode ? `${prefix}缺少银行国家或地区` : '',
    account && !account.bankDetails.accountName ? `${prefix}缺少账户名` : '',
    account && !(account.bankDetails.iban || account.bankDetails.accountNumber)
      ? `${prefix}缺少银行账号或 IBAN`
      : '',
    account && account.transferMethod === 'SWIFT' && !account.bankDetails.swiftCode
      ? `${prefix}SWIFT 付款缺少 SWIFT Code`
      : '',
    account && account.transferMethod === 'LOCAL' && !account.bankDetails.localClearingSystem
      ? `${prefix}LOCAL 付款缺少本地清算方式`
      : '',
    account && !account.address.countryCode ? `${prefix}缺少收款方国家或地区` : '',
    account && !account.address.streetAddress ? `${prefix}缺少收款方街道地址` : '',
    account && !account.address.city ? `${prefix}缺少收款方城市` : '',
    account && !account.address.postcode ? `${prefix}缺少收款方邮政编码` : '',
  ].filter(Boolean);
};

const itemIssues = (
  item: PaymentListItem,
  account: AirwallexPayoutAccount | null,
) => {
  const invoiceLabel = item.snapshot.invoiceNumber || String(item.invoiceId);
  const prefix = `${invoiceLabel}：`;
  const receiveCurrency = String(paymentListItemValue(item, 'receiveCurrency')).trim();
  const sourceCurrency = String(paymentListItemValue(item, 'currency')).trim();
  const amount = Number(paymentListItemValue(item, 'amount'));
  const feeBearer = paymentListItemValue(item, 'feeBearer');
  const paymentReason = String(paymentListItemValue(item, 'paymentReason')).trim();
  const transactionReference = String(paymentListItemValue(item, 'transactionReference')).trim();
  return [
    item.requiresRevalidation ? `${prefix}${item.validationIssues?.[0] ?? '付款行需要重新校验'}` : '',
    ...paymentListItemAccountIssues(item, account),
    !receiveCurrency ? `${prefix}缺少收款币种` : '',
    !sourceCurrency ? `${prefix}缺少支付币种` : '',
    !(amount > 0) ? `${prefix}付款金额必须大于 0` : '',
    !feeBearer ? `${prefix}手续费承担方未确认` : '',
    !paymentReason ? `${prefix}付款原因未填写` : '',
    !transactionReference ? `${prefix}交易附言未填写` : '',
  ].filter(Boolean);
};

export const buildAirwallexPaymentListRows = ({
  paymentList,
  creators,
  allowSubmitted = false,
}: {
  paymentList: PaymentListRecord;
  creators: CreatorProfile[];
  allowSubmitted?: boolean;
}): AirwallexPaymentListRow[] => {
  const issues = [
    !paymentList.items.length ? '付款清单没有可导出的付款行' : '',
    paymentList.provider !== 'Airwallex' ? `${paymentList.provider} 付款清单不能使用 Airwallex 模板导出` : '',
    paymentList.status === 'draft' ? '付款清单尚未生成锁定版本，暂不能导出' : '',
    paymentList.status === 'submitted' && !allowSubmitted ? '付款清单审批中，暂不能导出' : '',
  ].filter(Boolean);
  const resolved = paymentList.items.map((item) => {
    const account = paymentListAccountForItem(item, creators);
    issues.push(...itemIssues(item, account));
    return { item, account };
  });
  if (issues.length) throw new PaymentListWorkbookError([...new Set(issues)]);

  return resolved.map(({ item, account: resolvedAccount }) => {
    const account = resolvedAccount!;
    const fees = feeValues(item, account.transferMethod);
    return {
      paymentDestination: countryLabel(
        account.bankDetails.bankCountryCode,
        account.bankDetails.bankCountryName,
      ),
      paymentMethod: account.transferMethod === 'SWIFT' ? 'SWIFT 支付' : '本地支付',
      receiveCurrency: String(paymentListItemValue(item, 'receiveCurrency')).trim(),
      sourceCurrency: String(paymentListItemValue(item, 'currency')).trim(),
      amount: Number(paymentListItemValue(item, 'amount')),
      ...fees,
      accountName: account.bankDetails.accountName,
      swiftCode: account.transferMethod === 'SWIFT' ? account.bankDetails.swiftCode : null,
      intermediarySwiftCode: account.transferMethod === 'SWIFT'
        ? account.bankDetails.intermediaryBankSwiftCode || null
        : null,
      accountNumber: account.bankDetails.iban || account.bankDetails.accountNumber,
      paymentReason: String(paymentListItemValue(item, 'paymentReason')).trim(),
      transactionReference: String(paymentListItemValue(item, 'transactionReference')).trim(),
      description: String(paymentListItemValue(item, 'description')).trim() || null,
      beneficiaryType: account.entityType === 'COMPANY' ? '企业' : '个人',
      country: countryLabel(account.address.countryCode),
      streetAddress: account.address.streetAddress,
      city: account.address.city,
      state: account.address.state || null,
      postcode: account.address.postcode,
      requestId: item.id,
    };
  });
};

const WORKBOOK_COLUMNS: Array<{
  header: typeof AIRWALLEX_PAYMENT_LIST_HEADERS[number];
  key: keyof AirwallexPaymentListRow;
  width: number;
}> = [
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[0], key: 'paymentDestination', width: 18 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[1], key: 'paymentMethod', width: 16 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[2], key: 'receiveCurrency', width: 18 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[3], key: 'sourceCurrency', width: 16 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[4], key: 'amount', width: 24 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[5], key: 'swiftChargeOption', width: 18 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[6], key: 'feePaidBy', width: 18 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[7], key: 'accountName', width: 24 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[8], key: 'swiftCode', width: 18 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[9], key: 'intermediarySwiftCode', width: 24 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[10], key: 'accountNumber', width: 24 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[11], key: 'paymentReason', width: 18 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[12], key: 'transactionReference', width: 28 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[13], key: 'description', width: 28 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[14], key: 'beneficiaryType', width: 16 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[15], key: 'country', width: 18 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[16], key: 'streetAddress', width: 36 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[17], key: 'city', width: 18 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[18], key: 'state', width: 18 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[19], key: 'postcode', width: 16 },
  { header: AIRWALLEX_PAYMENT_LIST_HEADERS[20], key: 'requestId', width: 34 },
];

export const exportAirwallexPaymentListWorkbook = async ({
  paymentList,
  creators,
  allowSubmitted = false,
}: {
  paymentList: PaymentListRecord;
  creators: CreatorProfile[];
  allowSubmitted?: boolean;
}) => {
  const rows = buildAirwallexPaymentListRows({ paymentList, creators, allowSubmitted });
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'COMETS Pay';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(AIRWALLEX_PAYMENT_LIST_SHEET, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = WORKBOOK_COLUMNS;
  sheet.autoFilter = { from: 'A1', to: 'U1' };
  sheet.getRow(1).height = 46;
  sheet.getRow(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  rows.forEach((value) => {
    const row = sheet.addRow(value);
    row.height = 24;
    row.font = { name: 'Arial', size: 10 };
    row.alignment = { vertical: 'middle' };
    ['paymentDestination', 'paymentMethod', 'receiveCurrency', 'beneficiaryType', 'country'].forEach((key) => {
      row.getCell(key).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
    });
    row.getCell('amount').numFmt = '#,##0.00';
    [
      'swiftCode',
      'intermediarySwiftCode',
      'accountNumber',
      'postcode',
      'requestId',
    ].forEach((key) => {
      row.getCell(key).numFmt = '@';
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob(
    [new Uint8Array(buffer as ArrayBuffer)],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
};

const safeFilenamePart = (value: string) => (
  value.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'PROJECT'
);

export const paymentListWorkbookFilename = (
  projectCode: string,
  paymentList: PaymentListRecord,
) => `${['approved', 'paid'].includes(paymentList.status) ? '' : 'DRAFT-'}COMETS-PAY-${safeFilenamePart(projectCode)}-${safeFilenamePart(paymentList.paymentListCode)}.xlsx`;
