import type { ContractAdvertiserEntityId } from './businessWorkflow';
import type { ContractGenerationModel } from './contracts';
import type {
  ContractAdvertiserEntity,
  ContractAdvertiserSettings,
} from './types';

export const LEGACY_CONTRACT_ADVERTISER_ADDRESS = 'Unit 04-05, 16th Floor, The Broadway No. 54-62 Lockhart Road, Wanchai, Hong Kong';

export type ContractAdvertiserEntityDraft = Pick<ContractAdvertiserEntity, 'name' | 'address'>;

export type ContractAdvertiserEntityErrors = Partial<Record<'name' | 'address' | 'duplicate', string>>;

const normalizedText = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export const validateContractAdvertiserEntity = (
  draft: ContractAdvertiserEntityDraft,
  entities: ContractAdvertiserEntity[],
  editingId?: ContractAdvertiserEntityId,
): ContractAdvertiserEntityErrors => {
  const errors: ContractAdvertiserEntityErrors = {};
  const name = draft.name.trim();
  const address = draft.address.trim();
  if (!name) errors.name = '请填写 Advertiser 公司名称';
  else if (name.length > 100) errors.name = 'Advertiser 公司名称不能超过 100 个字符';
  if (!address) errors.address = '请填写 Advertiser 地址';
  else if (address.length > 500) errors.address = 'Advertiser 地址不能超过 500 个字符';
  if (
    name
    && address
    && entities.some((entity) => (
      entity.id !== editingId
      && normalizedText(entity.name) === normalizedText(name)
      && normalizedText(entity.address) === normalizedText(address)
    ))
  ) {
    errors.duplicate = '相同公司名称和地址的合同 Advertiser 主体已存在';
  }
  return errors;
};

export const defaultContractAdvertiserEntity = (
  settings: ContractAdvertiserSettings,
) => settings.entities.find((entity) => entity.id === settings.defaultEntityId)
  ?? settings.entities[0];

export const findContractAdvertiserEntityForSnapshot = (
  settings: ContractAdvertiserSettings,
  snapshot?: Pick<ContractGenerationModel, 'advertiserEntityId' | 'advertiser' | 'advertiserAddress'>,
) => {
  if (!snapshot?.advertiserAddress) return undefined;
  return settings.entities.find((entity) => (
    (!snapshot.advertiserEntityId || entity.id === snapshot.advertiserEntityId)
    && normalizedText(entity.name) === normalizedText(snapshot.advertiser)
    && normalizedText(entity.address) === normalizedText(snapshot.advertiserAddress ?? '')
  ));
};

export const addContractAdvertiserEntity = (
  settings: ContractAdvertiserSettings,
  entity: ContractAdvertiserEntity,
): ContractAdvertiserSettings => ({
  ...settings,
  entities: [...settings.entities, {
    ...entity,
    name: entity.name.trim(),
    address: entity.address.trim(),
  }],
});

export const updateContractAdvertiserEntity = (
  settings: ContractAdvertiserSettings,
  entity: ContractAdvertiserEntity,
): ContractAdvertiserSettings => ({
  ...settings,
  entities: settings.entities.map((current) => current.id === entity.id ? {
    ...entity,
    name: entity.name.trim(),
    address: entity.address.trim(),
  } : current),
});

export const setDefaultContractAdvertiserEntity = (
  settings: ContractAdvertiserSettings,
  defaultEntityId: ContractAdvertiserEntityId,
): ContractAdvertiserSettings => (
  settings.entities.some((entity) => entity.id === defaultEntityId)
    ? { ...settings, defaultEntityId }
    : settings
);

export const removeContractAdvertiserEntity = (
  settings: ContractAdvertiserSettings,
  entityId: ContractAdvertiserEntityId,
): ContractAdvertiserSettings => {
  if (settings.entities.length <= 1 || entityId === settings.defaultEntityId) return settings;
  return {
    ...settings,
    entities: settings.entities.filter((entity) => entity.id !== entityId),
  };
};
