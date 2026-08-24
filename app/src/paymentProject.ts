import type { ContractRecord } from './contracts';

export type PaymentProjectInvoice = {
  id: string;
  contractId: string;
  creator: string;
  billTo: string;
  project: string;
  currency: string;
  total: number;
  paymentMethod: 'BANK' | 'PAYPAL';
  accountName: string;
  accountFingerprint: string;
  beneficiaryId: string;
  provider: 'Airwallex' | 'PayPal';
  receivedAt: string;
  status: '待匹配' | '已校验';
};

export type InvoiceMatchField = {
  key: string;
  label: string;
  contractValue: string;
  invoiceValue: string;
  result: 'match' | 'mismatch';
  message: string;
};

export type GeneratedPaymentListItem = {
  id: string;
  contractId: string;
  ioId: string;
  invoiceId: string;
  beneficiaryName: string;
  beneficiaryId: string;
  provider: 'Airwallex' | 'PayPal';
  sourceCurrency: string;
  transferCurrency: string;
  amount: number;
  feePolicy: string;
  reference: string;
  status: '资料已匹配';
};

export const PAYMENT_PROJECT_INVOICES: PaymentProjectInvoice[] = [
  {
    id: 'INV-260831-LM',
    contractId: 'CON-260724-KOL-01',
    creator: 'Léa Martin',
    billTo: 'Comets International Limited',
    project: 'Nebula Quest 法国市场推广',
    currency: 'EUR',
    total: 8500,
    paymentMethod: 'BANK',
    accountName: 'Léa Martin',
    accountFingerprint: '•••• 4821',
    beneficiaryId: 'bene_demo_lea',
    provider: 'Airwallex',
    receivedAt: '2026-09-03',
    status: '待匹配',
  },
  {
    id: 'INV-260831-LM-REV',
    contractId: 'CON-260724-KOL-01',
    creator: 'Lea Martin Studio',
    billTo: 'Comets International Limited',
    project: 'Nebula Quest 法国市场推广',
    currency: 'USD',
    total: 9000,
    paymentMethod: 'BANK',
    accountName: 'Lea Martin Studio',
    accountFingerprint: '•••• 7190',
    beneficiaryId: 'bene_demo_lea_studio',
    provider: 'Airwallex',
    receivedAt: '2026-09-03',
    status: '待匹配',
  },
  {
    id: 'INV-240718',
    contractId: 'CON-260718-01',
    creator: 'Mina Kato',
    billTo: 'Solara Beauty Limited',
    project: '夏日直播计划',
    currency: 'USD',
    total: 32000,
    paymentMethod: 'BANK',
    accountName: 'Mina Kato',
    accountFingerprint: '•••• 1842',
    beneficiaryId: 'bene_demo_mina',
    provider: 'Airwallex',
    receivedAt: '2026-08-22',
    status: '已校验',
  },
];

const formatMoney = (currency: string, amount: number | null) => (
  amount === null || !currency ? '待补充' : `${currency} ${amount.toLocaleString('en-US')}`
);

export function matchInvoiceToContract(
  contract: ContractRecord,
  invoice: PaymentProjectInvoice,
): InvoiceMatchField[] {
  const fields: InvoiceMatchField[] = [
    {
      key: 'contract',
      label: '合同 / IO',
      contractValue: `${contract.id} · ${contract.ioId}`,
      invoiceValue: invoice.contractId,
      result: invoice.contractId === contract.id ? 'match' : 'mismatch',
      message: invoice.contractId === contract.id ? 'Invoice已关联当前合同' : 'Invoice关联了其他合同',
    },
    {
      key: 'publisher',
      label: '收款主体',
      contractValue: contract.publisher || '待补充',
      invoiceValue: invoice.creator,
      result: Boolean(contract.publisher) && invoice.creator === contract.publisher ? 'match' : 'mismatch',
      message: invoice.creator === contract.publisher ? '法定名称一致' : 'Invoice From与Publisher不一致',
    },
    {
      key: 'billTo',
      label: '付款主体 / Bill To',
      contractValue: contract.advertiser,
      invoiceValue: invoice.billTo,
      result: invoice.billTo === contract.advertiser ? 'match' : 'mismatch',
      message: invoice.billTo === contract.advertiser ? '付款主体一致' : 'Bill To与Advertiser不一致',
    },
    {
      key: 'project',
      label: '项目名称',
      contractValue: contract.project,
      invoiceValue: invoice.project,
      result: invoice.project === contract.project ? 'match' : 'mismatch',
      message: invoice.project === contract.project ? '项目匹配' : '项目名称不一致',
    },
    {
      key: 'amount',
      label: '应付金额与币种',
      contractValue: formatMoney(contract.currency, contract.totalFee),
      invoiceValue: formatMoney(invoice.currency, invoice.total),
      result: contract.totalFee === invoice.total && contract.currency === invoice.currency ? 'match' : 'mismatch',
      message: contract.totalFee === invoice.total && contract.currency === invoice.currency
        ? 'Invoice总额等于合同批准金额'
        : '金额或币种不一致',
    },
    {
      key: 'method',
      label: '付款方式',
      contractValue: contract.paymentMethod || '待选择',
      invoiceValue: invoice.paymentMethod,
      result: Boolean(contract.paymentMethod) && invoice.paymentMethod === contract.paymentMethod ? 'match' : 'mismatch',
      message: invoice.paymentMethod === contract.paymentMethod ? '付款渠道一致' : '付款方式不一致',
    },
    {
      key: 'account',
      label: '收款账户',
      contractValue: `${contract.accountName || '待补充'} · ${contract.accountFingerprint || '待补充'}`,
      invoiceValue: `${invoice.accountName} · ${invoice.accountFingerprint}`,
      result: (
        Boolean(contract.accountName)
        && contract.accountName === invoice.accountName
        && contract.accountFingerprint === invoice.accountFingerprint
      ) ? 'match' : 'mismatch',
      message: contract.accountName === invoice.accountName && contract.accountFingerprint === invoice.accountFingerprint
        ? '合同与Invoice账户快照一致'
        : '账户名称或完整账号不一致',
    },
  ];

  return fields;
}

export const invoiceMatchPassed = (fields: InvoiceMatchField[]) => (
  fields.length > 0 && fields.every((field) => field.result === 'match')
);

export function generatePaymentListItem(
  contract: ContractRecord | null,
  invoice: PaymentProjectInvoice,
): GeneratedPaymentListItem {
  return {
    id: `PL-${invoice.id.replace('INV-', '')}`,
    contractId: contract?.id ?? '未关联',
    ioId: contract?.ioId ?? '—',
    invoiceId: invoice.id,
    beneficiaryName: invoice.creator,
    beneficiaryId: invoice.beneficiaryId,
    provider: invoice.provider,
    sourceCurrency: invoice.currency,
    transferCurrency: invoice.currency,
    amount: invoice.total,
    feePolicy: contract?.feeBearer === 'ADVERTISER'
      ? '付款方承担'
      : contract?.feeBearer === 'PUBLISHER'
        ? '收款方承担'
        : '待确认',
    reference: invoice.id,
    status: '资料已匹配',
  };
}
