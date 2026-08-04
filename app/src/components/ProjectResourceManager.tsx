import {
  Eye,
  FilePlus2,
  FileText,
  Link2,
  Pencil,
  ReceiptText,
  ShieldCheck,
  Trash2,
  Unlink,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  canEditProject,
  paymentListItemValue,
  projectReviewStatusLabel,
  type ContractId,
  type EngagementId,
  type InvoiceId,
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
import { formatInvoiceMoney, invoiceTotal, normalizeLineItem } from '../invoice/invoiceUtils';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type { CreatorProfile, GeneratedInvoiceRecord, InvoiceCurrency } from '../types';
import { Button, Modal, NoticeBanner, SelectField } from './Common';

type ResourceDialogKind = 'contract' | 'invoice' | 'payment';
type CreateDialogKind = Extract<ResourceDialogKind, 'contract' | 'invoice'>;
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
  paymentList: PaymentListRecord | null;
  auditEvents: WorkflowAuditEvent[];
  currentUser: SystemUser;
  onOpenContract: (contractId: string) => void;
  onOpenInvoice: (invoiceId: InvoiceId) => void;
  onCreateContract: (engagementId: EngagementId) => void;
  onCreateInvoice: (engagementId: EngagementId) => void;
  onLinkContract: (contractId: string, engagementId: EngagementId) => void;
  onUnlinkContract: (contractId: string) => void;
  onDeleteContract: (contractId: string) => void;
  onLinkInvoice: (invoiceId: InvoiceId, engagementId: EngagementId) => void;
  onUnlinkInvoice: (invoiceId: InvoiceId) => void;
  onDeleteInvoice: (invoiceId: InvoiceId) => void;
  onUpdateInvoice: (invoice: GeneratedInvoiceRecord) => void;
  onCreatePaymentList: () => void;
  onDeletePaymentList: () => void;
  onAddPaymentInvoice: (invoiceId: InvoiceId) => void;
  onRemovePaymentInvoice: (invoiceId: InvoiceId) => void;
  onUpdatePaymentItem: (
    invoiceId: InvoiceId,
    field: 'currency' | 'amount' | 'provider' | 'accountSummary',
    value: string | number,
  ) => void;
  onSubmitReview: () => void;
  onReturnReview: () => void;
  onApproveReview: () => void;
};

const projectInternalId = (project: ProjectSummary) => (
  (project.projectId ?? project.id) as ProjectId
);

const contractStableId = (contract: ContractRecord) => contract.contractId ?? contract.id;

const invoiceAccountSummary = (invoice: GeneratedInvoiceRecord) => {
  const payment = invoice.snapshot.payment;
  if (invoice.snapshot.paymentMethod === 'paypal') {
    return payment.paypalEmail || payment.paypalUsername || '待补充 PayPal';
  }
  const account = (payment.iban || payment.accountNumber).replace(/\s/g, '');
  return account ? `账户尾号 ${account.slice(-4)}` : '待补充银行账户';
};

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
  if (paymentList.status === 'approved') return '已完成';
  if (paymentList.status === 'submitted') return '已提交';
  return '草稿';
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

export const isContractInvoiceSelectable = (contract: ContractRecord) => (
  contract.lifecycle === 'CONFIRMED'
  || (!contract.lifecycle && contract.signed && getContractReadiness(contract).ready)
);

export const toggleInvoiceContractId = (
  contractIds: ContractId[] | undefined,
  contractId: ContractId,
) => {
  const ids = contractIds ?? [];
  return ids.includes(contractId)
    ? ids.filter((id) => id !== contractId)
    : [...ids, contractId];
};

export const prepareInvoiceForProjectUpdate = (
  invoice: GeneratedInvoiceRecord,
): GeneratedInvoiceRecord => {
  const firstItem = invoice.snapshot.items[0];
  const normalized = firstItem ? normalizeLineItem(firstItem) : null;
  return {
    ...invoice,
    validationStatus: 'needs_review',
    snapshot: {
      ...invoice.snapshot,
      items: normalized
        ? [normalized, ...invoice.snapshot.items.slice(1)]
        : invoice.snapshot.items,
    },
  };
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
  kind: CreateDialogKind;
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
  paymentList,
  auditEvents,
  currentUser,
  onOpenContract,
  onOpenInvoice,
  onCreateContract,
  onCreateInvoice,
  onLinkContract,
  onUnlinkContract,
  onDeleteContract,
  onLinkInvoice,
  onUnlinkInvoice,
  onDeleteInvoice,
  onUpdateInvoice,
  onCreatePaymentList,
  onDeletePaymentList,
  onAddPaymentInvoice,
  onRemovePaymentInvoice,
  onUpdatePaymentItem,
  onSubmitReview,
  onReturnReview,
  onApproveReview,
}: Props) {
  const reviewStatus = project.reviewStatus ?? 'draft';
  const canEdit = canEditProject(currentUser, reviewStatus);
  const [resourceDialog, setResourceDialog] = useState<ResourceDialogKind | null>(null);
  const [createDialog, setCreateDialog] = useState<CreateDialogKind | null>(null);
  const [createEngagementId, setCreateEngagementId] = useState('');
  const [linkDialog, setLinkDialog] = useState<CreateDialogKind | null>(null);
  const [linkId, setLinkId] = useState('');
  const [editingInvoice, setEditingInvoice] = useState<GeneratedInvoiceRecord | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');

  const references = (project.creatorProfiles ?? []).filter((reference) => reference.status !== 'removed');
  const projectId = projectInternalId(project);
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
    !paymentList?.items.some((item) => item.invoiceId === invoice.invoiceId)
  ));

  const createOptions = references.map((reference) => {
    const creator = referenceLabel(reference, creators);
    const hasInvoice = linkedInvoices.some((invoice) => invoice.snapshot.engagementId === reference.engagementId);
    return {
      value: reference.engagementId,
      label: creator.name,
      description: `${creator.handle} · ${creator.platform}${createDialog === 'invoice' && hasInvoice ? ' · 已有 Invoice' : ''}`,
      disabled: createDialog === 'invoice' && hasInvoice,
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
    if (createDialog === 'contract') onCreateContract(engagementId);
    else onCreateInvoice(engagementId);
    setCreateDialog(null);
    setCreateEngagementId('');
  };

  const openLinkDialog = (kind: CreateDialogKind) => {
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

  const openInvoiceEditor = (invoice: GeneratedInvoiceRecord) => {
    setResourceDialog(null);
    setEditingInvoice(structuredClone(invoice));
  };

  const closeInvoiceEditor = () => {
    setEditingInvoice(null);
    setResourceDialog('invoice');
  };

  const saveInvoiceEdit = () => {
    if (!editingInvoice) return;
    onUpdateInvoice(prepareInvoiceForProjectUpdate(editingInvoice));
    setEditingInvoice(null);
    setResourceDialog('invoice');
  };

  const editingInvoiceContracts = editingInvoice
    ? linkedContracts.filter((contract) => contract.engagementId === editingInvoice.snapshot.engagementId)
    : [];

  const resourceRows = [
    {
      kind: 'contract' as const,
      icon: FileText,
      label: '合同',
      count: linkedContracts.length,
      title: linkedContracts.length ? `${linkedContracts.length} 份合同` : '尚未关联合同',
      description: linkedContracts.length
        ? `覆盖 ${contractCreatorCount} 位达人 · ${coveredContracts.length} 份已被 Invoice 覆盖`
        : '合同非必填，可生成合同或关联已有合同/IO 单',
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
        : '提交审核前，每位项目达人必须有且仅有一份 Invoice',
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
      title: paymentList?.paymentListCode ?? '付款清单尚未生成',
      description: paymentList
        ? `${paymentList.items.length} 笔达人付款明细 · 来源为项目已关联 Invoice`
        : '每个项目最多一份，生成后汇总全部达人付款行',
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
            <Button icon={<ShieldCheck size={16} />} onClick={onSubmitReview}>提交请款审核</Button>
          ) : null}
          {(currentUser.roleKey === 'admin' || currentUser.roleKey === 'owner') && reviewStatus === 'submitted' ? (
            <>
              <Button variant="secondary" onClick={onReturnReview}>退回修改</Button>
              <Button onClick={onApproveReview}>审核通过</Button>
            </>
          ) : null}
        </div>
      </div>

      {!canEdit ? (
        <NoticeBanner>
          当前账号在“{projectReviewStatusLabel[reviewStatus]}”状态下仅可查看项目资料。媒介需等待审核退回后修改；管理员和老板不受状态限制。
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
                <Button variant="ghost" icon={<FilePlus2 size={15} />} onClick={() => openCreateDialog('contract')}>生成合同</Button>
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
                            <button className="danger" type="button" onClick={() => {
                              if (window.confirm(`确认删除合同 ${contract.id}？源记录会同步从合同管理删除。`)) {
                                onDeleteContract(contractStableId(contract));
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
                <FileText size={23} />
                <strong>当前项目尚未关联合同</strong>
                <p>合同不是 Invoice 的必填项；有权限的账号可生成合同，或关联同一项目达人的已有合同/IO 单。</p>
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
                            <button type="button" onClick={() => openInvoiceEditor(invoice)}><Pencil size={14} />编辑</button>
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
          footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}
        >
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading">
              <div>
                <strong>项目付款清单</strong>
                <p>每个项目最多一份，付款行来自本项目已关联且尚未入单的 Invoice。</p>
              </div>
              <span>{paymentList?.paymentListCode ?? projectCode}</span>
            </div>

            {canEdit ? (
              <div className="project-resource-browser-toolbar">
                {paymentList ? (
                  <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => {
                    if (window.confirm(`确认删除付款清单 ${paymentList.paymentListCode}？Invoice 不会被删除。`)) {
                      onDeletePaymentList();
                    }
                  }}>删除清单</Button>
                ) : (
                  <Button icon={<FilePlus2 size={15} />} onClick={onCreatePaymentList}>生成付款清单</Button>
                )}
              </div>
            ) : null}

            {paymentList ? (
              <>
                <div className="project-payment-list-meta">
                  <strong>{paymentList.paymentListCode}</strong>
                  <span>{paymentList.items.length} 笔付款 · {paymentListStatusLabel(paymentList)}</span>
                </div>
                <div className="project-payment-rows">
                  {paymentList.items.map((item) => (
                    <div className="project-payment-row" key={item.invoiceId}>
                      <div>
                        <strong>{item.snapshot.creatorName}</strong>
                        <span>{item.snapshot.invoiceNumber}</span>
                      </div>
                      <label>
                        <span>币种</span>
                        <input disabled={!canEdit} value={paymentListItemValue(item, 'currency')} onChange={(event) => onUpdatePaymentItem(item.invoiceId, 'currency', event.target.value.toUpperCase())} />
                      </label>
                      <label>
                        <span>金额</span>
                        <input disabled={!canEdit} type="number" min="0" step="0.01" value={paymentListItemValue(item, 'amount')} onChange={(event) => onUpdatePaymentItem(item.invoiceId, 'amount', Number(event.target.value))} />
                      </label>
                      <label>
                        <span>渠道</span>
                        <input disabled={!canEdit} value={paymentListItemValue(item, 'provider')} onChange={(event) => onUpdatePaymentItem(item.invoiceId, 'provider', event.target.value)} />
                      </label>
                      <label>
                        <span>账户快照</span>
                        <input disabled={!canEdit} value={paymentListItemValue(item, 'accountSummary')} onChange={(event) => onUpdatePaymentItem(item.invoiceId, 'accountSummary', event.target.value)} />
                      </label>
                      {canEdit ? (
                        <button type="button" aria-label={`移除 ${item.snapshot.invoiceNumber}`} onClick={() => {
                          if (window.confirm(`确认从付款清单移除 ${item.snapshot.invoiceNumber}？Invoice 源记录会保留。`)) {
                            onRemovePaymentInvoice(item.invoiceId);
                          }
                        }}><Trash2 size={15} /></button>
                      ) : null}
                    </div>
                  ))}
                  {!paymentList.items.length ? <p className="project-resource-empty-line">清单尚无付款行，请从已关联 Invoice 添加。</p> : null}
                </div>
                {canEdit ? (
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
                        onAddPaymentInvoice(paymentInvoiceId as InvoiceId);
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

      {createDialog ? (
        <Modal
          title={createDialog === 'contract' ? '选择达人并生成合同' : '选择达人并生成 Invoice'}
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

      {editingInvoice ? (
        <Modal
          title={`编辑 Invoice · ${editingInvoice.id}`}
          width="760px"
          onClose={closeInvoiceEditor}
          footer={(
            <>
              <Button variant="ghost" onClick={closeInvoiceEditor}>取消</Button>
              <Button onClick={saveInvoiceEdit}>保存并重新校验</Button>
            </>
          )}
        >
          <div className="project-invoice-edit-grid">
            <label>
              <span>Invoice 日期</span>
              <input type="date" value={editingInvoice.snapshot.invoiceDate} onChange={(event) => setEditingInvoice((current) => current ? ({ ...current, snapshot: { ...current.snapshot, invoiceDate: event.target.value } }) : current)} />
            </label>
            <label>
              <span>币种</span>
              <input value={editingInvoice.snapshot.currency} onChange={(event) => setEditingInvoice((current) => current ? ({ ...current, snapshot: { ...current.snapshot, currency: event.target.value.toUpperCase() as InvoiceCurrency } }) : current)} />
            </label>
            <label className="full-width">
              <span>费用描述</span>
              <input value={editingInvoice.snapshot.items[0]?.description ?? ''} onChange={(event) => setEditingInvoice((current) => current ? ({
                ...current,
                snapshot: {
                  ...current.snapshot,
                  items: current.snapshot.items.map((item, index) => index === 0 ? { ...item, description: event.target.value } : item),
                },
              }) : current)} />
            </label>
            <label>
              <span>首项金额</span>
              <input type="number" min="0" step="0.01" value={editingInvoice.snapshot.items[0]?.unitPrice ?? 0} onChange={(event) => setEditingInvoice((current) => current ? ({
                ...current,
                snapshot: {
                  ...current.snapshot,
                  items: current.snapshot.items.map((item, index) => index === 0 ? normalizeLineItem({ ...item, unitPrice: Number(event.target.value) }) : item),
                },
              }) : current)} />
            </label>
            <label>
              <span>账户快照</span>
              <input value={invoiceAccountSummary(editingInvoice)} readOnly />
            </label>
            <fieldset className="project-invoice-contract-selector full-width">
              <legend>覆盖合同 / IO 单</legend>
              <p>仅可新增已确认合同；不选择合同时，Invoice 只执行自身校验。</p>
              <div>
                {editingInvoiceContracts.map((contract) => {
                  const checked = Boolean(
                    contract.contractId
                    && editingInvoice.snapshot.contractIds?.includes(contract.contractId),
                  );
                  const selectable = isContractInvoiceSelectable(contract);
                  return (
                    <label key={contractStableId(contract)}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!contract.contractId || (!selectable && !checked)}
                        onChange={() => setEditingInvoice((current) => {
                          if (!current || !contract.contractId) return current;
                          return {
                            ...current,
                            snapshot: {
                              ...current.snapshot,
                              contractIds: toggleInvoiceContractId(
                                current.snapshot.contractIds,
                                contract.contractId,
                              ),
                            },
                          };
                        })}
                      />
                      <span>
                        <strong>{contract.id} · {contract.ioId || 'IO 待补充'}</strong>
                        <small>{selectable ? `${formatContractMoney(contract)} · 已确认` : '合同未确认，暂不可新增覆盖'}</small>
                      </span>
                    </label>
                  );
                })}
                {!editingInvoiceContracts.length ? <span className="project-resource-empty-line">该达人暂无已关联的合同/IO 单。</span> : null}
              </div>
            </fieldset>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
