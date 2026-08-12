import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  getContractInvoiceRelation,
  getProjectLinkOptions,
  ProjectResourceManager,
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
        paymentLists={[{
          paymentListId: 'payment-list-one' as PaymentListId,
          paymentListCode: 'PAY-20260805-TEST01',
          projectId,
          provider: 'Airwallex',
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
        }]}
        auditEvents={[]}
        currentUser={admin}
        onOpenContract={vi.fn()}
        onOpenInvoice={vi.fn()}
        onCreateInvoice={vi.fn()}
        onLinkContract={vi.fn()}
        onUnlinkContract={vi.fn()}
        onDeleteContract={vi.fn()}
        onLinkInvoice={vi.fn()}
        onUnlinkInvoice={vi.fn()}
        onDeleteInvoice={vi.fn()}
        onCreatePaymentList={vi.fn()}
        onDeletePaymentList={vi.fn()}
        onAddPaymentInvoice={vi.fn()}
        onRemovePaymentInvoice={vi.fn()}
        onUpdatePaymentItem={vi.fn()}
        onChangePaymentAccount={vi.fn()}
        onGeneratePaymentOrder={vi.fn(() => null)}
        onEditPaymentOrder={vi.fn()}
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
    expect(html).toContain('1 笔达人付款');
    expect(html).not.toContain('CON-CROSS-PROJECT-LINKED');
    expect(html).not.toContain('CON-CROSS-CREATOR-LINKED');
    expect(html).not.toContain(engagementOneId);
  });

  it('uses the system modal flow instead of a native confirm for removing a payment row', () => {
    const source = readFileSync(new URL('./ProjectResourceManager.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('window.confirm(`确认从付款清单移除');
    expect(source).toContain('title="确认移除付款行"');
    expect(source).toContain('仅从当前付款清单移除这笔付款行，Invoice 源记录会保留。');
    expect(source).toContain('setRemovePaymentInvoiceId(null)');
  });

  it('keeps account selection on each payment row and removes channel tabs', () => {
    const source = readFileSync(new URL('./ProjectResourceManager.tsx', import.meta.url), 'utf8');
    expect(source).toContain('默认继承 Invoice 冻结账户');
    expect(source).toContain('onChangePaymentAccount(item.invoiceId, value)');
    expect(source).toContain('data-payment-provider-warning="true"');
    expect(source).toContain('getPayoutAccountSelectPresentation(account)');
    expect(source).toContain('menuClassName="payout-account-select-menu"');
    expect(source).toContain('menuStrategy="fixed"');
    expect(source).not.toContain('project-payment-channel-tabs');
    expect(source).not.toContain('补齐渠道清单');
  });

  it('uses controlled dropdowns for both payment currencies', () => {
    const source = readFileSync(new URL('./ProjectResourceManager.tsx', import.meta.url), 'utf8');
    expect(source).toContain('ariaLabel={`${item.snapshot.creatorName} 支付币种`}');
    expect(source).toContain('ariaLabel={`${item.snapshot.creatorName} 收款币种`}');
    expect(source.match(/options=\{PAYMENT_CURRENCY_OPTIONS\}/g)).toHaveLength(2);
    expect(source).not.toContain("'currency', event.target.value.toUpperCase()");
    expect(source).not.toContain("'receiveCurrency', event.target.value.toUpperCase()");
  });

  it('removes contract generation and Invoice editing only from project details', () => {
    const source = readFileSync(new URL('./ProjectResourceManager.tsx', import.meta.url), 'utf8');
    const contractsPage = readFileSync(new URL('../pages/ContractsPage.tsx', import.meta.url), 'utf8');
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain("openCreateDialog('contract')");
    expect(source).not.toContain('openInvoiceEditor');
    expect(source).not.toContain('编辑 Invoice ·');
    expect(contractsPage).toContain('>生成合同</Button>');
    expect(app).toContain('const openInvoiceEditor =');
  });
});

describe('contract and Invoice relationships', () => {
  it('distinguishes covered, same-engagement not covered, and missing Invoice states', () => {
    expect(getContractInvoiceRelation(contractOne, [invoiceOne]).state).toBe('covered');
    expect(getContractInvoiceRelation(contractTwo, [invoiceOne]).state).toBe('not-covered');
    expect(getContractInvoiceRelation(contractThree, [invoiceOne]).state).toBe('missing');
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
