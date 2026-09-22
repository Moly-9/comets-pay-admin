import { createPrototypeCode, createPrototypeId } from './businessWorkflow';
import { isPaymentFailureRetryCandidate } from './paymentFailureRecovery';
import type { PaymentBatchRecord } from './paymentBatches';
import { createDocumentPayoutSnapshot, getPayoutAccountIdentifier, isPayoutAccountUsableForDocuments } from './payoutAccounts';
import type {
  AirwallexTransferMethod,
  CreatorPayoutAccount,
  DocumentPayoutSnapshot,
  InvoiceCurrency,
  Payout,
  PayoutAccountVersion,
} from './types';
import type { PaymentFeeBearer } from './paymentFeeBearerPresentation';

export type ExecutableBatchProvider = 'Airwallex' | 'PayPal';
export type AirwallexFeePaidBy = 'PAYER' | 'BENEFICIARY';
export type AirwallexSwiftChargeOption = 'PAYER' | 'SHARED';

export type BatchTransferItem = {
  payoutId: string;
  invoiceNumber: string;
  creatorId: string;
  payoutAccountId: string;
  payoutAccountVersion: PayoutAccountVersion;
  accountFingerprint: string;
  provider: ExecutableBatchProvider;
  externalBeneficiaryId?: string;
  transferMethod: AirwallexTransferMethod | 'PAYPAL';
  localClearingSystem?: string;
  transferAmount: number;
  transferCurrency: InvoiceCurrency;
  feeBearer: PaymentFeeBearer;
  feePaidBy?: AirwallexFeePaidBy;
  swiftChargeOption?: AirwallexSwiftChargeOption;
  paypalEmail?: string;
  transferNote?: string;
  executionAccount?: DocumentPayoutSnapshot;
  accountSummary?: string;
};

export type RetryExecutionAccount = Readonly<{
  snapshot: DocumentPayoutSnapshot;
  summary: string;
}>;

export const retryExecutionAccountFor = (account: CreatorPayoutAccount, creatorId: string): RetryExecutionAccount => ({
  snapshot: createDocumentPayoutSnapshot(account, creatorId),
  summary: getPayoutAccountIdentifier(account),
});

export const validateRetryExecutionAccount = (
  account: CreatorPayoutAccount | undefined,
  creatorId: string | undefined,
  provider: ExecutableBatchProvider,
) => {
  if (!account) return '请选择本次收款账户';
  if (!creatorId || account.creatorId !== creatorId) return '收款账户不属于当前达人';
  if (account.provider !== provider) return '收款账户与本次付款渠道不一致';
  if (!isPayoutAccountUsableForDocuments(account)) return '收款账户尚未验证或付款资料不完整';
  if (account.provider === 'Airwallex' && !account.beneficiaryId) return '缺少 Airwallex beneficiary_id';
  return '';
};

export type MockBatchSubmission = {
  batchId: string;
  batchCode: string;
  provider: ExecutableBatchProvider;
  fundingAccountId: string;
  sourceCurrency: InvoiceCurrency;
  sourcePaymentBatchId: PaymentBatchRecord['paymentBatchId'];
  sourcePaymentBatchCode: string;
  sourcePaymentOrderCode: string;
  paymentAttemptNumber: number;
  items: BatchTransferItem[];
};

export type MockBatchExecution = MockBatchSubmission & {
  lifecycle: ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED'];
  simulated: true;
};

export const airwallexFeeOptions = (
  transferMethod: AirwallexTransferMethod,
  feeBearer: Payout['feeBearer'],
): {
  feePaidBy: AirwallexFeePaidBy;
  swiftChargeOption?: AirwallexSwiftChargeOption;
} => {
  if (!feeBearer) {
    throw new Error('关联合同缺少手续费承担方');
  }
  if (transferMethod === 'LOCAL') {
    return { feePaidBy: 'PAYER' };
  }
  if (feeBearer === 'ADVERTISER') {
    return { feePaidBy: 'PAYER', swiftChargeOption: 'PAYER' };
  }
  if (feeBearer === 'PUBLISHER') {
    return { feePaidBy: 'BENEFICIARY', swiftChargeOption: 'SHARED' };
  }
  return { feePaidBy: 'PAYER', swiftChargeOption: 'SHARED' };
};

const payoutSnapshot = (payout: Payout) => payout.invoiceSnapshot?.payment;

export const validatePayoutForBatch = (
  payout: Payout,
  provider: ExecutableBatchProvider,
  feeBearer: Payout['feeBearer'] = payout.feeBearer,
  executionAccount?: DocumentPayoutSnapshot,
) => {
  const snapshot = executionAccount ?? payoutSnapshot(payout);
  const payoutProvider = executionAccount?.payoutProvider ?? payout.invoiceSnapshot?.payoutProvider
    ?? snapshot?.payoutProvider
    ?? payout.provider;
  const transferMethod = executionAccount ? executionAccount.transferMethod : payout.transferMethod ?? snapshot?.transferMethod;
  const payoutAccountId = executionAccount ? executionAccount.payoutAccountId : payout.payoutAccountId
    ?? payout.invoiceSnapshot?.payoutAccountId
    ?? snapshot?.payoutAccountId;
  const accountFingerprint = executionAccount ? executionAccount.accountFingerprint : payout.payoutAccountFingerprint
    ?? payout.invoiceSnapshot?.payoutAccountFingerprint
    ?? snapshot?.accountFingerprint;
  const externalBeneficiaryId = executionAccount ? executionAccount.externalBeneficiaryId : payout.externalBeneficiaryId
    ?? snapshot?.externalBeneficiaryId;
  return [
    payout.paymentListRequiresRevalidation
      ? payout.paymentListValidationIssues?.[0] ?? '付款清单账户快照需要重新校验'
      : '',
    payoutProvider !== provider ? `Invoice 渠道为 ${payoutProvider}，不能进入 ${provider} 批次` : '',
    !payout.creatorId && !payout.invoiceSnapshot?.creatorId ? '缺少 creatorId' : '',
    !payoutAccountId ? '缺少 payoutAccountId' : '',
    !accountFingerprint ? '缺少账户快照指纹' : '',
    !(payout.amount > 0) ? 'transfer_amount 必须大于 0' : '',
    !payout.currency ? '缺少 transfer_currency' : '',
    snapshot?.validationStatus && !['VALIDATED', 'VERIFIED'].includes(snapshot.validationStatus)
      ? '账户快照未通过验证'
      : '',
    provider === 'Airwallex' && !externalBeneficiaryId ? '缺少 Airwallex beneficiary_id' : '',
    provider === 'Airwallex' && !transferMethod ? '缺少 Airwallex 转账方式' : '',
    provider === 'Airwallex' && transferMethod === 'LOCAL'
      && !(executionAccount ? executionAccount.localClearingSystem : payout.localClearingSystem ?? snapshot?.localClearingSystem)
      ? 'LOCAL 付款缺少本地清算方式'
      : '',
    !feeBearer ? '关联合同缺少手续费承担方' : '',
    provider === 'PayPal' && !snapshot?.paypalEmail ? '缺少 PayPal 收款邮箱快照' : '',
  ].filter(Boolean);
};

export const isBatchWizardRetryPayout = (payout: Payout) => {
  const recoveryStatus = payout.paymentFailureRecovery?.status;
  if (recoveryStatus === 'RETRY_SUBMITTED' || recoveryStatus === 'RETRY_SUCCEEDED') return false;
  if (payout.status === '付款失败') return true;
  if (payout.status === '已退回' && payout.paymentFailureReturn?.issueType === 'PAYMENT_LIST') return true;
  return isPaymentFailureRetryCandidate(payout);
};

/** Only real, unfinished payment failures belong on the retry-batch page. */
export const selectBatchWizardPayouts = (payouts: readonly Payout[]) => (
  payouts.filter(isBatchWizardRetryPayout)
);

export type PaymentFailureSourceResolution = Readonly<{
  batch?: PaymentBatchRecord;
  issue?: string;
}>;

const failedSourceBatchesFor = (
  payout: Payout,
  paymentBatches: readonly PaymentBatchRecord[],
) => paymentBatches.filter((batch) => (
  batch.purpose !== 'REVERSAL'
  && batch.items.some((item) => (
    item.payoutId === payout.id
    && item.paymentStatus === '付款失败'
  ))
));

export const resolvePaymentFailureSourceBatch = (
  payout: Payout,
  paymentBatches: readonly PaymentBatchRecord[],
): PaymentFailureSourceResolution => {
  const failedBatches = failedSourceBatchesFor(payout, paymentBatches);
  const explicitBatchId = payout.currentPaymentAttempt?.paymentBatchId;
  if (explicitBatchId) {
    const exact = failedBatches.filter((batch) => batch.paymentBatchId === explicitBatchId);
    if (exact.length === 1) return { batch: exact[0] };
    if (exact.length > 1) return { issue: '原付款批次无法唯一确认' };
    return { issue: '当前失败尝试未找到对应原付款批次' };
  }

  const explicitAttemptNumber = payout.currentPaymentAttempt?.attemptNumber;
  if (explicitAttemptNumber) {
    const exactAttempt = failedBatches.filter((batch) => (
      batch.paymentAttemptNumber === explicitAttemptNumber
    ));
    if (exactAttempt.length === 1) return { batch: exactAttempt[0] };
    if (exactAttempt.length > 1) return { issue: '原付款批次无法唯一确认' };
    return { issue: '当前失败尝试未找到对应原付款批次' };
  }

  if (failedBatches.length === 1) return { batch: failedBatches[0] };
  if (!failedBatches.length) return { issue: '未找到原付款批次' };

  const latestAttemptNumber = Math.max(...failedBatches.map((batch) => batch.paymentAttemptNumber));
  const latestBatches = failedBatches.filter((batch) => (
    batch.paymentAttemptNumber === latestAttemptNumber
  ));
  return latestBatches.length === 1
    ? { batch: latestBatches[0] }
    : { issue: '原付款批次无法唯一确认' };
};

export const createMockBatchSubmission = ({
  payouts,
  provider,
  fundingAccountId,
  sourceCurrency,
  sourcePaymentBatchId,
  sourcePaymentBatchCode,
  sourcePaymentOrderCode,
  paymentAttemptNumber,
  feeBearerByPayoutId = {},
  executionAccountsByPayoutId = {},
}: {
  payouts: Payout[];
  provider: ExecutableBatchProvider;
  fundingAccountId: string;
  sourceCurrency: InvoiceCurrency;
  sourcePaymentBatchId: PaymentBatchRecord['paymentBatchId'];
  sourcePaymentBatchCode: string;
  sourcePaymentOrderCode: string;
  paymentAttemptNumber: number;
  feeBearerByPayoutId?: Readonly<Record<string, PaymentFeeBearer>>;
  executionAccountsByPayoutId?: Readonly<Record<string, RetryExecutionAccount>>;
}): MockBatchSubmission => {
  if (!payouts.length) throw new Error('至少选择一笔付款');
  if (!fundingAccountId) throw new Error('请选择资金账户');
  if (!sourcePaymentBatchId || !sourcePaymentBatchCode) throw new Error('重新付款必须关联原付款批次');
  if (!sourcePaymentOrderCode) throw new Error('重新付款必须沿用原付款单号');
  if (!(paymentAttemptNumber > 1)) throw new Error('重新付款尝试次数必须大于 1');
  if (!sourceCurrency) throw new Error('原付款批次缺少支付币种');
  const requestKeys = new Set(payouts.map((payout) => (
    payout.paymentRequestProjectId
      ? `request:${payout.paymentRequestProjectId}`
      : `legacy-project:${payout.projectId}`
  )));
  if (requestKeys.size !== 1) throw new Error('一个付款批次只能关联一个请款项目');
  const invalid = payouts
    .map((payout) => ({
      payout,
      issues: validatePayoutForBatch(
        payout,
        provider,
        feeBearerByPayoutId[payout.id] ?? payout.feeBearer,
        executionAccountsByPayoutId[payout.id]?.snapshot,
      ),
    }))
    .find(({ issues }) => issues.length > 0);
  if (invalid) {
    throw new Error(`${invalid.payout.invoice}：${invalid.issues[0]}`);
  }
  const items = payouts.map((payout): BatchTransferItem => {
    const executionAccount = executionAccountsByPayoutId[payout.id];
    const snapshot = executionAccount?.snapshot ?? payoutSnapshot(payout);
    const feeBearer = feeBearerByPayoutId[payout.id] ?? payout.feeBearer;
    if (!feeBearer) throw new Error(`${payout.invoice}：关联合同缺少手续费承担方`);
    const transferMethod = (
      provider === 'PayPal'
        ? 'PAYPAL'
        : executionAccount ? executionAccount.snapshot.transferMethod : payout.transferMethod ?? snapshot?.transferMethod
    ) as BatchTransferItem['transferMethod'];
    const feeOptions = provider === 'Airwallex'
      ? airwallexFeeOptions(transferMethod as AirwallexTransferMethod, feeBearer)
      : {};
    return {
      payoutId: payout.id,
      invoiceNumber: payout.invoice,
      creatorId: String(payout.creatorId ?? payout.invoiceSnapshot?.creatorId),
      payoutAccountId: String(
        executionAccount?.snapshot.payoutAccountId ?? payout.payoutAccountId
        ?? payout.invoiceSnapshot?.payoutAccountId
        ?? snapshot?.payoutAccountId,
      ),
      payoutAccountVersion: executionAccount?.snapshot.payoutAccountVersion ?? payout.payoutAccountVersion
        ?? payout.invoiceSnapshot?.payoutAccountVersion
        ?? snapshot?.payoutAccountVersion
        ?? 'legacy-v1',
      accountFingerprint: String(
        executionAccount?.snapshot.accountFingerprint ?? payout.payoutAccountFingerprint
        ?? payout.invoiceSnapshot?.payoutAccountFingerprint
        ?? snapshot?.accountFingerprint,
      ),
      provider,
      externalBeneficiaryId: provider === 'Airwallex'
        ? executionAccount ? executionAccount.snapshot.externalBeneficiaryId : payout.externalBeneficiaryId ?? snapshot?.externalBeneficiaryId
        : undefined,
      transferMethod,
      localClearingSystem: transferMethod === 'LOCAL'
        ? executionAccount ? executionAccount.snapshot.localClearingSystem : payout.localClearingSystem ?? snapshot?.localClearingSystem
        : undefined,
      transferAmount: payout.amount,
      transferCurrency: payout.currency,
      feeBearer,
      paypalEmail: provider === 'PayPal' ? snapshot?.paypalEmail : undefined,
      transferNote: provider === 'PayPal' ? snapshot?.transferRemarks : undefined,
      executionAccount: executionAccount?.snapshot,
      accountSummary: executionAccount?.summary,
      ...feeOptions,
    };
  });
  return {
    batchId: createPrototypeId('batch'),
    batchCode: createPrototypeCode('BAT'),
    provider,
    fundingAccountId,
    sourceCurrency,
    sourcePaymentBatchId,
    sourcePaymentBatchCode,
    sourcePaymentOrderCode,
    paymentAttemptNumber,
    items,
  };
};

export const executeMockBatchSubmission = (
  submission: MockBatchSubmission,
): MockBatchExecution => ({
  ...submission,
  lifecycle: ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED'],
  simulated: true,
});
