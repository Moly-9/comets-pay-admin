import { describe, expect, it } from 'vitest';
import { eligibleInvoicePayoutAccounts } from '../payoutAccounts';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from '../pages/OperationalPages';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from '../requestProjectPrototypeResources';
import type { GeneratedInvoiceRecord } from '../types';
import {
  INVOICE_BATCH_PROTOTYPE_ACCOUNT_LABEL,
  INVOICE_BATCH_PROTOTYPE_CURRENCY,
  INVOICE_BATCH_PROTOTYPE_DEMO_CURRENCY,
  INVOICE_BATCH_PROTOTYPE_DEMO_DESCRIPTION,
  INVOICE_BATCH_PROTOTYPE_PAYPAL_LABEL,
  createInvoiceBatchPrototypeSeed,
  filterInvoiceBatchCreatorReferences,
  selectableInvoiceBatchEngagementIds,
  withInvoiceBatchPrototypeAccounts,
} from './invoiceBatchPrototype';

describe('Invoice batch prototype defaults', () => {
  it('provides every creator with one verified default Airwallex USD account', () => {
    const creators = withInvoiceBatchPrototypeAccounts(INITIAL_CREATORS);

    creators.forEach((creator) => {
      const defaultAccount = eligibleInvoicePayoutAccounts(creator)
        .find((account) => account.isDefault);
      expect(defaultAccount).toMatchObject({
        provider: 'Airwallex',
        nickname: INVOICE_BATCH_PROTOTYPE_ACCOUNT_LABEL,
        isDefault: true,
        status: 'VERIFIED',
      });
      expect(
        defaultAccount?.provider === 'Airwallex'
          ? defaultAccount.bankDetails.accountCurrency
          : '',
      ).toBe(INVOICE_BATCH_PROTOTYPE_CURRENCY);
    });
  });

  it('provides stable Bank and PayPal prototype choices without duplicating injected accounts', () => {
    const creators = withInvoiceBatchPrototypeAccounts(INITIAL_CREATORS);
    const creatorsAfterSecondInjection = withInvoiceBatchPrototypeAccounts(creators);

    creatorsAfterSecondInjection.forEach((creator) => {
      const eligibleAccounts = eligibleInvoicePayoutAccounts(creator);
      const prototypeBankAccounts = eligibleAccounts.filter((account) => (
        account.payoutAccountId === `awx-batch-${creator.id}`
      ));
      const prototypePayPalAccounts = eligibleAccounts.filter((account) => (
        account.payoutAccountId === `paypal-batch-${creator.id}`
      ));

      expect(prototypeBankAccounts).toHaveLength(1);
      expect(prototypePayPalAccounts).toHaveLength(1);
      expect(prototypePayPalAccounts[0]).toMatchObject({
        provider: 'PayPal',
        nickname: INVOICE_BATCH_PROTOTYPE_PAYPAL_LABEL,
        isDefault: false,
        status: 'VERIFIED',
      });
      expect(
        prototypePayPalAccounts[0].provider === 'PayPal'
          ? prototypePayPalAccounts[0].paypalEmail
          : '',
      ).toMatch(/@example\.test$/);
    });
  });

  it('searches project creators by name, handle, or platform without changing order', () => {
    const references = INITIAL_PROJECTS[0].creatorProfiles!;

    expect(filterInvoiceBatchCreatorReferences(references, 'camila'))
      .toEqual(references.filter((reference) => reference.name.includes('Camila')));
    expect(filterInvoiceBatchCreatorReferences(references, '@OLIVER'))
      .toEqual(references.filter((reference) => reference.handle === '@oliver.tech'));
    expect(filterInvoiceBatchCreatorReferences(references, 'twitch'))
      .toEqual(references.filter((reference) => reference.platform.toLowerCase().includes('twitch')));
  });

  it('selects all project creators up to the limit and skips existing Invoices', () => {
    const references = INITIAL_PROJECTS[0].creatorProfiles!;
    const existingReference = references[1];
    const generatedInvoices = [{
      snapshot: { engagementId: existingReference.engagementId },
    }] as GeneratedInvoiceRecord[];

    const selected = selectableInvoiceBatchEngagementIds(
      references,
      generatedInvoices,
      5,
    );

    expect(selected).toHaveLength(5);
    expect(selected).not.toContain(existingReference.engagementId);
    expect(selected[0]).toBe(references[0].engagementId);
  });

  it('builds five deterministic ready-to-fill demo rows from the project with available creators', () => {
    const seed = createInvoiceBatchPrototypeSeed(
      INITIAL_PROJECTS,
      INITIAL_COMPLETE_REQUEST_RESOURCES.invoices,
    );

    expect(seed).toMatchObject({
      projectId: 'PRJ-260801-07',
      currency: INVOICE_BATCH_PROTOTYPE_DEMO_CURRENCY,
      description: INVOICE_BATCH_PROTOTYPE_DEMO_DESCRIPTION,
    });
    expect(seed?.rows).toHaveLength(5);
    expect(new Set(seed?.rows.map((row) => row.engagementId)).size).toBe(5);
    expect(seed?.rows.map((row) => row.payoutProvider)).toEqual([
      'Airwallex',
      'PayPal',
      'Airwallex',
      'PayPal',
      'Airwallex',
    ]);
    expect(seed?.rows.every((row) => row.unitPrice > 0 && row.quantity > 0)).toBe(true);
  });
});
