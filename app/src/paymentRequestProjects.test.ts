import { describe, expect, it } from 'vitest';
import type { ContractRecord } from './contracts';
import type {
  ContractId,
  CooperationProjectId,
  CreatorId,
  EngagementId,
  InvoiceId,
  PaymentListRecord,
  PaymentRequestProjectId,
  RequestApprovalState,
  RequestApprovalStatus,
} from './businessWorkflow';
import {
  canAddCreatorToPaymentRequest,
  addInvoiceToPaymentRequestSelection,
  createEmptyPaymentRequestListFilters,
  createPaymentRequestListItem,
  filterPaymentRequestList,
  normalizePaymentRequestCreatorLink,
  paymentRequestAmountLabel,
  paymentRequestChannelForProvider,
  paymentRequestCreatorPresentation,
  paymentRequestExtraDetailIssues,
  paymentRequestInvoiceIds,
  paymentRequestPaymentPlanFor,
  paymentRequestPaymentPlanIssues,
  paymentRequestProviderForChannel,
  invoiceAmountLabel,
  isPaymentRequestFullyPaid,
  myProjectStatusFor,
  mergePaymentRequestRemarkAttachments,
  paymentRequestListMetrics,
  paymentRequestSubmissionIssues,
  resolveCreatorDocuments,
  requestProjectStatusFor,
  type PaymentRequestListItem,
  type PaymentRequestCreatorLink,
} from './paymentRequestProjects';
import type { GeneratedInvoiceRecord } from './types';

const cooperationProjectId = 'cooperation_project_001' as CooperationProjectId;
const otherProjectId = 'cooperation_project_002' as CooperationProjectId;
const creatorId = 'creator_001' as CreatorId;
const otherCreatorId = 'creator_002' as CreatorId;
const engagementId = 'engagement_001' as EngagementId;

const approvalState = (status: RequestApprovalStatus): RequestApprovalState => ({
  status,
  round: 1,
  history: [],
  submittedAt: '2026-08-07T02:00:00.000Z',
  updatedAt: '2026-08-07T02:00:00.000Z',
});

const invoice = (overrides: Partial<GeneratedInvoiceRecord> = {}): GeneratedInvoiceRecord => ({
  id: 'INV-20260807-000001',
  invoiceId: 'invoice_001' as InvoiceId,
  sourcePayoutId: 'payout_001',
  status: '已通过',
  generatedAt: '2026-08-07T02:00:00.000Z',
  validationStatus: 'valid',
  snapshot: {
    cooperationProjectId,
    projectId: cooperationProjectId,
    projectName: 'Synthetic Creator Campaign',
    creatorId,
    creatorName: 'Synthetic Creator',
    creatorHandle: '@synthetic.creator',
    engagementId,
    invoiceNumber: 'INV-20260807-000001',
    invoiceDate: '2026-08-07',
    billTo: { name: 'Example Advertiser', address: 'Example Address' },
    from: { legalName: 'Synthetic Creator', phone: '', email: 'creator@example.test', address: 'Example Address' },
    currency: 'USD',
    items: [{ id: 'line-1', description: 'Creator service', unitPrice: 100, quantity: 1, lineTotal: 100 }],
    paymentMethod: 'paypal',
    payment: {
      bankCountry: '', accountName: 'Synthetic Creator', accountType: '', swiftCode: '', accountNumber: '', iban: '',
      beneficiaryType: '', bankName: '', bankStreetAddress: '', bankCity: '', bankState: '', bankPostalCode: '',
      intermediaryBankCountry: '', intermediaryBankCode: '', transferRemarks: '', paypalUsername: 'synthetic.creator',
      paypalEmail: 'creator@example.test', payoutProvider: 'PayPal',
    },
  },
  ...overrides,
});

const contract = (id: string, projectId = cooperationProjectId, contractCreatorId = creatorId): ContractRecord => ({
  id,
  contractId: id.toLowerCase() as ContractId,
  ioId: 'IO-SYNTHETIC',
  name: 'Synthetic contract',
  templateFamily: 'Synthetic',
  sourceName: 'synthetic.pdf',
  documentUrl: '',
  isTemplate: false,
  project: 'Synthetic Creator Campaign',
  brand: 'Example Brand',
  advertiser: 'Example Advertiser',
  publisher: 'Synthetic Creator',
  channelName: '@synthetic.creator',
  channelLink: 'https://example.test/channel',
  platform: 'YouTube',
  effectiveDate: '2026-08-01',
  campaignStart: '2026-08-01',
  campaignEnd: '2026-08-31',
  currency: 'USD',
  totalFee: 100,
  licensePrice: null,
  licenseIncludedInTotal: null,
  invoiceWithinWorkingDays: 3,
  paymentWithinWorkingDays: 45,
  feeBearer: 'ADVERTISER',
  paymentMethod: 'PAYPAL',
  accountName: 'Synthetic Creator',
  accountFingerprint: 'test-fingerprint',
  signed: true,
  status: '已归档',
  updated: '2026-08-07',
  deliverables: [],
  issues: [],
  projectId,
  cooperationProjectId: projectId,
  creatorId: contractCreatorId,
  engagementId,
  lifecycle: 'CONFIRMED',
});

describe('payment request payment plan', () => {
  it('requires both the payment channel and expected payment date', () => {
    expect(paymentRequestPaymentPlanIssues(paymentRequestPaymentPlanFor())).toEqual([
      '请选择付款渠道',
      '请选择预计付款时间',
    ]);
    expect(paymentRequestPaymentPlanIssues({
      paymentChannel: 'Airwallex',
      expectedPaymentDate: '',
    })).toEqual(['请选择预计付款时间']);
    expect(paymentRequestPaymentPlanIssues({
      paymentChannel: 'PayPal',
      expectedPaymentDate: '2026-08-20',
    })).toEqual([]);
  });

  it('hydrates saved values when a request is edited', () => {
    expect(paymentRequestPaymentPlanFor({
      paymentChannel: 'Payermax',
      expectedPaymentDate: '2026-08-28',
    })).toEqual({
      paymentChannel: 'Payermax',
      expectedPaymentDate: '2026-08-28',
    });
  });

  it('maps the project-level channel to the execution provider without creating a second channel', () => {
    expect(paymentRequestProviderForChannel('Airwallex')).toBe('Airwallex');
    expect(paymentRequestProviderForChannel('PayPal')).toBe('PayPal');
    expect(paymentRequestProviderForChannel('Payermax')).toBe('PayMax');
    expect(paymentRequestChannelForProvider('PayMax')).toBe('Payermax');
  });
});

describe('payment request extra details', () => {
  it('requires a cost type and fee bearer while leaving remarks optional', () => {
    expect(paymentRequestExtraDetailIssues({})).toEqual([
      '请填写成本类型',
      '请选择手续费承担方',
    ]);
    expect(paymentRequestExtraDetailIssues({
      costType: '达人合作费',
      feeBearer: '各自承担',
    })).toEqual([]);
  });

  it('keeps file metadata and removes only exact duplicate attachments', () => {
    const first = { name: '付款说明.pdf', size: 1024, type: 'application/pdf', lastModified: 1 };
    const sameNameNewVersion = { ...first, size: 2048, lastModified: 2 };

    expect(mergePaymentRequestRemarkAttachments([first], [first, sameNameNewVersion])).toEqual([
      first,
      sameNameNewVersion,
    ]);
  });
});

describe('media payment request document resolution', () => {
  it('shows the Invoice amount and auto-links only confirmed contracts from its stable snapshot ids', () => {
    const validContract = contract('CON-VALID');
    const pendingContract = { ...contract('CON-PENDING'), lifecycle: 'UPLOADED_PENDING_CONFIRMATION' as const };
    const foreignContract = contract('CON-FOREIGN', cooperationProjectId, otherCreatorId);
    const foreignEngagementContract = {
      ...contract('CON-FOREIGN-ENGAGEMENT'),
      engagementId: 'engagement-foreign' as EngagementId,
    };
    const sourceInvoice = invoice({
      snapshot: {
        ...invoice().snapshot,
        contractIds: [
          validContract.contractId!,
          pendingContract.contractId!,
          foreignContract.contractId!,
          foreignEngagementContract.contractId!,
        ],
        items: [{ id: 'line-amount', description: 'Synthetic service', unitPrice: 625.25, quantity: 2, lineTotal: 1250.5 }],
      },
    });

    const result = addInvoiceToPaymentRequestSelection({
      invoice: sourceInvoice,
      invoices: [sourceInvoice],
      contracts: [validContract, pendingContract, foreignContract, foreignEngagementContract],
      selectedInvoiceIds: [],
      selectedContractIds: [],
    });

    expect(invoiceAmountLabel(sourceInvoice)).toBe('USD 1,250.50');
    expect(result.invoiceIds).toEqual([sourceInvoice.invoiceId]);
    expect(result.contractIds).toEqual([validContract.contractId]);
    expect(result.autoLinkedContractIds).toEqual([validContract.contractId]);
  });

  it('normalizes legacy single-invoice links and de-duplicates invoice ids', () => {
    const legacy = normalizePaymentRequestCreatorLink({
      creatorId,
      engagementId,
      contractIds: [],
      invoiceId: 'invoice_001' as InvoiceId,
      invoiceIds: ['invoice_001' as InvoiceId, 'invoice_002' as InvoiceId],
    });
    expect(legacy.invoiceIds).toEqual(['invoice_001', 'invoice_002']);
    expect(paymentRequestInvoiceIds([legacy])).toEqual(['invoice_001', 'invoice_002']);
  });

  it('filters contracts and all available invoices by cooperation project and creator ids', () => {
    const result = resolveCreatorDocuments({
      cooperationProjectId,
      creatorId,
      contracts: [
        contract('CON-VALID'),
        contract('CON-OTHER-PROJECT', otherProjectId),
        contract('CON-OTHER-CREATOR', cooperationProjectId, otherCreatorId),
      ],
      invoices: [
        invoice(),
        invoice({
          id: 'INV-OTHER-PROJECT',
          invoiceId: 'invoice_other_project' as InvoiceId,
          snapshot: { ...invoice().snapshot, cooperationProjectId: otherProjectId, projectId: otherProjectId },
        }),
      ],
      requests: [],
    });
    expect(result.status).toBe('READY');
    expect(result.contracts.map((item) => item.id)).toEqual(['CON-VALID']);
    expect(result.availableInvoices.map((item) => item.id)).toEqual(['INV-20260807-000001']);
  });

  it('allows multiple invoices and blocks only missing or already-used candidates', () => {
    const missing = resolveCreatorDocuments({ cooperationProjectId, creatorId, contracts: [], invoices: [], requests: [] });
    expect(missing.status).toBe('MISSING_INVOICE');

    const multiple = resolveCreatorDocuments({
      cooperationProjectId,
      creatorId,
      contracts: [],
      invoices: [invoice(), invoice({ id: 'INV-SECOND', invoiceId: 'invoice_002' as InvoiceId })],
      requests: [],
    });
    expect(multiple.status).toBe('READY');
    expect(multiple.availableInvoices).toHaveLength(2);

    const used = resolveCreatorDocuments({
      cooperationProjectId,
      creatorId,
      contracts: [],
      invoices: [invoice()],
      requests: [{
        id: 'REQ-USED',
        requestCode: 'REQ-USED',
        creatorLinks: [{ creatorId, engagementId, contractIds: [], invoiceIds: ['invoice_001' as InvoiceId] }],
      }],
    });
    expect(used.status).toBe('INVOICE_IN_USE');
    expect(used.invoiceOwners[0]?.owner.requestCode).toBe('REQ-USED');
  });

  it('does not expose unsigned or unreviewed invoices to a payment request', () => {
    const unresolved = resolveCreatorDocuments({
      cooperationProjectId,
      creatorId,
      contracts: [],
      invoices: [invoice({ status: '待媒介审核' })],
      requests: [],
    });

    expect(unresolved.status).toBe('INVOICE_NOT_APPROVED');
    expect(unresolved.availableInvoices).toEqual([]);
  });
});

describe('media payment request submission validation', () => {
  const link: PaymentRequestCreatorLink = {
    creatorId,
    engagementId,
    contractIds: [],
    invoiceIds: ['invoice_001' as InvoiceId],
  };
  const paymentRequestProjectId = 'request_project_001' as PaymentRequestProjectId;
  const paymentList = (): PaymentListRecord => ({
    paymentListId: 'payment_list_001' as PaymentListRecord['paymentListId'],
    paymentListCode: 'PAY-20260807-000001',
    paymentRequestProjectId,
    projectId: cooperationProjectId,
    provider: 'PayPal',
    status: 'generated',
    items: [{
      id: 'item-1',
      engagementId,
      invoiceId: link.invoiceIds[0],
      snapshot: {
        invoiceNumber: 'INV-20260807-000001', creatorName: 'Synthetic Creator', currency: 'USD', receiveCurrency: 'USD', amount: 100,
        provider: 'PayPal', accountSummary: 'verified@example.test', paymentReason: '', transactionReference: '', description: '',
      },
      overrides: {},
    }],
    createdAt: '2026-08-07T02:00:00.000Z',
    updatedAt: '2026-08-07T02:00:00.000Z',
  });

  it('requires a request-specific payment list and a request-ready invoice', () => {
    expect(paymentRequestSubmissionIssues({
      creatorLinks: [link], invoices: [invoice()], paymentLists: [], paymentRequestProjectId,
    })).toContain('INV-20260807-000001 尚未生成付款清单');

    expect(paymentRequestSubmissionIssues({
      creatorLinks: [link],
      invoices: [invoice({ status: '待签署' })],
      paymentLists: [paymentList()],
      paymentRequestProjectId,
    })).toContain('INV-20260807-000001 尚未完成签署和媒介审核');

    expect(paymentRequestSubmissionIssues({
      creatorLinks: [link], invoices: [invoice()], paymentLists: [paymentList()], paymentRequestProjectId,
    })).toEqual([]);
  });

  it('rejects an invoice linked to a different creator or engagement', () => {
    const mismatched = invoice({
      snapshot: {
        ...invoice().snapshot,
        creatorId: 'creator_other' as CreatorId,
      },
    });
    const issues = paymentRequestSubmissionIssues({
      creatorLinks: [link],
      invoices: [mismatched],
      paymentLists: [paymentList()],
      paymentRequestProjectId,
    });

    expect(issues).toContain(`${mismatched.id} 与当前达人或合作关系不一致`);
  });

  it('creates a validated request-specific payment row when the contract is optional', () => {
    const source = invoice({
      snapshot: {
        ...invoice().snapshot,
        payoutAccountId: 'paypal-synthetic',
        payoutAccountVersion: 'v1',
        payoutProvider: 'PayPal',
        payoutAccountFingerprint: 'paypal-fingerprint',
        payment: {
          ...invoice().snapshot.payment,
          payoutAccountId: 'paypal-synthetic',
          payoutAccountVersion: 'v1',
          payoutProvider: 'PayPal',
          accountFingerprint: 'paypal-fingerprint',
          validationStatus: 'VERIFIED',
          transferMethod: 'PAYPAL',
          accountCurrency: 'USD',
        },
      },
    });
    const item = createPaymentRequestListItem({
      invoice: source,
      contracts: [],
      feeBearer: '付款方',
    });

    expect(item.snapshot.feeBearer).toBe('ADVERTISER');
    expect(item.snapshot.transactionReference).toBe('');
    expect(item.requiresRevalidation).toBe(true);
    expect(item.validationIssues).toEqual(expect.arrayContaining([
      '交易附言未填写',
      '付款描述未填写',
    ]));
  });

  it.each([
    ['付款方', 'ADVERTISER'],
    ['收款方', 'PUBLISHER'],
    ['各自承担', 'SHARED'],
  ] as const)('inherits request fee bearer %s into the payment row as %s', (feeBearer, expected) => {
    const item = createPaymentRequestListItem({
      invoice: invoice(),
      contracts: [],
      feeBearer,
    });

    expect(item.snapshot.feeBearer).toBe(expected);
    expect(item.overrides).not.toHaveProperty('feeBearer');
  });

  it('sums multiple invoices for one creator and rejects duplicate or extra payment rows', () => {
    const second = invoice({
      id: 'INV-20260807-000002',
      invoiceId: 'invoice_002' as InvoiceId,
      snapshot: {
        ...invoice().snapshot,
        invoiceNumber: 'INV-20260807-000002',
        items: [{ id: 'line-2', description: 'Second service', unitPrice: 50, quantity: 1, lineTotal: 50 }],
      },
    });
    const multiLink = { ...link, invoiceIds: [link.invoiceIds[0], second.invoiceId] };
    expect(paymentRequestAmountLabel([multiLink], [invoice(), second])).toBe('USD 150');

    const duplicateList = paymentList();
    duplicateList.items = [duplicateList.items[0], { ...duplicateList.items[0], id: 'item-duplicate' }];
    expect(paymentRequestSubmissionIssues({
      creatorLinks: [link], invoices: [invoice()], paymentLists: [duplicateList], paymentRequestProjectId,
    })).toContain('Invoice invoice_001 在付款清单中重复出现');

    const extraList = paymentList();
    extraList.items.push({ ...extraList.items[0], id: 'item-extra', invoiceId: 'invoice_extra' as InvoiceId });
    expect(paymentRequestSubmissionIssues({
      creatorLinks: [link], invoices: [invoice()], paymentLists: [extraList], paymentRequestProjectId,
    })).toContain('付款清单包含当前请款项目未关联的 Invoice invoice_extra');
  });

  it('rejects more than one payment order for the same request project', () => {
    const first = paymentList();
    const second = {
      ...paymentList(),
      paymentListId: 'payment_list_002' as PaymentListRecord['paymentListId'],
      paymentListCode: 'PAY-20260807-000002',
      items: [],
    };

    expect(paymentRequestSubmissionIssues({
      creatorLinks: [link],
      invoices: [invoice()],
      paymentLists: [first, second],
      paymentRequestProjectId,
    })).toContain('一个请款项目只能关联一张付款单');
  });

  it('rejects a payment item whose account channel differs from the request channel', () => {
    expect(paymentRequestSubmissionIssues({
      creatorLinks: [link],
      invoices: [invoice()],
      paymentLists: [paymentList()],
      paymentRequestProjectId,
      paymentChannel: 'Airwallex',
    })).toContain('INV-20260807-000001 的收款账户渠道与请款项目付款渠道 Airwallex 不一致');
    expect(paymentRequestSubmissionIssues({
      creatorLinks: [link],
      invoices: [invoice()],
      paymentLists: [paymentList()],
      paymentRequestProjectId,
      paymentChannel: 'PayPal',
    })).toEqual([]);
  });
});

describe('media payment request creator table presentation', () => {
  const link: PaymentRequestCreatorLink = {
    creatorId,
    engagementId,
    contractIds: [],
    invoiceIds: ['invoice_001' as InvoiceId],
  };
  const paymentRequestProjectId = 'request_project_presentation' as PaymentRequestProjectId;
  const readyPaymentList = (): PaymentListRecord => ({
    paymentListId: 'payment_list_presentation' as PaymentListRecord['paymentListId'],
    paymentListCode: 'PAY-20260807-PRESENT',
    paymentRequestProjectId,
    projectId: cooperationProjectId,
    provider: 'Airwallex',
    status: 'generated',
    items: [{
      id: 'presentation-item-1',
      engagementId,
      invoiceId: link.invoiceIds[0],
      snapshot: {
        invoiceNumber: 'INV-20260807-000001',
        creatorName: 'Synthetic Creator',
        currency: 'USD',
        receiveCurrency: 'USD',
        amount: 100,
        provider: 'Airwallex',
        accountSummary: 'Airwallex · 1234',
        paymentReason: '',
        transactionReference: 'REQ-PRESENT-01',
        description: '',
        payoutAccountId: 'payout_account_001',
        validationStatus: 'VERIFIED',
      },
      overrides: {},
      requiresRevalidation: false,
      validationIssues: [],
    }],
    createdAt: '2026-08-07T02:00:00.000Z',
    updatedAt: '2026-08-07T02:00:00.000Z',
  });

  it('treats the contract as optional and presents a ready Airwallex request', () => {
    const result = paymentRequestCreatorPresentation({
      link,
      invoices: [invoice()],
      contracts: [],
      paymentLists: [readyPaymentList()],
      paymentRequestProjectId,
      requestLifecycle: 'DRAFT',
      requestStatus: '草稿',
    });

    expect(result.contracts).toEqual([]);
    expect(result.invoices[0]).toMatchObject({
      provider: 'Airwallex',
      invoiceAmountLabel: 'USD 100',
      requestAmountLabel: 'USD 100',
      requestAmountSource: 'PAYMENT_LIST',
      amountAdjusted: false,
    });
    expect(result.statuses).toEqual([{ label: '可提交', tone: 'success' }]);
  });

  it('distinguishes a missing Invoice from an optional missing contract', () => {
    const result = paymentRequestCreatorPresentation({
      link: { ...link, invoiceIds: [], contractIds: [] },
      invoices: [],
      contracts: [],
      paymentLists: [],
      paymentRequestProjectId,
      requestLifecycle: 'DRAFT',
    });

    expect(result.invoices).toEqual([]);
    expect(result.contracts).toEqual([]);
    expect(result.statuses).toEqual([{ label: '待补 Invoice', tone: 'danger' }]);
  });

  it('surfaces an unready Invoice, a missing generated list, and an account issue separately', () => {
    const unready = paymentRequestCreatorPresentation({
      link,
      invoices: [invoice({ status: '待签署' })],
      contracts: [],
      paymentLists: [],
      paymentRequestProjectId,
      requestLifecycle: 'DRAFT',
    });
    expect(unready.statuses.map((status) => status.label)).toEqual([
      'Invoice 状态未就绪',
      '付款清单待生成',
    ]);

    const invalidAccountList = readyPaymentList();
    invalidAccountList.items[0] = {
      ...invalidAccountList.items[0],
      snapshot: {
        ...invalidAccountList.items[0].snapshot,
        payoutAccountId: '',
      },
    };
    const invalidAccount = paymentRequestCreatorPresentation({
      link,
      invoices: [invoice()],
      contracts: [],
      paymentLists: [invalidAccountList],
      paymentRequestProjectId,
      requestLifecycle: 'DRAFT',
    });
    expect(invalidAccount.statuses).toEqual([{ label: '付款账户待核对', tone: 'danger' }]);
  });

  it('uses the payment-list account override and keeps Invoice and request amounts separate', () => {
    const second = invoice({
      id: 'INV-20260807-000002',
      invoiceId: 'invoice_002' as InvoiceId,
      snapshot: {
        ...invoice().snapshot,
        invoiceNumber: 'INV-20260807-000002',
        currency: 'EUR',
        items: [{ id: 'line-eur', description: 'Synthetic service', unitPrice: 50, quantity: 1, lineTotal: 50 }],
      },
    });
    const list = readyPaymentList();
    list.items[0] = {
      ...list.items[0],
      accountOverride: {
        provider: 'PayPal',
        accountSummary: 'synthetic@example.test',
        receiveCurrency: 'USD',
        payoutAccountId: 'paypal_account_001',
        validationStatus: 'VERIFIED',
      },
      overrides: { amount: 120 },
    };
    list.items.push({
      ...list.items[0],
      id: 'presentation-item-2',
      invoiceId: second.invoiceId,
      snapshot: {
        ...list.items[0].snapshot,
        invoiceNumber: second.snapshot.invoiceNumber,
        currency: 'EUR',
        receiveCurrency: 'EUR',
        amount: 50,
      },
      accountOverride: undefined,
      overrides: {},
    });
    const result = paymentRequestCreatorPresentation({
      link: { ...link, invoiceIds: [link.invoiceIds[0], second.invoiceId] },
      invoices: [invoice(), second],
      contracts: [],
      paymentLists: [list],
      paymentRequestProjectId,
      requestLifecycle: 'DRAFT',
    });

    expect(result.invoices.map((row) => row.provider)).toEqual(['PayPal', 'Airwallex']);
    expect(result.invoices[0]).toMatchObject({
      invoiceAmountLabel: 'USD 100',
      requestAmountLabel: 'USD 120',
      amountAdjusted: true,
    });
    expect(result.invoiceTotalLabel).toBe('USD 100 + EUR 50');
    expect(result.requestTotalLabel).toBe('USD 120 + EUR 50');
    expect(result.statuses.map((status) => status.label)).toEqual([
      '付款账户待核对',
      '付款金额已调整',
    ]);
  });

  it('resolves display numbers by stable ids and flags missing contract references', () => {
    const validContract = contract('CON-PRESENTATION');
    const result = paymentRequestCreatorPresentation({
      link: {
        ...link,
        contractIds: [validContract.contractId!, 'missing_contract' as ContractId],
      },
      invoices: [invoice()],
      contracts: [validContract],
      paymentLists: [readyPaymentList()],
      paymentRequestProjectId,
      requestLifecycle: 'DRAFT',
    });

    expect(result.contracts.map((row) => row.contractNumber)).toEqual([
      'CON-PRESENTATION',
      '关联记录异常',
    ]);
    expect(result.statuses).toContainEqual({ label: '关联记录异常', tone: 'danger' });
  });

  it('shows the request approval state after the creator row is locked', () => {
    const result = paymentRequestCreatorPresentation({
      link,
      invoices: [invoice({ status: '待签署' })],
      contracts: [],
      paymentLists: [],
      paymentRequestProjectId,
      requestLifecycle: 'SUBMITTED',
      requestStatus: '财务审批中',
    });

    expect(result.statuses).toEqual([{ label: '财务审批中', tone: 'info' }]);
  });
});

describe('media payment request list presentation', () => {
  const requests: PaymentRequestListItem[] = [
    {
      id: 'request-1',
      requestCode: 'REQ-20260807-000001',
      lifecycle: 'SUBMITTED',
      approval: approvalState('PENDING_PM'),
      cooperationProjectName: 'Creator Launch Campaign',
      project: 'Creator Launch Campaign',
      brand: 'Example Brand',
      pm: 'PM A',
      amount: 'USD 1,200',
      status: '待审批',
    },
    {
      id: 'request-2',
      requestCode: 'REQ-20260807-000002',
      lifecycle: 'SUBMITTED',
      approval: approvalState('PENDING_FINANCE'),
      cooperationProjectName: 'Streaming Campaign',
      project: 'Streaming Campaign',
      brand: 'Example Brand',
      pm: 'PM B',
      amount: 'USD 2,400',
      status: '财务审批中',
    },
    {
      id: 'request-3',
      requestCode: 'REQ-20260807-000003',
      lifecycle: 'APPROVED',
      approval: approvalState('APPROVED'),
      cooperationProjectName: 'Review Campaign',
      project: 'Review Campaign',
      brand: 'Other Brand',
      pm: 'PM A',
      amount: 'EUR 900',
      status: '待打款',
    },
  ];

  it('calculates review, payment and total metrics from the visible records', () => {
    expect(paymentRequestListMetrics(requests)).toEqual({
      reviewing: 2,
      reviewTotal: 2,
      waitingPayment: 1,
      total: 3,
    });
  });

  it('filters by project search, customer, PM, amount and the existing status value', () => {
    const filters = {
      ...createEmptyPaymentRequestListFilters(),
      customers: ['Example Brand'],
      pms: ['PM B'],
      currency: 'USD',
      minBudget: '2000',
      maxBudget: '3000',
      statuses: ['财务审批中'],
    };
    const result = filterPaymentRequestList({ requests, search: 'streaming', filters });
    expect(result.invalidBudgetRange).toBe(false);
    expect(result.visible.map((request) => request.id)).toEqual(['request-2']);
  });

  it('accepts a live payment-status resolver for the My Projects status filter', () => {
    const filters = {
      ...createEmptyPaymentRequestListFilters(),
      statuses: ['部分打款失败'],
    };
    const result = filterPaymentRequestList({
      requests,
      search: '',
      filters,
      statusFor: (request) => request.id === 'request-3' ? '部分打款失败' : myProjectStatusFor(request),
    });

    expect(result.visible.map((request) => request.id)).toEqual(['request-3']);
  });

  it('only allows adding creators while the request remains a draft', () => {
    expect(canAddCreatorToPaymentRequest({ id: 'draft', lifecycle: 'DRAFT' })).toBe(true);
    expect(canAddCreatorToPaymentRequest({ id: 'returned', lifecycle: 'RETURNED' })).toBe(false);
    expect(canAddCreatorToPaymentRequest({ id: 'submitted', lifecycle: 'SUBMITTED' })).toBe(false);
  });
});

describe('payment request module status presentation', () => {
  it.each([
    ['PENDING_PM', 'PM审批中', '请款提交'],
    ['PENDING_PROJECT_OWNER', '项目负责人审批中', 'PM审批通过'],
    ['PENDING_OWNER', '老板审批中', '项目负责人审批通过'],
    ['PENDING_FINANCE', '财务审批中', '老板审批通过'],
    ['APPROVED', '待打款', '财务审批通过'],
    ['RETURNED_TO_MEDIA_REVIEW', '已退回', '已退回'],
  ] as const)('maps %s to separate module labels', (approvalStatus, myStatus, requestStatus) => {
    const source = {
      id: 'request-status',
      lifecycle: approvalStatus === 'APPROVED'
        ? 'APPROVED' as const
        : approvalStatus === 'RETURNED_TO_MEDIA_REVIEW'
          ? 'RETURNED' as const
          : 'SUBMITTED' as const,
      approval: approvalState(approvalStatus),
    };
    expect(myProjectStatusFor(source)).toBe(myStatus);
    expect(requestProjectStatusFor(source)).toBe(requestStatus);
  });

  it('keeps drafts out of request-project status and maps completed requests to paid', () => {
    expect(myProjectStatusFor({ lifecycle: 'DRAFT' })).toBe('草稿');
    expect(requestProjectStatusFor({ lifecycle: 'DRAFT' })).toBeNull();
    expect(myProjectStatusFor({ lifecycle: 'COMPLETED' })).toBe('已付款');
    expect(requestProjectStatusFor({ lifecycle: 'COMPLETED' })).toBe('已付款');
  });

  it('keeps the partial payment failure status available to My Projects filters', () => {
    expect(myProjectStatusFor({ lifecycle: 'RETURNED', status: '部分打款失败' })).toBe('部分打款失败');
  });
});

describe('payment request completion isolation', () => {
  const secondInvoice = invoice({
    id: 'INV-SECOND',
    invoiceId: 'invoice_002' as InvoiceId,
    sourcePayoutId: 'payout_002',
  });
  const otherRequestInvoice = invoice({
    id: 'INV-OTHER-REQUEST',
    invoiceId: 'invoice_003' as InvoiceId,
    sourcePayoutId: 'payout_003',
  });
  const request = {
    id: 'request-a',
    projectId: cooperationProjectId,
    lifecycle: 'APPROVED' as const,
    invoiceIds: [invoice().invoiceId, secondInvoice.invoiceId],
  };
  const otherRequest = {
    id: 'request-b',
    projectId: cooperationProjectId,
    lifecycle: 'APPROVED' as const,
    invoiceIds: [otherRequestInvoice.invoiceId],
  };
  const invoices = [invoice(), secondInvoice, otherRequestInvoice];

  it('waits for every linked payout and does not use the shared cooperation project id', () => {
    const partialPayouts = [
      { id: 'payout_001', status: '已付款' },
      { id: 'payout_002', status: '付款处理中' },
      { id: 'payout_003', status: '已付款' },
    ];
    expect(isPaymentRequestFullyPaid({ request, invoices, payouts: partialPayouts })).toBe(false);
    expect(isPaymentRequestFullyPaid({ request: otherRequest, invoices, payouts: partialPayouts })).toBe(true);

    expect(isPaymentRequestFullyPaid({
      request,
      invoices,
      payouts: partialPayouts.map((payout) => (
        payout.id === 'payout_002' ? { ...payout, status: '已付款' } : payout
      )),
    })).toBe(true);
  });
});
