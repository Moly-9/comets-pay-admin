import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PAYMENT_IDENTITY_SURFACES = [
  './components/FinanceReviewWorkspace.tsx',
  './components/PaymentExecutionWorkspace.tsx',
  './components/PaymentListReviewContent.tsx',
  './components/PayoutDrawer.tsx',
  './components/TransactionRecordsTable.tsx',
  './pages/BatchWizardPage.tsx',
  './pages/PaymentBatchDetailPage.tsx',
  './pages/PaymentProjectPaymentDetailPage.tsx',
  './pages/TransactionDetailPage.tsx',
] as const;

describe('payment creator identity coverage', () => {
  it('uses the payment-domain identity component on every single-payee surface', () => {
    PAYMENT_IDENTITY_SURFACES.forEach((path) => {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(source, path).toContain('PaymentCreatorIdentity');
    });
  });

  it('removes the duplicate avatar and generic social identity from batch details', () => {
    const source = readFileSync(new URL('./pages/PaymentBatchDetailPage.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('<Avatar');
    expect(source).not.toContain('<CreatorIdentity');
    expect(source).toContain('paymentCreatorIdentityFromBatchItem');
  });

  it('keeps live and historical identity resolution separate', () => {
    const source = readFileSync(new URL('./paymentCreatorIdentity.ts', import.meta.url), 'utf8');
    expect(source).toContain('paymentListEffectiveAccount(paymentItem).paymentDetails');
    expect(source).toContain('item.accountName');
    expect(source).not.toContain('payout.account) ||');
  });
});
