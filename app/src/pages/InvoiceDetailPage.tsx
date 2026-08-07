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
  Info,
  Landmark,
  Mail,
  MessageSquareText,
  ReceiptText,
  Send,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Button, Modal, PageHeading, StatusMark } from '../components/Common';
import { InvoiceDocumentView } from '../components/InvoiceDocumentView';
import {
  getInvoiceContractReference,
  invoiceAccountSummary,
} from '../invoice/invoiceReview';
import {
  getApprovedInvoicePaymentStatus,
  getInvoiceEditContext,
  getInvoiceDetailNavigationTarget,
  getInvoiceDetailReviewActions,
  getInvoiceRowStatus,
  maskInvoiceAccountValue,
  type InvoiceReviewAction,
} from '../invoice/invoiceReviewWorkflow';
import {
  downloadBlob,
  formatInvoiceMoney,
  invoiceFilename,
  invoiceTotal,
} from '../invoice/invoiceUtils';
import type {
  GeneratedInvoiceRecord,
  InvoiceDocumentModel,
  InvoiceEditContext,
  InvoiceReviewStatus,
  Payout,
} from '../types';

export type InvoiceDetailSource =
  | { kind: 'payout'; payout: Payout; record?: GeneratedInvoiceRecord }
  | { kind: 'generated'; record: GeneratedInvoiceRecord; payout?: Payout }
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

const timelineIndex = (status: InvoiceReviewStatus) => {
  if (status === '待签署') return 1;
  if (status === '达人反馈') return 1;
  if (status === '待媒介审核' || status === '待媒介复核') return 2;
  if (
    status === '待发起请款'
    || status === '待PM审核'
    || status === '待项目负责人审核'
    || status === '待老板审核'
    || status === '待财务审核'
  ) return 3;
  return 4;
};

export const getInvoiceTimelineState = (status: InvoiceReviewStatus) => ({
  currentIndex: timelineIndex(status),
  currentStepText: status === '达人反馈' ? '达人反馈 · 待重新签署' : '当前步骤',
});

const ACTION_LABEL: Record<InvoiceReviewAction, string> = {
  MARK_SIGNED: '标记达人签署完成',
  RECORD_CREATOR_FEEDBACK: '记录达人反馈',
  APPROVE_MEDIA: '审核通过',
  RETURN_TO_CREATOR: '退回达人修改',
};

const formatReviewTime = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  hour12: false,
}).format(new Date(value));

const deliveryEmailIsValid = (value: string) => {
  const [localPart, domain] = value.trim().split('@');
  return Boolean(localPart && domain?.includes('.'));
};

const maskDeliveryEmail = (value: string) => {
  const [localPart, domain] = value.trim().split('@');
  if (!localPart || !domain) return '达人档案邮箱待补充';
  return `${localPart.slice(0, 1)}***@${domain}`;
};

export const buildInvoiceSignatureReminderMessage = (model: InvoiceDocumentModel) => {
  const creatorName = model.creatorName || model.from.legalName || '达人';
  return `Hi ${creatorName}，Invoice ${model.invoiceNumber} 已准备好，请登录达人端系统，在 Invoice 中心查看并完成签署。如有疑问，可通过站内信反馈。`;
};

function InvoiceDeliveryNotice({
  email,
  purpose,
}: {
  email: string;
  purpose: 'feedback' | 'signature';
}) {
  const signatureReminder = purpose === 'signature';
  const hasEmail = deliveryEmailIsValid(email);
  return (
    <div
      className="invoice-feedback-delivery"
      role="note"
      aria-label={signatureReminder ? '签署提醒发送渠道说明' : '回复发送渠道说明'}
    >
      <div className="invoice-feedback-delivery-title">
        <Send size={16} />
        <span>
          <strong>{signatureReminder ? '通知发送渠道' : '回复发送渠道'}</strong>
          <small>{signatureReminder ? '发送后将通过两个渠道同步提醒达人签署' : '提交后将通过两个渠道同步触达达人'}</small>
        </span>
      </div>
      <ul>
        <li>
          <MessageSquareText size={16} />
          <span>
            <strong>达人端站内信</strong>
            <small>{signatureReminder ? '发送至达人端 Invoice 消息中心，并引导进入签署' : '发送至达人端的 Invoice 消息中心'}</small>
          </span>
        </li>
        <li>
          <Mail size={16} />
          <span>
            <strong>邮件（站外信）</strong>
            <small>{hasEmail ? `发送至达人档案邮箱：${maskDeliveryEmail(email)}` : '未发送 · 达人档案邮箱待补充'}</small>
          </span>
        </li>
      </ul>
      <p>
        <Info size={15} />
        <span>
          <strong>原型说明：</strong>
          {signatureReminder ? '当前仅模拟发送并保留通知记录' : '当前仅模拟发送并保留回复记录'}，不会真实触发站内信或邮件。正式接入后需分别记录双渠道发送状态、失败原因和重试结果，并保留操作审计。
        </span>
      </p>
    </div>
  );
}

export function InvoiceFeedbackDeliveryNotice({ email }: { email: string }) {
  return <InvoiceDeliveryNotice email={email} purpose="feedback" />;
}

export function InvoiceSignatureReminderDeliveryNotice({ email }: { email: string }) {
  return <InvoiceDeliveryNotice email={email} purpose="signature" />;
}

const sameText = (left: string, right: string) => (
  left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()
);

const maskedAccountSummary = (value: string) => {
  if (!value) return '待补充';
  if (value.includes('@')) return value;
  const normalized = value.replace(/\s/g, '');
  return `•••• ${normalized.slice(-4)}`;
};

const sameAccount = (left: string, right: string) => {
  if (!left || !right || right === '待补充') return false;
  if (left.includes('@') || right.includes('@')) {
    return sameText(left, right)
      || sameText(maskInvoiceAccountValue(left), right)
      || sameText(left, maskInvoiceAccountValue(right));
  }
  return left.replace(/\s/g, '').slice(-4) === right.replace(/\s/g, '').slice(-4);
};

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
      contractValue: maskedAccountSummary(payout.account),
      invoiceValue: accountSummary,
      passed: !accountIssue && sameAccount(payout.account, accountSummary),
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
  onMarkSigned,
  onReviewAction,
  onReplyFeedback,
  onSendSignatureReminder,
  onEditInvoice,
  onOpenProject,
  onOpenRequest,
  onOpenPayment,
  canManageInvoice,
  canReviewMedia,
  canReviewFinance,
  canExecutePayout = false,
  notify,
}: {
  source: InvoiceDetailSource;
  model: InvoiceDocumentModel;
  onBack: () => void;
  backLabel?: string;
  onMarkSigned: (record: GeneratedInvoiceRecord) => void;
  onReviewAction: (
    payout: Payout,
    action: InvoiceReviewAction,
    reason?: string,
  ) => void;
  onReplyFeedback?: (payout: Payout, message: string) => void;
  onSendSignatureReminder?: (payout: Payout, message: string, email: string) => boolean;
  onEditInvoice?: (payout: Payout, context: InvoiceEditContext) => void;
  onOpenProject?: (payout: Payout) => void;
  onOpenRequest?: (payout: Payout) => void;
  onOpenPayment?: (payout: Payout) => void;
  canManageInvoice: boolean;
  canReviewMedia: boolean;
  canReviewFinance: boolean;
  canExecutePayout?: boolean;
  notify: Notify;
}) {
  const [activeTab, setActiveTab] = useState<InvoiceDetailTab>('summary');
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | ''>('');
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [signatureReminderDialogOpen, setSignatureReminderDialogOpen] = useState(false);
  const [signatureReminderMessage, setSignatureReminderMessage] = useState('');
  const signatureReminderTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [dismissedDocumentNoteId, setDismissedDocumentNoteId] = useState<string | null>(null);
  const payout = source.kind === 'payout'
    ? source.payout
    : source.kind === 'generated'
      ? source.payout ?? null
      : null;
  const invoiceReviewStatus = source.kind === 'payout'
    ? source.payout.invoiceReviewStatus
    : source.kind === 'generated'
      ? source.payout?.invoiceReviewStatus ?? source.record.status
      : null;
  const displayStatus = invoiceReviewStatus
    ? getInvoiceRowStatus({
        invoiceReviewStatus,
        status: payout?.status ?? '未进入付款',
      })
    : source.kind === 'project'
      ? source.status
      : '';
  const displayStatusKey = invoiceReviewStatus === '已通过' && payout
    ? getApprovedInvoicePaymentStatus(payout)
    : invoiceReviewStatus ?? '未进入付款';
  const provider = source.kind === 'payout'
    ? source.payout.provider
    : source.kind === 'generated' && source.payout
      ? source.payout.provider
    : source.kind === 'project'
      ? source.provider
      : '尚未指定付款渠道';
  const checks = useMemo(() => buildReviewChecks(source, model), [model, source]);
  const passedCount = checks.filter((check) => check.passed).length;
  const allPassed = checks.length > 0 && passedCount === checks.length;
  const availableActions = invoiceReviewStatus
    ? getInvoiceDetailReviewActions(invoiceReviewStatus, {
        manage: canManageInvoice,
        mediaReview: canReviewMedia,
        financeReview: canReviewFinance,
      })
    : [];
  const returnAction = availableActions.find((action) => (
    action === 'RETURN_TO_CREATOR' || action === 'RECORD_CREATOR_FEEDBACK'
  ));
  const primaryAction = availableActions.find((action) => (
    action !== 'RETURN_TO_CREATOR' && action !== 'RECORD_CREATOR_FEEDBACK'
  ));
  const editContext = payout
    ? getInvoiceEditContext(payout, {
        manage: canManageInvoice,
        mediaReview: canReviewMedia,
        financeReview: canReviewFinance,
      })
    : null;
  const isPaymentListReturn = payout?.invoiceReviewStatus === '已退回'
    && payout.paymentFailureReturn?.issueType === 'PAYMENT_LIST';
  const navigationTarget = invoiceReviewStatus
    ? getInvoiceDetailNavigationTarget(invoiceReviewStatus)
    : null;
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
  const invoiceTimelineState = invoiceReviewStatus
    ? getInvoiceTimelineState(invoiceReviewStatus)
    : null;
  const currentIndex = invoiceTimelineState?.currentIndex ?? projectTimelineIndex;
  const requestApprovalRound = payout?.requestApprovalRound
    ?? Math.max(0, ...(payout?.invoiceReviewHistory ?? []).map((event) => event.approvalRound ?? 0));
  const paymentListVersion = payout?.paymentListVersion
    ?? (
      invoiceReviewStatus && (
        invoiceReviewStatus === '待PM审核'
        || invoiceReviewStatus === '待项目负责人审核'
        || invoiceReviewStatus === '待老板审核'
        || invoiceReviewStatus === '待财务审核'
        || invoiceReviewStatus === '已通过'
        || invoiceReviewStatus === '已退回'
      )
        ? 1
        : null
    );
  const steps = invoiceReviewStatus
    ? ['Invoice 已生成', '达人签署', '媒介审核 / 复核', '项目请款审批', '进入付款']
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
  const normalizedReplyMessage = replyMessage.trim();
  const normalizedSignatureReminderMessage = signatureReminderMessage.trim();
  const canSendSignatureReminder = invoiceReviewStatus === '待签署'
    && canManageInvoice
    && Boolean(payout && onSendSignatureReminder);

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
    if (!payout || !returnAction || !normalizedReturnReason) return;
    onReviewAction(payout, returnAction, normalizedReturnReason);
    setReturnDialogOpen(false);
    setReturnReason('');
  };

  const runPrimaryAction = () => {
    if (!primaryAction) return;
    const generatedRecord = source.kind === 'generated'
      ? source.record
      : source.kind === 'payout'
        ? source.record
        : undefined;
    if (primaryAction === 'MARK_SIGNED' && generatedRecord) {
      onMarkSigned(generatedRecord);
      return;
    }
    if (payout) {
      onReviewAction(payout, primaryAction);
    }
  };

  const submitFeedbackReply = () => {
    if (!payout || !normalizedReplyMessage || !onReplyFeedback) return;
    onReplyFeedback(payout, normalizedReplyMessage);
    setReplyMessage('');
  };

  const closeFeedbackDialog = () => {
    setFeedbackDialogOpen(false);
    setReplyMessage('');
  };

  const openSignatureReminderDialog = (event: ReactMouseEvent<HTMLButtonElement>) => {
    signatureReminderTriggerRef.current = event.currentTarget;
    setSignatureReminderMessage(buildInvoiceSignatureReminderMessage(model));
    setSignatureReminderDialogOpen(true);
  };

  const closeSignatureReminderDialog = () => {
    setSignatureReminderDialogOpen(false);
    setSignatureReminderMessage('');
    window.requestAnimationFrame(() => signatureReminderTriggerRef.current?.focus());
  };

  const submitSignatureReminder = () => {
    if (!payout || !onSendSignatureReminder || !normalizedSignatureReminderMessage) return;
    const sent = onSendSignatureReminder(
      payout,
      normalizedSignatureReminderMessage,
      model.from.email,
    );
    if (sent) closeSignatureReminderDialog();
  };

  const openFeedbackDialog = () => {
    if (!payout?.creatorFeedback) {
      notify('反馈内容缺失', '当前记录缺少达人反馈正文，请先核对原始记录。');
      return;
    }
    setFeedbackDialogOpen(true);
  };

  const runNavigationAction = () => {
    if (!payout || !navigationTarget) return;
    if (navigationTarget === 'PROJECT') {
      onOpenProject?.(payout);
      return;
    }
    if (navigationTarget === 'REQUEST') {
      onOpenRequest?.(payout);
      return;
    }
    onOpenPayment?.(payout);
  };

  const navigationActionLabel = navigationTarget === 'PROJECT'
    ? canManageInvoice ? '前往项目发起请款' : '查看关联项目'
    : navigationTarget === 'REQUEST'
      ? '查看 / 处理请款审批'
      : navigationTarget === 'PAYMENT' && payout
        ? payout.status === '付款失败'
          ? canExecutePayout ? '处理付款失败' : '查看失败信息'
          : payout.status === '已付款'
            ? '查看付款记录'
            : payout.status === '付款处理中'
              ? '查看付款进度'
              : canExecutePayout ? '处理付款' : '查看付款详情'
        : '';

  const statusHint = invoiceReviewStatus === '待签署'
    ? '等待达人完成签署，可通知达人登录系统签署'
    : invoiceReviewStatus === '达人反馈'
      ? '达人尚未完成签署；查看反馈，回复或修改后重新发送'
      : navigationTarget === 'PROJECT'
        ? '项目内全部 Invoice 就绪后统一发起请款'
        : navigationTarget === 'REQUEST'
          ? '项目审批操作统一在请款项目详情完成'
          : navigationTarget === 'PAYMENT'
            ? '付款操作统一在付款详情完成'
            : `${passedCount}/${checks.length}项资料校验通过`;

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
            {canSendSignatureReminder ? (
              <Button variant="secondary" icon={<Send size={16} />} onClick={openSignatureReminderDialog}>
                通知达人签署
              </Button>
            ) : null}
            <Button icon={<Download size={16} />} disabled={Boolean(downloading)} onClick={() => downloadInvoice('pdf')}>
              {downloading === 'pdf' ? '生成中…' : '下载PDF'}
            </Button>
          </>
        )}
      />

      <div className="contract-metric-grid">
        <article>
          <span>当前状态</span>
          <strong className="invoice-detail-current-status">
            <StatusMark status={displayStatusKey} label={displayStatus} />
          </strong>
          <small>{statusHint}</small>
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
                  <div><dt>账户版本</dt><dd>{model.payoutAccountVersion ?? model.payment.payoutAccountVersion ?? 'legacy-v1'}</dd></div>
                  {model.paymentMethod === 'paypal' ? <div><dt>Transfer Note</dt><dd>{model.payment.transferRemarks || '未填写'}</dd></div> : null}
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
                {payout ? (
                  <dl className="contract-payment-list">
                    <div><dt>Invoice 版本</dt><dd>V{payout.invoiceVersion ?? 1}</dd></div>
                    <div><dt>签署轮次</dt><dd>第 {payout.invoiceSignatureRound ?? 0} 轮</dd></div>
                    <div><dt>项目审批轮次</dt><dd>{requestApprovalRound > 0 ? `第 ${requestApprovalRound} 轮` : '未发起'}</dd></div>
                    <div><dt>付款清单版本</dt><dd>{paymentListVersion ? `V${paymentListVersion}` : '未生成'}</dd></div>
                    <div><dt>最近签署时间</dt><dd>{payout.invoiceSignedAt ? formatReviewTime(payout.invoiceSignedAt) : '待签署'}</dd></div>
                    <div><dt>达人反馈</dt><dd>{payout.creatorFeedback?.reason ?? '无待处理反馈'}</dd></div>
                    {payout.paymentFailure ? (
                      <>
                        <div><dt>付款失败渠道</dt><dd>{payout.paymentFailure.provider}</dd></div>
                        <div><dt>渠道错误码</dt><dd>{payout.paymentFailure.errorCode}</dd></div>
                      </>
                    ) : null}
                    {payout.paymentFailureReturn ? (
                      <>
                        <div><dt>财务问题分类</dt><dd>{payout.paymentFailureReturn.issueType === 'INVOICE_CONTENT' ? 'Invoice 内容问题' : '付款清单问题'}</dd></div>
                        <div><dt>下一步起点</dt><dd>{payout.paymentFailureReturn.issueType === 'INVOICE_CONTENT' ? '修改 Invoice 后达人重新签署' : '项目付款清单重新提交后进入 PM 审批'}</dd></div>
                      </>
                    ) : null}
                  </dl>
                ) : null}
                <div className="invoice-detail-timeline">
                  {steps.map((step, index) => {
                    const complete = invoiceReviewStatus
                      ? index < currentIndex || (invoiceReviewStatus === '已通过' && payout?.status === '已付款')
                      : source.kind === 'project'
                        ? index < currentIndex || /已完成|已付款/.test(source.status)
                        : index === 0;
                    const current = invoiceReviewStatus
                      ? index === currentIndex && !(invoiceReviewStatus === '已通过' && payout?.status === '已付款')
                      : source.kind === 'project'
                        ? index === currentIndex && !/已完成|已付款/.test(source.status)
                        : index === 1;
                    const stepState = complete
                      ? '已完成'
                      : current
                        ? invoiceTimelineState?.currentStepText ?? '当前步骤'
                        : '待处理';
                    return (
                      <div className={`${complete ? 'is-complete' : ''} ${current ? 'is-current' : ''}`} key={step}>
                        <span>{complete ? <Check size={14} /> : index + 1}</span>
                        <div><strong>{step}</strong><small>{stepState}</small></div>
                      </div>
                    );
                  })}
                </div>
                {payout?.invoiceReviewHistory?.length ? (
                  <div className="invoice-review-history-list">
                    {[...payout.invoiceReviewHistory].reverse().map((event, index) => (
                      <article key={`${event.occurredAt}-${event.action}-${index}`}>
                        <span>{
                          event.action === '通知达人签署'
                            ? '签署提醒'
                            : event.stage === 'MEDIA'
                            ? '媒介审核'
                            : event.stage === 'REQUEST'
                              ? '项目请款'
                              : event.stage === 'PM'
                                ? 'PM 审批'
                                : event.stage === 'PROJECT_OWNER'
                                  ? '项目负责人审批'
                                  : event.stage === 'OWNER'
                                    ? '老板审批'
                                    : event.stage === 'FINANCE'
                                      ? '财务审批'
                                      : event.stage === 'PAYMENT'
                                        ? '付款处理'
                                        : '签署提交'
                        }</span>
                        <div>
                          <strong>{event.action === '通知达人签署' ? '已发送签署提醒 · 状态保持待签署' : `${event.action}：${event.fromStatus} → ${event.toStatus}`}</strong>
                          <small>{event.approvalRound ? `第 ${event.approvalRound} 轮 · ` : ''}{event.actorName} · {event.actorRole} · {formatReviewTime(event.occurredAt)}</small>
                          {event.reason ? <p>{event.reason}</p> : null}
                          {event.notificationDeliveries?.length ? (
                            <div className="invoice-notification-delivery-results">
                              {event.notificationDeliveries.map((delivery) => (
                                <span key={delivery.channel}>
                                  {delivery.channel === 'IN_APP' ? '站内信' : '邮件'} · {delivery.status === 'SIMULATED_SENT' ? '模拟已发送' : '未发送'} · {delivery.recipientLabel}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="invoice-review-history-empty">暂无人工审核操作记录。</p>
                )}
              </>
            ) : null}
          </div>

          <footer className="invoice-review-actions">
            <div>
              <FileCheck2 size={16} />
              <span>{
                isPaymentListReturn
                  ? '等待项目付款清单重新提交'
                  : invoiceReviewStatus === '待签署'
                  ? '等待达人签署'
                  : allPassed
                    ? '关键资料已匹配'
                    : `${checks.length - passedCount}项需要处理`
              }</span>
            </div>
            <span>
              {source.kind !== 'payout' ? (
                <Button variant="secondary" disabled={Boolean(downloading)} onClick={() => downloadInvoice('docx')}>
                  {downloading === 'docx' ? '生成中…' : '下载DOCX'}
                </Button>
              ) : null}
              {invoiceReviewStatus === '达人反馈' ? (
                <Button
                  variant="secondary"
                  icon={<MessageSquareText size={16} />}
                  onClick={openFeedbackDialog}
                >
                  查看反馈
                </Button>
              ) : null}
              {editContext && payout ? (
                <Button onClick={() => onEditInvoice?.(payout, editContext)}>
                  {editContext === 'CREATOR_FEEDBACK'
                    ? '修改并重新发送达人'
                    : editContext === 'MEDIA_RECHECK'
                      ? '修改 Invoice'
                      : '修改并重新发起'}
                </Button>
              ) : null}
              {returnAction ? <Button variant="secondary" onClick={() => setReturnDialogOpen(true)}>{ACTION_LABEL[returnAction]}</Button> : null}
              {primaryAction ? (
                <Button
                  disabled={primaryAction === 'APPROVE_MEDIA' && !allPassed}
                  onClick={runPrimaryAction}
                >
                  {primaryAction === 'APPROVE_MEDIA' && payout?.invoiceReviewStatus === '待媒介复核'
                    ? '复核通过并重新提交'
                  : ACTION_LABEL[primaryAction]}
                </Button>
              ) : null}
              {navigationTarget && payout ? (
                <Button onClick={runNavigationAction}>{navigationActionLabel}</Button>
              ) : null}
            </span>
          </footer>
        </section>
      </div>

      {signatureReminderDialogOpen && payout ? (
        <Modal
          title="通知达人签署"
          width="560px"
          onClose={closeSignatureReminderDialog}
          footer={(
            <>
              <Button variant="ghost" onClick={closeSignatureReminderDialog}>取消</Button>
              <Button
                icon={<Send size={16} />}
                disabled={!normalizedSignatureReminderMessage}
                onClick={submitSignatureReminder}
              >
                发送签署提醒
              </Button>
            </>
          )}
        >
          <div className="invoice-feedback-thread">
            <article className="invoice-feedback-message invoice-feedback-message-reply">
              <span><UserRound size={18} /></span>
              <div>
                <strong>{model.creatorName || payout.creator} · 待签署</strong>
                <small>{model.invoiceNumber} · {model.projectName || payout.project}</small>
                <p>提醒达人登录达人端系统，在 Invoice 中心查看并完成当前 Invoice 签署。</p>
              </div>
            </article>
            <label className="return-review-field invoice-feedback-reply">
              <span>提醒内容 <em className="required-mark" aria-hidden="true">*</em><small>{signatureReminderMessage.length}/300</small></span>
              <textarea
                autoFocus
                maxLength={300}
                aria-label="签署提醒内容"
                placeholder="请输入签署提醒内容"
                value={signatureReminderMessage}
                onChange={(event) => setSignatureReminderMessage(event.target.value)}
              />
            </label>
            <InvoiceSignatureReminderDeliveryNotice email={model.from.email} />
          </div>
        </Modal>
      ) : null}

      {feedbackDialogOpen && payout?.creatorFeedback ? (
        <Modal
          title="达人反馈"
          width="560px"
          onClose={closeFeedbackDialog}
          footer={(
            <>
              <Button variant="ghost" onClick={closeFeedbackDialog}>关闭</Button>
              {canManageInvoice ? (
                <Button
                  icon={<Send size={16} />}
                  disabled={!normalizedReplyMessage}
                  onClick={submitFeedbackReply}
                >
                  回复反馈
                </Button>
              ) : null}
            </>
          )}
        >
          <div className="invoice-feedback-thread">
            <article className="invoice-feedback-message invoice-feedback-message-creator">
              <span><UserRound size={18} /></span>
              <div>
                <strong>{payout.creatorFeedback.actorName} · 达人反馈</strong>
                <small>{formatReviewTime(payout.creatorFeedback.occurredAt)}</small>
                <p>{payout.creatorFeedback.reason}</p>
              </div>
            </article>
            {(payout.creatorFeedback.replies ?? []).map((reply, index) => (
              <article
                className="invoice-feedback-message invoice-feedback-message-reply"
                key={`${reply.occurredAt}-${reply.actorAccount}-${index}`}
              >
                <span><MessageSquareText size={18} /></span>
                <div>
                  <strong>{reply.actorName} · {reply.actorRole}</strong>
                  <small>{formatReviewTime(reply.occurredAt)}</small>
                  <p>{reply.message}</p>
                </div>
              </article>
            ))}
            {canManageInvoice ? (
              <>
                <label className="return-review-field invoice-feedback-reply">
                  <span>回复内容 <em className="required-mark" aria-hidden="true">*</em><small>{replyMessage.length}/300</small></span>
                  <textarea
                    maxLength={300}
                    aria-label="回复达人反馈"
                    placeholder="请输入对达人反馈的回复"
                    value={replyMessage}
                    onChange={(event) => setReplyMessage(event.target.value)}
                  />
                </label>
                <InvoiceFeedbackDeliveryNotice email={model.from.email} />
              </>
            ) : (
              <p className="invoice-review-history-empty">当前角色仅可查看反馈。</p>
            )}
          </div>
        </Modal>
      ) : null}

      {returnDialogOpen ? (
        <Modal
          title={returnAction === 'RECORD_CREATOR_FEEDBACK' ? '记录达人反馈' : '退回达人修改'}
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
                placeholder={returnAction === 'RECORD_CREATOR_FEEDBACK'
                  ? '请输入达人提出的修改意见'
                  : '请说明需要达人修改的内容，例如：签署页信息错误'}
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
              />
              <small>原因会同步给相关人员，并记录审核阶段、操作人和时间。</small>
            </label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
