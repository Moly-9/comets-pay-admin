import { describe, expect, it } from 'vitest';
import { ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS } from '../contractTemplateFieldPolicies';
import { contractBuilderTemplateOutputFieldKeys } from './ContractBuilderPage';

describe('contractBuilderTemplateOutputFieldKeys', () => {
  it('uses the 13 current fields for every new contract', () => {
    expect(contractBuilderTemplateOutputFieldKeys(null)).toEqual(
      ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS,
    );
  });

  it('normalizes legacy draft fields to the current schema without Campaign Period', () => {
    expect(contractBuilderTemplateOutputFieldKeys({
      templateOutputFieldKeys: ['advertiser', 'publisher', 'channel', 'campaignPeriod'],
    })).toEqual(ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS);
    expect(contractBuilderTemplateOutputFieldKeys({
      templateOutputFieldKeys: ['advertiser', 'publisher', 'channel', 'campaignPeriod'],
    })).not.toContain('campaignPeriod');
  });

  it('migrates a legacy draft without a field list to all current fields', () => {
    expect(contractBuilderTemplateOutputFieldKeys({})).toEqual(
      ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS,
    );
  });
});
