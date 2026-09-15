import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  Eye,
  FileSignature,
  Plus,
  Save,
  Trash2,
  UserRound,
  WalletCards,
  WandSparkles,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  createPrototypeCode,
  createPrototypeId,
  type CreatorId,
  type EngagementId,
  type ProjectId,
} from '../businessWorkflow';
import { Button, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { ContractTemplatePreview } from '../components/ContractTemplatePreview';
import { paymentProviderDisplayName } from '../components/PaymentProviderBadge';
import { SearchableComboBox } from '../components/SearchableComboBox';
import { CreatorIdentity } from '../components/CreatorIdentity';
import {
  creatorSearchOptions,
  formatCreatorHandle,
  resolveCreatorSocialAccount,
} from '../creatorSearchOptions';
import { contractGenerationFilename } from '../contractGenerationFilename';
import { contractDocumentFilename } from '../documentFilenames';
import {
  appendContractPublishingChannel,
  contractPublishingChannelForPlatform,
  contractPublishingChannelsForCreator,
  contractPaymentMethodForAccount,
  contractPayoutSnapshot,
  defaultContractPayoutAccount,
  eligibleContractPayoutAccounts,
  formatContractPublishingChannelLinks,
  formatContractPublishingPlatforms,
  removeContractPublishingChannelAt,
  validateContractGenerationModel,
} from '../contractGenerationModel';
import {
  defaultContractAdvertiserEntity,
  findContractAdvertiserEntityForSnapshot,
  LEGACY_CONTRACT_ADVERTISER_ADDRESS,
} from '../contractAdvertiserEntities';
import type {
  ContractGeneratedFiles,
  ContractGenerationModel,
  ContractPublishingChannel,
  ContractQualityIssue,
  ContractQualityReport,
  ContractRecord,
  ContractTemplateFieldKey,
  ContractTemplateManualFieldValueMap,
  ContractTemplateOutputFieldKey,
} from '../contracts';
import {
  getPayoutAccountId,
  getPayoutAccountSelectPresentation,
  getPayoutAccountSummary,
} from '../payoutAccounts';
import { downloadBlob } from '../invoice/invoiceUtils';
import type { ContractAdvertiserSettings, CreatorProfile } from '../types';
import { createContractQualityReport } from '../contractTemplate';
import {
  ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS,
  CONTRACT_TEMPLATE_OUTPUT_FIELDS,
  getContractTemplateSupportedPayoutProviders,
  hasManualPayoutDocumentDifferences,
  resolveEditableContractTemplateFieldPolicies,
  resolveContractTemplateOutputFieldKeys,
} from '../contractTemplateFieldPolicies';
import type { ProjectSummary } from './ProjectDetailPage';

type GeneratedFiles = {
  record: ContractRecord;
  files: ContractGeneratedFiles;
} | null;

type Props = {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  contractAdvertiserSettings: ContractAdvertiserSettings;
  initialEngagementId?: EngagementId | null;
  existingDraft?: ContractRecord | null;
  contractTemplate?: ContractRecord | null;
  onGenerated: (model: ContractGenerationModel, files: ContractGeneratedFiles) => ContractRecord;
  onSaveDraft: (model: ContractGenerationModel) => ContractRecord;
  onDraftStateChange?: (model: ContractGenerationModel, dirty: boolean) => void;
  onCancel: () => void;
  onOpenContractManagement: (contractId: string) => void;
};

type PreviewState = {
  pdfBlob: Blob;
  pdfUrl: string;
  pageCount: number;
  anchors: ContractGeneratedFiles['anchors'];
  qualityReport: ContractQualityReport;
} | null;

const EMPTY_QUALITY_REPORT: ContractQualityReport = {
  completedFields: 0,
  totalFields: 0,
  missingRequired: 0,
  overflowRisks: 0,
  issues: [],
  hasBlockers: false,
};

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD', description: '美元' },
  { value: 'EUR', label: 'EUR', description: '欧元' },
  { value: 'GBP', label: 'GBP', description: '英镑' },
  { value: 'HKD', label: 'HKD', description: '港币' },
];

const CONTENT_FORMAT_OPTIONS = [
  { value: 'Dedicated video', label: 'Dedicated video', description: '独立视频' },
  { value: 'Integrated video', label: 'Integrated video', description: '植入视频' },
  { value: 'Stream', label: 'Stream', description: '直播合作' },
  { value: 'Short-form video', label: 'Short-form video', description: '短视频' },
];

const PAYMENT_DAYS_OPTIONS = [
  { value: '45', label: '45 working days' },
  { value: '60', label: '60 working days' },
];

const FEE_BEARER_OPTIONS = [
  { value: 'SHARED', label: '双方共同承担', description: '对应模板选项 (i)' },
  { value: 'ADVERTISER', label: 'Advertiser 承担', description: '对应模板选项 (ii)' },
  { value: 'PUBLISHER', label: 'Publisher 承担', description: '对应模板选项 (iii)' },
];

const CONTRACT_TYPE_OPTIONS = [
  { value: 'INDEPENDENT', label: '独立合同', description: '一份独立的付款合同' },
  { value: 'FRAMEWORK', label: '框架合同', description: '可被多个 IO 单复用的框架' },
  { value: 'IO', label: 'IO 单', description: '具体项目执行与付款明细' },
];

const PUBLISHING_PLATFORM_OPTIONS = [
  { value: 'YouTube', label: 'YouTube' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'X', label: 'X' },
  { value: 'Twitch', label: 'Twitch' },
];

const cloneTemplateManualValues = (
  values?: Partial<ContractTemplateManualFieldValueMap>,
): Partial<ContractTemplateManualFieldValueMap> => values ? {
  ...values,
  channel: values.channel ? {
    publishingChannels: values.channel.publishingChannels.map((channel) => ({ ...channel })),
  } : undefined,
  campaignPeriod: values.campaignPeriod ? { ...values.campaignPeriod } : undefined,
} : {};

const findInitialContext = (
  projects: ProjectSummary[],
  engagementId?: EngagementId | null,
) => projects
  .flatMap((project) => (project.creatorProfiles ?? []).map((reference) => ({ project, reference })))
  .find((item) => item.reference.engagementId === engagementId);

const findProjectIdForDraft = (draft?: ContractRecord | null) => {
  const saved = draft?.generationSnapshot;
  if (!saved) return '';
  return String(saved.cooperationProjectId ?? saved.projectId ?? '');
}

const fieldKeyForError = (key: string): ContractTemplateFieldKey | null => {
  const map: Record<string, ContractTemplateFieldKey> = {
    publisher: 'publisher',
    publisherAddress: 'publisherAddress',
    channelName: 'channelName',
    channelUrl: 'channelUrl',
    platform: 'platform',
    effectiveDate: 'effectiveDate',
    campaignStart: 'campaignPeriod',
    campaignEnd: 'campaignPeriod',
    purposeItems: 'purposeItems',
    promotedProduct: 'promotedProduct',
    hashtag: 'hashtag',
    contentFormat: 'contentFormat',
    releaseStart: 'releasePeriod',
    releaseEnd: 'releasePeriod',
    language: 'language',
    contentLength: 'contentLength',
    licensePeriod: 'licensePeriod',
    licensePrice: 'licensePrice',
    currency: 'totalFee',
    totalFee: 'totalFee',
    invoiceIssueWorkingDays: 'invoiceIssueWorkingDays',
    paymentWorkingDays: 'paymentWorkingDays',
    feeBearer: 'feeBearer',
    payoutAccountId: 'payoutAccount',
  };
  return map[key] ?? null;
};

export const contractBuilderTemplateOutputFieldKeys = (
  _draftModel?: Pick<ContractGenerationModel, 'templateOutputFieldKeys'> | null,
) => resolveContractTemplateOutputFieldKeys(ALL_CONTRACT_TEMPLATE_OUTPUT_FIELD_KEYS);

export function ContractBuilderPage({
  projects,
  creators,
  contractAdvertiserSettings,
  initialEngagementId,
  existingDraft,
  contractTemplate,
  onGenerated,
  onSaveDraft,
  onDraftStateChange,
  onCancel,
  onOpenContractManagement,
}: Props) {
  const draftModel = existingDraft?.generationSnapshot;
  const templateFieldPolicies = useMemo(() => resolveEditableContractTemplateFieldPolicies(
    draftModel?.templateFieldPolicies ?? contractTemplate?.templateFieldPolicies,
  ), [contractTemplate?.templateFieldPolicies, draftModel?.templateFieldPolicies]);
  const templateOutputFieldKeys = useMemo(
    () => contractBuilderTemplateOutputFieldKeys(draftModel),
    [draftModel],
  );
  const configuredAdvertiserMode = draftModel?.templateFieldPolicies?.advertiser
    ?? contractTemplate?.templateFieldPolicies?.advertiser;
  const supportedPayoutProviders = useMemo(() => getContractTemplateSupportedPayoutProviders(
    templateFieldPolicies,
    templateOutputFieldKeys,
  ), [templateFieldPolicies, templateOutputFieldKeys]);
  const templateHasOutputField = (key: ContractTemplateOutputFieldKey) => (
    templateOutputFieldKeys.includes(key)
  );
  const defaultAdvertiserEntity = defaultContractAdvertiserEntity(contractAdvertiserSettings)!;
  const matchedDraftAdvertiserEntity = findContractAdvertiserEntityForSnapshot(
    contractAdvertiserSettings,
    draftModel,
  );
  const historicalAdvertiserEntityValue = '__contract_advertiser_snapshot__';
  const initialContext = findInitialContext(projects, initialEngagementId);
  const initialProjectId = findProjectIdForDraft(existingDraft)
    || String(initialContext?.project.cooperationProjectId ?? initialContext?.project.projectId ?? initialContext?.project.id ?? '');
  const initialProject = projects.find((project) => String(project.cooperationProjectId ?? project.projectId ?? project.id) === initialProjectId)
    ?? initialContext?.project
    ?? null;
  const initialCreator = creators.find((creator) => (
    creator.id === (draftModel?.creatorId ?? initialContext?.reference.creatorId)
  )) ?? null;
  const initialSocialAccount = resolveCreatorSocialAccount(
    initialCreator,
    draftModel?.creatorSocialAccountId ?? initialContext?.reference.socialAccountId,
    draftModel?.creatorHandle ?? initialContext?.reference.handle,
    draftModel?.creatorPlatform ?? initialContext?.reference.platform,
  );
  const initialEligibleAccounts = eligibleContractPayoutAccounts(initialCreator).filter((account) => (
    supportedPayoutProviders.includes(account.provider as ContractGenerationModel['payoutProvider'])
  ));
  const profileDefaultAccount = defaultContractPayoutAccount(initialCreator);
  const initialAccount = initialEligibleAccounts.find((account) => account.id === profileDefaultAccount?.id)
    ?? initialEligibleAccounts[0]
    ?? null;
  const initialPublishingChannels = contractPublishingChannelsForCreator(initialCreator, draftModel)
    .sort((left, right) => (
      Number(right.socialAccountId === initialSocialAccount?.id)
      - Number(left.socialAccountId === initialSocialAccount?.id)
    ));
  const [creatorId, setCreatorId] = useState(draftModel?.creatorId ?? initialCreator?.id ?? '');
  const [creatorSocialAccountId, setCreatorSocialAccountId] = useState(
    draftModel?.creatorSocialAccountId ?? initialSocialAccount?.id ?? '',
  );
  const [engagementId, setEngagementId] = useState(draftModel?.engagementId ?? initialEngagementId ?? '');
  const [projectSelectionId, setProjectSelectionId] = useState(initialProjectId);
  const [draftEngagementIds] = useState<Record<string, EngagementId>>(() => Object.fromEntries(
    projects.flatMap((project) => creators.map((creator) => {
      const projectId = String(project.cooperationProjectId ?? project.projectId ?? project.id);
      const existing = project.creatorProfiles?.find((reference) => reference.creatorId === creator.id);
      return [
        `${creator.id}:${projectId}`,
        existing?.engagementId ?? createPrototypeId('engagement') as EngagementId,
      ];
    })),
  ));
  const [contractType, setContractType] = useState<NonNullable<ContractGenerationModel['contractType']>>(draftModel?.contractType ?? existingDraft?.contractType ?? 'INDEPENDENT');
  const [contractNumber] = useState(() => existingDraft?.id ?? createPrototypeCode('CON'));
  const [contractName, setContractName] = useState(draftModel?.contractName ?? existingDraft?.name ?? '');
  const [selectedAdvertiserEntityId, setSelectedAdvertiserEntityId] = useState<string>(() => (
    draftModel
      ? matchedDraftAdvertiserEntity?.id ?? historicalAdvertiserEntityValue
      : defaultAdvertiserEntity.id
  ));
  const [projectName, setProjectName] = useState(draftModel?.projectName ?? initialProject?.name ?? '');
  const [effectiveDate, setEffectiveDate] = useState(draftModel?.effectiveDate ?? '');
  const [campaignStart] = useState('');
  const [campaignEnd] = useState('');
  const [purposeItems, setPurposeItems] = useState<string[]>(draftModel?.purposeItems.length ? draftModel.purposeItems : ['', '']);
  const [promotedProduct, setPromotedProduct] = useState(draftModel?.promotedProduct ?? initialContext?.project.brand ?? '');
  const [hashtag, setHashtag] = useState(draftModel?.hashtag ?? '');
  const [contentFormat, setContentFormat] = useState(draftModel?.contentFormat ?? '');
  const [releaseStart, setReleaseStart] = useState(draftModel?.releaseStart ?? '');
  const [releaseEnd, setReleaseEnd] = useState(draftModel?.releaseEnd ?? '');
  const [language, setLanguage] = useState(draftModel?.language ?? '');
  const [contentLength, setContentLength] = useState(draftModel?.contentLength ?? '');
  const [licensePeriod, setLicensePeriod] = useState(draftModel?.licensePeriod ?? '');
  const [licensePrice, setLicensePrice] = useState(draftModel?.licensePrice ?? '');
  const [currency, setCurrency] = useState(draftModel?.currency ?? 'USD');
  const [totalFee, setTotalFee] = useState(draftModel?.totalFee ?? '');
  const [invoiceIssueWorkingDays, setInvoiceIssueWorkingDays] = useState(draftModel?.invoiceIssueWorkingDays ?? 3);
  const [paymentWorkingDays, setPaymentWorkingDays] = useState<45 | 60>(draftModel?.paymentWorkingDays ?? 45);
  const [feeBearer, setFeeBearer] = useState<ContractGenerationModel['feeBearer']>(draftModel?.feeBearer ?? 'ADVERTISER');
  const [payoutAccountId, setPayoutAccountId] = useState(
    draftModel?.payoutAccountId ?? (initialAccount ? getPayoutAccountId(initialAccount) : ''),
  );
  const [publishingChannels, setPublishingChannels] = useState<ContractPublishingChannel[]>(
    initialPublishingChannels,
  );
  const [templateManualFieldValues, setTemplateManualFieldValues] = useState<
    Partial<ContractTemplateManualFieldValueMap>
  >(() => {
    if (draftModel?.templateManualFieldValues) {
      const currentValues = cloneTemplateManualValues(draftModel.templateManualFieldValues);
      delete currentValues.campaignPeriod;
      return currentValues;
    }
    return {};
  });
  const [manualAdvertiserAddress, setManualAdvertiserAddress] = useState(
    draftModel?.advertiserAddress ?? (draftModel ? LEGACY_CONTRACT_ADVERTISER_ADDRESS : ''),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generationError, setGenerationError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedFiles>(null);
  const [activeField, setActiveField] = useState<ContractTemplateFieldKey | null>(null);
  const [highlightRequest, setHighlightRequest] = useState<{
    fieldKey: ContractTemplateFieldKey;
    nonce: number;
  } | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [previewFiles, setPreviewFiles] = useState<ContractGeneratedFiles | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewStale, setPreviewStale] = useState(false);
  const [formShare, setFormShare] = useState(40);
  const [resizing, setResizing] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const workspaceRef = useRef<HTMLDivElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewGenerationRef = useRef(0);
  const previewTimerRef = useRef<number | null>(null);

  const selectedCreator = creators.find((creator) => creator.id === creatorId) ?? null;
  const selectedAdvertiserEntity = contractAdvertiserSettings.entities.find((entity) => (
    entity.id === selectedAdvertiserEntityId
  ));
  const historicalAdvertiserSnapshot = draftModel ? {
    id: draftModel.advertiserEntityId,
    name: draftModel.advertiser,
    address: draftModel.advertiserAddress ?? LEGACY_CONTRACT_ADVERTISER_ADDRESS,
  } : null;
  const systemAdvertiser = selectedAdvertiserEntityId === historicalAdvertiserEntityValue
    ? historicalAdvertiserSnapshot
    : selectedAdvertiserEntity ?? defaultAdvertiserEntity;
  const advertiserOptions = [
    ...(selectedAdvertiserEntityId === historicalAdvertiserEntityValue && historicalAdvertiserSnapshot ? [{
      value: historicalAdvertiserEntityValue,
      label: `${historicalAdvertiserSnapshot.name} · 历史快照`,
      description: historicalAdvertiserSnapshot.address,
      badges: [{ label: '历史', tone: 'neutral' as const }],
    }] : []),
    ...contractAdvertiserSettings.entities.map((entity) => ({
      value: entity.id,
      label: entity.name,
      description: entity.address,
      badges: entity.id === contractAdvertiserSettings.defaultEntityId
        ? [{ label: '默认', tone: 'success' as const }]
        : undefined,
    })),
  ];
  const selectedSocialAccount = resolveCreatorSocialAccount(
    selectedCreator,
    creatorSocialAccountId,
    draftModel?.creatorHandle,
    draftModel?.creatorPlatform,
  );
  const creatorSelectionValue = creatorId;
  const selectedProject = projects.find((project) => String(project.cooperationProjectId ?? project.projectId ?? project.id) === projectSelectionId) ?? null;
  const selectedReference = selectedProject?.creatorProfiles?.find((reference) => (
    reference.creatorId === creatorId && reference.status !== 'removed'
  ));
  const selectedContext = selectedProject && selectedReference ? { project: selectedProject, reference: selectedReference } : null;
  const eligibleAccounts = eligibleContractPayoutAccounts(selectedCreator).filter((account) => (
    supportedPayoutProviders.includes(account.provider as ContractGenerationModel['payoutProvider'])
  ));
  const selectedAccount = eligibleAccounts.find((account) => (
    account.id === payoutAccountId || getPayoutAccountId(account) === payoutAccountId
  )) ?? null;
  const primarySocialAccount = selectedSocialAccount ?? selectedCreator?.socialAccounts.find((account) => (
    account.platform.toLowerCase() === selectedContext?.reference.platform.toLowerCase()
    || account.handle.toLowerCase() === selectedContext?.reference.handle.toLowerCase()
  )) ?? selectedCreator?.socialAccounts[0];
  const publisher = selectedCreator?.contact.legalName ?? '';
  const publisherAddress = selectedCreator?.contact.address ?? '';
  const manualPublishingChannels = templateManualFieldValues.channel?.publishingChannels ?? [];
  const activePublishingChannels = templateFieldPolicies.channel === 'MANUAL'
    ? manualPublishingChannels
    : publishingChannels;
  const publishingChannelValues = {
    publishingChannels: activePublishingChannels,
    platform: '',
    channelUrl: '',
  };
  const platform = formatContractPublishingPlatforms(publishingChannelValues);
  const primaryPublishingChannel = activePublishingChannels.find((channel) => (
    channel.socialAccountId === primarySocialAccount?.id
  )) ?? activePublishingChannels[0];
  const publishingSocialAccount = selectedCreator?.socialAccounts.find((account) => (
    account.id === primaryPublishingChannel?.socialAccountId
  )) ?? selectedCreator?.socialAccounts.find((account) => (
    account.platform.trim().toLowerCase() === primaryPublishingChannel?.platform.trim().toLowerCase()
  ));
  const rawChannelName = publishingSocialAccount?.handle ?? '';
  const channelName = rawChannelName
    ? formatCreatorHandle(rawChannelName, publishingSocialAccount?.platform)
    : '';
  const channelUrl = formatContractPublishingChannelLinks(publishingChannelValues);
  const paymentSnapshot = useMemo(
    () => contractPayoutSnapshot(selectedAccount, selectedCreator?.id),
    [selectedAccount, selectedCreator?.id],
  );
  const paymentMethod = contractPaymentMethodForAccount(selectedAccount);
  const payoutProvider = selectedAccount?.provider === 'PayPal' ? 'PayPal' : 'Airwallex';
  const creatorOptions = creatorSearchOptions(creators).map((option) => ({
    ...option,
    selectedLabel: option.label,
  }));
  const projectOptions = projects.map((project) => ({
    value: String(project.cooperationProjectId ?? project.projectId ?? project.id),
    label: project.name,
    description: `${project.cooperationProjectCode ?? project.projectCode ?? project.id} · ${project.brand} · 飞书合作项目`,
    searchText: `${project.name} ${project.brand} ${project.cooperationProjectCode ?? ''} ${project.projectCode ?? ''}`,
  }));
  const payoutOptions = eligibleAccounts.map((account) => ({
    value: getPayoutAccountId(account),
    label: `${account.nickname}${account.isDefault ? ' · 默认' : ''}`,
    description: `${getPayoutAccountSummary(account)} · ${getPayoutAccountSelectPresentation(account).description}`,
  }));
  const resolvedProjectId = String(selectedProject?.cooperationProjectId ?? selectedProject?.projectId ?? selectedProject?.id ?? '');
  const resolvedEngagementId = selectedReference?.engagementId ?? engagementId;
  const advertiserMode = templateHasOutputField('advertiser')
    ? configuredAdvertiserMode === 'OMIT' ? 'OMIT' : templateFieldPolicies.advertiser
    : 'OMIT';
  const manualAdvertiserName = typeof templateManualFieldValues.advertiser === 'string'
    ? templateManualFieldValues.advertiser
    : '';
  const advertiser = advertiserMode === 'MANUAL'
    ? manualAdvertiserName
    : advertiserMode === 'SYSTEM'
      ? systemAdvertiser?.name ?? ''
      : '';
  const advertiserAddress = advertiserMode === 'MANUAL'
    ? manualAdvertiserAddress
    : advertiserMode === 'SYSTEM'
      ? systemAdvertiser?.address ?? ''
      : '';
  const advertiserEntityId = advertiserMode === 'SYSTEM'
    ? (selectedAdvertiserEntityId === historicalAdvertiserEntityValue
        ? historicalAdvertiserSnapshot?.id
        : selectedAdvertiserEntity?.id ?? defaultAdvertiserEntity.id)
    : undefined;

  const model = useMemo<ContractGenerationModel>(() => ({
    templateId: 'CON-TPL-2026-KOL',
    templateFieldPolicies: { ...templateFieldPolicies, advertiser: advertiserMode },
    templateOutputFieldKeys: [...templateOutputFieldKeys],
    templateManualFieldValues: cloneTemplateManualValues(templateManualFieldValues),
    contractName,
    contractType,
    projectId: resolvedProjectId as ProjectId,
    cooperationProjectId: resolvedProjectId as ProjectId,
    projectLinks: resolvedProjectId ? [{
      cooperationProjectId: resolvedProjectId as ProjectId,
      status: 'ACTIVE' as const,
    }] : [],
    projectName,
    brandName: selectedProject?.brand ?? '',
    creatorId: (selectedCreator?.id ?? '') as CreatorId,
    creatorName: selectedCreator?.name ?? '',
    creatorHandle: selectedSocialAccount?.handle ?? selectedCreator?.handle ?? '',
    creatorSocialAccountId: selectedSocialAccount?.id,
    creatorPlatform: selectedSocialAccount?.platform ?? selectedCreator?.platform,
    engagementId: resolvedEngagementId as EngagementId,
    contractNumber,
    ioNumber: '',
    advertiserEntityId,
    advertiser,
    advertiserAddress,
    publisher,
    publisherAddress,
    platform,
    channelName,
    channelUrl,
    publishingChannels: activePublishingChannels,
    effectiveDate,
    campaignStart,
    campaignEnd,
    purposeItems: purposeItems.map((item) => item.trim()).filter(Boolean),
    promotedProduct,
    hashtag,
    contentFormat,
    releaseStart,
    releaseEnd,
    language,
    contentLength,
    licensePeriod,
    licensePrice,
    currency,
    totalFee,
    invoiceIssueWorkingDays,
    paymentWorkingDays,
    paymentMethod,
    feeBearer,
    payoutAccountId: paymentSnapshot.payoutAccountId ?? payoutAccountId,
    payoutAccountVersion: paymentSnapshot.payoutAccountVersion,
    payoutAccountFingerprint: paymentSnapshot.accountFingerprint,
    payoutProvider,
    paymentSnapshot,
  }), [
    advertiser,
    advertiserAddress,
    advertiserEntityId,
    advertiserMode,
    campaignEnd,
    campaignStart,
    channelName,
    channelUrl,
    contentFormat,
    contentLength,
    contractName,
    contractNumber,
    currency,
    effectiveDate,
    engagementId,
    feeBearer,
    hashtag,
    invoiceIssueWorkingDays,
    language,
    licensePeriod,
    licensePrice,
    paymentMethod,
    paymentSnapshot,
    paymentWorkingDays,
    payoutAccountId,
    paymentSnapshot.accountFingerprint,
    paymentSnapshot.payoutAccountId,
    paymentSnapshot.payoutAccountVersion,
    payoutProvider,
    platform,
    activePublishingChannels,
    projectName,
    promotedProduct,
    publisher,
    publisherAddress,
    purposeItems,
    releaseEnd,
    releaseStart,
    selectedProject,
    contractType,
    resolvedEngagementId,
    resolvedProjectId,
    selectedCreator,
    selectedSocialAccount,
    templateFieldPolicies,
    templateOutputFieldKeys,
    templateManualFieldValues,
    totalFee,
  ]);
  const modelSignature = useMemo(() => JSON.stringify(model), [model]);
  const [savedModelSignature, setSavedModelSignature] = useState<string | null>(null);
  const dirty = savedModelSignature !== null && savedModelSignature !== modelSignature;

  useEffect(() => {
    if (savedModelSignature === null) setSavedModelSignature(modelSignature);
  }, [modelSignature, savedModelSignature]);

  useEffect(() => {
    onDraftStateChange?.(model, dirty);
  }, [dirty, model, onDraftStateChange]);

  useEffect(() => {
    if (!dirty) return undefined;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  const qualityReport = useMemo(
    () => createContractQualityReport(model),
    [model],
  );
  const manualPayoutDiff = useMemo(
    () => hasManualPayoutDocumentDifferences(model),
    [model],
  );

  const signalField = (fieldKey: ContractTemplateFieldKey) => {
    setActiveField(fieldKey);
    setHighlightRequest({ fieldKey, nonce: performance.now() });
  };

  const resetOutput = () => {
    setGenerationError('');
    setPreviewFiles(null);
    if (generated) setPreviewStale(true);
    if (activeField) signalField(activeField);
  };

  const setManualScalarField = (
    key: Exclude<ContractTemplateOutputFieldKey, 'channel' | 'campaignPeriod'>,
    value: string,
  ) => {
    setTemplateManualFieldValues((current) => ({ ...current, [key]: value }));
    resetOutput();
  };

  const manualScalarFieldValue = (
    key: Exclude<ContractTemplateOutputFieldKey, 'channel' | 'campaignPeriod'>,
  ) => {
    const value = templateManualFieldValues[key];
    return typeof value === 'string' ? value : '';
  };

  const updatePublishingChannel = (
    index: number,
    key: 'platform' | 'channelUrl',
    value: string,
  ) => {
    const updateChannels = (channels: ContractPublishingChannel[]) => (
      channels.length ? channels : [{ socialAccountId: '', platform: '', channelUrl: '' }]
    ).map((channel, channelIndex) => {
      if (channelIndex !== index) return channel;
      return key === 'platform'
        ? contractPublishingChannelForPlatform(selectedCreator, value, channel.socialAccountId)
        : { ...channel, channelUrl: value };
    });
    if (templateFieldPolicies.channel === 'MANUAL') {
      setTemplateManualFieldValues((current) => ({
        ...current,
        channel: { publishingChannels: updateChannels(current.channel?.publishingChannels ?? []) },
      }));
    } else {
      setPublishingChannels(updateChannels);
    }
    setErrors((current) => {
      const next = { ...current };
      delete next.platform;
      delete next.channelUrl;
      return next;
    });
    resetOutput();
  };

  const addPublishingChannel = () => {
    if (templateFieldPolicies.channel === 'MANUAL') {
      setTemplateManualFieldValues((current) => ({
        ...current,
        channel: {
          publishingChannels: appendContractPublishingChannel(current.channel?.publishingChannels ?? []),
        },
      }));
    } else {
      setPublishingChannels(appendContractPublishingChannel);
    }
    resetOutput();
  };

  const removePublishingChannel = (index: number) => {
    if (templateFieldPolicies.channel === 'MANUAL') {
      setTemplateManualFieldValues((current) => ({
        ...current,
        channel: {
          publishingChannels: removeContractPublishingChannelAt(
            current.channel?.publishingChannels ?? [],
            index,
          ),
        },
      }));
    } else {
      setPublishingChannels((current) => removeContractPublishingChannelAt(current, index));
    }
    resetOutput();
  };

  const replacePreview = (
    pdfBlob: Blob,
    pageCount: number,
    anchors: ContractGeneratedFiles['anchors'],
    report: ContractQualityReport,
  ) => {
    const nextUrl = URL.createObjectURL(pdfBlob);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = nextUrl;
    setPreview({
      pdfBlob,
      pdfUrl: nextUrl,
      pageCount,
      anchors,
      qualityReport: report,
    });
  };

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    if (previewFiles && !previewStale) {
      setPreviewLoading(false);
      return undefined;
    }
    const generation = previewGenerationRef.current + 1;
    previewGenerationRef.current = generation;
    setPreviewLoading(true);
    const timer = window.setTimeout(() => {
      if (previewTimerRef.current === timer) previewTimerRef.current = null;
      void import('../contractGeneration')
        .then(({ generateContractPreview }) => generateContractPreview(model, 'DRAFT'))
        .then((result) => {
          if (previewGenerationRef.current !== generation) return;
          replacePreview(result.pdfBlob, result.pageCount, result.anchors, result.qualityReport);
          setPreviewLoading(false);
        })
        .catch((reason) => {
          if (previewGenerationRef.current !== generation) return;
          setPreviewLoading(false);
          setGenerationError(reason instanceof Error ? reason.message : '合同预览生成失败，请重试。');
        });
    }, 500);
    previewTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (previewTimerRef.current === timer) previewTimerRef.current = null;
    };
  }, [model, previewFiles, previewStale]);

  const selectCreator = (value: string) => {
    const creator = creators.find((item) => item.id === value) ?? null;
    const socialAccount = resolveCreatorSocialAccount(creator);
    const supportedAccounts = eligibleContractPayoutAccounts(creator).filter((candidate) => (
      supportedPayoutProviders.includes(candidate.provider as ContractGenerationModel['payoutProvider'])
    ));
    const defaultAccount = defaultContractPayoutAccount(creator);
    const account = supportedAccounts.find((candidate) => candidate.id === defaultAccount?.id)
      ?? supportedAccounts[0]
      ?? null;
    setCreatorId(creator?.id ?? '');
    setCreatorSocialAccountId(socialAccount?.id ?? '');
    setProjectSelectionId('');
    setEngagementId('');
    setProjectName('');
    setPromotedProduct('');
    setPayoutAccountId(account ? getPayoutAccountId(account) : '');
    setPublishingChannels(contractPublishingChannelsForCreator(creator).sort((left, right) => (
      Number(right.socialAccountId === socialAccount?.id)
      - Number(left.socialAccountId === socialAccount?.id)
    )));
    setTemplateManualFieldValues((current) => ({
      advertiser: current.advertiser,
    }));
    setErrors({});
    resetOutput();
  };

  const selectProject = (id: string) => {
    const project = projects.find((item) => String(item.cooperationProjectId ?? item.projectId ?? item.id) === id);
    setProjectSelectionId(id);
    setEngagementId(creatorId && project ? draftEngagementIds[`${creatorId}:${id}`] ?? '' : '');
    setProjectName(project?.name ?? '');
    setPromotedProduct(project?.brand ?? '');
    setErrors({});
    resetOutput();
  };

  const focusField = (fieldKey: ContractTemplateFieldKey, formKey?: string) => {
    signalField(fieldKey);
    const key = formKey ?? (
      fieldKey === 'campaignPeriod'
        ? 'campaignStart'
        : fieldKey === 'releasePeriod'
          ? 'releaseStart'
          : fieldKey === 'payoutAccount'
            ? 'payoutAccountId'
            : fieldKey
    );
    window.requestAnimationFrame(() => {
      const field = document.querySelector<HTMLElement>(`[data-contract-field="${key}"]`);
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field?.querySelector<HTMLElement>('input, textarea, button')?.focus({ preventScroll: true });
    });
  };

  const focusIssue = (issue: ContractQualityIssue) => {
    const formKey = issue.id === 'missing-creator-selection'
      ? 'creator'
      : issue.id === 'missing-project-selection'
        ? 'project'
        : issue.id === 'missing-payout-account-selection'
          ? 'payoutAccountId'
          : undefined;
    focusField(issue.fieldKey, formKey);
  };

  const generate = async (
    variant: ContractGeneratedFiles['variant'],
    action: 'PREVIEW' | 'SAVE',
  ) => {
    const nextErrors = variant === 'FORMAL'
      ? validateContractGenerationModel(model)
      : action === 'SAVE' && !model.contractName.trim()
        ? { contractName: '请输入合同名称' }
        : {};
    setErrors(nextErrors);
    setGenerationError('');
    const currentReport = createContractQualityReport(model);
    const shouldBlock = action === 'SAVE' && (
      Object.keys(nextErrors).length > 0
      || (variant === 'FORMAL' && currentReport.hasBlockers)
    );
    if (shouldBlock) {
      const firstKey = Object.keys(nextErrors)[0];
      const firstIssue = currentReport.issues.find((issue) => issue.severity === 'BLOCKER');
      if (firstKey) {
        if (firstKey === 'contractName') {
          window.requestAnimationFrame(() => {
            const field = document.querySelector<HTMLElement>('[data-contract-field="contractName"]');
            field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            field?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
          });
        } else {
          const fieldKey = fieldKeyForError(firstKey);
          if (fieldKey) focusField(fieldKey, firstKey);
        }
      } else if (firstIssue) {
        focusIssue(firstIssue);
      }
      return;
    }
    previewGenerationRef.current += 1;
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setGenerating(true);
    try {
      const { generateContractFiles } = await import('../contractGeneration');
      const files = await generateContractFiles(model, { variant });
      setPreviewFiles(files);
      replacePreview(files.pdfBlob, files.pageCount, files.anchors, files.qualityReport);
      setPreviewLoading(false);
      setPreviewStale(false);
      if (action === 'SAVE') {
        const record = onGenerated(model, files);
        setGenerated({ record, files });
        setSavedModelSignature(modelSignature);
      }
    } catch (reason) {
      const fieldId = reason instanceof Error && 'fieldId' in reason ? String(reason.fieldId) : '';
      setGenerationError(
        fieldId
          ? `字段 ${fieldId} 的内容过长，无法放入模板，请缩短后重试。`
          : reason instanceof Error ? reason.message : '合同文件生成失败，请稍后重试。',
      );
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = () => {
    const record = onSaveDraft(model);
    setSavedModelSignature(modelSignature);
    setGenerated(null);
    setGenerationError('');
    return record;
  };

  const download = (extension: 'pdf' | 'docx') => {
    const files = previewFiles ?? (!previewStale ? generated?.files : null);
    const blob = extension === 'pdf' ? files?.pdfBlob ?? preview?.pdfBlob : files?.docxBlob;
    if (!blob) return;
    downloadBlob(
      blob,
      generated?.record
        ? contractDocumentFilename(generated.record, extension)
        : contractGenerationFilename(model, 1, extension),
    );
  };

  const fieldProps = (field: ContractTemplateFieldKey) => ({
    onFocus: () => setActiveField(field),
  });

  const resizeFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizing || !workspaceRef.current) return;
    const bounds = workspaceRef.current.getBoundingClientRect();
    const share = (event.clientX - bounds.left) / bounds.width * 100;
    setFormShare(Math.min(55, Math.max(34, share)));
  };

  const resizeFromKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setFormShare((value) => Math.min(55, Math.max(34, value + (event.key === 'ArrowRight' ? 1 : -1))));
  };

  const layoutStyle = {
    '--contract-form-share': `${formShare}%`,
  } as CSSProperties;

  return (
    <div className="page-stack contract-builder-page">
      <div className="contract-builder-top">
        <button
          className="project-back-button contract-builder-back-button"
          type="button"
          title="返回合同管理"
          onClick={onCancel}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          返回合同管理
        </button>
        <PageHeading
          title="生成合同"
          subtitle="从达人档案、合作项目和已验证收款账户带入资料，可按需补充商业字段后生成 PDF 与可编辑 DOCX。"
        />
        <NoticeBanner>当前为纯前端原型。合同与账户快照只保留在本次浏览器会话，不会上传到外部服务。</NoticeBanner>
        {Object.keys(errors).length ? (
          <div className="invoice-builder-error" role="alert">
            <strong>还有 {Object.keys(errors).length} 项资料需要完善</strong>
            <span>{Object.values(errors)[0]}</span>
          </div>
        ) : null}
        {generationError ? <div className="invoice-builder-error" role="alert"><strong>合同生成失败</strong><span>{generationError}</span></div> : null}
        {generated ? (
          <section className={`invoice-generation-success ${previewStale ? 'is-stale' : ''}`} data-testid="contract-generation-success">
            <span><CheckCircle2 size={22} /></span>
            <div>
              <strong>{previewStale ? '草稿预览已过期' : `${generated.record.name} 已${generated.files.variant === 'FORMAL' ? '正式生成' : '保存草稿'}`}</strong>
              <p>{previewStale ? '表单已修改，请重新生成预览或保存。' : 'PDF 与 DOCX 使用同一份合同和账户快照，记录已进入“待上传”。'}</p>
            </div>
            {!previewStale ? (
              <div className="invoice-generation-actions">
                <Button variant="secondary" icon={<Download size={16} />} onClick={() => download('pdf')}>下载 PDF</Button>
                <Button variant="secondary" icon={<Download size={16} />} onClick={() => download('docx')}>下载 DOCX</Button>
                <Button onClick={() => onOpenContractManagement(generated.record.id)}>查看合同记录</Button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <div className="contract-builder-mobile-tabs" role="tablist" aria-label="合同生成区域">
        <button type="button" role="tab" aria-selected={mobileTab === 'form'} className={mobileTab === 'form' ? 'is-active' : ''} onClick={() => setMobileTab('form')}>合同信息</button>
        <button type="button" role="tab" aria-selected={mobileTab === 'preview'} className={mobileTab === 'preview' ? 'is-active' : ''} onClick={() => setMobileTab('preview')}>合同预览</button>
      </div>

      <div
        className={`contract-builder-layout ${resizing ? 'is-resizing' : ''}`}
        ref={workspaceRef}
        style={layoutStyle}
        onPointerMove={resizeFromPointer}
        onPointerUp={() => setResizing(false)}
        onPointerCancel={() => setResizing(false)}
      >
        <section className={`contract-builder-form ${mobileTab !== 'form' ? 'is-mobile-hidden' : ''}`}>
          <div className="contract-builder-form-scroll">
          <div className="invoice-builder-section contract-builder-card">
            <header><span><UserRound size={19} /></span><div><h2>1. 达人与项目</h2><p>从完整达人库和当前账号可管理的合作项目中选择，未关联关系会在生成时自动建立。</p></div></header>
            <div className="invoice-form-grid">
              <div className={`invoice-form-control ${errors.creator ? 'has-error' : ''}`} data-contract-field="creator">
                <span>合作达人 *</span>
                <SearchableComboBox ariaLabel="合同合作达人" className="creator-search-combobox" value={creatorSelectionValue} placeholder="搜索 Display Name、频道 ID、频道链接…" options={creatorOptions} resultUnit="位达人" renderOption={(option) => <CreatorIdentity creator={creators.find((creator) => creator.id === option.value)} socialAccountsMode="expanded" />} onChange={selectCreator} onClear={() => selectCreator('')} />
                <small>{errors.creator}</small>
              </div>
              <div className={`invoice-form-control ${errors.contractType ? 'has-error' : ''}`} data-contract-field="contractType">
                <span>合同类型 *</span>
                <SelectField ariaLabel="合同类型" variant="form" value={contractType} options={CONTRACT_TYPE_OPTIONS} onChange={(value) => { setContractType(value as NonNullable<ContractGenerationModel['contractType']>); resetOutput(); }} />
                <small>{errors.contractType}</small>
              </div>
              <div className={`invoice-form-control ${errors.project ? 'has-error' : ''}`} data-contract-field="project">
                <span>合作项目 *</span>
                <SearchableComboBox ariaLabel="合同合作项目" value={projectSelectionId} placeholder={creatorId ? '搜索项目名称、编号或品牌' : '请先选择达人'} options={projectOptions} disabled={!creatorId} onChange={selectProject} onClear={() => selectProject('')} />
                <small>{errors.project}</small>
              </div>
              <label className={`full-width ${errors.contractName ? 'has-error' : ''}`} data-contract-field="contractName">
                <span>合同名称 *</span>
                <input
                  value={contractName}
                  placeholder="建议格式：达人名称-付款项目名"
                  maxLength={120}
                  onChange={(event) => { setContractName(event.target.value); resetOutput(); }}
                />
                <small>{errors.contractName || '用于合同列表、详情和后续签署文件匹配'}</small>
              </label>
              {advertiserMode === 'SYSTEM' ? (
                <div
                  className={`invoice-form-control full-width ${errors.advertiser || errors.advertiserAddress ? 'has-error' : ''}`}
                  data-contract-field="signature"
                  onFocus={() => setActiveField('signature')}
                >
                  <span>Advertiser *</span>
                  <SelectField
                    ariaLabel="合同 Advertiser 主体"
                    variant="form"
                    menuStrategy="fixed"
                    value={selectedAdvertiserEntityId}
                    options={advertiserOptions}
                    onChange={(value) => {
                      setSelectedAdvertiserEntityId(value);
                      setErrors((current) => {
                        const { advertiser: _advertiser, advertiserAddress: _advertiserAddress, ...rest } = current;
                        return rest;
                      });
                      resetOutput();
                    }}
                  />
                  <small>{errors.advertiser || errors.advertiserAddress || systemAdvertiser?.address}</small>
                </div>
              ) : advertiserMode === 'MANUAL' ? (
                <>
                  <label className={errors.advertiser ? 'has-error' : ''} data-contract-field="signature" {...fieldProps('signature')}>
                    <span>Advertiser *</span>
                    <input
                      value={manualScalarFieldValue('advertiser')}
                      placeholder="输入合同 Advertiser"
                      maxLength={100}
                      onChange={(event) => setManualScalarField('advertiser', event.target.value)}
                    />
                    <small>{errors.advertiser || '仅写入本次合同快照'}</small>
                  </label>
                  <label className={`full-width ${errors.advertiserAddress ? 'has-error' : ''}`} data-contract-field="advertiserAddress" {...fieldProps('signature')}>
                    <span>Advertiser Address *</span>
                    <textarea
                      value={manualAdvertiserAddress}
                      placeholder="输入合同 Advertiser 地址"
                      maxLength={500}
                      onChange={(event) => {
                        setManualAdvertiserAddress(event.target.value);
                        setErrors((current) => {
                          const { advertiserAddress: _advertiserAddress, ...rest } = current;
                          return rest;
                        });
                        resetOutput();
                      }}
                    />
                    <small>{errors.advertiserAddress || '仅写入本次合同快照'}</small>
                  </label>
                </>
              ) : null}
              {templateHasOutputField('publisher') && templateFieldPolicies.publisher !== 'OMIT' ? (
                <label className={errors.publisher ? 'has-error' : ''} data-contract-field="publisher" {...fieldProps('publisher')}>
                  <span>Publisher（Real Name / Company Name）*</span>
                  <input
                    value={templateFieldPolicies.publisher === 'MANUAL' ? manualScalarFieldValue('publisher') : publisher}
                    readOnly={templateFieldPolicies.publisher !== 'MANUAL'}
                    placeholder="输入 Publisher 法定名称"
                    onChange={(event) => setManualScalarField('publisher', event.target.value)}
                  />
                  <small>{errors.publisher || (templateFieldPolicies.publisher === 'SYSTEM' ? '达人档案法定名称' : '仅写入本次合同快照')}</small>
                </label>
              ) : null}
              {templateHasOutputField('channel') && templateFieldPolicies.channel !== 'OMIT' ? <div
                className={`contract-publishing-channels full-width ${errors.platform || errors.channelUrl ? 'has-error' : ''}`}
                data-contract-field="platform"
                onFocus={() => setActiveField('platform')}
              >
                <div className="contract-publishing-channels-head">
                  <div className="contract-publishing-channels-copy">
                    <strong>发布平台 / 发布频道</strong>
                    <span>{templateFieldPolicies.channel === 'SYSTEM' ? '已从达人档案带入，可仅修改本次合同快照' : '可选：本次生成时人工填写平台及链接'}</span>
                  </div>
                  <Button
                    className="contract-publishing-channel-add"
                    variant="secondary"
                    icon={<Plus size={14} />}
                    onClick={addPublishingChannel}
                  >
                    新增渠道
                  </Button>
                </div>
                <div className="contract-publishing-channels-grid" data-contract-field="channelUrl">
                  <span>发布平台</span>
                  <span>频道链接</span>
                  <span>操作</span>
                  {activePublishingChannels.map((channel, index) => (
                    <div className="contract-publishing-channel-row" key={`${channel.socialAccountId || 'manual-channel'}-${index}`}>
                      <label>
                        <span className="sr-only">{`发布平台 ${index + 1}`}</span>
                        <SelectField
                          ariaLabel={`发布平台 ${index + 1}`}
                          variant="form"
                          value={channel.platform}
                          placeholder="选择平台"
                          options={PUBLISHING_PLATFORM_OPTIONS}
                          onChange={(value) => updatePublishingChannel(index, 'platform', value)}
                        />
                      </label>
                      <label>
                        <span className="sr-only">{`频道链接 ${index + 1}`}</span>
                        <input
                          type="url"
                          aria-label={`频道链接 ${index + 1}`}
                          value={channel.channelUrl}
                          placeholder="https://"
                          onFocus={() => setActiveField('channelUrl')}
                          onChange={(event) => updatePublishingChannel(index, 'channelUrl', event.target.value)}
                        />
                      </label>
                      <button
                        className="contract-publishing-channel-remove"
                        type="button"
                        aria-label={`删除发布渠道 ${index + 1}`}
                        title="删除该发布渠道"
                        onClick={() => removePublishingChannel(index)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  {!activePublishingChannels.length ? (
                    <div className="contract-publishing-channel-empty">暂无发布频道，可保持为空或点击“新增渠道”补充。</div>
                  ) : null}
                </div>
                <small>{errors.channelUrl || '可留空；修改只保存到当前合同，不会回写达人档案'}</small>
              </div> : null}
              <label className={`full-width ${errors.publisherAddress ? 'has-error' : ''}`} data-contract-field="publisherAddress" {...fieldProps('publisherAddress')}><span>Publisher 地址 *</span><textarea value={publisherAddress} readOnly /><small>{errors.publisherAddress}</small></label>
            </div>
          </div>

          <div className="invoice-builder-section contract-builder-legacy-card">
            <header><span><BriefcaseBusiness size={19} /></span><div><h2>2. 项目与内容条款</h2><p>以下字段均为非必填，填写后写入合同模板。</p></div></header>
            <div className="invoice-form-grid">
              <label className="full-width" data-contract-field="projectName" {...fieldProps('projectName')}><span>Project Name</span><input value={projectName} onChange={(event) => { setProjectName(event.target.value); resetOutput(); }} /></label>
              <label className={errors.effectiveDate ? 'has-error' : ''} data-contract-field="effectiveDate" {...fieldProps('effectiveDate')}><span>生效日期</span><input type="date" value={effectiveDate} onChange={(event) => { setEffectiveDate(event.target.value); resetOutput(); }} /><small>{errors.effectiveDate}</small></label>
              <div className={`contract-purpose-editor full-width ${errors.purposeItems ? 'has-error' : ''}`} data-contract-field="purposeItems" onFocus={() => setActiveField('purposeItems')}>
                <div className="invoice-line-header"><strong>推广目的</strong>{purposeItems.length < 3 ? <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setPurposeItems((current) => [...current, ''])}>新增一项</Button> : null}</div>
                {purposeItems.map((item, index) => (
                  <div className="contract-purpose-row" key={index}>
                    <input
                      aria-label={`推广目的 ${index + 1}`}
                      maxLength={84}
                      value={item}
                      placeholder={`推广目的 ${index + 1}`}
                      onChange={(event) => {
                        setPurposeItems((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value));
                        resetOutput();
                      }}
                    />
                    <button type="button" title="删除" aria-label={`删除推广目的 ${index + 1}`} disabled={purposeItems.length === 1} onClick={() => setPurposeItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
                  </div>
                ))}
                <small>{errors.purposeItems}</small>
              </div>
              <label className={errors.promotedProduct ? 'has-error' : ''} data-contract-field="promotedProduct" {...fieldProps('promotedProduct')}><span>推广产品 / 活动名称</span><input value={promotedProduct} onChange={(event) => { setPromotedProduct(event.target.value); resetOutput(); }} /><small>{errors.promotedProduct}</small></label>
              <label className={errors.hashtag ? 'has-error' : ''} data-contract-field="hashtag" {...fieldProps('hashtag')}><span>Hashtag</span><input value={hashtag} placeholder="#campaign" onChange={(event) => { setHashtag(event.target.value); resetOutput(); }} /><small>{errors.hashtag}</small></label>
              <div className={`invoice-form-control ${errors.contentFormat ? 'has-error' : ''}`} data-contract-field="contentFormat" onFocus={() => setActiveField('contentFormat')}>
                <span>内容形式</span>
                <SelectField ariaLabel="合同内容形式" variant="form" value={contentFormat} placeholder="选择视频或直播形式" options={CONTENT_FORMAT_OPTIONS} onChange={(value) => { setContentFormat(value); resetOutput(); }} />
                <small>{errors.contentFormat}</small>
              </div>
              <label className={errors.language ? 'has-error' : ''} data-contract-field="language" {...fieldProps('language')}><span>内容语言</span><input value={language} placeholder="French" onChange={(event) => { setLanguage(event.target.value); resetOutput(); }} /><small>{errors.language}</small></label>
              <label className={errors.releaseStart ? 'has-error' : ''} data-contract-field="releaseStart" {...fieldProps('releasePeriod')}><span>发布开始日期</span><input type="date" value={releaseStart} onChange={(event) => { setReleaseStart(event.target.value); resetOutput(); }} /><small>{errors.releaseStart}</small></label>
              <label className={errors.releaseEnd ? 'has-error' : ''} data-contract-field="releaseEnd" {...fieldProps('releasePeriod')}><span>发布结束日期</span><input type="date" value={releaseEnd} onChange={(event) => { setReleaseEnd(event.target.value); resetOutput(); }} /><small>{errors.releaseEnd}</small></label>
              <label className={`full-width ${errors.contentLength ? 'has-error' : ''}`} data-contract-field="contentLength" {...fieldProps('contentLength')}><span>内容时长要求</span><textarea maxLength={320} value={contentLength} placeholder="例如：Dedicated video at least 10 minutes" onChange={(event) => { setContentLength(event.target.value); resetOutput(); }} /><small>{errors.contentLength}</small></label>
              <label data-contract-field="licensePeriod" {...fieldProps('licensePeriod')}><span>License Period</span><input value={licensePeriod} onChange={(event) => { setLicensePeriod(event.target.value); resetOutput(); }} /></label>
              <label className={errors.licensePrice ? 'has-error' : ''} data-contract-field="licensePrice" {...fieldProps('licensePrice')}><span>License Price</span><input type="number" min="0" step="0.01" value={licensePrice} onChange={(event) => { setLicensePrice(event.target.value); resetOutput(); }} /><small>{errors.licensePrice}</small></label>
            </div>
          </div>

          <div className="invoice-builder-section contract-builder-legacy-card">
            <header><span><FileSignature size={19} /></span><div><h2>3. 商务条款</h2><p>以下字段均为非必填；保留默认值或填写后将写入合同模板。</p></div></header>
            <div className="invoice-form-grid">
              <div className={`invoice-form-control ${errors.currency ? 'has-error' : ''}`} data-contract-field="currency" onFocus={() => setActiveField('totalFee')}><span>币种</span><SelectField ariaLabel="合同币种" variant="form" value={currency} options={CURRENCY_OPTIONS} onChange={(value) => { setCurrency(value); resetOutput(); }} /><small>{errors.currency}</small></div>
              <label className={errors.totalFee ? 'has-error' : ''} data-contract-field="totalFee" {...fieldProps('totalFee')}><span>Project Total Fees</span><input type="number" min="0" step="0.01" value={totalFee} onChange={(event) => { setTotalFee(event.target.value); resetOutput(); }} /><small>{errors.totalFee}</small></label>
              <label className={errors.invoiceIssueWorkingDays ? 'has-error' : ''} data-contract-field="invoiceIssueWorkingDays" {...fieldProps('invoiceIssueWorkingDays')}><span>Invoice 开具期限</span><input type="number" min="1" max="30" value={invoiceIssueWorkingDays} onChange={(event) => { setInvoiceIssueWorkingDays(Number(event.target.value)); resetOutput(); }} /><small>{errors.invoiceIssueWorkingDays}</small></label>
              <div className="invoice-form-control" data-contract-field="paymentWorkingDays" onFocus={() => setActiveField('paymentWorkingDays')}><span>付款期限</span><SelectField ariaLabel="合同付款期限" variant="form" value={String(paymentWorkingDays)} options={PAYMENT_DAYS_OPTIONS} onChange={(value) => { setPaymentWorkingDays(Number(value) as 45 | 60); resetOutput(); }} /></div>
              <div className={`invoice-form-control full-width ${errors.feeBearer ? 'has-error' : ''}`} data-contract-field="feeBearer" onFocus={() => setActiveField('feeBearer')}><span>转账手续费承担方</span><SelectField ariaLabel="合同手续费承担方" variant="form" value={feeBearer} options={FEE_BEARER_OPTIONS} onChange={(value) => { setFeeBearer(value as ContractGenerationModel['feeBearer']); resetOutput(); }} /><small>{errors.feeBearer}</small></div>
            </div>
          </div>

          <div className="invoice-builder-section contract-builder-card">
            <header><span><WalletCards size={19} /></span><div><h2>2. 收款账户</h2><p>仅可选择达人档案中已验证的 Airwallex 或 PayPal 账户；生成时会保存不可变付款快照。</p></div></header>
            <div className="invoice-form-grid">
              <div className={`invoice-form-control full-width ${errors.payoutAccountId ? 'has-error' : ''}`} data-contract-field="payoutAccountId" onFocus={() => setActiveField('payoutAccount')}>
                <span>合同收款账户 *</span>
                <SearchableComboBox ariaLabel="合同收款账户" value={payoutAccountId} placeholder={selectedCreator ? '搜索账户名称、渠道或完整账号' : '请先选择达人'} options={payoutOptions} disabled={!selectedCreator || !payoutOptions.length} onChange={(value) => { setPayoutAccountId(value); resetOutput(); }} onClear={() => { setPayoutAccountId(''); resetOutput(); }} />
                <small>{errors.payoutAccountId}</small>
              </div>
              {selectedAccount ? (() => {
                const presentation = getPayoutAccountSelectPresentation(selectedAccount);
                const statusBadge = presentation.badges.find((badge) => badge.label !== '默认账户');
                const identityDetails = [
                  { label: '账户昵称', value: selectedAccount.nickname },
                  { label: '渠道', value: paymentProviderDisplayName(selectedAccount.provider) },
                  { label: '账户状态', value: statusBadge?.label ?? selectedAccount.status },
                  { label: '默认账户', value: selectedAccount.isDefault ? '是' : '否' },
                  { label: '账户版本', value: selectedAccount.payoutAccountVersion ?? 'legacy-v1' },
                  { label: '账户标识', value: presentation.description },
                  ...(selectedAccount.provider === 'Airwallex' ? [{ label: '实体类型', value: selectedAccount.entityType === 'COMPANY' ? '公司' : '个人' }] : []),
                ];
                return (
                  <div className="contract-account-details full-width">
                    <div className="contract-account-detail-group"><strong>账户身份</strong><div className="contract-account-detail-grid">{identityDetails.map((detail) => <div key={detail.label}><span>{detail.label}</span><strong>{detail.value || '待补充'}</strong></div>)}</div></div>
                    <div className="contract-account-detail-group"><strong>{paymentProviderDisplayName(selectedAccount.provider)} 收款信息</strong><div className="contract-account-detail-grid">{presentation.details.map((detail) => <div key={detail.label}><span>{detail.label}</span><strong>{detail.value || '待补充'}</strong></div>)}</div></div>
                  </div>
                );
              })() : <div className="contract-account-empty full-width">达人档案没有可用于合同的已验证 Airwallex 或 PayPal 账户。</div>}
              {selectedAccount ? (() => {
                const providerGroup = payoutProvider === 'PayPal' ? 'PAYPAL' : 'BANK';
                const manualFields = CONTRACT_TEMPLATE_OUTPUT_FIELDS.filter((field) => (
                  field.group === providerGroup
                  && templateHasOutputField(field.key)
                  && templateFieldPolicies[field.key] === 'MANUAL'
                ));
                if (!manualFields.length) return null;
                return (
                  <div className="contract-manual-payout-fields full-width">
                    <div className="contract-manual-payout-fields-heading">
                      <strong>本次合同人工收款值</strong>
                      <span>不会回写达人账户</span>
                    </div>
                    <div className="invoice-form-grid">
                      {manualFields.map((field) => {
                        const key = field.key as Exclude<ContractTemplateOutputFieldKey, 'channel' | 'campaignPeriod'>;
                        const multiline = ['beneficiaryBankAddress', 'remittanceInformation', 'transferNote'].includes(key);
                        return (
                          <label className="full-width" data-contract-output-field={key} key={key}>
                            <span>{field.label}</span>
                            {multiline ? (
                              <textarea value={manualScalarFieldValue(key)} onChange={(event) => setManualScalarField(key, event.target.value)} />
                            ) : (
                              <input
                                type={key === 'paypalEmailAddress' ? 'email' : 'text'}
                                value={manualScalarFieldValue(key)}
                                onChange={(event) => setManualScalarField(key, event.target.value)}
                              />
                            )}
                            <small>人工值仅保存到当前合同文档快照</small>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })() : null}
              {selectedAccount && manualPayoutDiff ? (
                <div className="contract-manual-payout-warning full-width" role="status">
                  <AlertTriangle size={16} />
                  <span>人工收款值与达人已验证账户不同，正式使用前必须人工核对；达人账户不会被修改。</span>
                </div>
              ) : null}
            </div>
          </div>

          </div>
        </section>
        <div
          className="contract-builder-resizer"
          role="separator"
          aria-label="调整合同信息与预览宽度"
          aria-orientation="vertical"
          aria-valuemin={34}
          aria-valuemax={55}
          aria-valuenow={Math.round(formShare)}
          tabIndex={0}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setResizing(true);
          }}
          onKeyDown={resizeFromKeyboard}
        >
          <span />
        </div>
        <div className={`contract-builder-preview-pane ${mobileTab !== 'preview' ? 'is-mobile-hidden' : ''}`}>
          <ContractTemplatePreview
            pdfUrl={preview?.pdfUrl ?? null}
            pageCount={preview?.pageCount ?? 17}
            anchors={preview?.anchors ?? []}
            qualityReport={qualityReport ?? EMPTY_QUALITY_REPORT}
            highlightRequest={highlightRequest}
            loading={previewLoading}
            canDownloadPdf={Boolean(previewFiles?.pdfBlob || generated?.files.pdfBlob || preview?.pdfBlob)}
            canDownloadDocx={Boolean(previewFiles?.docxBlob || (!previewStale && generated?.files.docxBlob))}
            onDownloadPdf={() => download('pdf')}
            onDownloadDocx={() => download('docx')}
            onIssueSelect={focusIssue}
          />
        </div>
      </div>
      <footer className="contract-builder-actions">
        <div>
          <Button variant="ghost" onClick={onCancel}>取消</Button>
          <Button variant="secondary" icon={<Save size={16} />} disabled={generating} disabledReason="合同文件正在生成，请稍候。" onClick={saveDraft}>
            保存草稿
          </Button>
        </div>
        <div>
          <Button variant="secondary" icon={<Eye size={16} />} disabled={generating} disabledReason="合同文件正在生成，请稍候。" onClick={() => void generate('DRAFT', 'PREVIEW')}>
            生成预览
          </Button>
          <Button
            icon={<WandSparkles size={17} />}
            disabled={generating || qualityReport.hasBlockers}
            disabledReason={generating ? '合同文件正在生成，请稍候。' : '请先处理合同质量阻断项。'}
            title={qualityReport.hasBlockers ? '请先处理合同质量阻断项' : undefined}
            onClick={() => void generate('FORMAL', 'SAVE')}
          >
            {generating ? '正在生成…' : '生成正式合同'}
          </Button>
        </div>
      </footer>
    </div>
  );
}
