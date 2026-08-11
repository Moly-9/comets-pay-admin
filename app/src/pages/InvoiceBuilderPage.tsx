import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  WalletCards,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { InvoiceDocumentView } from '../components/InvoiceDocumentView';
import {
  createPrototypeId,
  hasInvoiceForEngagement,
  type CreatorId,
  type ContractId,
  type EngagementId,
  type InvoiceId,
  type ProjectId,
} from '../businessWorkflow';
import { formatContractMoney, isConfirmedContract, type ContractRecord } from '../contracts';
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
  payoutSnapshotForContract,
  payoutSnapshotKey,
  validateInvoiceDocumentModel,
} from '../invoice/invoiceDraft';
import { createInvoiceBuilderPrototypeSeed } from '../invoice/invoiceBuilderPrototype';
import {
  invoiceDocumentChanged,
  maskInvoiceAccountValue,
} from '../invoice/invoiceReviewWorkflow';
import {
  eligibleInvoicePayoutAccounts,
  getPayoutAccountId,
  getPayoutAccountIdentifier,
  getPayoutAccountVersion,
  getPayoutAccountStatusMeta,
  getPayoutAccountSummary,
  invoicePaymentForCreator,
  payoutAccountToInvoicePayment,
} from '../payoutAccounts';
import type {
  CreatorInvoiceContact,
  CreatorProfile,
  DocumentPayoutSnapshot,
  GeneratedInvoiceRecord,
  InvoiceCurrency,
  InvoiceDocumentModel,
  InvoiceEditContext,
  InvoiceEntity,
  InvoiceLineItem,
  InvoicePaymentMethod,
  Payout,
} from '../types';
import type { ProjectSummary } from './ProjectDetailPage';

type InvoiceBuilderPageProps = {
  creators: CreatorProfile[];
  payouts: Payout[];
  projects: ProjectSummary[];
  contracts: ContractRecord[];
  invoiceEntity: InvoiceEntity;
  generatedInvoices: GeneratedInvoiceRecord[];
  onGenerated?: (record: GeneratedInvoiceRecord) => void;
  editRecord?: GeneratedInvoiceRecord;
  editContext?: InvoiceEditContext;
  allowPayoutAccountChange?: boolean;
  onEdited?: (snapshot: InvoiceDocumentModel) => GeneratedInvoiceRecord;
  onDirtyChange?: (dirty: boolean) => void;
  onCancel: () => void;
  onOpenInvoiceManagement: () => void;
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

const PAYMENT_OPTIONS = [
  { value: 'bank', label: 'Bank transfer', description: '使用达人银行收款资料' },
  { value: 'paypal', label: 'PayPal', description: '使用达人 PayPal 用户名与邮箱' },
] as const;

const createBlankLine = (index: number): InvoiceLineItem => ({
  id: `${createPrototypeId('item')}-${index}`,
  description: '',
  unitPrice: 0,
  quantity: 0,
  lineTotal: 0,
});

export function InvoiceBuilderPage({
  creators,
  payouts,
  projects,
  contracts,
  invoiceEntity,
  generatedInvoices,
  onGenerated,
  editRecord,
  editContext,
  allowPayoutAccountChange = false,
  onEdited,
  onDirtyChange,
  onCancel,
  onOpenInvoiceManagement,
  initialEngagementId,
}: InvoiceBuilderPageProps) {
  const isEditing = Boolean(editRecord && editContext);
  const editSnapshot = editRecord?.snapshot;
  const initialContext = projects
    .flatMap((project) => (project.creatorProfiles ?? []).map((reference) => ({ project, reference })))
    .find((item) => item.reference.engagementId === (editSnapshot?.engagementId ?? initialEngagementId));
  const initialCreator = creators.find((creator) => (
    creator.id === (editSnapshot?.creatorId ?? initialContext?.reference.creatorId)
  ));
  const initialPayoutAccount = initialCreator
    ? eligibleInvoicePayoutAccounts(initialCreator).find((account) => (
        account.provider === (editSnapshot?.paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex')
      )) ?? eligibleInvoicePayoutAccounts(initialCreator)[0] ?? null
    : null;
  const [creatorId, setCreatorId] = useState(initialCreator?.id ?? editSnapshot?.creatorId ?? '');
  const [engagementId, setEngagementId] = useState(editSnapshot?.engagementId ?? initialEngagementId ?? '');
  const [contractIds, setContractIds] = useState<ContractId[]>(() => (
    editSnapshot?.contractIds ? [...editSnapshot.contractIds] : []
  ));
  const [invoiceNumber, setInvoiceNumber] = useState(() => (
    editSnapshot?.invoiceNumber ?? nextInvoiceNumber(generatedInvoices)
  ));
  const [prototypePayoutId] = useState(() => createPrototypeId('payout'));
  const [invoiceDate, setInvoiceDate] = useState(() => editSnapshot?.invoiceDate ?? todayInputValue());
  const [billTo, setBillTo] = useState<InvoiceEntity>(
    editSnapshot ? { ...editSnapshot.billTo } : { ...invoiceEntity },
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
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod>(
    editSnapshot?.paymentMethod ?? 'bank',
  );
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
  const prototypeSeed = useMemo(() => createInvoiceBuilderPrototypeSeed({
    creators,
    payouts,
    projects,
    contracts,
    generatedInvoices,
  }), [contracts, creators, generatedInvoices, payouts, projects]);

  const selectedCreator = creators.find((creator) => creator.id === creatorId) ?? null;
  const eligiblePayoutAccounts = eligibleInvoicePayoutAccounts(selectedCreator);
  const payoutAccountOptions = eligiblePayoutAccounts.map((account) => ({
    value: getPayoutAccountId(account),
    label: `${account.nickname}${account.isDefault ? ' · 默认' : ''}`,
    description: [
      getPayoutAccountSummary(account),
      maskInvoiceAccountValue(getPayoutAccountIdentifier(account)),
      getPayoutAccountVersion(account),
      getPayoutAccountStatusMeta(account.status, account.provider).label,
    ].join(' · '),
  }));
  const requiresPayoutAccountSelection = editContext === 'PAYMENT_FAILURE_CONTENT';
  const creatorEngagements = useMemo(() => projects.flatMap((project) => (
    (project.creatorProfiles ?? [])
      .filter((reference) => reference.creatorId === creatorId && reference.status !== 'removed')
      .map((reference) => ({ project, reference }))
  )), [creatorId, projects]);
  const selectedEngagement = creatorEngagements.find((item) => item.reference.engagementId === engagementId) ?? null;
  const selectedProject = selectedEngagement?.project ?? null;
  const selectedPayout = selectedCreator && selectedProject
    ? payouts.find((payout) => (
        payout.creatorId === selectedCreator.id
        && payout.projectId === (selectedProject.cooperationProjectId ?? selectedProject.projectId ?? selectedProject.id)
      )) ?? null
    : null;
  const selectableContracts = contracts.filter((contract) => (
    contract.engagementId === engagementId
    && isConfirmedContract(contract)
    && Boolean(contract.contractId)
  ));
  const selectedContracts = selectableContracts.filter((contract) => (
    contract.contractId && contractIds.includes(contract.contractId)
  ));
  const selectedContractPayoutSnapshots = selectedContracts
    .map(payoutSnapshotForContract)
    .filter((snapshot): snapshot is DocumentPayoutSnapshot => Boolean(snapshot?.payoutAccountId));
  const contractPayoutLocked = selectedContractPayoutSnapshots.length > 0 && !allowPayoutAccountChange;
  const engagementInvoiceReferences = generatedInvoices.map((record) => ({
    invoiceId: record.invoiceId,
    engagementId: record.snapshot.engagementId as EngagementId | undefined,
  }));
  const existingInvoice = !isEditing && hasInvoiceForEngagement(
    engagementInvoiceReferences,
    engagementId as EngagementId | '',
  )
    ? generatedInvoices.find((record) => record.snapshot.engagementId === engagementId)
    : undefined;
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

  const model = useMemo<InvoiceDocumentModel>(() => ({
    invoiceNumber,
    invoiceDate,
    billTo,
    creatorHandle: isEditing ? editSnapshot?.creatorHandle ?? '' : selectedCreator?.handle ?? '',
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
  }), [billTo, contractIds, currency, editSnapshot, engagementId, from, invoiceDate, invoiceNumber, isEditing, items, payment, paymentMethod, payoutAccountId, selectedCreator, selectedProject]);
  const isDirty = Boolean(editSnapshot && invoiceDocumentChanged(editSnapshot, model));

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

  const selectCreator = (id: string) => {
    const creator = creators.find((item) => item.id === id);
    setCreatorId(id);
    setEngagementId('');
    setContractIds([]);
    setFrom(creator ? { ...creator.contact } : { ...EMPTY_CONTACT });
    const account = eligibleInvoicePayoutAccounts(creator).find((candidate) => (
      candidate.provider === (paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex')
    )) ?? null;
    setPayoutAccountId(account ? getPayoutAccountId(account) : '');
    setPayment(account
      ? payoutAccountToInvoicePayment(account, creator?.id)
      : invoicePaymentForCreator(creator, paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex'));
    setItems([createBlankLine(0)]);
    setErrors({});
    setGeneratedFiles(null);
  };

  const fillPrototypeData = () => {
    if (!prototypeSeed || isEditing) return;
    const creator = creators.find((item) => item.id === prototypeSeed.creatorId);
    setCreatorId(prototypeSeed.creatorId);
    setEngagementId(prototypeSeed.engagementId);
    setContractIds([]);
    setInvoiceNumber(nextInvoiceNumber(generatedInvoices));
    setInvoiceDate(todayInputValue());
    setBillTo({ ...invoiceEntity });
    setFrom(creator ? { ...creator.contact } : { ...EMPTY_CONTACT });
    setCurrency(prototypeSeed.currency);
    setItems(prototypeSeed.lineItems.map((item, index) => normalizeLineItem({
      id: `${createPrototypeId('item')}-demo-${index}`,
      ...item,
    })));
    setPayoutAccountId(prototypeSeed.payoutAccountId);
    setPaymentMethod(prototypeSeed.paymentMethod);
    setPayment({ ...prototypeSeed.payment });
    setErrors({});
    setGenerationError('');
    setGeneratedFiles(null);
  };

  const selectProject = (id: string) => {
    const context = creatorEngagements.find((item) => item.reference.engagementId === id);
    const creator = creators.find((item) => item.id === creatorId);
    const payout = context && creator
      ? payouts.find((item) => (
          item.creatorId === creator.id
          && item.projectId === (context.project.cooperationProjectId ?? context.project.projectId ?? context.project.id)
        ))
      : null;
    setEngagementId(id);
    setContractIds([]);
    if (payout) {
      const account = eligibleInvoicePayoutAccounts(creator).find((candidate) => (
        candidate.provider === payout.provider
      )) ?? null;
      setCurrency(payout.currency);
      setPaymentMethod(payout.provider === 'PayPal' ? 'paypal' : 'bank');
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
    const nextContracts = selectableContracts.filter((contract) => (
      contract.contractId && nextIds.includes(contract.contractId)
    ));
    const contractSnapshots = nextContracts
      .map(payoutSnapshotForContract)
      .filter((snapshot): snapshot is DocumentPayoutSnapshot => Boolean(snapshot?.payoutAccountId));
    setContractIds(nextIds);
    if (nextContracts.length) {
      const first = nextContracts[0];
      if (first.currency && ['USD', 'EUR', 'GBP', 'HKD', 'SGD'].includes(first.currency)) {
        setCurrency(first.currency as InvoiceCurrency);
      }
      if (first.advertiser) setBillTo((current) => ({ ...current, name: first.advertiser }));
      if (first.publisher) setFrom((current) => ({ ...current, legalName: first.publisher }));
      if (first.paymentMethod) {
        setPaymentMethod(first.paymentMethod === 'PAYPAL' ? 'paypal' : 'bank');
      }
      if (contractSnapshots.length && new Set(contractSnapshots.map(payoutSnapshotKey)).size === 1) {
        const snapshot = contractSnapshots[0];
        setPayoutAccountId(snapshot.payoutAccountId ?? '');
        setPaymentMethod(snapshot.payoutProvider === 'PayPal' ? 'paypal' : 'bank');
        setPayment({ ...snapshot });
      }
      setItems(nextContracts.map((contract, index) => normalizeLineItem({
        id: `line-contract-${contract.contractId ?? index}`,
        description: `${contract.project} · ${contract.ioId || contract.id}`,
        unitPrice: contract.totalFee ?? 0,
        quantity: 1,
      })));
    } else {
      const account = selectedPayout
        ? eligiblePayoutAccounts.find((candidate) => candidate.provider === selectedPayout.provider) ?? null
        : eligiblePayoutAccounts[0] ?? null;
      setPayoutAccountId(account ? getPayoutAccountId(account) : '');
      setPaymentMethod(account?.provider === 'PayPal' ? 'paypal' : 'bank');
      setPayment(account
        ? payoutAccountToInvoicePayment(account, selectedCreator?.id)
        : { ...EMPTY_PAYMENT });
      if (!selectedPayout) setItems([createBlankLine(0)]);
    }
    setGeneratedFiles(null);
  };

  const selectPayoutAccount = (id: string) => {
    const account = eligiblePayoutAccounts.find((candidate) => getPayoutAccountId(candidate) === id);
    if (!account) return;
    setPayoutAccountId(getPayoutAccountId(account));
    setPaymentMethod(account.provider === 'PayPal' ? 'paypal' : 'bank');
    setPayment(payoutAccountToInvoicePayment(account, selectedCreator?.id));
    setErrors((current) => {
      const next = { ...current };
      delete next.payoutAccountId;
      return next;
    });
    setGeneratedFiles(null);
  };

  const selectPaymentMethod = (value: InvoicePaymentMethod) => {
    const provider = value === 'paypal' ? 'PayPal' : 'Airwallex';
    const account = eligiblePayoutAccounts.find((candidate) => candidate.provider === provider) ?? null;
    setPaymentMethod(value);
    setPayoutAccountId(account ? getPayoutAccountId(account) : '');
    setPayment(account
      ? payoutAccountToInvoicePayment(account, selectedCreator?.id)
      : invoicePaymentForCreator(selectedCreator, provider));
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
    if (!engagementId) nextErrors.project = '请选择该达人关联的项目';
    if (existingInvoice) nextErrors.project = `该项目达人已有 Invoice ${existingInvoice.id}，请先解除旧关联。`;
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
      const snapshot: InvoiceDocumentModel = {
        ...model,
        billTo: { ...model.billTo },
        from: { ...model.from },
        payment: { ...model.payment },
        items: model.items.map((item) => ({ ...item })),
      };
      const { generateInvoiceFiles } = await import('../invoice/generateInvoice');
      const { pdfBlob, docxBlob } = await generateInvoiceFiles(snapshot);
      const record = isEditing
        ? onEdited?.(snapshot)
        : {
            id: snapshot.invoiceNumber,
            invoiceId: createPrototypeId('invoice') as InvoiceId,
            sourcePayoutId: selectedPayout?.id ?? prototypePayoutId,
            status: '待签署' as const,
            generatedAt: new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date()),
            snapshot,
            validationStatus: 'valid' as const,
          };
      if (!record) throw new Error(isEditing ? '修改记录保存失败。' : 'Invoice 生成回调未配置。');
      if (!isEditing) onGenerated?.(record);
      setGeneratedFiles({ record, pdfBlob, docxBlob });
      if (!isEditing) setInvoiceNumber(nextInvoiceNumber([record, ...generatedInvoices]));
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

  const saveLabel = editContext === 'CREATOR_FEEDBACK'
    ? '保存并重新发送达人'
    : editContext === 'MEDIA_RECHECK'
      ? '保存修改并重新签署'
      : editContext === 'PAYMENT_FAILURE_CONTENT'
        ? '保存并重新发起签署'
        : '生成 PDF + DOCX';

  return (
    <div className="page-stack invoice-builder-page">
      <PageHeading
        title={isEditing ? '修改 Invoice' : '生成 Invoice'}
        subtitle={isEditing
          ? '保留稳定关联并生成新文件版本；保存后原签署失效，重新进入待签署。'
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
            <Button variant="secondary" icon={<ArrowLeft size={17} />} onClick={cancel}>
              {isEditing ? '返回 Invoice 详情' : '返回 Invoice 管理'}
            </Button>
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
          <div><strong>{generatedFiles.record.id} 已生成</strong><p>PDF 与 DOCX 使用同一份数据快照，状态为“待签署”。</p></div>
          <div className="invoice-generation-actions">
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => downloadBlob(generatedFiles.pdfBlob, invoiceFilename(generatedFiles.record.snapshot, 'pdf'))}>下载 PDF</Button>
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => downloadBlob(generatedFiles.docxBlob, invoiceFilename(generatedFiles.record.snapshot, 'docx'))}>下载 DOCX</Button>
            <Button onClick={onOpenInvoiceManagement}>查看待签署列表</Button>
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
                <SelectField ariaLabel="合作达人" variant="form" value={creatorId} placeholder="从达人档案选择" options={creatorOptions} onChange={selectCreator} disabled={isEditing} />
                {errors.creator ? <small>{errors.creator}</small> : null}
              </div>
              <div className={`invoice-form-control ${errors.project ? 'has-error' : ''}`}>
                <span>合作项目 *</span>
                <SelectField ariaLabel="合作项目" variant="form" value={engagementId} placeholder={creatorId ? '选择合作项目' : '请先选择达人'} options={projectOptions} onChange={selectProject} disabled={!creatorId || isEditing} />
                {errors.project ? <small>{errors.project}</small> : null}
              </div>
            </div>
            {engagementId ? (
              <div className="invoice-contract-coverage">
                <div className="invoice-contract-coverage-head">
                  <div>
                    <strong id="invoice-contract-coverage-label">关联合同（非必填）</strong>
                    <span>仅显示该项目达人已上传并确认的合同；多份合同按合计金额校验。</span>
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
                          <strong>{contract.id}</strong>
                          <small>{contract.name} · {formatContractMoney(contract)}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p>当前没有可用于校验的已确认合同，仍可按无合同流程生成 Invoice。</p>
                )}
                {Object.entries(errors).some(([key]) => key.startsWith('contract-')) ? (
                  <div className="invoice-contract-conflict" role="alert">
                    {Object.entries(errors).filter(([key]) => key.startsWith('contract-')).map(([key, message]) => (
                      <span key={key}>{message}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="invoice-builder-section">
            <header><span><FileText size={19} /></span><div><h2>2. Invoice 信息</h2><p>编号由系统生成，日期、币种与费用内容可编辑。</p></div></header>
            <div className="invoice-form-grid">
              <label className={errors.invoiceNumber ? 'has-error' : ''}><span>Invoice 编号 *</span><input value={invoiceNumber} readOnly /><small>{errors.invoiceNumber}</small></label>
              <label className={errors.invoiceDate ? 'has-error' : ''}><span>Invoice 日期 *</span><input type="date" value={invoiceDate} onChange={(event) => { setInvoiceDate(event.target.value); setGeneratedFiles(null); }} /><small>{errors.invoiceDate}</small></label>
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
              <label className={`full-width ${errors.billToName ? 'has-error' : ''}`}><span>公司名称 *</span><input value={billTo.name} onChange={(event) => setBillTo((current) => ({ ...current, name: event.target.value }))} /><small>{errors.billToName}</small></label>
              <label className={`full-width ${errors.billToAddress ? 'has-error' : ''}`}><span>公司地址 *</span><textarea value={billTo.address} onChange={(event) => setBillTo((current) => ({ ...current, address: event.target.value }))} /><small>{errors.billToAddress}</small></label>
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
                    ? '财务以 Invoice 原因退回，可重新选择达人档案中的已验证账户及相应付款方式。'
                    : requiresPayoutAccountSelection
                    ? '付款失败重新发起时，必须从达人档案中重新选择已验证账户。'
                    : contractPayoutLocked
                      ? '已继承关联合同冻结的账户版本；付款字段仅供核对。'
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
                  disabled={!selectedCreator || !payoutAccountOptions.length || contractPayoutLocked}
                  onChange={selectPayoutAccount}
                />
                <small>{errors.payoutAccountId}</small>
                <p className="invoice-payout-account-note">
                  {allowPayoutAccountChange
                    ? '保存后将冻结新的账户 ID、版本与付款快照，并同步刷新对应付款明细。'
                    : contractPayoutLocked
                    ? `合同账户版本 ${payment.payoutAccountVersion ?? 'legacy-v1'} 已锁定，不能静默切换到达人最新账户。`
                    : '选择达人档案中的已验证账户后，将冻结账户 ID、版本与付款快照。'}
                </p>
              </div>
              <div className="invoice-form-control full-width">
                <span>付款方式 *</span>
                <SelectField
                  ariaLabel="付款方式"
                  variant="form"
                  value={paymentMethod}
                  options={PAYMENT_OPTIONS}
                  disabled={requiresPayoutAccountSelection || contractPayoutLocked}
                  onChange={selectPaymentMethod}
                />
              </div>
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
            <Button icon={<WandSparkles size={17} />} disabled={generating || (isEditing && !isDirty)} onClick={generate}>{generating ? '正在生成…' : saveLabel}</Button>
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
