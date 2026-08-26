import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RequestRemarkAttachments } from './RequestRemarkAttachments';

describe('RequestRemarkAttachments', () => {
  it('renders pasted screenshots with metadata and a remove action', () => {
    const markup = renderToStaticMarkup(
      <RequestRemarkAttachments
        attachments={[{
          name: '备注截图.png',
          size: 2048,
          type: 'image/png',
          lastModified: 1,
          dataUrl: 'data:image/png;base64,preview',
        }]}
        onRemove={() => undefined}
      />,
    );

    expect(markup).toContain('<img src="data:image/png;base64,preview" alt="备注截图.png"');
    expect(markup).toContain('2 KB');
    expect(markup).toContain('aria-label="移除截图 备注截图.png"');
  });

  it('keeps legacy metadata-only attachments visible as files', () => {
    const markup = renderToStaticMarkup(
      <RequestRemarkAttachments
        attachments={[{
          name: '历史附件.pdf',
          size: 512,
          type: 'application/pdf',
          lastModified: 1,
        }]}
      />,
    );

    expect(markup).toContain('lucide-file-text');
    expect(markup).toContain('历史附件.pdf');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('移除截图');
  });
});
