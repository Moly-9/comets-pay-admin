import type { ContractRecord } from '../contracts';
import { accountDisplayValue } from '../accountPresentation';
import type {
  DocumentPayoutSnapshot,
  InvoiceContractMatchField,
  InvoiceContractMatchIssue,
  InvoiceContractMatchReview,
  InvoiceDocumentModel,
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
};

export type InvoiceContractMatchActor = {
  account: string;
  name: string;
  role: string;
};

const FIELD_LABELS: Record<InvoiceContractMatchField, string> = {
  PUBLISHER: '收款主体',
  ADVERTISER: '付款主体',
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
    },
    {
      label: '账户版本',
      contractValue: contract.payoutAccountVersion || snapshot?.payoutAccountVersion,
      invoiceValue: model.payoutAccountVersion || model.payment.payoutAccountVersion,
    },
    {
      label: '账户指纹',
      contractValue: contract.payoutAccountFingerprint || snapshot?.accountFingerprint,
      invoiceValue: model.payoutAccountFingerprint || model.payment.accountFingerprint,
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

const issue = (
  field: InvoiceContractMatchField,
  severity: InvoiceContractMatchIssue['severity'],
  contracts: ContractRecord[],
  contractValue: string,
  invoiceValue: string,
  message: string,
): InvoiceContractMatchIssue => ({
  field,
  label: FIELD_LABELS[field],
  severity,
  contractIds: contractIds(contracts),
  contractValue,
  invoiceValue,
  message,
});

export const invoiceContractMatchFingerprint = (
  contracts: ContractRecord[],
  model: InvoiceDocumentModel,
) => JSON.stringify({
  contractIds: contracts.map((contract) => contract.contractId),
  publisher: model.from.legalName,
  advertiser: model.billTo.name,
  currency: model.currency,
  amount: invoiceTotal(model),
  paymentMethod: model.paymentMethod,
  payoutAccountId: model.payoutAccountId,
  payoutAccountVersion: model.payoutAccountVersion,
  payoutAccountFingerprint: model.payoutAccountFingerprint,
  payment: model.payment,
});

export const evaluateInvoiceContractMatch = (
  contracts: ContractRecord[],
  model: InvoiceDocumentModel,
  reason = '',
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
        publisherValues.length ? uniqueValues(publisherValues).join('；') : '合同 Publisher 缺失',
        model.from.legalName || 'Invoice From.Real Name 缺失',
        '每份合同的 Publisher 必须与 Invoice From.Real Name 一致。',
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
        advertiserValues.length ? uniqueValues(advertiserValues).join('；') : '合同 Advertiser 缺失',
        model.billTo.name || 'Invoice Bill To.Name 缺失',
        '每份合同的 Advertiser 必须与 Invoice Bill To.Name 一致。',
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

    const accountContracts = contracts.filter((contract) => (
      accountFields(contract, model).some((field) => populated(field.contractValue))
    ));
    const mismatchedAccountFields = accountContracts.flatMap((contract) => (
      accountFields(contract, model)
        .filter((field) => populated(field.contractValue) && !sameText(field.contractValue, field.invoiceValue))
        .map((field) => `${contractReference(contract)}：${field.label}`)
    ));
    if (mismatchedAccountFields.length) {
      issues.push(issue(
        'PAYMENT_ACCOUNT',
        'REASON_REQUIRED',
        accountContracts,
        accountContracts.map(contractAccountSummary).join('；'),
        accountSummary(model),
        `付款账户存在差异：${mismatchedAccountFields.join('、')}。`,
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
        });
        return;
      }

      if (field === 'AMOUNT' && !amountContracts.length) {
        checks.push({ field, label, contractValue: '合同未填写', invoiceValue: formatInvoiceMoney(model.currency, invoiceTotal(model)), state: 'NOT_APPLICABLE', message: '合同未填写金额，本项不参与匹配。' });
      } else if (field === 'CURRENCY' && !currencyContracts.length) {
        checks.push({ field, label, contractValue: '合同未填写', invoiceValue: model.currency, state: 'NOT_APPLICABLE', message: '合同未填写币种，本项不参与匹配。' });
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
