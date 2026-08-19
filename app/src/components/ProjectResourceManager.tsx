import {
  Eye,
  Download,
  AlertTriangle,
  FilePlus2,
  FileText,
  Link2,
  LockKeyhole,
  Pencil,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unlink,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  canEditProject,
  getPaymentListAccess,
  paymentListEffectiveAccount,
  paymentListItemValue,
  projectReviewStatusLabel,
  type ContractId,
  type EngagementId,
  type InvoiceId,
  type PaymentListEditableField,
  type PaymentListId,
  type PaymentListRecord,
  type ProjectId,
  type WorkflowAuditEvent,
} from '../businessWorkflow';
import {
  formatContractMoney,
  getContractReadiness,
  type ContractRecord,
} from '../contracts';
import type { SystemUser } from '../data';
import { canDeleteContract } from '../permissions';
import { formatInvoiceMoney, invoiceTotal } from '../invoice/invoiceUtils';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import {
  eligibleInvoicePayoutAccounts,
  getPayoutAccountId,
  getPayoutAccountSelectPresentation,
} from '../payoutAccounts';
import { PAYMENT_CURRENCY_OPTIONS } from '../paymentCurrencies';
import type { CreatorProfile, GeneratedInvoiceRecord } from '../types';
import { Button, Modal, NoticeBanner, SelectField } from './Common';

type ResourceDialogKind = 'contract' | 'invoice' | 'payment';
type CreateDialogKind = 'invoice';
type LinkDialogKind = Extract<ResourceDialogKind, 'contract' | 'invoice'>;
type ProjectReference = NonNullable<ProjectSummary['creatorProfiles']>[number];

type LinkOption = {
  value: string;
  label: string;
  description: string;
  engagementId: EngagementId;
};

type Props = {
  project: ProjectSummary;
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
  paymentLists: PaymentListRecord[];
  auditEvents: WorkflowAuditEvent[];
  currentUser: SystemUser;
  onOpenContract: (contractId: string) => void;
  onOpenInvoice: (invoiceId: InvoiceId) => void;
  onCreateInvoice: (engagementId: EngagementId) => void;
  onLinkContract: (contractId: string, engagementId: EngagementId) => void;
  onUnlinkContract: (contractId: string) => void;
  onDeleteContract: (contractId: string) => void;
  onLinkInvoice: (invoiceId: InvoiceId, engagementId: EngagementId) => void;
  onUnlinkInvoice: (invoiceId: InvoiceId) => void;
  onDeleteInvoice: (invoiceId: InvoiceId) => void;
  onCreatePaymentList: () => void;
  onDeletePaymentList: (paymentListId: PaymentListId) => void;
  onAddPaymentInvoice: (paymentListId: PaymentListId, invoiceId: InvoiceId) => void;
  onRemovePaymentInvoice: (invoiceId: InvoiceId) => void;
  onUpdatePaymentItem: (
    invoiceId: InvoiceId,
    field: PaymentListEditableField,
    value: string | number,
  ) => void;
  onChangePaymentAccount: (invoiceId: InvoiceId, payoutAccountId: string) => void;
  onRevalidatePaymentItem?: (invoiceId: InvoiceId) => void;
  onGeneratePaymentOrder: (paymentListId: PaymentListId) => InvoiceId | null;
  onEditPaymentOrder: (paymentListId: PaymentListId) => void;
  onExportPaymentList: (paymentListId: PaymentListId) => Promise<void>;
  onSubmitReview: () => void;
};

const projectInternalId = (project: ProjectSummary) => (
  (project.cooperationProjectId ?? project.projectId ?? project.id) as ProjectId
);

const contractStableId = (contract: ContractRecord) => contract.contractId ?? contract.id;

const referenceCreator = (
  reference: ProjectReference | undefined,
  creators: CreatorProfile[],
) => creators.find((creator) => creator.id === reference?.creatorId);

const referenceLabel = (reference: ProjectReference, creators: CreatorProfile[]) => {
  const creator = referenceCreator(reference, creators);
  return {
    name: creator?.name ?? reference.name,
    handle: creator?.handle ?? reference.handle,
    platform: creator?.platform ?? reference.platform,
  };
};

const contractStatusLabel = (contract: ContractRecord) => {
  if (contract.lifecycle === 'GENERATED_DRAFT') return '待回传';
  if (contract.lifecycle === 'UPLOADED_PENDING_CONFIRMATION') return '待确认';
  return getContractReadiness(contract).label;
};

const paymentListStatusLabel = (paymentList: PaymentListRecord | null) => {
  if (!paymentList) return '未生成';
  if (paymentList.status === 'paid') return '已付款';
  if (paymentList.status === 'approved') return '已批准';
  if (paymentList.status === 'submitted') return '已提交';
  if (paymentList.status === 'generated') return '已生成';
  return '草稿';
};

const paymentFeeBearerLabel = (value: unknown) => {
  if (value === 'ADVERTISER') return '付款方承担';
  if (value === 'PUBLISHER') return '收款方承担';
  if (value === 'SHARED') return '各自承担';
  return '待补充';
};

const requiredPaymentLabel = (label: string) => (
  <span className="project-payment-required-label">{label}<em aria-hidden="true">*</em></span>
);

const beneficiarySummary = (value?: string) => {
  if (!value) return '缺少 beneficiary ID';
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-6)}` : value;
};

const formatProjectInvoiceAmount = (invoices: GeneratedInvoiceRecord[]) => {
  if (!invoices.length) return '尚无金额';
  const totals = invoices.reduce<Record<string, number>>((result, invoice) => {
    const currency = invoice.snapshot.currency || '未定币种';
    result[currency] = (result[currency] ?? 0) + invoiceTotal(invoice.snapshot);
    return result;
  }, {});
  return Object.entries(totals)
    .map(([currency, amount]) => `${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`)
    .join(' / ');
};

export const getContractInvoiceRelation = (
  contract: ContractRecord,
  invoices: GeneratedInvoiceRecord[],
) => {
  const engagementInvoice = invoices.find((invoice) => (
    invoice.snapshot.engagementId === contract.engagementId
  )) ?? null;
  const covered = Boolean(
    engagementInvoice
    && contract.contractId
    && engagementInvoice.snapshot.contractIds?.includes(contract.contractId),
  );
  return {
    invoice: engagementInvoice,
    state: covered ? 'covered' : engagementInvoice ? 'not-covered' : 'missing',
  } as const;
};

export const getProjectLinkOptions = ({
  kind,
  project,
  references,
  contracts,
  invoices,
}: {
  kind: LinkDialogKind;
  project: ProjectSummary;
  references: ProjectReference[];
  contracts: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
}): LinkOption[] => {
  const projectId = projectInternalId(project);
  if (kind === 'contract') {
    return contracts.flatMap((contract) => {
      const reference = references.find((item) => item.creatorId === contract.creatorId);
      if (
        contract.isTemplate
        || contract.engagementId
        || contract.projectId !== projectId
        || !reference
      ) {
        return [];
      }
      return [{
        value: contractStableId(contract),
        label: `${contract.id} · ${contract.ioId || 'IO 待补充'}`,
        description: `${reference.name} · ${contract.name} · ${formatContractMoney(contract)}`,
        engagementId: reference.engagementId,
      }];
    });
  }

  return invoices.flatMap((invoice) => {
    const reference = references.find((item) => item.creatorId === invoice.snapshot.creatorId);
    const alreadyHasInvoice = reference && invoices.some((item) => (
      item.invoiceId !== invoice.invoiceId
      && item.snapshot.engagementId === reference.engagementId
    ));
    if (
      invoice.snapshot.engagementId
      || invoice.snapshot.projectId !== projectId
      || !reference
      || alreadyHasInvoice
    ) {
      return [];
    }
    return [{
      value: invoice.invoiceId,
      label: invoice.id,
      description: `${reference.name} · ${formatInvoiceMoney(invoice.snapshot.currency, invoiceTotal(invoice.snapshot))}`,
      engagementId: reference.engagementId,
    }];
  });
};

export function ProjectResourceManager({
  project,
  creators,
  contracts,
  invoices,
  paymentLists,
  auditEvents,
  currentUser,
  onOpenContract,
  onOpenInvoice,
  onCreateInvoice,
  onLinkContract,
  onUnlinkContract,
  onDeleteContract,
  onLinkInvoice,
  onUnlinkInvoice,
  onDeleteInvoice,
  onCreatePaymentList,
  onDeletePaymentList,
  onAddPaymentInvoice,
  onRemovePaymentInvoice,
  onUpdatePaymentItem,
  onChangePaymentAccount,
  onRevalidatePaymentItem,
  onGeneratePaymentOrder,
  onEditPaymentOrder,
  onExportPaymentList,
  onSubmitReview,
}: Props) {
  const reviewStatus = project.reviewStatus ?? 'draft';
  const canEdit = canEditProject(currentUser, reviewStatus);
  const [resourceDialog, setResourceDialog] = useState<ResourceDialogKind | null>(null);
  const [createDialog, setCreateDialog] = useState<CreateDialogKind | null>(null);
  const [createEngagementId, setCreateEngagementId] = useState('');
  const [linkDialog, setLinkDialog] = useState<LinkDialogKind | null>(null);
  const [linkId, setLinkId] = useState('');
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const [removePaymentInvoiceId, setRemovePaymentInvoiceId] = useState<InvoiceId | null>(null);

  const references = (project.creatorProfiles ?? []).filter((reference) => reference.status !== 'removed');
  const projectId = projectInternalId(project);
  const paymentList = paymentLists.find((list) => list.projectId === projectId) ?? null;
  const referenceByEngagement = new Map(
    references.map((reference) => [reference.engagementId, reference]),
  );
  const linkedContracts = contracts.filter((contract) => {
    if (!contract.engagementId) return false;
    const reference = referenceByEngagement.get(contract.engagementId as EngagementId);
    return Boolean(
      reference
      && contract.projectId === projectId
      && contract.creatorId === reference.creatorId,
    );
  });
  const linkedInvoices = invoices.filter((invoice) => {
    if (!invoice.snapshot.engagementId) return false;
    const reference = referenceByEngagement.get(
      invoice.snapshot.engagementId as EngagementId,
    );
    return Boolean(
      reference
      && invoice.snapshot.projectId === projectId
      && invoice.snapshot.creatorId === reference.creatorId,
    );
  });
  const coveredContractIds = new Set(linkedInvoices.flatMap((invoice) => invoice.snapshot.contractIds ?? []));
  const coveredContracts = linkedContracts.filter((contract) => (
    Boolean(contract.contractId) && coveredContractIds.has(contract.contractId as ContractId)
  ));
  const contractCreatorCount = new Set(linkedContracts.map((contract) => contract.engagementId)).size;
  const invoiceCreatorCount = new Set(linkedInvoices.map((invoice) => invoice.snapshot.engagementId)).size;
  const projectCode = project.projectCode ?? project.id;
  const paymentAccess = getPaymentListAccess(currentUser, reviewStatus, paymentList?.status ?? null);
  const paymentFieldsEditable = paymentAccess.canEditFields;
  const paymentListHistorical = paymentAccess.historical;
  const canReopenPaymentList = paymentAccess.canReopen || paymentAccess.canCreateVersion;
  const removePaymentItem = paymentList?.items.find((item) => (
    item.invoiceId === removePaymentInvoiceId
  )) ?? null;

  useEffect(() => {
    if (!removePaymentInvoiceId) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRemovePaymentInvoiceId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [removePaymentInvoiceId]);

  const generatePaymentOrder = () => {
    if (!paymentList) return;
    const blockingInvoiceId = onGeneratePaymentOrder(paymentList.paymentListId);
    if (!blockingInvoiceId) return;
    window.setTimeout(() => {
      const row = document.getElementById(`payment-row-${blockingInvoiceId}`);
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const providerWarning = row?.querySelector<HTMLElement>('[data-payment-provider-warning="true"]');
      if (providerWarning) providerWarning.focus();
      else row?.querySelector<HTMLInputElement>('[data-payment-required="true"]')?.focus();
    }, 0);
  };

  const linkOptions = useMemo(() => (
    linkDialog
      ? getProjectLinkOptions({
          kind: linkDialog,
          project,
          references,
          contracts,
          invoices,
        })
      : []
  ), [contracts, invoices, linkDialog, project, references]);

  const paymentCandidateInvoices = linkedInvoices.filter((invoice) => (
    paymentList
    && !paymentList.items.some((item) => item.invoiceId === invoice.invoiceId)
  ));

  const createOptions = references.map((reference) => {
    const creator = referenceLabel(reference, creators);
    const hasInvoice = linkedInvoices.some((invoice) => invoice.snapshot.engagementId === reference.engagementId);
    return {
      value: reference.engagementId,
      label: creator.name,
      description: `${creator.handle} · ${creator.platform}${hasInvoice ? ' · 已有 Invoice' : ''}`,
      disabled: hasInvoice,
    };
  });

  const openCreateDialog = (kind: CreateDialogKind) => {
    setResourceDialog(null);
    setCreateEngagementId('');
    setCreateDialog(kind);
  };

  const closeCreateDialog = () => {
    const previousKind = createDialog;
    setCreateDialog(null);
    setCreateEngagementId('');
    if (previousKind) setResourceDialog(previousKind);
  };

  const commitCreate = () => {
    if (!createDialog || !createEngagementId) return;
    const engagementId = createEngagementId as EngagementId;
    onCreateInvoice(engagementId);
    setCreateDialog(null);
    setCreateEngagementId('');
  };

  const openLinkDialog = (kind: LinkDialogKind) => {
    setResourceDialog(null);
    setLinkId('');
    setLinkDialog(kind);
  };

  const closeLinkDialog = () => {
    const previousKind = linkDialog;
    setLinkDialog(null);
    setLinkId('');
    if (previousKind) setResourceDialog(previousKind);
  };

  const commitLink = () => {
    if (!linkDialog || !linkId) return;
    const option = linkOptions.find((item) => item.value === linkId);
    if (!option) return;
    if (linkDialog === 'contract') onLinkContract(linkId, option.engagementId);
    else onLinkInvoice(linkId as InvoiceId, option.engagementId);
    setResourceDialog(linkDialog);
    setLinkDialog(null);
    setLinkId('');
  };

  const resourceRows = [
    {
      kind: 'contract' as const,
      icon: FileText,
      label: '合同',
      count: linkedContracts.length,
      title: linkedContracts.length ? `${linkedContracts.length} 份合同` : '尚未关联合同',
      description: linkedContracts.length
        ? `覆盖 ${contractCreatorCount} 位达人 · ${coveredContracts.length} 份已被 Invoice 覆盖`
        : '合同非必填，可关联同一项目达人的已有合同/IO 单',
      status: !linkedContracts.length
        ? '未关联'
        : linkedContracts.every((contract) => getContractReadiness(contract).ready)
          ? '已确认'
          : '待处理',
      action: '查看合同',
    },
    {
      kind: 'invoice' as const,
      icon: ReceiptText,
      label: 'Invoice',
      count: linkedInvoices.length,
      title: linkedInvoices.length ? `${linkedInvoices.length} 份 Invoice` : '尚未关联 Invoice',
      description: linkedInvoices.length
        ? `覆盖 ${invoiceCreatorCount} 位达人 · 项目金额 ${formatProjectInvoiceAmount(linkedInvoices)}`
        : '提交审核前，每位项目达人至少需要一份 Invoice',
      status: !linkedInvoices.length
        ? '未关联'
        : linkedInvoices.every((invoice) => invoice.validationStatus === 'valid')
          ? '已校验'
          : '需校验',
      action: '查看 Invoice',
    },
    {
      kind: 'payment' as const,
      icon: WalletCards,
      label: '付款清单',
      count: paymentList?.items.length ?? 0,
      title: paymentList
        ? paymentList.paymentListCode
        : '付款清单尚未生成',
      description: paymentList
        ? `${paymentList.items.length} 笔达人付款 · 来源为项目已关联 Invoice`
        : '每个项目保留一张当前付款清单',
      status: paymentListStatusLabel(paymentList),
      action: '查看清单',
    },
  ];

  return (
    <div className="project-workflow-resources">
      <div className="project-workflow-statusbar">
        <div>
          <span>项目审核状态</span>
          <strong>{projectReviewStatusLabel[reviewStatus]}</strong>
        </div>
        <div className="project-workflow-status-actions">
          {canEdit && reviewStatus !== 'submitted' && reviewStatus !== 'approved' ? (
            <Button icon={<ShieldCheck size={16} />} onClick={onSubmitReview}>
              {project.status === '付款清单待修改' ? '重新提交付款清单' : '提交请款审核'}
            </Button>
          ) : null}
        </div>
      </div>

      {!canEdit ? (
        <NoticeBanner>
          当前账号在“{projectReviewStatusLabel[reviewStatus]}”状态下仅可查看项目资料。审批操作统一在“请款项目详情”按当前节点完成。
        </NoticeBanner>
      ) : null}

      <div className="project-resource-summary-list">
        {resourceRows.map((row) => {
          const RowIcon = row.icon;
          return (
            <article className={`project-resource-summary-row project-resource-summary-${row.kind}`} key={row.kind}>
              <span className="project-resource-summary-icon"><RowIcon size={19} /></span>
              <div className="project-resource-summary-copy">
                <div>
                  <strong>{row.label}</strong>
                  <em>{row.count} 条可查看</em>
                </div>
                <h3>{row.title}</h3>
                <p>{row.description}</p>
              </div>
              <span className="project-resource-summary-status"><i />{row.status}</span>
              <button
                className="project-resource-summary-open"
                type="button"
                data-testid={`open-project-${row.kind}`}
                onClick={() => setResourceDialog(row.kind)}
              >
                {row.action}
              </button>
            </article>
          );
        })}
      </div>

      {auditEvents.length ? (
        <details className="project-audit-log">
          <summary>最近操作记录（{auditEvents.length}）</summary>
          {auditEvents.slice(0, 8).map((event) => (
            <div key={event.id}>
              <strong>{event.summary}</strong>
              <span>{event.actor} · {new Date(event.occurredAt).toLocaleString('zh-CN')}</span>
            </div>
          ))}
        </details>
      ) : null}

      {resourceDialog === 'contract' ? (
        <Modal
          title={`${project.name} · 合同资料`}
          width="1040px"
          className="project-resource-modal"
          onClose={() => setResourceDialog(null)}
          footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}
        >
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading">
              <div>
                <strong>合同资料</strong>
                <p>共 {linkedContracts.length} 份合同，每行展示对应达人、IO 单和 Invoice 覆盖关系。</p>
              </div>
              <span>{projectCode}</span>
            </div>

            {canEdit ? (
              <div className="project-resource-browser-toolbar">
                <Button variant="secondary" icon={<Link2 size={15} />} onClick={() => openLinkDialog('contract')}>关联合同/IO 单</Button>
              </div>
            ) : null}

            {linkedContracts.length ? (
              <div className="project-contract-record-list" role="list">
                {linkedContracts.map((contract) => {
                  const reference = references.find((item) => item.engagementId === contract.engagementId);
                  const creator = reference ? referenceLabel(reference, creators) : null;
                  const relation = getContractInvoiceRelation(contract, linkedInvoices);
                  return (
                    <article className="project-contract-record" role="listitem" key={contractStableId(contract)}>
                      <span className="project-contract-record-icon"><FileText size={18} /></span>
                      <div className="project-contract-record-main">
                        <strong>{contract.id}</strong>
                        <span>{contract.name}</span>
                        <small>{contract.lifecycle === 'GENERATED_DRAFT' ? '生成草稿' : contract.sourceName}</small>
                      </div>
                      <div className="project-contract-record-person">
                        <span>对应达人</span>
                        <strong>{creator?.name ?? '达人资料缺失'}</strong>
                        <small>{creator ? `${creator.handle} · ${creator.platform}` : '请检查 Engagement 关联'}</small>
                      </div>
                      <div className="project-contract-record-io">
                        <span>合同 / IO</span>
                        <strong>{contract.ioId || 'IO 待补充'}</strong>
                        <small>{formatContractMoney(contract)}</small>
                      </div>
                      <div className={`project-contract-record-invoice relation-${relation.state}`}>
                        <span>关联 Invoice</span>
                        <strong>
                          {relation.state === 'covered'
                            ? relation.invoice?.id
                            : relation.state === 'not-covered'
                              ? 'Invoice 未覆盖'
                              : '未关联 Invoice'}
                        </strong>
                        <small>
                          {relation.invoice
                            ? relation.invoice.validationStatus === 'valid'
                              ? relation.invoice.status
                              : `${relation.invoice.id} · 需重新校验`
                            : '合同可独立存在'}
                        </small>
                      </div>
                      <div className="project-contract-record-state">
                        <span className="project-record-status"><i />{contractStatusLabel(contract)}</span>
                      </div>
                      <div className="project-contract-record-actions">
                        <Button variant="secondary" icon={<Eye size={14} />} onClick={() => onOpenContract(contract.id)}>查看</Button>
                        {canEdit ? (
                          <>
                            <button type="button" onClick={() => onOpenContract(contract.id)}><Pencil size={14} />编辑</button>
                            <button type="button" onClick={() => {
                              if (window.confirm(`确认解除合同 ${contract.id} 与当前项目达人的关联？合同源记录会保留。`)) {
                                onUnlinkContract(contractStableId(contract));
                              }
                            }}><Unlink size={14} />解除</button>
                            {canDeleteContract(currentUser, contract) ? (
                              <button className="danger" type="button" onClick={() => {
                                if (window.confirm(`确认删除合同 ${contract.id}？源记录会同步从合同管理删除。`)) {
                                  onDeleteContract(contractStableId(contract));
                                }
                              }}><Trash2 size={14} />删除</button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="project-resource-browser-empty">
                <FileText size={23} />
                <strong>当前项目尚未关联合同</strong>
                <p>合同不是 Invoice 的必填项；可在合同管理生成合同，然后在此关联同一项目达人的合同/IO 单。</p>
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {resourceDialog === 'invoice' ? (
        <Modal
          title={`${project.name} · Invoice`}
          width="980px"
          className="project-resource-modal"
          onClose={() => setResourceDialog(null)}
          footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}
        >
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading">
              <div>
                <strong>Invoice 资料</strong>
                <p>共 {linkedInvoices.length} 份 Invoice，每位项目达人最多关联一份。</p>
              </div>
              <span>{projectCode}</span>
            </div>

            {canEdit ? (
              <div className="project-resource-browser-toolbar">
                <Button variant="ghost" icon={<FilePlus2 size={15} />} onClick={() => openCreateDialog('invoice')}>生成 Invoice</Button>
                <Button variant="secondary" icon={<Link2 size={15} />} onClick={() => openLinkDialog('invoice')}>关联 Invoice</Button>
              </div>
            ) : null}

            {linkedInvoices.length ? (
              <div className="project-invoice-record-list" role="list">
                {linkedInvoices.map((invoice) => {
                  const reference = references.find((item) => item.engagementId === invoice.snapshot.engagementId);
                  const creator = reference ? referenceLabel(reference, creators) : null;
                  const covered = linkedContracts.filter((contract) => (
                    contract.contractId && invoice.snapshot.contractIds?.includes(contract.contractId)
                  ));
                  return (
                    <article className="project-invoice-record" role="listitem" key={invoice.invoiceId}>
                      <span className="project-contract-record-icon"><ReceiptText size={18} /></span>
                      <div className="project-contract-record-main">
                        <strong>{invoice.id}</strong>
                        <span>{creator?.name ?? invoice.snapshot.creatorName}</span>
                        <small>{creator ? `${creator.handle} · ${creator.platform}` : invoice.snapshot.creatorHandle}</small>
                      </div>
                      <div className="project-invoice-record-contracts">
                        <span>覆盖合同 / IO</span>
                        <strong>{covered.length ? `${covered.length} 份合同` : '未关联合同（非必填）'}</strong>
                        <small>{covered.length
                          ? covered.map((contract) => `${contract.id} · ${contract.ioId}`).join('；')
                          : '仅执行 Invoice 自身校验'}</small>
                      </div>
                      <div className="project-invoice-record-amount">
                        <span>Invoice 金额</span>
                        <strong>{formatInvoiceMoney(invoice.snapshot.currency, invoiceTotal(invoice.snapshot))}</strong>
                        <small>{invoice.status}</small>
                      </div>
                      <span className="project-record-status">
                        <i />{invoice.validationStatus === 'valid' ? '已校验' : '需重新校验'}
                      </span>
                      <div className="project-contract-record-actions">
                        <Button variant="secondary" icon={<Eye size={14} />} onClick={() => onOpenInvoice(invoice.invoiceId)}>查看</Button>
                        {canEdit ? (
                          <>
                            <button type="button" onClick={() => {
                              if (window.confirm(`确认解除 Invoice ${invoice.id} 与当前项目达人的关联？Invoice 源记录会保留，并从付款清单移除。`)) {
                                onUnlinkInvoice(invoice.invoiceId);
                              }
                            }}><Unlink size={14} />解除</button>
                            <button className="danger" type="button" onClick={() => {
                              if (window.confirm(`确认删除 Invoice ${invoice.id}？源记录会同步从 Invoice 管理删除。`)) {
                                onDeleteInvoice(invoice.invoiceId);
                              }
                            }}><Trash2 size={14} />删除</button>
                          </>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="project-resource-browser-empty">
                <ReceiptText size={23} />
                <strong>当前项目尚未关联 Invoice</strong>
                <p>生成或关联 Invoice 后，将按 Engagement ID 回到对应达人，并可按需覆盖多份已确认合同。</p>
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {resourceDialog === 'payment' ? (
        <Modal
          title={`${project.name} · 付款清单`}
          width="1040px"
          className="project-resource-modal"
          onClose={() => setResourceDialog(null)}
          footer={(
            <>
              {paymentList && paymentList.status !== 'draft' ? (
                <span className="project-payment-lock-state">
                  <LockKeyhole size={15} />
                  {paymentListStatusLabel(paymentList)} · v{paymentList.version ?? 1}
                </span>
              ) : null}
              {paymentList?.status === 'draft' && canEdit ? (
                <Button onClick={generatePaymentOrder}>生成付款单</Button>
              ) : null}
              {paymentList?.status === 'generated' && canReopenPaymentList ? (
                <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => onEditPaymentOrder(paymentList.paymentListId)}>编辑付款单</Button>
              ) : null}
              {paymentListHistorical && paymentAccess.canCreateVersion ? (
                <Button variant="secondary" icon={<FilePlus2 size={15} />} onClick={() => onEditPaymentOrder(paymentList!.paymentListId)}>创建新版本</Button>
              ) : null}
              <Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>
            </>
          )}
        >
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading">
              <div>
                <strong>项目付款清单</strong>
                <p>每位达人默认继承 Invoice 冻结账户，付款清单可独立选择其他收款账户。</p>
              </div>
              <span>{paymentList?.paymentListCode ?? projectCode}</span>
            </div>

            {(canEdit || paymentList) ? (
              <div className="project-resource-browser-toolbar project-payment-toolbar">
                {canEdit ? (
                  paymentList ? (
                    <Button variant="danger" icon={<Trash2 size={15} />} disabled={!paymentFieldsEditable} onClick={() => {
                      if (window.confirm(`确认删除付款清单 ${paymentList.paymentListCode}？Invoice 不会被删除。`)) {
                        onDeletePaymentList(paymentList.paymentListId);
                      }
                    }}>删除清单</Button>
                  ) : (
                    <Button icon={<FilePlus2 size={15} />} disabled={!linkedInvoices.length} onClick={onCreatePaymentList}>生成付款清单</Button>
                  )
                ) : <span />}
                {paymentList ? (
                  <Button
                    variant="secondary"
                    icon={<Download size={15} />}
                    disabled={
                      !paymentList.items.length
                      || paymentList.status === 'draft'
                      || paymentList.status === 'submitted'
                    }
                    onClick={() => { void onExportPaymentList(paymentList.paymentListId); }}
                  >{['approved', 'paid'].includes(paymentList.status) ? '导出 Excel' : '导出预览'}</Button>
                ) : null}
              </div>
            ) : null}

            {paymentList ? (
              <>
                <div className="project-payment-list-meta">
                  <strong>{paymentList.paymentListCode}</strong>
                  <span>
                    {paymentList.items.length} 笔付款 · {paymentListStatusLabel(paymentList)}
                    {paymentList.version ? ` · v${paymentList.version}` : ''}
                    {paymentList.generatedAt ? ` · ${new Date(paymentList.generatedAt).toLocaleString('zh-CN')}` : ''}
                  </span>
                </div>
                <NoticeBanner>
                  {paymentList.status === 'draft'
                    ? '付款清单字段中付款原因和交易附言为必填；描述为选填项。手续费承担方优先继承关联合同。'
                    : '当前付款单内容已锁定。页面仅展示脱敏账户快照，历史版本保持不变。'}
                </NoticeBanner>
                <div className="project-payment-rows">
                  {paymentList.items.map((item) => {
                    const effectiveAccount = paymentListEffectiveAccount(item);
                    const creator = creators.find((candidate) => candidate.id === item.snapshot.creatorId);
                    const accountOptions = eligibleInvoicePayoutAccounts(creator).map((account) => ({
                      value: getPayoutAccountId(account),
                      ...getPayoutAccountSelectPresentation(account),
                    }));
                    const unsupportedProvider = effectiveAccount.provider !== 'Airwallex';
                    return (
                      <article
                        className={`project-payment-row${unsupportedProvider ? ' has-provider-warning' : ''}`}
                        id={`payment-row-${item.invoiceId}`}
                        key={item.invoiceId}
                        tabIndex={-1}
                      >
                        <header className="project-payment-row-header">
                          <div>
                            <strong>{item.snapshot.creatorName}</strong>
                            <span>{item.snapshot.invoiceNumber} · {effectiveAccount.provider}</span>
                          </div>
                          <div className="project-payment-row-actions">
                            {paymentFieldsEditable && item.requiresRevalidation ? (
                              <button className="project-payment-revalidate" type="button" onClick={() => onRevalidatePaymentItem?.(item.invoiceId)}>
                                <RefreshCw size={12} />重新校验
                              </button>
                            ) : null}
                            {paymentFieldsEditable ? (
                              <button type="button" aria-label={`移除 ${item.snapshot.invoiceNumber}`} onClick={() => {
                                setRemovePaymentInvoiceId(item.invoiceId);
                              }}><Trash2 size={15} /></button>
                            ) : null}
                          </div>
                        </header>

                        {unsupportedProvider ? (
                          <div className="project-payment-provider-warning" data-payment-provider-warning="true" role="alert" tabIndex={-1}>
                            <AlertTriangle size={15} />
                            <span>{item.snapshot.creatorName} 当前选择 {effectiveAccount.provider || '未指定渠道'}，付款单仅支持 Airwallex。</span>
                          </div>
                        ) : null}

                        <div className="project-payment-validation-row">
                          <ShieldCheck size={14} />
                          <small className={item.requiresRevalidation ? 'project-payment-validation is-warning' : 'project-payment-validation'}>
                            {item.requiresRevalidation
                              ? item.validationIssues?.[0] ?? '账户快照需要重新校验'
                              : `${effectiveAccount.payoutAccountVersion ?? 'legacy-v1'} · 账户及付款字段已校验`}
                          </small>
                        </div>

                        <div className="project-payment-fields">
                          <label className="project-payment-account-field">
                            {requiredPaymentLabel('收款账户')}
                            <SelectField
                              ariaLabel={`${item.snapshot.creatorName} 收款账户`}
                              variant="form"
                              value={effectiveAccount.payoutAccountId ?? ''}
                              options={accountOptions}
                              className="payout-account-select"
                              menuClassName="payout-account-select-menu"
                              menuStrategy="fixed"
                              menuWidth={520}
                              placeholder={accountOptions.length ? '选择达人收款账户' : '达人暂无可用收款账户'}
                              disabled={!paymentFieldsEditable || !accountOptions.length}
                              onChange={(value) => onChangePaymentAccount(item.invoiceId, value)}
                            />
                            <small className="project-payment-account-origin">
                              {item.accountOverride ? '付款清单已覆盖，Invoice 原账户快照保留' : '默认继承 Invoice 冻结账户'}
                            </small>
                          </label>
                          <label>
                            {requiredPaymentLabel('支付币种')}
                            <SelectField
                              ariaLabel={`${item.snapshot.creatorName} 支付币种`}
                              variant="form"
                              value={String(paymentListItemValue(item, 'currency'))}
                              options={PAYMENT_CURRENCY_OPTIONS}
                              disabled={!paymentFieldsEditable}
                              onChange={(value) => onUpdatePaymentItem(item.invoiceId, 'currency', value)}
                            />
                          </label>
                          <label>
                            {requiredPaymentLabel('收款币种')}
                            <SelectField
                              ariaLabel={`${item.snapshot.creatorName} 收款币种`}
                              variant="form"
                              value={String(paymentListItemValue(item, 'receiveCurrency'))}
                              options={PAYMENT_CURRENCY_OPTIONS}
                              disabled={!paymentFieldsEditable}
                              onChange={(value) => onUpdatePaymentItem(item.invoiceId, 'receiveCurrency', value)}
                            />
                          </label>
                          <label>
                            {requiredPaymentLabel('金额')}
                            <input required aria-required="true" disabled={!paymentFieldsEditable} type="number" min="0" step="0.01" value={paymentListItemValue(item, 'amount')} onChange={(event) => onUpdatePaymentItem(item.invoiceId, 'amount', Number(event.target.value))} />
                          </label>
                          <label>
                            {requiredPaymentLabel('手续费承担方')}
                            <input className="project-payment-inherited-field" readOnly aria-readonly="true" value={paymentFeeBearerLabel(paymentListItemValue(item, 'feeBearer'))} />
                          </label>
                          <label>
                            {requiredPaymentLabel('付款原因')}
                            <input required aria-required="true" disabled={!paymentFieldsEditable} value={paymentListItemValue(item, 'paymentReason')} onChange={(event) => onUpdatePaymentItem(item.invoiceId, 'paymentReason', event.target.value)} />
                          </label>
                          <label>
                            {requiredPaymentLabel('交易附言')}
                            <input required aria-required="true" data-payment-required="true" disabled={!paymentFieldsEditable} placeholder="请输入交易附言" value={paymentListItemValue(item, 'transactionReference')} onChange={(event) => onUpdatePaymentItem(item.invoiceId, 'transactionReference', event.target.value)} />
                          </label>
                          <label className="project-payment-description-field">
                            <span>描述</span>
                            <input disabled={!paymentFieldsEditable} placeholder="请输入付款描述（选填）" value={paymentListItemValue(item, 'description')} onChange={(event) => onUpdatePaymentItem(item.invoiceId, 'description', event.target.value)} />
                          </label>
                        </div>

                        <footer className="project-payment-row-meta">
                          <span>账户 {effectiveAccount.accountSummary}</span>
                          <span>{effectiveAccount.provider === 'Airwallex'
                            ? beneficiarySummary(effectiveAccount.externalBeneficiaryId)
                            : `账户 ID ${effectiveAccount.payoutAccountId ?? '待补充'}`}</span>
                          <span>{effectiveAccount.transferMethod ?? '待确认方式'}{effectiveAccount.localClearingSystem ? ` · ${effectiveAccount.localClearingSystem}` : ''}</span>
                          <span>{item.snapshot.contractIds?.length ? `${item.snapshot.contractIds.length} 份合同` : '未关联合同'}</span>
                        </footer>
                      </article>
                    );
                  })}
                  {!paymentList.items.length ? <p className="project-resource-empty-line">清单尚无付款行，请从已关联 Invoice 添加。</p> : null}
                </div>
                {paymentFieldsEditable ? (
                  <div className="project-payment-add">
                    <SelectField
                      ariaLabel="添加付款 Invoice"
                      variant="form"
                      value={paymentInvoiceId}
                      placeholder={paymentCandidateInvoices.length ? '选择尚未加入清单的 Invoice' : '没有可添加的 Invoice'}
                      options={paymentCandidateInvoices.map((invoice) => ({
                        value: invoice.invoiceId,
                        label: invoice.id,
                        description: `${invoice.snapshot.creatorName} · ${formatInvoiceMoney(invoice.snapshot.currency, invoiceTotal(invoice.snapshot))}`,
                      }))}
                      disabled={!paymentCandidateInvoices.length}
                      onChange={setPaymentInvoiceId}
                    />
                    <Button
                      variant="secondary"
                      disabled={!paymentInvoiceId}
                      onClick={() => {
                        if (!paymentList) return;
                        onAddPaymentInvoice(paymentList.paymentListId, paymentInvoiceId as InvoiceId);
                        setPaymentInvoiceId('');
                      }}
                    >添加付款行</Button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="project-resource-browser-empty">
                <WalletCards size={23} />
                <strong>付款清单尚未生成</strong>
                <p>先为每位项目达人关联并校验 Invoice，再生成项目级唯一付款清单。</p>
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {removePaymentItem ? (
        <Modal
          title="确认移除付款行"
          width="440px"
          className="project-payment-remove-modal"
          onClose={() => setRemovePaymentInvoiceId(null)}
          footer={(
            <>
              <Button variant="secondary" autoFocus onClick={() => setRemovePaymentInvoiceId(null)}>取消</Button>
              <Button
                variant="danger"
                onClick={() => {
                  onRemovePaymentInvoice(removePaymentItem.invoiceId);
                  setRemovePaymentInvoiceId(null);
                }}
              >确认移除</Button>
            </>
          )}
        >
          <div className="project-payment-remove-confirmation">
            <span><AlertTriangle size={22} /></span>
            <div>
              <strong>{removePaymentItem.snapshot.invoiceNumber}</strong>
              <p>对应达人：{removePaymentItem.snapshot.creatorName}</p>
              <small>仅从当前付款清单移除这笔付款行，Invoice 源记录会保留。</small>
            </div>
          </div>
        </Modal>
      ) : null}

      {createDialog ? (
        <Modal
          title="选择达人并生成 Invoice"
          width="620px"
          onClose={closeCreateDialog}
          footer={(
            <>
              <Button variant="ghost" onClick={closeCreateDialog}>取消</Button>
              <Button disabled={!createEngagementId} onClick={commitCreate}>继续生成</Button>
            </>
          )}
        >
          <div className="project-link-dialog">
            <p>选择当前项目中的达人关系，系统将通过稳定 Engagement ID 进入生成流程。</p>
            <div className="project-resource-picker-list" role="list" aria-label="选择项目达人">
              {createOptions.map((option) => (
                <button
                  className={createEngagementId === option.value ? 'is-selected' : ''}
                  type="button"
                  role="listitem"
                  aria-pressed={createEngagementId === option.value}
                  disabled={option.disabled}
                  key={option.value}
                  onClick={() => setCreateEngagementId(option.value)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </button>
              ))}
              {!createOptions.length ? <span>项目中没有可用达人。</span> : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {linkDialog ? (
        <Modal
          title={linkDialog === 'contract' ? '关联合同/IO 单' : '关联 Invoice'}
          width="680px"
          onClose={closeLinkDialog}
          footer={(
            <>
              <Button variant="ghost" onClick={closeLinkDialog}>取消</Button>
              <Button disabled={!linkId} onClick={commitLink}>确认关联</Button>
            </>
          )}
        >
          <div className="project-link-dialog">
            <p>仅展示与当前项目、当前项目达人严格一致的未关联记录。IO 编号随合同记录一起关联。</p>
            <div
              className="project-resource-picker-list"
              role="list"
              aria-label={linkDialog === 'contract' ? '选择合同/IO 单' : '选择 Invoice'}
            >
              {linkOptions.map((option) => (
                <button
                  className={linkId === option.value ? 'is-selected' : ''}
                  type="button"
                  role="listitem"
                  aria-pressed={linkId === option.value}
                  key={option.value}
                  onClick={() => setLinkId(option.value)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </button>
              ))}
              {!linkOptions.length ? <span>没有合法候选记录。</span> : null}
            </div>
          </div>
        </Modal>
      ) : null}

    </div>
  );
}
