import { describe, expect, it } from 'vitest';
import type { InvoiceBillingEntityId } from '../businessWorkflow';
import type { InvoiceBillingSettings } from '../types';
import {
  addInvoiceBillingEntity,
  defaultInvoiceBillingEntity,
  findInvoiceBillingEntityForSnapshot,
  invoiceEntitySnapshot,
  removeInvoiceBillingEntity,
  setDefaultInvoiceBillingEntity,
  updateInvoiceBillingEntity,
  validateInvoiceBillingEntity,
} from './invoiceBillingEntities';

const primaryId = 'ibe_primary' as InvoiceBillingEntityId;
const secondaryId = 'ibe_secondary' as InvoiceBillingEntityId;
const settings = (): InvoiceBillingSettings => ({
  entities: [
    { id: primaryId, name: 'Comets Primary Ltd.', address: 'Hong Kong' },
    { id: secondaryId, name: 'Comets US Inc.', address: 'New York, United States' },
  ],
  defaultEntityId: primaryId,
});

describe('invoice billing entity settings', () => {
  it('resolves the unique default and ignores an unknown default id', () => {
    expect(defaultInvoiceBillingEntity(settings())?.id).toBe(primaryId);
    expect(setDefaultInvoiceBillingEntity(settings(), 'ibe_unknown' as InvoiceBillingEntityId))
      .toEqual(settings());
    expect(setDefaultInvoiceBillingEntity(settings(), secondaryId).defaultEntityId).toBe(secondaryId);
  });

  it('validates required fields, limits, and normalized duplicate values', () => {
    expect(validateInvoiceBillingEntity({ name: '', address: '' }, settings().entities)).toMatchObject({
      name: expect.any(String),
      address: expect.any(String),
    });
    expect(validateInvoiceBillingEntity({ name: 'N'.repeat(101), address: 'A'.repeat(501) }, settings().entities))
      .toMatchObject({ name: expect.any(String), address: expect.any(String) });
    expect(validateInvoiceBillingEntity(
      { name: '  COMETS   PRIMARY LTD. ', address: ' hong kong ' },
      settings().entities,
    ).duplicate).toBeTruthy();
    expect(validateInvoiceBillingEntity(
      { name: 'Comets Primary Ltd.', address: 'Hong Kong' },
      settings().entities,
      primaryId,
    )).toEqual({});
  });

  it('adds and edits trimmed entity data without changing the default', () => {
    const addedId = 'ibe_added' as InvoiceBillingEntityId;
    const added = addInvoiceBillingEntity(settings(), {
      id: addedId,
      name: '  Comets Europe GmbH  ',
      address: '  Berlin, Germany  ',
    });
    expect(added.defaultEntityId).toBe(primaryId);
    expect(added.entities[added.entities.length - 1]).toEqual({
      id: addedId,
      name: 'Comets Europe GmbH',
      address: 'Berlin, Germany',
    });

    const updated = updateInvoiceBillingEntity(added, {
      id: addedId,
      name: ' Comets Europe SE ',
      address: ' Munich, Germany ',
    });
    expect(updated.entities[updated.entities.length - 1]?.name).toBe('Comets Europe SE');
    expect(updated.defaultEntityId).toBe(primaryId);
  });

  it('prevents deleting the default or only entity and permits deleting a secondary entity', () => {
    expect(removeInvoiceBillingEntity(settings(), primaryId)).toEqual(settings());
    expect(removeInvoiceBillingEntity({
      entities: [settings().entities[0]],
      defaultEntityId: primaryId,
    }, primaryId)).toEqual({
      entities: [settings().entities[0]],
      defaultEntityId: primaryId,
    });
    expect(removeInvoiceBillingEntity(settings(), secondaryId).entities.map((entity) => entity.id))
      .toEqual([primaryId]);
  });

  it('freezes a source id snapshot and falls back to matching historical name and address', () => {
    const snapshot = invoiceEntitySnapshot(settings().entities[1]);
    expect(snapshot).toEqual({
      billingEntityId: secondaryId,
      name: 'Comets US Inc.',
      address: 'New York, United States',
    });
    expect(findInvoiceBillingEntityForSnapshot(settings(), snapshot)?.id).toBe(secondaryId);
    expect(findInvoiceBillingEntityForSnapshot(settings(), {
      name: ' comets primary ltd. ',
      address: 'HONG KONG',
    })?.id).toBe(primaryId);
    expect(findInvoiceBillingEntityForSnapshot(settings(), {
      billingEntityId: 'ibe_deleted' as InvoiceBillingEntityId,
      name: 'Deleted Entity',
      address: 'Historical Address',
    })).toBeUndefined();
  });
});
