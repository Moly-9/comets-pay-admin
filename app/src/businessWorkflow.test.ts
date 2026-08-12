import { describe, expect, it } from 'vitest';
import {
  beginPaymentListEdit,
  canEditProject,
  clearPaymentListItems,
  createAuditEvent,
  generatePaymentListVersion,
  getPaymentListAccess,
  hasInvoiceForEngagement,
  nextReviewStatusAfterMutation,
  paymentListEffectiveAccount,
  paymentListItemValue,
  paymentListProviderForItems,
  payoutWithPaymentListSnapshot,
  refreshPaymentListFromInvoices,
  refreshPaymentListItemSnapshot,
  revalidatePaymentListItem,
  removePaymentListItem,
  upsertPaymentListItem,
  validateContractCoverage,
  validatePaymentListGeneration,
  validateProjectSubmission,
  type ContractId,
  type CreatorId,
  type EngagementId,
  type InvoiceId,
  type PaymentListRecord,
  type PaymentRequestProjectId,
  type ProjectId,
} from './businessWorkflow';

const roles = {
  admin: { roleKey: 'admin' as const },
  owner: { roleKey: 'owner' as const },
  media: { roleKey: 'media' as const },
  pm: { roleKey: 'pm' as const },
};

describe('project workflow permissions', () => {
  it('lets privileged roles edit all states and locks media after submission', () => {
    expect(canEditProject(roles.admin, 'approved')).toBe(true);
    expect(canEditProject(roles.owner, 'submitted')).toBe(true);
    expect(canEditProject(roles.media, 'draft')).toBe(true);
    expect(canEditProject(roles.media, 'returned')).toBe(true);
    expect(canEditProject(roles.media, 'submitted')).toBe(false);
    expect(canEditProject(roles.pm, 'draft')).toBe(false);
  });

  it('invalidates review when a privileged user edits submitted data', () => {
    expect(nextReviewStatusAfterMutation(roles.admin, 'submitted')).toBe('changes_required');
    expect(nextReviewStatusAfterMutation(roles.owner, 'approved')).toBe('changes_required');
    expect(nextReviewStatusAfterMutation(roles.media, 'draft')).toBe('draft');
  });

  it('keeps request-project and creator identifiers in audit events', () => {
    const paymentRequestProjectId = 'request_project_audit' as PaymentRequestProjectId;
    const creatorId = 'creator_audit' as CreatorId;
    const event = createAuditEvent({
      projectId: 'project_audit' as ProjectId,
      paymentRequestProjectId,
      creatorId,
      entityType: 'invoice',
      entityId: 'invoice_audit',
      action: 'update',
      actor: 'Admin',
      summary: 'Invoice updated',
    });

    expect(event.paymentRequestProjectId).toBe(paymentRequestProjectId);
    expect(event.creatorId).toBe(creatorId);
  });

  it('enforces payment-list draft, generated, historical, and read-only role access', () => {
    expect(getPaymentListAccess(roles.media, 'draft', 'draft')).toMatchObject({
      canEditFields: true,
      canReopen: false,
      canCreateVersion: false,
    });
    expect(getPaymentListAccess(roles.media, 'draft', 'generated')).toMatchObject({
      canEditFields: false,
      canReopen: true,
      canCreateVersion: false,
    });
    expect(getPaymentListAccess(roles.media, 'submitted', 'submitted')).toMatchObject({
      canEditFields: false,
      canReopen: false,
      canCreateVersion: false,
    });
    expect(getPaymentListAccess(roles.admin, 'approved', 'paid')).toMatchObject({
      canEditFields: false,
      canReopen: false,
      canCreateVersion: true,
    });
    expect(getPaymentListAccess(roles.owner, 'submitted', 'approved')).toMatchObject({
      canCreateVersion: true,
    });
    expect(getPaymentListAccess(roles.pm, 'draft', 'draft')).toMatchObject({
      canEditFields: false,
      canCreateVersion: false,
    });
  });
});

describe('contract coverage validation', () => {
  const contracts = [
    {
      contractId: 'contract-1' as ContractId,
      advertiser: 'Comets International Limited',
      publisher: 'Synthetic Creator Limited',
      currency: 'USD',
      totalFee: 300,
      paymentMethod: 'BANK',
    },
    {
      contractId: 'contract-2' as ContractId,
      advertiser: 'Comets International Limited',
      publisher: 'Synthetic Creator Limited',
      currency: 'USD',
      totalFee: 200,
      paymentMethod: 'BANK',
    },
  ];

  it('accepts a single invoice covering multiple consistent contracts', () => {
    expect(validateContractCoverage(contracts, {
      billTo: 'Comets International Limited',
      publisher: 'Synthetic Creator Limited',
      currency: 'USD',
      amount: 500,
      paymentMethod: 'BANK',
    })).toEqual([]);
  });

  it('reports amount and common-field conflicts', () => {
    const issues = validateContractCoverage(
      [{ ...contracts[0], currency: 'EUR' }, contracts[1]],
      {
        billTo: 'Other Entity',
        publisher: 'Synthetic Creator Limited',
        currency: 'USD',
        amount: 300,
        paymentMethod: 'BANK',
      },
    );
    expect(issues.map((issue) => issue.field)).toEqual(expect.arrayContaining(['advertiser', 'currency', 'amount']));
  });
});

describe('project payment list', () => {
  const invoiceId = 'invoice-1' as InvoiceId;
  const record: PaymentListRecord = {
    paymentListId: 'payment-list-1' as PaymentListRecord['paymentListId'],
    paymentListCode: 'PAY-20260804-TEST01',
    projectId: 'project-1' as ProjectId,
    provider: 'Airwallex',
    status: 'draft',
    items: [],
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
  };
  const item = {
    id: 'item-1',
    engagementId: 'engagement-1' as EngagementId,
    invoiceId,
    snapshot: {
      invoiceNumber: 'INV-TEST',
      creatorName: 'Synthetic Creator',
      currency: 'USD',
      receiveCurrency: 'USD',
      amount: 300,
      provider: 'Airwallex',
      accountSummary: 'Test account ending 0001',
      paymentReason: '影音服务',
      transactionReference: 'INV-TEST',
      description: 'Synthetic payment',
      creatorId: 'creator-1' as CreatorId,
      payoutAccountId: 'account-1',
      payoutAccountVersion: 'v1' as const,
      externalBeneficiaryId: 'beneficiary-1',
      transferMethod: 'LOCAL' as const,
      localClearingSystem: 'ACH',
      feeBearer: 'ADVERTISER' as const,
      accountFingerprint: 'fp_1',
      schemaKey: 'BANK_ACCOUNT:US:USD:PERSONAL:LOCAL:ACH',
      validationStatus: 'VERIFIED' as const,
    },
    overrides: {},
  };

  it('keeps one payment row per invoice and removes rows without deleting invoices', () => {
    const withItem = upsertPaymentListItem(record, item);
    expect(upsertPaymentListItem(withItem, item).items).toHaveLength(1);
    expect(removePaymentListItem(withItem, invoiceId).items).toEqual([]);
  });

  it('clears payment rows while preserving the list identity and generated history', () => {
    const generated = {
      ...record,
      status: 'generated' as const,
      version: 2,
      items: [item],
      versions: [{
        version: 2,
        generatedAt: '2026-08-07T10:00:00.000Z',
        generatedBy: { account: 'admin.test', name: 'Admin', role: '管理员' },
        items: [item],
      }],
    };
    const cleared = clearPaymentListItems(generated, '2026-08-07T11:00:00.000Z');

    expect(cleared).toMatchObject({
      paymentListId: generated.paymentListId,
      paymentListCode: generated.paymentListCode,
      status: 'draft',
      draftFromVersion: 2,
      items: [],
      updatedAt: '2026-08-07T11:00:00.000Z',
    });
    expect(cleared.versions).toEqual(generated.versions);
  });

  it('allows supported provider overrides and summarizes mixed-channel payment items', () => {
    const paypalItem = {
      ...item,
      invoiceId: 'invoice-paypal' as InvoiceId,
      accountOverride: {
        provider: 'PayPal',
        accountSummary: '脱敏 PayPal 账户',
        receiveCurrency: 'USD',
        payoutAccountId: 'paypal-account-1',
        payoutAccountVersion: 'v1' as const,
        accountFingerprint: 'paypal-fp-1',
        transferMethod: 'PAYPAL' as const,
        validationStatus: 'VERIFIED' as const,
      },
    };
    expect(upsertPaymentListItem(record, paypalItem).items).toHaveLength(1);
    expect(paypalItem.snapshot.provider).toBe('Airwallex');
    expect(paymentListEffectiveAccount(paypalItem).provider).toBe('PayPal');
    expect(validatePaymentListGeneration({ ...record, items: [paypalItem] }, [paypalItem.invoiceId]))
      .not.toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'UNSUPPORTED_PROVIDER' }),
      ]));
    expect(paymentListProviderForItems([item, paypalItem])).toBe('Mixed');
  });

  it('requires user-entered transaction reference and description before generating a locked payment version', () => {
    const draft = {
      ...record,
      items: [{
        ...item,
        snapshot: { ...item.snapshot, transactionReference: '', description: '' },
      }],
    };
    expect(validatePaymentListGeneration(draft, [invoiceId])).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'INVALID_ITEM',
        invoiceId,
        message: expect.stringContaining('交易附言未填写'),
      }),
      expect.objectContaining({
        code: 'INVALID_ITEM',
        invoiceId,
        message: expect.stringContaining('付款描述未填写'),
      }),
    ]));
  });

  it('locks generated content and preserves immutable version history while editing again', () => {
    const actor = { account: 'admin.test', name: 'Admin Test', role: '管理员账号' };
    const first = generatePaymentListVersion({
      list: { ...record, items: [item] },
      expectedInvoiceIds: [invoiceId],
      actor,
      generatedAt: '2026-08-06T08:00:00.000Z',
    });
    expect(first.issues).toEqual([]);
    expect(first.record).toMatchObject({
      status: 'generated',
      version: 1,
      generatedAt: '2026-08-06T08:00:00.000Z',
    });
    expect(first.record.versions).toHaveLength(1);

    const edited = beginPaymentListEdit(first.record, '2026-08-06T09:00:00.000Z');
    const second = generatePaymentListVersion({
      list: {
        ...edited,
        items: edited.items.map((current) => ({
          ...current,
          overrides: { ...current.overrides, description: 'Second version note' },
        })),
      },
      expectedInvoiceIds: [invoiceId],
      actor,
      generatedAt: '2026-08-06T10:00:00.000Z',
    });

    expect(edited).toMatchObject({ status: 'draft', draftFromVersion: 1 });
    expect(second.record).toMatchObject({ status: 'generated', version: 2 });
    expect(second.record.versions).toHaveLength(2);
    expect(second.record.versions?.[0]?.items[0]?.overrides.description).toBeUndefined();
    expect(second.record.versions?.[1]?.items[0]?.overrides.description).toBe('Second version note');
  });

  it('refreshes an Invoice snapshot while preserving explicit payment-list overrides', () => {
    const withItem = upsertPaymentListItem(record, {
      ...item,
      overrides: { amount: 280, description: '人工确认付款说明' },
    });
    const refreshed = refreshPaymentListItemSnapshot(withItem, {
      ...item,
      snapshot: {
        ...item.snapshot,
        currency: 'EUR',
        amount: 320,
        accountSummary: 'Test account ending 0002',
      },
    }, '2026-08-05T00:00:00.000Z');

    expect(refreshed.items[0]?.snapshot).toMatchObject({
      currency: 'EUR',
      amount: 320,
      accountSummary: 'Test account ending 0002',
    });
    expect(refreshed.items[0]?.overrides).toEqual({ amount: 280, description: '人工确认付款说明' });
    expect(refreshed.updatedAt).toBe('2026-08-05T00:00:00.000Z');
  });

  it('refreshes a generated list without replacing user-edited payment fields', () => {
    const actor = { account: 'media.test', name: 'Media Test', role: '媒介账号' };
    const currentItem = {
      ...item,
      overrides: {
        currency: 'HKD',
        receiveCurrency: 'JPY',
        paymentReason: '人工调整后的付款原因',
        transactionReference: 'CUSTOM-REFERENCE-001',
      },
      requiresRevalidation: true,
      validationIssues: ['付款字段已修改，请重新校验'],
    };
    const currentList: PaymentListRecord = {
      ...record,
      status: 'draft',
      version: 1,
      items: [currentItem],
      versions: [{
        version: 1,
        generatedAt: '2026-08-05T08:00:00.000Z',
        generatedBy: actor,
        items: [item],
      }],
    };
    const newInvoiceItem = {
      ...item,
      id: 'item-2',
      invoiceId: 'invoice-2' as InvoiceId,
      snapshot: {
        ...item.snapshot,
        invoiceNumber: 'INV-NEW',
        paymentReason: '影音服务',
        transactionReference: 'REQ-DEFAULT-02',
      },
    };
    const refreshed = refreshPaymentListFromInvoices({
      list: currentList,
      refreshedItems: [{
        ...item,
        snapshot: {
          ...item.snapshot,
          currency: 'USD',
          receiveCurrency: 'USD',
          paymentReason: '影音服务',
          transactionReference: 'REQ-DEFAULT-01',
        },
      }, newInvoiceItem],
      actor,
      refreshedAt: '2026-08-05T09:00:00.000Z',
    });

    expect(refreshed).toMatchObject({
      paymentListId: currentList.paymentListId,
      paymentListCode: currentList.paymentListCode,
      status: 'generated',
      version: 2,
      updatedAt: '2026-08-05T09:00:00.000Z',
    });
    expect(refreshed.versions).toHaveLength(2);
    expect(refreshed.items).toHaveLength(2);
    expect(paymentListItemValue(refreshed.items[0]!, 'currency')).toBe('HKD');
    expect(paymentListItemValue(refreshed.items[0]!, 'receiveCurrency')).toBe('JPY');
    expect(paymentListItemValue(refreshed.items[0]!, 'paymentReason')).toBe('人工调整后的付款原因');
    expect(paymentListItemValue(refreshed.items[0]!, 'transactionReference')).toBe('CUSTOM-REFERENCE-001');
    expect(refreshed.items[0]).toMatchObject({
      requiresRevalidation: true,
      validationIssues: ['付款字段已修改，请重新校验'],
    });
    expect(paymentListItemValue(refreshed.items[1]!, 'currency')).toBe('USD');
    expect(paymentListItemValue(refreshed.items[1]!, 'transactionReference')).toBe('REQ-DEFAULT-02');
  });

  it('requires revalidation when refresh changes the frozen payout-account version', () => {
    const previous = {
      ...item,
      snapshot: {
        ...item.snapshot,
        payoutAccountId: 'account-1',
        payoutAccountVersion: 'v1' as const,
        accountFingerprint: 'fp_1',
        creatorId: 'creator-1' as CreatorId,
        externalBeneficiaryId: 'beneficiary-1',
        transferMethod: 'LOCAL' as const,
        localClearingSystem: 'ACH',
        feeBearer: 'ADVERTISER' as const,
        schemaKey: 'BANK_ACCOUNT:US:USD:PERSONAL:LOCAL:ACH',
        validationStatus: 'VERIFIED' as const,
      },
    };
    const refreshed = refreshPaymentListItemSnapshot(
      upsertPaymentListItem(record, previous),
      {
        ...previous,
        snapshot: {
          ...previous.snapshot,
          payoutAccountVersion: 'v2',
          accountFingerprint: 'fp_2',
        },
      },
    );

    expect(refreshed.items[0]).toMatchObject({
      requiresRevalidation: true,
      validationIssues: ['Invoice 账户版本已变化，付款清单必须重新校验'],
      overrides: {},
    });
    expect(revalidatePaymentListItem(
      refreshed.items[0]!,
      '2026-08-05T12:00:00.000Z',
    )).toMatchObject({
      requiresRevalidation: false,
      validationIssues: [],
      lastValidatedAt: '2026-08-05T12:00:00.000Z',
    });
  });

  it('builds batch input from the payment-list snapshot while preserving overrides', () => {
    const paymentItem = {
      ...item,
      snapshot: {
        ...item.snapshot,
        creatorId: 'creator-1' as CreatorId,
        payoutAccountId: 'account-1',
        payoutAccountVersion: 'v3' as const,
        accountFingerprint: 'fp_3',
        externalBeneficiaryId: 'beneficiary-1',
        transferMethod: 'LOCAL' as const,
        localClearingSystem: 'ACH',
        feeBearer: 'ADVERTISER' as const,
      },
      overrides: { amount: 280, currency: 'EUR' },
    };
    const payout = payoutWithPaymentListSnapshot({
      id: 'payout-1',
      creator: 'Synthetic Creator',
      handle: '@synthetic',
      initials: 'SC',
      projectId: 'project-1',
      project: 'Synthetic Project',
      contract: 'CON-001',
      invoice: 'INV-001',
      provider: 'Airwallex',
      currency: 'USD',
      amount: 300,
      account: 'old account',
      status: '等待付款',
      invoiceReviewStatus: '已通过',
      accent: '#64748b',
    }, paymentItem);

    expect(payout).toMatchObject({
      creatorId: 'creator-1',
      currency: 'EUR',
      amount: 280,
      payoutAccountId: 'account-1',
      payoutAccountVersion: 'v3',
      externalBeneficiaryId: 'beneficiary-1',
      feeBearer: 'ADVERTISER',
    });
  });
});

describe('engagement invoice constraints', () => {
  const engagementId = 'engagement-1' as EngagementId;
  const invoiceId = 'invoice-1' as InvoiceId;
  const secondInvoiceId = 'invoice-2' as InvoiceId;

  it('allows only one linked invoice per engagement while excluding the current record', () => {
    const invoices = [{ invoiceId, engagementId, validationStatus: 'valid' as const }];
    expect(hasInvoiceForEngagement(invoices, engagementId)).toBe(true);
    expect(hasInvoiceForEngagement(invoices, engagementId, invoiceId)).toBe(false);
  });

  it('requires one valid invoice per engagement and every invoice in the payment list', () => {
    const validInvoices = [{ invoiceId, engagementId, validationStatus: 'valid' as const }];
    expect(validateProjectSubmission({
      engagementIds: [engagementId],
      invoices: validInvoices,
      paymentListInvoiceIds: [invoiceId],
    })).toEqual([]);

    expect(validateProjectSubmission({
      engagementIds: [engagementId],
      invoices: [
        ...validInvoices,
        { invoiceId: secondInvoiceId, engagementId, validationStatus: 'needs_review' as const },
      ],
      paymentListInvoiceIds: [invoiceId],
    })).toEqual(expect.arrayContaining([
      'INVOICE_COUNT',
      'PAYMENT_LIST_MISSING',
      'INVOICE_NEEDS_REVIEW',
    ]));
  });
});
