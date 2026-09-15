import type {
  ContractId,
  PaymentListItem,
  PaymentListRecord,
  RequestApprovalReturnItem,
  RequestApprovalReturnIssueType,
} from './businessWorkflow';
import { paymentListEffectiveAccount, paymentListItemValue } from './businessWorkflow';
import type { ContractRecord } from './contracts';
import { getAirwallexCountryProfile } from './airwallexFormSchema';
import { bankAddress, invoiceTotal } from './invoice/invoiceUtils';
import { currentInvoiceContractMatchReview } from './invoice/invoiceContractMatching';
import { paymentRequestInvoiceIds, type PaymentRequestProjectLike } from './paymentRequestProjects';
import type { GeneratedInvoiceRecord } from './types';

export type FinanceReviewFieldState = 'match' | 'mismatch' | 'review' | 'warning';

export type FinanceReviewField = {
  id: string;
  label: string;
  contractValue: string;
  invoiceValue: string;
  paymentValue: string;
  state: FinanceReviewFieldState;
  warning?: string;
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

export type FinanceReviewContractMismatchReview = {
  reason: string;
  actorName?: string;
  actorRole?: string;
  reviewedAt?: string;
};

export type FinanceInvoiceReview = {
  key: string;
  kind: Exclude<FinanceReviewPageKind, 'extra-payment' | 'empty-request'>;
  invoiceId: GeneratedInvoiceRecord['invoiceId'];
  invoiceNumber: string;
  creatorName: string;
  paymentItems: FinanceReviewPaymentItemRef[];
  sourceVersions: string[];
  contractMismatchReview?: FinanceReviewContractMismatchReview;
  fields: FinanceReviewField[];
  mismatchCount: number;
  warningCount: number;
};

export type FinanceReviewPage = FinanceInvoiceReview | {
  key: string;
  kind: 'extra-payment' | 'empty-request';
  invoiceId?: GeneratedInvoiceRecord['invoiceId'];
  invoiceNumber: string;
  creatorName: string;
  paymentItems: FinanceReviewPaymentItemRef[];
  sourceVersions: string[];
  contractMismatchReview?: FinanceReviewContractMismatchReview;
  fields: FinanceReviewField[];
  mismatchCount: number;
  warningCount: number;
};

export type RequestFinanceReview = {
  invoices: FinanceInvoiceReview[];
  pages: FinanceReviewPage[];
  projectIssues: FinanceReviewField[];
  totalCount: number;
  pageCount: number;
  matchedCount: number;
  mismatchCount: number;
  warningCount: number;
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
      contractIds?: ContractId[];
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

const normalizeText = (value: unknown) => String(value ?? '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('en-US');

const normalizeCode = (value: unknown) => String(value ?? '')
  .replace(/\s+/g, '')
  .toUpperCase();

const invoiceVersionToken = (record: GeneratedInvoiceRecord) => (
  `invoice:${record.invoiceId}:v${record.version ?? 0}:${record.generatedAt}`
);

const paymentListVersionToken = (list: PaymentListRecord) => (
  `payment-list:${list.paymentListId}:v${list.version ?? 0}:${list.updatedAt}`
);

const stableContractId = (contract: ContractRecord) => contract.contractId ?? contract.id;

const contractVersionToken = (contract: ContractRecord) => (
  `contract:${stableContractId(contract)}:v${contract.generationVersion ?? 0}:${contract.updated}`
);

export const contractsForFinanceReviewPage = ({
  page,
  invoice,
  request,
  contracts,
  paymentLists,
}: {
  page?: FinanceReviewPage;
  invoice?: GeneratedInvoiceRecord;
  request: Pick<PaymentRequestProjectLike, 'creatorLinks'>;
  contracts: ContractRecord[];
  paymentLists: PaymentListRecord[];
}) => {
  const paymentItems = (page?.paymentItems ?? []).flatMap((reference) => {
    const list = paymentLists.find((candidate) => candidate.paymentListId === reference.paymentListId);
    const item = list?.items.find((candidate) => candidate.id === reference.itemId);
    return item ? [item] : [];
  });
  const invoiceIds = new Set<string>([
    ...(invoice?.invoiceId ? [String(invoice.invoiceId)] : []),
    ...(page?.invoiceId ? [String(page.invoiceId)] : []),
  ]);
  const engagementIds = new Set<string>([
    ...(invoice?.snapshot.engagementId ? [String(invoice.snapshot.engagementId)] : []),
    ...paymentItems.map((item) => String(item.engagementId)),
  ]);
  const contractIds = new Set<string>();
  const addContractIds = (ids?: readonly string[]) => {
    ids?.forEach((id) => contractIds.add(String(id)));
  };

  addContractIds(invoice?.snapshot.contractIds);
  paymentItems.forEach((item) => addContractIds(item.snapshot.contractIds));
  request.creatorLinks
    ?.filter((link) => (
      link.invoiceIds.some((id) => invoiceIds.has(String(id)))
      || engagementIds.has(String(link.engagementId))
    ))
    .forEach((link) => addContractIds(link.contractIds));

  return contracts.filter((contract) => contractIds.has(String(stableContractId(contract))));
};

const hasValue = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';

const contractFieldValue = (
  contracts: ContractRecord[],
  getValue: (contract: ContractRecord) => unknown,
) => {
  const values = contracts.flatMap((contract) => {
    const value = getValue(contract);
    return hasValue(value) ? [display(value)] : [];
  });
  return values.length ? values.join('\n') : '—';
};

const contractHasDifference = (
  contracts: ContractRecord[],
  getValue: (contract: ContractRecord) => unknown,
  targets: unknown[],
  normalize: (value: unknown) => unknown,
) => contracts.some((contract) => {
  const value = getValue(contract);
  return hasValue(value) && targets.some((target) => (
    hasValue(target) && normalize(value) !== normalize(target)
  ));
});

const tripleField = ({
  id,
  label,
  contracts,
  getContractValue,
  invoiceValue,
  paymentValue,
  normalize = (value: unknown) => value,
  manual = false,
  compareContract = true,
  ignoreInvoicePayment = false,
  reviewWhenNoContract = false,
  required = false,
}: {
  id: string;
  label: string;
  contracts: ContractRecord[];
  getContractValue: (contract: ContractRecord) => unknown;
  invoiceValue: unknown;
  paymentValue: unknown;
  normalize?: (value: unknown) => unknown;
  manual?: boolean;
  compareContract?: boolean;
  ignoreInvoicePayment?: boolean;
  reviewWhenNoContract?: boolean;
  required?: boolean;
}): FinanceReviewField => {
  const requiredValueMissing = required && (!hasValue(invoiceValue) || !hasValue(paymentValue));
  const invoicePaymentMismatch = !ignoreInvoicePayment
    && (requiredValueMissing || normalize(invoiceValue) !== normalize(paymentValue));
  const contractMismatch = compareContract
    && contracts.length > 0
    && contractHasDifference(contracts, getContractValue, [invoiceValue, paymentValue], normalize);
  const paymentOnlyContractMismatch = compareContract
    && contracts.length > 0
    && contractHasDifference(contracts, getContractValue, [paymentValue], normalize);
  const state: FinanceReviewFieldState = manual
    ? 'review'
    : invoicePaymentMismatch
      ? 'mismatch'
      : contractMismatch || paymentOnlyContractMismatch
        ? id === 'real-name' ? 'mismatch' : 'warning'
        : reviewWhenNoContract && !contracts.length
          ? 'review'
          : 'match';
  return {
    id,
    label,
    contractValue: contractFieldValue(contracts, getContractValue),
    invoiceValue: display(invoiceValue),
    paymentValue: display(paymentValue),
    state,
    ...(state === 'warning' ? { warning: '合同信息需核对' } : {}),
  };
};

const accountSnapshotValue = (
  getValue: (snapshot: NonNullable<ContractRecord['paymentSnapshot']>) => unknown,
) => (contract: ContractRecord) => {
  const snapshot = contract.paymentSnapshot;
  return snapshot ? getValue(snapshot) : undefined;
};

const fieldCounts = (fields: FinanceReviewField[]) => ({
  mismatchCount: fields.filter((field) => field.state === 'mismatch').length,
  warningCount: fields.filter((field) => field.state === 'warning').length,
});

const reviewInvoice = (
  record: GeneratedInvoiceRecord,
  matches: Array<{ list: PaymentListRecord; item: PaymentListItem }>,
  contracts: ContractRecord[],
): FinanceInvoiceReview => {
  const storedContractMatchReview = currentInvoiceContractMatchReview(record);
  const contractMismatchReview = storedContractMatchReview?.reason?.trim()
    ? {
        reason: storedContractMatchReview.reason.trim(),
        actorName: storedContractMatchReview.actorName,
        actorRole: storedContractMatchReview.actorRole,
        reviewedAt: storedContractMatchReview.reviewedAt,
      }
    : undefined;
  const paymentItems = matches.map(({ list, item }) => ({
    paymentListId: list.paymentListId,
    itemId: item.id,
  }));
  const sourceVersions = [
    invoiceVersionToken(record),
    ...matches.map(({ list }) => paymentListVersionToken(list)),
    ...contracts.map(contractVersionToken),
  ];
  const first = matches[0];
  if (!first || matches.length !== 1) {
    const fields: FinanceReviewField[] = [{
      id: 'association',
      label: '付款明细关联',
      contractValue: '—',
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
      contractMismatchReview,
      fields,
      mismatchCount: 1,
      warningCount: 0,
    };
  }

  const { item, list } = first;
  const effectiveAccount = paymentListEffectiveAccount(item);
  const account = item.executionAccountOverride ? item.snapshot : effectiveAccount;
  const paymentDetails = account.paymentDetails;
  const currency = display(paymentListItemValue(item, 'currency'));
  const amount = Number(paymentListItemValue(item, 'amount') || 0);
  const invoiceAmount = invoiceTotal(record.snapshot);
  const invoiceRealName = record.snapshot.from.legalName;
  const paymentRealName = item.snapshot.realName;
  const invoiceAmountValue = invoiceAmount > 0 ? money(record.snapshot.currency, invoiceAmount) : undefined;
  const paymentAmountValue = currency !== '未填写' && amount > 0 ? money(currency, amount) : undefined;
  const paymentSchemaContext = [
    account.schemaKey,
    paymentDetails?.bankCountry,
  ].filter(Boolean).join(' ');
  const schemaCountryCode = account.schemaKey?.split(':')[1] ?? '';
  const ibanRequiredScenario = Boolean(getAirwallexCountryProfile(schemaCountryCode)?.ibanPreferred)
    || /(?:SEPA|IBAN|Spain|France|Italy|西班牙|法国|意大利)/i.test(paymentSchemaContext);
  const accountFields: FinanceReviewField[] = account.provider === 'Airwallex'
    ? [
      tripleField({
        id: 'account-name',
        label: 'Account Name',
        contracts,
        getContractValue: (contract) => contract.paymentSnapshot?.accountName ?? contract.accountName,
        invoiceValue: record.snapshot.payment.accountName,
        paymentValue: paymentDetails?.accountName,
        normalize: normalizeText,
        required: true,
      }),
      ...(
        hasValue(record.snapshot.payment.accountNumber)
        || hasValue(paymentDetails?.accountNumber)
        || account.transferMethod === 'SWIFT'
        || !ibanRequiredScenario
          ? [tripleField({
            id: 'account-number',
            label: 'Account Number',
            contracts,
            getContractValue: accountSnapshotValue((snapshot) => snapshot.accountNumber),
            invoiceValue: record.snapshot.payment.accountNumber,
            paymentValue: paymentDetails?.accountNumber,
            normalize: normalizeCode,
            required: true,
          })]
          : []
      ),
      tripleField({
        id: 'bank-name',
        label: 'Beneficiary Bank Name',
        contracts,
        getContractValue: accountSnapshotValue((snapshot) => snapshot.bankName),
        invoiceValue: record.snapshot.payment.bankName,
        paymentValue: paymentDetails?.bankName,
        normalize: normalizeText,
        required: true,
      }),
      tripleField({
        id: 'bank-address',
        label: 'Beneficiary Bank Address',
        contracts,
        getContractValue: accountSnapshotValue((snapshot) => bankAddress({ payment: snapshot })),
        invoiceValue: bankAddress(record.snapshot),
        paymentValue: paymentDetails ? bankAddress({ payment: paymentDetails }) : undefined,
        normalize: normalizeText,
        required: true,
      }),
      ...(
        account.transferMethod === 'SWIFT'
        || hasValue(record.snapshot.payment.swiftCode)
        || hasValue(paymentDetails?.swiftCode)
          ? [tripleField({
            id: 'swift-code',
            label: 'Swift Code',
            contracts,
            getContractValue: accountSnapshotValue((snapshot) => snapshot.swiftCode),
            invoiceValue: record.snapshot.payment.swiftCode,
            paymentValue: paymentDetails?.swiftCode,
            normalize: normalizeCode,
            required: true,
          })]
          : []
      ),
      ...(
        hasValue(record.snapshot.payment.iban)
        || hasValue(paymentDetails?.iban)
        || ibanRequiredScenario
          ? [tripleField({
            id: 'iban',
            label: 'IBAN',
            contracts,
            getContractValue: accountSnapshotValue((snapshot) => snapshot.iban),
            invoiceValue: record.snapshot.payment.iban,
            paymentValue: paymentDetails?.iban,
            normalize: normalizeCode,
            required: true,
          })]
          : []
      ),
    ]
    : [];
  const fields: FinanceReviewField[] = [
    tripleField({
      id: 'amount',
      label: '币种与金额',
      contracts,
      getContractValue: (contract) => contract.totalFee == null ? undefined : money(contract.currency, contract.totalFee),
      invoiceValue: invoiceAmountValue,
      paymentValue: paymentAmountValue,
      normalize: normalizeCode,
      required: true,
    }),
    tripleField({
      id: 'real-name',
      label: 'Real Name / Company Name',
      contracts,
      getContractValue: (contract) => contract.publisher,
      invoiceValue: invoiceRealName,
      paymentValue: paymentRealName,
      normalize: normalizeText,
      required: true,
    }),
    ...accountFields,
    ...(item.executionAccountOverride ? [{
      id: 'execution-account-override',
      label: '付款失败执行账户覆盖',
      contractValue: '—',
      invoiceValue: item.snapshot.accountSummary,
      paymentValue: `${effectiveAccount.accountSummary} · ${item.executionAccountOverride.reason}`,
      state: item.executionAccountOverride.status === 'FINANCE_CONFIRMED' ? 'match' as const : 'mismatch' as const,
      warning: item.executionAccountOverride.status === 'FINANCE_CONFIRMED'
        ? 'Invoice 签署账户保持不变；本次执行账户已由财务确认。'
        : '新执行账户尚未完成财务确认。',
    }] : []),
    tripleField({
      id: 'reason',
      label: '付款原因',
      contracts,
      getContractValue: () => undefined,
      invoiceValue: '影音服务',
      paymentValue: paymentListItemValue(item, 'paymentReason'),
      manual: true,
      compareContract: false,
    }),
    tripleField({
      id: 'fee',
      label: '费用承担',
      contracts,
      getContractValue: (contract) => contract.feeBearer,
      invoiceValue: undefined,
      paymentValue: paymentListItemValue(item, 'feeBearer'),
      normalize: normalizeText,
      ignoreInvoicePayment: true,
      reviewWhenNoContract: true,
    }),
    tripleField({
      id: 'reference',
      label: '交易附言',
      contracts,
      getContractValue: () => undefined,
      invoiceValue: record.snapshot.invoiceNumber,
      paymentValue: paymentListItemValue(item, 'transactionReference'),
      manual: true,
      compareContract: false,
    }),
  ];
  if (item.requiresRevalidation || item.validationIssues?.length) {
    fields.push({
      id: 'validation',
      label: '付款账户校验',
      contractValue: '—',
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
    contractMismatchReview,
    fields,
    ...fieldCounts(fields),
  };
};

export const financeReviewFingerprint = (pages: FinanceReviewPage[]) => pages.map((page) => JSON.stringify({
  key: page.key,
  kind: page.kind,
  invoiceId: page.invoiceId,
  paymentItems: page.paymentItems,
  sourceVersions: page.sourceVersions,
  contractMismatchReview: page.contractMismatchReview,
  fields: page.fields.map((field) => [
    field.id,
    field.contractValue,
    field.invoiceValue,
    field.paymentValue,
    field.state,
    field.warning,
  ]),
})).join('\n');

export const buildRequestFinanceReview = (
  request: PaymentRequestProjectLike,
  invoices: GeneratedInvoiceRecord[],
  paymentLists: PaymentListRecord[],
  contracts: ContractRecord[] = [],
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
          contractValue: '—',
          invoiceValue: '未找到 Invoice',
          paymentValue: '无法核对付款清单',
          state: 'mismatch' as const,
        }],
        mismatchCount: 1,
        warningCount: 0,
      };
    }
    const pageContracts = contractsForFinanceReviewPage({
      page: { paymentItems: matches.map(({ list, item }) => ({ paymentListId: list.paymentListId, itemId: item.id })), invoiceId } as FinanceReviewPage,
      invoice: record,
      request,
      contracts,
      paymentLists,
    });
    return reviewInvoice(record, matches, pageContracts);
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
        contractValue: '—',
        invoiceValue: '请款项目未关联该 Invoice',
        paymentValue: `${item.snapshot.invoiceNumber} · ${item.snapshot.creatorName}`,
        state: 'mismatch',
      }],
      mismatchCount: 1,
      warningCount: 0,
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
          contractValue: '—',
          invoiceValue: '未找到 Invoice',
          paymentValue: '未找到付款明细',
          state: 'mismatch',
        }],
        mismatchCount: 1,
        warningCount: 0,
      }]
    : [];
  const pages: FinanceReviewPage[] = [...reviews, ...extraPaymentPages, ...emptyRequestPages];
  const projectIssues = [...extraPaymentPages, ...emptyRequestPages].flatMap((page) => page.fields);
  const mismatchCount = reviews.reduce((total, review) => total + review.mismatchCount, 0)
    + projectIssues.length;
  const warningCount = pages.reduce((total, page) => total + page.warningCount, 0);
  return {
    invoices: reviews,
    pages,
    projectIssues,
    totalCount: reviews.length,
    pageCount: pages.length,
    matchedCount: reviews.filter((review) => review.mismatchCount === 0).length,
    mismatchCount,
    warningCount,
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
        && (
          decision.issueType !== 'CONTRACT_CONTENT'
          || decision.contractIds?.length === 1
        )
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
        contractIds: decision.contractIds?.length ? [...decision.contractIds] : undefined,
        paymentItems: page.paymentItems,
      }]
    : [];
});

export const financeReviewReturnReason = (
  session: FinanceReviewSession,
  review: RequestFinanceReview,
) => financeReviewReturnItems(session, review)
  .map((item) => {
    const issueLabel: Record<RequestApprovalReturnIssueType, string> = {
      INVOICE_CONTENT: 'Invoice',
      PAYMENT_LIST: '付款清单',
      CONTRACT_CONTENT: '合同',
      FULL_ITEM: '整笔请款',
    };
    const contractScope = item.contractIds?.length
      ? ` · 合同范围：${item.contractIds.join('、')}`
      : '';
    return `${item.invoiceNumber}（${issueLabel[item.issueType]}${contractScope}）：${item.reason}`;
  })
  .join('；');
