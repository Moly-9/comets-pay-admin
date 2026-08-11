import { validateContractCoverage } from '../businessWorkflow';
import type { ContractRecord } from '../contracts';
import type { DocumentPayoutSnapshot, InvoiceDocumentModel } from '../types';

export const payoutSnapshotForContract = (contract: ContractRecord) => (
  contract.paymentSnapshot ?? contract.generationSnapshot?.paymentSnapshot ?? null
);

export const payoutSnapshotKey = (snapshot: DocumentPayoutSnapshot) => (
  [
    snapshot.payoutAccountId ?? '',
    snapshot.payoutAccountVersion ?? 'legacy-v1',
    snapshot.accountFingerprint ?? '',
  ].join(':')
);

export const validateInvoiceDocumentModel = (
  model: InvoiceDocumentModel,
  selectedContracts: ContractRecord[],
  options: { allowContractPayoutOverride?: boolean } = {},
) => {
  const errors: Record<string, string> = {};

  if (!model.invoiceNumber.trim()) errors.invoiceNumber = 'Invoice 编号不能为空';
  if (!model.invoiceDate) errors.invoiceDate = '请选择 Invoice 日期';
  if (!model.billTo.name.trim()) errors.billToName = '请填写 Bill To 公司名称';
  if (!model.billTo.address.trim()) errors.billToAddress = '请填写 Bill To 地址';
  if (!model.from.legalName.trim()) errors.legalName = '请填写真实姓名';
  if (!model.from.address.trim()) errors.address = '请填写联系地址';
  if (!model.from.phone.trim()) errors.phone = '请填写联系电话';
  if (!model.from.email.trim() || !/^\S+@\S+\.\S+$/.test(model.from.email)) {
    errors.email = '请填写有效联系邮箱';
  }
  if (!model.payoutAccountId) {
    errors.payoutAccountId = '必须选择达人档案中的已验证收款账户';
  }

  const contractSnapshots = selectedContracts
    .map(payoutSnapshotForContract)
    .filter((snapshot): snapshot is DocumentPayoutSnapshot => Boolean(snapshot?.payoutAccountId));
  const contractSnapshotKeys = new Set(contractSnapshots.map(payoutSnapshotKey));
  if (!options.allowContractPayoutOverride && contractSnapshotKeys.size > 1) {
    errors.payoutAccountId = '所选合同冻结了不同的收款账户版本，不能合并生成同一张 Invoice';
  } else if (
    !options.allowContractPayoutOverride
    && contractSnapshots[0]
    && payoutSnapshotKey(contractSnapshots[0]) !== payoutSnapshotKey(model.payment)
  ) {
    errors.payoutAccountId = 'Invoice 收款账户与合同冻结版本不一致，请重新选择合同或账户';
  }

  model.items.forEach((item, index) => {
    if (!item.description.trim()) {
      errors[`item-${item.id}-description`] = `第 ${index + 1} 项缺少费用描述`;
    }
    if (!(item.unitPrice > 0)) {
      errors[`item-${item.id}-unitPrice`] = `第 ${index + 1} 项单价必须大于 0`;
    }
    if (!(item.quantity > 0)) {
      errors[`item-${item.id}-quantity`] = `第 ${index + 1} 项数量必须大于 0`;
    }
  });

  if (model.paymentMethod === 'bank') {
    if (!model.payment.accountName.trim()) errors.accountName = '请填写银行账户名';
    if (!model.payment.accountNumber.trim() && !model.payment.iban.trim()) {
      errors.accountNumber = '银行账号与 IBAN 至少填写一项';
    }
  } else {
    if (!model.payment.paypalUsername.trim()) errors.paypalUsername = '请填写 PayPal Name';
    if (
      !model.payment.paypalEmail.trim()
      || !/^\S+@\S+\.\S+$/.test(model.payment.paypalEmail)
    ) {
      errors.paypalEmail = '请填写有效 PayPal Email';
    }
  }

  validateContractCoverage(
    selectedContracts.map((contract) => ({
      contractId: contract.contractId!,
      advertiser: contract.advertiser,
      publisher: contract.publisher,
      currency: contract.currency,
      totalFee: contract.totalFee,
      paymentMethod: contract.paymentMethod === 'PAYPAL' ? 'PAYPAL' : 'BANK',
    })),
    {
      billTo: model.billTo.name,
      publisher: model.from.legalName,
      currency: model.currency,
      amount: model.items.reduce((total, item) => total + item.lineTotal, 0),
      paymentMethod: model.paymentMethod === 'paypal' ? 'PAYPAL' : 'BANK',
    },
  ).filter((issue) => (
    !options.allowContractPayoutOverride || issue.field !== 'paymentMethod'
  )).forEach((issue) => {
    errors[`contract-${issue.field}`] = issue.message;
  });

  return errors;
};
