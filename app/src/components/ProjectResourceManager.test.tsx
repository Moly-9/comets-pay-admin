import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  getContractInvoiceRelation,
  getProjectLinkOptions,
  isContractInvoiceSelectable,
  prepareInvoiceForProjectUpdate,
  ProjectResourceManager,
  toggleInvoiceContractId,
} from './ProjectResourceManager';
import type {
  ContractId,
  CreatorId,
  EngagementId,
  InvoiceId,
  PaymentListId,
  ProjectId,
} from '../businessWorkflow';
import type { ContractRecord } from '../contracts';
import type { SystemUser } from '../data';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type { GeneratedInvoiceRecord } from '../types';

const projectId = 'project-test' as ProjectId;
const creatorOneId = 'creator-one' as CreatorId;
const creatorTwoId = 'creator-two' as CreatorId;
const engagementOneId = 'engagement-one' as EngagementId;
const engagementTwoId = 'engagement-two' as EngagementId;
const contractOneId = 'contract-one' as ContractId;
const contractTwoId = 'contract-two' as ContractId;
const contractThreeId = 'contract-three' as ContractId;

const project: ProjectSummary = {
  id: 'PRJ-20260805-TEST01',
  projectId,
  projectCode: 'PRJ-20260805-TEST01',
  name: 'Synthetic Campaign',
  brand: 'Synthetic Brand',
  media: 'Media User',
  pm: 'PM User',
  creators: 2,
  budget: 'USD 800',
  status: '进行中',
  reviewStatus: 'draft',
  creatorProfiles: [
    {
      creatorId: creatorOneId,
      engagementId: engagementOneId,
      projectId,
      name: 'Creator One',
      handle: '@creator-one',
      platform: 'YouTube',
    },
    {
      creatorId: creatorTwoId,
      engagementId: engagementTwoId,
      projectId,
      name: 'Creator Two',
      handle: '@creator-two',
      platform: 'TikTok',
    },
  ],
};

const contract = ({
  contractId,
  engagementId,
  creatorId,
  id,
  projectId: targetProjectId = projectId,
  lifecycle = 'CONFIRMED',
}: {
  contractId: ContractId;
  engagementId?: EngagementId;
  creatorId: CreatorId;
  id: string;
  projectId?: ProjectId;
  lifecycle?: ContractRecord['lifecycle'];
}): ContractRecord => ({
  contractId,
  id,
  ioId: `IO-${id}`,
  name: `${id} Creator Agreement`,
  templateFamily: 'Synthetic template',
  sourceName: `${id}.pdf`,
  documentUrl: '',
  isTemplate: false,
  project: project.name,
  brand: project.brand,
  advertiser: 'Synthetic Advertiser Limited',
  publisher: 'Synthetic Creator Limited',
  channelName: 'Synthetic Channel',
  channelLink: 'https://example.com/channel',
  platform: 'YouTube',
  effectiveDate: '2026-08-01',
  campaignStart: '2026-08-01',
  campaignEnd: '2026-08-31',
  currency: 'USD',
  totalFee: id.endsWith('01') ? 300 : 200,
  licensePrice: null,
  licenseIncludedInTotal: null,
  invoiceWithinWorkingDays: 5,
  paymentWithinWorkingDays: 30,
  feeBearer: 'ADVERTISER',
  paymentMethod: 'BANK',
  accountName: 'Synthetic Creator Limited',
  accountFingerprint: '0001',
  signed: true,
  status: '已生效',
  updated: '2026-08-05',
  deliverables: [],
  issues: [],
  projectId: targetProjectId,
  creatorId,
  engagementId,
  lifecycle,
});

const invoice = ({
  invoiceId,
  engagementId,
  creatorId,
  contractIds = [],
  amount = 500,
}: {
  invoiceId: InvoiceId;
  engagementId?: EngagementId;
  creatorId: CreatorId;
  contractIds?: ContractId[];
  amount?: number;
}): GeneratedInvoiceRecord => ({
  id: `INV-${invoiceId}`,
  invoiceId,
  sourcePayoutId: 'synthetic-source',
  status: '待媒介审核',
  generatedAt: '2026-08-05T00:00:00.000Z',
  validationStatus: 'valid',
  snapshot: {
    invoiceNumber: `INV-${invoiceId}`,
    invoiceDate: '2026-08-05',
    billTo: { name: 'Synthetic Advertiser Limited', address: 'Synthetic address' },
    creatorHandle: '@synthetic',
    creatorName: creatorId === creatorOneId ? 'Creator One' : 'Creator Two',
    creatorId,
    engagementId,
    projectId,
    projectName: project.name,
    contractIds,
    from: {
      legalName: 'Synthetic Creator Limited',
      address: 'Synthetic creator address',
      phone: '+1 202 555 0100',
      email: 'creator@example.com',
    },
    currency: 'USD',
    items: [{
      id: 'line-one',
      description: 'Synthetic deliverable',
      unitPrice: amount,
      quantity: 1,
      lineTotal: amount,
    }],
    paymentMethod: 'bank',
    payment: {
      bankCountry: 'US',
      accountName: 'Synthetic Creator Limited',
      accountType: 'Business',
      swiftCode: 'TESTUS00',
      accountNumber: '0000000001',
      iban: '',
      beneficiaryType: 'Company',
      bankName: 'Synthetic Bank',
      bankStreetAddress: 'Synthetic street',
      bankCity: 'New York',
      bankState: 'NY',
      bankPostalCode: '10001',
      intermediaryBankCountry: '',
      intermediaryBankCode: '',
      transferRemarks: '',
      paypalUsername: '',
      paypalEmail: '',
    },
  },
});

const admin: SystemUser = {
  account: 'admin.test',
  name: 'Admin Test',
  email: 'admin@example.com',
  initials: 'AT',
  roleKey: 'admin',
  role: '管理员账号',
};

const contractOne = contract({
  contractId: contractOneId,
  engagementId: engagementOneId,
  creatorId: creatorOneId,
  id: 'CON-TEST-01',
});
const contractTwo = contract({
  contractId: contractTwoId,
  engagementId: engagementOneId,
  creatorId: creatorOneId,
  id: 'CON-TEST-02',
});
const contractThree = contract({
  contractId: contractThreeId,
  engagementId: engagementTwoId,
  creatorId: creatorTwoId,
  id: 'CON-TEST-03',
});
const invoiceOne = invoice({
  invoiceId: 'invoice-one' as InvoiceId,
  engagementId: engagementOneId,
  creatorId: creatorOneId,
  contractIds: [contractOneId],
});
const crossProjectLinkedContract = contract({
  contractId: 'contract-cross-project-linked' as ContractId,
  engagementId: engagementOneId,
  creatorId: creatorOneId,
  id: 'CON-CROSS-PROJECT-LINKED',
  projectId: 'other-project' as ProjectId,
});
const crossCreatorLinkedContract = contract({
  contractId: 'contract-cross-creator-linked' as ContractId,
  engagementId: engagementOneId,
  creatorId: creatorTwoId,
  id: 'CON-CROSS-CREATOR-LINKED',
});
const crossProjectLinkedInvoice = {
  ...invoice({
    invoiceId: 'invoice-cross-project-linked' as InvoiceId,
    engagementId: engagementOneId,
    creatorId: creatorOneId,
  }),
  snapshot: {
    ...invoiceOne.snapshot,
    projectId: 'other-project' as ProjectId,
  },
};
const crossCreatorLinkedInvoice = {
  ...invoice({
    invoiceId: 'invoice-cross-creator-linked' as InvoiceId,
    engagementId: engagementOneId,
    creatorId: creatorTwoId,
  }),
  snapshot: {
    ...invoiceOne.snapshot,
    creatorId: creatorTwoId,
  },
};

describe('project resource aggregation', () => {
  it('renders three compact resource rows with project totals', () => {
    const html = renderToStaticMarkup(
      <ProjectResourceManager
        project={project}
        creators={[]}
        contracts={[
          contractOne,
          contractTwo,
          contractThree,
          crossProjectLinkedContract,
          crossCreatorLinkedContract,
        ]}
        invoices={[invoiceOne, crossProjectLinkedInvoice, crossCreatorLinkedInvoice]}
        paymentList={{
          paymentListId: 'payment-list-one' as PaymentListId,
          paymentListCode: 'PAY-20260805-TEST01',
          projectId,
          status: 'draft',
          items: [{
            id: 'payment-item-one',
            engagementId: engagementOneId,
            invoiceId: invoiceOne.invoiceId,
            snapshot: {
              invoiceNumber: invoiceOne.id,
              creatorName: 'Creator One',
              currency: 'USD',
              receiveCurrency: 'USD',
              amount: 500,
              provider: 'Airwallex',
              accountSummary: '账户尾号 0001',
              paymentReason: '影音服务',
              transactionReference: invoiceOne.id,
              description: 'Synthetic payment',
            },
            overrides: {},
          }],
          createdAt: '2026-08-05T00:00:00.000Z',
          updatedAt: '2026-08-05T00:00:00.000Z',
        }}
        auditEvents={[]}
        currentUser={admin}
        onOpenContract={vi.fn()}
        onOpenInvoice={vi.fn()}
        onCreateContract={vi.fn()}
        onCreateInvoice={vi.fn()}
        onLinkContract={vi.fn()}
        onUnlinkContract={vi.fn()}
        onDeleteContract={vi.fn()}
        onLinkInvoice={vi.fn()}
        onUnlinkInvoice={vi.fn()}
        onDeleteInvoice={vi.fn()}
        onUpdateInvoice={vi.fn()}
        onCreatePaymentList={vi.fn()}
        onDeletePaymentList={vi.fn()}
        onAddPaymentInvoice={vi.fn()}
        onRemovePaymentInvoice={vi.fn()}
        onUpdatePaymentItem={vi.fn()}
        onChangePaymentAccount={vi.fn()}
        onExportPaymentList={vi.fn()}
        onSubmitReview={vi.fn()}
      />,
    );

    expect(html.match(/project-resource-summary-row/g)).toHaveLength(3);
    expect(html).toContain('3 份合同');
    expect(html).toContain('覆盖 2 位达人 · 1 份已被 Invoice 覆盖');
    expect(html).toContain('1 份 Invoice');
    expect(html).toContain('项目金额 USD 500');
    expect(html).toContain('PAY-20260805-TEST01');
    expect(html).not.toContain('CON-CROSS-PROJECT-LINKED');
    expect(html).not.toContain('CON-CROSS-CREATOR-LINKED');
    expect(html).not.toContain(engagementOneId);
  });
});

describe('contract and Invoice relationships', () => {
  it('distinguishes covered, same-engagement not covered, and missing Invoice states', () => {
    expect(getContractInvoiceRelation(contractOne, [invoiceOne]).state).toBe('covered');
    expect(getContractInvoiceRelation(contractTwo, [invoiceOne]).state).toBe('not-covered');
    expect(getContractInvoiceRelation(contractThree, [invoiceOne]).state).toBe('missing');
  });

  it('allows only confirmed contracts to be newly selected by an Invoice', () => {
    expect(isContractInvoiceSelectable(contractOne)).toBe(true);
    expect(isContractInvoiceSelectable({
      ...contractTwo,
      signed: false,
      lifecycle: 'UPLOADED_PENDING_CONFIRMATION',
    })).toBe(false);
  });

  it('updates contract coverage explicitly and marks the Invoice for revalidation', () => {
    const added = toggleInvoiceContractId(invoiceOne.snapshot.contractIds, contractTwoId);
    expect(added).toEqual([contractOneId, contractTwoId]);
    expect(toggleInvoiceContractId(added, contractOneId)).toEqual([contractTwoId]);

    const updated = prepareInvoiceForProjectUpdate({
      ...invoiceOne,
      snapshot: { ...invoiceOne.snapshot, contractIds: added },
    });
    expect(updated.snapshot.contractIds).toEqual([contractOneId, contractTwoId]);
    expect(updated.validationStatus).toBe('needs_review');
  });
});

describe('project resource link candidates', () => {
  it('filters contracts by stable project and creator relationships', () => {
    const eligible = contract({
      contractId: 'eligible-contract' as ContractId,
      creatorId: creatorOneId,
      id: 'CON-ELIGIBLE',
    });
    const crossProject = contract({
      contractId: 'cross-project' as ContractId,
      creatorId: creatorOneId,
      id: 'CON-CROSS-PROJECT',
      projectId: 'other-project' as ProjectId,
    });
    const unknownCreator = contract({
      contractId: 'unknown-creator' as ContractId,
      creatorId: 'unknown-creator' as CreatorId,
      id: 'CON-UNKNOWN-CREATOR',
    });

    const options = getProjectLinkOptions({
      kind: 'contract',
      project,
      references: project.creatorProfiles ?? [],
      contracts: [eligible, crossProject, unknownCreator, contractOne],
      invoices: [invoiceOne],
    });

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      value: eligible.contractId,
      engagementId: engagementOneId,
    });
    expect(options[0].label).toContain(eligible.ioId);
    expect(options[0].description).toContain('Creator One');
  });

  it('excludes an unlinked Invoice when that engagement already has another Invoice', () => {
    const unlinkedForCreatorOne = invoice({
      invoiceId: 'invoice-unlinked-one' as InvoiceId,
      creatorId: creatorOneId,
    });
    const unlinkedForCreatorTwo = invoice({
      invoiceId: 'invoice-unlinked-two' as InvoiceId,
      creatorId: creatorTwoId,
    });

    const options = getProjectLinkOptions({
      kind: 'invoice',
      project,
      references: project.creatorProfiles ?? [],
      contracts: [],
      invoices: [invoiceOne, unlinkedForCreatorOne, unlinkedForCreatorTwo],
    });

    expect(options.map((option) => option.value)).toEqual([unlinkedForCreatorTwo.invoiceId]);
    expect(options[0].engagementId).toBe(engagementTwoId);
  });
});
