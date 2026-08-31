import { describe, expect, it } from 'vitest';
import type { CreatorProfile } from '../types';
import { resolveInvoiceCreatorIdentity } from './invoiceCreatorIdentity';

const creator = (overrides: Partial<CreatorProfile>): CreatorProfile => ({
  id: 'creator-default',
  name: 'Default Creator',
  handle: '@default',
  platform: 'Instagram',
  initials: 'DC',
  accent: '#64748b',
  region: '新加坡',
  projects: 1,
  socialAccounts: [{ id: 'social-default', handle: '@default', platform: 'Instagram', profileUrl: '' }],
  contact: { legalName: 'Default Creator', address: '', phone: '', email: '' },
  payoutAccounts: [],
  ...overrides,
});

describe('resolveInvoiceCreatorIdentity', () => {
  it('uses the stable creator ID before conflicting names or handles', () => {
    const target = creator({
      id: 'creator-target',
      name: 'Stable Creator',
      socialAccounts: [{ id: 'social-target', handle: '@stable', platform: 'YouTube', profileUrl: '' }],
    });
    const conflicting = creator({ id: 'creator-conflict', name: 'Legacy Name', handle: '@legacy' });
    const identity = resolveInvoiceCreatorIdentity({
      creators: [conflicting, target],
      source: { creatorId: target.id, creatorName: 'Legacy Name', creatorHandle: '@legacy' },
    });

    expect(identity.creator?.id).toBe(target.id);
    expect(identity.displayName).toBe('Stable Creator');
    expect(identity.channelId).toBe('@stable');
  });

  it('only uses exact legacy Handle matching when creatorId is absent', () => {
    const target = creator({
      id: 'creator-target',
      name: 'Legacy Creator',
      socialAccounts: [{ id: 'social-target', handle: '@exact-handle', platform: 'TikTok', profileUrl: '' }],
    });
    const identity = resolveInvoiceCreatorIdentity({
      creators: [target],
      source: { creatorHandle: '@exact-handle' },
    });

    expect(identity.creator?.id).toBe(target.id);
    expect(identity.socialAccounts).toHaveLength(1);
  });
});
