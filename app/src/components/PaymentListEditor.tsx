import { CheckCircle2, ChevronDown, ChevronUp, CircleAlert, Eye, FileCheck2, LoaderCircle, Pencil, ReceiptText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { accountDisplayValue } from '../accountPresentation';
import {
  isValidPaymentTransactionReference,
  paymentListEffectiveAccount,
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
  onGenerate?: () => Promise<void>;
  onClose: () => void;
};

type ExpandedRow = { invoiceId: PaymentListItem['invoiceId']; mode: 'view' | 'edit' } | null;

const display = (value: unknown) => value === undefined || value === null || value === '' ? '未填写' : String(value);
const feeBearerLabel = (value: unknown) => ({ ADVERTISER: '付款方', PUBLISHER: '收款方', SHARED: '各自承担' }[String(value)] ?? '待确认');
const feeSourceLabel = (item: PaymentListItem) => ({ CONTRACT: '合同带入', MANUAL: '人工填写', CONTRACT_OVERRIDE: '人工覆盖合同', CONTRACT_CONFLICT: '合同约定冲突' } as Record<string, string>)[item.snapshot.feeBearerSource ?? ''] ?? '未确认来源';

const paymentDetailFields = (item: PaymentListItem) => {
  const account = paymentListEffectiveAccount(item);
  const detail = account.paymentDetails;
  const schemaFields = detail?.schemaFields ?? [];
  const schemaValues = detail?.schemaValues ?? {};
  if (account.provider === 'Airwallex' && schemaFields.length) {
    return [['Beneficiary ID', account.externalBeneficiaryId], ...schemaFields.filter((field) => field.path !== 'transfer_method').filter((field) => field.required || String(schemaValues[field.path] ?? '').trim()).map((field) => [field.label, schemaValues[field.path]])];
  }
  if (account.provider === 'PayPal') return [['PayPal Name', detail?.paypalUsername || detail?.accountName], ['PayPal Email', detail?.paypalEmail]];
  return [['Beneficiary ID', account.externalBeneficiaryId], ['账户名', detail?.accountName], ['银行名称', detail?.bankName], ['银行账号 / IBAN', detail?.iban || detail?.accountNumber], ['SWIFT Code', detail?.swiftCode], ['清算方式', account.localClearingSystem || account.transferMethod]];
};

const rowIssues = (list: PaymentListRecord, item: PaymentListItem) => validatePaymentListGeneration({ ...list, items: [item] }, [item.invoiceId]).filter((issue) => issue.code === 'INVALID_ITEM').map((issue) => issue.message.replace(`${item.snapshot.invoiceNumber}：`, ''));

export function PaymentListEditor({ list, initialInvoiceId, invoices, contracts, creators, editable, accountEditableInvoiceIds = [], accountOverrideOnly = false, requestPaymentProvider, onUpdatePaymentItem, onChangePaymentAccount, onRevalidatePaymentItem, onGenerate, onClose }: Props) {
  const [expanded, setExpanded] = useState<ExpandedRow>(initialInvoiceId ? { invoiceId: initialInvoiceId, mode: editable ? 'edit' : 'view' } : null);
  const [bulkPaymentReason, setBulkPaymentReason] = useState('');
  const [bulkTransactionReference, setBulkTransactionReference] = useState('');
  const [bulkNotice, setBulkNotice] = useState('');
  const [validating, setValidating] = useState(false);
  const paymentFieldsEditable = editable && !accountOverrideOnly;
  const allIssues = validatePaymentListGeneration(list, list.items.map((item) => item.invoiceId));

  useEffect(() => { if (initialInvoiceId) setExpanded({ invoiceId: initialInvoiceId, mode: editable ? 'edit' : 'view' }); }, [editable, initialInvoiceId]);

  const applyBulkField = (field: 'paymentReason' | 'transactionReference', value: string) => {
    if (!paymentFieldsEditable || !value.trim()) return;
    list.items.forEach((item) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, field, value.trim()));
    setBulkNotice(`已覆盖 ${list.items.length} 条可编辑付款明细`);
  };
  const generate = async () => {
    if (!onGenerate || validating) return;
    setValidating(true);
    try { await onGenerate(); } finally { setValidating(false); }
  };

  if (!list.items.length) return <div className="payment-list-editor-empty"><ReceiptText size={28} /><strong>暂无付款明细</strong><span>关联 Invoice 后，系统会自动生成对应付款草稿。</span><Button variant="secondary" onClick={onClose}>关闭</Button></div>;

  return <div className={`payment-list-editor${validating ? ' is-validating' : ''}`} aria-label="付款清单行内编辑器" aria-busy={validating}>
    <header className="payment-list-editor-header">
      <div className="payment-list-editor-header-summary"><span className="payment-list-editor-kicker">{list.paymentListCode}</span><strong>{list.items.length} 条付款明细 · V{list.version ?? 0}{list.status === 'draft' ? ' 草稿' : ' 已锁定'}</strong><small>{list.generatedAt ? `最近生成 ${new Date(list.generatedAt).toLocaleString('zh-CN')} · ${list.generatedBy?.name ?? '系统'}` : '关联 Invoice 后自动维护草稿'}</small></div>
      <section className="payment-list-editor-bulk-fill" aria-label="整单批量填入"><div className="payment-list-editor-bulk-fill-heading"><strong>整单批量填入</strong><span>{bulkNotice || '内容将覆盖全部可编辑行'}</span></div><div className="payment-list-editor-bulk-fill-fields">
        <label><span>付款原因</span><div><input aria-label="整单付款原因" value={bulkPaymentReason} disabled={!paymentFieldsEditable || validating} onChange={(event) => setBulkPaymentReason(event.target.value)} /><Button variant="secondary" disabled={!paymentFieldsEditable || !bulkPaymentReason.trim() || validating} onClick={() => applyBulkField('paymentReason', bulkPaymentReason)}>填入全部</Button></div></label>
        <label><span>交易附言</span><div><input aria-label="整单交易附言" maxLength={140} placeholder="仅限英文、数字及英文标点" value={bulkTransactionReference} disabled={!paymentFieldsEditable || validating} onChange={(event) => setBulkTransactionReference(event.target.value)} /><Button variant="secondary" disabled={!paymentFieldsEditable || !isValidPaymentTransactionReference(bulkTransactionReference) || validating} onClick={() => applyBulkField('transactionReference', bulkTransactionReference)}>填入全部</Button></div>{bulkTransactionReference && !isValidPaymentTransactionReference(bulkTransactionReference) ? <small className="payment-list-field-error">仅支持 1–140 位 ASCII 字符</small> : null}</label>
      </div></section>
    </header>
    <div className="payment-list-table-scroll"><table className="payment-list-table"><thead><tr><th>Handle</th><th>真名</th><th>Invoice 编号</th><th>付款账户</th><th>付款金额</th><th>支付币种</th><th>收款币种</th><th>转账方式</th><th>手续费承担方</th><th>付款原因</th><th>交易附言</th><th>状态 / 操作</th></tr></thead><tbody>
      {list.items.map((item) => {
        const account = paymentListEffectiveAccount(item);
        const issues = rowIssues(list, item);
        const isExpanded = expanded?.invoiceId === item.invoiceId;
        const manuallyAdjusted = Number(paymentListItemValue(item, 'amount')) !== Number(item.sourceInvoicePaymentSnapshot?.amount ?? item.snapshot.amount) || String(paymentListItemValue(item, 'currency')) !== String(item.sourceInvoicePaymentSnapshot?.currency ?? item.snapshot.currency);
        return [<tr className={issues.length ? 'has-errors' : ''} id={`request-payment-row-${item.invoiceId}`} key={`${item.id}-row`}>
          <td data-label="Handle"><strong>{item.snapshot.creatorHandle || '—'}</strong></td><td data-label="真名">{item.snapshot.realName || item.snapshot.creatorName}</td><td data-label="Invoice 编号"><strong>{item.snapshot.invoiceNumber}</strong></td><td data-label="付款账户" title={account.accountSummary}>{accountDisplayValue(account.accountSummary, '待选择')}</td><td data-label="付款金额"><strong>{Number(paymentListItemValue(item, 'amount')).toLocaleString('en-US')}</strong>{manuallyAdjusted ? <small className="payment-list-adjusted">人工调整</small> : null}</td><td data-label="支付币种">{paymentListItemValue(item, 'currency')}</td><td data-label="收款币种">{paymentListItemValue(item, 'receiveCurrency')}</td><td data-label="转账方式">{display(paymentListItemValue(item, 'transferMethod'))}</td><td data-label="手续费承担方"><span>{feeBearerLabel(paymentListItemValue(item, 'feeBearer'))}</span><small>{feeSourceLabel(item)}</small></td><td data-label="付款原因" title={String(paymentListItemValue(item, 'paymentReason'))}>{display(paymentListItemValue(item, 'paymentReason'))}</td><td data-label="交易附言" title={String(paymentListItemValue(item, 'transactionReference'))}>{display(paymentListItemValue(item, 'transactionReference'))}</td>
           <td data-label="状态 / 操作"><span className={`payment-list-row-state ${issues.length ? 'is-warning' : 'is-ready'}`}>{issues.length ? <CircleAlert size={13} /> : <CheckCircle2 size={13} />}{issues.length ? `${issues.length} 项待处理` : '校验就绪'}</span><div className="payment-list-row-actions"><button type="button" disabled={validating} onClick={() => setExpanded(isExpanded && expanded.mode === 'view' ? null : { invoiceId: item.invoiceId, mode: 'view' })}><Eye size={14} />查看详情</button>{editable ? <button type="button" disabled={validating} onClick={() => setExpanded(isExpanded && expanded.mode === 'edit' ? null : { invoiceId: item.invoiceId, mode: 'edit' })}><Pencil size={14} />编辑</button> : null}<button className="is-toggle" type="button" disabled={validating} aria-label={isExpanded ? '收起付款明细' : '展开付款明细'} onClick={() => setExpanded(isExpanded ? null : { invoiceId: item.invoiceId, mode: 'view' })}>{isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button></div></td>
         </tr>, isExpanded ? <tr className="payment-list-expanded-row" key={`${item.id}-expanded`}><td colSpan={12}><PaymentInlinePanel item={item} list={list} invoices={invoices} contracts={contracts} creators={creators} mode={expanded.mode} editable={paymentFieldsEditable && !validating} accountEditable={editable && !validating && accountEditableInvoiceIds.includes(item.invoiceId)} requestPaymentProvider={requestPaymentProvider} issues={issues} onUpdatePaymentItem={onUpdatePaymentItem} onChangePaymentAccount={onChangePaymentAccount} onRevalidatePaymentItem={onRevalidatePaymentItem} /></td></tr> : null];
      })}
    </tbody></table></div>
    <footer className="payment-list-editor-footer"><div className={`payment-list-editor-result ${allIssues.length ? 'is-warning' : 'is-ready'}`} role="status">{allIssues.length ? <CircleAlert size={16} /> : <FileCheck2 size={16} />}<span>{allIssues.length ? `校验前仍有 ${allIssues.length} 项待处理` : list.status === 'generated' ? `V${list.version ?? 1} 已生成并锁定` : '全部字段已就绪，可调用接口校验'}</span></div><div><Button variant="secondary" disabled={validating} onClick={onClose}>关闭</Button>{onGenerate && list.status === 'draft' ? <Button icon={validating ? <LoaderCircle className="is-spinning" size={16} /> : <FileCheck2 size={16} />} disabled={validating} onClick={() => { void generate(); }}>{validating ? '正在校验…' : '生成付款清单'}</Button> : null}</div></footer>
  </div>;
}

function PaymentInlinePanel({ item, list, creators, mode, editable, accountEditable, requestPaymentProvider, issues, onUpdatePaymentItem, onChangePaymentAccount, onRevalidatePaymentItem }: { item: PaymentListItem; list: PaymentListRecord; invoices: GeneratedInvoiceRecord[]; contracts: ContractRecord[]; creators: CreatorProfile[]; mode: 'view' | 'edit'; editable: boolean; accountEditable: boolean; requestPaymentProvider?: string | null; issues: string[]; onUpdatePaymentItem: Props['onUpdatePaymentItem']; onChangePaymentAccount: Props['onChangePaymentAccount']; onRevalidatePaymentItem: Props['onRevalidatePaymentItem'] }) {
  const account = paymentListEffectiveAccount(item);
  const creator = creators.find((candidate) => candidate.id === item.snapshot.creatorId);
  const canEdit = mode === 'edit' && editable;
  const accountOptions = useMemo(() => !creator ? [] : eligibleInvoicePayoutAccounts(creator).filter((candidate) => !requestPaymentProvider || candidate.provider === requestPaymentProvider).map((candidate) => ({ value: getPayoutAccountId(candidate), ...getPayoutAccountSelectPresentation(candidate) })), [creator, requestPaymentProvider]);
  const update = (field: PaymentListEditableField, value: string | number) => onUpdatePaymentItem(list.paymentListId, item.invoiceId, field, value);
  const reference = String(paymentListItemValue(item, 'transactionReference'));
  const feeBearerOptions = [{ value: 'ADVERTISER', label: '付款方' }, { value: 'PUBLISHER', label: '收款方' }, { value: 'SHARED', label: '各自承担' }];
  if (mode === 'view') return <div className="payment-list-inline-detail"><section><strong>付款信息</strong><dl><div><dt>达人</dt><dd>{item.snapshot.creatorHandle || '—'} · {item.snapshot.realName || item.snapshot.creatorName}</dd></div><div><dt>Invoice 来源</dt><dd>{item.snapshot.invoiceNumber}</dd></div><div><dt>合同来源</dt><dd>{item.snapshot.feeBearerContractIds?.join('、') || '未关联合同'}</dd></div><div><dt>付款渠道</dt><dd>{paymentProviderDisplayName(account.provider)}</dd></div><div><dt>账户验证状态</dt><dd>{display(account.validationStatus)}</dd></div><div><dt>金额调整</dt><dd>{item.overrides.amount !== undefined || item.overrides.currency !== undefined ? '人工调整' : '与 Invoice 一致'}</dd></div></dl></section><section><strong>账户与渠道快照</strong><dl>{paymentDetailFields(item).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl></section><section><strong>交易信息</strong><dl><div><dt>付款原因</dt><dd>{display(paymentListItemValue(item, 'paymentReason'))}</dd></div><div><dt>交易附言</dt><dd>{display(reference)}</dd></div><div><dt>手续费承担方</dt><dd>{feeBearerLabel(paymentListItemValue(item, 'feeBearer'))} · {feeSourceLabel(item)}</dd></div><div><dt>账户转账备注</dt><dd>{display(account.transferNote)}</dd></div><div><dt>描述</dt><dd>{display(paymentListItemValue(item, 'description'))}</dd></div></dl></section></div>;
  return <div className="payment-list-inline-editor"><div className="payment-list-inline-form">{accountEditable ? <label className="is-wide"><span>本次执行账户</span><SelectField ariaLabel="本次执行账户" variant="form" value={account.payoutAccountId ?? ''} options={accountOptions} onChange={(value) => onChangePaymentAccount(list.paymentListId, item.invoiceId, value)} /></label> : <label className="is-wide"><span>付款账户（只读）</span><input readOnly value={accountDisplayValue(account.accountSummary, '待选择')} /></label>}<label><span>付款金额</span><input aria-label="付款金额" type="number" min="0.01" step="0.01" value={paymentListItemValue(item, 'amount')} disabled={!canEdit} onChange={(event) => update('amount', Number(event.target.value))} /></label><label><span>支付币种</span><SelectField ariaLabel="付款支付币种" variant="form" value={String(paymentListItemValue(item, 'currency'))} options={PAYMENT_CURRENCY_OPTIONS} disabled={!canEdit} onChange={(value) => update('currency', value)} /></label><label><span>收款币种</span><SelectField ariaLabel="付款收款币种" variant="form" value={String(paymentListItemValue(item, 'receiveCurrency'))} options={PAYMENT_CURRENCY_OPTIONS} disabled={!canEdit} onChange={(value) => update('receiveCurrency', value)} /></label><label><span>转账方式（只读）</span><input readOnly value={display(paymentListItemValue(item, 'transferMethod'))} /></label><label><span>手续费承担方</span><SelectField ariaLabel="编辑付款手续费承担方" variant="form" value={String(paymentListItemValue(item, 'feeBearer'))} options={feeBearerOptions} placeholder="请选择" disabled={!canEdit} onChange={(value) => update('feeBearer', value)} /></label><label><span>付款原因</span><input aria-label="编辑付款原因" value={String(paymentListItemValue(item, 'paymentReason'))} disabled={!canEdit} onChange={(event) => update('paymentReason', event.target.value)} /></label><label className="is-wide"><span>交易附言 <small>{reference.length}/140</small></span><input aria-label="编辑交易附言" maxLength={140} placeholder="仅支持英文、数字、空格和常用英文标点" value={reference} disabled={!canEdit} onChange={(event) => update('transactionReference', event.target.value)} />{reference && !isValidPaymentTransactionReference(reference) ? <small className="payment-list-field-error">禁止中文及其他非 ASCII 字符</small> : null}</label></div><div className={`payment-list-editor-validation ${issues.length ? 'is-warning' : 'is-ready'}`} role="status">{issues.length ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}<div><strong>{issues.length ? `${issues.length} 项需要处理` : '本行字段完整'}</strong>{issues.length ? <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}</div>{item.requiresRevalidation ? <Button variant="ghost" onClick={() => onRevalidatePaymentItem(list.paymentListId, item.invoiceId)}>重新校验账户</Button> : null}</div></div>;
}
