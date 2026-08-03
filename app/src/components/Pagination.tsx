import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SelectField } from './Common';

type PaginationItem = number | 'start-ellipsis' | 'end-ellipsis';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const buildPaginationItems = (currentPage: number, totalPages: number): PaginationItem[] => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, 'end-ellipsis', totalPages];
  if (currentPage >= totalPages - 3) {
    return [1, 'start-ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'start-ellipsis', currentPage - 1, currentPage, currentPage + 1, 'end-ellipsis', totalPages];
};

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  ariaLabel = '列表分页',
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  ariaLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const items = buildPaginationItems(currentPage, totalPages);
  const sizeOptions = pageSizeOptions.map((size) => ({ value: String(size), label: `${size} 条/页` }));

  return (
    <nav className="pagination" aria-label={ariaLabel}>
      <button
        className="pagination-nav"
        type="button"
        aria-label="上一页"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      ><ChevronLeft size={15} strokeWidth={2} /></button>

      {items.map((item) => typeof item === 'number' ? (
        <button
          className={`pagination-page ${item === currentPage ? 'pagination-current' : ''}`}
          type="button"
          key={item}
          aria-label={`第 ${item} 页`}
          aria-current={item === currentPage ? 'page' : undefined}
          onClick={() => onPageChange(item)}
        >{item}</button>
      ) : (
        <span className="pagination-ellipsis" aria-hidden="true" key={item}>…</span>
      ))}

      <button
        className="pagination-nav"
        type="button"
        aria-label="下一页"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      ><ChevronRight size={15} strokeWidth={2} /></button>

      {onPageSizeChange ? (
        <SelectField
          ariaLabel="每页条数"
          className="pagination-size-select"
          variant="compact"
          value={String(pageSize)}
          options={sizeOptions}
          onChange={(value) => onPageSizeChange(Number(value))}
        />
      ) : null}
    </nav>
  );
}
