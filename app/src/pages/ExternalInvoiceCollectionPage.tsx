import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileSearch,
  FileText,
  History,
  RefreshCw,
  Send,
  ShieldCheck,
  Upload,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, Button, Modal, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import {
  CONTRACT_TYPE_LABELS,
  contractLinkedToProject,
  type ContractRecord,
} from '../contracts';
import {
  EXTERNAL_INVOICE_CRITICAL_FIELDS,
  EXTERNAL_INVOICE_FIELD_LABEL,
  EXTERNAL_INVOICE_FIELD_ORDER,
  contractAccountReminder,
  currentExternalInvoiceConfirmation,
  currentExternalInvoiceRecognition,
  externalInvoiceListStatus,
  externalInvoicePageTab,
  externalInvoiceValidationIssues,
  type ExternalInvoiceCollectionInput,
  type ExternalInvoiceCollectionRecord,
  type ExternalInvoiceFieldKey,
  type ExternalInvoiceScenario,
} from '../invoice/externalInvoiceCollection';
import { todayInputValue } from '../invoice/invoiceUtils';
import {
  eligibleInvoicePayoutAccounts,
  getPayoutAccountId,
  getPayoutAccountSummary,
} from '../payoutAccounts';
import type { CooperationProjectId, ContractId, CreatorId, EngagementId, ProjectId } from '../businessWorkflow';
import type { CreatorProfile, InvoiceCurrency } from '../types';
import type { ProjectSummary } from './ProjectDetailPage';
import './ExternalInvoiceCollectionPage.css';

const CURRENCIES: InvoiceCurrency[] = ['USD', 'EUR', 'GBP', 'HKD', 'SGD'];

const TECHNICAL_STATUS_LABEL: Record<ExternalInvoiceCollectionRecord['status'], string> = {
  DRAFT: '收集信息草稿',
  WAITING_UPLOAD: '等待 C 端上传',
  RECOGNIZING: 'OCR 识别中',
  WAITING_CONFIRMATION: '等待达人确认识别结果',
  WAITING_MEDIA_REVIEW: '等待媒介审核',
  RETURNED_FOR_CORRECTION: '已退回纠正识别结果',
  RETURNED_FOR_REUPLOAD: '已要求重新上传',
  APPROVED: '媒介审核通过',
  RECOGNITION_FAILED: 'OCR 识别失败',
  CANCELLED: '已取消',
};

const stepIndexFor = (record: ExternalInvoiceCollectionRecord) => {
  if (record.status === 'APPROVED') return 5;
  if (record.status === 'WAITING_MEDIA_REVIEW') return 4;
  if (record.confirmedSnapshots.length) return 3;
  if (record.sourceFileVersions.length) return 2;
  if (record.status !== 'DRAFT') return 1;
  return 0;
};

const valueResult = (recognized?: string, confirmed?: string) => {
  if (!recognized || !confirmed) return '待确认';
  return recognized.trim() === confirmed.trim() ? '识别一致' : '达人已纠正';
};

export function ExternalInvoiceCollectionCreatePage({
  projects,
  creators,
  contracts,
  invoiceEntityName,
  onCreate,
  onBack,
}: {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  invoiceEntityName: string;
  onCreate: (input: ExternalInvoiceCollectionInput, publish: boolean) => void;
  onBack: () => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [creatorId, setCreatorId] = useState('');
  const [contractIds, setContractIds] = useState<ContractId[]>([]);
  const [amount, setAmount] = useState('4800');
  const [currency, setCurrency] = useState<InvoiceCurrency>('USD');
  const [advertiser, setAdvertiser] = useState(invoiceEntityName);
  const [description, setDescription] = useState('Creator content production and publishing services');
  const [dueDate, setDueDate] = useState('2026-09-05');

  const selectedProject = projects.find((project) => String(project.projectId ?? project.id) === projectId);
  const creatorReferences = selectedProject?.creatorProfiles?.filter((reference) => reference.status !== 'removed') ?? [];
  const selectedReference = creatorReferences.find((reference) => String(reference.creatorId) === creatorId);
  const selectedCreator = creators.find((creator) => String(creator.id) === creatorId);
  const projectOptions = useMemo(() => projects.map((project) => ({
    value: String(project.projectId ?? project.id),
    label: project.name,
    description: [project.projectCode ?? project.cooperationProjectCode ?? project.id, project.brand].filter(Boolean).join(' · '),
    leading: <BriefcaseBusiness size={17} />,
  })), [projects]);
  const creatorOptions = useMemo(() => creatorReferences.map((reference) => {
    const creator = creators.find((item) => String(item.id) === String(reference.creatorId));
    return {
      value: String(reference.creatorId),
      label: reference.name,
      description: [reference.platform, reference.handle].filter(Boolean).join(' · '),
      leading: (
        <Avatar
          initials={creator?.initials ?? reference.name.slice(0, 2)}
          accent={creator?.accent}
          size="sm"
        />
      ),
    };
  }), [creatorReferences, creators]);
  const eligibleContracts = useMemo(() => contracts.filter((contract) => (
    contract.lifecycle === 'CONFIRMED'
    && Boolean(contract.contractId)
    && String(contract.creatorId) === creatorId
    && contractLinkedToProject(contract, projectId as CooperationProjectId)
  )), [contracts, creatorId, projectId]);
  const validAmount = Number(amount) > 0;
  const complete = Boolean(
    selectedProject
    && selectedReference
    && selectedCreator
    && validAmount
    && advertiser.trim()
    && description.trim()
    && dueDate,
  );

  const submit = (publish: boolean) => {
    if (!complete || !selectedProject || !selectedReference || !selectedCreator) return;
    onCreate({
      projectId: (selectedProject.projectId ?? selectedProject.id) as ProjectId,
      projectName: selectedProject.name,
      engagementId: selectedReference.engagementId as EngagementId,
      creatorId: selectedReference.creatorId as CreatorId,
      creatorName: selectedCreator.name,
      creatorHandle: selectedCreator.socialAccounts.find((account) => account.handle.trim())?.handle
        ?? selectedCreator.handle,
      contractIds,
      expected: {
        amount: Number(amount),
        currency,
        advertiser: advertiser.trim(),
        description: description.trim(),
        dueDate,
      },
    }, publish);
  };

  return (
    <div className="page-stack external-invoice-page">
      <button className="external-back-button" type="button" onClick={onBack}><ArrowLeft size={17} />返回 Invoice 管理</button>
      <PageHeading
        title="发起外部 Invoice 收集"
        subtitle="先固定合作项目、达人和预期业务信息，再向对应达人档案发布上传任务。"
      />
      <div className="external-collection-form">
        <section className="content-card external-collection-card">
          <div className="external-section-heading">
            <div><span className="external-section-kicker">01</span><h2>任务对象</h2></div>
            <p>MCN 与达人共用同一份达人档案和收款账户。</p>
          </div>
          <div className="form-grid external-form-grid">
            <div className="form-control">
              <span className="required-field-label">合作项目 <em className="required-mark">*</em></span>
              <SelectField
                ariaLabel="选择合作项目"
                variant="form"
                menuStrategy="fixed"
                value={projectId}
                placeholder="请选择合作项目"
                options={projectOptions}
                onChange={(value) => {
                  setProjectId(value);
                  setCreatorId('');
                  setContractIds([]);
                }}
              />
            </div>
            <div className="form-control">
              <span className="required-field-label">达人档案 <em className="required-mark">*</em></span>
              <SelectField
                ariaLabel="选择项目内达人"
                variant="form"
                menuStrategy="fixed"
                value={creatorId}
                placeholder={selectedProject ? '请选择项目内达人' : '请先选择合作项目'}
                options={creatorOptions}
                disabled={!selectedProject}
                onChange={(value) => {
                  setCreatorId(value);
                  setContractIds([]);
                }}
              />
            </div>
          </div>
        </section>

        <section className="content-card external-collection-card">
          <div className="external-section-heading">
            <div><span className="external-section-kicker">02</span><h2>关联合同</h2></div>
            <p>支持不关联合同，也可同时关联多份独立合同、框架合同或 IO 单。</p>
          </div>
          <div className="external-contract-picker">
            {eligibleContracts.length ? eligibleContracts.map((contract) => {
              const contractId = contract.contractId!;
              const checked = contractIds.includes(contractId);
              return (
                <label key={String(contractId)} className={checked ? 'is-selected' : ''}>
                  <input type="checkbox" checked={checked} onChange={() => setContractIds((current) => (
                    checked ? current.filter((id) => id !== contractId) : [...current, contractId]
                  ))} />
                  <span><strong>{contract.id}</strong><small>{CONTRACT_TYPE_LABELS[contract.contractType ?? 'INDEPENDENT']} · {contract.name}</small></span>
                </label>
              );
            }) : <div className="external-empty-inline">选择达人后展示该达人在当前项目下的已确认合同；无合同也可继续。</div>}
          </div>
        </section>

        <section className="content-card external-collection-card external-collection-card-final">
          <div className="external-section-heading">
            <div><span className="external-section-kicker">03</span><h2>预期业务信息</h2></div>
            <p>达人上传后，系统将以这些字段及达人档案账户进行校验。</p>
          </div>
          <div className="form-grid external-form-grid">
            <label><span className="required-field-label">预期金额 <em className="required-mark">*</em></span><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
            <div className="form-control">
              <span className="required-field-label">币种 <em className="required-mark">*</em></span>
              <SelectField<InvoiceCurrency>
                ariaLabel="选择 Invoice 币种"
                variant="form"
                menuStrategy="fixed"
                value={currency}
                options={CURRENCIES.map((item) => ({ value: item, label: item }))}
                leadingIcon={<CircleDollarSign size={17} />}
                onChange={setCurrency}
              />
            </div>
            <label><span className="required-field-label">付款主体 <em className="required-mark">*</em></span><input value={advertiser} onChange={(event) => setAdvertiser(event.target.value)} /></label>
            <label><span className="required-field-label">截止时间 <em className="required-mark">*</em></span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <label className="external-form-span"><span className="required-field-label">合作内容 <em className="required-mark">*</em></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          </div>
          <div className="external-form-footer">
            <NoticeBanner>保存草稿后列表显示“待发布”；正式发布后才会出现在对应 C 端达人档案的待上传任务中。</NoticeBanner>
            <div className="external-form-actions">
              <Button variant="secondary" disabled={!complete} onClick={() => submit(false)}>保存草稿</Button>
              <Button icon={<Send size={16} />} disabled={!complete} onClick={() => submit(true)}>发布收集任务</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function ExternalInvoiceCollectionDetailPage({
  record,
  creator,
  contracts,
  canManage,
  canReview,
  onPublish,
  onSimulateUpload,
  onCorrect,
  onSubmit,
  onReturn,
  onApprove,
  onBack,
}: {
  record: ExternalInvoiceCollectionRecord;
  creator?: CreatorProfile;
  contracts: ContractRecord[];
  canManage: boolean;
  canReview: boolean;
  onPublish: () => void;
  onSimulateUpload: (scenario: ExternalInvoiceScenario, payoutAccountId: string, invoiceDate: string) => void;
  onCorrect: (fieldKey: ExternalInvoiceFieldKey, value: string) => void;
  onSubmit: () => void;
  onReturn: (returnType: 'CORRECTION' | 'REUPLOAD', reason: string) => void;
  onApprove: () => void;
  onBack: () => void;
}) {
  const recognition = currentExternalInvoiceRecognition(record);
  const confirmation = currentExternalInvoiceConfirmation(record);
  const accounts = eligibleInvoicePayoutAccounts(creator);
  const [payoutAccountId, setPayoutAccountId] = useState(
    record.selectedPayoutAccountId ?? (accounts[0] ? getPayoutAccountId(accounts[0]) : ''),
  );
  const [invoiceDate, setInvoiceDate] = useState(confirmation?.values.INVOICE_DATE ?? todayInputValue());
  const [criticalChecks, setCriticalChecks] = useState<ExternalInvoiceFieldKey[]>([]);
  const [correctionField, setCorrectionField] = useState<ExternalInvoiceFieldKey>('AMOUNT');
  const [correctionValue, setCorrectionValue] = useState('');
  const [returnDialog, setReturnDialog] = useState<'CORRECTION' | 'REUPLOAD' | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const payoutAccountOptions = accounts.map((account) => ({
    value: getPayoutAccountId(account),
    label: account.nickname,
    description: getPayoutAccountSummary(account),
    leading: <WalletCards size={17} />,
  }));
  const issues = externalInvoiceValidationIssues({ record, creator, contracts });
  const blockers = issues.filter((issue) => issue.severity === 'BLOCKER');
  const contractAccounts = contractAccountReminder(record, contracts);
  const stepIndex = stepIndexFor(record);
  const canUpload = ['WAITING_UPLOAD', 'RETURNED_FOR_REUPLOAD', 'WAITING_CONFIRMATION'].includes(record.status);
  const canSubmit = Boolean(confirmation && blockers.length === 0 && record.status === 'WAITING_CONFIRMATION');
  const allCriticalReviewed = EXTERNAL_INVOICE_CRITICAL_FIELDS.every((field) => criticalChecks.includes(field));
  const displayInvoiceNumber = externalInvoicePageTab(record.status) === 'upload'
    ? '待生成'
    : record.invoiceNumber ?? '待生成';
  const correctionCandidate = recognition && EXTERNAL_INVOICE_FIELD_ORDER.find((field) => (
    recognition.fields[field].value.trim() !== recognition.fields[field].evidence.sourceValue.trim()
  ));
  const activeCorrectionField = correctionCandidate ?? correctionField;
  const activeCorrectionEvidence = recognition?.fields[activeCorrectionField].evidence.sourceValue ?? '';

  return (
    <div className="page-stack external-invoice-page">
      <button className="external-back-button" type="button" onClick={onBack}><ArrowLeft size={17} />返回 Invoice 管理</button>
      <div className="external-detail-header">
        <div>
          <div className="external-detail-badges"><span className="invoice-type-badge is-external">外部 Invoice</span><span className="invoice-row-status is-warning">{externalInvoiceListStatus(record.status)}</span></div>
          <h1>{displayInvoiceNumber}</h1>
          <p>{record.projectName} · {record.creatorName} · {TECHNICAL_STATUS_LABEL[record.status]}</p>
        </div>
        {record.status === 'DRAFT' && canManage ? <Button icon={<Send size={16} />} onClick={onPublish}>发布收集任务</Button> : null}
      </div>

      <section className="content-card external-progress-section">
        <ol className="external-progress-list">
          {['创建任务', '发布待办', '文件上传', '识别确认', '媒介审核', '审核通过'].map((label, index) => (
            <li key={label} className={index < stepIndex ? 'is-complete' : index === stepIndex ? 'is-current' : ''}>
              <span>{index < stepIndex ? <CheckCircle2 size={16} /> : index + 1}</span><strong>{label}</strong>
            </li>
          ))}
        </ol>
        <p className="external-progress-note"><Clock3 size={15} />OCR 识别中和待确认识别结果只在这里作为步骤展示，不进入列表状态。</p>
      </section>

      <div className="external-detail-layout">
        <section className="content-card external-source-panel">
          <div className="external-section-heading"><div><FileText size={18} /><h2>原始 Invoice 文件</h2></div><p>{record.sourceFileVersions.length ? `${record.sourceFileVersions.length} 个不可覆盖版本` : '等待 C 端上传'}</p></div>
          {recognition ? (
            <div className="external-document-preview">
              <div className="external-document-title"><strong>INVOICE</strong><small>{record.sourceFileVersions[record.sourceFileVersions.length - 1]?.fileName}</small></div>
              {EXTERNAL_INVOICE_FIELD_ORDER.map((field) => (
                <div key={field}><span>{EXTERNAL_INVOICE_FIELD_LABEL[field]}</span><strong>{recognition.fields[field].evidence.sourceValue}</strong></div>
              ))}
            </div>
          ) : (
            <div className="external-file-empty"><Upload size={30} /><strong>尚未上传文件</strong><span>发布后由 C 端上传 PDF、JPG 或 PNG。</span></div>
          )}
          {record.sourceFileVersions.length ? (
            <div className="external-version-list">
              <h3><History size={16} />文件版本</h3>
              {record.sourceFileVersions.map((version) => <div key={version.fileVersionId}><strong>v{version.version} · {version.fileName}</strong><small>{version.uploadedBy.name} · {new Date(version.uploadedAt).toLocaleString('zh-CN')}</small></div>)}
            </div>
          ) : null}
        </section>

        <div className="external-detail-main">
          <section className="content-card external-task-summary">
            <div className="external-section-heading"><div><FileSearch size={18} /><h2>收集任务与校验基准</h2></div><p>发布时固定，作为识别与审核基准</p></div>
            <dl className="external-summary-grid">
              <div><dt>达人</dt><dd><Avatar initials={creator?.initials ?? record.creatorName.slice(0, 2)} accent={creator?.accent} size="sm" /><span>{record.creatorName}<small>{record.creatorHandle}</small></span></dd></div>
              <div><dt>关联项目</dt><dd>{record.projectName}</dd></div>
              <div><dt>预期金额</dt><dd>{record.expected.currency} {record.expected.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd></div>
              <div><dt>付款主体</dt><dd>{record.expected.advertiser}</dd></div>
              <div><dt>合作内容</dt><dd>{record.expected.description}</dd></div>
              <div><dt>截止时间</dt><dd>{record.expected.dueDate}</dd></div>
            </dl>
          </section>

          {canManage && record.status !== 'DRAFT' && record.status !== 'WAITING_MEDIA_REVIEW' && record.status !== 'APPROVED' ? (
            <section className="content-card external-simulator-panel">
              <div className="external-section-heading"><div><RefreshCw size={18} /><h2>模拟 C 端回传</h2></div><p>仅用于当前管理端前端原型演示</p></div>
              <div className="form-grid external-simulator-form">
                <div className="form-control">
                  <span>达人已验证收款账户</span>
                  <SelectField
                    ariaLabel="选择达人已验证收款账户"
                    variant="form"
                    menuStrategy="fixed"
                    menuClassName="payout-account-select-menu"
                    value={payoutAccountId}
                    placeholder="请选择账户"
                    options={payoutAccountOptions}
                    onChange={setPayoutAccountId}
                  />
                </div>
                <label><span>Date of Invoice</span><input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} /></label>
              </div>
              {!accounts.length ? <NoticeBanner>达人档案没有已验证且可用于 Invoice 的账户，当前不能提交。</NoticeBanner> : null}
              {canUpload ? (
                <div className="external-simulator-actions">
                  <Button disabled={!payoutAccountId || !invoiceDate} icon={<Upload size={16} />} onClick={() => onSimulateUpload('NORMAL', payoutAccountId, invoiceDate)}>正常上传并识别</Button>
                  <Button disabled={!payoutAccountId || !invoiceDate} variant="secondary" onClick={() => onSimulateUpload('OCR_ERROR', payoutAccountId, invoiceDate)}>模拟 OCR 识别错误</Button>
                  <Button disabled={!payoutAccountId || !invoiceDate} variant="secondary" onClick={() => onSimulateUpload('SOURCE_FILE_ERROR', payoutAccountId, invoiceDate)}>模拟原文件错误</Button>
                </div>
              ) : null}
              {(correctionCandidate || record.status === 'RETURNED_FOR_CORRECTION') && recognition ? (
                <div className="external-correction-callout">
                  <div className="external-correction-editor">
                    <strong>{correctionCandidate ? '发现可纠正的 OCR 差异' : '按退回原因重新确认识别值'}</strong>
                    <div>
                      <SelectField<ExternalInvoiceFieldKey>
                        ariaLabel="选择需要纠正的识别字段"
                        variant="form"
                        menuStrategy="fixed"
                        value={activeCorrectionField}
                        options={EXTERNAL_INVOICE_FIELD_ORDER.map((field) => ({ value: field, label: EXTERNAL_INVOICE_FIELD_LABEL[field] }))}
                        disabled={Boolean(correctionCandidate)}
                        onChange={(value) => { setCorrectionField(value); setCorrectionValue(''); }}
                      />
                      <input value={correctionValue} onChange={(event) => setCorrectionValue(event.target.value)} placeholder={`原文件证据：${activeCorrectionEvidence}`} />
                    </div>
                    <span>纠正值必须能在原始文件证据中找到；否则请改用重新上传。</span>
                  </div>
                  <Button variant="secondary" onClick={() => onCorrect(activeCorrectionField, correctionValue.trim() || activeCorrectionEvidence)}>保存纠正值</Button>
                </div>
              ) : null}
              <div className="external-simulator-submit"><Button disabled={!canSubmit} icon={<Send size={16} />} onClick={onSubmit}>提交媒介审核</Button></div>
            </section>
          ) : null}

          {recognition && confirmation ? (
            <section className="content-card external-recognition-panel">
              <div className="external-section-heading"><div><FileSearch size={18} /><h2>识别结果与达人确认值</h2></div><p>三层数据独立保存，不相互覆盖</p></div>
              <div className="table-scroll"><table className="data-table external-compare-table"><thead><tr><th>字段</th><th>原文件证据</th><th>系统首次识别</th><th>达人确认值</th><th>结果</th></tr></thead><tbody>{EXTERNAL_INVOICE_FIELD_ORDER.map((field) => {
                const recognized = recognition.fields[field];
                const confirmed = confirmation.values[field];
                const changed = recognized.value.trim() !== confirmed.trim();
                return <tr key={field} className={changed ? 'is-corrected' : ''}><td><strong>{EXTERNAL_INVOICE_FIELD_LABEL[field]}</strong></td><td>{recognized.evidence.sourceValue}</td><td>{recognized.value}</td><td>{confirmed}</td><td><span className={`external-compare-result ${changed ? 'is-corrected' : 'is-matched'}`}>{valueResult(recognized.value, confirmed)}</span></td></tr>;
              })}</tbody></table></div>
            </section>
          ) : null}

          {confirmation ? (
            <section className="content-card external-validation-panel">
              <div className="external-section-heading"><div><ShieldCheck size={18} /><h2>任务、档案与账户校验</h2></div><p>{blockers.length ? `${blockers.length} 项阻断` : '关键字段已匹配'}</p></div>
              <div className="external-validation-list">
                {issues.length ? issues.map((issue, index) => <div key={`${issue.fieldKey}-${index}`} className={`is-${issue.severity.toLowerCase()}`}><span>{issue.severity === 'BLOCKER' ? '阻断' : '提醒'}</span><div><strong>{issue.label}</strong><p>{issue.message}</p><small>预期：{issue.expectedValue} · 当前：{issue.actualValue}</small></div></div>) : <div className="is-passed"><span>通过</span><div><strong>任务字段与达人档案一致</strong><p>金额、币种、付款主体、开票主体和收款账户均已通过。</p></div></div>}
              </div>
              {contractAccounts.length ? <div className="external-contract-accounts"><h3>关联合同账户</h3>{contractAccounts.map((item) => <p key={String(item.contractId)}><strong>{item.contractNumber}</strong><span>{item.accountName} · {item.accountReference}</span></p>)}</div> : null}
            </section>
          ) : null}

          {record.status === 'WAITING_MEDIA_REVIEW' ? (
            <section className="content-card external-media-review">
              <div className="external-section-heading"><div><ShieldCheck size={18} /><h2>媒介人工复核</h2></div><p>审核通过后直接进入可请款状态</p></div>
              <div className="external-critical-checks">
                {EXTERNAL_INVOICE_CRITICAL_FIELDS.map((field) => <label key={field}><input type="checkbox" checked={criticalChecks.includes(field)} onChange={() => setCriticalChecks((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field])} /><span><strong>{EXTERNAL_INVOICE_FIELD_LABEL[field]}</strong><small>已对照原文件、达人确认值和档案数据</small></span></label>)}
              </div>
              <div className="external-review-actions">
                <Button variant="secondary" disabled={!canReview} onClick={() => setReturnDialog('CORRECTION')}>退回纠正识别结果</Button>
                <Button variant="secondary" disabled={!canReview} onClick={() => setReturnDialog('REUPLOAD')}>要求重新上传</Button>
                <Button icon={<CheckCircle2 size={16} />} disabled={!canReview || blockers.length > 0 || !allCriticalReviewed} onClick={onApprove}>审核通过</Button>
              </div>
            </section>
          ) : null}

          <section className="content-card external-history-panel">
            <div className="external-section-heading"><div><History size={18} /><h2>操作历史</h2></div><p>记录实际操作账号与每次状态变化</p></div>
            <div className="external-history-list">{[...record.reviewHistory].reverse().map((event) => <div key={event.eventId}><span className="external-history-dot" /><div><strong>{event.actor.name} · {event.action}</strong><p>{event.reason ?? `${event.fromStatus ? `${TECHNICAL_STATUS_LABEL[event.fromStatus]} → ` : ''}${TECHNICAL_STATUS_LABEL[event.toStatus]}`}</p><small>{new Date(event.occurredAt).toLocaleString('zh-CN')} · {event.actor.role}</small></div></div>)}</div>
          </section>
        </div>
      </div>

      {returnDialog ? (
        <Modal
          title={returnDialog === 'CORRECTION' ? '退回纠正识别结果' : '要求重新上传 Invoice'}
          width="520px"
          onClose={() => setReturnDialog(null)}
          footer={<><Button variant="ghost" onClick={() => setReturnDialog(null)}>取消</Button><Button variant="danger" disabled={!returnReason.trim()} onClick={() => { onReturn(returnDialog, returnReason); setReturnDialog(null); setReturnReason(''); }}>确认退回</Button></>}
        >
          <div className="form-grid single-column"><label><span className="required-field-label">退回原因 <em className="required-mark">*</em></span><textarea autoFocus value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="说明具体字段、原文件证据和需要达人处理的内容" /></label></div>
        </Modal>
      ) : null}
    </div>
  );
}
