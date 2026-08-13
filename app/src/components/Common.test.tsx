import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NoticeBanner, SelectField } from './Common';

describe('NoticeBanner', () => {
  it('always renders an accessible close action', () => {
    const markup = renderToStaticMarkup(
      <NoticeBanner>演示环境提示</NoticeBanner>,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="关闭提示"');
    expect(markup).toContain('演示环境提示');
  });
});

describe('SelectField', () => {
  it('renders a named clear action only when the field has a selected value', () => {
    const selectedMarkup = renderToStaticMarkup(
      <SelectField
        ariaLabel="合同合作达人"
        clearLabel="移除已选达人"
        value="creator-1"
        options={[{ value: 'creator-1', label: 'Mina Kato' }]}
        onChange={() => undefined}
        onClear={() => undefined}
      />,
    );
    const emptyMarkup = renderToStaticMarkup(
      <SelectField
        ariaLabel="合同合作达人"
        clearLabel="移除已选达人"
        value=""
        options={[{ value: 'creator-1', label: 'Mina Kato' }]}
        onChange={() => undefined}
        onClear={() => undefined}
      />,
    );

    expect(selectedMarkup).toContain('custom-select-has-clear');
    expect(selectedMarkup).toContain('aria-label="移除已选达人"');
    expect(emptyMarkup).not.toContain('aria-label="移除已选达人"');
  });
});
