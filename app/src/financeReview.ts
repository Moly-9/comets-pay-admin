import type { PaymentListItem, PaymentListRecord } from './businessWorkflow';
import { paymentListEffectiveAccount, paymentListItemValue } from './businessWorkflow';
import { invoiceTotal } from './invoice/invoiceUtils';
import { paymentRequestInvoiceIds, type PaymentRequestProjectLike } from './paymentRequestProjects';
import type { GeneratedInvoiceRecord } from './types';

export type FinanceReviewFieldState = 'match' | 'mismatch' | 'review';

export type FinanceReviewField = {
  id: string;
  label: string;
  invoiceValue: string;
  paymentValue: string;
  state: FinanceReviewFieldState;
};

export type FinanceInvoiceReview = {
  invoiceId: GeneratedInvoiceRecord['invoiceId'];
  invoiceNumber: string;
  creatorName: string;
  fields: FinanceReviewField[];
  mismatchCount: number;
};

export type RequestFinanceReview = {
  invoices: FinanceInvoiceReview[];
  projectIssues: FinanceReviewField[];
  totalCount: number;
  matchedCount: number;
  mismatchCount: number;
  canApprove: boolean;
};

const display = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '未填写';
  return String(value);
};

const money = (currency: string, amount: number) => `${currency} ${amount.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const matchedField = (
  id: string,
  label: string,
  invoiceValue: unknown,
  paymentValue: unknown,
  normalize: (value: unknown) => unknown = (value) => value,
): FinanceReviewField => ({
  id,
  label,
  invoiceValue: display(invoiceValue),
  paymentValue: display(paymentValue),
  state: normalize(invoiceValue) === normalize(paymentValue) ? 'match' : 'mismatch',
});

const reviewField = (
  id: string,
  label: string,
  invoiceValue: unknown,
  paymentValue: unknown,
): FinanceReviewField => ({
  id,
  label,
  invoiceValue: display(invoiceValue),
  paymentValue: display(paymentValue),
  state: 'review',
});

const paymentMethodLabel = (record: GeneratedInvoiceRecord) => (
  record.snapshot.paymentMethod === 'paypal' ? 'PayPal' : '银行转账'
);

const paymentItemMethodLabel = (item: PaymentListItem, list: PaymentListRecord) => {
  const account = paymentListEffectiveAccount(item);
  return account.transferMethod === 'PAYPAL' || list.provider === 'PayPal' ? 'PayPal' : '银行转账';
};

const invoiceDescription = (record: GeneratedInvoiceRecord) => (
  record.snapshot.items.map((item) => item.description).filter(Boolean).join('；') || '未填写'
);

const invoiceAccountSummary = (record: GeneratedInvoiceRecord) => {
  const value = record.snapshot.paymentMethod === 'paypal'
    ? record.snapshot.payment.paypalEmail || record.snapshot.payment.paypalUsername
    : record.snapshot.payment.iban || record.snapshot.payment.accountNumber;
  if (!value) return '未填写';
  if (value.includes('@')) {
    const [localPart, domain = ''] = value.split('@');
    return `${localPart.slice(0, 1) || '*'}***@${domain}`;
  }
  const compact = value.replace(/\s/g, '');
  return `•••• ${compact.slice(-4)}`;
};

const reviewInvoice = (
  record: GeneratedInvoiceRecord,
  matches: Array<{ list: PaymentListRecord; item: PaymentListItem }>,
): FinanceInvoiceReview => {
  const first = matches[0];
  if (!first || matches.length !== 1) {
    const fields: FinanceReviewField[] = [{
      id: 'association',
      label: '付款明细关联',
      invoiceValue: record.id,
      paymentValue: matches.length === 0 ? '未找到付款明细' : `找到 ${matches.length} 条付款明细`,
      state: 'mismatch',
    }];
    return {
      invoiceId: record.invoiceId,
      invoiceNumber: record.id,
      creatorName: record.snapshot.creatorName,
      fields,
      mismatchCount: 1,
    };
  }

  const { item, list } = first;
  const account = paymentListEffectiveAccount(item);
  const currency = display(paymentListItemValue(item, 'currency'));
  const amount = Number(paymentListItemValue(item, 'amount') || 0);
  const invoiceAmount = invoiceTotal(record.snapshot);
  const invoiceProvider = record.snapshot.paymentMethod === 'paypal'
    ? 'PayPal'
    : record.snapshot.payoutProvider ?? 'Airwallex';
  const fields: FinanceReviewField[] = [
    matchedField('invoice-number', 'Invoice 编号', record.snapshot.invoiceNumber, item.snapshot.invoiceNumber),
    matchedField('creator', '达人稳定 ID', record.snapshot.creatorId, item.snapshot.creatorId),
    matchedField('engagement', '合作关系 ID', record.snapshot.engagementId, item.engagementId),
    matchedField('project', '项目稳定 ID', record.snapshot.projectId, list.projectId),
    matchedField(
      'amount',
      '币种与金额',
      money(record.snapshot.currency, invoiceAmount),
      money(currency, amount),
    ),
    matchedField('provider', '付款渠道', invoiceProvider, account.provider || list.provider),
    matchedField('method', '付款方式', paymentMethodLabel(record), paymentItemMethodLabel(item, list)),
    matchedField('account-id', '收款账户 ID', record.snapshot.payoutAccountId, account.payoutAccountId),
    matchedField('account-version', '账户版本', record.snapshot.payoutAccountVersion, account.payoutAccountVersion),
    matchedField('account-fingerprint', '账户指纹', record.snapshot.payoutAccountFingerprint, account.accountFingerprint),
    reviewField('account-summary', '脱敏账户信息', invoiceAccountSummary(record), account.accountSummary),
    reviewField('reason', '付款原因', invoiceDescription(record), paymentListItemValue(item, 'paymentReason')),
    reviewField('fee', '费用承担', 'Invoice 未单列', paymentListItemValue(item, 'feeBearer')),
    reviewField('reference', '交易附言', record.snapshot.invoiceNumber, paymentListItemValue(item, 'transactionReference')),
  ];
  if (item.requiresRevalidation || item.validationIssues?.length) {
    fields.push({
      id: 'validation',
      label: '付款账户校验',
      invoiceValue: '账户快照有效',
      paymentValue: item.validationIssues?.join('；') || '需要重新校验',
      state: 'mismatch',
    });
  }
  return {
    invoiceId: record.invoiceId,
    invoiceNumber: record.id,
    creatorName: record.snapshot.creatorName,
    fields,
    mismatchCount: fields.filter((field) => field.state === 'mismatch').length,
  };
};

export const buildRequestFinanceReview = (
  request: PaymentRequestProjectLike,
  invoices: GeneratedInvoiceRecord[],
  paymentLists: PaymentListRecord[],
): RequestFinanceReview => {
  const expectedIds = paymentRequestInvoiceIds(request.creatorLinks ?? []);
  const invoiceIds = expectedIds.length ? expectedIds : request.invoiceIds ?? [];
  const requestLists = paymentLists.filter((list) => (
    request.paymentRequestProjectId
      ? list.paymentRequestProjectId === request.paymentRequestProjectId
      : 'projectId' in request && request.projectId
        ? list.projectId === request.projectId
        : false
  ));
  const reviews = invoiceIds.map((invoiceId) => {
    const record = invoices.find((invoice) => invoice.invoiceId === invoiceId);
    if (!record) {
      return {
        invoiceId,
        invoiceNumber: String(invoiceId),
        creatorName: '未知达人',
        fields: [{
          id: 'invoice-missing',
          label: 'Invoice 记录',
          invoiceValue: '未找到 Invoice',
          paymentValue: '无法核对付款清单',
          state: 'mismatch' as const,
        }],
        mismatchCount: 1,
      };
    }
    const matches = requestLists.flatMap((list) => list.items
      .filter((item) => item.invoiceId === invoiceId)
      .map((item) => ({ list, item })));
    return reviewInvoice(record, matches);
  });
  const expectedInvoiceIds = new Set(invoiceIds);
  const projectIssues = requestLists.flatMap((list) => list.items
    .filter((item) => !expectedInvoiceIds.has(item.invoiceId))
    .map((item): FinanceReviewField => ({
      id: `extra-payment-item-${list.paymentListId}-${item.id}`,
      label: '付款清单额外明细',
      invoiceValue: '请款项目未关联该 Invoice',
      paymentValue: `${item.snapshot.invoiceNumber} · ${item.snapshot.creatorName}`,
      state: 'mismatch',
    })));
  const mismatchCount = reviews.reduce((total, review) => total + review.mismatchCount, 0)
    + projectIssues.length;
  return {
    invoices: reviews,
    projectIssues,
    totalCount: reviews.length,
    matchedCount: reviews.filter((review) => review.mismatchCount === 0).length,
    mismatchCount,
    canApprove: reviews.length > 0 && mismatchCount === 0,
  };
};
