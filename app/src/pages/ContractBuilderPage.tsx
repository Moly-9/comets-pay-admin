import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  FileSignature,
  Plus,
  Trash2,
  UserRound,
  WalletCards,
  WandSparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
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
  contractPaymentMethodForAccount,
  contractPayoutSnapshot,
  defaultContractPayoutAccount,
  eligibleContractPayoutAccounts,
  validateContractGenerationModel,
} from '../contractGenerationModel';
import type {
  ContractGenerationModel,
  ContractRecord,
} from '../contracts';
import {
  getPayoutAccountIdentifier,
  getPayoutAccountSummary,
} from '../payoutAccounts';
import { downloadBlob } from '../invoice/invoiceUtils';
import type { CreatorProfile } from '../types';
import type { ContractTemplateFieldKey } from '../contractTemplate';
import type { ProjectSummary } from './ProjectDetailPage';

type GeneratedFiles = {
  record: ContractRecord;
  pdfBlob: Blob;
  docxBlob: Blob;
} | null;

type Props = {
  projects: ProjectSummary[];
  creators: CreatorProfile[];
  initialEngagementId?: EngagementId | null;
  onGenerated: (model: ContractGenerationModel, pdfBlob: Blob) => ContractRecord;
  onCancel: () => void;
  onOpenContractManagement: (contractId: string) => void;
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
  onGenerated,
  onCancel,
  onOpenContractManagement,
}: Props) {
  const initialContext = findInitialContext(projects, initialEngagementId);
  const initialCreator = creators.find((creator) => creator.id === initialContext?.reference.creatorId) ?? null;
  const initialAccount = defaultContractPayoutAccount(initialCreator);
  const [creatorId, setCreatorId] = useState(initialCreator?.id ?? '');
  const [engagementId, setEngagementId] = useState(initialEngagementId ?? '');
  const [contractNumber] = useState(() => createPrototypeCode('CON'));
  const [projectName, setProjectName] = useState(initialContext?.project.name ?? '');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [campaignStart, setCampaignStart] = useState('');
  const [campaignEnd, setCampaignEnd] = useState('');
  const [purposeItems, setPurposeItems] = useState<string[]>(['', '']);
  const [promotedProduct, setPromotedProduct] = useState(initialContext?.project.brand ?? '');
  const [hashtag, setHashtag] = useState('');
  const [contentFormat, setContentFormat] = useState('');
  const [releaseStart, setReleaseStart] = useState('');
  const [releaseEnd, setReleaseEnd] = useState('');
  const [language, setLanguage] = useState('');
  const [contentLength, setContentLength] = useState('');
  const [licensePeriod, setLicensePeriod] = useState('');
  const [licensePrice, setLicensePrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [totalFee, setTotalFee] = useState('');
  const [invoiceIssueWorkingDays, setInvoiceIssueWorkingDays] = useState(3);
  const [paymentWorkingDays, setPaymentWorkingDays] = useState<45 | 60>(45);
  const [feeBearer, setFeeBearer] = useState<ContractGenerationModel['feeBearer']>('ADVERTISER');
  const [payoutAccountId, setPayoutAccountId] = useState(initialAccount?.id ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generationError, setGenerationError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedFiles>(null);
  const [activeField, setActiveField] = useState<ContractTemplateFieldKey | null>(null);

  const selectedCreator = creators.find((creator) => creator.id === creatorId) ?? null;
  const creatorEngagements = useMemo(() => projects.flatMap((project) => (
    (project.creatorProfiles ?? [])
      .filter((reference) => reference.creatorId === creatorId && reference.status !== 'removed')
      .map((reference) => ({ project, reference }))
  )), [creatorId, projects]);
  const selectedContext = creatorEngagements.find((item) => item.reference.engagementId === engagementId) ?? null;
  const eligibleAccounts = eligibleContractPayoutAccounts(selectedCreator);
  const selectedAccount = eligibleAccounts.find((account) => account.id === payoutAccountId) ?? null;
  const socialAccount = selectedCreator?.socialAccounts.find((account) => (
    account.platform.toLowerCase() === selectedContext?.reference.platform.toLowerCase()
    || account.handle.toLowerCase() === selectedContext?.reference.handle.toLowerCase()
  )) ?? selectedCreator?.socialAccounts[0];
  const publisher = selectedCreator?.contact.legalName || selectedCreator?.name || '';
  const publisherAddress = selectedCreator?.contact.address ?? '';
  const platform = selectedContext?.reference.platform || socialAccount?.platform || selectedCreator?.platform || '';
  const channelName = selectedContext?.reference.handle || socialAccount?.handle || selectedCreator?.handle || '';
  const channelUrl = socialAccount?.profileUrl ?? '';
  const paymentSnapshot = contractPayoutSnapshot(selectedAccount);
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
    description: `${project.projectCode ?? project.id} · ${project.brand}`,
  }));
  const payoutOptions = eligibleAccounts.map((account) => ({
    value: account.id,
    label: `${account.nickname}${account.isDefault ? ' · 默认' : ''}`,
    description: `${getPayoutAccountSummary(account)} · ${getPayoutAccountIdentifier(account)}`,
  }));

  const model = useMemo<ContractGenerationModel>(() => ({
    templateId: 'CON-TPL-2026-KOL',
    projectId: (selectedContext?.project.projectId ?? selectedContext?.project.id ?? '') as ProjectId,
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
    payoutAccountId,
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
    payoutProvider,
    platform,
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

  const resetOutput = () => {
    setGenerated(null);
    setGenerationError('');
  };

  const selectCreator = (id: string) => {
    const creator = creators.find((item) => item.id === id) ?? null;
    const account = defaultContractPayoutAccount(creator);
    setCreatorId(id);
    setEngagementId('');
    setProjectName('');
    setPromotedProduct('');
    setPayoutAccountId(account?.id ?? '');
    setErrors({});
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

  const generate = async () => {
    const nextErrors = validateContractGenerationModel(model);
    setErrors(nextErrors);
    setGenerationError('');
    if (Object.keys(nextErrors).length) {
      const firstKey = Object.keys(nextErrors)[0];
      setActiveField(fieldKeyForError(firstKey));
      window.requestAnimationFrame(() => (
        document.querySelector(`[data-contract-field="${firstKey}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      ));
      return;
    }
    setGenerating(true);
    try {
      const { generateContractFiles } = await import('../contractGeneration');
      const files = await generateContractFiles(model);
      const record = onGenerated(model, files.pdfBlob);
      setGenerated({ record, ...files });
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
    if (!generated) return;
    downloadBlob(
      extension === 'pdf' ? generated.pdfBlob : generated.docxBlob,
      contractGenerationFilename(model, generated.record.generationVersion ?? 1, extension),
    );
  };

  const fieldProps = (field: ContractTemplateFieldKey) => ({
    onFocus: () => setActiveField(field),
  });

  return (
    <div className="page-stack contract-builder-page">
      <PageHeading
        title="生成合同"
        subtitle="从项目、达人档案和已验证收款账户带入资料，填写商业字段后生成 PDF 与可编辑 DOCX。"
        actions={<Button variant="secondary" icon={<ArrowLeft size={17} />} onClick={onCancel}>返回合同管理</Button>}
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
        <section className="invoice-generation-success" data-testid="contract-generation-success">
          <span><CheckCircle2 size={22} /></span>
          <div><strong>{generated.record.id} 已生成</strong><p>PDF 与 DOCX 使用同一份合同和账户快照，签名及签署日期保持空白。</p></div>
          <div className="invoice-generation-actions">
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => download('pdf')}>下载 PDF</Button>
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => download('docx')}>下载 DOCX</Button>
            <Button onClick={() => onOpenContractManagement(generated.record.id)}>查看合同记录</Button>
          </div>
        </section>
      ) : null}

      <div className="contract-builder-layout">
        <section className="contract-builder-form">
          <div className="invoice-builder-section">
            <header><span><UserRound size={19} /></span><div><h2>1. 达人与项目</h2><p>项目仅用于系统关联；达人主体、频道和地址来自达人档案。</p></div></header>
            <div className="invoice-form-grid">
              <div className={`invoice-form-control ${errors.creator ? 'has-error' : ''}`} data-contract-field="creator">
                <span>合作达人 *</span>
                <SelectField ariaLabel="合同合作达人" variant="form" value={creatorId} placeholder="从达人档案选择" options={creatorOptions} onChange={selectCreator} />
                <small>{errors.creator}</small>
              </div>
              <div className={`invoice-form-control ${errors.project ? 'has-error' : ''}`} data-contract-field="project">
                <span>关联项目 *</span>
                <SelectField ariaLabel="合同关联项目" variant="form" value={engagementId} placeholder={creatorId ? '选择关联项目' : '请先选择达人'} options={projectOptions} disabled={!creatorId} onChange={selectProject} />
                <small>{errors.project}</small>
              </div>
              <label className={errors.publisher ? 'has-error' : ''} data-contract-field="publisher" {...fieldProps('publisher')}><span>Publisher / 法定名称</span><input value={publisher} readOnly /><small>{errors.publisher}</small></label>
              <label className={errors.channelName ? 'has-error' : ''} data-contract-field="channelName" {...fieldProps('channelName')}><span>频道名称</span><input value={channelName} readOnly /><small>{errors.channelName}</small></label>
              <label data-contract-field="platform" {...fieldProps('platform')}><span>发布平台</span><input value={platform} readOnly /><small>{errors.platform}</small></label>
              <label className={`full-width ${errors.channelUrl ? 'has-error' : ''}`} data-contract-field="channelUrl" {...fieldProps('channelUrl')}><span>频道链接</span><input value={channelUrl} readOnly /><small>{errors.channelUrl}</small></label>
              <label className={`full-width ${errors.publisherAddress ? 'has-error' : ''}`} data-contract-field="publisherAddress" {...fieldProps('publisherAddress')}><span>Publisher 地址</span><textarea value={publisherAddress} readOnly /><small>{errors.publisherAddress}</small></label>
            </div>
          </div>

          <div className="invoice-builder-section">
            <header><span><BriefcaseBusiness size={19} /></span><div><h2>2. 项目与内容条款</h2><p>这里只填写模板黄色占位对应的活动、发布和授权字段。</p></div></header>
            <div className="invoice-form-grid">
              <label className="full-width" data-contract-field="projectName" {...fieldProps('projectName')}><span>Project Name *</span><input value={projectName} onChange={(event) => { setProjectName(event.target.value); resetOutput(); }} /></label>
              <label className={errors.effectiveDate ? 'has-error' : ''} data-contract-field="effectiveDate" {...fieldProps('effectiveDate')}><span>生效日期 *</span><input type="date" value={effectiveDate} onChange={(event) => { setEffectiveDate(event.target.value); resetOutput(); }} /><small>{errors.effectiveDate}</small></label>
              <label className={errors.campaignStart ? 'has-error' : ''} data-contract-field="campaignStart" {...fieldProps('campaignPeriod')}><span>Campaign Start *</span><input type="date" value={campaignStart} onChange={(event) => { setCampaignStart(event.target.value); resetOutput(); }} /><small>{errors.campaignStart}</small></label>
              <label className={errors.campaignEnd ? 'has-error' : ''} data-contract-field="campaignEnd" {...fieldProps('campaignPeriod')}><span>Campaign End *</span><input type="date" value={campaignEnd} onChange={(event) => { setCampaignEnd(event.target.value); resetOutput(); }} /><small>{errors.campaignEnd}</small></label>
              <div className={`contract-purpose-editor full-width ${errors.purposeItems ? 'has-error' : ''}`} data-contract-field="purposeItems" onFocus={() => setActiveField('purposeItems')}>
                <div className="invoice-line-header"><strong>推广目的 *</strong>{purposeItems.length < 3 ? <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setPurposeItems((current) => [...current, ''])}>新增一项</Button> : null}</div>
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
              <label className={errors.promotedProduct ? 'has-error' : ''} data-contract-field="promotedProduct" {...fieldProps('promotedProduct')}><span>推广产品 / 活动名称 *</span><input value={promotedProduct} onChange={(event) => { setPromotedProduct(event.target.value); resetOutput(); }} /><small>{errors.promotedProduct}</small></label>
              <label className={errors.hashtag ? 'has-error' : ''} data-contract-field="hashtag" {...fieldProps('hashtag')}><span>Hashtag *</span><input value={hashtag} placeholder="#campaign" onChange={(event) => { setHashtag(event.target.value); resetOutput(); }} /><small>{errors.hashtag}</small></label>
              <div className={`invoice-form-control ${errors.contentFormat ? 'has-error' : ''}`} data-contract-field="contentFormat" onFocus={() => setActiveField('contentFormat')}>
                <span>内容形式 *</span>
                <SelectField ariaLabel="合同内容形式" variant="form" value={contentFormat} placeholder="选择视频或直播形式" options={CONTENT_FORMAT_OPTIONS} onChange={(value) => { setContentFormat(value); resetOutput(); }} />
                <small>{errors.contentFormat}</small>
              </div>
              <label className={errors.language ? 'has-error' : ''} data-contract-field="language" {...fieldProps('language')}><span>内容语言 *</span><input value={language} placeholder="French" onChange={(event) => { setLanguage(event.target.value); resetOutput(); }} /><small>{errors.language}</small></label>
              <label className={errors.releaseStart ? 'has-error' : ''} data-contract-field="releaseStart" {...fieldProps('releasePeriod')}><span>发布开始日期 *</span><input type="date" value={releaseStart} onChange={(event) => { setReleaseStart(event.target.value); resetOutput(); }} /><small>{errors.releaseStart}</small></label>
              <label className={errors.releaseEnd ? 'has-error' : ''} data-contract-field="releaseEnd" {...fieldProps('releasePeriod')}><span>发布结束日期 *</span><input type="date" value={releaseEnd} onChange={(event) => { setReleaseEnd(event.target.value); resetOutput(); }} /><small>{errors.releaseEnd}</small></label>
              <label className={`full-width ${errors.contentLength ? 'has-error' : ''}`} data-contract-field="contentLength" {...fieldProps('contentLength')}><span>内容时长要求 *</span><textarea maxLength={320} value={contentLength} placeholder="例如：Dedicated video at least 10 minutes" onChange={(event) => { setContentLength(event.target.value); resetOutput(); }} /><small>{errors.contentLength}</small></label>
              <label data-contract-field="licensePeriod" {...fieldProps('licensePeriod')}><span>License Period（可选）</span><input value={licensePeriod} onChange={(event) => { setLicensePeriod(event.target.value); resetOutput(); }} /></label>
              <label className={errors.licensePrice ? 'has-error' : ''} data-contract-field="licensePrice" {...fieldProps('licensePrice')}><span>License Price（可选）</span><input type="number" min="0" step="0.01" value={licensePrice} onChange={(event) => { setLicensePrice(event.target.value); resetOutput(); }} /><small>{errors.licensePrice}</small></label>
            </div>
          </div>

          <div className="invoice-builder-section">
            <header><span><FileSignature size={19} /></span><div><h2>3. 商务条款</h2><p>金额与付款期限将同步写入 IO 和 Standard Terms。</p></div></header>
            <div className="invoice-form-grid">
              <div className="invoice-form-control" data-contract-field="currency" onFocus={() => setActiveField('totalFee')}><span>币种 *</span><SelectField ariaLabel="合同币种" variant="form" value={currency} options={CURRENCY_OPTIONS} onChange={(value) => { setCurrency(value); resetOutput(); }} /></div>
              <label className={errors.totalFee ? 'has-error' : ''} data-contract-field="totalFee" {...fieldProps('totalFee')}><span>Project Total Fees *</span><input type="number" min="0" step="0.01" value={totalFee} onChange={(event) => { setTotalFee(event.target.value); resetOutput(); }} /><small>{errors.totalFee}</small></label>
              <label className={errors.invoiceIssueWorkingDays ? 'has-error' : ''} data-contract-field="invoiceIssueWorkingDays" {...fieldProps('invoiceIssueWorkingDays')}><span>Invoice 开具期限 *</span><input type="number" min="1" max="30" value={invoiceIssueWorkingDays} onChange={(event) => { setInvoiceIssueWorkingDays(Number(event.target.value)); resetOutput(); }} /><small>{errors.invoiceIssueWorkingDays}</small></label>
              <div className="invoice-form-control" data-contract-field="paymentWorkingDays" onFocus={() => setActiveField('paymentWorkingDays')}><span>付款期限 *</span><SelectField ariaLabel="合同付款期限" variant="form" value={String(paymentWorkingDays)} options={PAYMENT_DAYS_OPTIONS} onChange={(value) => { setPaymentWorkingDays(Number(value) as 45 | 60); resetOutput(); }} /></div>
              <div className={`invoice-form-control full-width ${errors.feeBearer ? 'has-error' : ''}`} data-contract-field="feeBearer" onFocus={() => setActiveField('feeBearer')}><span>转账手续费承担方 *</span><SelectField ariaLabel="合同手续费承担方" variant="form" value={feeBearer} options={FEE_BEARER_OPTIONS} onChange={(value) => { setFeeBearer(value as ContractGenerationModel['feeBearer']); resetOutput(); }} /><small>{errors.feeBearer}</small></div>
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
                  <label><span>Account Name</span><input value={paymentSnapshot.accountName} readOnly /></label>
                  <label><span>Account Number</span><input value={paymentSnapshot.accountNumber} readOnly /></label>
                  <label><span>IBAN</span><input value={paymentSnapshot.iban} readOnly /></label>
                  <label><span>SWIFT Code</span><input value={paymentSnapshot.swiftCode} readOnly /></label>
                  <label className="full-width"><span>Beneficiary Bank</span><input value={paymentSnapshot.bankName} readOnly /></label>
                </>
              ) : selectedAccount?.provider === 'PayPal' ? (
                <>
                  <label><span>PayPal Name</span><input value={paymentSnapshot.paypalUsername} readOnly /></label>
                  <label><span>PayPal Email</span><input value={paymentSnapshot.paypalEmail} readOnly /></label>
                </>
              ) : (
                <div className="contract-account-empty full-width">达人档案没有可用于合同的已验证 Airwallex 或 PayPal 账户。</div>
              )}
            </div>
          </div>

          <div className="invoice-builder-footer">
            <Button variant="ghost" onClick={onCancel}>取消</Button>
            <Button icon={<WandSparkles size={17} />} disabled={generating} onClick={() => void generate()}>
              {generating ? '正在生成…' : '生成 PDF + DOCX'}
            </Button>
          </div>
        </section>
        <ContractTemplatePreview model={model} activeField={activeField} />
      </div>
    </div>
  );
}
