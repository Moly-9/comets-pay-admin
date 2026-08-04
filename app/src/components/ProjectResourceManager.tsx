import {
  FilePlus2,
  FileText,
  Link2,
  Pencil,
  ReceiptText,
  ShieldCheck,
  Trash2,
  Unlink,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  canEditProject,
  paymentListItemValue,
  projectReviewStatusLabel,
  type EngagementId,
  type InvoiceId,
  type PaymentListRecord,
  type ProjectId,
  type WorkflowAuditEvent,
} from '../businessWorkflow';
import {
  formatContractMoney,
  getContractReadiness,
  type ContractRecord,
} from '../contracts';
import type { SystemUser } from '../data';
import { formatInvoiceMoney, invoiceTotal, normalizeLineItem } from '../invoice/invoiceUtils';
import type { ProjectSummary } from '../pages/ProjectDetailPage';
import type { CreatorProfile, GeneratedInvoiceRecord, InvoiceCurrency } from '../types';
import { Button, Modal, NoticeBanner, SelectField } from './Common';

type LinkDialogState = {
  kind: 'contract' | 'invoice';
  engagementId: EngagementId;
  creatorId: string;
} | null;

type Props = {
  project: ProjectSummary;
  creators: CreatorProfile[];
  contracts: ContractRecord[];
  invoices: GeneratedInvoiceRecord[];
  paymentList: PaymentListRecord | null;
  auditEvents: WorkflowAuditEvent[];
  currentUser: SystemUser;
  onOpenContract: (contractId: string) => void;
  onOpenInvoice: (invoiceId: InvoiceId) => void;
  onCreateContract: (engagementId: EngagementId) => void;
  onCreateInvoice: (engagementId: EngagementId) => void;
  onLinkContract: (contractId: string, engagementId: EngagementId) => void;
  onUnlinkContract: (contractId: string) => void;
  onDeleteContract: (contractId: string) => void;
  onLinkInvoice: (invoiceId: InvoiceId, engagementId: EngagementId) => void;
  onUnlinkInvoice: (invoiceId: InvoiceId) => void;
  onDeleteInvoice: (invoiceId: InvoiceId) => void;
  onUpdateInvoice: (invoice: GeneratedInvoiceRecord) => void;
  onCreatePaymentList: () => void;
  onDeletePaymentList: () => void;
  onAddPaymentInvoice: (invoiceId: InvoiceId) => void;
  onRemovePaymentInvoice: (invoiceId: InvoiceId) => void;
  onUpdatePaymentItem: (
    invoiceId: InvoiceId,
    field: 'currency' | 'amount' | 'provider' | 'accountSummary',
    value: string | number,
  ) => void;
  onSubmitReview: () => void;
  onReturnReview: () => void;
  onApproveReview: () => void;
};

const projectInternalId = (project: ProjectSummary) => (
  (project.projectId ?? project.id) as ProjectId
);

const invoiceAccountSummary = (invoice: GeneratedInvoiceRecord) => {
  const payment = invoice.snapshot.payment;
  if (invoice.snapshot.paymentMethod === 'paypal') {
    return payment.paypalEmail || payment.paypalUsername || '待补充 PayPal';
  }
  const account = (payment.iban || payment.accountNumber).replace(/\s/g, '');
  return account ? `账户尾号 ${account.slice(-4)}` : '待补充银行账户';
};

export function ProjectResourceManager({
  project,
  creators,
  contracts,
  invoices,
  paymentList,
  auditEvents,
  currentUser,
  onOpenContract,
  onOpenInvoice,
  onCreateContract,
  onCreateInvoice,
  onLinkContract,
  onUnlinkContract,
  onDeleteContract,
  onLinkInvoice,
  onUnlinkInvoice,
  onDeleteInvoice,
  onUpdateInvoice,
  onCreatePaymentList,
  onDeletePaymentList,
  onAddPaymentInvoice,
  onRemovePaymentInvoice,
  onUpdatePaymentItem,
  onSubmitReview,
  onReturnReview,
  onApproveReview,
}: Props) {
  const reviewStatus = project.reviewStatus ?? 'draft';
  const canEdit = canEditProject(currentUser, reviewStatus);
  const [linkDialog, setLinkDialog] = useState<LinkDialogState>(null);
  const [linkId, setLinkId] = useState('');
  const [editingInvoice, setEditingInvoice] = useState<GeneratedInvoiceRecord | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const references = (project.creatorProfiles ?? []).filter((reference) => reference.status !== 'removed');
  const linkedInvoices = invoices.filter((invoice) => invoice.snapshot.projectId === projectInternalId(project));
  const paymentCandidateInvoices = linkedInvoices.filter((invoice) => (
    invoice.snapshot.engagementId
    && !paymentList?.items.some((item) => item.invoiceId === invoice.invoiceId)
  ));

  const linkOptions = useMemo(() => {
    if (!linkDialog) return [];
    if (linkDialog.kind === 'contract') {
      return contracts
        .filter((contract) => (
          !contract.isTemplate
          && !contract.engagementId
          && contract.projectId === projectInternalId(project)
          && contract.creatorId === linkDialog.creatorId
        ))
        .map((contract) => ({
          value: contract.contractId ?? contract.id,
          label: contract.id,
          description: `${contract.name} · ${formatContractMoney(contract)}`,
        }));
    }
    return invoices
      .filter((invoice) => (
        !invoice.snapshot.engagementId
        && invoice.snapshot.projectId === projectInternalId(project)
        && invoice.snapshot.creatorId === linkDialog.creatorId
      ))
      .map((invoice) => ({
        value: invoice.invoiceId,
        label: invoice.id,
        description: `${formatInvoiceMoney(invoice.snapshot.currency, invoiceTotal(invoice.snapshot))} · ${invoice.status}`,
      }));
  }, [contracts, invoices, linkDialog, project]);

  const openLinkDialog = (state: NonNullable<LinkDialogState>) => {
    setLinkId('');
    setLinkDialog(state);
  };

  const commitLink = () => {
    if (!linkDialog || !linkId) return;
    if (linkDialog.kind === 'contract') {
      onLinkContract(linkId, linkDialog.engagementId);
    } else {
      onLinkInvoice(linkId as InvoiceId, linkDialog.engagementId);
    }
    setLinkDialog(null);
    setLinkId('');
  };

  const saveInvoiceEdit = () => {
    if (!editingInvoice) return;
    const firstItem = editingInvoice.snapshot.items[0];
    const normalized = firstItem ? normalizeLineItem(firstItem) : null;
    onUpdateInvoice({
      ...editingInvoice,
      validationStatus: 'needs_review',
      snapshot: {
        ...editingInvoice.snapshot,
        items: normalized
          ? [normalized, ...editingInvoice.snapshot.items.slice(1)]
          : editingInvoice.snapshot.items,
      },
    });
    setEditingInvoice(null);
  };

  return (
    <div className="project-workflow-resources">
      <div className="project-workflow-statusbar">
        <div>
          <span>项目审核状态</span>
          <strong>{projectReviewStatusLabel[reviewStatus]}</strong>
        </div>
        <div className="project-workflow-status-actions">
          {canEdit && reviewStatus !== 'submitted' && reviewStatus !== 'approved' ? (
            <Button icon={<ShieldCheck size={16} />} onClick={onSubmitReview}>提交请款审核</Button>
          ) : null}
          {(currentUser.roleKey === 'admin' || currentUser.roleKey === 'owner') && reviewStatus === 'submitted' ? (
            <>
              <Button variant="secondary" onClick={onReturnReview}>退回修改</Button>
              <Button onClick={onApproveReview}>审核通过</Button>
            </>
          ) : null}
        </div>
      </div>

      {!canEdit ? (
        <NoticeBanner>
          当前账号在“{projectReviewStatusLabel[reviewStatus]}”状态下仅可查看项目资料。媒介需等待审核退回后修改；管理员和老板不受状态限制。
        </NoticeBanner>
      ) : null}

      <div className="project-engagement-list">
        {references.map((reference) => {
          const creator = creators.find((item) => item.id === reference.creatorId);
          const engagementContracts = contracts.filter((contract) => contract.engagementId === reference.engagementId);
          const engagementInvoice = invoices.find((invoice) => invoice.snapshot.engagementId === reference.engagementId) ?? null;
          return (
            <section className="project-engagement-resource" key={reference.engagementId}>
              <header>
                <div>
                  <strong>{creator?.name ?? reference.name}</strong>
                  <span>{creator?.handle ?? reference.handle} · {creator?.platform ?? reference.platform}</span>
                </div>
                <code>{reference.engagementId}</code>
              </header>

              <div className="project-engagement-resource-group">
                <div className="project-engagement-resource-title">
                  <span><FileText size={16} />合同 <em>{engagementContracts.length}</em></span>
                  {canEdit ? (
                    <div>
                      <Button variant="ghost" icon={<FilePlus2 size={15} />} onClick={() => onCreateContract(reference.engagementId)}>生成合同</Button>
                      <Button variant="secondary" icon={<Link2 size={15} />} onClick={() => openLinkDialog({
                        kind: 'contract',
                        engagementId: reference.engagementId,
                        creatorId: reference.creatorId,
                      })}>关联合同</Button>
                    </div>
                  ) : null}
                </div>
                {engagementContracts.length ? engagementContracts.map((contract) => {
                  const readiness = getContractReadiness(contract);
                  return (
                    <article className="project-linked-resource-row" key={contract.contractId ?? contract.id}>
                      <div>
                        <strong>{contract.id}</strong>
                        <span>{contract.name}</span>
                      </div>
                      <span className="project-linked-resource-meta">{formatContractMoney(contract)}</span>
                      <em>{contract.lifecycle === 'GENERATED_DRAFT' ? '待回传' : readiness.label}</em>
                      <div className="project-linked-resource-actions">
                        <button type="button" onClick={() => onOpenContract(contract.id)}>查看</button>
                        {canEdit ? (
                          <>
                            <button type="button" onClick={() => onOpenContract(contract.id)}><Pencil size={14} />编辑</button>
                            <button type="button" onClick={() => onUnlinkContract(contract.contractId ?? contract.id)}><Unlink size={14} />解除</button>
                            <button className="danger" type="button" onClick={() => {
                              if (window.confirm(`确认删除合同 ${contract.id}？源记录会同步从合同管理删除。`)) {
                                onDeleteContract(contract.contractId ?? contract.id);
                              }
                            }}><Trash2 size={14} />删除</button>
                          </>
                        ) : null}
                      </div>
                    </article>
                  );
                }) : <p className="project-resource-empty-line">尚未关联该达人的合同。合同不是 Invoice 的必填项。</p>}
              </div>

              <div className="project-engagement-resource-group">
                <div className="project-engagement-resource-title">
                  <span><ReceiptText size={16} />Invoice <em>{engagementInvoice ? 1 : 0}</em></span>
                  {canEdit ? (
                    <div>
                      {!engagementInvoice ? <Button variant="ghost" icon={<FilePlus2 size={15} />} onClick={() => onCreateInvoice(reference.engagementId)}>生成 Invoice</Button> : null}
                      {!engagementInvoice ? <Button variant="secondary" icon={<Link2 size={15} />} onClick={() => openLinkDialog({
                        kind: 'invoice',
                        engagementId: reference.engagementId,
                        creatorId: reference.creatorId,
                      })}>关联 Invoice</Button> : null}
                    </div>
                  ) : null}
                </div>
                {engagementInvoice ? (
                  <article className="project-linked-resource-row">
                    <div>
                      <strong>{engagementInvoice.id}</strong>
                      <span>{engagementInvoice.snapshot.contractIds?.length
                        ? `覆盖 ${engagementInvoice.snapshot.contractIds.length} 份合同`
                        : '未关联合同（非必填）'}</span>
                    </div>
                    <span className="project-linked-resource-meta">
                      {formatInvoiceMoney(engagementInvoice.snapshot.currency, invoiceTotal(engagementInvoice.snapshot))}
                    </span>
                    <em>{engagementInvoice.validationStatus === 'valid' ? engagementInvoice.status : '需重新校验'}</em>
                    <div className="project-linked-resource-actions">
                      <button type="button" onClick={() => onOpenInvoice(engagementInvoice.invoiceId)}>查看</button>
                      {canEdit ? (
                        <>
                          <button type="button" onClick={() => setEditingInvoice(structuredClone(engagementInvoice))}><Pencil size={14} />编辑</button>
                          <button type="button" onClick={() => onUnlinkInvoice(engagementInvoice.invoiceId)}><Unlink size={14} />解除</button>
                          <button className="danger" type="button" onClick={() => {
                            if (window.confirm(`确认删除 Invoice ${engagementInvoice.id}？源记录会同步从 Invoice 管理删除。`)) {
                              onDeleteInvoice(engagementInvoice.invoiceId);
                            }
                          }}><Trash2 size={14} />删除</button>
                        </>
                      ) : null}
                    </div>
                  </article>
                ) : <p className="project-resource-empty-line">尚未关联 Invoice。提交审核前每位达人必须有且仅有一份。</p>}
              </div>
            </section>
          );
        })}
        {!references.length ? <p className="project-resource-empty-line">项目尚未选择达人，无法创建资源关联。</p> : null}
      </div>

      <section className="project-payment-list">
        <header>
          <div><span><WalletCards size={18} /></span><div><h3>项目付款清单</h3><p>每个项目最多一份，付款行来自本项目已关联的 Invoice。</p></div></div>
          {canEdit ? (
            paymentList
              ? <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => {
                if (window.confirm(`确认删除付款清单 ${paymentList.paymentListCode}？Invoice 不会被删除。`)) onDeletePaymentList();
              }}>删除清单</Button>
              : <Button icon={<FilePlus2 size={15} />} onClick={onCreatePaymentList}>生成付款清单</Button>
          ) : null}
        </header>
        {paymentList ? (
          <>
            <div className="project-payment-list-meta">
              <strong>{paymentList.paymentListCode}</strong>
              <span>{paymentList.items.length} 笔付款 · {paymentList.status === 'draft' ? '草稿' : '已提交'}</span>
            </div>
            <div className="project-payment-rows">
              {paymentList.items.map((item) => (
                <div className="project-payment-row" key={item.invoiceId}>
                  <div><strong>{item.snapshot.creatorName}</strong><span>{item.snapshot.invoiceNumber}</span></div>
                  <label><span>币种</span><input disabled={!canEdit} value={paymentListItemValue(item, 'currency')} onChange={(event) => onUpdatePaymentItem(item.invoiceId, 'currency', event.target.value.toUpperCase())} /></label>
                  <label><span>金额</span><input disabled={!canEdit} type="number" min="0" step="0.01" value={paymentListItemValue(item, 'amount')} onChange={(event) => onUpdatePaymentItem(item.invoiceId, 'amount', Number(event.target.value))} /></label>
                  <label><span>渠道</span><input disabled={!canEdit} value={paymentListItemValue(item, 'provider')} onChange={(event) => onUpdatePaymentItem(item.invoiceId, 'provider', event.target.value)} /></label>
                  <label><span>账户快照</span><input disabled={!canEdit} value={paymentListItemValue(item, 'accountSummary')} onChange={(event) => onUpdatePaymentItem(item.invoiceId, 'accountSummary', event.target.value)} /></label>
                  {canEdit ? <button type="button" aria-label={`移除 ${item.snapshot.invoiceNumber}`} onClick={() => onRemovePaymentInvoice(item.invoiceId)}><Trash2 size={15} /></button> : null}
                </div>
              ))}
              {!paymentList.items.length ? <p className="project-resource-empty-line">清单尚无付款行，请从已关联 Invoice 添加。</p> : null}
            </div>
            {canEdit ? (
              <div className="project-payment-add">
                <SelectField
                  ariaLabel="添加付款 Invoice"
                  variant="form"
                  value={paymentInvoiceId}
                  placeholder="选择尚未加入清单的 Invoice"
                  options={paymentCandidateInvoices.map((invoice) => ({
                    value: invoice.invoiceId,
                    label: invoice.id,
                    description: `${invoice.snapshot.creatorName} · ${formatInvoiceMoney(invoice.snapshot.currency, invoiceTotal(invoice.snapshot))}`,
                  }))}
                  onChange={setPaymentInvoiceId}
                />
                <Button
                  variant="secondary"
                  disabled={!paymentInvoiceId}
                  onClick={() => {
                    onAddPaymentInvoice(paymentInvoiceId as InvoiceId);
                    setPaymentInvoiceId('');
                  }}
                >添加付款行</Button>
              </div>
            ) : null}
          </>
        ) : <p className="project-resource-empty-line">付款清单尚未生成。先为项目达人关联 Invoice，再生成项目级付款清单。</p>}
      </section>

      {auditEvents.length ? (
        <details className="project-audit-log">
          <summary>最近操作记录（{auditEvents.length}）</summary>
          {auditEvents.slice(0, 8).map((event) => (
            <div key={event.id}><strong>{event.summary}</strong><span>{event.actor} · {new Date(event.occurredAt).toLocaleString('zh-CN')}</span></div>
          ))}
        </details>
      ) : null}

      {linkDialog ? (
        <Modal
          title={linkDialog.kind === 'contract' ? '关联合同' : '关联 Invoice'}
          width="620px"
          onClose={() => setLinkDialog(null)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setLinkDialog(null)}>取消</Button>
              <Button disabled={!linkId} onClick={commitLink}>确认关联</Button>
            </>
          )}
        >
          <div className="project-link-dialog">
            <p>仅可选择当前项目、当前达人的未关联记录，不支持跨项目或跨达人绑定。</p>
            <SelectField
              ariaLabel={linkDialog.kind === 'contract' ? '选择合同' : '选择 Invoice'}
              variant="form"
              value={linkId}
              placeholder={linkOptions.length ? '选择待关联记录' : '没有合法候选记录'}
              options={linkOptions}
              disabled={!linkOptions.length}
              onChange={setLinkId}
            />
          </div>
        </Modal>
      ) : null}

      {editingInvoice ? (
        <Modal
          title={`编辑 Invoice · ${editingInvoice.id}`}
          width="700px"
          onClose={() => setEditingInvoice(null)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setEditingInvoice(null)}>取消</Button>
              <Button onClick={saveInvoiceEdit}>保存并重新校验</Button>
            </>
          )}
        >
          <div className="project-invoice-edit-grid">
            <label><span>Invoice 日期</span><input type="date" value={editingInvoice.snapshot.invoiceDate} onChange={(event) => setEditingInvoice((current) => current ? ({ ...current, snapshot: { ...current.snapshot, invoiceDate: event.target.value } }) : current)} /></label>
            <label><span>币种</span><input value={editingInvoice.snapshot.currency} onChange={(event) => setEditingInvoice((current) => current ? ({ ...current, snapshot: { ...current.snapshot, currency: event.target.value.toUpperCase() as InvoiceCurrency } }) : current)} /></label>
            <label className="full-width"><span>费用描述</span><input value={editingInvoice.snapshot.items[0]?.description ?? ''} onChange={(event) => setEditingInvoice((current) => current ? ({
              ...current,
              snapshot: {
                ...current.snapshot,
                items: current.snapshot.items.map((item, index) => index === 0 ? { ...item, description: event.target.value } : item),
              },
            }) : current)} /></label>
            <label><span>首项金额</span><input type="number" min="0" step="0.01" value={editingInvoice.snapshot.items[0]?.unitPrice ?? 0} onChange={(event) => setEditingInvoice((current) => current ? ({
              ...current,
              snapshot: {
                ...current.snapshot,
                items: current.snapshot.items.map((item, index) => index === 0 ? normalizeLineItem({ ...item, unitPrice: Number(event.target.value) }) : item),
              },
            }) : current)} /></label>
            <label><span>账户快照</span><input value={invoiceAccountSummary(editingInvoice)} readOnly /></label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
