import {
  AlertCircle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  FileArchive,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Files,
  Images,
  Link2,
  ListFilter,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Avatar, Button, ListActionButton, Modal, NoticeBanner, PageHeading, SelectField, StatusMark, type SelectOption } from '../components/Common';
import { CreatorDraftExitDialog } from '../components/CreatorDraftExitDialog';
import {
  CreatorInvitationRecordsDialog,
  CreatorInvitationSendDialog,
} from '../components/CreatorInvitationDialogs';
import { CreatorPayoutAccounts } from '../components/CreatorPayoutAccounts';
import { CreatorIdentity, SocialPlatformIcon } from '../components/CreatorIdentity';
import { EntitySettingsCard } from '../components/EntitySettingsCard';
import { PaymentCurrencySummaryCard } from '../components/PaymentCurrencySummaryCard';
import { paymentProviderDisplayName, PaymentProviderBadge } from '../components/PaymentProviderBadge';
import { TransactionRecordsTable } from '../components/TransactionRecordsTable';
import type { ContractRecord } from '../contracts';
import { CURRENT_USER, PM_USERS, PROJECT_FIXTURES, type SystemUser } from '../data';
import { createMockFeishuCooperationProjectSource } from '../cooperationProjects';
import { Pagination, usePagination } from '../components/Pagination';
import { InvoiceManagementTable } from '../components/InvoiceManagementTable';
import { CollaborationInvoiceDrawer } from '../components/CollaborationInvoiceDrawer';
import {
  buildCollaborationProjectFilterOptions,
  CollaborationProjectFilter,
  filterCollaborationRowsByProject,
} from '../components/CollaborationProjectFilter';
import {
  buildCollaborationInvoiceRows,
  collaborationStatusTone,
} from '../collaborationInvoices';
import { buildInvoiceReviewModel } from '../invoice/invoiceReview';
import { resolveInvoiceCreatorIdentity } from '../invoice/invoiceCreatorIdentity';
import {
  filterInvoiceManagementRows,
  findInvoiceRequest,
  getInvoiceManagementReturnContext,
  getInvoiceManagementView,
  INVOICE_MANAGEMENT_STATUSES_BY_TAB,
  type InvoiceManagementFilters,
  type InvoiceManagementRow,
  type InvoiceManagementView,
} from '../invoice/invoiceManagement';
import { hasInvoiceSignatureEvidence } from '../invoice/invoiceSignature';
import { invoiceBatchDraftGeneratedCount } from '../invoice/invoiceCreationDrafts';
import {
  externalInvoiceListStatus,
  externalInvoicePageTab,
  externalInvoicePayoutProvider,
  type ExternalInvoiceCollectionInput,
  type ExternalInvoiceCollectionRecord,
  type ExternalInvoiceFieldKey,
  type ExternalInvoiceMediaReviewDecision,
  type ExternalInvoiceScenario,
} from '../invoice/externalInvoiceCollection';
import {
  addInvoiceBillingEntity,
  defaultInvoiceBillingEntity,
  invoiceEntitySnapshot,
  removeInvoiceBillingEntity,
  setDefaultInvoiceBillingEntity,
  updateInvoiceBillingEntity,
  validateInvoiceBillingEntity,
} from '../invoice/invoiceBillingEntities';
import {
  addContractAdvertiserEntity,
  removeContractAdvertiserEntity,
  setDefaultContractAdvertiserEntity,
  updateContractAdvertiserEntity,
  validateContractAdvertiserEntity,
} from '../contractAdvertiserEntities';
import {
  buildMockElectronicSignature,
  isInvoiceApprovedForPayment,
  type InvoiceReviewAction,
  type InvoicePageTab,
} from '../invoice/invoiceReviewWorkflow';
import {
  clonePayoutAccounts,
  createAirwallexPayoutAccount,
  createEmptyAirwallexAccount,
  createPayPalPayoutAccount,
  getDefaultPayoutAccount,
  getPayoutAccountId,
  getPayoutAccountVersion,
  getPayoutAccountSummary,
  getPayoutAccountStatusMeta,
  isPayoutAccountVerified,
  prepareCreatorPayoutAccountsForSave,
} from '../payoutAccounts';
import type {
  AirwallexTransferMethod,
  ContractAdvertiserEntity,
  ContractAdvertiserSettings,
  CreatorInvoiceContact,
  CreatorProfile,
  CreatorSocialAccount,
  CreatorSocialVerificationScreenshot,
  GeneratedInvoiceRecord,
  InvoiceBillingEntity,
  InvoiceBillingSettings,
  InvoiceCreationDraft,
  InvoiceEditContext,
  PaymentFailureIssueType,
  Payout,
  PayoutAccountStatus,
  RequestProjectStatusFilter,
} from '../types';
import { requestProjectStatusesForFilter } from '../requestProjectStatusFilters';
import { demoAccountName, demoDisplayName, demoRealName } from '../demoCreatorNames';
import {
  creatorCollaborationProjectsFor,
  type CreatorCollaborationProjectRecord,
} from '../creatorCollaborationProjects';
import {
  creatorSocialAccounts,
  creatorSearchTerms,
  creatorSocialSelectionValue,
  parseCreatorSocialSelectionValue,
  resolveCreatorSocialAccount,
} from '../creatorSearchOptions';
import {
  CREATOR_DIRECTORY_PROVIDER_OPTIONS,
  createCreatorDirectoryWorkbook,
  creatorDirectoryLegalEntityName,
  creatorDirectoryWorkbookFilename,
  creatorPayoutAccountVersionResult,
  distinctCreatorSocialPlatformCount,
  explicitDefaultPayoutAccount,
  filterCreatorDirectory,
  formatCreatorPayoutAccountUpdatedAt,
  latestCreatorPayoutAccountUpdatedAt,
  toggleCreatorDirectorySelection,
  type CreatorDirectoryProviderFilter,
} from '../creatorDirectoryWorkbook';
import {
  creatorInitialsFromName,
  creatorNameAfterManualInput,
  creatorNameAfterSocialAccountsChange,
  creatorNameFromPrimaryHandle,
  creatorRegionFromContactAddress,
  isCreatorNameAutoDerived,
} from '../creatorProfileDefaults';
import {
  loadCreatorInvitationRecords,
  saveCreatorInvitationRecords,
  summarizeActiveCreatorInvitations,
  type CreatorInvitationRecord,
  type CreatorInvitationStatusFilter,
} from '../creatorInvitations';
import { InvoiceDetailPage, type InvoiceDetailSource } from './InvoiceDetailPage';
import {
  ExternalInvoiceCollectionCreatePage,
  ExternalInvoiceCollectionDetailPage,
} from './ExternalInvoiceCollectionPage';
import { ProjectDetailPage, type ProjectSummary } from './ProjectDetailPage';
import { RequestProjectDetailPage, type RequestProjectSummary } from './RequestProjectDetailPage';
import {
  canEditProject,
  type CooperationProjectId,
  type ContractAdvertiserEntityId,
  type CreatorId,
  createPrototypeCode,
  createPrototypeId,
  nowIso,
  type EngagementId,
  type InvoiceId,
  type InvoiceBillingEntityId,
  type PaymentListEditableField,
  type PaymentListId,
  type PaymentListRecord,
  type PaymentRequestProjectId,
  type ProjectId,
  type RequestApprovalState,
  type RequestApprovalStatus,
  type WorkflowAuditEvent,
} from '../businessWorkflow';
import {
  myProjectStatusFor,
  requestProjectStatusFor,
} from '../paymentRequestProjects';
import type { RequestApprovalAction } from '../requestApprovalWorkflow';
import type { RequestApprovalReminderSummary } from '../requestApprovalReminders';
import { aggregatePayoutCurrencies } from '../paymentCurrencyOverview';
import { downloadBlob, todayInputValue } from '../invoice/invoiceUtils';
import {
  createTransactionRecords,
  filterTransactionRecords,
  type TransactionRecord,
  type TransactionTab,
  type TransactionProvider,
} from '../transactionRecords';
import {
  loadTransactionRecordsWorkbook,
  transactionRecordsFilename,
} from '../transactionRecordsWorkbook';
import {
  paymentBatchAmountLabel,
  paymentBatchFinancialSummary,
  paymentBatchMoneyTotalsLabel,
  paymentBatchPurposeLabel,
  paymentBatchStatusCounts,
  type PaymentBatchPurpose,
  type PaymentBatchRecord,
  type PaymentBatchStatus,
} from '../paymentBatches';
import {
  createPaymentBatchWorkbook,
  paymentBatchWorkbookFilename,
} from '../paymentBatchWorkbook';
import {
  ALL_PAYMENT_STATUSES,
  PAYMENT_STATUS_FILTER_OPTIONS,
  matchesPaymentStatus,
  type PaymentAggregateStatus,
  type PaymentStatusFilter,
} from '../paymentStatusFilters';
import { PaymentBatchDetailPage } from './PaymentBatchDetailPage';
import { TransactionDetailPage } from './TransactionDetailPage';
import './TransactionsPage.css';

type Notify = (title: string, message: string) => void;

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="search-control page-search">
      <Search size={16} />
      <input aria-label={placeholder} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

type SearchableMultiFilterOption = {
  value: string;
  label: string;
  description?: string;
};

function SearchableMultiFilter({
  className = '',
  label,
  placeholder,
  searchPlaceholder,
  options,
  selected,
  onChange,
}: {
  className?: string;
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  options: SearchableMultiFilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const filteredOptions = options.filter((option) => (
    `${option.label}${option.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
  ));
  const selectedLabels = selected
    .map((value) => options.find((option) => option.value === value)?.label ?? value)
    .filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const toggleValue = (value: string) => {
    onChange(selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value]);
  };

  return (
    <div className={`searchable-multi-filter ${className}${open ? ' searchable-multi-filter-open' : ''}`.trim()} ref={rootRef}>
      <span className="project-filter-field-label">{label}</span>
      <button
        className="searchable-multi-trigger"
        type="button"
        role="combobox"
        aria-label={`${label}筛选`}
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          setOpen((current) => !current);
          if (open) setQuery('');
        }}
      >
        <span className={selectedLabels.length > 0 ? '' : 'searchable-multi-placeholder'}>
          {selectedLabels.length === 0
            ? placeholder
            : selectedLabels.length === 1
              ? selectedLabels[0]
              : `已选择 ${selectedLabels.length} 项`}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div className="searchable-multi-menu" id={listboxId} role="listbox" aria-label={`${label}选项`} aria-multiselectable="true">
          <label className="search-control searchable-multi-search">
            <Search size={15} />
            <input
              aria-label={searchPlaceholder}
              autoFocus
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="searchable-multi-options">
            {filteredOptions.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  className={`searchable-multi-option${isSelected ? ' searchable-multi-option-selected' : ''}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  key={option.value}
                  onClick={() => toggleValue(option.value)}
                >
                  <span className="searchable-multi-option-check" aria-hidden="true">{isSelected ? <Check size={13} /> : null}</span>
                  <span className="searchable-multi-option-copy">
                    <strong>{option.label}</strong>
                    {option.description ? <small>{option.description}</small> : null}
                  </span>
                </button>
              );
            })}
            {filteredOptions.length === 0 ? <div className="searchable-multi-empty">没有匹配选项</div> : null}
          </div>
          {selected.length > 0 ? (
            <button className="searchable-multi-clear" type="button" onClick={() => onChange([])}>清除已选</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  meta,
  tone = 'plain',
  onClick,
}: {
  label: string;
  value: string;
  meta: string;
  tone?: 'plain' | 'peach' | 'lilac';
  onClick?: () => void;
}) {
  const content = <><span>{label}</span><strong>{value}</strong><small>{meta}</small></>;
  return onClick ? (
    <button className={`metric-card metric-card-action metric-${tone}`} type="button" onClick={onClick}>
      {content}
    </button>
  ) : (
    <article className={`metric-card metric-${tone}`}>{content}</article>
  );
}

type ProjectStatusTone = 'active' | 'review' | 'payment' | 'complete' | 'failure' | 'draft' | 'default';

const PROJECT_STATUS_TONES: Record<string, ProjectStatusTone> = {
  '执行中': 'active',
  'PM 审批中': 'active',
  'PM审批中': 'active',
  '媒介负责人审批中': 'active',
  '老板审批中': 'active',
  '财务审批中': 'active',
  '飞书审批中': 'active',
  '待验收': 'review',
  '待审批': 'review',
  '请款提交': 'review',
  '待补资料': 'review',
  '待财务复核': 'review',
  '待发起请款': 'active',
  'PM审批通过': 'active',
  '媒介负责人审批通过': 'active',
  '老板审批通过': 'active',
  '财务审批通过': 'payment',
  '正在付款': 'payment',
  '付款处理中': 'payment',
  '付款中': 'payment',
  '待打款': 'payment',
  '等待付款': 'payment',
  '部分打款失败': 'failure',
  '部分失败': 'failure',
  '全部失败': 'failure',
  '已完成': 'complete',
  '已付款': 'complete',
  '已归档': 'complete',
  '已通过': 'complete',
  '已关联': 'complete',
  '草稿': 'draft',
  '未关联': 'draft',
  '已退回': 'draft',
  '已取消': 'draft',
  '暂停': 'draft',
};

export function ProjectStatus({ status }: { status: string }) {
  const visibleStatus = status.replace(/项目负责人/g, '媒介负责人');
  const tone = PROJECT_STATUS_TONES[visibleStatus] ?? 'default';
  return <span className={`simple-status project-status project-status-${tone}`} data-project-status={visibleStatus}><i aria-hidden="true" />{visibleStatus}</span>;
}

export type ProjectListFilters = {
  customers: string[];
  pms: string[];
  currency: string;
  minBudget: string;
  maxBudget: string;
  startDate: string;
  endDate: string;
  statuses: string[];
};

export const createEmptyProjectListFilters = (): ProjectListFilters => ({
  customers: [],
  pms: [],
  currency: 'all',
  minBudget: '',
  maxBudget: '',
  startDate: '',
  endDate: '',
  statuses: [],
});

export const correctedProjectFilterDateRange = (
  startDate: string,
  endDate: string,
  changedBoundary: 'start' | 'end',
): [string, string] => {
  if (!startDate || !endDate || startDate <= endDate) return [startDate, endDate];
  return changedBoundary === 'start' ? [startDate, startDate] : [endDate, endDate];
};

export const REQUEST_PROJECT_STATUS_OPTIONS = [
  'PM审批中',
  '媒介负责人审批中',
  '老板审批中',
  '财务审批中',
  '正在付款',
  '付款处理中',
  '部分失败',
  '全部失败',
  '已付款',
] as const;

const parseProjectBudget = (budget: string) => ({
  currency: budget.match(/\b[A-Z]{3}\b/)?.[0] ?? '',
  amount: Number(budget.replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0] ?? 0),
});

type ProjectFilterSelectOption = {
  value: string;
  label: string;
  description?: string;
  leading?: ReactNode;
  statuses?: string[];
  tone?: 'all' | 'active' | 'complete' | 'failure';
};

const projectStatusSelectionsMatch = (current: string[], candidate: string[]) => (
  current.length === candidate.length
  && current.every((status) => candidate.includes(status))
);

export function ProjectInlineFilterPanel({
  search,
  filters,
  customerOptions,
  pmOptions,
  currencyOptions,
  statusOptions,
  resultCount,
  totalCount,
  invalidBudgetRange,
  onSearchChange,
  onFiltersChange,
  onClear,
  entityLabel = '项目',
  statusLabel = '项目状态',
  searchPlaceholder = '搜索项目名称或编号',
  listAriaLabel = '项目列表筛选',
  countLabel = '个项目',
  dateRangeLabel,
}: {
  search: string;
  filters: ProjectListFilters;
  customerOptions: SearchableMultiFilterOption[];
  pmOptions: SearchableMultiFilterOption[];
  currencyOptions: ProjectFilterSelectOption[];
  statusOptions: ProjectFilterSelectOption[];
  resultCount: number;
  totalCount: number;
  invalidBudgetRange: boolean;
  onSearchChange: (value: string) => void;
  onFiltersChange: Dispatch<SetStateAction<ProjectListFilters>>;
  onClear: () => void;
  entityLabel?: string;
  statusLabel?: string;
  searchPlaceholder?: string;
  listAriaLabel?: string;
  countLabel?: string;
  dateRangeLabel?: string;
}) {
  const hasBudgetFilter = filters.currency !== 'all' || Boolean(filters.minBudget || filters.maxBudget);
  const hasDateFilter = Boolean(filters.startDate || filters.endDate);
  const activeFilterCount = Number(filters.customers.length > 0)
    + Number(filters.pms.length > 0)
    + Number(hasBudgetFilter)
    + Number(hasDateFilter)
    + Number(filters.statuses.length > 0);
  const hasActiveFilters = activeFilterCount > 0 || Boolean(search.trim());
  const selectedStatusOption = statusOptions.find((option) => {
    const optionStatuses = option.value === 'all' ? [] : option.statuses ?? [option.value];
    return projectStatusSelectionsMatch(filters.statuses, optionStatuses);
  });
  const selectedStatus = selectedStatusOption?.value ?? filters.statuses[0] ?? 'all';
  const selectedStatusTone = selectedStatusOption?.tone
    ?? (selectedStatus === '已完成' || selectedStatus === '已付款'
      ? 'complete'
      : selectedStatus === '部分失败' || selectedStatus === '全部失败'
        ? 'failure'
        : selectedStatus === 'all'
          ? 'all'
          : 'active');

  return (
    <div className="project-inline-filter-panel" aria-label={listAriaLabel}>
      <div className="project-inline-filters">
        <div className="project-filter-field project-inline-filter-search">
          <span className="project-filter-field-label">{entityLabel}</span>
          <SearchBar value={search} onChange={onSearchChange} placeholder={searchPlaceholder} />
        </div>
        <SearchableMultiFilter
          className="project-inline-filter-customer"
          label="合作客户"
          placeholder="全部合作客户"
          searchPlaceholder="搜索合作客户"
          options={customerOptions}
          selected={filters.customers}
          onChange={(customers) => onFiltersChange((current) => ({ ...current, customers }))}
        />
        <SearchableMultiFilter
          className="project-inline-filter-pm"
          label="负责 PM"
          placeholder="全部 PM"
          searchPlaceholder="搜索 PM 姓名或邮箱"
          options={pmOptions}
          selected={filters.pms}
          onChange={(pms) => onFiltersChange((current) => ({ ...current, pms }))}
        />
        <div className="project-inline-filter-budget">
          <div className="project-budget-filter-grid">
            <div className="project-filter-field">
              <span className="project-filter-field-label">预算</span>
              <SelectField
                ariaLabel="预算币种"
                variant="form"
                value={filters.currency}
                options={currencyOptions}
                onChange={(currency) => onFiltersChange((current) => ({ ...current, currency }))}
              />
            </div>
            <label className="project-filter-field">
              <span className="project-filter-field-label">最低金额</span>
              <input
                className="project-budget-input"
                aria-label="最低预算"
                inputMode="decimal"
                min="0"
                type="number"
                placeholder="不限"
                value={filters.minBudget}
                onChange={(event) => onFiltersChange((current) => ({ ...current, minBudget: event.target.value }))}
              />
            </label>
            <label className="project-filter-field">
              <span className="project-filter-field-label">最高金额</span>
              <input
                className="project-budget-input"
                aria-label="最高预算"
                inputMode="decimal"
                min="0"
                type="number"
                placeholder="不限"
                value={filters.maxBudget}
                onChange={(event) => onFiltersChange((current) => ({ ...current, maxBudget: event.target.value }))}
              />
            </label>
          </div>
          {invalidBudgetRange ? <small className="project-budget-error">最高金额不能低于最低金额，当前暂不应用金额区间</small> : null}
        </div>
        <div className="project-filter-field project-inline-filter-status">
          <span className="project-filter-field-label">{statusLabel}</span>
          <SelectField
            ariaLabel={statusLabel}
            className={`project-status-select project-status-select-${selectedStatusTone}`}
            variant="form"
            value={selectedStatus}
            options={statusOptions}
            onChange={(status) => {
              const option = statusOptions.find((candidate) => candidate.value === status);
              onFiltersChange((current) => ({
                ...current,
                statuses: status === 'all' ? [] : [...(option?.statuses ?? [status])],
              }));
            }}
          />
        </div>
        {dateRangeLabel ? (
          <div className="project-filter-field project-inline-filter-date">
            <span className="project-filter-field-label">{dateRangeLabel}</span>
            <div className="project-filter-date-range" role="group" aria-label={`${dateRangeLabel}区间`}>
              <CalendarDays size={16} aria-hidden="true" />
              <label>
                <span className="sr-only">{dateRangeLabel}开始日期</span>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => onFiltersChange((current) => {
                    const [startDate, endDate] = correctedProjectFilterDateRange(event.target.value, current.endDate, 'start');
                    return { ...current, startDate, endDate };
                  })}
                />
              </label>
              <span className="project-filter-date-divider" aria-hidden="true">—</span>
              <label>
                <span className="sr-only">{dateRangeLabel}结束日期</span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => onFiltersChange((current) => {
                    const [startDate, endDate] = correctedProjectFilterDateRange(current.startDate, event.target.value, 'end');
                    return { ...current, startDate, endDate };
                  })}
                />
              </label>
            </div>
          </div>
        ) : null}
        <div className="project-inline-filter-meta">
          <span>
            {hasActiveFilters
              ? `显示 ${resultCount} / ${totalCount} ${countLabel}`
              : `共 ${totalCount} ${countLabel}`}
          </span>
          {hasActiveFilters ? <button type="button" onClick={onClear}>清除全部</button> : null}
        </div>
      </div>
    </div>
  );
}

const PROJECT_PM_ACCENTS = ['#ff7d64', '#7568e6', '#20a874'] as const;
const PROJECT_PM_OPTIONS = PM_USERS.map((user, index) => ({
  value: user.name,
  label: user.name,
  description: `${user.email} · PM 账号`,
  leading: <Avatar initials={user.initials} accent={PROJECT_PM_ACCENTS[index % PROJECT_PM_ACCENTS.length]} size="sm" />,
}));

export function ProjectsPage({
  notify,
  creators,
  currentUser,
  projects,
  contracts,
  generatedInvoices,
  paymentLists,
  auditEvents,
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
  onSubmitProjectReview,
  onProjectsChange,
  canCreateProject,
  focusedProjectId,
  onFocusCleared,
}: {
  notify: Notify;
  creators: CreatorProfile[];
  currentUser: SystemUser;
  projects: ProjectSummary[];
  contracts: ContractRecord[];
  generatedInvoices: GeneratedInvoiceRecord[];
  paymentLists: PaymentListRecord[];
  auditEvents: WorkflowAuditEvent[];
  onOpenContract: (contractId: string) => void;
  onOpenInvoice: (invoiceId: InvoiceId) => void;
  onCreateInvoice: (engagementId: EngagementId) => void;
  onLinkContract: (contractId: string, engagementId: EngagementId) => void;
  onUnlinkContract: (contractId: string) => void;
  onDeleteContract: (contractId: string) => void;
  onLinkInvoice: (invoiceId: InvoiceId, engagementId: EngagementId) => void;
  onUnlinkInvoice: (invoiceId: InvoiceId) => void;
  onDeleteInvoice: (invoiceId: InvoiceId) => void;
  onCreatePaymentList: (project: ProjectSummary) => void;
  onDeletePaymentList: (project: ProjectSummary, paymentListId: PaymentListId) => void;
  onAddPaymentInvoice: (project: ProjectSummary, paymentListId: PaymentListId, invoiceId: InvoiceId) => void;
  onRemovePaymentInvoice: (project: ProjectSummary, invoiceId: InvoiceId) => void;
  onUpdatePaymentItem: (project: ProjectSummary, invoiceId: InvoiceId, field: PaymentListEditableField, value: string | number) => void;
  onChangePaymentAccount: (project: ProjectSummary, invoiceId: InvoiceId, payoutAccountId: string) => void;
  onRevalidatePaymentItem: (project: ProjectSummary, invoiceId: InvoiceId) => void;
  onGeneratePaymentOrder: (project: ProjectSummary, paymentListId: PaymentListId) => InvoiceId | null;
  onEditPaymentOrder: (project: ProjectSummary, paymentListId: PaymentListId) => void;
  onExportPaymentList: (project: ProjectSummary, paymentListId: PaymentListId) => Promise<void>;
  onSubmitProjectReview: (project: ProjectSummary) => void;
  onProjectsChange: (updater: (current: ProjectSummary[]) => ProjectSummary[]) => void;
  canCreateProject: boolean;
  focusedProjectId: string | null;
  onFocusCleared: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ProjectListFilters>(createEmptyProjectListFilters);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [selectedPM, setSelectedPM] = useState(PM_USERS[0]?.name ?? '');
  const [requestReason, setRequestReason] = useState('');
  const [selectedCreatorHandles, setSelectedCreatorHandles] = useState<string[]>([]);
  const [closeGuardOpen, setCloseGuardOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(focusedProjectId);
  const selectedProject = selectedProjectId ? projects.find((project) => project.id === selectedProjectId) : null;
  const currentScopeName = currentUser.scopeName ?? currentUser.name;
  const relatedProjects = projects.filter((project) => {
    if (currentUser.roleKey === 'media') return project.media === currentScopeName;
    if (currentUser.roleKey === 'pm') return project.pm === currentScopeName;
    return true;
  });
  const customerCounts = relatedProjects.reduce<Record<string, number>>((result, project) => ({
    ...result,
    [project.brand]: (result[project.brand] ?? 0) + 1,
  }), {});
  const customerFilterOptions = Object.entries(customerCounts).map(([customer, count]) => ({
    value: customer,
    label: customer,
    description: `${count} 个项目`,
  }));
  const pmCounts = relatedProjects.reduce<Record<string, number>>((result, project) => ({
    ...result,
    [project.pm]: (result[project.pm] ?? 0) + 1,
  }), {});
  const pmFilterOptions = PM_USERS
    .filter((user) => pmCounts[user.name])
    .map((user) => ({
      value: user.name,
      label: user.name,
      description: `${pmCounts[user.name]} 个项目 · ${user.email}`,
    }));
  const statusFilterOptions = Array.from(new Set(relatedProjects.map((project) => project.status))).map((status) => ({
    value: status,
    label: status,
    description: `${relatedProjects.filter((project) => project.status === status).length} 个项目`,
    leading: (
      <span
        className={`project-status-select-dot ${
          status === '已完成' ? 'project-status-select-dot-complete' : 'project-status-select-dot-active'
        }`}
      />
    ),
  }));
  const statusSelectOptions = [
    {
      value: 'all',
      label: '全部状态',
      description: `共 ${relatedProjects.length} 个项目`,
      leading: <span className="project-status-select-dot project-status-select-dot-all" />,
    },
    ...statusFilterOptions,
  ];
  const projectCurrencies = Array.from(new Set(relatedProjects.map((project) => parseProjectBudget(project.budget).currency).filter(Boolean)));
  const currencyFilterOptions = [
    { value: 'all', label: '全部币种' },
    ...projectCurrencies.map((currency) => ({ value: currency, label: currency })),
  ];
  const query = search.trim().toLowerCase();
  const minBudget = filters.minBudget ? Number(filters.minBudget) : null;
  const maxBudget = filters.maxBudget ? Number(filters.maxBudget) : null;
  const invalidBudgetRange = minBudget !== null && maxBudget !== null && minBudget > maxBudget;
  const filteredProjects = relatedProjects.filter((project) => {
    const budget = parseProjectBudget(project.budget);
    const matchesSearch = !query || `${project.name}${project.id}`.toLowerCase().includes(query);
    const matchesCustomer = filters.customers.length === 0 || filters.customers.includes(project.brand);
    const matchesPM = filters.pms.length === 0 || filters.pms.includes(project.pm);
    const matchesCurrency = filters.currency === 'all' || filters.currency === budget.currency;
    const matchesMinBudget = invalidBudgetRange || minBudget === null || budget.amount >= minBudget;
    const matchesMaxBudget = invalidBudgetRange || maxBudget === null || budget.amount <= maxBudget;
    const matchesStatus = filters.statuses.length === 0 || filters.statuses.includes(project.status);
    return matchesSearch && matchesCustomer && matchesPM && matchesCurrency && matchesMinBudget && matchesMaxBudget && matchesStatus;
  });
  const {
    page: projectPage,
    pageItems: visibleProjects,
    pageSize: projectPageSize,
    setPage: setProjectPage,
    setPageSize: setProjectPageSize,
  } = usePagination(filteredProjects, { resetKey: `${search}\u0000${JSON.stringify(filters)}` });
  const clearProjectFilters = () => {
    setSearch('');
    setFilters(createEmptyProjectListFilters());
  };
  const draftStorageKey = `comets-pay.project-draft.v1:${currentUser.account}`;
  const hasProjectDraftContent = Boolean(
    name.trim()
    || brand.trim()
    || requestReason.trim()
    || selectedCreatorHandles.length
    || selectedPM !== (PM_USERS[0]?.name ?? ''),
  );

  const resetProjectForm = () => {
    setName('');
    setBrand('');
    setSelectedPM(PM_USERS[0]?.name ?? '');
    setRequestReason('');
    setSelectedCreatorHandles([]);
  };

  const discardProjectDraft = () => {
    localStorage.removeItem(draftStorageKey);
    resetProjectForm();
    setCloseGuardOpen(false);
    setModalOpen(false);
  };

  const requestCloseProjectModal = () => {
    if (hasProjectDraftContent) {
      setCloseGuardOpen(true);
      return;
    }
    discardProjectDraft();
  };

  const saveProjectDraft = () => {
    localStorage.setItem(draftStorageKey, JSON.stringify({
      name,
      customer: brand,
      selectedPM,
      requestReason,
      selectedCreatorHandles,
      savedAt: new Date().toISOString(),
    }));
    setCloseGuardOpen(false);
    setModalOpen(false);
    notify('项目草稿已保存', '下次打开新建项目时会自动恢复。');
  };

  const openProjectModal = () => {
    resetProjectForm();
    const saved = localStorage.getItem(draftStorageKey);
    if (saved) {
      try {
        const draft = JSON.parse(saved) as {
          name?: string;
          customer?: string;
          selectedPM?: string;
          requestReason?: string;
          selectedCreatorHandles?: string[];
        };
        const validPM = PM_USERS.some((user) => user.name === draft.selectedPM);
        const creatorSelectionSet = new Set(creators.flatMap((creator) => (
          creatorSocialAccounts(creator).map((account) => creatorSocialSelectionValue(creator.id, account.id))
        )));
        const validHandles = (draft.selectedCreatorHandles ?? []).filter((value) => creatorSelectionSet.has(value));
        setName(draft.name ?? '');
        setBrand(draft.customer ?? '');
        setSelectedPM(validPM ? draft.selectedPM! : (PM_USERS[0]?.name ?? ''));
        setRequestReason(draft.requestReason ?? '');
        setSelectedCreatorHandles(validHandles);
        notify(
          !validPM || validHandles.length !== (draft.selectedCreatorHandles ?? []).length
            ? '草稿已恢复并校正'
            : '项目草稿已恢复',
          !validPM || validHandles.length !== (draft.selectedCreatorHandles ?? []).length
            ? '已移除当前系统中不存在的 PM 或达人关联。'
            : '已恢复上次未完成的项目内容。',
        );
      } catch {
        localStorage.removeItem(draftStorageKey);
      }
    }
    setModalOpen(true);
  };

  const createProject = () => {
    if (!name.trim() || !selectedPM || selectedCreatorHandles.length === 0) return;
    const selectedCreatorProfiles = selectedCreatorHandles.flatMap((value) => {
      const selection = parseCreatorSocialSelectionValue(value);
      const creator = creators.find((item) => item.id === selection?.creatorId);
      const socialAccount = resolveCreatorSocialAccount(creator, selection?.socialAccountId);
      return creator && socialAccount ? [{ creator, socialAccount }] : [];
    });
    if (selectedCreatorProfiles.length === 0) return;
    const projectId = createPrototypeId('project') as ProjectId;
    const projectCode = createPrototypeCode('PRJ');
    const createdAt = nowIso();
    onProjectsChange((current) => [{
      id: projectCode,
      projectId,
      projectCode,
      name: name.trim(),
      brand: brand.trim() || '待补充品牌',
      media: currentUser.name,
      pm: selectedPM,
      creators: selectedCreatorProfiles.length,
      creatorProfiles: selectedCreatorProfiles.map(({ creator, socialAccount }) => ({
        creatorId: creator.id as CreatorId,
        projectId,
        engagementId: createPrototypeId('engagement') as EngagementId,
        status: 'active',
        createdAt,
        updatedAt: createdAt,
        name: creator.name,
        handle: socialAccount.handle,
        platform: socialAccount.platform,
        socialAccountId: socialAccount.id,
      })),
      requestReason: requestReason.trim(),
      invoiceCount: 0,
      budget: 'USD 0',
      status: '草稿',
      reviewStatus: 'draft',
      reviewUpdatedAt: createdAt,
    }, ...current]);
    localStorage.removeItem(draftStorageKey);
    resetProjectForm();
    setModalOpen(false);
    notify('项目已创建', `新项目已保存为草稿，已关联 ${selectedCreatorProfiles.length} 位合作达人。合同与 Invoice 请在后续独立流程中关联。`);
  };

  const updateProjectCreators = (projectId: string, creatorHandles: string[]) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project || !canEditProject(currentUser, project.reviewStatus ?? 'draft')) {
      notify('项目资料已锁定', '当前账号或项目状态不允许修改达人名单。');
      return;
    }
    const selectedCreatorAccounts = creatorHandles.flatMap((value) => {
      const selection = parseCreatorSocialSelectionValue(value);
      const creator = creators.find((item) => item.id === selection?.creatorId);
      const socialAccount = resolveCreatorSocialAccount(creator, selection?.socialAccountId);
      return creator && socialAccount ? [{ creator, socialAccount }] : [];
    });
    const nextCreatorIds = new Set(selectedCreatorAccounts.map(({ creator }) => creator.id));
    const removedReferences = (project.creatorProfiles ?? []).filter((reference) => !nextCreatorIds.has(reference.creatorId));
    const blockedRemoval = removedReferences.find((reference) => (
      contracts.some((contract) => contract.engagementId === reference.engagementId)
      || generatedInvoices.some((invoice) => invoice.snapshot.engagementId === reference.engagementId)
      || paymentLists.some((list) => list.items.some((item) => item.engagementId === reference.engagementId))
    ));
    if (blockedRemoval) {
      notify('无法移除达人', `${blockedRemoval.name} 仍有关联合同、Invoice 或付款清单，请先处理这些资料。`);
      return;
    }
    const selectedCreatorProfiles = selectedCreatorAccounts;
    onProjectsChange((current) => current.map((project) => (
      project.id === projectId
        ? {
            ...project,
            creators: selectedCreatorProfiles.length,
            creatorProfiles: selectedCreatorProfiles.map(({ creator, socialAccount }) => ({
              creatorId: creator.id as CreatorId,
              engagementId: project.creatorProfiles?.find((item) => item.creatorId === creator.id)?.engagementId
                ?? createPrototypeId('engagement') as EngagementId,
              projectId: (project.projectId ?? project.id) as ProjectId,
              status: 'active',
              createdAt: project.creatorProfiles?.find((item) => item.creatorId === creator.id)?.createdAt ?? nowIso(),
              updatedAt: nowIso(),
              name: creator.name,
              handle: socialAccount.handle,
              platform: socialAccount.platform,
              socialAccountId: socialAccount.id,
            })),
          }
        : project
    )));
  };

  if (selectedProject) {
    return (
      <ProjectDetailPage
        project={selectedProject}
        creatorArchive={creators}
        currentUser={currentUser}
        notify={notify}
        contracts={contracts}
        invoices={generatedInvoices}
        paymentLists={paymentLists.filter((list) => list.projectId === (selectedProject.projectId ?? selectedProject.id))}
        auditEvents={auditEvents.filter((event) => event.projectId === (selectedProject.projectId ?? selectedProject.id))}
        onOpenContract={onOpenContract}
        onOpenInvoice={onOpenInvoice}
        onCreateInvoice={onCreateInvoice}
        onLinkContract={onLinkContract}
        onUnlinkContract={onUnlinkContract}
        onDeleteContract={onDeleteContract}
        onLinkInvoice={onLinkInvoice}
        onUnlinkInvoice={onUnlinkInvoice}
        onDeleteInvoice={onDeleteInvoice}
        onCreatePaymentList={() => onCreatePaymentList(selectedProject)}
        onDeletePaymentList={(paymentListId) => onDeletePaymentList(selectedProject, paymentListId)}
        onAddPaymentInvoice={(paymentListId, invoiceId) => onAddPaymentInvoice(selectedProject, paymentListId, invoiceId)}
        onRemovePaymentInvoice={(invoiceId) => onRemovePaymentInvoice(selectedProject, invoiceId)}
        onUpdatePaymentItem={(invoiceId, field, value) => onUpdatePaymentItem(selectedProject, invoiceId, field, value)}
        onChangePaymentAccount={(invoiceId, payoutAccountId) => onChangePaymentAccount(selectedProject, invoiceId, payoutAccountId)}
        onRevalidatePaymentItem={(invoiceId) => onRevalidatePaymentItem(selectedProject, invoiceId)}
        onGeneratePaymentOrder={(paymentListId) => onGeneratePaymentOrder(selectedProject, paymentListId)}
        onEditPaymentOrder={(paymentListId) => onEditPaymentOrder(selectedProject, paymentListId)}
        onExportPaymentList={(paymentListId) => onExportPaymentList(selectedProject, paymentListId)}
        onSubmitReview={() => onSubmitProjectReview(selectedProject)}
        onUpdateCreators={(creatorHandles) => updateProjectCreators(selectedProject.id, creatorHandles)}
        onBack={() => {
          setSelectedProjectId(null);
          onFocusCleared();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        title="我的请款"
        subtitle="仅展示与当前账号关联的项目，集中管理项目合同与invoice、达人名单、请款进度。"
        actions={canCreateProject ? <Button icon={<Plus size={17} />} onClick={openProjectModal}>新建项目</Button> : undefined}
      />
      <div className="metrics-grid"><MetricCard label="审核中" value="5" meta="2 个待审批 · 3 个审批中" tone="peach" /><MetricCard label="待打款" value="1" meta="已完成全部审批" /><MetricCard label="请款项目总数" value={relatedProjects.length.toString()} meta="已同步真实项目名称" tone="lilac" /></div>
      <section className="content-card">
        <ProjectInlineFilterPanel
          search={search}
          filters={filters}
          customerOptions={customerFilterOptions}
          pmOptions={pmFilterOptions}
          currencyOptions={currencyFilterOptions}
          statusOptions={statusSelectOptions}
          resultCount={filteredProjects.length}
          totalCount={relatedProjects.length}
          invalidBudgetRange={invalidBudgetRange}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onClear={clearProjectFilters}
        />
        <div className="table-scroll">
          <table className="data-table operational-table">
            <thead><tr><th>项目</th><th>合作客户</th><th>负责 PM</th><th>达人</th><th>预算</th><th>状态</th><th className="action-cell">操作</th></tr></thead>
            <tbody>
              {visibleProjects.map((project) => (
                <tr key={project.id}>
                  <td><strong>{project.name}</strong><small className="cell-subtext">{project.id}</small></td>
                  <td>{project.brand}</td>
                  <td>{project.pm}</td>
                  <td>{project.creators} 位</td>
                  <td>{project.budget}</td>
                  <td><ProjectStatus status={project.status} /></td>
                  <td className="action-cell"><ListActionButton kind="view" onClick={() => { setSelectedProjectId(project.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>查看项目</ListActionButton></td>
                </tr>
              ))}
              {filteredProjects.length === 0 ? <tr><td className="project-list-empty" colSpan={7}>暂无符合当前搜索与筛选条件的项目</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>共 {filteredProjects.length} 个项目</span>
          <Pagination
            ariaLabel="项目列表分页"
            page={projectPage}
            pageSize={projectPageSize}
            total={filteredProjects.length}
            onPageChange={setProjectPage}
            onPageSizeChange={setProjectPageSize}
          />
        </div>
      </section>
      {modalOpen ? (
        <Modal
          title="新建项目"
          onClose={requestCloseProjectModal}
          width="760px"
          footer={<><Button variant="ghost" onClick={requestCloseProjectModal}>取消</Button><Button disabled={!name.trim() || !selectedPM || selectedCreatorHandles.length === 0} disabledReason={!name.trim() ? '请先填写项目名称。' : !selectedPM ? '请先选择媒介负责人。' : '请至少选择一位合作达人。'} onClick={createProject}>创建项目</Button></>}
        >
          <div className="form-grid single-column project-create-form">
            <label>
              <span className="required-field-label">项目名称 <em className="required-mark" aria-hidden="true">*</em></span>
              <input required aria-required="true" autoFocus placeholder="例如：秋季新品首发" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              <span>客户</span>
              <input placeholder="输入合作客户" value={brand} onChange={(event) => setBrand(event.target.value)} />
            </label>
            <div className="form-field project-pm-field">
              <span className="form-field-label">项目PM</span>
              <SelectField
                ariaLabel="选择项目PM"
                className="project-pm-select"
                variant="form"
                value={selectedPM}
                options={PROJECT_PM_OPTIONS}
                onChange={setSelectedPM}
                placeholder="请选择 PM 账号"
              />
            </div>
            <label>
              <span>付款事由</span>
              <textarea placeholder="填写本项目的付款背景或用途" value={requestReason} onChange={(event) => setRequestReason(event.target.value)} />
            </label>
            <div className="form-field">
              <span className="form-field-label form-field-label-with-meta">
                <span>合作达人 <em className="required-mark" aria-hidden="true">*</em></span>
                <small>必填 · 来自达人档案</small>
              </span>
              <ProjectCreatorPicker creators={creators} selectedHandles={selectedCreatorHandles} onChange={setSelectedCreatorHandles} />
            </div>
            <NoticeBanner>
              后续关联：合同与 Invoice 将在项目创建后分别通过合同管理和 Invoice 流程关联，避免在项目基础信息未确定时绑定业务单据。
            </NoticeBanner>
          </div>
        </Modal>
      ) : null}
      {closeGuardOpen ? (
        <Modal
          title="保留未完成的项目？"
          onClose={() => setCloseGuardOpen(false)}
          width="520px"
          footer={(
            <>
              <Button variant="ghost" onClick={discardProjectDraft}>放弃并退出</Button>
              <Button variant="secondary" onClick={saveProjectDraft}>保存草稿并退出</Button>
              <Button onClick={() => setCloseGuardOpen(false)}>继续编辑</Button>
            </>
          )}
        >
          <p className="project-draft-guard-copy">当前表单已有内容。草稿仅保存在此账号当前浏览器中，不会提交审批或同步到其他设备。</p>
        </Modal>
      ) : null}
    </div>
  );
}

const createFixtureRequestApproval = (
  requestStatus: string,
  pmName: string,
  statusOverride?: RequestApprovalStatus,
): RequestApprovalState => {
  const status: RequestApprovalStatus = statusOverride ?? (requestStatus.includes('财务')
    ? 'PENDING_FINANCE'
    : requestStatus.includes('媒介负责人') || requestStatus.includes('项目负责人')
      ? 'PENDING_PROJECT_OWNER'
      : requestStatus.includes('老板')
        ? 'PENDING_OWNER'
        : requestStatus === '待打款' || requestStatus === '已完成'
          ? 'APPROVED'
          : requestStatus === '已退回'
            ? 'RETURNED_TO_MEDIA_REVIEW'
            : 'PENDING_PM');
  const ordered = ['PENDING_PM', 'PENDING_PROJECT_OWNER', 'PENDING_OWNER', 'PENDING_FINANCE'] as const;
  const currentIndex = status === 'APPROVED' ? ordered.length : ordered.indexOf(status as typeof ordered[number]);
  const actorByStage = {
    PM: pmName,
    PROJECT_OWNER: '媒介负责人',
    OWNER: '老板',
    FINANCE: '财务',
  };
  const history = ordered.slice(0, Math.max(currentIndex, 0)).map((fromStatus, index) => {
    const stage = (['PM', 'PROJECT_OWNER', 'OWNER', 'FINANCE'] as const)[index];
    return {
      round: 1,
      stage,
      action: 'APPROVE' as const,
      actorAccount: `fixture-${stage.toLowerCase()}`,
      actorName: actorByStage[stage],
      actorRole: `${actorByStage[stage]}账号`,
      fromStatus,
      toStatus: index === ordered.length - 1 ? 'APPROVED' as const : ordered[index + 1],
      occurredAt: `2026-07-${String(18 + index).padStart(2, '0')}T02:00:00.000Z`,
    };
  });
  return {
    status,
    round: 1,
    history,
    submittedAt: '2026-07-17T02:00:00.000Z',
    returnedFromStage: status === 'RETURNED_TO_MEDIA_REVIEW' ? 'FINANCE' : undefined,
    resumeStatus: status === 'RETURNED_TO_MEDIA_REVIEW' ? 'PENDING_FINANCE' : undefined,
    returnReason: status === 'RETURNED_TO_MEDIA_REVIEW' ? '请媒介复核付款资料后重新提交。' : undefined,
    updatedAt: '2026-07-22T02:00:00.000Z',
  };
};

export const INITIAL_REQUEST_PROJECTS: RequestProjectSummary[] = [
  ...PROJECT_FIXTURES.map((project, projectIndex) => ({
    id: project.id,
    paymentRequestProjectId: `request_fixture_${String(projectIndex + 1).padStart(3, '0')}` as PaymentRequestProjectId,
    requestCode: `REQ-202607-${String(projectIndex + 1).padStart(6, '0')}`,
    cooperationProjectId: project.id as CooperationProjectId,
    cooperationProjectCode: project.id,
    cooperationProjectName: project.name,
    lifecycle: project.requestStatus === '已完成'
      ? 'COMPLETED' as const
      : project.requestStatus === '待打款'
        ? 'APPROVED' as const
        : project.requestStatus === '已退回'
          ? 'RETURNED' as const
          : project.requestStatus === '待补资料'
            ? 'DRAFT' as const
            : 'SUBMITTED' as const,
    projectId: project.id as ProjectId,
    project: project.name,
    brand: project.brand,
    media: project.media,
    pm: project.pm,
    paymentEntity: projectIndex % 6 === 5 ? 'novacomets' as const : 'Comets International Limited' as const,
    projectCostAttribution: /\bJapan\b|日本/i.test(project.name)
      ? '日本分公司' as const
      : projectIndex % 6 === 5
        ? 'novacomets' as const
        : '香港公司（comets）' as const,
    costType: projectIndex % 4 === 1 ? '采购成本' as const : '网红采买成本' as const,
    costTypeDetail: projectIndex % 4 === 1 ? '实物采购' as const : undefined,
    amount: project.budget,
    contracts: project.creators,
    invoices: project.creators,
    paymentOrder: project.paymentOrder,
    status: project.requestStatus,
    filter: project.requestFilter,
    approval: createFixtureRequestApproval(
      project.requestStatus,
      project.pm,
      projectIndex === 1
        ? 'PENDING_PROJECT_OWNER'
        : projectIndex === 9
          ? 'PENDING_OWNER'
          : undefined,
    ),
    createdAt: `2026-07-${String(10 + (projectIndex % 18)).padStart(2, '0')}T${String(8 + (projectIndex % 9)).padStart(2, '0')}:30:00.000Z`,
  })),
];

export function RequestsPage({
  notify,
  currentUser,
  requests,
  payouts = [],
  paymentLists,
  creators,
  generatedInvoices,
  contracts = [],
  approvalReminder,
  showApprovalReminder,
  onDismissApprovalReminder,
  onExportPaymentList,
  onApprovalAction,
  onOpenFinanceReview,
  initialStatusFilter,
  focusedRequestId,
  onFocusCleared,
}: {
  notify: Notify;
  currentUser: SystemUser;
  requests: RequestProjectSummary[];
  payouts?: Payout[];
  paymentLists: PaymentListRecord[];
  creators: CreatorProfile[];
  generatedInvoices: GeneratedInvoiceRecord[];
  contracts?: ContractRecord[];
  approvalReminder: RequestApprovalReminderSummary;
  showApprovalReminder: boolean;
  onDismissApprovalReminder: () => void;
  onExportPaymentList: (request: RequestProjectSummary, paymentListId: PaymentListId) => Promise<void>;
  onApprovalAction: (
    request: RequestProjectSummary,
    action: RequestApprovalAction,
    reason?: string,
  ) => boolean;
  onOpenFinanceReview: () => void;
  initialStatusFilter: RequestProjectStatusFilter;
  focusedRequestId: string | null;
  onFocusCleared: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ProjectListFilters>(() => ({
    ...createEmptyProjectListFilters(),
    statuses: requestProjectStatusesForFilter(initialStatusFilter),
  }));
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(focusedRequestId);
  const selectedRequest = selectedRequestId ? requests.find((request) => request.id === selectedRequestId) : null;
  const currentScopeName = currentUser.scopeName ?? currentUser.name;
  const relatedRequests = requests.filter((request) => {
    if (request.lifecycle === 'DRAFT' || request.lifecycle === 'CANCELLED') return false;
    if (!request.approval && request.lifecycle !== 'APPROVED' && request.lifecycle !== 'COMPLETED') return false;
    if (currentUser.roleKey === 'media') return request.media === currentScopeName;
    if (currentUser.roleKey === 'pm') return request.pm === currentScopeName;
    return true;
  });
  const requestStatusById = new Map(relatedRequests.map((request) => [
    request.id,
    requestProjectStatusFor(request, payouts),
  ]));
  const requestOverview = relatedRequests.reduce((summary, request) => {
    const status = requestStatusById.get(request.id);
    if (
      status === 'PM审批中'
      || status === '媒介负责人审批中'
      || status === '老板审批中'
      || status === '财务审批中'
    ) summary.approvalInProgress += 1;
    if (status === '正在付款') summary.awaitingPayment += 1;
    if (status === '已付款') summary.completed += 1;
    if (status === '已退回' || status === '部分失败' || status === '全部失败') summary.needsAttention += 1;
    return summary;
  }, {
    approvalInProgress: 0,
    awaitingPayment: 0,
    completed: 0,
    needsAttention: 0,
  });
  const requestCustomerCounts = relatedRequests.reduce<Record<string, number>>((result, request) => ({
    ...result,
    [request.brand]: (result[request.brand] ?? 0) + 1,
  }), {});
  const requestCustomerFilterOptions = Object.entries(requestCustomerCounts).map(([customer, count]) => ({
    value: customer,
    label: customer,
    description: `${count} 个项目`,
  }));
  const requestPmCounts = relatedRequests.reduce<Record<string, number>>((result, request) => ({
    ...result,
    [request.pm || '__UNASSIGNED__']: (result[request.pm || '__UNASSIGNED__'] ?? 0) + 1,
  }), {});
  const requestPmFilterOptions = [
    ...(requestPmCounts.__UNASSIGNED__ ? [{
      value: '__UNASSIGNED__',
      label: '未指定',
      description: `${requestPmCounts.__UNASSIGNED__} 个项目`,
    }] : []),
    ...PM_USERS
    .filter((user) => requestPmCounts[user.name])
    .map((user) => ({
      value: user.name,
      label: user.name,
      description: `${requestPmCounts[user.name]} 个项目 · ${user.email}`,
    })),
  ];
  const requestStatusFilterOptions = REQUEST_PROJECT_STATUS_OPTIONS.map((status) => ({
    value: status,
    label: status,
    description: `${relatedRequests.filter((request) => requestStatusById.get(request.id) === status).length} 个项目`,
    leading: (
      <span
        className={`project-status-select-dot ${
          status === '已付款'
            ? 'project-status-select-dot-complete'
            : status === '部分失败' || status === '全部失败'
              ? 'project-status-select-dot-failure'
              : 'project-status-select-dot-active'
        }`}
      />
    ),
    tone: status === '已付款'
      ? 'complete' as const
      : status === '部分失败' || status === '全部失败'
        ? 'failure' as const
        : 'active' as const,
  }));
  const requestStatusSelectOptions = [
    {
      value: 'all',
      label: '全部状态',
      description: `共 ${relatedRequests.length} 个项目`,
      leading: <span className="project-status-select-dot project-status-select-dot-all" />,
      tone: 'all' as const,
    },
    {
      value: 'approved',
      label: '全部付款阶段',
      description: `${relatedRequests.filter((request) => {
        const status = requestStatusById.get(request.id);
        return Boolean(status && requestProjectStatusesForFilter('approved').includes(status));
      }).length} 个项目`,
      leading: <span className="project-status-select-dot project-status-select-dot-active" />,
      statuses: requestProjectStatusesForFilter('approved'),
      tone: 'active' as const,
    },
    {
      value: 'failed',
      label: '付款失败',
      description: `${relatedRequests.filter((request) => {
        const status = requestStatusById.get(request.id);
        return Boolean(status && requestProjectStatusesForFilter('failed').includes(status));
      }).length} 个项目`,
      leading: <span className="project-status-select-dot project-status-select-dot-failure" />,
      statuses: requestProjectStatusesForFilter('failed'),
      tone: 'failure' as const,
    },
    ...requestStatusFilterOptions,
  ];
  const requestCurrencies = Array.from(new Set(
    relatedRequests.map((request) => parseProjectBudget(request.amount).currency).filter(Boolean),
  ));
  const requestCurrencyFilterOptions = [
    { value: 'all', label: '全部币种' },
    ...requestCurrencies.map((currency) => ({ value: currency, label: currency })),
  ];
  const requestQuery = search.trim().toLowerCase();
  const requestMinBudget = filters.minBudget ? Number(filters.minBudget) : null;
  const requestMaxBudget = filters.maxBudget ? Number(filters.maxBudget) : null;
  const invalidRequestBudgetRange = requestMinBudget !== null
    && requestMaxBudget !== null
    && requestMinBudget > requestMaxBudget;
  const filteredRequests = relatedRequests.filter((request) => {
    const budget = parseProjectBudget(request.amount);
    const matchesSearch = !requestQuery || `${request.requestCode ?? request.id}${request.cooperationProjectName ?? request.project}${request.cooperationProjectCode ?? ''}`.toLowerCase().includes(requestQuery);
    const matchesCustomer = filters.customers.length === 0 || filters.customers.includes(request.brand);
    const matchesPM = filters.pms.length === 0 || filters.pms.includes(request.pm || '__UNASSIGNED__');
    const matchesCurrency = filters.currency === 'all' || filters.currency === budget.currency;
    const matchesMinBudget = invalidRequestBudgetRange || requestMinBudget === null || budget.amount >= requestMinBudget;
    const matchesMaxBudget = invalidRequestBudgetRange || requestMaxBudget === null || budget.amount <= requestMaxBudget;
    const requestStatus = requestStatusById.get(request.id);
    const matchesStatus = filters.statuses.length === 0 || Boolean(requestStatus && filters.statuses.includes(requestStatus));
    return matchesSearch && matchesCustomer && matchesPM && matchesCurrency && matchesMinBudget && matchesMaxBudget && matchesStatus;
  });
  const {
    page: requestPage,
    pageItems: visibleRequests,
    pageSize: requestPageSize,
    setPage: setRequestPage,
    setPageSize: setRequestPageSize,
  } = usePagination(filteredRequests, { resetKey: `${search}\u0000${JSON.stringify(filters)}` });

  const clearRequestFilters = () => {
    setSearch('');
    setFilters(createEmptyProjectListFilters());
  };

  useEffect(() => {
    setSearch('');
    setFilters({
      ...createEmptyProjectListFilters(),
      statuses: requestProjectStatusesForFilter(initialStatusFilter),
    });
  }, [initialStatusFilter]);

  const openRequest = (requestId: string) => {
    setSelectedRequestId(requestId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (selectedRequest) {
    return (
      <RequestProjectDetailPage
        request={selectedRequest}
        payouts={payouts}
        paymentLists={paymentLists}
        creators={creators}
        generatedInvoices={generatedInvoices}
        contracts={contracts}
        currentUser={currentUser}
        onExportPaymentList={onExportPaymentList}
        onApprovalAction={onApprovalAction}
        onOpenFinanceReview={onOpenFinanceReview}
        notify={notify}
        onBack={() => {
          setSelectedRequestId(null);
          onFocusCleared();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        title="请款审批"
        subtitle="业务侧已提交的请款项目列表，仅展示与当前系统账号有关的项目。"
      />
      <div className="metrics-grid">
        <MetricCard
          label="审批中"
          value={requestOverview.approvalInProgress.toString()}
          meta={`${requestOverview.approvalInProgress} 个流程处理中`}
          tone="peach"
        />
        <MetricCard
          label="正在付款"
          value={requestOverview.awaitingPayment.toString()}
          meta="已完成全部审批"
        />
        <MetricCard
          label="请款项目总数"
          value={relatedRequests.length.toString()}
          meta={`${requestOverview.completed} 个已完成 · ${requestOverview.needsAttention} 个需处理`}
          tone="lilac"
        />
      </div>
      {showApprovalReminder && approvalReminder.count > 0 ? (
        <NoticeBanner onClose={onDismissApprovalReminder}>
          <div className="request-approval-reminder-copy">
            <strong>你当前有 <b>{approvalReminder.count}</b> 个请款项目待审批</strong>
            <p>请及时核对请款资料并完成当前节点处理。</p>
          </div>
        </NoticeBanner>
      ) : null}
      <section className="content-card">
        <ProjectInlineFilterPanel
          search={search}
          filters={filters}
          customerOptions={requestCustomerFilterOptions}
          pmOptions={requestPmFilterOptions}
          currencyOptions={requestCurrencyFilterOptions}
          statusOptions={requestStatusSelectOptions}
          resultCount={filteredRequests.length}
          totalCount={relatedRequests.length}
          invalidBudgetRange={invalidRequestBudgetRange}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onClear={clearRequestFilters}
        />
        <div className="table-scroll">
          <table className="data-table operational-table request-project-table">
            <thead><tr><th>项目编号</th><th>关联项目</th><th>媒介</th><th>负责 PM</th><th>请款金额</th><th>合同</th><th>invoice</th><th>付款单</th><th>项目状态</th><th className="action-cell">操作</th></tr></thead>
            <tbody>
              {visibleRequests.map((request) => (
                <tr className="clickable-table-row" key={request.id} onClick={() => openRequest(request.id)}>
                  <td><button className="request-project-link" type="button" onClick={(event) => { event.stopPropagation(); openRequest(request.id); }}><strong>{request.requestCode ?? request.id}</strong></button></td>
                  <td><strong>{request.cooperationProjectName ?? request.project}</strong><small className="cell-subtext">{request.cooperationProjectCode ?? request.projectId ?? '待同步'}</small></td>
                  <td>{request.media}</td>
                  <td>{request.pm || '未指定'}</td>
                  <td>{request.amount}</td>
                  <td>{request.contracts} 份</td>
                  <td>{request.invoices} 份</td>
                  <td className="mono-cell">{request.paymentOrder}</td>
                  <td><ProjectStatus status={requestStatusById.get(request.id) ?? 'PM审批中'} /></td>
                  <td className="action-cell"><ListActionButton kind="view" onClick={(event) => { event.stopPropagation(); openRequest(request.id); }}>查看</ListActionButton></td>
                </tr>
              ))}
              {filteredRequests.length === 0 ? <tr><td className="request-project-empty" colSpan={10}>暂无符合条件的请款项目</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>共 {filteredRequests.length} 个项目</span>
          <Pagination
            ariaLabel="请款项目列表分页"
            page={requestPage}
            pageSize={requestPageSize}
            total={filteredRequests.length}
            onPageChange={setRequestPage}
            onPageSizeChange={setRequestPageSize}
          />
        </div>
      </section>
    </div>
  );
}

type ContactFieldDefinition = {
  key: keyof CreatorInvoiceContact;
  label: string;
  alias: string;
  placeholder: string;
  fullWidth?: boolean;
  inputType?: 'text' | 'email' | 'tel';
  optional?: boolean;
};

const INVOICE_CONTACT_FIELDS: ContactFieldDefinition[] = [
  { key: 'legalName', label: '真实姓名 / 公司名称', alias: 'Real Name / Company Name', placeholder: '请输入证件姓名或公司法定名称' },
  { key: 'phone', label: '联系电话', alias: 'Tel', placeholder: '选填：请输入含国家区号的联系电话', inputType: 'tel', optional: true },
  { key: 'email', label: '联系邮箱', alias: 'Email', placeholder: '请输入达人联系邮箱', inputType: 'email' },
  { key: 'address', label: '联系地址', alias: 'Address', placeholder: '例如：New York, NY, United States（请将国家名放在末尾）', fullWidth: true },
];

const createInvoiceContact = (
  legalName: string,
  email: string,
  phone: string,
  address: string,
): CreatorInvoiceContact => ({ legalName, email, phone, address });

const normalizeSocialHandle = (handle: string) => {
  const normalized = handle.trim();
  if (!normalized) return '';
  return normalized.startsWith('@') ? normalized : `@${normalized}`;
};

const defaultSocialProfileUrl = (platform: string, handle: string) => {
  const username = normalizeSocialHandle(handle).replace(/^@/, '');
  if (!username) return '';
  const normalizedPlatform = platform.trim().toLowerCase();
  if (normalizedPlatform === 'instagram') return `https://www.instagram.com/${username}`;
  if (normalizedPlatform === 'tiktok') return `https://www.tiktok.com/@${username}`;
  if (normalizedPlatform === 'youtube') return `https://www.youtube.com/@${username}`;
  if (normalizedPlatform === 'x' || normalizedPlatform === 'twitter') return `https://x.com/${username}`;
  if (normalizedPlatform === 'facebook') return `https://www.facebook.com/${username}`;
  if (normalizedPlatform === 'twitch') return `https://www.twitch.tv/${username}`;
  return '';
};

const createSocialAccount = (
  id: string,
  platform = '',
  handle = '',
  profileUrl = '',
  verificationScreenshots?: CreatorSocialVerificationScreenshot[],
): CreatorSocialAccount => ({
  id,
  platform,
  handle,
  profileUrl: profileUrl || defaultSocialProfileUrl(platform, handle),
  ...(verificationScreenshots?.length ? { verificationScreenshots } : {}),
});

const CREATOR_DRAFT_STORAGE_VERSION = 1;
const DEFAULT_CREATOR_ACCOUNT_NICKNAME = '新的 Airwallex 账户';
const DEFAULT_CREATOR_SCHEMA_VALUES: Record<string, string> = {
  'beneficiary.entity_type': 'PERSONAL',
  'beneficiary.address.country_code': 'US',
  'beneficiary.bank_details.bank_country_code': 'US',
  'beneficiary.bank_details.account_currency': 'USD',
  'beneficiary.bank_details.bank_account_category': 'Checking',
  'beneficiary.bank_details.account_routing_type1': 'aba',
  'beneficiary.bank_details.local_clearing_system': 'ACH',
  transfer_method: 'LOCAL',
};

type StoredCreatorDraft = {
  version: typeof CREATOR_DRAFT_STORAGE_VERSION;
  profile: CreatorProfile;
  savedAt: string;
};

const creatorDraftStorageKey = (account: string) => (
  `comets-pay.creator-draft.v1:${account}`
);

const hasText = (values: Array<string | undefined>) => (
  values.some((value) => Boolean(value?.trim()))
);

export const hasCreatorDraftContent = (profile: CreatorProfile | null) => {
  if (!profile) return false;
  if (hasText([profile.name, profile.region])) return true;
  if (
    profile.socialAccounts.length !== 1
    || profile.socialAccounts.some((account) => hasText([
      account.platform,
      account.handle,
      account.profileUrl,
    ]))
  ) return true;
  if (hasText(Object.values(profile.contact))) return true;
  if (profile.payoutAccountHistory?.length) return true;
  if (profile.payoutAccounts.length !== 1) return true;

  const account = profile.payoutAccounts[0];
  if (!account || account.provider !== 'Airwallex') return true;
  if (
    account.nickname !== DEFAULT_CREATOR_ACCOUNT_NICKNAME
    || !account.isDefault
    || account.status !== 'DRAFT'
    || account.entityType !== 'PERSONAL'
    || account.transferMethod !== 'LOCAL'
    || hasText([
      account.beneficiaryId,
      account.firstName,
      account.lastName,
      account.companyName,
      account.notificationEmail,
      account.verificationCode,
      account.nameMatchResult,
      account.validatedAt,
      account.verifiedAt,
      account.address.streetAddress,
      account.address.city,
      account.address.state,
      account.address.postcode,
      account.bankDetails.accountName,
      account.bankDetails.accountNumber,
      account.bankDetails.iban,
      account.bankDetails.accountRoutingValue1,
      account.bankDetails.accountRoutingType2,
      account.bankDetails.accountRoutingValue2,
      account.bankDetails.bankName,
      account.bankDetails.bankBranch,
      account.bankDetails.bankStreetAddress,
      account.bankDetails.bankState,
      account.bankDetails.swiftCode,
      account.bankDetails.intermediaryBankName,
      account.bankDetails.intermediaryBankSwiftCode,
    ])
    || account.address.countryCode !== 'US'
    || account.bankDetails.bankCountryCode !== 'US'
    || account.bankDetails.bankCountryName !== 'United States'
    || account.bankDetails.accountCurrency !== 'USD'
    || account.bankDetails.bankAccountCategory !== 'Checking'
    || account.bankDetails.accountRoutingType1 !== 'aba'
    || account.bankDetails.localClearingSystem !== 'ACH'
  ) return true;

  return Object.entries(account.schemaValues ?? {}).some(([path, value]) => (
    Boolean(value.trim()) && DEFAULT_CREATOR_SCHEMA_VALUES[path] !== value
  ));
};

export const getCreatorPayoutAccountValidationError = (
  accounts: CreatorProfile['payoutAccounts'],
) => {
  const activeAccounts = accounts.filter((account) => account.status !== 'DISABLED');
  const explicitDefaultAccounts = activeAccounts.filter((account) => account.isDefault);
  const defaultAccount = getDefaultPayoutAccount(activeAccounts);
  if (explicitDefaultAccounts.length !== 1) return '仅一个默认收款账户';
  if (!defaultAccount || defaultAccount.provider !== 'Airwallex') return '一个默认 Airwallex 收款账户';
  if (!isPayoutAccountVerified(defaultAccount)) return '默认 Airwallex 收款账户校验完成';
  return '';
};

const isStoredCreatorDraft = (value: unknown): value is StoredCreatorDraft => {
  if (!value || typeof value !== 'object') return false;
  const stored = value as Partial<StoredCreatorDraft>;
  const profile = stored.profile as Partial<CreatorProfile> | undefined;
  const contact = profile?.contact as Partial<CreatorInvoiceContact> | undefined;
  const validContact = Boolean(contact)
    && [contact?.legalName, contact?.address, contact?.phone, contact?.email]
      .every((field) => typeof field === 'string');
  const validSocialAccounts = Array.isArray(profile?.socialAccounts)
    && profile.socialAccounts.every((account) => (
      account
      && typeof account.id === 'string'
      && typeof account.platform === 'string'
      && typeof account.handle === 'string'
      && typeof account.profileUrl === 'string'
    ));
  const validPayoutAccounts = Array.isArray(profile?.payoutAccounts)
    && profile.payoutAccounts.length > 0
    && profile.payoutAccounts.every((account) => {
      if (!account || typeof account.id !== 'string') return false;
      if (account.provider === 'Airwallex') {
        return Boolean(account.address && account.bankDetails && account.schemaValues);
      }
      return account.provider === 'PayPal' || account.provider === 'PayMax';
    });
  return stored.version === CREATOR_DRAFT_STORAGE_VERSION
    && typeof stored.savedAt === 'string'
    && Boolean(profile)
    && typeof profile?.id === 'string'
    && typeof profile?.name === 'string'
    && typeof profile?.region === 'string'
    && validContact
    && validSocialAccounts
    && validPayoutAccounts;
};

const createSocialAccountsFromSummary = (
  creatorId: string,
  platformSummary: string,
  handle: string,
) => platformSummary
  .split('·')
  .map((platform) => platform.trim())
  .filter(Boolean)
  .map((platform, index) => createSocialAccount(
    `social-${creatorId}-${index + 1}`,
    platform,
    normalizeSocialHandle(handle),
  ));

type CreatorBankSeed = {
  countryCode: string;
  countryName: string;
  currency: string;
  accountNumber?: string;
  iban?: string;
  accountCategory?: string;
  bankName: string;
  swiftCode?: string;
  transferMethod?: AirwallexTransferMethod;
  clearingSystem?: string;
  routingType1?: string;
  routingValue1?: string;
  routingType2?: string;
  routingValue2?: string;
  streetAddress: string;
  city: string;
  state?: string;
  postcode?: string;
  status?: PayoutAccountStatus;
};

type CreatorPayPalSeed = {
  username: string;
  email: string;
  nickname?: string;
  status?: PayoutAccountStatus;
};

type CreatorSeed = Omit<CreatorProfile, 'payoutAccounts' | 'socialAccounts'> & {
  socialAccounts?: CreatorSocialAccount[];
  bank?: CreatorBankSeed;
  paypal?: CreatorPayPalSeed;
  defaultPayoutProvider?: 'Airwallex' | 'PayPal';
};

const createSeedCreator = ({
  bank,
  paypal,
  defaultPayoutProvider,
  socialAccounts,
  ...creator
}: CreatorSeed): CreatorProfile => {
  const displayName = demoDisplayName(creator.name);
  const realName = demoRealName(creator.contact.legalName);
  const accountName = demoAccountName(creator.contact.legalName);
  const [firstName = '', ...lastNameParts] = realName.split(/\s+/);
  const stableAccountSuffix = Array.from(creator.id).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) % 100_000_000,
    0,
  ).toString().padStart(8, '0');
  const resolvedBank = bank ?? (paypal ? {
    countryCode: 'US',
    countryName: 'United States',
    currency: 'USD',
    accountNumber: `90${stableAccountSuffix}`,
    bankName: 'Prototype Commerce Bank',
    clearingSystem: 'ACH',
    routingType1: 'aba',
    routingValue1: '000000000',
    streetAddress: '100 Prototype Avenue',
    city: 'New York',
    state: 'New York',
    postcode: '10001',
    status: 'VERIFIED' as const,
  } : undefined);
  const paypalIsDefault = Boolean(paypal && defaultPayoutProvider === 'PayPal');
  const payoutAccounts: CreatorProfile['payoutAccounts'] = [];

  if (resolvedBank) {
    const bank = resolvedBank;
    const status = bank.status ?? 'VERIFIED';
    const isValidated = !['DRAFT', 'READY_FOR_VALIDATION'].includes(status);
    payoutAccounts.push(createAirwallexPayoutAccount({
      id: `awx-${creator.id}`,
      creatorId: creator.id,
      nickname: `${bank.countryName} ${bank.currency} 主账户`,
      isDefault: !paypalIsDefault,
      status,
      beneficiaryId: isValidated ? `bene_demo_${creator.id.replace('creator-', '')}` : '',
      entityType: 'PERSONAL',
      firstName,
      lastName: lastNameParts.join(' '),
      notificationEmail: creator.contact.email,
      address: {
        countryCode: bank.countryCode,
        streetAddress: bank.streetAddress,
        city: bank.city,
        state: bank.state ?? '',
        postcode: bank.postcode ?? '',
      },
      transferMethod: bank.transferMethod ?? 'LOCAL',
      bankDetails: {
        bankCountryCode: bank.countryCode,
        bankCountryName: bank.countryName,
        accountCurrency: bank.currency,
        accountName,
        accountNumber: bank.accountNumber ?? '',
        iban: bank.iban ?? '',
        bankAccountCategory: bank.accountCategory ?? 'Checking',
        accountRoutingType1: bank.routingType1 ?? '',
        accountRoutingValue1: bank.routingValue1 ?? '',
        accountRoutingType2: bank.routingType2 ?? '',
        accountRoutingValue2: bank.routingValue2 ?? '',
        localClearingSystem: bank.clearingSystem ?? '',
        bankName: bank.bankName,
        bankStreetAddress: bank.streetAddress,
        bankState: bank.state ?? '',
        swiftCode: bank.swiftCode ?? '',
      },
      verificationCode: status === 'VERIFIED' || status === 'REVIEW_REQUIRED'
        ? 'VERIFIED'
        : status === 'CANNOT_VERIFY'
          ? 'CANNOT_VERIFY'
          : status === 'INVALID'
            ? 'INVALID'
            : '',
      nameMatchResult: status === 'VERIFIED'
        ? 'FULL_MATCH'
        : status === 'REVIEW_REQUIRED'
          ? 'PARTIAL_MATCH'
          : '',
      updatedAt: isValidated ? '2026-07-18T10:31:00.000Z' : '2026-07-18T10:30:00.000Z',
      validatedAt: isValidated ? '2026-07-18 10:30' : '',
      verifiedAt: status === 'VERIFIED' || status === 'REVIEW_REQUIRED' || status === 'CANNOT_VERIFY'
        ? '2026-07-18 10:31'
        : '',
    }));
  }

  if (paypal) {
    payoutAccounts.push(createPayPalPayoutAccount({
      id: `paypal-${creator.id}`,
      creatorId: creator.id,
      nickname: paypal.nickname ?? (resolvedBank ? 'PayPal 备用账户' : 'PayPal 主账户'),
      isDefault: paypalIsDefault,
      status: paypal.status ?? 'READY_FOR_VALIDATION',
      updatedAt: '2026-07-18T10:31:00.000Z',
      paypalUsername: demoAccountName(paypal.username),
      paypalEmail: paypal.email,
    }));
  }

  if (payoutAccounts.length === 0) {
    throw new Error(`${creator.name} 至少需要一个收款账户`);
  }

  return {
    ...creator,
    name: displayName,
    contact: {
      ...creator.contact,
      legalName: realName,
    },
    socialAccounts: socialAccounts?.map((account) => ({ ...account }))
      ?? createSocialAccountsFromSummary(creator.id, creator.platform, creator.handle),
    payoutAccounts,
  };
};

const PROTOTYPE_PAYPAL_CREATOR_SEEDS = [
  { id: 'creator-noah', initials: 'NW', accent: '#0ea5e9', name: 'Noah Williams', handle: '@noahplays', region: '英国', platform: 'YouTube · Twitch' },
  { id: 'creator-ava', initials: 'AT', accent: '#e11d48', name: 'Ava Thompson', handle: '@avathompson', region: '加拿大', platform: 'Instagram · TikTok' },
  { id: 'creator-diego', initials: 'DS', accent: '#16a34a', name: 'Diego Santos', handle: '@diegogames', region: '葡萄牙', platform: 'YouTube' },
  { id: 'creator-claire', initials: 'CM', accent: '#9333ea', name: 'Claire Moreau', handle: '@clairecreates', region: '法国', platform: 'Instagram' },
  { id: 'creator-jisoo', initials: 'JP', accent: '#db2777', name: 'Jisoo Park', handle: '@jisoo.pixel', region: '韩国', platform: 'TikTok · YouTube' },
  { id: 'creator-ethan', initials: 'EB', accent: '#2563eb', name: 'Ethan Brooks', handle: '@ethanreviews', region: '美国', platform: 'YouTube' },
  { id: 'creator-mai', initials: 'MN', accent: '#f97316', name: 'Mai Nguyen', handle: '@mai.levelup', region: '越南', platform: 'TikTok' },
  { id: 'creator-amelia', initials: 'AK', accent: '#0891b2', name: 'Amelia Kowalski', handle: '@ameliaarcade', region: '波兰', platform: 'YouTube · Instagram' },
  { id: 'creator-rafael', initials: 'RO', accent: '#65a30d', name: 'Rafael Oliveira', handle: '@rafaelquest', region: '巴西', platform: 'Twitch · TikTok' },
  { id: 'creator-sara', initials: 'SN', accent: '#7c3aed', name: 'Sara Nielsen', handle: '@saranorth', region: '丹麦', platform: 'Instagram' },
  { id: 'creator-aaron', initials: 'AL', accent: '#ea580c', name: 'Aaron Lim', handle: '@aaronlevel', region: '新加坡', platform: 'YouTube · TikTok' },
] as const;

export const INITIAL_CREATORS: CreatorProfile[] = [
  createSeedCreator({
    id: 'creator-mina', initials: 'MK', accent: '#f59e0b', name: 'Mina Kato', handle: '@MinaKato', region: '日本', platform: 'Instagram · TikTok', projects: 4,
    socialAccounts: [
      createSocialAccount(
        'social-creator-mina-instagram',
        'Instagram',
        '@MinaKato',
        '',
        [{
          id: 'screenshot-creator-mina-instagram-1',
          fileName: 'mina-instagram-professional-dashboard-demo.svg',
          imageUrl: '/creator-verification-demo-mina-instagram.svg',
          uploadedAt: '2026-09-12T03:18:00.000Z',
        }],
      ),
      createSocialAccount(
        'social-creator-mina-tiktok',
        'TikTok',
        '@MinaKato',
        '',
        [{
          id: 'screenshot-creator-mina-tiktok-1',
          fileName: 'mina-tiktok-analytics-dashboard-demo.svg',
          imageUrl: '/creator-verification-demo-mina-tiktok.svg',
          uploadedAt: '2026-09-12T03:21:00.000Z',
        }],
      ),
    ],
    contact: createInvoiceContact('Mina Kato', 'mina.kato@creator.example', '+81 90 0000 1024', 'Shibuya-ku, Tokyo, Japan'),
    bank: { countryCode: 'JP', countryName: 'Japan', currency: 'JPY', accountNumber: '0000000001', accountCategory: 'Savings', bankName: 'MUFG Bank', clearingSystem: 'ZENGIN', routingType1: 'bank_code', routingValue1: '0005', routingType2: 'branch_code', routingValue2: '001', streetAddress: '2-7-1 Marunouchi', city: 'Chiyoda-ku', state: 'Tokyo', postcode: '100-8388' },
    paypal: { username: 'minakato.creator', email: 'mina.kato@example.com' },
  }),
  createSeedCreator({
    id: 'creator-alex', initials: 'AR', accent: '#3b82f6', name: 'Alex Ruiz', handle: '@alexbuilds', region: '西班牙', platform: 'YouTube', projects: 2,
    contact: createInvoiceContact('Alejandro Ruiz', 'alex.ruiz@creator.example', '+34 600 000 218', 'Calle de Serrano, Madrid, Spain'),
    bank: { countryCode: 'ES', countryName: 'Spain', currency: 'EUR', iban: 'ES00 DEMO 0000 0000 0000 0000', bankName: 'Banco Bilbao Vizcaya Argentaria', clearingSystem: 'SEPA', streetAddress: 'Calle Azul 4', city: 'Madrid', state: 'Madrid', postcode: '28001' },
    paypal: { username: 'alexbuilds', email: 'alex.ruiz@example.com', nickname: 'PayPal EUR 主账户', status: 'VERIFIED' },
    defaultPayoutProvider: 'PayPal',
  }),
  createSeedCreator({
    id: 'creator-nika', initials: 'NK', accent: '#ef4444', name: 'Nika Petrova', handle: '@nika.spark', region: '泰国', platform: 'TikTok', projects: 3,
    contact: createInvoiceContact('Nika Petrova', 'nika.petrova@creator.example', '+66 80 000 9731', 'Bang Rak, Bangkok, Thailand'),
    bank: { countryCode: 'TH', countryName: 'Thailand', currency: 'THB', accountNumber: '0000000004', bankName: 'Bangkok Bank', clearingSystem: 'PromptPay', routingType1: 'bank_code', routingValue1: '000', streetAddress: '333 Silom Road', city: 'Bangkok', state: 'Bangkok', postcode: '10500', status: 'VERIFIED' },
    paypal: { username: 'nika.spark.prototype', email: 'nika.spark@example.test', nickname: 'PayPal USD 备用账户', status: 'VERIFIED' },
  }),
  createSeedCreator({
    id: 'creator-luna', initials: 'LJ', accent: '#a855f7', name: 'Luna Jones', handle: '@Luna_J', region: '美国', platform: 'Instagram · TikTok', projects: 5,
    socialAccounts: [
      createSocialAccount('social-creator-luna-instagram', 'Instagram', '@Luna_J'),
      createSocialAccount('social-creator-luna-tiktok', 'TikTok', '@luna.j.tiktok'),
    ],
    contact: createInvoiceContact('Luna Jones', 'luna.jones@creator.example', '+1 212 555 0146', 'New York, NY, United States'),
    bank: { countryCode: 'US', countryName: 'United States', currency: 'USD', accountNumber: '0000000006', bankName: 'JPMorgan Chase Bank', clearingSystem: 'ACH', routingType1: 'aba', routingValue1: '000000000', streetAddress: '270 Park Avenue', city: 'New York', state: 'New York', postcode: '10017' },
    paypal: { username: 'luna.jones', email: 'luna.jones@example.com' },
  }),
  createSeedCreator({
    id: 'creator-yuki', initials: 'YT', accent: '#ec4899', name: 'Yuki Tanaka', handle: '@yuki.tokyo', region: '日本', platform: 'Instagram', projects: 3,
    contact: createInvoiceContact('Yuki Tanaka', 'yuki.tanaka@creator.example', '+81 80 0000 3128', 'Minato-ku, Tokyo, Japan'),
    paypal: { username: 'yuki.tokyo', email: 'yuki.tanaka@example.com', nickname: 'PayPal USD 主账户', status: 'VERIFIED' },
  }),
  createSeedCreator({
    id: 'creator-camila', initials: 'CC', accent: '#f97316', name: 'Camila Costa', handle: '@camila.beauty', region: '巴西', platform: 'Instagram · TikTok', projects: 6,
    contact: createInvoiceContact('Camila Costa', 'camila.costa@creator.example', '+55 11 90000 4206', 'Jardins, Sao Paulo, Brazil'),
    bank: { countryCode: 'BR', countryName: 'Brazil', currency: 'BRL', accountNumber: '0000000002', bankName: 'Itau Unibanco', clearingSystem: 'PIX', routingType1: 'bank_code', routingValue1: '341', routingType2: 'branch_code', routingValue2: '0156', streetAddress: 'Avenida Paulista 1294', city: 'Sao Paulo', state: 'Sao Paulo', postcode: '01310-100', status: 'VERIFIED' },
    paypal: { username: 'camila.beauty', email: 'camila.costa@example.com' },
  }),
  createSeedCreator({
    id: 'creator-oliver', initials: 'OC', accent: '#06b6d4', name: 'Oliver Chen', handle: '@oliver.tech', region: '新加坡', platform: 'YouTube', projects: 2,
    socialAccounts: [
      createSocialAccount('social-creator-oliver-youtube', 'YouTube', '@oliver.tech'),
      createSocialAccount('social-creator-oliver-x', 'X', '@olivertech'),
      createSocialAccount('social-creator-oliver-twitch', 'Twitch', '@oliver_live'),
    ],
    contact: createInvoiceContact('Oliver Chen', 'oliver.chen@creator.example', '+65 8000 5319', 'Tanjong Pagar, Singapore'),
    bank: { countryCode: 'SG', countryName: 'Singapore', currency: 'SGD', accountNumber: '0000000003', bankName: 'DBS Bank', clearingSystem: 'FAST', routingType1: 'bank_code', routingValue1: '7171', routingType2: 'branch_code', routingValue2: '006', streetAddress: '12 Marina Boulevard', city: 'Singapore', state: 'Singapore', postcode: '018982', status: 'VERIFIED' },
  }),
  createSeedCreator({
    id: 'creator-hannah', initials: 'HL', accent: '#8b5cf6', name: 'Hannah Lee', handle: '@hannah.home', region: '韩国', platform: 'Instagram', projects: 4,
    contact: createInvoiceContact('Hannah Lee', 'hannah.lee@creator.example', '+82 10 0000 6412', 'Mapo-gu, Seoul, South Korea'),
    paypal: { username: 'hannah.home', email: 'hannah.lee@example.com', nickname: 'PayPal USD 主账户', status: 'VERIFIED' },
  }),
  createSeedCreator({
    id: 'creator-luca', initials: 'LB', accent: '#6366f1', name: 'Luca Bianchi', handle: '@luca.style', region: '意大利', platform: 'Instagram · TikTok', projects: 5,
    contact: createInvoiceContact('Luca Bianchi', 'luca.bianchi@creator.example', '+39 320 000 7514', 'Torino, Piemonte, Italy'),
    bank: { countryCode: 'IT', countryName: 'Italy', currency: 'EUR', iban: 'IT00 DEMO 0000 0000 0000 0000', bankName: 'Intesa Sanpaolo', clearingSystem: 'SEPA', streetAddress: 'Piazza San Carlo 156', city: 'Torino', state: 'Torino', postcode: '10121', status: 'VALIDATED' },
  }),
  createSeedCreator({
    id: 'creator-emily', initials: 'EW', accent: '#14b8a6', name: 'Emily Wong', handle: '@emily.travel', region: '中国香港', platform: 'YouTube · Instagram', projects: 3,
    contact: createInvoiceContact('Emily Wong', 'emily.wong@creator.example', '+852 6000 8621', 'Wan Chai, Hong Kong, China'),
    bank: { countryCode: 'HK', countryName: 'Hong Kong SAR China', currency: 'HKD', accountNumber: '000000005', bankName: 'HSBC Hong Kong', clearingSystem: 'FPS', routingType1: 'bank_code', routingValue1: '004', routingType2: 'branch_code', routingValue2: '621', streetAddress: '1 Queen\'s Road Central', city: 'Hong Kong', state: 'Hong Kong', postcode: '000000', status: 'VERIFIED' },
  }),
  createSeedCreator({
    id: 'creator-kenji', initials: 'KM', accent: '#22c55e', name: 'Kenji Mori', handle: '@kenji.moves', region: '日本', platform: 'YouTube', projects: 7,
    contact: createInvoiceContact('Kenji Mori', 'kenji.mori@creator.example', '+81 70 0000 9735', 'Setagaya-ku, Tokyo, Japan'),
    bank: { countryCode: 'JP', countryName: 'Japan', currency: 'JPY', accountNumber: '0000000007', accountCategory: 'Savings', bankName: 'Mizuho Bank', clearingSystem: 'ZENGIN', routingType1: 'bank_code', routingValue1: '0001', routingType2: 'branch_code', routingValue2: '122', streetAddress: '1-5-5 Otemachi', city: 'Chiyoda-ku', state: 'Tokyo', postcode: '100-8176' },
  }),
  createSeedCreator({
    id: 'creator-sofia', initials: 'SM', accent: '#d946ef', name: 'Sofia Martinez', handle: '@sofia.daily', region: '墨西哥', platform: 'TikTok', projects: 2,
    contact: createInvoiceContact('Sofia Martinez', 'sofia.martinez@creator.example', '+52 55 0000 1842', 'Cuauhtemoc, Mexico City, Mexico'),
    bank: { countryCode: 'MX', countryName: 'Mexico', currency: 'MXN', accountNumber: '000000000008', bankName: 'BBVA Mexico', clearingSystem: 'SPEI', routingType1: 'clabe', routingValue1: '000000000000000000', streetAddress: 'Paseo de la Reforma 510', city: 'Mexico City', state: 'Mexico City', postcode: '06600' },
  }),
  createSeedCreator({
    id: 'creator-marc', initials: 'MO', accent: '#64748b', name: 'Marc Olivier', handle: '@marcframes', region: '法国', platform: 'Instagram', projects: 1,
    contact: createInvoiceContact('Marc Olivier', 'marc.olivier@creator.example', '+33 6 00 00 2957', 'Paris, Ile-de-France, France'),
    paypal: { username: 'marcframes', email: 'marc.olivier@creator.example', nickname: 'PayPal 主账户', status: 'VERIFIED' },
  }),
  ...PROTOTYPE_PAYPAL_CREATOR_SEEDS.map((creator) => createSeedCreator({
    ...creator,
    projects: 0,
    contact: createInvoiceContact(
      creator.name,
      `${creator.id.replace('creator-', '')}@creator.example`,
      '+0 000 000 0000',
      `Prototype profile, ${creator.region}`,
    ),
    paypal: {
      username: creator.handle.replace(/^@/, ''),
      email: `${creator.id.replace('creator-', '')}@creator.example`,
      nickname: 'PayPal 演示账户',
      status: 'VERIFIED',
    },
  })),
];

const PROJECT_FIXTURE_TIMESTAMP = '2026-08-01T09:00:00.000Z';

const createProjectCreatorProfiles = (
  project: (typeof PROJECT_FIXTURES)[number],
  projectIndex: number,
): NonNullable<ProjectSummary['creatorProfiles']> => (
  Array.from({ length: project.creators }, (_, creatorIndex) => {
    const returnedRequestCreator = project.id === 'PRJ-260801-07'
      ? INITIAL_CREATORS.find((creator) => (
          creator.id === (creatorIndex === 0 ? 'creator-marc' : creatorIndex === 1 ? 'creator-noah' : '')
        ))
      : undefined;
    const creator = returnedRequestCreator
      ?? INITIAL_CREATORS[(projectIndex * 5 + creatorIndex) % INITIAL_CREATORS.length];
    return {
      creatorId: creator.id as CreatorId,
      projectId: project.id as ProjectId,
      engagementId: `col_fixture_${String(projectIndex + 1).padStart(2, '0')}_${String(creatorIndex + 1).padStart(2, '0')}` as EngagementId,
      status: 'active',
      createdAt: PROJECT_FIXTURE_TIMESTAMP,
      updatedAt: PROJECT_FIXTURE_TIMESTAMP,
      name: creator.name,
      handle: creator.handle,
      platform: creator.platform,
    };
  })
);

export const INITIAL_PROJECTS: ProjectSummary[] = PROJECT_FIXTURES.map((project, projectIndex) => ({
  id: project.id,
  projectId: project.id as ProjectId,
  projectCode: project.id,
  cooperationProjectId: project.id as CooperationProjectId,
  cooperationProjectCode: project.id,
  externalProjectId: `feishu-project-${String(projectIndex + 1).padStart(3, '0')}`,
  externalSystem: 'FEISHU',
  syncStatus: 'SYNCED',
  syncedAt: '2026-08-07T02:00:00.000Z',
  projectType: projectIndex % 3 === 0 ? '品牌营销' : projectIndex % 3 === 1 ? '达人种草' : '游戏发行',
  initiatorName: project.media,
  startDate: `2026-${String((projectIndex % 6) + 1).padStart(2, '0')}-01`,
  endDate: `2026-${String((projectIndex % 6) + 4).padStart(2, '0')}-28`,
  source: 'FEISHU',
  availability: 'ACTIVE',
  sourceUpdatedAt: '2026-08-07T01:00:00.000Z',
  localUpdatedAt: '2026-08-07T02:00:00.000Z',
  name: project.name,
  brand: project.brand,
  media: project.media,
  pm: project.pm,
  creators: project.creators,
  creatorProfiles: createProjectCreatorProfiles(project, projectIndex),
  requestReason: `用于结算「${project.name}」的达人合作、内容制作及授权费用。`,
  invoiceCount: project.invoiceCount ?? 0,
  budget: project.budget,
  status: project.projectStatus,
  reviewStatus: project.requestStatus === '待补资料'
    ? 'draft'
    : project.requestStatus === '已退回'
      ? 'returned'
      : project.requestStatus === '已完成'
        ? 'approved'
        : 'submitted',
  paymentOrder: '待生成',
}));

export const MOCK_FEISHU_COOPERATION_PROJECT_SOURCE = createMockFeishuCooperationProjectSource(
  PROJECT_FIXTURES.map((project, projectIndex) => ({
    externalProjectId: `feishu-project-${String(projectIndex + 1).padStart(3, '0')}`,
    projectCode: project.id,
    name: project.name,
    projectType: projectIndex % 3 === 0 ? '品牌营销' : projectIndex % 3 === 1 ? '达人种草' : '游戏发行',
    status: project.projectStatus === '已完成' ? 'ARCHIVED' as const : 'ACTIVE' as const,
    initiatorName: project.media,
    startDate: `2026-${String((projectIndex % 6) + 1).padStart(2, '0')}-01`,
    endDate: `2026-${String((projectIndex % 6) + 4).padStart(2, '0')}-28`,
    ownerName: project.media,
    updatedAt: '2026-08-07T01:00:00.000Z',
  })),
  Object.fromEntries(INITIAL_PROJECTS.map((project) => [
    project.externalProjectId,
    project.cooperationProjectId,
  ]).filter((entry): entry is [string, CooperationProjectId] => Boolean(entry[0] && entry[1]))),
);

function ProjectCreatorPicker({
  creators,
  selectedHandles,
  onChange,
}: {
  creators: CreatorProfile[];
  selectedHandles: string[];
  onChange: (handles: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const creatorEntries = creators.flatMap((creator) => {
    const socialAccount = creatorSocialAccounts(creator)[0];
    return socialAccount ? [{ creator, value: creatorSocialSelectionValue(creator.id, socialAccount.id) }] : [];
  });
  const visibleCreators = creatorEntries.filter(({ creator }) => !normalizedSearch || (
    `${creatorSearchTerms(creator)} ${creator.region}`.toLowerCase().includes(normalizedSearch)
  ));
  const selectedCreators = selectedHandles.flatMap((value) => {
    const selection = parseCreatorSocialSelectionValue(value);
    const creator = creators.find((item) => item.id === selection?.creatorId);
    const socialAccount = resolveCreatorSocialAccount(creator, selection?.socialAccountId);
    return creator && socialAccount ? [{ creator, value }] : [];
  });

  const toggleCreator = (creatorId: string, value: string) => {
    const existing = selectedHandles.find((selectedValue) => (
      parseCreatorSocialSelectionValue(selectedValue)?.creatorId === creatorId
    ));
    onChange(existing === value
      ? selectedHandles.filter((selectedValue) => selectedValue !== value)
      : [...selectedHandles.filter((selectedValue) => selectedValue !== existing), value]);
  };

  return (
    <div className="creator-picker" data-testid="project-creator-picker">
      <button
        className={`invoice-picker-trigger creator-picker-trigger ${open ? 'invoice-picker-trigger-open' : ''}`}
        type="button"
        aria-expanded={open}
        aria-controls="project-creator-options"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="invoice-picker-leading">
          <Users size={18} />
          <span className="invoice-picker-copy">
            <strong>{selectedHandles.length > 0 ? `已选择 ${selectedHandles.length} 位合作达人` : '从达人档案选择合作达人'}</strong>
            <small>达人名单来自系统【达人档案】，支持多选</small>
          </span>
        </span>
        <ChevronDown className="invoice-picker-chevron" size={18} />
      </button>

      {selectedCreators.length > 0 ? (
        <div className="creator-selection-chips" aria-label="已选择的合作达人">
          {selectedCreators.map(({ creator, value }) => (
            <button
              className="creator-selection-chip"
              type="button"
              aria-label={`移除 ${creator.name}`}
              key={value}
              onClick={() => toggleCreator(creator.id, value)}
            >
              <CreatorIdentity creator={creator} socialAccountsMode="expanded" />
              <X size={13} aria-hidden="true" />
            </button>
          ))}
          <button className="invoice-selection-clear" type="button" onClick={() => onChange([])}>清除已选</button>
        </div>
      ) : null}

      {open ? (
        <div id="project-creator-options" className="creator-options" role="listbox" aria-label="达人档案列表" aria-multiselectable="true">
          <div className="creator-picker-search-row">
            <label className="creator-picker-search">
              <Search size={16} aria-hidden="true" />
              <input aria-label="搜索达人档案" placeholder="搜索 Display Name、Handle、Real Name / Company Name 或 Account Name" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <span className="creator-picker-result-count" aria-live="polite">
              <strong>{visibleCreators.length}</strong>
              <span>/ {creatorEntries.length} 位达人</span>
            </span>
          </div>
          <div className="creator-option-list">
            {visibleCreators.map(({ creator, value }) => {
              const selected = selectedHandles.some((selectedValue) => parseCreatorSocialSelectionValue(selectedValue)?.creatorId === creator.id);
              return (
                <button
                  className={`creator-option ${selected ? 'creator-option-selected' : ''}`}
                  data-creator-handle={creatorSocialAccounts(creator)[0]?.handle}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  key={value}
                  onClick={() => toggleCreator(creator.id, value)}
                >
                  <CreatorIdentity creator={creator} className="creator-option-profile" socialAccountsMode="expanded" />
                  <span className="creator-option-meta"><strong>{creator.region}</strong><small>{creatorSocialAccounts(creator).length} 个社媒账号</small></span>
                  {selected ? <CheckCircle2 className="creator-option-mark creator-option-mark-selected" size={18} /> : <Circle className="creator-option-mark" size={18} />}
                </button>
              );
            })}
            {visibleCreators.length === 0 ? <div className="creator-picker-empty">没有找到匹配的达人档案</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type CreatorPaymentSectionTone = 'neutral' | 'identity' | 'payout' | 'collaboration';

function CreatorPaymentSection({
  icon,
  title,
  description,
  children,
  tone = 'neutral',
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  tone?: CreatorPaymentSectionTone;
}) {
  return (
    <section className={`creator-payment-section creator-payment-section-${tone}`}>
      <header className="creator-payment-section-head">
        <span>{icon}</span>
        <div><h3>{title}</h3><p>{description}</p></div>
      </header>
      {children}
    </section>
  );
}

function CreatorContactDetailsGrid({ contact }: { contact: CreatorInvoiceContact }) {
  return (
    <div className="creator-payment-grid">
      {INVOICE_CONTACT_FIELDS.map((field) => (
        <div className={`creator-payment-value ${field.fullWidth ? 'creator-payment-value-wide' : ''}`} key={field.key}>
          <span>{field.label}<small>{field.alias}</small></span>
          <strong className={contact[field.key] ? '' : 'creator-payment-empty'}>{contact[field.key] || '待补充'}</strong>
        </div>
      ))}
    </div>
  );
}

function CreatorContactFormGrid({
  contact,
  onChange,
  showErrors = false,
}: {
  contact: CreatorInvoiceContact;
  onChange: (field: keyof CreatorInvoiceContact, value: string) => void;
  showErrors?: boolean;
}) {
  return (
    <div className="form-grid creator-payment-form-grid">
      {INVOICE_CONTACT_FIELDS.map((field) => {
        const addressCountryMissing = field.key === 'address'
          && Boolean(contact.address.trim())
          && !creatorRegionFromContactAddress(contact.address);
        const invalid = showErrors && !field.optional && (
          !contact[field.key].trim()
          || (field.key === 'email' && !/^\S+@\S+\.\S+$/.test(contact.email))
          || addressCountryMissing
        );
        return (
          <label className={`${field.fullWidth ? 'full-width' : ''} ${invalid ? 'creator-form-field-error' : ''}`} key={field.key}>
            <span className="creator-payment-field-label">
              <span>{field.label}{field.optional ? null : <em className="required-mark" aria-hidden="true">*</em>}</span>
              <small>{field.alias}{field.optional ? ' · 选填' : ''}</small>
            </span>
            {field.fullWidth ? (
              <textarea aria-label={field.optional ? `${field.label}（选填）` : field.label} aria-invalid={invalid || undefined} placeholder={field.placeholder} value={contact[field.key]} onChange={(event) => onChange(field.key, event.target.value)} />
            ) : (
              <input aria-label={field.optional ? `${field.label}（选填）` : field.label} aria-invalid={invalid || undefined} type={field.inputType ?? 'text'} placeholder={field.placeholder} value={contact[field.key]} onChange={(event) => onChange(field.key, event.target.value)} />
            )}
          </label>
        );
      })}
    </div>
  );
}

const socialPlatformTone = (platform: string) => (
  platform.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'default'
);

export function CreatorSocialPlatformIcons({
  accounts,
  size = 18,
  className = '',
}: {
  accounts: readonly CreatorSocialAccount[];
  size?: number;
  className?: string;
}) {
  if (!accounts.length) return <span className="creator-social-platform-icons-empty">社媒账号待补充</span>;
  return (
    <span
      className={`creator-social-platform-icons ${className}`.trim()}
      aria-label={`社媒平台账号 ${accounts.length} 个`}
    >
      {accounts.map((account) => (
        <SocialPlatformIcon
          platform={account.platform}
          handle={account.handle}
          size={size}
          key={account.id || `${account.platform}:${account.handle}`}
        />
      ))}
    </span>
  );
}

function CreatorSocialScreenshotDialog({
  account,
  onClose,
}: {
  account: CreatorSocialAccount;
  onClose: () => void;
}) {
  const screenshots = account.verificationScreenshots ?? [];
  const [selectedScreenshotId, setSelectedScreenshotId] = useState(screenshots[0]?.id ?? '');
  const activeScreenshot = screenshots.find((screenshot) => screenshot.id === selectedScreenshotId)
    ?? screenshots[0];
  const activeIndex = activeScreenshot
    ? screenshots.findIndex((screenshot) => screenshot.id === activeScreenshot.id)
    : -1;

  return (
    <Modal
      title="查看后台截图"
      width="980px"
      className="creator-social-screenshot-modal"
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>关闭</Button>}
    >
      <div className="creator-social-screenshot-context">
        <span className={`creator-social-platform-mark creator-social-platform-${socialPlatformTone(account.platform)}`}>
          <SocialPlatformIcon platform={account.platform} handle={account.handle} size={21} />
        </span>
        <span>
          <strong>{account.platform || '平台待补充'}</strong>
          <small>{account.handle || '账号待补充'} · 达人上传的平台后台认证材料</small>
        </span>
        <em>{screenshots.length} 张</em>
      </div>
      {activeScreenshot ? (
        <div className="creator-social-screenshot-layout">
          <figure className="creator-social-screenshot-stage">
            <img
              src={activeScreenshot.imageUrl}
              alt={`${account.platform} ${account.handle} 后台截图第 ${activeIndex + 1} 张`}
            />
            <figcaption>演示数据</figcaption>
          </figure>
          {screenshots.length > 1 ? (
            <div className="creator-social-screenshot-thumbnails" aria-label="后台截图列表">
              {screenshots.map((screenshot, index) => (
                <button
                  className={screenshot.id === activeScreenshot.id ? 'is-active' : ''}
                  type="button"
                  aria-label={`查看第 ${index + 1} 张后台截图`}
                  aria-pressed={screenshot.id === activeScreenshot.id}
                  key={screenshot.id}
                  onClick={() => setSelectedScreenshotId(screenshot.id)}
                >
                  <img src={screenshot.imageUrl} alt="" />
                  <span>{index + 1}</span>
                </button>
              ))}
            </div>
          ) : null}
          <dl className="creator-social-screenshot-meta">
            <div><dt>文件名</dt><dd>{activeScreenshot.fileName}</dd></div>
            <div>
              <dt>上传时间</dt>
              <dd><time dateTime={activeScreenshot.uploadedAt}>{formatCreatorPayoutAccountUpdatedAt(activeScreenshot.uploadedAt)}</time></dd>
            </div>
            <div><dt>当前序号</dt><dd>{activeIndex + 1} / {screenshots.length}</dd></div>
          </dl>
        </div>
      ) : (
        <div className="creator-social-screenshot-empty">
          <Images size={24} />
          <span><strong>后台截图待补充</strong><small>该历史账号尚未同步达人上传的认证材料。</small></span>
        </div>
      )}
    </Modal>
  );
}

export function CreatorSocialAccountDetails({ accounts }: { accounts: CreatorSocialAccount[] }) {
  const [previewAccount, setPreviewAccount] = useState<CreatorSocialAccount | null>(null);
  if (accounts.length === 0) {
    return (
      <div className="creator-social-empty">
        <Link2 size={18} />
        <span><strong>尚未填写社媒账号</strong><small>编辑达人档案后可添加对应平台账号</small></span>
      </div>
    );
  }

  return (
    <>
      <div className="creator-social-account-list">
        {accounts.map((account) => {
          const tone = socialPlatformTone(account.platform);
          const screenshotCount = account.verificationScreenshots?.length ?? 0;
          return (
            <article className="creator-social-account-card" key={account.id}>
              <span className={`creator-social-platform-mark creator-social-platform-${tone}`}>
                <SocialPlatformIcon platform={account.platform} handle={account.handle} size={21} />
              </span>
              <div className="creator-social-account-copy">
                <strong>{account.platform || '平台待补充'}</strong>
                <small>{account.handle || '账号待补充'}</small>
              </div>
              <span className="creator-social-verification">
                <Clock3 size={13} />
                认证状态待同步
              </span>
              <div className="creator-social-account-actions">
                {account.profileUrl ? (
                  <a href={account.profileUrl} target="_blank" rel="noreferrer" aria-label={`打开 ${account.platform} 主页`}>
                    <ExternalLink size={14} />
                    查看主页
                  </a>
                ) : (
                  <span className="creator-social-link-empty">未填写主页链接</span>
                )}
                <button
                  className="creator-social-screenshot-button"
                  type="button"
                  disabled={!screenshotCount}
                  title={screenshotCount ? `查看 ${screenshotCount} 张后台截图` : '达人暂未上传后台截图'}
                  aria-label={screenshotCount
                    ? `查看 ${account.platform} ${account.handle} 的 ${screenshotCount} 张后台截图`
                    : `${account.platform} ${account.handle} 后台截图待补充`}
                  onClick={() => setPreviewAccount(account)}
                >
                  <Images size={14} />
                  {screenshotCount ? `查看后台截图（${screenshotCount}）` : '后台截图待补充'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {previewAccount ? (
        <CreatorSocialScreenshotDialog account={previewAccount} onClose={() => setPreviewAccount(null)} />
      ) : null}
    </>
  );
}

export function CreatorCollaborationProjectDetails({
  projects,
}: {
  projects: readonly CreatorCollaborationProjectRecord[];
}) {
  return (
    <CreatorPaymentSection
      icon={<Building2 size={19} />}
      title="合作项目"
      description="汇总该达人在全系统中的当前及历史合作项目"
      tone="collaboration"
    >
      {projects.length ? (
        <div className="creator-collaboration-project-list">
          {projects.map((project) => (
            <article className="creator-collaboration-project-card" key={project.projectId}>
              <header>
                <span className="creator-collaboration-project-code">{project.projectCode}</span>
                <span className="creator-collaboration-project-badges">
                  <span className={`creator-collaboration-relation is-${project.relationStatus.toLowerCase()}`}>
                    {project.relationStatus === 'CURRENT' ? '当前关联' : '历史关联'}
                  </span>
                  <span className={`creator-collaboration-contract-status is-${project.contractStatus.toLowerCase()}`}>
                    {{
                      ACTIVE: '合同有效',
                      PENDING: '合同待确认',
                      UNSET: '合同期限待补充',
                      EXPIRED: '合同已到期',
                      ENDED: '合同已结束',
                      NONE: '未关联合同',
                    }[project.contractStatus]}
                  </span>
                </span>
              </header>
              <div className="creator-collaboration-project-title">
                <h4>{project.projectName}</h4>
                {!project.directoryResolved ? <span>项目资料待同步</span> : null}
              </div>
              <dl className="creator-collaboration-project-meta">
                <div><dt>合作品牌</dt><dd>{project.brand}</dd></div>
                <div><dt>Invoice 份数</dt><dd>{project.invoiceCount} 份</dd></div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <div className="creator-collaboration-project-empty">
          <Files size={20} />
          <span><strong>暂无合作项目记录</strong><small>该达人尚未通过稳定 ID 关联合作项目或业务资料</small></span>
        </div>
      )}
    </CreatorPaymentSection>
  );
}

function CreatorSocialAccountsEditor({
  accounts,
  onChange,
  showErrors = false,
}: {
  accounts: CreatorSocialAccount[];
  onChange: (accounts: CreatorSocialAccount[]) => void;
  showErrors?: boolean;
}) {
  const updateAccount = (
    id: string,
    field: 'platform' | 'handle' | 'profileUrl',
    value: string,
  ) => {
    onChange(accounts.map((account) => account.id === id ? { ...account, [field]: value } : account));
  };

  const addAccount = () => {
    onChange([
      ...accounts,
      createSocialAccount(`social-${Date.now()}-${accounts.length + 1}`),
    ]);
  };

  const removeAccount = (id: string) => {
    if (accounts.length <= 1) return;
    onChange(accounts.filter((account) => account.id !== id));
  };

  return (
    <div className="form-grid creator-social-account-editor">
      {accounts.map((account, index) => (
        <div className="creator-social-account-editor-row" key={account.id}>
          <label>
            <span className="creator-payment-field-label">
              <span>社媒平台<em className="required-mark" aria-hidden="true">*</em></span>
              <small>Social platform</small>
            </span>
            <input
              aria-label={`社媒平台 ${index + 1}`}
              aria-invalid={showErrors && !account.platform.trim() ? true : undefined}
              placeholder="例如：Instagram"
              value={account.platform}
              onChange={(event) => updateAccount(account.id, 'platform', event.target.value)}
            />
          </label>
          <label>
            <span className="creator-payment-field-label">
              <span>平台账号<em className="required-mark" aria-hidden="true">*</em></span>
              <small>Platform handle</small>
            </span>
            <input
              aria-label={`平台账号 ${index + 1}`}
              aria-invalid={showErrors && !account.handle.trim() ? true : undefined}
              placeholder="例如：@MinaKato"
              value={account.handle}
              onChange={(event) => updateAccount(account.id, 'handle', event.target.value)}
            />
          </label>
          <label>
            <span className="creator-payment-field-label">
              <span>主页链接</span>
              <small>Profile URL · 选填</small>
            </span>
            <input
              aria-label={`主页链接 ${index + 1}`}
              aria-invalid={showErrors && Boolean(account.profileUrl.trim()) && !/^https?:\/\/\S+$/i.test(account.profileUrl.trim()) ? true : undefined}
              type="url"
              placeholder="https://..."
              value={account.profileUrl}
              onChange={(event) => updateAccount(account.id, 'profileUrl', event.target.value)}
            />
          </label>
          <button
            className="creator-social-remove-button"
            type="button"
            aria-label={`删除第 ${index + 1} 个社媒账号`}
            title={accounts.length <= 1 ? '至少保留一个社媒账号' : '删除社媒账号'}
            disabled={accounts.length <= 1}
            onClick={() => removeAccount(account.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button className="creator-social-add-button" type="button" onClick={addAccount}>
        <Plus size={16} />
        添加社媒账号
      </button>
    </div>
  );
}

export function CreatorsPage({
  notify,
  creators,
  collaborationProjects,
  onSaveCreator,
  canEdit,
  currentUserAccount,
  focusedCreatorId,
  onFocusCleared,
}: {
  notify: Notify;
  creators: CreatorProfile[];
  collaborationProjects: readonly CreatorCollaborationProjectRecord[];
  onSaveCreator: (creator: CreatorProfile) => void;
  canEdit: boolean;
  currentUserAccount: string;
  focusedCreatorId?: string | null;
  onFocusCleared?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<CreatorDirectoryProviderFilter>('all');
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<Set<string>>(() => new Set());
  const [exportingCreators, setExportingCreators] = useState(false);
  const invitationStorageLoadFailedRef = useRef(false);
  const [invitationRecords, setInvitationRecords] = useState<CreatorInvitationRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return loadCreatorInvitationRecords(window.localStorage);
    } catch {
      invitationStorageLoadFailedRef.current = true;
      return [];
    }
  });
  const [invitationSendOpen, setInvitationSendOpen] = useState(false);
  const [invitationRecordsOpen, setInvitationRecordsOpen] = useState(false);
  const [invitationRecordsInitialStatus, setInvitationRecordsInitialStatus] = useState<CreatorInvitationStatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(focusedCreatorId ?? null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatorNameManuallyEdited, setCreatorNameManuallyEdited] = useState(false);
  const [draft, setDraft] = useState<CreatorProfile | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [creatorCloseGuardOpen, setCreatorCloseGuardOpen] = useState(false);
  const creatorSelectAllRef = useRef<HTMLInputElement>(null);
  const selected = creators.find((creator) => creator.id === selectedId) ?? null;
  const collaborationProjectCountByCreator = useMemo(() => {
    const counts = new Map<string, number>();
    collaborationProjects.forEach((project) => {
      counts.set(project.creatorId, (counts.get(project.creatorId) ?? 0) + 1);
    });
    return counts;
  }, [collaborationProjects]);

  useEffect(() => {
    if (focusedCreatorId) setSelectedId(focusedCreatorId);
  }, [focusedCreatorId]);

  useEffect(() => {
    if (!invitationStorageLoadFailedRef.current) return;
    invitationStorageLoadFailedRef.current = false;
    notify('邀请记录读取失败', '浏览器本地存储暂时不可用，本次仍可在当前页面中模拟发送。');
  }, [notify]);

  const normalizedSearch = search.trim().toLocaleLowerCase('zh-CN');
  const filteredCreators = useMemo(() => filterCreatorDirectory(creators, {
    search,
    provider: providerFilter,
  }), [creators, providerFilter, search]);
  const verifiedCount = creators.filter((creator) => {
    const defaultAccount = explicitDefaultPayoutAccount(creator);
    return Boolean(defaultAccount && isPayoutAccountVerified(defaultAccount));
  }).length;
  const activeInvitationSummary = useMemo(
    () => summarizeActiveCreatorInvitations(invitationRecords),
    [invitationRecords],
  );
  const {
    page,
    pageItems: visibleCreators,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination(filteredCreators, { resetKey: `${normalizedSearch}\u0000${providerFilter}` });

  const filteredCreatorIds = filteredCreators.map((creator) => creator.id);
  const selectedFilteredCount = filteredCreatorIds.filter((id) => selectedCreatorIds.has(id)).length;
  const allFilteredCreatorsSelected = filteredCreatorIds.length > 0
    && selectedFilteredCount === filteredCreatorIds.length;
  const partlyFilteredCreatorsSelected = selectedFilteredCount > 0 && !allFilteredCreatorsSelected;
  const selectedCreators = creators.filter((creator) => selectedCreatorIds.has(creator.id));

  useEffect(() => {
    if (creatorSelectAllRef.current) {
      creatorSelectAllRef.current.indeterminate = partlyFilteredCreatorsSelected;
    }
  }, [partlyFilteredCreatorsSelected]);

  useEffect(() => {
    const existingIds = new Set(creators.map((creator) => creator.id));
    setSelectedCreatorIds((current) => {
      const next = new Set([...current].filter((id) => existingIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [creators]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
  };

  const openInvitationRecords = (initialStatus: CreatorInvitationStatusFilter = 'all') => {
    setInvitationRecordsInitialStatus(initialStatus);
    setInvitationRecordsOpen(true);
  };

  const exportSelectedCreators = async () => {
    if (!selectedCreators.length || exportingCreators) return;
    setExportingCreators(true);
    try {
      const workbook = await createCreatorDirectoryWorkbook(selectedCreators);
      const filename = creatorDirectoryWorkbookFilename();
      downloadBlob(workbook, filename);
      notify('达人档案已导出', `已导出 ${selectedCreators.length} 位达人的三张数据表，收款账户标识均已脱敏。`);
    } catch (error) {
      notify('达人档案导出失败', error instanceof Error ? error.message : '无法生成 Excel 文件，请稍后重试。');
    } finally {
      setExportingCreators(false);
    }
  };

  const updateInvitationRecords = (nextRecords: CreatorInvitationRecord[]) => {
    setInvitationRecords(nextRecords);
    try {
      saveCreatorInvitationRecords(nextRecords, window.localStorage);
    } catch {
      notify('邀请记录保存失败', '模拟发送结果已保留在当前页面，但刷新后可能无法恢复。');
    }
  };

  const openProfile = (creator: CreatorProfile) => {
    setSelectedId(creator.id);
    onFocusCleared?.();
    setEditing(false);
    setCreating(false);
    setCreatorNameManuallyEdited(false);
    setDraft(null);
    setFormErrors([]);
    setValidationAttempt(0);
    setCreatorCloseGuardOpen(false);
  };

  const closeProfile = () => {
    setSelectedId(null);
    onFocusCleared?.();
    setEditing(false);
    setCreating(false);
    setCreatorNameManuallyEdited(false);
    setDraft(null);
    setFormErrors([]);
    setValidationAttempt(0);
    setCreatorCloseGuardOpen(false);
  };

  const startEditing = () => {
    if (!selected) return;
    setDraft({
      ...selected,
      socialAccounts: selected.socialAccounts.map((account) => ({ ...account })),
      contact: { ...selected.contact },
      payoutAccounts: clonePayoutAccounts(selected.payoutAccounts),
      payoutAccountHistory: clonePayoutAccounts(selected.payoutAccountHistory ?? []),
    });
    setEditing(true);
    setCreating(false);
    setCreatorNameManuallyEdited(true);
    setFormErrors([]);
    setValidationAttempt(0);
  };

  const startCreating = () => {
    const storageKey = creatorDraftStorageKey(currentUserAccount);
    try {
      const savedDraft = localStorage.getItem(storageKey);
      if (savedDraft) {
        const stored = JSON.parse(savedDraft) as unknown;
        if (isStoredCreatorDraft(stored) && !creators.some((creator) => creator.id === stored.profile.id)) {
          const nameIsAutoDerived = isCreatorNameAutoDerived(stored.profile.name, stored.profile.socialAccounts);
          setSelectedId(null);
          setDraft({
            ...stored.profile,
            name: nameIsAutoDerived
              ? creatorNameFromPrimaryHandle(stored.profile.socialAccounts)
              : stored.profile.name,
            region: stored.profile.region || creatorRegionFromContactAddress(stored.profile.contact.address),
            socialAccounts: stored.profile.socialAccounts.map((account) => ({ ...account })),
            contact: { ...stored.profile.contact },
            payoutAccounts: clonePayoutAccounts(stored.profile.payoutAccounts),
            payoutAccountHistory: clonePayoutAccounts(stored.profile.payoutAccountHistory ?? []),
          });
          setEditing(true);
          setCreating(true);
          setCreatorNameManuallyEdited(!nameIsAutoDerived);
          setFormErrors([]);
          setValidationAttempt(0);
          setCreatorCloseGuardOpen(false);
          notify('达人草稿已恢复', '已恢复当前账号在此浏览器中未完成的达人档案。');
          return;
        }
        localStorage.removeItem(storageKey);
      }
    } catch {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Storage may be unavailable; a fresh in-memory draft can still be created.
      }
      notify('达人草稿未恢复', '本地草稿无法读取，已为你打开空白表单。');
    }

    const id = createPrototypeId('creator');
    setSelectedId(null);
    setDraft({
      id,
      initials: 'NA',
      accent: '#fb7185',
      name: '',
      handle: '',
      region: '',
      platform: '',
      projects: 0,
      socialAccounts: [createSocialAccount(`social-${id}-1`)],
      contact: createInvoiceContact('', '', '', ''),
      payoutAccounts: [createEmptyAirwallexAccount('', '', id)],
      payoutAccountHistory: [],
    });
    setEditing(true);
    setCreating(true);
    setCreatorNameManuallyEdited(false);
    setFormErrors([]);
    setValidationAttempt(0);
    setCreatorCloseGuardOpen(false);
  };

  const requestCloseCreatorModal = () => {
    if (hasCreatorDraftContent(draft)) {
      setCreatorCloseGuardOpen(true);
      return;
    }
    closeProfile();
  };

  const discardCreatorDraft = () => {
    try {
      localStorage.removeItem(creatorDraftStorageKey(currentUserAccount));
    } catch {
      notify('无法放弃草稿', '浏览器本地存储暂时不可用，草稿未能安全清除。');
      return;
    }
    closeProfile();
  };

  const saveCreatorDraft = () => {
    if (!draft) return;
    const stored: StoredCreatorDraft = {
      version: CREATOR_DRAFT_STORAGE_VERSION,
      profile: draft,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(creatorDraftStorageKey(currentUserAccount), JSON.stringify(stored));
    } catch {
      notify('达人草稿保存失败', '浏览器本地存储暂时不可用，已保留当前编辑内容。');
      return;
    }
    closeProfile();
    notify('达人草稿已保存', '下次使用当前账号在此浏览器新建达人档案时会自动恢复。');
  };

  const cancelEditing = () => {
    if (creating) {
      closeProfile();
      return;
    }
    setDraft(null);
    setEditing(false);
    setFormErrors([]);
    setValidationAttempt(0);
  };

  const updateDraftName = (value: string) => {
    const hasManualName = Boolean(value.trim());
    setCreatorNameManuallyEdited(hasManualName);
    setDraft((current) => current ? {
      ...current,
      name: creatorNameAfterManualInput(value, current.socialAccounts),
    } : current);
  };

  const updateDraftSocialAccounts = (socialAccounts: CreatorSocialAccount[]) => {
    setDraft((current) => {
      if (!current) return current;
      const platforms = [...new Set(socialAccounts.map((account) => account.platform.trim()).filter(Boolean))];
      const primaryHandle = normalizeSocialHandle(socialAccounts[0]?.handle ?? '');
      return {
        ...current,
        socialAccounts,
        handle: primaryHandle,
        platform: platforms.join(' · '),
        name: creatorNameAfterSocialAccountsChange(
          current.name,
          creatorNameManuallyEdited,
          socialAccounts,
        ),
      };
    });
  };

  const updateDraftContact = (field: keyof CreatorInvoiceContact, value: string) => {
    setDraft((current) => current ? {
      ...current,
      contact: { ...current.contact, [field]: value },
      ...(field === 'address' ? { region: creatorRegionFromContactAddress(value) } : {}),
    } : current);
  };

  const saveCreatorDetails = () => {
    if (!draft) return;
    const nextErrors: string[] = [];
    if (!draft.region.trim()) nextErrors.push('请在联系地址末尾填写国家名');
    if (draft.socialAccounts.length === 0) nextErrors.push('至少一个社媒账号');
    if (draft.socialAccounts.some((account) => !account.platform.trim() || !account.handle.trim())) {
      nextErrors.push('每个社媒账号的平台与账号');
    }
    if (draft.socialAccounts.some((account) => account.profileUrl.trim() && !/^https?:\/\/\S+$/i.test(account.profileUrl.trim()))) {
      nextErrors.push('有效的社媒主页链接');
    }
    if (!draft.contact.legalName.trim()) nextErrors.push('Invoice 真实姓名 / 公司名称');
    if (!draft.contact.address.trim()) nextErrors.push('联系地址');
    if (!draft.contact.email.trim() || !/^\S+@\S+\.\S+$/.test(draft.contact.email)) nextErrors.push('有效联系邮箱');
    const payoutAccountError = getCreatorPayoutAccountValidationError(draft.payoutAccounts);
    if (payoutAccountError) nextErrors.push(payoutAccountError);
    if (nextErrors.length > 0) {
      setFormErrors(nextErrors);
      setValidationAttempt((current) => current + 1);
      window.requestAnimationFrame(() => {
        const creatorField = document.querySelector<HTMLElement>(
          '.creator-profile-editor-modal .creator-payment-editor > .creator-payment-section [aria-invalid="true"]',
        );
        const target = creatorField ?? document.querySelector<HTMLElement>(
          '.creator-profile-editor-modal [data-airwallex-field-path][aria-invalid="true"], '
          + '.creator-profile-editor-modal [data-airwallex-field-path] [aria-invalid="true"], '
          + '.creator-profile-editor-modal .payout-account-form',
        );
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target?.focus({ preventScroll: true });
      });
      return;
    }

    const normalizedSocialAccounts = draft.socialAccounts.map((account) => {
      const platform = account.platform.trim();
      const handle = normalizeSocialHandle(account.handle);
      return {
        ...account,
        platform,
        handle,
        profileUrl: account.profileUrl.trim() || defaultSocialProfileUrl(platform, handle),
      };
    });
    const normalizedName = draft.name.trim() || creatorNameFromPrimaryHandle(normalizedSocialAccounts);
    const initials = creatorInitialsFromName(normalizedName);
    const platformSummary = [...new Set(normalizedSocialAccounts.map((account) => account.platform))].join(' · ');
    const preparedAccounts = prepareCreatorPayoutAccountsForSave(
      draft.id,
      selected?.payoutAccounts ?? [],
      draft.payoutAccounts,
    );
    const payoutAccountHistory = [
      ...(selected?.payoutAccountHistory ?? []),
      ...preparedAccounts.archived,
    ].filter((account, index, history) => (
      history.findIndex((candidate) => (
        getPayoutAccountId(candidate) === getPayoutAccountId(account)
        && getPayoutAccountVersion(candidate) === getPayoutAccountVersion(account)
      )) === index
    ));
    const updated: CreatorProfile = {
      ...draft,
      initials,
      name: normalizedName,
      handle: normalizedSocialAccounts[0]?.handle ?? '',
      region: draft.region.trim(),
      platform: platformSummary,
      socialAccounts: normalizedSocialAccounts,
      payoutAccounts: preparedAccounts.accounts,
      payoutAccountHistory,
    };
    onSaveCreator(updated);
    try {
      localStorage.removeItem(creatorDraftStorageKey(currentUserAccount));
    } catch {
      // Saving the creator must not fail because stale local draft cleanup is unavailable.
    }
    setSelectedId(updated.id);
    setDraft(null);
    setEditing(false);
    setCreating(false);
    setFormErrors([]);
    setValidationAttempt(0);
    const defaultAccount = getDefaultPayoutAccount(updated.payoutAccounts);
    const status = getPayoutAccountStatusMeta(defaultAccount?.status ?? 'DRAFT', defaultAccount?.provider);
    notify(
      creating ? '达人档案已建立' : '达人档案已保存',
      `${updated.name} 的资料已保存；默认收款账户状态为“${status.label}”。`,
    );
  };

  const activeProfile = editing && draft ? draft : selected;
  const activeCollaborationProjects = activeProfile
    ? creatorCollaborationProjectsFor(collaborationProjects, activeProfile.id)
    : [];
  const activeDefaultAccount = activeProfile ? explicitDefaultPayoutAccount(activeProfile) : null;
  const activeStatus = getPayoutAccountStatusMeta(activeDefaultAccount?.status ?? 'DRAFT', activeDefaultAccount?.provider);
  const activeStatusTone = activeDefaultAccount ? activeStatus.tone : 'muted';
  const activePayoutAccounts = activeProfile?.payoutAccounts.filter((account) => account.status !== 'DISABLED') ?? [];
  const activePayoutProviders = [...new Set(activePayoutAccounts.map((account) => account.provider))];
  const activeUsableAccountCount = activePayoutAccounts.filter(isPayoutAccountVerified).length;
  const activeDefaultAccountSummary = activeDefaultAccount
    ? `${activeDefaultAccount.provider === 'Airwallex' ? 'Airwallex · ' : ''}${getPayoutAccountSummary(activeDefaultAccount)}`
    : '';
  const requiredContactFields = INVOICE_CONTACT_FIELDS.filter((field) => !field.optional);
  const completedContactFields = activeProfile
    ? requiredContactFields.filter((field) => activeProfile.contact[field.key].trim()).length
    : 0;
  const contactIsComplete = completedContactFields === requiredContactFields.length;

  return (
    <div className="page-stack">
      <PageHeading
        title="达人档案"
        subtitle="分开维护达人身份、Invoice 联系资料及多个收款账户。"
        actions={canEdit ? (
          <>
            <Button icon={<Plus size={17} />} onClick={startCreating}>新建达人档案</Button>
            <Button variant="secondary" icon={<Send size={17} />} onClick={() => setInvitationSendOpen(true)}>发送邀请链接</Button>
          </>
        ) : undefined}
      />
      <div className="metrics-grid">
        <MetricCard label="达人总数" value={creators.length.toLocaleString('zh-CN')} meta="当前档案" tone="peach" />
        <MetricCard label="默认账户已验证" value={verifiedCount.toLocaleString('zh-CN')} meta={creators.length ? `验证率 ${((verifiedCount / creators.length) * 100).toFixed(1)}%` : '暂无账户'} />
        <MetricCard
          label="邀请中"
          value={activeInvitationSummary.total.toLocaleString('zh-CN')}
          meta={`已发送 ${activeInvitationSummary.sent} · 入驻中 ${activeInvitationSummary.onboarding}`}
          tone="lilac"
          onClick={() => openInvitationRecords('ACTIVE')}
        />
      </div>
      <section className="content-card">
        <div className="content-toolbar creator-directory-toolbar">
          <div className="creator-directory-filter-controls">
            <SearchBar value={search} onChange={handleSearchChange} placeholder="搜索达人名称、账号或 Real Name / Company Name" />
            <SelectField
              ariaLabel="达人付款渠道筛选"
              className="creator-directory-provider-filter"
              value={providerFilter}
              options={CREATOR_DIRECTORY_PROVIDER_OPTIONS}
              onChange={setProviderFilter}
            />
          </div>
          <div className="creator-directory-toolbar-actions">
            <Button
              variant="secondary"
              icon={exportingCreators ? <LoaderCircle className="is-spinning" size={16} /> : <Download size={16} />}
              disabled={!selectedCreators.length || exportingCreators}
              disabledReason={!selectedCreators.length ? '请先勾选至少一位达人。' : '达人档案正在导出，请稍候。'}
              aria-busy={exportingCreators || undefined}
              onClick={() => { void exportSelectedCreators(); }}
            >
              {exportingCreators ? '正在导出' : `导出所选（${selectedCreators.length}）`}
            </Button>
            <Button variant="secondary" icon={<ClipboardCheck size={16} />} onClick={() => openInvitationRecords('all')}>
              邀请记录
            </Button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table operational-table creator-directory-table">
            <thead>
              <tr>
                <th className="creator-directory-select-cell">
                  <input
                    ref={creatorSelectAllRef}
                    type="checkbox"
                    aria-label="全选当前筛选结果中的达人"
                    checked={allFilteredCreatorsSelected}
                    disabled={!filteredCreatorIds.length}
                    onChange={(event) => setSelectedCreatorIds((current) => (
                      toggleCreatorDirectorySelection(current, filteredCreatorIds, event.target.checked)
                    ))}
                  />
                </th>
                <th>达人</th><th>Real Name / Company Name</th><th>社媒平台数</th><th>收款账户</th><th>账户更新时间</th><th>合作项目</th><th className="action-cell">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleCreators.length > 0 ? visibleCreators.map((creator) => {
                const defaultAccount = explicitDefaultPayoutAccount(creator);
                const accountVersionResult = creatorPayoutAccountVersionResult(defaultAccount);
                const latestAccountUpdate = latestCreatorPayoutAccountUpdatedAt(creator);
                const creatorSelected = selectedCreatorIds.has(creator.id);
                return (
                  <tr className={creatorSelected ? 'is-selected' : ''} key={creator.id} aria-selected={creatorSelected} onClick={() => openProfile(creator)}>
                    <td className="creator-directory-select-cell">
                      <input
                        type="checkbox"
                        aria-label={`选择达人 ${creator.name}`}
                        checked={creatorSelected}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setSelectedCreatorIds((current) => (
                          toggleCreatorDirectorySelection(current, [creator.id], event.target.checked)
                        ))}
                      />
                    </td>
                    <td>
                      <CreatorIdentity
                        creator={creator}
                        className="creator-directory-identity"
                        socialAccountsMode="expanded"
                      />
                    </td>
                    <td><span className="creator-directory-legal-entity-name">{creatorDirectoryLegalEntityName(creator)}</span></td>
                    <td><strong className="creator-directory-platform-count">{distinctCreatorSocialPlatformCount(creator)} 个</strong></td>
                    <td>
                      <span className={`creator-directory-payout ${defaultAccount ? 'has-default-account' : 'is-unset'}`}>
                        {defaultAccount
                          ? <PaymentProviderBadge compact provider={defaultAccount.provider} />
                          : <strong>付款渠道待设置</strong>}
                        <small>
                          <span className={accountVersionResult === '账户已更新' ? 'is-updated' : ''}>
                            {accountVersionResult ?? '尚未建立主账户'}
                          </span>
                          {defaultAccount ? <span>{defaultAccount.nickname}</span> : null}
                        </small>
                      </span>
                    </td>
                    <td>
                      <time className="creator-directory-updated-at" dateTime={latestAccountUpdate || undefined}>
                        {formatCreatorPayoutAccountUpdatedAt(latestAccountUpdate)}
                      </time>
                    </td>
                    <td>{collaborationProjectCountByCreator.get(creator.id) ?? 0} 个</td>
                    <td className="action-cell"><ListActionButton kind="view" onClick={(event) => { event.stopPropagation(); openProfile(creator); }}>查看档案</ListActionButton></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={8}><div className="empty-table">没有找到匹配的达人档案</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>共 {filteredCreators.length} 条 · 已选 {selectedCreators.length} 位</span>
          <Pagination
            ariaLabel="达人列表分页"
            page={page}
            pageSize={pageSize}
            total={filteredCreators.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </section>
      {activeProfile ? (
        <Modal
          title={creating ? '新建达人档案' : editing ? '编辑达人档案' : '达人档案'}
          width="1040px"
          className={editing ? 'creator-profile-editor-modal' : undefined}
          onClose={closeProfile}
          onBackdropMouseDown={creating ? requestCloseCreatorModal : closeProfile}
          footer={editing ? (
            <><Button variant="ghost" onClick={cancelEditing}>取消</Button><Button onClick={saveCreatorDetails}>{creating ? '建立达人档案' : '保存达人档案'}</Button></>
          ) : (
            <>
              <Button variant="secondary" onClick={closeProfile}>关闭</Button>
              {canEdit ? <Button icon={<Pencil size={16} />} onClick={startEditing}>编辑达人档案</Button> : null}
            </>
          )}
        >
          <div className="profile-summary creator-profile-summary">
            <Avatar initials={activeProfile.initials} accent={activeProfile.accent} size="lg" />
            <div className="creator-profile-summary-copy">
              <div><h3>{activeProfile.name || '新达人'}</h3></div>
              <dl className="creator-profile-summary-meta">
                <div><dt>地区</dt><dd>{activeProfile.region || '待补充'}</dd></div>
                <div><dt>合作项目</dt><dd>{activeCollaborationProjects.length} 个</dd></div>
              </dl>
            </div>
            <div className="creator-profile-summary-status">
              <small>默认收款账户</small>
              <span className={`verified-badge verified-badge-${activeStatusTone}`}>
                {activeStatusTone === 'success' ? <ShieldCheck size={15} /> : activeStatusTone === 'danger' || activeStatusTone === 'warning' ? <AlertCircle size={15} /> : <Clock3 size={15} />}
                {activeDefaultAccount ? activeStatus.label : '未设置默认账户'}
              </span>
            </div>
          </div>
          {editing && draft ? (
            <div className="creator-payment-editor">
              {formErrors.length > 0 ? (
                <NoticeBanner>
                  <strong>请先补充以下档案字段：</strong> {formErrors.join('、')}
                </NoticeBanner>
              ) : null}
              <CreatorPaymentSection icon={<Users size={19} />} title="达人基本资料" description="用于项目选择与档案检索，不参与银行账户验证">
                <div className="form-grid creator-payment-form-grid">
                  <label>
                    <span className="creator-payment-field-label"><span>达人名称</span><small>Display Name · 默认使用首个 Handle（不含 @）</small></span>
                    <input aria-label="达人名称" placeholder="录入首个 Handle 后自动带入，支持修改" value={draft.name} onChange={(event) => updateDraftName(event.target.value)} />
                  </label>
                  <label>
                    <span className="creator-payment-field-label"><span>地区</span><small>From contact address · 自动带入</small></span>
                    <input className="creator-derived-readonly-field" aria-label="达人地区（根据联系地址自动带入）" readOnly value={draft.region || '待识别'} />
                  </label>
                </div>
              </CreatorPaymentSection>
              <CreatorPaymentSection icon={<Link2 size={19} />} title="社媒账号" description="达人填写个人信息时补充；分别维护各平台账号与主页链接" tone="identity">
                <CreatorSocialAccountsEditor accounts={draft.socialAccounts} onChange={updateDraftSocialAccounts} showErrors={formErrors.length > 0} />
              </CreatorPaymentSection>
              <CreatorPaymentSection icon={<FileText size={19} />} title="Invoice 联系资料" description="生成 Invoice 时使用，与银行账户名和 PayPal 邮箱独立维护" tone="identity">
                <CreatorContactFormGrid contact={draft.contact} onChange={updateDraftContact} showErrors={formErrors.length > 0} />
              </CreatorPaymentSection>
              <div className="creator-payment-note">
                <ShieldCheck size={16} />
                <span>
                  <strong>完成账户校验后才能创建达人档案</strong>
                  <small>付款信息字段由 Airwallex Form Schema 决定；修改银行信息后需要重新点击“校验账户”。</small>
                </span>
              </div>
              <CreatorPaymentSection icon={<WalletCards size={19} />} title="收款账户" description="按付款渠道管理账户；全档案只能指定一个默认账户用于新的付款" tone="payout">
                <CreatorPayoutAccounts
                  accounts={draft.payoutAccounts}
                  editing
                  creatorId={draft.id}
                  creatorName={draft.name}
                  creatorEmail={draft.contact.email}
                  validationAttempt={validationAttempt}
                  focusValidationError={formErrors.every((error) => error.includes('收款账户') || error.includes('Airwallex'))}
                  onChange={(payoutAccounts) => setDraft((current) => current ? { ...current, payoutAccounts } : current)}
                />
              </CreatorPaymentSection>
            </div>
          ) : (
            <div className="creator-profile-content">
              <section className="creator-profile-overview" aria-label="达人档案概览">
                <article>
                  <span>社媒账号</span>
                  <strong>{activeProfile.socialAccounts.length} 个</strong>
                  <CreatorSocialPlatformIcons accounts={activeProfile.socialAccounts} size={15} />
                </article>
                <article>
                  <span>Invoice 联系资料</span>
                  <strong>{contactIsComplete ? '已完善' : '待补充'}</strong>
                  <small>{completedContactFields}/{requiredContactFields.length} 项必填资料已填写</small>
                </article>
                <article>
                  <span>收款渠道</span>
                  <strong>{activePayoutProviders.join(' · ') || '待添加'}</strong>
                  <small>{activePayoutAccounts.length} 个账户 · {activeUsableAccountCount} 个可用</small>
                </article>
                <article>
                  <span>默认付款账户</span>
                  <strong>{activeDefaultAccount?.nickname || '待设置'}</strong>
                  <small>
                    {activeDefaultAccount
                      ? activeDefaultAccountSummary
                      : '暂无可用于付款的账户'}
                  </small>
                </article>
              </section>
              <CreatorPaymentSection icon={<Link2 size={19} />} title="社媒账号" description="平台账号与主页来自达人档案；认证结论需由 C 端认证流程同步" tone="identity">
                <CreatorSocialAccountDetails accounts={activeProfile.socialAccounts} />
              </CreatorPaymentSection>
              <CreatorPaymentSection icon={<FileText size={19} />} title="Invoice 联系资料" description="用于 Invoice 的 From 信息" tone="identity">
                <CreatorContactDetailsGrid contact={activeProfile.contact} />
              </CreatorPaymentSection>
              <CreatorPaymentSection icon={<WalletCards size={19} />} title="收款账户" description="支持 Airwallex、PayPal 和 Payer Max，默认账户决定付款时的预选资料" tone="payout">
                <CreatorPayoutAccounts
                  accounts={activeProfile.payoutAccounts}
                  creatorId={activeProfile.id}
                  creatorName={activeProfile.name}
                  creatorEmail={activeProfile.contact.email}
                />
              </CreatorPaymentSection>
              <CreatorCollaborationProjectDetails projects={activeCollaborationProjects} />
            </div>
          )}
        </Modal>
      ) : null}
      <CreatorDraftExitDialog
        open={creatorCloseGuardOpen}
        onDiscard={discardCreatorDraft}
        onSave={saveCreatorDraft}
        onContinue={() => setCreatorCloseGuardOpen(false)}
      />
      {invitationSendOpen ? (
        <CreatorInvitationSendDialog
          creators={creators}
          records={invitationRecords}
          notify={notify}
          onClose={() => setInvitationSendOpen(false)}
          onRecordsChange={updateInvitationRecords}
          onOpenRecords={() => {
            setInvitationSendOpen(false);
            openInvitationRecords('all');
          }}
        />
      ) : null}
      {invitationRecordsOpen ? (
        <CreatorInvitationRecordsDialog
          records={invitationRecords}
          initialStatus={invitationRecordsInitialStatus}
          notify={notify}
          onClose={() => setInvitationRecordsOpen(false)}
        />
      ) : null}
    </div>
  );
}

const formatCollaborationRequestTime = (value?: string) => {
  if (!value) return '未发起';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '-');
};

export function CollaborationsPage({
  notify,
  canImport,
  creators,
  projects,
  contracts,
  payouts,
  generatedInvoices,
  externalInvoices,
  requests,
  paymentLists,
}: {
  notify: Notify;
  canImport: boolean;
  creators: CreatorProfile[];
  projects: ProjectSummary[];
  contracts: ContractRecord[];
  payouts: Payout[];
  generatedInvoices: GeneratedInvoiceRecord[];
  externalInvoices: ExternalInvoiceCollectionRecord[];
  requests: RequestProjectSummary[];
  paymentLists: PaymentListRecord[];
}) {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const collaborationRows = useMemo(() => buildCollaborationInvoiceRows({
    creators,
    projects,
    contracts,
    payouts,
    generatedInvoices,
    externalInvoices,
    requests,
    paymentLists,
  }), [contracts, creators, externalInvoices, generatedInvoices, paymentLists, payouts, projects, requests]);
  const projectFilterOptions = useMemo(
    () => buildCollaborationProjectFilterOptions(collaborationRows),
    [collaborationRows],
  );
  const query = search.trim().toLowerCase();
  const projectFilteredCollaborations = filterCollaborationRowsByProject(collaborationRows, projectFilter);
  const filteredCollaborations = projectFilteredCollaborations.filter((item) => !query || item.searchText.includes(query));
  const {
    page,
    pageItems: visibleCollaborations,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination(filteredCollaborations, { resetKey: `${query}\u0000${projectFilter}` });
  const selectedRow = selectedRowId
    ? collaborationRows.find((row) => row.rowId === selectedRowId) ?? null
    : null;
  const closeDetail = useCallback(() => setSelectedRowId(null), []);
  const waitingForPaymentCount = collaborationRows.filter((row) => row.status !== '已付款').length;
  const importAction = canImport
    ? <Button icon={<Upload size={17} />} onClick={() => notify('导入模板', '已准备达人合作名单模板。')}>导入合作名单</Button>
    : undefined;
  return (
    <div className="page-stack">
      <PageHeading title="合作名单" subtitle="查看达人交付、Invoice 与付款状态的统一视图。" actions={importAction} />
      <section className="content-card">
        <div className="content-toolbar collaboration-list-toolbar">
          <SearchBar value={search} onChange={setSearch} placeholder="搜索达人、项目、Invoice 或合同" />
          <CollaborationProjectFilter
            value={projectFilter}
            options={projectFilterOptions}
            onChange={setProjectFilter}
          />
          <span className="collaboration-list-toolbar-note">共 {collaborationRows.length} 份 Invoice · 待付款 {waitingForPaymentCount} 份</span>
        </div>
        <div className="table-scroll">
          <table className="data-table operational-table collaboration-list-table">
            <thead><tr><th>达人</th><th>关联项目</th><th>合作交付</th><th>Invoice 编号</th><th>付款进度</th><th>请款时间</th><th className="action-cell">操作</th></tr></thead>
            <tbody>
              {visibleCollaborations.map((item) => (
                <tr key={item.rowId}>
                  <td className="collaboration-creator-cell">
                    <CreatorIdentity
                      className="creator-cell"
                      creator={item.identity.creator}
                      displayName={item.identity.displayName}
                      initials={item.identity.initials}
                      accent={item.identity.accent}
                      accounts={item.identity.socialAccounts}
                      fallbackHandle={item.identity.channelId}
                      fallbackPlatform={item.identity.platform}
                    />
                  </td>
                  <td className="collaboration-project-cell"><strong>{item.projectName}</strong><small>{item.project?.cooperationProjectCode ?? item.project?.projectCode ?? item.projectLinkId ?? '项目资料未找到'}</small></td>
                  <td className="collaboration-description-cell" title={item.descriptionText}><span>{item.descriptionText}</span></td>
                  <td><span className="collaboration-invoice-number">{item.invoiceNumber}</span></td>
                  <td><span className={`collaboration-lifecycle-status is-${collaborationStatusTone(item.status)}`}><i />{item.status}</span></td>
                  <td><time className="collaboration-request-time">{formatCollaborationRequestTime(item.requestSubmittedAt)}</time></td>
                  <td className="action-cell">
                    <ListActionButton
                      kind="view"
                      onClick={(event) => {
                        detailTriggerRef.current = event.currentTarget;
                        setSelectedRowId(item.rowId);
                      }}
                    >查看详情</ListActionButton>
                  </td>
                </tr>
              ))}
              {!filteredCollaborations.length ? <tr><td className="project-list-empty" colSpan={7}>暂无符合条件的 Invoice 合作记录</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>共 {filteredCollaborations.length} 条</span>
          <Pagination
            ariaLabel="合作名单分页"
            page={page}
            pageSize={pageSize}
            total={filteredCollaborations.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </section>
      {selectedRow ? (
        <CollaborationInvoiceDrawer
          row={selectedRow}
          returnFocusTo={detailTriggerRef.current}
          onClose={closeDetail}
        />
      ) : null}
    </div>
  );
}

const INVOICE_PROVIDER_FILTER_OPTIONS: SelectOption<InvoiceManagementFilters['provider']>[] = [
  { value: 'all', label: '全部付款渠道' },
  { value: 'Airwallex', label: 'Airwallex' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'PayMax', label: 'Payer Max' },
];

const INVOICE_TYPE_FILTER_OPTIONS: SelectOption<InvoiceManagementFilters['invoiceType']>[] = [
  { value: 'all', label: '全部 Invoice 类型' },
  { value: 'INTERNAL', label: '内部 Invoice' },
  { value: 'EXTERNAL', label: '外部 Invoice' },
];

const invoiceTypeFilterVisible = (tab: InvoicePageTab) => (
  tab === 'review' || tab === 'approved' || tab === 'returned'
);

const formatInvoiceCreationDraftTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '未记录';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
};

export function InvoicePage({
  payouts,
  creators,
  contracts = [],
  invoiceBillingSettings,
  projects = [],
  creationProjects = projects,
  generatedInvoices,
  creationDrafts = [],
  externalInvoices = [],
  requests,
  tab,
  onTabChange,
  onCreateInvoice,
  onCreateBatchInvoice,
  onResumeCreationDraft = () => undefined,
  onDeleteCreationDraft = () => undefined,
  onCreateExternalInvoice = () => undefined,
  onPublishExternalInvoice = () => undefined,
  onPublishExternalInvoices = () => false,
  onPublishGeneratedInvoices = () => false,
  onWithdrawGeneratedInvoice = () => false,
  onSimulateExternalUpload = () => undefined,
  onCorrectExternalRecognition = () => undefined,
  onSubmitExternalInvoice = () => undefined,
  onReviewExternalInvoiceField = () => undefined,
  onReturnExternalInvoice = () => undefined,
  onSaveExternalInvoiceContractMatch = () => undefined,
  onConfirmExternalInvoiceSignature = () => undefined,
  onApproveExternalInvoice = () => undefined,
  canCreateInvoice,
  canManageInvoice,
  canReviewMedia,
  canReviewFinance,
  canEditProjectResourceInvoice,
  focusedInvoiceId,
  onFocusCleared,
  onMarkSigned,
  onReviewAction,
  onReplyFeedback,
  onSendSignatureReminder,
  onEditInvoice,
  onOpenProject,
  onOpenRequest,
  onOpenPayment,
  canExecutePayout,
  notify,
}: {
  payouts: Payout[];
  creators: CreatorProfile[];
  contracts?: ContractRecord[];
  invoiceBillingSettings: InvoiceBillingSettings;
  projects?: ProjectSummary[];
  creationProjects?: ProjectSummary[];
  generatedInvoices: GeneratedInvoiceRecord[];
  creationDrafts?: InvoiceCreationDraft[];
  externalInvoices?: ExternalInvoiceCollectionRecord[];
  requests: RequestProjectSummary[];
  tab: InvoicePageTab;
  onTabChange: (tab: InvoicePageTab) => void;
  onCreateInvoice: () => void;
  onCreateBatchInvoice: () => void;
  onResumeCreationDraft?: (draft: InvoiceCreationDraft) => void;
  onDeleteCreationDraft?: (draftId: string) => void;
  onCreateExternalInvoice?: (input: ExternalInvoiceCollectionInput, publish: boolean) => void;
  onPublishExternalInvoice?: (invoiceId: string) => void;
  onPublishExternalInvoices?: (invoiceIds: string[]) => boolean;
  onPublishGeneratedInvoices?: (invoiceIds: string[]) => boolean;
  onWithdrawGeneratedInvoice?: (invoiceId: string) => boolean;
  onSimulateExternalUpload?: (
    invoiceId: string,
    scenario: ExternalInvoiceScenario,
    payoutAccountId: string,
    invoiceDate: string,
  ) => void;
  onCorrectExternalRecognition?: (invoiceId: string, fieldKey: ExternalInvoiceFieldKey, value: string) => void;
  onSubmitExternalInvoice?: (invoiceId: string) => void;
  onReviewExternalInvoiceField?: (
    invoiceId: string,
    fieldKey: ExternalInvoiceFieldKey,
    decision: ExternalInvoiceMediaReviewDecision,
    note?: string,
  ) => void;
  onReturnExternalInvoice?: (invoiceId: string, returnType: 'CORRECTION' | 'REUPLOAD', reason: string) => void;
  onSaveExternalInvoiceContractMatch?: (invoiceId: string, reason: string) => void;
  onConfirmExternalInvoiceSignature?: (invoiceId: string) => void;
  onApproveExternalInvoice?: (invoiceId: string, contractMatchReason?: string) => void;
  canCreateInvoice: boolean;
  canManageInvoice: boolean;
  canReviewMedia: boolean;
  canReviewFinance: boolean;
  canEditProjectResourceInvoice: (payout: Payout) => boolean;
  focusedInvoiceId: string | null;
  onFocusCleared: () => void;
  onMarkSigned: (record: GeneratedInvoiceRecord) => void;
  onReviewAction: (
    payout: Payout,
    action: InvoiceReviewAction,
    reason?: string,
  ) => void;
  onReplyFeedback: (payout: Payout, message: string) => void;
  onSendSignatureReminder: (payout: Payout, message: string, email: string) => boolean;
  onEditInvoice: (payout: Payout, context: InvoiceEditContext) => void;
  onOpenProject: (payout: Payout) => void;
  onOpenRequest: (payout: Payout) => void;
  onOpenPayment: (payout: Payout) => void;
  canExecutePayout: boolean;
  notify: Notify;
}) {
  const invoiceEntity = invoiceEntitySnapshot(defaultInvoiceBillingEntity(invoiceBillingSettings)!);
  const [search, setSearch] = useState('');
  const [selectedProjectKeys, setSelectedProjectKeys] = useState<string[]>([]);
  const [providerFilter, setProviderFilter] = useState<InvoiceManagementFilters['provider']>('all');
  const [statusFilter, setStatusFilter] = useState<InvoiceManagementFilters['status']>('all');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<InvoiceManagementFilters['invoiceType']>('all');
  const [draftSearch, setDraftSearch] = useState('');
  const [draftTypeFilter, setDraftTypeFilter] = useState<'all' | 'SINGLE' | 'BATCH'>('all');
  const [draftPendingDelete, setDraftPendingDelete] = useState<InvoiceCreationDraft | null>(null);
  const [selectedSourceKey, setSelectedSourceKey] = useState<string | null>(null);
  const [selectedExternalInvoiceId, setSelectedExternalInvoiceId] = useState<string | null>(null);
  const [showExternalCreate, setShowExternalCreate] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const draftRows = useMemo(() => creationDrafts.map((draft) => {
    const project = projects.find((candidate) => (
      String(candidate.cooperationProjectId ?? candidate.projectId ?? candidate.id) === String(draft.projectId)
    ));
    if (draft.kind === 'SINGLE') {
      const creator = creators.find((candidate) => candidate.id === draft.creatorId);
      return {
        draft,
        typeLabel: '单份 Invoice',
        creatorLabel: creator?.name ?? (draft.creatorId ? '达人档案已失效' : '待选择达人'),
        projectLabel: project?.name ?? (draft.projectId ? '项目已失效，请重新选择' : '待选择项目'),
        progressLabel: '尚未生成文件',
      };
    }
    const rowNames = new Map(draft.rows.map((row) => [row.creatorId, row.creatorName]));
    const creatorIds = draft.selectedCreatorIds?.length
      ? draft.selectedCreatorIds
      : draft.rows.map((row) => row.creatorId);
    const names = creatorIds.map((creatorId) => (
      rowNames.get(creatorId) ?? creators.find((candidate) => candidate.id === creatorId)?.name ?? '达人档案已失效'
    ));
    const generatedCount = invoiceBatchDraftGeneratedCount(draft);
    const totalCount = Math.max(draft.rows.length, creatorIds.length);
    return {
      draft,
      typeLabel: '批量 Invoice',
      creatorLabel: names.length
        ? `${names.slice(0, 2).join('、')}${names.length > 2 ? ` 等 ${names.length} 位` : ''}`
        : '待选择达人',
      projectLabel: project?.name ?? (draft.projectId ? '项目已失效，请重新选择' : '待选择项目'),
      progressLabel: `${generatedCount}/${totalCount} 已生成 · ${Math.max(0, totalCount - generatedCount)} 待生成`,
    };
  }), [creationDrafts, creators, projects]);
  const normalizedDraftSearch = draftSearch.trim().toLocaleLowerCase();
  const filteredDraftRows = draftRows.filter((row) => (
    (draftTypeFilter === 'all' || row.draft.kind === draftTypeFilter)
    && (!normalizedDraftSearch || (
      `${row.typeLabel} ${row.creatorLabel} ${row.projectLabel}`.toLocaleLowerCase().includes(normalizedDraftSearch)
    ))
  ));
  const draftPagination = usePagination(filteredDraftRows, {
    resetKey: `${draftSearch}:${draftTypeFilter}:${filteredDraftRows.map((row) => row.draft.draftId).join('|')}`,
  });
  const effectiveSourceKey = selectedSourceKey ?? (
    focusedInvoiceId
      ? focusedInvoiceId.startsWith('generated:') || focusedInvoiceId.startsWith('payout:')
        ? focusedInvoiceId
        : `payout:${focusedInvoiceId}`
      : null
  );
  const selectedPayout = effectiveSourceKey?.startsWith('payout:')
    ? payouts.find((payout) => payout.id === effectiveSourceKey.slice('payout:'.length)) ?? null
    : null;
  const selectedGenerated = effectiveSourceKey?.startsWith('generated:')
    ? generatedInvoices.find((record) => record.id === effectiveSourceKey.slice('generated:'.length)) ?? null
    : null;
  const selectedDetailPayout = selectedPayout
    ?? (selectedGenerated
      ? payouts.find((payout) => payout.id === selectedGenerated.sourcePayoutId) ?? null
      : null);
  const selectedSource: InvoiceDetailSource | null = selectedPayout
    ? {
        kind: 'payout',
        payout: selectedPayout,
        record: generatedInvoices.find((record) => record.sourcePayoutId === selectedPayout.id),
      }
    : selectedGenerated
      ? {
          kind: 'generated',
          record: selectedGenerated,
          payout: selectedDetailPayout ?? undefined,
        }
      : null;
  const selectedModelSnapshot = selectedPayout
    ? selectedPayout.invoiceSnapshot ?? buildInvoiceReviewModel(selectedPayout, creators, invoiceEntity)
    : selectedGenerated?.snapshot ?? null;
  const selectedModel = selectedModelSnapshot && selectedDetailPayout?.invoiceSignedAt
    ? {
        ...selectedModelSnapshot,
        signatureDate: selectedModelSnapshot.signatureDate
          ?? todayInputValue(new Date(selectedDetailPayout.invoiceSignedAt)),
        signatureText: selectedModelSnapshot.signatureText
          ?? buildMockElectronicSignature(selectedModelSnapshot.creatorName || selectedDetailPayout.creator),
      }
    : selectedModelSnapshot;
  const generatedInvoiceByPayoutId = useMemo(() => new Map(
    generatedInvoices.map((record) => [record.sourcePayoutId, record]),
  ), [generatedInvoices]);
  const managementViewFor = (payout: Payout): InvoiceManagementView => {
    const request = findInvoiceRequest(payout, generatedInvoices, requests);
    const returnContext = getInvoiceManagementReturnContext(
      payout,
      generatedInvoiceByPayoutId.get(payout.id)?.invoiceId,
      request,
    );
    return getInvoiceManagementView(payout, request, returnContext, {
      signed: hasInvoiceSignatureEvidence(payout, generatedInvoiceByPayoutId.get(payout.id)),
    });
  };
  const invoiceSnapshotFor = (payout: Payout) => (
    generatedInvoiceByPayoutId.get(payout.id)?.snapshot ?? payout.invoiceSnapshot
  );
  const invoiceIdentityFor = (payout: Payout) => {
    const snapshot = invoiceSnapshotFor(payout);
    return resolveInvoiceCreatorIdentity({
      creators,
      source: {
        creatorId: snapshot?.creatorId ?? payout.creatorId,
        creatorName: snapshot?.creatorName ?? payout.creator,
        creatorHandle: snapshot?.creatorHandle ?? payout.handle,
        creatorSocialAccountId: snapshot?.creatorSocialAccountId ?? payout.creatorSocialAccountId,
        creatorPlatform: snapshot?.creatorPlatform ?? payout.creatorPlatform,
        initials: payout.initials,
        accent: payout.accent,
      },
    });
  };
  const canActOnInvoice = (payout: Payout, view: InvoiceManagementView) => (
    (payout.invoiceReviewStatus === '达人反馈' && canManageInvoice)
    || (
      view.tab === 'review'
      &&
      (payout.invoiceReviewStatus === '待媒介审核' || payout.invoiceReviewStatus === '待媒介复核')
      && canReviewMedia
    )
  );
  const externalCollectionInvoiceIds = new Set(externalInvoices.map((record) => record.invoiceId));
  const externalCollectionPayoutIds = new Set(generatedInvoices.filter((record) => (
    record.invoiceType === 'EXTERNAL' && externalCollectionInvoiceIds.has(record.invoiceId)
  )).map((record) => record.sourcePayoutId));
  const internalRows: InvoiceManagementRow[] = payouts.filter((payout) => (
    !externalCollectionPayoutIds.has(payout.id)
  )).map((payout) => {
    const generated = generatedInvoiceByPayoutId.get(payout.id);
    const snapshot = invoiceSnapshotFor(payout);
    const identity = invoiceIdentityFor(payout);
    const request = findInvoiceRequest(payout, generatedInvoices, requests);
    const returnContext = getInvoiceManagementReturnContext(payout, generated?.invoiceId, request);
    const view = getInvoiceManagementView(payout, request, returnContext, {
      signed: hasInvoiceSignatureEvidence(payout, generated),
    });
    const canAct = canActOnInvoice(payout, view);
    const actionLabel = view.status === '已退回'
      ? '查看详情'
      : payout.invoiceReviewStatus === '草稿'
      ? '查看详情'
      : canAct
      ? payout.invoiceReviewStatus === '达人反馈'
        ? '查看详情'
        : payout.invoiceReviewStatus === '待媒介复核'
          ? '复核'
          : '审核'
      : '查看详情';
    return {
      rowId: `payout:${payout.id}`,
      invoiceId: String(generated?.invoiceId ?? payout.id),
      invoiceType: generated?.invoiceType ?? 'INTERNAL',
      creatorName: identity.displayName,
      channelId: identity.channelId,
      creatorPlatform: identity.platform,
      creatorSocialAccounts: identity.socialAccounts,
      issuerName: creators.find((creator) => creator.id === snapshot?.creatorId)?.contact?.legalName
        ?? snapshot?.from.legalName
        ?? '待补充',
      initials: identity.initials,
      accent: identity.accent ?? payout.accent,
      projectKey: String(snapshot?.projectId ?? payout.projectId ?? snapshot?.projectName ?? payout.project),
      projectName: snapshot?.projectName ?? payout.project,
      invoiceNumber: snapshot?.invoiceNumber ?? payout.invoice,
      provider: payout.provider,
      status: view.status,
      currency: payout.currency,
      amount: payout.amount,
      actionLabel,
      primaryAction: (
        view.status !== '已退回'
        && canAct
        && payout.invoiceReviewStatus !== '达人反馈'
      ) || (payout.invoiceReviewStatus === '草稿' && canManageInvoice),
      source: { kind: 'payout' as const, payout },
      returnReason: returnContext?.reason,
      returnSourceLabel: returnContext?.sourceLabel,
      additionalActionLabel: view.tab === 'signature' && canManageInvoice && payout.invoiceReviewStatus === '待签署'
        ? '模拟达人完成签署'
        : undefined,
    };
  });
  const externalRows: InvoiceManagementRow[] = externalInvoices.map((record) => {
    const identity = resolveInvoiceCreatorIdentity({
      creators,
      source: {
        creatorId: record.creatorId,
        creatorName: record.creatorName,
        creatorHandle: record.creatorHandle,
        creatorSocialAccountId: record.creatorSocialAccountId,
        creatorPlatform: record.creatorPlatform,
      },
    });
    const creator = identity.creator;
    const status = externalInvoiceListStatus(record.status);
    const primaryAction = (record.status === 'WAITING_MEDIA_REVIEW' && canReviewMedia)
      || (record.status !== 'APPROVED' && record.status !== 'WAITING_MEDIA_REVIEW' && canManageInvoice);
    return {
      rowId: `external:${record.invoiceId}`,
      invoiceId: String(record.invoiceId),
      invoiceType: 'EXTERNAL',
      creatorName: identity.displayName,
      channelId: identity.channelId,
      creatorPlatform: identity.platform,
      creatorSocialAccounts: identity.socialAccounts,
      initials: identity.initials,
      accent: identity.accent ?? '#9c6f93',
      issuerName: creator?.contact.legalName ?? '待补充',
      projectKey: String(record.projectId ?? record.projectName),
      projectName: record.projectName,
      invoiceNumber: externalInvoicePageTab(record.status) === 'upload'
        ? '待生成'
        : record.invoiceNumber ?? '待生成',
      provider: externalInvoicePayoutProvider(record, creator),
      status: record.status === 'APPROVED' ? '待发起请款' : status,
      currency: record.expected.currency,
      amount: record.expected.amount,
      actionLabel: record.status === 'DRAFT'
        ? '发布任务'
        : record.status === 'WAITING_MEDIA_REVIEW'
          ? '审核'
          : record.status === 'APPROVED'
            ? '查看详情'
            : status === '待重新上传'
              ? '继续处理'
              : '查看任务',
      primaryAction,
      source: { kind: 'external' as const, externalInvoiceId: String(record.invoiceId) },
    };
  });
  const groupedRows: Record<InvoicePageTab, InvoiceManagementRow[]> = {
    drafts: [],
    signature: [],
    upload: [],
    review: [],
    approved: [],
    returned: [],
  };
  externalRows.forEach((row) => {
    const record = externalInvoices.find((candidate) => String(candidate.invoiceId) === row.invoiceId);
    if (record) groupedRows[externalInvoicePageTab(record.status)].push(row);
  });
  internalRows.forEach((row) => {
    if (row.source.kind === 'payout') groupedRows[managementViewFor(row.source.payout).tab].push(row);
  });
  const invoiceOverview = {
    total: internalRows.length + externalRows.length,
    internal: internalRows.length,
    external: externalRows.length,
    creatorPending: groupedRows.signature.length + groupedRows.upload.length,
    reviewPending: groupedRows.review.length + groupedRows.returned.length,
    approved: groupedRows.approved.length,
    readyForRequest: groupedRows.approved.filter((row) => row.status === '待发起请款').length,
  };
  const currentTabRows = groupedRows[tab];
  const projectCounts = new Map<string, { label: string; count: number }>();
  currentTabRows.forEach((row) => {
    const current = projectCounts.get(row.projectKey);
    projectCounts.set(row.projectKey, {
      label: row.projectName,
      count: (current?.count ?? 0) + 1,
    });
  });
  const projectFilterOptions: SearchableMultiFilterOption[] = [...projectCounts.entries()]
    .map(([value, project]) => ({
      value,
      label: project.label,
      description: `${project.count} 个 Invoice`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
  const validProjectKeys = new Set(projectFilterOptions.map((option) => option.value));
  const effectiveProjectKeys = selectedProjectKeys.filter((projectKey) => validProjectKeys.has(projectKey));
  const effectiveStatusFilter = statusFilter === 'all'
    || INVOICE_MANAGEMENT_STATUSES_BY_TAB[tab].includes(statusFilter)
    ? statusFilter
    : 'all';
  const showInvoiceTypeFilter = invoiceTypeFilterVisible(tab);
  const statusFilterOptions: SelectOption<InvoiceManagementFilters['status']>[] = [
    { value: 'all', label: '全部状态' },
    ...INVOICE_MANAGEMENT_STATUSES_BY_TAB[tab].map((status) => ({ value: status, label: status })),
  ];
  const visibleRows = filterInvoiceManagementRows(currentTabRows, {
    search,
    projectKeys: effectiveProjectKeys,
    provider: providerFilter,
    status: effectiveStatusFilter,
    invoiceType: showInvoiceTypeFilter ? invoiceTypeFilter : 'all',
  });
  const hasActiveFilters = Boolean(
    search.trim()
    || effectiveProjectKeys.length
    || providerFilter !== 'all'
    || effectiveStatusFilter !== 'all'
    || (showInvoiceTypeFilter && invoiceTypeFilter !== 'all')
  );

  const resetInvoiceFilters = () => {
    setSearch('');
    setSelectedProjectKeys([]);
    setProviderFilter('all');
    setStatusFilter('all');
    setInvoiceTypeFilter('all');
  };

  useEffect(() => {
    setSelectedProjectKeys([]);
    setProviderFilter('all');
    setStatusFilter('all');
    setInvoiceTypeFilter('all');
  }, [tab]);
  useEffect(() => {
    setSelectedRowIds(new Set());
  }, [invoiceTypeFilter, providerFilter, search, selectedProjectKeys, statusFilter, tab]);
  const selectionEnabled = tab === 'signature' || tab === 'upload';
  const selectableRowIds = new Set(visibleRows.filter((row) => (
    (tab === 'signature' && row.invoiceType === 'INTERNAL' && row.status === '待发布')
    || (tab === 'upload' && row.invoiceType === 'EXTERNAL' && row.status === '待发布')
  )).map((row) => row.rowId));
  const selectedPublishRows = visibleRows.filter((row) => selectedRowIds.has(row.rowId));

  const publishSelectedRows = () => {
    if (!selectedPublishRows.length) return;
    const invoiceIds = selectedPublishRows.map((row) => row.invoiceId);
    const published = tab === 'signature'
      ? onPublishGeneratedInvoices(invoiceIds)
      : onPublishExternalInvoices(invoiceIds);
    if (published) setSelectedRowIds(new Set());
  };
  const selectedExternalInvoice = externalInvoices.find((record) => (
    String(record.invoiceId) === selectedExternalInvoiceId
  ));

  const openReviewInvoice = (payout: Payout) => {
    const generated = generatedInvoices.find((record) => record.sourcePayoutId === payout.id);
    setSelectedSourceKey(generated ? `generated:${generated.id}` : `payout:${payout.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeInvoiceDetail = () => {
    setSelectedSourceKey(null);
    onFocusCleared();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openInvoiceRow = (row: InvoiceManagementRow) => {
    if (row.source.kind === 'external') {
      setSelectedExternalInvoiceId(row.source.externalInvoiceId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    openReviewInvoice(row.source.payout);
  };

  const markSignedAndOpenReview = (record: GeneratedInvoiceRecord) => {
    setSelectedSourceKey(`payout:${record.sourcePayoutId}`);
    onMarkSigned(record);
  };

  const simulateCreatorSignature = (payout: Payout) => {
    const record = generatedInvoices.find((candidate) => candidate.sourcePayoutId === payout.id);
    if (!record) {
      setSelectedSourceKey(`payout:${payout.id}`);
      onReviewAction(payout, 'MARK_SIGNED');
      return;
    }
    onMarkSigned(record);
  };

  const selectedManagementView = selectedDetailPayout
    ? managementViewFor(selectedDetailPayout)
    : undefined;
  const selectedRequest = selectedDetailPayout
    ? findInvoiceRequest(selectedDetailPayout, generatedInvoices, requests)
    : undefined;

  if (showExternalCreate) {
    return (
      <ExternalInvoiceCollectionCreatePage
        projects={creationProjects}
        creators={creators}
        contracts={contracts}
        invoiceBillingSettings={invoiceBillingSettings}
        onCreate={(input, publish) => {
          onCreateExternalInvoice(input, publish);
          setShowExternalCreate(false);
        }}
        onBack={() => setShowExternalCreate(false)}
      />
    );
  }

  if (selectedExternalInvoice) {
    return (
      <ExternalInvoiceCollectionDetailPage
        record={selectedExternalInvoice}
        creator={creators.find((creator) => creator.id === selectedExternalInvoice.creatorId)}
        contracts={contracts}
        canManage={canManageInvoice}
        canReview={canReviewMedia}
        onPublish={() => onPublishExternalInvoice(String(selectedExternalInvoice.invoiceId))}
        onSimulateUpload={(scenario, payoutAccountId, invoiceDate) => onSimulateExternalUpload(
          String(selectedExternalInvoice.invoiceId),
          scenario,
          payoutAccountId,
          invoiceDate,
        )}
        onCorrect={(fieldKey, value) => onCorrectExternalRecognition(
          String(selectedExternalInvoice.invoiceId),
          fieldKey,
          value,
        )}
        onSubmit={() => onSubmitExternalInvoice(String(selectedExternalInvoice.invoiceId))}
        onReviewField={(fieldKey, decision, note) => onReviewExternalInvoiceField(
          String(selectedExternalInvoice.invoiceId),
          fieldKey,
          decision,
          note,
        )}
        onReturn={(returnType, reason) => onReturnExternalInvoice(
          String(selectedExternalInvoice.invoiceId),
          returnType,
          reason,
        )}
        onConfirmInvoiceSignature={() => onConfirmExternalInvoiceSignature(String(selectedExternalInvoice.invoiceId))}
        onApprove={(contractMatchReason) => onApproveExternalInvoice(String(selectedExternalInvoice.invoiceId), contractMatchReason)}
        onSaveReviewProgress={(contractMatchReason) => onSaveExternalInvoiceContractMatch(
          String(selectedExternalInvoice.invoiceId),
          contractMatchReason,
        )}
        onBack={() => {
          setSelectedExternalInvoiceId(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  if (selectedSource && selectedModel) {
    return (
      <InvoiceDetailPage
        source={selectedSource}
        model={selectedModel}
        contracts={contracts}
        notify={notify}
        onMarkSigned={markSignedAndOpenReview}
        onReviewAction={onReviewAction}
        onReplyFeedback={onReplyFeedback}
        onSendSignatureReminder={onSendSignatureReminder}
        onPublishDraft={(record) => onPublishGeneratedInvoices([String(record.invoiceId)])}
        onWithdrawDraft={(record) => onWithdrawGeneratedInvoice(String(record.invoiceId))}
        onEditInvoice={onEditInvoice}
        onOpenProject={onOpenProject}
        onOpenRequest={onOpenRequest}
        onOpenPayment={onOpenPayment}
        canManageInvoice={canManageInvoice}
        canReviewMedia={canReviewMedia}
        canReviewFinance={canReviewFinance}
        canEditProjectResource={Boolean(
          selectedDetailPayout && canEditProjectResourceInvoice(selectedDetailPayout)
        )}
        canExecutePayout={canExecutePayout}
        managementView={selectedManagementView}
        request={selectedRequest}
        onBack={closeInvoiceDetail}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        title="Invoice 管理"
        subtitle="生成、下载并审核达人 Invoice，核对合同主体与收款信息。"
        actions={canCreateInvoice ? (
          <>
            <Button variant="secondary" icon={<Send size={17} />} onClick={() => setShowExternalCreate(true)}>发起外部 Invoice 收集</Button>
            <Button variant="secondary" icon={<Files size={17} />} onClick={onCreateBatchInvoice}>批量生成 Invoice</Button>
            <Button icon={<Plus size={17} />} onClick={onCreateInvoice}>生成 Invoice</Button>
          </>
        ) : undefined}
      />
      <section className="invoice-overview-strip" aria-label="Invoice 概览">
        <article className="invoice-overview-card invoice-overview-card-peach">
          <span>Invoice 总数</span>
          <strong>{invoiceOverview.total}</strong>
          <small>{invoiceOverview.internal} 内部 · {invoiceOverview.external} 外部</small>
        </article>
        <article className="invoice-overview-card invoice-overview-card-mint">
          <span>待达人处理</span>
          <strong>{invoiceOverview.creatorPending}</strong>
          <small>{groupedRows.signature.length} 待签署 · {groupedRows.upload.length} 待回收</small>
        </article>
        <article className="invoice-overview-card invoice-overview-card-amber">
          <span>待内部处理</span>
          <strong>{invoiceOverview.reviewPending}</strong>
          <small>{groupedRows.review.length} 待审核 · {groupedRows.returned.length} 已退回</small>
        </article>
        <article className="invoice-overview-card invoice-overview-card-lilac">
          <span>已通过 Invoice</span>
          <strong>{invoiceOverview.approved}</strong>
          <small>{invoiceOverview.readyForRequest} 待发起请款 · {invoiceOverview.approved - invoiceOverview.readyForRequest} 已进入后续流程</small>
        </article>
      </section>
      <section className="content-card">
        <div className="tabs-row">
          <button className={`tab-button ${tab === 'drafts' ? 'tab-active' : ''}`} type="button" onClick={() => onTabChange('drafts')}>草稿箱 <span>{creationDrafts.length}</span></button>
          <button className={`tab-button ${tab === 'signature' ? 'tab-active' : ''}`} type="button" onClick={() => onTabChange('signature')}>待签署 <span>{groupedRows.signature.length}</span></button>
          <button className={`tab-button ${tab === 'upload' ? 'tab-active' : ''}`} type="button" onClick={() => onTabChange('upload')}>待回收 <span>{groupedRows.upload.length}</span></button>
          <button className={`tab-button ${tab === 'review' ? 'tab-active' : ''}`} type="button" onClick={() => onTabChange('review')}>待审核 <span>{groupedRows.review.length}</span></button>
          <button className={`tab-button ${tab === 'approved' ? 'tab-active' : ''}`} type="button" onClick={() => onTabChange('approved')}>已通过 <span>{groupedRows.approved.length}</span></button>
          <button className={`tab-button ${tab === 'returned' ? 'tab-active' : ''}`} type="button" onClick={() => onTabChange('returned')}>已退回 <span>{groupedRows.returned.length}</span></button>
        </div>
        {tab === 'drafts' ? (
          <div className="invoice-creation-drafts" aria-label="Invoice 生成中草稿">
            <div className="invoice-creation-draft-toolbar">
              <div className="project-filter-field invoice-creation-draft-search">
                <span className="project-filter-field-label">搜索</span>
                <SearchBar value={draftSearch} onChange={setDraftSearch} placeholder="搜索达人或关联项目" />
              </div>
              <div className="project-filter-field invoice-creation-draft-type-filter">
                <span className="project-filter-field-label">草稿类型</span>
                <SelectField
                  ariaLabel="Invoice 草稿类型筛选"
                  variant="form"
                  value={draftTypeFilter}
                  options={[
                    { value: 'all', label: '全部类型' },
                    { value: 'SINGLE', label: '单份 Invoice' },
                    { value: 'BATCH', label: '批量 Invoice' },
                  ]}
                  onChange={setDraftTypeFilter}
                />
              </div>
              <span className="invoice-creation-draft-count">已显示 <strong>{filteredDraftRows.length}</strong> / {creationDrafts.length} 条</span>
            </div>
            <div className="table-shell invoice-creation-draft-table-shell">
              <div className="table-scroll">
                <table className="data-table invoice-creation-draft-table">
                  <thead><tr><th>草稿类型</th><th>达人</th><th>关联项目</th><th>生成进度</th><th>最近编辑时间</th><th className="action-cell">操作</th></tr></thead>
                  <tbody>
                    {draftPagination.pageItems.length ? draftPagination.pageItems.map((row) => (
                      <tr key={row.draft.draftId} data-draft-id={row.draft.draftId}>
                        <td><span className={`invoice-creation-draft-kind is-${row.draft.kind.toLowerCase()}`}>{row.typeLabel}</span></td>
                        <td><strong className="invoice-creation-draft-creator">{row.creatorLabel}</strong></td>
                        <td><span className="invoice-creation-draft-project">{row.projectLabel}</span></td>
                        <td><span className="invoice-creation-draft-progress">{row.progressLabel}</span></td>
                        <td><time dateTime={row.draft.updatedAt}>{formatInvoiceCreationDraftTime(row.draft.updatedAt)}</time></td>
                        <td className="action-cell">
                          <div className="table-action-group">
                            <ListActionButton kind="edit" onClick={() => onResumeCreationDraft(row.draft)}>继续编辑</ListActionButton>
                            <ListActionButton kind="danger" onClick={() => setDraftPendingDelete(row.draft)}>删除</ListActionButton>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6}><div className="invoice-creation-draft-empty">
                        <FileText size={28} />
                        <strong>{creationDrafts.length ? '没有符合筛选条件的草稿' : '暂无生成中草稿'}</strong>
                        <small>只有尚未完成文件生成的单份或批量 Invoice 会显示在这里。</small>
                        {!creationDrafts.length && canCreateInvoice ? <div><Button variant="secondary" onClick={onCreateBatchInvoice}>批量生成</Button><Button onClick={onCreateInvoice}>生成 Invoice</Button></div> : null}
                      </div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <span>共 {filteredDraftRows.length} 条</span>
                <Pagination
                  ariaLabel="Invoice 草稿箱分页"
                  page={draftPagination.page}
                  pageSize={draftPagination.pageSize}
                  total={filteredDraftRows.length}
                  onPageChange={draftPagination.setPage}
                  onPageSizeChange={draftPagination.setPageSize}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
        <div className="invoice-list-filter-panel" aria-label="Invoice 列表筛选">
          <div className="invoice-list-filter-fields">
            <div className="project-filter-field invoice-list-filter-search">
              <span className="project-filter-field-label">搜索</span>
              <SearchBar value={search} onChange={setSearch} placeholder={tab === 'signature' ? '搜索待签署 Invoice、达人或项目' : '搜索 Invoice 或达人'} />
            </div>
            <SearchableMultiFilter
              className="invoice-list-filter-project"
              label="关联项目"
              placeholder="全部关联项目"
              searchPlaceholder="搜索关联项目"
              options={projectFilterOptions}
              selected={effectiveProjectKeys}
              onChange={setSelectedProjectKeys}
            />
            <div className="project-filter-field invoice-list-filter-provider">
              <span className="project-filter-field-label">付款渠道</span>
              <SelectField
                ariaLabel="付款渠道筛选"
                variant="form"
                menuStrategy="fixed"
                value={providerFilter}
                options={INVOICE_PROVIDER_FILTER_OPTIONS}
                onChange={setProviderFilter}
              />
            </div>
            <div className="project-filter-field invoice-list-filter-status">
              <span className="project-filter-field-label">状态</span>
              <SelectField
                ariaLabel="Invoice 状态筛选"
                variant="form"
                menuStrategy="fixed"
                value={effectiveStatusFilter}
                options={statusFilterOptions}
                onChange={setStatusFilter}
              />
            </div>
            {showInvoiceTypeFilter ? (
              <div className="project-filter-field invoice-list-filter-type">
                <span className="project-filter-field-label">Invoice 类型</span>
                <SelectField
                  ariaLabel="Invoice 类型筛选"
                  variant="form"
                  menuStrategy="fixed"
                  value={invoiceTypeFilter}
                  options={INVOICE_TYPE_FILTER_OPTIONS}
                  onChange={setInvoiceTypeFilter}
                />
              </div>
            ) : null}
          </div>
          <div className="invoice-list-filter-footer">
            <div className="invoice-list-filter-summary">
              <span>已显示 <strong>{visibleRows.length}</strong> / {currentTabRows.length} 条</span>
              {hasActiveFilters ? (
                <button type="button" onClick={resetInvoiceFilters}><X size={13} />重置筛选</button>
              ) : null}
            </div>
            <div className="invoice-list-toolbar-actions">
              <span className="toolbar-note"><FileCheck2 size={16} /> {tab === 'approved' ? 'OA 审批操作统一在请款项目详情完成' : '列表、详情和审核记录使用同一生命周期'}</span>
              {selectionEnabled ? (
                <Button
                  icon={<Send size={16} />}
                  disabled={!selectedPublishRows.length}
                  disabledReason="请先选择需要发布的 Invoice。"
                  onClick={publishSelectedRows}
                >
                  一键发布{selectedPublishRows.length ? `（${selectedPublishRows.length}）` : ''}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <InvoiceManagementTable
          rows={visibleRows}
          onSelect={openInvoiceRow}
          emptyText="当前筛选条件下没有 Invoice 记录"
          additionalActionIcon={<CheckCircle2 size={15} />}
          selectableRowIds={selectionEnabled ? selectableRowIds : undefined}
          selectedRowIds={selectionEnabled ? selectedRowIds : undefined}
          onSelectionChange={selectionEnabled ? setSelectedRowIds : undefined}
          onAdditionalAction={(row) => {
            if (row.source.kind === 'payout') simulateCreatorSignature(row.source.payout);
          }}
        />
          </>
        )}
      </section>
      {draftPendingDelete ? (
        <Modal
          title="删除 Invoice 草稿"
          width="460px"
          onClose={() => setDraftPendingDelete(null)}
          footer={<><Button variant="secondary" onClick={() => setDraftPendingDelete(null)}>取消</Button><Button variant="danger" onClick={() => { onDeleteCreationDraft(draftPendingDelete.draftId); setDraftPendingDelete(null); }}>确认删除</Button></>}
        >
          <div className="invoice-creation-draft-delete-copy">
            <span><Trash2 size={22} /></span>
            <div><strong>删除后无法继续恢复这份表单</strong><p>{draftPendingDelete.kind === 'BATCH' ? '本次批量生成中尚未完成的内容会被移除；已经生成的 Invoice 仍保留在待签署页签。' : '该单份 Invoice 未完成内容会从当前账号的本地草稿箱中删除。'}</p></div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export type PaymentBatchRow = {
  paymentBatchId: PaymentBatchRecord['paymentBatchId'];
  id: string;
  purpose: PaymentBatchPurpose;
  sourcePaymentBatchCode?: string;
  requestCode: string;
  provider: string;
  paymentEntity: string;
  projectName: string;
  paymentAmount: string;
  transferFeeAmount: string;
  actualPaidAmount: string;
  initiator: string;
  payer: string;
  paidAt: string;
  status: PaymentBatchStatus;
};

export type PaymentBatchPurposeFilter = 'all' | PaymentBatchPurpose;
export type PaymentBatchStatusFilter = typeof ALL_PAYMENT_STATUSES | PaymentBatchStatus;

export type PaymentBatchFilters = {
  search: string;
  start: string;
  end: string;
  provider: string;
  purpose?: PaymentBatchPurposeFilter;
  status?: PaymentBatchStatusFilter;
};

export const PAYMENT_BATCH_PURPOSE_FILTER_OPTIONS = [
  { value: 'all', label: '全部批次用途' },
  { value: 'NORMAL', label: '正常付款' },
  { value: 'REVERSAL', label: '冲退付款' },
  { value: 'RETRY', label: '重新付款' },
] as const satisfies ReadonlyArray<{ value: PaymentBatchPurposeFilter; label: string }>;

export const PAYMENT_BATCH_STATUS_FILTER_OPTIONS = [
  { value: ALL_PAYMENT_STATUSES, label: ALL_PAYMENT_STATUSES },
  { value: '付款处理中', label: '付款处理中' },
  { value: '已付款', label: '已付款' },
  { value: '部分失败', label: '部分失败' },
  { value: '全部失败', label: '全部失败' },
  { value: '冲退处理中', label: '冲退处理中' },
  { value: '已冲退', label: '已冲退' },
  { value: '冲退失败', label: '冲退失败' },
] as const satisfies ReadonlyArray<{ value: PaymentBatchStatusFilter; label: string }>;

const PAYMENT_CONFIRMATION_ASSET_PATH = '/export-assets/airwallex/airwallex付款单-支付确认函.pdf';
export const PAYMENT_CONFIRMATION_FILENAME = 'airwallex付款单-支付确认函.pdf';

export const paymentBatchRows = (
  batches: readonly PaymentBatchRecord[],
): PaymentBatchRow[] => (
  batches.map((batch) => {
    const financialSummary = paymentBatchFinancialSummary(batch);
    const resultPending = batch.status === '付款处理中' || batch.status === '冲退处理中';
    return {
      paymentBatchId: batch.paymentBatchId,
      id: batch.paymentBatchCode,
      purpose: batch.purpose,
      sourcePaymentBatchCode: batch.sourcePaymentBatchCode,
      requestCode: batch.request.requestCode,
      provider: batch.provider,
      paymentEntity: batch.request.paymentEntity || '待补充',
      projectName: batch.request.cooperationProjectName,
      paymentAmount: paymentBatchAmountLabel(batch),
      transferFeeAmount: resultPending
        ? '待渠道回写'
        : paymentBatchMoneyTotalsLabel(financialSummary.transferFeeAmounts),
      actualPaidAmount: resultPending
        ? '待渠道回写'
        : paymentBatchMoneyTotalsLabel(financialSummary.actualPaidAmounts),
      initiator: batch.request.media || '待补充',
      payer: batch.payer,
      paidAt: batch.paidAt,
      status: batch.status,
    };
  })
);

type ExportAssetLoader = (path: string) => Promise<Blob>;

const loadExportAsset: ExportAssetLoader = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to read export asset: ${response.status}`);
  return response.blob();
};

export const filterPaymentBatchRows = (
  rows: PaymentBatchRow[],
  filters: PaymentBatchFilters,
) => {
  const query = filters.search.trim().toLowerCase();
  return rows.filter((row) => (
    (!query || row.id.toLowerCase().includes(query))
    && (!filters.start || row.paidAt >= filters.start)
    && (!filters.end || row.paidAt <= filters.end)
    && (filters.provider === 'all' || row.provider === filters.provider)
    && (!filters.purpose || filters.purpose === 'all' || row.purpose === filters.purpose)
    && (!filters.status || filters.status === ALL_PAYMENT_STATUSES || row.status === filters.status)
  ));
};

export const correctedPaymentBatchDateRange = (
  start: string,
  end: string,
  changed: 'start' | 'end',
): [string, string] => {
  if (!start || !end || start <= end) return [start, end];
  return changed === 'start' ? [start, start] : [end, end];
};

export const toggleVisiblePaymentBatchSelection = (
  selectedIds: Set<string>,
  visibleRows: PaymentBatchRow[],
) => {
  const next = new Set(selectedIds);
  const visibleIds = visibleRows.map((row) => row.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id));
  visibleIds.forEach((id) => {
    if (allSelected) next.delete(id);
    else next.add(id);
  });
  return next;
};

export const paymentBatchExportAvailability = (selectedRows: PaymentBatchRow[]) => ({
  confirmations: selectedRows.some((row) => row.provider === 'Airwallex'),
  records: selectedRows.length > 0,
});

export const createBatchConfirmationArchive = async (
  batchIds: string[],
  loadAsset: ExportAssetLoader = loadExportAsset,
) => {
  const [{ default: JSZip }, template] = await Promise.all([
    import('jszip'),
    loadAsset(PAYMENT_CONFIRMATION_ASSET_PATH),
  ]);
  const bytes = new Uint8Array(await template.arrayBuffer());
  const zip = new JSZip();
  batchIds.forEach((batchId) => {
    zip.folder(batchId)?.file(PAYMENT_CONFIRMATION_FILENAME, bytes);
  });
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
};

const displayPaymentBatchTime = (value: string) => value.replace('T', ' ');

const paymentBatchStatusTone = (status: PaymentBatchStatus) => {
  if (status === '部分失败' || status === '全部失败' || status === '冲退失败') return 'is-danger';
  if (status === '付款处理中' || status === '冲退处理中') return 'is-processing';
  return 'is-success';
};

export const paymentBatchCurrentRequestStatus = (
  batch: PaymentBatchRecord,
  requests: readonly RequestProjectSummary[],
  payouts: readonly Payout[],
) => {
  const request = requests.find((candidate) => (
    candidate.paymentRequestProjectId === batch.request.paymentRequestProjectId
  ));
  if (!request) return batch.request.requestStatus || '待同步';
  return requestProjectStatusFor(request, [...payouts])
    ?? myProjectStatusFor(request)
    ?? batch.request.requestStatus
    ?? '待同步';
};

export function BatchesPage({
  batches,
  payouts = [],
  creators = [],
  requests = [],
  onNewBatch,
  notify,
  canCreateBatch,
  focusedBatchId,
  onReturnPayout,
  onOpenFailurePaymentList,
}: {
  batches: readonly PaymentBatchRecord[];
  payouts?: readonly Payout[];
  creators?: readonly CreatorProfile[];
  requests?: readonly RequestProjectSummary[];
  onNewBatch: () => void;
  notify: Notify;
  canCreateBatch: boolean;
  focusedBatchId?: string | null;
  onReturnPayout?: (payout: Payout, issueType: PaymentFailureIssueType, reason: string) => boolean;
  onOpenFailurePaymentList?: (requestId: string, payoutId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [provider, setProvider] = useState('all');
  const [purpose, setPurpose] = useState<PaymentBatchPurposeFilter>('all');
  const [paymentStatus, setPaymentStatus] = useState<PaymentBatchStatusFilter>(ALL_PAYMENT_STATUSES);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectedBatchId, setSelectedBatchId] = useState<PaymentBatchRecord['paymentBatchId'] | null>(null);
  const [exporting, setExporting] = useState<'confirmations' | 'records' | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const detailTriggerRefs = useRef(new Map<PaymentBatchRecord['paymentBatchId'], HTMLButtonElement>());
  const listScrollPositionRef = useRef(0);
  const rows = useMemo(() => paymentBatchRows(batches), [batches]);
  const filteredRows = useMemo(() => filterPaymentBatchRows(rows, {
    search,
    start,
    end,
    provider,
    purpose,
    status: paymentStatus,
  }), [end, paymentStatus, provider, purpose, rows, search, start]);
  const {
    page: batchPage,
    pageItems: visibleRows,
    pageSize: batchPageSize,
    setPage: setBatchPage,
    setPageSize: setBatchPageSize,
  } = usePagination(filteredRows, { resetKey: `${search}\u0000${start}\u0000${end}\u0000${provider}\u0000${purpose}\u0000${paymentStatus}` });
  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  const selectedBatches = batches.filter((batch) => selectedIds.has(batch.paymentBatchCode));
  const selectedAirwallexRows = selectedRows.filter((row) => row.provider === 'Airwallex');
  const selectedVisibleCount = filteredRows.filter((row) => selectedIds.has(row.id)).length;
  const allVisibleSelected = filteredRows.length > 0 && selectedVisibleCount === filteredRows.length;
  const exportAvailability = paymentBatchExportAvailability(selectedRows);
  const selectedBatch = batches.find((batch) => batch.paymentBatchId === selectedBatchId);
  const batchMetrics = useMemo(() => {
    const totals = batches.filter((batch) => batch.purpose !== 'REVERSAL').reduce((result, batch) => {
      const counts = paymentBatchStatusCounts(batch);
      return {
        succeeded: result.succeeded + counts.succeeded,
        failed: result.failed + counts.failed,
        processing: result.processing + counts.processing,
      };
    }, { succeeded: 0, failed: 0, processing: 0 });
    const total = totals.succeeded + totals.failed + totals.processing;
    return {
      ...totals,
      processingBatches: batches.filter((batch) => batch.purpose !== 'REVERSAL' && paymentBatchStatusCounts(batch).processing > 0).length,
      paidBatches: batches.filter((batch) => batch.purpose !== 'REVERSAL' && batch.status === '已付款').length,
      paidBatchItems: batches
        .filter((batch) => batch.purpose !== 'REVERSAL' && batch.status === '已付款')
        .reduce((count, batch) => count + batch.items.length, 0),
      successRate: total ? `${((totals.succeeded / total) * 100).toFixed(1)}%` : '—',
      total,
    };
  }, [batches]);

  useEffect(() => {
    if (!focusedBatchId) return;
    const focusedBatch = batches.find((batch) => (
      batch.paymentBatchId === focusedBatchId || batch.paymentBatchCode === focusedBatchId
    ));
    if (!focusedBatch) return;
    listScrollPositionRef.current = window.scrollY;
    setSelectedBatchId(focusedBatch.paymentBatchId);
  }, [batches, focusedBatchId]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected;
    }
  }, [allVisibleSelected, selectedVisibleCount]);

  const updateStart = (value: string) => {
    const [nextStart, nextEnd] = correctedPaymentBatchDateRange(value, end, 'start');
    setStart(nextStart);
    setEnd(nextEnd);
  };
  const updateEnd = (value: string) => {
    const [nextStart, nextEnd] = correctedPaymentBatchDateRange(start, value, 'end');
    setStart(nextStart);
    setEnd(nextEnd);
  };
  const toggleOne = (batchId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };
  const exportConfirmations = async () => {
    if (!exportAvailability.confirmations || exporting !== null) return;
    setExporting('confirmations');
    try {
      const archive = await createBatchConfirmationArchive(selectedAirwallexRows.map((row) => row.id));
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadBlob(archive, `付款批次确认函-${date}.zip`);
      notify('确认函已导出', `已为 ${selectedAirwallexRows.length} 个 Airwallex 批次生成确认函压缩包。`);
    } catch {
      notify('确认函导出失败', '无法读取付款确认函模板，请检查导出资源后重试。');
    } finally {
      setExporting(null);
    }
  };
  const exportPaymentData = async () => {
    if (!exportAvailability.records || exporting !== null) return;
    setExporting('records');
    try {
      const workbook = await createPaymentBatchWorkbook(selectedBatches.map((batch) => ({
        batch,
        currentRequestStatus: paymentBatchCurrentRequestStatus(batch, requests, payouts),
      })));
      const filename = paymentBatchWorkbookFilename();
      downloadBlob(workbook, filename);
      notify('付款明细已导出', `已导出 ${selectedBatches.length} 个付款批次。`);
    } catch {
      notify('付款明细导出失败', '无法生成付款批次明细 Excel，请稍后重试。');
    } finally {
      setExporting(null);
    }
  };
  const openBatchDetail = (batchId: PaymentBatchRecord['paymentBatchId']) => {
    listScrollPositionRef.current = window.scrollY;
    setSelectedBatchId(batchId);
  };
  const closeBatchDetail = () => {
    const batchId = selectedBatchId;
    setSelectedBatchId(null);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: listScrollPositionRef.current, behavior: 'auto' });
      if (batchId) detailTriggerRefs.current.get(batchId)?.focus();
    });
  };
  const createAction = canCreateBatch ? <Button icon={<Plus size={17} />} onClick={onNewBatch}>发起重新付款</Button> : undefined;

  if (selectedBatchId) {
    if (selectedBatch) return (
      <PaymentBatchDetailPage
        batch={selectedBatch}
        payouts={payouts}
        creators={creators}
        currentRequestStatus={paymentBatchCurrentRequestStatus(selectedBatch, requests, payouts)}
        canHandleFailure={canCreateBatch}
        onBack={closeBatchDetail}
        onReturnPayout={onReturnPayout}
        onOpenFailurePaymentList={onOpenFailurePaymentList}
      />
    );
    return (
      <div className="page-stack payment-batch-detail-page">
        <button className="project-back-button payment-batch-detail-back" type="button" onClick={closeBatchDetail}>
          返回付款批次
        </button>
        <section className="payment-batch-detail-missing" role="status">
          <AlertCircle size={24} aria-hidden="true" />
          <h1>批次不存在</h1>
          <p>该付款批次可能已被移除，请返回列表后重新选择。</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack payment-batches-page">
      <PageHeading title="付款批次" subtitle="按渠道组织批量付款，并追踪失败重试与回写结果。" actions={createAction} />
      <div className="metrics-grid">
        <MetricCard label="处理中批次" value={String(batchMetrics.processingBatches)} meta={`共 ${batchMetrics.processing} 笔付款`} tone="peach" />
        <MetricCard label="付款成功率" value={batchMetrics.successRate} meta={`${batchMetrics.succeeded} / ${batchMetrics.total} 笔`} />
        <MetricCard label="已付款批次" value={String(batchMetrics.paidBatches)} meta={`共 ${batchMetrics.paidBatchItems} 笔付款`} tone="lilac" />
      </div>
      <section className="content-card">
        <div className="content-toolbar payment-batch-toolbar">
          <SearchBar value={search} onChange={setSearch} placeholder="搜索批次号" />
          <div className="payment-batch-date-range" role="group" aria-label="付款时间范围">
            <label>
              <span>开始</span>
              <input aria-label="付款开始时间" type="datetime-local" step="60" value={start} onChange={(event) => updateStart(event.target.value)} />
            </label>
            <span className="payment-batch-date-divider">至</span>
            <label>
              <span>结束</span>
              <input aria-label="付款结束时间" type="datetime-local" step="60" value={end} onChange={(event) => updateEnd(event.target.value)} />
            </label>
          </div>
          <SelectField<PaymentBatchPurposeFilter>
            ariaLabel="批次用途筛选"
            className="payment-batch-purpose-filter"
            value={purpose}
            options={PAYMENT_BATCH_PURPOSE_FILTER_OPTIONS}
            onChange={setPurpose}
          />
          <SelectField<PaymentBatchStatusFilter>
            ariaLabel="付款状态筛选"
            className="payment-batch-status-filter"
            value={paymentStatus}
            options={PAYMENT_BATCH_STATUS_FILTER_OPTIONS}
            onChange={setPaymentStatus}
          />
          <SelectField
            ariaLabel="付款渠道筛选"
            className="payment-batch-channel-filter"
            value={provider}
            options={[
              { value: 'all', label: '全部付款渠道' },
              { value: 'Airwallex', label: 'Airwallex' },
              { value: 'PayPal', label: 'PayPal' },
              { value: 'PayMax', label: 'Payer Max' },
            ]}
            onChange={setProvider}
          />
          <div className="payment-batch-export-actions" aria-label="付款批次导出">
            <Button
              variant="secondary"
              className="payment-batch-export-button is-confirmation"
              icon={exporting === 'confirmations'
                ? <LoaderCircle className="is-spinning" size={16} />
                : <FileArchive size={16} />}
              disabled={!exportAvailability.confirmations || exporting !== null}
              disabledReason={exporting
                ? '文件正在导出，请稍候。'
                : '请先选择至少一个 Airwallex 付款批次。'}
              onClick={() => { void exportConfirmations(); }}
            >
              {exporting === 'confirmations' ? '正在导出' : '导出确认函'}
            </Button>
            <Button
              variant="secondary"
              className="payment-batch-export-button is-record"
              icon={exporting === 'records'
                ? <LoaderCircle className="is-spinning" size={16} />
                : <FileSpreadsheet size={16} />}
              disabled={!exportAvailability.records || exporting !== null}
              disabledReason={exporting
                ? '文件正在导出，请稍候。'
                : '请先选择至少一个付款批次。'}
              onClick={() => { void exportPaymentData(); }}
            >
              {exporting === 'records' ? '正在导出' : '导出付款明细'}
            </Button>
          </div>
        </div>
        <div className="payment-batch-selection-summary" aria-live="polite">
          已选择 {selectedRows.length} 个付款批次，其中 {selectedAirwallexRows.length} 个 Airwallex 批次可导出确认函
        </div>
        <div className="table-scroll">
          <table className="data-table operational-table payment-batch-table">
            <thead>
              <tr>
                <th className="payment-batch-select-cell">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="全选当前筛选结果中的付款批次"
                    checked={allVisibleSelected}
                    disabled={!filteredRows.length}
                    onChange={() => setSelectedIds((current) => toggleVisiblePaymentBatchSelection(current, filteredRows))}
                  />
                </th>
                <th>批次号</th>
                <th>批次用途</th>
                <th>请款项目编号</th>
                <th>付款渠道</th>
                <th>付款主体</th>
                <th>项目名称</th>
                <th>请款金额及币种</th>
                <th>转账手续费及币种</th>
                <th>批次总支出金额及币种</th>
                <th>发起人</th>
                <th>付款人 / 时间</th>
                <th className="payment-batch-status-cell">付款状态</th>
                <th className="action-cell payment-batch-action-cell">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((batch) => {
                const selected = selectedIds.has(batch.id);
                return (
                  <tr className={selected ? 'is-selected' : ''} key={batch.id} aria-selected={selected}>
                    <td className="payment-batch-select-cell">
                      <input
                        type="checkbox"
                        aria-label={`选择付款批次 ${batch.id}`}
                        checked={selected}
                        onChange={() => toggleOne(batch.id)}
                      />
                    </td>
                    <td className="mono-cell">{batch.id}</td>
                    <td>
                      <span className={`payment-batch-purpose-badge is-${batch.purpose.toLowerCase()}`}>{paymentBatchPurposeLabel(batch.purpose)}</span>
                      {batch.purpose === 'REVERSAL' && batch.sourcePaymentBatchCode
                        ? <small className="cell-subtext" title={batch.sourcePaymentBatchCode}>来源批次 {batch.sourcePaymentBatchCode}</small>
                        : null}
                    </td>
                    <td className="mono-cell" title={batch.requestCode}>{batch.requestCode}</td>
                    <td><PaymentProviderBadge compact provider={batch.provider} /></td>
                    <td className="payment-batch-text-cell" title={batch.paymentEntity}>{batch.paymentEntity}</td>
                    <td className="payment-batch-project-cell" title={batch.projectName}><strong>{batch.projectName}</strong></td>
                    <td className="payment-batch-money-cell">{batch.paymentAmount}</td>
                    <td className="payment-batch-money-cell">{batch.transferFeeAmount}</td>
                    <td className="payment-batch-money-cell"><strong>{batch.actualPaidAmount}</strong></td>
                    <td className="payment-batch-text-cell" title={batch.initiator}>{batch.initiator}</td>
                    <td><strong>{batch.payer}</strong><small className="cell-subtext">{displayPaymentBatchTime(batch.paidAt)}</small></td>
                    <td className="payment-batch-status-cell"><span className={`simple-status ${paymentBatchStatusTone(batch.status)}`}><i />{batch.status}</span></td>
                    <td className="action-cell payment-batch-action-cell">
                      <ListActionButton
                        ref={(node) => { if (node) detailTriggerRefs.current.set(batch.paymentBatchId, node); }}
                        kind="view"
                        data-batch-detail-trigger={batch.paymentBatchId}
                        onClick={() => openBatchDetail(batch.paymentBatchId)}
                      >
                        查看明细
                      </ListActionButton>
                    </td>
                  </tr>
                );
              })}
              {!filteredRows.length ? <tr><td colSpan={14} className="project-list-empty">暂无符合当前搜索与筛选条件的付款批次</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>共 {filteredRows.length} 个批次{selectedRows.length ? `，已选 ${selectedRows.length} 个` : ''}</span>
          <Pagination
            ariaLabel="付款批次列表分页"
            page={batchPage}
            pageSize={batchPageSize}
            total={filteredRows.length}
            onPageChange={setBatchPage}
            onPageSizeChange={setBatchPageSize}
          />
        </div>
      </section>
    </div>
  );
}

const TRANSACTION_PROVIDER_OPTIONS = [
  { value: 'all', label: '全部付款渠道' },
  { value: 'Airwallex', label: 'Airwallex' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'PayMax', label: 'Payer Max' },
] as const;

const TRANSACTION_PAID_STATUS_OPTIONS = [
  { value: ALL_PAYMENT_STATUSES, label: ALL_PAYMENT_STATUSES },
  { value: '已付款', label: '已付款' },
  { value: '付款处理中', label: '付款处理中' },
] as const satisfies ReadonlyArray<{ value: PaymentStatusFilter; label: string }>;

export function TransactionsPage({
  payouts,
  paymentBatches,
  contracts = [],
  generatedInvoices = [],
  onOpenPaymentBatch,
}: {
  payouts: Payout[];
  paymentBatches: readonly PaymentBatchRecord[];
  contracts?: readonly ContractRecord[];
  generatedInvoices?: readonly GeneratedInvoiceRecord[];
  onOpenPaymentBatch?: (batchId: PaymentBatchRecord['paymentBatchId']) => void;
}) {
  const [tab, setTab] = useState<TransactionTab>('all');
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState<TransactionProvider>('all');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>(ALL_PAYMENT_STATUSES);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [detailRecordKey, setDetailRecordKey] = useState<string | null>(null);
  const detailReturnKeyRef = useRef<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const transactions = useMemo(
    () => createTransactionRecords(payouts, paymentBatches),
    [payouts, paymentBatches],
  );
  const visible = filterTransactionRecords(transactions, {
    tab,
    status: tab === 'paid' ? paymentStatus : ALL_PAYMENT_STATUSES,
    search,
    provider,
    startDate,
    endDate,
  });
  const selectedTransactions = transactions.filter((record) => selectedKeys.has(record.key));
  const detailRecord = detailRecordKey
    ? transactions.find((record) => record.key === detailRecordKey) ?? null
    : null;
  const paid = transactions.filter((record) => record.status === '已付款');
  const failed = transactions.filter((record) => record.status === '付款失败');
  const transactionTabCounts: Record<TransactionTab, number> = {
    all: transactions.length,
    paid: transactions.filter((record) => ['已付款', '付款处理中'].includes(record.status)).length,
    failed: failed.length,
  };
  const paidCurrencies = aggregatePayoutCurrencies(paid.map((record) => ({
    amount: record.paymentAmount,
    currency: record.paymentCurrency,
  })), true);
  const formatSuccessRate = (successfulCount: number, failedCount: number) => {
    const total = successfulCount + failedCount;
    return total ? `${((successfulCount / total) * 100).toFixed(1)}%` : '—';
  };
  const successRate = formatSuccessRate(paid.length, failed.length);
  const providerSuccessRates = (['Airwallex', 'PayPal', 'PayMax'] as const).map((provider) => {
    const successfulCount = paid.filter((record) => record.provider === provider).length;
    const failedCount = failed.filter((record) => record.provider === provider).length;
    return {
      provider,
      successRate: formatSuccessRate(successfulCount, failedCount),
      failedCount,
    };
  });

  const updateStartDate = (value: string) => {
    setStartDate(value);
    if (value && endDate && value > endDate) setEndDate(value);
  };
  const updateEndDate = (value: string) => {
    setEndDate(value);
    if (value && startDate && value < startDate) setStartDate(value);
  };
  const updateTab = (nextTab: TransactionTab) => {
    setTab(nextTab);
    setPaymentStatus(ALL_PAYMENT_STATUSES);
  };
  const toggleTransaction = (recordKey: string, checked: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(recordKey);
      else next.delete(recordKey);
      return next;
    });
  };
  const toggleTransactions = (recordKeys: readonly string[], checked: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      recordKeys.forEach((recordKey) => {
        if (checked) next.add(recordKey);
        else next.delete(recordKey);
      });
      return next;
    });
  };
  const openTransactionDetail = (record: TransactionRecord) => {
    detailReturnKeyRef.current = record.key;
    setDetailRecordKey(record.key);
  };
  const closeTransactionDetail = () => {
    const returnKey = detailReturnKeyRef.current;
    setDetailRecordKey(null);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!returnKey) return;
        const button = document.querySelector<HTMLButtonElement>(`[data-transaction-detail="${returnKey}"]`);
        button?.focus();
      });
    });
  };
  const exportTransactions = async () => {
    setExporting(true);
    setExportError('');
    try {
      const workbook = await loadTransactionRecordsWorkbook(selectedTransactions);
      downloadBlob(workbook, transactionRecordsFilename());
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '交易流水导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  if (detailRecord) {
    return (
      <TransactionDetailPage
        record={detailRecord}
        contracts={contracts}
        generatedInvoices={generatedInvoices}
        onBack={closeTransactionDetail}
        onOpenPaymentBatch={detailRecord.context && onOpenPaymentBatch
          ? () => onOpenPaymentBatch(detailRecord.paymentBatchId)
          : undefined}
      />
    );
  }

  return (
    <div className="page-stack transactions-page">
      <PageHeading title="交易记录" subtitle="查询每笔达人付款的渠道流水、币种与付款状态。" />
      <section className="summary-surface" aria-label="交易概览">
        <PaymentCurrencySummaryCard
          items={paidCurrencies}
          summaryLabel="已付款总额"
          detailTitle="已付款币种详情"
          summaryCount={paid.length}
          tone="peach"
          icon="paid"
        />
        <article
          className="summary-card summary-card-lilac payment-workbench-summary-card transaction-channel-summary-card"
          aria-label="渠道付款成功率"
        >
          <span className="summary-illustration"><CheckCircle2 size={26} /></span>
          <div className="payment-summary-content">
            <div className="payment-summary-primary">
              <strong>{successRate}</strong>
              <span>全部渠道成功率 · {failed.length} 笔失败</span>
            </div>
          </div>
          <ul className="payment-summary-secondary transaction-channel-summary-details" aria-label="各渠道付款成功率">
            {providerSuccessRates.map((item) => (
              <li className="transaction-channel-summary-row" key={item.provider}>
                <span>{paymentProviderDisplayName(item.provider)}</span>
                <span>{item.successRate}</span>
                <small>{item.failedCount} 笔失败</small>
              </li>
            ))}
          </ul>
        </article>
      </section>
      <section className="content-card">
        <div className="tabs-row" role="tablist" aria-label="交易状态">
          <button className={`tab-button ${tab === 'all' ? 'tab-active' : ''}`} type="button" role="tab" aria-selected={tab === 'all'} onClick={() => updateTab('all')}>全部<span>{transactionTabCounts.all}</span></button>
          <button className={`tab-button ${tab === 'paid' ? 'tab-active' : ''}`} type="button" role="tab" aria-selected={tab === 'paid'} onClick={() => updateTab('paid')}>已付款<span>{transactionTabCounts.paid}</span></button>
          <button className={`tab-button ${tab === 'failed' ? 'tab-active' : ''}`} type="button" role="tab" aria-selected={tab === 'failed'} onClick={() => updateTab('failed')}>付款失败<span>{transactionTabCounts.failed}</span></button>
        </div>
        <div className="transaction-filter-row">
          <label className="search-control transaction-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="搜索交易记录"
              placeholder="搜索达人、项目、Invoice、批次号"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="date-filter">
            <CalendarDays size={17} aria-hidden="true" />
            <label>
              <span className="sr-only">交易开始日期</span>
              <input type="date" value={startDate} onChange={(event) => updateStartDate(event.target.value)} />
            </label>
            <span className="date-divider">—</span>
            <label>
              <span className="sr-only">交易结束日期</span>
              <input type="date" value={endDate} onChange={(event) => updateEndDate(event.target.value)} />
            </label>
          </div>
          {tab === 'paid' ? (
            <SelectField<PaymentStatusFilter>
              ariaLabel="付款状态"
              className="transaction-status-select"
              value={paymentStatus}
              options={TRANSACTION_PAID_STATUS_OPTIONS}
              onChange={setPaymentStatus}
            />
          ) : null}
          <SelectField<TransactionProvider>
            ariaLabel="付款渠道"
            className="transaction-provider-select"
            value={provider}
            options={TRANSACTION_PROVIDER_OPTIONS}
            onChange={setProvider}
          />
          <span className="transaction-filter-result" aria-live="polite"><ListFilter size={14} aria-hidden="true" />当前显示 {visible.length} 条记录</span>
          {selectedTransactions.length ? (
            <span className="transaction-selection-summary" aria-live="polite">
              <strong>已选 {selectedTransactions.length} 条</strong>
              <button className="transaction-selection-clear" type="button" onClick={() => setSelectedKeys(new Set())}>清空</button>
            </span>
          ) : null}
          <Button
            className="transaction-export-button"
            variant="secondary"
            icon={<Download size={16} />}
            disabled={exporting || !selectedTransactions.length}
            disabledReason={exporting ? '交易记录正在导出，请稍候。' : '请先选择需要导出的交易记录。'}
            onClick={exportTransactions}
          >
            {exporting ? '导出中...' : `导出已选（${selectedTransactions.length}）`}
          </Button>
        </div>
        {exportError ? <p className="transaction-export-error" role="alert">{exportError}</p> : null}
        <TransactionRecordsTable
          records={visible}
          selectedKeys={selectedKeys}
          onToggle={toggleTransaction}
          onToggleAll={toggleTransactions}
          onOpenDetail={openTransactionDetail}
        />
      </section>
    </div>
  );
}

export function OrganizationPage({
  notify,
  contractAdvertiserSettings,
  onContractAdvertiserSettingsChange,
  invoiceBillingSettings,
  onInvoiceBillingSettingsChange,
}: {
  notify: Notify;
  contractAdvertiserSettings: ContractAdvertiserSettings;
  onContractAdvertiserSettingsChange: (settings: ContractAdvertiserSettings) => void;
  invoiceBillingSettings: InvoiceBillingSettings;
  onInvoiceBillingSettingsChange: (settings: InvoiceBillingSettings) => void;
}) {
  return (
    <div className="page-stack">
      <PageHeading
        title="组织信息"
        subtitle="维护签约与付款流程中使用的企业主体资料。"
        actions={<Button onClick={() => notify('组织信息已保存', '合同 Advertiser 与 Invoice 开票主体已在本次会话中更新。')}>保存修改</Button>}
      />
      <EntitySettingsCard<ContractAdvertiserEntityId>
        icon={<Building2 size={21} />}
        title="公司 / 工作室信息"
        description="这些信息会出现在合同的Advertiser中"
        addLabel="新增 Advertiser 主体"
        createTitle="新增 Advertiser 主体"
        editTitle="编辑 Advertiser 主体"
        deleteTitle="删除 Advertiser 主体"
        nameLabel="Advertiser 公司名称"
        addressLabel="Advertiser 地址"
        entityNoun="合同 Advertiser 主体"
        defaultGroupLabel="默认合同 Advertiser 主体"
        defaultInputName="default-contract-advertiser-entity"
        note="新建合同默认带入默认主体；每份合同仍可选择其他主体。"
        deleteHistoryNote="已生成的历史合同会继续保留原 Advertiser 快照。"
        entities={contractAdvertiserSettings.entities}
        defaultEntityId={contractAdvertiserSettings.defaultEntityId}
        validate={validateContractAdvertiserEntity}
        onCreate={(draft) => {
          onContractAdvertiserSettingsChange(addContractAdvertiserEntity(contractAdvertiserSettings, {
            id: createPrototypeId('contract-advertiser-entity') as ContractAdvertiserEntityId,
            ...draft,
          }));
          notify('Advertiser 主体已添加', `${draft.name} 已加入合同可选主体。`);
        }}
        onUpdate={(entity) => {
          onContractAdvertiserSettingsChange(updateContractAdvertiserEntity(contractAdvertiserSettings, entity));
          notify('Advertiser 主体已更新', `${entity.name} 的合同主体资料已更新。`);
        }}
        onDefaultChange={(id) => {
          const entity = contractAdvertiserSettings.entities.find((candidate) => candidate.id === id);
          onContractAdvertiserSettingsChange(setDefaultContractAdvertiserEntity(contractAdvertiserSettings, id));
          if (entity) notify('默认 Advertiser 已更新', `${entity.name} 将在新建合同时默认选中。`);
        }}
        onDelete={(entity: ContractAdvertiserEntity) => {
          onContractAdvertiserSettingsChange(removeContractAdvertiserEntity(contractAdvertiserSettings, entity.id));
          notify('Advertiser 主体已删除', `${entity.name} 已从合同可选主体中移除，历史合同快照不受影响。`);
        }}
      />
      <EntitySettingsCard<InvoiceBillingEntityId>
        icon={<FileText size={21} />}
        title="Invoice 开票主体"
        description="作为生成文件中的 Bill To 信息，与公司 / 工作室资料独立维护。"
        addLabel="新增开票主体"
        createTitle="新增开票主体"
        editTitle="编辑开票主体"
        deleteTitle="删除开票主体"
        nameLabel="Bill To 公司名称"
        addressLabel="Bill To 地址"
        entityNoun="开票主体"
        defaultGroupLabel="默认 Invoice 开票主体"
        defaultInputName="default-invoice-entity"
        note="新建 Invoice 默认带入默认主体；单张 Invoice 仍可临时修改地址。"
        deleteHistoryNote="已生成的历史 Invoice 会继续保留原 Bill To 快照。"
        entities={invoiceBillingSettings.entities}
        defaultEntityId={invoiceBillingSettings.defaultEntityId}
        validate={validateInvoiceBillingEntity}
        onCreate={(draft) => {
          onInvoiceBillingSettingsChange(addInvoiceBillingEntity(invoiceBillingSettings, {
            id: createPrototypeId('invoice-billing-entity') as InvoiceBillingEntityId,
            ...draft,
          }));
          notify('开票主体已添加', `${draft.name} 已加入可选的 Bill To 主体。`);
        }}
        onUpdate={(entity) => {
          onInvoiceBillingSettingsChange(updateInvoiceBillingEntity(invoiceBillingSettings, entity));
          notify('开票主体已更新', `${entity.name} 的 Bill To 资料已更新。`);
        }}
        onDefaultChange={(id) => {
          const entity = invoiceBillingSettings.entities.find((candidate) => candidate.id === id);
          onInvoiceBillingSettingsChange(setDefaultInvoiceBillingEntity(invoiceBillingSettings, id));
          if (entity) notify('默认开票主体已更新', `${entity.name} 将在新建 Invoice 时默认选中。`);
        }}
        onDelete={(entity: InvoiceBillingEntity) => {
          onInvoiceBillingSettingsChange(removeInvoiceBillingEntity(invoiceBillingSettings, entity.id));
          notify('开票主体已删除', `${entity.name} 已从可选主体中移除，历史 Invoice 快照不受影响。`);
        }}
      />
    </div>
  );
}

const CHANNELS = [
  { name: 'Airwallex', tag: '国际银行转账', description: '支持本地转账、SWIFT 与批量付款', currencies: 'USD · EUR · GBP · HKD · SGD', state: '已连接', color: '#6d5ce7' },
  { name: 'Payer Max', tag: '本地银行网络', description: '俄罗斯、泰国及区域本地银行模板', currencies: 'USD · EUR · THB', state: '已连接', color: '#ff765d' },
  { name: 'PayPal', tag: '数字钱包', description: '通过达人 PayPal 邮箱快速付款', currencies: 'USD · EUR', state: '已连接', color: '#1689e5' },
];

export function ChannelsPage({ notify }: { notify: Notify }) {
  const [testing, setTesting] = useState<string | null>(null);
  const test = (name: string) => {
    setTesting(name);
    window.setTimeout(() => {
      setTesting(null);
      notify(`${name} 连接正常`, 'API 凭证有效，回调地址可访问。');
    }, 700);
  };
  return <div className="page-stack"><PageHeading title="渠道设置" subtitle="配置付款服务商、API 凭证与回调状态。" actions={<Button variant="secondary" icon={<Settings2 size={16} />}>路由规则</Button>} /><NoticeBanner>演示环境仅展示渠道配置状态，不会发起真实付款或写入服务商账户。</NoticeBanner><div className="channel-grid">{CHANNELS.map((channel) => <article className="channel-card" key={channel.name}><header><span className="channel-logo" style={{ backgroundColor: channel.color }}>{channel.name.slice(0, 1)}</span><div><h2>{channel.name}</h2><p>{channel.tag}</p></div><span className="connected-state"><i />{channel.state}</span></header><p className="channel-description">{channel.description}</p><dl><div><dt>支持币种</dt><dd>{channel.currencies}</dd></div><div><dt>最近校验</dt><dd>2026-07-17 10:24</dd></div></dl><footer><Button variant="secondary" icon={<Link2 size={16} />} disabled={testing === channel.name} disabledReason="连接正在校验，请稍候。" onClick={() => test(channel.name)}>{testing === channel.name ? '校验中…' : '测试连接'}</Button><button className="icon-button" type="button" aria-label={`配置 ${channel.name}`}><MoreHorizontal size={19} /></button></footer></article>)}</div></div>;
}

export type NotificationNavigationTarget =
  | { kind: 'invoice-review'; invoiceId: string }
  | { kind: 'request-review'; requestId: string }
  | { kind: 'creator-payout'; creatorId: string }
  | { kind: 'batch'; batchId: string }
  | { kind: 'transaction'; payoutId: string };

export type SystemNotificationItem = {
  id: number;
  icon: LucideIcon;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  actionLabel: string;
  target: NotificationNavigationTarget;
};

export const INITIAL_NOTIFICATIONS: SystemNotificationItem[] = [
  {
    id: 1,
    icon: FileCheck2,
    title: 'Invoice 待审核',
    body: `${demoDisplayName('Mina Kato')} · Once Human主机上线KOL合作项目 · USD 3,240`,
    time: '10 分钟前',
    unread: true,
    actionLabel: '进入审核',
    target: { kind: 'invoice-review', invoiceId: 'invoice_fixture_301164_01' as InvoiceId },
  },
  {
    id: 2,
    icon: AlertCircle,
    title: `${demoDisplayName('Nika Petrova')} 的收款资料校验失败`,
    body: '泰国本地转账路由代码待补充，请在达人档案中更新。',
    time: '42 分钟前',
    unread: true,
    actionLabel: '更新收款资料',
    target: { kind: 'creator-payout', creatorId: 'creator-nika' },
  },
  {
    id: 3,
    icon: Send,
    title: '批次 BAT-20260805-013 已提交渠道',
    body: 'Airwallex 正在处理付款。',
    time: '昨天 16:42',
    unread: false,
    actionLabel: '查看批次',
    target: { kind: 'batch', batchId: 'BAT-20260805-013' },
  },
  {
    id: 4,
    icon: CheckCircle2,
    title: '付款状态已回写',
    body: `${demoDisplayName('Kenji Mori')} · USD 4,100 · 已付款`,
    time: '昨天 14:32',
    unread: false,
    actionLabel: '查看付款详情',
    target: { kind: 'transaction', payoutId: 'pay-005' },
  },
];

export function NotificationsPage({
  items,
  approvalReminder,
  approvalReminderUnread,
  onRead,
  onReadApprovalReminder,
  onMarkAllRead,
  onOpenRequestApprovals,
  onOpenTarget,
}: {
  items: SystemNotificationItem[];
  approvalReminder: RequestApprovalReminderSummary;
  approvalReminderUnread: boolean;
  onRead: (id: number) => void;
  onReadApprovalReminder: () => void;
  onMarkAllRead: () => void;
  onOpenRequestApprovals: () => void;
  onOpenTarget: (target: NotificationNavigationTarget) => void;
}) {
  const hasApprovalReminder = approvalReminder.count > 0;
  const unreadCount = items.filter((item) => item.unread).length
    + (hasApprovalReminder && approvalReminderUnread ? 1 : 0);
  const notificationEntries = [
    ...(hasApprovalReminder ? [{ kind: 'approval' as const, key: 'approval-reminder' }] : []),
    ...items.map((item) => ({ kind: 'notification' as const, key: `notification-${item.id}`, item })),
  ];
  const {
    page,
    pageItems: visibleEntries,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination(notificationEntries, {
    resetKey: notificationEntries.map((entry) => entry.key).join('|'),
  });
  const openRequestApprovals = () => {
    onReadApprovalReminder();
    onOpenRequestApprovals();
  };
  const openNotification = (item: SystemNotificationItem) => {
    onRead(item.id);
    onOpenTarget(item.target);
  };

  return (
    <div className="page-stack">
      <PageHeading
        title="通知"
        subtitle={`你有 ${unreadCount} 条未读消息。`}
        actions={<Button variant="secondary" onClick={onMarkAllRead}>全部标为已读</Button>}
      />
      <section className="notification-card" aria-label="消息通知列表">
        {visibleEntries.map((entry) => {
          if (entry.kind === 'approval') {
            return (
              <button
                className={`notification-item request-approval-notification ${approvalReminderUnread ? 'notification-unread' : ''}`}
                key={entry.key}
                type="button"
                onClick={openRequestApprovals}
              >
                <span className="notification-symbol"><ClipboardCheck size={19} /></span>
                <span>
                  <strong>你有 {approvalReminder.count} 个请款项目待审批</strong>
                  <small>请及时核对请款资料，点击进入请款项目处理。</small>
                </span>
                <time><Clock3 size={14} />本次登录</time>
                {approvalReminderUnread ? <i className="unread-dot" /> : null}
              </button>
            );
          }
          const { item } = entry;
          const Icon = item.icon;
          return (
            <button
              className={`notification-item ${item.unread ? 'notification-unread' : ''}`}
              key={item.id}
              type="button"
              aria-label={`${item.title}，${item.actionLabel}`}
              onClick={() => openNotification(item)}
            >
              <span className="notification-symbol"><Icon size={19} /></span>
              <span><strong>{item.title}</strong><small>{item.body}</small></span>
              <span className="notification-meta">
                <time><Clock3 size={14} />{item.time}</time>
                <span className="notification-action">{item.actionLabel}<ChevronRight size={14} /></span>
              </span>
              {item.unread ? <i className="unread-dot" aria-hidden="true" /> : null}
            </button>
          );
        })}
        <div className="table-footer notification-footer">
          <span>共 {notificationEntries.length} 条通知</span>
          <Pagination
            ariaLabel="通知列表分页"
            page={page}
            pageSize={pageSize}
            total={notificationEntries.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </section>
    </div>
  );
}
