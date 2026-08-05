import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  PackageCheck,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createPrototypeId,
  type ContractId,
  type EngagementId,
  type ProjectId,
} from '../businessWorkflow';
import { Button, PageHeading, SelectField } from '../components/Common';
import type { ContractRecord } from '../contracts';
import {
  INVOICE_BATCH_CURRENCIES,
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
import { payoutSnapshotForContract } from '../invoice/invoiceDraft';
import { maskInvoiceAccountValue } from '../invoice/invoiceReviewWorkflow';
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
import {
  eligibleInvoicePayoutAccounts,
  getPayoutAccountId,
  getPayoutAccountIdentifier,
  getPayoutAccountSummary,
} from '../payoutAccounts';
import type {
  CreatorProfile,
  GeneratedInvoiceRecord,
  InvoiceBatchMode,
  InvoiceBatchRow,
  InvoiceCurrency,
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
};

const STEPS = ['选择方式', '选择项目与达人', '填写或导入', '校验批次', '生成结果'] as const;

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

const formatAccountOption = (creator: CreatorProfile, accountId: string) => {
  const account = eligibleInvoicePayoutAccounts(creator)
    .find((candidate) => getPayoutAccountId(candidate) === accountId);
  if (!account) return '待选择';
  return `${getPayoutAccountSummary(account)} · ${maskInvoiceAccountValue(getPayoutAccountIdentifier(account))}`;
};

function BatchProgress({ step }: { step: number }) {
  return (
    <ol className="invoice-batch-progress" aria-label="批量生成进度">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const state = number < step ? 'complete' : number === step ? 'current' : 'pending';
        return (
          <li className={`invoice-batch-step is-${state}`} key={label} aria-current={state === 'current' ? 'step' : undefined}>
            <span>{state === 'complete' ? <Check size={14} /> : number}</span>
            <strong>{label}</strong>
          </li>
        );
      })}
    </ol>
  );
}

function BatchRowTable({
  rows,
  context,
  editable,
  onlyProblems,
  onChange,
}: {
  rows: InvoiceBatchRow[];
  context: InvoiceBatchContext;
  editable: boolean;
  onlyProblems: boolean;
  onChange: (engagementId: EngagementId, patch: Partial<InvoiceBatchRow>) => void;
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
            <th>收款账户</th>
            <th>合同</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => {
            const creator = context.creators.find((item) => item.id === row.creatorId);
            const accountOptions = eligibleInvoicePayoutAccounts(creator);
            const availableContracts = availableContractsForEngagement(row.engagementId, context.contracts);
            const meta = STATUS_META[row.status];
            return (
              <tr
                key={row.engagementId}
                className={row.status === 'GENERATED' ? 'is-generated' : ''}
                data-engagement-id={row.engagementId}
                data-creator-id={row.creatorId}
              >
                <td data-label="达人">
                  <strong>{row.creatorName}</strong>
                  <small>{row.creatorHandle}</small>
                </td>
                <td data-label="Description">
                  <input
                    aria-label={`${row.creatorName} Description`}
                    value={row.description}
                    disabled={!editable || row.status === 'GENERATED'}
                    onChange={(event) => onChange(row.engagementId, { description: event.target.value })}
                  />
                </td>
                <td data-label="Price">
                  <input
                    aria-label={`${row.creatorName} Price`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={row.unitPrice || ''}
                    disabled={!editable || row.status === 'GENERATED'}
                    onChange={(event) => onChange(row.engagementId, { unitPrice: Number(event.target.value) })}
                  />
                </td>
                <td data-label="Amount">
                  <input
                    aria-label={`${row.creatorName} Amount`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={row.quantity || ''}
                    disabled={!editable || row.status === 'GENERATED'}
                    onChange={(event) => onChange(row.engagementId, { quantity: Number(event.target.value) })}
                  />
                </td>
                <td data-label="Total"><strong>{row.currency ? formatInvoiceMoney(row.currency, rowTotal(row)) : '-'}</strong></td>
                <td data-label="币种">
                  <select
                    aria-label={`${row.creatorName} 币种`}
                    value={row.currency}
                    disabled={!editable || row.status === 'GENERATED'}
                    onChange={(event) => onChange(row.engagementId, {
                      currency: event.target.value as InvoiceCurrency,
                    })}
                  >
                    <option value="">待选择</option>
                    {INVOICE_BATCH_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                </td>
                <td data-label="收款账户">
                  {row.payoutAccountLocked ? (
                    <span className="invoice-batch-locked-value">
                      {creator ? formatAccountOption(creator, row.payoutAccountId) : '合同账户待核对'}
                    </span>
                  ) : (
                    <select
                      aria-label={`${row.creatorName} 收款账户`}
                      value={row.payoutAccountId}
                      disabled={!editable || row.status === 'GENERATED'}
                      onChange={(event) => onChange(row.engagementId, { payoutAccountId: event.target.value })}
                    >
                      <option value="">待选择</option>
                      {accountOptions.map((account) => (
                        <option key={getPayoutAccountId(account)} value={getPayoutAccountId(account)}>
                          {account.nickname}{account.isDefault ? ' · 默认' : ''} · {getPayoutAccountSummary(account)}
                        </option>
                      ))}
                    </select>
                  )}
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
                      disabled={!editable || row.status === 'GENERATED'}
                      onChange={(event) => {
                        const contractId = event.target.value as ContractId;
                        const contract = availableContracts.find((item) => item.contractId === contractId);
                        const snapshot = contract ? payoutSnapshotForContract(contract) : null;
                        onChange(row.engagementId, {
                          contractIds: contractId ? [contractId] : [],
                          payoutAccountId: snapshot?.payoutAccountId ?? row.payoutAccountId,
                          payoutAccountLocked: Boolean(snapshot?.payoutAccountId),
                        });
                      }}
                    >
                      <option value="">待选择</option>
                      {availableContracts.map((contract) => (
                        <option key={contract.contractId} value={contract.contractId}>{contract.id}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td data-label="状态">
                  <span className={`invoice-batch-status tone-${meta.tone}`}>{meta.label}</span>
                  {row.issues.length ? (
                    <span className="invoice-batch-row-issue" title={row.issues.join('；')}>{row.issues[0]}</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!visibleRows.length ? <div className="invoice-batch-empty">当前没有需要处理的问题行</div> : null}
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
}: InvoiceBatchBuilderPageProps) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<InvoiceBatchMode>('SHARED_DESCRIPTION');
  const [projectId, setProjectId] = useState('');
  const [selectedEngagementIds, setSelectedEngagementIds] = useState<EngagementId[]>([]);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProject = projects.find((project) => projectIdFor(project) === projectId) ?? null;
  const context = useMemo<InvoiceBatchContext | null>(() => selectedProject ? ({
    project: selectedProject,
    creators,
    payouts,
    contracts,
    generatedInvoices,
    invoiceEntity,
  }) : null, [contracts, creators, generatedInvoices, invoiceEntity, payouts, selectedProject]);
  const projectReferences = selectedProject?.creatorProfiles?.filter((reference) => reference.status !== 'removed') ?? [];
  const isDirty = Boolean(projectId || rows.length || sharedDescription.trim() || selectedEngagementIds.length);

  useEffect(() => {
    onDirtyChange(isDirty && step < 5);
  }, [isDirty, onDirtyChange, step]);

  useEffect(() => {
    if (!isDirty || step >= 5) return undefined;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [isDirty, step]);

  const projectOptions = projects.map((project) => ({
    value: projectIdFor(project),
    label: project.name,
    description: `${project.projectCode ?? project.id} · ${project.creatorProfiles?.filter((item) => item.status !== 'removed').length ?? 0} 位达人`,
  }));

  const setProject = (value: string) => {
    setProjectId(value);
    setSelectedEngagementIds([]);
    setRows([]);
    setImportIssues([]);
  };

  const toggleEngagement = (engagementId: EngagementId) => {
    setSelectedEngagementIds((current) => (
      current.includes(engagementId)
        ? current.filter((id) => id !== engagementId)
        : current.length < INVOICE_BATCH_MAX_ROWS
          ? [...current, engagementId]
          : current
    ));
  };

  const prepareRows = () => {
    if (!context || !selectedEngagementIds.length) return;
    const nextRows = selectedEngagementIds.map((engagementId) => createInvoiceBatchRow({
      ...context,
      engagementId,
      invoiceDate,
      description: mode === 'SHARED_DESCRIPTION' ? sharedDescription : '',
    }));
    setRows(nextRows);
    setStep(3);
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
      row.status === 'GENERATED' ? row : updateAndValidateInvoiceBatchRow(row, patch, context)
    )));
  };

  const exportTemplate = async () => {
    if (!selectedProject) return;
    const blob = await exportInvoiceBatchWorkbook({
      batchId,
      projectId: projectId as ProjectId,
      invoiceDate,
    }, rows);
    downloadBlob(blob, `COMETS-Invoice-Batch-${selectedProject.projectCode ?? selectedProject.id}.xlsx`);
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
              issues: [...new Set([...row.issues, '模板中的达人稳定 ID 与当前合作关系不一致'])],
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
      setImportIssues([error instanceof Error ? `模板解析失败：${error.message}` : '模板损坏或无法解析']);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const validateBatch = () => {
    if (!context) return;
    setRows((current) => current.map((row) => validateInvoiceBatchRow(row, context)));
    setStep(4);
  };

  const generateBatch = async () => {
    if (!context) return;
    setGenerationError('');
    let workingRows = rows.map((row) => validateInvoiceBatchRow(row, context));
    const candidates = workingRows.filter((row) => row.status === 'READY');
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
            ? { ...row, status: 'GENERATED', issues: [], generated: { record, pdfBlob, docxBlob } }
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
    setStep(5);
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
    downloadBlob(blob, `COMETS-Invoice-Batch-${selectedProject?.projectCode ?? 'result'}.zip`);
  };

  const leave = () => {
    if (isDirty && step < 5 && !window.confirm('当前批量生成内容尚未完成，确定离开吗？')) return;
    onDirtyChange(false);
    onCancel();
  };

  const readyRows = rows.filter((row) => row.status === 'READY');
  const problemRows = rows.filter((row) => ['NEEDS_INPUT', 'CONFLICT', 'FAILED'].includes(row.status));
  const generatedRows = rows.filter((row) => row.status === 'GENERATED');
  const totals = rows
    .filter((row) => ['READY', 'GENERATED'].includes(row.status) && row.currency)
    .reduce<Record<string, number>>((result, row) => ({
      ...result,
      [row.currency]: (result[row.currency] ?? 0) + rowTotal(row),
    }), {});

  return (
    <div className="page-stack invoice-batch-page" data-batch-id={batchId} data-project-id={projectId}>
      <PageHeading
        title="批量生成 Invoice"
        subtitle="一个项目内批量准备达人 Invoice，逐行校验后生成独立文件与待签署记录。"
        actions={<Button variant="secondary" icon={<ArrowLeft size={17} />} onClick={leave}>返回</Button>}
      />
      <BatchProgress step={step} />

      {step === 1 ? (
        <section className="content-card invoice-batch-stage">
          <header className="invoice-batch-stage-header">
            <div><span>01</span><h2>选择费用内容的填写方式</h2></div>
          </header>
          <div className="invoice-batch-mode-grid">
            <button className={`invoice-batch-mode ${mode === 'SHARED_DESCRIPTION' ? 'is-selected' : ''}`} type="button" onClick={() => setMode('SHARED_DESCRIPTION')}>
              <span><FileText size={22} /></span>
              <strong>统一 Description</strong>
              <p>所有达人使用相同费用说明，逐人填写 Price 与 Amount。</p>
              {mode === 'SHARED_DESCRIPTION' ? <CheckCircle2 size={19} /> : null}
            </button>
            <button className={`invoice-batch-mode ${mode === 'XLSX_IMPORT' ? 'is-selected' : ''}`} type="button" onClick={() => setMode('XLSX_IMPORT')}>
              <span><FileSpreadsheet size={22} /></span>
              <strong>分别填写 Description</strong>
              <p>下载带稳定 ID 的 XLSX，线下填写后上传识别。</p>
              {mode === 'XLSX_IMPORT' ? <CheckCircle2 size={19} /> : null}
            </button>
          </div>
          <footer className="invoice-batch-footer">
            <Button icon={<ArrowRight size={16} />} onClick={() => setStep(2)}>下一步</Button>
          </footer>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="content-card invoice-batch-stage">
          <header className="invoice-batch-stage-header">
            <div><span>02</span><h2>选择一个项目及其达人</h2></div>
            <small>单批最多 {INVOICE_BATCH_MAX_ROWS} 位</small>
          </header>
          <div className="invoice-batch-project-select">
            <span>项目 *</span>
            <SelectField ariaLabel="批量 Invoice 项目" variant="form" value={projectId} options={projectOptions} placeholder="选择可编辑项目" onChange={setProject} />
          </div>
          {selectedProject ? (
            <>
              <div className="invoice-batch-selection-toolbar">
                <strong>选择达人 <span>{selectedEngagementIds.length}/{Math.min(projectReferences.length, INVOICE_BATCH_MAX_ROWS)}</span></strong>
                <button type="button" className="text-link" onClick={() => {
                  const ids = projectReferences.slice(0, INVOICE_BATCH_MAX_ROWS).map((item) => item.engagementId);
                  setSelectedEngagementIds(selectedEngagementIds.length === ids.length ? [] : ids);
                }}>{selectedEngagementIds.length === Math.min(projectReferences.length, INVOICE_BATCH_MAX_ROWS) ? '取消全选' : '全选'}</button>
              </div>
              <div className="invoice-batch-creator-grid">
                {projectReferences.map((reference) => {
                  const creator = creators.find((item) => item.id === reference.creatorId);
                  const existing = generatedInvoices.find((invoice) => invoice.snapshot.engagementId === reference.engagementId);
                  const selected = selectedEngagementIds.includes(reference.engagementId);
                  return (
                    <label className={`invoice-batch-creator ${selected ? 'is-selected' : ''}`} key={reference.engagementId}>
                      <input type="checkbox" checked={selected} disabled={!selected && selectedEngagementIds.length >= INVOICE_BATCH_MAX_ROWS} onChange={() => toggleEngagement(reference.engagementId)} />
                      <span className="invoice-batch-creator-check"><Check size={13} /></span>
                      <span><strong>{reference.name}</strong><small>{reference.handle} · {reference.platform}</small></span>
                      {existing ? <em>已有 {existing.id}</em> : creator && eligibleInvoicePayoutAccounts(creator).length ? <em className="is-ready">账户可用</em> : <em>账户待补充</em>}
                    </label>
                  );
                })}
              </div>
            </>
          ) : null}
          <footer className="invoice-batch-footer">
            <Button variant="secondary" onClick={() => setStep(1)}>上一步</Button>
            <Button icon={<ArrowRight size={16} />} disabled={!selectedProject || !selectedEngagementIds.length} onClick={prepareRows}>准备批次</Button>
          </footer>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="content-card invoice-batch-stage">
          <header className="invoice-batch-stage-header">
            <div><span>03</span><h2>{mode === 'SHARED_DESCRIPTION' ? '填写统一费用说明与逐人金额' : '下载并上传费用模板'}</h2></div>
            <small>{selectedProject?.name}</small>
          </header>
          <div className="invoice-batch-common-fields">
            <label><span>Invoice 日期 *</span><input type="date" value={invoiceDate} onChange={(event) => { setInvoiceDate(event.target.value); updateAllRows({ invoiceDate: event.target.value }); }} /></label>
            {mode === 'SHARED_DESCRIPTION' ? (
              <label className="is-wide"><span>统一 Description *</span><input value={sharedDescription} placeholder="例如：YouTube Dedicated Video 合作服务费" onChange={(event) => { setSharedDescription(event.target.value); updateAllRows({ description: event.target.value }); }} /></label>
            ) : (
              <div className="invoice-batch-import-actions">
                <Button variant="secondary" icon={<Download size={16} />} onClick={exportTemplate}>下载 XLSX 模板</Button>
                <Button icon={<Upload size={16} />} disabled={importing} onClick={() => fileInputRef.current?.click()}>{importing ? '正在解析' : '上传已填写模板'}</Button>
                <input ref={fileInputRef} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importTemplate(file);
                }} />
              </div>
            )}
          </div>
          {importIssues.length ? (
            <div className="invoice-batch-alert" role="alert"><AlertTriangle size={18} /><div><strong>模板有 {importIssues.length} 项需要处理</strong><span>{importIssues.slice(0, 3).join('；')}</span></div></div>
          ) : null}
          <BatchRowTable rows={rows} context={context!} editable onlyProblems={false} onChange={updateRow} />
          <footer className="invoice-batch-footer">
            <Button variant="secondary" onClick={() => setStep(2)}>上一步</Button>
            <Button icon={<CheckCircle2 size={16} />} onClick={validateBatch}>校验批次</Button>
          </footer>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="content-card invoice-batch-stage">
          <header className="invoice-batch-stage-header">
            <div><span>04</span><h2>确认可生成记录</h2></div>
            <label className="invoice-batch-problem-filter"><input type="checkbox" checked={onlyProblems} onChange={(event) => setOnlyProblems(event.target.checked)} />只看问题行</label>
          </header>
          <div className="invoice-batch-summary">
            <div><span>可生成</span><strong>{readyRows.length}</strong></div>
            <div><span>需处理</span><strong>{problemRows.length}</strong></div>
            <div className="is-wide"><span>批次总额</span><strong>{Object.entries(totals).map(([currency, amount]) => formatInvoiceMoney(currency, amount)).join(' + ') || '-'}</strong></div>
          </div>
          {generationError ? <div className="invoice-batch-alert" role="alert"><AlertTriangle size={18} /><div><strong>无法开始生成</strong><span>{generationError}</span></div></div> : null}
          <BatchRowTable rows={rows} context={context!} editable onlyProblems={onlyProblems} onChange={updateRow} />
          <footer className="invoice-batch-footer is-sticky">
            <Button variant="secondary" onClick={() => setStep(3)}>返回修改</Button>
            <Button icon={generating ? <RefreshCw className="is-spinning" size={16} /> : <PackageCheck size={16} />} disabled={generating || !readyRows.length} onClick={() => void generateBatch()}>
              {generating ? `正在生成 ${generationProgress.current}/${generationProgress.total}` : `生成 ${readyRows.length} 张 Invoice`}
            </Button>
          </footer>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="content-card invoice-batch-stage">
          <header className="invoice-batch-stage-header">
            <div><span><PackageCheck size={19} /></span><h2>批量生成完成</h2></div>
            <small>{generatedRows.length} 张成功 · {problemRows.length} 张待处理</small>
          </header>
          <div className="invoice-batch-result-summary">
            <CheckCircle2 size={28} />
            <div><strong>成功记录已进入“待签署”</strong><span>每张 Invoice 保留独立编号、项目达人关联和生成快照。</span></div>
            {generatedRows.length ? <Button icon={<Download size={16} />} onClick={() => void downloadZip()}>下载整批 ZIP</Button> : null}
          </div>
          <div className="invoice-batch-results">
            {rows.map((row) => (
              <div className="invoice-batch-result-row" key={row.engagementId}>
                <span><strong>{row.creatorName}</strong><small>{row.creatorHandle}</small></span>
                {row.generated ? (
                  <>
                    <code>{row.generated.record.id}</code>
                    <strong>{formatInvoiceMoney(row.generated.record.snapshot.currency, rowTotal(row))}</strong>
                    <div>
                      <button type="button" onClick={() => downloadBlob(row.generated!.pdfBlob, invoiceFilename(row.generated!.record.snapshot, 'pdf'))}>PDF</button>
                      <button type="button" onClick={() => downloadBlob(row.generated!.docxBlob, invoiceFilename(row.generated!.record.snapshot, 'docx'))}>DOCX</button>
                    </div>
                  </>
                ) : (
                  <span className="invoice-batch-result-failed"><AlertTriangle size={15} />{row.issues[0] ?? '待补充后重试'}</span>
                )}
              </div>
            ))}
          </div>
          <footer className="invoice-batch-footer">
            {problemRows.length ? <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => setStep(4)}>修正失败记录</Button> : null}
            <Button onClick={() => { onDirtyChange(false); onOpenInvoiceManagement(); }}>返回 Invoice 管理</Button>
          </footer>
        </section>
      ) : null}

      <span className="sr-only">模板版本 {INVOICE_BATCH_SCHEMA_VERSION}</span>
    </div>
  );
}
