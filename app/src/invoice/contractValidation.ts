import type { ContractRecord } from '../contracts';
import { invoiceTotal } from './invoiceUtils';
import type { InvoiceDocumentModel } from '../types';

export type InvoiceContractLink = {
  contract: ContractRecord | null;
  status: 'LINKED' | 'NOT_LINKED_OPTIONAL' | 'MULTIPLE_CONTRACTS';
  candidates: ContractRecord[];
};

export type InvoiceContractValidationItem = {
  key: string;
  label: string;
  contractValue: string;
  invoiceValue: string;
  reason: string;
  source: string;
  result: 'MATCH' | 'MISMATCH' | 'REVIEW';
};

export type InvoiceContractValidation = {
  linked: boolean;
  canGenerate: boolean;
  canSaveDraft: true;
  items: InvoiceContractValidationItem[];
  blockers: InvoiceContractValidationItem[];
  reviews: InvoiceContractValidationItem[];
};

export const resolveInvoiceContract = (
  contracts: ContractRecord[],
  identity: {
    projectId: string;
    collaborationId: string;
    creatorId: string;
  },
): InvoiceContractLink => {
  if (!identity.projectId || !identity.collaborationId || !identity.creatorId) {
    return { contract: null, status: 'NOT_LINKED_OPTIONAL', candidates: [] };
  }
  const candidates = contracts.filter((contract) => (
    contract.structuredContract?.project_id === identity.projectId
    && contract.structuredContract.collaboration_id === identity.collaborationId
    && contract.structuredContract.creator_id === identity.creatorId
  ));
  if (candidates.length > 1) return { contract: null, status: 'MULTIPLE_CONTRACTS', candidates };
  return candidates[0]
    ? { contract: candidates[0], status: 'LINKED', candidates }
    : { contract: null, status: 'NOT_LINKED_OPTIONAL', candidates: [] };
};

const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const lastFour = (value: string) => value.replace(/\s/g, '').slice(-4);
const money = (currency: string, amount: number | null) => (
  amount === null ? `${currency || '—'} —` : `${currency} ${amount.toLocaleString('en-US')}`
);

const item = (
  key: string,
  label: string,
  contractValue: string,
  invoiceValue: string,
  source: string,
  matches: boolean,
  reason: string,
): InvoiceContractValidationItem => ({
  key,
  label,
  contractValue: contractValue || '待确认',
  invoiceValue: invoiceValue || '待填写',
  source,
  result: matches ? 'MATCH' : 'MISMATCH',
  reason: matches ? '一致' : reason,
});

export const validateInvoiceAgainstContract = (
  contract: ContractRecord | null,
  invoice: InvoiceDocumentModel,
): InvoiceContractValidation => {
  if (!contract) {
    return {
      linked: false,
      canGenerate: true,
      canSaveDraft: true,
      items: [],
      blockers: [],
      reviews: [],
    };
  }
  if (contract.extractionStage !== 'applied' || !contract.structuredContract || !contract.contractIOs?.length) {
    const unresolved: InvoiceContractValidationItem = {
      key: 'contract-confirmation',
      label: '合同人工确认',
      contractValue: contract.extractionStage ?? '未解析',
      invoiceValue: '准备生成 Invoice',
      reason: '该项目达人存在合同，必须先完成合同字段确认并应用。',
      source: '合同校验记录',
      result: 'MISMATCH',
    };
    return {
      linked: true,
      canGenerate: false,
      canSaveDraft: true,
      items: [unresolved],
      blockers: [unresolved],
      reviews: [],
    };
  }

  const structured = contract.structuredContract;
  const io = contract.contractIOs[0];
  const total = invoiceTotal(invoice);
  const invoiceMethod = invoice.paymentMethod === 'paypal' ? 'PAYPAL' : 'BANK_TRANSFER';
  const contractMethod = String(structured.payment_rules.payment_method?.normalizedValue ?? '');
  const invoiceAccountName = invoice.paymentMethod === 'paypal'
    ? invoice.payment.paypalUsername
    : invoice.payment.accountName;
  const invoiceAccountLast4 = invoice.paymentMethod === 'paypal'
    ? ''
    : lastFour(invoice.payment.iban || invoice.payment.accountNumber);
  const contractAccountLast4 = structured.payout_account_snapshot.iban_last4
    || structured.payout_account_snapshot.account_number_last4;

  const items = [
    item('publisher', 'Publisher / Invoice From', structured.publisher, invoice.from.legalName, '合同摘要 · Publisher', normalized(structured.publisher) === normalized(invoice.from.legalName), 'Invoice From 与 Publisher 不一致'),
    item('advertiser', 'Advertiser / Bill To', structured.advertiser, invoice.billTo.name, '合同摘要 · Advertiser', normalized(structured.advertiser) === normalized(invoice.billTo.name), 'Bill To 与 Advertiser 不一致'),
    item('amount', 'Project Total Fees / Invoice Amount', money(io.currency, io.project_total_fee), money(invoice.currency, total), 'IO · Project Total Fees', io.project_total_fee === total, 'Invoice 金额与 IO 总费用不一致'),
    item('currency', 'Currency', io.currency, invoice.currency, 'IO · Currency', io.currency === invoice.currency, '币种不一致'),
    item('payment-method', 'Payment Method', contractMethod, invoiceMethod, '付款条款 · Payment Method', contractMethod === invoiceMethod || contractMethod === 'AIRWALLEX' && invoiceMethod === 'BANK_TRANSFER', '付款方式不一致'),
    item('beneficiary-name', 'Beneficiary Account Name', structured.payout_account_snapshot.beneficiary_account_name, invoiceAccountName, '合同账户快照', normalized(structured.payout_account_snapshot.beneficiary_account_name) === normalized(invoiceAccountName), '收款账户名称不一致'),
  ];
  if (contractAccountLast4 || invoiceAccountLast4) {
    items.push(item('account-last4', '账号 / IBAN 后四位', contractAccountLast4, invoiceAccountLast4, '合同账户快照', contractAccountLast4 === invoiceAccountLast4, '账号或 IBAN 后四位不一致'));
  }
  if (invoice.contractCode) {
    items.push(item('contract-code', '合同编号', structured.contract_code, invoice.contractCode, '系统合同字段', structured.contract_code === invoice.contractCode, 'Invoice 合同编号不一致'));
  }
  if (invoice.ioNumber) {
    items.push(item('io-number', 'IO 编号', io.io_number, invoice.ioNumber, '系统 IO 字段', io.io_number === invoice.ioNumber, 'Invoice IO 编号不一致'));
  }
  const blockers = items.filter((entry) => entry.result === 'MISMATCH');
  return {
    linked: true,
    canGenerate: blockers.length === 0,
    canSaveDraft: true,
    items,
    blockers,
    reviews: [],
  };
};
