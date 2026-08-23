import {
  ArrowLeft,
  Clipboard,
  Download,
  FileSearch,
  Info,
  Mail,
  MessageSquareText,
  Pencil,
  Send,
  Undo2,
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
import {
  getInvoiceManagementReturnContext,
  type InvoiceManagementView,
} from '../invoice/invoiceManagement';
import type { PaymentRequestProjectLike } from '../paymentRequestProjects';

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
  if (status === '草稿') return 1;
  if (status === '待签署') return 1;
  if (status === '达人反馈') return 1;
  if (status === '待媒介审核' || status === '待媒介复核') return 2;
  if (status === '已通过') return 3;
  return 3;
};

export const getInvoiceTimelineState = (status: InvoiceReviewStatus) => ({
  currentIndex: timelineIndex(status),
  currentStepText: status === '草稿'
    ? '草稿待发布'
    : status === '达人反馈' ? '达人反馈 · 待重新签署' : '当前步骤',
});

const ACTION_LABEL: Record<InvoiceReviewAction, string> = {
  MARK_SIGNED: '标记达人签署完成',
  RECORD_CREATOR_FEEDBACK: '记录达人反馈',
  APPROVE_MEDIA: '审核通过',
  RETURN_TO_CREATOR: '退回达人修改',
};

const formatReviewTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '未记录';
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  }).format(date);
};

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
  onPublishDraft,
  onWithdrawDraft,
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
  request,
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
  onPublishDraft?: (record: GeneratedInvoiceRecord) => boolean;
  onWithdrawDraft?: (record: GeneratedInvoiceRecord) => boolean;
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
  request?: PaymentRequestProjectLike;
  notify: Notify;
}) {
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | ''>('');
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [signatureReminderDialogOpen, setSignatureReminderDialogOpen] = useState(false);
  const [signatureReminderMessage, setSignatureReminderMessage] = useState('');
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
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
  const managementReturnContext = payout
    ? getInvoiceManagementReturnContext(payout, generatedRecord?.invoiceId, request)
    : null;
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
  const isDraft = invoiceReviewStatus === '草稿';
  const canPublishDraft = isDraft && canManageInvoice && Boolean(generatedRecord && onPublishDraft);
  const canEditHeader = Boolean(editContext && payout && onEditInvoice);
  const canWithdrawDraft = isDraft && canManageInvoice && Boolean(generatedRecord && onWithdrawDraft);

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

  const publishOrNotifyCreator = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (isDraft && generatedRecord && onPublishDraft) {
      onPublishDraft(generatedRecord);
      return;
    }
    openSignatureReminderDialog(event);
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

  const statusHint = invoiceReviewStatus === '草稿'
    ? 'Invoice 尚未发布，可继续编辑或撤销；发布后将通知达人签署'
    : invoiceReviewStatus === '待签署'
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
    state: contractMatch?.checks.find((candidate) => (
      candidate.field.toLowerCase() === check.id
    ))?.state === 'APPROVED_WITH_REASON'
      ? 'WARNING'
      : check.passed ? 'PASS' : 'FAIL',
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
      description: complete
        ? index === 0
          ? `Invoice V${payout?.invoiceVersion ?? generatedRecord?.version ?? 1} 已生成并保留结构化快照`
          : index === 1
            ? `已完成第 ${Math.max(1, payout?.invoiceSignatureRound ?? 1)} 轮达人签署`
            : index === 2
              ? '媒介已完成 Invoice 业务信息、合同与账户复核'
              : index === 3
                ? `请款项目已完成第 ${Math.max(1, request?.approval?.round ?? payout?.requestApprovalRound ?? 1)} 轮审批`
                : '付款记录已完成并归档'
        : current
          ? invoiceTimelineState?.currentStepText ?? '当前处理节点'
          : '等待上一节点完成',
      meta: complete
        ? index === 1 && payout?.invoiceSignedAt
          ? formatReviewTime(payout.invoiceSignedAt)
          : index === 0
            ? formatReviewTime(generatedRecord?.generatedAt ?? payout?.invoiceReviewHistory?.[0]?.occurredAt ?? '')
            : undefined
        : undefined,
      state: complete ? 'COMPLETE' : current ? 'CURRENT' : 'PENDING',
    };
  });
  const reviewHistory = payout?.invoiceReviewHistory ?? [];
  const latestReviewEvent = reviewHistory[reviewHistory.length - 1];
  const invoiceHistorySummary = [
    { label: 'Invoice 版本', value: `V${payout?.invoiceVersion ?? generatedRecord?.version ?? 1}` },
    {
      label: '签署轮次',
      value: payout?.invoiceSignatureRound ? `第 ${payout.invoiceSignatureRound} 轮` : '第 0 轮',
    },
    {
      label: '项目审批轮次',
      value: request?.approval?.round || payout?.requestApprovalRound
        ? `第 ${request?.approval?.round ?? payout?.requestApprovalRound} 轮`
        : '未发起',
    },
    { label: '付款清单版本', value: payout?.paymentListVersion ? `V${payout.paymentListVersion}` : '未生成' },
    { label: '最近签署时间', value: payout?.invoiceSignedAt ? formatReviewTime(payout.invoiceSignedAt) : '待签署' },
    { label: '达人反馈', value: payout?.creatorFeedback?.reason ?? '无待处理反馈' },
  ];
  const currentTask = (() => {
    const updatedAt = latestReviewEvent?.occurredAt
      ?? generatedRecord?.draftUpdatedAt
      ?? generatedRecord?.publishedAt
      ?? generatedRecord?.generatedAt
      ?? '未记录';
    if (invoiceReviewStatus === '草稿') return {
      title: '执行审核',
      transition: '草稿 → 发布达人签署 → 待签署',
      assignee: generatedRecord?.publishedBy?.name ?? 'Invoice 制作人',
      updatedAt: formatReviewTime(updatedAt),
      instruction: '确认 Invoice 内容无误后发布；发布前仍可编辑或撤销草稿。',
      tone: 'neutral' as const,
    };
    if (invoiceReviewStatus === '待签署' || invoiceReviewStatus === '达人反馈') return {
      title: '执行审核',
      transition: invoiceReviewStatus === '达人反馈' ? '达人反馈 → 修改 / 回复 → 重新签署' : '待签署 → 待审核',
      assignee: model.creatorName || '关联达人',
      updatedAt: formatReviewTime(updatedAt),
      instruction: invoiceReviewStatus === '达人反馈' ? '处理达人反馈后重新发起签署。' : '等待达人完成签署后进入媒介审核。',
      tone: invoiceReviewStatus === '达人反馈' ? 'warning' as const : 'neutral' as const,
    };
    if (invoiceReviewStatus === '待媒介审核' || invoiceReviewStatus === '待媒介复核') return {
      title: '执行审核',
      transition: `${invoiceReviewStatus === '待媒介复核' ? '待复核' : '待审核'} → 审核通过`,
      assignee: '媒介审核人',
      updatedAt: formatReviewTime(updatedAt),
      instruction: '核对票据、合同与收款账户后完成审核或退回达人修改。',
      tone: 'warning' as const,
    };
    if (managementView?.status === 'OA审批中') return {
      title: '项目请款审批',
      transition: `已通过 → ${request?.approval?.status ?? 'OA 审批中'}`,
      assignee: '当前 OA 节点审批人',
      updatedAt: formatReviewTime(request?.approval?.updatedAt ?? updatedAt),
      instruction: 'Invoice 详情保持只读，请在请款项目详情处理审批。',
      tone: 'neutral' as const,
    };
    if (managementView?.status === '付款中') return {
      title: '进入付款',
      transition: '项目审批通过 → 付款中',
      assignee: '财务付款人',
      updatedAt: formatReviewTime(updatedAt),
      instruction: '付款操作与结果统一在付款工作台处理。',
      tone: 'neutral' as const,
    };
    if (managementView?.status === '已退回') return {
      title: '退回整改',
      transition: `${latestReviewEvent?.fromStatus ?? '上一状态'} → 已退回`,
      assignee: '媒介处理人',
      updatedAt: formatReviewTime(updatedAt),
      instruction: latestReviewEvent?.reason ?? payout?.returnReason ?? '按退回原因完成修改并重新提交。',
      tone: 'danger' as const,
    };
    return {
      title: managementView?.status === '已付款' ? '付款已完成' : '待发起请款',
      transition: managementView?.status === '已付款' ? '付款中 → 已付款' : '审核通过 → 待发起请款',
      assignee: managementView?.status === '已付款' ? '财务付款人' : '媒介请款人',
      updatedAt: formatReviewTime(updatedAt),
      instruction: managementView?.status === '已付款' ? '流程已完成，可查看付款记录。' : '在合作项目中选择该 Invoice 发起请款。',
      tone: 'neutral' as const,
    };
  })();
  const workspaceBlockingReasons = [
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
          <div className="invoice-detail-header-actions">
            <Button variant="secondary" icon={<Clipboard size={16} />} onClick={copyInvoiceId}>复制编号</Button>
            <Button
              variant="secondary"
              icon={<Send size={16} />}
              disabled={isDraft ? !canPublishDraft : !canSendSignatureReminder}
              title={isDraft
                ? canPublishDraft ? '发布并通知达人签署' : '当前账号不能发布该草稿'
                : canSendSignatureReminder ? '再次通知达人签署' : '仅待签署状态可以发送提醒'}
              onClick={publishOrNotifyCreator}
            >
              {isDraft ? '发布达人签署' : '通知达人签署'}
            </Button>
            <Button
              variant="secondary"
              icon={<Pencil size={16} />}
              disabled={!canEditHeader}
              title={canEditHeader ? '编辑 Invoice' : '当前状态不可编辑'}
              onClick={() => { if (payout && editContext) onEditInvoice?.(payout, editContext); }}
            >
              编辑
            </Button>
            <Button
              variant="secondary"
              icon={<Undo2 size={16} />}
              disabled={!canWithdrawDraft}
              title={canWithdrawDraft ? '撤销并删除当前草稿' : '只有未发布草稿可以撤销'}
              onClick={() => setWithdrawDialogOpen(true)}
            >
              撤销
            </Button>
            <Button icon={<Download size={16} />} disabled={Boolean(downloading)} onClick={() => downloadInvoice('pdf')}>
              {downloading === 'pdf' ? '生成中…' : '下载PDF'}
            </Button>
          </div>
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
        overviewNotice={managementReturnContext ? {
          title: managementReturnContext.sourceLabel,
          message: managementReturnContext.reason,
          meta: [
            managementReturnContext.actorName ?? '审批人未记录',
            managementReturnContext.occurredAt
              ? formatReviewTime(managementReturnContext.occurredAt)
              : '退回时间未记录',
          ].join(' · '),
          tone: 'danger',
        } : undefined}
        summaryFields={summaryFields}
        contractChecks={workspaceContractChecks}
        contractMismatchReview={storedContractMatchReview?.reason ? {
          reason: storedContractMatchReview.reason,
          meta: [
            '生成 Invoice 时填写',
            storedContractMatchReview.actorName ?? '操作人未记录',
            storedContractMatchReview.reviewedAt
              ? formatReviewTime(storedContractMatchReview.reviewedAt)
              : '时间未记录',
          ].join(' · '),
        } : undefined}
        noContract={Boolean(generatedRecord && selectedContracts.length === 0)}
        accountRows={workspaceAccountRows}
        timeline={processTimeline}
        historySummary={invoiceHistorySummary}
        currentTask={currentTask}
        historyStatusText={displayStatus === '草稿' ? '等待发布达人签署' : `当前状态：${displayStatus}`}
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
              <>
                <Button variant="secondary" icon={<MessageSquareText size={16} />} onClick={openFeedbackDialog}>查看反馈</Button>
                {canManageInvoice && payout && editContext === 'CREATOR_FEEDBACK' ? (
                  <Button onClick={() => onEditInvoice?.(payout, editContext)}>修改并重新发送达人</Button>
                ) : null}
              </>
            ) : null}
            {managementReturnContext && canManageInvoice && payout && editContext ? (
              <Button onClick={() => onEditInvoice?.(payout, editContext)}>修改并重新发起</Button>
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

      {withdrawDialogOpen && generatedRecord ? (
        <Modal
          title="撤销 Invoice 草稿"
          width="520px"
          onClose={() => setWithdrawDialogOpen(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setWithdrawDialogOpen(false)}>取消</Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (onWithdrawDraft?.(generatedRecord)) setWithdrawDialogOpen(false);
                }}
              >
                确认撤销并删除
              </Button>
            </>
          )}
        >
          <div className="invoice-draft-withdraw-confirmation">
            <span><Undo2 size={20} /></span>
            <div>
              <strong>撤销后将删除 {model.invoiceNumber}</strong>
              <p>对应的 Invoice 草稿、原型付款记录和项目资源关联会从当前前端会话中移除。该操作仅允许尚未发布的草稿执行。</p>
            </div>
          </div>
        </Modal>
      ) : null}

    </div>
  );
}
