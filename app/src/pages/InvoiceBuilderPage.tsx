import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  WalletCards,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { InvoiceDocumentView } from '../components/InvoiceDocumentView';
import { SearchableComboBox } from '../components/SearchableComboBox';
import { CreatorIdentity } from '../components/CreatorIdentity';
import {
  creatorSearchOption,
  resolveCreatorSocialAccount,
} from '../creatorSearchOptions';
import {
  createPrototypeId,
  type CreatorId,
  type ContractId,
  type EngagementId,
  type InvoiceId,
  type ProjectId,
} from '../businessWorkflow';
import { contractLinkedToProject, formatContractMoney, isContractAvailableForNewAssociation, type ContractRecord } from '../contracts';
import {
  downloadBlob,
  formatInvoiceMoney,
  invoiceFilename,
  invoiceTotal,
  nextInvoiceNumber,
  normalizeLineItem,
  todayInputValue,
} from '../invoice/invoiceUtils';
import {
  validateInvoiceDocumentModel,
} from '../invoice/invoiceDraft';
import {
  createInvoiceContractMatchReview,
  currentInvoiceContractMatchReview,
  evaluateInvoiceContractMatch,
  invoiceContractMatchFingerprint,
  type InvoiceContractMatchActor,
} from '../invoice/invoiceContractMatching';
import { createInvoiceBuilderPrototypeSeed } from '../invoice/invoiceBuilderPrototype';
import { accountDisplayValue } from '../accountPresentation';
import {
  defaultInvoiceBillingEntity,
  findInvoiceBillingEntityForSnapshot,
  invoiceEntitySnapshot,
} from '../invoice/invoiceBillingEntities';
import {
  invoiceDocumentChanged,
} from '../invoice/invoiceReviewWorkflow';
import {
  eligibleInvoicePayoutAccounts,
  getPayoutAccountId,
  getPayoutAccountIdentifier,
  getPayoutAccountVersion,
  getPayoutAccountStatusMeta,
  getPayoutAccountSummary,
  invoicePaymentMethodForProvider,
  invoicePaymentForCreator,
  payoutAccountToInvoicePayment,
} from '../payoutAccounts';
import {
  cooperationProjectIdFor,
  findExistingEngagementId,
} from '../paymentRequestProjects';
import type {
  CreatorInvoiceContact,
  CreatorProfile,
  DocumentPayoutSnapshot,
  GeneratedInvoiceRecord,
  InvoiceBillingSettings,
  InvoiceContractMatchReview,
  InvoiceCurrency,
  InvoiceDocumentModel,
  InvoiceEditContext,
  InvoiceEntity,
  InvoiceLineItem,
  Payout,
} from '../types';
import type { ProjectSummary } from './ProjectDetailPage';

type InvoiceBuilderPageProps = {
  creators: CreatorProfile[];
  payouts: Payout[];
  projects: ProjectSummary[];
  contracts: ContractRecord[];
  invoiceBillingSettings: InvoiceBillingSettings;
  generatedInvoices: GeneratedInvoiceRecord[];
  onGenerated?: (record: GeneratedInvoiceRecord) => void;
  editRecord?: GeneratedInvoiceRecord;
  editContext?: InvoiceEditContext;
  allowPayoutAccountChange?: boolean;
  contractMatchActor?: InvoiceContractMatchActor;
  onEdited?: (
    snapshot: InvoiceDocumentModel,
    contractMatchReview: InvoiceContractMatchReview,
  ) => GeneratedInvoiceRecord;
  onDirtyChange?: (dirty: boolean) => void;
  onCancel: () => void;
  onOpenInvoiceManagement: () => void;
  onPublishGenerated?: (record: GeneratedInvoiceRecord) => boolean;
  initialEngagementId?: EngagementId | null;
};

type GeneratedFiles = {
  record: GeneratedInvoiceRecord;
  pdfBlob: Blob;
  docxBlob: Blob;
} | null;

const EMPTY_CONTACT: CreatorInvoiceContact = { legalName: '', address: '', phone: '', email: '' };
const EMPTY_PAYMENT: DocumentPayoutSnapshot = {
  bankCountry: '',
  accountName: '',
  accountType: '',
  swiftCode: '',
  accountNumber: '',
  iban: '',
  beneficiaryType: '',
  bankName: '',
  bankStreetAddress: '',
  bankCity: '',
  bankState: '',
  bankPostalCode: '',
  intermediaryBankCountry: '',
  intermediaryBankCode: '',
  transferRemarks: '',
  paypalUsername: '',
  paypalEmail: '',
};

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD', description: '美元' },
  { value: 'EUR', label: 'EUR', description: '欧元' },
  { value: 'GBP', label: 'GBP', description: '英镑' },
  { value: 'HKD', label: 'HKD', description: '港币' },
  { value: 'SGD', label: 'SGD', description: '新加坡元' },
] as const;

const createBlankLine = (index: number): InvoiceLineItem => ({
  id: `${createPrototypeId('item')}-${index}`,
  description: '',
  unitPrice: 0,
  quantity: 0,
  lineTotal: 0,
});

export const invoiceCreatorSearchOption = (creator: CreatorProfile) => ({
  ...creatorSearchOption(creator),
  selectedLabel: creator.name,
});

export function InvoiceBuilderPage({
  creators,
  payouts,
  projects,
  contracts,
  invoiceBillingSettings,
  generatedInvoices,
  onGenerated,
  editRecord,
  editContext,
  allowPayoutAccountChange = false,
  contractMatchActor,
  onEdited,
  onDirtyChange,
  onCancel,
  onOpenInvoiceManagement,
  onPublishGenerated,
  initialEngagementId,
}: InvoiceBuilderPageProps) {
  const isEditing = Boolean(editRecord && editContext);
  const editSnapshot = editRecord?.snapshot;
  const defaultBillingEntity = defaultInvoiceBillingEntity(invoiceBillingSettings)!;
  const matchedBillingEntity = findInvoiceBillingEntityForSnapshot(
    invoiceBillingSettings,
    editSnapshot?.billTo,
  );
  const historicalBillingEntityValue = '__current_invoice_snapshot__';
  const initialInvoiceDate = editSnapshot?.invoiceDate ?? todayInputValue();
  const initialContext = projects
    .flatMap((project) => (project.creatorProfiles ?? []).map((reference) => ({ project, reference })))
    .find((item) => item.reference.engagementId === (editSnapshot?.engagementId ?? initialEngagementId));
  const initialCreator = creators.find((creator) => (
    creator.id === (editSnapshot?.creatorId ?? initialContext?.reference.creatorId)
  ));
  const initialSocialAccount = resolveCreatorSocialAccount(
    initialCreator,
    editSnapshot?.creatorSocialAccountId ?? initialContext?.reference.socialAccountId,
    editSnapshot?.creatorHandle ?? initialContext?.reference.handle,
    editSnapshot?.creatorPlatform ?? initialContext?.reference.platform,
  );
  const initialProjectId = editSnapshot?.cooperationProjectId
    ?? editSnapshot?.projectId
    ?? (initialContext ? cooperationProjectIdFor(initialContext.project) : '');
  const initialEligiblePayoutAccounts = eligibleInvoicePayoutAccounts(initialCreator);
  const initialPayoutAccountId = editSnapshot?.payoutAccountId
    ?? editSnapshot?.payment.payoutAccountId;
  const initialPayoutProvider = editSnapshot?.payment.payoutProvider
    ?? editSnapshot?.payoutProvider
    ?? (editSnapshot?.paymentMethod === 'paypal' ? 'PayPal' : editSnapshot ? 'Airwallex' : undefined);
  const initialPayoutAccount = initialCreator
    ? initialEligiblePayoutAccounts.find((account) => (
        getPayoutAccountId(account) === initialPayoutAccountId
      ))
      ?? initialEligiblePayoutAccounts.find((account) => account.provider === initialPayoutProvider)
      ?? initialEligiblePayoutAccounts.find((account) => account.isDefault)
      ?? initialEligiblePayoutAccounts[0]
      ?? null
    : null;
  const [creatorId, setCreatorId] = useState(initialCreator?.id ?? editSnapshot?.creatorId ?? '');
  const [creatorSocialAccountId, setCreatorSocialAccountId] = useState(
    editSnapshot?.creatorSocialAccountId ?? initialSocialAccount?.id ?? '',
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [engagementId, setEngagementId] = useState(editSnapshot?.engagementId ?? initialEngagementId ?? '');
  const [draftEngagementIds] = useState<Record<string, EngagementId>>(() => Object.fromEntries(
    projects.flatMap((project) => creators.map((creator) => {
      const projectId = cooperationProjectIdFor(project);
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
  const [contractIds, setContractIds] = useState<ContractId[]>(() => (
    editSnapshot?.contractIds ? [...editSnapshot.contractIds] : []
  ));
  const [invoiceDate, setInvoiceDate] = useState(initialInvoiceDate);
  const [invoiceNumber, setInvoiceNumber] = useState(() => (
    editSnapshot?.invoiceNumber ?? nextInvoiceNumber(generatedInvoices, initialInvoiceDate)
  ));
  const [prototypePayoutId] = useState(() => createPrototypeId('payout'));
  const [selectedBillingEntityId, setSelectedBillingEntityId] = useState<string>(
    matchedBillingEntity?.id
      ?? (editSnapshot ? historicalBillingEntityValue : defaultBillingEntity.id),
  );
  const [billTo, setBillTo] = useState<InvoiceEntity>(
    editSnapshot ? { ...editSnapshot.billTo } : invoiceEntitySnapshot(defaultBillingEntity),
  );
  const [from, setFrom] = useState<CreatorInvoiceContact>(
    editSnapshot
      ? { ...editSnapshot.from }
      : initialCreator
        ? { ...initialCreator.contact }
        : { ...EMPTY_CONTACT },
  );
  const [currency, setCurrency] = useState<InvoiceCurrency>(editSnapshot?.currency ?? 'USD');
  const [items, setItems] = useState<InvoiceLineItem[]>(() => (
    editSnapshot
      ? editSnapshot.items.map((item) => ({ ...item }))
      : [createBlankLine(0)]
  ));
  const [payment, setPayment] = useState<DocumentPayoutSnapshot>(
    editSnapshot
      ? { ...editSnapshot.payment }
      : initialPayoutAccount
        ? payoutAccountToInvoicePayment(initialPayoutAccount, initialCreator?.id)
        : { ...EMPTY_PAYMENT },
  );
  const [payoutAccountId, setPayoutAccountId] = useState(
    editSnapshot?.payoutAccountId
    ?? (initialPayoutAccount ? getPayoutAccountId(initialPayoutAccount) : ''),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFiles>(null);
  const initialContractMatchReason = editRecord
    ? currentInvoiceContractMatchReview(editRecord)?.reason ?? ''
    : '';
  const [contractMatchReason, setContractMatchReason] = useState(initialContractMatchReason);
  const prototypeSeed = useMemo(() => createInvoiceBuilderPrototypeSeed({
    creators,
    payouts,
    projects,
    contracts,
    generatedInvoices,
  }), [contracts, creators, generatedInvoices, payouts, projects]);

  const selectedCreator = creators.find((creator) => creator.id === creatorId) ?? null;
  const selectedSocialAccount = resolveCreatorSocialAccount(
    selectedCreator,
    creatorSocialAccountId,
    editSnapshot?.creatorHandle,
    editSnapshot?.creatorPlatform,
  );
  const creatorSelectionValue = creatorId;
  const eligiblePayoutAccounts = eligibleInvoicePayoutAccounts(selectedCreator);
  const payoutAccountOptions = eligiblePayoutAccounts.map((account) => ({
    value: getPayoutAccountId(account),
    label: `${account.nickname}${account.isDefault ? ' · 默认' : ''}`,
    description: [
      getPayoutAccountSummary(account),
      accountDisplayValue(getPayoutAccountIdentifier(account)),
      getPayoutAccountVersion(account),
      getPayoutAccountStatusMeta(account.status, account.provider).label,
    ].join(' · '),
  }));
  const requiresPayoutAccountSelection = editContext === 'PAYMENT_FAILURE_CONTENT';
  const selectedProject = projects.find((project) => (
    cooperationProjectIdFor(project) === selectedProjectId
  )) ?? null;
  const selectedPayout = selectedCreator && selectedProject
    ? payouts.find((payout) => (
        payout.creatorId === selectedCreator.id
        && payout.projectId === (selectedProject.cooperationProjectId ?? selectedProject.projectId ?? selectedProject.id)
      )) ?? null
    : null;
  const selectableContracts = contracts.filter((contract) => (
    contract.creatorId === creatorId
    && contractLinkedToProject(contract, selectedProjectId)
    && (
      isContractAvailableForNewAssociation(contract)
      || Boolean(contract.contractId && contractIds.includes(contract.contractId))
    )
    && Boolean(contract.contractId)
  ));
  const selectedContracts = selectableContracts.filter((contract) => (
    contract.contractId && contractIds.includes(contract.contractId)
  ));
  const creatorOptions = creators.map(invoiceCreatorSearchOption);
  const projectOptions = projects.map((project) => ({
    value: cooperationProjectIdFor(project),
    label: project.name,
    description: `${project.cooperationProjectCode ?? project.projectCode ?? project.id} · ${project.brand} · 飞书合作项目`,
  }));
  const billingEntityOptions = [
    ...(!matchedBillingEntity && editSnapshot ? [{
      value: historicalBillingEntityValue,
      label: editSnapshot.billTo.name || '当前 Invoice 快照',
      description: editSnapshot.billTo.address || '地址待补充',
      badges: [{ label: '历史快照', tone: 'warning' as const }],
    }] : []),
    ...invoiceBillingSettings.entities.map((entity) => ({
      value: entity.id,
      label: entity.name,
      description: entity.address,
      badges: entity.id === invoiceBillingSettings.defaultEntityId
        ? [{ label: '默认', tone: 'success' as const }]
        : undefined,
    })),
  ];
  const selectedPayoutAccount = eligiblePayoutAccounts.find((account) => (
    getPayoutAccountId(account) === payoutAccountId
  )) ?? null;
  const resolvedPayoutProvider = selectedPayoutAccount?.provider
    ?? payment.payoutProvider
    ?? editSnapshot?.payoutProvider;
  const paymentMethod = invoicePaymentMethodForProvider(
    resolvedPayoutProvider,
    editSnapshot?.paymentMethod ?? 'bank',
  );
  const paymentMethodDisplay = payoutAccountId
    ? paymentMethod === 'paypal' ? 'PayPal' : 'Bank Transfer'
    : '待选择付款账户';

  const model = useMemo<InvoiceDocumentModel>(() => ({
    invoiceNumber,
    invoiceDate,
    billTo,
    creatorHandle: isEditing
      ? editSnapshot?.creatorHandle ?? ''
      : selectedSocialAccount?.handle ?? selectedCreator?.handle ?? '',
    creatorSocialAccountId: isEditing
      ? editSnapshot?.creatorSocialAccountId
      : selectedSocialAccount?.id,
    creatorPlatform: isEditing
      ? editSnapshot?.creatorPlatform
      : selectedSocialAccount?.platform ?? selectedCreator?.platform,
    creatorName: isEditing ? editSnapshot?.creatorName ?? '' : selectedCreator?.name ?? '',
    creatorId: isEditing
      ? editSnapshot?.creatorId
      : selectedCreator?.id as CreatorId | undefined,
    engagementId: engagementId ? engagementId as EngagementId : undefined,
    projectId: isEditing
      ? editSnapshot?.projectId ?? '' as ProjectId
      : selectedProject
        ? (selectedProject.cooperationProjectId ?? selectedProject.projectId ?? selectedProject.id) as ProjectId
        : '' as ProjectId,
    cooperationProjectId: isEditing
      ? editSnapshot?.cooperationProjectId ?? editSnapshot?.projectId
      : selectedProject
        ? (selectedProject.cooperationProjectId ?? selectedProject.projectId ?? selectedProject.id) as ProjectId
        : '' as ProjectId,
    projectName: isEditing ? editSnapshot?.projectName ?? '' : selectedProject?.name ?? '',
    contractIds,
    from,
    currency,
    items: items.map(normalizeLineItem),
    payoutAccountId: (payment.payoutAccountId ?? payoutAccountId) || undefined,
    payoutAccountVersion: payment.payoutAccountVersion,
    payoutProvider: payment.payoutProvider
      ?? (paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex'),
    payoutAccountFingerprint: payment.accountFingerprint,
    paymentMethod,
    payment,
  }), [billTo, contractIds, currency, editSnapshot, engagementId, from, invoiceDate, invoiceNumber, isEditing, items, payment, paymentMethod, payoutAccountId, selectedCreator, selectedProject, selectedSocialAccount]);
  const contractMatch = useMemo(() => evaluateInvoiceContractMatch(
    selectedContracts,
    model,
    contractMatchReason,
  ), [contractMatchReason, model, selectedContracts]);
  const contractMatchFingerprint = useMemo(() => invoiceContractMatchFingerprint(
    selectedContracts,
    model,
  ), [model, selectedContracts]);
  const previousContractMatchFingerprint = useRef(contractMatchFingerprint);
  const isDirty = Boolean(editSnapshot && (
    invoiceDocumentChanged(editSnapshot, model)
    || contractMatchReason !== initialContractMatchReason
  ));

  useEffect(() => {
    if (previousContractMatchFingerprint.current === contractMatchFingerprint) return;
    previousContractMatchFingerprint.current = contractMatchFingerprint;
    setContractMatchReason('');
    setGeneratedFiles(null);
  }, [contractMatchFingerprint]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isEditing || !isDirty) return undefined;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [isDirty, isEditing]);

  const selectCreator = (value: string) => {
    const creator = creators.find((item) => item.id === value);
    const socialAccount = resolveCreatorSocialAccount(creator);
    setCreatorId(creator?.id ?? '');
    setCreatorSocialAccountId(socialAccount?.id ?? '');
    setSelectedProjectId('');
    setEngagementId('');
    setContractIds([]);
    setFrom(creator ? { ...creator.contact } : { ...EMPTY_CONTACT });
    const accounts = eligibleInvoicePayoutAccounts(creator);
    const account = accounts.find((candidate) => candidate.isDefault) ?? accounts[0] ?? null;
    setPayoutAccountId(account ? getPayoutAccountId(account) : '');
    setPayment(account
      ? payoutAccountToInvoicePayment(account, creator?.id)
      : { ...EMPTY_PAYMENT });
    setItems([createBlankLine(0)]);
    setErrors({});
    setContractMatchReason('');
    setGeneratedFiles(null);
  };

  const fillPrototypeData = () => {
    if (!prototypeSeed || isEditing) return;
    const creator = creators.find((item) => item.id === prototypeSeed.creatorId);
    const project = projects.find((candidate) => candidate.creatorProfiles?.some((reference) => (
      reference.engagementId === prototypeSeed.engagementId
    )));
    setCreatorId(prototypeSeed.creatorId);
    const reference = project?.creatorProfiles?.find((item) => item.engagementId === prototypeSeed.engagementId);
    const socialAccount = resolveCreatorSocialAccount(
      creator,
      reference?.socialAccountId,
      reference?.handle,
      reference?.platform,
    );
    setCreatorSocialAccountId(socialAccount?.id ?? '');
    setSelectedProjectId(project ? cooperationProjectIdFor(project) : '');
    setEngagementId(prototypeSeed.engagementId);
    setContractIds([]);
    const demoDate = todayInputValue();
    setInvoiceNumber(nextInvoiceNumber(generatedInvoices, demoDate));
    setInvoiceDate(demoDate);
    setSelectedBillingEntityId(defaultBillingEntity.id);
    setBillTo(invoiceEntitySnapshot(defaultBillingEntity));
    setFrom(creator ? { ...creator.contact } : { ...EMPTY_CONTACT });
    setCurrency(prototypeSeed.currency);
    setItems(prototypeSeed.lineItems.map((item, index) => normalizeLineItem({
      id: `${createPrototypeId('item')}-demo-${index}`,
      ...item,
    })));
    setPayoutAccountId(prototypeSeed.payoutAccountId);
    setPayment({ ...prototypeSeed.payment });
    setErrors({});
    setContractMatchReason('');
    setGenerationError('');
    setGeneratedFiles(null);
  };

  const selectProject = (id: string) => {
    const project = projects.find((item) => cooperationProjectIdFor(item) === id);
    const creator = creators.find((item) => item.id === creatorId);
    const nextEngagementId = creator && project
      ? draftEngagementIds[`${creator.id}:${id}`]
      : undefined;
    const payout = project && creator
      ? payouts.find((item) => (
          item.creatorId === creator.id
          && item.projectId === cooperationProjectIdFor(project)
        ))
      : null;
    setSelectedProjectId(id);
    setEngagementId(nextEngagementId ?? '');
    setContractIds([]);
    if (payout) {
      const account = eligibleInvoicePayoutAccounts(creator).find((candidate) => (
        candidate.provider === payout.provider
      )) ?? null;
      setCurrency(payout.currency);
      setPayoutAccountId(account ? getPayoutAccountId(account) : '');
      setPayment(account
        ? payoutAccountToInvoicePayment(account, creator?.id)
        : invoicePaymentForCreator(creator, payout.provider));
    }
    setItems([createBlankLine(0)]);
    setErrors({});
    setGeneratedFiles(null);
  };

  const toggleContract = (contractId: ContractId) => {
    const nextIds = contractIds.includes(contractId)
      ? contractIds.filter((id) => id !== contractId)
      : [...contractIds, contractId];
    setContractIds(nextIds);
    setGeneratedFiles(null);
  };

  const selectPayoutAccount = (id: string) => {
    const account = eligiblePayoutAccounts.find((candidate) => getPayoutAccountId(candidate) === id);
    if (!account) return;
    setPayoutAccountId(getPayoutAccountId(account));
    setPayment(payoutAccountToInvoicePayment(account, selectedCreator?.id));
    setErrors((current) => {
      const next = { ...current };
      delete next.payoutAccountId;
      return next;
    });
    setGeneratedFiles(null);
  };

  const changeLine = (id: string, field: 'description' | 'unitPrice' | 'quantity', rawValue: string) => {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const value = field === 'description' ? rawValue : Number(rawValue);
      return normalizeLineItem({ ...item, [field]: value });
    }));
    setGeneratedFiles(null);
  };

  const validate = () => {
    const nextErrors = validateInvoiceDocumentModel(model, selectedContracts, {
      allowContractPayoutOverride: allowPayoutAccountChange,
    });
    if (!creatorId) nextErrors.creator = '请选择达人';
    if (!selectedProjectId || !engagementId) nextErrors.project = '请选择飞书合作项目';
    if (contractMatch.blockerIssues.length) {
      nextErrors.contractMatch = contractMatch.blockerIssues[0].message;
    } else if (contractMatch.reasonRequiredIssues.length && !contractMatch.reasonValid) {
      nextErrors.contractMatch = contractMatchReason.trim().length > 300
        ? '差异说明不能超过 300 个字符'
        : '请填写 1–300 个字符的合同差异说明';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const generate = async () => {
    setGenerationError('');
    if (isEditing && !isDirty) {
      setGenerationError('尚未修改任何 Invoice 字段，无法保存新版本。');
      return;
    }
    if (!validate()) {
      window.requestAnimationFrame(() => document.querySelector('.invoice-builder-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    setGenerating(true);
    try {
      const allocatedInvoiceNumber = isEditing
        ? model.invoiceNumber
        : nextInvoiceNumber(generatedInvoices, model.invoiceDate);
      const snapshot: InvoiceDocumentModel = {
        ...model,
        invoiceNumber: allocatedInvoiceNumber,
        billTo: { ...model.billTo },
        from: { ...model.from },
        payment: { ...model.payment },
        items: model.items.map((item) => ({ ...item })),
      };
      const contractMatchReview = createInvoiceContractMatchReview({
        contracts: selectedContracts,
        model: snapshot,
        version: isEditing && editContext !== 'DRAFT' ? (editRecord?.version ?? 1) + 1 : editRecord?.version ?? 1,
        reason: contractMatchReason,
        actor: contractMatchActor,
      });
      const { generateInvoiceFiles } = await import('../invoice/generateInvoice');
      const { pdfBlob, docxBlob } = await generateInvoiceFiles(snapshot);
      const record = isEditing
        ? onEdited?.(snapshot, contractMatchReview)
        : {
            id: snapshot.invoiceNumber,
            invoiceId: createPrototypeId('invoice') as InvoiceId,
            sourcePayoutId: prototypePayoutId,
            status: '草稿' as const,
            generatedAt: new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date()),
            snapshot,
            validationStatus: 'valid' as const,
            version: 1,
            contractMatchReviews: [contractMatchReview],
          };
      if (!record) throw new Error(isEditing ? '修改记录保存失败。' : 'Invoice 生成回调未配置。');
      if (!isEditing) onGenerated?.(record);
      setGeneratedFiles({ record, pdfBlob, docxBlob });
      if (!isEditing) setInvoiceNumber(nextInvoiceNumber([record, ...generatedInvoices], invoiceDate));
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : '文件生成失败，请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  const cancel = () => {
    if (isEditing && isDirty && !window.confirm('当前修改尚未保存，确定离开修改页吗？')) return;
    onCancel();
  };

  const saveLabel = editContext === 'DRAFT'
    ? '保存草稿'
    : editContext === 'CREATOR_FEEDBACK'
    ? '保存并重新发送达人'
    : editContext === 'MEDIA_RECHECK'
      ? '保存修改并重新签署'
      : editContext === 'PAYMENT_FAILURE_CONTENT'
        ? '保存并重新发起签署'
        : '生成 PDF + DOCX';

  return (
    <div className="page-stack invoice-builder-page">
      <button className="project-back-button" type="button" onClick={cancel}>
        <ArrowLeft size={17} />
        {isEditing ? '返回 Invoice 详情' : '返回 Invoice 管理'}
      </button>
      <PageHeading
        title={isEditing ? '修改 Invoice' : '生成 Invoice'}
        subtitle={isEditing
          ? editContext === 'DRAFT'
            ? '修改尚未发布的 Invoice 草稿；保存后保持当前版本，不会通知达人。'
            : '保留稳定关联并生成新文件版本；保存后原签署失效，重新进入待签署。'
          : '从达人档案与项目费用中自动带入资料，确认后同时生成 PDF 与 DOCX。'}
        actions={(
          <>
            {!isEditing ? (
              <Button
                variant="secondary"
                icon={<Sparkles size={17} />}
                data-testid="invoice-fill-demo"
                disabled={!prototypeSeed || generating}
                onClick={fillPrototypeData}
              >
                填充演示数据
              </Button>
            ) : null}
          </>
        )}
      />
      <NoticeBanner>
        {isEditing
          ? `正在修改 ${editRecord?.id} · v${editRecord?.version ?? 1}。达人、项目及 Invoice 编号已锁定；版本历史仅在当前浏览器会话保留。`
          : '生成文件会保留空白签名区；当前为前端原型，生成记录仅在本次会话内保留。'}
      </NoticeBanner>
      {Object.keys(errors).length > 0 ? (
        <div className="invoice-builder-error" role="alert"><strong>还有 {Object.keys(errors).length} 项资料需要完善</strong><span>{Object.values(errors)[0]}</span></div>
      ) : null}
      {generationError ? <div className="invoice-builder-error" role="alert"><strong>文件生成失败</strong><span>{generationError}</span></div> : null}
      {generatedFiles ? (
        <section className="invoice-generation-success" data-testid="invoice-generation-success">
          <span><CheckCircle2 size={22} /></span>
          <div>
            <strong>{generatedFiles.record.id} {generatedFiles.record.status === '草稿' ? '草稿已生成' : '已发布待签署'}</strong>
            <p>{generatedFiles.record.status === '草稿' ? 'PDF 与 DOCX 使用同一份数据快照，发布后才会通知达人签署。' : '已生成达人端签署待办，并记录模拟通知。'}</p>
          </div>
          <div className="invoice-generation-actions">
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => downloadBlob(generatedFiles.pdfBlob, invoiceFilename(generatedFiles.record.snapshot, 'pdf'))}>下载 PDF</Button>
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => downloadBlob(generatedFiles.docxBlob, invoiceFilename(generatedFiles.record.snapshot, 'docx'))}>下载 DOCX</Button>
            {onPublishGenerated ? (
              <Button
                icon={<Send size={16} />}
                disabled={generatedFiles.record.status !== '草稿'}
                onClick={() => {
                  if (!onPublishGenerated(generatedFiles.record)) return;
                  setGeneratedFiles((current) => current ? {
                    ...current,
                    record: { ...current.record, status: '待签署' },
                  } : current);
                }}
              >
                {generatedFiles.record.status === '草稿' ? '发布达人签署' : '已发布'}
              </Button>
            ) : null}
            <Button onClick={onOpenInvoiceManagement}>查看 Invoice 草稿</Button>
          </div>
        </section>
      ) : null}

      <div className="invoice-builder-layout">
        <section className="invoice-builder-form">
          <div className="invoice-builder-section">
            <header><span><UserRound size={19} /></span><div><h2>1. 达人与合作项目</h2><p>合作项目来自飞书同步映射，并通过稳定合作关系关联达人。</p></div></header>
            <div className="invoice-form-grid">
              <div className={`invoice-form-control ${errors.creator ? 'has-error' : ''}`}>
                <span>合作达人 *</span>
                <SearchableComboBox
                  ariaLabel="合作达人"
                  className="creator-search-combobox"
                  value={creatorSelectionValue}
                  placeholder="搜索达人名称、频道 ID、频道链接…"
                  options={creatorOptions}
                  resultUnit="位达人"
                  renderOption={(option) => (
                    <CreatorIdentity creator={creators.find((creator) => creator.id === option.value)} socialAccountsMode="expanded" />
                  )}
                  onChange={selectCreator}
                  onClear={() => selectCreator('')}
                  disabled={isEditing}
                  error={errors.creator}
                />
                {errors.creator ? <small>{errors.creator}</small> : null}
              </div>
              <div className={`invoice-form-control ${errors.project ? 'has-error' : ''}`}>
                <span>合作项目 *</span>
                <SelectField ariaLabel="合作项目" variant="form" value={selectedProjectId} placeholder={creatorId ? '选择飞书合作项目' : '请先选择达人'} options={projectOptions} onChange={selectProject} disabled={!creatorId || isEditing} />
                {errors.project ? <small>{errors.project}</small> : null}
              </div>
            </div>
            {selectedProjectId && engagementId ? (
              <div className="invoice-contract-coverage">
                <div className="invoice-contract-coverage-head">
                  <div>
                    <strong id="invoice-contract-coverage-label">关联合同（非必填）</strong>
                    <span>主体必须一致；金额、币种或付款账户差异填写说明后可继续。</span>
                  </div>
                  <em>{contractIds.length ? `已选 ${contractIds.length} 份` : '未关联合同（非必填）'}</em>
                </div>
                {selectableContracts.length ? (
                  <div
                    className="invoice-contract-options"
                    role="group"
                    aria-labelledby="invoice-contract-coverage-label"
                  >
                    {selectableContracts.map((contract) => (
                      <label key={contract.contractId}>
                        <input
                          type="checkbox"
                          checked={Boolean(contract.contractId && contractIds.includes(contract.contractId))}
                          onChange={() => contract.contractId && toggleContract(contract.contractId)}
                        />
                        <span>
                          <strong>{contract.name}</strong>
                          <small>{contract.id} · {formatContractMoney(contract)}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p>当前没有可用于校验的已确认合同，仍可按无合同流程生成 Invoice。</p>
                )}
                <div className="invoice-contract-match-panel" data-result={contractMatch.result}>
                  <div className="invoice-contract-match-head">
                    <span>
                      {contractMatch.result === 'BLOCKED' ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
                      <strong>{
                        contractMatch.result === 'NOT_APPLICABLE'
                          ? '未关联合同，匹配不适用'
                          : contractMatch.result === 'BLOCKED'
                            ? '主体不一致，暂不能生成'
                            : contractMatch.result === 'REASON_REQUIRED'
                              ? '存在可放行差异，请填写说明'
                              : contractMatch.result === 'APPROVED_WITH_REASON'
                                ? '差异说明已填写，可以生成'
                                : '合同与 Invoice 已匹配'
                      }</strong>
                    </span>
                    <em>{contractMatch.result === 'NOT_APPLICABLE'
                      ? '不适用'
                      : `${contractMatch.checks.filter((check) => (
                          ['MATCH', 'NOT_APPLICABLE', 'APPROVED_WITH_REASON'].includes(check.state)
                        )).length}/${contractMatch.checks.length} 已确认`}</em>
                  </div>
                  <div className="invoice-contract-match-grid">
                    {contractMatch.checks.map((check) => (
                      <article data-state={check.state} key={check.field}>
                        <span>{
                          check.state === 'MATCH' || check.state === 'APPROVED_WITH_REASON'
                            ? <CheckCircle2 size={15} />
                            : check.state === 'NOT_APPLICABLE'
                              ? <FileText size={15} />
                              : <AlertTriangle size={15} />
                        }</span>
                        <div><strong>{check.label}</strong><small>{check.message}</small></div>
                      </article>
                    ))}
                  </div>
                  {contractMatch.reasonRequiredIssues.length ? (
                    <label className={`invoice-contract-match-reason ${errors.contractMatch ? 'has-error' : ''}`}>
                      <span>合同差异说明 *</span>
                      <textarea
                        id="invoice-contract-match-reason"
                        value={contractMatchReason}
                        maxLength={300}
                        aria-invalid={Boolean(errors.contractMatch)}
                        aria-describedby="invoice-contract-match-reason-help"
                        placeholder="说明金额、币种或付款账户与合同不一致的业务原因"
                        onChange={(event) => {
                          setContractMatchReason(event.target.value);
                          setGeneratedFiles(null);
                        }}
                      />
                      <small
                        id="invoice-contract-match-reason-help"
                        role={errors.contractMatch ? 'alert' : undefined}
                      >
                        {errors.contractMatch || `${contractMatchReason.trim().length}/300`}
                      </small>
                    </label>
                  ) : contractMatch.blockerIssues.length ? (
                    <p className="invoice-contract-match-blocker" role="alert">{contractMatch.blockerIssues.map((item) => item.message).join('；')}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="invoice-builder-section">
            <header><span><FileText size={19} /></span><div><h2>2. Invoice 信息</h2><p>编号由系统生成，日期、币种与费用内容可编辑。</p></div></header>
            <div className="invoice-form-grid">
              <label className={errors.invoiceNumber ? 'has-error' : ''}><span>Invoice 编号 *</span><input value={invoiceNumber} readOnly /><small>{errors.invoiceNumber}</small></label>
              <label className={errors.invoiceDate ? 'has-error' : ''}><span>Invoice 日期 *</span><input type="date" value={invoiceDate} onChange={(event) => {
                const value = event.target.value;
                setInvoiceDate(value);
                if (!isEditing && value) setInvoiceNumber(nextInvoiceNumber(generatedInvoices, value));
                setGeneratedFiles(null);
              }} /><small>{errors.invoiceDate}</small></label>
              <div className="invoice-form-control"><span>币种 *</span><SelectField ariaLabel="Invoice 币种" variant="form" value={currency} options={CURRENCY_OPTIONS} onChange={(value) => { setCurrency(value); setGeneratedFiles(null); }} /></div>
            </div>
            <div className="invoice-line-items">
              <div className="invoice-line-header"><strong>费用明细</strong><Button variant="secondary" icon={<Plus size={15} />} onClick={() => setItems((current) => [...current, createBlankLine(current.length)])}>新增明细</Button></div>
              {items.map((item, index) => (
                <div className="invoice-line-row" key={item.id}>
                  <label className={`invoice-line-description ${errors[`item-${item.id}-description`] ? 'has-error' : ''}`}><span>DESCRIPTION</span><input value={item.description} placeholder="费用项目或合作交付" onChange={(event) => changeLine(item.id, 'description', event.target.value)} /><small>{errors[`item-${item.id}-description`]}</small></label>
                  <label className={errors[`item-${item.id}-unitPrice`] ? 'has-error' : ''}><span>PRICE</span><input type="number" min="0" step="0.01" value={item.unitPrice || ''} onChange={(event) => changeLine(item.id, 'unitPrice', event.target.value)} /><small>{errors[`item-${item.id}-unitPrice`]}</small></label>
                  <label className={errors[`item-${item.id}-quantity`] ? 'has-error' : ''}><span>AMOUNT</span><input type="number" min="0.01" step="0.01" value={item.quantity || ''} onChange={(event) => changeLine(item.id, 'quantity', event.target.value)} /><small>{errors[`item-${item.id}-quantity`]}</small></label>
                  <div className="invoice-line-total"><span>TOTAL</span><strong>{formatInvoiceMoney(currency, item.lineTotal)}</strong></div>
                  <button className="invoice-line-remove" type="button" aria-label={`删除第 ${index + 1} 项费用`} disabled={items.length === 1} onClick={() => setItems((current) => current.filter((line) => line.id !== item.id))}><Trash2 size={16} /></button>
                </div>
              ))}
              <div className="invoice-editor-total"><span>费用总计</span><strong>{formatInvoiceMoney(currency, invoiceTotal(model))}</strong></div>
            </div>
          </div>

          <div className="invoice-builder-section">
            <header><span><Building2 size={19} /></span><div><h2>3. 主体与联系资料</h2><p>Bill To 来自账户中心，From 来自达人档案；这里的修改仅影响本次 Invoice。</p></div></header>
            <div className="invoice-form-subtitle">Bill to</div>
            <div className="invoice-form-grid">
              <div className={`invoice-form-control full-width ${errors.billToName ? 'has-error' : ''}`}>
                <span>公司名称 *</span>
                <SelectField
                  ariaLabel="选择 Bill To 开票主体"
                  variant="form"
                  menuStrategy="fixed"
                  value={selectedBillingEntityId}
                  options={billingEntityOptions}
                  onChange={(value) => {
                    setSelectedBillingEntityId(value);
                    const entity = invoiceBillingSettings.entities.find((candidate) => candidate.id === value);
                    if (entity) setBillTo(invoiceEntitySnapshot(entity));
                    setGeneratedFiles(null);
                    setErrors((current) => ({ ...current, billToName: '' }));
                  }}
                />
                <small>{errors.billToName || (
                  !matchedBillingEntity && editSnapshot
                    ? '当前 Invoice 快照：来源主体已删除，保留原 Bill To 资料。'
                    : ''
                )}</small>
              </div>
              <label className={`full-width ${errors.billToAddress ? 'has-error' : ''}`}>
                <span>公司地址 *</span>
                <textarea value={billTo.address} onChange={(event) => setBillTo((current) => ({ ...current, address: event.target.value }))} />
                <small>{errors.billToAddress || '从所选主体带入，可仅针对本张 Invoice 临时修改。'}</small>
              </label>
            </div>
            <div className="invoice-form-subtitle">From</div>
            <div className="invoice-form-grid">
              <label className={errors.legalName ? 'has-error' : ''}><span>真实姓名 / Real Name *</span><input value={from.legalName} onChange={(event) => setFrom((current) => ({ ...current, legalName: event.target.value }))} /><small>{errors.legalName}</small></label>
              <label className={errors.phone ? 'has-error' : ''}><span>联系电话 / Tel *</span><input value={from.phone} onChange={(event) => setFrom((current) => ({ ...current, phone: event.target.value }))} /><small>{errors.phone}</small></label>
              <label className={errors.email ? 'has-error' : ''}><span>联系邮箱 / Email *</span><input type="email" value={from.email} onChange={(event) => setFrom((current) => ({ ...current, email: event.target.value }))} /><small>{errors.email}</small></label>
              <label className={`full-width ${errors.address ? 'has-error' : ''}`}><span>联系地址 / Address *</span><textarea value={from.address} onChange={(event) => setFrom((current) => ({ ...current, address: event.target.value }))} /><small>{errors.address}</small></label>
            </div>
          </div>

          <div className="invoice-builder-section">
            <header>
              <span><WalletCards size={19} /></span>
              <div>
                <h2>4. 收款方式</h2>
                <p>
                  {allowPayoutAccountChange
                    ? '财务以 Invoice 原因退回，可重新选择达人档案中的已验证账户，付款方式将按渠道自动确定。'
                    : requiresPayoutAccountSelection
                    ? '付款失败重新发起时，必须从达人档案中重新选择已验证账户。'
                    : '从达人档案选择已验证账户，付款字段只读并冻结到本次 Invoice。'}
                </p>
              </div>
            </header>
            <div className="invoice-form-grid">
              <div className={`invoice-form-control full-width ${errors.payoutAccountId ? 'has-error' : ''}`}>
                <span>付款账户 *</span>
                <SelectField
                  ariaLabel="付款账户"
                  variant="form"
                  value={payoutAccountId}
                  placeholder={selectedCreator ? '请选择已验证付款账户' : '未找到关联达人'}
                  options={payoutAccountOptions}
                  disabled={!selectedCreator || !payoutAccountOptions.length}
                  onChange={selectPayoutAccount}
                />
                <small>{errors.payoutAccountId}</small>
                <p className="invoice-payout-account-note">
                  {allowPayoutAccountChange
                    ? '保存后将冻结新的账户 ID、版本与付款快照，并同步刷新对应付款明细。'
                    : '选择达人档案中的已验证账户后，将冻结账户 ID、版本与付款快照。'}
                </p>
              </div>
              <label className="full-width invoice-payment-method-readonly">
                <span>付款方式</span>
                <input aria-label="付款方式（根据付款账户自动确定）" value={paymentMethodDisplay} readOnly />
                <small>根据付款账户渠道自动确定：PayPal 使用 PayPal，其余银行类渠道使用 Bank Transfer。</small>
              </label>
              {paymentMethod === 'bank' ? (
                <>
                  <label className={errors.accountName ? 'has-error' : ''}><span>Account Name *</span><input value={payment.accountName} readOnly /><small>{errors.accountName}</small></label>
                  <label className={errors.accountNumber ? 'has-error' : ''}><span>Account Number（与 IBAN 二选一）</span><input value={payment.accountNumber} readOnly /><small>{errors.accountNumber}</small></label>
                  <label><span>IBAN（与 Account Number 二选一）</span><input value={payment.iban} readOnly /></label>
                  <label><span>Beneficiary Bank Name（可选）</span><input value={payment.bankName} readOnly /></label>
                  <label><span>Swift Code（SWIFT 路径时填写）</span><input value={payment.swiftCode} readOnly /></label>
                  <label className="full-width"><span>Beneficiary Bank Address（Schema 要求时填写）</span><textarea value={payment.bankStreetAddress} readOnly /></label>
                </>
              ) : (
                <>
                  <label className={errors.paypalUsername ? 'has-error' : ''}><span>Paypal Name *</span><input value={payment.paypalUsername} readOnly /><small>{errors.paypalUsername}</small></label>
                  <label className={errors.paypalEmail ? 'has-error' : ''}><span>Paypal Email *</span><input type="email" value={payment.paypalEmail} readOnly /><small>{errors.paypalEmail}</small></label>
                  <label className="full-width"><span>Transfer Note（选填）</span><input value={payment.transferRemarks} readOnly /></label>
                </>
              )}
            </div>
          </div>

          <div className="invoice-builder-footer">
            <Button variant="ghost" onClick={cancel}>取消</Button>
            <Button icon={<WandSparkles size={17} />} disabled={generating || (isEditing && !isDirty) || !contractMatch.canProceed} onClick={generate}>{generating ? '正在生成…' : saveLabel}</Button>
          </div>
        </section>

        <aside className="invoice-preview-panel">
          <div className="invoice-preview-head"><div><strong>实时预览</strong><span>US Letter · 签名留空</span></div><span>{model.invoiceNumber}</span></div>
          <InvoiceDocumentView model={model} ariaLabel="Invoice 实时预览" />
        </aside>
      </div>
    </div>
  );
}
