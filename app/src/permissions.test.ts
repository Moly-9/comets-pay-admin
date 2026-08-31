import { describe, expect, it } from 'vitest';
import { INITIAL_CONTRACTS, type ContractRecord } from './contracts';
import { DEMO_SYSTEM_USERS } from './data';
import {
  canAccessPage,
  canDeleteContract,
  canDeleteContractSelection,
  canEditContractTemplate,
  getDefaultPageForRole,
  hasPermission,
} from './permissions';

const userFor = (role: 'media' | 'pm' | 'finance' | 'admin' | 'owner' | 'project') => {
  const user = DEMO_SYSTEM_USERS.find((candidate) => candidate.roleKey === role);
  if (!user) throw new Error(`Missing ${role} demo user`);
  return user;
};

describe('Invoice review permissions', () => {
  it('allows media and project owner to perform media review', () => {
    expect(hasPermission(userFor('media'), 'invoice_media_review')).toBe(true);
    expect(hasPermission(userFor('project'), 'invoice_media_review')).toBe(true);
  });

  it('allows finance to perform finance review only', () => {
    expect(hasPermission(userFor('finance'), 'invoice_finance_review')).toBe(true);
    expect(hasPermission(userFor('finance'), 'invoice_media_review')).toBe(false);
  });

  it('keeps PM read-only and allows admin and owner at both stages', () => {
    expect(hasPermission(userFor('pm'), 'invoice_media_review')).toBe(false);
    expect(hasPermission(userFor('pm'), 'invoice_finance_review')).toBe(false);
    expect(hasPermission(userFor('admin'), 'invoice_media_review')).toBe(true);
    expect(hasPermission(userFor('admin'), 'invoice_finance_review')).toBe(true);
    expect(hasPermission(userFor('owner'), 'invoice_media_review')).toBe(true);
    expect(hasPermission(userFor('owner'), 'invoice_finance_review')).toBe(true);
  });

  it('limits Invoice batch generation to Invoice managers', () => {
    expect(canAccessPage(userFor('media'), 'invoice-batch-create')).toBe(true);
    expect(canAccessPage(userFor('admin'), 'invoice-batch-create')).toBe(true);
    expect(canAccessPage(userFor('owner'), 'invoice-batch-create')).toBe(true);
    expect(canAccessPage(userFor('pm'), 'invoice-batch-create')).toBe(false);
    expect(canAccessPage(userFor('project'), 'invoice-batch-create')).toBe(false);
    expect(canAccessPage(userFor('finance'), 'invoice-batch-create')).toBe(false);
  });

  it('keeps personal payment projects with media while approval roles open the review workbench', () => {
    expect(canAccessPage(userFor('media'), 'projects')).toBe(true);
    expect(canAccessPage(userFor('pm'), 'projects')).toBe(false);
    expect(canAccessPage(userFor('project'), 'projects')).toBe(false);
    expect(getDefaultPageForRole('media')).toBe('projects');
    expect(getDefaultPageForRole('pm')).toBe('requests');
    expect(getDefaultPageForRole('project')).toBe('requests');
  });

  it('grants contract deletion capability to administrators, owners, project leads, and media', () => {
    expect(hasPermission(userFor('admin'), 'contract_delete')).toBe(true);
    expect(hasPermission(userFor('media'), 'contract_delete')).toBe(true);
    expect(hasPermission(userFor('owner'), 'contract_delete')).toBe(true);
    expect(hasPermission(userFor('pm'), 'contract_delete')).toBe(false);
    expect(hasPermission(userFor('finance'), 'contract_delete')).toBe(false);
    expect(hasPermission(userFor('project'), 'contract_delete')).toBe(true);
  });

  it('limits contract template editing to project owners, owners, and administrators', () => {
    expect(canEditContractTemplate(userFor('project'))).toBe(true);
    expect(canEditContractTemplate(userFor('owner'))).toBe(true);
    expect(canEditContractTemplate(userFor('admin'))).toBe(true);
    expect(canEditContractTemplate(userFor('media'))).toBe(false);
    expect(canEditContractTemplate(userFor('pm'))).toBe(false);
    expect(canEditContractTemplate(userFor('finance'))).toBe(false);
  });

  it('moves contract templates to the restricted system configuration page', () => {
    for (const role of ['project', 'owner', 'admin'] as const) {
      expect(canAccessPage(userFor(role), 'system-config')).toBe(true);
    }
    for (const role of ['media', 'pm', 'finance'] as const) {
      expect(canAccessPage(userFor(role), 'system-config')).toBe(false);
    }
    expect(canAccessPage(userFor('admin'), 'system-accounts')).toBe(true);
    expect(canAccessPage(userFor('owner'), 'system-accounts')).toBe(true);
    expect(canAccessPage(userFor('project'), 'system-accounts')).toBe(false);
    expect(canAccessPage(userFor('admin'), 'system-settings')).toBe(true);
  });

  it('lets privileged roles delete every contract and limits media to unused own uploads', () => {
    const media = userFor('media');
    const ownUpload: ContractRecord = { ...INITIAL_CONTRACTS[0], uploadedByAccount: media.account };
    const anotherUpload: ContractRecord = { ...INITIAL_CONTRACTS[0], uploadedByAccount: 'another.media' };
    const legacyContract: ContractRecord = { ...INITIAL_CONTRACTS[0], uploadedByAccount: undefined };

    expect(canDeleteContract(userFor('admin'), ownUpload)).toBe(true);
    expect(canDeleteContract(userFor('admin'), anotherUpload)).toBe(true);
    expect(canDeleteContract(userFor('admin'), legacyContract)).toBe(true);
    expect(canDeleteContract(media, ownUpload)).toBe(true);
    expect(canDeleteContract(media, anotherUpload)).toBe(false);
    expect(canDeleteContract(media, legacyContract)).toBe(false);
    expect(canDeleteContract(media, ownUpload, { usedInRequest: true })).toBe(false);
    expect(canDeleteContract(userFor('owner'), anotherUpload)).toBe(true);
    expect(canDeleteContract(userFor('project'), anotherUpload)).toBe(true);
    expect(canDeleteContract(userFor('pm'), ownUpload)).toBe(false);
    expect(canDeleteContractSelection(media, [ownUpload])).toBe(true);
    expect(canDeleteContractSelection(media, [ownUpload, anotherUpload])).toBe(false);
    expect(canDeleteContractSelection(media, [ownUpload], () => ({ usedInRequest: true }))).toBe(false);
    expect(canDeleteContractSelection(userFor('admin'), [ownUpload, anotherUpload, legacyContract])).toBe(true);
    expect(canDeleteContractSelection(userFor('owner'), [ownUpload, anotherUpload, legacyContract])).toBe(true);
    expect(canDeleteContractSelection(userFor('project'), [ownUpload, anotherUpload, legacyContract])).toBe(true);
  });
});
