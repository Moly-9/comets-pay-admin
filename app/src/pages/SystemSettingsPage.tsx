import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  Crown,
  FileCheck2,
  GripVertical,
  KeyRound,
  ListChecks,
  LockKeyhole,
  Megaphone,
  MonitorSmartphone,
  PencilLine,
  Plus,
  Power,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserCog,
  WalletCards,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Avatar, Button, ListActionButton, Modal, NoticeBanner, PageHeading, SelectField } from '../components/Common';
import { Pagination, usePagination } from '../components/Pagination';
import {
  CURRENT_USER,
  DEMO_SYSTEM_USERS,
  LOCAL_ADMIN_ACCOUNT,
  ROLE_LOGIN_SESSION_POLICY,
  type LoginSessionPolicy,
  type SystemRoleKey,
} from '../data';
import {
  ALL_PERMISSION_IDS,
  PERMISSION_GROUPS,
  PERMISSION_OPTIONS,
  ROLE_PERMISSION_IDS,
  type PermissionId,
} from '../permissions';

type Notify = (title: string, message: string) => void;
type RoleKey = SystemRoleKey;
type SettingsView = 'accounts' | 'permissions' | 'approvals';

type RoleDefinition = {
  key: RoleKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  permissions: string[];
  summary: string;
  unrestricted?: boolean;
};

type SystemAccount = {
  id: string;
  name: string;
  email: string;
  initials: string;
  accent: string;
  role: RoleKey;
  permissions: PermissionId[];
  status: '已启用' | '已停用';
  lastLogin: string;
};

type ApprovalFlow = {
  id: string;
  name: string;
  scope: 'all';
  enabled: boolean;
  nodes: ApprovalNode[];
  updatedAt: string;
};

type ApprovalNode = {
  id: string;
  name: string;
  role: RoleKey;
};

type ApprovalEditorMode = 'create' | 'edit';

const ROLE_DEFINITIONS: Record<RoleKey, RoleDefinition> = {
  media: {
    key: 'media',
    label: '媒介账号',
    shortLabel: '媒介',
    description: '负责达人资源、合作资料与项目执行的日常管理。',
    icon: Megaphone,
    summary: '业务资料维护、项目发起',
    permissions: [
      '新增、编辑达人档案并导入合作名单',
      '上传和管理合同，生成并维护 Invoice',
      '新建项目并维护达人、PM 与预算资料',
      '查看本人负责项目的执行进度',
    ],
  },
  pm: {
    key: 'pm',
    label: 'PM 账号',
    shortLabel: 'PM',
    description: '负责关联项目的业务审批，仅查看与本人关联的项目列表与详情。',
    icon: ClipboardCheck,
    summary: '关联项目、请款资料、PM 审批',
    permissions: [
      '查看与本人关联的项目列表和项目详情',
      '查看关联请款项目的合同、Invoice 与付款清单',
      '作为请款流程第一审批节点完成 PM 审批',
      '通过或退回请款项目并记录审批意见',
    ],
  },
  finance: {
    key: 'finance',
    label: '财务账号',
    shortLabel: '财务',
    description: '负责请款审核、付款执行与付款状态追踪。',
    icon: WalletCards,
    summary: '请款审核、Airwallex 打款、支付管理',
    permissions: [
      '查看请款项目中的合同、Invoice 和请款单信息',
      '审核请款项目',
      '审核通过后，根据请款项目数据执行自动打款',
      '查看支付管理、付款批次与交易记录',
    ],
  },
  admin: {
    key: 'admin',
    label: '管理员账号',
    shortLabel: '管理员',
    description: '负责系统配置、账号权限与业务流程管理。',
    icon: ShieldCheck,
    summary: '全系统权限',
    unrestricted: true,
    permissions: ['可查看、新增、编辑、审核、配置并操作系统全部功能'],
  },
  owner: {
    key: 'owner',
    label: '老板账号',
    shortLabel: '老板',
    description: '负责全局经营管理，拥有系统全部查看、操作与配置权限。',
    icon: Crown,
    summary: '全系统权限',
    unrestricted: true,
    permissions: ['可查看、新增、编辑、审核、付款、配置并操作系统全部功能'],
  },
  project: {
    key: 'project',
    label: '项目负责人账号',
    shortLabel: '项目负责人',
    description: '负责项目协作、达人合作资料与请款进度跟进。',
    icon: BriefcaseBusiness,
    summary: '项目维护、业务资料、项目负责人审批',
    permissions: [
      '查看达人、合同、Invoice 与请款资料',
      '新建并维护项目、达人关联、PM 与预算信息',
      '作为项目负责人审批节点完成业务审核',
      '通过或退回请款项目并记录审批意见',
    ],
  },
};

const ROLE_ORDER: RoleKey[] = ['media', 'pm', 'project', 'owner', 'finance', 'admin'];

const ROLE_SELECT_OPTIONS = ROLE_ORDER.map((roleKey) => ({
  value: roleKey,
  label: ROLE_DEFINITIONS[roleKey].label,
  description: ROLE_DEFINITIONS[roleKey].summary,
}));

const ROLE_FILTER_OPTIONS: Array<{ value: 'all' | RoleKey; label: string; description: string }> = [
  { value: 'all', label: '全部账号类型', description: '显示所有系统账号' },
  ...ROLE_SELECT_OPTIONS,
];

const LOGIN_SESSION_POLICY_COPY: Record<LoginSessionPolicy, { label: string; description: string }> = {
  multi_device: {
    label: '多设备同时登录',
    description: '允许同一账号在多台设备保持登录，不会互相退出。',
  },
  single_device: {
    label: '单设备登录',
    description: '同一账号仅保留一个有效设备会话。',
  },
};

export const INITIAL_SYSTEM_ACCOUNTS: SystemAccount[] = [
  { id: 'USR-001', name: '赖丽红', email: 'lailihong@cometspay.co', initials: 'LH', accent: '#f97316', role: 'media', permissions: [...ROLE_PERMISSION_IDS.media], status: '已启用', lastLogin: '今天 09:36' },
  { id: 'USR-002', name: '张诗雨', email: 'zhangshiyu@cometspay.co', initials: 'SY', accent: '#ef6d57', role: 'media', permissions: [...ROLE_PERMISSION_IDS.media], status: '已启用', lastLogin: '今天 08:48' },
  { id: 'USR-003', name: '龙哲心', email: 'longzhexin@cometspay.co', initials: 'ZX', accent: '#f59e0b', role: 'media', permissions: [...ROLE_PERMISSION_IDS.media], status: '已启用', lastLogin: '昨天 17:24' },
  { id: 'USR-010', name: '张咏诗', email: 'zhangyongshi@cometspay.co', initials: 'ZY', accent: '#0f9f8f', role: 'pm', permissions: [...ROLE_PERMISSION_IDS.pm], status: '已启用', lastLogin: '今天 10:06' },
  { id: 'USR-011', name: '霍舜华', email: 'huoshunhua@cometspay.co', initials: 'HS', accent: '#168aad', role: 'pm', permissions: [...ROLE_PERMISSION_IDS.pm], status: '已启用', lastLogin: '今天 09:18' },
  { id: 'USR-012', name: '陈旸媛', email: 'chenyangyuan@cometspay.co', initials: 'CY', accent: '#0e7490', role: 'pm', permissions: [...ROLE_PERMISSION_IDS.pm], status: '已启用', lastLogin: '昨天 18:36' },
  { id: 'USR-004', name: CURRENT_USER.name, email: CURRENT_USER.email, initials: CURRENT_USER.initials, accent: '#7c5ce7', role: 'finance', permissions: [...ROLE_PERMISSION_IDS.finance], status: '已启用', lastLogin: '刚刚' },
  { id: 'USR-005', name: '李梦', email: 'limeng@cometspay.co', initials: 'LM', accent: '#8b5cf6', role: 'finance', permissions: [...ROLE_PERMISSION_IDS.finance], status: '已启用', lastLogin: '今天 09:12' },
  { id: 'USR-006', name: '吴雪霓', email: 'wuxueni@cometspay.co', initials: 'WX', accent: '#6366f1', role: 'finance', permissions: [...ROLE_PERMISSION_IDS.finance], status: '已启用', lastLogin: '昨天 18:42' },
  { id: 'USR-007', name: '林嫣明', email: 'linyanming@cometspay.co', initials: 'LY', accent: '#2f7ee6', role: 'project', permissions: [...ROLE_PERMISSION_IDS.project], status: '已启用', lastLogin: '今天 08:54' },
  { id: 'USR-013', name: 'jeff', email: 'jeff@cometspay.co', initials: 'J', accent: '#27805a', role: 'admin', permissions: [...ROLE_PERMISSION_IDS.admin], status: '已启用', lastLogin: '尚未登录' },
  { id: 'USR-014', name: 'Liu Yao', email: LOCAL_ADMIN_ACCOUNT, initials: 'LY', accent: '#7c5ce7', role: 'admin', permissions: [...ROLE_PERMISSION_IDS.admin], status: '已启用', lastLogin: '尚未登录' },
  { id: 'USR-008', name: 'heather', email: 'heather@cometspay.co', initials: 'H', accent: '#d49a16', role: 'owner', permissions: [...ROLE_PERMISSION_IDS.owner], status: '已启用', lastLogin: '2026-07-24 16:20' },
  { id: 'USR-009', name: 'theo', email: 'theo@cometspay.co', initials: 'T', accent: '#b7791f', role: 'owner', permissions: [...ROLE_PERMISSION_IDS.owner], status: '已启用', lastLogin: '2026-07-23 11:08' },
  ...DEMO_SYSTEM_USERS.map((user, index) => ({
    id: `DEMO-${String(index + 1).padStart(3, '0')}`,
    name: user.name,
    email: user.email,
    initials: user.initials,
    accent: ['#f97316', '#0f9f8f', '#2f7ee6', '#d49a16', '#7c5ce7', '#27805a'][index],
    role: user.roleKey,
    permissions: [...ROLE_PERMISSION_IDS[user.roleKey]],
    status: '已启用' as const,
    lastLogin: '体验账号',
  })),
];

const APPROVAL_SCOPE_OPTIONS = [
  { value: 'all' as const, label: '全部请款项目', description: '覆盖系统内所有提交审核的请款项目' },
];

const INITIAL_APPROVAL_FLOWS: ApprovalFlow[] = [
  {
    id: 'FLOW-REQUEST-001',
    name: '请款项目标准审批',
    scope: 'all',
    enabled: true,
    updatedAt: '今天 10:32',
    nodes: [
      { id: 'NODE-PM', name: 'PM 审批', role: 'pm' },
      { id: 'NODE-PROJECT', name: '项目负责人审核', role: 'project' },
      { id: 'NODE-OWNER', name: '老板审批', role: 'owner' },
      { id: 'NODE-FINANCE', name: '财务审批', role: 'finance' },
    ],
  },
];

const createDefaultApprovalFlow = (sequence: number): ApprovalFlow => ({
  id: `FLOW-REQUEST-${String(sequence).padStart(3, '0')}`,
  name: '新的请款审批流程',
  scope: 'all',
  enabled: false,
  updatedAt: '尚未保存',
  nodes: [
    { id: `NODE-${sequence}-PM`, name: 'PM 审批', role: 'pm' },
    { id: `NODE-${sequence}-PROJECT`, name: '项目负责人审核', role: 'project' },
    { id: `NODE-${sequence}-OWNER`, name: '老板审批', role: 'owner' },
    { id: `NODE-${sequence}-FINANCE`, name: '财务审批', role: 'finance' },
  ],
});

function AccountProfile({ account }: { account: SystemAccount }) {
  return (
    <div className="permission-modal-profile">
      <Avatar initials={account.initials} accent={account.accent} size="lg" />
      <div><h3>{account.name}</h3><p>{account.email}</p></div>
      <div className="account-profile-badges">
        <RoleBadge roleKey={account.role} />
        <LoginPolicyBadge roleKey={account.role} />
        <span className={`account-state-badge ${account.status === '已停用' ? 'is-disabled' : ''}`}><i />{account.status}</span>
      </div>
    </div>
  );
}

function RoleBadge({ roleKey }: { roleKey: RoleKey }) {
  const role = ROLE_DEFINITIONS[roleKey];
  const RoleIcon = role.icon;
  return <span className={`role-badge role-${roleKey}`}><RoleIcon size={14} />{role.label}</span>;
}

function LoginPolicyBadge({ roleKey }: { roleKey: RoleKey }) {
  const policy = ROLE_LOGIN_SESSION_POLICY[roleKey];
  const copy = LOGIN_SESSION_POLICY_COPY[policy];
  return (
    <span className={`login-policy-badge is-${policy}`} title={copy.description}>
      <MonitorSmartphone size={13} />
      {copy.label}
    </span>
  );
}

function AirwallexAuthenticationNote() {
  return (
    <div className="airwallex-auth-note">
      <KeyRound size={17} />
      <span><strong>Airwallex 认证要求</strong><small>V1 仅通过 Airwallex 执行自动打款；财务人员发起打款前必须完成 Airwallex 登录认证。</small></span>
    </div>
  );
}

function ApprovalFlowCard({
  flow,
  onEdit,
  onToggle,
}: {
  flow: ApprovalFlow;
  onEdit: (flow: ApprovalFlow) => void;
  onToggle: (flow: ApprovalFlow) => void;
}) {
  return (
    <article className={`approval-flow-card ${flow.enabled ? '' : 'is-disabled'}`} aria-labelledby={`${flow.id}-title`}>
      <header className="approval-flow-head">
        <span className="approval-flow-icon"><Workflow size={22} /></span>
        <div className="approval-flow-heading-copy">
          <div className="approval-flow-title-row">
            <h2 id={`${flow.id}-title`}>{flow.name}</h2>
            <button
              className={`account-status-toggle approval-flow-status ${flow.enabled ? '' : 'is-disabled'}`}
              type="button"
              aria-label={`${flow.enabled ? '停用' : '启用'}${flow.name}`}
              aria-pressed={flow.enabled}
              onClick={() => onToggle(flow)}
            >
              <span className="account-status-switch"><i /></span>
              <span>{flow.enabled ? '已启用' : '已停用'}</span>
            </button>
          </div>
          <div className="approval-flow-meta">
            <span>适用范围：全部请款项目</span>
            <i aria-hidden="true" />
            <span>{flow.nodes.length} 个审批节点</span>
            <i aria-hidden="true" />
            <span>更新于{flow.updatedAt}</span>
          </div>
        </div>
        <Button variant="secondary" icon={<PencilLine size={16} />} onClick={() => onEdit(flow)}>编辑流程</Button>
      </header>

      <div className="approval-flow-scroll" aria-label={`${flow.name}的审批节点`}>
        <div className="approval-flow-rail">
          <div className="approval-stage approval-stage-start">
            <span className="approval-stage-icon"><Send size={20} /></span>
            <strong>提交审批</strong>
            <small>Invoice、付款清单完整 · 合同选填</small>
          </div>

          {flow.nodes.map((node, index) => {
            const role = ROLE_DEFINITIONS[node.role];
            const RoleIcon = role.icon;
            return (
              <div className="approval-flow-segment" key={node.id}>
                <span className="approval-flow-arrow" aria-hidden="true"><ArrowRight size={20} /></span>
                <div className={`approval-stage approval-stage-role approval-stage-${node.role}`}>
                  <span className="approval-stage-number">{index + 1}</span>
                  <span className="approval-stage-icon"><RoleIcon size={20} /></span>
                  <strong>{node.name}</strong>
                  <small>{role.label}</small>
                </div>
              </div>
            );
          })}

          <div className="approval-flow-segment">
            <span className="approval-flow-arrow" aria-hidden="true"><ArrowRight size={20} /></span>
            <div className="approval-stage approval-stage-terminal">
              <span className="approval-stage-icon"><ShieldCheck size={21} /></span>
              <strong>允许执行打款</strong>
              <small>审批全部通过后解锁</small>
            </div>
          </div>
        </div>
      </div>

      <div className="approval-rules-band" aria-label="请款审批规则">
        <span><ListChecks size={17} /><strong>顺序审批</strong><small>按节点次序逐级流转</small></span>
        <span><RotateCcw size={17} /><strong>退回发起人</strong><small>修改后重新提交</small></span>
        <span><LockKeyhole size={17} /><strong>打款前置锁</strong><small>全部通过前禁止打款</small></span>
        <span><FileCheck2 size={17} /><strong>审批资料</strong><small>Invoice、付款清单 · 合同选填</small></span>
      </div>

      <footer className="approval-flow-footer">
        <ShieldCheck size={16} />
        <span>仅管理员账号和老板账号可以配置请款审批流程。</span>
      </footer>
    </article>
  );
}

function ApprovalFlowEditor({
  flow,
  onNameChange,
  onEnabledChange,
  onNodeChange,
  onMoveNode,
  onRemoveNode,
  onAddNode,
}: {
  flow: ApprovalFlow;
  onNameChange: (name: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onNodeChange: (nodeId: string, update: Partial<Pick<ApprovalNode, 'name' | 'role'>>) => void;
  onMoveNode: (nodeId: string, direction: -1 | 1) => void;
  onRemoveNode: (nodeId: string) => void;
  onAddNode: () => void;
}) {
  return (
    <div className="approval-editor">
      <section className="approval-editor-section">
        <header className="approval-editor-heading">
          <span><Workflow size={18} /></span>
          <div><h3>基本设置</h3><p>用于识别这条流程，并控制它是否对新提交的请款项目生效。</p></div>
        </header>
        <div className="approval-basics-grid">
          <label className="approval-editor-field">
            <span>流程名称 <em className="required-mark" aria-hidden="true">*</em></span>
            <input value={flow.name} onChange={(event) => onNameChange(event.target.value)} placeholder="输入审批流程名称" />
          </label>
          <div className="approval-editor-field">
            <span>适用范围</span>
            <SelectField ariaLabel="审批流程适用范围" variant="form" value={flow.scope} options={APPROVAL_SCOPE_OPTIONS} onChange={() => undefined} disabled />
          </div>
          <div className="approval-enabled-setting">
            <div><strong>启用此流程</strong><small>启用后，新建请款项目将按此流程审批。</small></div>
            <button
              className={`account-status-toggle ${flow.enabled ? '' : 'is-disabled'}`}
              type="button"
              aria-label={`${flow.enabled ? '停用' : '启用'}此审批流程`}
              aria-pressed={flow.enabled}
              onClick={() => onEnabledChange(!flow.enabled)}
            >
              <span className="account-status-switch"><i /></span>
              <span>{flow.enabled ? '已启用' : '已停用'}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="approval-editor-section">
        <header className="approval-editor-heading">
          <span><ListChecks size={18} /></span>
          <div><h3>审批节点</h3><p>系统将从上到下顺序发起审批；每个节点由指定角色的账号处理。</p></div>
        </header>
        <div className="approval-node-list">
          {flow.nodes.map((node, index) => (
            <div className="approval-node-row" key={node.id}>
              <span className="approval-node-grip" aria-hidden="true"><GripVertical size={17} /></span>
              <span className="approval-node-index">{index + 1}</span>
              <label className="approval-editor-field approval-node-name">
                <span>节点名称</span>
                <input aria-label={`第 ${index + 1} 个审批节点名称`} value={node.name} onChange={(event) => onNodeChange(node.id, { name: event.target.value })} />
              </label>
              <div className="approval-editor-field approval-node-role">
                <span>审批角色</span>
                <SelectField ariaLabel={`第 ${index + 1} 个节点的审批角色`} variant="form" value={node.role} options={ROLE_SELECT_OPTIONS} onChange={(role) => onNodeChange(node.id, { role })} />
              </div>
              <div className="approval-node-actions">
                <button type="button" aria-label={`上移${node.name}`} disabled={index === 0} onClick={() => onMoveNode(node.id, -1)}><ArrowUp size={16} /></button>
                <button type="button" aria-label={`下移${node.name}`} disabled={index === flow.nodes.length - 1} onClick={() => onMoveNode(node.id, 1)}><ArrowDown size={16} /></button>
                <button className="is-danger" type="button" aria-label={`删除${node.name}`} disabled={flow.nodes.length === 1} onClick={() => onRemoveNode(node.id)}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
        <button className="approval-add-node" type="button" onClick={onAddNode}><Plus size={16} />添加审批节点</button>
      </section>

      <section className="approval-editor-section approval-rule-editor">
        <header className="approval-editor-heading">
          <span><LockKeyhole size={18} /></span>
          <div><h3>流程规则</h3><p>下列规则是请款与打款之间的安全约束，对所有请款审批流程固定生效。</p></div>
        </header>
        <div className="approval-rule-editor-grid">
          <span><CheckCircle2 size={17} /><div><strong>必须顺序审批</strong><small>只有前一节点通过，才会进入下一节点。</small></div></span>
          <span><CheckCircle2 size={17} /><div><strong>退回后由发起人修改</strong><small>修改合同、Invoice 或付款清单后重新提交。</small></div></span>
          <span><CheckCircle2 size={17} /><div><strong>全部通过才解锁打款</strong><small>任一节点未通过时，系统保持打款锁定。</small></div></span>
        </div>
        <div className="approval-rule-lock-note"><ShieldCheck size={17} />审批顺序、退回逻辑与打款前置锁不可在流程中关闭。</div>
      </section>
    </div>
  );
}

export function SystemSettingsPage({ notify }: { notify: Notify }) {
  const [view, setView] = useState<SettingsView>('accounts');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | RoleKey>('all');
  const [accounts, setAccounts] = useState(INITIAL_SYSTEM_ACCOUNTS);
  const [selectedAccount, setSelectedAccount] = useState<SystemAccount | null>(null);
  const [editingAccount, setEditingAccount] = useState<SystemAccount | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<PermissionId[]>([]);
  const [passwordAccount, setPasswordAccount] = useState<SystemAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<RoleKey>('media');
  const [approvalFlows, setApprovalFlows] = useState(INITIAL_APPROVAL_FLOWS);
  const [approvalDraft, setApprovalDraft] = useState<ApprovalFlow | null>(null);
  const [approvalEditorMode, setApprovalEditorMode] = useState<ApprovalEditorMode>('edit');

  const normalizedSearch = search.trim().toLowerCase();
  const visibleAccounts = accounts.filter((account) => {
    const matchesRole = roleFilter === 'all' || account.role === roleFilter;
    const matchesSearch = !normalizedSearch || `${account.name}${account.email}${ROLE_DEFINITIONS[account.role].label}`.toLowerCase().includes(normalizedSearch);
    return matchesRole && matchesSearch;
  });
  const {
    page: accountPage,
    pageItems: paginatedAccounts,
    pageSize: accountPageSize,
    setPage: setAccountPage,
    setPageSize: setAccountPageSize,
  } = usePagination(visibleAccounts, { resetKey: `${search}\u0000${roleFilter}` });
  const {
    page: approvalPage,
    pageItems: paginatedApprovalFlows,
    pageSize: approvalPageSize,
    setPage: setApprovalPage,
    setPageSize: setApprovalPageSize,
  } = usePagination(approvalFlows, {
    resetKey: approvalFlows.map((flow) => flow.id).join('|'),
  });

  const openCreateModal = () => {
    setNewName('');
    setNewEmail('');
    setNewRole('media');
    setCreateOpen(true);
  };

  const setAccountStatus = (account: SystemAccount, status: SystemAccount['status']) => {
    const updatedAccount = { ...account, status };
    setAccounts((current) => current.map((item) => item.id === account.id ? updatedAccount : item));
    setSelectedAccount((current) => current?.id === account.id ? updatedAccount : current);
    notify(status === '已启用' ? '账号已启用' : '账号已停用', `${account.name}的系统账号已${status === '已启用' ? '恢复登录' : '停止登录'}。`);
  };

  const toggleAccountStatus = (account: SystemAccount) => {
    setAccountStatus(account, account.status === '已启用' ? '已停用' : '已启用');
  };

  const openPermissionEditor = (account: SystemAccount) => {
    setDraftPermissions([...account.permissions]);
    setEditingAccount(account);
    setSelectedAccount(null);
  };

  const togglePermission = (permissionId: PermissionId) => {
    setDraftPermissions((current) => current.includes(permissionId)
      ? current.filter((item) => item !== permissionId)
      : [...current, permissionId]);
  };

  const savePermissions = () => {
    if (!editingAccount) return;
    const updatedAccount = { ...editingAccount, permissions: [...draftPermissions] };
    setAccounts((current) => current.map((item) => item.id === editingAccount.id ? updatedAccount : item));
    setEditingAccount(null);
    notify('操作权限已更新', `${editingAccount.name}已配置 ${draftPermissions.length} 项系统操作权限。`);
  };

  const openPasswordEditor = (account: SystemAccount) => {
    setPasswordAccount(account);
    setNewPassword('');
    setConfirmPassword('');
    setSelectedAccount(null);
  };

  const passwordIsValid = newPassword.length >= 8;
  const passwordsMatch = Boolean(confirmPassword) && newPassword === confirmPassword;

  const savePassword = () => {
    if (!passwordAccount || !passwordIsValid || !passwordsMatch) return;
    setPasswordAccount(null);
    setNewPassword('');
    setConfirmPassword('');
    notify('登录密码已更新', `${passwordAccount.name}的密码已修改，下次登录时生效。`);
  };

  const createAccount = () => {
    const name = newName.trim();
    const email = newEmail.trim();
    if (!name || !email) return;
    const nextId = `USR-${String(accounts.length + 1).padStart(3, '0')}`;
    setAccounts((current) => [...current, {
      id: nextId,
      name,
      email,
      initials: name.slice(0, 2).toUpperCase(),
      accent: '#ef6d57',
      role: newRole,
      permissions: [...ROLE_PERMISSION_IDS[newRole]],
      status: '已启用',
      lastLogin: '尚未登录',
    }]);
    setCreateOpen(false);
    notify('系统账号已创建', `${name} 已分配为“${ROLE_DEFINITIONS[newRole].label}”。`);
  };

  const openCreateApprovalFlow = () => {
    setApprovalEditorMode('create');
    setApprovalDraft(createDefaultApprovalFlow(approvalFlows.length + 1));
  };

  const openEditApprovalFlow = (flow: ApprovalFlow) => {
    setApprovalEditorMode('edit');
    setApprovalDraft({ ...flow, nodes: flow.nodes.map((node) => ({ ...node })) });
  };

  const toggleApprovalFlow = (flow: ApprovalFlow) => {
    const nextEnabled = !flow.enabled;
    setApprovalFlows((current) => current.map((item) => ({
      ...item,
      enabled: item.id === flow.id ? nextEnabled : nextEnabled ? false : item.enabled,
      updatedAt: item.id === flow.id ? '刚刚' : item.updatedAt,
    })));
    notify(nextEnabled ? '审批流程已启用' : '审批流程已停用', nextEnabled
      ? `新提交的请款项目将执行“${flow.name}”。`
      : `“${flow.name}”已停止接收新的请款项目。`);
  };

  const updateApprovalNode = (nodeId: string, update: Partial<Pick<ApprovalNode, 'name' | 'role'>>) => {
    setApprovalDraft((current) => current ? {
      ...current,
      nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, ...update } : node),
    } : current);
  };

  const moveApprovalNode = (nodeId: string, direction: -1 | 1) => {
    setApprovalDraft((current) => {
      if (!current) return current;
      const sourceIndex = current.nodes.findIndex((node) => node.id === nodeId);
      const targetIndex = sourceIndex + direction;
      if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= current.nodes.length) return current;
      const nextNodes = [...current.nodes];
      const [movedNode] = nextNodes.splice(sourceIndex, 1);
      nextNodes.splice(targetIndex, 0, movedNode);
      return { ...current, nodes: nextNodes };
    });
  };

  const removeApprovalNode = (nodeId: string) => {
    setApprovalDraft((current) => current && current.nodes.length > 1
      ? { ...current, nodes: current.nodes.filter((node) => node.id !== nodeId) }
      : current);
  };

  const addApprovalNode = () => {
    setApprovalDraft((current) => current ? {
      ...current,
      nodes: [...current.nodes, {
        id: `NODE-${current.id}-${current.nodes.length + 1}-${String(Date.now()).slice(-5)}`,
        name: '新审批节点',
        role: 'finance',
      }],
    } : current);
  };

  const saveApprovalFlow = () => {
    if (!approvalDraft || !approvalDraft.name.trim() || approvalDraft.nodes.some((node) => !node.name.trim())) return;
    const savedFlow = {
      ...approvalDraft,
      name: approvalDraft.name.trim(),
      nodes: approvalDraft.nodes.map((node) => ({ ...node, name: node.name.trim() })),
      updatedAt: '刚刚',
    };
    setApprovalFlows((current) => {
      const nextFlows = approvalEditorMode === 'create'
        ? [...current, savedFlow]
        : current.map((flow) => flow.id === savedFlow.id ? savedFlow : flow);
      return savedFlow.enabled
        ? nextFlows.map((flow) => ({ ...flow, enabled: flow.id === savedFlow.id }))
        : nextFlows;
    });
    setApprovalDraft(null);
    notify(approvalEditorMode === 'create' ? '审批流程已创建' : '审批流程已更新', `“${savedFlow.name}”共配置 ${savedFlow.nodes.length} 个审批节点。`);
  };

  const approvalDraftIsValid = Boolean(
    approvalDraft?.name.trim()
    && approvalDraft.nodes.length
    && approvalDraft.nodes.every((node) => node.name.trim()),
  );

  return (
    <div className="page-stack">
      <PageHeading
        title="系统设置"
        subtitle="管理系统账号、角色权限与请款审批流程。"
        actions={view === 'approvals'
          ? <Button icon={<Plus size={17} />} onClick={openCreateApprovalFlow}>新建审批流程</Button>
          : <Button icon={<Plus size={17} />} onClick={openCreateModal}>新增账号</Button>}
      />

      <NoticeBanner>
        {view === 'approvals' ? (
          <><strong>审批通过后解锁打款：</strong> 请款项目需依次完成所有审批节点，任何节点退回都将回到发起人修改。</>
        ) : (
          <><strong>财务自动打款：</strong> 系统第一版本仅接入 Airwallex，财务人员执行打款前必须完成 Airwallex 登录认证。</>
        )}
      </NoticeBanner>

      <section className="content-card system-settings-card">
        <div className="tabs-row" role="tablist" aria-label="系统设置内容">
          <button className={`tab-button ${view === 'accounts' ? 'tab-active' : ''}`} type="button" role="tab" aria-selected={view === 'accounts'} onClick={() => setView('accounts')}>系统账号 <span>{accounts.length}</span></button>
          <button className={`tab-button ${view === 'permissions' ? 'tab-active' : ''}`} type="button" role="tab" aria-selected={view === 'permissions'} onClick={() => setView('permissions')}>角色权限 <span>{ROLE_ORDER.length}</span></button>
          <button className={`tab-button ${view === 'approvals' ? 'tab-active' : ''}`} type="button" role="tab" aria-selected={view === 'approvals'} onClick={() => setView('approvals')}>审批管理 <span>{approvalFlows.length}</span></button>
        </div>

        {view === 'accounts' ? (
          <>
            <div className="content-toolbar system-accounts-toolbar">
              <label className="search-control page-search">
                <Search size={16} />
                <input aria-label="搜索系统账号" placeholder="搜索姓名、邮箱或角色" value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <SelectField
                ariaLabel="按账号类型筛选"
                className="system-role-filter"
                value={roleFilter}
                options={ROLE_FILTER_OPTIONS}
                onChange={setRoleFilter}
              />
            </div>

            <div className="table-scroll">
              <table className="data-table operational-table system-account-table">
                <thead><tr><th>账号</th><th>账号类型</th><th>权限范围</th><th>登录设备</th><th>状态</th><th>最近登录</th><th className="action-cell">操作</th></tr></thead>
                <tbody>
                  {paginatedAccounts.map((account) => {
                    const role = ROLE_DEFINITIONS[account.role];
                    return (
                      <tr key={account.id}>
                        <td><div className="system-account-cell"><Avatar initials={account.initials} accent={account.accent} size="sm" /><span><strong>{account.name}</strong><small>{account.email}</small></span></div></td>
                        <td><RoleBadge roleKey={account.role} /></td>
                        <td><span className="permission-summary">{role.summary}</span><small className="permission-count">{account.permissions.length} 项操作权限</small>{account.role === 'finance' ? <small className="permission-caution"><KeyRound size={12} />打款前需登录认证</small> : null}</td>
                        <td><LoginPolicyBadge roleKey={account.role} /></td>
                        <td>
                          <button
                            className={`account-status-toggle ${account.status === '已停用' ? 'is-disabled' : ''}`}
                            type="button"
                            aria-label={`${account.status === '已启用' ? '停用' : '启用'}${account.name}`}
                            aria-pressed={account.status === '已启用'}
                            onClick={() => toggleAccountStatus(account)}
                          >
                            <span className="account-status-switch"><i /></span>
                            <span>{account.status}</span>
                          </button>
                        </td>
                        <td>{account.lastLogin}</td>
                        <td className="action-cell"><ListActionButton kind="manage" onClick={() => setSelectedAccount(account)}>管理账号</ListActionButton></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleAccounts.length === 0 ? <div className="empty-table">暂无符合条件的系统账号</div> : null}
            </div>
            <div className="table-footer">
              <span>共 {visibleAccounts.length} 个账号</span>
              <Pagination
                ariaLabel="系统账号列表分页"
                page={accountPage}
                pageSize={accountPageSize}
                total={visibleAccounts.length}
                onPageChange={setAccountPage}
                onPageSizeChange={setAccountPageSize}
              />
            </div>
          </>
        ) : view === 'permissions' ? (
          <div className="role-permission-grid">
            {ROLE_ORDER.map((roleKey) => {
              const role = ROLE_DEFINITIONS[roleKey];
              const RoleIcon = role.icon;
              return (
                <article className={`role-permission-card role-permission-${roleKey}`} key={role.key}>
                  <header className="role-permission-head">
                    <span className="role-permission-icon"><RoleIcon size={20} /></span>
                    <div><h2>{role.label}</h2><p>{role.description}</p></div>
                    <div className="role-policy-badges">
                      {role.unrestricted ? <span className="full-access-badge"><ShieldCheck size={14} />全部权限</span> : null}
                      <LoginPolicyBadge roleKey={roleKey} />
                    </div>
                  </header>
                  <ul className="permission-list">
                    {role.permissions.map((permission) => <li key={permission}><CheckCircle2 size={16} />{permission}</li>)}
                  </ul>
                  {role.key === 'finance' ? <AirwallexAuthenticationNote /> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <>
            <div className="approval-management">
              {paginatedApprovalFlows.map((flow) => (
                <ApprovalFlowCard key={flow.id} flow={flow} onEdit={openEditApprovalFlow} onToggle={toggleApprovalFlow} />
              ))}
            </div>
            <div className="table-footer">
              <span>共 {approvalFlows.length} 条审批流程</span>
              <Pagination
                ariaLabel="审批流程列表分页"
                page={approvalPage}
                pageSize={approvalPageSize}
                total={approvalFlows.length}
                onPageChange={setApprovalPage}
                onPageSizeChange={setApprovalPageSize}
              />
            </div>
          </>
        )}
      </section>

      {selectedAccount ? (
        <Modal
          title="账号管理"
          width="680px"
          onClose={() => setSelectedAccount(null)}
          footer={(
            <div className="account-modal-footer">
              <Button
                variant={selectedAccount.status === '已启用' ? 'danger' : 'secondary'}
                icon={<Power size={16} />}
                onClick={() => toggleAccountStatus(selectedAccount)}
              >{selectedAccount.status === '已启用' ? '停用账号' : '启用账号'}</Button>
              <div>
                <Button variant="ghost" onClick={() => setSelectedAccount(null)}>关闭</Button>
                <Button variant="secondary" icon={<LockKeyhole size={16} />} onClick={() => openPasswordEditor(selectedAccount)}>修改密码</Button>
                <Button icon={<PencilLine size={16} />} onClick={() => openPermissionEditor(selectedAccount)}>编辑权限</Button>
              </div>
            </div>
          )}
        >
          <AccountProfile account={selectedAccount} />
          <div className="permission-modal-section">
            <span className="permission-section-title"><UserCog size={17} />已分配权限 <small>{selectedAccount.permissions.length} 项</small></span>
            <ul className="permission-list permission-modal-list">
              {PERMISSION_OPTIONS.filter((permission) => selectedAccount.permissions.includes(permission.id)).map((permission) => <li key={permission.id}><CheckCircle2 size={16} />{permission.label}</li>)}
            </ul>
          </div>
          {selectedAccount.permissions.includes('payout_execute') ? <AirwallexAuthenticationNote /> : null}
        </Modal>
      ) : null}

      {editingAccount ? (
        <Modal
          title="编辑操作权限"
          width="760px"
          onClose={() => setEditingAccount(null)}
          footer={<><Button variant="ghost" onClick={() => setEditingAccount(null)}>取消</Button><Button onClick={savePermissions}>保存权限</Button></>}
        >
          <AccountProfile account={editingAccount} />
          <div className="permission-editor-toolbar">
            <div><strong>账号级操作权限</strong><small>本次调整仅影响该账号，不会修改对应角色模板。</small></div>
            <div>
              <button type="button" className="permission-tool-button" onClick={() => setDraftPermissions([...ROLE_PERMISSION_IDS[editingAccount.role]])}><RotateCcw size={14} />恢复角色默认</button>
              <button type="button" className="permission-tool-button" onClick={() => setDraftPermissions([...ALL_PERMISSION_IDS])}><CheckCircle2 size={14} />全选</button>
            </div>
          </div>
          <div className="permission-editor-groups">
            {PERMISSION_GROUPS.map((group) => (
              <section className="permission-editor-group" key={group}>
                <header><h3>{group}</h3><span>{PERMISSION_OPTIONS.filter((permission) => permission.group === group && draftPermissions.includes(permission.id)).length}/{PERMISSION_OPTIONS.filter((permission) => permission.group === group).length}</span></header>
                <div className="permission-checkbox-grid">
                  {PERMISSION_OPTIONS.filter((permission) => permission.group === group).map((permission) => {
                    const checked = draftPermissions.includes(permission.id);
                    return (
                      <label className={`permission-checkbox ${checked ? 'is-checked' : ''}`} key={permission.id}>
                        <input type="checkbox" checked={checked} onChange={() => togglePermission(permission.id)} />
                        <span><strong>{permission.label}</strong><small>{permission.description}</small></span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          {draftPermissions.includes('payout_execute') ? <AirwallexAuthenticationNote /> : null}
        </Modal>
      ) : null}

      {passwordAccount ? (
        <Modal
          title="修改登录密码"
          width="520px"
          onClose={() => setPasswordAccount(null)}
          footer={<><Button variant="ghost" onClick={() => setPasswordAccount(null)}>取消</Button><Button disabled={!passwordIsValid || !passwordsMatch} onClick={savePassword}>确认修改</Button></>}
        >
          <AccountProfile account={passwordAccount} />
          <div className="form-grid single-column password-form">
            <label><span>新密码</span><input autoFocus type="password" autoComplete="new-password" placeholder="输入至少 8 位新密码" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <label><span>确认新密码</span><input type="password" autoComplete="new-password" placeholder="再次输入新密码" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            <div className={`password-rule ${passwordIsValid ? 'is-valid' : ''}`}><CheckCircle2 size={15} />密码长度至少 8 位</div>
            {confirmPassword && !passwordsMatch ? <p className="password-match-error">两次输入的密码不一致</p> : null}
            <div className="account-form-hint"><ShieldCheck size={17} /><span>密码修改后会在下次登录时生效；系统不会在页面中显示或保留明文密码。</span></div>
          </div>
        </Modal>
      ) : null}

      {approvalDraft ? (
        <Modal
          title={approvalEditorMode === 'create' ? '新建审批流程' : '编辑审批流程'}
          width="900px"
          onClose={() => setApprovalDraft(null)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setApprovalDraft(null)}>取消</Button>
              <Button disabled={!approvalDraftIsValid} onClick={saveApprovalFlow}>{approvalEditorMode === 'create' ? '创建流程' : '保存流程'}</Button>
            </>
          )}
        >
          <ApprovalFlowEditor
            flow={approvalDraft}
            onNameChange={(name) => setApprovalDraft((current) => current ? { ...current, name } : current)}
            onEnabledChange={(enabled) => setApprovalDraft((current) => current ? { ...current, enabled } : current)}
            onNodeChange={updateApprovalNode}
            onMoveNode={moveApprovalNode}
            onRemoveNode={removeApprovalNode}
            onAddNode={addApprovalNode}
          />
        </Modal>
      ) : null}

      {createOpen ? (
        <Modal title="新增系统账号" onClose={() => setCreateOpen(false)} footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button><Button disabled={!newName.trim() || !newEmail.trim()} onClick={createAccount}>创建账号</Button></>}>
          <div className="form-grid single-column">
            <label><span>姓名 <em className="required-mark" aria-hidden="true">*</em></span><input autoFocus placeholder="输入账号使用人姓名" value={newName} onChange={(event) => setNewName(event.target.value)} /></label>
            <label><span>登录邮箱 <em className="required-mark" aria-hidden="true">*</em></span><input type="email" placeholder="name@company.com" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label>
            <div className="form-control">
              <span>账号类型</span>
              <SelectField ariaLabel="账号类型" variant="form" value={newRole} options={ROLE_SELECT_OPTIONS} onChange={setNewRole} />
            </div>
            <div className="account-form-hint">
              <ShieldCheck size={17} />
              <span>
                创建后将自动套用“{ROLE_DEFINITIONS[newRole].label}”的角色权限；
                {LOGIN_SESSION_POLICY_COPY[ROLE_LOGIN_SESSION_POLICY[newRole]].description}
              </span>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
