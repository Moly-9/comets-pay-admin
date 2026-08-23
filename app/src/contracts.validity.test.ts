import { describe, expect, it } from 'vitest';
import {
  INITIAL_CONTRACTS,
  contractMatchesValidityFilter,
  getContractValidity,
  isContractAvailableForNewAssociation,
  isPaymentContract,
  type ContractRecord,
} from './contracts';

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
});
