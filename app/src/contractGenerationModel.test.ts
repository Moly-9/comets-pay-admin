import { describe, expect, it } from 'vitest';
import type { CreatorId, EngagementId, ProjectId } from './businessWorkflow';
import {
  defaultContractPayoutAccount,
  eligibleContractPayoutAccounts,
  validateContractGenerationModel,
} from './contractGenerationModel';
import type { ContractGenerationModel } from './contracts';
import {
  createAirwallexPayoutAccount,
  createPayMaxPayoutAccount,
  createPayPalPayoutAccount,
} from './payoutAccounts';
import type { CreatorProfile } from './types';

const creator = (): CreatorProfile => ({
  id: 'creator-synthetic',
  initials: 'SC',
  accent: '#777777',
  name: 'Sample Creator',
  handle: '@sample',
  region: 'Sample Region',
  platform: 'YouTube',
  projects: 1,
  socialAccounts: [{
    id: 'social-synthetic',
    platform: 'YouTube',
    handle: '@sample',
    profileUrl: 'https://example.invalid/sample',
  }],
  contact: {
    legalName: 'Sample Creator Limited',
    address: '1 Example Road, Sample City',
    phone: '',
    email: 'creator@example.invalid',
  },
  payoutAccounts: [
    createPayPalPayoutAccount({
      id: 'paypal-unverified',
      status: 'DRAFT',
      paypalUsername: 'Sample Creator',
      paypalEmail: 'creator@example.invalid',
    }),
    createPayMaxPayoutAccount({
      id: 'paymax-verified',
      status: 'VERIFIED',
      beneficiaryName: 'Sample Creator Limited',
    }),
    createAirwallexPayoutAccount({
      id: 'airwallex-verified',
      status: 'VERIFIED',
      isDefault: true,
      entityType: 'COMPANY',
      companyName: 'Sample Creator Limited',
      bankDetails: {
        accountName: 'Sample Creator Limited',
        accountNumber: '0000001234',
        bankName: 'Sample Bank',
      },
    }),
    createPayPalPayoutAccount({
      id: 'paypal-validated',
      status: 'VALIDATED',
      paypalUsername: 'Sample Creator',
      paypalEmail: 'creator@example.invalid',
    }),
  ],
});

const validModel = (): ContractGenerationModel => ({
  templateId: 'CON-TPL-2026-KOL',
  projectId: 'project-synthetic' as ProjectId,
  projectName: 'Synthetic Campaign',
  brandName: 'Synthetic Brand',
  creatorId: 'creator-synthetic' as CreatorId,
  creatorName: 'Sample Creator',
  creatorHandle: '@sample',
  engagementId: 'engagement-synthetic' as EngagementId,
  contractNumber: 'CON-SYNTHETIC-001',
  ioNumber: '',
  advertiser: 'Comets International Limited',
  publisher: 'Sample Creator Limited',
  publisherAddress: '1 Example Road, Sample City',
  platform: 'YouTube',
  channelName: 'Sample Studio',
  channelUrl: 'https://example.invalid/sample',
  effectiveDate: '2026-08-05',
  campaignStart: '2026-08-10',
  campaignEnd: '2026-08-31',
  purposeItems: ['Introduce the synthetic campaign'],
  promotedProduct: 'Synthetic Product',
  hashtag: '#SyntheticCampaign',
  contentFormat: 'Dedicated video',
  releaseStart: '2026-08-12',
  releaseEnd: '2026-08-20',
  language: 'English',
  contentLength: 'At least 8 minutes',
  licensePeriod: '',
  licensePrice: '',
  currency: 'USD',
  totalFee: '3000',
  invoiceIssueWorkingDays: 3,
  paymentWorkingDays: 45,
  paymentMethod: 'AIRWALLEX',
  feeBearer: 'ADVERTISER',
  payoutAccountId: 'airwallex-verified',
  payoutProvider: 'Airwallex',
  paymentSnapshot: {
    bankCountry: 'Sample Country',
    accountName: 'Sample Creator Limited',
    accountType: 'Business',
    swiftCode: '',
    accountNumber: '0000001234',
    iban: '',
    beneficiaryType: 'COMPANY',
    bankName: 'Sample Bank',
    bankStreetAddress: '',
    bankCity: '',
    bankState: '',
    bankPostalCode: '',
    intermediaryBankCountry: '',
    intermediaryBankCode: '',
    transferRemarks: '',
    paypalUsername: '',
    paypalEmail: '',
  },
});

describe('contract generation model', () => {
  it('only exposes verified Airwallex and PayPal accounts and selects the verified default', () => {
    const profile = creator();

    expect(eligibleContractPayoutAccounts(profile).map((account) => account.id)).toEqual([
      'airwallex-verified',
      'paypal-validated',
    ]);
    expect(defaultContractPayoutAccount(profile)?.id).toBe('airwallex-verified');
  });

  it('rejects reversed dates and missing verified payout snapshots', () => {
    const model = validModel();
    model.campaignEnd = '2026-08-01';
    model.releaseEnd = '2026-08-01';
    model.payoutAccountId = '';
    model.paymentSnapshot.accountName = '';
    model.paymentSnapshot.accountNumber = '';

    expect(validateContractGenerationModel(model)).toMatchObject({
      campaignEnd: expect.any(String),
      releaseEnd: expect.any(String),
      payoutAccountId: expect.any(String),
    });
  });

  it('accepts complete synthetic contract data with stable relationship IDs', () => {
    const model = validModel();

    expect(validateContractGenerationModel(model)).toEqual({});
    expect(model.projectId).toBe('project-synthetic');
    expect(model.creatorId).toBe('creator-synthetic');
    expect(model.engagementId).toBe('engagement-synthetic');
  });
});
