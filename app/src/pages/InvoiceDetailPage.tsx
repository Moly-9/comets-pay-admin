import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  FileCheck2,
  FileSearch,
  FileText,
  History,
  Landmark,
  ReceiptText,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Modal, PageHeading } from '../components/Common';
import { InvoiceDocumentView } from '../components/InvoiceDocumentView';
import {
  getInvoiceContractReference,
  invoiceAccountSummary,
} from '../invoice/invoiceReview';
import {
  downloadBlob,
  formatInvoiceMoney,
  invoiceFilename,
  invoiceTotal,
} from '../invoice/invoiceUtils';
import type {
  GeneratedInvoiceRecord,
  InvoiceDocumentModel,
  Payout,
} from '../types';

export type InvoiceDetailSource =
  | { kind: 'payout'; payout: Payout }
  | { kind: 'generated'; record: GeneratedInvoiceRecord }
  | {
    kind: 'project';
    status: string;
    contractId: string;
    ioId: string;
    provider: string;
  };

type InvoiceDetailTab = 'summary' | 'matching' | 'account' | 'history';
type Notify = (title: string, message: string) => void;

type InvoiceReviewCheck = {
  id: string;
  label: string;
  contractValue: string;
  invoiceValue: string;
  passed: boolean;
  note: string;
};

const timelineIndex = (status: Payout['status']) => {
  if (status === '飞书审批中') return 1;
  if (status === '待财务复核' || status === '信息异常' || status === '已退回') return 2;
  if (status === '等待付款' || status === '付款处理中') return 3;
  if (status === '已付款') return 4;
  return 0;
};

const ACTION_LABEL: Partial<Record<Payout['status'], string>> = {
  待财务复核: '通过财务复核',
  信息异常: '标记资料已修复',
  已退回: '重新发起审核',
};

const sameText = (left: string, right: string) => (
  left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()
);

function buildReviewChecks(
  source: InvoiceDetailSource,
  model: InvoiceDocumentModel,
): InvoiceReviewCheck[] {
  if (source.kind === 'generated') {
    return [
      {
        id: 'project',
        label: '项目关联',
        contractValue: model.projectName || '待关联',
        invoiceValue: model.projectName || '待关联',
        passed: Boolean(model.projectName),
        note: model.projectName ? '已关联生成Invoice时选择的项目' : '需要关联付款项目',
      },
      {
        id: 'signature',
        label: '签署状态',
        contractValue: '达人签署后生效',
        invoiceValue: '签名区域留空',
        passed: false,
        note: '当前文件等待达人签署，暂不可进入财务复核',
      },
    ];
  }

  if (source.kind === 'project') {
    const accountSummary = invoiceAccountSummary(model);
    const hasContract = Boolean(source.contractId && source.contractId !== '待关联');
    const signaturePending = /待签|待补/.test(source.status);
    return [
      {
        id: 'contract',
        label: '合同 / IO',
        contractValue: `${source.contractId} · ${source.ioId}`,
        invoiceValue: `${source.contractId} · ${source.ioId}`,
        passed: hasContract,
        note: hasContract ? 'Invoice已与该达人的合同一一关联' : '需要关联合同与IO',
      },
      {
        id: 'party',
        label: '收款主体',
        contractValue: model.creatorName || model.from.legalName,
        invoiceValue: model.from.legalName || '待补充',
        passed: Boolean(model.from.legalName),
        note: 'Invoice From与项目合同Publisher一致',
      },
      {
        id: 'bill-to',
        label: '付款主体 / Bill To',
        contractValue: model.billTo.name,
        invoiceValue: model.billTo.name,
        passed: Boolean(model.billTo.name),
        note: '付款主体一致',
      },
      {
        id: 'amount',
        label: '应付金额与币种',
        contractValue: formatInvoiceMoney(model.currency, invoiceTotal(model)),
        invoiceValue: formatInvoiceMoney(model.currency, invoiceTotal(model)),
        passed: invoiceTotal(model) > 0,
        note: 'Invoice总额等于当前达人合同金额',
      },
      {
        id: 'account',
        label: '收款账户',
        contractValue: accountSummary,
        invoiceValue: accountSummary,
        passed: accountSummary !== '待补充',
        note: `已使用${source.provider}账户快照`,
      },
      {
        id: 'signature',
        label: '签署完整性',
        contractValue: '需要完整签署',
        invoiceValue: signaturePending ? '等待签署或补充资料' : '签名页已归档',
        passed: !signaturePending,
        note: signaturePending ? '当前资料尚未满足付款条件' : '签名区域检查通过',
      },
    ];
  }

  const { payout } = source;
  const reference = getInvoiceContractReference(payout);
  const accountSummary = invoiceAccountSummary(model);
  const accountIssue = Boolean(payout.issue && /(账户|收款资料|路由)/.test(payout.issue));
  const partyIssue = Boolean(payout.issue && /(主体|名称)/.test(payout.issue));
  const signatureIssue = Boolean(payout.issue && /签字|签名/.test(payout.issue));
  const modelTotal = invoiceTotal(model);

  return [
    {
      id: 'contract',
      label: '合同 / IO',
      contractValue: `${reference.contractId} · ${reference.ioId}`,
      invoiceValue: `${reference.contractId} · ${reference.ioId}`,
      passed: true,
      note: 'Invoice已关联当前合同与IO',
    },
    {
      id: 'party',
      label: '收款主体',
      contractValue: model.creatorName || model.from.legalName,
      invoiceValue: model.from.legalName || '待补充',
      passed: !partyIssue && sameText(model.creatorName || model.from.legalName, model.from.legalName),
      note: partyIssue ? payout.issue ?? '收款主体需复核' : 'Invoice From与合同Publisher一致',
    },
    {
      id: 'bill-to',
      label: '付款主体 / Bill To',
      contractValue: model.billTo.name,
      invoiceValue: model.billTo.name,
      passed: Boolean(model.billTo.name),
      note: '付款主体一致',
    },
    {
      id: 'amount',
      label: '应付金额与币种',
      contractValue: formatInvoiceMoney(payout.currency, payout.amount),
      invoiceValue: formatInvoiceMoney(model.currency, modelTotal),
      passed: payout.currency === model.currency && payout.amount === modelTotal,
      note: payout.currency === model.currency && payout.amount === modelTotal
        ? 'Invoice总额等于本次批准金额'
        : '金额或币种不一致',
    },
    {
      id: 'account',
      label: '收款账户',
      contractValue: payout.account,
      invoiceValue: accountSummary,
      passed: !accountIssue && payout.account === accountSummary,
      note: accountIssue ? payout.issue ?? '收款账户需复核' : 'Invoice账户与已验证账户一致',
    },
    {
      id: 'signature',
      label: '签署完整性',
      contractValue: '需要完整签署',
      invoiceValue: signatureIssue ? '签字页缺失' : '签名页已识别',
      passed: !signatureIssue,
      note: signatureIssue ? payout.issue ?? '签名信息不完整' : '签名区域检查通过',
    },
  ];
}

function InvoiceSummary({ model }: { model: InvoiceDocumentModel }) {
  return (
    <dl className="contract-definition-list">
      <div><dt>Invoice编号</dt><dd>{model.invoiceNumber}<small>Invoice原文</small></dd></div>
      <div><dt>Invoice From</dt><dd>{model.from.legalName || '待补充'}<small>{model.from.email || '联系邮箱待补充'}</small></dd></div>
      <div><dt>Bill To</dt><dd>{model.billTo.name || '待补充'}<small>{model.billTo.address || '地址待补充'}</small></dd></div>
      <div><dt>项目</dt><dd>{model.projectName || '待关联'}<small>{model.projectId || '项目编号待关联'}</small></dd></div>
      <div><dt>Invoice日期</dt><dd>{model.invoiceDate || '待补充'}<small>Invoice原文</small></dd></div>
      <div><dt>币种与总额</dt><dd>{formatInvoiceMoney(model.currency, invoiceTotal(model))}<small>{model.items.length}项费用明细</small></dd></div>
    </dl>
  );
}

export function InvoiceDetailPage({
  source,
  model,
  onBack,
  backLabel = '返回Invoice列表',
  onAdvance,
  onReturn,
  canReview,
  canExecutePayout,
  notify,
}: {
  source: InvoiceDetailSource;
  model: InvoiceDocumentModel;
  onBack: () => void;
  backLabel?: string;
  onAdvance: (payout: Payout) => void;
  onReturn: (payout: Payout, reason: string) => void;
  canReview: boolean;
  canExecutePayout: boolean;
  notify: Notify;
}) {
  const [activeTab, setActiveTab] = useState<InvoiceDetailTab>('summary');
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | ''>('');
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [dismissedDocumentNoteId, setDismissedDocumentNoteId] = useState<string | null>(null);
  const payout = source.kind === 'payout' ? source.payout : null;
  const status = source.kind === 'payout'
    ? source.payout.status
    : source.kind === 'generated'
      ? source.record.status
      : source.status;
  const provider = source.kind === 'payout'
    ? source.payout.provider
    : source.kind === 'project'
      ? source.provider
      : '尚未指定付款渠道';
  const checks = useMemo(() => buildReviewChecks(source, model), [model, source]);
  const passedCount = checks.filter((check) => check.passed).length;
  const allPassed = checks.length > 0 && passedCount === checks.length;
  const canAdvance = payout
    ? ['等待付款', '付款处理中'].includes(payout.status)
      ? canExecutePayout
      : canReview
    : false;
  const projectTimelineIndex = source.kind === 'project'
    ? /已完成|已付款/.test(source.status)
      ? 4
      : /待打款|付款中|等待付款/.test(source.status)
        ? 3
        : /财务/.test(source.status)
          ? 3
          : /审批|审核/.test(source.status)
            ? 2
            : 1
    : 0;
  const currentIndex = payout ? timelineIndex(payout.status) : projectTimelineIndex;
  const steps = payout
    ? ['Invoice 已审核', '飞书 OA 审批', '财务复核', '渠道打款', '状态回写']
    : source.kind === 'project'
      ? ['Invoice 已关联', '合同一一匹配', '项目审批', '财务复核', '渠道付款']
      : ['Invoice 已生成', '达人签署', '项目关联', '财务复核', '进入付款'];
  const tabs: Array<{ id: InvoiceDetailTab; label: string }> = [
    { id: 'summary', label: 'Invoice摘要' },
    { id: 'matching', label: `合同匹配 ${passedCount}/${checks.length}` },
    { id: 'account', label: '收款账户' },
    { id: 'history', label: '审核记录' },
  ];
  const normalizedReturnReason = returnReason.trim();

  const copyInvoiceId = async () => {
    await navigator.clipboard.writeText(model.invoiceNumber);
    notify('Invoice编号已复制', model.invoiceNumber);
  };

  const downloadInvoice = async (type: 'pdf' | 'docx') => {
    setDownloading(type);
    try {
      const { generateInvoiceDocx, generateInvoicePdf } = await import('../invoice/generateInvoice');
      const blob = type === 'pdf' ? await generateInvoicePdf(model) : await generateInvoiceDocx(model);
      downloadBlob(blob, invoiceFilename(model, type));
      notify('文件已准备下载', `${model.invoiceNumber} 的${type.toUpperCase()}文件已生成。`);
    } catch (error) {
      notify('下载失败', error instanceof Error ? error.message : 'Invoice文件生成失败，请稍后重试。');
    } finally {
      setDownloading('');
    }
  };

  const submitReturn = () => {
    if (!payout || !normalizedReturnReason) return;
    onReturn(payout, normalizedReturnReason);
    setReturnDialogOpen(false);
    setReturnReason('');
  };

  return (
    <div className="page-stack contract-detail-page invoice-detail-page">
      <button className="project-back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        {backLabel}
      </button>

      <PageHeading
        title={model.invoiceNumber}
        subtitle={`${model.creatorHandle || model.creatorName} · ${model.projectName || '待关联项目'}`}
        actions={(
          <>
            <Button variant="secondary" icon={<Clipboard size={16} />} onClick={copyInvoiceId}>复制编号</Button>
            <Button icon={<Download size={16} />} disabled={Boolean(downloading)} onClick={() => downloadInvoice('pdf')}>
              {downloading === 'pdf' ? '生成中…' : '下载PDF'}
            </Button>
          </>
        )}
      />

      <div className="contract-metric-grid">
        <article>
          <span>审核状态</span>
          <strong className={allPassed ? 'contract-ready-text' : 'contract-attention-text'}>{status}</strong>
          <small>{source.kind === 'generated' ? '等待达人签署后进入审核' : `${passedCount}/${checks.length}项资料校验通过`}</small>
        </article>
        <article>
          <span>Invoice金额</span>
          <strong>{formatInvoiceMoney(model.currency, invoiceTotal(model))}</strong>
          <small>{model.items.length}项费用明细 · {model.currency}</small>
        </article>
        <article>
          <span>付款方式</span>
          <strong>{model.paymentMethod === 'bank' ? '银行转账' : 'PayPal'}</strong>
          <small>{provider} · {invoiceAccountSummary(model)}</small>
        </article>
      </div>

      {dismissedDocumentNoteId !== model.invoiceNumber ? (
        <div className="contract-document-note" role="note">
          <FileSearch size={17} />
          <span>当前演示使用提交时冻结的Invoice快照还原全文；接入真实上传文件后，此区域将直接显示原始PDF并保留页码。</span>
          <button
            className="icon-button contract-document-note-close"
            type="button"
            aria-label="关闭Invoice预览提示"
            onClick={() => setDismissedDocumentNoteId(model.invoiceNumber)}
          >
            <X size={17} />
          </button>
        </div>
      ) : null}

      <div className="contract-reader-layout">
        <section className="contract-document-panel invoice-document-panel">
          <header>
            <div>
              <FileText size={19} />
              <span><strong>Invoice全文</strong><small>{model.invoiceNumber}.pdf · 1页</small></span>
            </div>
            <button className="invoice-document-download" type="button" disabled={Boolean(downloading)} onClick={() => downloadInvoice('pdf')}>
              <Download size={15} />
              下载PDF
            </button>
          </header>
          <div className="invoice-document-canvas">
            <InvoiceDocumentView model={model} ariaLabel={`${model.invoiceNumber} Invoice全文`} />
          </div>
        </section>

        <section className="contract-inspector invoice-review-inspector">
          <div className="contract-tabs" role="tablist" aria-label="Invoice详情分类">
            {tabs.map((tab) => (
              <button
                className={activeTab === tab.id ? 'contract-tab-active' : ''}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="contract-inspector-content">
            {activeTab === 'summary' ? (
              <>
                <div className="contract-section-heading">
                  <ReceiptText size={18} />
                  <span><strong>结构化Invoice信息</strong><small>点击左侧可查看整份Invoice内容</small></span>
                </div>
                <InvoiceSummary model={model} />
              </>
            ) : null}

            {activeTab === 'matching' ? (
              <>
                <div className="contract-section-heading">
                  <ShieldCheck size={18} />
                  <span><strong>合同与Invoice匹配</strong><small>并列展示合同值、Invoice值与校验结果</small></span>
                </div>
                <div className="invoice-review-checks">
                  {checks.map((check) => (
                    <article className={check.passed ? 'is-passed' : 'is-failed'} key={check.id}>
                      <span>{check.passed ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</span>
                      <div>
                        <strong>{check.label}</strong>
                        <dl>
                          <div><dt>合同/系统</dt><dd>{check.contractValue}</dd></div>
                          <div><dt>Invoice</dt><dd>{check.invoiceValue}</dd></div>
                        </dl>
                        <small>{check.note}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : null}

            {activeTab === 'account' ? (
              <>
                <div className="contract-section-heading">
                  <Landmark size={18} />
                  <span><strong>收款账户快照</strong><small>与达人档案中的付款账户分开保存</small></span>
                </div>
                <dl className="contract-payment-list">
                  <div><dt>付款方式</dt><dd>{model.paymentMethod === 'bank' ? 'Bank transfer' : 'PayPal'}</dd></div>
                  <div><dt>账户名称</dt><dd>{model.paymentMethod === 'bank' ? model.payment.accountName || '待补充' : model.payment.paypalUsername || '待补充'}</dd></div>
                  <div><dt>收款账户</dt><dd>{invoiceAccountSummary(model)}</dd></div>
                  <div><dt>付款渠道</dt><dd>{provider}</dd></div>
                  <div><dt>账户校验</dt><dd>{checks.find((check) => check.id === 'account')?.passed ? '已通过' : '待复核'}</dd></div>
                </dl>
                <div className="contract-payment-rule">
                  <WalletCards size={17} />
                  <span>Invoice保留提交时的账户快照；实际付款仍使用达人档案中的已验证Beneficiary。</span>
                </div>
              </>
            ) : null}

            {activeTab === 'history' ? (
              <>
                <div className="contract-section-heading">
                  <History size={18} />
                  <span><strong>审核与付款记录</strong><small>展示当前Invoice所处流程</small></span>
                </div>
                <div className="invoice-detail-timeline">
                  {steps.map((step, index) => {
                    const complete = payout
                      ? index < currentIndex || payout.status === '已付款'
                      : source.kind === 'project'
                        ? index < currentIndex || /已完成|已付款/.test(source.status)
                        : index === 0;
                    const current = payout
                      ? index === currentIndex && payout.status !== '已付款'
                      : source.kind === 'project'
                        ? index === currentIndex && !/已完成|已付款/.test(source.status)
                        : index === 1;
                    return (
                      <div className={`${complete ? 'is-complete' : ''} ${current ? 'is-current' : ''}`} key={step}>
                        <span>{complete ? <Check size={14} /> : index + 1}</span>
                        <div><strong>{step}</strong><small>{complete ? '已完成' : current ? '当前步骤' : '待处理'}</small></div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>

          <footer className="invoice-review-actions">
            <div>
              <FileCheck2 size={16} />
              <span>{allPassed ? '关键资料已匹配' : `${checks.length - passedCount}项需要处理`}</span>
            </div>
            <span>
              {source.kind !== 'payout' ? (
                <Button variant="secondary" disabled={Boolean(downloading)} onClick={() => downloadInvoice('docx')}>
                  {downloading === 'docx' ? '生成中…' : '下载DOCX'}
                </Button>
              ) : null}
              {payout?.status === '待财务复核' && canReview ? <Button variant="secondary" onClick={() => setReturnDialogOpen(true)}>退回审核</Button> : null}
              {payout && ACTION_LABEL[payout.status] && canAdvance ? <Button onClick={() => onAdvance(payout)}>{ACTION_LABEL[payout.status]}</Button> : null}
            </span>
          </footer>
        </section>
      </div>

      {returnDialogOpen ? (
        <Modal
          title="退回审核"
          width="520px"
          onClose={() => setReturnDialogOpen(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setReturnDialogOpen(false)}>取消</Button>
              <Button variant="danger" disabled={!normalizedReturnReason} onClick={submitReturn}>确认退回</Button>
            </>
          )}
        >
          <div className="return-review-dialog">
            <div className="return-review-summary">
              <span><UserRound size={19} /></span>
              <div>
                <strong>请填写退回原因</strong>
                <p>{model.from.legalName} · {model.invoiceNumber} · {formatInvoiceMoney(model.currency, invoiceTotal(model))}</p>
              </div>
            </div>
            <label className="return-review-field">
              <span>退回原因 <em className="required-mark" aria-hidden="true">*</em><small>{returnReason.length}/300</small></span>
              <textarea
                autoFocus
                maxLength={300}
                aria-label="退回原因"
                placeholder="请说明需要修改的内容，例如：Invoice收款主体与合同Publisher不一致"
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
              />
              <small>原因会同步给项目负责人，并记录在当前Invoice审核记录中。</small>
            </label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
