import {
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
  type CreatorId,
  type EngagementId,
  type ProjectId,
} from '../businessWorkflow';
import { Button, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { ContractTemplatePreview } from '../components/ContractTemplatePreview';
import { contractGenerationFilename } from '../contractGenerationFilename';
import {
  contractPublishingChannelsForCreator,
  contractPaymentMethodForAccount,
  contractPayoutSnapshot,
  defaultContractPayoutAccount,
  eligibleContractPayoutAccounts,
  formatContractPublishingChannelLinks,
  formatContractPublishingPlatforms,
  validateContractGenerationModel,
} from '../contractGenerationModel';
import type {
  ContractGeneratedFiles,
  ContractGenerationModel,
  ContractPublishingChannel,
  ContractQualityIssue,
  ContractQualityReport,
  ContractRecord,
  ContractTemplateFieldKey,
} from '../contracts';
import {
  getPayoutAccountIdentifier,
  getPayoutAccountId,
  getPayoutAccountSummary,
} from '../payoutAccounts';
import { downloadBlob } from '../invoice/invoiceUtils';
import type { CreatorProfile } from '../types';
import { createContractQualityReport } from '../contractTemplate';
import type { ProjectSummary } from './ProjectDetailPage';

type GeneratedFiles = {
  record: ContractRecord;
  files: ContractGeneratedFiles;
} | null;

type Props = {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  initialEngagementId?: EngagementId | null;
  existingDraft?: ContractRecord | null;
  onGenerated: (model: ContractGenerationModel, files: ContractGeneratedFiles) => ContractRecord;
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

const findInitialContext = (
  projects: ProjectSummary[],
  engagementId?: EngagementId | null,
) => projects
  .flatMap((project) => (project.creatorProfiles ?? []).map((reference) => ({ project, reference })))
  .find((item) => item.reference.engagementId === engagementId);

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

export function ContractBuilderPage({
  projects,
  creators,
  initialEngagementId,
  existingDraft,
  onGenerated,
  onCancel,
  onOpenContractManagement,
}: Props) {
  const draftModel = existingDraft?.generationSnapshot;
  const initialContext = findInitialContext(projects, initialEngagementId);
  const initialCreator = creators.find((creator) => (
    creator.id === (draftModel?.creatorId ?? initialContext?.reference.creatorId)
  )) ?? null;
  const initialAccount = defaultContractPayoutAccount(initialCreator);
  const initialPublishingChannels = contractPublishingChannelsForCreator(initialCreator, draftModel);
  const [creatorId, setCreatorId] = useState(draftModel?.creatorId ?? initialCreator?.id ?? '');
  const [engagementId, setEngagementId] = useState(draftModel?.engagementId ?? initialEngagementId ?? '');
  const [contractNumber] = useState(() => existingDraft?.id ?? createPrototypeCode('CON'));
  const [projectName, setProjectName] = useState(draftModel?.projectName ?? initialContext?.project.name ?? '');
  const [effectiveDate, setEffectiveDate] = useState(draftModel?.effectiveDate ?? '');
  const [campaignStart, setCampaignStart] = useState(draftModel?.campaignStart ?? '');
  const [campaignEnd, setCampaignEnd] = useState(draftModel?.campaignEnd ?? '');
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

  const selectedCreator = creators.find((creator) => creator.id === creatorId) ?? null;
  const creatorEngagements = useMemo(() => projects.flatMap((project) => (
    (project.creatorProfiles ?? [])
      .filter((reference) => reference.creatorId === creatorId && reference.status !== 'removed')
      .map((reference) => ({ project, reference }))
  )), [creatorId, projects]);
  const selectedContext = creatorEngagements.find((item) => item.reference.engagementId === engagementId) ?? null;
  const eligibleAccounts = eligibleContractPayoutAccounts(selectedCreator);
  const selectedAccount = eligibleAccounts.find((account) => (
    account.id === payoutAccountId || getPayoutAccountId(account) === payoutAccountId
  )) ?? null;
  const primarySocialAccount = selectedCreator?.socialAccounts.find((account) => (
    account.platform.toLowerCase() === selectedContext?.reference.platform.toLowerCase()
    || account.handle.toLowerCase() === selectedContext?.reference.handle.toLowerCase()
  )) ?? selectedCreator?.socialAccounts[0];
  const publisher = selectedCreator?.contact.legalName ?? '';
  const publisherAddress = selectedCreator?.contact.address ?? '';
  const publishingChannelValues = {
    publishingChannels,
    platform: '',
    channelUrl: '',
  };
  const platform = formatContractPublishingPlatforms(publishingChannelValues);
  const channelName = selectedContext?.reference.handle || primarySocialAccount?.handle || selectedCreator?.handle || '';
  const channelUrl = formatContractPublishingChannelLinks(publishingChannelValues);
  const paymentSnapshot = useMemo(
    () => contractPayoutSnapshot(selectedAccount, selectedCreator?.id),
    [selectedAccount, selectedCreator?.id],
  );
  const paymentMethod = contractPaymentMethodForAccount(selectedAccount);
  const payoutProvider = selectedAccount?.provider === 'PayPal' ? 'PayPal' : 'Airwallex';

  const creatorOptions = creators.map((creator) => ({
    value: creator.id,
    label: creator.name,
    description: `${creator.handle} · ${creator.region} · ${creator.platform}`,
  }));
  const projectOptions = creatorEngagements.map(({ project, reference }) => ({
    value: reference.engagementId,
    label: project.name,
    description: `${project.cooperationProjectCode ?? project.projectCode ?? project.id} · ${project.brand} · 飞书合作项目`,
  }));
  const payoutOptions = eligibleAccounts.map((account) => ({
    value: getPayoutAccountId(account),
    label: `${account.nickname}${account.isDefault ? ' · 默认' : ''}`,
    description: `${getPayoutAccountSummary(account)} · ${getPayoutAccountIdentifier(account)}`,
  }));

  const model = useMemo<ContractGenerationModel>(() => ({
    templateId: 'CON-TPL-2026-KOL',
    projectId: (
      selectedContext?.project.cooperationProjectId
      ?? selectedContext?.project.projectId
      ?? selectedContext?.project.id
      ?? ''
    ) as ProjectId,
    cooperationProjectId: (
      selectedContext?.project.cooperationProjectId
      ?? selectedContext?.project.projectId
      ?? selectedContext?.project.id
      ?? ''
    ) as ProjectId,
    projectName,
    brandName: selectedContext?.project.brand ?? '',
    creatorId: (selectedCreator?.id ?? '') as CreatorId,
    creatorName: selectedCreator?.name ?? '',
    creatorHandle: selectedCreator?.handle ?? '',
    engagementId: engagementId as EngagementId,
    contractNumber,
    ioNumber: '',
    advertiser: 'Comets International Limited',
    publisher,
    publisherAddress,
    platform,
    channelName,
    channelUrl,
    publishingChannels,
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
    campaignEnd,
    campaignStart,
    channelName,
    channelUrl,
    contentFormat,
    contentLength,
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
    publishingChannels,
    projectName,
    promotedProduct,
    publisher,
    publisherAddress,
    purposeItems,
    releaseEnd,
    releaseStart,
    selectedContext,
    selectedCreator,
    totalFee,
  ]);

  const qualityReport = useMemo(
    () => createContractQualityReport(model),
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
    const generation = previewGenerationRef.current + 1;
    previewGenerationRef.current = generation;
    setPreviewLoading(true);
    const timer = window.setTimeout(() => {
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
    return () => window.clearTimeout(timer);
  }, [model]);

  const selectCreator = (id: string) => {
    const creator = creators.find((item) => item.id === id) ?? null;
    const account = defaultContractPayoutAccount(creator);
    setCreatorId(id);
    setEngagementId('');
    setProjectName('');
    setPromotedProduct('');
    setPayoutAccountId(account?.id ?? '');
    setPublishingChannels(contractPublishingChannelsForCreator(creator));
    setErrors({});
    resetOutput();
  };

  const updatePublishingChannel = (
    index: number,
    key: 'platform' | 'channelUrl',
    value: string,
  ) => {
    setPublishingChannels((current) => current.map((channel, channelIndex) => (
      channelIndex === index ? { ...channel, [key]: value } : channel
    )));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    resetOutput();
  };

  const selectProject = (id: string) => {
    const context = creatorEngagements.find((item) => item.reference.engagementId === id);
    setEngagementId(id);
    setProjectName(context?.project.name ?? '');
    setPromotedProduct(context?.project.brand ?? '');
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
    const nextErrors = variant === 'FORMAL' ? validateContractGenerationModel(model) : {};
    setErrors(nextErrors);
    setGenerationError('');
    const currentReport = createContractQualityReport(model);
    if (variant === 'FORMAL' && (Object.keys(nextErrors).length || currentReport.hasBlockers)) {
      const firstKey = Object.keys(nextErrors)[0];
      const firstIssue = currentReport.issues.find((issue) => issue.severity === 'BLOCKER');
      if (firstKey) {
        const fieldKey = fieldKeyForError(firstKey);
        if (fieldKey) focusField(fieldKey, firstKey);
      } else if (firstIssue) {
        focusIssue(firstIssue);
      }
      return;
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

  const download = (extension: 'pdf' | 'docx') => {
    const files = previewFiles ?? (!previewStale ? generated?.files : null);
    const blob = extension === 'pdf' ? files?.pdfBlob ?? preview?.pdfBlob : files?.docxBlob;
    if (!blob) return;
    downloadBlob(
      blob,
      contractGenerationFilename(model, generated?.record.generationVersion ?? 1, extension),
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
        <PageHeading
          title="生成合同"
          subtitle="从项目、达人档案和已验证收款账户带入资料，可按需补充商业字段后生成 PDF 与可编辑 DOCX。"
          actions={<Button variant="secondary" icon={<ArrowLeft size={17} />} title="返回合同管理" onClick={onCancel}>返回合同管理</Button>}
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
              <strong>{previewStale ? '草稿预览已过期' : `${generated.record.id} 已${generated.files.variant === 'FORMAL' ? '正式生成' : '保存草稿'}`}</strong>
              <p>{previewStale ? '表单已修改，请重新生成预览或保存。' : 'PDF 与 DOCX 使用同一份合同和账户快照，签名及签署日期保持空白。'}</p>
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
          <div className="invoice-builder-section">
            <header><span><UserRound size={19} /></span><div><h2>1. 达人与项目</h2><p>项目仅用于系统关联；达人主体、频道和地址来自达人档案。</p></div></header>
            <div className="invoice-form-grid">
              <div className={`invoice-form-control ${errors.creator ? 'has-error' : ''}`} data-contract-field="creator">
                <span>合作达人 *</span>
                <SelectField ariaLabel="合同合作达人" variant="form" value={creatorId} placeholder="从达人档案选择" options={creatorOptions} onChange={selectCreator} />
                <small>{errors.creator}</small>
              </div>
              <div className={`invoice-form-control ${errors.project ? 'has-error' : ''}`} data-contract-field="project">
                <span>合作项目 *</span>
                <SelectField ariaLabel="合同合作项目" variant="form" value={engagementId} placeholder={creatorId ? '选择合作项目' : '请先选择达人'} options={projectOptions} disabled={!creatorId} onChange={selectProject} />
                <small>{errors.project}</small>
              </div>
              <label className={errors.publisher ? 'has-error' : ''} data-contract-field="publisher" {...fieldProps('publisher')}><span>Publisher / 法定名称 *</span><input value={publisher} readOnly /><small>{errors.publisher}</small></label>
              <label className={errors.channelName ? 'has-error' : ''} data-contract-field="channelName" {...fieldProps('channelName')}><span>频道名称 *</span><input value={channelName} readOnly /><small>{errors.channelName}</small></label>
              <div
                className={`contract-publishing-channels full-width ${errors.platform || errors.channelUrl ? 'has-error' : ''}`}
                data-contract-field="platform"
                onFocus={() => setActiveField('platform')}
              >
                <div className="contract-publishing-channels-head">
                  <strong>发布频道 *</strong>
                  <span>从达人档案带入，可仅修改本次合同快照</span>
                </div>
                <div className="contract-publishing-channels-grid" data-contract-field="channelUrl">
                  <span>发布平台 *</span>
                  <span>频道链接 *</span>
                  {(publishingChannels.length ? publishingChannels : [{
                    socialAccountId: '',
                    platform: '',
                    channelUrl: '',
                  }]).map((channel, index) => (
                    <div className="contract-publishing-channel-row" key={channel.socialAccountId || 'empty-channel'}>
                      <label>
                        <span className="sr-only">{`发布平台 ${index + 1}`}</span>
                        <input
                          aria-label={`发布平台 ${index + 1}`}
                          value={channel.platform}
                          placeholder="例如：YouTube"
                          disabled={!selectedCreator}
                          onFocus={() => setActiveField('platform')}
                          onChange={(event) => updatePublishingChannel(index, 'platform', event.target.value)}
                        />
                      </label>
                      <label>
                        <span className="sr-only">{`频道链接 ${index + 1}`}</span>
                        <input
                          type="url"
                          aria-label={`频道链接 ${index + 1}`}
                          value={channel.channelUrl}
                          placeholder="https://"
                          disabled={!selectedCreator}
                          onFocus={() => setActiveField('channelUrl')}
                          onChange={(event) => updatePublishingChannel(index, 'channelUrl', event.target.value)}
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <small>{errors.platform || errors.channelUrl}</small>
              </div>
              <label className={`full-width ${errors.publisherAddress ? 'has-error' : ''}`} data-contract-field="publisherAddress" {...fieldProps('publisherAddress')}><span>Publisher 地址 *</span><textarea value={publisherAddress} readOnly /><small>{errors.publisherAddress}</small></label>
            </div>
          </div>

          <div className="invoice-builder-section">
            <header><span><BriefcaseBusiness size={19} /></span><div><h2>2. 项目与内容条款</h2><p>以下字段均为非必填，填写后写入合同模板。</p></div></header>
            <div className="invoice-form-grid">
              <label className="full-width" data-contract-field="projectName" {...fieldProps('projectName')}><span>Project Name</span><input value={projectName} onChange={(event) => { setProjectName(event.target.value); resetOutput(); }} /></label>
              <label className={errors.effectiveDate ? 'has-error' : ''} data-contract-field="effectiveDate" {...fieldProps('effectiveDate')}><span>生效日期</span><input type="date" value={effectiveDate} onChange={(event) => { setEffectiveDate(event.target.value); resetOutput(); }} /><small>{errors.effectiveDate}</small></label>
              <label className={errors.campaignStart ? 'has-error' : ''} data-contract-field="campaignStart" {...fieldProps('campaignPeriod')}><span>Campaign Start</span><input type="date" value={campaignStart} onChange={(event) => { setCampaignStart(event.target.value); resetOutput(); }} /><small>{errors.campaignStart}</small></label>
              <label className={errors.campaignEnd ? 'has-error' : ''} data-contract-field="campaignEnd" {...fieldProps('campaignPeriod')}><span>Campaign End</span><input type="date" value={campaignEnd} onChange={(event) => { setCampaignEnd(event.target.value); resetOutput(); }} /><small>{errors.campaignEnd}</small></label>
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

          <div className="invoice-builder-section">
            <header><span><FileSignature size={19} /></span><div><h2>3. 商务条款</h2><p>以下字段均为非必填；保留默认值或填写后将写入合同模板。</p></div></header>
            <div className="invoice-form-grid">
              <div className={`invoice-form-control ${errors.currency ? 'has-error' : ''}`} data-contract-field="currency" onFocus={() => setActiveField('totalFee')}><span>币种</span><SelectField ariaLabel="合同币种" variant="form" value={currency} options={CURRENCY_OPTIONS} onChange={(value) => { setCurrency(value); resetOutput(); }} /><small>{errors.currency}</small></div>
              <label className={errors.totalFee ? 'has-error' : ''} data-contract-field="totalFee" {...fieldProps('totalFee')}><span>Project Total Fees</span><input type="number" min="0" step="0.01" value={totalFee} onChange={(event) => { setTotalFee(event.target.value); resetOutput(); }} /><small>{errors.totalFee}</small></label>
              <label className={errors.invoiceIssueWorkingDays ? 'has-error' : ''} data-contract-field="invoiceIssueWorkingDays" {...fieldProps('invoiceIssueWorkingDays')}><span>Invoice 开具期限</span><input type="number" min="1" max="30" value={invoiceIssueWorkingDays} onChange={(event) => { setInvoiceIssueWorkingDays(Number(event.target.value)); resetOutput(); }} /><small>{errors.invoiceIssueWorkingDays}</small></label>
              <div className="invoice-form-control" data-contract-field="paymentWorkingDays" onFocus={() => setActiveField('paymentWorkingDays')}><span>付款期限</span><SelectField ariaLabel="合同付款期限" variant="form" value={String(paymentWorkingDays)} options={PAYMENT_DAYS_OPTIONS} onChange={(value) => { setPaymentWorkingDays(Number(value) as 45 | 60); resetOutput(); }} /></div>
              <div className={`invoice-form-control full-width ${errors.feeBearer ? 'has-error' : ''}`} data-contract-field="feeBearer" onFocus={() => setActiveField('feeBearer')}><span>转账手续费承担方</span><SelectField ariaLabel="合同手续费承担方" variant="form" value={feeBearer} options={FEE_BEARER_OPTIONS} onChange={(value) => { setFeeBearer(value as ContractGenerationModel['feeBearer']); resetOutput(); }} /><small>{errors.feeBearer}</small></div>
            </div>
          </div>

          <div className="invoice-builder-section">
            <header><span><WalletCards size={19} /></span><div><h2>4. 收款账户快照</h2><p>仅可选择达人档案中已验证的 Airwallex 或 PayPal 账户。</p></div></header>
            <div className="invoice-form-grid">
              <div className={`invoice-form-control full-width ${errors.payoutAccountId ? 'has-error' : ''}`} data-contract-field="payoutAccountId" onFocus={() => setActiveField('payoutAccount')}>
                <span>合同收款账户 *</span>
                <SelectField ariaLabel="合同收款账户" variant="form" value={payoutAccountId} placeholder={selectedCreator ? '没有可用的已验证账户' : '请先选择达人'} options={payoutOptions} disabled={!selectedCreator || !payoutOptions.length} onChange={(value) => { setPayoutAccountId(value); resetOutput(); }} />
                <small>{errors.payoutAccountId}</small>
              </div>
              {selectedAccount?.provider === 'Airwallex' ? (
                <>
                  <label><span>Account Name *</span><input value={paymentSnapshot.accountName} readOnly /></label>
                  <label><span>Account Number *（与 IBAN 至少一项）</span><input value={paymentSnapshot.accountNumber} readOnly /></label>
                  <label><span>IBAN *（与账号至少一项）</span><input value={paymentSnapshot.iban} readOnly /></label>
                  <label><span>SWIFT Code</span><input value={paymentSnapshot.swiftCode} readOnly /></label>
                  <label className="full-width"><span>Beneficiary Bank *</span><input value={paymentSnapshot.bankName} readOnly /></label>
                </>
              ) : selectedAccount?.provider === 'PayPal' ? (
                <>
                  <label><span>PayPal Name *</span><input value={paymentSnapshot.paypalUsername} readOnly /></label>
                  <label><span>PayPal Email *</span><input value={paymentSnapshot.paypalEmail} readOnly /></label>
                </>
              ) : (
                <div className="contract-account-empty full-width">达人档案没有可用于合同的已验证 Airwallex 或 PayPal 账户。</div>
              )}
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
          <Button variant="secondary" icon={<Save size={16} />} disabled={generating} onClick={() => void generate('DRAFT', 'SAVE')}>
            保存草稿
          </Button>
        </div>
        <div>
          <Button variant="secondary" icon={<Eye size={16} />} disabled={generating} onClick={() => void generate('DRAFT', 'PREVIEW')}>
            生成预览
          </Button>
          <Button
            icon={<WandSparkles size={17} />}
            disabled={generating || qualityReport.hasBlockers}
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
