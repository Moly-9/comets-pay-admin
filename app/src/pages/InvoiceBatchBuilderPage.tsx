import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  ListChecks,
  PackageCheck,
  Plus,
  Eye,
  ReceiptText,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  Users,
  Trash2,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  createPrototypeId,
  type ContractId,
  type CreatorId,
  type EngagementId,
  type ProjectId,
} from '../businessWorkflow';
import { Avatar, Button, Modal, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { InvoiceDocumentView } from '../components/InvoiceDocumentView';
import type { ContractRecord } from '../contracts';
import {
  INVOICE_BATCH_MAX_FILE_SIZE,
  INVOICE_BATCH_MAX_ROWS,
  INVOICE_BATCH_SCHEMA_VERSION,
  availableContractsForEngagement,
  buildInvoiceDocumentForBatchRow,
  createGeneratedInvoiceRecord,
  createInvoiceBatchRow,
  INVOICE_BATCH_CURRENCIES,
  synchronizeInvoiceBatchLineItems,
  updateInvoiceBatchLineItem,
  updateAndValidateInvoiceBatchRow,
  validateInvoiceBatchRow,
  type InvoiceBatchContext,
  type InvoiceBatchLineItemSeed,
} from '../invoice/invoiceBatch';
import { createInvoiceBatchArchive } from '../invoice/invoiceBatchArchive';
import {
  INVOICE_BATCH_PROTOTYPE_CURRENCY,
  createInvoiceBatchPrototypeSeed,
  filterInvoiceBatchCreatorReferences,
  selectableInvoiceBatchEngagementIds,
  withInvoiceBatchPrototypeAccounts,
} from '../invoice/invoiceBatchPrototype';
import {
  eligibleInvoicePayoutAccounts,
  getPayoutAccountId,
  getPayoutAccountIdentifier,
  getPayoutAccountSummary,
} from '../payoutAccounts';
import { findExistingEngagementId } from '../paymentRequestProjects';
import {
  downloadBlob,
  formatInvoiceMoney,
  invoiceFilename,
  nextInvoiceNumber,
  todayInputValue,
} from '../invoice/invoiceUtils';
import {
  exportInvoiceBatchWorkbook,
  importInvoiceBatchWorkbook,
} from '../invoice/invoiceBatchWorkbook';
import type {
  CreatorProfile,
  CreatorPayoutAccount,
  GeneratedInvoiceRecord,
  InvoiceBatchMode,
  InvoiceBatchRow,
  InvoiceCurrency,
  InvoiceDocumentModel,
  InvoiceEntity,
  Payout,
} from '../types';
import type { ProjectSummary } from './ProjectDetailPage';
import './InvoiceBatchBuilderPage.css';

type InvoiceBatchBuilderPageProps = {
  creators: CreatorProfile[];
  payouts: Payout[];
  projects: ProjectSummary[];
  contracts: ContractRecord[];
  invoiceEntity: InvoiceEntity;
  generatedInvoices: GeneratedInvoiceRecord[];
  onGenerated: (records: GeneratedInvoiceRecord[]) => void;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onOpenInvoiceManagement: () => void;
  onOpenCreatorPaymentInformation: (creatorId: CreatorId) => void;
};

const STATUS_META = {
  READY: { label: '可生成', tone: 'success' },
  NEEDS_INPUT: { label: '需补充', tone: 'warning' },
  CONFLICT: { label: '有冲突', tone: 'danger' },
  GENERATING: { label: '生成中', tone: 'pending' },
  GENERATED: { label: '已生成', tone: 'success' },
  FAILED: { label: '生成失败', tone: 'danger' },
} as const;

const INVOICE_BATCH_CURRENCY_NAMES: Record<InvoiceCurrency, string> = {
  USD: '美元',
  EUR: '欧元',
  GBP: '英镑',
  HKD: '港币',
  SGD: '新加坡元',
};

const creatorInitials = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join('') || 'CR';

type InvoiceBatchResultSectionProps = {
  rows: InvoiceBatchRow[];
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  fallbackCurrency: InvoiceCurrency;
  onDownloadZip: () => void;
};

export function InvoiceBatchResultSection({
  rows,
  creators,
  contracts,
  fallbackCurrency,
  onDownloadZip,
}: InvoiceBatchResultSectionProps) {
  const resultRows = rows.filter((row) => row.status === 'GENERATED' || row.status === 'FAILED');
  const generatedRows = resultRows.filter((row) => row.status === 'GENERATED');

  return (
    <section
      className="invoice-builder-section invoice-batch-card invoice-batch-result-section"
      data-batch-section="results"
    >
      <header>
        <span><PackageCheck size={18} /></span>
        <div>
          <h2>生成结果</h2>
          <p>成功记录将进入“待签署”，可在这里查看结果并下载文件。</p>
        </div>
      </header>

      {!resultRows.length ? (
        <div className="invoice-batch-result-empty">
          <span><ReceiptText size={20} /></span>
          <strong>暂无生成结果</strong>
          <small>完成上方信息与校验后，生成的 Invoice 会展示在这里。</small>
        </div>
      ) : (
        <>
          {generatedRows.length ? (
            <div className="invoice-batch-result-summary">
              <CheckCircle2 size={26} />
              <div>
                <strong>已成功生成 {generatedRows.length} 张 Invoice</strong>
                <span>每张记录保留独立编号、稳定项目达人关联和生成快照。</span>
              </div>
              <Button icon={<Download size={16} />} onClick={onDownloadZip}>
                下载整批 ZIP
              </Button>
            </div>
          ) : null}

          <div className="invoice-batch-result-table-wrap">
            <table className="invoice-batch-result-table">
              <thead>
                <tr>
                  <th>达人</th>
                  <th>付款渠道</th>
                  <th>Invoice</th>
                  <th>合同</th>
                  <th>Invoice 金额</th>
                  <th>状态</th>
                  <th>文件</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map((row) => {
                  const creator = creators.find((candidate) => candidate.id === row.creatorId);
                  const account = eligibleInvoicePayoutAccounts(creator).find((candidate) => (
                    getPayoutAccountId(candidate) === row.payoutAccountId
                  ));
                  const provider = row.generated?.record.snapshot.payoutProvider ?? account?.provider;
                  const linkedContracts = row.contractIds.map((contractId) => (
                    contracts.find((contract) => contract.contractId === contractId)
                  )).filter((contract): contract is ContractRecord => Boolean(contract));
                  const invoiceNumber = row.generated?.record.snapshot.invoiceNumber;
                  const resultCurrency = row.generated?.record.snapshot.currency || row.currency || fallbackCurrency;

                  return (
                    <tr
                      key={row.engagementId}
                      className={row.generated ? 'is-generated' : 'is-failed'}
                      data-creator-id={row.creatorId}
                    >
                      <td data-label="达人">
                        <div className="invoice-batch-result-creator">
                          <Avatar
                            initials={creator?.initials || creatorInitials(row.creatorName)}
                            accent={creator?.accent || '#5f72d8'}
                            size="sm"
                          />
                          <span>
                            <strong>{row.creatorName}</strong>
                            <small>{row.creatorHandle}</small>
                          </span>
                        </div>
                      </td>
                      <td data-label="付款渠道">
                        {provider ? (
                          <span
                            className={`invoice-batch-result-provider provider-${provider.toLowerCase()}`}
                            data-provider={provider}
                          >
                            <i aria-hidden="true">{provider.slice(0, 1)}</i>
                            {provider}
                          </span>
                        ) : <span className="invoice-batch-result-muted">-</span>}
                      </td>
                      <td data-label="Invoice">
                        <span className="invoice-batch-result-reference">
                          <strong>{invoiceNumber ? '1 份 Invoice' : '未生成'}</strong>
                          <small>{invoiceNumber ?? '待处理'}</small>
                        </span>
                      </td>
                      <td data-label="合同">
                        <span className="invoice-batch-result-reference">
                          <strong>{row.contractIds.length ? `${row.contractIds.length} 份合同` : '未关联合同'}</strong>
                          {row.contractIds.length ? (
                            <small>
                              {linkedContracts.map((contract) => contract.id).join('、') || row.contractIds.join('、')}
                            </small>
                          ) : null}
                        </span>
                      </td>
                      <td data-label="Invoice 金额">
                        <strong className="invoice-batch-result-amount">
                          {formatInvoiceMoney(resultCurrency, rowTotal(row))}
                        </strong>
                      </td>
                      <td data-label="状态">
                        {row.generated ? (
                          <span className="invoice-batch-result-status is-success">
                            <CheckCircle2 size={14} />
                            已生成
                          </span>
                        ) : (
                          <span className="invoice-batch-result-status is-failure" title={row.issues.join('；')}>
                            <AlertTriangle size={14} />
                            <span><strong>生成失败</strong><small>{row.issues[0] ?? '待补充后重试'}</small></span>
                          </span>
                        )}
                      </td>
                      <td data-label="文件">
                        {row.generated ? (
                          <div className="invoice-batch-result-files">
                            <button
                              type="button"
                              aria-label={`下载 ${row.creatorName} 的 PDF`}
                              onClick={() => downloadBlob(
                                row.generated!.pdfBlob,
                                invoiceFilename(row.generated!.record.snapshot, 'pdf'),
                              )}
                            >
                              <FileText size={13} />
                              PDF
                            </button>
                            <button
                              type="button"
                              aria-label={`下载 ${row.creatorName} 的 DOCX`}
                              onClick={() => downloadBlob(
                                row.generated!.docxBlob,
                                invoiceFilename(row.generated!.record.snapshot, 'docx'),
                              )}
                            >
                              <FileText size={13} />
                              DOCX
                            </button>
                          </div>
                        ) : <span className="invoice-batch-result-muted">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

const INVOICE_BATCH_CURRENCY_OPTIONS = INVOICE_BATCH_CURRENCIES.map((value) => ({
  value,
  label: value,
  description: INVOICE_BATCH_CURRENCY_NAMES[value],
}));

const projectIdFor = (project: ProjectSummary) => (
  (project.cooperationProjectId ?? project.projectId ?? project.id) as ProjectId
);

const rowTotal = (row: Pick<InvoiceBatchRow, 'items'>) => (
  Math.round(row.items.reduce((total, item) => (
    total + item.unitPrice * item.quantity
  ), 0) * 100) / 100
);

const createSharedDescription = (): InvoiceBatchLineItemSeed => ({
  templateKey: createPrototypeId('item'),
  description: '',
});

const paymentInformationLabel = (provider: 'Airwallex' | 'PayPal' | 'PayMax') => (
  provider === 'PayPal' ? 'Paid by PayPal' : 'Paid by Bank'
);

type PaymentInformationGroup = 'BANK' | 'PAYPAL';

const PAYMENT_INFORMATION_GROUPS: Array<{
  key: PaymentInformationGroup;
  label: string;
}> = [
  { key: 'BANK', label: 'Paid by Bank' },
  { key: 'PAYPAL', label: 'Paid by PayPal' },
];

const paymentInformationGroupFor = (
  account: CreatorPayoutAccount | undefined,
): PaymentInformationGroup => account?.provider === 'PayPal' ? 'PAYPAL' : 'BANK';

function PaymentInformationCascader({
  accounts,
  value,
  disabled,
  ariaLabel,
  onChange,
}: {
  accounts: CreatorPayoutAccount[];
  value: string;
  disabled: boolean;
  ariaLabel: string;
  onChange: (payoutAccountId: string) => void;
}) {
  const selectedAccount = accounts.find((account) => getPayoutAccountId(account) === value);
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<PaymentInformationGroup>(() => (
    paymentInformationGroupFor(selectedAccount)
  ));
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<Record<PaymentInformationGroup, HTMLButtonElement | null>>({
    BANK: null,
    PAYPAL: null,
  });
  const accountRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const groupedAccounts = useMemo<Record<PaymentInformationGroup, CreatorPayoutAccount[]>>(() => ({
    BANK: accounts.filter((account) => account.provider !== 'PayPal'),
    PAYPAL: accounts.filter((account) => account.provider === 'PayPal'),
  }), [accounts]);
  const activeAccounts = groupedAccounts[activeGroup];

  const updateMenuPosition = () => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return;
    const viewportGap = 12;
    const menuGap = 6;
    const width = Math.min(430, window.innerWidth - viewportGap * 2);
    const measuredHeight = menuRef.current?.getBoundingClientRect().height;
    const estimatedHeight = Math.min(286, Math.max(142, activeAccounts.length * 54 + 18));
    const height = measuredHeight || estimatedHeight;
    const roomBelow = window.innerHeight - triggerRect.bottom - viewportGap;
    const placeAbove = roomBelow < height + menuGap && triggerRect.top > roomBelow;
    const left = Math.min(
      Math.max(viewportGap, triggerRect.left),
      Math.max(viewportGap, window.innerWidth - width - viewportGap),
    );
    const top = placeAbove
      ? Math.max(viewportGap, triggerRect.top - height - menuGap)
      : Math.min(window.innerHeight - height - viewportGap, triggerRect.bottom + menuGap);
    setMenuStyle({ left, top, width });
  };

  const closeAndFocusTrigger = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const focusFirstAccount = (group: PaymentInformationGroup) => {
    setActiveGroup(group);
    window.requestAnimationFrame(() => accountRefs.current[0]?.focus());
  };

  useEffect(() => {
    if (!open) setActiveGroup(paymentInformationGroupFor(selectedAccount));
  }, [open, selectedAccount]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return undefined;
    const animationFrame = window.requestAnimationFrame(updateMenuPosition);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [activeAccounts.length, open]);

  const handleGroupKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    groupIndex: number,
  ) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (groupIndex + direction + PAYMENT_INFORMATION_GROUPS.length)
        % PAYMENT_INFORMATION_GROUPS.length;
      const nextGroup = PAYMENT_INFORMATION_GROUPS[nextIndex].key;
      setActiveGroup(nextGroup);
      groupRefs.current[nextGroup]?.focus();
    } else if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (activeAccounts.length) focusFirstAccount(activeGroup);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeAndFocusTrigger();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const handleAccountKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    accountIndex: number,
  ) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (accountIndex + direction + activeAccounts.length) % activeAccounts.length;
      accountRefs.current[nextIndex]?.focus();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      groupRefs.current[activeGroup]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeAndFocusTrigger();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        className={`invoice-batch-payment-trigger${open ? ' is-open' : ''}`}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="tree"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              window.requestAnimationFrame(() => groupRefs.current[activeGroup]?.focus());
            }
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
          }
        }}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selectedAccount ? '' : 'is-placeholder'}>
          {selectedAccount
            ? `${paymentInformationLabel(selectedAccount.provider)} · ${selectedAccount.nickname}`
            : '待选择'}
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>

      {open ? createPortal(
        <div
          ref={menuRef}
          id={menuId}
          className="invoice-batch-payment-cascader"
          style={menuStyle}
          role="tree"
          aria-label={`${ariaLabel} 选择器`}
        >
          <div className="invoice-batch-payment-methods" role="group" aria-label="付款方式">
            {PAYMENT_INFORMATION_GROUPS.map((group, groupIndex) => {
              const active = group.key === activeGroup;
              return (
                <button
                  key={group.key}
                  ref={(node) => { groupRefs.current[group.key] = node; }}
                  className={active ? 'is-active' : ''}
                  type="button"
                  role="treeitem"
                  aria-expanded={active}
                  tabIndex={-1}
                  onPointerEnter={() => setActiveGroup(group.key)}
                  onFocus={() => setActiveGroup(group.key)}
                  onClick={() => focusFirstAccount(group.key)}
                  onKeyDown={(event) => handleGroupKeyDown(event, groupIndex)}
                >
                  <span>{group.label}</span>
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <div className="invoice-batch-payment-accounts" role="group" aria-label="付款账户">
            {activeAccounts.length ? activeAccounts.map((account, accountIndex) => {
              const accountId = getPayoutAccountId(account);
              const selected = accountId === value;
              return (
                <button
                  key={accountId}
                  ref={(node) => { accountRefs.current[accountIndex] = node; }}
                  className={selected ? 'is-selected' : ''}
                  type="button"
                  role="treeitem"
                  aria-selected={selected}
                  tabIndex={-1}
                  onClick={() => {
                    onChange(accountId);
                    closeAndFocusTrigger();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onChange(accountId);
                      closeAndFocusTrigger();
                      return;
                    }
                    handleAccountKeyDown(event, accountIndex);
                  }}
                >
                  <span>
                    <strong>{account.nickname}</strong>
                    <small>{getPayoutAccountSummary(account)} · {getPayoutAccountIdentifier(account)}</small>
                  </span>
                  {selected ? <Check size={15} aria-hidden="true" /> : null}
                </button>
              );
            }) : (
              <div className="invoice-batch-payment-empty">暂无可用账户</div>
            )}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

function BatchRowTable({
  rows,
  context,
  mode,
  onlyProblems,
  onChange,
  onOpenCreatorPaymentInformation,
  onPreview,
}: {
  rows: InvoiceBatchRow[];
  context: InvoiceBatchContext;
  mode: InvoiceBatchMode;
  onlyProblems: boolean;
  onChange: (engagementId: EngagementId, patch: Partial<InvoiceBatchRow>) => void;
  onOpenCreatorPaymentInformation: (creatorId: CreatorId) => void;
  onPreview: (row: InvoiceBatchRow) => void;
}) {
  const visibleRows = onlyProblems
    ? rows.filter((row) => !['READY', 'GENERATED'].includes(row.status))
    : rows;

  return (
    <div className="invoice-batch-table-wrap">
      <table className="invoice-batch-table">
        <thead>
          <tr>
            <th>达人</th>
            <th>Description</th>
            <th>Price</th>
            <th>Amount</th>
            <th>Total</th>
            <th>币种</th>
            <th>Payment Information</th>
            <th>合同</th>
            <th>状态</th>
            <th className="invoice-batch-preview-heading">预览</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => {
            const availableContracts = availableContractsForEngagement(
              row.engagementId,
              context.contracts,
              { projectId: row.projectId, creatorId: row.creatorId },
            );
            const meta = STATUS_META[row.status];
            const rowLocked = row.status === 'GENERATED' || row.status === 'GENERATING';
            const creator = context.creators.find((item) => item.id === row.creatorId);
            const payoutAccounts = eligibleInvoicePayoutAccounts(creator);
            const selectedAccount = payoutAccounts.find((account) => (
              getPayoutAccountId(account) === row.payoutAccountId
            ));
            return (
              <tr
                key={row.engagementId}
                className={row.status === 'GENERATED' ? 'is-generated' : ''}
                data-engagement-id={row.engagementId}
                data-creator-id={row.creatorId}
              >
                <td data-label="达人">
                  <button
                    className="invoice-batch-creator-link"
                    type="button"
                    onClick={() => onOpenCreatorPaymentInformation(row.creatorId)}
                  >
                    {row.creatorName}
                  </button>
                  <small>{row.creatorHandle}</small>
                </td>
                <td data-label="Description">
                  <div className="invoice-batch-line-stack">
                    {row.items.map((item, itemIndex) => (
                      <input
                        key={item.id}
                        aria-label={`${row.creatorName} 第 ${itemIndex + 1} 条 Description`}
                        value={item.description}
                        readOnly={mode === 'SHARED_DESCRIPTION'}
                        disabled={rowLocked}
                        onChange={(event) => onChange(row.engagementId, {
                          items: updateInvoiceBatchLineItem(row.items, item.id, {
                            description: event.target.value,
                          }),
                        })}
                      />
                    ))}
                  </div>
                </td>
                <td data-label="Price">
                  <div className="invoice-batch-line-stack">
                    {row.items.map((item, itemIndex) => (
                      <input
                        key={item.id}
                        aria-label={`${row.creatorName} 第 ${itemIndex + 1} 条 Price`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.unitPrice || ''}
                        disabled={rowLocked}
                        onChange={(event) => onChange(row.engagementId, {
                          items: updateInvoiceBatchLineItem(row.items, item.id, {
                            unitPrice: Number(event.target.value),
                          }),
                        })}
                      />
                    ))}
                  </div>
                </td>
                <td data-label="Amount">
                  <div className="invoice-batch-line-stack">
                    {row.items.map((item, itemIndex) => (
                      <input
                        key={item.id}
                        aria-label={`${row.creatorName} 第 ${itemIndex + 1} 条 Amount`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity || ''}
                        disabled={rowLocked}
                        onChange={(event) => onChange(row.engagementId, {
                          items: updateInvoiceBatchLineItem(row.items, item.id, {
                            quantity: Number(event.target.value),
                          }),
                        })}
                      />
                    ))}
                  </div>
                </td>
                <td data-label="Total">
                  <div className="invoice-batch-line-stack invoice-batch-line-totals">
                    {row.items.map((item) => (
                      <strong key={item.id}>
                        {formatInvoiceMoney(row.currency || INVOICE_BATCH_PROTOTYPE_CURRENCY, item.lineTotal)}
                      </strong>
                    ))}
                  </div>
                  {row.items.length > 1 ? (
                    <small className="invoice-batch-row-total">
                      合计 {formatInvoiceMoney(row.currency || INVOICE_BATCH_PROTOTYPE_CURRENCY, rowTotal(row))}
                    </small>
                  ) : null}
                </td>
                <td data-label="币种">
                  <span className="invoice-batch-fixed-value">
                    <strong>{row.currency || '-'}</strong>
                    <small>当前批次</small>
                  </span>
                </td>
                <td data-label="Payment Information">
                  <PaymentInformationCascader
                    ariaLabel={`${row.creatorName} Payment Information`}
                    value={row.payoutAccountId}
                    disabled={rowLocked || row.payoutAccountLocked}
                    accounts={payoutAccounts}
                    onChange={(payoutAccountId) => onChange(row.engagementId, {
                      payoutAccountId,
                      payoutAccountLocked: false,
                    })}
                  />
                  {selectedAccount ? (
                    <small className="invoice-batch-payment-meta">
                      {getPayoutAccountSummary(selectedAccount)} · {getPayoutAccountIdentifier(selectedAccount)}
                    </small>
                  ) : null}
                </td>
                <td data-label="合同">
                  {availableContracts.length === 0 ? (
                    <span className="invoice-batch-empty-value">未关联合同</span>
                  ) : availableContracts.length === 1 ? (
                    <span className="invoice-batch-locked-value">{availableContracts[0].id}</span>
                  ) : (
                    <select
                      aria-label={`${row.creatorName} 合同`}
                      value={row.contractIds[0] ?? ''}
                      disabled={rowLocked}
                      onChange={(event) => onChange(row.engagementId, {
                        contractIds: event.target.value
                          ? [event.target.value as ContractId]
                          : [],
                        payoutAccountLocked: false,
                      })}
                    >
                      <option value="">待选择</option>
                      {availableContracts.map((contract) => (
                        <option key={contract.contractId} value={contract.contractId}>
                          {contract.id}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td data-label="状态">
                  <span className={`invoice-batch-status tone-${meta.tone}`}>{meta.label}</span>
                  {row.issues.length ? (
                    <span className="invoice-batch-row-issue" title={row.issues.join('；')}>
                      {row.issues[0]}
                    </span>
                  ) : null}
                </td>
                <td data-label="预览" className="invoice-batch-preview-cell">
                  <button
                    type="button"
                    className="invoice-batch-preview-button"
                    aria-label={`预览 ${row.creatorName} 的 Invoice`}
                    title="预览 Invoice"
                    onClick={() => onPreview(row)}
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!visibleRows.length ? (
        <div className="invoice-batch-empty">
          {onlyProblems ? '当前没有需要处理的问题行' : '请先选择项目达人'}
        </div>
      ) : null}
    </div>
  );
}

export function InvoiceBatchBuilderPage({
  creators,
  payouts,
  projects,
  contracts,
  invoiceEntity,
  generatedInvoices,
  onGenerated,
  onDirtyChange,
  onCancel,
  onOpenInvoiceManagement,
  onOpenCreatorPaymentInformation,
}: InvoiceBatchBuilderPageProps) {
  const [mode, setMode] = useState<InvoiceBatchMode>('SHARED_DESCRIPTION');
  const [projectId, setProjectId] = useState('');
  const [selectedEngagementIds, setSelectedEngagementIds] = useState<EngagementId[]>([]);
  const [creatorSearch, setCreatorSearch] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayInputValue());
  const [currency, setCurrency] = useState<InvoiceCurrency>(INVOICE_BATCH_PROTOTYPE_CURRENCY);
  const [sharedDescriptions, setSharedDescriptions] = useState<InvoiceBatchLineItemSeed[]>(
    () => [createSharedDescription()],
  );
  const [rows, setRows] = useState<InvoiceBatchRow[]>([]);
  const [batchId] = useState(() => createPrototypeId('batch'));
  const [draftEngagementIds] = useState<Record<string, EngagementId>>(() => Object.fromEntries(
    projects.flatMap((project) => creators.map((creator) => {
      const projectId = projectIdFor(project);
      return [
        `${creator.id}:${projectId}`,
        findExistingEngagementId({
          project,
          creatorId: creator.id as CreatorId,
          contracts,
          invoices: generatedInvoices,
        }) ?? createPrototypeId('engagement') as EngagementId,
      ];
    })),
  ));
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importIssues, setImportIssues] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [generationError, setGenerationError] = useState('');
  const [preview, setPreview] = useState<{
    creatorName: string;
    model: InvoiceDocumentModel;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const prototypeCreators = useMemo(
    () => withInvoiceBatchPrototypeAccounts(creators),
    [creators],
  );
  const invoiceProjects = useMemo(() => projects.map((project) => {
    const stableProjectId = projectIdFor(project);
    return {
      ...project,
      creatorProfiles: creators.map((creator) => ({
        creatorId: creator.id as CreatorId,
        projectId: stableProjectId,
        engagementId: draftEngagementIds[`${creator.id}:${stableProjectId}`],
        status: 'active' as const,
        name: creator.name,
        handle: creator.handle,
        platform: creator.platform,
      })),
    };
  }), [creators, draftEngagementIds, projects]);
  const selectedProject = invoiceProjects.find((project) => projectIdFor(project) === projectId) ?? null;
  const context = useMemo<InvoiceBatchContext | null>(() => selectedProject ? ({
    project: selectedProject,
    creators: prototypeCreators,
    payouts,
    contracts,
    generatedInvoices,
    invoiceEntity,
  }) : null, [
    contracts,
    generatedInvoices,
    invoiceEntity,
    payouts,
    prototypeCreators,
    selectedProject,
  ]);
  const projectReferences = selectedProject?.creatorProfiles ?? [];
  const filteredProjectReferences = useMemo(
    () => filterInvoiceBatchCreatorReferences(projectReferences, creatorSearch),
    [creatorSearch, projectReferences],
  );
  const selectableEngagementIds = useMemo(
    () => selectableInvoiceBatchEngagementIds(
      projectReferences,
      generatedInvoices,
      INVOICE_BATCH_MAX_ROWS,
    ),
    [generatedInvoices, projectReferences],
  );
  const prototypeSeed = useMemo(
    () => createInvoiceBatchPrototypeSeed(invoiceProjects, generatedInvoices),
    [generatedInvoices, invoiceProjects],
  );
  const lockedEngagementIds = rows
    .filter((row) => row.status === 'GENERATED' || row.status === 'GENERATING')
    .map((row) => row.engagementId);
  const allSelectableSelected = Boolean(selectableEngagementIds.length)
    && selectableEngagementIds.every((id) => selectedEngagementIds.includes(id));
  const hasPendingRows = rows.some((row) => row.status !== 'GENERATED');
  const hasGeneratedRows = rows.some((row) => row.status === 'GENERATED');
  const isDirty = Boolean(
    rows.length
    || selectedEngagementIds.length
    || sharedDescriptions.some((item) => item.description.trim())
    || currency !== INVOICE_BATCH_PROTOTYPE_CURRENCY
  );

  useEffect(() => {
    onDirtyChange(isDirty && hasPendingRows);
  }, [hasPendingRows, isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty || !hasPendingRows) return undefined;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [hasPendingRows, isDirty]);

  const projectOptions = projects.map((project) => ({
    value: projectIdFor(project),
    label: project.name,
    description: `${project.cooperationProjectCode ?? project.projectCode ?? project.id} · ${creators.length} 位达人可选 · 飞书合作项目`,
  }));

  const setProject = (value: string) => {
    setProjectId(value);
    setSelectedEngagementIds([]);
    setCreatorSearch('');
    setRows([]);
    setImportIssues([]);
    setGenerationError('');
    setGenerationProgress({ current: 0, total: 0 });
  };

  const fillPrototypeData = () => {
    if (!prototypeSeed) return;
    const project = invoiceProjects.find((candidate) => (
      projectIdFor(candidate) === prototypeSeed.projectId
    ));
    if (!project) return;

    const descriptionSeed = {
      templateKey: createPrototypeId('item'),
      description: prototypeSeed.description,
    };
    const demoContext: InvoiceBatchContext = {
      project,
      creators: prototypeCreators,
      payouts,
      contracts,
      generatedInvoices,
      invoiceEntity,
    };
    const demoRows = prototypeSeed.rows.map((seed) => {
      const initial = createInvoiceBatchRow({
        ...demoContext,
        engagementId: seed.engagementId,
        invoiceDate,
        currency: prototypeSeed.currency,
        lineItems: [descriptionSeed],
      });
      const account = eligibleInvoicePayoutAccounts(
        prototypeCreators.find((creator) => creator.id === initial.creatorId),
      ).find((candidate) => candidate.provider === seed.payoutProvider);
      return updateAndValidateInvoiceBatchRow(initial, {
        currency: prototypeSeed.currency,
        payoutAccountId: account ? getPayoutAccountId(account) : initial.payoutAccountId,
        payoutAccountLocked: false,
        items: updateInvoiceBatchLineItem(initial.items, initial.items[0].id, {
          unitPrice: seed.unitPrice,
          quantity: seed.quantity,
        }),
      }, demoContext);
    });

    setMode('SHARED_DESCRIPTION');
    setProjectId(prototypeSeed.projectId);
    setSelectedEngagementIds(prototypeSeed.rows.map((row) => row.engagementId));
    setCreatorSearch('');
    setCurrency(prototypeSeed.currency);
    setSharedDescriptions([descriptionSeed]);
    setRows(demoRows);
    setOnlyProblems(false);
    setImportIssues([]);
    setGenerationError('');
    setGenerationProgress({ current: 0, total: 0 });
  };

  const applySelection = (nextIds: EngagementId[]) => {
    setSelectedEngagementIds(nextIds);
    if (!context) {
      setRows([]);
      return;
    }
    setRows((current) => nextIds.map((engagementId) => (
      current.find((row) => row.engagementId === engagementId)
      ?? createInvoiceBatchRow({
        ...context,
        engagementId,
        invoiceDate,
        currency,
        lineItems: mode === 'SHARED_DESCRIPTION'
          ? sharedDescriptions
          : [createSharedDescription()],
      })
    )));
  };

  const toggleEngagement = (engagementId: EngagementId) => {
    if (lockedEngagementIds.includes(engagementId)) return;
    const existing = generatedInvoices.some(
      (record) => record.snapshot.engagementId === engagementId,
    );
    if (existing) return;
    const nextIds = selectedEngagementIds.includes(engagementId)
      ? selectedEngagementIds.filter((id) => id !== engagementId)
      : selectedEngagementIds.length < INVOICE_BATCH_MAX_ROWS
        ? [...selectedEngagementIds, engagementId]
        : selectedEngagementIds;
    applySelection(nextIds);
  };

  const toggleSelectAll = () => {
    const nextIds = allSelectableSelected
      ? lockedEngagementIds
      : [...new Set([...lockedEngagementIds, ...selectableEngagementIds])];
    applySelection(nextIds.slice(0, INVOICE_BATCH_MAX_ROWS));
  };

  const changeMode = (nextMode: InvoiceBatchMode) => {
    if (nextMode === mode) return;
    if (
      nextMode === 'XLSX_IMPORT'
      && rows.some((row) => row.status !== 'GENERATED' && row.items.length > 1)
      && !window.confirm('分别填写模式首期每张 Invoice 只支持 1 条费用明细，切换后将仅保留每位达人的第 1 条，确定继续吗？')
    ) return;
    setMode(nextMode);
    setImportIssues([]);
    if (!context) return;
    setRows((current) => current.map((row) => {
      if (row.status === 'GENERATED') return row;
      const items = nextMode === 'SHARED_DESCRIPTION'
        ? synchronizeInvoiceBatchLineItems(row.items, sharedDescriptions)
        : row.items.slice(0, 1);
      return updateAndValidateInvoiceBatchRow(row, { items }, context);
    }));
  };

  const applySharedDescriptions = (nextDescriptions: InvoiceBatchLineItemSeed[]) => {
    setSharedDescriptions(nextDescriptions);
    if (!context) return;
    setRows((current) => current.map((row) => (
      row.status === 'GENERATED'
        ? row
        : updateAndValidateInvoiceBatchRow(row, {
          items: synchronizeInvoiceBatchLineItems(row.items, nextDescriptions),
        }, context)
    )));
  };

  const updateSharedDescription = (templateKey: string, description: string) => {
    applySharedDescriptions(sharedDescriptions.map((item) => (
      item.templateKey === templateKey ? { ...item, description } : item
    )));
  };

  const addSharedDescription = () => {
    applySharedDescriptions([...sharedDescriptions, createSharedDescription()]);
  };

  const removeSharedDescription = (templateKey: string) => {
    if (sharedDescriptions.length === 1) return;
    applySharedDescriptions(sharedDescriptions.filter((item) => item.templateKey !== templateKey));
  };

  const updateRow = (engagementId: EngagementId, patch: Partial<InvoiceBatchRow>) => {
    if (!context) return;
    setRows((current) => current.map((row) => (
      row.engagementId === engagementId
        ? updateAndValidateInvoiceBatchRow(row, patch, context)
        : row
    )));
  };

  const updateAllRows = (patch: Partial<InvoiceBatchRow>) => {
    if (!context) return;
    setRows((current) => current.map((row) => (
      row.status === 'GENERATED'
        ? row
        : updateAndValidateInvoiceBatchRow(row, patch, context)
    )));
  };

  const exportTemplate = async () => {
    if (!selectedProject || !rows.length) return;
    const blob = await exportInvoiceBatchWorkbook({
      batchId,
      projectId: projectId as ProjectId,
      invoiceDate,
    }, rows);
    downloadBlob(
      blob,
      `COMETS-Invoice-Batch-${selectedProject.projectCode ?? selectedProject.id}.xlsx`,
    );
  };

  const importTemplate = async (file: File) => {
    setImportIssues([]);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setImportIssues(['仅支持系统导出的 .xlsx 模板']);
      return;
    }
    if (!file.size || file.size > INVOICE_BATCH_MAX_FILE_SIZE) {
      setImportIssues(['文件不能为空，且大小不能超过 5 MB']);
      return;
    }
    setImporting(true);
    try {
      const result = await importInvoiceBatchWorkbook(await file.arrayBuffer(), {
        batchId,
        projectId,
        rows: rows.map((row) => ({
          engagementId: row.engagementId,
          creatorId: row.creatorId,
        })),
      });
      const extraIssues = [...result.issues];
      if (context) {
        setRows((current) => current.map((row) => {
          const value = result.values.find((item) => item.engagementId === row.engagementId);
          if (!value) return updateAndValidateInvoiceBatchRow(row, {}, context);
          if (value.creatorId !== row.creatorId || value.projectId !== row.projectId) {
            extraIssues.push(`${row.creatorName} 的稳定 ID 被修改`);
            return {
              ...row,
              status: 'CONFLICT',
              issues: [...new Set([
                ...row.issues,
                '模板中的达人稳定 ID 与当前合作关系不一致',
              ])],
            };
          }
          return updateAndValidateInvoiceBatchRow(row, {
            items: row.items[0] ? updateInvoiceBatchLineItem(row.items, row.items[0].id, {
              description: value.description,
              unitPrice: value.unitPrice,
              quantity: value.quantity,
            }).slice(0, 1) : row.items,
          }, context);
        }));
      }
      setImportIssues([...new Set(extraIssues)]);
    } catch (error) {
      setImportIssues([
        error instanceof Error
          ? `模板解析失败：${error.message}`
          : '模板损坏或无法解析',
      ]);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const generateBatch = async () => {
    if (!context) return;
    setGenerationError('');
    let workingRows = rows.map((row) => validateInvoiceBatchRow(row, context));
    const candidates = workingRows.filter((row) => row.status === 'READY');
    setRows(workingRows);
    if (!candidates.length) {
      setGenerationError('当前没有可生成的 Invoice，请先处理问题行。');
      return;
    }
    setGenerating(true);
    setGenerationProgress({ current: 0, total: candidates.length });
    const successfulRecords: GeneratedInvoiceRecord[] = [];

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      workingRows = workingRows.map((row) => (
        row.engagementId === candidate.engagementId
          ? { ...row, status: 'GENERATING', issues: [] }
          : row
      ));
      setRows([...workingRows]);
      try {
        const invoiceNumber = nextInvoiceNumber([...generatedInvoices, ...successfulRecords]);
        const snapshot = buildInvoiceDocumentForBatchRow(candidate, context, invoiceNumber);
        const { generateInvoiceFiles } = await import('../invoice/generateInvoice');
        const { pdfBlob, docxBlob } = await generateInvoiceFiles(snapshot);
        const record = createGeneratedInvoiceRecord(candidate, snapshot);
        successfulRecords.push(record);
        workingRows = workingRows.map((row) => (
          row.engagementId === candidate.engagementId
            ? {
              ...row,
              status: 'GENERATED',
              issues: [],
              generated: { record, pdfBlob, docxBlob },
            }
            : row
        ));
      } catch (error) {
        const message = error instanceof Error ? error.message : '文件生成失败';
        workingRows = workingRows.map((row) => (
          row.engagementId === candidate.engagementId
            ? { ...row, status: 'FAILED', issues: [message] }
            : row
        ));
      }
      setRows([...workingRows]);
      setGenerationProgress({ current: index + 1, total: candidates.length });
    }

    if (successfulRecords.length) onGenerated(successfulRecords);
    setGenerating(false);
  };

  const downloadZip = async () => {
    const generatedRows = rows.filter((row) => row.generated);
    if (!generatedRows.length) return;
    const blob = await createInvoiceBatchArchive(generatedRows.flatMap((row) => (
      row.generated ? [{
        pdfFilename: invoiceFilename(row.generated.record.snapshot, 'pdf'),
        docxFilename: invoiceFilename(row.generated.record.snapshot, 'docx'),
        pdfBlob: row.generated.pdfBlob,
        docxBlob: row.generated.docxBlob,
      }] : []
    )));
    downloadBlob(
      blob,
      `COMETS-Invoice-Batch-${selectedProject?.projectCode ?? 'result'}.zip`,
    );
  };

  const leave = () => {
    if (
      isDirty
      && hasPendingRows
      && !window.confirm('当前批量生成内容尚未完成，确定离开吗？')
    ) return;
    onDirtyChange(false);
    onCancel();
  };

  const openPreview = (row: InvoiceBatchRow) => {
    if (!context) return;
    try {
      const model = row.generated?.record.snapshot ?? buildInvoiceDocumentForBatchRow(
        row,
        context,
        `INV-PREVIEW-${row.creatorId}`,
      );
      setPreview({ creatorName: row.creatorName, model });
    } catch (error) {
      setGenerationError(error instanceof Error ? `无法预览：${error.message}` : '当前行无法预览');
    }
  };

  const readyRows = rows.filter((row) => row.status === 'READY');
  const problemRows = rows.filter((row) => (
    ['NEEDS_INPUT', 'CONFLICT', 'FAILED'].includes(row.status)
  ));
  const generatedRows = rows.filter((row) => row.status === 'GENERATED');
  const batchTotal = rows
    .filter((row) => ['READY', 'GENERATED'].includes(row.status))
    .reduce((result, row) => result + rowTotal(row), 0);

  return (
    <div
      className="page-stack invoice-batch-page"
      data-batch-id={batchId}
      data-project-id={projectId}
    >
      <PageHeading
        title="批量生成 Invoice"
        subtitle="在同一份长表单内选择合作项目达人、填写费用并完成批量校验与生成。"
        actions={(
          <>
            <Button
              variant="secondary"
              icon={<Sparkles size={17} />}
              data-testid="invoice-batch-fill-demo"
              disabled={!prototypeSeed || generating || hasGeneratedRows}
              onClick={fillPrototypeData}
            >
              填充演示数据
            </Button>
            <Button variant="secondary" icon={<ArrowLeft size={17} />} onClick={leave}>
              返回
            </Button>
          </>
        )}
      />

      <section className="invoice-builder-form invoice-batch-form">
        <section
          className="invoice-builder-section invoice-batch-card"
          data-batch-section="mode"
        >
          <header>
            <span><FileText size={18} /></span>
            <div>
              <h2>批量填写方式</h2>
              <p>选择统一费用说明，或通过系统 XLSX 模板分别填写每位达人。</p>
            </div>
          </header>
          <div className="invoice-batch-mode-segment" role="radiogroup" aria-label="批量填写方式">
            <button
              type="button"
              className={mode === 'SHARED_DESCRIPTION' ? 'is-selected' : ''}
              role="radio"
              aria-checked={mode === 'SHARED_DESCRIPTION'}
              onClick={() => changeMode('SHARED_DESCRIPTION')}
            >
              <FileText size={18} />
              <span><strong>统一 Description</strong><small>所有达人使用相同费用说明</small></span>
              {mode === 'SHARED_DESCRIPTION' ? <CheckCircle2 size={18} /> : null}
            </button>
            <button
              type="button"
              className={mode === 'XLSX_IMPORT' ? 'is-selected' : ''}
              role="radio"
              aria-checked={mode === 'XLSX_IMPORT'}
              onClick={() => changeMode('XLSX_IMPORT')}
            >
              <FileSpreadsheet size={18} />
              <span><strong>分别填写 Description</strong><small>下载并导入逐人费用模板</small></span>
              {mode === 'XLSX_IMPORT' ? <CheckCircle2 size={18} /> : null}
            </button>
          </div>
        </section>

        <section
          className="invoice-builder-section invoice-batch-card"
          data-batch-section="creators"
        >
          <header>
            <span><Users size={18} /></span>
            <div>
              <h2>选择合作项目与达人</h2>
              <p>单批限定一个项目，最多选择 {INVOICE_BATCH_MAX_ROWS} 位达人。</p>
            </div>
          </header>
          <div className="invoice-form-grid invoice-batch-project-grid">
            <div className="invoice-form-control full-width">
              <span>合作项目 *</span>
              <SelectField
                ariaLabel="批量 Invoice 项目"
                variant="form"
                value={projectId}
                options={projectOptions}
                placeholder="选择可编辑项目"
                onChange={setProject}
              />
              <small />
            </div>
          </div>

          {selectedProject ? (
            <div className="invoice-batch-creator-picker">
              <div className="invoice-batch-creator-toolbar">
                <div>
                  <strong>达人档案</strong>
                  <span aria-live="polite">
                    已选 {selectedEngagementIds.length}/{Math.min(
                      selectableEngagementIds.length,
                      INVOICE_BATCH_MAX_ROWS,
                    )}
                  </span>
                </div>
                <label className="invoice-batch-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    value={creatorSearch}
                    placeholder="搜索达人姓名、Handle 或平台"
                    aria-label="搜索达人档案"
                    onChange={(event) => setCreatorSearch(event.target.value)}
                  />
                </label>
                <button
                  className="invoice-batch-select-all"
                  type="button"
                  disabled={!selectableEngagementIds.length}
                  onClick={toggleSelectAll}
                >
                  <Check size={15} />
                  {allSelectableSelected ? '取消全选' : '全选可生成达人'}
                </button>
              </div>

              <div className="invoice-batch-creator-grid">
                {filteredProjectReferences.map((reference) => {
                  const existing = generatedInvoices.find(
                    (invoice) => invoice.snapshot.engagementId === reference.engagementId,
                  );
                  const selected = selectedEngagementIds.includes(reference.engagementId);
                  const locked = lockedEngagementIds.includes(reference.engagementId);
                  const disabled = Boolean(existing) || (
                    !selected && selectedEngagementIds.length >= INVOICE_BATCH_MAX_ROWS
                  );
                  return (
                    <label
                      className={[
                        'invoice-batch-creator',
                        selected ? 'is-selected' : '',
                        disabled ? 'is-disabled' : '',
                      ].filter(Boolean).join(' ')}
                      key={reference.engagementId}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={disabled || locked}
                        onChange={() => toggleEngagement(reference.engagementId)}
                      />
                      <span className="invoice-batch-creator-check"><Check size={13} /></span>
                      <span>
                        <strong>{reference.name}</strong>
                        <small>{reference.handle} · {reference.platform}</small>
                      </span>
                      {existing ? (
                        <em>已有 {existing.id}</em>
                      ) : (
                        <em className="is-ready">默认空中云汇</em>
                      )}
                    </label>
                  );
                })}
              </div>
              {!filteredProjectReferences.length ? (
                <div className="invoice-batch-search-empty">没有匹配的项目达人</div>
              ) : null}
            </div>
          ) : (
            <div className="invoice-batch-empty-state">
              <Users size={22} />
              <strong>先选择项目</strong>
              <span>选择后可搜索、全选或逐个勾选项目内达人。</span>
            </div>
          )}
        </section>

        <section
          className="invoice-builder-section invoice-batch-card"
          data-batch-section="common"
        >
          <header>
            <span><ReceiptText size={18} /></span>
            <div>
              <h2>Invoice 公共信息</h2>
              <p>当前继续使用预置假数据，用于完整展示批量生成与 Invoice 预览流程。</p>
            </div>
          </header>
          <div className="invoice-batch-prototype-notice">
            <NoticeBanner>
              <strong>原型数据提示：</strong>
              以下 Payment Information 均为预置假数据，仅用于界面和流程展示；正式系统将根据达人档案带入已验证的具体付款信息。
            </NoticeBanner>
          </div>
          <div className="invoice-form-grid invoice-batch-common-grid">
            <label>
              <span>Invoice 日期 *</span>
              <input
                type="date"
                value={invoiceDate}
                onChange={(event) => {
                  setInvoiceDate(event.target.value);
                  updateAllRows({ invoiceDate: event.target.value });
                }}
              />
              <small />
            </label>
            <div className="invoice-form-control">
              <span>币种 *</span>
              <SelectField
                ariaLabel="批量 Invoice 币种"
                variant="form"
                value={currency}
                options={INVOICE_BATCH_CURRENCY_OPTIONS}
                disabled={generating || hasGeneratedRows}
                onChange={(value) => {
                  setCurrency(value);
                  updateAllRows({ currency: value });
                }}
              />
              <p className="invoice-batch-currency-note">
                {hasGeneratedRows ? '已有生成结果，币种已锁定' : '整批 Invoice 使用同一币种'}
              </p>
            </div>
            {mode === 'SHARED_DESCRIPTION' ? (
              <div className="invoice-form-control full-width invoice-batch-description-items">
                <div className="invoice-line-header">
                  <span>
                    <strong>统一 Description *</strong>
                    <small>所有达人共用相同明细，Price 与 Amount 在下方逐人填写。</small>
                  </span>
                  <Button
                    variant="secondary"
                    icon={<Plus size={15} />}
                    onClick={addSharedDescription}
                  >
                    新增 Description
                  </Button>
                </div>
                <div className="invoice-batch-description-list">
                  {sharedDescriptions.map((item, index) => (
                    <div className="invoice-batch-description-row" key={item.templateKey}>
                      <label>
                        <span>DESCRIPTION {index + 1}</span>
                        <input
                          value={item.description}
                          placeholder={index === 0
                            ? '例如：YouTube Dedicated Video 合作服务费'
                            : '填写下一条统一费用说明'}
                          aria-label={`第 ${index + 1} 条统一 Description`}
                          onChange={(event) => updateSharedDescription(
                            item.templateKey,
                            event.target.value,
                          )}
                        />
                        <small />
                      </label>
                      <button
                        className="invoice-line-remove"
                        type="button"
                        aria-label={`删除第 ${index + 1} 条统一 Description`}
                        title={index === 0 ? '第一条 Description 必须保留' : '删除 Description'}
                        disabled={index === 0}
                        onClick={() => removeSharedDescription(item.templateKey)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="invoice-form-control full-width">
                <span>逐人费用模板</span>
                <div className="invoice-batch-import-panel">
                  <div>
                    <FileSpreadsheet size={21} />
                    <span>
                      <strong>下载当前已选达人的 XLSX 模板</strong>
                      <small>填写 Description、Price 与 Amount 后上传，稳定 ID 列不可修改。</small>
                    </span>
                  </div>
                  <div>
                    <Button
                      variant="secondary"
                      icon={<Download size={16} />}
                      disabled={!rows.length}
                      onClick={() => void exportTemplate()}
                    >
                      下载模板
                    </Button>
                    <Button
                      icon={<Upload size={16} />}
                      disabled={importing || !rows.length}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {importing ? '正在解析' : '上传模板'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      hidden
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void importTemplate(file);
                      }}
                    />
                  </div>
                </div>
                <small />
              </div>
            )}
          </div>
          {importIssues.length ? (
            <div className="invoice-batch-alert" role="alert">
              <AlertTriangle size={18} />
              <div>
                <strong>模板有 {importIssues.length} 项需要处理</strong>
                <span>{importIssues.slice(0, 3).join('；')}</span>
              </div>
            </div>
          ) : null}
        </section>

        <section
          className="invoice-builder-section invoice-batch-card"
          data-batch-section="validation"
        >
          <header className="invoice-batch-section-heading">
            <span><ListChecks size={18} /></span>
            <div>
              <h2>逐人费用与校验</h2>
              <p>填写每位达人的 Price 和 Amount，系统实时计算 Total 并校验关联资料。</p>
            </div>
            <label className="invoice-batch-problem-filter">
              <input
                type="checkbox"
                checked={onlyProblems}
                onChange={(event) => setOnlyProblems(event.target.checked)}
              />
              只看问题行
            </label>
          </header>

          <dl className="invoice-batch-summary" aria-label="批量 Invoice 校验汇总">
            <div className="invoice-batch-metric-card">
              <dt>已选择达人</dt>
              <dd>{rows.length}</dd>
            </div>
            <div className="invoice-batch-metric-card is-ready">
              <dt>可生成invoice</dt>
              <dd>{readyRows.length}</dd>
            </div>
            <div className="invoice-batch-metric-card is-problem">
              <dt>需处理条数</dt>
              <dd>{problemRows.length}</dd>
            </div>
            <div className="invoice-batch-metric-card is-total">
              <dt>批次总金额</dt>
              <dd>{batchTotal ? formatInvoiceMoney(currency, batchTotal) : '-'}</dd>
            </div>
          </dl>

          {generationError ? (
            <div className="invoice-batch-alert" role="alert">
              <AlertTriangle size={18} />
              <div><strong>无法开始生成</strong><span>{generationError}</span></div>
            </div>
          ) : null}

          {context ? (
            <BatchRowTable
              rows={rows}
              context={context}
              mode={mode}
              onlyProblems={onlyProblems}
              onChange={updateRow}
              onOpenCreatorPaymentInformation={onOpenCreatorPaymentInformation}
              onPreview={openPreview}
            />
          ) : (
            <div className="invoice-batch-empty">请先选择项目和达人</div>
          )}
        </section>

        <InvoiceBatchResultSection
          rows={rows}
          creators={prototypeCreators}
          contracts={contracts}
          fallbackCurrency={currency}
          onDownloadZip={() => void downloadZip()}
        />

        <footer className="invoice-builder-footer invoice-batch-footer">
          {generatedRows.length ? (
            <Button variant="secondary" onClick={onOpenInvoiceManagement}>
              查看 Invoice 管理
            </Button>
          ) : null}
          <Button variant="secondary" onClick={leave}>取消</Button>
          <Button
            icon={generating
              ? <RefreshCw className="is-spinning" size={16} />
              : <PackageCheck size={16} />}
            disabled={generating || !readyRows.length}
            onClick={() => void generateBatch()}
          >
            {generating
              ? `正在生成 ${generationProgress.current}/${generationProgress.total}`
              : readyRows.length
                ? `批量生成 ${readyRows.length} 张 Invoice`
                : generatedRows.length && !problemRows.length
                  ? '已全部生成'
                  : '批量生成 Invoice'}
          </Button>
        </footer>
      </section>

      {preview ? (
        <Modal
          title={`${preview.creatorName} · Invoice 预览`}
          width="980px"
          className="invoice-batch-preview-modal"
          onClose={() => setPreview(null)}
          footer={<Button variant="secondary" onClick={() => setPreview(null)}>关闭</Button>}
        >
          <div className="invoice-batch-preview-meta">
            <span>即时预览</span>
            <small>展示当前未保存的 Description、金额与 Payment Information，不消耗正式 Invoice 编号。</small>
          </div>
          <div className="invoice-batch-preview-canvas">
            <InvoiceDocumentView
              model={preview.model}
              ariaLabel={`${preview.creatorName} Invoice 大图预览`}
            />
          </div>
        </Modal>
      ) : null}

      <span className="sr-only">模板版本 {INVOICE_BATCH_SCHEMA_VERSION}</span>
    </div>
  );
}
