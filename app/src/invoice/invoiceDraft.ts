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
  if (!model.from.legalName.trim()) errors.legalName = '请填写真实姓名 / 公司名称';
  if (!model.from.address.trim()) errors.address = '请填写联系地址';
  if (!model.from.phone.trim()) errors.phone = '请填写联系电话';
  if (!model.from.email.trim() || !/^\S+@\S+\.\S+$/.test(model.from.email)) {
    errors.email = '请填写有效联系邮箱';
  }
  if (!model.payoutAccountId) {
    errors.payoutAccountId = '必须选择达人档案中的已验证收款账户';
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

  return errors;
};
