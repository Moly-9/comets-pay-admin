import { describe, expect, it } from 'vitest';
import { PROJECT_DEMO_CONTRACTS, PROJECT_DEMO_INVOICES } from '../prototypeResourceFixtures';
import { validateInvoiceDocumentModel } from './invoiceDraft';

describe('validateInvoiceDocumentModel contract payout override', () => {
  it('keeps the contract payout snapshot frozen by default', () => {
    const source = PROJECT_DEMO_INVOICES[0]!.snapshot;
    const selectedContracts = PROJECT_DEMO_CONTRACTS.filter((contract) => (
      contract.contractId && source.contractIds?.includes(contract.contractId)
    ));
    const changed = {
      ...source,
      payoutAccountId: 'verified-replacement-account',
      payment: {
        ...source.payment,
        payoutAccountId: 'verified-replacement-account',
        payoutAccountVersion: 'v2' as const,
        accountFingerprint: 'replacement-fingerprint',
      },
    };

    expect(validateInvoiceDocumentModel(changed, selectedContracts).payoutAccountId)
      .toContain('与合同冻结版本不一致');
  });

  it('accepts a verified replacement account and its payment method for a finance return', () => {
    const source = PROJECT_DEMO_INVOICES[0]!.snapshot;
    const selectedContracts = PROJECT_DEMO_CONTRACTS.filter((contract) => (
      contract.contractId && source.contractIds?.includes(contract.contractId)
    ));
    const changed = {
      ...source,
      payoutAccountId: 'verified-paypal-account',
      payoutProvider: 'PayPal' as const,
      payoutAccountVersion: 'v2' as const,
      payoutAccountFingerprint: 'verified-paypal-fingerprint',
      paymentMethod: 'paypal' as const,
      payment: {
        ...source.payment,
        payoutAccountId: 'verified-paypal-account',
        payoutProvider: 'PayPal' as const,
        payoutAccountVersion: 'v2' as const,
        accountFingerprint: 'verified-paypal-fingerprint',
        paypalUsername: 'verified.creator',
        paypalEmail: 'verified.creator@example.com',
      },
    };
    const errors = validateInvoiceDocumentModel(changed, selectedContracts, {
      allowContractPayoutOverride: true,
    });

    expect(errors.payoutAccountId).toBeUndefined();
    expect(errors['contract-paymentMethod']).toBeUndefined();
  });
});
