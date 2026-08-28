import { accountDisplayValue, emailDisplayValue } from '../accountPresentation';
import {
  normalizePaymentProviderName,
  paymentProviderDisplayName,
} from '../paymentProviderPresentation';
import type {
  DocumentPayoutSnapshot,
  InvoicePaymentMethod,
  PayoutAccountStatus,
  PayoutAccountVersion,
} from '../types';

export type InvoicePayoutAccountPresentationRow = {
  label: string;
  value: string;
};

const pendingValue = (value?: string, emptyLabel = '待接口返回') => (
  value?.trim() || emptyLabel
);

const validationStatusLabel = (status?: PayoutAccountStatus) => {
  if (status === 'VALIDATED' || status === 'VERIFIED') return '已审核通过';
  if (status === 'READY_FOR_VALIDATION') return '待校验';
  if (status === 'REVIEW_REQUIRED') return '待人工复核';
  if (status === 'CANNOT_VERIFY') return '无法验证';
  if (status === 'INVALID') return '校验失败';
  if (status === 'DISABLED') return '已停用';
  if (status === 'DRAFT') return '草稿';
  return '待接口返回';
};

const accountMetaRows = (
  snapshot: DocumentPayoutSnapshot,
  accountVersion?: PayoutAccountVersion,
  validationLabel?: string,
): InvoicePayoutAccountPresentationRow[] => [
  {
    label: '账户版本',
    value: accountVersion ?? snapshot.payoutAccountVersion ?? 'legacy-v1',
  },
  {
    label: '账户审核状态',
    value: validationLabel ?? validationStatusLabel(snapshot.validationStatus),
  },
];

export const invoicePayoutAccountPresentationRows = ({
  snapshot,
  provider,
  paymentMethod,
  accountVersion,
  validationLabel,
}: {
  snapshot: DocumentPayoutSnapshot;
  provider?: string;
  paymentMethod?: InvoicePaymentMethod;
  accountVersion?: PayoutAccountVersion;
  validationLabel?: string;
}): InvoicePayoutAccountPresentationRow[] => {
  const resolvedProvider = normalizePaymentProviderName(
    snapshot.payoutProvider
      ?? provider
      ?? (paymentMethod === 'paypal' ? 'PayPal' : undefined),
  );
  const channel = paymentProviderDisplayName(resolvedProvider ?? provider);
  const metaRows = accountMetaRows(snapshot, accountVersion, validationLabel);

  if (resolvedProvider === 'PayPal' || (!resolvedProvider && paymentMethod === 'paypal')) {
    return [
      { label: '付款渠道', value: 'PayPal' },
      { label: 'PayPal Name', value: pendingValue(snapshot.paypalUsername) },
      { label: 'PayPal Email', value: emailDisplayValue(snapshot.paypalEmail, '待接口返回') },
      { label: '转账备注', value: pendingValue(snapshot.transferRemarks, '未填写') },
      ...metaRows,
    ];
  }

  if (resolvedProvider === 'PayMax') {
    return [
      { label: '付款渠道', value: 'Payer Max' },
      { label: '收款主体', value: pendingValue(snapshot.accountName) },
      { label: 'Payer Max Account ID', value: accountDisplayValue(snapshot.accountNumber, '待接口返回') },
      { label: '国家 / 地区', value: pendingValue(snapshot.bankCountry) },
      { label: '账户币种', value: pendingValue(snapshot.accountCurrency) },
      ...metaRows,
    ];
  }

  const transferMethod = snapshot.transferMethod === 'LOCAL'
    ? '本地银行转账（LOCAL）'
    : snapshot.transferMethod === 'SWIFT'
      ? '国际电汇（SWIFT）'
      : '银行转账';
  return [
    { label: '付款渠道', value: channel },
    { label: '付款方式', value: transferMethod },
    { label: 'Account Name', value: pendingValue(snapshot.accountName) },
    {
      label: 'Account Number / IBAN',
      value: accountDisplayValue(snapshot.accountNumber || snapshot.iban, '待接口返回'),
    },
    { label: 'Bank Name', value: pendingValue(snapshot.bankName) },
    { label: 'SWIFT / BIC', value: pendingValue(snapshot.swiftCode) },
    ...(snapshot.transferMethod === 'LOCAL' ? [{
      label: '本地清算方式',
      value: pendingValue(snapshot.localClearingSystem),
    }] : []),
    { label: '国家 / 地区', value: pendingValue(snapshot.bankCountry) },
    { label: '账户币种', value: pendingValue(snapshot.accountCurrency) },
    ...metaRows,
  ];
};
