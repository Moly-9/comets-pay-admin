import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildPaginationItems, paginateItems, Pagination } from './Pagination';

describe('pagination helpers', () => {
  it('slices the requested page and clamps pages after a list shrinks', () => {
    expect(paginateItems(Array.from({ length: 23 }, (_, index) => index + 1), 2, 10)).toEqual({
      currentPage: 2,
      pageItems: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      totalPages: 3,
    });
    expect(paginateItems(['only'], 9, 10)).toEqual({
      currentPage: 1,
      pageItems: ['only'],
      totalPages: 1,
    });
  });

  it('keeps large page ranges compact around the current page', () => {
    expect(buildPaginationItems(1, 10)).toEqual([1, 2, 3, 4, 5, 'end-ellipsis', 10]);
    expect(buildPaginationItems(6, 10)).toEqual([1, 'start-ellipsis', 5, 6, 7, 'end-ellipsis', 10]);
    expect(buildPaginationItems(10, 10)).toEqual([1, 'start-ellipsis', 6, 7, 8, 9, 10]);
  });

  it('renders accessible navigation and page-size controls for a short list', () => {
    const markup = renderToStaticMarkup(
      <Pagination
        page={1}
        pageSize={10}
        total={4}
        onPageChange={() => undefined}
        onPageSizeChange={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="列表分页"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('aria-label="上一页"');
    expect(markup).toContain('aria-label="下一页"');
    expect(markup).toContain('aria-label="每页条数"');
  });
});
