import { describe, expect, it } from 'vitest';
import type { ContractAdvertiserEntityId } from './businessWorkflow';
import {
  addContractAdvertiserEntity,
  defaultContractAdvertiserEntity,
  findContractAdvertiserEntityForSnapshot,
  removeContractAdvertiserEntity,
  setDefaultContractAdvertiserEntity,
  updateContractAdvertiserEntity,
  validateContractAdvertiserEntity,
} from './contractAdvertiserEntities';
import type { ContractAdvertiserSettings } from './types';

const primaryId = 'cae_primary' as ContractAdvertiserEntityId;
const secondaryId = 'cae_secondary' as ContractAdvertiserEntityId;

const settings = (): ContractAdvertiserSettings => ({
  entities: [
    { id: primaryId, name: 'Primary Limited', address: '1 Primary Road' },
    { id: secondaryId, name: 'Secondary Limited', address: '2 Secondary Road' },
  ],
  defaultEntityId: primaryId,
});

describe('contract advertiser entities', () => {
  it('validates required fields, limits and normalized duplicates', () => {
    expect(validateContractAdvertiserEntity({ name: '', address: '' }, settings().entities)).toEqual({
      name: '请填写 Advertiser 公司名称',
      address: '请填写 Advertiser 地址',
    });
    expect(validateContractAdvertiserEntity({
      name: 'x'.repeat(101),
      address: 'x'.repeat(501),
    }, settings().entities)).toEqual({
      name: 'Advertiser 公司名称不能超过 100 个字符',
      address: 'Advertiser 地址不能超过 500 个字符',
    });
    expect(validateContractAdvertiserEntity({
      name: ' primary   limited ',
      address: ' 1 primary road ',
    }, settings().entities)).toMatchObject({ duplicate: expect.any(String) });
    expect(validateContractAdvertiserEntity({
      name: 'Primary Limited',
      address: '1 Primary Road',
    }, settings().entities, primaryId)).toEqual({});
  });

  it('adds and updates trimmed entities without changing the other records', () => {
    const addedId = 'cae_added' as ContractAdvertiserEntityId;
    const added = addContractAdvertiserEntity(settings(), {
      id: addedId,
      name: ' Added Limited ',
      address: ' 3 Added Road ',
    });
    expect(added.entities[added.entities.length - 1]).toEqual({
      id: addedId,
      name: 'Added Limited',
      address: '3 Added Road',
    });

    const updated = updateContractAdvertiserEntity(added, {
      id: secondaryId,
      name: ' Secondary Updated ',
      address: ' 22 Secondary Road ',
    });
    expect(updated.entities[0]).toEqual(settings().entities[0]);
    expect(updated.entities[1]).toMatchObject({
      name: 'Secondary Updated',
      address: '22 Secondary Road',
    });
  });

  it('changes only to a valid default and protects the default and sole entity from deletion', () => {
    const original = settings();
    expect(setDefaultContractAdvertiserEntity(original, secondaryId).defaultEntityId).toBe(secondaryId);
    expect(setDefaultContractAdvertiserEntity(original, 'missing' as ContractAdvertiserEntityId)).toBe(original);
    expect(removeContractAdvertiserEntity(original, primaryId)).toBe(original);
    expect(removeContractAdvertiserEntity(original, secondaryId).entities).toHaveLength(1);

    const sole: ContractAdvertiserSettings = {
      entities: [original.entities[0]],
      defaultEntityId: primaryId,
    };
    expect(removeContractAdvertiserEntity(sole, primaryId)).toBe(sole);
    expect(defaultContractAdvertiserEntity(original)).toEqual(original.entities[0]);
  });

  it('matches only unchanged snapshots and treats legacy or edited entities as historical', () => {
    const original = settings();
    expect(findContractAdvertiserEntityForSnapshot(original, {
      advertiserEntityId: primaryId,
      advertiser: 'Primary Limited',
      advertiserAddress: '1 Primary Road',
    })).toEqual(original.entities[0]);
    expect(findContractAdvertiserEntityForSnapshot(original, {
      advertiserEntityId: primaryId,
      advertiser: 'Historic Primary Limited',
      advertiserAddress: '1 Primary Road',
    })).toBeUndefined();
    expect(findContractAdvertiserEntityForSnapshot(original, {
      advertiser: 'Primary Limited',
    })).toBeUndefined();
  });
});
