import type { ContractRecord } from '../contracts';
import { accountDisplayValue } from '../accountPresentation';
import type {
  DocumentPayoutSnapshot,
  GeneratedInvoiceRecord,
  InvoiceContractMatchField,
  InvoiceContractMatchIssue,
  InvoiceContractMatchReview,
  InvoiceDocumentModel,
  InvoicePaymentAccountDifference,
} from '../types';
import { payoutSnapshotForContract } from './invoiceDraft';
import { formatInvoiceMoney, invoiceTotal } from './invoiceUtils';

export type InvoiceContractMatchCheck = {
  field: InvoiceContractMatchField;
  label: string;
  contractValue: string;
  invoiceValue: string;
  state: 'MATCH' | 'NOT_APPLICABLE' | 'BLOCKER' | 'REASON_REQUIRED' | 'APPROVED_WITH_REASON';
  message: string;
  paymentAccountDifference?: InvoicePaymentAccountDifference;
};

export type InvoiceContractMatchActor = {
  account: string;
  name: string;
  role: string;
};

export type InvoiceContractMatchOptions = {
  paymentAccountPending?: boolean;
};

const FIELD_LABELS: Record<InvoiceContractMatchField, string> = {
  PUBLISHER: 'From',
  ADVERTISER: 'Bill To',
  AMOUNT: '应付金额',
  CURRENCY: '币种',
  PAYMENT_ACCOUNT: '付款账户',
};

const normalizedText = (value: unknown) => String(value ?? '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase();

const sameText = (left: unknown, right: unknown) => normalizedText(left) === normalizedText(right);
const populated = (value: unknown) => normalizedText(value).length > 0;
const uniqueValues = (values: unknown[]) => [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
const contractReference = (contract: ContractRecord) => contract.id || String(contract.contractId ?? '未编号合同');
const contractIds = (contracts: ContractRecord[]) => contracts.flatMap((contract) => (
  contract.contractId ? [contract.contractId] : []
));

const paymentMethodForContract = (contract: ContractRecord, snapshot: DocumentPayoutSnapshot | null) => {
  const method = contract.paymentMethod || snapshot?.payoutProvider || '';
  if (String(method).toUpperCase() === 'PAYPAL') return 'PAYPAL';
  if (populated(method)) return 'BANK';
  return '';
};

const paymentMethodForInvoice = (model: InvoiceDocumentModel) => (
  model.paymentMethod === 'paypal' ? 'PAYPAL' : 'BANK'
);

type AccountField = {
  label: string;
  contractValue: unknown;
  invoiceValue: unknown;
  compact?: boolean;
  technical?: boolean;
};

const accountFields = (
  contract: ContractRecord,
  model: InvoiceDocumentModel,
): AccountField[] => {
  const snapshot = payoutSnapshotForContract(contract);
  const contractMethod = paymentMethodForContract(contract, snapshot);
  const invoiceMethod = paymentMethodForInvoice(model);
  const fields: AccountField[] = [
    { label: '付款方式', contractValue: contractMethod, invoiceValue: invoiceMethod },
    {
      label: '付款渠道',
      contractValue: contract.payoutProvider || snapshot?.payoutProvider,
      invoiceValue: model.payoutProvider || model.payment.payoutProvider,
    },
    {
      label: '账户 ID',
      contractValue: contract.payoutAccountId || snapshot?.payoutAccountId,
      invoiceValue: model.payoutAccountId || model.payment.payoutAccountId,
      technical: true,
    },
    {
      label: '账户版本',
      contractValue: contract.payoutAccountVersion || snapshot?.payoutAccountVersion,
      invoiceValue: model.payoutAccountVersion || model.payment.payoutAccountVersion,
      technical: true,
    },
    {
      label: '账户指纹',
      contractValue: contract.payoutAccountFingerprint || snapshot?.accountFingerprint,
      invoiceValue: model.payoutAccountFingerprint || model.payment.accountFingerprint,
      technical: true,
    },
  ];

  if (contractMethod === 'PAYPAL' || snapshot?.paypalEmail || snapshot?.paypalUsername) {
    fields.push(
      { label: 'PayPal Name', contractValue: snapshot?.paypalUsername || contract.accountName, invoiceValue: model.payment.paypalUsername },
      { label: 'PayPal Email', contractValue: snapshot?.paypalEmail, invoiceValue: model.payment.paypalEmail },
    );
    return fields;
  }

  fields.push(
    { label: 'Account Name', contractValue: snapshot?.accountName || contract.accountName, invoiceValue: model.payment.accountName },
    { label: 'Account Number', contractValue: snapshot?.accountNumber, invoiceValue: model.payment.accountNumber, compact: true },
    { label: 'IBAN', contractValue: snapshot?.iban, invoiceValue: model.payment.iban, compact: true },
    { label: '银行名称', contractValue: snapshot?.bankName, invoiceValue: model.payment.bankName },
    { label: '银行地址', contractValue: snapshot?.bankStreetAddress, invoiceValue: model.payment.bankStreetAddress },
    { label: '银行城市', contractValue: snapshot?.bankCity, invoiceValue: model.payment.bankCity },
    { label: '银行州/省', contractValue: snapshot?.bankState, invoiceValue: model.payment.bankState },
    { label: '银行邮编', contractValue: snapshot?.bankPostalCode, invoiceValue: model.payment.bankPostalCode },
    { label: 'SWIFT', contractValue: snapshot?.swiftCode, invoiceValue: model.payment.swiftCode, compact: true },
    { label: '清算系统', contractValue: snapshot?.localClearingSystem, invoiceValue: model.payment.localClearingSystem },
    { label: '转账方式', contractValue: snapshot?.transferMethod, invoiceValue: model.payment.transferMethod },
  );
  return fields;
};

const accountSummary = (model: InvoiceDocumentModel) => model.paymentMethod === 'paypal'
  ? [model.payment.paypalUsername, accountDisplayValue(model.payment.paypalEmail, '')].filter(Boolean).join(' / ') || '未填写'
  : [model.payment.accountName, accountDisplayValue(model.payment.iban || model.payment.accountNumber, '')].filter(Boolean).join(' / ') || '未填写';

const contractAccountSummary = (contract: ContractRecord) => {
  const snapshot = payoutSnapshotForContract(contract);
  const method = paymentMethodForContract(contract, snapshot);
  if (method === 'PAYPAL') {
    return `${contractReference(contract)}：${[
      snapshot?.paypalUsername || contract.accountName,
      accountDisplayValue(snapshot?.paypalEmail, ''),
    ].filter(Boolean).join(' / ') || '未填写'}`;
  }
  return `${contractReference(contract)}：${[
    snapshot?.accountName || contract.accountName,
    accountDisplayValue(snapshot?.iban || snapshot?.accountNumber, ''),
  ].filter(Boolean).join(' / ') || '未填写'}`;
};

const payoutSnapshotUpdatedAt = (snapshot: DocumentPayoutSnapshot | null | undefined) => (
  snapshot?.updatedAt || snapshot?.verifiedAt || snapshot?.validatedAt || undefined
);

const issue = (
  field: InvoiceContractMatchField,
  severity: InvoiceContractMatchIssue['severity'],
  contracts: ContractRecord[],
  contractValue: string,
  invoiceValue: string,
  message: string,
  paymentAccountDifference?: InvoicePaymentAccountDifference,
): InvoiceContractMatchIssue => ({
  field,
  label: FIELD_LABELS[field],
  severity,
  contractIds: contractIds(contracts),
  contractValue,
  invoiceValue,
  message,
  ...(paymentAccountDifference ? { paymentAccountDifference } : {}),
});

export const evaluateInvoiceContractMatch = (
  contracts: ContractRecord[],
  model: InvoiceDocumentModel,
  reason = '',
  options: InvoiceContractMatchOptions = {},
) => {
  const issues: InvoiceContractMatchIssue[] = [];
  const checks: InvoiceContractMatchCheck[] = [];
  const normalizedReason = reason.trim();

  if (!contracts.length) {
    (Object.entries(FIELD_LABELS) as Array<[InvoiceContractMatchField, string]>).forEach(([field, label]) => {
      checks.push({
        field,
        label,
        contractValue: '未关联合同',
        invoiceValue: '按 Invoice 填写值',
        state: 'NOT_APPLICABLE',
        message: '未关联合同，本项不适用。',
      });
    });
  } else {
    const publisherValues = contracts.map((contract) => contract.publisher.trim()).filter(Boolean);
    const publisherMatches = contracts.every((contract) => (
      populated(contract.publisher) && sameText(contract.publisher, model.from.legalName)
    ));
    if (!publisherMatches) {
      issues.push(issue(
        'PUBLISHER',
        'BLOCKER',
        contracts,
        publisherValues.length ? uniqueValues(publisherValues).join('；') : '合同 From 缺失',
        model.from.legalName || 'Invoice From 缺失',
        '每份合同的 From 必须与 Invoice From 一致。',
      ));
    }

    const advertiserValues = contracts.map((contract) => contract.advertiser.trim()).filter(Boolean);
    const advertiserMatches = contracts.every((contract) => (
      populated(contract.advertiser) && sameText(contract.advertiser, model.billTo.name)
    ));
    if (!advertiserMatches) {
      issues.push(issue(
        'ADVERTISER',
        'BLOCKER',
        contracts,
        advertiserValues.length ? uniqueValues(advertiserValues).join('；') : '合同 Bill To 缺失',
        model.billTo.name || 'Invoice Bill To 缺失',
        '每份合同的 Bill To 必须与 Invoice Bill To 一致。',
      ));
    }

    const amountContracts = contracts.filter((contract) => contract.totalFee !== null);
    const contractAmount = amountContracts.reduce((total, contract) => total + (contract.totalFee ?? 0), 0);
    const invoiceAmount = invoiceTotal(model);
    if (amountContracts.length && Math.round(contractAmount * 100) !== Math.round(invoiceAmount * 100)) {
      issues.push(issue(
        'AMOUNT',
        'REASON_REQUIRED',
        amountContracts,
        formatInvoiceMoney(model.currency, contractAmount),
        formatInvoiceMoney(model.currency, invoiceAmount),
        '所选合同已填写金额的合计与 Invoice 明细总额不一致。',
      ));
    }

    const currencyContracts = contracts.filter((contract) => populated(contract.currency));
    const currencies = uniqueValues(currencyContracts.map((contract) => contract.currency));
    if (currencyContracts.length && (
      currencies.length !== 1 || !sameText(currencies[0], model.currency)
    )) {
      issues.push(issue(
        'CURRENCY',
        'REASON_REQUIRED',
        currencyContracts,
        currencies.join('；'),
        model.currency,
        '所选合同已填写的币种不唯一，或与 Invoice 币种不一致。',
      ));
    }

    const accountContracts = options.paymentAccountPending
      ? []
      : contracts.filter((contract) => (
          accountFields(contract, model).some((field) => populated(field.contractValue))
        ));
    const mismatchedAccountFields = accountContracts.flatMap((contract) => (
      accountFields(contract, model)
        .filter((field) => populated(field.contractValue) && !sameText(field.contractValue, field.invoiceValue))
        .map((field) => ({ contract, field }))
    ));
    if (mismatchedAccountFields.length) {
      const fieldLabels = uniqueValues(
        mismatchedAccountFields
          .filter(({ field }) => !field.technical)
          .map(({ field }) => field.label),
      );
      const paymentAccountDifference: InvoicePaymentAccountDifference = {
        fieldLabels,
        technicalMetadataOnly: fieldLabels.length === 0,
        contractAccounts: accountContracts.map((contract) => ({
          contractReference: contractReference(contract),
          updatedAt: payoutSnapshotUpdatedAt(payoutSnapshotForContract(contract)),
        })),
        invoiceAccountUpdatedAt: payoutSnapshotUpdatedAt(model.payment),
      };
      issues.push(issue(
        'PAYMENT_ACCOUNT',
        'REASON_REQUIRED',
        accountContracts,
        accountContracts.map(contractAccountSummary).join('；'),
        accountSummary(model),
        paymentAccountDifference.technicalMetadataOnly
          ? '账户记录版本不同，付款信息字段一致。'
          : '付款账户信息存在差异。',
        paymentAccountDifference,
      ));
    }

    (Object.entries(FIELD_LABELS) as Array<[InvoiceContractMatchField, string]>).forEach(([field, label]) => {
      const currentIssue = issues.find((candidate) => candidate.field === field);
      if (currentIssue) {
        checks.push({
          field,
          label,
          contractValue: currentIssue.contractValue,
          invoiceValue: currentIssue.invoiceValue,
          state: currentIssue.severity === 'BLOCKER'
            ? 'BLOCKER'
            : normalizedReason ? 'APPROVED_WITH_REASON' : 'REASON_REQUIRED',
          message: currentIssue.message,
          paymentAccountDifference: currentIssue.paymentAccountDifference,
        });
        return;
      }

      if (field === 'AMOUNT' && !amountContracts.length) {
        checks.push({ field, label, contractValue: '合同未填写', invoiceValue: formatInvoiceMoney(model.currency, invoiceTotal(model)), state: 'NOT_APPLICABLE', message: '合同未填写金额，本项不参与匹配。' });
      } else if (field === 'CURRENCY' && !currencyContracts.length) {
        checks.push({ field, label, contractValue: '合同未填写', invoiceValue: model.currency, state: 'NOT_APPLICABLE', message: '合同未填写币种，本项不参与匹配。' });
      } else if (field === 'PAYMENT_ACCOUNT' && options.paymentAccountPending) {
        checks.push({
          field,
          label,
          contractValue: contracts.some((contract) => populated(contract.payoutAccountId || contract.paymentSnapshot?.payoutAccountId)) ? '待上传后复核' : '合同未填写',
          invoiceValue: '待达人上传并选择',
          state: 'NOT_APPLICABLE',
          message: '创建采集任务时不选择付款账户，待达人上传后再匹配。',
        });
      } else if (field === 'PAYMENT_ACCOUNT' && !accountContracts.length) {
        checks.push({ field, label, contractValue: '合同未填写', invoiceValue: accountSummary(model), state: 'NOT_APPLICABLE', message: '合同未填写付款账户，本项不参与匹配。' });
      } else {
        const values = field === 'PUBLISHER'
          ? uniqueValues(publisherValues).join('；')
          : field === 'ADVERTISER'
            ? uniqueValues(advertiserValues).join('；')
            : field === 'AMOUNT'
              ? formatInvoiceMoney(model.currency, contractAmount)
              : field === 'CURRENCY'
                ? currencies.join('；')
                : accountContracts.map(contractAccountSummary).join('；');
        const invoiceValue = field === 'PUBLISHER'
          ? model.from.legalName
          : field === 'ADVERTISER'
            ? model.billTo.name
            : field === 'AMOUNT'
              ? formatInvoiceMoney(model.currency, invoiceTotal(model))
              : field === 'CURRENCY' ? model.currency : accountSummary(model);
        checks.push({ field, label, contractValue: values || '未填写', invoiceValue: invoiceValue || '未填写', state: 'MATCH', message: '合同与 Invoice 一致。' });
      }
    });
  }

  const blockerIssues = issues.filter((candidate) => candidate.severity === 'BLOCKER');
  const reasonRequiredIssues = issues.filter((candidate) => candidate.severity === 'REASON_REQUIRED');
  const reasonValid = normalizedReason.length >= 1 && normalizedReason.length <= 300;
  return {
    issues,
    checks,
    blockerIssues,
    reasonRequiredIssues,
    reasonValid,
    canProceed: !blockerIssues.length && (!reasonRequiredIssues.length || reasonValid),
    result: !contracts.length
      ? 'NOT_APPLICABLE' as const
      : blockerIssues.length
        ? 'BLOCKED' as const
        : reasonRequiredIssues.length
          ? reasonValid ? 'APPROVED_WITH_REASON' as const : 'REASON_REQUIRED' as const
          : 'MATCHED' as const,
  };
};

const invoiceContractMatchIssuesFingerprint = (issues: InvoiceContractMatchIssue[]) => JSON.stringify(
  issues.map((matchIssue) => ({
    field: matchIssue.field,
    severity: matchIssue.severity,
    contractIds: [...matchIssue.contractIds].sort(),
    contractValue: matchIssue.contractValue,
    invoiceValue: matchIssue.invoiceValue,
  })),
);

export const invoiceContractMatchFingerprint = (
  contracts: ContractRecord[],
  model: InvoiceDocumentModel,
  options: InvoiceContractMatchOptions = {},
) => invoiceContractMatchIssuesFingerprint(
  evaluateInvoiceContractMatch(contracts, model, '', options).issues,
);

export const createInvoiceContractMatchReview = ({
  contracts,
  model,
  version,
  reason = '',
  actor,
  reviewedAt = new Date().toISOString(),
  historicalMigration = false,
}: {
  contracts: ContractRecord[];
  model: InvoiceDocumentModel;
  version: number;
  reason?: string;
  actor?: InvoiceContractMatchActor;
  reviewedAt?: string;
  historicalMigration?: boolean;
}): InvoiceContractMatchReview => {
  const result = evaluateInvoiceContractMatch(contracts, model, reason);
  return {
    version,
    contractIds: contractIds(contracts),
    fingerprint: invoiceContractMatchIssuesFingerprint(result.issues),
    result: result.result,
    issues: result.issues,
    reason: result.reasonRequiredIssues.length && result.reasonValid ? reason.trim() : undefined,
    actorAccount: actor?.account,
    actorName: actor?.name,
    actorRole: actor?.role,
    reviewedAt,
    historicalMigration,
  };
};

export const currentInvoiceContractMatchReview = (record: {
  version?: number;
  contractMatchReviews?: InvoiceContractMatchReview[];
}) => [...(record.contractMatchReviews ?? [])]
  .reverse()
  .find((review) => review.version === (record.version ?? 1));

export type GeneratedInvoiceContractMatchReadiness = {
  match: ReturnType<typeof evaluateInvoiceContractMatch>;
  review?: InvoiceContractMatchReview;
  fingerprint: string;
  reviewMatches: boolean;
  effectiveReason: string;
  missingContractIds: string[];
  canProceed: boolean;
  blockingMessage?: string;
};

export const resolveGeneratedInvoiceContractMatch = (
  record: Pick<GeneratedInvoiceRecord, 'version' | 'snapshot' | 'contractMatchReviews'>,
  contracts: ContractRecord[],
): GeneratedInvoiceContractMatchReadiness => {
  const selectedContractIds = record.snapshot.contractIds ?? [];
  const selectedContractIdSet = new Set(selectedContractIds);
  const selectedContracts = contracts.filter((contract) => (
    Boolean(contract.contractId && selectedContractIdSet.has(contract.contractId))
  ));
  const resolvedContractIds = new Set(selectedContracts.flatMap((contract) => (
    contract.contractId ? [contract.contractId] : []
  )));
  const missingContractIds = selectedContractIds.filter((contractId) => !resolvedContractIds.has(contractId));
  const review = currentInvoiceContractMatchReview(record);
  const unresolvedMatch = evaluateInvoiceContractMatch(selectedContracts, record.snapshot);
  const fingerprint = invoiceContractMatchIssuesFingerprint(unresolvedMatch.issues);
  const reviewMatches = Boolean(review && (
    review.fingerprint
      ? review.fingerprint === fingerprint
      : invoiceContractMatchIssuesFingerprint(review.issues) === fingerprint
  ));
  const effectiveReason = reviewMatches ? review?.reason?.trim() ?? '' : '';
  const match = evaluateInvoiceContractMatch(selectedContracts, record.snapshot, effectiveReason);
  const canProceed = missingContractIds.length === 0 && match.canProceed;
  const blockingMessage = missingContractIds.length
    ? `关联的合同已失效或不可用：${missingContractIds.join('、')}`
    : match.blockerIssues[0]?.message
      ?? (match.reasonRequiredIssues.length && !match.reasonValid
        ? '合同存在可放行差异，请填写 1–300 字说明。'
        : undefined);

  return {
    match,
    review,
    fingerprint,
    reviewMatches,
    effectiveReason,
    missingContractIds,
    canProceed,
    blockingMessage,
  };
};
