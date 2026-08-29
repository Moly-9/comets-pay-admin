import { describe, expect, it } from 'vitest';
import type { PaymentListItem } from './businessWorkflow';
import type { PaymentBatchItemSnapshot } from './paymentBatches';
import {
  PAYMENT_ACCOUNT_NAME_MISSING,
  paymentCreatorIdentityFromBatchItem,
  paymentCreatorIdentityFromPayout,
} from './paymentCreatorIdentity';
import type { Payout } from './types';

const payout = {
  id: 'pay-identity',
  creator: 'Current Display Name',
  handle: '@current',
  initials: 'CD',
  projectId: 'project-identity',
  project: 'Identity Project',
  contract: 'CON-IDENTITY',
  invoice: 'INV-IDENTITY',
  provider: 'Airwallex',
  currency: 'USD',
  amount: 100,
  account: '0000000001',
  status: '等待付款',
  invoiceReviewStatus: '已通过',
  accent: '#5f72d8',
} as Payout;

const paymentItem = {
  id: 'payment-item-identity',
  snapshot: {
    invoiceNumber: 'INV-IDENTITY',
    creatorName: 'Current Display Name',
    currency: 'USD',
    receiveCurrency: 'USD',
    amount: 100,
    provider: 'Airwallex',
    accountSummary: '0000000001',
    paymentReason: '服务费',
    transactionReference: 'REF-IDENTITY',
    description: '原型付款',
    paymentDetails: { accountName: 'Original Account Name' },
  },
  executionAccountOverride: {
    account: {
      provider: 'Airwallex',
      accountSummary: '0000000002',
      receiveCurrency: 'USD',
      paymentDetails: { accountName: 'Retry Account Name' },
    },
  },
  overrides: {},
} as PaymentListItem;

describe('payment creator identity resolution', () => {
  it('prefers the current effective payment-list account for live payouts', () => {
    expect(paymentCreatorIdentityFromPayout({ payout, paymentItem })).toMatchObject({
      accountName: 'Retry Account Name',
      displayName: 'Current Display Name',
    });
  });

  it('uses the immutable batch snapshot for historical identities', () => {
    const item = {
      payoutId: payout.id,
      accountName: 'Historical Account Name',
      creatorName: 'Historical Display Name',
    } as PaymentBatchItemSnapshot;

    expect(paymentCreatorIdentityFromBatchItem(item)).toMatchObject({
      accountName: 'Historical Account Name',
      displayName: 'Historical Display Name',
    });
  });

  it('never treats an account number as Account Name', () => {
    expect(paymentCreatorIdentityFromPayout({ payout })).toMatchObject({
      accountName: PAYMENT_ACCOUNT_NAME_MISSING,
      displayName: 'Current Display Name',
    });
  });
});
