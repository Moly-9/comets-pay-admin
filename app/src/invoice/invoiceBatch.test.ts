import { describe, expect, it } from 'vitest';
import {
  type ContractId,
  type CreatorId,
  type EngagementId,
  type ProjectId,
} from '../businessWorkflow';
import { INITIAL_INVOICE_ENTITY } from '../data';
import {
  eligibleInvoicePayoutAccounts,
  createPayPalPayoutAccount,
  getPayoutAccountId,
  payoutAccountToInvoicePayment,
} from '../payoutAccounts';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from '../pages/OperationalPages';
import { PROJECT_DEMO_CONTRACTS } from '../prototypeResourceFixtures';
import type { CreatorProfile } from '../types';
import {
  buildInvoiceDocumentForBatchRow,
  createGeneratedInvoiceRecord,
  createInvoiceBatchRow,
  synchronizeInvoiceBatchLineItems,
  updateInvoiceBatchLineItem,
  updateAndValidateInvoiceBatchRow,
  validateInvoiceBatchRow,
  type InvoiceBatchContext,
} from './invoiceBatch';

const eligibleCreator = INITIAL_CREATORS.find((creator) => (
  eligibleInvoicePayoutAccounts(creator).length > 0
))!;
const baseAccount = eligibleInvoicePayoutAccounts(eligibleCreator)[0]!;

const lineItemSeeds = (...descriptions: string[]) => descriptions.map((description, index) => ({
  templateKey: `template_batch_${index + 1}`,
  description,
}));

const updateLineItemAmounts = (
  row: ReturnType<typeof createInvoiceBatchRow>,
  amounts: Array<{ unitPrice: number; quantity: number }>,
) => amounts.reduce((items, amount, index) => updateInvoiceBatchLineItem(
  items,
  items[index].id,
  amount,
), row.items);

const createContext = ({
  creator = eligibleCreator,
  engagementId = 'engagement_batch_test_1' as EngagementId,
}: {
  creator?: CreatorProfile;
  engagementId?: EngagementId;
} = {}): InvoiceBatchContext => {
  const projectId = 'project_batch_test' as ProjectId;
  return {
    project: {
      ...INITIAL_PROJECTS[0],
      id: projectId,
      projectId,
      projectCode: 'PRJ-BATCH-TEST',
      name: '批量 Invoice 测试项目',
      creatorProfiles: [{
        creatorId: creator.id as CreatorId,
        engagementId,
        projectId,
        status: 'active',
        name: creator.name,
        handle: creator.handle,
        platform: creator.platform,
      }],
    },
    creators: [creator],
    payouts: [],
    contracts: [],
    generatedInvoices: [],
    invoiceEntity: INITIAL_INVOICE_ENTITY,
  };
};

const creatorWithAccounts = (accounts: CreatorProfile['payoutAccounts']): CreatorProfile => ({
  ...eligibleCreator,
  id: 'creator_batch_test',
  payoutAccounts: accounts.map((account) => ({
    ...account,
    creatorId: 'creator_batch_test',
  })),
});

describe('Invoice batch rows', () => {
  it('builds multiple line items and calculates Price x Amount for the Invoice total', () => {
    const creator = creatorWithAccounts([{
      ...baseAccount,
      isDefault: true,
    }]);
    const context = createContext({ creator });
    const engagementId = context.project.creatorProfiles![0].engagementId;
    const initial = createInvoiceBatchRow({
      ...context,
      engagementId,
      invoiceDate: '2026-08-06',
      lineItems: lineItemSeeds('Dedicated Video', 'Usage License'),
    });
    const row = updateAndValidateInvoiceBatchRow(initial, {
      items: updateLineItemAmounts(initial, [
        { unitPrice: 250, quantity: 3 },
        { unitPrice: 80, quantity: 2 },
      ]),
      currency: 'USD',
    }, context);
    const model = buildInvoiceDocumentForBatchRow(row, context, 'INV-20260806-001');

    expect(row.status).toBe('READY');
    expect(model.items).toEqual([
      expect.objectContaining({
        description: 'Dedicated Video',
        unitPrice: 250,
        quantity: 3,
        lineTotal: 750,
      }),
      expect.objectContaining({
        description: 'Usage License',
        unitPrice: 80,
        quantity: 2,
        lineTotal: 160,
      }),
    ]);
    expect(model.items.reduce((total, item) => total + item.lineTotal, 0)).toBe(910);
    expect(model.payoutAccountId).toBe(getPayoutAccountId(creator.payoutAccounts[0]));
  });

  it('keeps remaining amounts associated with stable template keys after removing a middle Description', () => {
    const creator = creatorWithAccounts([{ ...baseAccount, isDefault: true }]);
    const context = createContext({ creator });
    const row = createInvoiceBatchRow({
      ...context,
      engagementId: context.project.creatorProfiles![0].engagementId,
      invoiceDate: '2026-08-06',
      lineItems: lineItemSeeds('Video', 'Story', 'License'),
    });
    const pricedItems = updateLineItemAmounts(row, [
      { unitPrice: 100, quantity: 1 },
      { unitPrice: 200, quantity: 2 },
      { unitPrice: 300, quantity: 3 },
    ]);
    const synchronized = synchronizeInvoiceBatchLineItems(
      pricedItems,
      lineItemSeeds('Video', 'License').map((item, index) => ({
        ...item,
        templateKey: index === 0 ? 'template_batch_1' : 'template_batch_3',
      })),
    );

    expect(synchronized.map((item) => item.description)).toEqual(['Video', 'License']);
    expect(synchronized.map((item) => item.unitPrice)).toEqual([100, 300]);
    expect(synchronized.map((item) => item.quantity)).toEqual([1, 3]);
  });

  it('identifies the exact invalid Description, Price and Amount in a multi-item row', () => {
    const creator = creatorWithAccounts([{ ...baseAccount, isDefault: true }]);
    const context = createContext({ creator });
    const row = createInvoiceBatchRow({
      ...context,
      engagementId: context.project.creatorProfiles![0].engagementId,
      invoiceDate: '2026-08-06',
      lineItems: lineItemSeeds('Valid item', ''),
    });
    const validated = updateAndValidateInvoiceBatchRow(row, {
      items: updateLineItemAmounts(row, [
        { unitPrice: 100, quantity: 1 },
        { unitPrice: 0, quantity: 0 },
      ]),
    }, context);

    expect(validated.issues).toContain('第 2 条 Description 不能为空');
    expect(validated.issues).toContain('第 2 条 Price 必须大于 0');
    expect(validated.issues).toContain('第 2 条 Amount 必须大于 0');
  });

  it('defaults every batch row to USD', () => {
    const creator = creatorWithAccounts([{
      ...baseAccount,
      isDefault: true,
    }]);
    const context = createContext({ creator });
    context.payouts = [{
      id: 'payout_non_usd',
      creator: creator.name,
      handle: creator.handle,
      initials: creator.initials,
      projectId: context.project.projectId ?? context.project.id,
      project: context.project.name,
      deliverable: 'Prototype deliverable',
      contract: '未关联合同',
      invoice: '待生成',
      provider: 'Airwallex',
      currency: 'EUR',
      amount: 300,
      account: '0000000000',
      status: '未进入付款',
      invoiceReviewStatus: '待签署',
      accent: creator.accent,
    }];

    const row = createInvoiceBatchRow({
      ...context,
      engagementId: context.project.creatorProfiles![0].engagementId,
      invoiceDate: '2026-08-06',
      lineItems: lineItemSeeds('Dedicated Video'),
    });

    expect(row.currency).toBe('USD');
  });

  it('switches Payment Information by stable payout account ID', () => {
    const bankAccount = { ...baseAccount, isDefault: true };
    const paypalAccount = createPayPalPayoutAccount({
      id: 'paypal-batch-test',
      creatorId: 'creator_batch_test',
      payoutAccountId: 'paypal-batch-test',
      payoutAccountVersion: 'v1',
      nickname: 'PayPal 备用账户',
      isDefault: false,
      status: 'VERIFIED',
      paypalUsername: 'Creator Batch Test',
      paypalEmail: 'batch@example.invalid',
    });
    const creator = creatorWithAccounts([bankAccount, paypalAccount]);
    const context = createContext({ creator });
    const initial = createInvoiceBatchRow({
      ...context,
      engagementId: context.project.creatorProfiles![0].engagementId,
      invoiceDate: '2026-08-06',
      lineItems: lineItemSeeds('Creator Service'),
    });
    const selectedPayPal = updateAndValidateInvoiceBatchRow(initial, {
      items: updateLineItemAmounts(initial, [{ unitPrice: 120, quantity: 1 }]),
      payoutAccountId: 'paypal-batch-test',
    }, context);
    const model = buildInvoiceDocumentForBatchRow(
      selectedPayPal,
      context,
      'INV-20260806-002',
    );

    expect(initial.payoutAccountId).toBe(getPayoutAccountId(bankAccount));
    expect(selectedPayPal.status).toBe('READY');
    expect(model.payoutAccountId).toBe('paypal-batch-test');
    expect(model.paymentMethod).toBe('paypal');
    expect(model.payment.paypalEmail).toBe('batch@example.invalid');
  });

  it('requires manual selection when multiple eligible accounts have no default', () => {
    const secondAccount = {
      ...baseAccount,
      id: `${baseAccount.id}-second`,
      payoutAccountId: `${getPayoutAccountId(baseAccount)}-second`,
      nickname: '第二个已验证账户',
      isDefault: false,
    };
    const creator = creatorWithAccounts([
      { ...baseAccount, isDefault: false },
      secondAccount,
    ]);
    const context = createContext({ creator });
    const row = createInvoiceBatchRow({
      ...context,
      engagementId: context.project.creatorProfiles![0].engagementId,
      invoiceDate: '2026-08-06',
      lineItems: lineItemSeeds('Integrated Video'),
    });

    expect(row.payoutAccountId).toBe('');
    expect(row.status).toBe('NEEDS_INPUT');
    expect(row.issues).toContain('请选择唯一、已验证且资料完整的收款账户');
  });

  it('uses the unique confirmed contract and its frozen account', () => {
    const creator = creatorWithAccounts([{ ...baseAccount, isDefault: false }]);
    const context = createContext({ creator });
    const engagementId = context.project.creatorProfiles![0].engagementId;
    const payment = payoutAccountToInvoicePayment(creator.payoutAccounts[0], creator.id);
    context.contracts = [{
      ...PROJECT_DEMO_CONTRACTS[0],
      contractId: 'contract_batch_test' as ContractId,
      id: 'CON-BATCH-TEST',
      projectId: context.project.projectId,
      creatorId: creator.id as CreatorId,
      engagementId,
      lifecycle: 'CONFIRMED',
      advertiser: INITIAL_INVOICE_ENTITY.name,
      publisher: creator.contact.legalName,
      currency: 'USD',
      totalFee: 500,
      paymentMethod: creator.payoutAccounts[0].provider === 'PayPal' ? 'PAYPAL' : 'BANK',
      payoutAccountId: payment.payoutAccountId,
      paymentSnapshot: payment,
    }];
    const initial = createInvoiceBatchRow({
      ...context,
      engagementId,
      invoiceDate: '2026-08-06',
      lineItems: lineItemSeeds('Creator Service'),
    });
    const row = updateAndValidateInvoiceBatchRow(initial, {
      items: updateLineItemAmounts(initial, [{ unitPrice: 500, quantity: 1 }]),
    }, context);

    expect(row.contractIds).toEqual(['contract_batch_test']);
    expect(row.payoutAccountLocked).toBe(true);
    expect(row.payoutAccountId).toBe(getPayoutAccountId(creator.payoutAccounts[0]));
    expect(row.status).toBe('READY');
  });

  it('blocks an engagement that already has an Invoice', () => {
    const creator = creatorWithAccounts([{ ...baseAccount, isDefault: true }]);
    const context = createContext({ creator });
    const engagementId = context.project.creatorProfiles![0].engagementId;
    let row = createInvoiceBatchRow({
      ...context,
      engagementId,
      invoiceDate: '2026-08-06',
      lineItems: lineItemSeeds('Creator Service'),
    });
    row = updateAndValidateInvoiceBatchRow(row, {
      items: updateLineItemAmounts(row, [{ unitPrice: 100, quantity: 1 }]),
      currency: 'USD',
    }, context);
    const snapshot = buildInvoiceDocumentForBatchRow(row, context, 'INV-20260806-001');
    context.generatedInvoices = [createGeneratedInvoiceRecord(row, snapshot)];

    const duplicate = validateInvoiceBatchRow({ ...row, generated: undefined }, context);
    expect(duplicate.status).toBe('CONFLICT');
    expect(duplicate.issues).toContain('该项目达人已有有效 Invoice，不能重复生成');
  });
});
