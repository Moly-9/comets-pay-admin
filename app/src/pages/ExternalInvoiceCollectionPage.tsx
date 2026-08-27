import {
  ArrowLeft,
  BriefcaseBusiness,
  CircleDollarSign,
  RefreshCw,
  Send,
  Upload,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { accountDisplayValue } from '../accountPresentation';
import { Button, Modal, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { paymentProviderDisplayName } from '../components/PaymentProviderBadge';
import { SearchableComboBox } from '../components/SearchableComboBox';
import { creatorSearchOption } from '../creatorSearchOptions';
import {
  InvoiceReviewMetricGrid,
  InvoiceReviewWorkspace,
  type InvoiceReviewAccountRow,
  type InvoiceReviewContractCheck,
  type InvoiceReviewOverviewField,
  type InvoiceReviewSummaryField,
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
  EXTERNAL_INVOICE_REVIEW_FIELD_ORDER,
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
import {
  defaultInvoiceBillingEntity,
  invoiceEntitySnapshot,
} from '../invoice/invoiceBillingEntities';
import { formatInvoiceMoney, todayInputValue } from '../invoice/invoiceUtils';
import {
  createDocumentPayoutSnapshot,
  eligibleInvoicePayoutAccounts,
  getPayoutAccountId,
  getPayoutAccountSummary,
} from '../payoutAccounts';
import type { CooperationProjectId, ContractId, CreatorId, EngagementId, ProjectId } from '../businessWorkflow';
import type { CreatorProfile, InvoiceBillingSettings, InvoiceCurrency } from '../types';
import type { ProjectSummary } from './ProjectDetailPage';
import './ExternalInvoiceCollectionPage.css';

const CURRENCIES: InvoiceCurrency[] = ['USD', 'EUR', 'GBP', 'HKD', 'SGD'];

const TECHNICAL_STATUS_LABEL: Record<ExternalInvoiceCollectionRecord['status'], string> = {
  DRAFT: '收集信息草稿',
  WAITING_UPLOAD: '等待 C 端上传',
  RECOGNIZING: 'OCR 识别中',
  WAITING_CONFIRMATION: '等待达人确认识别结果',
  WAITING_MEDIA_REVIEW: '待审核',
  RETURNED_FOR_CORRECTION: '已退回纠正识别结果',
  RETURNED_FOR_REUPLOAD: '已要求重新上传',
  APPROVED: '审核通过',
  RECOGNITION_FAILED: 'OCR 识别失败',
  CANCELLED: '已取消',
};

export function ExternalInvoiceCollectionCreatePage({
  projects,
  creators,
  contracts,
  invoiceBillingSettings,
  onCreate,
  onBack,
}: {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  invoiceBillingSettings: InvoiceBillingSettings;
  onCreate: (input: ExternalInvoiceCollectionInput, publish: boolean) => void;
  onBack: () => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [creatorId, setCreatorId] = useState('');
  const [contractIds, setContractIds] = useState<ContractId[]>([]);
  const [amount, setAmount] = useState('4800');
  const [currency, setCurrency] = useState<InvoiceCurrency>('USD');
  const [billingEntityId, setBillingEntityId] = useState(
    () => defaultInvoiceBillingEntity(invoiceBillingSettings)!.id,
  );
  const [description, setDescription] = useState('Creator content production and publishing services');
  const [dueDate, setDueDate] = useState('2026-09-05');

  const selectedProject = projects.find((project) => String(project.projectId ?? project.id) === projectId);
  const creatorReferences = selectedProject?.creatorProfiles?.filter((reference) => reference.status !== 'removed') ?? [];
  const selectedReference = creatorReferences.find((reference) => String(reference.creatorId) === creatorId);
  const selectedCreator = creators.find((creator) => String(creator.id) === creatorId);
  const selectedBillingEntity = invoiceBillingSettings.entities.find((entity) => (
    entity.id === billingEntityId
  )) ?? defaultInvoiceBillingEntity(invoiceBillingSettings)!;
  const billingEntityOptions = useMemo(() => invoiceBillingSettings.entities.map((entity) => ({
    value: entity.id,
    label: entity.name,
    description: entity.address,
    badges: entity.id === invoiceBillingSettings.defaultEntityId
      ? [{ label: '默认', tone: 'success' as const }]
      : undefined,
  })), [invoiceBillingSettings]);
  const projectOptions = useMemo(() => projects.map((project) => ({
    value: String(project.projectId ?? project.id),
    label: project.name,
    description: [project.projectCode ?? project.cooperationProjectCode ?? project.id, project.brand].filter(Boolean).join(' · '),
    leading: <BriefcaseBusiness size={17} />,
  })), [projects]);
  const creatorOptions = useMemo(() => creatorReferences.map((reference) => {
    const creator = creators.find((item) => String(item.id) === String(reference.creatorId));
    if (creator) return creatorSearchOption(creator);
    const channelId = reference.handle || '频道 ID 待补充';
    const platform = reference.platform || '社媒平台待补充';
    return {
      value: String(reference.creatorId),
      label: reference.name,
      selectedLabel: `${reference.name} · ${channelId} · ${platform}`,
      description: `${channelId} · ${platform}`,
      searchText: [reference.name, reference.handle, reference.platform].filter(Boolean).join(' '),
    };
  }), [creatorReferences, creators]);
  const eligibleContracts = useMemo(() => contracts.filter((contract) => (
    contract.lifecycle === 'CONFIRMED'
    && Boolean(contract.contractId)
    && String(contract.creatorId) === creatorId
    && contractLinkedToProject(contract, projectId as CooperationProjectId)
  )), [contracts, creatorId, projectId]);
  const defaultPayoutAccount = eligibleInvoicePayoutAccounts(selectedCreator).find((account) => account.isDefault);
  const presetPayoutAccountId = defaultPayoutAccount ? getPayoutAccountId(defaultPayoutAccount) : '';
  const presetPayoutAccountSnapshot = defaultPayoutAccount
    ? createDocumentPayoutSnapshot(defaultPayoutAccount, selectedCreator?.id)
    : undefined;
  const validAmount = Number(amount) > 0;
  const complete = Boolean(
    selectedProject
    && selectedReference
    && selectedCreator
    && validAmount
    && selectedBillingEntity
    && description.trim()
    && dueDate
    && presetPayoutAccountId
    && presetPayoutAccountSnapshot,
  );

  const submit = (publish: boolean) => {
    if (
      !complete
      || !selectedProject
      || !selectedReference
      || !selectedCreator
      || !presetPayoutAccountSnapshot
    ) return;
    onCreate({
      projectId: (selectedProject.projectId ?? selectedProject.id) as ProjectId,
      projectName: selectedProject.name,
      engagementId: selectedReference.engagementId as EngagementId,
      creatorId: selectedReference.creatorId as CreatorId,
      creatorName: selectedCreator.name,
      creatorHandle: selectedCreator.socialAccounts.find((account) => account.handle.trim())?.handle
        ?? selectedCreator.handle,
      contractIds,
      presetPayoutAccountId,
      presetPayoutAccountSnapshot,
      expected: {
        amount: Number(amount),
        currency,
        billTo: invoiceEntitySnapshot(selectedBillingEntity),
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
              <SearchableComboBox
                ariaLabel="选择项目内达人"
                className="creator-search-combobox"
                value={creatorId}
                placeholder={selectedProject ? '搜索频道链接、频道 ID、Account Name 或 Display Name' : '请先选择合作项目'}
                options={creatorOptions}
                disabled={!selectedProject}
                onChange={(value) => {
                  setCreatorId(value);
                  setContractIds([]);
                }}
                onClear={() => {
                  setCreatorId('');
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
            <div className="form-control">
              <span className="required-field-label">付款主体 <em className="required-mark">*</em></span>
              <SelectField
                ariaLabel="选择外部 Invoice 付款主体"
                variant="form"
                menuStrategy="fixed"
                value={billingEntityId}
                options={billingEntityOptions}
                onChange={setBillingEntityId}
              />
            </div>
            <label><span className="required-field-label">截止时间 <em className="required-mark">*</em></span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <label className="external-form-span"><span className="required-field-label">合作内容 <em className="required-mark">*</em></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          </div>
          <div className="external-form-footer">
            <NoticeBanner>
              {selectedCreator && !defaultPayoutAccount
                ? '该达人没有默认且已审核的收款账户，请先完善达人档案后再创建采集任务。'
                : defaultPayoutAccount
                  ? `任务将预设默认已审核账户：${defaultPayoutAccount.nickname}。发布后由 C 端达人上传 Invoice。`
                  : '保存草稿后列表显示“待发布”；正式发布后才会出现在 C 端待办中。'}
            </NoticeBanner>
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
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [payoutAccountId, setPayoutAccountId] = useState(
    record.selectedPayoutAccountId ?? record.presetPayoutAccountId,
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
  const currentFile = record.sourceFileVersions[record.sourceFileVersions.length - 1];
  const hasUploadedEvidence = Boolean(recognition && confirmation && currentFile);
  const selectedAccount = accounts.find((account) => getPayoutAccountId(account) === confirmation?.payoutAccountId);
  const selectedAccountSnapshot = selectedAccount
    ? createDocumentPayoutSnapshot(selectedAccount, record.creatorId)
    : undefined;
  const accountSnapshot = selectedAccountSnapshot ?? record.presetPayoutAccountSnapshot;
  const accountProvider = selectedAccountSnapshot?.payoutProvider
    ?? record.presetPayoutAccountSnapshot.payoutProvider;
  const profileAccountValue = accountProvider === 'PayPal'
    ? `${accountSnapshot.paypalUsername || '待补充'} / ${accountSnapshot.paypalEmail || '待补充'}`
    : `${accountSnapshot.accountName || '待补充'} / ${accountSnapshot.iban || accountSnapshot.accountNumber || '待补充'}`;
  const expectedPublisher = accountProvider === 'PayPal'
    ? accountSnapshot.paypalUsername || '达人档案账户主体待补充'
    : accountSnapshot.accountName || '达人档案账户主体待补充';
  const displayCurrency = confirmation?.values.CURRENCY || record.expected.currency;
  const displayAmount = Number(confirmation?.values.AMOUNT ?? record.expected.amount);
  const displayPaymentMethod = accountProvider === 'PayPal'
    ? 'PayPal'
    : accountProvider
      ? '银行转账'
      : '待选择';
  const presetAccount = accounts.find((account) => getPayoutAccountId(account) === record.presetPayoutAccountId);
  const displayPaymentSummary = selectedAccount
    ? `${paymentProviderDisplayName(selectedAccount.provider)} · ${getPayoutAccountSummary(selectedAccount)}`
    : presetAccount
      ? `${paymentProviderDisplayName(presetAccount.provider)} · ${getPayoutAccountSummary(presetAccount)}`
      : `${accountProvider ? paymentProviderDisplayName(accountProvider) : '已审核账户'} · 任务预设快照`;
  const baselineValueFor = (field: ExternalInvoiceFieldKey) => {
    if (field === 'INVOICE_DATE') return confirmation?.values.INVOICE_DATE ?? '待确认';
    if (field === 'PUBLISHER') return expectedPublisher;
    if (field === 'ADVERTISER') return record.expected.billTo.name;
    if (field === 'DESCRIPTION') return record.expected.description;
    if (field === 'AMOUNT') return record.expected.amount.toFixed(2);
    if (field === 'CURRENCY') return record.expected.currency;
    return profileAccountValue;
  };
  const reviewFields: InvoiceReviewOverviewField[] = recognition && confirmation
    ? EXTERNAL_INVOICE_REVIEW_FIELD_ORDER.map((field) => {
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
              ? '待复核'
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
              ? '已确认纠正'
              : review?.decision === 'REUPLOAD_REQUIRED'
                ? '已要求重新上传'
                : review?.decision === 'ANOMALY'
                  ? '已标记异常'
                  : corrected && EXTERNAL_INVOICE_CRITICAL_FIELDS.includes(field)
                    ? '待复核'
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
  const accountRows: InvoiceReviewAccountRow[] = [
    { label: '付款方式', value: accountProvider ?? '待选择' },
    { label: 'Account Name', value: accountProvider === 'PayPal' ? accountSnapshot.paypalUsername || '待补充' : accountSnapshot.accountName || '待补充' },
    { label: 'Account Number', value: accountProvider === 'PayPal' ? '不适用' : accountDisplayValue(accountSnapshot.accountNumber) },
    { label: 'Bank Name', value: accountSnapshot.bankName || (accountProvider === 'PayPal' ? '不适用' : '待补充') },
    { label: 'SWIFT / BIC', value: accountSnapshot.swiftCode || (accountProvider === 'PayPal' ? '不适用' : '待补充') },
    { label: 'IBAN', value: accountSnapshot.iban ? accountDisplayValue(accountSnapshot.iban) : '不适用' },
    { label: 'PayPal Email', value: accountProvider === 'PayPal' ? accountSnapshot.paypalEmail || '待补充' : '不适用' },
    { label: '账户审核状态', value: ['VALIDATED', 'VERIFIED'].includes(accountSnapshot.validationStatus ?? '') ? '已审核通过' : accountSnapshot.validationStatus || '待审核' },
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
    FIELD_REVIEWED: '字段复核',
    SUBMITTED: '提交审核',
    RETURNED_FOR_CORRECTION: '退回纠正识别结果',
    RETURNED_FOR_REUPLOAD: '要求重新上传',
    APPROVED: '审核通过',
  };
  const latestEvent = (...actions: ExternalInvoiceCollectionRecord['reviewHistory'][number]['action'][]) => (
    [...record.reviewHistory].reverse().find((event) => actions.includes(event.action))
  );
  const formatEventMeta = (event?: ExternalInvoiceCollectionRecord['reviewHistory'][number]) => event
    ? `${event.actor.name} · ${event.actor.role} · ${new Date(event.occurredAt).toLocaleString('zh-CN')}`
    : undefined;
  const uploadEvent = latestEvent('FILE_UPLOADED');
  const confirmationEvent = latestEvent('SUBMITTED', 'RECOGNITION_CORRECTED');
  const mediaReviewEvent = latestEvent('APPROVED', 'RETURNED_FOR_CORRECTION', 'RETURNED_FOR_REUPLOAD', 'FIELD_REVIEWED');
  const externalCurrentIndex = record.status === 'DRAFT'
    ? 0
    : record.status === 'WAITING_UPLOAD' || record.status === 'RETURNED_FOR_REUPLOAD'
      ? 1
      : record.status === 'RECOGNIZING' || record.status === 'WAITING_CONFIRMATION' || record.status === 'RETURNED_FOR_CORRECTION' || record.status === 'RECOGNITION_FAILED'
        ? 2
        : record.status === 'WAITING_MEDIA_REVIEW'
          ? 3
          : 4;
  const isReturnedStage = (index: number) => (
    (record.status === 'RETURNED_FOR_REUPLOAD' && index === 1)
    || (record.status === 'RETURNED_FOR_CORRECTION' && index === 2)
  );
  const externalStages = [
    {
      title: '收集任务已创建',
      description: record.status === 'DRAFT' ? '任务信息已保存，等待媒介发布' : '任务基准、达人和预设账户已固定',
      meta: formatEventMeta(latestEvent('PUBLISHED') ?? latestEvent('CREATED')),
    },
    {
      title: '达人上传 Invoice',
      description: currentFile ? `原始文件 V${currentFile.version} 已归档` : '等待达人上传 PDF、JPG 或 PNG',
      meta: formatEventMeta(uploadEvent),
    },
    {
      title: '识别结果确认',
      description: confirmation
        ? `达人已确认 ${EXTERNAL_INVOICE_FIELD_ORDER.length} 个识别字段`
        : recognition
          ? 'OCR 已完成，等待达人确认识别结果'
          : '等待原始文件上传后进行识别',
      meta: formatEventMeta(confirmationEvent),
    },
    {
      title: '媒介审核',
      description: record.status === 'APPROVED'
        ? '关键字段、合同与收款账户已完成审核'
        : record.status === 'WAITING_MEDIA_REVIEW'
          ? '等待媒介核对票据证据与达人最终确认值'
          : '达人提交后进入媒介审核',
      meta: formatEventMeta(mediaReviewEvent),
    },
    {
      title: '进入请款与付款',
      description: record.status === 'APPROVED' ? '可在合作项目中选择该 Invoice 发起请款' : '审核通过后进入可请款状态',
    },
  ];
  const reviewTimeline: InvoiceReviewTimelineItem[] = externalStages.map((stage, index) => ({
    id: `external-stage-${index}`,
    ...stage,
    state: isReturnedStage(index)
      ? 'RETURNED'
      : index < externalCurrentIndex
        ? 'COMPLETE'
        : index === externalCurrentIndex
          ? 'CURRENT'
          : 'PENDING',
  }));
  const lastReturnEvent = latestEvent('RETURNED_FOR_CORRECTION', 'RETURNED_FOR_REUPLOAD');
  const externalHistorySummary = [
    { label: '原始文件版本', value: currentFile ? `V${currentFile.version}` : '未上传' },
    { label: 'OCR 识别版本', value: recognition ? `V${record.recognitionSnapshots.length}` : '未生成' },
    { label: '达人确认轮次', value: confirmation ? `第 ${record.confirmedSnapshots.length} 轮` : '未确认' },
    { label: '媒介复核字段', value: `${record.mediaFieldReviews.length} 项` },
    { label: '最近上传时间', value: currentFile ? new Date(currentFile.uploadedAt).toLocaleString('zh-CN') : '待上传' },
    { label: '退回说明', value: lastReturnEvent?.reason ?? '无待处理退回' },
  ];
  const externalCurrentTask = {
    title: record.status === 'APPROVED' ? '待发起请款' : '执行当前采集任务',
    transition: `${eventLabel[record.reviewHistory[record.reviewHistory.length - 1]?.action ?? 'CREATED']} → ${TECHNICAL_STATUS_LABEL[record.status]}`,
    assignee: record.status === 'WAITING_MEDIA_REVIEW'
      ? '媒介审核人'
      : record.status === 'DRAFT'
        ? record.createdBy.name
        : record.status === 'APPROVED'
          ? '媒介请款人'
          : record.creatorName,
    updatedAt: new Date(record.reviewHistory[record.reviewHistory.length - 1]?.occurredAt ?? record.createdAt).toLocaleString('zh-CN'),
    instruction: record.status === 'DRAFT'
      ? '发布采集任务后，达人端才会收到上传待办。'
      : record.status === 'WAITING_MEDIA_REVIEW'
        ? '核对原文件证据、达人确认值、合同和收款账户后完成审核。'
        : record.status === 'APPROVED'
          ? '在合作项目中选择该 Invoice 发起请款。'
          : lastReturnEvent?.reason ?? '按当前步骤完成上传、识别确认或重新提交。',
    tone: lastReturnEvent && ['RETURNED_FOR_CORRECTION', 'RETURNED_FOR_REUPLOAD'].includes(record.status)
      ? 'danger' as const
      : record.status === 'WAITING_MEDIA_REVIEW'
        ? 'warning' as const
        : 'neutral' as const,
  };
  const readiness = externalInvoiceReviewReadiness({ record, creator, contracts });
  const contractBlockers = contractChecks.filter((check) => check.state === 'FAIL').map((check) => `${check.label}与合同不一致`);
  const workspaceBlockers = [...readiness.blockers, ...contractBlockers];
  const workspaceIssueCount = reviewFields.filter((field) => (
    field.status === 'PENDING_REVIEW'
    || field.status === 'MISMATCH'
    || field.status === 'MISSING'
    || field.status === 'REUPLOAD_REQUIRED'
  )).length + contractBlockers.length;
  const collectionSummaryFields: InvoiceReviewSummaryField[] = [
    { id: 'creator', label: '达人', value: record.creatorName, secondary: record.creatorHandle },
    { id: 'project', label: '关联项目', value: record.projectName },
    {
      id: 'expected-amount',
      label: '预计币种&金额',
      value: formatInvoiceMoney(record.expected.currency, record.expected.amount),
    },
    { id: 'advertiser', label: '付款主体', value: record.expected.billTo.name },
    { id: 'description', label: '合作内容', value: record.expected.description },
    { id: 'due-date', label: '截止时间', value: record.expected.dueDate },
  ];
  const pendingIssueStatus = record.status === 'DRAFT'
    ? '采集任务待发布'
    : !hasUploadedEvidence
      ? '等待达人上传'
      : undefined;
  const pendingFooterStatus = record.status === 'DRAFT'
    ? { title: '采集任务尚未发布', message: '发布后将生成 C 端待上传任务。', tone: 'neutral' as const }
    : !hasUploadedEvidence
      ? { title: '等待达人上传 Invoice', message: '已固定任务基准与预设收款账户。', tone: 'neutral' as const }
      : record.status === 'WAITING_CONFIRMATION'
        ? { title: '等待达人确认并提交', message: '可通过模拟 C 端回传完成纠正或提交审核。', tone: 'neutral' as const }
        : undefined;

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

      <InvoiceReviewMetricGrid items={[
        {
          label: 'Invoice类型',
          value: '外部 Invoice',
          secondary: '达人上传 · 保留原始文件与识别版本',
        },
        {
          label: '当前状态',
          value: externalInvoiceListStatus(record.status),
          secondary: TECHNICAL_STATUS_LABEL[record.status],
        },
        {
          label: 'Invoice金额',
          value: formatInvoiceMoney(displayCurrency, Number.isFinite(displayAmount) ? displayAmount : record.expected.amount),
          secondary: `任务基准 · ${displayCurrency}`,
        },
        {
          label: '付款方式',
          value: displayPaymentMethod,
          secondary: displayPaymentSummary,
        },
      ]} />

      <InvoiceReviewWorkspace
        sourceType="EXTERNAL_UPLOADED"
        issueCount={hasUploadedEvidence ? workspaceIssueCount : 0}
        issueStatusText={pendingIssueStatus}
        sourceStatusText={record.status === 'APPROVED' ? '审核已通过' : TECHNICAL_STATUS_LABEL[record.status]}
        documentName={currentFile?.fileName ?? '外部 Invoice 原始文件'}
        documentMeta={recognition && currentFile
          ? `原始文件 v${currentFile.version} · OCR ${recognition.engineVersion} · 前端原型预览`
          : '尚未上传 · 支持 PDF、JPG 和 PNG'}
        documentUnavailable={!hasUploadedEvidence}
        downloadDisabled={!hasUploadedEvidence}
        documentContent={recognition && currentFile ? (
          <article className="external-document-preview invoice-review-external-document" aria-label="外部 Invoice 原始文件证据预览">
            <div className="external-document-title"><strong>INVOICE</strong><small>{currentFile.fileName}</small></div>
            {EXTERNAL_INVOICE_FIELD_ORDER.map((field) => (
              <div data-review-evidence={field} key={field}>
                <span>{EXTERNAL_INVOICE_FIELD_LABEL[field]}</span>
                <strong>{recognition.fields[field].evidence.sourceValue}</strong>
              </div>
            ))}
          </article>
        ) : (
          <div className="invoice-review-file-empty" role="status">
            <span><Upload size={26} /></span>
            <strong>尚未上传 Invoice 文件</strong>
            <p>{record.status === 'DRAFT' ? '发布采集任务后，由 C 端达人上传原始文件。' : '已等待 C 端达人上传 PDF、JPG 或 PNG。'}</p>
          </div>
        )}
        onDownload={downloadPrototypeSource}
        externalSummary={!hasUploadedEvidence}
        summaryFields={collectionSummaryFields}
        overviewFields={reviewFields}
        contractChecks={contractChecks}
        contractPending={!hasUploadedEvidence && selectedContracts.length > 0}
        noContract={selectedContracts.length === 0}
        accountRows={accountRows}
        accountDescription={!hasUploadedEvidence
          ? '任务创建时固定的默认已审核收款账户'
          : undefined}
        accountComparison={confirmation ? {
          invoiceValue: confirmation.values.PAYMENT_ACCOUNT,
          profileValue: profileAccountValue,
          matched: accountMatched,
          message: accountMatched
            ? 'Invoice 文件账户与达人档案中的已审核账户一致。'
            : '账户不一致，不能直接使用 Invoice 文件中的新账户付款。',
          evidenceTarget: 'PAYMENT_ACCOUNT',
        } : undefined}
        timeline={reviewTimeline}
        historySummary={externalHistorySummary}
        currentTask={externalCurrentTask}
        historyStatusText={`当前状态：${externalInvoiceListStatus(record.status)} · ${TECHNICAL_STATUS_LABEL[record.status]}`}
        completion={record.status === 'APPROVED'
          ? { completed: readiness.total, total: readiness.total }
          : { completed: readiness.completed, total: readiness.total }}
        footerStatus={pendingFooterStatus}
        blockingReasons={record.status === 'APPROVED' ? [] : workspaceBlockers}
        additionalFooterActions={canManage
          && record.status !== 'DRAFT'
          && record.status !== 'WAITING_MEDIA_REVIEW'
          && record.status !== 'APPROVED' ? (
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => setSimulatorOpen(true)}>模拟 C 端回传</Button>
          ) : undefined}
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

      {simulatorOpen ? (
        <Modal
          title="模拟 C 端回传"
          width="680px"
          className="external-simulator-modal"
          onClose={() => setSimulatorOpen(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setSimulatorOpen(false)}>关闭</Button>
              {confirmation ? <Button disabled={!canSubmit} icon={<Send size={16} />} onClick={() => { onSubmit(); setSimulatorOpen(false); }}>提交审核</Button> : null}
            </>
          )}
        >
          <div className="external-simulator-dialog">
            <NoticeBanner>仅用于当前管理端前端原型演示，不会触发真实文件上传或 OCR 服务。</NoticeBanner>
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
          </div>
        </Modal>
      ) : null}

    </div>
  );
}
