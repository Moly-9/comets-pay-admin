import {
  ArrowLeft,
  Clipboard,
  Download,
  FileSearch,
  Info,
  Mail,
  MessageSquareText,
  Send,
  UserRound,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Button, Modal, PageHeading, StatusMark } from '../components/Common';
import { InvoiceDocumentView } from '../components/InvoiceDocumentView';
import {
  InvoiceReviewMetricGrid,
  InvoiceReviewWorkspace,
  type InvoiceReviewAccountRow,
  type InvoiceReviewContractCheck,
  type InvoiceReviewSummaryField,
  type InvoiceReviewTimelineItem,
} from '../components/InvoiceReviewWorkspace';
import type { ContractRecord } from '../contracts';
import {
  currentInvoiceContractMatchReview,
  evaluateInvoiceContractMatch,
} from '../invoice/invoiceContractMatching';
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
import type { InvoiceManagementView } from '../invoice/invoiceManagement';

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
  if (status === '已通过') return 3;
  return 3;
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
    const signed = Boolean(model.signatureText || model.signatureDate || source.payout?.invoiceSignedAt);
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
        invoiceValue: signed ? '已完成电子签署' : '签名区域留空',
        passed: signed,
        note: signed ? '模拟达人签署已完成，可进入审核' : '当前文件等待达人签署，暂不可进入财务复核',
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

export function InvoiceDetailPage({
  source,
  model,
  contracts = [],
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
  canEditProjectResource = false,
  canExecutePayout = false,
  managementView,
  notify,
}: {
  source: InvoiceDetailSource;
  model: InvoiceDocumentModel;
  contracts?: ContractRecord[];
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
  canEditProjectResource?: boolean;
  canExecutePayout?: boolean;
  managementView?: InvoiceManagementView;
  notify: Notify;
}) {
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | ''>('');
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
  const generatedRecord = source.kind === 'generated'
    ? source.record
    : source.kind === 'payout'
      ? source.record
      : undefined;
  const invoiceReviewStatus = source.kind === 'payout'
    ? source.payout.invoiceReviewStatus
    : source.kind === 'generated'
      ? source.payout?.invoiceReviewStatus ?? source.record.status
      : null;
  const displayStatus = managementView?.status ?? (invoiceReviewStatus
    ? getInvoiceRowStatus({
        invoiceReviewStatus,
        status: payout?.status ?? '未进入付款',
      })
    : source.kind === 'project'
      ? source.status
    : '');
  const displayStatusKey = managementView?.status === '已通过'
    ? '已通过'
    : invoiceReviewStatus === '已通过' && payout
    ? getApprovedInvoicePaymentStatus(payout)
    : invoiceReviewStatus ?? '未进入付款';
  const provider = source.kind === 'payout'
    ? source.payout.provider
    : source.kind === 'generated' && source.payout
      ? source.payout.provider
    : source.kind === 'project'
      ? source.provider
      : '尚未指定付款渠道';
  const selectedContracts = useMemo(() => contracts.filter((contract) => (
    Boolean(contract.contractId && model.contractIds?.includes(contract.contractId))
  )), [contracts, model.contractIds]);
  const storedContractMatchReview = generatedRecord
    ? currentInvoiceContractMatchReview(generatedRecord)
    : undefined;
  const contractMatch = useMemo(() => generatedRecord
    ? evaluateInvoiceContractMatch(
        selectedContracts,
        model,
        storedContractMatchReview?.reason ?? '',
      )
    : null, [generatedRecord, model, selectedContracts, storedContractMatchReview?.reason]);
  const checks = useMemo<InvoiceReviewCheck[]>(() => contractMatch
    ? contractMatch.checks.map((check) => ({
        id: check.field.toLowerCase(),
        label: check.label,
        contractValue: check.contractValue,
        invoiceValue: check.invoiceValue,
        passed: ['MATCH', 'NOT_APPLICABLE', 'APPROVED_WITH_REASON'].includes(check.state),
        note: check.message,
      }))
    : buildReviewChecks(source, model), [contractMatch, model, source]);
  const passedCount = checks.filter((check) => check.passed).length;
  const allPassed = checks.length > 0 && passedCount === checks.length;
  const signedForMediaReview = Boolean(model.signatureText || model.signatureDate || payout?.invoiceSignedAt);
  const contractMatchEnforced = Boolean(storedContractMatchReview);
  const mediaApprovalReady = signedForMediaReview
    && (!contractMatchEnforced || Boolean(contractMatch?.canProceed));
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
        projectResourceEdit: canEditProjectResource,
      })
    : null;
  const isPaymentListReturn = payout?.invoiceReviewStatus === '已退回'
    && payout.paymentFailureReturn?.issueType === 'PAYMENT_LIST';
  const navigationTarget = managementView?.status === 'OA审批中'
    ? 'REQUEST'
    : managementView?.status === '已通过'
      ? 'PROJECT'
      : managementView && ['付款中', '已付款'].includes(managementView.status)
        ? 'PAYMENT'
        : invoiceReviewStatus
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
  const currentIndex = managementView && ['付款中', '已付款'].includes(managementView.status)
    ? 4
    : invoiceTimelineState?.currentIndex ?? projectTimelineIndex;
  const steps = invoiceReviewStatus
    ? ['Invoice 已生成', '达人签署', '审核 / 复核', '项目请款审批', '进入付款']
    : source.kind === 'project'
      ? ['Invoice 已关联', '合同一一匹配', '项目审批', '财务复核', '渠道付款']
      : ['Invoice 已生成', '达人签署', '项目关联', '财务复核', '进入付款'];
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

  const runPrimaryAction = () => {
    if (!primaryAction) return;
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
    ? canManageInvoice ? '前往我的项目发起请款' : '查看我的项目'
    : navigationTarget === 'REQUEST'
      ? '查看请款审批'
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
        ? 'Invoice 已通过，可在“我的项目”中创建请款项目'
        : navigationTarget === 'REQUEST'
          ? '项目审批操作统一在请款项目详情完成'
          : navigationTarget === 'PAYMENT'
            ? '付款操作统一在付款详情完成'
            : `${passedCount}/${checks.length}项资料校验通过`;

  const summaryFields: InvoiceReviewSummaryField[] = [
    { id: 'invoice-number', label: 'Invoice Number', value: model.invoiceNumber, secondary: '系统业务编号', evidenceTarget: '.invoice-paper-number' },
    { id: 'invoice-date', label: 'Invoice Date', value: model.invoiceDate || '待补充', secondary: 'Date of Invoice', evidenceTarget: '.invoice-paper-meta > section:nth-child(2)' },
    { id: 'invoice-from', label: 'Invoice From', value: model.from.legalName || '待补充', secondary: model.from.email || '联系邮箱待补充', evidenceTarget: '.invoice-paper-meta > section:first-child' },
    { id: 'bill-to', label: 'Bill To', value: model.billTo.name || '待补充', secondary: model.billTo.address || '地址待补充', evidenceTarget: '.invoice-paper-bill-to' },
    { id: 'project', label: '项目及合作项', value: model.projectName || '待关联', secondary: model.projectId || '项目编号待关联', evidenceTarget: '.invoice-paper-table-wrap' },
    { id: 'description', label: 'Description', value: model.items.map((item) => item.description).filter(Boolean).join('；') || '待补充', secondary: `${model.items.length} 项费用明细`, evidenceTarget: '.invoice-paper-table-wrap' },
    { id: 'amount', label: '金额和币种', value: formatInvoiceMoney(model.currency, invoiceTotal(model)), secondary: model.currency, evidenceTarget: '.invoice-paper-total' },
    { id: 'payment', label: '付款方式与账户', value: model.paymentMethod === 'bank' ? '银行转账' : 'PayPal', secondary: invoiceAccountSummary(model), evidenceTarget: '.invoice-paper-payment' },
  ];
  const workspaceContractChecks: InvoiceReviewContractCheck[] = checks.map((check) => ({
    id: check.id,
    label: check.label,
    contractValue: check.contractValue,
    invoiceValue: check.invoiceValue,
    state: check.passed ? 'PASS' : 'FAIL',
    note: check.note,
    evidenceTarget: check.id.includes('account')
      ? '.invoice-paper-payment'
      : check.id.includes('amount')
        ? '.invoice-paper-total'
        : check.id.includes('bill')
          ? '.invoice-paper-bill-to'
          : check.id.includes('party') || check.id.includes('publisher')
            ? '.invoice-paper-meta > section:first-child'
            : check.id.includes('signature')
              ? '.invoice-paper-signature'
              : '.invoice-paper-table-wrap',
  }));
  const workspaceAccountRows: InvoiceReviewAccountRow[] = [
    { label: '付款方式', value: model.paymentMethod === 'bank' ? 'Bank transfer' : 'PayPal' },
    { label: 'Account Name', value: model.paymentMethod === 'bank' ? model.payment.accountName || '待补充' : model.payment.paypalUsername || '待补充' },
    { label: 'Account Number / IBAN', value: invoiceAccountSummary(model) },
    { label: 'Bank Name', value: model.paymentMethod === 'bank' ? model.payment.bankName || '待补充' : '不适用' },
    { label: 'SWIFT / BIC', value: model.paymentMethod === 'bank' ? model.payment.swiftCode || '待补充' : '不适用' },
    { label: 'PayPal Email', value: model.paymentMethod === 'paypal' ? model.payment.paypalEmail || '待补充' : '不适用' },
    { label: '账户版本', value: model.payoutAccountVersion ?? model.payment.payoutAccountVersion ?? 'legacy-v1' },
    { label: '账户审核状态', value: checks.find((check) => check.id.includes('account'))?.passed ? '已审核通过' : '待复核' },
  ];
  const processTimeline: InvoiceReviewTimelineItem[] = steps.map((step, index) => {
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
    return {
      id: `process-${index}`,
      title: step,
      description: complete ? '当前流程节点已完成' : current ? invoiceTimelineState?.currentStepText ?? '当前处理节点' : '等待上一节点完成',
      state: complete ? 'COMPLETE' : current ? 'CURRENT' : 'PENDING',
    };
  });
  const auditTimeline: InvoiceReviewTimelineItem[] = [...(payout?.invoiceReviewHistory ?? [])]
    .reverse()
    .map((event, index) => ({
      id: `audit-${event.occurredAt}-${index}`,
      title: event.action,
      description: event.reason ?? `${event.fromStatus} → ${event.toStatus}`,
      meta: `${event.actorName} · ${event.actorRole} · ${formatReviewTime(event.occurredAt)}`,
      state: event.action === '退回' || event.action === '退回媒介' || event.action === '达人反馈'
        ? 'RETURNED'
        : 'COMPLETE',
    }));
  const workspaceBlockingReasons = [
    ...(isPaymentListReturn ? ['等待项目付款清单重新提交'] : []),
    ...(primaryAction === 'APPROVE_MEDIA' && !signedForMediaReview ? ['达人尚未完成签署，不能进行审核'] : []),
    ...(primaryAction === 'APPROVE_MEDIA' && contractMatchEnforced && !contractMatch?.canProceed
      ? ['合同与 Invoice 存在未处理的阻断项']
      : []),
    ...(!primaryAction && !allPassed ? [`${checks.length - passedCount} 项资料需要关注`] : []),
  ];

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

      <InvoiceReviewMetricGrid items={[
        {
          label: 'Invoice类型',
          value: '内部 Invoice',
          secondary: '系统生成 · 保留结构化字段与签署版本',
        },
        {
          label: '当前状态',
          value: <span className="invoice-detail-current-status"><StatusMark status={displayStatusKey} label={displayStatus} /></span>,
          secondary: statusHint,
        },
        {
          label: 'Invoice金额',
          value: formatInvoiceMoney(model.currency, invoiceTotal(model)),
          secondary: `${model.items.length}项费用明细 · ${model.currency}`,
        },
        {
          label: '付款方式',
          value: model.paymentMethod === 'bank' ? '银行转账' : 'PayPal',
          secondary: `${provider} · ${invoiceAccountSummary(model)}`,
        },
      ]} />

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

      <InvoiceReviewWorkspace
        sourceType="INTERNAL_GENERATED"
        issueCount={Math.max(checks.length - passedCount, workspaceBlockingReasons.length)}
        sourceStatusText={displayStatus}
        documentName={`${model.invoiceNumber}.pdf`}
        documentMeta={`Invoice 全文 · 1 页 · 冻结版本 V${payout?.invoiceVersion ?? generatedRecord?.version ?? 1}`}
        documentContent={<InvoiceDocumentView model={model} ariaLabel={`${model.invoiceNumber} Invoice全文`} />}
        onDownload={() => downloadInvoice('pdf')}
        downloadDisabled={Boolean(downloading)}
        summaryFields={summaryFields}
        contractChecks={workspaceContractChecks}
        noContract={Boolean(generatedRecord && selectedContracts.length === 0)}
        accountRows={workspaceAccountRows}
        timeline={[...processTimeline, ...auditTimeline]}
        completion={{ completed: passedCount, total: checks.length }}
        blockingReasons={workspaceBlockingReasons}
        returnLabel={returnAction ? ACTION_LABEL[returnAction] : undefined}
        returnDialogTitle={returnAction === 'RECORD_CREATOR_FEEDBACK' ? '记录达人反馈' : '退回达人修改'}
        onReturn={payout && returnAction ? (reason) => onReviewAction(payout, returnAction, reason) : undefined}
        onSave={primaryAction === 'APPROVE_MEDIA' && canReviewMedia
          ? () => notify('审核进度已保存', `${model.invoiceNumber} 的审核进度已保留在当前前端原型中。`)
          : undefined}
        approveLabel={primaryAction
          ? primaryAction === 'APPROVE_MEDIA' && payout?.invoiceReviewStatus === '待媒介复核'
            ? '复核通过并重新提交'
            : ACTION_LABEL[primaryAction]
          : undefined}
        onApprove={primaryAction ? runPrimaryAction : undefined}
        approveDisabled={primaryAction === 'APPROVE_MEDIA' && !mediaApprovalReady}
        canReview={Boolean(primaryAction || returnAction)}
        additionalFooterActions={(
          <>
            {source.kind !== 'payout' ? (
              <Button variant="secondary" disabled={Boolean(downloading)} onClick={() => downloadInvoice('docx')}>
                {downloading === 'docx' ? '生成中…' : '下载DOCX'}
              </Button>
            ) : null}
            {invoiceReviewStatus === '达人反馈' ? (
              <Button variant="secondary" icon={<MessageSquareText size={16} />} onClick={openFeedbackDialog}>查看反馈</Button>
            ) : null}
            {editContext && payout ? (
              <Button onClick={() => onEditInvoice?.(payout, editContext)}>
                {editContext === 'CREATOR_FEEDBACK'
                  ? '修改并重新发送达人'
                  : editContext === 'MEDIA_RECHECK'
                    ? '修改 Invoice'
                    : editContext === 'PROJECT_RESOURCE'
                      ? '修改 Invoice 并重新签署'
                      : '修改并重新发起'}
              </Button>
            ) : null}
            {navigationTarget && payout ? <Button onClick={runNavigationAction}>{navigationActionLabel}</Button> : null}
          </>
        )}
      />
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

    </div>
  );
}
