import { describe, expect, it } from 'vitest';
import type { CreatorId, EngagementId, InvoiceId, ProjectId } from '../businessWorkflow';
import { findExistingEngagementId } from '../paymentRequestProjects';
import { INITIAL_CREATORS, INITIAL_PROJECTS } from '../pages/OperationalPages';
import type { GeneratedInvoiceRecord } from '../types';
import {
  updateCreatorProjectCounts,
  upsertGeneratedInvoiceEngagements,
} from './invoiceEngagements';

const creator = { ...INITIAL_CREATORS[0], projects: 0 };
const sourceProject = INITIAL_PROJECTS[0];
const project = {
  ...sourceProject,
  creators: 0,
  creatorProfiles: [],
  invoiceCount: 0,
};
const projectId = (project.cooperationProjectId ?? project.projectId ?? project.id) as ProjectId;
const engagementId = 'engagement_new_invoice_relation' as EngagementId;

const record: GeneratedInvoiceRecord = {
  id: 'INV-RELATION-TEST',
  invoiceId: 'invoice_relation_test' as InvoiceId,
  sourcePayoutId: 'payout_relation_test',
  status: '待签署',
  generatedAt: '2026-08-11T09:00:00.000Z',
  validationStatus: 'valid',
  snapshot: {
    invoiceNumber: 'INV-RELATION-TEST',
    invoiceDate: '2026-08-11',
    billTo: { name: 'COMETS', address: 'Hong Kong' },
    creatorHandle: creator.handle,
    creatorName: creator.name,
    creatorId: creator.id as CreatorId,
    engagementId,
    projectId,
    cooperationProjectId: projectId,
    projectName: project.name,
    contractIds: [],
    from: { ...creator.contact },
    currency: 'USD',
    items: [{ id: 'line-one', description: 'Creator service', unitPrice: 100, quantity: 1, lineTotal: 100 }],
    paymentMethod: 'bank',
    payment: {
      bankCountry: 'US', accountName: creator.contact.legalName, accountType: '', swiftCode: '',
      accountNumber: '0001', iban: '', beneficiaryType: '', bankName: '', bankStreetAddress: '',
      bankCity: '', bankState: '', bankPostalCode: '', intermediaryBankCountry: '',
      intermediaryBankCode: '', transferRemarks: '', paypalUsername: '', paypalEmail: '',
    },
  },
};

describe('generated Invoice engagement persistence', () => {
  it('keeps a creator unlinked until the generated record is committed', () => {
    expect(project.creatorProfiles).toEqual([]);

    const updatedProjects = upsertGeneratedInvoiceEngagements({
      projects: [project],
      creators: [creator],
      records: [record],
      occurredAt: '2026-08-11T09:01:00.000Z',
    });
    const reference = updatedProjects[0].creatorProfiles?.[0];

    expect(reference).toMatchObject({
      creatorId: creator.id,
      engagementId,
      projectId,
      status: 'active',
    });
    expect(updateCreatorProjectCounts([creator], updatedProjects)[0].projects).toBe(1);
  });

  it('reuses the same creator-project relationship without adding a duplicate', () => {
    const once = upsertGeneratedInvoiceEngagements({
      projects: [project],
      creators: [creator],
      records: [record],
      occurredAt: '2026-08-11T09:01:00.000Z',
    });
    const twice = upsertGeneratedInvoiceEngagements({
      projects: once,
      creators: [creator],
      records: [record],
      existingInvoices: [record],
      occurredAt: '2026-08-11T09:02:00.000Z',
    });

    expect(twice[0].creatorProfiles).toHaveLength(1);
    expect(twice[0].creatorProfiles?.[0].engagementId).toBe(engagementId);
    expect(twice[0].invoiceCount).toBe(1);
  });

  it('resolves an existing engagement from Invoice history even without a project roster', () => {
    expect(findExistingEngagementId({
      project,
      creatorId: creator.id as CreatorId,
      contracts: [],
      invoices: [record],
    })).toBe(engagementId);
  });
});
