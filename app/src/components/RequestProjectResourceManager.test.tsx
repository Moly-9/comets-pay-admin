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
  status: '待发起请款',
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

  it('keeps payment-list editing and Excel export at list level', () => {
    const source = readFileSync(new URL('./RequestProjectResourceManager.tsx', import.meta.url), 'utf8');
    const paymentDialogSource = source.slice(
      source.indexOf("resourceDialog === 'payment'"),
      source.indexOf('{linkDialog ?'),
    );
    const toolbarSource = paymentDialogSource.slice(
      paymentDialogSource.indexOf('request-payment-toolbar'),
      paymentDialogSource.indexOf('request-payment-flat-rows'),
    );
    const paymentRowsSource = paymentDialogSource.slice(
      paymentDialogSource.indexOf('request-payment-flat-rows'),
    );

    expect(toolbarSource).toContain('生成 / 刷新清单');
    expect(toolbarSource).toContain('导出 Excel');
    expect(toolbarSource).toContain('编辑付款清单');
    expect(toolbarSource).toContain('清空清单');
    expect(toolbarSource).not.toContain('删除清单');
    expect(toolbarSource.indexOf('生成 / 刷新清单')).toBeLessThan(toolbarSource.indexOf('导出 Excel'));
    expect(toolbarSource.indexOf('导出 Excel')).toBeLessThan(toolbarSource.indexOf('编辑付款清单'));
    expect(paymentRowsSource).not.toContain('创建编辑版本');
    expect(paymentRowsSource).not.toContain('>导出</Button>');
    expect(source).toContain("currentPaymentList?.status === 'draft'");
    expect(source).toContain('onGeneratePaymentListVersion(currentPaymentList.paymentListId)');
    expect(source).toContain('付款单已清空');
    expect(source).toContain('run: onClearPaymentLists');
    expect(paymentRowsSource).toContain('ariaLabel={`${item.snapshot.creatorName} 支付币种`}');
    expect(paymentRowsSource).toContain('ariaLabel={`${item.snapshot.creatorName} 收款币种`}');
    expect(paymentRowsSource.match(/options=\{PAYMENT_CURRENCY_OPTIONS\}/g)).toHaveLength(2);
    expect(paymentRowsSource).toContain("'paymentReason', event.target.value");
    expect(paymentRowsSource).toContain("'transactionReference', event.target.value");
    expect(toolbarSource).toContain('canEditPaymentList && currentPaymentList');
    expect(toolbarSource).toContain("hasScopedApprovalReturn ? '修改退回明细'");
    expect(toolbarSource).toContain('仅财务标记为“付款清单原因”的明细可修改');
    expect(paymentRowsSource).toContain("paymentLocked ? ' is-payment-locked' : ''");
    expect(paymentRowsSource).toContain("'校验通过 · 已付款冻结'");
    expect(paymentRowsSource).toContain("!paymentFailureRecoveryMode || Boolean(failurePayout)");
    expect(paymentRowsSource).toContain("!hasScopedApprovalReturn || Boolean(paymentListReturn)");
    expect(paymentRowsSource).toContain("paymentListReturn ? '付款清单原因 · 待修改'");
    expect(paymentRowsSource).toContain("paymentLocked && hasScopedApprovalReturn ? '已通过 · 已锁定'");
    expect(paymentRowsSource).toContain("linkedPayout.status !== '已付款'");
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

  it('returns every non-template contract under the cooperation project', () => {
    const sameProject = associationContract({
      contractId: contractOneId,
      creatorId: secondCreatorId,
      engagementId: secondEngagementId,
    });
    const otherProject = associationContract({
      contractId: contractTwoId,
      creatorId,
      engagementId,
      projectId: 'cooperation-project-two',
    });
    const template = { ...sameProject, contractId: 'contract-template' as ContractId, isTemplate: true };

    expect(contractAssociationCandidates(
      [sameProject, otherProject, template],
      'cooperation-project-one',
    )).toEqual([sameProject]);
  });

  it('adds a contract owner to the request with no Invoice when the creator is new', () => {
    const newContract = associationContract({
      contractId: contractTwoId,
      creatorId: secondCreatorId,
      engagementId: secondEngagementId,
    });
    const next = mergeContractCandidateLinks(request.creatorLinks ?? [], [newContract]);

    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({
      creatorId: secondCreatorId,
      engagementId: secondEngagementId,
      contractIds: [contractTwoId],
      invoiceIds: [],
    });
  });

  it('keeps a mismatched engagement disabled and does not merge it', () => {
    const mismatched = associationContract({
      contractId: contractTwoId,
      creatorId,
      engagementId: 'engagement-request-resource-other' as EngagementId,
    });

    expect(contractAssociationUnavailableReason(
      mismatched,
      request.creatorLinks ?? [],
      creators,
    )).toBe('达人已通过其他合作关系加入当前请款项目');
    expect(mergeContractCandidateLinks(request.creatorLinks ?? [], [mismatched])).toEqual(request.creatorLinks);
  });

  it('keeps pending contracts visible but unavailable', () => {
    const pending = associationContract({
      contractId: contractTwoId,
      creatorId: secondCreatorId,
      engagementId: secondEngagementId,
      lifecycle: 'UPLOADED_PENDING_CONFIRMATION',
    });

    expect(contractAssociationUnavailableReason(pending, [], creators)).toBe('已上传，待人工确认');
  });
});
