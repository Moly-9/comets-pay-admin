import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CreatorId, EngagementId, ProjectId } from '../businessWorkflow';
import { createExternalInvoiceCollection } from '../invoice/externalInvoiceCollection';
import { ExternalInvoiceCollectionDetailPage } from './ExternalInvoiceCollectionPage';

const record = createExternalInvoiceCollection({
  projectId: 'project-external-metrics' as ProjectId,
  projectName: 'External Invoice Prototype',
  engagementId: 'engagement-external-metrics' as EngagementId,
  creatorId: 'creator-external-metrics' as CreatorId,
  creatorName: 'External Creator',
  creatorHandle: '@external',
  contractIds: [],
  expected: {
    amount: 5400,
    currency: 'USD',
    advertiser: 'COMETS INTERNATIONAL LIMITED',
    description: 'Social content publishing',
    dueDate: '2026-09-10',
  },
  actor: { account: 'media.demo', name: 'Media Reviewer', role: '媒介' },
  publish: false,
  occurredAt: '2026-08-23T01:00:00.000Z',
});

describe('ExternalInvoiceCollectionDetailPage', () => {
  it('uses the same four metric fields as internal Invoice details without the progress status bar', () => {
    const html = renderToStaticMarkup(
      <ExternalInvoiceCollectionDetailPage
        record={record}
        contracts={[]}
        canManage
        canReview
        onPublish={() => undefined}
        onSimulateUpload={() => undefined}
        onCorrect={() => undefined}
        onSubmit={() => undefined}
        onReviewField={() => undefined}
        onReturn={() => undefined}
        onApprove={() => undefined}
        onSaveReviewProgress={() => undefined}
        onBack={() => undefined}
      />,
    );

    expect(html).toContain('Invoice类型');
    expect(html).toContain('外部 Invoice');
    expect(html).toContain('当前状态');
    expect(html).toContain('Invoice金额');
    expect(html).toContain('付款方式');
    expect(html.indexOf('Invoice类型')).toBeLessThan(html.indexOf('当前状态'));
    expect(html).not.toContain('external-progress-section');
    expect(html).not.toContain('OCR 识别中和待确认识别结果只在这里作为步骤展示');
  });
});
