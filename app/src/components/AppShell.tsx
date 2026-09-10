import {
  Bell,
  Building2,
  ChevronDown,
  FileSignature,
  Globe2,
  Handshake,
  Home,
  Menu,
  ReceiptText,
  Settings,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useState, type PropsWithChildren } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { SystemUser } from '../data';
import { canAccessPage, getDefaultPageForRole } from '../permissions';
import type { NavPage } from '../types';

type NavItem = { label: string; page: NavPage };
type NavGroup = { id: string; label: string; icon: LucideIcon; items: NavItem[] };
type NavEntry =
  | ({ type: 'item'; page: NavPage } & Omit<NavGroup, 'id' | 'items'>)
  | ({ type: 'group' } & NavGroup);

const NAV_ENTRIES: NavEntry[] = [
  { type: 'item', label: '工作台', page: 'dashboard', icon: Home },
  {
    type: 'group',
    id: 'projects',
    label: '请款协作',
    icon: Handshake,
    items: [
      { label: '飞书关联项目', page: 'feishu-projects' },
      { label: '我的请款', page: 'projects' },
      { label: '合作审批', page: 'requests' },
    ],
  },
  { type: 'item', label: '合同管理', page: 'contracts', icon: FileSignature },
  { type: 'item', label: 'invoice管理', page: 'invoice', icon: ReceiptText },
  {
    type: 'group',
    id: 'creators',
    label: '达人管理',
    icon: Users,
    items: [
      { label: '达人档案', page: 'creators' },
      { label: '合作名单', page: 'collaborations' },
    ],
  },
  {
    type: 'group',
    id: 'payments',
    label: '支付管理',
    icon: WalletCards,
    items: [
      { label: '付款工作台', page: 'payment-workbench' },
      { label: '付款批次', page: 'batches' },
      { label: '交易记录', page: 'transactions' },
    ],
  },
  {
    type: 'group',
    id: 'account',
    label: '账户中心',
    icon: Building2,
    items: [
      { label: '组织信息', page: 'organization' },
      { label: '渠道设置', page: 'channels' },
    ],
  },
  {
    type: 'group',
    id: 'system',
    label: '系统设置',
    icon: Settings,
    items: [
      { label: '系统账号', page: 'system-accounts' },
      { label: '系统配置', page: 'system-config' },
    ],
  },
  { type: 'item', label: '通知', page: 'notifications', icon: Bell },
];

const selectedPage = (page: NavPage) => {
  if (page === 'new-batch') return 'batches';
  if (page === 'invoice-create' || page === 'invoice-batch-create' || page === 'invoice-edit') return 'invoice';
  if (page === 'contract-create') return 'contracts';
  if (page === 'system-settings') return 'system-accounts';
  return page;
};

export function AppShell({
  children,
  activePage,
  onNavigate,
  currentUser,
  notificationUnreadCount,
}: PropsWithChildren<{
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  currentUser: SystemUser;
  notificationUnreadCount: number;
}>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    projects: true,
    creators: true,
    payments: true,
    account: true,
    system: true,
  });

  const current = selectedPage(activePage);
  const visibleNavEntries = NAV_ENTRIES.flatMap((entry): NavEntry[] => {
    if (entry.type === 'item') return canAccessPage(currentUser, entry.page) ? [entry] : [];
    const items = entry.items.filter((item) => canAccessPage(currentUser, item.page));
    return items.length > 0 ? [{ ...entry, items }] : [];
  });

  const navigate = (page: NavPage) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <button className="mobile-menu-button" type="button" aria-label="打开菜单" onClick={() => setMobileOpen(true)}>
            <Menu size={21} />
          </button>
          <button className="brand-button" type="button" onClick={() => navigate(getDefaultPageForRole(currentUser.roleKey))}>
            <span className="brand-mark" aria-hidden="true"><i /><i /></span>
            <span className="brand-name"><strong>COMETS</strong> Pay</span>
          </button>
          <span className="brand-divider" />
          <span className="product-name">支付系统</span>
        </div>
        <div className="topbar-actions">
          <button
            className="icon-button notification-button"
            type="button"
            aria-label={notificationUnreadCount ? `通知，${notificationUnreadCount} 条未读` : '通知'}
            onClick={() => navigate('notifications')}
          >
            <Bell size={20} />
            {notificationUnreadCount ? (
              <span className="notification-count" aria-hidden="true">
                {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
              </span>
            ) : null}
          </button>
          <button className="language-button" type="button">
            <Globe2 size={20} />
            <span>简体中文</span>
            <ChevronDown size={15} />
          </button>
          <span className="top-avatar" title={`当前账号：${currentUser.account}`}>{currentUser.initials}</span>
        </div>
      </header>

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-mobile-head">
          <span>菜单</span>
          <button className="icon-button" type="button" aria-label="关闭菜单" onClick={() => setMobileOpen(false)}><X size={21} /></button>
        </div>
        <nav className="sidebar-nav" aria-label="主菜单">
          {visibleNavEntries.map((entry) => {
            const EntryIcon = entry.icon;
            if (entry.type === 'item') {
              return (
                <button
                  className={`nav-parent nav-single ${current === entry.page ? 'nav-active' : ''}`}
                  data-nav-key={entry.page}
                  data-nav-level="primary"
                  key={entry.page}
                  type="button"
                  onClick={() => navigate(entry.page)}
                >
                  <EntryIcon size={20} />
                  <span>{entry.label}</span>
                </button>
              );
            }

            const isExpanded = expanded[entry.id];
            const hasActive = entry.items.some((item) => item.page === current);
            return (
              <div className="nav-group" key={entry.id}>
                <button
                  className={`nav-parent ${hasActive ? 'nav-parent-current' : ''}`}
                  data-nav-key={entry.id}
                  data-nav-level="primary"
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded((value) => ({ ...value, [entry.id]: !value[entry.id] }))}
                >
                  <EntryIcon size={20} />
                  <span>{entry.label}</span>
                  <ChevronDown className={`nav-chevron ${isExpanded ? 'nav-chevron-open' : ''}`} size={15} />
                </button>
                {isExpanded ? (
                  <div className="nav-children">
                    {entry.items.map((item) => (
                      <button
                        className={`nav-child ${current === item.page ? 'nav-active' : ''}`}
                        key={item.page}
                        type="button"
                        onClick={() => navigate(item.page)}
                      >
                        <span className="nav-dot" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-account">
          <span className="mini-avatar">{currentUser.initials}</span>
          <span><strong>{currentUser.name}</strong><small>{currentUser.role}</small></span>
          <ChevronDown size={15} />
        </div>
      </aside>

      {mobileOpen ? <button className="sidebar-scrim" type="button" aria-label="关闭菜单" onClick={() => setMobileOpen(false)} /> : null}
      <main className="main-content">{children}</main>
    </div>
  );
}
