import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Power,
  RotateCcw,
  Star,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import {
  getAvailableDefaultAccounts,
  getDestructiveAccountRule,
  getReenabledStatus,
  isAccountPaymentReady,
  type PayoutAccount,
} from "./payoutAccountRules";

type PayoutController = {
  accounts: PayoutAccount[];
  onChange: (accounts: PayoutAccount[]) => void;
};

type AccountCard = {
  account: PayoutAccount;
  right: number;
  top: number;
  bottom: number;
};

type DialogState =
  | {
      kind: "confirm";
      mode: "delete" | "disable";
      accountId: string;
    }
  | {
      kind: "switch";
      mode: "delete" | "disable";
      accountId: string;
    };

type ToastState = {
  message: string;
  tone: "success" | "warning" | "error";
};

type ReactFiber = {
  return?: ReactFiber | null;
  alternate?: ReactFiber | null;
  memoizedProps?: unknown;
  pendingProps?: unknown;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "资料待补充",
  READY_FOR_VALIDATION: "待",
  VALIDATED: "格式校验通过",
  VERIFIED: "账户已验证",
  REVIEW_REQUIRED: "名称需复核",
  CANNOT_VERIFY: "暂不支持验证",
  INVALID: "账户无效",
  DISABLED: "账户已停用",
};

const findController = (root: HTMLElement): PayoutController | null => {
  const candidates = [
    root,
    ...root.querySelectorAll<HTMLElement>(
      ".payout-account-toolbar, .payout-account-tabs, .payout-account-tab",
    ),
  ];
  const controllers: PayoutController[] = [];

  for (const candidate of candidates) {
    const record = candidate as unknown as Record<string, unknown>;
    const fiberKey = Object.getOwnPropertyNames(candidate).find(
      (key) =>
        key.startsWith("__reactFiber$") ||
        key.startsWith("__reactInternalInstance$"),
    );
    if (!fiberKey) continue;

    const hostFiber = record[fiberKey] as ReactFiber | undefined;
    for (const startingFiber of [hostFiber, hostFiber?.alternate]) {
      let fiber = startingFiber;
      for (let depth = 0; fiber && depth < 20; depth += 1) {
        const props =
          (fiber.memoizedProps ?? fiber.pendingProps) as
            | {
                accounts?: PayoutAccount[];
                onChange?: (accounts: PayoutAccount[]) => void;
              }
            | undefined;
        if (
          Array.isArray(props?.accounts) &&
          typeof props.onChange === "function"
        ) {
          controllers.push({
            accounts: props.accounts,
            onChange: props.onChange,
          });
          break;
        }
        fiber = fiber.return ?? undefined;
      }
    }
  }

  if (!controllers.length) return null;
  const tabs = [
    ...root.querySelectorAll<HTMLButtonElement>(".payout-account-tab"),
  ];
  const score = (controller: PayoutController) => {
    let result = controller.accounts.length === tabs.length ? 10 : 0;
    controller.accounts.forEach((account, index) => {
      const tab = tabs[index];
      if (!tab) return;
      if (tab.querySelector("strong")?.textContent?.trim() === account.nickname) {
        result += 2;
      }
      if (
        Boolean(tab.querySelector(".payout-account-default-star")) ===
        account.isDefault
      ) {
        result += 3;
      }
      const statusLabel = STATUS_LABELS[account.status];
      if (
        statusLabel &&
        tab
          .querySelector(".payout-account-mini-status")
          ?.textContent?.includes(statusLabel)
      ) {
        result += 3;
      }
    });
    return result;
  };

  return controllers.sort((left, right) => score(right) - score(left))[0];
};

const maskEmail = (email = "") => {
  const [name = "", domain = ""] = email.split("@");
  if (!domain) return "邮箱待补充";
  return `${name.slice(0, 1) || "*"}***@${domain}`;
};

const getAccountSummary = (account: PayoutAccount) => {
  const currency =
    account.provider === "Airwallex"
      ? account.bankDetails?.accountCurrency || "币种待补充"
      : "USD";
  const rawAccount =
    account.bankDetails?.iban || account.bankDetails?.accountNumber || "";
  const maskedAccount = rawAccount
    ? `•••• ${rawAccount.replace(/\s/g, "").slice(-4)}`
    : "账号待补充";

  return {
    type:
      account.provider === "Airwallex"
        ? "Airwallex 银行账户"
        : "PayPal 账户",
    currency,
    masked:
      account.provider === "PayPal"
        ? maskEmail(account.paypalEmail)
        : maskedAccount,
  };
};

const getFocusable = (container: HTMLElement) =>
  [
    ...container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => !element.hasAttribute("hidden"));

const AccountSummary = ({ account }: { account: PayoutAccount }) => {
  const summary = getAccountSummary(account);
  return (
    <div className="cp-account-dialog-summary">
      <span className="cp-account-dialog-summary-icon" aria-hidden="true">
        <WalletCards size={18} />
      </span>
      <span>
        <strong>{account.nickname}</strong>
        <small>
          {summary.type} · {summary.currency} · {summary.masked}
        </small>
      </span>
    </div>
  );
};

type DialogShellProps = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
};

const DialogShell = ({
  title,
  description,
  confirmLabel,
  danger = false,
  confirmDisabled = false,
  onCancel,
  onConfirm,
  children,
}: DialogShellProps) => {
  const panelRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = getFocusable(panelRef.current);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="cp-account-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        ref={panelRef}
        className="cp-account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-account-dialog-title"
        aria-describedby="cp-account-dialog-description"
        onKeyDown={onKeyDown}
      >
        <header>
          <span>
            <h2 id="cp-account-dialog-title">{title}</h2>
            <p id="cp-account-dialog-description">{description}</p>
          </span>
          <button
            className="cp-account-icon-button"
            type="button"
            aria-label="关闭"
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </header>
        <div className="cp-account-dialog-body">{children}</div>
        <footer>
          <button
            ref={cancelRef}
            className="cp-account-dialog-button"
            type="button"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className={`cp-account-dialog-button ${
              danger
                ? "cp-account-dialog-danger"
                : "cp-account-dialog-primary"
            }`}
            type="button"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
};

export const PayoutAccountActions = () => {
  const controllerRef = useRef<PayoutController | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const lastSignatureRef = useRef("");
  const [cards, setCards] = useState<AccountCard[]>([]);
  const [summaryHost, setSummaryHost] = useState<HTMLElement | null>(null);
  const [menuAccountId, setMenuAccountId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [replacementId, setReplacementId] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (message: string, tone: ToastState["tone"] = "success") => {
      setToast({ message, tone });
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const scan = useCallback(() => {
    const root = document.querySelector<HTMLElement>(
      ".creator-profile-editor-modal .payout-accounts",
    );
    rootRef.current = root;
    document.body.classList.toggle("cp-payout-actions-active", Boolean(root));

    if (!root) {
      controllerRef.current = null;
      lastSignatureRef.current = "";
      setCards([]);
      setSummaryHost(null);
      setMenuAccountId(null);
      setDialog(null);
      return;
    }

    root
      .querySelectorAll<HTMLButtonElement>(".payout-account-actions button")
      .forEach((button) => {
        if (button.textContent?.trim() === "设为默认") {
          button.dataset.cpHideDefault = "true";
        }
      });

    const toolbar = root.querySelector<HTMLElement>(".payout-account-toolbar");
    let host = toolbar?.querySelector<HTMLElement>(
      ".cp-account-availability-host",
    );
    if (toolbar && !host) {
      host = document.createElement("div");
      host.className = "cp-account-availability-host";
      toolbar.appendChild(host);
    }
    setSummaryHost((current) => (current === host ? current : host ?? null));

    const controller = findController(root);
    controllerRef.current = controller;
    const pluginRoot = document.getElementById(
      "cp-payout-account-actions-root",
    );
    if (pluginRoot) {
      pluginRoot.dataset.controllerReady = controller ? "true" : "false";
    }

    const accountTabs = [
      ...root.querySelectorAll<HTMLButtonElement>(".payout-account-tab"),
    ];
    const accounts =
      controller?.accounts ??
      accountTabs.map((tab, index) => ({
        id: `dom-account-${index}`,
        provider: tab.textContent?.includes("PayPal")
          ? ("PayPal" as const)
          : ("Airwallex" as const),
        nickname:
          tab.querySelector("strong")?.textContent?.trim() ||
          `付款账户 ${index + 1}`,
        isDefault: Boolean(tab.querySelector(".payout-account-default-star")),
        status: "DRAFT",
      }));
    const nextCards = accountTabs.slice(0, accounts.length).map((tab, index) => {
      const rect = tab.getBoundingClientRect();
      return {
        account: accounts[index],
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    });
    const signature = nextCards
      .map(
        ({ account, right, top, bottom }) =>
          `${account.id}:${account.status}:${account.isDefault}:${account.nickname}:${right}:${top}:${bottom}`,
      )
      .join("|");

    if (signature !== lastSignatureRef.current) {
      lastSignatureRef.current = signature;
      setCards(nextCards);
    }
  }, []);

  const scheduleScan = useCallback(() => {
    if (scanFrameRef.current !== null) return;
    scanFrameRef.current = window.requestAnimationFrame(() => {
      scanFrameRef.current = null;
      scan();
    });
  }, [scan]);

  useLayoutEffect(() => {
    scan();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-selected"],
    });
    window.addEventListener("resize", scheduleScan);
    window.addEventListener("scroll", scheduleScan, true);
    const interval = window.setInterval(scheduleScan, 700);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleScan);
      window.removeEventListener("scroll", scheduleScan, true);
      window.clearInterval(interval);
      if (scanFrameRef.current !== null) {
        window.cancelAnimationFrame(scanFrameRef.current);
      }
      document.body.classList.remove("cp-payout-actions-active");
    };
  }, [scan, scheduleScan]);

  useEffect(() => {
    if (!menuAccountId) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        !target.closest(".cp-account-action-menu") &&
        !target.closest(".cp-account-menu-trigger")
      ) {
        setMenuAccountId(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      const trigger = document.querySelector<HTMLButtonElement>(
        `.cp-account-menu-trigger[data-account-id="${CSS.escape(
          menuAccountId,
        )}"]`,
      );
      setMenuAccountId(null);
      window.requestAnimationFrame(() => trigger?.focus());
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuAccountId]);

  const accounts = useMemo(
    () => cards.map(({ account }) => account),
    [cards],
  );
  const activeMenuCard =
    cards.find(({ account }) => account.id === menuAccountId) ?? null;
  const dialogAccount =
    dialog && accounts.find((account) => account.id === dialog.accountId);
  const availableAccounts = dialogAccount
    ? getAvailableDefaultAccounts(accounts, dialogAccount.id)
    : [];
  const paymentReadyCount = accounts.filter(isAccountPaymentReady).length;

  const applyAccounts = useCallback(
    (update: (current: PayoutAccount[]) => PayoutAccount[]) => {
      const root = rootRef.current;
      const controller = root ? findController(root) : null;
      if (!controller) {
        showToast("账户状态更新失败，请重试。", "error");
        return false;
      }
      controller.onChange(update(controller.accounts));
      window.requestAnimationFrame(scheduleScan);
      return true;
    },
    [scheduleScan, showToast],
  );

  const closeDialog = () => {
    setDialog(null);
    setReplacementId("");
  };

  const focusAccountEditor = (accountId: string) => {
    const cardIndex = cards.findIndex(({ account }) => account.id === accountId);
    const tabs = rootRef.current?.querySelectorAll<HTMLButtonElement>(
      ".payout-account-tab",
    );
    tabs?.[cardIndex]?.click();
    setMenuAccountId(null);
    window.requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector<HTMLInputElement>('[aria-label="账户别名"]')
        ?.focus();
    });
  };

  const setDefaultAccount = (account: PayoutAccount) => {
    if (!isAccountPaymentReady(account)) {
      showToast("该账户尚未完成验证，暂不能设为默认。", "warning");
      return;
    }
    if (
      applyAccounts((current) =>
        current.map((item) => ({
          ...item,
          isDefault: item.id === account.id,
        })),
      )
    ) {
      setMenuAccountId(null);
      showToast("默认付款账户已更新");
    }
  };

  const requestDestructiveAction = (account: PayoutAccount) => {
    const rule = getDestructiveAccountRule(account);
    if (rule.blocked) {
      showToast(
        rule.reason || "该账户正在处理中，完成后才能停用。",
        "warning",
      );
      return;
    }
    if (rule.action === "reenable") {
      if (
        applyAccounts((current) =>
          current.map((item) =>
            item.id === account.id
              ? {
                  ...item,
                  status: getReenabledStatus(item),
                  isDefault: false,
                  __statusBeforeDisabled: undefined,
                }
              : item,
          ),
        )
      ) {
        setMenuAccountId(null);
        showToast("付款账户已重新启用");
      }
      return;
    }

    setMenuAccountId(null);
    setReplacementId("");
    setDialog({
      kind: account.isDefault ? "switch" : "confirm",
      mode: rule.action,
      accountId: account.id,
    });
  };

  const confirmAction = () => {
    if (!dialog || !dialogAccount) return;
    const mode = dialog.mode;
    const succeeded = applyAccounts((current) => {
      if (dialog.kind === "switch") {
        if (!replacementId) return current;
        return current
          .filter(
            (account) => mode !== "delete" || account.id !== dialog.accountId,
          )
          .map((account) => {
            if (account.id === replacementId) {
              return { ...account, isDefault: true };
            }
            if (account.id !== dialog.accountId) {
              return { ...account, isDefault: false };
            }
            return {
              ...account,
              status: "DISABLED",
              isDefault: false,
              __statusBeforeDisabled: account.status,
            };
          });
      }

      if (mode === "delete") {
        return current.filter((account) => account.id !== dialog.accountId);
      }
      return current.map((account) =>
        account.id === dialog.accountId
          ? {
              ...account,
              status: "DISABLED",
              isDefault: false,
              __statusBeforeDisabled: account.status,
            }
          : account,
      );
    });

    if (!succeeded) return;
    closeDialog();
    setMenuAccountId(null);
    showToast(mode === "delete" ? "付款账户已删除" : "付款账户已停用");
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ),
    ];
    if (!items.length) return;
    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        currentIndex < 0
          ? 0
          : (currentIndex + direction + items.length) % items.length;
      items[nextIndex]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    }
  };

  useEffect(() => {
    if (!activeMenuCard) return;
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(
          `.cp-account-action-menu[data-account-id="${CSS.escape(
            activeMenuCard.account.id,
          )}"] [role="menuitem"]`,
        )
        ?.focus();
    });
  }, [activeMenuCard]);

  return (
    <>
      {cards.map(({ account, right, top, bottom }) => {
        const visible =
          bottom > 0 &&
          top < window.innerHeight &&
          right > 0 &&
          right < window.innerWidth + 1;
        if (!visible) return null;
        return (
          <button
            key={account.id}
            className="cp-account-menu-trigger"
            data-account-id={account.id}
            type="button"
            aria-label={`打开 ${account.nickname} 操作菜单`}
            aria-haspopup="menu"
            aria-expanded={menuAccountId === account.id}
            style={{ left: right - 36, top: top + 7 }}
            onClick={() =>
              setMenuAccountId((current) =>
                current === account.id ? null : account.id,
              )
            }
          >
            <MoreHorizontal size={18} />
          </button>
        );
      })}

      {activeMenuCard ? (
        <div
          className="cp-account-action-menu"
          data-account-id={activeMenuCard.account.id}
          role="menu"
          aria-label={`${activeMenuCard.account.nickname} 账户操作`}
          style={{
            left: Math.max(
              12,
              Math.min(activeMenuCard.right - 190, window.innerWidth - 202),
            ),
            top: activeMenuCard.top + 39,
          }}
          onKeyDown={onMenuKeyDown}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => focusAccountEditor(activeMenuCard.account.id)}
          >
            <Pencil size={15} />
            <span>编辑账户</span>
          </button>
          {!activeMenuCard.account.isDefault &&
          activeMenuCard.account.status !== "DISABLED" ? (
            <button
              type="button"
              role="menuitem"
              aria-disabled={!isAccountPaymentReady(activeMenuCard.account)}
              title={
                isAccountPaymentReady(activeMenuCard.account)
                  ? undefined
                  : "该账户尚未完成验证，暂不能设为默认。"
              }
              onClick={() => setDefaultAccount(activeMenuCard.account)}
            >
              <Star size={15} />
              <span>设为默认</span>
            </button>
          ) : null}
          {(() => {
            const rule = getDestructiveAccountRule(activeMenuCard.account);
            const label =
              rule.action === "delete"
                ? "删除账户"
                : rule.action === "reenable"
                  ? "重新启用"
                  : "停用账户";
            const Icon =
              rule.action === "delete"
                ? Trash2
                : rule.action === "reenable"
                  ? RotateCcw
                  : Power;
            return (
              <button
                className={
                  rule.action === "delete"
                    ? "cp-account-menu-danger"
                    : undefined
                }
                type="button"
                role="menuitem"
                aria-disabled={rule.blocked}
                title={rule.reason}
                onClick={() =>
                  requestDestructiveAction(activeMenuCard.account)
                }
              >
                <Icon size={15} />
                <span>{label}</span>
                {rule.blocked ? (
                  <small className="cp-account-action-reason">
                    {rule.reason}
                  </small>
                ) : null}
              </button>
            );
          })()}
        </div>
      ) : null}

      {summaryHost
        ? createPortal(
            <div className="cp-account-availability" aria-live="polite">
              <span>
                可用账户 <strong>{paymentReadyCount}</strong> 个
              </span>
              {paymentReadyCount === 0 ? (
                <span>暂无可用于付款的账户，请新增并完成验证。</span>
              ) : null}
            </div>,
            summaryHost,
          )
        : null}

      {dialog && dialogAccount && dialog.kind === "confirm" ? (
        <DialogShell
          title={
            dialog.mode === "delete" ? "删除付款账户？" : "停用付款账户？"
          }
          description={
            dialog.mode === "delete"
              ? "删除后将无法恢复，该账户将不再用于后续付款。"
              : "停用后，该账户不能用于新的付款，但历史项目、Invoice 和付款记录仍会保留。"
          }
          confirmLabel={dialog.mode === "delete" ? "删除账户" : "确认停用"}
          danger={dialog.mode === "delete"}
          onCancel={closeDialog}
          onConfirm={confirmAction}
        >
          <AccountSummary account={dialogAccount} />
        </DialogShell>
      ) : null}

      {dialog && dialogAccount && dialog.kind === "switch" ? (
        <DialogShell
          title="请先更换默认付款账户"
          description="该账户是当前默认付款账户，请选择一个新的默认账户后继续。"
          confirmLabel={
            dialog.mode === "delete" ? "更换并删除" : "更换并停用"
          }
          danger={dialog.mode === "delete"}
          confirmDisabled={!replacementId}
          onCancel={closeDialog}
          onConfirm={confirmAction}
        >
          <AccountSummary account={dialogAccount} />
          {availableAccounts.length ? (
            <fieldset className="cp-account-choice-list">
              <legend>选择新的默认付款账户</legend>
              {availableAccounts.map((account) => (
                <label key={account.id}>
                  <input
                    type="radio"
                    name="cp-new-default-account"
                    value={account.id}
                    checked={replacementId === account.id}
                    onChange={() => setReplacementId(account.id)}
                  />
                  <AccountSummary account={account} />
                </label>
              ))}
            </fieldset>
          ) : (
            <div className="cp-account-no-replacement" role="status">
              <AlertCircle size={18} />
              <span>
                <strong>暂无其他可用付款账户</strong>
                <small>请先新增付款账户并完成验证，再停用当前默认账户。</small>
              </span>
            </div>
          )}
        </DialogShell>
      ) : null}

      {toast ? (
        <div
          className={`cp-account-toast cp-account-toast-${toast.tone}`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          {toast.tone === "success" ? (
            <CheckCircle2 size={17} />
          ) : (
            <AlertCircle size={17} />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            aria-label="关闭提示"
            onClick={() => setToast(null)}
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
    </>
  );
};
