import { CheckCircle2, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type SearchableOption = {
  value: string;
  label: string;
  selectedLabel?: string;
  description?: string;
  searchText?: string;
};

export const filterSearchableOptions = (
  options: SearchableOption[],
  query: string,
) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return options;
  return options.filter((option) => (
    `${option.label} ${option.selectedLabel ?? ''} ${option.description ?? ''} ${option.searchText ?? ''}`
      .toLowerCase()
      .includes(normalized)
  ));
};

export function SearchableComboBox({
  value,
  options,
  placeholder,
  ariaLabel,
  disabled = false,
  error,
  onChange,
  onClear,
}: {
  value: string;
  options: SearchableOption[];
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find((option) => option.value === value);
  const visibleOptions = useMemo(
    () => filterSearchableOptions(options, query),
    [options, query],
  );

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const choose = (option: SearchableOption) => {
    onChange(option.value);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className={`contract-search-combobox ${open ? 'is-open' : ''} ${error ? 'has-error' : ''}`} ref={rootRef}>
      <div className="contract-search-input-wrap">
        <Search size={15} aria-hidden="true" />
        <input
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={`${ariaLabel.replace(/\s+/g, '-')}-options`}
          aria-autocomplete="list"
          value={open ? query : (selected?.selectedLabel ?? selected?.label ?? query)}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, Math.max(visibleOptions.length - 1, 0)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const option = visibleOptions[activeIndex];
              if (option) choose(option);
            } else if (event.key === 'Escape') {
              setQuery('');
              setOpen(false);
            }
          }}
        />
        {value ? (
          <button
            type="button"
            className="contract-search-clear"
            aria-label={`清除${ariaLabel}`}
            title={`清除${ariaLabel}`}
            disabled={disabled}
            onClick={onClear}
          >
            <X size={14} />
          </button>
        ) : null}
        <button
          type="button"
          className="contract-search-toggle"
          aria-label={`展开${ariaLabel}`}
          title={`展开${ariaLabel}`}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {open && !disabled ? (
        <div className="contract-search-menu" id={`${ariaLabel.replace(/\s+/g, '-')}-options`} role="listbox" aria-label={`${ariaLabel}选项`}>
          <div className="contract-search-result-count">{visibleOptions.length} 个结果</div>
          {visibleOptions.length ? visibleOptions.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`contract-search-option ${index === activeIndex ? 'is-active' : ''} ${option.value === value ? 'is-selected' : ''}`}
              key={option.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              <span><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</span>
              {option.value === value ? <CheckCircle2 size={15} aria-hidden="true" /> : null}
            </button>
          )) : <div className="contract-search-empty">未找到匹配项</div>}
        </div>
      ) : null}
    </div>
  );
}
