import { describe, expect, it } from 'vitest';
import {
  INITIAL_CONTRACTS,
  contractMatchesValidityFilter,
  getContractManagementBucket,
  getContractValidity,
  isContractAvailableForNewAssociation,
  isPaymentContract,
  type ContractRecord,
} from './contracts';
import { CONTRACT_MANAGEMENT_DEMO_CONTRACTS } from './prototypeResourceFixtures';

const REFERENCE_DATE = '2026-09-18';
const baseContract = {
  ...INITIAL_CONTRACTS[0],
  lifecycle: 'CONFIRMED' as const,
  signed: true,
  issues: [],
} satisfies ContractRecord;

const contractEnding = (campaignEnd: string | undefined, isLongTerm = false): ContractRecord => ({
  ...baseContract,
  campaignEnd: campaignEnd as string,
  isLongTerm,
});

describe('contract validity', () => {
  it.each([
    ['2026-10-19', 'ACTIVE', 31],
    ['2026-10-18', 'EXPIRING', 30],
    ['2026-09-26', 'EXPIRING', 8],
    ['2026-09-25', 'EXPIRING_URGENT', 7],
    ['2026-09-19', 'EXPIRING_URGENT', 1],
    ['2026-09-18', 'EXPIRES_TODAY', 0],
    ['2026-09-17', 'EXPIRED', -1],
    ['2026-09-13', 'EXPIRED', -5],
  ] as const)('classifies %s as %s', (campaignEnd, status, daysRemaining) => {
    expect(getContractValidity(contractEnding(campaignEnd), REFERENCE_DATE)).toEqual({
      status,
      endDate: campaignEnd,
      daysRemaining,
      expired: status === 'EXPIRED',
    });
  });

  it.each(['', '2026-02-30', '09/30/2026', undefined])('treats %j as an unset end date', (campaignEnd) => {
    expect(getContractValidity(contractEnding(campaignEnd), REFERENCE_DATE)).toEqual({
      status: 'UNSET',
      endDate: '',
      daysRemaining: null,
      expired: false,
    });
  });

  it('lets an explicit long-term marker override the campaign end date', () => {
    expect(getContractValidity(contractEnding('2025-01-01', true), REFERENCE_DATE)).toEqual({
      status: 'LONG_TERM',
      endDate: '',
      daysRemaining: null,
      expired: false,
    });
  });

  it('maps contracts into the five validity filters', () => {
    expect(contractMatchesValidityFilter(contractEnding('2026-09-18'), 'expiring', REFERENCE_DATE)).toBe(true);
    expect(contractMatchesValidityFilter(contractEnding('2026-09-17'), 'expired', REFERENCE_DATE)).toBe(true);
    expect(contractMatchesValidityFilter(contractEnding('', true), 'long-term', REFERENCE_DATE)).toBe(true);
    expect(contractMatchesValidityFilter(contractEnding(''), 'unset', REFERENCE_DATE)).toBe(true);
    expect(contractMatchesValidityFilter(contractEnding('2026-12-31'), 'all', REFERENCE_DATE)).toBe(true);
    expect(contractMatchesValidityFilter(contractEnding('2026-12-31'), 'expiring', REFERENCE_DATE)).toBe(false);
  });

  it('blocks expired contracts only from new associations', () => {
    const expired = contractEnding('2026-09-17');
    expect(isPaymentContract(expired)).toBe(true);
    expect(isContractAvailableForNewAssociation(expired, REFERENCE_DATE)).toBe(false);
    expect(isContractAvailableForNewAssociation(contractEnding('2026-09-18'), REFERENCE_DATE)).toBe(true);
  });

  it('applies the contract-management bucket priority without reading legacy status', () => {
    const expiredDate = '2026-09-17';
    const futureDate = '2026-10-31';
    const editingDraft = {
      ...contractEnding(expiredDate),
      lifecycle: 'EDITING_DRAFT' as const,
      status: '已生效' as const,
    };
    const expiredGenerated = {
      ...contractEnding(expiredDate),
      lifecycle: 'GENERATED_DRAFT' as const,
      signed: false,
      status: '待签署' as const,
    };
    const pendingSignature = {
      ...contractEnding(futureDate),
      lifecycle: 'GENERATED_DRAFT' as const,
      signed: false,
      status: '已生效' as const,
    };
    const pendingConfirmation = {
      ...contractEnding(futureDate),
      lifecycle: 'UPLOADED_PENDING_CONFIRMATION' as const,
      signed: false,
      status: '已生效' as const,
    };

    expect(getContractManagementBucket(editingDraft, REFERENCE_DATE)).toBe('draft');
    expect(getContractManagementBucket(expiredGenerated, REFERENCE_DATE)).toBe('expired');
    expect(getContractManagementBucket(pendingSignature, REFERENCE_DATE)).toBe('signature');
    expect(getContractManagementBucket(pendingConfirmation, REFERENCE_DATE)).toBe('attention');
    expect(getContractManagementBucket({ ...baseContract, campaignEnd: futureDate, status: '待解析' }, REFERENCE_DATE)).toBe('ready');
  });

  it('provides two resumable demo records for each pending management tab', () => {
    const bucketCounts = CONTRACT_MANAGEMENT_DEMO_CONTRACTS.reduce<Record<string, number>>((counts, contract) => {
      const bucket = getContractManagementBucket(contract, '2026-09-09');
      counts[bucket] = (counts[bucket] ?? 0) + 1;
      return counts;
    }, {});

    expect(CONTRACT_MANAGEMENT_DEMO_CONTRACTS).toHaveLength(6);
    expect(bucketCounts).toMatchObject({ attention: 2, draft: 2, signature: 2 });
    expect(bucketCounts.ready ?? 0).toBe(0);
    expect(bucketCounts.expired ?? 0).toBe(0);

    const drafts = CONTRACT_MANAGEMENT_DEMO_CONTRACTS.filter((contract) => contract.lifecycle === 'EDITING_DRAFT');
    expect(drafts).toHaveLength(2);
    drafts.forEach((draft) => {
      expect(draft.generationSnapshot).toMatchObject({
        contractNumber: draft.id,
        projectId: draft.projectId,
        creatorId: draft.creatorId,
      });
      expect(draft.documentUrl).toBe('');
    });

    const attention = CONTRACT_MANAGEMENT_DEMO_CONTRACTS.filter((contract) => (
      contract.lifecycle === 'UPLOADED_PENDING_CONFIRMATION'
    ));
    expect(attention).toHaveLength(2);
    attention.forEach((contract) => {
      expect(contract.extractionStage).toBe('review');
      expect(contract.recognitionResults?.length).toBeGreaterThan(0);
      expect(contract.issues.some((issue) => issue.id === 'recognition-review')).toBe(true);
    });

    const signatures = CONTRACT_MANAGEMENT_DEMO_CONTRACTS.filter((contract) => (
      contract.lifecycle === 'GENERATED_DRAFT'
    ));
    expect(signatures).toHaveLength(2);
    signatures.forEach((contract) => {
      expect(contract.generationVersion).toBe(1);
      expect(contract.generationSnapshot).toBeTruthy();
      expect(contract.documentUrl).toBeTruthy();
    });
  });
});
