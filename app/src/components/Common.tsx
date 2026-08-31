import {
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Download,
  Eye,
  Info,
  LoaderCircle,
  PencilLine,
  RotateCcw,
  UserCog,
  WalletCards,
  X,
} from 'lucide-react';
import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, KeyboardEvent, PropsWithChildren, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { INVOICE_REVIEW_STATUS_META } from '../invoice/invoiceReviewWorkflow';
import type { InvoiceReviewStatus, PayoutStatus, ToastState } from '../types';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: ReactNode;
  disabledReason?: string;
};

export const BLOCKED_ACTION_EVENT = 'comets-pay:blocked-action';

export function Button({
  children,
  className = '',
  variant = 'primary',
  icon,
  disabled = false,
  disabledReason,
  onClick,
  title,
  ...props
}: ButtonProps) {
  const explainDisabledAction = disabled && Boolean(disabledReason);

  return (
    <button
      className={`button button-${variant} ${className}`}
      type="button"
      disabled={explainDisabledAction ? undefined : disabled}
      aria-disabled={explainDisabledAction ? true : undefined}
      data-disabled-reason={explainDisabledAction ? disabledReason : undefined}
      title={explainDisabledAction ? disabledReason : title}
      onClick={(event) => {
        if (explainDisabledAction) {
          event.preventDefault();
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent(BLOCKED_ACTION_EVENT, {
            detail: { reason: disabledReason },
          }));
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export type ListActionKind =
  | 'view'
  | 'review'
  | 'execute'
  | 'edit'
  | 'manage'
  | 'download'
  | 'retry'
  | 'danger';

export type ListActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind: ListActionKind;
  loading?: boolean;
};

const LIST_ACTION_ICONS = {
  view: Eye,
  review: ClipboardCheck,
  execute: WalletCards,
  edit: PencilLine,
  manage: UserCog,
  download: Download,
  retry: RotateCcw,
  danger: CircleAlert,
} satisfies Record<ListActionKind, typeof Eye>;

export const ListActionButton = forwardRef<HTMLButtonElement, ListActionButtonProps>(function ListActionButton({
  children,
  className = '',
  disabled = false,
  kind,
  loading = false,
  type = 'button',
  ...props
}, ref) {
  const Icon = loading ? LoaderCircle : LIST_ACTION_ICONS[kind];

  return (
    <button
      ref={ref}
      className={`list-action-button list-action-${kind}${loading ? ' is-loading' : ''}${className ? ` ${className}` : ''}`}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <Icon className="list-action-icon" size={14} strokeWidth={2.15} aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
});

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  title?: string;
  disabled?: boolean;
  leading?: ReactNode;
  badges?: Array<{
    label: string;
    tone?: 'neutral' | 'success' | 'warning';
  }>;
  details?: Array<{
    label: string;
    value: string;
  }>;
};

type SelectFieldProps<T extends string> = {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  onClear?: () => void;
  ariaLabel: string;
  clearLabel?: string;
  placeholder?: string;
  selectedLabel?: string;
  className?: string;
  variant?: 'toolbar' | 'form' | 'compact';
  disabled?: boolean;
  leadingIcon?: ReactNode;
  menuStrategy?: 'absolute' | 'fixed';
  menuClassName?: string;
  menuWidth?: number;
};

export function SelectField<T extends string = string>({
  value,
  options,
  onChange,
  onClear,
  ariaLabel,
  clearLabel = '清除选择',
  placeholder = '请选择',
  selectedLabel,
  className = '',
  variant = 'toolbar',
  disabled = false,
  leadingIcon,
  menuStrategy = 'absolute',
  menuClassName = '',
  menuWidth,
}: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom');
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingFocusIndex = useRef<number | null>(null);
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value);
  const disabledOptionHint = options.find((option) => option.disabled && option.title)?.title;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedLeading = selectedOption?.leading ?? leadingIcon;
  const canClear = Boolean(value && onClear && !disabled);

  const enabledIndexFrom = (start: number, direction: 1 | -1) => {
    if (!options.length) return -1;
    let index = start;
    for (let count = 0; count < options.length; count += 1) {
      index = (index + direction + options.length) % options.length;
      if (!options[index].disabled) return index;
    }
    return -1;
  };

  const updatePlacement = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimatedMenuHeight = Math.min(
      options.reduce((height, option) => height + (option.details?.length ? 148 : 49), 12),
      340,
    );
    const viewportMargin = 12;
    const menuGap = 7;
    const roomBelow = window.innerHeight - rect.bottom - viewportMargin - menuGap;
    const roomAbove = rect.top - viewportMargin - menuGap;
    const nextPlacement = roomBelow < estimatedMenuHeight && roomAbove > roomBelow ? 'top' : 'bottom';
    setPlacement(nextPlacement);

    if (menuStrategy !== 'fixed') {
      setMenuStyle(undefined);
      return;
    }

    const availableWidth = Math.max(0, window.innerWidth - viewportMargin * 2);
    const minimumWidth = variant === 'compact' ? 132 : 196;
    const width = Math.min(Math.max(rect.width, menuWidth ?? minimumWidth), availableWidth);
    const preferredLeft = variant === 'compact' ? rect.right - width : rect.left;
    const left = Math.min(
      Math.max(preferredLeft, viewportMargin),
      Math.max(viewportMargin, window.innerWidth - viewportMargin - width),
    );
    const availableHeight = nextPlacement === 'top' ? roomAbove : roomBelow;

    setMenuStyle({
      bottom: nextPlacement === 'top' ? window.innerHeight - rect.top + menuGap : undefined,
      left,
      maxHeight: Math.max(72, Math.min(340, availableHeight)),
      top: nextPlacement === 'bottom' ? rect.bottom + menuGap : undefined,
      width,
    });
  };

  const openAndFocus = (index: number) => {
    if (disabled || index < 0) return;
    updatePlacement();
    pendingFocusIndex.current = index;
    setOpen(true);
  };

  const closeAndFocusTrigger = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open || pendingFocusIndex.current === null) return undefined;
    const animationFrame = window.requestAnimationFrame(() => {
      optionRefs.current[pendingFocusIndex.current ?? -1]?.focus();
      pendingFocusIndex.current = null;
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open, options.length]);

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const index = selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : enabledIndexFrom(-1, 1);
      if (open) optionRefs.current[index]?.focus();
      else openAndFocus(index);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const index = selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : enabledIndexFrom(0, -1);
      if (open) optionRefs.current[index]?.focus();
      else openAndFocus(index);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = enabledIndexFrom(index, event.key === 'ArrowDown' ? 1 : -1);
      optionRefs.current[nextIndex]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const edgeIndex = event.key === 'Home' ? enabledIndexFrom(-1, 1) : enabledIndexFrom(0, -1);
      optionRefs.current[edgeIndex]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeAndFocusTrigger();
    }
  };

  const menu = open ? (
    <div
      ref={menuRef}
      id={listboxId}
      className={`custom-select-menu custom-select-menu-${variant}${placement === 'top' ? ' custom-select-menu-top' : ''}${menuStrategy === 'fixed' ? ' custom-select-menu-fixed' : ''}${menuClassName ? ` ${menuClassName}` : ''}`}
      role="listbox"
      aria-label={ariaLabel}
      style={menuStrategy === 'fixed' ? menuStyle : undefined}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => { optionRefs.current[index] = node; }}
            className={`custom-select-option${option.leading ? ' custom-select-option-with-leading' : ''}${option.details?.length ? ' custom-select-option-with-details' : ''}${selected ? ' custom-select-option-selected' : ''}`}
            type="button"
            role="option"
            aria-selected={selected}
            aria-disabled={option.disabled ? true : undefined}
            title={option.title}
            disabled={option.disabled}
            tabIndex={-1}
            onPointerDown={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onChange(option.value);
                closeAndFocusTrigger();
                return;
              }
              handleOptionKeyDown(event, index);
            }}
            onClick={() => {
              onChange(option.value);
              closeAndFocusTrigger();
            }}
          >
            {option.leading ? <span className="custom-select-option-leading" aria-hidden="true">{option.leading}</span> : null}
            <span className="custom-select-option-copy">
              <span className="custom-select-option-heading">
                <span className="custom-select-option-label">{option.label}</span>
                {option.badges?.length ? (
                  <span className="custom-select-option-badges">
                    {option.badges.map((badge) => (
                      <span className={`custom-select-option-badge is-${badge.tone ?? 'neutral'}`} key={`${badge.label}-${badge.tone ?? 'neutral'}`}>{badge.label}</span>
                    ))}
                  </span>
                ) : null}
              </span>
              {option.description ? <span className="custom-select-option-description">{option.description}</span> : null}
              {option.details?.length ? (
                <span className="custom-select-option-details">
                  {option.details.map((detail) => (
                    <span className="custom-select-option-detail" key={`${detail.label}-${detail.value}`}>
                      <small>{detail.label}</small>
                      <strong>{detail.value}</strong>
                    </span>
                  ))}
                </span>
              ) : null}
            </span>
            <span className="custom-select-option-check" aria-hidden="true">
              {selected ? <Check size={15} strokeWidth={2.6} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`custom-select custom-select-${variant}${open ? ' custom-select-open' : ''}${canClear ? ' custom-select-has-clear' : ''} ${className}`.trim()}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (event.currentTarget.contains(nextTarget) || menuRef.current?.contains(nextTarget)) return;
        window.setTimeout(() => {
          const activeElement = document.activeElement;
          if (!rootRef.current?.contains(activeElement) && !menuRef.current?.contains(activeElement)) setOpen(false);
        }, 0);
      }}
    >
      <button
        ref={triggerRef}
        className="custom-select-trigger"
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        title={disabledOptionHint}
        disabled={disabled}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            updatePlacement();
            setOpen(true);
          }
        }}
      >
        {selectedLeading ? <span className="custom-select-leading" aria-hidden="true">{selectedLeading}</span> : null}
        <span className={`custom-select-value${selectedOption ? '' : ' custom-select-placeholder'}`}>
          {selectedLabel ?? selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown className="custom-select-chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {canClear ? (
        <button
          className="custom-select-clear"
          type="button"
          aria-label={clearLabel}
          title={clearLabel}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(false);
            onClear?.();
            window.requestAnimationFrame(() => triggerRef.current?.focus());
          }}
        >
          <X size={14} strokeWidth={2.2} aria-hidden="true" />
        </button>
      ) : null}
      {menuStrategy === 'fixed' && menu && typeof document !== 'undefined'
        ? createPortal(menu, document.body)
        : menu}
    </div>
  );
}

export function PageHeading({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-heading-row">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-heading-actions">{actions}</div> : null}
    </div>
  );
}

export function NoticeBanner({ children, onClose }: PropsWithChildren<{ onClose?: () => void }>) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const closeNotice = () => {
    setVisible(false);
    onClose?.();
  };

  return (
    <div className="notice-banner" role="status">
      <span className="notice-icon"><Info size={16} strokeWidth={2.4} /></span>
      <div>{children}</div>
      <button className="icon-button notice-close" type="button" aria-label="关闭提示" onClick={closeNotice}>
        <X size={18} />
      </button>
    </div>
  );
}

const STATUS_COLORS: Record<PayoutStatus, string> = {
  未进入付款: '#9ca3af',
  等待付款: '#3b82f6',
  信息异常: '#ef4444',
  飞书审批中: '#a855f7',
  付款处理中: '#ec4899',
  付款失败: '#ef4444',
  已付款: '#22c55e',
  已退回: '#ef4444',
};

export function StatusMark({
  status,
  label,
}: {
  status: PayoutStatus | InvoiceReviewStatus;
  label?: string;
}) {
  const color = status in INVOICE_REVIEW_STATUS_META
    ? INVOICE_REVIEW_STATUS_META[status as InvoiceReviewStatus].color
    : STATUS_COLORS[status as PayoutStatus];
  return (
    <span className="status-mark">
      <span className="status-tick" style={{ backgroundColor: color }} />
      {label ?? status}
    </span>
  );
}

export function Avatar({ initials, accent = '#ff7d64', size = 'md' }: { initials: string; accent?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ '--avatar-accent': accent } as CSSProperties}
    >
      {initials}
    </span>
  );
}

export function Modal({
  title,
  children,
  onClose,
  onBackdropMouseDown,
  footer,
  width = '560px',
  className,
}: PropsWithChildren<{
  title: string;
  onClose: () => void;
  onBackdropMouseDown?: () => void;
  footer?: ReactNode;
  width?: string;
  className?: string;
}>) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusableSelector = [
      'button:not(:disabled)',
      'input:not(:disabled)',
      'select:not(:disabled)',
      'textarea:not(:disabled)',
      '[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const focusableElements = () => Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    ).filter((element) => !element.hasAttribute('hidden'));
    const animationFrame = window.requestAnimationFrame(() => {
      if (!panelRef.current?.contains(document.activeElement)) {
        focusableElements()[0]?.focus();
      }
    });
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const openDialogs = document.querySelectorAll<HTMLElement>('.modal-panel[role="dialog"]');
      if (openDialogs[openDialogs.length - 1] !== panelRef.current) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusableElements();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onBackdropMouseDown ?? onClose}>
      <section
        ref={panelRef}
        className={['modal-panel', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: width }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="modal-content">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  const warning = toast.tone === 'warning';
  return (
    <div className={`toast${warning ? ' toast-warning' : ''}`} role={warning ? 'alert' : 'status'} aria-live={warning ? 'assertive' : 'polite'}>
      <span className="toast-check">{warning ? <CircleAlert size={16} strokeWidth={2.25} /> : <Check size={16} strokeWidth={2.5} />}</span>
      <div>
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>
      <button className="icon-button" type="button" aria-label="关闭通知" onClick={onClose}><X size={17} /></button>
    </div>
  );
}
