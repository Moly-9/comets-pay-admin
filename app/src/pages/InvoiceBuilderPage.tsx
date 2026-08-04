import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Plus,
  Trash2,
  UserRound,
  WalletCards,
  WandSparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { InvoiceDocumentView } from '../components/InvoiceDocumentView';
import {
  downloadBlob,
  formatInvoiceMoney,
  invoiceFilename,
  invoiceTotal,
  nextInvoiceNumber,
  normalizeLineItem,
  todayInputValue,
} from '../invoice/invoiceUtils';
import { invoicePaymentForCreator } from '../payoutAccounts';
import type {
  CreatorInvoiceContact,
  CreatorPaymentDetails,
  CreatorProfile,
  GeneratedInvoiceRecord,
  InvoiceCurrency,
  InvoiceDocumentModel,
  InvoiceEntity,
  InvoiceLineItem,
  InvoicePaymentMethod,
  Payout,
} from '../types';

type InvoiceBuilderPageProps = {
  creators: CreatorProfile[];
  payouts: Payout[];
  invoiceEntity: InvoiceEntity;
  generatedInvoices: GeneratedInvoiceRecord[];
  onGenerated: (record: GeneratedInvoiceRecord) => void;
  onCancel: () => void;
  onOpenInvoiceManagement: () => void;
};

type GeneratedFiles = {
  record: GeneratedInvoiceRecord;
  pdfBlob: Blob;
  docxBlob: Blob;
} | null;

const EMPTY_CONTACT: CreatorInvoiceContact = { legalName: '', address: '', phone: '', email: '' };
const EMPTY_PAYMENT: CreatorPaymentDetails = {
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
] as const;

const PAYMENT_OPTIONS = [
  { value: 'bank', label: 'Bank transfer', description: '使用达人银行收款资料' },
  { value: 'paypal', label: 'PayPal', description: '使用达人 PayPal 用户名与邮箱' },
] as const;

const createBlankLine = (index: number): InvoiceLineItem => ({
  id: `line-${Date.now()}-${index}`,
  description: '',
  unitPrice: 0,
  quantity: 1,
  lineTotal: 0,
});

const updatePaymentValue = (
  payment: CreatorPaymentDetails,
  field: keyof CreatorPaymentDetails,
  value: string,
) => ({ ...payment, [field]: value });

export function InvoiceBuilderPage({
  creators,
  payouts,
  invoiceEntity,
  generatedInvoices,
  onGenerated,
  onCancel,
  onOpenInvoiceManagement,
}: InvoiceBuilderPageProps) {
  const [creatorHandle, setCreatorHandle] = useState('');
  const [payoutId, setPayoutId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(() => nextInvoiceNumber(generatedInvoices));
  const [invoiceDate, setInvoiceDate] = useState(() => todayInputValue());
  const [billTo, setBillTo] = useState<InvoiceEntity>({ ...invoiceEntity });
  const [from, setFrom] = useState<CreatorInvoiceContact>({ ...EMPTY_CONTACT });
  const [currency, setCurrency] = useState<InvoiceCurrency>('USD');
  const [items, setItems] = useState<InvoiceLineItem[]>([createBlankLine(0)]);
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod>('bank');
  const [payment, setPayment] = useState<CreatorPaymentDetails>({ ...EMPTY_PAYMENT });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFiles>(null);

  const selectedCreator = creators.find((creator) => creator.handle === creatorHandle) ?? null;
  const creatorPayouts = useMemo(() => payouts.filter((payout) => payout.handle === creatorHandle), [creatorHandle, payouts]);
  const selectedPayout = creatorPayouts.find((payout) => payout.id === payoutId) ?? null;
  const creatorOptions = creators.map((creator) => ({
    value: creator.handle,
    label: creator.name,
    description: `${creator.handle} · ${creator.region} · ${creator.platform}`,
  }));
  const projectOptions = creatorPayouts.map((payout) => ({
    value: payout.id,
    label: payout.project,
    description: `${payout.currency} ${payout.amount.toLocaleString('en-US')} · ${payout.deliverable ?? '达人合作服务费'}`,
  }));

  const model = useMemo<InvoiceDocumentModel>(() => ({
    invoiceNumber,
    invoiceDate,
    billTo,
    creatorHandle,
    creatorName: selectedCreator?.name ?? '',
    creatorId: selectedCreator?.id,
    engagementId: selectedCreator && selectedPayout ? `ENG-${selectedPayout.projectId}-${selectedCreator.id}` : undefined,
    projectId: selectedPayout?.projectId ?? '',
    projectName: selectedPayout?.project ?? '',
    from,
    currency,
    items: items.map(normalizeLineItem),
    paymentMethod,
    payment,
  }), [billTo, creatorHandle, currency, from, invoiceDate, invoiceNumber, items, payment, paymentMethod, selectedCreator?.id, selectedCreator?.name, selectedPayout]);

  const selectCreator = (handle: string) => {
    const creator = creators.find((item) => item.handle === handle);
    setCreatorHandle(handle);
    setPayoutId('');
    setFrom(creator ? { ...creator.contact } : { ...EMPTY_CONTACT });
    setPayment(invoicePaymentForCreator(creator, paymentMethod === 'paypal' ? 'PayPal' : 'Airwallex'));
    setItems([createBlankLine(0)]);
    setErrors({});
    setGeneratedFiles(null);
  };

  const selectProject = (id: string) => {
    const payout = payouts.find((item) => item.id === id);
    setPayoutId(id);
    if (!payout) return;
    setCurrency(payout.currency);
    setPaymentMethod(payout.provider === 'PayPal' ? 'paypal' : 'bank');
    setPayment(invoicePaymentForCreator(
      creators.find((creator) => creator.handle === payout.handle),
      payout.provider,
    ));
    setItems([normalizeLineItem({
      id: `line-${payout.id}`,
      description: payout.deliverable || `${payout.project} 达人合作服务费`,
      unitPrice: payout.amount,
      quantity: 1,
    })]);
    setErrors({});
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
    const nextErrors: Record<string, string> = {};
    if (!creatorHandle) nextErrors.creator = '请选择达人';
    if (!payoutId) nextErrors.project = '请选择该达人关联的项目';
    if (!invoiceNumber.trim()) nextErrors.invoiceNumber = 'Invoice 编号不能为空';
    if (!invoiceDate) nextErrors.invoiceDate = '请选择 Invoice 日期';
    if (!billTo.name.trim()) nextErrors.billToName = '请填写 Bill To 公司名称';
    if (!billTo.address.trim()) nextErrors.billToAddress = '请填写 Bill To 地址';
    if (!from.legalName.trim()) nextErrors.legalName = '请填写真实姓名';
    if (!from.address.trim()) nextErrors.address = '请填写联系地址';
    if (!from.phone.trim()) nextErrors.phone = '请填写联系电话';
    if (!from.email.trim() || !/^\S+@\S+\.\S+$/.test(from.email)) nextErrors.email = '请填写有效联系邮箱';
    items.forEach((item, index) => {
      if (!item.description.trim()) nextErrors[`item-${item.id}-description`] = `第 ${index + 1} 项缺少费用描述`;
      if (!(item.unitPrice > 0)) nextErrors[`item-${item.id}-unitPrice`] = `第 ${index + 1} 项单价必须大于 0`;
      if (!(item.quantity > 0)) nextErrors[`item-${item.id}-quantity`] = `第 ${index + 1} 项数量必须大于 0`;
    });
    if (paymentMethod === 'bank') {
      if (!payment.accountName.trim()) nextErrors.accountName = '请填写银行账户名';
      if (!payment.accountNumber.trim() && !payment.iban.trim()) nextErrors.accountNumber = '银行账号与 IBAN 至少填写一项';
    } else {
      if (!payment.paypalUsername.trim()) nextErrors.paypalUsername = '请填写 PayPal Name';
      if (!payment.paypalEmail.trim() || !/^\S+@\S+\.\S+$/.test(payment.paypalEmail)) nextErrors.paypalEmail = '请填写有效 PayPal Email';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const generate = async () => {
    setGenerationError('');
    if (!validate()) {
      window.requestAnimationFrame(() => document.querySelector('.invoice-builder-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    if (!selectedPayout) {
      setGenerationError('关联付款记录已失效，请重新选择项目。');
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
      const record: GeneratedInvoiceRecord = {
        id: snapshot.invoiceNumber,
        sourcePayoutId: selectedPayout.id,
        status: '待签署',
        generatedAt: new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date()),
        snapshot,
      };
      onGenerated(record);
      setGeneratedFiles({ record, pdfBlob, docxBlob });
      setInvoiceNumber(nextInvoiceNumber([record, ...generatedInvoices]));
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : '文件生成失败，请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="page-stack invoice-builder-page">
      <PageHeading
        title="生成 Invoice"
        subtitle="从达人档案与项目费用中自动带入资料，确认后同时生成 PDF 与 DOCX。"
        actions={<Button variant="secondary" icon={<ArrowLeft size={17} />} onClick={onCancel}>返回 Invoice 管理</Button>}
      />
      <NoticeBanner>生成文件会保留空白签名区；当前为前端原型，生成记录仅在本次会话内保留。</NoticeBanner>
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
            <header><span><UserRound size={19} /></span><div><h2>1. 达人与项目</h2><p>项目列表仅展示与所选达人关联的费用记录。</p></div></header>
            <div className="invoice-form-grid">
              <div className={`invoice-form-control ${errors.creator ? 'has-error' : ''}`}>
                <span>合作达人 *</span>
                <SelectField ariaLabel="合作达人" variant="form" value={creatorHandle} placeholder="从达人档案选择" options={creatorOptions} onChange={selectCreator} />
                {errors.creator ? <small>{errors.creator}</small> : null}
              </div>
              <div className={`invoice-form-control ${errors.project ? 'has-error' : ''}`}>
                <span>关联项目 *</span>
                <SelectField ariaLabel="关联项目" variant="form" value={payoutId} placeholder={creatorHandle ? '选择关联项目' : '请先选择达人'} options={projectOptions} onChange={selectProject} disabled={!creatorHandle} />
                {errors.project ? <small>{errors.project}</small> : null}
              </div>
            </div>
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
                  <label className={errors[`item-${item.id}-quantity`] ? 'has-error' : ''}><span>AMOUNT</span><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => changeLine(item.id, 'quantity', event.target.value)} /><small>{errors[`item-${item.id}-quantity`]}</small></label>
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
            <header><span><WalletCards size={19} /></span><div><h2>4. 收款方式</h2><p>根据项目渠道自动选择，仍可切换并编辑本次快照。</p></div></header>
            <div className="invoice-form-grid">
              <div className="invoice-form-control full-width"><span>付款方式 *</span><SelectField ariaLabel="付款方式" variant="form" value={paymentMethod} options={PAYMENT_OPTIONS} onChange={(value) => {
                setPaymentMethod(value);
                setPayment(invoicePaymentForCreator(selectedCreator, value === 'paypal' ? 'PayPal' : 'Airwallex'));
                setGeneratedFiles(null);
              }} /></div>
              {paymentMethod === 'bank' ? (
                <>
                  <label className={errors.accountName ? 'has-error' : ''}><span>Account Name *</span><input value={payment.accountName} onChange={(event) => setPayment((current) => updatePaymentValue(current, 'accountName', event.target.value))} /><small>{errors.accountName}</small></label>
                  <label className={errors.accountNumber ? 'has-error' : ''}><span>Account Number（与 IBAN 二选一）</span><input value={payment.accountNumber} onChange={(event) => setPayment((current) => updatePaymentValue(current, 'accountNumber', event.target.value))} /><small>{errors.accountNumber}</small></label>
                  <label><span>IBAN（与 Account Number 二选一）</span><input value={payment.iban} onChange={(event) => setPayment((current) => updatePaymentValue(current, 'iban', event.target.value))} /></label>
                  <label><span>Beneficiary Bank Name（可选）</span><input value={payment.bankName} onChange={(event) => setPayment((current) => updatePaymentValue(current, 'bankName', event.target.value))} /></label>
                  <label><span>Swift Code（SWIFT 路径时填写）</span><input value={payment.swiftCode} onChange={(event) => setPayment((current) => updatePaymentValue(current, 'swiftCode', event.target.value))} /></label>
                  <label className="full-width"><span>Beneficiary Bank Address（Schema 要求时填写）</span><textarea value={payment.bankStreetAddress} onChange={(event) => setPayment((current) => updatePaymentValue(current, 'bankStreetAddress', event.target.value))} /></label>
                </>
              ) : (
                <>
                  <label className={errors.paypalUsername ? 'has-error' : ''}><span>Paypal Name *</span><input value={payment.paypalUsername} onChange={(event) => setPayment((current) => updatePaymentValue(current, 'paypalUsername', event.target.value))} /><small>{errors.paypalUsername}</small></label>
                  <label className={errors.paypalEmail ? 'has-error' : ''}><span>Paypal Email *</span><input type="email" value={payment.paypalEmail} onChange={(event) => setPayment((current) => updatePaymentValue(current, 'paypalEmail', event.target.value))} /><small>{errors.paypalEmail}</small></label>
                </>
              )}
            </div>
          </div>

          <div className="invoice-builder-footer">
            <Button variant="ghost" onClick={onCancel}>取消</Button>
            <Button icon={<WandSparkles size={17} />} disabled={generating} onClick={generate}>{generating ? '正在生成…' : '生成 PDF + DOCX'}</Button>
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
