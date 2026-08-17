import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  Link2,
  Landmark,
  Pencil,
  ReceiptText,
  ShieldCheck,
  Unlink,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, PageHeading, SelectField } from '../components/Common';
import { ContractUploadWizard } from '../components/ContractUploadWizard';
import { ContractDocumentView } from '../components/ContractDocumentView';
import {
  canConfirmRecognitionFields,
  confirmRecognitionFields,
  editRecognitionField,
  reopenRecognitionFields,
} from '../contractRecognition';
import {
  CONTRACT_DOCUMENT_TYPE_LABELS,
  type ContractFieldCandidate,
  type ContractFieldKey,
  type ContractRecognitionField,
  type ContractSourceLocation,
} from '../contractRecognitionTypes';
import {
  CONTRACT_TYPE_LABELS,
  applyConfirmedRecognitionToContract,
  formatContractMoney,
  frameworkIoContracts,
  getContractType,
  getContractReadiness,
  isFrameworkContract,
  isIoContract,
  type ContractStatus,
  type ContractType,
  type ContractRecord,
  type ContractUploadInput,
} from '../contracts';
import type { ContractId } from '../businessWorkflow';
import { invoicePaymentForCreator } from '../payoutAccounts';
import type { CreatorProfile, DocumentPayoutSnapshot } from '../types';
import type { ProjectSummary } from './ProjectDetailPage';

type ContractDetailTab = 'summary' | 'payment' | 'checks';
type Notify = (title: string, message: string) => void;

type ContractDetailField = {
  key: ContractFieldKey | 'paymentInfo';
  label: string;
};

const SUMMARY_FIELDS_BY_TYPE: Record<ContractType, ContractDetailField[]> = {
  INDEPENDENT: [
    { key: 'advertiser', label: 'Advertiser' },
    { key: 'publisher', label: 'Publisher' },
    { key: 'contractNumber', label: '合同编号' },
    { key: 'projectBrand', label: 'Project Name' },
    { key: 'platformChannel', label: '平台 / 频道' },
    { key: 'effectiveDate', label: '生效日期' },
    { key: 'campaignPeriod', label: 'Campaign Period' },
  ],
  FRAMEWORK: [
    { key: 'advertiser', label: 'Advertiser' },
    { key: 'publisher', label: 'Publisher' },
    { key: 'contractNumber', label: '合同编号' },
    { key: 'effectiveDate', label: '生效日期' },
    { key: 'campaignPeriod', label: 'Campaign Period' },
  ],
  IO: [
    { key: 'advertiser', label: 'Advertiser' },
    { key: 'publisher', label: 'Publisher' },
    { key: 'contractNumber', label: '合同编号' },
    { key: 'projectBrand', label: 'Project Name' },
    { key: 'platformChannel', label: '平台 / 频道' },
    { key: 'effectiveDate', label: '生效日期' },
    { key: 'campaignPeriod', label: 'Campaign Period' },
  ],
};

const PAYMENT_FIELDS_BY_TYPE: Record<ContractType, ContractDetailField[]> = {
  INDEPENDENT: [
    { key: 'projectTotalFees', label: '付款金额' },
    { key: 'invoiceIssuePeriod', label: 'Invoice 开具期限' },
    { key: 'paymentTerm', label: '付款期限' },
    { key: 'paymentMethod', label: '付款方式' },
    { key: 'transferFee', label: '手续费费用承担方' },
    { key: 'paymentInfo', label: '付款信息' },
  ],
  FRAMEWORK: [
    { key: 'transferFee', label: '手续费费用承担方' },
    { key: 'paymentInfo', label: '付款信息' },
  ],
  IO: [
    { key: 'projectTotalFees', label: '付款金额' },
    { key: 'invoiceIssuePeriod', label: 'Invoice 开具期限' },
    { key: 'paymentTerm', label: '付款期限' },
    { key: 'paymentMethod', label: '付款方式' },
  ],
};

const DETAIL_FIELD_LABELS: Partial<Record<ContractFieldKey, string>> = Object.fromEntries(
  [...SUMMARY_FIELDS_BY_TYPE.INDEPENDENT, ...PAYMENT_FIELDS_BY_TYPE.INDEPENDENT]
    .filter((field): field is { key: ContractFieldKey; label: string } => field.key !== 'paymentInfo')
    .map((field) => [field.key, field.label]),
) as Partial<Record<ContractFieldKey, string>>;

const FEE_BEARER_LABELS = {
  ADVERTISER: 'Advertiser承担',
  PUBLISHER: 'Publisher承担',
  SHARED: '双方共同承担',
  '': '待选择',
} as const;

const PAYMENT_METHOD_LABELS = {
  BANK: '银行转账',
  PAYPAL: 'PayPal',
  AIRWALLEX: 'Airwallex',
  '': '待选择',
} as const;

const createDemoAirwallexSnapshot = (contract: ContractRecord): DocumentPayoutSnapshot => {
  const accountName = contract.accountName || contract.publisher || 'Demo Creator';
  const accountTail = contract.id.replace(/\D/g, '').slice(-4).padStart(4, '0');
  return {
    creatorId: contract.creatorId,
    payoutAccountId: `demo-awx-${accountTail}`,
    payoutAccountVersion: 'v1',
    payoutProvider: 'Airwallex',
    providerAccountScope: 'mock:default',
    externalBeneficiaryId: `mock_beneficiary_${accountTail}`,
    accountFingerprint: contract.accountFingerprint || `fp_demo_awx_${accountTail}`,
    schemaKey: 'BANK_ACCOUNT:US',
    validationStatus: 'VERIFIED',
    bankCountry: 'United States',
    accountName,
    accountType: 'Checking',
    swiftCode: 'CHASUS33',
    accountNumber: `5000${accountTail}`,
    iban: '',
    beneficiaryType: 'PERSONAL',
    bankName: 'JPMorgan Chase Bank',
    bankStreetAddress: '270 Park Avenue',
    bankCity: 'New York',
    bankState: 'NY',
    bankPostalCode: '10017',
    intermediaryBankCountry: '',
    intermediaryBankCode: '',
    transferRemarks: `COMETS ${contract.id} payout`,
    paypalUsername: '',
    paypalEmail: '',
    transferMethod: 'LOCAL',
    localClearingSystem: 'ACH',
    accountCurrency: contract.currency || 'USD',
    validatedAt: '2026-08-12T10:30:00.000Z',
    verifiedAt: '2026-08-12T10:35:00.000Z',
    schemaValues: {},
    schemaFields: [],
  };
};

const FIELD_STATUS_LABELS = {
  detected: '待确认',
  missing: '待补充',
  conflict: '需核对',
  confirmed: '已确认',
} as const;

const CONTRACT_STATUS_NOTES: Record<ContractStatus, string> = {
  参考模板: '仅作为合同模板资源，不能直接进入付款流程。',
  待解析: '合同文件尚未完成解析，暂不能进行付款校验。',
  待补字段: '补齐必填字段并解决阻断项后，才能进入付款流程。',
  待回传: '合同草稿等待线下签署文件回传。',
  已生效: '合同已生效；仍需满足付款就绪规则。',
  履约中: '合同正在履约；满足付款规则后可进入付款流程。',
  待签署: '等待合同完成签署并通过人工确认。',
  已归档: '合同已归档；如需付款仍需确认付款条件有效。',
};

const sourceLabel = (source: ContractSourceLocation | null) => {
  if (!source) return '未找到可靠来源';
  const documentLabel = source.documentId === 'system-contract'
    ? '系统字段'
    : CONTRACT_DOCUMENT_TYPE_LABELS[source.documentType];
  return source.pageNumber
    ? `${documentLabel} · 第 ${source.pageNumber} 页`
    : `${documentLabel} · ${source.section}`;
};

function ContractDefinitionList({
  contract,
  fields,
  projectName,
  formalFieldsHidden = false,
}: {
  contract: ContractRecord;
  fields: ContractDetailField[];
  projectName: string;
  formalFieldsHidden?: boolean;
}) {
  const joinedValue = (...values: string[]) => values.filter(Boolean).join(' · ') || '待补充';
  const valueFor = (key: ContractFieldKey) => {
    if (formalFieldsHidden && key !== 'contractNumber') return '待补充';
    switch (key) {
      case 'advertiser': return contract.advertiser || '待识别';
      case 'publisher': return contract.publisher || '待补充';
      case 'contractNumber': return contract.id;
      case 'projectBrand': return projectName || '待补充';
      case 'platformChannel': return joinedValue(contract.platform, contract.channelName);
      case 'effectiveDate': return contract.effectiveDate || '待补充';
      case 'campaignPeriod': return contract.campaignStart && contract.campaignEnd
        ? `${contract.campaignStart} 至 ${contract.campaignEnd}`
        : '待补充';
      default: return '待补充';
    }
  };
  return (
    <dl className="contract-definition-list">
      {fields.map((field) => (
        <div key={field.key}>
          <dt>{field.label}</dt>
          <dd>
            {valueFor(field.key as ContractFieldKey)}
            <small>{field.key === 'contractNumber' ? '系统字段' : '合同识别 / 人工确认'}</small>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ContractPaymentList({
  contract,
  fields,
  paymentSnapshot,
  projectName,
  formalFieldsHidden = false,
}: {
  contract: ContractRecord;
  fields: ContractDetailField[];
  paymentSnapshot: ReturnType<typeof invoicePaymentForCreator> | null;
  projectName: string;
  formalFieldsHidden?: boolean;
}) {
  const accountName = paymentSnapshot?.accountName || contract.accountName;
  const accountFingerprint = paymentSnapshot?.accountFingerprint || contract.accountFingerprint;
  const provider = paymentSnapshot?.payoutProvider || contract.payoutProvider;
  const accountVersion = paymentSnapshot?.payoutAccountVersion || contract.payoutAccountVersion;
  const paymentInfo = [
    accountName,
    provider,
    accountVersion,
    accountFingerprint || (paymentSnapshot?.accountNumber
      ? `•••• ${paymentSnapshot.accountNumber.replace(/\s/g, '').slice(-4)}`
      : ''),
  ].filter(Boolean).join(' · ') || '待补充';
  const snapshotValue = (value?: string | null) => value?.trim() || '待补充';
  const maskSensitive = (value?: string | null) => {
    const normalized = value?.trim() ?? '';
    if (!normalized) return '待补充';
    if (normalized.includes('••••')) return normalized;
    const compact = normalized.replace(/\s/g, '');
    return compact.length > 4 ? `•••• ${compact.slice(-4)}` : '••••';
  };
  const transferMethodLabel = (value?: string) => {
    if (value === 'LOCAL') return '本地转账 · LOCAL';
    if (value === 'SWIFT') return '国际电汇 · SWIFT';
    if (value === 'PAYPAL') return 'PayPal';
    return '待补充';
  };
  const statusLabel = (value?: string) => {
    if (value === 'VERIFIED') return '已验证';
    if (value === 'VALIDATED') return '已校验';
    if (value === 'ACTIVE') return '已启用';
    if (value === 'DRAFT') return '草稿';
    if (value === 'DISABLED') return '已停用';
    return snapshotValue(value);
  };
  const profileRows = (snapshot: DocumentPayoutSnapshot | null) => {
    if (!snapshot) return [];
    const standardPaths = new Set([
      'beneficiary.bank_details.account_name',
      'beneficiary.bank_details.account_number',
      'beneficiary.bank_details.bank_account_category',
      'beneficiary.bank_details.bank_name',
      'beneficiary.bank_details.bank_street_address',
      'beneficiary.bank_details.swift_code',
      'beneficiary.bank_details.iban',
      'beneficiary.bank_details.bank_country_code',
      'beneficiary.bank_details.bank_state',
      'beneficiary.bank_details.bank_city',
      'beneficiary.bank_details.bank_postcode',
      'beneficiary.bank_details.intermediary_bank_country_code',
    ]);
    return (snapshot.schemaFields ?? [])
      .map((field) => ({
        label: field.label,
        value: snapshot.schemaValues?.[field.path] ?? '',
        path: field.path,
      }))
      .filter((field) => field.value.trim() && !standardPaths.has(field.path));
  };
  const dynamicProfileRows = profileRows(paymentSnapshot);
  const accountSections = paymentSnapshot ? [
    {
      title: '账户身份与校验',
      items: [
        ['付款渠道', snapshotValue(paymentSnapshot.payoutProvider)],
        ['Beneficiary ID', snapshotValue(paymentSnapshot.externalBeneficiaryId)],
        ['账户版本', snapshotValue(paymentSnapshot.payoutAccountVersion)],
        ['账户状态', statusLabel(paymentSnapshot.validationStatus)],
        ['最近校验', snapshotValue(paymentSnapshot.validatedAt)],
        ['最近验证', snapshotValue(paymentSnapshot.verifiedAt)],
      ],
    },
    {
      title: '付款场景',
      items: [
        ['收款人类型', snapshotValue(paymentSnapshot.beneficiaryType)],
        ['银行国家 / 地区', snapshotValue(paymentSnapshot.bankCountry)],
        ['账户币种', snapshotValue(paymentSnapshot.accountCurrency)],
        ['转账方式', transferMethodLabel(paymentSnapshot.transferMethod)],
        ['本地清算系统', snapshotValue(paymentSnapshot.localClearingSystem)],
      ],
    },
    {
      title: '银行账户',
      items: [
        ['Account Name', snapshotValue(paymentSnapshot.accountName)],
        ['账户类型', snapshotValue(paymentSnapshot.accountType)],
        ['Account Number', maskSensitive(paymentSnapshot.accountNumber)],
        ['IBAN', maskSensitive(paymentSnapshot.iban)],
        ['收款银行名称', snapshotValue(paymentSnapshot.bankName)],
        ['SWIFT / BIC', snapshotValue(paymentSnapshot.swiftCode)],
        ['收款银行地址', snapshotValue(paymentSnapshot.bankStreetAddress), true],
        ['收款银行城市', snapshotValue(paymentSnapshot.bankCity)],
        ['收款银行州 / 省', snapshotValue(paymentSnapshot.bankState)],
        ['收款银行邮编', snapshotValue(paymentSnapshot.bankPostalCode)],
      ],
    },
    {
      title: '中间行与附加信息',
      items: [
        ['中间行国家 / 地区', snapshotValue(paymentSnapshot.intermediaryBankCountry)],
        ['中间行 SWIFT / BIC', snapshotValue(paymentSnapshot.intermediaryBankCode)],
        ['Transfer Note', snapshotValue(paymentSnapshot.transferRemarks), true],
        ...dynamicProfileRows.map((row) => [row.label, row.value, false] as [string, string, boolean]),
      ],
    },
  ] : [];
  const executionRows: Array<[string, string, boolean?]> = [
    ['付款金额', formatContractMoney(contract)],
    ['支付币种', snapshotValue(contract.currency)],
    ['收款币种', snapshotValue(paymentSnapshot?.accountCurrency || contract.currency)],
    ['付款渠道 / 方式', `${snapshotValue(provider)} · ${transferMethodLabel(paymentSnapshot?.transferMethod)}`],
    ['费用承担', FEE_BEARER_LABELS[contract.feeBearer]],
    ['付款原因', `${projectName || contract.project || '达人内容合作'} 内容合作费用`],
    ['交易附言', `COMETS-${contract.id}-PAYOUT`],
    ['描述', snapshotValue(contract.name)],
    ['渠道结果', '待提交 Airwallex'],
    ['付款时间', '待创建付款批次'],
  ];
  const valueFor = (key: ContractFieldKey | 'paymentInfo') => {
    if (formalFieldsHidden && key !== 'paymentInfo') return '待补充';
    switch (key) {
      case 'projectTotalFees': return formatContractMoney(contract);
      case 'invoiceIssuePeriod': return contract.invoiceWithinWorkingDays
        ? `最终验收后${contract.invoiceWithinWorkingDays}个工作日内`
        : '待补充';
      case 'paymentTerm': return contract.paymentWithinWorkingDays
        ? `发布、验收且收到Invoice后${contract.paymentWithinWorkingDays}个工作日`
        : '待补充';
      case 'paymentMethod': return PAYMENT_METHOD_LABELS[contract.paymentMethod];
      case 'transferFee': return FEE_BEARER_LABELS[contract.feeBearer];
      case 'paymentInfo': return paymentInfo;
      default: return '待补充';
    }
  };
  return (
    <div className="contract-payment-content">
      <dl className="contract-payment-list contract-payment-rules-list">
        {fields.map((field) => (
          <div key={field.key}>
            <dt>{field.label}</dt>
            <dd>{valueFor(field.key)}</dd>
          </div>
        ))}
      </dl>

      <section className="contract-payment-account-card" aria-label="达人档案付款账户快照">
        <header>
          <span className="contract-payment-card-icon" aria-hidden="true"><Landmark size={16} /></span>
          <span><strong>达人档案付款账户</strong><small>已选账户的不可变快照，字段可直接映射 Airwallex Beneficiary</small></span>
          <em>{snapshotValue(provider)}</em>
        </header>
        {accountSections.map((section) => (
          <div className="contract-payment-account-section" key={section.title}>
            <h4>{section.title}</h4>
            <dl className="contract-payment-data-grid">
              {section.items.map(([label, value, wide]) => (
                <div className={wide ? 'is-wide' : ''} key={`${section.title}-${label}`}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        {!paymentSnapshot ? <p className="contract-payment-empty">未找到达人档案付款账户，补充并验证 Airwallex 账户后才能发起付款。</p> : null}
      </section>

      <section className="contract-payment-execution-card" aria-label="Airwallex 付款准备信息">
        <header>
          <span className="contract-payment-card-icon" aria-hidden="true"><ShieldCheck size={16} /></span>
          <span><strong>Airwallex 付款准备</strong><small>补齐交易信息后，可创建一笔付款请求</small></span>
          <em>演示数据</em>
        </header>
        <dl className="contract-payment-data-grid">
          {executionRows.map(([label, value, wide]) => (
            <div className={wide ? 'is-wide' : ''} key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function RecognitionFieldList({
  fields,
  fieldKeys,
  onChange,
  onSelectCandidate,
  onOpenSource,
  fieldLabels = {},
  recognitionLocked = false,
}: {
  fields: ContractRecognitionField[];
  fieldKeys: ContractFieldKey[];
  onChange: (fieldKey: ContractFieldKey, value: string) => void;
  onSelectCandidate: (fieldKey: ContractFieldKey, candidate: ContractFieldCandidate) => void;
  onOpenSource: (source: ContractSourceLocation) => void;
  fieldLabels?: Partial<Record<ContractFieldKey, string>>;
  recognitionLocked?: boolean;
}) {
  return (
    <div className="contract-recognition-detail-list">
      {fieldKeys.map((fieldKey) => {
        const field = fields.find((item) => item.fieldKey === fieldKey);
        if (!field) return null;
        const fieldLocked = recognitionLocked || field.status === 'confirmed';
        return (
          <article
            className={`contract-recognition-detail contract-recognition-field-${field.status}${fieldLocked ? ' contract-recognition-detail-readonly' : ''}`}
            key={field.fieldKey}
          >
            <div className="contract-recognition-label">{fieldLabels[field.fieldKey] ?? field.label}</div>
            <div className="contract-recognition-value">
              <input
                aria-label={fieldLabels[field.fieldKey] ?? field.label}
                value={field.rawValue}
                placeholder="待补充"
                readOnly={fieldLocked}
                onChange={(event) => onChange(field.fieldKey, event.target.value)}
              />
              {field.source ? (
                <button className="contract-recognition-source" type="button" onClick={() => onOpenSource(field.source!)}>
                  <FileSearch size={12} />
                  {sourceLabel(field.source)}
                </button>
              ) : <small className="contract-recognition-missing-source">未识别，需人工补充</small>}
              {field.status === 'conflict' && field.candidates.length > 1 ? (
                <div className="contract-recognition-candidates">
                  <strong><AlertTriangle size={13} />发现多个候选，请选择后确认</strong>
                  {field.candidates.map((candidate, index) => (
                    <button type="button" key={`${candidate.source.blockId}-${index}`} onClick={() => onSelectCandidate(field.fieldKey, candidate)}>
                      <span>{candidate.rawValue}</span>
                      <small>{sourceLabel(candidate.source)}</small>
                    </button>
                  ))}
                </div>
              ) : null}
              {field.profileComparison?.status === 'conflict' ? (
                <div className="contract-recognition-profile-conflict">
                  <AlertTriangle size={13} />
                  <span>与达人档案账户不一致：{field.profileComparison.referenceLabels.join('、')}。合同值仅用于比对，不会覆盖达人档案。</span>
                </div>
              ) : null}
            </div>
            <div className="contract-recognition-actions">
              <span className="contract-recognition-status">{FIELD_STATUS_LABELS[field.status]}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ContractDetailPage({
  contract,
  contracts = [],
  projects = [],
  projectDirectory = projects,
  creators = [],
  onBack,
  backLabel = '返回合同列表',
  notify,
  onUpdateContract,
  canEditTemplate = false,
  onBindFrameworkContract,
  onUploadContracts,
}: {
  contract: ContractRecord;
  contracts?: ContractRecord[];
  projects?: ProjectSummary[];
  projectDirectory?: ProjectSummary[];
  creators?: CreatorProfile[];
  onBack: () => void;
  backLabel?: string;
  notify: Notify;
  onUpdateContract?: (contract: ContractRecord) => void;
  canEditTemplate?: boolean;
  onBindFrameworkContract?: (ioContractId: ContractId, frameworkContractId?: ContractId) => boolean;
  onUploadContracts?: (inputs: ContractUploadInput[]) => ContractRecord[];
}) {
  const [activeTab, setActiveTab] = useState<ContractDetailTab>('summary');
  const [dismissedDocumentNoteId, setDismissedDocumentNoteId] = useState<string | null>(null);
  const [draftFields, setDraftFields] = useState(contract.recognitionResults ?? []);
  const [activeDocumentId, setActiveDocumentId] = useState(contract.sourceDocuments?.[0]?.id ?? '');
  const [focusedSource, setFocusedSource] = useState<ContractSourceLocation | null>(null);
  const [frameworkUploadOpen, setFrameworkUploadOpen] = useState(false);
  useEffect(() => {
    setDraftFields(contract.recognitionResults ?? []);
    setActiveDocumentId(contract.sourceDocuments?.[0]?.id ?? '');
    setFocusedSource(null);
  }, [contract.id]);
  const selectedDocument = useMemo(() => (
    contract.sourceDocuments?.find((document) => document.id === activeDocumentId)
    ?? contract.sourceDocuments?.[0]
  ), [activeDocumentId, contract.sourceDocuments]);
  const sourceName = selectedDocument?.fileName ?? contract.sourceName;
  const documentUrl = selectedDocument?.documentUrl ?? contract.documentUrl;
  const pageCount = selectedDocument?.pageCount ?? contract.pageCount;
  const isPdf = /\.pdf$/i.test(sourceName);
  const previewPage = focusedSource && focusedSource.documentId === selectedDocument?.id
    ? focusedSource.pageNumber
    : null;
  const previewUrl = `${documentUrl}#page=${previewPage ?? 1}&toolbar=1&navpanes=0&view=FitH`;
  const contractType = getContractType(contract);
  const summaryFields = SUMMARY_FIELDS_BY_TYPE[contractType];
  const paymentFields = PAYMENT_FIELDS_BY_TYPE[contractType];
  const summaryFieldKeys = summaryFields
    .map((field) => field.key)
    .filter((key): key is ContractFieldKey => key !== 'paymentInfo');
  const paymentFieldKeys = paymentFields
    .map((field) => field.key)
    .filter((key): key is ContractFieldKey => key !== 'paymentInfo');
  const recognitionFieldKeys = Array.from(new Set([...summaryFieldKeys, ...paymentFieldKeys]));
  const projectName = useMemo(() => {
    const projectId = contract.cooperationProjectId ?? contract.projectId;
    const mapped = projectId
      ? projectDirectory.find((project) => (
        String(project.cooperationProjectId ?? project.projectId ?? project.id) === String(projectId)
        || String(project.id) === String(projectId)
      ))
      : undefined;
    return mapped?.name || contract.project || '待关联项目';
  }, [contract.cooperationProjectId, contract.project, contract.projectId, projectDirectory]);
  const creator = creators.find((candidate) => candidate.id === contract.creatorId)
    ?? creators.find((candidate) => candidate.name === contract.publisher);
  const fallbackPaymentSnapshot = creator
    ? invoicePaymentForCreator(creator, contract.payoutProvider ?? 'Airwallex')
    : createDemoAirwallexSnapshot(contract);
  const paymentSnapshot = contract.paymentSnapshot
    ?? contract.generationSnapshot?.paymentSnapshot
    ?? fallbackPaymentSnapshot;
  const hasRecognition = draftFields.length > 0;
  const applicableRecognitionFields = recognitionFieldKeys
    .map((fieldKey) => draftFields.find((field) => field.fieldKey === fieldKey))
    .filter((field): field is ContractRecognitionField => Boolean(field));
  const confirmedCount = applicableRecognitionFields.filter((field) => field.status === 'confirmed').length;
  const allConfirmed = hasRecognition
    && applicableRecognitionFields.length > 0
    && confirmedCount === applicableRecognitionFields.length;
  const recognitionApplied = contract.extractionStage === 'applied';
  const visibleIssues = allConfirmed
    ? contract.issues.filter((issue) => issue.id !== 'recognition-review')
    : contract.issues;
  const readiness = getContractReadiness({ ...contract, issues: visibleIssues });
  const recognitionPageState = (fieldKeys: readonly ContractFieldKey[]) => {
    const pageFields = fieldKeys
      .map((fieldKey) => draftFields.find((field) => field.fieldKey === fieldKey))
      .filter((field): field is ContractRecognitionField => Boolean(field));
    return {
      confirmedCount: pageFields.filter((field) => field.status === 'confirmed').length,
      fieldCount: pageFields.length,
      allConfirmed: pageFields.length > 0 && pageFields.every((field) => field.status === 'confirmed'),
      canConfirm: canConfirmRecognitionFields(draftFields, fieldKeys),
    };
  };
  const summaryPageState = recognitionPageState(summaryFieldKeys);
  const paymentPageState = recognitionPageState(paymentFieldKeys);
  const tabs: Array<{ id: ContractDetailTab; label: string }> = [
    { id: 'summary', label: '合同摘要' },
    { id: 'payment', label: '付款与Invoice' },
    { id: 'checks', label: `校验记录${visibleIssues.length ? ` ${visibleIssues.length}` : ''}` },
  ];
  const canEditCurrentContract = !contract.isTemplate || canEditTemplate;
  const pendingGeneratedUpload = Boolean(
    contract.uploadedFromDraftId
    && contract.lifecycle === 'UPLOADED_PENDING_CONFIRMATION',
  );
  const frameworkContracts = contracts.filter((candidate) => (
    isFrameworkContract(candidate)
    && candidate.contractId
    && candidate.creatorId === contract.creatorId
    && candidate.contractId !== contract.contractId
  ));
  const linkedIoContracts = isFrameworkContract(contract)
    ? frameworkIoContracts(contract, contracts)
    : [];
  const frameworkRelationOptions = [
    { value: '', label: '不绑定框架合同', description: 'IO 单保存后仍可用于 Invoice 与付款流程' },
    ...frameworkContracts.map((candidate) => ({
      value: candidate.contractId!,
      label: `${candidate.id} · ${candidate.name}`,
      description: `${candidate.project} · ${CONTRACT_TYPE_LABELS.FRAMEWORK}`,
    })),
  ];

  const copyContractId = async () => {
    await navigator.clipboard.writeText(contract.id);
    notify('合同编号已复制', contract.id);
  };

  const updateField = (fieldKey: ContractFieldKey, value: string) => {
    if (!canEditCurrentContract) return;
    setDraftFields((current) => current.map((field) => (
      field.fieldKey === fieldKey ? editRecognitionField(field, value) : field
    )));
  };

  const confirmPage = (fieldKeys: readonly ContractFieldKey[], pageLabel: string) => {
    if (!canEditCurrentContract) return;
    if (recognitionApplied) return;
    if (!canConfirmRecognitionFields(draftFields, fieldKeys)) {
      notify('本页仍有待处理字段', `${pageLabel}存在待补充或需核对字段，请处理后再确认。`);
      return;
    }
    const next = confirmRecognitionFields(draftFields, fieldKeys);
    setDraftFields(next);
    onUpdateContract?.({
      ...contract,
      recognitionResults: next,
      extractionStage: recognitionFieldKeys.every((fieldKey) => (
        next.some((field) => field.fieldKey === fieldKey && field.status === 'confirmed')
      )) ? 'confirmed' : 'review',
    });
    notify('本页字段已确认', `${pageLabel}的字段信息已统一确认。`);
  };

  const editPage = (fieldKeys: readonly ContractFieldKey[], pageLabel: string) => {
    if (!canEditCurrentContract) return;
    if (recognitionApplied) return;
    const next = reopenRecognitionFields(draftFields, fieldKeys);
    setDraftFields(next);
    onUpdateContract?.({
      ...contract,
      recognitionResults: next,
      extractionStage: 'review',
    });
    notify('本页已进入编辑状态', `${pageLabel}字段修改后需要重新确认。`);
  };

  const renderPageAction = (
    fieldKeys: readonly ContractFieldKey[],
    pageLabel: string,
    pageState: { allConfirmed: boolean; canConfirm: boolean },
  ) => {
    if (!hasRecognition || !onUpdateContract) return null;
    if (!canEditCurrentContract) {
      return <span className="contract-page-readonly">仅允许项目负责人、老板或管理员编辑</span>;
    }
    if (pageState.allConfirmed) {
      return recognitionApplied ? (
        <span className="contract-page-applied">
          <CheckCircle2 size={14} />
          已应用
        </span>
      ) : (
        <button
          className="contract-page-confirm contract-page-edit"
          type="button"
          onClick={() => editPage(fieldKeys, pageLabel)}
        >
          <Pencil size={14} />
          编辑
        </button>
      );
    }
    return (
      <button
        className="contract-page-confirm"
        type="button"
        disabled={!pageState.canConfirm}
        onClick={() => confirmPage(fieldKeys, pageLabel)}
      >
        <CheckCircle2 size={14} />
        确认本页
      </button>
    );
  };

  const selectCandidate = (fieldKey: ContractFieldKey, candidate: ContractFieldCandidate) => {
    setDraftFields((current) => current.map((field) => field.fieldKey === fieldKey
      ? {
          ...field,
          rawValue: candidate.rawValue,
          normalizedValue: candidate.normalizedValue,
          source: candidate.source,
          confidence: candidate.confidence,
          status: 'detected',
        }
      : field));
    setActiveDocumentId(candidate.source.documentId);
    setFocusedSource(candidate.source);
  };

  const openSource = (source: ContractSourceLocation) => {
    if (source.documentId !== 'system-contract') setActiveDocumentId(source.documentId);
    setFocusedSource(source);
  };

  const applyRecognition = () => {
    if (!canEditCurrentContract) {
      notify('暂无模板编辑权限', '仅项目负责人、老板或管理员可以修改合同模板。');
      return;
    }
    const candidate = { ...contract, recognitionResults: draftFields };
    const applied = applyConfirmedRecognitionToContract(candidate, recognitionFieldKeys);
    if (!applied) {
      notify('仍有字段未确认', `已确认 ${confirmedCount}/${applicableRecognitionFields.length} 项，请完成适用字段确认。`);
      return;
    }
    onUpdateContract?.(applied);
    notify('合同资料已确认', '上传文件和结构化字段已确认为最终合同版本，现在可以参与 Invoice 校验。');
  };

  const updateFrameworkRelation = (value: string) => {
    if (!onBindFrameworkContract || !contract.contractId) return;
    const nextId = value ? value as ContractId : undefined;
    if (onBindFrameworkContract(contract.contractId, nextId)) {
      notify(
        nextId ? '框架合同已绑定' : '框架合同关系已解除',
        nextId ? 'IO 单已关联所选框架合同，可在框架合同详情查看子单。' : 'IO 单仍可独立参与 Invoice 与付款流程。',
      );
    }
  };

  const saveFrameworkUpload = (inputs: ContractUploadInput[]) => {
    if (!onUploadContracts || !contract.contractId) return;
    const records = onUploadContracts(inputs);
    const framework = records.find((record) => isFrameworkContract(record));
    if (!framework?.contractId || !onBindFrameworkContract) {
      setFrameworkUploadOpen(false);
      notify('框架合同已保存', '框架合同已保存，稍后可从 IO 单详情中选择绑定。');
      return;
    }
    onBindFrameworkContract(contract.contractId, framework.contractId);
    setFrameworkUploadOpen(false);
    notify('框架合同已上传并绑定', `${framework.id} 已成为当前 IO 单的框架合同。`);
  };

  const contractStatusNote = CONTRACT_STATUS_NOTES[contract.status];

  return (
    <div className="page-stack contract-detail-page">
      <button className="project-back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        {backLabel}
      </button>

      <PageHeading
        title={contract.name}
        subtitle={`${contract.id} · ${projectName}`}
        actions={(
          <>
            <Button variant="secondary" icon={<Clipboard size={16} />} onClick={copyContractId}>复制编号</Button>
            {documentUrl ? (
              <a className="button button-primary contract-file-action" href={documentUrl} download={sourceName}>
                <Download size={16} />
                <span>下载当前文件</span>
              </a>
            ) : null}
          </>
        )}
      />

      <div className="contract-metric-grid">
        <article>
          <span>付款就绪度</span>
          <strong className={readiness.ready ? 'contract-ready-text' : 'contract-attention-text'}>{readiness.label}</strong>
          <small>{isFrameworkContract(contract)
            ? readiness.ready ? '可供同一达人 IO 单选择绑定' : '确认主体和签署状态后可用于绑定'
            : readiness.ready ? '可加入新建付款项目' : '完成阻断项后才能进入付款流程'}</small>
        </article>
        <article>
          <span>合同金额</span>
          <strong>{isFrameworkContract(contract) ? '——' : formatContractMoney(contract)}</strong>
          <small>{hasRecognition && contract.extractionStage !== 'applied' ? '识别结果尚未应用到正式字段' : '以人工确认后的正式字段为准'}</small>
        </article>
        <article>
          <span>合同状态</span>
          <strong className={readiness.ready ? 'contract-ready-text' : 'contract-attention-text'}>{contract.status}</strong>
          <small>{contractStatusNote}</small>
        </article>
      </div>

      <section className={`contract-relationship-panel contract-relationship-${contractType.toLowerCase()}`}>
        <header>
          <span className="contract-relationship-icon"><Link2 size={17} /></span>
          <div>
            <strong>合同关系</strong>
            <small>{CONTRACT_TYPE_LABELS[contractType]} · {isFrameworkContract(contract) ? '一个框架合同可关联多个 IO 单' : '关系调整会记录到项目工作流'}</small>
          </div>
          <span className={`contract-type-badge contract-type-${contractType.toLowerCase()}`}>{CONTRACT_TYPE_LABELS[contractType]}</span>
        </header>
        {isFrameworkContract(contract) ? (
          <div className="contract-relationship-content">
            <div className="contract-relationship-summary"><strong>{linkedIoContracts.length}</strong><span>个已绑定 IO 单</span></div>
            {linkedIoContracts.length ? (
              <div className="contract-child-list">
                {linkedIoContracts.map((child) => (
                  <div key={child.contractId ?? child.id} className="contract-child-item">
                    <span><strong>{child.id}</strong><small>{child.name}</small></span>
                    <span className="contract-type-badge contract-type-io">IO 单</span>
                  </div>
                ))}
              </div>
            ) : <div className="contract-inline-empty">当前框架合同尚未绑定 IO 单。</div>}
          </div>
        ) : isIoContract(contract) ? (
          <div className="contract-relationship-content contract-io-relation-content">
            <div className="contract-relationship-field">
              <span>框架合同</span>
              {onBindFrameworkContract && contract.contractId ? (
                <SelectField
                  ariaLabel="框架合同"
                  variant="form"
                  value={contract.frameworkContractId ?? ''}
                  options={frameworkRelationOptions}
                  onChange={updateFrameworkRelation}
                />
              ) : <strong>{contract.frameworkContractId ?? '待绑定框架合同'}</strong>}
              <small>{contract.frameworkContractId ? '已绑定，可随时更换或解除' : '未绑定不影响保存、确认、Invoice 和付款流程'}</small>
            </div>
            {onUploadContracts && onBindFrameworkContract ? (
              <Button variant="secondary" icon={<Upload size={15} />} onClick={() => setFrameworkUploadOpen(true)}>上传并绑定框架合同</Button>
            ) : null}
            {contract.frameworkContractId ? (
              <button className="contract-unlink-action" type="button" onClick={() => updateFrameworkRelation('')}>
                <Unlink size={14} />解除绑定
              </button>
            ) : null}
          </div>
        ) : (
          <div className="contract-relationship-content"><span className="contract-relationship-independent"><ShieldCheck size={16} />独立合同不需要框架合同关系。</span></div>
        )}
      </section>

      {contract.documentNote && dismissedDocumentNoteId !== contract.id ? (
        <div className="contract-document-note" role="note">
          <FileSearch size={17} />
          <span>{contract.documentNote}</span>
          <button className="icon-button contract-document-note-close" type="button" aria-label="关闭合同预览提示" onClick={() => setDismissedDocumentNoteId(contract.id)}>
            <X size={17} />
          </button>
        </div>
      ) : null}

      <div className="contract-reader-layout">
        <section className="contract-document-panel">
          <header>
            <div>
              <FileText size={19} />
              <span><strong>合同全文</strong><small>{sourceName}{pageCount ? ` · ${pageCount}页` : ''}</small></span>
            </div>
            {documentUrl ? <a href={documentUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />新窗口打开</a> : null}
          </header>
          {contract.sourceDocuments && contract.sourceDocuments.length > 1 ? (
            <div className="contract-document-switcher" role="tablist" aria-label="合同文件">
              {contract.sourceDocuments.map((document) => (
                <button
                  className={selectedDocument?.id === document.id ? 'active' : ''}
                  type="button"
                  role="tab"
                  aria-selected={selectedDocument?.id === document.id}
                  key={document.id}
                  onClick={() => { setActiveDocumentId(document.id); setFocusedSource(null); }}
                >
                  {document.fileName}
                </button>
              ))}
            </div>
          ) : null}
          {documentUrl && isPdf ? (
            <iframe className="contract-pdf-frame" src={previewUrl} title={`${contract.name} PDF原文`} />
          ) : documentUrl && selectedDocument ? (
            <div className="contract-document-canvas contract-document-download-only">
              <FileText size={32} />
              {focusedSource?.documentId === selectedDocument.id ? (
                <>
                  <strong>{focusedSource.section || 'DOCX 原文位置'}</strong>
                  <p className="contract-docx-source-text">{focusedSource.sourceText}</p>
                </>
              ) : (
                <>
                  <strong>DOCX 已在浏览器本地解析</strong>
                  <p>点击右侧字段来源可查看对应章节和原文；完整排版请下载原文件查看。</p>
                </>
              )}
            </div>
          ) : (
            <div className="contract-document-canvas">
              <ContractDocumentView contract={contract} ariaLabel={`${contract.id} 合同全文`} />
            </div>
          )}
        </section>

        <section className="contract-inspector">
          <div className="contract-tabs" role="tablist" aria-label="合同详情分类">
            {tabs.map((tab) => (
              <button className={activeTab === tab.id ? 'contract-tab-active' : ''} type="button" role="tab" aria-selected={activeTab === tab.id} key={tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="contract-inspector-content">
            {activeTab === 'summary' ? (
              <>
                <div className="contract-section-heading">
                  <FileSearch size={18} />
                  <span>
                    <strong>结构化合同信息</strong>
                    <small>{hasRecognition ? `本页已确认 ${summaryPageState.confirmedCount}/${summaryPageState.fieldCount} 项` : '每个字段保留合同来源位置'}</small>
                  </span>
                  {renderPageAction(summaryFieldKeys, '合同摘要', summaryPageState)}
                </div>
                {hasRecognition ? (
                  <RecognitionFieldList
                    fields={draftFields}
                    fieldKeys={summaryFieldKeys}
                    onChange={updateField}
                    onSelectCandidate={selectCandidate}
                    onOpenSource={openSource}
                    fieldLabels={DETAIL_FIELD_LABELS}
                    recognitionLocked={recognitionApplied || !canEditCurrentContract}
                  />
                ) : (
                  <ContractDefinitionList
                    contract={contract}
                    fields={summaryFields}
                    projectName={projectName}
                    formalFieldsHidden={contract.lifecycle === 'GENERATED_DRAFT'}
                  />
                )}
                {contract.channelLink && contract.lifecycle !== 'GENERATED_DRAFT' ? <a className="contract-channel-link" href={contract.channelLink} target="_blank" rel="noreferrer"><ExternalLink size={15} />查看达人社媒账号主页</a> : null}
              </>
            ) : null}

            {activeTab === 'payment' ? (
              <>
                <div className="contract-section-heading">
                  <ReceiptText size={18} />
                  <span>
                    <strong>付款与Invoice规则</strong>
                    <small>{hasRecognition ? `本页已确认 ${paymentPageState.confirmedCount}/${paymentPageState.fieldCount} 项` : '账户识别值仅用于与达人档案人工比对'}</small>
                  </span>
                  {renderPageAction(paymentFieldKeys, '付款与Invoice', paymentPageState)}
                </div>
                {pendingGeneratedUpload ? (
                  <div className="contract-generated-payment-snapshot">
                    <div className="contract-generated-payment-snapshot-head">
                      <strong>生成合同付款快照</strong>
                      <small>回传文件人工确认前，以生成合同中的付款与 Invoice 信息为准</small>
                    </div>
                    <ContractPaymentList contract={contract} fields={paymentFields} paymentSnapshot={paymentSnapshot} projectName={projectName} />
                  </div>
                ) : null}
                {hasRecognition ? (
                  <>
                    {pendingGeneratedUpload ? <div className="contract-recognition-pending-note">以下为上传签署文件的识别结果，完成逐项确认并应用后才会更新正式合同字段。</div> : null}
                    <RecognitionFieldList
                      fields={draftFields}
                      fieldKeys={paymentFieldKeys}
                      onChange={updateField}
                      onSelectCandidate={selectCandidate}
                      onOpenSource={openSource}
                      fieldLabels={DETAIL_FIELD_LABELS}
                      recognitionLocked={recognitionApplied || !canEditCurrentContract}
                    />
                  </>
                ) : (
                  <ContractPaymentList contract={contract} fields={paymentFields} paymentSnapshot={paymentSnapshot} projectName={projectName} />
                )}
                <div className="contract-payment-rule">
                  <Landmark size={17} />
                  <span>合同账户不得自动覆盖达人档案中的已验证 Beneficiary；不一致时必须人工核对。</span>
                </div>
              </>
            ) : null}

            {activeTab === 'checks' ? (
              <>
                <div className="contract-section-heading">
                  <ShieldCheck size={18} />
                  <span><strong>合同完整性检查</strong><small>阻断项未解决时不能加入付款项目</small></span>
                </div>
                {hasRecognition && contract.extractionStage !== 'applied' ? (
                  <div className={`contract-recognition-apply${allConfirmed ? ' contract-recognition-apply-complete' : ''}`}>
                    <span className="contract-recognition-apply-icon">
                      <CheckCircle2 size={17} />
                    </span>
                    <div><strong>人工确认进度</strong><small>{confirmedCount}/{applicableRecognitionFields.length} 项</small></div>
                    <Button disabled={!allConfirmed || !onUpdateContract || !canEditCurrentContract} onClick={applyRecognition}>应用到正式合同资料</Button>
                  </div>
                ) : null}
                {visibleIssues.length > 0 ? (
                  <div className="contract-issue-list">
                    {visibleIssues.map((issue) => (
                      <article className={`contract-issue contract-issue-${issue.severity}`} key={issue.id}>
                        <span>{issue.severity === 'blocker' ? <AlertTriangle size={17} /> : <FileSearch size={17} />}</span>
                        <div><strong>{issue.label}</strong><p>{issue.description}</p><small>{issue.source}</small></div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="contract-check-success">
                    <CheckCircle2 size={22} />
                    <span><strong>关键字段检查通过</strong><small>{isFrameworkContract(contract) ? '框架合同可作为资源，并供同一达人 IO 单绑定。' : '合同可用于新建付款项目，并继续进行Invoice匹配。'}</small></span>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </section>
      </div>
      {frameworkUploadOpen ? (
        <ContractUploadWizard
          projects={projects}
          creators={creators}
          contracts={contracts}
          initialProjectId={(contract.cooperationProjectId ?? contract.projectId ?? '') as string}
          initialCreatorId={contract.creatorId ?? ''}
          initialContractType="FRAMEWORK"
          allowedContractTypes={['FRAMEWORK']}
          title="上传并绑定框架合同"
          submitLabel="保存并绑定框架合同"
          onClose={() => setFrameworkUploadOpen(false)}
          onSave={saveFrameworkUpload}
        />
      ) : null}
    </div>
  );
}
