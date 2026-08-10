import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Circle,
  Download,
  FileText,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Send,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, Button, Modal, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { Pagination, usePagination } from '../components/Pagination';
import {
  RequestProjectResourceManager,
  type RequestProjectResourceActions,
} from '../components/RequestProjectResourceManager';
import { formatContractMoney, isConfirmedContract, type ContractRecord } from '../contracts';
import { PM_USERS, type SystemUser } from '../data';
import {
  createPrototypeCode,
  createPrototypeId,
  invoicePaymentListProvider,
  paymentListEffectiveAccount,
  type ContractId,
  type CooperationProjectId,
  type CreatorId,
  type InvoiceId,
  type PaymentListRecord,
  type PaymentRequestProjectId,
  type ProjectId,
} from '../businessWorkflow';
import {
  addInvoiceToPaymentRequestSelection,
  canAddCreatorToPaymentRequest,
  cooperationProjectIdFor,
  createEmptyPaymentRequestListFilters,
  filterPaymentRequestList,
  invoiceAmountLabel,
  myProjectStatusFor,
  paymentRequestAmount,
  paymentRequestAmountLabel,
  paymentRequestCreatorPresentation,
  paymentRequestInvoiceIds,
  paymentRequestListMetrics,
  paymentRequestPaymentPlanFor,
  paymentRequestPaymentPlanIssues,
  paymentRequestProviderForChannel,
  paymentRequestSubmissionIssues,
  resolveCreatorDocuments,
  type PaymentRequestCreatorLink,
  type PaymentRequestPaymentChannel,
} from '../paymentRequestProjects';
import type { CreatorProfile, GeneratedInvoiceRecord } from '../types';
import { requestApprovalReturnDetails } from '../requestApprovalWorkflow';
import {
  ProjectInlineFilterPanel,
  ProjectStatus,
  type ProjectListFilters,
} from './OperationalPages';
import type { ProjectSummary } from './ProjectDetailPage';
import type { RequestProjectSummary } from './RequestProjectDetailPage';
import { downloadBlob } from '../invoice/invoiceUtils';

type Notify = (title: string, message: string) => void;

const STATUS_COPY = {
  READY: '可选择多份 Invoice',
  MISSING_INVOICE: '该合作项目下暂无此达人 Invoice',
  INVOICE_IN_USE: '可用 Invoice 均已关联其他请款项目',
} as const;

const PAYMENT_CHANNEL_OPTIONS = [
  { value: 'Airwallex', label: 'Airwallex', description: '跨境银行转账' },
  { value: 'PayPal', label: 'PayPal', description: 'PayPal 账户付款' },
  { value: 'Payermax', label: 'Payermax', description: '本地支付网络' },
] as const;

type RequestResourcePickerOption = {
  value: string;
  label: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
};

function RequestResourcePicker({
  id,
  kind,
  creatorName,
  open,
  selectedCount,
  options,
  emptyCopy,
  onOpenChange,
  onToggle,
}: {
  id: string;
  kind: 'invoice' | 'contract';
  creatorName: string;
  open: boolean;
  selectedCount: number;
  options: RequestResourcePickerOption[];
  emptyCopy: string;
  onOpenChange: (open: boolean) => void;
  onToggle: (value: string, selected: boolean) => void;
}) {
  const isInvoice = kind === 'invoice';
  const label = isInvoice ? 'Invoice' : '合同';
  const ResourceIcon = isInvoice ? ReceiptText : FileText;
  const helper = isInvoice
    ? '关联已录入系统的 Invoice，可多选'
    : '仅已确认合同可关联，可多选';
  const selectedCopy = selectedCount
    ? `已选择 ${selectedCount} 份${isInvoice ? ' Invoice' : '合同'}`
    : helper;

  return (
    <div className="invoice-picker media-request-resource-picker">
      <button
        className={`invoice-picker-trigger ${open ? 'invoice-picker-trigger-open' : ''}`}
        type="button"
        aria-label={`为 ${creatorName} 从系统选择 ${label}`}
        aria-expanded={open}
        aria-controls={id}
        disabled={!options.length}
        onClick={() => onOpenChange(!open)}
      >
        <span className="invoice-picker-leading">
          <ResourceIcon size={16} aria-hidden="true" />
          <span className="invoice-picker-copy">
            <strong>从系统选择 {label}</strong>
            <small>{options.length ? selectedCopy : emptyCopy}</small>
          </span>
        </span>
        <ChevronDown className="invoice-picker-chevron" size={16} aria-hidden="true" />
      </button>
      {open && options.length ? (
        <div
          id={id}
          className="invoice-options"
          role="listbox"
          aria-label={`为 ${creatorName} 选择${label}`}
          aria-multiselectable="true"
        >
          {options.map((option) => (
            <button
              className={`invoice-option ${option.selected ? 'invoice-option-selected' : ''}`}
              type="button"
              role="option"
              aria-selected={option.selected}
              disabled={option.disabled && !option.selected}
              key={option.value}
              onClick={() => onToggle(option.value, option.selected)}
            >
              <ResourceIcon className="invoice-option-icon" size={15} aria-hidden="true" />
              <span className="invoice-option-copy">
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              {option.selected
                ? <CheckCircle2 className="invoice-option-mark invoice-option-mark-selected" size={16} aria-hidden="true" />
                : <Circle className="invoice-option-mark" size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const requestCodeFor = (request: RequestProjectSummary) => request.requestCode ?? request.id;

const formatCreatedAt = (value?: string) => {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const formatReturnTime = (value?: string) => {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const paymentListStatusLabel = (status?: PaymentListRecord['status']) => {
  if (status === 'generated') return '已生成';
  if (status === 'submitted') return '已提交';
  if (status === 'approved') return '已通过';
  if (status === 'paid') return '已完成';
  return '草稿';
};

const MEDIA_CONFIRMATION_ASSET_PATH = '/export-assets/airwallex/airwallex付款单-支付确认函.pdf';
const MEDIA_CONFIRMATION_FILENAME = 'airwallex付款单-支付确认函.pdf';

type MediaConfirmationAssetLoader = (path: string) => Promise<Blob>;

export type MediaConfirmationItem = {
  paymentListCode: string;
  invoiceNumber: string;
};

const loadMediaConfirmationAsset: MediaConfirmationAssetLoader = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to read confirmation asset: ${response.status}`);
  return response.blob();
};

const safeMediaExportSegment = (value: string, fallback: string) => {
  const safe = value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
  return safe || fallback;
};

export const mediaConfirmationItemsFor = (
  request: RequestProjectSummary,
  paymentLists: PaymentListRecord[],
): MediaConfirmationItem[] => {
  const explicitIds = new Set([
    ...(request.paymentListIds ?? []),
    ...(request.paymentListId ? [request.paymentListId] : []),
  ]);
  return paymentLists
    .filter((list) => (
      list.status === 'paid'
      && (
        Boolean(
          request.paymentRequestProjectId
          && list.paymentRequestProjectId === request.paymentRequestProjectId,
        )
        || explicitIds.has(list.paymentListId)
      )
    ))
    .flatMap((list) => list.items.flatMap((item) => (
      paymentListEffectiveAccount(item).provider === 'Airwallex'
        ? [{
            paymentListCode: list.paymentListCode,
            invoiceNumber: item.snapshot.invoiceNumber,
          }]
        : []
    )));
};

export const createMediaConfirmationArchive = async (
  requestCode: string,
  items: MediaConfirmationItem[],
  loadAsset: MediaConfirmationAssetLoader = loadMediaConfirmationAsset,
) => {
  const [{ default: JSZip }, template] = await Promise.all([
    import('jszip'),
    loadAsset(MEDIA_CONFIRMATION_ASSET_PATH),
  ]);
  const bytes = new Uint8Array(await template.arrayBuffer());
  const zip = new JSZip();
  const projectFolder = zip.folder(`${safeMediaExportSegment(requestCode, 'project')}-付款确认函`);
  items.forEach((item, index) => {
    const paymentListCode = safeMediaExportSegment(item.paymentListCode, `payment-list-${index + 1}`);
    const invoiceNumber = safeMediaExportSegment(item.invoiceNumber, `invoice-${index + 1}`);
    projectFolder?.file(
      `${String(index + 1).padStart(2, '0')}-${paymentListCode}-${invoiceNumber}-${MEDIA_CONFIRMATION_FILENAME}`,
      bytes,
    );
  });
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
};

export function MediaPaymentProjectsPage({
  notify,
  currentUser,
  cooperationProjects,
  creators,
  contracts,
  invoices,
  paymentLists,
  requests,
  canCreate,
  focusedProjectId,
  onFocusCleared,
  onCreated,
  onUpdated,
  onGeneratePaymentList,
  onSubmitRequest,
  resourceActions,
}: {
  notify: Notify;
  currentUser: SystemUser;
  cooperationProjects: ProjectSummary[];
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
  paymentLists: PaymentListRecord[];
  requests: RequestProjectSummary[];
  canCreate: boolean;
  focusedProjectId: string | null;
  onFocusCleared: () => void;
  onCreated: (request: RequestProjectSummary) => void;
  onUpdated: (request: RequestProjectSummary) => void;
  onGeneratePaymentList: (request: RequestProjectSummary) => void;
  onSubmitRequest: (request: RequestProjectSummary) => void;
  resourceActions: RequestProjectResourceActions;
}) {
  const [creating, setCreating] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(focusedProjectId);
  const [cooperationProjectId, setCooperationProjectId] = useState('');
  const [brand, setBrand] = useState('');
  const [pm, setPm] = useState(PM_USERS[0]?.name ?? '');
  const [paymentChannel, setPaymentChannel] = useState<PaymentRequestPaymentChannel | ''>('');
  const [expectedPaymentDate, setExpectedPaymentDate] = useState('');
  const [reason, setReason] = useState('');
  const [creatorSearch, setCreatorSearch] = useState('');
  const [creatorPickerOpen, setCreatorPickerOpen] = useState(false);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<CreatorId[]>([]);
  const [contractIdsByCreator, setContractIdsByCreator] = useState<Record<string, ContractId[]>>({});
  const [invoiceIdsByCreator, setInvoiceIdsByCreator] = useState<Record<string, InvoiceId[]>>({});
  const [autoLinkedContractIdsByCreator, setAutoLinkedContractIdsByCreator] = useState<Record<string, ContractId[]>>({});
  const [openDocumentPicker, setOpenDocumentPicker] = useState<string | null>(null);
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ProjectListFilters>(createEmptyPaymentRequestListFilters);
  const [exportingRequestId, setExportingRequestId] = useState<string | null>(null);

  const currentScopeName = currentUser.scopeName ?? currentUser.name;
  const visibleRequests = requests.filter((request) => {
    if (currentUser.roleKey === 'media') return request.media === currentScopeName;
    return true;
  });
  const editingRequest = editingRequestId
    ? visibleRequests.find((request) => request.id === editingRequestId) ?? null
    : null;
  const selectedRequest = selectedRequestId
    ? visibleRequests.find((request) => request.id === selectedRequestId || requestCodeFor(request) === selectedRequestId) ?? null
    : null;
  const selectedProject = cooperationProjects.find((project) => (
    cooperationProjectIdFor(project) === cooperationProjectId
  )) ?? null;
  const query = creatorSearch.trim().toLowerCase();
  const selectedCreators = selectedCreatorIds
    .map((creatorId) => creators.find((creator) => creator.id === creatorId))
    .filter((creator): creator is CreatorProfile => Boolean(creator));

  const resolutions = useMemo(() => new Map(creators.map((creator) => [
    creator.id,
    cooperationProjectId
      ? resolveCreatorDocuments({
          contracts,
          invoices,
          requests,
          cooperationProjectId: cooperationProjectId as CooperationProjectId,
          creatorId: creator.id as CreatorId,
          excludeRequestId: editingRequest?.paymentRequestProjectId,
        })
      : null,
  ])), [contracts, cooperationProjectId, creators, editingRequest?.paymentRequestProjectId, invoices, requests]);
  const visibleCreators = creators
    .filter((creator) => (
      !query || `${creator.name}${creator.handle}${creator.region}${creator.platform}`.toLowerCase().includes(query)
    ))
    .sort((left, right) => {
      const leftReady = resolutions.get(left.id)?.status === 'READY';
      const rightReady = resolutions.get(right.id)?.status === 'READY';
      if (leftReady !== rightReady) return leftReady ? -1 : 1;
      return left.name.localeCompare(right.name);
    });

  const metrics = paymentRequestListMetrics(visibleRequests);
  const returnedRequests = visibleRequests
    .filter((request) => request.lifecycle === 'RETURNED')
    .map((request) => ({ request, details: requestApprovalReturnDetails(request.approval) }));
  const financeReturnedCount = returnedRequests.filter(({ details }) => details?.stage === 'FINANCE').length;
  const { visible: filteredRequests, invalidBudgetRange } = filterPaymentRequestList({
    requests: visibleRequests,
    search,
    filters,
  });
  const {
    page,
    pageItems: paginatedRequests,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination(filteredRequests, {
    resetKey: `${search}\u0000${JSON.stringify(filters)}`,
  });
  const customerCounts = visibleRequests.reduce<Record<string, number>>((result, request) => (
    request.brand ? { ...result, [request.brand]: (result[request.brand] ?? 0) + 1 } : result
  ), {});
  const pmCounts = visibleRequests.reduce<Record<string, number>>((result, request) => ({
    ...result,
    [request.pm]: (result[request.pm] ?? 0) + 1,
  }), {});
  const customerFilterOptions = Object.entries(customerCounts).map(([customer, count]) => ({
    value: customer,
    label: customer,
    description: `${count} 个项目`,
  }));
  const pmFilterOptions = Object.entries(pmCounts).map(([pmName, count]) => ({
    value: pmName,
    label: pmName,
    description: `${count} 个项目${PM_USERS.find((user) => user.name === pmName)?.email ? ` · ${PM_USERS.find((user) => user.name === pmName)?.email}` : ''}`,
  }));
  const currencies = Array.from(new Set(visibleRequests
    .map((request) => paymentRequestAmount(request.amount).currency)
    .filter(Boolean)));
  const statuses = Array.from(new Set(visibleRequests.map(myProjectStatusFor)));
  const currencyFilterOptions = [
    { value: 'all', label: '全部币种' },
    ...currencies.map((currency) => ({ value: currency, label: currency })),
  ];
  const statusFilterOptions = [
    {
      value: 'all',
      label: '全部状态',
      description: `共 ${visibleRequests.length} 个项目`,
      leading: <span className="project-status-select-dot project-status-select-dot-all" />,
    },
    ...statuses.map((status) => ({
      value: status,
      label: status,
      description: `${visibleRequests.filter((request) => myProjectStatusFor(request) === status).length} 个项目`,
      leading: <span className={`project-status-select-dot ${status === '已付款' ? 'project-status-select-dot-complete' : 'project-status-select-dot-active'}`} />,
    })),
  ];
  const creatorSelectionEditable = !editingRequest || canAddCreatorToPaymentRequest(editingRequest);

  const exportProjectConfirmations = async (
    request: RequestProjectSummary,
    items: MediaConfirmationItem[],
  ) => {
    if (!items.length || exportingRequestId) return;
    setExportingRequestId(request.id);
    try {
      const requestCode = requestCodeFor(request);
      const archive = await createMediaConfirmationArchive(requestCode, items);
      downloadBlob(archive, `${safeMediaExportSegment(requestCode, 'project')}-付款确认函.zip`);
      notify('确认函已导出', `已为 ${requestCode} 生成 ${items.length} 份 Airwallex 付款确认函。`);
    } catch {
      notify('确认函导出失败', '无法读取付款确认函模板，请检查导出资源后重试。');
    } finally {
      setExportingRequestId(null);
    }
  };

  const resetForm = () => {
    setCooperationProjectId('');
    setBrand('');
    setPm(PM_USERS[0]?.name ?? '');
    setPaymentChannel('');
    setExpectedPaymentDate('');
    setReason('');
    setCreatorSearch('');
    setCreatorPickerOpen(false);
    setSelectedCreatorIds([]);
    setContractIdsByCreator({});
    setInvoiceIdsByCreator({});
    setAutoLinkedContractIdsByCreator({});
    setOpenDocumentPicker(null);
    setFormSubmitAttempted(false);
    setEditingRequestId(null);
  };

  const closeForm = () => {
    const returnRequestId = editingRequest?.id ?? null;
    resetForm();
    setCreating(false);
    if (returnRequestId) setSelectedRequestId(returnRequestId);
  };

  const openCreateForm = () => {
    resetForm();
    setCreating(true);
  };

  const openEditForm = (request: RequestProjectSummary, showCreatorPicker = false) => {
    const paymentPlan = paymentRequestPaymentPlanFor(request);
    setCooperationProjectId(String(request.cooperationProjectId ?? request.projectId ?? ''));
    setBrand(request.brand ?? '');
    setPm(request.pm);
    setPaymentChannel(paymentPlan.paymentChannel);
    setExpectedPaymentDate(paymentPlan.expectedPaymentDate);
    setReason(request.generatedDetail?.reason ?? '');
    setCreatorSearch('');
    setCreatorPickerOpen(showCreatorPicker && canAddCreatorToPaymentRequest(request));
    setSelectedCreatorIds((request.creatorLinks ?? []).map((link) => link.creatorId));
    setContractIdsByCreator(Object.fromEntries(
      (request.creatorLinks ?? []).map((link) => [link.creatorId, [...link.contractIds]]),
    ));
    setInvoiceIdsByCreator(Object.fromEntries(
      (request.creatorLinks ?? []).map((link) => [link.creatorId, [...link.invoiceIds]]),
    ));
    setAutoLinkedContractIdsByCreator({});
    setOpenDocumentPicker(null);
    setFormSubmitAttempted(false);
    setEditingRequestId(request.id);
    setSelectedRequestId(null);
    setCreating(true);
  };

  const changeProject = (value: string) => {
    setCooperationProjectId(value);
    setSelectedCreatorIds([]);
    setContractIdsByCreator({});
    setInvoiceIdsByCreator({});
    setAutoLinkedContractIdsByCreator({});
    setOpenDocumentPicker(null);
    setFormSubmitAttempted(false);
  };

  const toggleCreator = (creatorId: CreatorId) => {
    if (!creatorSelectionEditable) {
      notify('达人名单已锁定', '只有草稿状态可以添加或移除达人。');
      return;
    }
    const removing = selectedCreatorIds.includes(creatorId);
    if (removing && openDocumentPicker?.startsWith(`${creatorId}:`)) setOpenDocumentPicker(null);
    setSelectedCreatorIds((current) => removing
      ? current.filter((id) => id !== creatorId)
      : [...current, creatorId]);
    setContractIdsByCreator((current) => {
      if (!current[creatorId]) return current;
      const next = { ...current };
      delete next[creatorId];
      return next;
    });
    setInvoiceIdsByCreator((current) => {
      if (removing) {
        if (!current[creatorId]) return current;
        const next = { ...current };
        delete next[creatorId];
        return next;
      }
      return {
        ...current,
        [creatorId]: [],
      };
    });
    setAutoLinkedContractIdsByCreator((current) => {
      if (!current[creatorId]) return current;
      const next = { ...current };
      delete next[creatorId];
      return next;
    });
  };

  const addContract = (creatorId: CreatorId, contractId: ContractId) => {
    setContractIdsByCreator((current) => {
      const selected = current[creatorId] ?? [];
      return {
        ...current,
        [creatorId]: selected.includes(contractId) ? selected : [...selected, contractId],
      };
    });
  };

  const removeContract = (creatorId: CreatorId, contractId: ContractId) => {
    setContractIdsByCreator((current) => ({
      ...current,
      [creatorId]: (current[creatorId] ?? []).filter((id) => id !== contractId),
    }));
    setAutoLinkedContractIdsByCreator((current) => ({
      ...current,
      [creatorId]: (current[creatorId] ?? []).filter((id) => id !== contractId),
    }));
  };

  const addInvoice = (creatorId: CreatorId, invoiceId: InvoiceId) => {
    const resolution = resolutions.get(creatorId);
    const invoice = resolution?.availableInvoices.find((candidate) => candidate.invoiceId === invoiceId);
    if (!invoice || !resolution) return;
    const expectedProvider = paymentRequestProviderForChannel(paymentChannel || undefined);
    const invoiceProvider = invoicePaymentListProvider(invoice);
    if (expectedProvider && invoiceProvider !== expectedProvider) {
      notify(
        'Invoice 付款渠道不一致',
        `当前请款项目选择 ${paymentChannel}，不能关联使用 ${invoiceProvider} 收款账户的 Invoice。`,
      );
      return;
    }
    const result = addInvoiceToPaymentRequestSelection({
      invoice,
      invoices: resolution.invoices,
      contracts: resolution.contracts,
      selectedInvoiceIds: invoiceIdsByCreator[creatorId] ?? [],
      selectedContractIds: contractIdsByCreator[creatorId] ?? [],
    });
    setInvoiceIdsByCreator((current) => ({ ...current, [creatorId]: result.invoiceIds }));
    setContractIdsByCreator((current) => ({ ...current, [creatorId]: result.contractIds }));
    setAutoLinkedContractIdsByCreator((current) => ({
      ...current,
      [creatorId]: [...new Set([
        ...(current[creatorId] ?? []),
        ...result.autoLinkedContractIds,
      ])],
    }));
  };

  const removeInvoice = (creatorId: CreatorId, invoiceId: InvoiceId) => {
    const resolution = resolutions.get(creatorId);
    const remainingInvoiceIds = (invoiceIdsByCreator[creatorId] ?? []).filter((id) => id !== invoiceId);
    const remainingCoveredContractIds = new Set(remainingInvoiceIds.flatMap((id) => (
      resolution?.invoices.find((invoice) => invoice.invoiceId === id)?.snapshot.contractIds ?? []
    )));
    const previouslyAutoLinked = autoLinkedContractIdsByCreator[creatorId] ?? [];
    const autoLinkedToKeep = previouslyAutoLinked.filter((contractId) => remainingCoveredContractIds.has(contractId));
    const autoLinkedToRemove = new Set(previouslyAutoLinked.filter((contractId) => !remainingCoveredContractIds.has(contractId)));
    setInvoiceIdsByCreator((current) => ({ ...current, [creatorId]: remainingInvoiceIds }));
    setContractIdsByCreator((current) => ({
      ...current,
      [creatorId]: (current[creatorId] ?? []).filter((contractId) => !autoLinkedToRemove.has(contractId)),
    }));
    setAutoLinkedContractIdsByCreator((current) => ({ ...current, [creatorId]: autoLinkedToKeep }));
  };

  const validCreatorLinks = selectedCreators.flatMap<PaymentRequestCreatorLink>((creator) => {
    const resolution = resolutions.get(creator.id);
    const selectedInvoiceIds = invoiceIdsByCreator[creator.id] ?? [];
    const selectedInvoices = resolution?.invoices.filter((invoice) => selectedInvoiceIds.includes(invoice.invoiceId)) ?? [];
    const engagementId = selectedInvoices[0]?.snapshot.engagementId;
    if (!selectedInvoices.length || !engagementId) return [];
    return [{
      creatorId: creator.id as CreatorId,
      engagementId,
      contractIds: contractIdsByCreator[creator.id] ?? [],
      invoiceIds: selectedInvoices.map((invoice) => invoice.invoiceId),
    }];
  });
  const creatorsReady = selectedCreators.length > 0
    && validCreatorLinks.length === selectedCreators.length;
  const formIssues = [
    !selectedProject ? '请选择关联项目' : '',
    !pm ? '请选择项目 PM' : '',
    ...paymentRequestPaymentPlanIssues({ paymentChannel, expectedPaymentDate }),
    !reason.trim() ? '请填写请款事由' : '',
    !selectedCreators.length ? '请至少选择一位合作达人' : '',
    ...selectedCreators.flatMap((creator) => {
      const selectedInvoiceIds = invoiceIdsByCreator[creator.id] ?? [];
      if (!selectedInvoiceIds.length) return [`请为 ${creator.name} 至少选择一份 Invoice`];
      const resolution = resolutions.get(creator.id);
      const selectedInvoices = resolution?.invoices.filter((invoice) => selectedInvoiceIds.includes(invoice.invoiceId)) ?? [];
      if (selectedInvoices.length !== selectedInvoiceIds.length) return [`${creator.name} 的 Invoice 关联已失效，请重新选择`];
      const expectedProvider = paymentRequestProviderForChannel(paymentChannel || undefined);
      const incompatibleInvoice = expectedProvider
        ? selectedInvoices.find((invoice) => invoicePaymentListProvider(invoice) !== expectedProvider)
        : undefined;
      if (incompatibleInvoice) {
        return [`${creator.name} 的 ${incompatibleInvoice.id} 与付款渠道 ${paymentChannel} 不一致`];
      }
      if (new Set(selectedInvoices.map((invoice) => invoice.snapshot.engagementId)).size > 1) {
        return [`${creator.name} 的 Invoice 分属不同合作关系，不能合并到同一达人记录`];
      }
      return [];
    }),
  ].filter(Boolean);
  const canCreateRequest = Boolean(
    selectedProject
    && pm
    && paymentChannel
    && expectedPaymentDate
    && reason.trim()
    && creatorsReady
    && formIssues.length === 0,
  );

  const saveRequest = () => {
    setFormSubmitAttempted(true);
    if (!selectedProject || !paymentChannel || !expectedPaymentDate || !canCreateRequest) {
      notify('请完善必填信息', formIssues[0] ?? '请检查达人和 Invoice 关联信息。');
      return;
    }
    const paymentRequestProjectId = editingRequest?.paymentRequestProjectId
      ?? createPrototypeId('request-project') as PaymentRequestProjectId;
    const requestCode = editingRequest?.requestCode ?? createPrototypeCode('REQ');
    const selectedContractIds = validCreatorLinks.flatMap((link) => link.contractIds);
    const selectedInvoiceIds = paymentRequestInvoiceIds(validCreatorLinks);
    const request: RequestProjectSummary = {
      ...editingRequest,
      id: editingRequest?.id ?? requestCode,
      paymentRequestProjectId,
      requestCode,
      cooperationProjectId: cooperationProjectIdFor(selectedProject),
      cooperationProjectCode: selectedProject.cooperationProjectCode ?? selectedProject.projectCode ?? selectedProject.id,
      cooperationProjectName: selectedProject.name,
      lifecycle: editingRequest?.lifecycle ?? 'DRAFT',
      creatorLinks: validCreatorLinks,
      projectId: cooperationProjectIdFor(selectedProject) as ProjectId,
      invoiceIds: selectedInvoiceIds,
      project: selectedProject.name,
      brand: brand.trim(),
      media: currentScopeName,
      pm,
      paymentChannel,
      expectedPaymentDate,
      amount: paymentRequestAmountLabel(validCreatorLinks, invoices),
      contracts: selectedContractIds.length,
      invoices: selectedInvoiceIds.length,
      paymentListId: undefined,
      paymentListIds: undefined,
      paymentOrder: '待生成',
      status: editingRequest?.status ?? '草稿',
      filter: editingRequest?.filter ?? 'pending',
      createdAt: editingRequest?.createdAt ?? new Date().toISOString(),
      generatedDetail: {
        brand: brand.trim(),
        reason: reason.trim(),
        contractId: selectedContractIds.join('、') || '未关联',
        contractName: selectedContractIds.length ? `${selectedContractIds.length} 份已选合同` : '合同选填，当前未关联',
        contractAmount: '按所选合同分别校验',
        contractStatus: selectedContractIds.length ? '待校验' : '未关联',
        invoiceId: selectedInvoiceIds.join('、'),
        invoiceAmount: paymentRequestAmountLabel(validCreatorLinks, invoices),
        invoiceStatus: '待提交',
        paymentListId: '待生成',
        paymentListStatus: '草稿',
        payee: `${validCreatorLinks.length} 位合作达人`,
        provider: paymentChannel,
        beneficiaryId: '按付款清单账户快照',
        feePolicy: '按合同及 Invoice 执行',
      },
    };
    if (editingRequest) onUpdated(request);
    else onCreated(request);
    resetForm();
    setCreating(false);
    setSelectedRequestId(request.id);
    notify(
      editingRequest ? '项目已更新' : '项目已创建',
      `${requestCode} 已${editingRequest ? '更新并清除旧付款清单' : '保存为草稿'}，可在详情中完成校验后提交申请。`,
    );
  };

  if (selectedRequest) {
    const selectedMyProjectStatus = myProjectStatusFor(selectedRequest);
    const cooperationProject = cooperationProjects.find((project) => (
      cooperationProjectIdFor(project) === (selectedRequest.cooperationProjectId ?? selectedRequest.projectId)
    ));
    const links = selectedRequest.creatorLinks ?? [];
    const submissionIssues = [
      ...paymentRequestPaymentPlanIssues(paymentRequestPaymentPlanFor(selectedRequest)),
      !selectedRequest.generatedDetail?.reason?.trim() ? '请填写请款事由' : '',
      ...paymentRequestSubmissionIssues({
        creatorLinks: links,
        invoices,
        paymentLists,
        paymentRequestProjectId: selectedRequest.paymentRequestProjectId,
        paymentChannel: selectedRequest.paymentChannel,
      }),
    ].filter(Boolean);
    const editable = canCreate && ['DRAFT', 'RETURNED'].includes(selectedRequest.lifecycle ?? '');
    const canAddCreators = canCreate && canAddCreatorToPaymentRequest(selectedRequest);
    const canSubmit = editable && submissionIssues.length === 0;
    const requestPaymentLists = paymentLists.filter((list) => (
      list.paymentRequestProjectId === selectedRequest.paymentRequestProjectId
    ));
    const linkedContractIds = Array.from(new Set(links.flatMap((link) => link.contractIds)));
    const linkedInvoices = paymentRequestInvoiceIds(links).flatMap((invoiceId) => {
      const invoice = invoices.find((item) => item.invoiceId === invoiceId);
      return invoice ? [invoice] : [];
    });
    const latestPaymentList = requestPaymentLists[0];
    const isReturned = selectedRequest.lifecycle === 'RETURNED';
    const returnDetails = requestApprovalReturnDetails(selectedRequest.approval);
    const returnHeading = returnDetails?.stage === 'FINANCE'
      ? '付款工作台已退回此请款项目'
      : `${returnDetails?.stageLabel ?? '审批流'}已退回此请款项目`;
    const scrollToSection = (id: string) => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    return (
      <div className="page-stack project-detail-page media-request-detail-page">
        <button className="project-back-button" type="button" onClick={() => {
          setSelectedRequestId(null);
          onFocusCleared();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}><ArrowLeft size={17} />返回我的项目</button>
        <PageHeading
          title={requestCodeFor(selectedRequest)}
          subtitle={`关联项目 ${selectedRequest.cooperationProjectName ?? selectedRequest.project} · 创建媒介 ${selectedRequest.media}`}
          actions={<>{editable ? <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => openEditForm(selectedRequest)}>{isReturned ? '修改请款内容' : '编辑项目'}</Button> : null}{isReturned ? <Button variant="ghost" icon={<ArrowDown size={16} />} onClick={() => scrollToSection('media-request-submit-section')}>查看重新提交要求</Button> : null}<span className="project-detail-status"><i />{selectedMyProjectStatus}</span></>}
        />
        <div className="metrics-grid project-detail-metrics">
          <article className="metric-card"><span>请款金额</span><strong>{selectedRequest.amount}</strong><small>按关联 Invoice 汇总</small></article>
          <article className="metric-card metric-lilac"><span>合作达人</span><strong>{links.length || selectedRequest.invoices} 位</strong><small>{selectedRequest.contracts} 份合同 · {selectedRequest.invoices} 份 Invoice</small></article>
          <article className="metric-card metric-peach"><span>当前状态</span><strong>{selectedMyProjectStatus}</strong><small>{selectedRequest.approval ? '已进入审批流' : '尚未提交审批'}</small></article>
        </div>
        {isReturned ? (
          <section className="media-request-return-panel" aria-labelledby="media-request-return-heading">
            <div className="media-request-return-panel-icon"><AlertTriangle size={21} aria-hidden="true" /></div>
            <div className="media-request-return-panel-body">
              <header>
                <div>
                  <span>退回待处理</span>
                  <h2 id="media-request-return-heading">{returnHeading}</h2>
                  <p>请根据退回意见修改请款内容和付款清单，完成校验后重新提交。</p>
                </div>
                {editable ? (
                  <div className="media-request-return-panel-actions">
                    <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => openEditForm(selectedRequest)}>修改请款内容</Button>
                    <Button variant="ghost" onClick={() => scrollToSection('media-request-resource-section')}>检查付款清单</Button>
                  </div>
                ) : null}
              </header>
              <blockquote>{returnDetails?.reason ?? '未记录退回原因'}</blockquote>
              <dl className="media-request-return-meta">
                <div><dt>退回节点</dt><dd>{returnDetails?.stageLabel ?? '未记录'}</dd></div>
                <div><dt>退回人</dt><dd>{returnDetails?.actorName ?? '未记录'}<small>{returnDetails?.actorRole ?? ''}</small></dd></div>
                <div><dt>退回时间</dt><dd><Clock3 size={14} aria-hidden="true" />{formatReturnTime(returnDetails?.occurredAt)}</dd></div>
                <div><dt>审批轮次</dt><dd>第 {returnDetails?.round ?? selectedRequest.approval?.round ?? 1} 轮</dd></div>
              </dl>
            </div>
          </section>
        ) : null}
        <section className="project-detail-card">
          <header className="project-detail-card-header"><div><h2>请款项目信息</h2><p>查看关联项目、付款安排与请款背景。</p></div></header>
          <dl className="project-info-grid">
            <div><dt>项目编号</dt><dd>{requestCodeFor(selectedRequest)}</dd></div>
            <div><dt>关联项目</dt><dd>{cooperationProject?.name ?? selectedRequest.cooperationProjectName ?? selectedRequest.project}<small className="cell-subtext">{selectedRequest.cooperationProjectCode ?? cooperationProject?.cooperationProjectCode ?? '待同步'}</small></dd></div>
            <div><dt>品牌</dt><dd>{selectedRequest.brand || '未填写（非必填）'}</dd></div>
            <div><dt>负责 PM</dt><dd>{selectedRequest.pm}</dd></div>
            <div><dt>付款渠道</dt><dd>{selectedRequest.paymentChannel || '待补充'}</dd></div>
            <div><dt>预计付款时间</dt><dd>{selectedRequest.expectedPaymentDate || '待补充'}</dd></div>
            <div><dt>项目媒介</dt><dd>{selectedRequest.media}</dd></div>
            <div><dt>创建时间</dt><dd>{formatCreatedAt(selectedRequest.createdAt ?? selectedRequest.approval?.submittedAt)}</dd></div>
            <div className="project-info-wide"><dt>请款事由</dt><dd>{selectedRequest.generatedDetail?.reason || '待补充'}</dd></div>
          </dl>
        </section>
        <section id="media-request-resource-section" className="project-detail-card project-workflow-card">
          <header className="project-detail-card-header"><div><h2>合同、Invoice 与付款清单</h2><p>逐项查看和管理当前请款项目明确关联的资料。</p></div></header>
          <RequestProjectResourceManager
            request={selectedRequest}
            cooperationProject={cooperationProject ?? cooperationProjects[0]}
            requests={requests}
            creators={creators}
            contracts={contracts}
            invoices={invoices}
            paymentLists={paymentLists}
            currentUser={currentUser}
            onChangeLinks={(nextLinks, summary) => resourceActions.onChangeLinks(selectedRequest, nextLinks, summary)}
            onOpenContract={(contractId) => resourceActions.onOpenContract(selectedRequest, contractId)}
            onOpenInvoice={(invoiceId) => resourceActions.onOpenInvoice(selectedRequest, invoiceId)}
            onGenerateContract={() => resourceActions.onGenerateContract(selectedRequest)}
            onGenerateInvoice={() => resourceActions.onGenerateInvoice(selectedRequest)}
            onUploadContract={(input) => resourceActions.onUploadContract(selectedRequest, input)}
            onDeleteContract={(contractId) => resourceActions.onDeleteContract(selectedRequest, contractId)}
            onDeleteInvoice={(invoiceId) => resourceActions.onDeleteInvoice(selectedRequest, invoiceId)}
            onGeneratePaymentLists={() => onGeneratePaymentList(selectedRequest)}
            onClearPaymentLists={() => resourceActions.onClearPaymentLists(selectedRequest)}
            onRemovePaymentInvoice={(paymentListId, invoiceId) => resourceActions.onRemovePaymentInvoice(selectedRequest, paymentListId, invoiceId)}
            onUpdatePaymentItem={(paymentListId, invoiceId, field, value) => resourceActions.onUpdatePaymentItem(selectedRequest, paymentListId, invoiceId, field, value)}
            onChangePaymentAccount={(paymentListId, invoiceId, payoutAccountId) => resourceActions.onChangePaymentAccount(selectedRequest, paymentListId, invoiceId, payoutAccountId)}
            onRevalidatePaymentItem={(paymentListId, invoiceId) => resourceActions.onRevalidatePaymentItem(selectedRequest, paymentListId, invoiceId)}
            onBeginEditPaymentList={(paymentListId) => resourceActions.onBeginEditPaymentList(selectedRequest, paymentListId)}
            onGeneratePaymentListVersion={(paymentListId) => resourceActions.onGeneratePaymentListVersion(selectedRequest, paymentListId)}
            onExportPaymentList={(paymentListId) => resourceActions.onExportPaymentList(selectedRequest, paymentListId)}
          />
        </section>
        <section className="project-detail-card">
          <header className="project-detail-card-header"><div><h2>达人名单</h2><p>按达人核对付款渠道、关联单据与实际请款金额。</p></div>{canAddCreators ? <button className="text-link" type="button" onClick={() => openEditForm(selectedRequest, true)}>添加达人</button> : <span>共 {links.length} 位</span>}</header>
          {links.length ? (
            <div className="table-scroll">
              <table className="data-table project-creator-table media-request-creator-table">
                <thead><tr><th>达人</th><th>付款渠道</th><th>Invoice</th><th>合同</th><th className="media-request-money-heading">Invoice 金额</th><th className="media-request-money-heading">请款金额</th><th>校验状态</th></tr></thead>
                <tbody>{links.map((link) => {
                  const creator = creators.find((item) => item.id === link.creatorId);
                  const presentation = paymentRequestCreatorPresentation({
                    link,
                    invoices,
                    contracts,
                    paymentLists,
                    paymentRequestProjectId: selectedRequest.paymentRequestProjectId,
                    requestLifecycle: selectedRequest.lifecycle,
                    requestStatus: selectedMyProjectStatus,
                  });
                  return (
                    <tr key={link.creatorId}>
                      <td><div className="media-request-creator-cell"><Avatar initials={creator?.initials ?? '?'} accent={creator?.accent ?? '#718096'} size="sm" /><span><strong>{creator?.name ?? link.creatorId}</strong><small>{creator?.handle ?? '达人档案待核对'}</small></span></div></td>
                      <td>
                        <div className="media-request-record-stack">
                          {presentation.invoices.length ? presentation.invoices.map((invoice) => (
                            <span className="media-request-record-line media-request-channel" key={invoice.invoiceId}>{invoice.provider}</span>
                          )) : <span className="media-request-record-empty">—</span>}
                        </div>
                      </td>
                      <td>
                        <div className="media-request-document-summary">
                          <strong>{presentation.invoices.length} 份 Invoice</strong>
                          <div className="media-request-document-ids">
                            {presentation.invoices.length ? presentation.invoices.map((invoice) => (
                              invoice.missing ? (
                                <span className="media-request-record-error" key={invoice.invoiceId}>{invoice.invoiceNumber}</span>
                              ) : (
                                <button
                                  className="media-request-document-link"
                                  type="button"
                                  key={invoice.invoiceId}
                                  onClick={() => resourceActions.onOpenInvoice(selectedRequest, invoice.invoiceId)}
                                >
                                  {invoice.invoiceNumber}
                                </button>
                              )
                            )) : <span className="media-request-record-empty">待补 Invoice</span>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="media-request-document-summary">
                          <strong>{presentation.contracts.length} 份合同</strong>
                          <div className="media-request-document-ids">
                            {presentation.contracts.length ? presentation.contracts.map((contract) => (
                              contract.missing || !contract.relationshipValid ? (
                                <span className="media-request-record-error" key={contract.contractId}>{contract.contractNumber}</span>
                              ) : (
                                <button
                                  className="media-request-document-link"
                                  type="button"
                                  key={contract.contractId}
                                  onClick={() => resourceActions.onOpenContract(selectedRequest, contract.contractId)}
                                >
                                  {contract.contractNumber}
                                </button>
                              )
                            )) : <span className="media-request-record-empty">—</span>}
                          </div>
                        </div>
                      </td>
                      <td className="media-request-money-cell">
                        <div className="media-request-record-stack">
                          {presentation.invoices.length ? presentation.invoices.map((invoice) => (
                            <span className="media-request-record-line" key={invoice.invoiceId}>{invoice.invoiceAmountLabel}</span>
                          )) : <span className="media-request-record-empty">—</span>}
                          {presentation.invoices.length > 1 ? <small>合计 {presentation.invoiceTotalLabel}</small> : null}
                        </div>
                      </td>
                      <td className="media-request-money-cell">
                        <div className="media-request-record-stack">
                          {presentation.invoices.length ? presentation.invoices.map((invoice) => (
                            <span className="media-request-record-line media-request-request-amount" key={invoice.invoiceId}>
                              <strong>{invoice.requestAmountLabel}</strong>
                              <small>{invoice.requestAmountSource === 'PAYMENT_LIST' ? `付款清单${invoice.amountAdjusted ? ' · 已调整' : ''}` : '按 Invoice'}</small>
                            </span>
                          )) : <span className="media-request-record-empty">—</span>}
                          {presentation.invoices.length > 1 ? <small>合计 {presentation.requestTotalLabel}</small> : null}
                        </div>
                      </td>
                      <td>
                        <div className="media-request-validation-stack">
                          {presentation.statuses.map((status) => (
                            <span className="media-request-validation-status" data-tone={status.tone} key={status.label}>
                              <i aria-hidden="true" />{status.label}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          ) : canAddCreators ? (
            <button className="project-detail-empty project-detail-empty-action" type="button" onClick={() => openEditForm(selectedRequest, true)}><Users size={20} /><span><strong>尚未添加达人</strong><small>点击从达人档案筛选项目达人</small></span></button>
          ) : <div className="project-detail-empty"><Users size={20} /><span><strong>尚未添加达人</strong><small>当前项目为只读状态</small></span></div>}
        </section>
        <section id="media-request-submit-section" className="project-detail-card media-request-submit-card">
          <header className="project-detail-card-header"><div><h2>{editable ? (isReturned ? '重新提交申请' : '提交申请') : '申请状态'}</h2><p>{editable ? (isReturned ? '请先按退回意见完成请款内容和付款清单修正；重新提交后将回到原退回审批节点。' : '提交后进入“请款项目”审批工作台，草稿不会出现在审批列表。') : '该项目已进入“请款项目”审批工作台，当前页面保留关联资料快照。'}</p></div></header>
          {editable ? submissionIssues.length ? (
            <div className="media-request-issue-list"><AlertTriangle size={18} /><div><strong>暂不能提交</strong>{submissionIssues.map((issue) => <span key={issue}>{issue}</span>)}</div></div>
          ) : <NoticeBanner>资料与付款账户快照校验通过，可以提交审批。</NoticeBanner> : (
            <NoticeBanner>申请当前状态：{selectedMyProjectStatus}。审批处理请前往“请款项目”工作台。</NoticeBanner>
          )}
          {editable ? <div className="media-request-submit-actions">
            <Button variant="secondary" onClick={() => onGeneratePaymentList(selectedRequest)}>生成 / 刷新付款清单</Button>
            <Button icon={<Send size={17} />} disabled={!canSubmit} onClick={() => onSubmitRequest(selectedRequest)}>{isReturned ? '重新提交' : '提交申请'}</Button>
          </div> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        title="我的项目"
        subtitle="仅展示与当前账号关联的项目，集中管理合同与 Invoice、达人名单和请款进度。"
        actions={canCreate ? <Button icon={<Plus size={17} />} onClick={openCreateForm}>新建项目</Button> : undefined}
      />
      <div className="metrics-grid">
        <article className="metric-card metric-peach"><span>审核中</span><strong>{metrics.reviewTotal}</strong><small>{metrics.reviewing} 个正在审批</small></article>
        <article className="metric-card"><span>待打款</span><strong>{metrics.waitingPayment}</strong><small>已完成全部审批</small></article>
        <article className="metric-card metric-lilac"><span>请款项目总数</span><strong>{metrics.total}</strong><small>已关联真实合作项目</small></article>
      </div>
      {returnedRequests.length ? (
        <div className="media-request-return-notice" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>{returnedRequests.length} 个请款项目待修改</strong>
            <p>{financeReturnedCount ? `其中 ${financeReturnedCount} 个由付款工作台退回。` : ''}请在下方列表点击“处理退回”，查看原因并修改后重新提交。</p>
          </div>
        </div>
      ) : null}
      <section className="content-card">
        <ProjectInlineFilterPanel
          search={search}
          filters={filters}
          customerOptions={customerFilterOptions}
          pmOptions={pmFilterOptions}
          currencyOptions={currencyFilterOptions}
          statusOptions={statusFilterOptions}
          resultCount={filteredRequests.length}
          totalCount={visibleRequests.length}
          invalidBudgetRange={invalidBudgetRange}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onClear={() => { setSearch(''); setFilters(createEmptyPaymentRequestListFilters()); }}
        />
        <div className="table-scroll">
          <table className="data-table operational-table">
            <thead><tr><th>项目编号</th><th>关联项目</th><th>品牌</th><th>负责 PM</th><th>达人</th><th>请款金额</th><th>状态</th><th className="action-cell">操作</th></tr></thead>
            <tbody>
              {paginatedRequests.map((request) => {
                const returnDetails = requestApprovalReturnDetails(request.approval);
                const isReturned = request.lifecycle === 'RETURNED';
                const canShowConfirmationExport = (
                  currentUser.roleKey === 'media'
                  && request.media === currentScopeName
                  && request.lifecycle === 'COMPLETED'
                );
                const confirmationItems = canShowConfirmationExport
                  ? mediaConfirmationItemsFor(request, paymentLists)
                  : [];
                const isExporting = exportingRequestId === request.id;
                return (
                  <tr className={isReturned ? 'media-request-returned-row' : undefined} key={request.id}>
                    <td><strong>{requestCodeFor(request)}</strong></td>
                    <td><strong>{request.cooperationProjectName ?? request.project}</strong><small className="cell-subtext">{request.cooperationProjectCode ?? request.projectId ?? '待同步'}</small></td>
                    <td>{request.brand || '—'}</td>
                    <td>{request.pm}</td>
                    <td>{request.creatorLinks?.length ?? request.invoices} 位</td>
                    <td>{request.amount}</td>
                    <td>
                      <div className="media-request-list-status">
                        <ProjectStatus status={myProjectStatusFor(request)} />
                        {isReturned ? (
                          <small title={returnDetails?.reason}>
                            {returnDetails?.stage === 'FINANCE' ? '付款工作台' : returnDetails?.stageLabel ?? '审批流'} · {returnDetails?.reason ?? '请查看退回原因'}
                          </small>
                        ) : null}
                      </div>
                    </td>
                    <td className="action-cell">
                      <div className="media-project-row-actions">
                        <button className="text-link" type="button" onClick={() => { setSelectedRequestId(request.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{isReturned ? (canCreate ? '处理退回' : '查看退回') : '查看项目'}</button>
                        {canShowConfirmationExport ? (
                          <>
                            <button
                              className="media-project-confirmation-action"
                              type="button"
                              disabled={!confirmationItems.length || Boolean(exportingRequestId)}
                              title={!confirmationItems.length ? '没有已付款的 Airwallex 付款明细' : undefined}
                              onClick={() => { void exportProjectConfirmations(request, confirmationItems); }}
                            >
                              <Download size={14} aria-hidden="true" />
                              {isExporting ? '导出中...' : '导出确认函'}
                            </button>
                            {!confirmationItems.length ? <small>无已付款 Airwallex 明细</small> : null}
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredRequests.length ? <tr><td colSpan={8} className="project-list-empty">暂无符合当前搜索与筛选条件的项目</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>共 {filteredRequests.length} 个项目</span>
          <Pagination
            ariaLabel="我的项目列表分页"
            page={page}
            pageSize={pageSize}
            total={filteredRequests.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </section>
      {creating ? (
        <Modal
          title={editingRequest ? `编辑项目 · ${requestCodeFor(editingRequest)}` : '新建项目'}
          onClose={closeForm}
          width="820px"
          footer={<><Button variant="ghost" onClick={closeForm}>取消</Button><Button onClick={saveRequest}>{editingRequest ? '保存修改' : '创建项目'}</Button></>}
        >
          <div className="form-grid single-column project-create-form media-request-create-form">
            <div className="form-field">
              <span className="form-field-label">关联项目 <em className="required-mark" aria-hidden="true">*</em></span>
              <SelectField
                ariaLabel="选择合作项目"
                variant="form"
                value={cooperationProjectId}
                disabled={!creatorSelectionEditable}
                options={cooperationProjects.map((project) => ({
                  value: cooperationProjectIdFor(project),
                  label: project.name,
                  description: `${project.cooperationProjectCode ?? project.projectCode ?? project.id} · 来自飞书`,
                }))}
                onChange={changeProject}
                placeholder="请选择飞书合作项目"
              />
            </div>
            <label><span>品牌 <small className="request-optional-label">选填</small></span><input placeholder="输入品牌或客户名称" value={brand} onChange={(event) => setBrand(event.target.value)} /></label>
            <div className="form-field"><span className="form-field-label">项目 PM <em className="required-mark" aria-hidden="true">*</em></span><SelectField ariaLabel="选择项目 PM" variant="form" value={pm} options={PM_USERS.map((user) => ({ value: user.name, label: user.name, description: user.email }))} onChange={setPm} /></div>
            <div className="media-request-payment-plan">
              <div className="form-field">
                <span className="form-field-label">付款渠道 <em className="required-mark" aria-hidden="true">*</em></span>
                <SelectField<PaymentRequestPaymentChannel | ''>
                  ariaLabel="选择付款渠道"
                  variant="form"
                  value={paymentChannel}
                  options={PAYMENT_CHANNEL_OPTIONS}
                  onChange={setPaymentChannel}
                  placeholder="请选择付款渠道"
                />
              </div>
              <div className="form-field">
                <span id="media-request-expected-payment-date-label" className="form-field-label">预计付款时间 <em className="required-mark" aria-hidden="true">*</em></span>
                <input
                  id="media-request-expected-payment-date"
                  type="date"
                  aria-labelledby="media-request-expected-payment-date-label"
                  value={expectedPaymentDate}
                  onChange={(event) => setExpectedPaymentDate(event.target.value)}
                />
              </div>
            </div>
            <div className="form-field"><span id="media-request-reason-label" className="form-field-label">请款事由 <em className="required-mark" aria-hidden="true">*</em></span><textarea aria-labelledby="media-request-reason-label" placeholder="填写本项目的请款背景或用途" value={reason} onChange={(event) => setReason(event.target.value)} /></div>
            <div className="form-field">
              <span className="form-field-label form-field-label-with-meta"><span>合作达人 <em className="required-mark" aria-hidden="true">*</em></span><small>展示达人库全部达人</small></span>
              <div className="creator-picker media-request-creator-picker" data-testid="media-request-creator-picker">
                <button
                  className={`invoice-picker-trigger creator-picker-trigger ${creatorPickerOpen ? 'invoice-picker-trigger-open' : ''}`}
                  type="button"
                  disabled={!creatorSelectionEditable || !cooperationProjectId}
                  aria-expanded={creatorPickerOpen}
                  aria-controls="media-request-creator-options"
                  onClick={() => {
                    setOpenDocumentPicker(null);
                    setCreatorPickerOpen((current) => !current);
                  }}
                >
                  <span className="invoice-picker-leading"><Users size={18} /><span className="invoice-picker-copy"><strong>{selectedCreatorIds.length ? `已选择 ${selectedCreatorIds.length} 位合作达人` : '从达人档案选择合作达人'}</strong><small>{cooperationProjectId ? '已将有唯一可用 Invoice 的达人排在前面' : '请先选择关联项目'}</small></span></span>
                  <ChevronDown className="invoice-picker-chevron" size={18} />
                </button>
                {selectedCreators.length ? (
                  <div className="creator-selection-chips" aria-label="已选择的合作达人">
                    {selectedCreators.map((creator) => creatorSelectionEditable ? (
                      <button className="creator-selection-chip" type="button" aria-label={`移除 ${creator.name}`} key={creator.id} onClick={() => toggleCreator(creator.id as CreatorId)}><Avatar initials={creator.initials} accent={creator.accent} size="sm" /><span>{creator.name}</span><X size={13} aria-hidden="true" /></button>
                    ) : <span className="creator-selection-chip is-readonly" key={creator.id}><Avatar initials={creator.initials} accent={creator.accent} size="sm" /><span>{creator.name}</span></span>)}
                    {creatorSelectionEditable ? <button className="invoice-selection-clear" type="button" onClick={() => { setSelectedCreatorIds([]); setContractIdsByCreator({}); setInvoiceIdsByCreator({}); setAutoLinkedContractIdsByCreator({}); setOpenDocumentPicker(null); }}>清除已选</button> : null}
                  </div>
                ) : null}
                {creatorPickerOpen && creatorSelectionEditable ? (
                  <div id="media-request-creator-options" className="creator-options" role="listbox" aria-label="达人档案列表" aria-multiselectable="true">
                    <div className="creator-picker-search-row"><label className="creator-picker-search"><Search size={16} aria-hidden="true" /><input aria-label="搜索合作达人" placeholder="搜索姓名、账号、地区或平台" value={creatorSearch} onChange={(event) => setCreatorSearch(event.target.value)} /></label><span className="creator-picker-result-count" aria-live="polite"><strong>{visibleCreators.length}</strong><span>/ {creators.length} 位</span></span></div>
                    <div className="creator-option-list">
                      {visibleCreators.map((creator) => {
                        const selected = selectedCreatorIds.includes(creator.id as CreatorId);
                        const resolution = resolutions.get(creator.id);
                        const ready = resolution?.status === 'READY';
                        return <button className={`creator-option ${selected ? 'creator-option-selected' : ''} ${ready ? 'creator-option-ready' : ''}`} type="button" role="option" aria-selected={selected} key={creator.id} onClick={() => toggleCreator(creator.id as CreatorId)}><span className="creator-option-profile"><Avatar initials={creator.initials} accent={creator.accent} size="sm" /><span><strong>{creator.name}</strong><small>{creator.handle}</small></span></span><span className="creator-option-meta"><strong>{ready ? '可创建项目' : creator.region}</strong><small>{ready ? `${resolution?.availableInvoices.length ?? 0} 份 Invoice 可多选` : `${creator.platform} · ${resolution ? STATUS_COPY[resolution.status] : '待选择项目'}`}</small></span>{selected ? <CheckCircle2 className="creator-option-mark creator-option-mark-selected" size={18} /> : <Circle className="creator-option-mark" size={18} />}</button>;
                      })}
                      {!visibleCreators.length ? <div className="creator-picker-empty">没有找到匹配的达人档案</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {selectedCreators.length ? (
              <section className="media-request-document-section">
                <header><div><h3>达人单据关联</h3><p>使用下拉框选择单据。Invoice 必填且可多选，选择后自动带入其覆盖的已确认合同。</p></div><span>{selectedCreators.length} 位达人</span></header>
                {selectedCreators.map((creator) => {
                  const resolution = resolutions.get(creator.id);
                  const selectedContractIds = contractIdsByCreator[creator.id] ?? [];
                  const selectedInvoiceIds = invoiceIdsByCreator[creator.id] ?? [];
                  const autoLinkedContractIds = autoLinkedContractIdsByCreator[creator.id] ?? [];
                  const invoicePickerId = `media-request-invoices-${creator.id}`;
                  const contractPickerId = `media-request-contracts-${creator.id}`;
                  const invoicePickerKey = `${creator.id}:invoice`;
                  const contractPickerKey = `${creator.id}:contract`;
                  const invoiceOptions = (resolution?.invoices ?? []).map((invoice): RequestResourcePickerOption => {
                    const owner = resolution?.invoiceOwners.find((item) => item.invoiceId === invoice.invoiceId)?.owner;
                    const selected = selectedInvoiceIds.includes(invoice.invoiceId);
                    const expectedProvider = paymentRequestProviderForChannel(paymentChannel || undefined);
                    const invoiceProvider = invoicePaymentListProvider(invoice);
                    const channelMismatch = Boolean(expectedProvider && invoiceProvider !== expectedProvider);
                    return {
                      value: invoice.invoiceId,
                      label: invoice.id,
                      description: `${creator.handle} · ${invoiceAmountLabel(invoice)} · ${owner ? `已关联 ${owner.requestCode ?? owner.id}` : channelMismatch ? `${invoiceProvider} 与所选付款渠道不一致` : selected ? '已选择' : invoice.status}`,
                      selected,
                      disabled: Boolean(owner || channelMismatch),
                    };
                  });
                  const contractOptions = (resolution?.contracts ?? []).flatMap<RequestResourcePickerOption>((contract) => {
                    if (!contract.contractId) return [];
                    const enabled = isConfirmedContract(contract);
                    const selected = selectedContractIds.includes(contract.contractId);
                    const selectedSource = autoLinkedContractIds.includes(contract.contractId)
                      ? 'Invoice 自动带入'
                      : '已选择';
                    return [{
                      value: contract.contractId,
                      label: contract.id,
                      description: `${creator.handle} · ${formatContractMoney(contract)} · ${selected ? selectedSource : enabled ? contract.status : `不可关联：${contract.status}`}`,
                      selected,
                      disabled: !enabled,
                    }];
                  });
                  return (
                    <article className="media-request-document-row" key={creator.id}>
                      <div className="media-request-document-creator"><Avatar initials={creator.initials} accent={creator.accent} size="sm" /><span><strong>{creator.name}</strong><small>{creator.handle} · {creator.platform}</small></span></div>
                      <div className="media-request-document-fields">
                        <div className={`media-request-document-field media-request-invoice-state is-${resolution?.status.toLowerCase() ?? 'missing'}`}>
                          <span>Invoice <em>必填，可多选</em></span>
                          <RequestResourcePicker
                            id={invoicePickerId}
                            kind="invoice"
                            creatorName={creator.name}
                            open={openDocumentPicker === invoicePickerKey}
                            selectedCount={selectedInvoiceIds.length}
                            options={invoiceOptions}
                            emptyCopy={STATUS_COPY[resolution?.status ?? 'MISSING_INVOICE']}
                            onOpenChange={(open) => {
                              setCreatorPickerOpen(false);
                              setOpenDocumentPicker(open ? invoicePickerKey : null);
                            }}
                            onToggle={(invoiceId, selected) => {
                              if (selected) removeInvoice(creator.id as CreatorId, invoiceId as InvoiceId);
                              else addInvoice(creator.id as CreatorId, invoiceId as InvoiceId);
                            }}
                          />
                        </div>
                        <div className="media-request-document-field media-request-contracts">
                          <span>合同 <em>选填，可多选</em></span>
                          <RequestResourcePicker
                            id={contractPickerId}
                            kind="contract"
                            creatorName={creator.name}
                            open={openDocumentPicker === contractPickerKey}
                            selectedCount={selectedContractIds.length}
                            options={contractOptions}
                            emptyCopy="该合作项目下暂无合同，可不关联"
                            onOpenChange={(open) => {
                              setCreatorPickerOpen(false);
                              setOpenDocumentPicker(open ? contractPickerKey : null);
                            }}
                            onToggle={(contractId, selected) => {
                              if (selected) removeContract(creator.id as CreatorId, contractId as ContractId);
                              else addContract(creator.id as CreatorId, contractId as ContractId);
                            }}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : null}
            {!cooperationProjectId ? <NoticeBanner>请先选择关联项目，再选择达人并核对合同与 Invoice。</NoticeBanner> : null}
            {cooperationProjectId && !selectedCreators.length ? <NoticeBanner>请至少选择一位合作达人。有唯一可用 Invoice 的达人已排在列表最前方。</NoticeBanner> : null}
            {formSubmitAttempted && formIssues.length ? <div className="media-request-form-issues" role="alert"><AlertTriangle size={17} /><div><strong>请完成以下必填项后创建项目</strong>{formIssues.map((issue) => <span key={issue}>{issue}</span>)}</div></div> : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
