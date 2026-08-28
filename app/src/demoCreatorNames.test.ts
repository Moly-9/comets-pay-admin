import { describe, expect, it } from 'vitest';
import { INITIAL_CONTRACTS } from './contracts';
import { INITIAL_PAYOUTS } from './data';
import { INITIAL_CREATORS } from './pages/OperationalPages';
import { INITIAL_COMPLETE_REQUEST_RESOURCES } from './requestProjectPrototypeResources';

describe('creator demo names', () => {
  it('keeps display, real, and account names visibly distinct for every seeded creator', () => {
    expect(INITIAL_CREATORS.length).toBeGreaterThan(0);

    INITIAL_CREATORS.forEach((creator) => {
      const airwallexAccounts = creator.payoutAccounts.filter((account) => account.provider === 'Airwallex');

      expect(creator.name).toMatch(/ dis$/);
      expect(creator.contact.legalName).toMatch(/ real$/);
      expect(airwallexAccounts.length).toBeGreaterThan(0);

      airwallexAccounts.forEach((account) => {
        expect(account.bankDetails.accountName).toMatch(/ acc$/);
        expect(new Set([
          creator.name,
          creator.contact.legalName,
          account.bankDetails.accountName,
        ]).size).toBe(3);
      });

      creator.payoutAccounts
        .filter((account) => account.provider === 'PayPal')
        .forEach((account) => expect(account.paypalUsername).toMatch(/ acc$/));
    });
  });

  it('keeps legacy display rows and document snapshots on the same suffix convention', () => {
    INITIAL_PAYOUTS.forEach((payout) => expect(payout.creator).toMatch(/ dis$/));

    INITIAL_CONTRACTS
      .filter((contract) => !contract.isTemplate)
      .forEach((contract) => {
        expect(contract.publisher).toMatch(/ real$/);
        expect(contract.accountName).toMatch(/ acc$/);
      });

    INITIAL_COMPLETE_REQUEST_RESOURCES.contracts.forEach((contract) => {
      expect(contract.publisher).toMatch(/ real$/);
      expect(contract.accountName).toMatch(/ acc$/);
    });

    INITIAL_COMPLETE_REQUEST_RESOURCES.invoices.forEach((invoice) => {
      expect(invoice.snapshot.creatorName).toMatch(/ dis$/);
      expect(invoice.snapshot.from.legalName).toMatch(/ real$/);
      if (invoice.snapshot.paymentMethod === 'paypal') {
        expect(invoice.snapshot.payment.paypalUsername).toMatch(/ acc$/);
      } else {
        expect(invoice.snapshot.payment.accountName).toMatch(/ acc$/);
      }
    });
  });
});
