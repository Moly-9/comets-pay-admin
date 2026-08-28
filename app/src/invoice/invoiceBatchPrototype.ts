import type { EngagementId, ProjectId } from '../businessWorkflow';
import {
  createAirwallexPayoutAccount,
  createPayPalPayoutAccount,
} from '../payoutAccounts';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type { CreatorProfile, GeneratedInvoiceRecord, InvoiceCurrency } from '../types';
import { demoAccountName } from '../demoCreatorNames';

export const INVOICE_BATCH_PROTOTYPE_CURRENCY = 'USD' as const;
export const INVOICE_BATCH_PROTOTYPE_DEMO_CURRENCY: InvoiceCurrency = 'EUR';
export const INVOICE_BATCH_PROTOTYPE_DEMO_DESCRIPTION = '海外创作者内容合作服务费（演示数据）';
export const INVOICE_BATCH_PROTOTYPE_ACCOUNT_LABEL = '默认空中云汇';
export const INVOICE_BATCH_PROTOTYPE_PAYPAL_LABEL = 'PayPal USD 原型账户';

const INVOICE_BATCH_PROTOTYPE_DEMO_VALUES = [
  { unitPrice: 1_680, quantity: 1, payoutProvider: 'Airwallex' },
  { unitPrice: 840, quantity: 2, payoutProvider: 'PayPal' },
  { unitPrice: 2_250, quantity: 1, payoutProvider: 'Airwallex' },
  { unitPrice: 610, quantity: 3, payoutProvider: 'PayPal' },
  { unitPrice: 2_980, quantity: 1, payoutProvider: 'Airwallex' },
] as const;

type ProjectCreatorReference = NonNullable<ProjectSummary['creatorProfiles']>[number];

const prototypeAccountId = (creatorId: string) => `awx-batch-${creatorId}`;
const prototypePayPalAccountId = (creatorId: string) => `paypal-batch-${creatorId}`;

const prototypeAccountSuffix = (creatorId: string) => {
  const suffix = [...creatorId].reduce(
    (result, character) => (result * 31 + character.charCodeAt(0)) % 10000,
    0,
  );
  return String(suffix).padStart(4, '0');
};

const prototypeAccountNumber = (creatorId: string) => `000000${prototypeAccountSuffix(creatorId)}`;

export const withInvoiceBatchPrototypeAccounts = (
  creators: CreatorProfile[],
): CreatorProfile[] => creators.map((creator) => {
  const [firstName = '', ...lastNameParts] = creator.contact.legalName.trim().split(/\s+/);
  const payoutAccountId = prototypeAccountId(creator.id);
  const paypalAccountId = prototypePayPalAccountId(creator.id);
  const accountSuffix = prototypeAccountSuffix(creator.id);
  const payoutAccounts = creator.payoutAccounts
    .filter((account) => (
      ![payoutAccountId, paypalAccountId].includes(account.payoutAccountId ?? '')
      && ![payoutAccountId, paypalAccountId].includes(account.id)
    ))
    .map((account) => ({ ...account, isDefault: false }));

  return {
    ...creator,
    payoutAccounts: [
      createAirwallexPayoutAccount({
        id: payoutAccountId,
        creatorId: creator.id,
        payoutAccountId,
        payoutAccountVersion: 'v1',
        providerAccountScope: 'prototype:batch-invoice',
        nickname: INVOICE_BATCH_PROTOTYPE_ACCOUNT_LABEL,
        isDefault: true,
        status: 'VERIFIED',
        beneficiaryId: `bene_batch_${creator.id}`,
        beneficiaryEnvironment: 'MOCK',
        entityType: 'PERSONAL',
        firstName,
        lastName: lastNameParts.join(' '),
        notificationEmail: creator.contact.email,
        address: {
          countryCode: 'US',
          streetAddress: '100 Prototype Avenue',
          city: 'New York',
          state: 'New York',
          postcode: '10001',
        },
        transferMethod: 'LOCAL',
        bankDetails: {
          bankCountryCode: 'US',
          bankCountryName: 'United States',
          accountCurrency: INVOICE_BATCH_PROTOTYPE_CURRENCY,
          accountName: demoAccountName(creator.contact.legalName),
          accountNumber: prototypeAccountNumber(creator.id),
          bankAccountCategory: 'Checking',
          accountRoutingType1: 'aba',
          accountRoutingValue1: '000000000',
          localClearingSystem: 'ACH',
          bankName: 'Airwallex Prototype Bank',
          bankStreetAddress: '100 Prototype Avenue, New York, NY 10001',
        },
        verificationCode: 'VERIFIED',
        nameMatchResult: 'FULL_MATCH',
        validatedAt: '2026-08-06 09:00',
        verifiedAt: '2026-08-06 09:01',
      }),
      createPayPalPayoutAccount({
        id: paypalAccountId,
        creatorId: creator.id,
        payoutAccountId: paypalAccountId,
        payoutAccountVersion: 'v1',
        providerAccountScope: 'prototype:batch-invoice',
        nickname: INVOICE_BATCH_PROTOTYPE_PAYPAL_LABEL,
        isDefault: false,
        status: 'VERIFIED',
        paypalUsername: demoAccountName(`prototype_creator_${accountSuffix}`),
        paypalEmail: `invoice.prototype+${accountSuffix}@example.test`,
        transferNote: 'USD prototype payment information',
      }),
      ...payoutAccounts,
    ],
  };
});

export const filterInvoiceBatchCreatorReferences = (
  references: ProjectCreatorReference[],
  query: string,
) => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return references;
  return references.filter((reference) => (
    [reference.name, reference.handle, reference.platform]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
  ));
};

export const selectableInvoiceBatchEngagementIds = (
  references: ProjectCreatorReference[],
  _generatedInvoices: GeneratedInvoiceRecord[],
  limit: number,
): EngagementId[] => {
  return references
    .filter((reference) => (
      reference.status !== 'removed'
    ))
    .slice(0, limit)
    .map((reference) => reference.engagementId);
};

export type InvoiceBatchPrototypeSeed = {
  projectId: ProjectId;
  currency: InvoiceCurrency;
  description: string;
  rows: Array<{
    engagementId: EngagementId;
    unitPrice: number;
    quantity: number;
    payoutProvider: 'Airwallex' | 'PayPal';
  }>;
};

export const createInvoiceBatchPrototypeSeed = (
  projects: ProjectSummary[],
  generatedInvoices: GeneratedInvoiceRecord[],
  limit = INVOICE_BATCH_PROTOTYPE_DEMO_VALUES.length,
): InvoiceBatchPrototypeSeed | null => {
  const candidate = projects.reduce<{
    projectId: ProjectId;
    engagementIds: EngagementId[];
  } | null>((best, project) => {
    const projectId = (
      project.cooperationProjectId ?? project.projectId ?? project.id
    ) as ProjectId;
    const engagementIds = selectableInvoiceBatchEngagementIds(
      project.creatorProfiles ?? [],
      generatedInvoices,
      Math.min(limit, INVOICE_BATCH_PROTOTYPE_DEMO_VALUES.length),
    );
    return !best || engagementIds.length > best.engagementIds.length
      ? { projectId, engagementIds }
      : best;
  }, null);

  if (!candidate?.engagementIds.length) return null;

  return {
    projectId: candidate.projectId,
    currency: INVOICE_BATCH_PROTOTYPE_DEMO_CURRENCY,
    description: INVOICE_BATCH_PROTOTYPE_DEMO_DESCRIPTION,
    rows: candidate.engagementIds.map((engagementId, index) => ({
      engagementId,
      ...INVOICE_BATCH_PROTOTYPE_DEMO_VALUES[index],
    })),
  };
};
