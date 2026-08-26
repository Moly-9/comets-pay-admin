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
    const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
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
    expect(contractDialogSource).toContain('关联已有合同');
    expect(contractDialogSource).toContain("contract.name || '合同名称待补充'");
    expect(contractDialogSource).toContain('request-resource-contract-card-list');
    expect(contractDialogSource).toContain('request-resource-contract-row');
    expect(contractDialogSource).toContain('request-contract-record-icon');
    expect(contractDialogSource).toContain('request-contract-name" title={contractName}');
    expect(contractDialogSource).toContain("readiness.ready ? ' is-success' : ''");
    expect(contractDialogSource).toContain('<span>合同金额</span><strong>{formatContractMoney(contract)}</strong>');
    expect(contractDialogSource).toContain('kind="danger"');
    expect(contractDialogSource).toContain('移出请款');
    expect(contractDialogSource).not.toContain('生成合同');
    expect(contractDialogSource).not.toContain('上传合同');
    expect(contractDialogSource).not.toContain('删除合同源记录');
    expect(contractDialogSource).not.toContain('合同 / IO');
    expect(contractDialogSource).not.toContain('contract.ioId');
    const invoiceDialogSource = source.slice(
      source.indexOf("resourceDialog === 'invoice'"),
      source.indexOf("resourceDialog === 'payment'"),
    );
    expect(invoiceDialogSource).not.toContain('>编辑</button>');
    expect(invoiceDialogSource).toContain('request-resource-invoice-card-list');
    expect(invoiceDialogSource).toContain('request-invoice-record-icon');
    expect(invoiceDialogSource).toContain('<ReceiptText size={19} strokeWidth={2} />');
    expect(invoiceDialogSource).toContain('关联已有 Invoice');
    expect(invoiceDialogSource).toContain('解除');
    expect(invoiceDialogSource).not.toContain('request-resource-select');
    expect(invoiceDialogSource).not.toContain('type="checkbox"');
    expect(invoiceDialogSource).not.toContain('解除已选');
    expect(invoiceDialogSource).not.toContain('生成 Invoice');
    expect(invoiceDialogSource).not.toContain('删除 Invoice 源记录');
    expect(contractDialogSource).toContain('width="920px"');
    expect(invoiceDialogSource).toContain('width="920px"');
    expect(contractDialogSource).toContain('request-document-list-modal');
    expect(invoiceDialogSource).toContain('request-document-list-modal');
    expect(styles).toContain('min-height: min(240px, calc(100dvh - 24px))');
    expect(styles).toContain('max-height: min(560px, calc(100dvh - 24px))');
    expect(styles).toContain('.request-resource-invoice-card-list .request-resource-invoice-row');
    expect(styles).toContain('.request-invoice-record-icon');
    expect(styles).toContain('.request-resource-contract-card-list .request-resource-contract-row');
    expect(styles).toContain('grid-template-columns: 40px minmax(260px, 1.8fr) minmax(150px, 1fr) minmax(120px, .65fr) auto');
    expect(styles).toContain('-webkit-line-clamp: 2');
    expect(styles).toContain('.request-resource-contract-row .project-record-status.is-success');
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

  it('keeps payment-list editing inline and validates before list generation', () => {
    const source = readFileSync(new URL('./RequestProjectResourceManager.tsx', import.meta.url), 'utf8');
    const paymentEditorCss = readFileSync(new URL('./PaymentListEditor.css', import.meta.url), 'utf8');
    const paymentDialogSource = source.slice(
      source.indexOf("resourceDialog === 'payment'"),
      source.indexOf('{linkDialog ?'),
    );
    const toolbarSource = paymentDialogSource.slice(
      paymentDialogSource.indexOf('request-payment-toolbar'),
      paymentDialogSource.indexOf('request-payment-flat-rows'),
    );
    const paymentRowsSource = paymentDialogSource.slice(
      paymentDialogSource.indexOf('payment-list-overview-rows'),
    );

    expect(toolbarSource).toContain('生成付款清单');
    expect(toolbarSource).toContain('导出 Excel');
    expect(toolbarSource).not.toContain('>编辑付款清单</Button>');
    expect(toolbarSource).toContain('清空清单');
    expect(toolbarSource).not.toContain('删除清单');
    expect(toolbarSource.indexOf('清空清单')).toBeLessThan(toolbarSource.indexOf('导出 Excel'));
    expect(toolbarSource.indexOf('导出 Excel')).toBeLessThan(toolbarSource.indexOf('生成付款清单'));
    expect(paymentEditorCss).toContain('.request-payment-toolbar { display: grid;');
    expect(paymentEditorCss).toContain('.request-payment-toolbar-actions { display: flex; grid-row: 1;');
    expect(paymentEditorCss).toContain('.request-payment-bulk-fields { display: grid; grid-row: 2;');
    expect(paymentEditorCss).toContain('justify-self: end; justify-content: flex-end;');
    expect(paymentRowsSource).not.toContain('创建编辑版本');
    expect(paymentRowsSource).not.toContain('>导出</Button>');
    expect(source).toContain("currentPaymentList?.status === 'draft'");
    expect(source).toContain('onGeneratePaymentListVersion(currentPaymentList.paymentListId)');
    expect(source).toContain("validatePaymentListAccountViaApi({ item, creators, scope: 'completeness' })");
    expect(source).toContain('Airwallex 付款信息完整性校验未通过');
    expect(source).toContain('paymentGenerationIssues.map');
    expect(source).toContain('openPaymentGenerationIssue(group)');
    expect(source).toContain('查看该笔明细 →');
    expect(source).toContain("setExpandedPaymentRow({ invoiceId: group.invoiceId, mode: 'view' })");
    expect(source).toContain("row?.scrollIntoView({ behavior: 'smooth', block: 'center' })");
    expect(source).toContain('付款单已清空');
    expect(source).toContain('run: onClearPaymentLists');
    expect(paymentRowsSource).toContain('payment-list-overview-row-summary');
    expect(paymentRowsSource).not.toContain('SelectField');
    const editorSource = readFileSync(new URL('./PaymentListEditor.tsx', import.meta.url), 'utf8');
    expect(editorSource).toContain('ariaLabel="付款支付币种"');
    expect(editorSource).toContain('ariaLabel="付款收款币种"');
    expect(editorSource).toContain('金额、币种和收款账户来自 Invoice 签署冻结快照，当前保持只读');
    expect(editorSource).toContain('aria-label="付款金额" type="number" min="0" step="0.01" value={paymentListItemValue(item, \'amount\')} disabled');
    expect(editorSource).toContain('ariaLabel="付款转账方式"');
    expect(source).toContain('accountOverrideOnly={paymentFailureRecoveryMode}');
    expect(source).toContain("payout.paymentFailureRecovery?.status !== 'RETRY_SUBMITTED'");
    expect(editorSource.match(/PAYMENT_CURRENCY_OPTIONS/g)?.length).toBeGreaterThanOrEqual(2);
    expect(editorSource).toContain("update('paymentReason', event.target.value)");
    expect(editorSource).toContain("update('transactionReference', event.target.value)");
    expect(editorSource).toContain("update('description', event.target.value)");
    expect(editorSource).toContain('手续费承担方');
    expect(editorSource).toContain('请输入交易附言');
    expect(editorSource).toContain('onPointerUp');
    expect(editorSource).toContain('ArrowRight');
    expect(toolbarSource).toContain('仅财务标记为“付款清单原因”的明细可修改');
    expect(paymentRowsSource).toContain('payment-list-overview-state');
    expect(paymentRowsSource).toContain('is-generation-failed');
    expect(paymentRowsSource).toContain('校验未通过');
    expect(paymentRowsSource).toContain('payment-list-overview-row-summary');
    expect(paymentRowsSource).toContain('paymentListReturn.reason');
    expect(paymentRowsSource).toContain('通知达人');
    expect(paymentRowsSource).toContain('paymentListReturn.notifications');
    expect(paymentRowsSource).toContain('模拟达人已修改账户');
    expect(paymentRowsSource).toContain('paymentListReturn.accountUpdate');
    expect(paymentRowsSource).toContain('账户已更新并通过校验');
    expect(paymentRowsSource).toContain('校验通过');
    expect(paymentRowsSource).toContain('canEditPaymentList && onSendPaymentListReturnNotification');
    expect(paymentRowsSource).toContain("linkedPayout.status !== '已付款'");
    expect(paymentRowsSource).toContain('编辑本笔');
    expect(paymentRowsSource).toContain('查看本笔');
    expect(paymentRowsSource).toContain('payment-list-overview-creator');
    expect(paymentRowsSource).toContain('<Avatar');
    expect(paymentRowsSource).toContain('收款账户名');
    expect(paymentRowsSource).toContain('收款方币种');
    expect(paymentRowsSource).toContain('转账方式');
    expect(paymentRowsSource).toContain("transferMethod === 'SWIFT'");
    expect(paymentRowsSource).toContain('SWIFT 费用选项');
    expect(paymentRowsSource).toContain('swiftFeeOptionLabel');
    expect(paymentRowsSource).toContain('payment-list-inline-panel');
    expect(paymentRowsSource).toContain('来自 Invoice 签署冻结快照，不可修改');
    expect(paymentRowsSource).toContain('togglePaymentRow(list, item.invoiceId, \'view\')');
    expect(paymentRowsSource).toContain('togglePaymentRow(list, item.invoiceId, \'edit\')');
    expect(paymentRowsSource).toContain('aria-label="行内编辑付款金额"');
    expect(paymentRowsSource).toContain('aria-label="行内编辑交易附言"');
    expect(paymentRowsSource).toContain("onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'paymentReason'");
    expect(paymentRowsSource).toContain("onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'transactionReference'");
    expect(toolbarSource).toContain('aria-label="一键输入付款原因"');
    expect(toolbarSource).toContain('aria-label="一键输入交易附言"');
    expect(toolbarSource).toContain('English only, max 140 characters');
    expect(source).toContain('isValidPaymentTransactionReference');
    expect(source).toContain("onClick={() => openPaymentEditor(list.paymentListId, item.invoiceId, 'edit')}");
    expect(source).toContain('请完成付款信息校验');
    expect(source).toContain('paymentEditorCloseWarning');
    expect(source).toContain("['admin', 'project', 'owner'].includes(currentUser.roleKey)");
    expect(source).toContain('closePaymentEditor');
    expect(paymentEditorCss).toContain('.payment-list-overview-row.is-generation-failed');
    expect(paymentEditorCss).toContain('.payment-generation-issue-list button:focus-visible');
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
