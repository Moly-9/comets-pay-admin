import { describe, expect, it } from 'vitest';
import { ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS } from '../contractTemplateFieldPolicies';
import { contractBuilderTemplateOutputFieldKeys } from './ContractBuilderPage';

describe('contractBuilderTemplateOutputFieldKeys', () => {
  it('uses all 14 fields for every new contract', () => {
    expect(contractBuilderTemplateOutputFieldKeys(null)).toEqual(
      ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS,
    );
  });

  it('preserves a frozen subset for existing drafts', () => {
    expect(contractBuilderTemplateOutputFieldKeys({
      templateOutputFieldKeys: ['advertiser', 'publisher', 'channel', 'campaignPeriod'],
    })).toEqual(['advertiser', 'publisher', 'channel', 'campaignPeriod']);
  });

  it('migrates a legacy draft without a field list to all 14 fields', () => {
    expect(contractBuilderTemplateOutputFieldKeys({})).toEqual(
      ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS,
    );
  });
});
