import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_CONTRACTS } from '../contracts';
import { SystemConfigurationPage } from './SystemConfigurationPage';

describe('SystemConfigurationPage', () => {
  it('owns the shared contract-template list and its template-specific columns', () => {
    const html = renderToStaticMarkup(
      <SystemConfigurationPage
        contracts={INITIAL_CONTRACTS}
        projects={[]}
        creators={[]}
        notify={vi.fn()}
        onUpdateContract={vi.fn()}
      />,
    );

    expect(html).toContain('<h1>系统配置</h1>');
    expect(html).toContain('<h2>合同模板</h2>');
    expect(html).toContain('1 个模板');
    expect(html).toContain('<th>模板名称</th><th>合同类型</th><th class="contract-date-cell">更新日期</th><th>模板状态</th><th>使用就绪度</th>');
    expect(html).toContain('社交媒体推广服务标准合同（2026 KOL 模板）');
    expect(html).toContain('已启动');
    expect(html).not.toContain('Nebula Quest 法国 KOL 推广服务合同');
    expect(html).toContain('编辑模板');
  });
});
