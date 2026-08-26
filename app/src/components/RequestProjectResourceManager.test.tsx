import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ContractId, CreatorId, EngagementId, InvoiceId } from '../businessWorkflow';
import type { ContractRecord } from '../contracts';
import type { SystemUser } from '../data';
import type { RequestProjectSummary } from '../pages/RequestProjectDetailPage';
import type { CreatorProfile, GeneratedInvoiceRecord } from '../types';
import {
  canEditRequestProjectResources,
  contractAssociationCandidates,
  contractAssociationUnavailableReason,
  invoiceAssociationCandidates,
  invoiceAssociationUnavailableReason,
  mergeContractCandidateLinks,
  mergeInvoiceCandidateLinks,
  requestLinkedContracts,
  requestLinkedInvoices,
} from './RequestProjectResourceManager';

const creatorId = 'creator-request-resource' as CreatorId;
const engagementId = 'engagement-request-resource' as EngagementId;
const contractOneId = 'contract-request-one' as ContractId;
const contractTwoId = 'contract-request-two' as ContractId;
const invoiceOneId = 'invoice-request-one' as InvoiceId;
const invoiceTwoId = 'invoice-request-two' as InvoiceId;

const request: RequestProjectSummary = {
  id: 'REQ-TEST-RESOURCE',
  lifecycle: 'DRAFT',
  creatorLinks: [{
    creatorId,
    engagementId,
    contractIds: [contractOneId, contractTwoId],
    invoiceIds: [invoiceOneId, invoiceTwoId],
  }],
  project: 'Synthetic cooperation project',
  brand: '',
  media: 'Media User',
  pm: 'PM User',
  amount: 'USD 300',
  contracts: 2,
  invoices: 2,
  paymentOrder: '待生成',
  status: '草稿',
  filter: 'pending',
};

const contract = (contractId: ContractId): ContractRecord => ({
  contractId,
  id: `CON-${contractId}`,
} as ContractRecord);

const associationContract = ({
  contractId,
  creatorId: ownerCreatorId,
  engagementId: ownerEngagementId,
  projectId = 'cooperation-project-one',
  lifecycle = 'CONFIRMED',
}: {
  contractId: ContractId;
  creatorId: CreatorId;
  engagementId: EngagementId;
  projectId?: string;
  lifecycle?: ContractRecord['lifecycle'];
}): ContractRecord => ({
  ...contract(contractId),
  creatorId: ownerCreatorId,
  engagementId: ownerEngagementId,
  projectId,
  cooperationProjectId: projectId as ContractRecord['cooperationProjectId'],
  lifecycle,
  signed: lifecycle === 'CONFIRMED',
  isTemplate: false,
  issues: [],
} as ContractRecord);

const invoice = (invoiceId: InvoiceId): GeneratedInvoiceRecord => ({
  invoiceId,
  id: `INV-${invoiceId}`,
} as GeneratedInvoiceRecord);

const associationInvoice = ({
  invoiceId,
  creatorId: ownerCreatorId,
  engagementId: ownerEngagementId,
  projectId = 'cooperation-project-one',
}: {
  invoiceId: InvoiceId;
  creatorId: CreatorId;
  engagementId: EngagementId;
  projectId?: string;
}): GeneratedInvoiceRecord => ({
  invoiceId,
  id: `INV-${invoiceId}`,
  sourcePayoutId: `payout-${invoiceId}`,
  status: '已通过',
  generatedAt: '2026-08-06T09:00:00.000Z',
  validationStatus: 'valid',
  snapshot: {
    creatorId: ownerCreatorId,
    engagementId: ownerEngagementId,
    projectId,
    cooperationProjectId: projectId,
  },
} as GeneratedInvoiceRecord);

const user = (roleKey: SystemUser['roleKey']): SystemUser => ({
  account: `${roleKey}.test`,
  name: `${roleKey} user`,
  email: `${roleKey}@example.test`,
  initials: 'TU',
  roleKey,
  role: roleKey,
});

describe('request project resource permissions', () => {
  it('locks media edits after submission and reopens only explicit correction states', () => {
    const state = (
      lifecycle: RequestProjectSummary['lifecycle'],
      approvalStatus?: NonNullable<RequestProjectSummary['approval']>['status'],
    ) => ({
      lifecycle,
      approval: approvalStatus ? { status: approvalStatus } as RequestProjectSummary['approval'] : undefined,
    });

    expect(canEditRequestProjectResources(user('admin'), state('COMPLETED'))).toBe(true);
    expect(canEditRequestProjectResources(user('owner'), state('APPROVED'))).toBe(true);
    expect(canEditRequestProjectResources(user('project'), state('SUBMITTED'))).toBe(true);
    expect(canEditRequestProjectResources(user('media'), state('DRAFT'))).toBe(true);
    expect(canEditRequestProjectResources(user('media'), state('SUBMITTED'))).toBe(false);
    expect(canEditRequestProjectResources(user('media'), state('APPROVED'))).toBe(false);
    expect(canEditRequestProjectResources(user('media'), state('COMPLETED'))).toBe(false);
    expect(canEditRequestProjectResources(user('media'), state(undefined))).toBe(false);
    expect(canEditRequestProjectResources(user('media'), state('RETURNED'))).toBe(false);
    expect(canEditRequestProjectResources(
      user('media'),
      state('RETURNED', 'RETURNED_TO_MEDIA_REVIEW'),
    )).toBe(true);
    expect(canEditRequestProjectResources(user('media'), state('RETURNED'), true)).toBe(true);
    expect(canEditRequestProjectResources(user('pm'), state('DRAFT'))).toBe(false);
  });
});

describe('request project resource aggregation', () => {
  it('keeps multiple contracts and invoices for the same creator', () => {
    expect(requestLinkedContracts(request, [
      contract(contractOneId),
      contract(contractTwoId),
      contract('unlinked-contract' as ContractId),
    ])).toHaveLength(2);
    expect(requestLinkedInvoices(request, [
      invoice(invoiceOneId),
      invoice(invoiceTwoId),
      invoice('unlinked-invoice' as InvoiceId),
    ])).toHaveLength(2);
  });

  it('provides creator filters for both candidate dialogs and removes Invoice editing', () => {
    const source = readFileSync(new URL('./RequestProjectResourceManager.tsx', import.meta.url), 'utf8');
    expect(source).toContain('全部合同');
    expect(source).toContain('全部 Invoice');
    expect(source).toContain('一张付款单包含全部 Invoice');
    expect(source).toContain('ariaLabel="合同候选达人筛选"');
    expect(source).toContain('ariaLabel="Invoice 候选达人筛选"');
    expect(source).toContain('Invoice 候选范围不会受当前请款项目达人名单限制');
    expect(source).toContain('草稿尚未回传签署文件');
    expect(source).toContain('已上传，待人工确认');
    expect(source).toContain('合同尚未完成签署');
    expect(source).toContain('查看合同详情');
    const contractDialogSource = source.slice(
      source.indexOf("resourceDialog === 'contract'"),
      source.indexOf("resourceDialog === 'invoice'"),
    );
    expect(contractDialogSource).not.toContain('>编辑</button>');
    const invoiceDialogSource = source.slice(
      source.indexOf("resourceDialog === 'invoice'"),
      source.indexOf("resourceDialog === 'payment'"),
    );
    expect(invoiceDialogSource).not.toContain('>编辑</button>');
  });

  it('renders the contract viewer as a compact read-focused card list', () => {
    const source = readFileSync(new URL('./RequestProjectResourceManager.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    const contractDialogSource = source.slice(
      source.indexOf("resourceDialog === 'contract'"),
      source.indexOf("resourceDialog === 'invoice'"),
    );

    expect(contractDialogSource).toContain('width="820px"');
    expect(contractDialogSource).toContain('request-contract-card-list');
    expect(contractDialogSource).toContain('request-contract-card-document');
    expect(contractDialogSource).toContain('request-contract-card-creator');
    expect(contractDialogSource).toContain('request-contract-card-amount');
    expect(contractDialogSource).toContain('contract.name || \'合同名称待补充\'');
    expect(contractDialogSource).toContain('contract.generationSnapshot?.creatorName');
    expect(contractDialogSource).toContain('formatContractMoney(contract)');
    expect(contractDialogSource).toContain('关联已有合同');
    expect(contractDialogSource).toContain('移出请款');
    expect(contractDialogSource).toContain('>查看</ListActionButton>');
    expect(contractDialogSource).not.toContain('生成合同');
    expect(contractDialogSource).not.toContain('上传合同');
    expect(contractDialogSource).not.toContain('删除合同源记录');
    expect(contractDialogSource).not.toContain('合同 / IO');
    expect(styles).toContain('max-height: min(560px, calc(100dvh - 24px))');
    expect(styles).toContain('min-height: min(200px, calc(100dvh - 24px))');
    expect(styles).toContain('@media (max-width: 760px)');
  });

  it('removes multi-project coverage controls from contract generation and upload', () => {
    const builderSource = readFileSync(new URL('../pages/ContractBuilderPage.tsx', import.meta.url), 'utf8');
    const uploadSource = readFileSync(new URL('./ContractUploadWizard.tsx', import.meta.url), 'utf8');

    expect(builderSource).not.toContain('覆盖合作项目');
    expect(builderSource).not.toContain('projectLinkIds');
    expect(uploadSource).not.toContain('覆盖合作项目');
    expect(uploadSource).not.toContain('projectLinkIds');
    expect(builderSource).toContain('projectLinks: resolvedProjectId ? [{');
    expect(uploadSource).toContain('projectLinks: [{');
  });

  it('keeps payment-list viewing, editing, validation and export in one modal', () => {
    const source = readFileSync(new URL('./RequestProjectResourceManager.tsx', import.meta.url), 'utf8');
    const paymentDialogSource = source.slice(
      source.indexOf("resourceDialog === 'payment'"),
      source.indexOf('{linkDialog ?'),
    );
    expect(paymentDialogSource).toContain('导出 Excel');
    expect(paymentDialogSource).toContain('创建编辑草稿');
    expect(paymentDialogSource).toContain('<PaymentListEditor');
    expect(paymentDialogSource).toContain("currentPaymentList.status === 'draft'");
    expect(source).toContain('onGeneratePaymentListVersion(currentPaymentList.paymentListId)');
    const editorSource = readFileSync(new URL('./PaymentListEditor.tsx', import.meta.url), 'utf8');
    expect(editorSource).toContain('ariaLabel="付款支付币种"');
    expect(editorSource).toContain('ariaLabel="付款收款币种"');
    expect(editorSource).toContain('转账方式（只读）');
    expect(editorSource).toContain('aria-label="付款金额" type="number"');
    expect(source).toContain('accountOverrideOnly={paymentFailureRecoveryMode}');
    expect(source).toContain("payout.paymentFailureRecovery?.status !== 'RETRY_SUBMITTED'");
    expect(editorSource.match(/PAYMENT_CURRENCY_OPTIONS/g)?.length).toBeGreaterThanOrEqual(2);
    expect(editorSource).toContain("update('paymentReason', event.target.value)");
    expect(editorSource).toContain("update('transactionReference', event.target.value)");
    expect(editorSource).toContain('手续费承担方');
    expect(editorSource).toContain('查看详情');
    expect(editorSource).toContain('生成付款清单');
    expect(source).not.toContain('paymentEditorCloseWarning');
  });

  it('keeps payment-return notifications separate from Invoice-content returns', () => {
    const source = readFileSync(new URL('./RequestProjectResourceManager.tsx', import.meta.url), 'utf8');
    const paymentRowsSource = source.slice(source.indexOf('payment-list-overview-rows'));
    expect(paymentRowsSource).toContain("requestApprovalReturnItemForInvoice(");
    expect(paymentRowsSource).toContain("'PAYMENT_LIST'");
    expect(source).toContain("'INVOICE_CONTENT'");
    expect(source).toContain('通知达人修改付款明细');
    expect(source).toContain('当前仅模拟发送并保留通知记录');
  });
});

describe('Invoice association workflow', () => {
  const secondCreatorId = 'creator-request-invoice-new' as CreatorId;
  const secondEngagementId = 'engagement-request-invoice-new' as EngagementId;
  const creators = [
    { id: creatorId, name: 'Existing Creator' },
    { id: secondCreatorId, name: 'New Creator' },
  ] as unknown as CreatorProfile[];

  it('returns every Invoice under the cooperation project, including creators outside the request', () => {
    const existingCreatorInvoice = associationInvoice({ invoiceId: invoiceOneId, creatorId, engagementId });
    const newCreatorInvoice = associationInvoice({
      invoiceId: invoiceTwoId,
      creatorId: secondCreatorId,
      engagementId: secondEngagementId,
    });
    const otherProjectInvoice = associationInvoice({
      invoiceId: 'invoice-request-other-project' as InvoiceId,
      creatorId: secondCreatorId,
      engagementId: secondEngagementId,
      projectId: 'cooperation-project-two',
    });

    expect(invoiceAssociationCandidates(
      [existingCreatorInvoice, newCreatorInvoice, otherProjectInvoice],
      'cooperation-project-one',
    )).toEqual([existingCreatorInvoice, newCreatorInvoice]);
  });

  it('does not expose a framework contract to another cooperation project', () => {
    const framework = {
      ...contract('framework-shared' as ContractId),
      contractType: 'FRAMEWORK',
      isTemplate: false,
      projectId: 'cooperation-project-original',
      lifecycle: 'CONFIRMED',
      signed: true,
      issues: [],
      creatorId,
      engagementId,
    } as ContractRecord;

    expect(contractAssociationCandidates([framework], 'cooperation-project-new')).toEqual([]);
    expect(contractAssociationUnavailableReason(
      framework,
      request.creatorLinks ?? [],
      creators,
      'cooperation-project-new',
    )).toBe('合同不属于当前合作项目');
  });

  it('adds a new Invoice owner with no contracts and keeps multiple Invoices for an existing creator', () => {
    const existingCreatorInvoice = associationInvoice({
      invoiceId: 'invoice-request-three' as InvoiceId,
      creatorId,
      engagementId,
    });
    const newCreatorInvoice = associationInvoice({
      invoiceId: 'invoice-request-four' as InvoiceId,
      creatorId: secondCreatorId,
      engagementId: secondEngagementId,
    });
    const next = mergeInvoiceCandidateLinks(
      request.creatorLinks ?? [],
      [existingCreatorInvoice, newCreatorInvoice],
    );

    expect(next[0]?.invoiceIds).toEqual([
      invoiceOneId,
      invoiceTwoId,
      'invoice-request-three',
    ]);
    expect(next[1]).toEqual({
      creatorId: secondCreatorId,
      engagementId: secondEngagementId,
      contractIds: [],
      invoiceIds: ['invoice-request-four'],
    });
  });

  it('disables occupied Invoices and mismatched creator relationships', () => {
    const occupied = associationInvoice({ invoiceId: invoiceOneId, creatorId, engagementId });
    const occupiedRequest = {
      ...request,
      id: 'REQ-OCCUPIED',
      requestCode: 'REQ-202608-000099',
      paymentRequestProjectId: 'request-occupied',
    } as RequestProjectSummary;
    const mismatched = associationInvoice({
      invoiceId: invoiceTwoId,
      creatorId,
      engagementId: secondEngagementId,
    });

    expect(invoiceAssociationUnavailableReason(
      occupied,
      [],
      creators,
      [occupiedRequest],
    )).toBe('已关联 REQ-202608-000099');
    expect(invoiceAssociationUnavailableReason(
      mismatched,
      request.creatorLinks ?? [],
      creators,
      [],
    )).toBe('达人已通过其他合作关系加入当前请款项目');
  });
});

describe('contract association workflow', () => {
  const secondCreatorId = 'creator-request-resource-new' as CreatorId;
  const secondEngagementId = 'engagement-request-resource-new' as EngagementId;
  const creators = [
    { id: creatorId, name: 'Existing Creator' },
    { id: secondCreatorId, name: 'New Creator' },
  ] as unknown as CreatorProfile[];

  it('returns multiple contracts from the current project and excludes other projects', () => {
    const sameProjectOne = associationContract({
      contractId: contractOneId,
      creatorId,
      engagementId,
    });
    const sameProjectTwo = associationContract({
      contractId: contractTwoId,
      creatorId,
      engagementId,
    });
    const otherProject = associationContract({
      contractId: 'contract-other-project' as ContractId,
      creatorId,
      engagementId,
      projectId: 'cooperation-project-two',
    });
    const template = { ...sameProjectOne, contractId: 'contract-template' as ContractId, isTemplate: true };

    expect(contractAssociationCandidates(
      [sameProjectOne, sameProjectTwo, otherProject, template],
      'cooperation-project-one',
    )).toEqual([sameProjectOne, sameProjectTwo]);
  });

  it('does not add a new creator through contract selection alone', () => {
    const newContract = associationContract({
      contractId: contractTwoId,
      creatorId: secondCreatorId,
      engagementId: secondEngagementId,
    });
    const next = mergeContractCandidateLinks(request.creatorLinks ?? [], [newContract]);

    expect(next).toEqual(request.creatorLinks);
  });

  it('allows a selected creator contract from another engagement and merges by creator', () => {
    const mismatched = associationContract({
      contractId: contractTwoId,
      creatorId,
      engagementId: 'engagement-request-resource-other' as EngagementId,
    });

    expect(contractAssociationUnavailableReason(
      mismatched,
      request.creatorLinks ?? [],
      creators,
    )).toBe('');
    expect(mergeContractCandidateLinks(request.creatorLinks ?? [], [mismatched])[0]?.contractIds)
      .toEqual([contractOneId, contractTwoId]);
  });

  it('keeps pending contracts visible but unavailable', () => {
    const pending = associationContract({
      contractId: contractTwoId,
      creatorId: secondCreatorId,
      engagementId: secondEngagementId,
      lifecycle: 'UPLOADED_PENDING_CONFIRMATION',
    });

    expect(contractAssociationUnavailableReason(
      pending,
      [{ creatorId: secondCreatorId, engagementId: secondEngagementId, contractIds: [], invoiceIds: [] }],
      creators,
    )).toBe('已上传，待人工确认');
  });

  it('keeps expired contracts visible but blocks new request-project associations', () => {
    const expired = {
      ...associationContract({
        contractId: contractTwoId,
        creatorId: secondCreatorId,
        engagementId: secondEngagementId,
      }),
      campaignEnd: '2000-01-01',
      isLongTerm: false,
    };

    expect(contractAssociationUnavailableReason(
      expired,
      [{ creatorId: secondCreatorId, engagementId: secondEngagementId, contractIds: [], invoiceIds: [] }],
      creators,
    )).toBe('合同已失效');
  });
});
