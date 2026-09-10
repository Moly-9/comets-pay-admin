import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_CONTRACT_ADVERTISER_SETTINGS } from '../data';
import { INITIAL_CONTRACTS } from '../contracts';
import {
  ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS,
  DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES,
} from '../contractTemplateFieldPolicies';
import { ContractBuilderPage, contractBuilderTemplateOutputFieldKeys } from './ContractBuilderPage';

const renderBuilder = (advertiser: 'SYSTEM' | 'MANUAL' | 'OMIT') => {
  const template = INITIAL_CONTRACTS.find((contract) => contract.isTemplate)!;
  return renderToStaticMarkup(createElement(ContractBuilderPage, {
    projects: [],
    creators: [],
    contractAdvertiserSettings: INITIAL_CONTRACT_ADVERTISER_SETTINGS,
    contractTemplate: {
      ...template,
      templateFieldPolicies: {
        ...DEFAULT_CONTRACT_TEMPLATE_FIELD_POLICIES,
        advertiser,
      },
    },
    onGenerated: vi.fn(),
    onSaveDraft: vi.fn(),
    onCancel: vi.fn(),
    onOpenContractManagement: vi.fn(),
  }));
};

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

describe('ContractBuilderPage advertiser controls', () => {
  it('offers every configured entity and preselects the contract default in SYSTEM mode', () => {
    const html = renderBuilder('SYSTEM');

    expect(html).toContain('aria-label="合同 Advertiser 主体"');
    expect(html).toContain('COMETS INTERNATIONAL LIMITED');
    expect(html).toContain(INITIAL_CONTRACT_ADVERTISER_SETTINGS.entities[0].address);
  });

  it('shows independent name and address inputs in MANUAL mode', () => {
    const html = renderBuilder('MANUAL');

    expect(html).toContain('placeholder="输入合同 Advertiser"');
    expect(html).toContain('placeholder="输入合同 Advertiser 地址"');
    expect(html).not.toContain('aria-label="合同 Advertiser 主体"');
  });

  it('omits the Advertiser controls when the template policy omits the field', () => {
    const html = renderBuilder('OMIT');

    expect(html).not.toContain('aria-label="合同 Advertiser 主体"');
    expect(html).not.toContain('placeholder="输入合同 Advertiser"');
    expect(html).not.toContain('placeholder="输入合同 Advertiser 地址"');
  });
});
