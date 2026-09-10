import { describe, expect, it } from 'vitest';
import type { ContractRecord } from './contracts';
import { INITIAL_PAYOUTS } from './data';
import { HISTORICAL_PAYMENT_BATCH_SEEDS } from './historicalPaymentBatchFixtures';
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
  applyPaymentResultToCurrentBatch,
  createInitialPaymentBatches,
  createPaymentBatchRecord,
  createPaymentExecutionBatchRecord,
  createPaymentProjectPaymentRecord,
  paymentBatchAmountLabel,
  paymentBatchFinancialSummary,
  paymentBatchMoneyTotalsLabel,
  paymentBatchStatusCounts,
  paymentExecutionDatesForPayouts,
} from './paymentBatches';
import {
  PAYMENT_BATCH_PARTIAL_FAILURE_DEMO,
  PAYMENT_BATCH_RETRY_DEMO,
  paymentBatchPrototypeStatusFor,
} from './paymentBatchPrototypeScenario';
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
  it('matches legacy attempt execution dates by attempt number instead of the latest batch', () => {
    const input = buildInput();
    const template = createPaymentBatchRecord(input);
    const payout = {
      ...input.payouts[0],
      currentPaymentAttempt: {
        paymentBatchId: 'payment_batch_retry' as PaymentBatchId,
        paymentBatchCode: 'BAT-RETRY-002',
        submittedAt: '2026-08-06T10:15',
        attemptNumber: 2,
      },
      paymentAttempts: [
        {
          attemptNumber: 1,
          status: '付款失败' as const,
          occurredAt: '2026-08-05T16:05',
          principalAmount: input.payouts[0].amount,
          principalCurrency: input.payouts[0].currency,
        },
        {
          attemptNumber: 2,
          status: '已付款' as const,
          occurredAt: '2026-08-06T10:20',
          principalAmount: input.payouts[0].amount,
          principalCurrency: input.payouts[0].currency,
        },
      ],
    } satisfies Payout;
    const originalBatch = {
      ...template,
      paymentBatchId: 'payment_batch_original' as PaymentBatchId,
      paymentBatchCode: 'BAT-ORIGINAL-001',
      paymentAttemptNumber: 1,
      submittedAt: '2026-08-05T16:00',
    };
    const retryBatch = {
      ...template,
      paymentBatchId: payout.currentPaymentAttempt.paymentBatchId,
      paymentBatchCode: payout.currentPaymentAttempt.paymentBatchCode,
      paymentAttemptNumber: 2,
      submittedAt: payout.currentPaymentAttempt.submittedAt,
    };

    expect(paymentExecutionDatesForPayouts([payout], [retryBatch, originalBatch])).toEqual([
      '2026-08-05',
      '2026-08-06',
    ]);
  });

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
      paymentOrderCode: 'PAY-TEST-001',
      paymentAttemptNumber: 1,
      provider: 'Airwallex',
      fundingAccountId: 'mock-awx-operating',
      sourceCurrency: 'USD',
      payer: '财务测试员',
      submittedAt: '2026-08-11T10:30:00.000Z',
      paidAt: '2026-08-11T10:30:00.000Z',
      status: '付款处理中',
      lifecycle: ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED'],
    });
    expect(record.request.paymentRequestProjectId).toBe(input.requests[0].paymentRequestProjectId);
    expect(record.items).toHaveLength(input.payouts.length);
    expect(record.items.every((item) => item.paymentOrderCode === record.paymentOrderCode)).toBe(true);
    expect(record.items.every((item) => item.paymentBatchId === record.paymentBatchId)).toBe(true);
    expect(record.items.every((item) => item.paymentBatchCode === record.paymentBatchCode)).toBe(true);
    expect(record.items.every((item) => item.paymentSubmittedAt === record.submittedAt)).toBe(true);
    expect(record.items.every((item) => item.paidAt === undefined)).toBe(true);
    expect(record.items.every((item) => item.paymentStatus === '付款处理中')).toBe(true);
    expect(record.items.every((item) => item.postTransactionBalance === undefined)).toBe(true);
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
      .toThrow('存在仍在处理中的付款批次');
    expect(() => createExecution({
      existingBatches: [{
        ...existing,
        status: '全部失败',
        lifecycle: [...existing.lifecycle, 'FAILED'],
        items: existing.items.map((item) => ({ ...item, paymentStatus: '付款失败' })),
      }],
      paymentBatchId: 'payment_batch_execution_retry' as PaymentBatchId,
      paymentBatchCode: 'BAT-20260812-000002',
    })).not.toThrow();
    expect(() => createExecution({
      payouts: [{ ...input.payouts[0], status: '付款处理中' }],
    })).toThrow('全部付款明细必须处于等待付款状态');
    expect(() => createExecution({
      payouts: [input.payouts[0], { ...input.payouts[0], id: 'payout-paypal', provider: 'PayPal' }],
    })).toThrow('一个请款项目只能使用一个付款渠道');
  });

  it('keeps a failed attempt immutable when a later retry succeeds', () => {
    const input = buildInput();
    const firstBatch = createPaymentExecutionBatchRecord({
      payouts: input.payouts,
      requests: input.requests,
      generatedInvoices: input.generatedInvoices,
      paymentLists: input.paymentLists,
      contracts: input.contracts,
      existingBatches: [],
      paymentBatchId: 'payment_batch_attempt_a' as PaymentBatchId,
      paymentBatchCode: 'BAT-ATTEMPT-A',
      payer: '财务测试员',
      submittedAt: '2026-08-11T10:30:00.000Z',
    });
    const failedPayout: Payout = {
      ...input.payouts[0],
      status: '付款失败',
      currentPaymentAttempt: {
        paymentBatchId: firstBatch.paymentBatchId,
        paymentBatchCode: firstBatch.paymentBatchCode,
        submittedAt: firstBatch.paidAt,
      },
      paymentFailure: {
        provider: 'Airwallex',
        errorCode: 'BENEFICIARY_UNAVAILABLE',
        providerResponse: 'The beneficiary is unavailable.',
        occurredAt: '2026-08-11T10:35:00.000Z',
      },
    };
    const failedAttempt = applyPaymentResultToCurrentBatch({
      batches: [firstBatch],
      payout: failedPayout,
    });
    expect(failedAttempt.issue).toBeUndefined();
    expect(failedAttempt.batches[0].status).toBe('全部失败');
    expect(failedAttempt.batches[0].items[0].failure?.code).toBe('BENEFICIARY_UNAVAILABLE');

    const frozenFailedBatch = failedAttempt.batches[0];
    const retryBatch = createPaymentBatchRecord({
      ...input,
      payouts: [failedPayout],
      paymentBatchId: 'payment_batch_attempt_b' as PaymentBatchId,
      paymentBatchCode: 'BAT-ATTEMPT-B',
      paidAt: '2026-08-12T09:00:00.000Z',
      status: '付款处理中',
      lifecycle: ['CREATED', 'ITEMS_ADDED', 'QUOTED', 'SUBMITTED'],
      itemStatus: '付款处理中',
      paymentOrderCode: 'PAY-RETRY-002',
      paymentAttemptNumber: 2,
    });
    expect(retryBatch.items[0].failure).toBeUndefined();
    expect(retryBatch.items[0]).toMatchObject({
      paymentOrderCode: 'PAY-RETRY-002',
      sourcePaymentOrderCode: 'PAY-TEST-001',
      paymentAttemptNumber: 2,
    });
    expect(frozenFailedBatch.items[0]).toMatchObject({
      paymentOrderCode: 'PAY-TEST-001',
      sourcePaymentOrderCode: 'PAY-TEST-001',
      paymentAttemptNumber: 1,
    });

    const succeededPayout: Payout = {
      ...failedPayout,
      status: '已付款',
      paidAt: '2026-08-12T09:05:00.000Z',
      paymentFailure: undefined,
      currentPaymentAttempt: {
        paymentBatchId: retryBatch.paymentBatchId,
        paymentBatchCode: retryBatch.paymentBatchCode,
        submittedAt: retryBatch.paidAt,
        paymentOrderCode: 'PAY-RETRY-002',
        sourcePaymentOrderCode: 'PAY-TEST-001',
        attemptNumber: 2,
      },
    };
    const succeededAttempt = applyPaymentResultToCurrentBatch({
      batches: [retryBatch, frozenFailedBatch],
      payout: succeededPayout,
    });

    expect(succeededAttempt.batches[0].status).toBe('已付款');
    expect(succeededAttempt.batches[0].items[0].paymentStatus).toBe('已付款');
    expect(succeededAttempt.batches[1]).toEqual(frozenFailedBatch);
  });

  it('builds one linked request snapshot with contract, Invoice and payment-list data', () => {
    const input = buildInput();
    input.payouts[0].status = '已付款';
    input.payouts[0].transferFeeAmount = 8.5;
    input.payouts[0].transferFeeCurrency = 'USD';
    input.payouts[0].actualPaidAmount = 1258.5;
    input.payouts[0].actualPaidCurrency = 'USD';
    input.payouts[0].recipientReceivedAmount = 1250;
    input.payouts[0].recipientReceivedCurrency = 'USD';
    input.payouts[0].localClearingSystem = 'ACH';
    input.payouts[0].recipientCountry = 'United States';
    input.payouts[0].postTransactionBalance = 48_741.5;
    input.payouts[0].postTransactionBalanceCurrency = 'USD';
    const record = createPaymentBatchRecord({ ...input, status: '已付款', itemStatus: '已付款' });

    expect(record.request.requestCode).toBe('REQ-TEST-001');
    expect(record.items).toHaveLength(1);
    expect(record.items[0].contracts[0].contractCode).toBe('CON-TEST-001');
    expect(record.items[0].contracts[0].signer).toBe('测试达人工作室');
    expect(record.items[0].contracts[0].paymentAccount).toBe('测试达人工作室');
    expect(record.items[0].invoice?.invoiceNumber).toBe('INV-TEST-001');
    expect(record.items[0].paymentListCode).toBe('PAY-TEST-001');
    expect(record.items[0].accountSummary).toBe('1234567890');
    expect(record.items[0].accountName).toBe('1234567890');
    expect(record.items[0].accountIdentifier).toBe('1234567890');
    expect(record.items[0].accountIdentifierLabel).toBe('Account Number');
    expect(record.items[0].transferFeeAmount).toBe(8.5);
    expect(record.items[0].transferFeeCurrency).toBe('USD');
    expect(record.items[0].actualPaidAmount).toBe(1258.5);
    expect(record.items[0].actualPaidCurrency).toBe('USD');
    expect(record.items[0].recipientReceivedAmount).toBe(1250);
    expect(record.items[0].recipientReceivedCurrency).toBe('USD');
    expect(record.items[0].localClearingSystem).toBe('ACH');
    expect(record.items[0].recipientCountry).toBe('United States');
    expect(record.items[0].postTransactionBalance).toBe(48_741.5);
    expect(record.items[0].postTransactionBalanceCurrency).toBe('USD');
    expect(record.submittedAt).toBe('2026-08-10T10:30');
    expect(record.items[0].paymentSubmittedAt).toBe('2026-08-10T10:30');
    expect(record.items[0].paidAt).toBeUndefined();
  });

  it('normalizes successful batch and attempt snapshots into the recipient currency', () => {
    const input = buildInput();
    input.payouts[0].status = '已付款';
    input.payouts[0].transferFeeAmount = 8.5;
    input.payouts[0].transferFeeCurrency = 'USD';
    input.payouts[0].recipientReceivedAmount = 1250;
    input.payouts[0].recipientReceivedCurrency = 'USD';
    input.payouts[0].paymentAttempts = [{
      attemptNumber: 1,
      status: '已付款',
      principalAmount: 1250,
      principalCurrency: 'USD',
      transferFeeAmount: 8.5,
      transferFeeCurrency: 'USD',
      recipientReceivedAmount: 1250,
      recipientReceivedCurrency: 'USD',
    }];
    input.paymentLists[0] = {
      ...input.paymentLists[0],
      items: input.paymentLists[0].items.map((item) => ({
        ...item,
        snapshot: { ...item.snapshot, receiveCurrency: 'SGD' },
      })),
    };

    const record = createPaymentBatchRecord({ ...input, status: '已付款', itemStatus: '已付款' });

    expect(record.items[0].receiveCurrency).toBe('SGD');
    expect(record.items[0].recipientReceivedCurrency).toBe('SGD');
    expect(record.items[0].recipientReceivedAmount).toBe(1689.19);
    expect(record.items[0].paymentAttempts?.[0].recipientReceivedCurrency).toBe('SGD');
    expect(record.items[0].paymentAttempts?.[0].recipientReceivedAmount).toBe(1689.19);
  });

  it('summarizes the selected batch attempt without accumulating an earlier failed retry', () => {
    const input = buildInput();
    const record = createPaymentBatchRecord({ ...input, status: '已付款', itemStatus: '已付款' });
    const retryRecord = {
      ...record,
      paymentOrderCode: 'PAY-RETRY-002',
      sourcePaymentOrderCode: record.paymentOrderCode,
      paymentAttemptNumber: 2,
      items: record.items.map((item) => ({
        ...item,
        paymentOrderCode: 'PAY-RETRY-002',
        sourcePaymentOrderCode: record.paymentOrderCode,
        paymentAttemptNumber: 2,
        paymentAttempts: [
          {
            paymentBatchId: 'payment_batch_previous' as PaymentBatchId,
            paymentBatchCode: 'BAT-PREVIOUS',
            attemptNumber: 1,
            status: '付款失败' as const,
            occurredAt: '2026-08-09T10:00',
            principalAmount: 1250,
            principalCurrency: 'USD' as const,
            transferFeeAmount: 2.5,
            transferFeeCurrency: 'USD' as const,
            actualPaidAmount: 2.5,
            actualPaidCurrency: 'USD' as const,
          },
          {
            paymentBatchId: record.paymentBatchId,
            paymentBatchCode: record.paymentBatchCode,
            attemptNumber: 2,
            status: '已付款' as const,
            occurredAt: '2026-08-10T10:30',
            principalAmount: 1250,
            principalCurrency: 'USD' as const,
            transferFeeAmount: 8.5,
            transferFeeCurrency: 'USD' as const,
            actualPaidAmount: 1258.5,
            actualPaidCurrency: 'USD' as const,
          },
        ],
      })),
    };
    const summary = paymentBatchFinancialSummary(retryRecord);

    expect(paymentBatchMoneyTotalsLabel(summary.paymentAmounts)).toBe('USD 1,250');
    expect(paymentBatchMoneyTotalsLabel(summary.transferFeeAmounts)).toBe('USD 8.5');
    expect(paymentBatchMoneyTotalsLabel(summary.actualPaidAmounts)).toBe('USD 1,258.5');
    expect(summary.items[0].paymentStatus).toBe('已付款');
  });

  it.each([
    {
      provider: 'PayPal' as const,
      account: 'creator-paypal@example.com',
      expectedLabel: 'PayPal 邮箱',
    },
    {
      provider: 'PayMax' as const,
      account: 'paymax_account_10001',
      expectedLabel: 'PayMax 账户 ID',
    },
  ])('freezes the $provider recipient identifier instead of reading a later creator profile', ({
    provider,
    account,
    expectedLabel,
  }) => {
    const input = buildInput();
    const payout = createPayout(`payout-${provider.toLowerCase()}`, input.requests[0].cooperationProjectId!, 'INV-TEST-001', provider);
    payout.account = account;
    const invoice = createInvoice(payout, input.generatedInvoices[0].invoiceId, input.contracts[0].contractId!);
    const paymentList = createPaymentList(input.requests[0], invoice.invoiceId);
    paymentList.provider = provider;
    paymentList.items[0].snapshot.provider = provider;
    paymentList.items[0].snapshot.accountSummary = account;
    paymentList.items[0].snapshot.paymentDetails = invoice.snapshot.payment;

    const record = createPaymentBatchRecord({
      ...input,
      payouts: [payout],
      generatedInvoices: [invoice],
      paymentLists: [paymentList],
      provider,
    });

    expect(record.items[0].accountIdentifier).toBe(account);
    expect(record.items[0].accountIdentifierLabel).toBe(expectedLabel);
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

  it('rejects payment items from different source payment orders', () => {
    const input = buildInput();
    const secondInvoiceId = 'invoice_test_same_request' as InvoiceId;
    const secondPayout = createPayout(
      'payout-same-request-two',
      input.requests[0].cooperationProjectId!,
      'INV-TEST-002',
    );
    const secondInvoice = createInvoice(
      secondPayout,
      secondInvoiceId,
      input.contracts[0].contractId!,
    );
    const request = {
      ...input.requests[0],
      invoiceIds: [...(input.requests[0].invoiceIds ?? []), secondInvoiceId],
    };
    const secondPaymentList = createPaymentList(request, secondInvoiceId);
    secondPaymentList.paymentListCode = 'PAY-TEST-002';

    expect(() => createPaymentBatchRecord({
      ...input,
      payouts: [...input.payouts, secondPayout],
      requests: [request],
      generatedInvoices: [...input.generatedInvoices, secondInvoice],
      paymentLists: [...input.paymentLists, secondPaymentList],
    })).toThrow('一个付款批次只能关联一张原付款单');
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

  it('builds a project-level payment record without including payouts from other requests', () => {
    const input = buildInput();
    const paymentBatch = createPaymentBatchRecord(input);
    const failedPayout: Payout = {
      ...input.payouts[0],
      paymentRequestProjectId: input.requests[0].paymentRequestProjectId,
      status: '付款失败',
      paidAt: '2026-08-10T10:30',
      currentPaymentAttempt: {
        paymentBatchId: paymentBatch.paymentBatchId,
        paymentBatchCode: paymentBatch.paymentBatchCode,
        submittedAt: '2026-08-10T10:25',
        attemptNumber: 1,
      },
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
      paymentBatches: [paymentBatch],
    });

    expect(record.request.requestCode).toBe('REQ-TEST-001');
    expect(record.items.map((item) => item.payoutId)).toEqual(['payout-one']);
    expect(record.paymentOrderCodes).toEqual(['PAY-TEST-001']);
    expect(record.providers).toEqual(['Airwallex']);
    expect(record.status).toBe('部分失败');
    expect(record.lastActivityAt).toBe('2026-08-10T10:35');
    expect(record.items[0]).toMatchObject({
      paymentBatchId: paymentBatch.paymentBatchId,
      paymentBatchCode: paymentBatch.paymentBatchCode,
      paymentSubmittedAt: '2026-08-10T10:30',
      paidAt: '2026-08-10T10:30',
    });
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
    const batchedRequests = resources.requests.filter((request) => paymentBatchPrototypeStatusFor(request));
    const completedInvoiceIds = new Set(batchedRequests.flatMap((request) => request.invoiceIds ?? []));
    const expectedPayoutIds = resources.invoices
      .filter((invoice) => completedInvoiceIds.has(invoice.invoiceId))
      .map((invoice) => invoice.sourcePayoutId)
      .sort();
    const scenarioRecords = records.filter((record) => !String(record.paymentBatchId).startsWith('payment_batch_legacy_'));
    const historicalRecords = records.filter((record) => String(record.paymentBatchId).startsWith('payment_batch_legacy_'));
    const actualPayoutIds = scenarioRecords.flatMap((record) => record.items.map((item) => item.payoutId));

    expect(records).toHaveLength(20);
    expect(new Set(records.map((record) => record.paymentBatchId)).size).toBe(records.length);
    expect(new Set(records.map((record) => record.paymentBatchCode)).size).toBe(records.length);
    expect(scenarioRecords).toHaveLength(10);
    expect(historicalRecords).toHaveLength(Object.keys(HISTORICAL_PAYMENT_BATCH_SEEDS).length);
    expect(scenarioRecords.map((record) => record.paymentBatchCode)).toEqual([
      PAYMENT_BATCH_RETRY_DEMO.retryBatchCode,
      ...Array.from({ length: 9 }, (_, index) => `BAT-20260805-${String(9 - index).padStart(3, '0')}`),
    ]);
    expect(scenarioRecords[0].items[0]).toMatchObject({
      paymentOrderCode: PAYMENT_BATCH_RETRY_DEMO.retryPaymentOrderCode,
      paymentAttemptNumber: 2,
    });
    expect(scenarioRecords[0]).toMatchObject({
      paymentOrderCode: PAYMENT_BATCH_RETRY_DEMO.retryPaymentOrderCode,
      paymentAttemptNumber: 2,
    });
    expect(scenarioRecords[0].items[0].sourcePaymentOrderCode).not.toBe(scenarioRecords[0].items[0].paymentOrderCode);
    expect(scenarioRecords[0].sourcePaymentOrderCode).toBe(scenarioRecords[0].items[0].sourcePaymentOrderCode);
    expect(scenarioRecords.map((record) => record.items.length)).toEqual([1, 3, 5, 5, 5, 5, 5, 1, 5, 4]);
    expect(scenarioRecords.map((record) => record.request.requestCode)).toEqual([
      'REQ-202607-000011',
      PAYMENT_BATCH_PARTIAL_FAILURE_DEMO.requestCode,
      'REQ-202607-000011',
      'REQ-202607-000012',
      'REQ-202607-000012',
      'REQ-202607-000013',
      'REQ-202607-000013',
      'REQ-202607-000013',
      'REQ-202607-000014',
      'REQ-202607-000014',
    ]);
    expect(actualPayoutIds).toHaveLength(39);
    expect(new Set(actualPayoutIds).size).toBe(38);
    expect(expectedPayoutIds.every((payoutId) => actualPayoutIds.includes(payoutId))).toBe(true);
    expect(actualPayoutIds.filter((payoutId) => payoutId === scenarioRecords[0].items[0].payoutId)).toHaveLength(2);
    expect(new Set(scenarioRecords.map((record) => record.provider))).toEqual(new Set(['Airwallex']));
    expect(new Set(scenarioRecords.map((record) => record.payer))).toEqual(new Set(['奚文慧', '李梦', '吴雪霓']));
    expect(scenarioRecords.map((record) => record.status)).toEqual([
      '已付款',
      '部分失败',
      '部分失败',
      '付款处理中', '付款处理中',
      '已付款', '已付款', '已付款',
      '已付款', '已付款',
    ]);

    scenarioRecords.forEach((record) => {
      expect(record.items.length).toBeLessThanOrEqual(5);
      expect(new Set(record.items.map((item) => item.payoutId)).size).toBe(record.items.length);
      expect(record.request.lifecycle).toBe(record.status === '已付款' ? 'COMPLETED' : 'APPROVED');
      expect(new Set(record.items.map((item) => item.provider))).toEqual(new Set([record.provider]));
      expect(record.items.every((item) => item.paymentOrderCode === record.paymentOrderCode)).toBe(true);
      expect(record.items.every((item) => item.paymentAttemptNumber === record.paymentAttemptNumber)).toBe(true);
      expect(record.submittedAt).toBe(record.paidAt);
      expect(record.items.every((item) => item.paymentSubmittedAt === record.submittedAt)).toBe(true);
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
        const failedItem = record.items.find((item) => item.paymentStatus === '付款失败');
        expect(failedItem?.transferFeeAmount).toBeGreaterThan(0);
        expect(failedItem?.actualPaidAmount).toBe(failedItem?.transferFeeAmount);
        expect(failedItem?.recipientReceivedAmount).toBe(0);
        expect(counts).toEqual({ succeeded: record.items.length - 1, failed: 1, processing: 0 });
      }
    });

    historicalRecords.forEach((record) => {
      expect(record.items).toHaveLength(1);
      expect(record.items[0].associationIssues).toEqual([]);
      expect(record.items[0].invoice).toBeDefined();
      expect(record.items[0].contracts).toHaveLength(1);
      expect(record.items[0].paymentListId).toBeDefined();
      expect(record.paymentBatchCode).toBe(
        HISTORICAL_PAYMENT_BATCH_SEEDS[record.items[0].payoutId].paymentBatchCode,
      );
    });

    const originalRetrySource = records.find((record) => (
      record.paymentBatchCode === PAYMENT_BATCH_RETRY_DEMO.originalBatchCode
    ))!;
    const originalFailedItem = originalRetrySource.items.find((item) => item.paymentStatus === '付款失败')!;
    expect(originalRetrySource.paymentOrderCode).toBe(originalFailedItem.paymentListCode);
    expect(originalRetrySource.items).toHaveLength(5);
    expect(originalFailedItem).toMatchObject({
      amount: 15_288,
      transferFeeAmount: 30.58,
      actualPaidAmount: 30.58,
    });
    expect(records[0].items[0]).toMatchObject({
      payoutId: originalFailedItem.payoutId,
      amount: 15_288,
      transferFeeAmount: 30.58,
      actualPaidAmount: 15_318.58,
      paymentStatus: '已付款',
    });

    const partialFailureBatch = records.find((record) => (
      record.request.requestCode === PAYMENT_BATCH_PARTIAL_FAILURE_DEMO.requestCode
    ))!;
    expect(partialFailureBatch).toMatchObject({
      paymentBatchCode: 'BAT-20260805-009',
      status: '部分失败',
    });
    expect(partialFailureBatch.items.map((item) => item.payoutId)).toEqual(
      PAYMENT_BATCH_PARTIAL_FAILURE_DEMO.payoutIds,
    );
    expect(partialFailureBatch.items.filter((item) => item.paymentStatus === '付款失败'))
      .toEqual([expect.objectContaining({ payoutId: PAYMENT_BATCH_PARTIAL_FAILURE_DEMO.failedPayoutId })]);
  });
});
