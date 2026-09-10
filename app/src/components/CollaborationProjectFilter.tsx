import { ChevronDown, Circle, CircleDot, Search } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { CollaborationInvoiceRow } from '../collaborationInvoices';
import './CollaborationProjectFilter.css';

export type CollaborationProjectFilterOption = {
  value: string;
  label: string;
  searchText: string;
  invoiceCount: number;
};

export const collaborationProjectFilterKeyFor = (row: CollaborationInvoiceRow) => (
  row.projectLinkId
    ? `project:${row.projectLinkId}`
    : `name:${row.projectName.trim().toLocaleLowerCase('zh-CN')}`
);

export const buildCollaborationProjectFilterOptions = (
  rows: readonly CollaborationInvoiceRow[],
): CollaborationProjectFilterOption[] => {
  const optionsByValue = new Map<string, CollaborationProjectFilterOption>();
  rows.forEach((row) => {
    const value = collaborationProjectFilterKeyFor(row);
    const code = row.project?.cooperationProjectCode
      ?? row.project?.projectCode
      ?? row.projectLinkId
      ?? '';
    const existing = optionsByValue.get(value);
    if (existing) {
      existing.invoiceCount += 1;
      return;
    }
    optionsByValue.set(value, {
      value,
      label: row.projectName,
      searchText: `${row.projectName} ${code}`.trim(),
      invoiceCount: 1,
    });
  });
  return [
    {
      value: 'all',
      label: '全部关联项目',
      searchText: '全部关联项目',
      invoiceCount: rows.length,
    },
    ...optionsByValue.values(),
  ];
};

export const filterCollaborationRowsByProject = (
  rows: readonly CollaborationInvoiceRow[],
  value: string,
) => value === 'all'
  ? [...rows]
  : rows.filter((row) => collaborationProjectFilterKeyFor(row) === value);

export function CollaborationProjectFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly CollaborationProjectFilterOption[];
  onChange: (value: string) => void;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
    if (!normalizedQuery) return options;
    return options.filter((option) => (
      option.searchText.toLocaleLowerCase('zh-CN').includes(normalizedQuery)
    ));
  }, [options, query]);

  const closeMenu = () => {
    setOpen(false);
    setQuery('');
  };

  const openMenu = () => {
    setQuery('');
    setActiveIndex(Math.max(options.findIndex((option) => option.value === value), 0));
    setOpen(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const chooseOption = (option: CollaborationProjectFilterOption) => {
    onChange(option.value);
    closeMenu();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (value !== 'all' && !options.some((option) => option.value === value)) {
      onChange('all');
    }
  }, [onChange, options, value]);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => {
        if (!visibleOptions.length) return 0;
        return event.key === 'ArrowDown'
          ? (current + 1) % visibleOptions.length
          : (current - 1 + visibleOptions.length) % visibleOptions.length;
      });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) chooseOption(option);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  return (
    <div
      className={`collaboration-project-filter${open ? ' is-open' : ''}`}
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeMenu();
      }}
    >
      <span className="collaboration-project-filter-label">关联项目</span>
      <button
        ref={triggerRef}
        className="collaboration-project-filter-trigger"
        type="button"
        role="combobox"
        aria-label="关联项目筛选"
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open}
        title={selected?.label}
        onKeyDown={(event) => {
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !open) {
            event.preventDefault();
            openMenu();
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            closeMenu();
          }
        }}
        onClick={() => {
          if (open) closeMenu();
          else openMenu();
        }}
      >
        <span>{selected?.label ?? '全部关联项目'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div className="collaboration-project-filter-menu">
          <label className="collaboration-project-filter-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              role="searchbox"
              aria-label="搜索关联项目"
              aria-controls={listboxId}
              aria-activedescendant={visibleOptions[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
              autoComplete="off"
              placeholder="搜索关联项目"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </label>
          <div id={listboxId} className="collaboration-project-filter-options" role="listbox" aria-label="关联项目选项">
            {visibleOptions.map((option, index) => {
              const optionSelected = option.value === value;
              return (
                <button
                  id={`${listboxId}-option-${index}`}
                  className={`collaboration-project-filter-option${optionSelected ? ' is-selected' : ''}${activeIndex === index ? ' is-active' : ''}`}
                  type="button"
                  role="option"
                  aria-selected={optionSelected}
                  tabIndex={-1}
                  key={option.value}
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => chooseOption(option)}
                >
                  {optionSelected
                    ? <CircleDot className="collaboration-project-filter-radio is-selected" size={17} aria-hidden="true" />
                    : <Circle className="collaboration-project-filter-radio" size={17} aria-hidden="true" />}
                  <span className="collaboration-project-filter-option-copy">
                    <strong title={option.label}>{option.label}</strong>
                    <small>{option.invoiceCount} 份 Invoice</small>
                  </span>
                </button>
              );
            })}
            {!visibleOptions.length ? (
              <div className="collaboration-project-filter-empty" role="status">没有匹配的关联项目</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
