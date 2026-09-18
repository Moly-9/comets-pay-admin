import { createPrototypeCode, createPrototypeId } from './businessWorkflow';
import type {
  AirwallexTransferMethod,
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
};

export type MockBatchSubmission = {
  batchId: string;
  batchCode: string;
  provider: ExecutableBatchProvider;
  fundingAccountId: string;
  sourceCurrency: InvoiceCurrency;
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
) => {
  const snapshot = payoutSnapshot(payout);
  const payoutProvider = payout.invoiceSnapshot?.payoutProvider
    ?? snapshot?.payoutProvider
    ?? payout.provider;
  const transferMethod = payout.transferMethod ?? snapshot?.transferMethod;
  const payoutAccountId = payout.payoutAccountId
    ?? payout.invoiceSnapshot?.payoutAccountId
    ?? snapshot?.payoutAccountId;
  const accountFingerprint = payout.payoutAccountFingerprint
    ?? payout.invoiceSnapshot?.payoutAccountFingerprint
    ?? snapshot?.accountFingerprint;
  const externalBeneficiaryId = payout.externalBeneficiaryId
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
      && !(payout.localClearingSystem ?? snapshot?.localClearingSystem)
      ? 'LOCAL 付款缺少本地清算方式'
      : '',
    !feeBearer ? '关联合同缺少手续费承担方' : '',
    provider === 'PayPal' && !snapshot?.paypalEmail ? '缺少 PayPal 收款邮箱快照' : '',
  ].filter(Boolean);
};

export type BatchWizardDemoState = 'AWAITING_UPDATE' | 'CREATOR_UPDATED' | 'ACCOUNT_UNCHANGED' | 'STANDARD';

export const batchWizardDemoStateFor = (payout: Payout): BatchWizardDemoState => {
  const recovery = payout.paymentFailureRecovery;
  if (!recovery) return 'STANDARD';
  if (recovery.status === 'AWAITING_CREATOR_UPDATE') return 'AWAITING_UPDATE';
  if (recovery.readyReason === 'ACCOUNT_UNCHANGED') return 'ACCOUNT_UNCHANGED';
  return 'CREATOR_UPDATED';
};

const paymentFailureDemoPayout = (
  payout: Payout,
  state: Exclude<BatchWizardDemoState, 'STANDARD'>,
  index: number,
): Payout => {
  const occurredAt = `2026-08-${String(10 + index).padStart(2, '0')}T10:00:00.000Z`;
  const creatorUpdated = state === 'CREATOR_UPDATED';
  const reportedPayoutAccountId = creatorUpdated
    ? `demo-recovery-account-${index + 1}`
    : payout.payoutAccountId;
  const reportedPayoutAccountVersion = creatorUpdated
    ? `recovery-v${index + 2}` as PayoutAccountVersion
    : payout.payoutAccountVersion ?? 'legacy-v1';
  const reportedAccountFingerprint = creatorUpdated
    ? `demo-recovery-fingerprint-${payout.id}-${index + 1}`
    : payout.payoutAccountFingerprint
      ?? payout.invoiceSnapshot?.payoutAccountFingerprint
      ?? `demo-recovery-${payout.id}`;
  const reportedExternalBeneficiaryId = creatorUpdated
    ? `demo-recovery-beneficiary-${index + 1}`
    : payout.externalBeneficiaryId
      ?? payout.invoiceSnapshot?.payment.externalBeneficiaryId;
  const ready = state !== 'AWAITING_UPDATE';
  return {
    ...payout,
    ...(creatorUpdated ? {
      account: `900000${String(9200 + index).padStart(4, '0')}`,
      payoutAccountId: reportedPayoutAccountId,
      payoutAccountVersion: reportedPayoutAccountVersion,
      payoutAccountFingerprint: reportedAccountFingerprint,
      externalBeneficiaryId: reportedExternalBeneficiaryId,
    } : {}),
    status: '已退回',
    issue: state === 'AWAITING_UPDATE' ? '等待达人确认收款账户' : undefined,
    paymentFailure: payout.paymentFailure ?? {
      provider: payout.provider,
      errorCode: 'BENEFICIARY_UNAVAILABLE',
      providerResponse: 'The beneficiary is temporarily unavailable.',
      occurredAt,
    },
    paymentFailureReturn: payout.paymentFailureReturn ?? {
      issueType: 'PAYMENT_LIST',
      reason: '请达人确认或更新收款账户。',
      actorAccount: 'prototype.finance',
      actorName: '财务演示账号',
      occurredAt,
      restartStage: 'PAYMENT_LIST_RESUBMISSION',
    },
    paymentListRequiresRevalidation: false,
    paymentListValidationIssues: [],
    paymentFailureRecovery: {
      status: ready ? 'READY_FOR_RETRY' : 'AWAITING_CREATOR_UPDATE',
      notifications: ready ? [{
        message: '已确认收款账户',
        actorAccount: 'prototype.media',
        actorName: '项目媒介',
        occurredAt,
        deliveries: [],
      }] : [],
      readyReason: state === 'ACCOUNT_UNCHANGED'
        ? 'ACCOUNT_UNCHANGED'
        : state === 'CREATOR_UPDATED'
          ? 'REVALIDATED'
          : undefined,
      creatorUpdatedAt: creatorUpdated ? occurredAt : undefined,
      reportedPayoutAccountId: creatorUpdated ? reportedPayoutAccountId : undefined,
      reportedPayoutAccountVersion: creatorUpdated ? reportedPayoutAccountVersion : undefined,
      reportedAccountFingerprint: creatorUpdated ? reportedAccountFingerprint : undefined,
      reportedExternalBeneficiaryId: creatorUpdated ? reportedExternalBeneficiaryId : undefined,
      revalidatedAt: creatorUpdated ? occurredAt : undefined,
      revalidationIssues: [],
    },
  };
};

/** Keep the creation page concise while leaving the shared prototype resources untouched. */
export const selectBatchWizardPayouts = (
  payouts: Payout[],
  sampleSizePerState = 2,
) => {
  const required = sampleSizePerState * 4;
  const defaultProviderReady = payouts.filter((payout) => (
    validatePayoutForBatch(payout, 'Airwallex').length === 0
  ));
  const defaultProviderReadyByRequest = new Map<string, Payout[]>();
  defaultProviderReady.forEach((payout) => {
    const requestKey = String(payout.paymentRequestProjectId ?? payout.projectId);
    defaultProviderReadyByRequest.set(requestKey, [
      ...(defaultProviderReadyByRequest.get(requestKey) ?? []),
      payout,
    ]);
  });
  const diversifiedDefaultProviderReady = [...defaultProviderReadyByRequest.values()]
    .flatMap((requestPayouts) => requestPayouts.slice(0, sampleSizePerState));
  const diversifiedIds = new Set(diversifiedDefaultProviderReady.map((payout) => payout.id));
  const defaultProviderReadyIds = new Set(defaultProviderReady.map((payout) => payout.id));
  const samples = [
    ...diversifiedDefaultProviderReady,
    ...defaultProviderReady.filter((payout) => !diversifiedIds.has(payout.id)),
    ...payouts.filter((payout) => !defaultProviderReadyIds.has(payout.id)),
  ].slice(0, required);
  if (samples.length < required) return samples;
  const states: BatchWizardDemoState[] = [
    'AWAITING_UPDATE',
    'CREATOR_UPDATED',
    'ACCOUNT_UNCHANGED',
    'STANDARD',
  ];
  return states.flatMap((state, stateIndex) => (
    samples
      .slice(stateIndex * sampleSizePerState, (stateIndex + 1) * sampleSizePerState)
      .map((payout, index) => state === 'STANDARD'
        ? payout
        : paymentFailureDemoPayout(payout, state, stateIndex * sampleSizePerState + index))
  ));
};

export const createMockBatchSubmission = ({
  payouts,
  provider,
  fundingAccountId,
  sourceCurrency,
  feeBearerByPayoutId = {},
}: {
  payouts: Payout[];
  provider: ExecutableBatchProvider;
  fundingAccountId: string;
  sourceCurrency: InvoiceCurrency;
  feeBearerByPayoutId?: Readonly<Record<string, PaymentFeeBearer>>;
}): MockBatchSubmission => {
  if (!payouts.length) throw new Error('至少选择一笔付款');
  if (!fundingAccountId) throw new Error('请选择资金账户');
  if (!sourceCurrency) throw new Error('请选择 source_currency');
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
      ),
    }))
    .find(({ issues }) => issues.length > 0);
  if (invalid) {
    throw new Error(`${invalid.payout.invoice}：${invalid.issues[0]}`);
  }
  const items = payouts.map((payout): BatchTransferItem => {
    const snapshot = payoutSnapshot(payout);
    const feeBearer = feeBearerByPayoutId[payout.id] ?? payout.feeBearer;
    if (!feeBearer) throw new Error(`${payout.invoice}：关联合同缺少手续费承担方`);
    const transferMethod = (
      provider === 'PayPal'
        ? 'PAYPAL'
        : payout.transferMethod ?? snapshot?.transferMethod
    ) as BatchTransferItem['transferMethod'];
    const feeOptions = provider === 'Airwallex'
      ? airwallexFeeOptions(transferMethod as AirwallexTransferMethod, feeBearer)
      : {};
    return {
      payoutId: payout.id,
      invoiceNumber: payout.invoice,
      creatorId: String(payout.creatorId ?? payout.invoiceSnapshot?.creatorId),
      payoutAccountId: String(
        payout.payoutAccountId
        ?? payout.invoiceSnapshot?.payoutAccountId
        ?? snapshot?.payoutAccountId,
      ),
      payoutAccountVersion: payout.payoutAccountVersion
        ?? payout.invoiceSnapshot?.payoutAccountVersion
        ?? snapshot?.payoutAccountVersion
        ?? 'legacy-v1',
      accountFingerprint: String(
        payout.payoutAccountFingerprint
        ?? payout.invoiceSnapshot?.payoutAccountFingerprint
        ?? snapshot?.accountFingerprint,
      ),
      provider,
      externalBeneficiaryId: provider === 'Airwallex'
        ? payout.externalBeneficiaryId ?? snapshot?.externalBeneficiaryId
        : undefined,
      transferMethod,
      localClearingSystem: transferMethod === 'LOCAL'
        ? payout.localClearingSystem ?? snapshot?.localClearingSystem
        : undefined,
      transferAmount: payout.amount,
      transferCurrency: payout.currency,
      feeBearer,
      paypalEmail: provider === 'PayPal' ? snapshot?.paypalEmail : undefined,
      transferNote: provider === 'PayPal' ? snapshot?.transferRemarks : undefined,
      ...feeOptions,
    };
  });
  return {
    batchId: createPrototypeId('batch'),
    batchCode: createPrototypeCode('BAT'),
    provider,
    fundingAccountId,
    sourceCurrency,
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
