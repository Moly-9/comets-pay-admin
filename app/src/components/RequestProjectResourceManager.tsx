import {
  AlertTriangle,
  Download,
  Eraser,
  Eye,
  FilePlus2,
  FileText,
  Link2,
  Pencil,
  ReceiptText,
  RefreshCw,
  Trash2,
  Unlink,
  Upload,
  WalletCards,
} from 'lucide-react';
import { useState } from 'react';
import {
  paymentListEffectiveAccount,
  paymentListItemValue,
  type ContractId,
  type InvoiceId,
  type PaymentListEditableField,
  type PaymentListId,
  type PaymentListRecord,
} from '../businessWorkflow';
import { formatContractMoney, getContractReadiness, isConfirmedContract, type ContractRecord, type ContractUploadInput } from '../contracts';
import type { SystemUser } from '../data';
import { canDeleteContract } from '../permissions';
import { formatInvoiceMoney, invoiceTotal } from '../invoice/invoiceUtils';
import { maskInvoiceAccountValue } from '../invoice/invoiceReviewWorkflow';
import {
  contractCooperationProjectId,
  invoiceCooperationProjectId,
  paymentRequestInvoiceIds,
  requestOwningInvoice,
  type PaymentRequestCreatorLink,
  type PaymentRequestProjectLike,
} from '../paymentRequestProjects';
import {
  eligibleInvoicePayoutAccounts,
  getPayoutAccountId,
  getPayoutAccountIdentifier,
} from '../payoutAccounts';
import type { RequestProjectSummary } from '../pages/RequestProjectDetailPage';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type { CreatorProfile, GeneratedInvoiceRecord } from '../types';
import { Button, Modal, NoticeBanner, SelectField } from './Common';
import { ContractUploadWizard } from './ContractUploadWizard';

type ResourceKind = 'contract' | 'invoice' | 'payment';
type ConfirmAction = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => void;
};

type Props = {
  request: RequestProjectSummary;
  cooperationProject: ProjectSummary;
  requests: RequestProjectSummary[];
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
  paymentLists: PaymentListRecord[];
  currentUser: SystemUser;
  onChangeLinks: (links: PaymentRequestCreatorLink[], summary: string) => void;
  onOpenContract: (contractId: string) => void;
  onOpenInvoice: (invoiceId: InvoiceId) => void;
  onGenerateContract: () => void;
  onGenerateInvoice: () => void;
  onUploadContract: (input: ContractUploadInput) => ContractRecord;
  onDeleteContract: (contractId: ContractId) => void;
  onDeleteInvoice: (invoiceId: InvoiceId) => void;
  onGeneratePaymentLists: () => void;
  onClearPaymentLists: () => void;
  onRemovePaymentInvoice: (paymentListId: PaymentListId, invoiceId: InvoiceId) => void;
  onUpdatePaymentItem: (
    paymentListId: PaymentListId,
    invoiceId: InvoiceId,
    field: PaymentListEditableField,
    value: string | number,
  ) => void;
  onChangePaymentAccount: (paymentListId: PaymentListId, invoiceId: InvoiceId, payoutAccountId: string) => void;
  onRevalidatePaymentItem: (paymentListId: PaymentListId, invoiceId: InvoiceId) => void;
  onBeginEditPaymentList: (paymentListId: PaymentListId) => void;
  onGeneratePaymentListVersion: (paymentListId: PaymentListId) => void;
  onExportPaymentList: (paymentListId: PaymentListId) => Promise<void>;
};

export type RequestProjectResourceActions = {
  onChangeLinks: (request: RequestProjectSummary, links: PaymentRequestCreatorLink[], summary: string) => void;
  onOpenContract: (request: RequestProjectSummary, contractId: string) => void;
  onOpenInvoice: (request: RequestProjectSummary, invoiceId: InvoiceId) => void;
  onGenerateContract: (request: RequestProjectSummary) => void;
  onGenerateInvoice: (request: RequestProjectSummary) => void;
  onUploadContract: (request: RequestProjectSummary, input: ContractUploadInput) => ContractRecord;
  onDeleteContract: (request: RequestProjectSummary, contractId: ContractId) => void;
  onDeleteInvoice: (request: RequestProjectSummary, invoiceId: InvoiceId) => void;
  onClearPaymentLists: (request: RequestProjectSummary) => void;
  onRemovePaymentInvoice: (request: RequestProjectSummary, paymentListId: PaymentListId, invoiceId: InvoiceId) => void;
  onUpdatePaymentItem: (request: RequestProjectSummary, paymentListId: PaymentListId, invoiceId: InvoiceId, field: PaymentListEditableField, value: string | number) => void;
  onChangePaymentAccount: (request: RequestProjectSummary, paymentListId: PaymentListId, invoiceId: InvoiceId, payoutAccountId: string) => void;
  onRevalidatePaymentItem: (request: RequestProjectSummary, paymentListId: PaymentListId, invoiceId: InvoiceId) => void;
  onBeginEditPaymentList: (request: RequestProjectSummary, paymentListId: PaymentListId) => void;
  onGeneratePaymentListVersion: (request: RequestProjectSummary, paymentListId: PaymentListId) => void;
  onExportPaymentList: (request: RequestProjectSummary, paymentListId: PaymentListId) => Promise<void>;
};

export const canEditRequestProjectResources = (
  user: SystemUser,
  lifecycle: RequestProjectSummary['lifecycle'],
) => (
  user.roleKey === 'admin'
  || user.roleKey === 'owner'
  || (user.roleKey === 'media' && ['DRAFT', 'RETURNED'].includes(lifecycle ?? 'DRAFT'))
);

const contractStableId = (contract: ContractRecord) => contract.contractId ?? contract.id as ContractId;

const creatorFor = (creatorId: string, creators: CreatorProfile[]) => (
  creators.find((creator) => creator.id === creatorId)
);

const paymentListStatusLabel = (status: PaymentListRecord['status']) => {
  if (status === 'paid') return '已付款';
  if (status === 'approved') return '已批准';
  if (status === 'submitted') return '已提交';
  if (status === 'generated') return '已生成';
  return '草稿';
};

const requestLinksByCreator = (request: RequestProjectSummary) => new Map(
  (request.creatorLinks ?? []).map((link) => [link.creatorId, link]),
);

export const contractAssociationCandidates = (
  contracts: ContractRecord[],
  cooperationProjectId: string | undefined,
) => cooperationProjectId ? contracts.filter((contract) => (
  !contract.isTemplate
  && contractCooperationProjectId(contract) === cooperationProjectId
)) : [];

const contractStateUnavailableReason = (contract: ContractRecord) => {
  if (contract.lifecycle === 'GENERATED_DRAFT') return '草稿尚未回传签署文件';
  if (contract.lifecycle === 'UPLOADED_PENDING_CONFIRMATION') return '已上传，待人工确认';
  if (!contract.signed) return '合同尚未完成签署';
  return getContractReadiness(contract).label;
};

export const contractAssociationUnavailableReason = (
  contract: ContractRecord,
  links: PaymentRequestCreatorLink[],
  creators: CreatorProfile[],
) => {
  if (!contract.contractId) return '合同缺少稳定合同 ID';
  if (!contract.creatorId) return '合同缺少达人稳定 ID';
  if (!creatorFor(contract.creatorId, creators)) return '合同关联的达人档案不存在';
  if (!contract.engagementId) return '合同缺少合作关系 ID';
  const existingLink = links.find((link) => link.creatorId === contract.creatorId);
  if (existingLink && existingLink.engagementId !== contract.engagementId) {
    return '达人已通过其他合作关系加入当前请款项目';
  }
  return isConfirmedContract(contract) ? '' : contractStateUnavailableReason(contract);
};

export const mergeContractCandidateLinks = (
  links: PaymentRequestCreatorLink[],
  contracts: ContractRecord[],
) => {
  const next = links.map((link) => ({
    ...link,
    contractIds: [...link.contractIds],
    invoiceIds: [...link.invoiceIds],
  }));
  const linkIndexByCreator = new Map(next.map((link, index) => [link.creatorId, index]));

  contracts.forEach((contract) => {
    if (!contract.contractId || !contract.creatorId || !contract.engagementId) return;
    const existingIndex = linkIndexByCreator.get(contract.creatorId);
    if (existingIndex !== undefined) {
      const existing = next[existingIndex];
      if (!existing || existing.engagementId !== contract.engagementId) return;
      existing.contractIds = [...new Set([...existing.contractIds, contract.contractId])];
      return;
    }
    next.push({
      creatorId: contract.creatorId,
      engagementId: contract.engagementId,
      contractIds: [contract.contractId],
      invoiceIds: [],
    });
    linkIndexByCreator.set(contract.creatorId, next.length - 1);
  });

  return next;
};

export const invoiceAssociationCandidates = (
  invoices: GeneratedInvoiceRecord[],
  cooperationProjectId: string | undefined,
) => cooperationProjectId ? invoices.filter((invoice) => (
  invoiceCooperationProjectId(invoice) === cooperationProjectId
)) : [];

export const invoiceAssociationUnavailableReason = (
  invoice: GeneratedInvoiceRecord,
  links: PaymentRequestCreatorLink[],
  creators: CreatorProfile[],
  requests: PaymentRequestProjectLike[],
  excludeRequestId?: PaymentRequestProjectLike['paymentRequestProjectId'],
) => {
  if (!invoice.invoiceId) return 'Invoice 缺少稳定 Invoice ID';
  if (!invoice.snapshot.creatorId) return 'Invoice 缺少达人稳定 ID';
  if (!creatorFor(invoice.snapshot.creatorId, creators)) return 'Invoice 关联的达人档案不存在';
  if (!invoice.snapshot.engagementId) return 'Invoice 缺少合作关系 ID';
  const existingLink = links.find((link) => link.creatorId === invoice.snapshot.creatorId);
  if (existingLink && existingLink.engagementId !== invoice.snapshot.engagementId) {
    return '达人已通过其他合作关系加入当前请款项目';
  }
  const owner = requestOwningInvoice(requests, invoice.invoiceId, excludeRequestId);
  return owner ? `已关联 ${owner.requestCode ?? owner.id}` : '';
};

export const mergeInvoiceCandidateLinks = (
  links: PaymentRequestCreatorLink[],
  invoices: GeneratedInvoiceRecord[],
) => {
  const next = links.map((link) => ({
    ...link,
    contractIds: [...link.contractIds],
    invoiceIds: [...link.invoiceIds],
  }));
  const linkIndexByCreator = new Map(next.map((link, index) => [link.creatorId, index]));

  invoices.forEach((invoice) => {
    const { creatorId, engagementId } = invoice.snapshot;
    if (!invoice.invoiceId || !creatorId || !engagementId) return;
    const existingIndex = linkIndexByCreator.get(creatorId);
    if (existingIndex !== undefined) {
      const existing = next[existingIndex];
      if (!existing || existing.engagementId !== engagementId) return;
      existing.invoiceIds = [...new Set([...existing.invoiceIds, invoice.invoiceId])];
      return;
    }
    next.push({
      creatorId,
      engagementId,
      contractIds: [],
      invoiceIds: [invoice.invoiceId],
    });
    linkIndexByCreator.set(creatorId, next.length - 1);
  });

  return next;
};

export const requestLinkedContracts = (
  request: RequestProjectSummary,
  contracts: ContractRecord[],
) => {
  const ids = new Set((request.creatorLinks ?? []).flatMap((link) => link.contractIds));
  return contracts.filter((contract) => ids.has(contractStableId(contract)));
};

export const requestLinkedInvoices = (
  request: RequestProjectSummary,
  invoices: GeneratedInvoiceRecord[],
) => {
  const ids = new Set(paymentRequestInvoiceIds(request.creatorLinks ?? []));
  return invoices.filter((invoice) => ids.has(invoice.invoiceId));
};

const PAYMENT_FEE_OPTIONS = [
  { value: 'ADVERTISER', label: '付款方承担', description: 'SWIFT 使用 OUR' },
  { value: 'PUBLISHER', label: '收款方承担', description: 'SWIFT 使用 SHA' },
  { value: 'SHARED', label: '共同承担', description: 'SWIFT 使用 SHA' },
];

export function RequestProjectResourceManager({
  request,
  cooperationProject,
  requests,
  creators,
  contracts,
  invoices,
  paymentLists,
  currentUser,
  onChangeLinks,
  onOpenContract,
  onOpenInvoice,
  onGenerateContract,
  onGenerateInvoice,
  onUploadContract,
  onDeleteContract,
  onDeleteInvoice,
  onGeneratePaymentLists,
  onClearPaymentLists,
  onRemovePaymentInvoice,
  onUpdatePaymentItem,
  onChangePaymentAccount,
  onRevalidatePaymentItem,
  onBeginEditPaymentList,
  onGeneratePaymentListVersion,
  onExportPaymentList,
}: Props) {
  const [resourceDialog, setResourceDialog] = useState<ResourceKind | null>(null);
  const [linkDialog, setLinkDialog] = useState<'contract' | 'invoice' | null>(null);
  const [contractCreatorFilter, setContractCreatorFilter] = useState('ALL');
  const [invoiceCreatorFilter, setInvoiceCreatorFilter] = useState('ALL');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [selectedLinkedInvoiceIds, setSelectedLinkedInvoiceIds] = useState<InvoiceId[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const canEdit = canEditRequestProjectResources(currentUser, request.lifecycle);
  const links = request.creatorLinks ?? [];
  const linkByCreator = requestLinksByCreator(request);
  const cooperationProjectId = request.cooperationProjectId ?? request.projectId;
  const linkedContracts = requestLinkedContracts(request, contracts);
  const linkedInvoices = requestLinkedInvoices(request, invoices);
  const requestPaymentLists = paymentLists.filter((list) => (
    list.paymentRequestProjectId === request.paymentRequestProjectId
  ));
  const currentPaymentList = requestPaymentLists[0] ?? null;
  const paymentItemCount = requestPaymentLists.reduce((sum, list) => sum + list.items.length, 0);
  const paymentListEditing = currentPaymentList?.status === 'draft';
  const paymentListExportable = Boolean(
    currentPaymentList
    && !['draft', 'submitted'].includes(currentPaymentList.status),
  );

  const generateOrRefreshPaymentList = () => {
    if (currentPaymentList?.status === 'draft' && currentPaymentList.items.length) {
      onGeneratePaymentListVersion(currentPaymentList.paymentListId);
      return;
    }
    onGeneratePaymentLists();
  };

  const contractCandidates = contractAssociationCandidates(contracts, cooperationProjectId);

  const invoiceCandidates = invoiceAssociationCandidates(invoices, cooperationProjectId);

  const openLinkDialog = (kind: 'contract' | 'invoice') => {
    setSelectedCandidateIds([]);
    if (kind === 'contract') setContractCreatorFilter('ALL');
    if (kind === 'invoice') setInvoiceCreatorFilter('ALL');
    setResourceDialog(null);
    setLinkDialog(kind);
  };

  const toggleCandidate = (id: string) => {
    setSelectedCandidateIds((current) => current.includes(id)
      ? current.filter((candidateId) => candidateId !== id)
      : [...current, id]);
  };

  const commitCandidates = () => {
    if (!linkDialog || !selectedCandidateIds.length) return;
    if (linkDialog === 'contract') {
      const additions = contractCandidates
        .filter((contract) => selectedCandidateIds.includes(contractStableId(contract)))
        .filter((contract) => !contractAssociationUnavailableReason(contract, links, creators));
      const next = mergeContractCandidateLinks(links, additions);
      const addedCreatorCount = next.length - links.length;
      onChangeLinks(
        next,
        addedCreatorCount
          ? `已关联合同，并新增 ${addedCreatorCount} 位合同所属达人`
          : '已批量关联合同',
      );
      setLinkDialog(null);
      setResourceDialog('contract');
      setSelectedCandidateIds([]);
      return;
    }
    const additions = invoiceCandidates
      .filter((invoice) => selectedCandidateIds.includes(invoice.invoiceId))
      .filter((invoice) => !invoiceAssociationUnavailableReason(
        invoice,
        links,
        creators,
        requests as PaymentRequestProjectLike[],
        request.paymentRequestProjectId,
      ));
    const next = mergeInvoiceCandidateLinks(links, additions);
    const addedCreatorCount = next.length - links.length;
    onChangeLinks(
      next,
      addedCreatorCount
        ? `已关联 Invoice，并新增 ${addedCreatorCount} 位 Invoice 所属达人`
        : '已批量关联 Invoice',
    );
    setLinkDialog(null);
    setResourceDialog(linkDialog);
    setSelectedCandidateIds([]);
  };

  const unlinkContract = (contractId: ContractId) => {
    onChangeLinks(links.map((link) => ({
      ...link,
      contractIds: link.contractIds.filter((id) => id !== contractId),
    })), `已解除合同 ${contractId} 与当前请款项目的关联`);
  };

  const unlinkInvoices = (invoiceIds: InvoiceId[]) => {
    if (!invoiceIds.length) return;
    const idSet = new Set(invoiceIds);
    onChangeLinks(links.map((link) => ({
      ...link,
      invoiceIds: link.invoiceIds.filter((id) => !idSet.has(id)),
    })), `已解除 ${invoiceIds.length} 份 Invoice 与当前请款项目的关联`);
    setSelectedLinkedInvoiceIds([]);
  };

  const linkedContractIds = new Set(linkedContracts.map(contractStableId));
  const linkedInvoiceIds = new Set(linkedInvoices.map((invoice) => invoice.invoiceId));
  const availableContractCandidates = contractCandidates.filter((contract) => !linkedContractIds.has(contractStableId(contract)));
  const contractCreatorOptions = [
    {
      value: 'ALL',
      label: '全部达人',
      description: `${availableContractCandidates.length} 份候选合同`,
    },
    ...[...new Set(availableContractCandidates.flatMap((contract) => (
      contract.creatorId ? [contract.creatorId] : []
    )))].map((creatorId) => {
      const creator = creatorFor(creatorId, creators);
      const count = availableContractCandidates.filter((contract) => contract.creatorId === creatorId).length;
      return {
        value: creatorId,
        label: creator?.name ?? creatorId,
        description: `${creator?.handle ?? '达人档案缺失'} · ${count} 份合同`,
      };
    }),
  ];
  const filteredContractCandidates = availableContractCandidates.filter((contract) => (
    contractCreatorFilter === 'ALL' || contract.creatorId === contractCreatorFilter
  ));
  const availableInvoiceCandidates = invoiceCandidates.filter((invoice) => !linkedInvoiceIds.has(invoice.invoiceId));
  const invoiceCreatorOptions = [
    {
      value: 'ALL',
      label: '全部达人',
      description: `${availableInvoiceCandidates.length} 份候选 Invoice`,
    },
    ...[...new Set(availableInvoiceCandidates.flatMap((invoice) => (
      invoice.snapshot.creatorId ? [invoice.snapshot.creatorId] : []
    )))].map((creatorId) => {
      const creator = creatorFor(creatorId, creators);
      const count = availableInvoiceCandidates.filter((invoice) => (
        invoice.snapshot.creatorId === creatorId
      )).length;
      return {
        value: creatorId,
        label: creator?.name ?? creatorId,
        description: `${creator?.handle ?? '达人档案缺失'} · ${count} 份 Invoice`,
      };
    }),
  ];
  const filteredInvoiceCandidates = availableInvoiceCandidates.filter((invoice) => (
    invoiceCreatorFilter === 'ALL' || invoice.snapshot.creatorId === invoiceCreatorFilter
  ));

  return (
    <>
      <div className="project-resource-list">
        <article className="project-resource-row">
          <span className="project-resource-icon"><FileText size={19} /></span>
          <div className="project-resource-copy"><div className="project-resource-heading"><h3 className="project-resource-label">合同</h3><span className="project-resource-count">{linkedContracts.length} 条可查看</span></div><strong>{linkedContracts.length ? `${linkedContracts.length} 份合同` : '未关联合同（选填）'}</strong><small>已关联记录全部平铺展示</small></div>
          <span className="project-resource-status"><i />{linkedContracts.length ? '已关联' : '未关联'}</span>
          <button className="text-link project-resource-summary-open" type="button" onClick={() => setResourceDialog('contract')}>查看合同</button>
        </article>
        <article className="project-resource-row project-resource-row-invoice">
          <span className="project-resource-icon"><ReceiptText size={19} /></span>
          <div className="project-resource-copy"><div className="project-resource-heading"><h3 className="project-resource-label">Invoice</h3><span className="project-resource-count">{linkedInvoices.length} 条可查看</span></div><strong>{linkedInvoices.length} 份 Invoice</strong><small>同一达人可关联多份 Invoice</small></div>
          <span className="project-resource-status"><i />{linkedInvoices.length ? '已关联' : '待补资料'}</span>
          <button className="text-link project-resource-summary-open" type="button" onClick={() => setResourceDialog('invoice')}>查看 Invoice</button>
        </article>
        <article className="project-resource-row project-resource-row-payment">
          <span className="project-resource-icon"><WalletCards size={19} /></span>
          <div className="project-resource-copy"><div className="project-resource-heading"><h3 className="project-resource-label">付款清单</h3><span className="project-resource-count">{requestPaymentLists.reduce((sum, list) => sum + list.items.length, 0)} 条明细</span></div><strong>{requestPaymentLists.length ? requestPaymentLists.map((list) => list.paymentListCode).join('、') : '待生成'}</strong><small>按 Invoice 保留独立付款行</small></div>
          <span className="project-resource-status"><i />{requestPaymentLists.length ? paymentListStatusLabel(requestPaymentLists[0].status) : '未生成'}</span>
          <button className="text-link project-resource-summary-open" type="button" onClick={() => setResourceDialog('payment')}>查看清单</button>
        </article>
      </div>

      {!canEdit ? <NoticeBanner>当前账号在项目提交后仅可查看与导出资料。</NoticeBanner> : null}

      {resourceDialog === 'contract' ? (
        <Modal title={`${request.requestCode ?? request.id} · 合同资料`} width="1120px" className="project-resource-modal request-resource-modal" onClose={() => setResourceDialog(null)} footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}>
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading"><div><strong>全部合同</strong><p>平铺展示当前请款项目已关联的合同。</p></div><span>{linkedContracts.length} 份</span></div>
            {canEdit ? <div className="project-resource-browser-toolbar"><Button variant="ghost" icon={<FilePlus2 size={15} />} onClick={onGenerateContract}>生成合同</Button><Button variant="ghost" icon={<Upload size={15} />} onClick={() => { setResourceDialog(null); setUploadOpen(true); }}>上传合同</Button><Button variant="secondary" icon={<Link2 size={15} />} onClick={() => openLinkDialog('contract')}>关联已有合同</Button></div> : null}
            <div className="request-resource-flat-list">
              {linkedContracts.map((contract) => {
                const creator = contract.creatorId ? creatorFor(contract.creatorId, creators) : undefined;
                const contractId = contractStableId(contract);
                return <article className="request-resource-flat-row" key={contractId}><span className="project-contract-record-icon"><FileText size={18} /></span><div><strong>{contract.id}</strong><small>{contract.name}</small></div><div><span>达人</span><strong>{creator?.name ?? '达人档案缺失'}</strong><small>{creator ? `${creator.handle} · ${creator.platform}` : contract.creatorId}</small></div><div><span>合同 / IO</span><strong>{contract.ioId || 'IO 待补充'}</strong><small>{formatContractMoney(contract)}</small></div><span className="project-record-status"><i />{getContractReadiness(contract).label}</span><div className="project-contract-record-actions"><Button variant="secondary" icon={<Eye size={14} />} onClick={() => onOpenContract(contract.id)}>查看</Button>{canEdit ? <><button type="button" onClick={() => setConfirmAction({ title: '解除合同关联', description: `合同 ${contract.id} 源记录会保留，仅从当前请款项目移除。`, confirmLabel: '确认解除', run: () => unlinkContract(contractId) })}><Unlink size={14} />解除</button>{canDeleteContract(currentUser, contract) ? <button className="danger" type="button" onClick={() => setConfirmAction({ title: '删除合同源记录', description: `将删除 ${contract.id}；若被其他请款项目引用，系统会阻止操作。`, confirmLabel: '删除合同', danger: true, run: () => onDeleteContract(contractId) })}><Trash2 size={14} />删除</button> : null}</> : null}</div></article>;
              })}
              {!linkedContracts.length ? <div className="project-resource-browser-empty"><FileText size={23} /><strong>当前请款项目未关联合同</strong><p>合同选填，可上传、生成或关联已有记录。</p></div> : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {resourceDialog === 'invoice' ? (
        <Modal title={`${request.requestCode ?? request.id} · Invoice`} width="1080px" className="project-resource-modal request-resource-modal" onClose={() => setResourceDialog(null)} footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}>
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading"><div><strong>全部 Invoice</strong><p>平铺展示 {linkedInvoices.length} 份 Invoice，同一达人可关联多份。</p></div><span>{linkedInvoices.length} 份</span></div>
            {canEdit ? <div className="project-resource-browser-toolbar"><Button variant="ghost" icon={<FilePlus2 size={15} />} onClick={onGenerateInvoice}>生成 Invoice</Button><Button variant="secondary" icon={<Link2 size={15} />} onClick={() => openLinkDialog('invoice')}>关联已有 Invoice</Button>{selectedLinkedInvoiceIds.length ? <Button variant="danger" icon={<Unlink size={15} />} onClick={() => setConfirmAction({ title: '批量解除 Invoice 关联', description: `将从当前请款项目移除 ${selectedLinkedInvoiceIds.length} 份 Invoice，源记录保留。`, confirmLabel: '确认解除', run: () => unlinkInvoices(selectedLinkedInvoiceIds) })}>解除已选</Button> : null}</div> : null}
            <div className="request-resource-flat-list">
              {linkedInvoices.map((invoice) => {
                const creator = invoice.snapshot.creatorId ? creatorFor(invoice.snapshot.creatorId, creators) : undefined;
                const selected = selectedLinkedInvoiceIds.includes(invoice.invoiceId);
                return <article className="request-resource-flat-row request-resource-invoice-row" key={invoice.invoiceId}>{canEdit ? <label className="request-resource-select"><input type="checkbox" checked={selected} aria-label={`选择 ${invoice.id}`} onChange={() => setSelectedLinkedInvoiceIds((current) => selected ? current.filter((id) => id !== invoice.invoiceId) : [...current, invoice.invoiceId])} /></label> : <span className="project-contract-record-icon"><ReceiptText size={18} /></span>}<div><strong>{invoice.id}</strong><small>{invoice.status}</small></div><div><span>达人</span><strong>{creator?.name ?? invoice.snapshot.creatorName}</strong><small>{creator ? `${creator.handle} · ${creator.platform}` : invoice.snapshot.creatorHandle}</small></div><div><span>Invoice 金额</span><strong>{formatInvoiceMoney(invoice.snapshot.currency, invoiceTotal(invoice.snapshot))}</strong><small>{invoice.snapshot.contractIds?.length ?? 0} 份覆盖合同</small></div><span className="project-record-status"><i />{invoice.validationStatus === 'valid' ? '已校验' : '需重新校验'}</span><div className="project-contract-record-actions"><Button variant="secondary" icon={<Eye size={14} />} onClick={() => onOpenInvoice(invoice.invoiceId)}>查看</Button>{canEdit ? <><button type="button" onClick={() => setConfirmAction({ title: '解除 Invoice 关联', description: `${invoice.id} 源记录会保留，对应付款行将移除。`, confirmLabel: '确认解除', run: () => unlinkInvoices([invoice.invoiceId]) })}><Unlink size={14} />解除</button><button className="danger" type="button" onClick={() => setConfirmAction({ title: '删除 Invoice 源记录', description: `将删除 ${invoice.id}；若被其他项目引用，系统会阻止操作。`, confirmLabel: '删除 Invoice', danger: true, run: () => onDeleteInvoice(invoice.invoiceId) })}><Trash2 size={14} />删除</button></> : null}</div></article>;
              })}
              {!linkedInvoices.length ? <div className="project-resource-browser-empty"><ReceiptText size={23} /><strong>当前请款项目未关联 Invoice</strong><p>每位达人提交审批前至少需要一份 Invoice。</p></div> : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {resourceDialog === 'payment' ? (
        <Modal title={`${request.requestCode ?? request.id} · 付款清单`} width="1120px" className="project-resource-modal request-resource-modal" onClose={() => setResourceDialog(null)} footer={<Button variant="secondary" onClick={() => setResourceDialog(null)}>关闭</Button>}>
          <div className="project-resource-browser">
            <div className="project-resource-browser-heading"><div><strong>全部付款明细</strong><p>不按达人或渠道分组，每张 Invoice 保留独立付款行。</p></div><span>{paymentItemCount} 笔</span></div>
            {canEdit || currentPaymentList ? (
              <div className="project-resource-browser-toolbar request-payment-toolbar">
                {canEdit ? <Button icon={<RefreshCw size={15} />} disabled={!linkedInvoices.length} onClick={generateOrRefreshPaymentList}>生成 / 刷新清单</Button> : null}
                {currentPaymentList ? <Button variant="secondary" icon={<Download size={15} />} disabled={!paymentListExportable} onClick={() => { void onExportPaymentList(currentPaymentList.paymentListId); }}>导出 Excel</Button> : null}
                {canEdit && currentPaymentList ? <Button variant="secondary" icon={<Pencil size={15} />} disabled={paymentListEditing} onClick={() => onBeginEditPaymentList(currentPaymentList.paymentListId)}>{paymentListEditing ? '编辑中' : '编辑付款清单'}</Button> : null}
                {canEdit && currentPaymentList ? <Button variant="danger" icon={<Eraser size={15} />} disabled={!paymentItemCount} onClick={() => setConfirmAction({ title: '清空付款清单', description: `将清空当前付款清单的 ${paymentItemCount} 笔付款行。清单编号和历史版本保留，Invoice 源记录不受影响。`, confirmLabel: '确认清空', danger: true, run: onClearPaymentLists })}>清空清单</Button> : null}
              </div>
            ) : null}
            <div className="project-payment-rows request-payment-flat-rows">
              {requestPaymentLists.flatMap((list) => list.items.map((item) => {
                const creator = creators.find((candidate) => candidate.id === item.snapshot.creatorId);
                const effectiveAccount = paymentListEffectiveAccount(item);
                const editable = canEdit && list.status === 'draft';
                const accountOptions = eligibleInvoicePayoutAccounts(creator).map((account) => ({
                  value: getPayoutAccountId(account),
                  label: account.nickname,
                  description: `${account.provider} · ${maskInvoiceAccountValue(getPayoutAccountIdentifier(account))}`,
                }));
                return <article className="project-payment-row" id={`request-payment-row-${item.invoiceId}`} key={`${list.paymentListId}-${item.invoiceId}`}><header className="project-payment-row-header"><div><strong>{item.snapshot.creatorName}</strong><span>{item.snapshot.invoiceNumber} · {list.paymentListCode} · {list.provider}</span></div><div className="project-payment-row-actions">{editable && item.requiresRevalidation ? <button className="project-payment-revalidate" type="button" onClick={() => onRevalidatePaymentItem(list.paymentListId, item.invoiceId)}><RefreshCw size={12} />重新校验</button> : null}{editable ? <button type="button" aria-label={`移除 ${item.snapshot.invoiceNumber}`} onClick={() => setConfirmAction({ title: '移除付款明细', description: '仅从当前付款清单移除这笔明细，Invoice 和项目关联保留。', confirmLabel: '确认移除', run: () => onRemovePaymentInvoice(list.paymentListId, item.invoiceId) })}><Trash2 size={15} /></button> : null}</div></header><div className="project-payment-validation-row"><span className={item.requiresRevalidation ? 'project-payment-validation is-warning' : 'project-payment-validation'}>{item.requiresRevalidation ? item.validationIssues?.[0] ?? '需重新校验' : `${paymentListStatusLabel(list.status)} · ${effectiveAccount.provider}`}</span></div><div className="project-payment-fields"><label className="project-payment-account-field"><span>收款账户</span><SelectField ariaLabel={`${item.snapshot.creatorName} 收款账户`} variant="form" value={effectiveAccount.payoutAccountId ?? ''} options={accountOptions} placeholder={accountOptions.length ? '选择达人收款账户' : '暂无可用账户'} disabled={!editable || !accountOptions.length} onChange={(value) => onChangePaymentAccount(list.paymentListId, item.invoiceId, value)} /></label><label><span>支付币种</span><input disabled={!editable} value={paymentListItemValue(item, 'currency')} onChange={(event) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'currency', event.target.value.toUpperCase())} /></label><label><span>收款币种</span><input disabled={!editable} value={paymentListItemValue(item, 'receiveCurrency')} onChange={(event) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'receiveCurrency', event.target.value.toUpperCase())} /></label><label><span>金额</span><input disabled={!editable} type="number" min="0" step="0.01" value={paymentListItemValue(item, 'amount')} onChange={(event) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'amount', Number(event.target.value))} /></label><label><span>费用承担</span><SelectField ariaLabel={`${item.snapshot.creatorName} 费用承担`} variant="form" value={String(paymentListItemValue(item, 'feeBearer') ?? '')} options={PAYMENT_FEE_OPTIONS} disabled={!editable} onChange={(value) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'feeBearer', value)} /></label><label><span>付款原因</span><input disabled={!editable} value={paymentListItemValue(item, 'paymentReason')} onChange={(event) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'paymentReason', event.target.value)} /></label><label><span>交易附言</span><input disabled={!editable} value={paymentListItemValue(item, 'transactionReference')} onChange={(event) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'transactionReference', event.target.value)} /></label><label className="project-payment-description-field"><span>描述（选填）</span><input disabled={!editable} value={paymentListItemValue(item, 'description')} onChange={(event) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, 'description', event.target.value)} /></label></div><footer className="request-payment-row-footer"><span>{paymentListStatusLabel(list.status)}{list.version ? ` · v${list.version}` : ''}</span></footer></article>;
              }))}
              {!requestPaymentLists.length ? <div className="project-resource-browser-empty"><WalletCards size={23} /><strong>付款清单尚未生成</strong><p>请先关联 Invoice，再生成当前请款项目专属清单。</p></div> : null}
              {requestPaymentLists.length && !paymentItemCount ? <div className="project-resource-browser-empty"><WalletCards size={23} /><strong>付款清单已清空</strong><p>点击“生成 / 刷新清单”可按当前关联的 Invoice 重新生成付款行。</p></div> : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {linkDialog ? (
        <Modal title={linkDialog === 'contract' ? '关联已有合同' : '关联已有 Invoice'} width="920px" className="project-resource-modal request-resource-link-modal" onClose={() => { setLinkDialog(null); setResourceDialog(linkDialog); }} footer={<><Button variant="secondary" onClick={() => { setLinkDialog(null); setResourceDialog(linkDialog); }}>取消</Button><Button disabled={!selectedCandidateIds.length} onClick={commitCandidates}>关联已选（{selectedCandidateIds.length}）</Button></>}>
          <div className="project-resource-browser"><div className="project-resource-browser-heading"><div><strong>{linkDialog === 'contract' ? '合同候选' : 'Invoice 候选'}</strong><p>{linkDialog === 'contract' ? '展示当前合作项目下全部达人的合同；关联项目外达人合同时，会同步将该达人加入请款项目。' : '展示当前合作项目下全部达人的 Invoice；关联项目外达人时，会同步加入请款项目。'}</p></div><span>{linkDialog === 'contract' ? filteredContractCandidates.length : filteredInvoiceCandidates.length} 条</span></div><div className="request-resource-candidate-filter"><div><strong>按达人筛选</strong><small>{linkDialog === 'contract' ? '合同候选范围不会受当前请款项目达人名单限制' : 'Invoice 候选范围不会受当前请款项目达人名单限制'}</small></div>{linkDialog === 'contract' ? <SelectField ariaLabel="合同候选达人筛选" variant="form" value={contractCreatorFilter} options={contractCreatorOptions} onChange={setContractCreatorFilter} /> : <SelectField ariaLabel="Invoice 候选达人筛选" variant="form" value={invoiceCreatorFilter} options={invoiceCreatorOptions} onChange={setInvoiceCreatorFilter} />}</div><div className="request-resource-candidate-list">
            {linkDialog === 'contract' ? filteredContractCandidates.map((contract) => {
              const id = contractStableId(contract);
              const creator = contract.creatorId ? creatorFor(contract.creatorId, creators) : undefined;
              const currentLink = contract.creatorId ? linkByCreator.get(contract.creatorId) : undefined;
              const unavailableReason = contractAssociationUnavailableReason(contract, links, creators);
              const enabled = !unavailableReason;
              const selected = selectedCandidateIds.includes(id);
              return <article className={`request-resource-candidate${enabled ? '' : ' is-disabled'}`} key={id}><label><input type="checkbox" aria-label={`选择合同 ${contract.id}`} disabled={!enabled} checked={selected} onChange={() => toggleCandidate(id)} /><span><strong>{contract.id}</strong><small>{contract.name}</small></span></label><div className="request-resource-candidate-creator"><strong>{creator?.name ?? '达人档案缺失'}</strong><small>{creator ? `${creator.handle} · ${creator.platform}` : contract.creatorId}</small>{enabled ? currentLink ? <span className="is-existing">已在请款项目</span> : <span>关联后新增达人</span> : null}</div><div><strong>{enabled ? '可关联' : '不可关联'}</strong><small>{enabled ? `${formatContractMoney(contract)} · ${getContractReadiness(contract).label}` : unavailableReason}</small></div><button className="text-link" type="button" onClick={() => onOpenContract(contract.id)}>查看合同详情</button></article>;
            }) : filteredInvoiceCandidates.map((invoice) => {
              const creator = invoice.snapshot.creatorId ? creatorFor(invoice.snapshot.creatorId, creators) : undefined;
              const currentLink = invoice.snapshot.creatorId ? linkByCreator.get(invoice.snapshot.creatorId) : undefined;
              const unavailableReason = invoiceAssociationUnavailableReason(
                invoice,
                links,
                creators,
                requests as PaymentRequestProjectLike[],
                request.paymentRequestProjectId,
              );
              const enabled = !unavailableReason;
              const selected = selectedCandidateIds.includes(invoice.invoiceId);
              return <article className={`request-resource-candidate${enabled ? '' : ' is-disabled'}`} key={invoice.invoiceId}><label><input type="checkbox" aria-label={`选择 Invoice ${invoice.id}`} disabled={!enabled} checked={selected} onChange={() => toggleCandidate(invoice.invoiceId)} /><span><strong>{invoice.id}</strong><small>{invoice.status}</small></span></label><div className="request-resource-candidate-creator"><strong>{creator?.name ?? invoice.snapshot.creatorName}</strong><small>{creator ? `${creator.handle} · ${creator.platform}` : invoice.snapshot.creatorHandle}</small>{enabled ? currentLink ? <span className="is-existing">已在请款项目</span> : <span>关联后新增达人</span> : null}</div><div><strong>{enabled ? formatInvoiceMoney(invoice.snapshot.currency, invoiceTotal(invoice.snapshot)) : '不可关联'}</strong><small>{enabled ? `${invoice.snapshot.contractIds?.length ?? 0} 份覆盖合同` : unavailableReason}</small></div><button className="text-link" type="button" onClick={() => onOpenInvoice(invoice.invoiceId)}>查看 Invoice</button></article>;
            })}
            {linkDialog === 'contract' && !filteredContractCandidates.length ? <div className="request-resource-candidate-empty"><FileText size={22} /><strong>暂无符合条件的合同</strong><small>可切换达人查看该合作项目下的其他合同。</small></div> : null}
            {linkDialog === 'invoice' && !filteredInvoiceCandidates.length ? <div className="request-resource-candidate-empty"><ReceiptText size={22} /><strong>暂无符合条件的 Invoice</strong><small>可切换达人查看该合作项目下的其他 Invoice。</small></div> : null}
          </div></div>
        </Modal>
      ) : null}

      {uploadOpen ? <ContractUploadWizard projects={[cooperationProject]} creators={creators.filter((creator) => linkByCreator.has(creator.id as PaymentRequestCreatorLink['creatorId']))} contracts={contracts} onClose={() => { setUploadOpen(false); setResourceDialog('contract'); }} onSave={(input) => { const record = onUploadContract(input); setUploadOpen(false); onOpenContract(record.id); }} /> : null}

      {confirmAction ? <Modal title={confirmAction.title} width="460px" className="project-payment-remove-modal" onClose={() => setConfirmAction(null)} footer={<><Button variant="secondary" onClick={() => setConfirmAction(null)}>取消</Button><Button variant={confirmAction.danger ? 'danger' : 'primary'} onClick={() => { confirmAction.run(); setConfirmAction(null); }}>{confirmAction.confirmLabel}</Button></>}><div className="project-payment-remove-confirmation"><span><AlertTriangle size={22} /></span><div><strong>请确认操作范围</strong><p>{confirmAction.description}</p><small>本原型的变更只保存在当前浏览器会话。</small></div></div></Modal> : null}
    </>
  );
}
