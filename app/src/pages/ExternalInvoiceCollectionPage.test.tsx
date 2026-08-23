import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CreatorId, EngagementId, ProjectId } from '../businessWorkflow';
import { createExternalInvoiceCollection } from '../invoice/externalInvoiceCollection';
import { createDocumentPayoutSnapshot } from '../payoutAccounts';
import type { CreatorProfile } from '../types';
import { ExternalInvoiceCollectionDetailPage } from './ExternalInvoiceCollectionPage';

const creatorId = 'creator-external-metrics' as CreatorId;
const creator: CreatorProfile = {
  id: creatorId,
  initials: 'EC',
  accent: '#8d6a8b',
  name: 'External Creator',
  handle: '@external',
  region: 'US',
  platform: 'YouTube',
  projects: 1,
  socialAccounts: [{ id: 'social-external', platform: 'YouTube', handle: '@external', profileUrl: 'https://example.com/external' }],
  contact: { legalName: 'External Creator LLC', address: '1 Market Street', phone: '000', email: 'external@example.com' },
  payoutAccounts: [{
    id: 'paypal-external',
    creatorId,
    payoutAccountId: 'payout-account-external',
    payoutAccountVersion: 'v1',
    accountFingerprint: 'fp-external',
    provider: 'PayPal',
    nickname: 'Default PayPal',
    isDefault: true,
    status: 'VERIFIED',
    paypalUsername: 'External Creator LLC',
    paypalEmail: 'external@example.com',
  }],
};
const defaultAccount = creator.payoutAccounts[0];

const record = createExternalInvoiceCollection({
  projectId: 'project-external-metrics' as ProjectId,
  projectName: 'External Invoice Prototype',
  engagementId: 'engagement-external-metrics' as EngagementId,
  creatorId,
  creatorName: 'External Creator',
  creatorHandle: '@external',
  contractIds: [],
  presetPayoutAccountId: 'payout-account-external',
  presetPayoutAccountSnapshot: createDocumentPayoutSnapshot(defaultAccount, creatorId),
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
        creator={creator}
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
    expect(html).toContain('invoice-review-workspace');
    expect(html).toContain('收集任务与校验基准');
    expect(html).toContain('预计币种&amp;金额');
    expect(html).toContain('无合同');
    expect(html).toContain('PayPal · 邮箱账户');
    expect(html).toContain('disabled=""');
  });
});
