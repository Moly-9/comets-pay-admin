import { describe, expect, it } from 'vitest';
import { eligibleInvoicePayoutAccounts } from '../payoutAccounts';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from '../pages/OperationalPages';
import type { GeneratedInvoiceRecord } from '../types';
import {
  INVOICE_BATCH_PROTOTYPE_ACCOUNT_LABEL,
  INVOICE_BATCH_PROTOTYPE_CURRENCY,
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
});
