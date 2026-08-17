import { describe, expect, it } from 'vitest';
import type { ContractRecord } from './contracts';
import { INITIAL_PAYOUTS } from './data';
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
  createPaymentExecutionBatchRecord,
  createPaymentProjectPaymentRecord,
  maskPaymentAccount,
  paymentBatchAmountLabel,
  paymentBatchStatusCounts,
} from './paymentBatches';
import type { RequestProjectSummary } from './pages/RequestProjectDetailPage';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from './requestProjectPrototypeResources';
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
  publisher: '测试达人工作室',
  accountName: '测试达人工作室',
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
    status: '付款处理中' as const,
    lifecycle: ['CREATED', 'ITEMS_ADDED', 'SUBMITTED'],
    itemStatus: '付款处理中' as const,
  };
};

describe('payment batch snapshots', () => {
  it('creates one processing batch when a request project starts payment execution', () => {
    const input = buildInput();
    const record = createPaymentExecutionBatchRecord({
      payouts: input.payouts,
      requests: input.requests,
      generatedInvoices: input.generatedInvoices,
      paymentLists: input.paymentLists,
      contracts: input.contracts,
      existingBatches: [],
      paymentBatchId: 'payment_batch_execution' as PaymentBatchId,
      paymentBatchCode: 'BAT-20260811-000001',
      payer: '财务测试员',
      submittedAt: '2026-08-11T10:30:00.000Z',
    });

    expect(record).toMatchObject({
      paymentBatchCode: 'BAT-20260811-000001',
      provider: 'Airwallex',
      fundingAccountId: 'mock-awx-operating',
      sourceCurrency: 'USD',
      payer: '财务测试员',
      paidAt: '2026-08-11T10:30:00.000Z',
      status: '付款处理中',
      lifecycle: ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED'],
    });
    expect(record.request.paymentRequestProjectId).toBe(input.requests[0].paymentRequestProjectId);
    expect(record.items).toHaveLength(input.payouts.length);
    expect(record.items.every((item) => item.paymentStatus === '付款处理中')).toBe(true);
  });

  it('rejects repeated, partial-state, or mixed-provider payment execution batches', () => {
    const input = buildInput();
    const createExecution = (overrides: Partial<Parameters<typeof createPaymentExecutionBatchRecord>[0]> = {}) => (
      createPaymentExecutionBatchRecord({
        payouts: input.payouts,
        requests: input.requests,
        generatedInvoices: input.generatedInvoices,
        paymentLists: input.paymentLists,
        contracts: input.contracts,
        existingBatches: [],
        paymentBatchId: 'payment_batch_execution' as PaymentBatchId,
        paymentBatchCode: 'BAT-20260811-000001',
        payer: '财务测试员',
        submittedAt: '2026-08-11T10:30:00.000Z',
        ...overrides,
      })
    );
    const existing = createExecution();

    expect(() => createExecution({ existingBatches: [existing] }))
      .toThrow('已生成付款批次');
    expect(() => createExecution({
      payouts: [{ ...input.payouts[0], status: '付款处理中' }],
    })).toThrow('全部付款明细必须处于等待付款状态');
    expect(() => createExecution({
      payouts: [input.payouts[0], { ...input.payouts[0], id: 'payout-paypal', provider: 'PayPal' }],
    })).toThrow('一个请款项目只能使用一个付款渠道');
  });

  it('builds one linked request snapshot with contract, Invoice and payment-list data', () => {
    const record = createPaymentBatchRecord(buildInput());

    expect(record.request.requestCode).toBe('REQ-TEST-001');
    expect(record.items).toHaveLength(1);
    expect(record.items[0].contracts[0].contractCode).toBe('CON-TEST-001');
    expect(record.items[0].contracts[0].signer).toBe('测试达人工作室');
    expect(record.items[0].contracts[0].paymentAccount).toBe('测试达人工作室');
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

  it('builds a project-level payment record without including payouts from other requests', () => {
    const input = buildInput();
    const failedPayout: Payout = {
      ...input.payouts[0],
      paymentRequestProjectId: input.requests[0].paymentRequestProjectId,
      status: '付款失败',
      paidAt: '2026-08-10T10:30',
      paymentFailure: {
        provider: 'Airwallex',
        errorCode: 'BENEFICIARY_UNAVAILABLE',
        providerResponse: 'The beneficiary is unavailable.',
        occurredAt: '2026-08-10T10:35',
      },
    };
    const record = createPaymentProjectPaymentRecord({
      request: input.requests[0],
      payouts: [failedPayout, INITIAL_PAYOUTS[0]],
      generatedInvoices: input.generatedInvoices,
      paymentLists: input.paymentLists,
      contracts: input.contracts,
    });

    expect(record.request.requestCode).toBe('REQ-TEST-001');
    expect(record.items.map((item) => item.payoutId)).toEqual(['payout-one']);
    expect(record.paymentOrderCodes).toEqual(['PAY-TEST-001']);
    expect(record.providers).toEqual(['Airwallex']);
    expect(record.status).toBe('部分失败');
    expect(record.lastActivityAt).toBe('2026-08-10T10:35');
  });

  it('builds all prototype batch states with consistent request and item snapshots', () => {
    const resources = INITIAL_COMPLETE_REQUEST_RESOURCES;
    const appPayouts = [...new Map([
      ...INITIAL_PAYOUTS,
      ...resources.payouts,
    ].map((payout) => [payout.id, payout])).values()];
    const records = createInitialPaymentBatches({
      payouts: appPayouts,
      requests: resources.requests,
      generatedInvoices: resources.invoices,
      paymentLists: resources.paymentLists,
      contracts: resources.contracts,
    });
    const completedRequests = resources.requests.filter((request) => request.lifecycle === 'COMPLETED');
    const completedInvoiceIds = new Set(completedRequests.flatMap((request) => request.invoiceIds ?? []));
    const expectedPayoutIds = resources.invoices
      .filter((invoice) => completedInvoiceIds.has(invoice.invoiceId))
      .map((invoice) => invoice.sourcePayoutId)
      .sort();
    const actualPayoutIds = records.flatMap((record) => record.items.map((item) => item.payoutId));

    expect(records).toHaveLength(13);
    expect(records.map((record) => record.paymentBatchCode)).toEqual(
      Array.from({ length: 13 }, (_, index) => `BAT-20260805-${String(13 - index).padStart(3, '0')}`),
    );
    expect(records.map((record) => record.items.length)).toEqual([5, 5, 4, 5, 5, 3, 5, 5, 5, 5, 5, 5, 3]);
    expect(records.map((record) => record.request.requestCode)).toEqual([
      'REQ-202607-000007',
      'REQ-202607-000007',
      'REQ-202607-000007',
      'REQ-202607-000009',
      'REQ-202607-000009',
      'REQ-202607-000009',
      'REQ-202607-000011',
      'REQ-202607-000012',
      'REQ-202607-000012',
      'REQ-202607-000017',
      'REQ-202607-000017',
      'REQ-202607-000018',
      'REQ-202607-000018',
    ]);
    expect(actualPayoutIds).toHaveLength(60);
    expect(new Set(actualPayoutIds).size).toBe(60);
    expect([...actualPayoutIds].sort()).toEqual(expectedPayoutIds);
    expect(new Set(records.map((record) => record.provider))).toEqual(new Set(['Airwallex']));
    expect(new Set(records.map((record) => record.payer))).toEqual(new Set(['奚文慧', '李梦', '吴雪霓']));
    expect(records.map((record) => record.status)).toEqual([
      '付款处理中', '付款处理中', '付款处理中',
      '已付款', '已付款', '已付款',
      '部分失败',
      '付款处理中', '付款处理中',
      '已付款', '已付款',
      '部分失败', '部分失败',
    ]);

    records.forEach((record) => {
      expect(record.items.length).toBeLessThanOrEqual(5);
      expect(record.request.lifecycle).toBe('COMPLETED');
      expect(new Set(record.items.map((item) => item.provider))).toEqual(new Set([record.provider]));
      expect(record.items.every((item) => item.paidAt === record.paidAt)).toBe(true);
      expect(record.items.every((item) => item.invoice && item.contracts.length && item.paymentListId)).toBe(true);
      expect(record.items.every((item) => item.associationIssues.length === 0)).toBe(true);
      expect(new Set(record.items.map((item) => item.currency))).toEqual(new Set([record.sourceCurrency]));
      expect(paymentBatchAmountLabel(record)).toBe(
        `${record.sourceCurrency} ${record.items.reduce((total, item) => total + item.amount, 0).toLocaleString('en-US')}`,
      );

      const counts = paymentBatchStatusCounts(record);
      if (record.status === '已付款') {
        expect(record.items.every((item) => item.paymentStatus === '已付款')).toBe(true);
        expect(counts).toEqual({ succeeded: record.items.length, failed: 0, processing: 0 });
      } else if (record.status === '付款处理中') {
        expect(record.items.every((item) => item.paymentStatus === '付款处理中')).toBe(true);
        expect(counts).toEqual({ succeeded: 0, failed: 0, processing: record.items.length });
      } else {
        expect(record.items.filter((item) => item.paymentStatus === '付款失败')).toHaveLength(1);
        expect(record.items.filter((item) => item.paymentStatus === '已付款')).toHaveLength(record.items.length - 1);
        expect(record.items.find((item) => item.paymentStatus === '付款失败')?.failure?.code)
          .toBe('BENEFICIARY_UNAVAILABLE');
        expect(counts).toEqual({ succeeded: record.items.length - 1, failed: 1, processing: 0 });
      }
    });
  });
});
