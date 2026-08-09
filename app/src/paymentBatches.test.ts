import { describe, expect, it } from 'vitest';
import type { ContractRecord } from './contracts';
import type {
  ContractId,
  CooperationProjectId,
  EngagementId,
  InvoiceId,
  PaymentBatchId,
  PaymentListId,
  PaymentListRecord,
  PaymentRequestProjectId,
} from './businessWorkflow';
import {
  createInitialPaymentBatches,
  createPaymentBatchRecord,
  maskPaymentAccount,
  paymentBatchAmountLabel,
} from './paymentBatches';
import type { RequestProjectSummary } from './pages/RequestProjectDetailPage';
import type { DocumentPayoutSnapshot, GeneratedInvoiceRecord, Payout } from './types';

const paymentSnapshot = (accountName: string): DocumentPayoutSnapshot => ({
  bankCountry: 'United States',
  accountName,
  accountType: 'checking',
  swiftCode: 'TESTUS33',
  accountNumber: accountName,
  iban: '',
  beneficiaryType: 'PERSONAL',
  bankName: 'Test Bank',
  bankStreetAddress: 'Test Street',
  bankCity: 'New York',
  bankState: 'NY',
  bankPostalCode: '10001',
  intermediaryBankCountry: '',
  intermediaryBankCode: '',
  transferRemarks: 'Creator payment',
  paypalUsername: '',
  paypalEmail: '',
  payoutAccountId: 'payout_account_test',
  payoutAccountVersion: 'v2',
  payoutProvider: 'Airwallex',
  accountCurrency: 'USD',
  transferMethod: 'LOCAL',
});

const createRequest = (
  suffix: string,
  projectId: CooperationProjectId,
  invoiceIds: InvoiceId[],
): RequestProjectSummary => ({
  id: `request-${suffix}`,
  paymentRequestProjectId: `payment_request_${suffix}` as PaymentRequestProjectId,
  requestCode: `REQ-${suffix}`,
  cooperationProjectId: projectId,
  cooperationProjectCode: `PRJ-${suffix}`,
  cooperationProjectName: `合作项目 ${suffix}`,
  lifecycle: 'APPROVED',
  invoiceIds,
  projectId,
  project: `合作项目 ${suffix}`,
  brand: `品牌 ${suffix}`,
  media: `媒介 ${suffix}`,
  pm: `PM ${suffix}`,
  amount: 'USD 1,250',
  contracts: 1,
  invoices: invoiceIds.length,
  paymentOrder: '待生成',
  status: '待打款',
  filter: 'pending',
  expectedPaymentDate: '2026-08-18',
  generatedDetail: {
    brand: `品牌 ${suffix}`,
    reason: '达人内容合作费用',
    contractId: `CON-${suffix}`,
    contractName: '内容合作合同',
    contractAmount: 'USD 1,250',
    contractStatus: '已生效',
    invoiceId: `INV-${suffix}`,
    invoiceAmount: 'USD 1,250',
    invoiceStatus: '已通过',
    paymentListId: `PAY-${suffix}`,
    paymentListStatus: '已提交',
    payee: `达人 ${suffix}`,
    provider: 'Airwallex',
    beneficiaryId: '已脱敏',
    feePolicy: '广告主承担',
  },
});

const createPayout = (
  id: string,
  projectId: CooperationProjectId,
  invoiceNumber: string,
  provider: Payout['provider'] = 'Airwallex',
): Payout => ({
  id,
  creator: `达人 ${id}`,
  handle: `@${id}`,
  initials: 'TB',
  projectId,
  project: `合作项目 ${projectId}`,
  deliverable: '短视频内容合作',
  contract: `CON-${id}`,
  invoice: invoiceNumber,
  provider,
  currency: 'USD',
  amount: 1250,
  account: provider === 'PayPal' ? `${id}@example.com` : '1234567890',
  creatorId: `creator_${id}` as Payout['creatorId'],
  payoutAccountId: `payout_account_${id}`,
  payoutAccountVersion: 'v2',
  feeBearer: 'ADVERTISER',
  transferMethod: provider === 'PayPal' ? 'PAYPAL' : 'LOCAL',
  status: '等待付款',
  invoiceReviewStatus: '已通过',
  accent: '#5b6575',
});

const createInvoice = (
  payout: Payout,
  invoiceId: InvoiceId,
  contractId: ContractId,
): GeneratedInvoiceRecord => ({
  id: payout.invoice,
  invoiceId,
  sourcePayoutId: payout.id,
  status: '已通过',
  generatedAt: '2026-08-10T09:00:00.000Z',
  validationStatus: 'valid',
  version: 2,
  snapshot: {
    invoiceNumber: payout.invoice,
    invoiceDate: '2026-08-10',
    billTo: { name: 'COMETS', address: 'Shanghai' },
    creatorHandle: payout.handle,
    creatorName: payout.creator,
    creatorId: payout.creatorId,
    projectId: payout.projectId as CooperationProjectId,
    cooperationProjectId: payout.projectId as CooperationProjectId,
    projectName: payout.project,
    contractIds: [contractId],
    from: { legalName: payout.creator, address: 'Test Address', phone: '', email: `${payout.id}@example.com` },
    currency: 'USD',
    items: [{ id: `${payout.id}-line`, description: payout.deliverable ?? '', unitPrice: 1250, quantity: 1, lineTotal: 1250 }],
    payoutAccountId: payout.payoutAccountId,
    payoutAccountVersion: payout.payoutAccountVersion,
    payoutProvider: payout.provider,
    paymentMethod: payout.provider === 'PayPal' ? 'paypal' : 'bank',
    payment: {
      ...paymentSnapshot(payout.account),
      payoutProvider: payout.provider,
      paypalEmail: payout.provider === 'PayPal' ? payout.account : '',
      transferMethod: payout.provider === 'PayPal' ? 'PAYPAL' : 'LOCAL',
    },
  },
});

const createContract = (contractId: ContractId): ContractRecord => ({
  contractId,
  id: 'CON-TEST-001',
  name: '内容合作合同',
  currency: 'USD',
  totalFee: 1250,
  status: '已生效',
  signed: true,
  updated: '2026-08-09',
} as ContractRecord);

const createPaymentList = (
  request: RequestProjectSummary,
  invoiceId: InvoiceId,
): PaymentListRecord => ({
  paymentListId: 'payment_list_test' as PaymentListId,
  paymentListCode: 'PAY-TEST-001',
  projectId: request.cooperationProjectId!,
  paymentRequestProjectId: request.paymentRequestProjectId,
  provider: 'Airwallex',
  status: 'submitted',
  version: 3,
  items: [{
    id: 'payment_list_item_test',
    engagementId: 'engagement_test' as EngagementId,
    invoiceId,
    snapshot: {
      invoiceNumber: 'INV-TEST-001',
      creatorName: '测试达人',
      currency: 'USD',
      receiveCurrency: 'USD',
      amount: 1250,
      provider: 'Airwallex',
      accountSummary: '1234567890',
      paymentReason: '达人内容合作费用',
      transactionReference: 'COMETS-TEST-001',
      description: '短视频内容合作',
      transferMethod: 'LOCAL',
      feeBearer: 'ADVERTISER',
      payoutAccountVersion: 'v2',
    },
    overrides: {},
  }],
  createdAt: '2026-08-10T09:00:00.000Z',
  updatedAt: '2026-08-10T09:00:00.000Z',
});

const buildInput = () => {
  const projectId = 'project_test_one' as CooperationProjectId;
  const invoiceId = 'invoice_test_one' as InvoiceId;
  const contractId = 'contract_test_one' as ContractId;
  const payout = createPayout('payout-one', projectId, 'INV-TEST-001');
  const invoice = createInvoice(payout, invoiceId, contractId);
  const request = createRequest('TEST-001', projectId, [invoiceId]);
  return {
    payouts: [payout],
    requests: [request],
    generatedInvoices: [invoice],
    paymentLists: [createPaymentList(request, invoiceId)],
    contracts: [createContract(contractId)],
    paymentBatchId: 'payment_batch_test' as PaymentBatchId,
    paymentBatchCode: 'BAT-TEST-001',
    provider: 'Airwallex' as const,
    fundingAccountId: 'mock-awx-operating',
    sourceCurrency: 'USD' as const,
    payer: '财务测试员',
    paidAt: '2026-08-10T10:30',
    status: '付款处理中',
    lifecycle: ['CREATED', 'ITEMS_ADDED', 'SUBMITTED'],
    itemStatus: '付款处理中' as const,
  };
};

describe('payment batch snapshots', () => {
  it('builds one linked request snapshot with contract, Invoice and payment-list data', () => {
    const record = createPaymentBatchRecord(buildInput());

    expect(record.request.requestCode).toBe('REQ-TEST-001');
    expect(record.items).toHaveLength(1);
    expect(record.items[0].contracts[0].contractCode).toBe('CON-TEST-001');
    expect(record.items[0].invoice?.invoiceNumber).toBe('INV-TEST-001');
    expect(record.items[0].paymentListCode).toBe('PAY-TEST-001');
    expect(record.items[0].accountSummary).toBe('•••• 7890');
    expect(record.items[0].paidAt).toBe('2026-08-10T10:30');
  });

  it('rejects payouts that resolve to more than one request project', () => {
    const input = buildInput();
    const secondProjectId = 'project_test_two' as CooperationProjectId;
    const secondInvoiceId = 'invoice_test_two' as InvoiceId;
    const secondContractId = 'contract_test_two' as ContractId;
    const secondPayout = createPayout('payout-two', secondProjectId, 'INV-TEST-002');
    const secondInvoice = createInvoice(secondPayout, secondInvoiceId, secondContractId);
    const secondRequest = createRequest('TEST-002', secondProjectId, [secondInvoiceId]);

    expect(() => createPaymentBatchRecord({
      ...input,
      payouts: [...input.payouts, secondPayout],
      requests: [...input.requests, secondRequest],
      generatedInvoices: [...input.generatedInvoices, secondInvoice],
      contracts: [...input.contracts, createContract(secondContractId)],
    })).toThrow('一个付款批次只能关联一个请款项目');
  });

  it('keeps source changes from mutating the historical record', () => {
    const input = buildInput();
    const record = createPaymentBatchRecord(input);
    input.payouts[0].amount = 9999;
    input.requests[0].project = '被修改的项目';
    input.generatedInvoices[0].snapshot.items[0].lineTotal = 8888;
    input.contracts[0].name = '被修改的合同';

    expect(record.items[0].amount).toBe(1250);
    expect(record.request.cooperationProjectName).toBe('合作项目 TEST-001');
    expect(record.items[0].invoice?.amount).toBe(1250);
    expect(record.items[0].contracts[0].name).toBe('内容合作合同');
  });

  it('masks bank accounts and email recipients', () => {
    expect(maskPaymentAccount('1234 5678 9012')).toBe('•••• 9012');
    expect(maskPaymentAccount('creator.payment@example.com')).toBe('cr***@example.com');
    expect(maskPaymentAccount('')).toBe('待补充');
  });

  it('derives every historical row count and amount from its item snapshots', () => {
    const first = buildInput();
    const secondProjectId = 'project_history_two' as CooperationProjectId;
    const secondInvoiceId = 'invoice_history_two' as InvoiceId;
    const secondContractId = 'contract_history_two' as ContractId;
    const secondPayout = createPayout('payout_fixture_association_301164_05', first.payouts[0].projectId as CooperationProjectId, 'INV-HISTORY-002', 'PayPal');
    const returnedPayout = createPayout('pay-020', secondProjectId, 'INV-HISTORY-003', 'PayPal');
    const airwallexPayout = { ...first.payouts[0], id: 'payout_fixture_association_301164_01' };
    const airwallexInvoice = createInvoice(airwallexPayout, first.generatedInvoices[0].invoiceId, first.contracts[0].contractId!);
    const paypalInvoiceId = 'invoice_history_paypal' as InvoiceId;
    const paypalInvoice = createInvoice(secondPayout, paypalInvoiceId, first.contracts[0].contractId!);
    const returnedInvoice = createInvoice(returnedPayout, secondInvoiceId, secondContractId);
    const firstRequest = createRequest('HISTORY-001', first.payouts[0].projectId as CooperationProjectId, [airwallexInvoice.invoiceId, paypalInvoiceId]);
    const secondRequest = createRequest('HISTORY-002', secondProjectId, [secondInvoiceId]);
    const records = createInitialPaymentBatches({
      payouts: [airwallexPayout, secondPayout, returnedPayout],
      requests: [firstRequest, secondRequest],
      generatedInvoices: [airwallexInvoice, paypalInvoice, returnedInvoice],
      paymentLists: [],
      contracts: [first.contracts[0], createContract(secondContractId)],
    });

    expect(records).toHaveLength(3);
    records.forEach((record) => {
      expect(record.items).toHaveLength(1);
      expect(paymentBatchAmountLabel(record)).toBe(`USD ${record.items[0].amount.toLocaleString('en-US')}`);
      expect(new Set(record.items.map(() => record.request.paymentRequestProjectId)).size).toBe(1);
    });
  });
});
