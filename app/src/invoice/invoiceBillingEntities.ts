import type { InvoiceBillingEntityId } from '../businessWorkflow';
import type {
  InvoiceBillingEntity,
  InvoiceBillingSettings,
  InvoiceEntity,
} from '../types';

export type InvoiceBillingEntityDraft = Pick<InvoiceBillingEntity, 'name' | 'address'>;

export type InvoiceBillingEntityErrors = Partial<Record<'name' | 'address' | 'duplicate', string>>;

const normalizedText = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export const validateInvoiceBillingEntity = (
  draft: InvoiceBillingEntityDraft,
  entities: InvoiceBillingEntity[],
  editingId?: InvoiceBillingEntityId,
): InvoiceBillingEntityErrors => {
  const errors: InvoiceBillingEntityErrors = {};
  const name = draft.name.trim();
  const address = draft.address.trim();
  if (!name) errors.name = '请填写 Bill To 公司名称';
  else if (name.length > 100) errors.name = 'Bill To 公司名称不能超过 100 个字符';
  if (!address) errors.address = '请填写 Bill To 地址';
  else if (address.length > 500) errors.address = 'Bill To 地址不能超过 500 个字符';
  if (
    name
    && address
    && entities.some((entity) => (
      entity.id !== editingId
      && normalizedText(entity.name) === normalizedText(name)
      && normalizedText(entity.address) === normalizedText(address)
    ))
  ) {
    errors.duplicate = '相同公司名称和地址的开票主体已存在';
  }
  return errors;
};

export const defaultInvoiceBillingEntity = (
  settings: InvoiceBillingSettings,
) => settings.entities.find((entity) => entity.id === settings.defaultEntityId)
  ?? settings.entities[0];

export const invoiceEntitySnapshot = (
  entity: InvoiceBillingEntity,
): InvoiceEntity => ({
  billingEntityId: entity.id,
  name: entity.name,
  address: entity.address,
});

export const findInvoiceBillingEntityForSnapshot = (
  settings: InvoiceBillingSettings,
  snapshot?: InvoiceEntity,
) => {
  if (!snapshot) return defaultInvoiceBillingEntity(settings);
  if (snapshot.billingEntityId) {
    const matchedById = settings.entities.find((entity) => entity.id === snapshot.billingEntityId);
    if (matchedById) return matchedById;
  }
  return settings.entities.find((entity) => (
    normalizedText(entity.name) === normalizedText(snapshot.name)
    && normalizedText(entity.address) === normalizedText(snapshot.address)
  ));
};

export const addInvoiceBillingEntity = (
  settings: InvoiceBillingSettings,
  entity: InvoiceBillingEntity,
): InvoiceBillingSettings => ({
  ...settings,
  entities: [...settings.entities, {
    ...entity,
    name: entity.name.trim(),
    address: entity.address.trim(),
  }],
});

export const updateInvoiceBillingEntity = (
  settings: InvoiceBillingSettings,
  entity: InvoiceBillingEntity,
): InvoiceBillingSettings => ({
  ...settings,
  entities: settings.entities.map((current) => current.id === entity.id ? {
    ...entity,
    name: entity.name.trim(),
    address: entity.address.trim(),
  } : current),
});

export const setDefaultInvoiceBillingEntity = (
  settings: InvoiceBillingSettings,
  defaultEntityId: InvoiceBillingEntityId,
): InvoiceBillingSettings => (
  settings.entities.some((entity) => entity.id === defaultEntityId)
    ? { ...settings, defaultEntityId }
    : settings
);

export const removeInvoiceBillingEntity = (
  settings: InvoiceBillingSettings,
  entityId: InvoiceBillingEntityId,
): InvoiceBillingSettings => {
  if (settings.entities.length <= 1 || entityId === settings.defaultEntityId) return settings;
  return {
    ...settings,
    entities: settings.entities.filter((entity) => entity.id !== entityId),
  };
};
