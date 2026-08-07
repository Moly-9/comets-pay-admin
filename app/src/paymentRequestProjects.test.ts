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
} from './businessWorkflow';
import {
  canAddCreatorToPaymentRequest,
  createEmptyPaymentRequestListFilters,
  createPaymentRequestListItem,
  filterPaymentRequestList,
  normalizePaymentRequestCreatorLink,
  paymentRequestAmountLabel,
  paymentRequestInvoiceIds,
  paymentRequestListMetrics,
  paymentRequestSubmissionIssues,
  resolveCreatorDocuments,
  type PaymentRequestListItem,
  type PaymentRequestCreatorLink,
} from './paymentRequestProjects';
import type { GeneratedInvoiceRecord } from './types';

const cooperationProjectId = 'cooperation_project_001' as CooperationProjectId;
const otherProjectId = 'cooperation_project_002' as CooperationProjectId;
const creatorId = 'creator_001' as CreatorId;
const otherCreatorId = 'creator_002' as CreatorId;
const engagementId = 'engagement_001' as EngagementId;

const invoice = (overrides: Partial<GeneratedInvoiceRecord> = {}): GeneratedInvoiceRecord => ({
  id: 'INV-20260807-000001',
  invoiceId: 'invoice_001' as InvoiceId,
  sourcePayoutId: 'payout_001',
  status: '待发起请款',
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

describe('media payment request document resolution', () => {
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
      requestCode: 'REQ-20260807-ABC123',
      lineNumber: 1,
    });

    expect(item.snapshot.feeBearer).toBe('ADVERTISER');
    expect(item.snapshot.transactionReference).toBe('REQ-20260807-ABC123-01');
    expect(item.requiresRevalidation).toBe(false);
    expect(item.validationIssues).toEqual([]);
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
});

describe('media payment request list presentation', () => {
  const requests: PaymentRequestListItem[] = [
    {
      id: 'request-1',
      requestCode: 'REQ-20260807-000001',
      lifecycle: 'SUBMITTED',
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
      waitingReview: 1,
      reviewing: 1,
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

  it('only allows adding creators while the request remains a draft', () => {
    expect(canAddCreatorToPaymentRequest({ id: 'draft', lifecycle: 'DRAFT' })).toBe(true);
    expect(canAddCreatorToPaymentRequest({ id: 'returned', lifecycle: 'RETURNED' })).toBe(false);
    expect(canAddCreatorToPaymentRequest({ id: 'submitted', lifecycle: 'SUBMITTED' })).toBe(false);
  });
});
