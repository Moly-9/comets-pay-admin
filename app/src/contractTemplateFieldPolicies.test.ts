import { describe, expect, it } from 'vitest';
import type { CreatorId, EngagementId, ProjectId } from './businessWorkflow';
import { createGeneratedContractDraft, INITIAL_CONTRACTS, type ContractGenerationModel } from './contracts';
import {
  CONTRACT_TEMPLATE_OUTPUT_FIELDS,
  ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS,
  DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES,
  contractTemplateOutputFieldApplies,
  contractTemplatePoliciesAreDirty,
  createContractTemplatePolicyUpdate,
  createContractTemplateStatusUpdate,
  getContractTemplateStatus,
  getContractTemplatePolicyReadiness,
  getContractTemplateSupportedPayoutProviders,
  hasManualPayoutDocumentDifferences,
  resolveContractTemplateFieldPolicies,
  resolveContractTemplateOutput,
  resolveContractTemplateOutputFieldKeys,
  validateContractTemplateFieldPolicies,
} from './contractTemplateFieldPolicies';

const model = (): ContractGenerationModel => ({
  templateId: 'CON-TPL-2026-KOL',
  contractName: 'Policy Test Contract',
  projectId: 'project-policy' as ProjectId,
  projectName: 'Policy Test Project',
  brandName: 'Policy Test Brand',
  creatorId: 'creator-policy' as CreatorId,
  creatorName: 'Policy Creator',
  creatorHandle: '@policy',
  engagementId: 'engagement-policy' as EngagementId,
  contractNumber: 'CON-POLICY-001',
  ioNumber: '',
  advertiser: 'System Advertiser',
  publisher: 'System Publisher',
  publisherAddress: '1 Publisher Road',
  platform: 'YouTube',
  channelName: '@policy',
  channelUrl: 'https://youtube.com/@policy',
  publishingChannels: [{
    socialAccountId: 'social-policy',
    platform: 'YouTube',
    channelUrl: 'https://youtube.com/@policy',
  }],
  effectiveDate: '2026-08-01',
  campaignStart: '2026-08-10',
  campaignEnd: '2026-08-31',
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
  currency: 'USD',
  totalFee: '',
  invoiceIssueWorkingDays: 3,
  paymentWorkingDays: 45,
  paymentMethod: 'AIRWALLEX',
  feeBearer: 'ADVERTISER',
  payoutAccountId: 'account-policy',
  payoutProvider: 'Airwallex',
  paymentSnapshot: {
    bankCountry: 'United States',
    accountName: 'System Account Name',
    accountType: 'Checking',
    swiftCode: 'SYSTEMSWIFT',
    accountNumber: '00001234',
    iban: '',
    beneficiaryType: 'COMPANY',
    bankName: 'System Bank',
    bankStreetAddress: '2 Bank Road',
    bankCity: 'New York',
    bankState: 'NY',
    bankPostalCode: '10001',
    intermediaryBankCountry: '',
    intermediaryBankCode: '',
    transferRemarks: 'System transfer note',
    paypalUsername: '',
    paypalEmail: '',
  },
});

describe('contract template field policies', () => {
  it('migrates old templates to 14 complete defaults', () => {
    const resolved = resolveContractTemplateFieldPolicies();

    expect(CONTRACT_TEMPLATE_OUTPUT_FIELDS).toHaveLength(14);
    expect(resolved).toEqual(DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES);
    expect(resolved.campaignPeriod).toBe('MANUAL');
    expect(resolved.remittanceInformation).toBe('SYSTEM');
    expect(resolved.transferNote).toBe('SYSTEM');
    expect(Object.values(resolved).filter((mode) => mode === 'SYSTEM')).toHaveLength(13);
    expect(resolveContractTemplateOutputFieldKeys()).toEqual(ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS);
    expect(getContractTemplateStatus({})).toBe('ACTIVE');
    expect(getContractTemplateStatus(INITIAL_CONTRACTS[1])).toBe('ACTIVE');
  });

  it('resolves system, manual and omitted values through one output snapshot', () => {
    const source = model();
    source.templateFieldPolicies = {
      ...DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES,
      advertiser: 'MANUAL',
      publisher: 'OMIT',
      channel: 'MANUAL',
      campaignPeriod: 'MANUAL',
      accountName: 'MANUAL',
    };
    source.templateManualFieldValues = {
      advertiser: 'Manual Advertiser',
      accountName: 'Manual Account Name',
      channel: {
        publishingChannels: [{ socialAccountId: '', platform: 'TikTok', channelUrl: 'https://tiktok.com/@manual' }],
      },
      campaignPeriod: { startDate: '2026-09-01', endDate: '2026-09-30' },
    };

    const output = resolveContractTemplateOutput(source);

    expect(output.values.advertiser).toBe('Manual Advertiser');
    expect(output.values.publisher).toBe('');
    expect(output.effectiveModel.platform).toBe('TikTok');
    expect(output.effectiveModel.channelUrl).toBe('TikTok: https://tiktok.com/@manual');
    expect(output.effectiveModel.campaignStart).toBe('2026-09-01');
    expect(output.effectiveModel.paymentSnapshot.accountName).toBe('Manual Account Name');
    expect(source.paymentSnapshot.accountName).toBe('System Account Name');
  });

  it('keeps channel-specific fields scoped to Airwallex or PayPal', () => {
    expect(contractTemplateOutputFieldApplies('accountName', 'Airwallex')).toBe(true);
    expect(contractTemplateOutputFieldApplies('accountName', 'PayPal')).toBe(false);
    expect(contractTemplateOutputFieldApplies('paypalEmailAddress', 'PayPal')).toBe(true);
    expect(contractTemplateOutputFieldApplies('paypalEmailAddress', 'Airwallex')).toBe(false);
    expect(contractTemplateOutputFieldApplies('publisher', 'PayPal')).toBe(true);
    expect(getContractTemplateSupportedPayoutProviders(
      DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES,
      ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS.filter((key) => !key.startsWith('paypal') && key !== 'transferNote'),
    )).toEqual(['Airwallex']);
    expect(getContractTemplateSupportedPayoutProviders(
      DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES,
      ['advertiser', 'publisher', 'channel', 'campaignPeriod', 'paypalUsername', 'paypalEmailAddress'],
    )).toEqual(['PayPal']);
  });

  it('enforces the Account Number / IBAN alternative at template level', () => {
    const invalid = {
      ...DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES,
      accountNumber: 'OMIT' as const,
      iban: 'OMIT' as const,
    };

    expect(validateContractTemplateFieldPolicies(invalid)).toEqual([
      expect.objectContaining({ id: 'bank-account-locator-omitted', fieldKeys: ['accountNumber', 'iban'] }),
    ]);
    expect(getContractTemplatePolicyReadiness(invalid).ready).toBe(false);
    expect(validateContractTemplateFieldPolicies({ ...invalid, iban: 'MANUAL' })).toEqual([]);
  });

  it('marks omitted inline fields as not ready while allowing a valid update to be saved', () => {
    const omittedPublisher = { ...DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES, publisher: 'OMIT' as const };
    const readiness = getContractTemplatePolicyReadiness(omittedPublisher);
    const update = createContractTemplatePolicyUpdate(
      {
        ...INITIAL_CONTRACTS[1],
        templateStatus: 'INACTIVE',
        templateOutputFieldKeys: ['advertiser', 'publisher'],
      },
      omittedPublisher,
      { updated: '2026-08-30' },
    );

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'required-inline-missing-publisher' }),
    ]));
    expect(update.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'required-inline-missing-publisher' }),
    ]));
    expect(update.contract?.updated).toBe('2026-08-30');
    expect(update.contract?.templateFieldPolicies?.publisher).toBe('OMIT');
    expect(update.contract.templateOutputFieldKeys).toEqual(ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS);
    expect(contractTemplatePoliciesAreDirty(DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES, omittedPublisher)).toBe(true);
    expect(contractTemplatePoliciesAreDirty(omittedPublisher, update.contract?.templateFieldPolicies)).toBe(false);
  });

  it('freezes policy and manual document values without mutating the verified account snapshot', () => {
    const source = model();
    source.templateFieldPolicies = {
      ...DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES,
      campaignPeriod: 'SYSTEM',
      accountName: 'MANUAL',
    };
    source.templateManualFieldValues = { accountName: 'Document-only Account Name' };
    source.templateOutputFieldKeys = ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS.filter((key) => key !== 'transferNote');

    const record = createGeneratedContractDraft(source);
    source.templateFieldPolicies.accountName = 'SYSTEM';
    source.templateManualFieldValues.accountName = 'Changed later';

    expect(hasManualPayoutDocumentDifferences(record.generationSnapshot!)).toBe(true);
    expect(record.paymentSnapshot?.accountName).toBe('Document-only Account Name');
    expect(record.generationSnapshot?.paymentSnapshot.accountName).toBe('System Account Name');
    expect(record.generationSnapshot?.templateFieldPolicies?.accountName).toBe('MANUAL');
    expect(record.generationSnapshot?.templateOutputFieldKeys).not.toContain('transferNote');
    expect(record.generationSnapshot?.templateManualFieldValues?.accountName).toBe('Document-only Account Name');
  });

  it('removes structural fields from output while preserving their stored policy for re-adding', () => {
    const source = model();
    source.templateFieldPolicies = { ...DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES, transferNote: 'MANUAL' };
    source.templateManualFieldValues = { transferNote: 'Document-only transfer note' };
    source.templateOutputFieldKeys = ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS.filter((key) => key !== 'transferNote');

    const removed = resolveContractTemplateOutput(source);
    const restored = resolveContractTemplateOutput({
      ...source,
      templateOutputFieldKeys: [...source.templateOutputFieldKeys, 'transferNote'],
    });

    expect(removed.values.transferNote).toBe('');
    expect(removed.policies.transferNote).toBe('MANUAL');
    expect(restored.values.transferNote).toBe('Document-only transfer note');
  });

  it('allows one payout method to close, but requires at least one supported method', () => {
    const commonAndBank = ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS.filter((key) => (
      !['paypalUsername', 'paypalEmailAddress', 'transferNote'].includes(key)
    ));
    const commonOnly = ['advertiser', 'publisher', 'channel', 'campaignPeriod'] as const;

    expect(getContractTemplatePolicyReadiness(DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES, commonAndBank).ready).toBe(true);
    expect(getContractTemplatePolicyReadiness(DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES, commonOnly).blockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'payout-provider-missing' })]),
    );
    expect(resolveContractTemplateOutputFieldKeys([])).toEqual([]);
  });

  it('blocks invalid activation and auto-deactivates an active template when invalid changes are saved', () => {
    const invalidPolicies = {
      ...DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES,
      publisher: 'OMIT' as const,
    };
    const activation = createContractTemplateStatusUpdate({
      ...INITIAL_CONTRACTS[1],
      templateStatus: 'INACTIVE',
      templateFieldPolicies: invalidPolicies,
    }, 'ACTIVE');
    const save = createContractTemplatePolicyUpdate(
      { ...INITIAL_CONTRACTS[1], templateStatus: 'ACTIVE' },
      invalidPolicies,
      { deactivateIfInvalid: true, updated: '2026-08-30' },
    );
    const deactivation = createContractTemplateStatusUpdate({
      ...INITIAL_CONTRACTS[1],
      templateOutputFieldKeys: ['advertiser', 'publisher'],
    }, 'INACTIVE');

    expect(activation.contract).toBeUndefined();
    expect(activation.issues[0]?.groupKeys).toContain('COMMON');
    expect(save.autoDeactivated).toBe(true);
    expect(save.contract.templateStatus).toBe('INACTIVE');
    expect(save.contract.templateOutputFieldKeys).toEqual(ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS);
    expect(deactivation.contract?.templateOutputFieldKeys).toEqual(ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS);
  });
});
