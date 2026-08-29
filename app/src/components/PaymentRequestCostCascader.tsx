import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  PAYMENT_REQUEST_COST_TYPES,
  PAYMENT_REQUEST_PROCUREMENT_COST_DETAILS,
  paymentRequestCostTypeLabel,
  type PaymentRequestCostType,
  type PaymentRequestProcurementCostDetail,
} from '../paymentRequestProjects';

type PaymentRequestCostCascaderProps = {
  costType: PaymentRequestCostType;
  costTypeDetail: PaymentRequestProcurementCostDetail | '';
  onChange: (
    costType: PaymentRequestCostType,
    costTypeDetail: PaymentRequestProcurementCostDetail | '',
  ) => void;
  invalid?: boolean;
};

const descriptions: Record<PaymentRequestCostType, string> = {
  '网红采买成本': '达人合作、内容制作与发布费用',
  '采购成本': '继续选择具体采购类型',
  '外包成本': '第三方服务或业务外包费用',
  '投流': '媒体投放与流量采买费用',
};

export function PaymentRequestCostCascader({
  costType,
  costTypeDetail,
  onChange,
  invalid = false,
}: PaymentRequestCostCascaderProps) {
  const [open, setOpen] = useState(false);
  const [procurementExpanded, setProcurementExpanded] = useState(costType === '采购成本');
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const detailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const updateMenuPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 12;
    const gap = 7;
    const mobile = window.innerWidth < 560;
    const width = Math.min(mobile ? window.innerWidth - margin * 2 : 520, window.innerWidth - margin * 2);
    const estimatedHeight = mobile ? 420 : 286;
    const roomBelow = window.innerHeight - rect.bottom - margin - gap;
    const roomAbove = rect.top - margin - gap;
    const showAbove = roomBelow < estimatedHeight && roomAbove > roomBelow;
    const left = Math.min(Math.max(rect.left, margin), window.innerWidth - margin - width);
    setMenuStyle({
      bottom: showAbove ? window.innerHeight - rect.top + gap : undefined,
      left,
      maxHeight: Math.max(180, Math.min(estimatedHeight, showAbove ? roomAbove : roomBelow)),
      top: showAbove ? undefined : rect.bottom + gap,
      width,
    });
  };

  const closeAndFocusTrigger = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const openMenu = (focusSelected = false) => {
    updateMenuPosition();
    setProcurementExpanded(costType === '采购成本');
    setOpen(true);
    if (focusSelected) {
      const index = Math.max(0, PAYMENT_REQUEST_COST_TYPES.indexOf(costType));
      window.requestAnimationFrame(() => typeRefs.current[index]?.focus());
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const focusType = (index: number) => {
    const total = PAYMENT_REQUEST_COST_TYPES.length;
    typeRefs.current[(index + total) % total]?.focus();
  };

  const handleTypeKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    type: PaymentRequestCostType,
    index: number,
  ) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusType(index + (event.key === 'ArrowDown' ? 1 : -1));
      return;
    }
    if (event.key === 'ArrowRight' && type === '采购成本') {
      event.preventDefault();
      setProcurementExpanded(true);
      window.requestAnimationFrame(() => {
        const detailIndex = Math.max(0, PAYMENT_REQUEST_PROCUREMENT_COST_DETAILS.indexOf(costTypeDetail as PaymentRequestProcurementCostDetail));
        detailRefs.current[detailIndex]?.focus();
      });
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndFocusTrigger();
    }
  };

  const selectType = (type: PaymentRequestCostType) => {
    if (type === '采购成本') {
      setProcurementExpanded(true);
      window.requestAnimationFrame(() => detailRefs.current[0]?.focus());
      return;
    }
    onChange(type, '');
    closeAndFocusTrigger();
  };

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      className={`payment-request-cost-cascader-menu${procurementExpanded ? ' has-children' : ''}`}
      role="tree"
      aria-label="选择成本类型和成本类型明细"
      style={menuStyle}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (menuRef.current?.contains(nextTarget) || rootRef.current?.contains(nextTarget)) return;
        setOpen(false);
      }}
    >
      <div className="payment-request-cost-cascader-level" role="group" aria-label="成本类型">
        <span className="payment-request-cost-cascader-caption">成本类型</span>
        {PAYMENT_REQUEST_COST_TYPES.map((type, index) => {
          const selected = type === costType;
          const isProcurement = type === '采购成本';
          return (
            <button
              ref={(node) => { typeRefs.current[index] = node; }}
              className={`payment-request-cost-cascader-option${selected ? ' is-selected' : ''}${isProcurement && procurementExpanded ? ' is-expanded' : ''}`}
              type="button"
              role="treeitem"
              aria-selected={selected}
              aria-expanded={isProcurement ? procurementExpanded : undefined}
              tabIndex={-1}
              key={type}
              onPointerEnter={() => {
                if (isProcurement) setProcurementExpanded(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectType(type);
                  return;
                }
                handleTypeKeyDown(event, type, index);
              }}
              onClick={() => selectType(type)}
            >
              <span><strong>{type}</strong><small>{descriptions[type]}</small></span>
              {isProcurement ? <ChevronRight size={16} aria-hidden="true" /> : selected ? <Check size={15} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      {procurementExpanded ? (
        <div className="payment-request-cost-cascader-level is-detail" role="group" aria-label="采购成本明细">
          <span className="payment-request-cost-cascader-caption">采购成本明细</span>
          {PAYMENT_REQUEST_PROCUREMENT_COST_DETAILS.map((detail, index) => {
            const selected = costType === '采购成本' && detail === costTypeDetail;
            return (
              <button
                ref={(node) => { detailRefs.current[index] = node; }}
                className={`payment-request-cost-cascader-option is-leaf${selected ? ' is-selected' : ''}`}
                type="button"
                role="treeitem"
                aria-selected={selected}
                tabIndex={-1}
                key={detail}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const total = PAYMENT_REQUEST_PROCUREMENT_COST_DETAILS.length;
                    detailRefs.current[(index + (event.key === 'ArrowDown' ? 1 : -1) + total) % total]?.focus();
                  } else if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    typeRefs.current[PAYMENT_REQUEST_COST_TYPES.indexOf('采购成本')]?.focus();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    closeAndFocusTrigger();
                  } else if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onChange('采购成本', detail);
                    closeAndFocusTrigger();
                  }
                }}
                onClick={() => {
                  onChange('采购成本', detail);
                  closeAndFocusTrigger();
                }}
              >
                <span><strong>{detail}</strong><small>归入采购成本</small></span>
                {selected ? <Check size={15} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={`custom-select custom-select-form payment-request-cost-cascader${open ? ' custom-select-open' : ''}`}>
      <button
        ref={triggerRef}
        className="custom-select-trigger"
        type="button"
        role="combobox"
        aria-label="选择成本类型"
        aria-haspopup="tree"
        aria-expanded={open}
        aria-controls={menuId}
        aria-invalid={invalid || undefined}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!open) openMenu(true);
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
          }
        }}
        onClick={() => {
          if (open) setOpen(false);
          else openMenu();
        }}
      >
        <span className="custom-select-value">{paymentRequestCostTypeLabel(costType, costTypeDetail)}</span>
        <ChevronDown className="custom-select-chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {menu && typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
    </div>
  );
}
