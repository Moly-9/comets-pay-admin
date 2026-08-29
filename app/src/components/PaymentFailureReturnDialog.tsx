import { AlertTriangle, CircleAlert } from 'lucide-react';
import { useState } from 'react';
import type { PaymentBatchItemSnapshot } from '../paymentBatches';
import type { PaymentFailureIssueType } from '../types';
import { Button, Modal, SelectField, type SelectOption } from './Common';

const money = (currency: string, amount: number) => `${currency} ${amount.toLocaleString('en-US')}`;

export const PAYMENT_FAILURE_ISSUE_OPTIONS: readonly SelectOption<PaymentFailureIssueType>[] = [
  { value: 'INVOICE_CONTENT', label: 'Invoice 内容问题', description: '修改 Invoice 并重新签署' },
  { value: 'PAYMENT_LIST', label: '付款账户问题', description: '仅恢复失败达人的收款账户' },
];

export function PaymentFailureReturnDialog({
  item,
  onClose,
  onSubmit,
}: {
  item: PaymentBatchItemSnapshot;
  onClose: () => void;
  onSubmit: (issueType: PaymentFailureIssueType, reason: string) => boolean;
}) {
  const [issueType, setIssueType] = useState<PaymentFailureIssueType | ''>('');
  const [returnReason, setReturnReason] = useState('');
  const normalizedReturnReason = returnReason.trim();

  const submit = () => {
    if (!issueType || !normalizedReturnReason) return;
    if (onSubmit(issueType, normalizedReturnReason)) onClose();
  };

  return (
    <Modal
      title="付款失败退回媒介"
      width="520px"
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button
            variant="danger"
            disabled={!normalizedReturnReason || !issueType}
            disabledReason={!issueType ? '请先选择失败原因。' : '请先填写退回说明。'}
            onClick={submit}
          >
            确认退回
          </Button>
        </>
      )}
    >
      <div className="return-review-dialog">
        <div className="return-review-summary">
          <span><CircleAlert size={19} /></span>
          <div>
            <strong>请选择问题类型并填写退回原因</strong>
            <p>{item.creatorName} · {item.invoice?.invoiceNumber ?? item.legacyInvoiceReference ?? '未关联 Invoice'} · {money(item.currency, item.amount)}</p>
          </div>
        </div>
        <label className="return-review-field">
          <span>问题类型 <em className="required-mark" aria-hidden="true">*</em></span>
          <SelectField<PaymentFailureIssueType | ''>
            ariaLabel="付款失败问题类型"
            value={issueType}
            placeholder="请选择问题类型"
            variant="form"
            menuStrategy="fixed"
            options={PAYMENT_FAILURE_ISSUE_OPTIONS}
            onChange={setIssueType}
          />
          <small>必须由财务人工判断，系统不会根据渠道错误文本自动分类。</small>
        </label>
        <label className="return-review-field">
          <span>退回原因 <em className="required-mark" aria-hidden="true">*</em><small>{returnReason.length}/300</small></span>
          <textarea
            autoFocus
            maxLength={300}
            aria-label="退回原因"
            placeholder="请说明失败原因和媒介需要处理的内容"
            value={returnReason}
            onChange={(event) => setReturnReason(event.target.value)}
          />
          <small>原因、操作人和退回时间会记录在该笔付款详情中。</small>
        </label>
        <div className="return-review-warning"><AlertTriangle size={17} /><span>{
          issueType === 'INVOICE_CONTENT'
            ? '确认后需修改 Invoice，并从达人签署节点重新开始。'
            : issueType === 'PAYMENT_LIST'
              ? '确认后仅失败款进入账户恢复；项目回到“已退回”，成功款保持已付款。'
              : '确认后将按所选资料节点进入对应处理流程。'
        }</span></div>
      </div>
    </Modal>
  );
}
