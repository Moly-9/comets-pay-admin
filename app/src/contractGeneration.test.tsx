import { describe, expect, it } from 'vitest';
import {
  contractFieldDisplayValue,
  contractGenerationSections,
  generateContractDocx,
} from './contractGeneration';
import type { ContractGenerationModel } from './contracts';
import type { CreatorId, EngagementId, ProjectId } from './businessWorkflow';

const model: ContractGenerationModel = {
  templateId: 'CON-TPL-2026-KOL',
  projectId: 'project-test' as ProjectId,
  projectName: 'Synthetic Campaign',
  brandName: '',
  creatorId: 'creator-test' as CreatorId,
  creatorName: 'Synthetic Creator',
  creatorHandle: '@synthetic',
  engagementId: 'engagement-test' as EngagementId,
  contractNumber: 'CON-TEST',
  ioNumber: '',
  advertiser: 'Comets International Limited',
  publisher: '',
  platform: '',
  channelName: '',
  channelUrl: '',
  effectiveDate: '',
  campaignStart: '',
  campaignEnd: '',
  currency: '',
  totalFee: '',
  invoiceIssuePeriod: '',
  paymentTerm: '',
  paymentMethod: '',
  feeBearer: '',
  deliverables: '',
  additionalTerms: '',
};

describe('contract generation', () => {
  it('keeps empty fields empty in the source model and renders writable blank lines', () => {
    expect(model.publisher).toBe('');
    expect(contractFieldDisplayValue(model.publisher)).toMatch(/^_+$/);
    const serialized = JSON.stringify(contractGenerationSections(model));
    expect(serialized).not.toContain('Please fill');
    expect(serialized).not.toContain('XXX');
  });

  it('creates an editable DOCX even when optional fields are empty', async () => {
    const blob = await generateContractDocx(model);
    expect(blob.type).toContain('officedocument.wordprocessingml.document');
    expect(blob.size).toBeGreaterThan(1000);
  });
});
