import { AlertTriangle, Check, FileSignature, FileText, Landmark, MessageSquareText, X } from 'lucide-react';
import { useState } from 'react';
import { Avatar, Button, Modal, StatusMark } from './Common';
import { formatAmount, getProjectFixture, SYSTEM_USERS, type SystemUser } from '../data';
import type { ContractRecord } from '../contracts';
import type { Payout } from '../types';

type ApprovalAssignment = {
  media: string;
  pm: string;
  project: string;
  owner: string;
  finance: string;
};

type ApprovalActor = Pick<SystemUser, 'account' | 'name' | 'initials' | 'role'>;

const DEFAULT_APPROVAL_ASSIGNMENT: ApprovalAssignment = {
  media: 'lailihong',
  pm: 'zhangyongshi',
  project: 'linyanming',
  owner: 'heather',
  finance: 'xiwenhui',
};

const APPROVAL_ASSIGNMENTS_BY_CONTRACT: Record<string, ApprovalAssignment> = {
  'CON-260718-01': DEFAULT_APPROVAL_ASSIGNMENT,
  'CON-260714-03': {
    media: 'zhangshiyu',
    pm: 'huoshunhua',
    project: 'linyanming',
    owner: 'theo',
    finance: 'limeng',
  },
  'CON-260711-02': {
    media: 'longzhexin',
    pm: 'chenyangyuan',
    project: 'linyanming',
    owner: 'heather',
    finance: 'wuxueni',
  },
  'CON-260625-06': {
    media: 'lailihong',
    pm: 'zhangyongshi',
    project: 'linyanming',
    owner: 'theo',
    finance: 'xiwenhui',
  },
};

const SYSTEM_USER_BY_ACCOUNT = new Map(SYSTEM_USERS.map((user) => [user.account, user]));

const getProjectApprovalAssignment = (payout: Payout): ApprovalAssignment => {
  const fallback = APPROVAL_ASSIGNMENTS_BY_CONTRACT[payout.contract] ?? DEFAULT_APPROVAL_ASSIGNMENT;
  const project = getProjectFixture(payout.projectId);
  if (!project) return fallback;
  const media = SYSTEM_USERS.find((user) => user.name === project.media && user.roleKey === 'media')?.account;
  const pm = SYSTEM_USERS.find((user) => user.name === project.pm && user.roleKey === 'pm')?.account;
  return {
    ...fallback,
    media: media ?? fallback.media,
    pm: pm ?? fallback.pm,
  };
};

const getApprovalActor = (account: string): ApprovalActor => (
  SYSTEM_USER_BY_ACCOUNT.get(account) ?? {
    account,
    name: account,
    initials: account.slice(0, 2).toUpperCase(),
    role: '系统账号',
  }
);

const timelineIndex = (status: Payout['status']) => {
  if (status === '飞书审批中') return 1;
  if (status === '待财务复核' || status === '信息异常' || status === '已退回') return 4;
  if (status === '等待付款' || status === '付款处理中') return 5;
  if (status === '已付款') return 7;
  return 0;
};

const currentStateLabel = (status: Payout['status']) => {
  if (status === '信息异常') return '需处理';
  if (status === '已退回') return '已退回';
  if (status === '飞书审批中') return '审批中';
  if (status === '待财务复核') return '待审核';
  if (status === '等待付款') return '待打款';
  if (status === '付款处理中') return '处理中';
  return '当前步骤';
};

const ACTION_LABEL: Partial<Record<Payout['status'], string>> = {
  待财务复核: '通过财务复核',
  等待付款: '执行打款',
  信息异常: '标记资料已修复',
  付款处理中: '模拟状态回写成功',
  已退回: '重新发起审核',
};

export function PayoutDrawer({
  payout,
  onClose,
  onAdvance,
  onReturn,
  canReview,
  canExecutePayout,
  contract,
  onViewContract,
  onViewInvoice,
}: {
  payout: Payout;
  onClose: () => void;
  onAdvance: (payout: Payout) => void;
  onReturn: (payout: Payout, reason: string) => void;
  canReview: boolean;
  canExecutePayout: boolean;
  contract: ContractRecord | null;
  onViewContract: (contract: ContractRecord) => void;
  onViewInvoice: (payout: Payout) => void;
}) {
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const currentIndex = timelineIndex(payout.status);
  const approvalAssignment = getProjectApprovalAssignment(payout);
  const steps: Array<{ label: string; description: string; actor: ApprovalActor }> = [
    { label: '请款提交', description: '提交Invoice、付款清单及已关联合同', actor: getApprovalActor(approvalAssignment.media) },
    { label: 'PM 审批', description: '确认项目资料与请款范围', actor: getApprovalActor(approvalAssignment.pm) },
    { label: '项目负责人审批', description: '审核项目预算与执行信息', actor: getApprovalActor(approvalAssignment.project) },
    { label: '老板审批', description: '完成最终业务审批', actor: getApprovalActor(approvalAssignment.owner) },
    { label: '财务复核', description: '核对主体、金额与收款账户', actor: getApprovalActor(approvalAssignment.finance) },
    {
      label: '渠道打款',
      description: '按付款清单执行付款',
      actor: {
        account: payout.provider.toLowerCase(),
        name: payout.provider,
        initials: payout.provider === 'Airwallex' ? 'AW' : payout.provider === 'PayPal' ? 'PP' : 'PX',
        role: '付款渠道',
      },
    },
    {
      label: '状态回写',
      description: '同步渠道结果与交易状态',
      actor: { account: 'system', name: 'COMETS Pay', initials: 'CP', role: '系统自动任务' },
    },
  ];
  const actionLabel = ACTION_LABEL[payout.status];
  const normalizedReturnReason = returnReason.trim();
  const canAdvance = ['等待付款', '付款处理中'].includes(payout.status)
    ? canExecutePayout
    : canReview;

  const openReturnDialog = () => {
    setReturnReason('');
    setReturnDialogOpen(true);
  };

  const submitReturn = () => {
    if (!normalizedReturnReason) return;
    onReturn(payout, normalizedReturnReason);
    setReturnDialogOpen(false);
    setReturnReason('');
  };

  return (
    <>
      <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
        <aside className="drawer" role="dialog" aria-modal="true" aria-label="付款详情" onMouseDown={(event) => event.stopPropagation()}>
        <header className="drawer-header">
          <div>
            <span className="drawer-kicker">付款详情</span>
            <h2>{payout.invoice}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}><X size={21} /></button>
        </header>

        <div className="drawer-content">
          <div className="drawer-creator">
            <Avatar initials={payout.initials} accent={payout.accent} size="lg" />
            <div><strong>{payout.creator}</strong><span>{payout.project}</span></div>
            <StatusMark status={payout.status} />
          </div>

          {payout.issue ? (
            <div className="drawer-alert"><AlertTriangle size={18} /><span><strong>需要处理</strong>{payout.issue}</span></div>
          ) : null}

          <section className="drawer-section">
            <h3>付款信息</h3>
            <dl className="detail-grid">
              <div><dt>付款金额</dt><dd>{formatAmount(payout)}</dd></div>
              <div><dt>打款渠道</dt><dd>{payout.provider}</dd></div>
              <div><dt>收款账户</dt><dd className="detail-account-full">{payout.account}</dd></div>
              <div><dt>付款方式</dt><dd>批量打款</dd></div>
            </dl>
          </section>

          <section className="drawer-section">
            <h3>当前审批链路</h3>
            <div className="approval-timeline">
              {steps.map((step, index) => {
                const complete = index < currentIndex || payout.status === '已付款';
                const current = index === currentIndex && payout.status !== '已付款';
                const state = complete ? 'complete' : current ? 'current' : 'pending';
                return (
                  <div className={`timeline-step timeline-${state}`} key={`${step.label}-${step.actor.account}`}>
                    <span className="timeline-node">{complete ? <Check size={13} /> : index + 1}</span>
                    <div className="timeline-stage">
                      <strong>{step.label}</strong>
                      <small>{step.description}</small>
                    </div>
                    <div className="timeline-actor">
                      <span className="timeline-actor-avatar">{step.actor.initials}</span>
                      <span><strong>{step.actor.name}</strong><small>@{step.actor.account} · {step.actor.role}</small></span>
                    </div>
                    <span className={`timeline-state timeline-state-${state}`}>
                      {complete ? '已完成' : current ? currentStateLabel(payout.status) : '待处理'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="drawer-section">
            <h3>关联资料</h3>
            <div className="attachment-list">
              <button type="button" disabled={!contract} onClick={() => contract && onViewContract(contract)}><FileSignature size={18} /><span>合同 · {payout.contract}</span><small>{contract ? '查看合同' : '已关联'}</small></button>
              <button type="button" onClick={() => onViewInvoice(payout)}><FileText size={18} /><span>Invoice · {payout.invoice}</span><small>查看全文</small></button>
              <button type="button"><Landmark size={18} /><span>收款账户校验结果</span><small>{payout.issue ? '需更新' : '已通过'}</small></button>
            </div>
          </section>
        </div>

          <footer className="drawer-footer">
            {payout.status === '待财务复核' && canReview ? <Button variant="secondary" onClick={openReturnDialog}>退回审核</Button> : null}
            {actionLabel && canAdvance ? <Button onClick={() => onAdvance(payout)}>{actionLabel}</Button> : null}
            {payout.status === '飞书审批中' ? <Button disabled>等待飞书审批</Button> : null}
            {payout.status === '已付款' ? <Button variant="secondary" onClick={onClose}>关闭</Button> : null}
          </footer>
        </aside>
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
              <span><MessageSquareText size={19} /></span>
              <div>
                <strong>请填写退回原因</strong>
                <p>{payout.creator} · {payout.invoice} · {formatAmount(payout)}</p>
              </div>
            </div>

            <label className="return-review-field">
              <span>退回原因 <em className="required-mark" aria-hidden="true">*</em><small>{returnReason.length}/300</small></span>
              <textarea
                autoFocus
                maxLength={300}
                aria-label="退回原因"
                placeholder="请说明需要修改的内容，例如：请核对收款主体与合同主体"
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
              />
              <small>该原因将同步给项目负责人，并记录在付款详情中。</small>
            </label>

            <div className="return-review-warning"><AlertTriangle size={17} /><span>确认后，该笔付款将进入“已退回”，需修改后重新发起审核。</span></div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
