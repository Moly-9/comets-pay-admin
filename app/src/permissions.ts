import type { SystemRoleKey, SystemUser } from './data';
import type { ContractRecord } from './contracts';
import type { NavPage } from './types';

export type PermissionId =
  | 'creator_records_view'
  | 'creator_records_manage'
  | 'contract_view'
  | 'contract_manage'
  | 'contract_template_manage'
  | 'contract_delete'
  | 'invoice_view'
  | 'invoice_manage'
  | 'invoice_media_review'
  | 'invoice_finance_review'
  | 'request_project_view'
  | 'cooperation_project_view'
  | 'cooperation_project_manage'
  | 'project_manage'
  | 'request_list_view'
  | 'request_create'
  | 'request_material_view'
  | 'request_review'
  | 'payout_execute'
  | 'payment_view'
  | 'account_manage'
  | 'approval_manage'
  | 'channel_manage';

export type PermissionOption = {
  id: PermissionId;
  group: '业务资料' | '财务与付款' | '系统管理';
  label: string;
  description: string;
};

export const PERMISSION_OPTIONS: PermissionOption[] = [
  { id: 'creator_records_view', group: '业务资料', label: '查看网红档案库', description: '访问达人档案、账户与合作资料。' },
  { id: 'creator_records_manage', group: '业务资料', label: '管理网红档案与合作名单', description: '新增、编辑达人档案并导入合作名单。' },
  { id: 'contract_view', group: '业务资料', label: '查看合同模块', description: '查看项目合同及其关联状态。' },
  { id: 'contract_manage', group: '业务资料', label: '上传与管理合同', description: '上传合同并维护合同与项目的关联资料。' },
  { id: 'contract_template_manage', group: '业务资料', label: '编辑合同模板', description: '维护合同模板内容，仅项目负责人、老板和管理员可操作。' },
  { id: 'contract_delete', group: '业务资料', label: '删除合同', description: '管理员、项目负责人和老板可删除任意合同；媒介仅可删除本人上传且尚未用于请款项目的合同。' },
  { id: 'invoice_view', group: '业务资料', label: '查看 Invoice 模块', description: '查看并选择系统内的 Invoice。' },
  { id: 'invoice_manage', group: '业务资料', label: '生成与管理 Invoice', description: '生成 Invoice 文件并维护 Invoice 业务资料。' },
  { id: 'invoice_media_review', group: '业务资料', label: '执行 Invoice 媒介审核', description: '在媒介审核阶段通过或退回 Invoice。' },
  { id: 'invoice_finance_review', group: '财务与付款', label: '执行 Invoice 财务审核', description: '在财务审核阶段通过或退回 Invoice。' },
  { id: 'request_project_view', group: '业务资料', label: '查看我的项目', description: '查看当前媒介创建的请款草稿与提交进度。' },
  { id: 'cooperation_project_view', group: '业务资料', label: '查看飞书关联项目', description: '查看飞书同步与手动维护的合作项目目录。' },
  { id: 'cooperation_project_manage', group: '业务资料', label: '维护飞书关联项目', description: '配置同步范围、同步飞书以及手动维护合作项目。' },
  { id: 'project_manage', group: '业务资料', label: '新建与维护请款项目', description: '关联飞书合作项目、达人、合同与多份 Invoice。' },
  { id: 'request_list_view', group: '业务资料', label: '查看请款清单', description: '查看已提交的请款明细与状态。' },
  { id: 'request_create', group: '业务资料', label: '新建并提交请款项目', description: '关联合同与 Invoice，生成付款清单并提交审批。' },
  { id: 'request_material_view', group: '财务与付款', label: '查看请款审核资料', description: '查看合同、Invoice 与请款单信息。' },
  { id: 'request_review', group: '财务与付款', label: '审核请款项目', description: '通过、退回并记录请款审核结果。' },
  { id: 'payout_execute', group: '财务与付款', label: '执行 Airwallex 自动打款', description: '审核通过后发起付款，操作前需完成登录认证。' },
  { id: 'payment_view', group: '财务与付款', label: '查看付款板块', description: '查看付款批次、交易记录与付款状态。' },
  { id: 'account_manage', group: '系统管理', label: '管理系统账号与权限', description: '新增、启停账号并编辑账号操作权限。' },
  { id: 'approval_manage', group: '系统管理', label: '管理请款审批流程', description: '配置请款项目的审批节点、审批角色与启停状态。' },
  { id: 'channel_manage', group: '系统管理', label: '配置付款渠道', description: '管理 Airwallex 连接、渠道设置与路由规则。' },
];

export const ALL_PERMISSION_IDS = PERMISSION_OPTIONS.map((permission) => permission.id);
export const PERMISSION_GROUPS: PermissionOption['group'][] = ['业务资料', '财务与付款', '系统管理'];

export const ROLE_PERMISSION_IDS: Record<SystemRoleKey, PermissionId[]> = {
  media: [
    'cooperation_project_view',
    'creator_records_view',
    'creator_records_manage',
    'contract_view',
    'contract_manage',
    'contract_delete',
    'invoice_view',
    'invoice_manage',
    'invoice_media_review',
    'request_project_view',
    'project_manage',
  ],
  pm: ['cooperation_project_view', 'request_list_view', 'request_material_view', 'request_review'],
  finance: ['cooperation_project_view', 'request_material_view', 'request_review', 'invoice_finance_review', 'payout_execute', 'payment_view'],
  admin: [...ALL_PERMISSION_IDS],
  owner: ALL_PERMISSION_IDS,
  project: [
    'cooperation_project_view',
    'cooperation_project_manage',
    'creator_records_view',
    'contract_view',
    'contract_template_manage',
    'contract_delete',
    'invoice_view',
    'request_list_view',
    'request_material_view',
    'request_review',
    'invoice_media_review',
  ],
};

const PAGE_PERMISSION_RULES: Partial<Record<NavPage, PermissionId[]>> = {
  'feishu-projects': ['cooperation_project_view'],
  projects: ['request_project_view'],
  requests: ['request_list_view', 'request_material_view'],
  contracts: ['contract_view', 'request_material_view'],
  'contract-create': ['contract_manage'],
  invoice: ['invoice_view', 'request_material_view'],
  'invoice-create': ['invoice_manage'],
  'invoice-batch-create': ['invoice_manage'],
  'invoice-edit': ['invoice_manage', 'invoice_media_review'],
  creators: ['creator_records_view'],
  collaborations: ['creator_records_view'],
  'payment-workbench': ['payment_view'],
  batches: ['payment_view'],
  'new-batch': ['payout_execute'],
  transactions: ['payment_view'],
  organization: ['account_manage'],
  channels: ['channel_manage'],
  'system-accounts': ['account_manage', 'approval_manage'],
  'system-config': ['contract_template_manage'],
  'system-settings': ['account_manage', 'approval_manage'],
};

const ROLE_BLOCKED_PAGES: Partial<Record<SystemRoleKey, NavPage[]>> = {
  media: ['dashboard', 'requests'],
};

export const hasPermission = (user: SystemUser, permission: PermissionId) => (
  ROLE_PERMISSION_IDS[user.roleKey].includes(permission)
);

export type ContractDeletionOptions = {
  usedInRequest?: boolean;
};

export const canDeleteContract = (
  user: SystemUser,
  contract: ContractRecord,
  options: ContractDeletionOptions = {},
) => {
  if (['admin', 'project', 'owner'].includes(user.roleKey)) return true;
  return user.roleKey === 'media'
    && !options.usedInRequest
    && contract.uploadedByAccount === user.account;
};

export const canEditContractTemplate = (user: SystemUser) => (
  hasPermission(user, 'contract_template_manage')
);

export const canDeleteContractSelection = (
  user: SystemUser,
  contracts: ContractRecord[],
  optionsForContract?: (contract: ContractRecord) => ContractDeletionOptions,
) => (
  contracts.length > 0
  && contracts.every((contract) => canDeleteContract(user, contract, optionsForContract?.(contract)))
);

export const canAccessPage = (user: SystemUser, page: NavPage) => {
  if (ROLE_BLOCKED_PAGES[user.roleKey]?.includes(page)) return false;
  const requiredPermissions = PAGE_PERMISSION_RULES[page];
  return !requiredPermissions || requiredPermissions.some((permission) => hasPermission(user, permission));
};

export const getDefaultPageForRole = (role: SystemRoleKey): NavPage => {
  if (role === 'media') return 'projects';
  if (role === 'pm' || role === 'project') return 'requests';
  if (role === 'finance') return 'payment-workbench';
  return 'dashboard';
};
