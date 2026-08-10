import type {
  PaymentListItem,
  PaymentListRecord,
  RequestApprovalReturnItem,
  RequestApprovalReturnIssueType,
} from './businessWorkflow';
import { paymentListEffectiveAccount, paymentListItemValue } from './businessWorkflow';
import { bankAddress, invoiceTotal } from './invoice/invoiceUtils';
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

export type FinanceReviewPageKind =
  | 'pair'
  | 'missing-invoice'
  | 'missing-payment'
  | 'duplicate-payment'
  | 'extra-payment'
  | 'empty-request';

export type FinanceReviewPaymentItemRef = {
  paymentListId: PaymentListRecord['paymentListId'];
  itemId: PaymentListItem['id'];
};

export type FinanceInvoiceReview = {
  key: string;
  kind: Exclude<FinanceReviewPageKind, 'extra-payment' | 'empty-request'>;
  invoiceId: GeneratedInvoiceRecord['invoiceId'];
  invoiceNumber: string;
  creatorName: string;
  paymentItems: FinanceReviewPaymentItemRef[];
  sourceVersions: string[];
  fields: FinanceReviewField[];
  mismatchCount: number;
};

export type FinanceReviewPage = FinanceInvoiceReview | {
  key: string;
  kind: 'extra-payment' | 'empty-request';
  invoiceId?: GeneratedInvoiceRecord['invoiceId'];
  invoiceNumber: string;
  creatorName: string;
  paymentItems: FinanceReviewPaymentItemRef[];
  sourceVersions: string[];
  fields: FinanceReviewField[];
  mismatchCount: number;
};

export type RequestFinanceReview = {
  invoices: FinanceInvoiceReview[];
  pages: FinanceReviewPage[];
  projectIssues: FinanceReviewField[];
  totalCount: number;
  pageCount: number;
  matchedCount: number;
  mismatchCount: number;
  fingerprint: string;
  canApprove: boolean;
};

export type FinanceReviewDecision =
  | { state: 'unreviewed' }
  | { state: 'correct'; reviewedAt: string }
  | {
      state: 'incorrect';
      issueType: RequestApprovalReturnIssueType;
      reason: string;
      reviewedAt: string;
    };

export type FinanceReviewSession = {
  requestId: string;
  approvalRound: number;
  reviewerAccount: string;
  fingerprint: string;
  decisions: Record<string, FinanceReviewDecision>;
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

const normalizeText = (value: unknown) => String(value ?? '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('en-US');

const normalizeCode = (value: unknown) => String(value ?? '')
  .replace(/\s+/g, '')
  .toUpperCase();

const paymentMethodLabel = (record: GeneratedInvoiceRecord) => (
  record.snapshot.paymentMethod === 'paypal' ? 'PayPal' : '银行转账'
);

const paymentItemMethodLabel = (item: PaymentListItem, list: PaymentListRecord) => {
  const account = paymentListEffectiveAccount(item);
  return account.transferMethod === 'PAYPAL' || list.provider === 'PayPal' ? 'PayPal' : '银行转账';
};

const invoiceVersionToken = (record: GeneratedInvoiceRecord) => (
  `invoice:${record.invoiceId}:v${record.version ?? 0}:${record.generatedAt}`
);

const paymentListVersionToken = (list: PaymentListRecord) => (
  `payment-list:${list.paymentListId}:v${list.version ?? 0}:${list.updatedAt}`
);

const reviewInvoice = (
  record: GeneratedInvoiceRecord,
  matches: Array<{ list: PaymentListRecord; item: PaymentListItem }>,
): FinanceInvoiceReview => {
  const paymentItems = matches.map(({ list, item }) => ({
    paymentListId: list.paymentListId,
    itemId: item.id,
  }));
  const sourceVersions = [
    invoiceVersionToken(record),
    ...matches.map(({ list }) => paymentListVersionToken(list)),
  ];
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
      key: `invoice:${record.invoiceId}`,
      kind: matches.length === 0 ? 'missing-payment' : 'duplicate-payment',
      invoiceId: record.invoiceId,
      invoiceNumber: record.id,
      creatorName: record.snapshot.creatorName,
      paymentItems,
      sourceVersions,
      fields,
      mismatchCount: 1,
    };
  }

  const { item, list } = first;
  const account = paymentListEffectiveAccount(item);
  const paymentDetails = account.paymentDetails;
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
    matchedField('real-name', 'Real Name', record.snapshot.from.legalName, item.snapshot.realName, normalizeText),
    matchedField('account-name', 'Account Name', record.snapshot.payment.accountName, paymentDetails?.accountName, normalizeText),
    matchedField('account-number', 'Account Number', record.snapshot.payment.accountNumber, paymentDetails?.accountNumber, normalizeCode),
    matchedField('bank-name', 'Beneficiary Bank Name', record.snapshot.payment.bankName, paymentDetails?.bankName, normalizeText),
    matchedField(
      'bank-address',
      'Beneficiary Bank Address',
      bankAddress(record.snapshot),
      paymentDetails ? bankAddress({ payment: paymentDetails }) : undefined,
      normalizeText,
    ),
    matchedField('swift-code', 'Swift Code', record.snapshot.payment.swiftCode, paymentDetails?.swiftCode, normalizeCode),
    matchedField('iban', 'IBAN (optional)', record.snapshot.payment.iban, paymentDetails?.iban, normalizeCode),
    reviewField('reason', '付款原因', '影音服务', paymentListItemValue(item, 'paymentReason')),
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
    key: `invoice:${record.invoiceId}`,
    kind: 'pair',
    invoiceId: record.invoiceId,
    invoiceNumber: record.id,
    creatorName: record.snapshot.creatorName,
    paymentItems,
    sourceVersions,
    fields,
    mismatchCount: fields.filter((field) => field.state === 'mismatch').length,
  };
};

export const financeReviewFingerprint = (pages: FinanceReviewPage[]) => pages.map((page) => JSON.stringify({
  key: page.key,
  kind: page.kind,
  invoiceId: page.invoiceId,
  paymentItems: page.paymentItems,
  sourceVersions: page.sourceVersions,
  fields: page.fields.map((field) => [
    field.id,
    field.invoiceValue,
    field.paymentValue,
    field.state,
  ]),
})).join('\n');

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
    const matches = requestLists.flatMap((list) => list.items
      .filter((item) => item.invoiceId === invoiceId)
      .map((item) => ({ list, item })));
    const record = invoices.find((invoice) => invoice.invoiceId === invoiceId);
    if (!record) {
      return {
        key: `invoice:${invoiceId}`,
        kind: 'missing-invoice' as const,
        invoiceId,
        invoiceNumber: String(invoiceId),
        creatorName: '未知达人',
        paymentItems: matches.map(({ list, item }) => ({
          paymentListId: list.paymentListId,
          itemId: item.id,
        })),
        sourceVersions: matches.map(({ list }) => paymentListVersionToken(list)),
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
    return reviewInvoice(record, matches);
  });
  const expectedInvoiceIds = new Set(invoiceIds);
  const extraPaymentPages: FinanceReviewPage[] = requestLists.flatMap((list) => list.items
    .filter((item) => !expectedInvoiceIds.has(item.invoiceId))
    .map((item): FinanceReviewPage => ({
      key: `extra:${list.paymentListId}:${item.id}`,
      kind: 'extra-payment',
      invoiceId: item.invoiceId,
      invoiceNumber: item.snapshot.invoiceNumber,
      creatorName: item.snapshot.creatorName,
      paymentItems: [{ paymentListId: list.paymentListId, itemId: item.id }],
      sourceVersions: [paymentListVersionToken(list)],
      fields: [{
        id: `extra-payment-item-${list.paymentListId}-${item.id}`,
        label: '付款清单额外明细',
        invoiceValue: '请款项目未关联该 Invoice',
        paymentValue: `${item.snapshot.invoiceNumber} · ${item.snapshot.creatorName}`,
        state: 'mismatch',
      }],
      mismatchCount: 1,
    })));
  const emptyRequestPages: FinanceReviewPage[] = reviews.length === 0 && extraPaymentPages.length === 0
    ? [{
        key: `request:${request.id}:missing-invoices`,
        kind: 'empty-request',
        invoiceNumber: '未关联 Invoice',
        creatorName: '未关联达人',
        paymentItems: [],
        sourceVersions: [],
        fields: [{
          id: 'request-missing-invoices',
          label: '请款项目关联',
          invoiceValue: '未找到 Invoice',
          paymentValue: '未找到付款明细',
          state: 'mismatch',
        }],
        mismatchCount: 1,
      }]
    : [];
  const pages: FinanceReviewPage[] = [...reviews, ...extraPaymentPages, ...emptyRequestPages];
  const projectIssues = [...extraPaymentPages, ...emptyRequestPages].flatMap((page) => page.fields);
  const mismatchCount = reviews.reduce((total, review) => total + review.mismatchCount, 0)
    + projectIssues.length;
  return {
    invoices: reviews,
    pages,
    projectIssues,
    totalCount: reviews.length,
    pageCount: pages.length,
    matchedCount: reviews.filter((review) => review.mismatchCount === 0).length,
    mismatchCount,
    fingerprint: financeReviewFingerprint(pages),
    canApprove: reviews.length > 0 && mismatchCount === 0,
  };
};

export const financeReviewSessionKey = (
  requestId: string,
  approvalRound: number,
  reviewerAccount: string,
) => `${requestId}:${approvalRound}:${reviewerAccount}`;

export const createFinanceReviewSession = ({
  requestId,
  approvalRound,
  reviewerAccount,
  review,
}: {
  requestId: string;
  approvalRound: number;
  reviewerAccount: string;
  review: RequestFinanceReview;
}): FinanceReviewSession => ({
  requestId,
  approvalRound,
  reviewerAccount,
  fingerprint: review.fingerprint,
  decisions: Object.fromEntries(review.pages.map((page) => [page.key, { state: 'unreviewed' }])),
});

export const reconcileFinanceReviewSession = (
  session: FinanceReviewSession | undefined,
  input: Parameters<typeof createFinanceReviewSession>[0],
) => {
  if (
    !session
    || session.requestId !== input.requestId
    || session.approvalRound !== input.approvalRound
    || session.reviewerAccount !== input.reviewerAccount
    || session.fingerprint !== input.review.fingerprint
  ) {
    return createFinanceReviewSession(input);
  }
  return session;
};

export const setFinanceReviewDecision = (
  session: FinanceReviewSession,
  pageKey: string,
  decision: Exclude<FinanceReviewDecision, { state: 'unreviewed' }>,
): FinanceReviewSession => {
  if (!(pageKey in session.decisions)) return session;
  return {
    ...session,
    decisions: { ...session.decisions, [pageKey]: decision },
  };
};

export const financeReviewSessionCanApprove = (
  session: FinanceReviewSession | undefined,
  review: RequestFinanceReview,
) => Boolean(
  session
  && session.fingerprint === review.fingerprint
  && review.canApprove
  && review.pages.length > 0
  && review.pages.every((page) => session.decisions[page.key]?.state === 'correct'),
);

export const financeReviewSessionCanReturn = (
  session: FinanceReviewSession | undefined,
  review: RequestFinanceReview,
) => Boolean(
  session
  && session.fingerprint === review.fingerprint
  && review.pages.length > 0
  && review.pages.every((page) => {
    const decision = session.decisions[page.key];
    return decision?.state === 'correct'
      || (
        decision?.state === 'incorrect'
        && Boolean(decision.issueType)
        && Boolean(decision.reason.trim())
      );
  })
  && review.pages.some((page) => session.decisions[page.key]?.state === 'incorrect'),
);

export const financeReviewReturnItems = (
  session: FinanceReviewSession,
  review: RequestFinanceReview,
): RequestApprovalReturnItem[] => review.pages.flatMap((page) => {
  const decision = session.decisions[page.key];
  return decision?.state === 'incorrect'
    ? [{
        pageKey: page.key,
        invoiceId: page.invoiceId,
        invoiceNumber: page.invoiceNumber,
        issueType: decision.issueType,
        reason: decision.reason,
        paymentItems: page.paymentItems,
      }]
    : [];
});

export const financeReviewReturnReason = (
  session: FinanceReviewSession,
  review: RequestFinanceReview,
) => financeReviewReturnItems(session, review)
  .map((item) => `${item.invoiceNumber}（${item.issueType === 'INVOICE_CONTENT' ? 'Invoice' : '付款清单'}）：${item.reason}`)
  .join('；');
