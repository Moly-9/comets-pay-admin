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
  DEFAULT_PAYMENT_REQUEST_COST_TYPE,
  PAYMENT_REQUEST_COST_ATTRIBUTIONS,
  PAYMENT_REQUEST_COST_TYPES,
  PAYMENT_REQUEST_PAYMENT_ENTITIES,
  PAYMENT_REQUEST_PROCUREMENT_COST_DETAILS,
  canAddCreatorToPaymentRequest,
  canCancelPaymentRequest,
  addInvoiceToPaymentRequestSelection,
  createEmptyPaymentRequestListFilters,
  createPaymentRequestListItem,
  filterPaymentRequestList,
  normalizePaymentRequestCreatorLink,
  paymentRequestAmountLabel,
  paymentRequestChannelForProvider,
  paymentRequestCreatorPresentation,
  paymentRequestExtraDetailIssues,
  paymentRequestDraftCreatorsReady,
  paymentRequestFirstSubmittedAt,
  paymentRequestHasPaymentActivity,
  paymentRequestInvoiceIds,
  paymentRequestPaymentPlanFor,
  paymentRequestPaymentPlanIssues,
  paymentRequestProviderForChannel,
  invoiceAmountLabel,
  isPaymentRequestFullyPaid,
  myProjectStatusFor,
  mergePaymentRequestRemarkAttachments,
  normalizePaymentRequestProcurementCostDetail,
  normalizePaymentRequestCostType,
  paymentRequestListMetrics,
  paymentRequestSubmissionIssues,
  paymentRequestCancellationIssue,
  resolveCreatorDocuments,
  requestProjectStatusFor,
  requestOwningInvoice,
  type PaymentRequestListItem,
  type PaymentRequestCreatorLink,
} from './paymentRequestProjects';
import type { GeneratedInvoiceRecord, Payout } from './types';

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
  it('requires the payment channel, payment entity, cost attribution, and expected date', () => {
    expect(paymentRequestPaymentPlanIssues(paymentRequestPaymentPlanFor())).toEqual([
      '请选择付款渠道',
      '请选择付款主体',
      '请选择项目费用归属',
      '请选择预计付款时间',
    ]);
    expect(paymentRequestPaymentPlanIssues({
      paymentChannel: 'Airwallex',
      paymentEntity: '',
      projectCostAttribution: '',
      expectedPaymentDate: '',
    })).toEqual(['请选择付款主体', '请选择项目费用归属', '请选择预计付款时间']);
    expect(paymentRequestPaymentPlanIssues({
      paymentChannel: 'PayPal',
      paymentEntity: 'Comets International Limited',
      projectCostAttribution: '香港公司（comets）',
      expectedPaymentDate: '2026-08-20',
    })).toEqual([]);
  });

  it('hydrates saved values when a request is edited', () => {
    expect(paymentRequestPaymentPlanFor({
      paymentChannel: 'Payermax',
      paymentEntity: 'novacomets',
      projectCostAttribution: 'novacomets',
      expectedPaymentDate: '2026-08-28',
    })).toEqual({
      paymentChannel: 'Payermax',
      paymentEntity: 'novacomets',
      projectCostAttribution: 'novacomets',
      expectedPaymentDate: '2026-08-28',
    });
  });

  it('maps the project-level channel to the execution provider without creating a second channel', () => {
    expect(paymentRequestProviderForChannel('Airwallex')).toBe('Airwallex');
    expect(paymentRequestProviderForChannel('PayPal')).toBe('PayPal');
    expect(paymentRequestProviderForChannel('Payermax')).toBe('PayMax');
    expect(paymentRequestChannelForProvider('PayMax')).toBe('Payermax');
  });

  it('allows a draft project to be created before any collaborator is selected', () => {
    expect(paymentRequestDraftCreatorsReady(0, 0)).toBe(true);
    expect(paymentRequestDraftCreatorsReady(1, 1)).toBe(true);
    expect(paymentRequestDraftCreatorsReady(1, 0)).toBe(false);
  });
});

describe('payment request extra details', () => {
  it('uses the fixed cost types and normalizes historical values', () => {
    expect(PAYMENT_REQUEST_COST_TYPES).toEqual([
      '网红采买成本',
      '采购成本',
      '外包成本',
      '投流',
    ]);
    expect(PAYMENT_REQUEST_PAYMENT_ENTITIES).toEqual(['Comets International Limited', 'novacomets']);
    expect(PAYMENT_REQUEST_COST_ATTRIBUTIONS).toEqual(['日本分公司', '香港公司（comets）', 'novacomets']);
    expect(PAYMENT_REQUEST_PROCUREMENT_COST_DETAILS).toEqual(['实物采购', '礼品卡', '会员订阅', '版主工资']);
    expect(DEFAULT_PAYMENT_REQUEST_COST_TYPE).toBe('网红采买成本');
    expect(normalizePaymentRequestCostType('达人合作费')).toBe('网红采买成本');
    expect(normalizePaymentRequestCostType('网红采购')).toBe('网红采买成本');
    expect(normalizePaymentRequestCostType('物料采购成本')).toBe('采购成本');
    expect(normalizePaymentRequestCostType('内容外包费用')).toBe('外包成本');
    expect(normalizePaymentRequestCostType('广告投流')).toBe('投流');
    expect(normalizePaymentRequestProcurementCostDetail('礼品卡')).toBe('礼品卡');
    expect(normalizePaymentRequestProcurementCostDetail('历史未知明细')).toBe('');
  });

  it('requires a procurement detail only when procurement is selected', () => {
    expect(paymentRequestExtraDetailIssues({})).toEqual(['请选择成本类型']);
    expect(paymentRequestExtraDetailIssues({
      costType: '网红采买成本',
    })).toEqual([]);
    expect(paymentRequestExtraDetailIssues({
      costType: '采购成本',
    })).toEqual(['请选择采购成本明细']);
    expect(paymentRequestExtraDetailIssues({
      costType: '采购成本',
      costTypeDetail: '会员订阅',
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

  it('preserves pasted image preview data while de-duplicating screenshots', () => {
    const screenshot = {
      name: '备注截图.png',
      size: 2048,
      type: 'image/png',
      lastModified: 3,
      dataUrl: 'data:image/png;base64,preview',
    };

    expect(mergePaymentRequestRemarkAttachments([], [screenshot, screenshot])).toEqual([screenshot]);
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
    expect(result.contractIds).toEqual([
      validContract.contractId,
      foreignEngagementContract.contractId,
    ]);
    expect(result.autoLinkedContractIds).toEqual([
      validContract.contractId,
      foreignEngagementContract.contractId,
    ]);
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

  it('allows another request for the same cooperation project when it uses a different Invoice', () => {
    const firstInvoice = invoice();
    const secondInvoice = invoice({
      id: 'INV-20260807-000002',
      invoiceId: 'invoice_002' as InvoiceId,
    });
    const firstRequest = {
      id: 'REQ-FIRST',
      paymentRequestProjectId: 'request_first' as PaymentRequestProjectId,
      requestCode: 'REQ-FIRST',
      lifecycle: 'SUBMITTED' as const,
      creatorLinks: [{
        creatorId,
        engagementId,
        contractIds: [],
        invoiceIds: [firstInvoice.invoiceId],
      }],
    };

    const result = resolveCreatorDocuments({
      cooperationProjectId,
      creatorId,
      contracts: [],
      invoices: [firstInvoice, secondInvoice],
      requests: [firstRequest],
    });

    expect(result.status).toBe('READY');
    expect(result.availableInvoices.map((item) => item.invoiceId)).toEqual([secondInvoice.invoiceId]);
    expect(result.invoiceOwners).toEqual([{
      invoiceId: firstInvoice.invoiceId,
      owner: firstRequest,
    }]);
  });

  it('releases only invoices owned by cancelled requests', () => {
    const invoiceId = 'invoice_cancel_release' as InvoiceId;
    const linkedRequest = (lifecycle: 'DRAFT' | 'RETURNED' | 'APPROVED' | 'COMPLETED' | 'CANCELLED') => ({
      id: `request-${lifecycle.toLowerCase()}`,
      lifecycle,
      creatorLinks: [{ creatorId, engagementId, contractIds: [], invoiceIds: [invoiceId] }],
    });

    expect(requestOwningInvoice([linkedRequest('CANCELLED')], invoiceId)).toBeUndefined();
    (['DRAFT', 'RETURNED', 'APPROVED', 'COMPLETED'] as const).forEach((lifecycle) => {
      expect(requestOwningInvoice([linkedRequest(lifecycle)], invoiceId)?.lifecycle).toBe(lifecycle);
    });
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

  it('leaves the fee bearer empty when the contract is optional', () => {
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
    });

    expect(item.snapshot.feeBearer).toBe('');
    expect(item.snapshot.transactionReference).toBe('');
    expect(item.requiresRevalidation).toBe(true);
    expect(item.validationIssues).toEqual(expect.arrayContaining([
      '手续费承担方未确认',
      '交易附言未填写',
    ]));
  });

  it('inherits one unique linked-contract fee bearer into the payment row', () => {
    const linkedContract = contract('CON-FEE');
    const sourceInvoice = invoice();
    sourceInvoice.snapshot = { ...sourceInvoice.snapshot, contractIds: [linkedContract.contractId!] };
    const item = createPaymentRequestListItem({
      invoice: sourceInvoice,
      contracts: [linkedContract],
    });

    expect(item.snapshot.feeBearer).toBe('ADVERTISER');
    expect(item.overrides).not.toHaveProperty('feeBearer');
  });

  it('leaves the fee bearer editable when linked contracts conflict', () => {
    const advertiserContract = contract('CON-ADVERTISER');
    const publisherContract = { ...contract('CON-PUBLISHER'), feeBearer: 'PUBLISHER' as const };
    const sourceInvoice = invoice();
    sourceInvoice.snapshot = { ...sourceInvoice.snapshot, contractIds: [advertiserContract.contractId!, publisherContract.contractId!] };
    const item = createPaymentRequestListItem({
      invoice: sourceInvoice,
      contracts: [advertiserContract, publisherContract],
    });

    expect(item.snapshot.feeBearer).toBe('');
    expect(item.validationIssues).toContain('手续费承担方未确认');
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

  it('accepts a verified PayPal override and keeps Invoice and request amounts separate', () => {
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
    expect(result.invoices[0]?.accountNeedsReview).toBe(false);
    expect(result.statuses.map((status) => status.label)).toEqual(['付款金额已调整']);
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

  it('keeps the first approval submission time across later approval rounds', () => {
    const request = {
      approval: {
        ...approvalState('PENDING_PM'),
        round: 3,
        submittedAt: '2026-08-09T02:00:00.000Z',
        submissionHistory: [
          { round: 3, submittedAt: '2026-08-09T02:00:00.000Z' },
          { round: 1, submittedAt: '2026-08-07T02:00:00.000Z' },
          { round: 2, submittedAt: '2026-08-08T02:00:00.000Z' },
        ],
      },
    };

    expect(paymentRequestFirstSubmittedAt(request)).toBe('2026-08-07T02:00:00.000Z');
    expect(paymentRequestFirstSubmittedAt({ approval: approvalState('PENDING_PM') }))
      .toBe('2026-08-07T02:00:00.000Z');
    expect(paymentRequestFirstSubmittedAt({})).toBeUndefined();
  });

  it('filters inclusive Shanghai submission dates and excludes unsubmitted drafts', () => {
    const datedRequests: PaymentRequestListItem[] = [
      {
        ...requests[0],
        id: 'shanghai-august-7',
        approval: { ...approvalState('PENDING_PM'), submittedAt: '2026-08-07T15:59:00.000Z' },
      },
      {
        ...requests[1],
        id: 'shanghai-august-8',
        approval: { ...approvalState('PENDING_FINANCE'), submittedAt: '2026-08-07T16:00:00.000Z' },
      },
      {
        ...requests[2],
        id: 'unsubmitted-draft',
        lifecycle: 'DRAFT',
        approval: undefined,
      },
    ];

    const august8Only = filterPaymentRequestList({
      requests: datedRequests,
      search: '',
      filters: { ...createEmptyPaymentRequestListFilters(), startDate: '2026-08-08', endDate: '2026-08-08' },
    });
    expect(august8Only.visible.map((request) => request.id)).toEqual(['shanghai-august-8']);

    const throughAugust7 = filterPaymentRequestList({
      requests: datedRequests,
      search: '',
      filters: { ...createEmptyPaymentRequestListFilters(), endDate: '2026-08-07' },
    });
    expect(throughAugust7.visible.map((request) => request.id)).toEqual(['shanghai-august-7']);

    const fromAugust8ForPmB = filterPaymentRequestList({
      requests: datedRequests,
      search: '',
      filters: { ...createEmptyPaymentRequestListFilters(), startDate: '2026-08-08', pms: ['PM B'] },
    });
    expect(fromAugust8ForPmB.visible.map((request) => request.id)).toEqual(['shanghai-august-8']);

    const withoutDateFilter = filterPaymentRequestList({
      requests: datedRequests,
      search: '',
      filters: createEmptyPaymentRequestListFilters(),
    });
    expect(withoutDateFilter.visible).toHaveLength(3);
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
    ['PENDING_PM', 'PM审批中', 'PM审批中'],
    ['PENDING_PROJECT_OWNER', '媒介负责人审批中', '媒介负责人审批中'],
    ['PENDING_OWNER', '老板审批中', '老板审批中'],
    ['PENDING_FINANCE', '财务审批中', '财务审批中'],
    ['APPROVED', '待打款', '正在付款'],
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

  it('normalizes the historical project-owner label to the media-owner terminology', () => {
    const legacy = { lifecycle: 'SUBMITTED' as const, status: '项目负责人审批中' };

    expect(myProjectStatusFor(legacy)).toBe('媒介负责人审批中');
    expect(requestProjectStatusFor(legacy)).toBe('媒介负责人审批中');
  });

  it('keeps drafts out of request-project status and maps completed requests to paid', () => {
    expect(myProjectStatusFor({ lifecycle: 'DRAFT' })).toBe('草稿');
    expect(requestProjectStatusFor({ lifecycle: 'DRAFT' })).toBeNull();
    expect(myProjectStatusFor({ lifecycle: 'COMPLETED' })).toBe('已付款');
    expect(requestProjectStatusFor({ lifecycle: 'COMPLETED' })).toBe('已付款');
  });

  it('moves an approved request through payment execution to paid', () => {
    const paymentRequestProjectId = 'request-status-payment' as PaymentRequestProjectId;
    const request = { lifecycle: 'APPROVED' as const, paymentRequestProjectId };
    const payoutFor = (status: Payout['status']) => ({ paymentRequestProjectId, status });

    expect(requestProjectStatusFor(request, [payoutFor('等待付款')])).toBe('正在付款');
    expect(requestProjectStatusFor(request, [payoutFor('付款处理中')])).toBe('付款处理中');
    expect(requestProjectStatusFor(request, [payoutFor('已付款')])).toBe('已付款');
  });

  it('keeps cancelled requests out of approval views and requires an authorized reason', () => {
    const context = {
      roleKey: 'media',
      lifecycle: 'RETURNED' as const,
      ownsRequest: true,
      hasPaymentActivity: false,
    };

    expect(canCancelPaymentRequest(context)).toBe(true);
    expect(paymentRequestCancellationIssue(context, '')).toBe('请填写取消原因。');
    expect(paymentRequestCancellationIssue(context, '资料重复，取消后重新整理')).toBe('');
    expect(canCancelPaymentRequest({ ...context, lifecycle: 'SUBMITTED' })).toBe(false);
    expect(canCancelPaymentRequest({ ...context, ownsRequest: false })).toBe(false);
    expect(canCancelPaymentRequest({ ...context, roleKey: 'finance' })).toBe(false);
    expect(paymentRequestCancellationIssue({ ...context, hasPaymentActivity: true }, '取消'))
      .toBe('项目已进入付款或失败恢复流程，不能取消。');
    expect(myProjectStatusFor({ lifecycle: 'CANCELLED' })).toBe('已取消');
    expect(requestProjectStatusFor({ lifecycle: 'CANCELLED' })).toBeNull();
  });

  it('detects every payout state that locks request cancellation', () => {
    const requestId = 'request-cancel-lock' as PaymentRequestProjectId;
    const payout = (status: Payout['status'], paymentFailureRecovery?: Payout['paymentFailureRecovery']) => ({
      paymentRequestProjectId: requestId,
      status,
      paymentFailureRecovery,
    });

    expect(paymentRequestHasPaymentActivity(requestId, [payout('未进入付款')])).toBe(false);
    expect(paymentRequestHasPaymentActivity(requestId, [payout('等待付款')])).toBe(true);
    expect(paymentRequestHasPaymentActivity(requestId, [payout('付款处理中')])).toBe(true);
    expect(paymentRequestHasPaymentActivity(requestId, [payout('已付款')])).toBe(true);
    expect(paymentRequestHasPaymentActivity(requestId, [payout('付款失败', {
      status: 'AWAITING_CREATOR_UPDATE',
      notifications: [],
    })])).toBe(true);
    expect(paymentRequestHasPaymentActivity('another-request' as PaymentRequestProjectId, [payout('已付款')])).toBe(false);
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
