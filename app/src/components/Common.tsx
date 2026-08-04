import { Check, ChevronDown, Info, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, KeyboardEvent, PropsWithChildren, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { INVOICE_REVIEW_STATUS_META } from '../invoice/invoiceReviewWorkflow';
import type { InvoiceReviewStatus, PayoutStatus, ToastState } from '../types';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: ReactNode;
};

export function Button({ children, className = '', variant = 'primary', icon, ...props }: ButtonProps) {
  return (
    <button className={`button button-${variant} ${className}`} type="button" {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
  leading?: ReactNode;
};

type SelectFieldProps<T extends string> = {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  variant?: 'toolbar' | 'form' | 'compact';
  disabled?: boolean;
  leadingIcon?: ReactNode;
};

export function SelectField<T extends string = string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = '请选择',
  className = '',
  variant = 'toolbar',
  disabled = false,
  leadingIcon,
}: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingFocusIndex = useRef<number | null>(null);
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedLeading = selectedOption?.leading ?? leadingIcon;

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
    const estimatedMenuHeight = Math.min(options.length * 49 + 12, 340);
    const roomBelow = window.innerHeight - rect.bottom;
    setPlacement(roomBelow < estimatedMenuHeight + 16 && rect.top > roomBelow ? 'top' : 'bottom');
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
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  return (
    <div
      ref={rootRef}
      className={`custom-select custom-select-${variant}${open ? ' custom-select-open' : ''} ${className}`.trim()}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        window.setTimeout(() => {
          if (!rootRef.current?.contains(document.activeElement)) setOpen(false);
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
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown className="custom-select-chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={listboxId}
          className={`custom-select-menu${placement === 'top' ? ' custom-select-menu-top' : ''}`}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                ref={(node) => { optionRefs.current[index] = node; }}
                className={`custom-select-option${option.leading ? ' custom-select-option-with-leading' : ''}${selected ? ' custom-select-option-selected' : ''}`}
                type="button"
                role="option"
                aria-selected={selected}
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
                  <span className="custom-select-option-label">{option.label}</span>
                  {option.description ? <span className="custom-select-option-description">{option.description}</span> : null}
                </span>
                <span className="custom-select-option-check" aria-hidden="true">
                  {selected ? <Check size={15} strokeWidth={2.6} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
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
  return (
    <div className="notice-banner" role="status">
      <span className="notice-icon"><Info size={16} strokeWidth={2.4} /></span>
      <div>{children}</div>
      {onClose ? (
        <button className="icon-button notice-close" type="button" aria-label="关闭提示" onClick={onClose}>
          <X size={18} />
        </button>
      ) : null}
    </div>
  );
}

const STATUS_COLORS: Record<PayoutStatus, string> = {
  未进入付款: '#9ca3af',
  等待付款: '#3b82f6',
  信息异常: '#ef4444',
  飞书审批中: '#a855f7',
  付款处理中: '#ec4899',
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
  footer,
  width = '560px',
  className,
}: PropsWithChildren<{ title: string; onClose: () => void; footer?: ReactNode; width?: string; className?: string }>) {
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
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
  return (
    <div className="toast" role="status">
      <span className="toast-check"><Check size={16} strokeWidth={2.5} /></span>
      <div>
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>
      <button className="icon-button" type="button" aria-label="关闭通知" onClick={onClose}><X size={17} /></button>
    </div>
  );
}
