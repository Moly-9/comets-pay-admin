import { describe, expect, it } from 'vitest';
import type { CreatorId, EngagementId, ProjectId } from './businessWorkflow';
import {
  contractPublishingChannelsForCreator,
  contractPayoutSnapshot,
  defaultContractPayoutAccount,
  eligibleContractPayoutAccounts,
  formatContractPublishingChannelLinks,
  formatContractPublishingPlatforms,
  resolveContractPublishingChannels,
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
        bankStreetAddress: '1 Example Bank Road',
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
  publishingChannels: [{
    socialAccountId: 'social-synthetic',
    platform: 'YouTube',
    channelUrl: 'https://example.invalid/sample',
  }],
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
    bankStreetAddress: '1 Example Bank Road',
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
  it('builds editable contract channels from every creator social account without mutating the profile', () => {
    const profile = creator();
    profile.socialAccounts.push({
      id: 'social-instagram',
      platform: 'Instagram',
      handle: '@sample',
      profileUrl: 'https://instagram.com/sample',
    });

    const channels = contractPublishingChannelsForCreator(profile);
    channels[1].channelUrl = 'https://instagram.com/sample-contract';

    expect(channels).toEqual([
      {
        socialAccountId: 'social-synthetic',
        platform: 'YouTube',
        channelUrl: 'https://example.invalid/sample',
      },
      {
        socialAccountId: 'social-instagram',
        platform: 'Instagram',
        channelUrl: 'https://instagram.com/sample-contract',
      },
    ]);
    expect(profile.socialAccounts[1].profileUrl).toBe('https://instagram.com/sample');
    expect(formatContractPublishingPlatforms({
      publishingChannels: channels,
      platform: '',
      channelUrl: '',
    })).toBe('YouTube · Instagram');
    expect(formatContractPublishingChannelLinks({
      publishingChannels: channels,
      platform: '',
      channelUrl: '',
    })).toBe([
      'YouTube: https://example.invalid/sample',
      'Instagram: https://instagram.com/sample-contract',
    ].join('\n'));
  });

  it('restores legacy single-channel drafts and refreshes all rows when the creator changes', () => {
    const legacy = resolveContractPublishingChannels({
      platform: 'YouTube',
      channelUrl: 'https://example.invalid/legacy',
    });
    const nextCreator = creator();
    nextCreator.socialAccounts = [{
      id: 'social-next',
      platform: 'TikTok',
      handle: '@next',
      profileUrl: 'https://www.tiktok.com/@next',
    }];

    expect(legacy).toEqual([{
      socialAccountId: '',
      platform: 'YouTube',
      channelUrl: 'https://example.invalid/legacy',
    }]);
    expect(contractPublishingChannelsForCreator(nextCreator)).toEqual([{
      socialAccountId: 'social-next',
      platform: 'TikTok',
      channelUrl: 'https://www.tiktok.com/@next',
    }]);
  });

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

  it('allows every project, content, and commercial field to remain blank', () => {
    const model = validModel();
    Object.assign(model, {
      projectName: '',
      brandName: '',
      effectiveDate: '',
      campaignStart: '',
      campaignEnd: '',
      purposeItems: [],
      promotedProduct: '',
      hashtag: '',
      contentFormat: '',
      releaseStart: '',
      releaseEnd: '',
      language: '',
      contentLength: '',
      licensePeriod: '',
      licensePrice: '',
      currency: '',
      totalFee: '',
      feeBearer: '',
    });

    expect(validateContractGenerationModel(model)).toEqual({});
  });

  it('collapses unselected creator and payout validation to their selectors', () => {
    const withoutCreator = validModel();
    Object.assign(withoutCreator, {
      creatorId: '',
      publisher: '',
      publisherAddress: '',
      platform: '',
      channelName: '',
      channelUrl: '',
      publishingChannels: [],
    });
    const creatorErrors = validateContractGenerationModel(withoutCreator);

    expect(creatorErrors.creator).toBe('请选择合作达人');
    expect(creatorErrors).not.toHaveProperty('publisher');
    expect(creatorErrors).not.toHaveProperty('publisherAddress');
    expect(creatorErrors).not.toHaveProperty('channelName');

    const withoutAccount = validModel();
    Object.assign(withoutAccount, {
      payoutAccountId: '',
      paymentSnapshot: {
        ...withoutAccount.paymentSnapshot,
        accountName: '',
        accountNumber: '',
        iban: '',
        bankName: '',
      },
    });
    expect(validateContractGenerationModel(withoutAccount).payoutAccountId).toContain('已验证');
  });

  it('blocks selected creators whose legal or channel profile is incomplete', () => {
    const model = validModel();
    Object.assign(model, {
      publisher: '',
      publisherAddress: '',
      platform: '',
      channelName: '',
      channelUrl: '',
      publishingChannels: [{
        socialAccountId: 'social-synthetic',
        platform: '',
        channelUrl: '',
      }],
    });

    expect(validateContractGenerationModel(model)).toMatchObject({
      publisher: expect.any(String),
      publisherAddress: expect.any(String),
      platform: expect.any(String),
      channelName: expect.any(String),
      channelUrl: expect.any(String),
    });
  });

  it('validates selected Airwallex and PayPal account snapshots', () => {
    const missingBank = validModel();
    missingBank.paymentSnapshot.bankName = '';
    expect(validateContractGenerationModel(missingBank).payoutAccountId).toContain('Beneficiary Bank');

    const missingLocator = validModel();
    missingLocator.paymentSnapshot.accountNumber = '';
    missingLocator.paymentSnapshot.iban = '';
    expect(validateContractGenerationModel(missingLocator).payoutAccountId).toContain('Account Number 或 IBAN');

    const missingBankAddress = validModel();
    missingBankAddress.paymentSnapshot.bankStreetAddress = '';
    expect(validateContractGenerationModel(missingBankAddress).payoutAccountId)
      .toContain('Beneficiary Bank Address');

    const paypal = validModel();
    Object.assign(paypal, {
      payoutAccountId: 'paypal-validated',
      payoutProvider: 'PayPal',
      paymentMethod: 'PAYPAL',
      paymentSnapshot: {
        ...paypal.paymentSnapshot,
        accountName: '',
        accountNumber: '',
        bankName: '',
        paypalUsername: 'Sample Creator',
        paypalEmail: 'invalid-email',
      },
    });
    expect(validateContractGenerationModel(paypal).payoutAccountId).toContain('PayPal Email Address');
    paypal.paymentSnapshot.paypalEmail = 'creator@example.invalid';
    expect(validateContractGenerationModel(paypal)).toEqual({});
  });

  it('blocks incomplete or invalid publishing-channel rows', () => {
    const missing = validModel();
    missing.publishingChannels = [
      {
        socialAccountId: 'social-youtube',
        platform: 'YouTube',
        channelUrl: '',
      },
      {
        socialAccountId: 'social-instagram',
        platform: '',
        channelUrl: 'not-a-url',
      },
    ];

    expect(validateContractGenerationModel(missing)).toMatchObject({
      platform: '第 2 个频道缺少发布平台',
      channelUrl: '第 1 个频道缺少频道链接',
    });

    missing.publishingChannels[0].channelUrl = 'https://youtube.com/@sample';
    expect(validateContractGenerationModel(missing).channelUrl).toBe('第 2 个频道链接格式无效');
  });

  it('refreshes the read-only payment snapshot when the selected account changes', () => {
    const profile = creator();
    const airwallex = profile.payoutAccounts.find((account) => account.id === 'airwallex-verified') ?? null;
    const paypal = profile.payoutAccounts.find((account) => account.id === 'paypal-validated') ?? null;

    expect(contractPayoutSnapshot(airwallex)).toMatchObject({
      accountName: 'Sample Creator Limited',
      accountNumber: '0000001234',
      bankName: 'Sample Bank',
    });
    expect(contractPayoutSnapshot(paypal)).toMatchObject({
      paypalUsername: 'Sample Creator',
      paypalEmail: 'creator@example.invalid',
    });
  });

  it('still blocks invalid values when optional fields are filled', () => {
    const model = validModel();
    Object.assign(model, {
      totalFee: '-1',
      licensePrice: '-10',
      campaignStart: '2026-09-01',
      campaignEnd: '2026-08-31',
      releaseStart: '2026-08-12',
      releaseEnd: '',
    });

    expect(validateContractGenerationModel(model)).toMatchObject({
      totalFee: expect.any(String),
      licensePrice: expect.any(String),
      campaignEnd: expect.any(String),
      releaseEnd: expect.any(String),
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
