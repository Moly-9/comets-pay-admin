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
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { accountDisplayValue } from '../accountPresentation';
import {
  paymentListEffectiveAccount,
  paymentListContractFeeBearer,
  paymentListItemValue,
  validatePaymentListGeneration,
  type PaymentListEditableField,
  type PaymentListId,
  type PaymentListItem,
  type PaymentListRecord,
} from '../businessWorkflow';
import type { ContractRecord } from '../contracts';
import { PAYMENT_CURRENCY_OPTIONS } from '../paymentCurrencies';
import { eligibleInvoicePayoutAccounts, getPayoutAccountId, getPayoutAccountSelectPresentation } from '../payoutAccounts';
import type { CreatorProfile, GeneratedInvoiceRecord } from '../types';
import { Button, SelectField } from './Common';
import { InvoiceDocumentView } from './InvoiceDocumentView';
import { paymentProviderDisplayName } from './PaymentProviderBadge';
import './PaymentListEditor.css';

type Props = {
  list: PaymentListRecord;
  initialInvoiceId?: PaymentListItem['invoiceId'];
  invoices: GeneratedInvoiceRecord[];
  contracts: ContractRecord[];
  creators: CreatorProfile[];
  editable: boolean;
  accountEditableInvoiceIds?: PaymentListItem['invoiceId'][];
  accountOverrideOnly?: boolean;
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
    const schemaFields = detail?.schemaFields ?? [];
    const schemaValues = detail?.schemaValues ?? {};
    if (schemaFields.length) {
      return [
        ['Beneficiary ID', account.externalBeneficiaryId],
        ...schemaFields
          .filter((field) => field.path !== 'transfer_method')
          .filter((field) => field.required || String(schemaValues[field.path] ?? '').trim())
          .map((field) => [field.label, schemaValues[field.path]]),
      ];
    }
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
      ['Payer Max 收款账户', accountDisplayValue(account.accountSummary)],
      ['Payer Max 账户币种', account.receiveCurrency],
      ['收款人', detail?.accountName],
    ];
  }
  return [
    ['收款账户', accountDisplayValue(account.accountSummary)],
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
  initialInvoiceId,
  invoices,
  contracts,
  creators,
  editable,
  accountEditableInvoiceIds = [],
  accountOverrideOnly = false,
  requestPaymentProvider,
  onUpdatePaymentItem,
  onChangePaymentAccount,
  onRevalidatePaymentItem,
  onClose,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(() => initialInvoiceId ? Math.max(0, list.items.findIndex((candidate) => candidate.invoiceId === initialInvoiceId)) : 0);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [bulkPaymentReason, setBulkPaymentReason] = useState('');
  const [bulkTransactionReference, setBulkTransactionReference] = useState('');
  const [invoicePdfZoom, setInvoicePdfZoom] = useState(1);
  const item = list.items[activeIndex];
  const invoice = item ? invoices.find((candidate) => candidate.invoiceId === item.invoiceId) : undefined;
  const creator = item ? creators.find((candidate) => candidate.id === item.snapshot.creatorId) : undefined;
  const account = item ? paymentListEffectiveAccount(item) : null;
  const issues = item ? rowIssues(list, item) : [];
  const editorRef = useRef<HTMLDivElement>(null);
  const snapshot = invoice?.snapshot;
  const linkedContracts = snapshot?.contractIds?.map((contractId) => contracts.find((contract) => contract.contractId === contractId || contract.id === contractId)).filter((contract): contract is ContractRecord => Boolean(contract)) ?? [];
  const contractFeeBearer = paymentListContractFeeBearer(linkedContracts);
  const feeBearerOptions = [
    { value: 'ADVERTISER', label: '付款方' },
    { value: 'PUBLISHER', label: '收款方' },
    { value: 'SHARED', label: '各自承担' },
  ] as const;
  const transferMethodOptions = account?.provider === 'PayPal'
    ? [{ value: 'PAYPAL', label: 'PayPal' }]
    : [{ value: 'LOCAL', label: 'LOCAL' }, { value: 'SWIFT', label: 'SWIFT' }];

  useEffect(() => setInvoicePdfZoom(1), [invoice?.invoiceId]);
  useEffect(() => {
    if (!initialInvoiceId) return;
    const nextIndex = list.items.findIndex((candidate) => candidate.invoiceId === initialInvoiceId);
    if (nextIndex >= 0) setActiveIndex(nextIndex);
  }, [initialInvoiceId, list.items]);
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
  const paymentFieldsEditable = editable && !accountOverrideOnly;
  const applyBulkField = (field: 'paymentReason' | 'transactionReference', value: string) => {
    if (!paymentFieldsEditable || !value.trim()) return;
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
  const transferMethod = String(paymentListItemValue(item, 'transferMethod') || account.transferMethod || '');
  const feeBearer = String(contractFeeBearer.locked
    ? contractFeeBearer.value
    : paymentListItemValue(item, 'feeBearer') || '');
  const accountEditable = editable && accountEditableInvoiceIds.includes(item.invoiceId);

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
        <div className="payment-list-editor-header-summary"><span className="payment-list-editor-kicker">付款明细 {activeIndex + 1} / {list.items.length}</span><strong>{item.snapshot.creatorName}</strong><small>{item.snapshot.invoiceNumber} · {paymentProviderDisplayName(account.provider)}</small></div>
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
                  <input aria-label="整单付款原因" placeholder="输入后填入全部付款行" value={bulkPaymentReason} disabled={!paymentFieldsEditable} onChange={(event) => setBulkPaymentReason(event.target.value)} />
                  <Button variant="secondary" disabled={!paymentFieldsEditable || !bulkPaymentReason.trim() || !list.items.length} disabledReason={!paymentFieldsEditable ? '当前付款清单已锁定，不能批量修改。' : !list.items.length ? '付款清单没有可填写的明细。' : '请先填写付款原因。'} onClick={() => applyBulkField('paymentReason', bulkPaymentReason)}>填入全部</Button>
                </div>
              </label>
              <label>
                交易附言
                <div>
                  <input aria-label="整单交易附言" placeholder="输入后填入全部付款行" value={bulkTransactionReference} disabled={!paymentFieldsEditable} onChange={(event) => setBulkTransactionReference(event.target.value)} />
                  <Button variant="secondary" disabled={!paymentFieldsEditable || !bulkTransactionReference.trim() || !list.items.length} disabledReason={!paymentFieldsEditable ? '当前付款清单已锁定，不能批量修改。' : !list.items.length ? '付款清单没有可填写的明细。' : '请先填写交易附言。'} onClick={() => applyBulkField('transactionReference', bulkTransactionReference)}>填入全部</Button>
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
          <div
            className="payment-list-editor-invoice-canvas"
            tabIndex={0}
            aria-label={`${item.snapshot.invoiceNumber} Invoice 快照查看区`}
            onKeyDown={(event) => {
              if (!event.ctrlKey && !event.metaKey) return;
              if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                setInvoicePdfZoom((value) => Math.min(1.5, Number((value + 0.1).toFixed(1))));
              } else if (event.key === '-') {
                event.preventDefault();
                setInvoicePdfZoom((value) => Math.max(0.8, Number((value - 0.1).toFixed(1))));
              } else if (event.key === '0') {
                event.preventDefault();
                setInvoicePdfZoom(1);
              }
            }}
          >
            {snapshot ? (
              <div className="payment-list-editor-invoice-zoom-stage" style={{ '--payment-editor-invoice-zoom': invoicePdfZoom } as CSSProperties}>
                <InvoiceDocumentView model={snapshot} ariaLabel={`${item.snapshot.invoiceNumber} Invoice 快照`} />
              </div>
            ) : <div className="payment-list-editor-pdf-state">未找到 Invoice 快照</div>}
          </div>
        </section>

        <section className="payment-list-editor-payment" aria-label="付款明细">
          <div className="payment-list-editor-section-title"><span className="is-payment"><Landmark size={16} /></span><div><strong>{paymentProviderDisplayName(account.provider)} 付款明细</strong><small>完成渠道支付所需的信息</small></div></div>
          <div className={`payment-list-editor-source-lock${accountEditable ? ' is-warning' : ''}`} role="note">
            {accountEditable ? <CircleAlert size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
            <span>{accountEditable ? '当前为付款失败明细，仅允许更换本次实际执行账户；Invoice 签署账户保持不变。' : '金额、币种和收款账户来自 Invoice 签署冻结快照，当前保持只读。'}</span>
          </div>
          <div className="payment-list-editor-fields">
            <label className="is-wide">{accountEditable ? '本次执行账户' : 'Invoice 签署账户'}<SelectField ariaLabel="付款收款账户" variant="form" value={account.payoutAccountId ?? ''} options={accountOptions} placeholder="选择收款账户" disabled={!accountEditable || !accountOptions.length} onChange={(value) => onChangePaymentAccount(list.paymentListId, item.invoiceId, value)} /></label>
            <label>支付币种<SelectField ariaLabel="付款支付币种" variant="form" value={String(paymentListItemValue(item, 'currency'))} options={PAYMENT_CURRENCY_OPTIONS} disabled onChange={(value) => update('currency', value)} /></label>
            <label>收款币种<SelectField ariaLabel="付款收款币种" variant="form" value={String(paymentListItemValue(item, 'receiveCurrency'))} options={PAYMENT_CURRENCY_OPTIONS} disabled onChange={(value) => update('receiveCurrency', value)} /></label>
            <label>付款金额<input aria-label="付款金额" type="number" min="0" step="0.01" value={paymentListItemValue(item, 'amount')} disabled /></label>
            <label>转账方式<SelectField ariaLabel="付款转账方式" variant="form" value={transferMethod} options={transferMethodOptions} disabled onChange={(value) => update('transferMethod', value)} /></label>
            <label>手续费承担方{contractFeeBearer.locked ? <input readOnly value={display(feeBearer)} /> : <SelectField ariaLabel="编辑付款手续费承担方" variant="form" value={feeBearer} options={feeBearerOptions} placeholder={contractFeeBearer.conflicting ? '合同约定不一致，请确认' : '合同未约定，请填写'} disabled={!paymentFieldsEditable} onChange={(value) => update('feeBearer', value)} />}</label>
            <label>付款原因<input aria-label="编辑付款原因" value={paymentListItemValue(item, 'paymentReason')} disabled={!paymentFieldsEditable} onChange={(event) => update('paymentReason', event.target.value)} /></label>
            <label>交易附言<input aria-label="编辑交易附言" placeholder="请输入交易附言" value={paymentListItemValue(item, 'transactionReference')} disabled={!paymentFieldsEditable} onChange={(event) => update('transactionReference', event.target.value)} /></label>
            <label className="is-wide">描述<input aria-label="编辑付款描述" placeholder="请输入付款描述（选填）" value={paymentListItemValue(item, 'description')} disabled={!paymentFieldsEditable} onChange={(event) => update('description', event.target.value)} /></label>
          </div>
          <div className="payment-list-editor-account-details"><strong>账户快照</strong><small>Airwallex Form Schema 账户字段</small>{paymentDetailFields(item).map(([label, value]) => <div key={label}><span>{label}</span><b>{display(value)}</b></div>)}</div>
          <div className={`payment-list-editor-validation ${issues.length ? 'is-warning' : 'is-ready'}`} role="status"><span>{issues.length ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}</span><div><strong>{issues.length ? `还需完善 ${issues.length} 项付款信息` : '付款信息与交易信息完整'}</strong>{issues.length ? <ul>{issues.slice(0, 4).map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>可以切换下一笔付款，所有明细完成后生成付款清单。</p>}</div>{editable && item.requiresRevalidation ? <Button variant="ghost" onClick={() => onRevalidatePaymentItem(list.paymentListId, item.invoiceId)}>重新校验</Button> : null}</div>
        </section>
      </div>

      <footer className="payment-list-editor-footer">
        <span><GripHorizontal size={15} />可左右滑动切换付款明细</span>
        <div><Button variant="secondary" icon={<ChevronLeft size={16} />} disabled={activeIndex === 0} onClick={() => move(-1)}>上一笔</Button><Button variant="secondary" icon={<ChevronRight size={16} />} disabled={activeIndex === list.items.length - 1} onClick={() => move(1)}>下一笔</Button><Button onClick={onClose}>确定</Button></div>
      </footer>
    </div>
  );
}
