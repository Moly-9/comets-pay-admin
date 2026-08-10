import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PaymentProgressSteps } from './PaymentProgressSteps';

describe('PaymentProgressSteps', () => {
  it('shows submitted as complete, platform processing as current and paid as pending', () => {
    const html = renderToStaticMarkup(<PaymentProgressSteps ariaLabel="付款进度" status="付款处理中" />);

    expect(html).toContain('<strong>已提交</strong>');
    expect(html).toContain('<strong>平台处理中</strong>');
    expect(html).toContain('<strong>已付款</strong>');
    expect(html.match(/class="is-complete"/g)).toHaveLength(1);
    expect(html.match(/class="is-current"/g)).toHaveLength(1);
    expect(html.match(/class="is-pending"/g)).toHaveLength(1);
    expect(html).toContain('aria-current="step"');
  });

  it('marks all three stages complete after payment', () => {
    const html = renderToStaticMarkup(<PaymentProgressSteps ariaLabel="付款进度" status="已付款" />);

    expect(html.match(/class="is-complete"/g)).toHaveLength(3);
    expect(html).not.toContain('aria-current="step"');
  });

  it('shows a failed payment outcome without losing the completed earlier stages', () => {
    const html = renderToStaticMarkup(<PaymentProgressSteps ariaLabel="付款进度" status="部分失败" />);

    expect(html.match(/class="is-complete"/g)).toHaveLength(2);
    expect(html.match(/class="is-failed"/g)).toHaveLength(1);
    expect(html).toContain('<small>部分失败</small>');
    expect(html).toContain('aria-current="step"');
  });
});
