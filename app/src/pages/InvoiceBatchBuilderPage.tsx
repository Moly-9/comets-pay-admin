import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  ListChecks,
  PackageCheck,
  Eye,
  ReceiptText,
  RefreshCw,
  Search,
  Upload,
  Users,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createPrototypeId,
  type ContractId,
  type CreatorId,
  type EngagementId,
  type ProjectId,
} from '../businessWorkflow';
import { Button, Modal, PageHeading, SelectField } from '../components/Common';
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
  updateAndValidateInvoiceBatchRow,
  validateInvoiceBatchRow,
  type InvoiceBatchContext,
} from '../invoice/invoiceBatch';
import { createInvoiceBatchArchive } from '../invoice/invoiceBatchArchive';
import {
  INVOICE_BATCH_PROTOTYPE_ACCOUNT_LABEL,
  INVOICE_BATCH_PROTOTYPE_CURRENCY,
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
  GeneratedInvoiceRecord,
  InvoiceBatchMode,
  InvoiceBatchRow,
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

const projectIdFor = (project: ProjectSummary) => (
  (project.projectId ?? project.id) as ProjectId
);

const rowTotal = (row: Pick<InvoiceBatchRow, 'unitPrice' | 'quantity'>) => (
  Math.round(row.unitPrice * row.quantity * 100) / 100
);

const paymentInformationLabel = (provider: 'Airwallex' | 'PayPal' | 'PayMax') => (
  provider === 'PayPal' ? 'Paid by PayPal' : 'Paid by Bank'
);

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
                  <input
                    aria-label={`${row.creatorName} Description`}
                    value={row.description}
                    readOnly={mode === 'SHARED_DESCRIPTION'}
                    disabled={rowLocked}
                    onChange={(event) => onChange(
                      row.engagementId,
                      { description: event.target.value },
                    )}
                  />
                </td>
                <td data-label="Price">
                  <input
                    aria-label={`${row.creatorName} Price`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={row.unitPrice || ''}
                    disabled={rowLocked}
                    onChange={(event) => onChange(
                      row.engagementId,
                      { unitPrice: Number(event.target.value) },
                    )}
                  />
                </td>
                <td data-label="Amount">
                  <input
                    aria-label={`${row.creatorName} Amount`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={row.quantity || ''}
                    disabled={rowLocked}
                    onChange={(event) => onChange(
                      row.engagementId,
                      { quantity: Number(event.target.value) },
                    )}
                  />
                </td>
                <td data-label="Total">
                  <strong>{formatInvoiceMoney(INVOICE_BATCH_PROTOTYPE_CURRENCY, rowTotal(row))}</strong>
                </td>
                <td data-label="币种">
                  <span className="invoice-batch-fixed-value">
                    <strong>{INVOICE_BATCH_PROTOTYPE_CURRENCY}</strong>
                    <small>固定币种</small>
                  </span>
                </td>
                <td data-label="Payment Information">
                  <select
                    aria-label={`${row.creatorName} Payment Information`}
                    value={row.payoutAccountId}
                    disabled={rowLocked || row.payoutAccountLocked}
                    onChange={(event) => onChange(row.engagementId, {
                      payoutAccountId: event.target.value,
                      payoutAccountLocked: false,
                    })}
                  >
                    <option value="">待选择</option>
                    {payoutAccounts.map((account) => (
                      <option key={getPayoutAccountId(account)} value={getPayoutAccountId(account)}>
                        {paymentInformationLabel(account.provider)} · {account.nickname}
                      </option>
                    ))}
                  </select>
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
  const [sharedDescription, setSharedDescription] = useState('');
  const [rows, setRows] = useState<InvoiceBatchRow[]>([]);
  const [batchId] = useState(() => createPrototypeId('batch'));
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
  const selectedProject = projects.find((project) => projectIdFor(project) === projectId) ?? null;
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
  const projectReferences = selectedProject?.creatorProfiles
    ?.filter((reference) => reference.status !== 'removed') ?? [];
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
  const lockedEngagementIds = rows
    .filter((row) => row.status === 'GENERATED' || row.status === 'GENERATING')
    .map((row) => row.engagementId);
  const allSelectableSelected = Boolean(selectableEngagementIds.length)
    && selectableEngagementIds.every((id) => selectedEngagementIds.includes(id));
  const hasPendingRows = rows.some((row) => row.status !== 'GENERATED');
  const isDirty = Boolean(rows.length || selectedEngagementIds.length || sharedDescription.trim());

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
    description: `${project.projectCode ?? project.id} · ${
      project.creatorProfiles?.filter((item) => item.status !== 'removed').length ?? 0
    } 位达人`,
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
        description: mode === 'SHARED_DESCRIPTION' ? sharedDescription : '',
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
    setMode(nextMode);
    setImportIssues([]);
    if (nextMode === 'SHARED_DESCRIPTION' && sharedDescription.trim()) {
      updateAllRows({ description: sharedDescription });
    }
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
            description: value.description,
            unitPrice: value.unitPrice,
            quantity: value.quantity,
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
        subtitle="在同一份长表单内选择项目达人、填写费用并完成批量校验与生成。"
        actions={(
          <Button variant="secondary" icon={<ArrowLeft size={17} />} onClick={leave}>
            返回
          </Button>
        )}
      />

      <section className="invoice-builder-form invoice-batch-form">
        <div className="invoice-builder-section">
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
        </div>

        <div className="invoice-builder-section">
          <header>
            <span><Users size={18} /></span>
            <div>
              <h2>选择项目与达人</h2>
              <p>单批限定一个项目，最多选择 {INVOICE_BATCH_MAX_ROWS} 位达人。</p>
            </div>
          </header>
          <div className="invoice-form-grid invoice-batch-project-grid">
            <div className="invoice-form-control full-width">
              <span>关联项目 *</span>
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
                  <strong>项目达人</strong>
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
                    aria-label="搜索项目内达人"
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
                  {allSelectableSelected ? '取消全选' : '全选项目内达人'}
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
        </div>

        <div className="invoice-builder-section">
          <header>
            <span><ReceiptText size={18} /></span>
            <div>
              <h2>Invoice 公共信息</h2>
              <p>当前仅用于原型展示；正式系统将根据达人档案带入具体 Payment Information。</p>
            </div>
          </header>
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
              <span>币种</span>
              <div className="invoice-batch-readonly-control">
                <strong>{INVOICE_BATCH_PROTOTYPE_CURRENCY}</strong>
                <small>批量原型统一使用美元</small>
              </div>
              <small />
            </div>
            <div className="invoice-form-control full-width">
              <span>收款方式</span>
              <div className="invoice-batch-readonly-control">
                <WalletCards size={16} />
                <strong>Paid by Bank</strong>
                <small>{INVOICE_BATCH_PROTOTYPE_ACCOUNT_LABEL} · Airwallex · USD</small>
              </div>
              <small>原型默认使用空中云汇；正式系统以达人档案中已验证的付款信息为准。</small>
            </div>
            {mode === 'SHARED_DESCRIPTION' ? (
              <label className="full-width">
                <span>统一 Description *</span>
                <textarea
                  value={sharedDescription}
                  placeholder="例如：YouTube Dedicated Video 合作服务费"
                  onChange={(event) => {
                    setSharedDescription(event.target.value);
                    updateAllRows({ description: event.target.value });
                  }}
                />
                <small />
              </label>
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
        </div>

        <div className="invoice-builder-section">
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

          <div className="invoice-batch-summary">
            <div><span>已选择</span><strong>{rows.length}</strong></div>
            <div><span>可生成</span><strong>{readyRows.length}</strong></div>
            <div><span>需处理</span><strong>{problemRows.length}</strong></div>
            <div className="is-wide">
              <span>批次总额</span>
              <strong>{batchTotal ? formatInvoiceMoney('USD', batchTotal) : '-'}</strong>
            </div>
          </div>

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
        </div>

        {generatedRows.length ? (
          <div className="invoice-builder-section invoice-batch-result-section">
            <header>
              <span><PackageCheck size={18} /></span>
              <div>
                <h2>生成结果</h2>
                <p>成功记录已进入“待签署”，失败行可在上方修正后再次生成。</p>
              </div>
            </header>
            <div className="invoice-batch-result-summary">
              <CheckCircle2 size={26} />
              <div>
                <strong>已成功生成 {generatedRows.length} 张 Invoice</strong>
                <span>每张记录保留独立编号、稳定项目达人关联和生成快照。</span>
              </div>
              <Button icon={<Download size={16} />} onClick={() => void downloadZip()}>
                下载整批 ZIP
              </Button>
            </div>
            <div className="invoice-batch-results">
              {rows.map((row) => (
                <div className="invoice-batch-result-row" key={row.engagementId}>
                  <span><strong>{row.creatorName}</strong><small>{row.creatorHandle}</small></span>
                  {row.generated ? (
                    <>
                      <code>{row.generated.record.id}</code>
                      <strong>{formatInvoiceMoney('USD', rowTotal(row))}</strong>
                      <div>
                        <button
                          type="button"
                          onClick={() => downloadBlob(
                            row.generated!.pdfBlob,
                            invoiceFilename(row.generated!.record.snapshot, 'pdf'),
                          )}
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadBlob(
                            row.generated!.docxBlob,
                            invoiceFilename(row.generated!.record.snapshot, 'docx'),
                          )}
                        >
                          DOCX
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className="invoice-batch-result-failed">
                      <AlertTriangle size={15} />
                      {row.issues[0] ?? '待补充后重试'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
