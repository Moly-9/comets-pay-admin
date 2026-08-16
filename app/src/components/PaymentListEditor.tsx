import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  GripHorizontal,
  Landmark,
  Minus,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  paymentListEffectiveAccount,
  paymentListItemValue,
  validatePaymentListGeneration,
  type PaymentListEditableField,
  type PaymentListId,
  type PaymentListItem,
  type PaymentListRecord,
} from '../businessWorkflow';
import type { ContractRecord } from '../contracts';
import { formatInvoiceMoney, invoiceTotal } from '../invoice/invoiceUtils';
import { PAYMENT_CURRENCY_OPTIONS } from '../paymentCurrencies';
import { eligibleInvoicePayoutAccounts, getPayoutAccountId, getPayoutAccountSelectPresentation } from '../payoutAccounts';
import type { CreatorProfile, GeneratedInvoiceRecord } from '../types';
import { Button, SelectField } from './Common';
import './PaymentListEditor.css';

type Props = {
  list: PaymentListRecord;
  invoices: GeneratedInvoiceRecord[];
  contracts: ContractRecord[];
  creators: CreatorProfile[];
  editable: boolean;
  requestPaymentProvider?: string | null;
  onUpdatePaymentItem: (paymentListId: PaymentListId, invoiceId: PaymentListItem['invoiceId'], field: PaymentListEditableField, value: string | number) => void;
  onChangePaymentAccount: (paymentListId: PaymentListId, invoiceId: PaymentListItem['invoiceId'], payoutAccountId: string) => void;
  onRevalidatePaymentItem: (paymentListId: PaymentListId, invoiceId: PaymentListItem['invoiceId']) => void;
  onClose: () => void;
};

const display = (value: unknown) => value === undefined || value === null || value === '' ? '未填写' : String(value);

const paymentDetailFields = (item: PaymentListItem) => {
  const account = paymentListEffectiveAccount(item);
  const detail = account.paymentDetails;
  if (account.provider === 'Airwallex') {
    return [
      ['Beneficiary ID', account.externalBeneficiaryId],
      ['账户名', detail?.accountName],
      ['银行国家 / 地区', detail?.bankCountry],
      ['银行名称', detail?.bankName],
      ['银行账号 / IBAN', detail?.iban || detail?.accountNumber],
      ['SWIFT Code', detail?.swiftCode],
      ['清算方式', account.localClearingSystem || account.transferMethod],
      ['收款地址', [detail?.bankStreetAddress, detail?.bankCity, detail?.bankState, detail?.bankPostalCode].filter(Boolean).join('，')],
    ];
  }
  if (account.provider === 'PayPal') {
    return [
      ['PayPal Name', detail?.paypalUsername || detail?.accountName],
      ['PayPal Email', detail?.paypalEmail],
    ];
  }
  if (account.provider === 'PayMax') {
    return [
      ['PayMax 收款账户', account.accountSummary],
      ['PayMax 账户币种', account.receiveCurrency],
      ['收款人', detail?.accountName],
    ];
  }
  return [
    ['收款账户', account.accountSummary],
    ['账户币种', account.receiveCurrency],
  ];
};

const rowIssues = (list: PaymentListRecord, item: PaymentListItem) => (
  validatePaymentListGeneration({ ...list, items: [item] }, [item.invoiceId])
    .filter((issue) => issue.code === 'INVALID_ITEM')
    .map((issue) => issue.message.replace(`${item.snapshot.invoiceNumber}：`, ''))
);

export function PaymentListEditor({
  list,
  invoices,
  contracts,
  creators,
  editable,
  requestPaymentProvider,
  onUpdatePaymentItem,
  onChangePaymentAccount,
  onRevalidatePaymentItem,
  onClose,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [bulkPaymentReason, setBulkPaymentReason] = useState('');
  const [bulkTransactionReference, setBulkTransactionReference] = useState('');
  const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | null>(null);
  const [invoicePdfError, setInvoicePdfError] = useState(false);
  const [invoicePdfZoom, setInvoicePdfZoom] = useState(1);
  const item = list.items[activeIndex];
  const invoice = item ? invoices.find((candidate) => candidate.invoiceId === item.invoiceId) : undefined;
  const creator = item ? creators.find((candidate) => candidate.id === item.snapshot.creatorId) : undefined;
  const account = item ? paymentListEffectiveAccount(item) : null;
  const issues = item ? rowIssues(list, item) : [];
  const editorRef = useRef<HTMLDivElement>(null);
  const snapshot = invoice?.snapshot;
  const linkedContracts = snapshot?.contractIds?.map((contractId) => contracts.find((contract) => contract.contractId === contractId || contract.id === contractId)).filter((contract): contract is ContractRecord => Boolean(contract)) ?? [];
  const contractFeeBearers = [...new Set(linkedContracts.map((contract) => contract.feeBearer).filter(Boolean))];
  const feeBearerOptions = [
    { value: 'ADVERTISER', label: '付款方' },
    { value: 'PUBLISHER', label: '收款方' },
    { value: 'SHARED', label: '各自承担' },
  ] as const;
  const transferMethodOptions = account?.provider === 'PayPal'
    ? [{ value: 'PAYPAL', label: 'PayPal' }]
    : [{ value: 'LOCAL', label: 'LOCAL' }, { value: 'SWIFT', label: 'SWIFT' }];

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setInvoicePdfUrl(null);
    setInvoicePdfError(false);
    setInvoicePdfZoom(1);
    if (!snapshot) return () => undefined;
    void import('../invoice/generateInvoice')
      .then(({ generateInvoicePdf }) => generateInvoicePdf(snapshot))
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setInvoicePdfUrl(objectUrl);
      })
      .catch(() => {
        if (active) setInvoicePdfError(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoice?.invoiceId, snapshot]);
  const accountOptions = useMemo(() => {
    if (!creator || !item) return [];
    const eligible = eligibleInvoicePayoutAccounts(creator)
      .filter((candidate) => !requestPaymentProvider || candidate.provider === requestPaymentProvider);
    const current = creator.payoutAccounts.find((candidate) => getPayoutAccountId(candidate) === account?.payoutAccountId);
    const visible = current && !eligible.some((candidate) => getPayoutAccountId(candidate) === getPayoutAccountId(current))
      ? [...eligible, current]
      : eligible;
    const eligibleIds = new Set(eligible.map(getPayoutAccountId));
    return visible.map((candidate) => ({
      value: getPayoutAccountId(candidate),
      ...getPayoutAccountSelectPresentation(candidate),
      disabled: !eligibleIds.has(getPayoutAccountId(candidate)),
    }));
  }, [account?.payoutAccountId, creator, item, requestPaymentProvider]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setActiveIndex((current) => Math.max(0, current - 1));
      if (event.key === 'ArrowRight') setActiveIndex((current) => Math.min(list.items.length - 1, current + 1));
    };
    editorRef.current?.addEventListener('keydown', handleKeyDown);
    return () => editorRef.current?.removeEventListener('keydown', handleKeyDown);
  }, [list.items.length]);

  if (!item || !account) {
    return <div className="payment-list-editor-empty"><ReceiptText size={28} /><strong>暂无可编辑的付款明细</strong><Button variant="secondary" onClick={onClose}>返回付款清单</Button></div>;
  }

  const update = (field: PaymentListEditableField, value: string | number) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, field, value);
  const applyBulkField = (field: 'paymentReason' | 'transactionReference', value: string) => {
    if (!editable || !value.trim()) return;
    list.items.forEach((paymentItem) => {
      onUpdatePaymentItem(list.paymentListId, paymentItem.invoiceId, field, value);
    });
  };
  const move = (direction: -1 | 1) => setActiveIndex((current) => Math.min(Math.max(0, current + direction), list.items.length - 1));
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => setDragStartX(event.clientX);
  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartX === null) return;
    const delta = event.clientX - dragStartX;
    if (Math.abs(delta) > 48) move(delta < 0 ? 1 : -1);
    setDragStartX(null);
  };
  const contractCount = snapshot?.contractIds?.filter((id) => contracts.some((contract) => contract.contractId === id || contract.id === id)).length ?? item.snapshot.contractIds?.length ?? 0;
  const transferMethod = String(paymentListItemValue(item, 'transferMethod') || account.transferMethod || '');
  const feeBearer = String(paymentListItemValue(item, 'feeBearer') || contractFeeBearers[0] || '');
  const feeBearerFromContract = linkedContracts.length > 0;

  return (
    <div
      ref={editorRef}
      className="payment-list-editor"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDragStartX(null)}
      aria-label="逐笔付款明细编辑器"
    >
      <header className="payment-list-editor-header">
        <div className="payment-list-editor-header-summary"><span className="payment-list-editor-kicker">付款明细 {activeIndex + 1} / {list.items.length}</span><strong>{item.snapshot.creatorName}</strong><small>{item.snapshot.invoiceNumber} · {account.provider}</small></div>
        <div className="payment-list-editor-header-actions">
          <span className={`payment-list-editor-state ${issues.length ? 'is-warning' : 'is-ready'}`}>{issues.length ? <CircleAlert size={15} /> : <CheckCircle2 size={15} />}{issues.length ? '待完善' : '已完成'}</span>
          <section className="payment-list-editor-bulk-fill" aria-label="整单批量填入">
            <div className="payment-list-editor-bulk-fill-heading">
              <strong>整单批量填入</strong>
              <span>输入内容后应用到当前付款清单的 {list.items.length} 笔付款</span>
            </div>
            <div className="payment-list-editor-bulk-fill-fields">
              <label>
                付款原因
                <div>
                  <input aria-label="整单付款原因" placeholder="输入后填入全部付款行" value={bulkPaymentReason} disabled={!editable} onChange={(event) => setBulkPaymentReason(event.target.value)} />
                  <Button variant="secondary" disabled={!editable || !bulkPaymentReason.trim() || !list.items.length} onClick={() => applyBulkField('paymentReason', bulkPaymentReason)}>填入全部</Button>
                </div>
              </label>
              <label>
                交易附言
                <div>
                  <input aria-label="整单交易附言" placeholder="输入后填入全部付款行" value={bulkTransactionReference} disabled={!editable} onChange={(event) => setBulkTransactionReference(event.target.value)} />
                  <Button variant="secondary" disabled={!editable || !bulkTransactionReference.trim() || !list.items.length} onClick={() => applyBulkField('transactionReference', bulkTransactionReference)}>填入全部</Button>
                </div>
              </label>
            </div>
          </section>
        </div>
      </header>

      <div className="payment-list-editor-progress" aria-label="付款明细进度">
        {list.items.map((candidate, index) => <button key={candidate.id} type="button" className={index === activeIndex ? 'is-active' : ''} aria-label={`查看第 ${index + 1} 笔付款`} onClick={() => setActiveIndex(index)}><span className={rowIssues(list, candidate).length ? 'is-warning' : ''}>{index + 1}</span></button>)}
      </div>

      <div className="payment-list-editor-body">
        <section className="payment-list-editor-invoice" aria-label="Invoice 快照">
          <div className="payment-list-editor-section-title"><span><ReceiptText size={16} /></span><div><strong>Invoice 快照</strong><small>付款清单使用的来源凭证</small></div></div>
          <div className="payment-list-editor-pdf-toolbar">
            <strong>Invoice PDF 文件快照</strong>
            <div>
              <Button variant="ghost" icon={<Minus size={14} />} aria-label="缩小 Invoice 快照" title="缩小" disabled={invoicePdfZoom <= 0.8} onClick={() => setInvoicePdfZoom((value) => Math.max(0.8, Number((value - 0.1).toFixed(1))))} />
              <span>{Math.round(invoicePdfZoom * 100)}%</span>
              <Button variant="ghost" icon={<Plus size={14} />} aria-label="放大 Invoice 快照" title="放大" disabled={invoicePdfZoom >= 1.5} onClick={() => setInvoicePdfZoom((value) => Math.min(1.5, Number((value + 0.1).toFixed(1))))} />
              <Button variant="ghost" icon={<RotateCcw size={14} />} aria-label="重置 Invoice 快照缩放" title="重置" disabled={invoicePdfZoom === 1} onClick={() => setInvoicePdfZoom(1)} />
            </div>
          </div>
          <div className="payment-list-editor-pdf-viewport">
            {invoicePdfUrl ? <iframe title={`${item.snapshot.invoiceNumber} Invoice PDF 快照`} src={invoicePdfUrl} style={{ width: `${100 / invoicePdfZoom}%`, height: `${100 / invoicePdfZoom}%`, transform: `scale(${invoicePdfZoom})`, transformOrigin: 'top left' }} /> : <div className="payment-list-editor-pdf-state">{invoicePdfError ? 'Invoice PDF 快照生成失败，以下为结构化快照' : '正在生成 Invoice PDF 快照…'}</div>}
          </div>
          <dl className="payment-list-editor-snapshot-grid">
            <div><dt>Invoice 编号</dt><dd>{display(snapshot?.invoiceNumber ?? item.snapshot.invoiceNumber)}</dd></div>
            <div><dt>达人</dt><dd>{display(snapshot?.creatorName ?? item.snapshot.creatorName)}<small>{display(snapshot?.creatorHandle)}</small></dd></div>
            <div><dt>Real Name</dt><dd>{display(snapshot?.from.legalName ?? item.snapshot.realName)}</dd></div>
            <div><dt>Invoice 金额</dt><dd>{snapshot ? formatInvoiceMoney(snapshot.currency, invoiceTotal(snapshot)) : `${item.snapshot.currency} ${item.snapshot.amount.toLocaleString('en-US')}`}</dd></div>
            <div><dt>Invoice 日期</dt><dd>{display(snapshot?.invoiceDate)}</dd></div>
            <div><dt>关联合同</dt><dd>{contractCount ? `${contractCount} 份` : '未关联'}</dd></div>
          </dl>
          <div className="payment-list-editor-invoice-lines">
            <strong>费用明细</strong>
            {(snapshot?.items ?? []).map((line) => <div key={line.id}><span>{line.description}</span><b>{line.quantity} × {line.unitPrice.toLocaleString('en-US')} {snapshot?.currency}</b></div>)}
          </div>
          <div className="payment-list-editor-frozen-note"><ShieldCheck size={15} />账户和 Invoice 信息来自已冻结快照，修改源资料不会自动改写本笔付款。</div>
        </section>

        <section className="payment-list-editor-payment" aria-label="付款明细">
          <div className="payment-list-editor-section-title"><span className="is-payment"><Landmark size={16} /></span><div><strong>{account.provider} 付款明细</strong><small>完成渠道支付所需的信息</small></div></div>
          <div className="payment-list-editor-fields">
            <label className="is-wide">收款账户<SelectField ariaLabel="编辑付款收款账户" variant="form" value={account.payoutAccountId ?? ''} options={accountOptions} placeholder="选择收款账户" disabled={!editable || !accountOptions.length} onChange={(value) => onChangePaymentAccount(list.paymentListId, item.invoiceId, value)} /></label>
            <label>支付币种<SelectField ariaLabel="编辑付款支付币种" variant="form" value={String(paymentListItemValue(item, 'currency'))} options={PAYMENT_CURRENCY_OPTIONS} disabled={!editable} onChange={(value) => update('currency', value)} /></label>
            <label>收款币种<SelectField ariaLabel="编辑付款收款币种" variant="form" value={String(paymentListItemValue(item, 'receiveCurrency'))} options={PAYMENT_CURRENCY_OPTIONS} disabled={!editable} onChange={(value) => update('receiveCurrency', value)} /></label>
            <label>付款金额<input aria-label="编辑付款金额" type="number" min="0" step="0.01" value={paymentListItemValue(item, 'amount')} disabled={!editable} onChange={(event) => update('amount', Number(event.target.value))} /></label>
            <label>转账方式<SelectField ariaLabel="编辑付款转账方式" variant="form" value={transferMethod} options={transferMethodOptions} disabled={!editable} onChange={(value) => update('transferMethod', value)} /></label>
            <label>手续费承担方{feeBearerFromContract ? <input readOnly value={display(feeBearer)} /> : <SelectField ariaLabel="编辑付款手续费承担方" variant="form" value={feeBearer} options={feeBearerOptions} placeholder="请选择手续费承担方" disabled={!editable} onChange={(value) => update('feeBearer', value)} />}</label>
            <label>付款原因<input aria-label="编辑付款原因" value={paymentListItemValue(item, 'paymentReason')} disabled={!editable} onChange={(event) => update('paymentReason', event.target.value)} /></label>
            <label>交易附言<input aria-label="编辑交易附言" placeholder="请输入交易附言" value={paymentListItemValue(item, 'transactionReference')} disabled={!editable} onChange={(event) => update('transactionReference', event.target.value)} /></label>
            <label className="is-wide">描述<input aria-label="编辑付款描述" placeholder="请输入付款描述（选填）" value={paymentListItemValue(item, 'description')} disabled={!editable} onChange={(event) => update('description', event.target.value)} /></label>
          </div>
          <div className="payment-list-editor-account-details"><strong>账户快照</strong>{paymentDetailFields(item).map(([label, value]) => <div key={label}><span>{label}</span><b>{display(value)}</b></div>)}</div>
          <div className={`payment-list-editor-validation ${issues.length ? 'is-warning' : 'is-ready'}`} role="status"><span>{issues.length ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}</span><div><strong>{issues.length ? `还需完善 ${issues.length} 项` : '本笔付款信息完整'}</strong>{issues.length ? <ul>{issues.slice(0, 4).map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>可以切换下一笔付款，所有明细完成后生成付款清单。</p>}</div>{editable && item.requiresRevalidation ? <Button variant="ghost" onClick={() => onRevalidatePaymentItem(list.paymentListId, item.invoiceId)}>重新校验</Button> : null}</div>
        </section>
      </div>

      <footer className="payment-list-editor-footer">
        <span><GripHorizontal size={15} />可左右滑动切换付款明细</span>
        <div><Button variant="secondary" icon={<ChevronLeft size={16} />} disabled={activeIndex === 0} onClick={() => move(-1)}>上一笔</Button><Button variant="secondary" icon={<ChevronRight size={16} />} disabled={activeIndex === list.items.length - 1} onClick={() => move(1)}>下一笔</Button><Button onClick={onClose}>确定</Button></div>
      </footer>
    </div>
  );
}
