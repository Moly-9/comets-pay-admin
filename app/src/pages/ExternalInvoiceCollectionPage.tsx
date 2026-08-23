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
import { Avatar, Button, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import {
  InvoiceReviewWorkspace,
  type InvoiceReviewAccountRow,
  type InvoiceReviewContractCheck,
  type InvoiceReviewOverviewField,
  type InvoiceReviewTimelineItem,
} from '../components/InvoiceReviewWorkspace';
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
  currentExternalInvoiceFieldReview,
  currentExternalInvoiceConfirmation,
  currentExternalInvoiceRecognition,
  externalInvoiceListStatus,
  externalInvoicePageTab,
  externalInvoiceReviewReadiness,
  externalInvoiceValidationIssues,
  type ExternalInvoiceCollectionInput,
  type ExternalInvoiceCollectionRecord,
  type ExternalInvoiceFieldKey,
  type ExternalInvoiceMediaReviewDecision,
  type ExternalInvoiceScenario,
} from '../invoice/externalInvoiceCollection';
import { todayInputValue } from '../invoice/invoiceUtils';
import {
  createDocumentPayoutSnapshot,
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
  onReviewField,
  onReturn,
  onApprove,
  onSaveReviewProgress,
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
  onReviewField: (fieldKey: ExternalInvoiceFieldKey, decision: ExternalInvoiceMediaReviewDecision, note?: string) => void;
  onReturn: (returnType: 'CORRECTION' | 'REUPLOAD', reason: string) => void;
  onApprove: () => void;
  onSaveReviewProgress: () => void;
  onBack: () => void;
}) {
  const recognition = currentExternalInvoiceRecognition(record);
  const confirmation = currentExternalInvoiceConfirmation(record);
  const accounts = eligibleInvoicePayoutAccounts(creator);
  const [payoutAccountId, setPayoutAccountId] = useState(
    record.selectedPayoutAccountId ?? (accounts[0] ? getPayoutAccountId(accounts[0]) : ''),
  );
  const [invoiceDate, setInvoiceDate] = useState(confirmation?.values.INVOICE_DATE ?? todayInputValue());
  const [correctionField, setCorrectionField] = useState<ExternalInvoiceFieldKey>('AMOUNT');
  const [correctionValue, setCorrectionValue] = useState('');
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
  const displayInvoiceNumber = externalInvoicePageTab(record.status) === 'upload'
    ? '待生成'
    : record.invoiceNumber ?? '待生成';
  const correctionCandidate = recognition && EXTERNAL_INVOICE_FIELD_ORDER.find((field) => (
    recognition.fields[field].value.trim() !== recognition.fields[field].evidence.sourceValue.trim()
  ));
  const activeCorrectionField = correctionCandidate ?? correctionField;
  const activeCorrectionEvidence = recognition?.fields[activeCorrectionField].evidence.sourceValue ?? '';
  const reviewWorkspaceVisible = Boolean(
    recognition
    && confirmation
    && (record.status === 'WAITING_MEDIA_REVIEW' || record.status === 'APPROVED'),
  );
  const currentFile = record.sourceFileVersions[record.sourceFileVersions.length - 1];
  const selectedAccount = accounts.find((account) => getPayoutAccountId(account) === confirmation?.payoutAccountId);
  const accountSnapshot = selectedAccount
    ? createDocumentPayoutSnapshot(selectedAccount, record.creatorId)
    : undefined;
  const profileAccountValue = selectedAccount?.provider === 'PayPal'
    ? `${accountSnapshot?.paypalUsername || '待补充'} / ${accountSnapshot?.paypalEmail || '待补充'}`
    : `${accountSnapshot?.accountName || '待补充'} / ${accountSnapshot?.iban || accountSnapshot?.accountNumber || '待补充'}`;
  const expectedPublisher = selectedAccount?.provider === 'PayPal'
    ? accountSnapshot?.paypalUsername || '达人档案账户主体待补充'
    : accountSnapshot?.accountName || '达人档案账户主体待补充';
  const baselineValueFor = (field: ExternalInvoiceFieldKey) => {
    if (field === 'SOURCE_INVOICE_NUMBER') return '非空且未被其他 Invoice 使用';
    if (field === 'INVOICE_DATE') return confirmation?.values.INVOICE_DATE ?? '待确认';
    if (field === 'PUBLISHER') return expectedPublisher;
    if (field === 'ADVERTISER') return record.expected.advertiser;
    if (field === 'DESCRIPTION') return record.expected.description;
    if (field === 'AMOUNT') return record.expected.amount.toFixed(2);
    if (field === 'CURRENCY') return record.expected.currency;
    return profileAccountValue;
  };
  const reviewFields: InvoiceReviewOverviewField[] = recognition && confirmation
    ? EXTERNAL_INVOICE_FIELD_ORDER.map((field) => {
        const recognized = recognition.fields[field];
        const confirmedValue = confirmation.values[field];
        const correction = confirmation.corrections.find((item) => item.fieldKey === field);
        const review = currentExternalInvoiceFieldReview(record, field);
        const validationIssue = issues.find((issue) => issue.fieldKey === field && issue.severity === 'BLOCKER');
        const corrected = recognized.value.trim() !== confirmedValue.trim();
        const needsCriticalReview = Boolean(
          corrected
          && EXTERNAL_INVOICE_CRITICAL_FIELDS.includes(field)
          && review?.decision !== 'CONFIRMED_CORRECTION',
        );
        const sourceRequiresReupload = currentFile?.scenario === 'SOURCE_FILE_ERROR' && Boolean(validationIssue);
        const status: InvoiceReviewOverviewField['status'] = review?.decision === 'REUPLOAD_REQUIRED'
          ? 'REUPLOAD_REQUIRED'
          : review?.decision === 'ANOMALY'
            ? 'MISMATCH'
            : sourceRequiresReupload
              ? 'REUPLOAD_REQUIRED'
              : validationIssue
                ? 'MISMATCH'
                : needsCriticalReview
                  ? 'PENDING_REVIEW'
                  : corrected
                    ? 'CORRECTED'
                    : confirmedValue
                      ? 'MATCHED'
                      : 'MISSING';
        const statusLabel = status === 'MATCHED'
          ? '一致'
          : status === 'CORRECTED'
            ? review?.decision === 'CONFIRMED_CORRECTION' ? '达人已纠正 · 已复核' : '达人已纠正'
            : status === 'PENDING_REVIEW'
              ? '待媒介复核'
              : status === 'REUPLOAD_REQUIRED'
                ? '必须重新上传'
                : status === 'MISSING'
                  ? '未识别'
                  : '不一致';
        return {
          id: field,
          label: EXTERNAL_INVOICE_FIELD_LABEL[field],
          baselineValue: baselineValueFor(field),
          confirmedValue: confirmedValue || '未识别',
          status,
          statusLabel,
          evidenceTarget: field,
          evidence: {
            sourceValue: recognized.evidence.sourceValue,
            recognizedValue: recognized.value,
            confirmedValue,
            correctionReason: correction ? '系统识别错误，达人已按原文件纠正' : undefined,
            correctedBy: correction?.correctedBy.name,
            correctedAt: correction?.correctedAt,
            mediaReview: review?.decision === 'CONFIRMED_CORRECTION'
              ? '媒介已确认纠正'
              : review?.decision === 'REUPLOAD_REQUIRED'
                ? '媒介要求重新上传'
                : review?.decision === 'ANOMALY'
                  ? '媒介已标记异常'
                  : corrected && EXTERNAL_INVOICE_CRITICAL_FIELDS.includes(field)
                    ? '待媒介复核'
                    : '无需额外复核',
            pageNumber: recognized.evidence.pageNumber,
          },
          allowConfirmCorrection: canReview
            && record.status === 'WAITING_MEDIA_REVIEW'
            && needsCriticalReview
            && correction?.evidenceMatched,
          allowExceptionActions: canReview && record.status === 'WAITING_MEDIA_REVIEW',
        };
      })
    : [];
  const selectedContracts = contracts.filter((contract) => (
    contract.contractId && record.contractIds.includes(contract.contractId)
  ));
  const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const contractValueList = (values: Array<string | undefined>) => (
    values.map((value) => value?.trim()).filter(Boolean).join('；') || '合同未填写'
  );
  const contractPublishers = selectedContracts.map((contract) => contract.publisher).filter(Boolean);
  const contractAdvertisers = selectedContracts.map((contract) => contract.advertiser).filter(Boolean);
  const contractCurrencies = [...new Set(selectedContracts.map((contract) => contract.currency).filter(Boolean))];
  const contractAmounts = selectedContracts.map((contract) => contract.totalFee).filter((value): value is number => value !== null);
  const contractAccountIds = selectedContracts.map((contract) => (
    contract.payoutAccountId || contract.paymentSnapshot?.payoutAccountId
  )).filter(Boolean);
  const contractChecks: InvoiceReviewContractCheck[] = selectedContracts.length && confirmation ? [
    {
      id: 'advertiser',
      label: '付款主体',
      contractValue: contractValueList(contractAdvertisers),
      invoiceValue: confirmation.values.ADVERTISER,
      state: contractAdvertisers.length && contractAdvertisers.every((value) => normalized(value) === normalized(confirmation.values.ADVERTISER)) ? 'PASS' : contractAdvertisers.length ? 'FAIL' : 'NOT_APPLICABLE',
      note: contractAdvertisers.length ? '付款主体需要逐份合同一致。' : '合同未填写付款主体，不参与匹配。',
      evidenceTarget: 'ADVERTISER',
    },
    {
      id: 'publisher',
      label: '开票 / 收款主体',
      contractValue: contractValueList(contractPublishers),
      invoiceValue: confirmation.values.PUBLISHER,
      state: contractPublishers.length && contractPublishers.every((value) => normalized(value) === normalized(confirmation.values.PUBLISHER)) ? 'PASS' : contractPublishers.length ? 'FAIL' : 'NOT_APPLICABLE',
      note: contractPublishers.length ? 'Publisher 与达人最终确认的开票主体对照。' : '合同未填写 Publisher，不参与匹配。',
      evidenceTarget: 'PUBLISHER',
    },
    {
      id: 'account',
      label: '收款信息',
      contractValue: contractAccountIds.join('；') || '合同未绑定账户',
      invoiceValue: confirmation.values.PAYMENT_ACCOUNT,
      state: !contractAccountIds.length ? 'NOT_APPLICABLE' : contractAccountIds.every((value) => value === confirmation.payoutAccountId) ? 'PASS' : 'WARNING',
      note: '合同账户差异只提示，不自动替换达人本次选择的已审核账户。',
      evidenceTarget: 'PAYMENT_ACCOUNT',
    },
    {
      id: 'amount',
      label: '金额',
      contractValue: contractAmounts.length ? contractAmounts.reduce((sum, value) => sum + value, 0).toFixed(2) : '合同未填写金额',
      invoiceValue: confirmation.values.AMOUNT,
      state: !contractAmounts.length ? 'NOT_APPLICABLE' : contractAmounts.reduce((sum, value) => sum + value, 0) === Number(confirmation.values.AMOUNT) ? 'PASS' : 'WARNING',
      note: '金额差异需要媒介关注，但不改变 Invoice 与任务基准的严格校验。',
      evidenceTarget: 'AMOUNT',
    },
    {
      id: 'currency',
      label: '币种',
      contractValue: contractCurrencies.join('；') || '合同未填写币种',
      invoiceValue: confirmation.values.CURRENCY,
      state: !contractCurrencies.length ? 'NOT_APPLICABLE' : contractCurrencies.every((value) => normalized(value) === normalized(confirmation.values.CURRENCY)) ? 'PASS' : 'WARNING',
      note: '合同币种差异作为审核提醒展示。',
      evidenceTarget: 'CURRENCY',
    },
    {
      id: 'signature',
      label: '签名完整性',
      contractValue: '外部票据文件需完整有效',
      invoiceValue: currentFile ? `文件 v${currentFile.version} 已归档` : '当前文件缺失',
      state: currentFile ? 'PASS' : 'FAIL',
      note: currentFile ? '当前原文件版本有效，可追溯历史版本。' : '缺少有效原文件。',
    },
  ] : [];
  const maskTail = (value?: string) => {
    const normalizedValue = value?.replace(/\s/g, '') ?? '';
    return normalizedValue ? `•••• ${normalizedValue.slice(-4)}` : '待补充';
  };
  const accountRows: InvoiceReviewAccountRow[] = [
    { label: '付款方式', value: selectedAccount?.provider ?? '待选择' },
    { label: 'Account Name', value: selectedAccount?.provider === 'PayPal' ? accountSnapshot?.paypalUsername || '待补充' : accountSnapshot?.accountName || '待补充' },
    { label: 'Account Number 尾号', value: selectedAccount?.provider === 'PayPal' ? '不适用' : maskTail(accountSnapshot?.accountNumber) },
    { label: 'Bank Name', value: accountSnapshot?.bankName || (selectedAccount?.provider === 'PayPal' ? '不适用' : '待补充') },
    { label: 'SWIFT / BIC', value: accountSnapshot?.swiftCode || (selectedAccount?.provider === 'PayPal' ? '不适用' : '待补充') },
    { label: 'IBAN', value: accountSnapshot?.iban ? maskTail(accountSnapshot.iban) : '不适用' },
    { label: 'PayPal Email', value: selectedAccount?.provider === 'PayPal' ? accountSnapshot?.paypalEmail || '待补充' : '不适用' },
    { label: '账户审核状态', value: accountSnapshot?.validationStatus === 'VERIFIED' ? '已审核通过' : accountSnapshot?.validationStatus || '待审核' },
  ];
  const accountMatched = Boolean(
    confirmation
    && normalized(confirmation.values.PAYMENT_ACCOUNT) === normalized(profileAccountValue),
  );
  const eventLabel: Record<ExternalInvoiceCollectionRecord['reviewHistory'][number]['action'], string> = {
    CREATED: '任务创建',
    PUBLISHED: '任务发布',
    FILE_UPLOADED: '达人上传原始 Invoice',
    RECOGNITION_CORRECTED: '达人纠正识别结果',
    FIELD_REVIEWED: '媒介字段复核',
    SUBMITTED: '提交媒介审核',
    RETURNED_FOR_CORRECTION: '退回纠正识别结果',
    RETURNED_FOR_REUPLOAD: '要求重新上传',
    APPROVED: '审核通过',
  };
  const reviewTimeline: InvoiceReviewTimelineItem[] = [
    ...record.reviewHistory.map((event) => ({
      id: event.eventId,
      title: event.fieldKey ? `${eventLabel[event.action]} · ${EXTERNAL_INVOICE_FIELD_LABEL[event.fieldKey]}` : eventLabel[event.action],
      description: event.reason ?? `${event.fromStatus ? `${TECHNICAL_STATUS_LABEL[event.fromStatus]} → ` : ''}${TECHNICAL_STATUS_LABEL[event.toStatus]}`,
      meta: `${event.actor.name} · ${event.actor.role} · ${new Date(event.occurredAt).toLocaleString('zh-CN')}`,
      state: event.action === 'RETURNED_FOR_CORRECTION' || event.action === 'RETURNED_FOR_REUPLOAD' ? 'RETURNED' as const : 'COMPLETE' as const,
    })),
    ...(record.status === 'APPROVED' ? [
      { id: 'request-pending', title: '进入请款', description: '等待媒介在合作项目中发起请款', state: 'CURRENT' as const },
      { id: 'payment-pending', title: '进入付款', description: '请款审批通过后进入付款工作台', state: 'PENDING' as const },
    ] : []),
  ];
  const readiness = externalInvoiceReviewReadiness({ record, creator, contracts });
  const contractBlockers = contractChecks.filter((check) => check.state === 'FAIL').map((check) => `${check.label}与合同不一致`);
  const workspaceBlockers = [...readiness.blockers, ...contractBlockers];
  const workspaceIssueCount = reviewFields.filter((field) => (
    field.status === 'PENDING_REVIEW'
    || field.status === 'MISMATCH'
    || field.status === 'MISSING'
    || field.status === 'REUPLOAD_REQUIRED'
  )).length + contractBlockers.length;

  const downloadPrototypeSource = () => {
    if (!currentFile || !recognition) return;
    const content = [
      'COMETS Pay front-end prototype evidence export',
      `Source file metadata: ${currentFile.fileName}`,
      ...EXTERNAL_INVOICE_FIELD_ORDER.map((field) => `${EXTERNAL_INVOICE_FIELD_LABEL[field]}: ${recognition.fields[field].evidence.sourceValue}`),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${currentFile.fileName.replace(/\.[^.]+$/, '')}-prototype-evidence.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

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

      {reviewWorkspaceVisible && recognition && confirmation ? (
        <InvoiceReviewWorkspace
          sourceType="EXTERNAL_UPLOADED"
          issueCount={workspaceIssueCount}
          sourceStatusText={record.status === 'APPROVED' ? '媒介审核已通过' : TECHNICAL_STATUS_LABEL[record.status]}
          documentName={currentFile?.fileName ?? '外部 Invoice 原始文件'}
          documentMeta={`原始文件 v${currentFile?.version ?? 1} · OCR ${recognition.engineVersion} · 前端原型预览`}
          documentContent={(
            <article className="external-document-preview invoice-review-external-document" aria-label="外部 Invoice 原始文件证据预览">
              <div className="external-document-title"><strong>INVOICE</strong><small>{currentFile?.fileName}</small></div>
              {EXTERNAL_INVOICE_FIELD_ORDER.map((field) => (
                <div data-review-evidence={field} key={field}>
                  <span>{EXTERNAL_INVOICE_FIELD_LABEL[field]}</span>
                  <strong>{recognition.fields[field].evidence.sourceValue}</strong>
                </div>
              ))}
            </article>
          )}
          onDownload={downloadPrototypeSource}
          overviewFields={reviewFields}
          contractChecks={contractChecks}
          noContract={selectedContracts.length === 0}
          accountRows={accountRows}
          accountComparison={{
            invoiceValue: confirmation.values.PAYMENT_ACCOUNT,
            profileValue: profileAccountValue,
            matched: accountMatched,
            message: accountMatched
              ? 'Invoice 文件账户与达人档案中的已审核账户一致。'
              : '账户不一致，不能直接使用 Invoice 文件中的新账户付款。',
            evidenceTarget: 'PAYMENT_ACCOUNT',
          }}
          timeline={reviewTimeline}
          completion={record.status === 'APPROVED'
            ? { completed: readiness.total, total: readiness.total }
            : { completed: readiness.completed, total: readiness.total }}
          blockingReasons={record.status === 'APPROVED' ? [] : workspaceBlockers}
          onFieldAction={record.status === 'WAITING_MEDIA_REVIEW' ? (fieldId, action, note) => {
            const decision: ExternalInvoiceMediaReviewDecision = action === 'CONFIRM_CORRECTION'
              ? 'CONFIRMED_CORRECTION'
              : action;
            onReviewField(fieldId as ExternalInvoiceFieldKey, decision, note);
          } : undefined}
          returnLabel={record.status === 'WAITING_MEDIA_REVIEW' ? '退回达人' : undefined}
          returnDialogTitle="退回外部 Invoice"
          returnOptions={[
            { value: 'CORRECTION', label: '退回纠正识别结果', description: '原文件正确，达人需按原文重新确认识别值' },
            { value: 'REUPLOAD', label: '要求重新上传', description: '原文件内容有误，达人必须提交新文件版本' },
          ]}
          onReturn={record.status === 'WAITING_MEDIA_REVIEW'
            ? (reason, option) => onReturn(option === 'REUPLOAD' ? 'REUPLOAD' : 'CORRECTION', reason)
            : undefined}
          onSave={record.status === 'WAITING_MEDIA_REVIEW' ? onSaveReviewProgress : undefined}
          approveLabel={record.status === 'WAITING_MEDIA_REVIEW' ? '审核通过' : undefined}
          onApprove={record.status === 'WAITING_MEDIA_REVIEW' ? onApprove : undefined}
          approveDisabled={!readiness.canApprove || contractBlockers.length > 0}
          canReview={canReview && record.status === 'WAITING_MEDIA_REVIEW'}
        />
      ) : (
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
                  <Button disabled={!payoutAccountId || !invoiceDate} variant="secondary" onClick={() => onSimulateUpload('ACCOUNT_MISMATCH', payoutAccountId, invoiceDate)}>模拟收款账户不一致</Button>
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


          <section className="content-card external-history-panel">
            <div className="external-section-heading"><div><History size={18} /><h2>操作历史</h2></div><p>记录实际操作账号与每次状态变化</p></div>
            <div className="external-history-list">{[...record.reviewHistory].reverse().map((event) => <div key={event.eventId}><span className="external-history-dot" /><div><strong>{event.actor.name} · {event.action}</strong><p>{event.reason ?? `${event.fromStatus ? `${TECHNICAL_STATUS_LABEL[event.fromStatus]} → ` : ''}${TECHNICAL_STATUS_LABEL[event.toStatus]}`}</p><small>{new Date(event.occurredAt).toLocaleString('zh-CN')} · {event.actor.role}</small></div></div>)}</div>
          </section>
        </div>
      </div>
      )}

    </div>
  );
}
