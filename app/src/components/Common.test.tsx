import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NoticeBanner, SelectField } from './Common';

const commonSource = readFileSync(new URL('./Common.tsx', import.meta.url), 'utf8');

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

  it('exposes a disabled option reason for pointer and assistive technology users', () => {
    const markup = renderToStaticMarkup(
      <SelectField
        ariaLabel="凭证类型"
        value="invoice"
        options={[
          { value: 'invoice', label: 'Invoice 快照' },
          { value: 'contract', label: '合同快照', description: '没有合同', title: '没有合同', disabled: true },
        ]}
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('title="没有合同"');
    expect(commonSource).toContain('aria-disabled={option.disabled ? true : undefined}');
    expect(commonSource).toContain('disabled={option.disabled}');
  });
});
