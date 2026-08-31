import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, ListActionButton, NoticeBanner, SelectField, Toast } from './Common';

const commonSource = readFileSync(new URL('./Common.tsx', import.meta.url), 'utf8');

describe('Button', () => {
  it('keeps a reason-enabled blocked action focusable and exposes its explanation', () => {
    const markup = renderToStaticMarkup(
      <Button disabled disabledReason="请先选择 Invoice。">生成付款清单</Button>,
    );

    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('data-disabled-reason="请先选择 Invoice。"');
    expect(markup).toContain('title="请先选择 Invoice。"');
    expect(markup).not.toContain('disabled=""');
    expect(commonSource).toContain('window.dispatchEvent(new CustomEvent(BLOCKED_ACTION_EVENT');
  });

  it('preserves native disabled behavior when no reason is supplied', () => {
    const markup = renderToStaticMarkup(<Button disabled>上一页</Button>);

    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('aria-disabled="true"');
  });

  it('renders warning toasts as assertive alerts', () => {
    const markup = renderToStaticMarkup(
      <Toast
        toast={{ title: '暂时无法操作', message: '请先完成校验。', tone: 'warning' }}
        onClose={() => undefined}
      />,
    );

    expect(markup).toContain('toast toast-warning');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-live="assertive"');
    expect(markup).toContain('lucide-circle-alert');
  });
});

describe('ListActionButton', () => {
  it.each([
    ['view', 'lucide-eye'],
    ['review', 'lucide-clipboard-check'],
    ['execute', 'lucide-wallet-cards'],
    ['edit', 'lucide-pencil-line'],
    ['manage', 'lucide-user-cog'],
    ['download', 'lucide-download'],
    ['retry', 'lucide-rotate-ccw'],
    ['danger', 'lucide-circle-alert'],
  ] as const)('renders the %s semantic icon and style', (kind, iconClass) => {
    const markup = renderToStaticMarkup(<ListActionButton kind={kind}>执行操作</ListActionButton>);

    expect(markup).toContain(`list-action-${kind}`);
    expect(markup).toContain(iconClass);
    expect(markup).toContain('执行操作');
  });

  it('disables repeated clicks and exposes busy state while loading', () => {
    const markup = renderToStaticMarkup(
      <ListActionButton kind="download" loading aria-label="导出确认函">导出中...</ListActionButton>,
    );

    expect(markup).toContain('is-loading');
    expect(markup).toContain('lucide-loader-circle');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-label="导出确认函"');
  });

  it('passes native button properties and preserves an explicit disabled state', () => {
    const markup = renderToStaticMarkup(
      <ListActionButton kind="manage" disabled title="账号不可管理" data-account-id="user-1">
        管理账号
      </ListActionButton>,
    );

    expect(markup).toContain('type="button"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('title="账号不可管理"');
    expect(markup).toContain('data-account-id="user-1"');
  });
});

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

  it('allows a selected option to expose an action-oriented trigger label', () => {
    const markup = renderToStaticMarkup(
      <SelectField
        ariaLabel="凭证类型"
        value="invoice"
        selectedLabel="切换合同快照"
        options={[{ value: 'invoice', label: 'Invoice 快照' }]}
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('切换合同快照');
    expect(markup).not.toContain('Invoice 快照</span>');
  });
});
