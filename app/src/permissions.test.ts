import { describe, expect, it } from 'vitest';
import { DEMO_SYSTEM_USERS } from './data';
import { canAccessPage, getDefaultPageForRole, hasPermission } from './permissions';

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
});
