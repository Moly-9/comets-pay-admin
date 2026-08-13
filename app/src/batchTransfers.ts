import { createPrototypeCode, createPrototypeId } from './businessWorkflow';
import type {
  AirwallexTransferMethod,
  InvoiceCurrency,
  Payout,
  PayoutAccountVersion,
} from './types';

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
    !payout.feeBearer ? '关联合同缺少手续费承担方' : '',
    provider === 'PayPal' && !snapshot?.paypalEmail ? '缺少 PayPal 收款邮箱快照' : '',
  ].filter(Boolean);
};

export const selectBatchWizardPayouts = (
  payouts: Payout[],
  sampleSize = 4,
) => payouts.slice(0, sampleSize);

export const createMockBatchSubmission = ({
  payouts,
  provider,
  fundingAccountId,
  sourceCurrency,
}: {
  payouts: Payout[];
  provider: ExecutableBatchProvider;
  fundingAccountId: string;
  sourceCurrency: InvoiceCurrency;
}): MockBatchSubmission => {
  if (!payouts.length) throw new Error('至少选择一笔付款');
  if (!fundingAccountId) throw new Error('请选择资金账户');
  if (!sourceCurrency) throw new Error('请选择 source_currency');
  const invalid = payouts
    .map((payout) => ({ payout, issues: validatePayoutForBatch(payout, provider) }))
    .find(({ issues }) => issues.length > 0);
  if (invalid) {
    throw new Error(`${invalid.payout.invoice}：${invalid.issues[0]}`);
  }
  const items = payouts.map((payout): BatchTransferItem => {
    const snapshot = payoutSnapshot(payout);
    const transferMethod = (
      provider === 'PayPal'
        ? 'PAYPAL'
        : payout.transferMethod ?? snapshot?.transferMethod
    ) as BatchTransferItem['transferMethod'];
    const feeOptions = provider === 'Airwallex'
      ? airwallexFeeOptions(transferMethod as AirwallexTransferMethod, payout.feeBearer)
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
