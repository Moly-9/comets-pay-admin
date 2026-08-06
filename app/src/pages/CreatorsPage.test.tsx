import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreatorsPage, INITIAL_CREATORS } from './OperationalPages';

vi.mock('react-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-dom')>(),
  createPortal: (children: ReactNode) => children,
}));

afterEach(() => vi.unstubAllGlobals());

describe('CreatorsPage', () => {
  it('保留最初达人档案布局并继续展示当前收款账户', () => {
    vi.stubGlobal('document', { body: {} });
    const creator = INITIAL_CREATORS[0];
    const html = renderToStaticMarkup(
      <CreatorsPage
        notify={vi.fn()}
        creators={[creator]}
        onSaveCreator={vi.fn()}
        canEdit
        initialCreatorId={creator.id}
      />,
    );

    expect(html).toContain('class="profile-summary"');
    expect(html).not.toContain('creator-profile-summary');
    expect(html).toContain('class="profile-details"');
    expect(html).toContain('合作项目');
    expect(html).toContain('真实姓名');
    expect(html).toContain('查看主页');
    expect(html).not.toContain('认证状态待同步');
    expect(html).toContain(`creator-payment-information-${creator.id}`);
    expect(html).toContain('收款账户');
  });
});
