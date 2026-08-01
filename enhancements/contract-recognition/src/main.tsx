import {
  Bell,
  ChevronDown,
  FileText,
  Globe2,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Users,
  WalletCards,
} from "lucide-react";
import React from "react";
import ReactDOM from "react-dom/client";
import { ContractRecognitionApp } from "./App";
import "./styles.css";

function StandaloneShell() {
  return (
    <div className="cr-standalone-shell">
      <header className="cr-shell-topbar">
        <div className="cr-shell-brand">
          <button type="button" aria-label="打开菜单">
            <Menu size={20} />
          </button>
          <span className="cr-shell-mark">
            <i />
            <i />
          </span>
          <strong>COMETS <em>Pay</em></strong>
          <span />
          <small>支付系统</small>
        </div>
        <div className="cr-shell-actions">
          <button type="button" aria-label="通知"><Bell size={19} /></button>
          <button type="button"><Globe2 size={18} /> 简体中文 <ChevronDown size={14} /></button>
          <span className="cr-shell-avatar">AD</span>
        </div>
      </header>
      <aside className="cr-shell-sidebar">
        <nav>
          <button type="button"><LayoutDashboard size={19} />工作台</button>
          <button type="button"><ReceiptText size={19} />项目协作<ChevronDown size={14} /></button>
          <button type="button" className="cr-shell-active"><FileText size={19} />合同管理</button>
          <button type="button"><ReceiptText size={19} />invoice管理</button>
          <button type="button"><Users size={19} />达人管理<ChevronDown size={14} /></button>
          <button type="button"><WalletCards size={19} />支付管理<ChevronDown size={14} /></button>
        </nav>
        <footer>
          <span className="cr-shell-avatar">AD</span>
          <div><strong>管理员</strong><small>管理员账号</small></div>
          <ChevronDown size={14} />
        </footer>
      </aside>
      <main className="cr-shell-main">
        <ContractRecognitionApp />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <StandaloneShell />
  </React.StrictMode>,
);
